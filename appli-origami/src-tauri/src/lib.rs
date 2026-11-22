// Appli Origami : une fenêtre qui affiche la page Origami en ligne (la même que dans le navigateur).
// La coquille ne contient aucune appli : elle ouvre la page, et les liens vers l'extérieur dans le navigateur du Mac.
//
// Depuis la version 0.3 (19.11.2026), l'appli mère Origami sait aussi :
// - installer les autres applis Origami sur ce Mac (télécharger leur fichier depuis les versions du dépôt Origami,
//   le copier dans Applications, l'ancienne version va à la Corbeille), puis les ouvrir ;
// - transmettre à une appli qu'elle ouvre un lien « Relier » à usage unique, pour que l'appli démarre déjà reliée ;
// - vivre dans la barre des menus (icône en haut de l'écran), démarrer avec la session, rester ouverte quand on ferme
//   sa fenêtre, et signaler un compte déconnecté.
// Compta, Tickets et Frais sont faites avec la même coquille : elles savent seulement lire le lien qu'on leur a transmis.
//
// Depuis la version 0.4 (22.11.2026), « Continuer avec Google » marche aussi dans l'appli. Google refuse sa fenêtre de
// connexion à l'intérieur d'une appli : l'appli ouvre donc le navigateur du Mac sur une page d'Origami, la personne y
// choisit son compte, et la page ramène la connexion ici par une passerelle qui n'existe que sur ce Mac (127.0.0.1),
// le temps de cette connexion, et qui n'accepte que le secret tiré pour elle. Rien ne passe par un autre serveur.

use serde::Serialize;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::Mutex;
use std::time::{Duration, SystemTime};
use tauri::menu::{CheckMenuItem, Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::TrayIconBuilder;
use tauri::{AppHandle, Emitter, Manager, RunEvent, WindowEvent};

mod pont;

const ORIGAMI: &str = "ch.origami.origami";
// Les seules applis que l'installateur connaît : id dans la page, nom affiché, identité Mac.
const APPLIS: &[(&str, &str, &str)] = &[
    ("origami", "Origami", "ch.origami.origami"),
    ("compta", "Compta", "ch.origami.compta"),
    ("tickets", "Tickets", "ch.origami.tickets"),
    ("frais", "Frais", "ch.origami.frais"),
    ("boite", "Boîte mail", "ch.origami.boitemail"),
];
// Les fichiers d'installation viennent uniquement des versions publiées du dépôt Origami.
const SOURCE_DMG: &str = "https://github.com/sevanegu-pixel/origami/releases/download/";
// Un lien « Relier » transmis ne peut mener qu'à la page Origami.
const PAGE: &str = "https://sevanegu-pixel.github.io/origami/accueil/";

#[derive(Default)]
struct Barre {
    alertes: Mutex<Vec<String>>,
    occupe: Mutex<bool>,
}

fn appli(id: &str) -> Result<&'static (&'static str, &'static str, &'static str), String> {
    APPLIS.iter().find(|a| a.0 == id).ok_or_else(|| "Appli inconnue.".to_string())
}

fn maison() -> PathBuf {
    std::env::var_os("HOME").map(PathBuf::from).unwrap_or_else(|| PathBuf::from("/tmp"))
}

fn dossiers_applis() -> Vec<PathBuf> {
    vec![PathBuf::from("/Applications"), maison().join("Applications")]
}

fn info_appli(chemin: &Path) -> Option<(String, String)> {
    let v = plist::Value::from_file(chemin.join("Contents/Info.plist")).ok()?;
    let d = v.as_dictionary()?;
    let id = d.get("CFBundleIdentifier")?.as_string()?.to_string();
    let version = d.get("CFBundleShortVersionString").and_then(|x| x.as_string()).unwrap_or("").to_string();
    Some((id, version))
}

// Cherche une appli par son identité dans Applications (celui du Mac, puis celui de la personne).
fn trouver(identite: &str) -> Option<(PathBuf, String)> {
    for d in dossiers_applis() {
        let Ok(entrees) = std::fs::read_dir(&d) else { continue };
        for e in entrees.flatten() {
            let p = e.path();
            if p.extension().map(|x| x == "app").unwrap_or(false) {
                if let Some((id, v)) = info_appli(&p) {
                    if id == identite {
                        return Some((p, v));
                    }
                }
            }
        }
    }
    None
}

#[derive(Serialize)]
struct AppliMac {
    id: String,
    nom: String,
    presente: bool,
    version: String,
    ouverte: bool,
}

fn ouverte(chemin: &Path) -> bool {
    let motif = format!("{}/Contents/MacOS/", chemin.display());
    Command::new("/usr/bin/pgrep").arg("-f").arg(&motif).output().map(|o| o.status.success()).unwrap_or(false)
}

#[tauri::command]
fn applis_mac() -> Vec<AppliMac> {
    APPLIS
        .iter()
        .map(|a| {
            let t = trouver(a.2);
            AppliMac {
                id: a.0.into(),
                nom: a.1.into(),
                presente: t.is_some(),
                version: t.as_ref().map(|x| x.1.clone()).unwrap_or_default(),
                ouverte: t.as_ref().map(|x| ouverte(&x.0)).unwrap_or(false),
            }
        })
        .collect()
}

#[derive(Serialize, Clone)]
struct Avancee {
    appli: String,
    etape: String,
    pct: u32,
    message: String,
}

fn avancer(app: &AppHandle, appli: &str, etape: &str, pct: u32, message: &str) {
    let _ = app.emit("origami-installation", Avancee { appli: appli.into(), etape: etape.into(), pct, message: message.into() });
}

fn telecharger(app: &AppHandle, appli: &str, url: &str, vers: &Path) -> Result<(), String> {
    use std::io::{Read, Write};
    let client = reqwest::blocking::Client::builder()
        .timeout(Duration::from_secs(900))
        .user_agent("Origami-Mac")
        .build()
        .map_err(|e| e.to_string())?;
    let mut r = client.get(url).send().map_err(|_| "Pas de connexion pour télécharger l'appli.".to_string())?;
    if !r.status().is_success() {
        return Err(format!("Le fichier de l'appli est introuvable ({}).", r.status().as_u16()));
    }
    let total = r.content_length().unwrap_or(0);
    let mut f = std::fs::File::create(vers).map_err(|e| e.to_string())?;
    let mut tampon = vec![0u8; 256 * 1024];
    let (mut lu, mut dernier) = (0u64, 0u32);
    loop {
        let n = r.read(&mut tampon).map_err(|_| "Le téléchargement s'est interrompu.".to_string())?;
        if n == 0 {
            break;
        }
        f.write_all(&tampon[..n]).map_err(|e| e.to_string())?;
        lu += n as u64;
        if total > 0 {
            let pct = ((lu * 100) / total).min(100) as u32;
            if pct >= dernier + 2 {
                dernier = pct;
                avancer(app, appli, "telechargement", pct, "Téléchargement…");
            }
        }
    }
    Ok(())
}

fn commande(prog: &str, args: &[&str]) -> Result<String, String> {
    let o = Command::new(prog).args(args).output().map_err(|e| e.to_string())?;
    if o.status.success() {
        Ok(String::from_utf8_lossy(&o.stdout).into_owned())
    } else {
        Err(String::from_utf8_lossy(&o.stderr).trim().to_string())
    }
}

fn a_la_corbeille(p: &Path) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        use trash::macos::{DeleteMethod, TrashContextExtMacos};
        let mut ctx = trash::TrashContext::default();
        ctx.set_delete_method(DeleteMethod::NsFileManager); // sans piloter le Finder : pas d'autorisation à demander
        ctx.delete(p).map_err(|e| e.to_string())
    }
    #[cfg(not(target_os = "macos"))]
    {
        trash::delete(p).map_err(|e| e.to_string())
    }
}

fn installer(app: &AppHandle, id: &str, url: &str) -> Result<String, String> {
    let a = appli(id)?;
    if !url.starts_with(SOURCE_DMG) || !url.ends_with(".dmg") || url.len() > 300 || url.contains("..") {
        return Err("Adresse du fichier refusée.".into());
    }
    let ancienne = trouver(a.2);
    if let Some((p, _)) = &ancienne {
        if a.2 != ORIGAMI && ouverte(p) {
            return Err(format!("Quitte d'abord {} (menu {} › Quitter), puis réessaie.", a.1, a.1));
        }
    }
    let travail = std::env::temp_dir().join(format!("origami-installation-{}", id));
    let _ = commande("/usr/bin/hdiutil", &["detach", "-force", &travail.join("disque").to_string_lossy()]);
    let _ = std::fs::remove_dir_all(&travail); // seulement les restes d'une installation précédente de cette appli
    std::fs::create_dir_all(&travail).map_err(|e| e.to_string())?;
    let dmg = travail.join("appli.dmg");
    let disque = travail.join("disque");
    avancer(app, id, "telechargement", 0, "Téléchargement…");
    let resultat = (|| -> Result<String, String> {
        telecharger(app, id, url, &dmg)?;
        avancer(app, id, "installation", 100, "Installation…");
        commande(
            "/usr/bin/hdiutil",
            &["attach", "-nobrowse", "-readonly", "-noautoopen", "-mountpoint", &disque.to_string_lossy(), &dmg.to_string_lossy()],
        )
        .map_err(|_| "Le fichier téléchargé ne s'ouvre pas.".to_string())?;
        let source = std::fs::read_dir(&disque)
            .map_err(|e| e.to_string())?
            .flatten()
            .map(|e| e.path())
            .find(|p| p.extension().map(|x| x == "app").unwrap_or(false) && info_appli(p).map(|i| i.0 == a.2).unwrap_or(false))
            .ok_or_else(|| "Ce fichier ne contient pas la bonne appli.".to_string())?;
        let nom = source.file_name().unwrap().to_owned();
        let dossier = match &ancienne {
            Some((p, _)) => p.parent().map(Path::to_path_buf).unwrap_or_else(|| PathBuf::from("/Applications")),
            None => PathBuf::from("/Applications"),
        };
        if let Some((p, _)) = &ancienne {
            a_la_corbeille(p).map_err(|_| format!("L'ancienne {} n'a pas pu aller à la Corbeille.", a.1))?;
        }
        let mut cible = dossier.join(&nom);
        if cible.exists() {
            return Err(format!("Une autre appli « {} » est déjà dans Applications.", nom.to_string_lossy()));
        }
        if commande("/usr/bin/ditto", &[&source.to_string_lossy(), &cible.to_string_lossy()]).is_err() {
            // Applications du Mac fermé à l'écriture : on installe dans le dossier Applications de la personne.
            let perso = maison().join("Applications");
            std::fs::create_dir_all(&perso).map_err(|e| e.to_string())?;
            cible = perso.join(&nom);
            commande("/usr/bin/ditto", &[&source.to_string_lossy(), &cible.to_string_lossy()])
                .map_err(|_| "L'appli n'a pas pu être copiée dans Applications.".to_string())?;
        }
        let version = info_appli(&cible).map(|i| i.1).unwrap_or_default();
        Ok(version)
    })();
    let _ = commande("/usr/bin/hdiutil", &["detach", "-force", &disque.to_string_lossy()]);
    let _ = std::fs::remove_dir_all(&travail); // le fichier téléchargé, devenu inutile
    match &resultat {
        Ok(v) => avancer(app, id, "fini", 100, &format!("Installée (version {}).", v)),
        Err(m) => avancer(app, id, "erreur", 0, m),
    }
    refaire_menu(app);
    resultat
}

#[tauri::command]
async fn installer_appli(app: AppHandle, appli: String, url: String) -> Result<String, String> {
    {
        let etat = app.state::<Barre>();
        let mut o = etat.occupe.lock().unwrap_or_else(|e| e.into_inner());
        if *o {
            return Err("Une installation est déjà en cours.".into());
        }
        *o = true;
    }
    // Rendu quoi qu'il arrive à l'installation (0.4.1) : une installation arrêtée net ne bloque plus les suivantes.
    let _garde = Liberer(app.clone());
    let a2 = app.clone();
    tauri::async_runtime::spawn_blocking(move || installer(&a2, &appli, &url)).await.map_err(|e| e.to_string())?
}

struct Liberer(AppHandle);
impl Drop for Liberer {
    fn drop(&mut self) {
        let etat = self.0.state::<Barre>();
        let mut o = etat.occupe.lock().unwrap_or_else(|e| e.into_inner());
        *o = false;
    }
}

// Les navigateurs qui savent ouvrir une adresse dans une fenêtre privée depuis une commande (Safari ne le sait pas).
const NAVIGATEURS_PRIVES: [(&str, &str, &str); 4] = [
    ("Google Chrome", "Google Chrome.app", "--incognito"),
    ("Brave", "Brave Browser.app", "--incognito"),
    ("Microsoft Edge", "Microsoft Edge.app", "--inprivate"),
    ("Firefox", "Firefox.app", "--private-window"),
];

// L'autorisation d'une appli Google Apps Script échoue quand plusieurs comptes Google sont connectés dans la même fenêtre
// (22.11, vu chez Sévane : « Impossible d'ouvrir le fichier »). Dans une fenêtre privée, un seul compte : ça passe.
// Seulement pour les pages de script.google.com. Rend le nom du navigateur ouvert.
#[tauri::command]
fn fenetre_privee(url: String) -> Result<String, String> {
    if !url.starts_with("https://script.google.com/") || url.len() > 700 || url.chars().any(|c| c.is_whitespace() || c.is_control() || c == '"' || c == '\'' || c == '\\') {
        return Err("Adresse refusée.".into());
    }
    for (nom, dossier, drapeau) in NAVIGATEURS_PRIVES.iter() {
        for d in dossiers_applis() {
            let chemin = d.join(dossier);
            if !chemin.exists() {
                continue;
            }
            let ok = Command::new("/usr/bin/open")
                .arg("-na")
                .arg(&chemin)
                .arg("--args")
                .arg(drapeau)
                .arg(&url)
                .status()
                .map(|s| s.success())
                .unwrap_or(false);
            if ok {
                return Ok(nom.to_string());
            }
        }
    }
    Err("aucun-navigateur".into())
}

// Origami se met à jour : la nouvelle version est déjà en place, on la relance.
#[tauri::command]
fn relancer_origami(app: AppHandle) {
    if let Some((p, _)) = trouver(ORIGAMI) {
        let _ = Command::new("/bin/sh").arg("-c").arg("sleep 1; /usr/bin/open \"$0\"").arg(&p).spawn();
    }
    app.exit(0);
}

// Montre l'appli dans le Finder (dossier Applications, appli sélectionnée).
#[tauri::command]
fn montrer_dans_finder(appli: String) -> Result<(), String> {
    let a = self::appli(&appli)?;
    let (chemin, _) = trouver(a.2).ok_or_else(|| format!("{} n'est pas installée sur ce Mac.", a.1))?;
    commande("/usr/bin/open", &["-R", &chemin.to_string_lossy()]).map(|_| ())
}

// Désinstaller : l'appli va à la Corbeille (on peut l'en sortir), ses réglages restent. Jamais Origami elle-même.
#[tauri::command]
fn desinstaller_appli(app: AppHandle, appli: String) -> Result<(), String> {
    let a = self::appli(&appli)?;
    if a.2 == ORIGAMI {
        return Err("Origami ne se désinstalle pas d'ici.".into());
    }
    let (chemin, _) = trouver(a.2).ok_or_else(|| format!("{} n'est pas installée sur ce Mac.", a.1))?;
    if ouverte(&chemin) {
        return Err(format!("Quitte d'abord {} (menu {} › Quitter), puis réessaie.", a.1, a.1));
    }
    a_la_corbeille(&chemin).map_err(|_| format!("{} n'a pas pu aller à la Corbeille.", a.1))?;
    refaire_menu(&app);
    Ok(())
}

fn dossier_liaison() -> PathBuf {
    maison().join("Library/Application Support/ch.origami.liaison")
}

// Ouvre une appli Origami installée ; avec un lien « Relier » à usage unique, l'appli le lit au démarrage.
#[tauri::command]
fn ouvrir_appli(appli: String, lien: Option<String>) -> Result<(), String> {
    let a = self::appli(&appli)?;
    let Some((chemin, _)) = trouver(a.2) else {
        return Err(format!("{} n'est pas installée sur ce Mac.", a.1));
    };
    if let Some(l) = lien {
        if !l.starts_with(PAGE) || l.len() > 4000 || l.contains(char::is_whitespace) {
            return Err("Lien refusé.".into());
        }
        let d = dossier_liaison();
        std::fs::create_dir_all(&d).map_err(|e| e.to_string())?;
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let _ = std::fs::set_permissions(&d, std::fs::Permissions::from_mode(0o700));
        }
        let f = d.join(format!("{}.lien", a.2));
        std::fs::write(&f, l.as_bytes()).map_err(|e| e.to_string())?;
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let _ = std::fs::set_permissions(&f, std::fs::Permissions::from_mode(0o600));
        }
    }
    commande("/usr/bin/open", &[&chemin.to_string_lossy()]).map(|_| ()).map_err(|_| format!("{} ne s'est pas ouverte.", a.1))
}

// Une appli lit (et efface) le lien qu'Origami lui a laissé en l'ouvrant, s'il a moins de dix minutes.
#[tauri::command]
fn lire_liaison(app: AppHandle) -> Option<String> {
    let f = dossier_liaison().join(format!("{}.lien", app.config().identifier));
    let recent = std::fs::metadata(&f)
        .and_then(|m| m.modified())
        .map(|t| SystemTime::now().duration_since(t).map(|d| d.as_secs() < 600).unwrap_or(true))
        .unwrap_or(false);
    let texte = std::fs::read_to_string(&f).ok();
    let _ = std::fs::remove_file(&f); // lien à usage unique : il ne reste pas sur le disque
    if recent {
        texte.filter(|l| l.starts_with(PAGE))
    } else {
        None
    }
}

// La page signale les comptes à revoir (déconnectés) : ils s'affichent en tête du menu de la barre.
#[tauri::command]
fn barre_alertes(app: AppHandle, alertes: Vec<String>) {
    let propres: Vec<String> = alertes.into_iter().take(6).map(|s| s.chars().take(80).collect()).collect();
    *app.state::<Barre>().alertes.lock().unwrap() = propres;
    refaire_menu(&app);
}

#[tauri::command]
fn demarrage_auto(app: AppHandle, actif: Option<bool>) -> bool {
    if app.config().identifier != ORIGAMI {
        return false;
    }
    use tauri_plugin_autostart::ManagerExt;
    let al = app.autolaunch();
    if let Some(a) = actif {
        let _ = if a { al.enable() } else { al.disable() };
        refaire_menu(&app);
    }
    al.is_enabled().unwrap_or(false)
}

// ---------- Passerelle « connexion à Google » (0.4) : voir pont.rs ----------
#[derive(Serialize)]
struct Pont {
    port: u16,
    secret: String,
    id: String,
}

#[derive(Serialize, Clone)]
struct PontJeton {
    pour: String,
    jeton: String,
    duree: u64,
    drive: bool,
}

// La page demande une passerelle avant d'ouvrir le navigateur : elle reçoit le port et le secret à lui confier.
#[tauri::command]
fn pont_google(app: AppHandle) -> Result<Pont, String> {
    let id = pont::hasard(8)?;
    let (a2, i2) = (app.clone(), id.clone());
    let (port, secret) = pont::ouvrir(move |r| {
        let _ = a2.emit("origami-pont", PontJeton { pour: i2.clone(), jeton: r.jeton, duree: r.duree, drive: r.drive });
        montrer_origami(&a2, None);
    })?;
    Ok(Pont { port, secret, id })
}

#[tauri::command]
fn pont_annuler() {
    pont::fermer();
}

fn montrer_origami(app: &AppHandle, vue: Option<&str>) {
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.show();
        let _ = w.unminimize();
        let _ = w.set_focus();
        if let Some(v) = vue {
            let _ = w.emit("origami-aller", v);
        }
    }
}

fn refaire_menu(app: &AppHandle) {
    if app.config().identifier != ORIGAMI {
        return;
    }
    let Some(tray) = app.tray_by_id("origami") else { return };
    if let Ok(m) = construire_menu(app) {
        let _ = tray.set_menu(Some(m));
    }
    let n = app.state::<Barre>().alertes.lock().unwrap().len();
    let _ = tray.set_tooltip(Some(if n > 0 { "Origami · un compte à revoir" } else { "Origami" }));
    #[cfg(target_os = "macos")]
    let _ = tray.set_title(if n > 0 { Some("!") } else { None::<&str> });
}

fn construire_menu(app: &AppHandle) -> tauri::Result<Menu<tauri::Wry>> {
    let m = Menu::new(app)?;
    let alertes = app.state::<Barre>().alertes.lock().unwrap().clone();
    for (i, t) in alertes.iter().enumerate() {
        m.append(&MenuItem::with_id(app, format!("alerte-{}", i), format!("⚠︎ {}", t), true, None::<&str>)?)?;
    }
    if !alertes.is_empty() {
        m.append(&PredefinedMenuItem::separator(app)?)?;
    }
    m.append(&MenuItem::with_id(app, "ouvrir-origami", "Ouvrir Origami", true, None::<&str>)?)?;
    m.append(&PredefinedMenuItem::separator(app)?)?;
    for a in APPLIS.iter().filter(|a| a.2 != ORIGAMI) {
        let la = if trouver(a.2).is_some() { a.1.to_string() } else { format!("{} (à installer)", a.1) };
        m.append(&MenuItem::with_id(app, format!("appli-{}", a.0), la, true, None::<&str>)?)?;
    }
    m.append(&PredefinedMenuItem::separator(app)?)?;
    m.append(&MenuItem::with_id(app, "applis", "Installer des applis…", true, None::<&str>)?)?;
    let auto = {
        use tauri_plugin_autostart::ManagerExt;
        app.autolaunch().is_enabled().unwrap_or(false)
    };
    m.append(&CheckMenuItem::with_id(app, "demarrage", "Ouvrir au démarrage du Mac", true, auto, None::<&str>)?)?;
    m.append(&PredefinedMenuItem::separator(app)?)?;
    m.append(&MenuItem::with_id(app, "quitter", "Quitter Origami", true, None::<&str>)?)?;
    Ok(m)
}

fn menu_choisi(app: &AppHandle, id: &str) {
    match id {
        "ouvrir-origami" => montrer_origami(app, None),
        "applis" => montrer_origami(app, Some("applis")),
        "quitter" => app.exit(0),
        "demarrage" => {
            use tauri_plugin_autostart::ManagerExt;
            let al = app.autolaunch();
            let _ = if al.is_enabled().unwrap_or(false) { al.disable() } else { al.enable() };
            refaire_menu(app);
        }
        _ if id.starts_with("alerte-") => montrer_origami(app, Some("reglages")),
        _ if id.starts_with("appli-") => {
            let a = &id[6..];
            if let Ok(x) = appli(a) {
                if trouver(x.2).is_some() {
                    let _ = ouvrir_appli(a.to_string(), None);
                } else {
                    montrer_origami(app, Some("applis"));
                }
            }
        }
        _ => {}
    }
}

// 22.11 : sur un Mac réglé sur « Toujours afficher les barres de défilement », la page d'une appli (la Compta surtout)
// gardait une bande au bord droit de la fenêtre : la place de la barre, d'une autre couleur que l'apparence choisie.
// Vu chez Sévane : avec ce réglage posé pour l'appli seule, la bande disparaît. L'appli demande donc, pour elle seule,
// des barres qui n'apparaissent qu'en défilant ; le réglage du Mac ne change pas pour les autres applis.
// Écrit avant que la fenêtre existe : valable dès ce lancement.
fn barres_discretes(identifiant: &str) {
    if cfg!(target_os = "macos") {
        let _ = std::process::Command::new("/usr/bin/defaults")
            .args(["write", identifiant, "AppleShowScrollBars", "-string", "WhenScrolling"])
            .status();
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let contexte = tauri::generate_context!();
    barres_discretes(&contexte.config().identifier);
    let est_origami = contexte.config().identifier == ORIGAMI;
    let mut b = tauri::Builder::default().plugin(tauri_plugin_opener::init()).manage(Barre::default());
    if est_origami {
        b = b.plugin(tauri_plugin_autostart::init(tauri_plugin_autostart::MacosLauncher::LaunchAgent, Some(vec!["--barre"])));
    }
    let appli = b
        .invoke_handler(tauri::generate_handler![
            applis_mac,
            installer_appli,
            relancer_origami,
            ouvrir_appli,
            lire_liaison,
            montrer_dans_finder,
            desinstaller_appli,
            barre_alertes,
            demarrage_auto,
            pont_google,
            pont_annuler,
            fenetre_privee
        ])
        .setup(move |app| {
            // La fenêtre part cachée (réglage) et s'affiche ici, sauf pour Origami ouverte au démarrage de la session :
            // alors seulement l'icône dans la barre des menus.
            let cachee = est_origami && std::env::args().any(|a| a == "--barre");
            if !cachee {
                if let Some(w) = app.get_webview_window("main") {
                    let _ = w.show();
                }
            }
            if !est_origami {
                return Ok(());
            }
            let h = app.handle().clone();
            // Première ouverture : Origami démarre avec la session (on peut l'enlever dans le menu de la barre).
            let repere = app.path().app_data_dir().map(|d| d.join("demarrage-regle")).ok();
            if let Some(r) = repere {
                if !r.exists() {
                    use tauri_plugin_autostart::ManagerExt;
                    let _ = h.autolaunch().enable();
                    let _ = std::fs::create_dir_all(r.parent().unwrap());
                    let _ = std::fs::write(&r, b"1");
                }
            }
            let menu = construire_menu(&h)?;
            TrayIconBuilder::with_id("origami")
                .icon(tauri::image::Image::from_bytes(include_bytes!("../barre/barre.png"))?)
                .icon_as_template(true)
                .tooltip("Origami")
                .menu(&menu)
                .show_menu_on_left_click(true)
                .on_menu_event(|app, ev| menu_choisi(app, ev.id().as_ref()))
                .build(app)?;
            Ok(())
        })
        .on_window_event(move |w, ev| {
            // Fermer la fenêtre d'Origami la cache : Origami reste dans la barre des menus.
            if let WindowEvent::CloseRequested { api, .. } = ev {
                if est_origami && w.label() == "main" {
                    let _ = w.hide();
                    api.prevent_close();
                }
            }
        })
        .build(contexte)
        .expect("Origami n'a pas pu démarrer");
    appli.run(move |app, ev| {
        #[cfg(target_os = "macos")]
        if let RunEvent::Reopen { .. } = ev {
            if est_origami {
                montrer_origami(app, None);
            }
        }
        let _ = (app, ev);
    });
}
