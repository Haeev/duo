"""Contrôle de lisibilité: taux de pixels d'encre par bloc de 64 px d'une capture.
Usage: duo-python taux_noir.py capture.png [...]
Un pixel compte comme encre si sa luminance (0 à 1) est sous 0,22. Règle de l'essai: aucun bloc
au-dessus d'un tiers hors des ombres pleines voulues."""
import sys
import numpy as np
from PIL import Image

for path in sys.argv[1:]:
    a = np.asarray(Image.open(path).convert('RGB'), dtype=np.float32) / 255
    luma = a @ np.array([0.299, 0.587, 0.114], dtype=np.float32)
    ink = luma < 0.22
    h, w = ink.shape
    rates = [ink[y:y + 64, x:x + 64].mean() for y in range(0, h - 63, 64) for x in range(0, w - 63, 64)]
    rates = np.array(rates)
    print(f"{path.split('/')[-1]}: moyenne {rates.mean():.3f}, mediane {np.median(rates):.3f}, max {rates.max():.3f}, "
          f"blocs au-dessus d'un tiers {int((rates > 1 / 3).sum())}/{len(rates)}, au-dessus d'un quart {int((rates > 0.25).sum())}")
