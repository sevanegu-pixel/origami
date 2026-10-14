# -*- coding: utf-8 -*-
"""Fabrique toutes les versions du site de la Cie Origami, chacune dans son dossier.

    python3 build.py   -> dist/<version>/...  + un sélecteur de version sur chaque page

Chaque version a son générateur dans versions/<nom>/ (build.py + style.css).
Les textes et données sont communs : content.py.
Pour ajouter une version : copier un dossier de versions/, puis l'ajouter à VERSIONS.
Pour en supprimer une : retirer sa ligne de VERSIONS et son dossier.
"""
import importlib.util, os, re, shutil

from content import SITE, REDIRECTS

# (dossier, nom affiché) — la première est celle qu'on voit en arrivant sur le site
VERSIONS = [
    ("bancal", "Bancal · oct. 2026"),
    ("street", "Street · oct. 2026"),
    ("artcontemporain", "Art contemporain · oct. 2026"),
    ("engrenages", "Engrenages au crayon · oct. 2026"),
    ("wix", "Copie du Wix · oct. 2026"),
]
DEFAULT = VERSIONS[0][0]

HERE = os.path.dirname(os.path.abspath(__file__))
DIST = os.path.join(HERE, "dist")

BAR_CSS = """<style>
.vbar{position:fixed;left:12px;bottom:12px;z-index:2147483000;display:flex;align-items:center;gap:8px;
 background:#9781ff;color:#0b0a10;font:400 13px/1.2 "IBM Plex Mono",ui-monospace,Menlo,monospace;padding:6px 8px 6px 12px;
 border-radius:4px;transform:rotate(-1.5deg);box-shadow:0 6px 18px rgba(0,0,0,.45)}
.vbar label{white-space:nowrap}
.vbar select{font:inherit;background:#0b0a10;color:#fff;border:0;border-radius:3px;padding:4px 6px;cursor:pointer}
.vbar button{all:unset;cursor:pointer;padding:0 4px;font-size:15px}
.vbar.min label,.vbar.min select{display:none}
@media print{.vbar{display:none}}
</style>"""

BAR_JS = """<script>
(function(){var b=document.querySelector(".vbar"),s=b.querySelector("select"),t=b.querySelector("button");
 s.addEventListener("change",function(){var page=location.pathname.split("/").pop()||"index.html";location.href="../"+s.value+"/"+page;});
 try{if(localStorage.getItem("vbar-min"))b.classList.add("min")}catch(e){}
 t.addEventListener("click",function(){b.classList.toggle("min");try{b.classList.contains("min")?localStorage.setItem("vbar-min","1"):localStorage.removeItem("vbar-min")}catch(e){}});
})();
</script>"""


def bar(current):
    opts = "".join(f'<option value="{v}"{" selected" if v == current else ""}>{label}</option>' for v, label in VERSIONS)
    return (f'{BAR_CSS}<div class="vbar"><label for="vbar-s">Version</label><select id="vbar-s">{opts}</select>'
            f'<button type="button" aria-label="Réduire ou ouvrir le choix de version" title="Réduire">◐</button></div>{BAR_JS}')


def build_version(name):
    path = os.path.join(HERE, "versions", name, "build.py")
    spec = importlib.util.spec_from_file_location(f"version_{name}", path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    mod.DIST = os.path.join(DIST, name)
    mod.build()
    for f in os.listdir(mod.DIST):
        if f.endswith(".html"):
            p = os.path.join(mod.DIST, f)
            s = open(p, encoding="utf-8").read()
            s = s.replace("</body>", bar(name) + "</body>", 1)
            s = s.replace('"origami-vu"', f'"origami-vu-{name}"')  # l'ouverture se joue une fois par visite et par version
            open(p, "w", encoding="utf-8").write(s)
    # fichiers propres à la racine du site : gérés plus bas
    for f in ("_redirects", "sitemap.xml", "robots.txt"):
        fp = os.path.join(mod.DIST, f)
        if os.path.exists(fp):
            os.remove(fp)


def build():
    if os.path.exists(DIST):
        shutil.rmtree(DIST)
    os.makedirs(DIST)
    for name, _ in VERSIONS:
        build_version(name)
    # page d'erreur : celle de la version par défaut, avec ses liens qui pointent vers son dossier
    s = open(os.path.join(DIST, DEFAULT, "404.html"), encoding="utf-8").read()
    s = s.replace("<head>", f'<head><base href="/{DEFAULT}/">', 1)
    open(os.path.join(DIST, "404.html"), "w", encoding="utf-8").write(s)
    # l'adresse du site ouvre la version par défaut ; anciennes adresses Wix redirigées
    lines = [f"/  /{DEFAULT}/  302!"]
    lines += [f"{a}  /{DEFAULT}{b}.html  301" for a, b in REDIRECTS.items()]
    with open(os.path.join(DIST, "_redirects"), "w") as f:
        f.write("\n".join(lines) + "\n")
    with open(os.path.join(DIST, "index.html"), "w") as f:  # au cas où la redirection ne s'applique pas
        f.write(f'<!doctype html><meta charset="utf-8"><title>Compagnie Origami</title><meta http-equiv="refresh" content="0; url={DEFAULT}/"><a href="{DEFAULT}/">Compagnie Origami</a>')
    with open(os.path.join(DIST, "robots.txt"), "w") as f:
        f.write(f"User-agent: *\nAllow: /\n")
    print("versions :", ", ".join(v for v, _ in VERSIONS), "· par défaut :", DEFAULT)


if __name__ == "__main__":
    build()
