"""Images de référence de la voie C: un gabarit de la planche du directeur artistique, seul, de face, fond uni.

Usage: python3 references_gabarits.py <dossier des sources des planches> <dossier de sortie>   (puis rsvg-convert, fait ici)
"""
import os
import subprocess
import sys

SOURCE, OUT = sys.argv[1:3]
sys.path.insert(0, SOURCE)
import planches as P  # noqa: E402

LOOKS = {
    "ref_adulte_moyen": ("adult_medium", "porcelaine", "chatain", "ardoise", "marine", "chocolat", "short", "neutral"),
    "ref_adulte_rond": ("adult_round", "acajou", "noir", "coquelicot", "anthracite", "encre", "bob", "joy"),
}
for name, (body, skin, hair, top, bottom, shoes, style, face) in LOOKS.items():
    n = P.N
    fig = P.figure(512, 960, 520, P.BODIES[body], n["peaux"][skin], n["cheveux"][hair], n["tissus"][top], n["tissus"][bottom], n["tissus"][shoes], style, face)
    svg = (f'<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">'
           f'<rect width="1024" height="1024" fill="#E6E6E6"/>\n{fig}\n</svg>\n')
    path = os.path.join(OUT, name + ".svg")
    with open(path, "w", encoding="utf-8") as fh:
        fh.write(svg)
    subprocess.run(["rsvg-convert", path, "-o", os.path.join(OUT, name + ".png")], check=True)
