use std::collections::HashMap;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GlobalConfig {
    pub models_directory: String,
    pub executable_folder: String,
    #[serde(default)]
    pub active_executable_folder: Option<String>,
    #[serde(default)]
    pub active_executable_version: Option<String>,
    pub theme_color: String,
}

impl Default for GlobalConfig {
    fn default() -> Self {
        let base_dir = dirs::home_dir().unwrap_or_default().join(".llama-os");
        Self {
            models_directory: base_dir.join("models").to_str().unwrap_or_default().to_string(),
            executable_folder: base_dir.join("llama.cpp").to_str().unwrap_or_default().to_string(),
            active_executable_folder: None,
            active_executable_version: None,
            theme_color: "dark-gray".to_string(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelConfig {
    pub custom_args: String,
    pub server_host: String,
    pub server_port: u16,
    pub model_path: String,
}

impl ModelConfig {
    pub fn new(model_path: String) -> Self {
        Self {
            custom_args: String::new(),
            server_host: "127.0.0.1".to_string(),
            server_port: 8080,
            model_path,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelInfo {
    pub path: String,
    pub name: String,
    pub size_gb: f64,
    pub architecture: String,
    pub model_name: String,
    pub quantization: String,
    pub date: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GgufMetadata {
    pub architecture: String,
    pub name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProcessInfo {
    pub id: String,
    pub model_path: String,
    pub model_name: String,
    pub host: String,
    pub port: u16,
    pub command: Vec<String>,
    pub status: ProcessStatus,
    pub output: Vec<String>,
    pub created_at: DateTime<Utc>,
    pub last_sent_line: Option<usize>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ProcessStatus {
    Starting,
    Running,
    Stopped,
    Failed,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LaunchResult {
    pub success: bool,
    pub process_id: String,
    pub server_host: String,
    pub server_port: u16,
    pub model_name: String,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProcessOutput {
    pub output: Vec<String>,
    pub is_running: bool,
    pub return_code: Option<i32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionState {
    pub windows: HashMap<String, WindowState>,
    pub terminals: HashMap<String, TerminalState>,
    pub chats: HashMap<String, ChatState>,
    pub desktop_state: DesktopState,
}

impl Default for SessionState {
    fn default() -> Self {
        Self {
            windows: HashMap::new(),
            terminals: HashMap::new(),
            chats: HashMap::new(),
            desktop_state: DesktopState::default(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WindowState {
    pub window_type: String,
    pub title: String,
    pub content: String,
    pub position: Position,
    pub size: Size,
    pub visible: bool,
    pub z_index: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Position {
    pub x: i32,
    pub y: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Size {
    pub width: u32,
    pub height: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TerminalState {
    pub process_id: String,
    pub model_name: String,
    pub model_path: String,
    pub host: String,
    pub port: u16,
    pub status: String,
    pub output: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatState {
    pub model_name: String,
    pub host: String,
    pub port: u16,
    pub messages: Vec<ChatMessage>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
    pub timestamp: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DesktopState {
    pub icon_positions: HashMap<String, Position>,
    pub sort_type: Option<String>,
    pub sort_direction: String,
    pub theme: String,
}

impl Default for DesktopState {
    fn default() -> Self {
        Self {
            icon_positions: HashMap::new(),
            sort_type: None,
            sort_direction: "asc".to_string(),
            theme: "navy".to_string(),
        }
    }
}

// Hugging Face related structures
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchResult {
    pub success: bool,
    pub models: Vec<ModelBasic>,
    pub total: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelBasic {
    pub id: String,
    pub name: String,
    pub author: String,
    pub downloads: u64,
    pub likes: u64,
    #[serde(rename = "lastModified")]
    pub last_modified: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelDetails {
    pub id: String,
    pub name: String,
    pub author: String,
    pub description: Option<String>,
    pub downloads: u64,
    pub likes: u64,
    pub total_files: u32,
    pub gguf_files: HashMap<String, GgufFileInfo>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GgufFileInfo {
    pub filename: String,
    pub size: u64,
    pub quantization_type: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QuantizationInfo {
    pub files: Vec<String>,
    pub size: u64,
    pub primary_file: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DownloadStartResult {
    pub download_id: String,
    pub message: String,
}