"""Rend un lot d'Aubrune (`sons_aubrune.py`, ou `sons_lot3.py` avec `--lot 3`) sans toucher au reste, puis mesure chaque
fichier décodé: durée, poids, part de l'énergie sous 300 Hz (haut-parleurs de portable) et
centroïde spectral (pour prouver que deux sons voisins se distinguent).

Usage: duo-python assets-src/son/mesurer_lot.py [--lot 3] [--sans-rendu]
Ensuite: duo-python assets-src/son/controler.py (sonie, crêtes, raccords; écrit mesures.csv).
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).parent))

import numpy as np  # noqa: E402

import dsp  # noqa: E402
import generer  # noqa: E402
import sons_aubrune  # noqa: E402
import sons_lot3  # noqa: E402

LOT = sons_lot3 if "--lot" in sys.argv and sys.argv[sys.argv.index("--lot") + 1] == "3" else sons_aubrune


def spectre(x: np.ndarray) -> tuple[float, float]:
    p = np.abs(np.fft.rfft(x)) ** 2
    f = np.fft.rfftfreq(len(x), 1 / dsp.SR)
    total = float(np.sum(p)) + 1e-20
    return float(np.sum(p[f < 300]) / total), float(np.sum(f * p) / total)


def main() -> int:
    if "--sans-rendu" not in sys.argv:
        for nom, fab in LOT.fichiers():
            generer.ecrire("effets", nom, fab(generer.rng(nom)))
    print("fichier;duree_s;ko;sous_300hz;centroide_hz")
    total = 0
    for nom, _ in LOT.fichiers():
        f = generer.SORTIE / "effets" / f"{nom}.ogg"
        x = dsp.mono(dsp.decoder(f, 1))
        bas, centre = spectre(x)
        ko = f.stat().st_size / 1024
        total += f.stat().st_size
        print(f"{nom};{len(x) / dsp.SR:.2f};{ko:.1f};{bas * 100:.0f} %;{centre:.0f}")
    print(f"total;;{total / 1024:.0f}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
