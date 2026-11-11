// Pas de fenêtre de console sous Windows en version finale.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    boite_mail_lib::run()
}
