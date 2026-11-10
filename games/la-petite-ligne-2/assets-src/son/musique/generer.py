"""Rend les musiques d'Aubrune: partitions (`aubrune.py`) vers MIDI, FluidSynth (banque FluidR3_GM),
mélange par tiges, mastering, OGG Opus.

Usage: duo-python assets-src/son/musique/generer.py [--seulement id ...] [--ecoute] [--midi-seulement]
Sorties:
- `assets/commun/son/musique/<id>-fond.ogg` et `<id>-air.ogg` (deux tiges mono, synchrones), avec une
  amorce de 1 s de chaque côté (fin de la boucle avant, début après) pour que le codage ne marque pas
  le raccord; le jeu boucle de 1 s à 1 s + durée (`donnees/musique.json`);
- `assets/commun/son/musique/<id>.ogg` pour un jingle (mono, sans amorce);
- `assets/commun/son/musique/index.json` (durées), `assets-src/son/musique/midi/<id>.mid` (partitions);
- avec `--ecoute`: copies M4A du mélange (une passe de la boucle) dans `assets-src/son/musique/ecoute/`.
Déterministe (graines fixes, encodage bit à bit identique).
"""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
import tempfile
from pathlib import Path

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import numpy as np  # noqa: E402
from scipy import signal  # noqa: E402

import dsp  # noqa: E402
import partition  # noqa: E402
from aubrune import JINGLES, MORCEAUX  # noqa: E402
from partition import Morceau, ecrire_midi, octave_relative, rendre_pistes  # noqa: E402

RACINE = Path(__file__).resolve().parents[3]
SORTIE = RACINE / "assets" / "commun" / "son" / "musique"
MIDI = Path(__file__).resolve().parent / "midi"
ECOUTE = Path(__file__).resolve().parent / "ecoute"
AMORCE = 1.0  # secondes d'amorce de chaque côté d'une boucle
CIBLE_LUFS = -16.0  # intégrée, mesurée par ffmpeg sur le fichier mono livré
MONO = 3.01  # dsp duplique un tableau mono sur deux canaux; ffmpeg mesure le canal seul
PLAFOND_DBTP = -2.0  # avant codage; le contrôle exige -1 dBFS après décodage
DEBIT_OPUS = "36k"


def mixer_tiges(m: Morceau, pistes: dict[str, np.ndarray], tiges: dict[str, list[str]]) -> dict[str, np.ndarray]:
    """Niveaux relatifs par piste (mesurés), réverbération commune, repli de la queue sur le début
    d'une boucle, égalisation identique pour toutes les tiges. Renvoie une tige mono par nom."""
    total = len(next(iter(pistes.values())))
    ir = dsp.ir_salle(m.rt60, m.predelai, m.aigus_ir, graine=m.graine)
    par_tige: dict[str, np.ndarray] = {}
    for tige, noms in tiges.items():
        sec = np.zeros((total, 2))
        envoi = np.zeros((total, 2))
        for piste in m.pistes:
            if piste.nom not in noms:
                continue
            x = pistes[piste.nom]
            if piste.passe_haut > 0:
                x = dsp.ph(x, piste.passe_haut, 2)
            g_db = (-20.0 + piste.sonie_lu) - dsp.sonie_integree(pistes[piste.nom])
            x = x * 10 ** (g_db / 20.0)
            sec += x
            envoi += piste.reverbe * x
        humide = np.stack([signal.oaconvolve(envoi[:, c], ir[:, c]) for c in range(2)], axis=1)
        mix = np.zeros((max(total, len(humide)), 2))
        mix[:total] += sec
        mix[:len(humide)] += humide
        par_tige[tige] = mix
    n_boucle = dsp.n_ech(m.duree_s)
    if m.boucle:
        for tige, mix in par_tige.items():
            boucle = mix[:n_boucle].copy()
            reste = mix[n_boucle:]
            while len(reste):
                pris = min(len(reste), n_boucle)
                boucle[:pris] += reste[:pris]
                reste = reste[pris:]
            par_tige[tige] = boucle
    return par_tige


def lufs_ffmpeg(x: np.ndarray) -> float:
    """Sonie intégrée d'un signal mono mesurée par ffmpeg (`ebur128`), comme le contrôle."""
    with tempfile.TemporaryDirectory() as t:
        wav = Path(t) / "m.wav"
        dsp.ecrire_wav(wav, np.concatenate([x, np.zeros(dsp.SR)]))
        err = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", str(wav), "-af", "ebur128", "-f", "null", "-"],
                             capture_output=True, text=True, check=True).stderr
    return float(re.search(r"I:\s+(-?[\d.]+) LUFS", err[err.rindex("Summary:"):]).group(1))


def chaine(x: np.ndarray, gain_etagere: float, circulaire: bool) -> np.ndarray:
    """Passe-haut, creux de bas-médium, étagère d'aigus (les échantillons de la banque sont sombres)."""
    n = len(x)
    y = np.concatenate([x, x, x]) if circulaire else x
    y = dsp.ph(y, 50.0, 2)
    y = dsp.cloche_eq(y, 200.0, -2.5, 0.8)
    if abs(gain_etagere) > 0.05:
        y = dsp.etagere_aigus(y, 3000.0, gain_etagere)
    return y[n:2 * n] if circulaire else y


def masteriser(m: Morceau, tiges_st: dict[str, np.ndarray]) -> dict[str, np.ndarray]:
    somme = sum(tiges_st.values())
    gain, deja = 0.0, 0.0
    for _ in range(2):
        mesure = octave_relative(chaine(somme, deja, m.boucle), 4000.0)
        g = float(np.clip(m.presence_db - mesure, -4.0 - deja, 10.0 - deja))
        if abs(g) < 0.3:
            break
        deja += g
    gain = deja
    mono = {k: dsp.mono(chaine(v, gain, m.boucle)) for k, v in tiges_st.items()}
    total = sum(mono.values())
    echelle = 10 ** ((CIBLE_LUFS + MONO - dsp.sonie_integree(total, circulaire=m.boucle)) / 20.0)
    noms = list(mono) + ["_somme"]
    mono["_somme"] = total
    for _ in range(3):  # la mesure de ffmpeg (celle du contrôle) corrige l'écart de la nôtre
        pile = np.stack([mono[k] * echelle for k in noms], axis=1)
        if m.boucle:
            pile = dsp.limiter_circulaire(pile, PLAFOND_DBTP)
        else:
            pile = dsp.limiter_circulaire(np.concatenate([pile, np.zeros_like(pile)]), PLAFOND_DBTP)[:len(pile)]
        ecart = CIBLE_LUFS - lufs_ffmpeg(pile[:, -1])
        if abs(ecart) < 0.15:
            break
        echelle *= 10 ** (ecart / 20.0)
    return {k: pile[:, i] for i, k in enumerate(noms)}


def encoder(x: np.ndarray, sortie: Path, tmp: Path, amorce: bool) -> None:
    if amorce:
        a = dsp.n_ech(AMORCE)
        x = np.concatenate([x[-a:], x, x[:a]])
    wav = tmp / (sortie.stem + ".wav")
    dsp.ecrire_wav(wav, x)
    sortie.parent.mkdir(parents=True, exist_ok=True)
    dsp.ffmpeg("-i", str(wav), "-map_metadata", "-1", "-fflags", "+bitexact", "-flags:a", "+bitexact",
               "-c:a", "libopus", "-b:a", DEBIT_OPUS, "-vbr", "constrained", "-application", "audio", str(sortie))


def rogner_jingle(y: np.ndarray) -> np.ndarray:
    """Coupe la fin sous -60 dB de la crête, puis fondu de sortie."""
    crete = np.max(np.abs(y)) + 1e-12
    actif = np.where(np.abs(y) > crete * 10 ** (-60 / 20))[0]
    fin = min(len(y), (actif[-1] if len(actif) else len(y)) + dsp.n_ech(0.05))
    return dsp.fondu(y[:fin], 0.0, min(0.4, fin / dsp.SR / 3))


def produire_morceau(fabrique, index: dict, ecoute: bool, tmp: Path) -> None:
    resultat = fabrique()
    m, tiges = resultat if isinstance(resultat, tuple) else (resultat, {"tout": [p.nom for p in resultat.pistes]})
    ecrire_midi(m, MIDI / f"{m.id}.mid")
    pistes = rendre_pistes(m, tmp)
    st = mixer_tiges(m, pistes, tiges)
    mono = masteriser(m, st)
    total = mono.pop("_somme")
    if m.boucle:
        for nom, x in mono.items():
            encoder(x, SORTIE / f"{m.id}-{nom}.ogg", tmp, amorce=True)
        index[m.id] = {"seconds": round(len(total) / dsp.SR, 3), "stems": sorted(mono)}
        melange = total
    else:
        total = rogner_jingle(total)
        encoder(total, SORTIE / f"{m.id}.ogg", tmp, amorce=False)
        index[m.id] = {"seconds": round(len(total) / dsp.SR, 3), "stems": []}
        melange = total
    if ecoute:
        wav = tmp / f"{m.id}-ecoute.wav"
        dsp.ecrire_wav(wav, melange * 10 ** (-2.0 / 20))
        ECOUTE.mkdir(parents=True, exist_ok=True)
        dsp.ffmpeg("-i", str(wav), "-map_metadata", "-1", "-c:a", "aac", "-b:a", "56k", "-movflags", "+faststart",
                   "-metadata", f"title={m.titre}", "-metadata", "artist=Studio Duo", str(ECOUTE / f"{m.id}.m4a"))
    print(f"{m.id}: {index[m.id]['seconds']} s", flush=True)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--seulement", nargs="*", default=None)
    ap.add_argument("--ecoute", action="store_true")
    ap.add_argument("--midi-seulement", action="store_true")
    args = ap.parse_args()
    index_fichier = SORTIE / "index.json"
    index = json.loads(index_fichier.read_text()) if index_fichier.exists() else {}
    fabriques = []
    for f in MORCEAUX + JINGLES:
        nom = f.__name__.replace("_", "-")
        if args.seulement is None or any(s in nom or s == nom for s in args.seulement):
            fabriques.append(f)
    with tempfile.TemporaryDirectory() as t:
        for f in fabriques:
            if args.midi_seulement:
                r = f()
                m = r[0] if isinstance(r, tuple) else r
                ecrire_midi(m, MIDI / f"{m.id}.mid")
                print(f"{m.id}.mid", flush=True)
                continue
            produire_morceau(f, index, args.ecoute, Path(t))
    if not args.midi_seulement:
        SORTIE.mkdir(parents=True, exist_ok=True)
        index_fichier.write_text(json.dumps(dict(sorted(index.items())), indent=2, ensure_ascii=False) + "\n")


if __name__ == "__main__":
    main()
