"""Planche des modèles de l'après-midi du 2026-11-11: meubles du bourg refaits (puits, tonneau,
caisse, tas de bûches, banc de ferme, abreuvoir), draisine, lisse de passage à niveau, pupitre.

    python3 apres_midi.py vues <vues.json> [controle]
    python3 apres_midi.py planche <dossier des vues> <sortie.png>

Chaque vue est une image du rendu encré du jeu (`planche.mjs`). `controle`: cinq vues de près par
modèle (face, dos, profil, dessus, trois quarts) pour la relecture; sans: trois vues par modèle
(trois quarts avant, profil, trois quarts arrière), celles de la planche livrée.
"""

import json
import os
import sys

from PIL import Image, ImageDraw

from monter import ENCRE, PAPIER, police

X0, Z0 = 15.0, 12.0
TAILLE = (560, 420)

# (modèle, titre, largeur du cadre (m), hauteur visée (m), décalage du centre (x, z), place du
# mannequin de 1,80 m (dx, dz) sur la planche, voie sous le modèle)
MODELES = [
    ("well", "Puits (well)", 3.4, 1.2, (0, 0), (1.5, 0.3), False),
    ("barrel", "Tonneau (barrel)", 1.6, 0.5, (0, 0), (0.75, 0.0), False),
    ("crate", "Caisse (crate)", 1.6, 0.4, (0, 0), (0.75, 0.0), False),
    ("log-pile", "Tas de bûches (log-pile)", 1.6, 0.4, (0, 0), (0.8, 0.0), False),
    ("bench-farm", "Banc de ferme (bench-farm)", 2.6, 0.4, (0, 0), (1.3, 0.2), False),
    ("sink-stone", "Abreuvoir de pierre (sink-stone)", 2.0, 0.6, (0, 0), (1.1, -0.35), False),
    ("draisine", "Draisine (draisine), sur les rails du jeu", 3.6, 0.85, (0, 0), (1.45, 0.4), True),
    ("crossing-gate", "Lisse de passage à niveau (crossing-gate)", 5.6, 1.0, (0, 0), (2.6, 0.6), False),
    ("music-stand", "Pupitre de fanfare (music-stand)", 1.9, 0.75, (0, 0), (0.85, -0.35), False),
]


def _voie_z(x, z0, z1):
    """Traverses et rails du jeu le long de z (mêmes mesures que `reglages-tuiles.ts`)."""
    boites = []
    n = int((z1 - z0) / 0.65)
    for k in range(n):
        boites.append({"w": 2.5, "h": 0.12, "d": 0.24, "x": x, "y": 0.06, "z": z0 + 0.3 + k * 0.65, "couleur": "#5b4634", "couche": "grain"})
    for d in (-0.72, 0.72):
        boites.append({"w": 0.08, "h": 0.14, "d": z1 - z0, "x": x + d, "y": 0.19, "z": (z0 + z1) / 2, "couleur": "#6b6865"})
    return boites

PLANCHE = ((30, 22, "trois quarts avant"), (90, 12, "profil (de l'ouest)"), (150, 30, "trois quarts arrière"))
CONTROLE = ((0, 10, "face"), (180, 10, "dos"), (-90, 10, "profil est"), (0, 85, "dessus"), (-40, 35, "trois quarts"))


def _v(nom, modele, large, cible_y, centre, lacet, plongee, mannequin=None, voie=False):
    return {
        "nom": nom,
        "titre": nom,
        "largeur": TAILLE[0],
        "hauteur": TAILLE[1],
        "terrain": [30, 24],
        "centre": [X0 + centre[0], Z0 + centre[1]],
        "cibleY": cible_y,
        "large": large,
        "lacet": lacet,
        "plongee": plongee,
        "sol": {"nature": "herbe", "areas": []},
        "objets": [{"modele": modele, "x": X0, "z": Z0, "quart": 0, "cle": f"{modele}@0,0"}],
        "silhouettes": [] if mannequin is None else [{"x": X0 + mannequin[0], "z": Z0 + mannequin[1], "cap": 0.0, "echelle": 1.8 / 1.7}],
        "boites": _voie_z(X0, Z0 - 2.2, Z0 + 2.2) if voie else [],
        "etiquettes": [],
    }


def vues(controle=False):
    angles = CONTROLE if controle else PLANCHE
    out = []
    for modele, _, large, y, centre, mannequin, voie in MODELES:
        for k, (lacet, plongee, _) in enumerate(angles):
            out.append(_v(f"{modele}-{k}", modele, large, y, centre, lacet, plongee, None if controle else mannequin, voie))
    return out


def planche(dossier, sortie, controle=False):
    angles = CONTROLE if controle else PLANCHE
    w, h = TAILLE
    marge, bandeau, titre = 14, 30, 90
    largeur = marge + len(angles) * (w + marge)
    hauteur = titre + len(MODELES) * (h + bandeau + marge)
    image = Image.new("RGB", (largeur, hauteur), PAPIER)
    d = ImageDraw.Draw(image)
    d.text((marge, 14), "Modèles de l'après-midi du 2026-11-11", font=police(34, True), fill=ENCRE)
    d.text((marge, 56), "Rendu encré du jeu (InkKit), chaque modèle sous trois angles, avant du modèle vers le sud (+z). Mannequin de 1,80 m pour l'échelle.", font=police(18), fill=ENCRE)
    for i, (modele, nom, *_rest) in enumerate(MODELES):
        y = titre + i * (h + bandeau + marge)
        d.text((marge + 4, y), nom, font=police(20, True), fill=ENCRE)
        for c, (_, _, mot) in enumerate(angles):
            x = marge + c * (w + marge)
            chemin = os.path.join(dossier, f"{modele}-{c}.png")
            if os.path.exists(chemin):
                image.paste(Image.open(chemin).convert("RGB").resize((w, h)), (x, y + bandeau - 4))
            else:
                d.rectangle((x, y + bandeau - 4, x + w, y + bandeau - 4 + h), outline=ENCRE)
            d.text((x + 10, y + bandeau + 2), mot, font=police(16, True), fill=PAPIER, stroke_width=3, stroke_fill=ENCRE)
    image.save(sortie, optimize=True)
    print(f"PLANCHE {sortie}: {image.size[0]} x {image.size[1]}")


def main():
    if sys.argv[1] == "vues":
        with open(sys.argv[2], "w", encoding="utf8") as f:
            json.dump(vues(len(sys.argv) > 3 and sys.argv[3] == "controle"), f, ensure_ascii=False, indent=1)
            f.write("\n")
    else:
        planche(sys.argv[2], sys.argv[3], len(sys.argv) > 4 and sys.argv[4] == "controle")


if __name__ == "__main__":
    main()
