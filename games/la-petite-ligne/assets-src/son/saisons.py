"""Sons des saisons, de la brume du matin et de la cueillette (tour 8,
`docs/jeux/jeu-1/tour-08-conception.md`, sections 2, 3, 5 et 9).

- `season-turn-<saison>`: le motif de 3 s qui souligne la carte de saison au petit-déjeuner du
  premier jour d'une saison. Une couleur par saison (instruments, registre, sens du motif), toutes
  en fa pentatonique (fa, sol, la, do, ré): juste sur la musique du petit-déjeuner (fa majeur), et
  aucune paire de notes ne peut former une seconde mineure, une septième majeure ou un triton.
  Rendu par FluidSynth comme `mist-lift`; dossier `saisons/`, décodé à la demande.
- `mist-morning`: l'ambiance des matins de brume (drapeau `world.morningMist`), large et non placée,
  à ne pas confondre avec `mist-ambience` (l'eau toute proche du moment de la brume, placée).
- `crickets-summer`, `swifts` (été), `wind-leaves`, `crows` (automne): ambiances de saison.
- `pick-herb`, `pick-mushroom`, `pick-berries`, `pick-nuts`: un son par sorte de cueillette.
- `axe-thud-soft`: la hache refusée sur une souche ou un rejet (coup mat, sans écho).

Les bêtes suivent la description naturaliste de l'espèce sans imiter d'enregistrement; tout est
filtré au-dessus de 6 à 7 kHz, pour la centième écoute.
"""

from __future__ import annotations

from pathlib import Path

import numpy as np

import ambiances
import dsp
import instruments as ins
import moments
from catalogue import Son
from dsp import SR
from partition import Morceau, Note, Piste, produire

ICI = Path(__file__).resolve().parent

# Programmes General MIDI (numérotés à partir de 0).
CELESTA, GLOCK = 8, 9
GUITARE_NYLON = 24
VIOLONCELLE, PIZZ, HARPE = 42, 45, 46
CORDES_LENTES = 49
COR = 60
HAUTBOIS, CLARINETTE = 68, 71
FLUTE = 73

# Fa pentatonique: aucune paire de ces classes de hauteur ne forme un intervalle dur.
FA_PENTATONIQUE = {5, 7, 9, 0, 2}


# --- Le tournant de saison -------------------------------------------------------------------

def _n(t: float, d: float, nom: str, v: int) -> Note:
    return Note(t, d, dsp.note_midi(nom), v)


def _roule(t0: float, noms: list[str], fin: float, v: int, pas: float = 0.07) -> list[Note]:
    """Accord roulé (harpe, guitare): chaque note un peu après la précédente, toutes tenues jusqu'à fin."""
    return [_n(t0 + pas * k, fin - t0 - pas * k, nom, v - 2 * k) for k, nom in enumerate(noms)]


def _partition_saison(saison: str) -> Morceau:
    """Trois temps à 60 (3 s), puis la résonance. Unité: le temps (une seconde)."""
    if saison == "spring":
        # Le potager se réveille: la flûte monte, la harpe roule un accord clair et ouvert.
        pistes = [
            Piste("harpe", HARPE, _roule(0.0, ["F3", "C4", "F4", "G4", "A4", "C5"], 3.0, 62), 0.0, pan=56,
                  reverbe=0.35),
            Piste("flute", FLUTE, [_n(0.35, 0.35, "C5", 74), _n(0.7, 0.35, "D5", 76), _n(1.05, 0.35, "F5", 78),
                                   _n(1.4, 0.35, "G5", 80), _n(1.75, 1.25, "A5", 82)], -1.5, pan=72,
                  reverbe=0.32, souffle=True),
        ]
        return Morceau(id="season-turn-spring", titre="season-turn-spring", tempo=60.0, signature=(3, 4),
                       mesures=1, temps_par_mesure=3.0, pistes=pistes, boucle=False, queue_s=2.0, rt60=1.5,
                       sonie_cible=-20.0, graine=81)
    if saison == "summer":
        # Les jours rallongent: la guitare s'étale sur un accord de sixte, le hautbois balance et
        # s'attarde sur le la; une pointe de glockenspiel pour la lumière, des pizzicati en bas.
        pistes = [
            Piste("guitare", GUITARE_NYLON, _roule(0.0, ["F2", "C3", "A3", "D4", "G4"], 3.0, 70, 0.11), -3.0,
                  pan=54, reverbe=0.22),
            Piste("hautbois", HAUTBOIS, [_n(0.45, 0.45, "A4", 76), _n(0.9, 0.45, "C5", 78), _n(1.35, 0.6, "D5", 82),
                                         _n(1.95, 0.3, "C5", 74), _n(2.25, 0.75, "A4", 76)], 0.0, pan=70,
                  reverbe=0.30, souffle=True),
            Piste("pizz", PIZZ, [_n(0.0, 0.6, "F2", 72), _n(1.5, 0.6, "C3", 66)], -8.0, pan=64, reverbe=0.18),
            Piste("glock", GLOCK, [_n(2.25, 0.75, "A6", 46), _n(2.6, 0.4, "D6", 40)], -14.0, pan=80, reverbe=0.4),
        ]
        return Morceau(id="season-turn-summer", titre="season-turn-summer", tempo=60.0, signature=(3, 4),
                       mesures=1, temps_par_mesure=3.0, pistes=pistes, boucle=False, queue_s=2.0, rt60=1.4,
                       sonie_cible=-20.0, graine=82)
    if saison == "autumn":
        # Le soir tombe plus tôt: la clarinette descend, le violoncelle pose ré puis fa (ré m7 vers
        # fa majeur), le cor tient le la, tout bas, comme une lumière qui baisse.
        pistes = [
            Piste("clarinette", CLARINETTE, [_n(0.2, 0.45, "A4", 76), _n(0.65, 0.45, "G4", 74),
                                             _n(1.1, 0.45, "F4", 74), _n(1.55, 0.45, "D4", 72),
                                             _n(2.0, 1.0, "F4", 76)], 0.0, pan=58, reverbe=0.30, souffle=True),
            Piste("violoncelle", VIOLONCELLE, [_n(0.0, 1.5, "D3", 66), _n(1.5, 1.5, "F2", 64)], -4.0, pan=50,
                  reverbe=0.32, souffle=True),
            Piste("cor", COR, [_n(0.1, 2.9, "A3", 48)], -10.0, pan=74, reverbe=0.4, souffle=True),
        ]
        return Morceau(id="season-turn-autumn", titre="season-turn-autumn", tempo=60.0, signature=(3, 4),
                       mesures=1, temps_par_mesure=3.0, pistes=pistes, boucle=False, queue_s=2.2, rt60=1.7,
                       sonie_cible=-20.0, graine=83)
    # Hiver: quelques notes de célesta, espacées, au-dessus d'une nappe de cordes lentes (fa, do,
    # sol) et d'une note grave de harpe: le potager se repose, la nuit tombe tôt.
    pistes = [
        Piste("celesta", CELESTA, [_n(0.2, 1.0, "C6", 70), _n(0.75, 1.0, "G5", 64), _n(1.3, 1.0, "D6", 68),
                                   _n(1.85, 1.15, "A5", 66)], 0.0, pan=70, reverbe=0.45),
        Piste("cordes", CORDES_LENTES, [_n(0.0, 3.0, "F3", 46), _n(0.0, 3.0, "C4", 44), _n(0.0, 3.0, "G4", 42)],
              -7.0, pan=58, reverbe=0.45, souffle=True),
        Piste("harpe", HARPE, [_n(0.0, 3.0, "F2", 60)], -9.0, pan=50, reverbe=0.4),
    ]
    return Morceau(id="season-turn-winter", titre="season-turn-winter", tempo=60.0, signature=(3, 4), mesures=1,
                   temps_par_mesure=3.0, pistes=pistes, boucle=False, queue_s=2.4, rt60=2.0, sonie_cible=-20.0,
                   graine=84)


def controler_intervalles(m: Morceau, chevauchement: float = 0.15) -> list[str]:
    """Toute paire de notes qui sonnent ensemble (même dans une piste: accords roulés tenus) ne doit
    former ni seconde mineure, ni septième majeure, ni triton; et toutes les notes restent en fa
    pentatonique. Plus strict que partition.frottements, qui ne regarde que la grille."""
    notes = [n for p in m.pistes for n in p.notes]
    erreurs = [f"{n.p} hors de fa pentatonique" for n in notes if n.p % 12 not in FA_PENTATONIQUE]
    for i, a in enumerate(notes):
        for b in notes[i + 1:]:
            if min(a.t + a.d, b.t + b.d) - max(a.t, b.t) >= chevauchement and abs(a.p - b.p) % 12 in (1, 6, 11):
                erreurs.append(f"{a.p} et {b.p} à {max(a.t, b.t):.2f}")
    return erreurs


def _tournant(saison: str):
    def fabrique(v: int, rng: np.random.Generator) -> np.ndarray:
        m = _partition_saison(saison)
        erreurs = controler_intervalles(m)
        if erreurs:
            raise SystemExit(f"{m.id}: intervalles durs: {erreurs}")
        y, _ = produire(m, ICI / "midi")
        return y
    return fabrique


# --- La brume du matin ------------------------------------------------------------------------

# Merle très lointain, deux phrases écrites (autres que celles de blackbird-wake, qui chante au
# moment de la brume, de près): (début s, durée s, f départ, f arrivée, amplitude, vibrato Hz).
PHRASES_MERLE_LOIN = (
    [(0.00, 0.26, 1650, 1900, 0.9, 0), (0.34, 0.20, 2150, 2050, 1.0, 0), (0.62, 0.34, 1850, 1650, 0.9, 7),
     (1.04, 0.18, 2000, 2250, 0.7, 0)],
    [(0.00, 0.20, 1900, 2200, 0.8, 0), (0.28, 0.30, 2100, 1800, 1.0, 8), (0.66, 0.16, 1700, 1750, 0.7, 0),
     (0.88, 0.36, 1950, 1700, 0.9, 6)],
)


def _phrase_merle(rng: np.random.Generator, notes) -> np.ndarray:
    fin = max(t + d for t, d, *_ in notes)
    y = dsp.toile(fin + 0.1)
    for (t0, d, fa, fb, a, vib) in notes:
        m = dsp.n_ech(d)
        tt = np.arange(m) / SR
        f = np.interp(tt, [0, d * 0.3, d], [fa, fa + (fb - fa) * 0.6, fb])
        if vib:
            f = f * (1 + 0.025 * np.sin(2 * np.pi * vib * tt))
        x = dsp.sinus_glisse(f, rng.uniform(0, 6.28)) + 0.12 * dsp.sinus_glisse(2 * f)
        dsp.poser(y, x * dsp.env_ar(m, min(0.025, d * 0.25), min(0.07, d * 0.4)) * a, t0)
    return y


def _goutte_feuille(r: np.random.Generator) -> np.ndarray:
    """Une goutte tombe d'une feuille sur une autre: petit « tic » mouillé, résonance de la feuille."""
    x = dsp.clic(r, 1200, 4500, 0.006, 0.0012)
    feuille = dsp.modes(dsp.n_ech(0.03), [(r.uniform(1800, 3200), 0.4, 0.02)], r, attaque=0.0003)
    out = np.zeros(max(len(x), len(feuille)))
    out[:len(x)] += x
    out[:len(feuille)] += feuille
    return out * r.uniform(0.2, 0.6)


def _brume_matin(v: int, rng: np.random.Generator) -> np.ndarray:
    """Un matin de brume sur toute la Halte: l'air immobile et feutré (un souffle grave, presque rien
    au-dessus de 1 kHz), les gouttes qui tombent des feuilles et des herbes tout autour, une goutte
    plus ronde dans une flaque de temps en temps, et un merle très loin derrière la brume, deux fois
    par tour. Boucle de 24 s: bruit périodique, modulations à nombre entier de cycles, événements
    sur une ligne de temps circulaire, réverbération repliée."""
    duree = 24.0
    n = dsp.n_ech(duree)
    air = dsp.filtre_circulaire(dsp.bruit_spectral(n, rng, -4.5), dsp.gain_bande(90, 900)) * 0.28
    air *= 1 + 0.15 * ambiances.lfo_periodique(n, [(1, 1.0), (2, 0.5)], rng)
    y = air
    # Gouttes des feuilles: rares et nettes, chacune ailleurs (densité qui respire avec la brise).
    gouttes = dsp.grains(duree, 2.2, _goutte_feuille, rng, circulaire=True)
    y = y + gouttes * 0.55
    flaques = dsp.grains(duree, 0.35, lambda r: dsp.bulle(r, r.uniform(700, 1200), r.uniform(0.012, 0.02), 0.8) *
                         r.uniform(0.15, 0.3), rng, circulaire=True)
    y = y + flaques
    for k, t0 in enumerate((4.2, 15.6)):
        chant = _phrase_merle(rng, PHRASES_MERLE_LOIN[k])
        # Loin derrière la brume: aigus amortis, très bas.
        dsp.poser(y, dsp.pb(chant, 2400, 2) * 0.09, t0, circulaire=True)
    ir = dsp.ir_salle(2.4, 0.05, 0.3, graine=81)
    humide = dsp.reverbe_mono(y, ir, 0.3, 1.0)
    out = humide[:n].copy()
    out[: len(humide) - n] += humide[n:]  # queue repliée au début
    return moments.au_plus_calme(dsp.filtre_circulaire(out, dsp.gain_bande(0, 6000)))


# --- L'été ------------------------------------------------------------------------------------

def _grillons_ete(v: int, rng: np.random.Generator) -> np.ndarray:
    """Un soir d'été: le chœur des grillons champêtres, plus nombreux et plus égal qu'au printemps
    (huit voix vers 4,3 à 5 kHz, chacune à sa cadence), le trille doux et continu du grillon
    d'Italie dans les buissons (vers 2,7 kHz, il signe l'été), un alyte au loin. Boucle de 20 s:
    chaque cadence divise la boucle, trille modulé à nombre entier de cycles."""
    duree = 20.0
    n = dsp.n_ech(duree)
    y = np.zeros(n)
    for c in range(8):
        f = rng.uniform(4300, 5000)
        cris = int(rng.integers(36, 56))  # 1,8 à 2,8 cris par seconde
        periode = duree / cris
        syllabes = int(rng.integers(3, 5))
        gain = (0.9, 0.75, 0.6, 0.5, 0.42, 0.36, 0.3, 0.26)[c]
        decal = rng.uniform(0, periode)
        for k in range(cris):
            t0 = decal + k * periode + rng.uniform(-0.008, 0.008)
            for p in range(syllabes):
                m = dsp.n_ech(0.016)
                tt = np.arange(m) / SR
                pulse = np.sin(2 * np.pi * f * tt) * np.sin(np.pi * tt / 0.016) ** 2
                dsp.poser(y, pulse * gain * rng.uniform(0.8, 1.0), t0 + p * 0.032, circulaire=True)
    t = np.arange(n) / SR
    # Grillon d'Italie: trille continu « rrrrr », porteuse pure hachée à 40 Hz (800 cycles par tour).
    trille = np.sin(2 * np.pi * 2700 * t) * (0.5 + 0.5 * np.sin(2 * np.pi * 40 * t)) ** 2
    trille *= 0.7 + 0.3 * ambiances.lfo_periodique(n, [(1, 1.0), (3, 0.3)], rng)
    y += trille * 0.5
    for k in range(6):  # l'alyte, une note pure au loin
        m = dsp.n_ech(0.12)
        tt = np.arange(m) / SR
        dsp.poser(y, np.sin(2 * np.pi * 1350 * tt) * dsp.env_ar(m, 0.01, 0.06) * 0.2, 2.3 + k * 3.3,
                  circulaire=True)
    y += dsp.filtre_circulaire(dsp.bruit_spectral(n, rng, -3.0), dsp.gain_bande(100, 1500)) * 0.03
    return dsp.filtre_circulaire(y, dsp.gain_bande(0, 6500))


def _cri_martinet(rng: np.random.Generator, duree: float) -> np.ndarray:
    """Un « srriii » de martinet: sifflement aigu qui descend un peu, haché très vite (le grain
    strident), adouci: porteuse vers 4 à 5 kHz, coupée au-dessus de 6,5 kHz."""
    m = dsp.n_ech(duree)
    tt = np.arange(m) / SR
    f0 = rng.uniform(4200, 5000)
    f = f0 * (1.0 - 0.12 * tt / duree) * (1 + 0.02 * np.sin(2 * np.pi * rng.uniform(18, 26) * tt))
    hachage = 0.55 + 0.45 * np.sin(2 * np.pi * rng.uniform(75, 95) * tt)
    x = (dsp.sinus_glisse(f) + 0.25 * dsp.sinus_glisse(0.5 * f)) * hachage
    return x * dsp.env_points(m, [(0, 0), (duree * 0.15, 1.0), (duree * 0.6, 0.8), (duree, 0)])


def _passage_martinets(rng: np.random.Generator, oiseaux: int, duree: float) -> np.ndarray:
    """Une bande de martinets passe en criant au-dessus des toits: chaque oiseau crie une ou deux
    fois; le niveau monte puis retombe (la bande approche puis s'éloigne), la hauteur glisse un peu
    vers le bas au passage."""
    y = dsp.toile(duree + 1.0)
    for _ in range(oiseaux):
        t0 = rng.uniform(0.0, duree * 0.7)
        for _ in range(int(rng.integers(1, 3))):
            dsp.poser(y, _cri_martinet(rng, rng.uniform(0.35, 0.7)) * rng.uniform(0.5, 1.0), t0)
            t0 += rng.uniform(0.5, 0.9)
    passage = dsp.env_points(len(y), [(0, 0.15), (duree * 0.45, 1.0), (duree + 1.0, 0.1)])
    return dsp.pb(y * passage, 6500, 2)


def _martinets(v: int, rng: np.random.Generator) -> np.ndarray:
    """Le jour d'été: des bandes de martinets passent haut au-dessus du bourg, quatre fois par tour,
    entre de longs moments d'air chaud (souffle grave et doux). Boucle de 30 s, événements sur une
    ligne de temps circulaire, réverbération des façades repliée."""
    duree = 30.0
    n = dsp.n_ech(duree)
    y = dsp.filtre_circulaire(dsp.bruit_spectral(n, rng, -4.0), dsp.gain_bande(80, 900)) * 0.05
    # Passages assez égaux (rien qui surgisse au-dessus des actions), les plus faibles plus loin.
    for t0, oiseaux, gain in ((1.5, 6, 0.9), (8.0, 4, 0.6), (14.0, 7, 0.8), (20.5, 4, 0.55), (25.5, 5, 0.7)):
        passe = _passage_martinets(rng, oiseaux, rng.uniform(2.6, 3.4))
        if gain < 0.65:
            passe = dsp.pb(passe, 4500)
        dsp.poser(y, passe * gain * 0.35, t0, circulaire=True)
    ir = dsp.ir_salle(1.4, 0.03, 0.35, graine=82)
    humide = dsp.reverbe_mono(y, ir, 0.25, 1.0)
    out = humide[:n].copy()
    out[: len(humide) - n] += humide[n:]
    return moments.au_plus_calme(out)


# --- L'automne --------------------------------------------------------------------------------

def _vent_feuilles(v: int, rng: np.random.Generator) -> np.ndarray:
    """Le vent d'automne dans les feuilles sèches: un corps de vent qui souffle par rafales (périodes
    qui divisent la boucle), le crépitement sec des feuilles encore aux branches (plus fort pendant
    les rafales) et, de temps en temps, quelques feuilles qui roulent sur le chemin. Boucle de 24 s."""
    duree = 24.0
    n = dsp.n_ech(duree)
    # Jamais de silence complet entre deux rafales: le vent d'automne ne tombe pas tout à fait.
    rafales = 0.62 + 0.38 * np.clip(ambiances.lfo_periodique(n, [(2, 0.6), (3, 0.4), (5, 0.2)], rng), -1, 1)
    corps = dsp.filtre_circulaire(dsp.bruit_spectral(n, rng, -4.0), dsp.gain_bande(120, 800)) * 0.5
    # Feuilles sèches: crépitement serré de petits grains, plus dense et plus vif dans les rafales.
    crepit = dsp.filtre_circulaire(dsp.bruit_spectral(n, rng, 0.0), dsp.gain_bande(1500, 6500))
    hachage = np.abs(dsp.filtre_circulaire(dsp.bruit_spectral(n, rng, 0.0), dsp.gain_bande(15, 90)))
    hachage = (hachage / (hachage.max() + 1e-12)) ** 2.2
    feuilles = crepit * hachage * 2.2
    y = corps * rafales + feuilles * rafales ** 2 * 1.6
    # Feuilles qui roulent sur le chemin: suites de petits « tics » secs, pendant les rafales.
    for t0 in (3.4, 11.8, 19.2):
        roule = dsp.toile(1.2)
        t = 0.0
        while t < 1.0:
            dsp.poser(roule, dsp.clic(rng, 1800, 6000, 0.005, 0.0012) * rng.uniform(0.2, 0.6), t)
            t += rng.uniform(0.03, 0.11)
        dsp.poser(y, roule * dsp.env_points(len(roule), [(0, 0.2), (0.4, 1.0), (1.2, 0)]) * 0.35, t0,
                  circulaire=True)
    return dsp.filtre_circulaire(y, dsp.gain_bande(0, 7000))


def _croa(rng: np.random.Generator, f0: float, duree: float) -> np.ndarray:
    """Un « kraa » de corneille: voix rauque et nasale, fondamentale vers 500 Hz qui retombe en fin
    de syllabe, formants vers 1,1 et 1,7 kHz (plus haut et plus bref que le cri du héron)."""
    f_t = moments.courbe(duree, [(0.0, f0 * 0.92), (0.2, f0), (0.75, f0 * 0.97), (1.0, f0 * 0.82)])
    x = moments.voix(rng, f_t, [(1100, 5, 1.0), (1700, 6, 0.7), (2600, 8, 0.25)], rugosite=0.5,
                     f_rugosite=rng.uniform(55, 70), souffle=0.12, pente=0.9, f_max=6000)
    return x * dsp.env_points(len(x), [(0, 0), (0.02, 1.0), (duree * 0.7, 0.85), (duree, 0)])


def _corneilles(v: int, rng: np.random.Generator) -> np.ndarray:
    """Des corneilles au loin, sur les labours de l'autre rive: une crie trois fois, une autre lui
    répond plus loin, et un dernier appel isolé. Le reste du tour, rien que l'air. Boucle de 40 s."""
    duree = 40.0
    n = dsp.n_ech(duree)
    y = dsp.filtre_circulaire(dsp.bruit_spectral(n, rng, -4.0), dsp.gain_bande(80, 700)) * 0.04
    for t0, nb, f0, gain in ((3.0, 3, 520, 1.0), (5.6, 2, 470, 0.5), (21.0, 4, 540, 0.8), (33.5, 2, 500, 0.4)):
        t = t0
        for _ in range(nb):
            d = rng.uniform(0.28, 0.38)
            dsp.poser(y, dsp.pb(_croa(rng, f0 * rng.uniform(0.97, 1.03), d), 4000) * gain * 0.3, t, circulaire=True)
            t += d + rng.uniform(0.22, 0.34)
    ir = dsp.ir_salle(2.0, 0.06, 0.3, graine=83)
    humide = dsp.reverbe_mono(y, ir, 0.35, 1.0)
    out = humide[:n].copy()
    out[: len(humide) - n] += humide[n:]
    return moments.au_plus_calme(out)


# --- Cueillette -------------------------------------------------------------------------------

def _cueillir_herbe(v: int, rng: np.random.Generator) -> np.ndarray:
    """Ail des ours, pissenlit: la tige tendre casse net (petit « tk » juteux), les feuilles se
    froissent dans la main."""
    y = dsp.toile(0.4)
    t_casse = (0.05, 0.07, 0.04)[v % 3]
    dsp.poser(y, ins.froissement(rng, 0.2, 900, 4000, rng.uniform(90, 140), 0.02, 0.12) * 0.3, 0.0)
    casse = ins.bois(rng, rng.uniform(950, 1250), 0.06, 0.6, rapports=(1.0, 2.1, 3.7), t60=0.03,
                     amps=(0.7, 0.35, 0.15))
    dsp.poser(y, casse * 0.6, t_casse)
    dsp.poser(y, ins.bruit_bref(rng, 0.04, 600, 2500, 0.008, 0.0008) * 0.4, t_casse)
    dsp.poser(y, ins.froissement(rng, 0.16, 1000, 3500, 80, 0.01, 0.1) * 0.2, t_casse + 0.06)
    return dsp.pb(y, 5000)


def _cueillir_champignon(v: int, rng: np.random.Generator) -> np.ndarray:
    """Girolles: on tourne le pied (un petit couinement de chair ferme), il se détache de la mousse
    avec un « pop » mat et rond, quelques miettes de terre retombent."""
    y = dsp.toile(0.45)
    debit = ((lambda u: 180 + 260 * u), (lambda u: 240 + 160 * u), (lambda u: 200 + 220 * u ** 0.5))[v % 3]
    couine = ins.crissement(rng, 0.11, debit, [(rng.uniform(650, 800), 6), (rng.uniform(1300, 1600), 8)], 0.25)
    dsp.poser(y, couine * dsp.env_ar(len(couine), 0.02, 0.05) * 0.35, 0.0)
    m = dsp.n_ech(0.07)
    tt = np.arange(m) / SR
    f0 = (520, 580, 480)[v % 3] * rng.uniform(0.98, 1.02)
    pop = dsp.sinus_glisse(f0 * np.exp(-tt / 0.025) + 260) * dsp.env_exp(m, 0.02, 0.0015)
    dsp.poser(y, pop * 0.8, 0.11)
    dsp.poser(y, ins.bruit_bref(rng, 0.05, 500, 3000, 0.01, 0.001) * 0.3, 0.11)
    miettes = dsp.grains(0.2, 60, lambda r: ins.bruit_bref(r, 0.012, 600, 2500, 0.002) * r.uniform(0.1, 0.3), rng,
                         enveloppe=lambda u: np.exp(-u / 0.07))
    dsp.poser(y, miettes * 0.5, 0.14)
    return dsp.pb(y, 6500)


def _cueillir_mures(v: int, rng: np.random.Generator) -> np.ndarray:
    """Mûres: la main écarte le roncier (froissement de feuilles et petites épines qui grattent),
    deux ou trois mûres se détachent avec un « plic » mouillé et doux."""
    y = dsp.toile(0.6)
    dsp.poser(y, ins.froissement(rng, 0.35, 1800, 6500, rng.uniform(110, 160), 0.03, 0.15) * 0.4, 0.0)
    epines = dsp.grains(0.25, 40, lambda r: dsp.clic(r, 2500, 6500, 0.006, 0.002) * r.uniform(0.1, 0.3), rng)
    dsp.poser(y, epines * 0.5, 0.02)
    t = (0.16, 0.2, 0.14)[v % 3]
    for k in range(2 + v % 2):
        m = dsp.n_ech(0.035)
        tt = np.arange(m) / SR
        f0 = rng.uniform(950, 1350)
        plic = dsp.sinus_glisse(f0 * (1 + 0.5 * tt / 0.035)) * dsp.env_exp(m, 0.008, 0.0008)
        dsp.poser(y, plic * 0.35, t)
        dsp.poser(y, ins.bruit_bref(rng, 0.02, 1000, 4000, 0.004, 0.0005) * 0.2, t)
        t += rng.uniform(0.08, 0.12)
    return dsp.pb(y, 7000)


def _cueillir_noisettes(v: int, rng: np.random.Generator) -> np.ndarray:
    """Noisettes: la main les ramasse dans les feuilles mortes; trois à cinq coques dures
    s'entrechoquent dans la paume (petits « toc » secs et clairs)."""
    y = dsp.toile(0.5)
    dsp.poser(y, ins.froissement(rng, 0.18, 1500, 6000, rng.uniform(60, 100), 0.02, 0.1) * 0.3, 0.0)
    t = 0.08
    for k in range(3 + v % 3):
        coque = ins.bois(rng, rng.uniform(2100, 2900), 0.05, 1.0, rapports=(1.0, 1.8, 3.1), t60=0.018,
                         amps=(0.8, 0.4, 0.2))
        dsp.poser(y, coque * rng.uniform(0.4, 0.8) * (1 - 0.1 * k), t)
        t += rng.uniform(0.035, 0.07)
    return dsp.pb(y, 7000)


# --- La hache refusée ---------------------------------------------------------------------------

def _hache_mate(v: int, rng: np.random.Generator) -> np.ndarray:
    """La hache se pose sans frapper sur un rejet ou une souche: un coup mat et court (bois vert
    étouffé, fondamentale vers 260 à 320 Hz pour rester audible sur un portable), sans fer qui
    sonne, sans copeaux, sans écho; puis les petites feuilles du rejet frémissent."""
    y = dsp.toile(0.5)
    coup = ins.bois(rng, (290, 260)[v % 2] * rng.uniform(0.97, 1.03), 0.18, durete=0.4,
                    rapports=(1.0, 2.4, 4.3), t60=0.05, amps=(0.5, 0.7, 0.35))
    dsp.poser(y, coup, 0.0)
    dsp.poser(y, ins.bruit_bref(rng, 0.05, 400, 2200, 0.012, 0.002) * 0.35, 0.0)
    dsp.poser(y, ins.froissement(rng, 0.22, 1500, 5500, 90, 0.03, 0.12) * 0.16, 0.07)
    return dsp.pb(y, 5000)


# --- Déclarations -------------------------------------------------------------------------------

SAISONS_FR = {"spring": "du printemps", "summer": "de l'été", "autumn": "de l'automne", "winter": "de l'hiver"}


def sons() -> list[Son]:
    tournants = [
        Son(f"season-turn-{s}", f"Premier jour {fr}: motif sous la carte de saison au petit-déjeuner",
            "saisons", "ui", _tournant(s), 1, -20.0, 2, 0.0, 0.0, None, canaux=2, duck_db=-6.0, voix_max=1,
            duree_max=4.5, extra={"season": s, "family": "season-turn"},
            note="un fichier par saison (pas de tirage): jouer season-turn-<saison du jour>; fa pentatonique, "
                 "juste sur la musique du petit-déjeuner; bus interface (question S3), sans variation de hauteur")
        for s, fr in SAISONS_FR.items()
    ]
    return tournants + [
        Son("mist-morning", "Matin de brume (world.morningMist): air feutré, gouttes des feuilles, merle lointain",
            "ambiance", "ambience", _brume_matin, 1, -31.0, 4, 0.0, 0.0, None, boucle=True, passe_haut=60,
            extra={"until": "10 h 30", "fadeFrom": "9 h"},
            note="non placé, sur toute la carte; se lève avec la brume (9 h à 10 h 30); ne remplace pas "
                 "mist-ambience, la boucle placée du moment de la brume"),
        Son("crickets-summer", "Grillons d'un soir d'été (dès 19 h, et la nuit, en été)", "ambiance", "ambience",
            _grillons_ete, 1, -30.0, 4, 0.0, 0.0, None, boucle=True, passe_haut=300,
            extra={"season": "summer"}, note="remplace crickets en été"),
        Son("swifts", "Martinets qui passent en criant au-dessus du bourg (jour d'été)", "ambiance", "ambience",
            _martinets, 1, -36.0, 4, 0.0, 0.0, None, boucle=True, passe_haut=300,
            extra={"season": "summer"}, note="de 7 h à 21 h en été, se tait sous la pluie"),
        Son("wind-leaves", "Vent d'automne dans les feuilles sèches", "ambiance", "ambience", _vent_feuilles, 1,
            -30.0, 4, 0.0, 0.0, None, boucle=True, passe_haut=80,
            extra={"season": "autumn"}, note="remplace wind en automne; plus fort près de la lisière (forest_edge)"),
        Son("crows", "Corneilles au loin, sur l'autre rive (jour d'automne)", "ambiance", "ambience", _corneilles,
            1, -34.0, 4, 0.0, 0.0, None, boucle=True, passe_haut=200,
            extra={"season": "autumn"}, note="de 7 h à 18 h en automne, se tait sous la pluie"),
        Son("pick-herb", "Cueillir de l'ail des ours ou des pissenlits", "effets", "effects", _cueillir_herbe, 3,
            -24.0, 2, 0.05, 1.0, "pres", intervalle_min_ms=150, voix_max=2),
        Son("pick-mushroom", "Cueillir des girolles", "effets", "effects", _cueillir_champignon, 3, -24.0, 2, 0.05,
            1.0, "pres", intervalle_min_ms=150, voix_max=2),
        Son("pick-berries", "Cueillir des mûres (avec le froissement du roncier)", "effets", "effects",
            _cueillir_mures, 3, -24.0, 2, 0.05, 1.0, "pres", intervalle_min_ms=150, voix_max=2),
        Son("pick-nuts", "Ramasser des noisettes", "effets", "effects", _cueillir_noisettes, 3, -24.0, 2, 0.05, 1.0,
            "pres", intervalle_min_ms=150, voix_max=2),
        Son("axe-thud-soft", "Hache refusée sur une souche ou un rejet (stump_hint, tree_too_young)", "effets",
            "effects", _hache_mate, 2, -25.0, 2, 0.04, 1.0, "moyen", intervalle_min_ms=250, voix_max=1,
            note="joué seul, à la place de ui-refusal: le refus s'entend dans le monde"),
    ]
