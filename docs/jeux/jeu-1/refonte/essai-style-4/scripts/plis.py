"""Gabarits de plis et d'encre des vêtements, dessinés à la plume (bible 0.2, 2.8).

Usage: python3 plis.py              (lancé par construire.py, avant les atlas; 10 s)

`gabarits/plis/plis.svg` -> encrage par le moteur « à la plume » de l'interface (`encrer-lot.mjs`) -> un fichier
`.travail/plis/<symbole>.npz` par tampon, un calque par nom: `encre`, `ombre`, `clair`, `z1`, `z2`, `filet`
(couverture de 0 à 1, rendu au double de la taille du dessin), plus `relief` (hauteur tirée des calques:
l'encre creuse, l'ombre creuse un peu, le clair bombe). `peindre.py` les pose sur le corps selon `plis.toml`,
et `.travail/plis/planche.png` les montre en niveaux de gris (contrôle).
"""
import json
import os
import pathlib
import re
import subprocess

import numpy as np
from PIL import Image

ICI = pathlib.Path(__file__).resolve().parent
ESSAI = ICI.parent
TRAVAIL = ESSAI / ".travail" / "plis"
CALQUES = ("encre", "ombre", "clair", "z1", "z2", "filet")
ECH = 2   # pixels par unité de dessin


def main():
    texte = (ESSAI / "gabarits" / "plis" / "plis.svg").read_text()
    syms = re.findall(r'<symbol id="([a-z-]+)" data-repere="([a-z]+)" viewBox="([^"]+)" data-trait="([0-9.]+)">(.*?)</symbol>',
                      texte, re.S)
    (TRAVAIL / "sources").mkdir(parents=True, exist_ok=True)
    lot = []
    for ident, _, vb, trait, corps in syms:
        src = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vb}" data-trait="{trait}" data-pas="1" '
               f'data-tremble="{float(trait) * 0.07:.2f}" data-halo="0">{corps}</svg>')
        e = TRAVAIL / "sources" / f"{ident}.svg"
        e.write_text(src)
        lot.append({"id": f"p-{ident}", "entree": str(e), "sortie": str(TRAVAIL / f"{ident}.encre.svg")})
    (TRAVAIL / "lot.json").write_text(json.dumps(lot))
    r = subprocess.run(["node", str(ICI / "encrer-lot.mjs"), str(TRAVAIL / "lot.json")], capture_output=True, text=True,
                       env={**os.environ, "NODE_PATH": os.environ.get("NODE_PATH", "/opt/node-tools/node_modules")})
    if r.returncode:
        raise SystemExit(r.stdout + r.stderr)
    vignettes = []
    for (ident, repere, vb, _, _), t in zip(syms, lot):
        s = pathlib.Path(t["sortie"]).read_text()
        defs = re.search(r"<defs>.*?</defs>", s, re.S)
        x0, y0, w, h = (float(v) for v in vb.split())
        out = {}
        for nom in CALQUES:
            m = re.search(rf'<g class="expr expr--{nom}">(.*?)</g>(?=<g class="expr|</svg>)', s, re.S)
            if not m:
                continue
            svg = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vb}" width="{w * ECH:.0f}" height="{h * ECH:.0f}">'
                   f'{defs.group(0) if defs else ""}{m.group(1)}</svg>')
            f = TRAVAIL / f".{ident}-{nom}.svg"
            f.write_text(svg)
            png = f.with_suffix(".png")
            subprocess.run(["rsvg-convert", str(f), "-o", str(png)], check=True)
            out[nom] = np.asarray(Image.open(png).convert("RGBA"), dtype=np.float32)[..., 3] / 255
            f.unlink()
            png.unlink()
        forme = next(iter(out.values())).shape
        z = np.zeros(forme, dtype=np.float32)
        out["relief"] = np.clip(-0.9 * out.get("encre", z) - 0.35 * out.get("ombre", z) + 0.5 * out.get("clair", z), -1, 1)
        np.savez_compressed(TRAVAIL / f"{ident}.npz", repere=repere, **out)
        # Vignette de contrôle: papier, ombre grise, clair, zones, encre.
        v = np.full(forme + (3,), 0.93, dtype=np.float32)
        for nom, teinte in (("z1", (0.62, 0.70, 0.86)), ("z2", (0.86, 0.66, 0.62)), ("filet", (0.95, 0.85, 0.4)),
                            ("ombre", (0.62, 0.62, 0.66)), ("clair", (1.0, 1.0, 1.0)), ("encre", (0.14, 0.10, 0.09))):
            if nom in out:
                a = out[nom][..., None]
                v = v * (1 - a) + np.array(teinte, dtype=np.float32) * a
        vignettes.append((ident, Image.fromarray((v * 255).astype(np.uint8))))
        print("PLIS", ident, repere, forme)
    # Planche de contrôle: toutes les vignettes sur une grille.
    larg = 820
    x = y = rang = 0
    places = []
    for ident, im in vignettes:
        im = im.resize((int(im.width * 0.5), int(im.height * 0.5)), Image.LANCZOS) if im.width > 500 else im
        if x + im.width > larg:
            x, y, rang = 0, y + rang + 10, 0
        places.append((im, x, y))
        x += im.width + 10
        rang = max(rang, im.height)
    planche = Image.new("RGB", (larg, y + rang), (40, 36, 34))
    for im, px, py in places:
        planche.paste(im, (px, py))
    planche.save(TRAVAIL / "planche.png")


if __name__ == "__main__":
    main()
