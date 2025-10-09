
use actix_session::Session;
use actix_web::{web, Error, HttpResponse};
use serde::Deserialize;
use std::io::Write;
use std::process::{Command, Stdio};
use std::sync::{Arc, Mutex};
use std::collections::HashMap;

#[derive(Deserialize)]
pub struct LoginRequest {
    password: String,
}

// Global password storage for sudo operations
lazy_static::lazy_static! {
    static ref PASSWORD_STORE: Arc<Mutex<HashMap<String, String>>> = Arc::new(Mutex::new(HashMap::new()));
}

pub async fn login(session: Session, req: web::Json<LoginRequest>) -> Result<HttpResponse, Error> {
    // Test the sudo password by running a simple command
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

    if output.status.success() {
        // Store the password for future use
        if let Ok(mut store) = PASSWORD_STORE.lock() {
            store.insert("sudo_password".to_string(), req.password.clone());
        }
        
        session.insert("logged_in", true)?;
        Ok(HttpResponse::Ok().finish())
    } else {
        Ok(HttpResponse::Unauthorized().finish())
    }
}

pub async fn authenticated(session: Session) -> Result<HttpResponse, Error> {
    if let Some(logged_in) = session.get::<bool>("logged_in")? {
        if logged_in {
            return Ok(HttpResponse::Ok().finish());
        }
    }
    Ok(HttpResponse::Unauthorized().finish())
}

pub fn get_stored_password() -> Option<String> {
    if let Ok(store) = PASSWORD_STORE.lock() {
        store.get("sudo_password").cloned()
    } else {
        None
    }
}
