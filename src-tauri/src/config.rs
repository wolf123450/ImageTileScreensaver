use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;

pub const CURRENT_CONFIG_VERSION: u32 = 2;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TransitionConfig {
    pub effect: String,
    pub duration: u64,
}

impl Default for TransitionConfig {
    fn default() -> Self {
        Self {
            effect: "fade".to_string(),
            duration: 1000,
        }
    }
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PatternOptions {
    pub rows: Option<u32>,
    pub cols: Option<u32>,
    pub density: Option<u32>,
    pub random_count: Option<u32>,
    pub allow_overlap: Option<bool>,
    pub slide_speed: Option<u32>,
    // Mosaic placement engine options
    pub placement_speed: Option<u32>,
    pub tile_area_percent: Option<u32>,
    pub tile_margin: Option<u32>,
    pub priority_function: Option<String>,
    pub direction_angle: Option<u32>,
    pub start_position: Option<String>,
    pub max_tiles: Option<u32>,
    pub hold_duration: Option<u32>,
    pub zoom_enabled: Option<bool>,
    pub max_zoom_out: Option<f64>,
    pub buffer_size: Option<u32>,
    pub reference_image: Option<String>,
    pub reference_image_dir: Option<String>,
    pub color_distance_fn: Option<String>,
    pub color_source: Option<String>,
    pub reference_tile_count: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
#[serde(rename_all = "camelCase")]
pub struct ScreensaverConfig {
    pub version: u32,
    pub image_folder: String,
    pub include_subdirectories: bool,
    pub change_interval: u64,
    pub pattern: String,
    pub pattern_options: PatternOptions,
    pub multi_monitor_sync: bool,
    pub transition: TransitionConfig,
    pub theme: String,
    pub image_fit_style: String,
}

impl Default for ScreensaverConfig {
    fn default() -> Self {
        Self {
            version: CURRENT_CONFIG_VERSION,
            image_folder: String::new(),
            include_subdirectories: true,
            change_interval: 10000,
            pattern: "simple".to_string(),
            pattern_options: PatternOptions::default(),
            multi_monitor_sync: false,
            transition: TransitionConfig::default(),
            theme: "light".to_string(),
            image_fit_style: "cover".to_string(),
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
                Ok(mut config) => {
                    let migrated = migrate_config(&mut config);
                    if migrated {
                        if let Err(e) = save_config_to_disk(&config) {
                            log::error!("Failed to persist migrated config: {}", e);
                        }
                    }
                    return config;
                }
                Err(e) => log::error!("Failed to parse config file: {}", e),
            },
            Err(e) => log::error!("Failed to read config file: {}", e),
        }
    }

    ScreensaverConfig::default()
}

fn migrate_config(config: &mut ScreensaverConfig) -> bool {
    let mut changed = false;

    if config.version == 0 {
        config.version = 1;
        changed = true;
    }

    if config.version < CURRENT_CONFIG_VERSION {
        if config.image_fit_style.is_empty() {
            config.image_fit_style = "cover".to_string();
        }

        if config.transition.effect.is_empty() {
            config.transition.effect = "fade".to_string();
        }

        config.version = CURRENT_CONFIG_VERSION;
        changed = true;
        log::info!(
            "Migrated config to schema version {}",
            CURRENT_CONFIG_VERSION
        );
    }

    changed
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
        assert_eq!(config.version, CURRENT_CONFIG_VERSION);
        assert_eq!(config.image_folder, "");
        assert!(config.include_subdirectories);
        assert_eq!(config.change_interval, 10000);
        assert_eq!(config.pattern, "simple");
        assert!(!config.multi_monitor_sync);
        assert_eq!(config.transition.effect, "fade");
        assert_eq!(config.transition.duration, 1000);
        assert_eq!(config.theme, "light");
        assert_eq!(config.image_fit_style, "cover");
    }

    #[test]
    fn config_roundtrip_json() {
        let config = ScreensaverConfig {
            version: CURRENT_CONFIG_VERSION,
            image_folder: "C:\\Photos".to_string(),
            include_subdirectories: false,
            change_interval: 5000,
            pattern: "grid".to_string(),
            pattern_options: PatternOptions {
                rows: Some(3),
                cols: Some(4),
                density: None,
                random_count: None,
                allow_overlap: None,
                slide_speed: None,
                placement_speed: None,
                tile_area_percent: None,
                tile_margin: None,
                priority_function: None,
                direction_angle: None,
                start_position: None,
                max_tiles: None,
                hold_duration: None,
                zoom_enabled: None,
                max_zoom_out: None,
                buffer_size: None,
                reference_image: None,
                reference_image_dir: None,
                color_distance_fn: None,
                color_source: None,
                reference_tile_count: None,
            },
            multi_monitor_sync: true,
            transition: TransitionConfig {
                effect: "slide".to_string(),
                duration: 500,
            },
            theme: "dark".to_string(),
            image_fit_style: "contain".to_string(),
        };

        let json = serde_json::to_string(&config).unwrap();
        let deserialized: ScreensaverConfig = serde_json::from_str(&json).unwrap();

        assert_eq!(deserialized.image_folder, "C:\\Photos");
        assert_eq!(deserialized.version, CURRENT_CONFIG_VERSION);
        assert!(!deserialized.include_subdirectories);
        assert_eq!(deserialized.change_interval, 5000);
        assert_eq!(deserialized.pattern, "grid");
        assert_eq!(deserialized.pattern_options.rows, Some(3));
        assert!(deserialized.multi_monitor_sync);
        assert_eq!(deserialized.transition.effect, "slide");
        assert_eq!(deserialized.theme, "dark");
        assert_eq!(deserialized.image_fit_style, "contain");
    }

    #[test]
    fn config_uses_camel_case_json_keys() {
        let config = ScreensaverConfig::default();
        let json = serde_json::to_string(&config).unwrap();

        assert!(json.contains("\"imageFolder\""));
        assert!(json.contains("\"changeInterval\""));
        assert!(json.contains("\"includeSubdirectories\""));
        assert!(json.contains("\"multiMonitorSync\""));
        assert!(json.contains("\"imageFitStyle\""));
        assert!(json.contains("\"version\""));
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
        let partial = r#"{"imageFolder": "test"}"#;
        let result = serde_json::from_str::<ScreensaverConfig>(partial).unwrap();

        assert_eq!(result.image_folder, "test");
        assert_eq!(result.version, CURRENT_CONFIG_VERSION);
        assert_eq!(result.pattern, "simple");
        assert_eq!(result.image_fit_style, "cover");
    }

    #[test]
    fn migrate_v1_config_sets_current_version() {
        let mut old_config = ScreensaverConfig {
            version: 1,
            image_folder: "C:\\Photos".to_string(),
            include_subdirectories: true,
            change_interval: 10000,
            pattern: "simple".to_string(),
            pattern_options: PatternOptions::default(),
            multi_monitor_sync: false,
            transition: TransitionConfig::default(),
            theme: "light".to_string(),
            image_fit_style: String::new(),
        };

        let changed = super::migrate_config(&mut old_config);
        assert!(changed);
        assert_eq!(old_config.version, CURRENT_CONFIG_VERSION);
        assert_eq!(old_config.image_fit_style, "cover");
    }
}
