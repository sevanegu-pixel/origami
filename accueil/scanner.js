/*
 * Scanner Origami (18.11.2026) : photo d'un ticket → recadrage par des points (coins et milieux des bords, avec loupe)
 * → redressement → effets (couleur nette, gris, texte renforcé, noir et blanc, luminosité, contraste) → plusieurs pages → PDF.
 * Tout se passe sur l'appareil : aucun envoi, aucune bibliothèque, aucun droit Google.
 *
 * Utilisation, dans n'importe quelle appli :
 *   OrigamiScanner.ouvrir({ nom: "ticket" }).then(function (r) {
 *     if (!r) return;                       // la personne a annulé
 *     r.pdf      // Blob application/pdf (toutes les pages)
 *     r.nom      // "ticket-2026-11-18.pdf"
 *     r.pages    // nombre de pages
 *     r.images   // [Blob image/jpeg] une par page
 *     r.base64() // Promise<string> : le PDF en base64, prêt pour google.script.run ou fetch
 *   });
 * Options : nom, titre, couleur (accent), fichier (File d'image : saute l'écran de départ), multipage (true par défaut).
 * 28.11.2026, option « lecture » : true (ou { url: adresse de lecture.js }) montre la case « Lire les informations » sur l'écran
 * des effets. Cochée (le choix est gardé sur l'appareil), le texte du ticket est lu sur l'appareil (lecture.js, OrigamiLecture) et
 * le résultat porte r.infos = { montant, devise, date, fournisseur, tva, texte }, ou r.lecture = { souci } si la lecture a échoué.
 * Le scan est rendu dans tous les cas : la lecture n'est qu'une aide, à vérifier.
 */
(function (global) {
  "use strict";
  if (global.OrigamiScanner) return;
  var VERSION = "2026-11-28.1";
  var ICI = (document.currentScript && document.currentScript.src) || "";   // lecture.js est à côté de ce fichier
  var MAX_SOURCE = 2600, MAX_SORTIE = 2000, MAX_APERCU = 1100, QUALITE = 0.86;
  var EFFETS = [
    { id: "original", nom: "Original" },
    { id: "couleur", nom: "Couleur nette" },
    { id: "gris", nom: "Gris" },
    { id: "texte", nom: "Texte renforcé" },
    { id: "nb", nom: "Noir et blanc" }
  ];

  var CSS = [
    ".osc{position:fixed;inset:0;z-index:2147483000;background:#141414;color:#f1f1f1;font:15px/1.35 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;display:flex;flex-direction:column;-webkit-user-select:none;user-select:none;-webkit-tap-highlight-color:transparent}",
    ".osc *{box-sizing:border-box}",
    ".osc-haut{display:flex;align-items:center;gap:8px;padding:calc(8px + env(safe-area-inset-top)) 12px 8px}",
    ".osc-titre{flex:1;min-width:0;font-weight:600;text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
    ".osc-b{appearance:none;-webkit-appearance:none;border:0;border-radius:999px;background:#2b2b2b;color:#f1f1f1;font:inherit;font-size:14px;padding:8px 14px;min-height:40px;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:6px;white-space:nowrap}",
    ".osc-b:hover{background:#383838}.osc-b:focus-visible{outline:2px solid var(--osc-accent);outline-offset:2px}",
    ".osc-b.p{background:var(--osc-accent);color:#fff;font-weight:600}.osc-b.p:hover{filter:brightness(1.08)}",
    ".osc-b:disabled{opacity:.4;cursor:default}",
    ".osc-b svg{width:18px;height:18px;flex:none}",
    ".osc-scene{flex:1;position:relative;min-height:0;overflow:hidden;touch-action:none}",
    ".osc-scene>canvas{position:absolute;left:0;top:0}",
    ".osc-svg{position:absolute;left:0;top:0;width:100%;height:100%;overflow:visible;touch-action:none}",
    ".osc-loupe{position:absolute;width:132px;height:132px;border-radius:50%;border:3px solid #fff;box-shadow:0 4px 18px rgba(0,0,0,.6);pointer-events:none;overflow:hidden;background:#000}",
    ".osc-loupe canvas{width:100%;height:100%;display:block}",
    ".osc-bas{padding:8px 12px calc(10px + env(safe-area-inset-bottom));display:flex;flex-direction:column;gap:10px;align-items:stretch}",
    ".osc-rang{display:flex;gap:8px;justify-content:center;flex-wrap:wrap}",
    ".osc-rang.fin{justify-content:space-between;flex-wrap:nowrap}",
    ".osc-rang.fin>div{display:flex;gap:8px}",
    ".osc-aide{font-size:13px;color:#b8b8b8;text-align:center}",
    ".osc-lire{display:flex;align-items:center;justify-content:center;gap:8px;font-size:14px;color:#e8e8e8;cursor:pointer;min-height:32px}.osc-lire input{width:20px;height:20px;margin:0;accent-color:var(--osc-accent,#1f6fd1)}.osc-lire small{color:#9a9a9a}",
    ".osc-effets{display:flex;gap:8px;overflow-x:auto;padding:2px 2px 4px;scrollbar-width:none;justify-content:safe center}",
    ".osc-effets::-webkit-scrollbar{display:none}",
    ".osc-effet{flex:0 0 auto;width:76px;border:0;background:none;color:#ddd;font:inherit;font-size:12px;cursor:pointer;padding:0;display:flex;flex-direction:column;align-items:center;gap:4px}",
    ".osc-effet canvas{width:64px;height:64px;border-radius:10px;object-fit:cover;border:2px solid transparent;background:#000}",
    ".osc-effet[aria-pressed=true]{color:#fff;font-weight:600}.osc-effet[aria-pressed=true] canvas{border-color:var(--osc-accent)}",
    ".osc-reglages{display:grid;grid-template-columns:auto 1fr auto;gap:6px 10px;align-items:center;font-size:13px;color:#cfcfcf;max-width:560px;width:100%;margin:0 auto}",
    ".osc-reglages input{width:100%;accent-color:var(--osc-accent)}",
    ".osc-reglages output{min-width:2.5em;text-align:right;color:#999}",
    ".osc-pages{display:flex;gap:8px;overflow-x:auto;padding:2px;justify-content:safe center}",
    ".osc-page{position:relative;flex:0 0 auto;border:2px solid transparent;border-radius:6px;padding:0;background:#000;cursor:pointer}",
    ".osc-page[aria-current=true]{border-color:var(--osc-accent)}",
    ".osc-page canvas{display:block;height:54px;width:auto;border-radius:4px}",
    ".osc-page span{position:absolute;left:3px;bottom:2px;font-size:11px;background:rgba(0,0,0,.65);padding:0 4px;border-radius:4px}",
    ".osc-depart{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;padding:24px;text-align:center}",
    ".osc-depart .osc-b{min-width:240px;min-height:52px;font-size:16px}",
    ".osc-depart p{margin:0;color:#b8b8b8;max-width:420px}",
    ".osc-depose{border:2px dashed #555;border-radius:16px;padding:22px;max-width:440px;width:100%;color:#aaa}",
    ".osc-depose.sur{border-color:var(--osc-accent);color:#fff}",
    ".osc-attente{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.45);font-weight:600;z-index:3}",
    ".osc-question{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);background:#232323;border-radius:16px;padding:18px;width:min(360px,calc(100% - 32px));box-shadow:0 10px 40px rgba(0,0,0,.6);z-index:4}",
    ".osc-question p{margin:0 0 14px}.osc-question .osc-rang{justify-content:flex-end}",
    ".osc-voile{position:absolute;inset:0;background:rgba(0,0,0,.5);z-index:3}",
    ".osc-camera{flex:1;position:relative;min-height:0;overflow:hidden;background:#000;display:flex;align-items:center;justify-content:center}",
    ".osc-camera video{max-width:100%;max-height:100%;width:auto;height:auto;display:block;background:#000}",
    ".osc-declencher{width:68px;height:68px;border-radius:50%;border:4px solid #fff;background:var(--osc-accent);cursor:pointer;padding:0;box-shadow:0 0 0 3px rgba(0,0,0,.4)}",
    ".osc-declencher:disabled{opacity:.4;cursor:default}.osc-declencher:focus-visible{outline:3px solid #fff;outline-offset:3px}",
    ".osc-eclair{position:absolute;inset:0;background:#fff;opacity:.85;pointer-events:none;transition:opacity .25s}",
    "@media (max-width:420px){.osc-b{padding:8px 11px;font-size:13px}.osc-b .osc-t{display:none}.osc-b.p .osc-t,.osc-b.t .osc-t{display:inline}}",
    "@media (min-width:900px){.osc-bas{padding-left:24px;padding-right:24px}}"
  ].join("\n");

  var ICONES = {
    gauche: '<path d="M4 9h10a6 6 0 0 1 0 12H9" /><path d="M8 5 4 9l4 4" />',
    droite: '<path d="M20 9H10a6 6 0 0 0 0 12h5" /><path d="m16 5 4 4-4 4" />',
    cadre: '<path d="M4 8V4h4M16 4h4v4M20 16v4h-4M8 20H4v-4" />',
    auto: '<path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" />',
    plus: '<path d="M12 5v14M5 12h14" />',
    photo: '<path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" />',
    image: '<rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="9" cy="10" r="2" /><path d="m21 17-5-5-9 8" />',
    camera: '<path d="M3 7h12v10H3z" /><path d="m15 11 6-3v8l-6-3" />',
    corbeille: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />'
  };
  function icone(n) { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICONES[n] + "</svg>"; }
  function bouton(action, texte, ic, classe, titre) {
    return '<button type="button" class="osc-b ' + (classe || "") + '" data-osc="' + action + '"' + (titre ? ' title="' + titre + '" aria-label="' + titre + '"' : "") + ">" + (ic ? icone(ic) : "") + '<span class="osc-t">' + texte + "</span></button>";
  }
  function el(tag, classe, html) { var e = document.createElement(tag); if (classe) e.className = classe; if (html != null) e.innerHTML = html; return e; }
  function borne(v, a, b) { return v < a ? a : v > b ? b : v; }
  function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
  function aujourdhui() { var d = new Date(); return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2); }
  function toile(w, h) { var c = document.createElement("canvas"); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; }
  function ctx2d(c) { return c.getContext("2d", { willReadFrequently: true }); }
  function reduire(c, max) {
    var k = Math.min(1, max / Math.max(c.width, c.height));
    if (k >= 1) return c;
    var r = toile(c.width * k, c.height * k), x = r.getContext("2d");
    x.imageSmoothingQuality = "high"; x.drawImage(c, 0, 0, r.width, r.height);
    return r;
  }

  // ---------------------------------------------------------------- lecture de l'image
  function chargerImage(fichier) {
    return new Promise(function (ok, ko) {
      if (!fichier || !/^image\//.test(fichier.type || "image/")) return ko(new Error("Choisis une image (photo du ticket)."));
      var url = URL.createObjectURL(fichier), img = new Image();
      img.onload = function () {
        try {
          var w = img.naturalWidth, h = img.naturalHeight, k = Math.min(1, MAX_SOURCE / Math.max(w, h));
          var c = toile(w * k, h * k), x = c.getContext("2d");
          x.imageSmoothingQuality = "high"; x.drawImage(img, 0, 0, c.width, c.height);   // les navigateurs appliquent l'orientation de la photo
          URL.revokeObjectURL(url); ok(c);
        } catch (e) { URL.revokeObjectURL(url); ko(e); }
      };
      img.onerror = function () { URL.revokeObjectURL(url); ko(new Error("Cette image ne peut pas être lue ici (format HEIC ? essaie « Choisir une image » depuis Photos).")); };
      img.src = url;
    });
  }
  function tourner(c, sens) {   // sens : 1 = quart de tour à droite, -1 = à gauche
    var r = toile(c.height, c.width), x = r.getContext("2d");
    x.translate(r.width / 2, r.height / 2); x.rotate(sens * Math.PI / 2); x.drawImage(c, -c.width / 2, -c.height / 2);
    return r;
  }

  // ---------------------------------------------------------------- repérage automatique du ticket
  // Le ticket est en général plus clair que ce qui l'entoure : seuil d'Otsu, plus grande tache claire, puis ses quatre coins.
  function detecter(c) {
    try {
      var p = reduire(c, 320), w = p.width, h = p.height, d = ctx2d(p).getImageData(0, 0, w, h).data, n = w * h, L = new Uint8Array(n), i;
      for (i = 0; i < n; i++) L[i] = (d[i * 4] * 77 + d[i * 4 + 1] * 150 + d[i * 4 + 2] * 29) >> 8;
      var B = flou(L, w, h, 2), hist = new Float64Array(256);
      for (i = 0; i < n; i++) hist[B[i]]++;
      var somme = 0, sB = 0, wB = 0, best = 0, seuil = 128;
      for (i = 0; i < 256; i++) somme += i * hist[i];
      for (i = 0; i < 256; i++) {
        wB += hist[i]; if (!wB) continue; var wF = n - wB; if (!wF) break;
        sB += i * hist[i]; var mB = sB / wB, mF = (somme - sB) / wF, v = wB * wF * (mB - mF) * (mB - mF);
        if (v > best) { best = v; seuil = i; }
      }
      var etiq = new Int32Array(n), pile = new Int32Array(n), meilleur = 0, taille = 0, num = 0;
      for (i = 0; i < n; i++) {
        if (etiq[i] || B[i] <= seuil) continue;
        num++; var haut = 0, t = 0; pile[haut++] = i; etiq[i] = num;
        while (haut) {
          var q = pile[--haut], x = q % w, y = (q - x) / w; t++;
          if (x > 0 && !etiq[q - 1] && B[q - 1] > seuil) { etiq[q - 1] = num; pile[haut++] = q - 1; }
          if (x < w - 1 && !etiq[q + 1] && B[q + 1] > seuil) { etiq[q + 1] = num; pile[haut++] = q + 1; }
          if (y > 0 && !etiq[q - w] && B[q - w] > seuil) { etiq[q - w] = num; pile[haut++] = q - w; }
          if (y < h - 1 && !etiq[q + w] && B[q + w] > seuil) { etiq[q + w] = num; pile[haut++] = q + w; }
        }
        if (t > taille) { taille = t; meilleur = num; }
      }
      if (taille < n * 0.08 || taille > n * 0.97) return null;
      var tl = null, tr = null, br = null, bl = null, a = Infinity, b = -Infinity, cc = -Infinity, dd = Infinity, bordure = 0;
      for (i = 0; i < n; i++) {
        if (etiq[i] !== meilleur) continue;
        var xx = i % w, yy = (i - xx) / w, s = xx + yy, df = xx - yy;
        if (xx === 0 || yy === 0 || xx === w - 1 || yy === h - 1) bordure++;
        if (s < a) { a = s; tl = { x: xx, y: yy }; }
        if (s > b) { b = s; br = { x: xx, y: yy }; }
        if (df > cc) { cc = df; tr = { x: xx, y: yy }; }
        if (df < dd) { dd = df; bl = { x: xx, y: yy }; }
      }
      if (bordure > (w + h) * 1.2) return null;   // la « tache » est le fond clair, pas le ticket
      var k = c.width / w, pts = [tl, tr, br, bl].map(function (q) { return { x: borne((q.x + 0.5) * k, 0, c.width), y: borne((q.y + 0.5) * k, 0, c.height) }; });
      if (aire(pts) < c.width * c.height * 0.06) return null;
      return pts;
    } catch (e) { return null; }
  }
  function aire(p) { var s = 0; for (var i = 0; i < 4; i++) { var j = (i + 1) % 4; s += p[i].x * p[j].y - p[j].x * p[i].y; } return Math.abs(s) / 2; }
  function cadrePlein(c) { var m = Math.round(Math.min(c.width, c.height) * 0.04); return [{ x: m, y: m }, { x: c.width - m, y: m }, { x: c.width - m, y: c.height - m }, { x: m, y: c.height - m }]; }
  function convexe(p) {   // les quatre points forment un quadrilatère non croisé
    var signe = 0;
    for (var i = 0; i < 4; i++) {
      var a = p[i], b = p[(i + 1) % 4], c = p[(i + 2) % 4], z = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
      if (Math.abs(z) < 1e-6) return false;
      if (!signe) signe = z > 0 ? 1 : -1; else if ((z > 0 ? 1 : -1) !== signe) return false;
    }
    return true;
  }

  // ---------------------------------------------------------------- redressement (perspective)
  function homographie(src, dst) {   // H tel que H(dst[i]) = src[i]
    var A = [], i;
    for (i = 0; i < 4; i++) {
      var x = dst[i].x, y = dst[i].y, u = src[i].x, v = src[i].y;
      A.push([x, y, 1, 0, 0, 0, -u * x, -u * y, u]);
      A.push([0, 0, 0, x, y, 1, -v * x, -v * y, v]);
    }
    for (var col = 0; col < 8; col++) {
      var piv = col;
      for (var r = col + 1; r < 8; r++) if (Math.abs(A[r][col]) > Math.abs(A[piv][col])) piv = r;
      var t = A[col]; A[col] = A[piv]; A[piv] = t;
      for (r = 0; r < 8; r++) {
        if (r === col) continue;
        var f = A[r][col] / A[col][col];
        for (var k = col; k < 9; k++) A[r][k] -= f * A[col][k];
      }
    }
    var h = [];
    for (i = 0; i < 8; i++) h.push(A[i][8] / A[i][i]);
    return h;
  }
  function redresser(c, pts, max) {
    var tl = pts[0], tr = pts[1], br = pts[2], bl = pts[3];
    var W = Math.max(dist(tl, tr), dist(bl, br)), H = Math.max(dist(tl, bl), dist(tr, br)), k = Math.min(1, max / Math.max(W, H));
    W = Math.max(8, Math.round(W * k)); H = Math.max(8, Math.round(H * k));
    var h = homographie(pts, [{ x: 0, y: 0 }, { x: W, y: 0 }, { x: W, y: H }, { x: 0, y: H }]);
    var sw = c.width, sh = c.height, s = ctx2d(c).getImageData(0, 0, sw, sh).data;
    var out = toile(W, H), ox = ctx2d(out), im = ox.createImageData(W, H), o = im.data, p = 0;
    for (var y = 0; y < H; y++) {
      var yc = y + 0.5;
      for (var x = 0; x < W; x++) {
        var xc = x + 0.5, den = h[6] * xc + h[7] * yc + 1, u = (h[0] * xc + h[1] * yc + h[2]) / den - 0.5, v = (h[3] * xc + h[4] * yc + h[5]) / den - 0.5;
        if (u < 0) u = 0; else if (u > sw - 1.001) u = sw - 1.001;
        if (v < 0) v = 0; else if (v > sh - 1.001) v = sh - 1.001;
        var x0 = u | 0, y0 = v | 0, fx = u - x0, fy = v - y0, i0 = (y0 * sw + x0) * 4, i1 = i0 + sw * 4;
        var a = (1 - fx) * (1 - fy), b = fx * (1 - fy), cc = (1 - fx) * fy, d = fx * fy;
        o[p] = s[i0] * a + s[i0 + 4] * b + s[i1] * cc + s[i1 + 4] * d;
        o[p + 1] = s[i0 + 1] * a + s[i0 + 5] * b + s[i1 + 1] * cc + s[i1 + 5] * d;
        o[p + 2] = s[i0 + 2] * a + s[i0 + 6] * b + s[i1 + 2] * cc + s[i1 + 6] * d;
        o[p + 3] = 255; p += 4;
      }
    }
    ox.putImageData(im, 0, 0);
    return out;
  }

  // ---------------------------------------------------------------- effets
  // Flou en boîte par image intégrale (rayon r), sur un canal 8 bits.
  function flou(L, w, h, r) {
    var I = new Uint32Array((w + 1) * (h + 1)), x, y;
    for (y = 0; y < h; y++) { var ligne = 0; for (x = 0; x < w; x++) { ligne += L[y * w + x]; I[(y + 1) * (w + 1) + x + 1] = I[y * (w + 1) + x + 1] + ligne; } }
    var o = new Uint8Array(w * h);
    for (y = 0; y < h; y++) {
      var y0 = Math.max(0, y - r), y1 = Math.min(h, y + r + 1);
      for (x = 0; x < w; x++) {
        var x0 = Math.max(0, x - r), x1 = Math.min(w, x + r + 1);
        o[y * w + x] = (I[y1 * (w + 1) + x1] - I[y0 * (w + 1) + x1] - I[y1 * (w + 1) + x0] + I[y0 * (w + 1) + x0]) / ((x1 - x0) * (y1 - y0));
      }
    }
    return o;
  }
  // Le « fond » (le papier) : image réduite, maximum local pour effacer l'écriture, flou, puis remise à la taille. Sert à blanchir le
  // papier et à effacer les ombres sans toucher à l'encre.
  function fond(L, w, h) {
    var f = 4, sw = Math.max(1, Math.ceil(w / f)), sh = Math.max(1, Math.ceil(h / f)), S = new Uint8Array(sw * sh), x, y, i, j;
    for (y = 0; y < sh; y++) for (x = 0; x < sw; x++) {
      var t = 0, nb = 0;
      for (j = y * f; j < Math.min(h, y * f + f); j++) for (i = x * f; i < Math.min(w, x * f + f); i++) { t += L[j * w + i]; nb++; }
      S[y * sw + x] = t / nb;
    }
    var r = Math.max(2, Math.round(Math.min(sw, sh) / 40)), M = new Uint8Array(sw * sh), M2 = new Uint8Array(sw * sh);
    for (y = 0; y < sh; y++) for (x = 0; x < sw; x++) { var m = 0; for (i = Math.max(0, x - r); i <= Math.min(sw - 1, x + r); i++) if (S[y * sw + i] > m) m = S[y * sw + i]; M[y * sw + x] = m; }
    for (y = 0; y < sh; y++) for (x = 0; x < sw; x++) { var m2 = 0; for (j = Math.max(0, y - r); j <= Math.min(sh - 1, y + r); j++) if (M[j * sw + x] > m2) m2 = M[j * sw + x]; M2[y * sw + x] = m2; }
    var F = flou(M2, sw, sh, Math.max(2, r * 2)), o = new Float32Array(w * h);
    for (y = 0; y < h; y++) {
      var v = Math.min(sh - 1.001, Math.max(0, (y + 0.5) / f - 0.5)), y0 = v | 0, fy = v - y0;
      for (x = 0; x < w; x++) {
        var u = Math.min(sw - 1.001, Math.max(0, (x + 0.5) / f - 0.5)), x0 = u | 0, fx = u - x0, k = y0 * sw + x0;
        var a = F[k], b = F[Math.min(k + 1, sw * sh - 1)], c = F[Math.min(k + sw, sw * sh - 1)], d = F[Math.min(k + sw + 1, sw * sh - 1)];
        o[y * w + x] = Math.max(24, a * (1 - fx) * (1 - fy) + b * fx * (1 - fy) + c * (1 - fx) * fy + d * fx * fy);
      }
    }
    return o;
  }
  function percentiles(L, bas, haut) {
    var hist = new Uint32Array(256), n = L.length, i, a = 0, b = 255, t = 0;
    for (i = 0; i < n; i++) hist[L[i] | 0]++;
    for (i = 0; i < 256; i++) { t += hist[i]; if (t >= n * bas) { a = i; break; } }
    t = 0;
    for (i = 255; i >= 0; i--) { t += hist[i]; if (t >= n * (1 - haut)) { b = i; break; } }
    if (b - a < 16) { a = Math.max(0, a - 8); b = Math.min(255, b + 8); }
    return [a, b];
  }
  function luminance(d, n) { var L = new Uint8Array(n); for (var i = 0; i < n; i++) L[i] = (d[i * 4] * 77 + d[i * 4 + 1] * 150 + d[i * 4 + 2] * 29) >> 8; return L; }
  function canal(d, n, k) { var C = new Uint8Array(n); for (var i = 0; i < n; i++) C[i] = d[i * 4 + k]; return C; }

  /** Rend une nouvelle toile avec l'effet. reglages : { lum: -50..50, con: -50..50, trait: 0..100 } */
  function appliquer(src, effet, reglages) {
    var w = src.width, h = src.height, n = w * h, out = toile(w, h), x = ctx2d(out);
    x.drawImage(src, 0, 0);
    if (effet === "original" && !reglages.lum && !reglages.con) return out;
    var im = x.getImageData(0, 0, w, h), d = im.data, i, k;
    var lum = (reglages.lum || 0) * 1.6, con = 1 + (reglages.con || 0) / 60;
    function finir(v) { return (v - 128) * con + 128 + lum; }
    if (effet === "original") {
      for (i = 0; i < n * 4; i += 4) { d[i] = finir(d[i]); d[i + 1] = finir(d[i + 1]); d[i + 2] = finir(d[i + 2]); }
    } else if (effet === "couleur") {
      // Chaque couleur divisée par son propre fond : papier blanc, ombres et teinte de la lampe effacées, encres gardées.
      for (k = 0; k < 3; k++) {
        var C = canal(d, n, k), F = fond(C, w, h);
        for (i = 0; i < n; i++) { var r = C[i] / F[i]; d[i * 4 + k] = r * 255; }
      }
      for (i = 0; i < n * 4; i += 4) {   // un peu plus de saturation et de contraste
        var g = (d[i] * 77 + d[i + 1] * 150 + d[i + 2] * 29) >> 8;
        for (k = 0; k < 3; k++) { var v = g + (d[i + k] - g) * 1.25; v = 255 - (255 - v) * 1.12; d[i + k] = finir(v); }
      }
    } else if (effet === "gris") {
      var G = luminance(d, n), pc = percentiles(G, 0.01, 0.99), e = 255 / Math.max(1, pc[1] - pc[0]);
      for (i = 0; i < n; i++) { var vg = finir((G[i] - pc[0]) * e); d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = vg; }
    } else if (effet === "texte") {
      // Papier blanchi, ombres effacées, encre foncée : la meilleure lecture des tickets thermiques pâles.
      var T = luminance(d, n), FT = fond(T, w, h), R = new Uint8Array(n);
      for (i = 0; i < n; i++) R[i] = Math.min(255, (T[i] / FT[i]) * 255);
      var pt = percentiles(R, 0.005, 0.6), et = 255 / Math.max(1, pt[1] - pt[0]);
      for (i = 0; i < n; i++) {
        var z = Math.max(0, Math.min(1, (R[i] - pt[0]) * et / 255)), vt = finir(255 * Math.pow(z, 1.9));
        d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = vt;
      }
    } else if (effet === "nb") {
      // Seuil local (chaque point comparé au papier autour de lui). « trait » épaissit ou affine l'écriture.
      var N = luminance(d, n), FN = fond(N, w, h), seuil = 0.86 - ((reglages.trait == null ? 50 : reglages.trait) - 50) / 400 - (reglages.lum || 0) / 500;
      var lisse = flou(N, w, h, 1);
      for (i = 0; i < n; i++) { var noir = lisse[i] / FN[i] < seuil; d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = noir ? 0 : 255; }
    }
    x.putImageData(im, 0, 0);
    return out;
  }

  // ---------------------------------------------------------------- PDF (images JPEG, une par page)
  function fabriquerPdf(jpegs) {   // jpegs : [{ octets: Uint8Array, w, h }]
    var morceaux = [], pos = 0, offsets = [], enc = new TextEncoder();
    function ecrire(x) { var b = typeof x === "string" ? enc.encode(x) : x; morceaux.push(b); pos += b.length; }
    function objet(num, corps, flux) {
      offsets[num] = pos;
      ecrire(num + " 0 obj\n" + corps + "\n");
      if (flux) { ecrire("stream\n"); ecrire(flux); ecrire("\nendstream\n"); }
      ecrire("endobj\n");
    }
    ecrire("%PDF-1.4\n"); ecrire(new Uint8Array([37, 226, 227, 207, 211, 10]));
    var kids = [], num = 3;
    jpegs.forEach(function () { kids.push(num + " 0 R"); num += 3; });
    objet(1, "<< /Type /Catalog /Pages 2 0 R >>");
    objet(2, "<< /Type /Pages /Kids [" + kids.join(" ") + "] /Count " + jpegs.length + " >>");
    num = 3;
    jpegs.forEach(function (j) {
      // Taille de page : l'image à 150 points par pouce au plus, et jamais plus grande qu'un A4 (en gardant ses proportions).
      var dpi = Math.max(150, Math.max(j.w, j.h) / 11.69, Math.min(j.w, j.h) / 8.27), pw = (j.w * 72 / dpi).toFixed(2), ph = (j.h * 72 / dpi).toFixed(2);
      var contenu = "q " + pw + " 0 0 " + ph + " 0 0 cm /Im0 Do Q";
      objet(num, "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 " + pw + " " + ph + "] /Resources << /XObject << /Im0 " + (num + 2) + " 0 R >> >> /Contents " + (num + 1) + " 0 R >>");
      objet(num + 1, "<< /Length " + contenu.length + " >>", enc.encode(contenu));
      objet(num + 2, "<< /Type /XObject /Subtype /Image /Width " + j.w + " /Height " + j.h + " /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length " + j.octets.length + " >>", j.octets);
      num += 3;
    });
    var xref = pos, t = "xref\n0 " + num + "\n0000000000 65535 f \n";
    for (var i = 1; i < num; i++) t += ("0000000000" + offsets[i]).slice(-10) + " 00000 n \n";
    ecrire(t + "trailer\n<< /Size " + num + " /Root 1 0 R >>\nstartxref\n" + xref + "\n%%EOF\n");
    return new Blob(morceaux, { type: "application/pdf" });
  }
  function versJpeg(c) {
    return new Promise(function (ok, ko) {
      if (c.toBlob) c.toBlob(function (b) { if (!b) return ko(new Error("Image impossible à préparer.")); ok(b); }, "image/jpeg", QUALITE);
      else { var u = c.toDataURL("image/jpeg", QUALITE), s = atob(u.split(",")[1]), a = new Uint8Array(s.length); for (var i = 0; i < s.length; i++) a[i] = s.charCodeAt(i); ok(new Blob([a], { type: "image/jpeg" })); }
    });
  }
  function octetsDe(blob) {
    if (blob.arrayBuffer) return blob.arrayBuffer().then(function (b) { return new Uint8Array(b); });
    return new Promise(function (ok, ko) { var r = new FileReader(); r.onload = function () { ok(new Uint8Array(r.result)); }; r.onerror = ko; r.readAsArrayBuffer(blob); });
  }
  function base64De(blob) {
    return new Promise(function (ok, ko) { var r = new FileReader(); r.onload = function () { var u = String(r.result); ok(u.slice(u.indexOf(",") + 1)); }; r.onerror = function () { ko(new Error("Lecture impossible.")); }; r.readAsDataURL(blob); });
  }

  // ---------------------------------------------------------------- l'écran
  var cssPose = false;
  // Case « Lire les informations » : le choix reste sur l'appareil.
  function lireCoche() { try { return localStorage.getItem("origami_scanner_lire") === "1"; } catch (e) { return false; } }
  function lireGarder(oui) { try { if (oui) localStorage.setItem("origami_scanner_lire", "1"); else localStorage.removeItem("origami_scanner_lire"); } catch (e) {} }
  var lectureChargee = null;
  function chargerLecture() {
    if (global.OrigamiLecture) return Promise.resolve(global.OrigamiLecture);
    if (lectureChargee) return lectureChargee;
    var o = optionsLecture && typeof optionsLecture === "object" && optionsLecture.url ? String(optionsLecture.url) : ICI.split("?")[0].replace(/[^\/]*$/, "") + "lecture.js" + (ICI.indexOf("?") > 0 ? ICI.slice(ICI.indexOf("?")) : "");
    lectureChargee = new Promise(function (ok, ko) {
      var s = document.createElement("script"); s.src = o; s.async = true; s.charset = "utf-8";
      s.onload = function () { if (global.OrigamiLecture) ok(global.OrigamiLecture); else ko(new Error("La lecture n'est pas disponible.")); };
      s.onerror = function () { lectureChargee = null; ko(new Error("La lecture n'a pas pu être chargée (connexion ?).")); };
      document.head.appendChild(s);
    });
    return lectureChargee;
  }
  var optionsLecture = null;
  function poserCss() { if (cssPose) return; cssPose = true; var s = document.createElement("style"); s.id = "origami-scanner-css"; s.textContent = CSS; document.head.appendChild(s); }

  function ouvrir(options) {
    optionsLecture = options && options.lecture;
    options = options || {};
    poserCss();
    return new Promise(function (resoudre) {
      var racine = el("div", "osc"), pages = [], courante = -1, etape = "", fini = false, remplacer = null;
      var nomBase = String(options.nom || "ticket").replace(/[\\\/:*?"<>|]+/g, " ").trim() || "ticket";
      var multipage = options.multipage !== false;
      racine.style.setProperty("--osc-accent", options.couleur || "#2f6bff");
      racine.setAttribute("role", "dialog"); racine.setAttribute("aria-modal", "true"); racine.setAttribute("aria-label", options.titre || "Scanner un ticket");
      var ancienFocus = document.activeElement, ancienDebord = document.documentElement.style.overflow;
      document.documentElement.style.overflow = "hidden";
      document.body.appendChild(racine);

      var entreePhoto = el("input"); entreePhoto.type = "file"; entreePhoto.accept = "image/*"; entreePhoto.setAttribute("capture", "environment"); entreePhoto.hidden = true;
      var entreeImage = el("input"); entreeImage.type = "file"; entreeImage.accept = "image/*"; entreeImage.multiple = multipage; entreeImage.hidden = true;
      racine.appendChild(entreePhoto); racine.appendChild(entreeImage);
      var contenu = el("div"); contenu.style.cssText = "display:contents"; racine.appendChild(contenu);

      function fermer(resultat) {
        if (fini) return; fini = true; arreterCamera();
        window.removeEventListener("resize", surTaille); document.removeEventListener("keydown", surTouche, true);
        racine.remove(); document.documentElement.style.overflow = ancienDebord;
        try { if (ancienFocus && ancienFocus.focus) ancienFocus.focus(); } catch (e) {}
        resoudre(resultat || null);
      }
      function attente(texte) {
        var a = el("div", "osc-attente", texte || "Un instant…"); racine.appendChild(a);
        return function () { a.remove(); };
      }
      function plusTard(f) { return new Promise(function (ok, ko) { setTimeout(function () { try { ok(f()); } catch (e) { ko(e); } }, 30); }); }
      function question(texte, oui, nonTexte, ouiTexte) {
        var v = el("div", "osc-voile"), q = el("div", "osc-question", "<p>" + texte + '</p><div class="osc-rang">' + bouton("q-non", nonTexte || "Annuler", "", "t") + bouton("q-oui", ouiTexte || "Oui", "", "p") + "</div>");
        racine.appendChild(v); racine.appendChild(q);
        q.addEventListener("click", function (ev) { var b = ev.target.closest("[data-osc]"); if (!b) return; v.remove(); q.remove(); if (b.getAttribute("data-osc") === "q-oui") oui(); });
        q.querySelector('[data-osc="q-oui"]').focus();
      }
      function avertir(texte) {
        var v = el("div", "osc-voile"), q = el("div", "osc-question", "<p>" + texte + '</p><div class="osc-rang">' + bouton("q-ok", "D'accord", "", "p") + "</div>");
        racine.appendChild(v); racine.appendChild(q);
        q.addEventListener("click", function (ev) { if (ev.target.closest("[data-osc]")) { v.remove(); q.remove(); } });
      }
      function annuler() { if (pages.length) question("Abandonner ce scan ? " + (pages.length > 1 ? "Les " + pages.length + " pages seront perdues." : "La page sera perdue."), function () { fermer(null); }, "Continuer", "Abandonner"); else fermer(null); }

      // ---- écran de départ : prendre une photo ou choisir une image
      function ecranDepart() {
        etape = "depart"; arreterCamera();
        // Une page de plus (pages déjà faites) : « Retour » ramène aux pages, sans rien perdre ; « Annuler » ne sert qu'au tout début.
        var h = '<div class="osc-haut">' + (pages.length ? bouton("retour-pages", "Retour", "", "t", "Revenir aux pages déjà faites") : bouton("annuler", "Annuler", "", "t")) + '<div class="osc-titre">' + (pages.length ? "Page " + (pages.length + 1) : (options.titre || "Scanner un ticket")) + "</div>" +
          (pages.length ? bouton("terminer", "Terminer", "", "p") : '<span style="width:72px"></span>') + "</div>";
        h += '<div class="osc-depart">' + bouton("photo", "Prendre une photo", "photo", "p t") + bouton("image", "Choisir une image", "image", "t") +
          '<div class="osc-depose" data-depose>…ou dépose une image ici</div><p>Pose le ticket à plat sur un fond plus foncé que lui, avec une bonne lumière : les coins seront trouvés tout seuls.</p></div>';
        contenu.innerHTML = h;
        var z = contenu.querySelector("[data-depose]");
        if (!window.matchMedia || !window.matchMedia("(pointer:fine)").matches) z.hidden = true;
        z.addEventListener("dragover", function (ev) { ev.preventDefault(); z.classList.add("sur"); });
        z.addEventListener("dragleave", function () { z.classList.remove("sur"); });
        z.addEventListener("drop", function (ev) { ev.preventDefault(); z.classList.remove("sur"); recevoir(Array.prototype.slice.call(ev.dataTransfer.files || [])); });
      }
      function recevoir(fichiers) {
        fichiers = fichiers.filter(function (f) { return /^image\//.test(f.type || ""); });
        if (!fichiers.length) { avertir("Choisis une image (photo du ticket)."); return; }
        var fin = attente("Lecture de la photo…"), premier = remplacer != null ? remplacer : pages.length, ou = premier;
        remplacer = null;
        fichiers.reduce(function (p, f) {
          return p.then(function () { return chargerImage(f); }).then(function (c) {
            var pts = detecter(c);
            pages.splice(ou++, 0, { source: c, pts: pts || cadrePlein(c), auto: !!pts, effet: "texte", reglages: { lum: 0, con: 0, trait: 50 }, brut: null, apercu: null, rendu: null });
          });
        }, Promise.resolve()).then(function () { fin(); ecranRecadrer(premier); }, function (e) { fin(); if (pages.length > premier) ecranRecadrer(premier); else avertir(e.message); });
      }
      entreePhoto.addEventListener("change", function () { var f = Array.prototype.slice.call(entreePhoto.files || []); entreePhoto.value = ""; if (f.length) recevoir(f); });
      entreeImage.addEventListener("change", function () { var f = Array.prototype.slice.call(entreeImage.files || []); entreeImage.value = ""; if (f.length) recevoir(f); });

      // ---- caméra en direct (ordinateur) : sur téléphone, « Prendre une photo » ouvre l'appareil photo du téléphone (entreePhoto, capture).
      // options.camera : false = jamais la caméra en direct (par exemple une coquille qui n'a pas le droit d'ouvrir la caméra).
      var flux = null, cameras = [], cameraNo = -1, video = null;
      function cameraEnDirect() {
        if (options.camera === false) return false;
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return false;
        if (options.camera === true) return true;
        return !!(window.matchMedia && window.matchMedia("(pointer:fine)").matches && !window.matchMedia("(pointer:coarse)").matches);
      }
      function arreterCamera() {
        if (flux) { try { flux.getTracks().forEach(function (t) { t.stop(); }); } catch (e) {} flux = null; }
        if (video) { try { video.srcObject = null; } catch (e) {} video = null; }
      }
      function ecranCamera() {
        etape = "camera"; arreterCamera();
        contenu.innerHTML = '<div class="osc-haut">' + bouton("retour-camera", "Retour", "", "t") + '<div class="osc-titre">' + (pages.length ? "Page " + (pages.length + 1) : "Prendre une photo") + "</div>" +
          '<span data-cam-autre style="min-width:72px;display:flex;justify-content:flex-end"></span></div>' +
          '<div class="osc-camera"><video playsinline muted autoplay></video></div>' +
          '<div class="osc-bas"><div class="osc-aide" data-cam-aide>Ouverture de la caméra…</div><div class="osc-rang"><button type="button" class="osc-declencher" data-osc="declencher" aria-label="Prendre la photo" title="Prendre la photo" disabled></button></div></div>';
        video = contenu.querySelector("video");
        demarrerCamera();
      }
      function demarrerCamera() {
        if (flux) { try { flux.getTracks().forEach(function (t) { t.stop(); }); } catch (e) {} flux = null; }
        var c = { width: { ideal: 3840 }, height: { ideal: 2160 } };
        if (cameraNo >= 0 && cameras[cameraNo]) c.deviceId = { exact: cameras[cameraNo].deviceId }; else c.facingMode = { ideal: "environment" };
        var v = video;
        navigator.mediaDevices.getUserMedia({ video: c, audio: false }).then(function (s) {
          if (fini || etape !== "camera" || video !== v) { s.getTracks().forEach(function (t) { t.stop(); }); return; }
          flux = s; v.srcObject = s;
          var p = v.play(); if (p && p.catch) p.catch(function () {});
          var pret = function () { var b = contenu.querySelector('[data-osc="declencher"]'); if (b) { b.disabled = false; try { b.focus(); } catch (e) {} } var a = contenu.querySelector("[data-cam-aide]"); if (a) a.textContent = "Tiens le ticket bien à plat devant la caméra, sur un fond plus foncé que lui."; };
          if (v.readyState >= 2) pret(); else v.addEventListener("loadeddata", pret, { once: true });
          if (navigator.mediaDevices.enumerateDevices) navigator.mediaDevices.enumerateDevices().then(function (l) {
            cameras = l.filter(function (d) { return d.kind === "videoinput"; });
            var piste = s.getVideoTracks()[0], reglage = piste && piste.getSettings ? piste.getSettings() : {};
            cameras.forEach(function (d, i) { if (reglage.deviceId && d.deviceId === reglage.deviceId) cameraNo = i; });
            var z = contenu.querySelector("[data-cam-autre]");
            if (z && video === v) z.innerHTML = cameras.length > 1 ? bouton("autre-camera", "Autre caméra", "camera", "t", "Changer de caméra") : "";
          }, function () {});
        }, function (e) {
          if (fini || etape !== "camera" || video !== v) return;
          var nom = e && e.name;
          ecranDepart();
          if (nom === "NotAllowedError" || nom === "SecurityError") avertir("La caméra n'est pas autorisée. Sur Mac : Réglages Système › Confidentialité et sécurité › Caméra, coche l'appli ou le navigateur, puis réessaie. Tu peux aussi choisir une image.");
          else if (nom === "NotFoundError" || nom === "OverconstrainedError") avertir("Aucune caméra trouvée sur cet appareil. Tu peux choisir une image ou en déposer une.");
          else if (nom === "NotReadableError") avertir("La caméra est déjà utilisée par une autre appli. Ferme-la, puis réessaie.");
          else avertir("La caméra n'a pas pu s'ouvrir. Tu peux choisir une image ou en déposer une.");
        });
      }
      function declencher() {
        var v = video;
        if (!v || !flux || !v.videoWidth) return;
        var c = document.createElement("canvas"); c.width = v.videoWidth; c.height = v.videoHeight;
        c.getContext("2d").drawImage(v, 0, 0, c.width, c.height);
        var e = el("div", "osc-eclair"); var sc = contenu.querySelector(".osc-camera"); if (sc) { sc.appendChild(e); requestAnimationFrame(function () { e.style.opacity = "0"; }); }
        var b = contenu.querySelector('[data-osc="declencher"]'); if (b) b.disabled = true;
        c.toBlob(function (blob) {
          if (fini) return;
          if (!blob) { if (b) b.disabled = false; avertir("La photo n'a pas pu être prise. Réessaie."); return; }
          arreterCamera();
          var f; try { f = new File([blob], "photo.jpg", { type: "image/jpeg" }); } catch (x) { f = blob; f.name = "photo.jpg"; }
          recevoir([f]);
        }, "image/jpeg", 0.92);
      }

      // ---- recadrage : 4 coins + 4 milieux de bords, loupe pendant qu'on déplace
      var vue = null, prise = null;
      function ecranRecadrer(i) {
        etape = "recadrer"; courante = i;
        var pg = pages[i];
        contenu.innerHTML = '<div class="osc-haut">' + bouton("retour-depart", "Reprendre", "", "t") + '<div class="osc-titre">Recadrer' + (pages.length > 1 ? " · page " + (i + 1) + " sur " + pages.length : "") + "</div>" + bouton("vers-effets", "Suivant", "", "p") + "</div>" +
          '<div class="osc-scene"><canvas></canvas><svg class="osc-svg"></svg></div>' +
          '<div class="osc-bas"><div class="osc-aide">' + (pg.auto ? "Les bords ont été trouvés. Déplace les points pour ajuster." : "Déplace les points sur les coins du ticket.") + '</div><div class="osc-rang">' +
          bouton("gauche", "Tourner", "gauche", "", "Tourner à gauche") + bouton("droite", "Tourner", "droite", "", "Tourner à droite") + bouton("auto", "Bords auto", "auto", "", "Trouver les bords") + bouton("tout", "Image entière", "cadre", "", "Prendre l'image entière") + "</div></div>";
        dessinerScene();
        var svg = contenu.querySelector(".osc-svg");
        svg.addEventListener("pointerdown", surAppui);
        svg.addEventListener("pointermove", surDeplacement);
        svg.addEventListener("pointerup", surLacher);
        svg.addEventListener("pointercancel", surLacher);
        svg.addEventListener("lostpointercapture", surLacher);
      }
      function dessinerScene() {
        var pg = pages[courante], scene = contenu.querySelector(".osc-scene");
        if (!scene || !pg) return;
        var W = scene.clientWidth, H = scene.clientHeight, marge = 26, c = pg.source;
        var k = Math.min((W - 2 * marge) / c.width, (H - 2 * marge) / c.height), dw = c.width * k, dh = c.height * k;
        vue = { k: k, ox: (W - dw) / 2, oy: (H - dh) / 2 };
        var cv = scene.querySelector("canvas"), r = window.devicePixelRatio || 1;
        cv.width = Math.round(dw * r); cv.height = Math.round(dh * r);
        cv.style.width = dw + "px"; cv.style.height = dh + "px"; cv.style.left = vue.ox + "px"; cv.style.top = vue.oy + "px";
        var x = cv.getContext("2d"); x.imageSmoothingQuality = "high"; x.drawImage(c, 0, 0, cv.width, cv.height);
        dessinerPoints();
      }
      function ecran(p) { return { x: vue.ox + p.x * vue.k, y: vue.oy + p.y * vue.k }; }
      function milieux(pts) { return [0, 1, 2, 3].map(function (i) { var a = pts[i], b = pts[(i + 1) % 4]; return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; }); }
      function dessinerPoints() {
        var svg = contenu.querySelector(".osc-svg"), pg = pages[courante];
        if (!svg || !pg) return;
        var W = svg.clientWidth, H = svg.clientHeight, P = pg.pts.map(ecran), M = milieux(pg.pts).map(ecran), ok = convexe(pg.pts);
        var poly = P.map(function (p) { return p.x.toFixed(1) + "," + p.y.toFixed(1); }).join(" ");
        var h = '<path fill="rgba(0,0,0,.55)" fill-rule="evenodd" d="M0 0H' + W + "V" + H + "H0Z M" + P.map(function (p) { return p.x.toFixed(1) + " " + p.y.toFixed(1); }).join(" L") + 'Z"/>';
        h += '<polygon points="' + poly + '" fill="none" stroke="' + (ok ? "var(--osc-accent)" : "#ff5a4f") + '" stroke-width="2.5"/>';
        M.forEach(function (p, i) {
          var a = P[i], b = P[(i + 1) % 4], ang = Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI;
          h += '<g transform="translate(' + p.x.toFixed(1) + " " + p.y.toFixed(1) + ") rotate(" + ang.toFixed(1) + ')"><rect x="-13" y="-4.5" width="26" height="9" rx="4.5" fill="#fff" stroke="' + (prise && prise.bord === i ? "var(--osc-accent)" : "rgba(0,0,0,.35)") + '" stroke-width="2"/></g>';
        });
        P.forEach(function (p, i) {
          var actif = prise && prise.coin === i;
          h += '<circle cx="' + p.x.toFixed(1) + '" cy="' + p.y.toFixed(1) + '" r="' + (actif ? 13 : 11) + '" fill="' + (actif ? "var(--osc-accent)" : "rgba(255,255,255,.25)") + '" stroke="#fff" stroke-width="3"/>';
        });
        svg.innerHTML = h;
      }
      function pointDe(ev) { var r = contenu.querySelector(".osc-svg").getBoundingClientRect(); return { x: ev.clientX - r.left, y: ev.clientY - r.top }; }
      function surAppui(ev) {
        var pg = pages[courante], q = pointDe(ev), P = pg.pts.map(ecran), M = milieux(pg.pts).map(ecran), mieux = null, d0 = ev.pointerType === "mouse" ? 22 : 36;
        P.forEach(function (p, i) { var d = dist(p, q); if (d < d0 && (!mieux || d < mieux.d)) mieux = { d: d, coin: i }; });
        if (!mieux) M.forEach(function (p, i) { var d = dist(p, q); if (d < d0 && (!mieux || d < mieux.d)) mieux = { d: d, bord: i }; });
        if (!mieux) return;
        ev.preventDefault();
        prise = { coin: mieux.coin, bord: mieux.bord, id: ev.pointerId, depart: q, pts: pg.pts.map(function (p) { return { x: p.x, y: p.y }; }) };
        try { ev.currentTarget.setPointerCapture(ev.pointerId); } catch (e) {}
        pg.auto = false;
        dessinerPoints(); loupe(true);
      }
      function surDeplacement(ev) {
        if (!prise || ev.pointerId !== prise.id) return;
        ev.preventDefault();
        var pg = pages[courante], q = pointDe(ev), dx = (q.x - prise.depart.x) / vue.k, dy = (q.y - prise.depart.y) / vue.k, W = pg.source.width, H = pg.source.height;
        if (prise.coin != null) {
          var o = prise.pts[prise.coin];
          pg.pts[prise.coin] = { x: borne(o.x + dx, 0, W), y: borne(o.y + dy, 0, H) };
        } else {
          // Un bord glisse perpendiculairement à lui-même : ses deux coins bougent ensemble.
          var i = prise.bord, j = (i + 1) % 4, a = prise.pts[i], b = prise.pts[j], ex = b.x - a.x, ey = b.y - a.y, l = Math.hypot(ex, ey) || 1, nx = -ey / l, ny = ex / l, s = dx * nx + dy * ny;
          pg.pts[i] = { x: borne(a.x + nx * s, 0, W), y: borne(a.y + ny * s, 0, H) };
          pg.pts[j] = { x: borne(b.x + nx * s, 0, W), y: borne(b.y + ny * s, 0, H) };
        }
        pg.brut = null;
        dessinerPoints(); loupe(true);
      }
      function surLacher(ev) { if (!prise || (ev && ev.pointerId !== prise.id)) return; prise = null; loupe(false); dessinerPoints(); }
      var zoneLoupe = null;
      function loupe(montrer) {
        var scene = contenu.querySelector(".osc-scene");
        if (!montrer || !prise || !scene) { if (zoneLoupe) { zoneLoupe.remove(); zoneLoupe = null; } return; }
        var pg = pages[courante], r = window.devicePixelRatio || 1, T = 132, Z = 2.6;
        if (!zoneLoupe) { zoneLoupe = el("div", "osc-loupe", "<canvas></canvas>"); scene.appendChild(zoneLoupe); }
        var cible = prise.coin != null ? pg.pts[prise.coin] : milieux(pg.pts)[prise.bord], s = ecran(cible);
        // La loupe se met dans le coin opposé au doigt, pour ne pas être cachée par lui.
        var gauche = s.x > scene.clientWidth / 2 ? 12 : scene.clientWidth - T - 12, haut = s.y > scene.clientHeight / 2 ? 12 : scene.clientHeight - T - 12;
        if (Math.abs(s.x - (gauche + T / 2)) < T && Math.abs(s.y - (haut + T / 2)) < T) haut = haut < 20 ? scene.clientHeight - T - 12 : 12;
        zoneLoupe.style.left = gauche + "px"; zoneLoupe.style.top = haut + "px";
        var cv = zoneLoupe.firstChild; cv.width = cv.height = Math.round(T * r);
        var x = cv.getContext("2d"), e = vue.k * Z * r, taille = T * r / e;
        x.fillStyle = "#000"; x.fillRect(0, 0, cv.width, cv.height);
        x.imageSmoothingQuality = "high";
        x.drawImage(pg.source, cible.x - taille / 2, cible.y - taille / 2, taille, taille, 0, 0, cv.width, cv.height);
        x.save(); x.translate(cv.width / 2, cv.height / 2); x.scale(e, e); x.translate(-cible.x, -cible.y);
        x.strokeStyle = getComputedStyle(racine).getPropertyValue("--osc-accent") || "#2f6bff"; x.lineWidth = 2 / e;
        x.beginPath(); pg.pts.forEach(function (p, i) { if (i) x.lineTo(p.x, p.y); else x.moveTo(p.x, p.y); }); x.closePath(); x.stroke(); x.restore();
        x.strokeStyle = "#fff"; x.lineWidth = 1.5 * r; var m = cv.width / 2;
        x.beginPath(); x.moveTo(m - 10 * r, m); x.lineTo(m + 10 * r, m); x.moveTo(m, m - 10 * r); x.lineTo(m, m + 10 * r); x.stroke();
      }
      function tournerPage(sens) {
        var pg = pages[courante], W = pg.source.width, H = pg.source.height;
        pg.source = tourner(pg.source, sens);
        pg.pts = pg.pts.map(function (p) { return sens > 0 ? { x: H - p.y, y: p.x } : { x: p.y, y: W - p.x }; });
        // Les coins restent dans l'ordre haut-gauche, haut-droit, bas-droit, bas-gauche.
        if (sens > 0) pg.pts.unshift(pg.pts.pop()); else pg.pts.push(pg.pts.shift());
        pg.brut = null; dessinerScene();
      }

      // ---- effets
      function preparerPage(pg) {
        if (pg.brut) return;
        pg.brut = redresser(pg.source, pg.pts, MAX_SORTIE);
        pg.apercu = reduire(pg.brut, MAX_APERCU);
        pg.vignette = reduire(pg.brut, 360);
        pg.rendu = null;
      }
      function ecranEffets(i) {
        var pg = pages[i];
        if (!convexe(pg.pts)) { avertir("Les points se croisent : remets-les sur les quatre coins du ticket."); return; }
        var fin = attente("Redressement…");
        plusTard(function () { preparerPage(pg); }).then(function () {
          fin(); etape = "effets"; courante = i;
          contenu.innerHTML = '<div class="osc-haut">' + bouton("recadrer", "Recadrer", "", "t") + '<div class="osc-titre">Effets' + (pages.length > 1 ? " · page " + (i + 1) + " sur " + pages.length : "") + "</div>" + bouton("terminer", multipage ? "Terminer" : "Valider", "", "p") + "</div>" +
            '<div class="osc-scene"><canvas></canvas></div><div class="osc-bas"><div class="osc-effets" role="group" aria-label="Effets"></div><div class="osc-reglages"></div>' + (options.lecture ? '<label class="osc-lire"><input type="checkbox" data-osc-lire' + (lireCoche() ? " checked" : "") + '> Lire les informations <small>(montant, date, fournisseur, TVA)</small></label>' : "") +
            (multipage ? '<div class="osc-rang fin"><div class="osc-pages"></div><div>' + (pages.length > 1 ? bouton("suppr-page", "Retirer", "corbeille", "", "Retirer cette page") : "") + bouton("ajouter", "Page", "plus", "t", "Ajouter une page") + "</div></div>" : "") + "</div>";
          var zEffets = contenu.querySelector(".osc-effets");
          EFFETS.forEach(function (e) {
            var b = el("button", "osc-effet"); b.type = "button"; b.setAttribute("data-effet", e.id); b.setAttribute("aria-pressed", String(pg.effet === e.id));
            var v = appliquer(pg.vignette, e.id, { lum: 0, con: 0, trait: 50 }), c = toile(64 * 2, 64 * 2), x = c.getContext("2d"), k = Math.max(c.width / v.width, c.height / v.height);
            x.drawImage(v, (c.width - v.width * k) / 2, 0, v.width * k, v.height * k);
            b.appendChild(c); b.appendChild(document.createTextNode(e.nom)); zEffets.appendChild(b);
          });
          dessinerReglages(); rendreApercu(); dessinerPages();
        }, function (e) { fin(); avertir("Le redressement n'a pas marché : " + e.message); });
      }
      function dessinerReglages() {
        var pg = pages[courante], z = contenu.querySelector(".osc-reglages"), l = [];
        if (pg.effet === "nb") l.push(["trait", "Trait", 0, 100, pg.reglages.trait]);
        l.push(["lum", "Luminosité", -50, 50, pg.reglages.lum]);
        if (pg.effet !== "nb") l.push(["con", "Contraste", -50, 50, pg.reglages.con]);
        z.innerHTML = l.map(function (r) { return '<label for="osc-' + r[0] + '">' + r[1] + '</label><input type="range" id="osc-' + r[0] + '" data-reglage="' + r[0] + '" min="' + r[2] + '" max="' + r[3] + '" step="1" value="' + r[4] + '"><output>' + r[4] + "</output>"; }).join("");
      }
      var minuterieApercu = 0;
      function rendreApercu() {
        var pg = pages[courante], scene = contenu.querySelector(".osc-scene");
        if (!scene) return;
        var cv = scene.querySelector("canvas"), img = appliquer(pg.apercu, pg.effet, pg.reglages), W = scene.clientWidth - 24, H = scene.clientHeight - 24;
        var k = Math.min(W / img.width, H / img.height), dw = img.width * k, dh = img.height * k;
        cv.width = img.width; cv.height = img.height; cv.getContext("2d").drawImage(img, 0, 0);
        cv.style.width = dw + "px"; cv.style.height = dh + "px"; cv.style.left = (scene.clientWidth - dw) / 2 + "px"; cv.style.top = (scene.clientHeight - dh) / 2 + "px";
        pg.rendu = null;
        pg.miniature = reduire(img, 120);
        dessinerPages();
      }
      function dessinerPages() {
        var z = contenu.querySelector(".osc-pages");
        if (!z) return;
        z.innerHTML = "";
        pages.forEach(function (p, i) {
          var b = el("button", "osc-page"); b.type = "button"; b.setAttribute("data-page", i); b.setAttribute("aria-label", "Page " + (i + 1)); if (i === courante) b.setAttribute("aria-current", "true");
          var src = p.miniature || p.vignette || reduire(p.source, 120), c = toile(src.width, src.height); c.getContext("2d").drawImage(src, 0, 0);
          b.appendChild(c); b.appendChild(el("span", "", String(i + 1))); z.appendChild(b);
        });
      }

      // ---- fin : PDF de toutes les pages
      function terminer() {
        if (etape === "recadrer" && !convexe(pages[courante].pts)) { avertir("Les points se croisent : remets-les sur les quatre coins du ticket."); return; }
        var fin = attente(pages.length > 1 ? "Préparation du PDF (" + pages.length + " pages)…" : "Préparation du PDF…"), images = [], jpegs = [];
        pages.reduce(function (p, pg) {
          return p.then(function () { return plusTard(function () { preparerPage(pg); return appliquer(pg.brut, pg.effet, pg.reglages); }); }).then(function (c) {
            return versJpeg(c).then(function (b) { images.push(b); return octetsDe(b).then(function (o) { jpegs.push({ octets: o, w: c.width, h: c.height }); }); });
          });
        }, Promise.resolve()).then(function () {
          var pdf = fabriquerPdf(jpegs);
          fin();
          var resultat = { pdf: pdf, nom: nomBase + "-" + aujourdhui() + ".pdf", type: "application/pdf", pages: pages.length, images: images, base64: function () { return base64De(pdf); } };
          if (!(options.lecture && lireCoche())) return fermer(resultat);
          // Lecture des informations : sur l'appareil ; un échec n'empêche jamais de garder le scan.
          var finL = attente("Lecture du ticket…"), zone = racine.querySelector(".osc-attente:last-child");
          chargerLecture().then(function (L) {
            return L.lire(images, { suivi: function (quoi, p) { if (zone) zone.textContent = (/recogni/.test(quoi) ? "Lecture du ticket… " : "Préparation du lecteur (une seule fois)… ") + Math.round(p * 100) + " %"; } });
          }).then(function (infos) { resultat.infos = infos; }, function (e) { resultat.lecture = { souci: (e && e.message) || "La lecture n'a pas abouti." }; })
            .then(function () { finL(); fermer(resultat); });
        }).catch(function (e) { fin(); avertir("Le PDF n'a pas pu être préparé : " + (e && e.message || e)); });
      }

      // ---- gestes
      racine.addEventListener("change", function (ev) { if (ev.target && ev.target.hasAttribute && ev.target.hasAttribute("data-osc-lire")) lireGarder(ev.target.checked); });
      racine.addEventListener("click", function (ev) {
        var b = ev.target.closest("[data-osc],[data-effet],[data-page]");
        if (!b || !racine.contains(b)) return;
        var a = b.getAttribute("data-osc");
        if (b.hasAttribute("data-effet")) {
          var pg = pages[courante]; pg.effet = b.getAttribute("data-effet");
          Array.prototype.forEach.call(contenu.querySelectorAll("[data-effet]"), function (x) { x.setAttribute("aria-pressed", String(x === b)); });
          dessinerReglages(); rendreApercu(); return;
        }
        if (b.hasAttribute("data-page")) { var n = Number(b.getAttribute("data-page")); if (n !== courante) ecranEffets(n); else ecranRecadrer(n); return; }
        if (a === "annuler") annuler();
        else if (a === "photo") { if (cameraEnDirect()) ecranCamera(); else if (options.sansCamera) avertir(options.sansCamera); else entreePhoto.click(); }
        else if (a === "declencher") declencher();
        else if (a === "autre-camera") { if (cameras.length > 1) { cameraNo = (cameraNo + 1) % cameras.length; demarrerCamera(); } }
        else if (a === "retour-camera") ecranDepart();
        else if (a === "retour-pages") { remplacer = null; if (pages.length) ecranEffets(Math.max(0, Math.min(courante, pages.length - 1))); else ecranDepart(); }
        else if (a === "image") entreeImage.click();
        else if (a === "retour-depart") {
          question("Reprendre une autre photo pour cette page ? Celle-ci sera abandonnée.", function () { pages.splice(courante, 1); remplacer = courante; ecranDepart(); }, "Garder", "Reprendre");
        }
        else if (a === "vers-effets") ecranEffets(courante);
        else if (a === "recadrer") ecranRecadrer(courante);
        else if (a === "gauche") tournerPage(-1);
        else if (a === "droite") tournerPage(1);
        else if (a === "auto") { var pa = pages[courante], t = detecter(pa.source); if (t) { pa.pts = t; pa.auto = true; pa.brut = null; dessinerPoints(); contenu.querySelector(".osc-aide").textContent = "Les bords ont été trouvés. Déplace les points pour ajuster."; } else contenu.querySelector(".osc-aide").textContent = "Bords pas trouvés tout seuls : place les points à la main (un fond plus foncé que le ticket aide)."; }
        else if (a === "tout") { var pt = pages[courante], W = pt.source.width, H = pt.source.height; pt.pts = [{ x: 0, y: 0 }, { x: W, y: 0 }, { x: W, y: H }, { x: 0, y: H }]; pt.brut = null; dessinerPoints(); }
        else if (a === "ajouter") ecranDepart();
        else if (a === "suppr-page") question("Retirer la page " + (courante + 1) + " ?", function () { pages.splice(courante, 1); ecranEffets(Math.min(courante, pages.length - 1)); }, "Garder", "Retirer");
        else if (a === "terminer") terminer();
      });
      racine.addEventListener("input", function (ev) {
        var r = ev.target.getAttribute && ev.target.getAttribute("data-reglage");
        if (!r) return;
        pages[courante].reglages[r] = Number(ev.target.value);
        ev.target.nextElementSibling.textContent = ev.target.value;
        clearTimeout(minuterieApercu); minuterieApercu = setTimeout(rendreApercu, 40);
      });
      function surTaille() { if (etape === "recadrer") dessinerScene(); else if (etape === "effets") rendreApercu(); }
      function surTouche(ev) {
        if (ev.key === "Escape") { ev.stopPropagation(); ev.preventDefault(); var q = racine.querySelector(".osc-question"); if (q) { q.previousElementSibling.remove(); q.remove(); } else if (etape === "camera") ecranDepart(); else if (etape === "depart" && pages.length) { remplacer = null; ecranEffets(Math.max(0, Math.min(courante, pages.length - 1))); } else annuler(); }
      }
      window.addEventListener("resize", surTaille);
      document.addEventListener("keydown", surTouche, true);

      if (options.fichier) { ecranDepart(); recevoir([options.fichier]); }
      else ecranDepart();
    });
  }

  global.OrigamiScanner = { version: VERSION, ouvrir: ouvrir, _interne: { detecter: detecter, redresser: redresser, appliquer: appliquer, fabriquerPdf: fabriquerPdf, convexe: convexe } };
})(typeof window !== "undefined" ? window : this);
