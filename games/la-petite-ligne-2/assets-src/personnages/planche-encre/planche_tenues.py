"""Vues et montage de la planche des tenues (rendu encré de l'aperçu des personnages).

  python3 planche_tenues.py vues <planche|controle> <vues.json> [id,id]
  python3 planche_tenues.py monter <planche|controle> <dossier des vues> <sortie.png> [id,id]

`planche`: chaque pièce de la garde-robe portée de face et de dos sur deux silhouettes, puis trois tenues
complètes en marche. `controle`: chaque pièce de profil en marche, en course, assise et couchée, et de trois
quarts dos (contrôle des traversées, non livré).
"""
import json
import os
import sys

from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
CATALOGUE = os.path.join(HERE, "..", "..", "..", "donnees", "commun", "personnages", "catalogue.json")
FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
FONT_BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"

# Pièces montrées, dans l'ordre de la planche: (id, teinte de la pièce, porteur A, porteur B, teinte B).
PIECES = [
    ("accessory-vest", ["bouteille", "laiton"], "adult-m-medium", "adult-f-round", ["chocolat", "cuir_sombre"]),
    ("top-cardigan", ["moutarde", "cuir_sombre"], "adult-f-slim", "elder-medium", ["bouteille", "caoutchouc_clair"]),
    ("top-work-jacket", ["bleu_de_travail", "acier"], "adult-m-round", "adult-f-medium", ["olive", "laiton"]),
    ("bottom-corduroy", ["noisette"], "adult-m-slim", "adult-f-round", ["bouteille"]),
    ("bottom-long-skirt", ["prune"], "adult-f-medium", "adult-m-round", ["marine"]),
    ("bottom-overalls", ["bleu_de_travail", "laiton"], "adult-f-slim", "adult-m-round", ["olive", "acier"]),
    ("dress-sunday", ["ciel", "craie"], "adult-f-round", "child-medium", ["coquelicot", "craie"]),
    ("shoes-clogs", ["noisette", "cuir_sombre"], "adult-m-medium", "adult-f-slim", ["ocre", "cuir"]),
    ("hat-cap", ["anthracite"], "adult-m-round", "adult-f-medium", ["ficelle"]),
    ("hat-straw", ["ficelle", "coquelicot"], "adult-f-slim", "elder-medium", ["lin", "marine"]),
    ("accessory-scarf", ["coquelicot", "craie"], "adult-f-medium", "adult-m-slim", ["marine", "moutarde"]),
    ("accessory-neckerchief", ["coquelicot"], "adult-m-medium", "adult-f-round", ["bleu_de_travail"]),
    ("accessory-apron", ["lin", "ficelle"], "adult-f-round", "adult-m-slim", ["ciel", "craie"]),
]

# Ce que porte chaque silhouette sous la pièce montrée (tête, coiffure, peau).
PORTEURS = {
    "adult-f-slim": (4, "head-round", ["noir"], "hair-bob", ["noir"]),
    "adult-f-medium": (1, "head-round", ["chatain"], "hair-bun", ["roux"]),
    "adult-f-round": (3, "head-round", ["auburn"], "hair-side-part", ["blond_miel"]),
    "adult-m-slim": (6, "head-square", ["noir"], "hair-short", ["noir"]),
    "adult-m-medium": (2, "head-square", ["brun"], "hair-side-part", ["brun"]),
    "adult-m-round": (0, "head-round", ["chatain"], "hair-short", ["chatain"]),
    "child-medium": (5, "head-round", ["brun"], "hair-short", ["brun"]),
    "elder-medium": (1, "head-square", ["gris"], "hair-short", ["blanc"]),
}

# Vêtements neutres autour de la pièce montrée, par emplacement libre.
FOND = {
    "top": ["top", "top-tee", ["craie"]],
    "bottom": ["bottom", "bottom-trousers", ["anthracite"]],
    "shoes": ["shoes", "shoes-pebble", ["cuir_sombre", "semelle"]],
}

# Trois tenues complètes en marche (planche) : nom, silhouette, pièces.
TENUES = [
    ("Le dimanche", "adult-f-medium", [["dress", "dress-sunday", ["coquelicot", "craie"]], ["hat", "hat-straw", ["ficelle", "marine"]], ["shoes", "shoes-pebble", ["cuir", "semelle"]]]),
    ("Au potager", "adult-m-round", [["top", "top-tee", ["perle"]], ["bottom", "bottom-overalls", ["bleu_de_travail", "laiton"]], ["shoes", "shoes-clogs", ["noisette", "cuir_sombre"]], ["hat", "hat-cap", ["anthracite"]], ["accessory", "accessory-neckerchief", ["coquelicot"]]]),
    ("Jour de marché", "adult-f-slim", [["top", "top-cardigan", ["bouteille", "caoutchouc_clair"]], ["bottom", "bottom-long-skirt", ["prune"]], ["shoes", "shoes-boots", ["brique", "semelle"]], ["accessory", "accessory-scarf", ["moutarde", "craie"]]]),
]


def slot_of(pid):
    return pid.split("-")[0]


def look(shape, piece, colors):
    skin, head, hc, hair, hairc = PORTEURS[shape]
    slot = slot_of(piece)
    pieces = [["head", head, hc], ["hair", hair, hairc]]
    worn = {slot} | ({"top", "bottom"} if slot == "dress" else set())
    for s in ("top", "bottom", "shoes"):
        if s not in worn:
            pieces.append(FOND[s])
    pieces.append([slot, piece, colors])
    return {"shape": shape, "skin": skin, "pieces": pieces}


def full(shape, pieces):
    skin, head, hc, hair, hairc = PORTEURS[shape]
    return {"shape": shape, "skin": skin, "pieces": [["head", head, hc], ["hair", hair, hairc]] + pieces}


W, H = 280, 400
K = float(os.environ.get("ECHELLE", "1"))  # vues plus grandes pour regarder de près; le montage les ramène


def vues(mode, only):
    out = []
    for pid, ca, a, b, cb in PIECES:
        if only and pid not in only:
            continue
        if mode == "planche":
            for k, (shape, colors) in enumerate(((a, ca), (b, cb))):
                for lacet, sens in ((20, "face"), (200, "dos")):
                    out.append({"nom": f"{pid}--{k}-{sens}", "largeur": round(W * K), "hauteur": round(H * K), "lacet": lacet, "look": look(shape, pid, colors)})
        else:
            lk = look(a, pid, ca)
            lk2 = look(b, pid, cb)
            out += [
                {"nom": f"{pid}--marche", "largeur": round(W * K), "hauteur": round(H * K), "lacet": 90, "clip": "walk", "instant": 0.25, "look": lk},
                {"nom": f"{pid}--marche2", "largeur": round(W * K), "hauteur": round(H * K), "lacet": -60, "clip": "walk", "instant": 0.75, "look": lk2},
                {"nom": f"{pid}--course", "largeur": round(W * K), "hauteur": round(H * K), "lacet": 90, "clip": "run", "instant": 0.3, "look": lk2},
                {"nom": f"{pid}--course2", "largeur": round(W * K), "hauteur": round(H * K), "lacet": 135, "clip": "run", "instant": 0.8, "look": lk},
                {"nom": f"{pid}--assis", "largeur": round(W * K), "hauteur": round(H * K), "lacet": 60, "clip": "sit", "instant": 0.1, "look": lk},
                {"nom": f"{pid}--assis2", "largeur": round(W * K), "hauteur": round(H * K), "lacet": -120, "clip": "sit", "instant": 0.1, "look": lk2},
                {"nom": f"{pid}--couche", "largeur": round(400 * K), "hauteur": round(H * K), "lacet": 90, "couche": True, "look": lk2},
            ]
    if mode == "planche" and not only:
        for k, (nom, shape, pieces) in enumerate(TENUES):
            for j, (lacet, instant) in enumerate(((60, 0.25), (-30, 0.75))):
                out.append({"nom": f"tenue{k}--{j}", "largeur": round(W * K), "hauteur": round(H * K), "lacet": lacet, "clip": "walk", "instant": instant, "look": full(shape, pieces)})
    return out


def monter(mode, folder, target, only):
    with open(CATALOGUE, encoding="utf-8") as fh:
        names = {p["id"]: p for p in json.load(fh)["pieces"]}
    font, bold, small = ImageFont.truetype(FONT, 15), ImageFont.truetype(FONT_BOLD, 16), ImageFont.truetype(FONT, 13)
    views = vues(mode, only)
    groups = {}
    for v in views:
        groups.setdefault(v["nom"].split("--")[0], []).append(v)
    per_row = 2 if mode == "planche" else 1
    label = 46
    blocks = list(groups.items())
    widths = [sum(round(v["largeur"] / K) for v in vs) for _, vs in blocks]
    block_w = max(widths)
    rows = (len(blocks) + per_row - 1) // per_row
    sheet = Image.new("RGB", (block_w * per_row + 16 * (per_row + 1), 60 + rows * (H + label + 12)), "#231a17")
    d = ImageDraw.Draw(sheet)
    title = "Garde-robe d'Aubrune: rendu encré de l'aperçu des personnages" if mode == "planche" else "Contrôle: marche, course, assis, couché"
    d.text((16, 18), title, fill="#efe6d2", font=bold)
    for n, (gid, vs) in enumerate(blocks):
        col, row = n % per_row, n // per_row
        x0, y0 = 16 + col * (block_w + 16), 60 + row * (H + label + 12)
        if gid.startswith("tenue"):
            k = int(gid[5:])
            text, sub = f"Tenue complète en marche: {TENUES[k][0]}", ", ".join(names[p[1]]["name"] for p in TENUES[k][2])
        else:
            p = names[gid]
            gagner = "a-gagner" in p["tags"]
            source = "mercerie" if "mercerie" in p["tags"] else ("à gagner" if gagner else "dès le début")
            text = f"{p['name']} ({gid}), {p['triangles']} triangles, {source}"
            sub = p.get("description", "")
        d.text((x0, y0), text, fill="#efe6d2", font=font)
        d.text((x0, y0 + 20), sub, fill="#b9b7b0", font=small)
        x = x0
        for v in vs:
            img = Image.open(os.path.join(folder, v["nom"] + ".png")).convert("RGB")
            w = round(v["largeur"] / K)
            sheet.paste(img.resize((w, H), Image.LANCZOS), (x, y0 + label))
            x += w
    sheet.save(target, optimize=True)
    print(target, sheet.size)


if __name__ == "__main__":
    cmd, mode = sys.argv[1], sys.argv[2]
    only = set(sys.argv[4].split(",")) if len(sys.argv) > 4 and sys.argv[1] == "vues" else (set(sys.argv[5].split(",")) if len(sys.argv) > 5 else None)
    if cmd == "vues":
        with open(sys.argv[3], "w", encoding="utf-8") as fh:
            json.dump(vues(mode, only), fh, ensure_ascii=False, indent=1)
    else:
        monter(mode, sys.argv[3], sys.argv[4], only)
