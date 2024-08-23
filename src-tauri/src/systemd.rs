use std::process::Command;
use serde::Deserialize;

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
                Err(format!(
                    "journalctl error: {}",
                    error_message.trim()
                ))
            }
        }
        Err(e) => Err(format!("Failed to execute journalctl: {}", e)),
    }
}
