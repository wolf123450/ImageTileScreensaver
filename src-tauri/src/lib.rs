mod commands;
mod config;
mod images;

use config::{load_config, ConfigState};
use std::sync::Mutex;
use tauri::{WebviewUrl, WebviewWindowBuilder};

/// Determine the run mode from command-line arguments.
/// Returns: "screensaver", "config", or "preview"
fn parse_run_mode(args: &[String]) -> (&'static str, Option<String>) {
    log::info!("Command line arguments: {:?}", args);
    parse_run_mode_from_args(args)
}

fn parse_run_mode_from_args(args: &[String]) -> (&'static str, Option<String>) {
    for (i, arg) in args.iter().enumerate() {
        let a = arg.to_lowercase();
        if a == "/c" || a == "-c" || a.starts_with("/c:") || a.starts_with("-c:") {
            return ("config", None);
        }
        if a == "/p" || a.starts_with("/p:") {
            let hwnd = if a.contains(':') {
                a.split(':').nth(1).map(|s| s.to_string())
            } else if i + 1 < args.len() {
                Some(args[i + 1].clone())
            } else {
                None
            };
            return ("preview", hwnd);
        }
        if a == "/s" || a == "-s" || a.starts_with("/s:") || a.starts_with("-s:") {
            return ("screensaver", None);
        }
    }

    ("screensaver", None)
}

/// Options for screensaver mode that change how it's dismissed.
/// Intended for launch by an external idle-detection daemon (see
/// tools/idle-watcher/) on machines where the OS's own idle timer is
/// defeated by an activity-simulating script, so mouse input must be
/// ignored and only a keypress should dismiss the screensaver.
#[derive(Debug, PartialEq)]
struct ScreensaverOptions {
    /// Mouse movement/clicks do not dismiss the screensaver.
    ignore_mouse: bool,
    /// If set, only this key (matched against `KeyboardEvent.key`,
    /// case-insensitively) dismisses the screensaver. If unset, any key does.
    dismiss_key: Option<String>,
}

const DEFAULT_DISMISS_KEY: &str = "Escape";

/// Minimal percent-encoding for a query string value (key names like
/// "Escape", "F1", " " are the only expected inputs).
fn url_encode(value: &str) -> String {
    value
        .bytes()
        .map(|b| match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                (b as char).to_string()
            }
            _ => format!("%{:02X}", b),
        })
        .collect()
}

fn parse_screensaver_options(args: &[String]) -> ScreensaverOptions {
    let mut ignore_mouse = false;
    let mut dismiss_key = None;

    for arg in args {
        let lower = arg.to_lowercase();
        if lower == "ignoremouse" || lower == "--ignore-mouse" || lower == "-ignoremouse" {
            ignore_mouse = true;
        } else if lower == "--dismiss-key" || lower == "-dismiss-key" {
            dismiss_key = Some(DEFAULT_DISMISS_KEY.to_string());
        } else if let Some(value) = arg
            .strip_prefix("--dismiss-key=")
            .or_else(|| arg.strip_prefix("-dismiss-key="))
        {
            dismiss_key = Some(if value.is_empty() {
                DEFAULT_DISMISS_KEY.to_string()
            } else {
                value.to_string()
            });
        }
    }

    ScreensaverOptions {
        ignore_mouse,
        dismiss_key,
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let initial_config = load_config();
    let args: Vec<String> = std::env::args().collect();
    let run_mode = parse_run_mode(&args);
    let screensaver_options = parse_screensaver_options(&args);

    tauri::Builder::default()
        .plugin(
            tauri_plugin_log::Builder::default()
                .level(if cfg!(debug_assertions) {
                    log::LevelFilter::Debug
                } else {
                    log::LevelFilter::Info
                })
                .build(),
        )
        .plugin(tauri_plugin_dialog::init())
        .manage(ConfigState(Mutex::new(initial_config)))
        .invoke_handler(tauri::generate_handler![
            commands::get_config,
            commands::get_images,
            commands::validate_directory,
            commands::get_preview_images,
            commands::apply_config,
            commands::save_config,
            commands::get_log_path,
            commands::exit_screensaver,
            commands::read_color_cache,
            commands::write_color_cache,
            commands::get_file_stats,
        ])
        .setup(move |app| {
            match run_mode {
                ("config", _) => {
                    log::info!("Launching in configuration mode");
                    let mut builder = WebviewWindowBuilder::new(
                        app,
                        "config",
                        WebviewUrl::App("configui/screensaver-settings.html".into()),
                    )
                    .title("Image Tile Screensaver Configuration")
                    .inner_size(850.0, 700.0)
                    .resizable(true);
                    if cfg!(debug_assertions) {
                        builder = builder.devtools(true);
                    }
                    builder.build()?;
                }
                ("preview", _hwnd) => {
                    log::info!("Preview mode requested — not yet implemented, exiting");
                    // Preview mode requires embedding in a Windows HWND;
                    // for now just exit cleanly.
                    std::process::exit(0);
                }
                ("screensaver", _) | _ => {
                    log::info!(
                        "Launching in screensaver mode (ignore_mouse={}, dismiss_key={:?})",
                        screensaver_options.ignore_mouse,
                        screensaver_options.dismiss_key
                    );
                    create_screensaver_windows(app, &screensaver_options)?;
                }
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn create_screensaver_windows(
    app: &tauri::App,
    options: &ScreensaverOptions,
) -> Result<(), Box<dyn std::error::Error>> {
    // Create a hidden helper window to bootstrap monitor detection
    let helper = WebviewWindowBuilder::new(
        app,
        "helper",
        WebviewUrl::App("index.html".into()),
    )
    .visible(false)
    .build()?;

    let available_monitors: Vec<_> = helper.available_monitors()?.into_iter().collect();
    let display_count = available_monitors.len();
    log::info!("Found {} monitors", display_count);

    // Create a borderless window covering each monitor.
    // Monitor position/size are in physical pixels; Tauri's position()/inner_size()
    // expect logical pixels, so we divide by the scale factor.
    for (i, monitor) in available_monitors.iter().enumerate() {
        let label = format!("screensaver-{}", i);
        let pos = monitor.position();
        let size = monitor.size();
        let scale = monitor.scale_factor();

        let logical_x = pos.x as f64 / scale;
        let logical_y = pos.y as f64 / scale;
        let logical_w = size.width as f64 / scale;
        let logical_h = size.height as f64 / scale;

        log::info!(
            "Creating window {} on monitor \"{}\" at ({}, {}) logical size {:.0}x{:.0} (scale {:.2})",
            label,
            monitor.name().as_deref().map_or("unknown", |v| v),
            logical_x,
            logical_y,
            logical_w,
            logical_h,
            scale,
        );

        let debug_flag = if cfg!(debug_assertions) { "&debug=1" } else { "" };
        let ignore_mouse_flag = if options.ignore_mouse { "&ignoreMouse=1" } else { "" };
        let dismiss_key_flag = options
            .dismiss_key
            .as_ref()
            .map(|k| format!("&dismissKey={}", url_encode(k)))
            .unwrap_or_default();
        let url = format!(
            "index.html?displayId={}&displayCount={}{}{}{}",
            i, display_count, debug_flag, ignore_mouse_flag, dismiss_key_flag
        );
        let mut builder = WebviewWindowBuilder::new(app, &label, WebviewUrl::App(url.into()))
            .title("")
            .position(logical_x, logical_y)
            .inner_size(logical_w, logical_h)
            .decorations(false)
            .always_on_top(true)
            .skip_taskbar(true);

        if cfg!(debug_assertions) {
            builder = builder.devtools(true);
        }

        builder.build()?;
    }

    // Close the hidden helper window
    let _ = helper.close();

    Ok(())
}

#[cfg(test)]
mod tests {
    #[test]
    fn parse_run_mode_defaults_to_screensaver() {
        let args = vec!["ImageTileScreensaver.scr".to_string()];
        let (mode, hwnd) = super::parse_run_mode_from_args(&args);
        assert_eq!(mode, "screensaver");
        assert!(hwnd.is_none());
    }

    #[test]
    fn parse_run_mode_detects_config_arg() {
        let args = vec!["ImageTileScreensaver.scr".to_string(), "/c".to_string()];
        let (mode, hwnd) = super::parse_run_mode_from_args(&args);
        assert_eq!(mode, "config");
        assert!(hwnd.is_none());
    }

    #[test]
    fn parse_run_mode_detects_preview_with_colon_hwnd() {
        let args = vec!["ImageTileScreensaver.scr".to_string(), "/p:12345".to_string()];
        let (mode, hwnd) = super::parse_run_mode_from_args(&args);
        assert_eq!(mode, "preview");
        assert_eq!(hwnd.as_deref(), Some("12345"));
    }

    #[test]
    fn parse_run_mode_detects_preview_with_next_arg_hwnd() {
        let args = vec![
            "ImageTileScreensaver.scr".to_string(),
            "/p".to_string(),
            "67890".to_string(),
        ];
        let (mode, hwnd) = super::parse_run_mode_from_args(&args);
        assert_eq!(mode, "preview");
        assert_eq!(hwnd.as_deref(), Some("67890"));
    }

    #[test]
    fn screensaver_options_default_to_normal_dismissal() {
        let args = vec!["ImageTileScreensaver.scr".to_string(), "/s".to_string()];
        let opts = super::parse_screensaver_options(&args);
        assert!(!opts.ignore_mouse);
        assert_eq!(opts.dismiss_key, None);
    }

    #[test]
    fn screensaver_options_detects_ignore_mouse() {
        let args = vec![
            "ImageTileScreensaver.scr".to_string(),
            "/s".to_string(),
            "ignoreMouse".to_string(),
        ];
        let opts = super::parse_screensaver_options(&args);
        assert!(opts.ignore_mouse);
        assert_eq!(opts.dismiss_key, None);
    }

    #[test]
    fn screensaver_options_dismiss_key_flag_defaults_to_escape() {
        let args = vec![
            "ImageTileScreensaver.scr".to_string(),
            "/s".to_string(),
            "--dismiss-key".to_string(),
        ];
        let opts = super::parse_screensaver_options(&args);
        assert_eq!(opts.dismiss_key.as_deref(), Some("Escape"));
    }

    #[test]
    fn screensaver_options_dismiss_key_flag_accepts_explicit_value() {
        let args = vec![
            "ImageTileScreensaver.scr".to_string(),
            "/s".to_string(),
            "--ignore-mouse".to_string(),
            "--dismiss-key=F12".to_string(),
        ];
        let opts = super::parse_screensaver_options(&args);
        assert!(opts.ignore_mouse);
        assert_eq!(opts.dismiss_key.as_deref(), Some("F12"));
    }

    #[test]
    fn url_encode_passes_through_safe_chars_and_escapes_others() {
        assert_eq!(super::url_encode("Escape"), "Escape");
        assert_eq!(super::url_encode("F12"), "F12");
        assert_eq!(super::url_encode(" "), "%20");
    }
}

