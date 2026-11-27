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
