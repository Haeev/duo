"""Souche et plants de la lisière (tour 8): contrôle de contact et planche.

- Jeune sapin posé à côté de la souche (extra beside_stump de fir_sapling), aux échelles 0,7, 1 et 1,3:
  aucun triangle du plant ne doit toucher la souche (arbres BVH, test de recouvrement).
- Rejets du chêne: chaque brin (oak_sapling_shoot_*) mis à l'échelle autour de son pied (0,4, 0,7, 1),
  comme le demande le rendu proposé, et, pour comparer, le nœud oak_sapling_shoots d'un bloc depuis le
  centre de la coupe (rendu actuel du jeu): distance du pied de chaque brin à l'axe de la souche.

Lancer: duo-python verifier/souche_et_plants.py <image.png>
"""
import os
import sys

import bpy  # noqa: I001
from mathutils import Matrix, Vector
from mathutils.bvhtree import BVHTree

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import lpl  # noqa: E402

IMAGE = sys.argv[-1]
# la planche aligne les six montages perpendiculairement à la vue (caméra à l'azimut 35)
ROW = Vector((0.819, 0.574, 0.0))


def world_tris(ob, M):
    """Triangles du maillage d'un objet, transformés par M (repère Blender)."""
    me = ob.data
    me.calc_loop_triangles()
    verts = [M @ v.co for v in me.vertices]
    return verts, [tuple(t.vertices) for t in me.loop_triangles]


def bvh(ob, M):
    verts, tris = world_tris(ob, M)
    return BVHTree.FromPolygons(verts, tris)


def dup(ob, M, name):
    c = ob.copy()
    c.data = ob.data
    c.parent = None
    c.matrix_world = M
    c.name = name
    c.hide_render = False
    bpy.context.scene.collection.objects.link(c)
    return c


def main():
    lpl.reset()
    lpl.setup_render((2000, 700), 20)
    lpl.world(lpl.hex_lin("#DCE6EE"), 0.9)
    lpl.sun((50, 0, 140), 3.0)
    lpl.ground_plane(200, lpl.hex_lin("#A7B98A"), z=-0.002)
    bpy.ops.import_scene.gltf(filepath=os.path.join(lpl.OUT, "bourg.glb"))
    obs = bpy.data.objects
    stump, fir = obs["tree_stump"], obs["fir_sapling"]
    shoots_root = obs["oak_sapling_shoots"]
    shoots = sorted((o for o in shoots_root.children), key=lambda o: o.name)
    off = fir.get("beside_stump", [0.0, 0.0, 0.6])
    # repère glTF (x, hauteur, z vers le sud) vers Blender (x, -z, hauteur)
    off_b = Vector((off[0], -off[2], off[1]))
    lift = shoots_root.matrix_world.translation.z
    report = []
    keep = []
    t_stump = bvh(stump, Matrix.Identity(4))
    # sapins: trois échelles, côte à côte (x = -3, -1,5, 0), chacun avec sa souche
    for k, s in enumerate((0.7, 1.0, 1.3)):
        base = ROW * (-3.75 + 1.5 * k)
        Mf = Matrix.Translation(off_b) @ Matrix.Scale(s, 4)
        hits = t_stump.overlap(bvh(fir, Mf))
        report.append(f"sapin x{s}: {len(hits)} paires de triangles en contact avec la souche")
        keep.append(dup(stump, Matrix.Translation(base), f"chk_stump_f{k}"))
        keep.append(dup(fir, Matrix.Translation(base) @ Mf, f"chk_fir_{k}"))
    # rejets: brin par brin autour de son pied (rendu proposé), trois échelles
    for k, s in enumerate((0.4, 0.7, 1.0)):
        base = ROW * (0.75 + 1.5 * k)
        keep.append(dup(stump, Matrix.Translation(base), f"chk_stump_o{k}"))
        worst = 0
        for sh in shoots:
            foot = Vector(sh.location)
            Ms = Matrix.Translation(Vector((0, 0, lift)) + foot) @ Matrix.Scale(s, 4)
            hits = t_stump.overlap(bvh(sh, Ms))
            worst = max(worst, len(hits))
            keep.append(dup(sh, Matrix.Translation(base) @ Ms, f"chk_{sh.name}_{k}"))
        r_foot = min(Vector(sh.location).xy.length for sh in shoots)
        report.append(f"rejets x{s} autour du pied: pied à {r_foot:.3f} m de l'axe (flanc), "
                      f"au plus {worst} paires de triangles brin/souche (pied engagé dans l'écorce)")
    for s in (0.4, 0.7, 1.0):
        r_foot = min(Vector(sh.location).xy.length for sh in shoots) * s
        report.append(f"rejets x{s} d'un bloc (rendu actuel): pied à {r_foot:.3f} m de l'axe, coupe de 0,19 m")
    for o in list(obs):
        if o.type == "MESH" and o not in keep and o.name != "sol_rendu":
            o.hide_render = True
    for m in bpy.data.materials:
        if m.node_tree and m.node_tree.nodes.get("Principled BSDF"):
            lpl.set_emission(m, 0.0)
    lpl.iso_camera(target=(0.0, -0.3, 0.7), ortho=9.6, azimuth=35, elevation=22)
    bpy.context.scene.render.filepath = IMAGE
    bpy.ops.render.render(write_still=True)
    print("\n".join(report))


main()
