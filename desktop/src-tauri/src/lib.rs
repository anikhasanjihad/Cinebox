#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // Native HTTP: provider sites are called from Rust, so browser CORS and
        // forbidden headers (User-Agent, Referer) do not apply.
        .plugin(tauri_plugin_http::init())
        // Downloads are written to the user's Downloads/Cinebox folder.
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .run(tauri::generate_context!())
        .expect("error while running Cinebox");
}
