"""Os des doigts et poses de main des personnages Meshy (duo-python: numpy et mathutils de Blender 5.2).

Usage: duo-python doigts.py [id...]      (sans argument: les 15 personnages de conformer.py)

À lancer après `conformer.py` (qui refait les GLB sans doigts). Relançable: les os et poses d'un passage précédent sont
d'abord retirés (poids rendus à la main), puis recalculés. Le GLB est modifié directement (module `glb.py`): maillage,
texture, os existants et clips (walk, idle, sit, drink, sit_drink) restent identiques à l'octet près; seuls s'ajoutent
12 nœuds, 12 articulations, les poids des doigts et trois clips de pose.

Par main (côté `Right` ou `Left`), 6 os enfants de l'os de la main:
  <Côté>HandThumb1 -> <Côté>HandThumb2      pouce (premier segment depuis la base du pouce sur la paume, puis le bout)
  <Côté>HandIndex1 -> <Côté>HandIndex2      index (depuis la jointure, puis de la deuxième phalange au bout)
  <Côté>HandFingers1 -> <Côté>HandFingers2  majeur, annulaire et auriculaire ensemble
Repère de chaque os des doigts: Y le long du segment (vers le bout), Z vers l'intérieur de la paume, X = Y x Z.
Flexion = rotation autour de X local, positive = vers la paume (mêmes signes à droite et à gauche). Pouce: en plus,
rotation autour de Z local (positive: vers l'index à droite, à l'opposé à gauche).

Repères posés sur le maillage réel: nuage des sommets de la main dans le repère de l'os de la main (a le long de la
main, n normale de la paume vers l'extérieur de la paume, t = a x n), doigts séparés par regroupement sur t au bout de
la main, jointures au départ de la palmure, pouce = sommets au-delà de l'index côté pouce.
Poids: seule la part de la main est redistribuée (avant-bras et poignet intacts), transition douce sur 8 mm autour de
chaque articulation, doigt le plus proche pour la palmure; 4 influences au plus par sommet.

Poses (clips de deux clés identiques à 0 et 0,1 s, sur les 12 os des doigts seulement):
  relaxed      les deux mains détendues, légèrement fermées (pose de repos, à la place des doigts tendus)
  grip_handle  main droite refermée sur l'anse de `ware_cup_cappuccino`, main gauche `relaxed`
  grip_glass   main droite en C autour de `ware_glass`, main gauche `relaxed`
Les poses de prise sont calculées sur la vraie vaisselle: le récipient est posé dans le repère de la main, puis chaque
doigt se ferme par pas de 1 degré jusqu'au contact (sans traversée, test par arbres BVH), dans la limite d'un angle
maximal. La place du récipient dans la main (repère métrique de l'os RightHand) est écrite dans le rapport
`<id>.doigts.json` (champ `prises`) puis dans `modeles.json`.
"""
import json
import math
import os
import sys

import bpy  # noqa: F401  (charge mathutils)
import numpy as np
from mathutils import Matrix, Quaternion, Vector
from mathutils.bvhtree import BVHTree

ICI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, ICI)
from glb import Glb, mat4  # noqa: E402

ASSETS = os.path.normpath(os.path.join(ICI, "..", "..", "..", "assets", "modeles"))
IDS = ["char_simone", "char_mathis", "char_lise", "char_farida", "char_bastien", "char_client_etudiante",
       "char_client_teletravail", "char_client_brunch", "char_client_connaisseur", "char_client_gourmand",
       "char_client_flaneur", "char_client_voisine", "char_client_pressee", "char_avatar_1", "char_avatar_2"]
SIDES = ("Right", "Left")
CHAINS = ("Thumb", "Index", "Fingers")
BONES = [f"{s}Hand{c}{k}" for s in SIDES for c in CHAINS for k in (1, 2)]
POSES = ("relaxed", "grip_handle", "grip_glass")
# angles en degrés: (flexion autour de X, rotation autour de Z) par segment
RELAXED = {"Thumb1": (8, 6), "Thumb2": (12, 0), "Index1": (12, 0), "Index2": (22, 0), "Fingers1": (18, 0), "Fingers2": (30, 0)}
BLEND = 0.008  # demi-largeur de la transition des poids autour d'une articulation (m)


def smooth(x):
    x = np.clip(x, 0.0, 1.0)
    return x * x * (3 - 2 * x)


def read_body(path):
    """Maillage du récipient (sans le contenu `_liquid`) en mètres, repère du modèle."""
    g = Glb(path)
    pr = g.g["meshes"][0]["primitives"][0]
    return g.read(pr["attributes"]["POSITION"]).astype(np.float64), g.read(pr["indices"]).reshape(-1, 3)


# --- retrait d'un passage précédent ---------------------------------------------------------------

def strip(g):
    nodes = g.g["nodes"]
    old = [i for i, n in enumerate(nodes) if n.get("name") in BONES]
    if not old:
        return
    keep = len(nodes) - len(old)
    if min(old) != keep:
        raise SystemExit("os des doigts attendus en fin de liste des nœuds")
    sk = g.g["skins"][0]
    joints = sk["joints"]
    jmap = {}
    for ji, ni in enumerate(joints):
        if ni in old:
            hand = nodes[ni]["name"].split("Hand")[0] + "Hand"
            jmap[ji] = joints.index(g.node(hand))
    nj = len(joints) - len(jmap)
    for m in g.g["meshes"]:
        for pr in m["primitives"]:
            J = g.read(pr["attributes"]["JOINTS_0"]).astype(np.int64)
            W = g.read(pr["attributes"]["WEIGHTS_0"]).astype(np.float64)
            for a, b in jmap.items():
                J[J == a] = b
            J, W = merge_top4(J, W)
            pr["attributes"]["JOINTS_0"] = g.add(J.astype(np.uint8), 34962)
            pr["attributes"]["WEIGHTS_0"] = g.add(W.astype(np.float32), 34962)
    ibm = g.read(sk["inverseBindMatrices"])[:nj]
    sk["inverseBindMatrices"] = g.add(ibm.astype(np.float32))
    sk["joints"] = joints[:nj]
    for n in nodes:
        if "children" in n:
            n["children"] = [c for c in n["children"] if c < keep]
            if not n["children"]:
                del n["children"]
    g.g["nodes"] = nodes[:keep]
    g.g["animations"] = [a for a in g.g["animations"] if a["name"] not in POSES]


def merge_top4(J, W):
    """Fusionne les doublons d'articulation par sommet, garde les 4 plus forts, renormalise."""
    outJ = np.zeros((len(J), 4), dtype=np.int64)
    outW = np.zeros((len(J), 4), dtype=np.float64)
    for i in range(len(J)):
        acc = {}
        for j, w in zip(J[i], W[i]):
            if w > 0:
                acc[int(j)] = acc.get(int(j), 0.0) + float(w)
        best = sorted(acc.items(), key=lambda x: -x[1])[:4]
        s = sum(w for _, w in best) or 1.0
        for k, (j, w) in enumerate(best):
            outJ[i, k] = j
            outW[i, k] = w / s
    return outJ, outW


# --- repères de la main -----------------------------------------------------------------------------

def hand_frame(Hm, L):
    """Base directe (a, t, n) dans le repère métrique de l'os, par analyse en composantes principales des sommets de
    la main (L): a le long de la main (vers le bout des doigts), n normale de la paume (axe le plus mince, du côté de
    la paume: vers le bas en liaison, bras en croix), t = n x a."""
    c = L.mean(0)
    _, _, vt = np.linalg.svd(L - c)
    a, n = vt[0], vt[2]
    if a[1] < 0:
        a = -a
    down = Hm[:3, :3].T @ np.array([0.0, -1.0, 0.0])
    if n.dot(down) < 0:
        n = -n
    n = n - a * n.dot(a)
    n /= np.linalg.norm(n)
    t = np.cross(n, a)
    return a, t, n


def kmeans1d(x, k):
    c = np.quantile(x, [(i + 0.5) / k for i in range(k)])
    for _ in range(50):
        lab = np.argmin(np.abs(x[:, None] - c[None, :]), 1)
        c = np.array([x[lab == i].mean() if np.any(lab == i) else c[i] for i in range(k)])
    return np.sort(c)


def landmarks(A, sel, thumb_sign, I):
    """Points des articulations (coordonnées a, t, n en mètres) depuis le nuage A des sommets de la main."""
    pa, pt, pn = A[:, 0], A[:, 1] * thumb_sign, A[:, 2]
    amax = pa[sel].max()
    tips = sel & (pa > 0.70 * amax)
    centers = kmeans1d(pt[tips], 4)  # auriculaire ... index (t croissant vers le pouce)
    spacing = np.median(np.diff(centers))
    fingers = []
    for c in centers:
        m = sel & (np.abs(pt - c) < spacing * 0.5) & (pa > 0.55 * amax)
        fingers.append({"t": c, "tip_a": pa[m].max()})
    t_idx, t_mid = centers[3], centers[2]
    # jointures (métacarpo-phalangiennes) à 56 % de la longueur poignet-bout du majeur: proportion de la main humaine,
    # plus sûre que la palmure sur ces maillages où les doigts se touchent parfois
    a_k = 0.56 * fingers[2]["tip_a"]
    web = a_k + 0.012

    def center_at(a0, tc, half):
        for k in (1.0, 1.5, 2.0, 3.0, 4.0):
            m = sel & (np.abs(pa - a0) < 0.004 * k) & (np.abs(pt - tc) < half * k)
            if m.sum() >= 2:
                break
        return np.array([a0, pt[m].mean(), (pn[m].min() + pn[m].max()) / 2])

    pts = {}
    # index
    tip = fingers[3]["tip_a"]
    for name, a0 in (("Index1", a_k), ("Index2", a_k + 0.45 * (tip - a_k)), ("IndexTip", tip - 0.004)):
        pts[name] = center_at(a0, t_idx, spacing * 0.5)
    # majeur, annulaire, auriculaire: axe moyen de la main restante
    tipf = np.mean([f["tip_a"] for f in fingers[:3]])
    tcf = np.mean(centers[:3])
    half = (centers[2] - centers[0]) / 2 + spacing * 0.5
    for name, a0 in (("Fingers1", a_k), ("Fingers2", a_k + 0.45 * (tipf - a_k)), ("FingersTip", tipf - 0.004)):
        pts[name] = center_at(a0, tcf, half)
    # pouce: sommets au-delà de l'index côté pouce, sous la palmure
    th = sel & (pt > t_idx + 0.25 * spacing) & (pa < a_k - 0.005)
    P = np.stack([pa[th], pt[th], pn[th]], 1)
    c = P.mean(0)
    u = np.linalg.svd(P - c)[2][0]
    if u[0] + u[1] < 0:
        u = -u
    s = (P - c) @ u
    tipT = c + u * (s.max() - 0.004)
    baseT = c + u * s.min()
    # base du pouce: un peu dans la paume, côté pouce de l'index (pivot de l'articulation)
    base = baseT + u * 0.004
    pts["Thumb1"] = base
    pts["Thumb2"] = base + (tipT - base) * 0.5
    pts["ThumbTip"] = tipT
    for k in pts:
        pts[k] = pts[k] * np.array([1.0, thumb_sign, 1.0])
    return pts, {"amax": amax, "web": web, "knuckle": a_k, "spacing": spacing, "thumb_verts": int(th.sum())}


def seg_frame(p0, p1, n):
    y = p1 - p0
    y /= np.linalg.norm(y)
    z = n - y * n.dot(y)
    z /= np.linalg.norm(z)
    x = np.cross(y, z)
    return np.stack([x, y, z], 1)  # colonnes: axes locaux dans le repère (a, t, n)


def seg_dist(P, p0, p1):
    d = p1 - p0
    s = np.clip(((P - p0) @ d) / d.dot(d), 0, 1)
    return np.linalg.norm(P - (p0 + s[:, None] * d), axis=1), s


# --- traitement d'un personnage -------------------------------------------------------------------------

def process(ident, cup, glass):
    path = os.path.join(ASSETS, ident + ".glb")
    g = Glb(path)
    strip(g)
    nodes = g.g["nodes"]
    sk = g.g["skins"][0]
    joints = list(sk["joints"])
    ibm = g.read(sk["inverseBindMatrices"]).astype(np.float64)
    prims = g.g["meshes"][0]["primitives"]
    report = {"asset": ident, "os": {}, "poses": {}, "prises": {}, "reperes": {}}
    new_nodes = []
    new_ibm = []
    weights = []  # par primitive: (J, W) modifiés
    data = []
    for pr in prims:
        data.append({"P": g.read(pr["attributes"]["POSITION"]).astype(np.float64),
                     "J": g.read(pr["attributes"]["JOINTS_0"]).astype(np.int64),
                     "W": g.read(pr["attributes"]["WEIGHTS_0"]).astype(np.float64),
                     "I": g.read(pr["indices"]).reshape(-1, 3)})
    hands = {}
    for side in SIDES:
        hj = joints.index(g.node(side + "Hand"))
        H = np.linalg.inv(mat4(ibm[hj]))  # liaison de l'os de la main, repère du maillage
        unit = np.linalg.norm(H[:3, 0])  # 0,01: l'os est en centimètres
        Hm = H.copy()
        Hm[:3, :3] /= unit  # repère métrique de l'os (même origine, axes unitaires)
        Hmi = np.linalg.inv(Hm)
        d0 = data[0]
        L = (Hmi[:3, :3] @ d0["P"].T).T + Hmi[:3, 3]
        wh = (d0["W"] * (d0["J"] == hj)).sum(1)
        sel = wh > 0.5
        a, t, n = hand_frame(Hm, L[sel])
        B = np.stack([a, t, n], 1)  # (a, t, n) -> repère de l'os
        A = L @ B
        # côté du pouce: celui où la moitié basse de la main déborde le plus de l'axe des doigts
        amax = A[sel, 0].max()
        tm = np.median(A[sel & (A[:, 0] > 0.75 * amax), 1])
        low = sel & (A[:, 0] < 0.6 * amax)
        thumb_sign = 1.0 if A[low, 1].max() - tm > tm - A[low, 1].min() else -1.0
        pts, info = landmarks(A, sel, thumb_sign, d0["I"])
        report["reperes"][side] = {k: round(float(v), 4) for k, v in info.items()}
        report["reperes"][side]["signe_pouce"] = thumb_sign
        hands[side] = {"spacing": info["spacing"], "hj": hj, "H": H, "Hm": Hm, "unit": unit, "B": B, "pts": pts, "A": A, "sign": thumb_sign}
        # os: repère local dans (a, t, n), puis dans le repère de l'os de la main
        frames = {}
        for c in CHAINS:
            p1, p2, tip = pts[c + "1"], pts[c + "2"], pts[c + "Tip"]
            nn = np.array([0.0, 0.0, 1.0])
            frames[c + "1"] = (p1, seg_frame(p1, p2, nn))
            frames[c + "2"] = (p2, seg_frame(p2, tip, nn))
        hands[side]["frames"] = frames
        for c in CHAINS:
            parent_world = np.eye(4)  # dans le repère de l'os de la main (unités de l'os)
            parent_idx = g.node(side + "Hand")
            for k in (1, 2):
                p, R = frames[f"{c}{k}"]
                Mloc = np.eye(4)
                Mloc[:3, :3] = B @ R
                Mloc[:3, 3] = (B @ p) / unit
                local = np.linalg.inv(parent_world) @ Mloc
                q = Matrix(local[:3, :3].tolist()).to_quaternion()
                name = f"{side}Hand{c}{k}"
                node = {"name": name, "rotation": [q.x, q.y, q.z, q.w], "translation": [float(x) for x in local[:3, 3]]}
                idx = len(nodes)
                nodes.append(node)
                new_nodes.append(node)
                nodes[parent_idx].setdefault("children", []).append(idx)
                new_ibm.append(np.linalg.inv(H @ Mloc))
                report["os"][name] = {"parent": nodes[parent_idx]["name"],
                                      "longueur_m": round(float(np.linalg.norm((pts[f"{c}2"] if k == 1 else pts[c + "Tip"]) - p)), 4)}
                joints.append(idx)
                parent_world = Mloc
                parent_idx = idx
    # --- poids ---
    jbase = len(sk["joints"])
    for di, d in enumerate(data):
        J, W = d["J"], d["W"]
        addJ, addW = [], []
        for si, side in enumerate(SIDES):
            h = hands[side]
            L = (np.linalg.inv(h["Hm"])[:3, :3] @ d["P"].T).T + np.linalg.inv(h["Hm"])[:3, 3]
            A = L @ h["B"]
            wh = (W * (J == h["hj"])).sum(1)
            pts = h["pts"]
            dist = []
            for c in CHAINS:
                d1, _ = seg_dist(A, pts[c + "1"], pts[c + "2"])
                d2, _ = seg_dist(A, pts[c + "2"], pts[c + "Tip"])
                dist.append(np.minimum(d1, d2))
            dist = np.stack(dist, 1)
            near = np.argmin(dist, 1)
            # part du doigt le plus proche: projection sur l'axe du premier segment, transition autour de la jointure
            share = np.zeros((len(A), 6))
            for ci, c in enumerate(CHAINS):
                p1, p2, tip = pts[c + "1"], pts[c + "2"], pts[c + "Tip"]
                u1 = (p2 - p1) / np.linalg.norm(p2 - p1)
                u2 = (tip - p2) / np.linalg.norm(tip - p2)
                s1 = (A - p1) @ u1
                s2 = (A - p2) @ u2
                f = smooth((s1 + BLEND) / (2 * BLEND))
                f2 = smooth((s2 + BLEND * 0.75) / (1.5 * BLEND))
                on = (near == ci) & (dist[:, ci] < 0.035)
                share[:, ci * 2] = np.where(on, f * (1 - f2), 0)
                share[:, ci * 2 + 1] = np.where(on, f * f2, 0)
            for k in range(6):
                jidx = jbase + si * 6 + k
                addJ.append(np.full(len(A), jidx))
                addW.append(wh * share[:, k])
            # la main garde le reste de sa part
            keep = 1 - share.sum(1)
            W = np.where(J == h["hj"], W * keep[:, None], W)
        J2 = np.concatenate([J, np.stack(addJ, 1)], 1)
        W2 = np.concatenate([W, np.stack(addW, 1)], 1)
        J3, W3 = merge_top4(J2, W2)
        d["J2"], d["W2"] = J3, W3
        prims[di]["attributes"]["JOINTS_0"] = g.add(J3.astype(np.uint8), 34962)
        prims[di]["attributes"]["WEIGHTS_0"] = g.add(W3.astype(np.float32), 34962)
    all_ibm = np.concatenate([ibm, np.array([m.T.ravel() for m in new_ibm])], 0)
    sk["inverseBindMatrices"] = g.add(all_ibm.astype(np.float32))
    sk["joints"] = joints

    # --- poses ---
    ctx = {"g": g, "hands": hands, "data": data, "jbase": jbase}
    # rotation Z du pouce vers l'index: signe opposé au côté du pouce sur t (voir l'en-tête)
    rel = {f"{sd}Hand{k}": (RELAXED[k][0], -hands[sd]["sign"] * RELAXED[k][1]) for sd in SIDES for k in RELAXED}
    poses = {"relaxed": rel}
    gh, place_h = fit_handle(ctx, cup)
    gg, place_g = fit_glass(ctx, glass)
    # segments que la prise n'a pas eu à fermer: droits (0), comme pendant l'essai de contact
    zero = {f"RightHand{c}{k}": (0.0, 0.0) for c in CHAINS for k in (1, 2)}
    gh, gg = dict(zero, **gh), dict(zero, **gg)
    poses["grip_handle"] = dict(rel, **gh)
    poses["grip_glass"] = dict(rel, **gg)
    report["prises"] = {"grip_handle": place_h, "grip_glass": place_g}
    for pname, angles in poses.items():
        chans, samplers = [], []
        times = g.add(np.array([0.0, 0.1], dtype=np.float32), minmax=True)
        out = {}
        for bi, name in enumerate(BONES):
            node = nodes[g.node(name)]
            fx, fz = angles[name]
            q = rest_q(node) @ delta_q(fx, fz)
            q.normalize()
            vals = np.array([[q.x, q.y, q.z, q.w]] * 2, dtype=np.float32)
            samplers.append({"input": times, "interpolation": "STEP", "output": g.add(vals)})
            chans.append({"sampler": len(samplers) - 1, "target": {"node": g.node(name), "path": "rotation"}})
            out[name] = {"flexion_x_deg": fx, "rotation_z_deg": fz, "quaternion_local_xyzw": [round(v, 6) for v in (q.x, q.y, q.z, q.w)]}
        g.g["animations"].append({"name": pname, "channels": chans, "samplers": samplers})
        report["poses"][pname] = out
    g.save(path)
    report["file_bytes"] = os.path.getsize(path)
    report["os_total"] = len(joints)
    with open(os.path.join(ICI, ident + ".doigts.json"), "w", encoding="utf-8") as fh:
        json.dump(report, fh, ensure_ascii=False, indent=1)
        fh.write("\n")
    return report


def rest_q(node):
    x, y, z, w = node["rotation"]
    return Quaternion((w, x, y, z))


def delta_q(fx, fz):
    return Quaternion((1, 0, 0), math.radians(fx)) @ Quaternion((0, 0, 1), math.radians(fz))


# --- main posée (repère métrique (a, t, n) de la main), pour les essais de contact ---------------------------

def posed_hand(ctx, side, angles):
    """Sommets de la main (part de la main et des doigts) posés, en coordonnées (a, t, n) métriques."""
    h = ctx["hands"][side]
    B = h["B"]
    d = ctx["data"][0]
    Hmi = np.linalg.inv(h["Hm"])
    L = (Hmi[:3, :3] @ d["P"].T).T + Hmi[:3, 3]
    A = L @ B
    # matrices des os des doigts dans (a, t, n): repos R, posé R'
    mats = {}
    for c in CHAINS:
        parent_rest = np.eye(4)
        parent_pose = np.eye(4)
        for k in (1, 2):
            p, R = h["frames"][f"{c}{k}"]
            rest = np.eye(4)
            rest[:3, :3] = R
            rest[:3, 3] = p
            local_rest = np.linalg.inv(parent_rest) @ rest
            fx, fz = angles.get(f"{side}Hand{c}{k}", (0, 0))
            D = np.eye(4)
            D[:3, :3] = np.array(delta_q(fx, fz).to_matrix())
            pose = parent_pose @ local_rest @ D
            mats[f"{c}{k}"] = pose @ np.linalg.inv(rest)
            parent_rest, parent_pose = rest, pose
    si = SIDES.index(side)
    J, W = d["J2"], d["W2"]
    names = [f"{c}{k}" for c in CHAINS for k in (1, 2)]
    fw = np.zeros(len(A))
    for slot in range(4):
        fw += np.where((J[:, slot] >= ctx["jbase"] + si * 6) & (J[:, slot] < ctx["jbase"] + si * 6 + 6), W[:, slot], 0)
    # tout ce qui n'est pas un doigt reste fixe dans le repère de la main
    out = A * (1 - fw)[:, None]
    tot = (W * (J == h["hj"])).sum(1) + fw
    for slot in range(4):
        j = J[:, slot]
        w = W[:, slot]
        for k, nm in enumerate(names):
            m = (j == ctx["jbase"] + si * 6 + k)
            if m.any():
                M = mats[nm]
                out[m] += w[m, None] * ((M[:3, :3] @ A[m].T).T + M[:3, 3])
    hand_part = tot > 0.5
    return out, hand_part


def bvh_of(V, I, mask=None):
    if mask is not None:
        I = I[mask[I].all(1)]
    return BVHTree.FromPolygons([Vector(v) for v in V], [tuple(int(x) for x in f) for f in I])


def chain_mask(ctx, side, chains):
    h = ctx["hands"][side]
    d = ctx["data"][0]
    si = SIDES.index(side)
    ids = [ctx["jbase"] + si * 6 + CHAINS.index(c) * 2 + k for c in chains for k in (0, 1)]
    return (np.isin(d["J2"], ids) * d["W2"]).sum(1) > 0.35


def close_until_contact(ctx, side, angles, vessel_bvh, chain, seg_max, axis=0, mask_chains=None, direction=1):
    """Ferme un doigt (segment 1 puis 2) par pas de 1 degré jusqu'au contact avec le récipient."""
    I = ctx["data"][0]["I"]
    mask = chain_mask(ctx, side, mask_chains or [chain])
    contact = False
    for k, amax in ((1, seg_max[0]), (2, seg_max[1])):
        key = f"{side}Hand{chain}{k}"
        base = list(angles.get(key, (0, 0)))
        for step in range(0, int(amax - abs(base[axis])) + 1):
            trial = dict(angles)
            v = list(base)
            v[axis] = base[axis] + direction * step
            trial[key] = tuple(v)
            V, _ = posed_hand(ctx, side, trial)
            if bvh_of(V, I, mask).overlap(vessel_bvh):
                contact = True
                break
            angles = trial
    return angles, contact


def vessel_in_hand(V, I, R, p):
    """Sommets du récipient (repère du modèle, m) placés dans (a, t, n) par rotation R et position p."""
    return (R @ V.T).T + p, I


def hand_overlap(ctx, side, angles, VV, II):
    V, part = posed_hand(ctx, side, angles)
    I = ctx["data"][0]["I"]
    vb = bvh_of(VV, II)
    return len(bvh_of(V, I, part).overlap(vb)), vb


def to_bone(ctx, side, R, p):
    """(rotation, position) du récipient dans le repère métrique de l'os de la main (pour le jeu)."""
    B = ctx["hands"][side]["B"]
    Rb = B @ R
    pb = B @ p
    q = Matrix(Rb.tolist()).to_quaternion()
    return {"position_m": [round(float(x), 4) for x in pb], "quaternion_xyzw": [round(v, 6) for v in (q.x, q.y, q.z, q.w)]}


def fit_handle(ctx, cup):
    side = "Right"
    h = ctx["hands"][side]
    s = h["sign"]
    pts = h["pts"]
    V, I = cup
    # repère de la tasse dans (a, t, n): X (anse) = -n, Y (haut) = t côté pouce, Z = -a
    R = np.stack([np.array([0, 0, -1.0]), np.array([0, s, 0.0]), np.array([-1.0, 0, 0])], 1)
    if np.linalg.det(R) < 0:
        R[:, 2] *= -1
    # barre de l'anse (x 0,074 à 0,083, y 0,023 à 0,070) contre la paume juste sous les jointures, entre index et majeur
    bar = np.array([0.0785, 0.0465, 0.0])
    Vh, part = posed_hand(ctx, side, {})
    near_k = part & (np.abs(Vh[:, 0] - pts["Index1"][0]) < 0.012) & (np.abs(Vh[:, 1] - pts["Index1"][1]) < 0.012)
    palm_n = Vh[near_k, 2].max() if near_k.any() else pts["Index1"][2] + 0.01
    target = np.array([pts["Index1"][0] - 0.004, pts["Index1"][1] - s * 0.5 * h["spacing"], palm_n + 0.0045 + 0.004])
    p = target - R @ bar
    angles = {}
    VV, II = vessel_in_hand(V, I, R, p)
    n_ov, vb = hand_overlap(ctx, side, angles, VV, II)
    # si la paume touche déjà, on écarte la tasse par pas de 1 mm
    tries = 0
    while n_ov and tries < 30:
        p = p + np.array([0, 0, 0.001])
        VV, II = vessel_in_hand(V, I, R, p)
        n_ov, vb = hand_overlap(ctx, side, angles, VV, II)
        tries += 1
    angles, c_i = close_until_contact(ctx, side, angles, vb, "Index", (100, 100))
    angles, c_f = close_until_contact(ctx, side, angles, vb, "Fingers", (100, 110))
    # pouce: d'abord vers l'index (Z), puis posé sur l'anse (X)
    angles, c_tz = close_until_contact(ctx, side, angles, vb, "Thumb", (35, 0), axis=1, direction=-s)
    angles, c_tx = close_until_contact(ctx, side, angles, vb, "Thumb", (45, 40))
    final, _ = hand_overlap(ctx, side, angles, VV, II)
    place = to_bone(ctx, side, R, p)
    place.update({"modele": "ware_cup_cappuccino", "contacts": {"index": c_i, "majeur_annulaire_auriculaire": c_f, "pouce": c_tx or c_tz},
                  "traversees": final, "point_de_prise_anse_m": [round(float(x), 4) for x in (h["B"] @ target)],
                  "note": "point de prise: milieu de la barre extérieure de l'anse (0,0785; 0,0465; 0) dans le repère de la tasse"})
    return {k: (round(v[0], 1), round(v[1], 1)) for k, v in angles.items()}, place


def fit_glass(ctx, glass):
    side = "Right"
    h = ctx["hands"][side]
    s = h["sign"]
    pts = h["pts"]
    V, I = glass
    R = np.stack([np.array([0, 0, -1.0]), np.array([0, s, 0.0]), np.array([-1.0, 0, 0])], 1)
    if np.linalg.det(R) < 0:
        R[:, 2] *= -1
    radius = 0.04
    Vh, part = posed_hand(ctx, side, {})
    a_c = pts["Index1"][0] - 0.022
    palm = part & (np.abs(Vh[:, 0] - a_c) < 0.012)
    palm_n = Vh[palm, 2].max()
    t_c = (pts["Index1"][1] + pts["Fingers1"][1]) / 2
    center = np.array([a_c, t_c, palm_n + radius + 0.002])
    # le verre (axe vertical = t) tenu au tiers de sa hauteur (13 cm)
    p = center - R @ np.array([0.0, 0.05, 0.0])
    VV, II = vessel_in_hand(V, I, R, p)
    n_ov, vb = hand_overlap(ctx, side, {}, VV, II)
    tries = 0
    while n_ov and tries < 30:
        p = p + np.array([0, 0, 0.001])
        VV, II = vessel_in_hand(V, I, R, p)
        n_ov, vb = hand_overlap(ctx, side, {}, VV, II)
        tries += 1
    angles = {}
    angles, c_i = close_until_contact(ctx, side, angles, vb, "Index", (70, 70))
    angles, c_f = close_until_contact(ctx, side, angles, vb, "Fingers", (70, 75))
    angles, c_t = close_until_contact(ctx, side, angles, vb, "Thumb", (45, 40))
    final, _ = hand_overlap(ctx, side, angles, VV, II)
    place = to_bone(ctx, side, R, p)
    place.update({"modele": "ware_glass", "contacts": {"index": c_i, "majeur_annulaire_auriculaire": c_f, "pouce": c_t}, "traversees": final})
    return {k: (round(v[0], 1), round(v[1], 1)) for k, v in angles.items()}, place


def main():
    cup = read_body(os.path.join(ASSETS, "ware_cup_cappuccino.glb"))
    glass = read_body(os.path.join(ASSETS, "ware_glass.glb"))
    for ident in sys.argv[1:] or IDS:
        r = process(ident, cup, glass)
        gh = r["prises"]["grip_handle"]
        gg = r["prises"]["grip_glass"]
        print(f"{ident}: {r['os_total']} os, {r['file_bytes']} octets; anse: contacts {gh['contacts']} traversées {gh['traversees']}; "
              f"verre: contacts {gg['contacts']} traversées {gg['traversees']}")


main()
