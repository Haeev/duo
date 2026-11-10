"""Écriture des musiques en données, export MIDI, rendu FluidSynth et mixage.

Chaque morceau est décrit par des pistes (instrument General MIDI, notes, niveau relatif,
départ en réverbération). Le fichier MIDI complet est versionné dans midi/: c'est la source de
vérité de la partition. Le rendu se fait piste par piste (une passe FluidSynth par instrument),
ce qui permet de régler le mélange par la mesure: chaque piste est amenée à une sonie relative
choisie, quel que soit le volume propre de l'échantillon de la banque.

Unité de temps: le temps (la noire). Une mesure à 6/8 dure 3 temps, à 3/4 trois, à 4/4 quatre.
"""

from __future__ import annotations

import concurrent.futures
import subprocess
import tempfile
from dataclasses import dataclass, field
from pathlib import Path

import mido
import numpy as np
from scipy import signal

import sys
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import dsp  # noqa: E402

BANQUE = Path("/usr/share/sounds/sf2/FluidR3_GM.sf2")
TPB = 480  # résolution MIDI (tics par temps)


# --- Notes et mélodies -----------------------------------------------------------------

@dataclass
class Note:
    t: float  # début, en temps
    d: float  # durée, en temps
    p: int  # hauteur MIDI
    v: int  # vélocité


def mel(texte: str, t0: float = 0.0, vel: int = 80, mesure: float | None = None,
        legato: float = 0.96, transpo: int = 0) -> list[Note]:
    """« B4:1 A4:.5 | G4:1.5 r:1.5 »: hauteur et durée en temps; « r » pour un silence;
    « ! » après la durée accentue la note; « | » vérifie que la mesure tombe juste."""
    notes: list[Note] = []
    t = t0
    for jeton in texte.split():
        if jeton == "|":
            if mesure is not None and abs(((t - t0) / mesure) - round((t - t0) / mesure)) > 1e-6:
                raise ValueError(f"mesure incomplète avant « | » à {t - t0} temps dans: {texte[:60]}")
            continue
        accent = jeton.endswith("!")
        jeton = jeton.rstrip("!")
        nom, duree_txt = jeton.split(":")
        duree = float(duree_txt)
        if nom != "r":
            v = min(127, vel + (14 if accent else 0))
            notes.append(Note(t, duree * legato, dsp.note_midi(nom) + transpo, v))
        t += duree
    return notes


def fin_de(notes: list[Note]) -> float:
    return max((n.t + n.d for n in notes), default=0.0)


def decaler(notes: list[Note], dt: float = 0.0, transpo: int = 0, dv: int = 0) -> list[Note]:
    return [Note(n.t + dt, n.d, n.p + transpo, max(1, min(127, n.v + dv))) for n in notes]


def tierce_dessous(notes: list[Note], gamme: list[int], intervalle: int = 2, dv: int = -8,
                   accords: list | None = None) -> list[Note]:
    """Voix parallèle à une tierce (intervalle=2 degrés) ou une sixte (5) diatonique en dessous.
    Avec la grille, une note tenue (une noire ou plus) qui tomberait hors de l'accord est remplacée
    par la note de l'accord la plus proche, entre une sixte et une tierce mineure sous la mélodie."""
    sortie = []
    for n in notes:
        p = n.p
        k = 0
        while k < intervalle:
            p -= 1
            if p % 12 in gamme:
                k += 1
        if accords and n.d >= 0.7:
            acc = next((a for a in accords if a.t - 1e-6 <= n.t < a.t + a.d - 1e-6), None)
            if acc is not None and p % 12 not in acc.pcs:
                candidats = [q for q in range(n.p - 9, n.p - 2) if q % 12 in acc.pcs]
                if candidats:
                    p = min(candidats, key=lambda q: (abs(q - p), q))
        sortie.append(Note(n.t, n.d, p, max(1, n.v + dv)))
    return sortie


# --- Accords ----------------------------------------------------------------------------

QUALITES = {
    "": [0, 4, 7], "m": [0, 3, 7], "7": [0, 4, 7, 10], "maj7": [0, 4, 7, 11], "m7": [0, 3, 7, 10],
    "6": [0, 4, 7, 9], "m6": [0, 3, 7, 9], "sus4": [0, 5, 7], "sus2": [0, 2, 7], "add9": [0, 4, 7, 2],
    "madd9": [0, 3, 7, 2], "9": [0, 4, 7, 10, 2], "maj9": [0, 4, 7, 11, 2], "m9": [0, 3, 7, 10, 2],
    "7sus4": [0, 5, 7, 10], "dim": [0, 3, 6], "6/9": [0, 4, 7, 9, 2],
}


@dataclass
class Accord:
    t: float
    d: float
    symbole: str
    racine: int = 0  # classe de hauteur
    pcs: list[int] = field(default_factory=list)  # classes de hauteur, racine en premier
    basse: int = 0  # classe de hauteur de la basse (renversement)


def analyser(symbole: str) -> tuple[int, list[int], int]:
    racine = dsp.NOTES[symbole[0]]
    i = 1
    while i < len(symbole) and symbole[i] in "#b":
        racine += 1 if symbole[i] == "#" else -1
        i += 1
    reste = symbole[i:]
    basse = None
    if "/" in reste and not reste.startswith("6/9"):
        reste, b = reste.split("/")
        basse = dsp.NOTES[b[0]] + (1 if b[1:2] == "#" else -1 if b[1:2] == "b" else 0)
    if reste not in QUALITES:
        raise ValueError(f"accord inconnu: {symbole}")
    pcs = [(racine + iv) % 12 for iv in QUALITES[reste]]
    racine %= 12
    return racine, pcs, (basse % 12) if basse is not None else racine


def grille(texte: str, t0: float, mesure: float) -> list[Accord]:
    """« G | Em | Am7 D7 | G »: un ou plusieurs accords par mesure, partagés également."""
    accords = []
    for k, case in enumerate(texte.split("|")):
        symboles = case.split()
        for j, s in enumerate(symboles):
            d = mesure / len(symboles)
            r, pcs, b = analyser(s)
            accords.append(Accord(t0 + k * mesure + j * d, d, s, r, pcs, b))
    return accords


def _plus_proche(pc: int, cible: float, bas: int, haut: int) -> int:
    candidats = [p for p in range(bas, haut + 1) if p % 12 == pc]
    return min(candidats, key=lambda p: abs(p - cible))


def voicing(acc: Accord, precedent: list[int] | None, nb: int, bas: int, haut: int,
            centre: float | None = None, sans_racine: bool = False) -> list[int]:
    """Voix supérieures en position serrée, choisies pour bouger le moins possible depuis le
    voicing précédent (conduite des voix)."""
    pcs = list(acc.pcs)
    if sans_racine and len(pcs) > 3:
        pcs = pcs[1:]
    # Priorité des notes si l'accord en a plus que nb: tierce, septième, quinte, neuvième, racine.
    if len(pcs) > nb:
        ordre = sorted(pcs, key=lambda pc: {3: 0, 4: 0, 10: 1, 11: 1, 9: 2, 7: 3, 2: 4, 5: 2, 6: 3, 0: 5}
                       .get((pc - acc.racine) % 12, 6))
        pcs = ordre[:nb]
    candidats = []
    for depart in range(bas, haut + 1):
        if depart % 12 not in pcs:
            continue
        v = [depart]
        restants = [pc for pc in pcs if pc != depart % 12]
        p = depart
        while restants and len(v) < nb:
            p += 1
            if p > haut:
                break
            if p % 12 in restants:
                v.append(p)
                restants.remove(p % 12)
        while len(v) < nb:  # doubler au besoin, une octave au-dessus de la note la plus grave
            v.append(v[len(v) - len(pcs)] + 12 if len(v) >= len(pcs) else v[0] + 12)
        if v[-1] <= haut and len(set(x % 12 for x in v)) == min(nb, len(pcs)):
            candidats.append(sorted(v))
    if not candidats:
        raise ValueError(f"aucun voicing pour {acc.symbole} entre {bas} et {haut}")
    if precedent:
        return min(candidats, key=lambda v: sum(abs(a - b) for a, b in zip(v, precedent)))
    c = centre if centre is not None else (bas + haut) / 2
    return min(candidats, key=lambda v: abs(np.mean(v) - c))


def basse_de(acc: Accord, precedente: int | None, bas: int = 36, haut: int = 50) -> int:
    cible = precedente if precedente is not None else (bas + haut) / 2
    return _plus_proche(acc.basse, cible, bas, haut)


def quinte_de(acc: Accord, basse: int) -> int:
    pc = acc.pcs[2] if len(acc.pcs) > 2 else acc.pcs[0]
    q = basse - (basse % 12) + pc
    while q <= basse:
        q += 12
    return q - 12 if q - basse > 9 else q


# --- Motifs d'accompagnement ----------------------------------------------------------

def arpege(accords: list[Accord], motif: list[tuple[float, int, float]], vel: int = 62,
           bas: int = 40, haut_v: tuple[int, int] = (52, 69), nb: int = 3, periode: float | None = None,
           accent: int = 8) -> list[Note]:
    """Arpège de guitare ou de harpe: motif = [(temps, voix, durée)], voix 0 = basse,
    1..nb = voix supérieures de bas en haut, -1 = quinte de la basse. Le motif se répète toutes
    les `periode` temps à l'intérieur de chaque accord."""
    notes = []
    prec_v = None
    prec_b = None
    for acc in accords:
        v = voicing(acc, prec_v, nb, haut_v[0], haut_v[1])
        b = basse_de(acc, prec_b, bas, bas + 12)
        prec_v, prec_b = v, b
        per = periode or acc.d
        debut = acc.t
        while debut < acc.t + acc.d - 1e-6:
            for (dt, voix, duree) in motif:
                t = debut + dt
                if t >= acc.t + acc.d - 1e-6:
                    continue
                p = b if voix == 0 else quinte_de(acc, b) if voix == -1 else v[min(voix, nb) - 1]
                accentue = accent if abs(dt) < 1e-6 else 0
                notes.append(Note(t, min(duree, acc.t + acc.d - t + 0.2), p, vel + accentue))
            debut += per
    return notes


def nappe(accords: list[Accord], vel: int = 60, nb: int = 4, bas: int = 52, haut: int = 76,
          liaison: float = 0.98) -> list[Note]:
    notes = []
    prec = None
    for acc in accords:
        v = voicing(acc, prec, nb, bas, haut)
        prec = v
        for p in v:
            notes.append(Note(acc.t, acc.d * liaison, p, vel))
    return notes


def ligne_basse(accords: list[Accord], temps: list[float], vel: int = 74, bas: int = 36, haut: int = 50,
                duree: float = 0.9, quintes: bool = True) -> list[Note]:
    """Basse sur les temps donnés (relatifs au début de chaque accord); en alternance racine et
    quinte si quintes est vrai."""
    notes = []
    prec = None
    for acc in accords:
        b = basse_de(acc, prec, bas, haut)
        prec = b
        for k, dt in enumerate(t for t in temps if t < acc.d - 1e-6):
            p = quinte_de(acc, b) if (quintes and k % 2 == 1) else b
            notes.append(Note(acc.t + dt, duree, p, vel - (6 if k else 0)))
    return notes


def accords_frappes(accords: list[Accord], temps: list[float], vel: int = 58, nb: int = 3,
                    bas: int = 55, haut: int = 72, duree: float = 0.35) -> list[Note]:
    """Accords plaqués sur les temps faibles (le « pah » de l'oom-pah)."""
    notes = []
    prec = None
    for acc in accords:
        v = voicing(acc, prec, nb, bas, haut)
        prec = v
        for dt in temps:
            if dt < acc.d - 1e-6:
                for p in v:
                    notes.append(Note(acc.t + dt, duree, p, vel))
    return notes


def contrechant(accords: list[Accord], bas: int, haut: int, vel: int = 60, depart: int | None = None,
                eviter: list[Note] | None = None) -> list[Note]:
    """Ligne de notes tenues sur les notes caractéristiques des accords (tierces et septièmes),
    conduites au plus près, en évitant l'unisson avec la mélodie au début de chaque accord."""
    notes = []
    prec = depart if depart is not None else (bas + haut) // 2
    for acc in accords:
        preferes = [pc for pc in acc.pcs if (pc - acc.racine) % 12 in (3, 4, 10, 11)] or acc.pcs
        candidats = [p for p in range(bas, haut + 1) if p % 12 in preferes]
        if eviter:
            interdits = {n.p % 12 for n in eviter if acc.t - 1e-6 <= n.t < acc.t + 0.5}
            filtres = [p for p in candidats if p % 12 not in interdits]
            candidats = filtres or candidats
        p = min(candidats, key=lambda x: abs(x - prec))
        prec = p
        notes.append(Note(acc.t, acc.d * 0.97, p, vel))
    return notes


def humaniser(notes: list[Note], rng: np.random.Generator, dt: float = 0.012, dv: int = 5,
              tempo: float = 90.0) -> list[Note]:
    """Petits écarts de mise en place (en avance jamais: aucune note ne passe avant 0) et de vélocité."""
    sortie = []
    for n in notes:
        decal = rng.uniform(0.0, dt) * tempo / 60.0  # secondes vers temps
        sortie.append(Note(n.t + (decal if n.t > 0 else 0.0), n.d, n.p,
                           int(np.clip(n.v + rng.integers(-dv, dv + 1), 1, 127))))
    return sortie


# --- Pistes et morceaux ----------------------------------------------------------------

@dataclass
class Piste:
    nom: str
    programme: int  # General MIDI, de 0 à 127
    notes: list[Note]
    sonie_lu: float = 0.0  # sonie relative de la piste dans le mélange (0 = la plus forte)
    pan: int = 64
    reverbe: float = 0.25  # départ vers la réverbération
    souffle: bool = False  # expression CC11 qui respire sur les notes longues (vents, cordes)
    percussions: bool = False
    passe_haut: float = 0.0
    canal: int = -1


@dataclass
class Morceau:
    id: str
    titre: str
    tempo: float  # noires par minute
    signature: tuple[int, int]
    mesures: int
    temps_par_mesure: float
    pistes: list[Piste]
    boucle: bool = True
    queue_s: float = 6.0  # rendu après la fin, replié sur le début si boucle
    rt60: float = 1.5
    aigus_ir: float = 0.45
    predelai: float = 0.018
    sonie_cible: float = -18.0
    presence_db: float = -19.0  # niveau visé de l'octave de 4 kHz, relatif à l'énergie totale
    graine: int = 0
    accords: list = field(default_factory=list)  # grille, pour le contrôle des frottements

    @property
    def duree_temps(self) -> float:
        return self.mesures * self.temps_par_mesure

    @property
    def duree_s(self) -> float:
        return self.duree_temps * 60.0 / self.tempo


def _expression(notes: list[Note], tempo: float) -> list[tuple[float, int]]:
    """Points de CC11 (temps, valeur): attaque un peu retenue, gonflement, retombée."""
    points = []
    for n in notes:
        if n.d < 0.9:
            points.append((n.t, 100))
            continue
        pas = 0.125
        k = 0
        while k * pas < n.d:
            x = k * pas / n.d
            valeur = 92 + 18 * np.sin(np.pi * min(1.0, x * 1.15)) ** 0.8
            points.append((n.t + k * pas, int(valeur)))
            k += 1
    points.sort()
    return points


def _canaux(m: Morceau) -> dict[str, int]:
    """Canal 10 (index 9) pour les percussions, canaux imposés respectés, les autres pistes sur
    les canaux restants (deux pistes qui partagent un canal doivent avoir le même programme)."""
    imposes = {p.canal for p in m.pistes if p.canal >= 0}
    libres = [c for c in range(16) if c != 9 and c not in imposes]
    sortie = {}
    for p in m.pistes:
        if p.percussions:
            sortie[p.nom] = 9
        elif p.canal >= 0:
            sortie[p.nom] = p.canal
        else:
            if not libres:
                raise ValueError(f"{m.id}: plus de canal MIDI libre")
            sortie[p.nom] = libres.pop(0)
    return sortie


def ecrire_midi(m: Morceau, chemin: Path, seulement: str | None = None) -> None:
    """Écrit le fichier MIDI du morceau (ou d'une seule piste, pour le rendu séparé). Un dernier
    événement neutre à la fin de la queue force FluidSynth à rendre la queue."""
    fichier = mido.MidiFile(type=1, ticks_per_beat=TPB)
    meta = mido.MidiTrack()
    fichier.tracks.append(meta)
    meta.append(mido.MetaMessage("track_name", name=m.titre, time=0))
    meta.append(mido.MetaMessage("set_tempo", tempo=mido.bpm2tempo(m.tempo), time=0))
    meta.append(mido.MetaMessage("time_signature", numerator=m.signature[0], denominator=m.signature[1], time=0))
    fin_tics = int(round((m.duree_temps + m.queue_s * m.tempo / 60.0) * TPB))
    meta.append(mido.MetaMessage("end_of_track", time=fin_tics))
    canaux = _canaux(m)
    for piste in m.pistes:
        canal = canaux[piste.nom]
        if seulement is not None and piste.nom != seulement:
            continue
        evts: list[tuple[int, int, mido.Message]] = []
        # Ordre à tic égal: contrôles (0), fins de notes (1), débuts de notes (2).
        if not piste.percussions or piste.programme > 0:  # kit de brosses: programme 40 sur le canal 10
            evts.append((0, 0, mido.Message("program_change", channel=canal, program=piste.programme)))
        for cc, val in ((7, 100), (10, piste.pan), (91, 0), (93, 0), (11, 100)):
            evts.append((0, 0, mido.Message("control_change", channel=canal, control=cc, value=val)))
        for n in piste.notes:
            t_on = int(round(n.t * TPB))
            t_off = max(t_on + 1, int(round((n.t + n.d) * TPB)))
            evts.append((t_on, 2, mido.Message("note_on", channel=canal, note=n.p, velocity=n.v)))
            evts.append((t_off, 1, mido.Message("note_off", channel=canal, note=n.p, velocity=0)))
        if piste.souffle:
            for (t, val) in _expression(piste.notes, m.tempo):
                evts.append((int(round(t * TPB)), 0, mido.Message("control_change", channel=canal,
                                                                  control=11, value=int(np.clip(val, 0, 127)))))
        evts.append((fin_tics, 3, mido.Message("control_change", channel=canal, control=110, value=0)))
        evts.sort(key=lambda e: (e[0], e[1]))
        piste_midi = mido.MidiTrack()
        piste_midi.append(mido.MetaMessage("track_name", name=piste.nom, time=0))
        courant = 0
        for (tic, _, msg) in evts:
            msg.time = tic - courant
            courant = tic
            piste_midi.append(msg)
        fichier.tracks.append(piste_midi)
    chemin.parent.mkdir(parents=True, exist_ok=True)
    fichier.save(str(chemin))


def _rendre_fluidsynth(midi: Path, wav: Path) -> None:
    subprocess.run(["fluidsynth", "-ni", "-q", "-R", "0", "-C", "0", "-g", "0.5", "-r", str(dsp.SR),
                    "-O", "float", "-T", "wav", "-F", str(wav), str(BANQUE), str(midi)],
                   check=True, capture_output=True)


def rendre_pistes(m: Morceau, dossier_tmp: Path) -> dict[str, np.ndarray]:
    """Une passe FluidSynth par piste (en parallèle), sans réverbération ni chorus internes."""
    taches = {}
    for piste in m.pistes:
        midi = dossier_tmp / f"{m.id}-{piste.nom}.mid"
        ecrire_midi(m, midi, seulement=piste.nom)
        taches[piste.nom] = (midi, dossier_tmp / f"{m.id}-{piste.nom}.wav")
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        list(pool.map(lambda kv: _rendre_fluidsynth(*kv), taches.values()))
    n_total = dsp.n_ech(m.duree_s + m.queue_s)
    sortie = {}
    for nom, (_, wav) in taches.items():
        x = dsp.stereo(dsp.lire_wav(wav))
        if len(x) < n_total:
            x = np.concatenate([x, np.zeros((n_total - len(x), 2))])
        sortie[nom] = x[:n_total]
    return sortie


def mixer(m: Morceau, stems: dict[str, np.ndarray]) -> tuple[np.ndarray, dict[str, float]]:
    """Amène chaque piste à sa sonie relative, ajoute la réverbération commune, puis replie la
    queue sur le début si le morceau boucle. Renvoie le mélange (longueur exacte de la boucle,
    ou morceau et sa queue) et les gains appliqués (dB)."""
    n_total = len(next(iter(stems.values())))
    sec = np.zeros((n_total, 2))
    envoi = np.zeros((n_total, 2))
    gains = {}
    for piste in m.pistes:
        x = stems[piste.nom]
        if piste.passe_haut > 0:
            x = dsp.ph(x, piste.passe_haut, 2)
        s = dsp.sonie_integree(x)
        g_db = (-20.0 + piste.sonie_lu) - s
        gains[piste.nom] = round(g_db, 2)
        x = x * 10 ** (g_db / 20.0)
        sec += x
        envoi += piste.reverbe * x
    ir = dsp.ir_salle(m.rt60, m.predelai, m.aigus_ir, graine=m.graine)
    humide = np.stack([signal.oaconvolve(envoi[:, c], ir[:, c]) for c in range(2)], axis=1)
    mix = np.zeros((max(n_total, len(humide)), 2))
    mix[:n_total] += sec
    mix[:len(humide)] += humide
    mix = dsp.ph(mix, 32.0, 2)
    mix = dsp.cloche_eq(mix, 200.0, -2.5, 0.8)  # moins de boue dans le bas-médium
    # Les échantillons de FluidR3 sont sombres au-dessus de 3 kHz (hautbois à -26 dB dans l'octave
    # de 4 kHz, mesuré): une étagère calculée ramène cette octave vers m.presence_db, sans dépasser
    # +9 dB, pour une clarté homogène d'un morceau à l'autre.
    total = 0.0
    for _ in range(2):  # l'étagère ne relève qu'en partie l'octave visée: deux passes
        g = float(np.clip(m.presence_db - octave_relative(mix, 4000.0), -4.0 - total, 10.0 - total))
        if abs(g) < 0.3:
            break
        mix = dsp.etagere_aigus(mix, 3000.0, g)
        total += g
    gains["_presence_db"] = round(total, 2)
    n_boucle = dsp.n_ech(m.duree_s)
    if m.boucle:
        boucle = mix[:n_boucle].copy()
        reste = mix[n_boucle:]
        while len(reste):
            pris = min(len(reste), n_boucle)
            boucle[:pris] += reste[:pris]
            reste = reste[pris:]
        return boucle, gains
    return mix, gains


def masteriser(m: Morceau, x: np.ndarray, plafond_dbtp: float = -1.5) -> np.ndarray:
    """Compression douce (circulaire pour une boucle), sonie intégrée à la cible, limiteur."""
    from pedalboard import Compressor, Pedalboard

    comp = Pedalboard([Compressor(threshold_db=-24.0, ratio=1.8, attack_ms=30.0, release_ms=400.0)])
    if m.boucle:
        trois = np.concatenate([x, x, x]).T.astype(np.float32)
        y = comp(trois, dsp.SR).T.astype(np.float64)[len(x):2 * len(x)]
        y = dsp.amener_integree(y, m.sonie_cible, circulaire=True)
        y = dsp.limiter_circulaire(y, plafond_dbtp)
    else:
        y = comp(x.T.astype(np.float32), dsp.SR).T.astype(np.float64)
        y = dsp.amener_integree(y, m.sonie_cible)
        if dsp.crete_vraie_db(y) > plafond_dbtp:
            y = dsp.limiter_circulaire(np.concatenate([y, np.zeros((len(y), 2))]), plafond_dbtp)[:len(y)]
    return y


def produire(m: Morceau, dossier_midi: Path) -> tuple[np.ndarray, dict]:
    """Écrit le MIDI versionné, rend, mixe et masterise. Renvoie l'audio (boucle exacte ou
    morceau entier) et un résumé."""
    ecrire_midi(m, dossier_midi / f"{m.id}.mid")
    with tempfile.TemporaryDirectory() as tmp:
        stems = rendre_pistes(m, Path(tmp))
    mix, gains = mixer(m, stems)
    y = masteriser(m, mix)
    if not m.boucle:
        y = dsp.fondu(_couper_silence_final(y), 0.0, 0.5)
    resume = {"gains_db": gains, "duree_s": round(len(y) / dsp.SR, 3)}
    return y, resume


def octave_relative(x: np.ndarray, centre: float) -> float:
    """Énergie de l'octave centrée sur `centre`, en dB relatifs à l'énergie totale."""
    fr, p = signal.welch(dsp.mono(x), dsp.SR, nperseg=8192)
    bande = (fr >= centre / np.sqrt(2)) & (fr < centre * np.sqrt(2))
    return float(10 * np.log10(np.sum(p[bande]) / (np.sum(p) + 1e-20) + 1e-20))


def _couper_silence_final(x: np.ndarray, seuil_db: float = -70.0) -> np.ndarray:
    crete = np.max(np.abs(x)) + 1e-12
    actif = np.where(np.max(np.abs(x), axis=1) > crete * 10 ** (seuil_db / 20.0))[0]
    return x[: (actif[-1] + dsp.n_ech(0.05)) if len(actif) else len(x)]


# --- Contrôle de l'écriture (on ne peut pas écouter: on vérifie) -------------------------

def frottements(m: Morceau, duree_min: float = 0.75) -> list[str]:
    """Paires de notes simultanées de deux pistes différentes formant une seconde mineure, une
    septième majeure ou un triton, tenues ensemble au moins duree_min temps, dont l'une au moins
    n'appartient pas à l'accord du moment. Ce sont les seuls endroits où une fausse note pourrait
    s'entendre; la liste doit être vide ou ne contenir que des notes de passage voulues."""
    def accord_a(t: float) -> Accord | None:
        for a in m.accords:
            if a.t - 1e-6 <= t < a.t + a.d - 1e-6:
                return a
        return None

    notes = [(p.nom, n) for p in m.pistes if not p.percussions for n in p.notes]
    rapports = []
    for i in range(len(notes)):
        nom_a, a = notes[i]
        for j in range(i + 1, len(notes)):
            nom_b, b = notes[j]
            if nom_a == nom_b:
                continue
            debut = max(a.t, b.t)
            fin = min(a.t + a.d, b.t + b.d)
            if fin - debut < duree_min:
                continue
            ic = abs(a.p - b.p) % 12
            if ic not in (1, 11, 6):
                continue
            acc = accord_a(debut)
            if acc is None:
                continue
            if a.p % 12 in acc.pcs and b.p % 12 in acc.pcs:
                continue
            mesure = int(debut // m.temps_par_mesure) + 1
            rapports.append(f"mesure {mesure} ({acc.symbole}): {nom_a} {a.p} / {nom_b} {b.p}, "
                            f"{fin - debut:.2f} temps")
    return rapports
