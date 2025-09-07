use actix_session::Session;
use actix_web::{web, HttpResponse, Error};
use crate::commands;

async fn check_session(session: Session) -> Result<HttpResponse, Error> {
    if let Some(logged_in) = session.get::<bool>("logged_in")? {
        if logged_in {
            return Ok(HttpResponse::Ok().finish());
        }
    }
    Ok(HttpResponse::Unauthorized().finish())
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

pub fn configure(cfg: &mut web::ServiceConfig) {
    cfg.route("/session", web::get().to(check_session))
        .route("/system-metrics", web::get().to(get_system_metrics_http));
}