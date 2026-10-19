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
        this.c = new Corps(g); this.balles = [0, 1, 2].map(function () { return new Rond(g, 4.2); });
      }, frame: function (n) {
        var t = n.g * .0045, mains = [[57, 108], [103, 108]];
        for (var i = 0; i < 3; i++) {
          var ph = ((t + i / 3) % 1 + 1) % 1, u = (ph % .5) * 2, x = ph < .5 ? 57 + 46 * u : 103 - 46 * u, y = 106 - 70 * 4 * u * (1 - u);
          this.balles[i].set([x, y]);
        }
        var b = S(t * Math.PI * 4) * 5;
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
  var tous = [], vis = new Set(), lastY = scrollY, vel = 0, on = false;
  function monte(span, i) {
    var N = NUMEROS[span.dataset.p]; if (!N) return;
    var svg = el(span, "svg", { viewBox: "0 0 " + N.vb[0] + " " + N.vb[1], "aria-hidden": "true" }), g = el(svg, "g", {});
    var o = Object.create(N); o.init(g); o.span = span; o.k = i * .37; o.penche = 0; o.v = 0;
    o.temps = span.closest(".loader") ? 1 : 0;
    o.frame({ g: o.k * 900, roule: 0, penche: 0 }); tous.push(o); return o;
  }
  function frame(now) {
    var y = scrollY, dy = y - lastY; lastY = y; vel = vel * .75 + dy * .25; var busy = Math.abs(vel) > .05;
    tous.forEach(function (o) {
      if (!o.temps && !vis.has(o.span)) return;
      var g = o.temps ? now * .45 : y + o.k * 900, roule = g * .35, s = o.span;
      if (o.temps) busy = true;
      if (s.classList.contains("roule")) {
        var pi = s.parentElement, r = pi.getBoundingClientRect(), tt = Math.max(0, Math.min(1, (innerHeight - r.top) / (innerHeight + r.height)));
        roule = tt * (pi.clientWidth - s.offsetWidth - 2 * parseFloat(getComputedStyle(pi).paddingLeft || 0)); s.style.transform = "translateX(" + f(roule) + "px)";
        roule *= 160 / s.offsetWidth;
      }
      var cible = Math.max(-26, Math.min(26, vel * 1.5)); o.v += (cible - o.penche) * .07; o.v *= .86; o.penche += o.v;
      if (Math.abs(o.v) > .02 || Math.abs(o.penche) > .05) busy = true;
      o.frame({ g: g, roule: roule, penche: o.penche });
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
  if (ld && !document.documentElement.classList.contains("seen")) { kick(); setTimeout(function () { tous.forEach(function (o) { o.temps = 0; }); }, 3200); }
  else tous.forEach(function (o) { o.temps = 0; });
})();
