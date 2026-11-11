"""Planche des remarques du client sur les modèles (2026-11-11): chaque modèle corrigé, de près,
sous l'angle de sa remarque, l'avant à côté quand il existe.

    python3 remarques.py vues <vues.json>
    python3 remarques.py planche <dossier avant> <dossier après> <sortie.png>

Chaque vue est une image du rendu encré du jeu (`planche.mjs`: InkKit, DecorModels, bâtiments du
lieu fusionnés comme en jeu). Le modèle est posé en (15, 12); `centre`, `cibleY` visent le point
de la remarque (repère du modèle + (15, 0, 12)); `lacet` 0: caméra au sud, 90: à l'ouest,
-90: à l'est, 180: au nord. Les vues « après » seules (modèle nouveau) n'ont pas d'avant.
"""

import json
import os
import sys

from PIL import Image, ImageDraw

from monter import ENCRE, PAPIER, police

X0, Z0 = 15.0, 12.0
TAILLE = (900, 506)


def _v(nom, titre, objets, large, lacet=0, plongee=30, cible=(0.0, 0.0, 0.0), avant=True, apres=True, **plus):
    """Une vue: `objets` = [(modèle, dx, dz, quart)], `cible` = point visé dans le repère du modèle."""
    cx, cy, cz = cible
    return {
        "nom": nom,
        "titre": titre,
        "largeur": TAILLE[0],
        "hauteur": TAILLE[1],
        "terrain": [30, 24],
        "centre": [X0 + cx, Z0 + cz],
        "cibleY": cy,
        "large": large,
        "lacet": lacet,
        "plongee": plongee,
        "sol": plus.pop("sol", {"nature": "herbe", "areas": []}),
        "objets": [{"modele": m, "x": X0 + dx, "z": Z0 + dz, "quart": q, "cle": f"{m}@{dx},{dz}"} for m, dx, dz, q in objets],
        "silhouettes": plus.pop("silhouettes", []),
        "etiquettes": [],
        "avant": avant,
        "apres": apres,
        **plus,
    }


def vues():
    seul = lambda m: [(m, 0.0, 0.0, 0)]  # noqa: E731
    nuit = {"minutes": 1350, "lumieres": True}
    liste = [
        _v("marmite", "1. Marmite: le foyer sous la marmite (y 0,05 à 0,06)", seul("marmite"), 1.5, 20, 12, (0, 0.3, 0)),
        _v("marmite-bare", "1. Marmite vide (état bare): même foyer", seul("marmite-bare"), 1.5, -30, 12, (0, 0.3, 0)),
        _v("marmite-nuit", "1. Marmite la nuit: flammes et braises luisent", seul("marmite"), 1.5, 20, 25, (0, 0.3, 0), **nuit),
        _v("four", "2. Four: la bouche (y 0,38, z 0,45), braises et flammes", seul("four"), 1.4, 0, 12, (0, 0.45, 0.3)),
        _v("four-bare", "2. Four éteint (état bare): bûches froides, cendre", seul("four-bare"), 1.4, 0, 12, (0, 0.45, 0.3), avant=False),
        _v("four-nuit", "2. Four allumé, la nuit", seul("four"), 1.6, 20, 20, (0, 0.5, 0.3), **nuit),
        _v("brazier", "3. Brasero de la veillée", seul("brazier"), 1.3, 0, 30, (0, 0.8, 0)),
        _v("wood-stove", "3. Poêle à bois: la porte vitrée du foyer", seul("wood-stove"), 1.1, 0, 12, (0, 0.4, 0.2)),
        _v("festival-candle", "3. Lumignon", seul("festival-candle"), 0.45, 0, 25, (0, 0.09, 0)),
        _v("cuisiniere", "3. Cuisinière", seul("cuisiniere"), 1.4, 15, 20, (0, 0.55, 0)),
        _v("festival-cauldron", "3. Grand chaudron de la fête: feu cerclé de pierres", seul("festival-cauldron"), 2.4, 10, 18, (0, 0.6, 0)),
        _v("poulailler", "4. Poulailler (3 x 2 cases), de l'avant", seul("poulailler"), 5.0, -30, 30, (0, 0.9, 0), silhouettes=[{"x": X0 + 1.9, "z": Z0 + 0.9, "cap": -0.8}]),
        _v("poulailler-dos", "4. Poulailler, de l'arrière", seul("poulailler"), 5.0, 150, 30, (0, 0.9, 0)),
        _v("ronces-pres", "5. Ronces bramble, bramble-b et leurs états bare", [("bramble", -2.4, 0, 0), ("bramble-b", -0.8, 0, 0), ("bramble-bare", 0.8, 0, 0), ("bramble-b-bare", 2.4, 0, 0)], 6.0, 0, 40),
        _v("ronces-jeu", "5. Ronces à la caméra de jeu (50 degrés, 18 m)", [("bramble", -3, -1, 0), ("bramble-b", -1.7, -0.6, 0), ("bramble", -0.6, -1.2, 1), ("bramble-bare", 2.0, 0.2, 0), ("bramble-b-bare", 3.2, 0.6, 0)], 18.0, 0, 50,
           silhouettes=[{"x": X0 + 0.7, "z": Z0 + 1.2, "cap": 0.4}]),
        _v("tunnel-face", "6. Tête du tunnel, de face: (-5; 7,16; -0,37) et (5; 7,10; -0,32)", seul("tunnel-portal"), 16.0, 0, 14, (0, 5.0, 0)),
        _v("tunnel-gauche", "6. Tête du tunnel, de biais: (-2,40; 2,21; 0,45)", seul("tunnel-portal"), 9.0, 35, 10, (-2.4, 2.6, 0.45)),
        _v("tunnel-dos", "6. Tête du tunnel, du nord (le dessus du coteau)", seul("tunnel-portal"), 34.0, 180, 35, (0, 3.0, -3.0)),
        _v("tunnel-cote", "6. Tête du tunnel, de l'est", seul("tunnel-portal"), 24.0, -90, 15, (0, 3.5, -3.0)),
        _v("grue", "7. Grue à eau: le raccord du bras (0,02; 2,90; 2,14)", seul("water-crane"), 2.4, 90, 10, (0.02, 2.75, 1.6)),
        _v("miroir", "8. Psyché: la glace (0; 0,97; 0,01)", seul("miroir"), 1.5, 0, 6, (0, 0.95, 0)),
        _v("miroir-dos", "8. Psyché, de dos", seul("miroir"), 1.5, 160, 15, (0, 0.95, 0)),
        _v("ecole", "9. École: le drapeau sur sa hampe (0,38; 3,32; 3,00)", [], 3.2, 30, 12, (0.4, 3.4, 3.2), batiments=[{"id": "ecole", "x": X0, "z": Z0}]),
        _v("pompe", "10. Pompe à eau: le bec verse vers le bas, dans l'auge", seul("water-pump"), 1.8, 90, 10, (0, 0.65, 0)),
        _v("pompe-face", "10. Pompe à eau, de trois quarts", seul("water-pump"), 1.8, 30, 30, (0, 0.6, 0)),
        _v("baignoire", "11. Baignoire: robinet, bonde, pieds", seul("tub"), 2.0, 20, 35, (0, 0.3, 0)),
        _v("mobilier", "12. Meubles repris (lits, chaise, table, armoire, coffre, banc)", [("bed-double", -2.6, -0.4, 0), ("bed-single", -0.6, -0.4, 0), ("wardrobe", 1.0, -1.0, 0), ("chest", 2.6, -0.9, 0), ("table-farm", 0.8, 1.0, 0), ("chair-farm", 0.8, 1.75, 2), ("bench-platform", 3.0, 0.9, 0)], 8.0, 0, 40),
        _v("rue", "12. Repris: barrière (fence), poteau de quai, pompe", [("fence", -1.6, 0, 0), ("platform-sign", 0.8, 0, 0), ("water-pump", 2.4, 0.2, 0)], 6.0, 0, 30, cible=(0, 0.8, 0)),
        _v("train", "12. Voiture de train repris: parois, porte, angle, applique, banquettes, couchette, tablette, filets", [
            ("train-wall", -3.0, -1.0, 0), ("train-wall-window", -2.0, -1.0, 0), ("train-wall-map", -1.0, -1.0, 0), ("train-door", 0.0, -1.0, 0), ("train-wall-corner", 0.57, -1.0, 0),
            ("train-wall-lamp", -2.0, -1.0, 0), ("train-seat", -3.0, 0.2, 0), ("train-table", -2.0, 0.0, 0), ("train-seat", -1.0, 0.2, 2), ("train-berth", 1.4, 0.4, 0),
            ("train-luggage-rack", 3.2, -1.0, 0), ("train-luggage-rack-empty", 3.2, 1.0, 0)], 8.5, 0, 40, cible=(0, 0.6, 0)),
    ]
    return liste


def planche(dossier_avant, dossier_apres, sortie):
    liste = vues()
    w, h = TAILLE
    marge, bandeau, titre = 16, 34, 90
    colonnes = 2
    largeur = marge + colonnes * (w + marge)
    hauteur = titre + len(liste) * (h + bandeau + marge)
    image = Image.new("RGB", (largeur, hauteur), PAPIER)
    d = ImageDraw.Draw(image)
    d.text((marge, 14), "Remarques du client sur les modèles (2026-11-11): avant, après", font=police(36, True), fill=ENCRE)
    d.text((marge, 58), "Rendu encré du jeu (InkKit), gros plans sous l'angle de chaque remarque. À gauche la version qu'il a vue, à droite la version corrigée.", font=police(19), fill=ENCRE)
    for k, vue in enumerate(liste):
        y = titre + k * (h + bandeau + marge)
        d.text((marge + 4, y), vue["titre"], font=police(20, True), fill=ENCRE)
        for c, (dossier, voulu, mot) in enumerate(((dossier_avant, vue["avant"], "avant"), (dossier_apres, vue["apres"], "après"))):
            x = marge + c * (w + marge)
            chemin = os.path.join(dossier, f"{vue['nom']}.png")
            if voulu and os.path.exists(chemin):
                image.paste(Image.open(chemin).convert("RGB").resize((w, h)), (x, y + bandeau - 6))
            else:
                d.rectangle((x, y + bandeau - 6, x + w, y + bandeau - 6 + h), outline=ENCRE)
                d.text((x + 20, y + bandeau + 14), "pas d'avant (modèle nouveau)" if c == 0 else "retiré", font=police(18), fill=ENCRE)
            d.text((x + w - 70, y + bandeau), mot, font=police(18, True), fill=PAPIER, stroke_width=3, stroke_fill=ENCRE)
    image.save(sortie, optimize=True)
    print(f"PLANCHE {sortie}: {image.size[0]} x {image.size[1]}")


def main():
    if sys.argv[1] == "vues":
        with open(sys.argv[2], "w", encoding="utf8") as f:
            json.dump(vues(), f, ensure_ascii=False, indent=1)
            f.write("\n")
    else:
        planche(sys.argv[2], sys.argv[3], sys.argv[4])


if __name__ == "__main__":
    main()
