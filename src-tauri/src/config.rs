use std::process::Command;
use std::fs::{File, create_dir_all};
use std::io::Write;

#[tauri::command]
pub(crate) fn get_nginx_version() -> Result<String, String> {
    let output = Command::new("nginx")
        .arg("-V")
        .output()
        .map_err(|e| format!("Failed to execute command: {}", e))?;

    if output.status.success() {
        let stderr = String::from_utf8(output.stderr).unwrap_or_default();
        Ok(stderr)
    } else {
        Err("Failed to get NGINX version.".to_string())
    }
}

#[tauri::command]
pub(crate) fn modify_nginx_service(custom_args: &str) -> Result<(), String> {
    let content = format!(
        "[Service]\nExecStart=\nExecStart=/usr/sbin/nginx -g 'pid /run/nginx.pid; error_log stderr; worker_processes auto;' -c /etc/nginx/nginx.conf {}\n",
        custom_args
    );

    let dir_path = "/etc/systemd/system/nginx.service.d";
    if let Err(e) = create_dir_all(dir_path) {
        return Err(format!("Failed to create directory {}: {}", dir_path, e));
    }

    let file_path = format!("{}/override.conf", dir_path);
    let mut file = File::create(&file_path)
        .map_err(|e| format!("Failed to create service override file: {}", e))?;
    
    file.write_all(content.as_bytes())
        .map_err(|e| format!("Failed to write to service override file: {}", e))?;

    std::process::Command::new("systemctl")
        .arg("daemon-reload")
        .status()
        .map_err(|e| format!("Failed to reload systemd: {}", e))?;

    std::process::Command::new("systemctl")
        .arg("restart")
        .arg("nginx")
        .status()
        .map_err(|e| format!("Failed to restart nginx: {}", e))?;

    Ok(())
}

#[tauri::command]
pub(crate) fn reload_and_restart_nginx_service() -> Result<(), String> {
    // Reload systemd
    Command::new("systemctl")
        .arg("daemon-reload")
        .status()
        .map_err(|e| format!("Failed to reload systemd: {}", e))?;

    // Restart Nginx
    Command::new("systemctl")
        .arg("restart")
        .arg("nginx")
        .status()
        .map_err(|e| format!("Failed to restart Nginx: {}", e))?;

    Ok(())
}