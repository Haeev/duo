"""Tour 10 (conception 2.1): douze coupes nouvelles pour tous les personnages, et (réponse du client à la
question 2) barbe courte, barbe fournie et moustache, au choix de chacun.

Appelé par personnages.py. Repères de la tête ronde du joueur (PHEAD: demi-axes 0,18 x 0,165 x 0,17, centre hc):
devant vers -Y. Style des coupes existantes (`hair_round`): une calotte en ellipsoïde décalée vers le haut et
l'arrière, dont le devant rentre sous la peau au front (le front et les sourcils restent libres), et des mèches
en lobes facettés. Tout est lié à l'os `head`, sauf ce qui pend sous le crâne dans les coupes longues, qui
glisse vers `chest` (0.12.2, `settle` plus bas). Couleur: cases `hair` et `hair_dark` de la rangée du personnage
(le jeu y écrit l'une des huit couleurs, `PLAYER_PRESETS["hair_colors"]`).

Gardes (0.12.2, retour R01): rien ne pend devant les épaules ni n'entre dans le corps ou les vêtements du buste
(épaules des par-dessus: boules de 0,096 m en x +-0,2, z 1,305; capuche du ciré), ni devant les yeux (hc + 0,03).
Contrôle: `verifier/traversees_coiffures.py`.
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
        # tirés en arrière, queue attachée haut qui tombe à la nuque, au-dessus du col
        _cap(g, hc, thick=0.01)
        _nape(g, hc, z=-0.01, h=0.08)
        _lobe(g, hc, (0, 0.165, 0.08), (0.035, 0.03, 0.03), segs=6, rings=4, color="hair_dark")
        _lobe(g, hc, (0, 0.205, -0.03), (0.055, 0.05, 0.11), segs=8, rings=5, rot=(-14, 0, 0))
        _lobe(g, hc, (0, 0.215, -0.13), (0.035, 0.035, 0.04), segs=6, rings=4)
    elif style == "braid":
        # une tresse dans le dos jusqu'aux omoplates, cinq lobes, ruban au bout. 0.12.2: elle tombe d'aplomb à
        # 0,2 m derrière l'axe, au-dessus de la capuche roulée du ciré et du dos des par-dessus
        _cap(g, hc, thick=0.012)
        _nape(g, hc, z=-0.03)
        x = 0.035
        for i, y in enumerate((0.198, 0.205, 0.199, 0.196, 0.198)):
            z = -0.12 - i * 0.055
            _lobe(g, hc, (x, y, z), (0.038 - i * 0.002, 0.034, 0.036), segs=6, rings=4,
                  color="hair" if i % 2 == 0 else "hair_dark")
        _lobe(g, hc, (x, 0.204, -0.4), (0.03, 0.022, 0.018), segs=6, rings=3, color="hair_dark")
    elif style == "pigtails":
        # 0.12.2 (retour R01): deux nattes attachées derrière les oreilles, qui tombent derrière les épaules sur
        # le haut du dos. Les mèches se rassemblent en une touffe posée sur le crâne (rien ne pend dans le vide),
        # un lien sombre, puis quatre lobes tressés qui suivent la pente du dos du par-dessus le plus épais.
        _cap(g, hc, thick=0.012)
        _nape(g, hc, z=-0.02, h=0.09)
        for sx in (1, -1):
            _lobe(g, hc, (sx * 0.128, 0.104, -0.04), (0.056, 0.054, 0.062), segs=6, rings=4)
            _lobe(g, hc, (sx * 0.142, 0.124, -0.094), (0.036, 0.032, 0.02), segs=6, rings=3, color="hair_dark")
            for i, (x, y, z) in enumerate(((0.148, 0.128, -0.13), (0.146, 0.13, -0.178), (0.142, 0.142, -0.226),
                                           (0.138, 0.152, -0.274))):
                _lobe(g, hc, (sx * x, y, z), (0.033 - 0.0015 * i, 0.03, 0.034), segs=6, rings=3,
                      color="hair" if i % 2 == 0 else "hair_dark")
            _lobe(g, hc, (sx * 0.135, 0.16, -0.318), (0.022, 0.019, 0.026), segs=6, rings=3, color="hair_dark")
    elif style == "wavy":
        # mi-long ondulé jusqu'à la base du cou, raie sur le côté (mèche plus haute à gauche). 0.12.2: les ondulations
        # des côtés remontent et partent vers l'arrière, au-dessus des épaules (elles entraient dans les manches)
        _cap(g, hc, thick=0.016, segs=10, rings=6, up=0.065)
        _lobe(g, hc, (-0.06, -0.09, 0.15), (0.11, 0.05, 0.045), segs=6, rings=4, rot=(18, 0, -12))
        for sx in (1, -1):
            for i, (y, z) in enumerate(((0.0, 0.0), (0.03, -0.062), (0.068, -0.1))):
                _lobe(g, hc, (sx * (0.168 + 0.012 * (i % 2)), y, z), (0.05, 0.1, 0.056), segs=6, rings=4,
                      color="hair" if i % 2 == 0 else "hair_dark")
        for (y, z, w, h) in ((0.1, -0.04, 0.17, 0.06), (0.12, -0.08, 0.13, 0.055)):
            _lobe(g, hc, (0, y, z), (w, 0.075, h), segs=8, rings=5)
    elif style == "long":
        # long lâché jusqu'au milieu du dos. 0.12.2 (retour R01): plus de mèches devant les épaules (elles
        # traversaient le haut); deux mèches derrière les oreilles qui s'arrêtent au-dessus des épaules, et un
        # rideau de trois colonnes de lobes qui tombe dans le dos, posé sur le dos du par-dessus le plus épais
        _cap(g, hc, thick=0.016, segs=10, rings=6)
        _nape(g, hc, z=-0.03, w=0.17, h=0.1)
        for sx in (1, -1):
            _lobe(g, hc, (sx * 0.163, 0.05, -0.06), (0.042, 0.075, 0.08), segs=6, rings=4)
        # rideau: rangées de lobes larges et plats qui se chevauchent (une nappe, pas des boudins), plus étroites
        # vers les pointes
        # raccord entre la nuque et le rideau (sans lui, le rideau semblait détaché de la tête, vu de profil)
        _lobe(g, hc, (0, 0.18, -0.09), (0.13, 0.05, 0.075), segs=8, rings=4)
        for i, (z, y, w) in enumerate(((-0.15, 0.205, 0.125), (-0.23, 0.193, 0.115), (-0.305, 0.194, 0.095),
                                       (-0.37, 0.197, 0.06))):
            _lobe(g, hc, (0.006 * (i % 2), y, z), (w, 0.036, 0.066), segs=8, rings=4,
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
        # 0.12.2: côtés inclinés vers l'avant (pointes devant, nuque plus courte), nuque remontée au-dessus du col;
        # avant, les côtés penchaient vers l'arrière et entraient dans les épaules
        _cap(g, hc, thick=0.016, segs=10, rings=6, up=0.065)
        _lobe(g, hc, (0, 0.085, -0.04), (0.18, 0.1, 0.095))
        _lobe(g, hc, (0.02, -0.1, 0.16), (0.14, 0.034, 0.04), segs=8, rings=4, rot=(15, 0, -6))
        for sx in (1, -1):
            _lobe(g, hc, (sx * 0.168, -0.035, -0.01), (0.042, 0.105, 0.11), segs=6, rings=5, rot=(-12, 0, 0))
            _lobe(g, hc, (sx * 0.158, -0.105, -0.135), (0.035, 0.036, 0.046), segs=6, rings=4, color="hair_dark")
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


# 0.12.2 (retour R01 du 2026-11-03): les coupes qui descendent sous la tête se posent sur les vêtements au lieu de
# les traverser. Deux règles, appliquées par `settle` à toutes ces coupes:
# 1. au repos, tout sommet de la coupe qui entre dans le corps ou dans un vêtement (tous les hauts, la salopette,
#    tous les par-dessus) ressort à 4 mm de sa surface: la coupe repose sur l'enveloppe la plus épaisse;
# 2. ce qui pend sous le crâne suit le buste et non la tête: poids glissant de `head` (au-dessus de 1,45 m) à
#    `chest` (sous 1,36 m). Sinon une natte liée à la tête balaie le dos et les épaules dès que la tête tourne ou se
#    lève (jusqu'à 36 degrés dans `look_up`, 22 dans `chop`).
PP = None            # module personnages (posé par personnages.py): gabarits des vêtements
LONG_CUTS = ("bob", "ponytail", "braid", "pigtails", "wavy", "long", "bob_long")
HANG_TOP, HANG_BOT = 1.45, 1.36
CLEAR = 0.004
_GARMENTS = []


def _garment_trees():
    """Îlots (pièces) du corps et de tous les vêtements du buste, au repos: (min, max, arbre BVH)."""
    if _GARMENTS:
        return _GARMENTS
    import garde_robe as GR
    import lpl
    from mathutils import Vector
    from mathutils.bvhtree import BVHTree
    builders = [lambda g: GR.body(g, PP), lambda g: GR.bottom(g, PP, "salopette")]
    builders += [lambda g, s=s: GR.top(g, PP, s) for s in GR.STYLES["top"]]
    builders += [lambda g, s=s: GR.outer(g, PP, s) for s in GR.STYLES["outer"]]
    for build in builders:
        g = lpl.Geo(GR.wear_cells())
        build(g)
        seen = set()
        for v0 in g.bm.verts:
            if v0 in seen:
                continue
            island, stack = [], [v0]
            seen.add(v0)
            while stack:
                v = stack.pop()
                island.append(v)
                for e in v.link_edges:
                    w = e.other_vert(v)
                    if w not in seen:
                        seen.add(w)
                        stack.append(w)
            idx = {v: i for i, v in enumerate(island)}
            polys = [[idx[v] for v in f.verts] for f in {f for v in island for f in v.link_faces}]
            if not polys:
                continue
            co = [v.co.copy() for v in island]
            lo = Vector((min(c.x for c in co), min(c.y for c in co), min(c.z for c in co)))
            hi = Vector((max(c.x for c in co), max(c.y for c in co), max(c.z for c in co)))
            _GARMENTS.append((lo, hi, BVHTree.FromPolygons(co, polys)))
        g.bm.free()
    return _GARMENTS


def settle(g, style, hc):
    """Pose les coupes longues sur les vêtements et lie au buste ce qui pend (voir plus haut)."""
    if style not in LONG_CUTS:
        return
    trees = _garment_trees()
    for _ in range(4):
        moved = 0
        for v in g.bm.verts:
            p = v.co.copy()
            # au-dessus du col, ou caché dans la tête: rien à faire
            if p.z > HANG_TOP + 0.02 or (p.x / 0.18) ** 2 + (p.y / 0.165) ** 2 + ((p.z - hc) / 0.17) ** 2 < 1.0:
                continue
            for lo, hi, tree in trees:
                if not (lo.x - CLEAR <= p.x <= hi.x + CLEAR and lo.y - CLEAR <= p.y <= hi.y + CLEAR
                        and lo.z - CLEAR <= p.z <= hi.z + CLEAR):
                    continue
                loc, nor, _, dist = tree.find_nearest(p)
                if loc is not None and (p - loc).dot(nor) < CLEAR and dist < 0.05:
                    p = loc + nor * CLEAR
                    moved += 1
            v.co = p
        if not moved:
            break
    head, chest = g.bone_index("head"), g.bone_index("chest")
    for v in g.bm.verts:
        t = min(1.0, max(0.0, (v.co.z - HANG_BOT) / (HANG_TOP - HANG_BOT)))
        s = t * t * (3 - 2 * t)
        if s >= 1.0:
            continue
        v[g.dl].clear()
        if s > 0:
            v[g.dl][head] = s
        v[g.dl][chest] = 1.0 - s
    g.bm.normal_update()


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
