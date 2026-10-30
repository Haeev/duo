"""Musique d'ambiance du salon de Duo: « Deux astres », boucle de 64 secondes.

Ré lydien (ré majeur avec un sol dièse, la quarte augmentée qui fait flotter l'harmonie),
60 battements par minute, 16 mesures à 4 temps: exactement 64 s, soit 3 072 000 échantillons
à 48 kHz et 2 822 400 à 44,1 kHz (nombre entier dans les deux cas).

Couches: une nappe chaude (un accord toutes les deux mesures), une basse ronde, la célesta de
verre (ta voix) et la harpe de verre (celle de l'autre) qui se répondent, puis se mêlent dans la
dernière phrase; quelques étoiles (notes de verre très douces) tirées avec une graine fixe.

La partition est écrite ici en données, exportée en MIDI (salon.mid, versionné), puis relue
depuis ce fichier MIDI pour le rendu: le MIDI est la source de vérité de la musique.
"""

from __future__ import annotations

from pathlib import Path

import mido
import numpy as np

from synthese import (SR, basse, crete_vraie_db, harpe, midi_freq, nappe, note_midi, passe_haut,
                      poser, reverbe, sonie_integree, verre)

TEMPO_BPM = 60
TEMPS_PAR_MESURE = 4
MESURES = 16
DUREE_BOUCLE = MESURES * TEMPS_PAR_MESURE * 60.0 / TEMPO_BPM  # 64 s
ECHANTILLONS_BOUCLE = int(round(DUREE_BOUCLE * SR))
QUEUE = 14.0  # secondes rendues après la boucle, puis repliées sur son début
# Le fichier livré porte une seconde d'amorce de chaque côté: la fin de la boucle avant, son début
# après. On boucle de 1 s à 65 s, loin des bords du flux: ni le bruit de codage Vorbis, ni le
# rééchantillonnage de decodeAudioData (contexte à 44,1 kHz) ne touchent le raccord.
AMORCE = 1.0
ECHANTILLONS_AMORCE = int(round(AMORCE * SR))

# Canaux MIDI et programmes General MIDI (pour une préécoute éventuelle dans FluidSynth).
PISTES = {
    "nappe": {"canal": 0, "programme": 89, "pan": 64},  # Pad 2 (warm)
    "basse": {"canal": 1, "programme": 38, "pan": 64},  # Synth Bass 1
    "celesta": {"canal": 2, "programme": 8, "pan": 48},  # Celesta: ta voix, un peu à gauche
    "harpe": {"canal": 3, "programme": 46, "pan": 84},  # Orchestral Harp: l'autre, à droite
    "etoiles": {"canal": 4, "programme": 9, "pan": 64},  # Glockenspiel
}

# Accords: (premier temps, durée en temps, notes). Deux mesures chacun.
ACCORDS = [
    (0, 8, ["D3", "A3", "E4", "F#4", "C#5"]),  # ré majeur 9
    (8, 8, ["D3", "B3", "E4", "G#4", "C#5"]),  # mi sur ré: la couleur lydienne
    (16, 8, ["B2", "F#3", "D4", "A4", "C#5"]),  # si mineur 9
    (24, 8, ["A2", "E3", "C#4", "E4", "B4"]),  # la quinte ajoutée de neuvième
    (32, 8, ["D3", "A3", "F#4", "C#5", "E5"]),  # ré majeur 9, autre position
    (40, 8, ["D3", "B3", "E4", "G#4", "B4"]),  # mi sur ré
    (48, 8, ["F#3", "A3", "C#4", "E4", "G#4"]),  # fa dièse mineur 9
    (56, 8, ["A2", "E3", "B3", "E4"]),  # la suspendu, qui ramène au début
]
BASSES = [(0, 8, "D2"), (8, 8, "D2"), (16, 8, "B1"), (24, 8, "A1"),
          (32, 8, "D2"), (40, 8, "D2"), (48, 8, "F#1"), (56, 8, "A1")]

# Mélodies: (temps, durée, note, vélocité MIDI).
CELESTA = [
    # Phrase A: ta voix appelle.
    (0, 1.5, "F#5", 70), (1.5, 0.5, "A5", 58), (2, 2, "E6", 70), (5, 1, "D6", 60), (6, 2, "C#6", 58),
    (8, 1.5, "B5", 64), (9.5, 0.5, "G#5", 54), (10, 3, "E5", 62),
    # Phrase A': elle appelle de nouveau, un peu plus haut.
    (32, 1.5, "F#5", 66), (33.5, 0.5, "A5", 56), (34, 1, "E6", 66), (35, 1, "F#6", 58),
    (36, 2, "E6", 60), (38, 2, "C#6", 54), (40, 1, "G#5", 56), (41, 1, "B5", 58), (42, 2, "E6", 62),
    (44.5, 2.5, "B5", 52),
    # Phrase C: les deux voix se mêlent.
    (49, 2, "G#5", 54), (51, 3, "A5", 58), (56, 2, "B5", 56), (58, 2, "A5", 52),
]
HARPE = [
    # Phrase B: l'autre répond.
    (16, 1, "D5", 64), (17, 1, "F#5", 62), (18, 2, "A5", 68), (20.5, 1, "C#6", 60), (21.5, 0.5, "B5", 54),
    (22, 2, "F#5", 60), (24, 1, "E5", 62), (25, 1, "A5", 60), (26, 2, "B5", 66), (28.5, 1.5, "C#6", 58),
    (30, 2, "A5", 56),
    # Phrase C.
    (48, 2, "C#5", 60), (50, 2, "E5", 60), (54, 2, "G#5", 54), (57, 2, "E5", 56), (60, 3, "A4", 50),
]
NOTES_ETOILES = ["D6", "E6", "F#6", "A6", "B6", "D7"]


def etoiles(graine: int = 7) -> list[tuple[float, float, str, int]]:
    """Une vingtaine de notes de verre très douces, réparties au hasard (graine fixe)."""
    rng = np.random.default_rng(graine)
    sortie = []
    t = float(rng.uniform(0.5, 2.0))
    while t < DUREE_BOUCLE - 0.5:
        note = NOTES_ETOILES[int(rng.integers(len(NOTES_ETOILES)))]
        sortie.append((round(t * 4) / 4, 1.0, note, int(rng.integers(24, 40))))
        t += float(rng.uniform(1.8, 4.2))
    return sortie


def ecrire_midi(chemin: Path) -> None:
    tpb = 480
    fichier = mido.MidiFile(type=1, ticks_per_beat=tpb)
    conducteur = mido.MidiTrack()
    conducteur.append(mido.MetaMessage("track_name", name="Deux astres", time=0))
    conducteur.append(mido.MetaMessage("set_tempo", tempo=mido.bpm2tempo(TEMPO_BPM), time=0))
    conducteur.append(mido.MetaMessage("time_signature", numerator=4, denominator=4, time=0))
    conducteur.append(mido.MetaMessage("marker", text="boucle-debut", time=0))
    conducteur.append(mido.MetaMessage("marker", text="boucle-fin", time=int(DUREE_BOUCLE * tpb)))
    conducteur.append(mido.MetaMessage("end_of_track", time=0))
    fichier.tracks.append(conducteur)

    contenus = {
        "nappe": [(d, l, note, 64) for d, l, notes in ACCORDS for note in notes],
        "basse": [(d, l, note, 64) for d, l, note in BASSES],
        "celesta": CELESTA,
        "harpe": HARPE,
        "etoiles": etoiles(),
    }
    for nom, notes in contenus.items():
        p = PISTES[nom]
        piste = mido.MidiTrack()
        piste.append(mido.MetaMessage("track_name", name=nom, time=0))
        piste.append(mido.Message("program_change", channel=p["canal"], program=p["programme"], time=0))
        piste.append(mido.Message("control_change", channel=p["canal"], control=10, value=p["pan"], time=0))
        evenements = []
        for debut, duree, note, vel in notes:
            m = note_midi(note)
            evenements.append((int(round(debut * tpb)), 1, m, vel))
            evenements.append((int(round((debut + duree) * tpb)), 0, m, 0))
        evenements.sort(key=lambda e: (e[0], e[1]))
        maintenant = 0
        for tick, allume, m, vel in evenements:
            type_ = "note_on" if allume else "note_off"
            piste.append(mido.Message(type_, channel=p["canal"], note=m, velocity=vel, time=tick - maintenant))
            maintenant = tick
        piste.append(mido.MetaMessage("end_of_track", time=0))
        fichier.tracks.append(piste)
    fichier.save(str(chemin))


def lire_midi(chemin: Path) -> dict[str, list[tuple[float, float, int, int]]]:
    """Relit le MIDI: pour chaque piste nommée, (début s, durée s, note, vélocité)."""
    fichier = mido.MidiFile(str(chemin))
    tempo = mido.bpm2tempo(TEMPO_BPM)
    for msg in fichier.tracks[0]:
        if msg.type == "set_tempo":
            tempo = msg.tempo
    sec_par_tick = tempo / 1e6 / fichier.ticks_per_beat
    pistes = {}
    for piste in fichier.tracks[1:]:
        nom = None
        ouvertes: dict[int, tuple[int, int]] = {}
        notes = []
        tick = 0
        for msg in piste:
            tick += msg.time
            if msg.type == "track_name":
                nom = msg.name
            elif msg.type == "note_on" and msg.velocity > 0:
                ouvertes[msg.note] = (tick, msg.velocity)
            elif msg.type in ("note_off", "note_on") and msg.note in ouvertes:
                debut, vel = ouvertes.pop(msg.note)
                notes.append((debut * sec_par_tick, (tick - debut) * sec_par_tick, msg.note, vel))
        if nom:
            pistes[nom] = notes
    return pistes


def _couche(duree_totale: float) -> np.ndarray:
    return np.zeros((int(round(duree_totale * SR)), 2))


def rendre_couches(pistes) -> dict[str, np.ndarray]:
    total = DUREE_BOUCLE + QUEUE
    couches = {nom: _couche(total) for nom in PISTES}
    for i, (debut, duree, m, vel) in enumerate(pistes["nappe"]):
        son = nappe(midi_freq(m), duree, vel / 127, attaque=2.6, relache=3.6, coupure=1500.0,
                    voix=3, desaccord=6.0, graine=300 + i, t0=debut, periode_lfo=16.0)
        poser(couches["nappe"], son, debut)
    for i, (debut, duree, m, vel) in enumerate(pistes["basse"]):
        poser(couches["basse"], basse(midi_freq(m), duree, vel / 127, attaque=2.0, relache=3.0, graine=400 + i), debut)
    for i, (debut, duree, m, vel) in enumerate(pistes["celesta"]):
        son = verre(midi_freq(m), duree + 3.5, (vel / 127) ** 1.3, t60=2.6, brillance=0.75, graine=500 + i)
        poser(couches["celesta"], son, debut, pan=-0.25)
    for i, (debut, duree, m, vel) in enumerate(pistes["harpe"]):
        son = harpe(midi_freq(m), duree + 4.0, (vel / 127) ** 1.3, t60=3.0, brillance=0.85, graine=600 + i)
        poser(couches["harpe"], son, debut, pan=0.35)
    rng = np.random.default_rng(11)
    for i, (debut, duree, m, vel) in enumerate(pistes["etoiles"]):
        son = verre(midi_freq(m), 3.5, vel / 127, t60=2.4, brillance=0.5, graine=700 + i)
        poser(couches["etoiles"], son, debut, pan=float(rng.uniform(-0.7, 0.7)))
    return couches


def replier(x: np.ndarray) -> np.ndarray:
    """Replie la queue (tout ce qui dépasse la 64e seconde) sur le début: boucle circulaire."""
    n = ECHANTILLONS_BOUCLE
    y = x[:n].copy()
    reste = x[n:]
    while len(reste):
        k = min(n, len(reste))
        y[:k] += reste[:k]
        reste = reste[k:]
    return y


def circulaire(traitement, x: np.ndarray, copies: int = 2) -> np.ndarray:
    """Applique un traitement à état (réverbération) sur plusieurs copies de la boucle mises
    bout à bout et garde la dernière: son état d'entrée est celui de la fin de la boucle."""
    n = len(x)
    y = traitement(np.concatenate([x] * copies))
    return y[(copies - 1) * n: copies * n]


# Sonies relatives des couches, en LU par rapport à la nappe (avant la normalisation finale).
EQUILIBRE = {"nappe": 0.0, "basse": -13.0, "celesta": -2.0, "harpe": -2.0, "etoiles": -9.0}
CIBLE_LUFS = -20.0
PLAFOND_DBTP = -1.5


def _chaine_master(s: np.ndarray) -> np.ndarray:
    # Filtres et réverbération ont un état: ils passent par circulaire() pour un raccord exact.
    s = passe_haut(s, 35.0)
    return reverbe(s, taille=0.88, humide=0.3, sec=0.78, amorti=0.35, largeur=1.0)


def rendre(chemin_midi: Path) -> tuple[np.ndarray, dict]:
    pistes = lire_midi(chemin_midi)
    couches = rendre_couches(pistes)
    reference = None
    mix = np.zeros((ECHANTILLONS_BOUCLE, 2))
    rapport = {}
    for nom, couche in couches.items():
        boucle = replier(couche)
        lk = sonie_integree(boucle)
        if reference is None:
            reference = lk
        gain = 10 ** ((reference + EQUILIBRE[nom] - lk) / 20.0)
        mix += boucle * gain
        rapport[nom] = round(lk, 1)
    mix = circulaire(_chaine_master, mix)
    gain = 10 ** ((CIBLE_LUFS - sonie_integree(mix)) / 20.0)
    mix *= gain
    tp = crete_vraie_db(mix)
    if tp > PLAFOND_DBTP:
        from pedalboard import Limiter, Pedalboard

        pb = Pedalboard([Limiter(threshold_db=PLAFOND_DBTP - 0.3, release_ms=200.0)])
        mix = circulaire(lambda s: pb(s.T.astype(np.float32), SR).T.astype(np.float64), mix, copies=3)
    rapport["integree"] = round(sonie_integree(mix), 2)
    rapport["crete_vraie"] = round(crete_vraie_db(mix), 2)
    return mix, rapport


def avec_amorces(boucle: np.ndarray) -> np.ndarray:
    a = ECHANTILLONS_AMORCE
    return np.concatenate([boucle[-a:], boucle, boucle[:a]])
