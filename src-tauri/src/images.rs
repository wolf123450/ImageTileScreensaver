use std::path::Path;
use walkdir::WalkDir;

const IMAGE_EXTENSIONS: &[&str] = &["jpg", "jpeg", "png", "webp", "gif", "bmp"];

/// Scan a directory for image files, optionally recursing into subdirectories.
/// Returns a list of absolute file paths and the total count.
pub fn scan_images(directory: &str, include_subdirectories: bool) -> (Vec<String>, usize) {
    let dir_path = Path::new(directory);
    if !dir_path.is_dir() {
        log::warn!("Image directory does not exist: {}", directory);
        return (Vec::new(), 0);
    }

    let walker = if include_subdirectories {
        WalkDir::new(dir_path)
    } else {
        WalkDir::new(dir_path).max_depth(1)
    };

    let images: Vec<String> = walker
        .into_iter()
        .filter_map(|entry| entry.ok())
        .filter(|entry| entry.file_type().is_file())
        .filter(|entry| {
            entry
                .path()
                .extension()
                .and_then(|ext| ext.to_str())
                .map(|ext| IMAGE_EXTENSIONS.contains(&ext.to_lowercase().as_str()))
                .unwrap_or(false)
        })
        .filter_map(|entry| entry.path().to_str().map(|s| s.to_string()))
        .collect();

    let count = images.len();
    log::info!("Found {} image files in {}", count, directory);
    (images, count)
}
