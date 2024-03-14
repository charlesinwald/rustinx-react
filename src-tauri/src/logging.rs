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

pub(crate) fn monitor_nginx_error_log(path: &str, tx: Sender<String>) -> std::io::Result<()> {
    let file = File::open(path)?;
    let mut reader = BufReader::new(file);
    let mut line = String::new();

    loop {
        match reader.read_line(&mut line) {
            Ok(0) => {
                // No new line, wait before trying again
                thread::sleep(Duration::from_millis(500));
            }
            Ok(_) => {
                tx.send(line.clone()).unwrap(); // Send the new line to the UI thread
                line.clear(); // Clear the line buffer for the next read
            }
            Err(e) => return Err(e),
        }
    }
}

pub(crate) fn get_logs() {
    let (tx, rx): (Sender<String>, Receiver<String>) = channel();
    let log_path = "/var/log/nginx/error.log";
    // Adjust the path to your Nginx error log file
    thread::spawn(move || {
        monitor_nginx_error_log(log_path, tx)
            .unwrap_or_else(|e| eprintln!("Log monitoring error: {}", e));
    });
    let mut log_lines: VecDeque<String> = VecDeque::with_capacity(12);
    while let Ok(log_entry) = rx.try_recv() {
        if log_lines.len() == 10 {
            log_lines.pop_front(); // Remove the oldest log line if we have 10 lines
        }
        log_lines.push_back(log_entry); // Add the new line
    }

    let log_display = log_lines
        .iter()
        .cloned()
        .collect::<Vec<String>>()
        .join("\n");
    println!("Log display: {}", log_display);
}
