"""Planche de contrôle du troisième lot d'Aubrune: cultures, décor des fêtes, reprises.

    python3 cultures_fetes.py vues <decors.json> <vues.json>
    python3 cultures_fetes.py planche <decors.json> <dossier des captures> <sortie.png>

Mêmes règles que les autres planches (`monter.py`): chaque vue est une image du rendu encré du
jeu, 1366 x 768, plongée de 50 degrés, silhouette de 1,70 m. Potager: une case bêchée par plant,
arrosée (stades) ou sèche (à arroser). Place: un sol de cour, les meubles de fête posés comme une
carte les poserait. Voie: rails et traverses du jeu en boîtes de mise en scène (rails à 0,72 m de
l'axe, dessus à 0,26 m), posés sur les modules de voie.
"""

import json
import sys

from PIL import Image, ImageDraw

from monter import ENCRE, PAPIER, VUE, _objet, _vue, police
from trains_interieurs import _murs, _sur

SOURCE = "recoltables-aubrune"
LEGUMES = ("crop-carotte", "crop-poireau", "crop-pomme-de-terre")
FLEURS_A = ("crop-tournesol", "crop-capucine", "crop-souci", "crop-pensee", "crop-giroflee", "crop-bleuet")
FLEURS_B = ("crop-rose-des-lacombe", "crop-marguerite", "crop-nigelle", "crop-oeillet-de-poete", "crop-muguet", "crop-violette")
PLANCHER = {"nature": "plancher", "areas": []}


def _nom(culture):
    return culture.replace("crop-", "").replace("-", " ")


def _rangs(crops, cultures, x0, z0, avec_soif=True, etiquettes=True):
    """Une culture par rang (nord au sud), ses stades d'ouest en est sur des cases arrosées, puis
    le dernier stade avant la fleur, à arroser, sur une case sèche. Friche de 6 x 4 dessous."""
    objets = []
    for b in range((len(cultures) + 3) // 4):
        objets.append(_objet("garden-bed", x0 + 3, z0 + b * 4 + 2, cle=f"lit{b}"))
    for j, culture in enumerate(cultures):
        c = crops[culture]
        z = z0 + j + 0.5
        cases = [(i, "watered", m) for i, m in enumerate(c["stages"])]
        if avec_soif:
            cases.append((5, "tilled", c["thirsty"][-1]))
        for i, sol, modele in cases:
            x = x0 + i + 0.5
            objets.append(_objet(f"garden-bed-{sol}", x, z, cle=f"case{j}{i}", quart=(i + j) % 2 * 2))
            objets.append(_objet(modele, x, z, None, cle=f"plant{j}{i}"))
        if etiquettes:
            # Le nom du rang, à gauche de la friche.
            objets.append({"etiquette": {"texte": _nom(culture), "x": x0 - 0.9, "z": z}})
    return objets


def _vue_rangs(nom, titre, objets, silhouettes, **plus):
    """`_vue`, plus les étiquettes de rang posées par `_rangs`."""
    vue = _vue(nom, titre, [o for o in objets if "etiquette" not in o], silhouettes, **plus)
    vue["etiquettes"] += [o["etiquette"] for o in objets if "etiquette" in o]
    return vue


def _voie_z(x, z0, z1):
    """Traverses et rails du jeu le long de z (la voie qui sort du tunnel vers le sud)."""
    boites = []
    n = int((z1 - z0) / 0.65)
    for k in range(n):
        boites.append({"w": 2.5, "h": 0.12, "d": 0.24, "x": x, "y": 0.06, "z": z0 + 0.3 + k * 0.65, "couleur": "#5b4634", "couche": "grain"})
    for d in (-0.72, 0.72):
        boites.append({"w": 0.08, "h": 0.14, "d": z1 - z0, "x": x + d, "y": 0.19, "z": (z0 + z1) / 2, "couleur": "#6b6865"})
    return boites


def vues(manifeste):
    crops = manifeste["crops"]
    liste = []
    # ------------------------------------------------------------ potager
    legumes = _rangs(crops, LEGUMES + ("crop-radis", "crop-tomate"), 8, 8.5)
    liste.append(_vue_rangs("legumes", "Légumes du concours: carotte, poireau, pomme de terre (puis radis et tomate), stades 0 à mûr, et à arroser (case sèche, à droite)",
                      legumes, [{"x": 15.4, "z": 11.0, "cap": -0.7}], centre=[11.6, 10.6], large=10))
    for nom, groupe, titre in (("fleurs-a", FLEURS_A, "Fleurs (1): tournesol, capucine, souci, pensée, giroflée, bleuet: levée, feuillage, bouton, fleur; à arroser à droite"),
                               ("fleurs-b", FLEURS_B, "Fleurs (2): rose des Lacombe, marguerite, nigelle, œillet de poète, muguet, violette; à arroser à droite")):
        liste.append(_vue_rangs(nom, titre, _rangs(crops, groupe, 8, 8.0), [{"x": 15.4, "z": 12.4, "cap": -0.7}], centre=[11.6, 10.3], large=10))
    # Le potager à la caméra de jeu: les quinze cultures mûres, deux cases chacune.
    toutes = ["crop-radis", "crop-tomate", *LEGUMES, *FLEURS_A[1:], *FLEURS_B[1:], "crop-tournesol", "crop-rose-des-lacombe"]
    jeu = [_objet("garden-bed", 9, 11, cle="j1"), _objet("garden-bed", 15, 11, cle="j2"), _objet("garden-bed", 21, 11, cle="j3")]
    for k, culture in enumerate(toutes):
        for r in range(2):
            idx = k * 2 + r
            i, j = idx % 18, idx // 18
            x, z = 6 + i + 0.5, 9 + j + 0.5
            jeu.append(_objet("garden-bed-watered", x, z, cle=f"jc{idx}"))
            jeu.append(_objet(crops[culture]["stages"][-1], x, z, _nom(culture) if r == 0 else None, cle=f"jp{idx}", dy=0.1 if j % 2 == 0 else 0.6))
    sol_jeu = {"nature": "herbe", "areas": [{"x": 4, "y": 13.4, "w": 22, "h": 1.6, "nature": "chemin"}]}
    liste.append(_vue("potager-jeu", "Le potager à la caméra de jeu (18 m): les quinze cultures mûres, deux cases chacune", jeu,
                      [{"x": 16.0, "z": 14.2, "cap": 0.4}], sol=sol_jeu, centre=[15.0, 11.2], large=20))
    # ------------------------------------------------------------ place en fête
    # La place au nord, la route au sud; la lisse fleurie barre la route (bras nord-sud), la
    # banderole est tendue à l'entrée de la place, face à la route.
    sol_place = {"nature": "herbe", "areas": [{"x": 4, "y": 5, "w": 22, "h": 11.5, "nature": "cour"}, {"x": 0, "y": 16.5, "w": 30, "h": 3, "nature": "route"}]}
    fete = [
        _objet("bandstand", 15.0, 8.7, "estrade de la fanfare", cle="a", dy=-1.6),
        _objet("lampion-garland", 7.0, 6.2, "guirlande de lampions", cle="a", dy=-0.4),
        _objet("lampion-garland", 11.0, 6.2, cle="b"),
        _objet("lampion-garland", 15.0, 6.2, cle="c"),
        _objet("lampion-garland", 19.0, 6.2, cle="d"),
        _objet("lampion-pole", 21.0, 6.2, cle="a"),
        _objet("banquet-table", 12.5, 12.6, "table du banquet", cle="a", dy=0.9),
        _objet("table-bench", 12.0, 11.85, cle="a"),
        _objet("table-bench", 12.0, 13.35, cle="b", quart=2),
        _objet("festival-cauldron", 19.5, 12.0, "grande marmite", cle="a", dy=1.3),
        _objet("tapped-barrel", 7.5, 11.2, "tonneau en perce", cle="a", dy=0.7),
        _objet("chalk-board", 8.8, 10.0, "ardoise", cle="a", dy=-0.8),
        _objet("brazier", 22.5, 14.2, "brasero", cle="a", dy=0.7),
        _objet("festival-banner", 15.0, 16.0, "banderole", cle="a", dy=-0.6),
        _objet("crossing-gate-flowered", 4.5, 18.0, "lisse fleurie", cle="a", quart=1, dy=-2.9),
        _objet("festival-candle", 3.9, 20.6, "lumignons", cle="a", dy=0.5),
        _objet("festival-candle", 5.2, 20.7, cle="b"),
        _sur("festival-candle", 7.5, 11.25, 1.02),
        _sur("festival-candle", 11.8, 12.5, 0.768),
        _sur("festival-candle", 13.3, 12.7, 0.768),
        _objet("festival-candle", 14.6, 10.5, cle="c"),
        _objet("festival-candle", 15.4, 10.5, cle="d"),
        _objet("street-lantern", 24.5, 9.0, cle="a"),
    ]
    gens = [{"x": 10.6, "z": 14.6, "cap": 0.5}, {"x": 17.8, "z": 13.2, "cap": -0.8}]
    scene = dict(sol=sol_place, centre=[13.4, 11.6], large=22, terrain=[30, 24])
    liste.append(_vue("fete-jour", "La place un jour de fête (22 m): estrade, guirlandes, banquet, marmite, tonneau, ardoise, brasero, banderole, lisse fleurie, lumignons", fete, gens, minutes=900, **scene))
    liste.append(_vue("fete-nuit", "La même à 22 h: lampions, lumignons, feu de la marmite et brasero allumés", fete, gens, minutes=1320, lumieres=True, **scene))
    # ------------------------------------------------------------ tunnel et voie
    sol_voie = {"nature": "herbe", "areas": [{"x": 12, "y": 15, "w": 6, "h": 19, "nature": "voie"}]}
    # Le portail au nord (z = 15), la voie sort vers le sud entre les murs en aile, en tranchée,
    # puis au ras du pré. Modules de voie fusionnés par sorte (`fusion`): ce que le moteur devra
    # faire pour qu'une file se lise d'un seul tenant.
    tunnel = [_objet("tunnel-portal", 15.0, 15.0, "portail du tunnel et son coteau", cle="a", dy=-9.0)]
    for k in range(4):
        tunnel.append({**_objet("rail-bed", 15.0, 16.0 + k, cle=f"rb{k}"), "fusion": "lit"})
    for k in range(5):
        tunnel.append({**_objet("rail-cutting" if k % 3 else "rail-cutting-b", 15.0, 20.0 + k, "tranchée: ballast, fossés d'eau, talus" if k == 2 else None, cle=f"rc{k}", dy=0.0), "fusion": "tranchee"})
    for k in range(6):
        tunnel.append({**_objet("rail-bed", 15.0, 25.0 + k, "voie au ras du pré" if k == 3 else None, cle=f"rr{k}", dy=0.0), "fusion": "remblai"})
    liste.append(_vue("tunnel", "Le portail du tunnel dans son coteau (rochers, arbustes, deux jeunes arbres), la voie en tranchée puis au ras du pré",
                      tunnel, [{"x": 18.4, "z": 25.0, "cap": 0.4}], centre=[15.0, 14.5], large=32, terrain=[30, 34], sol=sol_voie, boites=_voie_z(15.0, 15.6, 32.0)))
    # ------------------------------------------------------------ fournil et comptoirs
    fournil = [
        _objet("four", 16.4, 9.5, "four", cle="a", dy=-0.4),
        _objet("plan-de-travail", 12.5, 9.5, cle="a"),
        _objet("comptoir-fournil", 14.0, 11.6, "vitrine du fournil", cle="a", dy=0.9),
        _objet("bread-basket", 16.0, 11.6, cle="a"),
        _objet("broom", 10.5, 13.0, cle="a", quart=1),
    ]
    liste.append(_vue("fournil", "Le fournil (9,5 m): la vitrine de bois et de verre, les pains dedans; Achille derrière", fournil,
                      [{"x": 14.0, "z": 10.7, "cap": 0.0}, {"x": 14.6, "z": 13.4, "cap": 3.0}], sol=PLANCHER, centre=[13.2, 10.6], large=9.5, lacet=-35, boites=_murs()))
    comptoirs = [
        _objet("comptoir-epicerie", 11.6, 10.0, "épicerie (vert des volets)", cle="a", dy=1.0),
        _objet("comptoir-mercerie", 14.0, 11.6, "mercerie (tuile)", cle="a", dy=1.0),
        _objet("comptoir-cafe", 16.6, 10.0, "café (bois et zinc)", cle="a", dy=1.0),
        _objet("comptoir", 12.2, 13.0, "buvette", cle="a", dy=0.9),
        _objet("comptoir-fournil", 16.0, 13.0, "vitrine", cle="b", dy=0.9),
    ]
    liste.append(_vue("comptoirs", "Comptoirs ramenés aux tons du bourg: épicerie, mercerie, café, buvette, vitrine", comptoirs,
                      [{"x": 18.0, "z": 12.0, "cap": 2.8}], sol=PLANCHER, centre=[14.0, 11.6], large=9.5, boites=[]))
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
    d.text((marge, 16), "Aubrune, troisième lot: cultures, décor des fêtes, reprises", font=police(42, True), fill=ENCRE)
    miens = {i: m for i, m in manifeste["models"].items() if m.get("source") == SOURCE}
    cultures = [m for i, m in miens.items() if i.startswith(("crop-carotte", "crop-poireau", "crop-pomme")) or any(i.startswith(c) for c in FLEURS_A + FLEURS_B)]
    fetes = [m for m in miens.values() if m["family"] == "fete"]
    resume = (f"15 cultures dont 3 légumes et 12 fleurs ({len(cultures)} modèles de case, {sum(m['triangles'] for m in cultures)} triangles), "
              f"{len(fetes)} modèles de fête ({sum(m['triangles'] for m in fetes)} triangles). Chaque vue est une image du jeu: 1366 x 768, plongée de 50 degrés, rendu encré (InkKit), silhouette de 1,70 m.")
    d.text((marge, 72), resume, font=police(20), fill=ENCRE)
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
        d.text((x + 4, y + VUE[1] + 6), vue["titre"], font=police(17, True), fill=ENCRE)
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
        liste = vues(manifeste)
        with open(sys.argv[3], "w", encoding="utf8") as f:
            json.dump(liste, f, ensure_ascii=False, indent=1)
            f.write("\n")
    else:
        planche(manifeste, sys.argv[3], sys.argv[4])


if __name__ == "__main__":
    main()
