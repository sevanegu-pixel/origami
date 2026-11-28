const COMMANDS: &[&str] = &["configurer", "sonder", "enregistrer", "ouvrir", "telechargements"];

fn main() {
    tauri_plugin::Builder::new(COMMANDS).android_path("android").build();
}
