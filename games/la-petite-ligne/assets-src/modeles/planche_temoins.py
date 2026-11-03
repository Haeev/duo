"""Planches des personnages témoins de la qualité visuelle (étape A): avant et après, de face, de trois quarts et de
dos; gros plans des visages et expressions. Caméra du jeu (élévation 35,264 degrés), Cycles sur CPU.

Lancer: duo-python planche_temoins.py <dossier de sortie> <apres.glb> [avant.glb] [vues|visages|clips] [échantillons]
Chaque personnage est posé dans son gabarit (`gabarits.apply_to_rig`, comme le jeu avec l'extra `bone_rest`) et dans
sa pose de repos (`idle_<nom>`, image 1); les maillages évalués sont recopiés (`new_from_object`), puis rendus.
Images: <dossier>/<avant|apres>_<témoin>_<vue>.png, visage_<témoin>_<expression>.png.
"""
import math
import os
import sys

import bpy  # noqa: I001

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import gabarits as G  # noqa: E402
import lpl  # noqa: E402

ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:]
SORTIE, APRES = ARGS[0], ARGS[1]
AVANT = ARGS[2] if len(ARGS) > 2 and ARGS[2].endswith(".glb") else None
MODE = next((a for a in ARGS[2:] if a in ("vues", "visages", "clips")), "vues")
SAMPLES = int(next((a for a in ARGS[2:] if a.isdigit()), "10"))

WITNESSES = {
    "colette": (["villager_colette"], "rond", "idle_colette"),
    "firmin": (["villager_firmin"], "trapu", "idle_firmin"),
    "joueur": (["player_base", "wear_top_chemise", "wear_bottom_pantalon", "wear_shoes_bottines", "player_hair_short",
                "player_badge_orb"], "moyen", "idle_player"),
}


# tenue d'aperçu du joueur (preset « bleu de travail »), écrite dans la rangée 1 comme le fait le jeu
OUTFIT = {0: "#5C7FA6", 1: "#EDE6D3", 2: "#EDE6D3", 3: "#4A5D78", 4: "#3A4A60", 5: "#3A4A60", 6: "#5A4636", 7: "#3A2E24"}


def paint_outfit():
    for img in bpy.data.images:
        if not img.name.startswith("personnages") or img.size[0] != 64:
            continue
        w, h = img.size
        px = list(img.pixels)
        for col, hx in OUTFIT.items():
            c = [int(hx[i:i + 2], 16) / 255 for i in (1, 3, 5)]
            for y in range(4, 8):
                for x in range(col * 4, col * 4 + 4):
                    k = ((h - 1 - y) * w + x) * 4
                    px[k:k + 3] = c
        img.pixels = px


def load(path, prefix):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    new = [o for o in bpy.data.objects if o not in before]
    rig = next(o for o in new if o.type == "ARMATURE")
    rig.rotation_mode = "XYZ"
    for o in new:
        o.name = prefix + o.name
        o.hide_render = True
    acts = {}
    for a in bpy.data.actions:
        if not a.get("lpl_prefix"):
            a["lpl_prefix"] = prefix
        if a["lpl_prefix"] == prefix:
            k = a.name
            if len(k) > 4 and k[-4] == "." and k[-3:].isdigit():
                k = k[:-4]
            acts[k.split("_rig")[0] if k.endswith("_rig") else k] = a
    return rig, new, acts


def find_action(acts, clip):
    if clip in acts:
        return acts[clip]
    for k, a in acts.items():
        if k.startswith(clip):
            return a
    return None


def snapshot(rig, objs, parts, gab, acts, clip, frame, expr=None, loc=(0, 0, 0), rz=0.0):
    """Copie statique des pièces dans la pose demandée."""
    G.clear_rig(rig)
    if gab:
        G.apply_to_rig(rig, gab)
    act = find_action(acts, clip) or find_action(acts, "idle")
    if os.environ.get("LPL_DEBUG"):
        print("ACTION", clip, act.name if act else None, sorted(acts)[:60])
    if rig.animation_data is None:
        rig.animation_data_create()
    rig.animation_data.action = act
    rig.animation_data.action_slot = act.slots[0]
    bpy.context.scene.frame_set(frame)
    out = []
    dg = bpy.context.evaluated_depsgraph_get()
    for o in objs:
        base = o.name.split(".", 1)[1] if "." in o.name else o.name
        if base not in parts or o.type != "MESH":
            continue
        if o.data.shape_keys:
            for kb in o.data.shape_keys.key_blocks:
                kb.value = 1.0 if kb.name == expr else 0.0
            dg.update()
        ev = o.evaluated_get(dg)
        me = bpy.data.meshes.new_from_object(ev, preserve_all_data_layers=True, depsgraph=dg)
        c = bpy.data.objects.new("snap_" + base, me)
        bpy.context.scene.collection.objects.link(c)
        c.matrix_world = o.matrix_world.copy()
        out.append(c)
    # placement
    import mathutils
    M = mathutils.Matrix.Translation(loc) @ mathutils.Matrix.Rotation(math.radians(rz), 4, "Z")
    for c in out:
        c.matrix_world = M @ c.matrix_world
    return out


def clear(snaps):
    for c in snaps:
        me = c.data
        bpy.data.objects.remove(c, do_unlink=True)
        bpy.data.meshes.remove(me)


def shot(name, target, ortho, res, azimuth=45.0, elevation=35.264):
    for o in list(bpy.data.objects):
        if o.type == "CAMERA":
            bpy.data.objects.remove(o, do_unlink=True)
    lpl.iso_camera(target=target, ortho=ortho, azimuth=azimuth, elevation=elevation)
    sc = bpy.context.scene
    sc.render.resolution_x, sc.render.resolution_y = res
    sc.render.filepath = os.path.join(SORTIE, name + ".png")
    bpy.ops.render.render(write_still=True)


def mannequin(loc):
    m = bpy.data.materials.new("mannequin")
    m.node_tree.nodes.get("Principled BSDF").inputs["Base Color"].default_value = (0.35, 0.33, 0.32, 1)
    bpy.ops.mesh.primitive_cube_add(size=1, location=(loc[0], loc[1], 0.9))
    ob = bpy.context.active_object
    ob.scale = (0.3, 0.05, 1.8)
    ob.data.materials.append(m)
    return ob


def main():
    os.makedirs(SORTIE, exist_ok=True)
    lpl.reset()
    lpl.setup_render((400, 560), SAMPLES)
    lpl.world(lpl.hex_lin("#DCE6EE"), 0.9)
    lpl.sun((50, 0, 140), 3.0)
    lpl.ground_plane(400, lpl.hex_lin("#A7B98A"), z=-0.002)
    sets = [("apres", load(APRES, "B."))]
    if AVANT:
        sets.append(("avant", load(AVANT, "A.")))
    paint_outfit()
    for m in bpy.data.materials:
        if m.node_tree and m.node_tree.nodes.get("Principled BSDF"):
            lpl.set_emission(m, 0.0)
    man = mannequin((0.55, 0.55))
    man.rotation_euler = (0, 0, math.radians(45))
    for tag, (rig, objs, acts) in sets:
        for who, (parts, gab, idle) in WITNESSES.items():
            g = gab if tag == "apres" else None
            clip = idle if tag == "apres" else "idle"
            if MODE == "vues":
                man.hide_render = False
                for vue, rz in (("face", 0), ("troisquarts", -40), ("dos", 180)):
                    # caméra à l'azimut 45: le personnage tourné de 45 degrés regarde la caméra
                    snaps = snapshot(rig, objs, parts, g, acts, clip, 1, loc=(0, 0, 0), rz=45 + rz)
                    shot(f"{tag}_{who}_{vue}", (0.25, 0.25, 0.92), 2.35, (380, 520))
                    clear(snaps)
                man.hide_render = True
            elif MODE == "visages":
                man.hide_render = True
                exprs = ("neutral", "happy", "delighted", "tired", "hungry", "blink") if tag == "apres" else ("neutral",)
                for e in exprs:
                    snaps = snapshot(rig, objs, parts, g, acts, "idle", 1, expr=e, rz=45)
                    hz = {"colette": 1.51, "firmin": 1.49, "joueur": 1.545}[who]
                    shot(f"{tag}_visage_{who}_{e}", (0, 0, hz), 0.5, (300, 300), elevation=12)
                    clear(snaps)
                snaps = snapshot(rig, objs, parts, g, acts, clip, 1, rz=45 - 35)
                hz = {"colette": 1.4, "firmin": 1.38, "joueur": 1.42}[who]
                shot(f"{tag}_buste_{who}", (0, 0, hz), 0.9, (360, 360))
                clear(snaps)


if __name__ == "__main__":
    main()
