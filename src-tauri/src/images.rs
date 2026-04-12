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

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::sync::atomic::{AtomicU32, Ordering};

    static COUNTER: AtomicU32 = AtomicU32::new(0);

    fn create_test_dir() -> std::path::PathBuf {
        let id = COUNTER.fetch_add(1, Ordering::SeqCst);
        let dir = std::env::temp_dir().join(format!("screensaver_test_images_{}", id));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn scan_empty_directory() {
        let dir = create_test_dir();
        let (images, count) = scan_images(dir.to_str().unwrap(), false);
        assert_eq!(count, 0);
        assert!(images.is_empty());
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn scan_nonexistent_directory() {
        let (images, count) = scan_images("/nonexistent/path/xyz", false);
        assert_eq!(count, 0);
        assert!(images.is_empty());
    }

    #[test]
    fn scan_finds_image_files() {
        let dir = create_test_dir();
        fs::write(dir.join("photo.jpg"), b"fake").unwrap();
        fs::write(dir.join("image.png"), b"fake").unwrap();
        fs::write(dir.join("pic.webp"), b"fake").unwrap();
        fs::write(dir.join("readme.txt"), b"text").unwrap();

        let (images, count) = scan_images(dir.to_str().unwrap(), false);
        assert_eq!(count, 3);
        assert!(images.iter().any(|p| p.ends_with("photo.jpg")));
        assert!(images.iter().any(|p| p.ends_with("image.png")));
        assert!(images.iter().any(|p| p.ends_with("pic.webp")));
        assert!(!images.iter().any(|p| p.ends_with("readme.txt")));

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn scan_case_insensitive_extensions() {
        let dir = create_test_dir();
        fs::write(dir.join("photo.JPG"), b"fake").unwrap();
        fs::write(dir.join("image.Png"), b"fake").unwrap();

        let (images, count) = scan_images(dir.to_str().unwrap(), false);
        assert_eq!(count, 2);

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn scan_with_subdirectories() {
        let dir = create_test_dir();
        let sub = dir.join("subdir");
        fs::create_dir_all(&sub).unwrap();
        fs::write(dir.join("top.jpg"), b"fake").unwrap();
        fs::write(sub.join("nested.png"), b"fake").unwrap();

        // Without subdirectories
        let (images, count) = scan_images(dir.to_str().unwrap(), false);
        assert_eq!(count, 1);
        assert!(images.iter().any(|p| p.ends_with("top.jpg")));

        // With subdirectories
        let (images, count) = scan_images(dir.to_str().unwrap(), true);
        assert_eq!(count, 2);
        assert!(images.iter().any(|p| p.ends_with("nested.png")));

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn scan_all_supported_extensions() {
        let dir = create_test_dir();
        for ext in IMAGE_EXTENSIONS {
            fs::write(dir.join(format!("file.{}", ext)), b"fake").unwrap();
        }

        let (_, count) = scan_images(dir.to_str().unwrap(), false);
        assert_eq!(count, IMAGE_EXTENSIONS.len());

        let _ = fs::remove_dir_all(&dir);
    }
}
