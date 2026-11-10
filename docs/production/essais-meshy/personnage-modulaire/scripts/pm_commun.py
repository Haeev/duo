"""Fonctions communes de l'essai « personnage modulaire » (Blender 5.2, duo-python)."""
import json

import bpy
from bpy_extras import anim_utils
from mathutils import Matrix, Vector
from mathutils.bvhtree import BVHTree

# Zones du corps que les pièces peuvent masquer (une matière par zone dans corps.glb).
ZONES = {
    "tete": ["Head", "head_end", "headfront"],
    "torse": ["neck", "Spine", "Spine01", "Spine02", "LeftShoulder", "RightShoulder"],
    "bras": ["LeftArm", "RightArm"],
    "avant_bras": ["LeftForeArm", "RightForeArm"],
    "mains": ["LeftHand", "RightHand"],
    "bassin": ["Hips", "LeftUpLeg", "RightUpLeg"],
    "jambes": ["LeftLeg", "RightLeg"],
    "pieds": ["LeftFoot", "RightFoot", "LeftToeBase", "RightToeBase"],
}


def fcurves_of(action):
    return list(anim_utils.action_get_channelbag_for_slot(action, action.slots[0]).fcurves)


def skinned_meshes():
    return [o for o in bpy.context.scene.objects if o.type == "MESH" and any(m.type == "ARMATURE" for m in o.modifiers)]


def triangles(o):
    return sum(len(p.vertices) - 2 for p in o.data.polygons)


def import_body(path):
    """Charge corps.glb: rend le squelette commun et les maillages du corps."""
    bpy.ops.import_scene.gltf(filepath=path)
    rig = next(o for o in bpy.context.scene.objects if o.type == "ARMATURE")
    body = skinned_meshes()
    for o in list(bpy.context.scene.objects):
        if o.type == "MESH" and o not in body:
            bpy.data.objects.remove(o, do_unlink=True)
    rig.animation_data_clear()
    for act in list(bpy.data.actions):
        bpy.data.actions.remove(act)
    return rig, body


def pose_arms(rig, degrees):
    """Baisse les deux bras de `degrees` sous l'horizontale (la pose de repos commune est en T)."""
    import math
    for name in ("LeftArm", "RightArm"):
        pb = rig.pose.bones[name]
        sign = 1.0 if pb.bone.tail_local.x > pb.bone.head_local.x else -1.0
        head = pb.bone.head_local
        rot = Matrix.Translation(head) @ Matrix.Rotation(sign * math.radians(degrees), 4, "Y") @ Matrix.Translation(-head)
        pb.matrix = rot @ pb.bone.matrix_local
    bpy.context.view_layer.update()


class BodyRef:
    """Corps dans la pose courante: points, triangles, poids par sommet, arbre de recherche."""

    def __init__(self, rig, body):
        deps = bpy.context.evaluated_depsgraph_get()
        self.rig = rig
        self.verts, self.tris, self.weights, self.zone_of_tri = [], [], [], []
        inv = rig.matrix_world.inverted()
        for o in body:
            ev = o.evaluated_get(deps)
            me = ev.to_mesh()
            base = len(self.verts)
            names = [g.name for g in o.vertex_groups]
            for v, v0 in zip(me.vertices, o.data.vertices):
                self.verts.append(inv @ (o.matrix_world @ v.co))
                self.weights.append({names[g.group]: g.weight for g in v0.groups if g.weight > 1e-4})
            me.calc_loop_triangles()
            mats = [m.name if m else "" for m in o.data.materials]
            for t in me.loop_triangles:
                self.tris.append(tuple(base + i for i in t.vertices))
                self.zone_of_tri.append(mats[t.material_index] if mats else "")
            ev.to_mesh_clear()
        self.bvh = BVHTree.FromPolygons(self.verts, self.tris)
        self.skin = {pb.name: pb.matrix @ pb.bone.matrix_local.inverted() for pb in rig.pose.bones}

    def joint(self, name):
        return self.rig.pose.bones[name].head.copy()

    def nearest(self, p):
        """Point le plus proche, normale, distance signée (négative à l'intérieur), poids interpolés."""
        co, normal, index, dist = self.bvh.find_nearest(p)
        signed = dist if (p - co).dot(normal) >= 0 else -dist
        a, b, c = (self.verts[i] for i in self.tris[index])
        from mathutils.geometry import barycentric_transform  # noqa: F401
        v0, v1, v2 = b - a, c - a, co - a
        d00, d01, d11, d20, d21 = v0.dot(v0), v0.dot(v1), v1.dot(v1), v2.dot(v0), v2.dot(v1)
        den = d00 * d11 - d01 * d01 or 1e-12
        wb = (d11 * d20 - d01 * d21) / den
        wc = (d00 * d21 - d01 * d20) / den
        w = {}
        for k, i in zip((1 - wb - wc, wb, wc), self.tris[index]):
            for name, x in self.weights[i].items():
                w[name] = w.get(name, 0.0) + max(k, 0.0) * x
        return co, normal, signed, w

    def unpose(self, p, w):
        """Ramène un point de la pose courante à la pose de repos (peau inversée)."""
        m = Matrix(((0,) * 4,) * 4)
        total = sum(w.values()) or 1.0
        for name, x in w.items():
            m = m + self.skin[name] * (x / total)
        return m.inverted() @ p


def keep_top(w, n=4):
    top = sorted(w.items(), key=lambda kv: -kv[1])[:n]
    s = sum(x for _, x in top) or 1.0
    return {k: x / s for k, x in top}


def neighbours(me):
    nb = [set() for _ in me.vertices]
    for e in me.edges:
        a, b = e.vertices
        nb[a].add(b)
        nb[b].add(a)
    return nb


def smooth_weights(me, weights, rounds):
    nb = neighbours(me)
    for _ in range(rounds):
        out = []
        for i, w in enumerate(weights):
            acc = dict(w)
            for j in nb[i]:
                for k, x in weights[j].items():
                    acc[k] = acc.get(k, 0.0) + x
            n = 1 + len(nb[i])
            out.append({k: x / n for k, x in acc.items()})
        weights = out
    return weights


def set_weights(o, rig, weights):
    o.vertex_groups.clear()
    groups = {}
    for i, w in enumerate(weights):
        for name, x in keep_top(w).items():
            if name not in groups:
                groups[name] = o.vertex_groups.new(name=name)
            groups[name].add([i], x, "REPLACE")
    for m in list(o.modifiers):
        o.modifiers.remove(m)
    o.parent = rig
    o.matrix_parent_inverse = Matrix.Identity(4)
    o.matrix_world = rig.matrix_world.copy()
    o.modifiers.new("Armature", "ARMATURE").object = rig


def finish_and_export(rig, pieces, fiche, out, extra_report=None, report_path=None):
    """Lissage, matière à la couleur de la pièce, zones masquées en extras, export GLB à peau."""
    import os
    c = fiche["conformity"]
    col = c.get("couleur", [0.7, 0.7, 0.7])
    mat = bpy.data.materials.new("pm_" + c["nom"])
    mat.diffuse_color = (*col, 1)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (*col, 1)
    bsdf.inputs["Roughness"].default_value = 0.85
    keep = set(pieces) | {rig}
    for o in list(bpy.context.scene.objects):
        if o not in keep:
            bpy.data.objects.remove(o, do_unlink=True)
    bpy.ops.object.select_all(action="DESELECT")
    for o in pieces:
        o.select_set(True)
    bpy.context.view_layer.objects.active = pieces[0]
    if len(pieces) > 1:
        bpy.ops.object.join()
    o = pieces[0]
    o.name = c["nom"]
    o.data.name = c["nom"]
    o.data.materials.clear()
    o.data.materials.append(mat)
    for p in o.data.polygons:
        p.use_smooth = True
    o["categorie"] = c["categorie"]
    o["masque"] = c.get("masque", [])
    o["exclut"] = c.get("exclut", [])
    rig.data.pose_position = "REST"
    rig.select_set(True)
    bpy.ops.export_scene.gltf(filepath=out, export_format="GLB", use_selection=True, export_yup=True, export_skins=True,
                              export_animations=False, export_extras=True, export_vertex_color="NONE", export_materials="EXPORT")
    report = {"piece": c["nom"], "categorie": c["categorie"], "triangles": triangles(o), "sommets": len(o.data.vertices),
              "octets": os.path.getsize(out), "masque": c.get("masque", []), **(extra_report or {})}
    if report_path:
        with open(report_path, "w", encoding="utf-8") as fh:
            json.dump(report, fh, ensure_ascii=False, indent=1)
            fh.write("\n")
    print("RAPPORT", json.dumps(report, ensure_ascii=False))
    return report
