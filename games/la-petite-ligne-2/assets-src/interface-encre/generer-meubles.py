"""Écrit les sources des vignettes de meubles (`vignettes/<id>.svg`), toutes dans la même
projection de trois quarts: dessus clair, face avant au ton de base, côté droit dans l'ombre
(lumière en haut à gauche). Ces sources sont générées: modifier ce script, pas les SVG.

    python3 assets-src/interface-encre/generer-meubles.py [id,id,...]
    NODE_PATH=/opt/node-tools/node_modules node assets-src/interface-encre/generer-images.mjs vignettes <id,id>

Ajouter un meuble: une fonction de dessin (copier la plus proche, `box()` pour les caisses) et une
ligne dans `ALL` (identifiant du meuble, description, fonction). Variante de couleur: passer un
autre trio de tons (`MIEL`, `SAUGE`...).
"""
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

ROT = {'banc': -3, 'tapis-essai': -4}
for name in (sys.argv[1].split(',') if len(sys.argv) > 1 else ALL):
    comment, fn = ALL[name]
    write(name, comment, fn(), ROT.get(name, 0))
    print(name)
