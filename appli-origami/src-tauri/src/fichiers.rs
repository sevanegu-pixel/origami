// Fichiers d'Origami gardés sur ce Mac (0.5, 25.11.2026).
//
// La page Origami garde ici, dans un vrai dossier du Finder (Documents › Origami › Fichiers, ou celui que la personne
// choisit), les fichiers de ses spectacles : un dossier par compte, puis par spectacle. Tout ce que fait ce module reste
// DANS ce dossier : un chemin donné par la page est toujours relatif, sans « .. », et vérifié une seconde fois sur le
// disque (un lien symbolique ne permet pas d'en sortir). Rien n'est jamais effacé pour de bon : « retirer » met à la
// Corbeille (fait par lib.rs). Ce fichier ne dépend pas de Tauri : il s'essaie seul (cargo test, ou rustc --test).

use std::fs;
use std::io::{Read, Seek, SeekFrom, Write};
use std::path::{Path, PathBuf};

/// Un morceau reçu de la page : 12 Mo de texte au plus (9 Mo de fichier).
pub const MORCEAU_MAX: usize = 12 * 1024 * 1024;
/// Une lecture rendue à la page : 3 Mo de fichier au plus.
pub const LECTURE_MAX: u64 = 3 * 1024 * 1024;
const MARQUE_PARTIEL: &str = ".origami-en-cours";

/// Ce que « Ouvrir » confie à l'appli habituelle du Mac : des documents, jamais un programme.
const OUVRABLES: &[&str] = &[
    "pdf", "jpg", "jpeg", "png", "gif", "webp", "heic", "tif", "tiff", "bmp", "mp4", "mov", "m4v", "avi", "mkv", "mp3", "wav", "m4a", "aac", "aiff",
    "flac", "ogg", "doc", "docx", "odt", "rtf", "txt", "md", "pages", "xls", "xlsx", "ods", "csv", "numbers", "ppt", "pptx", "odp", "key", "zip",
];

pub fn dossier_par_defaut(maison: &Path) -> PathBuf {
    maison.join("Documents").join("Origami").join("Fichiers")
}

/// Le dossier choisi (noté dans un petit fichier de réglage), sinon Documents › Origami › Fichiers.
pub fn racine(reglage: &Path, maison: &Path) -> PathBuf {
    match fs::read_to_string(reglage) {
        Ok(t) => {
            let t = t.trim();
            if t.starts_with('/') && !t.contains('\0') {
                PathBuf::from(t)
            } else {
                dossier_par_defaut(maison)
            }
        }
        Err(_) => dossier_par_defaut(maison),
    }
}

pub fn noter_racine(reglage: &Path, dossier: &Path) -> Result<(), String> {
    if let Some(p) = reglage.parent() {
        fs::create_dir_all(p).map_err(|e| e.to_string())?;
    }
    fs::write(reglage, dossier.to_string_lossy().as_bytes()).map_err(|e| e.to_string())
}

/// « Documents › Origami › Fichiers » : le chemin tel qu'on le lit dans le Finder.
pub fn affichage(dossier: &Path, maison: &Path) -> String {
    let base = dossier.strip_prefix(maison).unwrap_or(dossier);
    let morceaux: Vec<String> = base
        .components()
        .filter_map(|c| match c {
            std::path::Component::Normal(n) => Some(n.to_string_lossy().into_owned()),
            _ => None,
        })
        .collect();
    morceaux.join(" \u{203a} ")
}

fn morceau_sur(m: &str) -> bool {
    !m.is_empty()
        && m.len() <= 240
        && m != "."
        && m != ".."
        && !m.starts_with('.')
        && !m.contains('/')
        && !m.contains('\\')
        && !m.contains('\0')
        && !m.contains(':')
        && !m.chars().any(|c| c.is_control())
        && !m.to_lowercase().ends_with(".app")
        && !m.ends_with(MARQUE_PARTIEL)
}

/// Chemin relatif donné par la page (« compte/spectacle/fichier.pdf ») → chemin sur le disque, dans la racine seulement.
pub fn chemin_sur(racine: &Path, relatif: &str) -> Result<PathBuf, String> {
    let morceaux: Vec<&str> = relatif.split('/').collect();
    if morceaux.is_empty() || morceaux.len() > 4 || !morceaux.iter().all(|m| morceau_sur(m)) {
        return Err("Chemin de fichier refusé.".into());
    }
    let mut p = racine.to_path_buf();
    for m in morceaux {
        p.push(m);
    }
    Ok(p)
}

/// Le dossier qui contient vraiment `p` est-il dans la racine ? (un lien symbolique posé là ne fait pas sortir)
fn dedans(racine: &Path, p: &Path) -> Result<(), String> {
    let r = fs::canonicalize(racine).map_err(|e| e.to_string())?;
    let parent = p.parent().ok_or("Chemin de fichier refusé.")?;
    let c = fs::canonicalize(parent).map_err(|e| e.to_string())?;
    if !c.starts_with(&r) {
        return Err("Chemin de fichier refusé.".into());
    }
    if let Ok(m) = fs::symlink_metadata(p) {
        if m.file_type().is_symlink() {
            return Err("Chemin de fichier refusé.".into());
        }
    }
    Ok(())
}

fn partiel(cible: &Path) -> PathBuf {
    let nom = cible.file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_default();
    cible.with_file_name(format!(".{}{}", nom, MARQUE_PARTIEL))
}

/// Taille de chaque fichier demandé, ou rien s'il n'est pas (ou plus) là.
pub fn etat(racine: &Path, relatifs: &[String]) -> Vec<Option<u64>> {
    relatifs
        .iter()
        .map(|r| {
            let p = chemin_sur(racine, r).ok()?;
            let m = fs::symlink_metadata(&p).ok()?;
            if m.is_file() {
                Some(m.len())
            } else {
                None
            }
        })
        .collect()
}

/// Reçoit un fichier morceau par morceau. `debut` doit être la taille déjà reçue ; au dernier morceau (`fin`), le fichier
/// prend son vrai nom. Tant qu'il n'est pas entier, il porte un nom caché : le Finder ne montre jamais un fichier coupé.
pub fn ecrire(racine: &Path, relatif: &str, base64: &str, debut: u64, fin: bool) -> Result<u64, String> {
    if base64.len() > MORCEAU_MAX {
        return Err("Morceau trop lourd.".into());
    }
    let cible = chemin_sur(racine, relatif)?;
    let parent = cible.parent().ok_or("Chemin de fichier refusé.")?;
    fs::create_dir_all(parent).map_err(|e| format!("Le dossier n'a pas pu être créé : {}", e))?;
    dedans(racine, &cible)?;
    let octets = decoder(base64)?;
    let tmp = partiel(&cible);
    let mut f = if debut == 0 {
        fs::File::create(&tmp).map_err(|e| e.to_string())?
    } else {
        let deja = fs::metadata(&tmp).map(|m| m.len()).unwrap_or(0);
        if deja != debut {
            let _ = fs::remove_file(&tmp); // seulement le fichier de travail caché, jamais un fichier de la personne
            return Err("REPRENDRE".into());
        }
        fs::OpenOptions::new().append(true).open(&tmp).map_err(|e| e.to_string())?
    };
    f.write_all(&octets).map_err(|e| e.to_string())?;
    f.flush().map_err(|e| e.to_string())?;
    drop(f);
    let total = debut + octets.len() as u64;
    if fin {
        fs::rename(&tmp, &cible).map_err(|e| e.to_string())?;
    }
    Ok(total)
}

/// Les fichiers d'un dossier de la racine (nom, poids), sans les fichiers cachés ni les sous-dossiers : pour suivre un fichier
/// renommé à la main dans le Finder (28.11). Un dossier absent rend une liste vide.
pub fn lister(racine: &Path, relatif: &str) -> Result<Vec<(String, u64)>, String> {
    let rel = relatif.trim_end_matches('/');
    if rel.is_empty() {
        return Err("Chemin de dossier refusé.".into());
    }
    let d = chemin_sur(racine, rel)?;
    let mut l = Vec::new();
    if !d.is_dir() {
        return Ok(l);
    }
    dedans(racine, &d)?;
    let entrees = match fs::read_dir(&d) {
        Ok(e) => e,
        Err(_) => return Ok(l),
    };
    for e in entrees.flatten() {
        let nom = e.file_name().to_string_lossy().into_owned();
        if nom.starts_with('.') {
            continue;
        }
        if let Ok(m) = fs::symlink_metadata(e.path()) {
            if m.is_file() {
                l.push((nom, m.len()));
            }
        }
        if l.len() >= 2000 {
            break;
        }
    }
    Ok(l)
}

/// Un morceau d'un fichier gardé, pour l'aperçu dans l'appli : (texte base64, taille du fichier entier).
pub fn lire(racine: &Path, relatif: &str, debut: u64, longueur: u64) -> Result<(String, u64), String> {
    let p = chemin_sur(racine, relatif)?;
    dedans(racine, &p)?;
    let mut f = fs::File::open(&p).map_err(|_| "Ce fichier n'est plus sur ce Mac.".to_string())?;
    let taille = f.metadata().map_err(|e| e.to_string())?.len();
    if debut > taille {
        return Err("Lecture hors du fichier.".into());
    }
    let n = longueur.min(LECTURE_MAX).min(taille - debut) as usize;
    let mut tampon = vec![0u8; n];
    f.seek(SeekFrom::Start(debut)).map_err(|e| e.to_string())?;
    f.read_exact(&mut tampon).map_err(|e| e.to_string())?;
    Ok((encoder(&tampon), taille))
}

/// Le fichier existe, il est dans la racine : rend son chemin (pour le montrer dans le Finder, le copier, le retirer).
pub fn present(racine: &Path, relatif: &str) -> Result<PathBuf, String> {
    let p = chemin_sur(racine, relatif)?;
    dedans(racine, &p).map_err(|_| "Ce fichier n'est plus sur ce Mac.".to_string())?;
    match fs::symlink_metadata(&p) {
        Ok(m) if m.is_file() => Ok(p),
        _ => Err("Ce fichier n'est plus sur ce Mac.".into()),
    }
}

pub fn ouvrable(p: &Path) -> bool {
    match p.extension() {
        Some(e) => {
            let e = e.to_string_lossy().to_lowercase();
            OUVRABLES.iter().any(|x| *x == e)
        }
        None => false,
    }
}

/// Range un fichier gardé sous un autre nom ou dans un autre dossier de la racine (spectacle renommé…). Ne remplace rien.
pub fn deplacer(racine: &Path, de: &str, vers: &str) -> Result<(), String> {
    let a = present(racine, de)?;
    let b = chemin_sur(racine, vers)?;
    let parent = b.parent().ok_or("Chemin de fichier refusé.")?;
    fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    dedans(racine, &b)?;
    if fs::symlink_metadata(&b).is_ok() {
        return Err("Un fichier porte déjà ce nom.".into());
    }
    fs::rename(&a, &b).map_err(|e| e.to_string())
}

/// Après un changement de dossier : ce qui était gardé suit, quand c'est possible (même disque, pas de dossier du même
/// nom à l'arrivée). Rend (déplacés, restés dans l'ancien dossier).
pub fn suivre(ancienne: &Path, nouvelle: &Path) -> (u32, u32) {
    let (mut ok, mut restes) = (0u32, 0u32);
    let lus = match fs::read_dir(ancienne) {
        Ok(l) => l,
        Err(_) => return (0, 0),
    };
    for e in lus.flatten() {
        let nom = e.file_name();
        if nom.to_string_lossy().starts_with('.') {
            continue;
        }
        let vers = nouvelle.join(&nom);
        if fs::symlink_metadata(&vers).is_ok() || fs::rename(e.path(), &vers).is_err() {
            restes += 1;
        } else {
            ok += 1;
        }
    }
    (ok, restes)
}

/// Après un retrait : les dossiers restés vides s'en vont aussi (jamais la racine, jamais un dossier qui contient quelque chose).
pub fn ranger_vides(racine: &Path, relatif: &str) {
    if let Ok(p) = chemin_sur(racine, relatif) {
        let mut d = p.parent().map(|x| x.to_path_buf());
        while let Some(x) = d {
            if x == racine || !x.starts_with(racine) || fs::remove_dir(&x).is_err() {
                break;
            }
            d = x.parent().map(|y| y.to_path_buf());
        }
    }
}

// ---------- base64 (sans dépendance) ----------
const ALPHABET: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

pub fn encoder(octets: &[u8]) -> String {
    let mut s = String::with_capacity((octets.len() + 2) / 3 * 4);
    for b in octets.chunks(3) {
        let n = (b[0] as u32) << 16 | (*b.get(1).unwrap_or(&0) as u32) << 8 | *b.get(2).unwrap_or(&0) as u32;
        s.push(ALPHABET[(n >> 18) as usize & 63] as char);
        s.push(ALPHABET[(n >> 12) as usize & 63] as char);
        s.push(if b.len() > 1 { ALPHABET[(n >> 6) as usize & 63] as char } else { '=' });
        s.push(if b.len() > 2 { ALPHABET[n as usize & 63] as char } else { '=' });
    }
    s
}

pub fn decoder(texte: &str) -> Result<Vec<u8>, String> {
    let mut sortie = Vec::with_capacity(texte.len() / 4 * 3);
    let (mut n, mut bits) = (0u32, 0u32);
    for c in texte.bytes() {
        let v = match c {
            b'A'..=b'Z' => c - b'A',
            b'a'..=b'z' => c - b'a' + 26,
            b'0'..=b'9' => c - b'0' + 52,
            b'+' | b'-' => 62,
            b'/' | b'_' => 63,
            b'=' | b'\n' | b'\r' => continue,
            _ => return Err("Morceau illisible.".into()),
        };
        n = n << 6 | v as u32;
        bits += 6;
        if bits >= 8 {
            bits -= 8;
            sortie.push((n >> bits) as u8);
            n &= (1 << bits) - 1;
        }
    }
    Ok(sortie)
}

#[cfg(test)]
mod essais {
    use super::*;

    fn atelier(nom: &str) -> PathBuf {
        let d = std::env::temp_dir().join(format!("origami-fichiers-{}-{}", nom, std::process::id()));
        let _ = fs::remove_dir_all(&d);
        fs::create_dir_all(&d).unwrap();
        d
    }

    #[test]
    fn base64_aller_retour() {
        for n in 0..70usize {
            let o: Vec<u8> = (0..n).map(|i| (i * 37 % 256) as u8).collect();
            assert_eq!(decoder(&encoder(&o)).unwrap(), o);
        }
        assert_eq!(encoder(b"Origami"), "T3JpZ2FtaQ==");
        assert_eq!(decoder("T3JpZ2FtaQ==").unwrap(), b"Origami");
        assert!(decoder("T3J*").is_err());
    }

    #[test]
    fn chemins_refuses() {
        let r = Path::new("/tmp/racine");
        for mauvais in ["", "..", "a/../b", "/etc/passwd", "a//b", "a/.cache", "a/b/c/d/e", "a/x.app", "a/b\\c", "a/b:c", "a/X.APP/y", ".origami", "a/b\0c", "a/.x.origami-en-cours", "a/x.origami-en-cours"] {
            assert!(chemin_sur(r, mauvais).is_err(), "{:?}", mauvais);
        }
        assert_eq!(chemin_sur(r, "Compagnie/Mon spectacle/Dossier – français.pdf").unwrap(), r.join("Compagnie").join("Mon spectacle").join("Dossier – français.pdf"));
    }

    #[test]
    fn ecrire_lire_deplacer() {
        let r = atelier("ecrire");
        let rel = "Compte/Spectacle/Dossier.pdf";
        let a: Vec<u8> = (0..5000u32).map(|i| (i % 251) as u8).collect();
        let b: Vec<u8> = (0..3000u32).map(|i| (i % 13) as u8).collect();
        assert_eq!(ecrire(&r, rel, &encoder(&a), 0, false).unwrap(), 5000);
        assert_eq!(etat(&r, &[rel.to_string()]), vec![None]); // pas encore entier : pas montré
        assert_eq!(ecrire(&r, rel, &encoder(&b), 4000, true).unwrap_err(), "REPRENDRE");
        assert_eq!(ecrire(&r, rel, &encoder(&a), 0, false).unwrap(), 5000);
        assert_eq!(ecrire(&r, rel, &encoder(&b), 5000, true).unwrap(), 8000);
        assert_eq!(etat(&r, &[rel.to_string(), "Compte/Spectacle/Absent.pdf".to_string(), "../x".to_string()]), vec![Some(8000), None, None]);
        let (t, taille) = lire(&r, rel, 4990, 20).unwrap();
        assert_eq!(taille, 8000);
        let mut attendu = a[4990..].to_vec();
        attendu.extend_from_slice(&b[..10]);
        assert_eq!(decoder(&t).unwrap(), attendu);
        assert!(lire(&r, rel, 9000, 10).is_err());
        assert_eq!(lire(&r, rel, 8000, 10).unwrap().0, "");
        // remplacer : le nouveau fichier prend la place de l'ancien, d'un coup
        assert_eq!(ecrire(&r, rel, &encoder(b"neuf"), 0, true).unwrap(), 4);
        assert_eq!(etat(&r, &[rel.to_string()]), vec![Some(4)]);
        assert!(ouvrable(&present(&r, rel).unwrap()));
        assert!(!ouvrable(Path::new("/x/outil.command")));
        assert!(!ouvrable(Path::new("/x/sans-extension")));
        deplacer(&r, rel, "Compte/Autre nom/Dossier.pdf").unwrap();
        assert!(present(&r, rel).is_err());
        assert!(deplacer(&r, "Compte/Autre nom/Dossier.pdf", "Compte/Autre nom/Dossier.pdf").is_err());
        ranger_vides(&r, rel);
        assert!(!r.join("Compte/Spectacle").exists());
        assert!(r.join("Compte/Autre nom/Dossier.pdf").exists());
        assert!(r.exists());
        let _ = fs::remove_dir_all(&r);
    }

    #[test]
    fn lien_symbolique_ne_fait_pas_sortir() {
        let r = atelier("lien");
        let dehors = atelier("dehors");
        fs::write(dehors.join("secret.txt"), b"x").unwrap();
        #[cfg(unix)]
        {
            std::os::unix::fs::symlink(&dehors, r.join("Compte")).unwrap();
            assert!(ecrire(&r, "Compte/piege.txt", &encoder(b"y"), 0, true).is_err());
            assert!(lire(&r, "Compte/secret.txt", 0, 10).is_err());
            assert!(present(&r, "Compte/secret.txt").is_err());
            assert!(!dehors.join("piege.txt").exists());
        }
        let _ = fs::remove_dir_all(&r);
        let _ = fs::remove_dir_all(&dehors);
    }

    #[test]
    fn reglage_et_suite() {
        let r = atelier("reglage");
        let maison = r.join("maison");
        let reglage = r.join("reglages/fichiers-dossier.txt");
        assert_eq!(racine(&reglage, &maison), maison.join("Documents/Origami/Fichiers"));
        assert_eq!(affichage(&racine(&reglage, &maison), &maison), "Documents \u{203a} Origami \u{203a} Fichiers");
        let autre = r.join("Disque/Mes fichiers");
        noter_racine(&reglage, &autre).unwrap();
        assert_eq!(racine(&reglage, &maison), autre);
        fs::write(&reglage, "pas un chemin").unwrap();
        assert_eq!(racine(&reglage, &maison), maison.join("Documents/Origami/Fichiers"));
        let (a, b) = (r.join("ancien"), r.join("nouveau"));
        fs::create_dir_all(a.join("Compte A/Spectacle")).unwrap();
        fs::create_dir_all(a.join("Compte B")).unwrap();
        fs::create_dir_all(b.join("Compte B")).unwrap();
        fs::write(a.join("Compte A/Spectacle/f.pdf"), b"x").unwrap();
        fs::write(a.join(".DS_Store"), b"x").unwrap();
        assert_eq!(suivre(&a, &b), (1, 1));
        assert!(b.join("Compte A/Spectacle/f.pdf").exists());
        assert!(a.join("Compte B").exists());
        let _ = fs::remove_dir_all(&r);
    }
}
