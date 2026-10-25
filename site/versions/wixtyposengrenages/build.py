# -*- coding: utf-8 -*-
"""Copie du Wix avec les typos d'Engrenages (IM Fell English, EB Garamond, Special Elite) : seules les polices changent.

    python3 build.py            -> dossier dist/ (le site à mettre en ligne)
    python3 build.py --preview  -> aussi preview.html (tout le site en une page, pour l'aperçu)

Photos, vidéos et PDF : servis depuis le site (voir medias.py à la racine de site/).
"""
import base64, html, os, re, shutil, sys, datetime

TODAY = datetime.date.today().isoformat()
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))  # dossier site/ : content.py et logo.svg communs
sys.path.insert(0, ROOT)
from content import SITE, SHOWS, ARTISTS, HISTORY, COMMITTEE, COLLABS, SUPPORTERS, PARTNER_LOGOS, REDIRECTS
from medias import photo, video
DIST = os.path.join(HERE, "dist")
E = html.escape
FONTS = "https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400;1,500&family=IM+Fell+English:ital@0;1&family=Special+Elite&display=swap"
LOGO_SRC = "logo.svg"  # logo original (vectoriel), remplacé par une data: URI dans l'aperçu


def img(mid, w=1400):
    return photo(mid, w)


def pic(mid, alt, w=1400, eager=False):
    return f'<img src="{img(mid, w)}" alt="{E(alt)}" loading="{"eager" if eager else "lazy"}" decoding="async">'


SHOW_BY_SLUG = {s["slug"]: s for s in SHOWS}

# Étiquettes en dégradé de l'accueil (comme sur le site original)
HOME_TAG = {
    "commeunpoint": "Première le 17 mai 2026",
    "la-petite-fille-dans-la-poubelle": "En tournée",
    "caborigamique": "Formule adaptable",
    "edmd": "Solo en tournée",
    "oups-vache": "En création jusqu'en l'an 2250",
    "des-pates-au-seum": "Création en devenir – 2027",
}
HOME_ORDER = ["commeunpoint", "la-petite-fille-dans-la-poubelle", "caborigamique", "edmd", "oups-vache", "des-pates-au-seum"]
LIST_ORDER = ["commeunpoint", "edmd", "des-pates-au-seum", "la-petite-fille-dans-la-poubelle", "caborigamique", "oups-vache"]

STAR = '<div class="star" aria-hidden="true"><svg viewBox="0 0 40 40"><path d="M20 0C21 12 28 19 40 20C28 21 21 28 20 40C19 28 12 21 0 20C12 19 19 12 20 0Z"/></svg></div>'
EYE = '<svg class="eye" viewBox="0 0 64 64" aria-hidden="true"><path d="M4 32C12 18 22 12 32 12S52 18 60 32C52 46 42 52 32 52S12 46 4 32Z" fill="#F4E4F4" stroke="#281467" stroke-width="3"/><circle cx="32" cy="32" r="13" fill="#5A4BC8" stroke="#281467" stroke-width="3"/><circle cx="32" cy="32" r="5" fill="#fff"/><circle cx="36" cy="28" r="2.5" fill="#fff"/><path d="M8 20L4 14M18 12L16 5M32 9V2M46 12L48 5M56 20L60 14" stroke="#F4E4F4" stroke-width="3" stroke-linecap="round"/></svg>'

# ---------------------------------------------------------------- layout

NAV = [("index", "Accueil"), ("spectacles", "Spectacles"), ("agenda", "Agenda"), ("quisommesnous", "Qui sommes nous"), ("collabs", "Collaborations"), ("contact", "Contact")]


def href(slug):
    return "index.html" if slug in ("", "index") else f"{slug}.html"


NAV_MAIN = [("index", "Accueil"), ("spectacles", "Spectacles"), ("quisommesnous", "Qui sommes nous"), ("collabs", "Collaborations"), ("contact", "Contact")]


def header(active):
    cur = ' aria-current="page"'
    sub = "".join(f'<li><a href="{href(x["slug"])}">{E(x["title"])}</a></li>' for x in SHOWS) + '<li class="sep"><a href="agenda.html">Agenda des dates</a></li>'
    items = ""
    for k, v in NAV_MAIN:
        a = cur if (k == active or (k == "spectacles" and active in ("spectacles", "agenda"))) else ""
        if k == "spectacles":
            items += f'<li class="has-sub"><a href="{href(k)}"{a}>{v}</a><ul class="sub">{sub}</ul></li>'
        else:
            items += f'<li><a href="{href(k)}"{a}>{v}</a></li>'
    mob = "".join(f'<li><a href="{href(k)}">{v}</a></li>' for k, v in NAV)
    return f"""<a class="pin-logo" href="index.html"><img src="{LOGO_SRC}" alt="Compagnie Origami" width="313" height="56"></a>
<header class="site-head"><div class="head-in">
<nav class="nav-box" aria-label="Navigation principale"><ul>{items}</ul></nav>
<details class="menu"><summary aria-label="Menu"><span></span><span></span><span></span></summary><nav><ul>{mob}</ul></nav></details>
</div></header>"""


FB_ICON = '<svg viewBox="0 0 33 33" aria-hidden="true"><circle cx="16.5" cy="16.5" r="16.5" fill="#fff"/><path d="M18.2 26v-8.2h2.8l.4-3.2h-3.2v-2c0-.9.3-1.6 1.6-1.6h1.7V8.1c-.3 0-1.3-.1-2.5-.1-2.5 0-4.2 1.5-4.2 4.3v2.4H12v3.2h2.8V26h3.4z" fill="#000"/></svg>'
IG_ICON = '<svg viewBox="0 0 33 33" aria-hidden="true"><circle cx="16.5" cy="16.5" r="16.5" fill="#fff"/><rect x="9.5" y="9.5" width="14" height="14" rx="4" fill="none" stroke="#000" stroke-width="1.8"/><circle cx="16.5" cy="16.5" r="3.4" fill="none" stroke="#000" stroke-width="1.8"/><circle cx="20.6" cy="12.4" r="1" fill="#000"/></svg>'


def footer():
    return f"""<footer class="site-foot"><div class="foot-in">
<p class="foot-copy">© {datetime.date.today().year} Compagnie Origami</p>
<ul class="foot-social"><li><a href="{SITE['facebook']}" rel="noopener" aria-label="Facebook">{FB_ICON}</a></li><li><a href="{SITE['instagram']}" rel="noopener" aria-label="Instagram">{IG_ICON}</a></li></ul>
</div></footer>"""


def head(title, desc, path, og=None):
    full = f"{title} | Cie Origami – Cirque" if title != SITE["name"] else "Compagnie Origami | Cirque"
    og = og or SITE["og_image"]
    return f"""<!doctype html><html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>{E(full)}</title><meta name="description" content="{E(desc)}">
<link rel="canonical" href="{SITE['url']}/{path}">
<meta property="og:type" content="website"><meta property="og:site_name" content="Cie Origami – Cirque">
<meta property="og:title" content="{E(full)}"><meta property="og:description" content="{E(desc)}">
<meta property="og:image" content="{photo(og, 1600, absolute=True)}"><meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="{FONTS}"><link rel="stylesheet" href="style.css"></head><body>"""


# ---------------------------------------------------------------- blocs

def meta_list(s):
    return [x for x in (s["genre"], s["duration"], s["public"], s["venue"]) if x]


def gallery(ids, title, limit=None):
    ids = ids[:limit] if limit else ids
    return "".join(f'<button class="g-item" type="button" data-full="{img(g, 1800)}">{pic(g, title + " – photo " + str(i+1), 700)}</button>' for i, g in enumerate(ids))


def all_dates():
    rows = [(iso, label, place, s) for s in SHOWS for iso, label, place in s["dates"]]
    rows.sort(key=lambda r: r[0], reverse=True)
    return rows


def upcoming():
    return [r for r in all_dates() if r[0] >= TODAY][::-1]


def date_row(iso, label, place, s=None):
    show = f'<a class="d-show" href="{href(s["slug"])}">{E(s["title"])}</a>' if s else ""
    return f'<li class="date"><time class="d-when" datetime="{iso}">{E(label)}</time><div><p class="d-place">{E(place)}</p>{show}</div></li>'


def card(s):
    return f"""<a class="card" href="{href(s['slug'])}">{pic(s['card'], s['title'], 900)}
<div class="c-txt"><span class="tag">{E(s['status'])}</span><h3>{E(s['title'])}</h3><p>{E(s['teaser'])}</p></div></a>"""


# ---------------------------------------------------------------- pages

# ---------------------------------------------------------------- accueil (mesures relevées sur l'accueil original, largeur de référence 1265 px)

def dv(kind, color, h, op, soft=False):
    """Biseau en triangle, comme les « séparateurs de section » Wix.
    kind : tl (haut-gauche), br (bas-droite), bl (bas-gauche)"""
    if soft:
        layers = [(h + 60, .25), (h + 40, 1/3), (h + 20, .5), (h, 1)]
        inner = "".join(f'<i class="dv {kind}" style="--h:{hh};--o:{oo:.3f};--c:{color}"></i>' for hh, oo in layers)
        return f'<span class="dvg" style="opacity:{op}">{inner}</span>'
    return f'<span class="dvg" style="opacity:{op}"><i class="dv {kind}" style="--h:{h};--o:1;--c:{color}"></i></span>'


FILES_HOME_CAB = "../fichiers/" + "4d47d3_fe143ae880844006b8f688c89b82b9b5.pdf"

BLOCKS = [
    dict(slug="commeunpoint", title_dv=[("br", "#3D9BE9", 20, .47)], title_h=96,
         h=540, dvs=[("tl", "#9781FF", 212, .14), ("br", "#9781FF", 217, .3)],
         tag=(95, 319, "Première le 17 mai 2026"), left=None, right=("4d47d3_110859d8bd9a4be3b6473e6fdfdaedb6~mv2.jpg", 835, 429),
         tx=125, tw=572, ty=74, sub="Spectacle en rue", subsize=30, by="Par Ella Beerli et Julie Levrat",
         paras=["Ella et Julie sont deux copines devenues artistes de cirque. Depuis petites, les deux rêvent du cirque avec des chapiteaux, des paillettes, du waow et des pop corn. En grandissant elles suivent des formations de cirque contemporain et apprécient raconter des histoires avec les mots et le corps, laissez la place à la sensibilité et à l’intimité créé entre les spectateurs.ices et les artistes.",
                "Elles se retrouvent alors les deux, autour d’un café, à partager la réalité de leur rêve d’être artiste de cirque. Le spectacle n’est que la partie visible de leur art. Le quotidien, c’est aussi des entraînements, des montages, des ratés, des doutes, des fous rires, des stress, des ambitions toujours plus grandes…"],
         pill=(516, 197, "en savoir plus", "commeunpoint.html"),
         wide=("4d47d3_5cdf0d14077a4961b01f991d5ed284b2~mv2.jpg", 446, [("tl", "#281467", 133, .72, False), ("br", "#000000", 69, 1, False)]),
         gal=(484, ["4d47d3_9b1dd66c824c463398f0243d13a7f170~mv2.jpg", "4d47d3_7064c3185f7a4317acdd4545694f817f~mv2.jpg", "4d47d3_54aff8fd388b49e7b3c34faba9c975ea~mv2.jpg", "4d47d3_146138bea4f64625bd13dfad3911df64~mv2.jpg", "4d47d3_50c4a4d59f3f43b694def81ab4f8d6b5~mv2.jpg", "4d47d3_5cdf0d14077a4961b01f991d5ed284b2~mv2.jpg", "4d47d3_591a784ed1b7410a84979bfbbc689e99~mv2.jpg", "4d47d3_725768fd411544058942c7e32542ccdd~mv2.jpg"], 135, 55),
         star_op=.31),
    dict(slug="la-petite-fille-dans-la-poubelle", title_dv=[("tl", "#9781FF", 20, .27), ("br", "#3D9BE9", 65, .15)], title_h=95,
         h=690, dvs=[("tl", "#281467", 158, .26), ("br", "#9781FF", 252, .3)],
         tag=None, left=("4d47d3_b5c9b051db074f408045866ec1342e33~mv2.jpg", 0, 281), right=("vid:4d47d3_984cf0258e974607b2bc0a2e35699c1b|4d47d3_984cf0258e974607b2bc0a2e35699c1bf000.jpg|50% 100%", 946, 318),
         tx=441, tw=408, ty=58, sub="Cirque-Théâtre Surréaliste", subsize=21, by="Par Ella Beerli et Sévane Gurunlian",
         paras=["<span class='strong'>L'histoire de Chiffon et Célestine contée façon cirque.</span>",
                "Lui, c’est Chiffon. Il vit dans la rue. Célestine, la petite fille qui est avec lui, rêve de partir. Dans cette histoire contée façon cirque, ces deux-là se portent, s’envolent, se plient en deux, jonglent, tiennent en équilibre sur une roue. Ils évoluent dans un univers où les objets prennent vie et où le temps ne veut plus rien dire. Clownesques et punks, ils dédramatisent quelques petites cruelles réalités.",
                "Dans cette tragédie teintée d’ironie, Chiffon et Célestine vivent hors du temps. Leur histoire semble être griffée par un punk sur du papier à dessin. Chiffon a un jour pris Célestine et l’a placée dans l’une des nombreuses poubelles de sa collection.",
                "Dans une boucle temporelle, ils se portent, s’envolent, se plient en deux, jonglent et tiennent en équilibre."],
         pill=(665, 155, "en savoir plus", "la-petite-fille-dans-la-poubelle.html"),
         wide=("4d47d3_6c17a6290506436d80ac90a86d67766a~mv2.jpg", 456, [("tl", "#9781FF", 174, .19, False), ("br", "#000000", 75, 1, False)]),
         gal=(566, ["4d47d3_efacd5ba32044c7c971ae948df4d23c0~mv2.jpg", "4d47d3_51555e1022384dbcb66b25811d15f1f2~mv2.jpg", "4d47d3_d4eea29000db4cc895354e43ee355a25~mv2.jpg", "4d47d3_efa72519cffa424baa816e2766a487bf~mv2.jpeg", "4d47d3_febb7774debd4ca0a2fcd981ebbe9c59~mv2.jpg", "4d47d3_6bfcb49348ee4ab4a1e0d2260e4bda21~mv2.jpg", "4d47d3_4eb7ca1b0a7f41e4ba2b057fd857e0d2~mv2.jpg", "4d47d3_52678f0d63094b82b531ba521561d711~mv2.jpg", "4d47d3_c30f75a407534412b7c761860516c3fa~mv2.jpg"], 25, 46),
         star_op=.38),
    dict(slug="caborigamique", title_dv=[("tl", "#9781FF", 20, .27), ("br", "#3D9BE9", 65, .15)], title_h=95,
         h=747, dvs=[("tl", "#281467", 158, .26), ("br", "#9781FF", 252, .3)],
         tag=None, left=("4d47d3_961237f0dea8435881e62aefd6b5da6e~mv2.jpg", 0, 280), right=("4d47d3_89e52ea6d1c942c0888a39b219c32a56~mv2.jpg", 946, 318),
         tx=394, tw=427, ty=46, sub="Cabaret en rue", subsize=21, by="Par une équipe 100% Origamique",
         paras=["<span class='strong big'>Un souffle de cirque, un grain de folie</span>",
                "Le Cabaret Origamique, c’est un cabaret de rue… et d’ailleurs. Un moment suspendu, un assemblage délicat de numéros aux couleurs variées, comme un origami vivant déployé sous vos yeux.",
                "Dans cet univers drôle et burlesque, les artistes partagent leurs petites histoires de scène, tissent des liens entre prouesse et poésie : jongleries, danses virevoltantes, acrobaties au sol et aériennes… et bien d'autres surprises encore.",
                "<span class='strong'>Modulable et caméléon</span>",
                "Ce cabaret s’adapte à tous les lieux de la petite place de village au grand espace en plein air et à tous les publics : enfants émerveillés l’après-midi, spectateurs curieux et complices lors d’un cabaret de soirée.",
                "C’est un cirque vivant, joyeux, généreux. Un moment de rencontre, d’énergie et de rires, où l’art circassien se dévoile sous toutes ses formes."],
         pill=(652, 190, "Infos technique et tarifs", FILES_HOME_CAB),
         wide=("vid:4d47d3_15e461de7cd64c0d960b2db55be1136c|4d47d3_15e461de7cd64c0d960b2db55be1136cf000.jpg|50% 50%", 470, [("tl", "#9781FF", 174, .19, True), ("br", "#000000", 75, 1, True)]),
         gal=(517, ["4d47d3_6ca6d652e105407cbfe20ff07618d290~mv2.jpg", "4d47d3_b5880f52a69c4b9abd631519ccf04d3c~mv2.jpg", "4d47d3_cca3cf8dbad340fe92529cd9b9e00595~mv2.jpg", "4d47d3_f305686a6f1f4bf49deacd2ec90ff8a0~mv2.jpg", "4d47d3_e4ec4d6cf300495bb04daa53c1f29916~mv2.jpg", "4d47d3_9159ae5406cd4e969ab8d5810c25a31e~mv2.jpg", "4d47d3_dc784fbb1c8548bfbb050cc51a35ee85~mv2.jpg", "4d47d3_3bfbbc4bc78b41b1bf66b3f6b97d4125~mv2.jpg"], 135, 55),
         star_op=.43),
    dict(slug="edmd", title_dv=[("br", "#3D9BE9", 20, .47)], title_h=96,
         h=424, dvs=[("tl", "#281467", 158, .26), ("br", "#9781FF", 252, .3)],
         tag=None, left=None, right=("4d47d3_61cc470ef1f845a8bdd6e7f9eae5e220~mv2.jpg", 855, 409),
         tx=144, tw=548, ty=43, sub="Equilibrisme - Cirque intimiste", subsize=21, by="Une création original par Ella Beerli, équilibriste déséquilibrée.",
         paras=["A l’aide de voix off, de diverses techniques d’équilibre, d’expressions corporelles et d’une touche de théâtralité.",
                "Elle raconte sa relation avec cette discipline qui l’accompagne depuis son enfance. Elle se confie sur ses doutes, ses questionnements, son vécu, ses choix (...)"],
         pill=(546, 176, "en savoir plus", "edmd.html"),
         wide=("4d47d3_d90e5d70bd53421b94e5f34d1093fb0a~mv2.jpg", 456, [("tl", "#9781FF", 100, .19, False), ("br", "#000000", 75, 1, False)]),
         gal=(496, ["4d47d3_a9165419f50b4f59b25d069cd3915c15~mv2.jpg", "4d47d3_6f6a2b36de3c4cfaaad28055a9f207ee~mv2.jpg", "4d47d3_a0fd4b80c2374e728258456b9a5ec8ee~mv2.jpg", "4d47d3_4a63b9830d1e44f3aeef376d6b5fd9d4~mv2.jpg", "4d47d3_e5a3af5c42f440b4bd69176509cbc5a2~mv2.jpg", "4d47d3_61cc470ef1f845a8bdd6e7f9eae5e220~mv2.jpg"], 135, 55),
         star_op=.36),
    dict(slug="oups-vache", title_dv=[("tl", "#9781FF", 20, .27), ("br", "#3D9BE9", 65, .15)], title_h=95,
         h=465, dvs=[("tl", "#281467", 158, .26), ("br", "#9781FF", 252, .3)],
         tag=(347, 280, "En création jusqu'en l'an 2250"), left=("4d47d3_f23199864ca348c98d1e40ca6511f944~mv2.jpg", 0, 261), right=("4d47d3_31190d3ef1754bbeab303dff657f28d7~mv2.jpg", 1004, 260),
         tx=421, tw=412, ty=67, sub="Science-fiction-sonore et cirque", subsize=21, by="Une recherche par Sévane Gurunlian",
         paras=["<span class='strong'>En deux mots</span>",
                "En l’an 2250, Claude est commandant d’un vaisseau spatial. Cela fait dix ans qu’il est en mission, pendant que ses collègues capitaines explorent des planètes inconnues ou affrontent des créatures galactiques.. Claude, lui, travaille pour la poste intergalactique, effectuant des livraisons, isolé dans l’espace et coupé de sa planète.",
                "Plus d'infos à venir..."],
         pill=None,
         wide=("4d47d3_830e4ea396e2432e98714c4f7616ea52~mv2.jpg", 456, [("tl", "#9781FF", 174, .19, True), ("br", "#000000", 75, 1, True)]),
         gal=(485, ["4d47d3_5748ba7c10ea4e598cee212cad934d46~mv2.jpg", "4d47d3_589f3a129fdf48ab9dbe1e30bf052f3c~mv2.jpg", "4d47d3_a23d1e079630488eb8948451cc4687e8~mv2.jpg", "4d47d3_4e12b09d3ba247bba59ed0fef299abb9~mv2.jpg", "4d47d3_3fa859b8c41e406192365b41d8ef5b32~mv2.jpg", "4d47d3_475a1fee96e5494293e99aca0655fe3a~mv2.jpg", "4d47d3_830e4ea396e2432e98714c4f7616ea52~mv2.jpg"], 135, 55),
         star_op=.35),
    dict(slug="des-pates-au-seum", title_dv=[("tl", "#9781FF", 20, .27), ("br", "#3D9BE9", 65, .15)], title_h=95,
         h=801, dvs=[("tl", "#281467", 158, .26), ("br", "#9781FF", 252, .3)],
         tag=None, left=("4d47d3_b836be194f0e4334837ff1d665a57f21~mv2.jpg", 0, 261), right=("4d47d3_ad850f1c5a9d48d2af17d7d11891d568~mv2.jpg", 1004, 260),
         tx=426, tw=412, ty=43, sub="Cirque, acrobaties et absurdités", subsize=21, by="Un projet de création par Ella Beerli et Sévane Gurunlian",
         paras=["<span class='serif'>Création en devenir - 2027 -</span>",
                "C’est un état qui nous traverse et qui, d’une façon à l’autre, traverse tout le monde. Une fatigue, une envie de ralentir, de ne plus répondre immédiatement. Est-ce que notre époque change simplement de visage ? Autour de nous, le monde déborde : les bruits de la ville, les écrans, les images, les injonctions permanente. Tout s’accumule. Alors il y a la flemme. Le retard. L’arrêt. La procrastination. Non pas comme un échec, mais peut-être comme un geste de survie. Une manière de se protéger lorsque le trop-plein devient trop lourd.",
                "À travers cette nouvelle création, le duo interroge le repli sur soi, la cohabitation, l’épuisement quotidien, mais aussi la puissance poétique des micro-aventures. Un cirque poétique, parfois pour en rire, mais surtout pour raconter ce qui se joue dans l’inaction… et dans le trop-plein."],
         pill=None,
         wide=("4d47d3_403c14878a634a7d8c5becb8cc65d954~mv2.jpg", 568, [("tl", "#9781FF", 174, .19, True), ("br", "#000000", 75, 1, True)]),
         gal=None, star_op=None),
]

EYE_SVG = '<svg class="h-eye" viewBox="20 39.5 160 121" aria-hidden="true"><path fill="#FFE0D9" d="M176 100.6l.3-.6C160.1 64.8 131 42.9 100 42.9S39.9 64.8 23.8 100l.3.6c.1.1.1.2.2.3 16.2 34.7 45 56.1 75.8 56.1 30.8 0 59.6-21.4 75.8-56.1 0-.1 0-.2.1-.3z"/><path fill="#041354" d="M100.3 135.1c19.4 0 35.1-15.8 35.1-35.1s-15.7-35.1-35.1-35.1-35.1 15.6-35.1 35 15.8 35.2 35.1 35.2zm0-63.4c15.6 0 28.2 12.7 28.2 28.3s-12.7 28.3-28.2 28.3-28.2-12.7-28.2-28.3c0-15.7 12.7-28.3 28.2-28.3z"/><path fill="#041354" d="M179.8 100.3c.1-.1.1-.2.2-.3-16-36.2-45.8-60.5-80-60.5S36 63.8 20 100c.1.1.1.2.2.3-.1.1-.1.2-.2.3.4.7.8 1.3 1.2 1.9 16.3 34.8 45.5 58 78.8 58s62.6-23.2 78.8-58c.4-.6.8-1.3 1.2-1.9-.1-.1-.1-.2-.2-.3zM57.4 61.6C70.3 51.7 85 46.4 100 46.4s29.7 5.3 42.6 15.3c3.8 2.9 7.3 6.2 10.7 9.8-15.1-10.7-33.5-16.9-53.3-16.9s-38.3 6.3-53.3 16.9c3.4-3.7 6.9-7 10.7-9.9zm84.9 38.3c0 23.2-18.8 42-42 42s-42-18.8-42-42 18.8-42 42-42 42 18.8 42 42zm-114.2.7c8.3-12.8 19.8-23.1 33.1-29.9-6.3 8.4-9.7 18.7-9.7 29.2 0 12 4.3 22.9 11.4 31.4-14-6.7-26.2-17.3-34.8-30.7zm114.5 37.8c-12.9 10-27.7 15.3-42.6 15.3-15 0-29.7-5.3-42.6-15.3-2.5-1.9-4.9-4-7.1-6.2 14.4 9.2 31.4 14.5 49.7 14.5s35.4-5.3 49.7-14.5c-2.2 2.2-4.6 4.2-7.1 6.2zm-4.4-7.6c6.9-8.4 11-19.2 11-30.9 0-10.3-3.2-20.3-9.2-28.6 12.8 6.8 23.9 16.8 32 29.3-8.5 13-20.2 23.4-33.8 30.2z"/><path fill="#041354" d="M100.3 114.9c4.5 0 8.6-2 11.4-5.1-3.8-.3-7.3-2.7-8.7-6.5-2.1-5.3.6-11.2 5.8-13.3.9-.4 1.9-.6 2.9-.7-2.8-3.1-6.9-5.1-11.4-5.1-8.5 0-15.3 6.9-15.3 15.3s6.9 15.4 15.3 15.4z"/><path fill="#041354" d="M108.8 95.7c-2.2.8-3.2 3.3-2.4 5.4.8 2.2 3.3 3.2 5.4 2.4 2.2-.8 3.2-3.3 2.4-5.4-.8-2.2-3.2-3.3-5.4-2.4z"/></svg>'
STAR_O = '<svg class="h-star-svg" viewBox="20 20 160 160" aria-hidden="true"><path fill="#fff" d="M20 100.002c41.21 6.266 54.993 20.886 54.993 20.886C92.289 135.827 99.952 180 99.952 180h.097s7.896-44.037 24.958-59.111c0 0 13.783-14.62 54.993-20.886v-.005c-41.21-6.266-54.993-20.886-54.993-20.886C107.944 64.037 100.048 20 100.048 20h-.097s-7.663 44.173-24.958 59.111c0 0-13.783 14.62-54.993 20.886"/></svg>'


def U(px):
    return f"calc({px} * var(--u))"


IMG_POS = {"4d47d3_b5c9b051db074f408045866ec1342e33~mv2.jpg": "0% 50%",
           "4d47d3_110859d8bd9a4be3b6473e6fdfdaedb6~mv2.jpg": "50% 100%"}


def media(m, alt, w=900):
    """Photo, ou vidéo en boucle si m = "vid:ID|poster|position" (vidéos de la compagnie hébergées chez Wix)."""
    if not m.startswith("vid:"):
        out = pic(m, alt, w)
        if m in IMG_POS:  # cadrage repris de l'original
            out = out.replace("<img ", f'<img style="object-position:{IMG_POS[m]}" ', 1)
        return out
    vid, poster, pos = m[4:].split("|")
    return (f'<video class="loopvid" autoplay muted loop playsinline preload="metadata" poster="{img(poster, w)}" '
            f'style="object-position:{pos}" aria-label="{E(alt)}"><source src="{video(vid)}" type="video/mp4"></video>')


def gal_track(ids, title):
    # colonnes façon « collage » Wix : une haute, puis deux empilées, en alternance
    cols, i, k = [], 0, 0
    widths = [250, 167, 285, 253, 256, 200]
    while i < len(ids):
        w = widths[k % len(widths)]
        if k % 3 == 1 and i + 1 < len(ids):
            cells = ids[i:i + 2]; i += 2
        else:
            cells = ids[i:i + 1]; i += 1
        inner = "".join(f'<button class="g-item" type="button" data-full="{img(c, 1800)}">{pic(c, title, 700)}</button>' for c in cells)
        cols.append(f'<div class="g-col" style="--w:{w}">{inner}</div>')
        k += 1
    return "".join(cols)


def page_index():
    items = "".join(f'<li><a href="{href(sl)}">{E(SHOW_BY_SLUG[sl]["title"])}</a></li>' for sl in HOME_ORDER)
    nxt = upcoming()
    nxt_html = ""
    if nxt:
        iso, label, place, sh = nxt[0]
        nxt_html = f'<a class="h-next" href="agenda.html"><span class="h-next-tag">Prochaine date</span><span class="h-next-txt">{E(label)} · {E(sh["title"])} · {E(place)}</span></a>'
    hero = f"""<section class="h-hero"><span class="h-hero-bg" aria-hidden="true"></span>
{dv("tl", "#ED11FF", 20, .17, True)}{dv("br", "#ED11FF", 304, .17, True)}
<div class="stage">
<div class="h-frame f1"><h1 class="h-ft">Bienvenue dans l'univers<br>de la cie Origami</h1>
<p>Depuis 2018, la Cie Origami tisse des spectacles aux formes multiples, nés d’une passion commune : celle de créer, de raconter, de surprendre.</p>
<p>Chaque projet réunit des artistes de cirque aux univers singuliers, pour donner vie à des œuvres tantôt drôles, tantôt poétiques, toujours sensibles. La compagnie s’adresse à tous les publics ( petits, grands ou avertis ) avec le désir d’offrir des instants forts et partagés. Aujourd’hui, de nouveaux projets prennent forme… Ils sont à découvrir juste ici !</p></div>
<div class="h-frame f2"><h2 class="h-ft">Nos projets en un coup d'œil</h2>{EYE_SVG}<ul class="h-bullets">{items}</ul></div>
{nxt_html}</div></section>"""
    out = hero
    for B in BLOCKS:
        sh = SHOW_BY_SLUG[B["slug"]]
        tdv = "".join(dv(k, c, h, o) for k, c, h, o in B["title_dv"])
        out += f'<section class="h-title" style="--sh:{B["title_h"]}"><span class="h-title-bg" aria-hidden="true"></span>{tdv}<div class="stage"><h2>{E(sh["title"])}</h2></div></section>'
        bdv = "".join(dv(k, c, h, o) for k, c, h, o in B["dvs"])
        side = ""
        if B["left"]:
            m, x, w = B["left"]; side += f'<div class="h-img" style="--x:{x};--w:{w}">{media(m, sh["title"], 900)}</div>'
        if B["right"]:
            m, x, w = B["right"]; side += f'<div class="h-img" style="--x:{x};--w:{w}">{media(m, sh["title"], 900)}</div>'
        tag = f'<span class="h-tag" style="--x:{B["tag"][0]};--w:{B["tag"][1]}">{E(B["tag"][2])}</span>' if B["tag"] else ""
        paras = "".join(f"<p>{p}</p>" for p in B["paras"])
        pill = ""
        if B["pill"]:
            px, pw, pl, ph = B["pill"]
            ext = ' rel="noopener"' if ph.startswith("http") else ""
            pill = f'<a class="h-pill" href="{ph}"{ext} style="--dx:{px - B["tx"]};--w:{pw}">{E(pl)}</a>'
        out += f"""<section class="h-block" style="--sh:{B['h']}"><span class="h-block-bg" aria-hidden="true"></span>{bdv}<div class="stage">{side}{tag}
<div class="h-txt" style="--x:{B['tx']};--w:{B['tw']};--y:{B['ty']}"><h3 style="--fs:{B['subsize']}">{E(B['sub'])}</h3><p class="h-by">{E(B['by'])}</p>{paras}{pill}</div></div></section>"""
        wm, wh, wdv = B["wide"]
        out += f'<section class="h-wide" style="--sh:{wh}"><div class="h-wide-img">{media(wm, sh["title"], 1920)}</div>{"".join(dv(k, c, h, o, sf) for k, c, h, o, sf in wdv)}</section>'
        if B["gal"]:
            gh, gids, gx, gb = B["gal"]
            out += f"""<section class="h-gal" style="--sh:{gh}"><span class="h-gal-bg" aria-hidden="true"></span>{dv("tl", "#000000", 20, 1)}{dv("br", "#000000", gb, 1)}
<div class="h-gal-wrap"><button class="g-arrow prev" type="button" aria-label="Photos précédentes">‹</button><div class="h-gal-track" style="--gx:{gx}">{gal_track(gids, sh['title'])}</div><button class="g-arrow next" type="button" aria-label="Photos suivantes">›</button></div></section>"""
        if B["star_op"] is not None:
            out += f'<section class="h-starband">{dv("bl", "#ED11FF", 76, B["star_op"])}<div class="stage">{STAR_O}</div></section>'
    out += f"""<section class="h-end"><div class="h-end-img">{pic('4d47d3_67251316a3a54dba9197de01d6a0f823~mv2.jpg', 'Le Cabaret Origamique', 1920)}</div>{dv("br", "#202020", 53, 1)}
<div class="stage"><a class="h-end-box" href="caborigamique.html"><span class="s1">Spectacle en rue</span><span class="s2">Le Cabaret Origamique</span></a></div></section>"""
    return f'<main class="home">{out}</main>'


def page_spectacles():
    current = [s for s in SHOWS if s["status"] != "Répertoire"]
    archive = [s for s in SHOWS if s["status"] == "Répertoire"]
    return f"""<main><section class="bg-hero page-top"><span class="fx" aria-hidden="true"></span><div class="wrap"><div class="frame title-frame">
<h1 class="t-serif">Spectacles</h1><p class="intro">Cirque-théâtre, cabaret de rue, solos intimistes et créations en cours. En rue et en salle, pour tous les publics.</p></div></div></section>
{STAR}
<section class="band"><div class="wrap"><h2 class="sec-title">Créations et tournée</h2><div class="cards">{''.join(card(s) for s in current)}</div></div></section>
<section class="bg-violet slant-top band"><div class="wrap"><h2 class="sec-title">Anciens spectacles</h2><div class="cards">{''.join(card(s) for s in archive)}</div></div></section></main>"""


def page_show(s):
    if s["slug"] == "la-petite-fille-dans-la-poubelle":
        return page_lpfdlp(s)
    body = "".join(f"<p>{p}</p>" for p in s["body"])
    meta = "".join(f"<span>{E(m)}</span>" for m in meta_list(s))
    sub = f'<p class="subtitle">{E(s["subtitle"])}</p>' if s.get("subtitle") else ""
    quote = f'<blockquote class="show-quote"><p>« {E(s["quote"])} »</p></blockquote>' if s["quote"] else ""
    pills = "".join(f'<a class="pill" href="{u}" rel="noopener">{E(l)}</a>' for l, u in s["links"]) or '<p>Dossier sur demande.</p><a class="pill" href="contact.html">Nous écrire</a>'
    gal = ""
    if len(s["gallery"]) >= 3:  # en dessous de 3 photos, pas de galerie
        gal = f"""<section class="h-gal show-gal" style="--sh:484"><span class="h-gal-bg" aria-hidden="true"></span>{dv("tl", "#000000", 20, 1)}{dv("br", "#000000", 55, 1)}
<div class="h-gal-wrap"><button class="g-arrow prev" type="button" aria-label="Photos précédentes">‹</button><div class="h-gal-track" style="--gx:135">{gal_track(s["gallery"], s["title"])}</div><button class="g-arrow next" type="button" aria-label="Photos suivantes">›</button></div></section>"""
    dates = ""
    if s["dates"]:
        up = [d for d in s["dates"] if d[0] >= TODAY][::-1]
        past = [d for d in s["dates"] if d[0] < TODAY]
        u = f'<ul class="dates">{"".join(date_row(*d) for d in up)}</ul>' if up else '<p class="muted">Pas de nouvelle date annoncée pour le moment.</p>'
        p = f'<details class="past"><summary>Dates passées</summary><ul class="dates">{"".join(date_row(*d) for d in past)}</ul></details>' if past else ""
        dates = f'<section class="bg-grey band dates-sec"><div class="wrap narrow"><h2>Dates</h2>{u}{p}</div></section>'
    video = ""
    if s.get("vimeo"):
        video = (f'<section class="show-video band"><div class="wrap"><div class="vid-frame"><iframe src="https://player.vimeo.com/video/{s["vimeo"]}?title=0&byline=0&portrait=0" '
                 f'title="{E(s["title"])} – vidéo" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen loading="lazy"></iframe></div></div></section>')
    return f"""<main>
<section class="show-hero">{pic(s['hero'], s['title'], 2000, eager=True)}<div class="wrap">
<a class="back" href="spectacles.html">← Spectacles</a><div class="show-status"><span class="tag">{E(s['status'])}</span></div>
<h1>{E(s['title'])}</h1>{sub}<p class="who">{E(s['by'])}</p><div class="show-meta">{meta}</div></div></section>
<section class="bg-violet band"><div class="wrap narrow show-text justify">{body}{quote}</div></section>
<section class="band"><div class="wrap links">
<div><h2>Liens</h2><div class="pills">{pills}</div></div>
<div><h2>Équipe</h2><p class="credits-txt">{E(s['credits'])}</p><p>Pour accueillir ce spectacle : <span class="sel">{SITE['email']}</span> · <span class="sel">{SITE['phone']}</span></p></div>
</div></section>{video}{gal}{dates}</main>"""


def page_lpfdlp(s):
    """Page « La Petite Fille dans la poubelle », calquée sur la page originale (mesures à 1265 px)."""
    links = "".join(f'<a class="lp-pill" href="{u}" rel="noopener">{E(l)}</a>' for l, u in s["links"])
    rows = "".join(
        f'<li><span class="lp-d">{E(label)}</span><span class="lp-p">{E(place)}</span><span class="lp-s">{E(s["title"])}</span></li>'
        for iso, label, place in sorted(s["dates"], key=lambda d: d[0], reverse=True))
    gal = ""
    if len(s["gallery"]) >= 3:
        gal = (f'<section class="h-gal show-gal" style="--sh:484"><span class="h-gal-bg" aria-hidden="true"></span>{dv("tl", "#000000", 20, 1)}{dv("br", "#000000", 46, 1)}'
               f'<div class="h-gal-wrap"><button class="g-arrow prev" type="button" aria-label="Photos précédentes">‹</button>'
               f'<div class="h-gal-track" style="--gx:25">{gal_track(s["gallery"], s["title"])}</div>'
               f'<button class="g-arrow next" type="button" aria-label="Photos suivantes">›</button></div></section>')
    video = ""
    if s.get("vimeo"):
        video = (f'<div class="vid-frame lp-vid"><iframe src="https://player.vimeo.com/video/{s["vimeo"]}?title=0&byline=0&portrait=0&muted=1&autoplay=1&loop=1&autopause=0" '
                 f'title="{E(s["title"])} – vidéo" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen loading="lazy"></iframe></div>')
    return f"""<main class="lp">
<section class="lp-hero">
<div class="lp-band">{pic('4d47d3_36788ab45c464ded9cb6ae8cb0466559~mv2.png', '', 1920, eager=True)}
<div class="stage"><div class="lp-head">
<h1 class="lp-title">{pic('4d47d3_ddc40d606c49441781b711ed0234173b~mv2.png', s['title'], 800, eager=True)}</h1>
<p class="lp-by">{E(s['by'])}</p><p class="lp-meta">Cirque - Théâtre - 60 minutes - Tout public</p><p class="lp-meta">Rue - Salle de spectacle</p>
</div></div></div>
<div class="lp-violet"><div class="stage"><div class="lp-txt">{"".join(f"<p>{p}</p>" for p in s["body"][:2])}</div></div></div>
</section>
<section class="lp-photo"><div class="lp-photo-img">{pic(s['hero'], s['title'], 1920)}</div></section>
<section class="lp-violet lp-quote"><div class="stage"><div class="lp-txt"><p>« {E(s['quote'])} »</p><p>60 minutes - Tout public</p></div></div></section>
<section class="lp-stage-bg"><div class="lp-floor">{pic('4d47d3_f39046547ee4472f8a66460ef05ea9b7~mv2.png', '', 1920)}</div>
<div class="stage lp-vidwrap">{video}</div>
<div class="lp-credits"><div class="stage"><p>{E(s['credits'])}</p></div></div>
<div class="lp-links"><div class="lp-links-img">{pic('4d47d3_f8aeb7972e2f41c28bdc35ba4c959def~mv2.jpg', '', 1920)}</div>
<div class="stage"><h2>Liens</h2><div class="lp-pills">{links}</div></div></div>
</section>
{gal}
<section class="lp-dates"><div class="stage"><h2>Dates</h2><ul class="lp-list">{rows}</ul></div>{dv("br", "#202020", 400, 1)}</section>
</main>"""


def page_agenda():
    up = upcoming()
    past = [r for r in all_dates() if r[0] < TODAY]
    by_year = {}
    for r in past:
        by_year.setdefault(r[0][:4], []).append(r)
    past_html = "".join(f'<h3 class="year">{y}</h3><ul class="dates">{"".join(date_row(*r) for r in rows)}</ul>' for y, rows in by_year.items())
    up_html = f'<ul class="dates">{"".join(date_row(*r) for r in up)}</ul>' if up else '<p class="muted">De nouvelles dates arrivent bientôt.</p>'
    return f"""<main><section class="bg-hero page-top"><span class="fx" aria-hidden="true"></span><div class="wrap"><div class="frame title-frame">
<h1 class="t-serif">Agenda</h1><p class="intro">Toutes les dates de tous nos spectacles, au même endroit. Depuis 2021, en Suisse, en France et jusqu'en Argentine.</p></div></div></section>
{STAR}
<section class="band"><div class="wrap narrow"><h2 class="sec-title">À venir</h2>{up_html}</div></section>
<section class="bg-violet slant-top band"><div class="wrap narrow"><h2 class="sec-title">Déjà joué</h2>{past_html}</div></section></main>"""


WAVE_D = "M1920 300v-4.067c-455.162 0-690.876-51.203-1082.65-129.288C490.044 97.423 0 100.013 0 100.013V300h1920z"
TRI_D = "M1920 300 0 100v200h1920z"
FLIP = {"bl": "", "br": "scale(-1,1)", "tl": "scale(1,-1)", "tr": "scale(-1,-1)"}


def shape(kind, color, h, op, wave=True):
    """Vague ou biseau (séparateurs Wix) : bl/br en bas, tl/tr en haut."""
    pos = "bottom:0" if kind[0] == "b" else "top:0"
    tf = FLIP[kind] or "none"
    d = WAVE_D if wave else TRI_D
    return (f'<svg class="q-shape" style="{pos};height:calc({h} * var(--u));opacity:{op};transform:{tf}" '
            f'viewBox="0 100 1920 200" preserveAspectRatio="none" aria-hidden="true"><path fill="{color}" d="{d}"/></svg>')


QSTAR = ('<svg class="q-star" viewBox="20 20 160 160" aria-hidden="true"><path fill="#ECECEC" d="M20 100.002c41.21 6.266 54.993 20.886 54.993 20.886'
         'C92.289 135.827 99.952 180 99.952 180h.097s7.896-44.037 24.958-59.111c0 0 13.783-14.62 54.993-20.886v-.005c-41.21-6.266-54.993-20.886'
         '-54.993-20.886C107.944 64.037 100.048 20 100.048 20h-.097s-7.663 44.173-24.958 59.111c0 0-13.783 14.62-54.993 20.886"/></svg>')

MASKS = [
    ("31.499 20 137.001 160.001", "M166.344 54.704c-1.805-4.794-4.774-9.353-9.025-13.403-11.189-10.658-30.812-17.352-48.765-20.236-47.41-7.615-75.151 27.098-76.986 56.126-.874 13.824 6.889 27.31 7.497 41.175.652 14.878-5.574 29.557-2.586 44.536 1.666 8.348 8.576 13.214 20.06 15.16 34.353 5.821 80.34-1.147 97.585-25.256 4.83-6.752 6.951-14.461 7.698-21.959.881-8.85-1.181-17.654-1.463-26.49-.268-8.412 2.606-16.449 5.664-24.509 3.091-8.151 3.392-16.986.321-25.144z"),
    ("23.999 20.502 152 158.998", "M33.758 60.174c-17.32 24.757-8.751 62.067 3.819 86.859 7.773 15.332 21.838 35.886 46.141 31.984 5.526-.887 10.586-3.167 16.054-4.271 16.952-3.424 36.019 4.667 51.766-1.53 6.229-2.451 11.013-6.889 14.686-11.707 11.588-15.202 12.988-35.352 3.585-51.58-6.596-11.383-18.021-20.815-22.417-32.896-4.313-11.851-1.286-24.74-4.481-36.828-3.886-14.703-20.471-25.243-37.541-16.56-6.449 3.28-11.975 7.686-19.005 10.185-7.319 2.602-15.435 3.282-22.862 5.674-13.94 4.488-23.516 11.767-29.745 20.67z"),
    ("29 19.5 141.999 161", "M163.48 149.089c-3.142 5.751-7.246 11.149-12.269 15.796-26.945 24.934-76.944 17.631-101.523-5.189-14.614-13.568-20.657-31.02-20.688-48.062-.031-17.043 5.55-33.842 12.254-50.216 5.594-13.664 13.12-28.229 30.105-35.891 14.06-6.342 31.878-6.624 48.493-5.541 10.31.672 20.929 1.886 29.584 5.895 8.655 4.009 14.841 11.483 12.468 18.594-1.724 5.168-7.406 9.13-11.404 13.628-8.564 9.635-9.104 22.55-1.36 32.522 7.174 9.238 21.258 16.523 21.802 27.823.479 9.915-2.082 20.794-7.462 30.641z"),
]


def mask_css(i):
    vb, d = MASKS[i]
    svg = f"<svg xmlns='http://www.w3.org/2000/svg' viewBox='{vb}' preserveAspectRatio='none'><path d='{d}'/></svg>"
    return "url(&quot;data:image/svg+xml," + svg.replace("<", "%3C").replace(">", "%3E") + "&quot;)"


# Mesures relevées sur la page originale (largeur de référence 1265 px, panneaux de 1105 px)
ARTIST_LAYOUT = [
    dict(left=True, pw=309, ph=361, px=77, tx=482, tw=369, pt=54, h=489, top="tr", bot="br"),
    dict(left=False, pw=352, ph=368, px=494, tx=95, tw=348, pt=71, h=507, top="tl", bot="bl"),
    dict(left=True, pw=316, ph=359, px=74, tx=495, tw=348, pt=58, h=490, top="tr", bot="bl"),
]
BANDS = [("4d47d3_961237f0dea8435881e62aefd6b5da6e~mv2.jpg", 349, "Le Cabaret Origamique"),
         ("4d47d3_61cc470ef1f845a8bdd6e7f9eae5e220~mv2.jpg", 327, "L'Équilibre de mon déséquilibre"),
         ("4d47d3_430eae21e8df4b318b5c31db64b37ba8~mv2.jpg", 331, "Oups, j'ai percuté une vache !"),
         ("4d47d3_58de7f5a43954103890858434dcf48bc~mv2.jpg", 357, "La compagnie Origami")]
ARROW = '<svg viewBox="0 0 200 200" aria-hidden="true"><path fill="currentColor" d="M147 77l-1.7 1.9 21.1 20H28.5v2.3h137.9L145.7 121l1.7 2 24.1-22.8L147 77z"/></svg>'


def band(i):
    m, h, alt = BANDS[i]
    return f'<div class="q-band" style="--h:{h}"><div class="q-band-img">{pic(m, alt, 1400)}</div></div>'


def artist_panel(i, a, L):
    mk = mask_css(i)
    photo = (f'<figure class="q-photo" style="--pw:{L["pw"]};--ph:{L["ph"]};-webkit-mask-image:{mk};mask-image:{mk}">'
             f'{pic(a["photo"], a["name"], 800)}</figure>')
    txt = (f'<div class="q-atxt" style="--tw:{L["tw"]}"><h3>{E(a["name"])}</h3>'
           f'<p class="q-role">{E(a["role"])}</p><p class="q-bio">{a["bio"]}</p></div>')
    if L["left"]:
        inner, start, gap = photo + txt, L["px"], L["tx"] - L["px"] - L["pw"]
    else:
        inner, start, gap = txt + photo, L["tx"], L["px"] - L["tx"] - L["tw"]
    cls = "q-panel q-artist" + ("" if L["left"] else " right")
    style = f'--h:{L["h"]};--pt:{L["pt"]};--start:{start};--gap:{gap}'
    return (f'<section class="{cls}" style="{style}">{shape(L["top"], "#9781FF", 304, .22)}'
            f'{shape(L["bot"], "#9781FF", 142, .21)}<div class="q-in">{inner}</div></section>')


def page_qui():
    com = "".join(f"<li>{r} : {n}</li>" for r, n in COMMITTEE)
    parts = []
    for i, (a, L) in enumerate(zip(ARTISTS, ARTIST_LAYOUT)):
        parts.append(artist_panel(i, a, L))
        parts.append(band(i + 1))
    hist_rows = ""
    for y, t, sub, l in HISTORY:
        if not l and y in SOUV_BY_YEAR:
            l = SOUV_BY_YEAR[y]["slug"]
        btn = f'<a class="q-hbtn" href="{href(l)}">en savoir plus {ARROW}</a>' if l else ""
        subp = f"<p>{E(sub)}</p>" if sub else ""
        hist_rows += (f'<li><span class="q-year">{y}</span><span class="q-dot" aria-hidden="true"></span>'
                      f'<div class="q-htxt"><p>{t}</p>{subp}</div>{btn}</li>')
    s1 = QSTAR.replace("q-star", "q-star s1")
    s2 = QSTAR.replace("q-star", "q-star s2")
    s3 = QSTAR.replace("q-star", "q-star s3")
    top_img = pic("4d47d3_21e1d6283d5c4a71b7a01b6c4663adac~mv2.jpg", "La compagnie Origami", 1920, eager=True)
    return f"""<main class="qui">
<section class="q-top">{top_img}<div class="stage">{s1}{s2}</div>{shape("br", "#9781FF", 200, .17, wave=False)}</section>
<section class="q-title"><span class="h-hero-bg" aria-hidden="true"></span>{shape("br", "#9781FF", 90, .25, wave=False)}
<div class="stage"><div class="q-frame"><h1>Qui sommes nous</h1><span class="q-vline" aria-hidden="true"></span>
<p class="q-intro">Nous sommes nulle part et partout à la fois, autant dans la bêtise que dans la poésie. Autant dans un vaisseau spatial que sur terre, à porter le monde en équilibre sur un bras.<br>Nous sommes le problème et la solution à la fois !<br>Nous sommes… nous sommes…</p></div>{s3}</div></section>
<section class="q-body"><span class="h-hero-bg" aria-hidden="true"></span>{shape("tl", "#9781FF", 86, .26, wave=False)}
<div class="stage q-col">
<section class="q-panel q-cie" style="--h:603">{shape("tr", "#9781FF", 304, .09)}{shape("bl", "#9781FF", 142, .21)}<div class="q-in">
<h2>La compagnie Origami</h2>
<div class="q-text"><p>La Cie Origami est une compagnie de cirque contemporain née en 2018, animée par une envie de liberté artistique et de partager ses créations avec le plus grand nombre. Depuis ses débuts, la compagnie intervient autant en salle, sous chapiteau qu'en rue…</p>
<p><strong>Vous faites des origamis ?</strong> Non, on crée des spectacles. C'est presque pareil, hein !<br>Parce que, comme l'art du pliage de papier, la création d'un spectacle transforme des idées simples en formes surprenantes. Chaque spectacle est pour nous un pliage, une construction minutieuse qui prend vie sur scène.</p>
<p>Implantée en Suisse, la Cie Origami est structurée en association pour offrir un cadre administratif à ses projets artistiques.</p></div>
<div class="q-com"><p>Comité de l'association Origami</p><ul>{com}</ul></div></div></section>
{band(0)}
<div class="q-starrow">{QSTAR}</div>
{"".join(parts)}
<div class="q-starrow">{QSTAR}</div>
<section class="q-panel q-hist">{shape("tr", "#9781FF", 304, .21)}{shape("bl", "#9781FF", 142, .21)}<div class="q-in">
<h2 class="q-htitle">Historique</h2><ol class="q-hlist">{hist_rows}</ol></div></section>
<div class="q-starrow last">{QSTAR}</div>
</div></section></main>"""


# ---------------------------------------------------------------- pages souvenirs (liées depuis l'historique)

SOUVENIRS = [
    dict(slug="lhbp", year="2018", title="L'Homme bande passante", status="Création 2018", by="De et par Sévane Gurunlian",
         meta="Comédie · Expérimentation sonore, monocycle et acrobatie · 30 minutes", hero="4d47d3_85bf461adcdc4b2fad9eed0058d62a9f~mv2.jpg",
         portraits=[], gallery=["4d47d3_6dbdde03aab3458b87f1d93f37472ae2~mv2.jpg", "4d47d3_fef26f5c5fcc4ef58ee563ecf362b59c~mv2.jpg"],
         quote="On crée, on imagine et on compose des univers à l'aide de tout ce qui nous entoure.",
         body=["Un spectacle de mime et de son, sans une parole. Sur une scène presque vide, quatre enceintes et un interprète suffisent à faire naître tout un univers.",
               "Le personnage, un peu clownesque, raconte son monde par le geste et par les sons, à travers des situations du quotidien… et des gaffes qui finissent toujours par le rattraper.",
               "Et la « bande passante » ? En électronique, c'est une histoire de fréquences. Ici, ça n'a absolument rien à voir."],
         credits="Création et interprétation : Sévane Gurunlian",
         dates_title="Dates 2019",
         dates=[("2019-03-15", "15 mars 2019", "La Griotte (sortie de résidence)"), ("2019-03-29", "29 mars 2019", "BuroSpace (sortie de résidence)"),
                ("2019-05-11", "11 mai 2019", "Dôme de la bulle d'art"), ("2019-05-18", "18 mai 2019", "École de cirque Taj'um"),
                ("2019-06-01", "1er juin 2019", "Centre culturel de Porteous"), ("2019-06-15", "15 juin 2019", "Festiv'art"),
                ("2019-07-03", "3 juillet 2019", "Festival Chatôbruyant"), ("2019-07-07", "7 juillet 2019", "Festival Chatôbruyant"), ("2019-07-10", "10 juillet 2019", "Festival Chatôbruyant"),
                ("2019-10-05", "5 octobre 2019", "Festival du Théâtre-Cirqule"), ("2019-10-06", "6 octobre 2019", "Festival du Théâtre-Cirqule"),
                ("2019-12-06", "6 décembre 2019", "Salle communale de Veyrier"), ("2019-12-14", "14 décembre 2019", "La Cantine")]),
    dict(slug="oc", year="2020", title="Origami Circus", status="Tournée été 2020", by="Avec Anouck Simon, Teddy Marguerat et Sévane Gurunlian",
         meta="Comédie · Spectacle pluridisciplinaire · 45 minutes", hero="4d47d3_6533ecdcc47345d0a8cb6434203bbc87~mv2.jpg", quote="",
         portraits=[("4d47d3_a984ef424ec4424d9d76f26af0bd4ceb~mv2.png", "Anouck Simon"), ("4d47d3_a4c8e32a82814017912117e20249a331~mv2.png", "Teddy Marguerat"),
                    ("4d47d3_2cf6ce7081444099ad0815e75b537a76~mv2.png", "Sévane Gurunlian")],
         gallery=["4d47d3_502699986c444ebcb5dc515e71348082~mv2.png", "4d47d3_b5cf5a86e60e4279b7c98e16e8badbf1~mv2.jpg",
                  "4d47d3_a6d1c4660e884350bf321d156d09a27ef000.jpg", "4d47d3_828d24fe9cfa450ab742657d3ad83627~mv2.png"],
         body=["Trois saltimbanques aux caractères (très) explosifs, et une histoire qui les pousse à se demander qui ils sont, et comment ils s'y prennent.",
               "Clown, danse, jonglage, équilibres sur cannes, effets magiques et monocycle : un spectacle pluridisciplinaire de 45 minutes, joué tout l'été 2020 en France."],
         credits="Anouck Simon, Teddy Marguerat et Sévane Gurunlian",
         dates_title="La tournée de l'été 2020",
         dates=[(f"2020-{m:02d}-{d:02d}", f"{d} {'juillet' if m == 7 else 'août'} 2020", w) for m, d, w in [
             (7, 6, "Talaris, Lacanau"), (7, 9, "Colvert, Vielle-Saint-Girons"), (7, 13, "Soubeyranne, Remoulins"), (7, 14, "Regnière, Villette-d'Anthon"),
             (7, 16, "Le Gibanel, Argentat-sur-Dordogne"), (7, 19, "Pineda, La Teste-de-Buch"), (7, 20, "Roumingue, Lanton"), (7, 21, "Bazas"),
             (7, 23, "Colvert, Vielle-Saint-Girons"), (7, 26, "Séquoia, Saint-Just-Luzac"), (7, 27, "Bois Soleil"), (7, 28, "La Loubine, Olonne-sur-Mer"),
             (7, 29, "Émeraude, Saint-Briac-sur-Mer"), (8, 3, "Roumingue, Lanton"), (8, 4, "Pineda, La Teste-de-Buch"), (8, 5, "Le Gibanel, Argentat-sur-Dordogne"),
             (8, 10, "Colvert, Vielle-Saint-Girons"), (8, 11, "Bois Soleil"), (8, 12, "Les Huttes, Saint-Denis-d'Oléron"), (8, 13, "Les Chênes, Médis"),
             (8, 14, "Céleste, Breuillet"), (8, 16, "Bazas"), (8, 17, "Roumingue, Lanton"), (8, 18, "Talaris, Lacanau"), (8, 19, "Le Trianon, Les Sables-d'Olonne"),
             (8, 20, "Vikings, Saint-Jean-de-la-Rivière"), (8, 25, "Émeraude, Saint-Briac-sur-Mer")]]),
]
SOUV_BY_YEAR = {d["year"]: d for d in SOUVENIRS}


def page_souvenir(d):
    body = "".join(f"<p>{p}</p>" for p in d["body"])
    meta = "".join(f"<span>{E(m)}</span>" for m in d["meta"].split(" · "))
    quote = f'<blockquote class="show-quote"><p>« {E(d["quote"])} »</p></blockquote>' if d["quote"] else ""
    trio = ""
    if d["portraits"]:
        figs = "".join(f'<figure>{pic(m, n, 500)}<figcaption>{E(n)}</figcaption></figure>' for m, n in d["portraits"])
        trio = f'<section class="band"><div class="wrap souv-trio">{figs}</div></section>'
    gal = ""
    if d["gallery"]:
        gal = f'<section class="band"><div class="wrap"><div class="gallery souv-gal">{gallery(d["gallery"], d["title"])}</div></div></section>'
    dates = f'<ul class="dates">{"".join(date_row(*x) for x in d["dates"])}</ul>'
    return f"""<main>
<section class="show-hero">{pic(d['hero'], d['title'], 2000, eager=True)}<div class="wrap">
<a class="back" href="quisommesnous.html">← Qui sommes nous</a><div class="show-status"><span class="tag">{E(d['status'])}</span></div>
<h1>{E(d['title'])}</h1><p class="who">{E(d['by'])}</p><div class="show-meta">{meta}</div></div></section>
<section class="bg-violet band"><div class="wrap narrow show-text justify">{body}{quote}</div></section>{trio}
<section class="band"><div class="wrap links">
<div><h2>Équipe</h2><p class="credits-txt">{E(d['credits'])}</p></div>
<div><h2>Contact</h2><p>Pour toute question : <span class="sel">{SITE['email']}</span> · <span class="sel">{SITE['phone']}</span></p></div>
</div></section>{gal}
<section class="bg-grey band dates-sec"><div class="wrap narrow"><h2>{E(d['dates_title'])}</h2>{dates}</div></section></main>"""


def page_collabs():
    groups = ""
    for gi, (title, items) in enumerate(COLLABS):
        li = "".join(f"""<li><h3>{('<a href="' + u + '" rel="noopener">' + E(n) + '</a>') if u else E(n)}</h3><p>{E(t)}</p></li>""" for n, u, t in items)
        deco = f'<span class="c-deco" aria-hidden="true">{pic(PARTNER_LOGOS[gi], "", 400)}</span>' if gi < len(PARTNER_LOGOS) else ""
        groups += f'<div class="c-group{" has-deco" if deco else ""}">{deco}<h2>{E(title)}</h2><ul class="c-list">{li}</ul></div>'
    crew = "".join(f"<li><strong>{E(s['title'])}</strong><span class='muted'>{E(s['credits'])}</span></li>" for s in SHOWS)
    sup = "".join(f'<li><a href="{u}" rel="noopener">{E(n)}</a></li>' for n, u in SUPPORTERS)
    return f"""<main><section class="bg-hero page-top"><span class="fx" aria-hidden="true"></span><div class="wrap"><div class="frame title-frame">
<h1 class="t-serif">Collaborations</h1>
<p class="intro">Nous tenons à remercier ici un maximum de personnes et d'organisations qui rendent nos projets possibles, nos amis qui partagent nos aventures artistiques, et les petites mains qui apportent leur magie, déplacent du matériel, montent les décors et rendent nos projets vivants.</p></div></div></section>
{STAR}
<section class="band"><div class="wrap"><h2 class="sec-title">Merci à vous :</h2>{groups}</div></section>
<section class="bg-violet slant-both"><div class="wrap"><h2 class="sec-title">Nous ont soutenus</h2><ul class="supporters">{sup}</ul></div></section>
<section class="band"><div class="wrap narrow"><h2 class="sec-title">Des artistes lors des spectacles et créations</h2><ul class="crew">{crew}</ul></div></section></main>"""


def page_contact():
    addr = "<br>".join(E(a) for a in SITE["address"])
    opts = "".join(f"<option>{E(s['title'])}</option>" for s in SHOWS if s["status"] != "Répertoire")
    return f"""<main class="bg-blue"><section class="band"><div class="wrap contact-grid">
<div class="contact-info"><img class="contact-logo" src="{LOGO_SRC}" alt="Compagnie Origami" width="313" height="56">
<h1 class="t-serif">Nous contacter</h1>
<p style="margin-top:1rem">{addr}</p>
<h2>E-mail</h2><p class="sel">{SITE['email']}</p><button class="copy" type="button" data-copy="{SITE['email']}">Copier l'adresse</button>
<h2>Contact permanent</h2><p>{SITE['phone_name']} : <span class="sel">{SITE['phone']}</span></p>
<h2>Nous suivre</h2><p><a href="{SITE['facebook']}" rel="noopener">Facebook</a> · <a href="{SITE['instagram']}" rel="noopener">Instagram</a></p></div>
<form class="contact-form" name="contact" method="POST" data-netlify="true" netlify-honeypot="bot-field">
<h2>Rédigez un message</h2>
<input type="hidden" name="form-name" value="contact"><p hidden><label>Ne pas remplir <input name="bot-field"></label></p>
<div class="field"><label for="c-name">Nom</label><input id="c-name" name="nom" required autocomplete="name"></div>
<div class="field"><label for="c-email">E-mail</label><input id="c-email" type="email" name="email" required autocomplete="email"></div>
<div class="field"><label for="c-show">Spectacle concerné – facultatif</label><select id="c-show" name="spectacle"><option value="">—</option>{opts}<option>Autre</option></select></div>
<div class="field"><label for="c-msg">Message</label><textarea id="c-msg" name="message" rows="6" required></textarea></div>
<div><button class="pill" type="submit">Envoyer</button></div><p class="form-note" hidden></p></form>
</div></section><section class="band"><div class="wrap narrow"><form class="news" name="newsletter" method="POST" data-netlify="true" netlify-honeypot="bot-field">
<h2 class="sec-title" style="flex-basis:100%;margin:0">Newsletter</h2><p class="small" style="flex-basis:100%;margin:0">Nous donnons de temps en temps des infos sur nos avancées, nouvelles dates et créations. Cette newsletter qui n'arrive pas tous les deux jours, promis, permet de garder l'œil ouvert sur nos travaux.</p>
<input type="hidden" name="form-name" value="newsletter"><p hidden><label>Ne pas remplir <input name="bot-field"></label></p>
<label class="sr" for="news-email">Votre e-mail</label><input id="news-email" type="email" name="email" placeholder="Votre e-mail" required>
<button class="pill" type="submit">S'abonner</button><p class="form-note" hidden></p></form>
</div></section></main>"""


def page_404():
    return f"""<main><section class="bg-hero page-top"><span class="fx" aria-hidden="true"></span><div class="wrap"><div class="frame title-frame"><h1 class="t-serif">Oups !</h1>
<p class="intro">Cette page s'est dépliée ailleurs. Elle a peut-être changé d'adresse avec le nouveau site.</p></div>
<p style="margin-top:2rem"><a class="pill" href="index.html">Retour à l'accueil</a></p></div></section></main>"""


SCRIPT = """<div class="lightbox" hidden><button class="lb-close" type="button" aria-label="Fermer">×</button><img alt=""></div>
<script>
(function(){
 var lb=document.querySelector('.lightbox'),li=lb.querySelector('img');
 document.addEventListener('click',function(e){
  var g=e.target.closest('.g-item'); if(g){li.src=g.dataset.full;li.alt=g.querySelector('img').alt;lb.hidden=false;return;}
  if(e.target===lb||e.target.closest('.lb-close')){lb.hidden=true;li.src='';}
  var c=e.target.closest('.copy'); if(c){try{navigator.clipboard.writeText(c.dataset.copy).then(function(){c.textContent='Copié !';setTimeout(function(){c.textContent="Copier l'adresse"},1800)},function(){})}catch(err){}}
 });
 document.addEventListener('click',function(e){var a=e.target.closest('.g-arrow');if(!a)return;var t=a.parentElement.querySelector('.h-gal-track');t.scrollBy({left:(a.classList.contains('next')?1:-1)*t.clientWidth*.7,behavior:'smooth'});});
 document.addEventListener('keydown',function(e){if(e.key==='Escape'){lb.hidden=true;}});
 document.querySelectorAll('.menu nav a').forEach(function(a){a.addEventListener('click',function(){a.closest('details').open=false})});
 %PREVIEW%

 var pl=document.querySelectorAll('.pin-logo'),lastY=scrollY;addEventListener('scroll',function(){var y=scrollY;pl.forEach(function(l){l.classList.toggle('pin-hide',y>120&&y>lastY)});lastY=y;},{passive:true});
 var hd=document.querySelectorAll('.site-head');function hs(){var on=scrollY>60;hd.forEach(function(h){h.classList.toggle('scrolled',on)})}addEventListener('scroll',hs,{passive:true});hs();
 /* œil et étoiles : un tour complet (-180° → +180°) et réduction à 70 % pendant la traversée de l'écran, comme sur le site original */
 var spinReduce=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;
 function spin(){if(spinReduce)return;var h=innerHeight;document.querySelectorAll('.h-eye,.h-star-svg,.star svg,.q-star').forEach(function(el){if(!el.getClientRects().length)return;var r=el.getBoundingClientRect();var p=(h-r.top)/(h+r.height);p=Math.max(0,Math.min(1,p));el.style.setProperty('--rot',(-180+360*p).toFixed(1)+'deg');el.style.setProperty('--sc',(1-0.3*p).toFixed(3));});}
 var spinTick=false;addEventListener('scroll',function(){if(!spinTick){spinTick=true;requestAnimationFrame(function(){spinTick=false;spin();});}},{passive:true});addEventListener('resize',spin);addEventListener('hashchange',function(){setTimeout(spin,60)});spin();
 /* effets : apparitions au défilement + parallaxe (inspirés du site original) */
 var reduce=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;
 if(!reduce&&'IntersectionObserver' in window){
  var groups=[['.panel,.q-in,.h-txt,.h-frame,.h-end-box,.artist>div,.c-group,.links>div,.contact-info,.contact-form,.quote-band .wrap,.show-text','rv'],
   ['.h-title h2,.sec-title,.page-top .t-serif,.year','rv-glide'],
   ['.date,.history li,.c-list li,.crew li,.h-bullets li,.supporters li','rv-up'],
   ];
  var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target);}})},{rootMargin:'0px 0px -8% 0px'});
  window.__fxScan=function(root){groups.forEach(function(g){(root||document).querySelectorAll(g[0]).forEach(function(el,i){
    if(el.dataset.fx)return;el.dataset.fx=1;var r=el.getBoundingClientRect();if(r.top<innerHeight*0.92&&r.bottom>0&&el.offsetParent)return;
    el.classList.add(g[1]);var sib=el.parentElement?[].indexOf.call(el.parentElement.children,el):0;el.style.setProperty('--d',(Math.min(sib,6)*80)+'ms');io.observe(el);});});};
  __fxScan();
  var par=[].slice.call(document.querySelectorAll('.h-img img,.show-hero>img,.q-band-img img,.lp-photo-img img'));
  var tick=false;function upd(){tick=false;var h=innerHeight;par.forEach(function(im){var r=im.parentElement.getBoundingClientRect();if(r.bottom<0||r.top>h||!im.offsetParent)return;var c=(r.top+r.height/2-h/2)/h;im.style.setProperty('--py',(c*-60).toFixed(1)+'px');});}
  addEventListener('scroll',function(){if(!tick){tick=true;requestAnimationFrame(upd)}},{passive:true});upd();
 }
})();
</script>"""

PREVIEW_JS = """
 document.addEventListener('submit',function(e){e.preventDefault();var n=e.target.querySelector('.form-note');if(n){n.hidden=false;n.textContent="Aperçu : le formulaire fonctionnera une fois le site en ligne sur Netlify.";}});
 function miss(im){if(im.src.indexOf('data:')===0)return;im.classList.add('noimg');var w=im.closest('figure,.img,.g-item,.card,.show-hero');if(w)w.classList.add('noimg-wrap');}
 document.querySelectorAll('img').forEach(function(im){if(im.complete&&!im.naturalWidth){miss(im)}else{im.addEventListener('error',function(){miss(im)})}});
 function route(){var id=(location.hash||'#accueil').slice(1);var found=false;
  document.querySelectorAll('.page').forEach(function(p){var on=p.id===id;p.hidden=!on;if(on)found=true;});
  if(!found){document.getElementById('accueil').hidden=false;}
  window.scrollTo(0,0);if(window.__fxScan)setTimeout(function(){__fxScan()},30);}
 window.addEventListener('hashchange',route);route();
"""


def pages():
    ps = [("index", SITE["name"], SITE["description"], page_index, None),
          ("spectacles", "Spectacles", "Tous les spectacles de la Cie Origami : cirque-théâtre, cabaret de rue, solos et créations.", page_spectacles, None),
          ("agenda", "Agenda", "Toutes les dates des spectacles de la Cie Origami.", page_agenda, None),
          ("quisommesnous", "Qui sommes nous", "Qui est la Cie Origami ? Compagnie de cirque contemporain née à Genève en 2018.", page_qui, None),
          ("collabs", "Collaborations", "Quelles sont les collaborations de la Cie Origami.", page_collabs, None),
          ("contact", "Contact", "Nous contacter !", page_contact, None)]
    for s in SHOWS:
        ps.append((s["slug"], s["title"], f"{s['title']} – {s['genre']}. {s['teaser']}", (lambda s=s: page_show(s)), s["hero"]))
    for d in SOUVENIRS:
        ps.append((d["slug"], d["title"], f"{d['title']} ({d['year']}) – {d['status']} de la Cie Origami.", (lambda d=d: page_souvenir(d)), d["hero"]))
    return ps


def active_for(slug):
    if slug in {d["slug"] for d in SOUVENIRS}:
        return "quisommesnous"
    return "spectacles" if slug in SHOW_BY_SLUG else slug


def build():
    if os.path.exists(DIST):
        shutil.rmtree(DIST)
    os.makedirs(DIST)
    shutil.copy(os.path.join(HERE, "style.css"), DIST)
    shutil.copy(os.path.join(ROOT, "logo.svg"), DIST)
    with open(os.path.join(DIST, "favicon.svg"), "w") as f:
        f.write('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><rect width="40" height="40" rx="6" fill="#281467"/><path d="M20 5C21 14 26 19 35 20C26 21 21 26 20 35C19 26 14 21 5 20C14 19 19 14 20 5Z" fill="#fff"/></svg>')
    script = SCRIPT.replace("%PREVIEW%", "")
    for slug, title, desc, fn, og in pages():
        path = "" if slug == "index" else slug
        with open(os.path.join(DIST, f"{slug}.html"), "w") as f:
            f.write(head(title, desc, path, og) + header(active_for(slug)) + fn() + footer() + script + "</body></html>")
    with open(os.path.join(DIST, "404.html"), "w") as f:
        f.write(head("Page introuvable", "", "404") + header("") + page_404() + footer() + script + "</body></html>")
    with open(os.path.join(DIST, "_redirects"), "w") as f:
        f.write("\n".join(f"{a}  {b}  301" for a, b in REDIRECTS.items()) + "\n")
    urls = "".join(f"<url><loc>{SITE['url']}/{'' if s == 'index' else s}</loc></url>" for s, *_ in pages())
    with open(os.path.join(DIST, "sitemap.xml"), "w") as f:
        f.write(f'<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">{urls}</urlset>')
    with open(os.path.join(DIST, "robots.txt"), "w") as f:
        f.write(f"User-agent: *\nAllow: /\nSitemap: {SITE['url']}/sitemap.xml\n")
    print("site:", len(os.listdir(DIST)), "fichiers")


def build_preview():
    global LOGO_SRC
    LOGO_SRC = "data:image/svg+xml;base64," + base64.b64encode(open(os.path.join(ROOT, "logo.svg"), "rb").read()).decode()
    css = open(os.path.join(HERE, "style.css")).read()
    secs = "".join(f'<div class="page" id="{"accueil" if slug == "index" else slug}" hidden>{header(active_for(slug))}{fn()}</div>' for slug, title, desc, fn, og in pages())
    note = '<p class="preview-note">Aperçu de travail · les photos (encore hébergées chez Wix) s\'affichent sur le site en ligne, pas dans cet aperçu.</p>'
    body = note + secs + footer() + SCRIPT.replace("%PREVIEW%", PREVIEW_JS)
    body = re.sub(r'<div class="vid-frame"><iframe src="https://player.vimeo.com/video/(\d+)[^"]*"[^>]*></iframe></div>',
                  r'<a class="vid-link" href="https://vimeo.com/\1" rel="noopener">▶ Voir la vidéo sur Vimeo</a>', body)
    body = body.replace('href="index.html"', 'href="#accueil"')
    body = re.sub(r'href="([a-z0-9\-]+)\.html"', r'href="#\1"', body)
    with open(os.path.join(HERE, "preview.html"), "w") as f:
        f.write(f'<title>Cie Origami</title>\n<link rel="stylesheet" href="{FONTS}">\n<style>{css}</style>{body}')
    LOGO_SRC = "logo.svg"
    print("preview.html ok")


if __name__ == "__main__":
    build()
    if "--preview" in sys.argv:
        build_preview()
