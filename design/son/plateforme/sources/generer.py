"""Régénère toute l'identité sonore de la plateforme Duo, en une commande:

    duo-python design/son/plateforme/sources/generer.py

Produit, dans design/son/plateforme/:
- ogg/: les sons d'interface et la boucle du salon, pour l'application (Ogg Vorbis, 48 kHz);
- m4a/: une copie AAC de chaque fichier, numérotée dans l'ordre du tableau, pour l'écoute sur Mac;
- ecoute.m4a: la planche d'écoute (tous les sons, séparés par un court silence, puis le raccord
  de la boucle);
- sons.json: les définitions lues par le module audio (bus, priorité, variantes, variations);
- sources/salon.mid: la partition de la musique.
Puis lance controler.py (mesures ebur128 dans controles/mesures.csv).

Sans réseau, sans banque de sons: tout est synthétisé (numpy, scipy, pedalboard, mido).
Prérequis: `bash outils/installer-outils.sh` (duo-python), ffmpeg avec libvorbis et aac.
"""

from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

import numpy as np
from scipy.io import wavfile

ICI = Path(__file__).resolve().parent
RACINE = ICI.parent
sys.path.insert(0, str(ICI))

import interface  # noqa: E402
import salon  # noqa: E402
from synthese import (SR, couper_queue, crete_vraie_db, passe_haut, plateau_aigu,  # noqa: E402
                      reverbe, sonie_momentanee_max)

QUALITE_OGG_SONS = 3  # Vorbis VBR, environ 112 kbit/s en stéréo pleine, bien moins sur les queues
QUALITE_OGG_MUSIQUE = 1.5  # environ 88 kbit/s: une nappe douce le supporte sans défaut mesurable
# Copies d'écoute: à 64 kbit/s, l'énergie de chaque octave reste à 1 dB de la source jusqu'à 12 kHz
# (mesuré), et ces sons n'ont presque rien au-dessus de 8 kHz.
DEBIT_M4A_SONS = "64k"
DEBIT_M4A_MUSIQUE = "64k"
DEBIT_M4A_PLANCHE = "64k"
PLAFOND_DBTP = -1.5  # avant encodage; le contrôle exige -1,0 dBTP après décodage

SILENCE_ENTRE_SONS = 0.7
SILENCE_ENTRE_GROUPES = 1.6
EXTRAIT_RACCORD = 8.0  # secondes de part et d'autre du point de boucle dans la planche

BUS = {"interface": "ui", "effets": "effects", "musique": "music"}


def ffmpeg(*args: str) -> None:
    subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", *args], check=True)


def ecrire_wav(chemin: Path, x: np.ndarray) -> None:
    wavfile.write(str(chemin), SR, x.astype(np.float32))


def encoder_ogg(wav: Path, sortie: Path, qualite: float) -> None:
    ffmpeg("-i", str(wav), "-map_metadata", "-1", "-fflags", "+bitexact", "-flags:a", "+bitexact",
           "-c:a", "libvorbis", "-q:a", str(qualite), str(sortie))


def encoder_m4a(wav: Path, sortie: Path, debit: str, titre: str) -> None:
    ffmpeg("-i", str(wav), "-map_metadata", "-1", "-fflags", "+bitexact", "-flags:a", "+bitexact",
           "-c:a", "aac", "-b:a", debit, "-metadata", f"title={titre}", "-metadata", "artist=Studio Duo",
           "-movflags", "+faststart", str(sortie))


def traiter(son: interface.Son, variante: int) -> tuple[np.ndarray, dict]:
    x = son.fonction(variante)
    x = np.concatenate([x, np.zeros((int(1.5 * SR), 2))])  # place pour la queue de réverbération
    x = passe_haut(x, 120.0)  # rien sous 120 Hz: inutile sur des haut-parleurs de portable
    x = plateau_aigu(x, 6000.0, -3.0)  # aigus adoucis: confort sur une longue soirée
    x = reverbe(x, **son.reverbe)
    x = couper_queue(x, seuil_db=-54.0)  # au-delà, plus bas que -60 dBFS: inaudible
    brut = sonie_momentanee_max(x)
    x = x * 10 ** ((son.cible_lufs - brut) / 20.0)
    tp = crete_vraie_db(x)
    reduit = 0.0
    if tp > PLAFOND_DBTP:
        reduit = PLAFOND_DBTP - tp
        x = x * 10 ** (reduit / 20.0)
    infos = {
        "duree_s": round(len(x) / SR, 3),
        "sonie_m_max": round(sonie_momentanee_max(x), 2),
        "crete_vraie": round(crete_vraie_db(x), 2),
        "reduction_db": round(reduit, 2),
    }
    return x, infos


def nom_fichier(son: interface.Son, variante: int) -> str:
    return f"{son.id}-{variante + 1}" if son.variantes > 1 else son.id


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--sans-controle", action="store_true", help="ne pas lancer controler.py")
    parser.add_argument("--wav", type=Path, help="garder aussi les WAV intermédiaires dans ce dossier")
    args = parser.parse_args()

    if shutil.which("ffmpeg") is None:
        print("ffmpeg introuvable", file=sys.stderr)
        return 1
    dossier_ogg = RACINE / "ogg"
    dossier_m4a = RACINE / "m4a"
    for dossier in (dossier_ogg, dossier_m4a):
        if dossier.exists():
            shutil.rmtree(dossier)
        dossier.mkdir(parents=True)

    manifeste_sons = {}
    planche: list[np.ndarray] = []
    reperes: list[tuple[float, str]] = []
    curseur = 0.0
    groupe_prec = None

    with tempfile.TemporaryDirectory(prefix="duo-son-") as tmp_str:
        tmp = Path(tmp_str)
        for numero, son in enumerate(interface.SONS, start=1):
            if groupe_prec is not None and son.groupe != groupe_prec:
                planche.append(np.zeros((int(SILENCE_ENTRE_GROUPES * SR), 2)))
                curseur += SILENCE_ENTRE_GROUPES
            groupe_prec = son.groupe
            fichiers, durees = [], []
            for v in range(son.variantes):
                x, infos = traiter(son, v)
                base = nom_fichier(son, v)
                wav = tmp / f"{base}.wav"
                ecrire_wav(wav, x)
                encoder_ogg(wav, dossier_ogg / f"{base}.ogg", QUALITE_OGG_SONS)
                suffixe = f"-{v + 1}" if son.variantes > 1 else ""
                nom_m4a = f"{numero:02d}-{son.nom}{suffixe}.m4a"
                encoder_m4a(wav, dossier_m4a / nom_m4a, DEBIT_M4A_SONS, f"{numero:02d} {son.nom}{suffixe}")
                fichiers.append(f"ogg/{base}.ogg")
                durees.append(int(round(infos["duree_s"] * 1000)))
                reperes.append((curseur, f"{numero:02d} {son.nom}{suffixe}"))
                planche.append(x)
                planche.append(np.zeros((int(SILENCE_ENTRE_SONS * SR), 2)))
                curseur += len(x) / SR + SILENCE_ENTRE_SONS
                print(f"{base:22s} {infos}")
            lec = son.lecture
            manifeste_sons[son.id] = {
                "event": son.evenement,
                "bus": BUS[lec.bus],
                "priority": lec.priorite,
                "files": fichiers,
                "pick": "shuffle-no-repeat" if len(fichiers) > 1 else "single",
                "pitchVariation": lec.hauteur,
                "gainVariationDb": lec.gain_db,
                "minIntervalMs": lec.intervalle_ms,
                "retrigger": lec.relance,
                "duckMusicDb": lec.attenue_musique_db,
                "stereo": lec.stereo,
                "loudnessMomentaryMaxLufs": son.cible_lufs,
                "durationMs": durees,
            }

        # Musique du salon.
        chemin_midi = ICI / "salon.mid"
        salon.ecrire_midi(chemin_midi)
        boucle, rapport = salon.rendre(chemin_midi)
        print(f"lounge                 {rapport}")
        numero_musique = len(interface.SONS) + 1
        wav = tmp / "lounge.wav"
        ecrire_wav(wav, boucle)
        wav_amorces = tmp / "lounge-amorces.wav"
        ecrire_wav(wav_amorces, salon.avec_amorces(boucle))
        encoder_ogg(wav_amorces, dossier_ogg / "lounge.ogg", QUALITE_OGG_MUSIQUE)
        encoder_m4a(wav, dossier_m4a / f"{numero_musique:02d}-ambiance-salon.m4a", DEBIT_M4A_MUSIQUE,
                    f"{numero_musique:02d} ambiance du salon (boucle)")

        # Planche: fin de la boucle puis son début, pour entendre le raccord.
        planche.append(np.zeros((int(SILENCE_ENTRE_GROUPES * SR), 2)))
        curseur += SILENCE_ENTRE_GROUPES
        k = int(EXTRAIT_RACCORD * SR)
        extrait = np.concatenate([boucle[-k:], boucle[:k]]).copy()
        fondu = int(2.0 * SR)
        extrait[:fondu] *= np.linspace(0, 1, fondu)[:, None]
        extrait[-fondu:] *= np.linspace(1, 0, fondu)[:, None]
        reperes.append((curseur, f"{numero_musique:02d} ambiance du salon: fin de la boucle"))
        reperes.append((curseur + EXTRAIT_RACCORD, f"{numero_musique:02d} ambiance du salon: point de boucle"))
        planche.append(extrait)
        wav = tmp / "ecoute.wav"
        ecrire_wav(wav, np.concatenate(planche))
        encoder_m4a(wav, RACINE / "ecoute.m4a", DEBIT_M4A_PLANCHE, "Duo, planche d'écoute de la plateforme")
        if args.wav:
            args.wav.mkdir(parents=True, exist_ok=True)
            for f in tmp.glob("*.wav"):
                shutil.copy(f, args.wav / f.name)

    manifeste = {
        "description": "Sons de la plateforme Duo (identité « Étoile double »). Généré par "
                       "sources/generer.py, ne pas modifier à la main. Voir docs/plateforme/identite-sonore.md.",
        "version": 1,
        "sampleRate": SR,
        "buses": ["music", "effects", "ui"],
        "mix": {
            "volumeCurve": "square",
            "masterLimiter": {"thresholdDb": -3.0, "kneeDb": 0.0, "ratio": 20.0, "attackMs": 3.0, "releaseMs": 250.0},
            "duck": {"attackMs": 80, "releaseMs": 700},
            "pausedGame": {"musicDb": -10.0, "musicLowpassHz": 1200, "rampMs": 300},
            "maxUiVoices": 6,
            "programmaticFocusIsSilent": True,
        },
        "sounds": manifeste_sons,
        "music": {
            "lounge": {
                "event": "Ambiance des écrans hors partie (accueil, bibliothèque, salon, réglages)",
                "bus": "music",
                "file": "ogg/lounge.ogg",
                "loop": {
                    "startSeconds": salon.AMORCE,
                    "endSeconds": salon.AMORCE + salon.DUREE_BOUCLE,
                    "startSample": salon.ECHANTILLONS_AMORCE,
                    "endSample": salon.ECHANTILLONS_AMORCE + salon.ECHANTILLONS_BOUCLE,
                    "sampleRate": SR,
                },
                "playFromSeconds": salon.AMORCE,
                "decodeWhole": True,
                "fadeInMs": 3000,
                "fadeOutMs": 1500,
                "integratedLufs": salon.CIBLE_LUFS,
            }
        },
    }
    (RACINE / "sons.json").write_text(json.dumps(manifeste, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    print("\nRepères de la planche ecoute.m4a:")
    for t, nom in reperes:
        print(f"  {int(t // 60)}:{t % 60:04.1f}  {nom}")

    if not args.sans_controle:
        subprocess.run([sys.executable, str(ICI / "controler.py")], check=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
