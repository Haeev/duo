"""Contrôle par la mesure des sons livrés (écoute impossible ici).

Pour chaque OGG de `assets/commun/son/`: durée, sonie intégrée et momentanée maximale (ebur128 de
ffmpeg), crête, et pour les boucles le saut au raccord comparé aux sauts ordinaires.
Écrit `assets-src/son/mesures.csv`. Échoue si une crête dépasse -1 dBFS ou si une boucle a un
raccord audible. Usage: duo-python assets-src/son/controler.py
"""

from __future__ import annotations

import re
import subprocess
import sys
from pathlib import Path

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).parent))

import numpy as np  # noqa: E402

import dsp  # noqa: E402

RACINE = Path(__file__).resolve().parents[2]
SONS = RACINE / "assets" / "commun" / "son"


def ebur128(fichier: Path) -> dict[str, float]:
    sortie = subprocess.run(
        ["ffmpeg", "-hide_banner", "-nostats", "-i", str(fichier), "-af", "apad=pad_dur=1,ebur128=peak=true", "-f", "null", "-"],
        capture_output=True, text=True, check=True).stderr
    bloc = sortie[sortie.rindex("Summary:"):]
    integre = float(re.search(r"I:\s+(-?[\d.]+) LUFS", bloc).group(1))
    crete = float(re.search(r"Peak:\s+(-?[\d.]+) dBFS", bloc).group(1))
    momentanee = max(float(m) for m in re.findall(r"M:\s*(-?[\d.]+)", sortie))
    return {"integree": integre, "momentanee_max": momentanee, "crete": crete}


def raccord(x: np.ndarray) -> float:
    """Saut fin vers début, rapporté au 99,9e centile des sauts ordinaires de la boucle."""
    saut = abs(float(x[0] - x[-1]))
    return saut / (float(np.percentile(np.abs(np.diff(x)), 99.9)) + 1e-12)


def main() -> int:
    lignes = ["fichier;duree_s;integree_lufs;momentanee_max_lufs;crete_dbfs;raccord"]
    erreurs = 0
    for f in sorted(SONS.rglob("*.ogg")):
        m = ebur128(f)
        x = dsp.mono(dsp.decoder(f, 2))
        boucle = f.parent.name == "ambiances"
        r = raccord(x) if boucle else None
        rel = f.relative_to(SONS).as_posix()
        lignes.append(f"{rel};{len(x) / dsp.SR:.2f};{m['integree']:.1f};{m['momentanee_max']:.1f};{m['crete']:.1f};"
                      f"{'' if r is None else f'{r:.2f}'}")
        if m["crete"] > -1.0:
            print("CRETE TROP HAUTE", rel)
            erreurs += 1
        if r is not None and r > 1.5:
            print("RACCORD AUDIBLE", rel, r)
            erreurs += 1
    (Path(__file__).parent / "mesures.csv").write_text("\n".join(lignes) + "\n", encoding="utf-8")
    print("\n".join(lignes))
    return 1 if erreurs else 0


if __name__ == "__main__":
    sys.exit(main())
