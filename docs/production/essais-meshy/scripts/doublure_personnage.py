"""Doublures des fichiers d'un personnage riggé par Meshy, pour éprouver la fusion des clips.

Meshy rend un personnage riggé en plusieurs GLB: le personnage (Character_output.glb), la marche et
la course offertes (Animation_Walking_withSkin.glb, ...), puis un fichier par appel d'animation
(jusqu'à 10 clips). Ces fichiers sont servis par assets.meshy.ai, refusé par le proxy le
2026-11-07: on les imite à partir des personnages de La Petite Ligne (même squelette pour tous),
pour éprouver conformite_personnage.py et comparer_squelettes.py. Ce ne sont pas des sorties de
Meshy: noms des os, échelle et structure réelles restent à vérifier.

Usage: duo-python doublure_personnage.py <personnages.glb> <dossier de sortie>
"""

import os
import sys

import bpy
from bpy_extras import anim_utils
from mathutils import Vector

SOURCE, OUT_DIR = sys.argv[1], sys.argv[2]
os.makedirs(OUT_DIR, exist_ok=True)


def add_root_motion(rig, act, distance):
    """Marche qui avance (comme un clip non « sur place »): rampe sur la translation des hanches."""
    bone = rig.data.bones["hips"]
    rest = bone.parent.matrix_local.to_3x3() @ (bone.parent.matrix_local.inverted() @ bone.matrix_local).to_3x3()
    local = rest.inverted() @ Vector((0.0, -distance, 0.0))
    bag = anim_utils.action_ensure_channelbag_for_slot(act, act.slots[0])
    f0, f1 = act.frame_range
    for axis in range(3):
        path = 'pose.bones["hips"].location'
        fc = bag.fcurves.find(path, index=axis) or bag.fcurves.new(path, index=axis)
        if not fc.keyframe_points:
            fc.keyframe_points.insert(f0, 0.0)
            fc.keyframe_points.insert(f1, 0.0)
        for kp in fc.keyframe_points:
            t = (kp.co.x - f0) / (f1 - f0)
            for pt in (kp.co, kp.handle_left, kp.handle_right):
                pt.y += local[axis] * t
        fc.update()


def export(character, actions, filename, root_motion=0.0):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=SOURCE)
    rig = next(o for o in bpy.context.scene.objects if o.type == "ARMATURE")
    for o in list(bpy.context.scene.objects):
        if o.type == "MESH" and o.name != character:
            bpy.data.objects.remove(o, do_unlink=True)
    rig.animation_data_clear()
    for act in list(bpy.data.actions):
        if act.name not in actions:
            bpy.data.actions.remove(act)
    if root_motion:
        add_root_motion(rig, bpy.data.actions[actions[0]], root_motion)
    if actions:
        ad = rig.animation_data_create()
        for name in actions:
            act = bpy.data.actions[name]
            track = ad.nla_tracks.new()
            track.name = name
            strip = track.strips.new(name, int(act.frame_range[0]), act)
            strip.action_slot = act.slots[0]
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.export_scene.gltf(
        filepath=os.path.join(OUT_DIR, filename),
        export_format="GLB",
        export_yup=True,
        export_animations=bool(actions),
        export_animation_mode="NLA_TRACKS",
        export_skins=True,
    )


export("villager_odette", [], "Character_output.glb")
export("villager_odette", ["walk"], "Animation_Walking_withSkin.glb", root_motion=0.7)
export("villager_odette", ["idle", "sit", "drink"], "Animation_Actions_withSkin.glb")
export("villager_leon", [], "Character_output_b.glb")
print("doublures écrites dans", OUT_DIR)
