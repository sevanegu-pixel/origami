# -*- coding: utf-8 -*-
"""Génère le site statique de la Cie Origami (direction « Art contemporain », octobre 2026).

    python3 build.py   -> dossier dist/ (le site à mettre en ligne)

Esprit galerie / centre d'art : beaucoup de noir, très grande typographie,
grille asymétrique, spectacles numérotés et légendés comme des œuvres (cartels).
Les textes et données sont dans content.py (commun), le design dans style.css.
Photos : IMG_MODE = "wix" utilise les photos hébergées chez Wix (temporaire).
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
FONTS = "https://fonts.googleapis.com/css2?family=Inter+Tight:ital,wght@0,300;0,400;0,500;0,600;1,300&family=Instrument+Serif:ital@0;1&display=swap"

_LOGO = open(os.path.join(ROOT, "logo.svg")).read()
LOGO_SVG = re.sub(r'fill="#[0-9A-Fa-f]+"', 'fill="currentColor" role="img" aria-label="Compagnie Origami"', _LOGO, count=1)


def img(mid, w=1400):
    if IMG_MODE == "local":
        return "images/" + mid.replace("~", "_")
    return f"https://static.wixstatic.com/media/{mid}/v1/fit/w_{w},h_{w},q_85,enc_auto/{mid}"


def pic(mid, alt, w=1400, eager=False):
    return f'<img src="{img(mid, w)}" alt="{E(alt)}" loading="{"eager" if eager else "lazy"}" decoding="async">'


def href(slug):
    return "index.html" if slug in ("", "index") else f"{slug}.html"


SHOW_BY_SLUG = {s["slug"]: s for s in SHOWS}
NUM = {s["slug"]: f"{i + 1:02d}" for i, s in enumerate(SHOWS)}  # numéro d'inventaire de chaque spectacle
HIST_YEAR = {l: y for y, t, sub, l in HISTORY if l}


def year_of(s):
    m = re.search(r"(20\d\d)", s["status"])
    if m:
        return m.group(1)
    if s["slug"] in HIST_YEAR:
        return HIST_YEAR[s["slug"]]
    if s["dates"]:
        return min(d[0] for d in s["dates"])[:4]
    return ""


HOME_ORDER = ["commeunpoint", "la-petite-fille-dans-la-poubelle", "caborigamique", "edmd", "oups-vache", "des-pates-au-seum"]
MENU = [("spectacles", "Spectacles"), ("agenda", "Agenda"), ("quisommesnous", "Compagnie"), ("collabs", "Collaborations"), ("contact", "Contact")]


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
<meta name="theme-color" content="#000000">
<link rel="icon" href="favicon.svg" type="image/svg+xml">
<script>document.documentElement.classList.add("js");try{{if(sessionStorage.getItem("origami-vu"))document.documentElement.classList.add("seen")}}catch(e){{}}</script>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="{FONTS}"><link rel="stylesheet" href="style.css"></head><body>"""


def header(active):
    cur = ' aria-current="page"'
    nav = "".join(f'<a href="{href(k)}"{cur if k == active else ""}>{v}</a>' for k, v in MENU)
    big = "".join(
        f'<li style="--i:{i}"><a href="{href(k)}"{cur if k == active else ""}><span class="n">{i + 1:02d}</span>{v}</a></li>'
        for i, (k, v) in enumerate(MENU))
    return f"""<div class="loader" aria-hidden="true"><div class="ld-in"><span class="ld-logo"><span>{LOGO_SVG}</span></span><span class="ld-rule"></span>
<p class="ld-cap"><span class="no">N° 00</span><span><i>Compagnie Origami</i>, depuis 2018</span><span>Cirque contemporain · Genève</span></p></div></div>
<a class="sr" href="#contenu">Aller au contenu</a>
<header class="top"><a class="logo" href="index.html">{LOGO_SVG}</a>
<nav class="nav" aria-label="Rubriques">{nav}</nav>
<button class="open-menu" type="button" aria-expanded="false" aria-controls="menu">Menu</button></header>
<div class="menu" id="menu" role="dialog" aria-modal="true" aria-label="Menu">
<div class="menu-top"><a class="logo" href="index.html" tabindex="-1" aria-hidden="true">{LOGO_SVG}</a><button class="close" type="button">Fermer</button></div>
<ol class="menu-links">{big}</ol>
<p class="menu-foot"><a href="mailto:{SITE['email']}">{SITE['email']}</a><br><a href="{SITE['instagram']}" rel="noopener">Instagram</a> · <a href="{SITE['facebook']}" rel="noopener">Facebook</a></p>
</div><div id="contenu"></div>"""


def footer():
    nav = "".join(f'<a href="{href(k)}">{v}</a>' for k, v in MENU)
    addr = "<br>".join(E(a) for a in SITE["address"])
    return f"""<footer class="foot"><div class="g">
<p class="f-mail"><a href="mailto:{SITE['email']}">{SITE['email']}</a></p>
<nav class="f-nav" aria-label="Pied de page">{nav}</nav>
<p class="f-addr">{addr}</p>
<p class="f-soc"><a href="{SITE['instagram']}" rel="noopener">Instagram</a><br><a href="{SITE['facebook']}" rel="noopener">Facebook</a><br><a href="tel:{SITE['phone'].replace(' ', '')}">{SITE['phone']}</a></p>
<p class="f-copy">© {datetime.date.today().year} Compagnie Origami · Cirque contemporain · Genève</p></div></footer>"""


# ---------------------------------------------------------------- blocs

def lines(*parts, cls="hl"):
    """Titre géant découpé en lignes qui montent derrière un masque."""
    inner = "".join(f'<span class="ln"><span style="--d:{i}">{p}</span></span>' for i, p in enumerate(parts))
    return inner


def cartel(s, title=True, cls=""):
    yr = year_of(s)
    t = f'<p class="ct"><i>{E(s["title"])}</i>{(", " + yr) if yr else ""}</p>' if title else ""
    tech = " · ".join(x for x in (s["duration"], s["venue"], s["public"]) if x)
    return (f'<div class="cartel{(" " + cls) if cls else ""}"><span class="no">N° {NUM[s["slug"]]}</span>{t}'
            f'<p>{E(s["genre"])}</p>{("<p>" + E(tech) + "</p>") if tech else ""}<p class="by">{E(s["by"])}</p></div>')


def work(s, cls, w=1300):
    """Un spectacle présenté comme une œuvre : grande photo + cartel."""
    return f"""<a class="work rv {cls}" href="{href(s['slug'])}"><figure class="ph">{pic(s['card'], s['title'], w)}</figure>
{cartel(s)}<span class="status">{E(s['status'])}</span></a>"""


def index_list(shows, heading="h3"):
    rows = ""
    for s in shows:
        yr = year_of(s)
        rows += (f'<li class="rv"><a href="{href(s["slug"])}" data-img="{img(s["card"], 700)}">'
                 f'<span class="i-no">{NUM[s["slug"]]}</span><{heading} class="i-t">{E(s["title"])}</{heading}>'
                 f'<span class="i-g">{E(s["genre"])}</span><span class="i-y">{yr or "—"}</span>'
                 f'<span class="i-th" aria-hidden="true">{pic(s["card"], "", 300)}</span></a></li>')
    return f'<ol class="index">{rows}</ol>'


def sec_head(label, title, extra=""):
    return f'<div class="sec-h rv"><span class="lab">{label}</span><h2>{title}</h2>{extra}</div>'


def all_dates():
    rows = [(iso, label, place, s) for s in SHOWS for iso, label, place in s["dates"]]
    rows.sort(key=lambda r: r[0], reverse=True)
    return rows


def upcoming():
    return [r for r in all_dates() if r[0] >= TODAY][::-1]


def date_card(iso, label, place, s=None):
    title = f'<a class="dt" href="{href(s["slug"])}"><span class="no">N° {NUM[s["slug"]]}</span> <i>{E(s["title"])}</i></a>' if s else '<span class="dt"></span>'
    return f'<li class="d" data-iso="{iso}"><time class="when" datetime="{iso}">{E(label)}</time>{title}<span class="where">{E(place)}</span></li>'


def date_line(iso, label, place, s=None):
    title = f'<a href="{href(s["slug"])}"><i>{E(s["title"])}</i></a>' if s else ""
    return f'<li><time datetime="{iso}">{E(label)}</time><span>{title}</span><span>{E(place)}</span></li>'


def dates_list(rows, empty="De nouvelles dates arrivent bientôt."):
    items = "".join(date_card(*r) for r in rows)
    return f'<ul class="dates">{items}</ul><p class="empty"{" hidden" if rows else ""}>{E(empty)}</p>'


def newsletter():
    return f"""<section class="nl g" aria-labelledby="nl-t"><span class="lab rv">Lettre</span><h2 class="nl-t rv" id="nl-t">Newsletter</h2>
<div class="nl-b rv"><p>De temps en temps, des nouvelles de nos créations et nos prochaines dates. Pas tous les deux jours, promis.</p>
<form name="newsletter" method="POST" data-netlify="true" netlify-honeypot="bot-field">
<input type="hidden" name="form-name" value="newsletter"><p hidden><label>Ne pas remplir <input name="bot-field"></label></p>
<label class="sr" for="nl-mail">Ton adresse e-mail</label><input id="nl-mail" type="email" name="email" placeholder="ton adresse e-mail" required autocomplete="email">
<button class="btn" type="submit">S'abonner <span aria-hidden="true">→</span></button></form></div></section>"""


def page_title(word, count=None, intro=""):
    sup = f'<sup>({count:02d})</sup>' if count is not None else ""
    it = f'<p class="intro rv">{intro}</p>' if intro else ""
    return f'<section class="ph-title"><h1 class="hl">{lines(word + sup)}</h1>{it}</section>'


# ---------------------------------------------------------------- pages

ALL_AG = '<a class="go" href="agenda.html">Tout l’agenda <span aria-hidden="true">→</span></a>'


def page_index():
    first = SHOW_BY_SLUG[HOME_ORDER[0]]
    rest = [SHOW_BY_SLUG[sl] for sl in HOME_ORDER[1:]]
    layout = ["w-a", "w-b", "w-c", "w-d tilt", "w-e"]
    works = "".join(work(s, layout[i % len(layout)], 1300) for i, s in enumerate(rest))
    nxt = upcoming()[:4]
    return f"""<main>
<section class="hero"><h1 class="hl hero-t">{lines("Cirque", "<em>contemporain</em>", "Genève")}</h1>
<p class="hero-meta"><span>Compagnie Origami</span><span>Depuis 2018</span><span>Rue &amp; salle · Tous publics</span></p></section>
<section class="feature g"><a class="ph rv" href="{href(first['slug'])}">{pic(first['hero'], first['title'], 2000, eager=True)}</a>
<div class="feat-c rv"><span class="tag">{E(first['status'])}</span>{cartel(first)}<a class="go" href="{href(first['slug'])}">Voir le spectacle <span aria-hidden="true">→</span></a></div></section>
<section class="about g"><span class="lab rv">La compagnie</span>
<p class="lead rv">Depuis 2018, la Cie Origami tisse des spectacles aux formes multiples, nés d'une passion commune : celle de créer, de raconter, de surprendre.</p>
<div class="about-b rv"><p>Chaque projet réunit des artistes de cirque aux univers singuliers, pour donner vie à des œuvres tantôt drôles, tantôt poétiques, toujours sensibles. La compagnie s'adresse à tous les publics (petits, grands ou avertis) avec le désir d'offrir des instants forts et partagés.</p>
<a class="go" href="quisommesnous.html">Qui sommes-nous <span aria-hidden="true">→</span></a></div></section>
<section class="works">{sec_head("Spectacles", "En ce moment")}<div class="g wg">{works}</div></section>
<section class="idx">{sec_head("Index", f"Tous les spectacles <sup>({len(SHOWS):02d})</sup>")}{index_list(SHOWS)}</section>
<section class="next">{sec_head("Agenda", "Prochaines dates", ALL_AG)}{dates_list(nxt)}</section>
<section class="big-q"><blockquote class="rv">Nous sommes nulle part et partout à la fois, autant dans la bêtise que dans la poésie. Nous sommes le problème et la solution à la fois !</blockquote></section>
{newsletter()}</main>"""


def page_spectacles():
    current = [s for s in SHOWS if s["status"] != "Répertoire"]
    archive = [s for s in SHOWS if s["status"] == "Répertoire"]
    layout = ["w-a", "w-b", "w-c", "w-d tilt", "w-e", "w-f"]
    works = "".join(work(s, layout[i % len(layout)], 1400) for i, s in enumerate(current))
    return f"""<main>{page_title("Spectacles", len(SHOWS), "Cirque-théâtre, cabaret de rue, solos intimistes et créations en cours. En rue et en salle, pour tous les publics.")}
<section class="works"><div class="g wg">{works}</div></section>
<section class="idx">{sec_head("Archives", "Le répertoire")}{index_list(archive)}</section>
<section class="idx">{sec_head("Index", "Liste complète")}{index_list(SHOWS)}</section></main>"""


def page_show(s):
    body = "".join(f"<p>{p}</p>" for p in s["body"])
    sub = f'<p class="sub">{E(s["subtitle"])}</p>' if s.get("subtitle") else ""
    qcls = "rv long" if s["quote"] and len(s["quote"]) > 160 else "rv"
    quote = f'<section class="big-q"><blockquote class="{qcls}">{E(s["quote"])}</blockquote></section>' if s["quote"] else ""
    links = "".join(f'<a class="btn" href="{u}" rel="noopener">{E(l)} <span aria-hidden="true">↗</span></a>' for l, u in s["links"]) or '<a class="btn" href="contact.html">Dossier sur demande <span aria-hidden="true">→</span></a>'
    video = ""
    if s.get("vimeo"):
        video = (f'<section class="s-video rv"><div class="vf"><iframe src="https://player.vimeo.com/video/{s["vimeo"]}?title=0&byline=0&portrait=0" '
                 f'title="{E(s["title"])} – vidéo" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen loading="lazy"></iframe></div></section>')
    gal = ""
    photos = [g for g in s["gallery"] if g not in (s["hero"],)]
    if len(photos) >= 2:
        items = "".join(f'<button type="button" class="rv" data-full="{img(g, 1800)}">{pic(g, s["title"] + " – photo " + str(i + 1), 1000)}<span class="cap">{NUM[s["slug"]]}.{i + 1}</span></button>' for i, g in enumerate(photos))
        gal = f'<section class="s-gal" aria-label="Photos">{sec_head("Images", f"Vues <sup>({len(photos):02d})</sup>")}<div class="gal">{items}</div></section>'
    elif photos:
        gal = f'<section class="s-one"><figure class="ph rv">{pic(photos[0], s["title"], 1600)}</figure></section>'
    dates = ""
    if s["dates"]:
        up = [d for d in s["dates"] if d[0] >= TODAY][::-1]
        past = [d for d in s["dates"] if d[0] < TODAY]
        p = f'<details class="past"><summary>Dates passées ({len(past)})</summary><ul class="plain">{"".join(date_line(*d) for d in past)}</ul></details>' if past else ""
        dates = f'<section class="s-dates">{sec_head("Agenda", "Dates")}{dates_list(up, "Pas de nouvelle date annoncée pour le moment.")}{p}</section>'
    rows = [("Genre", s["genre"]), ("Durée", s["duration"]), ("Public", s["public"]), ("Lieu", s["venue"]), ("Année", year_of(s))]
    spec = "".join(f"<div><dt>{k}</dt><dd>{E(v)}</dd></div>" for k, v in rows if v)
    i = SHOWS.index(s)
    prv, nxt = SHOWS[i - 1], SHOWS[(i + 1) % len(SHOWS)]
    return f"""<main>
<section class="s-head"><p class="s-no">N° {NUM[s['slug']]} <span>/ {len(SHOWS):02d}</span></p><span class="tag">{E(s['status'])}</span>
<h1 class="hl s-t">{lines(E(s['title']))}</h1>{sub}</section>
<figure class="s-hero ph rv">{pic(s['hero'], s['title'], 2000, eager=True)}</figure>
<section class="s-body g"><dl class="spec rv">{spec}</dl>
<div class="txt rv"><p class="by">{E(s['by'])}</p>{body}</div></section>{quote}{video}{gal}
<section class="s-info g"><div class="rv"><span class="lab">Distribution</span><p>{E(s['credits'])}</p></div>
<div class="rv"><span class="lab">Pour accueillir ce spectacle</span><div class="links">{links}</div><p class="ct-l"><a href="mailto:{SITE['email']}">{SITE['email']}</a><br>{SITE['phone']}</p></div></section>
{dates}
<nav class="pn" aria-label="Autres spectacles"><a href="{href(prv['slug'])}"><span class="lab">← N° {NUM[prv['slug']]}</span><i>{E(prv['title'])}</i></a><a href="{href(nxt['slug'])}"><span class="lab">N° {NUM[nxt['slug']]} →</span><i>{E(nxt['title'])}</i></a></nav></main>"""


def page_agenda():
    up = upcoming()
    past = [r for r in all_dates() if r[0] < TODAY]
    by_year = {}
    for r in past:
        by_year.setdefault(r[0][:4], []).append(r)
    past_html = "".join(f'<div class="yr g rv"><h3 class="year">{y}</h3><ul class="plain">{"".join(date_line(*r) for r in rows)}</ul></div>' for y, rows in by_year.items())
    return f"""<main>{page_title("Agenda", None, "Toutes les dates de tous nos spectacles. Depuis 2021, en Suisse, en France et jusqu'en Argentine.")}
<section class="next">{sec_head("À venir", "Prochaines dates")}{dates_list(up)}</section>
<section class="archive">{sec_head("Archives", f"Déjà joué <sup>({len(past)})</sup>")}{past_html}</section></main>"""


def page_qui():
    com = "".join(f"<li><span>{E(r)}</span>{E(n)}</li>" for r, n in COMMITTEE)
    artists = "".join(f"""<article class="artist g rv{' r' if i % 2 else ''}"><figure class="portrait ph">{pic(a['photo'], a['name'], 1000)}</figure>
<div class="a-txt"><span class="lab">Artiste · {i + 1:02d}</span><h3>{E(a['name'])}</h3><p class="role">{E(a['role'])}</p><p>{a['bio']}</p></div></article>""" for i, a in enumerate(ARTISTS))
    hist = ""
    for y, t, sub, l in HISTORY:
        more = f'<span class="h-sub">{E(sub)}</span>' if sub else ""
        no = f'<a href="{href(l)}">N° {NUM[l]} →</a>' if l else ""
        hist += f'<li class="rv"><span class="y">{y}</span><span class="h-t">{t}{more}</span><span class="h-l">{no}</span></li>'
    return f"""<main>{page_title("Compagnie", None)}
<section class="about g"><span class="lab rv">Manifeste</span>
<p class="lead rv">Nous sommes nulle part et partout à la fois, autant dans la bêtise que dans la poésie. Autant dans un vaisseau spatial que sur terre, à porter le monde en équilibre sur un bras. Nous sommes le problème et la solution à la fois ! Nous sommes… nous sommes…</p></section>
<section class="cie g"><div class="txt rv"><p>La Cie Origami est une compagnie de cirque contemporain née en 2018, animée par une envie de liberté artistique et de partager ses créations avec le plus grand nombre. Depuis ses débuts, la compagnie intervient autant en salle, sous chapiteau qu'en rue…</p>
<p><strong>Vous faites des origamis ?</strong> Non, on crée des spectacles. C'est presque pareil, hein ! Parce que, comme l'art du pliage de papier, la création d'un spectacle transforme des idées simples en formes surprenantes. Chaque spectacle est pour nous un pliage, une construction minutieuse qui prend vie sur scène.</p>
<p>Implantée en Suisse, la Cie Origami est structurée en association pour offrir un cadre administratif à ses projets artistiques.</p></div>
<aside class="rv"><span class="lab">Comité de l'association</span><ul class="com">{com}</ul></aside></section>
<section class="artists">{sec_head("Artistes", "Les artistes")}{artists}</section>
<section class="hist-s">{sec_head("Chronologie", "Historique")}<ol class="hist">{hist}</ol></section></main>"""


def page_collabs():
    groups = ""
    for i, (title, items) in enumerate(COLLABS):
        li = "".join(f"""<li><h3>{('<a href="' + u + '" rel="noopener">' + E(n) + ' <span aria-hidden="true">↗</span></a>') if u else E(n)}</h3><p>{E(t)}</p></li>""" for n, u, t in items)
        groups += f'<div class="cgroup g rv"><span class="lab">{i + 1:02d}</span><h2>{E(title)}</h2><ul class="clist">{li}</ul></div>'
    crew = "".join(f'<li class="rv"><span class="no">N° {NUM[s["slug"]]}</span><i>{E(s["title"])}</i><span>{E(s["credits"])}</span></li>' for s in SHOWS)
    sup = "".join(f'<li><a href="{u}" rel="noopener">{E(n)} <span aria-hidden="true">↗</span></a></li>' for n, u in SUPPORTERS)
    return f"""<main>{page_title("Merci", None, "Merci à toutes les personnes et organisations qui rendent nos projets possibles, aux amis qui partagent nos aventures, et aux petites mains qui déplacent du matériel, montent les décors et rendent nos projets vivants.")}
<section class="col">{groups}</section>
<section class="sup">{sec_head("Soutiens", "Nous ont soutenus")}<ul class="sup-l rv">{sup}</ul></section>
<section class="crew-s">{sec_head("Distribution", "Les artistes des créations")}<ul class="crew">{crew}</ul></section></main>"""


def page_contact():
    addr = "<br>".join(E(a) for a in SITE["address"])
    opts = "".join(f"<option>{E(s['title'])}</option>" for s in SHOWS if s["status"] != "Répertoire")
    return f"""<main>{page_title("Contact", None, "Pour accueillir un spectacle, demander un dossier ou simplement dire bonjour.")}
<section class="contact g"><div class="c-info rv">
<p class="c-mail"><a href="mailto:{SITE['email']}">{SITE['email']}</a> <button class="copy" type="button" data-copy="{SITE['email']}">Copier</button></p>
<dl class="spec"><div><dt>Téléphone</dt><dd>{SITE['phone_name']}<br><a href="tel:{SITE['phone'].replace(' ', '')}">{SITE['phone']}</a></dd></div>
<div><dt>Adresse</dt><dd>{addr}</dd></div>
<div><dt>Nous suivre</dt><dd><a href="{SITE['instagram']}" rel="noopener">Instagram</a><br><a href="{SITE['facebook']}" rel="noopener">Facebook</a></dd></div></dl></div>
<form class="form rv" name="contact" method="POST" data-netlify="true" netlify-honeypot="bot-field">
<input type="hidden" name="form-name" value="contact"><p hidden><label>Ne pas remplir <input name="bot-field"></label></p>
<div><label for="c-name">Nom</label><input id="c-name" name="nom" required autocomplete="name"></div>
<div><label for="c-email">E-mail</label><input id="c-email" type="email" name="email" required autocomplete="email"></div>
<div><label for="c-show">Spectacle concerné (facultatif)</label><select id="c-show" name="spectacle"><option value="">—</option>{opts}<option>Autre</option></select></div>
<div><label for="c-msg">Message</label><textarea id="c-msg" name="message" rows="6" required></textarea></div>
<div><button class="btn" type="submit">Envoyer <span aria-hidden="true">→</span></button></div></form></section>
{newsletter()}</main>"""


def page_404():
    return f"""<main><section class="ph-title nf"><h1 class="hl">{lines("Oups !")}</h1><span class="tag">404</span>
<p class="intro">Cette page s'est dépliée ailleurs. Elle a peut-être changé d'adresse avec le nouveau site.</p>
<p><a class="btn" href="index.html">Retour à l'accueil <span aria-hidden="true">→</span></a></p></section></main>"""


SCRIPT = """<div class="peek" aria-hidden="true"><img alt=""></div>
<div class="lightbox" hidden><button class="lb-close" type="button">Fermer</button><button class="lb-prev" type="button" aria-label="Photo précédente">←</button><img alt=""><span class="lb-n"></span><button class="lb-next" type="button" aria-label="Photo suivante">→</button></div>
<script>
(function(){
 var reduce=matchMedia("(prefers-reduced-motion: reduce)").matches,root=document.documentElement;
 /* ouverture : une fois par visite */
 try{sessionStorage.setItem("origami-vu","1")}catch(e){}

 /* en-tête : fond noir dès qu'on quitte le haut de page */
 var top=document.querySelector(".top");
 function onScroll(){top.classList.toggle("scrolled",scrollY>30)}onScroll();addEventListener("scroll",onScroll,{passive:true});

 /* un seul langage d'animation : tout monte derrière un masque */
 var rv=[].slice.call(document.querySelectorAll(".rv"));
 if(reduce||!("IntersectionObserver" in window)){rv.forEach(function(e){e.classList.add("in")})}
 else{var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add("in");io.unobserve(e.target)}})},{rootMargin:"0px 0px -8% 0px"});
  rv.forEach(function(e){io.observe(e)});}

 /* menu plein écran */
 var menu=document.getElementById("menu"),btn=document.querySelector(".open-menu"),closeB=menu.querySelector(".close");
 function openMenu(){menu.classList.add("open");document.body.classList.add("menu-on");btn.setAttribute("aria-expanded","true");setTimeout(function(){closeB.focus()},reduce?0:200);}
 function closeMenu(){if(!menu.classList.contains("open"))return;menu.classList.remove("open");document.body.classList.remove("menu-on");btn.setAttribute("aria-expanded","false");btn.focus();}
 btn.addEventListener("click",openMenu);closeB.addEventListener("click",closeMenu);
 menu.addEventListener("keydown",function(e){if(e.key!=="Tab")return;var f=menu.querySelectorAll(".close,.menu-links a,.menu-foot a"),a=f[0],z=f[f.length-1];
  if(e.shiftKey&&document.activeElement===a){e.preventDefault();z.focus()}else if(!e.shiftKey&&document.activeElement===z){e.preventDefault();a.focus()}});

 /* dates passées : masquées même si le site n'a pas été reconstruit */
 var d=new Date(),today=d.getFullYear()+"-"+("0"+(d.getMonth()+1)).slice(-2)+"-"+("0"+d.getDate()).slice(-2);
 document.querySelectorAll("ul.dates").forEach(function(ul){var n=0;ul.querySelectorAll(".d[data-iso]").forEach(function(li){if(li.dataset.iso<today)li.remove();else n++});
  var em=ul.nextElementSibling;if(em&&em.classList.contains("empty"))em.hidden=n>0;});

 /* index : survoler un titre révèle la photo, qui suit le curseur */
 var peek=document.querySelector(".peek"),pimg=peek.querySelector("img");
 if(matchMedia("(hover: hover) and (pointer: fine)").matches){
  var x=0,y=0,px=0,py=0,on=false,raf=0;
  function loop(){px+=(x-px)*(reduce?1:.18);py+=(y-py)*(reduce?1:.18);peek.style.transform="translate("+px.toFixed(1)+"px,"+py.toFixed(1)+"px)";
   if(on||Math.abs(x-px)>.5)raf=requestAnimationFrame(loop);else raf=0;}
  document.querySelectorAll(".index a[data-img]").forEach(function(a){
   a.addEventListener("mouseenter",function(e){if(pimg.getAttribute("src")!==a.dataset.img)pimg.src=a.dataset.img;if(!on){x=px=e.clientX;y=py=e.clientY;}on=true;peek.classList.add("on");if(!raf)raf=requestAnimationFrame(loop);});
   a.addEventListener("mousemove",function(e){x=e.clientX;y=e.clientY;});
   a.addEventListener("mouseleave",function(){on=false;peek.classList.remove("on");});
  });
 }

 /* visionneuse photo */
 var lb=document.querySelector(".lightbox"),li=lb.querySelector("img"),ln=lb.querySelector(".lb-n"),set=[],cur=0;
 function show(i){cur=(i+set.length)%set.length;li.src=set[cur].dataset.full;li.alt=set[cur].querySelector("img").alt;ln.textContent=(cur+1)+" / "+set.length;}
 function closeLb(){lb.hidden=true;li.src="";document.body.classList.remove("menu-on");if(set[cur])set[cur].focus();}
 document.addEventListener("click",function(e){
  var g=e.target.closest(".gal button");if(g){set=[].slice.call(g.parentElement.children);show(set.indexOf(g));lb.hidden=false;document.body.classList.add("menu-on");lb.querySelector(".lb-close").focus();return;}
  if(e.target===lb||e.target.closest(".lb-close"))closeLb();
  if(e.target.closest(".lb-prev"))show(cur-1);if(e.target.closest(".lb-next"))show(cur+1);
  var c=e.target.closest(".copy");if(c&&navigator.clipboard){navigator.clipboard.writeText(c.dataset.copy).then(function(){c.textContent="Copié";setTimeout(function(){c.textContent="Copier"},1800)},function(){})}
 });
 document.addEventListener("keydown",function(e){
  if(e.key==="Escape"){if(!lb.hidden)closeLb();else closeMenu();}
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
        f.write('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><rect width="40" height="40" fill="#000"/><rect x="11" y="11" width="18" height="18" fill="#9781FF" transform="rotate(-8 20 20)"/></svg>')
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
