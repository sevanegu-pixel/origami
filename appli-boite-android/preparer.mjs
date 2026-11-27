// Prépare le projet Android de la Boîte mail à partir du code de l'appli Mac (dossier appli-boite/), SANS le modifier :
// tout est copié dans un dossier de fabrication, puis on y pose ce qui est propre au téléphone.
//   node appli-boite-android/preparer.mjs <dossier appli-boite source> <dossier de fabrication>
// Chaque retouche cherche un texte exact du code Mac ; s'il a changé, la fabrication s'arrête et dit lequel (rien ne part à moitié fait).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const [SOURCE, SORTIE] = process.argv.slice(2);
if (!SOURCE || !SORTIE) { console.error('usage : node preparer.mjs <appli-boite> <sortie>'); process.exit(2); }

function copier(de, vers, sauf) {
  fs.mkdirSync(vers, { recursive: true });
  for (const n of fs.readdirSync(de)) {
    if (sauf.includes(n)) continue;
    const a = path.join(de, n), b = path.join(vers, n);
    if (fs.statSync(a).isDirectory()) copier(a, b, sauf); else fs.copyFileSync(a, b);
  }
}
function remplacer(fichier, avant, apres, nom) {
  const t = fs.readFileSync(fichier, 'utf8');
  const n = t.split(avant).length - 1;
  if (n !== 1) { console.error(`RETOUCHE IMPOSSIBLE « ${nom} » dans ${path.basename(fichier)} : texte trouvé ${n} fois au lieu d'une.`); process.exit(1); }
  fs.writeFileSync(fichier, t.replace(avant, () => apres));
  console.log('ok   ' + nom);
}

fs.rmSync(SORTIE, { recursive: true, force: true });
copier(SOURCE, SORTIE, ['node_modules', 'target', 'gen']);
copier(path.join(ICI, 'plugin'), path.join(SORTIE, 'plugin'), ['target', 'build', '.tauri']);

/* ---------- Coquille (www/index.html) ---------- */
const HTML = path.join(SORTIE, 'www', 'index.html');
const cssCoquille = fs.readFileSync(path.join(ICI, 'telephone', 'coquille.css'), 'utf8');
const cssEcran = fs.readFileSync(path.join(ICI, 'telephone', 'ecran.css'), 'utf8');
const jsEcran = fs.readFileSync(path.join(ICI, 'telephone', 'ecran.js'), 'utf8');
const jsCoquille = fs.readFileSync(path.join(ICI, 'telephone', 'coquille.js'), 'utf8');
// Code posé dans l'écran gardé de chaque boîte (par la « cale ») : la feuille de style téléphone puis les retouches de mise en place.
// Il vit dans une balise <script> : aucun « </ » ne doit y rester (dans les chaînes JS, « <\/ » vaut « </ »).
const telEcran = ('(function () { try { var s = document.createElement("style"); s.id = "style-telephone"; s.textContent = ' +
  JSON.stringify(cssEcran) + '; (document.head || document.documentElement).appendChild(s); } catch (e) { /* rien */ } })();\n' + jsEcran)
  .replace(/<\//g, '<\\/').replace(/<!--/g, '<\\!--');

remplacer(HTML, '</head>', '<style id="style-telephone">\n' + cssCoquille + '\n</style>\n</head>', 'feuille de style de la coquille');
remplacer(HTML, "  var T = window.__TAURI__ || null;\n",
  "  var T = window.__TAURI__ || null;\n" +
  "  /* Appli Android (appli-boite-android/preparer.mjs) : une seule fenêtre, écrans servis par des adresses http://bN.localhost, veille en arrière-plan. */\n" +
  "  var ANDROID = true; document.documentElement.classList.add('telephone');\n" +
  "  var TEL_ECRAN = " + JSON.stringify(telEcran).replace(/</g, '\\u003c') + ";\n",
  'drapeau Android');
remplacer(HTML, "  function fenetresPossibles() { return T ?", "  function fenetresPossibles() { if (ANDROID) return false; return T ?", 'pas de fenêtres séparées');
remplacer(HTML, "      f.src = 'boite://' + c.id.toLowerCase() + '/index.html?fenetre=boite&cadre=1';",
  "      f.src = adresseEcran(c) + '?fenetre=boite&cadre=1';", 'adresse de l\'écran gardé');
remplacer(HTML, "    setTimeout(function () { rafraichirEcran(c); }, locaux[id] ? 8000 : 15000);",
  "    setTimeout(function () { rafraichirEcran(c); }, locaux[id] ? 8000 : (ANDROID ? 400 : 15000));", 'écran gardé tout de suite');
remplacer(HTML, "      'window.__ecranLocal = true;\\n' +",
  "      'window.__ecranLocal = true;\\n' + (ANDROID ? TEL_ECRAN + '\\n' : '') +", 'affichage téléphone dans l\'écran');
remplacer(HTML, "        var avant = ecrans[c.id] || {}; ecrans[c.id] = { le: Date.now(), url: c.url, jeton: c.jeton, taille: h.length, echecs: (avant.echecs || 0) + (avant.rate ? 1 : 0) }; garderEcrans();\n",
  "        var avant = ecrans[c.id] || {}; ecrans[c.id] = { le: Date.now(), url: c.url, jeton: c.jeton, taille: h.length, echecs: (avant.echecs || 0) + (avant.rate ? 1 : 0) }; garderEcrans();\n" +
  "        if (ANDROID) telPasserAuLocal(c);\n", 'premier écran gardé montré aussitôt');
remplacer(HTML, "  notifDemarrer();\n  window.__notif = { tour: notifTour, cale: cale };",
  jsCoquille + "\n  notifDemarrer();\n  window.__notif = { tour: notifTour, cale: cale };", 'veille Android et adresses des écrans');

/* ---------- Rust (src-tauri) ---------- */
const LIB = path.join(SORTIE, 'src-tauri', 'src', 'lib.rs');
remplacer(LIB, "#[tauri::command]\nasync fn imprimer(app: tauri::AppHandle, html: String, titre: String) -> Result<(), String> {",
  "#[tauri::command]\nasync fn imprimer(app: tauri::AppHandle, html: String, titre: String) -> Result<(), String> {\n" +
  "    #[cfg(desktop)]\n    {\n        return imprimer_bureau(app, html, titre).await;\n    }\n" +
  "    #[cfg(mobile)]\n    {\n        let _ = (app, html, titre);\n        Err(\"Impression pas encore possible sur le téléphone.\".to_string())\n    }\n}\n\n" +
  "#[cfg(desktop)]\nasync fn imprimer_bureau(app: tauri::AppHandle, html: String, titre: String) -> Result<(), String> {",
  'imprimer : fenêtre du Mac seulement');
remplacer(LIB, "fn reponse(code: u16,",
  "/// Android : chaque boîte a son adresse http://bN.localhost/<compte>/index.html (une origine par case, donc sa propre mémoire).\n" +
  "fn servir_case<R: tauri::Runtime>(app: &tauri::AppHandle<R>, chemin: &str) -> tauri::http::Response<Vec<u8>> {\n" +
  "    let mut morceaux = chemin.trim_start_matches('/').splitn(2, '/');\n" +
  "    let compte = morceaux.next().unwrap_or(\"\").to_ascii_lowercase();\n" +
  "    let reste = morceaux.next().unwrap_or(\"\");\n" +
  "    if !compte_sur(&compte) || !(reste.is_empty() || reste == \"index.html\") {\n" +
  "        return reponse(404, \"text/plain; charset=utf-8\", b\"introuvable\".to_vec());\n" +
  "    }\n" +
  "    match dossier_ecrans(app).and_then(|d| std::fs::read(d.join(format!(\"{}.html\", compte))).map_err(|e| e.to_string())) {\n" +
  "        Ok(octets) => reponse(200, \"text/html; charset=utf-8\", octets),\n" +
  "        Err(_) => reponse(404, \"text/plain; charset=utf-8\", b\"pas encore garde\".to_vec()),\n" +
  "    }\n}\n\nfn reponse(code: u16,", 'écrans par case');
const cases = Array.from({ length: 12 }, (_, i) =>
  `        .register_uri_scheme_protocol("b${i}", |ctx, requete| servir_case(ctx.app_handle(), requete.uri().path()))\n`).join('');
remplacer(LIB, "        .plugin(tauri_plugin_notification::init())\n",
  "        .plugin(tauri_plugin_notification::init())\n        .plugin(tauri_plugin_boite_android::init())\n" + cases, 'veille et cases');

const CARGO = path.join(SORTIE, 'src-tauri', 'Cargo.toml');
remplacer(CARGO, 'tauri-plugin-notification = "2"\n', 'tauri-plugin-notification = "2"\ntauri-plugin-boite-android = { path = "../plugin" }\n', 'module de veille');

fs.writeFileSync(path.join(SORTIE, 'src-tauri', 'capabilities', 'android.json'), JSON.stringify({
  $schema: '../gen/schemas/mobile-schema.json', identifier: 'android', description: 'Appli Android : veille des nouveaux mails.',
  platforms: ['android'], windows: ['main'], permissions: ['boite-android:default', 'notification:default'],
}, null, 2));

const numero = Number(process.env.NUMERO || '1');
fs.writeFileSync(path.join(SORTIE, 'src-tauri', 'tauri.android.conf.json'), JSON.stringify({
  plugins: { 'deep-link': { mobile: [{ scheme: ['boitemail'], appLink: false }], desktop: { schemes: ['boitemail'] } } },
  bundle: { android: { minSdkVersion: 24, versionCode: numero } },
}, null, 2));

for (const f of [HTML]) if (/__TAURI__/.test(fs.readFileSync(f, 'utf8')) === false) { console.error('coquille illisible'); process.exit(1); }
console.log('FINI-PREPARATION ' + SORTIE);
