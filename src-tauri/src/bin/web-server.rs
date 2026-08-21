use actix_session::{storage::CookieSessionStore, SessionMiddleware, Session};
use actix_web::{cookie::Key, guard, web, App, HttpServer, HttpResponse, Error};
use actix_cors::Cors;
use rustinx_embed::{default_security_headers, serve_embedded_dist};
use serde_json;
use sysinfo::System;
use std::process::{Command, Stdio};
use std::io::Write;
use std::env::consts::OS;
use serde::Deserialize;
use std::sync::{Arc, Mutex};
use std::collections::HashMap;

#[path = "../nginx_logs.rs"]
mod nginx_logs;

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

    match nginx_logs::read_logs(&log_type, lines) {
        Ok(result) => Ok(HttpResponse::Ok().json(serde_json::json!({
            "logs": result.lines,
            "type": log_type,
            "path": result.paths.first().cloned().unwrap_or_default(),
            "paths": result.paths
        }))),
        Err(e) => Ok(HttpResponse::InternalServerError().json(serde_json::json!({
            "error": e
        })))
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

    println!("Starting Rustinx web server on http://0.0.0.0:8081");
    println!("Serving embedded static UI (dist compiled into binary)");

    HttpServer::new(move || {
        println!("🌐 Creating new HTTP server instance");
        println!("🍪 Setting up CORS and session middleware");
        App::new()
            .wrap(default_security_headers())
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
            .default_service(
                web::route()
                    .guard(guard::Get())
                    .to(serve_embedded_dist),
            )
    })
    .bind("0.0.0.0:8081")?
    .run()
    .await
}