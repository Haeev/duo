"""Scène de contrôle de l'échelle de Basile (tour 6): chêne tree_oak_01, échelle, nichoir, chicot, Basile
qui monte, redresse et tape, deux joueurs qui tiennent; rendue depuis les GLB exportés.

Lancer: duo-python scene_echelle.py <dossier de sortie>
Repère: le tronc à l'origine; x = carte x - 52,5; y = 5,5 - carte y (nord vers +y), z en haut.
Produit: faune-echelle-sequence.png (vue de jeu, six instants de l'apogée), faune-echelle-profil.png
(vues rapprochées), faune-echelle-ouest.png (échelle à l'ouest du tronc, position de la fiche).
"""
import math
import os
import sys

import bpy  # noqa: I001
from mathutils import Matrix, Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lpl  # noqa: E402

OUT = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else lpl.BOARDS
FPS = 30
TAN15 = math.tan(math.radians(15))
RUNG = 0.28


def carte(x, y, z=0.0):
    return Vector((x - 52.5, 5.5 - y, z))


# Proposition: échelle au sud-ouest du tronc (la fiche la met à l'ouest, où passe une branche du chêne)
PROPOSE = {"foot": carte(51.77, 6.23), "yaw": 135.0, "rungs": 3, "drop": 0.56,
           "hold_r": (carte(52.357, 6.421), -135.0), "hold_l": (carte(51.579, 5.643), 45.0)}
FICHE = {"foot": carte(51.47, 5.50), "yaw": 90.0, "rungs": 5, "drop": 0.0,
         "hold_r": (carte(51.25, 6.05), 0.0), "hold_l": (carte(51.25, 4.95), 180.0)}


def imp(path):
    before = set(bpy.data.objects)
    acts = set(bpy.data.actions)
    bpy.ops.import_scene.gltf(filepath=path)
    return set(bpy.data.objects) - before, set(bpy.data.actions) - acts


def keep_only(new, keep):
    """Retire les objets importés sauf keep et ses enfants (par nom: un objet retiré n'est plus lisible)."""
    names = {o.name for o in new}
    keepn = {keep.name, *(c.name for c in keep.children_recursive)}
    for n in names - keepn:
        o = bpy.data.objects.get(n)
        if o is not None:
            bpy.data.objects.remove(o, do_unlink=True)


def strip_anim(o):
    if o.animation_data:
        o.animation_data.action = None
        for tr in list(o.animation_data.nla_tracks):
            o.animation_data.nla_tracks.remove(tr)


def character(parts):
    new, acts = imp(os.path.join(lpl.OUT, "personnages.glb"))
    rig = next(o for o in new if o.type == "ARMATURE")
    for o in new:
        base = o.name.split(".")[0]
        if o.type == "MESH" and base not in parts:
            bpy.data.objects.remove(o, do_unlink=True)
    strip_anim(rig)
    rig.rotation_mode = "XYZ"
    sock = next(o for o in rig.children_recursive if o.name.split(".")[0] == "socket_hand_r")
    return rig, {a.name.split(".")[0]: a for a in acts}, sock


def play(rig, acts, name, frame):
    ad = rig.animation_data or rig.animation_data_create()
    act = acts[name]
    ad.action = act
    ad.action_slot = act.slots[0]
    ad.action_extrapolation = "HOLD"
    rig["_frame"] = frame


def build():
    lpl.reset()
    lpl.world(lpl.hex_lin("#DCE6EE"), 0.9)
    lpl.sun((50, 0, 140), 3.0)
    new, _ = imp(os.path.join(lpl.OUT, "bourg.glb"))
    tree = bpy.data.objects["tree_oak_large"]
    keep_only(new, tree)
    tree.location = (0, 0, 0)
    new, _ = imp(os.path.join(lpl.OUT, "faune.glb"))
    for n in ("heron", "goose", "fox"):
        o = bpy.data.objects[n]
        for c in o.children_recursive:
            bpy.data.objects.remove(c, do_unlink=True)
        bpy.data.objects.remove(o, do_unlink=True)
    bpy.data.objects.remove(bpy.data.objects["moss_tuft"], do_unlink=True)
    for o in bpy.data.objects:
        o.rotation_mode = "XYZ"
    nest = bpy.data.objects["nest_box"]
    nest.location = carte(52.50, 5.715, 2.575)
    stub = bpy.data.objects["oak_branch_stub"]
    stub.location = carte(52.85, 5.95, 2.75)
    tit = bpy.data.objects["blue_tit"]
    strip_anim(tit)
    new, _ = imp(os.path.join(lpl.OUT, "ferme.glb"))
    hammer = bpy.data.objects["hammer"]
    keep_only(new, hammer)
    basile, bacts, sock = character({"villager_basile"})
    hammer.parent = sock
    hammer.matrix_parent_inverse = Matrix.Identity(4)
    hammer.location = (0, 0, 0)
    hammer.rotation_mode = "XYZ"
    hammer.rotation_euler = (0, 0, 0)
    p1, pacts, _ = character({"player_base", "player_outfit_work", "player_hair_short", "player_scarf_orb"})
    p2, _, _ = character({"player_base", "player_outfit_overalls", "player_hair_bun", "player_scarf_star"})
    for m in bpy.data.materials:
        if m.node_tree and m.node_tree.nodes.get("Principled BSDF"):
            lpl.set_emission(m, 0.0)
    lpl.ground_plane(80, lpl.hex_lin("#A7B98A"), z=-0.002)
    return {"ladder": bpy.data.objects["ladder_wood"], "nest": nest, "stub": stub, "tit": tit, "basile": basile, "bacts": bacts,
            "p1": p1, "p2": p2, "pacts": pacts, "hammer": hammer}


def setup(S, cfg, t, tilt=None):
    """Place tout à l'instant t (secondes) de l'apogée."""
    yaw = math.radians(cfg["yaw"])
    fwd = Vector((math.sin(yaw), -math.cos(yaw), 0))
    lad = S["ladder"]
    lad.location = cfg["foot"]
    lad.rotation_euler = (0, 0, yaw)
    b = S["basile"]
    b.rotation_euler = (0, 0, yaw)
    T = 0.6 * cfg["rungs"]
    top = RUNG * cfg["rungs"]
    S["nest"].location = carte(52.50, 5.715, 2.575 - cfg["drop"])
    S["stub"].location = carte(52.85, 5.95, 2.75 - cfg["drop"])
    h = top
    if t < T:
        h = top * t / T
        play(b, S["bacts"], "climb_ladder", (t * FPS) % 36)
    elif t < T + 0.8:
        play(b, S["bacts"], "reach_up", (t - T) * FPS)
    elif t < T + 2.6:
        play(b, S["bacts"], "hammer_tap", ((t - T - 0.8) * FPS) % 18)
    else:
        play(b, S["bacts"], "hammer_tap", 0)
    b.location = cfg["foot"] + fwd * (TAN15 * h) + Vector((0, 0, h))
    S["hammer"].hide_render = not (T + 0.8 <= t < T + 2.6)
    for key, rig in (("hold_r", S["p1"]), ("hold_l", S["p2"])):
        pos, ang = cfg[key]
        rig.location = pos
        rig.rotation_euler = (0, 0, math.radians(ang))
        play(rig, S["pacts"], "hold_ladder", (t * FPS) % 60)
    if tilt is None:
        tilt = 25.0 if t < T else 25.0 * (1 - min(1.0, (t - T) / 0.8)) if t < T + 0.8 else 0.0
    S["nest"].rotation_euler = (0, math.radians(-tilt), 0)
    tit = S["tit"]
    for o in (tit, *tit.children_recursive):
        o.hide_render = t < T + 5.8
    tit.location = S["nest"].location + Vector((0, -0.12, -0.048))
    sc = bpy.context.scene
    sc.frame_set(0)
    for rig in (b, S["p1"], S["p2"]):
        ad = rig.animation_data
        # chaque squelette lit son propre instant: on décale la plage de l'action par une piste NLA
        f = rig["_frame"]
        act = ad.action
        ad.action = None
        for tr in list(ad.nla_tracks):
            ad.nla_tracks.remove(tr)
        tr = ad.nla_tracks.new()
        st = tr.strips.new("s", 0, act)
        st.action_slot = act.slots[0]
        st.action_frame_start = f
        st.action_frame_end = f + 1
        st.frame_end = 1
        st.extrapolation = "HOLD"
    sc.frame_set(0)


def shot(path, target, ortho, az, el, res=(640, 560), samples=16):
    for o in list(bpy.data.objects):
        if o.type == "CAMERA":
            bpy.data.objects.remove(o, do_unlink=True)
    lpl.setup_render(res, samples)
    lpl.iso_camera(target=target, ortho=ortho, azimuth=az, elevation=el)
    lpl.render(path)


def compose(paths, labels, out, cols=3, title=""):
    from PIL import Image, ImageDraw, ImageFont
    ims = [Image.open(p) for p in paths]
    w, h = ims[0].size
    rows = (len(ims) + cols - 1) // cols
    img = Image.new("RGB", (w * cols, h * rows + 36), (245, 243, 238))
    d = ImageDraw.Draw(img)
    f = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 17) if os.path.exists(
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf") else ImageFont.load_default(17)
    d.text((8, 8), title, fill=(20, 20, 20), font=f)
    for i, (im, lab) in enumerate(zip(ims, labels)):
        x, y = (i % cols) * w, 36 + (i // cols) * h
        img.paste(im, (x, y))
        d.text((x + 8, y + 6), lab, fill=(20, 20, 20), font=f)
    img.save(out)
    for p in paths:
        os.remove(p)
    print("PLANCHE", out)


def main():
    os.makedirs(OUT, exist_ok=True)
    S = build()
    tmp = os.path.join(OUT, "_ech")
    os.makedirs(tmp, exist_ok=True)
    T = 0.6 * PROPOSE["rungs"]
    seq = [(0.0, "0 s: Basile au pied, les deux tiennent"), (T / 2, f"{T / 2:.1f} s: il monte (climb_ladder)"),
           (T, f"{T:.1f} s: en haut, pieds à {RUNG * PROPOSE['rungs']:.2f} m"), (T + 0.3, f"{T + 0.3:.1f} s: reach_up, nichoir penché"),
           (T + 1.05, f"{T + 1.05:.2f} s: hammer_tap, choc"), (T + 6.2, f"{T + 6.2:.1f} s: nichoir droit, mésange sur le toit")]
    paths = []
    for i, (t, _) in enumerate(seq):
        setup(S, PROPOSE, t)
        p = os.path.join(tmp, f"seq{i}.png")
        shot(p, (-0.45, -0.45, 1.3), 4.6, 45, 35.264)
        paths.append(p)
    compose(paths, [s[1] for s in seq], os.path.join(OUT, "faune-echelle-sequence.png"),
            title="Échelle de Basile, proposition: au sud-ouest du chêne, tout abaissé de 0,56 m (3 barreaux): vue de jeu (azimut 45, 35 degrés)")
    zb = RUNG * PROPOSE["rungs"]
    views = [(T / 2, (-0.6, -0.6, 1.0), 2.4, 45, 6, "montée, de profil (sud-est): pieds sur les barreaux"),
             (T / 2, (-0.6, -0.6, 1.0), 2.4, 225, 10, "montée, de dos: mains aux montants"),
             (T + 0.3, (-0.25, -0.35, zb + 1.0), 1.3, 0, 15, "reach_up: main au coin du nichoir penché"),
             (T + 1.05, (-0.25, -0.35, zb + 1.1), 1.3, 80, 15, "hammer_tap: marteau sur le toit (choc)"),
             (0.0, (-0.55, -0.55, 0.8), 2.4, 225, 12, "hold_ladder: mains au montant (dos)"),
             (T + 1.05, (-0.45, -0.45, 1.4), 3.4, 135, 20, "vue opposée (nord-est), choc du marteau")]
    paths = []
    for i, (t, tg, o, az, el, _) in enumerate(views):
        setup(S, PROPOSE, t)
        p = os.path.join(tmp, f"pro{i}.png")
        shot(p, tg, o, az, el)
        paths.append(p)
    compose(paths, [v[5] for v in views], os.path.join(OUT, "faune-echelle-profil.png"),
            title="Échelle de Basile, vues rapprochées (GLB exportés)")
    paths = []
    for i, (t, az, el) in enumerate(((3.0, 45, 35.264), (3.0, 0, 10), (0.0, 0, 10))):
        setup(S, FICHE, t, tilt=25.0)
        p = os.path.join(tmp, f"ouest{i}.png")
        shot(p, (-0.7, 0, 1.7), 4.0, az, el)
        paths.append(p)
    compose(paths, ["fiche: échelle à l'ouest, vue de jeu", "fiche: de profil (sud), 3,0 s", "fiche: de profil, 0 s"],
            os.path.join(OUT, "faune-echelle-ouest.png"),
            title="Position de la fiche (pied en 51,47 ; 5,50): la branche ouest du chêne passe dans l'échelle et dans Basile")
    os.rmdir(tmp)


main()
