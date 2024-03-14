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

pub(crate) fn monitor_nginx_error_log(path: &str, app: AppHandle) -> std::io::Result<()> {
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
                app.emit_all("log_event", &line)
                    .expect("Failed to emit log event");
                line.clear(); // Clear the line buffer for the next read
            }
            Err(e) => return Err(e),
        }
    }
}

// Modify the get_logs or create a similar function to start the log monitoring with AppHandle
pub(crate) fn start_log_monitoring(app_handle: AppHandle) {
    let log_path = "/var/log/nginx/access.log";
    std::thread::spawn(move || {
        monitor_nginx_error_log(log_path, app_handle)
            .unwrap_or_else(|e| eprintln!("Log monitoring error: {}", e));
    });
}
