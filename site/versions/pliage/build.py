# -*- coding: utf-8 -*-
"""Génère le site statique de la Cie Origami (direction « Pliage », octobre 2026).

    python3 build.py   -> dossier dist/ (le site à mettre en ligne)

Le site entier comme une feuille d'origami : les sections se déplient en 3D
quand elles arrivent à l'écran, les photos des spectacles s'ouvrent comme un
dépliant accordéon, le menu se déplie en bandes de papier.
Les textes et données sont dans content.py, le design dans style.css.
Photos : IMG_MODE = "wix" utilise les photos hébergées chez Wix (temporaire).
Une fois les photos copiées dans dist/images/, passez IMG_MODE = "local".
"""
import html, os, re, shutil, sys, datetime

IMG_MODE = "wix"
TODAY = datetime.date.today().isoformat()
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))  # dossier site/ : content.py et logo.svg communs
sys.path.insert(0, ROOT)
from content import SITE, SHOWS, ARTISTS, HISTORY, COMMITTEE, COLLABS, SUPPORTERS, REDIRECTS
DIST = os.path.join(HERE, "dist")
E = html.escape
FONTS = "https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght,SOFT,WONK@0,9..144,300..600,50,1;1,9..144,300..600,50,1&family=Barlow:ital,wght@0,300;0,400;0,500;1,300&family=IBM+Plex+Mono:wght@400&display=swap"

# Logo vectoriel, inséré dans la page pour que chaque lettre puisse pencher
_LOGO = open(os.path.join(ROOT, "logo.svg")).read()
LOGO_SVG = re.sub(r'fill="#[0-9A-Fa-f]+"', 'fill="currentColor" role="img" aria-label="Compagnie Origami"', _LOGO, count=1)
LOGO_DECO = re.sub(r'fill="#[0-9A-Fa-f]+"', 'fill="currentColor" aria-hidden="true"', _LOGO, count=1)


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
TILTS = ["-4deg", "2.5deg", "-1.5deg", "3.5deg", "-2.5deg"]
SHIFT = ["0", "9%", "3%", "14%", "6%"]

# ---------------------------------------------------------------- formes de papier (SVG géométrique fait main)
# chaque forme : facettes pleines + lignes de pliure fines
CRANE = """<svg class="paper-form crane" viewBox="0 0 220 150" aria-hidden="true">
<polygon points="112,84 64,8 128,74" fill="#9781FF"/><polygon points="112,84 128,74 64,8" fill="#c7b8ff" opacity=".55"/>
<polygon points="112,84 172,22 134,80" fill="#3a1f8a"/>
<polygon points="72,94 112,84 150,94 112,110" fill="#efe6d2"/><polygon points="112,84 150,94 112,110" fill="#d9ccb2"/>
<polygon points="72,94 40,36 52,36 88,98" fill="#efe6d2"/><polygon points="40,36 26,46 50,42" fill="#9781FF"/>
<polygon points="150,94 204,52 196,62 140,102" fill="#d9ccb2"/>
<path d="M112 84 112 110M72 94 150 94M112 84 64 8" stroke="#281467" stroke-width=".8" fill="none" opacity=".5"/></svg>"""
BOAT = """<svg class="paper-form boat" viewBox="0 0 160 110" aria-hidden="true">
<polygon points="40,66 80,10 120,66" fill="#9781FF"/><polygon points="80,10 120,66 80,66" fill="#3a1f8a"/>
<polygon points="8,66 152,66 128,96 32,96" fill="#efe6d2"/><polygon points="80,66 152,66 128,96 80,96" fill="#d9ccb2"/>
<path d="M80 10 80 96M8 66 152 66" stroke="#281467" stroke-width=".8" fill="none" opacity=".5"/></svg>"""
COCOTTE = """<svg class="paper-form cocotte" viewBox="0 0 120 120" aria-hidden="true">
<polygon points="60,6 114,60 60,60" fill="#9781FF"/><polygon points="114,60 60,114 60,60" fill="#3a1f8a"/>
<polygon points="60,114 6,60 60,60" fill="#c7b8ff"/><polygon points="6,60 60,6 60,60" fill="#efe6d2"/>
<path d="M60 6 60 114M6 60 114 60M33 33 87 87M87 33 33 87" stroke="#281467" stroke-width=".8" fill="none" opacity=".45"/></svg>"""


def wob(tag, inner, f=1, cls="", attrs=""):
    """Élément qui tangue selon la vitesse de défilement."""
    c = f' class="wob {cls}"' if cls else ' class="wob"'
    return f'<{tag}{c} style="--f:{f}"{attrs}>{inner}</{tag}>'


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
<meta name="theme-color" content="#08060f">
<link rel="icon" href="favicon.svg" type="image/svg+xml">
<script>document.documentElement.classList.add("js");try{{if(sessionStorage.getItem("origami-vu"))document.documentElement.classList.add("seen")}}catch(e){{}}</script>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="{FONTS}"><link rel="stylesheet" href="style.css"></head><body>"""


def loader():
    # une feuille carrée : les quatre coins se plient au centre (cocotte), la feuille tourne,
    # se déplie et s'étire en bande de papier qui porte le logo
    flaps = "".join(f'<span class="fl f{i}"></span>' for i in range(1, 5))
    return f"""<div class="loader" aria-hidden="true"><div class="stage"><div class="sq"><span class="base"></span>{flaps}<span class="lg">{LOGO_DECO}</span></div></div></div>"""


def header(active):
    cur = ' aria-current="page"'
    links = "".join(
        f'<a href="{href(k)}" style="--a:{TILTS[i]};--i:{i};margin-left:{SHIFT[i]}"{cur if k == active else ""}>{v}</a>'
        for i, (k, v) in enumerate(MENU))
    shows = "".join(f'<li><a href="{href(s["slug"])}">{E(s["title"])}</a></li>' for s in SHOWS if s["status"] != "Répertoire")
    leaves = "".join(f'<span class="leaf" style="--i:{i}"></span>' for i in range(4))
    return f"""{loader()}
<a class="sr" href="#contenu">Aller au contenu</a>
<header class="top"><a class="logo wob-logo" href="index.html">{LOGO_SVG}</a>
<button class="open-menu" type="button" aria-expanded="false" aria-controls="menu"><span class="mi" aria-hidden="true"></span>Menu</button></header>
<div class="menu" id="menu" role="dialog" aria-modal="true" aria-label="Menu"><div class="leaves" aria-hidden="true">{leaves}</div>
<button class="close" type="button">Fermer</button>
<div class="menu-in"><nav class="main-links" aria-label="Rubriques">{links}</nav>
<div class="side"><div><h2>Les spectacles</h2><ul>{shows}</ul></div>
<div><h2>Nous écrire</h2><ul><li><a href="mailto:{SITE['email']}">{SITE['email']}</a></li><li><a href="{SITE['instagram']}" rel="noopener">Instagram</a> · <a href="{SITE['facebook']}" rel="noopener">Facebook</a></li></ul></div></div>
</div></div><div id="contenu"></div>"""


def footer():
    nav = "".join(f'<a href="{href(k)}">{v}</a>' for k, v in MENU)
    return f"""<footer class="foot unf"><div class="in"><nav aria-label="Pied de page">{nav}</nav>
<div><a href="{SITE['instagram']}" rel="noopener">Instagram</a> · <a href="{SITE['facebook']}" rel="noopener">Facebook</a><br><small>© {datetime.date.today().year} Compagnie Origami · Genève</small></div></div>{BOAT}</footer>"""


# ---------------------------------------------------------------- blocs

def accordion(mid, alt, w=1100, n=3):
    """Photo découpée en n volets qui se déplient comme un dépliant."""
    src = img(mid, w)
    panes = ""
    for i in range(n):
        im = f'<img src="{src}" alt="{E(alt)}" loading="lazy" decoding="async">' if i == 0 else f'<img src="{src}" alt="" loading="lazy" decoding="async">'
        panes += f'<span class="pane" style="--k:{i}">{im}</span>'
    return f'<div class="acc" style="--n:{n}">{panes}</div>'


def show_block(s, i, tag_text=None, h="h2"):
    r = " r" if i % 2 else ""
    meta = tag_text or " · ".join(x for x in (s["genre"], s["venue"], s["duration"]) if x)
    return f"""<a class="show{r}" href="{href(s['slug'])}">{accordion(s['card'], s['title'])}
<div class="txt unf">{wob(h, E(s['title']), 1.3)}<span class="meta mono">{E(meta)}</span><p class="teaser">{E(s['teaser'])}</p><span class="go">Déplier <span aria-hidden="true">→</span></span></div></a>"""


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
    return f"""<section class="nl sheet cream unf" aria-labelledby="nl-t"><div class="big shake" id="nl-t">Newsletter</div>
<p>De temps en temps, des nouvelles de nos créations et nos prochaines dates. Pas tous les deux jours, promis.</p>
<form name="newsletter" method="POST" data-netlify="true" netlify-honeypot="bot-field">
<input type="hidden" name="form-name" value="newsletter"><p hidden><label>Ne pas remplir <input name="bot-field"></label></p>
<label class="sr" for="nl-mail">Ton adresse e-mail</label><input id="nl-mail" type="email" name="email" placeholder="ton adresse e-mail" required autocomplete="email">
<button class="btn" type="submit">S'abonner</button></form></section>"""


def peek(word, slug, c):
    """Mot-lien coloré : au survol, une photo cachée se déplie."""
    s = SHOW_BY_SLUG[slug]
    return (f'<a class="peek" href="{href(slug)}" style="--c:{c}">{word}'
            f'<span class="peek-img" aria-hidden="true"><img src="{img(s["card"], 600)}" alt="" loading="lazy" decoding="async"></span></a>')


# ---------------------------------------------------------------- pages

def page_index():
    shows = "".join(show_block(SHOW_BY_SLUG[sl], i, HOME_TAG.get(sl)) for i, sl in enumerate(HOME_ORDER))
    nxt = upcoming()[:4]
    words = (f"{peek('créer', 'commeunpoint', 'var(--lav)')}, de {peek('raconter', 'la-petite-fille-dans-la-poubelle', 'var(--cream)')}, "
             f"de {peek('surprendre', 'caborigamique', '#c7b8ff')}")
    return f"""<main>
<section class="hero">{CRANE}{COCOTTE}{wob("h1", "Bienvenue dans l'univers<br>de la cie <i>Origami</i>", 1)}
<div class="intro"><p>Depuis 2018, la Cie Origami tisse des spectacles aux formes multiples, nés d'une passion commune : celle de {words}.</p>
<p>Chaque projet réunit des artistes de cirque aux univers singuliers, pour donner vie à des œuvres tantôt drôles, tantôt poétiques, toujours sensibles. La compagnie s'adresse à tous les publics (petits, grands ou avertis) avec le désir d'offrir des instants forts et partagés.</p></div></section>
<section class="shows" aria-label="Spectacles">{shows}</section>
<section class="next sheet night unf">{wob("h2", "Prochaines <i>dates</i>", .9, "sec-h")}{dates_list(nxt)}
<p class="all"><a class="go" href="agenda.html">Tout l'agenda <span aria-hidden="true">→</span></a></p></section>
<section class="cie-band sheet lav unf"><div><blockquote>Nous sommes nulle part et partout à la fois, autant dans la bêtise que dans la poésie. Nous sommes le problème et la solution à la fois !</blockquote>
<a class="go" href="quisommesnous.html">Qui sommes-nous <span aria-hidden="true">→</span></a></div></section>
{newsletter()}</main>"""


def page_spectacles():
    current = [s for s in SHOWS if s["status"] != "Répertoire"]
    archive = [s for s in SHOWS if s["status"] == "Répertoire"]
    blocks = "".join(show_block(s, i, f"{s['status']} · {s['genre']}") for i, s in enumerate(current))
    rep = "".join(f"""<a class="unf" href="{href(s['slug'])}"><div class="pic fold">{pic(s['card'], s['title'], 800)}</div><h3>{E(s['title'])}</h3><p>{E(s['teaser'])}</p></a>""" for s in archive)
    return f"""<main><section class="ph-title">{BOAT}{wob("h1", "Spec<i>tacles</i>", 1)}
<p class="intro">Cirque-théâtre, cabaret de rue, solos intimistes et créations en cours. En rue et en salle, pour tous les publics.</p></section>
<section class="shows">{blocks}</section>
<section class="wrap" style="margin-top:80px">{wob("h2", "Le <i>répertoire</i>", .9, "sec-h")}</section><div class="rep">{rep}</div></main>"""


def page_show(s):
    body = "".join(f"<p>{p}</p>" for p in s["body"])
    meta = " · ".join(x for x in (s["genre"], s["duration"], s["public"], s["venue"]) if x)
    sub = f'<p class="sub">{E(s["subtitle"])}</p>' if s.get("subtitle") else ""
    quote = f'<blockquote class="quote sheet lav unf">{E(s["quote"])}</blockquote>' if s["quote"] else ""
    links = "".join(f'<a class="btn" href="{u}" rel="noopener">{E(l)}</a>' for l, u in s["links"]) or '<a class="btn" href="contact.html">Dossier sur demande</a>'
    video = ""
    if s.get("vimeo"):
        video = (f'<section class="s-video unf"><div class="vf"><iframe src="https://player.vimeo.com/video/{s["vimeo"]}?title=0&byline=0&portrait=0" '
                 f'title="{E(s["title"])} – vidéo" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen loading="lazy"></iframe></div></section>')
    gal = ""
    photos = [g for g in s["gallery"] if g not in (s["hero"],)]
    if len(photos) >= 2:
        items = "".join(f'<button class="unf" type="button" data-full="{img(g, 1800)}" style="--d:{(i % 4) * 90}ms">{pic(g, s["title"] + " – photo " + str(i + 1), 700)}</button>' for i, g in enumerate(photos))
        gal = f'<section aria-label="Photos"><div class="gal">{items}</div></section>'
    dates = ""
    if s["dates"]:
        up = [d for d in s["dates"] if d[0] >= TODAY][::-1]
        past = [d for d in s["dates"] if d[0] < TODAY]
        p = f'<details class="past"><summary>Dates passées ({len(past)})</summary><ul class="plain">{"".join(date_line(*d) for d in past)}</ul></details>' if past else ""
        dates = f'<section class="s-dates sheet night unf">{wob("h2", "Dates", .9, "sec-h")}{dates_list(up, "Pas de nouvelle date annoncée pour le moment.")}{p}</section>'
    return f"""<main>
<section class="s-hero"><div class="s-photo">{accordion(s['hero'], s['title'], 2000, 4)}</div><div class="wrap">
<div class="label sheet cream"><a class="back" href="spectacles.html">← Spectacles</a><span class="status">{E(s['status'])}</span>
{wob("h1", E(s['title']), 1)}{sub}<p class="by">{E(s['by'])}</p><p class="meta mono">{E(meta)}</p></div></div></section>
<section class="s-body unf"><div class="txt">{body}</div></section>{quote}{video}{gal}
<section class="s-info sheet violet unf"><div><h2>Équipe</h2><p>{E(s['credits'])}</p></div>
<div><h2>Pour accueillir ce spectacle</h2><div class="links">{links}</div><p style="margin-top:16px"><a href="mailto:{SITE['email']}">{SITE['email']}</a> · {SITE['phone']}</p></div></section>
{dates}</main>"""


def page_agenda():
    up = upcoming()
    past = [r for r in all_dates() if r[0] < TODAY]
    by_year = {}
    for r in past:
        by_year.setdefault(r[0][:4], []).append(r)
    past_html = "".join(f'<div class="unf"><h2 class="year">{y}</h2><ul class="plain">{"".join(date_line(*r) for r in rows)}</ul></div>' for y, rows in by_year.items())
    return f"""<main><section class="ph-title">{COCOTTE}{wob("h1", "Agen<i>da</i>", 1)}
<p class="intro">Toutes les dates de tous nos spectacles. Depuis 2021, en Suisse, en France et jusqu'en Argentine.</p></section>
<section class="ag sheet night unf">{wob("h2", "À <i>venir</i>", .9, "sec-h")}{dates_list(up)}</section>
<section class="ag">{wob("h2", "Déjà <i>joué</i>", .9, "sec-h")}{past_html}</section></main>"""


def page_qui():
    com = "".join(f"<li>{E(r)} : {E(n)}</li>" for r, n in COMMITTEE)
    artists = "".join(f"""<section class="artist{' r' if i % 2 else ''}"><div class="portrait unf">{pic(a['photo'], a['name'], 900)}</div>
<div class="unf">{wob("h2", E(a['name']), 1.2)}<p class="role mono">{E(a['role'])}</p><p>{a['bio']}</p></div></section>""" for i, a in enumerate(ARTISTS))
    hist = ""
    for y, t, sub, l in HISTORY:
        more = (" · " + E(sub)) if sub else ""
        link = f' <a href="{href(l)}">voir →</a>' if l else ""
        hist += f'<li><span class="y">{y}</span><span>{t}{more}{link}</span></li>'
    return f"""<main><section class="ph-title">{CRANE}{wob("h1", "Qui sommes-<i>nous</i>", 1)}
<p class="intro">Nous sommes nulle part et partout à la fois, autant dans la bêtise que dans la poésie. Autant dans un vaisseau spatial que sur terre, à porter le monde en équilibre sur un bras. Nous sommes le problème et la solution à la fois ! Nous sommes… nous sommes…</p></section>
<section class="cie"><div class="txt unf"><p>La Cie Origami est une compagnie de cirque contemporain née en 2018, animée par une envie de liberté artistique et de partager ses créations avec le plus grand nombre. Depuis ses débuts, la compagnie intervient autant en salle, sous chapiteau qu'en rue…</p>
<p><strong>Vous faites des origamis ?</strong> Non, on crée des spectacles. C'est presque pareil, hein ! Parce que, comme l'art du pliage de papier, la création d'un spectacle transforme des idées simples en formes surprenantes. Chaque spectacle est pour nous un pliage, une construction minutieuse qui prend vie sur scène.</p>
<p>Implantée en Suisse, la Cie Origami est structurée en association pour offrir un cadre administratif à ses projets artistiques.</p></div>
<aside class="sheet lav unf"><h2>Comité de l'association</h2><ul>{com}</ul></aside></section>
{artists}
<section class="wrap hist-w sheet night unf">{wob("h2", "His<i>torique</i>", .9, "sec-h")}<ol class="hist">{hist}</ol></section></main>"""


def page_collabs():
    groups = ""
    for title, items in COLLABS:
        li = "".join(f"""<li><h3>{('<a href="' + u + '" rel="noopener">' + E(n) + '</a>') if u else E(n)}</h3><p>{E(t)}</p></li>""" for n, u, t in items)
        groups += f'<div class="cgroup unf"><h2>{E(title)}</h2><ul class="clist">{li}</ul></div>'
    crew = "".join(f"<li><strong>{E(s['title'])}</strong><span>{E(s['credits'])}</span></li>" for s in SHOWS)
    sup = "".join(f'<li><a href="{u}" rel="noopener">{E(n)}</a></li>' for n, u in SUPPORTERS)
    return f"""<main><section class="ph-title">{CRANE}{wob("h1", "Merci <i>à vous</i>", 1)}
<p class="intro">Merci à toutes les personnes et organisations qui rendent nos projets possibles, aux amis qui partagent nos aventures, et aux petites mains qui déplacent du matériel, montent les décors et rendent nos projets vivants.</p></section>
<section class="col">{groups}</section>
<section class="sup sheet lav unf"><div>{wob("h2", "Nous ont <i>soutenus</i>", .9, "sec-h")}<ul>{sup}</ul></div></section>
<section class="col unf">{wob("h2", "Les artistes <i>des créations</i>", .9, "sec-h")}<ul class="crew">{crew}</ul></section></main>"""


def page_contact():
    addr = "<br>".join(E(a) for a in SITE["address"])
    opts = "".join(f"<option>{E(s['title'])}</option>" for s in SHOWS if s["status"] != "Répertoire")
    return f"""<main><section class="ph-title">{BOAT}{wob("h1", "Nous <i>écrire</i>", 1)}
<p class="intro">Pour accueillir un spectacle, demander un dossier ou simplement dire bonjour.</p></section>
<section class="contact"><div class="unf">
<h2>E-mail</h2><p><a class="sel" href="mailto:{SITE['email']}">{SITE['email']}</a> <button class="copy" type="button" data-copy="{SITE['email']}">Copier</button></p>
<h2>Téléphone</h2><p>{SITE['phone_name']} : <a href="tel:{SITE['phone'].replace(' ', '')}">{SITE['phone']}</a></p>
<h2>Adresse</h2><p>{addr}</p>
<h2>Nous suivre</h2><p><a href="{SITE['instagram']}" rel="noopener">Instagram</a> · <a href="{SITE['facebook']}" rel="noopener">Facebook</a></p></div>
<form class="form sheet violet unf" name="contact" method="POST" data-netlify="true" netlify-honeypot="bot-field">
<input type="hidden" name="form-name" value="contact"><p hidden><label>Ne pas remplir <input name="bot-field"></label></p>
<div><label for="c-name">Nom</label><input id="c-name" name="nom" required autocomplete="name"></div>
<div><label for="c-email">E-mail</label><input id="c-email" type="email" name="email" required autocomplete="email"></div>
<div><label for="c-show">Spectacle concerné (facultatif)</label><select id="c-show" name="spectacle"><option value="">—</option>{opts}<option>Autre</option></select></div>
<div><label for="c-msg">Message</label><textarea id="c-msg" name="message" rows="6" required></textarea></div>
<div><button class="btn" type="submit">Envoyer</button></div></form></section>
{newsletter()}</main>"""


def page_404():
    return f"""<main><section class="ph-title">{COCOTTE}{wob("h1", "Ou<i>ps</i> !", 1)}
<p class="intro">Cette page s'est dépliée ailleurs. Elle a peut-être changé d'adresse avec le nouveau site.</p>
<p style="margin:30px 0 0 6%"><a class="btn" href="index.html">Retour à l'accueil</a></p></section></main>"""


SCRIPT = """<div class="lightbox" hidden><button class="lb-close" type="button">Fermer</button><button class="lb-prev" type="button" aria-label="Photo précédente">←</button><img alt=""><button class="lb-next" type="button" aria-label="Photo suivante">→</button></div>
<script>
(function(){
 var reduce=matchMedia("(prefers-reduced-motion: reduce)").matches,root=document.documentElement;

 /* ouverture : la feuille se plie en cocotte puis se déplie sur le logo, une fois par visite */
 var loader=document.querySelector(".loader");
 if(!root.classList.contains("seen")){setTimeout(function(){loader.classList.add("done");try{sessionStorage.setItem("origami-vu","1")}catch(e){}},reduce?150:2100);}

 /* menu : la feuille se déplie en bandes, puis se replie */
 var menu=document.getElementById("menu"),btn=document.querySelector(".open-menu"),closeB=menu.querySelector(".close");
 function openMenu(){menu.classList.remove("closing");menu.classList.add("open");document.body.classList.add("menu-on");btn.setAttribute("aria-expanded","true");closeB.focus();}
 function closeMenu(){if(!menu.classList.contains("open"))return;menu.classList.remove("open");btn.setAttribute("aria-expanded","false");document.body.classList.remove("menu-on");
  if(reduce){btn.focus();return;}menu.classList.add("closing");setTimeout(function(){menu.classList.remove("closing")},520);btn.focus();}
 btn.addEventListener("click",openMenu);closeB.addEventListener("click",closeMenu);
 menu.addEventListener("keydown",function(e){if(e.key!=="Tab")return;var f=menu.querySelectorAll("a,button"),a=f[0],z=f[f.length-1];
  if(e.shiftKey&&document.activeElement===a){e.preventDefault();z.focus()}else if(!e.shiftKey&&document.activeElement===z){e.preventDefault();a.focus()}});

 /* dates passées : masquées même si le site n'a pas été reconstruit */
 var d=new Date(),today=d.getFullYear()+"-"+("0"+(d.getMonth()+1)).slice(-2)+"-"+("0"+d.getDate()).slice(-2);
 document.querySelectorAll("ul.dates").forEach(function(ul){var n=0;ul.querySelectorAll(".d[data-iso]").forEach(function(li){if(li.dataset.iso<today)li.remove();else n++});
  var em=ul.nextElementSibling;if(em&&em.classList.contains("empty"))em.hidden=n>0;});

 /* dépliage des feuilles quand elles arrivent à l'écran */
 var folds=[].slice.call(document.querySelectorAll(".unf,.acc"));
 folds.forEach(function(el,i){if(!el.classList.contains("acc"))el.classList.add(i%2?"fy":"fx")});
 if(reduce||!("IntersectionObserver" in window)){folds.forEach(function(el){el.classList.add("on")});}
 else{var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add("on");io.unobserve(e.target)}})},{rootMargin:"0px 0px -12% 0px",threshold:.08});
  folds.forEach(function(el){io.observe(el)});}

 /* logo bancal : un angle par lettre */
 var logoPaths=[].slice.call(document.querySelectorAll(".wob-logo svg path"));
 logoPaths.forEach(function(p,i){var r=(Math.sin(i*12.9898)*43758.5453)%1;p.style.setProperty("--r",(r*4).toFixed(1));p.style.setProperty("--y",(r*2).toFixed(1));p.style.setProperty("--k",(.6+Math.abs(r)*1.4).toFixed(2));});

 /* tangage selon la vitesse de défilement */
 var wobs=[].slice.call(document.querySelectorAll(".wob"));
 wobs.forEach(function(w,i){w.style.setProperty("--rot",((i%2?1:-1)*(.6+(i%3)*.4)).toFixed(2))});
 var forms=[].slice.call(document.querySelectorAll(".paper-form"));
 var letters=[];
 document.querySelectorAll(".shake").forEach(function(w){w.setAttribute("aria-label",w.textContent);w.innerHTML=w.textContent.split("").map(function(c){return '<span aria-hidden="true">'+c+'</span>'}).join("");letters=letters.concat([].slice.call(w.children));});
 if(!reduce){
  var last=scrollY,v=0,sk=0,running=false;
  function tick(){var st=scrollY;v=v*.8+(st-last)*.2;last=st;
   sk+=(Math.max(-12,Math.min(12,v*.5))-sk)*.15;var s=sk.toFixed(2);
   wobs.forEach(function(w){w.style.setProperty("--sk",s)});
   forms.forEach(function(f){f.style.setProperty("--sk",s)});
   logoPaths.forEach(function(p){p.style.setProperty("--sk",(sk*.8).toFixed(2))});
   var a=Math.min(10,Math.abs(v)*.6);
   letters.forEach(function(l,i){l.style.transform=a>.3?"translate("+(Math.sin(i*7.3+st*.05)*a).toFixed(1)+"px,"+(Math.cos(i*3.1+st*.07)*a).toFixed(1)+"px) rotate("+(Math.sin(i+st*.03)*a).toFixed(1)+"deg)":""});
   if(Math.abs(v)>.05||Math.abs(sk)>.02)requestAnimationFrame(tick);else{running=false;letters.forEach(function(l){l.style.transform=""})}}
  addEventListener("scroll",function(){if(!running){running=true;requestAnimationFrame(tick)}},{passive:true});
 }

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


FAVICON = ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><rect width="40" height="40" rx="6" fill="#08060f"/>'
           '<g transform="rotate(-7 20 20)"><polygon points="20,5 35,20 20,20" fill="#9781FF"/><polygon points="35,20 20,35 20,20" fill="#3a1f8a"/>'
           '<polygon points="20,35 5,20 20,20" fill="#c7b8ff"/><polygon points="5,20 20,5 20,20" fill="#efe6d2"/></g></svg>')


def build():
    if os.path.exists(DIST):
        shutil.rmtree(DIST)
    os.makedirs(DIST)
    shutil.copy(os.path.join(HERE, "style.css"), DIST)
    shutil.copy(os.path.join(ROOT, "logo.svg"), DIST)
    with open(os.path.join(DIST, "favicon.svg"), "w") as f:
        f.write(FAVICON)
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
