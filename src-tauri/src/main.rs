#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]
use tauri::{CustomMenuItem, Manager, RunEvent, SystemTray, SystemTrayEvent, SystemTrayMenu};
use tauri_plugin_log::LogTarget;

mod commands;
mod config;
mod events_service;
mod logging;
mod util;

#[tokio::main]
async fn main() {
    let devtools = devtools::init();
    tauri::Builder::default()
        .setup(|app| {
            util::check_sudo(&app.get_window("main").unwrap());
            let app_handle = app.handle();
            let tray_id = "my-tray";
            tokio::spawn(events_service::start_emitting_events(app_handle.clone()));
            logging::start_log_monitoring(app_handle.clone());
            SystemTray::new()
                .with_id(tray_id)
                .with_menu(
                    SystemTrayMenu::new()
                        .add_item(CustomMenuItem::new("quit", "Quit"))
                        .add_item(CustomMenuItem::new("open", "Open")),
                )
                .on_event(move |_event| {
                    let _tray_handle = app_handle.tray_handle_by_id(tray_id).unwrap();
                })
                .build(app)?;
            Ok(())
        })
        .on_system_tray_event(|app, event| match event {
            SystemTrayEvent::MenuItemClick { id, .. } => match id.as_str() {
                "quit" => {
                    std::process::exit(0);
                }
                "open" => {
                    let main_window = app.get_window("main").unwrap();
                    main_window.show().unwrap();
                    main_window.set_focus().unwrap();
                }
                _ => {}
            },
            _ => {}
        })
        .plugin(devtools)
        // .plugin(
        //     tauri_plugin_log::Builder::default()
        //         .targets([LogTarget::LogDir, LogTarget::Stdout, LogTarget::Webview])
        //         .build(),
        // )
        .plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
            let window = app.get_window("main").unwrap();
            window.set_focus().unwrap();
        }))
        .invoke_handler(tauri::generate_handler![
            commands::restart_nginx,
            commands::stop_nginx,
            commands::start_nginx,
            commands::get_nginx_conf_path,
            commands::open_file,
            commands::get_system_metrics,
            config::get_nginx_version,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
