"""Planche de contrôle des aménagements d'Aubrune (haies, berges, rangs, meubles, repères).

    python3 provisoires.py vues <decors.json> <vues.json>
    python3 provisoires.py planche <decors.json> <dossier des captures> <sortie.png>

Mêmes règles que la planche des récoltables (`monter.py`): chaque vue est une image du rendu
encré du jeu, 1366 x 768, plongée de 50 degrés, 18 m de large sauf mention, silhouette de 1,70 m.
Les rails et traverses de la voie sont des boîtes de mise en scène (le jeu a les siens).
"""

import json
import sys

from PIL import Image, ImageDraw

from monter import ENCRE, PAPIER, VUE, _objet, _vue, police

SOURCE = "recoltables-aubrune"
FAMILLES = ("haie", "talus", "rang", "meuble", "ouvrage")


def _voie(x0, x1, z, axe="x"):
    """Deux rails et leurs traverses (écartement d'un mètre, la petite ligne)."""
    boites = []
    longueur = x1 - x0
    n = int(longueur / 0.6)
    for k in range(n):
        p = x0 + 0.3 + k * 0.6
        if axe == "x":
            boites.append({"w": 0.22, "h": 0.1, "d": 1.7, "x": p, "y": 0.05, "z": z, "couleur": "#7A5E44", "couche": "grain"})
        else:
            boites.append({"w": 1.7, "h": 0.1, "d": 0.22, "x": z, "y": 0.05, "z": p, "couleur": "#7A5E44", "couche": "grain"})
    for d in (-0.5, 0.5):
        if axe == "x":
            boites.append({"w": longueur, "h": 0.08, "d": 0.07, "x": (x0 + x1) / 2, "y": 0.14, "z": z + d, "couleur": "#5C5A58"})
        else:
            boites.append({"w": 0.07, "h": 0.08, "d": longueur, "x": z + d, "y": 0.14, "z": (x0 + x1) / 2, "couleur": "#5C5A58"})
    return boites


def _fusion(objets, cle):
    """Modules d'une même file, fusionnés en un maillage par la page (ce que le moteur devra faire)."""
    for o in objets:
        o["fusion"] = cle
    return objets


def vues(manifeste):
    liste = []
    # Pièces détachées: chaque module seul, nommé.
    pieces = [
        ("hedge", 7.5, 8.6, 0), ("hedge-b", 9.5, 8.6, 0), ("hedge-c", 11.5, 8.6, 0), ("hedge-end", 13.5, 8.6, 0), ("hedge-corner", 15.5, 8.6, 0),
        ("field-row", 19.5, 8.6, 0), ("field-row-b", 21.5, 8.6, 0),
        ("bank", 7.5, 13.0, 0), ("bank-b", 9.5, 13.0, 0), ("bank-end", 11.5, 13.0, 0), ("bank-corner", 13.5, 13.0, 0), ("bank-corner-inner", 15.5, 13.0, 0),
    ]
    liste.append(_vue("modules", "Modules de 1 m: haie (3 formes, bout, angle), rang du labour (2 formes), talus de berge (2 formes, bout, angles)",
                      [_objet(m, x, z, m, cle="a", quart=q, dy=0.9) for m, x, z, q in pieces], [{"x": 18.2, "z": 13.4, "cap": 0.4}]))
    # Une file de haie de 12 cases: angle à l'ouest (elle remonte au nord), formes mêlées, bout à l'est.
    haie = [_objet("hedge-corner", 7.5, 10.5, cle="h0", quart=3)]
    formes = ["hedge", "hedge-b", "hedge", "hedge-c", "hedge-b", "hedge", "hedge-c", "hedge", "hedge-b", "hedge-c"]
    haie += [_objet(m, 8.5 + k, 10.5, cle=f"h{k + 1}") for k, m in enumerate(formes)]
    haie.append(_objet("hedge-end", 18.5, 10.5, cle="h11"))
    haie += [_objet(["hedge", "hedge-b", "hedge-c"][k % 3], 7.5, 9.5 - k, cle=f"hn{k}", quart=1) for k in range(4)]
    _fusion(haie, "haie")
    # La même haie posée module par module, comme le rendu pose aujourd'hui les clôtures.
    haie += [_objet(m, 14.5 + k, 17.5, cle=f"s{k}") for k, m in enumerate(["hedge", "hedge-b", "hedge-c", "hedge"])] + [_objet("hedge-end", 18.5, 17.5, cle="s5")]
    sol_haie = {"nature": "herbe", "areas": [{"x": 7, "y": 10, "w": 12, "h": 1, "nature": "lisiere"}, {"x": 7, "y": 6, "w": 1, "h": 4, "nature": "lisiere"}, {"x": 5, "y": 14, "w": 20, "h": 2, "nature": "chemin"}]}
    liste.append(_vue("haie", "Haie de 12 cases fusionnée (angle, 3 formes, bout); en bas, posée module par module", haie,
                      [{"x": 12.2, "z": 12.2, "cap": 0.3}, {"x": 16.0, "z": 14.8, "cap": -0.5}], sol=sol_haie))
    # Berge: le pré au nord, l'eau au sud; la berge tourne au nord-est (angle), puis longe l'eau à l'est.
    berge = [_objet(["bank", "bank-b"][k % 2 if k % 3 else 1], 5.5 + k, 11.5, cle=f"b{k}") for k in range(12)]
    berge.append(_objet("bank-corner", 17.5, 11.5, cle="bc"))
    berge += [_objet(["bank", "bank-b"][k % 2], 17.5, 10.5 - k, cle=f"be{k}", quart=1) for k in range(5)]
    _fusion(berge, "berge")
    sol_berge = {"nature": "herbe", "areas": [{"x": 0, "y": 12, "w": 18, "h": 12, "nature": "eau"}, {"x": 18, "y": 0, "w": 12, "h": 24, "nature": "eau"},
                                             {"x": 5, "y": 11, "w": 13, "h": 1, "nature": "lisiere"}, {"x": 17, "y": 6, "w": 1, "h": 5, "nature": "lisiere"}]}
    berge += [_objet("fishing-spot", 11.0, 12.3, cle="p", quart=0)]
    liste.append(_vue("berge", "Une berge en talus: le pré au nord, l'eau au sud; elle tourne au nord-est (angle) et longe l'eau à l'est", berge,
                      [{"x": 10.4, "z": 10.4, "cap": 0.2}], sol=sol_berge))
    # Château d'eau de la halte, vu de l'ouest (la voie traverse l'image de haut en bas): 10,5 m
    # entre la pile et la voie, comme sur le plan; la grue à eau au bord de la voie.
    sol_halte = {"nature": "herbe", "areas": [{"x": 0, "y": 16, "w": 30, "h": 3, "nature": "voie"}, {"x": 0, "y": 13.6, "w": 30, "h": 2.4, "nature": "quai"},
                                              {"x": 10, "y": 9, "w": 3, "h": 4.6, "nature": "chemin"}]}
    liste.append(_vue("chateau-eau", "Le château d'eau de la halte (12 m), à 10,5 m de la voie, et la grue à eau au bord du quai (vue de l'ouest)", [
        _objet("water-tower", 15.0, 7.0, "water-tower", cle="a", dy=2.8),
        _objet("water-crane", 14.0, 15.0, "water-crane", cle="a", dy=0.0),
    ], [{"x": 13.0, "z": 14.4, "cap": 1.2}, {"x": 13.2, "z": 9.6, "cap": -1.4}], sol=sol_halte, centre=[18.6, 11.6], lacet=90, boites=_voie(2, 30, 17.5)))
    # Sémaphore au bord de la voie et pigeonnier de ferme.
    sol_rep = {"nature": "herbe", "areas": [{"x": 0, "y": 15.5, "w": 30, "h": 3, "nature": "voie"}, {"x": 15, "y": 9, "w": 15, "h": 5, "nature": "cour"}]}
    liste.append(_vue("semaphore-pigeonnier", "Le sémaphore (10 m, bras fermé) au bord de la voie, le pigeonnier de la ferme (10 m)", [
        _objet("semaphore", 9.0, 14.2, "semaphore", cle="a", dy=0.9),
        _objet("dovecote", 19.5, 11.2, "dovecote", cle="a", dy=2.6),
    ], [{"x": 11.0, "z": 13.6, "cap": 0.6}, {"x": 17.0, "z": 13.4, "cap": -0.3}], sol=sol_rep, centre=[15.0, 9.2], boites=_voie(0, 30, 17.0)))
    sol_tunnel = {"nature": "herbe", "areas": [{"x": 13.5, "y": 6, "w": 3, "h": 18, "nature": "voie"}]}
    liste.append(_vue("portail", "Le portail du tunnel (8 m): la voie entre dans l'arc, le coteau au-dessus", [
        _objet("tunnel-portal", 15.0, 9.5, "tunnel-portal", cle="a", dy=3.4),
        _objet("hedge", 6.5, 12.0, cle="h1", quart=1), _objet("hedge-b", 6.5, 13.0, cle="h2", quart=1),
        _objet("hedge-c", 23.5, 12.0, cle="h3", quart=1), _objet("hedge", 23.5, 13.0, cle="h4", quart=1),
    ], [{"x": 12.2, "z": 14.0, "cap": 0.4}], sol=sol_tunnel, centre=[15.0, 8.4], boites=_voie(5.5, 24, 15.0, axe="z")))
    # Roue du moulin dans son bief, le labour en rangs, le poulailler du jardin.
    sol_moulin = {"nature": "herbe", "areas": [{"x": 0, "y": 10, "w": 13.4, "h": 3, "nature": "eau"}, {"x": 14, "y": 7, "w": 10, "h": 7, "nature": "labour"}]}
    rangs = [_objet(["field-row", "field-row-b"][(i + j) % 2], 14.5 + i, 7.5 + j, cle=f"r{i}{j}") for i in range(10) for j in range(7)]
    for o in rangs:
        o["fusion"] = f"rang-{o['x']}"
    liste.append(_vue("roue-labour-poulailler", "La roue du moulin (7 m) dans son bief, le labour en rangs (70 modules), le poulailler du jardin (3 x 2 cases)", [
        _objet("mill-wheel", 10.0, 11.5, "mill-wheel", cle="a", dy=2.2),
        _objet("poulailler", 20.0, 16.5, "poulailler", cle="a", dy=1.2),
    ] + rangs, [{"x": 12.0, "z": 15.4, "cap": 0.3}, {"x": 17.2, "z": 17.2, "cap": -0.4}], sol=sol_moulin, centre=[15.0, 11.0]))
    plancher = {"nature": "plancher", "areas": []}
    liste.append(_vue("cuisine", "Cuisine et fournil (9 m de large): four, cuisinière, plan de travail, réchaud, marmite (avant des meubles: le sud)", [
        _objet("four", 11.5, 10.5, "four", cle="a", dy=0.45),
        _objet("cuisiniere", 12.7, 10.5, "cuisiniere", cle="a", dy=0.45),
        _objet("plan-de-travail", 14.5, 10.5, "plan-de-travail", cle="a", dy=0.45),
        _objet("rechaud", 16.3, 10.5, "rechaud", cle="a", dy=0.45),
        _objet("marmite", 18.0, 12.6, "marmite", cle="a", dy=0.3),
        _objet("marmite-bare", 16.4, 13.0, "marmite-bare", cle="a", dy=0.3),
    ], [{"x": 13.6, "z": 12.4, "cap": 3.14}], sol=plancher, centre=[14.8, 11.6], large=9))
    liste.append(_vue("commerces", "Comptoirs et étals (9 m): buvette, épicerie, fournil, mercerie, café; étal de la tourte (plein, vide); psyché", [
        _objet("comptoir", 11.6, 9.5, "comptoir", cle="a", dy=0.4),
        _objet("comptoir-epicerie", 14.0, 9.5, "comptoir-epicerie", cle="a", dy=0.4),
        _objet("comptoir-fournil", 16.4, 9.5, "comptoir-fournil", cle="a", dy=0.4),
        _objet("comptoir-mercerie", 11.6, 12.0, "comptoir-mercerie", cle="a", dy=0.4),
        _objet("comptoir-cafe", 13.6, 12.0, "comptoir-cafe", cle="a", dy=0.4),
        _objet("etal", 15.0, 12.0, "etal", cle="a", dy=0.4),
        _objet("etal-bare", 16.2, 12.0, "etal-bare", cle="a", dy=0.4),
        _objet("miroir", 18.0, 11.0, "miroir", cle="a", dy=0.4),
    ], [{"x": 17.6, "z": 13.4, "cap": 3.0}], sol=plancher, centre=[14.8, 11.4], large=9))
    liste.append(_vue("atelier", "Forge et atelier (9 m): enclume, établi, meule, râtelier de haches (plein, vide), râtelier de la forge", [
        _objet("enclume", 11.5, 11.0, "enclume", cle="a", dy=0.35),
        _objet("etabli", 13.6, 10.5, "etabli", cle="a", dy=0.45),
        _objet("meule", 15.8, 11.0, "meule", cle="a", dy=0.35),
        _objet("ratelier", 11.5, 13.0, "ratelier", cle="a", dy=0.3),
        _objet("ratelier-bare", 12.8, 13.0, "ratelier-bare", cle="a", dy=0.3),
        _objet("ratelier-forge", 14.1, 13.0, "ratelier-forge", cle="a", dy=0.3),
        _objet("four", 17.6, 10.6, "four (foyer)", cle="b", dy=0.45),
    ], [{"x": 16.4, "z": 13.0, "cap": 2.6}], sol=plancher, centre=[14.6, 11.6], large=9))
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
    d.text((marge, 16), "Aubrune: haies, berges, labour, meubles et repères (fin des blocs provisoires)", font=police(42, True), fill=ENCRE)
    miens = {i: m for i, m in manifeste["models"].items() if m.get("source") == SOURCE and m.get("family") in FAMILLES}
    total = sum(m["triangles"] for m in miens.values())
    resume = (f"{len(miens)} modèles ({total} triangles). Chaque vue est une image du jeu: 1366 x 768, plongée de 50 degrés, 18 m de large (sauf mention), "
              "rendu encré du jeu (InkKit), fin d'après-midi. Silhouette de 1,70 m.")
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
        d.text((x + 4, y + VUE[1] + 6), vue["titre"], font=police(21, True), fill=ENCRE)
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
