"""Personnages de Meshy posés dans la scène (essai: immobiles).

Chaque personnage est généré par Meshy (image vers 3D en topologie intelligente, riggé par Meshy: même squelette
de 24 os pour tous). Les poses viennent des clips déjà achetés par le tech-artist sur le client pressé
(`docs/production/essais-meshy/modeles/char_essai_presse.glb`: idle, sit, drink, sit_drink): un clip sert à tous
les personnages, les pistes visent les os par leur nom. Le maillage déformé à l'image choisie est figé dans un Geo.

Variante A: chaque face prend la case de palette la plus proche de la texture de Meshy (parmi les couleurs permises
du personnage), comme le veut la bible (13.3). Variante B: la texture de Meshy est gardée (réduite à 512 px).
"""

import math
import os

import bpy
import bmesh
import numpy as np
from mathutils import Euler, Matrix, Vector

from geo import Geo
import materiaux as M

ICI = os.path.dirname(os.path.abspath(__file__))
CLIPS_GLB = os.path.normpath(os.path.join(ICI, "..", "..", "..", "..", "production", "essais-meshy", "modeles", "char_essai_presse.glb"))


def _lab(rgb):
    def f(t):
        return t ** (1 / 3) if t > 0.008856 else 7.787 * t + 16 / 116
    lin = [c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in rgb]
    x = (0.4124 * lin[0] + 0.3576 * lin[1] + 0.1805 * lin[2]) / 0.9505
    y = 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2]
    z = (0.0193 * lin[0] + 0.1192 * lin[1] + 0.9505 * lin[2]) / 1.089
    fx, fy, fz = f(x), f(y), f(z)
    return (116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz))


_actions = None


def actions():
    """Importe une fois les clips du client pressé et rend {nom: action}."""
    global _actions
    if _actions is not None:
        return _actions
    avant = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=CLIPS_GLB)
    for o in set(bpy.data.objects) - avant:
        bpy.data.objects.remove(o, do_unlink=True)
    _actions = {}
    for a in bpy.data.actions:
        for nom in ("sit_drink", "drink", "sit", "idle", "walk"):
            if a.name.startswith(nom) and nom not in _actions and not (nom == "sit" and a.name.startswith("sit_drink")) \
                    and not (nom == "drink" and a.name.startswith("sit_")):
                _actions[nom] = a
                a.use_fake_user = True
    return _actions


def poser_personnage(spec, variante, collection):
    """spec: nom, glb (riggé), clip, image, rot (os -> (x, y, z) degrés ajoutés), hauteur, x, y, cap, z,
    couleurs (hex permis en A). Rend un Geo de type « char »."""
    avant = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=spec["glb"])
    nouveaux = set(bpy.data.objects) - avant
    arm = next(o for o in nouveaux if o.type == "ARMATURE")
    # seulement les maillages à peau (l'import glTF ajoute une icosphère pour dessiner les os)
    meshes = [o for o in nouveaux if o.type == "MESH" and any(m.type == "ARMATURE" for m in o.modifiers)]
    sc = bpy.context.scene
    act = actions()[spec["clip"]]
    arm.animation_data_create()
    arm.animation_data.use_nla = False
    arm.animation_data.action = act
    if act.slots:
        arm.animation_data.action_slot = act.slots[0]
    sc.frame_set(int(spec.get("image", 0)))
    # pose figée: on lit la pose du clip, on retire le clip, puis on ajoute les rotations posées à la main
    poses = {pb.name: pb.matrix_basis.copy() for pb in arm.pose.bones}
    arm.animation_data.action = None
    for pb in arm.pose.bones:
        pb.matrix_basis = poses[pb.name]
    for os_nom, rot in spec.get("rot", {}).items():
        pb = arm.pose.bones.get(os_nom)
        if pb is not None:
            pb.rotation_mode = "QUATERNION"
            pb.rotation_quaternion = pb.rotation_quaternion @ Euler([math.radians(a) for a in rot], "XYZ").to_quaternion()
    bpy.context.view_layer.update()
    hanches = arm.matrix_world @ arm.pose.bones["Hips"].head
    main_d = arm.matrix_world @ arm.pose.bones["RightHand"].head
    torse = arm.matrix_world @ arm.pose.bones["Spine"].head
    dg = bpy.context.evaluated_depsgraph_get()
    g = Geo(spec["nom"], kind="char", smooth=True)
    bm = g.bm
    tex_img = None
    for mo in meshes:
        ev = mo.evaluated_get(dg)
        me = bpy.data.meshes.new_from_object(ev, preserve_all_data_layers=True, depsgraph=dg)
        me.transform(mo.matrix_world)
        n0 = len(bm.faces)
        bm.from_mesh(me)
        for m in mo.data.materials:
            if m and m.node_tree:
                for n in m.node_tree.nodes:
                    if n.type == "TEX_IMAGE" and n.image:
                        tex_img = n.image
        bpy.data.meshes.remove(me)
    for o in nouveaux:
        bpy.data.objects.remove(o, do_unlink=True)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    # taille: la hauteur debout du rig (1,70 m) ramenée à la stature voulue, pieds au sol
    s = spec.get("hauteur", 1.7) / 1.7
    zmin = min(v.co.z for v in bm.verts)
    # assis: les hanches au-dessus du centre de l'assise, à la hauteur voulue; debout: pieds au sol
    if "hanches_z" in spec:
        ox, oy = hanches.x, hanches.y
        dz = spec["hanches_z"] - hanches.z * s
        z0 = 0.0
    else:
        ox, oy, dz, z0 = 0.0, 0.0, 0.0, zmin
    tr = lambda p: Vector(((p.x - ox) * s, (p.y - oy) * s, (p.z - z0) * s + dz))
    for v in bm.verts:
        v.co = tr(v.co)
    g.main_droite = tr(main_d)
    g.torse = tr(torse)
    uvl = bm.loops.layers.uv.active
    orig = g.bm.loops.layers.uv.new("orig")
    for f in bm.faces:
        for lp in f.loops:
            lp[orig].uv = lp[uvl].uv
    # couleur par face
    if variante == "A":
        w, h = tex_img.size
        px = np.array(tex_img.pixels[:], dtype=np.float32).reshape(h, w, 4)[..., :3]
        # les pixels d'une image 8 bits restent encodés en sRGB dans Blender: pas de conversion
        permis = [(hx, _lab(M.rgb(hx))) for hx in spec["couleurs"]]
        cles = []
        for f in bm.faces:
            u = sum(lp[uvl].uv.x for lp in f.loops) / len(f.loops)
            v_ = sum(lp[uvl].uv.y for lp in f.loops) / len(f.loops)
            xi = min(w - 1, max(0, int((u % 1.0) * w)))
            yi = min(h - 1, max(0, int((v_ % 1.0) * h)))
            lab = _lab(px[yi, xi])
            best = min(permis, key=lambda t: (lab[0] - t[1][0]) ** 2 + (lab[1] - t[1][1]) ** 2 + (lab[2] - t[1][2]) ** 2)
            cles.append(best[0])
        # lissage: une face prend la couleur majoritaire de ses voisines si elle est seule de sa couleur
        bm.faces.ensure_lookup_table()
        idx = {f: i for i, f in enumerate(bm.faces)}
        for _ in range(2):
            new = list(cles)
            for f in bm.faces:
                vois = [cles[idx[o]] for e in f.edges for o in e.link_faces if o is not f]
                if vois and cles[idx[f]] not in vois:
                    new[idx[f]] = max(set(vois), key=vois.count)
            cles = new
        for f, k in zip(bm.faces, cles):
            f.material_index = g.mi(k)
    else:
        key = f"tex:{spec['nom']}"
        for f in bm.faces:
            f.material_index = g.mi(key)
        if tex_img is not None:
            tex_img.name = f"tex_{spec['nom']}"
            if tex_img.size[0] > 512:
                tex_img.scale(512, 512)
            tex_img.pack()
            M.TEXTURES_PERSOS[key] = tex_img
    for f in bm.faces:
        f.smooth = True
    # repères (main droite, torse) dans le repère du personnage, avant la pose dans la salle
    reperes = [bm.verts.new(g.main_droite), bm.verts.new(g.torse)]
    if spec.get("badge"):
        badge(g, spec["badge"])
    vs = list(bm.verts)
    Geo.rotate_z(vs, 0, 0, spec["cap"] - 180)
    Geo.move(vs, spec["x"], spec["y"], 0)
    g.main_droite = reperes[0].co.copy()
    g.torse = reperes[1].co.copy()
    for v in reperes:
        bm.verts.remove(v)
    return g


def badge(g, couleur):
    """Petit badge rond (3 cm) à la couleur du joueur, épinglé sur la bavette, à hauteur de poitrine: le seul signe
    du joueur sur sa tenue (demande du client, 2026-11-07)."""
    from mathutils.bvhtree import BVHTree
    bm = g.bm
    bm.faces.ensure_lookup_table()
    tree = BVHTree.FromBMesh(bm)
    t = g.torse
    z = t.z + 0.2
    hit = tree.ray_cast(Vector((t.x + 0.07, -1.0, z)), Vector((0, 1, 0)))
    if hit[0] is None:
        return
    p = hit[0] + Vector((0, -0.004, 0))
    n = 14
    ring = [bm.verts.new(p + Vector((0.016 * math.cos(2 * math.pi * i / n), -0.002, 0.016 * math.sin(2 * math.pi * i / n)))) for i in range(n)]
    f = bm.faces.new(ring)
    f.normal_update()
    if f.normal.y > 0:
        f.normal_flip()
    f.material_index = g.mi(couleur)
    f.smooth = False
    back = [bm.verts.new(p + Vector((0.019 * math.cos(2 * math.pi * i / n), 0.003, 0.019 * math.sin(2 * math.pi * i / n)))) for i in range(n)]
    for i in range(n):
        j = (i + 1) % n
        q = bm.faces.new([ring[i], ring[j], back[j], back[i]])
        q.material_index = g.mi("piping")
        q.normal_update()
        if q.normal.y > 0.5:
            q.normal_flip()


def construire(PAL, variante, dossier_rigs):
    """Les cinq personnages de l'essai. Rend la liste des Geo, ou None si les modèles riggés manquent."""
    C = PAL["couleurs"]
    J = PAL["joueurs"]
    rig = lambda n: os.path.join(dossier_rigs, f"{n}.glb")
    if not all(os.path.exists(rig(n)) for n in ("lecteur", "attente", "barista1", "barista2")):
        return None
    peaux, cheveux = PAL["peaux"], PAL["cheveux"]
    base = list(peaux) + list(cheveux) + [C["ink"], C["porcelain"], C["top_dark_coffee"], C["etudiants_burgundy"], C["teletravail_grey"]]
    specs = [
        # la cliente à la caisse: le client pressé du tech-artist (déjà conforme), debout, au repos
        {"nom": "char_client_register", "glb": rig("caisse") if os.path.exists(rig("caisse")) else CLIPS_GLB, "clip": "idle", "image": 0, "hauteur": 1.7, "x": 10.55, "y": 10.05, "cap": 0,
         "couleurs": base + [C["presses_coat"], C["presses_charcoal"], C["presses_navy"], C["presses_bag"], C["kraft"]]},
        # le flâneur qui lit la carte ouverte sur la table, assis face à l'ouest à la table de la vitrine
        {"nom": "char_client_reading", "glb": rig("lecteur"), "clip": "sit", "image": 0, "hauteur": 1.76, "x": 8.6, "y": 12.2, "cap": 270,
         "hanches_z": 0.55, "couleurs": base + [C["flaneurs_knit"], C["flaneurs_cord"], C["flaneurs_scarf"]]},
        # la cliente qui attend, carte fermée posée: assise face au nord
        {"nom": "char_client_waiting", "glb": rig("attente"), "clip": "sit", "image": 0, "hauteur": 1.62, "x": 4.35, "y": 10.74, "cap": 0,
         "hanches_z": 0.55, "couleurs": base + [C["gourmands_raspberry"], C["etudiants_denim"], C["linen"]]},
        # l'avatar de l'astre aqua: tenue de travail de la maison, de dos, plateau tenu devant lui
        {"nom": "char_player_orb", "glb": rig("barista1"), "clip": "drink", "image": 48, "hauteur": 1.75, "x": 6.75, "y": 10.95, "cap": 185,
         "badge": J["orb"]["couleur"], "couleurs": base + [C["house_bottle"], C["top_dark_indigo"], C["presses_charcoal"]]},
        # l'avatar du croissant mauve: derrière la caisse, face à la salle
        {"nom": "char_player_crescent", "glb": rig("barista2"), "clip": "idle", "image": 0, "hauteur": 1.66, "x": 10.35, "y": 8.3, "cap": 180,
         "badge": J["crescent"]["couleur"], "couleurs": base + [C["house_bottle"], C["top_light_cream"], C["etudiants_denim"]]},
    ]
    # un passant sur la place, qui traverse vers l'est (le client pressé du tech-artist, clip de marche)
    specs.append({"nom": "char_passerby", "glb": CLIPS_GLB, "clip": "walk", "image": 6, "hauteur": 1.72, "x": 7.2, "y": 17.6, "cap": 95,
                  "couleurs": base + [C["presses_coat"], C["presses_charcoal"], C["presses_navy"], C["presses_bag"], C["kraft"]]})
    out = []
    for sp in specs:
        g = poser_personnage(sp, variante, None)
        out.append(g)
        if sp["nom"] == "char_client_reading":
            # carte du café ouverte à plat sur la table, devant lui (pages de papier, couverture vert bouteille)
            w = Geo("char_menu", kind="static", smooth=False)
            w.box(8.08, 8.32, 12.04, 12.36, 0.75, 0.756, "house_bottle", bevel=0.002)
            for (a0, a1) in ((12.05, 12.195), (12.205, 12.35)):
                w.box(8.09, 8.31, a0, a1, 0.756, 0.76, "paper", bevel=0.001)
                for k in range(4):
                    xx = 8.12 + k * 0.045
                    w.box(xx, xx + 0.006, a0 + 0.02, a1 - 0.03 - (k % 2) * 0.03, 0.76, 0.7605, "ink", bevel=0)
        if sp["nom"] == "char_player_orb":
            # plateau rond posé sur la main droite, deux tasses
            import scene_cafe as S
            from geo import pans
            h = g.main_droite
            tz = h.z + 0.03
            px, py = h.x, -h.y
            w = Geo("char_tray", kind="static", smooth=True)
            w.cyl(px, py, tz, tz + 0.015, 0.18, pans(16), "tray", bevel=0.005)
            S.tasse(w, px - 0.06, py - 0.03, tz + 0.015, "cappuccino")
            S.tasse(w, px + 0.06, py + 0.05, tz + 0.015, "espresso")
    return out
