use crate::config::{ConfigState, ScreensaverConfig, save_config_to_disk};
use crate::images::scan_images;
use serde::Serialize;
use std::path::Path;
use tauri::{AppHandle, State};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PreviewImagesResult {
    all_images: Vec<String>,
    total_count: usize,
}

#[tauri::command]
pub fn get_config(state: State<ConfigState>) -> ScreensaverConfig {
    let config = state.0.lock().unwrap();
    config.clone()
}

#[tauri::command]
pub fn get_images(state: State<ConfigState>) -> Vec<String> {
    let config = state.0.lock().unwrap();
    let directory = &config.image_folder;
    let include_subdirs = config.include_subdirectories;
    if directory.is_empty() {
        return Vec::new();
    }
    let (images, _) = scan_images(directory, include_subdirs);
    images
}

#[tauri::command]
pub fn validate_directory(directory: String) -> bool {
    Path::new(&directory).is_dir()
}

#[tauri::command]
pub fn get_preview_images(directory: String) -> PreviewImagesResult {
    if directory.is_empty() {
        return PreviewImagesResult {
            all_images: Vec::new(),
            total_count: 0,
        };
    }
    // For preview, always scan top-level only (fast)
    let (images, count) = scan_images(&directory, false);
    PreviewImagesResult {
        all_images: images,
        total_count: count,
    }
}

#[tauri::command]
pub fn apply_config(state: State<ConfigState>, new_config: ScreensaverConfig) -> Result<bool, String> {
    let mut config = state.0.lock().unwrap();
    *config = new_config;
    Ok(true)
}

#[tauri::command]
pub fn save_config(state: State<ConfigState>, new_config: ScreensaverConfig) -> Result<bool, String> {
    let mut config = state.0.lock().unwrap();
    *config = new_config.clone();
    save_config_to_disk(&new_config)?;
    Ok(true)
}

#[tauri::command]
pub fn get_log_path() -> String {
    let log_dir = dirs::home_dir()
        .unwrap_or_default()
        .join(".image-tile-screensaver")
        .join("logs");
    log_dir
        .join("screensaver.log")
        .to_string_lossy()
        .to_string()
}

#[tauri::command]
pub fn exit_screensaver(app: AppHandle) {
    app.exit(0);
}
