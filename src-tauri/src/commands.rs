use log::{info, warn};
use std::process::Command;

#[tauri::command]
pub(crate) fn restart_nginx() -> Result<(), String> {
    warn!("Before nginx restart");
    let output = Command::new("systemctl")
        .arg("restart")
        .arg("nginx")
        .output()
        .map_err(|e| e.to_string())?;
    warn!("After nginx restart");
    if output.status.success() {
        print!("Nginx restarted");
        info!("Nginx restarted");
        Ok(())
    } else {
        print!("Nginx NOT restarted");
        warn!("Ngix NOT restarted");
        let stderr = String::from_utf8_lossy(&output.stderr);
        Err(format!("Failed to restart Nginx: {}", stderr))
    }
}

#[tauri::command]
pub(crate) fn stop_nginx() -> Result<(), String> {
    let output = Command::new("systemctl")
        .arg("stop")
        .arg("nginx")
        .output()
        .map_err(|e| e.to_string())?;
    if output.status.success() {
        print!("Nginx stopped");
        Ok(())
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr);
        Err(format!("Failed to stop Nginx: {}", stderr))
    }
}
