/*
 * Origami se connecte à Google (19.11.2026, choix de Sévane).
 *
 * Google refuse à un moteur Apps Script d'en créer un autre. C'est donc cette page qui, avec la connexion de la personne
 * (projet Google de la compagnie), crée le projet de la Compta dans SON compte, y met le code, en fait une version et la
 * publie. Chaque geste a été essayé en vrai le 19.11 (page essai-google/).
 *
 * Le code de la Compta n'est pas ici : la page le relit dans le moteur du compte (fichiers « compta_… »), avec la connexion
 * de la personne, et le pose tel quel dans son projet. Rien n'est gardé, rien ne part ailleurs que chez Google.
 * La connexion (jeton) reste dans la mémoire de la page : elle disparaît quand on ferme ou recharge Origami.
 *
 * Appli du Mac (0.4, 22.11.2026) : Google refuse sa fenêtre de connexion à l'intérieur d'une appli. L'appli ouvre donc le
 * navigateur du Mac sur la page « pont/ » ; la personne y choisit son compte ; la page ramène la connexion à l'appli par une
 * passerelle qui n'existe que sur ce Mac (127.0.0.1), le temps de cette connexion. Rien ne passe par un autre serveur.
 */
(function (racine) {
  "use strict";
  var CLIENT = "964221481435-nv5bh3a8v6vlnbiaf1fgjfft6a7sb9kn.apps.googleusercontent.com";   // public par nature : il ne donne aucun accès à lui seul
  var API = "https://script.googleapis.com/v1/";
  var DROITS = ["https://www.googleapis.com/auth/script.projects", "https://www.googleapis.com/auth/script.deployments"];
  // L'adresse du compte choisi sert à dire à Google quel compte doit autoriser la Compta (plusieurs comptes connectés dans le navigateur).
  var DROIT_ADRESSE = "https://www.googleapis.com/auth/userinfo.email";
  // Installer Origami lui-même (v10) : la page crée le classeur du compte. Ce droit ne couvre QUE les fichiers créés par Origami.
  var DROIT_DRIVE = "https://www.googleapis.com/auth/drive.file";
  var API_DRIVE = "https://www.googleapis.com/drive/v3/";
  var MODELE_SCRIPT = "18Ri1dh1bJyiheHS5F0FEhGaUL5Lbq_HDKvlw7NalC7X5SehS7wiZdF0q";   // le moteur modèle (identifiant, pas de code) : la page le lit avec la connexion de la personne
  var NOM_CLASSEUR = "Origami - Réglages du compte", MARQUE = "reglages";
  // Boîte mail installée par Origami (23.11) : le modèle « Boîte mail (vierge) » de la compagnie, partagé par lien comme celui du moteur.
  var MODELE_BOITE = "1GEKuqfAGTl3aT42Kx6HGHiXqgewx2DvwOApBfsFgVmHyNbWJdgtTpetU", NOM_BOITE = "Origami - Boîte mail", MARQUE_BOITE = "boite";
  var ADRESSE_EXEC = /^https:\/\/script\.google\.com\/(a\/[^/]+\/)?macros\/s\/[\w-]+\/exec$/;
  var ATTENTES = [1500, 4000, 9000];
  var sessions = {}, chargement = null;

  function souci(message, code, statut, brut) { var e = new Error(message); e.code = code || ""; if (statut) e.statut = statut; if (brut) e.brut = brut; return e; }
  function enc(x) { return encodeURIComponent(String(x)); }

  // ---------- Ce qui ne dépend pas du navigateur (essayé aussi au banc du moteur) ----------
  var DOGET = /function\s+doGet\s*\(\s*(\w*)\s*\)\s*\{/g;
  var TYPES = { JSON: 1, SERVER_JS: 1, HTML: 1 };
  function nbDoGet(t) { return (String(t).match(DOGET) || []).length; }

  /** La recette rendue par le moteur, vérifiée dans sa forme. */
  function verifierRecette(r) {
    var ident = function (x) { return /^[\w-]{6,120}$/.test(String(x || "")); };
    if (!r || !ident(r.moteur) || typeof r.prefixe !== "string" || !/^[a-z_]{2,20}$/.test(r.prefixe) || !Array.isArray(r.fichiers) || !r.fichiers.length || typeof r.appel !== "string" || !/^[0-9a-f]{16,64}$/.test(String(r.empreinte || "")))
      throw souci("Le moteur de ce compte n'a pas répondu comme prévu. Recharge Origami et réessaie.", "recette");
    r.fichiers.forEach(function (f) { if (!f || !/^\w{1,60}$/.test(String(f.nom || "")) || !TYPES[f.type]) throw souci("Le moteur de ce compte n'a pas répondu comme prévu. Recharge Origami et réessaie.", "recette"); });
    ["classeur", "projet", "deploiement"].forEach(function (k) { if (r[k] && !ident(r[k])) throw souci("Le moteur de ce compte n'a pas répondu comme prévu. Recharge Origami et réessaie.", "recette"); });
    if (r.adresse && !/^https:\/\/script\.google\.com\/(a\/[^/]+\/)?macros\/s\/[\w-]+\/exec$/.test(r.adresse)) throw souci("Le moteur de ce compte n'a pas répondu comme prévu. Recharge Origami et réessaie.", "recette");
    return { moteur: r.moteur, titre: String(r.titre || "Origami - Compta").slice(0, 80), prefixe: r.prefixe, fichiers: r.fichiers.map(function (f) { return { nom: f.nom, type: f.type }; }), appel: r.appel,
      empreinte: r.empreinte, installee: String(r.installee || ""), classeur: r.classeur || "", projet: r.projet || "", version: Number(r.version) || 0, deploiement: r.deploiement || "", adresse: r.adresse || "", reglages: String(r.reglages || "") };
  }

  /** Le code de la Compta porté par le moteur : { Code: "…", … }, lu dans le contenu de son projet. */
  function codePorte(contenu, r) {
    var porte = {};
    ((contenu && contenu.files) || []).forEach(function (f) {
      if (f && f.type === "HTML" && String(f.name).indexOf(r.prefixe) === 0) porte[String(f.name).slice(r.prefixe.length)] = String(f.source || "");
    });
    var manque = r.fichiers.filter(function (f) { return !porte[f.nom]; }).map(function (f) { return f.nom; });
    if (manque.length) throw souci("Le code de la Compta manque dans le moteur de ce compte (" + manque.join(", ") + ").", "code");
    if (!porte.Code || !/function appCompte_\s*\(/.test(porte.Code)) throw souci("La Compta portée par le moteur de ce compte ne connaît pas encore les autres comptes.", "code");
    var doget = 0;
    r.fichiers.forEach(function (f) { if (f.type === "SERVER_JS") doget += nbDoGet(porte[f.nom]); });
    if (doget !== 1 || nbDoGet(porte.Code) !== 1) throw souci("La Compta portée par le moteur de ce compte a changé de forme : son installation doit être adaptée.", "code");
    if (!/function comptaPreparerSiBesoin_\s*\(/.test(porte["10_Compte_installation"] || "")) throw souci("Le fichier d'installation de la Compta est trop ancien dans le moteur de ce compte.", "code");
    try { JSON.parse(porte.appsscript); } catch (e) { throw souci("Le manifeste de la Compta portée par le moteur est illisible.", "code"); }
    return porte;
  }

  /** Les fichiers du projet de la Compta de ce compte : code porté (doGet complété) + réglages de ce compte. */
  function fichiersCompta(porte, r, reglages) {
    if (!/^var APP_COMPTE_ = \{/.test(String(reglages || ""))) throw souci("Les réglages de la Compta de ce compte manquent.", "code");
    var manifeste = JSON.parse(porte.appsscript);
    manifeste.webapp = { access: "ANYONE_ANONYMOUS", executeAs: "USER_DEPLOYING" };
    return r.fichiers.map(function (f) {
      var source = porte[f.nom];
      if (f.nom === "appsscript") source = JSON.stringify(manifeste, null, 2);
      if (f.nom === "Code") source = source.replace(DOGET, function (m) { return m + r.appel; });
      return { name: f.nom, type: f.type, source: source };
    }).concat([{ name: "99_Compte", type: "SERVER_JS", source: String(reglages) }]);
  }

  function adresseDe(dep) {
    var web = ((dep && dep.entryPoints) || []).filter(function (x) { return x && x.entryPointType === "WEB_APP" && x.webApp && x.webApp.url; })[0];
    return (web && /^https:\/\/script\.google\.com\/(a\/[^/]+\/)?macros\/s\/[\w-]+\/exec$/.test(web.webApp.url)) ? web.webApp.url : "";
  }

  /** L'écran de Google qui fait autoriser une appli par son propriétaire ; « adresse » dit à Google quel compte prendre. */
  function lienAutorisation(projet, adresse) {
    if (!/^[\w-]{20,120}$/.test(String(projet || ""))) return "";
    return "https://script.google.com/macros/d/" + enc(projet) + "/authorize" + (/^[^\s@]+@[^\s@]+$/.test(String(adresse || "")) ? "?authuser=" + enc(adresse) : "");
  }

  // ---------- Connexion à Google ----------
  function pret() { return !!(racine.google && racine.google.accounts && racine.google.accounts.oauth2); }
  /** Charge la connexion de Google (à appeler dès l'ouverture de l'écran : le clic « Se connecter » doit ouvrir la fenêtre tout de suite). */
  function charger() { return coquille() ? Promise.resolve() : chargerGoogle(); }
  function chargerGoogle() {
    if (pret()) return Promise.resolve();
    if (chargement) return chargement;
    chargement = new Promise(function (ok, non) {
      var s = document.createElement("script"); s.src = "https://accounts.google.com/gsi/client"; s.async = true;
      s.onload = function () { if (pret()) ok(); else { chargement = null; non(souci("La connexion à Google n'a pas pu se charger. Recharge Origami et réessaie.", "google-absent")); } };
      s.onerror = function () { chargement = null; s.remove(); non(souci("La connexion à Google n'a pas pu se charger. Vérifie ta connexion à Internet ; un bloqueur de publicité l'empêche peut-être.", "google-absent")); };
      document.head.appendChild(s);
    });
    return chargement;
  }
  function lireAdresse(jeton) {
    return fetch("https://www.googleapis.com/oauth2/v3/userinfo", { headers: { Authorization: "Bearer " + jeton } })
      .then(function (r) { return r.ok ? r.json() : {}; }).then(function (d) { return /^[^\s@]+@[^\s@]+$/.test(String(d.email || "")) ? String(d.email) : ""; }, function () { return ""; });
  }
  /** L'adresse du compte voulu, si elle a la forme d'une adresse. */
  function adresseVisee(plus) { var a = String((plus && plus.adresse) || "").trim().toLowerCase(); return a.length <= 254 && /^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/.test(a) ? a : ""; }
  function enBase64Url(t) { try { return btoa(unescape(encodeURIComponent(t))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); } catch (e) { return ""; } }
  function deBase64Url(t) { try { return decodeURIComponent(escape(atob(String(t || "").replace(/-/g, "+").replace(/_/g, "/")))); } catch (e) { return ""; } }
  /** Ouvre la fenêtre de Google (choix du compte, accord). Rend la session { jeton, adresse, fin }. À lancer depuis un clic. */
  function connecter(cle, plus) {
    if (coquille()) return ouvrirParPont(cle, plus);
    // Connexion déjà chargée : la fenêtre s'ouvre dans le clic même (sinon certains navigateurs la bloquent).
    return pret() ? ouvrir(cle, plus) : charger().then(function () { return ouvrir(cle, plus); });
  }
  function ouvrir(cle, plus) {
    var drive = !!(plus && plus.drive), vise = adresseVisee(plus);
    {
      return new Promise(function (ok, non) {
        var rendu = false;
        function refus(m, c) { if (rendu) return; rendu = true; non(souci(m, c)); }
        try {
          var reglage = {
            client_id: CLIENT, scope: DROITS.concat([DROIT_ADRESSE], drive ? [DROIT_DRIVE] : []).join(" "), prompt: "select_account",
            callback: function (r) {
              if (rendu) return;
              if (!r || !r.access_token) { refus(r && r.error === "access_denied" ? "Tu as refusé à l'écran de Google. Rien n'a été fait." : "Google a répondu : " + String((r && (r.error_description || r.error)) || "pas de connexion"), "refus"); return; }
              if (!racine.google.accounts.oauth2.hasGrantedAllScopes(r, DROITS[0], DROITS[1])) { refus("Il manque un droit : à l'écran de Google, laisse toutes les cases cochées.", "cases"); return; }
              if (drive && !racine.google.accounts.oauth2.hasGrantedAllScopes(r, DROIT_DRIVE)) { refus("Il manque un droit : à l'écran de Google, laisse toutes les cases cochées.", "cases"); return; }
              rendu = true;
              var s = { jeton: r.access_token, adresse: "", drive: drive, fin: Date.now() + Math.max(60, (Number(r.expires_in) || 3000) - 120) * 1000 };
              lireAdresse(s.jeton).then(function (a) { s.adresse = a; sessions[cle] = s; ok(s); });
            },
            error_callback: function (e) {
              refus(e && e.type === "popup_closed" ? "La fenêtre de Google a été fermée avant la fin."
                : e && e.type === "popup_failed_to_open" ? "Le navigateur a bloqué la fenêtre de Google : autorise les fenêtres surgissantes pour Origami, puis recommence."
                : "Google a répondu : " + String((e && (e.message || e.type)) || "erreur"), e && e.type === "popup_failed_to_open" ? "bloque" : "ferme");
            }
          };
          // Compte connu ou écrit par la personne (22.11, Sévane) : Google s'ouvre directement dessus, sans la liste des comptes.
          if (vise) { reglage.login_hint = vise; reglage.prompt = ""; }
          racine.google.accounts.oauth2.initTokenClient(reglage).requestAccessToken();
        } catch (e) { refus(String((e && e.message) || e), "refus"); }
      });
    }
  }
  // ---------- Appli du Mac : la connexion se fait dans le navigateur du Mac et revient par la passerelle ----------
  var PONT = "https://sevanegu-pixel.github.io/origami/accueil/pont/";
  var pontEnCours = null;
  /** L'appli du Mac, quand elle a de quoi ouvrir le navigateur et écouter la passerelle. */
  function coquille() {
    var T = racine.__TAURI__;
    return T && T.core && typeof T.core.invoke === "function" && T.event && typeof T.event.listen === "function" && T.opener && typeof T.opener.openUrl === "function" ? T : null;
  }
  /** Le panneau d'attente, par-dessus l'écran : la personne est dans son navigateur, elle doit pouvoir annuler ou le rouvrir. */
  function panneauPont(rouvrir, annuler, lien, vise) {
    var d = racine.document; if (!d || !d.body) return function () {};
    var v = d.createElement("div"); v.id = "pontGoogle"; v.setAttribute("role", "dialog"); v.setAttribute("aria-modal", "true"); v.setAttribute("aria-labelledby", "pontGoogleTitre");
    v.style.cssText = "position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(21,19,26,.45);font:14px/1.45 system-ui,-apple-system,sans-serif";
    v.innerHTML = '<div style="max-width:460px;width:100%;padding:22px;border-radius:14px;background:var(--carte,#fff);color:var(--texte,#15131a);box-shadow:0 12px 40px rgba(0,0,0,.25)">' +
      '<h2 id="pontGoogleTitre" style="margin:0 0 8px;font-size:18px">Connexion à Google</h2>' +
      (vise ? '<p style="margin:0 0 8px">Ton navigateur vient de s\'ouvrir. Clique « Continuer avec Google » : Google s\'ouvre directement sur <strong data-pont-compte="1"></strong>. Accepte, en laissant les cases cochées.</p>'
        : '<p style="margin:0 0 8px">Ton navigateur vient de s\'ouvrir. Écris-y l\'adresse du compte à ajouter : Google s\'ouvrira directement sur ce compte, même s\'il n\'est pas encore connecté dans ce navigateur. Puis clique « Continuer avec Google » et accepte, en laissant les cases cochées.</p>') +
      '<p style="margin:0 0 8px;color:var(--doux,#67626e)">Origami revient devant toi tout seul. Google n\'accepte pas de se connecter dans la fenêtre d\'une appli : c\'est pour cela que le navigateur s\'ouvre.</p>' +
      '<p style="margin:0 0 16px;color:var(--doux,#67626e)">Tu préfères un autre navigateur ou un autre profil Chrome, celui du compte ? Copie le lien et colle-le dans sa barre d\'adresse.</p>' +
      '<div style="display:flex;gap:8px;justify-content:space-between;flex-wrap:wrap"><button type="button" class="bouton" data-pont="annuler">Annuler</button><span style="display:flex;gap:8px;flex-wrap:wrap"><button type="button" class="bouton" data-pont="copier">Copier le lien</button><button type="button" class="bouton" data-pont="rouvrir">Rouvrir le navigateur</button></span></div></div>';
    var nom = v.querySelector("[data-pont-compte]"); if (nom) nom.textContent = vise;
    function copier(b) {
      function dit(t) { b.textContent = t; setTimeout(function () { b.textContent = "Copier le lien"; }, 2500); }
      function secours() { try { var z = d.createElement("textarea"); z.value = lien; z.setAttribute("readonly", ""); z.style.cssText = "position:fixed;opacity:0"; v.appendChild(z); z.select(); var ok = d.execCommand("copy"); z.remove(); dit(ok ? "Lien copié" : "Copie impossible"); } catch (e) { dit("Copie impossible"); } }
      try { if (racine.navigator && racine.navigator.clipboard && racine.navigator.clipboard.writeText) racine.navigator.clipboard.writeText(lien).then(function () { dit("Lien copié"); }, secours); else secours(); } catch (e) { secours(); }
    }
    v.addEventListener("click", function (ev) { var b = ev.target && ev.target.closest ? ev.target.closest("[data-pont]") : null; if (!b) return; var q = b.getAttribute("data-pont"); if (q === "annuler") annuler(); else if (q === "copier") copier(b); else rouvrir(); });
    d.body.appendChild(v);
    return function () { try { v.remove(); } catch (e) {} };
  }
  function ouvrirParPont(cle, plus) {
    var T = coquille(), drive = !!(plus && plus.drive), vise = adresseVisee(plus);
    if (pontEnCours) pontEnCours("Connexion à Google annulée.");
    return T.core.invoke("pont_google").then(function (p) { return p; }, function () {
      throw souci("Cette appli Origami du Mac est trop ancienne pour se connecter à Google. Mets-la à jour dans l'écran « Applis », puis recommence.", "mac-ancien");
    }).then(function (p) {
      if (!p || !(Number(p.port) > 1023 && Number(p.port) < 65536) || !/^[0-9a-f]{32,64}$/.test(String(p.secret || "")) || !/^[0-9a-f]{8,32}$/.test(String(p.id || ""))) throw souci("La passerelle vers le navigateur n'a pas pu s'ouvrir sur ce Mac.", "refus");
      // L'adresse du compte déjà connue voyage après le « # » (jamais envoyée au serveur) : la page pont la propose d'office.
      var lien = PONT + "#" + Number(p.port) + "." + p.secret + (drive ? ".d" : "") + (vise ? ".a" + enBase64Url(vise) : "");
      return new Promise(function (ok, non) {
        var fini = false, arreter = null, fermerPanneau = function () {}, garde = 0;
        function clore() { fini = true; clearTimeout(garde); if (arreter) { try { arreter(); } catch (e) {} } fermerPanneau(); if (pontEnCours === abandon) pontEnCours = null; }
        function abandon(m) { if (fini) return; clore(); try { Promise.resolve(T.core.invoke("pont_annuler")).catch(function () {}); } catch (e) {} non(souci(m || "La connexion à Google a été annulée.", "ferme")); }
        function ouvrirNavigateur() { try { Promise.resolve(T.opener.openUrl(lien)).catch(function () { abandon("Le navigateur de ce Mac ne s'est pas ouvert."); }); } catch (e) { abandon("Le navigateur de ce Mac ne s'est pas ouvert."); } }
        pontEnCours = abandon;
        Promise.resolve(T.event.listen("origami-pont", function (e) {
          var r = e && e.payload;
          if (fini || !r || r.pour !== p.id) return;
          clore();
          if (!/^[\w.~+\/=-]{20,4096}$/.test(String(r.jeton || ""))) { non(souci("Google n'a pas donné de connexion. Recommence.", "refus")); return; }
          if (drive && !r.drive) { non(souci("Il manque un droit : à l'écran de Google, laisse toutes les cases cochées.", "cases")); return; }
          var s = { jeton: String(r.jeton), adresse: "", drive: drive, fin: Date.now() + Math.max(60, (Number(r.duree) || 3000) - 120) * 1000 };
          lireAdresse(s.jeton).then(function (a) { s.adresse = a; sessions[cle] = s; ok(s); });
        })).then(function (u) { arreter = typeof u === "function" ? u : null; if (fini && arreter) arreter(); }, function () { abandon("L'appli n'a pas pu attendre la connexion à Google."); });
        garde = setTimeout(function () { abandon("La connexion à Google n'est pas revenue dans l'appli. Recommence."); }, racine.__attentePont || 9 * 60000);
        fermerPanneau = panneauPont(ouvrirNavigateur, function () { abandon("La connexion à Google a été annulée."); }, lien, vise);
        ouvrirNavigateur();
      });
    });
  }

  function session(cle) { var s = sessions[cle]; if (s && s.fin <= Date.now()) { delete sessions[cle]; s = null; } return s || null; }
  function oublier(cle) { delete sessions[cle]; }
  /** La connexion faite pour « ajouter un compte » devient celle du compte, une fois qu'il existe dans l'appli. */
  function adopter(de, vers) { var s = session(de); delete sessions[de]; if (s) sessions[vers] = s; return s; }

  /** Un appel à l'API Apps Script avec la connexion de la personne. Les refus connus portent un code pour l'écran. */
  function api(s, methode, chemin, corps, tour) { return appel(API, s, methode, chemin, corps, tour); }
  function drive(s, methode, chemin, corps) { return appel(API_DRIVE, s, methode, chemin, corps); }
  function appel(base, s, methode, chemin, corps, tour) {
    var opt = { method: methode, headers: { Authorization: "Bearer " + s.jeton } };
    if (corps !== undefined) { opt.headers["Content-Type"] = "application/json"; opt.body = JSON.stringify(corps); }
    return fetch(base + chemin, opt).then(function (r) {
      return r.text().then(function (t) {
        var d = {}; try { d = JSON.parse(t || "{}"); } catch (e) { d = {}; }
        if (r.ok) return d;
        // Google momentanément indisponible ou débordé (vu en vrai le 19.11) : on attend un peu et on recommence, trois fois au plus.
        if ((r.status === 429 || r.status >= 500) && (tour || 0) < ATTENTES.length) {
          return new Promise(function (ok) { setTimeout(ok, ATTENTES[tour || 0] * (racine.__sansAttente ? 0 : 1)); }).then(function () { return appel(base, s, methode, chemin, corps, (tour || 0) + 1); });
        }
        var m = String((d.error && d.error.message) || t).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").slice(0, 300), brut = r.status + " : " + m;
        if (/User has not enabled the Apps Script API|usersettings/i.test(m)) throw souci("L'interrupteur « API Google Apps Script » de ce compte est éteint.", "api-eteinte", r.status, brut);
        if (/has not been used in project|it is disabled|SERVICE_DISABLED/i.test(m)) throw souci(base === API_DRIVE ? "Le projet Google de la compagnie n'a pas « Google Drive API » allumée." : "Le projet Google de la compagnie n'a pas l'API Apps Script allumée.", "projet-compagnie", r.status, brut);
        if (r.status === 401) { Object.keys(sessions).forEach(function (k) { if (sessions[k] === s) delete sessions[k]; }); throw souci("La connexion à Google a expiré.", "expire", 401, brut); }
        if (r.status === 404) throw souci(base === API_DRIVE ? "Google ne trouve pas ce fichier." : "Google ne trouve pas ce projet.", "introuvable", 404, brut);
        if (r.status === 403) throw souci("Google refuse.", "refus-google", 403, brut);
        if (r.status === 429 || r.status >= 500) throw souci("Google ne répond pas pour l'instant. Réessaie dans une minute.", "occupe", r.status, brut);
        throw souci("Google a refusé (" + r.status + ") : " + m, "", r.status, brut);
      });
    }, function () { throw souci("Pas de réponse de Google. Vérifie ta connexion à Internet.", "reseau"); });
  }

  function lireMoteur(s, r) {
    return api(s, "GET", "projects/" + enc(r.moteur) + "/content").then(function (c) { return codePorte(c, r); }, function (e) {
      // Le moteur du compte n'est lisible que par son propriétaire : un refus ici veut dire qu'un autre compte Google a été choisi.
      if (e.code === "introuvable" || e.code === "refus-google") throw souci("Ce n'est pas le bon compte Google.", "mauvais-compte", e.statut, e.brut);
      throw e;
    });
  }

  /**
   * Installe (ou reprend) la Compta d'un compte. o = { cle, moteur(prise, args) → promesse, dire(etape) }.
   * Étapes dites : recette, code, classeur, projet, contenu, version, ligne. Rend { adresse, projet, premiere }.
   */
  function installerCompta(o) {
    var s = session(o.cle), dire = o.dire || function () {}, r = null, porte = null, notee = false;
    if (!s) return Promise.reject(souci("Connecte d'abord Origami à Google.", "connexion"));
    dire("recette");
    return o.moteur("compta.recette").then(function (x) {
      r = verifierRecette(x);
      if (r.adresse) return { adresse: r.adresse, projet: r.projet, premiere: false };
      dire("code");
      return lireMoteur(s, r).then(function (p) { porte = p; dire("classeur"); return o.moteur("compta.preparer"); })
        .then(function (x2) {
          r = verifierRecette(x2);
          if (!r.classeur || !r.reglages) throw souci("Le moteur de ce compte n'a pas préparé le classeur de la Compta. Réessaie.", "recette");
          notee = !!r.adresse;
          if (r.projet) return null;
          dire("projet");
          return api(s, "POST", "projects", { title: r.titre, parentId: r.classeur }).then(function (p) {
            if (!/^[\w-]{6,120}$/.test(String(p.scriptId || ""))) throw souci("Google n'a pas rendu l'identifiant du projet. Réessaie.", "occupe");
            r.projet = p.scriptId; return o.moteur("compta.noter", { projet: r.projet });
          });
        })
        .then(function () {
          if (r.version) return null;
          dire("contenu");
          return api(s, "PUT", "projects/" + enc(r.projet) + "/content", { files: fichiersCompta(porte, r, r.reglages) })
            .then(function () { dire("version"); return api(s, "POST", "projects/" + enc(r.projet) + "/versions", { description: "Compta installée depuis Origami" }); })
            .then(function (v) { r.version = Number(v.versionNumber) || 0; if (!r.version) throw souci("Google n'a pas rendu le numéro de version. Réessaie.", "occupe"); return o.moteur("compta.noter", { version: r.version, empreinte: r.empreinte }); });
        })
        .then(function () {
          if (r.deploiement) return null;
          dire("ligne");
          return api(s, "POST", "projects/" + enc(r.projet) + "/deployments", { versionNumber: r.version, manifestFileName: "appsscript", description: "Compta de ce compte" }).then(function (d) {
            if (!/^[\w-]{6,120}$/.test(String(d.deploymentId || ""))) throw souci("Google n'a pas rendu l'identifiant de la publication. Réessaie.", "occupe");
            r.deploiement = d.deploymentId; r.adresse = adresseDe(d);
            return o.moteur("compta.noter", { deploiement: r.deploiement });
          });
        })
        .then(function () {
          if (r.adresse) return null;   // réponse de Google sans l'adresse, ou reprise après un arrêt : la relire
          dire("ligne");
          return api(s, "GET", "projects/" + enc(r.projet) + "/deployments/" + enc(r.deploiement)).then(function (d) {
            r.adresse = adresseDe(d);
            if (!r.adresse) throw souci("La Compta a été créée mais pas encore publiée. Réessaie dans un instant.", "occupe");
          });
        })
        .then(function () { return notee ? null : o.moteur("compta.noter", { adresse: r.adresse }); })
        .then(function () { return { adresse: r.adresse, projet: r.projet, premiere: true }; })
        .catch(function (e) {
          // Projet noté puis supprimé à la main chez Google : on repart d'un projet neuf, une seule fois.
          if (e && e.code === "introuvable" && !o.refait && r && !notee) return o.moteur("compta.noter", { refaire: true }).then(function () { return installerCompta({ cle: o.cle, moteur: o.moteur, dire: o.dire, refait: true }); });
          throw e;
        });
    });
  }

  /** Met la Compta d'un compte au niveau de celle que porte son moteur (même adresse, réglages du compte gardés). */
  function mettreAJourCompta(o) {
    var s = session(o.cle), dire = o.dire || function () {}, r = null, porte = null;
    if (!s) return Promise.reject(souci("Connecte d'abord Origami à Google.", "connexion"));
    dire("recette");
    return o.moteur("compta.recette").then(function (x) {
      r = verifierRecette(x);
      if (!r.adresse || !r.projet || !r.deploiement) throw souci("La Compta de ce compte n'est pas encore installée.", "");
      if (r.installee === r.empreinte) return { aJour: true, version: r.version };
      dire("code");
      return lireMoteur(s, r).then(function (p) { porte = p; return api(s, "GET", "projects/" + enc(r.projet) + "/content"); })
        .then(function (actuel) {
          var reglages = "";
          ((actuel && actuel.files) || []).forEach(function (f) { if (f && f.name === "99_Compte" && /^var APP_COMPTE_ = \{/.test(String(f.source || ""))) reglages = String(f.source); });
          dire("contenu");
          return api(s, "PUT", "projects/" + enc(r.projet) + "/content", { files: fichiersCompta(porte, r, reglages || r.reglages) });
        })
        .then(function () { dire("version"); return api(s, "POST", "projects/" + enc(r.projet) + "/versions", { description: "Compta mise à jour depuis Origami" }); })
        .then(function (v) {
          r.version = Number(v.versionNumber) || 0; if (!r.version) throw souci("Google n'a pas rendu le numéro de version. Réessaie.", "occupe");
          dire("ligne");
          return api(s, "PUT", "projects/" + enc(r.projet) + "/deployments/" + enc(r.deploiement), { deploymentConfig: { scriptId: r.projet, versionNumber: r.version, manifestFileName: "appsscript", description: "Compta de ce compte" } });
        })
        .then(function () { return o.moteur("compta.noter", { version: r.version, empreinte: r.empreinte }); })
        .then(function () { return { aJour: true, version: r.version }; });
    });
  }

  // ---------- Installer Origami dans un compte, sans classeur à copier ni code à coller (v10) ----------
  function hasard(n) { var o = new Uint8Array(n); racine.crypto.getRandomValues(o); return Array.prototype.map.call(o, function (b) { return ("0" + b.toString(16)).slice(-2); }).join(""); }
  function hacher(t) { return racine.crypto.subtle.digest("SHA-256", new TextEncoder().encode(t)).then(function (h) { return Array.prototype.map.call(new Uint8Array(h), function (b) { return ("0" + b.toString(16)).slice(-2); }).join(""); }); }
  function adresseDeploiement(id) { return /^[\w-]{20,120}$/.test(String(id || "")) ? "https://script.google.com/macros/s/" + id + "/exec" : ""; }

  /** Demande au moteur d'un compte, sans clé d'appareil (premier contact, connexion à Google) ou avec. */
  function demander(adresse, corps) {
    if (!ADRESSE_EXEC.test(String(adresse || ""))) return Promise.reject(souci("L'adresse du moteur n'a pas la bonne forme.", "adresse"));
    return fetch(adresse, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(corps), redirect: "follow" })
      .then(function (r) { return r.text().then(function (t) { var d = null; try { d = JSON.parse(t); } catch (e) { d = null; } if (!r.ok || !d || typeof d !== "object") throw souci("Le moteur de ce compte ne répond pas encore.", "muet"); return d; }); },
        function () { throw souci("Le moteur de ce compte ne répond pas encore.", "muet"); })
      .then(function (d) { if (!d.ok) throw souci(String(d.erreur || "Le moteur a refusé."), String(d.code || "refus-moteur")); return d.r; });
  }

  /** Le moteur du compte répond-il ? Tant que son propriétaire ne l'a pas autorisé, il ne répond rien de lisible. */
  function pingMoteur(adresse) {
    if (!ADRESSE_EXEC.test(String(adresse || ""))) return Promise.resolve(false);
    return fetch(String(adresse), { redirect: "follow" }).then(function (r) { return r.ok ? r.text() : ""; }).then(function (t) { return /^Moteur Origami/.test(String(t).trim()); }, function () { return false; });
  }

  /** Le code du moteur modèle, lu avec la connexion de la personne. Les fichiers propres à un compte (99_…) n'en font pas partie. */
  function lireModele(s) {
    return api(s, "GET", "projects/" + enc(MODELE_SCRIPT) + "/content").then(function (c) {
      var f = ((c && c.files) || []).filter(function (x) { return x && TYPES[x.type] && /^[\w .-]{1,80}$/.test(String(x.name || "")) && typeof x.source === "string" && !/^99_/.test(x.name); })
        .map(function (x) { return { name: x.name, type: x.type, source: x.source }; });
      var noms = f.map(function (x) { return x.name; });
      if (noms.indexOf("appsscript") < 0 || noms.indexOf("00_Socle") < 0 || noms.indexOf("30_Porte") < 0) throw souci("Le modèle d'Origami est incomplet.", "modele");
      var v = /version:\s*(\d+)/.exec(f[noms.indexOf("00_Socle")].source);
      return { fichiers: f, version: v ? Number(v[1]) : 0 };
    }, function (e) {
      if (e.code === "introuvable" || e.code === "refus-google") throw souci("Origami n'arrive pas à lire son modèle avec ce compte.", "modele", e.statut, e.brut);
      throw e;
    });
  }

  /** L'Origami de ce compte Google, s'il a été installé par cette voie : { classeur, projet, deploiement, adresse } ou null. */
  function chercherOrigami(s) {
    return drive(s, "GET", "files?pageSize=20&orderBy=createdTime&fields=" + enc("files(id,name,appProperties)") + "&q=" + enc("appProperties has { key='origami' and value='" + MARQUE + "' } and trashed=false")).then(function (l) {
      var f = ((l && l.files) || []).filter(function (x) { return x && /^[\w-]{20,120}$/.test(String(x.id || "")); }).map(function (x) {
        var a = x.appProperties || {}, dep = /^[\w-]{20,120}$/.test(String(a.origamiMoteur || "")) ? a.origamiMoteur : "";
        return { classeur: x.id, projet: /^[\w-]{20,120}$/.test(String(a.origamiProjet || "")) ? a.origamiProjet : "", deploiement: dep, adresse: adresseDeploiement(dep) };
      });
      // Le plus ancien d'abord ; un Origami fini passe avant une installation interrompue.
      return f.filter(function (x) { return x.deploiement; })[0] || f[0] || null;
    });
  }
  function noter(s, classeur, quoi) { return drive(s, "PATCH", "files/" + enc(classeur) + "?fields=id", { appProperties: quoi }); }

  /**
   * Installe (ou reprend) Origami dans le compte connecté. o = { cle, dire(etape) }.
   * Étapes dites : chercher, code, classeur, projet, contenu, version, ligne. Chaque étape faite est notée sur le classeur :
   * une installation interrompue reprend où elle en était. Rend { classeur, projet, deploiement, adresse, secret, version }.
   * Le secret sert au premier contact : le moteur n'en porte que l'empreinte, et ne l'accepte qu'une fois.
   */
  function installerOrigami(o) {
    var s = session(o.cle), dire = o.dire || function () {}, r = null, modele = null, secret = hasard(32);
    if (!s || !s.drive) return Promise.reject(souci("Connecte d'abord Origami à Google.", "connexion"));
    dire("chercher");
    return chercherOrigami(s).then(function (x) {
      r = x || { classeur: "", projet: "", deploiement: "", adresse: "" };
      dire("code");
      return lireModele(s);
    }).then(function (m) {
      modele = m;
      // Un modèle plus ancien ne connaît pas le premier contact : on s'arrête avant de créer quoi que ce soit.
      if (!(modele.version >= 10)) throw souci("Le modèle d'Origami n'est pas encore à jour.", "modele-ancien");
      if (r.classeur) return null;
      dire("classeur");
      return drive(s, "POST", "files?fields=id", { name: NOM_CLASSEUR, mimeType: "application/vnd.google-apps.spreadsheet", appProperties: { origami: MARQUE } }).then(function (f) {
        if (!/^[\w-]{20,120}$/.test(String(f.id || ""))) throw souci("Google n'a pas rendu l'identifiant du classeur. Réessaie.", "occupe");
        r.classeur = f.id;
      });
    }).then(function () {
      if (r.projet) return null;
      dire("projet");
      return api(s, "POST", "projects", { title: "Origami", parentId: r.classeur }).then(function (p) {
        if (!/^[\w-]{20,120}$/.test(String(p.scriptId || ""))) throw souci("Google n'a pas rendu l'identifiant du projet. Réessaie.", "occupe");
        r.projet = p.scriptId; return noter(s, r.classeur, { origamiProjet: r.projet });
      });
    }).then(function () { return hacher("premier-contact:" + secret); })
      .then(function (empreinte) {
        dire("contenu");
        var fichiers = modele.fichiers.concat([{ name: "99_Installation", type: "SERVER_JS", source: "// Posé par l'appli Origami à l'installation : l'empreinte du secret du premier contact (le secret, lui, n'est écrit nulle part ici).\nvar INSTALLATION_ = { empreinte: " + JSON.stringify(empreinte) + " };\n" }]);
        return api(s, "PUT", "projects/" + enc(r.projet) + "/content", { files: fichiers });
      })
      .then(function () { dire("version"); return api(s, "POST", "projects/" + enc(r.projet) + "/versions", { description: "Origami installé depuis l'appli" }); })
      .then(function (v) {
        var version = Number(v.versionNumber) || 0; if (!version) throw souci("Google n'a pas rendu le numéro de version. Réessaie.", "occupe");
        dire("ligne");
        var config = { versionNumber: version, manifestFileName: "appsscript", description: "Origami de ce compte" };
        if (r.deploiement) return api(s, "PUT", "projects/" + enc(r.projet) + "/deployments/" + enc(r.deploiement), { deploymentConfig: { scriptId: r.projet, versionNumber: version, manifestFileName: "appsscript", description: config.description } });
        return api(s, "POST", "projects/" + enc(r.projet) + "/deployments", config).then(function (d) {
          if (!/^[\w-]{20,120}$/.test(String(d.deploymentId || ""))) throw souci("Google n'a pas rendu l'identifiant de la publication. Réessaie.", "occupe");
          r.deploiement = d.deploymentId; r.adresse = adresseDe(d) || adresseDeploiement(d.deploymentId);
          return noter(s, r.classeur, { origamiMoteur: r.deploiement });
        });
      })
      .then(function () { return { classeur: r.classeur, projet: r.projet, deploiement: r.deploiement, adresse: r.adresse, secret: secret, version: modele.version }; })
      .catch(function (e) {
        // Le projet noté a été supprimé à la main chez Google : on l'oublie et on repart d'un projet neuf, une seule fois.
        if (e && e.code === "introuvable" && !o.refait && r && r.classeur && r.projet) return noter(s, r.classeur, { origamiProjet: null, origamiMoteur: null }).then(function () { return installerOrigami({ cle: o.cle, dire: o.dire, refait: true }); });
        throw e;
      });
  }

  /**
   * Met l'Origami d'un compte, installé par l'appli, au niveau du modèle (25.11.2026) : même projet, même adresse ; les fichiers
   * propres au compte (99_…, dont l'empreinte du premier contact) sont gardés. o = { cle, dire(etape) }.
   * Étapes dites : chercher, code, contenu, version, ligne. Rend { aJour, version, avant, droits } (droits : le manifeste a changé,
   * le propriétaire devra accepter un nouvel écran de Google).
   */
  function mettreAJourOrigami(o) {
    var s = session(o.cle), dire = o.dire || function () {}, r = null, modele = null, avant = 0, droits = false;
    if (!s || !s.drive) return Promise.reject(souci("Connecte d'abord Origami à Google.", "connexion"));
    dire("chercher");
    return chercherOrigami(s).then(function (x) {
      if (!x || !x.projet || !x.deploiement) throw souci("Origami n'a pas été installé dans ce compte par l'appli : il se met à jour depuis le Mac.", "pas-par-appli");
      r = x; dire("code");
      return lireModele(s);
    }).then(function (m) {
      modele = m;
      return api(s, "GET", "projects/" + enc(r.projet) + "/content");
    }).then(function (c) {
      var files = ((c && c.files) || []).filter(function (f) { return f && TYPES[f.type] && typeof f.source === "string"; });
      var socle = files.filter(function (f) { return f.name === "00_Socle"; })[0], v = socle ? /version:\s*(\d+)/.exec(socle.source) : null;
      avant = v ? Number(v[1]) : 0;
      if (!(modele.version > avant)) return null;
      var garde = files.filter(function (f) { return /^99_[\w .-]{1,76}$/.test(String(f.name)); }).map(function (f) { return { name: f.name, type: f.type, source: f.source }; });
      if (!garde.some(function (f) { return f.name === "99_Installation"; })) throw souci("Cet Origami n'a pas la forme attendue : sa mise à jour se fait depuis le Mac.", "pas-par-appli");
      var portee = function (l) { var a = l.filter(function (f) { return f.name === "appsscript"; })[0]; try { return JSON.stringify((JSON.parse(a.source).oauthScopes || []).slice().sort()); } catch (e) { return ""; } };
      droits = portee(files) !== portee(modele.fichiers);
      dire("contenu");
      return api(s, "PUT", "projects/" + enc(r.projet) + "/content", { files: modele.fichiers.concat(garde) })
        .then(function () { dire("version"); return api(s, "POST", "projects/" + enc(r.projet) + "/versions", { description: "Origami mis à jour depuis l'appli (v" + modele.version + ")" }); })
        .then(function (ver) {
          var n = Number(ver.versionNumber) || 0; if (!n) throw souci("Google n'a pas rendu le numéro de version. Réessaie.", "occupe");
          dire("ligne");
          return api(s, "PUT", "projects/" + enc(r.projet) + "/deployments/" + enc(r.deploiement), { deploymentConfig: { scriptId: r.projet, versionNumber: n, manifestFileName: "appsscript", description: "Origami de ce compte" } });
        });
    }).then(function (fait) { return { aJour: !fait, version: fait ? modele.version : avant, avant: avant, droits: droits }; });
  }

  /**
   * Premier contact avec le moteur tout juste autorisé : il installe le compte et rend la clé de cet appareil.
   * o = { cle, adresse, secret, nom }. Rend { u, c, nom, couleur, range } (range : le classeur est dans son dossier).
   */
  function premierContact(o) {
    var s = session(o.cle);
    if (!s) return Promise.reject(souci("La connexion à Google a expiré.", "expire"));
    return demander(o.adresse, { fn: "installer.premier", args: { secret: o.secret, jeton: s.jeton, adresse: o.adresse, nom: o.nom || "" } }).then(function (p) { return finirLiaison(s, o.adresse, p); });
  }

  /** Un appareil de plus pour un compte déjà installé : le moteur reconnaît le compte Google. o = { cle, adresse, nom }. */
  function relierParGoogle(o) {
    var s = session(o.cle);
    if (!s) return Promise.reject(souci("La connexion à Google a expiré.", "expire"));
    return demander(o.adresse, { fn: "appareil.parGoogle", args: { jeton: s.jeton, nom: o.nom || "" } }).then(function (p) { return finirLiaison(s, o.adresse, p); });
  }

  function finirLiaison(s, adresse, p) {
    if (!p || !/^[a-f0-9]{64}$/.test(String(p.cle || ""))) throw souci("Le moteur n'a pas rendu la clé de cet appareil.", "refus-moteur");
    var lie = { u: adresse, c: p.cle, nom: String(p.nom || "").trim().slice(0, 40), couleur: String(p.couleur || ""), range: !p.ranger };
    var g = p.ranger;
    if (!g || !s.drive || !/^[\w-]{6,120}$/.test(String(g.classeur || "")) || !/^[\w-]{6,120}$/.test(String(g.dossier || ""))) return lie;
    // Le classeur a été créé par la page : elle seule a le droit de le ranger dans le dossier que le moteur vient de créer.
    // Si Google refuse, rien ne casse : le classeur reste à la racine du Drive.
    return drive(s, "GET", "files/" + enc(g.classeur) + "?fields=parents")
      .then(function (f) { return drive(s, "PATCH", "files/" + enc(g.classeur) + "?addParents=" + enc(g.dossier) + "&removeParents=" + enc(((f && f.parents) || []).join(",")) + "&fields=id,parents", {}); })
      .then(function (f) { if (((f && f.parents) || []).indexOf(g.dossier) < 0) throw souci("Le classeur n'a pas bougé.", "rangement"); return demander(adresse, { prise: 1, cle: p.cle, fn: "compte.range", args: { dossier: g.dossier } }); })
      .then(function () { lie.range = true; return lie; }, function () { return lie; });
  }

  /**
   * Avant « Retirer Origami de ce compte » : Google ne laisse pas le moteur jeter un dossier qui contient un fichier créé par une
   * autre appli (vu en vrai le 22.11.2026). La page ressort donc du dossier « Origami » le classeur des réglages qu'elle a créé.
   * o = { cle, id }. Rend true si le classeur est sorti (ou déjà à la corbeille), false si la page ne le voit pas ou si Google refuse.
   */
  function sortirClasseur(o) {
    var s = session(o.cle);
    if (!s || !s.drive || !/^[\w-]{6,120}$/.test(String(o.id || ""))) return Promise.resolve(false);
    return drive(s, "GET", "files/" + enc(o.id) + "?fields=id,parents,trashed").then(function (f) {
      if (f && f.trashed) return true;
      var parents = (f && f.parents) || [];
      if (!parents.length) return false;
      return drive(s, "PATCH", "files/" + enc(o.id) + "?addParents=root&removeParents=" + enc(parents.join(",")) + "&fields=id,parents", {}).then(function () { return true; });
    }).catch(function (e) { if (e && e.code === "expire") throw e; return false; });
  }

  /**
   * Après « Retirer Origami de ce compte » (moteur v11) : ce que le moteur n'a pas pu jeter lui-même et que la page a peut-être
   * créé (le classeur des réglages). La page ne touche QUE les fichiers nommés par le moteur de ce compte : si un autre compte
   * Google a été choisi dans la fenêtre, Google ne les trouve pas et rien ne se passe. Tout va à la corbeille du Drive.
   * o = { cle, reste: [{ id, … }] }. Rend { reste: ce qui reste à faire à la main, vu: la page a vu au moins un de ces fichiers }.
   */
  function jeterReste(o) {
    var s = session(o.cle);
    if (!s || !s.drive) return Promise.reject(souci("Connecte d'abord Origami à Google.", "connexion"));
    var reste = [], vu = false;
    return (o.reste || []).reduce(function (suite, x) {
      return suite.then(function () {
        if (!x || !/^[\w-]{6,120}$/.test(String(x.id || ""))) { if (x) reste.push(x); return null; }
        return drive(s, "GET", "files/" + enc(x.id) + "?fields=id,trashed").then(function (f) {
          vu = true;
          if (f && f.trashed) return null;
          return drive(s, "PATCH", "files/" + enc(x.id) + "?fields=id,trashed", { trashed: true }).then(function (g) { if (!g || !g.trashed) reste.push(x); });
        }).catch(function (e) { if (e && e.code === "expire") throw e; reste.push(x); });
      });
    }, Promise.resolve()).then(function () { return { reste: reste, vu: vu }; });
  }

  /**
   * Effacement total (25.11.2026) : la Boîte mail installée par Origami dans ce compte. Son classeur a été créé par la page : le moteur
   * ne peut pas jeter un dossier qui le contient. La page le ressort donc du dossier « Origami » avant, et le jette après.
   * Rend { classeur, projet, deploiement } ou null (pas de Boîte mail installée par Origami, ou pas visible avec ce compte Google).
   */
  function sortirBoite(o) {
    var s = session(o.cle);
    if (!s || !s.drive) return Promise.resolve(null);
    return chercherBoite(s).then(function (b) {
      if (!b || !b.classeur) return null;
      return sortirClasseur({ cle: o.cle, id: b.classeur }).then(function () { return b; });
    }).catch(function (e) { if (e && e.code === "expire") throw e; return null; });
  }
  /** Après le retrait : la Boîte mail de ce compte cesse de répondre (sa publication est retirée). Ne bloque jamais : rend oui ou non. */
  function arreterBoite(o) {
    var s = session(o.cle), b = o.boite;
    if (!s || !b || !/^[\w-]{20,120}$/.test(String(b.projet || "")) || !/^[\w-]{20,120}$/.test(String(b.deploiement || ""))) return Promise.resolve(false);
    return api(s, "DELETE", "projects/" + enc(b.projet) + "/deployments/" + enc(b.deploiement)).then(function () { return true; }, function () { return false; });
  }

  /** Retire à Origami l'accès donné chez Google pour ce compte (il sera redemandé à la prochaine connexion). Ne bloque jamais : rend oui ou non. */
  function retirerAcces(cle) {
    var s = session(cle); delete sessions[cle];
    if (!s) return Promise.resolve(false);
    // Dans l'appli du Mac, l'outil de Google n'est pas chargé pour se connecter : on le charge ici, seulement pour retirer l'accès.
    var outil = pret() || !coquille() ? Promise.resolve() : new Promise(function (ok) { var g = setTimeout(ok, racine.__sansAttente ? 300 : 8000); chargerGoogle().then(function () { clearTimeout(g); ok(); }, function () { clearTimeout(g); ok(); }); });
    return outil.then(function () { return retirerAccesGoogle(s); });
  }
  function retirerAccesGoogle(s) {
    if (!pret() || typeof racine.google.accounts.oauth2.revoke !== "function") return Promise.resolve(false);
    return new Promise(function (ok) {
      var fini = false, garde = setTimeout(function () { if (!fini) { fini = true; ok(false); } }, racine.__sansAttente ? 300 : 8000);
      try { racine.google.accounts.oauth2.revoke(s.jeton, function (r) { if (fini) return; fini = true; clearTimeout(garde); ok(!(r && r.successful === false)); }); }
      catch (e) { if (!fini) { fini = true; clearTimeout(garde); ok(false); } }
    });
  }

  /** La Compta répond-elle ? Une appli pas encore autorisée par son propriétaire ne répond rien de lisible. */
  function ping(adresse) {
    return fetch(String(adresse) + "?origami=ping", { redirect: "follow" }).then(function (r) { return r.ok ? r.text() : ""; }).then(function (t) { return String(t).trim() === "origami-compta:ok"; }, function () { return false; });
  }

  // ---------- Boîte mail installée dans le compte par Origami (23.11.2026, demande de Sévane : « vas-y ») ----------
  // Avant : une copie du classeur modèle faite à la main, posée à la racine du Drive. Maintenant la page fait tout, comme pour la
  // Compta : le moteur du compte prépare le dossier « Origami/Boîte mail/Données » (prise rangement.preparer, en ligne depuis la v5),
  // la page y crée le classeur, y attache un projet, y pose le code du modèle tel quel, en fait une version et le publie.
  // Premier contact : comme pour Origami, un secret dont le projet ne porte que l'empreinte ; la Boîte mail rend alors le code
  // que l'appli du Mac connaît déjà (boitemail://relier?c=…). Rejouer l'installation met la Boîte mail à jour sur le modèle et
  // donne un nouveau secret : c'est aussi le chemin pour relier un autre Mac.
  var DOPOST = /function\s+doPost\s*\(\s*(\w*)\s*\)\s*\{/g;
  var APPEL_BOITE = "\n  var origami_premier_ = origamiPremier_(arguments[0]); if (origami_premier_) return origami_premier_;   // ajouté par Origami\n";
  function fichierPremierBoite(empreinte) {
    return "// Posé par l'appli Origami à l'installation de cette Boîte mail : l'empreinte du secret du premier contact (le secret, lui, n'est écrit nulle part ici).\n" +
      "var ORIGAMI_BOITE_ = { empreinte: " + JSON.stringify(empreinte) + " };\n" +
      "/** Premier contact avec l'appli Origami qui vient d'installer cette Boîte mail : rend le code pour relier l'appli du Mac. */\n" +
      "function origamiPremier_(e) {\n" +
      "  var q = null;\n" +
      "  try { q = JSON.parse((e && e.postData && e.postData.contents) || '{}'); } catch (x) { return null; }\n" +
      "  if (!q || q.f !== 'origami.premier') return null;\n" +
      "  var rep;\n" +
      "  try {\n" +
      "    var p = PropertiesService.getScriptProperties();\n" +
      "    var h = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, 'boite-premier:' + String(q.secret || ''), Utilities.Charset.UTF_8).map(function (b) { return ('0' + (b & 255).toString(16)).slice(-2); }).join('');\n" +
      "    if (!ORIGAMI_BOITE_.empreinte || h !== ORIGAMI_BOITE_.empreinte) throw new Error('Ce lien ne vaut pas pour cette Boîte mail. Relance l\\'installation depuis Origami.');\n" +
      "    if (p.getProperty('ORIGAMI_PREMIER') === ORIGAMI_BOITE_.empreinte) throw new Error('Cette Boîte mail est déjà reliée avec ce lien. Pour relier un autre Mac, relance l\\'installation depuis Origami.');\n" +
      "    var adr = String(q.adresse || '');\n" +
      "    if (/^https:\\/\\/script\\.google\\.com\\/(a\\/[^\\/]+\\/)?macros\\/s\\/[\\w-]+\\/exec$/.test(adr)) p.setProperty('URL_MOTEUR', adr);\n" +
      "    var r = relierAppli_(true);   // l'adresse est sûre : la page vient de joindre cette Boîte mail par elle\n" +
      "    p.setProperty('ORIGAMI_PREMIER', ORIGAMI_BOITE_.empreinte);\n" +
      "    rep = { ok: true, r: { code: r.code, email: r.email || '' } };\n" +
      "  } catch (err) { rep = { ok: false, erreur: String((err && err.message) || err) }; }\n" +
      "  return ContentService.createTextOutput(JSON.stringify(rep)).setMimeType(ContentService.MimeType.JSON);\n" +
      "}\n";
  }
  function nbDoPost(t) { return (String(t).match(DOPOST) || []).length; }

  /** Le code du modèle « Boîte mail (vierge) », lu avec la connexion de la personne, vérifié dans sa forme. */
  function lireModeleBoite(s) {
    return api(s, "GET", "projects/" + enc(MODELE_BOITE) + "/content").then(function (c) {
      var f = ((c && c.files) || []).filter(function (x) { return x && TYPES[x.type] && /^[\w .-]{1,80}$/.test(String(x.name || "")) && typeof x.source === "string" && !/^99_Origami$/.test(x.name); })
        .map(function (x) { return { name: x.name, type: x.type, source: x.source }; });
      var noms = f.map(function (x) { return x.name; }), serveur = f.filter(function (x) { return x.type === "SERVER_JS"; });
      var tout = serveur.map(function (x) { return x.source; }).join("\n");
      if (noms.indexOf("appsscript") < 0 || noms.indexOf("Index") < 0) throw souci("Le modèle de la Boîte mail est incomplet.", "modele");
      var avecPost = serveur.filter(function (x) { return nbDoPost(x.source) > 0; });
      if (avecPost.length !== 1 || nbDoPost(avecPost[0].source) !== 1 || !/function relierAppli_\s*\(/.test(tout) || !/function adresseRepond_\s*\(/.test(tout))
        throw souci("Le modèle de la Boîte mail a changé de forme : son installation doit être adaptée.", "modele");
      var manifeste; try { manifeste = JSON.parse(f[noms.indexOf("appsscript")].source); } catch (e) { throw souci("Le manifeste du modèle de la Boîte mail est illisible.", "modele"); }
      manifeste.webapp = { access: "ANYONE_ANONYMOUS", executeAs: "USER_DEPLOYING" };
      f[noms.indexOf("appsscript")].source = JSON.stringify(manifeste, null, 2);
      return hacher(f.map(function (x) { return x.name + "\n" + x.source; }).join("\n\u0000")).then(function (h) { return { fichiers: f, empreinte: h.slice(0, 16) }; });
    }, function (e) {
      if (e.code === "introuvable" || e.code === "refus-google") throw souci("Origami n'arrive pas à lire le modèle de la Boîte mail avec ce compte.", "modele", e.statut, e.brut);
      throw e;
    });
  }
  /** La Boîte mail de ce compte installée par Origami : { classeur, projet, deploiement, adresse } ou null. */
  function chercherBoite(s) {
    return drive(s, "GET", "files?pageSize=10&orderBy=createdTime&fields=" + enc("files(id,appProperties)") + "&q=" + enc("appProperties has { key='origami' and value='" + MARQUE_BOITE + "' } and trashed=false")).then(function (l) {
      var f = ((l && l.files) || []).filter(function (x) { return x && /^[\w-]{20,120}$/.test(String(x.id || "")); }).map(function (x) {
        var a = x.appProperties || {}, dep = /^[\w-]{20,120}$/.test(String(a.origamiMoteur || "")) ? a.origamiMoteur : "";
        return { classeur: x.id, projet: /^[\w-]{20,120}$/.test(String(a.origamiProjet || "")) ? a.origamiProjet : "", deploiement: dep, adresse: adresseDeploiement(dep) };
      });
      return f.filter(function (x) { return x.deploiement; })[0] || f[0] || null;
    });
  }
  /**
   * Installe la Boîte mail dans le compte connecté, ou la remet au niveau du modèle. o = { cle, moteur(prise, args), dire(etape) }.
   * Étapes dites : chercher, code, classeur, projet, contenu, version, ligne. Rend { classeur, projet, deploiement, adresse, dossier, secret, premiere }.
   */
  function installerBoite(o) {
    var s = session(o.cle), dire = o.dire || function () {}, r = null, modele = null, secret = hasard(32), dossier = "", premiere = false;
    if (!s || !s.drive) return Promise.reject(souci("Connecte d'abord Origami à Google.", "connexion"));
    dire("chercher");
    return chercherBoite(s).then(function (x) {
      r = x || { classeur: "", projet: "", deploiement: "", adresse: "" };
      premiere = !r.deploiement;
      dire("code");
      return lireModeleBoite(s);
    }).then(function (m) {
      modele = m;
      dire("classeur");
      // Le dossier « Origami/Boîte mail/Données » : préparé par le moteur du compte (il le refait s'il a été mis à la corbeille).
      return Promise.resolve(o.moteur ? o.moteur("rangement.preparer", { appli: "boite" }) : null).then(function (rg) {
        dossier = rg && rg.donnees && /^[\w-]{6,120}$/.test(String(rg.donnees.id || "")) ? rg.donnees.id : "";
        if (r.classeur) return null;
        return drive(s, "POST", "files?fields=id", { name: NOM_BOITE, mimeType: "application/vnd.google-apps.spreadsheet", appProperties: { origami: MARQUE_BOITE } }).then(function (f) {
          if (!/^[\w-]{20,120}$/.test(String(f.id || ""))) throw souci("Google n'a pas rendu l'identifiant du classeur. Réessaie.", "occupe");
          r.classeur = f.id;
        });
      }).then(function () {
        if (!dossier) return null;
        // Rangé dans son dossier ; si Google refuse, il reste à la racine du Drive et rien ne casse.
        return drive(s, "GET", "files/" + enc(r.classeur) + "?fields=parents").then(function (f) {
          var p = (f && f.parents) || [];
          if (p.indexOf(dossier) >= 0) return null;
          return drive(s, "PATCH", "files/" + enc(r.classeur) + "?addParents=" + enc(dossier) + (p.length ? "&removeParents=" + enc(p.join(",")) : "") + "&fields=id", {});
        }).catch(function (e) { if (e && e.code === "expire") throw e; });
      });
    }).then(function () {
      if (r.projet) return null;
      dire("projet");
      return api(s, "POST", "projects", { title: "Boîte mail", parentId: r.classeur }).then(function (p) {
        if (!/^[\w-]{20,120}$/.test(String(p.scriptId || ""))) throw souci("Google n'a pas rendu l'identifiant du projet. Réessaie.", "occupe");
        r.projet = p.scriptId; return noter(s, r.classeur, { origamiProjet: r.projet });
      });
    }).then(function () { return hacher("boite-premier:" + secret); })
      .then(function (empreinte) {
        dire("contenu");
        var fichiers = modele.fichiers.map(function (f) { return f.type === "SERVER_JS" && nbDoPost(f.source) ? { name: f.name, type: f.type, source: f.source.replace(DOPOST, function (m) { return m + APPEL_BOITE; }) } : f; })
          .concat([{ name: "99_Origami", type: "SERVER_JS", source: fichierPremierBoite(empreinte) }]);
        return api(s, "PUT", "projects/" + enc(r.projet) + "/content", { files: fichiers });
      })
      .then(function () { dire("version"); return api(s, "POST", "projects/" + enc(r.projet) + "/versions", { description: "Boîte mail installée depuis Origami" }); })
      .then(function (v) {
        var version = Number(v.versionNumber) || 0; if (!version) throw souci("Google n'a pas rendu le numéro de version. Réessaie.", "occupe");
        dire("ligne");
        if (r.deploiement) return api(s, "PUT", "projects/" + enc(r.projet) + "/deployments/" + enc(r.deploiement), { deploymentConfig: { scriptId: r.projet, versionNumber: version, manifestFileName: "appsscript", description: "Boîte mail de ce compte" } });
        return api(s, "POST", "projects/" + enc(r.projet) + "/deployments", { versionNumber: version, manifestFileName: "appsscript", description: "Boîte mail de ce compte" }).then(function (d) {
          if (!/^[\w-]{20,120}$/.test(String(d.deploymentId || ""))) throw souci("Google n'a pas rendu l'identifiant de la publication. Réessaie.", "occupe");
          r.deploiement = d.deploymentId; r.adresse = adresseDe(d) || adresseDeploiement(d.deploymentId);
        });
      })
      .then(function () { return noter(s, r.classeur, { origamiMoteur: r.deploiement, origamiModele: modele.empreinte }); })
      .then(function () { return { classeur: r.classeur, projet: r.projet, deploiement: r.deploiement, adresse: r.adresse || adresseDeploiement(r.deploiement), dossier: dossier, secret: secret, premiere: premiere, modele: modele.empreinte }; })
      .catch(function (e) {
        if (e && e.code === "introuvable" && !o.refait && r && r.classeur && r.projet) return noter(s, r.classeur, { origamiProjet: null, origamiMoteur: null }).then(function () { return installerBoite({ cle: o.cle, moteur: o.moteur, dire: o.dire, refait: true }); });
        throw e;
      });
  }
  /** La Boîte mail répond-elle ? Pas encore autorisée par son propriétaire, elle ne répond rien de lisible. */
  function pingBoite(adresse) {
    if (!ADRESSE_EXEC.test(String(adresse || ""))) return Promise.resolve(false);
    return fetch(String(adresse), { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify({ f: "etatAcces", jeton: "", args: [] }), redirect: "follow" })
      .then(function (r) { return r.ok ? r.text() : ""; }).then(function (t) { var d = null; try { d = JSON.parse(t); } catch (e) { d = null; } return !!(d && d.ok === true); }, function () { return false; });
  }
  /** Premier contact : la Boîte mail rend le code de l'appli du Mac. o = { adresse, secret }. Rend { code, email, lien }. */
  function relierBoite(o) {
    if (!ADRESSE_EXEC.test(String(o.adresse || "")) || !/^[0-9a-f]{64}$/.test(String(o.secret || ""))) return Promise.reject(souci("L'installation de cette Boîte mail est à reprendre depuis Origami.", "secret"));
    return fetch(String(o.adresse), { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify({ f: "origami.premier", secret: o.secret, adresse: o.adresse }), redirect: "follow" })
      .then(function (r) { return r.text().then(function (t) { var d = null; try { d = JSON.parse(t); } catch (e) { d = null; } if (!r.ok || !d) throw souci("La Boîte mail ne répond pas encore.", "muet"); return d; }); }, function () { throw souci("La Boîte mail ne répond pas encore.", "muet"); })
      .then(function (d) {
        if (!d.ok) throw souci(String(d.erreur || "La Boîte mail a refusé."), "refus");
        var code = String((d.r && d.r.code) || "");
        if (!/^[A-Za-z0-9_-]{20,3000}$/.test(code)) throw souci("La Boîte mail n'a pas rendu de code lisible.", "refus");
        return { code: code, email: String((d.r && d.r.email) || ""), lien: "boitemail://relier?c=" + code };
      });
  }

  var sortie = { charger: charger, installerBoite: installerBoite, pingBoite: pingBoite, relierBoite: relierBoite, _fichierPremierBoite: fichierPremierBoite, _appelBoite: APPEL_BOITE, mettreAJourOrigami: mettreAJourOrigami, connecter: connecter, session: session, oublier: oublier, adopter: adopter, installerCompta: installerCompta, mettreAJourCompta: mettreAJourCompta, ping: ping, lienAutorisation: lienAutorisation,
    chercherOrigami: function (cle) { var s = session(cle); return s && s.drive ? chercherOrigami(s) : Promise.reject(souci("Connecte d'abord Origami à Google.", "connexion")); },
    // La Boîte mail déjà installée dans le compte connecté (par Origami ou par l'appli Boîte mail seule), ou null. Ne crée rien.
    chercherBoite: function (cle) { var s = session(cle); return s && s.drive ? chercherBoite(s).catch(function () { return null; }) : Promise.resolve(null); },
    parPont: function () { return !!coquille(); }, adresseVisee: adresseVisee, deBase64Url: deBase64Url, installerOrigami: installerOrigami, premierContact: premierContact, relierParGoogle: relierParGoogle, pingMoteur: pingMoteur, sortirClasseur: sortirClasseur, sortirBoite: sortirBoite, arreterBoite: arreterBoite, jeterReste: jeterReste, retirerAcces: retirerAcces,
    _verifierRecette: verifierRecette, _codePorte: codePorte, _fichiersCompta: fichiersCompta };
  if (typeof module !== "undefined" && module.exports) module.exports = sortie; else racine.OrigamiGoogle = sortie;
})(typeof window !== "undefined" ? window : this);
