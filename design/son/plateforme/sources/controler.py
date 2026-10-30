"""Contrôle des fichiers livrés, par la mesure (on ne peut pas les écouter ici):

    duo-python design/son/plateforme/sources/controler.py [--images DOSSIER]

Pour chaque fichier OGG et M4A, et pour la planche d'écoute, décodé par ffmpeg:
- sonie momentanée maximale et intégrée, crête vraie (filtre ebur128 de ffmpeg, peak=true);
- échantillons écrêtés (|x| >= 0,9999), silence en tête (latence ajoutée au déclenchement);
- pour la boucle du salon: longueur exacte et raccord (saut entre le dernier et le premier
  échantillon, comparé aux sauts entre échantillons voisins dans tout le fichier).
Écrit controles/mesures.csv et échoue si une crête dépasse -1 dBTP, si un fichier écrête ou si
le raccord de la boucle sort de la distribution normale.
Avec --images, produit les formes d'onde et spectrogrammes (showwavespic, showspectrumpic) et
des planches de contrôle dans DOSSIER (non versionné). Spectrogrammes en fréquence logarithmique,
sans les options start et stop: dans ffmpeg 6.1, ce zoom fait apparaître une raie fantôme
(un sinus de 1 kHz montre aussi une raie vers 3 kHz) et un plancher de bruit à -60 dB.
"""

from __future__ import annotations

import argparse
import csv
import re
import subprocess
import sys
from pathlib import Path

import numpy as np

ICI = Path(__file__).resolve().parent
RACINE = ICI.parent
sys.path.insert(0, str(ICI))

from salon import ECHANTILLONS_AMORCE, ECHANTILLONS_BOUCLE  # noqa: E402

SR = 48000
PLAFOND_DBTP = -1.0


def mesurer_ebur128(fichier: Path) -> dict:
    proc = subprocess.run(
        ["ffmpeg", "-hide_banner", "-nostats", "-i", str(fichier), "-af",
         "apad=pad_dur=1,ebur128=peak=true:framelog=verbose", "-f", "null", "-"],
        capture_output=True, text=True, check=True)
    texte = proc.stderr
    m = [float(v) for v in re.findall(r"\bM:\s*(-?\d+(?:\.\d+)?)", texte)]
    resume = texte[texte.rfind("Summary:"):]
    i = re.search(r"I:\s*(-?\d+(?:\.\d+)?) LUFS", resume)
    tp = re.search(r"True peak:\s*Peak:\s*(-?\d+(?:\.\d+)?|-inf) dBFS", resume)
    return {
        "m_max": max(m) if m else float("nan"),
        "i": float(i.group(1)) if i else float("nan"),
        "tp": float(tp.group(1)) if tp else float("nan"),
    }


def decoder(fichier: Path) -> np.ndarray:
    proc = subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-i", str(fichier),
                           "-f", "f32le", "-ac", "2", "-ar", str(SR), "-"], capture_output=True, check=True)
    return np.frombuffer(proc.stdout, dtype=np.float32).reshape(-1, 2).astype(np.float64)


def raccord(x: np.ndarray, debut: int, fin: int) -> dict:
    """Lecture en boucle de debut à fin (exclu): compare le passage fin-1 -> debut aux passages
    entre échantillons voisins à l'intérieur de la boucle, et mesure l'écart entre ce qui suit le
    raccord (debut...) et ce qui suivrait sans boucler (fin...), présent grâce à l'amorce."""
    b = x[debut:fin]
    sauts = np.abs(np.diff(b, axis=0)).max(axis=1)
    saut_raccord = float(np.abs(x[debut] - x[fin - 1]).max())
    # Seconde différence: détecte aussi une cassure de pente, pas seulement un saut.
    d2 = np.abs(b[2:] - 2 * b[1:-1] + b[:-2]).max(axis=1)
    d2_raccord = float(max(np.abs(x[debut] - 2 * x[fin - 1] + x[fin - 2]).max(),
                           np.abs(x[debut + 1] - 2 * x[debut] + x[fin - 1]).max()))
    k = min(4096, len(x) - fin)
    continuation = float(np.abs(x[fin:fin + k] - x[debut:debut + k]).max()) if k > 0 else float("nan")
    return {
        "saut": saut_raccord,
        "saut_centile": float(100 * np.mean(sauts < saut_raccord)),
        "saut_p999": float(np.percentile(sauts, 99.9)),
        "d2": d2_raccord,
        "d2_centile": float(100 * np.mean(d2 < d2_raccord)),
        "d2_p999": float(np.percentile(d2, 99.9)),
        "continuation": continuation,
    }


def images(fichiers: list[Path], dossier: Path) -> None:
    dossier.mkdir(parents=True, exist_ok=True)
    tuiles = []
    for f in fichiers:
        base = dossier / f.stem
        subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", str(f), "-lavfi",
                        "showspectrumpic=s=560x200:legend=1:scale=log:fscale=log:color=intensity",
                        f"{base}-spectre.png"], check=True)
        subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", str(f), "-lavfi",
                        "showwavespic=s=760x110:split_channels=1:colors=0x5CE1E6|0x8D6CFF:scale=lin",
                        f"{base}-onde.png"], check=True)
        tuile = dossier / f"{f.stem}-tuile.png"
        subprocess.run(["convert", f"{base}-onde.png", f"{base}-spectre.png", "-background", "#0E1126",
                        "-gravity", "center", "-append", "-gravity", "north", "-splice", "0x22",
                        "-fill", "white", "-pointsize", "16", "-annotate", "+0+2", f.name, str(tuile)],
                       check=True)
        tuiles.append(tuile)
    for i in range(0, len(tuiles), 6):
        lot = tuiles[i:i + 6]
        subprocess.run(["montage", *map(str, lot), "-tile", "2x", "-geometry", "+6+6",
                        "-background", "#0E1126", str(dossier / f"planche-{i // 6 + 1}.png")], check=True)


def images_boucle(fichier: Path, dossier: Path) -> None:
    """Spectrogramme complet, et zoom sur le raccord (3 s de fin puis 3 s de début)."""
    x = decoder(fichier)
    debut, fin = ECHANTILLONS_AMORCE, ECHANTILLONS_AMORCE + ECHANTILLONS_BOUCLE
    x = x[debut:fin]  # ce que joue la boucle
    n = 3 * SR
    autour = np.concatenate([x[-n:], x[:n]]).astype(np.float32)
    brut = dossier / "raccord.f32"
    autour.tofile(brut)
    subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-f", "f32le", "-ar", str(SR),
                    "-ac", "2", "-i", str(brut), "-lavfi",
                    "showspectrumpic=s=900x300:legend=1:scale=log:fscale=log:color=intensity",
                    str(dossier / "raccord-spectre.png")], check=True)
    zoom = np.concatenate([x[-480:], x[:480]]).astype(np.float32)  # 10 ms de chaque côté
    zoom.tofile(brut)
    subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-f", "f32le", "-ar", str(SR),
                    "-ac", "2", "-i", str(brut), "-lavfi",
                    "showwavespic=s=900x200:split_channels=1:colors=0x5CE1E6|0x8D6CFF:scale=lin",
                    str(dossier / "raccord-zoom-20ms.png")], check=True)
    subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", str(fichier), "-lavfi",
                    "showspectrumpic=s=1200x320:legend=1:scale=log:fscale=log:color=intensity",
                    str(dossier / "boucle-spectre.png")], check=True)
    subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", str(fichier), "-lavfi",
                    "showwavespic=s=1200x200:split_channels=1:colors=0x5CE1E6|0x8D6CFF:scale=lin",
                    str(dossier / "boucle-onde.png")], check=True)
    brut.unlink()


def main() -> int:
    parser = argparse.ArgumentParser(description="Contrôle des sons de la plateforme Duo")
    parser.add_argument("--images", type=Path, help="dossier où écrire formes d'onde et spectrogrammes")
    args = parser.parse_args()

    fichiers = sorted((RACINE / "ogg").glob("*.ogg")) + sorted((RACINE / "m4a").glob("*.m4a"))
    fichiers.append(RACINE / "ecoute.m4a")
    lignes = []
    erreurs = []
    for f in fichiers:
        mesure = mesurer_ebur128(f)
        x = decoder(f)
        ecretes = int(np.sum(np.abs(x) >= 0.9999))
        au_dessus = np.where(np.max(np.abs(x), axis=1) > 1e-4)[0]
        tete_ms = 1000.0 * au_dessus[0] / SR if len(au_dessus) else float("nan")
        ligne = {
            "fichier": str(f.relative_to(RACINE)),
            "duree_s": round(len(x) / SR, 3),
            "sonie_m_max_lufs": mesure["m_max"],
            "sonie_integree_lufs": mesure["i"],
            "crete_vraie_dbtp": mesure["tp"],
            "echantillons_ecretes": ecretes,
            "silence_tete_ms": round(tete_ms, 2),
            "taille_ko": round(f.stat().st_size / 1024, 1),
        }
        if f.name == "lounge.ogg":
            debut, fin = ECHANTILLONS_AMORCE, ECHANTILLONS_AMORCE + ECHANTILLONS_BOUCLE
            r = raccord(x, debut, fin)
            ligne["raccord"] = (f"saut {r['saut']:.5f} (centile {r['saut_centile']:.1f} des sauts internes, p99,9 "
                                f"{r['saut_p999']:.5f}); seconde différence {r['d2']:.5f} (centile "
                                f"{r['d2_centile']:.1f}); écart à la continuation {r['continuation']:.5f}")
            if len(x) != fin + ECHANTILLONS_AMORCE:
                erreurs.append(f"{f.name}: {len(x)} échantillons au lieu de {fin + ECHANTILLONS_AMORCE}")
            if r["saut_centile"] > 99.0 or r["d2_centile"] > 99.0:
                erreurs.append(f"{f.name}: raccord hors de la distribution interne")
        else:
            ligne["raccord"] = ""
        if not mesure["tp"] <= PLAFOND_DBTP:
            erreurs.append(f"{f.name}: crête vraie {mesure['tp']} dBTP")
        if ecretes:
            erreurs.append(f"{f.name}: {ecretes} échantillons écrêtés")
        lignes.append(ligne)

    sortie = RACINE / "controles" / "mesures.csv"
    sortie.parent.mkdir(exist_ok=True)
    with sortie.open("w", newline="", encoding="utf-8") as fh:
        ecrivain = csv.DictWriter(fh, fieldnames=list(lignes[0].keys()))
        ecrivain.writeheader()
        ecrivain.writerows(lignes)

    total_ogg = sum(f.stat().st_size for f in (RACINE / "ogg").glob("*.ogg"))
    total_m4a = sum(f.stat().st_size for f in (RACINE / "m4a").glob("*.m4a"))
    total_planche = (RACINE / "ecoute.m4a").stat().st_size
    print(f"\n{len(lignes)} fichiers mesurés, détail dans {sortie.relative_to(RACINE.parent.parent.parent)}")
    print(f"Poids: ogg {total_ogg / 1024:.0f} Ko, m4a {total_m4a / 1024:.0f} Ko, planche "
          f"{total_planche / 1024:.0f} Ko, total {(total_ogg + total_m4a + total_planche) / 1024 / 1024:.2f} Mo")
    tps = [l["crete_vraie_dbtp"] for l in lignes]
    print(f"Crête vraie la plus haute: {max(tps):.1f} dBTP; échantillons écrêtés: "
          f"{sum(l['echantillons_ecretes'] for l in lignes)}")
    for l in lignes:
        if l["raccord"]:
            print(f"Boucle: {l['duree_s']} s, intégrée {l['sonie_integree_lufs']} LUFS, {l['raccord']}")

    if args.images:
        images(sorted((RACINE / "ogg").glob("*.ogg")), args.images)
        images_boucle(RACINE / "ogg" / "lounge.ogg", args.images)
        print(f"Images dans {args.images}")

    if erreurs:
        print("ÉCHEC:\n  " + "\n  ".join(erreurs), file=sys.stderr)
        return 1
    print("Contrôle réussi.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
