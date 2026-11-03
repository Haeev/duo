"""Gabarits des personnages (plan de qualité visuelle, chantier 4, section 4.2): mêmes 18 os, mêmes noms, mêmes
directions; seules les longueurs et les points d'attache changent.

Principe (sans toucher aux clips, qui sont des rotations):
- chaque personnage d'un gabarit est modelé autour de SES os (`bones(nom)`), puis ramené dans l'espace du
  squelette commun `rig`: chaque sommet recule de la somme pondérée des décalages de ses os (`to_standard`).
  Le maillage reste lié au squelette commun (mêmes matrices de liaison pour tous);
- le jeu pose, après la copie du squelette, la translation de repos de chaque os du gabarit (extra `bone_rest`
  du nœud du personnage: {os: [x, y, z]} dans le repère glTF du parent). Le maillage retrouve alors exactement
  sa forme, et les clips (rotations, plus la translation du bassin, identique pour tous les gabarits adultes:
  même hauteur de hanches) jouent dessus. Les pistes de translation des autres os sont retirées des clips
  (`glb_post.strip_rest_channels`), sinon elles remettraient les longueurs du gabarit moyen;
- sans cette pose du jeu, le personnage garde ses volumes mais ses os au gabarit moyen (épaules ramenées de
  quelques centimètres): rien ne casse, la silhouette est seulement moins juste.

Pourquoi la hauteur des hanches est commune aux adultes: la piste de translation du bassin est absolue (assis,
accroupi, marche); des jambes plus courtes feraient flotter les pieds. La fiche 4.2 garde d'ailleurs les jambes à
1,9 tête pour tous les adultes. Les gabarits jouent sur le torse, le cou, les épaules, les bras et l'écart des
hanches; l'enfant (jambes plus courtes) demandera un décalage du bassin côté jeu (hors de cette étape).
"""
import math

from mathutils import Vector

# nom, tête, queue, parent (gabarit moyen: le squelette `rig` de personnages.py)
STANDARD = [
    ("root", (0, 0, 0), (0, 0, 0.25), None),
    ("hips", (0, 0, 0.90), (0, 0, 1.00), "root"),
    ("spine", (0, 0, 1.00), (0, 0, 1.16), "hips"),
    ("chest", (0, 0, 1.16), (0, 0, 1.37), "spine"),
    ("neck", (0, 0, 1.37), (0, 0, 1.45), "chest"),
    ("head", (0, 0, 1.45), (0, 0, 1.75), "neck"),
    ("upper_arm_l", (0.205, 0, 1.33), (0.225, 0, 1.065), "chest"),
    ("forearm_l", (0.225, 0, 1.065), (0.235, 0, 0.83), "upper_arm_l"),
    ("hand_l", (0.235, 0, 0.83), (0.24, 0, 0.74), "forearm_l"),
    ("upper_arm_r", (-0.205, 0, 1.33), (-0.225, 0, 1.065), "chest"),
    ("forearm_r", (-0.225, 0, 1.065), (-0.235, 0, 0.83), "upper_arm_r"),
    ("hand_r", (-0.235, 0, 0.83), (-0.24, 0, 0.74), "forearm_r"),
    ("thigh_l", (0.09, 0, 0.89), (0.09, 0, 0.48), "hips"),
    ("shin_l", (0.09, 0, 0.48), (0.09, 0, 0.085), "thigh_l"),
    ("foot_l", (0.09, 0, 0.085), (0.09, -0.13, 0.03), "shin_l"),
    ("thigh_r", (-0.09, 0, 0.89), (-0.09, 0, 0.48), "hips"),
    ("shin_r", (-0.09, 0, 0.48), (-0.09, 0, 0.085), "thigh_r"),
    ("foot_r", (-0.09, 0, 0.085), (-0.09, -0.13, 0.03), "shin_r"),
]

# Paramètres des gabarits (m). chest_top: haut du thorax (base du cou); neck: longueur du cou; shoulder: attache
# de l'épaule (x, z); upper, fore: longueurs du bras et de l'avant-bras; thigh_x: écart des hanches.
PARAMS = {
    # gabarit moyen (joueurs): fiche 4.2, épaules 1,25 tête
    "moyen": {"spine_top": 1.16, "chest_top": 1.37, "neck": 0.08, "shoulder": (0.205, 1.33), "upper": 0.2658,
              "fore": 0.2352, "thigh_x": 0.09},
    # rond (Colette, « taille moyenne, ronde »): épaules tombantes et un peu étroites sur un buste et des hanches
    # larges, cou court, bras courts et ronds, jambes écartées par les hanches
    "rond": {"spine_top": 1.15, "chest_top": 1.352, "neck": 0.066, "shoulder": (0.198, 1.312), "upper": 0.255,
             "fore": 0.226, "thigh_x": 0.1},
    # trapu (Firmin, ancien cheminot): épaules larges et carrées, thorax en tonneau, cou très court (la tête
    # rentre dans les épaules), bras courts et forts, appui large
    "trapu": {"spine_top": 1.15, "chest_top": 1.352, "neck": 0.05, "shoulder": (0.222, 1.318), "upper": 0.256,
              "fore": 0.226, "thigh_x": 0.1},
}


def bones(gab):
    """Liste (nom, tête, queue, parent) du gabarit: mêmes directions que le squelette commun."""
    p = PARAMS[gab]
    std = {b[0]: b for b in STANDARD}
    out = {}

    def put(name, head, length=None):
        _, h0, t0, par = std[name]
        d = Vector(t0) - Vector(h0)
        ln = d.length if length is None else length
        tail = Vector(head) + d.normalized() * ln
        out[name] = (name, tuple(head), tuple(tail), par)
        return tail

    put("root", (0, 0, 0))
    put("hips", (0, 0, 0.90))
    put("spine", (0, 0, 1.0), p["spine_top"] - 1.0)
    put("chest", (0, 0, p["spine_top"]), p["chest_top"] - p["spine_top"])
    put("neck", (0, 0, p["chest_top"]), p["neck"])
    put("head", (0, 0, p["chest_top"] + p["neck"]))
    for s, side in ((1, "l"), (-1, "r")):
        sx, sz = p["shoulder"]
        elbow = put("upper_arm_" + side, (s * sx, 0, sz), p["upper"])
        wrist = put("forearm_" + side, tuple(elbow), p["fore"])
        put("hand_" + side, tuple(wrist))
        knee = put("thigh_" + side, (s * p["thigh_x"], 0, 0.89))
        ankle = put("shin_" + side, tuple(knee))
        put("foot_" + side, tuple(ankle))
    return [out[b[0]] for b in STANDARD]


def deltas(gab):
    """Décalage de la tête de chaque os (gabarit moins moyen), repère Blender du squelette."""
    g = {b[0]: Vector(b[1]) for b in bones(gab)}
    return {b[0]: g[b[0]] - Vector(b[1]) for b in STANDARD}


def joint(gab, name, end="head"):
    """Position (Vector) de la tête ou de la queue d'un os du gabarit."""
    for b in bones(gab):
        if b[0] == name:
            return Vector(b[1] if end == "head" else b[2])
    raise KeyError(name)


def to_standard(g, gab, verts=None):
    """Ramène les sommets d'un Geo modelé au gabarit dans l'espace du squelette commun: chaque sommet recule de la
    somme pondérée des décalages de ses os (exact en peau linéaire, os de mêmes directions)."""
    if gab == "moyen":
        return
    d = deltas(gab)
    names = g.bones
    for v in (verts if verts is not None else g.bm.verts):
        if not v.is_valid:
            continue
        w = v[g.dl]
        tot = Vector((0, 0, 0))
        s = 0.0
        for bi, wt in w.items():
            tot += d[names[bi]] * wt
            s += wt
        if s > 0:
            v.co -= tot / s


def pose_offsets(gab):
    """Translations de pose (repère de chaque os, Blender) qui donnent le gabarit à un squelette commun importé:
    pour les planches et les contrôles faits dans Blender. {os: Vector} relatif au parent."""
    d = deltas(gab)
    par = {b[0]: b[3] for b in STANDARD}
    return {n: d[n] - (d[par[n]] if par[n] else Vector((0, 0, 0))) for n in d}


def apply_to_rig(rig, gab):
    """Pose le gabarit sur un squelette commun (importé ou construit): translation de pose de chaque os (sauf le
    bassin, que les clips pilotent; son décalage est nul pour les adultes)."""
    off = pose_offsets(gab)
    for pb in rig.pose.bones:
        if pb.name == "hips" or pb.name not in off:
            continue
        rest = pb.bone.matrix_local.to_3x3()
        pb.location = rest.inverted() @ off[pb.name]


def clear_rig(rig):
    for pb in rig.pose.bones:
        if pb.name != "hips":
            pb.location = (0, 0, 0)


def shoulder_angle(gab):
    """Pente des épaules (degrés) entre la base du cou et l'attache de l'épaule, pour mémoire dans la fiche."""
    p = PARAMS[gab]
    sx, sz = p["shoulder"]
    return math.degrees(math.atan2(p["chest_top"] - sz, sx))
