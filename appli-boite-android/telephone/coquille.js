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
  /* 3. Bouton « retour » d'Android (appelé par le module Kotlin) : le menu de la roue se ferme, sinon l'écran visible
        revient à son écran précédent ; s'il n'en a plus, Android met l'appli de côté (rien n'est fermé ni perdu). */
  if (ANDROID) {
    var telRetourPeut = [];
    window.addEventListener('message', function (ev) {
      var d = ev.data || {};
      if (d.boiteMail !== 'retour-etat') return;
      telRetourPeut = telRetourPeut.filter(function (x) { return x.src !== ev.source; });
      telRetourPeut.push({ src: ev.source, peut: !!d.peut });
    });
    window.__telRetour = function () {
      var m = $('menu-roue');
      if (m && m.classList.contains('visible')) { m.classList.remove('visible'); return true; }
      var f = [].filter.call(document.querySelectorAll('iframe'), function (x) { return x.offsetParent !== null && x.offsetWidth > 0; })[0];
      if (!f || !f.contentWindow) return false;
      var e = telRetourPeut.filter(function (x) { return x.src === f.contentWindow; })[0];
      if (!e || !e.peut) return false;
      try { f.contentWindow.postMessage({ boiteMail: 'retour' }, '*'); } catch (x) { return false; }
      return true;
    };
  }
  /* 4. Glisser un mail vers la droite ou vers la gauche (liste des mails) : action choisie dans le menu ⚙, pour toutes les boîtes.
        Gardé ici (mémoire de la coquille) et envoyé à chaque écran de boîte ; un écran qui démarre le demande. */
  if (ANDROID) {
    var TEL_GLISSER = 'boite-mail-glisser';
    var TEL_ACTIONS = [['archiver', 'Archiver'], ['corbeille', 'Supprimer (corbeille)'], ['lu', 'Marquer lu / non lu'], ['suivre', 'Suivre / ne plus suivre'], ['rien', 'Rien']];
    var telGlisserLire = function () {
      var r = { droite: 'archiver', gauche: 'corbeille' };
      try { var x = JSON.parse(localStorage.getItem(TEL_GLISSER) || '{}') || {}; if (x.droite) r.droite = x.droite; if (x.gauche) r.gauche = x.gauche; } catch (e) { /* défaut */ }
      return r;
    };
    var telGlisserDire = function (cible) {
      var r = telGlisserLire(), msg = { boiteMail: 'glisser', droite: r.droite, gauche: r.gauche };
      if (cible) { try { cible.postMessage(msg, '*'); } catch (e) { /* fermé */ } return; }
      Object.keys(cadres).forEach(function (k) { try { cadres[k].contentWindow.postMessage(msg, '*'); } catch (e) { /* fermé */ } });
    };
    var telGlisserChoix = function (sens, choisi) {
      return '<label class="ou"><span style="flex:0 0 auto;min-width:92px">' + (sens === 'droite' ? 'Vers la droite' : 'Vers la gauche') + '</span>' +
        '<select data-glisser="' + sens + '" style="flex:1;min-width:0;font-size:12.5px;padding:3px 6px;border:1px solid var(--ligne);border-radius:8px;background:var(--carte);color:var(--texte)">' +
        TEL_ACTIONS.map(function (a) { return '<option value="' + a[0] + '"' + (a[0] === choisi ? ' selected' : '') + '>' + a[1] + '</option>'; }).join('') + '</select></label>';
    };
    var htmlTeleAvantGlisser = htmlTele;
    htmlTele = function () {
      var r = telGlisserLire();
      return htmlTeleAvantGlisser.apply(this, arguments) +
        '<div class="tele"><span class="nom">Glisser un mail dans la liste</span>' + telGlisserChoix('droite', r.droite) + telGlisserChoix('gauche', r.gauche) + '</div>';
    };
    $('menu-roue').addEventListener('change', function (e) {
      var s = e.target.closest('[data-glisser]'); if (!s) return;
      var r = telGlisserLire(); r[s.dataset.glisser] = s.value;
      try { localStorage.setItem(TEL_GLISSER, JSON.stringify(r)); } catch (x) { /* plein */ }
      telGlisserDire();
    });
    window.addEventListener('message', function (ev) { if ((ev.data || {}).boiteMail === 'glisser?') telGlisserDire(ev.source); });
  }
  /* 5. Fichiers téléchargés (pièces jointes) sur le téléphone : Android ne laisse pas choisir un dossier comme le Mac
        (« Folder picker is not implemented »). Ils vont donc toujours dans « Téléchargements » du téléphone, enregistrés par
        le module Kotlin (MediaStore, Android 10 et plus). « Ouvrir » les ouvre avec l'appli du téléphone qui sait les lire,
        le second bouton ouvre la liste des téléchargements. Dans le rouage : plus de « Changer de dossier » ni de question. */
  if (ANDROID && typeof appelMac === 'function' && typeof htmlTele === 'function') {
    var telFichiers = {};
    var appelMacAvantTel = appelMac;
    appelMac = function (nom, args) {
      args = args || {};
      if (nom === 'enregistrer_fichier') {
        return T.core.invoke('plugin:boite-android|enregistrer', { nom: String(args.nom || 'fichier'), base64: String(args.base64 || '') }).then(function (r) {
          var chemin = '/Téléchargements/' + String((r && r.nom) || args.nom || 'fichier');
          telFichiers[chemin] = r && r.uri; return chemin;
        });
      }
      if (nom === 'ouvrir_fichier') return T.core.invoke('plugin:boite-android|ouvrir', { uri: String(telFichiers[args.chemin] || '') });
      if (nom === 'montrer_fichier') return T.core.invoke('plugin:boite-android|telechargements');
      if (nom === 'dossier_telechargements') return Promise.resolve('/Téléchargements');
      return appelMacAvantTel(nom, args);
    };
    var lireTeleAvantTel = lireTele;
    lireTele = function () { var r = lireTeleAvantTel(); r.demander = false; r.dossier = ''; return r; };
    DOSSIER_DEFAUT = '/Téléchargements';
    var htmlTeleAvantTel = htmlTele;
    htmlTele = function () {
      var h = htmlTeleAvantTel.apply(this, arguments);
      var bloc = '<div class="tele"><span class="nom">Fichiers téléchargés</span><div class="ou"><b>Dans « Téléchargements » du téléphone</b>' +
        '<button type="button" data-tel-telechargements>Voir</button></div></div>';
      // Le premier bloc « tele » est celui des téléchargements du Mac : il est remplacé tel quel.
      var i = h.indexOf('<div class="tele">'), j = h.indexOf('</label></div>', i);
      return i >= 0 && j > i ? h.slice(0, i) + bloc + h.slice(j + '</label></div>'.length) : h;
    };
    $('menu-roue').addEventListener('click', function (e) {
      if (!e.target.closest('[data-tel-telechargements]')) return;
      $('menu-roue').classList.remove('visible');
      T.core.invoke('plugin:boite-android|telechargements').catch(function () { dire('La liste des téléchargements n\'a pas pu être ouverte.'); });
    });
  }
  /* 6. Comptes, comme dans les applis mail de téléphone : la barre des comptes du haut s'efface quand une boîte est à l'écran ;
        chaque écran montre à droite de sa recherche un petit rond (photo du profil Google si le moteur sait la donner, sinon
        l'initiale sur la couleur du compte). Un toucher ouvre le volet des comptes : changer de boîte, toutes les boîtes,
        ajouter un compte, comptes reliés, réglages de l'appli. Les photos sont gardées 6 h dans l'appareil. */
  if (ANDROID) {
    var TEL_PHOTOS = 'boite-mail-photos', telPhotos = {};
    try { telPhotos = JSON.parse(localStorage.getItem(TEL_PHOTOS) || '{}') || {}; } catch (e) { telPhotos = {}; }
    var telPhotoDemandee = {};
    var telPhotoDe = function (c) {
      var p = telPhotos[c.id];
      if ((!p || Date.now() - (p.le || 0) > 6 * 3600 * 1000) && !telPhotoDemandee[c.id] && c.url && c.jeton) {
        telPhotoDemandee[c.id] = true;
        porte(c, 'photoProfil', []).then(function (r) {
          telPhotos[c.id] = { photo: String((r && r.photo) || ''), le: Date.now() };
          try { localStorage.setItem(TEL_PHOTOS, JSON.stringify(telPhotos)); } catch (x) { /* plein */ }
          telCompteDire(c);
        }, function () { /* moteur sans photo (avant la version 41) : l'initiale reste */ });
      }
      return (p && p.photo) || '';
    };
    var telCompteDire = function (c, fenetre) {
      var w = fenetre || (cadres[c.id] && cadres[c.id].contentWindow); if (!w) return;
      try { w.postMessage({ boiteMail: 'compte', nom: nomCourt(c), email: c.email || '', couleur: c.couleur || '', photo: telPhotoDe(c) }, '*'); } catch (x) { /* fermé */ }
    };
    window.addEventListener('message', function (ev) {
      var d = ev.data || {};
      if (d.boiteMail !== 'compte?' && d.boiteMail !== 'comptes?') return;
      var c = comptes.filter(function (x) { return cadres[x.id] && cadres[x.id].contentWindow === ev.source; })[0];
      if (!c) return;
      if (d.boiteMail === 'compte?') telCompteDire(c, ev.source); else telVoletComptes(true);
    });
    var telRond = function (c, taille) {
      var p = telPhotoDe(c), n = nomCourt(c), m = String(n || c.email || '').match(/[A-Za-zÀ-ÖØ-öø-ÿ0-9]/);
      return '<span class="tel-rond" style="width:' + taille + 'px;height:' + taille + 'px;background:' + esc(c.couleur || '#1a73e8') + '">' +
        (p ? '<img src="' + esc(p) + '" alt="" referrerpolicy="no-referrer" onerror="this.remove()">' : '') + '<b>' + esc(m ? m[0].toUpperCase() : '?') + '</b></span>';
    };
    var telVoletComptes = function (ouvrir) {
      var f = $('tel-comptes');
      if (!ouvrir) { if (f) f.classList.remove('ouvert'); return; }
      if (!f) {
        f = document.createElement('div'); f.id = 'tel-comptes'; f.setAttribute('role', 'dialog'); f.setAttribute('aria-label', 'Comptes');
        document.body.appendChild(f);
        f.addEventListener('click', function (e) {
          if (e.target === f) return telVoletComptes(false);
          var b = e.target.closest('[data-tel-vue]'); if (b) { telVoletComptes(false); return montrer(b.getAttribute('data-tel-vue')); }
          if (e.target.closest('[data-tel-reglages]')) { telVoletComptes(false); setTimeout(ouvrirMenuRoue, 60); }
        });
      }
      var actuel = comptes.filter(function (c) { return c.id === vue; })[0] || comptes[0];
      var h = '<div class="tel-comptes-boite"><span class="tel-comptes-poignee"></span>';
      if (actuel) h += '<div class="tel-comptes-moi">' + telRond(actuel, 44) + '<div><b>' + esc(nomCourt(actuel)) + '</b><small>' + esc(actuel.email || '') + '</small></div></div>';
      h += '<div class="tel-comptes-liste">';
      comptes.forEach(function (c) {
        if (actuel && c.id === actuel.id) return;
        h += '<button type="button" data-tel-vue="' + esc(c.id) + '">' + telRond(c, 32) + '<span><b>' + esc(nomCourt(c)) + '</b><small>' + esc(c.email || '') + '</small></span></button>';
      });
      if (comptes.length > 1) h += '<button type="button" data-tel-vue="toutes"><span class="tel-comptes-ico">≡</span><span><b>Toutes les boîtes</b></span></button>';
      h += '<button type="button" data-tel-vue="ajouter"><span class="tel-comptes-ico">＋</span><span><b>Ajouter un compte</b></span></button>';
      if (comptes.length) h += '<button type="button" data-tel-vue="comptes"><span class="tel-comptes-ico">⚇</span><span><b>Gérer les comptes</b></span></button>';
      h += '<button type="button" data-tel-reglages><span class="tel-comptes-ico">⚙</span><span><b>Réglages de l\'appli</b></span></button>';
      h += '</div></div>';
      f.innerHTML = h;
      requestAnimationFrame(function () { f.classList.add('ouvert'); });
    };
    // Barre des comptes du haut : effacée tant qu'une boîte est à l'écran (le rond la remplace), visible ailleurs.
    setInterval(function () {
      var boite = comptes.some(function (c) { return c.id === vue; });
      document.documentElement.classList.toggle('tel-sans-nav', boite);
    }, 300);
    // Le bouton retour ferme d'abord le volet des comptes ; hors d'une boîte, il ramène à la dernière boîte.
    var telRetourAvantComptes = window.__telRetour;
    window.__telRetour = function () {
      var f = $('tel-comptes');
      if (f && f.classList.contains('ouvert')) { telVoletComptes(false); return true; }
      if (telRetourAvantComptes && telRetourAvantComptes()) return true;
      if (!comptes.some(function (c) { return c.id === vue; }) && comptes.length && (vue === 'ajouter' || vue === 'comptes')) { montrer(comptes[0].id); return true; }
      return false;
    };
  }
  /* 7. Retour dans l'appli (appelé par le module Kotlin) : chaque boîte relit sa liste de mails, sans attendre. */
  if (ANDROID) {
    window.__telReveil = function () {
      Object.keys(cadres).forEach(function (k) { try { cadres[k].contentWindow.postMessage({ boiteMail: 'reveil' }, '*'); } catch (e) { /* fermé */ } });
    };
  }
