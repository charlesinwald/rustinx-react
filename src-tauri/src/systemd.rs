use std::process::Command;
use serde::Deserialize;
use std::env::consts::OS;

#[derive(Debug, Deserialize)]
pub struct SystemdLogOptions {
    pub service_name: String,
    pub no_pager: bool,
    pub num_lines: Option<u32>,
    pub since: Option<String>,
    pub until: Option<String>,
    pub reverse: bool,
}

#[tauri::command]
pub fn get_systemd_logs(options: SystemdLogOptions) -> Result<String, String> {
    match OS {
        "linux" => get_linux_logs(options),
        "macos" => get_macos_logs(options),
        _ => Err("Unsupported operating system".to_string()),
    }
}

fn get_linux_logs(options: SystemdLogOptions) -> Result<String, String> {
    let mut cmd = Command::new("journalctl");

    cmd.arg("-u").arg(&options.service_name);

    if options.no_pager {
        cmd.arg("--no-pager");
    }

    if let Some(num_lines) = options.num_lines {
        cmd.arg("-n").arg(num_lines.to_string());
    }

    if let Some(since) = &options.since {
        if !since.trim().is_empty() {
            let formatted_since = since.replace('T', " ");
            cmd.arg("--since").arg(formatted_since);
        }
    }

    if let Some(until) = &options.until {
        if !until.trim().is_empty() {
            let formatted_until = until.replace('T', " ");
            cmd.arg("--until").arg(formatted_until);
        }
    }

    if options.reverse {
        cmd.arg("--reverse");
    }

    match cmd.output() {
        Ok(output) => {
            if output.status.success() {
                let logs = String::from_utf8_lossy(&output.stdout).to_string();
                Ok(logs)
            } else {
                let error_message = String::from_utf8_lossy(&output.stderr).to_string();
                Err(format!("journalctl error: {}", error_message.trim()))
            }
        }
        Err(e) => Err(format!("Failed to execute journalctl: {}", e)),
    }
}

fn get_macos_logs(options: SystemdLogOptions) -> Result<String, String> {
    let mut cmd = Command::new("log");

    // Strip the .service or .socket suffix from the service name
    let service_name = options.service_name.trim_end_matches(".service").trim_end_matches(".socket");

    // Use the `show` subcommand to query the unified logging system on macOS
    cmd.arg("show").arg("--predicate").arg(format!("process == '{}'", service_name));

    if let Some(num_lines) = options.num_lines {
        // macOS does not support direct line counts, but we can simulate it by specifying a time duration
        cmd.arg("--last").arg(format!("{}s", num_lines));  // Fetch the last X seconds of logs
    }

    if let Some(since) = &options.since {
        if !since.trim().is_empty() {
            // Ensure the format matches macOS expectations
            let formatted_since = format_datetime(since);
            cmd.arg("--start").arg(formatted_since);
        }
    }

    if let Some(until) = &options.until {
        if !until.trim().is_empty() {
            // Ensure the format matches macOS expectations
            let formatted_until = format_datetime(until);
            cmd.arg("--end").arg(formatted_until);
        }
    }

    if options.reverse {
        cmd.arg("--reverse");
    }

    match cmd.output() {
        Ok(output) => {
            if output.status.success() {
                let logs = String::from_utf8_lossy(&output.stdout).to_string();
                Ok(logs)
            } else {
                let error_message = String::from_utf8_lossy(&output.stderr).to_string();
                Err(format!("log command error: {}", error_message.trim()))
            }
        }
        Err(e) => Err(format!("Failed to execute log command: {}", e)),
    }
}

fn format_datetime(datetime: &str) -> String {
    if datetime.len() == 10 {
        // If the datetime only includes the date (YYYY-MM-DD), append a time
        format!("{} 00:00:00", datetime)
    } else {
        datetime.to_string()
    }
}

