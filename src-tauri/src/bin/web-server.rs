use actix_session::{storage::CookieSessionStore, SessionMiddleware, Session};
use actix_web::{cookie::Key, web, App, HttpServer, HttpResponse, Error};
use actix_cors::Cors;
use actix_files as fs;
use serde_json;
use sysinfo::System;
use std::process::{Command, Stdio};
use std::io::Write;
use std::env::consts::OS;
use serde::Deserialize;
use std::sync::{Arc, Mutex};
use std::collections::HashMap;

#[derive(Debug, Deserialize)]
struct SystemdLogOptions {
    service_name: String,
    no_pager: bool,
    num_lines: Option<u32>,
    since: Option<String>,
    until: Option<String>,
    reverse: bool,
}

#[derive(Deserialize)]
struct LoginRequest {
    password: String,
}

// Global password storage for sudo operations
lazy_static::lazy_static! {
    static ref PASSWORD_STORE: Arc<Mutex<HashMap<String, String>>> = Arc::new(Mutex::new(HashMap::new()));
}

fn get_stored_password() -> Option<String> {
    if let Ok(store) = PASSWORD_STORE.lock() {
        store.get("sudo_password").cloned()
    } else {
        None
    }
}

fn execute_sudo_command(args: Vec<&str>) -> Result<std::process::Output, String> {
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

fn get_system_metrics() -> Result<(f32, u64, u64, usize, usize, u64, u64), String> {
    let mut sys = System::new_all();
    sys.refresh_all();

    let mut cpu_usage = 0.0;
    let mut used_memory = 0;
    let mut worker_count = 0;

    let num_tasks = sys.processes()
        .values()
        .filter(|process| {
            let name = process.name().to_string_lossy().to_ascii_lowercase();
            if name.contains("nginx") {
                cpu_usage += process.cpu_usage();
                used_memory += process.memory();

                if name.contains("worker process") {
                    worker_count += 1;
                }
                true
            } else {
                false
            }
        })
        .count();

    let total_memory = sys.total_memory();
    let (tx_bytes, rx_bytes) = get_nginx_bandwidth().unwrap_or((0, 0));

    Ok((cpu_usage, total_memory, used_memory, num_tasks, worker_count, tx_bytes, rx_bytes))
}

fn get_nginx_bandwidth() -> Result<(u64, u64), String> {
    let output = Command::new("sh")
        .arg("-c")
        .arg("netstat -anp tcp | grep '.443' | grep 'ESTABLISHED'; netstat -anp tcp | grep '.80' | grep 'ESTABLISHED'")
        .output()
        .map_err(|e| format!("Failed to execute netstat command: {}", e))?;

    if output.status.success() {
        let output_str = String::from_utf8_lossy(&output.stdout).to_string();
        let (tx_bytes, rx_bytes) = parse_netstat_output(&output_str)?;
        Ok((tx_bytes, rx_bytes))
    } else {
        let error_message = String::from_utf8_lossy(&output.stderr).to_string();
        Err(format!("netstat command error: {}", error_message))
    }
}

fn parse_netstat_output(output: &str) -> Result<(u64, u64), String> {
    let mut tx_bytes = 0;
    let mut rx_bytes = 0;

    for line in output.lines() {
        let parts: Vec<&str> = line.split_whitespace().collect();
        if parts.len() > 7 {
            tx_bytes += parts[5].parse::<u64>().unwrap_or(0);
            rx_bytes += parts[6].parse::<u64>().unwrap_or(0);
        }
    }

    Ok((tx_bytes, rx_bytes))
}

async fn login(session: Session, req: web::Json<LoginRequest>) -> Result<HttpResponse, Error> {
    println!("🔐 Login attempt received");
    println!("📦 Request body: password length = {}", req.password.len());
    println!("📋 Session ID before login: {:?}", session.entries());
    
    // Test the sudo password by running a simple command
    println!("🚀 Starting sudo command test...");
    let mut child = Command::new("sudo")
        .arg("-S")
        .arg("echo")
        .arg("hello")
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| actix_web::error::ErrorInternalServerError(e.to_string()))?;

    if let Some(mut stdin) = child.stdin.take() {
        stdin
            .write_all(format!("{}\n", req.password).as_bytes())
            .map_err(|e| actix_web::error::ErrorInternalServerError(e.to_string()))?;
    }

    let output = child
        .wait_with_output()
        .map_err(|e| actix_web::error::ErrorInternalServerError(e.to_string()))?;
    
    println!("🔍 Command output: {:?}", output);
    println!("✅ Command success: {}", output.status.success());
    println!("📤 Stdout: {}", String::from_utf8_lossy(&output.stdout));
    println!("❌ Stderr: {}", String::from_utf8_lossy(&output.stderr));
    
    if output.status.success() {
        println!("🎉 Password validation successful!");
        // Store the password for future use
        if let Ok(mut store) = PASSWORD_STORE.lock() {
            store.insert("sudo_password".to_string(), req.password.clone());
            println!("💾 Password stored in memory");
        } else {
            println!("⚠️ Failed to store password in memory");
        }
        
        let session_result = session.insert("logged_in", true);
        println!("🍪 Session insert result: {:?}", session_result);
        println!("📋 Session contents after insert: {:?}", session.entries());
        
        println!("✅ Sending success response");
        Ok(HttpResponse::Ok().json(serde_json::json!({"success": true})))
    } else {
        println!("❌ Invalid sudo password provided");
        Ok(HttpResponse::Unauthorized().json(serde_json::json!({"error": "Invalid sudo password"})))
    }
}

async fn check_session(session: Session) -> Result<HttpResponse, Error> {
    println!("🔍 Session check requested");
    println!("📋 Available session entries: {:?}", session.entries());
    
    match session.get::<bool>("logged_in") {
        Ok(Some(logged_in)) => {
            println!("📋 Session status found: logged_in = {}", logged_in);
            if logged_in {
                println!("✅ Session valid - user is authenticated");
                return Ok(HttpResponse::Ok().finish());
            } else {
                println!("❌ Session found but logged_in = false");
            }
        }
        Ok(None) => {
            println!("📭 No session data found");
        }
        Err(e) => {
            println!("❌ Error reading session: {:?}", e);
        }
    }
    
    println!("🚫 Returning unauthorized response");
    Ok(HttpResponse::Unauthorized().finish())
}

async fn get_system_metrics_http() -> Result<HttpResponse, Error> {
    match get_system_metrics() {
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

async fn start_nginx_http() -> Result<HttpResponse, Error> {
    let output = match OS {
        "linux" => execute_sudo_command(vec!["systemctl", "start", "nginx"]),
        "macos" => Command::new("brew")
            .arg("services")
            .arg("start")
            .arg("nginx")
            .output()
            .map_err(|e| e.to_string()),
        _ => Err("Unsupported OS".into()),
    };

    match output {
        Ok(output) if output.status.success() => {
            Ok(HttpResponse::Ok().json(serde_json::json!({
                "success": true,
                "message": "Nginx started successfully"
            })))
        }
        Ok(output) => {
            let stderr = String::from_utf8_lossy(&output.stderr);
            Ok(HttpResponse::InternalServerError().json(serde_json::json!({
                "success": false,
                "error": format!("Failed to start Nginx: {}", stderr)
            })))
        }
        Err(e) => {
            Ok(HttpResponse::InternalServerError().json(serde_json::json!({
                "success": false,
                "error": e
            })))
        }
    }
}

async fn stop_nginx_http() -> Result<HttpResponse, Error> {
    let output = match OS {
        "linux" => execute_sudo_command(vec!["systemctl", "stop", "nginx"]),
        "macos" => Command::new("brew")
            .arg("services")
            .arg("stop")
            .arg("nginx")
            .output()
            .map_err(|e| e.to_string()),
        _ => Err("Unsupported OS".into()),
    };

    match output {
        Ok(output) if output.status.success() => {
            Ok(HttpResponse::Ok().json(serde_json::json!({
                "success": true,
                "message": "Nginx stopped successfully"
            })))
        }
        Ok(output) => {
            let stderr = String::from_utf8_lossy(&output.stderr);
            Ok(HttpResponse::InternalServerError().json(serde_json::json!({
                "success": false,
                "error": format!("Failed to stop Nginx: {}", stderr)
            })))
        }
        Err(e) => {
            Ok(HttpResponse::InternalServerError().json(serde_json::json!({
                "success": false,
                "error": e
            })))
        }
    }
}

async fn restart_nginx_http() -> Result<HttpResponse, Error> {
    let output = match OS {
        "linux" => execute_sudo_command(vec!["systemctl", "restart", "nginx"]),
        "macos" => Command::new("brew")
            .arg("services")
            .arg("restart")
            .arg("nginx")
            .output()
            .map_err(|e| e.to_string()),
        _ => Err("Unsupported OS".into()),
    };

    match output {
        Ok(output) if output.status.success() => {
            Ok(HttpResponse::Ok().json(serde_json::json!({
                "success": true,
                "message": "Nginx restarted successfully"
            })))
        }
        Ok(output) => {
            let stderr = String::from_utf8_lossy(&output.stderr);
            Ok(HttpResponse::InternalServerError().json(serde_json::json!({
                "success": false,
                "error": format!("Failed to restart Nginx: {}", stderr)
            })))
        }
        Err(e) => {
            Ok(HttpResponse::InternalServerError().json(serde_json::json!({
                "success": false,
                "error": e
            })))
        }
    }
}

async fn get_nginx_status_http() -> Result<HttpResponse, Error> {
    let output = match OS {
        "linux" => Command::new("systemctl")
            .arg("is-active")
            .arg("nginx")
            .output()
            .map_err(|e| e.to_string()),
        "macos" => Command::new("brew")
            .arg("services")
            .arg("list")
            .output()
            .map_err(|e| e.to_string()),
        _ => Err("Unsupported OS".into()),
    };

    match output {
        Ok(output) if output.status.success() => {
            let status = String::from_utf8_lossy(&output.stdout).trim().to_string();
            let is_active = match OS {
                "linux" => status == "active",
                "macos" => status.contains("nginx") && status.contains("started"),
                _ => false,
            };

            Ok(HttpResponse::Ok().json(serde_json::json!({
                "status": if is_active { "active" } else { "inactive" },
                "raw_output": status
            })))
        }
        Ok(output) => {
            let stderr = String::from_utf8_lossy(&output.stderr);
            Ok(HttpResponse::Ok().json(serde_json::json!({
                "status": "inactive",
                "error": stderr
            })))
        }
        Err(e) => {
            Ok(HttpResponse::InternalServerError().json(serde_json::json!({
                "status": "unknown",
                "error": e
            })))
        }
    }
}

async fn get_nginx_config_path_http() -> Result<HttpResponse, Error> {
    let output = Command::new("sh")
        .arg("-c")
        .arg("nginx -t 2>&1 | grep -Eo '(/[^ :]+\\.conf)' | head -n 1")
        .output()
        .map_err(|e| format!("Failed to execute command: {}", e));

    match output {
        Ok(output) => {
            let output_str = String::from_utf8_lossy(&output.stdout).trim().to_string();
            if output_str.is_empty() {
                Ok(HttpResponse::Ok().json(serde_json::json!({
                    "path": "/etc/nginx/nginx.conf",
                    "found": false,
                    "message": "Using default path"
                })))
            } else {
                Ok(HttpResponse::Ok().json(serde_json::json!({
                    "path": output_str,
                    "found": true
                })))
            }
        }
        Err(e) => {
            Ok(HttpResponse::InternalServerError().json(serde_json::json!({
                "error": e
            })))
        }
    }
}

async fn get_nginx_version_http() -> Result<HttpResponse, Error> {
    let output = Command::new("nginx")
        .arg("-V")
        .output()
        .map_err(|e| format!("Failed to execute nginx -V: {}", e));

    match output {
        Ok(output) => {
            // nginx -V outputs to stderr, not stdout
            let version_info = if !output.stderr.is_empty() {
                String::from_utf8_lossy(&output.stderr).to_string()
            } else {
                String::from_utf8_lossy(&output.stdout).to_string()
            };

            Ok(HttpResponse::Ok().json(serde_json::json!({
                "version_info": version_info,
                "success": true
            })))
        }
        Err(e) => {
            Ok(HttpResponse::InternalServerError().json(serde_json::json!({
                "error": e,
                "success": false
            })))
        }
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
    use std::path::Path;
    
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
    use std::path::Path;

    let content = fs::read_to_string(config_path)
        .map_err(|e| format!("Failed to read nginx config at {}: {}", config_path, e))?;

    // Look for the appropriate log directive
    let directive = match log_type {
        "access" => "access_log",
        "error" => "error_log", 
        _ => return Err("Invalid log type".to_string()),
    };

    // Parse the config for the log directive
    for line in content.lines() {
        let line = line.trim();
        if line.starts_with(directive) && !line.starts_with("#") {
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
    use std::path::Path;
    
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
    use std::path::Path;
    
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

async fn get_systemd_logs_http(
    session: Session,
    body: web::Json<SystemdLogOptions>,
) -> Result<HttpResponse, Error> {
    if !session.get::<bool>("logged_in")?.unwrap_or(false) {
        return Ok(HttpResponse::Unauthorized().json(serde_json::json!({
            "error": "Authentication required"
        })));
    }

    let options = body.into_inner();

    match get_systemd_logs(&options) {
        Ok(logs) => Ok(HttpResponse::Ok().json(serde_json::json!({
            "logs": logs,
            "service_name": options.service_name
        }))),
        Err(e) => Ok(HttpResponse::InternalServerError().json(serde_json::json!({
            "error": e
        })))
    }
}

fn get_systemd_logs(options: &SystemdLogOptions) -> Result<String, String> {
    match OS {
        "linux" => get_linux_systemd_logs(options),
        "macos" => get_macos_systemd_logs(options),
        _ => Err("Unsupported operating system".to_string()),
    }
}

fn get_linux_systemd_logs(options: &SystemdLogOptions) -> Result<String, String> {
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

fn get_macos_systemd_logs(options: &SystemdLogOptions) -> Result<String, String> {
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
            let formatted_since = format_datetime_macos(since);
            cmd.arg("--start").arg(formatted_since);
        }
    }

    if let Some(until) = &options.until {
        if !until.trim().is_empty() {
            // Ensure the format matches macOS expectations
            let formatted_until = format_datetime_macos(until);
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

fn format_datetime_macos(datetime: &str) -> String {
    if datetime.len() == 10 {
        // If the datetime only includes the date (YYYY-MM-DD), append a time
        format!("{} 00:00:00", datetime)
    } else {
        datetime.to_string()
    }
}

#[tokio::main]
async fn main() -> std::io::Result<()> {
    env_logger::init();
    
    // Get the current executable path and navigate to the project root
    let current_exe = std::env::current_exe().expect("Failed to get current executable path");
    let project_root = current_exe.parent()
        .and_then(|p| p.parent())      // target-web
        .and_then(|p| p.parent())      // src-tauri
        .and_then(|p| p.parent())      // project root
        .expect("Failed to find project root");
    
    let dist_path = project_root.join("dist");
    
    println!("Starting Rustinx web server on http://0.0.0.0:8081");
    println!("Project root: {}", project_root.display());
    println!("Serving static files from: {}", dist_path.display());
    
    if !dist_path.exists() {
        eprintln!("ERROR: dist directory does not exist at {}", dist_path.display());
        eprintln!("Please run 'yarn run build' first to create the dist directory.");
        return Err(std::io::Error::new(std::io::ErrorKind::NotFound, "dist directory not found"));
    }
    
    let dist_str = dist_path.to_string_lossy().to_string();
    
    HttpServer::new(move || {
        println!("🌐 Creating new HTTP server instance");
        println!("🍪 Setting up CORS and session middleware");
        App::new()
            .wrap(
                Cors::default()
                    .allow_any_origin()
                    .allow_any_method()
                    .allow_any_header()
                    .supports_credentials()
            )
            .wrap(SessionMiddleware::builder(
                CookieSessionStore::default(),
                Key::from(&[0; 64])
            )
            .cookie_name("rustinx_session".to_owned())
            .cookie_secure(false) // Allow HTTP for development
            .cookie_http_only(true)
            .cookie_same_site(actix_web::cookie::SameSite::Lax)
            .build())
            .service(
                web::scope("/api")
                    .route("/login", web::post().to(login))
                    .route("/session", web::get().to(check_session))
                    .route("/system-metrics", web::get().to(get_system_metrics_http))
                    .route("/nginx/start", web::post().to(start_nginx_http))
                    .route("/nginx/stop", web::post().to(stop_nginx_http))
                    .route("/nginx/restart", web::post().to(restart_nginx_http))
                    .route("/nginx/status", web::get().to(get_nginx_status_http))
                    .route("/nginx/config-path", web::get().to(get_nginx_config_path_http))
                    .route("/nginx/version", web::get().to(get_nginx_version_http))
                    .route("/nginx/logs", web::get().to(get_nginx_logs_http))
                    .route("/systemd/logs", web::post().to(get_systemd_logs_http)),
            )
            .service(fs::Files::new("/", dist_str.clone()).index_file("index.html"))
    })
    .bind("0.0.0.0:8081")?
    .run()
    .await
}