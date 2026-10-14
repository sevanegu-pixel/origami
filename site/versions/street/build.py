# -*- coding: utf-8 -*-
"""Génère le site statique de la Cie Origami (direction « Street », octobre 2026).

    python3 build.py   -> dossier dist/ (le site à mettre en ligne)

Univers : cirque de rue et culture urbaine. Mur sombre, affiches collées
(papier crème, kraft, lavande), scotch de travers, bandes de signalisation,
stickers. Un seul langage d'animation : l'affiche qu'on colle (elle claque
contre le mur en arrivant) et qui se décolle par le coin au survol.

Les textes et données sont dans content.py (commun), le design dans style.css.
Les bords déchirés sont calculés ici (clip-path), différents pour chaque élément.
"""
import html, os, re, shutil, sys, datetime, random, zlib

IMG_MODE = "wix"
TODAY = datetime.date.today().isoformat()
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))  # dossier site/ : content.py et logo.svg communs
sys.path.insert(0, ROOT)
from content import SITE, SHOWS, ARTISTS, HISTORY, COMMITTEE, COLLABS, SUPPORTERS, REDIRECTS, PAPER
DIST = os.path.join(HERE, "dist")
E = html.escape
FONTS = ("https://fonts.googleapis.com/css2?family=Anton&family=Barlow:ital,wght@0,400;0,500;0,600;1,400"
         "&family=Permanent+Marker&family=Stardos+Stencil:wght@400;700&display=swap")

_LOGO = open(os.path.join(ROOT, "logo.svg")).read()
LOGO_SVG = re.sub(r'fill="#[0-9A-Fa-f]+"', 'fill="currentColor" role="img" aria-label="Compagnie Origami"', _LOGO, count=1)

# couleur du texte sur chaque papier de spectacle
INK = "#130e1f"
CREAM = "#efe8d8"
PAPER_FG = {"rose": INK, "jaune": INK, "orange": INK, "vert": CREAM, "bleu": CREAM, "violet": CREAM, "encre": CREAM}
MONTHS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."]


def img(mid, w=1400):
    if IMG_MODE == "local":
        return "images/" + mid.replace("~", "_")
    return f"https://static.wixstatic.com/media/{mid}/v1/fit/w_{w},h_{w},q_85,enc_auto/{mid}"


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


# ---------------------------------------------------------------- papier déchiré, travers

def _rng(key):
    return random.Random(zlib.crc32(key.encode("utf-8")))


def tilt(key, amp=2.2):
    """Un angle jamais nul, toujours le même pour le même élément."""
    r = _rng("t" + key)
    a = r.uniform(.45, amp) * (1 if r.random() > .5 else -1)
    return f"{a:.2f}deg"


def torn(key, a=6, n=14, top=True, bottom=True, sides=False, m=6):
    """clip-path d'un papier déchiré : bords irréguliers, propres à chaque élément."""
    r = _rng("c" + key)
    pts = []
    for i in range(n + 1):
        pts.append(f"{i * 100 / n:.1f}% {r.uniform(0, a) if top else 0:.1f}px")
    for i in range(1, m):
        pts.append(f"calc(100% - {r.uniform(0, a) if sides else 0:.1f}px) {i * 100 / m:.1f}%")
    for i in range(n, -1, -1):
        pts.append(f"{i * 100 / n:.1f}% calc(100% - {r.uniform(0, a) if bottom else 0:.1f}px)")
    for i in range(m - 1, 0, -1):
        pts.append(f"{r.uniform(0, a) if sides else 0:.1f}px {i * 100 / m:.1f}%")
    return "clip-path:polygon(" + ",".join(pts) + ")"


def tape_style(key):
    r = _rng("s" + key)
    return f"--tx:{r.uniform(28, 62):.0f}%;--tr:{r.uniform(-9, 9):.1f}deg"


def poster(inner, key, cls="", tag="div", bg=None, fg=None, attrs="", tape=True, a=6, sides=True):
    """Une affiche collée au mur : papier déchiré + scotch, se colle en arrivant."""
    style = f"--r:{tilt(key)};{tape_style(key)}"
    if bg:
        style += f";--bg:{bg}"
    if fg:
        style += f";--fg:{fg}"
    t = '<span class="tape" aria-hidden="true"></span>' if tape else ""
    return (f'<{tag} class="poster paste {cls}" style="{style}"{attrs}>{t}'
            f'<div class="sheet" style="{torn(key, a=a, sides=sides)}">{inner}</div></{tag}>')


def strip(text, key, cls="paper"):
    """Un mot (ou une ligne) imprimé sur une bande de papier collée."""
    return f'<span class="st {cls}" style="--r:{tilt(key, 2.6)};{torn(key, a=3, n=8, sides=True, m=4)}">{text}</span>'


def tag(text, key=""):
    return f'<span class="tag" style="--r:{tilt("g" + key + text, 5)}">{text}</span>'


def sec(word, tg, key=None, h="h2"):
    key = key or word + tg
    return f'<{h} class="sec paste" style="--r:0deg">{strip(word, key)} {tag(tg, key)}</{h}>'


def ph_title(h1_html, intro=""):
    i = f'<p class="intro">{intro}</p>' if intro else ""
    return f'<section class="ph-title"><h1 class="big">{h1_html}</h1>{i}</section>'


def hazard(key, cls=""):
    return f'<div class="hazard {cls}" aria-hidden="true" style="--r:{tilt(key, 1.6)};{torn(key, a=4, n=40, sides=False)}"></div>'


def ruban(words, key):
    txt = " ✶ ".join(words)
    inner = "".join(f"<span>{E(txt)} ✶ </span>" for _ in range(4))
    return f'<div class="ruban" aria-hidden="true" style="--r:{tilt(key, 1.4)};{torn(key, a=3, n=30)}"><div>{inner}</div></div>'


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
<meta property="og:image" content="{img(og, 1600)}"><meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#0e0a16">
<link rel="icon" href="favicon.svg" type="image/svg+xml">
<script>document.documentElement.classList.add("js");try{{if(sessionStorage.getItem("origami-vu"))document.documentElement.classList.add("seen")}}catch(e){{}}</script>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="{FONTS}"><link rel="stylesheet" href="style.css"></head><body>"""


def header(active):
    cur = ' aria-current="page"'
    nav = "".join(f'<a href="{href(k)}" style="--r:{tilt("n" + k, 3)}"{cur if k == active else ""}>{v}</a>' for k, v in MENU)
    links = "".join(
        f'<a href="{href(k)}" class="st {"lav" if k == active else "paper"}" style="--i:{i};--r:{tilt("m" + k, 3)};{torn("m" + k, a=4, n=8, sides=True, m=4)}"{cur if k == active else ""}>{v}</a>'
        for i, (k, v) in enumerate(MENU))
    shows = "".join(f'<li><a href="{href(s["slug"])}">{E(s["title"])}</a></li>' for s in SHOWS if s["status"] != "Répertoire")
    return f"""<div class="loader" aria-hidden="true"><div class="lp"><span class="brush"></span><img src="logo.svg" alt=""><span class="tape t1"></span><span class="tape t2"></span></div></div>
<a class="sr" href="#contenu">Aller au contenu</a>
<header class="top"><a class="logo" href="index.html">{LOGO_SVG}</a>
<nav class="topnav" aria-label="Rubriques">{nav}</nav>
<button class="open-menu" type="button" aria-expanded="false" aria-controls="menu"><span>Menu</span></button></header>
<div class="menu" id="menu" role="dialog" aria-modal="true" aria-label="Menu">
<button class="close" type="button">Fermer ✕</button>
<div class="menu-in"><nav class="main-links" aria-label="Rubriques">{links}</nav>
<div class="side"><div><h2>Les spectacles</h2><ul>{shows}</ul></div>
<div><h2>Nous écrire</h2><ul><li><a href="mailto:{SITE['email']}">{SITE['email']}</a></li><li><a href="{SITE['instagram']}" rel="noopener">Instagram</a> · <a href="{SITE['facebook']}" rel="noopener">Facebook</a></li></ul></div></div>
</div></div><div id="contenu"></div>"""


def footer():
    nav = "".join(f'<a href="{href(k)}" style="--r:{tilt("f" + k, 3)}">{v}</a>' for k, v in MENU)
    return f"""<footer class="foot">{hazard("foot")}<div class="in"><a class="flogo" href="index.html" aria-label="Accueil">{LOGO_SVG}</a>
<nav aria-label="Pied de page">{nav}</nav>
<p class="soc"><a href="{SITE['instagram']}" rel="noopener">Instagram</a> · <a href="{SITE['facebook']}" rel="noopener">Facebook</a> · <a href="mailto:{SITE['email']}">{SITE['email']}</a></p>
<p class="copy-r">© {datetime.date.today().year} Compagnie Origami · Genève</p></div></footer>"""


# ---------------------------------------------------------------- blocs

def show_poster(s, meta, h="h3", small=False):
    p = s.get("paper", "encre")
    bg, fg = PAPER[p], PAPER_FG.get(p, CREAM)
    teaser = "" if small else f'<p class="teaser">{E(s["teaser"])}</p>'
    inner = (f'<div class="ph">{pic(s["card"], s["title"], 700 if small else 1000)}<span class="sticker" style="--r:{tilt("k" + s["slug"], 6)}">{E(meta)}</span></div>'
             f'<div class="pt"><{h}>{E(s["title"])}</{h}>{teaser}<span class="go">Découvrir <span aria-hidden="true">→</span></span></div>')
    cls = "show small" if small else "show"
    return poster(inner, s["slug"] + meta, cls, "a", bg, fg, f' href="{href(s["slug"])}"')


def all_dates():
    rows = [(iso, label, place, s) for s in SHOWS for iso, label, place in s["dates"]]
    rows.sort(key=lambda r: r[0], reverse=True)
    return rows


def upcoming():
    return [r for r in all_dates() if r[0] >= TODAY][::-1]


FLYER = [("lav", "#9781ff", INK), ("cream", CREAM, INK), ("violet", "#281467", CREAM)]


def date_card(iso, label, place, s=None, i=0):
    """Une date = un flyer collé : gros chiffre au pochoir, le spectacle en sticker."""
    name, bg, fg = FLYER[i % 3]
    key = iso + place
    show = ""
    if s:
        p = s.get("paper", "encre")
        show = (f'<a class="f-show" href="{href(s["slug"])}" style="--sb:{PAPER[p]};--sf:{PAPER_FG.get(p, CREAM)};--r:{tilt("h" + key, 4)}">{E(s["title"])}</a>')
    day = int(iso[8:10])
    mon = MONTHS[int(iso[5:7]) - 1]
    inner = (f'{show}<time class="f-date" datetime="{iso}"><b>{day}</b><span>{mon}<br>{iso[:4]}</span></time>'
             f'<span class="f-label">{E(label)}</span><span class="f-where">{E(place)}</span>')
    # data-iso : le script retire une date passée même si le site n'a pas été reconstruit
    return poster(inner, key, f"d flyer f-{name}", "li", bg, fg, f' data-iso="{iso}"', a=5)


def date_line(iso, label, place, s=None):
    title = f'<a href="{href(s["slug"])}">{E(s["title"])}</a>' if s else ""
    return f'<li><time class="when" datetime="{iso}">{E(label)}</time><span class="pl">{E(place)}</span>{title}</li>'


def dates_list(rows, empty="De nouvelles dates arrivent bientôt."):
    items = "".join(date_card(*r, i=i) for i, r in enumerate(rows))
    return f'<ul class="dates">{items}</ul><p class="empty"{" hidden" if rows else ""}>{E(empty)}</p>'


def newsletter():
    inner = f"""<div class="nl-h" id="nl-t">Newsletter</div>
<p>De temps en temps, des nouvelles de nos créations et nos prochaines dates. Pas tous les deux jours, promis.</p>
<form name="newsletter" method="POST" data-netlify="true" netlify-honeypot="bot-field">
<input type="hidden" name="form-name" value="newsletter"><p hidden><label>Ne pas remplir <input name="bot-field"></label></p>
<label class="sr" for="nl-mail">Ton adresse e-mail</label><input id="nl-mail" type="email" name="email" placeholder="ton adresse e-mail" required autocomplete="email">
<button class="btn ink" type="submit">S'abonner</button></form>"""
    return f'<section class="nl" aria-labelledby="nl-t">{poster(inner, "newsletter", "nl-p", bg="#9781ff", fg=INK)}</section>'


# ---------------------------------------------------------------- pages

def page_index():
    shows = "".join(show_poster(SHOW_BY_SLUG[sl], HOME_TAG.get(sl, "")) for sl in HOME_ORDER)
    nxt = upcoming()[:4]
    h1 = (strip("Bienvenue dans", "h1a") + strip("l'univers de la", "h1b") +
          f'<span class="l3">{tag("cie", "h1")}{strip("Origami", "h1c", "lav")}</span>')
    intro = """<p>Depuis 2018, la Cie Origami tisse des spectacles aux formes multiples, nés d'une passion commune : celle de créer, de raconter, de surprendre.</p>
<p>Chaque projet réunit des artistes de cirque aux univers singuliers, pour donner vie à des œuvres tantôt drôles, tantôt poétiques, toujours sensibles. La compagnie s'adresse à tous les publics (petits, grands ou avertis) avec le désir d'offrir des instants forts et partagés.</p>"""
    photo = poster(pic(SITE["og_image"], "Compagnie Origami en spectacle", 1400, eager=True) +
                   '<span class="sticker round" style="--r:-10deg">depuis<b>2018</b></span>', "hero-photo", "hero-ph", bg=CREAM, a=8)
    quote = poster("""<blockquote>Nous sommes nulle part et partout à la fois, autant dans la bêtise que dans la poésie. Nous sommes le problème et la solution à la fois !</blockquote>
<a class="btn" href="quisommesnous.html">Qui sommes-nous <span aria-hidden="true">→</span></a>""", "quote-home", "qp", bg="#281467", fg=CREAM)
    return f"""<main>
<section class="hero"><h1 class="big">{h1}</h1>{photo}
{poster(intro, "intro-home", "intro kraft", bg="#c99d63", fg=INK)}</section>
<div class="bands">{hazard("h1")}{ruban(["Cirque contemporain", "Genève", "Rue & salle", "Tous publics"], "r1")}</div>
<section class="wall-s" aria-labelledby="t-shows">{sec("Les spectacles", "à l'affiche", "home-s").replace("<h2 ", '<h2 id="t-shows" ', 1)}<div class="wall">{shows}</div></section>
<section class="next">{sec("Prochaines", "dates", "home-d")}{dates_list(nxt)}
<p class="all"><a class="btn" href="agenda.html">Tout l'agenda <span aria-hidden="true">→</span></a></p></section>
<section class="cie-band">{quote}</section>
{newsletter()}</main>"""


def page_spectacles():
    current = [s for s in SHOWS if s["status"] != "Répertoire"]
    archive = [s for s in SHOWS if s["status"] == "Répertoire"]
    blocks = "".join(show_poster(s, f"{s['status']} · {s['genre']}", "h2") for s in current)
    rep = "".join(show_poster(s, s["genre"], "h3", small=True) for s in archive)
    return f"""<main>{ph_title(strip("Spectacles", "p-spec") + tag("rue & salle", "p-spec"), "Cirque-théâtre, cabaret de rue, solos intimistes et créations en cours. En rue et en salle, pour tous les publics.")}
<section class="wall-s"><div class="wall">{blocks}</div></section>
<div class="bands">{hazard("sp")}</div>
<section class="wall-s">{sec("Le répertoire", "archives", "rep")}<div class="wall rep">{rep}</div></section></main>"""


def page_show(s):
    p = s.get("paper", "encre")
    body = "".join(f"<p>{x}</p>" for x in s["body"])
    meta = " · ".join(x for x in (s["genre"], s["duration"], s["public"], s["venue"]) if x)
    sub = tag(E(s["subtitle"]), "sub") if s.get("subtitle") else ""
    quote = ""
    if s["quote"]:
        quote = f'<section class="s-quote">{poster("<blockquote>" + E(s["quote"]) + "</blockquote>", "q" + s["slug"], "qp", bg="#9781ff", fg=INK)}</section>'
    links = "".join(f'<a class="btn" href="{u}" rel="noopener">{E(l)}</a>' for l, u in s["links"]) or '<a class="btn" href="contact.html">Dossier sur demande</a>'
    video = ""
    if s.get("vimeo"):
        video = (f'<section class="s-video"><div class="vf" style="--r:{tilt("v" + s["slug"], 1)}"><span class="tape tl" aria-hidden="true"></span><span class="tape br" aria-hidden="true"></span>'
                 f'<iframe src="https://player.vimeo.com/video/{s["vimeo"]}?title=0&byline=0&portrait=0" '
                 f'title="{E(s["title"])} – vidéo" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen loading="lazy"></iframe></div></section>')
    gal = ""
    photos = [g for g in s["gallery"] if g != s["hero"]]
    if len(photos) >= 2:
        items = "".join(
            f'<button type="button" class="photo paste" data-full="{img(g, 1800)}" style="--r:{tilt(g, 2.6)};{tape_style(g)}"><span class="tape" aria-hidden="true"></span>'
            f'<span class="sheet" style="{torn(g, a=5, sides=True)}">{pic(g, s["title"] + " – photo " + str(i + 1), 700)}</span></button>'
            for i, g in enumerate(photos))
        gal = f'<section class="s-gal" aria-label="Photos">{sec("En images", "clic clac", "gal" + s["slug"])}<div class="gal">{items}</div></section>'
    dates = ""
    if s["dates"]:
        up = [d + (s,) for d in s["dates"] if d[0] >= TODAY][::-1]
        past = [d for d in s["dates"] if d[0] < TODAY]
        pl = f'<details class="past"><summary>Dates passées ({len(past)})</summary><ul class="plain">{"".join(date_line(*d) for d in past)}</ul></details>' if past else ""
        dates = f'<section class="s-dates">{sec("Dates", "on joue ici", "dates" + s["slug"])}{dates_list(up, "Pas de nouvelle date annoncée pour le moment.")}{pl}</section>'
    info = (poster(f"<h2>Équipe</h2><p>{E(s['credits'])}</p>", "eq" + s["slug"], "info", bg=CREAM, fg=INK) +
            poster(f'<h2>Pour accueillir ce spectacle</h2><div class="links">{links}</div><p class="ct"><a href="mailto:{SITE["email"]}">{SITE["email"]}</a><br>{SITE["phone"]}</p>',
                   "acc" + s["slug"], "info", bg="#c99d63", fg=INK))
    return f"""<main>
<section class="s-hero" style="--sb:{PAPER[p]}"><div class="s-ph" style="{torn("hero" + s["slug"], a=14, n=24, top=False)}">{pic(s['hero'], s['title'], 2000, eager=True)}</div>
<div class="s-head"><a class="back" href="spectacles.html">← Spectacles</a>
<span class="sticker round st-status" style="--r:{tilt("st" + s["slug"], 9)}">{E(s['status'])}</span>
<h1 class="big">{strip(E(s['title']), "t" + s["slug"])}</h1>{sub}
<p class="by">{E(s['by'])}</p><p class="meta">{E(meta)}</p></div></section>
<section class="s-body"><div class="txt">{body}</div></section>{quote}{video}{gal}
<section class="s-info">{info}</section>
{dates}</main>"""


def page_agenda():
    up = upcoming()
    past = [r for r in all_dates() if r[0] < TODAY]
    by_year = {}
    for r in past:
        by_year.setdefault(r[0][:4], []).append(r)
    past_html = "".join(f'<div class="yr"><h3 class="year">{y}</h3><ul class="plain">{"".join(date_line(*r) for r in rows)}</ul></div>' for y, rows in by_year.items())
    return f"""<main>{ph_title(strip("Agenda", "p-ag") + tag("où ça se joue", "p-ag"), "Toutes les dates de tous nos spectacles. Depuis 2021, en Suisse, en France et jusqu'en Argentine.")}
<section class="ag">{sec("À venir", "bientôt", "ag-up")}{dates_list(up)}</section>
<div class="bands">{hazard("ag")}</div>
<section class="ag">{sec("Déjà joué", "archives", "ag-past")}<div class="years">{past_html}</div></section></main>"""


def page_qui():
    com = "".join(f"<li><span>{E(r)}</span> {E(n)}</li>" for r, n in COMMITTEE)
    artists = ""
    for i, a in enumerate(ARTISTS):
        portrait = poster(pic(a["photo"], a["name"], 900), "a" + a["name"], "portrait", bg=CREAM, a=7)
        artists += f"""<section class="artist{' r' if i % 2 else ''}">{portrait}
<div class="atxt"><h2>{strip(E(a['name']), "n" + a["name"])}</h2>{tag(E(a['role']), a["name"])}<p>{a['bio']}</p></div></section>"""
    hist = ""
    for y, t, sub, l in HISTORY:
        more = ("<br><small>" + E(sub) + "</small>") if sub else ""
        link = f' <a href="{href(l)}">voir →</a>' if l else ""
        hist += f'<li class="paste" style="--r:{tilt("y" + y + t, 3)}"><span class="y">{y}</span><span>{t}{more}{link}</span></li>'
    cie = poster("""<p>La Cie Origami est une compagnie de cirque contemporain née en 2018, animée par une envie de liberté artistique et de partager ses créations avec le plus grand nombre. Depuis ses débuts, la compagnie intervient autant en salle, sous chapiteau qu'en rue…</p>
<p><strong>Vous faites des origamis ?</strong> Non, on crée des spectacles. C'est presque pareil, hein ! Parce que, comme l'art du pliage de papier, la création d'un spectacle transforme des idées simples en formes surprenantes. Chaque spectacle est pour nous un pliage, une construction minutieuse qui prend vie sur scène.</p>
<p>Implantée en Suisse, la Cie Origami est structurée en association pour offrir un cadre administratif à ses projets artistiques.</p>""", "cie-txt", "cie-p", bg=CREAM, fg=INK)
    comite = poster(f"<h2>Comité de l'association</h2><ul>{com}</ul>", "comite", "comite", bg="#9781ff", fg=INK)
    return f"""<main>{ph_title(strip("Qui sommes-", "p-qui") + strip("nous", "p-qui2", "lav"), "Nous sommes nulle part et partout à la fois, autant dans la bêtise que dans la poésie. Autant dans un vaisseau spatial que sur terre, à porter le monde en équilibre sur un bras. Nous sommes le problème et la solution à la fois ! Nous sommes… nous sommes…")}
<section class="cie">{cie}{comite}</section>
<div class="bands">{ruban(["Ella Beerli", "Sévane Gurunlian", "Julie Levrat"], "r-qui")}</div>
<section class="artists">{artists}</section>
<section class="hist-s">{sec("Historique", "depuis 2018", "hist")}<ol class="hist">{hist}</ol></section></main>"""


def page_collabs():
    groups = ""
    bgs = [(CREAM, INK), ("#c99d63", INK), ("#9781ff", INK), ("#281467", CREAM), (CREAM, INK)]
    for i, (title, items) in enumerate(COLLABS):
        li = "".join(f"""<li><h3>{('<a href="' + u + '" rel="noopener">' + E(n) + '</a>') if u else E(n)}</h3><p>{E(t)}</p></li>""" for n, u, t in items)
        bg, fg = bgs[i % len(bgs)]
        groups += poster(f'<h2>{E(title)}</h2><ul class="clist">{li}</ul>', "cg" + title, "cgroup", bg=bg, fg=fg)
    crew = "".join(f"<li>{tag(E(s['title']), 'c' + s['slug'])}<span>{E(s['credits'])}</span></li>" for s in SHOWS)
    sup = "".join(f'<li><a class="stk" href="{u}" rel="noopener" style="--r:{tilt("sp" + n, 5)}">{E(n)}</a></li>' for n, u in SUPPORTERS)
    return f"""<main>{ph_title(strip("Merci", "p-col") + tag("à vous", "p-col"), "Merci à toutes les personnes et organisations qui rendent nos projets possibles, aux amis qui partagent nos aventures, et aux petites mains qui déplacent du matériel, montent les décors et rendent nos projets vivants.")}
<section class="col">{groups}</section>
<div class="bands">{hazard("col")}</div>
<section class="sup">{sec("Nous ont soutenus", "merci !", "sup")}<ul class="stickers">{sup}</ul></section>
<section class="crew-s">{sec("Les artistes", "des créations", "crew")}<ul class="crew">{crew}</ul></section></main>"""


def page_contact():
    addr = "<br>".join(E(a) for a in SITE["address"])
    opts = "".join(f"<option>{E(s['title'])}</option>" for s in SHOWS if s["status"] != "Répertoire")
    info = poster(f"""<h2>E-mail</h2><p><a class="sel" href="mailto:{SITE['email']}">{SITE['email']}</a> <button class="copy" type="button" data-copy="{SITE['email']}">Copier</button></p>
<h2>Téléphone</h2><p>{SITE['phone_name']} : <a href="tel:{SITE['phone'].replace(' ', '')}">{SITE['phone']}</a></p>
<h2>Adresse</h2><p>{addr}</p>
<h2>Nous suivre</h2><p><a href="{SITE['instagram']}" rel="noopener">Instagram</a> · <a href="{SITE['facebook']}" rel="noopener">Facebook</a></p>""", "c-info", "c-info", bg="#c99d63", fg=INK)
    form = poster(f"""<form class="form" name="contact" method="POST" data-netlify="true" netlify-honeypot="bot-field">
<input type="hidden" name="form-name" value="contact"><p hidden><label>Ne pas remplir <input name="bot-field"></label></p>
<div><label for="c-name">Nom</label><input id="c-name" name="nom" required autocomplete="name"></div>
<div><label for="c-email">E-mail</label><input id="c-email" type="email" name="email" required autocomplete="email"></div>
<div><label for="c-show">Spectacle concerné (facultatif)</label><select id="c-show" name="spectacle"><option value="">—</option>{opts}<option>Autre</option></select></div>
<div><label for="c-msg">Message</label><textarea id="c-msg" name="message" rows="6" required></textarea></div>
<div><button class="btn ink" type="submit">Envoyer</button></div></form>""", "c-form", "c-form", bg=CREAM, fg=INK)
    return f"""<main>{ph_title(strip("Nous", "p-ct") + tag("écrire", "p-ct"), "Pour accueillir un spectacle, demander un dossier ou simplement dire bonjour.")}
<section class="contact">{info}{form}</section>
{newsletter()}</main>"""


def page_404():
    return f"""<main>{ph_title(strip("Oups", "p-404") + tag("!", "p-404"), "Cette page s'est dépliée ailleurs. Elle a peut-être changé d'adresse avec le nouveau site.")}
<p class="back404"><a class="btn" href="index.html">Retour à l'accueil</a></p></main>"""


SCRIPT = """<div class="lightbox" hidden><button class="lb-close" type="button">Fermer ✕</button><button class="lb-prev" type="button" aria-label="Photo précédente">←</button><img alt=""><button class="lb-next" type="button" aria-label="Photo suivante">→</button></div>
<script>
(function(){
 var reduce=matchMedia("(prefers-reduced-motion: reduce)").matches,root=document.documentElement;

 /* ouverture : l'affiche du logo se décolle, une fois par visite */
 var loader=document.querySelector(".loader");
 if(!root.classList.contains("seen")){setTimeout(function(){loader.classList.add("done");try{sessionStorage.setItem("origami-vu","1")}catch(e){}},reduce?150:1550);}

 /* affiches : elles se collent au mur en entrant dans l'écran */
 var pastes=[].slice.call(document.querySelectorAll(".paste"));
 if(reduce||!("IntersectionObserver" in window)){pastes.forEach(function(p){p.classList.add("in")});}
 else{var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add("in");io.unobserve(e.target)}})},{rootMargin:"0px 0px -6% 0px"});
  pastes.forEach(function(p,i){p.style.setProperty("--d",(i%4)*70+"ms");io.observe(p)});}

 /* menu : une affiche plaquée sur l'écran, qu'on arrache pour fermer */
 var menu=document.getElementById("menu"),btn=document.querySelector(".open-menu"),closeB=menu.querySelector(".close");
 function openMenu(){menu.classList.remove("closing");menu.classList.add("open");document.body.classList.add("menu-on");btn.setAttribute("aria-expanded","true");closeB.focus();}
 function closeMenu(){if(!menu.classList.contains("open"))return;menu.classList.remove("open");btn.setAttribute("aria-expanded","false");document.body.classList.remove("menu-on");
  if(reduce){btn.focus();return;}menu.classList.add("closing");setTimeout(function(){menu.classList.remove("closing")},450);btn.focus();}
 btn.addEventListener("click",openMenu);closeB.addEventListener("click",closeMenu);
 menu.addEventListener("keydown",function(e){if(e.key!=="Tab")return;var f=menu.querySelectorAll("a,button"),a=f[0],z=f[f.length-1];
  if(e.shiftKey&&document.activeElement===a){e.preventDefault();z.focus()}else if(!e.shiftKey&&document.activeElement===z){e.preventDefault();a.focus()}});

 /* dates passées : retirées même si le site n'a pas été reconstruit */
 var d=new Date(),today=d.getFullYear()+"-"+("0"+(d.getMonth()+1)).slice(-2)+"-"+("0"+d.getDate()).slice(-2);
 document.querySelectorAll("ul.dates").forEach(function(ul){var n=0;ul.querySelectorAll(".d[data-iso]").forEach(function(li){if(li.dataset.iso<today)li.remove();else n++});
  var em=ul.nextElementSibling;if(em&&em.classList.contains("empty"))em.hidden=n>0;});

 /* visionneuse photo */
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
    with open(os.path.join(DIST, "favicon.svg"), "w") as f:
        f.write('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><rect width="40" height="40" rx="5" fill="#281467"/>'
                '<path d="M6 9l27-3 1 8-28 2z" fill="#9781FF"/><path d="M7 19l26 1-1 6-25 1z" fill="#efe8d8"/><path d="M9 30l22-2 1 6-23 1z" fill="#9781FF"/></svg>')
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
