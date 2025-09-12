use std::path::PathBuf;
use std::collections::HashMap;
use serde_json;
use tokio::fs;
use crate::models::*;
use crate::AppState;

const SETTINGS_FILE: &str = "launcher_settings.json";

pub async fn get_settings_path() -> Result<PathBuf, Box<dyn std::error::Error>> {
    let mut path = dirs::home_dir()
        .ok_or("Could not find home directory")?;
    path.push(".llama-os");
    
    // Create directory if it doesn't exist
    fs::create_dir_all(&path).await?;
    path.push(SETTINGS_FILE);
    
    Ok(path)
}

#[derive(serde::Serialize, serde::Deserialize)]
struct SettingsFile {
    global_config: GlobalConfig,
    model_configs: HashMap<String, ModelConfig>,
}

pub async fn load_settings(state: &AppState) -> Result<(), Box<dyn std::error::Error>> {
    let settings_path = get_settings_path().await?;
    
    if !settings_path.exists() {
        tracing::info!("Settings file does not exist, using defaults");
        return Ok(());
    }
    
    let contents = fs::read_to_string(&settings_path).await?;
    let settings: SettingsFile = serde_json::from_str(&contents)?;
    
    // Update global config
    {
        let mut config = state.config.lock().await;
        *config = settings.global_config;
    }
    
    // Update model configs
    {
        let mut model_configs = state.model_configs.lock().await;
        *model_configs = settings.model_configs;
    }
    
    tracing::info!("Settings loaded successfully from {:?}", settings_path);
    Ok(())
}

pub async fn save_settings(state: &AppState) -> Result<(), Box<dyn std::error::Error>> {
    let settings_path = get_settings_path().await?;
    
    let global_config = {
        let config = state.config.lock().await;
        config.clone()
    };
    
    let model_configs = {
        let configs = state.model_configs.lock().await;
        configs.clone()
    };
    
    let settings = SettingsFile {
        global_config,
        model_configs,
    };
    
    let contents = serde_json::to_string_pretty(&settings)?;
    fs::write(&settings_path, contents).await?;
    
    tracing::info!("Settings saved successfully to {:?}", settings_path);
    Ok(())
}