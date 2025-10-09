use std::io::BufRead;
use std::process::Command;

use std::time::Duration;

use std::thread;

use std::io::BufReader;

use std::fs::File;

use std;
use tauri::{AppHandle, Manager};
use std::env::consts::OS;


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
    // Determine the correct log paths based on the OS
    let (access_log_path, error_log_path) = match OS {
        "macos" => (
            "/usr/local/var/log/nginx/access.log", // Common path on macOS with Homebrew Nginx
            "/usr/local/var/log/nginx/error.log",
        ),
        "linux" => (
            "/var/log/nginx/access.log", // Common path on Linux
            "/var/log/nginx/error.log",
        ),
        _ => {
            eprintln!("Unsupported OS");
            return;
        }
    };

    let app_handle_for_access_log = app_handle.clone();
    let app_handle_for_config_check = app_handle.clone();
    let app_handle_for_status_check = app_handle.clone();
    
    // Spawn a thread for monitoring access logs
    std::thread::spawn(move || {
        monitor_nginx_log(access_log_path, "access_event", app_handle_for_access_log)
            .unwrap_or_else(|e| eprintln!("Log monitoring error: {}", e));
    });

    // Spawn a thread for monitoring error logs
    let app_handle_for_error_log = app_handle;
    std::thread::spawn(move || {
        monitor_nginx_log(error_log_path, "error_event", app_handle_for_error_log)
            .unwrap_or_else(|e| eprintln!("Log monitoring error: {}", e));
    });

    // Start checking Nginx configuration and status
    check_nginx_config(app_handle_for_config_check);
    check_nginx_status(app_handle_for_status_check);
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

