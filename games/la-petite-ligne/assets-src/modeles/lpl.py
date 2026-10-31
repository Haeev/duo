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
    bpy.context.preferences.filepaths.save_version = 0
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


# Low poly arrondi automatique (bible section 8.2): quand AUTO_ROUND est vrai, toute boîte sans
# chanfrein explicite en reçoit un selon sa taille (arêtes au sol vives pour les boîtes posées).
AUTO_ROUND = False
AUTO_MIN = (0.6, 0.08)   # plus grande et plus petite dimensions en dessous desquelles une boîte reste vive


def auto_bevel(size, base):
    """(largeur, segments, prédicat) du chanfrein automatique, ou None pour une boîte trop fine ou minuscule."""
    dmax, dmin = max(size), min(size)
    # petits détails (moins de 60 cm) et planches et plaques (moins de 8 cm): peu visibles à 16 à 36 m de champ,
    # laissés vifs pour tenir le budget de triangles
    if dmax < AUTO_MIN[0] or dmin < AUTO_MIN[1]:
        return None
    w = 0.02 if dmax < 0.5 else 0.035 if dmax < 2.0 else 0.07 if dmax < 6.0 else 0.1
    w = min(w, dmin * 0.35)
    # deux segments pour les gros volumes seulement (murs, socles): le coût reste raisonnable
    seg = 2 if dmax >= 2.0 and dmin >= 0.25 else 1
    pred = (lambda a, b: not (abs(a.z) < 1e-4 and abs(b.z) < 1e-4)) if base else None
    if dmax >= 2.0 and size[2] >= 1.5:
        # mur ou corps de bâtiment: seuls les angles verticaux se voient (le haut est sous le toit)
        pred = lambda a, b: abs(a.x - b.x) < 1e-4 and abs(a.y - b.y) < 1e-4  # noqa: E731
    return w, seg, pred


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

    def _bevel(self, verts, bevel, bseg, edges_pred=None):
        faces0 = list({f for v in verts for f in v.link_faces})
        # ordre déterministe (sinon l'ordre des sommets change d'une construction à l'autre)
        self.bm.edges.index_update()
        edges = sorted({e for v in verts for e in v.link_edges}, key=lambda e: e.index)
        if edges_pred is not None:
            # chanfrein sélectif (arêtes vues seulement): edges_pred(a, b) sur les coordonnées locales
            edges = [e for e in edges if edges_pred(e.verts[0].co, e.verts[1].co)]
            if not edges:
                return verts
        r = bmesh.ops.bevel(self.bm, geom=edges, offset=bevel, segments=bseg, profile=0.5,
                            affect="EDGES", clamp_overlap=True)
        faces = [f for f in faces0 if f.is_valid] + list(r["faces"])
        self.bm.verts.index_update()
        return sorted({v for f in faces for v in f.verts}, key=lambda v: v.index)

    # primitives
    def box(self, size, loc=(0, 0, 0), color="stone", rot=(0, 0, 0), bevel=0.0, bseg=1,
            taper=None, shear=None, bone=None, weights=None, smooth=None, base=False, bedges=None, no_round=False):
        sx, sy, sz = size
        if AUTO_ROUND and bevel == 0 and not no_round:
            ab = auto_bevel(size, base)
            if ab:
                bevel, bseg, bedges = ab
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
            verts = self._bevel(verts, bevel, bseg, bedges)
        M = Matrix.Translation(Vector(loc)) @ _rot(rot)
        return self._finish(verts, color, bone, weights, smooth, M)

    def bevel(self, verts, offset, segs, color, edges_pred=None):
        """Chanfreine après coup des pièces déjà posées (coordonnées finales), puis recolore."""
        verts = self._bevel([v for v in verts if v.is_valid], offset, segs, edges_pred)
        return self._finish(verts, color)

    def cyl(self, r, h, loc=(0, 0, 0), color="wood", segs=8, r2=None, rot=(0, 0, 0), cap=True,
            base=False, bone=None, weights=None, smooth=None, scale=(1, 1, 1), bevel=0.0):
        if AUTO_ROUND and segs < 5:
            segs = 5 if r < 0.025 else 6  # bible 8.4: jamais moins de 5 pans
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
        ccw = _area(pts) > 0
        self.bm.faces.new(front if ccw else list(reversed(front)))
        self.bm.faces.new(list(reversed(back)) if ccw else back)
        for i in range(n):
            j = (i + 1) % n
            q = [front[i], front[j], back[j], back[i]]
            self.bm.faces.new(list(reversed(q)) if ccw else q)
        verts = front + back
        M = Matrix.Translation(Vector(loc)) @ _rot(rot)
        return self._finish(verts, color, bone, weights, smooth, M)

    def lathe(self, profile, loc=(0, 0, 0), colors="wood", segs=8, rot=(0, 0, 0), bone=None,
              weights=None, smooth=None, scale=(1, 1, 1), close_top=True, close_bottom=True, phase=0.0):
        """Profil [(rayon, z), ...] de bas en haut, tourné autour de Z. colors: une couleur ou une par bande."""
        rings = []
        for (r, z) in profile:
            ring = []
            for k in range(segs):
                a = 2 * math.pi * k / segs + math.radians(phase)
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


# Registre d'assets et planches -------------------------------------------------

class Assets:
    """Rassemble les nœuds racines d'un GLB, leurs triangles et leurs données (extras)."""

    def __init__(self, mat, cells=None):
        self.mat = mat
        self.cells = cells or world_cells()
        self.roots = []
        self.info = {}

    def geo(self):
        return Geo(self.cells)

    def add(self, name, g, extras=None, parent=None, loc=(0, 0, 0)):
        ob = g.to_object(name, self.mat, parent=parent, loc=loc)
        if parent is None:
            self._register(ob, extras)
        elif extras:
            for k, v in extras.items():
                ob[k] = v
        return ob

    def subgroup(self, name, parent, extras=None):
        ob = empty(name, parent=parent)
        for k, v in (extras or {}).items():
            ob[k] = v
        return ob

    def alias(self, name, src, extras=None):
        """Second nœud qui partage le maillage d'un autre (aucun poids en plus dans le GLB)."""
        ob = bpy.data.objects.new(name, src.data)
        bpy.context.scene.collection.objects.link(ob)
        self._register(ob, dict(extras or {}, alias_of=src.name))
        return ob

    def group(self, name, extras=None):
        ob = empty(name)
        self._register(ob, extras)
        return ob

    def _register(self, ob, extras):
        self.roots.append(ob)
        if extras:
            for k, v in extras.items():
                ob[k] = v
        self.info[ob.name] = dict(extras or {})

    def all_objects(self):
        out = []

        def walk(o):
            out.append(o)
            for c in o.children:
                walk(c)
        for r in self.roots:
            walk(r)
        return out

    def stats(self):
        return {r.name: dict(self.info[r.name], tris=tree_tris(r)) for r in self.roots}


def duplicate_tree(ob, parent=None):
    o = ob.copy()
    bpy.context.scene.collection.objects.link(o)
    o.parent = parent
    if parent is None:
        o.matrix_world = ob.matrix_world.copy()
    for c in ob.children:
        duplicate_tree(c, o)
    return o


def board(roots, path, cols=6, cell=2.0, res=(1600, 900), ortho=None, azimuth=45, elevation=35.264,
          label_size=0.16, spacing=None, samples=20, emission=0.0, mannequin=False, names=None):
    """Planche: copie chaque nœud racine sur une grille, avec son nom, en vue isométrique."""
    if os.environ.get("LPL_SANS_PLANCHES"):
        return
    setup_render(res, samples)
    for o in list(bpy.data.objects):
        if o.type in ("LIGHT", "CAMERA"):
            bpy.data.objects.remove(o, do_unlink=True)
    world(hex_lin("#DCE6EE"), 0.9)
    sun((50, 0, 140), 3.0)
    gp = ground_plane(400, hex_lin("#A7B98A"), z=-0.002)
    placed = []
    import math as _m
    R = Vector((1, 1, 0)) / _m.sqrt(2)     # droite de l'écran (azimut 45)
    D = Vector((1, -1, 0)) / _m.sqrt(2)    # bas de l'écran (vers la caméra)
    u = v = 0.0
    row_h = 0.0
    col = 0
    for r in roots:
        w = spacing(r) if spacing else cell
        if col >= cols:
            col = 0
            u = 0.0
            v += row_h + label_size * 2.5
            row_h = 0.0
        d = duplicate_tree(r)
        c = R * (u + w / 2) + D * (v + w / 2)
        d.location = (c.x, c.y, 0)
        bpy.context.view_layer.update()
        zmin = min(((o.matrix_world @ Vector(cc)).z for o in [d] + list(d.children_recursive)
                    if o.type == "MESH" for cc in o.bound_box), default=0.0)
        if zmin < -0.01:
            d.location.z -= zmin
        lp = R * (u + w / 2) + D * (v + w + label_size * 1.2)
        label((names or {}).get(r.name, r.name), (lp.x, lp.y, 0.01), size=label_size, rot=(0, 0, 45))
        placed.append(d)
        u += w
        row_h = max(row_h, w)
        col += 1
    keep = {gp.name}
    for d in placed:
        keep.add(d.name)
        keep.update(c.name for c in d.children_recursive)
    hidden = []
    for o in bpy.context.scene.objects:
        if o.name not in keep and o.type in ("MESH", "ARMATURE", "EMPTY") and not o.hide_render:
            o.hide_render = True
            hidden.append(o)
    for d in placed:
        d.hide_render = False
        for c in d.children_recursive:
            c.hide_render = False
    if mannequin:
        g = Geo(world_cells())
        g.box((0.3, 0.05, 1.8), color="paper_dark", base=True)
        for h in range(1, 18):
            g.box((0.34 if h % 5 == 0 else 0.32, 0.055, 0.008), loc=(0, 0, h * 0.1), color="shadow")
        mats = [m for m in bpy.data.materials if m.name.startswith("lpl_palette")]
        mob = g.to_object("mannequin_180", mats[0])
        mob.location = (-0.6, -0.5, 0)
    # cadrage: boîte englobante des copies
    from mathutils import Vector as V
    pts = []
    for d in placed:
        for o in [d] + list(d.children_recursive):
            if o.type == "MESH":
                for c in o.bound_box:
                    pts.append(o.matrix_world @ V(c))
    cam = iso_camera((0, 0, 0), 10, azimuth, elevation)
    bpy.context.view_layer.update()
    mw = cam.matrix_world
    cr, cu, cf = mw.col[0].xyz, mw.col[1].xyz, mw.col[2].xyz
    sx = [p.dot(cr) for p in pts]
    sy = [p.dot(cu) for p in pts]
    aspect = res[0] / res[1]
    w = max(sx) - min(sx)
    h = max(sy) - min(sy)
    cx, cy = (max(sx) + min(sx)) / 2, (max(sy) + min(sy)) / 2
    center = cr * cx + cu * cy
    cam.location = center + cf * 80
    cam.data.ortho_scale = ortho or max(w, h * aspect) * 1.06
    for m in bpy.data.materials:
        if m.name.startswith("lpl_palette"):
            set_emission(m, emission)
    render(path)
    for d in placed:
        for o in [d] + list(d.children_recursive):
            bpy.data.objects.remove(o, do_unlink=True)
    for o in hidden:
        o.hide_render = False
    for o in list(bpy.data.objects):
        if o.name.startswith(("etiquette_", "mannequin_180")):
            bpy.data.objects.remove(o, do_unlink=True)
    bpy.data.objects.remove(gp, do_unlink=True)
