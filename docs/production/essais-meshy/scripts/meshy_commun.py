"""Fonctions communes de mise en conformité des sorties de Meshy (Blender 5.2, duo-python).

Couleurs (sRGB, lumière linéaire, CIELAB), palette à cases (texture de 64 x 64, cases de 4 px,
comme La Petite Ligne), lecture de la texture de couleur d'une sortie brute, découpe en pièces,
choix d'une case de palette par pièce ou par face, coordonnées de texture de palette, matériau
commun. Importé par conformite_accessoire.py et conformite_personnage.py.
"""

import json
import math

import bpy
import numpy as np

SAMPLES = ((1 / 3, 1 / 3, 1 / 3), (0.6, 0.2, 0.2), (0.2, 0.6, 0.2), (0.2, 0.2, 0.6))


def srgb_to_linear(c):
    c = np.asarray(c, dtype=np.float64)
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def linear_to_lab(rgb):
    m = np.array([[0.4124, 0.3576, 0.1805], [0.2126, 0.7152, 0.0722], [0.0193, 0.1192, 0.9505]])
    xyz = m @ np.asarray(rgb, dtype=np.float64)
    t = xyz / np.array([0.95047, 1.0, 1.08883])
    f = np.where(t > (6 / 29) ** 3, np.cbrt(t), t / (3 * (6 / 29) ** 2) + 4 / 29)
    return np.array([116 * f[1] - 16, 500 * (f[0] - f[1]), 200 * (f[1] - f[2])])


def hex_to_srgb(hex_color):
    return np.array([int(hex_color[i:i + 2], 16) / 255 for i in (1, 3, 5)])


def ciede2000(lab1, lab2, kl=1.0, kc=1.0, kh=1.0):
    """Écart CIEDE2000 (Sharma, Wu et Dalal, 2005). kl > 1 réduit le poids de la clarté."""
    l1, a1, b1 = (float(x) for x in lab1)
    l2, a2, b2 = (float(x) for x in lab2)
    cm = (math.hypot(a1, b1) + math.hypot(a2, b2)) / 2
    g = 0.5 * (1 - math.sqrt(cm ** 7 / (cm ** 7 + 25 ** 7)))
    a1p, a2p = (1 + g) * a1, (1 + g) * a2
    c1p, c2p = math.hypot(a1p, b1), math.hypot(a2p, b2)
    h1p = math.degrees(math.atan2(b1, a1p)) % 360 if (b1 or a1p) else 0.0
    h2p = math.degrees(math.atan2(b2, a2p)) % 360 if (b2 or a2p) else 0.0
    dlp, dcp = l2 - l1, c2p - c1p
    dhp = 0.0
    if c1p * c2p != 0:
        dhp = h2p - h1p
        if dhp > 180:
            dhp -= 360
        elif dhp < -180:
            dhp += 360
    dh = 2 * math.sqrt(c1p * c2p) * math.sin(math.radians(dhp) / 2)
    lpm, cpm = (l1 + l2) / 2, (c1p + c2p) / 2
    if c1p * c2p == 0:
        hpm = h1p + h2p
    elif abs(h1p - h2p) <= 180:
        hpm = (h1p + h2p) / 2
    else:
        hpm = (h1p + h2p + 360) / 2 if h1p + h2p < 360 else (h1p + h2p - 360) / 2
    t = (1 - 0.17 * math.cos(math.radians(hpm - 30)) + 0.24 * math.cos(math.radians(2 * hpm))
         + 0.32 * math.cos(math.radians(3 * hpm + 6)) - 0.20 * math.cos(math.radians(4 * hpm - 63)))
    dtheta = 30 * math.exp(-(((hpm - 275) / 25) ** 2))
    rc = 2 * math.sqrt(cpm ** 7 / (cpm ** 7 + 25 ** 7))
    sl = 1 + 0.015 * (lpm - 50) ** 2 / math.sqrt(20 + (lpm - 50) ** 2)
    sc = 1 + 0.045 * cpm
    sh = 1 + 0.015 * cpm * t
    rt = -math.sin(math.radians(2 * dtheta)) * rc
    return math.sqrt((dlp / (kl * sl)) ** 2 + (dcp / (kc * sc)) ** 2 + (dh / (kh * sh)) ** 2 + rt * (dcp / (kc * sc)) * (dh / (kh * sh)))


class Palette:
    """Palette à cases; `allowed` restreint les cases candidates du choix automatique.

    Choix par CIEDE2000 (règle 2 de la bible, 13.3) avec un poids de clarté `kl`: à 2, l'écart de
    clarté compte pour moitié, parce que la texture de Meshy contient un éclairage peint (une face
    à l'ombre ne doit pas passer à la couleur voisine plus sombre).
    """

    def __init__(self, path, allowed=None, kl=2.0):
        with open(path, encoding="utf-8") as fh:
            self.data = json.load(fh)
        self.cells = self.data["cells"]
        self.index = {c["id"]: i for i, c in enumerate(self.cells)}
        self.allowed = list(allowed) if allowed else [c["id"] for c in self.cells if not c.get("retired")]
        for pid in self.allowed:
            self.check(pid)
        self.kl = kl
        self.lab = {pid: linear_to_lab(srgb_to_linear(hex_to_srgb(self.cells[self.index[pid]]["hex"]))) for pid in self.allowed}

    def check(self, pid):
        if pid not in self.index:
            raise SystemExit(f"case de palette inconnue: {pid}")
        return pid

    def nearest(self, lab):
        best, best_d = None, 1e9
        for pid, ref in self.lab.items():
            d = ciede2000(lab, ref, kl=self.kl)
            if d < best_d:
                best, best_d = pid, d
        return best, best_d

    def cell_uv(self, pid):
        """Centre de la case dans l'espace UV de Blender (origine en bas à gauche)."""
        i = self.index[pid]
        grid, size, px = self.data["grid"], self.data["size_px"], self.data["cell_px"]
        col, row = i % grid, i // grid
        return ((col * px + px / 2) / size, 1.0 - (row * px + px / 2) / size)

    def image(self, name="cosy_palette"):
        size, px, grid = self.data["size_px"], self.data["cell_px"], self.data["grid"]
        pix = np.zeros((size, size, 4), dtype=np.float32)
        pix[:, :, 3] = 1.0
        for i, c in enumerate(self.cells):
            col, row = i % grid, i // grid
            y0 = size - (row + 1) * px  # Blender range les rangées de bas en haut
            pix[y0:y0 + px, col * px:(col + 1) * px, :3] = hex_to_srgb(c["hex"])
        img = bpy.data.images.new(name, size, size, alpha=False)
        img.pixels.foreach_set(pix.ravel())
        img.file_format = "PNG"
        img.pack()
        return img


def base_color_images(meshes):
    """Image de couleur de chaque matériau (entrée Base Color du Principled BSDF), en linéaire."""
    images = {}
    for mat in {s.material for o in meshes for s in o.material_slots if s.material}:
        tex = None
        if mat.node_tree:
            for node in mat.node_tree.nodes:
                if node.type != "BSDF_PRINCIPLED":
                    continue
                link = node.inputs["Base Color"].links
                stack = [link[0].from_node] if link else []
                while stack and tex is None:
                    n = stack.pop()
                    if n.type == "TEX_IMAGE" and n.image:
                        tex = n.image
                    for inp in n.inputs:
                        stack += [l.from_node for l in inp.links]
        if tex is None:
            continue
        w, h = tex.size
        buf = np.empty(w * h * 4, dtype=np.float32)
        tex.pixels.foreach_get(buf)
        # Images 8 bits: valeurs telles qu'enregistrées (sRGB); images flottantes: déjà linéaires.
        rgb = buf.reshape(h, w, 4)[:, :, :3]
        images[mat.name] = (srgb_to_linear(rgb) if not tex.is_float else rgb.astype(np.float64), w, h, tex.name)
    return images


def split_parts(bm):
    """Îlots de faces reliées par une arête. Index des faces à jour attendu (index_update)."""
    part_of, parts = {}, []
    for f in bm.faces:
        if f.index in part_of:
            continue
        stack, members = [f], []
        part_of[f.index] = len(parts)
        while stack:
            g = stack.pop()
            members.append(g)
            for e in g.edges:
                for h in e.link_faces:
                    if h.index not in part_of:
                        part_of[h.index] = len(parts)
                        stack.append(h)
        parts.append(members)
    return parts, part_of


def assign_cells(bm, parts, part_of, images, mat_names, palette, conf):
    """Case de palette de chaque face, et détail par pièce pour le rapport.

    Par défaut, vote à l'aire dans chaque pièce (la couleur d'une pièce bave sur ses voisines dans
    la texture générée). `per_face_parts`: pièces vraiment multicolores, case de chaque face,
    lissée par `face_smoothing` passes de vote entre voisines. `palette_overrides`: case forcée.
    """
    uv_layer = bm.loops.layers.uv.active
    default_id = palette.check(conf.get("palette_default", palette.allowed[0]))
    overrides = {int(k): palette.check(v) for k, v in conf.get("palette_overrides", {}).items()}
    per_face = set(conf.get("per_face_parts", []))
    if conf.get("per_face_all"):
        per_face = set(range(len(parts)))
    mixed_share = conf.get("mixed_share", 0.6)
    face_cell, face_area = {}, {}
    for f in bm.faces:
        face_area[f.index] = f.calc_area()
        img = images.get(mat_names[f.material_index] if f.material_index < len(mat_names) else "")
        if img is None or uv_layer is None:
            continue
        data, w, h, _ = img
        uvs = [l[uv_layer].uv for l in f.loops]
        col = np.zeros(3)
        for a, b, c in SAMPLES:
            u = (uvs[0].x * a + uvs[1].x * b + uvs[2].x * c) % 1.0
            v = (uvs[0].y * a + uvs[1].y * b + uvs[2].y * c) % 1.0
            col += data[min(h - 1, int(v * h)), min(w - 1, int(u * w))]
        face_cell[f.index] = palette.nearest(linear_to_lab(col / len(SAMPLES)))[0]
    raw_cell = dict(face_cell)
    # Lissage des cases par face: vote pondéré entre une face et ses voisines par arête.
    for _ in range(conf.get("face_smoothing", 2)):
        smoothed = dict(face_cell)
        for f in bm.faces:
            if part_of[f.index] not in per_face or f.index not in face_cell:
                continue
            votes = {face_cell[f.index]: face_area[f.index]}
            for e in f.edges:
                for g in e.link_faces:
                    if g is not f and g.index in face_cell:
                        votes[face_cell[g.index]] = votes.get(face_cell[g.index], 0.0) + face_area[g.index]
            smoothed[f.index] = max(votes, key=votes.get)
        face_cell = smoothed
    final, details = {}, []
    for pi, members in enumerate(parts):
        votes, total = {}, 0.0
        for f in members:
            if f.index in face_cell:
                votes[face_cell[f.index]] = votes.get(face_cell[f.index], 0.0) + face_area[f.index]
                total += face_area[f.index]
        co = [v.co for f in members for v in f.verts]
        center = [round(sum(c[k] for c in co) / len(co), 4) for k in range(3)]
        entry = {"part": pi, "triangles": len(members), "center_raw": center}
        if total > 0:
            pid = max(votes, key=votes.get)
            share = votes[pid] / total
            entry.update({"votes": {k: round(v / total, 3) for k, v in sorted(votes.items(), key=lambda kv: -kv[1])}, "winner_share": round(share, 3), "mixed": share < mixed_share})
        else:
            pid = default_id
            entry["votes"] = None
        if pi in overrides:
            pid = overrides[pi]
            entry["override"] = pid
        entry["cell"] = "par face" if pi in per_face and pi not in overrides else pid
        for f in members:
            per = pi in per_face and pi not in overrides and f.index in face_cell
            final[f.index] = face_cell[f.index] if per else pid
        details.append(entry)
    # Part de l'aire dont la case finale diffère de la case la plus proche de sa propre face: ce
    # que coûterait en taches le choix face par face sans vote ni lissage.
    sampled = sum(face_area[i] for i in raw_cell)
    differ = sum(face_area[i] for i in raw_cell if raw_cell[i] != final[i])
    stats = {"area_where_final_differs_from_face_nearest": round(differ / sampled, 3) if sampled else None}
    return final, details, stats


def apply_palette_uv(bm, final, palette):
    """Remplace les coordonnées de texture: chaque face au centre de sa case."""
    for layer in list(bm.loops.layers.uv.values()):
        bm.loops.layers.uv.remove(layer)
    pal_uv = bm.loops.layers.uv.new("UVMap")
    for f in bm.faces:
        u, v = palette.cell_uv(final[f.index])
        for l in f.loops:
            l[pal_uv].uv = (u, v)
        f.material_index = 0


def palette_material(palette, name="cosy_palette"):
    """Matériau commun: texture palette au plus proche, une face, sans métal."""
    mat = bpy.data.materials.new(name)
    mat.use_backface_culling = True
    nt = mat.node_tree
    bsdf = nt.nodes.get("Principled BSDF")
    bsdf.inputs["Roughness"].default_value = 0.8
    bsdf.inputs["Metallic"].default_value = 0.0
    tex = nt.nodes.new("ShaderNodeTexImage")
    tex.image = palette.image()
    tex.interpolation = "Closest"
    return mat, tex, bsdf
