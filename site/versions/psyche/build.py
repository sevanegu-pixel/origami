# -*- coding: utf-8 -*-
"""Génère le site statique de la Cie Origami (direction « Psyché », octobre 2026).

    python3 build.py   -> dossier dist/ (le site à mettre en ligne)

Inspiration : le site de Johann Le Guillerm. Le texte est au centre ; certains mots
sont des liens colorés qui, au survol (ou au premier toucher sur téléphone), font
apparaître la photo cachée du spectacle, ondulée par un filtre SVG. Au clic : la page.

Les textes et données sont dans content.py, le design dans style.css.
Photos : IMG_MODE = "wix" utilise les photos hébergées chez Wix (temporaire).
"""
import html, os, re, shutil, sys, datetime, random

IMG_MODE = "wix"
TODAY = datetime.date.today().isoformat()
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, ROOT)
from content import SITE, SHOWS, ARTISTS, HISTORY, COMMITTEE, COLLABS, SUPPORTERS, REDIRECTS, PAPER
DIST = os.path.join(HERE, "dist")
E = html.escape
FONTS = "https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,400;1,9..144,300;1,9..144,400&family=Barlow:wght@300;400;500&family=IBM+Plex+Mono:wght@400&display=swap"

_LOGO = open(os.path.join(ROOT, "logo.svg")).read()
LOGO_SVG = re.sub(r'fill="#[0-9A-Fa-f]+"', 'fill="currentColor" role="img" aria-label="Compagnie Origami"', _LOGO, count=1)


def _loader_logo():
    """Logo de l'ouverture : chaque lettre part d'un endroit au hasard."""
    rnd = random.Random(11)
    KS = ["#9781FF", "#D8436F", "#E9A91E", "#2FB3A0", "#6F8FE0", "#E0662B"]
    svg = re.sub(r'fill="#[0-9A-Fa-f]+"', 'fill="currentColor" aria-hidden="true"', _LOGO, count=1)

    def one(m):
        x, y = rnd.uniform(-420, 420), rnd.uniform(-260, 260)
        r, d = rnd.uniform(-160, 160), rnd.uniform(0, .35)
        k = rnd.choice(KS)
        return f'<path style="--x:{x:.0f}px;--y:{y:.0f}px;--r:{r:.0f}deg;--d:{d:.2f}s;--k:{k}"'
    return re.sub(r"<path", one, svg)


LOADER_SVG = _loader_logo()


def img(mid, w=1400):
    if IMG_MODE == "local":
        return "images/" + mid.replace("~", "_")
    return f"https://static.wixstatic.com/media/{mid}/v1/fit/w_{w},h_{w},q_85,enc_auto/{mid}"


def pic(mid, alt, w=1400, eager=False):
    return f'<img src="{img(mid, w)}" alt="{E(alt)}" loading="{"eager" if eager else "lazy"}" decoding="async">'


def href(slug):
    return "index.html" if slug in ("", "index") else f"{slug}.html"


SHOW_BY_SLUG = {s["slug"]: s for s in SHOWS}
LAV = "#9781FF"


def color(s):
    """Couleur « papier » propre au spectacle (l'encre, trop sombre sur la nuit, devient lavande)."""
    c = PAPER.get(s.get("paper"), LAV)
    return LAV if s.get("paper") == "encre" else c


def w(link, label, photo=None, c=LAV, cap=""):
    """Mot-lien coloré : au survol, il révèle une photo cachée."""
    data = f' data-img="{img(photo, 900)}"' if photo else ""
    capt = f' data-t="{E(cap)}"' if cap else ""
    return f'<a class="w" href="{link}" style="--c:{c}"{data}{capt}>{label}</a>'


def sw(slug, label=None):
    s = SHOW_BY_SLUG[slug]
    return w(href(slug), label or f"<i>{E(s['title'])}</i>", s["card"], color(s), s["title"])


def wave(tag, text, cls="", accent=0, attrs=""):
    """Titre découpé en lettres : elles ondulent et tremblent au défilement."""
    words = text.split(" ")
    out, n = [], 0
    for wi, wd in enumerate(words):
        letters = "".join(f'<span class="l" style="--i:{n + k}">{E(ch)}</span>' for k, ch in enumerate(wd))
        n += len(wd) + 1
        ac = " ac" if accent and wi >= len(words) - accent else ""
        out.append(f'<span class="wd{ac}" aria-hidden="true">{letters}</span>')
    c = f"shake {cls}".strip()
    return f'<{tag} class="{c}"{attrs}><span class="sr">{E(text)}</span>{" ".join(out)}</{tag}>'


MENU = [("spectacles", "Spectacles"), ("agenda", "Agenda"), ("quisommesnous", "Compagnie"), ("collabs", "Collaborations"), ("contact", "Contact")]
MENU_IMG = {"spectacles": SHOW_BY_SLUG["la-petite-fille-dans-la-poubelle"]["card"], "agenda": SHOW_BY_SLUG["edmd"]["card"],
            "quisommesnous": SITE["og_image"], "collabs": SHOW_BY_SLUG["caborigamique"]["card"], "contact": SHOW_BY_SLUG["commeunpoint"]["card"]}
MENU_COL = {"spectacles": PAPER["rose"], "agenda": PAPER["jaune"], "quisommesnous": LAV, "collabs": PAPER["orange"], "contact": PAPER["vert"]}


# ---------------------------------------------------------------- gabarit

FX = """<svg id="fx" width="0" height="0" aria-hidden="true" focusable="false">
<filter id="psy" x="-20%" y="-20%" width="140%" height="140%" color-interpolation-filters="sRGB">
<feTurbulence type="fractalNoise" baseFrequency="0.009 0.014" numOctaves="2" seed="4" result="n"><animate attributeName="baseFrequency" dur="8s" values="0.009 0.014;0.015 0.007;0.007 0.012;0.009 0.014" repeatCount="indefinite"/></feTurbulence>
<feDisplacementMap in="SourceGraphic" in2="n" scale="46" xChannelSelector="R" yChannelSelector="G" result="d"/>
<feColorMatrix in="d" type="matrix" values="1 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1 0" result="r"/>
<feOffset in="r" dx="8" dy="-3" result="ro"/>
<feColorMatrix in="d" type="matrix" values="0 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 1 0" result="gb"/>
<feOffset in="gb" dx="-6" dy="3" result="gbo"/>
<feBlend in="ro" in2="gbo" mode="screen"/></filter>
<filter id="soft" x="-8%" y="-8%" width="116%" height="116%"><feTurbulence type="fractalNoise" baseFrequency="0.006 0.011" numOctaves="2" seed="9" result="n"/>
<feDisplacementMap in="SourceGraphic" in2="n" scale="26" xChannelSelector="R" yChannelSelector="G"/></filter>
<filter id="ouv" x="-30%" y="-60%" width="160%" height="220%"><feTurbulence id="ouv-t" type="fractalNoise" baseFrequency="0.02 0.05" numOctaves="2" seed="5" result="n"/>
<feDisplacementMap id="ouv-d" in="SourceGraphic" in2="n" scale="0" xChannelSelector="R" yChannelSelector="G"/></filter></svg>"""


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
<meta name="theme-color" content="#07060c">
<link rel="icon" href="favicon.svg" type="image/svg+xml">
<script>try{{if(sessionStorage.getItem("origami-vu"))document.documentElement.classList.add("seen")}}catch(e){{}}</script>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="{FONTS}"><link rel="stylesheet" href="style.css"></head><body>"""


def menu_word(i, k, v, active):
    cur = ' aria-current="page"' if k == active else ""
    letters = "".join(f'<span class="l" style="--i:{j}">{E(ch)}</span>' for j, ch in enumerate(v))
    return (f'<a class="w mw" href="{href(k)}" style="--c:{MENU_COL[k]};--n:{i}" data-img="{img(MENU_IMG[k], 900)}" data-t="{E(v)}"{cur}>'
            f'<span class="sr">{E(v)}</span><span aria-hidden="true">{letters}</span></a>')


def header(active):
    links = "".join(menu_word(i, k, v, active) for i, (k, v) in enumerate(MENU))
    shows = " · ".join(sw(s["slug"]) for s in SHOWS if s["status"] != "Répertoire")
    return f"""{FX}<div class="loader" aria-hidden="true"><span class="halo"></span><div class="lg">{LOADER_SVG}</div></div>
<a class="sr" href="#contenu">Aller au contenu</a>
<div class="vision" aria-hidden="true"><div class="orb"><img alt=""></div><span class="cap"></span></div>
<header class="top"><a class="logo" href="index.html">{LOGO_SVG}</a>
<button class="open-menu" type="button" aria-expanded="false" aria-controls="menu">Menu</button></header>
<div class="menu" id="menu" role="dialog" aria-modal="true" aria-label="Menu">
<button class="close" type="button">Fermer</button>
<div class="menu-in"><nav class="main-links" aria-label="Rubriques"><a class="w mw home" href="index.html" style="--c:#fff;--n:0">Accueil</a>{links}</nav>
<p class="m-shows">{shows}</p>
<p class="m-mail"><a href="mailto:{SITE['email']}">{SITE['email']}</a> · <a href="{SITE['instagram']}" rel="noopener">Instagram</a> · <a href="{SITE['facebook']}" rel="noopener">Facebook</a></p>
</div></div><div id="contenu"></div>"""


def footer():
    nav = " · ".join(f'<a href="{href(k)}">{v}</a>' for k, v in MENU)
    return f"""<footer class="foot"><svg class="squig" viewBox="0 0 600 24" preserveAspectRatio="none" aria-hidden="true"><path d="M0 12 C 50 -4, 100 28, 150 12 S 250 -4, 300 12 S 400 28, 450 12 S 550 -4, 600 12"/></svg>
<nav aria-label="Pied de page">{nav}</nav>
<p><a href="mailto:{SITE['email']}">{SITE['email']}</a><br><a href="{SITE['instagram']}" rel="noopener">Instagram</a> · <a href="{SITE['facebook']}" rel="noopener">Facebook</a></p>
<small>© {datetime.date.today().year} Compagnie Origami · Genève</small></footer>"""


# ---------------------------------------------------------------- blocs

def all_dates():
    rows = [(iso, label, place, s) for s in SHOWS for iso, label, place in s["dates"]]
    rows.sort(key=lambda r: r[0], reverse=True)
    return rows


def upcoming():
    return [r for r in all_dates() if r[0] >= TODAY][::-1]


def date_card(iso, label, place, s=None):
    title = f'<b>{sw(s["slug"], E(s["title"]))}</b>' if s else ""
    return f'<li class="d" data-iso="{iso}"><time class="when" datetime="{iso}">{E(label)}</time><span class="where">{title}{E(place)}</span></li>'


def date_line(iso, label, place, s=None):
    title = f' · {sw(s["slug"], E(s["title"]))}' if s else ""
    return f'<li><time class="when" datetime="{iso}">{E(label)}</time><span>{E(place)}{title}</span></li>'


def dates_list(rows, empty="De nouvelles dates arrivent bientôt."):
    items = "".join(date_card(*r) for r in rows)
    return f'<ul class="dates">{items}</ul><p class="empty"{" hidden" if rows else ""}>{E(empty)}</p>'


def newsletter():
    return f"""<section class="nl" aria-labelledby="nl-t">{wave("h2", "Newsletter", "sec-h", attrs=' id="nl-t"')}
<p>De temps en temps, des nouvelles de nos créations et nos prochaines dates. Pas tous les deux jours, promis.</p>
<form name="newsletter" method="POST" data-netlify="true" netlify-honeypot="bot-field">
<input type="hidden" name="form-name" value="newsletter"><p hidden><label>Ne pas remplir <input name="bot-field"></label></p>
<label class="sr" for="nl-mail">Ton adresse e-mail</label><input id="nl-mail" type="email" name="email" placeholder="ton adresse e-mail" required autocomplete="email">
<button class="btn" type="submit">S'abonner</button></form></section>"""


def others(slug):
    rest = [s for s in SHOWS if s["slug"] != slug and s["status"] != "Répertoire"]
    return f'<section class="others"><p>Et aussi : {", ".join(sw(s["slug"]) for s in rest)}.</p></section>'


# ---------------------------------------------------------------- pages

def page_index():
    nxt = upcoming()[:4]
    qui = w("quisommesnous.html", "qui sommes-nous ?", SITE["og_image"], LAV, "Qui sommes-nous")
    ag = w("agenda.html", "agenda", SHOW_BY_SLUG["la-petite-fille-dans-la-poubelle"]["hero"], PAPER["jaune"], "Agenda")
    ecr = w("contact.html", "écrivez-nous", SHOW_BY_SLUG["commeunpoint"]["hero"], PAPER["rose"], "Contact")
    return f"""<main>
<section class="tale">
<h1 class="sr">Compagnie Origami, cirque contemporain à Genève</h1>
<p>Depuis 2018, la Cie Origami tisse des spectacles aux formes multiples, nés d'une passion commune : celle de créer, de raconter, de surprendre.</p>
<p>Il y a {sw("commeunpoint")}, où deux copines devenues artistes de cirque racontent, autour d'un café, la réalité de leur rêve. Il y a {sw("la-petite-fille-dans-la-poubelle")}, l'histoire de Chiffon et Célestine, contée façon cirque&nbsp;: clownesque et punk. Il y a {sw("caborigamique")}, un souffle de cirque, un grain de folie. Il y a {sw("edmd")}, où une équilibriste se confie sur ses doutes, ses choix et sa discipline d'enfance.</p>
<p>En l'an 2250, Claude livre des colis pour la poste intergalactique. Seul. C'est {sw("oups-vache")}, en création. Et bientôt {sw("des-pates-au-seum")}&nbsp;: la flemme, le retard, l'arrêt.</p>
<p>Chaque projet réunit des artistes de cirque aux univers singuliers ({qui}), pour des œuvres tantôt drôles, tantôt poétiques, toujours sensibles, en rue comme en salle, pour les petits, les grands et les avertis.</p>
<p class="small">Les prochaines dates sont dans l'{ag}. Pour accueillir un spectacle ou dire bonjour, {ecr}.</p>
</section>
<section class="next">{wave("h2", "Prochaines dates", "sec-h", 1)}{dates_list(nxt)}
<p class="all"><a class="go" href="agenda.html">Tout l'agenda</a></p></section>
<section class="big-quote"><blockquote>Nous sommes nulle part et partout à la fois, autant dans la bêtise que dans la poésie. Nous sommes le problème et la solution à la fois&nbsp;!</blockquote></section>
{newsletter()}</main>"""


def show_title(s, small=False):
    meta = f"{s['status']} · {s['genre']}" if not small else s["genre"]
    return (f'<li class="st{" sm" if small else ""}">{w(href(s["slug"]), E(s["title"]), s["card"], color(s), s["title"])}'
            f'<span class="meta mono">{E(meta)}</span><p>{E(s["teaser"])}</p></li>')


def page_spectacles():
    current = [s for s in SHOWS if s["status"] != "Répertoire"]
    archive = [s for s in SHOWS if s["status"] == "Répertoire"]
    return f"""<main><section class="ph-title">{wave("h1", "Spectacles")}
<p class="intro">Cirque-théâtre, cabaret de rue, solos intimistes et créations en cours. En rue et en salle, pour tous les publics.</p></section>
<ul class="titles">{"".join(show_title(s) for s in current)}</ul>
<section class="ph-title">{wave("h2", "Le répertoire", "sec-h", 1)}</section>
<ul class="titles">{"".join(show_title(s, True) for s in archive)}</ul></main>"""


def page_show(s):
    body = "".join(f"<p>{p}</p>" for p in s["body"])
    meta = " · ".join(x for x in (s["genre"], s["duration"], s["public"], s["venue"]) if x)
    sub = f'<p class="sub">{E(s["subtitle"])}</p>' if s.get("subtitle") else ""
    quote = f'<section class="big-quote"><blockquote>{E(s["quote"])}</blockquote></section>' if s["quote"] else ""
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
        dates = f'<section class="s-dates">{wave("h2", "Dates", "sec-h")}{dates_list(up, "Pas de nouvelle date annoncée pour le moment.")}{p}</section>'
    return f"""<main style="--c:{color(s)}">
<section class="s-head"><a class="back" href="spectacles.html">← Spectacles</a><span class="status">{E(s['status'])}</span>
{wave("h1", s['title'], "s-t")}{sub}<p class="by">{E(s['by'])}</p><p class="meta mono">{E(meta)}</p></section>
<div class="s-pic"><div class="blob">{pic(s['hero'], s['title'], 1800, eager=True)}</div></div>
<section class="s-body"><div class="txt">{body}</div></section>{quote}{video}{gal}
<section class="s-info"><div><h2>Équipe</h2><p>{E(s['credits'])}</p></div>
<div><h2>Pour accueillir ce spectacle</h2><div class="links">{links}</div><p><a href="mailto:{SITE['email']}">{SITE['email']}</a> · {SITE['phone']}</p></div></section>
{dates}{others(s['slug'])}</main>"""


def page_agenda():
    up = upcoming()
    past = [r for r in all_dates() if r[0] < TODAY]
    by_year = {}
    for r in past:
        by_year.setdefault(r[0][:4], []).append(r)
    past_html = "".join(f'<h3 class="year">{y}</h3><ul class="plain">{"".join(date_line(*r) for r in rows)}</ul>' for y, rows in by_year.items())
    return f"""<main><section class="ph-title">{wave("h1", "Agenda")}
<p class="intro">Toutes les dates de tous nos spectacles. Depuis 2021, en Suisse, en France et jusqu'en Argentine.</p></section>
<section class="ag">{wave("h2", "À venir", "sec-h", 1)}{dates_list(up)}</section>
<section class="ag">{wave("h2", "Déjà joué", "sec-h", 1)}{past_html}</section></main>"""


def page_qui():
    com = "".join(f"<li>{E(r)} : {E(n)}</li>" for r, n in COMMITTEE)
    artists = "".join(f"""<section class="artist"><div class="portrait b{i % 3}">{pic(a['photo'], a['name'], 900)}</div>
{wave("h2", a['name'], "a-n")}<p class="role mono">{E(a['role'])}</p><p class="bio">{a['bio']}</p></section>""" for i, a in enumerate(ARTISTS))
    hist = ""
    for y, t, sub, l in HISTORY:
        more = (" · " + E(sub)) if sub else ""
        txt = w(href(l), t, SHOW_BY_SLUG[l]["card"], color(SHOW_BY_SLUG[l]), SHOW_BY_SLUG[l]["title"]) if l else t
        hist += f'<li><span class="y">{y}</span><span>{txt}{more}</span></li>'
    sp = w("spectacles.html", "on crée des spectacles", SHOW_BY_SLUG["oups-vache"]["card"], PAPER["bleu"], "Spectacles")
    return f"""<main><section class="ph-title">{wave("h1", "Qui sommes-nous", "", 1)}
<p class="intro big">Nous sommes nulle part et partout à la fois, autant dans la bêtise que dans la poésie. Autant dans un vaisseau spatial que sur terre, à porter le monde en équilibre sur un bras. Nous sommes le problème et la solution à la fois ! Nous sommes… nous sommes…</p></section>
<section class="cie"><p>La Cie Origami est une compagnie de cirque contemporain née en 2018, animée par une envie de liberté artistique et de partager ses créations avec le plus grand nombre. Depuis ses débuts, la compagnie intervient autant en salle, sous chapiteau qu'en rue…</p>
<p><strong>Vous faites des origamis ?</strong> Non, {sp}. C'est presque pareil, hein ! Parce que, comme l'art du pliage de papier, la création d'un spectacle transforme des idées simples en formes surprenantes. Chaque spectacle est pour nous un pliage, une construction minutieuse qui prend vie sur scène.</p>
<p>Implantée en Suisse, la Cie Origami est structurée en association pour offrir un cadre administratif à ses projets artistiques.</p>
<div class="comite"><h2 class="mono">Comité de l'association</h2><ul>{com}</ul></div></section>
{artists}
<section class="hist-s">{wave("h2", "Historique", "sec-h")}<ol class="hist">{hist}</ol></section></main>"""


def page_collabs():
    groups = ""
    for title, items in COLLABS:
        li = "".join(f"""<li><h3>{('<a href="' + u + '" rel="noopener">' + E(n) + '</a>') if u else E(n)}</h3><p>{E(t)}</p></li>""" for n, u, t in items)
        groups += f'<div class="cgroup"><h2>{E(title)}</h2><ul class="clist">{li}</ul></div>'
    crew = "".join(f"<li>{sw(s['slug'], E(s['title']))}<span>{E(s['credits'])}</span></li>" for s in SHOWS)
    sup = "".join(f'<li><a href="{u}" rel="noopener">{E(n)}</a></li>' for n, u in SUPPORTERS)
    return f"""<main><section class="ph-title">{wave("h1", "Merci à vous", "", 2)}
<p class="intro">Merci à toutes les personnes et organisations qui rendent nos projets possibles, aux amis qui partagent nos aventures, et aux petites mains qui déplacent du matériel, montent les décors et rendent nos projets vivants.</p></section>
<section class="col">{groups}</section>
<section class="sup">{wave("h2", "Nous ont soutenus", "sec-h", 1)}<ul>{sup}</ul></section>
<section class="col">{wave("h2", "Les artistes des créations", "sec-h", 2)}<ul class="crew">{crew}</ul></section></main>"""


def page_contact():
    addr = "<br>".join(E(a) for a in SITE["address"])
    opts = "".join(f"<option>{E(s['title'])}</option>" for s in SHOWS if s["status"] != "Répertoire")
    return f"""<main><section class="ph-title">{wave("h1", "Nous écrire", "", 1)}
<p class="intro">Pour accueillir un spectacle, demander un dossier ou simplement dire bonjour.</p></section>
<section class="contact"><div class="coords">
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
    home = w("index.html", "l'accueil", SITE["og_image"], LAV, "Accueil")
    return f"""<main><section class="ph-title">{wave("h1", "Oups !", "", 1)}
<p class="intro big">Cette page s'est dépliée ailleurs. Elle a peut-être changé d'adresse avec le nouveau site. Retour à {home}.</p></section></main>"""


SCRIPT = """<div class="lightbox" hidden><button class="lb-close" type="button">Fermer</button><button class="lb-prev" type="button" aria-label="Photo précédente">←</button><img alt=""><button class="lb-next" type="button" aria-label="Photo suivante">→</button></div>
<script>
(function(){
 var reduce=matchMedia("(prefers-reduced-motion: reduce)").matches,root=document.documentElement,fx=document.getElementById("fx");
 if(reduce&&fx&&fx.pauseAnimations)fx.pauseAnimations();

 /* ouverture : les lettres flottent puis se rassemblent, l'ondulation s'apaise */
 var loader=document.querySelector(".loader");
 if(!root.classList.contains("seen")){
  var od=document.getElementById("ouv-d"),ot=document.getElementById("ouv-t"),t0=performance.now(),D=1750;
  if(!reduce){(function f(now){var t=Math.min(1,Math.max(0,(now-t0)/D)),e=1-t;e=e*e;
    od.setAttribute("scale",(90*e).toFixed(1));ot.setAttribute("baseFrequency",(0.006+0.02*e).toFixed(4)+" "+(0.012+0.05*e).toFixed(4));
    if(t<1)requestAnimationFrame(f)})(t0);}
  setTimeout(function(){loader.classList.add("done");try{sessionStorage.setItem("origami-vu","1")}catch(e){}},reduce?150:1900);
 }

 /* vision : la photo cachée derrière un mot-lien */
 var vis=document.querySelector(".vision"),orb=vis.querySelector(".orb"),vimg=vis.querySelector("img"),vcap=vis.querySelector(".cap"),
     touch=matchMedia("(hover: none)").matches,lit=null,armed=null;
 function showV(a){if(!a.dataset.img)return;if(lit&&lit!==a)lit.classList.remove("lit");lit=a;a.classList.add("lit");
  var c=getComputedStyle(a).getPropertyValue("--c").trim()||"#9781ff";vis.style.setProperty("--c",c);
  if(vimg.getAttribute("src")!==a.dataset.img)vimg.src=a.dataset.img;
  vcap.textContent=touch?"Toucher encore pour ouvrir →":(a.dataset.t||"");
  var r=a.getClientRects()[0]||a.getBoundingClientRect(),W=innerWidth,H=innerHeight,S=Math.min(W*.84,H*.62,560),
      x=r.left+r.width/2,y=r.top+r.height/2+(touch?S*.25:0);
  x=Math.max(S/2+6,Math.min(W-S/2-6,x));y=Math.max(S/2+70,Math.min(H-S/2-40,y));
  vis.style.setProperty("--x",x+"px");vis.style.setProperty("--y",y+"px");vis.style.setProperty("--s",S+"px");
  vis.classList.add("on");document.body.classList.add("seeing");}
 function hideV(){vis.classList.remove("on");document.body.classList.remove("seeing");if(lit){lit.classList.remove("lit");lit=null}armed=null;}
 document.addEventListener("pointerover",function(e){if(e.pointerType==="touch")return;var a=e.target.closest(".w");if(a)showV(a)});
 document.addEventListener("pointerout",function(e){if(e.pointerType==="touch")return;var a=e.target.closest(".w");if(a&&!a.contains(e.relatedTarget))hideV()});
 document.addEventListener("focusin",function(e){var a=e.target.closest&&e.target.closest(".w");if(a&&!touch)showV(a)});
 document.addEventListener("focusout",function(e){if(e.target.closest&&e.target.closest(".w"))hideV()});
 addEventListener("scroll",function(){if(lit)hideV()},{passive:true});

 /* menu plein écran */
 var menu=document.getElementById("menu"),btn=document.querySelector(".open-menu"),closeB=menu.querySelector(".close");
 function openMenu(){hideV();menu.insertBefore(vis,menu.firstChild);menu.classList.remove("closing");menu.classList.add("open");document.body.classList.add("menu-on");btn.setAttribute("aria-expanded","true");closeB.focus();}
 function closeMenu(){if(!menu.classList.contains("open"))return;hideV();document.body.insertBefore(vis,document.body.firstChild);menu.classList.remove("open");btn.setAttribute("aria-expanded","false");document.body.classList.remove("menu-on");
  if(reduce){btn.focus();return;}menu.classList.add("closing");setTimeout(function(){menu.classList.remove("closing")},450);btn.focus();}
 btn.addEventListener("click",openMenu);closeB.addEventListener("click",closeMenu);
 menu.addEventListener("keydown",function(e){if(e.key!=="Tab")return;var f=menu.querySelectorAll("a,button"),a=f[0],z=f[f.length-1];
  if(e.shiftKey&&document.activeElement===a){e.preventDefault();z.focus()}else if(!e.shiftKey&&document.activeElement===z){e.preventDefault();a.focus()}});

 /* dates passées : masquées même si le site n'a pas été reconstruit */
 var d=new Date(),today=d.getFullYear()+"-"+("0"+(d.getMonth()+1)).slice(-2)+"-"+("0"+d.getDate()).slice(-2);
 document.querySelectorAll("ul.dates").forEach(function(ul){var n=0;ul.querySelectorAll(".d[data-iso]").forEach(function(li){if(li.dataset.iso<today)li.remove();else n++});
  var em=ul.nextElementSibling;if(em&&em.classList.contains("empty"))em.hidden=n>0;});

 /* lettres qui ondulent et tremblent selon la vitesse de défilement */
 var letters=[].slice.call(document.querySelectorAll(".shake .l"));
 var logoPaths=[].slice.call(document.querySelectorAll(".top .logo svg path"));
 if(!reduce){
  var last=scrollY,v=0,running=false;
  function tick(){var st=scrollY;v=v*.82+(st-last)*.18;last=st;
   var a=Math.min(9,Math.abs(v)*.5),on=a>.15;
   letters.forEach(function(l,i){l.style.transform=on?"translateY("+(Math.sin(i*.7+st*.02)*a).toFixed(1)+"px) rotate("+(Math.sin(i*2.3+st*.03)*a*.8).toFixed(1)+"deg)":""});
   logoPaths.forEach(function(p,i){p.style.transform=on?"translateY("+(Math.sin(i*.9+st*.03)*a*.35).toFixed(1)+"px)":""});
   if(Math.abs(v)>.05)requestAnimationFrame(tick);else{running=false;letters.forEach(function(l){l.style.transform=""});logoPaths.forEach(function(p){p.style.transform=""})}}
  addEventListener("scroll",function(){if(!running){running=true;requestAnimationFrame(tick)}},{passive:true});
 }

 /* visionneuse photo */
 var lb=document.querySelector(".lightbox"),li=lb.querySelector("img"),set=[],cur=0;
 function show(i){cur=(i+set.length)%set.length;li.src=set[cur].dataset.full;li.alt=set[cur].querySelector("img").alt;}
 document.addEventListener("click",function(e){
  var a=e.target.closest(".w");
  if(a&&touch&&a.dataset.img&&armed!==a){e.preventDefault();showV(a);armed=a;return;}
  if(!a&&armed&&!e.target.closest(".vision"))hideV();
  if(e.target.closest(".vision")&&armed){location.href=armed.href;return;}
  var g=e.target.closest(".gal button");if(g){set=[].slice.call(g.parentElement.children);show(set.indexOf(g));lb.hidden=false;lb.querySelector(".lb-close").focus();return;}
  if(e.target===lb||e.target.closest(".lb-close")){lb.hidden=true;li.src="";if(set[cur])set[cur].focus();}
  if(e.target.closest(".lb-prev"))show(cur-1);if(e.target.closest(".lb-next"))show(cur+1);
  var c=e.target.closest(".copy");if(c&&navigator.clipboard){navigator.clipboard.writeText(c.dataset.copy).then(function(){c.textContent="Copié !";setTimeout(function(){c.textContent="Copier"},1800)},function(){})}
 });
 document.addEventListener("keydown",function(e){
  if(e.key==="Escape"){if(!lb.hidden){lb.hidden=true;li.src="";}else if(lit)hideV();else closeMenu();}
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
        f.write('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><rect width="40" height="40" rx="12" fill="#281467"/>'
                '<path d="M7 22c4-9 9 7 13-2s9 7 13-2" fill="none" stroke="#9781FF" stroke-width="4" stroke-linecap="round"/>'
                '<circle cx="20" cy="11" r="3" fill="#D8436F"/><circle cx="12" cy="30" r="2.4" fill="#E9A91E"/><circle cx="29" cy="30" r="2.4" fill="#1F7A6D"/></svg>')
    for slug, title, desc, fn, og in pages():
        path = "" if slug == "index" else slug
        cls = ' class="home-page"' if slug == "index" else ""
        with open(os.path.join(DIST, f"{slug}.html"), "w") as f:
            f.write((head(title, desc, path, og) + header(active_for(slug)) + fn() + footer() + SCRIPT + "</body></html>").replace("<body>", f"<body{cls}>", 1))
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
