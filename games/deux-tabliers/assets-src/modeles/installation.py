"""Assets du départ dans une cellule vide (démo v0.3, `docs/jeux/cosy-cafe/demo/depart-cellule-vide-v0-3.md`, A1 à A7).

Usage: duo-python games/deux-tabliers/assets-src/modeles/installation.py [-- --seulement id1,id2] [--sans-ao]

- A1 `shutter_bay_*`: rideaux métalliques à lames des quatre baies de la façade, enroulés dans le linteau. Deux nœuds:
  `<id>` (coulisses, recouvrement du linteau, gâche au sol: fixes) et `<id>_curtain` (tablier de lames, à translater
  vers +Y pour lever le rideau). Le mot de Simone est un enfant du tablier de la porte.
- A3 `sheet_counter`, `sheet_table`, `sheet_table_square`, `sheet_pile`: draps de coton par simulation de tissu Blender
  (Cloth) sur les vrais volumes (comptoir de la coque, vieille dame, guéridon ou table carrée et leurs chaises
  retournées), puis décimés au budget. Aucune génération Meshy: la simulation tombe juste sur les cotes.
- A4 `chairs_upturned`, `chairs_upturned_square`: deux chaises paillées (`chaise_paillee`, même maillage) retournées
  sur le guéridon ou sur la table carrée; placement calculé, contrôle de traversée par BVH à chaque construction.
- A5 `mail_bundle`, `bucket_sponge`, `price_tag` (le balai est `event_balai.glb`, déjà livré).
- A7 `espresso_revised`: la machine révisée de Joseph, même gabarit et même origine que `station_espresso_2g`.

Même chaîne que meubles.py et objets.py: atlas partagé `dt_meubles` (non reconstruit ici), occlusion cuite dans les
couleurs de sommets, un GLB par identifiant, fiche `fiches/installation.json` relue par `modeles_json.py`.
Repère: celui des plans (x est, y sud, z haut); dans le GLB x = x, Y en haut, z = y du plan, avant vers +Z.
"""

import argparse
import glob
import json
import math
import os
import random
import sys
import tempfile
import time
import zlib

import bpy
import bmesh
import numpy as np
from mathutils import Matrix, Vector
from mathutils.bvhtree import BVHTree

ICI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(ICI, "lib"))
import commun as K  # noqa: E402
from geo import Geo, P  # noqa: E402
import geo as G  # noqa: E402
import scene_coque as S  # noqa: E402
import meubles as MB  # noqa: E402

pans = G.pans
CATALOGUE = {}
SPACING = 5.0


def objet(ident, categorie, budget, accroche="sol", nom="", sim=None):
    def deco(fn):
        CATALOGUE[ident] = dict(fn=fn, categorie=categorie, budget=budget, accroche=accroche, nom=nom, sim=sim)
        return fn
    return deco


def sk(name, x, y, z, parent=None):
    return {"name": name, "x": x, "y": y, "z": z, "parent": parent}


def gltf(x, y, z):
    """Point du plan -> repère glTF."""
    return [round(x, 4), round(z, 4), round(y, 4)]


# ------------------------------------------------------------------------------------------------
# A1: rideaux métalliques
#
# Baies relevées dans shell_village.glb (tableaux de pierre, appuis, linteaux; façade extérieure au plan y = 13,00,
# châssis entre y 12,84 et 12,92): vitrine ouest x 4,40 à 6,40, appui 0,45, linteau 2,40; vitrine est x 6,50 à 8,50,
# mêmes hauteurs; porte x 8,80 à 10,00, seuil 0,00, linteau 2,10; petite fenêtre x 10,20 à 10,80, appui 0,90,
# linteau 2,40. Le rideau court dans les 8 cm entre le châssis et le nu de la façade: coulisses dans les tableaux,
# tablier à 4 cm derrière le nu, fente sous le linteau. Pivot: milieu du bas de la baie, sur le nu de la façade.

BAIES = {
    "shutter_bay_west": dict(x0=4.40, x1=6.40, z0=0.45, z1=2.40, porte=False, nom="Rideau métallique de la vitrine ouest"),
    "shutter_bay_east": dict(x0=6.50, x1=8.50, z0=0.45, z1=2.40, porte=False, nom="Rideau métallique de la vitrine est"),
    "shutter_bay_door": dict(x0=8.80, x1=10.00, z0=0.00, z1=2.10, porte=True, nom="Rideau métallique de la porte"),
    "shutter_bay_small": dict(x0=10.20, x1=10.80, z0=0.90, z1=2.40, porte=False, nom="Rideau métallique de la petite fenêtre"),
}
FACADE_Y = 13.0
PAS_LAME = 0.08  # lame de 80 mm (rideau à lames pleines galvanisées)
# profil d'une lame (hauteur dans la lame, recul derrière le nu de la façade): gorge d'agrafage, bombé, gorge
PROFIL_AVANT = [(0.0, -0.038), (0.009, -0.031), (0.040, -0.027), (0.071, -0.031)]
PROFIL_ARRIERE = [(0.0, -0.045), (0.040, -0.048)]
# acier galvanisé terni: gris mat (le zinc métallique de l'atlas sort noir sans reflets); variations par lame en couleurs de sommets
LAMES = GALVA = "nordique_wool"


def polices_caveat():
    """Caveat (OFL), police manuscrite du jeu, prise dans les node_modules du dépôt (DejaVu à défaut)."""
    for base in (K.RACINE, os.path.dirname(os.path.dirname(os.path.dirname(K.RACINE)))):
        hits = sorted(glob.glob(os.path.join(base, "node_modules", ".pnpm", "@fontsource-variable+caveat@*", "node_modules",
                                             "@fontsource-variable", "caveat", "files", "caveat-latin-wght-normal.woff2")))
        if hits:
            return hits[0]
    return "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"


def image_mot_simone():
    """Le mot de Simone (section 3.4): « Merci pour ces trente années. Simone », au feutre sur un papier jauni."""
    from PIL import Image, ImageDraw, ImageFont

    w, h = 256, 352
    papier = tuple(int(K.rgb(K.EXTRA["paper_old"])[i] * 255) for i in range(3))
    encre = tuple(int(K.rgb(K.C["ink"])[i] * 255) for i in range(3))
    im = Image.new("RGB", (w, h), papier)
    d = ImageDraw.Draw(im)
    # jaunissement plus marqué vers les bords (trois ans au soleil de la place)
    a = np.asarray(im).astype(np.float32)
    yy, xx = np.mgrid[0:h, 0:w]
    edge = np.minimum(np.minimum(xx, w - 1 - xx), np.minimum(yy, h - 1 - yy)) / 40.0
    a *= (0.93 + 0.07 * np.clip(edge, 0, 1))[..., None]
    im = Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))
    d = ImageDraw.Draw(im)
    f = ImageFont.truetype(polices_caveat(), 54)
    lignes = [("Merci pour", 22, 40), ("ces trente", 34, 104), ("années.", 22, 168)]
    for txt, x, y in lignes:
        d.text((x, y), txt, font=f, fill=encre)
    f2 = ImageFont.truetype(polices_caveat(), 62)
    d.text((104, 248), "Simone", font=f2, fill=encre)
    d.line([(110, 318), (226, 310)], fill=encre, width=3)
    tmp = tempfile.mkdtemp(prefix="dt_mot_")
    p = os.path.join(tmp, "mot_simone.jpg")
    im.save(p, quality=88)
    return p


def mat_image(nom, chemin, rough=0.9):
    m = bpy.data.materials.get(nom)
    if m:
        return m
    m = bpy.data.materials.new(nom)
    m.use_backface_culling = True
    nt = m.node_tree
    b = nt.nodes["Principled BSDF"]
    t = nt.nodes.new("ShaderNodeTexImage")
    t.image = bpy.data.images.load(chemin, check_existing=True)
    nt.links.new(t.outputs["Color"], b.inputs["Base Color"])
    b.inputs["Roughness"].default_value = rough
    return m


def mat_uni(nom, hexs, rough=0.85):
    m = bpy.data.materials.get(nom)
    if m:
        return m
    m = bpy.data.materials.new(nom)
    m.use_backface_culling = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = K.lin4(hexs)
    b.inputs["Roughness"].default_value = rough
    return m


def plaque(nom, coins, mat):
    """Quadrilatère à UV pleines (0..1), points du plan dans l'ordre bas-gauche, bas-droite, haut-droite, haut-gauche
    vus de face (sa normale regarde le spectateur)."""
    me = bpy.data.meshes.new(nom)
    me.from_pydata([tuple(P(*c)) for c in coins], [], [(0, 1, 2, 3)])
    uv = me.uv_layers.new(name="UVMap")
    for i, (u, v) in enumerate(((0, 0), (1, 0), (1, 1), (0, 1))):
        uv.data[i].uv = (u, v)
    me.materials.append(mat)
    ob = bpy.data.objects.new(nom, me)
    bpy.context.scene.collection.objects.link(ob)
    return ob


def teinte_lames(objs):
    """Galvanisé terni: gris légèrement bleuté, chaque lame un peu différente (trois ans de pluie), bas du tablier
    plus sombre (éclaboussures du trottoir)."""
    for o in objs:
        me = o.data
        att = me.color_attributes["ao"]
        n = len(att.data)
        a = np.empty(n * 4, dtype=np.float32)
        att.data.foreach_get("color", a)
        a = a.reshape(n, 4)
        z = np.array([me.vertices[lp.vertex_index].co.z for lp in me.loops], dtype=np.float32)
        k = np.ones(n, dtype=np.float32)
        if o.name.endswith("_curtain"):
            lame = np.floor((z - 0.04) / PAS_LAME).astype(int)
            rnd = np.array([(zlib.crc32(f"{o.name}{i}".encode()) % 1000) / 1000 for i in lame], dtype=np.float32)
            k = (0.9 + 0.1 * rnd) * (0.84 + 0.16 * np.clip(z / 0.45, 0, 1))
        a[:, 0] *= k * 0.94
        a[:, 1] *= k * 0.97
        a[:, 2] *= k * 1.0
        att.data.foreach_set("color", a.ravel())


def rideau(ident, g):
    b = BAIES[ident]
    W, Hb, porte = b["x1"] - b["x0"], b["z1"] - b["z0"], b["porte"]
    xg = W / 2 - 0.045  # bord intérieur des coulisses
    xe = W / 2 - 0.01  # bout des lames, dans la coulisse
    # --- coulisses en U dans les tableaux, du bas de la baie au linteau
    for s in (-1, 1):
        a0, a1 = sorted((s * (W / 2 - 0.004), s * W / 2))
        g.box(a0, a1, -0.075, -0.004, 0, Hb, GALVA, bevel=0, drop=("bottom", "top", "w" if s < 0 else "e"))
        for (y0, y1) in ((-0.012, -0.004), (-0.075, -0.067)):
            c0, c1 = sorted((s * xg, s * (W / 2 - 0.004)))
            g.box(c0, c1, y0, y1, 0, Hb, GALVA, bevel=0.002, drop=("bottom", "top"))
    # --- recouvrement de la fente sous le linteau (le tablier y disparaît en montant)
    g.box(-W / 2, W / 2, -0.009, -0.002, Hb - 0.06, Hb, GALVA, bevel=0.002, drop=("top",))
    g.box(-W / 2, W / 2, -0.075, -0.009, Hb - 0.012, Hb, "steel_dark", bevel=0, drop=("top", "s"))
    if porte:
        # gâche scellée dans le seuil de pierre: le pêne de la serrure y descend
        g.box(0.30, 0.38, -0.052, -0.022, 0.0, 0.004, "steel_dark", bevel=0.001, drop=("bottom",))
        g.cyl(0.34, -0.037, 0.003, 0.0045, 0.008, 8, "ink", cap_bottom=False)
    # --- tablier: lames profilées, lame finale, joint
    t = Geo(ident + "_curtain")
    zb = 0.04  # dessus de la lame finale
    n = int(math.ceil((Hb + 0.06 - zb) / PAS_LAME))
    zs, ys, za, ya = [], [], [], []
    for k in range(n):
        for dz, y in PROFIL_AVANT:
            zs.append(zb + k * PAS_LAME + dz)
            ys.append(y)
        for dz, y in PROFIL_ARRIERE:
            za.append(zb + k * PAS_LAME + dz)
            ya.append(y)
    zs.append(zb + n * PAS_LAME)
    ys.append(PROFIL_AVANT[0][1])
    za.append(zb + n * PAS_LAME)
    ya.append(PROFIL_ARRIERE[0][1])
    bm = t.bm

    def nappe(zl, yl, avant):
        rows = [(bm.verts.new(P(-xe, y, z)), bm.verts.new(P(xe, y, z))) for z, y in zip(zl, yl)]
        for (a0, a1), (b0, b1) in zip(rows, rows[1:]):
            f = bm.faces.new((a0, a1, b1, b0) if avant else (a1, a0, b0, b1))
            f.material_index = t.mi(LAMES)
            f[t.gl] = 1
    nappe(zs, ys, True)
    nappe(za, ya, False)
    # lame finale (profil en T) et joint de caoutchouc
    t.box(-xe, xe, -0.052, -0.024, 0.008, zb, GALVA, bevel=0.003, drop=())
    t.box(-xe, xe, -0.044, -0.032, 0.0, 0.008, "rubber", bevel=0, drop=("w", "e"))
    objets = []
    socks = []
    if porte:
        # poignée basse, assez large pour deux mains (le geste se fait à deux), serrure à cylindre
        hx = 0.2
        for x in (-hx, hx):
            t.rod((x, -0.024, 0.024), (x, 0.012, 0.024), 0.008, 8, "steel_dark", cap=False)
        t.rod((-hx - 0.008, 0.012, 0.024), (hx + 0.008, 0.012, 0.024), 0.011, 10, "steel_dark")
        t.box(0.30, 0.38, -0.024, -0.018, 0.006, 0.036, "steel_dark", bevel=0.002)
        g2 = t.cyl(0.34, 0, 0, 0.006, 0.009, 10, "chrome", cap_bottom=False)
        for v in g2:
            x, y, z = v.co.x, -v.co.y, v.co.z
            v.co = P(x, -0.018 + z, 0.021 - y)
        socks.append(sk("handle", 0.0, 0.012, 0.024, parent=ident + "_curtain"))
        # mot de Simone scotché sur le tablier, côté place, à hauteur des yeux (1,40 m au milieu), un peu de travers
        mot = mat_image("dt_mot_simone", image_mot_simone())
        cx, cz, w2, h2, ang = -0.12, 1.42, 0.075, 0.103, math.radians(-3.0)
        yn = -0.0255

        def rot(dx, dz):
            return (cx + dx * math.cos(ang) - dz * math.sin(ang), yn, cz + dx * math.sin(ang) + dz * math.cos(ang))
        note = plaque(ident + "_note", [rot(-w2, -h2), rot(w2, -h2), rot(w2, h2), rot(-w2, h2)], mot)
        objets.append(note)
        # quatre bouts de ruban adhésif en biais aux coins
        for (sx, sz) in ((-1, -1), (1, -1), (1, 1), (-1, 1)):
            px, _, pz = rot(sx * (w2 - 0.004), sz * (h2 - 0.004))
            a = math.radians(45 * sx * sz) + ang
            dx, dz = 0.022 * math.cos(a), 0.022 * math.sin(a)
            ex, ez = -0.008 * math.sin(a), 0.008 * math.cos(a)
            t.quad([(px - dx - ex, yn + 0.0008, pz - dz - ez), (px + dx - ex, yn + 0.0008, pz + dz - ez),
                    (px + dx + ex, yn + 0.0008, pz + dz + ez), (px - dx + ex, yn + 0.0008, pz - dz + ez)], "tape", normal_hint=(0, 1, 0))
    else:
        # verrous latéraux de la lame finale
        for s in (-1, 1):
            t.box(s * (xg - 0.07) - 0.025, s * (xg - 0.07) + 0.025, -0.024, -0.018, 0.012, 0.034, "steel_dark", bevel=0.002)
    # occlusion: tableaux, appui et linteau de la baie (pierre), pour assombrir les bords du tablier
    occ = Geo(ident + "_occ")
    occ.box(-W / 2 - 0.3, -W / 2, -0.5, 0.0, -0.3, Hb + 0.4, "slate", bevel=0)
    occ.box(W / 2, W / 2 + 0.3, -0.5, 0.0, -0.3, Hb + 0.4, "slate", bevel=0)
    occ.box(-W / 2, W / 2, -0.5, 0.0, Hb, Hb + 0.4, "slate", bevel=0)
    occ.box(-W / 2, W / 2, -0.5, 0.3, -0.3, 0.0, "slate", bevel=0)
    occ.box(-W / 2, W / 2, -0.5, -0.06, 0.0, Hb, "slate", bevel=0)  # vitrage et châssis derrière
    pose = gltf((b["x0"] + b["x1"]) / 2, FACADE_Y, b["z0"])
    return {
        "extra_geos": [t], "objets": objets, "post_ao": [teinte_lames], "parents": {ident + "_note": ident + "_curtain"} if porte else {},
        "occluders": [occ], "sockets": socks,
        "pose": {"position": pose, "rotation_deg": 0},
        "animation": {"noeud": ident + "_curtain", "lever": {"translation_y_m": round(Hb + 0.06, 3), "duree_s": 1.5},
                      "explication": "translation du tablier vers +Y: il passe derrière le recouvrement et disparaît dans le linteau (mur plein); le cacher une fois levé"},
        "baie": {"largeur_m": round(W, 3), "hauteur_m": round(Hb, 3), "x_plan": [b["x0"], b["x1"]], "bas_m": b["z0"]},
        "note": "pivot au milieu du bas de la baie, sur le nu de la façade (plan y = 13,00); tout le modèle est dans l'épaisseur du mur (z glTF de -0,075 à 0)"
                + ("; la poignée dépasse de 1,2 cm du nu" if porte else ""),
    }


for _id in BAIES:
    objet(_id, "facade", 1200, accroche="facade", nom=BAIES[_id]["nom"])(lambda g, ctx, _i=_id: rideau(_i, g))


# ------------------------------------------------------------------------------------------------
# A4: chaises retournées

TABLES = {
    # plateau: dessus à 0,75; marbre de rayon 0,30 cerclé de laiton (0,305) pour le guéridon, 0,80 x 0,80 et cerclage
    # à 0,404 pour la table carrée. Axe des chaises: celui de leurs places (seat-1 et seat-2 à l'ouest et à l'est des
    # guéridons, seat-7 et seat-8 au nord et au sud de la table carrée).
    "rond": dict(meuble="gueridon_marbre", dessus=0.75, rayon=0.305, axe="x"),
    "carre": dict(meuble="table_bistrot_quatre", dessus=0.75, demi=0.404, axe="y"),
}
MARGE = 0.012  # jeu entre le dossier qui pend et le chant du plateau
# (direction du dossier, rotation de plus, décalage de côté, demi-jeu au centre): un peu de travers, comme posées
# à la main. Sur le guéridon (0,61 m), les deux assises de 0,45 m se partagent le plateau: chacune reste dans sa
# moitié, à 1 cm au moins de l'axe (2 cm entre les traverses avant).
POSES_CHAISES = {
    "x": [((1, 0), math.radians(1.5), 0.012, 0.01), ((-1, 0), math.radians(-1.5), -0.015, 0.01)],
    "y": [((0, 1), math.radians(-3.0), 0.02, 0.0), ((0, -1), math.radians(2.0), -0.015, 0.0)],
}


def chaise_plan():
    """Sommets (plan) et faces de la chaise paillée livrée, construite par meubles.py."""
    tmp = Geo("tmp_chaise")
    MB.CATALOGUE["chaise_paillee"]["fn"](tmp)
    V = np.array([(v.co.x, -v.co.y, v.co.z) for v in tmp.bm.verts])
    tmp.bm.verts.index_update()
    F = [([v.index for v in f.verts], tmp.keys[f.material_index]) for f in tmp.bm.faces]
    Geo.registry.remove(tmp)
    tmp.bm.free()
    return V, F


def _sur_plateau(t, xy, marge=0.0):
    if "rayon" in t:
        return np.hypot(xy[:, 0], xy[:, 1]) < t["rayon"] + marge
    return (np.abs(xy[:, 0]) < t["demi"] + marge) & (np.abs(xy[:, 1]) < t["demi"] + marge)


_BVH_TABLES = {}


def _bvh_table(t):
    if t["meuble"] not in _BVH_TABLES:
        tg = Geo("tmp_bvh")
        MB.CATALOGUE[t["meuble"]]["fn"](tg)
        _BVH_TABLES[t["meuble"]] = bvh_geo(tg)
        Geo.registry.remove(tg)
        tg.bm.free()
    return _BVH_TABLES[t["meuble"]]


def _bvh_points(Pv, F):
    tris = []
    for idx, _ in F:
        for k in range(1, len(idx) - 1):
            tris.append((idx[0], idx[k], idx[k + 1]))
    return BVHTree.FromPolygons([tuple(P(*p)) for p in Pv], tris)


def placer_chaise(V, F, t, direction, rot_extra=0.0, decal=0.0, demi_jeu=0.0):
    """Chaise retournée (renversée autour de son axe gauche-droite), dossier vers `direction` (vecteur du plan),
    assise posée sur le plateau, dossier pendant hors du plateau, sans aucune traversée du meuble (BVH). Retourne
    les sommets placés et le recul trouvé."""
    Q = V.copy()
    Q[:, 1] = -Q[:, 1]
    Q[:, 2] = -Q[:, 2]
    # après le renversement, le dossier est vers +y du plan: le tourner vers `direction`
    a = math.atan2(direction[1], direction[0]) - math.pi / 2 + rot_extra
    c, s = math.cos(a), math.sin(a)
    xy = Q[:, :2] @ np.array([[c, s], [-s, c]])
    perp = np.array([-direction[1], direction[0]])
    # la chaise repose sur son assise (sommets d'origine entre 0,30 et 0,60 m), jamais sur le haut du dossier
    assise = (V[:, 2] > 0.30) & (V[:, 2] < 0.60)
    for d in np.arange(0.05, 0.7, 0.002):
        p = xy + np.array(direction) * d + perp * decal
        on = _sur_plateau(t, p)
        if not (on & assise).any():
            break
        tz = t["dessus"] + 0.0015 - Q[on & assise, 2].min()
        z = Q[:, 2] + tz
        bas = z < t["dessus"] - 0.001  # sous le niveau du plateau: doit pendre hors du chant
        if not _sur_plateau(t, p[bas], MARGE).any() and (demi_jeu <= 0 or (p @ np.array(direction, dtype=float)).min() >= demi_jeu):
            out = np.column_stack([p, z])
            if not _bvh_points(out, F).overlap(_bvh_table(t)):
                return out, float(d)
    raise RuntimeError("chaise impossible à poser")


def chaises_retournees(g, forme):
    """Ajoute à g les deux chaises retournées sur la table `forme`; rend le contrôle (marges, appuis)."""
    t = TABLES[forme]
    V, F = chaise_plan()
    placees = []
    for direction, ra, dc, rc in POSES_CHAISES[t["axe"]]:
        Pv, d = placer_chaise(V, F, t, direction, ra, dc, rc)
        placees.append(Pv)
        bm = g.bm
        vs = [bm.verts.new(P(*p)) for p in Pv]
        for idx, key in F:
            try:
                f = bm.faces.new([vs[i] for i in idx])
            except ValueError:
                continue
            f.material_index = g.mi(key)
    return placees


def geo_table(forme):
    tg = Geo("tmp_table")
    MB.CATALOGUE[TABLES[forme]["meuble"]]["fn"](tg)
    return tg


def bvh_geo(g):
    bm = g.bm.copy()
    bmesh.ops.triangulate(bm, faces=bm.faces)
    return BVHTree.FromBMesh(bm)


def controle_chaises(forme):
    """Traversées chaise-plateau et chaise-chaise (BVH), distances minimales; lève une erreur au moindre contact."""
    tg = geo_table(forme)
    c1, c2 = Geo("tmp_c1"), Geo("tmp_c2")
    t = TABLES[forme]
    V, F = chaise_plan()
    ps = []
    for gg, (direction, ra, dc, rc) in zip((c1, c2), POSES_CHAISES[t["axe"]]):
        Pv, _ = placer_chaise(V, F, t, direction, ra, dc, rc)
        ps.append(Pv)
        vs = [gg.bm.verts.new(P(*p)) for p in Pv]
        for idx, key in F:
            try:
                gg.bm.faces.new([vs[i] for i in idx])
            except ValueError:
                pass
    bt, b1, b2 = bvh_geo(tg), bvh_geo(c1), bvh_geo(c2)
    res = {"traversees_chaise1_table": len(b1.overlap(bt)), "traversees_chaise2_table": len(b2.overlap(bt)),
           "traversees_chaise1_chaise2": len(b1.overlap(b2))}
    # distances: plus petit écart entre sommets d'une chaise et surface de l'autre objet
    dmin = {}
    for nom, Pv, autre in (("chaise1_table", ps[0], bt), ("chaise2_table", ps[1], bt), ("chaise1_chaise2", ps[0], b2)):
        dd = [autre.find_nearest(P(*p))[3] for p in Pv]
        dmin[nom] = round(min(dd) * 1000, 1)
    res["ecart_min_mm"] = dmin
    # appui: centre des sommets de chaque chaise au-dessus du plateau
    res["centre_sur_plateau"] = [bool(_sur_plateau(t, p[:, :2].mean(0)[None, :])[0]) for p in ps]
    res["hauteur_max_m"] = round(float(max(p[:, 2].max() for p in ps)), 3)
    res["bas_du_dossier_m"] = round(float(min(p[:, 2].min() for p in ps)), 3)
    for gg in (tg, c1, c2):
        Geo.registry.remove(gg)
        gg.bm.free()
    if any(v for k, v in res.items() if k.startswith("traversees")) or not all(res["centre_sur_plateau"]):
        raise RuntimeError(f"chaises retournées: contrôle en échec {res}")
    return res


@objet("chairs_upturned", "chaises", 1200, nom="Deux chaises paillées retournées sur le guéridon")
def o_chairs_round(g, ctx):
    chaises_retournees(g, "rond")
    ctl = controle_chaises("rond")
    return {"occluders": [geo_table("rond")], "controle": ctl, "pose": {"position": "celle du guéridon (table-1 à table-3)", "rotation_deg": 0},
            "note": "les deux chaises seules (le guéridon reste gueridon_marbre); pivot au centre du guéridon, au sol; dossiers vers l'ouest et l'est, pendants hors du plateau"}


@objet("chairs_upturned_square", "chaises", 1200, nom="Deux chaises paillées retournées sur la table carrée")
def o_chairs_square(g, ctx):
    chaises_retournees(g, "carre")
    ctl = controle_chaises("carre")
    return {"occluders": [geo_table("carre")], "controle": ctl, "pose": {"position": "celle de la table carrée (table-4)", "rotation_deg": 0},
            "note": "les deux chaises seules (la table reste table_bistrot_quatre); pivot au centre de la table, au sol; dossiers vers le nord et le sud"}


# ------------------------------------------------------------------------------------------------
# A3: draps (simulation de tissu)

DRAP = "linen"  # lin de la palette (#CBBEA6), grisé par les couleurs de sommets: coton gris-beige


def _obj_de_geo(g, nom):
    me = bpy.data.meshes.new(nom)
    g.bm.to_mesh(me)
    ob = bpy.data.objects.new(nom, me)
    bpy.context.scene.collection.objects.link(ob)
    return ob


def simuler(colliders, taille, centre, z, res, images, cible_tri, self_col=False, bruit=0.0, seed=1, raideur=80.0, gonfle=0.0, regonfle=0.012):
    """Drap (grille taille[0] x taille[1] m, res mailles) lâché à la hauteur z au-dessus de centre (plan), sur les
    volumes `colliders` (fonction qui rend des Geo) et le sol. Rend les sommets (repère du plan) et les faces du
    résultat décimé à `cible_tri` triangles."""
    K.vider_scene()
    sc = bpy.context.scene
    obs = []
    geos = colliders()
    for i, g in enumerate(geos):
        obs.append(_obj_de_geo(g, f"col_{i}"))
        if hasattr(g, "depart"):
            # un mur ne peut pas être là dès le départ (le drap lâché le traverserait): il arrive pendant la chute
            # et repousse le tissu jusqu'à sa vraie place
            o = obs[-1]
            o.location = P(g.depart[0], g.depart[1], 0)
            o.keyframe_insert("location", frame=1)
            o.location = (0, 0, 0)
            o.keyframe_insert("location", frame=max(2, images // 3))
    bpy.ops.mesh.primitive_plane_add(size=30, location=P(centre[0], centre[1], 0))
    obs.append(bpy.context.active_object)
    for o in obs:
        o.modifiers.new("col", "COLLISION")
        o.collision.thickness_outer = 0.01
        o.collision.cloth_friction = 80
        o.collision.damping = 1.0
    bpy.ops.mesh.primitive_grid_add(x_subdivisions=res[0], y_subdivisions=res[1], size=1, location=(0, 0, 0))
    d = bpy.context.active_object
    d.scale = (taille[0], taille[1], 1)
    d.location = P(centre[0], centre[1], z)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bruit > 0:
        rng = np.random.default_rng(seed)
        for v in d.data.vertices:
            v.co.z += float(rng.normal(0, bruit))
    m = d.modifiers.new("cloth", "CLOTH")
    s = m.settings
    s.quality = 10
    s.mass = 0.3
    s.tension_stiffness = raideur
    s.compression_stiffness = raideur
    s.shear_stiffness = raideur / 2
    s.bending_stiffness = 0.5
    s.air_damping = 3.0
    if gonfle:
        # le drap part replié sur lui-même (grille réduite) et reprend sa taille en tombant: il se froisse en tas
        s.shrink_min = -gonfle
    m.collision_settings.distance_min = 0.006
    m.collision_settings.collision_quality = 4
    m.collision_settings.use_self_collision = self_col
    m.collision_settings.self_distance_min = 0.006
    m.point_cache.frame_start = 1
    m.point_cache.frame_end = images
    for f in range(1, images + 1):
        sc.frame_set(f)
    ntri = 2 * res[0] * res[1]
    # lissage léger avant la décimation: il retire le grésillement des contacts (bords en dents de scie)
    lis = d.modifiers.new("lis", "SMOOTH")
    lis.factor = 0.5
    lis.iterations = 3
    dec = d.modifiers.new("dec", "DECIMATE")
    dec.decimate_type = "COLLAPSE"
    dec.ratio = min(1.0, cible_tri / ntri * 0.98)
    dec.use_collapse_triangulate = True
    ev = d.evaluated_get(bpy.context.evaluated_depsgraph_get())
    me = bpy.data.meshes.new_from_object(ev)
    # lissage et décimation rentrent le drap de quelques millimètres dans les coins des meubles (pieds, chant du
    # plateau): on le regonfle le long de ses normales (le drap tombe 1 cm plus large, invisible)
    V = np.array([tuple(d.matrix_world @ (v.co + v.normal * regonfle)) for v in me.vertices])
    V[:, 1] = -V[:, 1]  # Blender -> plan
    F = [tuple(p.vertices) for p in me.polygons]
    return V, F


def drap_dans_geo(g, VF, centre):
    V, F = VF
    vs = [g.bm.verts.new(P(x - centre[0], y - centre[1], z)) for x, y, z in V]
    for f in F:
        try:
            nf = g.bm.faces.new([vs[i] for i in f])
        except ValueError:
            continue
        nf.material_index = g.mi(DRAP)
    g.smooth = True


def teinte_drap(objs):
    """Coton gris-beige: côtés et plis grisés, dessus plus clairs (la poussière de trois ans s'y voit)."""
    for o in objs:
        me = o.data
        att = me.color_attributes["ao"]
        n = len(att.data)
        a = np.empty(n * 4, dtype=np.float32)
        att.data.foreach_get("color", a)
        a = a.reshape(n, 4)
        nz = np.array([me.vertices[l.vertex_index].normal.z for l in me.loops], dtype=np.float32)
        t = np.clip(nz, 0, 1) ** 2
        cote = np.array([0.86, 0.86, 0.885])
        dessus = np.array([1.0, 0.995, 0.985])
        k = cote[None, :] * (1 - t[:, None]) + dessus[None, :] * t[:, None]
        a[:, :3] *= k
        att.data.foreach_set("color", a.ravel())


def lisser(objs):
    for o in objs:
        for nom in ("sharp_edge", "sharp_face"):
            at = o.data.attributes.get(nom)
            if at is not None:
                o.data.attributes.remove(at)


# Comptoir de la coque (x 7,98 à 11,00, y 8,76 à 9,56, plan barista 0,95, tablette 1,10) et vieille dame à sa place
# (x 9,15, y 9,005): le drap couvre 3,2 x 0,9 m environ, jusqu'à 1,45 m de haut. Drap de 3,4 x 2,4 m (un grand drap de
# lit), lâché à 1,52 m, contre le mur est (x 11,00).
COMPTOIR_CENTRE = (9.45, 9.16)


def _colliders_comptoir():
    mur = Geo("mur_est")
    mur.box(11.0, 11.5, 7.0, 11.0, 0, 2.8, "slate", bevel=0)
    # la vieille dame par son enveloppe convexe: la galerie du chauffe-tasses (tiges de 6 mm) laissait passer le tissu
    m = S.cafetiere()
    h = Geo("enveloppe_machine")
    vs = [h.bm.verts.new(v.co) for v in m.bm.verts]
    bmesh.ops.convex_hull(h.bm, input=vs)
    for v in [v for v in h.bm.verts if not v.link_faces]:
        h.bm.verts.remove(v)
    for f in h.bm.faces:
        f.material_index = h.mi("slate")
    Geo.registry.remove(m)
    m.bm.free()
    return [S.comptoir(), h, mur]


def sim_comptoir():
    return simuler(_colliders_comptoir, (3.4, 2.4), (9.28, 9.16), 1.52, (84, 60), 34, 1900)


@objet("sheet_counter", "drap", 2000, nom="Drap sur le comptoir et la vieille dame", sim=sim_comptoir)
def o_sheet_counter(g, ctx):
    drap_dans_geo(g, ctx["sim"], COMPTOIR_CENTRE)
    occ = Geo("occ_comptoir")
    for og in _colliders_comptoir():
        for v in og.bm.verts:
            v.co.x -= COMPTOIR_CENTRE[0]
            v.co.y += COMPTOIR_CENTRE[1]
        _fondre(occ, og)
    return {"post_ao": [teinte_drap, lisser], "occluders": [occ],
            "pose": {"position": gltf(COMPTOIR_CENTRE[0], COMPTOIR_CENTRE[1], 0), "rotation_deg": 0},
            "note": "simulé sur le comptoir de la coque et station_espresso_2g à sa place; pivot au sol sous le milieu du comptoir (plan x 9,45, y 9,16)"}


def _fondre(g, other):
    mp = {}
    for v in other.bm.verts:
        mp[v] = g.bm.verts.new(v.co)
    for f in other.bm.faces:
        try:
            nf = g.bm.faces.new([mp[v] for v in f.verts])
        except ValueError:
            continue
        nf.material_index = g.mi("slate")
    if other in Geo.registry:
        Geo.registry.remove(other)
    other.bm.free()


def _colliders_table(forme):
    def fn():
        # les pieds (3 cm) sont trop fins pour la collision du tissu, qui passait entre eux et retombait sur
        # l'assise: chaque chaise est remplacée par son enveloppe convexe (le drap tendu de pied en pied)
        tg = geo_table(forme)
        tmp = Geo("tmp_chaises")
        placees = chaises_retournees(tmp, forme)
        Geo.registry.remove(tmp)
        tmp.bm.free()
        out = [tg]
        # murs proches (plan village-arrivee). Les guéridons table-1 à table-3 (y 12,20) touchent la façade (face
        # intérieure à y 12,50: le cerclage de laiton entre de 5 mm dans le trumeau de table-2) et le drap passerait
        # dans les tableaux des vitrines (x 4,40, 6,40-6,50, 8,50-8,80): simulés posés à y 12,15, mur plein à 0,35 m
        # de leur centre et appui de chêne (0,42-0,45 m, 4 cm devant le mur). La table carrée table-4 (x 4,35)
        # touche le mur ouest (x 4,00): simulée posée à x 4,45. Les deux corrections du plan sont dans le compte rendu.
        mur = Geo("mur")
        if forme == "rond":
            mur.box(-1.5, 1.5, 0.35, 0.8, 0.0, 2.5, "slate", bevel=0)
            mur.box(-1.5, 1.5, 0.31, 0.35, 0.42, 0.45, "slate", bevel=0)
            mur.depart = (0.0, 1.0)
        else:
            mur.box(-0.9, -0.45, -1.5, 1.5, 0.0, 2.5, "slate", bevel=0)
            mur.depart = (-1.0, 0.0)
        out.append(mur)
        for i, Pv in enumerate(placees):
            h = Geo(f"enveloppe_{i}")
            vs = [h.bm.verts.new(P(*p)) for p in Pv]
            bmesh.ops.convex_hull(h.bm, input=vs)
            for v in [v for v in h.bm.verts if not v.link_faces]:
                h.bm.verts.remove(v)
            for f in h.bm.faces:
                f.material_index = h.mi("slate")
            out.append(h)
        return out
    return fn


def sim_table():
    return simuler(_colliders_table("rond"), (2.3, 2.3), (0.0, 0.0), 1.3, (64, 64), 70, 1150, raideur=60.0)


def sim_table_carree():
    return simuler(_colliders_table("carre"), (2.4, 2.4), (0.0, 0.0), 1.34, (64, 64), 70, 1150, raideur=60.0)


@objet("sheet_table", "drap", 1200, nom="Drap sur un guéridon et ses deux chaises retournées", sim=sim_table)
def o_sheet_table(g, ctx):
    drap_dans_geo(g, ctx["sim"], (0.0, 0.0))
    return {"post_ao": [teinte_drap, lisser], "occluders": _colliders_table("rond")(),
            "pose": {"position": "celle du guéridon (table-1 à table-3)", "rotation_deg": 0},
            "note": "simulé sur gueridon_marbre et chairs_upturned; pivot au centre du guéridon, au sol; à montrer avec eux"}


@objet("sheet_table_square", "drap", 1200, nom="Drap sur la table carrée et ses deux chaises retournées", sim=sim_table_carree)
def o_sheet_table_square(g, ctx):
    drap_dans_geo(g, ctx["sim"], (0.0, 0.0))
    return {"post_ao": [teinte_drap, lisser], "occluders": _colliders_table("carre")(),
            "pose": {"position": "celle de la table carrée (table-4)", "rotation_deg": 0},
            "note": "simulé sur table_bistrot_quatre et chairs_upturned_square; pivot au centre de la table, au sol"}


def _colliders_tas():
    # le drap tiré tombe sur lui-même: on le lâche sur un petit dôme écrasé, retiré ensuite (le dessous ne se voit pas)
    d = Geo("dome")
    d.sphere(0.0, 0.0, 0.0, 0.26, 0.2, 0.13, "slate", segs=16, rings=8, zcut=0.0)
    d2 = Geo("dome2")
    d2.sphere(0.22, -0.12, 0.0, 0.14, 0.12, 0.08, "slate", segs=12, rings=6, zcut=0.0)
    return [d, d2]


def sim_tas():
    return simuler(_colliders_tas, (0.6, 0.5), (0.05, -0.03), 0.25, (40, 34), 90, 580, self_col=True, bruit=0.01, seed=5, raideur=40.0, gonfle=1.6, regonfle=0.0)


@objet("sheet_pile", "drap", 600, nom="Drap tombé en tas au sol", sim=sim_tas)
def o_sheet_pile(g, ctx):
    V, F = ctx["sim"]
    drap_dans_geo(g, (V, F), (0.0, 0.0))
    vs = list(g.bm.verts)
    xs = [v.co.x for v in vs]
    ys = [v.co.y for v in vs]
    cx, cy = (min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2
    for v in vs:
        v.co.x -= cx
        v.co.y -= cy
    return {"post_ao": [teinte_drap, lisser], "pose": {"position": "au sol, au pied de la table ou du comptoir découverts", "rotation_deg": "au choix"},
            "note": "pivot au centre de l'emprise, au sol; une seule forme pour les cinq draps (tournée au hasard)"}


# ------------------------------------------------------------------------------------------------
# A5: petits objets

@objet("mail_bundle", "objet", 600, nom="Trois ans de courrier glissé sous la porte")
def o_mail(g, ctx):
    """Enveloppes, publicités, cartes et un journal, en éventail depuis le bas de la porte (vers le sud, +Z): le
    courrier est poussé sous la porte vitrée et glisse sur le parquet. Plus c'est vieux, plus c'est dessous et jauni."""
    rng = random.Random(1987)
    kinds = [
        ("env_long", 0.22, 0.11, ["paper", "paper_old", "label"]),
        ("env", 0.162, 0.114, ["paper", "paper_old", "faience_white", "kraft"]),
        ("carte", 0.15, 0.105, ["poster_sky", "flower_rose", "paper"]),
        ("pub", 0.21, 0.148, ["lemon", "child_blue", "lacquer_red", "paper"]),
        ("kraft", 0.229, 0.162, ["kraft", "cardboard"]),
    ]
    items = []
    n = 26
    for i in range(n):
        kind = rng.choices(kinds, weights=[4, 6, 2, 3, 1])[0]
        # éventail: près de la porte (y +0,25) les plus récents, les plus anciens poussés plus loin vers le nord
        age = 1 - i / n
        r = 0.04 + 0.42 * age * rng.uniform(0.6, 1.0)
        a = math.radians(rng.uniform(-60, 60))
        x = r * math.sin(a) * 1.15
        y = 0.25 - r * math.cos(a)
        rot = rng.uniform(-35, 35)
        items.append((kind, x, y, rot, rng.choice(kind[3])))
    items.insert(0, (("journal", 0.30, 0.20, ["paper"]), 0.06, 0.06, 12.0, "paper"))
    # carte des hauteurs du tas (pas de 5 mm): chaque papier se pose sur ceux d'avant et se plie sur leurs bords
    pas = 0.005
    x0h, y0h = -0.7, -0.5
    H = np.zeros((int(1.4 / pas), int(1.0 / pas)))

    def h_at(x, y, rayon):
        i, j = int((x - x0h) / pas), int((y - y0h) / pas)
        k = int(rayon / pas) + 1
        return float(H[max(0, i - k):i + k + 1, max(0, j - k):j + k + 1].max())

    def poser(nom, x, y, rot, w, h, nu, nv, key, th):
        ca, sa = math.cos(math.radians(rot)), math.sin(math.radians(rot))

        def monde(u, v):
            # rotation dans le sens horaire vu de dessus sur le plan, comme Geo.rotate_z
            return x + u * ca - v * sa, y + u * sa + v * ca
        us = np.linspace(-w / 2, w / 2, nu)
        vs_ = np.linspace(-h / 2, h / 2, nv)
        dil = max(w / (nu - 1), h / (nv - 1)) * 0.75
        Z = np.zeros((nu, nv))
        for i, u in enumerate(us):
            for j, v in enumerate(vs_):
                Z[i, j] = h_at(*monde(u, v), dil) + 0.0006
        if nom == "journal":
            Z[:] = Z.max()
            gv = g.box(-w / 2, w / 2, -h / 2, h / 2, Z.max(), Z.max() + th, key, bevel=0.0015, drop=("bottom",))
            Z = Z + th
            for v in gv:
                pu, pv = v.co.x, -v.co.y
                wx, wy = monde(pu, pv)
                v.co = P(wx, wy, v.co.z)
        else:
            vv = [[g.bm.verts.new(P(*monde(u, v), Z[i, j])) for j, v in enumerate(vs_)] for i, u in enumerate(us)]
            for i in range(nu - 1):
                for j in range(nv - 1):
                    f = g.bm.faces.new((vv[i][j], vv[i + 1][j], vv[i + 1][j + 1], vv[i][j + 1]))
                    f.normal_update()
                    if f.normal.z < 0:
                        f.normal_flip()
                    f.material_index = g.mi(key)

        def z_local(u, v):
            fu = np.interp(u, us, np.arange(nu))
            fv = np.interp(v, vs_, np.arange(nv))
            i0, j0 = min(int(fu), nu - 2), min(int(fv), nv - 2)
            tu, tv = fu - i0, fv - j0
            return (Z[i0, j0] * (1 - tu) * (1 - tv) + Z[i0 + 1, j0] * tu * (1 - tv) + Z[i0, j0 + 1] * (1 - tu) * tv
                    + Z[i0 + 1, j0 + 1] * tu * tv)

        def marque(u0, u1, v0, v1, k):
            pts = [(u0, v0), (u1, v0), (u1, v1), (u0, v1)]
            g.quad([(*monde(u, v), z_local(u, v) + 0.0005) for u, v in pts], k, normal_hint=(0, 0, 1))
        # mise à jour de la carte des hauteurs sous le papier
        for i in range(H.shape[0]):
            cx_ = x0h + (i + 0.5) * pas
            if abs(cx_ - x) > (w + h) / 2 + 0.01:
                continue
            for j in range(H.shape[1]):
                cy_ = y0h + (j + 0.5) * pas
                du, dv = cx_ - x, cy_ - y
                u, v = du * ca + dv * sa, -du * sa + dv * ca
                if abs(u) <= w / 2 and abs(v) <= h / 2:
                    H[i, j] = max(H[i, j], z_local(u, v) + (0.0012 if nom != "journal" else 0.0))
        return marque

    for (kind, x, y, rot, key) in items:
        nom, w, h, _ = kind
        nu, nv = (3, 3) if nom != "journal" else (2, 2)
        marque = poser(nom, x, y, rot, w, h, nu, nv, key, 0.008 if nom == "journal" else 0.0)
        if nom in ("env", "env_long"):
            # timbre en haut à droite, trois lignes d'adresse
            marque(w / 2 - 0.035, w / 2 - 0.01, h / 2 - 0.04, h / 2 - 0.01, rng.choice(["lacquer_red", "book_blue", "leaf_dark"]))
            for j in range(3):
                vv0 = -0.005 - j * 0.013
                marque(-0.03, 0.05, vv0 - 0.003, vv0, "ink")
        elif nom == "journal":
            for j in range(4):
                vv0 = h / 2 - 0.02 - j * 0.045
                marque(-0.13, 0.13, vv0 - 0.025, vv0, "slate" if j == 0 else "paper_old")
        elif nom == "pub":
            marque(-w / 2 + 0.015, w / 2 - 0.015, -0.04, 0.02, "paper" if key != "paper" else "lacquer_red")
    return {"pose": {"position": gltf(9.4, 12.2, 0), "rotation_deg": 0},
            "note": "pivot au centre du tas, au sol; l'avant (+Z) regarde la porte: posé à (9,4 ; 12,2), tourné de 0°, il part du seuil"}


@objet("bucket_sponge", "objet", 600, nom="Seau d'eau et éponge")
def o_bucket(g, ctx):
    """Seau de zinc de 10 litres à moitié plein, anse de fil de fer couchée sur le bord, éponge jaune à face verte qui
    flotte (nœud à part: on la prend dans le seau pour laver les vitrines)."""
    n = pans(14)
    # paroi extérieure, rebord roulé, paroi intérieure jusqu'à l'eau
    prof = [(0.115, 0.0), (0.118, 0.012), (0.146, 0.262), (0.152, 0.268), (0.150, 0.276), (0.143, 0.272), (0.141, 0.262), (0.122, 0.13)]
    vs = g.lathe(0, 0, 0, prof, n, "t:zinc", cap_bottom=True, cap_top=False, smooth=True)
    # surface ouverte: recalc_face_normals peut la retourner par morceaux. Le profil monte dehors, passe le rebord et
    # redescend dedans: la normale voulue de chaque bande est (dz, -dr) dans le plan (rayon, hauteur); le fond regarde
    # le bas.
    sv = set(vs)
    for f in {f for v in vs for f in v.link_faces if all(w in sv for w in f.verts)}:
        c = f.calc_center_median()
        f.normal_update()
        if c.z < 0.001 and abs(f.normal.z) > 0.9:
            if f.normal.z > 0:
                f.normal_flip()
            continue
        rr = math.hypot(c.x, c.y)
        k = min(range(len(prof) - 1), key=lambda i: math.hypot((prof[i][0] + prof[i + 1][0]) / 2 - rr, (prof[i][1] + prof[i + 1][1]) / 2 - c.z))
        dr, dz = prof[k + 1][0] - prof[k][0], prof[k + 1][1] - prof[k][1]
        nr = (f.normal.x * c.x + f.normal.y * c.y) / max(rr, 1e-6)
        if nr * dz + f.normal.z * (-dr) < 0:
            f.normal_flip()
    # eau (un peu trouble, elle a servi)
    for v in g.cyl(0, 0, 0.125, 0.13, 0.1225, n, "jardin_water", cap_bottom=False):
        for f in v.link_faces:
            f.normal_update()
            if abs(f.normal.z) > 0.9 and f.normal.z < 0:
                f.normal_flip()
    # oreilles et anse (demi-cercle de fil couché vers l'est, sur le bord)
    for s in (-1, 1):
        g.box(s * 0.152 - 0.008, s * 0.152 + 0.008, -0.006, 0.006, 0.225, 0.255, "zinc", bevel=0.002)
    # anse rabattue vers le sud, 20° sous l'horizontale: elle pend contre le dehors du rebord, sans le traverser
    pts = []
    r, phi = 0.156, math.radians(-20)
    for k in range(9):
        a = math.pi * k / 8
        pts.append((r * math.cos(a), r * math.sin(a) * math.cos(phi), 0.24 + r * math.sin(a) * math.sin(phi)))
    for a_, b_ in zip(pts, pts[1:]):
        g.rod(a_, b_, 0.003, 6, "iron", cap=False)
    g.rod((-0.035, pts[4][1], pts[4][2]), (0.035, pts[4][1], pts[4][2]), 0.011, 8, "oak_dark", smooth=True)
    sp = Geo("bucket_sponge_sponge")
    sp.box(-0.06, 0.06, -0.04, 0.04, 0.0, 0.03, "lemon", bevel=0.012, segs=1)
    sp.box(-0.06, 0.06, -0.04, 0.04, 0.03, 0.04, "leaf_dark", bevel=0.004, drop=("bottom",))
    vv = list(sp.bm.verts)
    M = Matrix.Translation(P(-0.02, -0.03, 0.118)) @ Matrix.Rotation(math.radians(-18), 4, "Y") @ Matrix.Rotation(math.radians(25), 4, "Z")
    Geo.transform(vv, M)
    return {"extra_geos": [sp], "pose": {"position": gltf(8.9, 11.8, 0), "rotation_deg": 0, "pourquoi": "le plan dit (8,6 ; 12,2): le seau y touche le drap et les chaises de table-3 (x 8,00); à (8,9 ; 11,8) il reste près de la porte, 12 cm du drap"},
            "sockets": [sk("sponge", -0.02, -0.03, 0.15, parent="bucket_sponge_sponge")],
            "note": "pivot au centre du fond, au sol; l'éponge (nœud bucket_sponge_sponge) se cache quand un joueur la prend"}


@objet("price_tag", "objet", 150, accroche="plafond", nom="Étiquette de prix en carton de Simone")
def o_tag(g, ctx):
    """Étiquette américaine de carton kraft, coins coupés, œillet renforcé et ficelle nouée. Le texte (écrit à la main
    par le jeu) va sur le nœud price_tag_text: UV de 0 à 1 sur la zone d'écriture, matériau à part."""
    w, h, th = 0.08, 0.12, 0.0016
    zt = -0.05  # haut de l'étiquette sous le point d'accroche
    c = 0.018
    pts = [(-w / 2, zt - h), (w / 2, zt - h), (w / 2, zt - c), (w / 2 - c, zt), (-w / 2 + c, zt), (-w / 2, zt - c)]
    vs = g.prism([(x, z) for x, z in pts], -th / 2, th / 2, "kraft")
    # le prisme est construit à plat (z du plan): on le relève dans le plan x-z, face vers le sud (+Z glTF)
    for v in vs:
        x, y, z = v.co.x, -v.co.y, v.co.z
        v.co = P(x, -z, y)
    ring = g.cyl(0, 0, -th / 2 - 0.0006, th / 2 + 0.0006, 0.007, 10, "paper_old")
    for v in ring:
        x, y, z = v.co.x, -v.co.y, v.co.z
        v.co = P(x, -z, zt - 0.012 + y)
    # ficelle: boucle de l'œillet au point d'accroche
    for (a_, b_) in (((0, 0, zt - 0.012), (-0.006, 0, -0.025)), ((-0.006, 0, -0.025), (0, 0, 0)), ((0, 0, 0), (0.006, 0, -0.025)),
                     ((0.006, 0, -0.025), (0, 0, zt - 0.012))):
        g.rod((a_[0], a_[1], a_[2]), (b_[0], b_[1], b_[2]), 0.0012, 5, "paper", cap=False)
    txt = plaque("price_tag_text", [(-w / 2 + 0.006, th / 2 + 0.0004, zt - h + 0.008), (w / 2 - 0.006, th / 2 + 0.0004, zt - h + 0.008),
                                    (w / 2 - 0.006, th / 2 + 0.0004, zt - 0.026), (-w / 2 + 0.006, th / 2 + 0.0004, zt - 0.026)],
                 mat_uni("dt_price_tag_text", K.C["kraft"]))
    return {"objets": [txt], "parents": {"price_tag_text": "price_tag"},
            "pose": {"position": "point d'accroche sur l'objet de Simone (dossier de chaise, poignée de la machine, coin du drap)", "rotation_deg": "face au joueur"},
            "texte": {"noeud": "price_tag_text", "uv": "0..1 sur la zone d'écriture (6,8 x 8,6 cm)", "materiau": "dt_price_tag_text (kraft uni): y poser une CanvasTexture (Caveat, encre #2B2622)"},
            "note": "pivot au point d'accroche, l'étiquette pend vers -Y (12 cm de carton sous 5 cm de ficelle); face écrite vers +Z"}


# ------------------------------------------------------------------------------------------------
# A7: la machine révisée de Joseph

def cafetiere_revisee():
    """Variante de scene_coque.cafetiere (même gabarit 0,76 x 0,43 m, mêmes groupes, même plan de travail):
    carrosserie d'inox brossé, flancs et bandeau noirs, têtes chromées, deux buses vapeur (une de chaque côté, le
    robinet d'eau chaude est remplacé), molettes noires, galerie chromée. Aucune patine."""
    g = Geo("espresso_revised")
    cx = 9.15
    x0, x1 = cx - 0.38, cx + 0.38
    yf, yb = 8.98, 9.22
    z0 = S.WORK
    INOX, NOIR, CHROME = "steel", "ink", "chrome"
    for x in (x0 + 0.06, x1 - 0.06):
        for y in (8.86, 9.16):
            g.cyl(x, y, z0, z0 + 0.025, 0.022, pans(10), "rubber", bevel=0.005)
    g.box(x0 + 0.01, x1 - 0.01, yf - 0.005, yb, z0 + 0.025, z0 + 0.06, NOIR, bevel=0.01)
    g.box(x0 + 0.04, x1 - 0.04, 8.79, yf, z0 + 0.025, z0 + 0.06, INOX, bevel=0.01)
    for i in range(11):
        x = x0 + 0.07 + i * (x1 - x0 - 0.14) / 10
        g.box(x - 0.004, x + 0.004, 8.805, yf - 0.01, z0 + 0.06, z0 + 0.066, CHROME, bevel=0)
    g.box(x0 + 0.06, x1 - 0.06, 8.805, yf - 0.01, z0 + 0.052, z0 + 0.058, "steel_dark", bevel=0)
    zb0, zb1 = z0 + 0.06, z0 + 0.43
    # corps d'inox, flancs noirs laqués (rapportés de 4 mm sur les côtés)
    g.box(x0, x1, yf, yb, zb0, zb1, INOX, bevel=0.04, segs=2, edges="notop")
    for s in (-1, 1):
        a0, a1 = sorted((s * 0.3815 + cx, s * 0.36 + cx))
        g.box(a0, a1, yf + 0.03, yb - 0.02, zb0 + 0.03, zb1 - 0.04, NOIR, bevel=0.012, segs=1)
    g.box(x0 + 0.005, x1 - 0.005, yf - 0.006, yb + 0.006, zb1 - 0.03, zb1 - 0.012, NOIR, bevel=0.008, segs=2)
    g.box(x0 + 0.07, x1 - 0.07, yf - 0.016, yf + 0.01, z0 + 0.15, zb1 - 0.04, NOIR, bevel=0.02, segs=2)
    g.box(x0 + 0.085, x1 - 0.085, yf - 0.022, yf, z0 + 0.165, zb1 - 0.055, INOX, bevel=0.015, segs=2)
    zg = z0 + 0.3
    for x in (cx - 0.19, cx + 0.19):
        g.rod((x, yf - 0.02, zg), (x, yf - 0.06, zg), 0.026, pans(14), CHROME)
        g.lathe(x, yf - 0.065, z0 + 0.205, [(0.046, 0), (0.05, 0.008), (0.05, 0.045), (0.042, 0.06), (0.03, 0.075), (0.028, 0.095)],
                pans(16), CHROME, cap_bottom=True, cap_top=True, smooth=True)
        g.cyl(x, yf - 0.065, z0 + 0.235, z0 + 0.247, 0.053, pans(16), NOIR, bevel=0.003)
        zp = z0 + 0.168
        g.lathe(x, yf - 0.065, zp, [(0.03, 0), (0.044, 0.012), (0.05, 0.032), (0.052, 0.037)], pans(16), CHROME,
                cap_bottom=True, cap_top=True, smooth=True)
        for dx in (-0.016, 0.016):
            g.lathe(x + dx, yf - 0.065, zp - 0.016, [(0.004, 0), (0.008, 0.016)], 8, CHROME, cap_bottom=True, cap_top=False, smooth=True)
        g.rod((x, yf - 0.11, zp + 0.024), (x, yf - 0.15, zp + 0.02), 0.011, 10, CHROME)
        g.rod((x, yf - 0.15, zp + 0.02), (x, yf - 0.27, zp + 0.005), 0.019, pans(12), NOIR, smooth=True)
        g.sphere(x, yf - 0.272, zp + 0.005, 0.021, 0.021, 0.021, NOIR, segs=pans(12), rings=6)
        # bouton de dose (au lieu de la molette de laiton)
        g.cyl(x, yf - 0.03, zb1 - 0.075, zb1 - 0.055, 0.02, pans(12), NOIR, bevel=0.004)
    man = g.cyl(cx, 0, 0, 0.014, 0.05, pans(20), CHROME, bevel=0.004)
    face = g.cyl(cx, 0, 0.014, 0.017, 0.042, pans(20), "paper")
    for v in man + face:
        x, y, z = v.co.x, -v.co.y, v.co.z
        v.co = P(x, yf - 0.014 - z, z0 + 0.32 + y)
    g.quad([(cx - 0.003, yf - 0.0325, z0 + 0.318), (cx + 0.003, yf - 0.0325, z0 + 0.318), (cx + 0.022, yf - 0.0325, z0 + 0.345),
            (cx + 0.018, yf - 0.0325, z0 + 0.348)], "ink", normal_hint=(0, -1, 0))
    for k in range(7):
        a = math.radians(-135 + k * 45)
        px, pz = cx + 0.035 * math.sin(a), z0 + 0.32 + 0.035 * math.cos(a)
        g.box(px - 0.002, px + 0.002, yf - 0.0325, yf - 0.031, pz - 0.002, pz + 0.002, "ink", bevel=0)
    # deux buses vapeur, symétriques: molette noire, tube coudé, rotule, embout
    for s in (-1, 1):
        xs = cx + s * (0.38 - 0.075)
        g.cyl(xs, yf - 0.02, zb1 - 0.08, zb1 - 0.055, 0.022, pans(12), NOIR, bevel=0.005)
        pts = [(xs, yf - 0.014, zg + 0.04), (xs, yf - 0.05, zg + 0.035), (xs + s * 0.005, yf - 0.08, zg + 0.015), (xs + s * 0.012, yf - 0.095, zg - 0.02),
               (xs + s * 0.018, yf - 0.1, z0 + 0.12), (xs + s * 0.02, yf - 0.1, z0 + 0.09)]
        for a_, b_ in zip(pts, pts[1:]):
            g.rod(a_, b_, 0.0085, 8, CHROME, cap=False)
        g.sphere(xs, yf - 0.05, zg + 0.035, 0.016, 0.016, 0.016, CHROME, segs=8, rings=5)
        g.rod(pts[1], pts[2], 0.012, 8, NOIR)  # gaine isolante
    g.box(x0 + 0.03, x1 - 0.03, yf + 0.01, yb - 0.01, zb1, zb1 + 0.012, INOX, bevel=0.005)
    zr = zb1 + 0.065
    for (a, b) in (((x0 + 0.04, yf + 0.02), (x1 - 0.04, yf + 0.02)), ((x0 + 0.04, yb - 0.02), (x1 - 0.04, yb - 0.02)),
                   ((x0 + 0.04, yf + 0.02), (x0 + 0.04, yb - 0.02)), ((x1 - 0.04, yf + 0.02), (x1 - 0.04, yb - 0.02))):
        g.rod((a[0], a[1], zr), (b[0], b[1], zr), 0.006, 6, CHROME, cap=False)
    for (x, y) in ((x0 + 0.04, yf + 0.02), (x1 - 0.04, yf + 0.02), (x0 + 0.04, yb - 0.02), (x1 - 0.04, yb - 0.02), (cx, yf + 0.02), (cx, yb - 0.02)):
        g.rod((x, y, zb1 + 0.012), (x, y, zr), 0.006, 6, CHROME, cap=False)
        g.sphere(x, y, zr, 0.009, 0.009, 0.009, CHROME, segs=6, rings=4)
    return g


@objet("espresso_revised", "poste", 4000, accroche="surface", nom="La machine révisée de Joseph (deux groupes, deux buses)")
def o_espresso_revised(g, ctx):
    import objets as OB
    tmp = cafetiere_revisee()
    OB._absorber(g, tmp)
    OB.recentrer(g, rot180=True, centre=(9.15, 9.005), z0=S.WORK)
    cx, cy = 9.15, (8.79 + 9.22) / 2
    socks = []
    for i, x in enumerate((cx - 0.19, cx + 0.19)):
        dx = -(x - cx)
        socks.append(sk(f"cup_{i}", dx, -(8.915 - cy), 0.066))
        socks.append(sk(f"group_{i}", dx, -(8.915 - cy), 0.205))
    # même nom que la vieille dame pour la buse de l'ouest (à droite du barista), plus la seconde à l'est
    socks.append(sk("steam_wand", -((cx - 0.38 + 0.075 - 0.02) - cx), -((8.98 - 0.1) - cy), 0.09))
    socks.append(sk("steam_wand_1", -((cx + 0.38 - 0.075 + 0.02) - cx), -((8.98 - 0.1) - cy), 0.09))
    socks.append(sk("cup_warmer", 0.0, 0.0, 0.443))
    return {"sockets": socks, "usage": "barista face à la façade de la machine (avant du modèle)",
            "pose": {"position": [9.15, 0.95, 9.005], "rotation_deg": 180},
            "note": "même origine et même pose que station_espresso_2g (centre x 9,15, z 9,005, plan de travail à 0,95 m, tournée de 180°)"}


# ------------------------------------------------------------------------------------------------
# Production

def _socket(name, loc_plan, parent):
    e = bpy.data.objects.new(name, None)
    e.empty_display_size = 0.05
    bpy.context.scene.collection.objects.link(e)
    e.parent = parent
    e.location = K.P(*loc_plan)
    return e


def produire(ids, fiche_path, ao=True):
    t0 = time.time()
    sims = {}
    for ident in ids:
        if CATALOGUE[ident]["sim"]:
            ts = time.time()
            sims[ident] = CATALOGUE[ident]["sim"]()
            print(f"simulation {ident}: {time.time() - ts:.0f} s")
    K.vider_scene()
    built = []
    for ident in ids:
        spec = CATALOGUE[ident]
        g = Geo(ident)
        info = spec["fn"](g, {"sim": sims.get(ident)}) or {}
        ob = K.finir(g, seed=zlib.crc32(ident.encode()))
        parts = K.separer_par_materiau(ob)
        for eg in info.get("extra_geos", []):
            parts.append(K.finir(eg, seed=zlib.crc32(eg.name.encode())))
        parts += info.get("objets", [])
        occ = [K.finir(og, seed=1) for og in info.get("occluders", [])]
        built.append((ident, spec, info, parts, occ))
    planes = []
    for i, (ident, spec, info, parts, occ) in enumerate(built):
        off = Vector(((i % 6) * SPACING, -(i // 6) * SPACING, 0))
        for o in parts + occ:
            o.location = off
        if spec["accroche"] in ("sol", "surface"):
            bpy.ops.mesh.primitive_plane_add(size=4.0, location=off)
            planes.append(bpy.context.active_object)
    bpy.context.view_layer.update()
    meshes = [o for (_, _, _, parts, _) in built for o in parts]
    bake = [o for o in meshes if o.data.materials and o.data.materials[0].name == "dt_meubles"]
    if ao:
        K.cuire_ao(bake)
        K.ao_blanc([o for o in meshes if o not in bake])
    else:
        K.ao_blanc(meshes)
    for o in planes + [o for (_, _, _, _, occ) in built for o in occ]:
        bpy.data.objects.remove(o, do_unlink=True)
    fiches = {}
    for (ident, spec, info, parts, occ) in built:
        for fn in info.get("post_ao", []):
            fn([o for o in parts if o in bake])
        off = parts[0].location.copy()
        for o in parts:
            o.location = (0, 0, 0)
        bpy.context.view_layer.update()
        by_name = {o.name: o for o in parts}
        main = by_name[ident]
        for child, par in info.get("parents", {}).items():
            by_name[child].parent = by_name[par]
            by_name[child].matrix_parent_inverse = Matrix.Identity(4)
        roots = [main] + [o for o in parts if o.parent is None and o is not main]
        sockets = [_socket(f"socket_{s['name']}", (s["x"], s["y"], s["z"]), by_name[s["parent"]] if s.get("parent") else main)
                   for s in info.get("sockets", [])]
        extras = {"id": ident, "category": spec["categorie"], "mount": spec["accroche"], "front": [0, 0, 1]}
        if "animation" in info:
            extras["animation"] = {"node": info["animation"]["noeud"], "raise_translation_y": info["animation"]["lever"]["translation_y_m"],
                                   "duration_s": info["animation"]["lever"]["duree_s"]}
        objs = roots + [o for o in parts if o.parent is not None] + sockets
        path = os.path.join(K.ASSETS, f"{ident}.glb")
        size = K.exporter_glb(objs, path, extras=extras)
        dims = K.gltf_dims(parts)
        tri = sum(K.tris(o) for o in parts)
        f = {
            "id": ident, "nom": spec["nom"], "fichier": f"{ident}.glb", "famille": "installation", "style": "neutre",
            "categorie": spec["categorie"], "accroche": spec["accroche"],
            "dimensions_m": {"x": dims[0], "y": dims[1], "z": dims[2]}, "triangles": tri, "budget_triangles": spec["budget"],
            "dans_budget": tri <= spec["budget"], "materiaux": sorted({o.data.materials[0].name for o in parts}),
            "noeuds": sorted(o.name for o in parts), "poids_octets": size, "avant": [0, 0, 1],
            "source": "Blender scripté (installation.py)" + (", simulation de tissu Cloth" if spec["sim"] else ""),
        }
        for k in ("pose", "animation", "baie", "controle", "note", "usage", "texte"):
            if k in info:
                f[k] = info[k]
        if info.get("sockets"):
            f["douilles"] = {f"socket_{s['name']}": {"position": gltf(s["x"], s["y"], s["z"]), "parent": s.get("parent") or ident}
                             for s in info["sockets"]}
        fiches[ident] = f
        for sk_ in sockets:
            bpy.data.objects.remove(sk_, do_unlink=True)
        for o in parts:
            if o.parent is not None:
                o.parent = None
        for o in parts:
            o.location = off
    old = {}
    if os.path.exists(fiche_path):
        old = json.load(open(fiche_path))
    old.update(fiches)
    with open(fiche_path, "w") as fh:
        json.dump(old, fh, ensure_ascii=False, indent=1)
    bpy.ops.wm.save_as_mainfile(filepath=os.path.splitext(fiche_path)[0] + ".blend", compress=True)
    print(f"{len(ids)} modèles en {time.time() - t0:.0f} s")
    for ident, f in fiches.items():
        print(f"{ident}: {f['triangles']} tri (budget {f['budget_triangles']}), {f['dimensions_m']}, {f['poids_octets']} o, {f['materiaux']}")
        if "controle" in f:
            print("   contrôle:", f["controle"])
    return fiches


def main():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    ap = argparse.ArgumentParser()
    ap.add_argument("--seulement", default="")
    ap.add_argument("--sans-ao", action="store_true")
    a = ap.parse_args(argv)
    ids = [i for i in a.seulement.split(",") if i] or list(CATALOGUE)
    produire(ids, os.path.join(ICI, "fiches", "installation.json"), ao=not a.sans_ao)


if __name__ == "__main__":
    main()
