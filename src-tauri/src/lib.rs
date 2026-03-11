mod commands;
mod config;
mod images;

use config::{load_config, ConfigState};
use std::sync::Mutex;
use tauri::{WebviewUrl, WebviewWindowBuilder};

/// Determine the run mode from command-line arguments.
/// Returns: "screensaver", "config", or "preview"
fn parse_run_mode() -> (&'static str, Option<String>) {
    let args: Vec<String> = std::env::args().collect();
    log::info!("Command line arguments: {:?}", args);

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
    }

    ("screensaver", None)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let initial_config = load_config();
    let run_mode = parse_run_mode();

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
        ])
        .setup(move |app| {
            match run_mode {
                ("config", _) => {
                    log::info!("Launching in configuration mode");
                    WebviewWindowBuilder::new(
                        app,
                        "config",
                        WebviewUrl::App("configui/screensaver-settings.html".into()),
                    )
                    .title("Image Tile Screensaver Configuration")
                    .inner_size(850.0, 700.0)
                    .resizable(true)
                    .build()?;
                }
                ("preview", _hwnd) => {
                    log::info!("Preview mode requested — not yet implemented, exiting");
                    // Preview mode requires embedding in a Windows HWND;
                    // for now just exit cleanly.
                    std::process::exit(0);
                }
                ("screensaver", _) | _ => {
                    log::info!("Launching in screensaver mode");
                    create_screensaver_windows(app)?;
                }
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn create_screensaver_windows(app: &tauri::App) -> Result<(), Box<dyn std::error::Error>> {
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

        let url = format!("index.html?displayId={}&displayCount={}", i, display_count);
        WebviewWindowBuilder::new(app, &label, WebviewUrl::App(url.into()))
            .title("")
            .position(logical_x, logical_y)
            .inner_size(logical_w, logical_h)
            .decorations(false)
            .always_on_top(true)
            .skip_taskbar(true)
            .build()?;
    }

    // Close the hidden helper window
    let _ = helper.close();

    Ok(())
}

#[cfg(test)]
mod tests {
    #[test]
    fn parse_run_mode_defaults_to_screensaver() {
        // When called with no relevant args, should default to screensaver
        // (In unit tests we can't easily override std::env::args,
        //  so we test the logic by checking the function exists and
        //  the default path returns "screensaver".)
        let (mode, _) = super::parse_run_mode();
        // In test context, there are no /c /p /s args
        assert_eq!(mode, "screensaver");
    }
}

