"""Planche de contrôle des récoltables: liste des vues à capturer, puis montage des captures.

    python3 monter.py vues <decors.json> <vues.json>
    python3 monter.py planche <decors.json> <dossier des captures> <sortie.png>

Chaque vue est une image du jeu: 1366 x 768, plongée de 50 degrés, 18 m de large (la caméra de
jeu), rendu encré du jeu, fin d'après-midi. Une silhouette de 1,70 m donne l'échelle. Familles
d'abord (chaque modèle, chaque état, chaque stade), puis un coin de potager et une lisière
composés, de jour et de nuit, pour juger l'ensemble.
"""

import json
import sys

from PIL import Image, ImageDraw, ImageFont

VUE = (1366, 768)
TERRAIN = (30, 24)
CENTRE = (15.0, 12.0)
ENCRE = (35, 26, 23)
PAPIER = (243, 234, 216)


def _objet(modele, x, z, nom=None, cle=None, quart=0, dy=0.7):
    return {"modele": modele, "x": x, "z": z, "quart": quart, "cle": cle or f"{modele}@{x},{z}", "nom": nom, "dy": dy}


def _vue(nom, titre, objets, silhouettes, sol=None, **plus):
    etiquettes = [{"texte": o["nom"], "x": o["x"], "z": o["z"] + o["dy"]} for o in objets if o["nom"]]
    return {
        "nom": nom,
        "titre": titre,
        "largeur": VUE[0],
        "hauteur": VUE[1],
        "terrain": list(TERRAIN),
        "centre": list(CENTRE),
        "sol": sol or {"nature": "herbe", "areas": []},
        "objets": [{k: v for k, v in o.items() if k not in ("nom", "dy")} for o in objets],
        "silhouettes": silhouettes,
        "etiquettes": etiquettes,
        **plus,
    }


def _potager(x0, z0, cases, nommer=True):
    """Un potager de 6 x 4 posé en (x0, z0) (coin nord-ouest) et ses cases: {(colonne, rang): (sol, culture, nom)}."""
    objets = [_objet("garden-bed", x0 + 3, z0 + 2, cle=f"lit@{x0}")]
    for (i, j), (sol, plante, nom) in cases.items():
        x, z = x0 + i + 0.5, z0 + j + 0.5
        objets.append(_objet(f"garden-bed-{sol}", x, z, cle=f"case{i}{j}", quart=(i + j) % 2 * 2))
        if plante:
            objets.append(_objet(plante, x, z, nom if nommer else None, cle=f"plant{i}{j}", dy=0.36))
        elif nom and nommer:
            objets[-1]["nom"] = nom
            objets[-1]["dy"] = 0.36
    return objets


def vues(manifeste):
    crops = manifeste.get("crops", {})
    liste = []
    homme = [{"x": 15.2, "z": 17.2, "cap": 0.4}]
    liste.append(_vue("chenes", "Chênes: deux formes du chêne à abattre, le gros chêne (2 x 2 cases)", [
        _objet("oak-tree", 9.0, 14.6, "oak-tree", cle="a", dy=1.0),
        _objet("oak-tree-b", 14.2, 13.4, "oak-tree-b", cle="a", dy=1.0),
        _objet("great-oak-tree", 20.2, 14.8, "great-oak-tree", cle="a", dy=1.2),
    ], [{"x": 10.3, "z": 15.4, "cap": 0.5}, {"x": 17.9, "z": 16.2, "cap": -0.6}]))
    liste.append(_vue("frenes-bouleaux", "Frêne (fût gris, houppier haut) et bouleau (fût blanc, touffes étagées)", [
        _objet("ash-tree", 8.4, 14.8, "ash-tree", cle="a", dy=1.0),
        _objet("ash-tree-b", 12.6, 13.8, "ash-tree-b", cle="a", dy=1.0),
        _objet("birch-tree", 17.4, 14.8, "birch-tree", cle="a", dy=1.0),
        _objet("birch-tree-b", 21.6, 13.8, "birch-tree-b", cle="a", dy=1.0),
    ], [{"x": 9.7, "z": 15.6, "cap": 0.5}, {"x": 19.0, "z": 16.0, "cap": -0.4}]))
    liste.append(_vue("pommiers-buissons", "Pommier (avec et sans pommes), ronces à mûres et buisson à baies (avec et sans fruits)", [
        _objet("apple-tree", 8.6, 12.4, "apple-tree", cle="a", dy=1.0),
        _objet("apple-tree-b", 13.6, 11.6, "apple-tree-b", cle="a", dy=1.0),
        _objet("apple-tree-bare", 18.8, 12.4, "apple-tree-bare", cle="a", dy=1.0),
        _objet("bramble", 8.0, 16.4, "bramble", cle="a"),
        _objet("bramble-b", 10.2, 16.4, "bramble-b", cle="a"),
        _objet("bramble-bare", 12.4, 16.4, "bramble-bare", cle="a"),
        _objet("berry-bush", 17.2, 16.4, "berry-bush", cle="a"),
        _objet("berry-bush-bare", 19.6, 16.4, "berry-bush-bare", cle="a"),
    ], [{"x": 14.8, "z": 16.5, "cap": 0.3}, {"x": 10.0, "z": 13.0, "cap": 0.9}]))
    liste.append(_vue("hiver-souches", "Variantes: arbres d'hiver (sans feuilles) et arbres abattus (souche et bûches)", [
        _objet("oak-tree-winter", 7.6, 13.0, "oak-tree-winter", cle="a"),
        _objet("great-oak-tree-winter", 12.0, 12.2, "great-oak-tree-winter", cle="a", dy=1.0),
        _objet("ash-tree-winter", 16.2, 13.0, "ash-tree-winter", cle="a"),
        _objet("birch-tree-winter", 19.4, 13.0, "birch-tree-winter", cle="a"),
        _objet("apple-tree-winter", 22.6, 13.0, "apple-tree-winter", cle="a"),
        _objet("oak-tree-stump", 7.6, 16.6, "oak-tree-stump", cle="a"),
        _objet("great-oak-tree-stump", 10.6, 16.6, "great-oak-tree-stump", cle="a", dy=1.0),
        _objet("ash-tree-stump", 16.2, 16.6, "ash-tree-stump", cle="a"),
        _objet("birch-tree-stump", 19.4, 16.6, "birch-tree-stump", cle="a"),
        _objet("apple-tree-stump", 22.6, 16.6, "apple-tree-stump", cle="a"),
    ], [{"x": 13.6, "z": 16.8, "cap": 0.4}]))
    eau = {"nature": "herbe", "areas": [{"x": 21, "y": 13, "w": 9, "h": 11, "nature": "eau"}, {"x": 6, "y": 17, "w": 8, "h": 1, "nature": "sentier"}]}
    liste.append(_vue("rochers-cueillette", "Rochers (3 tailles, moussus, entamés), bois, fleurs et herbes, repères de fouille, d'insectes et de pêche", [
        _objet("boulder", 7.4, 9.6, "boulder", cle="a", dy=0.95),
        _objet("boulder-mossy", 10.2, 9.6, "boulder-mossy", cle="a", dy=0.95),
        _objet("boulder-chipped", 13.0, 9.6, "boulder-chipped", cle="a", dy=0.95),
        _objet("rock", 15.8, 9.6, "rock", cle="a"),
        _objet("rock-mossy", 18.2, 9.6, "rock-mossy", cle="a"),
        _objet("rock-chipped", 20.6, 9.6, "rock-chipped", cle="a"),
        _objet("stone", 7.2, 12.6, "stone", cle="a", dy=0.5),
        _objet("stone-b", 8.8, 12.6, "stone-b", cle="a", dy=0.5),
        _objet("stone-c", 10.4, 12.6, "stone-c", cle="a", dy=0.5),
        _objet("dead-branches", 12.6, 12.6, "dead-branches", cle="a"),
        _objet("dead-branches-b", 14.6, 12.6, "dead-branches-b", cle="a"),
        _objet("woodpile", 16.8, 12.6, "woodpile", cle="a"),
        _objet("woodpile-bare", 18.8, 12.6, "woodpile-bare", cle="a"),
        _objet("poppies", 7.2, 15.4, "poppies", cle="a", dy=0.5),
        _objet("poppies-b", 8.8, 15.4, "poppies-b", cle="a", dy=0.5),
        _objet("wild-herbs", 10.6, 15.4, "wild-herbs", cle="a", dy=0.5),
        _objet("dig-spot", 12.6, 15.4, "dig-spot", cle="a", dy=0.5),
        _objet("insect-spot", 14.6, 15.4, "insect-spot", cle="a", dy=0.5),
        _objet("fishing-spot", 20.4, 15.2, "fishing-spot", cle="a", dy=0.6),
        _objet("fishing-spot", 20.5, 18.0, None, cle="b", quart=1),
    ], [{"x": 17.0, "z": 15.6, "cap": 0.5}], sol=eau))

    def culture(ident, stade, soif):
        c = crops.get(ident)
        if not c:
            return None
        return (c["thirsty"] if soif else c["stages"])[stade] if stade < len(c["thirsty" if soif else "stages"]) else None

    stades = {
        (0, 0): ("tilled", None, "bêchée"), (1, 0): ("watered", None, "arrosée"),
        (3, 0): ("tilled", culture("crop-radis", 0, True), "radis 0, à arroser"), (4, 0): ("watered", culture("crop-radis", 0, False), "radis 0"),
        (0, 1): ("tilled", culture("crop-radis", 1, True), "radis 1, à arroser"), (1, 1): ("watered", culture("crop-radis", 1, False), "radis 1"),
        (3, 1): ("tilled", culture("crop-radis", 2, False), "radis mûr"), (4, 1): ("watered", culture("crop-radis", 2, False), "radis mûr"),
        (0, 2): ("tilled", culture("crop-tomate", 0, True), "tomate 0, à arroser"), (1, 2): ("watered", culture("crop-tomate", 0, False), "tomate 0"),
        (3, 2): ("tilled", culture("crop-tomate", 1, True), "tomate 1, à arroser"), (4, 2): ("watered", culture("crop-tomate", 1, False), "tomate 1"),
        (0, 3): ("tilled", culture("crop-tomate", 2, True), "tomate 2, à arroser"), (1, 3): ("watered", culture("crop-tomate", 2, False), "tomate 2"),
        (3, 3): ("tilled", culture("crop-tomate", 3, False), "tomate mûre"), (4, 3): ("watered", culture("crop-tomate", 3, False), "tomate mûre"),
    }
    cour = {"nature": "herbe", "areas": [{"x": 6, "y": 15, "w": 18, "h": 2, "nature": "chemin"}]}
    liste.append(_vue("potager-stades", "Potager de près (9 m de large): friche, cases bêchées et arrosées, chaque culture à chaque stade", _potager(12, 9.5, stades), [{"x": 19.0, "z": 12.0, "cap": -0.7}], centre=[15.2, 11.9], large=9))
    liste.append(_vue("potager-jeu", "Le même potager à la caméra de jeu (18 m), et un potager en friche", _potager(13, 9.5, stades, nommer=False) + _potager(6, 9.5, {}), [{"x": 20.0, "z": 12.6, "cap": -0.7}], sol=cour))

    coin = {
        (0, 0): ("watered", culture("crop-tomate", 3, False), None), (1, 0): ("watered", culture("crop-tomate", 3, False), None), (2, 0): ("watered", culture("crop-tomate", 2, False), None),
        (3, 0): ("tilled", culture("crop-tomate", 1, True), None), (0, 1): ("watered", culture("crop-radis", 2, False), None), (1, 1): ("watered", culture("crop-radis", 2, False), None),
        (2, 1): ("watered", culture("crop-radis", 1, False), None), (3, 1): ("tilled", culture("crop-radis", 1, True), None), (0, 2): ("tilled", culture("crop-radis", 0, True), None),
        (1, 2): ("tilled", None, None), (2, 2): ("tilled", None, None), (4, 1): ("watered", None, None),
    }
    sol_coin = {"nature": "herbe", "areas": [{"x": 5, "y": 15, "w": 20, "h": 2, "nature": "chemin"}, {"x": 17, "y": 9, "w": 2, "h": 6, "nature": "sentier"}]}
    coin_objets = _potager(10, 10, coin, nommer=False) + [
        _objet("apple-tree", 7.6, 11.2, cle="verger1"),
        _objet("apple-tree-b", 21.6, 10.4, cle="verger2"),
        _objet("woodpile", 19.6, 13.6, cle="tas", quart=1),
        _objet("bramble", 7.2, 14.2, cle="r1"),
        _objet("bramble-b", 8.5, 14.5, cle="r2"),
        _objet("berry-bush", 16.6, 9.2, cle="g1"),
        _objet("stone", 19.4, 15.2, cle="c1"),
        _objet("poppies", 9.4, 17.6, cle="p1"),
        _objet("poppies-b", 20.4, 17.4, cle="p2"),
        _objet("wild-herbs", 16.5, 14.4, cle="h1"),
        _objet("dig-spot", 22.2, 14.2, cle="f1"),
        _objet("rock-mossy", 6.6, 17.4, cle="m1"),
    ]
    liste.append(_vue("coin-de-potager", "Composition: un coin de potager (cultures à tous les stades, pommiers, tas de bois, ronces)", coin_objets, [{"x": 13.4, "z": 14.6, "cap": 2.6}, {"x": 18.3, "z": 15.6, "cap": -0.8}], sol=sol_coin, tirage=True))

    sol_lisiere = {"nature": "herbe", "areas": [{"x": 0, "y": 0, "w": 30, "h": 13, "nature": "lisiere"}, {"x": 5, "y": 17, "w": 20, "h": 1, "nature": "sentier"}]}
    lisiere = [
        _objet("great-oak-tree", 9.6, 12.2, cle="l1"),
        _objet("oak-tree", 15.6, 11.0, cle="l2"),
        _objet("ash-tree", 19.8, 12.4, cle="l3"),
        _objet("birch-tree", 23.2, 14.0, cle="l4"),
        _objet("birch-tree-b", 6.6, 15.4, cle="l5"),
        _objet("oak-tree-stump", 13.2, 14.2, cle="l6"),
        _objet("bramble", 17.2, 14.2, cle="l7"),
        _objet("bramble-b", 18.4, 14.8, cle="l8"),
        _objet("bramble-bare", 11.2, 15.2, cle="l9"),
        _objet("boulder-mossy", 21.0, 15.6, cle="l10"),
        _objet("rock", 8.4, 17.6, cle="l11"),
        _objet("stone", 14.6, 16.0, cle="l12"),
        _objet("stone-b", 20.2, 19.2, cle="l13"),
        _objet("dead-branches", 15.2, 14.8, cle="l14"),
        _objet("dead-branches-b", 22.6, 17.2, cle="l15"),
        _objet("poppies", 10.2, 19.2, cle="l16"),
        _objet("poppies-b", 16.8, 19.4, cle="l17"),
        _objet("wild-herbs", 12.6, 16.2, cle="l18"),
        _objet("insect-spot", 19.0, 16.2, cle="l19"),
        _objet("dig-spot", 12.0, 19.0, cle="l20"),
    ]
    gens = [{"x": 14.2, "z": 17.2, "cap": 0.6}, {"x": 17.6, "z": 15.6, "cap": 2.4}]
    liste.append(_vue("lisiere", "Composition: une lisière (chênes, frêne, bouleaux, ronces, rochers, bois mort, fleurs)", lisiere, gens, sol=sol_lisiere, tirage=True))
    liste.append(_vue("lisiere-nuit", "La même lisière la nuit (22 h 30)", lisiere, gens, sol=sol_lisiere, minutes=1350, tirage=True))
    return liste


def police(taille, gras=False):
    for chemin in (
        f"/usr/share/fonts/truetype/dejavu/DejaVuSans{'-Bold' if gras else ''}.ttf",
        f"/usr/share/fonts/truetype/liberation/LiberationSans-{'Bold' if gras else 'Regular'}.ttf",
    ):
        try:
            return ImageFont.truetype(chemin, taille)
        except OSError:
            continue
    return ImageFont.load_default()


def planche(manifeste, dossier, sortie):
    liste = vues(manifeste)
    with open(f"{dossier}/mesures.json", encoding="utf8") as f:
        mesures = json.load(f)
    colonnes = 2
    marge, bandeau, titre = 18, 46, 118
    largeur = marge + colonnes * (VUE[0] + marge)
    rangs = -(-len(liste) // colonnes)
    hauteur = titre + rangs * (VUE[1] + bandeau + marge)
    image = Image.new("RGB", (largeur, hauteur), PAPIER)
    d = ImageDraw.Draw(image)
    d.text((marge, 16), "Aubrune: tout ce qu'on récolte et tout ce qui pousse dehors", font=police(42, True), fill=ENCRE)
    miens = {i: m for i, m in manifeste["models"].items() if m.get("source") == "recoltables-aubrune"}
    total = sum(m["triangles"] for m in miens.values())
    resume = (
        f"{len(miens)} modèles ({total} triangles), {len(manifeste.get('crops', {}))} cultures. Chaque vue est une image du jeu: 1366 x 768, plongée de 50 degrés, "
        "18 m de large (sauf mention), rendu encré du jeu (InkKit), fin d'après-midi. Silhouette de 1,70 m."
    )
    d.text((marge, 72), resume, font=police(22), fill=ENCRE)
    petite = police(15, True)
    for k, vue in enumerate(liste):
        x = marge + (k % colonnes) * (VUE[0] + marge)
        y = titre + (k // colonnes) * (VUE[1] + bandeau + marge)
        try:
            capture = Image.open(f"{dossier}/{vue['nom']}.png").convert("RGB")
        except OSError:
            d.rectangle((x, y, x + VUE[0], y + VUE[1]), outline=ENCRE)
            d.text((x + 20, y + 20), "capture manquante", font=police(20), fill=ENCRE)
            continue
        dc = ImageDraw.Draw(capture)
        for repere in mesures.get(vue["nom"], {}).get("reperes", []):
            texte = repere["texte"]
            boite = dc.textbbox((0, 0), texte, font=petite)
            w, h = boite[2] - boite[0], boite[3] - boite[1]
            px = min(max(4, repere["px"] - w / 2), VUE[0] - w - 4)
            py = min(max(4, repere["py"]), VUE[1] - h - 8)
            dc.rectangle((px - 4, py - 2, px + w + 4, py + h + 6), fill=PAPIER, outline=ENCRE)
            dc.text((px, py), texte, font=petite, fill=ENCRE)
        image.paste(capture, (x, y))
        m = mesures.get(vue["nom"], {})
        legende = f"{vue['titre']}"
        d.text((x + 4, y + VUE[1] + 6), legende, font=police(21, True), fill=ENCRE)
        if m:
            chiffres = f"{m['trianglesImage']} triangles dessinés, {m['appels']} appels (ombres et contour compris)"
            d.text((x + VUE[0] - 4 - d.textlength(chiffres, font=police(15)), y + VUE[1] + 28), chiffres, font=police(15), fill=ENCRE)
    image.save(sortie, optimize=True)
    print(f"PLANCHE {sortie}: {image.size[0]} x {image.size[1]}")


def main():
    with open(sys.argv[2], encoding="utf8") as f:
        manifeste = json.load(f)
    if sys.argv[1] == "vues":
        with open(sys.argv[3], "w", encoding="utf8") as f:
            json.dump(vues(manifeste), f, ensure_ascii=False, indent=1)
            f.write("\n")
    else:
        planche(manifeste, sys.argv[3], sys.argv[4])


if __name__ == "__main__":
    main()
