"""Sonde des pieds des clips `repos` et `marche` d'un corps conformé: contact au sol et glissement.

Usage: duo-python sonde_pieds.py [--poser] <corps.blend> [<corps.blend> ...]
  --poser: baisse ou monte le bassin de chaque clip (translation de `Hips`, verticale seulement) pour que le
  pied le plus bas touche le sol, puis enregistre le .blend (la racine ne se déplace pas à l'horizontale).
Pour chaque pied, à chaque image: point le plus bas du maillage déformé (sommets portés par le pied).
- repos: les pieds doivent rester posés (hauteur et dérive horizontale de quelques millimètres au plus);
- marche (clip sur place): pendant l'appui, le pied recule à vitesse constante; cette vitesse est celle à
  laquelle le jeu doit déplacer le personnage pour que le pied ne glisse pas (échelle de lecture du clip =
  vitesse du jeu / vitesse du clip). On donne la vitesse d'appui, son écart (glissement résiduel) et le
  décollement du pied d'appui.
"""
import sys

import bpy
import numpy as np

from bpy_extras import anim_utils  # noqa: E402
from mathutils import Vector  # noqa: E402

args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:]
POSER = "--poser" in args
args = [a for a in args if a != "--poser"]


def decaler_bassin(arm, act, dz):
    """Ajoute dz (mètres, verticale du monde) aux clés de translation du bassin, dans le repère de l'os."""
    pb = arm.pose.bones["Hips"]
    m = (arm.matrix_world @ pb.bone.matrix_local).to_3x3()
    d = m.inverted() @ Vector((0, 0, dz))
    cb = anim_utils.action_get_channelbag_for_slot(act, act.slots[0])
    for fc in cb.fcurves:
        if fc.data_path == 'pose.bones["Hips"].location':
            for k in fc.keyframe_points:
                k.co[1] += d[fc.array_index]
                k.handle_left[1] += d[fc.array_index]
                k.handle_right[1] += d[fc.array_index]


def sonder(arm, me, pieds, clip):
    act = bpy.data.actions[clip]
    arm.animation_data.action = act
    if act.slots:
        arm.animation_data.action_slot = act.slots[0]
    f0, f1 = (int(round(x)) for x in act.frame_range)
    traces = {s: [] for s in pieds}
    for f in range(f0, f1 + 1):
        bpy.context.scene.frame_set(f)
        dg = bpy.context.evaluated_depsgraph_get()
        ev = me.evaluated_get(dg)
        m = ev.to_mesh()
        mw = me.matrix_world
        for s, ids in pieds.items():
            P = np.array([tuple(mw @ m.vertices[i].co) for i in ids])
            k = int(np.argmin(P[:, 2]))
            traces[s].append((P[k, 2], P[:, 1].mean(), P[:, 0].mean()))
        ev.to_mesh_clear()
    return {s: np.array(v) for s, v in traces.items()}


for blend in args:
    bpy.ops.wm.open_mainfile(filepath=blend)
    arm = next(o for o in bpy.data.objects if o.type == "ARMATURE")
    me = next(o for o in bpy.data.objects if o.type == "MESH")
    names = [g.name for g in me.vertex_groups]
    pieds = {}
    for side in ("Left", "Right"):
        ids = {names.index(n) for n in (side + "Foot", side + "ToeBase") if n in names}
        pieds[side] = [v.index for v in me.data.vertices
                       if v.groups and max(v.groups, key=lambda g: g.weight).group in ids]
    for t in arm.animation_data.nla_tracks:
        t.mute = True
    fps = bpy.context.scene.render.fps
    res = {}
    for clip in ("repos", "marche"):
        res[clip] = sonder(arm, me, pieds, clip)
        if POSER:
            # Repos: le pied le plus bas à 1 mm; marche: le pied d'appui le plus bas du cycle à 1 mm.
            sol = min(res[clip][s][:, 0].min() for s in pieds)
            decaler_bassin(arm, bpy.data.actions[clip], 0.001 - sol)
            res[clip] = sonder(arm, me, pieds, clip)
    if POSER:
        arm.animation_data.action = None
        for t in arm.animation_data.nla_tracks:
            t.mute = False
        bpy.context.preferences.filepaths.save_version = 0
        bpy.ops.wm.save_mainfile()
    nom = blend.rsplit("/", 1)[-1].replace(".blend", "")
    r = res["repos"]
    out = [f"SONDE {nom} repos: bas des pieds " + ", ".join(
        f"{s} {1000 * r[s][:, 0].min():.0f} à {1000 * r[s][:, 0].max():.0f} mm, dérive {1000 * np.ptp(r[s][:, 1]):.1f} x {1000 * np.ptp(r[s][:, 2]):.1f} mm"
        for s in r)]
    w = res["marche"]
    sol = min(w[s][:, 0].min() for s in w)
    vit, ecarts, leve = [], [], []
    for s in w:
        z, y = w[s][:, 0], w[s][:, 1]
        appui = z < sol + 0.02
        v = np.diff(y) * fps
        a = appui[1:] & appui[:-1]
        if a.sum() >= 3:
            vit.append(np.median(v[a]))
            ecarts.append(np.percentile(np.abs(v[a] - np.median(v[a])), 80))
            leve.append(1000 * (z[appui].max() - sol))
    out.append(f"SONDE {nom} marche: sol {1000 * sol:.0f} mm, vitesse d'appui {np.mean(vit):+.2f} m/s "
               f"(gauche {vit[0]:+.2f}, droite {vit[-1]:+.2f}), écart d'appui (80e centile) {max(ecarts):.2f} m/s, "
               f"décollement en appui {max(leve):.0f} mm, {len(w['Left'])} images à {fps} i/s")
    print("\n".join(out), flush=True)
