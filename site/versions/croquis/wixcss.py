# -*- coding: utf-8 -*-
"""Reprend du style.css de la version Wix les règles des sections spectacles de l'accueil
(bandeau titre, bloc, grande photo, galerie, biseaux), limitées à .wx pour ne rien casser ailleurs."""
import re

KEYS = ("h-title", "h-block", "h-img", "h-tag", "h-txt", "h-by", "h-pill", "h-wide", "h-gal", "g-col", "g-item", "g-arrow", ".dv", ".stage", "loopvid")
ROOTVARS = ("--u", "--m")


def _blocks(css):
    """Découpe en (prélude, corps) au premier niveau."""
    out, i, n = [], 0, len(css)
    while i < n:
        j = css.find("{", i)
        if j < 0:
            break
        depth, k = 1, j + 1
        while depth and k < n:
            depth += {"{": 1, "}": -1}.get(css[k], 0)
            k += 1
        out.append((css[i:j].strip(), css[j + 1:k - 1]))
        i = k
    return out


def _scope_sel(sel):
    parts = []
    for s in sel.split(","):
        s = s.strip()
        if s.startswith(".home"):
            s = ".wx" + s[5:]
        elif s == ":root":
            s = ".wx"
        else:
            s = ".wx " + s
        parts.append(s)
    return ",".join(parts)


def _rules(css, frames):
    out = []
    for pre, body in _blocks(css):
        if pre.startswith("@media") or pre.startswith("@supports"):
            inner = _rules(body, frames)
            if inner:
                out.append(f"{pre}{{{inner}}}")
        elif pre.startswith("@keyframes"):
            continue
        elif pre.startswith("@"):
            continue
        else:
            sels = [s.strip() for s in pre.split(",")]
            if pre.strip() == ":root":
                decl = ";".join(d for d in body.split(";") if d.strip().startswith(ROOTVARS))
                if decl:
                    out.append(f".wx{{{decl}}}")
                continue
            keep = [s for s in sels if any(k in s for k in KEYS) and not s.startswith(".lp") and not s.startswith(".q")]
            if not keep:
                continue
            for f in frames:
                body = re.sub(rf"\b{f}\b", "wx-" + f, body)
            out.append(f"{_scope_sel(','.join(keep))}{{{body}}}")
    return "\n".join(out)


def scoped(path):
    css = re.sub(r"/\*.*?\*/", "", open(path, encoding="utf-8").read(), flags=re.S)
    frames = re.findall(r"@keyframes\s+([\w-]+)", css)
    keyf = "\n".join(f"@keyframes wx-{name}{{{body}}}" for pre, body in _blocks(css) if pre.startswith("@keyframes")
                     for name in [pre.split()[1]])
    return keyf + "\n" + _rules(css, frames)
