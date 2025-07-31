#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

use actix_web::{App, HttpServer};
use tauri::{CustomMenuItem, Manager, SystemTray, SystemTrayEvent, SystemTrayMenu};


mod actix_routes;
mod commands;
mod config;
mod events_service;
mod logging;
mod systemd;
mod util;

#[tokio::main]
async fn main() {
    std::env::set_var("GDK_BACKEND", "x11");
    std::env::set_var("WEBKIT_DISABLE_COMPOSITING_MODE", "1");
    // Start the Actix Web server in a separate async task
    let actix_server = tokio::spawn(async {
        HttpServer::new(|| App::new().configure(actix_routes::configure))
            .bind("0.0.0.0:8080")
            .expect("Failed to bind to address")
            .run()
            .await
            .expect("Failed to start Actix web server");
    });

    // Run the Tauri application
    tauri::Builder::default()
        .setup(|app| {
            let app_handle = app.handle();
            tokio::spawn(events_service::start_emitting_events(app_handle.clone()));
            logging::start_log_monitoring(app_handle.clone());
            Ok(())
        })
        .system_tray(
            SystemTray::new().with_menu(
                SystemTrayMenu::new()
                    .add_item(CustomMenuItem::new("quit", "Quit"))
                    .add_item(CustomMenuItem::new("open", "Open")),
            ),
        )
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
            config::modify_nginx_service,
            config::reload_and_restart_nginx_service,
            util::check_sudo_status,
            systemd::get_systemd_logs
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");

    // Wait for the Actix server to finish (it won't, unless there is an error)
    actix_server.await.unwrap();
}
