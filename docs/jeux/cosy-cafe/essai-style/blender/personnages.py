"""Personnages posés de l'essai (immobiles): trois clients et les deux avatars des joueurs.

Corps simplifiés de la bible (7): tête un peu large, torse en tonneau, mains en moufles, pieds en galets.
Variante A: 6,6 têtes (tête de 27 cm pour 1,80 m), formes gonflées; variante B: proportions réelles (7,5 têtes).
Construits face au sud (+y du plan) autour de l'origine, puis tournés vers leur cap (0 = nord, 90 = est).
Pas de squelette: c'est un essai de rendu, les clips viendront avec le squelette commun (technique 4.1).
"""

import math

from mathutils import Vector

from geo import Geo, P, pans
import geo as G
import scene_cafe as S


def _ik(sh, target, l1, l2, hint):
    """Coude d'un bras à deux segments (points du plan), plié vers `hint`."""
    s = Vector(sh)
    t = Vector(target)
    d = t - s
    dist = min(d.length, l1 + l2 - 1e-3)
    u = d.normalized()
    t = s + u * dist
    a = (l1 * l1 - l2 * l2 + dist * dist) / (2 * dist)
    h = math.sqrt(max(0.0, l1 * l1 - a * a))
    w = Vector(hint)
    w = (w - u * w.dot(u)).normalized()
    e = s + u * a + w * h
    return tuple(e), tuple(t)


class Corps:
    def __init__(self, nom, spec, joueurs):
        self.g = Geo(nom, kind="char", smooth=True)
        self.s = spec
        self.j = joueurs
        A = G.STYLE.name == "A"
        H = spec.get("height", 1.75)
        self.k = H / 1.75
        self.hh = (0.27 if A else 0.225) * H / 1.8  # hauteur de la tête
        self.hr = self.hh * 0.5
        self.sy = 0.66  # profondeur relative du torse
        self.puff = 1.08 if A else 1.0
        self.seated = spec.get("pose") == "sit"
        self.dz = -0.38 * self.k if self.seated else 0.0
        self.seg = pans(12)

    def z(self, v):
        return v * self.k + self.dz

    def torse_r(self, zz):
        """Rayon du torse à la hauteur zz (repère debout, avant décalage)."""
        k = self.k
        prof = [(0.86 * k, 0.145), (1.0 * k, 0.14), (1.22 * k, 0.17), (1.38 * k, 0.165), (1.44 * k, 0.1)]
        for (z0, r0), (z1, r1) in zip(prof, prof[1:]):
            if z0 <= zz <= z1:
                return (r0 + (r1 - r0) * (zz - z0) / (z1 - z0)) * self.puff
        return 0.1 * self.puff

    def surface(self, x, zz, back=True, off=0.012):
        r = self.torse_r(zz)
        x = max(-r * 0.95, min(r * 0.95, x))
        y = self.sy * math.sqrt(max(0.0, r * r - x * x)) + off
        return (x, -y if back else y, zz + self.dz)

    def build(self):
        g, s, k = self.g, self.s, self.k
        top, bottom = s["top"], s["bottom"]
        skin, hair = s["skin"], s["hair"]
        shoes = s.get("shoes", "#3A2C25")
        seg = self.seg
        # jambes
        for side in (-1, 1):
            hip = (side * 0.09 * k, 0.0, self.z(0.88))
            if self.seated:
                knee = (side * 0.1 * k, 0.42 * k, self.z(0.88) + 0.0)
                ankle = (side * 0.1 * k, 0.46 * k, 0.09)
            else:
                knee = (side * 0.095 * k, 0.01, 0.5 * k)
                ankle = (side * 0.095 * k, 0.0, 0.09)
            g.rod(hip, knee, 0.068 * self.puff, seg, bottom)
            g.sphere(*knee, 0.062 * self.puff, 0.062 * self.puff, 0.062 * self.puff, bottom, segs=seg, rings=6)
            g.rod(knee, ankle, 0.052 * self.puff, seg, bottom)
            g.sphere(ankle[0], ankle[1] + 0.04, 0.045, 0.055, 0.12, 0.05, shoes, segs=seg, rings=6, zcut=-0.045)
        # bassin et torse
        g.sphere(0, 0, self.z(0.9), 0.15 * self.puff, 0.15 * self.puff * self.sy, 0.1, bottom, segs=seg, rings=6)
        prof = [(0.145, 0.86), (0.14, 1.0), (0.17, 1.22), (0.165, 1.38), (0.1, 1.44), (0.0, 1.46)]
        g.lathe(0, 0, 0, [(r * self.puff, self.z(zz)) for r, zz in prof], seg, top, cap_bottom=True, cap_top=False, sy=self.sy)
        coat = s.get("coat")
        if coat and not self.seated:
            g.lathe(0, 0, 0, [(0.2 * self.puff, 0.5 * k), (0.175 * self.puff, 0.86 * k), (0.15 * self.puff, 1.0 * k), (0.178 * self.puff, 1.22 * k),
                              (0.172 * self.puff, 1.38 * k), (0.11 * self.puff, 1.44 * k)], seg, coat, cap_bottom=False, cap_top=False, sy=self.sy * 1.05)
        # cou et tête
        zc = self.z(1.75 * k / k) if False else (s.get("height", 1.75) - self.hr) + self.dz
        g.cyl(0, 0, self.z(1.4), zc - self.hr * 0.6, 0.05 * self.puff, seg, skin)
        self.zc = zc
        head = []
        head += g.sphere(0, 0, zc, self.hr * 0.92, self.hr * 0.95, self.hr, skin, segs=pans(14), rings=10)
        # yeux, nez
        A = G.STYLE.name == "A"
        er = self.hr * (0.11 if A else 0.075)
        for side in (-1, 1):
            head += g.sphere(side * self.hr * 0.36, self.hr * 0.86, zc + self.hr * 0.05, er, er * 0.6, er * 1.2, "ink", segs=8, rings=5)
            if s.get("brows", True):
                head += g.box(side * self.hr * 0.36 - self.hr * 0.12, side * self.hr * 0.36 + self.hr * 0.12, self.hr * 0.84, self.hr * 0.9,
                              zc + self.hr * 0.24, zc + self.hr * 0.26 + (0.006 if s.get("mood") == "attend" else 0), hair, bevel=0.003)
        head += g.sphere(0, self.hr * 0.95, zc - self.hr * 0.12, self.hr * 0.12, self.hr * 0.12, self.hr * 0.14, skin, segs=8, rings=5)
        mw = self.hr * (0.22 if s.get("mood") in ("content", "ravi") else 0.14)
        head += g.box(-mw, mw, self.hr * 0.8, self.hr * 0.86, zc - self.hr * 0.42, zc - self.hr * 0.38, "#6E3238", bevel=0.002)
        # oreilles
        for side in (-1, 1):
            head += g.sphere(side * self.hr * 0.92, 0, zc, self.hr * 0.12, self.hr * 0.18, self.hr * 0.22, skin, segs=8, rings=5)
        head += self.cheveux(zc)
        if s.get("player"):
            head += self.bandeau(zc)
        if s.get("head_yaw"):
            Geo.rotate_z(head, 0, 0, s["head_yaw"])
        # bras
        for side in (-1, 1):
            self.bras(side)
        if s.get("scarf"):
            self.echarpe(s["scarf"])
        if s.get("bag"):
            self.sacoche(s["bag"])
        if s.get("player"):
            self.tablier()
        return g

    def cheveux(self, zc):
        g, s, r = self.g, self.s, self.hr
        style = s.get("hair_style", "short")
        hair = s["hair"]
        out = []
        out += g.sphere(0, -r * 0.08, zc + r * 0.12, r * 0.98, r * 1.0, r * 0.95, hair, segs=pans(14), rings=8, zcut=-r * 0.1)
        if style == "long":
            out += g.sphere(0, -r * 0.45, zc - r * 0.55, r * 0.95, r * 0.55, r * 1.0, hair, segs=pans(12), rings=8)
        elif style == "bun":
            out += g.sphere(0, -r * 0.7, zc + r * 0.65, r * 0.42, r * 0.42, r * 0.42, hair, segs=10, rings=6)
        elif style == "curly":
            for i in range(7):
                a = 2 * math.pi * i / 7
                out += g.sphere(r * 0.6 * math.cos(a), -r * 0.1 + r * 0.5 * math.sin(a), zc + r * 0.7, r * 0.38, r * 0.38, r * 0.32, hair, segs=8, rings=5)
        return out

    def bandeau(self, zc):
        """Bandeau noué à la couleur du joueur: bande au front, nœud et deux pans dans le dos."""
        g, r = self.g, self.hr
        col = self.s["player"]["color"]
        out = []
        out += g.lathe(0, -r * 0.08, zc + r * 0.18, [(r * 1.0, 0), (r * 1.02, r * 0.02), (r * 0.98, r * 0.26)], pans(14), col,
                       cap_bottom=False, cap_top=False, sy=1.0)
        out += g.sphere(0, -r * 1.06, zc + r * 0.28, r * 0.17, r * 0.14, r * 0.14, col, segs=8, rings=5)
        for side in (-1, 1):
            out += g.rod((side * r * 0.05, -r * 1.1, zc + r * 0.22), (side * r * 0.25, -r * 1.15, zc - r * 0.55), r * 0.07, 6, col)
        return out

    def bras(self, side):
        g, s, k = self.g, self.s, self.k
        sleeve = s.get("coat") if (s.get("coat") and not self.seated) else s["top"]
        skin = s["skin"]
        sh = (side * 0.2 * k * self.puff, 0.0, self.z(1.38))
        l1, l2 = 0.29 * k, 0.27 * k
        pose = s.get("arms", {}).get(side, "down")
        if isinstance(pose, tuple):
            target = (side * abs(pose[0]) if pose[0] >= 0 else pose[0] * side, pose[1], pose[2])
            elbow, wrist = _ik(sh, target, l1, l2, (side * 0.8, -0.3, -1.0))
        elif pose == "tray":
            target = (side * 0.27 * k, 0.1, self.z(1.48))
            elbow, wrist = _ik(sh, target, l1, l2, (side * 1.0, 0.1, -1.0))
        else:
            elbow = (side * 0.22 * k * self.puff, 0.02, self.z(1.1))
            wrist = (side * 0.23 * k * self.puff, 0.05, self.z(0.84))
        g.sphere(*sh, 0.06 * self.puff, 0.06 * self.puff, 0.06 * self.puff, sleeve, segs=self.seg, rings=6)
        g.rod(sh, elbow, 0.048 * self.puff, self.seg, sleeve)
        g.sphere(*elbow, 0.045 * self.puff, 0.045 * self.puff, 0.045 * self.puff, sleeve, segs=self.seg, rings=6)
        g.rod(elbow, wrist, 0.042 * self.puff, self.seg, sleeve)
        if s.get("player"):
            # poignet à la couleur du joueur
            d = Vector(wrist) - Vector(elbow)
            a = Vector(wrist) - d.normalized() * 0.05
            g.rod(tuple(a), wrist, 0.047 * self.puff, self.seg, s["player"]["color"])
        hs = 0.052 if G.STYLE.name == "A" else 0.045
        d = (Vector(wrist) - Vector(elbow)).normalized()
        hand = Vector(wrist) + d * hs * 0.8
        g.sphere(*hand, hs, hs, hs * 1.1, skin, segs=self.seg, rings=6)
        if pose == "tray":
            tz = hand.z + hs
            g.cyl(hand.x - side * 0.08, hand.y + 0.02, tz, tz + 0.015, 0.19, pans(16), "tray", bevel=0.005)
            for (dx, dy, kind) in ((-0.06, -0.04, "cappuccino"), (0.06, 0.06, "espresso")):
                S.tasse(g, hand.x - side * 0.08 + dx, hand.y + 0.02 + dy, tz + 0.015, kind)
        self.hands = getattr(self, "hands", {})
        self.hands[side] = tuple(hand)

    def echarpe(self, col):
        g = self.g
        z = self.z(1.43)
        for i in range(12):
            a0 = 2 * math.pi * i / 12
            a1 = 2 * math.pi * (i + 1) / 12
            g.rod((0.11 * math.cos(a0), 0.08 * math.sin(a0), z), (0.11 * math.cos(a1), 0.08 * math.sin(a1), z), 0.035, 8, col)
        g.rod((0.05, 0.09, z), (0.07, 0.13, self.z(1.1)), 0.03, 8, col)

    def sacoche(self, col):
        g = self.g
        pts = [self.surface(0.13 * self.k, self.z(1.38) - self.dz, back=False, off=0.01)]
        for t in (0.25, 0.5, 0.75):
            zz = self.z(1.38 - 0.4 * t) - self.dz
            pts.append(self.surface((0.13 - 0.3 * t) * self.k, zz, back=False, off=0.012))
        pts.append((-0.2 * self.k, 0.02, self.z(0.95)))
        for a, b in zip(pts, pts[1:]):
            g.rod(a, b, 0.012, 6, col)
        g.box(-0.24 * self.k, -0.17 * self.k, -0.1, 0.12, self.z(0.8), self.z(0.98), col, bevel=0.02)

    def tablier(self):
        """Tablier à bretelles croisées du joueur: bavette et poche au symbole devant, X bordé du liseré sombre
        et écusson de 20 cm au symbole dans le dos (bible 7.1)."""
        g, s, k = self.g, self.s, self.k
        col = s["player"]["color"]
        clip = s["player"]["clip"]
        piping = "piping"
        # jupe du tablier (devant), de la taille aux genoux
        if not self.seated:
            vs = g.lathe(0, 0, 0, [(0.2 * self.puff, 0.52 * k), (0.17 * self.puff, 0.86 * k), (0.155 * self.puff, 1.02 * k)], pans(16), col,
                         cap_bottom=False, cap_top=False, sy=self.sy * 1.12)
            kill = [f for f in {f for v in vs for f in v.link_faces} if f.calc_center_median().y > 0.02]
            import bmesh
            bmesh.ops.delete(g.bm, geom=kill, context="FACES_ONLY")
        # bavette (devant du torse)
        vs = g.lathe(0, 0, 0, [(self.torse_r(1.02 * k) * 1.03, self.z(1.02)), (self.torse_r(1.22 * k) * 1.03, self.z(1.22)),
                               (self.torse_r(1.34 * k) * 1.03, self.z(1.34))], pans(16), col, cap_bottom=False, cap_top=False, sy=self.sy * 1.03)
        import bmesh
        kill = [f for f in {f for v in vs for f in v.link_faces} if abs(f.calc_center_median().x) > 0.12 * k or f.calc_center_median().y > -0.01]
        bmesh.ops.delete(g.bm, geom=list(set(kill)), context="FACES_ONLY")
        # poche au symbole (13 cm)
        py = self.surface(0, 1.12 * k, back=False, off=0.02)[1]
        g.box(-0.07, 0.07, py - 0.01, py, self.z(1.06), self.z(1.17), col, bevel=0.006)
        S.symbole(g, clip, 0, py + 0.0005, self.z(1.115), 0.09, facing=1)
        # bretelles croisées dans le dos (liseré sombre dessous, couleur dessus)
        for side in (-1, 1):
            pts = []
            for i in range(7):
                t = i / 6
                zz = (1.42 - 0.42 * t) * k
                x = side * (0.1 - 0.22 * t) * k
                pts.append((x, zz))
            for (x0, z0), (x1, z1) in zip(pts, pts[1:]):
                a = self.surface(x0, z0, off=0.008)
                b = self.surface(x1, z1, off=0.008)
                g.rod(a, b, 0.024, 6, piping)
                a = self.surface(x0, z0, off=0.016)
                b = self.surface(x1, z1, off=0.016)
                g.rod(a, b, 0.019, 6, col)
            # passage sur l'épaule vers la bavette
            a = self.surface(side * 0.1 * k, 1.42 * k, off=0.016)
            b = self.surface(side * 0.1 * k, 1.34 * k, back=False, off=0.012)
            g.rod(a, (side * 0.1 * k, 0.0, self.z(1.45)), 0.02, 6, col)
            g.rod((side * 0.1 * k, 0.0, self.z(1.45)), b, 0.02, 6, col)
        # lien de taille
        g.lathe(0, 0, 0, [(self.torse_r(1.0 * k) * 1.05, self.z(0.99)), (self.torse_r(1.03 * k) * 1.05, self.z(1.03))], pans(16), col,
                cap_bottom=False, cap_top=False, sy=self.sy * 1.05)
        # écusson au croisement des bretelles: disque à liseré sombre, symbole en « player_on »
        zc = 1.22 * k
        yb = self.surface(0, zc, off=0.03)[1]
        disc(g, 0, yb, self.z(1.22), 0.108, "piping", facing=-1)
        disc(g, 0, yb - 0.004, self.z(1.22), 0.1, col, facing=-1)
        S.symbole(g, clip, 0, yb - 0.006, self.z(1.22), 0.17, facing=-1)


def disc(g, x, y, z, r, key, facing):
    n = pans(16)
    pts = [(x + facing * r * math.cos(2 * math.pi * i / n), y, z + r * math.sin(2 * math.pi * i / n)) for i in range(n)]
    g.quad(pts, key, normal_hint=(0, facing, 0))
    # épaisseur: un second disque en retrait, dos tourné
    pts2 = [(px, y - facing * 0.006, pz) for px, _, pz in pts]
    g.quad(list(reversed(pts2)), key, normal_hint=(0, -facing, 0))


def poser(corps, x, y, cap):
    """Tourne le personnage vers son cap (0 nord, 90 est, 180 sud, 270 ouest) et le place en (x, y)."""
    g = corps.g
    vs = list(g.bm.verts)
    Geo.rotate_z(vs, 0, 0, cap - 180)
    Geo.move(vs, x, y, 0)


def construire(PAL):
    C = PAL["couleurs"]
    peaux, cheveux = PAL["peaux"], PAL["cheveux"]
    J = PAL["joueurs"]
    out = []

    # 1. la cliente à la caisse (pressée): manteau mastic, sacoche cognac; main posée sur la tablette
    c = Corps("char_client_register", {
        "height": 1.68, "skin": peaux[1], "hair": cheveux[2], "hair_style": "long", "top": C["presses_navy"], "bottom": C["presses_navy"],
        "coat": C["presses_coat"], "bag": C["presses_bag"], "mood": "content",
        "arms": {1: (0.12, 0.4, 1.12), -1: "down"},
    }, J)
    c.build()
    poser(c, 10.55, 10.02, 0)
    out.append(c.g)

    # 2. le client qui lit la carte (flâneur), assis face à l'ouest à la table de la vitrine
    c = Corps("char_client_reading", {
        "height": 1.78, "pose": "sit", "skin": peaux[4], "hair": cheveux[0], "hair_style": "short", "top": C["flaneurs_knit"],
        "bottom": C["flaneurs_cord"], "scarf": C["flaneurs_scarf"], "mood": "neutre",
        "arms": {1: (0.17, 0.32, 1.0), -1: (0.17, 0.32, 1.0)},
    }, J)
    c.build()
    # carte ouverte tenue entre les mains
    hz = (c.hands[1][2] + c.hands[-1][2]) / 2
    for side in (-1, 1):
        c.g.quad([(0, 0.36, hz - 0.12), (side * 0.2, 0.33, hz - 0.12), (side * 0.2, 0.33, hz + 0.16), (0, 0.36, hz + 0.16)], "paper", normal_hint=(0, -1, 0))
        c.g.quad([(0, 0.365, hz - 0.12), (side * 0.2, 0.335, hz - 0.12), (side * 0.2, 0.335, hz + 0.16), (0, 0.365, hz + 0.16)], "house_bottle", normal_hint=(0, 1, 0))
    poser(c, 8.6, 12.2, 270)
    out.append(c.g)

    # 3. la cliente qui attend, carte fermée posée: assise face au nord, regard vers le comptoir (est)
    c = Corps("char_client_waiting", {
        "height": 1.64, "pose": "sit", "skin": peaux[0], "hair": cheveux[5], "hair_style": "bun", "top": C["gourmands_raspberry"],
        "bottom": C["etudiants_denim"], "mood": "attend", "head_yaw": 55,
        "arms": {1: (0.16, 0.36, 0.78), -1: (0.16, 0.36, 0.78)},
    }, J)
    c.build()
    poser(c, 4.35, 10.78, 0)
    out.append(c.g)

    # 4. l'avatar de l'astre aqua (couleur la plus claire: haut sombre), de dos, plateau vers la vitrine
    c = Corps("char_player_orb", {
        "height": 1.76, "skin": peaux[3], "hair": cheveux[1], "hair_style": "short", "top": C["top_dark_indigo"],
        "bottom": C["presses_charcoal"], "player": {"color": J["orb"]["couleur"], "clip": "orb"},
        "arms": {-1: "tray", 1: "down"},
    }, J)
    c.build()
    poser(c, 6.75, 10.95, 185)
    out.append(c.g)

    # 5. l'avatar du croissant mauve (haut clair), de face derrière la caisse, mains sur le plan de travail
    c = Corps("char_player_crescent", {
        "height": 1.66, "skin": peaux[2], "hair": cheveux[3], "hair_style": "curly", "top": C["top_light_cream"],
        "bottom": C["etudiants_denim"], "player": {"color": J["crescent"]["couleur"], "clip": "crescent"}, "mood": "content",
        "arms": {1: (0.17, 0.42, 0.99), -1: (0.17, 0.42, 0.99)},
    }, J)
    c.build()
    poser(c, 10.35, 8.32, 180)
    out.append(c.g)
    return out
