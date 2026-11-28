// Répertoire commun d'Origami (18.11.2026). Chaque appli garde son propre carnet : rien n'est commun d'office. Ici se
// retrouvent seulement les contacts envoyés exprès au répertoire commun (ajoutés à la main, collés, ou envoyés par une appli),
// pour les applis d'un même compte. Rangement : dans le compte (liste « repertoire » du moteur Origami du compte) quand il
// est relié et que son moteur connaît le répertoire ; d'ici là, dans la mémoire de cet appareil (IndexedDB
// « origami-repertoire »), qui sert aussi de file d'attente. La page Origami donne un pont : comptes affichés, appel au
// moteur, lignes déjà rangées dans le compte, avis, feuilles, ouverture de la Boîte mail.
(function () {
  "use strict";
  var P = null, racine = null;
  var rp = { cherche: "" };
  var locaux = {};     // par compte : { fiches: { id: fiche }, retires: { id: 1 | "remis" } } : ce que le compte n'a pas encore confirmé
  var lectures = {};   // lectures de la mémoire en cours ou faites (une promesse par compte)
  var enVol = {}, sans = {}, pannes = {};
  var MAIL = /^[^\s@"<>(),;:]{1,64}@[^\s@"<>(),;:]{1,120}\.[^\s@"<>(),;:.]{2,24}$/;
  var MAIL_DANS = /[^\s@"<>(),;:]{1,64}@[^\s@"<>(),;:]{1,120}\.[A-Za-zÀ-ÿ0-9-]{2,24}/;
  var ID = /^r[0-9a-z]{6,30}$/;
  var canal = null;
  try { canal = new BroadcastChannel("origami-repertoire"); canal.onmessage = function (ev) { var id = ev && ev.data && ev.data.compte; if (typeof id === "string") { delete locaux[id]; delete lectures[id]; lireLocal(id).then(dessiner); } }; } catch (e) { canal = null; }

  function texte(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function net(v, max) { return String(v == null ? "" : v).replace(/\s+/g, " ").trim().slice(0, max); }
  function sansAccent(s) { return String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, ""); }
  function nouvelId() { var a = ""; try { var t = new Uint32Array(2); crypto.getRandomValues(t); a = t[0].toString(36) + t[1].toString(36); } catch (e) { a = Math.random().toString(36).slice(2, 10); } return ("r" + Date.now().toString(36) + a).slice(0, 24); }
  function aujourdhui() { var d = new Date(); return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2); }

  // ---------- Mémoire de l'appareil ----------
  function base(ok) { try { var q = indexedDB.open("origami-repertoire", 1); q.onupgradeneeded = function () { q.result.createObjectStore("r"); }; q.onsuccess = function () { ok(q.result); }; q.onerror = function () { ok(null); }; } catch (e) { ok(null); } }
  function propreLocal(v) {
    var l = { fiches: {}, retires: {} };
    if (v && typeof v === "object") {
      if (v.fiches && typeof v.fiches === "object") Object.keys(v.fiches).slice(0, 5000).forEach(function (k) { var f = fichePropre(v.fiches[k]); if (f && f.id === k) { if (v.fiches[k].remis) f.remis = 1; l.fiches[k] = f; } });
      if (v.retires && typeof v.retires === "object") Object.keys(v.retires).slice(0, 5000).forEach(function (k) { if (ID.test(k)) l.retires[k] = v.retires[k] === "remis" ? "remis" : 1; });
    }
    return l;
  }
  function lireLocal(id) {
    if (lectures[id]) return lectures[id];
    lectures[id] = new Promise(function (ok) {
      function rendre(v) { if (!locaux[id]) locaux[id] = propreLocal(v); ok(locaux[id]); }
      base(function (db) {
        if (!db) return rendre(null);
        try { var q = db.transaction("r").objectStore("r").get(id); q.onsuccess = function () { db.close(); rendre(q.result); }; q.onerror = function () { db.close(); rendre(null); }; } catch (e) { rendre(null); }
      });
    });
    return lectures[id];
  }
  function garderLocal(id) {
    var l = locaux[id];
    base(function (db) {
      if (!db) return;
      try {
        var t = db.transaction("r", "readwrite"), s = t.objectStore("r");
        if (l && (Object.keys(l.fiches).length || Object.keys(l.retires).length)) s.put(l, id); else s.delete(id);
        t.oncomplete = function () { db.close(); if (canal) { try { canal.postMessage({ compte: id }); } catch (e) {} } };
        t.onerror = t.onabort = function () { try { db.close(); } catch (e) {} };
      } catch (e) {}
    });
  }

  // ---------- Fiches ----------
  function fichePropre(f) {
    if (!f || typeof f !== "object") return null;
    var o = { id: ID.test(String(f.id || "")) ? String(f.id) : nouvelId(), nom: net(f.nom, 120), mail: net(f.mail, 190).toLowerCase(), tel: net(f.tel, 40), structure: net(f.structure, 120), note: String(f.note == null ? "" : f.note).replace(/\r\n?/g, "\n").trim().slice(0, 600), source: net(f.source, 40), le: /^\d{4}-\d{2}-\d{2}$/.test(String(f.le || "")) ? String(f.le) : aujourdhui(), modif: Number(f.modif) > 0 ? Math.floor(Number(f.modif)) : Date.now() };
    if (o.mail && !MAIL.test(o.mail)) o.mail = "";
    if (!o.nom && !o.mail && !o.tel && !o.structure) return null;
    return o;
  }
  // Ce que montre l'écran pour un compte : les lignes rangées dans le compte, recouvertes par ce que l'appareil n'a pas encore remis.
  function fichesDe(id) {
    var l = locaux[id] || { fiches: {}, retires: {} }, parId = {}, rangees = {};
    (P ? P.lignes(id) : []).forEach(function (o) { if (o && typeof o.id === "string") rangees[o.id] = o; });
    // Ménage : ce que le compte a confirmé quitte la file de l'appareil.
    var change = false, su = !P || !P.relie(id) || P.charge(id);   // la mémoire du compte n'est pas encore relue : on ne conclut rien
    if (su) Object.keys(l.fiches).forEach(function (k) { var f = l.fiches[k], r = rangees[k]; if (f.remis && r && Number(r.modif) >= f.modif) { delete l.fiches[k]; change = true; } });
    if (su) Object.keys(l.retires).forEach(function (k) { if (l.retires[k] === "remis" && !rangees[k]) { delete l.retires[k]; change = true; } });
    if (change) garderLocal(id);
    Object.keys(rangees).forEach(function (k) { if (!l.retires[k]) { var f = fichePropre(rangees[k]); if (f) { f.range = true; parId[k] = f; } } });
    Object.keys(l.fiches).forEach(function (k) { if (!l.retires[k]) { var f = Object.assign({}, l.fiches[k]); f.range = !!f.remis; parId[k] = f; } });
    return Object.keys(parId).map(function (k) { return parId[k]; }).sort(function (a, b) { return sansAccent(a.nom || a.structure || a.mail).localeCompare(sansAccent(b.nom || b.structure || b.mail)); });
  }
  function enAttente(id) { var l = locaux[id]; if (!l) return 0; return Object.keys(l.fiches).filter(function (k) { return !l.fiches[k].remis; }).length + Object.keys(l.retires).filter(function (k) { return l.retires[k] !== "remis"; }).length; }

  // ---------- Remise au compte ----------
  function pousser(id) {
    var l = locaux[id];
    if (!P || !l || enVol[id] || !P.relie(id)) return;
    if (sans[id] && Date.now() - sans[id] < 3600000) return;
    var fiches = Object.keys(l.fiches).map(function (k) { return l.fiches[k]; }).filter(function (f) { return !f.remis; }).slice(0, 200);
    var ids = Object.keys(l.retires).filter(function (k) { return l.retires[k] !== "remis"; }).slice(0, 200);
    if (!fiches.length && !ids.length) return;
    enVol[id] = true;
    P.appel(id, "repertoire.ecrire", { fiches: fiches.map(function (f) { return { id: f.id, nom: f.nom, mail: f.mail, tel: f.tel, structure: f.structure, note: f.note, source: f.source, le: f.le, modif: f.modif }; }), retirer: ids }).then(function () {
      fiches.forEach(function (f) { var a = l.fiches[f.id]; if (a && a.modif === f.modif) a.remis = 1; });   // changée entre-temps : elle repartira
      ids.forEach(function (k) { if (l.retires[k]) l.retires[k] = "remis"; });
      delete sans[id]; delete pannes[id]; garderLocal(id);
    }, function (e) {
      var m = String((e && e.message) || e);
      if (/inconnue/i.test(m)) { sans[id] = Date.now(); delete pannes[id]; } else pannes[id] = m;   // moteur du compte pas encore à jour : on garde ici
    }).then(function () { delete enVol[id]; dessiner(); if (!sans[id] && !pannes[id] && enAttente(id)) pousser(id); });
  }
  function ecrire(id, f) {
    return lireLocal(id).then(function (l) { f.modif = Date.now(); delete f.remis; delete f.range; l.fiches[f.id] = f; delete l.retires[f.id]; garderLocal(id); pousser(id); dessiner(); });
  }
  function retirer(id, idF) {
    return lireLocal(id).then(function (l) {
      var rangee = (P ? P.lignes(id) : []).some(function (o) { return o && o.id === idF; }) || (l.fiches[idF] && l.fiches[idF].remis);
      delete l.fiches[idF];
      if (rangee) l.retires[idF] = 1;
      garderLocal(id); pousser(id); dessiner();
    });
  }
  // Des contacts arrivent (collés, ou envoyés par une appli). Même adresse : la fiche existante est complétée, pas doublée.
  function recevoir(id, liste, source) {
    return lireLocal(id).then(function (l) {
      var la = fichesDe(id), parMail = {}, ajoutees = 0, completees = 0, dejaLa = 0;
      la.forEach(function (f) { if (f.mail) parMail[f.mail] = f; });
      (Array.isArray(liste) ? liste : []).slice(0, 500).forEach(function (brut) {
        var f = fichePropre(Object.assign({}, brut, { id: "", source: source || (brut && brut.source) || "", le: "", modif: 0 }));
        if (!f) return;
        var a = f.mail ? parMail[f.mail] : null;
        if (!a) { l.fiches[f.id] = f; delete f.remis; if (f.mail) parMail[f.mail] = f; ajoutees++; return; }
        var plus = false, b = Object.assign({}, a); delete b.range; delete b.remis;
        ["nom", "tel", "structure", "note"].forEach(function (k) { if (!b[k] && f[k]) { b[k] = f[k]; plus = true; } });
        if (plus) { b.modif = Date.now(); l.fiches[b.id] = b; parMail[b.mail] = b; completees++; } else dejaLa++;
      });
      if (ajoutees || completees) { garderLocal(id); pousser(id); }
      dessiner();
      return { ajoutees: ajoutees, completees: completees, dejaLa: dejaLa };
    });
  }
  function bilan(r) {
    var t = [];
    if (r.ajoutees) t.push(r.ajoutees + (r.ajoutees > 1 ? " contacts ajoutés" : " contact ajouté"));
    if (r.completees) t.push(r.completees + (r.completees > 1 ? " fiches complétées" : " fiche complétée"));
    if (r.dejaLa) t.push(r.dejaLa + " déjà là");
    return t.length ? t.join(", ") + "." : "Aucun contact reconnu.";
  }
  // Texte collé : une personne par ligne, « Nom <adresse> », « adresse », ou des colonnes séparées par ; ou tabulation.
  function lireColle(t) {
    var r = [];
    String(t || "").split(/\r?\n/).slice(0, 600).forEach(function (ligne) {
      ligne = ligne.trim();
      if (!ligne) return;
      var m = MAIL_DANS.exec(ligne), f = { nom: "", mail: "", tel: "", structure: "" };
      if (m) { f.mail = m[0]; ligne = (ligne.slice(0, m.index) + " ; " + ligne.slice(m.index + m[0].length)); }
      ligne.split(/[;\t|]+/).map(function (x) { return x.replace(/^[\s"'<>(),]+|[\s"'<>(),]+$/g, ""); }).filter(Boolean).forEach(function (x) {
        if (!f.tel && /^\+?[\d ./()-]{7,22}$/.test(x)) f.tel = x;
        else if (!f.nom) f.nom = x;
        else if (!f.structure) f.structure = x;
      });
      if (f.mail || (f.nom && f.tel)) r.push(f);
    });
    return r;
  }

  // ---------- Écran ----------
  function comptes() { return P ? P.comptesVus() : []; }
  function correspond(f, q) { return !q || sansAccent([f.nom, f.structure, f.mail, f.tel, f.note, f.source].join(" ")).indexOf(q) >= 0; }
  function rangee(c, f) {
    var titre = f.nom || f.structure || f.mail || f.tel;
    var d = [f.structure, f.mail, f.tel].filter(function (x) { return x && x !== titre; }).map(texte).join(" · ");
    var h = '<div class="rangee rp-fiche" data-rp-fiche="' + f.id + '"><div><span class="quoi">' + texte(titre) + "</span>";
    if (f.source) h += '<span class="etiquette">' + texte(f.source) + "</span>";
    // Compte relié : on montre ce qui n'est pas encore rangé dans le compte (sans liaison, tout est sur l'appareil : c'est dit une fois, en haut).
    if (!f.range && P.relie(c.id)) h += '<span class="etiquette rp-ici" title="Pas encore rangé dans le compte">Sur cet appareil</span>';
    h += "</div><div>" + (d ? '<span class="detail">' + d + "</span>" : "") + '<span class="gestes">';
    if (f.mail) h += (P.boite(c.id) ? '<button class="lien" data-rp="ecrire" data-c="' + c.id + '" data-f="' + f.id + '">Écrire</button>' : '<a class="lien" href="mailto:' + encodeURIComponent(f.mail).replace(/%40/g, "@") + '">Écrire</a>') + '<button class="lien" data-rp="copier" data-c="' + c.id + '" data-f="' + f.id + '">Copier l\'adresse</button>';
    h += '<button class="lien" data-rp="modifier" data-c="' + c.id + '" data-f="' + f.id + '">Modifier</button><button class="lien rouge" data-rp="retirer" data-c="' + c.id + '" data-f="' + f.id + '">Retirer</button></span></div>';
    if (f.note) h += '<div><span class="detail rp-note">' + texte(f.note) + "</span></div>";
    return h + "</div>";
  }
  function etatDe(c) {
    var n = enAttente(c.id);
    if (!P.relie(c.id)) return "Ce compte n'est pas relié à son moteur : ses contacts communs restent sur cet appareil.";
    if (pannes[c.id]) return "Le compte n'a pas pu ranger " + (n > 1 ? "les derniers changements" : "le dernier changement") + " (" + pannes[c.id] + "). Ils sont gardés sur cet appareil.";
    if (n && sans[c.id]) return "Gardé sur cet appareil pour l'instant : le moteur de ce compte ne connaît pas encore les contacts communs.";
    if (n) return "Rangement dans le compte en cours…";
    return "";
  }
  function dessiner() {
    if (!racine || racine.hidden || !P) return;
    var cs = comptes(), q = sansAccent(rp.cherche.trim()), total = 0, corps = "";
    cs.forEach(function (c) {
      var toutes = locaux[c.id] ? fichesDe(c.id) : null, l = toutes ? toutes.filter(function (f) { return correspond(f, q); }) : [];
      if (toutes) total += toutes.length;
      if (cs.length > 1) corps += '<div class="du-compte"><span class="point" style="background:' + c.couleur + '"></span>' + texte(c.nom) + (c.partage ? ' <span class="etiquette">partagés avec ce compte</span>' : "") + (toutes ? ' <span class="doux">· ' + toutes.length + "</span>" : "") + "</div>";
      var e = toutes ? etatDe(c) : "";
      if (e) corps += '<p class="aide rp-etat' + (pannes[c.id] ? " souci" : "") + '">' + texte(e) + (pannes[c.id] || (sans[c.id] && enAttente(c.id)) ? ' <button class="lien" data-rp="reessayer" data-c="' + c.id + '">Réessayer</button>' : "") + "</p>";
      if (!toutes) corps += '<p class="vide">Lecture…</p>';
      else if (!toutes.length) corps += '<p class="vide">' + (cs.length > 1 ? "Aucun contact commun dans ce compte." : "Aucun contact commun pour l'instant. Ajoute un contact ici, ou envoie-le depuis une appli.") + "</p>";
      else if (!l.length) corps += '<p class="vide">Aucun contact ne correspond.</p>';
      else l.forEach(function (f) { corps += rangee(c, f); });
    });
    var h = '<div class="appli large rp"><div class="entete"><div><h2>Contacts communs</h2><p>' + (cs.length > 1 ? "Les contacts communs aux applis de chaque compte." : "Les contacts communs aux applis de ce compte.") + "</p></div>";
    h += '<div class="actions"><button class="bouton fort" data-rp="ajouter">Ajouter</button><button class="bouton" data-rp="coller">Coller des adresses</button></div></div>';
    h += '<p class="aide">Chaque appli garde son propre carnet. Seuls les contacts que tu envoies ici sont communs.</p>';
    if (!cs.length) h += '<p class="vide">Aucun compte affiché.</p>';
    else {
      if (total > 6 || rp.cherche) h += '<label class="champ recherche"><span class="cache">Chercher</span><input id="rpCherche" type="search" placeholder="Chercher un nom, un lieu, une adresse" autocomplete="off" value="' + texte(rp.cherche) + '"></label>';
      h += '<div id="rpListe">' + corps + "</div>";
    }
    var actif = document.activeElement && document.activeElement.id === "rpCherche", pos = actif ? document.activeElement.selectionStart : 0, haut = racine.scrollTop;
    racine.innerHTML = h + "</div>";
    racine.scrollTop = haut;
    if (actif) { var z = document.getElementById("rpCherche"); if (z) { z.focus(); try { z.setSelectionRange(pos, pos); } catch (e) {} } }
  }
  function charger() { comptes().forEach(function (c) { lireLocal(c.id).then(function () { pousser(c.id); dessiner(); }); }); }

  // ---------- Feuilles ----------
  function choixCompte(id) {
    var cs = comptes();
    if (cs.length < 2) return '<input type="hidden" id="rpCompte" value="' + (cs[0] ? cs[0].id : "") + '">';
    return '<label class="champ">Compte<select id="rpCompte">' + cs.map(function (c) { return '<option value="' + c.id + '"' + (c.id === id ? " selected" : "") + ">" + texte(c.nom) + "</option>"; }).join("") + "</select></label>";
  }
  function feuilleFiche(idC, f) {
    var h = "<h2>" + (f ? "Modifier le contact" : "Ajouter aux contacts communs") + "</h2>";
    h += f ? '<input type="hidden" id="rpCompte" value="' + idC + '">' : choixCompte(idC);
    h += '<label class="champ">Nom<input id="rpNom" maxlength="120" autocomplete="off" value="' + texte(f ? f.nom : "") + '"></label>';
    h += '<label class="champ">Lieu ou structure<input id="rpStructure" maxlength="120" autocomplete="off" value="' + texte(f ? f.structure : "") + '"></label>';
    h += '<div class="deux"><label class="champ">Adresse mail<input id="rpMail" type="email" maxlength="190" autocomplete="off" autocapitalize="off" spellcheck="false" value="' + texte(f ? f.mail : "") + '"></label>';
    h += '<label class="champ">Téléphone<input id="rpTel" type="tel" maxlength="40" autocomplete="off" value="' + texte(f ? f.tel : "") + '"></label></div>';
    h += '<label class="champ">Note<textarea id="rpNote" class="simple" maxlength="600">' + texte(f ? f.note : "") + "</textarea></label>";
    h += '<p id="rpSouci" class="souci" role="status"></p><div class="actions"><button class="bouton" data-rp="fermer">Annuler</button><button class="bouton fort" data-rp="enregistrer" data-f="' + (f ? f.id : "") + '">' + (f ? "Enregistrer" : "Ajouter") + "</button></div>";
    P.ouvrirVoile(h);
  }
  function feuilleColler() {
    var cs = comptes();
    var h = "<h2>Coller des adresses</h2><p>Une personne par ligne : « Nom &lt;adresse&gt; », une adresse seule, ou nom, adresse et téléphone séparés par un point-virgule.</p>";
    h += choixCompte(cs[0] ? cs[0].id : "");
    h += '<label class="champ">Adresses<textarea id="rpColle" class="simple" rows="7" autocomplete="off" spellcheck="false"></textarea></label>';
    h += '<p id="rpSouci" class="souci" role="status"></p><div class="actions"><button class="bouton" data-rp="fermer">Annuler</button><button class="bouton fort" data-rp="coller-ok">Ajouter</button></div>';
    P.ouvrirVoile(h);
  }
  function val(i) { var e = document.getElementById(i); return e ? String(e.value || "") : ""; }
  function souci(t) { var z = document.getElementById("rpSouci"); if (z) z.textContent = t; }
  function fiche(idC, idF) { return (locaux[idC] ? fichesDe(idC) : []).filter(function (f) { return f.id === idF; })[0] || null; }

  document.addEventListener("click", function (ev) {
    var b = ev.target.closest ? ev.target.closest("[data-rp]") : null;
    if (!b || !P) return;
    var d = b.dataset, idC = d.c || "", f = d.f ? fiche(idC, d.f) : null;
    if (d.rp === "fermer") { P.fermerVoile(); return; }
    if (d.rp === "ajouter") { var cs = comptes(); if (!cs.length) return; feuilleFiche(cs[0].id, null); return; }
    if (d.rp === "coller") { if (comptes().length) feuilleColler(); return; }
    if (d.rp === "reessayer") { delete sans[idC]; delete pannes[idC]; pousser(idC); dessiner(); return; }
    if (d.rp === "modifier") { if (f) feuilleFiche(idC, f); return; }
    if (d.rp === "copier") {
      if (!f || !f.mail) return;
      try { navigator.clipboard.writeText(f.mail).then(function () { P.avis("Adresse copiée."); }, function () { P.avis("La copie n'a pas marché sur cet appareil.", true); }); } catch (e) { P.avis("La copie n'a pas marché sur cet appareil.", true); }
      return;
    }
    if (d.rp === "ecrire") { if (f && f.mail && !P.ecrire(idC, f.mail)) P.avis("La Boîte mail ne s'est pas ouverte.", true); return; }
    if (d.rp === "retirer") {
      if (!f) return;
      P.demander("Retirer ce contact des contacts communs ?", (f.nom || f.structure || f.mail) + " quitte les contacts communs. Les carnets des applis ne changent pas.", [{ nom: "Annuler" }, { nom: "Retirer", fort: true, action: function () { retirer(idC, f.id).then(function () { P.avis("Contact retiré des contacts communs."); }); } }]);
      return;
    }
    if (d.rp === "enregistrer") {
      var compte = val("rpCompte"), ancienne = d.f ? fiche(compte, d.f) : null;
      if (!comptes().some(function (c) { return c.id === compte; })) return;
      var mail = net(val("rpMail"), 190).toLowerCase();
      if (mail && !MAIL.test(mail)) { souci("Cette adresse mail n'a pas la bonne forme."); return; }
      var n = fichePropre({ id: ancienne ? ancienne.id : "", nom: val("rpNom"), structure: val("rpStructure"), mail: mail, tel: val("rpTel"), note: val("rpNote"), source: ancienne ? ancienne.source : "Ajouté à la main", le: ancienne ? ancienne.le : "" });
      if (!n) { souci("Donne au moins un nom, un lieu, une adresse ou un téléphone."); return; }
      if (mail && fichesDe(compte).some(function (x) { return x.mail === mail && x.id !== n.id; })) { souci("Cette adresse est déjà dans les contacts communs de ce compte."); return; }
      P.fermerVoile();
      ecrire(compte, n).then(function () { P.avis(ancienne ? "Contact enregistré." : "Contact ajouté aux contacts communs."); });
      return;
    }
    if (d.rp === "coller-ok") {
      var cc = val("rpCompte"), liste = lireColle(val("rpColle"));
      if (!comptes().some(function (c) { return c.id === cc; })) return;
      if (!liste.length) { souci("Aucune adresse reconnue dans ce texte."); return; }
      P.fermerVoile();
      recevoir(cc, liste, "Collé").then(function (r) { P.avis(bilan(r)); });
    }
  });
  document.addEventListener("input", function (ev) {
    if (ev.target && ev.target.id === "rpCherche") { rp.cherche = ev.target.value; dessiner(); }
    else if (ev.target && /^rp(Nom|Mail|Tel|Structure|Note|Colle)$/.test(ev.target.id || "")) souci("");
  });

  window.OrigamiRepertoire = {
    montrer: function (zone, pont) { racine = zone; P = pont; dessiner(); charger(); },
    rafraichir: function () { if (racine && !racine.hidden) { charger(); dessiner(); } },
    // Une appli ouverte dans Origami envoie des contacts au répertoire commun de son compte.
    recevoir: function (pont, id, liste, source) { P = P || pont; return recevoir(id, liste, source); },
    bilan: bilan,
    // Le compte est retiré de l'appareil : sa file d'attente aussi.
    oublier: function (id) { locaux[id] = { fiches: {}, retires: {} }; garderLocal(id); delete locaux[id]; delete lectures[id]; delete sans[id]; delete pannes[id]; }
  };

  var css = document.createElement("style");
  css.textContent = [
    ".rp .entete{align-items:center;max-width:none;margin:0 0 10px}",
    ".rp .entete h2{margin:0;font-size:17px}",
    ".rp-fiche .detail{flex-basis:240px}",
    ".rp-fiche .rp-note{flex-basis:100%;white-space:pre-wrap}",
    ".rp-ici{background:#fff3cd;color:#7a5600}",
    "html.sombre .rp-ici{background:#4a3b0c;color:#f3d98b}",
    ".rp-etat .lien{margin-left:6px}",
    ".rp .du-compte{margin:16px 0 8px;max-width:none}",
    ".rp a.lien{font-size:12.5px;text-decoration:underline}",
    "@media (pointer:coarse){.rp-fiche .gestes{gap:6px 16px}}"
  ].join("\n");
  document.head.appendChild(css);
})();
