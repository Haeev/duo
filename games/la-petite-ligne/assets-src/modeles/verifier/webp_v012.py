"""Passe les planches PNG de planche_v012.py en WebP (qualité 82) dans le dossier des captures.

Lancer: duo-python verifier/webp_v012.py <dossier des PNG> <dossier de sortie>
"""
import os
import sys

from PIL import Image

src, out = sys.argv[1:3]
os.makedirs(out, exist_ok=True)
for f in sorted(os.listdir(src)):
    if f.endswith(".png"):
        dst = os.path.join(out, f[:-4] + ".webp")
        Image.open(os.path.join(src, f)).convert("RGB").save(dst, quality=82)
        print(dst, os.path.getsize(dst))
