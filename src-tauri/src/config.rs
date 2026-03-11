use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TransitionConfig {
    pub effect: String,
    pub duration: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScreensaverConfig {
    pub image_folder: String,
    pub include_subdirectories: bool,
    pub change_interval: u64,
    pub pattern: String,
    pub multi_monitor_sync: bool,
    pub transition: TransitionConfig,
    pub theme: String,
}

impl Default for ScreensaverConfig {
    fn default() -> Self {
        Self {
            image_folder: String::new(),
            include_subdirectories: true,
            change_interval: 10000,
            pattern: "simple".to_string(),
            multi_monitor_sync: false,
            transition: TransitionConfig {
                effect: "fade".to_string(),
                duration: 1000,
            },
            theme: "light".to_string(),
        }
    }
}

/// Thread-safe config state for Tauri managed state
pub struct ConfigState(pub Mutex<ScreensaverConfig>);

/// Get the path to the config file in the user's app data directory
pub fn get_config_file_path() -> PathBuf {
    let config_dir = dirs::config_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("ImageTileScreensaver");
    config_dir.join("config.json")
}

/// Load configuration from disk, falling back to defaults
pub fn load_config() -> ScreensaverConfig {
    let config_path = get_config_file_path();

    if config_path.exists() {
        match fs::read_to_string(&config_path) {
            Ok(data) => match serde_json::from_str::<ScreensaverConfig>(&data) {
                Ok(config) => return config,
                Err(e) => log::error!("Failed to parse config file: {}", e),
            },
            Err(e) => log::error!("Failed to read config file: {}", e),
        }
    }

    ScreensaverConfig::default()
}

/// Save configuration to disk
pub fn save_config_to_disk(config: &ScreensaverConfig) -> Result<(), String> {
    let config_path = get_config_file_path();

    if let Some(parent) = config_path.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("Failed to create config directory: {}", e))?;
    }

    let data = serde_json::to_string_pretty(config)
        .map_err(|e| format!("Failed to serialize config: {}", e))?;

    fs::write(&config_path, data)
        .map_err(|e| format!("Failed to write config file: {}", e))?;

    log::info!("Configuration saved to {:?}", config_path);
    Ok(())
}
