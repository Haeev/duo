"""Sens d'ouverture des vantaux de village013.glb (bibliothèque standard, sans Blender).

Le rendu ouvre un vantail `<x>_door` en multipliant sa rotation de repos par une rotation de +80 degrés autour de
l'axe vertical (interieurs.ts). Pour chaque vantail: milieu du vantail (boîte de son maillage) fermé et ouvert,
dans le repère du bâtiment; il doit entrer dans le bâtiment (s'éloigner du mur vers le centre).

Lancer: python3 verifier/vantaux_013.py [fichier.glb]
"""
import json
import math
import os
import struct
import sys

ICI = os.path.dirname(os.path.abspath(__file__))
GLB = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ICI, "..", "..", "..", "assets", "modeles", "village013.glb")


def qmul(a, b):
    ax, ay, az, aw = a
    bx, by, bz, bw = b
    return (aw * bx + ax * bw + ay * bz - az * by, aw * by - ax * bz + ay * bw + az * bx,
            aw * bz + ax * by - ay * bx + az * bw, aw * bw - ax * bx - ay * by - az * bz)


def qrot(q, v):
    x, y, z, w = q
    p = (v[0], v[1], v[2], 0.0)
    r = qmul(qmul(q, p), (-x, -y, -z, w))
    return r[:3]


data = open(GLB, "rb").read()
n = struct.unpack("<I", data[12:16])[0]
gl = json.loads(data[20:20 + n])
bad = 0
for root in gl["nodes"]:
    for ci in root.get("children", []):
        node = gl["nodes"][ci]
        if not node["name"].endswith("_door") or "mesh" not in node:
            continue
        acc = gl["accessors"][gl["meshes"][node["mesh"]]["primitives"][0]["attributes"]["POSITION"]]
        c = [(a + b) / 2 for a, b in zip(acc["min"], acc["max"])]
        t = node.get("translation", [0, 0, 0])
        q = tuple(node.get("rotation", [0, 0, 0, 1]))
        h = math.radians(40)
        turn = (0.0, math.sin(h), 0.0, math.cos(h))
        closed = [a + b for a, b in zip(qrot(q, c), t)]
        opened = [a + b for a, b in zip(qrot(qmul(q, turn), c), t)]
        # le mur du vantail: celui dont le milieu fermé est le plus loin du centre selon x ou z
        axis = 0 if abs(closed[0]) > abs(closed[2]) else 2
        inward = abs(opened[axis]) < abs(closed[axis])
        bad += not inward
        print(f"{root['name']:>14} {node['name']:<20} fermé x {closed[0]:6.2f} z {closed[2]:6.2f}  ouvert x "
              f"{opened[0]:6.2f} z {opened[2]:6.2f}  {'vers dedans' if inward else 'VERS DEHORS'}")
print("vantaux qui s'ouvrent dehors:", bad)
sys.exit(1 if bad else 0)
