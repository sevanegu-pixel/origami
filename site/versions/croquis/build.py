# -*- coding: utf-8 -*-
"""Génère le site statique de la Cie Origami (version « Croquis », octobre 2026).

Bancal (menu plein écran, ouverture) habillé du thème du Wix : fonds violets en diagonale,
titres Amatic SC, étiquettes dégradées, boutons roses, étoiles. Les spectacles sont des
sections pleine largeur comme sur le Wix. Les seules animations sont des pantins articulés
inventés (pantins.js) qui font du cirque quand la page défile. La page Des pâtes au seum
reprend le dossier de création (papier clair, encre noire, traits de pinceau).

    python3 build.py   -> dossier dist/ (le site à mettre en ligne)

Les textes et données sont dans content.py, le design dans style.css.
Photos, vidéos et PDF : servis depuis le site (voir medias.py à la racine de site/).
"""
import html, os, re, shutil, sys, datetime

TODAY = datetime.date.today().isoformat()
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))  # dossier site/ : content.py et logo.svg communs
sys.path.insert(0, ROOT)
from content import SITE, SHOWS, ARTISTS, HISTORY, COMMITTEE, COLLABS, SUPPORTERS, PARTNER_LOGOS, REDIRECTS
from medias import photo, video
import importlib.util
_spec = importlib.util.spec_from_file_location("wix_build", os.path.join(ROOT, "versions", "wix", "build.py"))
WIX = importlib.util.module_from_spec(_spec); _spec.loader.exec_module(WIX)  # la section « La Petite Fille » est celle du Wix
DIST = os.path.join(HERE, "dist")
E = html.escape
FONTS = "https://fonts.googleapis.com/css2?family=Barlow:ital,wght@0,300;0,400;0,500;1,300&family=Bodoni+Moda:ital,opsz,wght@0,6..96,400;0,6..96,600;1,6..96,400&family=IBM+Plex+Mono:wght@400&family=Inria+Serif:ital,wght@0,300;0,400;0,700;1,400&family=Amatic+SC:wght@400;700&family=Inknut+Antiqua:wght@400&display=swap"

# Logo vectoriel, inséré dans la page pour que chaque lettre puisse pencher
_LOGO = open(os.path.join(ROOT, "logo.svg")).read()
LOGO_SVG = re.sub(r'fill="#[0-9A-Fa-f]+"', 'fill="currentColor" role="img" aria-label="Compagnie Origami"', _LOGO, count=1)


def img(mid, w=1400):
    return photo(mid, w)


def pic(mid, alt, w=1400, eager=False):
    return f'<img src="{img(mid, w)}" alt="{E(alt)}" loading="{"eager" if eager else "lazy"}" decoding="async">'


def href(slug):
    return "index.html" if slug in ("", "index") else f"{slug}.html"


SHOW_BY_SLUG = {s["slug"]: s for s in SHOWS}
# Ordre des spectacles sur l'accueil et étiquette affichée sous le titre
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
TILTS = ["-3deg", "2deg", "-1.5deg", "3deg", "-2.5deg"]
SHIFT = ["0", "8%", "3%", "12%", "5%"]


def wob(tag, inner, f=1, cls="", attrs=""):
    """Élément qui tangue selon la vitesse de défilement."""
    c = f' class="wob {cls}"' if cls else ' class="wob"'
    return f'<{tag}{c} style="--f:{f}"{attrs}>{inner}</{tag}>'


# ---------------------------------------------------------------- pantins articulés (pantins.js)
# numéros : mono (monocycle), jongle, porte (main à main), cannes (équilibre), salto

def perso(kind, w, cls=""):
    return f'<span class="pantin {cls}" data-p="{kind}" style="width:{w}px" aria-hidden="true"></span>'


STAR = '<span class="star" aria-hidden="true"><svg viewBox="0 0 40 40"><path d="M20 0C21 12 28 19 40 20C28 21 21 28 20 40C19 28 12 21 0 20C12 19 19 12 20 0Z"/></svg></span>'


def piste(kind, w=170, cls=""):
    """Une piste en diagonale (bande violette comme sur le Wix) que le personnage remonte en défilant."""
    return f'<div class="piste {cls}" aria-hidden="true"><span class="pente"></span>{STAR if cls != "encre" else ""}{perso(kind, w, "roule")}</div>'


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
<meta name="theme-color" content="#050407">
<link rel="icon" href="favicon.svg" type="image/svg+xml">
<script>try{{if(sessionStorage.getItem("origami-vu"))document.documentElement.classList.add("seen")}}catch(e){{}}</script>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="{FONTS}"><link rel="stylesheet" href="style.css"><link rel="stylesheet" href="wx.css"></head><body>"""


def header(active):
    cur = ' aria-current="page"'
    links = "".join(
        f'<a href="{href(k)}" style="--a:{TILTS[i]};--i:{i};margin-left:{SHIFT[i]}"{cur if k == active else ""}>{v}</a>'
        for i, (k, v) in enumerate(MENU))
    shows = "".join(f'<li><a href="{href(s["slug"])}">{E(s["title"])}</a></li>' for s in SHOWS if s["status"] != "Répertoire")
    return f"""<div class="loader" aria-hidden="true"><div class="arrive">{perso("mono", 190)}</div><img class="lg" src="logo.svg" alt=""><span class="strip"></span></div>
<a class="sr" href="#contenu">Aller au contenu</a>
<header class="top"><a class="logo wob-logo" href="index.html">{LOGO_SVG}</a>
<button class="open-menu" type="button" aria-expanded="false" aria-controls="menu">Menu</button></header>
<div class="menu" id="menu" role="dialog" aria-modal="true" aria-label="Menu"><span class="flap" aria-hidden="true"></span>
<button class="close" type="button">Fermer</button>
<div class="menu-in"><nav class="main-links" aria-label="Rubriques">{links}</nav>
<div class="side"><div><h2>Les spectacles</h2><ul>{shows}</ul></div>
<div><h2>Nous écrire</h2><ul><li><a href="mailto:{SITE['email']}">{SITE['email']}</a></li><li><a href="{SITE['instagram']}" rel="noopener">Instagram</a> · <a href="{SITE['facebook']}" rel="noopener">Facebook</a></li></ul></div></div>
</div></div><div id="contenu"></div>"""


def footer():
    nav = "".join(f'<a href="{href(k)}">{v}</a>' for k, v in MENU)
    return f"""<footer class="foot"><div class="in"><nav aria-label="Pied de page">{nav}</nav>
<div><a href="{SITE['instagram']}" rel="noopener">Instagram</a> · <a href="{SITE['facebook']}" rel="noopener">Facebook</a><br><small>© {datetime.date.today().year} Compagnie Origami · Genève</small></div></div></footer>"""


# ---------------------------------------------------------------- blocs

def show_block(s, i, tag_text=None, h="h2"):
    """Comme sur le Wix : une section pleine largeur, des diagonales, le titre au-dessus d'un trait, la photo bord à bord."""
    r = " r" if i % 2 else ""
    meta = tag_text or " · ".join(x for x in (s["genre"], s["venue"], s["duration"]) if x)
    u = href(s["slug"])
    return f"""<section class="sh{r}"><div class="sh-head"><{h} class="sh-t"><a href="{u}">{E(s['title'])}</a></{h}></div><span class="sh-line" aria-hidden="true"></span>
<div class="sh-body"><div class="sh-txt"><span class="tag">{E(meta)}</span><p class="sh-by">{E(s['by'])}</p><p class="teaser">{E(s['teaser'])}</p>
<a class="pill" href="{u}">en savoir plus</a></div><a class="sh-pic" href="{u}" tabindex="-1">{pic(s['card'], s['title'], 1400)}</a></div></section>"""


NUMEROS = [("mono", 150), ("salto", 120), ("jongle", 130), ("cannes", 90), ("porte", 100)]


def wix_block(slug):
    """La section d'un spectacle telle qu'elle est sur le Wix (bandeau titre, bloc, grande photo, galerie)."""
    B = next(b for b in WIX.BLOCKS if b["slug"] == slug)
    sh = SHOW_BY_SLUG[slug]
    dv = WIX.dv
    out = f'<section class="h-title" style="--sh:{B["title_h"]}"><span class="h-title-bg" aria-hidden="true"></span>{"".join(dv(*t) for t in B["title_dv"])}<div class="stage"><h2><a href="{href(slug)}">{E(sh["title"])}</a></h2></div></section>'
    side = "".join(f'<div class="h-img" style="--x:{x};--w:{w}">{WIX.media(m, sh["title"], 900)}</div>' for m, x, w in (B["left"], B["right"]) if m)
    tag = f'<span class="h-tag" style="--x:{B["tag"][0]};--w:{B["tag"][1]}">{E(B["tag"][2])}</span>' if B["tag"] else ""
    pill = ""
    if B["pill"]:
        px, pw, pl, ph = B["pill"]
        pill = f'<a class="h-pill" href="{ph}" style="--dx:{px - B["tx"]};--w:{pw}">{E(pl)}</a>'
    paras = "".join(f"<p>{p}</p>" for p in B["paras"])
    out += f"""<section class="h-block" style="--sh:{B['h']}"><span class="h-block-bg" aria-hidden="true"></span>{"".join(dv(*t) for t in B["dvs"])}<div class="stage">{side}{tag}
<div class="h-txt" style="--x:{B['tx']};--w:{B['tw']};--y:{B['ty']}"><h3 style="--fs:{B['subsize']}">{E(B['sub'])}</h3><p class="h-by">{E(B['by'])}</p>{paras}{pill}</div></div></section>"""
    wm, wh, wdv = B["wide"]
    out += f'<section class="h-wide" style="--sh:{wh}"><div class="h-wide-img">{WIX.media(wm, sh["title"], 1920)}</div>{"".join(dv(*t) for t in wdv)}</section>'
    if B["gal"]:
        gh, gids, gx, gb = B["gal"]
        out += f"""<section class="h-gal" style="--sh:{gh}"><span class="h-gal-bg" aria-hidden="true"></span>{dv("tl", "#000000", 20, 1)}{dv("br", "#000000", gb, 1)}
<div class="h-gal-wrap"><button class="g-arrow prev" type="button" aria-label="Photos précédentes">‹</button><div class="h-gal-track" style="--gx:{gx}">{WIX.gal_track(gids, sh['title'])}</div><button class="g-arrow next" type="button" aria-label="Photos suivantes">›</button></div></section>"""
    return f'<div class="wx">{out}</div>'


def show_list(items):
    """Les spectacles, séparés par une étoile et un pantin qui traverse sa piste."""
    out = ""
    for i, (s, tag) in enumerate(items):
        out += wix_block(s["slug"]) if s["slug"] == "la-petite-fille-dans-la-poubelle" else show_block(s, i, tag)
        if i < len(items) - 1:
            out += piste(*NUMEROS[i % len(NUMEROS)])
    return out


def all_dates():
    rows = [(iso, label, place, s) for s in SHOWS for iso, label, place in s["dates"]]
    rows.sort(key=lambda r: r[0], reverse=True)
    return rows


def upcoming():
    return [r for r in all_dates() if r[0] >= TODAY][::-1]


def date_card(iso, label, place, s=None):
    title = f'<b><a href="{href(s["slug"])}">{E(s["title"])}</a></b>' if s else ""
    # data-iso : le script masque une date passée même si le site n'a pas été reconstruit
    return f'<li class="d" data-iso="{iso}"><time class="when" datetime="{iso}">{E(label)}</time><span class="where">{title}{E(place)}</span></li>'


def date_line(iso, label, place, s=None):
    title = f' · <a href="{href(s["slug"])}">{E(s["title"])}</a>' if s else ""
    return f'<li><time class="when" datetime="{iso}">{E(label)}</time><span>{E(place)}{title}</span></li>'


def dates_list(rows, empty="De nouvelles dates arrivent bientôt."):
    items = "".join(date_card(*r) for r in rows)
    return f'<ul class="dates">{items}</ul><p class="empty"{" hidden" if rows else ""}>{E(empty)}</p>'


def newsletter():
    return f"""<section class="nl" aria-labelledby="nl-t"><div class="big shake" id="nl-t">Newsletter</div>
<p>De temps en temps, des nouvelles de nos créations et nos prochaines dates. Pas tous les deux jours, promis.</p>
<form name="newsletter" method="POST" data-netlify="true" netlify-honeypot="bot-field">
<input type="hidden" name="form-name" value="newsletter"><p hidden><label>Ne pas remplir <input name="bot-field"></label></p>
<label class="sr" for="nl-mail">Ton adresse e-mail</label><input id="nl-mail" type="email" name="email" placeholder="ton adresse e-mail" required autocomplete="email">
<button class="btn" type="submit">S'abonner</button></form></section>"""


# ---------------------------------------------------------------- pages

def page_index():
    shows = show_list([(SHOW_BY_SLUG[sl], HOME_TAG.get(sl)) for sl in HOME_ORDER])
    nxt = upcoming()[:4]
    return f"""<main>
<section class="hero"><div class="hero-p">{perso("porte", 150)}</div>{wob("h1", "Bienvenue dans l'univers<br>de la cie <i>Origami</i>", 1)}
<div class="intro wob" style="--f:.4"><p>Depuis 2018, la Cie Origami tisse des spectacles aux formes multiples, nés d'une passion commune : celle de créer, de raconter, de surprendre.</p>
<p>Chaque projet réunit des artistes de cirque aux univers singuliers, pour donner vie à des œuvres tantôt drôles, tantôt poétiques, toujours sensibles. La compagnie s'adresse à tous les publics (petits, grands ou avertis) avec le désir d'offrir des instants forts et partagés.</p></div></section>
<section aria-label="Spectacles">{shows}</section>
<section class="next">{wob("h2", "Prochaines <i>dates</i>", .9, "sec-h")}{dates_list(nxt)}
<p class="all"><a class="go" href="agenda.html">Tout l'agenda <span aria-hidden="true">→</span></a></p></section>
<section class="cie-band"><div><blockquote>Nous sommes nulle part et partout à la fois, autant dans la bêtise que dans la poésie. Nous sommes le problème et la solution à la fois !</blockquote>
<a class="go" href="quisommesnous.html">Qui sommes-nous <span aria-hidden="true">→</span></a></div></section>
{newsletter()}</main>"""


def page_spectacles():
    current = [s for s in SHOWS if s["status"] != "Répertoire"]
    archive = [s for s in SHOWS if s["status"] == "Répertoire"]
    blocks = show_list([(s, f"{s['status']} · {s['genre']}") for s in current])
    rep = "".join(f"""<a href="{href(s['slug'])}"><div class="pic">{pic(s['card'], s['title'], 800)}</div><h3>{E(s['title'])}</h3><p>{E(s['teaser'])}</p></a>""" for s in archive)
    return f"""<main><section class="ph-title">{wob("h1", "Spec<i>tacles</i>", 1)}
<p class="intro">Cirque-théâtre, cabaret de rue, solos intimistes et créations en cours. En rue et en salle, pour tous les publics.</p></section>
{blocks}
{piste("salto", 110)}
<section class="wrap" style="margin-top:40px">{wob("h2", "Le <i>répertoire</i>", .9, "sec-h")}</section><div class="rep">{rep}</div></main>"""


def coins(inner, cls=""):
    """Bloc encadré par les traits de pinceau du dossier (un coin en haut à droite, un en bas à gauche)."""
    return f'<div class="marques {cls}"><span class="cm a" aria-hidden="true"></span><span class="cm b" aria-hidden="true"></span>{inner}</div>'


def page_seum(s):
    """Des pâtes au seum : la page reprend le dossier de création (papier, encre, pinceau)."""
    d = s["dossier"]
    ph = d["photos"]
    body = "".join(f"<p>{p}</p>" for p in s["body"])
    etapes = "".join(f"<li><b>{E(t)}</b><span>{E(x)}</span></li>" for t, x in d["etapes"])
    duo = "".join(f"<p>{E(p)}</p>" for p in d["duo"])
    gal_ids = [ph[0], ph[4], ph[5], ph[7], ph[8], ph[9], ph[10]] + s["gallery"]
    gal = "".join(f'<button type="button" data-full="{img(g, 1800)}">{pic(g, s["title"] + " – photo " + str(i + 1), 700)}</button>' for i, g in enumerate(gal_ids))
    links = "".join(f'<a class="btn" href="{u}" rel="noopener">{E(l)}</a>' for l, u in s["links"]) or '<a class="btn" href="contact.html">Dossier sur demande</a>'
    up = [x for x in s["dates"] if x[0] >= TODAY][::-1]
    return f"""<main class="papier">
<section class="sm-cover"><div class="sm-l"><a class="back" href="spectacles.html">← Spectacles</a>
<h1 class="sm-titre"><span class="sr">{E(s['title'])}</span><img src="dessins/seum-titre.png" alt="" width="1288" height="451"></h1>
<img class="oursin" src="dessins/seum-oursin.png" alt="" width="522" height="460">
<p class="sm-status">{E(s['status'])}</p></div>
<div class="sm-r"><p class="spaced">La compagnie Origami présente</p><p class="spaced big">Des pâtes au seum</p>
<p class="spaced">Un projet de création par Ella Beerli et Sévane Gurunlian</p>
{coins(pic(ph[1], s['title'], 1400, eager=True), "sm-photo")}</div></section>
<section class="sm-split"><div class="sm-ph">{pic(ph[3], s['title'] + " – portés", 1100)}</div>
<div class="sm-txt">{coins('<h2 class="contour">Intention</h2>' + body)}</div></section>
<section class="sm-split r"><div class="sm-txt">{coins('<h2 class="contour">Premières étapes</h2><ol class="etapes">' + etapes + '</ol>')}</div>
<div class="sm-ph">{pic(ph[2], s['title'] + " – équilibre", 1100)}</div></section>
<section class="sm-duo"><h2 class="contour">Le duo</h2><div class="sm-duo-in">{coins('<p class="enbref">En bref !</p>' + duo)}
<div class="sm-wide">{pic(ph[6], "Ella Beerli et Sévane Gurunlian", 1400)}</div></div></section>
{piste("mono", 120, "encre")}
<section aria-label="Photos"><h2 class="contour sm-h">Photos</h2><div class="gal sm-gal">{gal}</div></section>
<section class="s-info"><div><h2>Équipe</h2><p>{E(s['credits'])}</p></div>
<div><h2>Pour accueillir ce spectacle</h2><div class="links">{links}</div><p style="margin-top:16px"><a href="mailto:{SITE['email']}">{SITE['email']}</a> · {SITE['phone']}</p></div></section>
<section class="s-dates"><h2 class="contour sm-h">Dates</h2>{dates_list(up, "Pas de nouvelle date annoncée pour le moment.")}</section></main>"""


def page_show(s):
    if s.get("dossier"):
        return page_seum(s)
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
        dates = f'<section class="s-dates">{wob("h2", "Dates", .9, "sec-h")}{dates_list(up, "Pas de nouvelle date annoncée pour le moment.")}{p}</section>'
    return f"""<main>
<section class="s-hero">{pic(s['hero'], s['title'], 2000, eager=True)}<span class="band" aria-hidden="true"></span><div class="wrap">
<a class="back" href="spectacles.html">← Spectacles</a><br><span class="status">{E(s['status'])}</span>
{wob("h1", E(s['title']), 1)}{sub}<p class="by">{E(s['by'])}</p><p class="meta mono">{E(meta)}</p></div></section>
<section class="s-body"><div class="txt">{body}</div></section>{quote}{video}{gal}
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
    return f"""<main><section class="ph-title">{wob("h1", "Agen<i>da</i>", 1)}
<p class="intro">Toutes les dates de tous nos spectacles. Depuis 2021, en Suisse, en France et jusqu'en Argentine.</p></section>
<section class="ag">{wob("h2", "À <i>venir</i>", .9, "sec-h")}{dates_list(up)}</section>
<section class="ag">{wob("h2", "Déjà <i>joué</i>", .9, "sec-h")}{past_html}</section></main>"""


def page_qui():
    com = "".join(f"<li>{E(r)} : {E(n)}</li>" for r, n in COMMITTEE)
    artists = "".join(f"""<section class="artist{' r' if i % 2 else ''}"><div class="portrait">{pic(a['photo'], a['name'], 900)}</div>
<div>{wob("h2", E(a['name']), 1.2)}<p class="role mono">{E(a['role'])}</p><p>{a['bio']}</p></div></section>""" for i, a in enumerate(ARTISTS))
    hist = ""
    for y, t, sub, l in HISTORY:
        more = (" · " + E(sub)) if sub else ""
        link = f' <a href="{href(l)}">voir →</a>' if l else ""
        hist += f'<li><span class="y">{y}</span><span>{t}{more}{link}</span></li>'
    return f"""<main><section class="ph-title">{wob("h1", "Qui sommes-<i>nous</i>", 1)}
<p class="intro">Nous sommes nulle part et partout à la fois, autant dans la bêtise que dans la poésie. Autant dans un vaisseau spatial que sur terre, à porter le monde en équilibre sur un bras. Nous sommes le problème et la solution à la fois ! Nous sommes… nous sommes…</p></section>
<section class="cie"><div class="txt"><p>La Cie Origami est une compagnie de cirque contemporain née en 2018, animée par une envie de liberté artistique et de partager ses créations avec le plus grand nombre. Depuis ses débuts, la compagnie intervient autant en salle, sous chapiteau qu'en rue…</p>
<p><strong>Vous faites des origamis ?</strong> Non, on crée des spectacles. C'est presque pareil, hein ! Parce que, comme l'art du pliage de papier, la création d'un spectacle transforme des idées simples en formes surprenantes. Chaque spectacle est pour nous un pliage, une construction minutieuse qui prend vie sur scène.</p>
<p>Implantée en Suisse, la Cie Origami est structurée en association pour offrir un cadre administratif à ses projets artistiques.</p></div>
<aside><h2>Comité de l'association</h2><ul>{com}</ul></aside></section>
{artists}
<section class="wrap" style="padding-block:50px 30px">{wob("h2", "His<i>torique</i>", .9, "sec-h")}<ol class="hist">{hist}</ol></section></main>"""


def page_collabs():
    # mise en page reprise de la page Collaborations du Wix : un groupe, ses noms sur deux colonnes, un personnage à côté
    # les vrais dessins, fixes (comme sur le Wix) ; un pantin pour le dernier groupe
    figs = [f'<img class="cdessin" src="{img(m, 500)}" alt="" loading="lazy">' for m in PARTNER_LOGOS] + [perso("jongle", 110)]
    groups = ""
    for gi, (title, items) in enumerate(COLLABS):
        li = "".join(f"""<li><h3>{('<a href="' + u + '" rel="noopener">' + E(n) + '</a>') if u else E(n)}</h3><p>{E(t)}</p></li>""" for n, u, t in items)
        groups += f'<div class="cgroup">{wob("h2", E(title), .8)}<div class="cg-in"><ul class="clist">{li}</ul><div class="cfig">{figs[gi % len(figs)]}</div></div></div>'
    crew = "".join(f"<li><strong>{E(s['title'])}</strong><span>{E(s['credits'])}</span></li>" for s in SHOWS)
    sup = "".join(f'<li><a href="{u}" rel="noopener">{E(n)}</a></li>' for n, u in SUPPORTERS)
    return f"""<main><section class="c-head"><div class="c-frame">{wob("h1", "Collabo<i>rations</i>", 1)}
<p class="intro">Nous tenons à remercier ici un maximum de personnes et d'organisations qui rendent nos projets possibles, nos amis qui partagent nos aventures artistiques, et les petites mains qui apportent leur magie, déplacent du matériel, montent les décors et rendent nos projets vivants.</p></div></section>
<section class="col">{wob("h2", "Merci <i>à vous :</i>", .9, "sec-h")}{groups}</section>
<section class="sup"><div>{wob("h2", "Nous ont <i>soutenus</i>", .9, "sec-h")}<ul>{sup}</ul></div></section>
<section class="col">{wob("h2", "Des artistes lors des <i>spectacles et créations</i>", .9, "sec-h")}<ul class="crew">{crew}</ul></section></main>"""


def page_contact():
    addr = "<br>".join(E(a) for a in SITE["address"])
    opts = "".join(f"<option>{E(s['title'])}</option>" for s in SHOWS if s["status"] != "Répertoire")
    return f"""<main><section class="ph-title">{wob("h1", "Nous <i>écrire</i>", 1)}
<p class="intro">Pour accueillir un spectacle, demander un dossier ou simplement dire bonjour.</p></section>
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
    return f"""<main><section class="ph-title">{wob("h1", "Ou<i>ps</i> !", 1)}
<p class="intro">Cette page s'est dépliée ailleurs. Elle a peut-être changé d'adresse avec le nouveau site.</p>
<p style="margin:30px 0 0 6%"><a class="btn" href="index.html">Retour à l'accueil</a></p></section></main>"""


SCRIPT = """<div class="lightbox" hidden><button class="lb-close" type="button">Fermer</button><button class="lb-prev" type="button" aria-label="Photo précédente">←</button><img alt=""><button class="lb-next" type="button" aria-label="Photo suivante">→</button></div>
<script>
(function(){
 var reduce=matchMedia("(prefers-reduced-motion: reduce)").matches,root=document.documentElement;

 /* ouverture : le pantin arrive sur son monocycle, puis le logo se déplie ; une fois par visite */
 var loader=document.querySelector(".loader");
 if(!root.classList.contains("seen")){setTimeout(function(){loader.classList.add("done");try{sessionStorage.setItem("origami-vu","1")}catch(e){}},reduce?150:3000);}

 /* menu plein écran : la feuille se déplie, puis se replie */
 var menu=document.getElementById("menu"),btn=document.querySelector(".open-menu"),closeB=menu.querySelector(".close");
 function openMenu(){menu.classList.remove("closing");menu.classList.add("open");document.body.classList.add("menu-on");btn.setAttribute("aria-expanded","true");closeB.focus();}
 function closeMenu(){if(!menu.classList.contains("open"))return;menu.classList.remove("open");btn.setAttribute("aria-expanded","false");document.body.classList.remove("menu-on");
  if(reduce){btn.focus();return;}menu.classList.add("closing");setTimeout(function(){menu.classList.remove("closing")},400);btn.focus();}
 btn.addEventListener("click",openMenu);closeB.addEventListener("click",closeMenu);
 menu.addEventListener("keydown",function(e){if(e.key!=="Tab")return;var f=menu.querySelectorAll("a,button"),a=f[0],z=f[f.length-1];
  if(e.shiftKey&&document.activeElement===a){e.preventDefault();z.focus()}else if(!e.shiftKey&&document.activeElement===z){e.preventDefault();a.focus()}});

 /* dates passées : masquées même si le site n'a pas été reconstruit */
 var d=new Date(),today=d.getFullYear()+"-"+("0"+(d.getMonth()+1)).slice(-2)+"-"+("0"+d.getDate()).slice(-2);
 document.querySelectorAll("ul.dates").forEach(function(ul){var n=0;ul.querySelectorAll(".d[data-iso]").forEach(function(li){if(li.dataset.iso<today)li.remove();else n++});
  var em=ul.nextElementSibling;if(em&&em.classList.contains("empty"))em.hidden=n>0;});

 /* logo bancal : un angle par lettre */
 var logoPaths=[].slice.call(document.querySelectorAll(".wob-logo svg path"));
 logoPaths.forEach(function(p,i){var r=(Math.sin(i*12.9898)*43758.5453)%1;p.style.setProperty("--r",(r*4).toFixed(1));p.style.setProperty("--y",(r*2).toFixed(1));p.style.setProperty("--k",(.6+Math.abs(r)*1.4).toFixed(2));});

 /* tangage selon la vitesse de défilement */
 var wobs=[].slice.call(document.querySelectorAll(".wob"));
 wobs.forEach(function(w,i){w.style.setProperty("--rot",((i%2?1:-1)*(.6+(i%3)*.4)).toFixed(2))});
 var letters=[];
 document.querySelectorAll(".shake").forEach(function(w){w.setAttribute("aria-label",w.textContent);w.innerHTML=w.textContent.split("").map(function(c){return '<span aria-hidden="true">'+c+'</span>'}).join("");letters=letters.concat([].slice.call(w.children));});
 if(!reduce){
  var last=scrollY,v=0,sk=0,running=false;
  function tick(){var st=scrollY;v=v*.8+(st-last)*.2;last=st;
   sk+=(Math.max(-12,Math.min(12,v*.5))-sk)*.15;var s=sk.toFixed(2);
   wobs.forEach(function(w){w.style.setProperty("--sk",s)});
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
  var gi=e.target.closest(".g-item");if(gi){set=[].slice.call(gi.closest(".h-gal-track").querySelectorAll(".g-item"));show(set.indexOf(gi));lb.hidden=false;lb.querySelector(".lb-close").focus();return;}
  var ga=e.target.closest(".g-arrow");if(ga){var t=ga.parentElement.querySelector(".h-gal-track");t.scrollBy({left:(ga.classList.contains("next")?1:-1)*t.clientWidth*.7,behavior:"smooth"});return;}
  if(e.target===lb||e.target.closest(".lb-close")){lb.hidden=true;li.src="";if(set[cur])set[cur].focus();}
  if(e.target.closest(".lb-prev"))show(cur-1);if(e.target.closest(".lb-next"))show(cur+1);
  var c=e.target.closest(".copy");if(c&&navigator.clipboard){navigator.clipboard.writeText(c.dataset.copy).then(function(){c.textContent="Copié !";setTimeout(function(){c.textContent="Copier"},1800)},function(){})}
 });
 document.addEventListener("keydown",function(e){
  if(e.key==="Escape"){if(!lb.hidden){lb.hidden=true;li.src="";}else closeMenu();}
  if(!lb.hidden&&e.key==="ArrowLeft")show(cur-1);if(!lb.hidden&&e.key==="ArrowRight")show(cur+1);
 });
})();
</script><script src="pantins.js" defer></script>"""


# ---------------------------------------------------------------- page d'essais (cachée : pas dans le menu ni dans le plan du site)

ESSAIS = [  # (pantin, titre, d'après quoi)
    ("mono", "Monocycle", "Inventé"),
    ("jongle", "Jongleur", "Inventé · rattrape ses balles à la pause"),
    ("porte", "Main à main", "Inventé"),
    ("cannes", "Équilibre sur cannes", "Inventé"),
    ("salto", "Salto", "Inventé"),
    ("video1", "Main à main", "D'après ta vidéo du 19 octobre : appui, montée en équilibre, équilibre bras tendus, le porteur descend et marche, descente devant, salut"),
    ("colonne", "Colonne à trois qui marche", "D'après ta photo du 19 octobre"),
    ("video2", "Lancer en main à main", "D'après ta 2e vidéo : face à face, flexion, lancer direct en équilibre, tenue, puis assise sur les épaules"),
    ("pirouette", "Pirouettes en monocycle", "D'après ta 3e vidéo (jusqu'à 17 s) : arrivée, bras ouverts, tours de plus en plus rapides, sortie"),
    ("monocolonne", "Colonne à deux en monocycle", "Première version qui roule, en attendant ta photo"),
    ("pirouette2", "Pirouettes lentes", "D'après ta 4e vidéo : il tourne sur place, bras pliés devant lui, un bras s'ouvre par moments"),
]


def page_essais():
    cards = "".join(
        f"""<article class="es-card"><div class="es-scene">{perso(k, 230).replace('<span class="pantin ', '<span data-horloge class="pantin ', 1)}</div>
<h2>{E(t)}</h2><p class="es-src">{E(src)}</p>
<div class="es-ctl"><button type="button" class="es-pause">Pause</button>
<label>Vitesse <select class="es-vit"><option value=".25">× 0,25</option><option value=".5">× 0,5</option><option value="1" selected>× 1</option><option value="2">× 2</option></select></label></div></article>"""
        for k, t, src in ESSAIS)
    return f"""<main class="essais"><section class="ph-title"><h1>Essais <i>d'animation</i></h1></section>
<section class="es-intro"><p>Ici, je teste les pantins avant de les mettre sur le site. Envoie une vidéo courte d'un numéro dans le fil de discussion : j'en tire les poses et l'essai apparaît sur cette page, à côté des pantins inventés.</p>
<p class="es-note">Page cachée : elle n'est ni dans le menu ni dans Google.</p></section>
<section class="es-grid">{cards}</section></main>
<script>
document.addEventListener("click",function(e){{var b=e.target.closest(".es-pause");if(!b)return;var p=b.closest(".es-card").querySelector(".pantin");
if(p.hasAttribute("data-pause")){{p.removeAttribute("data-pause");b.textContent="Pause";}}else{{p.setAttribute("data-pause","");b.textContent="Lecture";}}if(window.pantinsKick)pantinsKick();}});
document.addEventListener("change",function(e){{if(!e.target.classList.contains("es-vit"))return;e.target.closest(".es-card").querySelector(".pantin").dataset.vitesse=e.target.value;}});
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
    shutil.copytree(os.path.join(HERE, "dessins"), os.path.join(DIST, "dessins"))
    shutil.copy(os.path.join(HERE, "pantins.js"), DIST)
    sys.path.insert(0, HERE)
    import wixcss
    with open(os.path.join(DIST, "wx.css"), "w", encoding="utf-8") as f:
        f.write(wixcss.scoped(os.path.join(ROOT, "versions", "wix", "style.css")))
    with open(os.path.join(DIST, "favicon.svg"), "w") as f:
        f.write('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><rect width="40" height="40" rx="6" fill="#281467"/><path d="M8 32 20 6l12 26z" fill="#9781FF" transform="rotate(-6 20 20)"/></svg>')
    for slug, title, desc, fn, og in pages():
        path = "" if slug == "index" else slug
        with open(os.path.join(DIST, f"{slug}.html"), "w") as f:
            f.write(head(title, desc, path, og) + header(active_for(slug)) + fn() + footer() + SCRIPT + "</body></html>")
    with open(os.path.join(DIST, "404.html"), "w") as f:
        f.write(head("Page introuvable", "", "404") + header("") + page_404() + footer() + SCRIPT + "</body></html>")
    with open(os.path.join(DIST, "_redirects"), "w") as f:
        f.write("\n".join(f"{a}  {b}  301" for a, b in REDIRECTS.items()) + "\n")
    with open(os.path.join(DIST, "essais.html"), "w") as f:
        f.write(head("Essais d'animation", "", "essais").replace("<head>", '<head><meta name="robots" content="noindex">', 1) + header("") + page_essais() + footer() + SCRIPT + "</body></html>")
    urls = "".join(f"<url><loc>{SITE['url']}/{'' if s == 'index' else s}</loc></url>" for s, *_ in pages())
    with open(os.path.join(DIST, "sitemap.xml"), "w") as f:
        f.write(f'<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">{urls}</urlset>')
    with open(os.path.join(DIST, "robots.txt"), "w") as f:
        f.write(f"User-agent: *\nAllow: /\nSitemap: {SITE['url']}/sitemap.xml\n")
    print("site:", len(os.listdir(DIST)), "fichiers")


if __name__ == "__main__":
    build()
