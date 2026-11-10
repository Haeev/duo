"""Planches 04 à 06 de la bible artistique 0.2 (rendu « bande dessinée encrée »).

Lancer: python3 planches_v02.py <dossier de sortie> (voir construire.sh, qui passe ensuite les SVG en PNG).
Cotes en mètres, vues de face. Couleurs: nuancier-v02.json (seule source de la 0.2). Contours irréguliers: filtre de déplacement `rough`.
Les échantillons de matière sont rendus à leur vraie résolution de texture (rsvg-convert), puis
incrustés agrandis dans la planche 06: on y voit l'épaisseur réelle des traits d'encre vus de très près.
"""
import base64
import json
import math
import os
import random
import subprocess
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
_RAW = json.load(open(os.path.join(HERE, "nuancier-v02.json")))
N = {k: dict(v) for k, v in _RAW.items() if isinstance(v, list)}
LIEUX = _RAW["lieux"]
INK = "#231A17"
PAPER = "#F3EEE4"
FONT = "DejaVu Sans"


def text(x, y, t, size=15, weight="normal", anchor="middle", fill=INK, extra=""):
    return f'<text x="{x:.1f}" y="{y:.1f}" font-family="{FONT}" font-size="{size}" font-weight="{weight}" text-anchor="{anchor}" fill="{fill}" {extra}>{t}</text>'


def svg(w, h, body, defs=""):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="{w}" height="{h}" viewBox="0 0 {w} {h}">'
            f'<defs><filter id="rough" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency="0.045" numOctaves="2" seed="5" result="t"/>'
            f'<feDisplacementMap in="SourceGraphic" in2="t" scale="3.2" xChannelSelector="R" yChannelSelector="G"/></filter>{defs}</defs><rect width="{w}" height="{h}" fill="{PAPER}"/>{body}</svg>')


def fr(v, d=2):
    return f"{v:.{d}f}".replace(".", ",")


def lstar(h):
    c = [int(h[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    c = [x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c]
    y = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
    return 116 * (y ** (1 / 3) if y > (6 / 29) ** 3 else y / (3 * (6 / 29) ** 2) + 4 / 29) - 16


def shade(h, f):
    """Assombrit (f < 1) ou éclaircit (f > 1) une teinte, pour les ombres peintes des schémas."""
    c = [int(h[i:i + 2], 16) for i in (1, 3, 5)]
    if f <= 1:
        c = [round(x * f) for x in c]
    else:
        c = [round(x + (255 - x) * (f - 1)) for x in c]
    return "#" + "".join(f"{max(0, min(255, x)):02X}" for x in c)


# ---------------------------------------------------------------- gabarits (planche 04)
# H: sommet du crâne; hh, hw: tête (haut, large); sh: carrure aux deltoïdes; ch, wa, hi: poitrine, taille, bassin;
# ua: bras; th: cuisse; cr, wy: entrejambe et taille (hauteurs).
BODIES = [
    dict(id="adult-f-slim", nom="Femme mince", H=1.66, hh=0.245, hw=0.175, sh=0.37, ch=0.30, wa=0.255, hi=0.345, ua=0.078, th=0.145, cr=0.77, wy=1.03, f=1),
    dict(id="adult-f-medium", nom="Femme moyenne", H=1.66, hh=0.245, hw=0.177, sh=0.39, ch=0.33, wa=0.29, hi=0.38, ua=0.086, th=0.162, cr=0.77, wy=1.03, f=1),
    dict(id="adult-m-medium", nom="Homme moyen", H=1.76, hh=0.255, hw=0.182, sh=0.45, ch=0.38, wa=0.33, hi=0.355, ua=0.096, th=0.165, cr=0.82, wy=1.08, f=0),
    dict(id="adult-m-round", nom="Homme rond", H=1.76, hh=0.255, hw=0.188, sh=0.48, ch=0.45, wa=0.46, hi=0.44, ua=0.112, th=0.19, cr=0.82, wy=1.08, f=0),
    dict(id="child-medium", nom="Enfant (8 à 10 ans)", H=1.30, hh=0.222, hw=0.165, sh=0.30, ch=0.25, wa=0.235, hi=0.26, ua=0.064, th=0.118, cr=0.58, wy=0.77, f=0, child=1),
    dict(id="elder-f-medium", nom="Âgée moyenne", H=1.59, hh=0.24, hw=0.176, sh=0.37, ch=0.34, wa=0.33, hi=0.39, ua=0.085, th=0.16, cr=0.72, wy=0.97, f=1, elder=1),
    dict(id="elder-m-slim", nom="Âgé mince", H=1.68, hh=0.25, hw=0.18, sh=0.41, ch=0.34, wa=0.32, hi=0.34, ua=0.08, th=0.145, cr=0.78, wy=1.03, f=0, elder=1),
]

ZONES = {  # couleurs de schéma des zones de texture (lisibles en niveaux de gris par la clarté, pas seulement la teinte)
    "visage": "#F2C9A8", "peau": "#DDB28F", "cheveux": "#5E4632", "haut": "#7FA3C2",
    "bas": "#3F5872", "chaussures": "#2F2A28", "geo": "#C9A24E",
}


def body_parts(b, X, Y, s):
    """Contours d'un corps de face; renvoie un dict de chemins SVG par zone."""
    H, hh, hw = b["H"], b["hh"], b["hw"]
    chin = H - hh
    neck_top = chin + 0.02
    shy = H - hh - 0.065 - (0.012 if b.get("elder") else 0)
    sh2, ch2, wa2, hi2 = b["sh"] / 2, b["ch"] / 2, b["wa"] / 2, b["hi"] / 2
    cr, wy = b["cr"], b["wy"]
    knee, ankle = 0.285 * H, 0.085
    p = {}
    # jambes
    legs = []
    for sd in (-1, 1):
        t2 = max(b["th"] / 2, hi2 * 0.5)
        cx = sd * (hi2 - t2) * 0.98
        k2, a2 = b["th"] * 0.34, b["th"] * 0.24
        pts = [(cx - t2, cr + 0.06), (cx - k2 - 0.006, knee), (cx - k2 * 1.1, knee - 0.12), (cx - a2, ankle),
               (cx + a2, ankle), (cx + k2 * 1.05, knee - 0.12), (cx + k2, knee), (cx + t2 * 0.92, cr - 0.01)]
        legs.append("M" + " L".join(f"{X(x):.1f},{Y(y):.1f}" for x, y in pts) + " Z")
    p["legs"] = legs
    # chaussures
    shoes = []
    for sd in (-1, 1):
        cx = sd * (hi2 - max(b["th"] / 2, hi2 * 0.5)) * 0.98 + sd * 0.01
        w = 0.105 if not b.get("child") else 0.085
        shoes.append(f'M{X(cx - w / 2):.1f},{Y(0):.1f} L{X(cx + w / 2):.1f},{Y(0):.1f} Q{X(cx + w / 2 + 0.01):.1f},{Y(0.07):.1f} {X(cx + w * 0.3):.1f},{Y(0.105):.1f} L{X(cx - w * 0.3):.1f},{Y(0.105):.1f} Q{X(cx - w / 2 - 0.01):.1f},{Y(0.07):.1f} {X(cx - w / 2):.1f},{Y(0):.1f} Z')
    p["shoes"] = shoes
    # bassin (bas) et torse (haut)
    p["pelvis"] = (f'M{X(-wa2):.1f},{Y(wy):.1f} C{X(-hi2 * 1.02):.1f},{Y(wy - 0.1):.1f} {X(-hi2):.1f},{Y(cr + 0.05):.1f} {X(-hi2 * 0.9):.1f},{Y(cr - 0.01):.1f} '
                   f'L{X(0):.1f},{Y(cr + 0.01):.1f} L{X(hi2 * 0.9):.1f},{Y(cr - 0.01):.1f} C{X(hi2):.1f},{Y(cr + 0.05):.1f} {X(hi2 * 1.02):.1f},{Y(wy - 0.1):.1f} {X(wa2):.1f},{Y(wy):.1f} Z')
    chest_y = shy - 0.17
    p["torso"] = (f'M{X(-0.05):.1f},{Y(shy + 0.03):.1f} C{X(-sh2 * 0.7):.1f},{Y(shy + 0.03):.1f} {X(-sh2):.1f},{Y(shy + 0.01):.1f} {X(-sh2):.1f},{Y(shy - 0.07):.1f} '
                  f'C{X(-ch2 * 1.02):.1f},{Y(chest_y + 0.06):.1f} {X(-ch2):.1f},{Y(chest_y - 0.04):.1f} {X(-wa2):.1f},{Y(wy):.1f} '
                  f'L{X(wa2):.1f},{Y(wy):.1f} C{X(ch2):.1f},{Y(chest_y - 0.04):.1f} {X(ch2 * 1.02):.1f},{Y(chest_y + 0.06):.1f} {X(sh2):.1f},{Y(shy - 0.07):.1f} '
                  f'C{X(sh2):.1f},{Y(shy + 0.01):.1f} {X(sh2 * 0.7):.1f},{Y(shy + 0.03):.1f} {X(0.05):.1f},{Y(shy + 0.03):.1f} Z')
    # bras le long du corps, légèrement écartés
    arms, hands = [], []
    wrist_y = cr + 0.02
    for sd in (-1, 1):
        x0 = sd * (sh2 - b["ua"] * 0.45)
        x1 = sd * (max(hi2, wa2) + b["ua"] * 0.55)
        u2, e2, w2 = b["ua"] / 2, b["ua"] * 0.4, b["ua"] * 0.3
        ey = (shy + wrist_y) / 2 + 0.02
        xe = (x0 + x1) / 2 + sd * 0.01
        pts = [(x0 - sd * u2, shy - 0.06), (xe - sd * e2, ey), (x1 - sd * w2, wrist_y), (x1 + sd * w2, wrist_y), (xe + sd * e2, ey), (x0 + sd * u2, shy - 0.005)]
        arms.append("M" + " L".join(f"{X(x):.1f},{Y(y):.1f}" for x, y in pts) + " Z")
        hl = 0.185 * (0.82 if b.get("child") else 1)
        hands.append(f'M{X(x1 - w2):.1f},{Y(wrist_y):.1f} C{X(x1 - w2 * 1.6):.1f},{Y(wrist_y - hl * 0.5):.1f} {X(x1 - w2 * 0.6):.1f},{Y(wrist_y - hl):.1f} {X(x1 + sd * 0.0):.1f},{Y(wrist_y - hl):.1f} '
                     f'C{X(x1 + w2 * 0.6):.1f},{Y(wrist_y - hl):.1f} {X(x1 + w2 * 1.6):.1f},{Y(wrist_y - hl * 0.5):.1f} {X(x1 + w2):.1f},{Y(wrist_y):.1f} Z')
    p["arms"], p["hands"], p["wrist_y"] = arms, hands, wrist_y
    p["neck"] = f'M{X(-0.055):.1f},{Y(neck_top):.1f} L{X(0.055):.1f},{Y(neck_top):.1f} L{X(0.062):.1f},{Y(shy + 0.02):.1f} L{X(-0.062):.1f},{Y(shy + 0.02):.1f} Z'
    # tête en œuf, plus large en haut, oreilles à hauteur des yeux
    hx, top = hw / 2, H
    p["head"] = (f'M{X(0):.1f},{Y(top):.1f} C{X(hx * 1.12):.1f},{Y(top):.1f} {X(hx * 1.05):.1f},{Y(chin + hh * 0.42):.1f} {X(hx * 0.86):.1f},{Y(chin + hh * 0.2):.1f} '
                 f'C{X(hx * 0.6):.1f},{Y(chin + 0.01):.1f} {X(hx * 0.25):.1f},{Y(chin):.1f} {X(0):.1f},{Y(chin):.1f} '
                 f'C{X(-hx * 0.25):.1f},{Y(chin):.1f} {X(-hx * 0.6):.1f},{Y(chin + 0.01):.1f} {X(-hx * 0.86):.1f},{Y(chin + hh * 0.2):.1f} '
                 f'C{X(-hx * 1.05):.1f},{Y(chin + hh * 0.42):.1f} {X(-hx * 1.12):.1f},{Y(top):.1f} {X(0):.1f},{Y(top):.1f} Z')
    p["ears"] = [f'<ellipse cx="{X(sd * hx * 0.98):.1f}" cy="{Y(chin + hh * 0.48):.1f}" rx="{0.018 * s:.1f}" ry="{0.03 * s:.1f}"' for sd in (-1, 1)]
    p["face_box"] = (X(-hx * 0.78), Y(chin + hh * 0.78), hx * 1.56 * s, hh * 0.78 * s)
    p["eyes_y"] = chin + hh * 0.5
    p["shy"], p["chin"] = shy, chin
    return p


def hair_path(b, X, Y, style):
    H, hh, hw = b["H"], b["hh"], b["hw"]
    hx, chin = hw / 2 + 0.012, H - hh
    top = H + 0.03
    if style == "court":
        return (f'M{X(-hx):.1f},{Y(chin + hh * 0.52):.1f} C{X(-hx * 1.1):.1f},{Y(top + 0.01):.1f} {X(hx * 1.1):.1f},{Y(top + 0.01):.1f} {X(hx):.1f},{Y(chin + hh * 0.52):.1f} '
                f'C{X(hx * 0.7):.1f},{Y(chin + hh * 0.8):.1f} {X(-hx * 0.2):.1f},{Y(chin + hh * 0.86):.1f} {X(-hx):.1f},{Y(chin + hh * 0.52):.1f} Z')
    if style == "carre":
        return (f'M{X(-hx * 1.08):.1f},{Y(chin + 0.02):.1f} C{X(-hx * 1.25):.1f},{Y(top + 0.02):.1f} {X(hx * 1.25):.1f},{Y(top + 0.02):.1f} {X(hx * 1.08):.1f},{Y(chin + 0.02):.1f} '
                f'L{X(hx * 0.82):.1f},{Y(chin + 0.03):.1f} C{X(hx * 0.8):.1f},{Y(chin + hh * 0.6):.1f} {X(hx * 0.6):.1f},{Y(chin + hh * 0.72):.1f} {X(0):.1f},{Y(chin + hh * 0.7):.1f} '
                f'C{X(-hx * 0.6):.1f},{Y(chin + hh * 0.72):.1f} {X(-hx * 0.8):.1f},{Y(chin + hh * 0.6):.1f} {X(-hx * 0.82):.1f},{Y(chin + 0.03):.1f} Z')
    if style == "chignon":
        return (f'M{X(-hx):.1f},{Y(chin + hh * 0.55):.1f} C{X(-hx * 1.1):.1f},{Y(top):.1f} {X(hx * 1.1):.1f},{Y(top):.1f} {X(hx):.1f},{Y(chin + hh * 0.55):.1f} '
                f'C{X(hx * 0.6):.1f},{Y(chin + hh * 0.84):.1f} {X(-hx * 0.6):.1f},{Y(chin + hh * 0.84):.1f} {X(-hx):.1f},{Y(chin + hh * 0.55):.1f} Z '
                f'M{X(-0.05):.1f},{Y(top - 0.005):.1f} a{0.05 * 300:.1f},{0.045 * 300:.1f} 0 1 1 0,0.1 Z')
    return ""


def figure(cx, gy, s, b, mode="zones", hair="court", extras=()):
    X = lambda x: cx + x * s
    Y = lambda y: gy - y * s
    p = body_parts(b, X, Y, s)
    st = f'stroke="{INK}" stroke-width="{max(1.6, s * 0.0085):.1f}" stroke-linejoin="round"'
    o = [f'<ellipse cx="{cx}" cy="{gy + 2}" rx="{b["hi"] * s * 0.8:.1f}" ry="{s * 0.03:.1f}" fill="#000" opacity="0.12"/>']
    if mode == "zones":
        top, bot, shoe, skin, hairc = ZONES["haut"], ZONES["bas"], ZONES["chaussures"], ZONES["peau"], ZONES["cheveux"]
        topfill = botfill = None
    else:  # pyjama à carreaux
        top, bot, shoe, skin, hairc = "url(#vichy)", "url(#vichy)", N["tissus"]["brique"], N["peaux"]["miel"], N["cheveux"]["chatain"]
    o += [f'<path d="{d}" fill="{bot}" {st}/>' for d in p["legs"]]
    o += [f'<path d="{d}" fill="{shoe}" {st}/>' for d in p["shoes"]]
    o += [f'<path d="{d}" fill="{top}" {st}/>' for d in p["arms"]]
    o += [f'<path d="{d}" fill="{skin}" {st}/>' for d in p["hands"]]
    o.append(f'<path d="{p["pelvis"]}" fill="{bot}" {st}/>')
    o.append(f'<path d="{p["torso"]}" fill="{top}" {st}/>')
    o.append(f'<path d="{p["neck"]}" fill="{skin}" {st}/>')
    o += [f'{e} fill="{skin}" {st}/>' for e in p["ears"]]
    o.append(f'<path d="{p["head"]}" fill="{skin}" {st}/>')
    fx, fy, fw, fh = p["face_box"]
    if mode == "zones":
        o.append(f'<rect x="{fx:.1f}" y="{fy:.1f}" width="{fw:.1f}" height="{fh:.1f}" rx="{fw * 0.3:.1f}" fill="{ZONES["visage"]}" stroke="{INK}" stroke-width="1" stroke-dasharray="3 2"/>')
    # traits peints simplifiés
    ey = Y(p["eyes_y"])
    ew = b["hw"] * 0.2 * s
    for sd in (-1, 1):
        ex = X(sd * b["hw"] * 0.22)
        o.append(f'<ellipse cx="{ex:.1f}" cy="{ey:.1f}" rx="{ew / 2:.1f}" ry="{ew * 0.28:.1f}" fill="{N["fixes"]["blanc_oeil"]}"/>')
        o.append(f'<circle cx="{ex:.1f}" cy="{ey:.1f}" r="{ew * 0.24:.1f}" fill="{N["iris"]["noisette"]}"/>')
        o.append(f'<path d="M{ex - ew * 0.55:.1f},{ey - ew * 0.05:.1f} Q{ex:.1f},{ey - ew * 0.45:.1f} {ex + ew * 0.55:.1f},{ey - ew * 0.05:.1f}" fill="none" stroke="{INK}" stroke-width="1.2"/>')
        o.append(f'<path d="M{ex - ew * 0.5:.1f},{ey - ew * 0.75:.1f} Q{ex:.1f},{ey - ew * 0.95:.1f} {ex + ew * 0.55:.1f},{ey - ew * 0.7:.1f}" fill="none" stroke="{hairc if mode != "zones" else INK}" stroke-width="{max(1.5, ew * 0.18):.1f}" stroke-linecap="round"/>')
    my = Y(p["chin"] + b["hh"] * 0.22)
    o.append(f'<path d="M{cx - ew * 0.6:.1f},{my:.1f} Q{cx:.1f},{my + ew * 0.25:.1f} {cx + ew * 0.6:.1f},{my:.1f}" fill="none" stroke="{INK}" stroke-width="1.6" stroke-linecap="round"/>')
    o.append(f'<path d="M{cx - ew * 0.12:.1f},{Y(p["chin"] + b["hh"] * 0.34):.1f} q{ew * 0.12:.1f},{ew * 0.12:.1f} {ew * 0.24:.1f},0" fill="none" stroke="{shade(skin if skin.startswith("#") else "#C0906A", 0.75)}" stroke-width="1.2"/>')
    hp = hair_path(b, X, Y, hair)
    if hp:
        o.append(f'<path d="{hp}" fill="{hairc}" {st}/>')
    if mode == "pyjama":
        # plis et coutures peints dans la texture: coudes, genoux, taille, emmanchures, patte de boutonnage
        shy = p["shy"]
        for sd in (-1, 1):
            xe = X(sd * (b["sh"] / 2 + 0.02))
            o.append(f'<path d="M{xe - sd * 6:.1f},{Y(shy - 0.33):.1f} q{sd * 5:.1f},4 {sd * 9:.1f},2 M{xe - sd * 7:.1f},{Y(shy - 0.36):.1f} q{sd * 6:.1f},3 {sd * 10:.1f},1" fill="none" stroke="{shade(N["tissus"]["bleu_de_travail"], 0.7)}" stroke-width="1.4" opacity="0.8"/>')
            kx = X(sd * (b["hi"] / 2 - max(b["th"] / 2, b["hi"] / 4)) * 0.98)
            o.append(f'<path d="M{kx - 8:.1f},{Y(0.5):.1f} q8,5 16,0 M{kx - 7:.1f},{Y(0.46):.1f} q7,4 14,0" fill="none" stroke="{shade(N["tissus"]["bleu_de_travail"], 0.7)}" stroke-width="1.4" opacity="0.8"/>')
            o.append(f'<line x1="{X(sd * b["sh"] / 2 * 0.86):.1f}" y1="{Y(shy + 0.005):.1f}" x2="{X(sd * b["sh"] / 2 * 0.78):.1f}" y2="{Y(shy - 0.17):.1f}" stroke="{INK}" stroke-width="1" stroke-dasharray="2 2" opacity="0.7"/>')
        o.append(f'<line x1="{cx:.1f}" y1="{Y(shy + 0.02):.1f}" x2="{cx:.1f}" y2="{Y(b["wy"] - 0.12):.1f}" stroke="{N["tissus"]["craie"]}" stroke-width="4"/>')
        o.append(f'<line x1="{cx:.1f}" y1="{Y(shy + 0.02):.1f}" x2="{cx:.1f}" y2="{Y(b["wy"] - 0.12):.1f}" stroke="{INK}" stroke-width="0.8" stroke-dasharray="2 2"/>')
        for i in range(4):
            o.append(f'<circle cx="{cx:.1f}" cy="{Y(shy - 0.04 - i * 0.1):.1f}" r="2.6" fill="{N["tissus"]["craie"]}" stroke="{INK}" stroke-width="1.5"/>')
        o.append(f'<path d="M{X(-b["wa"] / 2):.1f},{Y(b["wy"] - 0.12):.1f} L{X(b["wa"] / 2):.1f},{Y(b["wy"] - 0.12):.1f}" stroke="{INK}" stroke-width="1" stroke-dasharray="3 2"/>')
        o.append(f'<path d="M{X(-0.06):.1f},{Y(shy + 0.03):.1f} L{cx:.1f},{Y(shy - 0.05):.1f} L{X(0.06):.1f},{Y(shy + 0.03):.1f}" fill="{N["peaux"]["miel"]}" stroke="{INK}" stroke-width="1"/>')
    for e in extras:
        o.append(e(X, Y, p, b))
    # ombre propre: aplat froid sur le côté opposé à la lumière (venue de gauche), bord net, puis 3 à 5 hachures
    sil = p["legs"] + p["shoes"] + p["arms"] + p["hands"] + [p["pelvis"], p["torso"], p["neck"], p["head"]]
    cid = f"c{abs(hash((cx, gy, b['id'], mode))) % 10 ** 8}"
    o.append(f'<clipPath id="{cid}">' + "".join(f'<path d="{d}"/>' for d in sil) + '</clipPath>')
    xs0 = cx + b["sh"] * s * 0.12
    o.append(f'<g clip-path="url(#{cid})"><path d="M{xs0:.1f},{Y(b["H"] + 0.1):.1f} L{cx + s:.1f},{Y(b["H"] + 0.1):.1f} L{cx + s:.1f},{gy:.1f} L{xs0 + s * 0.05:.1f},{gy:.1f} Z" fill="#2A2140" opacity="0.30"/>')
    for k in range(4):
        hy = Y(p["shy"] - 0.25 - k * 0.035)
        o.append(f'<line x1="{xs0 - 3 - k * 2:.1f}" y1="{hy:.1f}" x2="{xs0 + 7 - k * 2:.1f}" y2="{hy - 9:.1f}" stroke="{INK}" stroke-width="1.6" stroke-linecap="round"/>')
    o.append('</g>')
    o.append(f'<path d="M{cx - b["hi"] * s * 0.7:.1f},{gy + 3:.1f} Q{cx:.1f},{gy + 9:.1f} {cx + b["hi"] * s * 0.8:.1f},{gy + 3:.1f}" stroke="{INK}" stroke-width="3" fill="none" stroke-linecap="round"/>')
    return '<g filter="url(#rough)">' + "".join(o) + '</g>'


def skirt_extra(X, Y, p, b):
    w0, w1, y0, y1 = b["wa"] / 2 + 0.02, b["hi"] / 2 + 0.11, b["wy"], 0.42
    return (f'<path d="M{X(-w0):.1f},{Y(y0):.1f} L{X(w0):.1f},{Y(y0):.1f} L{X(w1):.1f},{Y(y1):.1f} Q{X(0):.1f},{Y(y1 - 0.03):.1f} {X(-w1):.1f},{Y(y1):.1f} Z" '
            f'fill="{ZONES["geo"]}" stroke="{INK}" stroke-width="2.6" stroke-dasharray="7 3"/>')


def jacket_extra(X, Y, p, b):
    sh2, shy = b["sh"] / 2 + 0.03, p["shy"]
    o = []
    for sd in (-1, 1):
        o.append(f'<path d="M{X(sd * 0.06):.1f},{Y(shy + 0.03):.1f} L{X(sd * sh2):.1f},{Y(shy - 0.02):.1f} L{X(sd * (b["hi"] / 2 + 0.035)):.1f},{Y(b["cr"] - 0.04):.1f} L{X(sd * 0.07):.1f},{Y(b["cr"] - 0.04):.1f} L{X(sd * 0.09):.1f},{Y(shy - 0.2):.1f} Z" '
                 f'fill="{ZONES["geo"]}" stroke="{INK}" stroke-width="2.6" stroke-dasharray="7 3"/>')
    return "".join(o)


def hat_extra(X, Y, p, b):
    t = b["H"] + 0.005
    hx = b["hw"] / 2
    return (f'<path d="M{X(-hx * 1.7):.1f},{Y(t - 0.05):.1f} L{X(hx * 1.7):.1f},{Y(t - 0.05):.1f} L{X(hx * 1.0):.1f},{Y(t - 0.03):.1f} L{X(hx * 0.95):.1f},{Y(t + 0.07):.1f} '
            f'Q{X(0):.1f},{Y(t + 0.1):.1f} {X(-hx * 0.95):.1f},{Y(t + 0.07):.1f} L{X(-hx * 1.0):.1f},{Y(t - 0.03):.1f} Z" fill="{ZONES["geo"]}" stroke="{INK}" stroke-width="2.6" stroke-dasharray="7 3"/>')


def glasses_extra(X, Y, p, b):
    ey = Y(p["eyes_y"])
    r = b["hw"] * 0.13 * (X(1) - X(0))
    return "".join(f'<circle cx="{X(sd * b["hw"] * 0.22):.1f}" cy="{ey:.1f}" r="{r:.1f}" fill="none" stroke="{ZONES["geo"]}" stroke-width="2.2"/>' for sd in (-1, 1))


def vichy_defs(cell=7.0, base=None, line=None):
    base = base or N["tissus"]["ciel"]
    line = line or N["tissus"]["bleu_de_travail"]
    c2 = cell * 2
    return (f'<pattern id="vichy" width="{c2}" height="{c2}" patternUnits="userSpaceOnUse">'
            f'<rect width="{c2}" height="{c2}" fill="{base}"/>'
            f'<rect width="{cell}" height="{c2}" fill="{line}" opacity="0.45"/>'
            f'<rect width="{c2}" height="{cell}" fill="{line}" opacity="0.45"/>'
            f'<rect x="{cell * 1.45:.1f}" width="1" height="{c2}" fill="{N["tissus"]["craie"]}" opacity="0.7"/></pattern>')


def planche_gabarits():
    W, Hh = 2060, 1080
    s, gy = 300, 700
    o = [text(30, 44, "04 · Gabarits encrés: proportions, zones de texture, contour et ombre", 26, "bold", "start"),
         text(30, 72, "Vue de face, cotes au sommet du crâne. Contour: coque inversée, 2 à 4 px à l'écran. Ombre: aplat froid à bord net (rampe à 2 tons) et 3 à 5 hachures. Tirets dorés: géométrie propre.", 15, anchor="start")]
    # règle en mètres
    for m10 in range(0, 19):
        y = gy - m10 * 0.1 * s
        o.append(f'<line x1="40" y1="{y:.1f}" x2="{48 if m10 % 5 else 58}" y2="{y:.1f}" stroke="{INK}" stroke-width="1.2"/>')
        if m10 % 5 == 0:
            o.append(text(64, y + 5, fr(m10 / 10, 1) + " m", 13, anchor="start"))
    o.append(f'<line x1="40" y1="{gy}" x2="40" y2="{gy - 1.8 * s}" stroke="{INK}" stroke-width="1.2"/>')
    o.append(f'<line x1="30" y1="{gy}" x2="1340" y2="{gy}" stroke="{INK}" stroke-width="1"/>')
    extras = {"adult-f-medium": (skirt_extra,), "adult-m-round": (jacket_extra,), "elder-f-medium": (glasses_extra,), "elder-m-slim": (hat_extra,)}
    hair = {"adult-f-slim": "carre", "adult-f-medium": "chignon", "elder-f-medium": "chignon", "child-medium": "court"}
    xs = [190, 360, 535, 720, 890, 1055, 1225]
    for x, b in zip(xs, BODIES):
        o.append(figure(x, gy, s, b, "zones", hair.get(b["id"], "court"), extras.get(b["id"], ())))
        heads = b["H"] / b["hh"]
        o.append(text(x, gy + 34, b["nom"], 15, "bold"))
        o.append(text(x, gy + 54, f'{fr(b["H"])} m · tête {round(b["hh"] * 100, 1):g} cm'.replace(".", ","), 13))
        o.append(text(x, gy + 72, f'{fr(heads, 1)} têtes · {b["id"]}', 11))
    # repères en têtes sur l'homme moyen
    b = BODIES[2]
    for i in range(8):
        y = gy - (b["H"] - i * b["hh"]) * s
        if y <= gy:
            o.append(f'<line x1="1318" y1="{y:.1f}" x2="1332" y2="{y:.1f}" stroke="#9A6B3A" stroke-width="1.5"/>')
            o.append(text(1314, y + 4, str(i), 11, anchor="end", fill="#9A6B3A"))
    o.append(f'<line x1="1325" y1="{gy - b["H"] * s:.1f}" x2="1325" y2="{gy}" stroke="#9A6B3A" stroke-width="1"/>')
    o.append(text(1325, gy - b["H"] * s - 14, "têtes (1,76 m)", 11, fill="#9A6B3A"))
    # légende des zones
    ly = 830
    o.append(text(30, ly, "Zones de texture (corps commun)", 17, "bold", "start"))
    leg = [("visage", "visage peint (fond de peau, nez, joues; yeux et bouche viennent de l'atlas des traits)"), ("peau", "peau: crâne, cou, oreilles, mains, jambes nues"),
           ("cheveux", "cheveux: coque en volume, mèches peintes"), ("haut", "haut: torse et manches (t-shirt, chemise, pull, haut de pyjama)"),
           ("bas", "bas: bassin et jambes (pantalon, short, collant)"), ("chaussures", "chaussures: pied en forme de chaussure, tige peinte"),
           ("geo", "géométrie propre: jupe, robe, veste ouverte, chapeau, lunettes, sac")]
    for i, (k, t) in enumerate(leg):
        x, y = 30 + (i % 2) * 650, ly + 26 + (i // 2) * 26
        o.append(f'<rect x="{x}" y="{y - 13}" width="22" height="16" rx="3" fill="{ZONES[k]}" stroke="{INK}"/>')
        o.append(text(x + 30, y, t, 13, anchor="start"))
    o.append(text(30, ly + 150, "Le dos de l'âgé s'arrondit (épaules plus basses de 1 à 2 cm, tête avancée de 4 cm, vue de profil); l'enfant a la tête plus grosse et les jambes plus courtes. Joueurs: femme ou homme, 3 corpulences.", 13, anchor="start"))
    o.append(text(30, ly + 172, "Densité visible: corps et vêtements 1 500 à 1 900 triangles, tête 400 à 600, cheveux 200 à 500 (autant pour la coque); atlas composé de 512 x 512 au plus.", 13, anchor="start"))
    # atlas 512
    ax, ay, k = 1400, 110, 1.18  # 512 px affichés à 604 px
    o.append(text(ax, ay - 14, "Atlas personnel composé: 512 x 512 px", 17, "bold", "start"))
    cells = [(0, 0, 128, 128, "visage", "visage\n128"), (128, 0, 128, 128, "peau", "crâne, oreilles,\ncou 128"), (256, 0, 256, 128, "cheveux", "cheveux 256 x 128"),
             (0, 128, 160, 160, "haut", "haut avant\n160"), (160, 128, 160, 160, "haut", "haut dos\n160"), (320, 128, 192, 160, "haut", "manches\n192 x 160\n(miroir)"),
             (0, 288, 256, 128, "bas", "jambes 256 x 128\n(miroir)"), (256, 288, 64, 128, "bas", "bassin\n64"), (320, 288, 96, 128, "peau", "mains\n96"), (416, 288, 96, 128, "chaussures", "chaussures\n96"),
             (0, 416, 192, 96, "geo", "couche 2 haut\n(veste) 192 x 96"), (192, 416, 192, 96, "geo", "couche 2 bas\n(jupe, robe) 192 x 96"), (384, 416, 128, 96, "geo", "coiffe ou\naccessoire\n128 x 96")]
    for x, y, w, h, z, lab in cells:
        fill = ZONES[z]
        o.append(f'<rect x="{ax + x * k:.1f}" y="{ay + y * k:.1f}" width="{w * k:.1f}" height="{h * k:.1f}" fill="{fill}" stroke="{INK}" stroke-width="1.2"/>')
        lines = lab.split("\n")
        light = lstar(fill) < 50
        for j, l in enumerate(lines):
            o.append(text(ax + (x + w / 2) * k, ay + (y + h / 2) * k + (j - (len(lines) - 1) / 2) * 15 + 5, l, 12, fill="#FFFFFF" if light else INK))
    o.append(f'<rect x="{ax}" y="{ay}" width="{512 * k:.1f}" height="{512 * k:.1f}" fill="none" stroke="{INK}" stroke-width="2"/>')
    o.append(text(ax, ay + 512 * k + 22, "Traits du visage (yeux, sourcils, bouche, expressions): atlas commun à tous, 512 x 256 (planche 05).", 13, anchor="start"))
    o.append(text(ax, ay + 512 * k + 40, "Habitants au-delà de 18 m: même atlas réduit à 256 x 256.", 13, anchor="start"))
    # exemple texturé: pyjama à carreaux
    o.append(text(1400, 830, "Exemple: pyjama à carreaux en texture encrée", 15, "bold", "start"))
    o.append(figure(1440, 1050, 120, BODIES[2], "pyjama", "court"))
    o.append(text(1650, 870, "carreaux de 2 cm (vichy), 1 carreau = 6 px", 12, anchor="start"))
    o.append(text(1650, 888, "de texture au moins à 320 px/m", 12, anchor="start"))
    o.append(text(1650, 912, "plis: traits d'encre effilés aux coudes, genoux", 12, anchor="start"))
    o.append(text(1650, 930, "coutures en pointillé, patte boutonnée", 12, anchor="start"))
    o.append(text(1650, 954, "aucune géométrie en plus", 12, anchor="start"))
    o.append(text(1650, 978, "du corps commun: 0 triangle", 12, anchor="start"))
    # le même pyjama plus grand pour la lecture
    o.append(figure(1560, 1050, 120, BODIES[1], "pyjama", "chignon"))
    return svg(W, Hh, "".join(o), vichy_defs(3.0))


# ---------------------------------------------------------------- visages (planche 05)
EXPR = ["neutre", "joie", "rire", "surprise", "réflexion", "gêne", "peine", "colère", "sommeil", "parole", "inquiétude"]


def face(cx, cy, s, skin_id, hair_c, expr, age="adult", sex="f", iris="noisette", grid=False):
    """Tête de face peinte. s: px par mètre. cy: centre vertical de la tête."""
    skin = N["peaux"][skin_id]
    sh, blush = shade(skin, 0.8), N["fixes"]["joue"]
    lip = N["fixes"]["bouche"] if lstar(skin) >= 45 else "#D9A08F"
    hh = 0.222 if age == "child" else 0.245
    hw = 0.172 if age == "child" else 0.176
    top, chin = cy - hh / 2 * s, cy + hh / 2 * s
    hx = hw / 2 * s
    o = []
    gid = f"g{abs(hash((skin_id, expr, age, sex, cx, cy))) % 10 ** 8}"
    o.append(f'<radialGradient id="{gid}b" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="{blush}" stop-opacity="0.75"/><stop offset="1" stop-color="{blush}" stop-opacity="0"/></radialGradient>')
    ey = top + hh * s * (0.53 if age == "child" else 0.5)
    # cou et oreilles
    o.append(f'<rect x="{cx - hx * 0.55:.1f}" y="{chin - hx * 0.3:.1f}" width="{hx * 1.1:.1f}" height="{hx * 0.75:.1f}" fill="{sh}"/>')
    for sd in (-1, 1):
        o.append(f'<ellipse cx="{cx + sd * hx * 0.98:.1f}" cy="{ey + hh * s * 0.03:.1f}" rx="{hx * 0.16:.1f}" ry="{hh * s * 0.12:.1f}" fill="{sh}" stroke="{INK}" stroke-width="1.5"/>')
    jaw = 0.62 if age == "child" else (0.52 if sex == "m" else 0.46)
    d = (f'M{cx:.1f},{top:.1f} C{cx + hx * 1.1:.1f},{top:.1f} {cx + hx * 1.06:.1f},{cy + hh * s * 0.05:.1f} {cx + hx * 0.92:.1f},{cy + hh * s * 0.22:.1f} '
         f'C{cx + hx * jaw * 1.2:.1f},{chin:.1f} {cx + hx * 0.3:.1f},{chin:.1f} {cx:.1f},{chin:.1f} C{cx - hx * 0.3:.1f},{chin:.1f} {cx - hx * jaw * 1.2:.1f},{chin:.1f} {cx - hx * 0.92:.1f},{cy + hh * s * 0.22:.1f} '
         f'C{cx - hx * 1.06:.1f},{cy + hh * s * 0.05:.1f} {cx - hx * 1.1:.1f},{top:.1f} {cx:.1f},{top:.1f} Z')
    o.append(f'<path d="{d}" fill="{skin}" stroke="{INK}" stroke-width="{max(1.6, s * 0.0045):.1f}"/>')
    o.append(f'<clipPath id="{gid}h"><path d="{d}"/></clipPath><g clip-path="url(#{gid}h)"><path d="M{cx + hx * 0.45:.1f},{top - 5:.1f} Q{cx + hx * 0.75:.1f},{cy:.1f} {cx + hx * 0.35:.1f},{chin + 5:.1f} L{cx + hx * 1.5:.1f},{chin + 5:.1f} L{cx + hx * 1.5:.1f},{top - 5:.1f} Z" fill="{sh}"/></g>')
    ew = hw * s * (0.23 if age == "child" else 0.21)
    eh = ew * 0.42
    gap = ew * 1.05
    happy = expr in ("joie", "rire")
    blush_on = expr in ("joie", "rire", "gêne") or age == "child"
    if blush_on:
        for sd in (-1, 1):
            o.append(f'<ellipse cx="{cx + sd * (gap / 2 + ew * 0.55):.1f}" cy="{ey + ew * 0.95:.1f}" rx="{ew * 0.62:.1f}" ry="{ew * 0.36:.1f}" fill="url(#{gid}b)"/>')
    # nez: ombre peinte, pas de trait fermé
    ny = top + hh * s * (0.7 if age != "child" else 0.72)
    o.append(f'<path d="M{cx - ew * 0.08:.1f},{ey + ew * 0.2:.1f} Q{cx - ew * 0.22:.1f},{ny - ew * 0.3:.1f} {cx - ew * 0.3:.1f},{ny:.1f} Q{cx:.1f},{ny + ew * 0.18:.1f} {cx + ew * 0.3:.1f},{ny:.1f}" fill="none" stroke="{sh}" stroke-width="{max(1.2, ew * 0.11):.1f}" stroke-linecap="round"/>')
    # yeux
    for sd in (-1, 1):
        ex = cx + sd * (gap / 2 + ew / 2)
        if lstar(skin) < 35 and (expr == "sommeil" or happy):  # peau foncée: liseré clair sous le trait fermé
            o.append(f'<path d="M{ex - ew / 2:.1f},{ey + 1.6:.1f} Q{ex:.1f},{ey + (eh * 0.9 if expr == "sommeil" else -eh * 1.0) + 1.6:.1f} {ex + ew / 2:.1f},{ey + 1.6:.1f}" fill="none" stroke="{N["peaux"]["dore"]}" stroke-width="{max(1.2, ew * 0.08):.1f}" stroke-linecap="round"/>')
        if expr in ("sommeil",):
            o.append(f'<path d="M{ex - ew / 2:.1f},{ey:.1f} Q{ex:.1f},{ey + eh * 0.9:.1f} {ex + ew / 2:.1f},{ey:.1f}" fill="none" stroke="{INK}" stroke-width="{max(1.3, ew * 0.09):.1f}" stroke-linecap="round"/>')
        elif happy:
            o.append(f'<path d="M{ex - ew / 2:.1f},{ey + eh * 0.2:.1f} Q{ex:.1f},{ey - eh * 1.0:.1f} {ex + ew / 2:.1f},{ey + eh * 0.2:.1f}" fill="none" stroke="{INK}" stroke-width="{max(1.3, ew * 0.1):.1f}" stroke-linecap="round"/>')
        else:
            k = {"surprise": 1.45, "inquiétude": 1.25, "gêne": 0.85, "peine": 0.9}.get(expr, 1.0)
            ehh = eh * k
            lid = {"gêne": 0.35, "peine": 0.3, "colère": 0.35}.get(expr, 0.0)
            o.append(f'<ellipse cx="{ex:.1f}" cy="{ey:.1f}" rx="{ew / 2:.1f}" ry="{ehh:.1f}" fill="{N["fixes"]["blanc_oeil"]}"/>')
            shift = {"réflexion": sd * 0 + ew * 0.18, "gêne": -ew * 0.15 * 1}.get(expr, 0.0)
            ir = ew * (0.21 if expr == "surprise" else 0.25)
            o.append(f'<clipPath id="{gid}e{sd}"><ellipse cx="{ex:.1f}" cy="{ey:.1f}" rx="{ew / 2:.1f}" ry="{ehh:.1f}"/></clipPath>')
            o.append(f'<g clip-path="url(#{gid}e{sd})"><circle cx="{ex + shift:.1f}" cy="{ey + (ehh * 0.12 if expr != "réflexion" else -ehh * 0.25):.1f}" r="{ir:.1f}" fill="{N["iris"][iris]}"/>'
                     f'<circle cx="{ex + shift:.1f}" cy="{ey + (ehh * 0.12 if expr != "réflexion" else -ehh * 0.25):.1f}" r="{ir * 0.5:.1f}" fill="{"#1C1A1E"}"/>'
                     f'<circle cx="{ex + shift + ir * 0.35:.1f}" cy="{ey - ir * 0.3:.1f}" r="{max(0.8, ir * 0.25):.1f}" fill="#FFFFFF"/>'
                     + (f'<rect x="{ex - ew:.1f}" y="{ey - ehh * 1.2:.1f}" width="{ew * 2:.1f}" height="{ehh * (0.2 + lid * 2.2):.1f}" fill="{sh}"/>' if lid else "")
                     + '</g>')
            o.append(f'<path d="M{ex - ew * 0.56:.1f},{ey + ehh * 0.1:.1f} Q{ex:.1f},{ey - ehh * 1.45 + lid * ehh * 1.2:.1f} {ex + ew * 0.56:.1f},{ey + ehh * 0.1:.1f}" fill="none" stroke="{INK}" stroke-width="{max(1.3, ew * 0.1):.1f}" stroke-linecap="round"/>')
        # sourcils
        by = ey - eh * 2.3
        dy_in, dy_out = {"surprise": (-eh * 1.1, -eh * 1.0), "colère": (eh * 0.9, -eh * 0.25), "peine": (-eh * 0.75, eh * 0.35), "inquiétude": (-eh * 0.85, eh * 0.15),
                          "réflexion": ((-eh * 0.6, -eh * 0.6) if sd > 0 else (eh * 0.15, eh * 0.15)), "gêne": (-eh * 0.4, eh * 0.2), "joie": (-eh * 0.3, -eh * 0.3), "rire": (-eh * 0.4, -eh * 0.4)}.get(expr, (0, 0))
        bc = N["cheveux"]["gris"] if age == "elder" else hair_c
        bw = max(1.6, ew * (0.2 if sex == "m" else 0.15))
        xin, xout = ex - sd * ew * 0.45, ex + sd * ew * 0.6
        o.append(f'<path d="M{xin:.1f},{by + dy_in:.1f} Q{ex:.1f},{by - eh * 0.45 + (dy_in + dy_out) / 2:.1f} {xout:.1f},{by + dy_out + eh * 0.25:.1f}" fill="none" stroke="{bc}" stroke-width="{bw:.1f}" stroke-linecap="round"/>')
        if age == "elder":
            o.append(f'<path d="M{ex + sd * ew * 0.62:.1f},{ey + eh * 0.2:.1f} l{sd * ew * 0.22:.1f},{-eh * 0.3:.1f} M{ex + sd * ew * 0.62:.1f},{ey + eh * 0.55:.1f} l{sd * ew * 0.22:.1f},{eh * 0.2:.1f}" stroke="{sh}" stroke-width="1" fill="none"/>')
    # bouche
    my = top + hh * s * (0.8 if age != "child" else 0.82)
    mw = ew * (0.95 if age == "child" else 1.1)
    lw = max(1.4, ew * 0.11)
    if expr in ("neutre", "réflexion"):
        dx = mw * 0.25 if expr == "réflexion" else 0
        o.append(f'<path d="M{cx - mw / 2 + dx:.1f},{my:.1f} Q{cx + dx:.1f},{my + mw * 0.08:.1f} {cx + mw / 2 + dx:.1f},{my - (mw * 0.08 if expr == "réflexion" else 0):.1f}" fill="none" stroke="{lip}" stroke-width="{lw * 1.4:.1f}" stroke-linecap="round"/>')
    elif expr == "joie":
        o.append(f'<path d="M{cx - mw / 2:.1f},{my - mw * 0.08:.1f} Q{cx:.1f},{my + mw * 0.4:.1f} {cx + mw / 2:.1f},{my - mw * 0.08:.1f}" fill="none" stroke="{lip}" stroke-width="{lw * 1.5:.1f}" stroke-linecap="round"/>')
    elif expr in ("rire", "parole"):
        h = mw * (0.42 if expr == "rire" else 0.22)
        w = mw * (0.55 if expr == "rire" else 0.32)
        o.append(f'<path d="M{cx - w:.1f},{my - h * 0.2:.1f} Q{cx:.1f},{my - h * 0.4:.1f} {cx + w:.1f},{my - h * 0.2:.1f} Q{cx + w * 0.7:.1f},{my + h * 1.3:.1f} {cx:.1f},{my + h * 1.3:.1f} Q{cx - w * 0.7:.1f},{my + h * 1.3:.1f} {cx - w:.1f},{my - h * 0.2:.1f} Z" fill="#5A2A2A" stroke="{lip}" stroke-width="{lw:.1f}"/>')
        if expr == "rire":
            o.append(f'<path d="M{cx - w * 0.75:.1f},{my - h * 0.15:.1f} L{cx + w * 0.75:.1f},{my - h * 0.15:.1f} L{cx + w * 0.65:.1f},{my + h * 0.15:.1f} L{cx - w * 0.65:.1f},{my + h * 0.15:.1f} Z" fill="{N["fixes"]["blanc_oeil"]}"/>')
    elif expr == "surprise":
        o.append(f'<ellipse cx="{cx:.1f}" cy="{my + mw * 0.06:.1f}" rx="{mw * 0.17:.1f}" ry="{mw * 0.24:.1f}" fill="#5A2A2A" stroke="{lip}" stroke-width="{lw:.1f}"/>')
    elif expr == "gêne":
        o.append(f'<path d="M{cx - mw / 2:.1f},{my:.1f} q{mw / 4:.1f},{-mw * 0.12:.1f} {mw / 2:.1f},0 t{mw / 2:.1f},0" fill="none" stroke="{lip}" stroke-width="{lw * 1.3:.1f}" stroke-linecap="round"/>')
    elif expr in ("peine", "inquiétude"):
        k = 0.3 if expr == "peine" else 0.15
        o.append(f'<path d="M{cx - mw * 0.42:.1f},{my + mw * 0.12:.1f} Q{cx:.1f},{my - mw * k:.1f} {cx + mw * 0.42:.1f},{my + mw * 0.12:.1f}" fill="none" stroke="{lip}" stroke-width="{lw * 1.4:.1f}" stroke-linecap="round"/>')
    elif expr == "colère":
        o.append(f'<path d="M{cx - mw * 0.4:.1f},{my + mw * 0.1:.1f} Q{cx:.1f},{my - mw * 0.12:.1f} {cx + mw * 0.4:.1f},{my + mw * 0.1:.1f}" fill="none" stroke="{lip}" stroke-width="{lw * 1.7:.1f}" stroke-linecap="round"/>')
    elif expr == "sommeil":
        o.append(f'<ellipse cx="{cx:.1f}" cy="{my:.1f}" rx="{mw * 0.12:.1f}" ry="{mw * 0.1:.1f}" fill="#5A2A2A" stroke="{lip}" stroke-width="{lw * 0.8:.1f}"/>')
    # cheveux
    hx2 = hx * 1.08
    if age == "elder" and sex == "m":
        o.append(f'<path d="M{cx - hx2:.1f},{ey - eh:.1f} C{cx - hx2:.1f},{top - 4:.1f} {cx - hx * 0.5:.1f},{top - 2:.1f} {cx - hx * 0.4:.1f},{top + hh * s * 0.12:.1f} C{cx - hx * 0.7:.1f},{top + hh * s * 0.2:.1f} {cx - hx * 0.85:.1f},{ey - eh * 3:.1f} {cx - hx * 0.9:.1f},{ey - eh:.1f} Z" fill="{hair_c}" stroke="{INK}" stroke-width="1.5"/>')
        o.append(f'<path d="M{cx + hx2:.1f},{ey - eh:.1f} C{cx + hx2:.1f},{top - 4:.1f} {cx + hx * 0.5:.1f},{top - 2:.1f} {cx + hx * 0.4:.1f},{top + hh * s * 0.12:.1f} C{cx + hx * 0.7:.1f},{top + hh * s * 0.2:.1f} {cx + hx * 0.85:.1f},{ey - eh * 3:.1f} {cx + hx * 0.9:.1f},{ey - eh:.1f} Z" fill="{hair_c}" stroke="{INK}" stroke-width="1.5"/>')
    else:
        fr_y = top + hh * s * (0.27 if sex == "f" else 0.22)
        long = sex == "f" and age != "elder"
        side_low = chin + 4 if long else ey - eh
        cy0, pad = ey - eh * 2.5, hh * s * 0.045
        o.append(f'<path d="M{cx - hx2:.1f},{side_low:.1f} L{cx - hx2:.1f},{cy0:.1f} A{hx2:.1f},{cy0 - top + pad:.1f} 0 0 1 {cx + hx2:.1f},{cy0:.1f} L{cx + hx2:.1f},{side_low:.1f} '
                 f'L{cx + hx * 0.86:.1f},{side_low:.1f} C{cx + hx * 0.85:.1f},{fr_y + hh * s * 0.05:.1f} {cx + hx * 0.4:.1f},{fr_y - 2:.1f} {cx:.1f},{fr_y + 2:.1f} '
                 f'C{cx - hx * 0.4:.1f},{fr_y - 2:.1f} {cx - hx * 0.85:.1f},{fr_y + hh * s * 0.05:.1f} {cx - hx * 0.86:.1f},{side_low:.1f} Z" fill="{hair_c}" stroke="{INK}" stroke-width="1.5"/>')
        for i in range(5):  # mèches peintes: quelques traits plus clairs, jamais des fils
            xx = cx - hx * 0.6 + i * hx * 0.3
            o.append(f'<path d="M{xx:.1f},{top + 3:.1f} q{hx * 0.12:.1f},{hh * s * 0.1:.1f} {hx * 0.05:.1f},{hh * s * 0.2:.1f}" stroke="{shade(hair_c, 1.35)}" stroke-width="{max(1.0, hx * 0.04):.1f}" fill="none" opacity="0.8"/>')
        if age == "elder":
            o.append(f'<circle cx="{cx:.1f}" cy="{top - hh * s * 0.05:.1f}" r="{hx * 0.38:.1f}" fill="{hair_c}" stroke="{INK}" stroke-width="1.5"/>')
    if grid:
        for frac, lab in [(0, "sommet du crâne"), (0.27, "racine des cheveux"), (0.41, "sourcils"), (0.5, "yeux: mi-hauteur"), (0.7, "base du nez"), (0.8, "bouche"), (1.0, "menton")]:
            y = top + hh * s * frac
            o.append(f'<line x1="{cx - hx * 1.6:.1f}" y1="{y:.1f}" x2="{cx + hx * 1.5:.1f}" y2="{y:.1f}" stroke="#9A6B3A" stroke-width="1" stroke-dasharray="4 3"/>')
            o.append(text(cx + hx * 1.55, y + 4, f"{lab} ({fr(frac)})", 12, anchor="start", fill="#7A4F28"))
        for xv in (-gap / 2 - ew, -gap / 2, gap / 2, gap / 2 + ew):
            o.append(f'<line x1="{cx + xv:.1f}" y1="{ey - eh * 1.2:.1f}" x2="{cx + xv:.1f}" y2="{chin + 22:.1f}" stroke="#9A6B3A" stroke-width="1" stroke-dasharray="2 3"/>')
        o.append(text(cx, chin + 38, "œil · écart = 1 œil · œil", 12, fill="#7A4F28"))
    return "".join(o)


def planche_visages():
    W, Hh = 2000, 1000
    o = [text(30, 44, "05 · Visages encrés et expressions par textures de rechange", 26, "bold", "start"),
         text(30, 72, "Traits à l'encre sur une tête à aplats (peau en 2 tons, ombre à bord net). Expressions: on change les cellules yeux, sourcils et bouche de l'atlas commun des traits.", 15, anchor="start")]
    o.append('<g filter="url(#rough)">' + face(230, 360, 1250, "miel", N["cheveux"]["chatain"], "neutre", "adult", "f", "noisette", grid=True) + '</g>')
    o.append(text(250, 590, "Construction (adulte, tête de 24,5 cm)", 15, "bold"))
    notes = ["Œil: 3,7 cm de large (un peu plus grand que nature),", "iris 45 % de l'œil, blanc toujours visible,", "reflet de 1 à 2 px à 2 h, même côté pour tous.",
             "Paupière haute: trait sombre épais, jamais de cils un par un.", "Nez: une ombre en aplat et un trait, sans contour fermé.", "Bouche: un trait d'encre; lèvre teintée seulement de près;",
             "peaux foncées: lèvres plus claires que la peau.", "Joues: pastille de rougeur en aplat (enfant, joie, gêne).", "Âgé: deux rides au plus au coin de l'œil, sourcils gris.",
             "Enfant: yeux un peu plus bas (0,53) et plus grands."]
    for i, n_ in enumerate(notes):
        o.append(text(40, 620 + i * 21, n_, 13, anchor="start"))
    rows = [("Adulte F · porcelaine", "porcelaine", N["cheveux"]["blond_paille"], "adult", "f", "bleu"),
            ("Adulte H · noisette", "noisette", N["cheveux"]["brun"], "adult", "m", "brun"),
            ("Enfant · miel", "miel", N["cheveux"]["roux"], "child", "f", "vert"),
            ("Âgée · ébène", "ebene", N["cheveux"]["blanc"], "elder", "f", "brun"),
            ("Âgé · doré", "dore", N["cheveux"]["gris"], "elder", "m", "gris")]
    x0, y0, dx, dy = 640, 140, 122, 162
    for j, e in enumerate(EXPR):
        o.append(text(x0 + j * dx, y0 - 34, e, 14, "bold"))
    for i, (lab, sk, hc, age, sex, iris) in enumerate(rows):
        y = y0 + 60 + i * dy
        o.append(text(x0 - 70, y - 70, lab, 12, anchor="start", fill="#7A4F28"))
        for j, e in enumerate(EXPR):
            o.append(face(x0 + j * dx, y + 8, 430, sk, hc, e, age, sex, iris))
    o.append(text(x0 - 70, y0 + 60 + 5 * dy - 40, "Neutre à colère: 8 expressions de jeu; sommeil sert aussi au clignement (toutes les 3 à 6 s); parole alterne avec neutre au rythme du babil; inquiétude réservée aux frissons du village hanté.", 13, anchor="start"))
    o.append(text(x0 - 70, y0 + 60 + 5 * dy - 20, "Atlas commun des traits (512 x 256): 6 formes d'yeux x 6 états (64 x 32), 5 sourcils x 4 positions (64 x 16), 10 bouches (64 x 32); teintes iris, sourcils et lèvres posées par le shader.", 13, anchor="start"))
    return svg(W, Hh, "".join(o))


# ---------------------------------------------------------------- nuancier et matières (planche 06)
def jit(rnd, a):
    return (rnd.random() - 0.5) * 2 * a


def ink_poly(pts, fill, rnd, w=2.0, j=0.6):
    """Polygone cerné d'encre, sommets légèrement bougés (trait à la main)."""
    d = "M" + " L".join(f"{x + jit(rnd, j):.1f},{y + jit(rnd, j):.1f}" for x, y in pts) + " Z"
    return f'<path d="{d}" fill="{fill}" stroke="{INK}" stroke-width="{w:.1f}" stroke-linejoin="round"/>'


def stroke(x1, y1, x2, y2, w=1.6, col=None):
    """Trait effilé: un fuseau plein plutôt qu'une ligne d'épaisseur constante."""
    col = col or INK
    dx, dy = x2 - x1, y2 - y1
    n = math.hypot(dx, dy) or 1
    nx, ny = -dy / n * w / 2, dx / n * w / 2
    mx, my = (x1 + x2) / 2, (y1 + y2) / 2
    return f'<path d="M{x1:.1f},{y1:.1f} Q{mx + nx:.1f},{my + ny:.1f} {x2:.1f},{y2:.1f} Q{mx - nx:.1f},{my - ny:.1f} {x1:.1f},{y1:.1f} Z" fill="{col}"/>'


def hatch(rnd, x, y, n, length, gap, w=1.4, col=None):
    """Hachures parallèles à 45 degrés, longueurs inégales: règle de la bible (3.3)."""
    return "".join(stroke(x + i * gap, y + jit(rnd, 1.5), x + i * gap + length * (0.7 + rnd.random() * 0.3), y - length * (0.7 + rnd.random() * 0.3), w, col) for i in range(n))


def mat_svg(kind, px, rnd):
    """Échantillon de matière encrée à sa vraie résolution de texture (px x px), trois tons et encre."""
    L = {k: (c, b, o) for k, c, b, o in LIEUX["aubrune_jour"]}
    o = []
    if kind == "crepi":  # 1 m, 128 px/m: aplat, deux plaques claires, fissure encrée, ombre peinte en pied
        c, b, sh = L["crepi"]
        o.append(f'<rect width="{px}" height="{px}" fill="{b}"/>')
        for _ in range(3):
            x, y = rnd.random() * px * 0.7, rnd.random() * px * 0.6
            o.append(ink_poly([(x, y), (x + 34, y + 3), (x + 30, y + 22), (x + 4, y + 18)], c, rnd, 0.01, 2.5).replace(f'stroke="{INK}"', 'stroke="none"'))
        o.append(f'<path d="M0,{px * 0.8:.1f} Q{px * 0.3:.1f},{px * 0.76:.1f} {px * 0.55:.1f},{px * 0.82:.1f} T{px},{px * 0.78:.1f} L{px},{px} L0,{px} Z" fill="{sh}"/>')
        o.append(hatch(rnd, 6, px * 0.78, 6, 9, 9, 1.5))
        o.append(f'<path d="M{px * 0.62:.1f},{px * 0.1:.1f} l-4,9 l3,6 l-6,11 l2,7" fill="none" stroke="{INK}" stroke-width="1.5" stroke-linecap="round"/>')
    elif kind == "bois":  # plancher, 1 m, 128 px/m: lames de 16 cm cernées, veines en volutes, joints noirs
        c, b, sh = L["bois"]
        lw = px * 0.16
        for i in range(7):
            y0 = i * lw
            cut = 20 + rnd.random() * (px - 40)
            for x0, x1 in ((-2, cut), (cut, px + 2)):
                tone = b if rnd.random() > 0.3 else c
                o.append(ink_poly([(x0, y0), (x1, y0), (x1, y0 + lw), (x0, y0 + lw)], tone, rnd, 1.8, 0.7))
                xm = (x0 + x1) / 2
                o.append(f'<path d="M{x0 + 6:.1f},{y0 + lw * 0.5:.1f} Q{xm - 8:.1f},{y0 + lw * 0.2:.1f} {xm:.1f},{y0 + lw * 0.5:.1f} T{x1 - 6:.1f},{y0 + lw * 0.45:.1f}" fill="none" stroke="{sh}" stroke-width="1.2"/>')
            o.append(f'<rect x="0" y="{y0 + lw - 3:.1f}" width="{px}" height="3" fill="{sh}" opacity="0.8"/>')
    elif kind == "tuile":  # tuiles canal, 1 m, 128 px/m: rangs de 33 cm, chaque tuile cernée, ombre sous le rang
        c, b, sh = L["tuile"]
        o.append(f'<rect width="{px}" height="{px}" fill="{sh}"/>')
        tw, rh = px * 0.2, px * 0.33
        for r in range(-1, 4):
            for col in range(-1, 6):
                x = col * tw + (tw / 2 if r % 2 else 0)
                y = r * rh
                o.append(ink_poly([(x + 1, y + rh + 3), (x + 2, y + 2), (x + tw / 2, y - 3), (x + tw - 2, y + 2), (x + tw - 1, y + rh + 3)], b, rnd, 1.6, 0.8))
                o.append(f'<rect x="{x + tw * 0.25:.1f}" y="{y + 3:.1f}" width="{tw * 0.18:.1f}" height="{rh - 6:.1f}" fill="{c}"/>')
                o.append(f'<rect x="{x + 2:.1f}" y="{y + rh - 6:.1f}" width="{tw - 4:.1f}" height="7" fill="{sh}"/>')
    elif kind == "carrelage":  # dalles de pierre de 33 cm, 1 m, 128 px/m: cernées, éclats, joints sombres
        c, b, sh = L["pierre"]
        t = px / 3
        o.append(f'<rect width="{px}" height="{px}" fill="{sh}"/>')
        for i in range(3):
            for j in range(3):
                x, y = i * t + (t / 2 if j % 2 else 0) - t / 2 * (j % 2), j * t
                o.append(ink_poly([(x + 2, y + 2), (x + t - 2, y + 3), (x + t - 3, y + t - 2), (x + 3, y + t - 3)], b, rnd, 1.9, 1.2))
                o.append(f'<path d="M{x + 5:.1f},{y + 6:.1f} L{x + t * 0.6:.1f},{y + 6:.1f} L{x + 5:.1f},{y + t * 0.4:.1f} Z" fill="{c}"/>')
                if rnd.random() < 0.4:
                    o.append(f'<path d="M{x + t * 0.5:.1f},{y + t * 0.3:.1f} l5,6 l-2,7" fill="none" stroke="{INK}" stroke-width="1.3" stroke-linecap="round"/>')
    elif kind == "tissu":  # carreaux d'un pyjama, 40 cm à 320 px/m: deux tons d'aplat, plis en traits d'encre, ombre de pli en aplat
        base, line = N["tissus"]["ciel"], N["tissus"]["bleu_de_travail"]
        cell = px / 10
        o.append(f'<rect width="{px}" height="{px}" fill="{base}"/>')
        for i in range(0, 10, 2):
            o.append(f'<rect x="{i * cell:.1f}" width="{cell:.1f}" height="{px}" fill="{line}" opacity="0.55"/>')
            o.append(f'<rect y="{i * cell:.1f}" width="{px}" height="{cell:.1f}" fill="{line}" opacity="0.55"/>')
        o.append(f'<path d="M0,{px * 0.42:.1f} Q{px * 0.5:.1f},{px * 0.55:.1f} {px},{px * 0.46:.1f} L{px},{px * 0.58:.1f} Q{px * 0.5:.1f},{px * 0.66:.1f} 0,{px * 0.5:.1f} Z" fill="{N["tissus"]["marine"]}" opacity="0.45"/>')
        o.append(stroke(4, px * 0.42, px * 0.7, px * 0.5, 2.4))
        o.append(stroke(px * 0.3, px * 0.98, px * 0.42, px * 0.66, 2.0))
        o.append(f'<line x1="{px * 0.82:.1f}" y1="0" x2="{px * 0.82:.1f}" y2="{px}" stroke="{INK}" stroke-width="1.4" stroke-dasharray="4 3"/>')
    elif kind == "herbe":  # 2 m de sol à 64 px/m: aplat, plaques claires, touffes en V encrées, bord fondu dans l'ombre
        c, b, sh = L["herbe"]
        o.append(f'<rect width="{px}" height="{px}" fill="{b}"/>')
        for _ in range(4):
            x, y = rnd.random() * px, rnd.random() * px
            o.append(f'<ellipse cx="{x:.1f}" cy="{y:.1f}" rx="{18 + rnd.random() * 14:.1f}" ry="{9 + rnd.random() * 6:.1f}" fill="{c}"/>')
        for _ in range(26):
            x, y = 6 + rnd.random() * (px - 12), 8 + rnd.random() * (px - 12)
            for dx in (-3.5, 0, 3.0):
                o.append(stroke(x, y, x + dx, y - 6 - rnd.random() * 3, 1.3))
        o.append(f'<path d="M0,{px * 0.85:.1f} Q{px * 0.4:.1f},{px * 0.78:.1f} {px},{px * 0.88:.1f} L{px},{px} L0,{px} Z" fill="{sh}"/>')
    return f'<svg xmlns="http://www.w3.org/2000/svg" width="{px}" height="{px}" viewBox="0 0 {px} {px}">{"".join(o)}</svg>'


MATS = [  # (clé, titre, résolution de texture, ce que montre l'échantillon)
    ("crepi", "Crépi", 128, "1 m x 1 m · 128 px/m · aplat, plaques claires, fissure, pied hachuré"),
    ("bois", "Plancher", 128, "1 m x 1 m · 128 px/m · lames cernées de 16 cm, veines en volutes"),
    ("tuile", "Tuiles canal", 128, "1 m x 1 m · 128 px/m · tuiles cernées, ombre pleine sous le rang"),
    ("carrelage", "Dallage", 128, "1 m x 1 m · 128 px/m · dalles de 33 cm cernées, éclats, joints sombres"),
    ("tissu", "Tissu à carreaux", 128, "40 cm x 40 cm · 320 px/m · aplats, plis à l'encre, couture"),
    ("herbe", "Herbe", 128, "2 m x 2 m · 64 px/m · touffes en V, bord fondu dans l'ombre"),
]


def render_png(svg_text, px):
    with tempfile.TemporaryDirectory() as d:
        a, b = os.path.join(d, "m.svg"), os.path.join(d, "m.png")
        open(a, "w").write(svg_text)
        subprocess.run(["rsvg-convert", "-w", str(px), "-h", str(px), a, "-o", b], check=True)
        return base64.b64encode(open(b, "rb").read()).decode()


AMBIANCES = [  # (lieu, titre, voile d'ambiance, vignette, lumière)
    ("aubrune_jour", "Aubrune, jour", "#FFF4DC", 0.10, "soleil chaud, ombres courtes, vignette légère"),
    ("aubrune_crepuscule", "Aubrune, crépuscule", "#F2A66E", 0.30, "lumière rasante ambrée, ombres prune"),
    ("aubrune_nuit", "Aubrune, nuit", "#2E3A5C", 0.50, "bleu de nuit, flaques ambrées des fenêtres"),
    ("hautefonte", "Hautefonte", "#C9C2B0", 0.30, "gris blond de ville, accents de stores et d'enseignes"),
    ("combe_veilleuse", "Combe-Veilleuse", "#3E4A48", 0.65, "pénombre verte, lueur pâle des esprits"),
]


def planche_nuancier(src_dir):
    W, Hh = 2000, 1180
    o = [text(30, 44, "06 · Nuancier: personnages vifs, lieux en trois tons, matières encrées", 26, "bold", "start"),
         text(30, 72, "Personnages: teinte de base (la lumière fait l'ombre). Lieux: clair, base, ombre par matière; l'encre est commune. Chiffres: clarté L*. Source: planches/source/nuancier-v02.json.", 15, anchor="start")]
    y = 100

    def row(title, items, y, size=38, per=26):
        o.append(text(30, y + 24, title, 15, "bold", "start"))
        for i, (k, v) in enumerate(items):
            x = 220 + (i % per) * (size + 26)
            yy = y + (i // per) * (size + 34)
            o.append(f'<rect x="{x}" y="{yy}" width="{size}" height="{size}" rx="3" fill="{v}" stroke="{INK}" stroke-width="1.6"/>')
            o.append(text(x + size / 2, yy + size + 13, k.replace("_", " ")[:11], 10))
            o.append(text(x + size / 2, yy + size + 25, f"{lstar(v):.0f}", 10, fill="#6A5A4A"))
        return y + ((len(items) - 1) // per + 1) * (size + 34) + 4

    y = row("Encre", list(N["encre"].items()), y)
    y = row("Peaux", list(N["peaux"].items()), y)
    y = row("Cheveux", list(N["cheveux"].items()) + [(k + " J", v) for k, v in N["cheveux_joueurs"].items()], y)
    y = row("Tissus", list(N["tissus"].items()), y, size=34, per=26)
    # échelles de lieux
    o.append(text(30, y + 22, "Lieux", 15, "bold", "start"))
    o.append(text(30, y + 42, "clair, base, ombre", 12, anchor="start"))
    x = 220
    for lieu, titre, voile, vig, note in AMBIANCES:
        mats = LIEUX[lieu]
        o.append(text(x, y + 22, titre, 13, "bold", "start"))
        for i, (k, c, b, sh) in enumerate(mats):
            xx = x + i * 38
            for j, col in enumerate((c, b, sh)):
                o.append(f'<rect x="{xx}" y="{y + 32 + j * 20}" width="34" height="20" fill="{col}" stroke="{INK}" stroke-width="1.2"/>')
            o.append(text(xx + 17, y + 106, k[:7], 9))
        x += max(4, len(mats)) * 38 + 22
    y += 122
    # ambiances: une vignette de 200 x 120 par lieu, même petit motif (sol, mur, flaque de lumière)
    o.append(text(30, y + 18, "Ambiances", 15, "bold", "start"))
    x = 220
    for lieu, titre, voile, vig, note in AMBIANCES:
        mats = {k: (c, b, sh) for k, c, b, sh in LIEUX[lieu]}
        sol = next(iter(mats.values()))
        mur = list(mats.values())[min(2, len(mats) - 1)]
        gid = f"v{lieu}"
        o.append(f'<radialGradient id="{gid}" cx="0.5" cy="0.55" r="0.7"><stop offset="0.45" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="{vig}"/></radialGradient>')
        o.append(f'<rect x="{x}" y="{y}" width="300" height="150" fill="{sol[1]}"/>')
        o.append(f'<path d="M{x},{y} L{x + 300},{y} L{x + 300},{y + 45} L{x},{y + 60} Z" fill="{mur[1]}" stroke="{INK}" stroke-width="2"/>')
        o.append(f'<path d="M{x},{y + 60} L{x + 300},{y + 45} L{x + 300},{y + 62} L{x},{y + 80} Z" fill="{sol[2]}"/>')
        o.append(f'<ellipse cx="{x + 150}" cy="{y + 105}" rx="70" ry="30" fill="{sol[0]}"/>')
        o.append(f'<rect x="{x}" y="{y}" width="300" height="150" fill="{voile}" opacity="0.18"/>')
        o.append(f'<rect x="{x}" y="{y}" width="300" height="150" fill="url(#{gid})"/>')
        o.append(f'<rect x="{x}" y="{y}" width="300" height="150" fill="none" stroke="{INK}" stroke-width="1.5"/>')
        o.append(text(x, y + 168, titre, 13, "bold", "start"))
        o.append(text(x, y + 185, note, 11, anchor="start"))
        x += 330
    y += 205
    o.append(text(30, y + 20, "Six matières encrées à la résolution réelle de leur texture, affichées 2 fois plus grandes que le zoom le plus proche du jeu (filtrage bilinéaire)", 15, "bold", "start"))
    rnd = random.Random(7)
    disp = 256
    for i, (k, title, px, note) in enumerate(MATS):
        sv = mat_svg(k, px, rnd)
        open(os.path.join(src_dir, "matieres", f"{k}.svg"), "w").write(sv)
        b64 = render_png(sv, px)
        x = 30 + i * (disp + 70)
        o.append(f'<image x="{x}" y="{y + 36}" width="{disp}" height="{disp}" href="data:image/png;base64,{b64}" xlink:href="data:image/png;base64,{b64}"/>')
        o.append(f'<rect x="{x}" y="{y + 36}" width="{disp}" height="{disp}" fill="none" stroke="{INK}" stroke-width="1.2"/>')
        o.append(text(x, y + 36 + disp + 22, title, 15, "bold", "start"))
        for j, w in enumerate(note.split(" · ")):
            o.append(text(x, y + 36 + disp + 40 + j * 16, w, 12, anchor="start"))
    return svg(W, Hh, "".join(o))


if __name__ == "__main__":
    out = sys.argv[1]
    os.makedirs(os.path.join(HERE, "matieres"), exist_ok=True)
    open(os.path.join(out, "04-gabarits-encres.svg"), "w").write(planche_gabarits())
    open(os.path.join(out, "05-visages-encres.svg"), "w").write(planche_visages())
    open(os.path.join(out, "06-nuancier-lieux-matieres.svg"), "w").write(planche_nuancier(HERE))
