"""Coin est du ponton avec le pieu d'amarrage posé comme dans le jeu (accroche `kingfisher_post` de la carte),
sous quatre angles de près: vérifie que l'amarre du ponton arrive bien à l'anneau du pieu.

Lancer: duo-python verifier/ponton_pieu.py <bourg.glb> <faune.glb> <image.png>
(images <image>-0.png à -3.png; azimuts 45, 135, 225, 315, puis une vue de dessus en -4)
"""
import os
import sys

import bpy  # noqa: I001

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import bourg  # noqa: E402
import lpl  # noqa: E402


def _args():
    args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:]
    args = [a for a in args if not a.endswith("ponton_pieu.py")]
    return args[-3:]


def _import(path, name):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    new = set(bpy.data.objects) - before
    root = bpy.data.objects[name]
    keep = {root, *root.children_recursive}
    for o in new - keep:
        bpy.data.objects.remove(o, do_unlink=True)
    return root


def main():
    bourg_glb, faune_glb, image = _args()
    lpl.reset()
    lpl.setup_render((800, 640), 24)
    lpl.world(lpl.hex_lin("#DCE6EE"), 0.9)
    lpl.sun((50, 0, 140), 3.0)
    lpl.ground_plane(60, lpl.hex_lin("#5E8C9A"), z=-0.16)          # eau du jeu (surface à -0,16)
    pontoon = _import(bourg_glb, "pontoon")
    pontoon.location = (0, 0, 0)
    post = _import(faune_glb, "mooring_post")
    # carte (x, y) -> Blender (x, -y); hauteur au-dessus de l'eau
    post.location = (bourg.POST_MAP[0] - bourg.PONTOON_MAP[0], -(bourg.POST_MAP[1] - bourg.PONTOON_MAP[1]),
                     bourg.POST_TOP)
    post.rotation_mode = "XYZ"
    post.scale = (bourg.POST_SCALE,) * 3
    for m in bpy.data.materials:
        if m.node_tree and m.node_tree.nodes.get("Principled BSDF"):
            lpl.set_emission(m, 0.0)
    target = (0.95, -1.42, 0.45)
    for i, (az, el) in enumerate(((45, 30), (135, 30), (225, 30), (315, 30), (20, 80))):
        for o in list(bpy.data.objects):
            if o.type == "CAMERA":
                bpy.data.objects.remove(o, do_unlink=True)
        lpl.iso_camera(target=target, ortho=1.0, azimuth=az, elevation=el)
        lpl.render(f"{image[:-4]}-{i}.png")


main()
