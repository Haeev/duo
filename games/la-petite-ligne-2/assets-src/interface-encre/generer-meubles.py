"""Écrit les sources des vignettes de meubles (`vignettes/<id>.svg`), toutes dans la même
projection de trois quarts: dessus clair, face avant au ton de base, côté droit dans l'ombre
(lumière en haut à gauche). Ces sources sont générées: modifier ce script, pas les SVG.

    python3 assets-src/interface-encre/generer-meubles.py [id,id,...]
    NODE_PATH=/opt/node-tools/node_modules node assets-src/interface-encre/generer-images.mjs vignettes <id,id>

Ajouter un meuble: une fonction de dessin (copier la plus proche, `box()` pour les caisses) et une
ligne dans `ALL` (identifiant du meuble, description, fonction). Variante de couleur: passer un
autre trio de tons (`MIEL`, `SAUGE`...).
"""
import math
import os
import sys

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'vignettes') + os.sep
HEAD = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" data-trait="5.2" data-pas="0.6" data-tremble="0.35" data-halo="3.6">'

BOIS = ('#D7A86A', '#A87A46', '#6E4B30')
CHENE = ('#A87A46', '#8C5A35', '#4F3626')
NOYER = ('#96704C', '#5E4233', '#4F3626')
MIEL = ('#F2C55C', '#D4A33E', '#8E6A26')
SAUGE = ('#D2DCD8', '#96A98C', '#727B6E')
FER = ('#8C8E91', '#4A4D52', '#26282E')
FONTE = ('#5E8A72', '#3F6453', '#25392F')
BRIQUE = ('#C67A5E', '#A35A44', '#6C3A2E')
LIN = ('#F3EDE0', '#D9CAAE', '#B8A17E')
CIEL = ('#A9C7D9', '#587F8E', '#2C3B57')
LAITON = '#C8A150'
DX, DY = 12, -9  # profondeur: vers le haut à droite (lumière en haut à gauche)


def P(pts):
    return 'M' + ' L'.join(f'{x:g} {y:g}' for x, y in pts) + ' Z'


def box(x, y, w, h, c, uid, d=(DX, DY), grain=None, w_ink=None):
    """Pavé: dessus clair, face avant de base, côté droit dans l'ombre. Renvoie le SVG."""
    dx, dy = d
    a = f' data-w="{w_ink}"' if w_ink else ''
    top = P([(x, y), (x + w, y), (x + w + dx, y + dy), (x + dx, y + dy)])
    side = P([(x + w, y), (x + w + dx, y + dy), (x + w + dx, y + h + dy), (x + w, y + h)])
    front = P([(x, y), (x + w, y), (x + w, y + h), (x, y + h)])
    s = f'<path d="{side}" fill="{c[2]}"{a}/>'
    if dy != 0:
        s += f'<path d="{top}" fill="{c[0]}"{a}/>'
    s += f'<path id="{uid}" d="{front}" fill="{c[1]}"{a}/>'
    if grain:
        s += f'<g data-clip="{uid}" data-teinte="{c[2]}" data-w="0.28" fill="none" stroke="#000"><path d="{grain}"/></g>'
    return s


def hatch(x, y, n=3, step=5, L=5):
    return '<g data-w="0.35" fill="none" stroke="#000"><path d="' + ' '.join(
        f'M{x + i * step:g} {y:g} l{L:g} -{L:g}' for i in range(n)) + '"/></g>'


def knob(x, y, r=2):
    return f'<circle cx="{x:g}" cy="{y:g}" r="{r:g}" fill="{LAITON}" data-w="0.45"/>'


def shade_clip(uid, d, col):
    return f'<path data-clip="{uid}" data-w="0" d="{d}" fill="{col}"/>'


def write(name, comment, body, rot=0):
    g = f'<g transform="rotate({rot} 48 52)">' if rot else '<g>'
    open(OUT + name + '.svg', 'w').write(f'{HEAD}\n  <!-- {comment} -->\n  {g}\n    ' + body.replace('><', '>\n    <') + '\n  </g>\n</svg>\n')


# ---------------------------------------------------------------- séries miel et sauge
def tabouret(c):
    s = ''
    # pieds écartés (arrière d'abord)
    s += f'<path d="M58 38 L64 38 L68 80 L62 80 Z" fill="{c[2]}"/>'
    s += f'<path d="M24 44 L31 44 L24 86 L17 86 Z" fill="{c[1]}"/>'
    s += f'<path d="M64 44 L71 44 L78 86 L71 86 Z" fill="{c[1]}"/>'
    s += f'<path d="M44 48 L51 48 L50 92 L43 92 Z" fill="{c[1]}"/>'
    s += f'<path data-w="0" d="M48 48 L51 48 L50 92 L47 92 Z" fill="{c[2]}"/>'
    s += f'<path d="M22 70 L74 70 L74 75 L22 75 Z" fill="{c[2]}" data-w="0.6"/>'
    s += f'<path id="assise" d="M14 34 Q14 22 48 20 Q82 22 82 34 L82 42 Q82 52 48 54 Q14 52 14 42 Z" fill="{c[1]}"/>'
    s += shade_clip('assise', 'M50 30 Q80 30 84 44 L84 60 L40 60 Q66 50 50 30 Z', c[2])
    s += f'<ellipse cx="48" cy="33" rx="34" ry="12" fill="{c[0]}"/>'
    s += f'<g data-teinte="{c[1]}" data-w="0.3" fill="none" stroke="#000"><path d="M26 32 Q40 26 56 28 M34 38 Q50 36 66 34"/></g>'
    s += f'<path data-w="0" d="M20 30 Q26 24 38 23 Q28 28 24 34 Z" fill="#F7F3EA"/>'
    return s


def chevet(c):
    s = box(22, 30, 40, 50, c, 'meuble', grain='M28 64 Q34 60 40 64 M46 70 Q52 66 58 70')
    s += f'<path d="M24 82 L30 82 L30 90 L24 90 Z" fill="{c[2]}" data-w="0.5"/><path d="M56 82 L62 82 L62 90 L56 90 Z" fill="{c[2]}" data-w="0.5"/>'
    s += f'<path d="M27 35 L57 35 L57 48 L27 48 Z" fill="{c[0]}" data-w="0.5"/>' + knob(42, 41.5)
    s += f'<path d="M27 53 L57 53 L57 76 L27 76 Z" fill="#231A17" data-w="0.5"/>'
    s += f'<path data-w="0" d="M27 53 L57 53 L57 57 L31 57 L31 76 L27 76 Z" fill="{c[2]}"/>'
    # bougeoir posé dessus
    s += f'<ellipse cx="46" cy="24" rx="7" ry="2.6" fill="{LAITON}" data-w="0.5"/>'
    s += '<path d="M43 23 L49 23 L49 10 L43 10 Z" fill="#F3EDE0" data-w="0.5"/>'
    s += '<path d="M46 9 Q42 4 46 0 Q50 4 46 9 Z" fill="#FFC264" data-w="0.4"/>'
    s += hatch(64, 72, 2, 5, 4)
    return s


def etagere(c):
    s = f'<path d="M20 16 L28 16 L28 90 L20 90 Z" fill="{c[1]}"/>'
    s += f'<path d="M66 16 L74 16 L74 90 L66 90 Z" fill="{c[1]}"/>'
    s += f'<path d="M74 16 L82 10 L82 84 L74 90 Z" fill="{c[2]}"/>'
    s += f'<path d="M28 18 L66 18 L66 88 L28 88 Z" fill="#231A17" data-w="0"/>'
    # objets sur les planches
    s += '<path d="M31 26 L36 26 L36 40 L31 40 Z" fill="#C5443D" data-w="0.45"/><path d="M36 28 L41 28 L41 40 L36 40 Z" fill="#2F6E73" data-w="0.45"/><path d="M41 25 L45 25 L45 40 L41 40 Z" fill="#D4A33E" data-w="0.45"/>'
    s += '<path d="M52 28 Q52 24 58 24 Q64 24 64 28 L64 40 L52 40 Z" fill="#F3EDE0" data-w="0.5"/><path d="M52 27 L64 27 L64 30 L52 30 Z" fill="#C5443D" data-w="0.35"/>'
    s += '<path d="M32 54 Q30 64 40 64 Q50 64 48 54 Z" fill="#A35A44" data-w="0.5"/><path d="M36 54 Q34 44 40 44 Q46 44 44 54 Z" fill="#6E9241" data-w="0.5"/>'
    s += '<path d="M54 50 L62 50 L62 64 L54 64 Z" fill="#8C99A3" data-w="0.45"/>'
    s += '<path d="M31 80 L60 80 L60 74 L31 74 Z" fill="#D9CAAE" data-w="0.45"/><path d="M33 74 L58 74 L58 70 L33 70 Z" fill="#F3EDE0" data-w="0.4"/>'
    for yy in (40, 64, 84):
        s += f'<path d="M24 {yy} L70 {yy} L78 {yy - 6} L32 {yy - 6} Z" fill="{c[0]}" data-w="0.6"/>'
        s += f'<path d="M24 {yy} L70 {yy} L70 {yy + 4} L24 {yy + 4} Z" fill="{c[1]}" data-w="0.6"/>'
    s += f'<path d="M20 16 L28 16 L36 10 L28 10 Z" fill="{c[0]}" data-w="0.6"/><path d="M66 16 L74 16 L82 10 L74 10 Z" fill="{c[0]}" data-w="0.6"/>'
    return s


def coffre_linge(c):
    s = box(12, 42, 60, 40, c, 'caisse', grain='M18 70 Q30 66 40 70 M50 76 Q60 72 68 76')
    s += f'<path d="M14 82 L20 82 L20 88 L14 88 Z" fill="{c[2]}" data-w="0.5"/><path d="M64 82 L70 82 L70 88 L64 88 Z" fill="{c[2]}" data-w="0.5"/>'
    # linge plié qui dépasse sous le couvercle
    s += '<path d="M20 40 Q30 46 42 40 L42 46 Q30 52 20 46 Z" fill="#F3EDE0" data-w="0.5"/>'
    s += '<path d="M40 40 Q50 46 58 40 L58 45 Q50 50 40 45 Z" fill="#CC9C96" data-w="0.5"/>'
    # couvercle entrouvert
    s += f'<path d="M10 40 L74 40 L88 30 L24 30 Z" fill="{c[0]}"/><path d="M10 40 L74 40 L74 44 L10 44 Z" fill="{c[1]}" data-w="0.6"/>'
    # fleur peinte
    s += '<g data-w="0.4" fill="#F3EDE0"><circle cx="42" cy="56" r="3.2"/><circle cx="48" cy="60" r="3.2"/><circle cx="42" cy="66" r="3.2"/><circle cx="36" cy="60" r="3.2"/></g><circle cx="42" cy="61" r="2.4" fill="#C5443D" data-w="0.4"/>'
    s += '<path d="M28 74 Q34 70 38 66" fill="none" stroke="#000" data-w="0.45"/>' + knob(62, 56, 2.2)
    return s


# ---------------------------------------------------------------- meubles du logement
def armoire():
    c = BOIS
    s = box(18, 18, 48, 70, c, 'caisse', grain='M24 30 Q28 46 24 60 M58 34 Q62 50 58 66')
    s += f'<path d="M14 12 L70 12 L84 3 L28 3 Z" fill="{c[0]}"/><path d="M14 12 L70 12 L70 19 L14 19 Z" fill="{c[1]}" data-w="0.7"/><path d="M70 12 L84 3 L84 10 L70 19 Z" fill="{c[2]}" data-w="0.7"/>'
    s += '<g data-w="0.5" fill="none" stroke="#000"><path d="M42 20 L42 86"/></g>'
    s += f'<path d="M23 26 L38 26 L38 52 L23 52 Z" fill="{c[0]}" data-w="0.4"/><path d="M46 26 L61 26 L61 52 L46 52 Z" fill="{c[0]}" data-w="0.4"/>'
    s += f'<path d="M23 58 L38 58 L38 82 L23 82 Z" fill="none" stroke="#000" data-w="0.35"/><path d="M46 58 L61 58 L61 82 L46 82 Z" fill="none" stroke="#000" data-w="0.35"/>'
    s += knob(39.5, 55) + knob(44.5, 55)
    s += f'<path d="M20 88 L26 88 L26 93 L20 93 Z" fill="{c[2]}" data-w="0.5"/><path d="M58 88 L64 88 L64 93 L58 93 Z" fill="{c[2]}" data-w="0.5"/>'
    s += hatch(68, 80, 2, 5, 4)
    return s


def banc():
    f, c = FONTE, BOIS
    s = ''
    # dossier: lattes
    for i, yy in enumerate((22, 31)):
        s += f'<path d="M14 {yy} L76 {yy - 6} L77 {yy + 1} L15 {yy + 7} Z" fill="{c[1]}"/>'
        s += f'<g data-teinte="{c[2]}" data-w="0.28" fill="none" stroke="#000"><path d="M22 {yy + 3} Q40 {yy} 60 {yy - 1}"/></g>'
    # assise
    s += f'<path d="M8 56 L70 50 L86 56 L24 63 Z" fill="{c[0]}"/>'
    s += f'<path id="assise" d="M8 56 L24 63 L24 69 L8 62 Z" fill="{c[2]}"/><path d="M24 63 L86 56 L86 62 L24 69 Z" fill="{c[1]}"/>'
    s += f'<g data-teinte="{c[1]}" data-w="0.3" fill="none" stroke="#000"><path d="M16 58 L76 52 M20 61 L82 55"/></g>'
    # pieds et accoudoirs de fonte: montant du dossier, pied avant, accoudoir
    for x0, x1 in ((16, 20), (70, 80)):
        s += f'<path d="M{x0} 18 L{x0 + 5} 17 L{x0 + 6} 60 L{x0 + 1} 61 Z" fill="{f[1]}" data-w="0.8"/>'
        s += f'<path d="M{x1} 60 L{x1 + 5} 59 L{x1 + 3} 84 L{x1 + 7} 88 L{x1 - 3} 88 L{x1 - 1} 84 Z" fill="{f[1]}" data-w="0.8"/>'
        s += f'<path d="M{x0 - 2} 42 Q{x0 + 8} 38 {x1 + 6} 50 L{x1 + 3} 53 Q{x0 + 8} 44 {x0 - 1} 46 Z" fill="{f[0]}" data-w="0.7"/>'
    return s


def chaise(c=BOIS, paille=False):
    s = ''
    # montants du dossier
    s += f'<path d="M24 6 L30 6 L32 56 L26 56 Z" fill="{c[1]}"/><path d="M58 4 L64 4 L64 52 L58 52 Z" fill="{c[2]}"/>'
    if paille:
        for yy in (12, 22, 32):
            s += f'<path d="M28 {yy} L62 {yy - 2} L62 {yy + 4} L28 {yy + 6} Z" fill="{c[1]}" data-w="0.6"/>'
    else:
        s += f'<path d="M26 8 Q44 2 62 6 L62 18 Q44 14 27 20 Z" fill="{c[1]}" data-w="0.8"/>'
        s += f'<g data-teinte="{c[2]}" data-w="0.28" fill="none" stroke="#000"><path d="M32 12 Q44 9 56 10"/></g>'
        s += f'<path d="M40 20 L46 19 L46 50 L40 51 Z" fill="{c[1]}" data-w="0.6"/>'
    # pieds
    s += f'<path d="M60 54 L65 54 L66 82 L61 82 Z" fill="{c[2]}"/>'
    s += f'<path d="M18 60 L24 60 L23 92 L17 92 Z" fill="{c[1]}"/><path d="M54 62 L60 62 L61 92 L55 92 Z" fill="{c[1]}"/>'
    s += f'<path data-w="0" d="M57 62 L60 62 L61 92 L58 92 Z" fill="{c[2]}"/>'
    s += f'<path d="M20 78 L58 78 L58 82 L20 82 Z" fill="{c[2]}" data-w="0.5"/>'
    # assise
    seat = '#E2C582' if paille else c[0]
    s += f'<path id="assise" d="M14 56 L60 56 L74 46 L30 46 Z" fill="{seat}"/>'
    if paille:
        s += '<g data-clip="assise" data-teinte="#C99A55" data-w="0.32" fill="none" stroke="#000"><path d="M16 56 L58 46 M22 56 L66 46 M30 56 L72 47 M40 56 L74 49 M14 52 L50 56 M20 49 L60 55 M26 47 L66 53 M36 46 L72 49"/></g>'
    else:
        s += f'<g data-clip="assise" data-teinte="{c[1]}" data-w="0.3" fill="none" stroke="#000"><path d="M22 53 L64 52 M28 50 L70 49"/></g>'
    s += f'<path d="M14 56 L60 56 L60 62 L14 62 Z" fill="{c[1]}" data-w="0.7"/><path d="M60 56 L74 46 L74 52 L60 62 Z" fill="{c[2]}" data-w="0.7"/>'
    return s


def coffre():
    c, f = BOIS, FER
    s = box(12, 46, 58, 38, c, 'caisse', grain='M18 62 Q30 58 42 62 M46 74 Q56 70 66 74')
    s += f'<path id="couv" d="M12 46 Q12 26 40 26 Q70 26 70 46 Z" fill="{c[1]}"/>'
    s += f'<path d="M70 46 Q70 26 40 26 L52 17 Q82 17 82 37 Z" fill="{c[0]}"/>'
    s += f'<path d="M70 46 L82 37 L82 75 L70 84 Z" fill="{c[2]}"/>'
    s += shade_clip('couv', 'M50 20 Q74 30 66 50 L80 50 L80 20 Z', c[2])
    s += f'<g data-teinte="{c[2]}" data-w="0.28" fill="none" stroke="#000"><path d="M18 40 Q30 32 44 31"/></g>'
    for xx in (22, 56):
        s += f'<path d="M{xx} 28 Q{xx - 1} 36 {xx} 46 L{xx} 84 L{xx + 6} 84 L{xx + 6} 46 Q{xx + 5} 34 {xx + 6} 27 Z" fill="{f[0]}" data-w="0.6"/>'
        s += f'<g data-w="0" fill="{f[2]}"><circle cx="{xx + 3}" cy="56" r="1"/><circle cx="{xx + 3}" cy="72" r="1"/></g>'
    s += f'<path d="M35 44 L47 44 L47 58 L35 58 Z" fill="{LAITON}" data-w="0.6"/><path d="M40 49 L42 49 L42 54 L40 54 Z" fill="#231A17" data-w="0"/>'
    s += hatch(72, 76, 2, 4, 4)
    return s


def coffre_chene():
    c = CHENE
    s = box(10, 42, 62, 42, c, 'caisse', grain='M16 78 Q30 74 44 78')
    s += f'<path d="M8 42 L74 42 L88 32 L22 32 Z" fill="{c[0]}"/><path d="M8 42 L74 42 L74 48 L8 48 Z" fill="{c[1]}" data-w="0.7"/><path d="M74 42 L88 32 L88 38 L74 48 Z" fill="{c[2]}" data-w="0.7"/>'
    s += f'<g data-teinte="{c[2]}" data-w="0.28" fill="none" stroke="#000"><path d="M24 39 Q40 36 60 37"/></g>'
    for x0 in (15, 47):
        s += f'<path d="M{x0} 54 L{x0 + 20} 54 L{x0 + 20} 78 L{x0} 78 Z" fill="{c[2]}" data-w="0.45"/>'
        s += f'<path d="M{x0 + 3} 57 L{x0 + 17} 57 L{x0 + 17} 75 L{x0 + 3} 75 Z" fill="{c[1]}" data-w="0.35"/>'
        s += f'<path d="M{x0 + 10} 60 Q{x0 + 15} 66 {x0 + 10} 72 Q{x0 + 5} 66 {x0 + 10} 60 Z" fill="{c[0]}" data-w="0.3"/>'
    s += f'<path d="M38 47 L44 47 L44 58 L38 58 Z" fill="{LAITON}" data-w="0.5"/>'
    s += ''.join(f'<path d="M{x} {y} l5 0 l0 5 Z" fill="{LAITON}" data-w="0.35"/>' for x, y in ((10, 79), (67, 79)))
    s += hatch(74, 74, 2, 4, 4)
    return s


def table_manger():
    c = BOIS
    s = ''
    s += f'<path d="M64 52 L69 52 L70 82 L65 82 Z" fill="{c[2]}"/>'
    s += f'<path d="M14 58 L20 58 L19 92 L13 92 Z" fill="{c[1]}"/><path d="M60 60 L66 60 L67 92 L61 92 Z" fill="{c[1]}"/>'
    # nappe à carreaux qui tombe
    s += '<path id="nappe" d="M6 46 L64 46 L82 32 L24 32 Z" fill="#F3EDE0"/>'
    s += '<path id="pan" d="M6 46 L64 46 L64 66 Q48 70 34 64 Q20 70 8 64 Z" fill="#F3EDE0"/>'
    s += '<path d="M64 46 L82 32 L82 50 Q74 58 64 66 Z" fill="#D9CAAE"/>'
    s += '<g data-clip="pan" data-w="0" fill="#C5443D"><path d="M6 46 L16 46 L16 72 L6 72 Z"/><path d="M26 46 L36 46 L36 72 L26 72 Z"/><path d="M46 46 L56 46 L56 72 L46 72 Z"/><path d="M0 54 L70 54 L70 59 L0 59 Z" fill-opacity="0.6"/></g>'
    s += '<g data-clip="nappe" data-w="0" fill="#E58E84"><path d="M12 46 L22 46 L38 32 L28 32 Z"/><path d="M32 46 L42 46 L58 32 L48 32 Z"/><path d="M52 46 L62 46 L78 32 L68 32 Z"/></g>'
    # bol et pichet
    s += '<path d="M28 38 Q30 46 38 46 Q46 46 48 38 Z" fill="#44618A" data-w="0.5"/><ellipse cx="38" cy="38" rx="10" ry="3" fill="#A9C7D9" data-w="0.45"/>'
    s += '<path d="M56 22 L66 22 Q70 30 68 40 L56 40 Q54 30 56 22 Z" fill="#F3EDE0" data-w="0.55"/><path d="M68 26 Q74 28 70 34" fill="none" stroke="#000" data-w="0.5"/>'
    s += hatch(66, 82, 2, 5, 4)
    return s


def table_ferme():
    c = CHENE
    s = ''
    s += f'<path d="M70 48 L76 48 L77 80 L71 80 Z" fill="{c[2]}"/>'
    for x0 in (10, 62):
        s += f'<path d="M{x0} 56 L{x0 + 8} 56 L{x0 + 7} 66 Q{x0 + 9} 72 {x0 + 7} 78 L{x0 + 7} 92 L{x0 + 1} 92 L{x0 + 1} 78 Q{x0 - 1} 72 {x0 + 1} 66 Z" fill="{c[1]}"/>'
    s += f'<path d="M14 74 L66 74 L66 79 L14 79 Z" fill="{c[2]}" data-w="0.6"/>'
    s += box(4, 46, 70, 10, c, 'plateau', d=(14, -12))
    s += f'<g data-teinte="{c[2]}" data-w="0.3" fill="none" stroke="#000"><path d="M10 42 L76 42 M14 38 L80 38 M20 46 L32 46"/></g>'
    s += f'<g data-teinte="{c[0]}" data-w="0.28" fill="none" stroke="#000"><path d="M22 44 Q36 41 50 42"/></g>'
    s += f'<g data-clip="plateau" data-teinte="{c[2]}" data-w="0.3" fill="none" stroke="#000"><path d="M10 51 Q30 49 50 52 Q60 53 70 50"/></g>'
    s += hatch(68, 88, 2, 5, 4)
    return s


# ---------------------------------------------------------------- lot B
def baquet():
    c, f = CHENE, FER
    s = '<path d="M6 40 Q4 34 10 34 L14 40 Z" fill="#8C5A35" data-w="0.6"/><path d="M84 36 Q90 32 90 38 L84 42 Z" fill="#8C5A35" data-w="0.6"/>'
    s += f'<path id="cuve" d="M10 40 Q48 32 86 40 L78 82 Q48 92 18 82 Z" fill="{c[1]}"/>'
    s += shade_clip('cuve', 'M60 30 Q74 80 20 92 L96 96 L96 30 Z', c[2])
    s += shade_clip('cuve', 'M14 44 L22 44 L26 80 L20 78 Z', c[0])
    s += f'<g data-clip="cuve" data-w="0.4" fill="none" stroke="#000"><path d="M30 42 L32 88 M48 40 L48 90 M66 42 L64 88"/></g>'
    for yy in (52, 72):
        s += f'<path d="M10 {yy} Q48 {yy + 10} 86 {yy} L85 {yy + 5} Q48 {yy + 15} 11 {yy + 5} Z" fill="{f[0]}" data-w="0.5"/>'
    s += f'<ellipse cx="48" cy="40" rx="38" ry="9" fill="{c[0]}" data-w="0.7"/>'
    s += '<ellipse id="eau" cx="48" cy="41" rx="32" ry="6.5" fill="#6EA9AD" data-w="0.4"/>'
    s += shade_clip('eau', 'M30 30 L90 30 L90 50 L40 50 Q66 44 30 30 Z', '#43737A')
    s += '<g data-teinte="#9FD0CF" data-w="0.35" fill="none" stroke="#000"><path d="M26 40 Q34 38 42 39 M50 43 Q56 42 62 43"/></g>'
    s += hatch(64, 82, 2, 5, 4)
    return s


def buffet():
    c = NOYER
    s = box(6, 36, 70, 48, c, 'caisse', grain='M12 74 Q24 70 34 74 M48 76 Q58 72 70 76')
    s += f'<path d="M4 36 L78 36 L92 26 L18 26 Z" fill="{c[0]}"/><path d="M4 36 L78 36 L78 41 L4 41 Z" fill="{c[1]}" data-w="0.7"/><path d="M78 36 L92 26 L92 31 L78 41 Z" fill="{c[2]}" data-w="0.7"/>'
    s += f'<path d="M10 44 L39 44 L39 53 L10 53 Z" fill="{c[0]}" data-w="0.45"/><path d="M43 44 L72 44 L72 53 L43 53 Z" fill="{c[0]}" data-w="0.45"/>'
    s += f'<path d="M10 57 L39 57 L39 80 L10 80 Z" fill="none" stroke="#000" data-w="0.4"/><path d="M43 57 L72 57 L72 80 L43 80 Z" fill="none" stroke="#000" data-w="0.4"/>'
    s += knob(24.5, 48.5, 1.8) + knob(57.5, 48.5, 1.8) + knob(36, 68, 1.8) + knob(46, 68, 1.8)
    s += f'<path d="M8 84 L14 84 L14 90 L8 90 Z" fill="{c[2]}" data-w="0.5"/><path d="M68 84 L74 84 L74 90 L68 90 Z" fill="{c[2]}" data-w="0.5"/>'
    s += '<path d="M28 30 Q30 20 38 20 Q46 20 48 30 Z" fill="#F3EDE0" data-w="0.5"/><path d="M30 24 Q38 20 46 24" fill="none" stroke="#000" data-w="0.3"/>'
    s += '<path d="M56 30 L56 14 Q62 10 68 14 L68 30 Z" fill="#A9C7D9" data-w="0.5"/><path d="M58 16 L60 16 L60 28 L58 28 Z" fill="#F7F3EA" data-w="0"/>'
    return s


def cadre():
    s = '<path d="M30 10 L48 2 L66 10" fill="none" stroke="#000" data-w="0.5"/>'
    s += f'<path id="cadre" d="M10 12 L84 10 L86 84 L12 86 Z M20 22 L74 20 L76 74 L22 76 Z" fill-rule="evenodd" fill="{LAITON}"/>'
    s += shade_clip('cadre', 'M60 4 L96 4 L96 96 L4 96 L4 80 Q70 80 60 4 Z', '#8E6A26')
    s += '<g data-teinte="#F2C55C" data-w="0.35" fill="none" stroke="#000"><path d="M14 16 L80 14 M14 18 L16 80"/></g>'
    # tableau: quai de gare au crépuscule, rails et lanterne
    s += '<path id="toile" d="M20 22 L74 20 L76 74 L22 76 Z" fill="#F2A66E" data-w="0.4"/>'
    s += shade_clip('toile', 'M18 18 L78 18 L78 40 L18 42 Z', '#FFD9A0')
    s += shade_clip('toile', 'M18 54 L78 52 L78 78 L18 78 Z', '#6A4C6E')
    s += '<path data-clip="toile" data-w="0" d="M18 44 L40 40 L40 30 L48 26 L56 30 L56 42 L78 46 L78 54 L18 56 Z" fill="#45324F"/>'
    s += '<g data-clip="toile" data-teinte="#FFD9A0" data-w="0.4" fill="none" stroke="#000"><path d="M24 76 L44 56 M70 76 L52 56 M30 70 L64 70 M38 62 L58 62"/></g>'
    s += '<circle cx="62" cy="34" r="3" fill="#FFC46B" data-w="0.3"/>'
    s += '<circle cx="48" cy="12" r="2.2" fill="#8E6A26" data-w="0.4"/>'
    return s


def cuisiniere():
    f = FER
    s = '<path d="M66 4 L74 4 L74 30 L66 30 Z" fill="#4A4D52"/><path data-w="0" d="M70 4 L74 4 L74 30 L70 30 Z" fill="#26282E"/>'
    s += box(8, 38, 64, 48, f, 'caisse', d=(14, -10))
    s += f'<path d="M6 38 L72 38 L72 42 L6 42 Z" fill="{LAITON}" data-w="0.5"/>'
    s += '<ellipse cx="28" cy="33" rx="10" ry="3.4" fill="#26282E" data-w="0.5"/><ellipse cx="56" cy="33" rx="9" ry="3" fill="#26282E" data-w="0.5"/>'
    s += '<ellipse cx="28" cy="33" rx="5" ry="1.6" fill="none" stroke="#000" data-w="0.35"/>'
    # bouilloire sur le feu
    s += '<path d="M48 32 Q46 18 56 16 Q66 18 64 32 Z" fill="#A85837" data-w="0.6"/><path d="M64 26 L72 20 L73 23 L65 29 Z" fill="#A85837" data-w="0.5"/><path d="M50 18 Q56 10 62 18" fill="none" stroke="#000" data-w="0.5"/>'
    s += '<path data-w="0" d="M50 28 Q50 20 54 18 L54 30 Z" fill="#D98C62"/>'
    # porte du four, foyer rougeoyant
    s += f'<path d="M14 48 L42 48 L42 76 L14 76 Z" fill="{f[0]}" data-w="0.5"/><path d="M16 50 L40 50 L40 54 L16 54 Z" fill="#B9B7B0" data-w="0"/>'
    s += f'<path d="M18 58 L38 58 L38 62 L18 62 Z" fill="{LAITON}" data-w="0.45"/>'
    s += '<path d="M48 54 L66 54 L66 66 L48 66 Z" fill="#26282E" data-w="0.5"/><path d="M50 56 L64 56 L64 64 L50 64 Z" fill="#D9822E" data-w="0"/><path d="M52 58 L62 58 L62 63 L52 63 Z" fill="#FFC264" data-w="0"/>'
    s += '<g data-w="0.35" fill="none" stroke="#000"><path d="M50 60 L64 60 M54 56 L54 64 M58 56 L58 64"/></g>'
    s += f'<path d="M10 86 L16 86 L16 92 L10 92 Z" fill="{f[2]}" data-w="0.5"/><path d="M64 86 L70 86 L70 92 L64 92 Z" fill="{f[2]}" data-w="0.5"/>'
    return s


def etabli():
    c = BOIS
    s = f'<path d="M66 46 L72 46 L72 80 L66 80 Z" fill="{c[2]}"/>'
    for x0 in (10, 58):
        s += f'<path d="M{x0} 54 L{x0 + 8} 54 L{x0 + 8} 92 L{x0} 92 Z" fill="{c[1]}"/>'
    s += f'<path d="M12 76 L64 76 L64 82 L12 82 Z" fill="{c[2]}" data-w="0.6"/>'
    s += box(4, 44, 70, 12, c, 'plateau', d=(14, -12), grain='M8 50 Q30 48 50 51')
    s += f'<g data-teinte="{c[2]}" data-w="0.3" fill="none" stroke="#000"><path d="M10 40 L76 40 M16 36 L82 36"/></g>'
    # étau de bois en façade
    s += f'<path d="M2 50 L12 50 L12 66 L2 66 Z" fill="{c[0]}" data-w="0.6"/><path d="M0 58 L14 57" fill="none" stroke="#000" data-w="0.7"/><circle cx="7" cy="58" r="2.2" fill="#8C8E91" data-w="0.4"/>'
    # rabot et copeaux
    s += '<path d="M30 34 L54 30 L56 36 L32 40 Z" fill="#8C5A35" data-w="0.6"/><path d="M38 31 Q40 24 46 26 L48 31 Z" fill="#8C8E91" data-w="0.5"/>'
    s += '<g data-teinte="#F5E6C6" data-w="0.45" fill="none" stroke="#000"><path d="M58 34 Q62 28 66 32 Q64 36 60 34 M64 40 Q70 36 72 40"/></g>'
    s += hatch(66, 88, 2, 5, 4)
    return s


def four():
    b = BRIQUE
    s = '<path d="M60 4 L70 4 L70 24 L60 24 Z" fill="#A35A44"/><path data-w="0" d="M65 4 L70 4 L70 24 L65 24 Z" fill="#6C3A2E"/>'
    s += f'<path id="dome" d="M8 80 L8 50 Q10 18 48 16 Q86 18 88 50 L88 80 Z" fill="{b[1]}"/>'
    s += shade_clip('dome', 'M62 10 Q86 60 60 86 L96 96 L96 10 Z', b[2])
    s += shade_clip('dome', 'M14 52 Q16 30 34 24 Q22 36 20 56 Z', b[0])
    s += f'<g data-clip="dome" data-teinte="{b[2]}" data-w="0.35" fill="none" stroke="#000"><path d="M8 62 L28 62 M68 62 L88 62 M8 72 L22 72 M74 72 L88 72 M16 46 L30 46 M66 46 L80 46 M28 30 L40 26 M56 26 L68 30 M18 62 L18 72 M80 62 L80 72"/></g>'
    s += '<path d="M28 82 L28 56 Q30 38 48 38 Q66 38 68 56 L68 82 Z" fill="#DED3BC"/>'
    s += '<path id="bouche" d="M33 82 L33 58 Q35 44 48 44 Q61 44 63 58 L63 82 Z" fill="#231A17"/>'
    s += '<path data-clip="bouche" data-w="0" d="M36 82 Q38 66 44 70 Q46 60 50 68 Q56 58 58 72 Q62 68 62 82 Z" fill="#D9822E"/>'
    s += '<path data-clip="bouche" data-w="0" d="M40 82 Q44 72 48 76 Q52 68 56 82 Z" fill="#FFC264"/>'
    s += '<path d="M4 80 L92 80 L92 88 L4 88 Z" fill="#B6A890"/><path data-w="0" d="M50 84 L92 84 L92 88 L50 88 Z" fill="#7C705F"/>'
    return s


def lampe():
    s = '<ellipse cx="48" cy="86" rx="22" ry="5" fill="#8E6A26" data-w="0.6"/>'
    s += f'<path id="pied" d="M30 84 Q34 76 44 74 L52 74 Q62 76 66 84 Z" fill="{LAITON}"/>'
    s += f'<path id="reservoir" d="M26 64 Q26 50 48 48 Q70 50 70 64 Q70 76 48 76 Q26 76 26 64 Z" fill="{LAITON}"/>'
    s += shade_clip('reservoir', 'M54 42 Q72 60 50 80 L80 80 L80 42 Z', '#8E6A26')
    s += shade_clip('reservoir', 'M30 60 Q34 52 42 51 Q34 56 33 64 Z', '#FFE6B0')
    s += '<path d="M38 48 L58 48 L58 42 L38 42 Z" fill="#8E6A26" data-w="0.6"/>'
    s += '<path d="M64 60 Q76 58 76 66 Q74 72 66 70" fill="none" stroke="#000" data-w="0.6"/>'
    s += '<path id="verre" d="M40 42 Q34 32 40 24 Q42 18 42 6 L54 6 Q54 18 56 24 Q62 32 56 42 Z" fill="#FFE6B0"/>'
    s += shade_clip('verre', 'M50 0 L64 0 L64 46 L48 46 Q58 30 50 0 Z', '#FFC264')
    s += '<path d="M48 36 Q42 28 48 18 Q54 28 48 36 Z" fill="#FFC46B" data-w="0.4"/><path d="M48 33 Q45 28 48 23 Q51 28 48 33 Z" fill="#F7F3EA" data-w="0"/>'
    s += '<g data-teinte="#F7F3EA" data-w="0.32" fill="none" stroke="#000"><path d="M44 10 L44 20 M40 30 Q38 34 40 38"/></g>'
    return s


def lit(double=True, rustique=False):
    c = NOYER if rustique else BOIS
    w = 74
    s = ''
    # tête de lit (gauche) et pied (droite) vus de trois quarts
    head = f'<path id="tete" d="M6 76 L6 26 Q6 16 16 16 L22 16 Q30 16 30 26 L30 70 Z" fill="{c[1]}"/>'
    if rustique:
        head = f'<path id="tete" d="M6 76 L6 22 Q18 8 30 22 L30 70 Z" fill="{c[1]}"/>'
    s += head + shade_clip('tete', 'M20 10 L34 10 L34 80 L20 80 Z', c[2])
    s += f'<g data-clip="tete" data-teinte="{c[0]}" data-w="0.3" fill="none" stroke="#000"><path d="M10 30 Q12 46 10 62"/></g>'
    # matelas et couverture
    deep = 14 if double else 8
    s += f'<path d="M24 {52 - deep} L84 {48 - deep} L90 {54 - deep} L30 {58 - deep} Z" fill="#F3EDE0" data-w="0.6"/>'
    quilt = ('#C0803A', '#A85837', '#743D2B') if rustique else CIEL
    s += f'<path id="drap" d="M30 {58 - deep} L90 {54 - deep} L90 66 Q60 74 30 72 Z" fill="{quilt[1]}"/>'
    s += f'<path id="dessus" d="M44 {57 - deep} L90 {54 - deep} L90 56 L48 58 Z" fill="{quilt[0]}"/>'
    s += f'<path d="M30 {58 - deep} L44 {57 - deep} L48 58 L48 74 Q38 76 30 72 Z" fill="{quilt[0]}" data-w="0.7"/>'
    if rustique:
        s += '<g data-clip="drap" data-w="0" fill="#D4A33E"><path d="M50 56 L62 56 L62 66 L50 66 Z"/><path d="M74 54 L86 54 L86 64 L74 64 Z"/></g>'
        s += '<g data-clip="drap" data-w="0" fill="#2F6E73"><path d="M62 56 L74 56 L74 66 L62 66 Z"/></g>'
        s += '<g data-clip="drap" data-teinte="#F3EDE0" data-w="0.3" fill="none" stroke="#000"><path d="M50 56 L50 70 M62 56 L62 70 M74 54 L74 68 M48 66 L90 64"/></g>'
    else:
        s += f'<g data-clip="drap" data-teinte="{quilt[2]}" data-w="0.32" fill="none" stroke="#000"><path d="M56 60 Q66 64 78 60 M54 66 Q70 70 86 64"/></g>'
    s += f'<path d="M48 58 L90 56 L90 66 Q70 72 48 74 Z" fill="none" stroke="#000" data-w="0.45"/>'
    # oreillers
    pil = [(0, 'o1')] + ([(14, 'o2')] if double else [])
    for off, oid in pil:
        y0 = 46 - deep + off
        s += f'<path id="{oid}" d="M14 {y0} Q12 {y0 - 8} 22 {y0 - 8} L38 {y0 - 10} Q46 {y0 - 8} 44 {y0} Q40 {y0 + 6} 30 {y0 + 6} Q16 {y0 + 8} 14 {y0} Z" fill="#F7F3EA" data-w="0.7"/>'
        s += shade_clip(oid, f'M10 {y0 + 1} Q30 {y0 + 2} 48 {y0 - 4} L48 {y0 + 10} L10 {y0 + 10} Z', '#D9CAAE')
        s += f'<g data-clip="{oid}" data-teinte="#B8A17E" data-w="0.3" fill="none" stroke="#000"><path d="M26 {y0 - 6} Q30 {y0 - 2} 28 {y0 + 3}"/></g>'
    # cadre et pieds
    s += f'<path d="M24 72 Q60 76 90 66 L90 72 Q60 82 24 78 Z" fill="{c[1]}" data-w="0.7"/>'
    s += f'<path d="M84 46 L92 44 L92 84 L86 86 Z" fill="{c[2]}"/><path d="M80 48 L86 46 L86 86 L80 86 Z" fill="{c[1]}"/>'
    s += f'<path d="M8 76 L14 76 L14 88 L8 88 Z" fill="{c[2]}" data-w="0.5"/>'
    return s


def miroir():
    c = BOIS
    s = f'<path d="M14 90 L30 70 L34 72 L20 92 Z" fill="{c[1]}"/><path d="M82 90 L66 70 L62 72 L76 92 Z" fill="{c[2]}"/>'
    s += f'<path d="M44 66 L52 66 L52 80 L44 80 Z" fill="{c[1]}" data-w="0.6"/>'
    s += f'<path d="M22 16 L26 16 L26 72 L22 72 Z" fill="{c[1]}"/><path d="M70 16 L74 16 L74 72 L70 72 Z" fill="{c[2]}"/>'
    s += f'<path d="M20 74 L76 74 L76 70 L20 70 Z" fill="{c[1]}" data-w="0.6"/>'
    s += f'<ellipse cx="48" cy="40" rx="24" ry="32" fill="{c[1]}"/>'
    s += '<ellipse id="glace" cx="48" cy="40" rx="18.5" ry="26" fill="#A9C7D9"/>'
    s += shade_clip('glace', 'M56 6 Q72 40 40 72 L80 80 L80 6 Z', '#587F8E')
    s += '<path data-clip="glace" data-w="0" d="M30 30 L44 16 L48 18 L32 36 Z" fill="#F7F3EA"/><path data-clip="glace" data-w="0" d="M32 42 L50 22 L52 24 L34 46 Z" fill="#F7F3EA"/>'
    s += knob(24, 40, 2.6) + knob(72, 40, 2.6)
    s += f'<g data-teinte="{c[0]}" data-w="0.3" fill="none" stroke="#000"><path d="M28 18 Q36 10 46 9"/></g>'
    return s


def plan_travail():
    c = BOIS
    s = box(10, 44, 62, 42, c, 'caisse', grain='M16 78 Q26 74 36 78')
    s += '<path d="M6 44 L74 44 L90 32 L22 32 Z" fill="#DED3BC"/><path d="M6 44 L74 44 L74 50 L6 50 Z" fill="#B6A890" data-w="0.7"/><path d="M74 44 L90 32 L90 38 L74 50 Z" fill="#7C705F" data-w="0.7"/>'
    # porte à gauche, niche ouverte à droite avec une marmite de cuivre
    s += '<path d="M14 54 L38 54 L38 82 L14 82 Z" fill="none" stroke="#000" data-w="0.4"/>' + knob(34, 68, 1.8)
    s += '<path d="M42 54 L68 54 L68 82 L42 82 Z" fill="#231A17" data-w="0.45"/>'
    s += f'<path data-w="0" d="M42 54 L68 54 L68 58 L46 58 L46 82 L42 82 Z" fill="{c[2]}"/>'
    s += '<path d="M48 68 L64 68 L63 80 Q56 82 49 80 Z" fill="#A85837" data-w="0.5"/><ellipse cx="56" cy="68" rx="8" ry="2" fill="#D98C62" data-w="0.4"/>'
    # saladier, cuillère de bois et rouleau à pâtisserie
    s += '<path d="M26 34 Q28 44 42 44 Q56 44 58 34 Z" fill="#F3EDE0" data-w="0.6"/><path data-w="0" d="M48 34 L58 34 Q56 44 44 44 Q52 40 48 34 Z" fill="#D9CAAE"/>'
    s += '<ellipse cx="42" cy="34" rx="16" ry="4" fill="#E2C582" data-w="0.5"/>'
    s += f'<path d="M46 34 L60 18 L63 20 L49 35 Z" fill="{c[0]}" data-w="0.5"/>'
    s += f'<path d="M62 42 L84 32 L86 35 L64 45 Z" fill="{c[0]}" data-w="0.55"/>'
    s += hatch(74, 80, 2, 4, 4)
    return s


def pot_fleurs():
    s = '<path data-w="0.6" fill="none" stroke="#000" d="M48 52 Q46 36 34 26 M48 52 Q52 34 62 22 M48 52 Q50 40 48 30"/>'
    s += '<path d="M40 44 Q30 40 30 32 Q40 34 42 42 Z" fill="#6E9241" data-w="0.5"/><path d="M54 46 Q64 44 68 36 Q58 36 54 44 Z" fill="#6E9241" data-w="0.5"/>'
    for cx, cy, col in ((34, 24, '#A58BB8'), (62, 20, '#F3EDE0'), (48, 28, '#C5443D')):
        s += f'<g data-w="0.45" fill="{col}"><circle cx="{cx}" cy="{cy - 6}" r="4.4"/><circle cx="{cx + 6}" cy="{cy}" r="4.4"/><circle cx="{cx}" cy="{cy + 6}" r="4.4"/><circle cx="{cx - 6}" cy="{cy}" r="4.4"/></g>'
        s += f'<circle cx="{cx}" cy="{cy}" r="3.2" fill="#D4A33E" data-w="0.4"/>'
    s += '<path id="pot" d="M24 56 L72 56 L66 88 Q48 92 30 88 Z" fill="#AD6244"/>'
    s += shade_clip('pot', 'M56 50 Q62 80 30 94 L80 94 L80 50 Z', '#743D2B')
    s += shade_clip('pot', 'M28 62 L34 62 L36 84 L32 84 Z', '#D98C62')
    s += '<path d="M20 50 L76 50 L76 60 L20 60 Z" fill="#D98C62"/><path data-w="0" d="M58 50 L76 50 L76 60 L56 60 Z" fill="#AD6244"/>'
    s += '<ellipse cx="48" cy="50" rx="27" ry="3" fill="#5E4233" data-w="0.35"/>'
    s += hatch(56, 84, 2, 5, 4)
    return s


def rechaud():
    s = '<path d="M26 70 L18 92 M70 70 L78 92 M48 72 L48 90" fill="none" stroke="#000" data-w="0.9"/>'
    s += '<path id="corps" d="M20 52 L76 52 L72 74 Q48 80 24 74 Z" fill="#4A4D52"/>'
    s += shade_clip('corps', 'M56 48 Q66 72 30 80 L80 80 L80 48 Z', '#26282E')
    s += shade_clip('corps', 'M24 56 L30 56 L30 72 L26 70 Z', '#8C8E91')
    s += '<path d="M40 60 L56 60 L56 70 L40 70 Z" fill="#26282E" data-w="0.4"/><path d="M42 66 Q46 60 48 64 Q50 60 54 66 L54 70 L42 70 Z" fill="#FFC264" data-w="0"/>'
    s += f'<ellipse cx="48" cy="52" rx="29" ry="7" fill="{LAITON}" data-w="0.6"/>'
    s += '<g data-w="0.4"><path d="M34 50 Q36 42 40 48 Z" fill="#A9C7D9"/><path d="M44 50 Q48 40 52 50 Z" fill="#A9C7D9"/><path d="M56 50 Q60 42 62 50 Z" fill="#A9C7D9"/></g>'
    # petite casserole posée
    s += '<path d="M32 44 L32 30 Q48 26 64 30 L64 44 Q48 48 32 44 Z" fill="#A85837" data-w="0.6"/>'
    s += '<path data-w="0" d="M34 32 L38 31 L38 42 L34 42 Z" fill="#D98C62"/>'
    s += '<path d="M64 33 L86 28 L87 32 L65 37 Z" fill="#4F3626" data-w="0.55"/>'
    s += '<ellipse cx="48" cy="30" rx="16" ry="3.4" fill="#743D2B" data-w="0.45"/>'
    s += '<g data-w="0.5" fill="none" stroke="#000"><path d="M42 22 Q38 16 42 10 M54 22 Q58 16 54 10"/></g>'
    return s


def tapis():
    s = '<ellipse id="t" cx="48" cy="60" rx="44" ry="26" fill="#A85837"/>'
    rings = [(38, 22, '#C0803A'), (31, 17.5, '#D9CAAE'), (24, 13.5, '#2F6E73'), (17, 9.5, '#D4A33E'), (9, 5.5, '#A85837')]
    for rx, ry, col in rings:
        s += f'<ellipse cx="48" cy="60" rx="{rx}" ry="{ry}" fill="{col}" data-w="0.35"/>'
    s += shade_clip('t', 'M66 32 Q86 82 18 92 L96 96 L96 32 Z', '#26282E" fill-opacity="0.35')
    s += '<g data-teinte="#743D2B" data-w="0.3" fill="none" stroke="#000"><path d="M10 58 l3 -3 M16 70 l3 -3 M30 80 l3 -3 M50 84 l3 -3 M70 80 l3 -3 M82 70 l3 -3 M86 56 l3 -3 M78 44 l3 -3 M60 37 l3 -3 M40 36 l3 -3 M20 44 l3 -3"/></g>'
    s += '<g data-teinte="#F3EDE0" data-w="0.28" fill="none" stroke="#000"><path d="M24 54 l2 -2 M30 66 l2 -2 M46 72 l2 -2 M66 66 l2 -2 M70 52 l2 -2 M52 44 l2 -2 M34 46 l2 -2"/></g>'
    return s


ALL = {
    'tabouret-miel': ('Tabouret miel (famille des meubles: trois quarts, dessus clair, côté droit dans l\'ombre): assise ronde, trois pieds écartés, bois couleur miel.', lambda: tabouret(MIEL)),
    'tabouret-sauge': ('Tabouret sauge: le tabouret de la série peint vert sauge.', lambda: tabouret(SAUGE)),
    'table-de-chevet-miel': ('Table de chevet miel: petit meuble à tiroir et niche, bougeoir allumé posé dessus.', lambda: chevet(MIEL)),
    'table-de-chevet-sauge': ('Table de chevet sauge: la même, peinte vert sauge.', lambda: chevet(SAUGE)),
    'etagere-miel': ('Étagère miel: trois rayons garnis (livres, bocal, pot de plante, boîte, linge plié).', lambda: etagere(MIEL)),
    'etagere-sauge': ('Étagère sauge: la même, peinte vert sauge.', lambda: etagere(SAUGE)),
    'coffre-a-linge-miel': ('Coffre à linge miel: coffre bas peint d\'une fleur, couvercle entrouvert sur le linge plié.', lambda: coffre_linge(MIEL)),
    'coffre-a-linge-sauge': ('Coffre à linge sauge: le même, peint vert sauge.', lambda: coffre_linge(SAUGE)),
    'armoire': ('Armoire: haute penderie à deux portes moulurées, corniche, boutons de laiton.', armoire),
    'banc': ('Banc de quai: lattes de bois, pieds et accoudoirs de fonte verte.', banc),
    'chaise': ('Chaise: chaise de bois simple, dossier plein, assise de bois.', lambda: chaise()),
    'chaise-essai': ('Chaise paillée: dossier à barreaux, assise de paille tressée, bois de noyer.', lambda: chaise(NOYER, True)),
    'coffre': ('Coffre: couvercle bombé, ferrures et serrure de laiton.', coffre),
    'coffre-deco-essai': ('Coffre de chêne: couvercle plat, panneaux sculptés, coins et moraillon de laiton.', coffre_chene),
    'table-a-manger': ('Table à manger: nappe à carreaux rouges, bol et pichet: la table où l\'on mange.', table_manger),
    'table-essai': ('Table de ferme: longue table de chêne nue, plateau épais aux planches visibles, pieds tournés.', table_ferme),
    'baquet-essai': ('Baquet: cuve de douelles cerclée de fer, oreilles de prise, eau claire.', baquet),
    'buffet-essai': ('Buffet bas: deux tiroirs, deux portes, boutons de laiton; bol et carafe posés dessus.', buffet),
    'cadre-essai': ('Cadre du quai: cadre doré suspendu, tableau d\'un quai au crépuscule avec ses rails.', cadre),
    'cuisiniere': ('Cuisinière: fonte noire, barre de laiton, foyer qui rougeoie, bouilloire de cuivre, tuyau.', cuisiniere),
    'etabli': ('Établi: plateau épais sur pieds, étau de bois en façade, rabot et copeaux.', etabli),
    'four': ('Four: four à pain en voûte de briques, bouche en arc où brûle le feu, cheminée.', four),
    'lampe-essai': ('Lampe à pétrole: pied et réservoir de laiton, verre de lampe, flamme qui luit.', lampe),
    'lit-double': ('Lit double: tête et pied de bois, deux oreillers, couverture bleue.', lambda: lit(True, False)),
    'lit-double-essai': ('Lit double rustique: tête de lit cintrée en noyer, deux oreillers, courtepointe en patchwork.', lambda: lit(True, True)),
    'lit-simple': ('Lit simple: le lit de la série, plus étroit, un seul oreiller.', lambda: lit(False, False)),
    'miroir': ('Miroir sur pied: psyché ovale montée sur pivots, glace bleutée à reflets, pieds écartés.', miroir),
    'plan-de-travail': ('Plan de travail: meuble de cuisine à dessus de pierre, niche avec marmite, saladier de pâte, cuillère et rouleau.', plan_travail),
    'pot-de-fleurs-essai': ('Pot de fleurs: pot de terre cuite, trois fleurs (lilas, blanche, rouge) et leurs feuilles.', pot_fleurs),
    'rechaud': ('Réchaud: petit poêle de fonte sur trois pieds, flammes bleues, casserole de cuivre qui fume.', rechaud),
    'tapis-essai': ('Tapis tressé: tapis rond vu de biais, tresse en anneaux de couleurs.', tapis),
}

# ---------------------------------------------------------------- objets d'intérieur d'Aubrune (2026-11-11)
# Chacun suit son modèle 3D (`assets-src/decors/recoltables-aubrune/interieurs.py`, `fetes.py`):
# mêmes pièces, mêmes couleurs ramenées au nuancier, vu de face ou de trois quarts selon l'objet.
FAIENCE = ('#A9C7D9', '#44618A', '#2C3B57')
ZINC = ('#B3BEC4', '#8C99A3', '#5A646C')
OSIER = ('#E2C582', '#C99A55', '#8E6A26')
CUIVRE = ('#D98C62', '#AD6244', '#743D2B')
GRES = ('#EADDBE', '#CDBB96', '#8F7F66')
CLAIR = ('#E6CF9C', '#C7A877', '#8C6F4E')


def lampe_table():
    """Lampe de chevet: pied de faïence bleue, tige de laiton, abat-jour de tissu allumé."""
    f = FAIENCE
    s = f'<ellipse cx="48" cy="88" rx="17" ry="4.4" fill="{f[2]}" data-w="0.6"/>'
    s += f'<path id="pied" d="M34 87 Q28 74 37 66 Q43 61 44 56 L52 56 Q53 61 59 66 Q68 74 62 87 Z" fill="{f[1]}"/>'
    s += shade_clip('pied', 'M54 54 Q72 74 54 92 L80 92 L80 54 Z', f[2])
    s += shade_clip('pied', 'M36 72 Q38 66 44 63 Q40 70 40 80 Z', f[0])
    s += '<g data-clip="pied" data-teinte="#F3EDE0" data-w="0.35" fill="none" stroke="#000"><path d="M33 76 Q48 81 63 76"/></g>'
    s += f'<path d="M45 56 L51 56 L51 44 L45 44 Z" fill="{LAITON}" data-w="0.5"/>'
    s += '<path id="abat" d="M24 46 L72 46 L61 14 L35 14 Z" fill="#F5E6C6"/>'
    s += shade_clip('abat', 'M52 10 L76 10 L76 50 L58 50 Q62 30 52 10 Z', '#DDC59C')
    s += '<g data-clip="abat" data-teinte="#A88C6C" data-w="0.3" fill="none" stroke="#000"><path d="M41 15 L35 45 M48 15 L48 45 M55 15 L61 45"/></g>'
    s += '<path d="M24 46 L72 46 L72 50 L24 50 Z" fill="#C0803A" data-w="0.5"/>'
    s += '<ellipse cx="48" cy="14" rx="13" ry="2.6" fill="#FFC264" data-w="0.45"/>'
    s += '<path data-w="0" d="M30 42 L37 18 L40 18 L34 42 Z" fill="#F7F3EA"/>'
    return s


def lampe_petrole():
    """Lampe à pétrole: pied de laiton, réservoir de verre où se voit le pétrole, verre de lampe."""
    s = '<ellipse cx="48" cy="88" rx="18" ry="4.4" fill="#8E6A26" data-w="0.6"/>'
    s += f'<path d="M33 87 Q37 80 44 78 L52 78 Q59 80 63 87 Z" fill="{LAITON}"/>'
    s += f'<path d="M44 79 L52 79 L53 71 L43 71 Z" fill="{LAITON}" data-w="0.5"/>'
    s += '<path id="res" d="M29 59 Q29 46 48 45 Q67 46 67 59 Q67 72 48 73 Q29 72 29 59 Z" fill="#A9C7D9"/>'
    s += '<path data-clip="res" data-w="0" d="M24 60 Q48 64 72 60 L72 78 L24 78 Z" fill="#F2C55C"/>'
    s += '<path data-clip="res" data-w="0" d="M56 60 Q68 64 58 76 L76 78 L76 60 Z" fill="#C0803A"/>'
    s += '<path data-clip="res" data-w="0" d="M56 42 Q70 50 66 60 L76 60 L76 42 Z" fill="#587F8E"/>'
    s += '<path data-clip="res" data-w="0" d="M34 55 Q37 50 43 49 Q38 53 37 59 Z" fill="#F7F3EA"/>'
    s += f'<path d="M38 47 L58 47 L57 40 L39 40 Z" fill="{LAITON}" data-w="0.6"/>'
    s += f'<path d="M57 42 L64 41 L64 45 L57 46 Z" fill="{LAITON}" data-w="0.45"/><circle cx="66" cy="43" r="2.6" fill="{LAITON}" data-w="0.45"/>'
    s += '<path d="M41 40 L55 40 L54 34 L42 34 Z" fill="#8E6A26" data-w="0.5"/>'
    s += '<path id="verre" d="M42 34 Q35 28 40 20 Q43 16 43 4 L53 4 Q53 16 56 20 Q61 28 54 34 Z" fill="#FFE6B0"/>'
    s += shade_clip('verre', 'M50 0 L64 0 L64 36 L48 36 Q58 22 50 0 Z', '#FFC264')
    s += '<path d="M48 31 Q43 25 48 15 Q53 25 48 31 Z" fill="#FFC46B" data-w="0.4"/><path data-w="0" d="M48 29 Q46 25 48 20 Q50 25 48 29 Z" fill="#F7F3EA"/>'
    s += '<g data-teinte="#F7F3EA" data-w="0.32" fill="none" stroke="#000"><path d="M45 7 L45 16"/></g>'
    return s


def horloge_murale():
    """Régulateur: grand cadran d'émail dans sa lunette de noyer, caisse vitrée, balancier de laiton."""
    c = NOYER
    s = f'<path d="M62 44 L68 40 L68 84 L62 88 Z" fill="{c[2]}"/>'
    s += f'<path id="caisse" d="M34 44 L62 44 L62 88 L34 88 Z" fill="{c[1]}"/>'
    s += f'<path d="M32 88 L64 88 L56 94 L40 94 Z" fill="{c[1]}" data-w="0.6"/>'
    s += '<path id="vitre" d="M38 49 L58 49 L58 83 L38 83 Z" fill="#2C3B57" data-w="0.5"/>'
    s += f'<path d="M47 48 L49 48 L49 70 L47 70 Z" fill="{LAITON}" data-w="0.3"/>'
    s += f'<circle cx="48" cy="73" r="5.4" fill="{LAITON}" data-w="0.45"/><circle cx="46.4" cy="71.4" r="1.6" fill="#F2C55C" data-w="0"/>'
    s += '<path data-clip="vitre" data-w="0" d="M39 50 L46 50 L39 64 Z" fill="#587F8E"/>'
    s += f'<path d="M30 44 L66 44 L66 40 L30 40 Z" fill="{c[0]}" data-w="0.6"/>'
    s += f'<circle id="lunette" cx="48" cy="24" r="21" fill="{c[1]}"/>'
    s += shade_clip('lunette', 'M60 0 Q78 30 48 48 L80 48 L80 0 Z', c[2])
    s += f'<g data-clip="lunette" data-teinte="{c[0]}" data-w="0.32" fill="none" stroke="#000"><path d="M31 18 Q36 8 46 5"/></g>'
    s += f'<circle cx="48" cy="24" r="16" fill="{LAITON}" data-w="0.5"/>'
    s += '<circle cx="48" cy="24" r="13.4" fill="#F7F3EA" data-w="0.35"/>'
    s += '<g data-teinte="#231A17" data-w="0.32" fill="none" stroke="#000"><path d="M48 12.6 L48 15.4 M48 32.6 L48 35.4 M36.6 24 L39.4 24 M56.6 24 L59.4 24"/></g>'
    s += '<g data-w="0.55" fill="none" stroke="#000"><path d="M48 24 L41.5 19.5 M48 24 L50.5 14"/></g>'
    s += '<circle cx="48" cy="24" r="1.4" fill="#231A17" data-w="0"/>'
    s += hatch(63, 82, 1, 4, 4)
    return s


def pendule():
    """Pendule de cheminée: socle, corps en chapelle de bois sombre, fronton, cadran d'émail, épi de laiton."""
    c = NOYER
    s = box(14, 74, 60, 8, c, 'socle', d=(10, -7))
    s += f'<path d="M16 82 L23 82 L23 88 L16 88 Z" fill="{LAITON}" data-w="0.45"/><path d="M65 82 L72 82 L72 88 L65 88 Z" fill="{LAITON}" data-w="0.45"/>'
    s += box(20, 38, 46, 36, c, 'corps', d=(9, -7), grain='M24 70 Q32 66 40 70 M50 72 Q56 68 62 71')
    s += f'<path d="M66 38 L75 31 L52 13 L43 20 Z" fill="{c[0]}"/>'
    s += f'<path id="fronton" d="M18 38 L68 38 L43 20 Z" fill="{c[1]}"/>'
    s += shade_clip('fronton', 'M43 18 L70 18 L70 40 L50 40 Z', c[2])
    s += f'<circle cx="47.5" cy="15" r="3.4" fill="{LAITON}" data-w="0.45"/>'
    s += f'<circle cx="43" cy="56" r="13" fill="{LAITON}" data-w="0.5"/>'
    s += '<circle cx="43" cy="56" r="10.4" fill="#F7F3EA" data-w="0.35"/>'
    s += '<g data-teinte="#231A17" data-w="0.3" fill="none" stroke="#000"><path d="M43 46.6 L43 49 M43 63 L43 65.4 M33.6 56 L36 56 M50 56 L52.4 56"/></g>'
    s += '<g data-w="0.5" fill="none" stroke="#000"><path d="M43 56 L38 52 M43 56 L45 47.6"/></g>'
    s += hatch(68, 66, 2, 4, 4)
    return s


def _cadre_rect(x0, y0, x1, y1, m, c, uid):
    """Cadre rectangulaire de bois (contour évidé) et ombre en bas à droite."""
    s = f'<path id="{uid}" d="M{x0} {y0} L{x1} {y0 - 1} L{x1 + 1} {y1} L{x0 + 1} {y1 + 1} Z M{x0 + m} {y0 + m} L{x1 - m} {y0 + m - 1} L{x1 - m + 1} {y1 - m} L{x0 + m + 1} {y1 - m + 1} Z" fill-rule="evenodd" fill="{c[1]}"/>'
    s += shade_clip(uid, f'M{x1 - 14} {y0 - 6} L96 {y0 - 6} L96 96 L0 96 L0 {y1 - 6} Q{x1 - 6} {y1 - 6} {x1 - 14} {y0 - 6} Z', c[2])
    s += f'<g data-clip="{uid}" data-teinte="{c[0]}" data-w="0.32" fill="none" stroke="#000"><path d="M{x0 + 3} {y0 + 3} L{x1 - 6} {y0 + 2} M{x0 + 3} {y0 + 6} L{x0 + 4} {y1 - 6}"/></g>'
    return s


def cadre_ovale():
    """Médaillon ovale doré: portrait de famille, un homme à moustache, col blanc, sur fond ardoise."""
    s = '<path d="M34 16 L48 4 L62 16" fill="none" stroke="#000" data-w="0.5"/>'
    s += f'<ellipse id="cadre" cx="48" cy="52" rx="29" ry="39" fill="{LAITON}"/>'
    s += shade_clip('cadre', 'M60 8 Q86 64 26 96 L96 96 L96 8 Z', '#8E6A26')
    s += '<g data-clip="cadre" data-teinte="#F2C55C" data-w="0.35" fill="none" stroke="#000"><path d="M24 44 Q26 26 38 17"/></g>'
    s += '<ellipse id="fond" cx="48" cy="52" rx="21" ry="30" fill="#587F8E" data-w="0.5"/>'
    s += shade_clip('fond', 'M58 18 Q74 56 40 86 L80 86 L80 18 Z', '#2C3B57')
    s += '<path data-clip="fond" d="M26 86 Q28 68 48 65 Q68 68 70 86 Z" fill="#26282E" data-w="0.5"/>'
    s += '<path data-clip="fond" d="M42 65 L48 73 L54 65 Z" fill="#F3EDE0" data-w="0.35"/>'
    s += '<path d="M45 58 L51 58 L51 66 L45 66 Z" fill="#E0AE86" data-w="0.35"/>'
    s += '<ellipse cx="48" cy="48" rx="9" ry="11" fill="#EFC7A6" data-w="0.45"/>'
    s += '<path d="M39 46 Q38 35 48 35 Q58 35 57 46 Q55 40 48 40 Q41 40 39 46 Z" fill="#9A948C" data-w="0.4"/>'
    s += '<path d="M42 53 Q48 50 54 53 Q51 55 48 54 Q45 55 42 53 Z" fill="#6A6763" data-w="0.3"/>'
    s += '<g data-w="0" fill="#231A17"><circle cx="44.5" cy="47" r="0.9"/><circle cx="51.5" cy="47" r="0.9"/></g>'
    return s


def cadre_portrait():
    """Cadre en hauteur de bois sombre: une femme en buste, robe rouge, chignon, sur fond vert sombre."""
    # Le cadre d'abord: son ombre déborde sur le trou, la toile peinte ensuite la recouvre.
    s = '<path d="M34 12 L48 3 L62 12" fill="none" stroke="#000" data-w="0.5"/>'
    s += _cadre_rect(14, 10, 82, 88, 10, NOYER, 'cadre')
    s += '<path id="toile" d="M24 20 L72 19 L73 79 L25 80 Z" fill="#3F6453" data-w="0.5"/>'
    s += shade_clip('toile', 'M56 14 Q76 54 40 84 L80 84 L80 14 Z', '#25392F')
    s += '<path data-clip="toile" d="M28 82 Q30 64 48 61 Q66 64 68 82 Z" fill="#C5443D" data-w="0.5"/>'
    s += '<path data-clip="toile" data-w="0" d="M56 64 Q66 68 68 82 L56 82 Z" fill="#8F3B34"/>'
    s += '<path d="M45 54 L51 54 L51 62 L45 62 Z" fill="#E0AE86" data-w="0.35"/>'
    s += '<path d="M40 32 Q40 22 48 22 Q56 22 56 32 L57 44 Q48 40 39 44 Z" fill="#6E4B33" data-w="0.45"/>'
    s += '<circle cx="48" cy="21" r="5" fill="#6E4B33" data-w="0.45"/>'
    s += '<ellipse cx="48" cy="44" rx="8" ry="10.4" fill="#EFC7A6" data-w="0.45"/>'
    s += '<path d="M40 40 Q42 32 48 32 Q54 32 56 40 Q52 36 48 36 Q44 36 40 40 Z" fill="#6E4B33" data-w="0"/>'
    s += '<g data-w="0" fill="#231A17"><circle cx="45" cy="44" r="0.9"/><circle cx="51" cy="44" r="0.9"/></g>'
    s += '<path data-w="0" d="M46 50 Q48 51.4 50 50 Q48 52 46 50 Z" fill="#A2473F"/>'
    return s


def cadre_paysage():
    """Cadre en largeur de bois sombre: ciel, coteau, le clocher du bourg et son toit de tuiles."""
    s = '<path d="M34 22 L48 12 L62 22" fill="none" stroke="#000" data-w="0.5"/>'
    s += _cadre_rect(6, 22, 90, 78, 9, NOYER, 'cadre')
    s += '<path id="toile" d="M15 30 L81 29 L82 70 L16 71 Z" fill="#A9C7D9" data-w="0.5"/>'
    s += '<path data-clip="toile" data-w="0" d="M22 38 Q28 34 34 37 Q40 34 44 38 Z" fill="#F7F3EA"/>'
    s += '<path data-clip="toile" data-w="0" d="M10 56 Q36 44 60 50 Q74 46 90 52 L90 76 L10 76 Z" fill="#9DBB5B"/>'
    s += '<path data-clip="toile" d="M10 64 Q40 54 90 60 L90 76 L10 76 Z" fill="#6E9241" data-w="0.4"/>'
    s += '<path data-clip="toile" d="M60 56 L60 42 L67 42 L67 55 Z" fill="#DED3BC" data-w="0.4"/>'
    s += '<path data-clip="toile" d="M58 43 L63.5 30 L69 43 Z" fill="#AD6244" data-w="0.4"/>'
    s += '<path data-clip="toile" data-w="0" d="M62 46 L65 46 L65 50 L62 50 Z" fill="#231A17"/>'
    s += '<path data-clip="toile" d="M40 58 L40 52 L48 52 L48 57 Z" fill="#F5E6C6" data-w="0.35"/><path data-clip="toile" d="M39 52 L44 47 L49 52 Z" fill="#AD6244" data-w="0.35"/>'
    return s


def etagere_murale():
    """Étagère murale: planche sur deux consoles; deux confitures coiffées de tissu, deux livres debout, un pichet de grès."""
    c = BOIS
    s = f'<path d="M8 58 L84 58 L92 51 L16 51 Z" fill="{c[0]}"/>'
    s += '<path id="b1" d="M13 57 L13 40 Q13 37 16 37 L25 37 Q28 37 28 40 L28 57 Z" fill="#C5443D"/>'
    s += shade_clip('b1', 'M23 34 L32 34 L32 60 L24 60 Z', '#80292A')
    s += '<path data-w="0" d="M15 41 L17 41 L17 54 L15 54 Z" fill="#F7F3EA"/>'
    s += '<path d="M11 39 Q20 31 30 39 L28 42 Q20 39 13 42 Z" fill="#F3EDE0" data-w="0.5"/>'
    s += '<path d="M31 57 L31 43 Q31 40 34 40 L41 40 Q44 40 44 43 L44 57 Z" fill="#D9822E"/>'
    s += '<path d="M29 42 Q37 35 46 42 L44 45 Q37 42 31 45 Z" fill="#A9C7D9" data-w="0.5"/>'
    s += '<path d="M33 46 L42 46 L42 52 L33 52 Z" fill="#F5E6C6" data-w="0.35"/>'
    s += '<path d="M48 57 L48 25 L55 25 L55 57 Z" fill="#3F6453" data-w="0.7"/>'
    s += '<path d="M55 57 L55 29 L61 29 L61 57 Z" fill="#8F3B34" data-w="0.7"/>'
    s += f'<g data-teinte="{LAITON}" data-w="0.32" fill="none" stroke="#000"><path d="M48 30 L55 30 M48 52 L55 52 M55 34 L61 34 M55 52 L61 52"/></g>'
    s += f'<path id="pichet" d="M67 57 Q62 46 66 38 L64 32 L77 32 L75 38 Q80 46 76 57 Z" fill="{GRES[1]}"/>'
    s += shade_clip('pichet', 'M72 30 Q82 46 72 60 L84 60 L84 30 Z', GRES[2])
    s += '<path data-clip="pichet" data-w="0" d="M62 30 L80 30 L80 40 Q72 42 62 40 Z" fill="#8C5A35"/>'
    s += '<path d="M76 38 Q84 40 78 50" fill="none" stroke="#000" data-w="0.55"/>'
    s += f'<path d="M8 58 L84 58 L84 64 L8 64 Z" fill="{c[1]}" data-w="0.7"/><path d="M84 58 L92 51 L92 57 L84 64 Z" fill="{c[2]}" data-w="0.7"/>'
    s += f'<g data-teinte="{c[2]}" data-w="0.28" fill="none" stroke="#000"><path d="M14 61 Q30 59 46 61"/></g>'
    for x in (18, 70):
        s += f'<path d="M{x} 64 L{x + 8} 64 L{x} 84 Z" fill="{c[2]}" data-w="0.6"/>'
    return s


def patere():
    """Patère: planche à quatre crochets de laiton; un manteau, une veste, un chapeau de feutre."""
    c = BOIS
    s = f'<path d="M6 24 L90 22 L90 31 L6 33 Z" fill="{c[1]}"/>'
    s += f'<path data-w="0" d="M6 24 L90 22 L90 24 L6 26 Z" fill="{c[0]}"/>'
    s += f'<g data-teinte="{c[2]}" data-w="0.28" fill="none" stroke="#000"><path d="M12 29 Q30 27 46 28 M60 27 Q72 26 84 26"/></g>'
    for x in (20, 40, 58, 78):
        s += f'<circle cx="{x}" cy="27.5" r="2.4" fill="{LAITON}" data-w="0.45"/>'
    s += '<path id="manteau" d="M13 34 L27 34 Q34 38 35 58 L38 90 Q22 94 8 90 L11 58 Q8 38 13 34 Z" fill="#96704C"/>'
    s += shade_clip('manteau', 'M26 30 Q36 60 28 96 L44 96 L44 30 Z', '#5E4233')
    s += '<path d="M15 34 L20 52 L25 34 Z" fill="#5E4233" data-w="0.4"/>'
    s += '<g data-teinte="#5E4233" data-w="0.32" fill="none" stroke="#000"><path d="M20 54 L20 88 M14 64 L12 86"/></g>'
    s += '<g data-w="0.35" fill="#5E4233"><circle cx="22.5" cy="60" r="1.6"/><circle cx="22.5" cy="70" r="1.6"/></g>'
    s += '<path id="veste" d="M51 34 L65 34 Q71 38 71 52 L73 70 Q60 74 46 70 L47 52 Q45 38 51 34 Z" fill="#44618A"/>'
    s += shade_clip('veste', 'M64 30 Q74 52 64 76 L80 76 L80 30 Z', '#2C3B57')
    s += '<path d="M53 34 L58 48 L63 34 Z" fill="#2C3B57" data-w="0.4"/>'
    s += '<path d="M50 58 L57 58 L57 63 L50 63 Z" fill="#2C3B57" data-w="0.35"/>'
    s += '<path id="chapeau" d="M70 30 Q70 17 79 17 Q88 17 88 30 Z" fill="#4A4D52"/>'
    s += '<path d="M70 26 L88 26 L88 30 L70 30 Z" fill="#8F3B34" data-w="0.35"/>'
    s += '<ellipse cx="79" cy="31" rx="13" ry="3.4" fill="#4A4D52" data-w="0.6"/>'
    s += '<path data-w="0" d="M73 22 Q75 19 78 19 Q75 22 74 25 Z" fill="#8C8E91"/>'
    return s


def rideau_de_porte():
    """Rideau de passage sur sa tringle, retenu sur le côté par une embrasse: on devine la pièce d'à côté."""
    s = '<path d="M26 40 L58 92 L28 92 Z" fill="#231A17" data-w="0"/>'
    s += '<path id="rideau" d="M10 15 L86 15 L86 91 L58 91 Q40 72 26 56 Q32 74 32 91 L13 91 Q17 72 22 56 Q12 36 10 15 Z" fill="#C5443D"/>'
    s += '<g data-clip="rideau" data-w="0" fill="#8F3B34"><path d="M24 14 L32 14 L28 50 L22 50 Z"/><path d="M44 14 L52 14 L56 62 L48 56 Z"/><path d="M64 14 L72 14 L74 92 L66 92 Z"/><path d="M80 14 L88 14 L88 92 L82 92 Z"/><path d="M24 62 L28 62 L30 92 L26 92 Z"/></g>'
    s += '<g data-clip="rideau" data-teinte="#E0675A" data-w="0.32" fill="none" stroke="#000"><path d="M16 18 Q18 34 20 48 M38 18 Q40 36 44 52 M58 18 L60 66 M76 18 L77 88"/></g>'
    s += '<path d="M14 54 Q24 52 32 57 L31 62 Q22 58 15 59 Z" fill="#D4A33E" data-w="0.5"/>'
    s += '<path d="M30 58 L34 68 L30 70 Z" fill="#D4A33E" data-w="0.4"/>'
    s += f'<path d="M6 11 L90 11 L90 15 L6 15 Z" fill="{LAITON}" data-w="0.6"/>'
    s += f'<circle cx="6" cy="13" r="3" fill="{LAITON}" data-w="0.45"/><circle cx="90" cy="13" r="3" fill="{LAITON}" data-w="0.45"/>'
    return s


def vaisselier():
    """Vaisselier: buffet bas à deux portes, deux étagères d'assiettes debout et un bol, corniche."""
    c = BOIS
    s = '<path d="M16 12 L64 12 L64 54 L16 54 Z" fill="#4F3626" data-w="0"/>'
    for cx, rim, mid in ((25, '#F3EDE0', '#44618A'), (39, '#A9C7D9', '#F3EDE0'), (53, '#F3EDE0', '#C5443D')):
        s += f'<circle cx="{cx}" cy="22.5" r="6.4" fill="{rim}" data-w="0.45"/><circle cx="{cx}" cy="22.5" r="3.2" fill="{mid}" data-w="0"/>'
    for cx, rim, mid in ((25, '#F3EDE0', '#3F6453'), (53, '#A9C7D9', '#F3EDE0')):
        s += f'<circle cx="{cx}" cy="41.5" r="6" fill="{rim}" data-w="0.45"/><circle cx="{cx}" cy="41.5" r="3" fill="{mid}" data-w="0"/>'
    s += '<path d="M31 42 Q32 49 39 49 Q46 49 47 42 Z" fill="#D4A33E" data-w="0.5"/><ellipse cx="39" cy="42" rx="8" ry="2" fill="#F2C55C" data-w="0.35"/>'
    for yy in (30, 49):
        s += f'<path d="M16 {yy} L64 {yy} L64 {yy + 3} L16 {yy + 3} Z" fill="{c[0]}" data-w="0.5"/>'
    s += f'<path d="M64 12 L72 6 L72 50 L64 56 Z" fill="{c[2]}"/>'
    s += f'<path d="M11 12 L17 12 L17 56 L11 56 Z" fill="{c[1]}"/><path d="M63 12 L69 12 L69 56 L63 56 Z" fill="{c[1]}"/>'
    s += f'<path d="M69 12 L76 7 L76 51 L69 56 Z" fill="{c[2]}" data-w="0.6"/>'
    s += box(8, 6, 64, 6, c, 'corniche', d=(10, -6))
    s += box(8, 56, 64, 30, c, 'bas', d=(10, -7), grain='M14 82 Q24 79 34 82 M46 82 Q56 79 66 82')
    s += f'<path d="M12 60 L38 60 L38 82 L12 82 Z" fill="none" stroke="#000" data-w="0.4"/><path d="M42 60 L68 60 L68 82 L42 82 Z" fill="none" stroke="#000" data-w="0.4"/>'
    s += f'<path d="M15 63 L35 63 L35 79 L15 79 Z" fill="{c[0]}" data-w="0.3"/><path d="M45 63 L65 63 L65 79 L45 79 Z" fill="{c[0]}" data-w="0.3"/>'
    s += knob(36.5, 71, 1.8) + knob(43.5, 71, 1.8)
    s += f'<path d="M10 86 L16 86 L16 92 L10 92 Z" fill="{c[2]}" data-w="0.5"/><path d="M64 86 L70 86 L70 92 L64 92 Z" fill="{c[2]}" data-w="0.5"/>'
    s += hatch(74, 78, 2, 4, 4)
    return s


def poele():
    """Poêle de fonte sur quatre pieds: porte vitrée où danse le feu, bouilloire de cuivre, tuyau qui monte."""
    f = FER
    s = f'<path d="M58 40 L64 40 L64 4 L58 4 Z" fill="{f[1]}"/><path data-w="0" d="M61.5 40 L64 40 L64 4 L61.5 4 Z" fill="{f[2]}"/>'
    s += f'<path d="M56 20 L66 20 L66 24 L56 24 Z" fill="{f[0]}" data-w="0.5"/>'
    for x, y in ((22, 76), (58, 76), (34, 70), (68, 69)):
        s += f'<path d="M{x} {y} L{x + 6} {y} L{x + 5} {y + 12} L{x + 1} {y + 12} Z" fill="{f[2]}" data-w="0.6"/>'
    s += box(18, 42, 48, 34, f, 'corps', d=(12, -9))
    s += f'<path d="M16 42 L68 42 L68 45 L16 45 Z" fill="{f[0]}" data-w="0.5"/>'
    s += '<path d="M24 50 L52 50 L52 71 L24 71 Z" fill="#26282E" data-w="0.5"/>'
    s += '<path id="feu" d="M27 53 L49 53 L49 68 L27 68 Z" fill="#D9822E" data-w="0"/>'
    s += '<path data-clip="feu" data-w="0" d="M28 68 Q30 58 34 62 Q36 54 40 62 Q44 56 46 68 Z" fill="#FFC264"/>'
    s += '<path data-clip="feu" data-w="0" d="M34 68 Q37 62 39 66 Q41 62 43 68 Z" fill="#FFE6B0"/>'
    s += '<g data-w="0.35" fill="none" stroke="#000"><path d="M27 60.5 L49 60.5 M34.3 53 L34.3 68 M41.6 53 L41.6 68"/></g>'
    s += knob(57, 60, 2.2)
    s += f'<path id="bouilloire" d="M26 40 Q24 27 35 25 Q46 27 44 40 Z" fill="{CUIVRE[1]}"/>'
    s += shade_clip('bouilloire', 'M38 22 Q48 30 40 42 L50 42 L50 22 Z', CUIVRE[2])
    s += f'<path data-w="0" d="M29 36 Q29 29 33 27 L33 37 Z" fill="{CUIVRE[0]}"/>'
    s += f'<path d="M43 33 L52 26 L53 29 L45 36 Z" fill="{CUIVRE[1]}" data-w="0.5"/>'
    s += '<path d="M29 27 Q35 17 41 27" fill="none" stroke="#000" data-w="0.55"/>'
    s += hatch(68, 66, 2, 4, 4)
    return s


def _buche(x, y, k):
    """Bûche vue par le bout: écorce qui file vers le fond (haut à droite), section claire et cernes."""
    bark = ('#6E4B30', '#5E4233', '#4F3626')[k % 3]
    s = f'<path d="M{x - 6.6:g} {y - 8.8:g} L{x + 5.4:g} {y - 17.8:g} A11 11 0 0 1 {x + 18.6:g} {y - 0.2:g} L{x + 6.6:g} {y + 8.8:g} Z" fill="{bark}"/>'
    s += f'<g data-teinte="#8C6F4E" data-w="0.3" fill="none" stroke="#000"><path d="M{x + 2:g} {y - 12:g} l9 -6 M{x + 8:g} {y - 2:g} l8 -6"/></g>'
    s += f'<circle cx="{x}" cy="{y}" r="11" fill="#E6CF9C"/>'
    s += f'<g data-teinte="#C7A877" data-w="0.32" fill="none" stroke="#000"><circle cx="{x + 0.6:g}" cy="{y + 0.4:g}" r="6.6"/><circle cx="{x + 0.8:g}" cy="{y + 0.6:g}" r="2.6"/></g>'
    s += f'<path d="M{x + 1:g} {y + 1:g} L{x + 7:g} {y + 6:g}" fill="none" stroke="#000" data-w="0.35"/>'
    return s


def buches():
    """Bûches d'intérieur rangées trois, deux, une, les sections claires tournées vers la pièce."""
    s = ''
    k = 0
    for row, xs in ((80, (20, 44, 68)), (62, (32, 56)), (44, (44,))):
        for x in xs:
            s += _buche(x, row, k)
            k += 1
    return s


def caisse_legumes():
    """Cagette de la récolte: planches à claire-voie, deux choux, des pommes de terre, des carottes et leurs fanes."""
    c = CLAIR
    s = '<path d="M12 52 L72 52 L86 42 L26 42 Z" fill="#6E4B30" data-w="0.5"/>'
    s += '<g data-teinte="#40592D" data-w="0.4" fill="#9DBB5B"><path d="M64 34 Q70 20 76 12 Q76 26 70 36 Z"/><path d="M72 38 Q80 26 90 20 Q86 32 78 40 Z"/></g>'
    s += '<path id="chou1" d="M14 46 Q14 30 28 30 Q42 30 42 46 Z" fill="#9DBB5B"/>'
    s += shade_clip('chou1', 'M30 26 Q44 36 36 50 L46 50 L46 26 Z', '#6E9241')
    s += '<g data-clip="chou1" data-teinte="#40592D" data-w="0.32" fill="none" stroke="#000"><path d="M28 46 Q22 38 24 32 M28 46 Q34 38 34 32"/></g>'
    s += '<path id="chou2" d="M34 44 Q34 32 45 32 Q56 32 56 44 Z" fill="#6E9241"/>'
    s += shade_clip('chou2', 'M48 28 Q60 36 52 48 L60 48 L60 28 Z', '#40592D')
    s += '<g data-teinte="#9DBB5B" data-w="0.32" fill="none" stroke="#000"><path d="M45 44 Q40 38 42 34 M45 44 Q50 38 50 34"/></g>'
    s += '<g data-w="0.45" fill="#C7A877"><ellipse cx="22" cy="48" rx="7" ry="5"/><ellipse cx="34" cy="50" rx="6.4" ry="4.6"/></g>'
    s += '<g data-w="0" fill="#5E4233"><circle cx="20" cy="47" r="0.9"/><circle cx="35" cy="49" r="0.9"/></g>'
    s += '<g data-w="0.5" fill="#D9822E"><path d="M64 33 Q70 30 72 36 L50 52 Z"/><path d="M72 37 Q78 35 79 41 L56 54 Z"/></g>'
    s += '<g data-teinte="#A85837" data-w="0.3" fill="none" stroke="#000"><path d="M62 40 l3 2 M68 41 l3 2"/></g>'
    s += box(12, 52, 60, 32, c, 'cagette', d=(14, -10))
    s += '<g data-clip="cagette" data-w="0" fill="#6E4B30"><path d="M12 61 L72 61 L72 64 L12 64 Z"/><path d="M12 73 L72 73 L72 76 L12 76 Z"/></g>'
    s += f'<path d="M12 52 L18 52 L18 86 L12 86 Z" fill="{c[2]}" data-w="0.5"/><path d="M66 52 L72 52 L72 86 L66 86 Z" fill="{c[2]}" data-w="0.5"/>'
    s += f'<g data-clip="cagette" data-teinte="{c[2]}" data-w="0.28" fill="none" stroke="#000"><path d="M22 57 Q34 55 46 57 M30 69 Q42 67 56 69 M22 81 Q36 79 50 81"/></g>'
    s += hatch(74, 76, 2, 4, 4)
    return s


def tonnelet():
    """Tonnelet couché sur son chantier: douelles, cercles de fer, robinet de laiton tourné vers la pièce."""
    c, n = BOIS, NOYER
    s = f'<path d="M18 72 L30 72 L32 88 L16 88 Z" fill="{n[1]}"/><path d="M62 72 L74 72 L76 88 L60 88 Z" fill="{n[1]}"/>'
    s += f'<path data-w="0" d="M26 72 L30 72 L32 88 L28 88 Z" fill="{n[2]}"/><path data-w="0" d="M70 72 L74 72 L76 88 L72 88 Z" fill="{n[2]}"/>'
    s += f'<path id="fut" d="M14 38 Q48 26 82 38 Q88 56 82 74 Q48 86 14 74 Q8 56 14 38 Z" fill="{c[1]}"/>'
    s += shade_clip('fut', 'M60 26 Q88 70 30 90 L96 96 L96 26 Z', c[2])
    s += shade_clip('fut', 'M16 44 Q30 36 46 35 Q28 40 22 52 Z', c[0])
    s += f'<g data-clip="fut" data-teinte="{c[2]}" data-w="0.3" fill="none" stroke="#000"><path d="M12 48 Q48 38 86 48 M10 58 Q48 50 88 58 M12 68 Q48 62 86 68"/></g>'
    for x in (24, 70):
        s += f'<path data-clip="fut" d="M{x - 3} 20 Q{x - 7} 56 {x - 3} 92 L{x + 3} 92 Q{x - 1} 56 {x + 3} 20 Z" fill="{FER[1]}" data-w="0.45"/>'
    s += f'<ellipse cx="13" cy="56" rx="5" ry="17" fill="{c[0]}" data-w="0.6"/>'
    s += f'<path d="M45 62 L51 62 L51 72 L49 78 L47 72 Z" fill="{LAITON}" data-w="0.5"/>'
    s += f'<path d="M43 61 L53 61 L53 64 L43 64 Z" fill="#8E6A26" data-w="0.45"/><circle cx="48" cy="58" r="2.6" fill="{LAITON}" data-w="0.45"/>'
    return s


def seau():
    """Seau de zinc à anse, de l'eau dedans, deux cerclages emboutis."""
    z = ZINC
    s = '<path d="M22 44 Q48 -2 74 44" fill="none" stroke="#000" data-w="0.7"/>'
    s += f'<path id="seau" d="M22 42 L74 42 L67 86 Q48 91 29 86 Z" fill="{z[1]}"/>'
    s += shade_clip('seau', 'M56 36 Q70 64 44 94 L80 94 L80 36 Z', z[2])
    s += shade_clip('seau', 'M28 46 L34 46 L35 82 L31 82 Z', z[0])
    s += f'<g data-clip="seau" data-teinte="{z[2]}" data-w="0.4" fill="none" stroke="#000"><path d="M22 56 Q48 61 74 56 M24 74 Q48 79 72 74"/></g>'
    s += f'<ellipse cx="48" cy="42" rx="26" ry="6.4" fill="{z[0]}" data-w="0.6"/>'
    s += '<ellipse id="eau" cx="48" cy="43" rx="21.5" ry="4.4" fill="#6EA9AD" data-w="0.35"/>'
    s += shade_clip('eau', 'M30 36 L74 36 L74 50 L40 50 Q62 44 30 36 Z', '#43737A')
    s += '<g data-teinte="#9FD0CF" data-w="0.32" fill="none" stroke="#000"><path d="M34 43 Q40 41.4 46 42.4"/></g>'
    s += f'<g data-w="0.4" fill="{z[2]}"><circle cx="22" cy="45" r="2.2"/><circle cx="74" cy="45" r="2.2"/></g>'
    return s


def balai():
    """Balai de paille: manche de bois clair, ligature rouge, paille qui s'évase."""
    s = '<path d="M45 4 L51 4 L51 52 L45 52 Z" fill="#D7A86A"/>'
    s += '<path data-w="0" d="M48.5 4 L51 4 L51 52 L48.5 52 Z" fill="#A87A46"/>'
    s += '<path id="paille" d="M40 56 L56 56 Q66 72 72 92 L24 92 Q30 72 40 56 Z" fill="#E2C582"/>'
    s += shade_clip('paille', 'M52 52 Q62 74 56 96 L80 96 L80 52 Z', '#C99A55')
    s += '<g data-clip="paille" data-teinte="#8E6A26" data-w="0.32" fill="none" stroke="#000"><path d="M44 62 L34 92 M48 62 L44 92 M52 62 L56 92 M55 60 L66 92"/></g>'
    s += '<path d="M39 50 L57 50 L57 58 L39 58 Z" fill="#C5443D" data-w="0.6"/>'
    s += '<path d="M35 68 Q48 71 61 68 L62 72 Q48 75 34 72 Z" fill="#C5443D" data-w="0.45"/>'
    return s


def tabouret_ferme():
    """Tabouret de ferme: assise ronde épaisse taillée dans une rondelle (cernes, fente), trois pieds écartés."""
    c = BOIS
    s = f'<path d="M55 50 L60 50 L68 82 L63 82 Z" fill="{c[2]}"/>'
    s += f'<path d="M29 54 L36 54 L21 90 L14 90 Z" fill="{c[1]}"/><path d="M58 56 L65 56 L80 90 L73 90 Z" fill="{c[1]}"/>'
    s += f'<path data-w="0" d="M62 56 L65 56 L80 90 L77 90 Z" fill="{c[2]}"/>'
    s += f'<path id="assise" d="M14 40 L82 40 L82 48 Q82 58 48 58 Q14 58 14 48 Z" fill="{c[1]}"/>'
    s += shade_clip('assise', 'M52 36 Q80 40 84 50 L84 62 L40 62 Q70 54 52 36 Z', c[2])
    s += f'<ellipse id="dessus" cx="48" cy="40" rx="34" ry="11" fill="{c[0]}"/>'
    s += f'<g data-clip="dessus" data-teinte="{c[1]}" data-w="0.32" fill="none" stroke="#000"><ellipse cx="50" cy="40.6" rx="22" ry="7"/><ellipse cx="51" cy="41" rx="10" ry="3.2"/></g>'
    s += '<path d="M64 36 L72 33" fill="none" stroke="#000" data-w="0.4"/>'
    s += '<path data-w="0" d="M20 37 Q26 32 36 31 Q28 35 24 40 Z" fill="#F5E6C6"/>'
    return s


def banc_de_table():
    """Banc de ferme: longue planche sur deux tréteaux pleins reliés par une entretoise."""
    c = BOIS
    s = ''
    for x in (12, 60):
        s += f'<path d="M{x + 8} 50 L{x + 16} 44 L{x + 18} 78 L{x + 11} 84 Z" fill="{c[2]}"/>'
        s += f'<path d="M{x} 50 L{x + 9} 50 L{x + 12} 84 L{x - 3} 84 Z" fill="{c[1]}"/>'
    s += f'<path d="M21 64 L60 64 L60 69 L21 69 Z" fill="{c[2]}" data-w="0.6"/>'
    s += box(4, 42, 76, 8, c, 'assise', d=(12, -9))
    s += f'<g data-teinte="{c[1]}" data-w="0.3" fill="none" stroke="#000"><path d="M12 39 Q40 37 70 38 M18 36 Q48 34 78 35"/></g>'
    s += '<path data-w="0" d="M10 41 L30 41 L34 38 L14 38 Z" fill="#F5E6C6"/>'
    s += hatch(70, 80, 2, 4, 4)
    return s


def tapis_rond():
    """Tapis rond tressé de chiffons: anneaux canard, crème, rouge, moutarde et sauge, tresse visible."""
    s = '<ellipse cx="48" cy="64" rx="44" ry="25" fill="#26282E" data-w="0"/>'
    s += '<ellipse id="t" cx="48" cy="61" rx="44" ry="25" fill="#2F6E73"/>'
    s += shade_clip('t', 'M66 34 Q88 80 18 92 L96 96 L96 34 Z', '#25392F')
    for rx, ry, col in ((37, 21, '#F3EDE0'), (30, 17, '#C5443D'), (23, 13, '#D4A33E'), (16, 9, '#96A98C'), (8, 4.6, '#C5443D')):
        s += f'<ellipse cx="48" cy="61" rx="{rx}" ry="{ry}" fill="{col}" data-w="0.32"/>'
    ticks = []
    for rx, ry in ((40.5, 23), (26.5, 15), (12, 6.8)):
        for i in range(14):
            a = i / 14 * math.tau
            x, y = 48 + rx * math.cos(a), 61 + ry * math.sin(a)
            ticks.append(f'M{x - 1.4:.1f} {y + 1.2:.1f} l2.8 -2.4')
    s += '<g data-teinte="#231A17" data-w="0.28" fill="none" stroke="#000"><path d="' + ' '.join(ticks) + '"/></g>'
    return s


def tapis_long():
    """Chemin de couloir tissé à bandes (crème, rouge, bleu, moutarde, sauge), franges aux deux bouts."""
    p0, p1, p3 = (6.0, 62.0), (66.0, 22.0), (28.0, 84.0)
    u = (p1[0] - p0[0], p1[1] - p0[1])
    v = (p3[0] - p0[0], p3[1] - p0[1])

    def at(t, w):
        return (p0[0] + u[0] * t + v[0] * w, p0[1] + u[1] * t + v[1] * w)

    def quad(t0, t1):
        return P([at(t0, 0), at(t1, 0), at(t1, 1), at(t0, 1)])

    s = f'<path id="chemin" d="{quad(0, 1)}" fill="#F3EDE0"/>'
    bands = ((0.1, 0.18, '#C5443D'), (0.22, 0.3, '#44618A'), (0.36, 0.64, '#96A98C'), (0.7, 0.78, '#44618A'), (0.82, 0.9, '#C5443D'), (0.45, 0.55, '#D4A33E'))
    for t0, t1, col in bands:
        s += f'<path data-clip="chemin" data-w="0" d="{quad(t0, t1)}" fill="{col}"/>'
    lines = ' '.join(f'M{at(t, 0)[0]:.1f} {at(t, 0)[1]:.1f} L{at(t, 1)[0]:.1f} {at(t, 1)[1]:.1f}' for t in (0.14, 0.26, 0.5, 0.74, 0.86))
    s += f'<g data-clip="chemin" data-teinte="#F3EDE0" data-w="0.28" fill="none" stroke="#000"><path d="{lines}"/></g>'
    fr = []
    n = (-u[0] / 12, -u[1] / 12)
    for t in (0, 1):
        sign = 1 if t == 0 else -1
        for k in range(6):
            x, y = at(t, (k + 0.5) / 6)
            fr.append(f'M{x:.1f} {y:.1f} l{n[0] * sign:.1f} {n[1] * sign:.1f}')
    s += '<g data-teinte="#F3EDE0" data-w="0.45" fill="none" stroke="#000"><path d="' + ' '.join(fr) + '"/></g>'
    return s


def _bocal(x, base, w, h, jam, cloth, check, uid):
    """Bocal de confiture plein, étiquette, couvercle de tissu à carreaux noué d'une ficelle."""
    l, r, t = x - w / 2, x + w / 2, base - h
    s = f'<path id="{uid}" d="M{l:g} {t + 4:g} Q{l:g} {t:g} {l + 4:g} {t:g} L{r - 4:g} {t:g} Q{r:g} {t:g} {r:g} {t + 4:g} L{r:g} {base - 4:g} Q{r:g} {base:g} {r - 4:g} {base:g} L{l + 4:g} {base:g} Q{l:g} {base:g} {l:g} {base - 4:g} Z" fill="{jam[0]}"/>'
    s += shade_clip(uid, f'M{x + 2:g} {t - 4:g} Q{r + 2:g} {base - 10:g} {x - 4:g} {base + 2:g} L{r + 4:g} {base + 4:g} L{r + 4:g} {t - 4:g} Z', jam[1])
    s += f'<path data-w="0" d="M{l + 2.5:g} {t + 6:g} L{l + 5:g} {t + 6:g} L{l + 5:g} {base - 6:g} L{l + 2.5:g} {base - 6:g} Z" fill="#F7F3EA"/>'
    s += f'<path d="M{l + 4:g} {t + h * 0.45:g} L{r - 4:g} {t + h * 0.45:g} L{r - 4:g} {t + h * 0.75:g} L{l + 4:g} {t + h * 0.75:g} Z" fill="#F5E6C6" data-w="0.35"/>'
    cid = uid + 't'
    s += f'<path id="{cid}" d="M{l - 3:g} {t + 4:g} Q{x:g} {t - 9:g} {r + 3:g} {t + 4:g} L{r + 1:g} {t + 7:g} L{r - 3:g} {t + 5:g} L{x:g} {t + 8:g} L{l + 3:g} {t + 5:g} L{l - 1:g} {t + 7:g} Z" fill="#F3EDE0"/>'
    s += f'<g data-clip="{cid}" data-teinte="{check}" data-w="0.4" fill="none" stroke="#000"><path d="M{l:g} {t - 6:g} L{l:g} {t + 8:g} M{x - 3:g} {t - 6:g} L{x - 3:g} {t + 8:g} M{x + 3:g} {t - 6:g} L{x + 3:g} {t + 8:g} M{r:g} {t - 6:g} L{r:g} {t + 8:g} M{l - 4:g} {t - 1:g} L{r + 4:g} {t - 1:g}"/></g>'
    s += f'<path d="M{l - 1:g} {t + 2.6:g} Q{x:g} {t + 4:g} {r + 1:g} {t + 2.6:g}" fill="none" stroke="#000" data-w="0.45"/>'
    return s


def bocaux_confiture():
    """Confitures de l'été: trois bocaux (fraise, abricot, mûre), couvercles de tissu à carreaux noués."""
    s = _bocal(48, 64, 24, 30, ('#7E3F55', '#45324F'), '#F3EDE0', '#44618A', 'b2')
    s += _bocal(25, 86, 26, 32, ('#C5443D', '#80292A'), '#F3EDE0', '#C5443D', 'b1')
    s += _bocal(71, 88, 24, 28, ('#D9822E', '#B8704E'), '#F3EDE0', '#6E9241', 'b3')
    return s


def _boite(x, base, w, h, c, uid, mark):
    """Boîte de fer peinte: corps cylindrique, couvercle de fer, étiquette de papier."""
    l, r = x - w / 2, x + w / 2
    s = f'<path id="{uid}" d="M{l:g} {base - h:g} L{r:g} {base - h:g} L{r:g} {base:g} Q{x:g} {base + 4:g} {l:g} {base:g} Z" fill="{c[0]}"/>'
    s += shade_clip(uid, f'M{x + w * 0.2:g} {base - h - 4:g} L{r + 4:g} {base - h - 4:g} L{r + 4:g} {base + 6:g} L{x + w * 0.2:g} {base + 6:g} Z', c[1])
    s += f'<path data-w="0" d="M{l + 2:g} {base - h + 6:g} L{l + 4.5:g} {base - h + 6:g} L{l + 4.5:g} {base - 3:g} L{l + 2:g} {base - 3:g} Z" fill="#F7F3EA"/>'
    s += f'<path d="M{l + 3:g} {base - h * 0.62:g} L{r - 3:g} {base - h * 0.62:g} L{r - 3:g} {base - h * 0.28:g} L{l + 3:g} {base - h * 0.28:g} Z" fill="#F5E6C6" data-w="0.4"/>'
    s += f'<g data-teinte="{mark}" data-w="0.4" fill="none" stroke="#000"><path d="M{l + 6:g} {base - h * 0.5:g} L{r - 6:g} {base - h * 0.5:g} M{l + 7:g} {base - h * 0.4:g} L{r - 8:g} {base - h * 0.4:g}"/></g>'
    s += f'<path d="M{l - 1:g} {base - h:g} L{r + 1:g} {base - h:g} L{r + 1:g} {base - h + 5:g} L{l - 1:g} {base - h + 5:g} Z" fill="{ZINC[1]}" data-w="0.45"/>'
    s += f'<ellipse cx="{x:g}" cy="{base - h:g}" rx="{w / 2 + 1:g}" ry="3.4" fill="{ZINC[0]}" data-w="0.5"/>'
    return s


def boites_provisions():
    """Boîtes de fer peintes: sucre (rouge), café (bleu), farine (crème), étiquettes de papier."""
    s = _boite(50, 66, 24, 34, ('#44618A', '#2C3B57'), 'b2', '#2C3B57')
    s += _boite(26, 86, 26, 44, ('#C5443D', '#80292A'), 'b1', '#80292A')
    s += _boite(72, 88, 24, 28, ('#F3EDE0', '#D9CAAE'), 'b3', '#A88C6C')
    return s


def pots_gres():
    """Pots de grès à saumure (vernis brun en haut) et leur cruche: on conserve à la cave."""
    g = GRES
    s = f'<path id="p1" d="M14 36 Q8 60 16 86 L46 86 Q54 60 48 36 Z" fill="{g[1]}"/>'
    s += shade_clip('p1', 'M36 30 Q52 60 38 92 L56 92 L56 30 Z', g[2])
    s += '<path data-clip="p1" data-w="0" d="M6 30 L56 30 L56 52 Q30 56 6 50 Z" fill="#8C5A35"/>'
    s += '<path data-clip="p1" data-w="0" d="M16 54 Q18 46 22 42 Q20 52 21 64 Z" fill="#EADDBE"/>'
    s += '<ellipse cx="31" cy="36" rx="17" ry="4.4" fill="#5E4233" data-w="0.6"/><ellipse cx="31" cy="36.6" rx="12" ry="2.6" fill="#4F3626" data-w="0"/>'
    s += f'<path id="p2" d="M48 56 Q44 72 50 88 L72 88 Q78 72 74 56 Z" fill="{g[1]}"/>'
    s += shade_clip('p2', 'M66 52 Q78 72 66 92 L82 92 L82 52 Z', g[2])
    s += '<path data-clip="p2" data-w="0" d="M44 52 L80 52 L80 66 Q60 70 44 66 Z" fill="#8C5A35"/>'
    s += '<ellipse cx="61" cy="56" rx="13" ry="3.4" fill="#5E4233" data-w="0.6"/><ellipse cx="61" cy="56.4" rx="9" ry="2" fill="#4F3626" data-w="0"/>'
    s += f'<path id="cruche" d="M72 60 Q66 46 72 36 L70 28 L84 28 L82 36 Q90 46 84 60 Q78 62 72 60 Z" fill="{g[0]}"/>'
    s += shade_clip('cruche', 'M80 26 Q92 44 80 64 L94 64 L94 26 Z', g[2])
    s += '<path data-clip="cruche" data-w="0" d="M66 24 L90 24 L90 38 Q78 40 66 38 Z" fill="#8C5A35"/>'
    s += '<path d="M70 29 L66 25 L72 27 Z" fill="#8C5A35" data-w="0.45"/>'
    s += '<path d="M84 34 Q92 38 86 50" fill="none" stroke="#000" data-w="0.6"/>'
    s += hatch(36, 80, 2, 4, 4)
    return s


def bouquet():
    """Bouquet des champs dans un vase de faïence bleue: coquelicots, ombelles blanches, boutons d'or."""
    f = FAIENCE
    s = '<g data-w="0.5" fill="none" stroke="#000"><path d="M46 54 Q38 36 28 22 M48 54 Q52 30 56 14 M48 54 Q60 40 70 30 M46 54 Q36 46 22 44 M50 54 Q62 50 74 50 M48 54 Q46 40 42 34"/></g>'
    for cx, cy in ((28, 22), (56, 14)):
        s += f'<path d="M{cx - 9} {cy} Q{cx - 9} {cy - 9} {cx} {cy - 8} Q{cx + 9} {cy - 9} {cx + 9} {cy} Q{cx + 8} {cy + 8} {cx} {cy + 7} Q{cx - 8} {cy + 8} {cx - 9} {cy} Z" fill="#C5443D" data-w="0.5"/>'
        s += f'<path data-w="0" d="M{cx + 1} {cy - 7} Q{cx + 8} {cy - 6} {cx + 8} {cy + 1} Q{cx + 4} {cy - 2} {cx + 1} {cy - 7} Z" fill="#E0675A"/>'
        s += f'<circle cx="{cx}" cy="{cy}" r="2.4" fill="#231A17" data-w="0"/>'
    for cx, cy in ((70, 30), (42, 34)):
        s += '<g data-w="0.4" fill="#F3EDE0">' + ''.join(f'<circle cx="{cx + dx}" cy="{cy + dy}" r="2.6"/>' for dx, dy in ((-5, 0), (0, -3), (5, 0), (-2.6, 3), (2.6, 3))) + '</g>'
    for cx, cy in ((22, 44), (74, 50)):
        s += f'<circle cx="{cx}" cy="{cy}" r="4.4" fill="#F2C55C" data-w="0.45"/><circle cx="{cx}" cy="{cy}" r="1.4" fill="#C0803A" data-w="0"/>'
    s += '<path d="M34 56 Q40 46 48 50 Q56 46 62 56 Q48 60 34 56 Z" fill="#6E9241" data-w="0.5"/>'
    s += f'<path id="vase" d="M38 90 Q28 76 35 64 Q40 58 39 54 L57 54 Q56 58 61 64 Q68 76 58 90 Z" fill="{f[1]}"/>'
    s += shade_clip('vase', 'M52 50 Q70 74 52 94 L80 94 L80 50 Z', f[2])
    s += shade_clip('vase', 'M37 70 Q39 64 44 61 Q41 68 41 78 Z', f[0])
    s += '<g data-clip="vase" data-teinte="#F3EDE0" data-w="0.35" fill="none" stroke="#000"><path d="M33 74 Q48 79 63 74 M40 82 L44 78 L48 82 L52 78 L56 82"/></g>'
    s += f'<ellipse cx="48" cy="54" rx="10" ry="2.4" fill="{f[0]}" data-w="0.45"/>'
    return s


def pile_livres():
    """Pile de livres: quatre reliures de couleurs, un peu de travers, dos titré d'or, tranches crème."""
    s = ''
    books = ((10, 76, 62, 9, ('#5E8A72', '#3F6453')), (16, 67, 56, 9, ('#C67A5E', '#8F3B34')), (8, 57, 60, 10, ('#A9C7D9', '#44618A')), (20, 48, 50, 9, ('#F2C55C', '#C0803A')))
    for i, (x, y, w, h, (lt, base)) in enumerate(books):
        uid = f'l{i}'
        s += box(x, y, w, h, (lt, base, '#F3EDE0'), uid, d=(12, -9))
        s += f'<g data-teinte="#A88C6C" data-w="0.28" fill="none" stroke="#000"><path d="M{x + w + 2} {y + h * 0.3:g} l9 -7 M{x + w + 2} {y + h * 0.7:g} l9 -7"/></g>'
        s += f'<g data-clip="{uid}" data-teinte="{LAITON}" data-w="0.4" fill="none" stroke="#000"><path d="M{x + 5} {y} L{x + 5} {y + h} M{x + w - 5} {y} L{x + w - 5} {y + h}"/></g>'
        s += f'<path d="M{x + w * 0.3:g} {y + h / 2 - 1.2:g} L{x + w * 0.62:g} {y + h / 2 - 1.2:g} L{x + w * 0.62:g} {y + h / 2 + 1.2:g} L{x + w * 0.3:g} {y + h / 2 + 1.2:g} Z" fill="{LAITON}" data-w="0"/>'
    return s


def journal():
    """Journal plié: titre en bandeau noir, colonnes imprimées, une gravure, un coin corné."""
    s = '<path id="page" d="M14 14 L80 10 L84 70 L72 84 L18 86 Z" fill="#F3EDE0"/>'
    s += shade_clip('page', 'M62 6 Q90 50 50 92 L96 96 L96 6 Z', '#D9CAAE')
    s += '<path d="M19 18 L75 15 L75 27 L19 30 Z" fill="#231A17" data-w="0.4"/>'
    s += '<g data-teinte="#F3EDE0" data-w="0.4" fill="none" stroke="#000"><path d="M26 23.6 L30 23.4 M33 23.2 L44 22.6 M47 22.4 L52 22.2 M55 22 L68 21.4"/></g>'
    s += '<path d="M21 34 L46 33 L46 50 L21 51 Z" fill="#B6A890" data-w="0.4"/>'
    s += '<path data-w="0" d="M22 50 L28 42 L32 46 L38 38 L45 49 Z" fill="#7C705F"/><circle cx="40" cy="37" r="2" fill="#F5E6C6" data-w="0"/>'
    rows = ' '.join(f'M21 {y} L45 {y - 0.6}' for y in (56, 61, 66, 71, 76, 81))
    rows += ' ' + ' '.join(f'M50 {y} L74 {y - 0.6}' for y in (36, 41, 46, 51, 56, 61, 66, 71))
    s += f'<g data-teinte="#4A4D52" data-w="0.32" fill="none" stroke="#000"><path d="{rows}"/></g>'
    s += '<path d="M48 33 L49 84" fill="none" stroke="#000" data-w="0.3"/>'
    s += '<path d="M84 70 L72 84 L70 72 Z" fill="#DDC59C" data-w="0.5"/>'
    return s


def corbeille_pain():
    """Corbeille d'osier ovale: une miche entaillée et un morceau de baguette à la mie claire."""
    o = OSIER
    s = f'<ellipse cx="48" cy="56" rx="38" ry="10" fill="{o[2]}" data-w="0.6"/>'
    s += '<path id="miche" d="M14 58 Q12 34 36 30 Q58 30 60 52 Q40 62 14 58 Z" fill="#C0803A"/>'
    s += shade_clip('miche', 'M44 26 Q66 40 50 64 L70 64 L70 26 Z', '#8C5A35')
    s += '<path data-clip="miche" data-w="0" d="M20 46 Q22 36 32 34 Q24 40 24 50 Z" fill="#E2C582"/>'
    s += '<g data-teinte="#F5E6C6" data-w="0.45" fill="none" stroke="#000"><path d="M26 40 Q34 36 40 42 M30 50 Q40 44 48 50"/></g>'
    s += '<path id="baguette" d="M44 52 L76 30 Q84 28 86 34 Q86 38 80 42 L54 60 Z" fill="#D4A33E"/>'
    s += shade_clip('baguette', 'M50 62 L86 38 L90 40 L56 66 Z', '#8E6A26')
    s += '<g data-teinte="#F5E6C6" data-w="0.4" fill="none" stroke="#000"><path d="M60 44 L66 44 M68 38 L74 38 M76 33 L80 33"/></g>'
    s += '<ellipse cx="48" cy="56" rx="5" ry="6" fill="#F5E6C6" data-w="0.45"/>'
    s += f'<path id="corbeille" d="M10 56 Q48 68 86 56 L80 80 Q48 92 16 80 Z" fill="{o[1]}"/>'
    s += shade_clip('corbeille', 'M62 50 Q80 74 40 94 L96 96 L96 50 Z', o[2])
    s += f'<g data-clip="corbeille" data-teinte="{o[2]}" data-w="0.32" fill="none" stroke="#000"><path d="M12 66 Q48 78 84 66 M14 74 Q48 86 82 74 M24 62 L22 86 M36 65 L35 90 M48 66 L48 92 M60 65 L61 90 M72 62 L74 86"/></g>'
    s += f'<path d="M10 56 Q48 68 86 56 L86 60 Q48 72 10 60 Z" fill="{o[0]}" data-w="0.5"/>'
    return s


def panier_linge():
    """Panier à linge d'osier à anse: draps et torchons pliés qui dépassent."""
    o = OSIER
    s = f'<path d="M20 46 Q18 8 48 8 Q78 8 76 46 L70 46 Q72 15 48 15 Q24 15 26 46 Z" fill="{o[1]}" data-w="0.7"/>'
    s += f'<ellipse cx="48" cy="46" rx="30" ry="7" fill="{o[2]}" data-w="0.5"/>'
    s += '<path d="M24 46 Q28 34 42 36 Q50 32 58 38 L58 48 Q40 52 24 48 Z" fill="#F7F3EA" data-w="0.5"/>'
    s += '<path data-w="0" d="M44 38 Q52 36 57 40 L57 47 Q50 48 46 48 Z" fill="#D9CAAE"/>'
    s += '<path d="M48 44 Q58 34 72 40 L72 48 Q60 52 48 50 Z" fill="#CC9C96" data-w="0.5"/>'
    s += '<g data-teinte="#9A7066" data-w="0.3" fill="none" stroke="#000"><path d="M56 42 Q62 40 68 42"/></g>'
    s += f'<path id="panier" d="M18 46 Q48 58 78 46 L70 86 Q48 94 26 86 Z" fill="{o[1]}"/>'
    s += shade_clip('panier', 'M58 40 Q76 70 44 96 L96 96 L96 40 Z', o[2])
    s += f'<g data-clip="panier" data-teinte="{o[2]}" data-w="0.32" fill="none" stroke="#000"><path d="M18 58 Q48 70 78 58 M20 70 Q48 82 76 70 M22 80 Q48 92 74 80 M30 52 L32 90 M40 54 L41 92 M50 55 L50 92 M60 54 L59 92 M70 51 L66 88"/></g>'
    s += f'<path d="M18 46 Q48 58 78 46 L78 51 Q48 63 18 51 Z" fill="{o[0]}" data-w="0.5"/>'
    return s


def lumignon():
    """Lumignon des fêtes: suif coulé dans une coquille d'œuf, posé sur une soucoupe de terre, flamme allumée."""
    t = CUIVRE
    s = f'<path id="soucoupe" d="M12 76 Q12 90 48 91 Q84 90 84 76 Z" fill="{t[1]}"/>'
    s += shade_clip('soucoupe', 'M60 70 Q78 84 48 96 L96 96 L96 70 Z', t[2])
    s += f'<ellipse cx="48" cy="76" rx="36" ry="9" fill="{t[0]}" data-w="0.6"/>'
    s += f'<ellipse cx="48" cy="77" rx="27" ry="6" fill="{t[1]}" data-w="0.35"/>'
    s += '<path id="coquille" d="M30 76 Q25 58 32 47 L36 50 L40 44 L45 49 L50 43 L55 49 L60 44 L63 49 Q71 58 66 76 Q48 84 30 76 Z" fill="#F5E6C6"/>'
    s += shade_clip('coquille', 'M56 40 Q74 60 56 84 L80 84 L80 40 Z', '#DDC59C')
    s += '<path data-clip="coquille" data-w="0" d="M33 64 Q33 56 37 52 Q36 60 37 70 Z" fill="#F7F3EA"/>'
    s += '<g data-w="0" fill="#C7A877"><circle cx="44" cy="64" r="0.9"/><circle cx="54" cy="70" r="0.8"/><circle cx="58" cy="60" r="0.9"/></g>'
    s += '<path d="M35 49 Q48 54 61 49 Q55 46 48 46.6 Q41 46 35 49 Z" fill="#FFE6B0" data-w="0.35"/>'
    s += '<path d="M48 48 L48 40" fill="none" stroke="#000" data-w="0.4"/>'
    s += '<path d="M48 41 Q41 31 48 14 Q55 31 48 41 Z" fill="#FFC264" data-w="0.45"/>'
    s += '<path data-w="0" d="M48 38 Q45 32 48 24 Q51 32 48 38 Z" fill="#FFE6B0"/>'
    return s


INTERIEURS = {
    'lampe-de-table': ('Lampe de table: pied de faïence bleue, tige de laiton, abat-jour de tissu allumé.', lampe_table),
    'lampe-a-petrole': ('Lampe à pétrole: pied de laiton, réservoir de verre (on voit le pétrole), clé de mèche, verre de lampe où brûle la flamme.', lampe_petrole),
    'horloge-murale': ('Horloge murale (régulateur): lunette de noyer, cadran d\'émail cerclé de laiton, caisse vitrée, balancier.', horloge_murale),
    'pendule': ('Pendule de cheminée: socle à pieds de laiton, corps de noyer en chapelle, fronton, épi, cadran d\'émail.', pendule),
    'cadre-ovale': ('Cadre ovale: médaillon doré suspendu, portrait d\'un aïeul à moustache, col blanc, fond ardoise.', cadre_ovale),
    'cadre-portrait': ('Cadre portrait: cadre de noyer en hauteur, une femme en buste à chignon, robe rouge, fond vert sombre.', cadre_portrait),
    'cadre-paysage': ('Cadre paysage: cadre de noyer en largeur, ciel, coteau, le clocher du bourg et une maison.', cadre_paysage),
    'etagere-murale': ('Étagère murale: planche sur deux consoles, deux confitures, deux livres debout, un pichet de grès.', etagere_murale),
    'patere': ('Patère: planche à quatre crochets de laiton, un manteau brun, une veste bleue, un chapeau de feutre.', patere),
    'rideau-de-porte': ('Rideau de porte: rideau rouge plissé sur sa tringle de laiton, retenu de côté par une embrasse moutarde.', rideau_de_porte),
    'vaisselier': ('Vaisselier: buffet bas à deux portes, deux étagères d\'assiettes debout et un bol, corniche.', vaisselier),
    'poele': ('Poêle: fonte sur quatre pieds, porte vitrée où danse le feu, bouilloire de cuivre, tuyau qui monte.', poele),
    'buches-d-interieur': ('Bûches d\'intérieur: rangées trois, deux, une, sections claires à cernes vers la pièce.', buches),
    'caisse-de-legumes': ('Caisse de légumes: cagette à claire-voie, deux choux, des pommes de terre, des carottes et leurs fanes.', caisse_legumes),
    'tonnelet': ('Tonnelet: couché sur son chantier, douelles, deux cercles de fer, robinet de laiton.', tonnelet),
    'seau': ('Seau: zinc à deux cerclages, anse de fer, eau dedans.', seau),
    'balai': ('Balai: balai de paille, manche de bois clair, ligatures rouges.', balai),
    'tabouret-de-ferme': ('Tabouret de ferme: assise ronde épaisse (cernes, fente), trois pieds écartés, bois naturel.', tabouret_ferme),
    'banc-de-table': ('Banc de table: longue planche sur deux tréteaux pleins, entretoise.', banc_de_table),
    'tapis-rond': ('Tapis rond: tapis tressé de chiffons, anneaux canard, crème, rouge, moutarde et sauge.', tapis_rond),
    'tapis-long': ('Tapis long: chemin de couloir tissé à bandes, franges aux deux bouts.', tapis_long),
    'bocaux-de-confiture': ('Bocaux de confiture: mûre, fraise et abricot, couvercles de tissu à carreaux noués, étiquettes.', bocaux_confiture),
    'boites-a-provisions': ('Boîtes à provisions: boîtes de fer peintes rouge, bleue et crème, couvercles de fer, étiquettes.', boites_provisions),
    'pots-de-gres': ('Pots de grès: deux pots à saumure vernis brun en haut, une cruche.', pots_gres),
    'bouquet': ('Bouquet: vase de faïence bleue, coquelicots, ombelles blanches, boutons d\'or et feuillage.', bouquet),
    'pile-de-livres': ('Pile de livres: quatre reliures de couleurs un peu de travers, filets d\'or, tranches crème.', pile_livres),
    'journal': ('Journal: feuille imprimée, titre en bandeau noir, une gravure, des colonnes, un coin corné.', journal),
    'corbeille-de-pain': ('Corbeille de pain: corbeille d\'osier ovale, une miche entaillée, un morceau de baguette.', corbeille_pain),
    'panier-a-linge': ('Panier à linge: panier d\'osier à anse, drap blanc et torchon rose pliés.', panier_linge),
    'lumignon': ('Lumignon des fêtes: coquille d\'œuf remplie de suif sur une soucoupe de terre cuite, flamme allumée.', lumignon),
}
ALL |= INTERIEURS

ROT = {'banc': -3, 'tapis-essai': -4, 'balai': 16, 'pile-de-livres': -3, 'journal': 7, 'pendule': -3, 'tonnelet': -3, 'cadre-paysage': -2, 'cadre-portrait': 2}
for name in (sys.argv[1].split(',') if len(sys.argv) > 1 else ALL):
    comment, fn = ALL[name]
    write(name, comment, fn(), ROT.get(name, 0))
    print(name)
