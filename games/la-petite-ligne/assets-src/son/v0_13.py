"""Sons de la 0.13 (`docs/jeux/jeu-1/v0-13-habitants.md`, lot H8, sections 4, 6 et 7;
`docs/jeux/jeu-1/v0-13-carte.md`, lot L4 bis): les cloches de Saint-Aubin, l'harmonium, la forge,
le moulin, le lavoir, le puits et le belvédère, le chat du bourg, le carnet et l'amitié, les
ambiances de la forêt profonde, de la ferme, de la nef et du café, et les motifs des quatorze
habitants nouveaux.

Dossiers, tous décodés à la demande (le plafond de 30 Mo des sons permanents de `memoire.test.ts`
est presque plein; chaque son porte `decodeWhen` pour le dev audio):
- `eglise/`: tintements et volée de l'angélus, notes et accords de l'harmonium;
- `metiers/`: enclume et forge, roue et meules du moulin, vanne du bief, battoir du lavoir;
- `decor/`: ricochet, puits, écho du belvédère, pas sur les feuilles, le chat;
- `carnet/`: crayon du carnet, lanternes de l'amitié, anniversaire, décision à deux;
- `voisins/`: les quatorze motifs d'habitants (`talk-<id>`, trouvés par l'identifiant);
- `ambiance/`: forêt profonde, ferme, nef de l'église, salle du café.

Même famille que le reste du jeu: bois, fer, laiton, pierre, eau, et pour ce qui chante, des
instruments acoustiques en sol majeur (en général sa pentatonique). Aucune voix (cahier, 6.12):
« crier dans le puits » et « crier au belvédère » deviennent un hululement soufflé dans les mains
jointes (un son d'ocarina, sans formant de voix, épicène); le chat et les bêtes de la ferme ne
sont pas des voix humaines.
"""

from __future__ import annotations

from pathlib import Path

import numpy as np

import ambiances
import dsp
import instruments as ins
from catalogue import Son
from dsp import SR
from partition import Note, Piste, mel
from tour10 import _accord as accord
from tour10 import _court as court
from tour10 import _rendre as rendre

ICI = Path(__file__).resolve().parent

# Programmes General MIDI (numérotés de 0)
HARPSICHORD, CELESTA, GLOCK, MUSIC_BOX, MARIMBA, XYLO, TUBULAR = 6, 8, 9, 10, 12, 13, 14
REED_ORGAN, BANDONEON = 20, 23
VIOLIN, CELLO, CORDES, PIZZ, HARPE = 40, 42, 48, 45, 46
TRUMPET, TROMBONE, TUBA, MUTED_TRUMPET, COR = 56, 57, 58, 59, 60
OBOE, BASSON, CLARINETTE, FLUTE, PAN_FLUTE = 68, 70, 71, 73, 75
# Percussions General MIDI (canal 10)
CLAVES, WOOD_HI, WOOD_LO, TAMBOURIN, CAISSE_CLAIRE = 75, 76, 77, 54, 38

E, MET, DEC, CAR, VOI, A = "eglise", "metiers", "decor", "carnet", "voisins", "ambiance"


def _vers(y: np.ndarray, x: np.ndarray, rapport_db: float) -> float:
    """Gain qui place x à rapport_db (sonie momentanée) sous y: pour poser un objet synthétisé
    (enclume, tasse, sifflet) sur un motif rendu par FluidSynth."""
    return 10 ** ((dsp.sonie_momentanee_max(y) - dsp.sonie_momentanee_max(x) + rapport_db) / 20)


def _boucle_reverbe(y: np.ndarray, rt60: float, humide: float, graine: int, predelai: float = 0.01,
                    aigus: float = 0.4) -> np.ndarray:
    """Réverbération d'une boucle: la queue est repliée sur le début (état continu au raccord)."""
    n = len(y)
    ir = dsp.ir_salle(rt60, predelai, aigus, graine=graine)
    out = dsp.reverbe_mono(y, ir, humide, 1.0)
    boucle = out[:n].copy()
    reste = out[n:]
    while len(reste):
        pris = min(n, len(reste))
        boucle[:pris] += reste[:pris]
        reste = reste[pris:]
    return boucle


# --- Les cloches de Saint-Aubin -------------------------------------------------------------

# Trois cloches accordées sur l'accord de sol (nominales sol 4, si 4, ré 5): le bourdon, la
# moyenne et la petite. Une cloche d'église a des partiels propres (bourdon à l'octave grave,
# fondamentale, tierce mineure, quinte, nominale, octave de la nominale); la tierce mineure,
# qui donne sa couleur à toute cloche, est gardée faible pour ne pas heurter le si de sol majeur.
CLOCHES = {"bourdon": "G4", "moyenne": "B4", "petite": "D5"}
_PARTIELS_CLOCHE = (
    # (rapport à la nominale, amplitude, part de la durée de résonance)
    (0.25, 0.38, 1.0), (0.5, 0.4, 0.7), (0.6, 0.16, 0.55), (0.75, 0.12, 0.35), (1.0, 1.0, 0.42),
    (1.25, 0.1, 0.22), (1.5, 0.28, 0.2), (2.0, 0.2, 0.13), (2.5, 0.09, 0.09), (2.67, 0.07, 0.08),
    (3.2, 0.04, 0.06),
)


def _cloche(rng: np.random.Generator, nominale: float, duree: float, force: float = 1.0,
            t60: float = 7.0) -> np.ndarray:
    """Un coup de battant sur une cloche d'église: partiels de cloche, chacun doublé d'un
    partiel voisin qui bat lentement (la cloche n'est jamais parfaitement ronde), plus le choc
    du battant. Plus le coup est fort, plus les partiels aigus sortent."""
    n = dsp.n_ech(duree)
    partiels = []
    for rapport, amp, part in _PARTIELS_CLOCHE:
        a = amp * (force ** (1.0 + rapport)) if rapport > 1.0 else amp * force
        f = nominale * rapport
        partiels.append((f, a, t60 * part))
        partiels.append((f * (1 + rng.uniform(0.0008, 0.002)), a * 0.35, t60 * part * 0.9))
    y = dsp.modes(n, partiels, rng, attaque=0.0006)
    choc = ins.bruit_bref(rng, 0.03, 1200, 7000, 0.004, 0.0003) * 0.25 * force
    dsp.poser(y, choc, 0.0)
    return y


def _tintement(v: int, rng: np.random.Generator) -> np.ndarray:
    """Un coup du bourdon (sol 4, bourdon au sol 2): les tintements de l'angélus, trois fois
    trois, ou un coup de la corde tirée par l'un des deux joueurs (« L'angélus à deux »)."""
    y = dsp.toile(7.2)
    dsp.poser(y, _cloche(rng, dsp.freq(CLOCHES["bourdon"]), 7.0, (1.0, 0.92)[v % 2]), 0.0)
    return dsp.pb(y, 6500)


def _volee(v: int, rng: np.random.Generator) -> np.ndarray:
    """La volée (10 s, puis la résonance): les trois cloches lancées l'une après l'autre, chacune
    à son balancement (le battant frappe deux fois par aller-retour), qui montent en force,
    sonnent ensemble puis ralentissent quand la sonneuse lâche les cordes."""
    duree = 15.5
    y = dsp.toile(duree)
    # (nominale, intervalle entre deux coups en s, départ, gain)
    for nom, ecart, depart, gain in (("bourdon", 1.18, 0.0, 1.0), ("moyenne", 0.94, 0.55, 0.62),
                                     ("petite", 0.78, 1.1, 0.45)):
        t = depart
        f = dsp.freq(CLOCHES[nom])
        k = 0
        while t < 10.6:
            montee = min(1.0, 0.45 + 0.55 * (t - depart) / 2.5)
            lacher = 1.0 if t < 8.4 else max(0.35, 1.0 - (t - 8.4) / 3.0)
            force = montee * lacher * rng.uniform(0.93, 1.0) * (1.0 if k % 2 == 0 else 0.88)
            dsp.poser(y, _cloche(rng, f, min(5.5, duree - t), force, t60=6.0) * gain * force, t)
            t += ecart * rng.uniform(0.97, 1.03) * (1.0 if t < 8.4 else 1.0 + 0.08 * (t - 8.4))
            k += 1
    return dsp.pb(y, 6500)


# --- L'harmonium ----------------------------------------------------------------------------

_NOTES_HARMONIUM = ("G3", "A3", "B3", "D4", "E4")
_ACCORDS_HARMONIUM = (("G3", "B3", "D4"), ("E3", "G3", "B3"), ("C3", "E3", "G3"), ("D3", "F#3", "A3"))


def _harmonium_note(v: int, rng: np.random.Generator) -> np.ndarray:
    """Une note de l'harmonium d'Armand (orgue à anches de General MIDI), dans la nef: cinq notes
    de la pentatonique de sol, tirées sans répétition; elles sonnent juste les unes après les
    autres, quel que soit l'ordre."""
    nom = _NOTES_HARMONIUM[v % len(_NOTES_HARMONIUM)]
    m = court(f"harmonium-{nom}", 60.0, [Piste("anches", REED_ORGAN, [Note(0.0, 1.6, dsp.note_midi(nom), 64)], 0.0,
                                               pan=64, reverbe=0.5, souffle=True)], queue=2.6, rt60=2.6)
    return rendre(m)


def _harmonium_accord(v: int, rng: np.random.Generator) -> np.ndarray:
    """Les deux joueurs touchent l'harmonium ensemble: un accord doux parmi quatre (sol, mi
    mineur, do, ré), voix serrées, aucune seconde mineure, septième majeure ni triton."""
    notes = _ACCORDS_HARMONIUM[v % len(_ACCORDS_HARMONIUM)]
    m = court(f"harmonium-accord-{v + 1}", 60.0, [Piste("anches", REED_ORGAN, accord(0.0, 2.2, list(notes), 60), 0.0,
                                                        pan=64, reverbe=0.5, souffle=True)], queue=2.8, rt60=2.6)
    return rendre(m)


# --- La forge -------------------------------------------------------------------------------

def _coup_enclume(rng: np.random.Generator, force: float, sur_fer: bool) -> np.ndarray:
    """Un coup de marteau: sur le fer chaud, un choc mat et l'enclume qui sonne étouffée; à vide
    sur la table de l'enclume (le forgeron garde la cadence), un « ting » clair qui résonne."""
    duree = 1.6
    y = dsp.toile(duree)
    f1 = rng.uniform(1020, 1120)
    chant = ins.metal(rng, f1, duree, t60=0.32 if sur_fer else 1.25, rapports=(1.0, 1.52, 2.43, 3.1, 4.6),
                      amps=(1.0, 0.75, 0.5, 0.35, 0.18))
    dsp.poser(y, chant * (0.35 if sur_fer else 0.8) * force, 0.0)
    if sur_fer:
        mat = ins.bruit_bref(rng, 0.09, 220, 2600, 0.018, 0.0004)
        corps = ins.bois(rng, rng.uniform(330, 380), 0.2, 1.0, rapports=(1.0, 2.1, 3.4), t60=0.05, amps=(0.7, 0.4, 0.2))
        dsp.poser(y, dsp.somme(mat * 0.6, corps * 0.5) * force, 0.0)
        # La calamine qui saute du fer chaud: quelques grésillements fins.
        dsp.poser(y, dsp.grains(0.25, 120, lambda r: dsp.clic(r, 3000, 9000, 0.002, 0.0004) * r.uniform(0.05, 0.25),
                                rng) * force, 0.01)
    return y


def _enclume(v: int, rng: np.random.Generator) -> np.ndarray:
    """L'enclume de Mado: un coup sur le fer, un coup à vide, ou le coup suivi du rebond du
    marteau sur la table (« tchang-ting »)."""
    y = dsp.toile(1.9)
    if v % 3 == 0:
        dsp.poser(y, _coup_enclume(rng, 1.0, True), 0.0)
    elif v % 3 == 1:
        dsp.poser(y, _coup_enclume(rng, 0.8, False), 0.0)
    else:
        dsp.poser(y, _coup_enclume(rng, 1.0, True), 0.0)
        dsp.poser(y, _coup_enclume(rng, 0.45, False), 0.19)
    return dsp.pb(y, 10000)


def _forge(v: int, rng: np.random.Generator) -> np.ndarray:
    """La forge au travail (boucle de 12 s, placée dans la cour quand Mado est à l'enclume): le
    feu qui ronfle et crépite, le soufflet qui pousse l'air, puis deux volées de coups, chacune
    de cinq coups sur le fer et deux coups à vide pour reprendre la cadence. Aucune attaque à
    moins de 0,3 s du raccord."""
    duree = 12.0
    n = dsp.n_ech(duree)
    feu = dsp.filtre_circulaire(dsp.bruit_spectral(n, rng, -5.0), dsp.gain_bande(90, 2200)) * 0.03
    feu *= 1 + 0.25 * ambiances.lfo_periodique(n, [(3, 1.0), (7, 0.5)], rng)
    y = feu + dsp.grains(duree, 14, lambda r: dsp.clic(r, 1500, 7000, 0.004, 0.0009) * r.uniform(0.04, 0.16), rng,
                         circulaire=True)
    for t0 in (0.6, 5.3, 9.9):
        m = dsp.n_ech(1.1)
        souffle = dsp.pbande(rng.standard_normal(m), 120, 1400) * dsp.env_points(m, [(0, 0), (0.25, 1.0), (0.7, 0.6), (1.1, 0)])
        cuir = ins.crissement(rng, 0.25, lambda u: 70 + 60 * u, [(450, 6), (1100, 8)], 0.2)
        dsp.poser(y, souffle * 0.09, t0, circulaire=True)
        dsp.poser(y, cuir * dsp.env_ar(len(cuir), 0.04, 0.12) * 0.05, t0 + 0.75, circulaire=True)
    for t0 in (1.9, 6.6):
        t = t0
        for k in range(7):
            sur_fer = k < 5
            force = (0.95 if sur_fer else 0.45) * rng.uniform(0.92, 1.0)
            dsp.poser(y, _coup_enclume(rng, force, sur_fer) * 0.5, t, circulaire=True)
            t += 0.46 if sur_fer else 0.23
    return dsp.filtre_circulaire(y, dsp.gain_bande(0, 10000))


# --- Le moulin de la Vanne ------------------------------------------------------------------

def _eclaboussure(rng: np.random.Generator, force: float) -> np.ndarray:
    """L'eau qui tombe sur une aube de la roue: un claquement mouillé et des gouttes."""
    y = dsp.toile(0.5)
    dsp.poser(y, ins.bruit_bref(rng, 0.3, 350, 5000, 0.07, 0.004) * 0.5 * force, 0.0)
    gouttes = dsp.grains(0.35, 60, lambda r: dsp.bulle(r, r.uniform(600, 2600), r.uniform(0.004, 0.012)) *
                         r.uniform(0.1, 0.4), rng)
    dsp.poser(y, gouttes * force, 0.02)
    return y


def _roue(v: int, rng: np.random.Generator) -> np.ndarray:
    """La roue à aubes sur le bief (boucle de 16 s, placée à la roue, au sud du moulin): la
    chute d'eau continue, une aube qui prend l'eau toutes les 0,5 s (huit aubes, un tour en
    4 s), l'axe de bois qui grince une fois par tour, l'eau qui ruisselle de la roue."""
    duree = 16.0
    n = dsp.n_ech(duree)
    chute = dsp.filtre_circulaire(dsp.bruit_spectral(n, rng, -2.5), dsp.gain_bande(180, 6500)) * 0.11
    chute *= 1 + 0.12 * ambiances.lfo_periodique(n, [(4, 1.0), (9, 0.4)], rng)
    y = chute
    forces = rng.uniform(0.7, 1.0, 8)
    for k in range(32):
        dsp.poser(y, _eclaboussure(rng, forces[k % 8] * rng.uniform(0.9, 1.0)) * 0.45, 0.25 + 0.5 * k, circulaire=True)
    for tour in range(4):
        g = ins.crissement(rng, 0.6, lambda u: 60 + 50 * np.sin(np.pi * u), [(rng.uniform(380, 430), 7),
                                                                          (rng.uniform(820, 900), 9)], 0.2)
        dsp.poser(y, g * dsp.env_ar(len(g), 0.12, 0.2) * 0.12, 1.6 + 4.0 * tour, circulaire=True)
    y += dsp.grains(duree, 40, lambda r: dsp.bulle(r, r.uniform(700, 3200), r.uniform(0.003, 0.009)) * r.uniform(0.04, 0.15),
                    rng, circulaire=True)
    return dsp.filtre_circulaire(y, dsp.gain_bande(0, 9000))


def _meules(v: int, rng: np.random.Generator) -> np.ndarray:
    """La salle des meules en marche (boucle de 12 s): la meule tournante qui gronde (un tour en
    1,5 s), le rouet de bois dont les dents claquent neuf fois par seconde, l'auget qui tape
    trois fois par seconde sous la trémie pour faire couler le grain, la farine qui chuinte."""
    duree = 12.0
    n = dsp.n_ech(duree)
    t = np.arange(n) / SR
    grond = dsp.filtre_circulaire(dsp.bruit_spectral(n, rng, -6.0), dsp.gain_bande(45, 900)) * 0.03
    grond *= 1 + 0.18 * np.sin(2 * np.pi * 8 * t / duree + 0.7)
    farine = dsp.filtre_circulaire(dsp.bruit_spectral(n, rng, 0.0), dsp.gain_bande(2500, 8000)) * 0.006
    y = grond + farine
    for k in range(108):
        dent = ins.bois(rng, rng.uniform(520, 580), 0.08, 0.7, rapports=(1.0, 2.2, 3.7), t60=0.035,
                        amps=(0.6, 0.45, 0.2))
        dsp.poser(y, dent * 0.09 * (1.0 if k % 9 else 1.4), (k + 0.5) / 9.0, circulaire=True)
    for k in range(36):
        auget = ins.bois(rng, rng.uniform(900, 980), 0.1, 1.0, rapports=(1.0, 1.8, 3.1), t60=0.04, amps=(0.7, 0.4, 0.2))
        dsp.poser(y, auget * 0.12, (k + 0.5) / 3.0 + 0.06, circulaire=True)
    y = _boucle_reverbe(y, 0.7, 0.3, 91)
    return dsp.filtre_circulaire(y, dsp.gain_bande(0, 9000))


def _vanne(v: int, rng: np.random.Generator) -> np.ndarray:
    """La vanne du bief se lève (« La vanne coincée », à deux): le cliquet de la crémaillère
    claque huit fois, la porte de bois frotte dans ses rainures, l'eau se rue sous la vanne,
    puis la roue se met en marche (les aubes prennent l'eau de plus en plus vite)."""
    duree = 7.0
    y = dsp.toile(duree)
    t = 0.0
    for k in range(8):
        cran = ins.metal(rng, rng.uniform(1500, 1700), 0.15, t60=0.06, rapports=(1.0, 1.7, 2.6), amps=(1.0, 0.5, 0.25))
        dsp.poser(y, dsp.somme(cran * 0.35, ins.bois(rng, 300, 0.12, 0.6, t60=0.05) * 0.25), t)
        t += 0.28 - 0.01 * k
    g = ins.crissement(rng, 2.0, lambda u: 50 + 90 * u, [(rng.uniform(280, 320), 6), (rng.uniform(640, 700), 8)], 0.25)
    dsp.poser(y, g * dsp.env_ar(len(g), 0.3, 0.4) * 0.18, 0.2)
    m = dsp.n_ech(duree - 1.8)
    ruee = dsp.pbande(rng.standard_normal(m), 150, 6000)
    ruee = ruee * dsp.env_points(m, [(0, 0), (0.6, 0.8), (1.6, 1.0), (duree - 1.8, 0.85)]) * 0.3
    dsp.poser(y, ruee, 1.8)
    t = 3.4
    ecart = 0.95
    while t < duree - 0.3:
        dsp.poser(y, _eclaboussure(rng, rng.uniform(0.8, 1.0)) * 0.6, t)
        t += ecart
        ecart = max(0.5, ecart * 0.85)
    return dsp.pb(y, 9000)


# --- Le lavoir ------------------------------------------------------------------------------

def _battoir(v: int, rng: np.random.Generator) -> np.ndarray:
    """Le battoir sur le linge mouillé, posé sur la pierre du lavoir: un claquement mouillé
    (« flac »), le bois du battoir, la pierre dessous, l'eau qui gicle."""
    y = dsp.toile(0.7)
    flac = ins.bruit_bref(rng, 0.12, 300, 3500, 0.025, 0.0006)
    dsp.poser(y, flac * 0.7, 0.0)
    battoir = ins.bois(rng, rng.uniform(260, 320), 0.18, 0.7, rapports=(1.0, 2.3, 3.8), t60=0.06, amps=(0.7, 0.5, 0.25))
    dsp.poser(y, battoir * 0.45, 0.0)
    pierre = ins.bruit_bref(rng, 0.03, 1500, 6000, 0.004, 0.0003)
    dsp.poser(y, pierre * 0.2, 0.002)
    gicle = dsp.grains(0.35, (90, 70, 110)[v % 3], lambda r: dsp.bulle(r, r.uniform(800, 3200), r.uniform(0.003, 0.008)) *
                       r.uniform(0.1, 0.45), rng, enveloppe=lambda u: np.exp(-u / 0.12))
    dsp.poser(y, gicle * 0.6, 0.01)
    return dsp.pb(y, 9000)


# --- Le puits, la rivière, le belvédère -----------------------------------------------------

def _plic(v: int, rng: np.random.Generator) -> np.ndarray:
    """Un rebond du galet sur l'eau (ricochet): un « plic » vif, une bulle aiguë et quelques
    gouttelettes. Le jeu en joue un par rebond, de plus en plus serrés."""
    y = dsp.toile(0.3)
    dsp.poser(y, dsp.bulle(rng, rng.uniform(1500, 2300), rng.uniform(0.004, 0.007), 0.9) * 0.6, 0.0)
    dsp.poser(y, ins.bruit_bref(rng, 0.05, 1200, 7000, 0.008, 0.0003) * 0.35, 0.0)
    dsp.poser(y, dsp.grains(0.15, 80, lambda r: dsp.bulle(r, r.uniform(2500, 4500), r.uniform(0.002, 0.004)) *
                            r.uniform(0.05, 0.2), rng), 0.01)
    return dsp.pb(y, 11000)


def _peigne(x: np.ndarray, retard: float, retour: float, fc: float) -> np.ndarray:
    """Filtre en peigne bouclé (puits: les allers et retours entre l'eau et la margelle)."""
    from scipy import signal

    d = dsp.n_ech(retard)
    a = np.zeros(d + 1)
    a[0], a[d] = 1.0, -retour
    y = signal.lfilter([1.0], a, np.concatenate([x, np.zeros(dsp.n_ech(1.5))]))
    return dsp.pb(y, fc, 1)


def _goutte_puits(v: int, rng: np.random.Generator) -> np.ndarray:
    """Penché sur la margelle: une goutte tombe au fond du puits (« ploc ») et résonne dans le
    cylindre de pierre. La seconde variante fait deux gouttes."""
    y = dsp.toile(0.6)
    for t0 in ((0.0,), (0.0, 0.32))[v % 2]:
        dsp.poser(y, dsp.bulle(rng, rng.uniform(750, 950), rng.uniform(0.012, 0.018), 0.8) * 0.7, t0)
        dsp.poser(y, ins.bruit_bref(rng, 0.04, 400, 3000, 0.006) * 0.15, t0)
    y = _peigne(y, 0.0115, 0.55, 2500)
    ir = dsp.ir_salle(1.8, 0.02, 0.3, graine=101)
    return dsp.pb(dsp.reverbe_mono(y, ir, 0.6, 0.8), 6000)


def _hululement(rng: np.random.Generator, f0: float, duree: float) -> np.ndarray:
    """Hululement soufflé dans les mains jointes (comme un appeau): un son d'ocarina presque pur
    qui monte un peu puis retombe, du souffle autour. Aucun formant de voix."""
    n = dsp.n_ech(duree)
    t = np.arange(n) / SR
    f = f0 * np.interp(t, [0, 0.12 * duree, 0.6 * duree, duree], [0.94, 1.03, 1.0, 0.9])
    f *= 1 + 0.006 * np.sin(2 * np.pi * 5.2 * t)
    ton = dsp.sinus_glisse(f) + 0.08 * dsp.sinus_glisse(2 * f) + 0.03 * dsp.sinus_glisse(3 * f)
    souffle = dsp.pbande(rng.standard_normal(n), f0 * 0.8, f0 * 4) * 0.06
    return (ton + souffle) * dsp.env_ar(n, 0.06, duree * 0.45, 1.3)


def _echo_puits(v: int, rng: np.random.Generator) -> np.ndarray:
    """Maintenir Agir au puits: le hululement descend dans le puits et revient « hou… ou… »,
    battu par les allers et retours dans le cylindre, puis une dernière fois du fond."""
    y = dsp.toile(1.4)
    cri = _hululement(rng, 400.0, 0.65)
    dsp.poser(y, cri, 0.0)
    dsp.poser(y, dsp.pb(cri, 1800) * 0.3, 0.62)
    y = _peigne(y, 0.058, 0.5, 2000)
    ir = dsp.ir_salle(1.6, 0.02, 0.3, graine=103)
    return dsp.pb(dsp.reverbe_mono(y, ir, 0.45, 0.9), 7000)


def _echo_belvedere(v: int, rng: np.random.Generator) -> np.ndarray:
    """Le hululement du belvédère et le double écho de la vallée: le coteau d'en face renvoie
    à 0,95 s, plus loin encore à 1,75 s, chaque fois plus sourd."""
    y = dsp.toile(3.6)
    cri = _hululement(rng, (430.0, 380.0)[v % 2], 0.7)
    dsp.poser(y, cri, 0.0)
    dsp.poser(y, dsp.pb(cri, 2600) * 0.34, 0.95)
    dsp.poser(y, dsp.pb(cri, 1600) * 0.17, 1.75)
    ir = dsp.ir_salle(2.4, 0.06, 0.3, graine=105)
    return dsp.pb(dsp.reverbe_mono(y, ir, 0.2, 1.0), 8000)


def _echo_lointain(v: int, rng: np.random.Generator) -> np.ndarray:
    """Le même hululement entendu du bourg: lointain, sourd, et ses deux échos."""
    y = dsp.toile(3.6)
    cri = dsp.pb(_hululement(rng, 410.0, 0.7), 1500, 2)
    for t0, g in ((0.0, 1.0), (0.95, 0.5), (1.75, 0.28)):
        dsp.poser(y, cri * g, t0)
    ir = dsp.ir_salle(2.6, 0.08, 0.25, graine=107)
    return dsp.reverbe_mono(y, ir, 0.45, 0.8)


def _pas_feuilles(v: int, rng: np.random.Generator) -> np.ndarray:
    """Un pas dans les feuilles mortes de la forêt: le froissement sec, la terre molle dessous;
    une variante sur quatre casse une brindille."""
    y = dsp.toile(0.42)
    dsp.poser(y, ins.froissement(rng, 0.3, 900, 7000, rng.uniform(70, 110), 0.012, 0.15) * 0.55, 0.0)
    dsp.poser(y, ins.bruit_bref(rng, 0.06, 90, 500, 0.018) * 0.35, 0.005)
    if v % 4 == 3:
        dsp.poser(y, ins.bois(rng, rng.uniform(1700, 2100), 0.06, 1.0, t60=0.015) * 0.3, 0.05)
    return dsp.pb(y, 9000)


# --- Le chat du bourg -----------------------------------------------------------------------

def _ronron(v: int, rng: np.random.Generator) -> np.ndarray:
    """Le chat ronronne sous la main (2,6 s): un roulement d'environ 26 coups par seconde, plus
    fort à l'expiration qu'à l'inspiration, passé par les résonances du petit corps (250, 700 et
    1 600 Hz: il reste entendu sur des haut-parleurs de portable)."""
    duree = 2.6
    n = dsp.n_ech(duree)
    t = np.arange(n) / SR
    cycle = (1.55, 1.7)[v % 2]
    phase_respi = (t % cycle) / cycle
    expire = phase_respi > 0.42
    cadence = np.where(expire, 26.5, 23.0) * (1 + 0.03 * np.sin(2 * np.pi * 0.7 * t))
    ph = np.cumsum(cadence) / SR
    impulsions = np.zeros(n)
    passages = np.where(np.diff(np.floor(ph)) > 0)[0]
    impulsions[passages] = rng.uniform(0.7, 1.0, len(passages))
    grain = dsp.pb(rng.standard_normal(dsp.n_ech(0.012)), 3000) * np.hanning(dsp.n_ech(0.012))
    source = np.convolve(impulsions, grain)[:n]
    corps = (dsp.resonateur(source, 250, 3) * 1.0 + dsp.resonateur(source, 700, 4) * 0.9
             + dsp.resonateur(source, 1600, 5) * 0.45)
    souffle = dsp.pbande(rng.standard_normal(n), 500, 3000) * 0.04
    respi = np.where(expire, 1.0, 0.55)
    respi = np.convolve(respi, np.ones(dsp.n_ech(0.08)) / dsp.n_ech(0.08), mode="same")
    return (corps + souffle) * respi * dsp.env_ar(n, 0.15, 0.4)


def _miaou(v: int, rng: np.random.Generator) -> np.ndarray:
    """Un miaulement doux: la première variante est un « mrrp » qui monte (le chat salue), la
    seconde un « miaou » bref et tendre qui retombe."""
    if v % 2 == 0:
        duree, points, r_ = 0.32, [(0, 560), (0.08, 600), (0.32, 760)], 0.09
    else:
        duree, points, r_ = 0.62, [(0, 520), (0.18, 720), (0.62, 470)], 0.05
    n = dsp.n_ech(duree)
    t = np.arange(n) / SR
    f = np.interp(t, [p[0] for p in points], [p[1] for p in points]) * (1 + 0.01 * np.sin(2 * np.pi * 6 * t))
    phase = 2 * np.pi * np.cumsum(f) / SR
    source = sum((1.0 / k ** 1.2) * np.sin(k * phase) for k in range(1, 16) if 760 * k < 11000)
    # Le roulement du début (« mrr »)
    source *= 1 - 0.6 * (t < r_) * (0.5 + 0.5 * np.sin(2 * np.pi * 32 * t))
    f1 = lambda s: float(np.interp(s, [0, duree * 0.4, duree], [800, 1300, 900]))  # noqa: E731
    f2 = lambda s: float(np.interp(s, [0, duree * 0.4, duree], [1900, 2500, 1600]))  # noqa: E731
    y = (dsp.pb_variable(source, f1, type_="band", q_bande=3.0) * 1.0
         + dsp.pb_variable(source, f2, type_="band", q_bande=4.0) * 0.5)
    return y * dsp.env_ar(n, 0.03, duree * 0.45)


# --- Le carnet et l'amitié -------------------------------------------------------------------

def _crayon(v: int, rng: np.random.Generator) -> np.ndarray:
    """Le crayon du carnet écrit une habitude: trois ou quatre traits de mine sur le papier
    (grain du papier, 2,5 à 8 kHz), puis le point posé. Doux: une notification sans son fort."""
    y = dsp.toile(0.8, stereo=True)
    t = 0.0
    traits = ((0.13, 0.09, 0.16), (0.1, 0.15, 0.08, 0.12))[v % 2]
    for k, d in enumerate(traits):
        m = dsp.n_ech(d)
        mine = dsp.pbande(rng.standard_normal(m), 2500, 8000)
        grain = np.abs(dsp.pb(rng.standard_normal(m), 350, 2))
        grain = (grain / (grain.max() + 1e-12)) ** 1.3
        trait = mine * grain * dsp.env_ar(m, 0.015, d * 0.4)
        dsp.poser(y, trait * rng.uniform(0.75, 1.0), t, pan=-0.1 + 0.07 * k)
        t += d + rng.uniform(0.03, 0.06)
    dsp.poser(y, ins.bois(rng, 2400, 0.04, 1.0, rapports=(1.0, 2.2), t60=0.01, amps=(0.5, 0.3)) * 0.3, t + 0.03, pan=0.15)
    return dsp.pb(y, 10000)


def _verre(rng: np.random.Generator, f: float, duree: float, t60: float = 0.9) -> np.ndarray:
    """Le verre d'une lanterne effleuré: partiels d'un cylindre de verre (1; 2,32; 4,25; 6,63)."""
    n = dsp.n_ech(duree)
    return dsp.modes(n, [(f, 1.0, t60), (f * 2.32, 0.3, t60 * 0.45), (f * 4.25, 0.1, t60 * 0.25),
                         (f * 6.63, 0.04, t60 * 0.15)], rng, attaque=0.0006)


def _lanterne(v: int, rng: np.random.Generator) -> np.ndarray:
    """Un gain d'amitié: la lanterne frémit (le verre tinte deux fois, très vite, comme une
    lanterne qu'on effleure) et l'anse de laiton cliquette. Ré 6 ou sol 6."""
    y = dsp.toile(1.3, stereo=True)
    f = dsp.freq(("D6", "G6")[v % 2])
    dsp.poser(y, _verre(rng, f, 1.2) * 0.8, 0.0, pan=-0.05)
    dsp.poser(y, _verre(rng, f, 1.1) * 0.35, 0.055, pan=0.08)
    anse = ins.metal(rng, rng.uniform(3200, 3500), 0.2, t60=0.06, rapports=(1.0, 1.6, 2.5), amps=(1.0, 0.4, 0.2))
    dsp.poser(y, anse * 0.1, 0.02, pan=0.2)
    return dsp.pb(y, 10000)


def _niveau(v: int, rng: np.random.Generator) -> np.ndarray:
    """Un niveau d'amitié passé: une petite volée de clochettes (sol 6, mi 6, ré 6, si 5, sol 5,
    deux tours, le second plus doux et plus lent), puis les cinq ensemble qui résonnent: une
    lanterne s'allume."""
    y = dsp.toile(3.2, stereo=True)
    notes = ("G6", "E6", "D6", "B5", "G5")
    pans = (0.45, 0.22, 0.0, -0.22, -0.45)
    t = 0.0
    for tour, (ecart, g) in enumerate(((0.13, 0.7), (0.16, 0.5))):
        for k, nom in enumerate(notes):
            dsp.poser(y, ins.clochette(dsp.freq(nom), 2.4 - t * 0.3, rng, brillance=0.7, t60=1.2) * g,
                      t + rng.uniform(-0.006, 0.006), pan=pans[k])
            t += ecart
    for k, nom in enumerate(notes):
        dsp.poser(y, ins.clochette(dsp.freq(nom), 1.8, rng, brillance=0.6, t60=1.5) * 0.45, t + 0.08 + 0.012 * k,
                  pan=pans[k])
    return dsp.pb(y, 10000)


def _anniversaire(v: int, rng: np.random.Generator) -> np.ndarray:
    """Souhaiter un anniversaire: une boîte à musique fait trois pas de valse qui montent (sol,
    si, ré; mi, ré, si; sol), la harpe porte l'accord, un trille de glockenspiel fait le petit
    bouquet. Pentatonique de sol: aucune paire dure."""
    boite = mel("G5:.5 B5:.5 D6:.5 E6:.5 D6:.5 B5:.5 G6:1.5", 0.0, 84, legato=1.0)
    harpe = [Note(0.0 + 0.06 * k, 4.0, dsp.note_midi(p), 54 + 2 * k) for k, p in enumerate(("G2", "D3", "G3", "B3", "D4"))]
    trille = mel("r:3 D7:.125 E7:.125 D7:.125 E7:.125 D7:.5", 0.0, 50, legato=0.9)
    m = court("birthday-chime", 120.0, [
        Piste("boite", MUSIC_BOX, boite, 0.0, pan=60, reverbe=0.3),
        Piste("harpe", HARPE, harpe, -7.0, pan=70, reverbe=0.35),
        Piste("glock", GLOCK, trille, -12.0, pan=84, reverbe=0.35),
    ], signature=(3, 4), queue=2.0, rt60=1.5)
    return rendre(m)


def _decision(v: int, rng: np.random.Generator) -> np.ndarray:
    """Décision à deux: deux marimbas, l'un à gauche, l'autre à droite, se répondent (ré, puis
    si), puis frappent ensemble la quinte sol et ré pendant que le cor gonfle dessous: chacun
    a dit son choix, et c'est le même. Distinct de l'air « à deux » (flûte et clarinette)."""
    gauche = [Note(0.0, 0.5, dsp.note_midi("D5"), 78), Note(1.0, 2.0, dsp.note_midi("G4"), 74)]
    droite = [Note(0.5, 0.5, dsp.note_midi("B5"), 78), Note(1.0, 2.0, dsp.note_midi("D5"), 74)]
    cor = [Note(1.0, 2.0, dsp.note_midi("G3"), 58), Note(1.0, 2.0, dsp.note_midi("D4"), 52)]
    m = court("decision-agree", 120.0, [
        Piste("marimba_g", MARIMBA, gauche, 0.0, pan=26, reverbe=0.25, canal=0),
        Piste("marimba_d", MARIMBA, droite, 0.0, pan=102, reverbe=0.25, canal=1),
        Piste("cor", COR, cor, -8.0, pan=64, reverbe=0.35, souffle=True),
    ], queue=1.8, rt60=1.4)
    return rendre(m)


# --- Motifs des quatorze habitants -----------------------------------------------------------

def _motif(id_: str, tempo: float, pistes: list[Piste], signature=(4, 4), queue: float = 1.8,
           strict: bool = True) -> np.ndarray:
    return rendre(court(id_, tempo, pistes, signature=signature, queue=queue), strict=strict)


def _n(t: float, d: float, nom: str, v: int) -> Note:
    return Note(t, d, dsp.note_midi(nom), v)


def motif_armand(v: int, rng: np.random.Generator) -> np.ndarray:
    """Armand Castagné, l'instituteur qui tient l'harmonium: timide d'abord (deux notes
    hésitantes de l'orgue à anches, un silence), puis sûr de lui comme au pupitre (la phrase
    monte d'un pas égal et se pose sur ré, sur une pédale de sol)."""
    melodie = mel("r:.5 D4:.5 E4:.5 r:.5 G4:.5 A4:.5 B4:.5 D5:2", 0.0, 62, legato=0.9)
    for k, nt in enumerate(melodie):
        nt.v = min(92, 58 + 7 * k)
    pedale = [_n(2.0, 3.0, "G2", 56), _n(3.5, 1.5, "B3", 50), _n(3.5, 1.5, "D4", 50)]
    return _motif("motif-armand", 104.0, [
        Piste("anches", REED_ORGAN, melodie, 0.0, pan=58, reverbe=0.35, souffle=True),
        Piste("pedale", REED_ORGAN, pedale, -6.0, pan=68, reverbe=0.35, souffle=True),
    ])


def motif_berthe(v: int, rng: np.random.Generator) -> np.ndarray:
    """Berthe Lavergne, la meunière franche et têtue: le cor dit sa phrase d'un trait (sol, ré,
    sol, si), les pizzicati tournent comme la roue (à trois temps), et la fin éclate de rire
    (si et ré qui rebondissent)."""
    cor = mel("G3:1! D4:1 G4:1 B4:1.5 A4:.5 G4:1", 0.0, 84, legato=0.9)
    roue = []
    for k in range(6):
        roue += [_n(k * 1.0, 0.4, ("G2", "D3", "B3")[k % 3], 60 if k % 3 == 0 else 50)]
    rire = mel("r:5 D5:.25 B4:.25 D5:.25 B4:.25 G4:.5", 0.0, 70, legato=0.7)
    return _motif("motif-berthe", 116.0, [
        Piste("cor", COR, cor, 0.0, pan=58, reverbe=0.25, souffle=True),
        Piste("roue", PIZZ, roue, -7.0, pan=70, reverbe=0.15),
        Piste("rire", PIZZ, rire, -6.0, pan=78, reverbe=0.15, canal=3),
    ], signature=(3, 4))


def motif_martial(v: int, rng: np.random.Generator) -> np.ndarray:
    """L'abbé Martial Roques, jovial et sportif: le trombone rebondit (sol, ré, sol, puis si,
    ré), les pizzicati pédalent à la croche, le tambourin rit une fois."""
    trombone = mel("G2:.5 D3:.5 G3:.5 r:.25 D3:.25 G3:.5 B3:.5 D4:1", 0.0, 82, legato=0.8)
    pedale = [_n(0.5 * k, 0.2, ("G3", "D4")[k % 2], 46) for k in range(8)]
    tambourin = [Note(3.0, 0.5, TAMBOURIN, 54), Note(3.25, 0.5, TAMBOURIN, 40)]
    return _motif("motif-martial", 126.0, [
        Piste("trombone", TROMBONE, trombone, 0.0, pan=60, reverbe=0.22),
        Piste("pizz", PIZZ, pedale, -9.0, pan=72, reverbe=0.15),
        Piste("tambourin", 0, tambourin, -14.0, pan=80, reverbe=0.15, percussions=True),
    ])


def motif_marthe(v: int, rng: np.random.Generator) -> np.ndarray:
    """Marthe Bousquet, la sonneuse sèche et exacte: trois coups de cloche tubulaire, pile en
    mesure (ré, ré, ré), puis le hautbois glisse une petite phrase pincée (si, la, sol), drôle
    sans le vouloir."""
    cloches = [_n(0.0, 0.6, "D5", 76), _n(1.0, 0.6, "D5", 72), _n(2.0, 0.9, "D5", 70)]
    hautbois = mel("r:3 B4:.25 A4:.25 G4:.5", 0.0, 72, legato=0.6)
    basse = [_n(3.0, 0.5, "G2", 58)]
    return _motif("motif-marthe", 104.0, [
        Piste("cloches", TUBULAR, cloches, 0.0, pan=56, reverbe=0.3),
        Piste("hautbois", OBOE, hautbois, -2.0, pan=70, reverbe=0.2),
        Piste("pizz", PIZZ, basse, -9.0, pan=64, reverbe=0.15),
    ], queue=2.2)


def motif_honorine(v: int, rng: np.random.Generator) -> np.ndarray:
    """Honorine Valade, la doyenne malicieuse qui tricote: une boîte à musique, lente, avec une
    note glissée de travers comme un clin d'œil, et les aiguilles à tricoter (claves, très
    doux) qui cliquettent dessous."""
    boite = mel("G5:.5 B5:.5 A5:.25 G5:.25 E5:.5 D5:.25 E5:.25 G5:1.5", 0.0, 76, legato=1.0)
    harpe = [_n(0.0, 3.5, "G3", 50), _n(0.05, 3.5, "D4", 46)]
    aiguilles = [Note(0.25 * k, 0.1, CLAVES, 34 + 8 * (k % 2)) for k in range(12)]
    return _motif("motif-honorine", 92.0, [
        Piste("boite", MUSIC_BOX, boite, 0.0, pan=60, reverbe=0.3),
        Piste("harpe", HARPE, harpe, -8.0, pan=70, reverbe=0.3),
        Piste("aiguilles", 0, aiguilles, -15.0, pan=82, reverbe=0.1, percussions=True),
    ])


def motif_ines(v: int, rng: np.random.Generator) -> np.ndarray:
    """Inès Garrigue, la garde forestière calme et précise: la flûte de Pan pose ré, si, la,
    sol, sans un mot de trop; un oiseau répond au loin (glockenspiel), puis un seul pizzicato
    grave, pince-sans-rire."""
    flute = mel("D5:1 B4:.5 A4:.5 G4:1.5", 0.0, 74, legato=0.95)
    oiseau = mel("r:2.5 E6:.125 D6:.375", 0.0, 46, legato=0.9)
    pizz = [_n(3.75, 0.25, "G2", 66)]
    return _motif("motif-ines", 84.0, [
        Piste("pan", PAN_FLUTE, flute, 0.0, pan=58, reverbe=0.3, souffle=True),
        Piste("oiseau", GLOCK, oiseau, -11.0, pan=88, reverbe=0.35),
        Piste("pizz", PIZZ, pizz, -6.0, pan=64, reverbe=0.15),
    ])


def motif_barnabe(v: int, rng: np.random.Generator) -> np.ndarray:
    """Barnabé Tixier, le charbonnier colosse et doux qui chante en basse: le violoncelle chante
    à la place de la voix (sol, si, ré, sol, la, sol), la harpe arpège doucement; un coup sourd
    de bois au départ, comme la hache posée."""
    celle = mel("G2:1 B2:.5 D3:.5 G3:1.5 A3:.5 G3:2", 0.0, 76, legato=0.98)
    harpe = [_n(0.5 * k, 1.5, ("G3", "B3", "D4", "G4")[k % 4], 44) for k in range(8)]
    hache = [Note(0.0, 0.3, WOOD_LO, 50)]
    return _motif("motif-barnabe", 80.0, [
        Piste("violoncelle", CELLO, celle, 0.0, pan=60, reverbe=0.3, souffle=True),
        Piste("harpe", HARPE, harpe, -9.0, pan=72, reverbe=0.3),
        Piste("hache", 0, hache, -12.0, pan=50, reverbe=0.15, percussions=True),
    ], queue=2.0)


def _ting(rng: np.random.Generator) -> np.ndarray:
    """Le « ting » de l'enclume, accordé sur sol 5 pour rester juste dans le motif."""
    f = dsp.freq("G5")
    return dsp.modes(dsp.n_ech(1.2), [(f, 1.0, 1.0), (f * 1.52, 0.4, 0.5), (f * 2.43, 0.2, 0.3)], rng, attaque=0.0003)


def motif_mado(v: int, rng: np.random.Generator) -> np.ndarray:
    """Madeleine « Mado » Cazals, la forgeronne forte et rieuse: deux coups d'enclume (accordés
    sur sol), puis la trompette bouchée éclate de rire (ré, ré, sol, si, la, si, ré)."""
    trompette = mel("r:1 D5:.25 D5:.25 r:.25 G5:.25 B5:.5 A5:.25 B5:.25 D6:1", 0.0, 86, legato=0.75)
    basse = [_n(1.0, 0.4, "G2", 64), _n(2.0, 0.4, "D3", 58), _n(3.0, 0.6, "G2", 60)]
    y = _motif("motif-mado", 132.0, [
        Piste("trompette", MUTED_TRUMPET, trompette, 0.0, pan=60, reverbe=0.2),
        Piste("pizz", PIZZ, basse, -8.0, pan=68, reverbe=0.15),
    ])
    ting = _ting(rng)
    g = _vers(y, ting, -4.0)
    dsp.poser(y, ting * g, 0.0, pan=-0.2)
    dsp.poser(y, ting * g * 0.8, 60.0 / 132.0 * 0.5, pan=-0.2)
    return y


def motif_paulin(v: int, rng: np.random.Generator) -> np.ndarray:
    """Paulin Delmas, le cultivateur têtu, peu de mots mais justes: le tuba dit trois notes,
    fermes (sol, ré, sol), doublées deux octaves plus haut par le cor (elles s'entendent sur un
    portable), et les cordes tiennent la terre dessous."""
    tuba = mel("G2:1! D2:1 G2:2", 0.0, 84, legato=0.9)
    cor = mel("G4:1! D4:1 G4:2", 0.0, 76, legato=0.9)
    cordes = [_n(1.0, 3.0, "B3", 44), _n(1.0, 3.0, "D4", 46), _n(1.0, 3.0, "G4", 42)]
    return _motif("motif-paulin", 92.0, [
        Piste("tuba", TUBA, tuba, -5.0, pan=60, reverbe=0.22, souffle=True),
        Piste("cor", COR, cor, 0.0, pan=66, reverbe=0.25, souffle=True),
        Piste("cordes", CORDES, cordes, -9.0, pan=70, reverbe=0.3, souffle=True),
    ])


def motif_margot(v: int, rng: np.random.Generator) -> np.ndarray:
    """Margot Delmas, gaie et diplomate: le violon pose une question et y répond lui-même, en
    deux phrases égales (si, ré, sol, fa dièse, mi; ré, mi, fa dièse, sol), sur les pizzicati."""
    violon = mel("B4:.5 D5:.5 G5:.5 F#5:.25 E5:.25 D5:.5 E5:.25 F#5:.25 G5:1", 0.0, 80, legato=0.9)
    pizz = (accord(0.0, 0.4, ["G3", "B3"], 56) + accord(1.0, 0.4, ["G3", "D4"], 50)
            + accord(2.0, 0.4, ["D3", "A3"], 54) + accord(3.0, 0.9, ["G3", "B3"], 52))
    return _motif("motif-margot", 120.0, [
        Piste("violon", VIOLIN, violon, 0.0, pan=58, reverbe=0.25, souffle=True),
        Piste("pizz", PIZZ, pizz, -8.0, pan=70, reverbe=0.15),
    ])


def _sifflet_leon(rng: np.random.Generator) -> np.ndarray:
    """Le sifflet de chef de train de Léon: un sifflet à bille, bref, roulé."""
    n = dsp.n_ech(0.32)
    t = np.arange(n) / SR
    f = 2950 * (1 + 0.035 * np.sin(2 * np.pi * 34 * t))
    ton = dsp.sinus_glisse(f) * (0.75 + 0.25 * np.sin(2 * np.pi * 34 * t))
    souffle = dsp.pbande(rng.standard_normal(n), 2000, 6000) * 0.12
    return (ton + souffle) * dsp.env_ar(n, 0.01, 0.08)


def motif_leon(v: int, rng: np.random.Generator) -> np.ndarray:
    """Léon Delmas, onze ans, fanfaron au grand cœur: la trompette sonne une petite fanfare
    (sol, sol, sol, ré; si, ré, sol), la caisse claire roule, et un coup de son sifflet de chef
    de train pour finir."""
    trompette = mel("G4:.25 G4:.25 G4:.25 D5:.75 B4:.25 D5:.25 G5:1", 0.0, 82, legato=0.8)
    caisse = [Note(0.125 * k, 0.1, CAISSE_CLAIRE, 26 + 3 * k) for k in range(8)]
    pizz = [_n(1.5, 0.4, "G2", 60), _n(2.0, 1.0, "G3", 54)]
    y = _motif("motif-leon", 132.0, [
        Piste("trompette", TRUMPET, trompette, 0.0, pan=60, reverbe=0.2),
        Piste("caisse", 0, caisse, -14.0, pan=72, reverbe=0.1, percussions=True),
        Piste("pizz", PIZZ, pizz, -8.0, pan=66, reverbe=0.15),
    ], queue=1.5)
    sifflet = _sifflet_leon(rng)
    dsp.poser(y, sifflet * _vers(y, sifflet, -9.0), 3.0 * 60.0 / 132.0 + 0.05, pan=0.3)
    return y


def motif_ambroise(v: int, rng: np.random.Generator) -> np.ndarray:
    """Ambroise Pélissier, l'horloger pointilleux et ronchon: le clavecin égrène des doubles
    croches parfaitement égales (un rouage), la montre bat vite et fin dessous, et le basson
    grommelle une seule note pour finir."""
    clavecin = mel("G4:.25 B4:.25 D5:.25 G5:.25 F#5:.25 D5:.25 A4:.25 F#4:.25 G4:1", 0.0, 74, legato=0.9)
    basson = [_n(2.0, 1.0, "G2", 66)]
    m = _motif("motif-ambroise", 112.0, [
        Piste("clavecin", HARPSICHORD, clavecin, 0.0, pan=60, reverbe=0.18),
        Piste("basson", BASSON, basson, -5.0, pan=56, reverbe=0.2),
    ])
    for k in range(9):
        tic = ins.metal(rng, rng.uniform(4200, 4600) if k % 2 else rng.uniform(3600, 3900), 0.05, t60=0.012,
                        rapports=(1.0, 1.6), amps=(1.0, 0.3))
        dsp.poser(m, tic * _vers(m, tic, -22.0), 0.2 * k, pan=0.35)
    return m


def motif_nour(v: int, rng: np.random.Generator) -> np.ndarray:
    """Nour Belkacem, la vétérinaire énergique et rieuse: le xylophone file vers le haut en
    pentatonique, rit (mi et ré qui sautillent) et retombe sur sol."""
    xylo = mel("D5:.125 E5:.125 G5:.125 A5:.125 B5:.125 D6:.125 E6:.25 D6:.125 E6:.125 D6:.125 E6:.125 G6:.5", 0.0, 80,
               legato=0.9)
    pizz = [_n(0.0, 0.4, "G3", 58), _n(1.0, 0.4, "D4", 52), _n(1.5, 0.6, "G3", 56)]
    return _motif("motif-nour", 132.0, [
        Piste("xylophone", XYLO, xylo, 0.0, pan=62, reverbe=0.2),
        Piste("pizz", PIZZ, pizz, -8.0, pan=70, reverbe=0.15),
    ], queue=1.5)


def _tasse(rng: np.random.Generator) -> np.ndarray:
    """La tasse reposée sur sa soucoupe, au comptoir du café."""
    return ins.metal(rng, 2350, 0.35, t60=0.14, rapports=(1.0, 2.13, 3.6), amps=(1.0, 0.45, 0.2))


def motif_colette(v: int, rng: np.random.Generator) -> np.ndarray:
    """Colette Lafon, la cafetière chaleureuse qui joue l'accordéon de son oncle: une valse
    musette lente au bandonéon (ré, si, sol; la, do, si; sol), oom-pah-pah aux pizzicati, et la
    tasse posée sur le comptoir à la fin. Plus lente et plus tendre que l'accordéon d'Odette."""
    bando = mel("D5:1 B4:.5 G4:.5 A4:1 C5:.5 B4:.5 G4:2", 0.0, 76, legato=0.95)
    valse = ([_n(0.0, 0.5, "G2", 58)] + accord(1.0, 0.4, ["B3", "D4"], 46) + accord(2.0, 0.4, ["B3", "D4"], 44)
             + [_n(3.0, 0.5, "C3", 56)] + accord(4.0, 0.4, ["C4", "E4"], 46) + [_n(6.0, 0.6, "G2", 54)])
    y = _motif("motif-colette", 126.0, [
        Piste("bandoneon", BANDONEON, bando, 0.0, pan=58, reverbe=0.25, souffle=True),
        Piste("pizz", PIZZ, valse, -8.0, pan=70, reverbe=0.15),
    ], signature=(3, 4))
    tasse = _tasse(rng)
    dsp.poser(y, tasse * _vers(y, tasse, -12.0), 6.0 * 60.0 / 126.0 + 0.35, pan=0.3)
    return y


MOTIFS = {
    "armand": ("Armand Castagné, l'instituteur", motif_armand, 4.4),
    "berthe": ("Berthe Lavergne, la meunière", motif_berthe, 4.0),
    "martial": ("Martial Roques, le curé", motif_martial, 3.2),
    "marthe": ("Marthe Bousquet, la sacristine et sonneuse", motif_marthe, 3.6),
    "honorine": ("Honorine Valade, la doyenne", motif_honorine, 3.6),
    "ines": ("Inès Garrigue, la garde forestière", motif_ines, 3.8),
    "barnabe": ("Barnabé Tixier, le bûcheron et charbonnier", motif_barnabe, 4.6),
    "mado": ("Madeleine « Mado » Cazals, la forgeronne", motif_mado, 3.2),
    "paulin": ("Paulin Delmas, le cultivateur", motif_paulin, 3.6),
    "margot": ("Margot Delmas, la cultivatrice", motif_margot, 3.0),
    "leon": ("Léon Delmas, l'écolier", motif_leon, 2.8),
    "ambroise": ("Ambroise Pélissier, l'horloger", motif_ambroise, 2.8),
    "nour": ("Nour Belkacem, la vétérinaire", motif_nour, 2.4),
    "colette": ("Colette Lafon, la cafetière", motif_colette, 4.2),
}


# --- Ambiances ------------------------------------------------------------------------------

def _geai(rng: np.random.Generator) -> np.ndarray:
    """Le cri rauque du geai (« krèèk »): un bruit voisé, rugueux, entre 1,2 et 3,5 kHz."""
    duree = rng.uniform(0.3, 0.42)
    n = dsp.n_ech(duree)
    t = np.arange(n) / SR
    f0 = np.interp(t, [0, duree], [rng.uniform(420, 480), rng.uniform(340, 380)])
    phase = 2 * np.pi * np.cumsum(f0) / SR
    source = sum(np.sin(k * phase) / k ** 0.6 for k in range(1, 20)) * (1 + 0.6 * dsp.pb(rng.standard_normal(n), 300) * 8)
    y = dsp.resonateur(source, 1500, 3) + dsp.resonateur(source, 2800, 4) * 0.6
    return y * dsp.env_ar(n, 0.01, duree * 0.5)


def _pic(rng: np.random.Generator) -> np.ndarray:
    """Le tambourinage du pic sur une branche morte: une rafale de 18 coups en 0,9 s qui
    s'éteint, sur le bois creux (résonance vers 900 Hz)."""
    y = dsp.toile(1.1)
    for k in range(18):
        coup = ins.bois(rng, rng.uniform(850, 950), 0.06, 1.0, rapports=(1.0, 2.1, 3.3), t60=0.03, amps=(0.8, 0.4, 0.2))
        dsp.poser(y, coup * (1.0 - 0.04 * k), k * 0.05 * (1 - 0.006 * k))
    return y


def _foret(v: int, rng: np.random.Generator) -> np.ndarray:
    """La forêt profonde (boucle de 40 s, sous les houppiers du bois de la Côte): le vent haut
    dans les cimes, plus sourd qu'à la lisière, des feuilles qui frémissent par moments, le
    tambourinage d'un pic au loin (deux fois), le geai qui crie (deux fois), le pigeon ramier, une
    phrase de merle lointaine, un tronc qui grince, une brindille qui tombe."""
    duree = 40.0
    n = dsp.n_ech(duree)
    cimes = dsp.filtre_circulaire(dsp.bruit_spectral(n, rng, -4.5), dsp.gain_bande(120, 2500)) * 0.05
    cimes *= 0.7 + 0.3 * ambiances.lfo_periodique(n, [(2, 1.0), (5, 0.5), (11, 0.25)], rng)
    frem = dsp.filtre_circulaire(dsp.bruit_spectral(n, rng, -1.0), dsp.gain_bande(1500, 7000))
    frem *= np.clip(0.62 + 0.38 * ambiances.lfo_periodique(n, [(3, 1.0), (7, 0.6)], rng), 0.0, None) ** 3 * 0.012
    y = cimes + frem
    for t0, g in ((6.2, 0.22), (27.5, 0.16)):
        dsp.poser(y, dsp.pb(_pic(rng), 3500) * g, t0, circulaire=True)
    for t0, g in ((13.1, 0.06), (33.6, 0.045)):
        dsp.poser(y, _geai(rng) * g, t0, circulaire=True)
        dsp.poser(y, _geai(rng) * g * 0.7, t0 + 0.55, circulaire=True)
    dsp.poser(y, ambiances._oiseau(rng, 5) * 0.07, 19.0, circulaire=True)
    dsp.poser(y, dsp.pb(ambiances._oiseau(rng, 2), 3000) * 0.06, 2.4, circulaire=True)
    dsp.poser(y, dsp.pb(ambiances._oiseau(rng, 2), 3000) * 0.05, 23.2, circulaire=True)
    g = ins.crissement(rng, 1.2, lambda u: 40 + 40 * np.sin(np.pi * u), [(310, 6), (720, 8)], 0.3)
    dsp.poser(y, g * dsp.env_ar(len(g), 0.3, 0.5) * 0.06, 9.4, circulaire=True)
    for t0 in (16.8, 36.2):
        brind = dsp.somme(ins.bois(rng, 1800, 0.05, 1.0, t60=0.012) * 0.3,
                          ins.froissement(rng, 0.35, 1200, 6000, 60, 0.02, 0.2) * 0.4)
        dsp.poser(y, brind * 0.15, t0, circulaire=True)
    y = _boucle_reverbe(y, 1.4, 0.18, 111, predelai=0.025, aigus=0.35)
    return dsp.filtre_circulaire(y, dsp.gain_bande(0, 8500))


def _meuh(rng: np.random.Generator, duree: float) -> np.ndarray:
    """Une vache au loin, dans la pâture: un meuglement grave qui monte puis retombe."""
    n = dsp.n_ech(duree)
    t = np.arange(n) / SR
    f0 = np.interp(t, [0, 0.3 * duree, duree], [105, 150, 118]) * (1 + 0.008 * np.sin(2 * np.pi * 4 * t))
    phase = 2 * np.pi * np.cumsum(f0) / SR
    source = sum(np.sin(k * phase) / k ** 1.0 for k in range(1, 40) if 150 * k < 6000)
    formant = lambda s: float(np.interp(s, [0, 0.4 * duree, duree], [500, 800, 450]))  # noqa: E731
    y = dsp.pb_variable(source, formant, type_="band", q_bande=2.0) + dsp.resonateur(source, 1300, 4) * 0.25
    return dsp.pb(y * dsp.env_ar(n, 0.2, duree * 0.5), 2500)


def _ferme(v: int, rng: np.random.Generator) -> np.ndarray:
    """La ferme des Delmas (boucle de 40 s, placée dans la cour): les poules qui caquettent
    par petites séries, une vache qui meugle dans la pâture (deux fois), la clochette d'une
    vache qui broute, la chaîne d'une bête qui bouge dans l'étable, un seau posé, la porte de la
    grange qui bat une fois, des moineaux sur le fumier."""
    duree = 40.0
    n = dsp.n_ech(duree)
    air = dsp.filtre_circulaire(dsp.bruit_spectral(n, rng, -4.0), dsp.gain_bande(100, 3000)) * 0.012
    y = air
    t = 0.7
    while t < duree - 1.0:
        serie = rng.integers(2, 5)
        f0 = rng.uniform(380, 470)
        for k in range(serie):
            dsp.poser(y, ins.poule(rng, f0 * rng.uniform(0.95, 1.08), rng.uniform(0.07, 0.11), "o") * 0.12,
                      t + 0.14 * k, circulaire=True)
        t += rng.uniform(2.5, 5.5)
    for t0, d in ((8.5, 1.7), (29.0, 1.4)):
        dsp.poser(y, _meuh(rng, d) * 0.06, t0, circulaire=True)
    for t0 in (3.2, 3.9, 15.1, 21.7, 22.2, 34.4):
        clo = ins.metal(rng, rng.uniform(700, 760), 0.6, t60=0.35, rapports=(1.0, 1.47, 2.1, 2.9), amps=(1.0, 0.6, 0.4, 0.2))
        dsp.poser(y, dsp.pb(clo, 3000) * 0.05, t0, circulaire=True)
    for t0 in (12.0, 31.4):
        for k in range(6):
            maille = ins.metal(rng, rng.uniform(2200, 3000), 0.1, t60=0.04, rapports=(1.0, 1.7), amps=(1.0, 0.4))
            dsp.poser(y, maille * 0.04, t0 + 0.06 * k + rng.uniform(0, 0.02), circulaire=True)
    dsp.poser(y, ins.metal(rng, 520, 0.6, t60=0.25, rapports=(1.0, 2.2, 3.4), amps=(1.0, 0.4, 0.2)) * 0.06, 25.3,
              circulaire=True)
    porte = dsp.somme(ins.bois(rng, 180, 0.3, 0.8, rapports=(1.0, 2.1, 3.5), t60=0.12) * 0.6,
                      ins.bruit_bref(rng, 0.1, 100, 900, 0.03) * 0.3)
    dsp.poser(y, porte * 0.1, 18.4, circulaire=True)
    for t0 in (5.8, 26.6, 37.1):
        dsp.poser(y, dsp.pb(ambiances._oiseau(rng, 1), 6000) * 0.08, t0, circulaire=True)
    y = _boucle_reverbe(y, 0.9, 0.15, 113, predelai=0.02)
    return dsp.filtre_circulaire(y, dsp.gain_bande(0, 8000))


def _nef(v: int, rng: np.random.Generator) -> np.ndarray:
    """La nef de Saint-Aubin, de dedans (boucle de 30 s): l'air immobile d'une grande pièce de
    pierre (réverbération de 3 s), l'horloge du clocher qui bat lourdement toutes les 2 s au
    fond, un banc de bois qui craque, les pigeons qui roucoulent dans le clocher, assourdis, le
    vitrail qui laisse passer un oiseau du dehors. Ni pas ni voix: personne n'est dessiné."""
    duree = 30.0
    n = dsp.n_ech(duree)
    air = dsp.filtre_circulaire(dsp.bruit_spectral(n, rng, -5.0), dsp.gain_bande(100, 2000)) * 0.05
    # Un souffle aigu très faible (l'air de la nef sous la voûte): sans lui, le fond trop lisse fait
    # ressortir le bruit de codage au raccord de la boucle.
    air += dsp.filtre_circulaire(dsp.bruit_spectral(n, rng, 0.0), dsp.gain_bande(2500, 9000)) * 0.004
    y = np.zeros(n)
    for k in range(15):
        tic = ins.bois(rng, (620, 560)[k % 2], 0.15, 0.6, rapports=(1.0, 2.4, 3.9), t60=0.05, amps=(0.6, 0.35, 0.15))
        tic = dsp.somme(tic, ins.metal(rng, 1300, 0.1, t60=0.03, rapports=(1.0, 2.1), amps=(0.3, 0.1)))
        dsp.poser(y, dsp.pb(tic, 2500) * 0.07, 1.0 + 2.0 * k, circulaire=True)
    for t0 in (7.3, 21.9):
        g = ins.crissement(rng, 0.45, lambda u: 70 + 120 * u, [(rng.uniform(380, 460), 8), (rng.uniform(900, 1050), 10)], 0.15)
        dsp.poser(y, g * dsp.env_ar(len(g), 0.08, 0.15) * 0.09, t0, circulaire=True)
    for t0 in (4.6, 17.2, 26.0):
        dsp.poser(y, dsp.pb(ambiances._oiseau(rng, 5), 900) * 0.05, t0, circulaire=True)
    dsp.poser(y, dsp.pb(ambiances._oiseau(rng, 3), 2500) * 0.05, 12.8, circulaire=True)
    y = air + _boucle_reverbe(y, 3.0, 0.7, 115, predelai=0.04, aigus=0.3)
    return dsp.filtre_circulaire(y, dsp.gain_bande(0, 9500))


def _cafe(v: int, rng: np.random.Generator) -> np.ndarray:
    """La salle du café de la Côte, de dedans (boucle de 30 s): le poêle qui ronfle doucement,
    des tasses reposées sur leurs soucoupes, une cuillère qui tourne dans un café, un verre posé
    sur le zinc, une chaise qu'on recule, des cartes qu'on bat et qu'on abat (la manille), la
    monnaie sur le comptoir. Aucune voix: les joueurs de cartes sont des habitants dessinés, ils
    parlent en bulles."""
    duree = 30.0
    n = dsp.n_ech(duree)
    poele = dsp.filtre_circulaire(dsp.bruit_spectral(n, rng, -6.0), dsp.gain_bande(70, 900)) * 0.006
    y = np.zeros(n)
    y += dsp.grains(duree, 3, lambda r: dsp.clic(r, 1200, 5000, 0.004, 0.001) * r.uniform(0.02, 0.06), rng, circulaire=True)
    for t0 in (1.4, 9.7, 16.3, 24.8):
        dsp.poser(y, _tasse(rng) * 0.03, t0, circulaire=True)
    t = 5.0
    for k in range(9):
        cuil = ins.metal(rng, rng.uniform(3600, 4200), 0.12, t60=0.05, rapports=(1.0, 1.9), amps=(1.0, 0.3))
        dsp.poser(y, cuil * 0.03, t, circulaire=True)
        t += rng.uniform(0.13, 0.18)
    verre = ins.metal(rng, 1900, 0.4, t60=0.2, rapports=(1.0, 2.32, 4.25), amps=(1.0, 0.3, 0.1))
    dsp.poser(y, dsp.somme(verre * 0.03, ins.bois(rng, 500, 0.1, 0.6, t60=0.03) * 0.03), 12.4, circulaire=True)
    chaise = ins.crissement(rng, 0.4, lambda u: 120 + 200 * u, [(rng.uniform(600, 700), 6), (1500, 8)], 0.3)
    dsp.poser(y, chaise * dsp.env_ar(len(chaise), 0.05, 0.1) * 0.05, 19.6, circulaire=True)
    # La manille: un battage rapide de cartes, puis trois cartes abattues sur la table.
    dsp.poser(y, ins.froissement(rng, 0.7, 1500, 8000, 150, 0.03, 0.2) * 0.022, 21.4, circulaire=True)
    for k in range(3):
        carte = dsp.somme(ins.bruit_bref(rng, 0.04, 800, 6000, 0.008) * 0.6, ins.bois(rng, 700, 0.06, 0.8, t60=0.02) * 0.3)
        dsp.poser(y, carte * 0.05, 23.0 + 0.9 * k, circulaire=True)
    for k in range(3):
        piece = ins.metal(rng, rng.uniform(4000, 4800), 0.25, t60=0.12, rapports=(1.0, 1.42, 2.3), amps=(1.0, 0.5, 0.3))
        dsp.poser(y, piece * 0.014, 28.0 + 0.11 * k, circulaire=True)
    y = poele + _boucle_reverbe(y, 0.6, 0.25, 117)
    return dsp.filtre_circulaire(y, dsp.gain_bande(0, 9000))


# --- Déclarations ---------------------------------------------------------------------------

def sons() -> list[Son]:
    eglise = "l'écouteur est à moins de 45 m de l'église (x 85 à 105, y -17 à -6) ou dedans"
    angelus = ("à 6 h 55, 11 h 55 et 18 h 55 de jeu (cinq minutes avant chaque angélus), et dès que la corde des "
               "cloches est à moins de 10 m d'un joueur")
    forge = "l'écouteur est à moins de 45 m de la forge (x 98 à 106, y 15 à 20)"
    moulin = "le moulin tourne (après « La vanne coincée ») et l'écouteur est à moins de 45 m du moulin (x -17 à -11)"
    motif = "joué à l'ouverture d'une conversation, chez celui qui parle à l'habitant; musique atténuée"
    liste = [
        # L'église
        Son("angelus-toll", "Angélus: un coup du bourdon (sol 4); trois fois trois, puis la volée", E, "effects",
            _tintement, 2, -18.0, 1, 0.0, 0.5, "vallee", voix_max=5, queue_reverbe=(2.0, 0.2), duree_max=7.4,
            extra={"decodeWhen": angelus},
            note="placé au clocher (x 87, y -12); séquence plan.sequences.angelus à 7 h, 12 h et 19 h; un coup par "
                 "traction de corde dans « L'angélus à deux »; accordé, aucune variation de hauteur"),
        Son("bell-peal", "La volée des trois cloches de Saint-Aubin (10 s, puis la résonance)", E, "effects", _volee, 1,
            -16.0, 1, 0.0, 0.0, "vallee", voix_max=1, queue_reverbe=(2.0, 0.2), duree_max=15.0,
            extra={"decodeWhen": angelus},
            note="placé au clocher; entendu partout (jamais sous -14 dB); fin de l'angélus et geste bell_rope_pull "
                 "(une fois par jour, jamais à moins de 30 minutes d'un angélus); musique -4 dB", duck_db=-4.0),
        Son("harmonium-note", "Toucher l'harmonium de la nef: une note (pentatonique de sol)", E, "effects",
            _harmonium_note, 5, -22.0, 3, 0.0, 0.5, "moyen", intervalle_min_ms=1000, voix_max=2, duree_max=3.6,
            extra={"decodeWhen": eglise},
            note="à l'harmonium; une note par seconde au plus (règle du geste 11); accordé, aucune variation de "
                 "hauteur; hors messe et chorale"),
        Son("harmonium-chord", "Les deux touchent l'harmonium ensemble: un accord doux (sol, mi mineur, do, ré)", E,
            "effects", _harmonium_accord, 4, -21.0, 2, 0.0, 0.5, "moyen", intervalle_min_ms=1000, voix_max=1,
            duree_max=4.2, extra={"decodeWhen": eglise},
            note="à la place de harmonium-note quand les deux agissent à moins de 3 s; accordé"),
        # La forge
        Son("anvil-strike", "Un coup sur l'enclume de Mado (sur le fer, à vide, ou avec le rebond)", MET, "effects",
            _enclume, 3, -21.0, 3, 0.04, 1.0, "moyen", intervalle_min_ms=150, voix_max=3,
            extra={"decodeWhen": forge},
            note="gestes des quêtes de Mado (cercler la roue, la grille du père Joseph), coup par coup; la forge au "
                 "travail est la boucle forge-loop"),
        Son("forge-loop", "La forge au travail: feu, soufflet, deux volées de coups d'enclume (boucle)", MET, "effects",
            _forge, 1, -30.0, 4, 0.02, 0.0, "moyen", boucle=True, passe_haut=70, voix_max=1,
            extra={"decodeWhen": forge},
            note="placée à l'enclume de la cour (x 105, y 17) quand Mado y travaille (plan.placedLoops); fondu de 1 s"),
        # Le moulin
        Son("mill-wheel", "La roue à aubes du moulin sur le bief (boucle)", MET, "effects", _roue, 1, -27.0, 4, 0.0,
            0.0, "moyen", boucle=True, passe_haut=80, voix_max=1, extra={"decodeWhen": moulin},
            note="placée à la roue (x -14, y 34,5) dès que le moulin tourne; c'est « la berceuse de Berthe » du "
                 "geste millwheel_watch"),
        Son("millstone", "La salle des meules en marche: meule, rouet, auget, farine (boucle)", MET, "effects", _meules,
            1, -29.0, 4, 0.0, 0.0, "moyen", boucle=True, passe_haut=50, voix_max=1, extra={"decodeWhen": moulin},
            note="placée aux meules (x -15, y 31) quand le moulin moud (Berthe à l'ensachage, 6 h 30 à 12 h); dedans "
                 "et de la cour"),
        Son("sluice-open", "La vanne du bief se lève: cliquet, bois, l'eau se rue, la roue démarre (7 s)", MET,
            "effects", _vanne, 1, -19.0, 2, 0.0, 0.0, "moyen", voix_max=1, duree_max=7.0,
            extra={"decodeWhen": "la quête « La vanne coincée » est en cours"},
            note="à la vanne (x -12, y 34), fin du geste à deux de la quête; mill-wheel prend le relais en fondu "
                 "de 1,5 s"),
        # Le lavoir
        Son("washboard-beat", "Le battoir sur le linge mouillé, au lavoir", MET, "effects", _battoir, 3, -23.0, 3, 0.05,
            1.0, "moyen", intervalle_min_ms=350, voix_max=2,
            extra={"decodeWhen": "l'écouteur est à moins de 45 m du lavoir (x 99 à 103, y 35 à 37)"},
            note="au lavoir; un coup toutes les 0,6 à 0,8 s tant qu'Agir est maintenu (washhouse_scrub); aussi "
                 "Margot et Colette le lundi de 9 h à 11 h, un coup toutes les 1,5 à 3 s"),
        # Décor, puits, belvédère, forêt
        Son("plic", "Un rebond du galet sur l'eau (ricochet)", DEC, "effects", _plic, 3, -26.0, 3, 0.06, 1.0, "moyen",
            intervalle_min_ms=60, voix_max=4,
            extra={"decodeWhen": "l'écouteur est à moins de 20 m de la berge, de la langue de sable ou du ponton"},
            note="un par rebond (0 à 7), au point du rebond; chaque rebond 1,5 dB plus bas et 12 % plus tôt que le "
                 "précédent (au moteur, par gainDb et l'instant)"),
        Son("well-drop", "Penché au puits: une goutte tombe au fond et résonne", DEC, "effects", _goutte_puits, 2, -24.0,
            3, 0.04, 1.0, "pres", voix_max=1, intervalle_min_ms=10000,
            extra={"decodeWhen": "l'écouteur est à moins de 20 m du puits de la place"},
            note="au puits, geste well_peek; la seconde variante fait deux gouttes"),
        Son("well-echo", "Maintenir au puits: le hululement dans les mains descend et revient (« hou… ou… »)", DEC,
            "effects", _echo_puits, 1, -22.0, 3, 0.03, 0.5, "pres", voix_max=1, intervalle_min_ms=10000,
            extra={"decodeWhen": "l'écouteur est à moins de 20 m du puits de la place"},
            note="au puits; aucune voix: un son soufflé dans les mains jointes, comme un appeau"),
        Son("lookout-echo", "Crier au belvédère: le hululement dans les mains et le double écho de la vallée", DEC,
            "effects", _echo_belvedere, 2, -20.0, 3, 0.03, 0.5, "moyen", voix_max=1, intervalle_min_ms=60000,
            extra={"decodeWhen": "l'écouteur est à moins de 30 m du belvédère (6,5 ; -24,5)"},
            note="au belvédère, chez celui qui crie (et placé chez l'autre s'il est à moins de 45 m); une fois par "
                 "minute"),
        Son("lookout-echo-far", "Le cri du belvédère entendu du bourg: un écho lointain, plus faible", DEC, "effects",
            _echo_lointain, 1, -30.0, 4, 0.03, 0.5, None, voix_max=1, intervalle_min_ms=60000, passe_haut=150,
            extra={"decodeWhen": "en même temps que lookout-echo, chez l'autre joueur quand il est à plus de 45 m"},
            note="non placé, chez l'autre seulement s'il est loin du belvédère"),
        Son("step-leaves", "Pas dans les feuilles mortes (forêt, lisière en automne)", DEC, "effects", _pas_feuilles, 4,
            -28.5, 3, 0.06, 1.5, "pres", intervalle_min_ms=120, voix_max=4, passe_haut=70,
            extra={"decodeWhen": "l'écouteur est dans la forêt (y < 2) ou à la lisière en automne"},
            note="à la place de step-path sur le sol « feuilles » de la carte (pas: feuilles, lot L1)"),
        # Le chat
        Son("cat-purr", "Caresser le chat: il ronronne", DEC, "effects", _ronron, 2, -27.0, 3, 0.04, 1.0, "pres",
            voix_max=1, intervalle_min_ms=10000, extra={"decodeWhen": "le chat est à moins de 20 m de l'écouteur"},
            note="au chat, geste cat_pet; 10 s au moins entre deux (règle 7.0)"),
        Son("cat-meow", "Le chat miaule doucement (il salue ou suit un joueur)", DEC, "effects", _miaou, 2, -25.0, 3,
            0.05, 1.0, "faune-12", voix_max=1, intervalle_min_ms=20000,
            extra={"decodeWhen": "le chat est à moins de 20 m de l'écouteur"},
            note="au chat: variante 1 « mrrp » quand il commence à suivre un joueur, variante 2 quand il dépose sa "
                 "trouvaille devant la maisonnette; jamais plus d'une fois par 20 s"),
        # Le carnet et l'amitié
        Son("pencil-note", "Carnet: une habitude s'écrit au crayon (doux)", CAR, "ui", _crayon, 2, -27.0, 3, 0.03, 1.0,
            None, canaux=2, voix_max=1, intervalle_min_ms=1500,
            extra={"decodeWhen": "au lancement de la partie (les découvertes tombent partout)"},
            note="chez les deux, avec la notification « Carnet: … »; aussi quand une habitude se barre et que la "
                 "nouvelle s'écrit"),
        Son("bond-chime", "Amitié: la lanterne frémit (petit son de verre)", CAR, "ui", _lanterne, 2, -24.0, 3, 0.0, 0.5,
            None, canaux=2, voix_max=1, intervalle_min_ms=2000,
            extra={"decodeWhen": "au lancement de la partie (on parle à tout le monde)"},
            note="au premier gain du jour avec un habitant, chez qui parle; ré 6 ou sol 6, sans variation de hauteur"),
        Son("bond-level", "Amitié: un niveau passé, une lanterne s'allume (petite volée de clochettes)", CAR, "ui",
            _niveau, 1, -19.0, 2, 0.0, 0.0, None, canaux=2, duck_db=-6.0, voix_max=1, duree_max=3.2,
            extra={"decodeWhen": "au lancement de la partie"},
            note="chez les deux, avec la notification « Avec … : … »; sol majeur, sans variation"),
        Son("birthday-chime", "Souhaiter un anniversaire (boîte à musique, harpe, petit bouquet)", CAR, "ui",
            _anniversaire, 1, -19.0, 2, 0.0, 0.0, None, canaux=2, duck_db=-6.0, voix_max=1, duree_max=3.8,
            extra={"decodeWhen": "le jour d'un anniversaire (birthday_of), dès l'aube"},
            note="chez celui qui souhaite (choix « Bon anniversaire »), et chez l'autre s'il est à moins de 8 m; sol "
                 "majeur"),
        Son("decision-agree", "Décision à deux: les deux choix se rejoignent (« Décidé ensemble »)", CAR, "ui",
            _decision, 1, -19.0, 2, 0.0, 0.0, None, canaux=2, duck_db=-6.0, voix_max=1, duree_max=2.8,
            extra={"decodeWhen": "à l'ouverture du panneau de décision à deux"},
            note="chez les deux, 0,2 s après le tampon existant (order-stamp); aucun son pour un désaccord"),
        # Ambiances
        Son("forest-deep", "La forêt profonde: cimes, feuilles, pic, geai, ramier, tronc qui grince (boucle)", A,
            "ambience", _foret, 1, -30.0, 4, 0.0, 0.0, None, boucle=True, passe_haut=90,
            extra={"decodeWhen": "l'écouteur est à moins de 10 m de la forêt (y < 2, hors lisière du bourg)"},
            note="non placé, réglé par la position (plan.ambienceByRegion): plein dans le bois, éteint en 8 m à "
                 "la lisière; le vent du bourg baisse de 4 dB dedans"),
        Son("farm", "La ferme des Delmas: poules, vache, clochette, chaîne, seau, grange (boucle)", A, "ambience",
            _ferme, 1, -31.0, 4, 0.0, 0.0, "loin", boucle=True, passe_haut=90,
            extra={"decodeWhen": "l'écouteur est à moins de 45 m de la cour de la ferme (x 112, y 33)"},
            note="placée dans la cour (plan.ambienceByRegion), de 6 h à 21 h; la nuit, rien"),
        Son("church-inside", "Dans la nef de Saint-Aubin: la pierre, l'horloge du clocher, un banc, les pigeons (boucle)",
            A, "ambience", _nef, 1, -37.0, 4, 0.0, 0.0, None, boucle=True, passe_haut=90,
            extra={"decodeWhen": "l'écouteur est à moins de 6 m du portail de l'église"},
            note="non placé, quand l'écouteur est dans l'église (plan.interiorByBuilding); fondu de 0,6 s"),
        Son("room-tone-cafe", "Dans la salle du café: poêle, tasses, cuillère, zinc, chaise, cartes (boucle)", A,
            "ambience", _cafe, 1, -35.0, 4, 0.0, 0.0, None, boucle=True, passe_haut=60,
            extra={"decodeWhen": "l'écouteur est à moins de 6 m de la porte du café"},
            note="non placé, quand l'écouteur est dans le café (plan.interiorByBuilding); fondu de 0,6 s"),
    ]
    for id_, (qui, fabrique, duree) in MOTIFS.items():
        liste.append(Son(f"talk-{id_}", f"Motif de {qui}", VOI, "ui", fabrique, 1, -19.0, 2, 0.0, 0.0, None, canaux=2,
                         duree_max=duree, duck_db=-8.0, intervalle_min_ms=4000,
                         extra={"decodeWhen": f"l'habitant ({id_}) est à moins de 20 m de l'écouteur"}, note=motif))
    return liste


# Pour le dev audio (lots H8 et L4 bis): l'angélus, les boucles placées des métiers, les ambiances
# par région et les intérieurs neufs. Clés à part du plan (ignorées par le schéma tant qu'il ne
# les lit pas), sauf la séquence et les intérieurs, déjà lus par le moteur.
SEQUENCE_ANGELUS = {
    "description": "Angélus (7 h, 12 h, 19 h): trois fois trois coups du bourdon, puis la volée. Coups espacés de "
                   "1,6 s, 3,2 s entre deux séries; la volée part 3,5 s après le dernier coup.",
    "steps": ([{"at": round(serie * 6.4 + coup * 1.6, 2), "play": "angelus-toll"} for serie in range(3) for coup in range(3)]
              + [{"at": 19.5, "play": "bell-peal"}]),
}

ANGELUS = {
    "description": "Marthe sonne l'angélus trois fois par jour (son planning: corde des cloches); le son ne dépend pas "
                   "de sa présence (on l'entend aussi pendant une scène). Après « L'angélus à deux », la quête rejoue "
                   "les coups un par un (angelus-toll à chaque traction), puis bell-peal.",
    "hours": [7, 12, 19],
    "sequence": "angelus",
    "at": {"x": 87.0, "y": -12.0},
    "pauseVillagersSeconds": 3,
}

BOUCLES_PLACEES = [
    {"sound": "forge-loop", "at": {"x": 105.0, "y": 17.0}, "when": "Mado à son habitude de forge dans la cour "
     "(activité work au point forge_yard), hors dimanche", "fadeMs": 1000},
    {"sound": "mill-wheel", "at": {"x": -14.0, "y": 34.5}, "when": "le moulin tourne (drapeau mill_running, après « La "
     "vanne coincée »), jour et nuit", "fadeMs": 1500},
    {"sound": "millstone", "at": {"x": -15.0, "y": 31.0}, "when": "le moulin moud: Berthe à l'ensachage (6 h 30 à "
     "12 h) une fois le moulin remis en marche", "fadeMs": 1500},
]

AMBIANCES_REGION = [
    {"ambience": "forest-deep", "region": "forêt (y < 2, hors lisière du bourg)", "fadeInMeters": 8, "volumeDb": 0.0,
     "alsoLowerDb": {"wind": -4.0, "village": -6.0, "birds-morning": -3.0},
     "description": "sous les houppiers: plein à 8 m dans le bois, éteint à la lisière"},
    {"ambience": "farm", "at": {"x": 112.0, "y": 33.0}, "hours": [6, 21], "volumeDb": 0.0,
     "description": "placée dans la cour de la ferme, préréglage loin"},
]

INTERIEURS_NEUFS = {
    "church": {"roomTone": "church-inside", "roomToneDb": 0.0, "outdoorLowpassHz": 700, "outdoorDb": -13.0,
               "rain": "rain-roof", "note": "la nef: murs de pierre épais, le dehors presque effacé; les cloches "
                                            "restent entendues (elles sont au-dessus)"},
    "cafe": {"roomTone": "room-tone-cafe", "roomToneDb": 0.0, "outdoorLowpassHz": 1100, "outdoorDb": -9.0,
             "rain": "rain-roof", "note": "la salle du café: porte vitrée sur la placette, comme l'épicerie"},
    "forge": {"roomTone": None, "outdoorLowpassHz": 1400, "outdoorDb": -6.0, "rain": "rain-roof",
              "note": "l'atelier: la grande porte est ouverte, le feu et l'enclume sont dans la cour (forge-loop)"},
    "mill": {"roomTone": None, "outdoorLowpassHz": 900, "outdoorDb": -10.0, "rain": "rain-roof",
             "note": "la salle des meules: millstone y est placée, la roue s'entend à travers le mur sud"},
}
