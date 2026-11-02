"""Dame blanche (effraie des clochers) et campagnol (tour 9, moment barn_owl, tour-09-conception.md section 4.3):
squelette, maillage et clips, appelés par faune.py (faune.glb).

0,35 m de haut posée, 0,9 m d'envergure; dos chamois, ventre et face blancs, face en coeur cerclée de chamois
(elle se lit de loin: claire sur l'herbe sombre du soir). Au repos du squelette, elle est debout (posée sur le
rocher) et ses ailes de vol sont dans le plan du dos (XZ): penchée en avant pour voler (racine inclinée de 75 à
85 degrés), ce plan devient horizontal. Ailes repliées: coquilles chamois sur les flancs, ailes de vol réduites
dans le corps (même procédé que le héron).
"""
import math

import bpy  # noqa: F401,I001
from mathutils import Matrix, Vector

from faune import R, Rig, banded_ball, ell, merge, mirror, plate, seg
from lpl import by_normal

OWL_BONES = [
    ("owl_root", (0, 0, 0), (0, 0, 0.08), None),
    ("owl_body", (0, 0.03, 0.09), (0, -0.01, 0.25), "owl_root"),
    ("owl_head", (0, -0.01, 0.255), (0, -0.01, 0.34), "owl_body"),
    ("owl_wing_l", (0.05, 0.02, 0.22), (0.22, 0.02, 0.22), "owl_body"),
    ("owl_wingtip_l", (0.22, 0.02, 0.22), (0.45, 0.02, 0.22), "owl_wing_l"),
    ("owl_wing_r", (-0.05, 0.02, 0.22), (-0.22, 0.02, 0.22), "owl_body"),
    ("owl_wingtip_r", (-0.22, 0.02, 0.22), (-0.45, 0.02, 0.22), "owl_wing_r"),
    ("owl_leg_l", (0.03, 0.01, 0.1), (0.03, 0.0, 0.015), "owl_root"),
    ("owl_leg_r", (-0.03, 0.01, 0.1), (-0.03, 0.0, 0.015), "owl_root"),
]
BEAK = Vector((0.0, -0.088, 0.288))


def _wing_plate(g, outline, shoulder, t0, t1, bone):
    """Aile de vol dans le plan du dos (XZ au repos): contour (x, corde), corde vers le bas (la queue), dessus
    chamois vers le dos (+Y), dessous blanc."""
    vs = plate(g, outline, 0.0, t0, t1, "owl_buff", "feather_white", bone=bone)
    # le dessus du contour (+Z) devient le dos (+Y): couleurs déjà justes
    g.transform(vs, Matrix.Translation(shoulder) @ Matrix.Rotation(math.radians(-90), 4, "X"))
    return vs


def owl_mesh(A):
    g = A.geo()
    b, h = "owl_body", "owl_head"
    # corps en oeuf: ventre blanc (devant, -Y), dos chamois (+Y) en bandes de facettes
    def body_color(band, face):
        return "owl_buff" if face.normal.y > 0.25 else "feather_white"
    banded_ball(g, (0.082, 0.085, 0.125), (0, 0.015, 0.175), [0, 25, 55, 85, 115, 150, 180], 9, body_color, b)
    # ailes repliées: coquilles chamois couchées sur les flancs, pointes grises croisées sur la queue
    for s in (1, -1):
        ell(g, (0.024, 0.062, 0.105), (s * 0.064, 0.04, 0.175), "owl_buff", b, segs=7, rings=5, rot=(-12, 0, s * 6))
        ell(g, (0.014, 0.024, 0.05), (s * 0.026, 0.078, 0.075), "heron_grey", b, segs=6, rings=3, rot=(-20, 0, s * 12))
    ell(g, (0.05, 0.022, 0.05), (0, 0.075, 0.06), "owl_buff", b, segs=6, rings=3, rot=(-25, 0, 0))
    # tête ronde un peu aplatie, dessus chamois; face en coeur blanche cerclée de chamois, deux yeux noirs
    def head_color(band, face):
        return "owl_buff" if face.normal.y > -0.35 or band == 0 else "feather_white"
    banded_ball(g, (0.072, 0.06, 0.06), (0, 0.0, 0.3), [0, 30, 60, 95, 130, 180], 9, head_color, h)
    heart = [(0.0, -0.05), (0.035, -0.03), (0.058, 0.01), (0.056, 0.042), (0.03, 0.052), (0.0, 0.036),
             (-0.03, 0.052), (-0.056, 0.042), (-0.058, 0.01), (-0.035, -0.03)]
    heart = [(x * 0.92, y) for x, y in heart]
    rim = [(x * 1.08, y * 1.1 + 0.002) for x, y in heart]
    for outline, y0, t, col in ((rim, -0.035, 0.03, "owl_buff"), (heart, -0.052, 0.012, "feather_white")):
        vs = plate(g, outline, 0.0, t, t, col, col, bone=h)
        g.transform(vs, Matrix.Translation((0, y0, 0.298)) @ Matrix.Rotation(math.radians(90), 4, "X"))
    for s in (1, -1):
        g.box((0.014, 0.006, 0.012), loc=(s * 0.024, -0.06, 0.306), color="black", bone=h)
    seg(g, (0, -0.056, 0.296), BEAK, 0.008, 0.002, "egg", h, segs=5)
    # ailes de vol (réduites au repos par les clips)
    for s, side in ((1, "l"), (-1, "r")):
        inner = [(0.0, -0.07), (0.17, -0.07), (0.17, 0.13), (0.0, 0.11)]
        outer = [(0.0, -0.07), (0.12, -0.06), (0.21, -0.02), (0.235, 0.04), (0.2, 0.11), (0.0, 0.13)]
        if s < 0:
            inner = [(-x, y) for x, y in inner]
            outer = [(-x, y) for x, y in outer]
        _wing_plate(g, inner, Vector((s * 0.05, 0.02, 0.22)), 0.028, 0.018, "owl_wing_" + side)
        _wing_plate(g, outer, Vector((s * 0.22, 0.02, 0.22)), 0.018, 0.008, "owl_wingtip_" + side)
        # pattes emplumées blanches, doigts gris à serres sombres
        leg = "owl_leg_" + side
        x = s * 0.03
        seg(g, (x, 0.01, 0.1), (x, 0.0, 0.02), 0.016, 0.012, "feather_white", leg, segs=6)
        for a in (-35, 0, 35):
            ar = math.radians(a)
            g.box((0.008, 0.04, 0.008), loc=(x + math.sin(ar) * 0.018, -math.cos(ar) * 0.018, 0.005),
                  color="heron_grey", rot=(0, 0, a), bone=leg)
        g.box((0.008, 0.02, 0.008), loc=(x, 0.016, 0.005), color="heron_grey", bone=leg)
    return g


def owl_clips(rig):
    """Clips du moment (images à 30 i/s). La piste du vol (OWL_TRACK) déplace la racine: les clips posent le
    corps sur place. Penchée pour voler: racine inclinée vers l'avant, tête redressée vers l'avant."""
    fold = {"owl_wing_l": {"s": (0.04, 0.04, 0.04), "l": (-0.04, 0.02, -0.04)}}
    fold = merge(fold, mirror(fold))
    perch = merge(fold, {"owl_head": R(0)})

    def wings(a, tip=0.0, sweep=0.0):
        # a: battement (positif = vers le dos, donc vers le haut en vol); sweep: vers l'avant (+) ou l'arrière
        w = {"owl_wing_l": R(0, -sweep, a), "owl_wingtip_l": R(0, 0, tip)}
        return merge(w, mirror(w))

    def legs(a):
        return {"owl_leg_l": R(a), "owl_leg_r": R(a)}

    fly = {"owl_root": R(80), "owl_head": R(-70)}
    C = {}
    # vol plané: ailes à plat, un léger balancement (silencieux, presque sans battre)
    # pattes repliées sous le ventre (au repos du squelette elles pendent vers la queue)
    C["owl_glide"] = (True, {0: merge(fly, wings(4, 2), legs(-15)), 15: merge(fly, wings(-4, -3), legs(-15),
                                                                            {"owl_root": R(78)}),
                             30: merge(fly, wings(4, 2), legs(-15))})
    # surplace: corps redressé à 40 degrés, battements rapides et amples, tête baissée vers l'herbe
    hov = {"owl_root": R(40), "owl_head": R(-12)}
    C["owl_hover"] = (True, {0: merge(hov, wings(50, 20, 10), legs(-35)), 3: merge(hov, wings(-45, -25, 18), legs(-35)),
                             6: merge(hov, wings(50, 20, 10), legs(-35)), 9: merge(hov, wings(-45, -25, 18), legs(-35)),
                             12: merge(hov, wings(50, 20, 10), legs(-35))})
    # plongeon: serres en avant, ailes relevées en V au-dessus du dos
    plunge = merge({"owl_root": R(-8), "owl_head": R(18)}, legs(-70), wings(70, 30, -20))
    C["owl_strike"] = (False, {0: merge(hov, wings(50, 20, 10), legs(-35)), 6: merge(plunge, {"owl_root": R(20)}),
                               12: plunge})
    # ailes en manteau sur l'herbe: corps penché, ailes ouvertes et rabattues vers le sol, tête basse
    mantle = merge({"owl_root": R(35), "owl_head": R(-30)}, legs(-10), wings(-35, -20, 25))
    C["owl_mantle"] = (True, {0: mantle, 24: merge(mantle, {"owl_head": R(-36, 0, 12)}, wings(-38, -22, 27)),
                              48: mantle})
    # battements de reprise: ailes amples, corps à 55 degrés, pattes repliées
    fl = {"owl_root": R(55), "owl_head": R(-45)}
    C["owl_flap"] = (True, {0: merge(fl, wings(55, 25, 5), legs(-20)), 7: merge(fl, wings(-50, -25, 15), legs(-20)),
                            15: merge(fl, wings(55, 25, 5), legs(-20))})
    # atterrissage sur le rocher: freinage ailes en avant, pattes tendues, puis repli et posée
    brake = merge({"owl_root": R(-12), "owl_head": R(10)}, legs(-40), wings(30, 15, 35))
    C["owl_land"] = (False, {0: merge(brake, wings(50, 20, 30)), 6: merge(brake, wings(-20, -10, 30)),
                             12: merge(brake, wings(40, 15, 20), legs(-20)), 18: perch})
    # regard: la tête pivote de 120 degrés vers sa gauche (vers les joueurs), un petit balancement, et y reste
    C["owl_look"] = (False, {0: perch, 10: merge(perch, {"owl_head": R(0, 0, 120)}),
                             20: merge(perch, {"owl_head": R(-8, 0, 118)}), 40: merge(perch, {"owl_head": R(0, 0, 120)}),
                             60: merge(perch, {"owl_head": R(0, 0, 120)})})
    C["owl_perch"] = (True, {0: perch, 30: merge(perch, {"owl_head": R(0, 0, 25)}), 60: perch})
    return rig.bake(C)


def vole(A):
    """Campagnol de 8 cm (porté au bec de l'effraie, socket_barn_owl_beak): corps brun, ventre gris, petites
    oreilles rondes, queue courte. Origine au point de prise (la nuque), en travers du bec, tête vers la gauche
    de l'oiseau (+X)."""
    g = A.geo()
    ell(g, (0.04, 0.02, 0.018), (0.0, 0.0, -0.01), by_normal("feather_brown", "feather_brown", "heron_grey"),
        segs=7, rings=4)
    ell(g, (0.018, 0.016, 0.015), (0.04, 0.0, -0.008), "feather_brown", segs=6, rings=4)
    for s in (1, -1):
        ell(g, (0.006, 0.003, 0.007), (0.035, s * 0.012, 0.004), "sepia_dark", segs=5, rings=3)
        g.box((0.004, 0.003, 0.003), loc=(0.052, s * 0.007, -0.004), color="black")
    seg(g, (-0.038, 0.0, -0.012), (-0.075, 0.0, -0.022), 0.004, 0.002, "sepia_dark", segs=5)
    return g
