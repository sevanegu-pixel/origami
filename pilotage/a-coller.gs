// Application « Pilotage du site » de la Cie Origami — fichier unique à coller dans Apps Script.
// Fabriqué par pilotage/assembler.py depuis Code.js, Reservations.js et Admin.html (dépôt GitHub origami) :
// pour changer le code, modifier ces fichiers-là puis relancer l'assemblage.

/**
 * Pilotage du site de la Cie Origami — application Google Apps Script.
 *
 * Elle vit dans une feuille Google. Menu « Site Origami » :
 *   - Récupérer l'agenda du site : remplit l'onglet « Agenda » avec les dates en ligne.
 *   - Publier l'agenda sur le site : envoie l'onglet sur GitHub (site/data/agenda.json,
 *     branche `site`) ; Netlify reconstruit alors le site tout seul.
 *   - Réservations : lien de l'appli : affiche le lien personnel de l'application de réservations
 *     (voir Reservations.js et Admin.html).
 *   - Régler l'accès GitHub : enregistre le jeton GitHub de la personne connectée
 *     (gardé dans ses propriétés personnelles, jamais dans la feuille).
 */

var CONFIG = {
  depot: 'sevanegu-pixel/origami',
  branche: 'site',
  fichierAgenda: 'site/data/agenda.json',
  onglet: 'Agenda',
  siteTest: 'https://cerulean-clafoutis-b2da15.netlify.app',
};

var COLONNES = ['Spectacle', 'Date', 'Texte affiché (facultatif)', 'Lieu'];
var MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août',
  'septembre', 'octobre', 'novembre', 'décembre'];
var CLE_JETON = 'GITHUB_TOKEN';

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Site Origami')
    .addItem("Récupérer l'agenda du site", 'recupererAgenda')
    .addItem("Publier l'agenda sur le site", 'publierAgenda')
    .addSeparator()
    .addItem("Réservations : lien de l'appli", 'lienAppli')
    .addItem('Réservations : changer la clé du lien', 'changerCleAppli')
    .addSeparator()
    .addItem('Ouvrir le site de test', 'ouvrirSiteTest')
    .addItem("Régler l'accès GitHub", 'reglerJeton')
    .addToUi();
}

// ---------- Menu ----------

function recupererAgenda() {
  var ui = SpreadsheetApp.getUi();
  var fichier = lireFichierGithub_(CONFIG.fichierAgenda);
  var agenda = JSON.parse(fichier.texte);
  var lignes = agendaVersLignes_(agenda);

  var feuille = ongletAgenda_();
  if (feuille.getLastRow() > 1) {
    var rep = ui.alert("Remplacer l'onglet Agenda ?",
      "Les lignes actuelles de l'onglet seront remplacées par l'agenda en ligne.", ui.ButtonSet.OK_CANCEL);
    if (rep !== ui.Button.OK) return;
  }
  feuille.clear();
  feuille.clearConditionalFormatRules();
  feuille.getRange(1, 1, 1, COLONNES.length).setValues([COLONNES]).setFontWeight('bold');
  feuille.setFrozenRows(1);
  if (lignes.length) feuille.getRange(2, 1, lignes.length, COLONNES.length).setValues(lignes);

  var nbLignes = Math.max(lignes.length + 50, 200);
  var titres = Object.keys(agenda.spectacles).map(function (slug) { return agenda.spectacles[slug].titre; });
  feuille.getRange(2, 1, nbLignes, 1).setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInList(titres, true).setAllowInvalid(false).build());
  feuille.getRange(2, 2, nbLignes, 1).setNumberFormat('dd.mm.yyyy').setDataValidation(
    SpreadsheetApp.newDataValidation().requireDate().setAllowInvalid(false)
      .setHelpText('Date de début (pour une tournée sur plusieurs jours, précisez dans « Texte affiché »).').build());
  feuille.setColumnWidths(1, 1, 260);
  feuille.setColumnWidth(2, 110);
  feuille.setColumnWidth(3, 200);
  feuille.setColumnWidth(4, 420);
  ui.alert('Agenda récupéré', lignes.length + ' dates chargées depuis le site.', ui.ButtonSet.OK);
}

function publierAgenda() {
  var ui = SpreadsheetApp.getUi();
  var fichier = lireFichierGithub_(CONFIG.fichierAgenda);
  var agenda = JSON.parse(fichier.texte);

  var feuille = ongletAgenda_();
  var valeurs = feuille.getLastRow() > 1
    ? feuille.getRange(2, 1, feuille.getLastRow() - 1, COLONNES.length).getValues() : [];
  var resultat = lignesVersAgenda_(valeurs, agenda, function (d) {
    return Utilities.formatDate(d, SpreadsheetApp.getActive().getSpreadsheetTimeZone(), 'yyyy-MM-dd');
  });
  if (resultat.erreurs.length) {
    ui.alert('Rien n\'a été publié', 'À corriger dans l\'onglet Agenda :\n\n' + resultat.erreurs.join('\n'), ui.ButtonSet.OK);
    return;
  }
  if (resultat.total === 0) {
    ui.alert('Rien n\'a été publié', "L'onglet Agenda est vide. Utilisez d'abord « Récupérer l'agenda du site ».", ui.ButtonSet.OK);
    return;
  }
  var nouveau = JSON.stringify(resultat.agenda, null, 2) + '\n';
  if (nouveau === fichier.texte) {
    ui.alert('Déjà à jour', "L'agenda en ligne est déjà identique à l'onglet.", ui.ButtonSet.OK);
    return;
  }
  var rep = ui.alert("Publier l'agenda ?",
    resultat.total + ' dates vont être envoyées sur le site. Il se met à jour en une ou deux minutes.',
    ui.ButtonSet.OK_CANCEL);
  if (rep !== ui.Button.OK) return;

  ecrireFichierGithub_(CONFIG.fichierAgenda, nouveau, fichier.sha,
    'Agenda mis à jour depuis la feuille Google (' + Session.getActiveUser().getEmail() + ')');
  ui.alert('Publié', 'Le site se reconstruit. Vérifiez dans une ou deux minutes : ' + CONFIG.siteTest, ui.ButtonSet.OK);
}

function ouvrirSiteTest() {
  var html = HtmlService.createHtmlOutput(
    '<p style="font-family:sans-serif"><a href="' + CONFIG.siteTest + '" target="_blank">Ouvrir le site de test</a></p>')
    .setWidth(300).setHeight(80);
  SpreadsheetApp.getUi().showModalDialog(html, 'Site Origami');
}

function reglerJeton() {
  var ui = SpreadsheetApp.getUi();
  var rep = ui.prompt("Accès GitHub",
    'Collez votre jeton GitHub (il reste privé, lié à votre compte Google). Laissez vide pour l\'effacer.',
    ui.ButtonSet.OK_CANCEL);
  if (rep.getSelectedButton() !== ui.Button.OK) return;
  var jeton = rep.getResponseText().trim();
  var props = PropertiesService.getUserProperties();
  if (!jeton) {
    props.deleteProperty(CLE_JETON);
    ui.alert('Jeton effacé.');
    return;
  }
  props.setProperty(CLE_JETON, jeton);
  try {
    lireFichierGithub_(CONFIG.fichierAgenda);
    ui.alert('C\'est bon', 'Le jeton fonctionne : la feuille peut lire et publier l\'agenda.', ui.ButtonSet.OK);
  } catch (e) {
    ui.alert('Le jeton est enregistré mais ne marche pas encore', String(e.message || e), ui.ButtonSet.OK);
  }
}

// ---------- Conversion feuille <-> agenda (sans appel Google, testable) ----------

function agendaVersLignes_(agenda) {
  var lignes = [];
  Object.keys(agenda.spectacles).forEach(function (slug) {
    var sp = agenda.spectacles[slug];
    sp.dates.forEach(function (d) {
      var p = d.date.split('-').map(Number);
      var date = new Date(p[0], p[1] - 1, p[2]);
      var texte = d.texte === texteDate_(d.date) ? '' : d.texte;
      lignes.push([sp.titre, date, texte, d.lieu]);
    });
  });
  return lignes;
}

/** Reconstruit l'agenda à partir des lignes de l'onglet. Les titres et l'ordre des spectacles viennent de l'agenda en ligne. */
function lignesVersAgenda_(valeurs, agendaEnLigne, formaterDate) {
  var parTitre = {};
  var spectacles = {};
  Object.keys(agendaEnLigne.spectacles).forEach(function (slug) {
    parTitre[agendaEnLigne.spectacles[slug].titre] = slug;
    spectacles[slug] = { titre: agendaEnLigne.spectacles[slug].titre, dates: [] };
  });
  var erreurs = [];
  var total = 0;
  valeurs.forEach(function (ligne, i) {
    var n = i + 2;
    var titre = String(ligne[0]).trim();
    var date = ligne[1];
    var texte = String(ligne[2]).trim();
    var lieu = String(ligne[3]).trim();
    if (!titre && !date && !texte && !lieu) return; // ligne vide
    var slug = parTitre[titre];
    if (!slug) { erreurs.push('Ligne ' + n + ' : spectacle inconnu « ' + titre + ' »'); return; }
    if (!(date instanceof Date) || isNaN(date)) { erreurs.push('Ligne ' + n + ' : la date manque ou n\'est pas une date'); return; }
    if (!lieu) { erreurs.push('Ligne ' + n + ' : le lieu manque'); return; }
    var iso = formaterDate(date);
    spectacles[slug].dates.push({ date: iso, texte: texte || texteDate_(iso), lieu: lieu });
    total++;
  });
  Object.keys(spectacles).forEach(function (slug) {
    spectacles[slug].dates.sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : 0; });
  });
  var agenda = {};
  Object.keys(agendaEnLigne).forEach(function (cle) { agenda[cle] = agendaEnLigne[cle]; });
  agenda.spectacles = spectacles;
  return { agenda: agenda, erreurs: erreurs, total: total };
}

/** "2026-10-17" -> "17 octobre 2026" (et "1er" pour le premier du mois). */
function texteDate_(iso) {
  var p = iso.split('-').map(Number);
  return (p[2] === 1 ? '1er' : p[2]) + ' ' + MOIS[p[1] - 1] + ' ' + p[0];
}

// ---------- GitHub ----------

function ongletAgenda_() {
  var classeur = SpreadsheetApp.getActive();
  return classeur.getSheetByName(CONFIG.onglet) || classeur.insertSheet(CONFIG.onglet, 0);
}

function jeton_() {
  var jeton = PropertiesService.getUserProperties().getProperty(CLE_JETON);
  if (!jeton) throw new Error("Pas encore d'accès GitHub : menu Site Origami > Régler l'accès GitHub.");
  return jeton;
}

function appelGithub_(methode, chemin, corps) {
  var options = {
    method: methode,
    muteHttpExceptions: true,
    headers: {
      Authorization: 'Bearer ' + jeton_(),
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  };
  if (corps) {
    options.contentType = 'application/json';
    options.payload = JSON.stringify(corps);
  }
  var rep = UrlFetchApp.fetch('https://api.github.com/repos/' + CONFIG.depot + '/contents/' + chemin, options);
  var code = rep.getResponseCode();
  if (code === 401) throw new Error('GitHub refuse le jeton (expiré ou mal copié). Refaites « Régler l\'accès GitHub ».');
  if (code === 403 || code === 404) throw new Error('GitHub ne donne pas accès à ' + chemin + ' (code ' + code + '). Le jeton doit avoir le droit « Contents : Read and write » sur le dépôt ' + CONFIG.depot + '.');
  if (code === 409) throw new Error('Le fichier a changé sur GitHub entre-temps. Récupérez l\'agenda puis recommencez.');
  if (code >= 300) throw new Error('Erreur GitHub ' + code + ' : ' + rep.getContentText().slice(0, 300));
  return JSON.parse(rep.getContentText());
}

function lireFichierGithub_(chemin) {
  var info = appelGithub_('get', chemin + '?ref=' + encodeURIComponent(CONFIG.branche));
  var octets = Utilities.base64Decode(info.content.replace(/\n/g, ''));
  return { texte: Utilities.newBlob(octets).getDataAsString('UTF-8'), sha: info.sha };
}

function ecrireFichierGithub_(chemin, texte, sha, message) {
  return appelGithub_('put', chemin, {
    message: message,
    content: Utilities.base64Encode(texte, Utilities.Charset.UTF_8),
    sha: sha,
    branch: CONFIG.branche,
  });
}

/**
 * Réservations du public — même principe que Wix Events (et que le Festival L'Escalier) :
 * des événements avec un nombre de places, un formulaire sur le site, un e-mail de confirmation.
 *
 * Données : deux onglets de la feuille Google, « Événements » et « Réservations ».
 * Application web (Déployer > Application web, exécuter en tant que moi, accès : tout le monde) :
 *   GET  ?api=evenements          -> liste publique des événements à venir (pour le site)
 *   POST {api:"reserver", ...}    -> enregistre une réservation et envoie les e-mails
 *   GET  ?cle=<clé>               -> l'application de gestion (écran Admin.html)
 * La clé est créée dans la feuille (menu Site Origami > Réservations : lien de l'appli) :
 * elle n'est écrite nulle part ailleurs.
 */

var RESA = {
  ongletEvenements: 'Événements',
  ongletReservations: 'Réservations',
  maxParReservation: 10,
  cleAdmin: 'RESA_CLE_ADMIN',
  cleReglages: 'RESA_REGLAGES',
};

var COL_EV = ['id', 'Titre', 'Spectacle', 'Date', 'Début', 'Fin', 'Lieu', 'Adresse', 'Description', 'Tarif',
  'Places', 'Statut', 'Image', 'Créé le'];
var CHAMPS_EV = ['id', 'titre', 'spectacle', 'date', 'debut', 'fin', 'lieu', 'adresse', 'description', 'tarif',
  'places', 'statut', 'image', 'cree'];
var COL_RES = ['id', 'Événement (id)', 'Événement', 'Reçue le', 'Nom', 'E-mail', 'Téléphone', 'Places', 'Message', 'Statut'];
var CHAMPS_RES = ['id', 'evenement', 'titreEvenement', 'recue', 'nom', 'email', 'telephone', 'places', 'message', 'statut'];

// Statuts d'un événement : Ouvert (réservable), Fermé (affiché, sans réservation), Brouillon (caché), Annulé (caché)
var STATUTS_EV = ['Ouvert', 'Fermé', 'Brouillon', 'Annulé'];

var REGLAGES_DEFAUT = {
  copieA: 'compagnieorigami@gmail.com',
  sujet: 'Votre réservation : {titre}',
  message: 'Bonjour {nom},\n\nNous avons bien reçu votre réservation de {places} place(s) pour « {titre} », ' +
    'le {date} à {heure}, {lieu}.\n\nLe paiement se fait sur place.\n\n' +
    'Pour annuler ou changer votre réservation, répondez simplement à cet e-mail.\n\nÀ bientôt !\nLa Compagnie Origami',
  sujetAnnulation: 'Réservation annulée : {titre}',
  messageAnnulation: 'Bonjour {nom},\n\nVotre réservation pour « {titre} » du {date} a été annulée.\n\nLa Compagnie Origami',
};

// ---------- Point d'entrée web ----------

function doGet(e) {
  var p = (e && e.parameter) || {};
  if (p.api === 'evenements') return json_({ evenements: evenementsPublics_() });
  if (p.cle && cleValide_(p.cle)) {
    var t = typeof ADMIN_HTML !== 'undefined' ? HtmlService.createTemplate(ADMIN_HTML) : HtmlService.createTemplateFromFile('Admin');
    t.cle = p.cle;
    return t.evaluate()
      .setTitle('Réservations · Cie Origami')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }
  if (!PropertiesService.getScriptProperties().getProperty(RESA.cleAdmin)) return premiereOuverture_();
  return ContentService.createTextOutput('Ouvrez le lien personnel de l\'application.');
}

/**
 * Tout premier passage sur l'adresse de l'application, juste après le déploiement : la clé est créée
 * à ce moment-là et le lien personnel s'affiche. L'adresse publique (pas la clé) est notée dans
 * l'onglet « Réglages » pour pouvoir la brancher sur le site.
 */
function premiereOuverture_() {
  var verrou = LockService.getScriptLock();
  verrou.waitLock(20000);
  try {
    var props = PropertiesService.getScriptProperties();
    if (props.getProperty(RESA.cleAdmin)) return ContentService.createTextOutput('Ouvrez le lien personnel de l\'application.');
    var cle = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '').slice(0, 16);
    props.setProperty(RESA.cleAdmin, cle);
    var url = ScriptApp.getService().getUrl();
    onglet_(RESA.ongletEvenements, COL_EV);
    onglet_(RESA.ongletReservations, COL_RES);
    var reglages = onglet_('Réglages', ['Réglage', 'Valeur']);
    reglages.appendRow(['Adresse de l\'application (pour le site)', url]);
    var lien = url + '?cle=' + cle;
    return HtmlService.createHtmlOutput(
      '<div style="font:17px/1.5 sans-serif;max-width:560px;margin:40px auto;padding:0 16px;color:#111">' +
      '<h1 style="font-size:24px">C\'est installé !</h1>' +
      '<p>Voici <b>votre lien personnel</b> vers l\'application. Il ouvre la gestion sans mot de passe : ' +
      'ajoutez-le à vos favoris et ne le partagez pas.</p>' +
      '<p><a href="' + lien + '" target="_top" style="display:inline-block;background:#9781ff;color:#0b0a10;' +
      'padding:12px 22px;border-radius:999px;font-weight:600;text-decoration:none">Ouvrir l\'application</a></p>' +
      '<p style="font-size:14px;color:#555">Le lien :<br><input readonly style="width:100%" value="' + lien + '" onclick="this.select()"></p>' +
      '<p style="font-size:14px;color:#555">Ce lien ne s\'affiche qu\'une fois. Si vous le perdez : dans la feuille, ' +
      'menu Site Origami &gt; Réservations : lien de l\'appli.</p></div>')
      .setTitle('Réservations · Cie Origami');
  } finally {
    verrou.releaseLock();
  }
}

function doPost(e) {
  var donnees;
  try {
    donnees = JSON.parse(e.postData.contents);
  } catch (err) {
    return json_({ ok: false, erreur: 'Demande illisible.' });
  }
  if (donnees.api === 'reserver') return json_(reserver_(donnees));
  return json_({ ok: false, erreur: 'Demande inconnue.' });
}

function json_(objet) {
  return ContentService.createTextOutput(JSON.stringify(objet)).setMimeType(ContentService.MimeType.JSON);
}

// ---------- Côté public ----------

function evenementsPublics_() {
  var aujourdhui = Utilities.formatDate(new Date(), 'Europe/Zurich', 'yyyy-MM-dd');
  var pris = placesPrises_();
  return lireEvenements_()
    .filter(function (ev) { return (ev.statut === 'Ouvert' || ev.statut === 'Fermé') && ev.date >= aujourdhui; })
    .map(function (ev) { return versPublic_(ev, pris[ev.id] || 0); })
    .sort(function (a, b) { return (a.date + a.debut) < (b.date + b.debut) ? -1 : 1; });
}

function versPublic_(ev, prises) {
  var places = Number(ev.places) || 0;
  return {
    id: ev.id, titre: ev.titre, spectacle: ev.spectacle, date: ev.date, debut: ev.debut, fin: ev.fin,
    lieu: ev.lieu, adresse: ev.adresse, description: ev.description, tarif: ev.tarif, image: ev.image,
    reservable: ev.statut === 'Ouvert' && (places === 0 || prises < places),
    complet: places > 0 && prises >= places,
    restantes: places > 0 ? Math.max(0, places - prises) : null,
  };
}

/** Vérifie et enregistre une réservation. Renvoie {ok, ...} ou {ok:false, erreur}. */
function reserver_(d) {
  if (d.site) return { ok: true }; // champ piège à robots rempli : on fait semblant
  var nom = String(d.nom || '').trim().slice(0, 120);
  var email = String(d.email || '').trim().slice(0, 200);
  var telephone = String(d.telephone || '').trim().slice(0, 40);
  var message = String(d.message || '').trim().slice(0, 1000);
  var places = Math.floor(Number(d.places));
  if (!nom) return { ok: false, erreur: 'Indiquez votre nom.' };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, erreur: 'L\'adresse e-mail ne semble pas correcte.' };
  if (!(places >= 1 && places <= RESA.maxParReservation)) {
    return { ok: false, erreur: 'Choisissez entre 1 et ' + RESA.maxParReservation + ' places.' };
  }

  var verrou = LockService.getScriptLock();
  verrou.waitLock(20000);
  try {
    var ev = lireEvenements_().filter(function (x) { return x.id === d.evenement; })[0];
    if (!ev || ev.statut !== 'Ouvert') return { ok: false, erreur: 'Cet événement n\'est pas ouvert à la réservation.' };
    var max = Number(ev.places) || 0;
    var prises = placesPrises_()[ev.id] || 0;
    if (max > 0 && prises + places > max) {
      var reste = Math.max(0, max - prises);
      return { ok: false, erreur: reste ? 'Il ne reste que ' + reste + ' place(s).' : 'Désolé, c\'est complet.', restantes: reste };
    }
    var resa = {
      id: nouvelId_('R'), evenement: ev.id, titreEvenement: ev.titre, recue: maintenant_(),
      nom: nom, email: email, telephone: telephone, places: places, message: message, statut: 'Confirmée',
    };
    ajouterLigne_(onglet_(RESA.ongletReservations, COL_RES), CHAMPS_RES, resa);
    SpreadsheetApp.flush();
  } finally {
    verrou.releaseLock();
  }
  var mailEnvoye = true;
  try {
    envoyerConfirmation_(ev, resa);
  } catch (err) { // quota d'e-mails dépassé… la réservation est quand même enregistrée
    mailEnvoye = false;
    console.error('E-mail non envoyé pour ' + resa.id + ' : ' + err);
  }
  return { ok: true, id: resa.id, mailEnvoye: mailEnvoye, restantes: max > 0 ? max - prises - places : null };
}

// ---------- E-mails ----------

function envoyerConfirmation_(ev, resa) {
  var r = reglages_();
  var valeurs = valeursMail_(ev, resa);
  var texte = remplir_(r.message, valeurs);
  MailApp.sendEmail({
    to: resa.email,
    subject: remplir_(r.sujet, valeurs),
    body: texte,
    htmlBody: texteVersHtml_(texte),
    name: 'Compagnie Origami',
    replyTo: r.copieA || undefined,
  });
  if (r.copieA) {
    MailApp.sendEmail({
      to: r.copieA,
      subject: 'Nouvelle réservation : ' + ev.titre + ' (' + resa.places + ' pl.)',
      body: resa.nom + ' · ' + resa.email + (resa.telephone ? ' · ' + resa.telephone : '') + '\n' +
        resa.places + ' place(s) pour « ' + ev.titre + ' », ' + valeurs.date + ' à ' + valeurs.heure + '\n' +
        (resa.message ? '\nMessage : ' + resa.message + '\n' : ''),
      name: 'Réservations Origami',
      replyTo: resa.email,
    });
  }
}

function envoyerAnnulation_(ev, resa) {
  var r = reglages_();
  var valeurs = valeursMail_(ev, resa);
  var texte = remplir_(r.messageAnnulation, valeurs);
  MailApp.sendEmail({
    to: resa.email, subject: remplir_(r.sujetAnnulation, valeurs), body: texte, htmlBody: texteVersHtml_(texte),
    name: 'Compagnie Origami', replyTo: r.copieA || undefined,
  });
}

function valeursMail_(ev, resa) {
  return {
    nom: resa.nom, places: resa.places, titre: ev.titre, date: dateLongue_(ev.date),
    heure: ev.debut || '', lieu: [ev.lieu, ev.adresse].filter(String).join(', '), tarif: ev.tarif || '',
  };
}

function remplir_(modele, valeurs) {
  return String(modele).replace(/\{(\w+)\}/g, function (tout, cle) { return cle in valeurs ? valeurs[cle] : tout; });
}

function texteVersHtml_(texte) {
  var sur = texte.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return '<div style="font-family:Georgia,serif;font-size:16px;line-height:1.5;color:#111">' +
    sur.split(/\n\n+/).map(function (p) { return '<p>' + p.replace(/\n/g, '<br>') + '</p>'; }).join('') + '</div>';
}

function dateLongue_(iso) {
  if (!iso) return '';
  var jours = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
  var p = iso.split('-').map(Number);
  var j = new Date(Date.UTC(p[0], p[1] - 1, p[2])).getUTCDay();
  return jours[j] + ' ' + texteDate_(iso);
}

// ---------- Application de gestion (appelée par Admin.html) ----------

function adminCharger(cle) {
  verifierCle_(cle);
  var pris = placesPrises_();
  return {
    evenements: lireEvenements_().map(function (ev) {
      ev.prises = pris[ev.id] || 0;
      return ev;
    }),
    reservations: lireReservations_(),
    reglages: reglages_(),
    spectacles: titresSpectacles_(),
    statuts: STATUTS_EV,
  };
}

function adminEnregistrerEvenement(cle, ev) {
  verifierCle_(cle);
  if (!String(ev.titre || '').trim()) throw new Error('Le titre manque.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ev.date || '')) throw new Error('La date manque.');
  if (STATUTS_EV.indexOf(ev.statut) < 0) ev.statut = 'Brouillon';
  ev.places = Math.max(0, Math.floor(Number(ev.places) || 0));
  var feuille = onglet_(RESA.ongletEvenements, COL_EV);
  var verrou = LockService.getScriptLock();
  verrou.waitLock(20000);
  try {
    if (ev.id) {
      var n = ligneDe_(feuille, ev.id);
      if (!n) throw new Error('Événement introuvable.');
      var ancien = objetDeLigne_(feuille.getRange(n, 1, 1, COL_EV.length).getValues()[0], CHAMPS_EV);
      ev.cree = ancien.cree;
      ecrireLigne_(feuille, n, CHAMPS_EV, ev);
    } else {
      ev.id = nouvelId_('E');
      ev.cree = maintenant_();
      ajouterLigne_(feuille, CHAMPS_EV, ev);
    }
  } finally {
    verrou.releaseLock();
  }
  return adminCharger(cle);
}

function adminSupprimerEvenement(cle, id) {
  verifierCle_(cle);
  var actives = lireReservations_().filter(function (r) { return r.evenement === id && r.statut !== 'Annulée'; });
  if (actives.length) throw new Error('Il y a ' + actives.length + ' réservation(s) : passez plutôt l\'événement en « Annulé ».');
  var feuille = onglet_(RESA.ongletEvenements, COL_EV);
  var n = ligneDe_(feuille, id);
  if (n) feuille.deleteRow(n);
  return adminCharger(cle);
}

/** Réservation ajoutée à la main (par téléphone…). Pas de limite de places, e-mail seulement si demandé. */
function adminAjouterReservation(cle, d) {
  verifierCle_(cle);
  var ev = lireEvenements_().filter(function (x) { return x.id === d.evenement; })[0];
  if (!ev) throw new Error('Événement introuvable.');
  if (!String(d.nom || '').trim()) throw new Error('Le nom manque.');
  var resa = {
    id: nouvelId_('R'), evenement: ev.id, titreEvenement: ev.titre, recue: maintenant_(),
    nom: String(d.nom).trim(), email: String(d.email || '').trim(), telephone: String(d.telephone || '').trim(),
    places: Math.max(1, Math.floor(Number(d.places) || 1)), message: String(d.message || '').trim(), statut: 'Confirmée',
  };
  ajouterLigne_(onglet_(RESA.ongletReservations, COL_RES), CHAMPS_RES, resa);
  if (d.envoyerMail && resa.email) envoyerConfirmation_(ev, resa);
  return adminCharger(cle);
}

function adminAnnulerReservation(cle, id, prevenir) {
  verifierCle_(cle);
  var feuille = onglet_(RESA.ongletReservations, COL_RES);
  var n = ligneDe_(feuille, id);
  if (!n) throw new Error('Réservation introuvable.');
  var resa = objetDeLigne_(feuille.getRange(n, 1, 1, COL_RES.length).getValues()[0], CHAMPS_RES);
  feuille.getRange(n, CHAMPS_RES.indexOf('statut') + 1).setValue('Annulée');
  var ev = lireEvenements_().filter(function (x) { return x.id === resa.evenement; })[0];
  if (prevenir && ev && resa.email) envoyerAnnulation_(ev, resa);
  return adminCharger(cle);
}

function adminEnregistrerReglages(cle, r) {
  verifierCle_(cle);
  var propre = {};
  Object.keys(REGLAGES_DEFAUT).forEach(function (k) { propre[k] = String(r[k] == null ? REGLAGES_DEFAUT[k] : r[k]); });
  PropertiesService.getScriptProperties().setProperty(RESA.cleReglages, JSON.stringify(propre));
  return adminCharger(cle);
}

function adminEssaiMail(cle) {
  verifierCle_(cle);
  var r = reglages_();
  if (!r.copieA) throw new Error('Indiquez d\'abord l\'adresse qui reçoit les copies.');
  var ev = { titre: 'Événement d\'essai', date: Utilities.formatDate(new Date(), 'Europe/Zurich', 'yyyy-MM-dd'),
    debut: '20:00', lieu: 'Théâtricul', adresse: 'Chêne-Bourg', tarif: '' };
  var resa = { nom: 'Prénom Nom', email: r.copieA, places: 2 };
  var v = valeursMail_(ev, resa);
  MailApp.sendEmail({ to: r.copieA, subject: '[Essai] ' + remplir_(r.sujet, v), body: remplir_(r.message, v),
    htmlBody: texteVersHtml_(remplir_(r.message, v)), name: 'Compagnie Origami' });
  return 'E-mail d\'essai envoyé à ' + r.copieA;
}

// ---------- Clé de l'application ----------

/** Menu de la feuille : crée la clé si besoin et affiche le lien personnel de l'application. */
function lienAppli() {
  var ui = SpreadsheetApp.getUi();
  var url = ScriptApp.getService().getUrl();
  if (!url) {
    ui.alert('Application pas encore déployée',
      'Dans Extensions > Apps Script : Déployer > Nouveau déploiement > Application web ' +
      '(Exécuter en tant que : moi ; Accès : tout le monde). Puis revenez ici.', ui.ButtonSet.OK);
    return;
  }
  var props = PropertiesService.getScriptProperties();
  var cle = props.getProperty(RESA.cleAdmin);
  if (!cle) {
    cle = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '').slice(0, 16);
    props.setProperty(RESA.cleAdmin, cle);
  }
  onglet_(RESA.ongletEvenements, COL_EV);
  onglet_(RESA.ongletReservations, COL_RES);
  var lien = url + '?cle=' + cle;
  var html = HtmlService.createHtmlOutput(
    '<div style="font-family:sans-serif;font-size:14px">' +
    '<p><b>Adresse pour le site</b> (à donner à Claude, elle n\'est pas secrète) :</p>' +
    '<input style="width:100%" readonly value="' + url + '" onclick="this.select()">' +
    '<p><b>Votre lien personnel vers l\'application</b> (ne le partagez pas : il ouvre la gestion sans mot de passe) :</p>' +
    '<input style="width:100%" readonly value="' + lien + '" onclick="this.select()">' +
    '<p><a href="' + lien + '" target="_blank">Ouvrir l\'application</a></p></div>')
    .setWidth(520).setHeight(260);
  ui.showModalDialog(html, 'Réservations');
}

/** Menu de la feuille : remplace la clé (l'ancien lien personnel ne marche plus). */
function changerCleAppli() {
  var ui = SpreadsheetApp.getUi();
  if (ui.alert('Changer la clé ?', 'L\'ancien lien personnel ne marchera plus.', ui.ButtonSet.OK_CANCEL) !== ui.Button.OK) return;
  PropertiesService.getScriptProperties().deleteProperty(RESA.cleAdmin);
  lienAppli();
}

function cleValide_(cle) {
  var vraie = PropertiesService.getScriptProperties().getProperty(RESA.cleAdmin);
  return !!vraie && typeof cle === 'string' && cle === vraie;
}

function verifierCle_(cle) {
  if (!cleValide_(cle)) throw new Error('Lien de l\'application invalide ou remplacé.');
}

// ---------- Lecture / écriture des onglets ----------

function lireEvenements_() {
  var f = onglet_(RESA.ongletEvenements, COL_EV);
  if (f.getLastRow() < 2) return [];
  return f.getRange(2, 1, f.getLastRow() - 1, COL_EV.length).getDisplayValues()
    .map(function (l) { return objetDeLigne_(l, CHAMPS_EV); })
    .filter(function (ev) { return ev.id; });
}

function lireReservations_() {
  var f = onglet_(RESA.ongletReservations, COL_RES);
  if (f.getLastRow() < 2) return [];
  return f.getRange(2, 1, f.getLastRow() - 1, COL_RES.length).getDisplayValues()
    .map(function (l) {
      var r = objetDeLigne_(l, CHAMPS_RES);
      r.places = Number(r.places) || 0;
      return r;
    })
    .filter(function (r) { return r.id; });
}

/** Places réservées (non annulées) par événement. */
function placesPrises_() {
  var pris = {};
  lireReservations_().forEach(function (r) {
    if (r.statut !== 'Annulée') pris[r.evenement] = (pris[r.evenement] || 0) + r.places;
  });
  return pris;
}

function titresSpectacles_() {
  return SPECTACLES_SITE;
}

// Titres proposés dans l'application (on peut aussi écrire autre chose)
var SPECTACLES_SITE = ['Comme un point désarticulé', 'La Petite Fille dans la poubelle', 'Le Cabaret Origamique',
  "L'Équilibre de mon déséquilibre", "Oups, j'ai percuté une vache !", 'Des pâtes au seum', 'La Vouivre',
  'Le Petit Cirque des contes'];

function onglet_(nom, colonnes) {
  var classeur = SpreadsheetApp.getActive();
  var f = classeur.getSheetByName(nom);
  if (!f) {
    f = classeur.insertSheet(nom);
    f.getRange(1, 1, 1, colonnes.length).setValues([colonnes]).setFontWeight('bold');
    f.setFrozenRows(1);
    f.getRange('A:Z').setNumberFormat('@'); // tout en texte : pas de date ou d'heure transformée par la feuille
  }
  return f;
}

function objetDeLigne_(ligne, champs) {
  var o = {};
  champs.forEach(function (c, i) { o[c] = ligne[i] === undefined ? '' : String(ligne[i]); });
  return o;
}

function ligneDe_(feuille, id) {
  if (feuille.getLastRow() < 2) return 0;
  var ids = feuille.getRange(2, 1, feuille.getLastRow() - 1, 1).getDisplayValues();
  for (var i = 0; i < ids.length; i++) if (ids[i][0] === id) return i + 2;
  return 0;
}

function ajouterLigne_(feuille, champs, objet) {
  feuille.appendRow(versLigne_(champs, objet));
}

function ecrireLigne_(feuille, n, champs, objet) {
  feuille.getRange(n, 1, 1, champs.length).setValues([versLigne_(champs, objet)]);
}

/** Valeurs à écrire, en texte. Un texte qui commence par = + - @ (« +41… ») est protégé par une apostrophe
 *  pour que la feuille ne le prenne jamais pour une formule (le formulaire est public). */
function versLigne_(champs, objet) {
  return champs.map(function (c) {
    var v = objet[c] == null ? '' : String(objet[c]);
    return /^[=+\-@]/.test(v) ? "'" + v : v;
  });
}

function nouvelId_(prefixe) {
  return prefixe + Utilities.getUuid().replace(/-/g, '').slice(0, 10);
}

function maintenant_() {
  return Utilities.formatDate(new Date(), 'Europe/Zurich', 'yyyy-MM-dd HH:mm');
}

function reglages_() {
  var brut = PropertiesService.getScriptProperties().getProperty(RESA.cleReglages);
  var r = {};
  var lu = brut ? JSON.parse(brut) : {};
  Object.keys(REGLAGES_DEFAUT).forEach(function (k) { r[k] = k in lu ? lu[k] : REGLAGES_DEFAUT[k]; });
  return r;
}

var ADMIN_HTML = "<!doctype html>\n<html lang=\"fr\">\n<head>\n<base target=\"_top\">\n<meta charset=\"utf-8\">\n<link rel=\"preconnect\" href=\"https://fonts.googleapis.com\">\n<link href=\"https://fonts.googleapis.com/css2?family=Bodoni+Moda:wght@500;700&family=Barlow:wght@400;500;600&display=swap\" rel=\"stylesheet\">\n<style>\n:root{--fond:#0b0a10;--carte:#17141f;--ligne:#2c2640;--texte:#f4f1ff;--doux:#b9aee6;--lav:#9781ff;--lav2:#c9bdff;--rouge:#ff7a8a;--vert:#7ee0b0}\n*{box-sizing:border-box}\nhtml,body{margin:0;background:var(--fond);color:var(--texte);font:16px/1.45 Barlow,system-ui,sans-serif}\nheader{position:sticky;top:0;z-index:5;background:var(--fond);border-bottom:1px solid var(--ligne);padding:12px 16px;display:flex;gap:12px;align-items:center;flex-wrap:wrap}\nh1{font:700 22px/1.1 \"Bodoni Moda\",serif;margin:0;flex:1;min-width:180px}\nh1 small{display:block;font:500 13px Barlow,sans-serif;color:var(--doux);letter-spacing:.04em;text-transform:uppercase}\nh2{font:700 20px \"Bodoni Moda\",serif;margin:24px 0 10px}\nnav button,.btn{font:600 15px Barlow,sans-serif;border:1px solid var(--lav);background:transparent;color:var(--lav2);border-radius:999px;padding:8px 14px;cursor:pointer}\nnav button.on,.btn.plein{background:var(--lav);color:#0b0a10;border-color:var(--lav)}\n.btn.petit{padding:4px 10px;font-size:13px}\n.btn.danger{border-color:var(--rouge);color:var(--rouge)}\n.btn:disabled{opacity:.5;cursor:default}\nmain{max-width:980px;margin:0 auto;padding:8px 16px 80px}\n.liste{display:grid;gap:10px}\n.ev{display:grid;grid-template-columns:64px 1fr auto;gap:14px;align-items:center;background:var(--carte);border:1px solid var(--ligne);border-radius:10px;padding:12px;cursor:pointer;text-align:left;color:inherit;font:inherit;width:100%}\n.ev:hover{border-color:var(--lav)}\n.jour{text-align:center;border-right:1px solid var(--ligne);padding-right:10px}\n.jour b{display:block;font:700 26px/1 \"Bodoni Moda\",serif}\n.jour span{font-size:12px;text-transform:uppercase;color:var(--doux)}\n.ev h3{margin:0 0 2px;font-size:17px}\n.ev p{margin:0;color:var(--doux);font-size:14px}\n.jauge{min-width:92px;text-align:right;font-size:14px}\n.jauge .barre{height:5px;background:var(--ligne);border-radius:3px;margin-top:5px;overflow:hidden}\n.jauge .barre i{display:block;height:100%;background:var(--lav)}\n.badge{display:inline-block;font-size:12px;border-radius:999px;padding:1px 8px;margin-left:6px;border:1px solid var(--ligne);color:var(--doux);vertical-align:2px}\n.badge.Ouvert{border-color:var(--vert);color:var(--vert)}\n.badge.Annulé{border-color:var(--rouge);color:var(--rouge)}\n.vide{color:var(--doux);font-style:italic}\nform .grille{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px}\nlabel{display:block;font-size:13px;color:var(--doux);margin-bottom:4px}\ninput,select,textarea{width:100%;font:inherit;color:var(--texte);background:#100e17;border:1px solid var(--ligne);border-radius:8px;padding:9px 10px}\ninput:focus,select:focus,textarea:focus{outline:2px solid var(--lav);border-color:var(--lav)}\ntextarea{min-height:110px;resize:vertical}\n.large{grid-column:1/-1}\n.actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:16px}\n.panneau{background:var(--carte);border:1px solid var(--ligne);border-radius:12px;padding:16px;margin-top:12px}\ntable{width:100%;border-collapse:collapse;font-size:14px}\nth,td{text-align:left;padding:8px 6px;border-bottom:1px solid var(--ligne);vertical-align:top}\nth{color:var(--doux);font-weight:500}\ntr.annulee td{opacity:.45;text-decoration:line-through}\ntr.annulee td:last-child{text-decoration:none}\n.tableau{overflow-x:auto}\n.aide{font-size:13px;color:var(--doux);margin:4px 0 0}\n#toast{position:fixed;left:50%;bottom:20px;transform:translateX(-50%);background:var(--lav);color:#0b0a10;font-weight:600;padding:10px 16px;border-radius:999px;display:none;z-index:20;max-width:92vw}\n#toast.erreur{background:var(--rouge)}\n#charge{position:fixed;top:0;left:0;height:3px;width:100%;background:var(--lav);display:none;z-index:30;animation:c 1s infinite linear}\n@keyframes c{0%{opacity:.3}50%{opacity:1}100%{opacity:.3}}\n@media (max-width:560px){.ev{grid-template-columns:52px 1fr}.jauge{grid-column:2;text-align:left}.jauge .barre{width:120px}}\n</style>\n</head>\n<body>\n<div id=\"charge\"></div>\n<header>\n  <h1><small>Cie Origami</small>Réservations</h1>\n  <nav><button data-vue=\"evenements\" class=\"on\">Événements</button> <button data-vue=\"reglages\">E-mails</button></nav>\n</header>\n<main id=\"vue\"><p class=\"vide\">Chargement…</p></main>\n<div id=\"toast\"></div>\n\n<script>\nvar CLE = <?!= JSON.stringify(cle) ?>;\nvar D = null, vue = 'evenements', ouvert = null;\nvar MOIS = ['janv.','févr.','mars','avr.','mai','juin','juil.','août','sept.','oct.','nov.','déc.'];\n\nfunction $(s, r) { return (r || document).querySelector(s); }\nfunction esc(t) { return String(t == null ? '' : t).replace(/[&<>\"']/g, function (c) { return {'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',\"'\":'&#39;'}[c]; }); }\nfunction toast(t, err) { var b = $('#toast'); b.textContent = t; b.className = err ? 'erreur' : ''; b.style.display = 'block'; clearTimeout(toast.t); toast.t = setTimeout(function () { b.style.display = 'none'; }, err ? 6000 : 2500); }\nfunction aujourdhui() { var d = new Date(); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }\n\nfunction appel(fn, args, ok) {\n  $('#charge').style.display = 'block';\n  var r = google.script.run.withSuccessHandler(function (res) { $('#charge').style.display = 'none'; ok(res); })\n    .withFailureHandler(function (e) { $('#charge').style.display = 'none'; toast(e.message || String(e), true); });\n  r[fn].apply(r, [CLE].concat(args || []));\n}\nfunction recharger(res) { D = res; afficher(); }\n\ndocument.querySelectorAll('nav button').forEach(function (b) {\n  b.onclick = function () { vue = b.dataset.vue; ouvert = null; document.querySelectorAll('nav button').forEach(function (x) { x.classList.toggle('on', x === b); }); afficher(); };\n});\n\nfunction afficher() {\n  if (!D) return;\n  if (vue === 'reglages') return afficherReglages();\n  if (ouvert) return afficherEvenement(ouvert);\n  var today = aujourdhui();\n  var evs = D.evenements.slice().sort(function (a, b) { return (a.date + a.debut) < (b.date + b.debut) ? -1 : 1; });\n  var avenir = evs.filter(function (e) { return e.date >= today; });\n  var passes = evs.filter(function (e) { return e.date < today; }).reverse();\n  var h = '<div class=\"actions\"><button class=\"btn plein\" id=\"nouveau\">+ Nouvel événement</button></div>';\n  h += '<h2>À venir</h2>' + liste(avenir) + '<h2>Passés</h2>' + liste(passes);\n  $('#vue').innerHTML = h;\n  $('#nouveau').onclick = function () { ouvert = 'nouveau'; afficher(); };\n  document.querySelectorAll('.ev').forEach(function (b) { b.onclick = function () { ouvert = b.dataset.id; afficher(); scrollTo(0, 0); }; });\n}\n\nfunction liste(evs) {\n  if (!evs.length) return '<p class=\"vide\">Aucun événement.</p>';\n  return '<div class=\"liste\">' + evs.map(function (e) {\n    var p = e.date.split('-'), places = Number(e.places) || 0;\n    var pc = places ? Math.min(100, Math.round(100 * e.prises / places)) : 0;\n    return '<button class=\"ev\" data-id=\"' + esc(e.id) + '\"><div class=\"jour\"><b>' + Number(p[2]) + '</b><span>' + MOIS[Number(p[1]) - 1] + ' ' + p[0] + '</span></div>' +\n      '<div><h3>' + esc(e.titre) + '<span class=\"badge ' + esc(e.statut) + '\">' + esc(e.statut) + '</span></h3>' +\n      '<p>' + esc([e.debut && (e.debut + (e.fin ? '–' + e.fin : '')), e.lieu].filter(Boolean).join(' · ')) + '</p></div>' +\n      '<div class=\"jauge\">' + e.prises + (places ? ' / ' + places : '') + ' place' + (e.prises > 1 || places > 1 ? 's' : '') +\n      (places ? '<div class=\"barre\"><i style=\"width:' + pc + '%\"></i></div>' : '') + '</div></button>';\n  }).join('') + '</div>';\n}\n\nfunction champ(nom, label, val, type, attrs) {\n  return '<div' + (type === 'textarea' ? ' class=\"large\"' : '') + '><label for=\"f-' + nom + '\">' + label + '</label>' +\n    (type === 'textarea' ? '<textarea id=\"f-' + nom + '\" name=\"' + nom + '\">' + esc(val) + '</textarea>'\n      : '<input id=\"f-' + nom + '\" name=\"' + nom + '\" type=\"' + (type || 'text') + '\" value=\"' + esc(val) + '\" ' + (attrs || '') + '>') + '</div>';\n}\n\nfunction afficherEvenement(id) {\n  var nouveau = id === 'nouveau' || id === 'copie';\n  var e = id === 'nouveau' ? { statut: 'Ouvert', places: '' } : (id === 'copie' ? afficherEvenement.copie : D.evenements.filter(function (x) { return x.id === id; })[0]);\n  if (!e) { ouvert = null; return afficher(); }\n  var h = '<div class=\"actions\"><button class=\"btn\" id=\"retour\">← Tous les événements</button></div>';\n  h += '<h2>' + (nouveau ? 'Nouvel événement' : esc(e.titre)) + '</h2>';\n  h += '<form id=\"form\" class=\"panneau\"><div class=\"grille\">' +\n    champ('titre', 'Titre affiché', e.titre, 'text', 'required list=\"spectacles\"') +\n    '<datalist id=\"spectacles\">' + D.spectacles.map(function (s) { return '<option value=\"' + esc(s) + '\">'; }).join('') + '</datalist>' +\n    '<div><label for=\"f-spectacle\">Spectacle</label><select id=\"f-spectacle\" name=\"spectacle\"><option value=\"\">Autre / aucun</option>' +\n      D.spectacles.map(function (s) { return '<option' + (s === e.spectacle ? ' selected' : '') + '>' + esc(s) + '</option>'; }).join('') + '</select></div>' +\n    champ('date', 'Date', e.date, 'date', 'required') +\n    champ('debut', 'Début', e.debut, 'time') +\n    champ('fin', 'Fin', e.fin, 'time') +\n    champ('lieu', 'Lieu', e.lieu) +\n    champ('adresse', 'Adresse', e.adresse) +\n    champ('tarif', 'Tarif (texte)', e.tarif, 'text', 'placeholder=\"Prix libre, paiement sur place\"') +\n    champ('places', 'Nombre de places (vide = illimité)', e.places, 'number', 'min=\"0\"') +\n    '<div><label for=\"f-statut\">Statut</label><select id=\"f-statut\" name=\"statut\">' +\n      D.statuts.map(function (s) { return '<option' + (s === e.statut ? ' selected' : '') + '>' + s + '</option>'; }).join('') + '</select>' +\n      '<p class=\"aide\">Ouvert : réservable. Fermé : affiché sans réservation. Brouillon et Annulé : cachés du site.</p></div>' +\n    champ('image', 'Image (adresse, facultatif)', e.image) +\n    champ('description', 'Description', e.description, 'textarea') +\n    '</div><div class=\"actions\"><button class=\"btn plein\" type=\"submit\">Enregistrer</button>' +\n    (nouveau ? '' : '<button class=\"btn\" type=\"button\" id=\"dupliquer\">Dupliquer (autre date)</button><button class=\"btn danger\" type=\"button\" id=\"supprimer\">Supprimer</button>') +\n    '</div></form>';\n\n  if (!nouveau) {\n    var resas = D.reservations.filter(function (r) { return r.evenement === e.id; });\n    var actives = resas.filter(function (r) { return r.statut !== 'Annulée'; });\n    var total = actives.reduce(function (s, r) { return s + r.places; }, 0);\n    h += '<h2>Réservations · ' + total + (Number(e.places) ? ' / ' + e.places : '') + ' places</h2><div class=\"panneau\">';\n    if (!resas.length) h += '<p class=\"vide\">Pas encore de réservation.</p>';\n    else h += '<div class=\"tableau\"><table><tr><th>Nom</th><th>Places</th><th>Contact</th><th>Message</th><th>Reçue</th><th></th></tr>' +\n      resas.map(function (r) {\n        return '<tr class=\"' + (r.statut === 'Annulée' ? 'annulee' : '') + '\"><td>' + esc(r.nom) + '</td><td>' + r.places + '</td><td>' +\n          (r.email ? '<a style=\"color:var(--lav2)\" href=\"mailto:' + esc(r.email) + '\">' + esc(r.email) + '</a>' : '') + (r.telephone ? '<br>' + esc(r.telephone) : '') +\n          '</td><td>' + esc(r.message) + '</td><td>' + esc(r.recue) + '</td><td>' +\n          (r.statut === 'Annulée' ? 'Annulée' : '<button class=\"btn petit danger\" data-annuler=\"' + esc(r.id) + '\">Annuler</button>') + '</td></tr>';\n      }).join('') + '</table></div>';\n    h += '<div class=\"actions\">' + (actives.length ? '<button class=\"btn\" id=\"copier\">Copier les e-mails</button>' : '') + '</div>';\n    h += '<h2>Ajouter une réservation à la main</h2><form id=\"ajout\"><div class=\"grille\">' +\n      (champ('nom', 'Nom', '', 'text', 'required') + champ('email', 'E-mail', '', 'email') + champ('telephone', 'Téléphone', '') +\n      champ('places', 'Places', '1', 'number', 'min=\"1\"')).replace(/(id|for)=\"f-/g, '$1=\"a-') +\n      '<div><label><input type=\"checkbox\" name=\"envoyerMail\" style=\"width:auto\"> envoyer l\\'e-mail de confirmation</label></div>' +\n      '</div><div class=\"actions\"><button class=\"btn plein\" type=\"submit\">Ajouter</button></div></form></div>';\n  }\n  $('#vue').innerHTML = h;\n  $('#retour').onclick = function () { ouvert = null; afficher(); };\n  $('#form').onsubmit = function (ev) {\n    ev.preventDefault();\n    var o = { id: nouveau ? '' : e.id };\n    new FormData(ev.target).forEach(function (v, k) { o[k] = v; });\n    appel('adminEnregistrerEvenement', [o], function (res) { recharger(res); ouvert = null; afficher(); toast('Enregistré'); });\n  };\n  if (nouveau) return;\n  $('#dupliquer').onclick = function () {\n    var c = {}; Object.keys(e).forEach(function (k) { c[k] = e[k]; }); c.id = ''; c.date = '';\n    afficherEvenement.copie = c; ouvert = 'copie'; afficher(); toast('Copie : choisissez la nouvelle date');\n  };\n  $('#supprimer').onclick = function () {\n    if (!confirm('Supprimer « ' + e.titre + ' » ?')) return;\n    appel('adminSupprimerEvenement', [e.id], function (res) { ouvert = null; recharger(res); toast('Supprimé'); });\n  };\n  document.querySelectorAll('[data-annuler]').forEach(function (b) {\n    b.onclick = function () {\n      if (!confirm('Annuler cette réservation ?')) return;\n      var prevenir = confirm('Prévenir la personne par e-mail ?');\n      appel('adminAnnulerReservation', [b.dataset.annuler, prevenir], function (res) { recharger(res); toast('Réservation annulée'); });\n    };\n  });\n  var cp = $('#copier');\n  if (cp) cp.onclick = function () {\n    var mails = actives.map(function (r) { return r.email; }).filter(Boolean).join(', ');\n    (navigator.clipboard ? navigator.clipboard.writeText(mails) : Promise.reject()).then(function () { toast('E-mails copiés'); }, function () { prompt('E-mails :', mails); });\n  };\n  $('#ajout').onsubmit = function (ev) {\n    ev.preventDefault();\n    var o = { evenement: e.id };\n    new FormData(ev.target).forEach(function (v, k) { o[k] = v; });\n    o.envoyerMail = !!o.envoyerMail;\n    appel('adminAjouterReservation', [o], function (res) { recharger(res); toast('Réservation ajoutée'); });\n  };\n}\n\nfunction afficherReglages() {\n  var r = D.reglages;\n  var h = '<h2>E-mails automatiques</h2><form id=\"regl\" class=\"panneau\"><div class=\"grille\">' +\n    champ('copieA', 'Adresse qui reçoit une copie de chaque réservation', r.copieA, 'email') +\n    champ('sujet', 'Sujet de la confirmation', r.sujet) +\n    champ('message', 'Message de confirmation', r.message, 'textarea') +\n    champ('sujetAnnulation', 'Sujet de l\\'annulation', r.sujetAnnulation) +\n    champ('messageAnnulation', 'Message d\\'annulation', r.messageAnnulation, 'textarea') +\n    '</div><p class=\"aide\">Remplacés automatiquement : {nom} {places} {titre} {date} {heure} {lieu} {tarif}</p>' +\n    '<div class=\"actions\"><button class=\"btn plein\" type=\"submit\">Enregistrer</button><button class=\"btn\" type=\"button\" id=\"essai\">M\\'envoyer un essai</button></div></form>';\n  $('#vue').innerHTML = h;\n  $('#regl').onsubmit = function (ev) {\n    ev.preventDefault();\n    var o = {}; new FormData(ev.target).forEach(function (v, k) { o[k] = v; });\n    appel('adminEnregistrerReglages', [o], function (res) { recharger(res); toast('Enregistré'); });\n  };\n  $('#essai').onclick = function () { appel('adminEssaiMail', [], function (t) { toast(t); }); };\n}\n\nappel('adminCharger', [], recharger);\n</script>\n</body>\n</html>\n";
