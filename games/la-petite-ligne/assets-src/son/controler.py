"""Contrôle des fichiers livrés, par la mesure (on ne peut pas les écouter ici):

    duo-python games/la-petite-ligne/assets-src/son/controler.py [--images DOSSIER]

Pour chaque fichier OGG du jeu et chaque M4A destiné au client, décodé par ffmpeg:
- sonie momentanée maximale et intégrée, crête vraie (filtre ebur128 de ffmpeg, peak=true);
- échantillons écrêtés (|x| >= 0,9999), silence en tête (latence ajoutée au déclenchement);
- pour chaque boucle (musiques, ambiances, effets en boucle): longueur exacte, raccord (saut
  et seconde différence au passage fin -> début, comparés à leur distribution dans tout le
  fichier), écart à la continuation (ce qui suit la fin dans l'amorce comparé au début), et
  écart de niveau entre la dernière et la première seconde.
Écrit controles/mesures.csv et échoue si une crête dépasse -1 dBTP, si un fichier écrête, si un
raccord sort de la distribution normale ou si le poids du jeu dépasse 20 Mo.
Avec --images, écrit formes d'onde et spectrogrammes (showwavespic, showspectrumpic) dans DOSSIER.
"""

from __future__ import annotations

import argparse
import csv
import json
import re
import subprocess
import sys
from pathlib import Path

import numpy as np

ICI = Path(__file__).resolve().parent
RACINE_DEPOT = ICI.parents[3]
SORTIE = RACINE_DEPOT / "games" / "la-petite-ligne" / "assets" / "son"
DESIGN = RACINE_DEPOT / "design" / "son" / "la-petite-ligne"
SR = 48000
PLAFOND_DBTP = -1.0
POIDS_MAX_MO = 20.0


def mesurer_ebur128(fichier: Path) -> dict:
    proc = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", str(fichier), "-af",
                           "apad=pad_dur=1,ebur128=peak=true", "-f", "null", "-"],
                          capture_output=True, text=True, check=True)
    texte = proc.stderr
    m = [float(v) for v in re.findall(r"\bM:\s*(-?\d+(?:\.\d+)?)", texte)]
    resume = texte[texte.rfind("Summary:"):]
    i = re.search(r"I:\s*(-?\d+(?:\.\d+)?) LUFS", resume)
    tp = re.search(r"True peak:\s*Peak:\s*(-?\d+(?:\.\d+)?|-inf) dBFS", resume)
    return {"m_max": max(m) if m else float("nan"), "i": float(i.group(1)) if i else float("nan"),
            "tp": float(tp.group(1)) if tp else float("nan")}


def decoder(fichier: Path) -> np.ndarray:
    proc = subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-i", str(fichier), "-f", "f32le",
                           "-ar", str(SR), "-"], capture_output=True, check=True)
    canaux = 2 if _canaux(fichier) == 2 else 1
    x = np.frombuffer(proc.stdout, dtype=np.float32).astype(np.float64)
    return x.reshape(-1, canaux) if canaux == 2 else x[:, None]


def _canaux(fichier: Path) -> int:
    proc = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "a:0", "-show_entries", "stream=channels",
                           "-of", "csv=p=0", str(fichier)], capture_output=True, text=True, check=True)
    return int(proc.stdout.strip() or 1)


def raccord(x: np.ndarray, debut: int, fin: int) -> dict:
    b = x[debut:fin]
    sauts = np.abs(np.diff(b, axis=0)).max(axis=1)
    saut = float(np.abs(x[debut] - x[fin - 1]).max())
    d2 = np.abs(b[2:] - 2 * b[1:-1] + b[:-2]).max(axis=1)
    d2_r = float(max(np.abs(x[debut] - 2 * x[fin - 1] + x[fin - 2]).max(),
                     np.abs(x[debut + 1] - 2 * x[debut] + x[fin - 1]).max()))
    k = min(2048, len(x) - fin)
    continuation = float(np.abs(x[fin:fin + k] - x[debut:debut + k]).max()) if k > 0 else float("nan")
    # Niveau par blocs de 250 ms: la variation au raccord (dernier bloc -> premier) est comparée aux
    # variations entre blocs voisins dans toute la boucle (un oiseau qui chante juste après le
    # raccord est normal s'il y en a ailleurs).
    blocs = len(b) // (SR // 4)
    niveaux = np.array([20 * np.log10(np.sqrt(np.mean(b[k * (SR // 4):(k + 1) * (SR // 4)] ** 2)) + 1e-9)
                        for k in range(blocs)])
    variations = np.abs(np.diff(niveaux))
    au_raccord = abs(niveaux[0] - niveaux[-1])
    return {"saut_centile": float(100 * np.mean(sauts < saut)), "d2_centile": float(100 * np.mean(d2 < d2_r)),
            "continuation": continuation, "ecart_niveau_db": float(niveaux[0] - niveaux[-1]),
            "niveau_centile": float(100 * np.mean(variations < au_raccord)), "saut": saut}


def images(fichiers: list[Path], dossier: Path) -> None:
    dossier.mkdir(parents=True, exist_ok=True)
    tuiles = []
    for f in fichiers:
        base = dossier / f.stem
        subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", str(f), "-lavfi",
                        "showspectrumpic=s=420x160:legend=0:scale=log:fscale=log:color=intensity",
                        f"{base}-spectre.png"], check=True)
        subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", str(f), "-lavfi",
                        "showwavespic=s=420x60:split_channels=0:colors=0x8FD694:scale=lin", f"{base}-onde.png"],
                       check=True)
        tuile = dossier / f"{f.stem}-tuile.png"
        subprocess.run(["convert", f"{base}-onde.png", f"{base}-spectre.png", "-background", "#1B1F14", "-append",
                        "-gravity", "north", "-splice", "0x16", "-fill", "white", "-pointsize", "13", "-annotate",
                        "+0+1", f.name, str(tuile)], check=True)
        tuiles.append(tuile)
    for i in range(0, len(tuiles), 20):
        subprocess.run(["montage", *map(str, tuiles[i:i + 20]), "-tile", "4x", "-geometry", "+4+4", "-background",
                        "#1B1F14", str(dossier / f"planche-{i // 20 + 1}.png")], check=True)


def main() -> int:
    parser = argparse.ArgumentParser(description="Contrôle des sons de La Petite Ligne")
    parser.add_argument("--images", type=Path, help="dossier où écrire formes d'onde et spectrogrammes")
    args = parser.parse_args()
    defs = json.loads((SORTIE / "sons.json").read_text(encoding="utf-8"))
    boucles: dict[str, tuple[int, int]] = {}
    for d in defs["sounds"].values():
        if d.get("loop"):
            for f in d["files"]:
                boucles[f] = (d["loop"]["startSample"], d["loop"]["endSample"])
    for d in defs["music"].values():
        if d.get("loop"):
            boucles[d["file"]] = (d["loop"]["startSample"], d["loop"]["endSample"])
    attendus = {f for d in defs["sounds"].values() for f in d["files"]} | {d["file"] for d in defs["music"].values()}
    presents = {str(p.relative_to(SORTIE)) for p in SORTIE.rglob("*.ogg")}
    erreurs = []
    for manquant in sorted(attendus - presents):
        erreurs.append(f"{manquant}: déclaré dans sons.json mais absent")
    for orphelin in sorted(presents - attendus):
        erreurs.append(f"{orphelin}: présent mais absent de sons.json")

    fichiers = sorted(SORTIE.rglob("*.ogg")) + sorted(DESIGN.rglob("*.m4a"))
    lignes = []
    for f in fichiers:
        mesure = mesurer_ebur128(f)
        x = decoder(f)
        ecretes = int(np.sum(np.abs(x) >= 0.9999))
        env = np.max(np.abs(x), axis=1)
        actifs = np.where(env > 1e-4)[0]
        tete_ms = 1000.0 * actifs[0] / SR if len(actifs) else float("nan")
        rel = str(f.relative_to(SORTIE)) if f.is_relative_to(SORTIE) else str(f.relative_to(RACINE_DEPOT))
        ligne = {"fichier": rel, "canaux": x.shape[1], "duree_s": round(len(x) / SR, 3),
                 "sonie_m_max_lufs": mesure["m_max"], "sonie_integree_lufs": mesure["i"],
                 "crete_vraie_dbtp": mesure["tp"], "echantillons_ecretes": ecretes,
                 "silence_tete_ms": round(tete_ms, 2), "taille_ko": round(f.stat().st_size / 1024, 1), "raccord": ""}
        if rel in boucles:
            debut, fin = boucles[rel]
            if len(x) != fin + debut:
                erreurs.append(f"{rel}: {len(x)} échantillons au lieu de {fin + debut}")
            r = raccord(x, debut, fin)
            ligne["raccord"] = (f"saut au centile {r['saut_centile']:.1f}, seconde différence au centile "
                                f"{r['d2_centile']:.1f}, continuation {r['continuation']:.4f}, "
                                f"niveau au raccord {r['ecart_niveau_db']:+.1f} dB (centile {r['niveau_centile']:.0f})")
            if r["saut_centile"] > 99.5 or r["d2_centile"] > 99.5:
                erreurs.append(f"{rel}: raccord hors de la distribution interne ({ligne['raccord']})")
            # Statistique de niveau valable à partir de 20 blocs (5 s); en deçà, saut et seconde
            # différence suffisent.
            if fin - debut >= 20 * (SR // 4) and r["niveau_centile"] > 99.0 and abs(r["ecart_niveau_db"]) > 3.0:
                erreurs.append(f"{rel}: saut de niveau au raccord ({ligne['raccord']})")
        if not mesure["tp"] <= PLAFOND_DBTP:
            erreurs.append(f"{rel}: crête vraie {mesure['tp']} dBTP")
        if ecretes:
            erreurs.append(f"{rel}: {ecretes} échantillons écrêtés")
        lignes.append(ligne)

    sortie = ICI / "controles" / "mesures.csv"
    sortie.parent.mkdir(exist_ok=True)
    with sortie.open("w", newline="", encoding="utf-8") as fh:
        ecrivain = csv.DictWriter(fh, fieldnames=list(lignes[0].keys()))
        ecrivain.writeheader()
        ecrivain.writerows(lignes)

    poids_jeu = sum(f.stat().st_size for f in SORTIE.rglob("*") if f.is_file())
    poids_design = sum(f.stat().st_size for f in DESIGN.rglob("*") if f.is_file())
    print(f"\n{len(lignes)} fichiers mesurés, détail dans {sortie.relative_to(RACINE_DEPOT)}")
    print(f"Poids du jeu (assets/son): {poids_jeu / 1024 / 1024:.2f} Mo; copies pour le client: "
          f"{poids_design / 1024 / 1024:.2f} Mo")
    musique = [l for l in lignes if l["fichier"].startswith("musique/")]
    for l in musique:
        print(f"  {l['fichier']}: {l['duree_s']} s, intégrée {l['sonie_integree_lufs']} LUFS, crête "
              f"{l['crete_vraie_dbtp']} dBTP{', ' + l['raccord'] if l['raccord'] else ''}")
    autres_boucles = [l for l in lignes if l["raccord"] and not l["fichier"].startswith("musique/")]
    for l in autres_boucles:
        print(f"  {l['fichier']}: {l['raccord']}")
    tps = [l["crete_vraie_dbtp"] for l in lignes]
    print(f"Crête vraie la plus haute: {max(tps):.1f} dBTP; échantillons écrêtés: "
          f"{sum(l['echantillons_ecretes'] for l in lignes)}; silence en tête maximal des effets: "
          f"{max(l['silence_tete_ms'] for l in lignes if not l['raccord'] and l['fichier'].endswith('.ogg')):.1f} ms")
    if poids_jeu / 1024 / 1024 > POIDS_MAX_MO:
        erreurs.append(f"poids du jeu {poids_jeu / 1024 / 1024:.1f} Mo au-dessus de {POIDS_MAX_MO} Mo")
    if args.images:
        images(sorted(SORTIE.rglob("*.ogg")), args.images)
        print(f"Images dans {args.images}")
    if erreurs:
        print("ÉCHEC:\n  " + "\n  ".join(erreurs), file=sys.stderr)
        return 1
    print("Contrôle réussi.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
