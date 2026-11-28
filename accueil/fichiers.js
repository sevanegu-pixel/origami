// Fichiers d'Origami (25.11.2026) : les fichiers des spectacles d'un compte (dossier de présentation, fiche technique,
// photos, CV…), tels que Spectacle les range, dans un écran à trois panneaux : les spectacles, la liste, la fiche.
//
// D'où viennent-ils : de l'appli du compte (Diffusion de la compagnie, ou les modules Spectacle et Prospection d'un autre
// compte), par sa porte habituelle, en LECTURE seulement (la liste des documents, puis le fichier morceau par morceau).
// Depuis le 28.11 : ajouter, remplacer (l'ancienne version est gardée), renommer et ajouter une variante se font ICI, avec les
// mêmes demandes que la fenêtre « Gérer les fichiers » de Spectacle (même porte, même jeton, mêmes règles côté serveur).
//
// Où sont-ils gardés : sur l'appareil, pour s'ouvrir tout de suite et sans connexion.
//  - Dans l'appli Origami du Mac (0.5 et suivantes) : un vrai dossier du Finder (Documents › Origami › Fichiers, ou celui
//    que la personne choisit), rangé par compte et par spectacle. Retirer un fichier le met à la Corbeille du Mac.
//  - Ailleurs (navigateur, téléphone) : la réserve de l'appli (IndexedDB), 1 Go au plus.
// Pour chaque fichier : « Sur l'appareil et en ligne » (réglage de départ) ou « En ligne seulement ».
// La page Origami donne un pont (window.OrigamiFichiers.montrer(section, pont, compte)) ; rien d'autre ne sort de l'appareil.
(function () {
  "use strict";
  var P = null, racine = null;
  var MO = 1024 * 1024, GO = 1024 * MO;
  var LIMITE = GO;               // gardé d'office : 1 Go au plus (tout compris)
  var AUTO_MAX = 60 * MO;        // gardé d'office : les fichiers de 60 Mo au plus (15 Mo sur un petit écran)
  var AUTO_MAX_PETIT = 15 * MO;
  var APERCU_MAX = 40 * MO;      // aperçu dans la fiche : au plus 40 Mo
  var PDFJS = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/";
  var F = { compte: "", spectacle: "", raccourci: "", doc: "", cherche: "", ecran: "liste", fiche: false, menu: false, form: null };
  var MORCEAU = 8 * 1024 * 1024;   // morceau envoyé par la porte (8 Mo, comme « Gérer les fichiers » hors de Google)
  var SORTES = ["Dossier de présentation", "Fiche technique", "Photos", "Affiche", "Teaser", "Revue de presse", "CV"];
  var D = {};        // par compte : { projets, le, frais, panne, enCours, lu }
  var G = {};        // gardés, par compte : { idFichier: { c: chemin sur le Mac, t: taille, m: repère de version, n: nom, s: spectacle, y: type } }
  var CHOIX = {};    // par compte : { idFichier: "ligne" } (en ligne seulement)
  var VUS = {};      // par compte : { idFichier: repère } (déjà gardé d'office une fois : un fichier retiré à la main n'est pas repris)
  var mac = { su: false, ok: false, ancienne: false, dossier: null };
  var file = [], enVol = null, progres = {}, lourds = {}, pannes = {}, limiteDite = false;
  var vueDocs = [];  // les lignes affichées : les boutons les désignent par leur rang
  var apercu = { cle: "", el: null, url: "" };
  var largeur = "large";

  // ---------- Petits outils ----------
  function texte(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function plat(s) { return String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase(); }
  function poids(o) { o = Number(o) || 0; return o >= GO ? (o / GO).toFixed(1).replace(".", ",") + " Go" : o >= MO ? (o / MO).toFixed(o >= 10 * MO ? 0 : 1).replace(".", ",") + " Mo" : Math.max(1, Math.round(o / 1024)) + " Ko"; }
  var MOIS_C = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."], MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
  function quand(v) {
    if (v == null || v === "") return null;
    var m = /^(\d{1,2})[./](\d{1,2})[./](\d{4})/.exec(String(v));
    var d = m ? new Date(+m[3], +m[2] - 1, +m[1]) : /^\d{11,}$/.test(String(v)) ? new Date(Number(v)) : new Date(v);
    return isNaN(d.getTime()) ? null : d;
  }
  function jourCourt(v) { var d = quand(v); return d ? d.getDate() + " " + MOIS_C[d.getMonth()] + (d.getFullYear() !== new Date().getFullYear() ? " " + d.getFullYear() : "") : ""; }
  function jourLong(v) { var d = quand(v); return d ? (d.getDate() === 1 ? "1er" : d.getDate()) + " " + MOIS[d.getMonth()] + (d.getFullYear() !== new Date().getFullYear() ? " " + d.getFullYear() : "") : ""; }
  function lienSur(u) { return /^https:\/\/[^\s"<>]+$/.test(String(u || "")) ? String(u) : ""; }
  function message(e) { return String((e && e.message) || e || "").replace(/^Error:\s*/, "").slice(0, 220); }
  function lireJ(cle) { try { var o = JSON.parse(localStorage.getItem(cle) || "null"); return o && typeof o === "object" ? o : {}; } catch (e) { return {}; } }
  function ecrireJ(cle, v) { try { localStorage.setItem(cle, JSON.stringify(v)); } catch (e) {} }
  function ici() { return mac.ok ? "ce Mac" : "cet appareil"; }
  function Ici() { return mac.ok ? "Ce Mac" : "Cet appareil"; }
  function petit() { return largeur === "etroit"; }
  function serre() { return largeur !== "large"; }
  function absentsTitre() { return mac.ok ? "Pas encore sur ce Mac" : "Pas sur cet appareil"; }
  function octets(b64) { var bin = atob(b64), a = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i); return a; }

  // ---------- Mémoire de l'appareil ----------
  function gardes(cid) { if (!G[cid]) G[cid] = lireJ("origami_fichiers_garde@" + cid); return G[cid]; }
  function choix(cid) { if (!CHOIX[cid]) CHOIX[cid] = lireJ("origami_fichiers_choix@" + cid); return CHOIX[cid]; }
  function vus(cid) { if (!VUS[cid]) VUS[cid] = lireJ("origami_fichiers_vus@" + cid); return VUS[cid]; }
  function retenir(cid) { ecrireJ("origami_fichiers_garde@" + cid, gardes(cid)); ecrireJ("origami_fichiers_choix@" + cid, choix(cid)); ecrireJ("origami_fichiers_vus@" + cid, vus(cid)); }
  function repere(d) { return String(d.misAJour || "") + "/" + String(d.taille || ""); }
  function garde(cid, d) { var g = d && d.fichierId ? gardes(cid)[d.fichierId] : null; return g || null; }
  function aJour(cid, d) { var g = garde(cid, d); return !!g && g.m === repere(d); }
  function totalGarde() { var t = 0; P.tousComptes().forEach(function (c) { var g = gardes(c.id); for (var k in g) t += Number(g[k].t) || 0; }); return t; }

  // Réserve de l'appli (hors appli du Mac) : les fichiers eux-mêmes, dans la mémoire du navigateur.
  function base() {
    return new Promise(function (ok) {
      try { var q = indexedDB.open("origami-fichiers", 1); q.onupgradeneeded = function () { q.result.createObjectStore("f"); }; q.onsuccess = function () { ok(q.result); }; q.onerror = function () { ok(null); }; } catch (e) { ok(null); }
    });
  }
  function reserve(mode, faire) {
    return base().then(function (db) {
      if (!db) throw new Error("La mémoire de cet appareil n'est pas disponible (navigation privée ?).");
      return new Promise(function (ok, ko) {
        var t = db.transaction("f", mode), q = faire(t.objectStore("f"));
        t.oncomplete = function () { ok(q && q.result); }; t.onerror = t.onabort = function () { ko(new Error("La mémoire de cet appareil est pleine ou refusée.")); };
      });
    });
  }

  // ---------- Appli du Mac : un vrai dossier du Finder ----------
  function natif(cmd, args) { return P.mac(cmd, args || {}).catch(function (e) { throw new Error(message(e) || "L'appli du Mac n'a pas répondu."); }); }
  function connaitreMac() {
    if (mac.su) return Promise.resolve();
    mac.su = true;
    if (!P.mac) return Promise.resolve();
    return P.mac("fichiers_dossier", {}).then(function (d) {
      mac.ok = true; mac.dossier = d;
      // Ce qui avait été gardé dans la réserve de l'appli (avant la 0.5) est repris en ligne, dans le dossier du Finder.
      P.tousComptes().forEach(function (c) {
        var g = gardes(c.id), change = false;
        Object.keys(g).forEach(function (k) { if (g[k].c) return; delete g[k]; delete vus(c.id)[k]; change = true; reserve("readwrite", function (s) { return s.delete(c.id + "/" + k); }).catch(function () {}); });
        if (change) retenir(c.id);
      });
    }, function () { mac.ok = false; mac.ancienne = true; });
  }
  // Nom de dossier ou de fichier acceptable dans le Finder (et par l'appli du Mac, qui refuse tout le reste).
  function propre(s) {
    s = String(s || "").normalize("NFC").replace(/[\/\\:\u0000-\u001f\u007f]/g, "-").replace(/\s+/g, " ").replace(/^[.\s]+/, "").replace(/[.\s]+$/, "");
    if (/\.app$/i.test(s) || /\.origami-en-cours$/i.test(s)) s += "-";
    var ext = (/\.[A-Za-z0-9]{1,8}$/.exec(s) || [""])[0], corps = s.slice(0, s.length - ext.length), enc = new TextEncoder();
    while (corps && enc.encode(corps + ext).length > 180) corps = corps.slice(0, -1);
    return (corps + ext) || "Sans nom";
  }
  function cheminPour(cid, projet, d, nomServeur) {
    // 28.11 (Sévane : « garder le nom donné dans le Finder ») : une nouvelle version prend la place de l'ancienne, sous le nom qu'elle a sur le Mac.
    var deja = gardes(cid)[d.fichierId];
    if (deja && deja.c) return deja.c;
    var nom = propre(d.fichierNom || nomServeur || d.nom), extS = (/\.[A-Za-z0-9]{1,8}$/.exec(String(nomServeur || "")) || [""])[0];
    if (!/\.[A-Za-z0-9]{1,8}$/.test(nom) && extS) nom += extS;
    var dossier = propre(P.nomCompte(cid)) + "/" + propre(projet) + "/", pris = {}, g = gardes(cid);
    for (var k in g) if (k !== d.fichierId && g[k].c) pris[g[k].c.toLowerCase()] = 1;
    var ext = (/\.[A-Za-z0-9]{1,8}$/.exec(nom) || [""])[0], corps = nom.slice(0, nom.length - ext.length), essai = nom, n = 2;
    while (pris[(dossier + essai).toLowerCase()]) essai = corps + " (" + n++ + ")" + ext;
    return dossier + essai;
  }
  // Un fichier déplacé, renommé ou jeté à la main dans le Finder n'est plus « gardé » : il redevient « en ligne ».
  function verifier() {
    if (!mac.ok) return Promise.resolve();
    var liste = [];
    P.tousComptes().forEach(function (c) { var g = gardes(c.id); for (var k in g) if (g[k].c) liste.push([c.id, k, g[k].c]); });
    if (!liste.length) return Promise.resolve();
    return natif("fichiers_etat", { chemins: liste.map(function (x) { return x[2]; }) }).then(function (r) {
      var touches = {}, perdus = [];
      liste.forEach(function (x, i) { if (!r || r[i] == null) perdus.push(x); else gardes(x[0])[x[1]].t = Number(r[i]) || 0; });
      return retrouver(perdus).then(function () {
        perdus.forEach(function (x) { var g = gardes(x[0])[x[1]]; if (g && g.c === x[2]) { delete gardes(x[0])[x[1]]; } touches[x[0]] = 1; });
        Object.keys(touches).forEach(retenir);
      });
    }, function () {});
  }
  // Un fichier renommé à la main dans le Finder (même dossier, même taille, pas suivi par ailleurs) : Origami le suit sous son nouveau nom
  // (28.11). Il faut l'appli Origami du Mac 0.5.1 (commande « fichiers_lister ») ; plus ancienne, il redevient « en ligne » comme avant.
  // Deux candidats possibles : on ne devine pas.
  function retrouver(perdus) {
    if (!perdus.length || mac.sansListe) return Promise.resolve();
    var parDossier = {};
    perdus.forEach(function (x) { var dos = x[2].slice(0, x[2].lastIndexOf("/") + 1); (parDossier[dos] = parDossier[dos] || []).push(x); });
    return Object.keys(parDossier).reduce(function (suite, dos) {
      return suite.then(function () {
        return natif("fichiers_lister", { dossier: dos }).then(function (l) {
          var suivis = {};
          P.tousComptes().forEach(function (c) { var g = gardes(c.id); for (var k in g) if (g[k].c) suivis[g[k].c.toLowerCase()] = 1; });
          var libres = (Array.isArray(l) ? l : []).filter(function (f) { return f && typeof f.nom === "string" && !suivis[(dos + f.nom).toLowerCase()]; });
          parDossier[dos].forEach(function (x) {
            var g = gardes(x[0])[x[1]]; if (!g) return;
            var c = libres.filter(function (f) { return Number(f.taille) === Number(g.t) && Number(g.t) > 0; });
            if (c.length !== 1) return;
            g.c = dos + c[0].nom; g.finder = c[0].nom;
            libres.splice(libres.indexOf(c[0]), 1);
          });
        }, function (e) { if (/inconnue|not found|unknown/i.test(message(e))) mac.sansListe = true; });
      });
    }, Promise.resolve());
  }

  // ---------- Les documents d'un compte ----------
  function charger(cid) {
    var d = D[cid] = D[cid] || { projets: null, le: 0, frais: 0, panne: "", enCours: false, lu: false };
    if (!d.lu) {
      d.lu = true;
      P.copie(cid).then(function (c) { if (c && !d.frais && Array.isArray(c.projets)) { d.projets = c.projets; d.le = c.le; dessiner(); suite(cid); } });
    }
    if (!d.enCours && Date.now() - d.frais > 300000) {
      d.enCours = true;
      P.porte(cid, "donneesTableauDeBord", [false]).then(function (r) {
        d.projets = Array.isArray(r && r.projets) ? r.projets : []; d.le = d.frais = Date.now(); d.panne = "";
      }, function (e) { d.panne = message(e) || "Pas de réponse."; d.frais = Date.now() - 240000; }).then(function () { d.enCours = false; dessiner(); suite(cid); });
    }
  }
  function projets(cid) { var d = D[cid]; return d && Array.isArray(d.projets) ? d.projets.filter(function (p) { return p && typeof p === "object" && p.nom; }) : []; }
  function docsDe(p) { return (Array.isArray(p.documents) ? p.documents : []).filter(function (d) { return d && typeof d === "object" && d.nom; }); }
  function estCV(d) { return /^CV\s+–\s+\S/.test(String(d.nom || "")); }
  function famille(d) { return String(d.famille || (estCV(d) ? "CV" : d.nom)); }
  function variante(d) {
    var f = famille(d), n = String(d.nom);
    if (estCV(d)) return n.replace(/^CV\s+–\s+/, "");
    return n === f ? "Version principale" : n.replace(new RegExp("^" + f.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\s*[–—-]\\s*"), "");
  }
  function sorte(d) {
    if (!d.fichierId) return d.lien ? ["LIEN", "url"] : ["–", "vide"];
    var t = String(d.type || "") + " " + String(d.fichierNom || "").toLowerCase();
    return /pdf/.test(t) ? ["PDF", "pdf"] : /image|\.jpe?g|\.png|\.heic|\.webp/.test(t) ? ["IMG", "img"] : /video|\.mp4|\.mov/.test(t) ? ["VID", "vid"] : /audio|\.mp3|\.wav/.test(t) ? ["SON", "vid"] : /word|document|\.docx?|\.odt/.test(t) ? ["DOC", "doc"] : /sheet|excel|\.xlsx?|\.csv/.test(t) ? ["TAB", "img"] : /zip|compress/.test(t) ? ["ZIP", "fic"] : ["FIC", "fic"];
  }
  function ceMois(d) { var q = quand(d.misAJour), a = new Date(); return !!q && q.getFullYear() === a.getFullYear() && q.getMonth() === a.getMonth(); }
  // Toutes les lignes du compte : { p: spectacle, d: document }
  function lignes(cid) { var l = []; projets(cid).forEach(function (p) { docsDe(p).forEach(function (d) { l.push({ p: p, d: d }); }); }); return l; }
  var RACCOURCIS = [
    ["joints", "Joints aux mails", function (cid, x) { return !!x.d.joindre && !!(x.d.fichierId || x.d.lien); }],
    ["mois", "Modifiés ce mois", function (cid, x) { return !!x.d.fichierId && ceMois(x.d); }],
    ["absents", "Pas encore sur ", function (cid, x) { return !!x.d.fichierId && !aJour(cid, x.d); }]
  ];

  // ---------- Garder sur l'appareil ----------
  // Lit un fichier par la porte de l'appli du compte, morceau par morceau. garder : l'écrit sur l'appareil ; sinon le rend en mémoire.
  function lireEnLigne(t) {
    var cid = t.cid, d = t.d, fid = d.fichierId, morceaux = [], chemin = "", repris = false;
    progres[fid] = 0; majProgres(fid);
    function pas(debut) {
      return P.porte(cid, "apercuMorceau", [fid, debut]).then(function (r) {
        if (r && r.tropLourd) { lourds[fid] = 1; throw new Error("LOURD"); }
        if (!r || r.erreur || typeof r.base64 !== "string") throw new Error((r && r.erreur) || "Lecture impossible.");
        var total = Number(r.taille) || 0, fin = Number(r.fin) || 0, dernier = fin >= total;
        if (fin <= debut && !dernier) throw new Error("Lecture interrompue.");
        var ecrit;
        if (t.garder && mac.ok) {
          if (!chemin) chemin = cheminPour(cid, t.p, d, r.nom);
          ecrit = natif("fichiers_ecrire", { chemin: chemin, base64: r.base64, debut: debut, fin: dernier });
        } else { morceaux.push(octets(r.base64)); ecrit = Promise.resolve(); }
        return ecrit.then(function () {
          progres[fid] = total ? Math.min(99, Math.round(fin / total * 100)) : 50; majProgres(fid);
          if (!dernier) return pas(fin);
          return { taille: total || fin, type: String(r.type || d.type || ""), nom: String(r.nom || d.fichierNom || d.nom) };
        }, function (e) {
          if (message(e) === "REPRENDRE" && !repris) { repris = true; return pas(0); }
          throw e;
        });
      });
    }
    return pas(0).then(function (m) {
      if (!t.garder) return { blob: new Blob(morceaux, { type: m.type }), type: m.type, nom: m.nom };
      var blob = mac.ok ? null : new Blob(morceaux, { type: m.type });
      return (mac.ok ? Promise.resolve() : reserve("readwrite", function (s) { return s.put({ blob: blob, type: m.type, nom: m.nom }, cid + "/" + fid); })).then(function () {
        var ancien = gardes(cid)[fid];
        gardes(cid)[fid] = { c: chemin, t: m.taille, m: repere(d), n: m.nom, s: t.p, y: m.type };
        vus(cid)[fid] = repere(d); delete pannes[fid];
        retenir(cid);
        // Le fichier a changé de nom en ligne : l'ancien exemplaire va à la Corbeille du Mac.
        if (mac.ok && ancien && ancien.c && ancien.c !== chemin) natif("fichiers_retirer", { chemin: ancien.c }).catch(function () {});
        return { type: m.type, nom: m.nom };
      });
    }).then(function (r) { delete progres[fid]; return r; }, function (e) { delete progres[fid]; throw e; });
  }
  function tache(cid, d) { var tous = (enVol ? [enVol] : []).concat(file); for (var i = 0; i < tous.length; i++) if (tous[i].cid === cid && tous[i].d.fichierId === d.fichierId) return tous[i]; return null; }
  function mettreEnFile(cid, p, d, devant) {
    var t = tache(cid, d);
    if (t) return t.promesse;
    t = { cid: cid, p: p, d: d, garder: true };
    t.promesse = new Promise(function (ok, ko) { t.ok = ok; t.ko = ko; });
    t.promesse.catch(function () {});
    if (devant) file.unshift(t); else file.push(t);
    suivant();
    return t.promesse;
  }
  function suivant() {
    if (enVol || !file.length) return;
    var t = enVol = file.shift();
    lireEnLigne(t).then(function (r) { t.ok(r); }, function (e) {
      var m = message(e);
      if (m === "LOURD") { vus(t.cid)[t.d.fichierId] = repere(t.d); retenir(t.cid); }
      else pannes[t.d.fichierId] = m;
      // Limite du jour de Google, ou plus de connexion : inutile d'insister pour les suivants.
      if (/limite du jour|ne répond pas|connexion/i.test(m)) { file.forEach(function (x) { x.ko(e); }); file = []; if (!limiteDite) { limiteDite = true; P.avis(m, true); } }
      t.ko(e);
    }).then(function () { enVol = null; dessinerBientot(); suivant(); });
  }
  // D'office : tout fichier pas trop lourd, tant que le total gardé reste sous 1 Go, une fois par version.
  function garderDOffice(cid) {
    var max = petit() ? AUTO_MAX_PETIT : AUTO_MAX, total = totalGarde();
    try { if (navigator.connection && navigator.connection.saveData) return; } catch (e) {}
    lignes(cid).forEach(function (x) {
      var d = x.d, fid = d.fichierId, t = Number(d.taille) || 0;
      if (!fid || choix(cid)[fid] === "ligne" || aJour(cid, d) || lourds[fid] || tache(cid, d)) return;
      if (vus(cid)[fid] === repere(d) || t > max || total + t > LIMITE) return;
      total += t;
      mettreEnFile(cid, x.p.nom, d, false);
    });
  }
  function suite(cid) { connaitreMac().then(verifier).then(function () { if (D[cid] && D[cid].projets) garderDOffice(cid); dessiner(); }); }
  function lireGarde(cid, d) {
    var g = garde(cid, d);
    if (!g) return Promise.reject(new Error("Ce fichier n'est plus sur " + ici() + "."));
    if (!mac.ok) return reserve("readonly", function (s) { return s.get(cid + "/" + d.fichierId); }).then(function (r) { if (!r || !r.blob) { oublier(cid, d.fichierId); throw new Error("Ce fichier n'est plus sur cet appareil."); } return { blob: r.blob, type: r.type || g.y || "", nom: r.nom || g.n }; });
    var morceaux = [];
    return (function pas(debut) {
      return natif("fichiers_lire", { chemin: g.c, debut: debut, longueur: 3 * MO }).then(function (r) {
        var a = octets(r.base64); morceaux.push(a);
        if (a.length && debut + a.length < r.taille) return pas(debut + a.length);
        return { blob: new Blob(morceaux, { type: g.y || "" }), type: g.y || "", nom: g.n };
      });
    })(0).catch(function (e) { if (/n'est plus/.test(message(e))) oublier(cid, d.fichierId); throw e; });   // jeté ou déplacé à la main : il redevient « en ligne »
  }
  function oublier(cid, fid) { delete gardes(cid)[fid]; retenir(cid); }
  // Retirer de l'appareil : Corbeille du Mac (ou réserve vidée) ; le fichier reste en ligne et passe « en ligne seulement ».
  function retirer(cid, fid) {
    var g = gardes(cid)[fid];
    choix(cid)[fid] = "ligne";
    file = file.filter(function (t) { if (t.cid === cid && t.d.fichierId === fid) { t.ko(new Error("Annulé.")); return false; } return true; });
    if (!g) { retenir(cid); return Promise.resolve(); }
    var fait = g.c && mac.ok ? natif("fichiers_retirer", { chemin: g.c }).catch(function (e) { if (!/n'est plus/.test(message(e))) throw e; }) : reserve("readwrite", function (s) { return s.delete(cid + "/" + fid); });
    return fait.then(function () { oublier(cid, fid); if (apercu.cle.indexOf(cid + "/" + fid + "/") === 0) viderApercu(); });
  }

  // ---------- Gestes ----------
  function choisie() { for (var i = 0; i < vueDocs.length; i++) if (cleDoc(vueDocs[i]) === F.doc) return vueDocs[i]; return null; }
  function cleDoc(x) { return (x.p.id || x.p.nom) + "\n" + x.d.nom; }
  // PDF et images : la visionneuse d'Origami (toutes les pages, zoom, pivoter) ; le reste, l'appli habituelle (28.11, Sévane).
  function visionneuse(d) { var s = sorte(d)[0]; return s === "PDF" || s === "IMG"; }
  function ouvrir(x, avecMac) {
    var cid = F.compte, d = x.d;
    if (!d.fichierId) { if (lienSur(d.lien)) P.dehors(d.lien); return; }
    if (!avecMac && visionneuse(d)) {
      var lire = aJour(cid, d) ? function () { return lireGarde(cid, d); } : function () { return lireEnLigne({ cid: cid, p: x.p.nom, d: d, garder: false }).catch(function (e) { if (message(e) === "LOURD") return { tropLourd: true }; throw e; }); };
      P.apercu().then(function (A) { A.ouvrir({ nom: d.fichierNom || d.nom, lien: lienSur(d.lienFichier), lire: lire }); }, function (e) { P.avis(message(e), true); });
      if (!aJour(cid, d) && choix(cid)[d.fichierId] !== "ligne" && !lourds[d.fichierId]) mettreEnFile(cid, x.p.nom, d, false).then(dessinerBientot, function () {});   // gardé ensuite, comme avant
      return;
    }
    function voir(lire) { P.apercu().then(function (A) { A.ouvrir({ nom: d.fichierNom || d.nom, lien: lienSur(d.lienFichier), lire: lire }); }, function (e) { P.avis(message(e), true); }); }
    function duMac() {
      var g = garde(cid, d);
      return natif("fichiers_ouvrir", { chemin: g.c }).catch(function (e) {
        var m = message(e);
        if (/n'est plus/.test(m)) { oublier(cid, d.fichierId); dessiner(); P.avis("Ce fichier n'est plus dans le dossier du Mac : il est repris en ligne.", true); return ouvrir(x, true); }
        if (/montre-le/.test(m)) return natif("fichiers_montrer", { chemin: g.c }).catch(function (e2) { P.avis(message(e2), true); });
        P.avis(m, true);
      });
    }
    if (aJour(cid, d)) return mac.ok ? duMac() : voir(function () { return lireGarde(cid, d); });
    if (choix(cid)[d.fichierId] === "ligne" || lourds[d.fichierId]) return voir(function () { return lireEnLigne({ cid: cid, p: x.p.nom, d: d, garder: false }).catch(function (e) { if (message(e) === "LOURD") return { tropLourd: true }; throw e; }); });
    // Réglage de départ : il est d'abord gardé sur l'appareil, puis ouvert de là.
    if (mac.ok) { P.avis("Je le récupère…"); return mettreEnFile(cid, x.p.nom, d, true).then(function () { dessiner(); return duMac(); }, function (e) { dessiner(); if (message(e) === "LOURD") { P.avis("Trop lourd pour passer par l'appli : je l'ouvre dans Drive."); if (lienSur(d.lienFichier)) P.dehors(d.lienFichier); } else P.avis(message(e), true); }); }
    voir(function () { return mettreEnFile(cid, x.p.nom, d, true).then(function () { dessiner(); return lireGarde(cid, d); }, function (e) { dessiner(); if (message(e) === "LOURD") return { tropLourd: true }; throw e; }); });
  }
  function reglerChoix(x, valeur) {
    var cid = F.compte, d = x.d, fid = d.fichierId;
    if (!fid) return;
    if (valeur === "ligne") { retirer(cid, fid).then(function () { dessiner(); P.avis(mac.ok ? "Retiré de ce Mac (dans la Corbeille). Il reste en ligne." : "Retiré de cet appareil. Il reste en ligne."); }, function (e) { dessiner(); P.avis(message(e), true); }); dessiner(); return; }
    delete choix(cid)[fid]; delete lourds[fid]; delete pannes[fid]; retenir(cid);
    if (!mac.ok && totalGarde() + (Number(d.taille) || 0) > LIMITE) { P.avis("La réserve de cet appareil est pleine (1 Go). Retire d'abord un fichier dans « Gardé sur cet appareil ».", true); choix(cid)[fid] = "ligne"; retenir(cid); dessiner(); return; }
    mettreEnFile(cid, x.p.nom, d, true).then(function () { dessiner(); }, function (e) { var m = message(e); if (m === "LOURD") { choix(cid)[fid] = "ligne"; retenir(cid); P.avis("Ce fichier dépasse 120 Mo : il ne peut pas passer par l'appli et reste en ligne.", true); } else if (m !== "Annulé.") P.avis(m, true); dessiner(); });
    dessiner();
  }
  function copie(x) {
    var cid = F.compte, d = x.d, g = garde(cid, d);
    if (mac.ok && g) return natif("fichiers_copier", { chemin: g.c }).then(function (v) { if (v) P.avis("Copie enregistrée."); }, function (e) { P.avis(message(e), true); });
    P.avis("Préparation de la copie…");
    (g ? lireGarde(cid, d) : lireEnLigne({ cid: cid, p: x.p.nom, d: d, garder: false })).then(function (r) {
      var u = URL.createObjectURL(r.blob), a = document.createElement("a");
      a.href = u; a.download = r.nom || d.fichierNom || "fichier"; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(u); }, 60000);
    }, function (e) { if (message(e) === "LOURD") { P.avis("Trop lourd pour passer par l'appli : je l'ouvre dans Drive."); if (lienSur(d.lienFichier)) P.dehors(d.lienFichier); } else P.avis(message(e), true); dessiner(); });
  }


  // ---------- Écrire : ajouter, remplacer, renommer, variante (28.11) ----------
  // Les mêmes demandes, dans le même ordre, que la fenêtre « Gérer les fichiers » de Spectacle : le serveur applique ses propres règles
  // (noms en double refusés, ancienne version gardée avant un remplacement, fichier partagé par lien en lecture).
  function memeNom(a, b) { return plat(String(a || "").trim()) === plat(String(b || "").trim()); }
  function projetDe(cid, k) { return projets(cid).filter(function (y) { return (y.id || y.nom) === k; })[0] || null; }
  function lireBase64(blob) {
    return new Promise(function (ok, ko) {
      var r = new FileReader();
      r.onload = function () { var t = String(r.result || ""); ok(t.slice(t.indexOf(",") + 1)); };
      r.onerror = function () { ko(new Error("Le fichier n'a pas pu être lu sur cet appareil.")); };
      r.readAsDataURL(blob);
    });
  }
  // Envoi par morceaux de 8 Mo (chaque morceau réessayé trois fois). suivi(pourcentage). Rend les infos du fichier enregistré.
  function televerser(cid, nomProjet, nomDoc, fichier, remplace, suivi) {
    if (!fichier || !fichier.size) return Promise.reject(new Error("Ce fichier est vide."));
    if (fichier.size > 500 * MO) return Promise.reject(new Error("Fichier trop lourd : 500 Mo au plus."));
    return P.porte(cid, "demarrerTeleversement", [nomProjet, fichier.name, fichier.type || "", fichier.size, nomDoc, remplace || "", ""]).then(function (r) {
      if (!r || !r.id) throw new Error("Google Drive n'a pas ouvert l'envoi. Réessaie.");
      var pas = Math.min(Number(r.morceau) || MORCEAU, MORCEAU);
      function envoyer(debut, essai) {
        return lireBase64(fichier.slice(debut, Math.min(fichier.size, debut + pas))).then(function (b64) {
          return P.porte(cid, "envoyerMorceau", [r.id, debut, b64]);
        }).then(function (m) {
          if (!m) throw new Error("Pas de réponse.");
          if (m.fini) return m;
          var recu = Number(m.recu) || 0;
          if (recu <= debut) throw new Error("Envoi interrompu.");
          if (suivi) suivi(Math.min(99, Math.round(recu / fichier.size * 100)));
          return envoyer(recu, 0);
        }, function (e) {
          if (essai < 2 && !/expiré|refuse|ACCES/i.test(message(e))) return new Promise(function (ok) { setTimeout(ok, 1500 * (essai + 1)); }).then(function () { return envoyer(debut, essai + 1); });
          throw e;
        });
      }
      return envoyer(0, 0);
    }).then(function (fin) {
      if (fin && fin.enregistre === false) throw new Error("Le fichier est parti dans Drive, mais n'a pas été rattaché au spectacle. Recharge la liste et réessaie.");
      return fin;
    });
  }
  function relireApres(cid, k, nomDoc) {
    var d = D[cid]; if (d) { d.frais = 0; d.enCours = false; }
    if (k && nomDoc) { F.spectacle = k; F.raccourci = ""; F.doc = k + "\n" + nomDoc; F.fiche = true; }
    charger(cid);
  }
  function famillesDe(p) {
    var l = [];
    (p ? docsDe(p) : []).forEach(function (d) { var f = famille(d); if (l.indexOf(f) < 0) l.push(f); });
    SORTES.forEach(function (f) { if (!l.some(function (x) { return memeNom(x, f); })) l.push(f); });
    return l;
  }
  function dessinerForm(cid) {
    var o = F.form, ps = projets(cid), p = projetDe(cid, o.spectacle), h = '<div class="f-tete"><button class="f-icone" data-f="form-annuler" aria-label="Annuler">' + ICO.retour + "</button><div><h2>";
    var occupe = o.occupe ? '<p class="f-doux f-cours" role="status">' + texte(o.occupe) + (o.pct != null ? " " + o.pct + " %" : "") + "</p>" : "";
    var souci = o.souci ? '<p class="f-souci" role="alert">' + texte(o.souci) + "</p>" : "";
    if (o.genre === "renommer") {
      h += "Renommer</h2><p>" + texte(o.ancien) + "</p></div></div>";
      h += '<label class="f-champ">Nouveau nom<input id="fNom" type="text" value="' + texte(o.nom != null ? o.nom : o.ancien) + '" autocomplete="off"></label>';
      h += '<p class="f-doux">Le fichier dans Drive prend aussi ce nom. Les campagnes qui le joignent suivent.</p>';
      return h + occupe + souci + '<div class="f-gestes"><button class="bouton" data-f="form-annuler">Annuler</button><button class="bouton fort" data-f="form-ok"' + (o.occupe ? " disabled" : "") + ">Renommer</button></div>";
    }
    var rempl = o.genre === "remplacer";
    var classe = o.genre === "classement";
    h += (rempl ? (o.aFichier ? "Remplacer le fichier" : "Choisir le fichier") : classe ? "Nouveau classement" : o.genre === "variante" ? "Ajouter dans « " + texte(o.sorte) + " »" : "Ajouter un fichier") + "</h2><p>" + texte(rempl ? o.nomDoc : p ? p.nom : "") + "</p></div></div>";
    if (!rempl) {
      h += '<label class="f-champ">Spectacle<select id="fSpectacle"' + (o.genre === "variante" ? " disabled" : "") + ">" + ps.map(function (y) { var k = y.id || y.nom; return '<option value="' + texte(k) + '"' + (k === o.spectacle ? " selected" : "") + ">" + texte(y.nom) + "</option>"; }).join("") + "</select></label>";
      if (classe) h += '<label class="f-champ">Nom du classement<input id="fSorte" type="text" value="' + texte(o.sorte || "") + '" placeholder="Calendrier de création, Plan de feu…" autocomplete="off"></label><p class="f-doux">Un classement regroupe plusieurs fichiers de la même sorte. Tu peux y mettre un premier fichier tout de suite, ou plus tard avec son « + ».</p>';
      else {
        h += '<label class="f-champ">Classement<input id="fSorte" type="text" list="fSortes" value="' + texte(o.sorte || "") + '" placeholder="Dossier de présentation, Fiche technique…" autocomplete="off"' + (o.genre === "variante" ? " readonly" : "") + '></label><datalist id="fSortes">' + famillesDe(p).map(function (f) { return '<option value="' + texte(f) + '">'; }).join("") + "</datalist>";
        var cv = memeNom(o.sorte, "CV");
        h += '<label class="f-champ">' + (cv ? "Nom de la personne" : "Nom de ce fichier dans le classement <small>(facultatif : « anglais », « version courte »…)</small>") + '<input id="fVariante" type="text" value="' + texte(o.variante || "") + '" autocomplete="off"></label>';
      }
    } else if (o.aFichier) h += '<p class="f-doux">L\'ancienne version est gardée dans les versions du document. Le lien Drive ne change pas : les mails déjà partis montrent la nouvelle.</p>';
    h += '<label class="f-champ">' + (classe ? "Premier fichier <small>(facultatif)</small>" : "Fichier") + '<input id="fFichier" type="file"></label>' + (o.fichier ? '<p class="f-doux">' + texte(o.fichier.name) + " · " + poids(o.fichier.size) + "</p>" : "");
    return h + occupe + souci + '<div class="f-gestes"><button class="bouton" data-f="form-annuler"' + (o.occupe ? " disabled" : "") + '>Annuler</button><button class="bouton fort" data-f="form-ok"' + (o.occupe || (!o.fichier && !classe) ? " disabled" : "") + ">" + (rempl ? "Envoyer" : classe ? "Créer" : "Ajouter") + "</button></div>";
  }
  function formOuvrir(genre, x) {
    var cid = F.compte;
    var k0 = F.spectacle || ((projets(cid)[0] || {}).id || (projets(cid)[0] || {}).nom || "");
    if (genre === "ajouter" || genre === "classement") F.form = { genre: genre, spectacle: k0, sorte: "", variante: "" };
    else if (genre === "dans") F.form = { genre: "variante", spectacle: k0, sorte: String(x || ""), variante: "" };
    else if (!x) return;
    if (genre === "dans" || genre === "ajouter" || genre === "classement") {}
    else if (genre === "variante") F.form = { genre: "variante", spectacle: x.p.id || x.p.nom, sorte: famille(x.d), variante: "" };
    else if (genre === "renommer") F.form = { genre: "renommer", spectacle: x.p.id || x.p.nom, ancien: x.d.nom };
    else F.form = { genre: "remplacer", spectacle: x.p.id || x.p.nom, nomDoc: x.d.nom, aFichier: !!x.d.fichierId, fichierId: x.d.fichierId || "" };
    F.fiche = true; dessiner();
    var c = document.getElementById(genre === "renommer" ? "fNom" : genre === "remplacer" ? "fFichier" : genre === "variante" || genre === "dans" ? "fVariante" : "fSorte");
    if (c) { try { c.focus(); } catch (e) {} if (genre === "remplacer") try { c.click(); } catch (e) {} }
  }
  function formLancer() {
    var cid = F.compte, o = F.form; if (!o || o.occupe) return;
    if (o.genre === "deposer") return depotLancer();
    var p = projetDe(cid, o.spectacle);
    if (!p) { o.souci = "Choisis un spectacle."; dessiner(); return; }
    o.souci = "";
    function rate(e) { o.occupe = ""; o.pct = null; o.souci = message(e) || "Ça n'a pas abouti."; dessiner(); }
    function fini(nomDoc, dire) { F.form = null; P.avis(dire); relireApres(cid, p.id || p.nom, nomDoc); dessiner(); }
    function suivi(n) { o.pct = n; var z = racine.querySelector(".f-cours"); if (z) z.textContent = o.occupe + " " + n + " %"; }
    if (o.genre === "renommer") {
      var nv = String((document.getElementById("fNom") || {}).value || "").trim();
      if (!nv) { o.souci = "Donne un nom."; dessiner(); return; }
      if (nv === o.ancien) { F.form = null; dessiner(); return; }
      o.nom = nv; o.occupe = "Je renomme…"; dessiner();
      return P.porte(cid, "renommerDocument", [p.nom, o.ancien, nv]).then(function () { fini(nv.replace(/[,;]+/g, " -").trim(), "Renommé."); }, rate);
    }
    if (!o.fichier && o.genre !== "classement") { o.souci = "Choisis un fichier."; dessiner(); return; }
    if (o.genre === "remplacer") {
      var gardee = "";
      o.occupe = "Envoi…"; o.pct = 0; dessiner();
      return (o.aFichier ? P.porte(cid, "garderVersion", [p.nom, o.nomDoc]) : Promise.resolve(null)).then(function (v) {
        gardee = v && v.version ? v.version : "";
        return televerser(cid, p.nom, o.nomDoc, o.fichier, o.fichierId, suivi);
      }).then(function () { fini(o.nomDoc, o.aFichier ? "Nouvelle version envoyée. L'ancienne est gardée." : "Fichier ajouté."); }, function (e) {
        if (gardee) P.porte(cid, "supprimerFichierDoc", [p.nom, o.nomDoc, gardee]).catch(function () {});   // comme « Gérer les fichiers » : la copie gardée pour rien repart
        rate(e);
      });
    }
    var sorte = String(o.sorte || "").trim(), variante = String(o.variante || "").trim();
    if (!sorte) { o.souci = o.genre === "classement" ? "Donne un nom au classement." : "Dis dans quel classement le ranger."; dessiner(); return; }
    if (o.genre === "classement") {
      if (docsDe(p).some(function (d) { return memeNom(famille(d), sorte); })) { o.souci = "« " + sorte + " » existe déjà dans ce spectacle : ajoute tes fichiers avec son « + »."; dessiner(); return; }
      o.occupe = o.fichier ? "Envoi…" : "Je crée le classement…"; o.pct = o.fichier ? 0 : null; dessiner();
      return P.porte(cid, "ajouterVariante", [p.nom, sorte, ""]).then(function (r) {
        var n0 = (r && r.nom) || sorte;
        if (!o.fichier) return fini(n0, "Classement « " + n0 + " » créé.");
        return televerser(cid, p.nom, n0, o.fichier, "", suivi).then(function () { fini(n0, "Classement « " + n0 + " » créé, avec son premier fichier."); });
      }).then(null, function (e) { relireApres(cid, "", ""); rate(e); });
    }
    if (memeNom(sorte, "CV") && !variante) { o.souci = "Pour un CV, donne le nom de la personne."; dessiner(); return; }
    SORTES.concat(famillesDe(p)).forEach(function (f) { if (memeNom(f, sorte)) sorte = f; });   // l'écriture de la liste, pas celle tapée
    var nom = variante ? sorte + " – " + variante : sorte, deja = docsDe(p).filter(function (d) { return memeNom(d.nom, nom); })[0];
    if (deja && deja.fichierId) { o.souci = "« " + deja.nom + " » existe déjà. Donne un nom de variante, ou choisis-le dans la liste et remplace-le."; dessiner(); return; }
    o.occupe = "Envoi…"; o.pct = 0; dessiner();
    (deja ? Promise.resolve({ nom: deja.nom }) : P.porte(cid, "ajouterVariante", [p.nom, sorte, variante])).then(function (r) {
      nom = (r && r.nom) || nom;
      return televerser(cid, p.nom, nom, o.fichier, "", suivi);
    }).then(function () { fini(nom, "Fichier ajouté à « " + p.nom + " »."); }, function (e) {
      if (!deja) relireApres(cid, "", "");   // la ligne a pu être créée sans fichier : elle apparaît « à fournir », on peut y remettre le fichier
      rate(e);
    });
  }

  // ---------- Glisser-déposer (28.11, Sévane : « je le dépose dans l'élément et ça me propose comment le classer ») ----------
  // Sur un fichier de la liste : remplacer (l'ancienne version est gardée), ou l'ajouter à côté dans le même classement, ou un nouveau
  // classement. Sur le titre d'un classement : dedans. Ailleurs dans la liste : « Ajouter un fichier », déjà rempli. Plusieurs fichiers :
  // tous dans le même classement, chacun sous son nom.
  function sansExt(n) { return String(n || "").replace(/\.[A-Za-z0-9]{1,8}$/, "").replace(/[,;]+/g, " -").trim(); }
  function cibleDepot(t) { var z = t && t.closest ? t.closest("[data-depot]") : null; return z && racine.contains(z) ? z : null; }
  function avecFichiers(ev) { try { return Array.prototype.indexOf.call(ev.dataTransfer.types || [], "Files") >= 0; } catch (e) { return false; } }
  var survole = null;
  function marquer(z) { if (survole === z) return; if (survole) survole.classList.remove("f-depot-ici"); survole = z; if (z) z.classList.add("f-depot-ici"); }
  function dessus(ev) {
    if (!avecFichiers(ev) || !F.compte || F.ecran !== "liste" || (F.form && F.form.occupe)) return;
    ev.preventDefault(); try { ev.dataTransfer.dropEffect = "copy"; } catch (e) {}
    marquer(cibleDepot(ev.target) || racine.querySelector(".f-liste"));
  }
  function sortie(ev) { if (!ev.relatedTarget || !racine.contains(ev.relatedTarget)) marquer(null); }
  function depot(ev) {
    if (!avecFichiers(ev)) return;
    ev.preventDefault(); marquer(null);
    if (!F.compte || F.ecran !== "liste" || (F.form && F.form.occupe)) return;
    var l = Array.prototype.slice.call((ev.dataTransfer && ev.dataTransfer.files) || []).filter(function (f) { return f && f.size; });
    if (!l.length) { P.avis("Rien à ajouter : dépose des fichiers (pas un dossier).", true); return; }
    var z = cibleDepot(ev.target), cid = F.compte, k = F.spectacle;
    if (z && z.getAttribute("data-depot") === "doc") {
      var x = vueDocs[+z.getAttribute("data-f-doc")]; if (!x) return;
      k = x.p.id || x.p.nom;
      F.form = { genre: "deposer", spectacle: k, fichiers: l, nomDoc: x.d.nom, aFichier: !!x.d.fichierId, fichierId: x.d.fichierId || "", sorte: famille(x.d), choix: l.length > 1 ? "variante" : x.d.fichierId ? "remplacer" : "dedans", variante: l.length > 1 ? "" : sansExt(l[0].name) };
    } else if (z && z.getAttribute("data-depot") === "famille") {
      var f = z.getAttribute("data-famille"), p = projetDe(cid, k), base = p ? docsDe(p).filter(function (d) { return memeNom(d.nom, f); })[0] : null;
      F.form = { genre: "deposer", spectacle: k, fichiers: l, nomDoc: base ? base.nom : "", aFichier: !!(base && base.fichierId), fichierId: base ? base.fichierId || "" : "", sorte: f, choix: base && !base.fichierId && l.length === 1 ? "dedans" : "variante", variante: l.length > 1 ? "" : sansExt(l[0].name) };
    } else {
      if (!projets(cid).length) return;
      F.form = { genre: "deposer", spectacle: k || ((projets(cid)[0] || {}).id || (projets(cid)[0] || {}).nom), fichiers: l, nomDoc: "", sorte: "", choix: "classement", variante: l.length > 1 ? "" : sansExt(l[0].name) };
    }
    F.fiche = true; dessiner();
  }
  function dessinerDepot(cid) {
    var o = F.form, p = projetDe(cid, o.spectacle), n = o.fichiers.length, un = n === 1;
    var h = '<div class="f-tete"><button class="f-icone" data-f="form-annuler" aria-label="Annuler">' + ICO.retour + "</button><div><h2>" + (un ? texte(o.fichiers[0].name) : n + " fichiers") + "</h2><p>" + texte(p ? p.nom : "") + " · " + poids(o.fichiers.reduce(function (t, f) { return t + f.size; }, 0)) + "</p></div></div>";
    h += '<p class="f-doux" style="margin-top:12px">Où le ranger ?</p><div class="f-choix-depot" role="radiogroup">';
    function choix(v, titre, plus) { return '<label class="f-option"><input type="radio" name="fDepot" value="' + v + '"' + (o.choix === v ? " checked" : "") + "> <span>" + titre + (plus ? '<small>' + plus + "</small>" : "") + "</span></label>"; }
    if (o.nomDoc && un && o.aFichier) h += choix("remplacer", "Remplacer « " + texte(o.nomDoc) + " »", "Nouvelle version au même lien. L'ancienne est gardée dans ses versions.");
    if (o.nomDoc && un && !o.aFichier) h += choix("dedans", "Le mettre dans « " + texte(o.nomDoc) + " »", "Cet élément attend encore son fichier.");
    if (o.sorte) h += choix("variante", (un ? "L'ajouter" : "Les ajouter") + " à côté, dans « " + texte(o.sorte) + " »", un ? "Une autre version : autre langue, autre format…" : "Chacun sous son nom de fichier.");
    h += choix("classement", "Nouveau classement", un ? "Un nouveau groupe de fichiers dans ce spectacle." : "Un nouveau groupe avec ces " + n + " fichiers.");
    if (!o.nomDoc && !o.sorte) h += choix("existant", "Dans un classement qui existe déjà");
    h += "</div>";
    if (!o.nomDoc && !o.sorte || o.choix === "existant") h += '<label class="f-champ">Spectacle<select id="fSpectacle">' + projets(cid).map(function (y) { var kk = y.id || y.nom; return '<option value="' + texte(kk) + '"' + (kk === o.spectacle ? " selected" : "") + ">" + texte(y.nom) + "</option>"; }).join("") + "</select></label>";
    if (o.choix === "classement") h += '<label class="f-champ">Nom du classement<input id="fClasse" type="text" value="' + texte(o.classe || "") + '" placeholder="Calendrier de création…" autocomplete="off"></label>';
    if (o.choix === "existant") h += '<label class="f-champ">Classement<select id="fExistant">' + famillesDe(p).filter(function (f) { return p && docsDe(p).some(function (d) { return memeNom(famille(d), f); }); }).map(function (f) { return '<option' + (f === o.existant ? " selected" : "") + ">" + texte(f) + "</option>"; }).join("") + "</select></label>";
    if (un && (o.choix === "variante" || o.choix === "existant")) h += '<label class="f-champ">Nom de ce fichier dans le classement<input id="fVariante" type="text" value="' + texte(o.variante || "") + '" autocomplete="off"></label>';
    var occupe = o.occupe ? '<p class="f-doux f-cours" role="status">' + texte(o.occupe) + (o.pct != null ? " " + o.pct + " %" : "") + "</p>" : "";
    return h + occupe + (o.souci ? '<p class="f-souci" role="alert">' + texte(o.souci) + "</p>" : "") + '<div class="f-gestes"><button class="bouton" data-f="form-annuler"' + (o.occupe ? " disabled" : "") + '>Annuler</button><button class="bouton fort" data-f="form-ok"' + (o.occupe ? " disabled" : "") + ">Ranger</button></div>";
  }
  // Le choix fait, chaque fichier passe par les mêmes chemins que les boutons (remplacer, variante, classement).
  function depotLancer() {
    var cid = F.compte, o = F.form, p = projetDe(cid, o.spectacle);
    if (!p) { o.souci = "Choisis un spectacle."; dessiner(); return; }
    var l = o.fichiers.slice(), choixF = o.choix, sorte = o.sorte, faits = 0, premier = "";
    if (choixF === "existant") { sorte = o.existant || ((document.getElementById("fExistant") || {}).value || ""); if (!sorte) { o.souci = "Ce spectacle n'a pas encore de classement : choisis « Nouveau classement »."; dessiner(); return; } choixF = "variante"; }
    if (choixF === "classement") {
      sorte = String(o.classe || "").trim();
      if (!sorte) { o.souci = "Donne un nom au classement."; dessiner(); return; }
      if (docsDe(p).some(function (d) { return memeNom(famille(d), sorte); })) { o.souci = "« " + sorte + " » existe déjà : choisis « Dans un classement qui existe déjà »."; dessiner(); return; }
    }
    if (choixF === "variante" && l.length === 1 && !String(o.variante || "").trim()) { o.souci = "Donne un nom à ce fichier dans le classement."; dessiner(); return; }
    o.souci = ""; o.occupe = "Envoi…"; o.pct = 0; dessiner();
    function suivi(n) { o.pct = n; var z = racine.querySelector(".f-cours"); if (z) z.textContent = o.occupe + " " + n + " %"; }
    function un(f, i) {
      o.occupe = l.length > 1 ? "Envoi " + (i + 1) + " sur " + l.length + "…" : "Envoi…"; o.pct = 0; dessiner();
      if (choixF === "remplacer" || choixF === "dedans") {
        var gardee = "";
        return (o.aFichier ? P.porte(cid, "garderVersion", [p.nom, o.nomDoc]) : Promise.resolve(null)).then(function (v) { gardee = v && v.version ? v.version : ""; return televerser(cid, p.nom, o.nomDoc, f, o.fichierId, suivi); })
          .then(function () { premier = o.nomDoc; }, function (e) { if (gardee) P.porte(cid, "supprimerFichierDoc", [p.nom, o.nomDoc, gardee]).catch(function () {}); throw e; });
      }
      var nomV = l.length === 1 ? String(o.variante || "").trim() : sansExt(f.name);
      if (choixF === "classement" && i === 0) nomV = "";   // le premier fichier porte le nom du classement (sa version principale)
      var nom = nomV ? sorte + " – " + nomV : sorte, deja = docsDe(p).filter(function (d) { return memeNom(d.nom, nom); })[0];
      if (deja && deja.fichierId) { nom = nom + " (" + (i + 2) + ")"; nomV = nomV ? nomV + " (" + (i + 2) + ")" : String(i + 2); deja = null; }
      return (deja ? Promise.resolve({ nom: deja.nom }) : P.porte(cid, "ajouterVariante", [p.nom, sorte, nomV])).then(function (r) {
        nom = (r && r.nom) || nom; if (!premier) premier = nom;
        return televerser(cid, p.nom, nom, f, "", suivi);
      });
    }
    l.reduce(function (suite, f, i) { return suite.then(function () { return un(f, i).then(function () { faits++; }); }); }, Promise.resolve()).then(function () {
      F.form = null; P.avis(faits > 1 ? faits + " fichiers rangés dans « " + p.nom + " »." : "Rangé dans « " + p.nom + " »."); relireApres(cid, p.id || p.nom, premier); dessiner();
    }, function (e) {
      o.occupe = ""; o.pct = null; o.souci = (faits ? faits + " fichier(s) rangé(s), puis : " : "") + (message(e) || "Ça n'a pas abouti."); relireApres(cid, "", ""); o.fichiers = l.slice(faits); dessiner();
    });
  }
  function formSaisie(t) {
    var o = F.form; if (!o) return false;
    if (t.id === "fSpectacle") { o.spectacle = t.value; dessiner(); return true; }
    if (t.name === "fDepot") { o.choix = t.value; o.souci = ""; dessiner(); return true; }
    if (t.id === "fClasse") { o.classe = t.value; return true; }
    if (t.id === "fExistant") { o.existant = t.value; return true; }
    if (t.id === "fSorte") { var avant = memeNom(o.sorte, "CV"); o.sorte = t.value; if (avant !== memeNom(o.sorte, "CV")) { dessiner(); var c = document.getElementById("fSorte"); if (c) { c.focus(); try { c.setSelectionRange(c.value.length, c.value.length); } catch (e) {} } } return true; }
    if (t.id === "fVariante") { o.variante = t.value; return true; }
    if (t.id === "fNom") { o.nom = t.value; return true; }
    if (t.id === "fFichier") { o.fichier = t.files && t.files[0] ? t.files[0] : null; o.souci = ""; dessiner(); return true; }
    return false;
  }

  // ---------- Largeur des colonnes (28.11, Sévane : « gérer la largeur de chacune des choses », comme dans la Boîte mail) ----------
  var LARG = lireJ("origami_fichiers_largeurs");
  function largeursCss() {
    if (largeur !== "large") return "";
    var a = Number(LARG.a) || 0, b = Number(LARG.b) || 0, v = "";
    if (a) v += "--f-c1:" + a + "px;";
    if (b) v += "--f-c2:" + b + "px;";
    return v ? ' style="' + v + '"' : "";
  }
  function poignee(n) { return largeur === "large" ? '<div class="f-poignee" data-poignee="' + n + '" role="separator" aria-orientation="vertical" aria-label="Glisser pour régler la largeur" title="Glisser pour régler la largeur · double-clic : largeur d\'origine"></div>' : ""; }
  function glisser(ev) {
    var h = ev.target.closest && ev.target.closest("[data-poignee]"); if (!h || !racine.contains(h)) return;
    ev.preventDefault();
    var zone = racine.querySelector(".f-zone"), n = h.getAttribute("data-poignee"), cols = zone.children, x0 = ev.clientX;
    var a0 = cols[0].getBoundingClientRect().width, b0 = cols[2] ? cols[2].getBoundingClientRect().width : 0, tout = zone.getBoundingClientRect().width;
    try { h.setPointerCapture(ev.pointerId); } catch (e) {}
    h.classList.add("tire");
    function bouge(e) {
      var dx = e.clientX - x0;
      if (n === "1") { var a = Math.max(150, Math.min(420, a0 + dx)); if (tout - a - (F.ecran === "mac" ? 0 : b0) < 300) return; LARG.a = Math.round(a); zone.style.setProperty("--f-c1", LARG.a + "px"); }
      else { var b = Math.max(260, b0 + dx); if (tout - a0 - b < 300) return; LARG.b = Math.round(b); zone.style.setProperty("--f-c2", LARG.b + "px"); }
    }
    function lache() { h.classList.remove("tire"); h.removeEventListener("pointermove", bouge); h.removeEventListener("pointerup", lache); h.removeEventListener("pointercancel", lache); ecrireJ("origami_fichiers_largeurs", LARG); var x = choisie(); if (x) { viderApercu(); poserApercu(x); } }
    h.addEventListener("pointermove", bouge); h.addEventListener("pointerup", lache); h.addEventListener("pointercancel", lache);
  }
  function largeurOrigine(ev) {
    var h = ev.target.closest && ev.target.closest("[data-poignee]"); if (!h) return;
    if (h.getAttribute("data-poignee") === "1") delete LARG.a; else delete LARG.b;
    ecrireJ("origami_fichiers_largeurs", LARG); dessiner();
  }

  // ---------- Aperçu dans la fiche (seulement pour un fichier gardé : rien n'est téléchargé pour un simple clic) ----------
  function viderApercu() { if (apercu.url) { try { URL.revokeObjectURL(apercu.url); } catch (e) {} } apercu = { cle: "", el: null, url: "" }; }
  function pdfjs() {
    if (window.pdfjsLib && window.pdfjsLib.GlobalWorkerOptions && window.pdfjsLib.GlobalWorkerOptions.workerSrc) return Promise.resolve(window.pdfjsLib);
    return new Promise(function (ok, ko) {
      var s = document.createElement("script"); s.src = PDFJS + "pdf.min.js";
      s.onload = function () {
        var lib = window.pdfjsLib; if (!lib) return ko(new Error("pdf"));
        fetch(PDFJS + "pdf.worker.min.js").then(function (r) { return r.text(); }).then(function (code) { lib.GlobalWorkerOptions.workerSrc = URL.createObjectURL(new Blob([code], { type: "text/javascript" })); })
          .catch(function () { lib.GlobalWorkerOptions.workerSrc = PDFJS + "pdf.worker.min.js"; }).then(function () { ok(lib); });
      };
      s.onerror = function () { ko(new Error("pdf")); };
      document.head.appendChild(s);
    });
  }
  function poserApercu(x) {
    var z = racine.querySelector(".f-apercu");
    if (!z) return;
    var cid = F.compte, d = x.d, g = garde(cid, d);
    if (!g || !aJour(cid, d)) { viderApercu(); z.innerHTML = d.fichierId ? '<p class="f-doux">' + (tache(cid, d) ? "Récupération en cours…" : "Ce fichier est en ligne. " + ICO.voir + " le montre.") + "</p>" : ""; return; }
    var s = sorte(d)[0], cle = cid + "/" + d.fichierId + "/" + g.m;
    if (s !== "PDF" && s !== "IMG") { viderApercu(); z.innerHTML = '<p class="f-doux">Pas d\'aperçu ici pour ce type de fichier. « Ouvrir » le montre.</p>'; return; }
    if ((Number(g.t) || 0) > APERCU_MAX) { viderApercu(); z.innerHTML = '<p class="f-doux">Fichier lourd : « Ouvrir » le montre.</p>'; return; }
    if (apercu.cle === cle && apercu.el) { z.innerHTML = ""; z.appendChild(apercu.el); return; }
    viderApercu(); apercu.cle = cle;
    z.innerHTML = '<p class="f-doux">Aperçu…</p>';
    lireGarde(cid, d).then(function (r) {
      if (apercu.cle !== cle) return;
      if (s === "IMG") {
        var im = document.createElement("img"); im.alt = ""; apercu.url = URL.createObjectURL(r.blob); im.src = apercu.url;
        var bi = document.createElement("button"); bi.className = "f-voir-tout"; bi.setAttribute("data-f", "ouvrir"); bi.title = "Voir en entier"; bi.appendChild(im); apercu.el = bi;
        return;
      }
      return r.blob.arrayBuffer().then(function (ab) { return pdfjs().then(function (lib) { return lib.getDocument({ data: new Uint8Array(ab) }).promise; }); }).then(function (doc) {
        return doc.getPage(1).then(function (page) {
          var v0 = page.getViewport({ scale: 1 }), cible = Math.min(900, Math.max(320, (racine.querySelector(".f-apercu") || z).clientWidth || 400) * (window.devicePixelRatio || 1));
          var v = page.getViewport({ scale: cible / v0.width }), c = document.createElement("canvas");
          c.width = Math.round(v.width); c.height = Math.round(v.height);
          return page.render({ canvasContext: c.getContext("2d"), viewport: v }).promise.then(function () {
            if (apercu.cle !== cle) return;
            var boite = document.createElement("button"); boite.className = "f-voir-tout"; boite.setAttribute("data-f", "ouvrir"); boite.title = "Voir en entier"; boite.appendChild(c);
            var n = document.createElement("p"); n.className = "f-doux"; n.textContent = (doc.numPages > 1 ? "Page 1 sur " + doc.numPages + " · " : "") + "clique pour tout voir"; boite.appendChild(n);
            apercu.el = boite;
          });
        });
      });
    }).then(function () {
      if (apercu.cle !== cle) return;
      var z2 = racine.querySelector(".f-apercu"); if (!z2) return;
      z2.innerHTML = ""; if (apercu.el) z2.appendChild(apercu.el);
    }, function (e) {
      if (apercu.cle !== cle) return;
      var z2 = racine.querySelector(".f-apercu"), m = message(e);
      if (/n'est plus/.test(m)) { viderApercu(); if (!garde(cid, d)) dessinerBientot(); return; }
      if (z2) z2.innerHTML = '<p class="f-doux">Aperçu impossible ici. « Ouvrir » le montre.</p>';
    });
  }

  // ---------- Dessin ----------
  var ICO = {
    cherche: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/></svg>',
    plus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
    coche: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
    retour: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14.5 5.5L8 12l6.5 6.5"/></svg>',
    croix: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    voir: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/></svg>',
    finder: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 7.5a2 2 0 0 1 2-2h4l2 2h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z"/></svg>',
    appli: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13.5 4.5h6v6M19.5 4.5l-8 8M17.5 13.5v5a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1v-11a1 1 0 0 1 1-1h5"/></svg>',
    drive: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 18.5h10.5a4 4 0 0 0 .6-7.95A6 6 0 0 0 6.6 9.2 4.7 4.7 0 0 0 7 18.5z"/></svg>',
    copie: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4.5v10M7.5 10.5l4.5 4.5 4.5-4.5M5 19.5h14"/></svg>',
    remplacer: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19.5v-10M7.5 13.5L12 9l4.5 4.5M5 4.5h14"/></svg>',
    renommer: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4.5 19.5l1-4.5L15.5 5l3.5 3.5-10 10z"/><path d="M13 7.5l3.5 3.5"/></svg>',
    variante: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8.5" y="8.5" width="11" height="11" rx="2"/><path d="M15.5 8.5v-2a2 2 0 0 0-2-2h-7a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h2"/></svg>'
  };
  function pic(f, ico, titre, plus) { return '<button class="f-pic" data-f="' + f + '"' + (plus || "") + ' title="' + texte(titre) + '" aria-label="' + texte(titre) + '">' + ICO[ico] + "</button>"; }
  function etatLigne(cid, d) {
    if (!d.fichierId) return d.lien ? '<span class="f-etat">en ligne</span>' : '<span class="f-etat manque">à fournir</span>';
    var fid = d.fichierId;
    if (progres[fid] != null || tache(cid, d)) return '<span class="f-etat cours" data-f-progres="' + texte(fid) + '">' + (progres[fid] != null ? progres[fid] + " %" : "en attente") + "</span>";
    if (aJour(cid, d)) return '<span class="f-etat ici" title="Gardé sur ' + ici() + '">' + ICO.coche + (serre() ? "" : " sur " + ici()) + "</span>";
    if (pannes[fid]) return '<span class="f-etat manque" title="' + texte(pannes[fid]) + '">en ligne</span>';
    return '<span class="f-etat">en ligne</span>';
  }
  function majProgres(fid) { if (!racine) return; var el = racine.querySelector('[data-f-progres="' + String(fid).replace(/["\\]/g, "") + '"]'); if (el) el.textContent = (progres[fid] != null ? progres[fid] : 0) + " %"; }
  function ligneDoc(cid, x, i, plusieurs, avecSpectacle) {
    var d = x.d, s = sorte(d), sous;
    if (d.fichierId) sous = [estCV(d) && d.role ? d.role : "", d.fichierNom || "fichier", d.taille ? poids(d.taille) : "", jourCourt(d.misAJour)].filter(Boolean).join(" · ");
    else sous = d.lien ? "lien : " + String(d.lien).replace(/^https?:\/\//, "").slice(0, 44) : "aucun fichier pour l'instant";
    if (avecSpectacle) sous = x.p.nom + " · " + sous;
    return '<button class="f-rang' + (cleDoc(x) === F.doc ? " ouvert" : "") + '" data-f-doc="' + i + '" data-depot="doc"><span class="f-sorte ' + s[1] + '">' + s[0] + '</span><span class="f-qui"><strong>' + texte(avecSpectacle ? (famille(d) === d.nom || estCV(d) ? d.nom : d.nom) : variante(d)) + "</strong><span>" + texte(sous) + '</span></span><span class="f-marques">' +
      (plusieurs && d.parDefaut ? '<span class="f-puce bleu">par défaut</span>' : "") + (d.joindre && !serre() ? '<span class="f-puce vert">joint</span>' : "") + etatLigne(cid, d) + "</span></button>";
  }
  function dessinerListe(cid) {
    var h = "", q = plat(F.cherche.trim()), tous = lignes(cid), rac = RACCOURCIS.filter(function (r) { return r[0] === F.raccourci; })[0];
    vueDocs = [];
    function garde2(x) { return !q || plat([x.d.nom, x.d.fichierNom, x.d.role, x.p.nom, x.d.lien].join(" ")).indexOf(q) >= 0; }
    if (q || rac) {
      var l = tous.filter(function (x) { return q ? garde2(x) : rac[2](cid, x); });   // la recherche porte sur tous les fichiers du compte
      if (!l.length) return '<p class="f-vide">' + (q ? "Aucun fichier ne correspond." : rac[0] === "absents" ? "Tout est sur " + ici() + "." : "Aucun fichier ici.") + "</p>";
      h += '<h3 class="f-famille"><span>' + texte(q ? "Résultats" : rac[0] === "absents" ? absentsTitre() : rac[1]) + "</span></h3>";
      l.forEach(function (x) { vueDocs.push(x); h += ligneDoc(cid, x, vueDocs.length - 1, true, true); });
      return h;
    }
    var p = projets(cid).filter(function (y) { return (y.id || y.nom) === F.spectacle; })[0];
    if (!p) return '<p class="f-vide">Choisis un spectacle.</p>';
    var ordre = [], par = {};
    docsDe(p).forEach(function (d) { var f = famille(d); if (!par[f]) { par[f] = []; ordre.push(f); } par[f].push(d); });
    ordre.sort(function (a, b) { return (a === "CV") - (b === "CV"); });
    h += '<div class="f-classer"><button class="lien" data-f="classement">' + ICO.plus + " Nouveau classement</button></div>";
    if (!ordre.length) return h + '<p class="f-vide">Ce spectacle n\'a pas encore de fichier. « Ajouter un fichier » ou « Nouveau classement » pour commencer.</p>';
    ordre.forEach(function (f) {
      h += '<h3 class="f-famille" data-depot="famille" data-famille="' + texte(f) + '"><span>' + texte(f === "CV" ? "CV de l'équipe" : f) + '</span><button class="f-pic petit" data-f="dans" data-famille="' + texte(f) + '" title="Ajouter un fichier dans « ' + texte(f) + ' »" aria-label="Ajouter un fichier dans « ' + texte(f) + ' »">' + ICO.plus + "</button></h3>";
      par[f].forEach(function (d) { vueDocs.push({ p: p, d: d }); h += ligneDoc(cid, vueDocs[vueDocs.length - 1], vueDocs.length - 1, par[f].length > 1, false); });
    });
    return h;
  }
  function dessinerFiche(cid) {
    var x = choisie();
    if (!x) return '<div class="f-fiche-vide"><p>Choisis un fichier pour le voir ici.</p></div>';
    var d = x.d, s = sorte(d), g = garde(cid, d), ok = aJour(cid, d), enLigne = choix(cid)[d.fichierId] === "ligne", nv = Array.isArray(d.versions) ? d.versions.length : 0, lien = lienSur(d.lienFichier || d.lien);
    var titre = famille(d) === d.nom || estCV(d) ? d.nom : famille(d) + ", " + variante(d).toLowerCase();
    var sous = d.fichierId ? [d.fichierNom || "fichier", d.taille ? poids(d.taille) : "", d.misAJour ? "mis à jour le " + jourLong(d.misAJour) : ""].filter(Boolean).join(" · ") : d.lien ? "Lien : " + String(d.lien).replace(/^https?:\/\//, "").slice(0, 60) : "Aucun fichier pour l'instant";
    var h = '<div class="f-tete">' + (petit() || largeur === "moyen" ? '<button class="f-icone" data-f="fermer-fiche" aria-label="Revenir à la liste">' + ICO.retour + "</button>" : "") + '<span class="f-sorte grand ' + s[1] + '">' + s[0] + '</span><div><h2>' + texte(titre) + "</h2><p>" + texte(x.p.nom) + " · " + texte(sous) + "</p></div></div>";
    // 28.11 (Sévane : « ces boutons pourraient être plus petits, faits avec des pictogrammes ») : une rangée de pictogrammes, le nom au survol.
    var visible = d.fichierId && visionneuse(d);
    h += '<div class="f-pics" role="toolbar" aria-label="Gestes sur ce fichier">';
    if (d.fichierId || lienSur(d.lien)) h += pic("ouvrir", visible ? "voir" : "appli", d.fichierId ? (visible ? "Voir en entier (toutes les pages, zoom)" : "Ouvrir") : "Ouvrir le lien");
    if (mac.ok && visible && !lourds[d.fichierId]) h += pic("ouvrir-mac", "appli", "Ouvrir avec une appli du Mac (Aperçu…)");
    if (mac.ok && ok) h += pic("finder", "finder", "Montrer dans le Finder");
    if (d.fichierId && lien) h += pic("drive", "drive", "Ouvrir dans Drive");
    if (d.fichierId) h += pic("copie", "copie", mac.ok && ok ? "Enregistrer une copie…" : "Télécharger");
    h += '<span class="f-pics-trait" aria-hidden="true"></span>';
    h += pic("remplacer", "remplacer", d.fichierId ? "Remplacer par une nouvelle version (l'ancienne est gardée)" : "Choisir le fichier");
    h += pic("renommer", "renommer", "Renommer");
    if (!estCV(d)) h += pic("variante", "variante", "Ajouter une variante (autre langue, autre format…)");
    h += "</div>";
    if (mac.ok && g && g.c) { var nomMac = g.c.slice(g.c.lastIndexOf("/") + 1); if (nomMac && nomMac !== (d.fichierNom || "")) h += '<p class="f-doux">Sur ce Mac, il s\'appelle « ' + texte(nomMac) + " ».</p>"; }
    if (d.fichierId) {
      var lourd = !!lourds[d.fichierId], cours = !!tache(cid, d);
      h += '<div class="f-ou"><span class="f-ou-titre">Où le garder</span><div class="f-choix" role="radiogroup" aria-label="Où garder ce fichier">' +
        '<button role="radio" aria-checked="' + (!enLigne && !lourd ? "true" : "false") + '" data-f="choix" data-v="ici"' + (lourd ? " disabled" : "") + ">Sur " + ici() + " et en ligne</button>" +
        '<button role="radio" aria-checked="' + (enLigne || lourd ? "true" : "false") + '" data-f="choix" data-v="ligne">En ligne seulement</button></div>';
      h += '<p class="f-doux">' + (lourd ? "Ce fichier dépasse 120 Mo : il ne peut pas passer par l'appli et reste en ligne." : cours ? "Récupération en cours…" : ok ? '<span class="f-vert">' + ICO.coche + " Gardé sur " + ici() + "</span> : il s'ouvre tout de suite, même sans connexion." : enLigne ? "Il n'occupe pas de place sur " + ici() + "." : g ? "Une version plus récente existe en ligne : elle arrive." : pannes[d.fichierId] ? "Pas encore récupéré : " + texte(pannes[d.fichierId]) : "Pas encore sur " + ici() + (Number(d.taille) > (petit() ? AUTO_MAX_PETIT : AUTO_MAX) ? " (fichier lourd : « Ouvrir » ou ce réglage le récupère)." : ".")) + "</p></div>";
    }
    var infos = [];
    if (d.joindre) infos.push("Joint aux mails de ce spectacle");
    if (d.parDefaut) infos.push("Version par défaut");
    if (nv) infos.push(nv + (nv > 1 ? " anciennes versions" : " ancienne version"));
    if (infos.length) h += '<p class="f-infos">' + infos.map(texte).join(" · ") + "</p>";
    h += '<div class="f-apercu"></div>';
    return h;
  }
  function carteGarde() {
    var t = totalGarde(), n = 0;
    P.tousComptes().forEach(function (c) { n += Object.keys(gardes(c.id)).length; });
    var h = '<div class="f-garde"><strong>Gardé sur ' + ici() + "</strong>";
    if (!mac.ok) h += '<div class="f-jauge"><i style="width:' + Math.min(100, Math.round(t / LIMITE * 100)) + '%"></i></div>';
    h += "<p>" + (n ? poids(t) + (mac.ok ? " dans " + texte(mac.dossier.affichage) + "." : " sur 1 Go.") : "Rien pour l'instant.") + '<span class="f-long"> Les fichiers s\'ouvrent tout de suite, même sans connexion.</span></p>';
    h += '<div class="f-garde-gestes"><button class="bouton" data-f="gerer">Gérer</button>' + (mac.ok ? '<button class="bouton" data-f="dossier">Ouvrir le dossier</button>' : "") + "</div></div>";
    return h;
  }
  function dessinerMac() {
    var l = [], t = 0;
    P.tousComptes().forEach(function (c) { var g = gardes(c.id); Object.keys(g).forEach(function (k) { l.push({ cid: c.id, compte: c.nom, fid: k, g: g[k] }); t += Number(g[k].t) || 0; }); });
    l.sort(function (a, b) { return (b.g.t || 0) - (a.g.t || 0); });
    var plusieurs = P.tousComptes().length > 1;
    var h = '<div class="f-mac"><div class="f-tete"><button class="f-icone" data-f="liste" aria-label="Revenir aux fichiers">' + ICO.retour + "</button><div><h2>Sur " + ici() + "</h2><p>" + (l.length ? l.length + (l.length > 1 ? " fichiers gardés, " : " fichier gardé, ") + poids(t) : "Aucun fichier gardé pour l'instant") + "</p></div></div>";
    h += '<p class="f-doux">' + (mac.ok ? "« Retirer » met le fichier à la Corbeille du Mac." : "« Retirer » l'enlève de cet appareil.") + " Il reste en ligne, dans ton Drive et dans tes mails : tu peux le reprendre quand tu veux.</p>";
    if (mac.ok) {
      h += '<div class="f-dossier"><div><strong>Dossier</strong><span>' + texte(mac.dossier.affichage) + '</span></div><div class="f-gestes"><button class="bouton" data-f="dossier">Ouvrir dans le Finder</button><button class="bouton" data-f="changer">Changer de dossier…</button>' + (mac.dossier.defaut ? "" : '<button class="bouton" data-f="origine">Remettre celui d\'origine</button>') + "</div>" +
        '<p class="f-doux">Rangé par compte, puis par spectacle. Un fichier déplacé ou renommé à la main dans le Finder n\'est plus suivi : Origami le reprend en ligne si tu le redemandes.</p></div>';
    } else if (mac.ancienne) h += '<div class="f-dossier"><p>Pour garder les fichiers dans un vrai dossier du Finder (les voir, les ranger, les copier), mets à jour l\'appli Origami : <button class="lien" data-f="applis">Applis, « Sur ce Mac »</button>.</p></div>';
    h += '<div class="f-liste-mac">';
    l.forEach(function (x, i) {
      var s = sorte({ fichierId: x.fid, type: x.g.y, fichierNom: x.g.n });
      h += '<div class="f-rang fixe"><span class="f-sorte ' + s[1] + '">' + s[0] + '</span><span class="f-qui"><strong>' + texte(x.g.n || "Fichier") + "</strong><span>" + texte([plusieurs ? x.compte : "", x.g.s, poids(x.g.t)].filter(Boolean).join(" · ")) + '</span></span><span class="f-marques">' +
        (mac.ok ? '<button class="bouton" data-f="montrer" data-c="' + texte(x.cid) + '" data-id="' + texte(x.fid) + '">Montrer</button>' : "") + '<button class="bouton" data-f="retirer" data-c="' + texte(x.cid) + '" data-id="' + texte(x.fid) + '">Retirer</button></span></div>';
    });
    return h + "</div></div>";
  }
  var attente = 0;
  function dessinerBientot() { if (attente) return; attente = setTimeout(function () { attente = 0; dessiner(); }, 60); }
  function dessiner() {
    if (!racine || racine.hidden || !P) return;
    var cid = F.compte, d = D[cid], ps = projets(cid);
    if (!cid) { racine.innerHTML = '<div class="f-info"><h1>Fichiers</h1><p>Choisis un compte dans le volet pour voir les fichiers de ses spectacles.</p></div>'; return; }
    if (!d || !d.projets) {
      var acces = d && /ACCES/.test(d.panne);
      racine.innerHTML = '<div class="f-info"><h1>Fichiers</h1>' + (d && d.panne ? "<p>" + (acces ? "Les fichiers viennent de Spectacle. Ouvre Spectacle une fois sur cet appareil, puis reviens ici." : "Les fichiers n'ont pas pu être lus : " + texte(d.panne)) + '</p><div class="f-gestes">' + (acces ? '<button class="bouton fort" data-f="spectacle">Ouvrir Spectacle</button>' : '<button class="bouton fort" data-f="relire">Réessayer</button>') + "</div>" : '<p class="f-doux">Lecture des fichiers…</p>') + "</div>";
      return;
    }
    if (!F.raccourci && !ps.some(function (p) { return (p.id || p.nom) === F.spectacle; })) F.spectacle = ps.length ? (ps[0].id || ps[0].nom) : "";
    var tous = lignes(cid), defile = (racine.querySelector(".f-rangs") || {}).scrollTop || 0, foyer = document.activeElement && document.activeElement.id === "fCherche", pos = foyer ? document.activeElement.selectionStart : 0;
    // Panneau de gauche : les spectacles et les raccourcis
    var g = '<aside class="f-panneau f-rayons"><h1>Fichiers</h1><div class="f-rayons-liste">';
    ps.forEach(function (p) { var k = p.id || p.nom; g += '<button class="f-rayon"' + (!F.raccourci && F.spectacle === k ? ' aria-current="true"' : "") + ' data-f-spectacle="' + texte(k) + '"><span>' + texte(p.nom) + "</span><small>" + docsDe(p).length + "</small></button>"; });
    if (!ps.length) g += '<p class="f-doux" style="padding:0 10px">Aucun spectacle pour l\'instant.</p>';
    g += '<h2>Raccourcis</h2>';
    RACCOURCIS.forEach(function (r) { var n = tous.filter(function (x) { return r[2](cid, x); }).length; g += '<button class="f-rayon"' + (F.raccourci === r[0] ? ' aria-current="true"' : "") + ' data-f-raccourci="' + r[0] + '"><span>' + (r[0] === "absents" ? absentsTitre() : r[1]) + "</span><small>" + n + "</small></button>"; });
    g += "</div>" + carteGarde() + "</aside>";
    var m;
    if (F.ecran === "mac") m = poignee(1) + '<section class="f-panneau f-large-mac">' + dessinerMac() + "</section>";
    else {
      var corps = dessinerListe(cid), frais = d.enCours ? "Mise à jour…" : d.panne ? "Liste gardée sur l'appareil (pas de réponse en ligne)." : "";
      m = poignee(1) + '<section class="f-panneau f-liste"><div class="f-outils"><label class="f-cherche">' + ICO.cherche + '<input id="fCherche" type="search" placeholder="Chercher un fichier" autocomplete="off" value="' + texte(F.cherche) + '"></label><button class="bouton fort" data-f="ajouter" title="Ajouter un fichier à un spectacle"' + (ps.length ? "" : " disabled") + '>' + ICO.plus + (petit() ? "" : "<span>Ajouter un fichier</span>") + "</button></div>" +
        (mac.ancienne ? '<p class="f-bandeau">Pour garder les fichiers dans un dossier du Finder, mets à jour l\'appli Origami : <button class="lien" data-f="applis">Applis, « Sur ce Mac »</button>.</p>' : "") +
        '<div class="f-rangs">' + corps + "</div>" + (frais ? '<p class="f-frais">' + frais + "</p>" : "") + "</section>" +
        poignee(2) + '<section class="f-panneau f-fiche' + (F.fiche && (choisie() || F.form) ? " montree" : "") + '">' + (F.form ? (F.form.genre === "deposer" ? dessinerDepot(cid) : dessinerForm(cid)) : dessinerFiche(cid)) + "</section>";
    }
    racine.innerHTML = '<div class="f-zone ' + largeur + (F.ecran === "mac" ? " ecran-mac" : "") + '"' + largeursCss() + ">" + g + m + "</div>";
    var r = racine.querySelector(".f-rangs"); if (r) r.scrollTop = defile;
    if (foyer) { var c = document.getElementById("fCherche"); if (c) { c.focus(); try { c.setSelectionRange(pos, pos); } catch (e) {} } }
    var x = F.ecran === "liste" && !F.form ? choisie() : null;
    if (x) poserApercu(x);
  }

  // ---------- Clics ----------
  function clic(ev) {
    var b = ev.target.closest("button"); if (!b || !racine.contains(b)) return;
    var cid = F.compte, d = b.dataset;
    if (d.fSpectacle != null) { F.spectacle = d.fSpectacle; F.raccourci = ""; F.ecran = "liste"; F.cherche = ""; F.fiche = false; dessiner(); return; }
    if (d.fRaccourci) { F.raccourci = d.fRaccourci; F.ecran = "liste"; F.cherche = ""; F.fiche = false; dessiner(); return; }
    if (d.fDoc != null) { var x0 = vueDocs[+d.fDoc]; if (x0 && !(F.form && F.form.occupe)) { F.form = null; F.doc = cleDoc(x0); F.fiche = true; dessiner(); } return; }
    var x = choisie();
    switch (d.f) {
      case "ouvrir": if (x) ouvrir(x); break;
      case "ouvrir-mac": if (x) ouvrir(x, true); break;
      case "remplacer": case "renommer": case "variante": if (x) formOuvrir(d.f, x); break;
      case "form-annuler": if (!F.form || !F.form.occupe) { F.form = null; dessiner(); } break;
      case "form-ok": formLancer(); break;
      case "finder": if (x && garde(cid, x.d)) natif("fichiers_montrer", { chemin: garde(cid, x.d).c }).catch(function (e) { if (/n'est plus/.test(message(e))) { oublier(cid, x.d.fichierId); dessiner(); } P.avis(message(e), true); }); break;
      case "drive": if (x) P.dehors(lienSur(x.d.lienFichier || x.d.lien)); break;
      case "copie": if (x) copie(x); break;
      case "choix": if (x) reglerChoix(x, d.v === "ligne" ? "ligne" : "ici"); break;
      case "spectacle": P.ouvrirVue(cid, "spectacle"); break;
      case "ajouter": formOuvrir("ajouter"); break;
      case "classement": formOuvrir("classement"); break;
      case "dans": formOuvrir("dans", d.famille); break;
      case "applis": P.ouvrirVue(cid, "applis"); break;
      case "relire": if (D[cid]) { D[cid].frais = 0; D[cid].panne = ""; } charger(cid); dessiner(); break;
      case "fermer-fiche": F.fiche = false; dessiner(); break;
      case "gerer": F.ecran = "mac"; verifier().then(dessiner); dessiner(); break;
      case "liste": F.ecran = "liste"; dessiner(); break;
      case "dossier": natif("fichiers_montrer", {}).catch(function (e) { P.avis(message(e), true); }); break;
      case "changer": case "origine":
        natif(d.f === "changer" ? "fichiers_choisir_dossier" : "fichiers_dossier_defaut", {}).then(function (r) {
          if (!r) return;
          mac.dossier = r.dossier;
          P.avis("Les fichiers sont maintenant gardés dans " + r.dossier.affichage + "." + (r.restes ? " Une partie est restée dans l'ancien dossier : Origami la reprendra en ligne." : ""));
          // Ce qui n'a pas suivi sera repris en ligne dans le nouveau dossier.
          return verifier().then(function () { P.tousComptes().forEach(function (c) { var v = vus(c.id), g = gardes(c.id); for (var k in v) if (!g[k]) delete v[k]; retenir(c.id); }); if (D[cid] && D[cid].projets) garderDOffice(cid); dessiner(); });
        }, function (e) { P.avis(message(e), true); });
        break;
      case "montrer": { var g1 = gardes(d.c)[d.id]; if (g1) natif("fichiers_montrer", { chemin: g1.c }).catch(function (e) { if (/n'est plus/.test(message(e))) { oublier(d.c, d.id); dessiner(); } P.avis(message(e), true); }); break; }
      case "retirer": b.disabled = true; retirer(d.c, d.id).then(function () { dessiner(); P.avis(mac.ok ? "Retiré de ce Mac (dans la Corbeille). Il reste en ligne." : "Retiré de cet appareil. Il reste en ligne."); }, function (e) { dessiner(); P.avis(message(e), true); }); break;
    }
  }
  function saisie(ev) { if (ev.target && formSaisie(ev.target)) return; if (ev.target && ev.target.id === "fCherche") { F.cherche = ev.target.value; F.fiche = false; dessiner(); } }
  function changement(ev) { var t = ev.target; if (t && (t.id === "fFichier" || t.id === "fSpectacle" || t.name === "fDepot" || t.id === "fExistant")) formSaisie(t); }
  function touche(ev) { if (ev.key === "Enter" && F.form && ev.target && (ev.target.id === "fNom" || ev.target.id === "fVariante" || ev.target.id === "fSorte")) { ev.preventDefault(); formLancer(); } }
  function mesurer() {
    if (!racine) return;
    var w = racine.clientWidth || window.innerWidth, l = w >= 980 ? "large" : w >= 640 ? "moyen" : "etroit";
    if (l !== largeur) { largeur = l; dessiner(); }
  }

  window.OrigamiFichiers = {
    montrer: function (section, pont, cid) {
      P = pont;
      if (!racine) {
        racine = section;
        racine.addEventListener("click", clic);
        racine.addEventListener("input", saisie);
        racine.addEventListener("change", changement);
        racine.addEventListener("keydown", touche);
        racine.addEventListener("pointerdown", glisser);
        racine.addEventListener("dblclick", largeurOrigine);
        racine.addEventListener("dragover", dessus);
        racine.addEventListener("dragleave", sortie);
        racine.addEventListener("drop", depot);
        try { new ResizeObserver(mesurer).observe(racine); } catch (e) { window.addEventListener("resize", mesurer); }
      }
      if (cid !== F.compte) { F.compte = cid || ""; F.spectacle = ""; F.raccourci = ""; F.doc = ""; F.cherche = ""; F.ecran = "liste"; F.fiche = false; F.form = null; viderApercu(); }
      var w = racine.clientWidth || window.innerWidth; largeur = w >= 980 ? "large" : w >= 640 ? "moyen" : "etroit";
      dessiner();
      if (F.compte) { charger(F.compte); if (D[F.compte].projets) suite(F.compte); }
    },
    // La copie des données du compte vient de changer (Spectacle ouvert à côté) : la liste se relit.
    rafraichir: function (cid) {
      if (!racine || racine.hidden || !P || cid !== F.compte || !D[cid]) return;
      P.copie(cid).then(function (c) { if (!c || !Array.isArray(c.projets) || !D[cid]) return; D[cid].projets = c.projets; D[cid].le = c.le; D[cid].panne = ""; dessiner(); suite(cid); });
    },
    // Un compte retiré de l'appareil : ce que la réserve gardait pour lui s'en va (les fichiers du dossier du Mac restent).
    oublier: function (cid) {
      var g = lireJ("origami_fichiers_garde@" + cid);
      Object.keys(g).forEach(function (k) { if (!g[k].c) reserve("readwrite", function (s) { return s.delete(cid + "/" + k); }).catch(function () {}); });
      ["garde", "choix", "vus"].forEach(function (n) { try { localStorage.removeItem("origami_fichiers_" + n + "@" + cid); } catch (e) {} });
      delete G[cid]; delete CHOIX[cid]; delete VUS[cid]; delete D[cid];
    }
  };

  var css = document.createElement("style");
  css.textContent = [
    "#scene > #fichiers{padding:0;overflow:hidden}",
    "#fichiers{--f-vert:#15803d;--f-vert-clair:#e3f3e7;--f-ambre:#9a5b00}",
    "html.sombre #fichiers{--f-vert:#4ade80;--f-vert-clair:#17301f;--f-ambre:#f0b44c}",
    "#fichiers svg{width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round;flex:none}",
    ".f-zone{height:100%;display:grid;grid-template-columns:var(--f-c1,clamp(190px,21%,244px)) 12px var(--f-c2,minmax(0,1.05fr)) 12px minmax(280px,1fr);gap:0;padding:12px}",
    ".f-zone.ecran-mac{grid-template-columns:var(--f-c1,clamp(190px,21%,244px)) 12px minmax(0,1fr)}",
    ".f-poignee{cursor:col-resize;position:relative;touch-action:none}",
    ".f-poignee::after{content:'';position:absolute;top:30%;bottom:30%;left:5px;width:2px;border-radius:2px;background:var(--ligne);opacity:0;transition:opacity .15s}",
    ".f-poignee:hover::after,.f-poignee.tire::after{opacity:1}",
    ".f-pics{display:flex;align-items:center;gap:4px;flex-wrap:wrap;margin:12px 0 2px}",
    ".f-pic{width:34px;height:32px;border:1px solid var(--ligne);border-radius:9px;background:var(--carte);color:var(--texte);display:inline-flex;align-items:center;justify-content:center;padding:0}",
    ".f-pic:hover{background:var(--carte2)}",
    ".f-pic svg{width:17px;height:17px}",
    ".f-pics-trait{width:1px;height:20px;background:var(--ligne);margin:0 4px}",
    ".f-voir-tout{display:block;width:100%;padding:0;border:0;background:none;cursor:zoom-in;text-align:center}",
    ".f-champ{display:flex;flex-direction:column;gap:4px;margin-top:12px;font-size:13px;font-weight:600}",
    ".f-champ small{font-weight:400;color:var(--doux)}",
    ".f-champ input[type=text],.f-champ select{min-height:34px;padding:4px 10px;border:1px solid var(--ligne);border-radius:9px;background:var(--carte);color:var(--texte);font:inherit;font-weight:400}",
    ".f-champ input[type=file]{font:inherit;font-weight:400}",
    ".f-souci{margin-top:10px;color:#b42318;font-size:13px}",
    ".f-cours{margin-top:10px}",
    ".f-depot-ici{outline:2px dashed var(--accent);outline-offset:-2px;background:var(--accent-clair)}",
    "html.sombre .f-depot-ici{background:#26324f}",
    ".f-choix-depot{display:flex;flex-direction:column;gap:6px;margin-top:8px}",
    ".f-option{display:flex;gap:8px;align-items:flex-start;padding:9px 11px;border:1px solid var(--ligne);border-radius:10px;cursor:pointer;font-size:14px}",
    ".f-option input{margin-top:3px;flex:none}",
    ".f-option small{display:block;color:var(--doux);font-size:12.5px;margin-top:2px}",
    ".f-classer{display:flex;justify-content:flex-end;padding:6px 10px 0}",
    ".f-classer .lien{display:inline-flex;align-items:center;gap:4px;font-size:13px}",
    ".f-famille{display:flex;align-items:center;justify-content:space-between;gap:8px}",
    ".f-pic.petit{width:26px;height:24px;border-radius:7px}",
    ".f-pic.petit svg{width:14px;height:14px}",
    ".f-panneau{background:var(--carte);border-radius:14px;min-height:0;min-width:0;display:flex;flex-direction:column;overflow:hidden}",
    ".f-rayons{padding:14px 10px 10px}",
    ".f-rayons h1,.f-info h1{font-size:18px;margin:0 0 10px;padding:0 8px}",
    ".f-rayons h2{margin:14px 0 4px;padding:0 10px;font-size:11px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--doux)}",
    ".f-rayons-liste{flex:1;min-height:0;overflow:auto;display:flex;flex-direction:column;gap:2px}",
    ".f-rayon{display:flex;align-items:center;justify-content:space-between;gap:8px;width:100%;min-height:32px;padding:4px 10px;border:0;border-radius:8px;background:none;text-align:left;flex:none}",
    ".f-rayon span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
    ".f-rayon small{font-size:12px;color:var(--doux);font-weight:400}",
    ".f-rayon:hover{background:var(--carte2)}",
    ".f-rayon[aria-current=true]{background:var(--accent-clair);font-weight:600}",
    "html.sombre .f-rayon[aria-current=true]{background:#26324f}",
    ".f-garde{flex:none;margin-top:10px;padding:11px 12px;border-radius:11px;background:var(--carte2);font-size:13px}",
    ".f-garde p{margin-top:6px;color:var(--doux);font-size:12.5px}",
    ".f-jauge{height:5px;border-radius:3px;background:var(--ligne);margin-top:8px;overflow:hidden}",
    ".f-jauge i{display:block;height:100%;background:var(--f-vert);border-radius:3px}",
    ".f-garde-gestes{display:flex;gap:6px;flex-wrap:wrap;margin-top:9px}",
    "#fichiers .bouton{display:inline-flex;align-items:center;gap:6px;min-height:30px;padding:0 11px;border:1px solid var(--ligne);border-radius:9px;background:var(--carte);font-size:13px;font-weight:500;white-space:nowrap;color:var(--texte)}",
    "#fichiers .bouton:hover{background:var(--carte2)}",
    "#fichiers .bouton.fort{border-color:var(--accent);background:var(--accent);color:#fff;font-weight:600}",
    "#fichiers .bouton.fort:hover{filter:brightness(1.06)}",
    "#fichiers .bouton:disabled{opacity:.5;cursor:default}",
    "#fichiers .lien{border:0;background:none;padding:0;color:var(--accent);text-decoration:underline;font:inherit}",
    "#fichiers button:focus-visible,#fichiers input:focus-visible{outline:2px solid var(--accent);outline-offset:1px}",
    ".f-liste{padding-top:12px}",
    ".f-outils{display:flex;gap:8px;padding:0 14px 10px;flex:none}",
    ".f-cherche{flex:1;min-width:0;display:flex;align-items:center;gap:8px;min-height:34px;padding:0 11px;border:1px solid var(--ligne);border-radius:10px;color:var(--doux)}",
    ".f-cherche input{flex:1;min-width:0;border:0;background:none;color:var(--texte);font:inherit;outline:0;-webkit-appearance:none;appearance:none}",
    ".f-cherche:focus-within{border-color:var(--accent)}",
    ".f-rangs{flex:1;min-height:0;overflow:auto;padding-bottom:10px}",
    ".f-famille{display:flex;justify-content:space-between;align-items:center;margin:0;padding:11px 16px 5px;border-top:1px solid var(--ligne);font-size:11px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--doux)}",
    ".f-rang{display:flex;align-items:center;gap:11px;width:100%;padding:8px 14px 8px 11px;border:0;border-left:3px solid transparent;background:none;text-align:left}",
    "button.f-rang:hover{background:var(--carte2)}",
    ".f-rang.ouvert{background:#eef2fe;border-left-color:var(--accent)}",
    "html.sombre .f-rang.ouvert{background:#222a3d}",
    ".f-rang.fixe{border-top:1px solid var(--ligne);padding:9px 4px}",
    ".f-sorte{width:34px;height:34px;border-radius:9px;display:flex;align-items:center;justify-content:center;color:#fff;font-size:10.5px;font-weight:700;letter-spacing:.02em;flex:none;background:#6b6f76}",
    ".f-sorte.pdf{background:#c2410c}.f-sorte.img{background:#0f766e}.f-sorte.vid{background:#7c3aed}.f-sorte.doc{background:#1d4ed8}.f-sorte.url{background:#475569;font-size:9.5px}.f-sorte.vide{background:none;border:1.5px dashed var(--ligne);color:var(--doux)}",
    ".f-sorte.grand{width:46px;height:46px;border-radius:11px;font-size:12px}",
    ".f-qui{flex:1;min-width:0}",
    ".f-qui strong{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
    ".f-qui span{display:block;font-size:12.5px;color:var(--doux);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
    ".f-marques{display:flex;align-items:center;gap:6px;flex:none}",
    ".f-puce{padding:1px 8px;border-radius:10px;font-size:11.5px;font-weight:600;white-space:nowrap}",
    ".f-puce.bleu{background:var(--accent-clair);color:var(--accent)}.f-puce.vert{background:var(--f-vert-clair);color:var(--f-vert)}",
    "html.sombre .f-puce.bleu{background:#26324f;color:#9db7ff}",
    ".f-etat{font-size:12.5px;color:var(--doux);white-space:nowrap;display:inline-flex;align-items:center;gap:3px}",
    ".f-etat.ici,.f-vert{color:var(--f-vert);font-weight:600}",
    ".f-vert{display:inline-flex;align-items:center;gap:3px}",
    ".f-etat.ici svg,.f-vert svg{width:13px;height:13px;stroke-width:2.4}",
    ".f-etat.cours{color:var(--accent);font-weight:600;font-variant-numeric:tabular-nums}",
    ".f-etat.manque{color:var(--f-ambre)}",
    ".f-vide,.f-fiche-vide{padding:26px 18px;color:var(--doux);text-align:center}",
    ".f-fiche-vide{margin:auto}",
    ".f-frais{flex:none;padding:6px 16px;border-top:1px solid var(--ligne);font-size:12px;color:var(--doux)}",
    ".f-bandeau{flex:none;margin:0 14px 10px;padding:8px 11px;border-radius:9px;background:var(--carte2);font-size:13px}",
    ".f-fiche,.f-large-mac{padding:18px 20px;overflow:auto}",
    ".f-tete{display:flex;align-items:center;gap:13px}",
    ".f-tete h2{font-size:18px;line-height:1.25}",
    ".f-tete p{margin-top:2px;color:var(--doux);font-size:13px}",
    ".f-tete>div{min-width:0}",
    ".f-icone{width:32px;height:32px;border:1px solid var(--ligne);border-radius:9px;background:var(--carte);display:inline-flex;align-items:center;justify-content:center;flex:none}",
    ".f-gestes{display:flex;gap:7px;flex-wrap:wrap;margin:14px 0 4px}",
    ".f-ou{margin-top:14px;padding:11px 12px;border:1px solid var(--ligne);border-radius:11px}",
    ".f-ou-titre{display:block;font-size:11px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--doux);margin-bottom:7px}",
    ".f-choix{display:flex;gap:2px;padding:3px;background:var(--carte2);border-radius:9px}",
    ".f-choix button{flex:1;min-height:28px;padding:2px 8px;border:0;border-radius:7px;background:none;font-size:12.5px;line-height:1.25;color:var(--doux)}",
    ".f-choix button[aria-checked=true]{background:var(--carte);color:var(--texte);font-weight:600;box-shadow:0 1px 2px rgba(0,0,0,.14)}",
    ".f-choix button:disabled{opacity:.5;cursor:default}",
    ".f-doux{color:var(--doux);font-size:13px}",
    ".f-ou .f-doux{margin-top:8px}",
    ".f-infos{margin-top:12px;font-size:13px;color:var(--doux)}",
    ".f-apercu{margin-top:14px}",
    ".f-apercu:empty{display:none}",
    ".f-apercu canvas,.f-apercu img{display:block;max-width:100%;height:auto;border:1px solid var(--ligne);border-radius:10px;background:#fff}",
    ".f-apercu div p{margin-top:6px;text-align:center}",
    ".f-pied{margin-top:16px}",
    ".f-info{max-width:520px;margin:10vh auto 0;padding:0 20px}",
    ".f-info h1{padding:0}",
    ".f-mac>.f-doux{margin:12px 0}",
    ".f-dossier{padding:12px 14px;border:1px solid var(--ligne);border-radius:11px;margin-bottom:14px}",
    ".f-dossier>div:first-child{display:flex;flex-direction:column}",
    ".f-dossier>div:first-child span{color:var(--doux);font-size:13px}",
    ".f-dossier .f-gestes{margin:10px 0 8px}",
    // Largeur moyenne : les spectacles en puces au-dessus, la liste et la fiche côte à côte
    ".f-zone.moyen{grid-template-columns:minmax(0,1fr) minmax(0,1fr);grid-template-rows:auto minmax(0,1fr);gap:12px}",
    ".f-zone.moyen.ecran-mac,.f-zone.etroit.ecran-mac{grid-template-columns:minmax(0,1fr)}",
    ".f-zone.moyen .f-rayons,.f-zone.etroit .f-rayons{grid-column:1/-1;padding:10px 10px 8px;background:none;border-radius:0;overflow:visible}",
    ".f-zone.moyen .f-rayons h1,.f-zone.etroit .f-rayons h1{font-size:20px;margin-bottom:8px}",
    ".f-zone.moyen .f-rayons-liste,.f-zone.etroit .f-rayons-liste{flex-direction:row;overflow-x:auto;gap:6px;padding-bottom:2px;scrollbar-width:none}",
    ".f-zone.moyen .f-rayons h2,.f-zone.etroit .f-rayons h2{display:none}",
    ".f-zone.moyen .f-rayon,.f-zone.etroit .f-rayon{width:auto;min-height:32px;padding:0 12px;border:1px solid var(--ligne);border-radius:16px;background:var(--carte);gap:6px;white-space:nowrap}",
    ".f-zone.moyen .f-rayon[aria-current=true],.f-zone.etroit .f-rayon[aria-current=true]{border-color:var(--accent);color:var(--accent);background:#eef2fe}",
    "html.sombre .f-zone.moyen .f-rayon[aria-current=true],html.sombre .f-zone.etroit .f-rayon[aria-current=true]{background:#222a3d;color:#9db7ff}",
    ".f-zone.moyen .f-garde,.f-zone.etroit .f-garde{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:8px 11px;margin-top:8px}",
    ".f-zone.moyen .f-garde p,.f-zone.etroit .f-garde p{margin:0;flex:1}",
    ".f-zone.moyen .f-garde-gestes,.f-zone.etroit .f-garde-gestes{margin:0}",
    ".f-zone.moyen .f-jauge,.f-zone.etroit .f-jauge{display:none}",
    ".f-zone.moyen .f-long,.f-zone.etroit .f-long{display:none}",
    ".f-zone.moyen .f-garde,.f-zone.etroit .f-garde{flex-wrap:nowrap}",
    ".f-zone.moyen .f-garde strong,.f-zone.etroit .f-garde strong{white-space:nowrap}",
    ".f-zone.moyen .f-garde p,.f-zone.etroit .f-garde p{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
    ".f-zone.moyen .f-garde-gestes,.f-zone.etroit .f-garde-gestes{flex-wrap:nowrap}",
    // Téléphone : la liste seule, la fiche par-dessus
    ".f-zone.etroit{grid-template-columns:minmax(0,1fr);grid-template-rows:auto minmax(0,1fr);gap:0;padding:0;position:relative}",
    ".f-zone.etroit .f-panneau{border-radius:0}",
    ".f-zone.etroit .f-rayons{padding:12px 12px 8px}",
    ".f-zone.etroit .f-fiche{display:none}",
    ".f-zone.etroit .f-fiche.montree{display:flex;position:absolute;inset:0;z-index:3;padding:14px 14px 20px}",
    ".f-zone.etroit .f-liste{border-top:1px solid var(--ligne)}",
    ".f-zone.etroit .f-rang{padding:10px 12px 10px 9px}",
    ".f-zone.etroit .f-large-mac{padding:14px}",
    ".f-zone.etroit .f-rang.fixe{flex-wrap:wrap}",
    ".f-zone.etroit .f-rang.fixe .f-marques{width:100%;justify-content:flex-end}"
  ].join("\n");
  document.head.appendChild(css);
})();
