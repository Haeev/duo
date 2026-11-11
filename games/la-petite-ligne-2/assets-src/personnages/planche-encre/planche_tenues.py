"""Vues et montage des planches des tenues (rendu encré de l'aperçu des personnages).

  python3 planche_tenues.py vues <mode> <vues.json> [id,id]
  python3 planche_tenues.py monter <mode> <dossier des vues> <sortie> [id,id]

Modes:
- `planche`: chaque pièce de la garde-robe portée de face et de dos sur deux silhouettes; pour les pièces
  reprises (REPRISES), une ligne « avant » (images gardées dans `avant/`), une ligne « après » et une ligne
  de gros plans (dos, profil); puis trois tenues complètes en marche. Sortie: un PNG.
- `controle`: chaque pièce en marche, en course, assise et couchée (contrôle rapide, non livré).
- `etude`: l'examen complet d'une pièce avant de la rendre: trois silhouettes (mince, moyenne, forte), six
  poses (debout, marche, deux instants de course, assis, couché), cinq angles (face, trois quarts face,
  profil, trois quarts dos, dos). Sortie: un dossier, une feuille d'ensemble `<id>.png` par pièce; les
  captures en grand restent dans le dossier `VUES_DIR` de planche.sh (`<id>--<silhouette>--<pose>-<angle>.png`).
- `essai`: une pièce debout sur les trois silhouettes, de face, de profil, de trois quarts dos et de dos, en
  grand (réglage d'une forme). Sortie: un dossier, une feuille `<id>.png` par pièce.
- `mariages`: les pièces portées ensemble (MARIAGES: veste sur salopette, gilet sous veste, etc.), de face, de
  profil, de trois quarts dos et en marche: contrôle des couches. Sortie: un dossier, une feuille par mariage.
- `avant`: les vues « avant » des pièces à reprendre, à capturer AVANT de toucher à leur forme, puis à
  copier dans `avant/` (la planche les relit).
"""
import json
import os
import sys

from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
CATALOGUE = os.path.join(HERE, "..", "..", "..", "donnees", "commun", "personnages", "catalogue.json")
AVANT = os.path.join(HERE, "avant")
FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
FONT_BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"

# Pièces montrées, dans l'ordre de la planche: (id, teinte de la pièce, porteur A, porteur B, teinte B).
PIECES = [
    ("bottom-overalls", ["bleu_de_travail", "laiton"], "adult-f-slim", "adult-m-round", ["olive", "acier"]),
    ("accessory-vest", ["bouteille", "laiton"], "adult-m-medium", "adult-f-round", ["chocolat", "cuir_sombre"]),
    ("top-tank", ["craie"], "adult-m-slim", "adult-f-round", ["ciel"]),
    ("top-cardigan", ["moutarde", "cuir_sombre"], "adult-f-slim", "elder-medium", ["bouteille", "caoutchouc_clair"]),
    ("top-work-jacket", ["bleu_de_travail", "acier"], "adult-m-round", "adult-f-medium", ["olive", "laiton"]),
    ("bottom-corduroy", ["noisette"], "adult-m-slim", "adult-f-round", ["bouteille"]),
    ("bottom-long-skirt", ["prune"], "adult-f-medium", "adult-m-round", ["marine"]),
    ("dress-sunday", ["ciel", "craie"], "adult-f-round", "child-medium", ["coquelicot", "craie"]),
    ("shoes-clogs", ["noisette", "cuir_sombre"], "adult-m-medium", "adult-f-slim", ["ocre", "cuir"]),
    ("hat-cap", ["anthracite"], "adult-m-round", "adult-f-medium", ["ficelle"]),
    ("hat-straw", ["ficelle", "coquelicot"], "adult-f-slim", "elder-medium", ["lin", "marine"]),
    ("accessory-scarf", ["coquelicot", "craie"], "adult-f-medium", "adult-m-slim", ["marine", "moutarde"]),
    ("accessory-neckerchief", ["coquelicot"], "adult-m-medium", "adult-f-round", ["bleu_de_travail"]),
    ("accessory-apron", ["lin", "ficelle"], "adult-f-round", "adult-m-slim", ["ciel", "craie"]),
]

# Pièces reprises: ligne « avant », ligne « après », gros plans (centre et hauteur du cadre en mètres).
REPRISES = {
    "bottom-overalls": {"centre": 0.98, "hauteur": 1.05},
    "accessory-vest": {"centre": 1.12, "hauteur": 0.72},
    "top-tank": {"centre": 1.14, "hauteur": 0.72},
}

# Les trois silhouettes de l'examen (mince, moyenne, forte).
ETUDE = ["adult-f-slim", "adult-m-medium", "adult-f-round"]
POSES = [
    ("debout", {}),
    ("marche", {"clip": "walk", "instant": 0.25}),
    ("course", {"clip": "run", "instant": 0.3}),
    ("course 2", {"clip": "run", "instant": 0.8}),
    ("assis", {"clip": "sit", "instant": 0.1}),
    ("couché", {"couche": True}),
]
ANGLES = [("face", 0), ("trois quarts", 40), ("profil", 90), ("trois quarts dos", 140), ("dos", 180)]

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


# Mariages à contrôler (les couches, voir gabarits.toml): nom, silhouette, pièces.
BAS = ["bottom", "bottom-trousers", ["anthracite"]]
SOULIERS = ["shoes", "shoes-pebble", ["cuir_sombre", "semelle"]]
SALOPETTE = ["bottom", "bottom-overalls", ["bleu_de_travail", "laiton"]]
MARIAGES = [
    ("veste-sur-salopette", "adult-m-medium", [["top", "top-work-jacket", ["noisette", "laiton"]], SALOPETTE, SOULIERS]),
    ("veste-sur-gilet", "adult-m-round", [["top", "top-work-jacket", ["anthracite", "acier"]], ["accessory", "accessory-vest", ["bouteille", "laiton", "perle"]], BAS, SOULIERS]),
    ("salopette-sur-gilet-de-laine", "adult-f-slim", [["top", "top-cardigan", ["moutarde", "cuir_sombre"]], SALOPETTE, SOULIERS]),
    ("salopette-sur-pull", "adult-f-round", [["top", "top-sweater", ["craie"]], SALOPETTE, SOULIERS]),
    ("salopette-sur-debardeur", "adult-m-slim", [["top", "top-tank", ["craie"]], SALOPETTE, ["shoes", "shoes-clogs", ["noisette", "cuir_sombre"]]]),
    ("gilet-sur-pull", "adult-f-medium", [["top", "top-sweater", ["craie"]], ["accessory", "accessory-vest", ["chocolat", "laiton", "anthracite"]], BAS, SOULIERS]),
    ("tablier-sur-robe", "adult-f-round", [["dress", "dress-sunday", ["sauge", "craie"]], ["accessory", "accessory-apron", ["lin", "ficelle"]], SOULIERS]),
    ("echarpe-sur-veste", "elder-medium", [["top", "top-work-jacket", ["bleu_de_travail", "acier"]], ["accessory", "accessory-scarf", ["moutarde", "encre"]], ["hat", "hat-cap", ["anthracite"]], ["bottom", "bottom-corduroy", ["chocolat"]], ["shoes", "shoes-clogs", ["ocre", "cuir"]]]),
    ("foulard-sur-gilet-de-laine", "child-medium", [["top", "top-cardigan", ["bouteille", "laiton"]], ["accessory", "accessory-neckerchief", ["coquelicot"]], ["bottom", "bottom-long-skirt", ["marine"]], SOULIERS]),
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


def view(nom, lk, lacet, w=W, **extra):
    return {"nom": nom, "largeur": round(w * K), "hauteur": round(H * K), "lacet": lacet, "look": lk, **extra}


def faces(pid, tag="vue"):
    """Les quatre vues d'une ligne de planche: face et dos sur les deux silhouettes de la pièce."""
    _, ca, a, b, cb = next(p for p in PIECES if p[0] == pid)
    out = []
    for k, (shape, colors) in enumerate(((a, ca), (b, cb))):
        for lacet, sens in ((20, "face"), (200, "dos")):
            out.append(view(f"{pid}--{tag}-{k}-{sens}", look(shape, pid, colors), lacet))
    return out


def vues(mode, only):
    out = []
    if mode == "mariages":
        for nom, shape, pieces in MARIAGES:
            if only and nom not in only:
                continue
            for lacet in (20, 90, 140):
                out.append(view(f"{nom}--{lacet}", full(shape, pieces), lacet))
            out.append(view(f"{nom}--marche", full(shape, pieces), 60, clip="walk", instant=0.25))
        return out
    for pid, ca, a, b, cb in PIECES:
        if only and pid not in only:
            continue
        if mode == "avant":
            if pid in REPRISES:
                out += faces(pid, "avant")
        elif mode == "planche":
            out += faces(pid)
            if pid in REPRISES:
                for k, (shape, colors) in enumerate(((a, ca), (b, cb))):
                    for lacet, sens in ((180, "dos"), (90, "profil")):
                        out.append(view(f"{pid}--gros-{k}-{sens}", look(shape, pid, colors), lacet, cadre=REPRISES[pid]))
        elif mode == "essai":
            for shape in ETUDE:
                for lacet in (20, 90, 140, 200):
                    out.append(view(f"{pid}--essai-{shape}-{lacet}", look(shape, pid, ca), lacet))
        elif mode == "etude":
            for shape in ETUDE:
                lk = look(shape, pid, ca)
                for i, (_, pose) in enumerate(POSES):
                    for j, (_, lacet) in enumerate(ANGLES):
                        out.append(view(f"{pid}--{shape}--{i}-{j}", lk, lacet, **pose))
        else:
            lk = look(a, pid, ca)
            lk2 = look(b, pid, cb)
            out += [
                view(f"{pid}--marche", lk, 90, clip="walk", instant=0.25),
                view(f"{pid}--marche2", lk2, -60, clip="walk", instant=0.75),
                view(f"{pid}--course", lk2, 90, clip="run", instant=0.3),
                view(f"{pid}--course2", lk, 135, clip="run", instant=0.8),
                view(f"{pid}--assis", lk, 60, clip="sit", instant=0.1),
                view(f"{pid}--assis2", lk2, -120, clip="sit", instant=0.1),
                view(f"{pid}--couche", lk2, 90, w=400, couche=True),
            ]
    if mode == "planche" and not only:
        for k, (nom, shape, pieces) in enumerate(TENUES):
            for j, (lacet, instant) in enumerate(((60, 0.25), (-30, 0.75))):
                out.append(view(f"tenue{k}--{j}", full(shape, pieces), lacet, clip="walk", instant=instant))
    return out


def load(folder, v):
    return Image.open(os.path.join(folder, v["nom"] + ".png")).convert("RGB").resize((round(v["largeur"] / K), H), Image.LANCZOS)


def monter_etude(folder, target, only):
    """Une feuille par pièce: les poses en lignes, les trois silhouettes et leurs angles en colonnes. Vue
    d'ensemble seulement: chaque case douteuse se regarde ensuite en grand dans le dossier des captures."""
    os.makedirs(target, exist_ok=True)
    font = ImageFont.truetype(FONT, 13)
    cw, ch = 128, 244  # cases recadrées sur le personnage (sauf couché: il prend toute la largeur)
    for pid, *_ in PIECES:
        if only and pid not in only:
            continue
        sheet = Image.new("RGB", (cw * len(ANGLES) * len(ETUDE), 20 + ch * len(POSES)), "#231a17")
        d = ImageDraw.Draw(sheet)
        for s, shape in enumerate(ETUDE):
            d.text((s * cw * len(ANGLES) + 6, 3), f"{pid} sur {shape}: " + ", ".join(a for a, _ in ANGLES), fill="#efe6d2", font=font)
            for i in range(len(POSES)):
                for j in range(len(ANGLES)):
                    img = Image.open(os.path.join(folder, f"{pid}--{shape}--{i}-{j}.png")).convert("RGB")
                    w, h = img.size
                    if POSES[i][1].get("couche"):
                        img = img.resize((cw, round(cw * h / w)), Image.LANCZOS)
                    else:
                        img = img.crop((round(w * 0.14), round(h * 0.04), round(w * 0.86), h)).resize((cw, ch), Image.LANCZOS)
                    sheet.paste(img, ((s * len(ANGLES) + j) * cw, 20 + i * ch + (ch - img.height) // 2))
        path = os.path.join(target, f"{pid}.png")
        sheet.save(path)
        print(path, sheet.size)


def monter_essai(folder, target, only):
    os.makedirs(target, exist_ok=True)
    for pid, *_ in PIECES:
        if only and pid not in only:
            continue
        cells = []
        for v in vues("essai", {pid}):
            img = Image.open(os.path.join(folder, v["nom"] + ".png")).convert("RGB")
            w, h = img.size
            cells.append(img.crop((round(w * 0.2), round(h * 0.08), round(w * 0.8), round(h * 0.98))))
        w, h = cells[0].size
        sheet = Image.new("RGB", (w * 4, h * 3), "#231a17")
        for i, img in enumerate(cells):
            sheet.paste(img, ((i % 4) * w, (i // 4) * h))
        path = os.path.join(target, f"{pid}.png")
        sheet.save(path)
        print(path, sheet.size)


def monter_mariages(folder, target, only):
    os.makedirs(target, exist_ok=True)
    groups = {}
    for v in vues("mariages", only):
        groups.setdefault(v["nom"].split("--")[0], []).append(v)
    for nom, vs in groups.items():
        cells = []
        for v in vs:
            img = Image.open(os.path.join(folder, v["nom"] + ".png")).convert("RGB")
            w, h = img.size
            cells.append(img.crop((round(w * 0.12), round(h * 0.08), round(w * 0.88), round(h * 0.98))))
        w, h = cells[0].size
        sheet = Image.new("RGB", (w * len(cells), h), "#231a17")
        for i, img in enumerate(cells):
            sheet.paste(img, (i * w, 0))
        path = os.path.join(target, f"{nom}.png")
        sheet.save(path)
        print(path, sheet.size)


def monter(mode, folder, target, only):
    if mode == "mariages":
        return monter_mariages(folder, target, only)
    if mode == "etude":
        return monter_etude(folder, target, only)
    if mode == "essai":
        return monter_essai(folder, target, only)
    if mode == "avant":
        os.makedirs(target, exist_ok=True)
        for v in vues(mode, only):
            load(folder, v).save(os.path.join(target, v["nom"] + ".png"), optimize=True)
        return print(target)
    with open(CATALOGUE, encoding="utf-8") as fh:
        names = {p["id"]: p for p in json.load(fh)["pieces"]}
    font, bold, small = ImageFont.truetype(FONT, 15), ImageFont.truetype(FONT_BOLD, 16), ImageFont.truetype(FONT, 13)
    views = vues(mode, only)
    groups = {}
    for v in views:
        groups.setdefault(v["nom"].split("--")[0], []).append(v)
    per_row = 2 if mode == "planche" else 1
    label, band = 46, 22
    # Chaque bloc: titre, sous-titre, puis des lignes (étiquette, images).
    blocks = []
    for gid, vs in groups.items():
        if gid.startswith("tenue"):
            k = int(gid[5:])
            text, sub = f"Tenue complète en marche: {TENUES[k][0]}", ", ".join(names[p[1]]["name"] for p in TENUES[k][2])
            lines = [(None, [load(folder, v) for v in vs])]
        else:
            p = names[gid]
            gagner = "a-gagner" in p["tags"]
            source = "mercerie" if "mercerie" in p["tags"] else ("à gagner" if gagner else "dès le début")
            text = f"{p['name']} ({gid}), {p['triangles']} triangles, {source}"
            sub = p.get("description", "")
            if mode == "planche" and gid in REPRISES:
                shown = [v for v in vs if "--vue-" in v["nom"]]
                close = [v for v in vs if "--gros-" in v["nom"]]
                before = [Image.open(os.path.join(AVANT, v["nom"].replace("--vue-", "--avant-") + ".png")).convert("RGB") for v in shown]
                lines = [("Avant la reprise", before), ("Après la reprise", [load(folder, v) for v in shown]),
                         ("Après, de près: dos et profil sur les deux silhouettes", [load(folder, v) for v in close])]
            else:
                lines = [(None, [load(folder, v) for v in vs])]
        blocks.append((text, sub, lines))
    block_w = max(sum(img.width for img in line) for _, _, lines in blocks for _, line in lines)

    def height(lines):
        return label + sum(H + (band if title else 0) for title, _ in lines) + 12
    # Les blocs à plusieurs lignes prennent toute la largeur d'une colonne, rangés deux par deux comme les autres.
    rows, x_slots = [], per_row
    for n in range(0, len(blocks), per_row):
        rows.append(blocks[n:n + per_row])
    total = 60 + sum(max(height(lines) for _, _, lines in row) for row in rows)
    sheet = Image.new("RGB", (block_w * x_slots + 16 * (x_slots + 1), total), "#231a17")
    d = ImageDraw.Draw(sheet)
    title = "Garde-robe d'Aubrune: rendu encré de l'aperçu des personnages" if mode == "planche" else "Contrôle: marche, course, assis, couché"
    d.text((16, 18), title, fill="#efe6d2", font=bold)
    y0 = 60
    for row in rows:
        for col, (text, sub, lines) in enumerate(row):
            x0 = 16 + col * (block_w + 16)
            d.text((x0, y0), text, fill="#efe6d2", font=font)
            d.text((x0, y0 + 20), sub, fill="#b9b7b0", font=small)
            y = y0 + label
            for line_title, images in lines:
                if line_title:
                    d.text((x0, y + 3), line_title, fill="#e3b04b", font=small)
                    y += band
                x = x0
                for img in images:
                    sheet.paste(img, (x, y))
                    x += img.width
                y += H
        y0 += max(height(lines) for _, _, lines in row)
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
