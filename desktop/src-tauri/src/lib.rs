mod cast;

use tauri::async_runtime::spawn_blocking;

/// Finds TVs / speakers on the local network. Returns [name, controlUrl] pairs.
#[tauri::command]
async fn cast_discover() -> Result<Vec<(String, String)>, String> {
    spawn_blocking(|| cast::discover(3)).await.map_err(|e| e.to_string())?
}

#[tauri::command]
async fn cast_play(control: String, url: String, title: String) -> Result<(), String> {
    spawn_blocking(move || cast::play(&control, &url, &title)).await.map_err(|e| e.to_string())?
}

#[tauri::command]
async fn cast_stop(control: String) -> Result<(), String> {
    spawn_blocking(move || cast::stop(&control)).await.map_err(|e| e.to_string())?
}

#[tauri::command]
async fn cast_pause(control: String) -> Result<(), String> {
    spawn_blocking(move || cast::pause(&control)).await.map_err(|e| e.to_string())?
}

#[tauri::command]
async fn cast_resume(control: String) -> Result<(), String> {
    spawn_blocking(move || cast::resume(&control)).await.map_err(|e| e.to_string())?
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // Native HTTP: provider sites are called from Rust, so browser CORS and
        // forbidden headers (User-Agent, Referer) do not apply.
        .plugin(tauri_plugin_http::init())
        // Downloads are written to the user's Downloads/CineHub folder.
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![cast_discover, cast_play, cast_stop, cast_pause, cast_resume])
        .run(tauri::generate_context!())
        .expect("error while running CineHub");
}
