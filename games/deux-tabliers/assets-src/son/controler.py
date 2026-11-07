"""Contrôle des fichiers livrés de Deux Tabliers, par la mesure (on ne peut pas les écouter ici):

    duo-python games/deux-tabliers/assets-src/son/controler.py [--images DOSSIER]

Repris de La Petite Ligne. Pour chaque fichier du jeu et chaque copie M4A, décodé par ffmpeg à sa
fréquence propre: sonie momentanée maximale et intégrée, crête vraie (ebur128, peak=true),
échantillons écrêtés, silence en tête; pour chaque boucle: longueur exacte et raccord (saut et
seconde différence au passage fin -> début comparés à leur distribution dans la boucle, écart à la
continuation dans l'amorce). Calcule aussi la mémoire décodée par groupe (dossier), à la fréquence
de décodage prévue et à 48 kHz (si le SDK décode encore dans son contexte principal), et le poids.
Écrit controles/mesures.csv; échoue au-delà de -1 dBTP, sur un écrêtage, un raccord hors de la
distribution, un fichier manquant ou orphelin, une musique à plus de 0,5 LU de -16 LUFS, ou un
dépassement des plafonds de poids et de mémoire.
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
SORTIE = RACINE_DEPOT / "games" / "deux-tabliers" / "assets" / "son"
DESIGN = RACINE_DEPOT / "design" / "son" / "deux-tabliers"
PLAFOND_DBTP = -1.0
POIDS_MAX_MO = 32.0  # plafond proposé pour tout le son du jeu (son.md, 8.8.2)
MEMOIRE_MAX_MO = 60.0  # plafond du moteur (son.md, 8.8.1), sur 64 Mo au budget
CIBLE_MUSIQUE = -16.0


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


def sonde(fichier: Path) -> tuple[int, int, str]:
    proc = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "a:0", "-show_entries",
                           "stream=channels,sample_rate,codec_name", "-of", "json", str(fichier)],
                          capture_output=True, text=True, check=True)
    s = json.loads(proc.stdout)["streams"][0]
    return int(s["channels"]), int(s["sample_rate"]), s["codec_name"]


def decoder(fichier: Path, canaux: int) -> np.ndarray:
    proc = subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-i", str(fichier), "-f", "f32le", "-"],
                          capture_output=True, check=True)
    x = np.frombuffer(proc.stdout, dtype=np.float32).astype(np.float64)
    return x.reshape(-1, canaux)


def raccord(x: np.ndarray, debut: int, fin: int) -> dict:
    b = x[debut:fin]
    sauts = np.abs(np.diff(b, axis=0)).max(axis=1)
    saut = float(np.abs(x[debut] - x[fin - 1]).max())
    d2 = np.abs(b[2:] - 2 * b[1:-1] + b[:-2]).max(axis=1)
    d2_r = float(max(np.abs(x[debut] - 2 * x[fin - 1] + x[fin - 2]).max(),
                     np.abs(x[debut + 1] - 2 * x[debut] + x[fin - 1]).max()))
    k = min(2048, len(x) - fin)
    continuation = float(np.abs(x[fin:fin + k] - x[debut:debut + k]).max()) if k > 0 else float("nan")
    return {"saut_centile": float(100 * np.mean(sauts < saut)), "d2_centile": float(100 * np.mean(d2 < d2_r)),
            "continuation": continuation}


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
    parser = argparse.ArgumentParser(description="Contrôle des sons de Deux Tabliers")
    parser.add_argument("--images", type=Path, help="dossier où écrire formes d'onde et spectrogrammes")
    args = parser.parse_args()
    defs = json.loads((SORTIE / "sons.json").read_text(encoding="utf-8"))
    boucles: dict[str, tuple[int, int]] = {}
    groupe_de: dict[str, tuple[str, int]] = {}
    for d in defs["sounds"].values():
        for f in d["files"]:
            groupe_de[f] = (d["group"], d["decodeSampleRate"])
            if d.get("loop"):
                boucles[f] = (d["loop"]["startSample"], d["loop"]["endSample"])
    attendus = set(groupe_de) | {d["file"] for d in defs["music"].values()}
    presents = {p.relative_to(SORTIE).as_posix() for p in SORTIE.rglob("*.ogg")}
    erreurs = []
    for manquant in sorted(attendus - presents):
        erreurs.append(f"{manquant}: déclaré dans sons.json mais absent")
    for orphelin in sorted(presents - attendus):
        erreurs.append(f"{orphelin}: présent mais absent de sons.json")

    copies = sorted(DESIGN.glob("*.m4a")) + sorted((DESIGN / "musiques").glob("*.m4a"))
    fichiers = sorted(SORTIE.rglob("*.ogg")) + copies
    lignes = []
    memoire: dict[str, list[float]] = {}
    for f in fichiers:
        mesure = mesurer_ebur128(f)
        canaux, frequence, codec = sonde(f)
        x = decoder(f, canaux)
        ecretes = int(np.sum(np.abs(x) >= 0.9999))
        env = np.max(np.abs(x), axis=1)
        actifs = np.where(env > 1e-4)[0]
        tete_ms = 1000.0 * actifs[0] / frequence if len(actifs) else float("nan")
        rel = f.relative_to(SORTIE).as_posix() if f.is_relative_to(SORTIE) else f.relative_to(RACINE_DEPOT).as_posix()
        ligne = {"fichier": rel, "codec": codec, "frequence": frequence, "canaux": canaux,
                 "duree_s": round(len(x) / frequence, 3), "sonie_m_max_lufs": mesure["m_max"],
                 "sonie_integree_lufs": mesure["i"], "crete_vraie_dbtp": mesure["tp"], "echantillons_ecretes": ecretes,
                 "silence_tete_ms": round(tete_ms, 2), "taille_ko": round(f.stat().st_size / 1024, 1), "raccord": ""}
        if rel in groupe_de:
            groupe, sr_dec = groupe_de[rel]
            m = memoire.setdefault(groupe, [0.0, 0.0])
            m[0] += len(x) / frequence * sr_dec * canaux * 4
            m[1] += len(x) / frequence * 48000 * canaux * 4
        if rel in boucles:
            debut, fin = boucles[rel]
            if len(x) != fin + debut:
                erreurs.append(f"{rel}: {len(x)} échantillons au lieu de {fin + debut}")
            r = raccord(x, debut, fin)
            ligne["raccord"] = (f"saut au centile {r['saut_centile']:.1f}, seconde différence au centile "
                                f"{r['d2_centile']:.1f}, continuation {r['continuation']:.4f}")
            # Seuil 99,95: après un codage avec perte, ce centile d'un seul échantillon est tiré au hasard
            # (mesuré: la même boucle passe de 26 à 97 d'un encodage à l'autre); seul un raccord plus
            # brusque que presque tout le reste du fichier est un défaut. La boucle brute est contrôlée
            # avant encodage dans generer.py (raccord_brut).
            if r["saut_centile"] > 99.95 or r["d2_centile"] > 99.95:
                erreurs.append(f"{rel}: raccord hors de la distribution interne ({ligne['raccord']})")
        if rel.startswith("musique/") and abs(mesure["i"] - CIBLE_MUSIQUE) > 0.5:
            erreurs.append(f"{rel}: {mesure['i']} LUFS intégrés au lieu de {CIBLE_MUSIQUE}")
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

    mo = 1024 * 1024
    poids_jeu = sum(f.stat().st_size for f in SORTIE.rglob("*") if f.is_file())
    poids_musique = sum(f.stat().st_size for f in (SORTIE / "musique").rglob("*") if f.is_file())
    print(f"\n{len(lignes)} fichiers mesurés, détail dans {sortie.relative_to(RACINE_DEPOT)}")
    print(f"Poids du son du jeu: {poids_jeu / mo:.2f} Mo (musiques {poids_musique / mo:.2f} Mo, sons "
          f"{(poids_jeu - poids_musique) / mo:.2f} Mo); copies M4A pour le client: "
          f"{sum(f.stat().st_size for f in copies) / mo:.2f} Mo")
    print("Mémoire décodée par groupe (fréquence prévue / à 48 kHz):")
    for g in sorted(memoire):
        print(f"  {g}: {memoire[g][0] / mo:.2f} / {memoire[g][1] / mo:.2f} Mo")
    total = [sum(v[0] for v in memoire.values()), sum(v[1] for v in memoire.values())]
    print(f"  tout décodé à la fois: {total[0] / mo:.2f} / {total[1] / mo:.2f} Mo, plus environ 1 Mo par flux "
          f"de musique")
    for l in lignes:
        if l["fichier"].startswith("musique/"):
            print(f"  {l['fichier']}: {l['codec']}, {l['duree_s']} s, intégrée {l['sonie_integree_lufs']} LUFS, "
                  f"crête {l['crete_vraie_dbtp']} dBTP, {8 * l['taille_ko'] * 1.024 / l['duree_s']:.1f} kbit/s")
    for l in lignes:
        if l["raccord"]:
            print(f"  {l['fichier']}: {l['raccord']}")
    tps = [l["crete_vraie_dbtp"] for l in lignes]
    print(f"Crête vraie la plus haute: {max(tps):.1f} dBTP; échantillons écrêtés: "
          f"{sum(l['echantillons_ecretes'] for l in lignes)}; silence en tête maximal des effets: "
          f"{max(l['silence_tete_ms'] for l in lignes if not l['raccord'] and not l['fichier'].startswith('musique/') and l['fichier'].endswith('.ogg')):.1f} ms")
    if poids_jeu / mo > POIDS_MAX_MO:
        erreurs.append(f"poids du son {poids_jeu / mo:.1f} Mo au-dessus de {POIDS_MAX_MO} Mo")
    if total[1] / mo > MEMOIRE_MAX_MO:
        erreurs.append(f"mémoire décodée {total[1] / mo:.1f} Mo au-dessus de {MEMOIRE_MAX_MO} Mo")
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
