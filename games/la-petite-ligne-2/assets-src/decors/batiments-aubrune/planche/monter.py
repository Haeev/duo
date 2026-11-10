"""Planche de contrôle des bâtiments: liste des vues à capturer, puis montage des captures.

    duo-python monter.py vues <batiments.json> <vues.json>
    duo-python monter.py planche <batiments.json> <dossier des captures> <sortie.png>

Chaque bâtiment est vu à 50 degrés de plongée, face à sa porte, avec une silhouette de 1,70 m
près du seuil; en bas, deux façades vues de près en lumière rasante (soleil à 20 degrés), puis
trois vues rapprochées des pièces corrigées (cheminée, travées de l'église, horloge).
"""

import json
import sys

from PIL import Image, ImageDraw, ImageFont

# Les bâtiments demandés d'abord, dans l'ordre où le joueur les rencontre; les autres ensuite.
ORDRE = [
    "halte", "maison", "epicerie", "scierie", "firmin", "fournil", "mercerie", "ecole", "cafe", "forge",
    "eglise", "lavoir", "moulin", "ferme-logis", "grange",
]
CASE = (640, 480)
COLONNES = 6
RASANTES = [
    ("rasante-crepi", "firmin", "crépi sur soubassement de pierre (la maison de Firmin, façade sud)"),
    ("rasante-pierre", "ecole", "pierre apparente (l'école-mairie, façade sud)"),
]
ENCRE = (35, 26, 23)
PAPIER = (243, 234, 216)


def ordre(manifeste):
    ids = [i for i in ORDRE if i in manifeste["batiments"]]
    return ids + sorted(i for i in manifeste["batiments"] if i not in ids)


# Vues qui ne sont pas « face à la porte »: le détail propre du bâtiment est de l'autre côté.
VUES_PROPRES = {
    "lavoir": "lacet=-60",  # le bassin est côté ru, à l'est
    "moulin": "lacet=-28",  # la roue est sur le pignon sud, la porte au nord
    "eglise": "y=7",  # cadrer aussi le clocher
    "poste": "lacet=150",  # l'escalier est sur le pignon ouest
}
# Vues rapprochées des pièces corrigées (remarques du client du 2026-11-10).
ZOOMS = [
    ("zoom-cheminee", "id=forge&x=0&z=-3.3&y=6.2&largeur=3.4&lacet=200&plongee=38", "cheminée de la forge: chapeau de tôle à deux pans sur quatre pieds"),
    ("zoom-eglise", "id=eglise&x=3&z=6&y=3.2&largeur=17&lacet=-8&plongee=28", "église, façade sud: un vitrail au milieu de chaque travée"),
    ("zoom-horloge", "id=ecole&x=0&z=3&y=5.3&largeur=4.6&lacet=-12&plongee=24", "école-mairie: l'horloge dans son fronton, sur l'axe de la porte"),
]
ZOOM = (960, 720)


def vues(manifeste):
    liste = [{"nom": i, "requete": f"id={i}" + (f"&{VUES_PROPRES[i]}" if i in VUES_PROPRES else ""), "largeur": CASE[0], "hauteur": CASE[1]} for i in ordre(manifeste)]
    for nom, ident, _legende in RASANTES:
        demi = manifeste["batiments"][ident]["emprise"]["profondeur"] / 2
        liste.append({"nom": nom, "requete": f"id={ident}&largeur=9.5&lacet=-24&plongee=38&x=0.4&z={demi}&y=2.3&ambiance=crepuscule&dense=0&soleil=plan", "largeur": 1900, "hauteur": 1000})
    for nom, requete, _legende in ZOOMS:
        liste.append({"nom": nom, "requete": requete, "largeur": ZOOM[0], "hauteur": ZOOM[1]})
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
    ids = ordre(manifeste)
    rangs = -(-len(ids) // COLONNES)
    marge, bandeau, titre = 16, 54, 110
    largeur = marge + COLONNES * (CASE[0] + marge)
    bas_grille = titre + rangs * (CASE[1] + bandeau + marge)
    rasante_l = (largeur - 3 * marge) // 2
    rasante_h = round(rasante_l * 1000 / 1900)
    zoom_l = (largeur - 4 * marge) // 3
    zoom_h = round(zoom_l * ZOOM[1] / ZOOM[0])
    bas_rasantes = bas_grille + 60 + rasante_h + bandeau + marge
    hauteur = bas_rasantes + 60 + zoom_h + bandeau + marge
    image = Image.new("RGB", (largeur, hauteur), PAPIER)
    d = ImageDraw.Draw(image)
    d.text((marge, 18), "Aubrune: les bâtiments du bourg, assemblés depuis leurs fiches", font=police(40, True), fill=ENCRE)
    total = sum(b["triangles"] for b in manifeste["batiments"].values())
    octets = sum(b["octets"] for b in manifeste["batiments"].values())
    resume = f"{len(ids)} bâtiments, {total} triangles, {octets / 1e6:.1f} Mo de GLB. Plongée de 50 degrés, face à la porte, silhouette de 1,70 m au seuil. Matière, ombres et encrage de la scène d'essai validée (jour dense, soleil derrière la caméra à gauche)."
    d.text((marge, 68), resume, font=police(22), fill=ENCRE)
    for k, ident in enumerate(ids):
        b = manifeste["batiments"][ident]
        x = marge + (k % COLONNES) * (CASE[0] + marge)
        y = titre + (k // COLONNES) * (CASE[1] + bandeau + marge)
        try:
            vue = Image.open(f"{dossier}/{ident}.png").convert("RGB").resize(CASE, Image.LANCZOS)
            image.paste(vue, (x, y))
        except OSError:
            d.rectangle((x, y, x + CASE[0], y + CASE[1]), outline=ENCRE)
            d.text((x + 20, y + 20), "capture manquante", font=police(20), fill=ENCRE)
        d.text((x + 4, y + CASE[1] + 4), b["nom"], font=police(22, True), fill=ENCRE)
        porte = f", porte {b['porte']['facade']}" if b.get("porte") else ""
        if ident in VUES_PROPRES and "lacet" in VUES_PROPRES[ident]:
            porte += " (vu de l'autre côté)"
        d.text((x + 4, y + CASE[1] + 30), f"{b['emprise']['largeur']} x {b['emprise']['profondeur']} m{porte}, {b['triangles']} triangles", font=police(17), fill=ENCRE)
    d.text((marge, bas_grille + 12), "De près, en lumière rasante (soleil à 20 degrés): le relief est dans la géométrie", font=police(30, True), fill=ENCRE)
    for k, (nom, _ident, legende) in enumerate(RASANTES):
        x = marge + k * (rasante_l + marge)
        y = bas_grille + 60
        try:
            vue = Image.open(f"{dossier}/{nom}.png").convert("RGB").resize((rasante_l, rasante_h), Image.LANCZOS)
            image.paste(vue, (x, y))
        except OSError:
            d.rectangle((x, y, x + rasante_l, y + rasante_h), outline=ENCRE)
        d.text((x + 4, y + rasante_h + 8), legende, font=police(22, True), fill=ENCRE)
    d.text((marge, bas_rasantes + 12), "Les remarques du 10 novembre, de près: cheminées, travées des façades, horloge", font=police(30, True), fill=ENCRE)
    for k, (nom, _requete, legende) in enumerate(ZOOMS):
        x = marge + k * (zoom_l + marge)
        y = bas_rasantes + 60
        try:
            vue = Image.open(f"{dossier}/{nom}.png").convert("RGB").resize((zoom_l, zoom_h), Image.LANCZOS)
            image.paste(vue, (x, y))
        except OSError:
            d.rectangle((x, y, x + zoom_l, y + zoom_h), outline=ENCRE)
        d.text((x + 4, y + zoom_h + 8), legende, font=police(22, True), fill=ENCRE)
    # Réduite aux deux tiers: la planche se lit entière et pèse trois fois moins dans le dépôt.
    image = image.resize((image.size[0] * 2 // 3, image.size[1] * 2 // 3), Image.LANCZOS)
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
