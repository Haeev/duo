"""Planche de contrôle des trains vus du dehors et des objets d'intérieur d'Aubrune.

    python3 trains_interieurs.py vues <decors.json> <vues.json>
    python3 trains_interieurs.py planche <decors.json> <dossier des captures> <sortie.png>

Mêmes règles que les autres planches (`monter.py`, `provisoires.py`): chaque vue est une image du
rendu encré du jeu, 1366 x 768, plongée de 50 degrés, silhouette de 1,70 m. La voie, le quai et les
murs des pièces sont des boîtes de mise en scène aux mesures du jeu (le jeu a les siens): rails à
0,72 m de l'axe, dessus du rail à 0,26 m, traverses de 2,5 m tous les 0,65 m, quai de 12 cm dont le
nez est à 1,5 m de l'axe. Les objets posés sur un meuble y sont posés à la hauteur de son plateau.
"""

import json
import sys

from PIL import Image, ImageDraw

from monter import ENCRE, PAPIER, VUE, _objet, _vue, police

SOURCE = "recoltables-aubrune"
FAMILLES = ("objet", "vehicule")
PLANCHER = {"nature": "plancher", "areas": []}


def _sur(modele, x, z, y, nom=None, quart=0, dy=0.5):
    o = _objet(modele, x, z, nom, cle="a", quart=quart, dy=dy)
    o["y"] = y
    return o


def _voie(x0, x1, z):
    """La voie du jeu le long de x, centrée en z: traverses, deux rails."""
    boites = []
    n = int((x1 - x0) / 0.65)
    for k in range(n):
        boites.append({"w": 0.24, "h": 0.12, "d": 2.5, "x": x0 + 0.3 + k * 0.65, "y": 0.06, "z": z, "couleur": "#5b4634", "couche": "grain"})
    for d in (-0.72, 0.72):
        boites.append({"w": x1 - x0, "h": 0.14, "d": 0.08, "x": (x0 + x1) / 2, "y": 0.19, "z": z + d, "couleur": "#6b6865"})
    return boites


def _quai(x0, x1, z0, z1):
    """Quai de 12 cm, nez de pierre claire de 30 cm côté voie (au nord, z0)."""
    return [
        {"w": x1 - x0, "h": 0.12, "d": z1 - z0 - 0.3, "x": (x0 + x1) / 2, "y": 0.06, "z": (z0 + 0.3 + z1) / 2, "couleur": "#c9bda6", "couche": "slab"},
        {"w": x1 - x0, "h": 0.12, "d": 0.3, "x": (x0 + x1) / 2, "y": 0.06, "z": z0 + 0.15, "couleur": "#ece6d6", "couche": "slab"},
    ]


def _murs(porte_ouest=None):
    """Mur du nord (face en z = 9) et mur de l'ouest (face en x = 10), 2,6 m; une embrasure à l'ouest."""
    murs = [{"w": 10.4, "h": 2.6, "d": 0.2, "x": 15.0, "y": 1.3, "z": 8.9, "couleur": "#ead9bb", "couche": "wall"}]
    z0, z1 = 9.0, 14.6
    morceaux = [(z0, z1)] if porte_ouest is None else [(z0, porte_ouest[0]), (porte_ouest[1], z1)]
    for a, b in morceaux:
        murs.append({"w": 0.2, "h": 2.6, "d": b - a, "x": 9.9, "y": 1.3, "z": (a + b) / 2, "couleur": "#e3cfae", "couche": "wall"})
    if porte_ouest is not None:
        murs.append({"w": 0.2, "h": 0.5, "d": porte_ouest[1] - porte_ouest[0], "x": 9.9, "y": 2.35, "z": sum(porte_ouest) / 2, "couleur": "#e3cfae", "couche": "wall"})
    return murs


def vues(manifeste):
    liste = []
    # ------------------------------------------------------------ trains à quai
    # La voie au nord (z = 12), le quai au sud, côté caméra: on voit le flanc des portes.
    sol_quai = {"nature": "herbe", "areas": [{"x": 0, "y": 10.5, "w": 60, "h": 3, "nature": "voie"}, {"x": 0, "y": 13.5, "w": 60, "h": 2.4, "nature": "quai"}]}
    voie_quai = _voie(0, 60, 12.0) + _quai(0, 60, 13.5, 15.9)
    scene_autorail = dict(sol=sol_quai, centre=[15.0, 12.4], boites=voie_quai, terrain=[60, 30])
    autorail = [
        _objet("railcar", 15.0, 12.0, "railcar (autorail du 5 h 12)", cle="a", quart=1, dy=-3.4),
        _sur("platform-lantern", 9.0, 15.0, 0.12, "platform-lantern", quart=2, dy=0.9),
        _sur("platform-lantern", 21.0, 15.0, 0.12, quart=2),
    ]
    gens = [{"x": 13.2, "z": 14.4, "cap": 3.0, "y": 0.12}, {"x": 16.4, "z": 15.0, "cap": 2.6, "y": 0.12}]
    liste.append(_vue("autorail-jour", "L'autorail du 5 h 12 à quai, de jour (14,5 m, portes côté quai, deux marches)", autorail, gens, minutes=960, **scene_autorail))
    liste.append(_vue("autorail-nuit", "Le même à 22 h: vitres de la caisse allumées, feux de tête, lanternes de quai", autorail, gens, minutes=1320, lumieres=True, **scene_autorail))
    # Le train du samedi, tampon contre tampon: fourgon, voiture, locomotive en tête vers l'est.
    train = [
        _objet("luggage-van", 17.51, 12.0, "luggage-van", cle="a", quart=1, dy=-3.6),
        _objet("passenger-coach", 28.93, 12.0, "passenger-coach", cle="a", quart=1, dy=-3.6),
        _objet("tank-engine", 40.0, 12.0, "tank-engine", cle="a", quart=1, dy=-3.6),
        _sur("platform-lantern", 22.0, 15.0, 0.12, quart=2),
        _sur("platform-lantern", 36.0, 15.0, 0.12, quart=2),
    ]
    gens_long = [{"x": 27.0, "z": 14.4, "cap": 3.0, "y": 0.12}, {"x": 33.0, "z": 15.0, "cap": 2.8, "y": 0.12}]
    scene_long = dict(sol=sol_quai, centre=[28.6, 12.4], large=34, terrain=[60, 30], boites=voie_quai)
    liste.append(_vue("samedi-jour", "Le train du samedi à quai (32 m, vue de 34 m): fourgon, voiture à compartiments, locomotive", train, gens_long, minutes=960, **scene_long))
    liste.append(_vue("samedi-nuit", "Le même à 22 h: la voiture et la vigie éclairées, feux de tête et de queue", train, gens_long, minutes=1320, lumieres=True, **scene_long))
    liste.append(_vue("samedi-detail", "De près (18 m): la locomotive et la tête de la voiture, marches sous les portières", train, gens_long, minutes=960,
                      sol=sol_quai, centre=[36.0, 12.6], terrain=[60, 30], boites=voie_quai))
    # Reprises: sémaphore épaissi (au nord de la voie, bras vers elle), globe de la lanterne de quai.
    reprises = [_objet("semaphore", 9.0, 10.0, "semaphore", cle="a", dy=-1.2), _sur("platform-lantern", 17.0, 15.0, 0.12, "platform-lantern", quart=2, dy=0.9)]
    liste.append(_vue("reprises-nuit", "Reprises, à 22 h: sémaphore (mât de 34 cm, lanterne de 44 cm), globe de la lanterne de quai", reprises,
                      [{"x": 16.0, "z": 14.6, "cap": 0.3, "y": 0.12}], minutes=1320, lumieres=True, sol=sol_quai, centre=[13.0, 8.0], large=22, boites=voie_quai, terrain=[60, 30]))
    # ------------------------------------------------------------ pièces
    cuisine = [
        _objet("wood-stove", 11.0, 9.5, "wood-stove", cle="a", dy=0.7),
        _objet("indoor-logs", 12.0, 9.5, "indoor-logs", cle="a", dy=0.9),
        _objet("plan-de-travail", 14.0, 9.5, cle="a"),
        _sur("jam-jars", 13.95, 9.3, 0.88, "jam-jars", dy=0.9),
        _objet("wall-shelf", 14.0, 9.5, "wall-shelf", cle="a", dy=-0.2),
        _objet("small-keg", 10.5, 12.0, "small-keg", cle="a", quart=1, dy=0.6),
        _objet("broom", 10.5, 13.5, "broom", cle="a", quart=1, dy=0.7),
        _objet("bucket", 11.4, 13.4, "bucket", cle="a", dy=0.5),
        _objet("vegetable-crate", 12.6, 11.4, "vegetable-crate", cle="a", dy=0.6),
        _objet("table-farm", 15.6, 12.0, cle="a"),
        _sur("bread-basket", 15.25, 11.85, 0.75, "bread-basket", dy=0.9),
        _sur("stoneware-pots", 15.95, 11.8, 0.75, "stoneware-pots", dy=-0.8),
        _sur("tin-canisters", 15.7, 12.2, 0.75),
        _objet("stool-farm", 16.7, 12.7, "stool-farm", cle="a", dy=0.5),
        _objet("picture-landscape", 16.8, 9.5, "picture-landscape", cle="a", dy=0.2),
    ]
    liste.append(_vue("cuisine", "Cuisine (9,5 m): poêle et bûches, étagère, confitures, tonnelet, balai, seau, cagette, table garnie, tabouret",
                      cuisine, [{"x": 13.8, "z": 12.6, "cap": 2.8}], sol=PLANCHER, centre=[13.2, 10.4], large=9.5, lacet=-35, boites=_murs()))
    salle = [
        _objet("dresser", 12.0, 9.5, "dresser", cle="a", dy=0.9),
        _sur("mantel-clock", 12.0, 9.37, 0.9, "mantel-clock", dy=-0.6),
        _objet("wall-clock", 14.2, 9.5, "wall-clock", cle="a", dy=-0.3),
        _objet("rug-round", 15.0, 11.6, "rug-round", cle="a", dy=1.2),
        _objet("table-farm", 15.0, 11.5, cle="a"),
        _sur("oil-lamp", 15.15, 11.35, 0.75, "oil-lamp", dy=-0.7),
        _sur("bread-basket", 14.6, 11.6, 0.75),
        _sur("newspaper", 15.5, 11.7, 0.75, "newspaper", dy=0.6),
        _objet("table-bench", 15.0, 12.25, "table-bench", cle="a", dy=0.9),
        _objet("chair-farm", 15.0, 10.75, cle="a"),
        _objet("coat-rack", 10.5, 10.4, "coat-rack", cle="a", quart=1, dy=0.6),
        _objet("door-curtain", 10.5, 12.5, "door-curtain", cle="a", quart=1, dy=0.8),
        _objet("picture-portrait", 16.6, 9.5, "picture-portrait", cle="a", dy=0.0),
        _objet("flower-vase", 17.6, 9.6, cle="a"),
        _objet("chest", 17.6, 9.6, cle="a"),
    ]
    salle[-2]["y"] = 0.655
    salle[-2]["nom"] = "flower-vase"
    murs_salle = _murs(porte_ouest=(12.05, 12.95))
    liste.append(_vue("salle", "Salle (9,5 m): vaisselier, pendule, régulateur, tapis rond, lampe à pétrole, pain, journal, banc, patère, rideau de passage, portrait, bouquet",
                      salle, [{"x": 13.0, "z": 12.9, "cap": 2.6}], sol=PLANCHER, centre=[13.2, 10.4], large=9.5, lacet=-35, boites=murs_salle))
    liste.append(_vue("salle-nuit", "La même salle à 21 h 30: la lampe à pétrole sur la table", salle, [{"x": 13.0, "z": 12.9, "cap": 2.6}],
                      sol=PLANCHER, centre=[13.2, 10.4], large=9.5, lacet=-35, boites=murs_salle, minutes=1290, lumieres=True))
    chambre = [
        _objet("bed-double", 12.0, 10.0, cle="a"),
        _objet("picture-oval", 12.0, 9.5, "picture-oval", cle="a", dy=-0.2),
        _objet("stool-farm", 13.25, 9.55, cle="b"),
        _sur("table-lamp", 13.25, 9.55, 0.46, "table-lamp (sur un tabouret)", dy=-0.6),
        _objet("chest", 12.0, 11.6, cle="a"),
        _sur("book-stack", 12.15, 11.6, 0.655, "book-stack", dy=0.7),
        _objet("wardrobe", 15.5, 9.5, cle="a"),
        _objet("laundry-basket", 16.7, 9.7, "laundry-basket", cle="a", dy=0.6),
        _objet("rug-runner", 15.5, 12.4, "rug-runner", cle="a", dy=0.6),
        _objet("picture-portrait", 10.5, 12.5, cle="a", quart=1),
    ]
    liste.append(_vue("chambre", "Chambre (9,5 m): médaillon au-dessus du lit, lampe de chevet, livres sur le coffre, panier à linge, chemin de couloir",
                      chambre, [{"x": 14.0, "z": 12.0, "cap": 2.8}], sol=PLANCHER, centre=[13.2, 10.4], large=9.5, lacet=-35, boites=_murs()))
    commerce = [
        _objet("door-curtain", 11.5, 9.5, cle="a"),
        _objet("wall-shelf", 13.4, 9.5, cle="a"),
        _objet("wall-shelf", 14.6, 9.5, cle="b"),
        _objet("wall-clock", 16.4, 9.5, cle="a"),
        _objet("comptoir-epicerie", 14.0, 10.9, cle="a"),
        _objet("broom", 10.5, 9.5, cle="a", quart=1),
        _objet("vegetable-crate", 11.6, 12.6, "cagettes devant le comptoir", cle="a", dy=0.6),
        _objet("vegetable-crate", 12.4, 12.7, cle="b"),
        _objet("laundry-basket", 16.0, 12.7, "panier", cle="b", dy=0.6),
        _objet("small-keg", 17.4, 12.6, cle="a"),
        _objet("table-farm", 17.4, 10.6, cle="a"),
        _sur("jam-jars", 17.1, 10.5, 0.75),
        _sur("tin-canisters", 17.7, 10.6, 0.75),
        _objet("rug-runner", 14.0, 12.2, cle="b"),
    ]
    liste.append(_vue("commerce", "Épicerie (9,5 m): étagères garnies, régulateur, rideau de la réserve, cagettes, tonnelet, panier, table de confitures",
                      commerce, [{"x": 14.6, "z": 13.2, "cap": 3.1}], sol=PLANCHER, centre=[13.2, 10.4], large=9.5, lacet=-35, boites=_murs()))
    return liste


def planche(manifeste, dossier, sortie):
    liste = vues(manifeste)
    with open(f"{dossier}/mesures.json", encoding="utf8") as f:
        mesures = json.load(f)
    colonnes, marge, bandeau, titre = 2, 18, 46, 118
    largeur = marge + colonnes * (VUE[0] + marge)
    rangs = -(-len(liste) // colonnes)
    image = Image.new("RGB", (largeur, titre + rangs * (VUE[1] + bandeau + marge)), PAPIER)
    d = ImageDraw.Draw(image)
    d.text((marge, 16), "Aubrune: trains vus du dehors et objets d'intérieur", font=police(42, True), fill=ENCRE)
    miens = {i: m for i, m in manifeste["models"].items() if m.get("source") == SOURCE and m.get("family") in FAMILLES}
    trains = sum(m["triangles"] for m in miens.values() if m["family"] == "vehicule")
    objets = [m for m in miens.values() if m["family"] == "objet"]
    resume = (f"4 véhicules ({trains} triangles), {len(objets)} objets ({sum(m['triangles'] for m in objets)} triangles). "
              "Chaque vue est une image du jeu: 1366 x 768, plongée de 50 degrés, rendu encré (InkKit), silhouette de 1,70 m.")
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
        d.text((x + 4, y + VUE[1] + 6), vue["titre"], font=police(19, True), fill=ENCRE)
        m = mesures.get(vue["nom"], {})
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
