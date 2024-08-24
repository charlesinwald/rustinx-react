use log::{info, warn};
use sysinfo::System;
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
    // Run the `nginx -t` command to test the configuration and extract the path to the config file
    let output = Command::new("sh")
        .arg("-c")
        .arg("nginx -t 2>&1 | grep -Eo '(/[^ :]+\\.conf)' | head -n 1")
        .output()
        .map_err(|e| format!("Failed to execute command: {}", e))?;

    // Convert the output to a string and trim any whitespace
    let output_str = String::from_utf8_lossy(&output.stdout).trim().to_string();

    // Check if the output is empty, indicating that no configuration file path was found
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

#[tauri::command]
pub(crate) fn get_system_metrics() -> Result<(f32, u64, u64, usize, usize), String> {
    let mut sys = System::new_all();

    // Refresh system to get updated information
    sys.refresh_all();

    // Initialize variables to accumulate nginx-specific metrics
    let mut cpu_usage = 0.0;
    let mut used_memory = 0;
    let mut worker_count = 0;

    // Get the number of nginx processes (tasks/workers) and calculate their CPU and memory usage
    let num_tasks = sys.processes()
        .values()
        .filter(|process| {
            let name = process.name().to_string_lossy().to_ascii_lowercase();
            if name.contains("nginx") {
                cpu_usage += process.cpu_usage();
                used_memory += process.memory();

                // Check if it's a worker process
                if name.contains("worker process") {
                    worker_count += 1;
                }

                true
            } else {
                false
            }
        })
        .count();

    // Get total memory for the system
    let total_memory = sys.total_memory();

    Ok((cpu_usage, total_memory, used_memory, num_tasks, worker_count))
}

//     Ok((cpu_usage, total_memory, used_memory, num_tasks))
// 