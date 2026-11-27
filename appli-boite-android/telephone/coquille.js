  /* ---------- Appli Android (posé par appli-boite-android/preparer.mjs) ----------
     1. Écran gardé de chaque boîte : sur Android, une adresse « boite://compte/ » devient http://boite.localhost/ pour toutes les boîtes
        (une seule mémoire pour toutes : la boîte B lirait le jeton de la boîte A). Chaque boîte reçoit donc sa « case » bN,
        servie à http://bN.localhost/<compte>/index.html : une origine, donc une mémoire, par boîte, comme sur le Mac.
     2. Notifications : la veille est faite par Android (module Kotlin, toutes les 15 min environ, même appli fermée) ;
        appli ouverte, chaque tour de 90 s lui demande un passage tout de suite. Une seule veille : jamais deux fois le même mail. */
  var TEL_CASES = 'boite-mail-cases';
  function adresseEcran(c) {
    var id = String(c.id).toLowerCase(), cases = {};
    try { cases = JSON.parse(localStorage.getItem(TEL_CASES) || '{}') || {}; } catch (e) { cases = {}; }
    var n = cases[id];
    if (typeof n !== 'number') {
      var prises = Object.keys(cases).map(function (k) { return cases[k]; });
      for (n = 0; n < 12 && prises.indexOf(n) >= 0; n++) { /* case suivante */ }
      if (n >= 12) n = prises.length % 12;
      cases[id] = n;
      try { localStorage.setItem(TEL_CASES, JSON.stringify(cases)); } catch (e) { /* sans mémoire */ }
    }
    return 'http://b' + n + '.localhost/' + id + '/index.html';
  }
  function telPasserAuLocal(c) {
    var f = cadres[c.id];
    if (!f || locaux[c.id]) return;
    locaux[c.id] = true;
    f.src = adresseEcran(c) + '?fenetre=boite&cadre=1';
  }
  if (ANDROID) {
    var telDemande = false;
    var telConfigurer = function () {
      if (!T || !T.core) return Promise.resolve();
      return T.core.invoke('plugin:boite-android|configurer', { comptes: comptes.map(function (c) {
        return { id: String(c.id), nom: nomCourt(c), url: String(c.url || ''), jeton: String(c.jeton || ''), actif: notifActive(c.id) };
      }) });
    };
    notifTour = function () {
      if (FEN || !T || !T.core) return;
      var permis = telDemande ? Promise.resolve() : notifPermission();
      telDemande = true;
      permis.then(telConfigurer).then(function () { return T.core.invoke('plugin:boite-android|sonder'); }).then(function () {
        comptes.forEach(function (c) { notifEtat[c.id] = 'ok'; }); majNotifMenu();
      }, function (e) { if (window.console) console.warn('Veille des nouveaux mails : ' + (e && e.message || e)); });
    };
    $('menu-roue').addEventListener('change', function (e) { if (e.target.closest('[data-notif]')) telConfigurer(); });
    document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') setTimeout(notifTour, 1500); });
  }
