use std::time::Duration;

use tokio::time::interval;

use tauri;

use tauri::{AppHandle, Manager};

pub(crate) fn emit_event(app: AppHandle, data: &str, event_name: &str) {
    app.emit_all(event_name, data.to_string())
        .expect("failed to emit event");
}

#[tauri::command]
pub(crate) async fn start_emitting_events(app: AppHandle) {
    let mut interval = interval(Duration::from_secs(5));
    loop {
        interval.tick().await;
        emit_event(app.clone(), "This is a test event", "test_event");
    }
}
