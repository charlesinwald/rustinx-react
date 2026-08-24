use std::env::consts::OS;
use std::fs::File;
use std::io::{BufRead, BufReader};
use std::process::{Command, Stdio};
use std::thread;
use std::time::Duration;

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

fn nginx_config_check_message(success: bool, stdout: &str, stderr: &str) -> String {
    let combined = format!("{stderr}{stdout}");
    if success || nginx_syntax_ok_despite_unwritable_logs(&combined) {
        "Nginx configuration is valid.".to_string()
    } else {
        format!("Nginx configuration error: {}", stderr)
    }
}

fn nginx_syntax_ok_despite_unwritable_logs(output: &str) -> bool {
    if !output.contains("syntax is ok") {
        return false;
    }

    output.lines().all(|line| {
        let line = line.trim();
        line.is_empty() || is_ignorable_nginx_test_line(line)
    })
}

fn is_ignorable_nginx_test_line(line: &str) -> bool {
    let lower = line.to_lowercase();
    if lower.contains("syntax is ok")
        || lower.contains("test failed")
        || lower.contains("test is successful")
    {
        return true;
    }

    if !lower.contains("permission denied") {
        return false;
    }

    lower.contains("could not open error log file")
        || (lower.contains("open()") && line.contains(".log"))
}

fn check_nginx_config(app: AppHandle) {
    thread::spawn(move || loop {
        // Execute `nginx -t` to check the configuration
        let output = Command::new("nginx")
            .arg("-t")
            .output()
            .expect("Failed to execute command");

        let stdout = String::from_utf8_lossy(&output.stdout);
        let stderr = String::from_utf8_lossy(&output.stderr);
        let message = nginx_config_check_message(output.status.success(), &stdout, &stderr);

        // Emit the result to the frontend
        app.emit_all("nginx_config_check", &message)
            .expect("Failed to emit nginx config check event");

        // Wait for a few seconds before checking again
        thread::sleep(Duration::from_secs(5));
    });
}

fn log_file_readable(path: &str) -> bool {
    crate::nginx_logs::log_file_readable(path)
}

fn resolve_nginx_log_paths() -> (Option<String>, Option<String>) {
    (
        crate::nginx_logs::find_readable_nginx_log("access"),
        crate::nginx_logs::find_readable_nginx_log("error"),
    )
}

fn spawn_macos_log_stream() -> std::io::Result<std::process::Child> {
    let predicate = r#"process == "nginx""#;
    let mut command = Command::new("log");
    command
        .args(["stream", "--predicate", predicate])
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    match command.spawn() {
        Ok(child) => Ok(child),
        Err(_) => {
            // -n avoids hanging on a password prompt in a GUI app
            Command::new("sudo")
                .args(["-n", "log", "stream", "--predicate", predicate])
                .stdout(Stdio::piped())
                .stderr(Stdio::piped())
                .spawn()
        }
    }
}

fn monitor_macos_unified_log(
    app: AppHandle,
    emit_access: bool,
    emit_error: bool,
) -> std::io::Result<()> {
    let mut child = spawn_macos_log_stream()?;
    let stdout = child.stdout.take().ok_or_else(|| {
        std::io::Error::new(
            std::io::ErrorKind::BrokenPipe,
            "failed to capture macOS log stream stdout",
        )
    })?;
    let reader = BufReader::new(stdout);

    for line in reader.lines() {
        let line = line?;
        if line.trim().is_empty() {
            continue;
        }
        if emit_access {
            app.emit_all("access_event", &line)
                .expect("Failed to emit log event");
        }
        if emit_error {
            app.emit_all("error_event", &line)
                .expect("Failed to emit log event");
        }
    }

    Ok(())
}

pub(crate) fn start_log_monitoring(app_handle: AppHandle) {
    let (access_log_path, error_log_path) = resolve_nginx_log_paths();
    let access_ok = access_log_path
        .as_deref()
        .map(log_file_readable)
        .unwrap_or(false);
    let error_ok = error_log_path
        .as_deref()
        .map(log_file_readable)
        .unwrap_or(false);

    if let Some(path) = access_log_path.filter(|_| access_ok) {
        let app_handle_for_access_log = app_handle.clone();
        thread::spawn(move || {
            monitor_nginx_log(&path, "access_event", app_handle_for_access_log)
                .unwrap_or_else(|e| eprintln!("Log monitoring error: {}", e));
        });
    }

    if let Some(path) = error_log_path.filter(|_| error_ok) {
        let app_handle_for_error_log = app_handle.clone();
        thread::spawn(move || {
            monitor_nginx_log(&path, "error_event", app_handle_for_error_log)
                .unwrap_or_else(|e| eprintln!("Log monitoring error: {}", e));
        });
    }

    if OS == "macos" && (!access_ok || !error_ok) {
        let app_handle_for_stream = app_handle.clone();
        thread::spawn(move || {
            eprintln!(
                "Nginx log files unavailable (access readable: {}, error readable: {}); falling back to macOS unified log stream",
                access_ok, error_ok
            );
            if let Err(e) = monitor_macos_unified_log(app_handle_for_stream, !access_ok, !error_ok)
            {
                eprintln!("macOS log stream error: {}", e);
            }
        });
    }

    let app_handle_for_config_check = app_handle.clone();
    let app_handle_for_status_check = app_handle;
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

#[cfg(test)]
mod tests {
    use super::*;

    const HOMEBREW_LOG_PERMISSION_STDERR: &str = "\
nginx: [alert] could not open error log file: open() \"/opt/homebrew/var/log/nginx/error.log\" failed (13: Permission denied)
nginx: the configuration file /opt/homebrew/etc/nginx/nginx.conf syntax is ok
2026/08/24 16:49:12 [emerg] 71594#0: open() \"/opt/homebrew/var/log/nginx/access.log\" failed (13: Permission denied)
nginx: configuration file /opt/homebrew/etc/nginx/nginx.conf test failed
";

    #[test]
    fn homebrew_unwritable_logs_with_valid_syntax_are_not_a_config_error() {
        let message = nginx_config_check_message(false, "", HOMEBREW_LOG_PERMISSION_STDERR);
        assert_eq!(message, "Nginx configuration is valid.");
    }

    #[test]
    fn successful_nginx_t_is_valid() {
        let stderr = "\
nginx: the configuration file /opt/homebrew/etc/nginx/nginx.conf syntax is ok
nginx: configuration file /opt/homebrew/etc/nginx/nginx.conf test is successful
";
        assert_eq!(
            nginx_config_check_message(true, "", stderr),
            "Nginx configuration is valid."
        );
    }

    #[test]
    fn syntax_error_is_still_a_config_error() {
        let stderr = "\
nginx: [alert] could not open error log file: open() \"/opt/homebrew/var/log/nginx/error.log\" failed (13: Permission denied)
nginx: [emerg] unexpected \"}\" in /opt/homebrew/etc/nginx/nginx.conf:12
nginx: configuration file /opt/homebrew/etc/nginx/nginx.conf test failed
";
        let message = nginx_config_check_message(false, "", stderr);
        assert!(
            message.starts_with("Nginx configuration error:"),
            "expected a config error, got {message}"
        );
        assert!(message.contains("unexpected"));
    }

    #[test]
    fn syntax_ok_with_unrelated_emerg_is_still_a_config_error() {
        let stderr = "\
nginx: the configuration file /opt/homebrew/etc/nginx/nginx.conf syntax is ok
nginx: [emerg] cannot load certificate \"/etc/ssl/certs/foo.pem\": BIO_new_file() failed
nginx: configuration file /opt/homebrew/etc/nginx/nginx.conf test failed
";
        let message = nginx_config_check_message(false, "", stderr);
        assert!(
            message.starts_with("Nginx configuration error:"),
            "expected a config error, got {message}"
        );
        assert!(message.contains("cannot load certificate"));
    }
}
