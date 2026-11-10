"""Voie A: met une pièce générée seule (vêtement, chaussures, chapeau, tête coiffée) sur le corps commun.

Étapes: import de la sortie brute, coupe éventuelle (socle, buste de mannequin), mise à l'échelle et en place
d'après les articulations du squelette commun, puis selon le mode de la fiche:
- `enveloppe` (hauts, bas): le corps est mis dans la pose du vêtement (bras baissés de `pose_bras_deg`), chaque
  sommet est tenu entre `ecart_min` et `ecart_max` de la peau, les poids du corps sont transférés (face la plus
  proche, interpolation), lissés, puis la pièce est ramenée à la pose de repos en T par la peau inversée;
- `jupe`: poussée hors du corps seulement, poids en dégradé du bassin vers les deux cuisses;
- `rigide` (chapeau, tête coiffée, chaussures): tous les sommets sur un os.

Usage: duo-python conformer_piece.py <fiche.json> <corps.glb> <brut.glb> <sortie.glb> <rapport.json>
"""
import json
import os
import sys

import bpy
import bmesh  # après bpy: sinon le module est introuvable
from mathutils import Matrix, Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pm_commun import BodyRef, finish_and_export, import_body, neighbours, pose_arms, set_weights, smooth_weights  # noqa: E402

FICHE, BODY, RAW, OUT, REPORT = sys.argv[1:6]
with open(FICHE, encoding="utf-8") as fh:
    fiche = json.load(fh)
c = fiche["conformity"]

bpy.ops.wm.read_factory_settings(use_empty=True)
rig, body = import_body(BODY)
before = set(bpy.data.objects)
bpy.ops.import_scene.gltf(filepath=RAW)
raw = [o for o in set(bpy.data.objects) - before if o.type == "MESH"]
bpy.ops.object.select_all(action="DESELECT")
for o in raw:
    o.select_set(True)
bpy.context.view_layer.objects.active = raw[0]
if len(raw) > 1:
    bpy.ops.object.join()
piece = raw[0]
world = piece.matrix_world.copy()
piece.parent = None
piece.matrix_world = world
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
me = piece.data
raw_triangles = sum(len(p.vertices) - 2 for p in me.polygons)


def bounds(points):
    xs, ys, zs = zip(*points)
    return Vector((min(xs), min(ys), min(zs))), Vector((max(xs), max(ys), max(zs)))


def edit(fn):
    bm = bmesh.new()
    bm.from_mesh(me)
    fn(bm)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    bm.to_mesh(me)
    bm.free()
    me.update()


# coupe: fractions de la hauteur brute à garder (retire socle, buste ou jambes de mannequin)
if "garder_z" in c:
    lo, hi = bounds([v.co for v in me.vertices])
    z0 = lo.z + (hi.z - lo.z) * c["garder_z"][0]
    z1 = lo.z + (hi.z - lo.z) * c["garder_z"][1]

    def cut(bm):
        for z, n in ((z0, Vector((0, 0, -1))), (z1, Vector((0, 0, 1)))):
            geom = bm.verts[:] + bm.edges[:] + bm.faces[:]
            bmesh.ops.bisect_plane(bm, geom=geom, plane_co=Vector((0, 0, z)), plane_no=n, clear_outer=True)
    edit(cut)
if c.get("retirer_petits_ilots"):
    def islands(bm):
        seen, groups = set(), []
        for v in bm.verts:
            if v in seen:
                continue
            stack, grp = [v], []
            seen.add(v)
            while stack:
                a = stack.pop()
                grp.append(a)
                for e in a.link_edges:
                    b = e.other_vert(a)
                    if b not in seen:
                        seen.add(b)
                        stack.append(b)
            groups.append(grp)
        big = max(len(g) for g in groups)
        for g in groups:
            if len(g) < big * c["retirer_petits_ilots"]:
                bmesh.ops.delete(bm, geom=g, context="VERTS")
    edit(islands)

mode = c["mode"]
if mode in ("enveloppe",):
    pose_arms(rig, c.get("pose_bras_deg", 0))
ref = BodyRef(rig, body)
J = ref.joint


def place(points_scale_z, z_low, z_high, centre_xy, scale_x=None):
    """Échelle uniforme pour que la pièce occupe [z_low, z_high], puis centrage."""
    lo, hi = bounds([v.co for v in me.vertices])
    k = (z_high - z_low) / (hi.z - lo.z) * points_scale_z
    cx, cy = (lo.x + hi.x) / 2, (lo.y + hi.y) / 2
    for v in me.vertices:
        v.co = Vector(((v.co.x - cx) * k * (scale_x or 1.0) + centre_xy[0], (v.co.y - cy) * k + centre_xy[1], (v.co.z - hi.z) * k + z_high))
    return k


hips, neck, head = J("Hips"), J("neck"), J("Head")
info = {}
slot = c["categorie"]
if slot == "haut":
    info["echelle"] = place(1.0, hips.z + c.get("bas_dz", -0.06), neck.z + c.get("haut_dz", 0.05), (0.0, hips.y + c.get("dy", 0.0)), c.get("echelle_x"))
elif slot == "bas":
    low = (J("LeftFoot").z + c.get("bas_dz", 0.0)) if c.get("jusqu_a", "cheville") == "cheville" else (J("LeftLeg").z + c.get("bas_dz", 0.0))
    info["echelle"] = place(1.0, low, hips.z + c.get("haut_dz", 0.12), (0.0, hips.y + c.get("dy", 0.0)), c.get("echelle_x"))
    if c.get("aligner_jambes"):
        # chaque jambe du vêtement est recentrée, tranche par tranche, sur l'axe des os de la jambe du corps
        crotch = J("LeftUpLeg").z
        lo, hi = bounds([v.co for v in me.vertices])

        def centre(z0, z1):
            xs = [abs(v.co.x) for v in me.vertices if z0 <= v.co.z <= z1]
            return sum(xs) / max(1, len(xs))
        span = crotch - lo.z
        top_c, low_c = centre(crotch - 0.15 * span, crotch), centre(lo.z, lo.z + 0.15 * span)
        chain = [J("LeftUpLeg"), J("LeftLeg"), J("LeftFoot")]

        def bone_x(z):
            for a, b in zip(chain, chain[1:]):
                if z >= b.z:
                    t = min(max((a.z - z) / (a.z - b.z), 0.0), 1.0)
                    return a.x + (b.x - a.x) * t
            return chain[-1].x
        for v in me.vertices:
            if v.co.z < crotch:
                t = (crotch - v.co.z) / span
                shift = bone_x(v.co.z) - (top_c + (low_c - top_c) * t)
                blend = min(1.0, (crotch - v.co.z) / 0.08)
                v.co.x += (1 if v.co.x >= 0 else -1) * shift * blend
        info["jambes_alignees"] = [round(top_c, 3), round(low_c, 3)]
elif slot in ("chapeau", "tete", "cheveux"):
    head_pts = [ref.verts[i] for t, z in zip(ref.tris, ref.zone_of_tri) if z == "corps_tete" for i in t]
    hlo, hhi = bounds(head_pts)
    if slot == "chapeau":
        lo, hi = bounds([v.co for v in me.vertices])
        k = (hhi.x - hlo.x) * c.get("jeu", 1.04) / ((hi.x - lo.x) * c["largeur_calotte"])
        top = hhi.z + c.get("dz", 0.02)
        info["echelle"] = place(1.0, top - (hi.z - lo.z) * k, top, ((hlo.x + hhi.x) / 2, (hlo.y + hhi.y) / 2 + c.get("dy", 0.0)))
    else:
        info["echelle"] = place(1.0, hlo.z + c.get("bas_dz", 0.0), hhi.z + c.get("haut_dz", 0.02), ((hlo.x + hhi.x) / 2, (hlo.y + hhi.y) / 2 + c.get("dy", 0.0)))
elif slot == "chaussures":
    feet = [ref.verts[i] for t, z in zip(ref.tris, ref.zone_of_tri) if z == "corps_pieds" for i in t]
    lo, hi = bounds([v.co for v in me.vertices])
    cx = (lo.x + hi.x) / 2
    for side, bone in ((1, "LeftFoot"), (-1, "RightFoot")):
        mine = [v for v in me.vertices if (v.co.x - cx) * side > 0]
        flo, fhi = bounds([p for p in feet if p.x * side > 0])
        slo, shi = bounds([v.co for v in mine])
        k = (fhi.y - flo.y) * c.get("jeu", 1.12) / (shi.y - slo.y)
        sc = Vector(((slo.x + shi.x) / 2, (slo.y + shi.y) / 2, slo.z))
        fc = Vector(((flo.x + fhi.x) / 2, (flo.y + fhi.y) / 2 + c.get("dy", 0.0), 0.0))
        kz = max(k, (J(bone).z + c.get("tige_dz", 0.03)) / (shi.z - slo.z))
        for v in mine:
            d = (v.co - sc) * k
            v.co = Vector((d.x, d.y, (v.co.z - sc.z) * kz)) + fc
        info["echelle_" + bone] = k

nb = neighbours(me)
weights = None
if mode == "enveloppe":
    dmin, dmax = c.get("ecart_min", 0.008), c.get("ecart_max", 0.03)
    moved = 0
    inside_before = 0
    for _ in range(c.get("passes", 3)):
        delta = []
        for v in me.vertices:
            co, normal, signed, _w = ref.nearest(v.co)
            if signed < 0:
                inside_before += 1 if _ == 0 else 0
            target = min(max(signed, dmin), dmax)
            delta.append((co + normal * target) - v.co if abs(target - signed) > 1e-5 else Vector((0, 0, 0)))
        for _s in range(2):
            delta = [(d + sum((delta[j] for j in nb[i]), Vector((0, 0, 0)))) / (1 + len(nb[i])) if d.length == 0 else d for i, d in enumerate(delta)]
        for v, d in zip(me.vertices, delta):
            if d.length > 1e-5:
                moved += 1
            v.co += d
    weights, inside_after = [], 0
    for v in me.vertices:
        _co, _n, signed, w = ref.nearest(v.co)
        inside_after += signed < 0
        other = "Right" if v.co.x > 0.02 else "Left" if v.co.x < -0.02 else "aucun"
        weights.append({k: x for k, x in w.items() if k not in c.get("os_exclus", []) and not k.startswith(other)} or w)
    weights = smooth_weights(me, weights, c.get("lissage_poids", 2))
    for v, w in zip(me.vertices, weights):
        v.co = ref.unpose(v.co, w)
    info.update({"sommets_dans_le_corps_avant": inside_before, "sommets_dans_le_corps_apres": inside_after, "sommets_deplaces": moved})
elif mode == "jupe":
    lo, hi = bounds([v.co for v in me.vertices])
    inside = 0
    for v in me.vertices:
        co, normal, signed, _w = ref.nearest(v.co)
        if signed < c.get("ecart_min", 0.01):
            inside += 1
            v.co = co + normal * c.get("ecart_min", 0.01)
    weights = []
    part = c.get("part_cuisses", 0.7)
    for v in me.vertices:
        t = min(max((hi.z - v.co.z) / (hi.z - lo.z), 0.0), 1.0) * part
        side = min(max(0.5 + v.co.x / 0.16, 0.0), 1.0)
        weights.append({"Hips": 1 - t, "LeftUpLeg": t * side, "RightUpLeg": t * (1 - side)})
    info["sommets_pousses"] = inside
elif mode == "rigide":
    if slot == "chaussures":
        weights = [{"LeftFoot" if v.co.x > 0 else "RightFoot": 1.0} for v in me.vertices]
    else:
        weights = [{c.get("os", "Head"): 1.0} for v in me.vertices]

rig.pose.bones["LeftArm"].matrix_basis = Matrix.Identity(4)
rig.pose.bones["RightArm"].matrix_basis = Matrix.Identity(4)
set_weights(piece, rig, weights)
finish_and_export(rig, [piece], fiche, OUT, {"triangles_bruts": raw_triangles, **info}, REPORT)
