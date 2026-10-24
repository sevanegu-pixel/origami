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
