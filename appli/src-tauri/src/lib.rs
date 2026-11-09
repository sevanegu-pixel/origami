// Appli Diffusion : une fenêtre qui affiche la coquille locale (www/index.html).
// L'écran de Diffusion vient du serveur et parle au serveur directement ; la coquille ne fait qu'ouvrir les liens dans le navigateur.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .run(tauri::generate_context!())
        .expect("Diffusion n'a pas pu démarrer");
}
