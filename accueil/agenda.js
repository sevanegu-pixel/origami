// Agenda d'Origami (18.11.2026) : les vrais agendas Google de chaque compte (les siens, ceux qu'on lui partage, les jours
// fériés…) et les dates de la prospection (Diffusion et campagnes de la Boîte mail, en lecture seule), dans un seul écran
// proche de Google Agenda : Jour, Semaine, Mois, Planning ; créer, modifier, déplacer, répéter, inviter, répondre.
// Tout passe par le moteur Origami de chaque compte (prises « agenda.… », moteur v4). La page Origami lui donne un pont :
// window.OrigamiPont (comptes affichés, appel au moteur, avis). Aucune donnée ne quitte l'appareil sauf vers ces moteurs.
(function () {
  "use strict";
  var P = null, racine = null;
  var JOURS = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"];
  var JOURS_C = ["lun.", "mar.", "mer.", "jeu.", "ven.", "sam.", "dim."];
  var BYDAY = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"];
  var MOIS_C = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
  var MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
  // Couleurs d'événement de Google Agenda (les noms et teintes de son écran).
  var COULEURS_EV = { 1: ["Lavande", "#7986cb"], 2: ["Sauge", "#33b679"], 3: ["Raisin", "#8e24aa"], 4: ["Flamant", "#e67c73"], 5: ["Banane", "#f6bf26"], 6: ["Mandarine", "#f4511e"], 7: ["Paon", "#039be5"], 8: ["Graphite", "#616161"], 9: ["Myrtille", "#3f51b5"], 10: ["Basilic", "#0b8043"], 11: ["Tomate", "#d50000"] };
  var COULEURS_CAL = ["#ac725e", "#d06b64", "#f83a22", "#fa573c", "#ff7537", "#ffad46", "#42d692", "#16a765", "#7bd148", "#b3dc6c", "#fbe983", "#fad165", "#92e1c0", "#9fe1e7", "#9fc6e7", "#4986e7", "#9a9cff", "#b99aff", "#c2c2c2", "#cabdbf", "#cca6ac", "#f691b2", "#cd74e6", "#a47ae2"];
  // Les « agendas » de la prospection : un par sorte de date.
  var PROSPECTION = [
    { id: "dates", nom: "Dates (spectacles, résidences)", couleur: "#15803d" },
    { id: "relances", nom: "Relances", couleur: "#e0a800" },
    { id: "limites", nom: "Dates limites des appels", couleur: "#b42318" },
    { id: "rappels", nom: "Rappels", couleur: "#7d3c5e" },
    { id: "afaire", nom: "À faire", couleur: "#0e7490" },
    { id: "campagnes", nom: "Campagnes", couleur: "#1f5cff" }
  ];
  var HEURE = 48;   // hauteur d'une heure dans les vues Jour et Semaine (pixels)

  // ---------- Mémoire de l'appareil (réglages seulement) ----------
  var reg = { vue: "", coches: {}, couleursP: {}, dernierCal: "" };
  try { var r0 = JSON.parse(localStorage.getItem("origami_agenda") || "null"); if (r0 && typeof r0 === "object") { reg.vue = typeof r0.vue === "string" ? r0.vue : ""; reg.coches = r0.coches && typeof r0.coches === "object" ? r0.coches : {}; reg.couleursP = r0.couleursP && typeof r0.couleursP === "object" ? r0.couleursP : {}; reg.dernierCal = typeof r0.dernierCal === "string" ? r0.dernierCal : ""; } } catch (e) {}
  function retenir() { try { localStorage.setItem("origami_agenda", JSON.stringify(reg)); } catch (e) {} }

  var etroit = function () { return window.matchMedia("(max-width: 760px)").matches; };
  var ag = { vue: reg.vue || "", date: aujourdhui(), mini: "", recherche: null, volet: false };
  var donnees = {};     // par compte : { cals, couleurs, moi, panne, charge, prospection, prospT, prospPanne, mois: { 'AAAA-MM': { cles, evs, t } } }
  var enCours = {};     // appels en vol (pour ne pas les doubler)
  function fini(cle) { delete enCours[cle]; if (!Object.keys(enCours).length) { ag.garderDefile = true; dessiner(); } }

  // ---------- Dates ----------
  function z(n) { return ("0" + n).slice(-2); }
  function iso(d) { return d.getFullYear() + "-" + z(d.getMonth() + 1) + "-" + z(d.getDate()); }
  function aujourdhui() { return iso(new Date()); }
  function dateDe(s) { var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : new Date(s); }
  function plus(d, n) { var x = new Date(d.getFullYear(), d.getMonth(), d.getDate() + n, d.getHours(), d.getMinutes()); return x; }
  function lundi(d) { var j = (d.getDay() + 6) % 7; return plus(new Date(d.getFullYear(), d.getMonth(), d.getDate()), -j); }
  function hm(d) { return z(d.getHours()) + ":" + z(d.getMinutes()); }
  function jourLong(d) { return JOURS[(d.getDay() + 6) % 7] + " " + d.getDate() + " " + MOIS[d.getMonth()] + (d.getFullYear() !== new Date().getFullYear() ? " " + d.getFullYear() : ""); }
  function memeJour(a, b) { return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate(); }
  function numeroSemaine(d) { var t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())); var j = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - j); var a = new Date(Date.UTC(t.getUTCFullYear(), 0, 1)); return Math.ceil(((t - a) / 864e5 + 1) / 7); }
  function fuseau() { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Zurich"; } catch (e) { return "Europe/Zurich"; } }

  function texte(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function couleurSure(c) { return /^#[0-9a-f]{6}$/i.test(String(c || "")) ? c : "#7986cb"; }
  function sombre(c) { c = couleurSure(c); var r = parseInt(c.slice(1, 3), 16), g = parseInt(c.slice(3, 5), 16), b = parseInt(c.slice(5, 7), 16); return (r * 299 + g * 587 + b * 114) / 1000 < 150; }
  function lienSur(u) { return /^https:\/\/[^\s"<>]+$/.test(String(u || "")) ? u : ""; }
  // Notes de Google : souvent du HTML. Lues sans rien exécuter (DOMParser), rendues en texte avec les liens cliquables.
  function notesTexte(h) {
    h = String(h || ""); if (!/[<&]/.test(h)) return h;
    try { var doc = new DOMParser().parseFromString("<div>" + h.replace(/<br\s*\/?>/gi, "\n").replace(/<\/(p|div|li)>/gi, "\n") + "</div>", "text/html"); return (doc.body.textContent || "").replace(/\n{3,}/g, "\n\n").trim(); } catch (e) { return h; }
  }
  function lierLiens(t) { return texte(t).replace(/https:\/\/[^\s<>"]+/g, function (u) { return '<a href="' + u + '" target="_blank" rel="noopener">' + u + "</a>"; }).replace(/\n/g, "<br>"); }

  // ---------- Comptes, agendas, cases ----------
  function comptes() { return P ? P.comptesVus() : []; }
  function cleCal(compte, cal) { return compte + "|" + cal; }
  function coche(compte, cal, defaut) { var k = cleCal(compte, cal); return reg.coches[k] === undefined ? defaut : !!reg.coches[k]; }
  function calsDe(compte) { var d = donnees[compte]; return (d && d.cals) || []; }
  function cal(compte, id) { return calsDe(compte).filter(function (c) { return c.id === id; })[0] || null; }
  function calsCoches(compte) { return calsDe(compte).filter(function (c) { return coche(compte, c.id, c.coche); }).map(function (c) { return c.id; }); }
  function couleurP(compte, type) { var p = PROSPECTION.filter(function (x) { return x.id === type; })[0]; return couleurSure(reg.couleursP[compte + "|" + type] || (p && p.couleur)); }
  function ecrivables() {
    var l = [];
    comptes().forEach(function (c) { calsDe(c.id).forEach(function (k) { if (k.acces === "owner" || k.acces === "writer") l.push({ compte: c, cal: k }); }); });
    return l;
  }

  // ---------- Période affichée ----------
  function periode() {
    var d = dateDe(ag.date), v = vue();
    if (v === "jour") return { debut: d, fin: plus(d, 1), jours: 1 };
    if (v === "semaine") { var l = lundi(d); return { debut: l, fin: plus(l, 7), jours: 7 }; }
    if (v === "mois") { var p = lundi(new Date(d.getFullYear(), d.getMonth(), 1)); return { debut: p, fin: plus(p, 42), jours: 42 }; }
    return { debut: d, fin: plus(d, 62), jours: 62 };   // planning : deux mois depuis le jour choisi
  }
  function vue() { return ["jour", "semaine", "mois", "planning"].indexOf(ag.vue) >= 0 ? ag.vue : (etroit() ? "planning" : "semaine"); }
  function moisCouverts(p) { var l = [], d = new Date(p.debut.getFullYear(), p.debut.getMonth(), 1); while (d < p.fin) { l.push(d.getFullYear() + "-" + z(d.getMonth() + 1)); d = new Date(d.getFullYear(), d.getMonth() + 1, 1); } return l; }

  // ---------- Chargement ----------
  function erreurLisible(e) {
    var m = String((e && e.message) || e || "");
    if (/Demande inconnue/.test(m)) return "Le moteur Origami de ce compte n'a pas encore l'Agenda (mise à jour en attente).";
    if (/ne répond pas/.test(m)) return "Le moteur de ce compte ne répond pas. S'il vient d'être mis à jour, Google attend ton autorisation : classeur « Origami - Réglages du compte », menu Origami, « Installer ou réparer ».";
    return m;
  }
  function charger(force) {
    comptes().forEach(function (c) {
      if (!c.relie) return;
      var d = donnees[c.id] || (donnees[c.id] = { mois: {} });
      if ((!d.cals || force) && !enCours[c.id + "/cals"]) {
        enCours[c.id + "/cals"] = 1;
        P.appel(c.id, "agenda.calendriers", {}, { sans: true }).then(function (r) {
          d.cals = (r && r.calendriers) || []; d.couleurs = r.couleursEvenement || {}; d.moi = r.moi || ""; d.panne = "";
          chargerEvenements(c.id, force); dessiner();
        }, function (e) { d.panne = erreurLisible(e); dessiner(); }).then(function () { fini(c.id + "/cals"); });
      } else if (d.cals) chargerEvenements(c.id, force);
      if ((!d.prospection || force || Date.now() - (d.prospT || 0) > 300000) && !enCours[c.id + "/p"]) {
        enCours[c.id + "/p"] = 1;
        P.appel(c.id, "agenda.prospection", force ? { frais: true } : {}, { sans: true }).then(function (r) {
          d.prospection = r || { elements: [] }; d.prospT = Date.now(); d.prospPanne = ""; dessiner();
        }, function (e) { d.prospPanne = erreurLisible(e); if (!d.prospection) d.prospection = { elements: [], sources: {} }; dessiner(); }).then(function () { fini(c.id + "/p"); });
      }
    });
  }
  function chargerEvenements(compte, force) {
    var d = donnees[compte], ids = calsCoches(compte).sort(), cles = ids.join(",");
    if (!ids.length) return;
    moisCouverts(periode()).forEach(function (mois) {
      var x = d.mois[mois], cleV = compte + "/" + mois;
      var manque = !x || ids.some(function (i) { return x.cles.indexOf(i) < 0; }) || force || Date.now() - x.t > 600000;
      if (!manque || enCours[cleV]) return;
      enCours[cleV] = 1;
      var deb = mois + "-01", f = new Date(+mois.slice(0, 4), +mois.slice(5, 7), 1);
      P.appel(compte, "agenda.evenements", { debut: deb, fin: iso(f), calendriers: ids }, { sans: true }).then(function (r) {
        d.mois[mois] = { cles: ids, evs: (r && r.evenements) || [], t: Date.now(), pannes: (r && r.pannes) || [] }; dessiner();
      }, function (e) { if (!d.mois[mois]) d.panne = erreurLisible(e); dessiner(); }).then(function () { fini(cleV); });
    });
  }
  // Après un changement : on oublie les mois touchés pour les relire.
  function oublier(compte, debut, fin) {
    var d = donnees[compte]; if (!d) return;
    var a = dateDe(String(debut).slice(0, 10)), b = dateDe(String(fin || debut).slice(0, 10)), m = new Date(a.getFullYear(), a.getMonth() - 1, 1);
    while (m <= b) { delete d.mois[m.getFullYear() + "-" + z(m.getMonth() + 1)]; m = new Date(m.getFullYear(), m.getMonth() + 1, 1); }
  }

  // ---------- Tous les éléments visibles, rangés pareil ----------
  function elements(p) {
    var l = [], vus = {};
    comptes().forEach(function (c) {
      var d = donnees[c.id]; if (!d) return;
      var cochees = {}; calsCoches(c.id).forEach(function (i) { cochees[i] = 1; });
      Object.keys(d.mois || {}).forEach(function (mois) {
        d.mois[mois].evs.forEach(function (e) {
          if (!cochees[e.cal]) return;
          var k = c.id + "|" + e.cal + "|" + e.id; if (vus[k]) return; vus[k] = 1;
          var k0 = cal(c.id, e.cal);
          var d0 = e.journee ? dateDe(e.debut) : new Date(e.debut), d1 = e.journee ? dateDe(e.fin) : new Date(e.fin);
          if (isNaN(d0) || isNaN(d1)) return;
          if (d1 <= d0) d1 = e.journee ? plus(d0, 1) : new Date(d0.getTime() + 1800000);
          var coul = e.couleur && COULEURS_EV[e.couleur] ? COULEURS_EV[e.couleur][1] : couleurSure(k0 && k0.couleur);
          l.push({ k: k, compte: c, src: "g", cal: e.cal, titre: e.titre || "(Sans titre)", d0: d0, d1: d1, journee: e.journee, couleur: coul, ev: e, refuse: e.moi === "declined", attente: e.moi === "needsAction", modifiable: !!(k0 && (k0.acces === "owner" || k0.acces === "writer")) });
        });
      });
      ((d.prospection && d.prospection.elements) || []).forEach(function (x) {
        if (!coche(c.id, "p:" + x.type, true)) return;
        var d0 = dateDe(String(x.debut).slice(0, 10)), d1 = plus(dateDe(String(x.fin || x.debut).slice(0, 10)), 1);
        if (isNaN(d0)) return;
        if (d1 <= d0) d1 = plus(d0, 1);
        l.push({ k: c.id + "|p|" + x.id, compte: c, src: "p", cal: "p:" + x.type, titre: x.titre, d0: d0, d1: d1, journee: true, couleur: couleurP(c.id, x.type), p: x, fait: x.statut === "Fait" });
      });
    });
    if (p) l = l.filter(function (x) { return x.d1 > p.debut && x.d0 < p.fin; });
    l.sort(function (a, b) { return (b.journee - a.journee) || (a.d0 - b.d0) || ((b.d1 - b.d0) - (a.d1 - a.d0)) || a.titre.localeCompare(b.titre); });
    return l;
  }
  var parCle = {};

  // ---------- Dessin ----------
  function maj(t) { return t.charAt(0).toUpperCase() + t.slice(1); }
  function titrePeriode() {
    var d = dateDe(ag.date), v = vue();
    if (ag.recherche) return "Recherche";
    if (v === "jour") return maj(jourLong(d));
    if (v === "semaine") { var l = lundi(d), f = plus(l, 6); return (l.getMonth() === f.getMonth() ? maj(MOIS[l.getMonth()]) : MOIS_C[l.getMonth()] + " – " + MOIS_C[f.getMonth()]) + " " + f.getFullYear(); }
    if (v === "mois") return maj(MOIS[d.getMonth()]) + " " + d.getFullYear();
    return "Dès le " + jourLong(d);
  }
  function dessiner() {
    if (!racine || racine.hidden) return;
    var defile = racine.querySelector(".ag-grille-defile"), haut = defile ? defile.scrollTop : null;
    var p = periode(), tous = elements(p);
    parCle = {}; elements(null).forEach(function (x) { parCle[x.k] = x; });
    var h = '<div class="ag' + (ag.volet ? " ag-volet-ouvert" : "") + '">';
    h += '<aside class="ag-cote">' + dessinerCote() + "</aside>" + (ag.volet ? '<button class="ag-scrim" data-ag="volet" aria-label="Fermer la liste des agendas"></button>' : "");
    h += '<div class="ag-centre"><div class="ag-barre">';
    h += '<button class="ag-b ag-menu-b" data-ag="volet" aria-label="Agendas" title="Agendas et petit calendrier">☰</button>';
    h += '<button class="ag-b" data-ag="auj">Aujourd\'hui</button><button class="ag-b ag-rond" data-ag="prec" aria-label="Précédent">‹</button><button class="ag-b ag-rond" data-ag="suiv" aria-label="Suivant">›</button>';
    h += '<h1 class="ag-titre">' + texte(titrePeriode()) + "</h1>";
    h += '<span class="ag-etat">' + etatChargement() + "</span>";
    h += '<label class="ag-cherche"><input id="agCherche" type="search" placeholder="Rechercher" value="' + texte(ag.recherche ? ag.recherche.q : "") + '" autocomplete="off"></label>';
    h += '<div class="ag-vues" role="group" aria-label="Vue">';
    [["jour", "Jour"], ["semaine", "Semaine"], ["mois", "Mois"], ["planning", "Planning"]].forEach(function (o) { h += '<button data-ag-vue="' + o[0] + '" aria-pressed="' + (vue() === o[0] && !ag.recherche) + '">' + o[1] + "</button>"; });
    h += '</div><button class="ag-b" data-ag="actualiser" title="Relire les agendas" aria-label="Actualiser">↻</button>';
    h += '</div><button class="ag-fab ag-tel" data-ag="creer" aria-label="Créer un événement">＋</button>';
    h += avertissements();
    if (ag.recherche) h += dessinerRecherche();
    else if (vue() === "mois") h += dessinerMois(p, tous);
    else if (vue() === "planning") h += dessinerPlanning(p, tous);
    else h += dessinerGrille(p, tous);
    h += "</div></div>";
    var focus = document.activeElement && document.activeElement.id === "agCherche", pos = focus ? document.activeElement.selectionStart : 0;
    racine.querySelector(".ag-zone").innerHTML = h;
    if (focus) { var i = document.getElementById("agCherche"); if (i) { i.focus(); try { i.setSelectionRange(pos, pos); } catch (e) {} } }
    var g = racine.querySelector(".ag-grille-defile");
    if (g) g.scrollTop = haut !== null && ag.garderDefile ? haut : Math.max(0, (vue() === "jour" || vue() === "semaine" ? 7.5 : 0) * HEURE - 4);
    ag.garderDefile = true;
  }
  function etatChargement() {
    var n = Object.keys(enCours).length;
    return n ? "Chargement…" : "";
  }
  function avertissements() {
    var h = "";
    var cs = comptes();
    if (!cs.length) return '<p class="ag-note">Aucun compte coché.</p>';
    cs.forEach(function (c) {
      var d = donnees[c.id];
      if (!c.relie) h += '<p class="ag-note"><span class="ag-pt" style="background:' + couleurSure(c.couleur) + '"></span>' + "Origami n'est pas encore relié au compte " + texte(c.nom) + " sur cet appareil. Une seule liaison suffit pour tout Origami (Agenda, Tickets, Répertoire…)." + (P.relier ? ' <button class="ag-b" data-ag-relier="' + texte(c.id) + '">Relier Origami</button>' : "") + "</p>";
      else if (d && d.panne && !d.cals) h += '<p class="ag-note ag-souci"><span class="ag-pt" style="background:' + couleurSure(c.couleur) + '"></span>' + texte(c.nom) + " : " + texte(d.panne) + "</p>";
    });
    return h;
  }
  function dessinerCote() {
    var h = '<button class="ag-creer" data-ag="creer"><span>＋</span> Créer</button>';
    h += dessinerMini();
    comptes().forEach(function (c) {
      var d = donnees[c.id] || {}, plusieurs = comptes().length > 1;
      h += '<div class="ag-groupe"><h2>' + (plusieurs ? '<span class="ag-pt" style="background:' + couleurSure(c.couleur) + '"></span>' + texte(c.nom) : "Mes agendas") + "</h2>";
      if (!c.relie) h += '<p class="ag-mini-note">Origami n\'est pas encore relié à ce compte sur cet appareil.</p>';
      else if (!d.cals) h += '<p class="ag-mini-note">' + (d.panne ? texte(d.panne) : "Chargement…") + "</p>";
      else {
        var propres = d.cals.filter(function (k) { return k.acces === "owner"; }), autres = d.cals.filter(function (k) { return k.acces !== "owner"; });
        propres.forEach(function (k) { h += ligneCal(c, k); });
        if (autres.length) { h += '<h3>Autres agendas</h3>'; autres.forEach(function (k) { h += ligneCal(c, k); }); }
        h += '<button class="ag-petit" data-ag-ajout-cal="' + texte(c.id) + '">＋ Ajouter un agenda</button>';
      }
      if (c.relie) {
        var pr = d.prospection, src = pr && pr.sources ? pr.sources : {};
        h += '<h3>Prospection' + '<button class="ag-icone" data-ag-sources="' + texte(c.id) + '" title="Où lire la prospection" aria-label="Sources de la prospection">⚙</button></h3>';
        if (pr && !src.diffusion && !src.boite) h += '<p class="ag-mini-note">Aucune source notée pour ce compte. <button class="ag-lien" data-ag-sources="' + texte(c.id) + '">Choisir les classeurs</button></p>';
        else PROSPECTION.forEach(function (t) {
          var n = pr ? pr.elements.filter(function (x) { return x.type === t.id; }).length : 0;
          h += '<div class="ag-cal"><label><input type="checkbox" data-ag-coche="' + texte(cleCal(c.id, "p:" + t.id)) + '"' + (coche(c.id, "p:" + t.id, true) ? " checked" : "") + ' style="--c:' + couleurP(c.id, t.id) + '"><span>' + t.nom + "</span></label>" + (n ? '<em>' + n + "</em>" : "") + '<button class="ag-icone" data-ag-menu-p="' + texte(c.id + "|" + t.id) + '" aria-label="Options">⋯</button></div>';
        });
        if (d.prospPanne) h += '<p class="ag-mini-note ag-souci">' + texte(d.prospPanne) + "</p>";
        if (pr && pr.pannes && pr.pannes.length) h += '<p class="ag-mini-note ag-souci">Lecture impossible : ' + pr.pannes.map(function (x) { return x === "boite" ? "Boîte mail" : "Diffusion"; }).join(", ") + ".</p>";
      }
      h += "</div>";
    });
    if (comptes().some(function (c) { return c.id === "compagnie"; })) h += '<p class="ag-mini-note"><button class="ag-lien" data-ag-diffusion="1">Ouvrir l\'agenda de Diffusion</button> (ajouter une date de spectacle, exporter)</p>';
    return h;
  }
  function ligneCal(c, k) {
    var nom = k.nom + (k.acces === "reader" || k.acces === "freeBusyReader" ? "" : "");
    return '<div class="ag-cal"><label title="' + texte(k.nom) + '"><input type="checkbox" data-ag-coche="' + texte(cleCal(c.id, k.id)) + '"' + (coche(c.id, k.id, k.coche) ? " checked" : "") + ' style="--c:' + couleurSure(k.couleur) + '"><span>' + texte(nom) + "</span></label>" +
      (k.acces === "reader" || k.acces === "freeBusyReader" ? '<em title="Partagé en lecture seule">lecture</em>' : "") + '<button class="ag-icone" data-ag-menu-cal="' + texte(cleCal(c.id, k.id)) + '" aria-label="Options de ' + texte(k.nom) + '">⋯</button></div>';
  }
  function dessinerMini() {
    var d = dateDe(ag.mini || ag.date), m = new Date(d.getFullYear(), d.getMonth(), 1), debut = lundi(m), auj = new Date(), choisi = dateDe(ag.date);
    var h = '<div class="ag-mini"><div class="ag-mini-tete"><strong>' + MOIS[m.getMonth()] + " " + m.getFullYear() + '</strong><button class="ag-icone" data-ag-mini="-1" aria-label="Mois précédent">‹</button><button class="ag-icone" data-ag-mini="1" aria-label="Mois suivant">›</button></div><div class="ag-mini-grille">';
    JOURS_C.forEach(function (j) { h += "<span>" + j.charAt(0).toUpperCase() + "</span>"; });
    for (var i = 0; i < 42; i++) {
      var x = plus(debut, i), cls = (x.getMonth() !== m.getMonth() ? " hors" : "") + (memeJour(x, auj) ? " auj" : "") + (memeJour(x, choisi) ? " choisi" : "");
      h += '<button class="' + cls.trim() + '" data-ag-date="' + iso(x) + '">' + x.getDate() + "</button>";
    }
    return h + "</div></div>";
  }
  function puce(x, avecHeure) {
    var style = x.journee || x.src === "p" ? 'style="--c:' + x.couleur + ";--t:" + (sombre(x.couleur) ? "#fff" : "#1a1a1a") + '"' : 'style="--c:' + x.couleur + '"';
    var cls = "ag-puce" + (x.journee ? " plein" : "") + (x.refuse ? " refuse" : "") + (x.attente ? " attente" : "") + (x.fait ? " fait" : "");
    return '<button class="' + cls + '" data-ag-ev="' + texte(x.k) + '" ' + style + ' title="' + texte(x.titre) + '">' + (!x.journee && avecHeure ? "<i></i><b>" + hm(x.d0) + "</b> " : "") + texte(x.titre) + "</button>";
  }
  // Barres de plusieurs jours (rangée « toute la journée » et vue Mois) : chaque élément prend la première ligne libre.
  function ranger(liste, debut, n) {
    var lignes = [];
    liste.forEach(function (x) {
      var a = Math.max(0, Math.round((new Date(x.d0.getFullYear(), x.d0.getMonth(), x.d0.getDate()) - debut) / 864e5));
      var fin = x.journee ? x.d1 : new Date(x.d1.getTime() - 1);
      var b = Math.min(n - 1, Math.round((new Date(fin.getFullYear(), fin.getMonth(), fin.getDate()) - debut) / 864e5));
      if (b < a) b = a;
      for (var l = 0; ; l++) { lignes[l] = lignes[l] || []; if (lignes[l].every(function (o) { return o.b < a || o.a > b; })) { lignes[l].push({ a: a, b: b, x: x }); break; } }
    });
    return lignes;
  }
  function dessinerGrille(p, tous) {
    var n = p.jours, auj = new Date(), h = '<div class="ag-grille" style="--n:' + n + '">';
    h += '<div class="ag-tete"><div class="ag-gouttiere">' + (n === 7 ? '<span class="ag-sem">S' + numeroSemaine(p.debut) + "</span>" : "") + "</div>";
    for (var i = 0; i < n; i++) { var d = plus(p.debut, i); h += '<button class="ag-jour-tete' + (memeJour(d, auj) ? " auj" : "") + '" data-ag-jour="' + iso(d) + '"><span>' + JOURS_C[(d.getDay() + 6) % 7] + "</span><strong>" + d.getDate() + "</strong></button>"; }
    h += "</div>";
    var longs = tous.filter(function (x) { return x.journee || x.d1 - x.d0 >= 864e5; }), courts = tous.filter(function (x) { return longs.indexOf(x) < 0; });
    var lignes = ranger(longs, p.debut, n), maxL = ag.toutVoir ? lignes.length : Math.min(lignes.length, 3);
    h += '<div class="ag-journee"><div class="ag-gouttiere">' + (lignes.length > 3 ? '<button class="ag-icone" data-ag="tout-voir" aria-label="Tout voir">' + (ag.toutVoir ? "▴" : "▾") + "</button>" : "") + '</div><div class="ag-journee-zone" style="--l:' + Math.max(1, maxL + (lignes.length > maxL ? 1 : 0)) + '">';
    for (var j = 0; j < n; j++) h += '<button class="ag-case-jour" data-ag-creer-jour="' + iso(plus(p.debut, j)) + '" style="grid-column:' + (j + 1) + ';grid-row:1 / -1" aria-label="Créer ce jour-là"></button>';
    lignes.slice(0, maxL).forEach(function (l, li) { l.forEach(function (o) { h += '<div class="ag-barre-j" style="grid-column:' + (o.a + 1) + " / " + (o.b + 2) + ";grid-row:" + (li + 1) + '">' + puce(o.x, false) + "</div>"; }); });
    if (lignes.length > maxL) for (var jj = 0; jj < n; jj++) { var cache = lignes.slice(maxL).reduce(function (s, l) { return s + l.filter(function (o) { return o.a <= jj && o.b >= jj; }).length; }, 0); if (cache) h += '<button class="ag-encore" data-ag="tout-voir" style="grid-column:' + (jj + 1) + ";grid-row:" + (maxL + 1) + '">+' + cache + "</button>"; }
    h += "</div></div>";
    h += '<div class="ag-grille-defile"><div class="ag-heures">';
    for (var hh = 0; hh < 24; hh++) h += "<span>" + (hh ? z(hh) + ":00" : "") + "</span>";
    h += '</div><div class="ag-colonnes">';
    for (var c = 0; c < n; c++) {
      var jour = plus(p.debut, c), lendemain = plus(jour, 1);
      h += '<div class="ag-col' + (memeJour(jour, auj) ? " auj" : "") + '" data-ag-col="' + iso(jour) + '">';
      var duJour = courts.filter(function (x) { return x.d0 < lendemain && x.d1 > jour; }).map(function (x) {
        var a = Math.max(0, (Math.max(x.d0, jour) - jour) / 60000), b = Math.min(1440, (Math.min(x.d1, lendemain) - jour) / 60000);
        return { x: x, a: a, b: Math.max(b, a + 20) };
      }).sort(function (u, v) { return u.a - v.a || v.b - u.b; });
      // Chevauchements : des colonnes côte à côte dans chaque paquet d'événements qui se touchent.
      var paquet = [], finPaquet = -1;
      function poser() {
        var cols = [];
        paquet.forEach(function (o) { for (var k = 0; ; k++) { if (!cols[k] || cols[k] <= o.a) { cols[k] = o.b; o.col = k; break; } } });
        paquet.forEach(function (o) { o.n = cols.length; });
        paquet = [];
      }
      duJour.forEach(function (o) { if (o.a >= finPaquet && paquet.length) poser(); paquet.push(o); finPaquet = Math.max(finPaquet, o.b); });
      if (paquet.length) poser();
      duJour.forEach(function (o) {
        var x = o.x, court = o.b - o.a < 45;
        h += '<button class="ag-ev' + (x.refuse ? " refuse" : "") + (x.attente ? " attente" : "") + (court ? " court" : "") + '" data-ag-ev="' + texte(x.k) + '" style="top:' + (o.a / 60 * HEURE) + "px;height:" + Math.max(18, (o.b - o.a) / 60 * HEURE - 2) + "px;left:calc(" + (o.col / o.n * 100) + "% + 1px);width:calc(" + (100 / o.n) + "% - 3px);--c:" + x.couleur + ";--t:" + (sombre(x.couleur) ? "#fff" : "#1a1a1a") + '"' + (x.modifiable ? ' data-ag-glisse="1"' : "") + ">";
        h += "<strong>" + texte(x.titre) + "</strong>" + (court ? " <span>" + hm(x.d0) + "</span>" : "<span>" + hm(x.d0) + " – " + hm(x.d1) + (x.ev && x.ev.lieu ? ", " + texte(x.ev.lieu) : "") + "</span>") + "</button>";
      });
      if (memeJour(jour, auj)) h += '<div class="ag-maintenant" style="top:' + ((auj.getHours() * 60 + auj.getMinutes()) / 60 * HEURE) + 'px"></div>';
      h += "</div>";
    }
    return h + "</div></div></div>";
  }
  function dessinerMois(p, tous) {
    var d = dateDe(ag.date), auj = new Date(), h = '<div class="ag-mois"><div class="ag-mois-tete">';
    JOURS_C.forEach(function (j) { h += "<span>" + j + "</span>"; });
    h += '</div><div class="ag-mois-corps">';
    for (var s = 0; s < 6; s++) {
      var debut = plus(p.debut, s * 7), fin = plus(debut, 7);
      var semaine = tous.filter(function (x) { return x.d0 < fin && x.d1 > debut; });
      var lignes = ranger(semaine, debut, 7), max = etroit() ? 2 : 3;
      h += '<div class="ag-sem-l" style="--l:' + max + '">';
      for (var j = 0; j < 7; j++) {
        var x = plus(debut, j);
        h += '<button class="ag-mois-case' + (x.getMonth() !== d.getMonth() ? " hors" : "") + '" data-ag-creer-jour="' + iso(x) + '" style="grid-column:' + (j + 1) + '" aria-label="' + texte(jourLong(x)) + '"></button>';
        h += '<button class="ag-mois-num' + (memeJour(x, auj) ? " auj" : "") + '" data-ag-jour="' + iso(x) + '" style="grid-column:' + (j + 1) + '">' + (x.getDate() === 1 ? x.getDate() + " " + MOIS_C[x.getMonth()] : x.getDate()) + "</button>";
      }
      lignes.slice(0, max).forEach(function (l, li) { l.forEach(function (o) { h += '<div class="ag-barre-j" style="grid-column:' + (o.a + 1) + " / " + (o.b + 2) + ";grid-row:" + (li + 2) + '">' + puce(o.x, true) + "</div>"; }); });
      if (lignes.length > max) for (var jj = 0; jj < 7; jj++) {
        var cache = lignes.slice(max).reduce(function (t, l) { return t + l.filter(function (o) { return o.a <= jj && o.b >= jj; }).length; }, 0);
        if (cache) h += '<button class="ag-encore" data-ag-jour="' + iso(plus(debut, jj)) + '" style="grid-column:' + (jj + 1) + ";grid-row:" + (max + 2) + '">' + cache + " de plus</button>";
      }
      h += "</div>";
    }
    return h + "</div></div>";
  }
  function ligneListe(x) {
    var quand = x.journee ? (x.d1 - x.d0 > 864e5 ? "Jusqu'au " + plus(x.d1, -1).getDate() + " " + MOIS[plus(x.d1, -1).getMonth()] : "Toute la journée") : hm(x.d0) + " – " + hm(x.d1);
    var k0 = x.src === "g" ? cal(x.compte.id, x.cal) : null, ou = x.src === "p" ? "Prospection" : (k0 ? k0.nom : "");
    return '<button class="ag-ligne-l' + (x.refuse ? " refuse" : "") + (x.fait ? " fait" : "") + '" data-ag-ev="' + texte(x.k) + '"><span class="ag-quand">' + texte(quand) + '</span><span class="ag-pt" style="background:' + x.couleur + '"></span><span class="ag-quoi"><strong>' + texte(x.titre) + "</strong>" + (x.ev && x.ev.lieu ? "<em>" + texte(x.ev.lieu) + "</em>" : "") + (x.p && x.p.detail ? "<em>" + texte(x.p.detail) + "</em>" : "") + '</span><span class="ag-ou">' + (comptes().length > 1 ? texte(x.compte.nom) + " · " : "") + texte(ou) + "</span></button>";
  }
  function dessinerPlanning(p, tous) {
    var h = '<div class="ag-liste">', auj = new Date(), vide = true;
    for (var i = 0; i < p.jours; i++) {
      var j = plus(p.debut, i), l = plus(j, 1);
      var duJour = tous.filter(function (x) { return x.d0 < l && x.d1 > j && (x.journee ? true : x.d0 >= j || i === 0); });
      if (!duJour.length) continue;
      vide = false;
      h += '<div class="ag-jour-l' + (memeJour(j, auj) ? " auj" : "") + '"><button class="ag-date-l" data-ag-jour="' + iso(j) + '"><strong>' + j.getDate() + "</strong><span>" + JOURS_C[(j.getDay() + 6) % 7] + " " + MOIS_C[j.getMonth()] + '</span></button><div class="ag-evs-l">' + duJour.map(ligneListe).join("") + "</div></div>";
    }
    if (vide) h += '<p class="ag-vide">Rien de prévu pendant ces deux mois.</p>';
    return h + '<div class="ag-plus-l"><button class="ag-b" data-ag="suiv">Plus tard</button></div></div>';
  }
  function dessinerRecherche() {
    var r = ag.recherche, h = '<div class="ag-liste"><div class="ag-rech-tete"><span>' + (r.attente ? "Recherche de « " + texte(r.q) + " »…" : r.l.length + " résultat" + (r.l.length > 1 ? "s" : "") + " pour « " + texte(r.q) + " »") + '</span><button class="ag-b" data-ag="fin-recherche">Fermer la recherche</button></div>';
    var jour = "";
    r.l.forEach(function (x) {
      var j = iso(x.d0);
      if (j !== jour) { if (jour) h += "</div></div>"; jour = j; h += '<div class="ag-jour-l"><button class="ag-date-l" data-ag-jour="' + j + '"><strong>' + x.d0.getDate() + "</strong><span>" + JOURS_C[(x.d0.getDay() + 6) % 7] + " " + MOIS_C[x.d0.getMonth()] + " " + x.d0.getFullYear() + '</span></button><div class="ag-evs-l">'; }
      h += ligneListe(x);
    });
    if (jour) h += "</div></div>";
    return h + "</div>";
  }
  function chercher(q) {
    q = String(q || "").trim();
    if (q.length < 2) { ag.recherche = null; dessiner(); return; }
    var mots = q.toLowerCase().split(/\s+/);
    function trouve(t) { t = t.toLowerCase(); return mots.every(function (m) { return t.indexOf(m) >= 0; }); }
    var locaux = elements(null).filter(function (x) { return x.src === "p" && trouve([x.titre, x.p.detail, x.p.spectacle, x.p.statut].join(" ")); });
    var r = ag.recherche = { q: q, l: locaux.slice(), attente: true }, restants = 0;
    comptes().forEach(function (c) {
      if (!c.relie || !calsCoches(c.id).length) return;
      restants++;
      P.appel(c.id, "agenda.chercher", { q: q, calendriers: calsCoches(c.id) }, { sans: true }).then(function (res) {
        (res.evenements || []).forEach(function (e) {
          var k0 = cal(c.id, e.cal), d0 = e.journee ? dateDe(e.debut) : new Date(e.debut), d1 = e.journee ? dateDe(e.fin) : new Date(e.fin);
          var coul = e.couleur && COULEURS_EV[e.couleur] ? COULEURS_EV[e.couleur][1] : couleurSure(k0 && k0.couleur), k = c.id + "|" + e.cal + "|" + e.id;
          var x = { k: k, compte: c, src: "g", cal: e.cal, titre: e.titre || "(Sans titre)", d0: d0, d1: d1, journee: e.journee, couleur: coul, ev: e, modifiable: !!(k0 && (k0.acces === "owner" || k0.acces === "writer")) };
          r.l.push(x); parCle[k] = x;
        });
      }, function () {}).then(function () { if (--restants <= 0) r.attente = false; r.l.sort(function (a, b) { return a.d0 - b.d0; }); if (ag.recherche === r) dessiner(); });
    });
    if (!restants) r.attente = false;
    r.l.sort(function (a, b) { return a.d0 - b.d0; });
    locaux.forEach(function (x) { parCle[x.k] = x; });
    dessiner();
  }

  // ---------- Feuilles (détails, formulaire, questions) ----------
  function feuille(h, large) {
    var v = racine.querySelector(".ag-voile");
    v.innerHTML = '<div class="ag-feuille' + (large ? " large" : "") + '" role="dialog" aria-modal="true">' + h + "</div>";
    v.hidden = false;
    var f = v.querySelector("input:not([type=checkbox]):not([type=radio]), textarea, button.fort, button"); if (f && !etroit()) { try { f.focus(); } catch (e) {} }
  }
  function fermer() { var v = racine.querySelector(".ag-voile"); v.hidden = true; v.innerHTML = ""; ag.form = null; ag.question = null; }
  function avis(t, souci) { if (P) P.avis(t, souci); }
  function nomCompteSiPlusieurs(c) { return comptes().length > 1 ? texte(c.nom) + " · " : ""; }
  function quandTexte(x) {
    if (x.journee) { var f = plus(x.d1, -1); return memeJour(x.d0, f) ? jourLong(x.d0) : jourLong(x.d0) + " – " + jourLong(f); }
    return memeJour(x.d0, x.d1) || x.d1 - x.d0 <= 864e5 && memeJour(x.d0, new Date(x.d1 - 1)) ? jourLong(x.d0) + " · " + hm(x.d0) + " – " + hm(x.d1) : jourLong(x.d0) + " " + hm(x.d0) + " – " + jourLong(x.d1) + " " + hm(x.d1);
  }
  var REPONSES = { accepted: "Oui", declined: "Non", tentative: "Peut-être", needsAction: "Pas encore répondu" };
  function details(k) {
    var x = parCle[k]; if (!x) return;
    var h = '<div class="ag-det-tete"><span class="ag-carre" style="background:' + x.couleur + '"></span><h2>' + texte(x.titre) + "</h2>";
    if (x.src === "g" && x.modifiable) h += '<button class="ag-icone" data-ag-modifier="' + texte(k) + '" title="Modifier" aria-label="Modifier">✎</button><button class="ag-icone" data-ag-supprimer="' + texte(k) + '" title="Supprimer" aria-label="Supprimer">🗑</button>';
    h += '<button class="ag-icone" data-ag="fermer" aria-label="Fermer">✕</button></div>';
    h += '<p class="ag-det-quand">' + texte(quandTexte(x)) + (x.ev && x.ev.serie ? " · <span>se répète</span>" : "") + "</p>";
    if (x.src === "p") {
      var t = PROSPECTION.filter(function (y) { return "p:" + y.id === x.cal; })[0];
      h += '<p class="ag-det-l">' + nomCompteSiPlusieurs(x.compte) + "Prospection · " + texte(t ? t.nom : "") + "</p>";
      if (x.p.spectacle) h += '<p class="ag-det-l">Spectacle : ' + texte(x.p.spectacle) + "</p>";
      if (x.p.statut) h += '<p class="ag-det-l">' + (x.p.type === "relances" ? "Étape" : "Statut") + " : " + texte(x.p.statut) + "</p>";
      if (x.p.detail) h += '<p class="ag-det-l">' + texte(x.p.detail) + "</p>";
      if (x.p.email) h += '<p class="ag-det-l">' + texte(x.p.email) + "</p>";
      h += '<div class="ag-actions">';
      if (lienSur(x.p.lien)) h += '<a class="ag-b" href="' + texte(x.p.lien) + '" target="_blank" rel="noopener">Ouvrir l\'appel</a>';
      if (x.compte.id === "compagnie") h += '<button class="ag-b" data-ag-diffusion="' + (x.p.type === "campagnes" ? "boite" : "1") + '">' + (x.p.type === "campagnes" ? "Voir dans la Boîte mail" : "Ouvrir dans Diffusion") + "</button>";
      if (ecrivables().length) h += '<button class="ag-b" data-ag-copier="' + texte(k) + '">Ajouter à mon agenda Google</button>';
      h += "</div><p class=\"ag-mini-note\">Ces dates viennent de " + (x.p.type === "campagnes" ? "la Boîte mail" : "Diffusion") + " : on les change là-bas.</p>";
    } else {
      var e = x.ev, k0 = cal(x.compte.id, x.cal);
      if (e.lieu) h += '<p class="ag-det-l">📍 <a href="https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(e.lieu) + '" target="_blank" rel="noopener">' + texte(e.lieu) + "</a></p>";
      if (lienSur(e.visio)) h += '<p class="ag-det-l">🎥 <a href="' + texte(e.visio) + '" target="_blank" rel="noopener">Rejoindre la visio</a></p>';
      if (e.invites && e.invites.length) {
        var oui = e.invites.filter(function (i) { return i.reponse === "accepted"; }).length;
        h += '<p class="ag-det-l">👥 ' + e.invites.length + " invité" + (e.invites.length > 1 ? "s" : "") + " · " + oui + " oui</p><ul class=\"ag-invites\">";
        e.invites.forEach(function (i) { h += "<li><span>" + texte(i.nom || i.email) + (i.organisateur ? " <em>organisateur</em>" : "") + (i.moi ? " <em>toi</em>" : "") + '</span><span class="ag-rep ' + texte(i.reponse) + '">' + (REPONSES[i.reponse] || "") + "</span></li>"; });
        h += "</ul>";
      }
      if (e.notes) h += '<div class="ag-det-notes">' + lierLiens(notesTexte(e.notes)) + "</div>";
      if (e.pieces && e.pieces.length) h += '<p class="ag-det-l">📎 ' + e.pieces.map(function (pj) { return lienSur(pj.lien) ? '<a href="' + texte(pj.lien) + '" target="_blank" rel="noopener">' + texte(pj.titre) + "</a>" : texte(pj.titre); }).join(", ") + "</p>";
      if (e.rappels && !e.rappels.defaut && e.rappels.liste.length) h += '<p class="ag-det-l">🔔 ' + e.rappels.liste.map(function (r) { return dureeTexte(r.minutes) + " avant" + (r.methode === "email" ? " (e-mail)" : ""); }).join(", ") + "</p>";
      h += '<p class="ag-det-l">🗓 ' + nomCompteSiPlusieurs(x.compte) + texte(k0 ? k0.nom : x.cal) + (e.organisateur && !e.organisateur.moi && e.organisateur.email ? " · organisé par " + texte(e.organisateur.nom || e.organisateur.email) : "") + (e.dispo === "libre" ? " · disponible" : "") + (e.visibilite === "private" ? " · privé" : "") + "</p>";
      if (e.moi && (!e.organisateur || !e.organisateur.moi)) {
        h += '<div class="ag-rsvp"><span>Participer ?</span>';
        [["accepted", "Oui"], ["declined", "Non"], ["tentative", "Peut-être"]].forEach(function (o) { h += '<button class="ag-b' + (e.moi === o[0] ? " ag-fort" : "") + '" data-ag-repondre="' + o[0] + '" data-ag-cle="' + texte(k) + '">' + o[1] + "</button>"; });
        h += '<label class="ag-case"><input type="checkbox" id="agPrevenirOrg"> Prévenir l\'organisateur par e-mail</label></div>';
      }
      h += '<div class="ag-actions">';
      if (lienSur(e.lien)) h += '<a class="ag-b" href="' + texte(e.lien) + '" target="_blank" rel="noopener">Ouvrir dans Google Agenda</a>';
      if (ecrivables().length) h += '<button class="ag-b" data-ag-dupliquer="' + texte(k) + '">Dupliquer</button>';
      if (x.modifiable) h += '<button class="ag-b ag-fort" data-ag-modifier="' + texte(k) + '">Modifier</button>';
      h += "</div>";
      if (!x.modifiable) h += '<p class="ag-mini-note">Cet agenda est partagé en lecture seule : il se change chez la personne qui le partage.</p>';
    }
    feuille(h);
  }
  function dureeTexte(min) {
    if (min % 10080 === 0 && min) return (min / 10080) + " semaine" + (min / 10080 > 1 ? "s" : "");
    if (min % 1440 === 0 && min) return (min / 1440) + " jour" + (min / 1440 > 1 ? "s" : "");
    if (min % 60 === 0 && min) return (min / 60) + " h";
    return min + " min";
  }

  // ---------- Répétition ----------
  function rangDansMois(d) { return Math.ceil(d.getDate() / 7); }
  function presets(d) {
    var j = BYDAY[(d.getDay() + 6) % 7], r = rangDansMois(d), dernier = plus(d, 7).getMonth() !== d.getMonth();
    var l = [["", "Une seule fois"], ["RRULE:FREQ=DAILY", "Tous les jours"], ["RRULE:FREQ=WEEKLY;BYDAY=" + j, "Toutes les semaines le " + JOURS[(d.getDay() + 6) % 7]],
      ["RRULE:FREQ=MONTHLY;BYDAY=" + r + j, "Tous les mois le " + ["premier", "deuxième", "troisième", "quatrième", "cinquième"][r - 1] + " " + JOURS[(d.getDay() + 6) % 7]]];
    if (dernier) l.push(["RRULE:FREQ=MONTHLY;BYDAY=-1" + j, "Tous les mois le dernier " + JOURS[(d.getDay() + 6) % 7]]);
    l.push(["RRULE:FREQ=MONTHLY;BYMONTHDAY=" + d.getDate(), "Tous les mois le " + d.getDate()], ["RRULE:FREQ=YEARLY", "Tous les ans le " + d.getDate() + " " + MOIS[d.getMonth()]], ["RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR", "Tous les jours de la semaine (du lundi au vendredi)"], ["perso", "Personnaliser…"]);
    return l;
  }
  function lireRegle(r) {
    var o = { freq: "WEEKLY", int: 1, jours: [], fin: "jamais", until: "", count: 10 };
    String(r || "").replace(/^RRULE:/, "").split(";").forEach(function (p) {
      var kv = p.split("="); if (kv.length !== 2) return;
      if (kv[0] === "FREQ") o.freq = kv[1]; if (kv[0] === "INTERVAL") o.int = Number(kv[1]) || 1; if (kv[0] === "BYDAY") o.jours = kv[1].split(",");
      if (kv[0] === "COUNT") { o.fin = "count"; o.count = Number(kv[1]) || 1; }
      if (kv[0] === "UNTIL") { o.fin = "until"; o.until = kv[1].slice(0, 4) + "-" + kv[1].slice(4, 6) + "-" + kv[1].slice(6, 8); }
    });
    return o;
  }
  function regleTexte(r) {
    var o = lireRegle(r), unite = { DAILY: ["jour", "jours"], WEEKLY: ["semaine", "semaines"], MONTHLY: ["mois", "mois"], YEARLY: ["an", "ans"] }[o.freq] || ["", ""];
    var t = o.int > 1 ? "Tous les " + o.int + " " + unite[1] : { DAILY: "Tous les jours", WEEKLY: "Toutes les semaines", MONTHLY: "Tous les mois", YEARLY: "Tous les ans" }[o.freq] || "Se répète";
    if (o.freq === "WEEKLY" && o.jours.length) t += " le " + o.jours.map(function (j) { return JOURS[BYDAY.indexOf(j)] || j; }).join(", ");
    if (o.fin === "count") t += ", " + o.count + " fois"; if (o.fin === "until") t += ", jusqu'au " + dateDe(o.until).toLocaleDateString("fr-CH");
    return t;
  }
  function construireRegle() {
    var f = function (id) { var e = document.getElementById(id); return e ? e.value : ""; };
    var freq = f("agRFreq") || "WEEKLY", n = Math.max(1, Math.min(99, Number(f("agRInt")) || 1)), r = "RRULE:FREQ=" + freq;
    if (n > 1) r += ";INTERVAL=" + n;
    if (freq === "WEEKLY") { var j = [].slice.call(racine.querySelectorAll("[data-ag-rjour]:checked")).map(function (c) { return c.value; }); if (j.length) r += ";BYDAY=" + j.join(","); }
    var fin = (racine.querySelector("[name=agRFin]:checked") || {}).value;
    if (fin === "until" && /^\d{4}-\d{2}-\d{2}$/.test(f("agRUntil"))) r += ";UNTIL=" + f("agRUntil").replace(/-/g, "") + "T235959Z";
    if (fin === "count") r += ";COUNT=" + Math.max(1, Math.min(999, Number(f("agRCount")) || 1));
    return r;
  }

  // ---------- Formulaire ----------
  // x : élément existant (modifier), ou modèle { debut, fin, journee, titre… } pour créer.
  function formulaire(x, modele) {
    var e = x ? x.ev : null, m = modele || {};
    var d0 = x ? x.d0 : m.d0 || arrondi(new Date()), d1 = x ? x.d1 : m.d1 || new Date(d0.getTime() + 3600000), journee = x ? x.journee : !!m.journee;
    if (journee) d1 = plus(d1, -1);   // dans le formulaire, la fin d'une journée entière est le dernier jour compris
    var choix = ecrivables();
    if (!choix.length) { feuille('<h2>Créer un événement</h2><p>' + (comptes().some(function (c) { return c.relie; }) ? "Les agendas ne sont pas encore chargés, ou aucun ne peut être modifié." : "Relie d'abord un compte à son moteur Origami.") + '</p><div class="ag-actions"><button class="ag-b" data-ag="fermer">Fermer</button></div>'); return; }
    var calChoisi = x ? cleCal(x.compte.id, x.cal) : (m.cal || (choix.some(function (o) { return cleCal(o.compte.id, o.cal.id) === reg.dernierCal; }) ? reg.dernierCal : cleCal(choix[0].compte.id, (choix.filter(function (o) { return o.cal.principal; })[0] || choix[0]).cal.id)));
    ag.form = { x: x, regle: e && e.recurrence ? e.recurrence.filter(function (r) { return /^RRULE:/.test(r); })[0] || "" : (m.regle || ""), autres: e && e.recurrence ? e.recurrence.filter(function (r) { return !/^RRULE:/.test(r); }) : [], invites: e ? e.invites.map(function (i) { return { email: i.email, nom: i.nom, reponse: i.reponse, organisateur: i.organisateur, moi: i.moi }; }) : [], rappels: e && e.rappels ? JSON.parse(JSON.stringify(e.rappels)) : { defaut: true, liste: [] } };
    var h = '<div class="ag-det-tete"><h2>' + (x ? "Modifier l'événement" : "Nouvel événement") + '</h2><button class="ag-icone" data-ag="fermer" aria-label="Fermer">✕</button></div>';
    if (!x) h += '<details class="ag-rapide"><summary>Écrire en une phrase (Google comprend « Répétition jeudi 14h à la salle »)</summary><div class="ag-ligne-f"><input id="agRapide" placeholder="Café avec Anne vendredi 10h"><button class="ag-b" data-ag="rapide">Ajouter</button></div></details>';
    h += '<input id="agTitre" class="ag-gros" placeholder="Ajouter un titre" value="' + texte(x ? (x.ev.titre || "") : (m.titre || "")) + '" maxlength="1000">';
    h += '<label class="ag-case"><input type="checkbox" id="agJournee"' + (journee ? " checked" : "") + "> Toute la journée</label>";
    h += '<div class="ag-ligne-f ag-dates"><label>Début<input type="date" id="agD0" value="' + iso(d0) + '"></label><label class="ag-h"' + (journee ? " hidden" : "") + '>&nbsp;<input type="time" id="agH0" step="900" value="' + hm(d0) + '"></label><label>Fin<input type="date" id="agD1" value="' + iso(d1) + '"></label><label class="ag-h"' + (journee ? " hidden" : "") + '>&nbsp;<input type="time" id="agH1" step="900" value="' + hm(d1) + '"></label></div>';
    var pr = presets(d0), reg0 = ag.form.regle, sel = reg0 ? (pr.some(function (o) { return o[0] === reg0; }) ? reg0 : "perso") : "";
    h += '<label class="ag-champ">Répétition<select id="agRegle">' + pr.map(function (o) { return '<option value="' + texte(o[0]) + '"' + (o[0] === sel ? " selected" : "") + ">" + texte(o[1]) + "</option>"; }).join("") + "</select></label>";
    h += '<div id="agPerso"' + (sel === "perso" ? "" : " hidden") + ">" + persoHtml(reg0 && sel === "perso" ? reg0 : "RRULE:FREQ=WEEKLY;BYDAY=" + BYDAY[(d0.getDay() + 6) % 7], d0) + "</div>";
    if (x && x.ev.serie && !reg0) h += '<p class="ag-mini-note">Cet événement fait partie d\'une série.</p>';
    h += '<label class="ag-champ">Agenda<select id="agCal"' + (x ? ' data-depart="' + texte(calChoisi) + '"' : "") + ">";
    var parCompte = {}; choix.forEach(function (o) { (parCompte[o.compte.id] = parCompte[o.compte.id] || { c: o.compte, l: [] }).l.push(o.cal); });
    Object.keys(parCompte).forEach(function (cid) {
      if (x && cid !== x.compte.id) return;   // un événement ne change pas de compte Google
      var g = parCompte[cid]; h += comptes().length > 1 ? '<optgroup label="' + texte(g.c.nom) + '">' : "";
      g.l.forEach(function (k) { var v = cleCal(cid, k.id); h += '<option value="' + texte(v) + '"' + (v === calChoisi ? " selected" : "") + ">" + texte(k.nom) + "</option>"; });
      h += comptes().length > 1 ? "</optgroup>" : "";
    });
    h += "</select></label>";
    var coul = x ? x.ev.couleur : (m.couleur || "");
    h += '<div class="ag-champ"><span>Couleur</span><div class="ag-couleurs" role="radiogroup"><button class="ag-coul-cal" data-ag-coul="" aria-pressed="' + (!coul) + '" title="Couleur de l\'agenda">Agenda</button>';
    Object.keys(COULEURS_EV).forEach(function (n) { h += '<button data-ag-coul="' + n + '" aria-pressed="' + (coul === n) + '" title="' + COULEURS_EV[n][0] + '" aria-label="' + COULEURS_EV[n][0] + '" style="background:' + COULEURS_EV[n][1] + '"></button>'; });
    h += "</div></div>";
    h += '<label class="ag-champ">Lieu<input id="agLieu" value="' + texte(x ? x.ev.lieu : (m.lieu || "")) + '" maxlength="1000"></label>';
    if (!(x && x.ev.visio)) h += '<label class="ag-case"><input type="checkbox" id="agVisio"> Ajouter une visio Google Meet</label>';
    else h += '<p class="ag-mini-note">Visio : <a href="' + texte(lienSur(x.ev.visio)) + '" target="_blank" rel="noopener">' + texte(x.ev.visio) + "</a></p>";
    h += '<div class="ag-champ"><span>Invités</span><div id="agInvites">' + invitesHtml() + '</div><div class="ag-ligne-f"><input id="agInvite" type="email" placeholder="Adresse e-mail" autocomplete="email"><button class="ag-b" data-ag="inviter">Ajouter</button></div>';
    h += '<label class="ag-case"><input type="checkbox" id="agEnvoyer"> Envoyer les invitations et les changements par e-mail<small>Sans cette case, Google n\'écrit à personne : l\'événement apparaît seulement dans les agendas.</small></label>';
    h += '<details class="ag-plus-opt"><summary>Droits des invités</summary><label class="ag-case"><input type="checkbox" id="agGMod"' + (e && e.invitesModifient ? " checked" : "") + '> Modifier l\'événement</label><label class="ag-case"><input type="checkbox" id="agGInv"' + (!e || e.invitesInvitent ? " checked" : "") + '> Inviter d\'autres personnes</label><label class="ag-case"><input type="checkbox" id="agGVoir"' + (!e || e.invitesVoient ? " checked" : "") + "> Voir la liste des invités</label></details></div>";
    h += '<div class="ag-champ"><span>Rappels</span><div id="agRappels">' + rappelsHtml() + "</div></div>";
    h += '<div class="ag-ligne-f"><label class="ag-champ">Disponibilité<select id="agDispo"><option value="occupe">Occupée</option><option value="libre"' + (e && e.dispo === "libre" ? " selected" : "") + '>Disponible</option></select></label><label class="ag-champ">Visibilité<select id="agVisi"><option value="default">Par défaut</option><option value="public"' + (e && e.visibilite === "public" ? " selected" : "") + '>Publique</option><option value="private"' + (e && e.visibilite === "private" ? " selected" : "") + ">Privée</option></select></label></div>";
    h += '<label class="ag-champ">Description<textarea id="agNotes" rows="4">' + texte(x ? notesTexte(x.ev.notes) : (m.notes || "")) + "</textarea></label>";
    h += '<p id="agSouci" class="ag-souci" role="status"></p><div class="ag-actions"><button class="ag-b" data-ag="fermer">Annuler</button><button class="ag-b ag-fort" data-ag="enregistrer">Enregistrer</button></div>';
    feuille(h, true);
    var t = document.getElementById("agTitre"); if (t && !etroit()) t.focus();
  }
  function arrondi(d) { var x = new Date(d.getTime()); x.setMinutes(x.getMinutes() < 30 ? 30 : 60, 0, 0); return x; }
  function persoHtml(regle, d0) {
    var o = lireRegle(regle), h = '<div class="ag-ligne-f"><label>Tous les<input id="agRInt" type="number" min="1" max="99" value="' + o.int + '"></label><label>&nbsp;<select id="agRFreq">';
    [["DAILY", "jours"], ["WEEKLY", "semaines"], ["MONTHLY", "mois"], ["YEARLY", "ans"]].forEach(function (f) { h += '<option value="' + f[0] + '"' + (o.freq === f[0] ? " selected" : "") + ">" + f[1] + "</option>"; });
    h += '</select></label></div><div class="ag-rjours" id="agRJours"' + (o.freq === "WEEKLY" ? "" : " hidden") + ">";
    BYDAY.forEach(function (j, i) { h += '<label><input type="checkbox" data-ag-rjour value="' + j + '"' + (o.jours.indexOf(j) >= 0 ? " checked" : "") + "><span>" + JOURS_C[i].slice(0, 1).toUpperCase() + "</span></label>"; });
    h += '</div><div class="ag-rfin"><span>Se termine</span><label><input type="radio" name="agRFin" value="jamais"' + (o.fin === "jamais" ? " checked" : "") + '> Jamais</label><label><input type="radio" name="agRFin" value="until"' + (o.fin === "until" ? " checked" : "") + '> Le <input type="date" id="agRUntil" value="' + (o.until || iso(plus(d0, 90))) + '"></label><label><input type="radio" name="agRFin" value="count"' + (o.fin === "count" ? " checked" : "") + '> Après <input type="number" id="agRCount" min="1" max="999" value="' + o.count + '"> fois</label></div>';
    return h;
  }
  function invitesHtml() {
    var f = ag.form; if (!f || !f.invites.length) return "";
    return '<ul class="ag-invites">' + f.invites.map(function (i, n) { return "<li><span>" + texte(i.nom || i.email) + (i.organisateur ? " <em>organisateur</em>" : "") + '</span><span class="ag-rep ' + texte(i.reponse || "") + '">' + (REPONSES[i.reponse] || "") + "</span>" + (i.organisateur || i.moi ? "" : '<button class="ag-icone" data-ag-retirer-inv="' + n + '" aria-label="Retirer">✕</button>') + "</li>"; }).join("") + "</ul>";
  }
  function rappelsHtml() {
    var f = ag.form, h = '<label class="ag-case"><input type="checkbox" id="agRDefaut"' + (f.rappels.defaut ? " checked" : "") + "> Rappels habituels de l'agenda</label>";
    if (!f.rappels.defaut) {
      f.rappels.liste.forEach(function (r, i) {
        var u = r.minutes % 10080 === 0 && r.minutes ? 10080 : r.minutes % 1440 === 0 && r.minutes ? 1440 : r.minutes % 60 === 0 && r.minutes ? 60 : 1;
        h += '<div class="ag-ligne-f ag-rappel"><select data-ag-rm="' + i + '"><option value="popup">Notification</option><option value="email"' + (r.methode === "email" ? " selected" : "") + '>E-mail</option></select><input type="number" min="0" max="999" data-ag-rn="' + i + '" value="' + (r.minutes / u) + '"><select data-ag-ru="' + i + '">' + [[1, "minutes"], [60, "heures"], [1440, "jours"], [10080, "semaines"]].map(function (o) { return '<option value="' + o[0] + '"' + (o[0] === u ? " selected" : "") + ">" + o[1] + "</option>"; }).join("") + '</select><span>avant</span><button class="ag-icone" data-ag-retirer-rap="' + i + '" aria-label="Retirer">✕</button></div>';
      });
      if (f.rappels.liste.length < 5) h += '<button class="ag-petit" data-ag="rappel">＋ Ajouter un rappel</button>';
    }
    return h;
  }
  function lireRappels() {
    var f = ag.form; if (!f) return;
    var c = document.getElementById("agRDefaut"); if (c) f.rappels.defaut = c.checked;
    f.rappels.liste.forEach(function (r, i) {
      var m = racine.querySelector('[data-ag-rm="' + i + '"]'), n = racine.querySelector('[data-ag-rn="' + i + '"]'), u = racine.querySelector('[data-ag-ru="' + i + '"]');
      if (m) r.methode = m.value; if (n && u) r.minutes = Math.max(0, Math.round(Number(n.value) || 0)) * Number(u.value);
    });
  }
  function valeursFormulaire() {
    var g = function (id) { var e = document.getElementById(id); return e ? e.value : ""; };
    var journee = document.getElementById("agJournee").checked, a = {};
    a.titre = g("agTitre").trim();
    var d0 = g("agD0"), d1 = g("agD1") || d0;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d0)) throw new Error("Choisis la date de début.");
    a.journee = journee;
    if (journee) { if (d1 < d0) throw new Error("La fin est avant le début."); a.debut = d0; a.fin = iso(plus(dateDe(d1), 1)); }
    else {
      var x0 = new Date(d0 + "T" + (g("agH0") || "09:00")), x1 = new Date(d1 + "T" + (g("agH1") || "10:00"));
      if (isNaN(x0) || isNaN(x1)) throw new Error("Heure incomplète.");
      if (x1 < x0) throw new Error("La fin est avant le début.");
      a.debut = x0.toISOString(); a.fin = x1.toISOString(); a.fuseau = fuseau();
    }
    var r = g("agRegle"); r = r === "perso" ? construireRegle() : r;
    a.recurrence = r ? [r].concat(ag.form.autres || []) : [];
    var c = racine.querySelector("[data-ag-coul][aria-pressed=true]"); a.couleur = c ? c.dataset.agCoul : "";
    a.lieu = g("agLieu").trim(); a.notes = g("agNotes");
    var v = document.getElementById("agVisio"); if (v && v.checked) a.visio = "ajouter";
    a.invites = ag.form.invites.map(function (i) { return { email: i.email, reponse: i.reponse }; });
    a.envoyer = document.getElementById("agEnvoyer").checked;
    a.invitesModifient = document.getElementById("agGMod").checked; a.invitesInvitent = document.getElementById("agGInv").checked; a.invitesVoient = document.getElementById("agGVoir").checked;
    lireRappels(); a.rappels = ag.form.rappels;
    a.dispo = g("agDispo"); a.visibilite = g("agVisi");
    var cc = g("agCal"), i = cc.indexOf("|"); a.compte = cc.slice(0, i); a.cal = cc.slice(i + 1);
    return a;
  }
  // Ne renvoyer que ce qui a changé (un événement partagé garde ce qu'on n'a pas touché).
  function changements(x, a) {
    var e = x.ev, c = {}, notesAvant = notesTexte(e.notes);
    if (a.titre !== (e.titre || "")) c.titre = a.titre;
    var dAvant = x.journee ? e.debut : new Date(e.debut).toISOString(), fAvant = x.journee ? e.fin : new Date(e.fin).toISOString();
    if (a.journee !== x.journee || a.debut !== dAvant || a.fin !== fAvant) { c.debut = a.debut; c.fin = a.fin; c.journee = a.journee; c.fuseau = a.fuseau; }
    if ((a.couleur || "") !== (e.couleur || "")) c.couleur = a.couleur;
    if (a.lieu !== (e.lieu || "")) c.lieu = a.lieu;
    if (a.notes.trim() !== notesAvant.trim()) c.notes = a.notes;
    if (a.visio) c.visio = a.visio;
    if (JSON.stringify(a.invites.map(function (i) { return i.email; })) !== JSON.stringify(e.invites.map(function (i) { return i.email; }))) c.invites = a.invites;
    if (a.invitesModifient !== !!e.invitesModifient) c.invitesModifient = a.invitesModifient;
    if (a.invitesInvitent !== !!e.invitesInvitent) c.invitesInvitent = a.invitesInvitent;
    if (a.invitesVoient !== !!e.invitesVoient) c.invitesVoient = a.invitesVoient;
    if (JSON.stringify(a.rappels) !== JSON.stringify(e.rappels)) c.rappels = a.rappels;
    if (a.dispo !== e.dispo) c.dispo = a.dispo;
    if (a.visibilite !== (e.visibilite || "default")) c.visibilite = a.visibilite;
    var avant = ag.form.regle ? [ag.form.regle].concat(ag.form.autres) : [];
    if (JSON.stringify(a.recurrence) !== JSON.stringify(avant)) c.recurrence = a.recurrence;
    return c;
  }
  function enregistrer() {
    var souci = document.getElementById("agSouci"), a;
    try { a = valeursFormulaire(); } catch (e) { souci.textContent = e.message; return; }
    var x = ag.form.x;
    if (!x) {
      envoyer(a.compte, Object.assign({ cal: a.cal }, a), "Événement créé.", [a.debut, a.fin]);
      reg.dernierCal = cleCal(a.compte, a.cal); retenir(); return;
    }
    var c = changements(x, a), vers = a.cal !== x.cal ? a.cal : "";
    if (!Object.keys(c).length && !vers) { fermer(); return; }
    var args = Object.assign({ cal: x.cal, id: x.ev.id, envoyer: a.envoyer }, c); if (vers) args.versCal = vers;
    var fini = function (portee) { args.portee = portee; envoyer(x.compte.id, args, "Événement enregistré.", [x.ev.debut, x.ev.fin, a.debut, a.fin], portee !== "un"); };
    if (x.ev.serie) {
      if (c.recurrence) return demanderPortee("Modifier l'événement répété", ["suivants", "tous"], fini);
      demanderPortee("Modifier l'événement répété", ["un", "suivants", "tous"], fini);
    } else fini("un");
  }
  function envoyer(compte, args, fait, dates, toutRelire) {
    var b = racine.querySelector('[data-ag="enregistrer"]'); if (b) { b.disabled = true; b.textContent = "Enregistrement…"; }
    delete args.compte;
    P.appel(compte, "agenda.enregistrer", args, { sans: true, lent: true }).then(function () {
      fermer(); avis(fait);
      if (toutRelire) donnees[compte].mois = {}; else dates.filter(Boolean).forEach(function (d) { oublier(compte, d, d); });
      ag.garderDefile = true; charger(); dessiner();
    }, function (e) {
      var s = document.getElementById("agSouci"); if (s) s.textContent = erreurLisible(e); else avis(erreurLisible(e), true);
      if (b) { b.disabled = false; b.textContent = "Enregistrer"; }
    });
  }
  function demanderPortee(titre, choix, suite) {
    var noms = { un: "Cet événement", suivants: "Cet événement et les suivants", tous: "Tous les événements" };
    ag.question = suite;
    var h = '<h2>' + texte(titre) + '</h2><div class="ag-portee">';
    choix.forEach(function (c, i) { h += '<label class="ag-case"><input type="radio" name="agPortee" value="' + c + '"' + (i === 0 ? " checked" : "") + "> " + noms[c] + "</label>"; });
    h += '</div><div class="ag-actions"><button class="ag-b" data-ag="fermer">Annuler</button><button class="ag-b ag-fort" data-ag="portee">OK</button></div>';
    feuille(h);
  }
  function supprimer(k) {
    var x = parCle[k]; if (!x) return;
    var invites = x.ev.invites && x.ev.invites.some(function (i) { return !i.moi; });
    var faire = function (portee) {
      var prev = document.getElementById("agPrevenir"), args = { cal: x.cal, id: x.ev.id, portee: portee, envoyer: !!(prev && prev.checked) };
      P.appel(x.compte.id, "agenda.supprimer", args, { sans: true }).then(function () {
        fermer(); avis("Événement supprimé.");
        if (portee === "un") oublier(x.compte.id, x.ev.debut, x.ev.fin); else donnees[x.compte.id].mois = {};
        charger(); dessiner();
      }, function (e) { avis(erreurLisible(e), true); });
    };
    ag.question = faire;
    var h = "<h2>Supprimer « " + texte(x.titre) + " » ?</h2>";
    if (x.ev.serie) { h += '<div class="ag-portee">'; [["un", "Cet événement"], ["suivants", "Cet événement et les suivants"], ["tous", "Tous les événements"]].forEach(function (c, i) { h += '<label class="ag-case"><input type="radio" name="agPortee" value="' + c[0] + '"' + (i === 0 ? " checked" : "") + "> " + c[1] + "</label>"; }); h += "</div>"; }
    else h += "<p>L'événement disparaît de l'agenda Google.</p>";
    if (invites) h += '<label class="ag-case"><input type="checkbox" id="agPrevenir"> Prévenir les invités par e-mail</label>';
    h += '<div class="ag-actions"><button class="ag-b" data-ag="fermer">Annuler</button><button class="ag-b ag-rouge" data-ag="portee">Supprimer</button></div>';
    feuille(h);
  }

  // ---------- Glisser un événement (vues Jour et Semaine) ----------
  var glisse = null;
  function debutGlisse(ev) {
    var b = ev.target.closest && ev.target.closest("[data-ag-glisse]"); if (!b || ev.button) return;
    var col = b.parentNode, cols = [].slice.call(racine.querySelectorAll(".ag-col"));
    glisse = { b: b, k: b.dataset.agEv, y: ev.clientY, x: ev.clientX, cols: cols, col0: cols.indexOf(col), dm: 0, dj: 0, bouge: false, id: ev.pointerId };
  }
  function bougeGlisse(ev) {
    if (!glisse || ev.pointerId !== glisse.id) return;
    var dy = ev.clientY - glisse.y, dx = ev.clientX - glisse.x;
    if (!glisse.bouge && Math.abs(dy) < 6 && Math.abs(dx) < 6) return;
    if (!glisse.bouge) { glisse.bouge = true; try { glisse.b.setPointerCapture(ev.pointerId); } catch (e) {} glisse.b.classList.add("glisse"); }
    glisse.dm = Math.round(dy / HEURE * 4) * 15;
    var c0 = glisse.cols[glisse.col0], larg = c0 ? c0.getBoundingClientRect().width : 1;
    glisse.dj = Math.max(-glisse.col0, Math.min(glisse.cols.length - 1 - glisse.col0, Math.round(dx / larg)));
    glisse.b.style.transform = "translate(" + (glisse.dj * larg) + "px," + (glisse.dm / 60 * HEURE) + "px)";
    ev.preventDefault();
  }
  function finGlisse(ev) {
    if (!glisse || ev.pointerId !== glisse.id) return;
    var g = glisse; glisse = null;
    if (!g.bouge) return;
    ag.sansClic = Date.now();
    var x = parCle[g.k], dt = g.dm * 60000 + g.dj * 864e5;
    g.b.classList.remove("glisse");
    if (!x || !dt) { g.b.style.transform = ""; return; }
    var a0 = new Date(x.d0.getTime()), a1 = new Date(x.d1.getTime());
    a0 = new Date(a0.getFullYear(), a0.getMonth(), a0.getDate() + g.dj, a0.getHours(), a0.getMinutes() + g.dm); a1 = new Date(a1.getFullYear(), a1.getMonth(), a1.getDate() + g.dj, a1.getHours(), a1.getMinutes() + g.dm);
    var args = { cal: x.cal, id: x.ev.id, debut: a0.toISOString(), fin: a1.toISOString(), journee: false, fuseau: fuseau() };
    var fini = function (portee) { args.portee = portee; P.appel(x.compte.id, "agenda.enregistrer", args, { sans: true }).then(function () { fermer(); avis("Déplacé au " + jourLong(a0) + " à " + hm(a0) + "."); if (portee === "un") { oublier(x.compte.id, x.ev.debut, x.ev.fin); oublier(x.compte.id, args.debut, args.fin); } else donnees[x.compte.id].mois = {}; charger(); dessiner(); }, function (e) { avis(erreurLisible(e), true); dessiner(); }); };
    // Montre tout de suite la nouvelle place, le moteur confirme ensuite.
    x.ev.debut = args.debut; x.ev.fin = args.fin; dessiner();
    if (x.ev.serie) demanderPortee("Déplacer l'événement répété", ["un", "suivants", "tous"], fini); else fini("un");
  }

  // ---------- Sources et menus d'agenda ----------
  function feuilleSources(cid) {
    var c = comptes().filter(function (y) { return y.id === cid; })[0]; if (!c) return;
    feuille('<h2>Prospection de ' + texte(c.nom) + "</h2><p>Lecture…</p>");
    P.appel(cid, "agenda.sources", {}, { sans: true }).then(function (s) {
      var h = '<div class="ag-det-tete"><h2>Prospection de ' + texte(c.nom) + '</h2><button class="ag-icone" data-ag="fermer" aria-label="Fermer">✕</button></div><p>L\'agenda lit ces classeurs du compte, sans jamais y écrire. Colle l\'adresse d\'un classeur pour le changer ; laisse vide pour ne rien lire.</p>';
      h += '<label class="ag-champ">Classeur de Diffusion (dates, relances, appels à projets, journal)<input id="agSrcD" value="' + texte(s.diffusion ? s.diffusion.lien : "") + '" placeholder="https://docs.google.com/spreadsheets/d/…"></label>';
      h += '<label class="ag-champ">Classeur de la Boîte mail (campagnes)<input id="agSrcB" value="' + texte(s.boite ? s.boite.lien : "") + '" placeholder="https://docs.google.com/spreadsheets/d/…"></label>';
      h += '<p id="agSouci" class="ag-souci" role="status"></p><div class="ag-actions"><button class="ag-b" data-ag="fermer">Annuler</button><button class="ag-b ag-fort" data-ag-src-ok="' + texte(cid) + '">Enregistrer</button></div>';
      feuille(h);
    }, function (e) { feuille("<h2>Prospection</h2><p class=\"ag-souci\">" + texte(erreurLisible(e)) + '</p><div class="ag-actions"><button class="ag-b" data-ag="fermer">Fermer</button></div>'); });
  }
  function menuCal(cle, prosp) {
    var i = cle.indexOf("|"), cid = cle.slice(0, i), id = cle.slice(i + 1), k = prosp ? null : cal(cid, id), nom = prosp ? (PROSPECTION.filter(function (t) { return t.id === id; })[0] || {}).nom : k && k.nom;
    var h = '<div class="ag-det-tete"><h2>' + texte(nom || "") + '</h2><button class="ag-icone" data-ag="fermer" aria-label="Fermer">✕</button></div>';
    h += '<button class="ag-b" data-ag-seul="' + texte(prosp ? cid + "|p:" + id : cle) + '">Afficher seulement celui-ci</button><div class="ag-champ"><span>Couleur</span><div class="ag-couleurs">';
    COULEURS_CAL.forEach(function (c) { h += '<button data-ag-coul-cal="' + c + '" data-ag-pour="' + texte(prosp ? cid + "|p:" + id : cle) + '" style="background:' + c + '" aria-label="Couleur ' + c + '"></button>'; });
    h += "</div></div>";
    if (k) { h += '<p class="ag-mini-note">' + ({ owner: "Ton agenda.", writer: "Partagé avec toi : tu peux le modifier.", reader: "Partagé avec toi en lecture seule.", freeBusyReader: "Partagé : tu ne vois que les heures occupées." }[k.acces] || "") + (k.description ? " " + texte(k.description) : "") + "</p>"; }
    feuille(h);
  }
  function feuilleAjoutCal(cid) {
    feuille('<div class="ag-det-tete"><h2>Ajouter un agenda</h2><button class="ag-icone" data-ag="fermer" aria-label="Fermer">✕</button></div>' +
      '<label class="ag-champ">Créer un nouvel agenda<input id="agNouveauCal" placeholder="Nom, par exemple « Tournée 2027 »" maxlength="200"></label><div class="ag-actions"><button class="ag-b ag-fort" data-ag-cal-creer="' + texte(cid) + '">Créer</button></div>' +
      '<label class="ag-champ">Ou s\'abonner à l\'agenda de quelqu\'un (son adresse e-mail, ou l\'identifiant d\'un agenda partagé)<input id="agAbonner" placeholder="nom@exemple.org"></label><div class="ag-actions"><button class="ag-b" data-ag-cal-abonner="' + texte(cid) + '">S\'abonner</button></div><p id="agSouci" class="ag-souci" role="status"></p>');
  }

  // ---------- Gestes ----------
  function aller(n) {
    var d = dateDe(ag.date), v = vue();
    if (v === "jour") d = plus(d, n); else if (v === "semaine") d = plus(d, 7 * n); else if (v === "mois") d = new Date(d.getFullYear(), d.getMonth() + n, 1); else d = plus(d, 62 * n);
    ag.date = iso(d); ag.mini = ""; ag.garderDefile = true; charger(); dessiner();
  }
  function changerVue(v) { ag.vue = v; reg.vue = v; retenir(); ag.recherche = null; ag.garderDefile = false; charger(); dessiner(); }
  function clic(ev) {
    if (ag.sansClic && Date.now() - ag.sansClic < 300) return;
    var b = ev.target.closest("button, input[type=checkbox][data-ag-coche]"); if (!b || !racine.contains(b)) return;
    var d = b.dataset;
    if (d.agCoche !== undefined) { reg.coches[d.agCoche] = b.checked; retenir(); var cid = d.agCoche.split("|")[0]; if (d.agCoche.indexOf("|p:") < 0) chargerEvenements(cid); ag.garderDefile = true; dessiner(); return; }
    if (d.agEv) { details(d.agEv); return; }
    if (d.agVue) { changerVue(d.agVue); return; }
    if (d.agDate) { ag.date = d.agDate; ag.mini = ""; ag.recherche = null; ag.volet = false; ag.garderDefile = true; charger(); dessiner(); return; }
    if (d.agJour) { ag.date = d.agJour; changerVue("jour"); return; }
    if (d.agMini) { var m = dateDe(ag.mini || ag.date); ag.mini = iso(new Date(m.getFullYear(), m.getMonth() + Number(d.agMini), 1)); dessiner(); return; }
    if (d.agCreerJour) { var j = dateDe(d.agCreerJour); formulaire(null, { d0: j, d1: plus(j, 1), journee: true }); return; }
    if (d.agModifier) { var x = parCle[d.agModifier]; if (!x) return; if (x.ev.serie && !x.ev.recurrence) { P.appel(x.compte.id, "agenda.evenement", { cal: x.cal, id: x.ev.serie }, { sans: true }).then(function (s) { x.ev.recurrence = s.recurrence || null; formulaire(x); }, function () { formulaire(x); }); } else formulaire(x); return; }
    if (d.agSupprimer) { supprimer(d.agSupprimer); return; }
    if (d.agDupliquer) { var y = parCle[d.agDupliquer]; if (y) formulaire(null, { titre: y.titre, d0: y.d0, d1: y.d1, journee: y.journee, lieu: y.ev.lieu, notes: notesTexte(y.ev.notes), couleur: y.ev.couleur, cal: y.modifiable ? cleCal(y.compte.id, y.cal) : "" }); return; }
    if (d.agCopier) { var p = parCle[d.agCopier]; if (p) formulaire(null, { titre: p.titre, d0: p.d0, d1: p.d1, journee: true, notes: [p.p.detail, p.p.spectacle ? "Spectacle : " + p.p.spectacle : "", lienSur(p.p.lien)].filter(String).join("\n") }); return; }
    if (d.agRepondre) {
      var r = parCle[d.agCle], prev = document.getElementById("agPrevenirOrg");
      P.appel(r.compte.id, "agenda.repondre", { cal: r.cal, id: r.ev.id, reponse: d.agRepondre, envoyer: !!(prev && prev.checked) }, { sans: true }).then(function () { fermer(); avis("Réponse enregistrée."); oublier(r.compte.id, r.ev.debut, r.ev.fin); charger(); }, function (e) { avis(erreurLisible(e), true); });
      return;
    }
    if (d.agCoul !== undefined) { [].forEach.call(b.parentNode.children, function (c) { c.setAttribute("aria-pressed", c === b ? "true" : "false"); }); return; }
    if (d.agRetirerInv !== undefined) { ag.form.invites.splice(Number(d.agRetirerInv), 1); document.getElementById("agInvites").innerHTML = invitesHtml(); return; }
    if (d.agRetirerRap !== undefined) { lireRappels(); ag.form.rappels.liste.splice(Number(d.agRetirerRap), 1); document.getElementById("agRappels").innerHTML = rappelsHtml(); return; }
    if (d.agSources) { feuilleSources(d.agSources); return; }
    if (d.agSrcOk) {
      var s = document.getElementById("agSouci");
      P.appel(d.agSrcOk, "agenda.sources", { diffusion: document.getElementById("agSrcD").value, boite: document.getElementById("agSrcB").value }, { sans: true }).then(function () {
        fermer(); avis("Sources enregistrées."); var dd = donnees[d.agSrcOk]; if (dd) dd.prospection = null; charger(true);
      }, function (e) { s.textContent = erreurLisible(e); });
      return;
    }
    if (d.agMenuCal) { menuCal(d.agMenuCal, false); return; }
    if (d.agMenuP) { menuCal(d.agMenuP, true); return; }
    if (d.agSeul) {
      comptes().forEach(function (c) { calsDe(c.id).forEach(function (k) { reg.coches[cleCal(c.id, k.id)] = false; }); PROSPECTION.forEach(function (t) { reg.coches[cleCal(c.id, "p:" + t.id)] = false; }); });
      reg.coches[d.agSeul] = true; retenir(); fermer(); charger(); dessiner(); return;
    }
    if (d.agCoulCal) {
      var pour = d.agPour, ip = pour.indexOf("|"), cid2 = pour.slice(0, ip), id2 = pour.slice(ip + 1);
      if (id2.indexOf("p:") === 0) { reg.couleursP[cid2 + "|" + id2.slice(2)] = d.agCoulCal; retenir(); fermer(); dessiner(); return; }
      P.appel(cid2, "agenda.calendrier.regler", { cal: id2, couleur: d.agCoulCal }, { sans: true }).then(function (r2) { var k2 = cal(cid2, id2); if (k2) k2.couleur = r2.couleur; fermer(); dessiner(); }, function (e) { avis(erreurLisible(e), true); });
      return;
    }
    if (d.agAjoutCal) { feuilleAjoutCal(d.agAjoutCal); return; }
    if (d.agCalCreer || d.agCalAbonner) {
      var cid3 = d.agCalCreer || d.agCalAbonner, s3 = document.getElementById("agSouci");
      var appel = d.agCalCreer ? P.appel(cid3, "agenda.calendrier.creer", { nom: document.getElementById("agNouveauCal").value }, { sans: true }) : P.appel(cid3, "agenda.calendrier.ajouter", { id: document.getElementById("agAbonner").value }, { sans: true });
      b.disabled = true;
      appel.then(function () { fermer(); avis(d.agCalCreer ? "Agenda créé." : "Agenda ajouté."); donnees[cid3].cals = null; charger(); }, function (e) { s3.textContent = erreurLisible(e); b.disabled = false; });
      return;
    }
    if (d.agRelier) { fermer(); if (P.relier) P.relier(d.agRelier); return; }
    if (d.agDiffusion) { fermer(); if (P.ouvrir) P.ouvrir(d.agDiffusion === "boite" ? "boite" : "agendaDiff"); return; }
    switch (d.ag) {
      case "auj": ag.date = aujourdhui(); ag.mini = ""; ag.recherche = null; ag.garderDefile = false; charger(); dessiner(); return;
      case "prec": aller(-1); return;
      case "suiv": aller(1); return;
      case "actualiser": Object.keys(donnees).forEach(function (cid) { donnees[cid].mois = {}; }); charger(true); dessiner(); return;
      case "creer": ag.volet = false; formulaire(null, ag.vue === "mois" || vue() === "planning" ? null : { d0: arrondi(new Date(dateDe(ag.date).getTime() + (memeJour(dateDe(ag.date), new Date()) ? new Date().getHours() * 3600000 + new Date().getMinutes() * 60000 : 9 * 3600000))) }); return;
      case "volet": ag.volet = !ag.volet; dessiner(); return;
      case "tout-voir": ag.toutVoir = !ag.toutVoir; ag.garderDefile = true; dessiner(); return;
      case "fin-recherche": ag.recherche = null; dessiner(); return;
      case "fermer": fermer(); return;
      case "enregistrer": enregistrer(); return;
      case "portee": var q = ag.question, choisi = racine.querySelector("[name=agPortee]:checked"); ag.question = null; if (q) q(choisi ? choisi.value : "un"); return;
      case "inviter": ajouterInvite(); return;
      case "rappel": lireRappels(); ag.form.rappels.liste.push({ methode: "popup", minutes: 30 }); document.getElementById("agRappels").innerHTML = rappelsHtml(); return;
      case "rapide":
        var t = document.getElementById("agRapide").value, cc = document.getElementById("agCal").value, i2 = cc.indexOf("|");
        P.appel(cc.slice(0, i2), "agenda.ajoutRapide", { cal: cc.slice(i2 + 1), texte: t }, { sans: true }).then(function (r3) { fermer(); avis("Ajouté : " + (r3.evenement.titre || t)); donnees[cc.slice(0, i2)].mois = {}; charger(); }, function (e) { document.getElementById("agSouci").textContent = erreurLisible(e); });
        return;
    }
  }
  function ajouterInvite() {
    var i = document.getElementById("agInvite"), v = (i.value || "").trim().toLowerCase();
    var l = v.split(/[\s,;]+/).filter(String), mauvais = l.filter(function (a) { return !/^[^\s@<>"]{1,64}@[^\s@<>"]{1,190}\.[a-z]{2,}$/i.test(a); });
    if (mauvais.length) { document.getElementById("agSouci").textContent = "Adresse incorrecte : " + mauvais[0]; return; }
    l.forEach(function (a) { if (!ag.form.invites.some(function (x) { return x.email === a; })) ag.form.invites.push({ email: a, reponse: "needsAction" }); });
    i.value = ""; document.getElementById("agInvites").innerHTML = invitesHtml(); document.getElementById("agSouci").textContent = "";
  }
  function clicGrille(ev) {
    // Clic dans une colonne vide (vues Jour et Semaine) : nouvel événement d'une heure, au quart d'heure près.
    if (ag.sansClic && Date.now() - ag.sansClic < 300) return;
    var col = ev.target.classList && ev.target.classList.contains("ag-col") ? ev.target : null; if (!col) return;
    var r = col.getBoundingClientRect(), min = Math.max(0, Math.min(1425, Math.floor((ev.clientY - r.top) / HEURE * 4) * 15)), j = dateDe(col.dataset.agCol);
    var d0 = new Date(j.getFullYear(), j.getMonth(), j.getDate(), 0, min);
    formulaire(null, { d0: d0, d1: new Date(d0.getTime() + 3600000) });
  }
  function changement(ev) {
    var t = ev.target; if (!racine.contains(t)) return;
    if (t.id === "agJournee") [].forEach.call(racine.querySelectorAll(".ag-h"), function (l) { l.hidden = t.checked; });
    if (t.id === "agRegle") document.getElementById("agPerso").hidden = t.value !== "perso";
    if (t.id === "agRFreq") document.getElementById("agRJours").hidden = t.value !== "WEEKLY";
    if (t.id === "agRDefaut") { lireRappels(); if (!t.checked && !ag.form.rappels.liste.length) ag.form.rappels.liste.push({ methode: "popup", minutes: 30 }); document.getElementById("agRappels").innerHTML = rappelsHtml(); }
    if (t.id === "agD0") {   // la fin suit le début, comme dans Google
      var d1 = document.getElementById("agD1"), avant = t.dataset.avant || t.defaultValue;
      if (avant && d1.value) { var ecart = (dateDe(d1.value) - dateDe(avant)) / 864e5; d1.value = iso(plus(dateDe(t.value), Math.max(0, Math.round(ecart)))); }
      t.dataset.avant = t.value;
      var sel = document.getElementById("agRegle"), garde = sel.value; sel.innerHTML = presets(dateDe(t.value)).map(function (o) { return '<option value="' + texte(o[0]) + '">' + texte(o[1]) + "</option>"; }).join(""); if (garde === "" || garde === "perso") sel.value = garde;
    }
  }
  function touche(ev) {
    if (!racine || racine.hidden) return;
    var v = racine.querySelector(".ag-voile");
    if (ev.key === "Escape" && !v.hidden) { fermer(); return; }
    if (!v.hidden || ev.metaKey || ev.ctrlKey || ev.altKey || /INPUT|TEXTAREA|SELECT/.test((ev.target && ev.target.tagName) || "")) return;
    var k = ev.key.toLowerCase();
    if (k === "t") { ag.date = aujourdhui(); ag.garderDefile = false; charger(); dessiner(); }
    else if (k === "j" || k === "n") aller(1); else if (k === "k" || k === "p") aller(-1);
    else if (k === "d" || k === "1") changerVue("jour"); else if (k === "w" || k === "2") changerVue("semaine"); else if (k === "m" || k === "3") changerVue("mois"); else if (k === "a" || k === "4") changerVue("planning");
    else if (k === "c") { formulaire(null, { d0: arrondi(new Date()) }); }
    else if (k === "/") { var i = document.getElementById("agCherche"); if (i) { ev.preventDefault(); i.focus(); } }
    else return;
    ev.preventDefault();
  }
  var minuterieRecherche = 0;
  function saisie(ev) {
    if (ev.target.id !== "agCherche") return;
    clearTimeout(minuterieRecherche);
    var v = ev.target.value;
    minuterieRecherche = setTimeout(function () { chercher(v); }, 450);
  }

  // ---------- Entrée ----------
  window.OrigamiAgenda = {
    montrer: function (section, pont) {
      P = pont;
      if (!racine) {
        racine = section;
        racine.innerHTML = '<div class="ag-zone"></div><div class="ag-voile" hidden></div>';
        racine.addEventListener("click", clic);
        racine.addEventListener("click", clicGrille);
        racine.addEventListener("change", changement);
        racine.addEventListener("input", saisie);
        racine.addEventListener("keydown", function (ev) { if (ev.target.id === "agInvite" && ev.key === "Enter") { ev.preventDefault(); ajouterInvite(); } if (ev.target.id === "agCherche" && ev.key === "Enter") { clearTimeout(minuterieRecherche); chercher(ev.target.value); } if (ev.target.id === "agCherche" && ev.key === "Escape") { ev.target.value = ""; chercher(""); } });
        racine.addEventListener("pointerdown", debutGlisse);
        racine.addEventListener("pointermove", bougeGlisse);
        racine.addEventListener("pointerup", finGlisse);
        racine.addEventListener("pointercancel", function () { if (glisse) { glisse.b.style.transform = ""; glisse = null; } });
        racine.querySelector(".ag-voile").addEventListener("click", function (ev) { if (ev.target === ev.currentTarget) fermer(); });
        document.addEventListener("keydown", touche);
        setInterval(function () { if (racine && !racine.hidden && !document.hidden && (vue() === "jour" || vue() === "semaine")) { ag.garderDefile = true; dessiner(); } }, 300000);
      }
      ag.garderDefile = false;
      charger();
      dessiner();
    },
    // La page Origami dit qu'un compte a changé (liaison, comptes cochés) : on relit ce qui manque.
    rafraichir: function () { if (racine && !racine.hidden) { charger(); dessiner(); } }
  };

  // ---------- Style (repris de la Boîte mail : fond clair, cartes blanches, accent bleu) ----------
  var css = document.createElement("style");
  css.textContent = [
    "#agenda{padding:0!important;overflow:hidden!important}",
    "#agenda .ag-zone{height:100%}",
    ".ag{display:flex;height:100%;min-height:0}",
    ".ag-cote{flex:none;width:248px;display:flex;flex-direction:column;gap:14px;padding:14px 10px 24px 14px;overflow-y:auto;border-right:1px solid var(--ligne)}",
    ".ag-creer{display:inline-flex;align-items:center;gap:10px;align-self:flex-start;min-height:44px;padding:0 20px 0 14px;border:0;border-radius:14px;background:var(--carte);box-shadow:0 1px 3px rgba(17,16,20,.18);font-weight:600;font-size:14px}",
    ".ag-creer span{font-size:22px;line-height:1;color:var(--accent)}",
    ".ag-mini-tete{display:flex;align-items:center;gap:2px;padding:0 2px 4px 6px;font-size:13px}.ag-mini-tete strong{flex:1;font-weight:600;text-transform:capitalize}",
    ".ag-mini-grille{display:grid;grid-template-columns:repeat(7,1fr);gap:1px;text-align:center;font-size:11px}",
    ".ag-mini-grille span{color:var(--doux);font-size:10px;padding:2px 0}",
    ".ag-mini-grille button{aspect-ratio:1;min-width:0;padding:0;border:0;border-radius:50%;background:none;font-size:11px}",
    ".ag-mini-grille button:hover{background:rgba(21,19,26,.07)}.ag-mini-grille .hors{color:var(--doux);opacity:.6}",
    ".ag-mini-grille .auj{background:var(--accent)!important;color:#fff;font-weight:700}.ag-mini-grille .choisi{background:var(--accent-clair);font-weight:700}",
    ".ag-groupe h2{display:flex;align-items:center;gap:7px;padding:0 4px 4px;font-size:13px;font-weight:600}",
    ".ag-groupe h3{display:flex;align-items:center;justify-content:space-between;margin:8px 0 2px;padding:0 4px;font-size:11px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--doux)}",
    ".ag-cal{display:flex;align-items:center;gap:4px;min-height:28px;padding:0 0 0 4px;border-radius:8px}.ag-cal:hover{background:rgba(21,19,26,.05)}",
    ".ag-cal label{flex:1;min-width:0;display:flex;align-items:center;gap:8px;cursor:pointer;font-size:13px}",
    ".ag-cal label span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
    ".ag-cal em{flex:none;font-style:normal;font-size:11px;color:var(--doux)}",
    ".ag-cal input{flex:none;appearance:none;-webkit-appearance:none;width:16px;height:16px;margin:0;border:2px solid var(--c);border-radius:4px;background:none;cursor:pointer}",
    ".ag-cal input:checked{background:var(--c) url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cpath d='M3.5 8.5l3 3 6-7' fill='none' stroke='white' stroke-width='2.2'/%3E%3C/svg%3E\") center/12px no-repeat}",
    ".ag-cal .ag-icone{opacity:0}.ag-cal:hover .ag-icone,.ag-cal .ag-icone:focus{opacity:1}",
    ".ag-icone{flex:none;width:26px;height:26px;padding:0;border:0;border-radius:50%;background:none;color:var(--doux);font-size:14px;line-height:1}.ag-icone:hover{background:rgba(21,19,26,.07);color:var(--texte)}",
    ".ag-petit{align-self:flex-start;margin:4px 0 0;padding:2px 4px;border:0;background:none;color:var(--accent);font-size:12.5px;font-weight:600}",
    ".ag-lien{padding:0;border:0;background:none;color:var(--accent);text-decoration:underline;font-size:inherit}",
    ".ag-mini-note{padding:0 4px;color:var(--doux);font-size:12px}",
    ".ag-pt{display:inline-block;flex:none;width:9px;height:9px;border-radius:50%}",
    ".ag-centre{flex:1;min-width:0;display:flex;flex-direction:column}",
    ".ag-barre{flex:none;display:flex;flex-wrap:wrap;align-items:center;gap:6px 8px;padding:12px 16px 10px;border-bottom:1px solid var(--ligne)}",
    ".ag-titre{flex:1 1 auto;min-width:120px;font-size:20px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
    ".ag-etat{color:var(--doux);font-size:12px}.ag-etat:empty{display:none}",
    ".ag-b{display:inline-flex;align-items:center;justify-content:center;gap:5px;min-height:30px;padding:0 12px;border:1px solid var(--ligne);border-radius:8px;background:var(--carte);color:var(--texte);font-size:13px;font-weight:500;text-decoration:none;white-space:nowrap}",
    ".ag-b:hover{background:var(--carte2)}.ag-b.ag-fort{border-color:var(--accent);background:var(--accent);color:#fff;font-weight:600}.ag-b.ag-rouge{border-color:#b42318;background:#b42318;color:#fff;font-weight:600}.ag-b[disabled]{opacity:.5}",
    ".ag-rond{width:30px;padding:0;border-radius:50%;font-size:18px}",
    ".ag-cherche input{width:170px;min-height:30px;padding:0 10px;border:1px solid var(--ligne);border-radius:8px;background:var(--carte);color:var(--texte);font:inherit;font-size:13px}",
    ".ag-vues{display:flex;border:1px solid var(--ligne);border-radius:8px;overflow:hidden}",
    ".ag-vues button{min-height:28px;padding:0 11px;border:0;border-left:1px solid var(--ligne);background:var(--carte);font-size:13px}.ag-vues button:first-child{border-left:0}",
    ".ag-vues button[aria-pressed=true]{background:var(--accent-clair);font-weight:600}",
    ".ag-tel{display:none!important}",".ag-scrim{display:none}",
    ".ag-note{margin:8px 16px 0;padding:8px 12px;border-radius:10px;background:var(--carte);color:var(--doux);font-size:13px;display:flex;align-items:center;gap:8px}.ag-souci{color:#b42318}",
    // Jour, Semaine
    ".ag-grille{flex:1;min-height:0;display:flex;flex-direction:column}",
    ".ag-tete,.ag-journee{flex:none;display:flex;border-bottom:1px solid var(--ligne)}",
    ".ag-gouttiere{flex:none;width:56px;display:flex;align-items:flex-end;justify-content:center;padding-bottom:4px}",
    ".ag-sem{font-size:11px;color:var(--doux)}",
    ".ag-jour-tete{flex:1;min-width:0;display:flex;flex-direction:column;align-items:center;gap:0;padding:6px 0 4px;border:0;background:none}",
    ".ag-jour-tete span{font-size:11px;text-transform:uppercase;color:var(--doux)}.ag-jour-tete strong{display:grid;place-items:center;width:34px;height:34px;border-radius:50%;font-size:20px;font-weight:500}",
    ".ag-jour-tete.auj span{color:var(--accent)}.ag-jour-tete.auj strong{background:var(--accent);color:#fff}.ag-jour-tete:hover strong{background:rgba(21,19,26,.07)}.ag-jour-tete.auj:hover strong{background:var(--accent)}",
    ".ag-journee-zone{flex:1;min-width:0;display:grid;grid-template-columns:repeat(var(--n),1fr);grid-template-rows:repeat(var(--l),22px);gap:2px 0;padding:2px 0;min-height:28px}",
    ".ag-case-jour{border:0;border-left:1px solid var(--ligne);background:none;cursor:pointer}",
    ".ag-barre-j{min-width:0;padding:0 2px;position:relative;z-index:1}",
    ".ag-puce{display:block;width:100%;min-height:20px;padding:0 6px;border:0;border-radius:5px;background:none;color:var(--texte);font-size:12px;text-align:left;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
    ".ag-puce:hover{background:rgba(21,19,26,.07)}.ag-puce i{display:inline-block;width:8px;height:8px;margin-right:4px;border-radius:50%;background:var(--c);vertical-align:0}.ag-puce b{font-weight:500;color:var(--doux)}",
    ".ag-puce.plein{background:var(--c);color:var(--t);font-weight:500}.ag-puce.plein:hover{filter:brightness(.95)}",
    ".ag-puce.refuse,.ag-ev.refuse{text-decoration:line-through;opacity:.6}.ag-puce.attente.plein,.ag-ev.attente{background:var(--carte)!important;color:var(--texte)!important;box-shadow:inset 0 0 0 1.5px var(--c)}.ag-puce.fait{opacity:.55}",
    ".ag-encore{align-self:center;border:0;background:none;color:var(--doux);font-size:11.5px;font-weight:600;text-align:left;padding:0 6px;position:relative;z-index:1}",
    ".ag-grille-defile{flex:1;min-height:0;display:flex;overflow-y:auto;position:relative}",
    ".ag-heures{flex:none;width:56px;position:relative}.ag-heures span{display:block;height:" + HEURE + "px;padding-right:8px;text-align:right;font-size:10.5px;color:var(--doux);transform:translateY(-7px)}",
    ".ag-colonnes{flex:1;min-width:0;display:flex;background-image:repeating-linear-gradient(var(--ligne) 0 1px,transparent 1px " + HEURE + "px);height:" + (24 * HEURE) + "px}",
    ".ag-col{flex:1;min-width:0;position:relative;border-left:1px solid var(--ligne);cursor:pointer}.ag-col.auj{background:rgba(31,92,255,.035)}",
    ".ag-ev{position:absolute;display:flex;flex-direction:column;align-items:flex-start;gap:0;overflow:hidden;padding:2px 6px;border:1px solid var(--carte);border-radius:6px;background:var(--c);color:var(--t);font-size:12px;line-height:1.25;text-align:left;cursor:pointer;touch-action:none}",
    ".ag-ev strong{font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:100%}.ag-ev span{opacity:.9;font-size:11.5px}.ag-ev.court{flex-direction:row;gap:5px;align-items:center}",
    ".ag-ev.glisse{z-index:5;box-shadow:0 6px 18px rgba(17,16,20,.3);opacity:.92;cursor:grabbing}",
    ".ag-maintenant{position:absolute;left:-1px;right:0;height:2px;background:#ea4335;z-index:3;pointer-events:none}.ag-maintenant::before{content:'';position:absolute;left:-6px;top:-5px;width:12px;height:12px;border-radius:50%;background:#ea4335}",
    // Mois
    ".ag-mois{flex:1;min-height:0;display:flex;flex-direction:column}",
    ".ag-mois-tete{flex:none;display:grid;grid-template-columns:repeat(7,1fr);border-bottom:1px solid var(--ligne)}.ag-mois-tete span{padding:6px 0 4px;text-align:center;font-size:11px;text-transform:uppercase;color:var(--doux)}",
    ".ag-mois-corps{flex:1;min-height:0;display:grid;grid-template-rows:repeat(6,minmax(96px,1fr));overflow-y:auto}",
    ".ag-sem-l{display:grid;grid-template-columns:repeat(7,1fr);grid-template-rows:26px repeat(var(--l),22px) 20px;align-content:start;row-gap:2px;border-bottom:1px solid var(--ligne);position:relative}",
    ".ag-mois-case{grid-row:1 / -1;border:0;border-left:1px solid var(--ligne);background:none;cursor:pointer}.ag-mois-case:first-child{border-left:0}.ag-mois-case.hors{background:rgba(21,19,26,.025)}",
    ".ag-mois-num{grid-row:1;justify-self:center;align-self:center;min-width:24px;height:24px;padding:0 6px;border:0;border-radius:12px;background:none;font-size:12px;font-weight:500;position:relative;z-index:1}",
    ".ag-mois-num:hover{background:rgba(21,19,26,.07)}.ag-mois-num.auj{background:var(--accent);color:#fff}",
    // Planning, recherche
    ".ag-liste{flex:1;min-height:0;overflow-y:auto;padding:8px 16px 30px}",
    ".ag-jour-l{display:flex;gap:10px;padding:8px 0;border-bottom:1px solid var(--ligne)}",
    ".ag-date-l{flex:none;width:96px;display:flex;align-items:baseline;gap:6px;align-self:flex-start;padding:4px 6px;border:0;border-radius:8px;background:none;text-align:left}",
    ".ag-date-l strong{font-size:20px;font-weight:500}.ag-date-l span{font-size:11px;text-transform:uppercase;color:var(--doux)}.ag-jour-l.auj .ag-date-l strong{color:var(--accent)}",
    ".ag-evs-l{flex:1;min-width:0;display:flex;flex-direction:column}",
    ".ag-ligne-l{display:flex;align-items:center;gap:10px;min-height:34px;padding:4px 8px;border:0;border-radius:8px;background:none;text-align:left}.ag-ligne-l:hover{background:var(--carte)}",
    ".ag-quand{flex:none;width:130px;font-size:12.5px;color:var(--doux)}.ag-quoi{flex:1;min-width:0;display:flex;flex-direction:column}.ag-quoi strong{font-weight:500;overflow-wrap:anywhere}.ag-quoi em{font-style:normal;font-size:12px;color:var(--doux)}",
    ".ag-ou{flex:none;max-width:30%;font-size:12px;color:var(--doux);text-align:right;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
    ".ag-ligne-l.refuse strong{text-decoration:line-through}.ag-ligne-l.fait{opacity:.6}",
    ".ag-plus-l{display:flex;justify-content:center;padding:14px}.ag-vide{padding:30px 10px;text-align:center;color:var(--doux)}",
    ".ag-rech-tete{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:6px 0 10px;color:var(--doux);font-size:13px}",
    // Feuilles
    ".ag-voile{position:fixed;inset:0;z-index:20;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(21,19,26,.32)}",
    ".ag-feuille{display:flex;flex-direction:column;gap:10px;width:100%;max-width:460px;max-height:100%;overflow-y:auto;padding:16px 18px 18px;border-radius:14px;background:var(--carte);box-shadow:0 12px 40px rgba(17,16,20,.28)}",
    ".ag-feuille.large{max-width:600px}",
    ".ag-feuille h2{flex:1;min-width:0;font-size:18px;font-weight:600;overflow-wrap:anywhere}",
    ".ag-feuille p{color:var(--doux);font-size:13px;overflow-wrap:anywhere}",
    ".ag-det-tete{display:flex;align-items:flex-start;gap:8px}.ag-carre{flex:none;width:14px;height:14px;margin-top:5px;border-radius:4px}",
    ".ag-det-quand{color:var(--texte)!important;font-size:13.5px!important}.ag-det-l{color:var(--texte)!important}.ag-det-l a,.ag-det-notes a,.ag-feuille .ag-mini-note a{color:var(--accent)}",
    ".ag-det-notes{padding:8px 10px;border-radius:8px;background:var(--carte2);font-size:13px;max-height:220px;overflow-y:auto;overflow-wrap:anywhere}",
    ".ag-invites{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:3px;font-size:13px}.ag-invites li{display:flex;align-items:center;gap:8px}.ag-invites li>span:first-child{flex:1;min-width:0;overflow-wrap:anywhere}.ag-invites em{font-style:normal;font-size:11px;color:var(--doux)}",
    ".ag-rep{font-size:11.5px;color:var(--doux)}.ag-rep.accepted{color:#15803d}.ag-rep.declined{color:#b42318}",
    ".ag-rsvp{display:flex;flex-wrap:wrap;align-items:center;gap:6px;padding:8px 0;border-top:1px solid var(--ligne)}.ag-rsvp>span{font-size:13px;font-weight:600;margin-right:4px}",
    ".ag-actions{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:6px;margin-top:4px}",
    ".ag-gros{min-height:42px;padding:0 2px;border:0;border-bottom:2px solid var(--ligne);background:none;color:var(--texte);font:inherit;font-size:20px}.ag-gros:focus{outline:0;border-bottom-color:var(--accent)}",
    ".ag-champ{display:flex;flex-direction:column;gap:4px;font-size:12.5px;color:var(--doux)}",
    ".ag-champ input,.ag-champ select,.ag-champ textarea,.ag-ligne-f input,.ag-ligne-f select{min-height:32px;padding:0 8px;border:1px solid var(--ligne);border-radius:8px;background:var(--carte);color:var(--texte);font:inherit;font-size:13.5px}",
    ".ag-champ textarea{padding:6px 8px;resize:vertical}",
    ".ag-ligne-f{display:flex;flex-wrap:wrap;align-items:flex-end;gap:6px}.ag-ligne-f>label{display:flex;flex-direction:column;gap:4px;font-size:12.5px;color:var(--doux)}.ag-ligne-f>input{flex:1;min-width:140px}",
    ".ag-dates input[type=date]{width:150px}.ag-dates input[type=time]{width:100px}",
    ".ag-case{display:flex;flex-wrap:wrap;align-items:flex-start;gap:0 8px;font-size:13px;color:var(--texte)}"+".ag-case small{flex-basis:100%;padding-left:24px}.ag-case input{flex:none;width:16px;height:16px;margin:2px 0 0;accent-color:var(--accent)}.ag-case small{display:block;color:var(--doux);font-size:12px}",
    ".ag-couleurs{display:flex;flex-wrap:wrap;gap:6px;align-items:center}.ag-couleurs button{width:22px;height:22px;padding:0;border:2px solid transparent;border-radius:50%}",
    ".ag-couleurs button[aria-pressed=true]{border-color:var(--texte);box-shadow:inset 0 0 0 2px var(--carte)}.ag-couleurs .ag-coul-cal{width:auto;padding:0 8px;border:1px solid var(--ligne);border-radius:11px;background:none;font-size:11.5px}",
    ".ag-rjours{display:flex;gap:4px}.ag-rjours label{cursor:pointer}.ag-rjours input{position:absolute;opacity:0;pointer-events:none}.ag-rjours span{display:grid;place-items:center;width:28px;height:28px;border-radius:50%;background:var(--carte2);font-size:12px}.ag-rjours input:checked+span{background:var(--accent);color:#fff}",
    ".ag-rfin{display:flex;flex-direction:column;gap:6px;font-size:13px}.ag-rfin>span{font-size:12.5px;color:var(--doux)}.ag-rfin input[type=number]{width:64px}.ag-rfin input{min-height:28px;border:1px solid var(--ligne);border-radius:6px;background:var(--carte);color:var(--texte);font:inherit}",
    ".ag-rappel input{width:64px}.ag-rappel span{font-size:13px;color:var(--doux);align-self:center}",
    ".ag-rapide,.ag-plus-opt{font-size:12.5px;color:var(--doux)}.ag-rapide summary,.ag-plus-opt summary{cursor:pointer}.ag-rapide .ag-ligne-f,.ag-plus-opt .ag-case{margin-top:6px}",
    ".ag-portee{display:flex;flex-direction:column;gap:8px}",
    // Sombre (fenêtre noire de l'appli Mac)
    "html.sombre .ag-mini-grille button:hover,html.sombre .ag-cal:hover,html.sombre .ag-puce:hover{background:rgba(255,255,255,.08)}",
    // Tablette
    "@media (max-width:1100px){.ag-cherche input{width:120px}}",
    ".ag-menu-b{display:none!important}",
    // Écran moyen et téléphone : la liste des agendas s'ouvre par ☰, par-dessus, pour laisser la place à la grille
    "@media (max-width:1200px){",
    ".ag-cote{position:fixed;inset:0 auto 0 0;z-index:15;width:min(300px,86vw);background:var(--fond);box-shadow:0 0 30px rgba(17,16,20,.3);transform:translateX(-105%);transition:transform .2s}",
    ".ag-volet-ouvert .ag-cote{transform:none}",
    ".ag-scrim{display:block;position:fixed;inset:0;z-index:14;border:0;padding:0;background:rgba(21,19,26,.3)}",
    ".ag-menu-b{display:inline-flex!important}",
    "}",
    // Téléphone
    "@media (max-width:760px){",
    ".ag-fab{position:fixed;right:16px;bottom:calc(72px + env(safe-area-inset-bottom));z-index:12;width:56px;height:56px;padding:0;border:0;border-radius:16px;background:var(--carte);color:var(--accent);font-size:28px;box-shadow:0 2px 8px rgba(17,16,20,.3)}",
    ".ag-tel{display:inline-flex!important}.ag-barre{padding:8px 10px;gap:6px}.ag-titre{order:2;flex-basis:100%;font-size:18px}.ag-cherche{order:3;flex:1}.ag-cherche input{width:100%;font-size:16px}.ag-vues{order:4;width:100%}.ag-vues button{flex:1}",
    ".ag-cal .ag-icone{opacity:1}.ag-gouttiere,.ag-heures{width:40px}.ag-jour-tete strong{width:28px;height:28px;font-size:16px}.ag-ev{padding:1px 3px;font-size:11px}.ag-ev span{display:none}",
    ".ag-mois-corps{grid-template-rows:repeat(6,minmax(84px,1fr))}.ag-puce{padding:0 3px;font-size:11px}.ag-puce b,.ag-puce i{display:none}",
    ".ag-liste{padding:4px 8px 24px}.ag-date-l{width:64px;flex-direction:column;gap:0}.ag-quand{width:84px;font-size:12px}.ag-ou{display:none}",
    ".ag-voile{align-items:flex-end;padding:0}.ag-feuille,.ag-feuille.large{max-width:none;max-height:92%;border-radius:14px 14px 0 0;padding-bottom:calc(18px + env(safe-area-inset-bottom))}",
    ".ag-champ input,.ag-champ select,.ag-champ textarea,.ag-ligne-f input,.ag-ligne-f select,.ag-gros{font-size:16px}.ag-dates input[type=date]{width:140px}",
    "}"
  ].join("\n");
  document.head.appendChild(css);
})();
