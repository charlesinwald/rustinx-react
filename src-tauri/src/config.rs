use std::process::Command;

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
