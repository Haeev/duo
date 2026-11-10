"""Formes de base des décors: pièces arrondies, couleurs par pièce, fusion en un maillage lissé.

Repère Blender: X est, Y nord, Z haut; l'avant d'un modèle regarde -Y (devient +Z en glTF, le sud
de la carte). Origine au centre de l'emprise, au sol. Une pièce = un objet temporaire; `Modele.fusionner`
les joint en un seul maillage (un nœud, un matériau) et pose des normales pondérées par l'aire:
les grandes faces restent planes, les arrondis restent doux (bible 1.1, « aucun coin vif »).
"""
import math

import bpy  # noqa: F401  (bpy avant bmesh, sinon bmesh est introuvable)
import bmesh
from mathutils import Euler, Matrix, Vector

# Emplacements de couleur d'un décor (bible 7.4): l'index va dans TEXCOORD_0.x = (zone + 0,5) / 8,
# comme chez les personnages, pour pouvoir recolorer une série au rendu plus tard.
ZONES = {"bois": 0, "peinture": 1, "tissu": 2, "metal": 3, "fixe": 6}


def hex_rgb(code):
    code = code.lstrip("#")
    return tuple(int(code[i:i + 2], 16) / 255 for i in (0, 2, 4))


def srgb_to_linear(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


class Modele:
    """Un modèle en construction: des pièces, puis un maillage fusionné."""

    def __init__(self, nom, couleurs, collection):
        self.nom = nom
        self.couleurs = couleurs  # nom du nuancier -> "#RRGGBB"
        self.collection = collection
        self.pieces = []

    # ------------------------------------------------------------------ couleurs
    def rgb(self, couleur):
        if isinstance(couleur, tuple):
            return couleur
        if couleur not in self.couleurs:
            raise SystemExit(f"couleur inconnue du nuancier: {couleur} ({self.nom})")
        return hex_rgb(self.couleurs[couleur])

    # ------------------------------------------------------------------ pièces
    def _piece(self, bm, couleur, zone, loc, rot, haut=None):
        """Pose la pièce (rotation puis translation), la colore, la range."""
        m = Matrix.Translation(Vector(loc)) @ Euler(tuple(math.radians(a) for a in rot)).to_matrix().to_4x4()
        bmesh.ops.transform(bm, matrix=m, verts=bm.verts)
        bm.normal_update()
        me = bpy.data.meshes.new(f"{self.nom}_piece")
        bm.to_mesh(me)
        bm.free()
        ob = bpy.data.objects.new(me.name, me)
        self.collection.objects.link(ob)
        bas = self.rgb(couleur)
        clair = self.rgb(haut) if haut is not None else bas
        attr = me.color_attributes.new("Col", "BYTE_COLOR", "CORNER")
        uv = me.uv_layers.new(name="UVMap")
        zx = (ZONES[zone] + 0.5) / 8
        for poly in me.polygons:
            # Dégradé par la normale (houppiers): le dessus prend la teinte claire.
            t = max(0.0, min(1.0, (poly.normal.z + 0.2) / 1.0)) if haut is not None else 0.0
            c = tuple(bas[i] * (1 - t) + clair[i] * t for i in range(3))
            for li in poly.loop_indices:
                attr.data[li].color_srgb = (*c, 1.0)
                uv.data[li].uv = (zx, 0.5)
        self.pieces.append(ob)
        return ob

    @staticmethod
    def _arrondir(bm, rayon, segments, angle_min=30.0, filtre=None):
        if rayon <= 0:
            return
        aretes = [e for e in bm.edges if len(e.link_faces) == 2
                  and e.calc_face_angle(0) > math.radians(angle_min)
                  and (filtre is None or filtre(e))]
        aretes.sort(key=lambda e: e.index)
        if aretes:
            bmesh.ops.bevel(bm, geom=aretes, offset=rayon, offset_type="OFFSET", segments=segments,
                            profile=0.5, affect="EDGES", clamp_overlap=True)

    def boite(self, taille, loc, couleur, zone="bois", arrondi=0.02, seg=2, rot=(0, 0, 0), sol_vif=True):
        """Boîte de `taille` (x, y, z), `loc` = centre du DESSOUS avant rotation."""
        sx, sy, sz = taille
        bm = bmesh.new()
        bmesh.ops.create_cube(bm, size=1.0)
        bmesh.ops.scale(bm, vec=(sx, sy, sz), verts=bm.verts)
        bmesh.ops.translate(bm, vec=(0, 0, sz / 2), verts=bm.verts)
        r = min(arrondi, 0.45 * min(sx, sy, sz))
        # Arêtes posées au sol laissées vives: la pièce s'assoit sans jour dessous.
        filtre = (lambda e: not all(v.co.z < 1e-4 for v in e.verts)) if sol_vif else None
        self._arrondir(bm, r, seg, filtre=filtre)
        return self._piece(bm, couleur, zone, loc, rot)

    def cylindre(self, rayon, hauteur, loc, couleur, zone="bois", pans=12, rayon_haut=None,
                 arrondi=0.0, seg=2, rot=(0, 0, 0), echelle=None):
        """Cylindre (ou tronc de cône) debout, `loc` = centre de la base avant rotation."""
        bm = bmesh.new()
        bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=pans, radius1=rayon,
                              radius2=rayon if rayon_haut is None else rayon_haut, depth=hauteur)
        bmesh.ops.translate(bm, vec=(0, 0, hauteur / 2), verts=bm.verts)
        r = min(arrondi, 0.45 * min(rayon, hauteur))
        self._arrondir(bm, r, seg, angle_min=50)
        if echelle is not None:
            bmesh.ops.scale(bm, vec=echelle, verts=bm.verts)
        return self._piece(bm, couleur, zone, loc, rot)

    def boule(self, rayon, loc, couleur, zone="fixe", echelle=(1, 1, 1), pans=12, anneaux=8, haut=None, rot=(0, 0, 0)):
        """Sphère lisse, `loc` = centre."""
        bm = bmesh.new()
        bmesh.ops.create_uvsphere(bm, u_segments=pans, v_segments=anneaux, radius=rayon)
        bmesh.ops.scale(bm, vec=echelle, verts=bm.verts)
        return self._piece(bm, couleur, zone, loc, rot, haut=haut)

    def enveloppe(self, points, couleur, zone="peinture", arrondi=0.0, seg=2):
        """Enveloppe convexe de points (toits, dalles inclinées, pignons)."""
        bm = bmesh.new()
        vs = [bm.verts.new(p) for p in points]
        res = bmesh.ops.convex_hull(bm, input=vs)
        bmesh.ops.delete(bm, geom=[g for g in res["geom_interior"] + res["geom_unused"]
                                    if isinstance(g, bmesh.types.BMVert)], context="VERTS")
        bmesh.ops.dissolve_limit(bm, angle_limit=math.radians(1), verts=bm.verts, edges=bm.edges)
        bmesh.ops.triangulate(bm, faces=[f for f in bm.faces if len(f.verts) > 4])
        bmesh.ops.join_triangles(bm, faces=bm.faces, angle_face_threshold=math.radians(1),
                                 angle_shape_threshold=math.radians(180))
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        self._arrondir(bm, arrondi, seg)
        return self._piece(bm, couleur, zone, (0, 0, 0), (0, 0, 0))

    def prisme(self, profil, longueur, couleur, zone="peinture", axe="x", centre=(0, 0, 0), arrondi=0.0, seg=2):
        """Profil 2D (u, z) extrudé le long de X (u = y) ou de Y (u = x), centré sur `centre`."""
        cx, cy, cz = centre
        pts = []
        for s in (-longueur / 2, longueur / 2):
            for u, z in profil:
                pts.append((cx + s, cy + u, cz + z) if axe == "x" else (cx + u, cy + s, cz + z))
        return self.enveloppe(pts, couleur, zone, arrondi, seg)

    # ------------------------------------------------------------------ fusion
    def fusionner(self, nom=None, lisse=True):
        """Joint les pièces en un objet, normales pondérées par l'aire; rend l'objet."""
        nom = nom or self.nom
        if not self.pieces:
            raise SystemExit(f"modèle vide: {nom}")
        bpy.ops.object.select_all(action="DESELECT")
        for ob in self.pieces:
            ob.select_set(True)
        bpy.context.view_layer.objects.active = self.pieces[0]
        if len(self.pieces) > 1:
            bpy.ops.object.join()
        ob = bpy.context.view_layer.objects.active
        ob.name = nom
        ob.data.name = nom
        if lisse:
            for p in ob.data.polygons:
                p.use_smooth = True
            mod = ob.modifiers.new("normales", "WEIGHTED_NORMAL")
            mod.mode = "FACE_AREA"
            mod.weight = 50
            mod.keep_sharp = True
            mod.thresh = 0.01
            bpy.ops.object.modifier_apply(modifier=mod.name)
        self.pieces = []
        return ob


def triangles(ob):
    return sum(len(p.vertices) - 2 for p in ob.data.polygons)


def bornes(ob):
    vs = [ob.matrix_world @ v.co for v in ob.data.vertices]
    return (Vector((min(v.x for v in vs), min(v.y for v in vs), min(v.z for v in vs))),
            Vector((max(v.x for v in vs), max(v.y for v in vs), max(v.z for v in vs))))
