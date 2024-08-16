use log::{info, warn};
use std::process::Command;
use std::env::consts::OS;

#[tauri::command]
pub(crate) fn restart_nginx() -> Result<(), String> {
    let output = Command::new("systemctl")
        .arg("restart")
        .arg("nginx")
        .output()
        .map_err(|e| e.to_string())?;
    if output.status.success() {
        info!("Nginx restarted");
        Ok(())
    } else {
        warn!("Ngix NOT restarted");
        let stderr = String::from_utf8_lossy(&output.stderr);
        Err(format!("Failed to restart Nginx: {}", stderr))
    }
}

#[tauri::command]
pub(crate) fn start_nginx() -> Result<(), String> {
    let output = Command::new("systemctl")
        .arg("start")
        .arg("nginx")
        .output()
        .map_err(|e| e.to_string())?;
    if output.status.success() {
        info!("Nginx started");
        Ok(())
    } else {
        warn!("Ngix NOT started");
        let stderr = String::from_utf8_lossy(&output.stderr);
        Err(format!("Failed to start Nginx: {}", stderr))
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

#[tauri::command]
pub(crate) fn get_nginx_conf_path() -> Result<String, String> {
    let output = Command::new("sh")
        .arg("-c")
        .arg("nginx -t 2>&1 | grep -oP '(/[^ :]+\\.conf)' | head -n 1")
        .output()
        .map_err(|e| format!("Failed to execute command: {}", e))?;

    let output_str = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if output_str.is_empty() {
        Err("No configuration file found".into())
    } else {
        Ok(output_str)
    }
}

#[tauri::command]
pub(crate) fn open_file(file_path: String) -> Result<(), String> {
    // Determine the OS and set the appropriate command
    let result = match OS {
        "windows" => Command::new("cmd").arg("/C").arg("start").arg(&file_path).output(),
        "macos" => Command::new("open").arg(&file_path).output(),
        "linux" => Command::new("xdg-open").arg(&file_path).output(),
        _ => return Err("Unsupported OS".into()),
    };

    // Check the result of the command execution
    match result {
        Ok(output) => {
            if output.status.success() {
                Ok(())
            } else {
                Err(format!("Failed to open file: {}", String::from_utf8_lossy(&output.stderr)))
            }
        }
        Err(e) => Err(format!("Failed to execute command: {}", e)),
    }
}
