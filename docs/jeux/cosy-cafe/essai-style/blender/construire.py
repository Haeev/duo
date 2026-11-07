"""Construit une variante de l'essai de style du café du village, cuit sa lumière et l'exporte en GLB.

Usage (depuis n'importe où):
  duo-python docs/jeux/cosy-cafe/essai-style/blender/construire.py -- --variante A [--res 2048] [--spp 48] [--sans-cuisson]

Sorties: ../modeles/cafe_<variante>.glb (coque, meubles, vaisselle, rue, personnages; la carte de lumière cuite
voyage dans le GLB comme texture d'occlusion sur la seconde coordonnée de texture, et la scène Three.js la
rebranche en lightMap), ../modeles/cafe_<variante>.json (fiche: triangles, matériaux, réglages de cuisson).
Les sorties intermédiaires (lumière en flottants, textures de matière) vont dans le dossier de travail
`--travail` (par défaut: un dossier temporaire hors du dépôt).
"""

import argparse
import json
import math
import os
import sys
import tempfile
import time

import bpy
import numpy as np

ICI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, ICI)

import geo as G  # noqa: E402
from geo import Geo  # noqa: E402
import materiaux as M  # noqa: E402
import scene_cafe as S  # noqa: E402
import personnages as PERS  # noqa: E402
import meshy_import as MI  # noqa: E402

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
ap = argparse.ArgumentParser()
ap.add_argument("--variante", default="A", choices=["A", "B"])
ap.add_argument("--res", type=int, default=2048)
ap.add_argument("--spp", type=int, default=48)
ap.add_argument("--sans-cuisson", action="store_true")
ap.add_argument("--travail", default=os.path.join(tempfile.gettempdir(), "cosy-essai-style"))
ap.add_argument("--rigs", default=os.path.join(ICI, "..", "meshy_output", "rigs"),
                help="personnages riggés par Meshy (sorties brutes hors du dépôt: lecteur, attente, barista1, barista2 .glb)")
ap.add_argument("--meshy", default=os.path.join(ICI, "..", "meshy"), help="dossier des modèles Meshy mis en conformité")
args = ap.parse_args(argv)
V = args.variante
OUT = os.path.normpath(os.path.join(ICI, "..", "modeles"))
os.makedirs(OUT, exist_ok=True)
os.makedirs(args.travail, exist_ok=True)

STYLES = {
    # nom, échelle des chanfreins de la bible, minimum, segments petits et grands, pans des pièces rondes,
    # lissage partout, angle des arêtes vives
    "A": G.Style("A", 1.0, 0.004, 1, 2, 1.0, False, 30),
    "B": G.Style("B", 0.18, 0.002, 1, 1, 2.0, True, 40),
}
G.set_style(STYLES[V])

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.context.preferences.filepaths.save_version = 0
sc = bpy.context.scene
coll = sc.collection
PAL = M.PAL
C = M.C

# ------------------------------------------------------------------------------------------------
# 1. La scène


def construire_scene():
    S.coque()
    S.poutres()
    S.menuiseries()
    S.comptoir()
    S.arriere_comptoir()
    S.cafetiere()
    S.moulin()
    S.caisse_et_livre()
    S.rail_tickets(PAL["joueurs"])
    S.place()

    # mobilier de la salle (plan village-arrivee): trois tables rondes à la vitrine, une table carrée au mur ouest
    f = Geo("furniture")
    for (x, y) in ((4.8, 12.2), (6.4, 12.2), (8.0, 12.2)):
        S.table_ronde(f, x, y)
    S.table_carree(f, 4.0, 9.75)
    chairs = Geo("chairs")
    places = [(4.0, 11.975, "W"), (5.15, 11.975, "E"), (5.6, 11.975, "W"), (6.75, 11.975, "E"), (7.2, 11.975, "W"),
              (8.35, 11.975, "E"), (4.125, 9.25, "N"), (4.125, 10.5, "S")]
    # A: chaise scriptée (chanfreins généreux de la bible); B: chaise paillée de Meshy (pieds tournés, proportions réelles)
    meshy_chair = MI.disponible(args.meshy, "furn_chair_campagne", V) if V == "B" else None
    for (x, y, d) in places:
        if meshy_chair:
            MI.poser(meshy_chair, chairs, x + 0.225, y + 0.225, {"N": 0, "E": 90, "S": 180, "W": 270}[d])
        else:
            S.chaise(chairs, x, y, d)

    # luminaires: deux émaillés au comptoir (passe et caisse), trois en terre cuite aux tables de la vitrine
    lamps = Geo("lamps")
    emit = Geo("lamps_emit", kind="emit")
    bulbs = []
    # au-dessus de l'allée du barista, devant la passe et la machine: la lumière tombe sur le travail
    for (x, y) in ((9.15, 8.72), (10.6, 8.85)):
        bulbs.append(S.suspension(lamps, emit, x, y, "enamel"))
    for (x, y) in ((4.8, 12.2), (6.4, 12.2), (8.0, 12.2)):
        bulbs.append(S.suspension(lamps, emit, x, y, "clay"))

    # vaisselle et viennoiseries
    w = Geo("ware", smooth=True)
    z = S.WORK
    for (x, y, k) in ((8.13, 9.07, "cappuccino"), (8.45, 9.1, "espresso"), (8.66, 8.88, "cappuccino")):
        S.tasse(w, x, y, z, k)
    S.assiette(w, 8.3, 8.9, z)
    croissants = [(8.3, 8.9, z + 0.018, 20)]
    # tasse d'expresso sous le premier groupe, posée sur la grille du bac
    S.tasse(w, 8.96, 8.915, z + 0.066, "espresso", soucoupe=False)
    # tasses retournées sur le chauffe-tasses
    for i, x in enumerate((8.88, 9.02, 9.16, 9.3)):
        vs = []
        before = set(w.bm.verts)
        S.tasse(w, x, 9.08, 0, "espresso", contenu=False)
        vs = [v for v in w.bm.verts if v not in before]
        top = max(v.co.z for v in vs)
        for v in vs:
            v.co.z = z + 0.445 + (top - v.co.z)
        import bmesh
        bmesh.ops.reverse_faces(w.bm, faces=list({f for v in vs for f in v.link_faces}))
    # étagères: tasses de cappuccino et piles d'assiettes
    for i in range(6):
        S.tasse(w, 7.36 + i * 0.235, 7.25, 1.32, "cappuccino", contenu=False, anse_deg=90)
    for i in range(4):
        for k in range(4):
            S.assiette(w, 7.42 + i * 0.36, 7.25, 1.71 + k * 0.018)
    # pichets à lait sur l'arrière-comptoir
    for x in (8.2, 8.36):
        w.lathe(x, 7.4, 0.9, [(0.04, 0), (0.05, 0.005), (0.052, 0.09), (0.045, 0.13), (0.048, 0.14)], G.pans(12), "steel",
                cap_bottom=True, cap_top=False)
    # cloche à viennoiseries sur la tablette des clients, devant le moulin
    w.cyl(9.7, 9.37, S.LEDGE, S.LEDGE + 0.02, 0.17, G.pans(16), "walnut", bevel=0.006)
    croissants += [(9.66, 9.33, S.LEDGE + 0.02, -30), (9.75, 9.42, S.LEDGE + 0.02, 150)]
    gl = Geo("glass_dome", kind="glass")
    prof = [(0.15, 0)] + [(0.15 * math.cos(a), 0.06 + 0.14 * math.sin(a)) for a in [i * math.pi / 2 / 6 for i in range(1, 7)]]
    gl.lathe(9.7, 9.37, S.LEDGE + 0.02, [(0.15, 0), (0.15, 0.06)] + prof[1:], G.pans(16), "glass", cap_bottom=False, cap_top=False)
    w.sphere(9.7, 9.37, S.LEDGE + 0.24, 0.02, 0.02, 0.02, "brass", segs=8, rings=5)
    # table de la vitrine: tasse laissée; table carrée: carte fermée posée (prête à commander)
    S.tasse(w, 4.85, 12.15, 0.75, "espresso", contenu=False)
    w.box(4.28, 4.46, 10.05, 10.29, 0.75, 0.762, "rim", bevel=0.003)
    # croissants (modèle Meshy mis en conformité, sinon forme scriptée)
    food = Geo("food", smooth=True)
    # le croissant de Meshy (droit, trop haut, à facettes sombres) n'a pas tenu à la revue: forme scriptée
    mc = None
    for (x, y, zz, d) in croissants:
        if mc:
            MI.poser(mc, food, x, y, d, z=zz)
        else:
            S.croissant_geo(food, x, y, zz, d)
    # plantes: sur l'appui de la petite fenêtre (soleil) et au bout de la tablette
    p = Geo("plants")
    mp = MI.disponible(args.meshy, "deco_plant_pot", V)
    for (x, y, zz, sc_) in ((10.5, 12.67, 0.9, 1.0), (10.88, 9.37, S.LEDGE, 0.6)):
        if mp:
            MI.poser(mp, p, x, y, 0, z=zz, echelle=sc_)
        else:
            vs0 = set(p.bm.verts)
            S.plante(p, x, y, zz)
            if sc_ != 1.0:
                for v in [v for v in p.bm.verts if v not in vs0]:
                    v.co.x = x + (v.co.x - x) * sc_
                    v.co.y = -y + (v.co.y + y) * sc_
                    v.co.z = zz + (v.co.z - zz) * sc_
    # personnages de Meshy (riggés, posés par les clips du client pressé), sinon les silhouettes scriptées
    import personnages_meshy as PM
    if PM.construire(PAL, V, args.rigs) is None:
        print("personnages: modèles riggés de Meshy absents, silhouettes scriptées")
        PERS.construire(PAL)
    return bulbs


t0 = time.time()
bulbs = construire_scene()
mats = M.Materiaux(V, {})
if V == "B":
    import textures as T
    mats.textures = T.construire(os.path.join(args.travail, f"textures_{V}"), C)
    for nom, (img, _) in mats.textures.items():
        img.pack()

objs = []
for g in Geo.registry:
    ob = G.finish(g, coll, M.uv_scale_for(V))
    objs.append(ob)

# UV de palette (une case par face), puis matériaux
for ob in objs:
    kind = ob["kind"]
    keys = list(ob["keys"])
    me = ob.data
    uvl = me.uv_layers["UVMap"]
    for poly in me.polygons:
        fixed = mats.uv_fixe(keys[poly.material_index], "char" if kind == "char" else kind)
        if fixed is not None:
            for li in poly.loop_indices:
                uvl.data[li].uv = fixed
mats.finaliser_palette()
for ob in objs:
    kind = ob["kind"]
    keys = list(ob["keys"])
    me = ob.data
    uniques = []
    remap = []
    for k in keys:
        m = mats.get(k, "char" if kind == "char" else kind)
        if m not in uniques:
            uniques.append(m)
        remap.append(uniques.index(m))
    for poly in me.polygons:
        poly.material_index = remap[poly.material_index]
    for m in uniques:
        me.materials.append(m)
print(f"construction: {time.time() - t0:.1f} s, {len(objs)} objets")

# ------------------------------------------------------------------------------------------------
# 2. Coordonnées de la carte de lumière (seconde UV) sur tout ce qui est cuit

baked = [o for o in objs if o["kind"] in ("static", "ext")]
for ob in baked:
    ob.data.uv_layers.new(name="lightmap")
    ob.data.uv_layers.active = ob.data.uv_layers["lightmap"]
bpy.ops.object.select_all(action="DESELECT")
for ob in baked:
    ob.select_set(True)
bpy.context.view_layer.objects.active = baked[0]
bpy.ops.object.mode_set(mode="EDIT")
bpy.ops.mesh.select_all(action="SELECT")
bpy.ops.uv.smart_project(angle_limit=math.radians(60), island_margin=0.0, scale_to_bounds=False)
bpy.ops.uv.average_islands_scale()
bpy.ops.object.mode_set(mode="OBJECT")
# la rue, vue de loin par les vitrines, reçoit quatre fois moins de texels par mètre
for ob in baked:
    if ob["kind"] == "ext":
        uv = ob.data.uv_layers["lightmap"]
        for d in uv.data:
            d.uv = d.uv * 0.3
bpy.ops.object.mode_set(mode="EDIT")
bpy.ops.mesh.select_all(action="SELECT")
bpy.ops.uv.select_all(action="SELECT")
bpy.ops.uv.pack_islands(margin=0.0025, rotate=True, scale=True)
bpy.ops.object.mode_set(mode="OBJECT")
for ob in baked:
    ob.data.uv_layers.active = ob.data.uv_layers["UVMap"]
    ob.data.uv_layers["UVMap"].active_render = True

# ------------------------------------------------------------------------------------------------
# 3. Lumière de fin d'après-midi (moment signature de la bible, 2.4) et cuisson

mom = PAL["moments"]["afternoon"]
# soleil au sud-sud-ouest, 16 degrés: il passe entre les maisons de l'ouest et l'église et entre par les vitrines
# jusqu'au pied du comptoir (à 235 degrés, la maison d'en face mettait toute la salle à l'ombre)
SUN_AZ, SUN_EL = 205.0, float(mom["sunElevation"])
world = bpy.data.worlds.new("ciel")
sc.world = world
wn = world.node_tree
bg = wn.nodes["Background"]
bg.inputs["Color"].default_value = M.lin("#D8CFCF")
bg.inputs["Strength"].default_value = 2.4
sun = bpy.data.lights.new("soleil", "SUN")
sun.energy = 5.5
# couleurs de lumière rapprochées du blanc de moitié: dorées, sans noyer la palette dans l'orangé
def demi_blanc(hx):
    return tuple(0.5 + 0.5 * c for c in M.lin(hx)[:3])


sun.color = demi_blanc(mom["sun"])
sun.angle = math.radians(1.2)
so = bpy.data.objects.new("soleil", sun)
coll.objects.link(so)
# direction: la lumière vient du sud-ouest (Blender: x est, y nord)
az, el = math.radians(SUN_AZ), math.radians(SUN_EL)
to_sun = (math.sin(az) * math.cos(el), math.cos(az) * math.cos(el), math.sin(el))
from mathutils import Vector  # noqa: E402
so.rotation_euler = Vector(to_sun).to_track_quat("Z", "Y").to_euler()
for i, (x, y, z) in enumerate(bulbs):
    li = bpy.data.lights.new(f"lampe_{i}", "POINT")
    # suspensions du comptoir plus fortes que celles des tables: la lumière désigne le travail (bible 1)
    li.energy = (70.0 if i < 2 else 35.0) * mom["lamps"]
    li.color = demi_blanc("#FFC27A")
    li.shadow_soft_size = 0.04
    lo = bpy.data.objects.new(f"lampe_{i}", li)
    lo.location = G.P(x, y, z)
    coll.objects.link(lo)

lm_png = os.path.join(args.travail, f"lightmap_{V}.png")
meta = {}
if not args.sans_cuisson:
    sc.render.engine = "CYCLES"
    sc.cycles.device = "CPU"
    sc.cycles.samples = args.spp
    sc.cycles.max_bounces = 6
    sc.cycles.diffuse_bounces = 4
    sc.render.bake.margin = 6
    sc.render.bake.use_clear = True
    img = bpy.data.images.new("lightmap_raw", args.res, args.res, float_buffer=True)
    nodes_tmp = []
    for m in {s.material for o in baked for s in o.material_slots}:
        n = m.node_tree.nodes.new("ShaderNodeTexImage")
        n.image = img
        m.node_tree.nodes.active = n
        nodes_tmp.append((m, n))
    hidden = [o for o in objs if o["kind"] in ("glass", "char")]
    for o in hidden:
        o.hide_render = True
    bpy.ops.object.select_all(action="DESELECT")
    for ob in baked:
        ob.select_set(True)
    bpy.context.view_layer.objects.active = baked[0]
    t = time.time()
    bpy.ops.object.bake(type="DIFFUSE", pass_filter={"DIRECT", "INDIRECT"}, uv_layer="lightmap")
    print(f"cuisson: {time.time() - t:.0f} s")
    for o in hidden:
        o.hide_render = False
    for m, n in nodes_tmp:
        m.node_tree.nodes.remove(n)
    raw_exr = os.path.join(args.travail, f"lightmap_{V}_brut.exr")
    img.filepath_raw = raw_exr
    img.file_format = "OPEN_EXR"
    img.save()
    # débruitage (OpenImageDenoise du compositeur)
    ng = bpy.data.node_groups.new("debruitage", "CompositorNodeTree")
    sc.compositing_node_group = ng
    ni = ng.nodes.new("CompositorNodeImage")
    ni.image = img
    nd = ng.nodes.new("CompositorNodeDenoise")
    go = ng.nodes.new("NodeGroupOutput")
    ng.interface.new_socket("Image", in_out="OUTPUT", socket_type="NodeSocketColor")
    ng.links.new(ni.outputs["Image"], nd.inputs["Image"])
    ng.links.new(nd.outputs["Image"], go.inputs[0])
    eng = sc.render.engine
    sc.render.engine = "BLENDER_WORKBENCH"
    sc.render.resolution_x = sc.render.resolution_y = args.res
    sc.render.resolution_percentage = 100
    sc.render.image_settings.file_format = "OPEN_EXR"
    den_exr = os.path.join(args.travail, f"lightmap_{V}_debruite.exr")
    sc.render.filepath = den_exr
    for o in objs:
        o.hide_render = True
    bpy.ops.render.render(write_still=True)
    for o in objs:
        o.hide_render = False
    sc.render.engine = eng
    sc.compositing_node_group = None
    den = bpy.data.images.load(den_exr)
    a = np.array(den.pixels[:], dtype=np.float32).reshape(args.res, args.res, 4)[..., :3]
    raw = np.array(img.pixels[:], dtype=np.float32).reshape(args.res, args.res, 4)[..., :3]
    # le débruiteur peut mordre sur la marge: on garde le brut là où le débruité est vide
    a = np.where(a.sum(-1, keepdims=True) > 1e-5, a, raw)
    lum = a.mean(-1)
    used = lum[lum > 1e-4]
    K = float(np.percentile(used, 99.7)) if used.size else 1.0
    enc = np.clip(a / K, 0, 1)
    enc = np.where(enc <= 0.0031308, enc * 12.92, 1.055 * np.power(enc, 1 / 2.4) - 0.055)
    from PIL import Image
    Image.fromarray((np.flipud(enc) * 255 + 0.5).astype(np.uint8)).save(lm_png, optimize=True)
    meta = {"lightmap_scale": K, "bake_spp": args.spp, "bake_res": args.res}
    with open(os.path.join(args.travail, f"lightmap_{V}.json"), "w") as fh:
        json.dump(meta, fh)
else:
    with open(os.path.join(args.travail, f"lightmap_{V}.json")) as fh:
        meta = json.load(fh)

# ------------------------------------------------------------------------------------------------
# 4. Branchement de la carte de lumière (occlusion glTF sur la seconde UV), fusion, export

lm_img = bpy.data.images.load(lm_png)
lm_img.colorspace_settings.name = "sRGB"
grp = bpy.data.node_groups.get("glTF Material Output") or bpy.data.node_groups.new("glTF Material Output", "ShaderNodeTree")
if not grp.interface.items_tree:
    grp.interface.new_socket("Occlusion", in_out="INPUT", socket_type="NodeSocketFloat")
for m in {s.material for o in baked for s in o.material_slots}:
    if m.get("kind") in ("emit",):
        continue
    nt = m.node_tree
    uvn = nt.nodes.new("ShaderNodeUVMap")
    uvn.uv_map = "lightmap"
    tex = nt.nodes.new("ShaderNodeTexImage")
    tex.image = lm_img
    nt.links.new(uvn.outputs["UV"], tex.inputs["Vector"])
    sep = nt.nodes.new("ShaderNodeSeparateColor")
    nt.links.new(tex.outputs["Color"], sep.inputs["Color"])
    gn = nt.nodes.new("ShaderNodeGroup")
    gn.node_tree = grp
    nt.links.new(sep.outputs["Red"], gn.inputs["Occlusion"])


def joindre(liste, nom):
    bpy.ops.object.select_all(action="DESELECT")
    for o in liste:
        o.select_set(True)
    bpy.context.view_layer.objects.active = liste[0]
    if len(liste) > 1:
        bpy.ops.object.join()
    ob = bpy.context.view_layer.objects.active
    ob.name = nom
    ob.data.name = nom
    return ob


groupes = {k: [o for o in objs if o["kind"] in ks] for k, ks in (("static", ("static", "ext", "emit")), ("glass", ("glass",)), ("char", ("char",)))}
static = joindre(groupes["static"], "cafe_static")
static["lightmap_scale"] = meta["lightmap_scale"]
static["variante"] = V
glass = joindre(groupes["glass"], "cafe_glass")
chars = groupes["char"]
for o in [static, glass] + chars:
    o.data.uv_layers.active_index = 0

# fiche
def tris(o):
    return sum(len(p.vertices) - 2 for p in o.data.polygons)


fiche = {
    "variante": V,
    "triangles": {"cafe_static": tris(static), "cafe_glass": tris(glass), **{o.name: tris(o) for o in chars}},
    "materiaux": sorted({s.material.name for o in [static, glass] + chars for s in o.material_slots}),
    "cuisson": meta,
    "soleil": {"azimut_deg": SUN_AZ, "hauteur_deg": SUN_EL, "couleur": mom["sun"]},
    "lampes": [list(b) for b in bulbs],
}

bpy.ops.object.select_all(action="DESELECT")
for o in [static, glass] + chars:
    o.select_set(True)
glb = os.path.join(OUT, f"cafe_{V}.glb")
bpy.ops.export_scene.gltf(filepath=glb, export_format="GLB", use_selection=True, export_yup=True, export_apply=True,
                          export_texcoords=True, export_normals=True, export_materials="EXPORT", export_extras=True,
                          export_cameras=False, export_lights=False, export_image_format="AUTO")
fiche["poids_octets"] = os.path.getsize(glb)
with open(os.path.join(OUT, f"cafe_{V}.json"), "w") as fh:
    json.dump(fiche, fh, ensure_ascii=False, indent=1)
print(json.dumps(fiche, ensure_ascii=False))
print(f"total: {time.time() - t0:.0f} s")
