#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // Native HTTP: provider sites are called from Rust, so browser CORS and
        // forbidden headers (User-Agent, Referer) do not apply.
        .plugin(tauri_plugin_http::init())
        .run(tauri::generate_context!())
        .expect("error while running Cinebox");
}
