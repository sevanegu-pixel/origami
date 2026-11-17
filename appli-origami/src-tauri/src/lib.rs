// Appli Origami : une fenêtre qui affiche la page Origami en ligne (la même que dans le navigateur).
// La coquille ne contient aucune appli : elle ouvre la page, et les liens vers l'extérieur dans le navigateur du Mac.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .run(tauri::generate_context!())
        .expect("Origami n'a pas pu démarrer");
}
