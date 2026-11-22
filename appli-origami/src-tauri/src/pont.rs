// Passerelle « connexion à Google » de l'appli Origami du Mac (0.4, 22.11.2026). Bibliothèque standard seulement.
//
// Google refuse sa fenêtre de connexion à l'intérieur d'une appli. L'appli ouvre donc le navigateur du Mac sur la page
// « pont » d'Origami ; la personne y choisit son compte ; la page ramène alors la connexion ici, en allant sur
// http://127.0.0.1:PORT/ avec la connexion dans la partie de l'adresse qui ne voyage pas (après le #). La page servie
// par cette passerelle la lit, l'efface de l'adresse et la remet à la passerelle (POST /jeton, même origine).
//
// Garde-fous : écoute sur 127.0.0.1 seulement, sur un port tiré au hasard ; un secret tiré pour cette connexion, que
// seule la page ouverte par l'appli connaît ; une seule passerelle à la fois ; elle se ferme dès que la connexion est
// revenue, quand on annule, ou après dix minutes. Rien n'est écrit sur le disque et rien ne passe par un autre serveur.

use std::io::{Read, Write};
use std::net::{TcpListener, TcpStream};
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{Duration, Instant};

// Une seule passerelle à la fois : en ouvrir une nouvelle, ou fermer, arrête la précédente.
static PONT_TOUR: AtomicU64 = AtomicU64::new(0);
const PONT_DUREE: u64 = 600; // secondes : au-delà, la passerelle se ferme toute seule

/// Ce que la page a ramené.
pub struct Retour {
    pub jeton: String,
    pub duree: u64,
    pub drive: bool,
}

pub fn hasard(octets: usize) -> Result<String, String> {
    let mut f = std::fs::File::open("/dev/urandom").map_err(|e| e.to_string())?;
    let mut b = vec![0u8; octets];
    f.read_exact(&mut b).map_err(|e| e.to_string())?;
    Ok(b.iter().map(|x| format!("{:02x}", x)).collect())
}

fn memes(a: &str, b: &str) -> bool {
    // comparaison sans raccourci : le temps mis ne dit rien du secret
    a.len() == b.len() && a.bytes().zip(b.bytes()).fold(0u8, |d, (x, y)| d | (x ^ y)) == 0
}

fn decoder(t: &str) -> String {
    let o = t.as_bytes();
    let hex = |c: u8| (c as char).to_digit(16).map(|v| v as u8);
    let (mut r, mut i) = (Vec::with_capacity(o.len()), 0);
    while i < o.len() {
        if o[i] == b'%' && i + 2 < o.len() {
            if let (Some(a), Some(b)) = (hex(o[i + 1]), hex(o[i + 2])) {
                r.push(a * 16 + b);
                i += 3;
                continue;
            }
        }
        r.push(o[i]);
        i += 1;
    }
    String::from_utf8_lossy(&r).into_owned()
}

fn champ(corps: &str, nom: &str) -> String {
    corps
        .split('&')
        .filter_map(|p| p.split_once('='))
        .find(|(k, _)| *k == nom)
        .map(|(_, v)| decoder(v))
        .unwrap_or_default()
}

const PONT_PAGE: &str = r#"<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Origami</title>
<style>body{margin:0;font:16px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#f2f1ee;color:#1c1c1a;display:flex;min-height:100vh;align-items:center;justify-content:center}main{max-width:440px;padding:32px 24px}h1{font-size:22px;margin:0 0 10px}p{margin:0;color:#55554f}@media (prefers-color-scheme:dark){body{background:#1c1c1a;color:#f2f1ee}p{color:#b9b8b2}}</style></head>
<body><main><h1 id="t">Un instant…</h1><p id="p"></p></main><script>
(function () {
  var h = location.hash.slice(1), t = document.getElementById("t"), p = document.getElementById("p");
  try { history.replaceState(null, "", "/"); } catch (e) {}
  function dire(a, b) { t.textContent = a; p.textContent = b; }
  if (!h) { dire("Rien à faire ici", "Cette page sert seulement à ramener la connexion à Google dans l'appli Origami de ce Mac. Tu peux la fermer."); return; }
  var rate = function () { dire("La connexion n'est pas passée", "Reviens dans l'appli Origami et recommence « Continuer avec Google »."); };
  fetch("/jeton", { method: "POST", headers: { "Content-Type": "text/plain" }, body: h }).then(function (r) {
    if (r.ok) dire("C'est fait", "La connexion à Google est revenue dans l'appli Origami. Tu peux fermer cet onglet."); else rate();
  }, rate);
})();
</script></body></html>"#;

fn pont_reponse(flux: &mut TcpStream, statut: &str, sorte: &str, corps: &str) {
    let tete = format!(
        "HTTP/1.1 {}\r\nContent-Type: {}; charset=utf-8\r\nContent-Length: {}\r\nCache-Control: no-store\r\nReferrer-Policy: no-referrer\r\nX-Content-Type-Options: nosniff\r\nContent-Security-Policy: default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'\r\nConnection: close\r\n\r\n",
        statut,
        sorte,
        corps.len()
    );
    let _ = flux.write_all(tete.as_bytes());
    let _ = flux.write_all(corps.as_bytes());
    let _ = flux.flush();
}

// Lit une demande (en-têtes et corps, 16 Ko au plus). Rend (méthode, chemin, en-têtes en minuscules, corps).
fn pont_lire(flux: &mut TcpStream) -> Option<(String, String, String, String)> {
    let (mut tout, mut tampon) = (Vec::new(), [0u8; 2048]);
    let fin_tetes = loop {
        if let Some(i) = tout.windows(4).position(|w| w == b"\r\n\r\n") {
            break i;
        }
        if tout.len() > 16 * 1024 {
            return None;
        }
        match flux.read(&mut tampon) {
            Ok(0) | Err(_) => return None,
            Ok(n) => tout.extend_from_slice(&tampon[..n]),
        }
    };
    let tetes = String::from_utf8_lossy(&tout[..fin_tetes]).into_owned();
    let mut lignes = tetes.split("\r\n");
    let mut premiere = lignes.next()?.split(' ');
    let (methode, chemin) = (premiere.next()?.to_string(), premiere.next()?.to_string());
    let bas = tetes.to_lowercase();
    let longueur = bas
        .split("\r\n")
        .find_map(|l| l.strip_prefix("content-length:"))
        .and_then(|v| v.trim().parse::<usize>().ok())
        .unwrap_or(0);
    if longueur > 16 * 1024 {
        return None;
    }
    let mut corps = tout[fin_tetes + 4..].to_vec();
    while corps.len() < longueur {
        match flux.read(&mut tampon) {
            Ok(0) | Err(_) => return None,
            Ok(n) => corps.extend_from_slice(&tampon[..n]),
        }
    }
    corps.truncate(longueur);
    Some((methode, chemin, bas, String::from_utf8_lossy(&corps).into_owned()))
}

// Ce que la page a ramené : seulement avec le bon secret, depuis la page servie par cette passerelle.
fn pont_jeton(tetes: &str, corps: &str, port: u16, secret: &str) -> Option<Retour> {
    let ici = format!("127.0.0.1:{}", port);
    let tete = |nom: &str| tetes.split("\r\n").find_map(|l| l.strip_prefix(nom)).map(|v| v.trim().to_string());
    if tete("host:").as_deref() != Some(ici.as_str()) {
        return None;
    }
    if let Some(o) = tete("origin:") {
        if o != format!("http://{}", ici) {
            return None;
        }
    }
    if !memes(&champ(corps, "s"), secret) {
        return None;
    }
    let jeton = champ(corps, "j");
    if jeton.len() < 20 || jeton.len() > 4096 || !jeton.bytes().all(|c| c.is_ascii_alphanumeric() || b"._~+/=-".contains(&c)) {
        return None;
    }
    let duree = champ(corps, "e").parse::<u64>().unwrap_or(0).clamp(60, 3600);
    Some(Retour { jeton, duree, drive: champ(corps, "d") == "1" })
}

// Rend ce que la page a ramené quand la connexion est revenue : la passerelle a alors fini son travail.
fn pont_repondre(mut flux: TcpStream, port: u16, secret: &str) -> Option<Retour> {
    let _ = flux.set_nonblocking(false);
    let _ = flux.set_read_timeout(Some(Duration::from_secs(5)));
    let _ = flux.set_write_timeout(Some(Duration::from_secs(5)));
    let (methode, chemin, tetes, corps) = pont_lire(&mut flux)?;
    if methode == "GET" && chemin == "/" {
        pont_reponse(&mut flux, "200 OK", "text/html", PONT_PAGE);
        return None;
    }
    if methode == "POST" && chemin == "/jeton" {
        let r = pont_jeton(&tetes, &corps, port, secret);
        if r.is_some() {
            pont_reponse(&mut flux, "200 OK", "text/plain", "ok");
        } else {
            pont_reponse(&mut flux, "403 Forbidden", "text/plain", "refus");
        }
        return r;
    }
    pont_reponse(&mut flux, "404 Not Found", "text/plain", "rien ici");
    None
}

/// Ouvre la passerelle et rend (port, secret). « retour » est appelé une fois, quand la connexion est revenue.
pub fn ouvrir<F: FnOnce(Retour) + Send + 'static>(retour: F) -> Result<(u16, String), String> {
    let rate = |_| "La passerelle vers le navigateur n'a pas pu s'ouvrir sur ce Mac.".to_string();
    let ecoute = TcpListener::bind(("127.0.0.1", 0)).map_err(rate)?;
    ecoute.set_nonblocking(true).map_err(rate)?;
    let port = ecoute.local_addr().map_err(rate)?.port();
    let secret = hasard(24)?;
    let tour = PONT_TOUR.fetch_add(1, Ordering::SeqCst) + 1;
    let s2 = secret.clone();
    std::thread::spawn(move || {
        let fin = Instant::now() + Duration::from_secs(PONT_DUREE);
        while Instant::now() < fin && PONT_TOUR.load(Ordering::SeqCst) == tour {
            match ecoute.accept() {
                Ok((flux, _)) => {
                    if let Some(r) = pont_repondre(flux, port, &s2) {
                        retour(r);
                        return;
                    }
                }
                Err(_) => std::thread::sleep(Duration::from_millis(120)), // personne pour l'instant
            }
        }
    });
    Ok((port, secret))
}

/// Ferme la passerelle en cours, s'il y en a une.
pub fn fermer() {
    PONT_TOUR.fetch_add(1, Ordering::SeqCst);
}
