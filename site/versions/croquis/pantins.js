/* Pantins articulés de la version « Croquis » : des personnages inventés, dessinés au trait
   comme des mannequins de bois (membres en ovales, articulations rondes), qui font du cirque
   quand la page défile. Chaque membre tourne autour de son articulation.
   <span class="pantin" data-p="mono|jongle|porte|cannes|salto"> ; .roule = traverse sa piste. */
(function () {
  var NS = "http://www.w3.org/2000/svg", R = Math.PI / 180;
  var reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  function dir(a) { return [Math.cos(a * R), Math.sin(a * R)]; }
  function add(p, a, l) { var d = dir(a); return [p[0] + d[0] * l, p[1] + d[1] * l]; }
  function ang(p, q) { return Math.atan2(q[1] - p[1], q[0] - p[0]) / R; }
  function el(parent, tag, at) { var e = document.createElementNS(NS, tag); for (var k in at) e.setAttribute(k, at[k]); parent.appendChild(e); return e; }
  function f(n) { return n.toFixed(1); }

  /* longueurs du mannequin */
  var L = { torse: 40, cou: 12, tete: 8.5, bras: 22, avb: 20, cuisse: 27, jambe: 25, pied: 9 };

  /* un membre = deux ovales qui ne tombent pas juste (le trait de crayon) */
  function Membre(g, w) {
    this.a = el(g, "ellipse", { "class": "t1" }); this.b = el(g, "ellipse", { "class": "t2" }); this.w = w;
  }
  Membre.prototype.set = function (p, q) {
    var cx = (p[0] + q[0]) / 2, cy = (p[1] + q[1]) / 2, l = Math.hypot(q[0] - p[0], q[1] - p[1]), a = ang(p, q);
    this.a.setAttribute("cx", f(cx)); this.a.setAttribute("cy", f(cy)); this.a.setAttribute("rx", f(l / 2 + 1)); this.a.setAttribute("ry", f(this.w));
    this.a.setAttribute("transform", "rotate(" + f(a) + " " + f(cx) + " " + f(cy) + ")");
    this.b.setAttribute("cx", f(cx + .6)); this.b.setAttribute("cy", f(cy - .4)); this.b.setAttribute("rx", f(l / 2 + 2)); this.b.setAttribute("ry", f(this.w * .75));
    this.b.setAttribute("transform", "rotate(" + f(a + 3) + " " + f(cx) + " " + f(cy) + ")");
  };
  function Rond(g, r, cls) { this.c = el(g, "circle", { r: r, "class": cls || "t1" }); }
  Rond.prototype.set = function (p) { this.c.setAttribute("cx", f(p[0])); this.c.setAttribute("cy", f(p[1])); };

  /* deux os, une cible : où plier le genou ou le coude (pli = +1 / -1) */
  function ik(o, cible, l1, l2, pli) {
    var d = Math.min(Math.hypot(cible[0] - o[0], cible[1] - o[1]), l1 + l2 - .5), t = ang(o, cible);
    var c = Math.max(-1, Math.min(1, (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d))), a1 = t - pli * Math.acos(c) / R;
    var m = add(o, a1, l1); return [m, add(m, ang(m, cible), l2)];
  }

  /* le mannequin */
  function Corps(g) {
    this.g = el(g, "g", {});
    var G = this.g;
    this.m = {
      cuisseG: new Membre(G, 6), jambeG: new Membre(G, 5), piedG: new Membre(G, 2.6),
      cuisseD: new Membre(G, 6), jambeD: new Membre(G, 5), piedD: new Membre(G, 2.6),
      torse: new Membre(G, 9.5),
      brasG: new Membre(G, 4.6), avbG: new Membre(G, 4), brasD: new Membre(G, 4.6), avbD: new Membre(G, 4)
    };
    this.j = {}; var self = this;
    ["hanche", "cou", "genouG", "genouD", "coudeG", "coudeD", "chevG", "chevD"].forEach(function (k) { self.j[k] = new Rond(G, 2.4, "j"); });
    this.mainG = new Rond(G, 2.8); this.mainD = new Rond(G, 2.8);
    this.tete = new Rond(G, L.tete); this.tete2 = new Rond(G, L.tete + 1.2, "t2");
    this.cheveux = el(G, "path", { "class": "t1" });
  }
  /* p : x, y (hanche), t (angle du torse, -90 = debout), h (tête),
     bras G/D : [épaule, coude] en angles relatifs, ou {vers:[x,y], pli}
     jambes G/D : [hanche, genou] relatifs, ou {vers:[x,y], pli} */
  Corps.prototype.pose = function (p) {
    var H = [p.x, p.y], C = add(H, p.t, L.torse), m = this.m, j = this.j;
    m.torse.set(H, C); j.hanche.set(H); j.cou.set(C);
    var T = add(C, p.t + (p.h || 0), L.cou + L.tete * .6); this.tete.set(T); this.tete2.set([T[0] + .7, T[1] - .5]);
    var ht = p.t + (p.h || 0), hp = "";
    for (var i = -2; i <= 2; i++) { var b = add(T, ht + i * 26, L.tete), e = add(T, ht + i * 26 + (i % 2 ? 6 : -4), L.tete + 6 + (i % 2 ? 2 : 0)); hp += "M" + f(b[0]) + " " + f(b[1]) + "L" + f(e[0]) + " " + f(e[1]); }
    this.cheveux.setAttribute("d", hp);
    var self = this;
    [["G", p.brasG], ["D", p.brasD]].forEach(function (s) {
      var k = s[0], v = s[1], E, M;
      if (v.vers) { var r = ik(C, v.vers, L.bras, L.avb, v.pli || 1); E = r[0]; M = r[1]; }
      else { E = add(C, p.t + v[0], L.bras); M = add(E, p.t + v[0] + v[1], L.avb); }
      m["bras" + k].set(C, E); m["avb" + k].set(E, M); j["coude" + k].set(E); self["main" + k].set(M);
    });
    [["G", p.jambeG], ["D", p.jambeD]].forEach(function (s) {
      var k = s[0], v = s[1], K, A;
      if (v.vers) { var r = ik(H, v.vers, L.cuisse, L.jambe, v.pli || 1); K = r[0]; A = r[1]; }
      else { K = add(H, p.t + 180 + v[0], L.cuisse); A = add(K, p.t + 180 + v[0] + v[1], L.jambe); }
      var pa = ang(K, A) + (p.pieds || -80);
      m["cuisse" + k].set(H, K); m["jambe" + k].set(K, A); m["pied" + k].set(A, add(A, pa, L.pied));
      j["genou" + k].set(K); j["chev" + k].set(A);
    });
  };

  function S(a) { return Math.sin(a); }
  /* valeur au temps s entre des clés [[temps, valeur], ...], en douceur */
  function cle(s, k) {
    if (s <= k[0][0]) return k[0][1];
    for (var i = 1; i < k.length; i++) if (s <= k[i][0]) { var u = (s - k[i - 1][0]) / (k[i][0] - k[i - 1][0]); u = u * u * (3 - 2 * u); return k[i - 1][1] + (k[i][1] - k[i - 1][1]) * u; }
    return k[k.length - 1][1];
  }

  /* ---------------- les numéros (vb = largeur, hauteur du dessin ; sol en bas) */
  var NUMEROS = {
    /* monocycle : la roue tourne avec la distance parcourue, les pieds suivent les pédales */
    mono: { vb: [160, 200], init: function (g) {
        this.roue = el(g, "g", {}); el(this.roue, "circle", { cx: 0, cy: 0, r: 20, "class": "t1" }); el(this.roue, "circle", { cx: .6, cy: -.4, r: 21.2, "class": "t2" });
        for (var i = 0; i < 8; i++) { var d = dir(i * 45); el(this.roue, "line", { x1: 0, y1: 0, x2: f(d[0] * 19), y2: f(d[1] * 19), "class": "t2" }); }
        el(this.roue, "circle", { cx: 0, cy: 0, r: 2.6, "class": "j" });
        this.fourche = el(g, "path", { "class": "t1" }); this.manivelle = el(g, "path", { "class": "t1" });
        this.selle = el(g, "ellipse", { rx: 9, ry: 3, "class": "t1" });
        this.c = new Corps(g);
      }, frame: function (n) {
        var C = [80, 176], a = n.roule / 20 / R, sw = S(n.g * .012) * 5;
        this.roue.setAttribute("transform", "translate(80 176) rotate(" + f(a) + ")");
        var P1 = add(C, a, 9), P2 = add(C, a + 180, 9), seat = [80 + sw * .3, 126];
        this.manivelle.setAttribute("d", "M" + f(P1[0]) + " " + f(P1[1]) + "L" + f(P2[0]) + " " + f(P2[1]));
        this.fourche.setAttribute("d", "M80 176L" + f(seat[0]) + " " + f(seat[1] + 3) + "M78 176L" + f(seat[0] - 2) + " " + f(seat[1] + 3));
        this.selle.setAttribute("cx", f(seat[0])); this.selle.setAttribute("cy", f(seat[1]));
        this.c.pose({ x: seat[0], y: seat[1] - 3, t: -90 + sw, h: -sw * .6,
          brasG: [-58 + S(n.g * .02) * 18, -25], brasD: [62 - S(n.g * .02 + 1) * 18, 25],
          jambeG: { vers: P1, pli: -1 }, jambeD: { vers: P2, pli: -1 } });
      } },
    /* jongleur : trois balles en cascade, les mains vont les chercher */
    jongle: { vb: [160, 200], init: function (g) {
        this.c = new Corps(g); this.balles = [0, 1, 2].map(function () { return new Rond(g, 4.2); }); this.tenir = 1;
      }, frame: function (n) {
        var t = n.g * .0045, mains = [[57, 108], [103, 108]];
        /* à l'arrêt du défilement, il rattrape ses balles (deux à gauche, une à droite) ; il reprend quand on bouge */
        var cible = n.calme ? 1 : 0; this.tenir = (this.tenir || 0) + (cible - (this.tenir || 0)) * .09;
        if (Math.abs(cible - this.tenir) < .005) this.tenir = cible;
        var k = this.tenir * this.tenir * (3 - 2 * this.tenir), tenues = [[55, 103], [61, 101], [105, 103]];
        for (var j = 0; j < 3; j++) {
          var ph2 = ((t + j / 3) % 1 + 1) % 1, u2 = (ph2 % .5) * 2;
          var vol = [ph2 < .5 ? 57 + 46 * u2 : 103 - 46 * u2, 106 - 70 * 4 * u2 * (1 - u2)];
          this.balles[j].set([vol[0] + (tenues[j][0] - vol[0]) * k, vol[1] + (tenues[j][1] - vol[1]) * k]);
        }
        var b = S(t * Math.PI * 4) * 5 * (1 - k);
        if (this.tenir !== cible) this.bouge = true; else this.bouge = false;
        this.c.pose({ x: 80, y: 136, t: -90 + S(t * 6) * 2, h: S(t * 3) * 8,
          brasG: { vers: [mains[0][0] + b * .4, mains[0][1] - b], pli: 1 }, brasD: { vers: [mains[1][0] - b * .4, mains[1][1] + b], pli: -1 },
          jambeG: [14, -4], jambeD: [-14, 4] });
      } },
    /* main à main : le porteur tient la voltigeuse en équilibre, elle change de figure */
    porte: { vb: [160, 300], init: function (g) { this.bas = new Corps(g); this.haut = new Corps(g); }, frame: function (n) {
        var t = n.g * .006, flex = Math.abs(S(t)) * 5, hy = 238 + flex;
        var mG = [70, hy - 82], mD = [90, hy - 82];
        this.bas.pose({ x: 80, y: hy, t: -90, h: -12, brasG: { vers: mG, pli: 1 }, brasD: { vers: mD, pli: -1 },
          jambeG: { vers: [66, 290], pli: -1 }, jambeD: { vers: [94, 290], pli: 1 } });
        var cou = [80 + S(t * .7) * 1.5, mG[1] - 26], sp = 30 + 40 * Math.abs(S(t * .5)), pl = S(t * .5) > 0;
        this.haut.pose({ x: cou[0], y: cou[1] - L.torse, t: 90 + S(t * .7) * 3, h: 0,
          brasG: { vers: mG, pli: -1 }, brasD: { vers: mD, pli: 1 },
          jambeG: pl ? [-sp, 0] : [-25, 70], jambeD: pl ? [sp, 0] : [10, -30], pieds: 80 });
      } },
    /* main à main relevé sur la vidéo de Sévane (19 oct.) : appui, montée en équilibre, équilibre bras tendus,
       le porteur descend les bras et marche, la voltigeuse redescend devant lui, salut main dans la main */
    video1: { vb: [180, 300], init: function (g) { this.bas = new Corps(g); this.haut = new Corps(g); }, frame: function (n) {
        var DUREE = 13.5, s = ((n.g / 450) % DUREE + DUREE) % DUREE;
        var hh = cle(s, [[0, 82], [8.8, 82], [10, 60], [11.2, 60], [12.2, 44]]);
        var flex = cle(s, [[0, 0], [2.2, 0], [2.6, 10], [3, 0], [11, 0], [11.6, 9], [12.1, 0]]);
        var pas = s > 9.6 && s < 11.2 ? S((s - 9.6) * Math.PI * 2.5) * 6 : 0;
        var x = 70 + pas, hy = 238 + flex, tf = cle(s, [[0, -90], [2.3, -90], [2.75, -25], [3.4, 90], [11.3, 90], [11.9, 190], [12.4, 270]]);
        var lg = [cle(s, [[0, -45], [2.3, -45], [2.6, -130], [3.1, -45], [3.6, -3], [8.5, -3], [9, -10], [9.5, -3], [11.3, -3], [11.7, -95], [12.4, 4]]),
                  cle(s, [[0, 75], [2.3, 75], [2.6, 140], [3.1, 0], [11.3, 0], [11.7, 0], [12.4, 0]])];
        var ld = [cle(s, [[0, -35], [2.3, -35], [2.6, -125], [3.1, 45], [3.6, 3], [8.5, 3], [9, 12], [9.5, 3], [11.3, 3], [11.7, -85], [12.4, -4]]),
                  cle(s, [[0, 70], [2.3, 70], [2.6, 140], [3.1, 0], [11.3, 0], [11.7, 0], [12.4, 0]])];
        var fin = cle(s, [[12.2, 0], [12.9, 1]]), lache = cle(s, [[11.5, 0], [12.4, 1]]);
        var mG = [x - 10, hy - hh], mD = [x + 10, hy - hh], tenue = [104, 196];
        var pD = [mD[0] + (tenue[0] - mD[0]) * fin, mD[1] + (tenue[1] - mD[1]) * fin], pG = [mG[0] - 14 * fin, mG[1] - 30 * fin];
        this.bas.pose({ x: x, y: hy, t: -90, h: -12 * (hh - 44) / 38, brasG: { vers: pG, pli: 1 }, brasD: { vers: pD, pli: -1 },
          jambeG: { vers: [x - 14 + pas * .5, 290], pli: -1 }, jambeD: { vers: [x + 14 - pas * .5, 290], pli: 1 } });
        /* la voltigeuse : épaules au-dessus des mains du porteur tant qu'elle est en appui, puis elle se pose devant */
        var mid = [(mG[0] + mD[0]) / 2, mG[1]], C = [mid[0], mid[1] - 38], d = [Math.cos(tf * R), Math.sin(tf * R)];
        var Hp = [C[0] - d[0] * L.torse, C[1] - d[1] * L.torse], Hs = [124, 238];
        var H = [Hp[0] + (Hs[0] - Hp[0]) * lache, Hp[1] + (Hs[1] - Hp[1]) * lache];
        var aG = [mG[0] + (tenue[0] - mG[0]) * lache, mG[1] + (tenue[1] - mG[1]) * lache], aD = [mD[0] + (150 - mD[0]) * lache, mD[1] + (176 - mD[1]) * lache];
        this.haut.pose({ x: H[0], y: H[1], t: tf, h: 0, brasG: { vers: aG, pli: -1 }, brasD: { vers: aD, pli: 1 },
          jambeG: lg, jambeD: ld, pieds: tf > 0 && tf < 180 ? 80 : -80 });
      } },
    /* deuxième vidéo de Sévane (19 oct.) : face à face mains tenues, flexion, lancer direct en équilibre main à main,
       tenue, puis elle se replie et vient s'asseoir sur ses épaules */
    video2: { vb: [180, 300], init: function (g) { this.bas = new Corps(g); this.haut = new Corps(g); }, frame: function (n) {
        var DUREE = 9.3, s = ((n.g / 450) % DUREE + DUREE) % DUREE, x = 72;
        var flex = cle(s, [[0, 0], [.6, 0], [.95, 16], [1.25, 0], [6.3, 0], [6.9, 8], [7.5, 0], [8.6, 0], [9.3, 0]]);
        var hy = 238 + flex, Cp = [x, hy - L.torse];
        var hh = cle(s, [[0, 44], [.6, 44], [.95, 30], [1.5, 82], [6.3, 82], [7.2, 60], [7.6, 26], [8.6, 26], [9.3, 44]]);
        var envol = cle(s, [[.95, 0], [1.6, 1]]), assis = cle(s, [[6.4, 0], [7.5, 1]]), retour = cle(s, [[8.6, 0], [9.3, 1]]);
        var tf = cle(s, [[0, -90], [.95, -90], [1.6, -270], [6.4, -270], [7.5, -450]]);
        var mG = [x + 4, hy - hh], mD = [x + 14, hy - hh];
        var mid = [(mG[0] + mD[0]) / 2, mG[1]], C = [mid[0], mid[1] - 38], d = [Math.cos(tf * R), Math.sin(tf * R)];
        var Hdebout = [108, 238 + flex * .8], Hmain = [C[0] - d[0] * L.torse, C[1] - d[1] * L.torse], Hassis = [x + 2, Cp[1] - 8];
        var H = envol < 1 ? [Hdebout[0] + (Hmain[0] - Hdebout[0]) * envol, Hdebout[1] + (Hmain[1] - Hdebout[1]) * envol]
              : [Hmain[0] + (Hassis[0] - Hmain[0]) * assis, Hmain[1] + (Hassis[1] - Hmain[1]) * assis];
        if (retour > 0) H = [H[0] + (Hdebout[0] - H[0]) * retour, H[1] + (Hdebout[1] - H[1]) * retour];
        var genoux = [[x - 4, Cp[1] + 14], [x + 10, Cp[1] + 14]];
        var pmG = assis > 0 ? [mG[0] + (genoux[0][0] - mG[0]) * assis, mG[1] + (genoux[0][1] - mG[1]) * assis] : mG;
        var pmD = assis > 0 ? [mD[0] + (genoux[1][0] - mD[0]) * assis, mD[1] + (genoux[1][1] - mD[1]) * assis] : mD;
        this.bas.pose({ x: x, y: hy, t: -90, h: -10 * (hh - 30) / 52, brasG: { vers: pmG, pli: 1 }, brasD: { vers: pmD, pli: -1 },
          jambeG: { vers: [x - 14, 290], pli: -1 }, jambeD: { vers: [x + 14, 290], pli: 1 } });
        var accr = 1 - assis * (1 - retour);
        var aG = [mG[0] + (genoux[0][0] - mG[0]) * (1 - accr), mG[1] + (genoux[0][1] - 10 - mG[1]) * (1 - accr)];
        var debout = envol < 1 && assis === 0;
        var lg = debout ? (flex > 2 ? { vers: [H[0] - 6, 290], pli: 1 } : [4, 0]) : assis > .6 ? [-90 + 0 * retour, 80] : envol < 1 ? [-120, 130] : [-4, 0];
        var ld = debout ? (flex > 2 ? { vers: [H[0] + 10, 290], pli: 1 } : [-4, 0]) : assis > .6 ? [-80, 75] : envol < 1 ? [-110, 125] : [4, 0];
        if (retour > .5) { lg = [4, 0]; ld = [-4, 0]; }
        this.haut.pose({ x: H[0], y: H[1], t: tf, h: 0, brasG: { vers: aG, pli: -1 }, brasD: { vers: [mD[0] + (genoux[1][0] - mD[0]) * (1 - accr), mD[1] + (genoux[1][1] - 10 - mD[1]) * (1 - accr)], pli: 1 },
          jambeG: lg, jambeD: ld, pieds: Math.sin(tf * R) > 0 ? 80 : -80 });
      } },
    /* pirouettes en monocycle, d'après la 3e vidéo de Sévane (19 oct., jusqu'à 17 s) : il arrive, ouvre les bras,
       tourne sur place de plus en plus vite, ralentit et repart. Le tour est rendu comme un pantin de papier qui pivote :
       le corps s'aplatit, la roue (perpendiculaire) s'ouvre quand il est de profil. */
    pirouette: { vb: [180, 300], init: function (g) {
        this.roue = el(g, "g", {}); this.r1 = el(this.roue, "ellipse", { "class": "t1" }); this.r2 = el(this.roue, "ellipse", { "class": "t2" });
        this.moyeu = new Rond(this.roue, 2.2, "j"); this.tige = el(g, "path", { "class": "t1" });
        this.pivot = el(g, "g", {}); this.c = new Corps(this.pivot);
      }, frame: function (n) {
        var DUREE = 17, s = ((n.g / 450) % DUREE + DUREE) % DUREE;
        var x = cle(s, [[0, 30], [3.5, 90], [14.5, 90], [17, 150]]), Y = 272, RR = 19;
        var th = 0; for (var u = 0; u < s; u += .05) th += cle(u, [[3.8, 0], [5.5, .9], [11.5, 1.6], [14.2, 0]]) * .05 * 360;
        var sx = Math.cos(th * R), sp = Math.abs(Math.sin(th * R)), roule = (s < 3.5 || s > 14.5) ? s * 160 : s * 40 + th * .15;
        this.r1.setAttribute("cx", f(x)); this.r1.setAttribute("cy", Y); this.r1.setAttribute("rx", f(Math.max(2.5, RR * sp))); this.r1.setAttribute("ry", RR);
        this.r2.setAttribute("cx", f(x + .8)); this.r2.setAttribute("cy", Y - .5); this.r2.setAttribute("rx", f(Math.max(2, RR * sp + 1.5))); this.r2.setAttribute("ry", RR + 1);
        this.moyeu.set([x, Y]); this.tige.setAttribute("d", "M" + f(x) + " " + Y + "L" + f(x) + " " + (Y - 50) + "M" + f(x - 7) + " " + (Y - 52) + "h14");
        this.pivot.setAttribute("transform", "translate(" + f(x) + " 0) scale(" + f(Math.abs(sx) < .12 ? (sx < 0 ? -.12 : .12) : sx) + " 1) translate(" + f(-x) + " 0)");
        var bras = cle(s, [[0, .45], [3.5, .5], [4.5, 1], [14, 1], [15, .45]]), cr = roule * .05, hy = Y - 54;
        var Cy = hy - L.torse, ouv = 42 * bras;
        this.c.pose({ x: x, y: hy, t: -90 + S(th * R * 2) * 1.5, h: 0,
          brasG: { vers: [x - ouv, Cy + 26 * (1 - bras) + 2], pli: 1 }, brasD: { vers: [x + ouv, Cy + 26 * (1 - bras) - 2], pli: -1 },
          jambeG: { vers: [x - 4, Y + 10 * S(cr)], pli: -1 }, jambeD: { vers: [x + 4, Y - 10 * S(cr)], pli: 1 } });
      } },
    /* pirouettes lentes, d'après la 4e vidéo (vue entre les rideaux) : il tourne sur place, bras pliés devant lui, un bras s'ouvre par moments */
    pirouette2: { vb: [180, 300], init: function (g) {
        this.roue = el(g, "g", {}); this.r1 = el(this.roue, "ellipse", { "class": "t1" }); this.r2 = el(this.roue, "ellipse", { "class": "t2" });
        this.moyeu = new Rond(this.roue, 2.2, "j"); this.tige = el(g, "path", { "class": "t1" });
        this.pivot = el(g, "g", {}); this.c = new Corps(this.pivot);
      }, frame: function (n) {
        var DUREE = 12, s = ((n.g / 450) % DUREE + DUREE) % DUREE;
        var x = 90 + S(s * .9) * 3, Y = 272, RR = 19;
        var th = 0; for (var u = 0; u < s; u += .05) th += .55 * .05 * 360;
        var sx = Math.cos(th * R), sp = Math.abs(Math.sin(th * R)), roule = s * 60;
        this.r1.setAttribute("cx", f(x)); this.r1.setAttribute("cy", Y); this.r1.setAttribute("rx", f(Math.max(2.5, RR * sp))); this.r1.setAttribute("ry", RR);
        this.r2.setAttribute("cx", f(x + .8)); this.r2.setAttribute("cy", Y - .5); this.r2.setAttribute("rx", f(Math.max(2, RR * sp + 1.5))); this.r2.setAttribute("ry", RR + 1);
        this.moyeu.set([x, Y]); this.tige.setAttribute("d", "M" + f(x) + " " + Y + "L" + f(x) + " " + (Y - 50) + "M" + f(x - 7) + " " + (Y - 52) + "h14");
        this.pivot.setAttribute("transform", "translate(" + f(x) + " 0) scale(" + f(Math.abs(sx) < .12 ? (sx < 0 ? -.12 : .12) : sx) + " 1) translate(" + f(-x) + " 0)");
        var bras = .35, ouvre = Math.max(0, S(s * 1.1)), cr = roule * .05, hy = Y - 54;
        var Cy = hy - L.torse, ouv = 42 * bras;
        this.c.pose({ x: x, y: hy, t: -90 + S(th * R * 2) * 1.5, h: 0,
          brasG: { vers: [x - 6, Cy + 18], pli: -1 }, brasD: { vers: [x + 8 + 34 * ouvre, Cy + 18 - 14 * ouvre], pli: 1 },
          jambeG: { vers: [x - 4, Y + 10 * S(cr)], pli: -1 }, jambeD: { vers: [x + 4, Y - 10 * S(cr)], pli: 1 } });
      } },
    /* colonne à deux en monocycle, d'après la photo de Sévane (20 oct., prise d'en bas) : il pédale de profil, penché un peu
       en avant ; elle est debout jambes serrées au-dessus de sa tête, il lui tient les chevilles à bout de bras pliés ;
       elle ouvre les bras en diagonale (un vers le ciel, l'autre vers le bas) et corrige l'équilibre */
    monocolonne: { vb: [200, 300], init: function (g) {
        this.roue = el(g, "g", {}); el(this.roue, "circle", { cx: 0, cy: 0, r: 22, "class": "t1" }); el(this.roue, "circle", { cx: .6, cy: -.4, r: 23.2, "class": "t2" });
        for (var i = 0; i < 8; i++) { var d = dir(i * 45); el(this.roue, "line", { x1: 0, y1: 0, x2: f(d[0] * 21), y2: f(d[1] * 21), "class": "t2" }); }
        el(this.roue, "circle", { cx: 0, cy: 0, r: 2.6, "class": "j" });
        this.fourche = el(g, "path", { "class": "t1" }); this.manivelle = el(g, "path", { "class": "t1" });
        this.selle = el(g, "ellipse", { rx: 9, ry: 3, "class": "t1" });
        this.bas = new Corps(g); this.haut = new Corps(g);
      }, frame: function (n) {
        var essai = this.essai, x = essai ? 40 + ((n.g * .05) % 120 + 120) % 120 : 100, dist = essai ? n.g * .05 : n.roule;
        var a = dist / 22 / R, sw = S(n.g * .012) * 3, Wc = [x, 276];
        this.roue.setAttribute("transform", "translate(" + f(x) + " 276) rotate(" + f(a) + ")");
        var P1 = add(Wc, a, 10), P2 = add(Wc, a + 180, 10), seat = [x + sw * .3, 224];
        this.manivelle.setAttribute("d", "M" + f(P1[0]) + " " + f(P1[1]) + "L" + f(P2[0]) + " " + f(P2[1]));
        this.fourche.setAttribute("d", "M" + f(x) + " 276L" + f(seat[0]) + " " + f(seat[1] + 3) + "M" + f(x - 2) + " 276L" + f(seat[0] - 2) + " " + f(seat[1] + 3));
        this.selle.setAttribute("cx", f(seat[0])); this.selle.setAttribute("cy", f(seat[1]));
        var hy = seat[1] - 3, t = -84 + sw, C = add([seat[0], hy], t, L.torse);
        var pieds = [C[0] + 3 - sw * .5, C[1] - 31];
        this.bas.pose({ x: seat[0], y: hy, t: t, h: -10,
          brasG: { vers: [pieds[0] - 3, pieds[1] + 2], pli: 1 }, brasD: { vers: [pieds[0] + 4, pieds[1] + 3], pli: -1 },
          jambeG: { vers: P1, pli: -1 }, jambeD: { vers: P2, pli: -1 } });
        var bal = S(n.g * .01) * 10, h2 = [pieds[0] - sw * .4, pieds[1] - 51];
        this.haut.pose({ x: h2[0], y: h2[1], t: -90 - sw * .8 + bal * .15, h: -6,
          brasG: [-118 + bal, -6], brasD: [48 + bal, 4],
          jambeG: { vers: [pieds[0] - 3, pieds[1]], pli: -1 }, jambeD: { vers: [pieds[0] + 3, pieds[1]], pli: 1 } });
      } },
    /* couch-couch, d'après la 5e vidéo de Sévane : il arrive de profil, se tourne vers le public et reste sur place
       en se balançant (la roue va et vient), bras grands ouverts qui font la bascule, puis repart */
    couch: { vb: [180, 300], init: function (g) {
        this.roue = el(g, "g", {}); this.r1 = el(this.roue, "ellipse", { "class": "t1" }); this.r2 = el(this.roue, "ellipse", { "class": "t2" });
        this.moyeu = new Rond(this.roue, 2.2, "j"); this.tige = el(g, "path", { "class": "t1" });
        this.pivot = el(g, "g", {}); this.c = new Corps(this.pivot);
      }, frame: function (n) {
        var DUREE = 12, s = ((n.g / 450) % DUREE + DUREE) % DUREE, Y = 272, RR = 19;
        var balance = cle(s, [[3, 0], [4, 1], [9.5, 1], [10.3, 0]]), osc = S(s * 3.2) * balance;
        var x = cle(s, [[0, 25], [3, 90], [10.3, 90], [12, 155]]) + osc * 7;
        var th = cle(s, [[2.4, 80], [3.8, 0], [9.6, 0], [10.6, -80]]) + osc * 10;
        var sx = Math.cos(th * R), sp = Math.abs(Math.sin(th * R)), cr = (s < 3 || s > 10.3) ? s * 8 : osc * 1.2;
        this.r1.setAttribute("cx", f(x)); this.r1.setAttribute("cy", Y); this.r1.setAttribute("rx", f(Math.max(2.5, RR * sp))); this.r1.setAttribute("ry", RR);
        this.r2.setAttribute("cx", f(x + .8)); this.r2.setAttribute("cy", Y - .5); this.r2.setAttribute("rx", f(Math.max(2, RR * sp + 1.5))); this.r2.setAttribute("ry", RR + 1);
        this.moyeu.set([x, Y]); this.tige.setAttribute("d", "M" + f(x) + " " + Y + "L" + f(x - osc * 3) + " " + (Y - 50) + "M" + f(x - osc * 3 - 7) + " " + (Y - 52) + "h14");
        this.pivot.setAttribute("transform", "translate(" + f(x) + " 0) scale(" + f(Math.abs(sx) < .12 ? (sx < 0 ? -.12 : .12) : sx) + " 1) translate(" + f(-x) + " 0)");
        var hx = x - osc * 3, hy = Y - 54, t = -90 - osc * 7, C = add([hx, hy], t, L.torse), ouv = .55 + .45 * balance;
        var bas = osc * 22 * balance;
        this.c.pose({ x: hx, y: hy, t: t, h: osc * 6,
          brasG: { vers: [C[0] - 40 * ouv, C[1] + 12 * (1 - balance) - bas], pli: 1 }, brasD: { vers: [C[0] + 40 * ouv, C[1] + 12 * (1 - balance) + bas], pli: -1 },
          jambeG: { vers: [x - 4, Y + 10 * S(cr)], pli: -1 }, jambeD: { vers: [x + 4, Y - 10 * S(cr)], pli: 1 } });
      } },
    /* porté en monocycle, d'après la 6e vidéo de Sévane : elle arrive en courant, saute dans ses bras et s'accroche
       à sa taille ; ils tournent ensemble sur la roue pendant qu'elle se renverse bras ouverts, puis elle redescend */
    monoporte: { vb: [200, 300], init: function (g) {
        this.pivot = el(g, "g", {}); var P = this.pivot;
        this.roue = el(P, "g", {}); this.r1 = el(this.roue, "ellipse", { "class": "t1" }); this.r2 = el(this.roue, "ellipse", { "class": "t2" });
        this.moyeu = new Rond(this.roue, 2.2, "j"); this.tige = el(P, "path", { "class": "t1" });
        this.lui = new Corps(P); this.elle = new Corps(P);
      }, frame: function (n) {
        var DUREE = 11, s = ((n.g / 450) % DUREE + DUREE) % DUREE, x = 90, Y = 272, RR = 19, hy = Y - 54;
        var th = cle(s, [[3, 0], [8, 720]]), sx = Math.cos(th * R), osc = S(s * 2.4) * .6;
        this.pivot.setAttribute("transform", "translate(" + f(x) + " 0) scale(" + f(Math.abs(sx) < .12 ? (sx < 0 ? -.12 : .12) : sx) + " 1) translate(" + f(-x) + " 0)");
        var sp = Math.abs(Math.cos(th * R)), wx = x + osc * 3;
        this.r1.setAttribute("cx", f(wx)); this.r1.setAttribute("cy", Y); this.r1.setAttribute("rx", f(Math.max(2.5, RR * sp))); this.r1.setAttribute("ry", RR);
        this.r2.setAttribute("cx", f(wx + .8)); this.r2.setAttribute("cy", Y - .5); this.r2.setAttribute("rx", f(Math.max(2, RR * sp + 1.5))); this.r2.setAttribute("ry", RR + 1);
        this.moyeu.set([wx, Y]); this.tige.setAttribute("d", "M" + f(wx) + " " + Y + "L" + f(x) + " " + (Y - 50) + "M" + f(x - 7) + " " + (Y - 52) + "h14");
        /* elle : 0 = au sol, 1 = accrochée à sa taille */
        var haut = cle(s, [[1.8, 0], [2.6, 1], [8.6, 1], [9.4, 0]]), saut = Math.sin(Math.min(1, Math.max(0, (s < 5 ? s - 1.8 : s - 8.6) / .8)) * Math.PI) * 18;
        var renverse = cle(s, [[3.4, 0], [4.6, 1], [7.4, 1], [8.4, 0]]);
        var solX = s < 5 ? cle(s, [[0, 185], [1.8, x + 30]]) : cle(s, [[9.4, x + 30], [11, 190]]), solY = 272 - 52;
        var tX = x + 15, tY = hy - 20, hx = solX + (tX - solX) * haut, hyE = solY + (tY - solY) * haut - saut;
        var lean = 12 + 48 * renverse, t = -90 + lean * haut, CE = add([hx, hyE], t, L.torse);
        /* lui, de profil vers la droite, le buste qui compense son poids */
        var tl = -90 - 8 * haut - 6 * renverse, CL = add([x, hy], tl, L.torse), cr = s * 3;
        this.lui.pose({ x: x, y: hy, t: tl, h: -6 * renverse,
          brasG: haut > .5 ? { vers: [hx - 2, hyE - 12], pli: 1 } : { vers: [CL[0] + 20, CL[1] + 18], pli: -1 },
          brasD: haut > .5 ? { vers: [hx + 4, hyE - 20], pli: -1 } : { vers: [CL[0] + 24, CL[1] + 6], pli: -1 },
          jambeG: { vers: [wx - 4, Y + 9 * S(cr)], pli: -1 }, jambeD: { vers: [wx + 4, Y - 9 * S(cr)], pli: 1 } });
        var pas = s * 7, ouv = renverse;
        var jG = haut > .5 ? { vers: [x - 9, hy - 6], pli: 1 } : { vers: [hx - 8 + 9 * S(pas), 272 - Math.max(0, Math.cos(pas)) * 6 - saut], pli: 1 };
        var jD = haut > .5 ? { vers: [x - 7, hy + 6], pli: 1 } : { vers: [hx - 8 - 9 * S(pas), 272 - Math.max(0, -Math.cos(pas)) * 6 - saut], pli: 1 };
        this.elle.pose({ x: hx, y: hyE, t: haut > .5 ? t : -90 - 8, h: 10 * ouv,
          brasG: haut > .5 ? { vers: [CE[0] - 30 * (1 - ouv) + 36 * ouv, CE[1] + 6 - 26 * ouv], pli: -1 } : [-150 + 30 * S(pas), 20],
          brasD: haut > .5 ? { vers: [CE[0] - 26 * (1 - ouv) + 30 * ouv, CE[1] + 14 + 20 * ouv], pli: 1 } : [150 - 30 * S(pas), -20],
          jambeG: jG, jambeD: jD });
      } },
    /* colonne à trois, d'après la photo de Sévane (19 oct.) : le porteur marche, elle est debout sur ses épaules
       (il lui tient les tibias), la troisième est dans ses bras, jambes autour de sa taille */
    colonne: { vb: [180, 340], init: function (g) { this.bas = new Corps(g); this.mil = new Corps(g); this.haut = new Corps(g); }, frame: function (n) {
        var ph = n.g * .009, x = 86, sw = S(ph), bob = Math.abs(S(ph)) * 3, hy = 278 - bob, sol = 330;
        var pG = [x - 5 + 16 * sw, sol - Math.max(0, Math.cos(ph)) * 7], pD = [x + 5 - 16 * sw, sol - Math.max(0, -Math.cos(ph)) * 7];
        var tilt = S(ph) * 1.5, C = [x + Math.cos((-90 + tilt) * R) * L.torse, hy + Math.sin((-90 + tilt) * R) * L.torse];
        /* elle : pieds sur les épaules du porteur */
        var piedsG = [C[0] - 13, C[1] - 2], piedsD = [C[0] + 13, C[1] - 2], h2 = [C[0] + S(ph * .5) * 1.2, C[1] - 52], tibias = [C[0], C[1] - 26];
        this.bas.pose({ x: x, y: hy, t: -90 + tilt, h: -14, brasG: { vers: [tibias[0] - 12, tibias[1]], pli: 1 }, brasD: { vers: [tibias[0] + 12, tibias[1] + 2], pli: -1 },
          jambeG: { vers: pG, pli: -1 }, jambeD: { vers: pD, pli: 1 } });
        var C2 = [h2[0] + 1, h2[1] - L.torse];
        this.mil.pose({ x: h2[0], y: h2[1], t: -90 + S(ph * .5) * 1.5, h: 10, brasG: { vers: [C2[0] - 14, C2[1] + 8], pli: -1 }, brasD: { vers: [C2[0] - 10, C2[1] - 2], pli: -1 },
          jambeG: { vers: piedsG, pli: -1 }, jambeD: { vers: piedsD, pli: 1 } });
        /* la troisième : face à elle, jambes enroulées autour de sa taille, bras autour de son cou */
        var h3 = [h2[0] - 30, h2[1] - 14];
        this.haut.pose({ x: h3[0], y: h3[1], t: -84, h: 20, brasG: { vers: [C2[0] + 6, C2[1] - 6], pli: 1 }, brasD: { vers: [C2[0] + 3, C2[1] + 4], pli: 1 },
          jambeG: [-95, 105], jambeD: [-80, 95], pieds: -100 });
      } },
    /* équilibre sur cannes : quand on défile vite il penche, puis se rattrape */
    cannes: { vb: [160, 300], init: function (g) {
        el(g, "path", { "class": "t1", d: "M68 292L69 206M92 292L91 206M60 292h16M84 292h16" });
        el(g, "path", { "class": "t2", d: "M69.5 292L70 206M91 292L90.5 206" });
        el(g, "rect", { x: 63, y: 202, width: 12, height: 4, "class": "t1" }); el(g, "rect", { x: 85, y: 202, width: 12, height: 4, "class": "t1" });
        this.pivot = el(g, "g", {}); this.c = new Corps(this.pivot);
      }, frame: function (n) {
        var t = n.g * .004, k = (t % 3 + 3) % 3, m = Math.min(1, (k % 1) * 2), fig = Math.floor(k);
        var A = [[0, 0, 0, 0], [-55, 0, 55, 0], [-20, 95, 30, -10]][fig], B = [[-55, 0, 55, 0], [-20, 95, 30, -10], [0, 0, 0, 0]][fig];
        function mix(i) { return A[i] + (B[i] - A[i]) * (.5 - .5 * Math.cos(m * Math.PI)); }
        this.pivot.setAttribute("transform", "rotate(" + f(n.penche) + " 80 204)");
        this.c.pose({ x: 80, y: 196 - 30 - L.torse + 2, t: 90, h: 0,
          brasG: { vers: [69, 204], pli: -1 }, brasD: { vers: [91, 204], pli: 1 },
          jambeG: [mix(0), mix(1)], jambeD: [mix(2), mix(3)], pieds: 90 });
      } },
    /* salto : élan, saut groupé, réception (sur la piste, il avance avec le défilement) */
    salto: { vb: [160, 220], init: function (g) { this.pivot = el(g, "g", {}); this.c = new Corps(this.pivot); }, frame: function (n) {
        var ph = ((n.g * .0028) % 1 + 1) % 1, air = ph > .25 && ph < .85, u = air ? (ph - .25) / .6 : 0;
        var hy = 158 - (air ? 4 * u * (1 - u) * 70 : 0) + (ph < .25 ? Math.sin(ph / .25 * Math.PI) * 8 : 0), rot = air ? -u * 360 : 0;
        var gr = air ? Math.sin(u * Math.PI) : 0;
        this.pivot.setAttribute("transform", "rotate(" + f(rot) + " 80 " + f(hy - 18) + ")");
        this.c.pose({ x: 80, y: hy, t: -90 - gr * 25, h: -gr * 20,
          brasG: [-150 + gr * 60, -10 - gr * 40], brasD: [150 - gr * 200, 10 - gr * 40],
          jambeG: [-gr * 95, 10 + gr * 120], jambeD: [-gr * 80 + 4, 6 + gr * 110] });
      } }
  };

  /* ---------------- moteur */
  var tous = [], vis = new Set(), ys = scrollY, lastY = ys, vel = 0, on = false;
  function monte(span, i) {
    var N = NUMEROS[span.dataset.p]; if (!N) return;
    var svg = el(span, "svg", { viewBox: "0 0 " + N.vb[0] + " " + N.vb[1], "aria-hidden": "true" }), g = el(svg, "g", {});
    var o = Object.create(N); o.essai = span.hasAttribute("data-horloge"); o.init(g); o.span = span; o.k = i * .37; o.penche = 0; o.v = 0;
    o.horloge = span.hasAttribute("data-horloge"); o.gt = o.k * 900;  /* page Essais : le pantin joue tout seul, en boucle */
    o.temps = span.closest(".loader") || o.horloge ? 1 : 0;
    o.frame({ g: o.k * 900, roule: 0, penche: 0, calme: !o.temps }); tous.push(o); return o;
  }
  function frame(now) {
    /* les pantins suivent le défilement avec du retard : ils continuent un peu après l'arrêt, puis ralentissent */
    var vrai = scrollY; ys += (vrai - ys) * .045; if (Math.abs(vrai - ys) < .3) ys = vrai;
    var y = ys, dy = y - lastY; lastY = y; vel = vel * .75 + dy * .25; var busy = Math.abs(vel) > .05 || ys !== vrai;
    tous.forEach(function (o) {
      if (!o.temps && !vis.has(o.span)) return;
      var s = o.span, pause = o.horloge && s.hasAttribute("data-pause");
      if (o.horloge && !pause) o.gt += Math.min(50, now - (o.dern || now)) * .45 * (parseFloat(s.dataset.vitesse) || 1);
      o.dern = now;
      var g = o.horloge ? o.gt : o.temps ? now * .45 : y + o.k * 900, roule = g * .35;
      if (o.temps && !pause) busy = true;
      if (s.classList.contains("roule")) {
        var pi = s.parentElement, cs = getComputedStyle(pi), r = pi.getBoundingClientRect(), top = r.top + (vrai - ys), tt = Math.max(0, Math.min(1, (innerHeight - top) / (innerHeight + r.height)));
        /* --pente : la piste est une diagonale, le pantin monte en avançant */
        roule = tt * (pi.clientWidth - s.offsetWidth - 2 * parseFloat(cs.paddingLeft || 0)); s.style.transform = "translate(" + f(roule) + "px," + f(-tt * (parseFloat(cs.getPropertyValue("--pente")) || 0) * pi.clientHeight) + "px)";
        roule *= 160 / s.offsetWidth;
      }
      var cible = Math.max(-26, Math.min(26, vel * 1.5)); o.v += (cible - o.penche) * .07; o.v *= .86; o.penche += o.v;
      if (Math.abs(o.v) > .02 || Math.abs(o.penche) > .05) busy = true;
      o.frame({ g: g, roule: roule, penche: o.penche, calme: pause || (!o.temps && Math.abs(vrai - ys) < 2 && Math.abs(vel) < .4) });
      if (o.bouge) busy = true;
    });
    if (busy) requestAnimationFrame(frame); else on = false;
  }
  function kick() { if (!on) { on = true; requestAnimationFrame(frame); } }
  [].forEach.call(document.querySelectorAll(".pantin"), function (s, i) { monte(s, i); });
  if (reduce) return;
  var io = new IntersectionObserver(function (es) { es.forEach(function (e) { e.isIntersecting ? vis.add(e.target) : vis.delete(e.target); }); kick(); }, { rootMargin: "80px" });
  tous.forEach(function (o) { if (!o.temps) io.observe(o.span); });
  addEventListener("scroll", kick, { passive: true }); addEventListener("resize", kick);
  /* l'ouverture vit sur une horloge, puis s'arrête */
  var ld = document.querySelector(".loader");
  if (ld && !document.documentElement.classList.contains("seen")) { kick(); setTimeout(function () { tous.forEach(function (o) { if (!o.horloge) o.temps = 0; }); }, 3200); }
  else tous.forEach(function (o) { if (!o.horloge) o.temps = 0; });
  if (tous.some(function (o) { return o.horloge; })) kick();
  window.pantinsKick = kick;
})();
