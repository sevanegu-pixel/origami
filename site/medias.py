# -*- coding: utf-8 -*-
"""Photos, vidéos et PDF du site, servis depuis le site lui-même (plus depuis Wix).

Les originaux (pleine résolution) sont archivés sur la branche claude/project-thread-54q71i,
dossier site/media/. Ils sont trop lourds pour le web : ce script en fabrique des versions
allégées, qu'on garde dans le dépôt :

    python3 medias.py <dossier des originaux>     # ex. .../site/media

-> photos/<id>-<largeur>.webp (3 largeurs), videos/<id>.mp4 (720p, sans son), fichiers/<id>.pdf
Besoin de Pillow (photos) et ffmpeg (vidéos) ; le site lui-même se construit sans eux.
"""
import os, re

HERE = os.path.dirname(os.path.abspath(__file__))
WIDTHS = (500, 900, 1800)


def photo_id(mid):
    """'4d47d3_abc~mv2.jpg' -> '4d47d3_abc'"""
    return re.sub(r"(~mv2)?\.[a-z]+$", "", mid)


def photo(mid, w=1400, absolute=False):
    """Adresse de la photo, vue depuis une page d'une version (dist/<version>/page.html)."""
    size = next((x for x in WIDTHS if w <= x), WIDTHS[-1])
    name = f"{photo_id(mid)}-{size}.webp"
    if not os.path.exists(os.path.join(HERE, "photos", name)):
        raise SystemExit(f"photo manquante : {mid} (lancer medias.py sur les originaux)")
    if absolute:  # og:image : adresse complète
        from content import SITE
        return f'{SITE["url"]}/photos/{name}'
    return f"../photos/{name}"


def video(vid):
    return f"../videos/{vid}.mp4"


def make(src):
    import subprocess
    from PIL import Image, ImageOps
    for d in ("photos", "videos", "fichiers"):
        os.makedirs(os.path.join(HERE, d), exist_ok=True)
    for f in sorted(os.listdir(os.path.join(src, "images"))):
        base = photo_id(f)
        im = ImageOps.exif_transpose(Image.open(os.path.join(src, "images", f)))
        im = im.convert("RGBA" if "A" in im.getbands() or im.mode == "P" else "RGB")
        for w in WIDTHS:
            out = os.path.join(HERE, "photos", f"{base}-{w}.webp")
            if os.path.exists(out):
                continue
            c = im.copy()
            c.thumbnail((w, w * 4), Image.LANCZOS)  # largeur max w, jamais agrandie
            c.save(out, "WEBP", quality=80, method=6)
    for f in sorted(os.listdir(os.path.join(src, "videos"))):
        out = os.path.join(HERE, "videos", f)
        if not os.path.exists(out):
            subprocess.run(["ffmpeg", "-v", "error", "-i", os.path.join(src, "videos", f), "-an", "-vf",
                            "scale='if(gt(iw,ih),-2,720)':'if(gt(iw,ih),720,-2)'", "-c:v", "libx264",
                            "-crf", "28", "-preset", "slow", "-movflags", "+faststart", out], check=True)
    for f in sorted(os.listdir(os.path.join(src, "pdf"))):
        out = os.path.join(HERE, "fichiers", f)
        if not os.path.exists(out):
            with open(os.path.join(src, "pdf", f), "rb") as a, open(out, "wb") as b:
                b.write(a.read())


if __name__ == "__main__":
    import sys
    make(sys.argv[1])
