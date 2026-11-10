"""Contrôle par la mesure des musiques livrées (écoute impossible ici).

Pour chaque morceau de `assets/commun/son/musique/`: durée (comparée à `index.json`), sonie intégrée
du mélange des tiges (ffmpeg `ebur128`, objectif -16 LUFS) et de chaque tige, crête vraie, crête
d'échantillon, saut au raccord de la boucle (rang centile parmi les sauts ordinaires), poids.
Écrit `assets-src/son/musique/mesures.csv`. Code de sortie 1 si une crête dépasse -1 dBFS, si une
sonie s'écarte de plus de 0,7 dB de la cible, si un raccord sort du lot, ou si le total dépasse 12 Mo.

Usage: duo-python -I assets-src/son/musique/controler.py
"""

from __future__ import annotations

import csv
import json
import re
import subprocess
import sys
import tempfile
from pathlib import Path

sys.dont_write_bytecode = True

import numpy as np  # noqa: E402
from scipy.io import wavfile  # noqa: E402

SR = 48000
AMORCE = 1.0
CIBLE = -16.0
RACINE = Path(__file__).resolve().parents[3]
DOSSIER = RACINE / "assets" / "commun" / "son" / "musique"
CSV = Path(__file__).resolve().parent / "mesures.csv"
LIMITE_OCTETS = 12 * 1024 * 1024


def decoder(fichier: Path) -> np.ndarray:
    p = subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-i", str(fichier), "-f", "f32le",
                        "-ac", "1", "-ar", str(SR), "-"], capture_output=True, check=True)
    return np.frombuffer(p.stdout, dtype=np.float32).astype(np.float64)


def ebur128(x: np.ndarray, tmp: Path) -> tuple[float, float]:
    """Sonie intégrée (LUFS) et crête vraie (dBTP) d'un signal mono, comme la mesure du studio."""
    wav = tmp / "m.wav"
    wavfile.write(str(wav), SR, np.concatenate([x, np.zeros(SR)]).astype(np.float32))
    err = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", str(wav), "-af", "ebur128=peak=true",
                          "-f", "null", "-"], capture_output=True, text=True, check=True).stderr
    bloc = err[err.rindex("Summary:"):]
    lufs = float(re.search(r"I:\s+(-?[\d.]+) LUFS", bloc).group(1))
    crete = float(re.search(r"Peak:\s+(-?[\d.]+) dBFS", bloc).group(1))
    return lufs, crete


def raccord(x: np.ndarray) -> tuple[float, float]:
    """Saut au raccord (de la dernière à la première note de la boucle) et son rang centile parmi
    les sauts de la boucle; deuxième différence au raccord / centile 99,5 des deuxièmes différences."""
    saut = abs(x[0] - x[-1])
    d = np.abs(np.diff(x))
    centile = 100.0 * float(np.mean(d <= saut))
    d2 = np.abs(x[2:] - 2 * x[1:-1] + x[:-2])
    raccord2 = max(abs(x[1] - 2 * x[0] + x[-1]), abs(x[0] - 2 * x[-1] + x[-2]))
    return centile, float(raccord2 / (np.percentile(d2, 99.5) + 1e-12))


def main() -> int:
    index = json.loads((DOSSIER / "index.json").read_text())
    lignes = []
    fautes = []
    total = 0
    with tempfile.TemporaryDirectory() as t:
        tmp = Path(t)
        for id_, info in index.items():
            tiges = info["stems"]
            n = round(info["seconds"] * SR)
            if tiges:
                fichiers = {s: DOSSIER / f"{id_}-{s}.ogg" for s in tiges}
                audio = {}
                for s, f in fichiers.items():
                    d = decoder(f)
                    a = round(AMORCE * SR)
                    if abs(len(d) - (n + 2 * a)) > 2:
                        fautes.append(f"{f.name}: {len(d)} échantillons au lieu de {n + 2 * a}")
                    audio[s] = d[a:a + n]
                    total += f.stat().st_size
                melange = sum(audio.values())
            else:
                f = DOSSIER / f"{id_}.ogg"
                melange = decoder(f)
                audio = {}
                total += f.stat().st_size
            lufs, crete = ebur128(melange, tmp)
            echantillon = 20 * np.log10(np.max(np.abs(melange)) + 1e-12)
            par_tige = {s: ebur128(x, tmp)[0] for s, x in audio.items()}
            centile, r2 = raccord(melange) if tiges else (float("nan"), float("nan"))
            poids = sum(f.stat().st_size for f in DOSSIER.glob(f"{id_}*.ogg"))
            lignes.append({"id": id_, "duree_s": round(len(melange) / SR, 3), "sonie_lufs": lufs,
                           "crete_vraie_dbtp": crete, "crete_echantillon_dbfs": round(float(echantillon), 2),
                           **{f"tige_{s}_lufs": v for s, v in par_tige.items()},
                           "raccord_centile": round(centile, 2), "raccord_2e_diff_rel": round(r2, 2),
                           "octets": poids})
            if crete > -1.0 or echantillon > -1.0:
                fautes.append(f"{id_}: crête {crete} dBTP / {echantillon:.2f} dBFS au-dessus de -1")
            if tiges and abs(lufs - CIBLE) > 0.7:
                fautes.append(f"{id_}: sonie {lufs} LUFS (cible {CIBLE})")
            if not tiges and not 2.0 <= len(melange) / SR <= 6.0:
                fautes.append(f"{id_}: durée {len(melange) / SR:.2f} s hors de 2 à 6 s")
            if tiges and r2 > 4.0:
                fautes.append(f"{id_}: raccord à {r2:.1f} fois le centile 99,5 des deuxièmes différences")
            print(f"{id_:28s} {len(melange) / SR:7.2f} s  {lufs:6.1f} LUFS  {crete:6.2f} dBTP  "
                  f"raccord c{centile:5.1f} x{r2:4.2f}  {poids / 1024:6.0f} Ko  "
                  + " ".join(f"{s}={v:.1f}" for s, v in par_tige.items()), flush=True)
    champs = sorted({k for l in lignes for k in l}, key=lambda k: (k != "id", k))
    with CSV.open("w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=champs)
        w.writeheader()
        w.writerows(lignes)
    print(f"total: {total / 1024 / 1024:.2f} Mo")
    if total > LIMITE_OCTETS:
        fautes.append(f"poids total {total / 1024 / 1024:.1f} Mo au-dessus de 12 Mo")
    for faute in fautes:
        print("FAUTE:", faute)
    return 1 if fautes else 0


if __name__ == "__main__":
    sys.exit(main())
