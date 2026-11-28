/*
 * Lecture d'un justificatif (28.11.2026) : le texte d'un ticket ou d'une facture scannés est lu SUR L'APPAREIL (Tesseract.js,
 * reconnaissance de caractères dans le navigateur), puis on en tire le montant, la devise, la date, le fournisseur et la TVA.
 * Aucun envoi à un service, aucun droit Google. Le premier usage télécharge le lecteur et les langues (environ 6 Mo, gardés ensuite
 * par le navigateur). Pièce commune : utilisée par le scanner (scanner.js, case « Lire les informations ») de Tickets, et à reprendre
 * telle quelle par Frais et la Compta.
 *
 *   OrigamiLecture.lire(images).then(function (infos) {   // images : [Blob | HTMLCanvasElement | HTMLImageElement]
 *     infos.montant      // nombre (ex. 116.05) ou null
 *     infos.devise       // "CHF", "EUR"… ou ""
 *     infos.date         // "AAAA-MM-JJ" ou ""
 *     infos.fournisseur  // texte ou ""
 *     infos.tva          // [{ taux: 8.1, montant: 2.43 }] (peut être vide)
 *     infos.texte        // tout le texte lu
 *   });
 *   OrigamiLecture.analyser(texte) : la même chose à partir d'un texte (sans lecteur ; sert aussi aux essais).
 * Ce qui est lu n'est qu'une proposition : l'appli préremplit les champs et la personne vérifie avant d'enregistrer.
 */
(function (global) {
  "use strict";
  if (global.OrigamiLecture) return;
  var VERSION = "2026-11-28.1";
  var TESS = "https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/";
  var CORE = "https://cdn.jsdelivr.net/npm/tesseract.js-core@5.1.1";
  var LANGUES = "fra+spa";   // tickets suisses, français, espagnols ; l'espagnol lit aussi bien le catalan et l'anglais des tickets

  // ---- Analyse du texte ----
  var MOIS = { jan: 1, janv: 1, janvier: 1, ene: 1, enero: 1, fev: 2, fevr: 2, fevrier: 2, feb: 2, febrero: 2, mars: 3, mar: 3, marzo: 3, avr: 4, avril: 4, abr: 4, abril: 4, apr: 4,
    mai: 5, may: 5, mayo: 5, juin: 6, jun: 6, junio: 6, juil: 7, juillet: 7, jul: 7, julio: 7, aout: 8, ago: 8, agosto: 8, aug: 8, sep: 9, sept: 9, septembre: 9, septiembre: 9,
    oct: 10, octobre: 10, octubre: 10, nov: 11, novembre: 11, noviembre: 11, dec: 12, decembre: 12, dic: 12, diciembre: 12 };
  function sansAccents(s) { return String(s || "").normalize ? String(s).normalize("NFD").replace(/[\u0300-\u036f]/g, "") : String(s || ""); }
  // Un montant écrit 1'234.50, 1 234,50, 1.234,50, 12,5 ou 12.50
  var RE_MONTANT = /(^|[^\d.,'])(\d{1,3}(?:[ '’.]\d{3})+|\d+)([.,])(\d{2})(?![\d])/g;
  function montantsDe(ligne) {
    var l = [], m;
    RE_MONTANT.lastIndex = 0;
    while ((m = RE_MONTANT.exec(ligne))) {
      var entier = m[2].replace(/[ '’.]/g, ""), v = Number(entier + "." + m[4]);
      if (isFinite(v)) l.push(v);
    }
    return l;
  }
  function deviseDe(t) {
    var s = " " + t.toUpperCase() + " ";
    if (/CHF|\bSFR\b|\bFR\.?\s?\d|\d\s?FR\.?\b/.test(s)) return "CHF";
    if (/EUR|€/.test(s)) return "EUR";
    if (/GBP|£/.test(s)) return "GBP";
    if (/USD|US\$/.test(s)) return "USD";
    if (/\$/.test(s)) return "USD";
    return "";
  }
  var TOTAL = /(total\s*(ttc|a\s*payer|a\s*pagar|general|eur|chf|€)?|a\s*payer|net\s*a\s*payer|montant\s*(du|total|paye)?|importe(\s*total)?|total\s*factura|summe|betrag|zu\s*zahlen|gesamt|to\s*pay|amount\s*due|grand\s*total|tarjeta|carte\s*bancaire|paiement|pago)/;
  var PAS_TOTAL = /(sous[\s-]*total|subtotal|sub\s*total|tva|t\.v\.a|iva|mwst|vat|rendu|cambio|change|monnaie|remise|descuento|base\s*imp|ht\b|pourboire|propina)/;
  var TAXE = /(tva|t\.v\.a|iva|i\.v\.a|mwst|vat|tps)/;
  function dateDe(lignes) {
    var annee = new Date().getFullYear(), meilleure = "";
    function ok(j, mo, a) {
      if (a < 100) a += 2000;
      if (!(a >= 2000 && a <= annee + 1 && mo >= 1 && mo <= 12 && j >= 1 && j <= 31)) return "";
      var d = new Date(a, mo - 1, j);
      if (d.getMonth() !== mo - 1 || d.getTime() > Date.now() + 2 * 864e5) return "";
      return a + "-" + ("0" + mo).slice(-2) + "-" + ("0" + j).slice(-2);
    }
    for (var i = 0; i < lignes.length && !meilleure; i++) {
      var l = sansAccents(lignes[i]).toLowerCase(), m;
      if ((m = /(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})/.exec(l))) meilleure = ok(+m[3], +m[2], +m[1]);
      if (!meilleure && (m = /(^|[^\d])(\d{1,2})\s?[.\/-]\s?(\d{1,2})\s?[.\/-]\s?(\d{4}|\d{2})(?!\d)/.exec(l))) meilleure = ok(+m[2], +m[3], +m[4]);
      if (!meilleure && (m = /(^|[^\d])(\d{1,2})\s*(?:de\s+)?([a-z]{3,9})\.?\s*(?:de\s+)?(\d{4})/.exec(l)) && MOIS[m[3]]) meilleure = ok(+m[2], MOIS[m[3]], +m[4]);
    }
    return meilleure;
  }
  function fournisseurDe(lignes) {
    var bruit = /(\b(ticket|facture|factura|quittung|recu|receipt|date|fecha|datum|heure|hora|tel|telephone|caisse|caja|kasse|cif|nif|tva|iva|mwst|siret|merci|gracias|bienvenue|bienvenido|total|client|cliente)\b|www\.|http|@|n[°o]\s*\d)/i;
    for (var i = 0; i < Math.min(lignes.length, 6); i++) {
      var l = lignes[i].replace(/[^\p{L}\p{N}&'’ .,-]/gu, " ").replace(/\s+/g, " ").trim();
      var lettres = (l.match(/\p{L}/gu) || []).length;
      if (l.length < 3 || lettres < 3 || lettres < l.length * 0.6 || bruit.test(sansAccents(l))) continue;
      return l.slice(0, 60).replace(/^[\s.,-]+|[\s.,-]+$/g, "");
    }
    return "";
  }
  function analyser(texte) {
    var brut = String(texte || ""), lignes = brut.split(/\r?\n/).map(function (l) { return l.replace(/\s+/g, " ").trim(); }).filter(String);
    var infos = { montant: null, devise: deviseDe(brut), date: dateDe(lignes), fournisseur: fournisseurDe(lignes), tva: [], texte: brut };
    // Montant : la ligne « total / à payer » la plus basse qui porte un montant ; sinon la ligne suivante ; sinon le plus grand montant.
    var choisi = null;
    lignes.forEach(function (l, i) {
      var s = sansAccents(l).toLowerCase();
      if (TAXE.test(s)) {
        var p = /(\d{1,2}(?:[.,]\d{1,2})?)\s?%/.exec(s), mts = montantsDe(l);
        if (p && mts.length) {
          var taux = Number(p[1].replace(",", ".")), mt = mts.filter(function (x) { return x !== taux; });
          if (taux > 0 && taux < 30 && mt.length) infos.tva.push({ taux: taux, montant: mt.length > 1 ? Math.min.apply(null, mt) : mt[0] });
        }
      }
      if (!TOTAL.test(s) || PAS_TOTAL.test(s)) return;
      var v = montantsDe(l);
      if (!v.length && lignes[i + 1]) v = montantsDe(lignes[i + 1]);
      if (v.length) choisi = v[v.length - 1];
    });
    if (choisi === null) {
      var tous = [];
      lignes.forEach(function (l) { if (!TAXE.test(sansAccents(l).toLowerCase())) tous = tous.concat(montantsDe(l)); });
      tous = tous.filter(function (x) { return x > 0 && x < 100000; });
      if (tous.length) choisi = Math.max.apply(null, tous);
    }
    infos.montant = choisi !== null && choisi > 0 ? Math.round(choisi * 100) / 100 : null;
    // la même TVA lue deux fois (taux et montant identiques) : une seule fois
    var vus = {};
    infos.tva = infos.tva.filter(function (x) { var k = x.taux + "|" + x.montant; if (vus[k]) return false; vus[k] = true; return true; });
    return infos;
  }

  // ---- Lecteur (Tesseract.js), chargé au premier usage ----
  var lecteur = null;
  function script(src) {
    return new Promise(function (ok, ko) { var s = document.createElement("script"); s.src = src; s.async = true; s.onload = ok; s.onerror = function () { ko(new Error("Le lecteur de texte n'a pas pu être chargé (connexion ?).")); }; document.head.appendChild(s); });
  }
  function preparer(suivi) {
    if (lecteur) return lecteur;
    lecteur = (global.Tesseract ? Promise.resolve() : script(TESS + "tesseract.min.js")).then(function () {
      return global.Tesseract.createWorker(LANGUES, 1, {
        workerPath: TESS + "worker.min.js", corePath: CORE, workerBlobURL: true,
        logger: function (m) { if (typeof suivi === "function" && m && typeof m.progress === "number") suivi(m.status || "", m.progress); }
      });
    });
    lecteur.catch(function () { lecteur = null; });
    return lecteur;
  }
  function lire(images, options) {
    options = options || {};
    var l = (Array.isArray(images) ? images : [images]).filter(Boolean).slice(0, 4), textes = [];
    if (!l.length) return Promise.resolve(analyser(""));
    return preparer(options.suivi).then(function (w) {
      return l.reduce(function (p, img) { return p.then(function () { return w.recognize(img).then(function (r) { textes.push((r && r.data && r.data.text) || ""); }); }); }, Promise.resolve());
    }).then(function () { return analyser(textes.join("\n")); });
  }
  global.OrigamiLecture = { version: VERSION, lire: lire, analyser: analyser, _interne: { montantsDe: montantsDe, dateDe: dateDe, fournisseurDe: fournisseurDe, deviseDe: deviseDe } };
})(typeof window !== "undefined" ? window : this);
