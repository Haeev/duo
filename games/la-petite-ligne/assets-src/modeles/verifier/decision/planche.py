"""Planche de décision de l'étape A: quatre états côte à côte, pour chaque définition, zoom et heure.

Usage: python3 planche.py <captures> <sortie> <crops.json>
crops.json: {"1366-z0": [x0, y0, x1, y1, agrandissement], ...} et "gros-1366-z0": idem (trois témoins).
"""
import json
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

SRC = Path(sys.argv[1])
OUT = Path(sys.argv[2])
CROPS = json.loads(Path(sys.argv[3]).read_text())
OUT.mkdir(parents=True, exist_ok=True)

STATES = [
    ('a-012', '1. La 0.12 actuelle', 'anciens modèles, ombrage à facettes'),
    ('b-neuf-facettes', '2. Nouveaux modèles', 'ombrage à facettes'),
    ('c-ancien-lisse', '3. Anciens modèles', 'style lisse (rampe et contour)'),
    ('d-neuf-lisse', '4. Nouveaux modèles', 'style lisse (rampe et contour)'),
]
HOURS = {'jour': 'de jour (15 h)', 'soir': 'soir, à l\'ombre (17 h 45)', 'soleil': 'soir, au soleil (17 h 45)'}
ZOOMS = {'0': 'zoom 0 (le plus proche)', '1': 'zoom 1 (distance de jeu habituelle)'}
FONT = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
BOLD = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
PAPER = (243, 235, 212)
INK = (40, 34, 28)
GAP = 16
LABEL_H = 46


def font(size, bold=False):
    return ImageFont.truetype(BOLD if bold else FONT, size)


def cell(name, box):
    x0, y0, x1, y1, scale = box
    image = Image.open(SRC / f'{name}.png').convert('RGB').crop((x0, y0, x1, y1))
    if scale != 1:
        image = image.resize((round((x1 - x0) * scale), round((y1 - y0) * scale)), Image.NEAREST)
    return image


def board(key, hour, title, note, file, shot=None):
    box = CROPS[key]
    cells = [cell(f'{state}-{shot or key}-{hour}', box) for state, _, _ in STATES]
    w, h = cells[0].size
    header = 96
    width = 2 * w + 3 * GAP
    height = header + 2 * (h + LABEL_H) + 3 * GAP + 30
    sheet = Image.new('RGB', (width, height), PAPER)
    draw = ImageDraw.Draw(sheet)
    draw.text((GAP, 14), title, fill=INK, font=font(24, True))
    draw.text((GAP, 54), note, fill=INK, font=font(17))
    for i, (image, (_, label, sub)) in enumerate(zip(cells, STATES)):
        cx = GAP + (i % 2) * (w + GAP)
        cy = header + GAP + (i // 2) * (h + LABEL_H + GAP)
        draw.text((cx, cy), label, fill=INK, font=font(19, True))
        draw.text((cx + draw.textlength(label, font=font(19, True)) + 10, cy + 2), sub, fill=INK, font=font(17))
        sheet.paste(image, (cx, cy + LABEL_H - 18))
    draw.text(
        (GAP, height - 28),
        'Vrai moteur du jeu (rendu.html), rendu logiciel SwiftShader. Témoins refaits: Colette (2e), joueur 1 (3e), Firmin (4e).'
        ' Les autres ne sont pas encore refaits.',
        fill=INK,
        font=font(14),
    )
    sheet.save(OUT / file, 'WEBP', quality=92, method=6)
    print(file, sheet.size)


for res in ('1366', '1920'):
    for z in ('0', '1'):
        key = f'{res}-z{z}'
        if key not in CROPS:
            continue
        for hour in [h for h in HOURS if (SRC / f'd-neuf-lisse-{key}-{h}.png').exists()]:
            scale = CROPS[key][4]
            zoom_note = 'pixels réels' if scale == 1 else f'agrandi x{scale:g}, sans lissage (chaque pixel du jeu en carré)'
            board(
                key,
                hour,
                f'Personnages témoins, {res} x {"768" if res == "1366" else "1080"}, {ZOOMS[z]}, {HOURS[hour]}',
                f'Extrait de l\'écran autour du groupe, {zoom_note}.',
                f'planche-{res}-zoom{z}-{hour}.webp',
            )
        gkey = f'gros-{key}'
        if gkey in CROPS:
            for hour in [h for h in HOURS if (SRC / f'd-neuf-lisse-{key}-{h}.png').exists()]:
                board(
                    gkey,
                    hour,
                    f'Gros plan des trois témoins, {res}, {ZOOMS[z]}, {HOURS[hour]}',
                    f'Colette, joueur 1, Firmin, agrandis x{CROPS[gkey][4]:g} sans lissage: le détail réellement affiché.',
                    f'gros-plan-{res}-zoom{z}-{hour}.webp',
                    key,
                )
