use tokio::process::{Child, Command as TokioCommand};
use tokio::io::{AsyncBufReadExt, BufReader};
use std::process::Stdio;
use uuid::Uuid;
use chrono::Utc;
use std::sync::Arc;
use tokio::sync::Mutex;
use crate::models::*;
use crate::AppState;
use crate::config::save_settings;

async fn resolve_llama_server_path_with_fallback(
    state: &AppState,
    global_config: &GlobalConfig,
) -> std::path::PathBuf {
    use std::fs;
    use std::time::SystemTime;

    let exe_name = if cfg!(windows) { "llama-server.exe" } else { "llama-server" };
    // First, build the preferred path using active version or active folder
    let preferred = if let Some(version_name) = &global_config.active_executable_version {
        std::path::Path::new(&global_config.executable_folder)
            .join("versions")
            .join(version_name)
            .join(exe_name)
    } else if let Some(active_path) = &global_config.active_executable_folder {
        std::path::Path::new(active_path).join(exe_name)
    } else {
        std::path::Path::new(&global_config.executable_folder).join(exe_name)
    };

    if preferred.exists() {
        return preferred;
    }

    // Fallback: look for the latest installed version under <exec>/versions having the server binary
    let versions_dir = std::path::Path::new(&global_config.executable_folder).join("versions");
    let mut candidates: Vec<(std::path::PathBuf, Option<SystemTime>)> = Vec::new();
    if versions_dir.exists() {
        if let Ok(read_dir) = fs::read_dir(&versions_dir) {
            for entry in read_dir.flatten() {
                let path = entry.path();
                if path.is_dir() {
                    let server_path = path.join(exe_name);
                    if server_path.exists() {
                        let created = entry
                            .metadata()
                            .ok()
                            .and_then(|m| m.created().ok());
                        candidates.push((path.clone(), created));
                    }
                }
            }
        }
    }

    // Sort by created time desc, fall back to lexicographic name if no created
    candidates.sort_by(|a, b| match (a.1, b.1) {
        (Some(ta), Some(tb)) => tb.cmp(&ta),
        (Some(_), None) => std::cmp::Ordering::Less,
        (None, Some(_)) => std::cmp::Ordering::Greater,
        (None, None) => b.0.cmp(&a.0),
    });

    if let Some((chosen_dir, _)) = candidates.first() {
        // Update config to set this as active
        {
            let mut cfg = state.config.lock().await;
            let path_str = chosen_dir.to_string_lossy().to_string();
            let version_name = chosen_dir
                .file_name()
                .and_then(|s| s.to_str())
                .unwrap_or("")
                .to_string();
            cfg.active_executable_folder = Some(path_str);
            cfg.active_executable_version = Some(version_name);
        }
        if let Err(e) = save_settings(state).await {
            eprintln!("Warning: failed to save settings after fallback activation: {}", e);
        }
        return chosen_dir.join(exe_name);
    }

    preferred
}

// Simple wrapper for child process that ensures cleanup
// The key insight: keep Child directly accessible for kill_on_drop to work properly
#[derive(Debug)]
pub struct ProcessHandle {
    child: Option<Child>,
    process_id: String,
}

impl ProcessHandle {
    fn new(child: Child, process_id: String) -> Self {
        Self {
            child: Some(child),
            process_id,
        }
    }
    
    pub fn take_child(&mut self) -> Option<Child> {
        self.child.take()
    }
    
    pub fn get_child_mut(&mut self) -> Option<&mut Child> {
        self.child.as_mut()
    }
    
    pub fn get_child_id(&self) -> Option<u32> {
        self.child.as_ref().and_then(|c| c.id())
    }
}

// This ensures that if the ProcessHandle is dropped without explicit cleanup,
// the child process will still be terminated due to kill_on_drop(true)
impl Drop for ProcessHandle {
    fn drop(&mut self) {
        if let Some(child) = self.child.take() {
            println!("ProcessHandle dropping for {}, child will be killed by kill_on_drop", self.process_id);
            // Don't try to create async runtime in Drop - just drop the child
            // The kill_on_drop(true) setting should handle the termination
            drop(child);
        }
    }
}

pub async fn launch_model_server(
    model_path: String,
    state: &AppState,
) -> Result<LaunchResult, Box<dyn std::error::Error>> {
    let (global_config, model_config) = {
        let config = state.config.lock().await;
        let model_configs = state.model_configs.lock().await;
        let model_config = model_configs.get(&model_path)
            .cloned()
            .unwrap_or_else(|| ModelConfig::new(model_path.clone()));
        (config.clone(), model_config)
    };
    
    // Resolve server path with fallback to latest installed version if needed
    let executable_path = resolve_llama_server_path_with_fallback(state, &global_config).await;
    
    if !executable_path.exists() {
        return Err(format!("Server executable not found at: {:?}", executable_path).into());
    }
    
    let requested_port = parse_port_from_args(&model_config.custom_args, model_config.server_port);
    let actual_port = find_available_port(requested_port);
    
    // If we had to change the port, update the model config for this session
    let final_port = if actual_port != requested_port {
        println!("Port {} was in use, using port {} instead", requested_port, actual_port);
        actual_port
    } else {
        requested_port
    };
    
    // Build command with custom args if any
    let mut cmd = TokioCommand::new(&executable_path);
    cmd.args(["-m", &model_config.model_path])
       .args(["--host", &model_config.server_host])
       .args(["--port", &final_port.to_string()])
       .stdout(Stdio::piped())
       .stderr(Stdio::piped())
       .kill_on_drop(true); // Ensure child process is killed when dropped

    // Hide console window on Windows release builds
    #[cfg(all(windows, not(debug_assertions)))]
    cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
    
    // Add custom arguments if present
    if !model_config.custom_args.trim().is_empty() {
        let custom_args = parse_custom_args(&model_config.custom_args);
        cmd.args(custom_args);
    }
    
    let mut child = cmd.spawn()?;
    let process_id = Uuid::new_v4().to_string();
    
    // Get stdout and stderr for output capture
    let stdout = child.stdout.take().ok_or("Failed to get stdout")?;
    let stderr = child.stderr.take().ok_or("Failed to get stderr")?;
    
    let model_name = std::path::Path::new(&model_config.model_path)
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("unknown")
        .to_string();
    
    let process_info = ProcessInfo {
        id: process_id.clone(),
        model_path: model_config.model_path.clone(),
        model_name: model_name.clone(),
        host: model_config.server_host.clone(),
        port: final_port,
        command: vec![executable_path.to_string_lossy().to_string()],
        status: ProcessStatus::Starting,
        output: Vec::new(),
        created_at: Utc::now(),
        last_sent_line: Some(0),
    };
    
    // Store the process info and child
    {
        let mut processes = state.running_processes.lock().await;
        processes.insert(process_id.clone(), process_info);
    }
    
    // Store the child process using simplified wrapper
    let process_handle = Arc::new(Mutex::new(ProcessHandle::new(child, process_id.clone())));
    {
        let mut child_processes = state.child_processes.lock().await;
        child_processes.insert(process_id.clone(), process_handle.clone());
    }
    
    // Spawn task to handle output capture
    let state_clone = state.clone();
    let process_id_clone = process_id.clone();
    let handle_clone = process_handle.clone();
    
    tokio::spawn(async move {
        handle_process_output(state_clone, process_id_clone, handle_clone, stdout, stderr).await;
    });
    
    Ok(LaunchResult {
        success: true,
        process_id,
        server_host: model_config.server_host,
        server_port: final_port,
        model_name,
        message: "Model server launched successfully".to_string(),
    })
}

pub async fn launch_model_external(
    model_path: String,
    state: &AppState,
) -> Result<LaunchResult, Box<dyn std::error::Error>> {
    let (global_config, model_config) = {
        let config = state.config.lock().await;
        let model_configs = state.model_configs.lock().await;
        let model_config = model_configs.get(&model_path)
            .cloned()
            .unwrap_or_else(|| ModelConfig::new(model_path.clone()));
        (config.clone(), model_config)
    };
    
    // Resolve server path with fallback to latest installed version if needed
    let executable_path = resolve_llama_server_path_with_fallback(state, &global_config).await;
    
    if !executable_path.exists() {
        return Err(format!("Server executable not found at: {:?}", executable_path).into());
    }
    
    let requested_port = parse_port_from_args(&model_config.custom_args, model_config.server_port);
    let actual_port = find_available_port(requested_port);
    
    // If we had to change the port, update the model config for this session
    let final_port = if actual_port != requested_port {
        println!("Port {} was in use, using port {} instead", requested_port, actual_port);
        actual_port
    } else {
        requested_port
    };
    
    // For external launch, spawn in a new terminal window
    let mut cmd_args = vec![
        "-m".to_string(),
        model_config.model_path.clone(),
        "--host".to_string(),
        model_config.server_host.clone(),
        "--port".to_string(),
        final_port.to_string(),
    ];
    
    // Add custom arguments if present
    if !model_config.custom_args.trim().is_empty() {
        let custom_args = parse_custom_args(&model_config.custom_args);
        cmd_args.extend(custom_args);
    }
    
    // Launch in external terminal
    #[cfg(windows)]
    {
        let mut cmd = TokioCommand::new("cmd");
        cmd.args(["/c", "start", "cmd", "/k"])
           .arg(executable_path.to_string_lossy().to_string())
           .args(&cmd_args);
        cmd.spawn()?;
    }
    
    #[cfg(not(windows))]
    {
        let mut cmd = TokioCommand::new("x-terminal-emulator");
        cmd.args(["-e"])
           .arg(executable_path.to_string_lossy().to_string())
           .args(&cmd_args);
        
        // Fallback to other terminal emulators if x-terminal-emulator fails
        if cmd.spawn().is_err() {
            let mut cmd = TokioCommand::new("gnome-terminal");
            cmd.args(["--"])
               .arg(executable_path.to_string_lossy().to_string())
               .args(&cmd_args);
            
            if cmd.spawn().is_err() {
                let mut cmd = TokioCommand::new("xterm");
                cmd.args(["-e"])
                   .arg(executable_path.to_string_lossy().to_string())
                   .args(&cmd_args);
                cmd.spawn()?;
            }
        }
    }
    
    let model_name = std::path::Path::new(&model_config.model_path)
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("unknown")
        .to_string();
    
    Ok(LaunchResult {
        success: true,
        process_id: "external".to_string(),
        server_host: model_config.server_host,
        server_port: final_port,
        model_name,
        message: "Model launched in external terminal".to_string(),
    })
}

async fn handle_process_output(
    state: AppState,
    process_id: String,
    process_handle: Arc<Mutex<ProcessHandle>>,
    stdout: tokio::process::ChildStdout,
    stderr: tokio::process::ChildStderr,
) {
    let stdout_reader = BufReader::new(stdout);
    let stderr_reader = BufReader::new(stderr);
    
    let mut stdout_lines = stdout_reader.lines();
    let mut stderr_lines = stderr_reader.lines();
    
    // Update status to running
    {
        let mut processes = state.running_processes.lock().await;
        if let Some(process_info) = processes.get_mut(&process_id) {
            process_info.status = ProcessStatus::Running;
        }
    }
    
    loop {
        tokio::select! {
            line = stdout_lines.next_line() => {
                match line {
                    Ok(Some(line)) => {
                        let formatted_line = format!("[OUT] {}", line);
                        add_output_line(&state, &process_id, formatted_line).await;
                    },
                    Ok(None) => break, // EOF
                    Err(e) => {
                        eprintln!("Error reading stdout: {}", e);
                        break;
                    }
                }
            },
            line = stderr_lines.next_line() => {
                match line {
                    Ok(Some(line)) => {
                        let formatted_line = format!("[INFO] {}", line);
                        add_output_line(&state, &process_id, formatted_line).await;
                    },
                    Ok(None) => break, // EOF
                    Err(e) => {
                        eprintln!("Error reading stderr: {}", e);
                        break;
                    }
                }
            }
        }
    }
    
    // Wait for process to finish and get exit code
    let exit_code = {
        let mut handle_guard = process_handle.lock().await;
        if let Some(mut child_process) = handle_guard.take_child() {
            match child_process.wait().await {
                Ok(status) => status.code().unwrap_or(-1),
                Err(_) => -1,
            }
        } else {
            -1
        }
    };
    
    // Update process status to stopped and clean up child process tracking
    {
        let mut processes = state.running_processes.lock().await;
        if let Some(process_info) = processes.get_mut(&process_id) {
            process_info.status = ProcessStatus::Stopped;
            let exit_msg = format!("Process exited with code: {}", exit_code);
            process_info.output.push(exit_msg);
        }
    }
    
    // Remove from child process tracking since it has exited
    {
        let mut child_processes = state.child_processes.lock().await;
        child_processes.remove(&process_id);
        println!("Process {} exited naturally, removed from tracking", process_id);
    }
}

async fn add_output_line(state: &AppState, process_id: &str, line: String) {
    let mut processes = state.running_processes.lock().await;
    if let Some(process_info) = processes.get_mut(process_id) {
        process_info.output.push(line);
        // Keep only last 1000 lines to prevent memory issues
        if process_info.output.len() > 1000 {
            process_info.output.drain(0..process_info.output.len() - 1000);
        }
    }
}

pub async fn terminate_process(
    process_id: String,
    state: &AppState,
) -> Result<(), Box<dyn std::error::Error>> {
    println!("Terminating process: {}", process_id);
    
    // Kill the child process first
    {
        let mut child_processes = state.child_processes.lock().await;
        if let Some(handle_arc) = child_processes.remove(&process_id) {
            let mut handle_guard = handle_arc.lock().await;
            if let Some(mut child) = handle_guard.take_child() {
                match child.kill().await {
                    Ok(_) => println!("Successfully killed process: {}", process_id),
                    Err(e) => eprintln!("Failed to kill process {}: {}", process_id, e),
                }
            }
        }
    }
    
    // Update process status and remove from tracking
    {
        let mut processes = state.running_processes.lock().await;
        if let Some(process_info) = processes.get_mut(&process_id) {
            process_info.status = ProcessStatus::Stopped;
        }
        processes.remove(&process_id);
    }
    
    Ok(())
}

pub async fn get_process_logs(
    process_id: String,
    state: &AppState,
) -> Result<ProcessOutput, Box<dyn std::error::Error>> {
    let mut processes = state.running_processes.lock().await;
    
    if let Some(process_info) = processes.get_mut(&process_id) {
        // Get new output since last check
        let total_lines = process_info.output.len();
        let last_sent = process_info.last_sent_line.unwrap_or(0);
        
        let new_output = if last_sent < total_lines {
            let new_lines = process_info.output[last_sent..].to_vec();
            // Update the last sent line index
            process_info.last_sent_line = Some(total_lines);
            new_lines
        } else {
            Vec::new()
        };
        
        Ok(ProcessOutput {
            output: new_output,
            is_running: matches!(process_info.status, ProcessStatus::Running | ProcessStatus::Starting),
            return_code: None,
        })
    } else {
        Err("Process not found".into())
    }
}

fn parse_port_from_args(custom_args: &str, default_port: u16) -> u16 {
    if let Some(port_pos) = custom_args.find("--port") {
        let after_port = &custom_args[port_pos + 6..];
        // Handle both --port=1234 and --port 1234 formats
        let port_str = if after_port.starts_with('=') {
            // Format: --port=1234
            let after_equals = &after_port[1..];
            if let Some(space_pos) = after_equals.find(' ') {
                &after_equals[..space_pos]
            } else {
                after_equals
            }
        } else {
            // Format: --port 1234
            let trimmed = after_port.trim_start();
            if let Some(space_pos) = trimmed.find(' ') {
                &trimmed[..space_pos]
            } else {
                trimmed
            }
        };
        
        if let Ok(port) = port_str.parse::<u16>() {
            return port;
        }
    }
    default_port
}

fn is_port_available(port: u16) -> bool {
    if let Ok(listener) = std::net::TcpListener::bind(format!("127.0.0.1:{}", port)) {
        // Port is available, close the listener
        drop(listener);
        true
    } else {
        // Port is in use
        false
    }
}

fn find_available_port(start_port: u16) -> u16 {
    let mut port = start_port;
    while !is_port_available(port) {
        port += 1;
        // Prevent infinite loop by setting a reasonable upper limit
        if port-start_port > 10 {
            // Only search for next 10 ports
            return start_port;
        }
    }
    port
}

fn parse_custom_args(custom_args: &str) -> Vec<String> {
    let mut args = Vec::new();
    let mut current_arg = String::new();
    let mut in_quotes = false;
    let mut chars = custom_args.chars().peekable();
    
    while let Some(ch) = chars.next() {
        match ch {
            '"' | '\'' if !in_quotes => {
                in_quotes = true;
            },
            '"' | '\'' if in_quotes => {
                in_quotes = false;
            },
            ' ' if !in_quotes => {
                if !current_arg.is_empty() {
                    args.push(current_arg.clone());
                    current_arg.clear();
                }
            },
            _ => {
                current_arg.push(ch);
            }
        }
    }
    
    if !current_arg.is_empty() {
        args.push(current_arg);
    }
    
    args
}