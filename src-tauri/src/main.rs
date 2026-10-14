#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod navigation;

// The renderer never supplies a destination path. Only the native picker does.
#[tauri::command]
async fn save_document(window: tauri::WebviewWindow, name: String, content: String) -> Result<bool, String> {
    if window.label() != "main" || content.len() > 16_000_000 {
        return Err("Documento inválido ou maior que 16 MB.".into());
    }
    let (filename, extension) = match name.as_str() {
        "svg-design.svg" => ("svg-design.svg", "svg"),
        "svg-projeto.json" => ("svg-projeto.json", "json"),
        "meu-design.html" => ("meu-design.html", "html"),
        _ => return Err("Formato de exportação inválido.".into()),
    };
    let file = rfd::AsyncFileDialog::new()
        .set_file_name(filename)
        .add_filter("Documento", &[extension])
        .save_file().await;
    let Some(file) = file else { return Ok(false); };
    std::fs::write(file.path(), content).map_err(|e| format!("Não foi possível salvar: {e}"))?;
    Ok(true)
}

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            // The CLI injects its built-in server URL into this merged config.
            // Never enable this exception in an installed production build.
            let dev_url = if tauri::is_dev() {
                app.config().build.dev_url.clone()
            } else {
                None
            };
            tauri::WebviewWindowBuilder::from_config(app.handle(), &app.config().app.windows[0])?
                .on_navigation(move |url| navigation::allowed(url, dev_url.as_ref()))
                .on_new_window(|_, _| tauri::webview::NewWindowResponse::Deny)
                .enable_clipboard_access()
                .build()?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![save_document])
        .run(tauri::generate_context!())
        .expect("Não foi possível iniciar o SVG Editor Generator");
}
