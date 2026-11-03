"""Tour 10 (conception 2.1): douze coupes nouvelles pour tous les personnages, et (réponse du client à la
question 2) barbe courte, barbe fournie et moustache, au choix de chacun.

Appelé par personnages.py. Repères de la tête ronde du joueur (PHEAD: demi-axes 0,18 x 0,165 x 0,17, centre hc):
devant vers -Y. Style des coupes existantes (`hair_round`): une calotte en ellipsoïde décalée vers le haut et
l'arrière, dont le devant rentre sous la peau au front (le front et les sourcils restent libres), et des mèches
en lobes facettés. Tout est lié à l'os `head`; la tresse dans le dos et la queue de cheval descendent sur l'os
`neck` pour leur partie basse (elles suivent le cou sans entrer dans le dos). Couleur: cases `hair` et
`hair_dark` de la rangée du personnage (le jeu y écrit l'une des huit couleurs, `PLAYER_PRESETS["hair_colors"]`).

Gardes vérifiées sur la planche du tour 10 (`planche_coiffures.py`): rien ne descend dans le foulard agrandi
(anneau de 0,14 m de demi-largeur entre 1,35 et 1,41 m, nœud et pan dans le dos à x -0,05 à -0,10), ni dans
les épaules (boules de 0,083 m en x +-0,2, z 1,305), ni devant les yeux (hc + 0,03).
"""
import math

NEW_CUTS = ["crop", "curls", "ponytail", "braid", "pigtails", "wavy", "long", "fringe", "quiff", "cloud", "crown",
            "bob_long"]
FACIAL = ["beard_short", "beard_full", "mustache"]
RX, RY, RZ = 0.18, 0.165, 0.17


def _lobe(g, hc, c, r, segs=8, rings=5, rot=(0, 0, 0), color="hair", bone="head"):
    return g.sphere(1.0, loc=(c[0], c[1], hc + c[2]), color=color, segs=segs, rings=rings, scale=r, rot=rot,
                    bone=bone)


def _cap(g, hc, thick=0.014, segs=12, rings=7, back=0.04, up=0.06, rz=0.13):
    _lobe(g, hc, (0, back, up), (RX + thick, RY + thick + 0.002, rz), segs=segs, rings=rings)


def _nape(g, hc, z=-0.03, w=0.15, h=0.1, segs=8, rings=4):
    _lobe(g, hc, (0, 0.085, z), (w, 0.1, h), segs=segs, rings=rings)


def _hair_cut_base(g, style, hc):
    if style == "crop":
        # ras: un centimètre de volume, ligne de nuque nette
        _cap(g, hc, thick=0.008, segs=10, rings=6, back=0.035, up=0.05, rz=0.135)
        _lobe(g, hc, (0, 0.1, -0.045), (0.14, 0.07, 0.055), segs=8, rings=4)
    elif style == "curls":
        # boucles courtes: boules facettées sur le dessus et les côtés, nuque dégagée
        _cap(g, hc, thick=0.012, segs=10, rings=6)
        for (x, y, z, r) in ((0.0, -0.06, 0.16, 0.05), (-0.08, -0.04, 0.15, 0.048), (0.08, -0.03, 0.15, 0.048),
                             (0.0, 0.05, 0.18, 0.052), (-0.12, 0.04, 0.12, 0.045), (0.12, 0.05, 0.12, 0.045),
                             (-0.155, -0.02, 0.06, 0.04), (0.155, -0.01, 0.06, 0.04)):
            _lobe(g, hc, (x, y, z), (r, r, r * 0.92), segs=6, rings=4, color="hair" if x <= 0 else "hair_dark")
    elif style == "ponytail":
        # tirés en arrière, queue attachée haut qui tombe à la nuque, au-dessus du foulard
        _cap(g, hc, thick=0.01)
        _nape(g, hc, z=-0.01, h=0.08)
        _lobe(g, hc, (0, 0.165, 0.08), (0.035, 0.03, 0.03), segs=6, rings=4, color="hair_dark")
        _lobe(g, hc, (0, 0.205, -0.03), (0.055, 0.05, 0.11), segs=8, rings=5, rot=(-14, 0, 0), bone="neck")
        _lobe(g, hc, (0, 0.215, -0.13), (0.035, 0.035, 0.04), segs=6, rings=4, bone="neck")
    elif style == "braid":
        # une tresse dans le dos jusqu'aux omoplates, cinq lobes, ruban au bout; décalée à droite du pan du foulard
        _cap(g, hc, thick=0.012)
        _nape(g, hc, z=-0.03)
        x = 0.035
        for i in range(5):
            z = -0.12 - i * 0.055
            _lobe(g, hc, (x, 0.19 + 0.006 * i, z), (0.038 - i * 0.002, 0.034, 0.036), segs=6, rings=4,
                  color="hair" if i % 2 == 0 else "hair_dark", bone="head" if i == 0 else "neck")
        _lobe(g, hc, (x, 0.22, -0.4), (0.03, 0.022, 0.018), segs=6, rings=3, color="hair_dark", bone="neck")
    elif style == "pigtails":
        # deux tresses courtes de part et d'autre, devant les épaules
        _cap(g, hc, thick=0.012)
        _nape(g, hc, z=-0.02, h=0.09)
        for sx in (1, -1):
            for i in range(4):
                _lobe(g, hc, (sx * 0.195, -0.04 - 0.018 * i, -0.06 - i * 0.05), (0.034, 0.032, 0.034), segs=6, rings=3,
                      color="hair" if i % 2 == 0 else "hair_dark")
            _lobe(g, hc, (sx * 0.195, -0.115, -0.265), (0.028, 0.02, 0.016), segs=6, rings=3, color="hair_dark")
    elif style == "wavy":
        # mi-long ondulé aux épaules, raie sur le côté (mèche plus haute à gauche)
        _cap(g, hc, thick=0.016, segs=10, rings=6, up=0.065)
        _lobe(g, hc, (-0.06, -0.09, 0.15), (0.11, 0.05, 0.045), segs=6, rings=4, rot=(18, 0, -12))
        for sx in (1, -1):
            for i, (y, z) in enumerate(((0.0, 0.0), (0.02, -0.07), (0.04, -0.12))):
                _lobe(g, hc, (sx * (0.172 + 0.012 * (i % 2)), y, z), (0.05, 0.1, 0.06), segs=6, rings=3,
                      color="hair" if i % 2 == 0 else "hair_dark")
        for i, z in enumerate((-0.04, -0.11)):
            _lobe(g, hc, (0, 0.1 + 0.01 * i, z), (0.17 - 0.01 * i, 0.08, 0.06), segs=6, rings=4)
    elif style == "long":
        # long lâché jusqu'au milieu du dos: un pan dans le dos (à droite du pan du foulard), deux devant les épaules
        _cap(g, hc, thick=0.016, segs=10, rings=6)
        _nape(g, hc, z=-0.05, w=0.17, h=0.12)
        for i in range(3):
            z = -0.17 - i * 0.11
            _lobe(g, hc, (0.03, 0.2 + 0.01 * i, z), (0.065 - 0.006 * i, 0.04, 0.075), segs=6, rings=4,
                  color="hair" if i % 2 == 0 else "hair_dark", bone="neck")
        for sx in (1, -1):
            for i in range(3):
                _lobe(g, hc, (sx * 0.19, -0.04 - 0.025 * i, -0.04 - i * 0.075), (0.042, 0.04, 0.06), segs=6, rings=3,
                      color="hair" if i % 2 == 0 else "hair_dark")
    elif style == "fringe":
        # frange droite sur les sourcils, nuque courte
        _cap(g, hc, thick=0.014, segs=10, rings=6)
        _lobe(g, hc, (0, -0.128, 0.115), (0.155, 0.042, 0.05), segs=10, rings=4, rot=(12, 0, 0))
        _nape(g, hc, z=-0.035, h=0.07)
        for sx in (1, -1):
            _lobe(g, hc, (sx * 0.172, -0.02, 0.05), (0.035, 0.08, 0.06), segs=6, rings=4)
    elif style == "quiff":
        # côtés courts, houppe relevée sur le devant
        _cap(g, hc, thick=0.008, segs=10, rings=6, rz=0.132)
        _lobe(g, hc, (0.01, -0.075, 0.19), (0.085, 0.075, 0.055), segs=8, rings=5, rot=(-28, 0, 6))
        _lobe(g, hc, (0.0, 0.03, 0.19), (0.08, 0.08, 0.04), segs=6, rings=4, color="hair_dark")
        _lobe(g, hc, (0, 0.1, -0.045), (0.14, 0.07, 0.055), segs=6, rings=4)
    elif style == "cloud":
        # nuage de boucles: masse ronde un tiers plus large que la tête, boucles en relief
        _lobe(g, hc, (0, 0.06, 0.07), (0.245, 0.215, 0.19), segs=12, rings=7)
        for k in range(8):
            a = math.radians(30 + k * 45)
            x, y = 0.205 * math.cos(a), 0.06 + 0.18 * math.sin(a)
            if y < -0.06:
                continue
            _lobe(g, hc, (x, y, 0.09 + 0.06 * (k % 2)), (0.075, 0.075, 0.07), segs=6, rings=4,
                  color="hair_dark" if k % 2 else "hair")
        for (x, z) in ((-0.07, 0.22), (0.06, 0.23)):
            _lobe(g, hc, (x, 0.0, z), (0.075, 0.075, 0.06), segs=6, rings=4, color="hair_dark")
    elif style == "crown":
        # tresse qui fait le tour de la tête au-dessus des oreilles (plus haute devant, au-dessus des sourcils)
        _cap(g, hc, thick=0.01)
        n = 12
        for k in range(n):
            a = 2 * math.pi * k / n
            x, y = (RX + 0.018) * math.sin(a), -(RY + 0.02) * math.cos(a) + 0.02
            z = 0.06 + 0.045 * math.cos(a)
            _lobe(g, hc, (x, y, z), (0.04, 0.04, 0.032), segs=6, rings=3, rot=(0, 0, -math.degrees(a)),
                  color="hair" if k % 2 == 0 else "hair_dark")
    elif style == "bob_long":
        # carré plongeant: plus long devant que derrière, pointes au menton
        _cap(g, hc, thick=0.016, segs=10, rings=6, up=0.065)
        _lobe(g, hc, (0, 0.085, -0.05), (0.18, 0.1, 0.1))
        _lobe(g, hc, (0.02, -0.1, 0.16), (0.14, 0.034, 0.04), segs=8, rings=4, rot=(15, 0, -6))
        for sx in (1, -1):
            _lobe(g, hc, (sx * 0.176, -0.04, -0.06), (0.05, 0.12, 0.13), segs=6, rings=5, rot=(28, 0, 0))
            _lobe(g, hc, (sx * 0.16, -0.12, -0.16), (0.035, 0.035, 0.04), segs=6, rings=4, color="hair_dark")
    else:
        raise ValueError(style)


# 0.12: mèches et volume (demande du client). Des mèches en lobes allongés couchées sur la calotte, du sommet
# vers la nuque, les tempes ou le front, une sur deux en `hair_dark`: la coupe se lit en mèches et non plus en
# casque, et gagne 6 à 8 mm de volume. Pas de mèches sur les variantes sous chapeau (cachées par la calotte du
# chapeau): `STRANDS` est mis à faux pendant leur construction.
STRANDS = True
_BACK = (-150, -110, -70, 70, 110, 150, 180)
STRAND_SETS = {
    # coupe: (azimuts en degrés, 0 devant et 90 à gauche; latitude; longueur; balayage vers la droite)
    "short": ((-145, -105, -65, -30, 5, 40, 75, 110, 150, 180), 40, 0.12, 18),
    "bob": ((-150, -115, -80, -45, 45, 80, 115, 150, 180), 32, 0.14, 0),
    "bun": ((-120, -80, -40, 0, 40, 80, 120), 38, 0.13, 0),
    "ponytail": ((-120, -80, -40, 0, 40, 80, 120), 38, 0.13, 0),
    "braid": ((-120, -80, -40, 0, 40, 80, 120), 38, 0.13, 0),
    "pigtails": ((-150, -110, -70, -30, 30, 70, 110, 150), 34, 0.13, 0),
    "wavy": ((-150, -110, -70, -30, 15, 55, 95, 135, 175), 34, 0.14, 22),
    "long": ((-150, -110, -70, -30, 30, 70, 110, 150), 34, 0.14, 0),

    "quiff": ((-120, -75, 75, 120, 180), 22, 0.09, 0),
    "crown": ((-120, -60, 0, 60, 120, 180), 62, 0.08, 0),
    "bob_long": ((-150, -115, -80, -45, 45, 80, 115, 150, 180), 32, 0.14, 14),
}
STRAND_SETS["fringe"] = (_BACK + (-35, 35), 38, 0.12, 0)


def strands(g, hc, style, back=0.04, up=0.06, rz=0.13, thick=0.014):
    from mathutils import Matrix, Vector
    cfg = STRAND_SETS.get(style)
    if not STRANDS or cfg is None:
        return
    thetas, lat, length, sweep = cfg
    A, B, C = RX + thick, RY + thick + 0.002, rz
    for i, th in enumerate(thetas):
        t, f = math.radians(th), math.radians(lat + (6 if abs(th) < 45 else 0))
        p = Vector((A * math.cos(f) * math.sin(t), back - B * math.cos(f) * math.cos(t), hc + up + C * math.sin(f)))
        n = Vector((p.x / A ** 2, (p.y - back) / B ** 2, (p.z - hc - up) / C ** 2)).normalized()
        up_t = Vector((-A * math.sin(f) * math.sin(t), B * math.sin(f) * math.cos(t), C * math.cos(f))).normalized()
        side = up_t.cross(n).normalized()
        sw = math.radians(sweep)
        along = (up_t * math.cos(sw) + side * math.sin(sw)).normalized()
        across = n.cross(along).normalized()  # repère direct (sinon la mèche sort retournée)
        R = Matrix((across, n, along)).transposed().to_4x4()
        # mèche droite posée sur la calotte courbe: le milieu affleure de 1 à 1,2 cm, les bouts rentrent dans la
        # calotte (flèche de la corde); une sur trois plus sombre pour séparer les mèches
        c = p + n * 0.004
        vs = g.sphere(1.0, color="hair_dark" if i % 3 == 1 else "hair", segs=6, rings=4,
                      scale=(0.03 + 0.004 * (i % 2), 0.008, length / 2), bone="head")
        g.transform(vs, Matrix.Translation(c) @ R)


def hair_cut(g, style, hc):
    _hair_cut_base(g, style, hc)
    strands(g, hc, style)


def facial(g, kind, hc):
    """Barbes et moustache sur la tête ronde du joueur. La bouche du joueur est haute (de hc - 0,02 à hc - 0,065
    selon l'expression) et le nez descend à hc - 0,016: la moustache tient juste sous le nez, en deux lobes
    fins qui bordent le haut de la bouche; les barbes restent sous la bouche ouverte (ravie) et le long de la
    mâchoire."""
    ry = RY

    def mustache(w=0.032, h=0.013):
        for sx in (1, -1):
            _lobe(g, hc, (sx * 0.027, -ry * 0.97 - 0.004, -0.017), (w, 0.02, h), segs=6, rings=4, rot=(0, sx * 16, 0))

    if kind == "mustache":
        mustache()
    elif kind == "beard_short":
        _lobe(g, hc, (0, -ry * 0.6, -0.12), (0.13, 0.06, 0.045), segs=10, rings=5)
        for sx in (1, -1):
            _lobe(g, hc, (sx * 0.15, -0.035, -0.065), (0.035, 0.08, 0.075), segs=6, rings=4)
        mustache(0.028, 0.011)
    elif kind == "beard_full":
        _lobe(g, hc, (0, -ry * 0.8, -0.14), (0.15, 0.075, 0.075), segs=10, rings=6)
        _lobe(g, hc, (0, -ry * 0.78, -0.195), (0.09, 0.06, 0.05), segs=8, rings=5, color="hair_dark")
        for sx in (1, -1):
            _lobe(g, hc, (sx * 0.15, -0.04, -0.065), (0.04, 0.09, 0.075), segs=6, rings=4)
        mustache(0.036, 0.015)
    else:
        raise ValueError(kind)
