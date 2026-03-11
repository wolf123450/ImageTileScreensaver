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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn default_config_has_expected_values() {
        let config = ScreensaverConfig::default();
        assert_eq!(config.image_folder, "");
        assert!(config.include_subdirectories);
        assert_eq!(config.change_interval, 10000);
        assert_eq!(config.pattern, "simple");
        assert!(!config.multi_monitor_sync);
        assert_eq!(config.transition.effect, "fade");
        assert_eq!(config.transition.duration, 1000);
        assert_eq!(config.theme, "light");
    }

    #[test]
    fn config_roundtrip_json() {
        let config = ScreensaverConfig {
            image_folder: "C:\\Photos".to_string(),
            include_subdirectories: false,
            change_interval: 5000,
            pattern: "grid".to_string(),
            multi_monitor_sync: true,
            transition: TransitionConfig {
                effect: "slide".to_string(),
                duration: 500,
            },
            theme: "dark".to_string(),
        };

        let json = serde_json::to_string(&config).unwrap();
        let deserialized: ScreensaverConfig = serde_json::from_str(&json).unwrap();

        assert_eq!(deserialized.image_folder, "C:\\Photos");
        assert!(!deserialized.include_subdirectories);
        assert_eq!(deserialized.change_interval, 5000);
        assert_eq!(deserialized.pattern, "grid");
        assert!(deserialized.multi_monitor_sync);
        assert_eq!(deserialized.transition.effect, "slide");
        assert_eq!(deserialized.theme, "dark");
    }

    #[test]
    fn config_uses_camel_case_json_keys() {
        let config = ScreensaverConfig::default();
        let json = serde_json::to_string(&config).unwrap();

        assert!(json.contains("\"imageFolder\""));
        assert!(json.contains("\"changeInterval\""));
        assert!(json.contains("\"includeSubdirectories\""));
        assert!(json.contains("\"multiMonitorSync\""));
        assert!(!json.contains("\"image_folder\""));
    }

    #[test]
    fn save_and_load_config_from_temp_file() {
        let dir = std::env::temp_dir().join("screensaver_test_config");
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        let config_path = dir.join("config.json");

        let config = ScreensaverConfig {
            image_folder: "/tmp/images".to_string(),
            ..ScreensaverConfig::default()
        };

        let data = serde_json::to_string_pretty(&config).unwrap();
        fs::write(&config_path, &data).unwrap();

        let loaded: ScreensaverConfig =
            serde_json::from_str(&fs::read_to_string(&config_path).unwrap()).unwrap();
        assert_eq!(loaded.image_folder, "/tmp/images");

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn partial_json_uses_defaults_via_serde_default() {
        // If the JSON is missing fields, serde should error (not use defaults)
        // since we don't have #[serde(default)] on the struct.
        let partial = r#"{"imageFolder": "test"}"#;
        let result = serde_json::from_str::<ScreensaverConfig>(partial);
        assert!(result.is_err(), "Partial JSON should fail without #[serde(default)]");
    }
}
