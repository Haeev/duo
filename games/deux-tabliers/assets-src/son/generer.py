"""Régénère tout l'audio de la démo de Deux Tabliers, en une commande (depuis la racine du dépôt):

    duo-python games/deux-tabliers/assets-src/son/generer.py

Options: --seulement musiques|sons|planche (plusieurs possibles), --musiques ID... (une partie des
musiques), --sans-controle.

Produit:
- games/deux-tabliers/assets/son/: les sons en Ogg Vorbis à leur fréquence de décodage (24 ou
  32 kHz, son.md 8.5.0), les musiques en Ogg Opus stéréo 40 kbit/s (musique/), et sons.json;
- games/deux-tabliers/assets-src/son/midi/: les partitions MIDI (sources de vérité des musiques);
- design/son/deux-tabliers/: copies M4A des musiques et planche d'écoute ecoute.m4a, pour le client;
puis lance controler.py (mesures ebur128, raccords des boucles, mémoire) qui écrit controles/mesures.csv.

Prérequis: `bash outils/installer-outils.sh` (duo-python, fluidsynth et la banque FluidR3_GM),
ffmpeg avec libvorbis, libopus et aac. Aucun réseau, aucun échantillon externe hormis la banque
General MIDI. Graines fixes: relancer donne les mêmes fichiers.
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
import tempfile
import time
import zlib
from pathlib import Path

import numpy as np

ICI = Path(__file__).resolve().parent
RACINE_DEPOT = ICI.parents[3]
SORTIE = RACINE_DEPOT / "games" / "deux-tabliers" / "assets" / "son"
DESIGN = RACINE_DEPOT / "design" / "son" / "deux-tabliers"
sys.path.insert(0, str(ICI))
sys.dont_write_bytecode = True  # pas de __pycache__ dans le dossier versionné

import airs  # noqa: E402
import ambiances  # noqa: E402
import dsp  # noqa: E402
import musiques  # noqa: E402
import partition  # noqa: E402
import postes  # noqa: E402
import salle  # noqa: E402
from catalogue import SPATIAL, Son  # noqa: E402

QUALITE_MONO = 3  # Vorbis, sons brefs mono (son.md, 8.9.1)
QUALITE_STEREO = 4
DEBIT_MUSIQUE = "40k"  # Opus, débit variable contraint (son.md, 8.4.7)
DEBIT_M4A = "128k"
PLAFOND_DBTP = -1.5  # avant encodage; le contrôle exige -1,0 dBTP après décodage
AMORCE_BOUCLE = 0.25  # secondes de part et d'autre d'une boucle dans le fichier livré (son.md, 8.5.0)

BUS = {"music": 0.8, "effects": 1.0, "interface": 0.9, "ambience": 0.9}

INFOS_MUSIQUE = {
    "campagne-1": {"title": "Rosée", "list": "campagne", "listTitle": "Les Prés", "energy": "calm",
                   "station": "douce", "key": "sol majeur", "instruments": "violon, flûte à bec, guitare folk, contrebasse"},
    "campagne-3": {"title": "Le pré d'en bas", "list": "campagne", "listTitle": "Les Prés", "energy": "lively",
                   "station": "entrainante", "key": "sol majeur",
                   "instruments": "violon et flûte à bec à l'unisson, guitare folk, contrebasse, tambourin"},
    "bistrot-1": {"title": "Petit noir", "list": "bistrot", "listTitle": "Le Zinc", "energy": "calm",
                  "station": "douce", "key": "la mineur", "instruments": "accordéon, clarinette, guitare, contrebasse"},
    "bistrot-4": {"title": "Le garçon pressé", "list": "bistrot", "listTitle": "Le Zinc", "energy": "lively",
                  "station": "entrainante", "key": "la mineur",
                  "instruments": "guitare jazz, accordéon, clarinette, guitare en pompe, contrebasse"},
    "title": {"title": "Notre maison (version courte)", "screen": "titre", "key": "fa majeur",
              "instruments": "piano, guitare nylon, contrebasse, accordéon discret, balais"},
    "evening-summary": {"title": "La caisse est faite", "screen": "bilan du soir", "key": "fa majeur",
                        "instruments": "piano, guitare nylon, violoncelle"},
}


def graine(texte: str) -> int:
    return zlib.crc32(texte.encode("utf-8"))


def souffle_de_raccord(x: np.ndarray, rng: np.random.Generator) -> np.ndarray:
    """Un fond de boucle très lisse (presque rien au-dessus de 2,5 kHz) laisse le bruit de codage
    Vorbis marquer le raccord (carnet, LPL 0.13); un souffle aigu périodique 22 dB sous le fond,
    de 2,5 à 10 kHz, le couvre sans s'entendre."""
    m = dsp.mono(x)
    f = np.fft.rfftfreq(len(m), 1.0 / dsp.SR)
    p = np.abs(np.fft.rfft(m)) ** 2
    if p[f > 2500].sum() / (p.sum() + 1e-20) > 0.02:
        return x
    souffle = dsp.bruit_spectral(len(m), rng, -3.0, 2500, 10000) * np.sqrt(np.mean(m ** 2)) * 10 ** (-22 / 20)
    return x + (souffle if x.ndim == 1 else souffle[:, None])


def traiter(son: Son, v: int) -> np.ndarray:
    rng = np.random.default_rng(graine(f"{son.id}/{v}"))
    x = son.fabrique(v, rng)
    x = dsp.mono(x) if son.canaux == 1 else dsp.stereo(x)
    if son.boucle:
        if son.passe_haut > 0:
            x = dsp.circ(lambda y: dsp.ph(y, son.passe_haut, 2), x)
        x = souffle_de_raccord(x, rng)
        x = dsp.amener_integree(x, son.sonie, circulaire=True)
        tp = dsp.crete_vraie_db(np.concatenate([x, x[:4800]]))
        if tp > PLAFOND_DBTP:
            x = dsp.limiter_circulaire(x, PLAFOND_DBTP)
        return x
    if son.queue_reverbe:
        rt60, humide = son.queue_reverbe
        ir = dsp.ir_salle(rt60, 0.008, 0.45, graine=graine(son.id) % 1000, largeur=0.8)
        x = dsp.reverbe(x, ir, humide, 1.0) if son.canaux == 2 else dsp.reverbe_mono(x, ir, humide, 1.0)
    if son.passe_haut > 0:
        x = dsp.ph(x, son.passe_haut, 2)
    env = np.abs(x) if x.ndim == 1 else np.max(np.abs(x), axis=1)
    crete = env.max() + 1e-12
    actifs = np.where(env > crete * 10 ** (-50 / 20))[0]
    debut = max(0, actifs[0] - dsp.n_ech(0.0005))
    fin = min(len(x), np.where(env > crete * 10 ** (-60 / 20))[0][-1] + dsp.n_ech(0.01))
    x = x[debut:fin]
    if son.duree_max and len(x) > dsp.n_ech(son.duree_max):
        x = dsp.fondu(x[:dsp.n_ech(son.duree_max)], 0.0008, min(0.6, son.duree_max * 0.3))
    x = dsp.fondu(x, 0.0008, min(0.04, 0.2 * len(x) / dsp.SR))
    return dsp.amener_momentanee(x, son.sonie, PLAFOND_DBTP)


def produire_sons(tous: list[Son], tmp: Path) -> tuple[dict, dict[str, np.ndarray]]:
    defs = {}
    apercus: dict[str, np.ndarray] = {}
    ids = set()
    for son in tous:
        if son.id in ids:
            raise SystemExit(f"identifiant en double: {son.id}")
        ids.add(son.id)
        durees = []
        boucle = None
        for v in range(son.variantes):
            x = traiter(son, v)
            fichier = SORTIE / son.fichiers()[v]
            q = QUALITE_STEREO if son.canaux == 2 else QUALITE_MONO
            wav = tmp / (fichier.stem + ".wav")
            if son.boucle:
                a = dsp.n_ech(AMORCE_BOUCLE)
                livre = np.concatenate([x[-a:], x, x[:a]])
                dsp.ecrire_wav(wav, livre)
                a_sr = int(round(AMORCE_BOUCLE * son.sr))
                n_sr = int(round(len(x) / dsp.SR * son.sr))
                boucle = {"startSeconds": AMORCE_BOUCLE, "endSeconds": round(AMORCE_BOUCLE + len(x) / dsp.SR, 6),
                          "startSample": a_sr, "endSample": a_sr + n_sr, "sampleRate": son.sr}
            else:
                dsp.ecrire_wav(wav, x)
            dsp.encoder_vorbis(wav, fichier, q, son.sr)
            durees.append(round(1000 * len(x) / dsp.SR))
            apercus[f"{son.id}/{v}"] = x
        d = {
            "event": son.evenement,
            "bus": son.bus,
            "priority": son.priorite,
            "files": son.fichiers(),
            "group": son.dossier,
            "decodeSampleRate": son.sr,
            "pick": "shuffle-no-repeat" if son.variantes > 1 else "single",
            "pitchVariation": son.hauteur,
            "gainVariationDb": son.gain_var_db,
            "volumeDb": 0.0,
            "minIntervalMs": son.intervalle_min_ms,
            "maxVoices": son.voix_max,
            "duckMusicDb": son.duck_db,
            "channels": son.canaux,
            "spatial": dict(SPATIAL[son.spatial]) if son.spatial else None,
            "looping": son.boucle,
            "durationMs": durees,
        }
        if son.boucle:
            d["loop"] = boucle
            d["playFromSeconds"] = boucle["startSeconds"]
            d["integratedLufs"] = son.sonie
        else:
            d["momentaryMaxLufs"] = son.sonie
        if son.note:
            d["note"] = son.note
        d.update(son.extra)
        defs[son.id] = d
        print(f"  {son.id}: {son.variantes} fichier(s), {', '.join(str(x) for x in durees)} ms", flush=True)
    return defs, apercus


def produire_musiques(tmp: Path, ids: list[str] | None = None) -> dict:
    defs = {}
    for id_, fabrique in musiques.MORCEAUX.items():
        if ids and id_ not in ids:
            continue
        t0 = time.time()
        m = fabrique()
        erreurs = partition.frottements(m)
        if erreurs:
            raise SystemExit(f"{id_}: frottements dans l'écriture:\n  " + "\n  ".join(erreurs))
        y, resume = partition.produire(m, ICI / "midi")
        infos = INFOS_MUSIQUE[id_]
        dossier = "radio" if "list" in infos else "ecrans"
        fichier = SORTIE / "musique" / dossier / f"{id_}.ogg"
        wav = tmp / f"{id_}.wav"
        dsp.ecrire_wav(wav, y)
        dsp.encoder_opus(wav, fichier, DEBIT_MUSIQUE)
        # Copie d'écoute 2 dB plus bas: l'AAC dépasse la crête de la source (mesuré: -0,4 dBTP à 0 dB, -0,7 à -1 dB).
        wav_m4a = tmp / f"{id_}-m4a.wav"
        dsp.ecrire_wav(wav_m4a, y * 10 ** (-2 / 20))
        dsp.encoder_m4a(wav_m4a, DESIGN / "musiques" / f"{id_}.m4a", DEBIT_M4A, f"Deux Tabliers: {m.titre}")
        d = {"event": infos.get("screen", "radio du village"), "bus": "music",
             "file": f"musique/{dossier}/{id_}.ogg", "codec": "opus", "streamed": True, "loop": None,
             "durationSeconds": round(len(y) / dsp.SR, 3), "tempoBpm": m.tempo,
             "timeSignature": f"{m.signature[0]}/{m.signature[1]}", "integratedLufs": m.sonie_cible,
             "volumeDb": -5.0 if "screen" in infos else 0.0, "fadeInMs": 0, "fadeOutMs": 1500, **infos}
        defs[id_] = d
        print(f"  {id_}: {len(y) / dsp.SR:.1f} s, pistes {resume['gains_db']} ({time.time() - t0:.0f} s)", flush=True)
    return defs


def tous_les_sons() -> list[Son]:
    return postes.sons() + salle.sons() + ambiances.sons() + airs.sons()


PLAN = {
    "radio": {
        "description": "La radio du village (son.md, 8.4.2 et 8.4.5): deux stations; tirage sans répétition; "
                       "2 à 4 s de souffle de la radio entre deux morceaux (radio-hiss). Traitement en direct de "
                       "l'appareil: mono, passe-haut 180 Hz, passe-bas 5 kHz, bosse de 3 dB à 1,2 kHz, "
                       "compression 3:1. Volume de l'appareil: bas -6 dB, moyen 0, fort +4 dB.",
        "stations": {"douce": ["campagne-1", "bistrot-1"], "entrainante": ["campagne-3", "bistrot-4"]},
        "lists": {"campagne": ["campagne-1", "campagne-3"], "bistrot": ["bistrot-1", "bistrot-4"]},
        "gapSeconds": [2, 4],
        "device": {"mono": True, "highpassHz": 180, "lowpassHz": 5000, "peakHz": 1200, "peakDb": 3.0,
                   "compressorRatio": 3.0, "volumeStepsDb": {"low": -6.0, "medium": 0.0, "high": 4.0},
                   "switchOnFadeMs": 1000},
    },
    "screens": {"title": {"music": "title", "replayAfterSilenceSeconds": 8, "volumeDb": -5.0},
                "eveningSummary": {"music": "evening-summary", "once": True, "volumeDb": -5.0,
                                   "cafeMusicFadeOutMs": 4000}},
    "milkTemperature": {
        "description": "La buse vapeur selon la température du lait (son.md, 8.5.2): fondus à puissance "
                       "constante entre les quatre boucles, mis à jour à chaque image; vitesse de lecture "
                       "interpolée dans chaque plage.",
        "bands": [
            {"fromC": 4, "toC": 35, "mix": {"steam-aerate-loop": [1.0, 0.5], "steam-roll-loop": [0.0, 0.5]},
             "rate": [1.0, 1.05]},
            {"fromC": 35, "toC": 58, "mix": {"steam-roll-loop": [1.0, 1.0]}, "rate": [1.05, 1.12]},
            {"fromC": 58, "toC": 65, "mix": {"steam-roll-loop": [0.6, 0.6], "steam-sing-loop": [0.0, 1.0]},
             "rate": [1.12, 1.16]},
            {"fromC": 65, "toC": 72, "mix": {"steam-sing-loop": [1.0, 0.0], "steam-hot-loop": [0.0, 1.0]},
             "rate": [1.16, 1.22]},
        ],
        "autoStopAtC": 72, "autoStopSound": "steam-auto-stop",
    },
    "murmur": {
        "description": "Rumeur sans paroles (son.md, 8.3.6): une boucle murmur-table par table d'au moins deux "
                       "clients (six tables au plus, départ tiré, vitesse plus ou moins 5 %), et une nappe de salle "
                       "non placée qui suit le nombre de clients; toute la rumeur sous -28 LUFS en momentanée; "
                       "-3 dB pendant tes sons de priorité 1 et 2 (attaque 60 ms, retour 700 ms).",
        "tableGainDb": {"2": -3.0, "3": 0.0, "4": 0.0, "5+": 2.0},
        "roomBeds": [{"sound": "murmur-room-calm", "fromCustomers": 3, "toCustomers": 7},
                     {"sound": "murmur-room-busy", "fromCustomers": 7, "toCustomers": 12},
                     {"sound": "murmur-room-rush", "fromCustomers": 12, "toCustomers": 99}],
        "roomCrossfadeMs": 3000, "duckDb": -3.0, "duckAttackMs": 60, "duckReleaseMs": 700,
    },
    "ambienceByTime": [
        {"ambience": "ext-village-morning", "hours": [6, 14], "notWhen": "pluie"},
        {"ambience": "ext-village-evening", "hours": [14, 22], "notWhen": "pluie"},
        {"ambience": "rain-street", "when": "pluie"},
        {"ambience": "rain-glass", "when": "pluie, dedans, aux vitrines"},
        {"ambience": "room-village", "always": True, "where": "dedans"},
    ],
    "outsideEvents": {
        "description": "Événements de la place du Tilleul tirés au hasard (son.md, 8.3.1), sans répétition "
                       "immédiate, 3 à 15 s entre deux, placés dans la rue.",
        "sounds": ["ext-village-sparrows", "ext-village-blackbird", "ext-village-moped", "ext-village-bakery-door",
                   "ext-village-coach"],
        "intervalSeconds": [3, 15],
        "bell": {"sound": "ext-village-church-noon", "atHour": 12},
    },
    "doorFilter": {"closedDb": -10.0, "closedLowpassHz": 1200, "openRampMs": 250, "closeDelayMs": 400,
                   "description": "Dedans, le dehors sort de la porte et des vitrines (son.md, 8.3.2 et 8.3.4)."},
    "peer": {"description": "Les sons de l'autre joueur sont les mêmes fichiers, placés à sa position, 3 dB plus bas "
                            "et un cran de priorité en dessous (son.md, 8.5.0).", "peerWorldSoundsDb": -3.0,
             "peerPriorityOffset": 1},
}

MIX = {
    "duck": {"attackMs": 80, "releaseMs": 900},
    "effectsCompressor": {"thresholdDb": -24.0, "ratio": 2.0, "kneeDb": 10.0, "attackMs": 15.0, "releaseMs": 250.0},
    "masterLimiter": {"thresholdDb": -3.0, "kneeDb": 0.0, "ratio": 20.0, "attackMs": 3.0, "releaseMs": 250.0},
    "maxVoices": {"loops": 24, "oneShots": 24, "musicStreams": 4},
    "reverb": {"village": {"rt60": 0.4}, "sends": {"gestures": 0.2, "customers": 0.3, "signals": 0.25,
                                                   "musicDevice": 0.25}},
    "pitchVariationIsPlaybackRate": True,
}


def planche(apercus: dict[str, np.ndarray], tous: list[Son], tmp: Path) -> None:
    """Planche d'écoute pour le client: chaque son et ses variantes, 0,5 s de silence entre deux,
    1,5 s entre deux sons; les boucles jouées deux fois (le raccord s'entend)."""
    morceaux = []
    for son in tous:
        for v in range(son.variantes):
            x = dsp.stereo(apercus[f"{son.id}/{v}"])
            if son.boucle:
                x = np.concatenate([x, x])
            morceaux += [x, np.zeros((dsp.n_ech(0.5), 2))]
        morceaux.append(np.zeros((dsp.n_ech(1.0), 2)))
    y = np.concatenate(morceaux)
    wav = tmp / "planche.wav"
    dsp.ecrire_wav(wav, y)
    dsp.encoder_m4a(wav, DESIGN / "ecoute.m4a", "96k", "Deux Tabliers: planche d'écoute des sons")
    ordre = [{"id": s.id, "variants": s.variantes, "loop": s.boucle} for s in tous]
    (DESIGN / "ecoute.json").write_text(json.dumps(ordre, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(description="Génère l'audio de la démo de Deux Tabliers")
    parser.add_argument("--seulement", nargs="+", choices=["musiques", "sons", "planche"])
    parser.add_argument("--musiques", nargs="+")
    parser.add_argument("--sans-controle", action="store_true")
    args = parser.parse_args()
    quoi = set(args.seulement or ["musiques", "sons", "planche"])
    chemin_json = SORTIE / "sons.json"
    ancien = json.loads(chemin_json.read_text(encoding="utf-8")) if chemin_json.exists() else {}
    with tempfile.TemporaryDirectory() as t:
        tmp = Path(t)
        sons_defs = ancien.get("sounds", {})
        musique_defs = ancien.get("music", {})
        tous = tous_les_sons()
        if "sons" in quoi or "planche" in quoi:
            print("Sons:")
            sons_defs, apercus = produire_sons(tous, tmp)
            if "planche" in quoi:
                planche(apercus, tous, tmp)
        if "musiques" in quoi:
            print("Musiques:")
            nouvelles = produire_musiques(tmp, args.musiques)
            musique_defs = {**musique_defs, **nouvelles}
            musique_defs = {k: musique_defs[k] for k in musiques.MORCEAUX if k in musique_defs}
    doc = {
        "description": "Sons et musiques de la démo de Deux Tabliers (café d'Ormeval). Généré par "
                       "games/deux-tabliers/assets-src/son/generer.py: ne pas modifier à la main. Niveaux mesurés "
                       "par ebur128 sur le fichier décodé (momentanée maximale pour un son, intégrée pour une boucle "
                       "ou une musique). Direction sonore: docs/jeux/cosy-cafe/son.md.",
        "version": 1,
        "buses": {k: {"defaultVolume": v} for k, v in BUS.items()},
        "mix": MIX,
        "sounds": sons_defs,
        "music": musique_defs,
        "plan": PLAN,
    }
    chemin_json.parent.mkdir(parents=True, exist_ok=True)
    chemin_json.write_text(json.dumps(doc, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"{chemin_json.relative_to(RACINE_DEPOT)}: {len(sons_defs)} sons, {len(musique_defs)} musiques")
    if args.sans_controle:
        return 0
    return subprocess.run([sys.executable, str(ICI / "controler.py")]).returncode


if __name__ == "__main__":
    sys.exit(main())
