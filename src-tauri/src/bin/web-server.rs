use actix_session::{storage::CookieSessionStore, SessionMiddleware, Session};
use actix_web::{cookie::Key, web, App, HttpServer, HttpResponse, Error};
use actix_files as fs;
use serde_json;
use sysinfo::System;
use std::process::{Command, Stdio};
use std::io::Write;
use std::env::consts::OS;

// Simple password storage for demo - in production, use proper authentication
static mut STORED_PASSWORD: Option<String> = None;

fn get_stored_password() -> Option<String> {
    unsafe { STORED_PASSWORD.clone() }
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

async fn login(session: Session, body: web::Json<serde_json::Value>) -> Result<HttpResponse, Error> {
    if let Some(password) = body.get("password").and_then(|p| p.as_str()) {
        unsafe {
            STORED_PASSWORD = Some(password.to_string());
        }
        session.insert("logged_in", true)?;
        Ok(HttpResponse::Ok().json(serde_json::json!({"success": true})))
    } else {
        Ok(HttpResponse::BadRequest().json(serde_json::json!({"error": "Password required"})))
    }
}

async fn check_session(session: Session) -> Result<HttpResponse, Error> {
    if let Some(logged_in) = session.get::<bool>("logged_in")? {
        if logged_in {
            return Ok(HttpResponse::Ok().finish());
        }
    }
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

async fn get_nginx_logs_http(query: web::Query<std::collections::HashMap<String, String>>) -> Result<HttpResponse, Error> {
    let log_type = query.get("type").unwrap_or(&"access".to_string()).clone();
    let lines = query.get("lines").unwrap_or(&"100".to_string()).parse::<usize>().unwrap_or(100);
    
    // Common nginx log paths
    let log_path = match log_type.as_str() {
        "error" => vec![
            "/var/log/nginx/error.log",
            "/usr/local/var/log/nginx/error.log",
            "/var/log/nginx/error.log"
        ],
        "access" | _ => vec![
            "/var/log/nginx/access.log",
            "/usr/local/var/log/nginx/access.log", 
            "/var/log/nginx/access.log"
        ]
    };

    // Try to find the log file
    let mut actual_path = None;
    for path in &log_path {
        if std::path::Path::new(path).exists() {
            actual_path = Some(*path);
            break;
        }
    }

    if let Some(path) = actual_path {
        // Use tail to get the last N lines
        let output = Command::new("tail")
            .arg("-n")
            .arg(lines.to_string())
            .arg(path)
            .output()
            .map_err(|e| format!("Failed to read log file: {}", e));

        match output {
            Ok(output) if output.status.success() => {
                let logs_str = String::from_utf8_lossy(&output.stdout);
                let logs: Vec<String> = logs_str
                    .lines()
                    .filter(|line| !line.trim().is_empty())
                    .map(|s| s.to_string())
                    .collect();

                Ok(HttpResponse::Ok().json(serde_json::json!({
                    "logs": logs,
                    "type": log_type,
                    "path": path,
                    "count": logs.len()
                })))
            }
            Ok(output) => {
                let stderr = String::from_utf8_lossy(&output.stderr);
                Ok(HttpResponse::InternalServerError().json(serde_json::json!({
                    "error": format!("Failed to read log file: {}", stderr),
                    "path": path
                })))
            }
            Err(e) => {
                Ok(HttpResponse::InternalServerError().json(serde_json::json!({
                    "error": e,
                    "path": path
                })))
            }
        }
    } else {
        Ok(HttpResponse::NotFound().json(serde_json::json!({
            "error": "No nginx log files found at standard locations",
            "searched_paths": log_path
        })))
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
    
    println!("Starting Rustinx web server on http://0.0.0.0:8080");
    println!("Project root: {}", project_root.display());
    println!("Serving static files from: {}", dist_path.display());
    
    if !dist_path.exists() {
        eprintln!("ERROR: dist directory does not exist at {}", dist_path.display());
        eprintln!("Please run 'yarn run build' first to create the dist directory.");
        return Err(std::io::Error::new(std::io::ErrorKind::NotFound, "dist directory not found"));
    }
    
    let dist_str = dist_path.to_string_lossy().to_string();
    
    HttpServer::new(move || {
        App::new()
            .wrap(SessionMiddleware::new(
                CookieSessionStore::default(),
                Key::from(&[0; 64]),
            ))
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
                    .route("/nginx/logs", web::get().to(get_nginx_logs_http)),
            )
            .service(fs::Files::new("/", dist_str.clone()).index_file("index.html"))
    })
    .bind("0.0.0.0:8080")?
    .run()
    .await
}