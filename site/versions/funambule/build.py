# -*- coding: utf-8 -*-
"""Génère le site statique de la Cie Origami (direction « Funambule », octobre 2026).

    python3 build.py   -> dossier dist/ (le site à mettre en ligne)

La piste dans le noir : un rond de lumière de poursuite suit la souris (ou le doigt,
ou le défilement au téléphone), un fil de funambule traverse les pages et les titres
y tiennent en équilibre. Petites étoiles peintes, dessinées en SVG.

Les textes et données sont dans content.py, le design dans style.css.
Photos, vidéos et PDF : servis depuis le site (voir medias.py à la racine de site/).
"""
import html, math, os, random, re, shutil, sys, datetime

TODAY = datetime.date.today().isoformat()
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))  # dossier site/ : content.py et logo.svg communs
sys.path.insert(0, ROOT)
from content import SITE, SHOWS, ARTISTS, HISTORY, COMMITTEE, COLLABS, SUPPORTERS, REDIRECTS
from medias import photo, video
DIST = os.path.join(HERE, "dist")
E = html.escape
FONTS = "https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,400;1,9..144,300;1,9..144,400&family=Karla:ital,wght@0,300;0,400;0,500;1,300&family=IBM+Plex+Mono:wght@400&display=swap"

_LOGO = open(os.path.join(ROOT, "logo.svg")).read()
LOGO_SVG = re.sub(r'fill="#[0-9A-Fa-f]+"', 'fill="currentColor" role="img" aria-label="Compagnie Origami"', _LOGO, count=1)

CREAM, LAV = "#f3e6c4", "#9781ff"


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
THREADS = [12, 26, 16, 30, 20]  # longueur des fils sous le câble de l'en-tête (px)


# ---------------------------------------------------------------- étoiles peintes (SVG à la main, pas de bitmap)

def star_d(seed, r=10.0, n=5):
    """Étoile irrégulière, bords un peu mous comme un coup de pinceau."""
    R = random.Random(seed)
    rot = R.uniform(0, math.tau)
    pts = []
    for k in range(n * 2):
        a = rot + k * math.pi / n + R.uniform(-.14, .14)
        rr = r * (R.uniform(.82, 1.18) if k % 2 == 0 else R.uniform(.32, .5))
        pts.append((rr * math.cos(a), rr * math.sin(a)))
    d = f"M{pts[0][0]:.1f} {pts[0][1]:.1f}"
    for i in range(1, len(pts) + 1):
        p0, p1 = pts[i - 1], pts[i % len(pts)]
        mx = (p0[0] + p1[0]) / 2 + R.uniform(-.9, .9) * r / 10
        my = (p0[1] + p1[1]) / 2 + R.uniform(-.9, .9) * r / 10
        d += f"Q{mx:.1f} {my:.1f} {p1[0]:.1f} {p1[1]:.1f}"
    return d + "Z"


def stars(seed, k=4, zone=(55, 98, 4, 90)):
    """Quelques étoiles éparses posées dans un bloc (position absolue)."""
    R = random.Random(seed)
    out = ""
    for i in range(k):
        x, y = min(R.uniform(zone[0], zone[1]), 91), R.uniform(zone[2], zone[3])
        size = R.choice([10, 13, 16, 20, 26])
        col = CREAM if R.random() < .55 else LAV
        n = 5 if R.random() < .7 else 4
        out += (f'<svg class="st" viewBox="-12 -12 24 24" style="left:{x:.0f}%;top:{y:.0f}%;width:{size}px;--d:{R.uniform(3, 7):.1f}s;--o:{R.uniform(.55, .95):.2f}" aria-hidden="true" focusable="false">'
                f'<path d="{star_d(seed * 31 + i, 10, n)}" fill="{col}" stroke="{col}" stroke-width=".8" stroke-linejoin="round"/></svg>')
    return out


def sky_svg():
    """Motif de fond : ciel peint, répété (fichier ciel.svg)."""
    R = random.Random(7)
    items = ""
    for i in range(15):
        x, y = R.uniform(10, 690), R.uniform(10, 690)
        r = R.choice([1.6, 2.2, 3, 3.8, 5.5]) if i % 4 else R.uniform(6, 8)
        col = CREAM if R.random() < .6 else LAV
        op = R.uniform(.25, .6)
        if r < 2.5:
            items += f'<circle cx="{x:.0f}" cy="{y:.0f}" r="{r * .55:.1f}" fill="{col}" opacity="{op:.2f}"/>'
        else:
            items += f'<path transform="translate({x:.0f} {y:.0f})" d="{star_d(100 + i, r, 5 if i % 3 else 4)}" fill="{col}" opacity="{op:.2f}"/>'
    return f'<svg xmlns="http://www.w3.org/2000/svg" width="700" height="700" viewBox="0 0 700 700">{items}</svg>'


# ---------------------------------------------------------------- le petit funambule (traits à la main)

FIG = (f'<g fill="none" stroke="{CREAM}" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round">'
       f'<path d="M-58 -42Q0 -27 58 -42" stroke="{LAV}" stroke-width="2.6"/>'
       f'<circle cx="-58" cy="-42" r="3" fill="{LAV}" stroke="none"/><circle cx="58" cy="-42" r="3" fill="{LAV}" stroke="none"/>'
       f'<path d="M-9 -79Q1 -94 11 -78Z" fill="{LAV}" stroke="{LAV}" stroke-width="1.5"/>'
       f'<circle cx="1" cy="-69" r="8.5" fill="{CREAM}" stroke="none"/>'
       f'<path d="M1 -60Q3 -45 0 -28"/><path d="M1 -52Q-10 -47 -21 -38M1 -52Q12 -47 22 -39"/>'
       f'<path d="M-10 -34Q0 -26 10 -34L1 -20Z" fill="{LAV}" stroke="{LAV}" stroke-width="1.4"/>'
       f'<path d="M0 -26Q-4 -13 -8 0M0 -26Q5 -14 7 0"/></g>')

# Ouverture : (position x du funambule, flèche du fil sous son pied, inclinaison)
WALK = [(110, 6, -2), (220, 24, 9), (320, 32, -7), (352, 30, 12), (470, 36, -6), (610, 34, 8), (730, 28, -4), (890, 12, 0)]


def opening():
    kt = ";".join(f"{i / (len(WALK) - 1):.3f}" for i in range(len(WALK)))
    wire = ";".join(f"M-400 330Q{(x - 400) / 2:.0f} {330 + s} {x} {330 + s}Q{(x + 1400) / 2:.0f} {330 + s} 1400 330" for x, s, _ in WALK)
    pos = ";".join(f"{x} {330 + s}" for x, s, _ in WALK)
    rot = ";".join(f"{a}" for _, _, a in WALK)
    first_d = wire.split(";")[0]
    x0, s0, _ = WALK[0]
    anim = 'begin="0.3s" dur="1.3s" fill="freeze" calcMode="spline" keySplines="' + ";".join([".4 0 .6 1"] * (len(WALK) - 1)) + f'" keyTimes="{kt}"'
    return f"""<div class="loader" aria-hidden="true"><svg viewBox="0 0 1000 600" preserveAspectRatio="xMidYMid meet">
<defs><radialGradient id="spotg"><stop offset="0" stop-color="#fff4d6" stop-opacity=".30"/><stop offset=".5" stop-color="{LAV}" stop-opacity=".12"/><stop offset="1" stop-color="{LAV}" stop-opacity="0"/></radialGradient></defs>
<g opacity="0"><animate attributeName="opacity" from="0" to="1" begin="0s" dur=".35s" fill="freeze"/>
<g transform="translate({x0} {330 + s0})"><animateTransform attributeName="transform" type="translate" values="{pos}" {anim}/>
<g class="fs"><circle cx="0" cy="-40" r="230" fill="url(#spotg)"/></g></g>
<image class="li" href="logo.svg" x="300" y="150" width="400" height="72" opacity="0"><animate attributeName="opacity" from="0" to="1" begin=".9s" dur=".6s" fill="freeze"/></image>
<path d="{first_d}" fill="none" stroke="{CREAM}" stroke-width="2" stroke-linecap="round" pathLength="1" stroke-dasharray="1" stroke-dashoffset="1">
<animate attributeName="stroke-dashoffset" from="1" to="0" begin="0s" dur=".45s" fill="freeze"/><animate attributeName="d" values="{wire}" {anim}/></path>
<g class="lfig" transform="translate({x0} {330 + s0})"><animateTransform attributeName="transform" type="translate" values="{pos}" {anim}/>
<g class="fs"><g><animateTransform attributeName="transform" type="rotate" values="{rot}" {anim}/>{FIG}</g></g></g></g></svg></div>"""


# ---------------------------------------------------------------- briques

def wob(tag, inner, f=1, cls="", attrs=""):
    """Élément qui penche en équilibre selon la vitesse de défilement."""
    c = f' class="wob {cls}"' if cls else ' class="wob"'
    return f'<{tag}{c} style="--f:{f}"{attrs}>{inner}</{tag}>'


def fil(tag, inner, cls="", sign=1):
    """Titre posé sur un fil tendu qui traverse la page : le fil ploie, le titre se rattrape."""
    c = f"fil {cls}".strip()
    return (f'<div class="{c}" data-s="{sign}"><svg class="wire" aria-hidden="true" focusable="false"><path/></svg>'
            f'<{tag} class="eq"><span>{inner}</span></{tag}></div>')


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
<meta name="theme-color" content="#06050b">
<link rel="icon" href="favicon.svg" type="image/svg+xml">
<script>try{{if(sessionStorage.getItem("origami-vu"))document.documentElement.classList.add("seen")}}catch(e){{}}</script>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="{FONTS}"><link rel="stylesheet" href="style.css"></head><body>"""


def header(active):
    cur = ' aria-current="page"'
    hang = "".join(
        f'<a class="pend" href="{href(k)}" data-s="{1 if i % 2 else -1}"{cur if k == active else ""}><span class="sw" style="--l:{THREADS[i]}px">{v}</span></a>'
        for i, (k, v) in enumerate(MENU))
    big = "".join(
        f'<a class="pend" href="{href(k)}" style="--i:{i}"{cur if k == active else ""}><span class="sw">{v}</span></a>'
        for i, (k, v) in enumerate(MENU))
    shows = "".join(f'<li><a href="{href(s["slug"])}">{E(s["title"])}</a></li>' for s in SHOWS if s["status"] != "Répertoire")
    return f"""{opening()}<div class="nuit" aria-hidden="true"></div>
<a class="sr" href="#contenu">Aller au contenu</a>
<header class="top"><svg class="wire" aria-hidden="true" focusable="false"><path/></svg>
<a class="logo" href="index.html">{LOGO_SVG}</a>
<nav class="hang" aria-label="Rubriques">{hang}</nav>
<button class="open-menu pend" type="button" aria-expanded="false" aria-controls="menu" data-s="1"><span class="sw" style="--l:14px"><b>Menu</b></span></button></header>
<div class="menu" id="menu" role="dialog" aria-modal="true" aria-label="Menu"><svg class="mwire" aria-hidden="true" focusable="false"><path/></svg>{stars(91, 6, (4, 96, 6, 92))}
<button class="close" type="button">Fermer</button>
<div class="menu-in"><nav class="main-links" aria-label="Rubriques">{big}</nav>
<div class="side"><div><h2>Les spectacles</h2><ul>{shows}</ul></div>
<div><h2>Nous écrire</h2><ul><li><a href="mailto:{SITE['email']}">{SITE['email']}</a></li><li><a href="{SITE['instagram']}" rel="noopener">Instagram</a> · <a href="{SITE['facebook']}" rel="noopener">Facebook</a></li></ul></div></div>
</div></div><div id="contenu"></div>"""


def footer():
    nav = "".join(f'<a href="{href(k)}">{v}</a>' for k, v in MENU)
    return f"""<footer class="foot">{stars(77, 4, (5, 95, 10, 70))}<svg class="fwire" viewBox="0 0 1000 120" preserveAspectRatio="none" aria-hidden="true" focusable="false"><path d="M-10 40Q520 96 1010 30" fill="none" stroke="{CREAM}" stroke-width="1.6" vector-effect="non-scaling-stroke"/></svg>
<svg class="ffig" viewBox="-62 -96 124 100" aria-hidden="true" focusable="false"><g transform="rotate(-6)">{FIG}</g></svg>
<div class="in"><nav aria-label="Pied de page">{nav}</nav>
<div><a href="{SITE['instagram']}" rel="noopener">Instagram</a> · <a href="{SITE['facebook']}" rel="noopener">Facebook</a><br><small>© {datetime.date.today().year} Compagnie Origami · Genève</small></div></div></footer>"""


# ---------------------------------------------------------------- blocs

def show_block(s, i, tag_text=None, h="h2"):
    r = " r" if i % 2 else ""
    meta = tag_text or " · ".join(x for x in (s["genre"], s["venue"], s["duration"]) if x)
    return f"""<a class="show{r}" href="{href(s['slug'])}"><div class="pic">{pic(s['card'], s['title'], 1100)}</div>
<div class="txt">{wob(h, E(s['title']), 1.3)}<span class="meta mono">{E(meta)}</span><p class="teaser">{E(s['teaser'])}</p><span class="go">Découvrir <span aria-hidden="true">→</span></span></div></a>"""


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
    return f"""<section class="nl" aria-labelledby="nl-t">{stars(5, 4, (6, 94, 5, 60))}<div class="big shake" id="nl-t">Newsletter</div>
<p>De temps en temps, des nouvelles de nos créations et nos prochaines dates. Pas tous les deux jours, promis.</p>
<form name="newsletter" method="POST" data-netlify="true" netlify-honeypot="bot-field">
<input type="hidden" name="form-name" value="newsletter"><p hidden><label>Ne pas remplir <input name="bot-field"></label></p>
<label class="sr" for="nl-mail">Ton adresse e-mail</label><input id="nl-mail" type="email" name="email" placeholder="ton adresse e-mail" required autocomplete="email">
<button class="btn" type="submit">S'abonner</button></form></section>"""


def ph_title(h, intro, seed):
    return f'<section class="ph-title">{stars(seed, 3, (62, 97, 0, 50))}{fil("h1", h, "", -1 if seed % 2 else 1)}<p class="intro">{intro}</p></section>'


# ---------------------------------------------------------------- pages

def page_index():
    shows = "".join(show_block(SHOW_BY_SLUG[sl], i, HOME_TAG.get(sl)) for i, sl in enumerate(HOME_ORDER))
    nxt = upcoming()[:4]
    return f"""<main>
<section class="hero">{stars(3, 5, (58, 97, 0, 80))}{fil("h1", "Bienvenue dans l'univers<br>de la cie <i>Origami</i>", "", 1)}
<div class="intro"><p>Depuis 2018, la Cie Origami tisse des spectacles aux formes multiples, nés d'une passion commune : celle de créer, de raconter, de surprendre.</p>
<p>Chaque projet réunit des artistes de cirque aux univers singuliers, pour donner vie à des œuvres tantôt drôles, tantôt poétiques, toujours sensibles. La compagnie s'adresse à tous les publics (petits, grands ou avertis) avec le désir d'offrir des instants forts et partagés.</p></div></section>
<section class="shows" aria-label="Spectacles">{shows}</section>
<section class="next">{fil("h2", "Prochaines <i>dates</i>", "sec-h", -1)}{dates_list(nxt)}
<p class="all"><a class="go" href="agenda.html">Tout l'agenda <span aria-hidden="true">→</span></a></p></section>
<section class="cie-band"><div><blockquote>Nous sommes nulle part et partout à la fois, autant dans la bêtise que dans la poésie. Nous sommes le problème et la solution à la fois !</blockquote>
<a class="go" href="quisommesnous.html">Qui sommes-nous <span aria-hidden="true">→</span></a></div></section>
{newsletter()}</main>"""


def page_spectacles():
    current = [s for s in SHOWS if s["status"] != "Répertoire"]
    archive = [s for s in SHOWS if s["status"] == "Répertoire"]
    blocks = "".join(show_block(s, i, f"{s['status']} · {s['genre']}") for i, s in enumerate(current))
    rep = "".join(f"""<a href="{href(s['slug'])}"><div class="pic">{pic(s['card'], s['title'], 800)}</div><h3>{E(s['title'])}</h3><p>{E(s['teaser'])}</p></a>""" for s in archive)
    return f"""<main>{ph_title("Spec<i>tacles</i>", "Cirque-théâtre, cabaret de rue, solos intimistes et créations en cours. En rue et en salle, pour tous les publics.", 11)}
<section class="shows">{blocks}</section>
<section class="wrap" style="margin-top:80px">{fil("h2", "Le <i>répertoire</i>", "sec-h", 1)}</section><div class="rep">{rep}</div></main>"""


def page_show(s):
    body = "".join(f"<p>{p}</p>" for p in s["body"])
    meta = " · ".join(x for x in (s["genre"], s["duration"], s["public"], s["venue"]) if x)
    sub = f'<p class="sub">{E(s["subtitle"])}</p>' if s.get("subtitle") else ""
    quote = f'<blockquote class="quote">{E(s["quote"])}</blockquote>' if s["quote"] else ""
    links = "".join(f'<a class="btn" href="{u}" rel="noopener">{E(l)}</a>' for l, u in s["links"]) or '<a class="btn" href="contact.html">Dossier sur demande</a>'
    video = ""
    if s.get("vimeo"):
        video = (f'<section class="s-video"><div class="vf"><iframe src="https://player.vimeo.com/video/{s["vimeo"]}?title=0&byline=0&portrait=0" '
                 f'title="{E(s["title"])} – vidéo" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen loading="lazy"></iframe></div></section>')
    gal = ""
    photos = [g for g in s["gallery"] if g not in (s["hero"],)]
    if len(photos) >= 2:
        items = "".join(f'<button type="button" data-full="{img(g, 1800)}">{pic(g, s["title"] + " – photo " + str(i + 1), 700)}</button>' for i, g in enumerate(photos))
        gal = f'<section aria-label="Photos"><div class="gal">{items}</div></section>'
    dates = ""
    if s["dates"]:
        up = [d for d in s["dates"] if d[0] >= TODAY][::-1]
        past = [d for d in s["dates"] if d[0] < TODAY]
        p = f'<details class="past"><summary>Dates passées ({len(past)})</summary><ul class="plain">{"".join(date_line(*d) for d in past)}</ul></details>' if past else ""
        dates = f'<section class="s-dates">{fil("h2", "Dates", "sec-h", -1)}{dates_list(up, "Pas de nouvelle date annoncée pour le moment.")}{p}</section>'
    return f"""<main>
<section class="s-hero"><div class="hp">{pic(s['hero'], s['title'], 2000, eager=True)}</div><div class="wrap">
<a class="back" href="spectacles.html">← Spectacles</a><br><span class="status">{E(s['status'])}</span>
{fil("h1", E(s['title']), "", 1)}{sub}<p class="by">{E(s['by'])}</p><p class="meta mono">{E(meta)}</p></div></section>
<section class="s-body">{stars(len(s['slug']), 3, (82, 98, 0, 90))}<div class="txt">{body}</div></section>{quote}{video}{gal}
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
    return f"""<main>{ph_title("Agen<i>da</i>", "Toutes les dates de tous nos spectacles. Depuis 2021, en Suisse, en France et jusqu'en Argentine.", 12)}
<section class="ag">{fil("h2", "À <i>venir</i>", "sec-h", 1)}{dates_list(up)}</section>
<section class="ag">{fil("h2", "Déjà <i>joué</i>", "sec-h", -1)}{past_html}</section></main>"""


def page_qui():
    com = "".join(f"<li>{E(r)} : {E(n)}</li>" for r, n in COMMITTEE)
    artists = "".join(f"""<section class="artist{' r' if i % 2 else ''}"><div class="portrait">{pic(a['photo'], a['name'], 900)}</div>
<div>{wob("h2", E(a['name']), 1.2)}<p class="role mono">{E(a['role'])}</p><p>{a['bio']}</p></div></section>""" for i, a in enumerate(ARTISTS))
    hist = ""
    for y, t, sub, l in HISTORY:
        more = (" · " + E(sub)) if sub else ""
        link = f' <a href="{href(l)}">voir →</a>' if l else ""
        hist += f'<li><span class="y">{y}</span><span>{t}{more}{link}</span></li>'
    return f"""<main>{ph_title("Qui sommes-<i>nous</i>", "Nous sommes nulle part et partout à la fois, autant dans la bêtise que dans la poésie. Autant dans un vaisseau spatial que sur terre, à porter le monde en équilibre sur un bras. Nous sommes le problème et la solution à la fois ! Nous sommes… nous sommes…", 13)}
<section class="cie"><div class="txt"><p>La Cie Origami est une compagnie de cirque contemporain née en 2018, animée par une envie de liberté artistique et de partager ses créations avec le plus grand nombre. Depuis ses débuts, la compagnie intervient autant en salle, sous chapiteau qu'en rue…</p>
<p><strong>Vous faites des origamis ?</strong> Non, on crée des spectacles. C'est presque pareil, hein ! Parce que, comme l'art du pliage de papier, la création d'un spectacle transforme des idées simples en formes surprenantes. Chaque spectacle est pour nous un pliage, une construction minutieuse qui prend vie sur scène.</p>
<p>Implantée en Suisse, la Cie Origami est structurée en association pour offrir un cadre administratif à ses projets artistiques.</p></div>
<aside><h2>Comité de l'association</h2><ul>{com}</ul></aside></section>
{artists}
<section class="wrap" style="padding-block:50px 30px">{fil("h2", "His<i>torique</i>", "sec-h", 1)}<ol class="hist">{hist}</ol></section></main>"""


def page_collabs():
    groups = ""
    for title, items in COLLABS:
        li = "".join(f"""<li><h3>{('<a href="' + u + '" rel="noopener">' + E(n) + '</a>') if u else E(n)}</h3><p>{E(t)}</p></li>""" for n, u, t in items)
        groups += f'<div class="cgroup"><h2>{E(title)}</h2><ul class="clist">{li}</ul></div>'
    crew = "".join(f"<li><strong>{E(s['title'])}</strong><span>{E(s['credits'])}</span></li>" for s in SHOWS)
    sup = "".join(f'<li><a href="{u}" rel="noopener">{E(n)}</a></li>' for n, u in SUPPORTERS)
    return f"""<main>{ph_title("Merci <i>à vous</i>", "Merci à toutes les personnes et organisations qui rendent nos projets possibles, aux amis qui partagent nos aventures, et aux petites mains qui déplacent du matériel, montent les décors et rendent nos projets vivants.", 14)}
<section class="col">{groups}</section>
<section class="sup"><div>{fil("h2", "Nous ont <i>soutenus</i>", "sec-h", -1)}<ul>{sup}</ul></div></section>
<section class="col">{fil("h2", "Les artistes <i>des créations</i>", "sec-h", 1)}<ul class="crew">{crew}</ul></section></main>"""


def page_contact():
    addr = "<br>".join(E(a) for a in SITE["address"])
    opts = "".join(f"<option>{E(s['title'])}</option>" for s in SHOWS if s["status"] != "Répertoire")
    return f"""<main>{ph_title("Nous <i>écrire</i>", "Pour accueillir un spectacle, demander un dossier ou simplement dire bonjour.", 15)}
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
{newsletter()}</main>"""


def page_404():
    return f"""<main>{ph_title("Ou<i>ps</i> !", "Cette page est tombée du fil. Elle a peut-être changé d'adresse avec le nouveau site.", 16)}
<p style="margin:0 0 60px;text-align:center"><a class="btn" href="index.html">Retour à l'accueil</a></p></main>"""


SCRIPT = """<div class="lightbox" hidden><button class="lb-close" type="button">Fermer</button><button class="lb-prev" type="button" aria-label="Photo précédente">←</button><img alt=""><button class="lb-next" type="button" aria-label="Photo suivante">→</button></div>
<script>
(function(){
 var reduce=matchMedia("(prefers-reduced-motion: reduce)").matches,root=document.documentElement;
 var fine=matchMedia("(hover:hover) and (pointer:fine)").matches;
 var W=innerWidth,H=innerHeight;
 function clamp(x,a){return Math.max(-a,Math.min(a,x))}

 /* ---- rond de lumière de poursuite */
 var spot=document.querySelector(".nuit"),sx=W/2,sy=H*.42,tx=sx,ty=sy,touching=false;
 function place(){spot.style.transform="translate3d("+sx.toFixed(1)+"px,"+sy.toFixed(1)+"px,0)"}
 place();

 /* ---- ouverture : le noir, un spot, le funambule traverse, la lumière s'ouvre */
 var loader=document.querySelector(".loader");
 if(!root.classList.contains("seen")){
  var finish=function(){try{sessionStorage.setItem("origami-vu","1")}catch(e){}};
  if(reduce){loader.remove();finish();}
  else setTimeout(function(){
   var f=loader.querySelector(".lfig").getBoundingClientRect(),cx=f.left+f.width/2,cy=f.top+f.height*.3;
   loader.style.setProperty("--cx",cx+"px");loader.style.setProperty("--cy",cy+"px");
   sx=tx=cx;sy=ty=cy;place();setTimeout(function(){tx=W/2;ty=H*.42;kick()},500);
   loader.classList.add("done");finish();setTimeout(function(){loader.remove()},900);
  },1700);
 }

 /* ---- le câble de l'en-tête et ses rubriques suspendues */
 var top=document.querySelector(".top"),hpath=top.querySelector(".wire path"),logo=top.querySelector(".logo");
 var pends=[].slice.call(top.querySelectorAll(".pend")).map(function(p){return {el:p,x:0,th:0,om:0,sg:+p.dataset.s||1}});
 var hW=0,wy=50,hs=9,lx=0,lphi=0,lom=0;
 function hy(x){var t=x/hW;return wy+(-6)*t+4*hs*t*(1-t)}
 function hslope(x){var t=x/hW;return Math.atan((-6+4*hs*(1-2*t))/hW)*57.3}

 /* ---- les titres posés sur le fil */
 var fils=[].slice.call(document.querySelectorAll(".fil")).map(function(f){return {el:f,svg:f.querySelector("svg"),p:f.querySelector("path"),h:f.querySelector(".eq"),sg:+f.dataset.s||1,phi:0,om:0,e:0}});
 function geo(){
  W=innerWidth;H=innerHeight;
  var tr=top.getBoundingClientRect();hW=tr.width;wy=parseFloat(getComputedStyle(top).getPropertyValue("--wy"))||50;
  pends.forEach(function(p){var r=p.el.getBoundingClientRect();p.x=r.left+r.width/2-tr.left;p.vis=r.width>0});
  var lr=logo.getBoundingClientRect();lx=lr.left+lr.width/2-tr.left;
  fils.forEach(function(f){var fr=f.el.getBoundingClientRect(),sr=f.svg.getBoundingClientRect(),fs=parseFloat(getComputedStyle(f.h).fontSize);
   f.W=sr.width;f.cx=f.h.offsetLeft+f.h.offsetWidth/2+(fr.left-sr.left);f.y0=f.h.offsetTop+f.h.offsetHeight-fs*.06+(fr.top-sr.top);});
  draw();
 }
 function draw(){
  hpath.setAttribute("d","M-2 "+hy(0).toFixed(1)+"Q"+(hW/2).toFixed(1)+" "+(wy-3+2*hs).toFixed(1)+" "+(hW+2).toFixed(1)+" "+hy(hW).toFixed(1));
  pends.forEach(function(p){if(!p.vis)return;p.el.style.transform="translateY("+(hy(p.x)-wy).toFixed(1)+"px) rotate("+p.th.toFixed(2)+"deg)"});
  logo.style.transform="translateY("+(hy(lx)-wy).toFixed(1)+"px) rotate("+(hslope(lx)+lphi).toFixed(2)+"deg)";
  fils.forEach(function(f){var s=8+f.e,y=f.y0+f.e,l=f.y0-8,r=f.y0-14,c=f.cx;
   f.p.setAttribute("d","M-4 "+l.toFixed(1)+"Q"+(c/2).toFixed(1)+" "+y.toFixed(1)+" "+c.toFixed(1)+" "+y.toFixed(1)+"Q"+((c+f.W)/2).toFixed(1)+" "+y.toFixed(1)+" "+(f.W+4).toFixed(1)+" "+r.toFixed(1));
   f.h.style.transform="translateY("+f.e.toFixed(1)+"px) rotate("+f.phi.toFixed(2)+"deg)";});
 }

 /* ---- lettres qui tremblent, titres qui penchent */
 var wobs=[].slice.call(document.querySelectorAll(".wob"));
 wobs.forEach(function(w,i){w.style.setProperty("--rot",((i%2?1:-1)*(.5+(i%3)*.4)).toFixed(2))});
 var letters=[];
 document.querySelectorAll(".shake").forEach(function(w){w.setAttribute("aria-label",w.textContent);w.innerHTML=w.textContent.split("").map(function(c){return '<span aria-hidden="true">'+c+'</span>'}).join("");letters=letters.concat([].slice.call(w.children));});

 /* ---- une seule boucle : vitesse de défilement -> fil qui ploie, équilibre, spot */
 var last=scrollY,v=0,vp=0,running=false,tilt=0;
 function tick(){
  var st=scrollY;
  if(reduce){v=0;last=st}else{v=v*.78+(st-last)*.22;last=st}
  var acc=v-vp;vp=v;
  if(!fine&&!touching){tx=W/2+Math.sin(st/260)*W*.26;ty=H*(.42+clamp(v*.004,.08))}
  if(reduce){sx=tx;sy=ty}else{sx+=(tx-sx)*.12;sy+=(ty-sy)*.12}
  place();
  var moving=Math.abs(tx-sx)>.4||Math.abs(ty-sy)>.4||Math.abs(v)>.05;
  hs+=(9+Math.min(16,Math.abs(v)*.45)-hs)*.2;
  pends.forEach(function(p){p.om+=acc*.3*p.sg-p.th*.045;p.om*=.92;p.th=clamp(p.th+p.om,16);if(Math.abs(p.om)>.004||Math.abs(p.th)>.02)moving=true});
  lom+=(clamp(v*.1,4)-lphi)*.07;lom*=.82;lphi+=lom;if(Math.abs(lphi)>.02)moving=true;
  fils.forEach(function(f){f.om+=(f.sg*clamp(v*.16,6)-f.phi)*.07;f.om*=.82;f.phi+=f.om;f.e+=(Math.min(22,Math.abs(v)*.5)-f.e)*.18;
   if(Math.abs(f.phi)>.02||f.e>.05)moving=true});
  draw();
  tilt+=(clamp(v*.12,5)-tilt)*.15;wobs.forEach(function(w){w.style.setProperty("--sk",tilt.toFixed(2))});
  var a=Math.min(9,Math.abs(v)*.6);
  letters.forEach(function(l,i){l.style.transform=a>.3?"translate("+(Math.sin(i*7.3+st*.05)*a).toFixed(1)+"px,"+(Math.cos(i*3.1+st*.07)*a).toFixed(1)+"px) rotate("+(Math.sin(i+st*.03)*a).toFixed(1)+"deg)":""});
  if(moving||Math.abs(tilt)>.02)requestAnimationFrame(tick);else{running=false;letters.forEach(function(l){l.style.transform=""})}
 }
 function kick(){if(!running){running=true;requestAnimationFrame(tick)}}
 addEventListener("scroll",kick,{passive:true});
 if(fine)addEventListener("pointermove",function(e){tx=e.clientX;ty=e.clientY;kick()},{passive:true});
 addEventListener("touchstart",function(e){var t=e.touches[0];touching=true;tx=t.clientX;ty=t.clientY;kick()},{passive:true});
 addEventListener("touchmove",function(e){var t=e.touches[0];tx=t.clientX;ty=t.clientY;kick()},{passive:true});
 addEventListener("touchend",function(){setTimeout(function(){touching=false;kick()},1400)},{passive:true});
 addEventListener("resize",function(){geo();kick()});
 geo();if(document.fonts&&document.fonts.ready)document.fonts.ready.then(geo);addEventListener("load",geo);

 /* ---- menu : la lumière s'allume, les rubriques pendent au fil et se balancent */
 var menu=document.getElementById("menu"),btn=document.querySelector(".open-menu"),closeB=menu.querySelector(".close");
 var mpath=menu.querySelector(".mwire path"),mlinks=[].slice.call(menu.querySelectorAll(".main-links .pend")),mnav=menu.querySelector(".main-links");
 function mgeo(){
  var mw=menu.clientWidth,y0=W<700?92:110,y1=W<700?70:76,s=W<700?16:26,nr=mnav.getBoundingClientRect(),off=nr.top+menu.scrollTop;
  function my(x){var t=x/mw;return y0+(y1-y0)*t+4*s*t*(1-t)}
  mpath.setAttribute("d","M-2 "+my(0).toFixed(1)+"Q"+(mw/2)+" "+((y0+y1)/2+2*s).toFixed(1)+" "+(mw+2)+" "+my(mw).toFixed(1));
  mlinks.forEach(function(a){var sw=a.firstElementChild,x=nr.left+a.offsetLeft+14,yt=off+a.offsetTop+sw.offsetTop+6;a.style.setProperty("--t",Math.max(8,yt-my(x)).toFixed(0)+"px")});
 }
 function openMenu(){menu.classList.remove("closing");menu.classList.add("open");document.body.classList.add("menu-on");btn.setAttribute("aria-expanded","true");mgeo();closeB.focus();}
 function closeMenu(){if(!menu.classList.contains("open"))return;menu.classList.remove("open");btn.setAttribute("aria-expanded","false");document.body.classList.remove("menu-on");
  if(reduce){btn.focus();return;}menu.classList.add("closing");setTimeout(function(){menu.classList.remove("closing")},450);btn.focus();}
 btn.addEventListener("click",openMenu);closeB.addEventListener("click",closeMenu);
 addEventListener("resize",function(){if(menu.classList.contains("open"))mgeo()});
 menu.addEventListener("keydown",function(e){if(e.key!=="Tab")return;var f=menu.querySelectorAll("a,button"),a=f[0],z=f[f.length-1];
  if(e.shiftKey&&document.activeElement===a){e.preventDefault();z.focus()}else if(!e.shiftKey&&document.activeElement===z){e.preventDefault();a.focus()}});

 /* ---- dates passées : masquées même si le site n'a pas été reconstruit */
 var d=new Date(),today=d.getFullYear()+"-"+("0"+(d.getMonth()+1)).slice(-2)+"-"+("0"+d.getDate()).slice(-2);
 document.querySelectorAll("ul.dates").forEach(function(ul){var n=0;ul.querySelectorAll(".d[data-iso]").forEach(function(li){if(li.dataset.iso<today)li.remove();else n++});
  var em=ul.nextElementSibling;if(em&&em.classList.contains("empty"))em.hidden=n>0;});

 /* ---- visionneuse photo */
 var lb=document.querySelector(".lightbox"),li=lb.querySelector("img"),set=[],cur=0;
 function show(i){cur=(i+set.length)%set.length;li.src=set[cur].dataset.full;li.alt=set[cur].querySelector("img").alt;}
 document.addEventListener("click",function(e){
  var g=e.target.closest(".gal button");if(g){set=[].slice.call(g.parentElement.children);show(set.indexOf(g));lb.hidden=false;lb.querySelector(".lb-close").focus();return;}
  if(e.target===lb||e.target.closest(".lb-close")){lb.hidden=true;li.src="";if(set[cur])set[cur].focus();}
  if(e.target.closest(".lb-prev"))show(cur-1);if(e.target.closest(".lb-next"))show(cur+1);
  var c=e.target.closest(".copy");if(c&&navigator.clipboard){navigator.clipboard.writeText(c.dataset.copy).then(function(){c.textContent="Copié !";setTimeout(function(){c.textContent="Copier"},1800)},function(){})}
 });
 document.addEventListener("keydown",function(e){
  if(e.key==="Escape"){if(!lb.hidden){lb.hidden=true;li.src="";}else closeMenu();}
  if(!lb.hidden&&e.key==="ArrowLeft")show(cur-1);if(!lb.hidden&&e.key==="ArrowRight")show(cur+1);
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


def build():
    if os.path.exists(DIST):
        shutil.rmtree(DIST)
    os.makedirs(DIST)
    shutil.copy(os.path.join(HERE, "style.css"), DIST)
    shutil.copy(os.path.join(ROOT, "logo.svg"), DIST)
    with open(os.path.join(DIST, "ciel.svg"), "w") as f:
        f.write(sky_svg())
    with open(os.path.join(DIST, "favicon.svg"), "w") as f:
        f.write('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><rect width="40" height="40" rx="8" fill="#0c0820"/>'
                '<circle cx="20" cy="17" r="13" fill="#281467"/><path d="M3 29Q20 35 37 27" fill="none" stroke="#f3e6c4" stroke-width="2" stroke-linecap="round"/>'
                f'<path transform="translate(20 17)" d="{star_d(4, 8.5)}" fill="#9781ff"/></svg>')
    for slug, title, desc, fn, og in pages():
        path = "" if slug == "index" else slug
        with open(os.path.join(DIST, f"{slug}.html"), "w") as f:
            f.write(head(title, desc, path, og) + header(active_for(slug)) + fn() + footer() + SCRIPT + "</body></html>")
    with open(os.path.join(DIST, "404.html"), "w") as f:
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
