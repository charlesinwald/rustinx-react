use std::collections::VecDeque;

use std::io::BufRead;
use std::sync::mpsc::channel;

use std::sync::mpsc::Receiver;

use std::time::Duration;

use std::thread;

use std::io::BufReader;

use std::fs::File;

use std::io;

use std;

use std::sync::mpsc::Sender;

use tauri::{AppHandle, Manager};
use tokio::time::error;

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

pub(crate) fn start_log_monitoring(app_handle: AppHandle) {
    let access_log_path = "/var/log/nginx/access.log";
    let error_log_path = "/var/log/nginx/error.log";
    let app_handle_for_access_log = app_handle.clone();
    std::thread::spawn(move || {
        monitor_nginx_log(access_log_path, "access_event", app_handle_for_access_log)
            .unwrap_or_else(|e| eprintln!("Log monitoring error: {}", e));
    });
    let app_handle_for_error_log = app_handle;
    std::thread::spawn(move || {
        monitor_nginx_log(error_log_path, "error_event", app_handle_for_error_log)
            .unwrap_or_else(|e| eprintln!("Log monitoring error: {}", e));
    });
}
