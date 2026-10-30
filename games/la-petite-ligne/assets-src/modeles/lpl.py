"""Bibliothèque commune des modèles de La Petite Ligne (Blender 5.2, sans interface).

Tout modèle se construit par primitives dans un seul bmesh, chaque face
pointant (UV) au centre d'une case de la texture palette: un seul matériau,
pas de dépliage à faire, et des couleurs changées en retouchant la palette.

Conventions (côté Blender, Z en haut): le modèle regarde vers -Y, ce qui
devient +Z à l'export glTF (Y en haut). Origine au centre de l'emprise, au sol.
"""
import json
import math
import os
import sys

import bpy  # noqa: I001 (bpy doit précéder bmesh)
import bmesh
from mathutils import Euler, Matrix, Vector

HERE = os.path.dirname(os.path.abspath(__file__))
if HERE not in sys.path:
    sys.path.insert(0, HERE)
import palette as P  # noqa: E402

GAME = os.path.normpath(os.path.join(HERE, "..", ".."))
OUT = os.path.join(GAME, "assets", "modeles")
TEX_OUT = os.path.join(OUT, "textures")
TEX_SRC = os.path.join(HERE, "textures")
BOARDS = os.path.join(HERE, "planches")
STATS = os.path.join(HERE, "stats")


# Palettes ---------------------------------------------------------------

def _write_png(path, rows_of_cells, grid_w, grid_h):
    from PIL import Image
    img = Image.new("RGB", (grid_w * P.CELL, grid_h * P.CELL), (0, 0, 0))
    px = img.load()
    for (cx, cy), rgb in rows_of_cells.items():
        for dx in range(P.CELL):
            for dy in range(P.CELL):
                px[cx * P.CELL + dx, cy * P.CELL + dy] = rgb
    os.makedirs(os.path.dirname(path), exist_ok=True)
    img.save(path, optimize=True)


def build_world_textures():
    """Écrit palette.png, palette-mr.png, palette-emission.png et les variantes de saison."""
    idx = P.world_index()
    base, mr, em = {}, {}, {}
    for name, hx, rough, metal, glow in P.WORLD:
        i = idx[name]
        cell = (i % P.GRID, i // P.GRID)
        base[cell] = P.hex_to_rgb(hx)
        mr[cell] = (255, int(round(rough * 255)), int(round(metal * 255)))
        em[cell] = P.hex_to_rgb(glow) if glow else (0, 0, 0)
    paths = {}
    for d in (TEX_SRC, TEX_OUT):
        _write_png(os.path.join(d, "palette.png"), base, P.GRID, P.GRID)
        _write_png(os.path.join(d, "palette-mr.png"), mr, P.GRID, P.GRID)
        _write_png(os.path.join(d, "palette-emission.png"), em, P.GRID, P.GRID)
        for season, over in P.SEASONS.items():
            b2 = dict(base)
            for n, hx in over.items():
                i = idx[n]
                b2[(i % P.GRID, i // P.GRID)] = P.hex_to_rgb(hx)
            _write_png(os.path.join(d, f"palette-{season}.png"), b2, P.GRID, P.GRID)
    for k in ("palette", "palette-mr", "palette-emission"):
        paths[k] = os.path.join(TEX_SRC, k + ".png")
    return paths


def build_char_texture():
    cells = {}
    for r, row in enumerate(P.CHAR_ROW_ORDER):
        for c, slot in enumerate(P.CHAR_SLOTS):
            cells[(c, r)] = P.hex_to_rgb(P.CHAR_ROWS[row][slot])
    for d in (TEX_SRC, TEX_OUT):
        _write_png(os.path.join(d, "personnages.png"), cells, P.GRID, P.GRID)
    return os.path.join(TEX_SRC, "personnages.png")


def world_cells():
    idx = P.world_index()
    out = {}
    for n, i in idx.items():
        c, r = i % P.GRID, i // P.GRID
        out[n] = ((c + 0.5) / P.GRID, 1.0 - (r + 0.5) / P.GRID)
    return out


def char_cells(row_name):
    r = P.CHAR_ROW_ORDER.index(row_name)
    return {s: ((c + 0.5) / P.GRID, 1.0 - (r + 0.5) / P.GRID) for c, s in enumerate(P.CHAR_SLOTS)}


# Scène et matériau --------------------------------------------------------

def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.unit_settings.system = "METRIC"
    sc.render.fps = 30
    return sc


def _img(path, non_color=False):
    img = bpy.data.images.load(path, check_existing=True)
    if non_color:
        img.colorspace_settings.name = "Non-Color"
    return img


def palette_material(name, base_path, mr_path=None, emit_path=None, emit_strength=1.0):
    mat = bpy.data.materials.new(name)
    nt = mat.node_tree
    bsdf = nt.nodes.get("Principled BSDF")
    t = nt.nodes.new("ShaderNodeTexImage")
    t.image = _img(base_path)
    t.interpolation = "Closest"
    nt.links.new(t.outputs["Color"], bsdf.inputs["Base Color"])
    if mr_path:
        m = nt.nodes.new("ShaderNodeTexImage")
        m.image = _img(mr_path, non_color=True)
        m.interpolation = "Closest"
        sep = nt.nodes.new("ShaderNodeSeparateColor")
        nt.links.new(m.outputs["Color"], sep.inputs["Color"])
        nt.links.new(sep.outputs["Green"], bsdf.inputs["Roughness"])
        nt.links.new(sep.outputs["Blue"], bsdf.inputs["Metallic"])
    else:
        bsdf.inputs["Roughness"].default_value = 0.85
    if emit_path:
        e = nt.nodes.new("ShaderNodeTexImage")
        e.image = _img(emit_path)
        e.interpolation = "Closest"
        nt.links.new(e.outputs["Color"], bsdf.inputs["Emission Color"])
        bsdf.inputs["Emission Strength"].default_value = emit_strength
    mat.use_backface_culling = True
    return mat


def set_emission(mat, strength):
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Emission Strength"].default_value = strength


# Construction ---------------------------------------------------------------

def _rot(rot):
    return Euler(tuple(math.radians(a) for a in rot), "XYZ").to_matrix().to_4x4()


def by_normal(top, side, bottom=None, thr=0.6):
    """Couleur selon l'orientation de la face (dessus, côtés, dessous)."""
    def f(face):
        n = face.normal
        if n.z > thr:
            return top
        if n.z < -thr:
            return bottom or side
        return side
    return f


def by_height(levels):
    """levels: [(z_max, couleur), ...] trié; couleur de la face selon la hauteur de son centre."""
    def f(face):
        z = face.calc_center_median().z
        for zmax, c in levels:
            if z <= zmax:
                return c
        return levels[-1][1]
    return f


class Geo:
    """Accumule des pièces dans un bmesh unique; UV sur la palette, poids d'os facultatifs."""

    def __init__(self, cells):
        self.bm = bmesh.new()
        self.uv = self.bm.loops.layers.uv.new("UVMap")
        self.dl = self.bm.verts.layers.deform.verify()
        self.cells = cells
        self.bones = []
        self.smooth_default = False

    # interne
    def bone_index(self, b):
        if b not in self.bones:
            self.bones.append(b)
        return self.bones.index(b)

    def _finish(self, verts, color, bone=None, weights=None, smooth=None, M=None):
        verts = [v for v in verts if v.is_valid]
        if M is not None:
            bmesh.ops.transform(self.bm, matrix=M, verts=verts)
        faces = set()
        for v in verts:
            faces.update(v.link_faces)
        self.bm.normal_update()
        sm = self.smooth_default if smooth is None else smooth
        for f in faces:
            c = color(f) if callable(color) else color
            uv = self.cells[c]
            for lp in f.loops:
                lp[self.uv].uv = uv
            f.smooth = sm
        if bone:
            bi = self.bone_index(bone)
            for v in verts:
                v[self.dl].clear()
                v[self.dl][bi] = 1.0
        elif weights:
            for v in verts:
                v[self.dl].clear()
                for b, w in weights(v.co).items():
                    if w > 0:
                        v[self.dl][self.bone_index(b)] = w
        return verts

    def _bevel(self, verts, bevel, bseg):
        faces0 = list({f for v in verts for f in v.link_faces})
        edges = list({e for v in verts for e in v.link_edges})
        r = bmesh.ops.bevel(self.bm, geom=edges, offset=bevel, segments=bseg, profile=0.5,
                            affect="EDGES", clamp_overlap=True)
        faces = [f for f in faces0 if f.is_valid] + list(r["faces"])
        return list({v for f in faces for v in f.verts})

    # primitives
    def box(self, size, loc=(0, 0, 0), color="stone", rot=(0, 0, 0), bevel=0.0, bseg=1,
            taper=None, shear=None, bone=None, weights=None, smooth=None, base=False):
        sx, sy, sz = size
        verts = bmesh.ops.create_cube(self.bm, size=1.0)["verts"]
        for v in verts:
            x, y, z = v.co.x * sx, v.co.y * sy, v.co.z * sz
            if taper and v.co.z > 0:
                x *= taper[0]
                y *= taper[1]
            if shear and v.co.z > 0:
                x += shear[0]
                y += shear[1]
            if base:
                z += sz / 2
            v.co = Vector((x, y, z))
        if bevel > 0:
            verts = self._bevel(verts, bevel, bseg)
        M = Matrix.Translation(Vector(loc)) @ _rot(rot)
        return self._finish(verts, color, bone, weights, smooth, M)

    def cyl(self, r, h, loc=(0, 0, 0), color="wood", segs=8, r2=None, rot=(0, 0, 0), cap=True,
            base=False, bone=None, weights=None, smooth=None, scale=(1, 1, 1), bevel=0.0):
        verts = bmesh.ops.create_cone(self.bm, cap_ends=cap, cap_tris=False, segments=segs,
                                      radius1=r, radius2=r if r2 is None else r2, depth=h)["verts"]
        for v in verts:
            v.co = Vector((v.co.x * scale[0], v.co.y * scale[1], v.co.z * scale[2] + (h * scale[2] / 2 if base else 0)))
        if bevel > 0:
            verts = self._bevel(verts, bevel, 1)
        M = Matrix.Translation(Vector(loc)) @ _rot(rot)
        return self._finish(verts, color, bone, weights, smooth, M)

    def sphere(self, r, loc=(0, 0, 0), color="leaf_oak", segs=8, rings=5, scale=(1, 1, 1), rot=(0, 0, 0),
               bone=None, weights=None, smooth=None, ico=0, jitter=0.0, seed=0):
        if ico:
            verts = bmesh.ops.create_icosphere(self.bm, subdivisions=ico, radius=r)["verts"]
        else:
            verts = bmesh.ops.create_uvsphere(self.bm, u_segments=segs, v_segments=rings, radius=r)["verts"]
        import random
        rnd = random.Random(seed)
        for v in verts:
            j = 1.0 + (rnd.uniform(-jitter, jitter) if jitter else 0.0)
            v.co = Vector((v.co.x * scale[0] * j, v.co.y * scale[1] * j, v.co.z * scale[2] * j))
        M = Matrix.Translation(Vector(loc)) @ _rot(rot)
        return self._finish(verts, color, bone, weights, smooth, M)

    def prism(self, pts, depth, loc=(0, 0, 0), color="wood", rot=(0, 0, 0), bone=None, weights=None,
              smooth=None, center=True):
        """Polygone 2D (x, z) extrudé selon Y (épaisseur depth), puis tourné et placé."""
        y0 = -depth / 2 if center else 0.0
        front = [self.bm.verts.new((x, y0, z)) for x, z in pts]
        back = [self.bm.verts.new((x, y0 + depth, z)) for x, z in pts]
        n = len(pts)
        self.bm.faces.new(list(reversed(front)) if _area(pts) > 0 else front)
        self.bm.faces.new(back if _area(pts) > 0 else list(reversed(back)))
        for i in range(n):
            j = (i + 1) % n
            q = [front[i], front[j], back[j], back[i]]
            self.bm.faces.new(q if _area(pts) > 0 else list(reversed(q)))
        verts = front + back
        M = Matrix.Translation(Vector(loc)) @ _rot(rot)
        return self._finish(verts, color, bone, weights, smooth, M)

    def lathe(self, profile, loc=(0, 0, 0), colors="wood", segs=8, rot=(0, 0, 0), bone=None,
              weights=None, smooth=None, scale=(1, 1, 1), close_top=True, close_bottom=True):
        """Profil [(rayon, z), ...] de bas en haut, tourné autour de Z. colors: une couleur ou une par bande."""
        rings = []
        for (r, z) in profile:
            ring = []
            for k in range(segs):
                a = 2 * math.pi * k / segs
                ring.append(self.bm.verts.new((r * math.cos(a) * scale[0], r * math.sin(a) * scale[1], z * scale[2])))
            rings.append(ring)
        band_faces = []
        for i in range(len(rings) - 1):
            fl = []
            for k in range(segs):
                k2 = (k + 1) % segs
                a, b, c, d = rings[i][k], rings[i][k2], rings[i + 1][k2], rings[i + 1][k]
                if profile[i][0] < 1e-6:
                    if a is not b:
                        pass
                fl.append(self.bm.faces.new((a, b, c, d)))
            band_faces.append(fl)
        caps = []
        if close_bottom and profile[0][0] > 1e-6:
            caps.append(self.bm.faces.new(list(reversed(rings[0]))))
        if close_top and profile[-1][0] > 1e-6:
            caps.append(self.bm.faces.new(rings[-1]))
        verts = [v for r in rings for v in r]
        bmesh.ops.remove_doubles(self.bm, verts=verts, dist=1e-5)
        verts = [v for v in verts if v.is_valid]
        M = Matrix.Translation(Vector(loc)) @ _rot(rot)
        if isinstance(colors, (list, tuple)):
            cl = list(colors)

            def col(face):
                z = (M.inverted() @ face.calc_center_median()).z
                for i in range(len(profile) - 1):
                    if z <= max(profile[i][1], profile[i + 1][1]) * scale[2] + 1e-6:
                        return cl[min(i, len(cl) - 1)]
                return cl[-1]
            return self._finish(verts, col, bone, weights, smooth, M)
        return self._finish(verts, colors, bone, weights, smooth, M)

    def quad(self, pts, color, bone=None, smooth=None, double=False):
        vs = [self.bm.verts.new(p) for p in pts]
        self.bm.faces.new(vs)
        if double:
            vs2 = [self.bm.verts.new(p) for p in reversed(pts)]
            self.bm.faces.new(vs2)
            vs += vs2
        return self._finish(vs, color, bone, None, smooth)

    def mesh(self, verts_co, faces_idx, color, loc=(0, 0, 0), rot=(0, 0, 0), bone=None, weights=None, smooth=None):
        vs = [self.bm.verts.new(c) for c in verts_co]
        for f in faces_idx:
            self.bm.faces.new([vs[i] for i in f])
        M = Matrix.Translation(Vector(loc)) @ _rot(rot)
        return self._finish(vs, color, bone, weights, smooth, M)

    def recolor(self, verts, color):
        return self._finish(verts, color)

    def transform(self, verts, M):
        bmesh.ops.transform(self.bm, matrix=M, verts=[v for v in verts if v.is_valid])

    def tri_count(self):
        return sum(len(f.verts) - 2 for f in self.bm.faces)

    def to_object(self, name, mat, collection=None, parent=None, loc=(0, 0, 0)):
        me = bpy.data.meshes.new(name)
        self.bm.normal_update()
        self.bm.to_mesh(me)
        me.materials.append(mat)
        ob = bpy.data.objects.new(name, me)
        (collection or bpy.context.scene.collection).objects.link(ob)
        for b in self.bones:
            ob.vertex_groups.new(name=b)
        if parent is not None:
            ob.parent = parent
        ob.location = loc
        self.bm.free()
        return ob


def _area(pts):
    a = 0.0
    for i in range(len(pts)):
        x1, z1 = pts[i]
        x2, z2 = pts[(i + 1) % len(pts)]
        a += x1 * z2 - x2 * z1
    return a / 2


def empty(name, collection=None, parent=None, loc=(0, 0, 0), rot=(0, 0, 0), size=0.3):
    ob = bpy.data.objects.new(name, None)
    ob.empty_display_size = size
    (collection or bpy.context.scene.collection).objects.link(ob)
    ob.parent = parent
    ob.location = loc
    ob.rotation_euler = tuple(math.radians(a) for a in rot)
    return ob


def tri_count_obj(ob):
    if ob.type != "MESH":
        return 0
    return sum(len(p.vertices) - 2 for p in ob.data.polygons)


def tree_tris(ob):
    t = tri_count_obj(ob)
    for c in ob.children:
        t += tree_tris(c)
    return t


# Export ----------------------------------------------------------------

def export_glb(path, objects, animation_mode="ACTIONS", animations=True):
    bpy.ops.object.select_all(action="DESELECT") if bpy.context.view_layer.objects.active else None
    for ob in bpy.context.view_layer.objects:
        ob.select_set(False)
    for ob in objects:
        ob.select_set(True)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=path, export_format="GLB", use_selection=True, export_extras=True,
        export_yup=True, export_apply=False, export_animations=animations,
        export_animation_mode=animation_mode, export_morph=True, export_morph_normal=False,
        export_skins=True, export_def_bones=True, export_leaf_bone=False,
        export_texcoords=True, export_normals=True, export_tangents=False,
        export_materials="EXPORT", export_image_format="AUTO", export_cameras=False,
        export_lights=False, export_force_sampling=True, export_optimize_animation_size=True,
        export_reset_pose_bones=True, export_anim_slide_to_zero=True, export_vertex_color="NONE",
        export_shared_accessors=True,
    )
    return os.path.getsize(path)


def write_stats(name, data):
    os.makedirs(STATS, exist_ok=True)
    with open(os.path.join(STATS, name + ".json"), "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=1)


# Rendus d'aperçu ---------------------------------------------------------------

def setup_render(res=(960, 540), samples=24, transparent=False):
    sc = bpy.context.scene
    sc.render.engine = "CYCLES"
    sc.cycles.device = "CPU"
    sc.cycles.samples = samples
    sc.cycles.use_denoising = True
    try:
        sc.cycles.denoiser = "OPENIMAGEDENOISE"
    except TypeError:
        pass
    sc.cycles.max_bounces = 4
    sc.render.resolution_x, sc.render.resolution_y = res
    sc.render.resolution_percentage = 100
    sc.render.film_transparent = transparent
    sc.view_settings.view_transform = "Standard"
    sc.view_settings.look = "None"
    sc.render.image_settings.file_format = "PNG"
    return sc


def world(color=(0.78, 0.86, 0.95), strength=0.9):
    w = bpy.data.worlds.new("ciel")
    bpy.context.scene.world = w
    bg = w.node_tree.nodes.get("Background")
    bg.inputs["Color"].default_value = (*color, 1.0)
    bg.inputs["Strength"].default_value = strength
    return w


def sun(rot=(50, 0, 135), energy=3.2, color=(1.0, 0.95, 0.86), angle=4.0):
    d = bpy.data.lights.new("soleil", "SUN")
    d.energy = energy
    d.color = color
    d.angle = math.radians(angle)
    ob = bpy.data.objects.new("soleil", d)
    bpy.context.scene.collection.objects.link(ob)
    ob.rotation_euler = tuple(math.radians(a) for a in rot)
    return ob


def iso_camera(target=(0, 0, 0), ortho=10.0, azimuth=45.0, elevation=35.264, dist=60.0, name="camera"):
    cam = bpy.data.cameras.new(name)
    cam.type = "ORTHO"
    cam.ortho_scale = ortho
    cam.clip_end = 500
    ob = bpy.data.objects.new(name, cam)
    bpy.context.scene.collection.objects.link(ob)
    az, el = math.radians(azimuth), math.radians(elevation)
    # azimut 45: la caméra est au sud-est (+X, -Y) et regarde vers le nord-ouest
    d = Vector((math.sin(az) * math.cos(el), -math.cos(az) * math.cos(el), math.sin(el)))
    ob.location = Vector(target) + d * dist
    look = (Vector(target) - ob.location).to_track_quat("-Z", "Y")
    ob.rotation_euler = look.to_euler()
    bpy.context.scene.camera = ob
    return ob


def persp_camera(loc, target, lens=50, name="camera"):
    cam = bpy.data.cameras.new(name)
    cam.lens = lens
    cam.clip_end = 500
    ob = bpy.data.objects.new(name, cam)
    bpy.context.scene.collection.objects.link(ob)
    ob.location = loc
    ob.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()
    bpy.context.scene.camera = ob
    return ob


_label_mat = None


def label(text, loc, size=0.25, color=(0.12, 0.12, 0.14), rot=(0, 0, 0)):
    global _label_mat
    if _label_mat is None:
        _label_mat = bpy.data.materials.new("etiquette")
        b = _label_mat.node_tree.nodes.get("Principled BSDF")
        b.inputs["Base Color"].default_value = (*color, 1)
        b.inputs["Roughness"].default_value = 1.0
    cu = bpy.data.curves.new("txt", "FONT")
    cu.body = text
    cu.size = size
    cu.align_x = "CENTER"
    ob = bpy.data.objects.new("etiquette_" + text, cu)
    bpy.context.scene.collection.objects.link(ob)
    ob.location = loc
    ob.rotation_euler = tuple(math.radians(a) for a in rot)
    cu.materials.append(_label_mat)
    return ob


def ground_plane(size=200, color=(0.62, 0.70, 0.47), z=0.0):
    me = bpy.data.meshes.new("sol_rendu")
    bm = bmesh.new()
    bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=size / 2)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new("sol_rendu", me)
    bpy.context.scene.collection.objects.link(ob)
    ob.location = (0, 0, z)
    m = bpy.data.materials.new("sol_rendu")
    b = m.node_tree.nodes.get("Principled BSDF")
    b.inputs["Base Color"].default_value = (*color, 1)
    b.inputs["Roughness"].default_value = 1.0
    me.materials.append(m)
    return ob


def render(path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    bpy.context.scene.render.filepath = path
    bpy.ops.render.render(write_still=True)


def srgb_to_lin(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def hex_lin(h):
    return tuple(srgb_to_lin(v / 255) for v in P.hex_to_rgb(h))
