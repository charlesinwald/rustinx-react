use actix_session::{storage::CookieSessionStore, SessionMiddleware};
use actix_web::{cookie::Key, guard, web, App, HttpServer};
use actix_cors::Cors;
use tauri::{CustomMenuItem, Manager, SystemTray, SystemTrayEvent, SystemTrayMenu};
use rustinx_embed::{default_security_headers, serve_embedded_dist};

mod auth;
mod actix_routes;
mod commands;
mod config;
mod events_service;
mod logging;
mod nginx_logs;
mod path_env;
mod systemd;
mod util;

#[tokio::main]
async fn main() {
    path_env::ensure_unix_command_path();
    std::env::set_var("GDK_BACKEND", "x11");
    std::env::set_var("WEBKIT_DISABLE_COMPOSITING_MODE", "1");

    // Start the Actix Web server in a separate async task
    let actix_server = tokio::spawn(async {
        HttpServer::new(move || {
            // Configure CORS to allow requests from the frontend
            let cors = Cors::default()
                .allowed_origin("http://localhost:1234")
                .allowed_origin("http://0.0.0.0:1234")
                .allowed_methods(vec!["GET", "POST", "PUT", "DELETE", "OPTIONS"])
                .allowed_headers(vec![
                    actix_web::http::header::AUTHORIZATION,
                    actix_web::http::header::ACCEPT,
                    actix_web::http::header::CONTENT_TYPE,
                ])
                .supports_credentials()
                .max_age(3600);

            App::new()
                .wrap(default_security_headers())
                .wrap(cors)
                .wrap(SessionMiddleware::new(
                    CookieSessionStore::default(),
                    Key::from(&[0; 64]),
                ))
                .service(
                    web::scope("/api")
                        .route("/login", web::post().to(auth::login))
                        .configure(actix_routes::configure),
                )
                .default_service(
                    web::route()
                        .guard(guard::Get())
                        .to(serve_embedded_dist),
                )
        })
        .bind("0.0.0.0:8081")
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
            systemd::get_systemd_logs,
            commands::has_sudo_password,
            commands::verify_sudo_password
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");

    // Wait for the Actix server to finish (it won't, unless there is an error)
    actix_server.await.unwrap();
}
