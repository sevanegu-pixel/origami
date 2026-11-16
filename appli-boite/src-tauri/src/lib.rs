// Appli Boîte mail : une fenêtre qui affiche la coquille locale (www/index.html).
// Chaque compte relié est une boîte à part (son moteur chez Google). Liens « boitemail://relier?c=… » : ajout d'un compte.
// Fichiers téléchargés (pièces jointes) : la coquille confie les octets à « enregistrer_fichier », qui les écrit dans le dossier
// choisi dans les Réglages (par défaut « Téléchargements ») ou à l'endroit choisi dans la fenêtre « Enregistrer sous ».
use base64::Engine;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use tauri::Manager;

/// Chemins écrits pendant cette séance : seuls ceux-là peuvent être montrés dans le Finder ou ouverts.
#[derive(Default)]
struct Enregistres(Mutex<Vec<String>>);

/// Nom de fichier sans rien qui puisse le faire sortir de son dossier.
fn nom_sur(nom: &str) -> String {
    let propre: String = nom
        .chars()
        .map(|c| if c == '/' || c == '\\' || c == ':' || c.is_control() { '-' } else { c })
        .collect();
    let propre = propre.trim().trim_start_matches('.').trim().to_string();
    if propre.is_empty() { "fichier".to_string() } else { propre.chars().take(180).collect() }
}

/// « Dossier.pdf » déjà là : « Dossier (2).pdf », « Dossier (3).pdf »…
fn chemin_libre(dossier: &Path, nom: &str) -> PathBuf {
    let premier = dossier.join(nom);
    if !premier.exists() {
        return premier;
    }
    let p = Path::new(nom);
    let base = p.file_stem().and_then(|s| s.to_str()).unwrap_or("fichier").to_string();
    let ext = p.extension().and_then(|s| s.to_str()).map(|e| format!(".{}", e)).unwrap_or_default();
    for n in 2..1000 {
        let essai = dossier.join(format!("{} ({}){}", base, n, ext));
        if !essai.exists() {
            return essai;
        }
    }
    premier
}

#[tauri::command]
fn dossier_telechargements(app: tauri::AppHandle) -> Result<String, String> {
    app.path().download_dir().map(|p| p.to_string_lossy().to_string()).map_err(|e| e.to_string())
}

/// Écrit un fichier téléchargé. `chemin` (choisi dans « Enregistrer sous ») l'emporte ; sinon `dossier` ; sinon « Téléchargements ».
#[tauri::command]
fn enregistrer_fichier(
    app: tauri::AppHandle,
    etat: tauri::State<'_, Enregistres>,
    nom: String,
    base64: String,
    dossier: Option<String>,
    chemin: Option<String>,
) -> Result<String, String> {
    let octets = base64::engine::general_purpose::STANDARD
        .decode(base64.as_bytes())
        .map_err(|_| "fichier illisible".to_string())?;
    let cible = match chemin.filter(|c| !c.trim().is_empty()) {
        Some(c) => PathBuf::from(c),
        None => {
            let d = match dossier.filter(|d| !d.trim().is_empty()) {
                Some(d) if Path::new(&d).is_dir() => PathBuf::from(d),
                _ => app.path().download_dir().map_err(|e| e.to_string())?,
            };
            chemin_libre(&d, &nom_sur(&nom))
        }
    };
    if !cible.is_absolute() {
        return Err("emplacement invalide".to_string());
    }
    std::fs::write(&cible, &octets).map_err(|e| e.to_string())?;
    let texte = cible.to_string_lossy().to_string();
    if let Ok(mut l) = etat.0.lock() {
        l.push(texte.clone());
        if l.len() > 200 {
            l.remove(0);
        }
    }
    Ok(texte)
}

fn connu(etat: &tauri::State<'_, Enregistres>, chemin: &str) -> bool {
    etat.0.lock().map(|l| l.iter().any(|x| x == chemin)).unwrap_or(false)
}

/// Montre dans le Finder un fichier que l'appli vient d'enregistrer.
#[tauri::command]
fn montrer_fichier(etat: tauri::State<'_, Enregistres>, chemin: String) -> Result<(), String> {
    if !connu(&etat, &chemin) {
        return Err("fichier inconnu".to_string());
    }
    std::process::Command::new("open").arg("-R").arg(&chemin).spawn().map(|_| ()).map_err(|e| e.to_string())
}

/// Ouvre (avec l'appli habituelle du Mac) un fichier que l'appli vient d'enregistrer.
#[tauri::command]
fn ouvrir_fichier(etat: tauri::State<'_, Enregistres>, chemin: String) -> Result<(), String> {
    if !connu(&etat, &chemin) {
        return Err("fichier inconnu".to_string());
    }
    std::process::Command::new("open").arg(&chemin).spawn().map(|_| ()).map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(Enregistres::default())
        .invoke_handler(tauri::generate_handler![dossier_telechargements, enregistrer_fichier, montrer_fichier, ouvrir_fichier])
        .run(tauri::generate_context!())
        .expect("Boîte mail n'a pas pu démarrer");
}
