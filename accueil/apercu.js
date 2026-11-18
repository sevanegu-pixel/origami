/*
 * Aperçu d'un fichier (justificatif d'un ticket, document…) dans une fenêtre par-dessus la page, sans ouvrir Google Drive.
 * Repris de l'aperçu de la Boîte mail (18.11.2026) : PDF dessiné dans la page (PDF.js), zoom − / + / Ajuster, Pivoter ;
 * image avec les mêmes outils ; « Télécharger » et « Ouvrir dans le navigateur ».
 *
 *   OrigamiApercu.ouvrir({ nom, lien, lire })
 *     nom  : titre affiché (nom du fichier)
 *     lien : adresse pour « Ouvrir dans le navigateur » (facultatif)
 *     lire : function () → Promise de { blob, type, nom } (ou { tropLourd: true } / rejet avec un message)
 *   OrigamiApercu.fermer()
 */
(function (global) {
  "use strict";
  var VERSION = "2026-11-18.1";
  var PDFJS_URL = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/";

  var CSS = [
    ".oap{position:fixed;inset:0;z-index:2147482000;background:rgba(0,0,0,.55);display:grid;place-items:center;padding:16px;font:14px/1.4 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;--oap-carte:#ffffff;--oap-texte:#15131a;--oap-doux:#67626e;--oap-ligne:#e4e1ea;--oap-fond:#ecebf0;--oap-bouton:#f3f2f6}",
    "@media (prefers-color-scheme:dark){.oap{--oap-carte:#1f1e24;--oap-texte:#f1eff5;--oap-doux:#a9a4b2;--oap-ligne:#34323b;--oap-fond:#141317;--oap-bouton:#2b2a31}}",
    ".oap *{box-sizing:border-box}",
    ".oap-boite{background:var(--oap-carte);color:var(--oap-texte);border-radius:14px;width:min(1000px,100%);height:min(88vh,100%);display:grid;grid-template-rows:auto auto minmax(0,1fr);grid-template-columns:minmax(0,1fr);overflow:hidden;box-shadow:0 12px 40px rgba(0,0,0,.35)}",
    ".oap-haut{display:flex;align-items:center;gap:8px;padding:10px 12px;border-bottom:1px solid var(--oap-ligne)}",
    ".oap-haut b{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:15px}",
    ".oap-actions{display:flex;gap:6px;align-items:center}",
    ".oap-b{appearance:none;-webkit-appearance:none;border:1px solid var(--oap-ligne);background:var(--oap-bouton);color:var(--oap-texte);border-radius:8px;min-height:32px;padding:0 12px;font:inherit;font-size:13px;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:4px;text-decoration:none;white-space:nowrap}",
    ".oap-b:hover{filter:brightness(.97)}.oap-b:focus-visible{outline:2px solid #1f5cff;outline-offset:2px}",
    ".oap-b.fort{background:#1f5cff;border-color:#1f5cff;color:#fff;font-weight:600}",
    ".oap-b:disabled{opacity:.45;cursor:default}",
    ".oap-fermer{min-width:32px;padding:0}",
    ".oap-outils{display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:6px;padding:6px 8px;border-bottom:1px solid var(--oap-ligne)}",
    ".oap-outils[hidden]{display:none}",
    ".oap-zoom{min-width:64px;text-align:center;font-variant-numeric:tabular-nums;font-size:13px;color:var(--oap-doux)}",
    ".oap-corps{min-height:0;overflow:auto;background:var(--oap-fond);position:relative}",
    ".oap-pages{display:grid;justify-content:center;align-content:start;gap:12px;padding:12px;min-height:100%}",
    ".oap-pages canvas{background:#fff;box-shadow:0 2px 10px rgba(0,0,0,.18);justify-self:center}",
    ".oap-image{min-height:100%;display:grid;place-items:center;padding:12px}",
    ".oap-image img{display:block;background:#fff;box-shadow:0 2px 10px rgba(0,0,0,.18)}",
    ".oap-message{min-height:100%;display:grid;place-content:center;justify-items:center;gap:10px;text-align:center;padding:24px;color:var(--oap-doux)}",
    ".oap-message b{color:var(--oap-texte);font-size:15px}",
    ".oap-rond{width:22px;height:22px;border-radius:50%;border:3px solid var(--oap-ligne);border-top-color:#1f5cff;animation:oap-tourne .8s linear infinite}",
    "@keyframes oap-tourne{to{transform:rotate(360deg)}}",
    "@media (max-width:760px){.oap{padding:0}.oap-boite{border-radius:0;height:100%;width:100%}.oap-haut{flex-wrap:wrap;padding-top:calc(10px + env(safe-area-inset-top))}.oap-actions{order:3;width:100%}.oap-actions .oap-b{flex:1}}"
  ].join("\n");
  var cssPose = false;
  function poserCss() { if (cssPose) return; cssPose = true; var s = document.createElement("style"); s.id = "origami-apercu-css"; s.textContent = CSS; document.head.appendChild(s); }
  function esc(t) { return String(t == null ? "" : t).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }

  // PDF.js (cdnjs), comme la Boîte mail : le « worker » est créé depuis une copie locale (un script d'un autre domaine ne peut pas servir de worker).
  var pdfAttente = null;
  function chargerPdfJs() {
    if (global.pdfjsLib && global.pdfjsLib.GlobalWorkerOptions && global.pdfjsLib.GlobalWorkerOptions.workerSrc) return Promise.resolve(global.pdfjsLib);
    if (pdfAttente) return pdfAttente;
    pdfAttente = new Promise(function (ok, ko) {
      var s = document.createElement("script"); s.src = PDFJS_URL + "pdf.min.js";
      s.onload = function () {
        var lib = global.pdfjsLib;
        if (!lib) { pdfAttente = null; return ko(new Error("Lecteur PDF indisponible")); }
        fetch(PDFJS_URL + "pdf.worker.min.js").then(function (r) { return r.text(); }).then(function (code) {
          lib.GlobalWorkerOptions.workerSrc = URL.createObjectURL(new Blob([code], { type: "text/javascript" }));
        }).catch(function () { lib.GlobalWorkerOptions.workerSrc = PDFJS_URL + "pdf.worker.min.js"; }).then(function () { ok(lib); });
      };
      s.onerror = function () { pdfAttente = null; ko(new Error("Lecteur PDF indisponible : vérifie la connexion.")); };
      document.head.appendChild(s);
    });
    return pdfAttente;
  }

  var courant = null;
  function fermer() {
    if (!courant) return;
    var c = courant; courant = null;
    c.tour++;
    document.removeEventListener("keydown", c.touche, true);
    window.removeEventListener("resize", c.taille);
    if (c.url) { try { URL.revokeObjectURL(c.url); } catch (e) {} }
    c.racine.remove();
    try { if (c.focus && c.focus.focus) c.focus.focus(); } catch (e) {}
  }

  function ouvrir(o) {
    o = o || {};
    fermer();
    poserCss();
    var racine = document.createElement("div");
    racine.className = "oap"; racine.setAttribute("role", "dialog"); racine.setAttribute("aria-modal", "true"); racine.setAttribute("aria-label", "Aperçu : " + (o.nom || "fichier"));
    var lien = o.lien && /^https:\/\//.test(o.lien) ? o.lien : "";
    racine.innerHTML = '<div class="oap-boite"><div class="oap-haut"><b>' + esc(o.nom || "Fichier") + '</b><span class="oap-actions">' +
      '<button type="button" class="oap-b" data-oap="telecharger" disabled>Télécharger</button>' +
      (lien ? '<a class="oap-b" data-oap="navigateur" href="' + esc(lien) + '" target="_blank" rel="noopener">Ouvrir dans le navigateur ↗</a>' : "") +
      '</span><button type="button" class="oap-b oap-fermer" data-oap="fermer" aria-label="Fermer" title="Fermer (Échap)">✕</button></div>' +
      '<div class="oap-outils" role="toolbar" aria-label="Zoom" hidden><button type="button" class="oap-b" data-oap="moins" aria-label="Zoom arrière">−</button><span class="oap-zoom" data-oap-val>Ajusté</span>' +
      '<button type="button" class="oap-b" data-oap="plus" aria-label="Zoom avant">+</button><button type="button" class="oap-b" data-oap="ajuster">Ajuster</button>' +
      '<button type="button" class="oap-b" data-oap="pivoter" aria-label="Pivoter d\'un quart de tour">⟳ Pivoter</button></div>' +
      '<div class="oap-corps" tabindex="0"><div class="oap-message"><span class="oap-rond"></span><span>Ouverture du fichier…</span></div></div></div>';
    document.body.appendChild(racine);
    var c = { racine: racine, tour: 0, focus: document.activeElement, url: "", fichier: null, vue: null };
    courant = c;
    var corps = racine.querySelector(".oap-corps"), outils = racine.querySelector(".oap-outils");
    c.touche = function (ev) { if (ev.key === "Escape" && courant === c) { ev.stopPropagation(); ev.preventDefault(); fermer(); } };
    c.taille = function () { if (c.vue && c.vue.redimensionner) c.vue.redimensionner(); };
    document.addEventListener("keydown", c.touche, true);
    window.addEventListener("resize", c.taille);
    racine.addEventListener("click", function (ev) {
      if (ev.target === racine) return fermer();
      var b = ev.target.closest("[data-oap]"); if (!b) return;
      var a = b.getAttribute("data-oap");
      if (a === "fermer") fermer();
      else if (a === "telecharger" && c.fichier) { var l = document.createElement("a"); l.href = c.url; l.download = c.fichier.nom || o.nom || "fichier"; document.body.appendChild(l); l.click(); l.remove(); }
      else if (c.vue && c.vue[a]) c.vue[a]();
    });
    // Le lien vers le navigateur est aussi proposé si la lecture traîne.
    var lent = setTimeout(function () {
      var m = corps.querySelector(".oap-message"); if (!m || !lien || courant !== c || c.fichier) return;
      m.insertAdjacentHTML("beforeend", '<span>C\'est long…</span><a class="oap-b" href="' + esc(lien) + '" target="_blank" rel="noopener">Ouvrir dans le navigateur ↗</a>');
    }, 8000);
    function message(titre, texte) {
      clearTimeout(lent);
      corps.innerHTML = '<div class="oap-message"><b>' + esc(titre) + "</b><span>" + esc(texte || "") + "</span>" + (lien ? '<a class="oap-b fort" href="' + esc(lien) + '" target="_blank" rel="noopener">Ouvrir dans le navigateur ↗</a>' : "") + "</div>";
    }
    try { racine.querySelector('[data-oap="fermer"]').focus(); } catch (e) {}
    Promise.resolve().then(function () { return o.lire ? o.lire() : Promise.reject(new Error("Pas de fichier.")); }).then(function (r) {
      if (courant !== c) return;
      if (!r || r.tropLourd) return message("Fichier très lourd", "L'aperçu se fait dans le navigateur pour ce fichier.");
      clearTimeout(lent);
      var type = String(r.type || (r.blob && r.blob.type) || "");
      if (!type && /\.pdf$/i.test(r.nom || o.nom || "")) type = "application/pdf";
      c.fichier = r; c.url = URL.createObjectURL(r.blob);
      racine.querySelector('[data-oap="telecharger"]').disabled = false;
      if (/pdf/i.test(type)) return vuePdf(c, corps, outils, r.blob).catch(function (e) { if (courant === c) message("Ce PDF ne peut pas être affiché ici", String((e && e.message) || e).slice(0, 160)); });
      if (/^image\//i.test(type)) return vueImage(c, corps, outils);
      message("Pas d'aperçu pour ce type de fichier", (r.nom || o.nom || "") + " : télécharge-le ou ouvre-le dans le navigateur.");
    }, function (e) { if (courant === c) message("Aperçu impossible", String((e && e.message) || e || "").slice(0, 200)); });
    return c;
  }

  // Zoom commun : 0 = ajusté à la largeur (ou à la fenêtre pour une image), sinon un facteur de 25 % à 500 %.
  function outilsZoom(c, outils, appliquer, actuel) {
    var vue = { zoom: 0, rotation: 0 };
    function dire() { var v = outils.querySelector("[data-oap-val]"); if (v) v.textContent = vue.zoom ? Math.round(vue.zoom * 100) + " %" : "Ajusté"; }
    function regler(n) { vue.zoom = n ? Math.max(0.25, Math.min(5, n)) : 0; dire(); appliquer(); }
    vue.plus = function () { var a = actuel(); regler((Math.floor(a * 10 + 1e-6) + 1) / 10); };
    vue.moins = function () { var a = actuel(); regler((Math.ceil(a * 10 - 1e-6) - 1) / 10); };
    vue.ajuster = function () { regler(0); };
    vue.pivoter = function () { vue.rotation = (vue.rotation + 90) % 360; appliquer(); };
    vue.redimensionner = function () { if (!vue.zoom) appliquer(); };
    outils.hidden = false; dire();
    c.vue = vue;
    return vue;
  }

  function vueImage(c, corps, outils) {
    corps.innerHTML = '<div class="oap-image"><img alt=""></div>';
    var img = corps.querySelector("img"), vue = null;
    function actuel() { return img.naturalWidth ? img.getBoundingClientRect().width / (vue.rotation % 180 ? img.naturalHeight : img.naturalWidth) : 1; }
    function appliquer() {
      if (!img.naturalWidth) return;
      var tourne = vue.rotation % 180 !== 0, l = tourne ? img.naturalHeight : img.naturalWidth, h = tourne ? img.naturalWidth : img.naturalHeight;
      var e = vue.zoom || Math.min(1, (corps.clientWidth - 24) / l, (corps.clientHeight - 24) / h);
      if (!(e > 0)) e = 0.1;
      // L'image pivotée est dessinée dans un canevas : le défilement suit sa vraie taille.
      if (vue.rotation) {
        if (!c.canevas) { c.canevas = document.createElement("canvas"); img.replaceWith(c.canevas); c.canevas.style.background = "#fff"; c.canevas.style.boxShadow = "0 2px 10px rgba(0,0,0,.18)"; }
        var k = Math.min(1, 4000 / Math.max(l, h)), cv = c.canevas;
        cv.width = Math.round(l * k); cv.height = Math.round(h * k);
        var x = cv.getContext("2d"); x.save(); x.translate(cv.width / 2, cv.height / 2); x.rotate(vue.rotation * Math.PI / 180); x.drawImage(img, -img.naturalWidth * k / 2, -img.naturalHeight * k / 2, img.naturalWidth * k, img.naturalHeight * k); x.restore();
        cv.style.width = Math.round(l * e) + "px"; cv.style.height = Math.round(h * e) + "px";
      } else {
        if (c.canevas) { c.canevas.replaceWith(img); c.canevas = null; }
        img.style.width = Math.round(l * e) + "px"; img.style.height = Math.round(h * e) + "px";
      }
    }
    vue = outilsZoom(c, outils, appliquer, function () { var el = c.canevas || img, tourne = vue.rotation % 180 !== 0; return el.getBoundingClientRect().width / ((tourne ? img.naturalHeight : img.naturalWidth) || 1); });
    img.onload = appliquer;
    img.onerror = function () { corps.innerHTML = '<div class="oap-message"><b>Image illisible</b><span>Télécharge-la ou ouvre-la dans le navigateur.</span></div>'; };
    img.src = c.url;
  }

  function vuePdf(c, corps, outils, blob) {
    corps.innerHTML = '<div class="oap-message"><span class="oap-rond"></span><span>Préparation du PDF…</span></div>';
    return chargerPdfJs().then(function (lib) {
      return blob.arrayBuffer().then(function (buf) { return lib.getDocument({ data: buf }).promise; });
    }).then(function (doc) {
      if (courant !== c) return;
      corps.innerHTML = '<div class="oap-pages"></div>';
      var pages = corps.querySelector(".oap-pages"), max = Math.min(doc.numPages, 100), infos = [], minuterie = 0, vue = null;
      function ajuste() { return Math.max(260, (corps.clientWidth || 600) - 24); }
      function echelle(i) { return vue.zoom ? vue.zoom * 96 / 72 : ajuste() / infos[i].l; }
      function tailler(cv) { var i = +cv.dataset.page, e = echelle(i); cv.style.width = Math.round(infos[i].l * e) + "px"; cv.style.height = Math.round(infos[i].h * e) + "px"; }
      function dessiner() {
        var mien = ++c.tour;
        (function une(i) {
          if (mien !== c.tour || courant !== c) return;
          if (i > max) { if (doc.numPages > max && !pages.querySelector(".oap-reste")) pages.insertAdjacentHTML("beforeend", '<p class="oap-reste" style="text-align:center;color:var(--oap-doux)">' + (doc.numPages - max) + " pages de plus : ouvre le fichier dans le navigateur.</p>"); return; }
          doc.getPage(i).then(function (p) {
            if (mien !== c.tour) return;
            var rot = (p.rotate + vue.rotation) % 360, v1 = p.getViewport({ scale: 1, rotation: rot });
            infos[i] = { l: v1.width, h: v1.height };
            var net = echelle(i) * (window.devicePixelRatio || 1);
            if (v1.width * net > 6000) net = 6000 / v1.width;
            var vp = p.getViewport({ scale: net, rotation: rot }), cv = document.createElement("canvas");
            cv.width = Math.round(vp.width); cv.height = Math.round(vp.height); cv.dataset.page = i; cv.setAttribute("aria-label", "Page " + i);
            return p.render({ canvasContext: cv.getContext("2d"), viewport: vp }).promise.then(function () {
              if (mien !== c.tour) return;
              var ancien = pages.querySelector('canvas[data-page="' + i + '"]');
              if (ancien) ancien.replaceWith(cv); else pages.insertBefore(cv, pages.querySelector(".oap-reste"));
              tailler(cv);
            });
          }).then(function () { setTimeout(function () { une(i + 1); }, 0); });
        })(1);
      }
      function appliquer() {
        Array.prototype.forEach.call(pages.querySelectorAll("canvas[data-page]"), function (cv) { if (infos[+cv.dataset.page]) tailler(cv); });
        clearTimeout(minuterie); minuterie = setTimeout(dessiner, 200);
      }
      vue = outilsZoom(c, outils, appliquer, function () { return vue.zoom || (infos[1] ? ajuste() / (infos[1].l * 96 / 72) : 1); });
      var pivoter = vue.pivoter;
      vue.pivoter = function () { infos.forEach(function (x) { if (x) { var t = x.l; x.l = x.h; x.h = t; } }); pivoter(); };
      // Ctrl/⌘ + molette ou pincer sur le pavé tactile : zoom.
      corps.addEventListener("wheel", function (e) {
        if (!(e.ctrlKey || e.metaKey)) return; e.preventDefault();
        var a = vue.zoom || (infos[1] ? ajuste() / (infos[1].l * 96 / 72) : 1), d = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
        vue.zoom = Math.max(0.25, Math.min(5, a * Math.exp(-Math.max(-60, Math.min(60, d)) * 0.01)));
        var v = outils.querySelector("[data-oap-val]"); if (v) v.textContent = Math.round(vue.zoom * 100) + " %";
        appliquer();
      }, { passive: false });
      dessiner();
    });
  }

  global.OrigamiApercu = { version: VERSION, ouvrir: ouvrir, fermer: fermer };
})(typeof window !== "undefined" ? window : this);
