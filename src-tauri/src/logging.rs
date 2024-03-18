use std::io::BufRead;
use std::process::Command;
use std::sync::mpsc::channel;

use std::sync::mpsc::Receiver;

use std::time::Duration;

use std::thread;

use std::io::BufReader;

use std::fs::File;

use std;
use tauri::{AppHandle, Manager};

pub(crate) fn monitor_nginx_log(path: &str, label: &str, app: AppHandle) -> std::io::Result<()> {
    let file = File::open(path)?;
    let mut reader = BufReader::new(file);
    let mut line = String::new();

    loop {
        match reader.read_line(&mut line) {
            Ok(0) => {
                thread::sleep(Duration::from_millis(500)); // No new line, wait before trying again
            }
            Ok(_) => {
                // Here, instead of sending through a channel, emit the event directly
                app.emit_all(label, &line)
                    .expect("Failed to emit log event");
                line.clear(); // Clear the line buffer for the next read
            }
            Err(e) => return Err(e),
        }
    }
}

fn check_nginx_config(app: AppHandle) {
    thread::spawn(move || loop {
        // Execute `nginx -t` to check the configuration
        let output = Command::new("nginx")
            .arg("-t")
            .output()
            .expect("Failed to execute command");

        // Prepare the message based on the command's success or failure
        let message = if output.status.success() {
            "Nginx configuration is valid.".to_string()
        } else {
            let stderr = String::from_utf8_lossy(&output.stderr);
            format!("Nginx configuration error: {}", stderr)
        };

        // Emit the result to the frontend
        app.emit_all("nginx_config_check", &message)
            .expect("Failed to emit nginx config check event");

        // Wait for a few seconds before checking again
        thread::sleep(Duration::from_secs(5));
    });
}

pub(crate) fn start_log_monitoring(app_handle: AppHandle) {
    let access_log_path = "/var/log/nginx/access.log";
    let error_log_path = "/var/log/nginx/error.log";
    let app_handle_for_access_log = app_handle.clone();
    let app_handle_for_config_check = app_handle.clone();
    let app_handle_for_status_check = app_handle.clone();
    std::thread::spawn(move || {
        monitor_nginx_log(access_log_path, "access_event", app_handle_for_access_log)
            .unwrap_or_else(|e| eprintln!("Log monitoring error: {}", e));
    });
    let app_handle_for_error_log = app_handle;
    std::thread::spawn(move || {
        monitor_nginx_log(error_log_path, "error_event", app_handle_for_error_log)
            .unwrap_or_else(|e| eprintln!("Log monitoring error: {}", e));
    });
    check_nginx_config(app_handle_for_config_check);
    check_nginx_status(app_handle_for_status_check);
}

pub(crate) fn check_nginx_status(app: AppHandle) {
    thread::spawn(move || loop {
        let output = Command::new("systemctl")
            .arg("is-active")
            .arg("nginx")
            .output()
            .expect("Failed to execute command");

        let status = String::from_utf8_lossy(&output.stdout).trim().to_string();

        app.emit_all("nginx_status_check", &status)
            .expect("Failed to emit nginx status event");

        thread::sleep(Duration::from_secs(5));
    });
}
