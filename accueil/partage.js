// Partage entre comptes d'Origami (28.11.2026, remplace l'écran « Répertoire »). Demande de Sévane : un seul endroit qui dit
// ce qui est commun à quels comptes (contacts, fichiers, spectacles entiers, puis pieds de page et modèles de mail).
//
// Principe : chaque chose reste dans son compte d'origine. Le compte d'origine note, dans sa liste « partages » (moteur
// Origami, onglet « Partages » de son classeur), les adresses Google des comptes qui la voient. L'appli Origami d'un
// appareil relié aux deux comptes la montre alors dans l'autre compte, avec le nom du compte d'origine. Rien n'est copié,
// aucun droit n'est donné dans Drive. Tant que le moteur du compte ne connaît pas encore les partages, ils restent sur
// cet appareil (localStorage « origami_partages_attente@<compte> ») et partent dès qu'il les connaît.
//
// Deux onglets : « Ce qui est partagé » (les réglages) et « Contacts communs » (l'ancien répertoire, dessiné par repertoire.js).
(function () {
  "use strict";
  var P = null, racine = null, tete = null, corps = null, zoneRep = null;
  var onglet = "partages";
  var spectacles = {};   // par compte : { liste: [{ cle, nom }] | null, lu: date, enCours: bool, panne: "" }
  var enVol = {}, sans = {}, pannes = {};
  var agendas = {};    // par compte : { liste: [{ id, nom, couleur }] | null, lu, enCours, panne } (les agendas dont il est propriétaire)
  var feuille = null;  // agenda en cours de partage : { c, id, nom, personnes, public, occupe, souci }
  var ATT = "origami_partages_attente@";
  var QUOIS = { contacts: "Contacts communs", fichiers: "Fichiers du spectacle", fichier: "Fichier", spectacle: "Spectacle entier", pieds: "Pieds de page", modeles: "Modèles de mail" };

  function texte(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function lire(k) { try { return localStorage.getItem(k) || ""; } catch (e) { return ""; } }
  function garder(k, v) { try { if (v) localStorage.setItem(k, v); else localStorage.removeItem(k); } catch (e) {} }
  function empreinte(t) { var h1 = 0xdeadbeef, h2 = 0x41c6ce57; for (var i = 0, ch; i < t.length; i++) { ch = t.charCodeAt(i); h1 = Math.imul(h1 ^ ch, 2654435761); h2 = Math.imul(h2 ^ ch, 1597334677); } h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507); h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909); h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507); h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909); return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36); }
  // Un partage = une chose d'un compte : son identifiant ne dépend que de la chose, pour que deux appareils ne la doublent pas.
  function idDe(quoi, cle) { return "p" + quoi.slice(0, 2) + empreinte(quoi + "|" + cle); }
  function versListe(v) { return String(v || "").split(",").map(function (a) { return a.trim().toLowerCase(); }).filter(Boolean); }

  // ---------- Ce que l'appareil n'a pas encore remis au compte ----------
  function attente(cid) { var o = null; try { o = JSON.parse(lire(ATT + cid) || "{}"); } catch (e) { o = null; } return o && typeof o === "object" ? o : {}; }
  function retenir(cid, o) { garder(ATT + cid, Object.keys(o).length ? JSON.stringify(o) : ""); }
  // Les partages d'un compte : ceux rangés dans le compte, recouverts par ceux que l'appareil n'a pas encore remis.
  function partagesDe(cid) {
    var parId = {}, a = attente(cid), rangees = {}, change = false;
    (P ? P.lignes(cid) : []).forEach(function (o) { if (o && typeof o.id === "string" && o.quoi && !o.supprime) rangees[o.id] = o; });
    // Ménage : ce que le compte a confirmé quitte la file de l'appareil (seulement quand sa mémoire est relue).
    if (P && P.relie(cid) && P.charge(cid)) Object.keys(a).forEach(function (k) {
      var x = a[k]; if (!x.remis) return;
      var r = rangees[k];
      if ((!x.vers && !r) || (r && Number(r.modif) >= Number(x.modif))) { delete a[k]; change = true; }
    });
    if (change) retenir(cid, a);
    Object.keys(rangees).forEach(function (k) { parId[k] = { id: k, quoi: String(rangees[k].quoi), cle: String(rangees[k].cle == null ? "" : rangees[k].cle), titre: String(rangees[k].titre || ""), vers: versListe(rangees[k].vers), modif: Number(rangees[k].modif) || 0, range: true }; });
    Object.keys(a).forEach(function (k) { var x = a[k]; if (!x.vers) delete parId[k]; else parId[k] = { id: k, quoi: x.quoi, cle: x.cle, titre: x.titre, vers: versListe(x.vers), modif: x.modif, range: !!x.remis }; });
    return Object.keys(parId).map(function (k) { return parId[k]; });
  }
  function trouver(cid, quoi, cle) { var id = idDe(quoi, cle); return partagesDe(cid).filter(function (p) { return p.id === id; })[0] || null; }
  function voit(cid, quoi, cle, adresse) { var p = trouver(cid, quoi, cle); return !!p && p.vers.indexOf(adresse) >= 0; }
  function enAttente(cid) { var a = attente(cid); return Object.keys(a).filter(function (k) { return !a[k].remis; }).length; }

  function regler(cid, quoi, cle, titre, adresse, oui) {
    var p = trouver(cid, quoi, cle), vers = p ? p.vers.slice() : [], i = vers.indexOf(adresse);
    if (oui && i < 0) vers.push(adresse);
    if (!oui && i >= 0) vers.splice(i, 1);
    if (!p && !vers.length) return;
    var a = attente(cid), id = idDe(quoi, cle);
    a[id] = { quoi: quoi, cle: cle, titre: titre || (p && p.titre) || "", vers: vers.join(","), modif: Date.now() };
    retenir(cid, a);
  }
  function pousser(cid) {
    if (!P || enVol[cid] || !P.relie(cid)) return;
    if (sans[cid] && Date.now() - sans[cid] < 3600000) return;
    var a = attente(cid), ids = Object.keys(a).filter(function (k) { return !a[k].remis; }).slice(0, 200);
    if (!ids.length) return;
    enVol[cid] = true;
    var envoi = ids.map(function (k) { var x = a[k]; return { id: k, quoi: x.quoi, cle: x.cle, titre: x.titre, vers: versListe(x.vers), modif: x.modif }; });
    P.appel(cid, "partages.ecrire", { partages: envoi }).then(function () {
      var b = attente(cid);
      envoi.forEach(function (x) { if (b[x.id] && b[x.id].modif === x.modif) b[x.id].remis = 1; });   // changé entre-temps : il repartira
      retenir(cid, b); delete sans[cid]; delete pannes[cid];
    }, function (e) {
      var m = String((e && e.message) || e);
      if (/inconnue/i.test(m)) { sans[cid] = Date.now(); delete pannes[cid]; } else pannes[cid] = m.slice(0, 200);
    }).then(function () { delete enVol[cid]; dessiner(); if (!sans[cid] && !pannes[cid] && enAttente(cid)) pousser(cid); });
  }

  // Ce que les autres comptes de cet appareil partagent avec un compte (par son adresse Google).
  function pour(cid, quois) {
    if (!P) return [];
    var cible = P.adresse(cid), r = [];
    if (!cible) return r;
    P.comptes().forEach(function (c) {
      if (c.id === cid) return;
      partagesDe(c.id).forEach(function (p) {
        if (quois.indexOf(p.quoi) < 0 || p.vers.indexOf(cible) < 0) return;
        r.push({ src: c.id, srcNom: c.nom, couleur: c.couleur, quoi: p.quoi, cle: p.cle, titre: p.titre });
      });
    });
    return r;
  }

  // ---------- Spectacles d'un compte (pour les régler) ----------
  function lireSpectacles(cid) {
    var s = spectacles[cid] || (spectacles[cid] = { liste: null, lu: 0, enCours: false, panne: "" });
    if (s.enCours || (s.liste && Date.now() - s.lu < 600000) || !P) return;
    s.enCours = true;
    P.spectacles(cid).then(function (l) { s.liste = l; s.lu = Date.now(); s.panne = ""; }, function (e) { s.panne = String((e && e.message) || e).slice(0, 200); }).then(function () { s.enCours = false; dessiner(); });
  }

  // ---------- Écran ----------
  function cibles(cid) { return P.comptes().filter(function (c) { return c.id !== cid; }); }
  function cases(cid, quoi, cle, titre, cs, fige) {
    var h = '<div class="pa-cibles">';
    cs.forEach(function (c) {
      var ad = P.adresse(c.id), oui = ad && voit(cid, quoi, cle, ad);
      h += '<label class="pa-cible' + (oui ? " oui" : "") + (!ad || fige ? " fige" : "") + '"' + (!ad ? ' title="Adresse Google de ce compte encore inconnue : relie-le d\'abord à Google"' : "") + '><input type="checkbox" data-pa="case" data-c="' + cid + '" data-q="' + quoi + '" data-k="' + texte(cle) + '" data-t="' + texte(titre) + '" data-a="' + texte(ad) + '"' + (oui ? " checked" : "") + (!ad || fige ? " disabled" : "") + '><span class="point" style="background:' + c.couleur + '"></span>' + texte(c.nom) + "</label>";
    });
    return h + "</div>";
  }
  function choixSpectacle(cid, sp, cs) {
    var h = '<div class="pa-cibles">';
    cs.forEach(function (c) {
      var ad = P.adresse(c.id), v = !ad ? "" : voit(cid, "spectacle", sp.cle, ad) ? "tout" : voit(cid, "fichiers", sp.cle, ad) ? "fichiers" : "";
      h += '<label class="pa-cible' + (v ? " oui" : "") + (!ad ? " fige" : "") + '"><span class="point" style="background:' + c.couleur + '"></span>' + texte(c.nom) +
        '<select data-pa="spectacle" data-c="' + cid + '" data-k="' + texte(sp.cle) + '" data-t="' + texte(sp.nom) + '" data-a="' + texte(ad) + '"' + (!ad ? " disabled" : "") + ">" +
        '<option value=""' + (!v ? " selected" : "") + ">Rien</option><option value=\"fichiers\"" + (v === "fichiers" ? " selected" : "") + ">Ses fichiers</option><option value=\"tout\"" + (v === "tout" ? " selected" : "") + ">Tout le spectacle</option></select></label>";
    });
    return h + "</div>";
  }
  function etatDe(cid) {
    var n = enAttente(cid);
    if (!n) return "";
    if (!P.relie(cid)) return "Ce compte n'est pas relié à son moteur sur cet appareil : ses partages restent ici pour l'instant.";
    if (pannes[cid]) return "Le compte n'a pas pu ranger les derniers changements (" + pannes[cid] + "). Ils sont gardés sur cet appareil.";
    if (sans[cid]) return "Gardé sur cet appareil pour l'instant : le moteur de ce compte sera mis à jour pour ranger les partages. Ils marchent déjà sur cet appareil.";
    return "Rangement dans le compte en cours…";
  }
  function blocCompte(c, plusieurs) {
    var cs = cibles(c.id), h = "";
    if (plusieurs) h += '<div class="du-compte"><span class="point" style="background:' + c.couleur + '"></span>' + texte(c.nom) + "</div>";
    var e = etatDe(c.id);
    if (e) h += '<p class="aide pa-etat' + (pannes[c.id] ? " souci" : "") + '">' + texte(e) + (pannes[c.id] || sans[c.id] ? ' <button class="lien" data-pa="reessayer" data-c="' + c.id + '">Réessayer</button>' : "") + "</p>";
    // Ce que les autres comptes partagent avec celui-ci
    var recus = pour(c.id, ["contacts", "fichiers", "fichier", "spectacle", "pieds", "modeles"]);
    h += '<h2 class="pa-titre">Partagé avec ' + texte(c.nom) + "</h2>";
    if (!P.adresse(c.id)) h += '<p class="vide">L\'adresse Google de ce compte n\'est pas encore connue sur cet appareil : relie-le à Google pour recevoir des partages.</p>';
    else if (!recus.length) h += '<p class="vide">Rien pour l\'instant. Ce que tes autres comptes partagent avec celui-ci apparaîtra ici.</p>';
    else recus.forEach(function (r) {
      var ouvrir = r.quoi === "contacts" ? "contacts" : r.quoi === "fichiers" || r.quoi === "fichier" || r.quoi === "spectacle" ? "fichiers" : "";
      h += '<div class="rangee pa-recu"><div><span class="quoi">' + texte(r.quoi === "contacts" ? "Contacts communs" : r.titre || QUOIS[r.quoi]) + '</span><span class="etiquette">' + texte(QUOIS[r.quoi]) + '</span><span class="detail"><span class="point" style="background:' + r.couleur + '"></span> de ' + texte(r.srcNom) + "</span>" +
        (ouvrir ? '<span class="gestes"><button class="lien" data-pa="ouvrir" data-v="' + ouvrir + '" data-c="' + c.id + '" data-s="' + r.src + '" data-k="' + texte(r.cle) + '">Ouvrir</button></span>' : "") + "</div></div>";
    });
    // Ce que ce compte partage avec les autres
    h += '<h2 class="pa-titre">Partager depuis ' + texte(c.nom) + "</h2>";
    if (!cs.length) { h += '<p class="vide">Ajoute un autre compte à Origami pour partager avec lui.</p>'; return h; }
    h += '<div class="rangee pa-rang"><div><span class="quoi">Contacts communs</span><span class="detail">Les contacts de l\'onglet « Contacts communs » de ce compte.</span></div>' + cases(c.id, "contacts", "", "Contacts communs", cs) + "</div>";
    var s = spectacles[c.id];
    h += '<h3 class="pa-sous">Spectacles</h3>';
    if (!s || (!s.liste && !s.panne)) h += '<p class="vide">Lecture des spectacles…</p>';
    else if (!s.liste) h += '<p class="vide">Les spectacles de ce compte n\'ont pas pu être lus' + (/ACCES/.test(s.panne) ? " : ouvre Spectacle une fois sur cet appareil, puis reviens ici." : " (" + texte(s.panne) + ").") + ' <button class="lien" data-pa="relire" data-c="' + c.id + '">Réessayer</button></p>';
    else if (!s.liste.length) h += '<p class="vide">Aucun spectacle dans ce compte pour l\'instant.</p>';
    else s.liste.forEach(function (sp) {
      h += '<div class="rangee pa-rang"><div><span class="quoi">' + texte(sp.nom) + "</span></div>" + choixSpectacle(c.id, sp, cs);
      // Les fichiers de ce spectacle partagés un par un (depuis Fichiers) : on peut aussi les décocher ici.
      partagesDe(c.id).filter(function (p) { return p.quoi === "fichier" && p.cle.indexOf(sp.cle + "::") === 0; }).forEach(function (p) {
        h += '<div class="pa-un"><span class="detail">' + texte(String(p.titre || "").split(" \u203a ").slice(1).join(" \u203a ") || p.titre) + "</span>" + cases(c.id, "fichier", p.cle, p.titre, cs) + "</div>";
      });
      h += "</div>";
    });
    h += '<p class="aide">Pour partager un seul fichier ou quelques fichiers : dans Fichiers, ouvre le fichier, ou touche « Choisir ».</p>';
    var ag = agendas[c.id];
    h += '<h3 class="pa-sous">Agendas</h3>';
    if (!ag || (!ag.liste && !ag.panne)) h += '<p class="vide">Lecture des agendas…</p>';
    else if (!ag.liste) h += '<p class="vide">Les agendas de ce compte n\'ont pas pu être lus (' + texte(ag.panne) + '). <button class="lien" data-pa="relire-ag" data-c="' + c.id + '">Réessayer</button></p>';
    else if (!ag.liste.length) h += '<p class="vide">Aucun agenda à ce compte.</p>';
    else ag.liste.forEach(function (a) { h += '<div class="rangee pa-rang"><div><span class="quoi"><span class="point" style="background:' + texte(a.couleur) + '"></span> ' + texte(a.nom) + '</span><span class="gestes"><button class="lien" data-pag="ouvrir" data-c="' + c.id + '" data-id="' + texte(a.id) + '" data-nom="' + texte(a.nom) + '">Partager…</button></span></div></div>'; });
    h += '<p class="aide">Un agenda se partage dans Google Agenda lui-même : l\'autre compte, ou la personne, le voit chez elle.</p>';
    h += '<h3 class="pa-sous">Boîte mail</h3>';
    h += '<div class="rangee pa-rang pa-bientot"><div><span class="quoi">Pieds de page et modèles de mail</span><span class="etiquette">Bientôt</span></div><div><span class="detail">Arrive avec la prochaine version de la Boîte mail.</span></div></div>';
    return h;
  }
  function dessiner() {
    if (!racine || racine.hidden || !P || !tete) return;
    var cs = P.vus();
    tete.innerHTML = '<div class="entete"><div><h1>Partage entre comptes</h1><p>Ce que tes comptes Origami ont en commun. Chaque chose reste dans son compte, les autres la voient.</p></div></div>' +
      '<div class="onglets" role="tablist"><button role="tab" data-pa="onglet" data-v="partages" aria-selected="' + (onglet === "partages") + '">Ce qui est partagé</button><button role="tab" data-pa="onglet" data-v="contacts" aria-selected="' + (onglet === "contacts") + '">Contacts communs</button></div>';
    zoneRep.hidden = onglet !== "contacts";
    corps.hidden = onglet !== "partages";
    if (onglet === "contacts") return;
    var h = "";
    if (!cs.length) h = '<p class="vide">Aucun compte affiché.</p>';
    else cs.forEach(function (c) { h += blocCompte(c, cs.length > 1); });
    h += '<p class="aide pa-note">Les partages se voient dans Origami, sur les appareils reliés aux deux comptes. Rien n\'est copié et aucun droit n\'est donné dans Google Drive.</p>';
    var haut = racine.scrollTop;
    corps.innerHTML = h;
    racine.scrollTop = haut;
  }
  function charger() { P.vus().forEach(function (c) { lireSpectacles(c.id); lireAgendas(c.id); pousser(c.id); }); }
  function lireAgendas(cid) {
    var s = agendas[cid] || (agendas[cid] = { liste: null, lu: 0, enCours: false, panne: "" });
    if (s.enCours || (s.liste && Date.now() - s.lu < 600000) || !P) return;
    if (!P.relie(cid)) { s.panne = "compte pas relié sur cet appareil"; return; }
    s.enCours = true;
    P.appel(cid, "agenda.calendriers", {}).then(function (r) {
      s.liste = (r && Array.isArray(r.calendriers) ? r.calendriers : []).filter(function (a) { return a && a.acces === "owner" && !/#holiday@|#contacts@|#weeknum@/.test(String(a.id)); }).map(function (a) { return { id: String(a.id), nom: String(a.nom || a.id), couleur: /^#[0-9a-f]{3,8}$/i.test(a.couleur) ? a.couleur : "#7986cb" }; });
      s.lu = Date.now(); s.panne = "";
    }, function (e) { s.panne = String((e && e.message) || e).slice(0, 200); }).then(function () { s.enCours = false; dessiner(); });
  }

  // ---------- Partager un agenda (vrai partage Google Agenda, sans mail d'invitation) ----------
  var ROLES = { "": "Rien", reader: "Voir", writer: "Modifier" };
  function dessinerFeuille() {
    if (!feuille || !P) return;
    var f = feuille, h = "<h2>Partager « " + texte(f.nom) + " »</h2>";
    h += "<p>Google Agenda partage vraiment cet agenda : il apparaît chez l'autre compte ou la personne. Aucun mail d'invitation n'est envoyé.</p>";
    if (!f.personnes) h += '<p class="vide">' + (f.souci ? texte(f.souci) : "Lecture des partages…") + "</p>";
    else {
      var vus = {};
      var cs = P.comptes().filter(function (c) { return c.id !== f.c && P.adresse(c.id); });
      if (cs.length) {
        h += '<h3 class="pa-sous">Tes autres comptes</h3>';
        cs.forEach(function (c) {
          var ad = P.adresse(c.id), p = f.personnes.filter(function (x) { return x.adresse === ad; })[0], v = p ? p.role : "";
          vus[ad] = 1;
          h += '<div class="pa-ag-ligne"><span><span class="point" style="background:' + c.couleur + '"></span> ' + texte(c.nom) + '</span><select data-pag="role" data-a="' + texte(ad) + '"' + (f.occupe ? " disabled" : "") + ">" + Object.keys(ROLES).map(function (k) { return '<option value="' + k + '"' + (k === v ? " selected" : "") + ">" + ROLES[k] + "</option>"; }).join("") + "</select></div>";
        });
      }
      var autres = f.personnes.filter(function (x) { return !vus[x.adresse]; });
      h += '<h3 class="pa-sous">Autres personnes</h3>';
      if (!autres.length) h += '<p class="aide">Personne d\'autre pour l\'instant.</p>';
      autres.forEach(function (x) {
        h += '<div class="pa-ag-ligne"><span>' + texte(x.adresse) + '</span><select data-pag="role" data-a="' + texte(x.adresse) + '"' + (f.occupe ? " disabled" : "") + ">" + Object.keys(ROLES).map(function (k) { return '<option value="' + k + '"' + (k === x.role ? " selected" : "") + ">" + (k ? ROLES[k] : "Retirer") + "</option>"; }).join("") + "</select></div>";
      });
      h += '<div class="pa-ag-ajout"><label class="champ">Ajouter une personne<input id="paAgMail" type="email" maxlength="190" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="nom@exemple.com"></label><label class="champ">Elle peut<select id="paAgRole"><option value="reader">Voir</option><option value="writer">Modifier</option></select></label><button class="bouton" data-pag="ajouter"' + (f.occupe ? " disabled" : "") + ">Partager</button></div>";
      if (f.public) h += '<p class="aide">Cet agenda est aussi public dans Google Agenda (réglé ailleurs qu\'ici).</p>';
    }
    h += '<p id="paAgSouci" class="souci" role="status">' + (f.personnes && f.souci ? texte(f.souci) : "") + '</p><div class="actions"><button class="bouton fort" data-pag="fermer">Fini</button></div>';
    P.ouvrirVoile(h);
  }
  function ouvrirAgenda(cid, id, nom) {
    if (!P || !cid || !id) return;
    if (!P.relie(cid)) { P.avis("Ce compte n'est pas relié sur cet appareil.", true); return; }
    feuille = { c: cid, id: id, nom: nom || "Agenda", personnes: null, public: false, occupe: false, souci: "" };
    dessinerFeuille();
    var f = feuille;
    P.appel(cid, "agenda.partage.lister", { calendrier: id }).then(function (r) { if (feuille !== f) return; f.personnes = r.personnes || []; f.public = !!r.public; dessinerFeuille(); }, function (e) {
      if (feuille !== f) return;
      var m = String((e && e.message) || e);
      f.souci = /inconnue/i.test(m) ? "Le partage des agendas arrive avec la prochaine mise à jour du moteur de ce compte." : m.slice(0, 200);
      dessinerFeuille();
    });
  }
  function reglerAgenda(adresse, role) {
    var f = feuille; if (!f || f.occupe) return;
    f.occupe = true; f.souci = ""; dessinerFeuille();
    P.appel(f.c, "agenda.partage.regler", { calendrier: f.id, adresse: adresse, role: role }).then(function (r) {
      f.personnes = r.personnes || []; f.public = !!r.public;
      P.avis(role ? "Agenda partagé avec " + adresse + (role === "writer" ? " (peut modifier)." : " (peut voir).") : "Agenda plus partagé avec " + adresse + ".");
    }, function (e) { f.souci = String((e && e.message) || e).slice(0, 200); }).then(function () { f.occupe = false; if (feuille === f) dessinerFeuille(); });
  }
  // Le menu d'un agenda (agenda.js) porte un bouton data-ag-partager="<compte>|<id>" (et data-ag-nom) : il ouvre cette feuille.
  document.addEventListener("click", function (ev) {
    var b = ev.target.closest ? ev.target.closest("[data-ag-partager],[data-pag]") : null;
    if (!b || !P) return;
    var d = b.dataset;
    if (d.agPartager != null) { var i = String(d.agPartager).indexOf("|"); if (i > 0) ouvrirAgenda(String(d.agPartager).slice(0, i), String(d.agPartager).slice(i + 1), d.agNom || ""); return; }
    if (b.tagName === "SELECT") return;
    if (d.pag === "ouvrir") { ouvrirAgenda(d.c, d.id, d.nom); return; }
    if (d.pag === "fermer") { feuille = null; P.fermerVoile(); return; }
    if (d.pag === "ajouter") {
      var m = String((document.getElementById("paAgMail") || {}).value || "").trim().toLowerCase(), r = String((document.getElementById("paAgRole") || {}).value || "reader");
      if (!/^[^\s@"<>(),;:]{1,64}@[^\s@"<>(),;:]{1,120}\.[^\s@"<>(),;:.]{2,24}$/.test(m)) { var z = document.getElementById("paAgSouci"); if (z) z.textContent = "Cette adresse mail n'a pas la bonne forme."; return; }
      reglerAgenda(m, r === "writer" ? "writer" : "reader");
    }
  });
  document.addEventListener("change", function (ev) {
    var t = ev.target;
    if (!t || !t.dataset || t.dataset.pag !== "role" || !feuille) return;
    reglerAgenda(t.dataset.a, t.value === "writer" ? "writer" : t.value === "reader" ? "reader" : "");
  });
  function montrerContacts() { if (window.OrigamiRepertoire && P.repertoire) window.OrigamiRepertoire.montrer(zoneRep, P.repertoire); }

  document.addEventListener("click", function (ev) {
    var b = ev.target.closest ? ev.target.closest("[data-pa]") : null;
    if (!b || !P || !racine || !racine.contains(b) || b.tagName === "INPUT" || b.tagName === "SELECT") return;
    var d = b.dataset;
    if (d.pa === "onglet") { onglet = d.v === "contacts" ? "contacts" : "partages"; garder("origami_partage_onglet", onglet === "contacts" ? "contacts" : ""); dessiner(); if (onglet === "contacts") montrerContacts(); else charger(); return; }
    if (d.pa === "reessayer") { delete sans[d.c]; delete pannes[d.c]; pousser(d.c); dessiner(); return; }
    if (d.pa === "relire-ag") { delete agendas[d.c]; lireAgendas(d.c); dessiner(); return; }
    if (d.pa === "relire") { delete spectacles[d.c]; lireSpectacles(d.c); dessiner(); return; }
    if (d.pa === "ouvrir") {
      if (d.v === "contacts") { onglet = "contacts"; dessiner(); montrerContacts(); return; }
      P.ouvrirFichiers(d.c, d.s, d.k);
    }
  });
  document.addEventListener("change", function (ev) {
    var t = ev.target;
    if (!t || !t.dataset || !t.dataset.pa || !racine || !racine.contains(t) || !P) return;
    var d = t.dataset;
    if (!d.a) return;
    if (d.pa === "case") { regler(d.c, d.q, d.k, d.t, d.a, t.checked); P.avis(t.checked ? "Partagé." : "Ce compte ne le voit plus."); }
    else if (d.pa === "spectacle") {
      var v = t.value;
      regler(d.c, "spectacle", d.k, d.t, d.a, v === "tout");
      regler(d.c, "fichiers", d.k, d.t, d.a, v === "fichiers");
      P.avis(v === "tout" ? "Tout le spectacle est partagé." : v === "fichiers" ? "Ses fichiers sont partagés." : "Ce compte ne le voit plus.");
    } else return;
    pousser(d.c); dessiner(); P.changement();
  });

  window.OrigamiPartage = {
    montrer: function (zone, pont) {
      P = pont;
      if (racine !== zone) {
        racine = zone;
        racine.innerHTML = '<div class="appli large pa"><div class="pa-tete"></div><div class="pa-corps"></div><div class="pa-rep"></div></div>';
        tete = racine.querySelector(".pa-tete"); corps = racine.querySelector(".pa-corps"); zoneRep = racine.querySelector(".pa-rep");
        onglet = lire("origami_partage_onglet") === "contacts" ? "contacts" : "partages";
      }
      dessiner();
      if (onglet === "contacts") montrerContacts(); else charger();
    },
    rafraichir: function () { if (!racine || racine.hidden) return; if (onglet === "contacts") { if (window.OrigamiRepertoire) window.OrigamiRepertoire.rafraichir(); } else { charger(); dessiner(); } },
    montrerContacts: function () { onglet = "contacts"; garder("origami_partage_onglet", "contacts"); },
    pour: function (pont, cid, quois) { P = P || pont; return pour(cid, quois); },
    // Le compte est retiré de l'appareil : ses partages pas encore remis aussi.
    brancher: function (pont) { P = P || pont; },
    partagerAgenda: function (pont, cid, id, nom) { P = P || pont; ouvrirAgenda(cid, id, nom); },
    oublier: function (id) { garder(ATT + id, ""); delete agendas[id]; delete spectacles[id]; delete sans[id]; delete pannes[id]; delete enVol[id]; },
    idDe: idDe,
    // Pour Fichiers : partager un ou plusieurs fichiers depuis sa fiche.
    cibles: function (pont, cid) { P = P || pont; return P.comptes().filter(function (c) { return c.id !== cid; }).map(function (c) { return { id: c.id, nom: c.nom, couleur: c.couleur, adresse: P.adresse(c.id) }; }); },
    voit: function (pont, cid, quoi, cle, adresse) { P = P || pont; return voit(cid, quoi, cle, adresse); },
    regler: function (pont, cid, quoi, cle, titre, adresse, oui) { P = P || pont; regler(cid, quoi, cle, titre, adresse, oui); },
    pousser: function (pont, cid) { P = P || pont; pousser(cid); }
  };

  var css = document.createElement("style");
  css.textContent = [
    ".pa .entete{align-items:center;max-width:none;margin:0 0 10px}",
    ".pa .onglets{max-width:none}",
    ".pa .pa-rep .rp .entete h1{font-size:18px}",
    ".pa-titre{margin:18px 0 8px;font-size:15px}",
    ".pa-sous{margin:14px 0 6px;font-size:12px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--doux)}",
    ".pa-rang>div:first-child{gap:3px 12px}",
    ".pa-cibles{display:flex;flex-wrap:wrap;gap:6px 8px;margin-top:4px}",
    ".pa-cible{display:inline-flex;align-items:center;gap:6px;min-height:30px;padding:0 10px;border:1px solid var(--ligne);border-radius:999px;font-size:13px;cursor:pointer;max-width:100%}",
    ".pa-cible.oui{border-color:var(--accent);background:var(--accent-clair)}",
    ".pa-cible.fige{opacity:.55;cursor:default}",
    ".pa-cible input{margin:0}",
    ".pa-cible select{margin-left:4px;min-height:26px;border:1px solid var(--ligne);border-radius:6px;background:var(--carte);color:var(--texte);font:inherit;font-size:12.5px;max-width:150px}",
    ".pa-recu .detail{display:inline-flex;align-items:center;gap:5px}",
    ".pa-recu .point,.pa-cible .point{width:8px;height:8px}",
    ".pa-bientot{opacity:.7}",
    ".pa-un{display:flex;flex-wrap:wrap;align-items:center;gap:4px 12px;margin-top:6px;padding-top:6px;border-top:1px dashed var(--ligne)}",
    ".pa-un .detail{flex:1 1 160px;color:var(--doux);font-size:12.5px}",
    ".pa-note{margin-top:22px}",
    ".pa-ag-ligne{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:6px 0;border-bottom:1px solid var(--ligne);font-size:14px;overflow-wrap:anywhere}",
    ".pa-ag-ligne select,#paAgRole{min-height:30px;border:1px solid var(--ligne);border-radius:8px;background:var(--carte);color:var(--texte);font:inherit;font-size:13px;flex:none}",
    ".pa-ag-ligne .point{display:inline-block;width:8px;height:8px;vertical-align:middle}",
    ".pa-ag-ajout{display:flex;flex-wrap:wrap;align-items:flex-end;gap:8px;margin-top:10px}",
    ".pa-ag-ajout .champ:first-child{flex:1 1 200px}",
    ".pa .rangee .quoi .point{display:inline-block;width:9px;height:9px;vertical-align:middle}",
    ".pa .du-compte{margin:22px 0 4px;max-width:none;font-size:15px}",
    "@media (max-width:520px){.pa-cible{min-height:36px}.pa-cible select{max-width:130px}}"
  ].join("\n");
  document.head.appendChild(css);
})();
