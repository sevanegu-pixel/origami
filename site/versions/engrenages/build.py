# -*- coding: utf-8 -*-
"""Génère le site statique de la Cie Origami (direction « Engrenages », octobre 2026).

    python3 build.py   -> dossier dist/ (le site à mettre en ligne)

De vieux engrenages dessinés au crayon, qui tournent quand la page défile.
Tous les mécanismes sont du dessin géométrique calculé ici (aucune image) :
les roues engrenées ont le même pas, tournent en sens inverse, et leur vitesse
dépend du nombre de dents (même vitesse au cercle primitif partout sur le site).

Les textes et données sont dans content.py, le design dans style.css.
"""
import html, os, re, shutil, sys, datetime, math, random

TODAY = datetime.date.today().isoformat()
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))  # dossier site/ : content.py et logo.svg communs
sys.path.insert(0, ROOT)
from content import SITE, SHOWS, ARTISTS, HISTORY, COMMITTEE, COLLABS, SUPPORTERS, REDIRECTS
from medias import photo, video
DIST = os.path.join(HERE, "dist")
E = html.escape
FONTS = ("https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400;0,500;1,400"
         "&family=IM+Fell+English:ital@0;1&family=Special+Elite&display=swap")

_LOGO = open(os.path.join(ROOT, "logo.svg")).read()
LOGO_SVG = re.sub(r'fill="#[0-9A-Fa-f]+"', 'fill="currentColor" role="img" aria-label="Compagnie Origami"', _LOGO, count=1)

# vitesse commune au cercle primitif : px de denture parcourus par px défilé
V = 0.17


def img(mid, w=1400):
    return photo(mid, w)


def pic(mid, alt, w=1400, eager=False):
    return f'<img src="{img(mid, w)}" alt="{E(alt)}" loading="{"eager" if eager else "lazy"}" decoding="async">'


def href(slug):
    return "index.html" if slug in ("", "index") else f"{slug}.html"


SHOW_BY_SLUG = {s["slug"]: s for s in SHOWS}
HOME_ORDER = ["commeunpoint", "la-petite-fille-dans-la-poubelle", "caborigamique", "edmd", "oups-vache", "des-pates-au-seum"]
HOME_TAG = {
    "commeunpoint": "Création 2026 · Rue",
    "la-petite-fille-dans-la-poubelle": "En tournée · Rue & salle",
    "caborigamique": "Cabaret de rue · Formule adaptable",
    "edmd": "Solo en tournée · Salle",
    "oups-vache": "En création jusqu'en l'an 2250",
    "des-pates-au-seum": "Création en devenir · 2027",
}
MENU = [("spectacles", "Spectacles"), ("agenda", "Agenda"), ("quisommesnous", "Compagnie"), ("collabs", "Collaborations"), ("contact", "Contact")]


# ================================================================ dessin au crayon

_N = [0]


def nid(p):
    _N[0] += 1
    return f"{p}{_N[0]}"


def fm(x):
    """Coordonnée arrondie au demi-pixel (fichiers plus légers)."""
    v = round(x * 2) / 2
    return str(int(v)) if v == int(v) else str(v)


def d_of(pts, closed=False):
    return "M" + "L".join(fm(x) + " " + fm(y) for x, y in pts) + ("Z" if closed else "")


class Pen:
    """Un crayon un peu tremblant (déterministe : même dessin à chaque build)."""

    def __init__(self, seed):
        self.r = random.Random(seed)

    def u(self, a, b):
        return self.r.uniform(a, b)

    def wave(self, amp):
        ph = [self.u(0, 6.3) for _ in range(3)]
        k = [self.u(.5, 1) for _ in range(3)]
        return lambda t: amp * (math.sin(2 * t + ph[0]) * k[0] * .55 + math.sin(3 * t + ph[1]) * k[1] * .3 + math.sin(5 * t + ph[2]) * k[2] * .15)

    def circle(self, cx, cy, r, amp=.7, over=.14):
        w = self.wave(amp)
        n = max(18, int(r * .7))
        a0 = self.u(0, 6.3)
        span = 2 * math.pi * (1 + self.u(.03, over))
        dr = self.u(-1, 1) * min(2.0, r * .05)
        pts = []
        for i in range(n + 1):
            t = i / n
            a = a0 + span * t
            rr = r + w(a) + dr * t
            pts.append((cx + rr * math.cos(a), cy + rr * math.sin(a)))
        return d_of(pts)

    def line(self, x1, y1, x2, y2, amp=.6, ext=3):
        dx, dy = x2 - x1, y2 - y1
        L = math.hypot(dx, dy) or 1
        ux, uy = dx / L, dy / L
        nx, ny = -uy, ux
        e1, e2 = self.u(-ext * .3, ext), self.u(-ext * .3, ext)
        n = max(2, int(L / 22))
        pts = []
        for i in range(n + 1):
            t = i / n
            off = self.u(-amp, amp)
            x = x1 - ux * e1 + (dx + ux * (e1 + e2)) * t + nx * off
            y = y1 - uy * e1 + (dy + uy * (e1 + e2)) * t + ny * off
            pts.append((x, y))
        return d_of(pts)

    def hatch(self, x0, y0, x1, y1, ang, gap, amp=.4):
        """Hachures parallèles couvrant un rectangle (à découper par clipPath) ; traits courts, 3 points."""
        a = math.radians(ang)
        ux, uy = math.cos(a), math.sin(a)
        nx, ny = -uy, ux
        cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
        hw, hh = (x1 - x0) / 2 + 1, (y1 - y0) / 2 + 1
        reach = abs(nx) * hw + abs(ny) * hh  # demi-étendue perpendiculaire
        out = []
        k = -reach
        while k <= reach:
            px, py = cx + nx * k, cy + ny * k
            # longueur utile du trait dans le rectangle
            ts = []
            if abs(ux) > 1e-6:
                ts += [(-hw - (px - cx)) / ux, (hw - (px - cx)) / ux]
            if abs(uy) > 1e-6:
                ts += [(-hh - (py - cy)) / uy, (hh - (py - cy)) / uy]
            lo = max(min(ts[0], ts[1]), min(ts[2], ts[3])) if len(ts) == 4 else min(ts)
            hi = min(max(ts[0], ts[1]), max(ts[2], ts[3])) if len(ts) == 4 else max(ts)
            if hi > lo:
                lo -= 1
                hi += 1
                m = (lo + hi) / 2
                o = self.u(-amp, amp)
                out.append(d_of([(px + ux * lo, py + uy * lo), (px + ux * m + nx * o, py + uy * m + ny * o), (px + ux * hi, py + uy * hi)]))
            k += gap * self.u(.8, 1.2)
        return "".join(out)


def strokes(P, d1, d2):
    return f'<path class="s1" pathLength="1" d="{d1}"/><path class="s2" pathLength="1" d="{d2}"/>'


def circ2(P, cx, cy, r, fill=False):
    f = f'<path class="f" d="{P.circle(cx, cy, r, .2, 0)}"/>' if fill else ""
    return f + strokes(P, P.circle(cx, cy, r), P.circle(cx, cy, r * 1.012 + .4, .9))


def line2(P, x1, y1, x2, y2):
    return strokes(P, P.line(x1, y1, x2, y2), P.line(x1 + .6, y1 + .5, x2 + .4, y2 - .5, .9))


def gear_outline(P, z, m, amp):
    r = m * z / 2
    ra, rf = r + m * .95, r - 1.2 * m
    p = 2 * math.pi / z
    w = P.wave(amp)
    pts = []
    for i in range(z):
        c = i * p
        for rad, off in ((rf, -.5), (rf, -.3), (ra, -.15), (ra, .15), (rf, .3)):
            a = c + off * p
            rr = rad + w(a) + P.u(-.25, .25)
            pts.append((rr * math.cos(a), rr * math.sin(a)))
    return d_of(pts, True)


def gear_body(z, m, seed, kind="spokes", crank=0):
    P = Pen(seed)
    r = m * z / 2
    rf = r - 1.2 * m
    rh = max(6.0, r * .2)
    out = []
    prof = gear_outline(P, z, m, .8)
    out.append(f'<path class="s1" pathLength="1" d="{prof}"/><path class="s2" pathLength="1" d="{gear_outline(P, z, m, 1.4)}"/>')
    if z >= 14:
        rr = rf - .9 * m
        if kind == "web":
            cid = nid("c")
            out.append(f'<clipPath id="{cid}"><circle r="{rr:.1f}"/></clipPath>')
            out.append(f'<path class="h" clip-path="url(#{cid})" d="{P.hatch(-rr, -rr, rr, rr, 40 + P.u(-8, 8), 5.5)}"/>')
            nh = 6 if z > 22 else 4
            rho, hr = (rr + rh) / 2, (rr - rh) * .3
            a0 = P.u(0, 6.3)
            for k in range(nh):
                a = a0 + k * 2 * math.pi / nh
                out.append(circ2(P, rho * math.cos(a), rho * math.sin(a), hr, True))
        else:
            ns = 4 if z < 24 else 6
            o = max(2.4, m * .55)
            a0 = P.u(0, 6.3)
            for k in range(ns):
                a = a0 + k * 2 * math.pi / ns
                ca, sa = math.cos(a), math.sin(a)
                for s in (-1, 1):
                    x1, y1 = (rh + 1) * ca - s * o * sa, (rh + 1) * sa + s * o * ca
                    x2, y2 = (rr - 1) * ca - s * o * sa, (rr - 1) * sa + s * o * ca
                    out.append(line2(P, x1, y1, x2, y2))
        out.append(strokes(P, P.circle(0, 0, rr), P.circle(0, 0, rr + 1.2, 1)))
    else:
        out.append(f'<path class="s2" pathLength="1" d="{P.circle(0, 0, rf - .7 * m, .5)}"/>')
    if crank:
        a = 0
        o = max(3.0, rh * .45)
        out.append(line2(P, rh * .8, -o, crank, -o * .6))
        out.append(line2(P, rh * .8, o, crank, o * .6))
        out.append(circ2(P, crank, 0, 8, True))
        out.append(f'<path class="s1" pathLength="1" d="{P.circle(crank, 0, 2.6, .3)}"/>')
    hid = nid("c")
    out.append(circ2(P, 0, 0, rh, True))
    out.append(f'<clipPath id="{hid}"><circle r="{rh:.1f}"/></clipPath>')
    out.append(f'<path class="h" clip-path="url(#{hid})" d="{P.hatch(-rh, -rh, rh, rh, -45, 2.6, .2)} {P.hatch(-rh, -rh, rh, rh, 45, 3.4, .2)}"/>')
    out.append(circ2(P, 0, 0, rh * .45, True))
    return prof, "".join(out)


def gear_svg(cx, cy, z, m, ph, seed, kind="spokes", tone="", crank=0, w=None, k=None):
    r = m * z / 2
    R = max(r + m * 1.6, crank + 12) + 4
    attrs = f' data-w="{w:.4f}"' if w is not None else ""
    prof, body = gear_body(z, m, seed, kind, crank)
    style = f"left:{cx - R:.1f}px;top:{cy - R:.1f}px"
    if k is not None:
        style += f";--k:{k:.4f}"
    return (f'<svg class="g {tone}"{attrs} viewBox="{-R:.1f} {-R:.1f} {2 * R:.1f} {2 * R:.1f}" width="{2 * R:.0f}" height="{2 * R:.0f}" '
            f'style="{style}" aria-hidden="true" focusable="false"><g transform="rotate({ph:.2f})"><path class="bg" d="{prof}"/>'
            f'<g filter="url(#crayon)">{body}</g></g></svg>')


class Mech:
    """Un petit mécanisme : roues engrenées, crémaillère, bielle, ressort."""

    def __init__(self, W, H, seed, cls="", live=True, label=""):
        self.W, self.H, self.cls, self.live, self.label = W, H, cls, live, label
        self.P = Pen(seed)
        self.seed = seed
        self.gears = []
        self.parts = []
        self.static = []

    def _speed(self, r, sign):
        return sign * V / r * 180 / math.pi

    def gear(self, z, m, cx=None, cy=None, after=None, ang=0, sign=1, kind="spokes", tone="", crank=0):
        if after is not None:
            g0 = self.gears[after]
            d = m * (g0["z"] + z) / 2
            t = math.radians(ang)
            cx, cy = g0["cx"] + d * math.cos(t), g0["cy"] + d * math.sin(t)
            u1 = ((t - math.radians(g0["ph"])) * g0["z"] / (2 * math.pi)) % 1
            ph = math.degrees(t + math.pi - (.5 - u1) * 2 * math.pi / z)
            w = -g0["w"] * g0["z"] / z
        else:
            ph = self.P.u(0, 360)
            w = self._speed(m * z / 2, sign)
        g = dict(z=z, m=m, cx=cx, cy=cy, ph=ph, w=w, kind=kind, tone=tone, crank=crank)
        self.gears.append(g)
        if after is not None:  # un axe dessiné entre les deux centres ? non : seulement le support
            pass
        return len(self.gears) - 1

    def rack(self, y, x0, x1, m, gears):
        """Crémaillère (ligne primitive y) ; gears = [(x, z, kind, tone)] posées dessus, tournant en sens horaire."""
        p = math.pi * m
        idx = []
        for x, z, kind, tone in gears:
            r = m * z / 2
            frac = ((x0 - x) / p) % 1
            g = dict(z=z, m=m, cx=x, cy=y - r, ph=90 - frac * 360 / z, w=self._speed(r, 1), kind=kind, tone=tone, crank=0)
            self.gears.append(g)
            idx.append(len(self.gears) - 1)
        P = self.P
        L, T = x0 - p, y - 1.6 * m
        W, H = (x1 - x0) + 2 * p, 4.6 * m
        root, tip, base = 1.25 * m + 1.6 * m, .6 * m, 3.9 * m
        pts = []
        k = 0
        while True:
            xt = p + (k + .5) * p  # local
            if xt > W:
                break
            for dx, yy in ((-.5, root), (-.3, root), (-.16, tip), (.16, tip), (.3, root)):
                pts.append((xt + dx * p + P.u(-.3, .3), yy + P.u(-.3, .3)))
            k += 1
        pts.append((W, root))
        teeth = d_of(pts)
        cid = nid("c")
        body = (f'<path class="f" d="{teeth} L{W:.1f} {base:.1f} L0 {base:.1f}Z"/>'
                + strokes(P, teeth, d_of([(x + .5, y_ + .6) for x, y_ in pts]))
                + line2(P, 0, base, W, base)
                + f'<clipPath id="{cid}"><rect x="0" y="{root + 1.5:.1f}" width="{W:.1f}" height="{base - root - 2:.1f}"/></clipPath>'
                + f'<path class="h" clip-path="url(#{cid})" d="{P.hatch(0, root, W, base, 60, 4.5, .3)}"/>')
        self.parts.append(f'<svg class="rk" data-v="{V}" data-p="{p:.4f}" width="{W:.0f}" height="{H:.0f}" viewBox="0 0 {W:.1f} {H:.1f}" '
                          f'style="left:{L:.1f}px;top:{T:.1f}px" aria-hidden="true"><g filter="url(#crayon)">{body}</g></svg>')
        return idx

    def bielle(self, gi, R, L, xw):
        """Bielle horizontale sur la roue gi (maneton à R), piston et ressort jusqu'au mur xw."""
        g = self.gears[gi]
        g["crank"] = R
        cx, cy, P = g["cx"], g["cy"], self.P
        B = 100.0
        rod = (line2(P, 12, 8, L + 12, 9) + line2(P, 12, 16, L + 12, 15)
               + circ2(P, 12, 12, 10, True) + circ2(P, L + 12, 12, 9, True)
               + f'<path class="s1" pathLength="1" d="{P.circle(L + 12, 12, 3, .3)}"/>')
        cid = nid("c")
        pis = (f'<path class="f" d="M4 4 L58 4 L58 32 L4 32Z"/>'
               + line2(P, 4, 4, 58, 4) + line2(P, 58, 4, 58, 32) + line2(P, 58, 32, 4, 32) + line2(P, 4, 32, 4, 4)
               + f'<clipPath id="{cid}"><rect x="24" y="5" width="33" height="26"/></clipPath>'
               + f'<path class="h" clip-path="url(#{cid})" d="{P.hatch(24, 4, 58, 32, -50, 3.5, .2)}"/>'
               + circ2(P, 12, 18, 5, True))
        zz = []
        n = 9
        for i in range(n + 1):
            zz.append((B * i / n + P.u(-.8, .8), (11 if i % 2 else -11) + 12 + P.u(-.8, .8)))
        spr = strokes(P, d_of([(0, 12)] + zz[1:-1] + [(B, 12)]), d_of([(1, 12.5)] + [(x + 1, y + .8) for x, y in zz[1:-1]] + [(B, 12.5)]))
        # position au repos (défilement 0), recalculée par le script
        a = math.radians(g["ph"])
        px, py = cx + R * math.cos(a), cy + R * math.sin(a)
        dy = cy - py
        xs = px + math.sqrt(L * L - dy * dy)
        th = math.degrees(math.atan2(dy, xs - px))
        self.parts.append(
            f'<div class="bl" data-cx="{cx:.1f}" data-cy="{cy:.1f}" data-r="{R}" data-l="{L}" data-ph="{g["ph"]:.2f}" data-cw="{g["w"]:.4f}" data-xw="{xw}" data-b="{B}">'
            f'<svg class="rod" width="{L + 24}" height="24" viewBox="0 0 {L + 24} 24" style="transform:translate({px - 12:.1f}px,{py - 12:.1f}px) rotate({th:.2f}deg)" aria-hidden="true"><g filter="url(#crayon)">{rod}</g></svg>'
            f'<svg class="pis" width="62" height="36" viewBox="0 0 62 36" style="transform:translate({xs - 12:.1f}px,{cy - 18:.1f}px)" aria-hidden="true"><g filter="url(#crayon)">{pis}</g></svg>'
            f'<svg class="spr" width="{B:.0f}" height="24" viewBox="0 0 {B:.0f} 24" preserveAspectRatio="none" style="transform:translate({xs + 46:.1f}px,{cy - 12:.1f}px) scaleX({(xw - xs - 46) / B:.3f})" aria-hidden="true"><g filter="url(#crayon)">{spr}</g></svg></div>')
        # glissière et mur, fixes
        top, bot = cy - 21, cy + 21
        x_lo = cx + L - R - 14
        cid = nid("c")
        self.static.append(line2(P, x_lo, top, xw, top) + line2(P, x_lo, bot, xw, bot)
                           + line2(P, xw, cy - 46, xw, cy + 46)
                           + f'<clipPath id="{cid}"><rect x="{xw}" y="{cy - 46}" width="16" height="92"/></clipPath>'
                           + f'<path class="h" clip-path="url(#{cid})" d="{P.hatch(xw, cy - 46, xw + 16, cy + 46, -55, 4, .3)}"/>')

    def support(self, gi, y_base):
        """Petit chevalet sous l'axe d'une roue."""
        g = self.gears[gi]
        P = self.P
        cx, cy = g["cx"], g["cy"]
        self.static.append(line2(P, cx - 3, cy, cx - 22, y_base) + line2(P, cx + 3, cy, cx + 22, y_base))

    def base(self, x1, x2, y):
        P = self.P
        cid = nid("c")
        self.static.append(line2(P, x1, y, x2, y) + f'<clipPath id="{cid}"><rect x="{x1}" y="{y}" width="{x2 - x1}" height="9"/></clipPath>'
                           + f'<path class="h" clip-path="url(#{cid})" d="{P.hatch(x1, y, x2, y + 9, -50, 5, .3)}"/>')

    def html(self, style=""):
        base = None
        gs = []
        for i, g in enumerate(self.gears):
            if base is None:
                base = abs(g["w"])
            w = g["w"] if self.live else None
            k = None if self.live else g["w"] / base
            gs.append(gear_svg(g["cx"], g["cy"], g["z"], g["m"], g["ph"], self.seed * 31 + i, g["kind"], g["tone"], g["crank"], w, k))
        st = ""
        if self.static:
            st = (f'<svg class="st" width="{self.W}" height="{self.H}" viewBox="0 0 {self.W} {self.H}" aria-hidden="true">'
                  f'<g filter="url(#crayon)">{"".join(self.static)}</g></svg>')
        lab = f'<span class="fig" aria-hidden="true">{E(self.label)}</span>' if self.label else ""
        cls = self.cls + (" lv" if self.live else "")
        return (f'<div class="mech {cls}" style="width:{self.W}px;height:{self.H}px;{style}" aria-hidden="true">'
                f'{st}{"".join(gs)}{"".join(self.parts)}{lab}</div>')


# ---------------------------------------------------------------- machines

def machine_hero():
    M = Mech(480, 410, 7, "hero-m", label="fig. 1")
    a = M.gear(24, 7, 120, 290, kind="spokes")
    b = M.gear(12, 7, after=a, ang=-60, tone="lav")
    c = M.gear(20, 7, after=b, ang=-15, kind="web", tone="vio")
    M.gear(10, 7, after=c, ang=-72)
    M.bielle(a, 50, 170, 452)
    M.support(a, 392)
    M.base(10, 470, 392)
    return M.html()


def machine_title(seed):
    """Petit train de roues pour le titre de chaque page."""
    r = random.Random(seed)
    M = Mech(300, 250, seed, "title-m", label=f"fig. {seed % 7 + 2}")
    a = M.gear(18, 6, 90, 150, kind=r.choice(["spokes", "web"]))
    b = M.gear(11, 6, after=a, ang=-35 + r.uniform(-6, 6), tone="lav")
    c = M.gear(15, 6, after=b, ang=20 + r.uniform(-6, 6), kind="web" if r.random() < .5 else "spokes", tone="vio")
    M.gear(8, 6, after=c, ang=-80 + r.uniform(-8, 8))
    M.support(a, 236)
    M.support(c, 236)
    M.base(10, 290, 236)
    return M.html()


def divider(seed, cls=""):
    """Bande entre deux sections : une crémaillère et des roues qui roulent dessus."""
    r = random.Random(seed)
    m = 5
    M = Mech(1000, 190, seed, "rack-m")
    sh = r.uniform(-25, 25)
    on = M.rack(170, -230, 1230, m, [(35, 12, "plain", ""), (270 + sh, 20, "spokes", ""), (500 + sh * .3, 14, "web", "lav"),
                                    (735 - sh, 24, "spokes", "vio"), (975, 16, "web", "")])
    M.gear(9, m, after=on[2], ang=r.uniform(-130, -50))
    M.gear(11, m, after=on[3], ang=r.uniform(-160, -135))
    M.gear(10, m, after=on[1], ang=r.uniform(-60, -35))
    return f'<div class="band-m {cls}" aria-hidden="true">{M.html()}</div>'


def edge(seed, side="l"):
    """Grande roue coupée par le bord de l'écran, avec sa petite voisine."""
    r = random.Random(seed)
    M = Mech(360, 420, seed, "edge-m")
    a = M.gear(36, 8, 180, 240, kind=r.choice(["spokes", "web"]), sign=1 if side == "l" else -1)
    ang = r.uniform(-80, -66) if side == "l" else r.uniform(-114, -100)
    b = M.gear(13, 8, after=a, ang=ang, tone="lav")
    M.gear(9, 8, after=b, ang=ang + (40 if side == "l" else -40))
    return f'<div class="edge {side}" aria-hidden="true">{M.html()}</div>'


def mini(seed, z=9, tone=""):
    M = Mech(46, 46, seed, "mini")
    M.gear(z, 3.2, 23, 23, tone=tone)
    return M.html()


def menu_cogs():
    M = Mech(620, 620, 41, "menu-m", live=False)
    a = M.gear(30, 15, 310, 310, kind="web")
    M.gear(14, 13, after=a, ang=118, tone="lav")
    return M.html()


def loader_cogs():
    M = Mech(250, 190, 53, "load-m", live=False)
    a = M.gear(20, 6, 75, 95, kind="spokes")
    b = M.gear(12, 6, after=a, ang=-8, tone="lav")
    M.gear(8, 6, after=b, ang=60)
    return M.html()


DEFS = """<svg class="defs" width="0" height="0" aria-hidden="true" focusable="false" style="position:absolute">
<filter id="crayon" x="-6%" y="-6%" width="112%" height="112%" color-interpolation-filters="sRGB">
<feTurbulence type="fractalNoise" baseFrequency=".05" numOctaves="2" seed="4" result="n"/>
<feDisplacementMap in="SourceGraphic" in2="n" scale="2.6" xChannelSelector="R" yChannelSelector="G" result="d"/>
<feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="1" seed="9" result="g"/>
<feColorMatrix in="g" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  2.4 0 0 0 -.45" result="gm"/>
<feComposite in="d" in2="gm" operator="in"/>
</filter></svg>"""


# ---------------------------------------------------------------- gabarit

def head(title, desc, path, og=None):
    full = "Compagnie Origami | Cirque contemporain, Genève" if title == SITE["name"] else f"{title} | Cie Origami"
    og = og or SITE["og_image"]
    return f"""<!doctype html><html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>{E(full)}</title><meta name="description" content="{E(desc)}">
<link rel="canonical" href="{SITE['url']}/{path}">
<meta property="og:type" content="website"><meta property="og:site_name" content="Cie Origami">
<meta property="og:title" content="{E(full)}"><meta property="og:description" content="{E(desc)}">
<meta property="og:image" content="{photo(og, 1600, absolute=True)}"><meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#0d0b14">
<link rel="icon" href="favicon.svg" type="image/svg+xml">
<script>document.documentElement.classList.add("js");try{{if(sessionStorage.getItem("origami-vu"))document.documentElement.classList.add("seen")}}catch(e){{}}</script>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="{FONTS}"><link rel="stylesheet" href="style.css"></head><body>"""


def header(active):
    cur = ' aria-current="page"'
    links = "".join(
        f'<a href="{href(k)}" style="--i:{i}"{cur if k == active else ""}><span class="n">{i + 1}.</span>{v}</a>'
        for i, (k, v) in enumerate(MENU))
    shows = "".join(f'<li><a href="{href(s["slug"])}">{E(s["title"])}</a></li>' for s in SHOWS if s["status"] != "Répertoire")
    return f"""{DEFS}<div class="loader" aria-hidden="true"><div class="ld">{loader_cogs()}<div class="ld-logo"><img src="logo.svg" alt=""></div></div></div>
<a class="sr" href="#contenu">Aller au contenu</a>
<header class="top"><a class="logo" href="index.html">{LOGO_SVG}</a>
<button class="open-menu" type="button" aria-expanded="false" aria-controls="menu"><span class="cog">{mini(901, 10, "lav")}</span><span>Menu</span></button></header>
<div class="menu" id="menu" role="dialog" aria-modal="true" aria-label="Menu"><div class="m-cogs" aria-hidden="true">{menu_cogs()}</div>
<button class="close" type="button"><span class="x" aria-hidden="true">×</span> Fermer</button>
<div class="menu-in"><nav class="main-links" aria-label="Rubriques">{links}</nav>
<div class="side"><div><h2>Les spectacles</h2><ul>{shows}</ul></div>
<div><h2>Nous écrire</h2><ul><li><a href="mailto:{SITE['email']}">{SITE['email']}</a></li><li><a href="{SITE['instagram']}" rel="noopener">Instagram</a> · <a href="{SITE['facebook']}" rel="noopener">Facebook</a></li></ul></div></div>
</div></div><div id="contenu"></div>"""


def footer():
    nav = "".join(f'<a href="{href(k)}">{v}</a>' for k, v in MENU)
    return f"""<footer class="foot">{divider(77, "foot-m")}<div class="in"><a class="flogo" href="index.html" aria-label="Accueil">{LOGO_SVG}</a><nav aria-label="Pied de page">{nav}</nav>
<div><a href="{SITE['instagram']}" rel="noopener">Instagram</a> · <a href="{SITE['facebook']}" rel="noopener">Facebook</a><br><small>© {datetime.date.today().year} Compagnie Origami · Genève</small></div></div></footer>"""


def sec_h(text, seed, tag="h2", cls=""):
    c = f"sec-h {cls}".strip()
    return f'<{tag} class="{c}">{mini(seed)}<span>{text}</span></{tag}>'


# ---------------------------------------------------------------- blocs

def show_block(s, i, tag_text=None, h="h2"):
    r = " r" if i % 2 else ""
    meta = tag_text or " · ".join(x for x in (s["genre"], s["venue"], s["duration"]) if x)
    ed = edge(300 + i, "r" if i % 2 else "l") if i % 2 == 0 or i == 3 else ""
    return f"""<div class="show-w">{ed}<a class="show{r}" href="{href(s['slug'])}"><div class="pic frame">{pic(s['card'], s['title'], 1100)}</div>
<div class="txt"><span class="meta">{E(meta)}</span><{h}>{E(s['title'])}</{h}><p class="teaser">{E(s['teaser'])}</p><span class="go">Découvrir <span aria-hidden="true">→</span></span></div></a></div>"""


def all_dates():
    rows = [(iso, label, place, s) for s in SHOWS for iso, label, place in s["dates"]]
    rows.sort(key=lambda r: r[0], reverse=True)
    return rows


def upcoming():
    return [r for r in all_dates() if r[0] >= TODAY][::-1]


def date_card(iso, label, place, s=None):
    title = f'<b><a href="{href(s["slug"])}">{E(s["title"])}</a></b>' if s else ""
    return f'<li class="d" data-iso="{iso}"><time class="when" datetime="{iso}">{E(label)}</time><span class="where">{title}{E(place)}</span></li>'


def date_line(iso, label, place, s=None):
    title = f' · <a href="{href(s["slug"])}">{E(s["title"])}</a>' if s else ""
    return f'<li><time class="when" datetime="{iso}">{E(label)}</time><span>{E(place)}{title}</span></li>'


def dates_list(rows, empty="De nouvelles dates arrivent bientôt."):
    items = "".join(date_card(*r) for r in rows)
    return f'<ul class="dates">{items}</ul><p class="empty"{" hidden" if rows else ""}>{E(empty)}</p>'


def newsletter():
    return f"""<section class="nl" aria-labelledby="nl-t">{sec_h("Newsletter", 611, "h2", "big")}
<p>De temps en temps, des nouvelles de nos créations et nos prochaines dates. Pas tous les deux jours, promis.</p>
<form name="newsletter" method="POST" data-netlify="true" netlify-honeypot="bot-field">
<input type="hidden" name="form-name" value="newsletter"><p hidden><label>Ne pas remplir <input name="bot-field"></label></p>
<label class="sr" for="nl-mail">Ton adresse e-mail</label><input id="nl-mail" type="email" name="email" placeholder="ton adresse e-mail" required autocomplete="email">
<button class="btn" type="submit">S'abonner</button></form></section>"""


def title_block(h1, intro, seed, extra=""):
    return f"""<section class="ph-title"><div class="t"><h1>{h1}</h1><p class="intro">{intro}</p>{extra}</div><div class="tm">{machine_title(seed)}</div></section>"""


# ---------------------------------------------------------------- pages

def page_index():
    shows = ""
    for i, sl in enumerate(HOME_ORDER):
        shows += show_block(SHOW_BY_SLUG[sl], i, HOME_TAG.get(sl))
        if i == 2:
            shows += divider(120)
    nxt = upcoming()[:4]
    return f"""<main>
<section class="hero"><h1>Bienvenue dans l'univers<br>de la cie <i>Origami</i></h1>
<div class="hm">{machine_hero()}</div>
<div class="intro"><p>Depuis 2018, la Cie Origami tisse des spectacles aux formes multiples, nés d'une passion commune : celle de créer, de raconter, de surprendre.</p>
<p>Chaque projet réunit des artistes de cirque aux univers singuliers, pour donner vie à des œuvres tantôt drôles, tantôt poétiques, toujours sensibles. La compagnie s'adresse à tous les publics (petits, grands ou avertis) avec le désir d'offrir des instants forts et partagés.</p></div></section>
{divider(110)}
<section aria-label="Spectacles" class="shows">{shows}</section>
{divider(130)}
<section class="next">{sec_h("Prochaines <i>dates</i>", 501)}{dates_list(nxt)}
<p class="all"><a class="go" href="agenda.html">Tout l'agenda <span aria-hidden="true">→</span></a></p></section>
<section class="cie-band"><div><blockquote>Nous sommes nulle part et partout à la fois, autant dans la bêtise que dans la poésie. Nous sommes le problème et la solution à la fois !</blockquote>
<a class="go" href="quisommesnous.html">Qui sommes-nous <span aria-hidden="true">→</span></a></div></section>
{newsletter()}</main>"""


def page_spectacles():
    current = [s for s in SHOWS if s["status"] != "Répertoire"]
    archive = [s for s in SHOWS if s["status"] == "Répertoire"]
    blocks = "".join(show_block(s, i, f"{s['status']} · {s['genre']}") for i, s in enumerate(current))
    rep = "".join(f"""<a href="{href(s['slug'])}"><div class="pic frame">{pic(s['card'], s['title'], 800)}</div><h3>{E(s['title'])}</h3><p>{E(s['teaser'])}</p></a>""" for s in archive)
    return f"""<main>{title_block("Spec<i>tacles</i>", "Cirque-théâtre, cabaret de rue, solos intimistes et créations en cours. En rue et en salle, pour tous les publics.", 11)}
<section class="shows">{blocks}</section>{divider(140)}
<section class="wrap">{sec_h("Le <i>répertoire</i>", 502)}</section><div class="rep">{rep}</div></main>"""


def page_show(s):
    body = "".join(f"<p>{p}</p>" for p in s["body"])
    meta = " · ".join(x for x in (s["genre"], s["duration"], s["public"], s["venue"]) if x)
    sub = f'<p class="sub">{E(s["subtitle"])}</p>' if s.get("subtitle") else ""
    quote = f'<blockquote class="quote">{E(s["quote"])}</blockquote>' if s["quote"] else ""
    links = "".join(f'<a class="btn" href="{u}" rel="noopener">{E(l)}</a>' for l, u in s["links"]) or '<a class="btn" href="contact.html">Dossier sur demande</a>'
    video = ""
    if s.get("vimeo"):
        video = (f'<section class="s-video"><div class="vf frame"><iframe src="https://player.vimeo.com/video/{s["vimeo"]}?title=0&byline=0&portrait=0" '
                 f'title="{E(s["title"])} – vidéo" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen loading="lazy"></iframe></div></section>')
    gal = ""
    photos = [g for g in s["gallery"] if g not in (s["hero"],)]
    if len(photos) >= 2:
        items = "".join(f'<button type="button" class="frame" data-full="{img(g, 1800)}">{pic(g, s["title"] + " – photo " + str(i + 1), 700)}</button>' for i, g in enumerate(photos))
        gal = f'<section aria-label="Photos"><div class="gal">{items}</div></section>'
    dates = ""
    if s["dates"]:
        up = [d for d in s["dates"] if d[0] >= TODAY][::-1]
        past = [d for d in s["dates"] if d[0] < TODAY]
        p = f'<details class="past"><summary>Dates passées ({len(past)})</summary><ul class="plain">{"".join(date_line(*d) for d in past)}</ul></details>' if past else ""
        dates = f'<section class="s-dates">{sec_h("Dates", 503)}{dates_list(up, "Pas de nouvelle date annoncée pour le moment.")}{p}</section>'
    seed = sum(ord(c) for c in s["slug"])
    return f"""<main>
<section class="s-hero">{pic(s['hero'], s['title'], 2000, eager=True)}<div class="wrap">
<a class="back" href="spectacles.html">← Spectacles</a><br><span class="status">{E(s['status'])}</span>
<h1>{E(s['title'])}</h1>{sub}<p class="by">{E(s['by'])}</p><p class="meta">{E(meta)}</p></div></section>
{divider(seed)}
<section class="s-body">{edge(seed + 3, "r")}<div class="txt">{body}</div></section>{quote}{video}{gal}
<section class="s-info"><div><h2>Équipe</h2><p>{E(s['credits'])}</p></div>
<div><h2>Pour accueillir ce spectacle</h2><div class="links">{links}</div><p style="margin-top:16px"><a href="mailto:{SITE['email']}">{SITE['email']}</a> · {SITE['phone']}</p></div></section>
{dates}</main>"""


def page_agenda():
    up = upcoming()
    past = [r for r in all_dates() if r[0] < TODAY]
    by_year = {}
    for r in past:
        by_year.setdefault(r[0][:4], []).append(r)
    past_html = "".join(f'<h2 class="year">{y}</h2><ul class="plain">{"".join(date_line(*r) for r in rows)}</ul>' for y, rows in by_year.items())
    return f"""<main>{title_block("Agen<i>da</i>", "Toutes les dates de tous nos spectacles. Depuis 2021, en Suisse, en France et jusqu'en Argentine.", 12)}
<section class="ag">{sec_h("À <i>venir</i>", 504)}{dates_list(up)}</section>{divider(150)}
<section class="ag">{edge(151, "l")}{sec_h("Déjà <i>joué</i>", 505)}{past_html}</section></main>"""


def page_qui():
    com = "".join(f"<li>{E(r)} : {E(n)}</li>" for r, n in COMMITTEE)
    artists = "".join(f"""<section class="artist{' r' if i % 2 else ''}"><div class="portrait frame">{pic(a['photo'], a['name'], 900)}</div>
<div><h2>{E(a['name'])}</h2><p class="role">{E(a['role'])}</p><p>{a['bio']}</p></div></section>""" for i, a in enumerate(ARTISTS))
    hist = ""
    for y, t, sub, l in HISTORY:
        more = (" · " + E(sub)) if sub else ""
        link = f' <a href="{href(l)}">voir →</a>' if l else ""
        hist += f'<li><span class="y">{y}</span><span>{t}{more}{link}</span></li>'
    return f"""<main>{title_block("Qui sommes-<i>nous</i>", "Nous sommes nulle part et partout à la fois, autant dans la bêtise que dans la poésie. Autant dans un vaisseau spatial que sur terre, à porter le monde en équilibre sur un bras. Nous sommes le problème et la solution à la fois ! Nous sommes… nous sommes…", 13)}
<section class="cie"><div class="txt"><p>La Cie Origami est une compagnie de cirque contemporain née en 2018, animée par une envie de liberté artistique et de partager ses créations avec le plus grand nombre. Depuis ses débuts, la compagnie intervient autant en salle, sous chapiteau qu'en rue…</p>
<p><strong>Vous faites des origamis ?</strong> Non, on crée des spectacles. C'est presque pareil, hein ! Parce que, comme l'art du pliage de papier, la création d'un spectacle transforme des idées simples en formes surprenantes. Chaque spectacle est pour nous un pliage, une construction minutieuse qui prend vie sur scène.</p>
<p>Implantée en Suisse, la Cie Origami est structurée en association pour offrir un cadre administratif à ses projets artistiques.</p></div>
<aside><h2>Comité de l'association</h2><ul>{com}</ul></aside></section>
{divider(160)}
<div class="artists">{edge(161, "l")}{artists}</div>
{divider(162)}
<section class="wrap hist-w">{sec_h("His<i>torique</i>", 506)}<ol class="hist">{hist}</ol></section></main>"""


def page_collabs():
    groups = ""
    for title, items in COLLABS:
        li = "".join(f"""<li><h3>{('<a href="' + u + '" rel="noopener">' + E(n) + '</a>') if u else E(n)}</h3><p>{E(t)}</p></li>""" for n, u, t in items)
        groups += f'<div class="cgroup"><h2>{E(title)}</h2><ul class="clist">{li}</ul></div>'
    crew = "".join(f"<li><strong>{E(s['title'])}</strong><span>{E(s['credits'])}</span></li>" for s in SHOWS)
    sup = "".join(f'<li><a href="{u}" rel="noopener">{E(n)}</a></li>' for n, u in SUPPORTERS)
    return f"""<main>{title_block("Merci <i>à vous</i>", "Merci à toutes les personnes et organisations qui rendent nos projets possibles, aux amis qui partagent nos aventures, et aux petites mains qui déplacent du matériel, montent les décors et rendent nos projets vivants.", 14)}
<section class="col">{groups}</section>
<section class="sup"><div>{sec_h("Nous ont <i>soutenus</i>", 507)}<ul>{sup}</ul></div></section>
{divider(170)}
<section class="col">{edge(171, "r")}{sec_h("Les artistes <i>des créations</i>", 508)}<ul class="crew">{crew}</ul></section></main>"""


def page_contact():
    addr = "<br>".join(E(a) for a in SITE["address"])
    opts = "".join(f"<option>{E(s['title'])}</option>" for s in SHOWS if s["status"] != "Répertoire")
    return f"""<main>{title_block("Nous <i>écrire</i>", "Pour accueillir un spectacle, demander un dossier ou simplement dire bonjour.", 15)}
<section class="contact"><div>
<h2>E-mail</h2><p><a class="sel" href="mailto:{SITE['email']}">{SITE['email']}</a> <button class="copy" type="button" data-copy="{SITE['email']}">Copier</button></p>
<h2>Téléphone</h2><p>{SITE['phone_name']} : <a href="tel:{SITE['phone'].replace(' ', '')}">{SITE['phone']}</a></p>
<h2>Adresse</h2><p>{addr}</p>
<h2>Nous suivre</h2><p><a href="{SITE['instagram']}" rel="noopener">Instagram</a> · <a href="{SITE['facebook']}" rel="noopener">Facebook</a></p></div>
<form class="form" name="contact" method="POST" data-netlify="true" netlify-honeypot="bot-field">
<input type="hidden" name="form-name" value="contact"><p hidden><label>Ne pas remplir <input name="bot-field"></label></p>
<div><label for="c-name">Nom</label><input id="c-name" name="nom" required autocomplete="name"></div>
<div><label for="c-email">E-mail</label><input id="c-email" type="email" name="email" required autocomplete="email"></div>
<div><label for="c-show">Spectacle concerné (facultatif)</label><select id="c-show" name="spectacle"><option value="">—</option>{opts}<option>Autre</option></select></div>
<div><label for="c-msg">Message</label><textarea id="c-msg" name="message" rows="6" required></textarea></div>
<div><button class="btn" type="submit">Envoyer</button></div></form></section>
{divider(180)}
{newsletter()}</main>"""


BACK_HOME = '<p class="back-home"><a class="btn" href="index.html">Retour à l&#39;accueil</a></p>'


def page_404():
    return f"""<main>{title_block("Ou<i>ps</i> !", "Cette page s'est dépliée ailleurs. Elle a peut-être changé d'adresse avec le nouveau site.", 16, BACK_HOME)}</main>"""


SCRIPT = """<div class="lightbox" hidden><button class="lb-close" type="button">Fermer</button><button class="lb-prev" type="button" aria-label="Photo précédente">←</button><img alt=""><button class="lb-next" type="button" aria-label="Photo suivante">→</button></div>
<script>
(function(){
 var reduce=matchMedia("(prefers-reduced-motion: reduce)").matches,root=document.documentElement;

 /* ouverture : la machine se met en marche, une fois par visite */
 var loader=document.querySelector(".loader");
 if(!root.classList.contains("seen")){setTimeout(function(){loader.classList.add("done");try{sessionStorage.setItem("origami-vu","1")}catch(e){}},reduce?150:1700);}

 /* menu : un engrenage tourne et ouvre la feuille */
 var menu=document.getElementById("menu"),btn=document.querySelector(".open-menu"),closeB=menu.querySelector(".close");
 function openMenu(){menu.classList.remove("closing");menu.classList.add("open");document.body.classList.add("menu-on");btn.setAttribute("aria-expanded","true");closeB.focus();}
 function closeMenu(){if(!menu.classList.contains("open"))return;menu.classList.remove("open");btn.setAttribute("aria-expanded","false");document.body.classList.remove("menu-on");
  if(reduce){btn.focus();return;}menu.classList.add("closing");setTimeout(function(){menu.classList.remove("closing")},450);btn.focus();}
 btn.addEventListener("click",openMenu);closeB.addEventListener("click",closeMenu);
 menu.addEventListener("keydown",function(e){if(e.key!=="Tab")return;var f=menu.querySelectorAll("a,button"),a=f[0],z=f[f.length-1];
  if(e.shiftKey&&document.activeElement===a){e.preventDefault();z.focus()}else if(!e.shiftKey&&document.activeElement===z){e.preventDefault();a.focus()}});

 /* dates passées : masquées même si le site n'a pas été reconstruit */
 var d=new Date(),today=d.getFullYear()+"-"+("0"+(d.getMonth()+1)).slice(-2)+"-"+("0"+d.getDate()).slice(-2);
 document.querySelectorAll("ul.dates").forEach(function(ul){var n=0;ul.querySelectorAll(".d[data-iso]").forEach(function(li){if(li.dataset.iso<today)li.remove();else n++});
  var em=ul.nextElementSibling;if(em&&em.classList.contains("empty"))em.hidden=n>0;});

 /* engrenages : la rotation suit le défilement (un seul requestAnimationFrame, transforms seulement) */
 function arr(l){return [].slice.call(l)}
 var mechs=arr(document.querySelectorAll(".mech")).filter(function(el){return !el.closest(".menu,.loader")}).map(function(el){
  return {el:el,on:false,
   g:arr(el.querySelectorAll("[data-w]")).map(function(n){return [n,+n.dataset.w]}),
   r:arr(el.querySelectorAll("[data-v]")).map(function(n){return [n,+n.dataset.v,+n.dataset.p]}),
   b:arr(el.querySelectorAll(".bl")).map(function(n){var q=n.dataset,c=n.children;return {rod:c[0],pis:c[1],spr:c[2],cx:+q.cx,cy:+q.cy,R:+q.r,L:+q.l,ph:+q.ph,w:+q.cw,xw:+q.xw,B:+q.b}})};});
 function put(m,s){
  m.g.forEach(function(x){x[0].style.transform="rotate("+(x[1]*s).toFixed(2)+"deg)"});
  m.r.forEach(function(x){x[0].style.transform="translateX("+(-((x[1]*s)%x[2])).toFixed(2)+"px)"});
  m.b.forEach(function(b){var a=(b.ph+b.w*s)*Math.PI/180,px=b.cx+b.R*Math.cos(a),py=b.cy+b.R*Math.sin(a),dy=b.cy-py,xs=px+Math.sqrt(b.L*b.L-dy*dy),th=Math.atan2(dy,xs-px)*180/Math.PI;
   b.rod.style.transform="translate("+(px-12).toFixed(1)+"px,"+(py-12).toFixed(1)+"px) rotate("+th.toFixed(2)+"deg)";
   b.pis.style.transform="translate("+(xs-12).toFixed(1)+"px,"+(b.cy-18).toFixed(1)+"px)";
   b.spr.style.transform="translate("+(xs+46).toFixed(1)+"px,"+(b.cy-12).toFixed(1)+"px) scaleX("+((b.xw-xs-46)/b.B).toFixed(3)+")";});
 }
 if(reduce||!("IntersectionObserver" in window)){mechs.forEach(function(m){m.el.classList.add("drawn")});}
 else{
  var cur=scrollY,raf=0;
  function tick(){var t=scrollY,dd=t-cur;cur=Math.abs(dd)<.3?t:cur+dd*.2;
   for(var i=0;i<mechs.length;i++)if(mechs[i].on)put(mechs[i],cur);
   raf=cur!==t?requestAnimationFrame(tick):0;}
  var io=new IntersectionObserver(function(es){es.forEach(function(e){var m=e.target._m;m.on=e.isIntersecting;if(m.on){put(m,cur);m.el.classList.add("drawn")}})},{rootMargin:"150px 0px"});
  mechs.forEach(function(m){m.el._m=m;put(m,cur);io.observe(m.el)});
  addEventListener("scroll",function(){if(!raf)raf=requestAnimationFrame(tick)},{passive:true});
 }

 /* visionneuse photo */
 var lb=document.querySelector(".lightbox"),li=lb.querySelector("img"),set=[],cur2=0;
 function show(i){cur2=(i+set.length)%set.length;li.src=set[cur2].dataset.full;li.alt=set[cur2].querySelector("img").alt;}
 document.addEventListener("click",function(e){
  var g=e.target.closest(".gal button");if(g){set=[].slice.call(g.parentElement.children);show(set.indexOf(g));lb.hidden=false;lb.querySelector(".lb-close").focus();return;}
  if(e.target===lb||e.target.closest(".lb-close")){lb.hidden=true;li.src="";if(set[cur2])set[cur2].focus();}
  if(e.target.closest(".lb-prev"))show(cur2-1);if(e.target.closest(".lb-next"))show(cur2+1);
  var c=e.target.closest(".copy");if(c&&navigator.clipboard){navigator.clipboard.writeText(c.dataset.copy).then(function(){c.textContent="Copié !";setTimeout(function(){c.textContent="Copier"},1800)},function(){})}
 });
 document.addEventListener("keydown",function(e){
  if(e.key==="Escape"){if(!lb.hidden){lb.hidden=true;li.src="";}else closeMenu();}
  if(!lb.hidden&&e.key==="ArrowLeft")show(cur2-1);if(!lb.hidden&&e.key==="ArrowRight")show(cur2+1);
 });
})();
</script>"""


def pages():
    ps = [("index", SITE["name"], SITE["description"], page_index, None),
          ("spectacles", "Spectacles", "Tous les spectacles de la Cie Origami : cirque-théâtre, cabaret de rue, solos et créations.", page_spectacles, None),
          ("agenda", "Agenda", "Toutes les dates des spectacles de la Cie Origami.", page_agenda, None),
          ("quisommesnous", "Qui sommes-nous", "Qui est la Cie Origami ? Compagnie de cirque contemporain née à Genève en 2018.", page_qui, None),
          ("collabs", "Collaborations", "Les collaborations et soutiens de la Cie Origami.", page_collabs, None),
          ("contact", "Contact", "Contacter la Cie Origami.", page_contact, None)]
    for s in SHOWS:
        ps.append((s["slug"], s["title"], f"{s['title']} – {s['genre']}. {s['teaser']}", (lambda s=s: page_show(s)), s["hero"]))
    return ps


def active_for(slug):
    return "spectacles" if slug in SHOW_BY_SLUG else slug


FAVICON = ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><rect width="40" height="40" rx="6" fill="#281467"/>'
           '<g fill="none" stroke="#9781FF" stroke-width="2.2" stroke-linejoin="round">'
           '<path d="M20 5l2.6 4.2 4.8-1.2.4 4.9 4.6 1.8-2.2 4.4 3 3.9-4.4 2.2.3 4.9-4.9-.3-2.2 4.4-3.9-3-4.4 2.2-1.8-4.6-4.9-.4 1.2-4.8L5 20l4.2-2.6-1.2-4.8 4.9-.4 1.8-4.6 4.4 2.2z" transform="rotate(-8 20 20)"/>'
           '<circle cx="20" cy="20" r="4.5"/></g></svg>')


def build():
    _N[0] = 0
    if os.path.exists(DIST):
        shutil.rmtree(DIST)
    os.makedirs(DIST)
    shutil.copy(os.path.join(HERE, "style.css"), DIST)
    shutil.copy(os.path.join(ROOT, "logo.svg"), DIST)
    with open(os.path.join(DIST, "favicon.svg"), "w") as f:
        f.write(FAVICON)
    for slug, title, desc, fn, og in pages():
        path = "" if slug == "index" else slug
        with open(os.path.join(DIST, f"{slug}.html"), "w", encoding="utf-8") as f:
            f.write(head(title, desc, path, og) + header(active_for(slug)) + fn() + footer() + SCRIPT + "</body></html>")
    with open(os.path.join(DIST, "404.html"), "w", encoding="utf-8") as f:
        f.write(head("Page introuvable", "", "404") + header("") + page_404() + footer() + SCRIPT + "</body></html>")
    with open(os.path.join(DIST, "_redirects"), "w") as f:
        f.write("\n".join(f"{a}  {b}  301" for a, b in REDIRECTS.items()) + "\n")
    urls = "".join(f"<url><loc>{SITE['url']}/{'' if s == 'index' else s}</loc></url>" for s, *_ in pages())
    with open(os.path.join(DIST, "sitemap.xml"), "w") as f:
        f.write(f'<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">{urls}</urlset>')
    with open(os.path.join(DIST, "robots.txt"), "w") as f:
        f.write(f"User-agent: *\nAllow: /\nSitemap: {SITE['url']}/sitemap.xml\n")
    print("site:", len(os.listdir(DIST)), "fichiers")


if __name__ == "__main__":
    build()
