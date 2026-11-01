"""Régénère tout l'audio de La Petite Ligne, en une commande (depuis la racine du dépôt):

    duo-python games/la-petite-ligne/assets-src/son/generer.py

Options: --seulement musiques|sons|planche (plusieurs possibles), --sans-controle.

Produit:
- games/la-petite-ligne/assets/son/: musique/, ambiance/, effets/, train/, interface/, habitants/, moments/
  (Ogg Vorbis, 48 kHz) et sons.json (définitions lues par le moteur);
- games/la-petite-ligne/assets-src/son/midi/: les partitions MIDI (sources de vérité des musiques);
- design/son/la-petite-ligne/: copies M4A des musiques et planche d'écoute ecoute.m4a, pour le client;
puis lance controler.py (mesures ebur128, raccords des boucles) qui écrit controles/mesures.csv.

Prérequis: `bash outils/installer-outils.sh` (duo-python, fluidsynth et la banque FluidR3_GM),
ffmpeg avec libvorbis et aac. Aucun réseau, aucun échantillon externe hormis la banque General MIDI.
Le rendu est déterministe (graines fixes): relancer donne les mêmes fichiers.
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
SORTIE = RACINE_DEPOT / "games" / "la-petite-ligne" / "assets" / "son"
DESIGN = RACINE_DEPOT / "design" / "son" / "la-petite-ligne"
sys.path.insert(0, str(ICI))
sys.dont_write_bytecode = True  # pas de __pycache__ dans le dossier versionné

import ambiances  # noqa: E402
import dsp  # noqa: E402
import effets  # noqa: E402
import habitants  # noqa: E402
import moments  # noqa: E402
import musiques  # noqa: E402
import partition  # noqa: E402
import saisons  # noqa: E402
import train  # noqa: E402
from catalogue import SPATIAL, Son  # noqa: E402

QUALITE_MUSIQUE = 3  # Vorbis VBR, environ 110 kbit/s en stéréo
QUALITE_EFFETS = 4  # sons brefs: transitoires nets, poids négligeable
QUALITE_AMBIANCE = 2  # lits de bruit mono: aucun défaut mesurable à ce débit
DEBIT_M4A = "96k"
PLAFOND_DBTP = -1.5  # avant encodage; le contrôle exige -1,0 dBTP après décodage
AMORCE_MUSIQUE = 1.0  # secondes de part et d'autre de la boucle dans le fichier livré
# Le raccord d'une boucle musicale est placé 0,12 s avant le premier temps: entre deux notes, sur un
# son qui décroît, jamais sur une attaque (là où le codage Vorbis est le plus bruité). Aucune note ne
# tombe à cet endroit dans les tempos utilisés (croches espacées de 0,25 s au moins).
ROTATION_MUSIQUE = 0.12

BUS_FR = {"music": "musique", "effects": "effets", "ui": "interface", "ambience": "ambiance"}

INFOS_MUSIQUE = {
    "titre": ("Écran titre du jeu", "ré majeur", "flûte, cor, hautbois, piano, cordes, harpe"),
    "petit-dejeuner": ("Petit-déjeuner (6 h, écran de chacun)", "fa majeur", "basson, clarinette, piano, pizzicati"),
    "halte-matin": ("Journée dehors, de 6 h à 13 h", "sol majeur", "flûte, hautbois, guitare, pizzicati, harpe, cordes"),
    "halte-apres-midi": ("Journée dehors, de 13 h à 19 h", "sol majeur",
                         "clarinette, accordéon, violoncelle, guitare, contrebasse"),
    "halte-ete": ("Journée dehors en été (proposé: 13 h à 19 h, à la place de l'après-midi)", "sol majeur",
                  "violon, flûte, violoncelle, guitare, pizzicati, harpe"),
    "samedi": ("Samedi, train à quai (10 h à 16 h): marché sur le quai", "do majeur",
               "accordéon, clarinette, guitare, contrebasse, tambourin"),
    "veillee": ("Veillée à deux dans la maison (dès 19 h)", "ré majeur", "clarinette et flûte en duo, guitare, violoncelle"),
    "nuit": ("Écran de nuit, quand les deux sont couchés", "fa majeur", "harpe, célesta, flûte, cordes"),
    "fanfare-train": ("Le train entre en gare (samedi 10 h), une fois", "do majeur", "trompette, cor, accordéon, tuba"),
    "fin": ("Départ du train du jour 8, récapitulatif et écran de fin, une fois", "sol majeur",
            "flûte, clarinette, guitare, cordes, harpe, cor"),
}


def graine(texte: str) -> int:
    return zlib.crc32(texte.encode("utf-8"))


def _filtre_circulaire_iir(x: np.ndarray, fc: float) -> np.ndarray:
    n = len(x)
    trois = np.concatenate([x, x, x])
    return dsp.ph(trois, fc, 2)[n:2 * n]


def traiter(son: Son, v: int) -> np.ndarray:
    rng = np.random.default_rng(graine(f"{son.id}/{v}") + son.graine)
    x = son.fabrique(v, rng)
    x = dsp.mono(x) if son.canaux == 1 else dsp.stereo(x)
    if son.boucle:
        if son.passe_haut > 0:
            x = _filtre_circulaire_iir(x, son.passe_haut)
        x = dsp.amener_integree(x, son.sonie, circulaire=True)
        tp = dsp.crete_vraie_db(np.concatenate([x, x[:4800]]))
        if tp > PLAFOND_DBTP:
            x = x * 10 ** ((PLAFOND_DBTP - tp) / 20)
        return x
    if son.queue_reverbe:
        rt60, humide = son.queue_reverbe
        ir = dsp.ir_salle(rt60, 0.012, 0.45, graine=graine(son.id) % 1000, largeur=0.8)
        x = dsp.reverbe(x, ir, humide, 1.0) if son.canaux == 2 else dsp.reverbe_mono(x, ir, humide, 1.0)
    if son.passe_haut > 0:
        x = dsp.ph(x, son.passe_haut, 2)
    # Pas de silence en tête (latence au déclenchement), pas de longue queue inaudible.
    env = np.abs(x) if x.ndim == 1 else np.max(np.abs(x), axis=1)
    crete = env.max() + 1e-12
    actifs = np.where(env > crete * 10 ** (-50 / 20))[0]
    debut = max(0, actifs[0] - dsp.n_ech(0.0005))
    fin = min(len(x), np.where(env > crete * 10 ** (-66 / 20))[0][-1] + dsp.n_ech(0.01))
    x = x[debut:fin]
    if son.duree_max and len(x) > dsp.n_ech(son.duree_max):
        x = dsp.fondu(x[:dsp.n_ech(son.duree_max)], 0.0008, min(0.8, son.duree_max * 0.3))
    x = dsp.fondu(x, 0.0008, min(0.04, 0.2 * len(x) / dsp.SR))
    return dsp.amener_momentanee(x, son.sonie, PLAFOND_DBTP)


def amorcer(x: np.ndarray, amorce: float) -> tuple[np.ndarray, int]:
    """Fichier livré: la fin de la boucle avant, son début après. On boucle loin des bords du flux."""
    a = dsp.n_ech(amorce)
    return np.concatenate([x[-a:], x, x[:a]]), a


def encoder(x: np.ndarray, sortie: Path, qualite: float, tmp: Path) -> None:
    wav = tmp / (sortie.stem + ".wav")
    dsp.ecrire_wav(wav, x)
    dsp.encoder_ogg(wav, sortie, qualite)


def produire_sons(tous: list[Son], tmp: Path) -> tuple[dict, dict[str, np.ndarray]]:
    defs = {}
    apercus: dict[str, np.ndarray] = {}
    for son in tous:
        durees = []
        for v in range(son.variantes):
            x = traiter(son, v)
            fichier = SORTIE / son.fichiers()[v]
            if son.boucle:
                amorce = min(0.5, len(x) / dsp.SR / 4)
                livre, a = amorcer(x, amorce)
                q = QUALITE_AMBIANCE if son.bus == "ambience" else QUALITE_EFFETS
                encoder(livre, fichier, q, tmp)
                durees.append(round(1000 * len(x) / dsp.SR))
                boucle = {"startSeconds": round(a / dsp.SR, 6), "endSeconds": round((a + len(x)) / dsp.SR, 6),
                          "startSample": a, "endSample": a + len(x), "sampleRate": dsp.SR}
            else:
                encoder(x, fichier, QUALITE_EFFETS, tmp)
                durees.append(round(1000 * len(x) / dsp.SR))
            apercus[f"{son.id}/{v}"] = x
        d = {
            "event": son.evenement,
            "bus": son.bus,
            "priority": son.priorite,
            "files": son.fichiers(),
            "pick": "shuffle-no-repeat" if son.variantes > 1 else "single",
            "pitchVariation": son.hauteur,
            "gainVariationDb": son.gain_var_db,
            "volumeDb": 0.0,
            "minIntervalMs": son.intervalle_min_ms,
            "maxVoices": son.voix_max,
            "duckMusicDb": son.duck_db,
            "channels": son.canaux,
            "spatial": dict(SPATIAL[son.spatial]) if son.spatial else None,
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


def produire_musiques(tmp: Path, ids: list[str] | None = None) -> tuple[dict, dict[str, np.ndarray]]:
    defs = {}
    audio = {}
    for id_, fabrique in musiques.MORCEAUX.items():
        if ids and id_ not in ids:
            continue
        t0 = time.time()
        m = fabrique()
        erreurs = partition.frottements(m)
        if erreurs:
            raise SystemExit(f"{id_}: frottements dans l'écriture:\n  " + "\n  ".join(erreurs))
        y, resume = partition.produire(m, ICI / "midi")
        evenement, tonalite, instruments = INFOS_MUSIQUE[id_]
        fichier = SORTIE / "musique" / f"{id_}.ogg"
        d = {"event": evenement, "bus": "music", "file": f"musique/{id_}.ogg", "key": tonalite,
             "tempoBpm": m.tempo, "timeSignature": f"{m.signature[0]}/{m.signature[1]}", "instruments": instruments,
             "integratedLufs": m.sonie_cible, "volumeDb": -4.0}
        if m.boucle:
            r = dsp.n_ech(ROTATION_MUSIQUE)
            tournee = np.roll(y, r, axis=0)  # la boucle commence 0,12 s avant le premier temps
            livre, a = amorcer(tournee, AMORCE_MUSIQUE)
            encoder(livre, fichier, QUALITE_MUSIQUE, tmp)
            d["loop"] = {"startSeconds": a / dsp.SR, "endSeconds": (a + len(y)) / dsp.SR, "startSample": a,
                         "endSample": a + len(y), "sampleRate": dsp.SR, "bars": m.mesures,
                         "firstDownbeatSeconds": round((a + r) / dsp.SR, 6)}
            d["playFromSeconds"] = round((a + r) / dsp.SR, 6)
            d["fadeInMs"] = 2500
            d["fadeOutMs"] = 2500
        else:
            encoder(y, fichier, QUALITE_MUSIQUE, tmp)
            d["loop"] = None
            d["durationSeconds"] = round(len(y) / dsp.SR, 3)
            d["fadeInMs"] = 0
            d["fadeOutMs"] = 1500
        defs[id_] = d
        audio[id_] = y
        wav = tmp / f"{id_}-m4a.wav"
        dsp.ecrire_wav(wav, y)
        dsp.encoder_m4a(wav, DESIGN / "musiques" / f"{id_}.m4a", DEBIT_M4A, f"La Petite Ligne: {m.titre}")
        print(f"  {id_}: {len(y) / dsp.SR:.1f} s, pistes {resume['gains_db']} ({time.time() - t0:.0f} s)", flush=True)
    return defs, audio


def tous_les_sons() -> list[Son]:
    return effets.sons() + train.sons() + ambiances.sons() + habitants.sons() + moments.sons() + saisons.sons()


PLAN = {
    "musicByMoment": [
        {"moment": "écran titre du jeu", "music": "titre"},
        {"moment": "petit-déjeuner (6 h, jusqu'à ce que l'un sorte)", "music": "petit-dejeuner"},
        {"moment": "dehors, 6 h à 13 h", "music": "halte-matin", "rest": True},
        {"moment": "dehors, 13 h à 19 h", "music": "halte-apres-midi", "rest": True},
        {"moment": "dehors l'été, 13 h à 19 h (proposé, à la place de halte-apres-midi)", "music": "halte-ete",
         "rest": True},
        {"moment": "samedi, du sifflet d'arrivée (10 h) au départ (16 h), près du quai et sur la place",
         "music": "samedi", "rest": True},
        {"moment": "veillée (les deux dans la maison dès 19 h)", "music": "veillee"},
        {"moment": "écran de nuit (les deux couchés)", "music": "nuit"},
        {"moment": "le train s'arrête au quai (samedi 10 h)", "music": "fanfare-train", "once": True},
        {"moment": "le train du jour 8 est parti: récapitulatif et écran de fin", "music": "fin", "once": True},
    ],
    "rest": {
        "description": "Contre la lassitude sur une longue séance: la musique du jour joue une boucle, puis "
                       "laisse la place aux ambiances un moment, puis revient (fondu de 2,5 s).",
        "playLoops": 1,
        "silenceSeconds": [40, 80],
    },
    # Tour 8: les règles de saison (`seasons`: seulement ces saisons; `exceptSeasons`: pas pendant
    # celles-ci, l'ambiance de la saison prend sa place) et la brume du matin (`morningMist`), lues
    # par le moteur depuis que la saison et world.morningMist sont dans l'état.
    "ambienceByTime": [
        {"ambience": "birds-morning", "hours": [6, 12], "volumeDb": 0.0, "notWhen": "pluie",
         "exceptSeasons": ["autumn"]},
        {"ambience": "birds-morning", "hours": [12, 19], "volumeDb": -6.0, "notWhen": "pluie"},
        {"ambience": "crickets", "hours": [19, 30], "volumeDb": 0.0, "notWhen": "pluie",
         "exceptSeasons": ["summer", "winter"]},
        {"ambience": "village", "hours": [8, 19], "volumeDb": 0.0},
        {"ambience": "wind", "hours": [6, 30], "volumeDb": -3.0, "exceptSeasons": ["autumn"]},
        {"ambience": "river", "hours": [6, 30], "volumeDb": 0.0},
        {"ambience": "rain", "when": "pluie (jour 4), dehors", "volumeDb": 0.0},
        {"ambience": "rain-roof", "when": "pluie, dans la maisonnette", "volumeDb": 0.0},
        # Moins d'oiseaux chanteurs en automne.
        {"ambience": "birds-morning", "hours": [6, 12], "volumeDb": -6.0, "notWhen": "pluie", "seasons": ["autumn"]},
        {"ambience": "crickets-summer", "hours": [19, 30], "volumeDb": 0.0, "notWhen": "pluie", "seasons": ["summer"]},
        {"ambience": "swifts", "hours": [7, 21], "volumeDb": 0.0, "notWhen": "pluie", "seasons": ["summer"]},
        {"ambience": "wind-leaves", "hours": [6, 30], "volumeDb": -3.0, "seasons": ["autumn"]},
        {"ambience": "crows", "hours": [7, 18], "volumeDb": 0.0, "notWhen": "pluie", "seasons": ["autumn"]},
    ],
    "morningMist": {"description": "Matins de brume (world.morningMist, tour 8): l'ambiance suit la nappe visible "
                                   "(pleine jusqu'à 9 h, éteinte à 10 h 30, d'après weather.mist du jeu); tant "
                                   "qu'elle dure, oiseaux et bourg un peu plus bas.",
                    "ambience": "mist-morning", "volumeDb": 0.0,
                    "alsoLowerDb": {"birds-morning": -4.0, "village": -3.0}},
    "seasonTurn": {"description": "Premier jour d'une saison, au petit-déjeuner, sous la carte de saison: "
                                  "jouer le son de la saison du jour, une fois, chez les deux.",
                   "sounds": {"spring": "season-turn-spring", "summer": "season-turn-summer",
                              "autumn": "season-turn-autumn", "winter": "season-turn-winter"}},
    "interior": {"description": "Dans la maisonnette: les ambiances du dehors passent derrière les murs.",
                 "ambienceLowpassHz": 900, "ambienceDb": -10.0, "rampMs": 600},
    "peer": {"description": "Les sons de l'autre joueur sont placés à sa position (PannerNode) et joués "
                            "un peu plus bas que les siens; ses sons d'interface ne s'entendent pas chez soi, "
                            "sauf le repère (ping-peer) et la proposition d'achat.",
             "peerWorldSoundsDb": -3.0},
    "sequences": {
        "train-arrival": {
            "description": "Arrivée du samedi: la locomotive atteint le quai à 14 s, s'arrête à 18,3 s.",
            "steps": [
                {"at": 0.0, "play": "train-whistle", "farVariant": "train-whistle-far"},
                {"at": 0.4, "play": "train-approach"},
                {"at": 11.0, "play": "station-bell"},
                {"at": 14.0, "play": "train-brake"},
                {"at": 18.3, "play": "train-steam"},
                {"at": 18.6, "play": "fanfare-train", "kind": "music"},
                {"at": 19.0, "play": "train-idle-loop", "until": "train-departure"},
                {"at": 32.0, "play": "samedi", "kind": "music"},
            ],
        },
        "train-departure": {
            "description": "Départ de 16 h: cloche, sifflet de Firmin, sifflet du train, puis le train s'éloigne.",
            "steps": [
                {"at": 0.0, "play": "station-bell"},
                {"at": 2.2, "play": "guard-whistle"},
                {"at": 3.8, "play": "train-whistle", "farVariant": "train-whistle-far"},
                {"at": 4.6, "stop": "train-idle-loop", "fadeMs": 800},
                {"at": 4.6, "play": "train-depart"},
                {"at": 6.0, "stopMusic": "samedi", "fadeMs": 4000},
            ],
        },
        "wake-up": {"steps": [{"at": 0.0, "play": "wake-rooster"}, {"at": 1.6, "play": "wake"},
                              {"at": 3.5, "play": "petit-dejeuner", "kind": "music"}]},
        "go-to-bed": {"steps": [{"at": 0.0, "play": "sleep"}, {"at": 0.0, "stopMusic": "veillee", "fadeMs": 2000},
                                {"at": 2.5, "play": "nuit", "kind": "music", "when": "les deux couchés"}]},
    },
}


def ecrire_json(defs_sons: dict, defs_musique: dict) -> None:
    ancien = {}
    chemin = SORTIE / "sons.json"
    if chemin.exists():
        ancien = json.loads(chemin.read_text(encoding="utf-8"))
    contenu = {
        "description": "Sons et musiques de La Petite Ligne. Généré par assets-src/son/generer.py, ne pas modifier "
                       "à la main. Document sonore: docs/jeux/jeu-1/son.md.",
        "version": 1,
        "sampleRate": dsp.SR,
        "buses": {
            "music": {"label": "Musique", "defaultVolume": 0.8},
            "effects": {"label": "Effets", "defaultVolume": 1.0},
            "ui": {"label": "Interface", "defaultVolume": 0.9},
            "ambience": {"label": "Ambiance", "defaultVolume": 0.9, "fallbackBus": "effects",
                         "note": "si le SDK n'a que trois bus, l'ambiance passe par un sous-bus des effets"},
        },
        "mix": {
            "duck": {"attackMs": 80, "releaseMs": 900},
            "masterLimiter": {"thresholdDb": -3.0, "kneeDb": 0.0, "ratio": 20.0, "attackMs": 3.0, "releaseMs": 250.0},
            "musicCrossfadeMs": 2500,
            "maxEffectVoices": 24,
            "pitchVariationIsPlaybackRate": True,
        },
        "sounds": defs_sons or ancien.get("sounds", {}),
        "music": defs_musique or ancien.get("music", {}),
        "plan": PLAN,
    }
    chemin.write_text(json.dumps(contenu, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


# --- Planche d'écoute ----------------------------------------------------------------------

def _st(x: np.ndarray) -> np.ndarray:
    return dsp.stereo(x)


def planche(apercus: dict[str, np.ndarray], tmp: Path) -> None:
    """Extraits des musiques (autour du raccord pour les boucles), le train, puis les effets, les
    ambiances et les motifs. Chaque élément est séparé par un court silence."""
    morceaux = []
    blanc = lambda s: np.zeros((dsp.n_ech(s), 2))  # noqa: E731
    ordre_musique = ["halte-matin", "halte-apres-midi", "halte-ete", "veillee", "petit-dejeuner", "nuit", "samedi", "titre",
                     "fanfare-train", "fin"]
    defs_musique = json.loads((SORTIE / "sons.json").read_text(encoding="utf-8"))["music"]
    for id_ in ordre_musique:
        # Toujours à partir des fichiers livrés: le client entend exactement ce que joue le jeu.
        y = dsp.decoder(SORTIE / "musique" / f"{id_}.ogg")
        d = defs_musique[id_]
        if d.get("loop"):
            y = y[d["loop"]["startSample"]:d["loop"]["endSample"]]
        if id_ in ("fanfare-train", "fin"):
            extrait = y
        else:
            # 14 s avant la fin de la boucle puis 10 s après son début: on entend le raccord.
            extrait = np.concatenate([y[-dsp.n_ech(14):], y[:dsp.n_ech(10)]])
            extrait = dsp.fondu(extrait, 1.5, 2.0)
        morceaux += [_st(extrait), blanc(1.5)]
    # Le train, en séquence (rapprochée)
    seq = np.zeros((dsp.n_ech(70), 2))
    def a(nom, t, gain=1.0):  # noqa: E306
        x = apercus.get(nom)
        if x is not None:
            dsp.poser(seq, _st(x) * gain, t)
    a("train-whistle/0", 0.0, 0.5)
    a("train-approach/0", 0.4)
    a("station-bell/0", 11.0, 0.7)
    a("train-brake/0", 14.0)
    a("train-steam/0", 18.3, 0.8)
    idle = apercus.get("train-idle-loop/0")
    if idle is not None:
        dsp.poser(seq, _st(np.concatenate([idle, idle])) * 0.8, 19.0)
    a("station-bell/0", 30.0, 0.7)
    a("guard-whistle/0", 32.2, 0.8)
    a("train-whistle/0", 33.8, 0.6)
    a("train-depart/0", 34.6)
    seq = seq[: dsp.n_ech(52)]
    seq = dsp.fondu(seq, 0.01, 1.0)
    morceaux += [seq, blanc(1.0), _st(apercus.get("train-whistle-far/0", np.zeros(10))), blanc(1.6)]
    groupes = [
        ["step-grass", "step-path", "step-wood", "step-stone"],
        ["hoe", "sow", "water", "water-empty", "water-fill", "harvest", "quality-fine", "quality-superb"],
        ["axe-chop", "tree-crack", "tree-fall", "saw-loop", "saw-end", "hammer", "build-done", "furniture-place",
         "furniture-rotate"],
        ["pickup", "bag", "door-open", "door-close", "chest-open", "chest-close", "crate-deposit", "order-stamp",
         "coins"],
        ["ui-focus", "ui-next", "ui-tab", "ui-confirm", "ui-back", "ui-panel-open", "ui-panel-close", "ui-refusal",
         "notify"],
        ["ping-self", "ping-peer", "journal-open", "journal-new", "purchase-proposal", "purchase-accept",
         "purchase-decline", "ui-click", "tool-switch"],
        ["fishing-cast", "fishing-splash", "fishing-bite", "fishing-catch", "fishing-escape"],
        ["duo-hop", "duo-carry-loop", "duo-done", "stove-light", "stove-loop", "eat", "hen", "sleep", "wake-rooster",
         "wake"],
        ["talk-odette", "talk-firmin", "talk-lucie", "talk-basile", "talk-jeanne"],
        ["bench-sit"],
        ["heron-wade", "heron-strike", "heron-croak", "heron-wings", "heron-land"],
        ["geese-rest", "geese-alarm", "geese-takeoff", "geese-flight"],
        ["ladder-lean", "ladder-grip", "ladder-step", "nest-box-turn", "hammer-tap", "tit-call"],
        ["tit-song", "tit-wings", "fox-pounce", "fox-bark", "hens-alarm"],
        ["crickets-night", "glow-shimmer"],
        ["roe-call", "fawn-rustle", "fawn-bleat", "deer-stamp", "roe-bark", "deer-bounds"],
        ["kf-whistle", "kf-dive", "kf-beat"],
        ["mist-ambience", "mist-lift", "blackbird-wake", "fish-jump"],
        ["season-turn-spring", "season-turn-summer", "season-turn-autumn", "season-turn-winter"],
        ["pick-herb", "pick-mushroom", "pick-berries", "pick-nuts", "axe-thud-soft"],
    ]
    for groupe in groupes:
        for nom in groupe:
            k = 0
            while f"{nom}/{k}" in apercus:
                x = apercus[f"{nom}/{k}"]
                if nom.endswith("loop") or nom in ("geese-rest", "crickets-night", "mist-ambience"):
                    x = np.concatenate([x, x])[: dsp.n_ech(min(5.0, 2 * len(x) / dsp.SR))]
                    x = dsp.fondu(x, 0.01, 0.3)
                morceaux += [_st(x), blanc(0.35 if nom.startswith("step") else 0.7)]
                k += 1
        morceaux.append(blanc(1.2))
    for nom in ("river", "wind", "birds-morning", "crickets", "village", "rain", "rain-roof", "mist-morning",
                "swifts", "crickets-summer", "wind-leaves", "crows"):
        x = apercus.get(f"{nom}/0")
        if x is None:
            continue
        extrait = dsp.fondu(np.concatenate([x[-dsp.n_ech(4):], x[:dsp.n_ech(6)]]), 0.8, 1.2)
        morceaux += [_st(extrait), blanc(0.8)]
    tout = np.concatenate(morceaux)
    tp = dsp.crete_vraie_db(tout)
    if tp > PLAFOND_DBTP:
        tout *= 10 ** ((PLAFOND_DBTP - tp) / 20)
    wav = tmp / "ecoute.wav"
    dsp.ecrire_wav(wav, tout)
    dsp.encoder_m4a(wav, DESIGN / "ecoute.m4a", DEBIT_M4A, "La Petite Ligne: planche d'écoute")
    print(f"  planche: {len(tout) / dsp.SR / 60:.1f} min", flush=True)


def main() -> int:
    parser = argparse.ArgumentParser(description="Régénère l'audio de La Petite Ligne")
    parser.add_argument("--seulement", nargs="*", choices=["musiques", "sons", "planche"],
                        help="ne refaire que ces parties (la planche est refaite à partir des fichiers)")
    parser.add_argument("--musiques", nargs="*", help="ne refaire que ces musiques (identifiants)")
    parser.add_argument("--sans-controle", action="store_true")
    args = parser.parse_args()
    parties = set(args.seulement or ["musiques", "sons", "planche"])
    SORTIE.mkdir(parents=True, exist_ok=True)
    DESIGN.mkdir(parents=True, exist_ok=True)
    defs_sons: dict = {}
    defs_musique: dict = {}
    apercus: dict = {}
    with tempfile.TemporaryDirectory() as dossier:
        tmp = Path(dossier)
        if "musiques" in parties:
            print("Musiques:", flush=True)
            defs_musique, _ = produire_musiques(tmp, args.musiques)
            if args.musiques:
                ancien = json.loads((SORTIE / "sons.json").read_text(encoding="utf-8")).get("music", {})
                defs_musique = {**ancien, **defs_musique}
        if "sons" in parties or "planche" in parties:
            print("Sons:", flush=True)
            if "sons" in parties:
                defs_sons, apercus = produire_sons(tous_les_sons(), tmp)
            else:
                apercus = _relire_sons()
        ecrire_json(defs_sons, defs_musique)
        if "planche" in parties:
            print("Planche d'écoute:", flush=True)
            planche(apercus, tmp)
    if not args.sans_controle:
        return subprocess.run([sys.executable, str(ICI / "controler.py")]).returncode
    return 0


def _relire_sons() -> dict[str, np.ndarray]:
    defs = json.loads((SORTIE / "sons.json").read_text(encoding="utf-8"))["sounds"]
    apercus = {}
    for id_, d in defs.items():
        for k, f in enumerate(d["files"]):
            x = dsp.decoder(SORTIE / f, d["channels"])
            if d.get("loop"):
                x = x[d["loop"]["startSample"]:d["loop"]["endSample"]]
            apercus[f"{id_}/{k}"] = x
    return apercus


if __name__ == "__main__":
    sys.exit(main())
