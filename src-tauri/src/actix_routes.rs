use actix_session::Session;
use actix_web::{web, HttpResponse, Error};
use crate::commands;
use crate::auth::get_stored_password;
use std::process::Command;
use std::env::consts::OS;
use std::io::Write;
use std::process::Stdio;

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

pub fn configure(cfg: &mut web::ServiceConfig) {
    cfg.route("/session", web::get().to(check_session))
        .route("/system-metrics", web::get().to(get_system_metrics_http))
        .route("/nginx/start", web::post().to(start_nginx_http))
        .route("/nginx/stop", web::post().to(stop_nginx_http))
        .route("/nginx/restart", web::post().to(restart_nginx_http));
}