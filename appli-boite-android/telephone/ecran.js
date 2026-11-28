/* Boîte mail sur téléphone (appli Android) : petites retouches de mise en place, sans rien changer à ce que fait l'écran.
   - pastille ronde avec l'initiale de l'expéditeur à gauche de chaque mail (toucher la pastille coche le mail, comme avant la case) ;
   - étoile en bas à droite de la ligne ;
   - « Nouveau mail » flottant en bas à droite (il appuie sur le bouton « Nouveau mail » de l'écran, rangé dans « Dossiers »). */
(function () {
  if (window.__telephone) return; window.__telephone = true;
  document.documentElement.classList.add('telephone');
  var COULEURS = ['#e8710a', '#1a73e8', '#188038', '#d93025', '#9334e6', '#e37400', '#12a4af', '#c5221f', '#5f6368', '#b06000', '#3367d6', '#0b8043'];
  function initiale(nom) {
    var n = String(nom || '').replace(/^\s*moi\s*→\s*/i, '').replace(/^["'\s<(]+/, '');
    var m = n.match(/[A-Za-zÀ-ÖØ-öø-ÿ0-9]/);
    return m ? m[0].toUpperCase() : '?';
  }
  function couleur(nom) { var h = 0, s = String(nom || ''); for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return COULEURS[h % COULEURS.length]; }
  function arranger(liste) {
    [].forEach.call(liste.querySelectorAll('.conv'), function (c) {
      var g = c.querySelector('.conv-gauche'), corps = c.querySelector('.conv-corps');
      if (!g || !corps) return;
      var nomEl = c.querySelector('.conv-tete > b'), nom = nomEl ? (nomEl.getAttribute('title') || nomEl.textContent) : '';
      var p = g.querySelector('.tel-pastille');
      if (!p) {
        p = document.createElement('span'); p.className = 'tel-pastille'; p.setAttribute('aria-hidden', 'true');
        var coche = g.querySelector('input[type="checkbox"]');
        if (coche && coche.nextSibling) g.insertBefore(p, coche.nextSibling); else g.appendChild(p);
      }
      var lettre = initiale(nom);
      if (p.textContent !== lettre) p.textContent = lettre;
      p.style.background = couleur(String(nom).replace(/^\s*moi\s*→\s*/i, ''));
      var ex = c.querySelector('.conv-extrait');
      if (ex && ex.firstChild && ex.firstChild.nodeType === 3 && /^\s*[–-]\s+/.test(ex.firstChild.nodeValue)) ex.firstChild.nodeValue = ex.firstChild.nodeValue.replace(/^\s*[–-]\s+/, '');
      var et = g.querySelector('.etoile');
      if (et) corps.appendChild(et);
    });
  }
  function brancher() {
    var l = document.getElementById('msg-liste');
    if (!l) return setTimeout(brancher, 300);
    arranger(l);
    new MutationObserver(function () { arranger(l); }).observe(l, { childList: true, subtree: true });   // avant l'affichage : pas de clignotement
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'tel-nouveau'; b.setAttribute('aria-label', 'Nouveau mail');
    b.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4L19 9l-4-4L4 16z"></path><path d="M13.5 6.5l4 4"></path></svg><span>Nouveau mail</span>';
    b.addEventListener('click', function () { var n = document.getElementById('msg-nouveau'); if (n) n.click(); });
    document.body.appendChild(b);
    var dernier = 0;
    window.addEventListener('scroll', function () { var y = window.scrollY || 0; b.classList.toggle('tel-reduit', y > dernier && y > 80); dernier = y; }, { passive: true });
    l.addEventListener('scroll', function () { b.classList.toggle('tel-reduit', l.scrollTop > 80); }, { passive: true });
    setInterval(function () {
      var r = l.getBoundingClientRect(), visible = !!(l.offsetParent && r.height > 0 && r.width > 0);
      document.documentElement.classList.toggle('tel-vue-liste', visible);
      // Le bouton flotte juste au-dessus de la barre du bas (Mails, Carnet, Plus) quand elle est là.
      var bm = document.getElementById('barre-mobile'), rb = bm && getComputedStyle(bm).display !== 'none' ? bm.getBoundingClientRect() : null, h = rb && rb.height && rb.top < innerHeight ? Math.round(innerHeight - rb.top) : 0;
      if (b.dataset.bas !== String(h)) { b.dataset.bas = String(h); b.style.bottom = h ? (h + 14) + 'px' : ''; }
    }, 400);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', brancher); else brancher();
})();

/* Défilement sans fin (téléphone) : les pages déjà lues restent au-dessus, la suivante est demandée toute seule
   quand on approche du bas. Le moteur continue de lire Gmail page par page comme avant (mêmes jetons, même réserve) :
   seul l'affichage met les pages bout à bout. */
(function () {
  if (window.__telSansFin) return; window.__telSansFin = true;
  function pret() { return typeof dessinerFils === 'function' && typeof bx === 'object' && bx && document.getElementById('msg-suiv'); }
  function demarrer() {
    if (!pret()) return setTimeout(demarrer, 300);
    var pages = [], dedans = false, demande = 0;
    function cle() { return String(bx.dossier || '') + '|' + String(bx.libelle || '') + '|' + String(bx.recherche || '') + '|' + (bx.contactsSeuls ? 1 : 0); }
    function pareil(a, b) { return Number(a.debut) === Number(b.debut) && String(a.jeton || '') === String(b.jeton || ''); }
    function anciens() {
      // Les pages au-dessus de celle affichée, dans l'ordre de la pile du moteur : celles déjà montrées ici,
      // sinon celles que le moteur garde en réserve (bx.cache). Une page introuvable est simplement sautée.
      var k = (bx.pile || []).length, out = [];
      if (bx.dossier === 'programmes' && !bx.libelle) { pages.length = 0; return out; }
      for (var i = 0; i < k; i++) {
        var e = bx.pile[i], p = pages[i];
        if (!(p && p.cle === cle() && pareil(p, e))) {
          var c = null;
          try { c = typeof cleListe === 'function' ? bx.cache[cleListe(e.jeton, e.debut)] : null; } catch (x) { c = null; }
          p = pages[i] = c && c.fils && !c.attente ? { cle: cle(), debut: e.debut, jeton: e.jeton, fils: c.fils.slice() } : null;
        }
        if (p) out.push(p);
      }
      pages.length = k;
      return out;
    }
    var dessinerAvant = dessinerFils, sansDessin = false, l = document.getElementById('msg-liste');
    dessinerFils = function () {
      if (sansDessin) return;
      if (dedans) return dessinerAvant.apply(this, arguments);
      var vieux = anciens(), cur = bx.fils || [], vus = {}, tout = [];
      vieux.forEach(function (p) { p.fils.forEach(function (f) { if (!vus[f.id]) { vus[f.id] = 1; tout.push(f); } }); });
      cur.forEach(function (f) { if (!vus[f.id]) { vus[f.id] = 1; tout.push(f); } });
      var k = (bx.pile || []).length;
      pages[k] = { cle: cle(), debut: bx.debut, jeton: bx.jeton, fils: cur };
      if (demande && k >= demande) demande = 0;
      dedans = true; bx.fils = tout;
      try { return dessinerAvant.apply(this, arguments); }
      finally { bx.fils = cur; dedans = false; suite(); }
    };
    if (typeof actionBoite === 'function') {
      var actionAvant = actionBoite;
      actionBoite = function (action, param, ids) {
        var liste = ids || (typeof idsCoches === 'function' ? idsCoches() : []);
        var retire = ['archiver', 'corbeille', 'deplacer', 'restaurer'].indexOf(action) >= 0 || (action === 'boiteReception' && bx.dossier !== 'tous');
        anciens().forEach(function (p) {
          p.fils = p.fils.filter(function (f) {
            if (liste.indexOf(f.id) < 0) return true;
            if (action === 'lu') f.nonLu = false; if (action === 'nonLu') f.nonLu = true;
            if (action === 'suivre') f.suivi = true; if (action === 'nePlusSuivre') f.suivi = false;
            if (action === 'libeller' && f.libelles.indexOf(param) < 0) f.libelles.push(param);
            return !retire;
          });
        });
        // Étoile, lu / non lu d'un mail : changé sur place, tout de suite, sans redessiner la liste (pas de clignotement).
        var surPlace = ['suivre', 'nePlusSuivre', 'lu', 'nonLu'].indexOf(action) >= 0 && ids && ids.length && !l.querySelector('.conv input[type="checkbox"]:checked') &&
          ids.every(function (id) { return !!l.querySelector('.conv[data-conv="' + CSS.escape(id) + '"]'); });
        if (!surPlace) return actionAvant.call(this, action, param, ids);
        ids.forEach(function (id) {
          var c = l.querySelector('.conv[data-conv="' + CSS.escape(id) + '"]'), et = c.querySelector('[data-etoile]');
          if (action === 'lu' || action === 'nonLu') c.classList.toggle('non-lu', action === 'nonLu');
          if (et && (action === 'suivre' || action === 'nePlusSuivre')) { et.classList.toggle('on', action === 'suivre'); et.setAttribute('aria-label', action === 'suivre' ? 'Ne plus suivre' : 'Suivre'); }
        });
        sansDessin = true;
        try { return actionAvant.call(this, action, param, ids); } finally { sansDessin = false; }
      };
    }
    if (typeof ouvrirConversation === 'function') {
      var ouvrirAvant = ouvrirConversation;
      ouvrirConversation = function (id) {
        anciens().forEach(function (p) { p.fils.forEach(function (f) { if (f.id === id) f.nonLu = false; }); });
        // Le mail s'ouvre en haut de l'écran ; au retour, la liste reprend là où on l'avait laissée.
        var g = document.getElementById('msg-grille');
        if (g && !g.classList.contains('detail')) window.__telY = window.scrollY || 0;
        var r = ouvrirAvant.apply(this, arguments);
        setTimeout(function () { window.scrollTo(0, 0); }, 0);
        return r;
      };
      document.addEventListener('click', function (e) {
        if (!(e.target.closest && e.target.closest('[data-fil-retour]')) || typeof window.__telY !== 'number') return;
        var y = window.__telY;
        [60, 300].forEach(function (t) { setTimeout(function () { window.scrollTo(0, y); }, t); });
      }, true);
    }
    var pied = document.createElement('div'); pied.className = 'tel-suite';
    if (l.parentNode) l.parentNode.insertBefore(pied, l.nextSibling);
    // Page suivante pas encore prête : l'écran vide la liste (« Lecture de Gmail… ») le temps de la lire. Sur le téléphone,
    // les mails déjà montrés restent à leur place (on peut continuer à les lire) et une roulette tourne en bas.
    var attenteTexte = '';
    var html = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML');
    if (html && html.set) Object.defineProperty(l, 'innerHTML', {
      configurable: true,
      get: function () { return html.get.call(this); },
      set: function (v) {
        var s = String(v);
        if ((bx.pile || []).length && this.querySelector('.conv') && s.indexOf('data-conv=') < 0 && s.indexOf('vide-illustre') < 0 && /<p class="(doux|avert)"/.test(s)) {
          if (/class="avert"/.test(s)) attenteTexte = s.replace(/<[^>]+>/g, '').trim();
          pied.classList.add('charge'); setTimeout(suite, 0);
          return;                                   // la liste reste telle quelle pendant la lecture de la suite
        }
        html.set.call(this, v);
      }
    });
    function suite() {
      var s = document.getElementById('msg-suiv'), encore = !!(bx.suite && bx.fils && bx.fils.length);
      var lit = !!(demande && bx.charge);
      pied.classList.toggle('charge', lit);
      pied.textContent = attenteTexte ? attenteTexte : (lit ? 'Chargement…' : (encore ? 'Suite…' : ''));
      if (!bx.charge) attenteTexte = '';
      pied.style.display = (encore || lit || attenteTexte) ? '' : 'none';
      if (!encore || !s || !l.offsetParent) return;
      var r = pied.getBoundingClientRect();
      var proche = r.top < (window.innerHeight || 800) + 900;
      var k = (bx.pile || []).length;
      // Jamais de nouvelle demande tant que la page affichée n'est pas lue : sinon l'écran retient chaque appui et enchaîne les pages
      // (la liste clignotait puis repartait en chargement, en boucle).
      var lue = null; try { lue = bx.cache[cleListe()]; } catch (x) { lue = null; }
      if (!lue || lue.attente) return;
      if (proche && demande !== k + 1) { demande = k + 1; pied.textContent = 'Chargement…'; pied.classList.add('charge'); s.click(); setTimeout(function () { if (demande === k + 1 && (bx.pile || []).length <= k) demande = 0; }, 15000); }
    }
    window.addEventListener('scroll', suite, { passive: true });
    l.addEventListener('scroll', suite, { passive: true });
    setInterval(suite, 700);
    suite();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', demarrer); else demarrer();
})();

/* Sélection d'un mail par pression longue (comme Gmail). Le mail se coche par sa propre case (celle de l'écran),
   donc tout ce que l'écran fait avec les mails cochés reste pareil. Tant qu'au moins un mail est coché, un simple
   toucher sur un mail le coche ou le décoche au lieu de l'ouvrir ; « ✕ » décoche tout. */
(function () {
  if (window.__telSelection) return; window.__telSelection = true;
  function demarrer() {
    var l = document.getElementById('msg-liste'), barre = document.getElementById('msg-actions');
    if (!l || !barre) return setTimeout(demarrer, 300);
    function coches() { return l.querySelectorAll('.conv input[type="checkbox"]:checked'); }
    function maj() { document.documentElement.classList.toggle('tel-selection', coches().length > 0); }
    var annuler = document.createElement('button');
    annuler.type = 'button'; annuler.className = 'btn tel-annuler-selection'; annuler.textContent = '✕';
    annuler.setAttribute('aria-label', 'Annuler la sélection');
    barre.insertBefore(annuler, barre.firstChild);
    annuler.addEventListener('click', function () { [].forEach.call(coches(), function (c) { c.click(); }); setTimeout(maj, 0); });
    function basculer(conv) { var c = conv && conv.querySelector('input[type="checkbox"]'); if (c) { c.click(); setTimeout(maj, 0); } }
    var minuterie = null, x0 = 0, y0 = 0, avale = false;
    function stop() { if (minuterie) { clearTimeout(minuterie); minuterie = null; } }
    window.__telAnnulerPression = stop;
    l.addEventListener('touchstart', function (e) {
      stop(); var conv = e.target.closest && e.target.closest('.conv');
      if (!conv || e.target.closest('[data-etoile], [data-fiche-cle], input')) return;
      var t = e.touches[0]; x0 = t.clientX; y0 = t.clientY;
      minuterie = setTimeout(function () {
        minuterie = null; avale = true; basculer(conv);
        try { if (navigator.vibrate) navigator.vibrate(25); } catch (x) {}
      }, 450);
    }, { passive: true });
    l.addEventListener('touchmove', function (e) { var t = e.touches[0]; if (Math.abs(t.clientX - x0) > 10 || Math.abs(t.clientY - y0) > 10) stop(); }, { passive: true });
    l.addEventListener('touchend', function () { stop(); if (avale) setTimeout(function () { avale = false; }, 500); }, { passive: true });
    l.addEventListener('touchcancel', stop, { passive: true });
    l.addEventListener('contextmenu', function (e) { if (e.target.closest && e.target.closest('.conv')) e.preventDefault(); });
    // Avant l'écran : le toucher qui suit une pression longue ne doit pas ouvrir le mail ; en sélection, un toucher coche.
    l.addEventListener('click', function (e) {
      var conv = e.target.closest && e.target.closest('.conv');
      if (e.target.closest && e.target.closest('input')) return;
      if (avale) { avale = false; if (conv) { e.preventDefault(); e.stopPropagation(); } return; }
      if (!conv || e.target.closest('input, [data-etoile], [data-fiche-cle]')) return;
      if (coches().length) { e.preventDefault(); e.stopPropagation(); basculer(conv); }
    }, true);
    document.addEventListener('change', function () { setTimeout(maj, 0); }, true);
    new MutationObserver(maj).observe(l, { childList: true, subtree: true });
    maj();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', demarrer); else demarrer();
})();

/* Bouton « retour » d'Android, côté écran de la boîte : chaque appui défait la dernière chose ouverte, dans cet ordre :
   question en cours, volet « Actions », fenêtre (écrire un mail, dossiers…), tiroir, sélection, mail ouvert, autre rubrique.
   Une fenêtre d'écriture se ferme par le même chemin que son « × » : le texte est gardé en brouillon, ou une question est posée.
   L'écran dit sans cesse à la coquille s'il lui reste un écran où revenir ; sinon la coquille laisse Android mettre l'appli de côté. */
(function () {
  if (window.__telRetourEcran) return; window.__telRetourEcran = true;
  function id(x) { return document.getElementById(x); }
  function visible(el) { return !!(el && !el.classList.contains('cache') && el.offsetParent !== null); }
  function etape() {
    var d = id('dialogue');
    if (d && !d.classList.contains('cache') && typeof fermerDialogue === 'function') return function () { fermerDialogue(false); };
    var fa = id('feuille-actions');
    if ((fa && fa.classList.contains('ouverte')) || document.querySelector('.menu-actions')) { if (typeof fermerMenuActions === 'function') return function () { fermerMenuActions(); }; }
    var m = id('modale');
    if (m && !m.classList.contains('cache') && typeof fermerModale === 'function') return function () { fermerModale(); };
    var v = id('volet');
    if (v && v.classList.contains('ouvert') && typeof tiroir === 'function') return function () { tiroir(false); };
    if (document.documentElement.classList.contains('tel-selection')) { var a = document.querySelector('.tel-annuler-selection'); if (a) return function () { a.click(); }; }
    var vue = (typeof etat === 'object' && etat) ? etat.vue : '';
    var g = id('msg-grille');
    if (vue === 'messages' && g && g.classList.contains('detail')) { var r = document.querySelector('#msg-fil [data-fil-retour]'); if (r) return function () { r.click(); }; }
    if (vue && vue !== 'messages') {
      var b = document.querySelector('[data-mvue="messages"]') || document.querySelector('.volet .nav[data-vue="messages"]');
      if (b) return function () { b.click(); };
      if (typeof montrer === 'function') return function () { montrer('messages'); };
    }
    return null;
  }
  var dernier = null;
  function dire(force) {
    var peut = !!etape();
    if (!force && peut === dernier) return;
    dernier = peut;
    try { window.parent.postMessage({ boiteMail: 'retour-etat', peut: peut }, '*'); } catch (e) { /* seul */ }
  }
  window.addEventListener('message', function (ev) {
    var dd = ev.data || {};
    if (ev.source !== window.parent || dd.boiteMail !== 'retour') return;
    var f = etape();
    try { if (f) f(); } catch (e) { /* rien */ }
    setTimeout(function () { dire(true); }, 250);
  });
  setInterval(function () { dire(false); }, 300);
  setInterval(function () { dire(true); }, 3000);
  dire(true);
})();

/* Rubriques (Boîte, Campagnes, Modèles, Contacts, Carnet d'adresses) rangées dans le menu ☰ de la liste des mails, pour la place.
   Sur la liste des mails, la rangée du haut est cachée ; ☰ les montre en tête des dossiers. Dans les autres rubriques,
   la rangée reste visible (c'est d'elle qu'on passe de l'une à l'autre). Les boutons du menu appuient sur ceux de la rangée. */
(function () {
  if (window.__telRubriques) return; window.__telRubriques = true;
  function id(x) { return document.getElementById(x); }
  setInterval(function () {
    var vue = (typeof etat === 'object' && etat) ? etat.vue : '';
    document.documentElement.classList.toggle('tel-vue-boite', vue === 'messages');
  }, 300);
  function demarrer() {
    var b = id('msg-ouvrir-dossiers');
    if (!b || typeof b.onclick !== 'function') return setTimeout(demarrer, 300);
    var avant = b.onclick;
    b.onclick = function () {
      var r = avant.apply(this, arguments);
      try {
        var rangee = [].slice.call(document.querySelectorAll('#sous-onglets button')).filter(function (x) { return !x.classList.contains('cache') && x.textContent.trim(); });
        var corps = id('modale-corps');
        if (rangee.length && corps && !corps.querySelector('.tel-rubriques')) {
          var bloc = document.createElement('div'); bloc.className = 'tel-rubriques';
          rangee.forEach(function (o) {
            var c = document.createElement('button'); c.type = 'button';
            c.className = 'tel-rubrique' + (o.classList.contains('actif') || o.getAttribute('aria-selected') === 'true' ? ' actif' : '');
            c.textContent = o.textContent.trim();
            c.addEventListener('click', function () { if (typeof fermerModale === 'function') fermerModale(); o.click(); });
            bloc.appendChild(c);
          });
          corps.insertBefore(bloc, corps.firstChild);
        }
      } catch (e) { /* menu sans rubriques */ }
      return r;
    };
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', demarrer); else demarrer();
})();

/* Glisser un mail vers la droite ou vers la gauche (comme Gmail) : seul le mail sous le doigt glisse ; derrière lui apparaît
   le logo de l'action (archiver, corbeille, lu, suivre). Au-delà d'un tiers de la largeur, l'action est faite par le même
   chemin que les boutons de l'écran (actionBoite). Actions choisies dans le menu ⚙ de l'appli (envoyées par la coquille). */
(function () {
  if (window.__telGlisser) return; window.__telGlisser = true;
  var CLE = 'boite-mail-glisser', reglage = { droite: 'archiver', gauche: 'corbeille' };
  try { var g = JSON.parse(localStorage.getItem(CLE) || '{}') || {}; if (g.droite) reglage.droite = g.droite; if (g.gauche) reglage.gauche = g.gauche; } catch (e) { /* défaut */ }
  window.addEventListener('message', function (ev) {
    var d = ev.data || {};
    if (ev.source !== window.parent || d.boiteMail !== 'glisser') return;
    if (d.droite) reglage.droite = d.droite; if (d.gauche) reglage.gauche = d.gauche;
    try { localStorage.setItem(CLE, JSON.stringify(reglage)); } catch (e) { /* plein */ }
  });
  try { if (window.parent !== window) window.parent.postMessage({ boiteMail: 'glisser?' }, '*'); } catch (e) { /* seul */ }
  var ICO = {
    archiver: '<path d="M3 4h18v4H3z"/><path d="M5 8v11h14V8"/><path d="M10 12h4"/>',
    corbeille: '<path d="M4 7h16"/><path d="M9 7V4h6v3"/><path d="M6 7l1 13h10l1-13"/><path d="M10 11v6M14 11v6"/>',
    lu: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
    suivre: '<path d="M12 3l2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3 6.4 20.2l1.1-6.2L3 9.6l6.2-.9z"/>'
  };
  var NOM = { archiver: 'Archiver', corbeille: 'Corbeille', lu: 'Lu', nonLu: 'Non lu', suivre: 'Suivre', nePlusSuivre: 'Ne plus suivre' };
  var COULEUR = { archiver: '#188038', corbeille: '#d93025', lu: '#1a73e8', suivre: '#e37400' };
  function demarrer() {
    var l = document.getElementById('msg-liste');
    if (!l || typeof actionBoite !== 'function') return setTimeout(demarrer, 300);
    if (getComputedStyle(l).position === 'static') l.style.position = 'relative';
    var fond = document.createElement('div'); fond.className = 'tel-glisse-fond'; fond.style.display = 'none'; l.appendChild(fond);
    var g = null;
    function actionPour(dx) { return dx > 0 ? reglage.droite : reglage.gauche; }
    function vraieAction(a, conv) {
      if (a === 'lu') return conv.classList.contains('non-lu') ? 'lu' : 'nonLu';
      if (a === 'suivre') { var e = conv.querySelector('[data-etoile]'); return e && e.classList.contains('on') ? 'nePlusSuivre' : 'suivre'; }
      return a;
    }
    function montrerFond(conv, dx) {
      var a = actionPour(dx);
      if (fond.parentNode !== l) l.appendChild(fond);   // l'écran redessine la liste : le fond revient sous le doigt
      if (!a || a === 'rien') { fond.style.display = 'none'; return; }
      var loin = Math.abs(dx) > conv.offsetWidth / 3;
      fond.style.display = 'flex'; fond.style.top = conv.offsetTop + 'px'; fond.style.height = conv.offsetHeight + 'px';
      fond.style.justifyContent = dx > 0 ? 'flex-start' : 'flex-end';
      fond.style.background = loin ? (COULEUR[a] || '#5f6368') : 'color-mix(in srgb, ' + (COULEUR[a] || '#5f6368') + ' 55%, var(--carte))';
      var cle = vraieAction(a, conv) + (dx > 0 ? 'd' : 'g');
      if (fond.dataset.cle !== cle) {
        fond.dataset.cle = cle;
        var ico = '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + (ICO[a] || '') + '</svg>', mot = '<span>' + (NOM[vraieAction(a, conv)] || '') + '</span>';
        fond.innerHTML = dx > 0 ? ico + mot : mot + ico;
      }
    }
    l.addEventListener('touchstart', function (e) {
      g = null;
      if (e.touches.length !== 1 || document.documentElement.classList.contains('tel-selection')) return;
      var conv = e.target.closest && e.target.closest('.conv');
      if (!conv || conv.classList.contains('en-envoi') || e.target.closest('input')) return;
      g = { conv: conv, x: e.touches[0].clientX, y: e.touches[0].clientY, dx: 0, actif: false, non: false };
    }, { passive: true });
    l.addEventListener('touchmove', function (e) {
      if (!g || g.non) return;
      var dx = e.touches[0].clientX - g.x, dy = e.touches[0].clientY - g.y;
      if (!g.actif) {
        if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) { g.non = true; return; }   // défilement de la liste
        if (Math.abs(dx) < 14) return;
        g.actif = true; g.conv.classList.add('tel-glisse');
        if (window.__telAnnulerPression) window.__telAnnulerPression();
      }
      if (e.cancelable) e.preventDefault();
      g.dx = dx; g.conv.style.transform = 'translateX(' + dx + 'px)';
      montrerFond(g.conv, dx);
    }, { passive: false });
    function fin() {
      if (!g || !g.actif) { g = null; return; }
      var conv = g.conv, dx = g.dx, a = actionPour(dx), loin = Math.abs(dx) > conv.offsetWidth / 3;
      g = null;
      window.__telAvaleClic = Date.now();
      conv.style.transition = 'transform .18s ease-out';
      if (loin && a && a !== 'rien') {
        var act = vraieAction(a, conv), retire = act === 'archiver' || act === 'corbeille';
        conv.style.transform = 'translateX(' + (dx > 0 ? '' : '-') + (retire ? '110%' : '0') + ')';
        setTimeout(function () {
          fond.style.display = 'none'; conv.style.transition = ''; conv.style.transform = ''; conv.classList.remove('tel-glisse');
          try { actionBoite(act, '', [conv.dataset.conv]); } catch (e) { /* l'écran le dira */ }
        }, 190);
      } else {
        conv.style.transform = 'translateX(0)';
        setTimeout(function () { fond.style.display = 'none'; conv.style.transition = ''; conv.style.transform = ''; conv.classList.remove('tel-glisse'); }, 190);
      }
    }
    l.addEventListener('touchend', fin, { passive: true });
    l.addEventListener('touchcancel', fin, { passive: true });
    // Le toucher qui termine un glissement n'ouvre pas le mail.
    l.addEventListener('click', function (e) {
      if (window.__telAvaleClic && Date.now() - window.__telAvaleClic < 400) { e.preventDefault(); e.stopPropagation(); }
    }, true);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', demarrer); else demarrer();
})();

/* Aperçu « Ordinateur » sur téléphone : le mail garde sa largeur d'ordinateur (680 px) mais est réduit pour tenir dans l'écran,
   au lieu de déborder et de faire défiler la fenêtre sur le côté. */
(function () {
  if (window.__telApercuOrdi) return; window.__telApercuOrdi = true;
  setInterval(function () {
    var c = document.getElementById('mc-cadre'), r = document.getElementById('mc-rendu');
    if (!c || !r || !c.offsetParent) return;
    if (c.classList.contains('ordi')) {
      var z = Math.min(1, (c.clientWidth || 340) / 680);
      if (r.style.width !== '680px') { r.style.width = '680px'; r.style.minWidth = '680px'; }
      if (r.style.zoom !== String(z)) r.style.zoom = String(z);
    } else if (r.style.zoom) { r.style.zoom = ''; r.style.width = ''; r.style.minWidth = ''; }
  }, 300);
})();

/* Fenêtre « Écrire » sur téléphone : le crayon (écrire), l'œil (aperçu) et le trombone (joindre un fichier) montent dans la barre
   du titre, à côté de « – », « ⋯ » et « × », au lieu d'occuper une bande à eux. Les boutons de l'écran sont déplacés tels quels
   (leurs actions restent les mêmes) ; une place vide garde leur nom dans la fenêtre pour l'écran. Fenêtre fermée : tout repart. */
(function () {
  if (window.__telTeteEcrire) return; window.__telTeteEcrire = true;
  var TROMBONE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5l-8.6 8.6a5.5 5.5 0 0 1-7.8-7.8l8.6-8.6a3.7 3.7 0 0 1 5.2 5.2l-8.6 8.6a1.8 1.8 0 0 1-2.6-2.6l7.9-7.9"/></svg>';
  function ranger() {
    var corps = document.getElementById('modale-corps'), m = document.getElementById('modale');
    var tete = m && m.querySelector('.modale-boite > header');
    if (!corps || !tete) return;
    var outils = tete.querySelector('.tel-tete-outils');
    // Plus de fenêtre d'écriture (fermée, ou autre chose dedans) : on enlève ce qu'on avait monté.
    if (outils && !corps.querySelector('.mc-bascule.tel-place')) { outils.remove(); outils = null; }
    var b = corps.querySelector('.mc-bascule:not(.tel-place)');
    if (!b || m.classList.contains('cache')) return;
    var place = document.createElement('div'); place.className = 'segment mc-bascule tel-place cache'; place.hidden = true;
    b.parentNode.insertBefore(place, b);
    if (outils) outils.remove();
    outils = document.createElement('span'); outils.className = 'tel-tete-outils';
    outils.appendChild(b);
    if (document.getElementById('mc-fichier')) {
      var j = document.createElement('label'); j.className = 'tel-joindre'; j.htmlFor = 'mc-fichier'; j.title = 'Joindre un fichier'; j.setAttribute('aria-label', 'Joindre un fichier'); j.innerHTML = TROMBONE;
      outils.appendChild(j);
    }
    var h = tete.querySelector('h2');
    if (h && h.nextSibling) tete.insertBefore(outils, h.nextSibling); else tete.appendChild(outils);
  }
  function demarrer() {
    var corps = document.getElementById('modale-corps');
    if (!corps) return setTimeout(demarrer, 300);
    new MutationObserver(ranger).observe(corps, { childList: true });
    var m = document.getElementById('modale'); if (m) new MutationObserver(ranger).observe(m, { attributes: true, attributeFilter: ['class'] });
    setInterval(ranger, 500);
    ranger();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', demarrer); else demarrer();
})();

/* Rien ne défile sur le côté : si la page ou une fenêtre a été poussée de côté (champ qui prend la main, contenu trop large),
   elle revient aussitôt au bord gauche. Les rangées faites pour défiler (outils de mise en forme, onglets) ne sont pas touchées. */
(function () {
  if (window.__telPasDeCote) return; window.__telPasDeCote = true;
  function remettre(el) { if (el && el.scrollLeft) el.scrollLeft = 0; }
  document.addEventListener('scroll', function (e) {
    var t = e.target;
    if (t === document || t === document.documentElement || t === document.body) { if (window.scrollX) window.scrollTo(0, window.scrollY); remettre(document.documentElement); remettre(document.body); return; }
    if (t && t.matches && t.matches('.modale-boite, .modale-corps, main, .contenu, .appli, #msg-grille, .msg-colonne')) remettre(t);
  }, true);
})();
