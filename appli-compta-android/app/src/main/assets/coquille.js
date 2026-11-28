// Posé par l'appli Android dans la page d'accueil de la Compta (sevanegu-pixel.github.io/origami/), dans l'appli seulement.
(function () {
  // Le bandeau « Installer Compta » n'a pas de sens ici : l'appli est déjà installée.
  try { localStorage.setItem("origami_install_masque", String(Date.now() + 3650 * 864e5)); } catch (e) {}

  // ---- « Ouvrir dans Boîte mail » (28.11) ----
  // Même échange que la page Origami du Mac : la Compta demande (« boite-demande ») si un brouillon peut s'ouvrir dans l'appli
  // Boîte mail ; si l'appli Boîte mail Android est installée, on dit oui, et le brouillon préparé (PDF joint) s'y ouvre par une
  // adresse boitemail://brouillon?… confiée à Android. Seulement le chemin « brouillon » : le chemin direct (fenêtre d'écriture
  // tout de suite, PDF ensuite) demanderait de rouvrir la Boîte mail depuis l'arrière-plan, ce qu'Android interdit.
  var ID_GMAIL = /^[A-Za-z0-9_-]{6,40}$/;
  var ADRESSE = /^[^\s@"<>]{1,64}@[^\s@"<>]{1,120}$/;
  function installee() { try { return !!(window.ComptaTel && window.ComptaTel.boiteInstallee()); } catch (e) { return false; } }
  function deLaCompta(ev) {
    if (!/^https:\/\/([a-z0-9-]+\.)*(script\.google\.com|googleusercontent\.com)$/.test(ev.origin)) return false;
    var cadre = document.getElementById("app"), w = ev.source;
    if (!cadre) return false;
    try { for (var i = 0; w && i < 6; i++) { if (w === cadre.contentWindow) return true; if (w === w.parent) break; w = w.parent; } } catch (e) {}
    return false;
  }
  function adresseBrouillon(d) {
    if (!ID_GMAIL.test(d.conversation || "")) return "";
    var u = "boitemail://brouillon?";
    var boite = String(d.boite || "");
    if (ADRESSE.test(boite)) u += "boite=" + encodeURIComponent(boite) + "&";
    return u + "conversation=" + encodeURIComponent(d.conversation) + "&fenetre=seule";
  }
  window.addEventListener("message", function (ev) {
    var d = ev.data;
    if (!d || typeof d !== "object" || !deLaCompta(ev)) return;
    function dire(m) { try { ev.source.postMessage(m, ev.origin); } catch (e) {} }
    if (d.origami === "boite-demande") { dire({ origami: "boite", dispo: installee(), directe: false, liens: false }); return; }
    if (d.origami === "boite-ouvrir") {
      var n = typeof d.n === "number" ? d.n : 0, u = d.geste === "brouillon" ? adresseBrouillon(d) : "", ok = false;
      if (u) { try { ok = !!window.ComptaTel.ouvrirBoite(u); } catch (e) { ok = false; } }
      dire({ origami: ok ? "boite-ouverte" : "boite-refus", n: n });
    }
  });
})();
