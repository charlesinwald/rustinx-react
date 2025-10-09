use actix_session::Session;
use actix_web::{web, HttpResponse, Error};
use crate::commands;
use crate::auth::get_stored_password;
use std::process::Command;
use std::env::consts::OS;
use std::io::Write;
use std::process::Stdio;
use std::path::Path;

async fn check_session(session: Session) -> Result<HttpResponse, Error> {
    if let Some(logged_in) = session.get::<bool>("logged_in")? {
        if logged_in {
            return Ok(HttpResponse::Ok().finish());
        }
    }
    Ok(HttpResponse::Unauthorized().finish())
}

fn execute_sudo_command_with_stored_password(args: Vec<&str>) -> Result<std::process::Output, String> {
    let password = get_stored_password().ok_or("No sudo password stored")?;
    
    let mut child = Command::new("sudo")
        .arg("-S")
        .args(args)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| e.to_string())?;

    if let Some(mut stdin) = child.stdin.take() {
        stdin
            .write_all(format!("{}\n", password).as_bytes())
            .map_err(|e| e.to_string())?;
    }

    child.wait_with_output().map_err(|e| e.to_string())
}

fn start_nginx_browser() -> Result<String, String> {
    let output = match OS {
        "linux" => execute_sudo_command_with_stored_password(vec!["systemctl", "start", "nginx"])?,
        "macos" => Command::new("brew")
            .arg("services")
            .arg("start")
            .arg("nginx")
            .output()
            .map_err(|e| e.to_string())?,
        _ => return Err("Unsupported OS".into()),
    };

    if output.status.success() {
        let message = "Nginx started successfully";
        Ok(message.to_string())
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr);
        Err(format!("Failed to start Nginx: {}", stderr))
    }
}

fn stop_nginx_browser() -> Result<String, String> {
    let output = match OS {
        "linux" => execute_sudo_command_with_stored_password(vec!["systemctl", "stop", "nginx"])?,
        "macos" => Command::new("brew")
            .arg("services")
            .arg("stop")
            .arg("nginx")
            .output()
            .map_err(|e| e.to_string())?,
        _ => return Err("Unsupported OS".into()),
    };

    if output.status.success() {
        let message = "Nginx stopped successfully";
        Ok(message.to_string())
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr);
        Err(format!("Failed to stop Nginx: {}", stderr))
    }
}

fn restart_nginx_browser() -> Result<String, String> {
    let output = match OS {
        "linux" => execute_sudo_command_with_stored_password(vec!["systemctl", "restart", "nginx"])?,
        "macos" => Command::new("brew")
            .arg("services")
            .arg("restart")
            .arg("nginx")
            .output()
            .map_err(|e| e.to_string())?,
        _ => return Err("Unsupported OS".into()),
    };

    if output.status.success() {
        let message = "Nginx restarted successfully";
        Ok(message.to_string())
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr);
        Err(format!("Failed to restart Nginx: {}", stderr))
    }
}

async fn get_system_metrics_http() -> Result<HttpResponse, Error> {
    // Get metrics from the same function used by Tauri
    match commands::get_system_metrics() {
        Ok((cpu, total_mem, used_mem, tasks, worker_count, tx_bytes, rx_bytes)) => {
            Ok(HttpResponse::Ok().json(serde_json::json!({
                "cpu": cpu,
                "totalMemory": total_mem,
                "usedMemory": used_mem,
                "tasks": tasks,
                "workerCount": worker_count,
                "txBytes": tx_bytes,
                "rxBytes": rx_bytes
            })))
        }
        Err(e) => Ok(HttpResponse::InternalServerError().json(serde_json::json!({
            "error": e
        })))
    }
}

async fn start_nginx_http(session: Session) -> Result<HttpResponse, Error> {
    if session.get::<bool>("logged_in")?.unwrap_or(false) {
        match start_nginx_browser() {
            Ok(message) => Ok(HttpResponse::Ok().json(serde_json::json!({
                "success": true,
                "message": message
            }))),
            Err(e) => Ok(HttpResponse::Ok().json(serde_json::json!({
                "success": false,
                "error": e
            })))
        }
    } else {
        Ok(HttpResponse::Unauthorized().json(serde_json::json!({
            "success": false,
            "error": "Authentication required"
        })))
    }
}

async fn stop_nginx_http(session: Session) -> Result<HttpResponse, Error> {
    if session.get::<bool>("logged_in")?.unwrap_or(false) {
        match stop_nginx_browser() {
            Ok(message) => Ok(HttpResponse::Ok().json(serde_json::json!({
                "success": true,
                "message": message
            }))),
            Err(e) => Ok(HttpResponse::Ok().json(serde_json::json!({
                "success": false,
                "error": e
            })))
        }
    } else {
        Ok(HttpResponse::Unauthorized().json(serde_json::json!({
            "success": false,
            "error": "Authentication required"
        })))
    }
}

async fn restart_nginx_http(session: Session) -> Result<HttpResponse, Error> {
    if session.get::<bool>("logged_in")?.unwrap_or(false) {
        match restart_nginx_browser() {
            Ok(message) => Ok(HttpResponse::Ok().json(serde_json::json!({
                "success": true,
                "message": message
            }))),
            Err(e) => Ok(HttpResponse::Ok().json(serde_json::json!({
                "success": false,
                "error": e
            })))
        }
    } else {
        Ok(HttpResponse::Unauthorized().json(serde_json::json!({
            "success": false,
            "error": "Authentication required"
        })))
    }
}

async fn get_nginx_logs_http(
    session: Session,
    query: web::Query<std::collections::HashMap<String, String>>,
) -> Result<HttpResponse, Error> {
    if !session.get::<bool>("logged_in")?.unwrap_or(false) {
        return Ok(HttpResponse::Unauthorized().json(serde_json::json!({
            "error": "Authentication required"
        })));
    }

    let log_type = query.get("type").unwrap_or(&"access".to_string()).clone();
    let lines = query.get("lines")
        .and_then(|s| s.parse::<usize>().ok())
        .unwrap_or(100);

    // Find the actual log file path from nginx configuration
    match find_nginx_log_path(&log_type) {
        Ok(log_path) => {
            match read_log_tail(&log_path, lines) {
                Ok(logs) => Ok(HttpResponse::Ok().json(serde_json::json!({
                    "logs": logs,
                    "type": log_type,
                    "path": log_path
                }))),
                Err(e) => Ok(HttpResponse::InternalServerError().json(serde_json::json!({
                    "error": format!("Failed to read logs from {}: {}", log_path, e)
                })))
            }
        },
        Err(e) => Ok(HttpResponse::InternalServerError().json(serde_json::json!({
            "error": e
        })))
    }
}

fn find_nginx_log_path(log_type: &str) -> Result<String, String> {
    // First, check if nginx was compiled with stderr/stdout logging
    if let Ok(build_info) = get_nginx_build_config() {
        if build_info.contains("--error-log-path=stderr") && log_type == "error" {
            return Err("Nginx is configured to log errors to stderr. Error logs are not available as files when using --error-log-path=stderr. You can view nginx error logs using 'journalctl -u nginx' or by checking your process manager logs.".to_string());
        }
        if build_info.contains("--error-log-path=/dev/stderr") && log_type == "error" {
            return Err("Nginx is configured to log errors to stderr. Error logs are not available as files when using --error-log-path=/dev/stderr. You can view nginx error logs using 'journalctl -u nginx' or by checking your process manager logs.".to_string());
        }
        if (build_info.contains("--access-log-path=stdout") || build_info.contains("--access-log-path=/dev/stdout")) && log_type == "access" {
            return Err("Nginx is configured to log access to stdout. Access logs are not available as files when logging to stdout. You can view nginx access logs using 'journalctl -u nginx' or by checking your process manager logs.".to_string());
        }
    }

    // Try common nginx config locations
    let config_paths = [
        "/etc/nginx/nginx.conf",
        "/usr/local/etc/nginx/nginx.conf",
        "/opt/nginx/nginx.conf",
        "/usr/local/nginx/conf/nginx.conf",
    ];

    let mut config_path = None;
    for path in &config_paths {
        if Path::new(path).exists() {
            config_path = Some(*path);
            break;
        }
    }

    let config_path = config_path.ok_or_else(|| {
        format!("Could not find nginx.conf in any of these locations: {:?}", config_paths)
    })?;

    // Read and parse nginx.conf to find log directives
    parse_nginx_config_for_logs(config_path, log_type)
}

fn get_nginx_build_config() -> Result<String, String> {
    let output = Command::new("nginx")
        .arg("-V")
        .output()
        .map_err(|e| format!("Failed to execute nginx -V: {}", e))?;

    // nginx -V outputs build info to stderr
    let build_info = String::from_utf8_lossy(&output.stderr);
    Ok(build_info.to_string())
}

fn parse_nginx_config_for_logs(config_path: &str, log_type: &str) -> Result<String, String> {
    use std::fs;

    let content = fs::read_to_string(config_path)
        .map_err(|e| format!("Failed to read nginx config at {}: {}", config_path, e))?;

    // Look for the appropriate log directive
    let directive = match log_type {
        "access" => "access_log",
        "error" => "error_log", 
        _ => return Err("Invalid log type".to_string()),
    };

    // Parse the config for the log directive
    // This is a simplified parser that looks for the directive and extracts the file path
    for line in content.lines() {
        let line = line.trim();
        if line.starts_with(directive) && !line.starts_with("#") {
            // Extract the file path from the directive
            // Format: access_log /path/to/log [format];
            // or: error_log /path/to/log [level];
            let parts: Vec<&str> = line.split_whitespace().collect();
            if parts.len() >= 2 {
                let path = parts[1].trim_end_matches(';');
                
                // Check for stderr/stdout redirection
                if path == "stderr" || path == "/dev/stderr" {
                    return Err(format!("Nginx {} is configured to log to stderr. Logs are not available as files when using 'stderr'. You can view nginx logs using 'journalctl -u nginx' or by checking your process manager logs.", log_type));
                }
                if path == "stdout" || path == "/dev/stdout" {
                    return Err(format!("Nginx {} is configured to log to stdout. Logs are not available as files when using 'stdout'. You can view nginx logs using 'journalctl -u nginx' or by checking your process manager logs.", log_type));
                }
                if path == "off" {
                    return Err(format!("Nginx {} logging is disabled (set to 'off').", log_type));
                }
                if path == "syslog" || path.starts_with("syslog:") {
                    return Err(format!("Nginx {} is configured to log to syslog. You can view nginx logs using 'journalctl -u nginx' or your system's syslog viewer.", log_type));
                }
                
                // Handle relative paths by making them absolute
                if path.starts_with('/') {
                    return Ok(path.to_string());
                } else {
                    // If relative, prepend nginx prefix (usually /etc/nginx/)
                    let base_dir = Path::new(config_path).parent().unwrap_or(Path::new("/etc/nginx"));
                    let full_path = base_dir.join(path);
                    return Ok(full_path.to_string_lossy().to_string());
                }
            }
        }
    }

    // If not found in main config, try to check included configs
    // Look for include directives and search those files too
    for line in content.lines() {
        let line = line.trim();
        if line.starts_with("include") && !line.starts_with("#") {
            let parts: Vec<&str> = line.split_whitespace().collect();
            if parts.len() >= 2 {
                let include_pattern = parts[1].trim_end_matches(';');
                if let Ok(result) = search_included_configs(config_path, include_pattern, log_type) {
                    return Ok(result);
                }
            }
        }
    }

    // Return default paths if not found in config
    let default_path = match log_type {
        "access" => "/var/log/nginx/access.log",
        "error" => "/var/log/nginx/error.log",
        _ => return Err("Invalid log type".to_string()),
    };

    // Check if default exists
    if Path::new(default_path).exists() {
        Ok(default_path.to_string())
    } else {
        Err(format!("Could not find {} log file. Checked config at {} and default location {}", 
                   log_type, config_path, default_path))
    }
}

fn search_included_configs(base_config: &str, include_pattern: &str, log_type: &str) -> Result<String, String> {
    use std::fs;
    
    // Handle glob patterns like /etc/nginx/sites-enabled/*
    let base_dir = Path::new(base_config).parent().unwrap_or(Path::new("/etc/nginx"));
    let full_pattern = if include_pattern.starts_with('/') {
        include_pattern.to_string()
    } else {
        base_dir.join(include_pattern).to_string_lossy().to_string()
    };

    // Simple glob implementation - just try the pattern as-is first
    if fs::read_to_string(&full_pattern).is_ok() {
        return parse_nginx_config_for_logs(&full_pattern, log_type);
    }

    // If it contains *, try to expand it manually for common cases
    if include_pattern.contains('*') {
        let dir_path = full_pattern.trim_end_matches("*").trim_end_matches("/");
        if let Ok(entries) = fs::read_dir(dir_path) {
            for entry in entries.flatten() {
                let file_path = entry.path();
                if file_path.is_file() {
                    if let Ok(result) = parse_nginx_config_for_logs(&file_path.to_string_lossy(), log_type) {
                        return Ok(result);
                    }
                }
            }
        }
    }

    Err("Log file not found in included configs".to_string())
}

fn read_log_tail(file_path: &str, lines: usize) -> Result<Vec<String>, String> {
    if !Path::new(file_path).exists() {
        return Ok(vec![]);
    }

    // Use tail command to get last N lines efficiently
    let output = Command::new("tail")
        .arg("-n")
        .arg(lines.to_string())
        .arg(file_path)
        .output()
        .map_err(|e| format!("Failed to execute tail command: {}", e))?;

    if output.status.success() {
        let content = String::from_utf8_lossy(&output.stdout);
        let logs: Vec<String> = content
            .lines()
            .filter(|line| !line.trim().is_empty())
            .map(|line| line.to_string())
            .collect();
        Ok(logs)
    } else {
        let error = String::from_utf8_lossy(&output.stderr);
        Err(format!("tail command failed: {}", error))
    }
}

pub fn configure(cfg: &mut web::ServiceConfig) {
    cfg.route("/session", web::get().to(check_session))
        .route("/system-metrics", web::get().to(get_system_metrics_http))
        .route("/nginx/start", web::post().to(start_nginx_http))
        .route("/nginx/stop", web::post().to(stop_nginx_http))
        .route("/nginx/restart", web::post().to(restart_nginx_http))
        .route("/nginx/logs", web::get().to(get_nginx_logs_http));
}