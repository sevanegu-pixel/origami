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
  var attente = null;
  function plusTard() { if (attente) return; attente = setTimeout(function () { attente = null; var l = document.getElementById('msg-liste'); if (l) arranger(l); }, 30); }
  function brancher() {
    var l = document.getElementById('msg-liste');
    if (!l) return setTimeout(brancher, 300);
    arranger(l);
    new MutationObserver(plusTard).observe(l, { childList: true, subtree: true });
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'tel-nouveau'; b.setAttribute('aria-label', 'Nouveau mail');
    b.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4L19 9l-4-4L4 16z"></path><path d="M13.5 6.5l4 4"></path></svg><span>Nouveau mail</span>';
    b.addEventListener('click', function () { var n = document.getElementById('msg-nouveau'); if (n) n.click(); });
    document.body.appendChild(b);
    var dernier = 0;
    window.addEventListener('scroll', function () { var y = window.scrollY || 0; b.classList.toggle('replie', y > dernier && y > 80); dernier = y; }, { passive: true });
    l.addEventListener('scroll', function () { b.classList.toggle('replie', l.scrollTop > 80); }, { passive: true });
    setInterval(function () {
      var r = l.getBoundingClientRect(), visible = !!(l.offsetParent && r.height > 0 && r.width > 0);
      document.documentElement.classList.toggle('tel-vue-liste', visible);
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
    var dessinerAvant = dessinerFils;
    dessinerFils = function () {
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
        return actionAvant.call(this, action, param, ids);
      };
    }
    if (typeof ouvrirConversation === 'function') {
      var ouvrirAvant = ouvrirConversation;
      ouvrirConversation = function (id) {
        anciens().forEach(function (p) { p.fils.forEach(function (f) { if (f.id === id) f.nonLu = false; }); });
        return ouvrirAvant.apply(this, arguments);
      };
    }
    var l = document.getElementById('msg-liste');
    var pied = document.createElement('div'); pied.className = 'tel-suite';
    if (l.parentNode) l.parentNode.insertBefore(pied, l.nextSibling);
    function suite() {
      var s = document.getElementById('msg-suiv'), encore = !!(bx.suite && bx.fils && bx.fils.length);
      pied.textContent = encore ? 'Suite…' : '';
      pied.style.display = encore ? '' : 'none';
      if (!encore || !s || !l.offsetParent) return;
      var r = pied.getBoundingClientRect();
      var proche = r.top < (window.innerHeight || 800) + 900;
      var k = (bx.pile || []).length;
      if (proche && demande !== k + 1) { demande = k + 1; pied.textContent = 'Chargement…'; s.click(); setTimeout(function () { if (demande === k + 1 && (bx.pile || []).length <= k) demande = 0; }, 15000); }
    }
    window.addEventListener('scroll', suite, { passive: true });
    l.addEventListener('scroll', suite, { passive: true });
    setInterval(suite, 700);
    suite();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', demarrer); else demarrer();
})();
