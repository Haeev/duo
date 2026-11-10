"""Voie B: découpe un personnage entier, habillé et riggé par Meshy, en pièces du catalogue.

Le donneur a le squelette de Meshy (mêmes 24 os que le squelette commun, longueurs différentes). On pose chaque os
du donneur sur l'os commun de même nom (position, orientation, longueur), on fige le maillage dans cette pose:
il est alors à la pose de repos commune, avec ses propres poids (aucun transfert). Les faces sont ensuite rangées
par zone d'os dominante, et chaque groupe de zones de la fiche devient une pièce.

Usage: duo-python decouper_donneur.py <fiche.json> <corps.glb> <Character_output.glb> <dossier de sortie> <dossier des rapports>
"""
import json
import os
import sys

import bpy
import bmesh  # après bpy
from mathutils import Matrix

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pm_commun import ZONES, finish_and_export, import_body, skinned_meshes  # noqa: E402

FICHE, BODY, DONOR, OUT_DIR, REPORT_DIR = sys.argv[1:6]
with open(FICHE, encoding="utf-8") as fh:
    fiche = json.load(fh)
zone_of_bone = {b: z for z, bones in ZONES.items() for b in bones}

for spec in fiche["conformity"]["pieces"]:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    rig, body = import_body(BODY)
    target = {b.name: (b.matrix_local.copy(), b.length) for b in rig.data.bones}
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=DONOR)
    new = set(bpy.data.objects) - before
    donor_rig = next(o for o in new if o.type == "ARMATURE")
    donor = next(o for o in new if o.type == "MESH" and any(m.type == "ARMATURE" for m in o.modifiers))
    for o in new - {donor_rig, donor}:
        bpy.data.objects.remove(o, do_unlink=True)
    for act in list(bpy.data.actions):
        bpy.data.actions.remove(act)
    donor_rig.animation_data_clear()
    bpy.ops.object.select_all(action="DESELECT")
    donor_rig.select_set(True)
    donor.select_set(True)
    bpy.context.view_layer.objects.active = donor_rig
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    bpy.ops.object.mode_set(mode="EDIT")
    for eb in donor_rig.data.edit_bones:
        eb.inherit_scale = "NONE"
    bpy.ops.object.mode_set(mode="OBJECT")
    # la largeur des membres suit le rapport des tailles, la longueur suit l'os commun
    zs = [v.co.z for v in donor.data.vertices]
    girth = fiche["conformity"].get("largeur", 1.0) * (target["Head"][0].translation.z / donor_rig.data.bones["Head"].head_local.z)
    head_scale = fiche["conformity"].get("tete", 1.0) * girth
    ordered = sorted(donor_rig.pose.bones, key=lambda pb: len(pb.bone.parent_recursive))
    for pb in ordered:
        mat, length = target[pb.name]
        # tête et bouts de tête: échelle uniforme (leurs os très courts donneraient un rapport de longueurs aberrant)
        along = head_scale if pb.name in ("Head", "head_end", "headfront") else length / pb.bone.length
        side = head_scale if pb.name in ("Head", "head_end", "headfront") else girth
        pb.matrix = mat @ Matrix.Diagonal((side, along, side, 1.0))
        bpy.context.view_layer.update()
    bpy.context.view_layer.objects.active = donor
    bpy.ops.object.modifier_apply(modifier=donor.modifiers[0].name)
    bpy.data.objects.remove(donor_rig, do_unlink=True)
    donor.parent = rig
    donor.matrix_parent_inverse = Matrix.Identity(4)
    donor.matrix_world = rig.matrix_world.copy()
    donor.modifiers.new("Armature", "ARMATURE").object = rig

    names = [g.name for g in donor.vertex_groups]
    me = donor.data
    bm = bmesh.new()
    bm.from_mesh(me)
    layer = bm.verts.layers.deform.verify()
    drop = []
    for f in bm.faces:
        acc = {}
        for v in f.verts:
            for g, w in v[layer].items():
                z = zone_of_bone.get(names[g])
                if z:
                    acc[z] = acc.get(z, 0.0) + w
        if (max(acc, key=acc.get) if acc else "") not in spec["zones"]:
            drop.append(f)
    bmesh.ops.delete(bm, geom=drop, context="FACES")
    # le rig de Meshy rend des sommets séparés par face: on les soude pour un lissage continu et un fichier léger
    bmesh.ops.remove_doubles(bm, verts=bm.verts[:], dist=0.0005)
    bm.to_mesh(me)
    bm.free()
    one = {"conformity": {"nom": spec["nom"], "categorie": spec["categorie"], "masque": spec.get("masque", spec["zones"]), "couleur": spec["couleur"]}}
    finish_and_export(rig, [donor], one, os.path.join(OUT_DIR, spec["nom"] + ".glb"), {"voie": "B", "donneur": fiche["asset"]}, os.path.join(REPORT_DIR, spec["nom"] + ".json"))
