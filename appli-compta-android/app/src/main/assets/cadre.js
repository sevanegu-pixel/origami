// Posé par l'appli Android dans les cadres Google de la Compta (jamais dans la Compta web ni dans Origami).
// 1) Champs à remplir plus petits (le texte y était plus gros que partout ailleurs).
// 2) Clavier ouvert : la barre des onglets du bas et le bouton « + » s'effacent, pour ne pas rester devant la saisie.
// 3) Couleurs de la barre du haut et de celle du bas données à Android, pour que l'heure et les boutons d'Android soient posés
//    sur la même couleur que l'appli (selon l'apparence choisie).
(function () {
  if (window.__comptaTel) return;
  window.__comptaTel = 1;
  var CSS =
    ".champ input,.champ select,.selecteur{font-size:14px!important;min-height:40px!important;padding-top:8px!important;padding-bottom:8px!important}" +
    ".champ textarea{font-size:14px!important;min-height:72px!important;padding-top:8px!important;padding-bottom:8px!important}" +
    "html.tel-clavier .nav,html.tel-clavier .fab{display:none!important}";
  var hauteurMax = 0, largeur = 0, dernier = "";
  function couleur(el) {
    var c = "";
    try { while (el) { c = getComputedStyle(el).backgroundColor; if (c && !/^rgba\(.*,\s*0\)$|^transparent$/.test(c)) return c; el = el.parentElement; } } catch (e) {}
    return "";
  }
  function tour() {
    var d = document;
    if (!d.getElementById("vue") || !d.getElementById("nav")) return;
    if (!d.getElementById("compta-tel")) {
      var s = d.createElement("style"); s.id = "compta-tel"; s.textContent = CSS;
      (d.head || d.documentElement).appendChild(s);
    }
    var h = window.innerHeight, w = window.innerWidth;
    if (w !== largeur) { largeur = w; hauteurMax = h; }
    if (h > hauteurMax) hauteurMax = h;
    var a = d.activeElement;
    var saisie = !!(a && (/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) || a.isContentEditable));
    d.documentElement.classList.toggle("tel-clavier", saisie && h < hauteurMax * 0.8);
    if (window.ComptaTel) {
      var barre = d.querySelector(".barre"), nav = d.getElementById("nav");
      var haut = couleur(barre) || couleur(d.body), bas = couleur(nav) || haut;
      if (haut && haut + "|" + bas !== dernier) { dernier = haut + "|" + bas; try { window.ComptaTel.couleurs(haut, bas); } catch (e) {} }
    }
  }
  // 4) « Télécharger le PDF » : la Compta fabrique le fichier dans la page (adresse blob:) et clique sur un lien « download ».
  //    Android ne sait pas enregistrer ces adresses : le fichier est lu ici et confié à l'appli, qui l'enregistre dans Téléchargements.
  function confier(a) {
    var href = a && a.href || "";
    if (!/^blob:/.test(href) || !a.hasAttribute("download") || !window.ComptaTel || !window.ComptaTel.enregistrer) return false;
    var nom = a.getAttribute("download") || "document.pdf";
    fetch(href).then(function (r) { return r.blob(); }).then(function (b) {
      var lecteur = new FileReader();
      lecteur.onload = function () {
        var s = String(lecteur.result || ""), i = s.indexOf(",");
        try { window.ComptaTel.enregistrer(nom, b.type || "application/octet-stream", i >= 0 ? s.slice(i + 1) : ""); } catch (e) {}
      };
      lecteur.readAsDataURL(b);
    }).catch(function () {});
    return true;
  }
  function brancher() {
    var P = window.HTMLAnchorElement && HTMLAnchorElement.prototype;
    if (!P || P.__comptaTel) return;
    var clic = P.click;
    P.click = function () { if (confier(this)) return; return clic.apply(this, arguments); };
    P.__comptaTel = 1;
    document.addEventListener("click", function (e) {
      var a = e.target && e.target.closest ? e.target.closest("a[download]") : null;
      if (a && confier(a)) e.preventDefault();
    }, true);
  }
  brancher();
  setInterval(brancher, 1000);
  setInterval(tour, 600);
  window.addEventListener("resize", function () { setTimeout(tour, 30); });
  window.addEventListener("focusin", function () { setTimeout(tour, 30); }, true);
  window.addEventListener("focusout", function () { setTimeout(tour, 60); }, true);
})();
