# -*- coding: utf-8 -*-
"""Prépare les personnages croqués (dessins de la page Collaborations) pour la version « Croquis ».

    python3 dessins.py   -> dessins/*.png  (traits clairs sur fond transparent, découpés en pièces)

Source : les dessins originaux déjà dans site/photos/. Aucun dessin n'est inventé :
on éclaircit les traits et on sépare les pièces qui bougent (roue, voltigeur·euse, seau).
Besoin de Pillow, une seule fois ; le site se construit sans.

Les fichiers velo-*.png (monocycle croqué, p. 13) et seum-*.png (titre, oursin, traits de
pinceau) viennent du dossier de création de Des pâtes au seum (PDF sur le Drive de la
compagnie) : découpés une fois à la main, ce script ne les refabrique pas.
"""
import os
from PIL import Image, ImageChops, ImageDraw, ImageOps

HERE = os.path.dirname(os.path.abspath(__file__))
PHOTOS = os.path.join(os.path.dirname(os.path.dirname(HERE)), "photos")
OUT = os.path.join(HERE, "dessins")
INK = (243, 239, 252)

SRC = {  # nom -> (photo, largeur utilisée)
    "duo": ("4d47d3_91d600e84faa4d608ad9a667ea0c93d7-1800.webp", 2),   # deux danseurs, réduit de moitié
    "tour": ("4d47d3_a38192f979a7435082b38a72360a2229-500.webp", 1),  # porté tête sur tête
    "mono": ("4d47d3_091a05bf3adc48a8828a5d3f626173ce-500.webp", 1),  # monocycle + voltigeuse
    "seau": ("4d47d3_7e15a8e634b14f7cb49c4640e46ea2e4-500.webp", 1),  # équilibre sur un seau
}


def traits(name):
    f, k = SRC[name]
    im = Image.open(os.path.join(PHOTOS, f))
    g = ImageOps.grayscale(im.convert("RGB"))
    if im.mode == "RGBA":
        alpha = ImageChops.multiply(im.getchannel("A"), Image.eval(g, lambda v: 255 - v))
    else:
        alpha = Image.eval(g, lambda v: max(0, min(255, int((225 - v) * 1.25))))
    out = Image.new("RGBA", im.size, INK + (0,))
    out.putalpha(alpha)
    if k != 1:
        out = out.resize((out.width // k, out.height // k), Image.LANCZOS)
    return out


def piece(im, keep):
    """keep : masque 'L' (blanc = garder)."""
    out = im.copy()
    out.putalpha(ImageChops.multiply(im.getchannel("A"), keep))
    return out


def mask(size, draw_fn, invert=False):
    m = Image.new("L", size, 0)
    draw_fn(ImageDraw.Draw(m))
    return ImageOps.invert(m) if invert else m


def save(im, name):
    im.save(os.path.join(OUT, name + ".png"), optimize=True)


def main():
    os.makedirs(OUT, exist_ok=True)
    save(traits("duo"), "duo")
    t = traits("tour")
    top = lambda d: d.rectangle((0, 0, t.width, 122), fill=255)
    save(piece(t, mask(t.size, top)), "tour-haut")
    save(piece(t, mask(t.size, top, True)), "tour-bas")
    m = traits("mono")
    vol = lambda d: (d.rectangle((0, 0, m.width, 140), fill=255), d.rectangle((0, 140, 138, 188), fill=255))
    roue = lambda d: d.ellipse((238 - 39, 434 - 39, 238 + 39, 434 + 39), fill=255)
    save(piece(m, mask(m.size, vol)), "mono-voltige")
    save(piece(m, mask(m.size, roue)), "mono-roue")
    rest = ImageChops.multiply(mask(m.size, vol, True), mask(m.size, roue, True))
    save(piece(m, rest), "mono-cycliste")
    s = traits("seau")
    bas = lambda d: d.rectangle((0, 243, s.width, s.height), fill=255)
    save(piece(s, mask(s.size, bas)), "seau-seau")
    save(piece(s, mask(s.size, bas, True)), "seau-perso")
    print("dessins :", ", ".join(sorted(os.listdir(OUT))))


if __name__ == "__main__":
    main()
