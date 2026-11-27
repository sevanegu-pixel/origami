const COMMANDS: &[&str] = &["configurer", "sonder"];

fn main() {
    tauri_plugin::Builder::new(COMMANDS).android_path("android").build();
}
