use std::env::consts::OS;
use std::process::Command;
use std::thread;
use std::time::Duration;

use tauri::{AppHandle, Manager};

use crate::nginx_logs;

pub(crate) fn start_log_monitoring(app_handle: AppHandle) {
    let app_handle_for_access_log = app_handle.clone();
    let app_handle_for_config_check = app_handle.clone();
    let app_handle_for_status_check = app_handle.clone();
    let app_handle_for_error_log = app_handle;

    std::thread::spawn(move || {
        monitor_logs("access", "access_event", "access_log_error", app_handle_for_access_log);
    });

    std::thread::spawn(move || {
        monitor_logs("error", "error_event", "error_log_error", app_handle_for_error_log);
    });

    check_nginx_config(app_handle_for_config_check);
    check_nginx_status(app_handle_for_status_check);
}

fn monitor_logs(log_type: &str, event: &str, error_event: &str, app: AppHandle) {
    match nginx_logs::discover_log_files(log_type) {
        Ok(paths) => {
            if paths.is_empty() {
                let _ = app.emit_all(
                    error_event,
                    format!("No {} log files were discovered.", log_type),
                );
                return;
            }
            for path in paths {
                let app_clone = app.clone();
                let event = event.to_string();
                let error_event = error_event.to_string();
                std::thread::spawn(move || {
                    if let Err(e) = nginx_logs::follow_log_file(&path, |line| {
                        let _ = app_clone.emit_all(&event, line);
                    }) {
                        let _ = app_clone.emit_all(
                            &error_event,
                            format!("Log monitoring error for {}: {}", path, e),
                        );
                    }
                });
            }
        }
        Err(e) => {
            let _ = app.emit_all(error_event, e);
        }
    }
}

fn check_nginx_config(app: AppHandle) {
    thread::spawn(move || loop {
        let output = Command::new("nginx")
            .arg("-t")
            .output()
            .expect("Failed to execute command");

        let message = if output.status.success() {
            "Nginx configuration is valid.".to_string()
        } else {
            let stderr = String::from_utf8_lossy(&output.stderr);
            format!("Nginx configuration error: {}", stderr)
        };

        app.emit_all("nginx_config_check", &message)
            .expect("Failed to emit nginx config check event");

        thread::sleep(Duration::from_secs(5));
    });
}

pub(crate) fn check_nginx_status(app: AppHandle) {
    thread::spawn(move || loop {
        let status = match OS {
            "linux" => {
                let output = Command::new("systemctl")
                    .arg("is-active")
                    .arg("nginx")
                    .output();

                match output {
                    Ok(output) => String::from_utf8_lossy(&output.stdout).trim().to_string(),
                    Err(_) => "unknown".to_string(),
                }
            }
            "macos" => {
                let output = Command::new("sh")
                    .arg("-c")
                    .arg("ps aux | grep nginx | grep -v grep")
                    .output();

                match output {
                    Ok(output) => {
                        if output.stdout.is_empty() {
                            "inactive".to_string()
                        } else {
                            "active".to_string()
                        }
                    }
                    Err(_) => "unknown".to_string(),
                }
            }
            _ => "unsupported".to_string(),
        };

        app.emit_all("nginx_status_check", &status)
            .expect("Failed to emit nginx status event");

        thread::sleep(Duration::from_secs(5));
    });
}
