use serde::{Deserialize, Serialize};
use std::time::SystemTime;
use sysinfo::{System};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SystemStats {
    pub cpu_usage: f32,
    pub memory_total_gb: f32,
    pub memory_used_gb: f32,
    pub gpu_name: String,
    pub gpu_usage: f32,
    pub gpu_memory_total_gb: f32,
    pub gpu_memory_used_gb: f32,
    pub timestamp: u64,
}

#[tauri::command]
pub async fn get_system_stats() -> Result<SystemStats, String> {
    let mut sys = System::new_all();
    sys.refresh_all();
    
    // CPU usage (average of all cores)
    let cpu_usage = sys.global_cpu_usage();
    
    // Memory information in GB
    let memory_total_gb = sys.total_memory() as f32 / (1024.0 * 1024.0 * 1024.0);
    let memory_used_gb = sys.used_memory() as f32 / (1024.0 * 1024.0 * 1024.0);
    
    // GPU information
    let (gpu_name, gpu_usage, gpu_memory_total_gb, gpu_memory_used_gb) = get_gpu_info();
    
    let timestamp = SystemTime::now()
        .duration_since(SystemTime::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    
    Ok(SystemStats {
        cpu_usage,
        memory_total_gb,
        memory_used_gb,
        gpu_name,
        gpu_usage,
        gpu_memory_total_gb,
        gpu_memory_used_gb,
        timestamp,
    })
}

fn get_gpu_info() -> (String, f32, f32, f32) {
    // Try to get NVIDIA GPU info
    match nvml_wrapper::Nvml::init() {
        Ok(nvml) => {
            match nvml.device_count() {
                Ok(count) if count > 0 => {
                    match nvml.device_by_index(0) {
                        Ok(device) => {
                            let name = device.name().unwrap_or_else(|_| "NVIDIA GPU".to_string());
                            
                            // Get GPU utilization
                            let gpu_usage = match device.utilization_rates() {
                                Ok(util) => util.gpu as f32,
                                Err(_) => 0.0,
                            };
                            
                            // Get GPU memory info
                            let (gpu_memory_total_gb, gpu_memory_used_gb) = match device.memory_info() {
                                Ok(mem_info) => {
                                    let total = mem_info.total as f32 / (1024.0 * 1024.0 * 1024.0);
                                    let used = mem_info.used as f32 / (1024.0 * 1024.0 * 1024.0);
                                    (total, used)
                                },
                                Err(_) => (0.0, 0.0),
                            };
                            
                            (name, gpu_usage, gpu_memory_total_gb, gpu_memory_used_gb)
                        },
                        Err(_) => ("NVIDIA GPU (info unavailable)".to_string(), 0.0, 0.0, 0.0)
                    }
                },
                _ => ("No NVIDIA GPU detected".to_string(), 0.0, 0.0, 0.0)
            }
        },
        Err(_) => {
            // Fallback for non-NVIDIA GPUs or when NVML is not available
            ("No NVIDIA GPU detected".to_string(), 0.0, 0.0, 0.0)
        }
    }
}