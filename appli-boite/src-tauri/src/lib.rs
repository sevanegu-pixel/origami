// Appli Boîte mail : une fenêtre qui affiche la coquille locale (www/index.html).
// Chaque compte relié est une boîte à part (son moteur chez Google). Liens « boitemail://relier?c=… » : ajout d'un compte.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_deep_link::init())
        .run(tauri::generate_context!())
        .expect("Boîte mail n'a pas pu démarrer");
}
