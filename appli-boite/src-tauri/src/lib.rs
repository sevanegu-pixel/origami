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

/* ---------- Écran de chaque boîte gardé sur ce Mac (version 22) ----------
   La coquille confie l'écran d'un compte (page HTML venue de son moteur) ; il est servi à l'adresse boite://<compte>/,
   une origine par compte (chacun garde sa propre mémoire), sans passer par Google à l'ouverture. */
fn compte_sur(c: &str) -> bool {
    !c.is_empty() && c.len() <= 40 && c.chars().all(|x| x.is_ascii_lowercase() || x.is_ascii_digit())
}

fn dossier_ecrans<R: tauri::Runtime>(app: &tauri::AppHandle<R>) -> Result<PathBuf, String> {
    let d = app.path().app_data_dir().map_err(|e| e.to_string())?.join("ecrans");
    std::fs::create_dir_all(&d).map_err(|e| e.to_string())?;
    Ok(d)
}

#[tauri::command]
fn ecran_garder(app: tauri::AppHandle, compte: String, html: String) -> Result<(), String> {
    if !compte_sur(&compte) || html.len() > 30_000_000 {
        return Err("écran refusé".to_string());
    }
    let d = dossier_ecrans(&app)?;
    let provisoire = d.join(format!("{}.tmp", compte));
    std::fs::write(&provisoire, html.as_bytes()).map_err(|e| e.to_string())?;
    std::fs::rename(&provisoire, d.join(format!("{}.html", compte))).map_err(|e| e.to_string())
}

/// « Imprimer » un mail (24.11) : la page à imprimer est gardée comme un écran (« impression »), ouverte dans une petite fenêtre
/// de l'appli, puis la fenêtre d'impression du Mac s'ouvre dès que la page est chargée.
#[tauri::command]
async fn imprimer(app: tauri::AppHandle, html: String, titre: String) -> Result<(), String> {
    if html.len() > 30_000_000 {
        return Err("mail trop lourd pour l'impression".to_string());
    }
    let d = dossier_ecrans(&app)?;
    std::fs::write(d.join("impression.html"), html.as_bytes()).map_err(|e| e.to_string())?;
    let ms = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|x| x.as_millis()).unwrap_or(0);
    let url = tauri::Url::parse("boite://impression/index.html").map_err(|e| e.to_string())?;
    let titre: String = titre.chars().take(120).collect();
    tauri::WebviewWindowBuilder::new(&app, format!("impression-{}", ms), tauri::WebviewUrl::CustomProtocol(url))
        .title(if titre.is_empty() { "Imprimer".to_string() } else { titre })
        .inner_size(820.0, 900.0)
        .on_page_load(|w, p| {
            if matches!(p.event(), tauri::webview::PageLoadEvent::Finished) {
                let _ = w.print();
            }
        })
        .build()
        .map(|_| ())
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn ecran_oublier(app: tauri::AppHandle, compte: String) -> Result<(), String> {
    if !compte_sur(&compte) {
        return Err("compte inconnu".to_string());
    }
    let d = dossier_ecrans(&app)?;
    let _ = std::fs::remove_file(d.join(format!("{}.html", compte)));
    Ok(())
}

// Fenêtre privée (27.11) : la copie du modèle s'ouvrait sur le compte Google déjà connecté dans le navigateur
// (« authuser » ne suffit pas, vu chez Sévane). Dans une fenêtre privée, seul le compte voulu est connecté.
// Seulement les pages Google utiles. Rend le nom du navigateur ouvert. Safari ne sait pas le faire par commande.
const NAVIGATEURS_PRIVES: [(&str, &str, &str); 4] = [
    ("Google Chrome", "Google Chrome.app", "--incognito"),
    ("Brave", "Brave Browser.app", "--incognito"),
    ("Microsoft Edge", "Microsoft Edge.app", "--inprivate"),
    ("Firefox", "Firefox.app", "--private-window"),
];

#[tauri::command]
fn fenetre_privee(url: String) -> Result<String, String> {
    let permis = ["https://accounts.google.com/", "https://docs.google.com/", "https://script.google.com/"];
    if !permis.iter().any(|d| url.starts_with(d)) || url.len() > 900 || url.chars().any(|c| c.is_whitespace() || c.is_control() || c == '"' || c == '\'' || c == '\\') {
        return Err("Adresse refusée.".into());
    }
    let mut dossiers = vec![std::path::PathBuf::from("/Applications")];
    if let Some(m) = std::env::var_os("HOME") {
        dossiers.push(std::path::PathBuf::from(m).join("Applications"));
    }
    for (nom, dossier, drapeau) in NAVIGATEURS_PRIVES.iter() {
        for d in dossiers.iter() {
            let chemin = d.join(dossier);
            if !chemin.exists() {
                continue;
            }
            let ok = std::process::Command::new("/usr/bin/open")
                .arg("-na").arg(&chemin).arg("--args").arg(drapeau).arg(&url)
                .status().map(|s| s.success()).unwrap_or(false);
            if ok {
                return Ok(nom.to_string());
            }
        }
    }
    Err("aucun-navigateur".into())
}

fn reponse(code: u16, sorte: &str, corps: Vec<u8>) -> tauri::http::Response<Vec<u8>> {
    tauri::http::Response::builder()
        .status(code)
        .header("Content-Type", sorte)
        .header("Cache-Control", "no-store")
        .body(corps)
        .unwrap_or_else(|_| tauri::http::Response::new(Vec::new()))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .manage(Enregistres::default())
        .register_uri_scheme_protocol("boite", |ctx, requete| {
            let compte = requete.uri().host().unwrap_or("").to_ascii_lowercase();
            let chemin = requete.uri().path().to_string();
            if !compte_sur(&compte) || !(chemin == "/" || chemin == "/index.html") {
                return reponse(404, "text/plain; charset=utf-8", b"introuvable".to_vec());
            }
            match dossier_ecrans(ctx.app_handle()).and_then(|d| std::fs::read(d.join(format!("{}.html", compte))).map_err(|e| e.to_string())) {
                Ok(octets) => reponse(200, "text/html; charset=utf-8", octets),
                Err(_) => reponse(404, "text/plain; charset=utf-8", b"pas encore garde".to_vec()),
            }
        })
        .invoke_handler(tauri::generate_handler![dossier_telechargements, enregistrer_fichier, montrer_fichier, ouvrir_fichier, ecran_garder, ecran_oublier, imprimer, fenetre_privee])
        .run(tauri::generate_context!())
        .expect("Boîte mail n'a pas pu démarrer");
}
