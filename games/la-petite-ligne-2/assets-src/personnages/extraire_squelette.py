"""Une fois: tire du corps de l'essai (rig de Meshy, 24 os) le squelette seul et ses clips de marche et de course.

Usage: duo-python extraire_squelette.py <docs/production/essais-meshy/personnage-modulaire/pieces/corps.glb> <source/squelette-meshy.glb>
"""
import sys

import bpy

SRC, OUT = sys.argv[-2:]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=SRC)
rig = next(o for o in bpy.context.scene.objects if o.type == "ARMATURE")
for o in list(bpy.context.scene.objects):
    if o is not rig:
        bpy.data.objects.remove(o, do_unlink=True)
keep = {}
for act in list(bpy.data.actions):
    base = act.name.split("_squelette")[0].split(".")[0]
    if base in ("walk", "run") and base not in keep:
        keep[base] = act
    else:
        bpy.data.actions.remove(act)
ad = rig.animation_data_create()
ad.action = None
for tr in list(ad.nla_tracks):
    ad.nla_tracks.remove(tr)
for name, act in keep.items():
    act.name = name
    tr = ad.nla_tracks.new()
    tr.name = name
    st = tr.strips.new(name, int(act.frame_range[0]), act)
    st.action_slot = act.slots[0]
bpy.ops.object.select_all(action="SELECT")
bpy.ops.export_scene.gltf(filepath=OUT, export_format="GLB", export_yup=True, export_animations=True, export_animation_mode="NLA_TRACKS", export_skins=True)
print("SQUELETTE", sorted(keep), len(rig.data.bones))
