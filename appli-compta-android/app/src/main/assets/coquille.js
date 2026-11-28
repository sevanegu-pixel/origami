// Posé par l'appli Android dans la page d'accueil de la Compta (sevanegu-pixel.github.io/origami/), dans l'appli seulement.
// Le bandeau « Installer Compta » n'a pas de sens ici : l'appli est déjà installée.
(function () {
  try { localStorage.setItem("origami_install_masque", String(Date.now() + 3650 * 864e5)); } catch (e) {}
})();
