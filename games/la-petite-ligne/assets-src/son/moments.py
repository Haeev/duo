"""Sons des moments rares de La Petite Ligne (fiches de `docs/jeux/jeu-1/tour-06-conception.md` et
`tour-07-conception.md`, section 1.4) et de l'assise sur un banc de bois.

Les bêtes sont synthétisées comme les poules et le coq (instruments.py): une source voisée dont
la hauteur suit une courbe, filtrée par quelques formants, avec une rugosité réglée. Rien n'est
enregistré ni imité d'un enregistrement: les cris suivent la description naturaliste de chaque
espèce (hauteur, durée, rythme), adoucie pour la centième écoute (aigus filtrés, attaques
arrondies, sonies sous celles des actions du joueur).

Les fichiers des moments vont dans assets/son/moments/: ce dossier n'est pas décodé au lancement
(src/audio/reglages.ts, residentFolders); ses sons se décodent quand le moment s'installe.
L'assise sur le banc, fréquente, va dans effets/ avec les autres gestes.
"""

from __future__ import annotations

from pathlib import Path

import numpy as np

import ambiances
import dsp
import instruments as ins
from catalogue import Son
from dsp import SR
from partition import Morceau, Note, Piste, produire

ICI = Path(__file__).resolve().parent
HARPE_GM, CORDES_LENTES_GM = 46, 49


# --- Outils propres aux bêtes --------------------------------------------------------------

def voix(rng: np.random.Generator, f_t: np.ndarray, formants: list[tuple[float, float, float]],
         rugosite: float = 0.0, f_rugosite: float = 60.0, souffle: float = 0.05, pente: float = 1.0,
         f_max: float = 7000.0) -> np.ndarray:
    """Source voisée (harmoniques de pente 1/k^pente) dont la fondamentale suit f_t (Hz), avec une
    gigue de hauteur, une rugosité (modulation d'amplitude à f_rugosite, qui donne le « rauque »),
    un peu de souffle, puis des formants (fréquence, facteur de qualité, gain)."""
    n = len(f_t)
    t = np.arange(n) / SR
    gigue = 1 + 0.012 * dsp.pb(rng.standard_normal(n), 30) * 20
    f = f_t * gigue
    phase = 2 * np.pi * np.cumsum(f) / SR
    fmin = float(np.min(f_t))
    source = sum((1.0 / k ** pente) * np.sin(k * phase) for k in range(1, 40) if fmin * k < f_max)
    if rugosite:
        mod = np.sin(2 * np.pi * f_rugosite * t + rng.uniform(0, 6.28))
        mod += 0.5 * dsp.pb(rng.standard_normal(n), f_rugosite * 1.5) * 6
        source = source * (1 + rugosite * np.clip(mod, -1.2, 1.2))
    source = source + dsp.pbande(rng.standard_normal(n), 800, 6000) * souffle * np.max(np.abs(source))
    return sum(dsp.resonateur(source, fc, q) * g for fc, q, g in formants)


def courbe(duree: float, points: list[tuple[float, float]]) -> np.ndarray:
    """Courbe de hauteur par points (fraction de la durée, Hz), lissée."""
    n = dsp.n_ech(duree)
    u = np.arange(n) / max(n - 1, 1)
    return np.interp(u, [p[0] for p in points], [p[1] for p in points])


def battement(rng: np.random.Generator, duree: float, f_bas: float, f_haut: float, lourd: float = 1.0) -> np.ndarray:
    """Un coup d'aile: souffle filtré qui gonfle puis retombe (l'aile descend), plus le froissement
    des plumes à la remontée."""
    n = dsp.n_ech(duree)
    centre = lambda u: f_bas + (f_haut - f_bas) * np.sin(np.pi * min(u / duree, 1.0)) ** 1.5  # noqa: E731
    souffle = dsp.pb_variable(rng.standard_normal(n), centre, type_="band", q_bande=0.9)
    souffle *= dsp.env_points(n, [(0, 0), (duree * 0.35, 1.0), (duree * 0.7, 0.35), (duree, 0)])
    plumes = ins.froissement(rng, duree, 1800, 6000, rng.uniform(70, 120), duree * 0.3, duree * 0.4) * 0.18
    sourd = ins.bruit_bref(rng, duree, 60, 260, duree * 0.25, duree * 0.15) * 0.5 * lourd
    return souffle + plumes + sourd


def gouttes(rng: np.random.Generator, duree: float, densite: float, f_bas: float = 900, f_haut: float = 3000,
            force: float = 0.3, tau: float = 0.12) -> np.ndarray:
    return dsp.grains(duree, densite, lambda r: dsp.bulle(r, r.uniform(f_bas, f_haut), r.uniform(0.003, 0.008)) *
                      r.uniform(0.3, 1.0) * force, rng, enveloppe=lambda u: np.exp(-u / tau))


# --- Le héron du gué -------------------------------------------------------------------------

def _heron_pas(v: int, rng: np.random.Generator) -> np.ndarray:
    """Une patte qui sort de l'eau basse et y rentre: deux clapotis étouffés et une goutte."""
    y = dsp.toile(0.32)
    for t, force in ((0.0, 0.7), (0.11 + 0.02 * v, 1.0)):
        m = dsp.n_ech(0.09)
        clapotis = dsp.pb_variable(rng.standard_normal(m), lambda u: 500 + 1400 * u / 0.09, type_="band", q_bande=1.4)
        dsp.poser(y, clapotis * dsp.env_points(m, [(0, 0), (0.015, 1), (0.09, 0)]) * 0.35 * force, t)
        dsp.poser(y, dsp.bulle(rng, rng.uniform(380, 620), rng.uniform(0.012, 0.02), 1.0) * 0.5 * force, t + 0.01)
    dsp.poser(y, dsp.bulle(rng, rng.uniform(1500, 2300), 0.005) * 0.18, 0.2 + rng.uniform(0, 0.05))
    return dsp.pb(y, 5000)


def _heron_bec(v: int, rng: np.random.Generator) -> np.ndarray:
    """Le bec lancé dans l'eau: « plic » bref, une bulle ronde, quelques gouttes."""
    y = dsp.toile(0.42)
    dsp.poser(y, ins.bruit_bref(rng, 0.04, 700, 4000, 0.006, 0.0006) * 0.45, 0.0)
    dsp.poser(y, dsp.bulle(rng, (720, 840)[v % 2] * rng.uniform(0.97, 1.03), 0.022, 1.2) * 0.9, 0.003)
    dsp.poser(y, gouttes(rng, 0.3, 30, 1300, 2800, 0.35, 0.1), 0.06)
    return dsp.pb(y, 6000)


def _heron_cri(v: int, rng: np.random.Generator) -> np.ndarray:
    """« Kraak »: un cri rauque, grave, qui retombe. Voix très rugueuse (sous-harmoniques), formant
    ouvert vers 1 kHz; filtré au-dessus de 4 kHz pour rester rond."""
    duree = (0.46, 0.40)[v % 2]
    f0 = (300, 335)[v % 2] * rng.uniform(0.98, 1.02)
    f_t = courbe(duree, [(0, f0 * 0.8), (0.12, f0 * 1.06), (0.5, f0), (1.0, f0 * 0.72)])
    x = voix(rng, f_t, [(900, 3.0, 1.0), (1500, 4.0, 0.65), (2600, 6.0, 0.3)], rugosite=0.75,
             f_rugosite=f0 / 2, souffle=0.12, pente=0.9)
    x *= dsp.env_points(len(x), [(0, 0), (0.02, 1.0), (duree * 0.6, 0.8), (duree, 0)])
    y = dsp.toile(0.6)
    dsp.poser(y, x, 0.0)
    return dsp.pb(y, 4000, 2)


def _heron_ailes(v: int, rng: np.random.Generator) -> np.ndarray:
    """Trois battements lourds (envergure de 1,70 m: lents, graves), dont le premier arrache le
    héron de l'eau (quelques gouttes retombent)."""
    y = dsp.toile(1.4)
    for k, t in enumerate((0.0, 0.42, 0.86)):
        b = battement(rng, 0.38, 180, 900, lourd=1.0 - 0.2 * k)
        dsp.poser(y, b * (1.0, 0.9, 0.75)[k], t)
    dsp.poser(y, gouttes(rng, 0.7, 45, 900, 2600, 0.25, 0.25), 0.08)
    return dsp.pb(y, 5000)


def _heron_pose(v: int, rng: np.random.Generator) -> np.ndarray:
    """Il freine, ailes déployées, et se pose sur le sable: froissement, deux battements courts, le
    crissement des pattes."""
    y = dsp.toile(0.62)
    dsp.poser(y, ins.froissement(rng, 0.32, 900, 5000, 90, 0.04, 0.18) * 0.5, 0.0)
    for t in (0.04, 0.2):
        dsp.poser(y, battement(rng, 0.16, 250, 1200, 0.6) * 0.6, t)
    sable = dsp.grains(0.12, 900, lambda r: dsp.clic(r, 1500, 6000, 0.003, 0.0008) * r.uniform(0.1, 0.4), rng,
                       enveloppe=lambda u: np.exp(-u / 0.05))
    dsp.poser(y, sable * 0.5, 0.36)
    dsp.poser(y, ins.bruit_bref(rng, 0.08, 70, 260, 0.02) * 0.4, 0.36)
    return dsp.pb(y, 6000)


# --- Les oies de l'Aubrune -------------------------------------------------------------------

def oie(rng: np.random.Generator, f0: float, duree: float, montee: float = 0.15, force: float = 1.0,
        nasal: float = 1.0) -> np.ndarray:
    """Un cri d'oie (« ang »): voix nasale, harmoniques riches, formants serrés vers 1 et 2,3 kHz,
    hauteur qui monte puis retombe un peu."""
    f_t = courbe(duree, [(0, f0 * (1 - montee * 0.5)), (0.35, f0 * (1 + montee)), (1.0, f0 * (1 + montee * 0.3))])
    x = voix(rng, f_t, [(1000, 6.0 * nasal, 1.0), (2300, 8.0, 0.55 * nasal), (600, 4.0, 0.4)], rugosite=0.25,
             f_rugosite=f0 / 3, souffle=0.04, pente=0.8, f_max=6500)
    return x * dsp.env_points(len(x), [(0, 0), (min(0.025, duree * 0.2), 1.0), (duree * 0.7, 0.7), (duree, 0)]) * force


def _oies_repos(v: int, rng: np.random.Generator) -> np.ndarray:
    """Neuf oies posées: murmures brefs et doux, quelques « ang » plus nets, l'eau qui clapote
    contre elles. Boucle de 6 s, événements sur une ligne de temps circulaire."""
    duree = 6.0
    n = dsp.n_ech(duree)
    y = np.zeros(n)
    hauteurs = [310, 335, 350, 370, 390, 410, 430, 455, 480]
    t = 0.0
    while t < duree:
        f0 = hauteurs[rng.integers(len(hauteurs))] * rng.uniform(0.97, 1.03)
        if rng.uniform() < 0.25:  # un cri net, parfois doublé
            nb = 2 if rng.uniform() < 0.5 else 1
            for k in range(nb):
                dsp.poser(y, oie(rng, f0, rng.uniform(0.11, 0.16), 0.12, 0.55), t + k * 0.17, circulaire=True)
        else:  # un murmure: court, grave, à peine voisé
            x = oie(rng, f0 * 0.82, rng.uniform(0.05, 0.09), 0.05, 0.22, nasal=0.6)
            dsp.poser(y, dsp.pb(x, 2500), t, circulaire=True)
        t += rng.uniform(0.18, 0.5)
    clapotis = dsp.grains(duree, 6, lambda r: dsp.bulle(r, r.uniform(250, 600), r.uniform(0.015, 0.03), 1.0) *
                          r.uniform(0.04, 0.1), rng, circulaire=True)
    lit = dsp.filtre_circulaire(dsp.bruit_spectral(n, rng, -3.0), dsp.gain_bande(200, 1800)) * 0.006
    y = dsp.filtre_circulaire(y + clapotis + lit, dsp.gain_bande(0, 6000))
    return au_plus_calme(y)


def au_plus_calme(y: np.ndarray, bloc: float = 0.05) -> np.ndarray:
    """Fait tourner une boucle pour que son raccord tombe sur le moment le plus calme (rotation
    circulaire: la boucle reste sans couture, et aucun cri ne commence au point de bouclage)."""
    b = dsp.n_ech(bloc)
    energie = np.array([np.sum(y[k:k + b] ** 2) for k in range(0, len(y) - b, b // 2)])
    return np.roll(y, -int(np.argmin(energie)) * (b // 2) - b // 2)


def _oies_alarme(v: int, rng: np.random.Generator) -> np.ndarray:
    """Les neuf cous se dressent: cris montants qui se chevauchent, de plus en plus serrés."""
    y = dsp.toile(1.15)
    for k in range(11):
        t = 0.04 * k + rng.uniform(0, 0.06) + (0.0 if k < 3 else 0.15 + 0.05 * k)
        f0 = rng.uniform(340, 470)
        dsp.poser(y, oie(rng, f0, rng.uniform(0.13, 0.2), 0.28, rng.uniform(0.5, 0.9)), min(t, 0.9))
    return dsp.pb(y, 5500)


def _oies_envol(v: int, rng: np.random.Generator) -> np.ndarray:
    """Course sur l'eau: ailes qui battent vite (trois par seconde et par oie, neuf oies), pattes
    qui frappent l'eau (claques mouillées, jusqu'à 2 s), gerbes, cris épars. Tout s'éloigne un peu
    à la fin (elles quittent l'eau à 2 s)."""
    duree = 3.0
    y = dsp.toile(duree + 0.3)
    for oiseau in range(9):
        t = rng.uniform(0.0, 0.25)
        periode = 1 / rng.uniform(2.8, 3.3)
        while t < duree - 0.2:
            force = min(1.0, 0.4 + t) * (1.0 if t < 2.2 else 1.0 - (t - 2.2) / 0.8)
            dsp.poser(y, battement(rng, periode * 0.9, 300, 1600, 0.5) * 0.18 * force, t)
            t += periode * rng.uniform(0.97, 1.03)
    t = 0.05
    while t < 2.0:  # pattes qui frappent l'eau
        claque = ins.bruit_bref(rng, 0.03, 500, 3500, 0.006, 0.0008) * 0.35
        dsp.poser(y, claque * rng.uniform(0.5, 1.0) * (1.0 if t < 1.5 else (2.0 - t) * 2), t)
        dsp.poser(y, dsp.bulle(rng, rng.uniform(400, 1200), 0.01) * 0.2 * rng.uniform(0.3, 1.0), t + 0.005)
        t += rng.uniform(0.03, 0.08)
    gerbe = dsp.pbande(rng.standard_normal(dsp.n_ech(2.2)), 400, 4000)
    gerbe *= dsp.env_points(len(gerbe), [(0, 0), (0.4, 0.5), (1.5, 0.4), (2.2, 0)])
    dsp.poser(y, gerbe * 0.06, 0.0)
    for k in range(6):
        dsp.poser(y, oie(rng, rng.uniform(360, 480), rng.uniform(0.12, 0.18), 0.2, 0.45), rng.uniform(0.1, 2.6))
    return dsp.pb(y, 6000)


def _oies_vol(v: int, rng: np.random.Generator) -> np.ndarray:
    """La volée qui s'éloigne: un chœur de neuf voix (chacune sa hauteur), des cris en série, les
    ailes à peine audibles. Le PannerNode suit l'oie de tête et fait l'essentiel de la distance;
    le fichier ajoute l'air qui avale les aigus et un léger déclin."""
    duree = 8.0
    n = dsp.n_ech(duree)
    y = np.zeros(n)
    hauteurs = rng.permutation([330, 350, 370, 390, 410, 430, 450, 470, 495])
    for i, f0 in enumerate(hauteurs):
        t = rng.uniform(0.0, 0.6)
        while t < duree - 0.4:
            serie = rng.integers(1, 4)
            for k in range(serie):
                dsp.poser(y, oie(rng, f0 * rng.uniform(0.98, 1.02), rng.uniform(0.12, 0.17), 0.15,
                                 rng.uniform(0.35, 0.6)), t + k * rng.uniform(0.2, 0.26))
            t += serie * 0.25 + rng.uniform(0.8, 2.2)
    ailes = dsp.pbande(rng.standard_normal(n), 300, 1500) * (0.5 + 0.5 * np.sin(2 * np.pi * 3 * np.arange(n) / SR)) ** 2
    y += ailes * 0.012 * dsp.env_points(n, [(0, 1), (3, 0.3), (duree, 0)])
    y = dsp.pb_variable(y, lambda u: 6000 - 3500 * (u / duree), type_="low")
    return y * dsp.env_points(n, [(0, 1.0), (duree * 0.5, 0.8), (duree - 1.5, 0.6), (duree, 0)])


# --- L'échelle de Basile -----------------------------------------------------------------------

def _echelle_appui(v: int, rng: np.random.Generator) -> np.ndarray:
    """L'échelle posée contre le chêne: choc sourd du bois sur l'écorce, frottement bref."""
    y = dsp.toile(0.42)
    dsp.poser(y, ins.bruit_bref(rng, 0.05, 600, 3000, 0.015, 0.003) * 0.25, 0.0)
    dsp.poser(y, ins.bois(rng, 150, 0.35, 0.7, rapports=(1.0, 2.2, 4.4), t60=0.14, amps=(1.0, 0.5, 0.2)), 0.02)
    dsp.poser(y, ins.bruit_bref(rng, 0.12, 50, 220, 0.03) * 0.3, 0.02)
    dsp.poser(y, ins.bois(rng, 160, 0.2, 0.5, rapports=(1.0, 2.4), t60=0.08, amps=(1.0, 0.4)) * 0.3, 0.1)
    return y


def _echelle_prise(v: int, rng: np.random.Generator) -> np.ndarray:
    """Les mains se posent sur un montant: le bois craque un peu sous l'appui."""
    y = dsp.toile(0.5)
    dsp.poser(y, ins.bruit_bref(rng, 0.04, 400, 2500, 0.01, 0.002) * 0.3, 0.0)
    debit = ((lambda u: 60 + 160 * u), (lambda u: 90 + 110 * u), (lambda u: 140 - 70 * u))[v % 3]
    g = ins.crissement(rng, 0.3, debit, [(rng.uniform(420, 520), 8), (rng.uniform(950, 1150), 10)], 0.2)
    dsp.poser(y, g * dsp.env_ar(len(g), 0.05, 0.12) * 0.4, 0.06)
    dsp.poser(y, ins.bois(rng, rng.uniform(170, 210), 0.2, 0.4, t60=0.06) * 0.1, 0.06)
    return dsp.pb(y, 5000)


def _echelle_barreau(v: int, rng: np.random.Generator) -> np.ndarray:
    """Un barreau sous le pied: appui sourd et petit craquement du bois."""
    y = dsp.toile(0.26)
    dsp.poser(y, ins.bois(rng, rng.uniform(190, 250), 0.2, 0.6, rapports=(1.0, 2.3, 4.2), t60=0.07,
                          amps=(0.6, 0.6, 0.3)), 0.0)
    dsp.poser(y, ins.bruit_bref(rng, 0.06, 60, 250, 0.015) * 0.15, 0.0)
    g = ins.crissement(rng, 0.12, lambda u: 120 + 200 * u * (1 + 0.5 * (v % 2)), [(rng.uniform(600, 800), 9)], 0.2)
    dsp.poser(y, g * dsp.env_ar(len(g), 0.02, 0.06) * 0.25, 0.03 + 0.01 * v)
    return dsp.pb(y, 5000)


def _nichoir_tourne(v: int, rng: np.random.Generator) -> np.ndarray:
    """Le nichoir pivote sur son clou: couinement de bois qui monte, puis se tait quand il est droit."""
    y = dsp.toile(0.62)
    g = ins.crissement(rng, 0.5, lambda u: 70 + 260 * (u / 0.5) ** 1.3, [(780, 12), (1650, 14), (2900, 16)], 0.15)
    dsp.poser(y, g * dsp.env_points(len(g), [(0, 0), (0.06, 1), (0.38, 0.8), (0.5, 0)]) * 0.35, 0.0)
    dsp.poser(y, ins.bois(rng, 340, 0.12, 0.4, t60=0.05) * 0.06, 0.5)
    return dsp.pb(y, 4500)


def _marteau_clou(v: int, rng: np.random.Generator) -> np.ndarray:
    """Petit marteau sur un clou, dans le bois du nichoir: plus léger que le marteau du chantier."""
    y = dsp.toile(0.22)
    clou = ins.metal(rng, rng.uniform(2900, 3300), 0.2, t60=0.09, rapports=(1.0, 1.6, 2.5), amps=(1.0, 0.4, 0.15))
    dsp.poser(y, clou * 0.18, 0.0)
    dsp.poser(y, ins.bois(rng, rng.uniform(380, 450), 0.2, 0.7, t60=0.09, amps=(1.0, 0.5, 0.25, 0.1)) * 0.8, 0.0)
    return dsp.pb(y, 6000)


# --- Les mésanges bleues -----------------------------------------------------------------------

def note_oiseau(rng: np.random.Generator, duree: float, f_de: float, f_a: float, amplitude: float = 1.0,
                vibrato: float = 0.0) -> np.ndarray:
    """Une note sifflée d'oiseau (sinus presque pur, deuxième harmonique faible), enveloppe ronde."""
    n = dsp.n_ech(duree)
    t = np.arange(n) / SR
    f = np.linspace(f_de, f_a, n)
    if vibrato:
        f = f * (1 + 0.02 * np.sin(2 * np.pi * vibrato * t))
    x = dsp.sinus_glisse(f, rng.uniform(0, 6.28)) + 0.08 * dsp.sinus_glisse(2 * f)
    return x * np.sin(np.pi * np.arange(n) / n) ** 2 * amplitude


def _mesange_cri(v: int, rng: np.random.Generator) -> np.ndarray:
    """« Tsi-tsi-tsi »: trois notes fines qui descendent un peu."""
    y = dsp.toile(0.8)
    base = (6200, 5800, 6500)[v % 3]
    nb = (3, 3, 4)[v % 3]
    for k in range(nb):
        f = base * rng.uniform(0.98, 1.02)
        dsp.poser(y, note_oiseau(rng, 0.065, f * 1.04, f * 0.94, 1.0 - 0.1 * k), 0.02 + k * rng.uniform(0.15, 0.18))
    return dsp.pb(y, 8000, 2)


def _mesange_chant(v: int, rng: np.random.Generator) -> np.ndarray:
    """« Tsi-tsi-tsuhuhuhu »: deux notes hautes, puis un trille plus bas et plus doux."""
    y = dsp.toile(1.8)
    haute = (6400, 6000, 6700)[v % 3]
    for k in range(2):
        dsp.poser(y, note_oiseau(rng, 0.08, haute * 1.03, haute * 0.95, 0.9), 0.03 + k * 0.2)
    trille_f = (3900, 4200, 3700)[v % 3]
    t = 0.48
    k = 0
    duree_trille = (0.85, 1.0, 0.75)[v % 3]
    while t < 0.48 + duree_trille:
        a = 0.75 * (1 - 0.35 * k / 14)
        dsp.poser(y, note_oiseau(rng, 0.045, trille_f * 1.06, trille_f * 0.92, a), t)
        t += 0.062
        k += 1
    return dsp.pb(y, 8000, 2)


def _mesange_ailes(v: int, rng: np.random.Generator) -> np.ndarray:
    """Un petit oiseau qui s'envole: froissement très bref, haché à la cadence des ailes (25 Hz)."""
    n = dsp.n_ech(0.2)
    t = np.arange(n) / SR
    x = dsp.pbande(rng.standard_normal(n), 1200, 6000)
    x *= (0.5 + 0.5 * np.sin(2 * np.pi * 26 * t)) ** 2
    return x * dsp.env_points(n, [(0, 0), (0.02, 1), (0.12, 0.6), (0.2, 0)])


# --- Le renard de la voie ----------------------------------------------------------------------

def _renard_saut(v: int, rng: np.random.Generator) -> np.ndarray:
    """Il retombe à pieds joints dans l'herbe haute: froissement, appui sourd, herbes qui se
    redressent."""
    y = dsp.toile(0.52)
    dsp.poser(y, ins.froissement(rng, 0.14, 1500, 6500, 100, 0.03, 0.06) * 0.3, 0.0)
    dsp.poser(y, ins.bruit_bref(rng, 0.1, 50, 220, 0.025) * 0.8, 0.12 + 0.02 * v)
    dsp.poser(y, ins.froissement(rng, 0.3, 1500, 7000, 140, 0.005, 0.22) * 0.6, 0.12 + 0.02 * v)
    brins = dsp.grains(0.25, 400, lambda r: dsp.clic(r, 2500, 7000, 0.003, 0.0007) * r.uniform(0.1, 0.4), rng,
                       enveloppe=lambda u: np.exp(-u / 0.08))
    dsp.poser(y, brins * 0.6, 0.13)
    return dsp.pb(y, 7000)


def _renard_jappe(v: int, rng: np.random.Generator) -> np.ndarray:
    """Deux jappements rauques (« ouah » bref, montant puis tombant), séparés d'une demi-seconde."""
    y = dsp.toile(1.2)
    f0 = (560, 500)[v % 2]
    for k, t in enumerate((0.0, (0.52, 0.46)[v % 2])):
        duree = rng.uniform(0.17, 0.22)
        f = f0 * rng.uniform(0.96, 1.04) * (1.0 if k == 0 else 0.95)
        f_t = courbe(duree, [(0, f * 0.75), (0.3, f * 1.12), (1.0, f * 0.7)])
        x = voix(rng, f_t, [(1100, 3.0, 1.0), (1900, 5.0, 0.6), (3000, 6.0, 0.25)], rugosite=0.6,
                 f_rugosite=f / 2.5, souffle=0.18, pente=1.0)
        x *= dsp.env_points(len(x), [(0, 0), (0.012, 1.0), (duree * 0.5, 0.8), (duree, 0)])
        dsp.poser(y, x * (1.0, 0.85)[k], t)
    return dsp.pb(y, 4500, 2)


def _poules_alarme(v: int, rng: np.random.Generator) -> np.ndarray:
    """Les poules inquiètes dans le poulailler fermé: « cot » rapides et serrés, deux voix, puis un
    « codêêt » qui monte. Joué depuis le poulailler, derrière ses planches (aigus adoucis)."""
    y = dsp.toile(1.5)
    t = 0.0
    for k in range(7):
        dsp.poser(y, ins.poule(rng, rng.uniform(400, 450), 0.07, "o"), t)
        t += rng.uniform(0.1, 0.13)
    for k in range(3):
        dsp.poser(y, ins.poule(rng, rng.uniform(360, 400), 0.07, "a") * 0.6, 0.06 + 0.15 * k)
    dsp.poser(y, ins.poule(rng, 470, 0.45, "e", glisse=0.3), t + 0.05)
    return dsp.pb(y, 4000)


# --- Les vers luisants du pré -----------------------------------------------------------------

def _grillons_pre(v: int, rng: np.random.Generator) -> np.ndarray:
    """Grillons champêtres, tout près (boucle de 8 s, placée au pré): chaque grillon répète un
    « cri » de trois ou quatre syllabes vers 4,3 à 4,8 kHz, trois à quatre cris par seconde. Plus
    net et plus proche que l'ambiance générale des grillons."""
    duree = 8.0
    n = dsp.n_ech(duree)
    y = np.zeros(n)
    for c in range(6):
        f = rng.uniform(4300, 4800)
        # Période qui divise la boucle (nombre entier de cris): la boucle reste sans couture.
        cris = int(rng.integers(24, 32))
        periode = duree / cris
        syllabes = int(rng.integers(3, 5))
        gain = (1.0, 0.8, 0.6, 0.45, 0.35, 0.3)[c]
        decal = rng.uniform(0, periode)
        for k in range(cris):
            t0 = decal + k * periode + rng.uniform(-0.006, 0.006)
            for p in range(syllabes):
                m = dsp.n_ech(0.018)
                tt = np.arange(m) / SR
                pulse = np.sin(2 * np.pi * f * tt) * np.sin(np.pi * tt / 0.018) ** 2
                dsp.poser(y, pulse * gain * rng.uniform(0.8, 1.0), t0 + p * 0.034, circulaire=True)
    y += dsp.filtre_circulaire(dsp.bruit_spectral(n, rng, -3.0), dsp.gain_bande(150, 1500)) * 0.01
    return dsp.filtre_circulaire(y, dsp.gain_bande(0, 6500))


def celesta(f: float, duree: float, rng: np.random.Generator) -> np.ndarray:
    """Lame de célesta (marteau feutré sur une lame d'acier au-dessus d'un résonateur): partiel
    fondamental long, quatrième partiel discret et bref, attaque douce."""
    n = dsp.n_ech(duree)
    return dsp.modes(n, [(f, 1.0, 2.2), (f * 1.002, 0.3, 2.0), (f * 4.0, 0.12, 0.35), (f * 2.0, 0.05, 0.6)],
                     rng, attaque=0.003)


def _scintillement(v: int, rng: np.random.Generator) -> np.ndarray:
    """Quatre notes de célesta en sol pentatonique, qui montent comme les lumières qui s'allument,
    réparties dans la stéréo; petite salle. Justes sur toutes les musiques du jeu."""
    notes = (("B5", "D6", "E6", "G6"), ("D6", "E6", "G6", "B6"))[v % 2]
    pans = (-0.35, 0.2, -0.1, 0.35)
    y = dsp.toile(3.0, stereo=True)
    for k, (nom, pan) in enumerate(zip(notes, pans)):
        x = celesta(dsp.freq(nom), 2.4, rng) * (1.0, 0.85, 0.85, 0.75)[k]
        dsp.poser(y, dsp.pb(x, 6000), 0.34 * k, pan=pan)
    return y


# --- La chevrette du pré (tour 7) ----------------------------------------------------------------

def _chevrette_appel(v: int, rng: np.random.Generator) -> np.ndarray:
    """La mère appelle son faon tout bas: un « pi-é » nasal et doux, qui monte un peu puis retombe.
    Voix presque lisse (peu de rugosité), formants serrés du nez, aigus arrondis."""
    duree = (0.36, 0.42)[v % 2]
    f0 = (520, 470)[v % 2] * rng.uniform(0.98, 1.02)
    f_t = courbe(duree, [(0, f0 * 0.92), (0.3, f0 * 1.08), (1.0, f0 * 0.8)])
    x = voix(rng, f_t, [(1100, 6.0, 1.0), (2400, 8.0, 0.45), (520, 4.0, 0.5)], rugosite=0.1, f_rugosite=f0 / 4,
             souffle=0.1, pente=1.3, f_max=5000)
    x *= dsp.env_points(len(x), [(0, 0), (0.04, 1.0), (duree * 0.6, 0.75), (duree, 0)])
    y = dsp.toile(0.5)
    dsp.poser(y, x, 0.0)
    return dsp.pb(y, 4500, 2)


def _faon_herbe(v: int, rng: np.random.Generator) -> np.ndarray:
    """L'herbe haute frémit au lit du faon: froissement lent de tiges, quelques brins qui claquent."""
    y = dsp.toile(0.65)
    dsp.poser(y, ins.froissement(rng, 0.55, 1200, 6000, 45, 0.12, 0.3) * 0.5, 0.0)
    dsp.poser(y, ins.froissement(rng, 0.3, 700, 3000, 30, 0.08, 0.15) * 0.25, 0.15)
    brins = dsp.grains(0.45, 60, lambda r: dsp.clic(r, 2500, 7000, 0.003, 0.0007) * r.uniform(0.1, 0.35), rng)
    dsp.poser(y, brins * 0.5, 0.08)
    return dsp.pb(y, 7000)


def _faon_mi(v: int, rng: np.random.Generator) -> np.ndarray:
    """Le petit « mi » aigu du faon: deux fois plus haut que l'appel de la mère, bref, qui monte."""
    duree = (0.24, 0.28)[v % 2]
    f0 = (980, 1080)[v % 2] * rng.uniform(0.98, 1.02)
    f_t = courbe(duree, [(0, f0 * 0.9), (0.55, f0 * 1.1), (1.0, f0 * 0.95)])
    x = voix(rng, f_t, [(1500, 5.0, 1.0), (2900, 7.0, 0.4)], rugosite=0.08, f_rugosite=f0 / 5, souffle=0.08,
             pente=1.2, f_max=7000)
    x *= dsp.env_points(len(x), [(0, 0), (0.025, 1.0), (duree * 0.65, 0.8), (duree, 0)])
    y = dsp.toile(0.34)
    dsp.poser(y, x, 0.0)
    return dsp.pb(y, 6000, 2)


def _sabot(rng: np.random.Generator, force: float, f1: float) -> np.ndarray:
    """Un sabot sur le sol du pré: appui sourd, motte de terre (au-dessus de 300 Hz, pour les
    haut-parleurs de portable), herbe écrasée."""
    y = dsp.toile(0.3)
    dsp.poser(y, ins.bois(rng, f1, 0.2, 0.3, rapports=(1.0, 2.1, 3.9), t60=0.05, amps=(0.5, 0.6, 0.3)) * 0.6, 0.0)
    dsp.poser(y, ins.bruit_bref(rng, 0.08, 300, 2500, 0.02, 0.002) * 0.6, 0.0)
    dsp.poser(y, ins.bruit_bref(rng, 0.1, 60, 260, 0.03) * 0.25, 0.0)
    dsp.poser(y, ins.froissement(rng, 0.14, 1500, 6000, 90, 0.005, 0.1) * 0.25, 0.004)
    return y * force


def _chevrette_sabot(v: int, rng: np.random.Generator) -> np.ndarray:
    """Elle frappe du pied: un coup de sabot sec et sourd sur l'herbe rase."""
    y = dsp.toile(0.32)
    dsp.poser(y, _sabot(rng, 1.0, 230), 0.0)
    # L'herbe écrasée se redresse sous le sabot.
    dsp.poser(y, ins.froissement(rng, 0.2, 1500, 6000, 70, 0.02, 0.15) * 0.12, 0.06)
    return dsp.pb(y, 6000)


def _chevrette_aboi(v: int, rng: np.random.Generator) -> np.ndarray:
    """« Bö »: l'aboiement d'alarme, rauque et soufflé, bref, qui retombe. Assez fort pour prévenir
    l'autre joueur à 30 m, filtré au-dessus de 4,5 kHz pour ne pas agresser."""
    duree = (0.34, 0.3)[v % 2]
    f0 = (360, 320)[v % 2] * rng.uniform(0.98, 1.02)
    f_t = courbe(duree, [(0, f0 * 0.85), (0.15, f0 * 1.1), (1.0, f0 * 0.7)])
    x = voix(rng, f_t, [(700, 3.0, 1.0), (1300, 4.0, 0.7), (2500, 6.0, 0.3)], rugosite=0.8, f_rugosite=f0 / 2,
             souffle=0.35, pente=0.9, f_max=6000)
    x *= dsp.env_points(len(x), [(0, 0), (0.01, 1.0), (duree * 0.35, 0.85), (duree, 0)])
    y = dsp.toile(0.62)
    dsp.poser(y, x, 0.0)
    # L'écho bref de la haie et des maisons: l'aboiement porte dans le matin calme.
    ir = dsp.ir_salle(0.9, 0.04, 0.35, graine=71 + v)
    y = dsp.reverbe_mono(y, ir, 0.18, 1.0)[: len(y)]
    return dsp.pb(y, 4500, 2)


def _chevrette_bonds(v: int, rng: np.random.Generator) -> np.ndarray:
    """Deux bonds chacun vers la haie (0,8 s par bond): l'appel des pattes, la réception, puis la
    haie qui les avale. Le faon, plus léger, suit d'un souffle."""
    y = dsp.toile(1.75)
    for t, force, f1 in ((0.0, 0.6, 220), (0.6, 1.0, 210), (0.8, 0.55, 225), (1.4, 0.8, 215)):
        dsp.poser(y, _sabot(rng, force, f1), t)
        dsp.poser(y, _sabot(rng, force * 0.45, f1 * 1.3), t + 0.07 + rng.uniform(0, 0.03))
    dsp.poser(y, ins.froissement(rng, 0.35, 900, 6000, 120, 0.02, 0.25) * 0.45, 1.38)
    return dsp.pb(y, 6000)


# --- Le martin-pêcheur du ponton (tour 7) ---------------------------------------------------------

def _martin_sifflet(v: int, rng: np.random.Generator) -> np.ndarray:
    """« Tiiii »: un sifflet aigu, droit et perçant, qui retombe à peine. La troisième variante le
    double (« ti-tiii »). C'est lui qu'on entend avant de voir l'oiseau."""
    y = dsp.toile(0.5)
    plan = (((0.0, 0.34, 4200),), ((0.0, 0.38, 3950),), ((0.0, 0.09, 4400), (0.14, 0.3, 4400)))[v % 3]
    for t0, duree, f in plan:
        n = dsp.n_ech(duree)
        tt = np.arange(n) / SR
        f_t = np.linspace(f * 1.02, f * 0.95, n) * (1 + 0.006 * np.sin(2 * np.pi * 38 * tt))
        x = dsp.sinus_glisse(f_t, rng.uniform(0, 6.28)) + 0.06 * dsp.sinus_glisse(2 * f_t)
        x *= dsp.env_ar(n, 0.015, min(0.08, duree * 0.4))
        dsp.poser(y, x, t0)
    return dsp.pb(y, 9000, 2)


def _martin_plongeon(v: int, rng: np.random.Generator) -> np.ndarray:
    """Le plongeon d'un petit oiseau: entrée nette et claire (« plic »), une bulle vive, une gerbe
    fine qui retombe. Plus aigu et plus sec que le bouchon de la pêche."""
    y = dsp.toile(0.45)
    dsp.poser(y, ins.bruit_bref(rng, 0.04, 900, 6500, 0.007, 0.0005) * 0.6, 0.0)
    dsp.poser(y, dsp.bulle(rng, (1100, 960)[v % 2] * rng.uniform(0.97, 1.03), 0.016, 1.3) * 0.8, 0.004)
    # La gerbe retombe pendant 0,3 s: c'est elle qui donne sa durée au plongeon.
    dsp.poser(y, gouttes(rng, 0.34, 45, 1500, 3600, 0.3, 0.2), 0.05)
    return dsp.pb(y, 7000)


def _martin_frappe(v: int, rng: np.random.Generator) -> np.ndarray:
    """« Tac tac »: il assomme l'ablette contre le pieu, deux coups secs à 0,5 s d'écart (le fichier
    contient les deux: un seul déclenchement)."""
    y = dsp.toile(0.62)
    for t, force in ((0.0, 1.0), (0.5, 0.85)):
        coup = ins.bois(rng, rng.uniform(620, 700), 0.12, 0.9, rapports=(1.0, 2.6, 4.9), t60=0.04, amps=(0.7, 0.5, 0.2))
        dsp.poser(y, coup * 0.6 * force, t)
        dsp.poser(y, ins.bruit_bref(rng, 0.03, 900, 5000, 0.004, 0.0003) * 0.4 * force, t)
    return dsp.pb(y, 7000)


# --- La brume de l'Aubrune (tour 7) ---------------------------------------------------------------

def _brume_riviere(v: int, rng: np.random.Generator) -> np.ndarray:
    """L'eau toute proche, feutrée par la brume: un lit grave et doux (aigus coupés vers 1,8 kHz),
    un babil lent, et les gouttes qui tombent des herbes mouillées. Boucle de 8 s: bruit périodique,
    modulations à nombre entier de cycles, gouttes sur une ligne de temps circulaire."""
    duree = 8.0
    n = dsp.n_ech(duree)
    lit = dsp.filtre_circulaire(dsp.bruit_spectral(n, rng, -3.0), dsp.gain_bande(110, 1800)) * 0.4
    babil = dsp.filtre_circulaire(dsp.bruit_spectral(n, rng, -1.0), dsp.gain_bande(350, 1500))
    mod = np.abs(dsp.filtre_circulaire(dsp.bruit_spectral(n, rng, 0.0), dsp.gain_bande(1, 8)))
    babil *= (mod / (mod.max() + 1e-12)) ** 1.5 * 1.2
    y = lit + babil * 0.35
    y += dsp.grains(duree, 3, lambda r: dsp.bulle(r, r.uniform(160, 320), r.uniform(0.03, 0.05), 1.0) *
                    r.uniform(0.1, 0.25), rng, circulaire=True)
    y *= 1 + 0.1 * ambiances.lfo_periodique(n, [(1, 1.0), (3, 0.4)], rng)
    # Gouttes des herbes: rares, nettes, chacune sur sa hauteur (1,4 à 3,2 kHz).
    y += dsp.grains(duree, 1.6, lambda r: dsp.bulle(r, r.uniform(1400, 3200), r.uniform(0.004, 0.008)) *
                    r.uniform(0.15, 0.4), rng, circulaire=True)
    return au_plus_calme(dsp.filtre_circulaire(y, dsp.gain_bande(0, 5000)))


def _brume_leve(v: int, rng: np.random.Generator) -> np.ndarray:
    """La brume se lève: un accord ouvert qui monte à la harpe, porté par des cordes douces qui
    gonflent. Sol majeur (sol, ré, la, si) ou do (do, sol, ré, mi), sans seconde mineure, septième
    majeure ni triton: juste sous la musique du matin (sol majeur), descendue de 6 dB."""
    arpege, cordes = ((["G2", "D3", "G3", "A3", "D4", "G4", "A4", "B4", "D5"], ["G3", "D4", "A4"]),
                      (["C3", "G3", "C4", "D4", "G4", "C5", "D5", "E5", "G5"], ["C4", "G4", "D5"]))[v % 2]
    harpe = [Note(0.2 * k, 3.6 - 0.2 * k, dsp.note_midi(p), 58 + 2 * k) for k, p in enumerate(arpege)]
    nappe_ = [Note(0.1, 3.4, dsp.note_midi(p), 48) for p in cordes]
    m = Morceau(id=f"mist-lift-{v + 1}", titre=f"mist-lift-{v + 1}", tempo=60.0, signature=(4, 4), mesures=1,
                temps_par_mesure=4.0, pistes=[
                    Piste("harpe", HARPE_GM, harpe, 0.0, pan=58, reverbe=0.4),
                    Piste("cordes", CORDES_LENTES_GM, nappe_, -5.0, pan=70, reverbe=0.45, souffle=True),
                ], boucle=False, queue_s=2.0, rt60=1.8, sonie_cible=-20.0)
    # Toutes les notes sonnent ensemble: aucune paire ne doit former une seconde mineure, une
    # septième majeure ou un triton (contrôle sans grille d'accords, plus strict que frottements()).
    hauteurs = sorted({n.p for p in m.pistes for n in p.notes})
    durs = [(a, b) for i, a in enumerate(hauteurs) for b in hauteurs[i + 1:] if (b - a) % 12 in (1, 6, 11)]
    if durs:
        raise SystemExit(f"mist-lift: intervalles durs dans l'accord: {durs}")
    y, _ = produire(m, ICI / "midi")
    return y


# Le merle: phrase flûtée et grave (1,6 à 2,7 kHz), notes glissées, puis un gazouillis aigu et
# doux à la fin. Trois phrases écrites, aucune copiée d'un enregistrement:
# (début s, durée s, f départ, f arrivée, amplitude, vibrato Hz).
PHRASES_MERLE = (
    [(0.00, 0.22, 1700, 2050, 0.8, 0), (0.28, 0.16, 2300, 2200, 0.9, 0), (0.48, 0.30, 1950, 1750, 1.0, 9),
     (0.86, 0.14, 2250, 2500, 0.7, 0), (1.04, 0.34, 2100, 1800, 0.9, 7)],
    [(0.00, 0.18, 2000, 2400, 0.8, 0), (0.24, 0.26, 2450, 2050, 1.0, 8), (0.58, 0.12, 1800, 1850, 0.7, 0),
     (0.74, 0.12, 2100, 2150, 0.7, 0), (0.92, 0.38, 2300, 1850, 0.9, 6)],
    [(0.00, 0.30, 1600, 1900, 0.9, 6), (0.38, 0.18, 2200, 2650, 0.8, 0), (0.62, 0.22, 2400, 2000, 1.0, 0),
     (0.92, 0.32, 1900, 1700, 0.9, 8)],
)


def _merle(v: int, rng: np.random.Generator) -> np.ndarray:
    """Un merle chante dans les arbres de la rive nord (non localisé): phrase flûtée, gazouillis,
    petit écho des arbres."""
    notes = PHRASES_MERLE[v % 3]
    fin = max(t + d for t, d, *_ in notes)
    y = dsp.toile(3.0)
    for (t0, d, fa, fb, a, vib) in notes:
        m = dsp.n_ech(d)
        tt = np.arange(m) / SR
        f = np.interp(tt, [0, d * 0.3, d], [fa, fa + (fb - fa) * 0.6, fb])
        if vib:
            f = f * (1 + 0.025 * np.sin(2 * np.pi * vib * tt))
        x = dsp.sinus_glisse(f, rng.uniform(0, 6.28)) + 0.15 * dsp.sinus_glisse(2 * f) + 0.04 * dsp.sinus_glisse(3 * f)
        dsp.poser(y, x * dsp.env_ar(m, min(0.02, d * 0.25), min(0.06, d * 0.4)) * a, t0)
    t = fin + 0.12
    for k in range(int(rng.integers(5, 8))):
        f = rng.uniform(4800, 6400)
        dsp.poser(y, note_oiseau(rng, 0.035, f * 1.05, f * 0.93, 0.22 * (1 - 0.08 * k)), t)
        t += rng.uniform(0.045, 0.065)
    return dsp.pb(y, 8000, 2)


def _poisson_saut(v: int, rng: np.random.Generator) -> np.ndarray:
    """Un poisson saute entre les deux rives: la sortie (petite claque mouillée et gouttes), puis la
    rentrée ronde (« blop ») et quelques gouttes. Deux temps: on ne le confond pas avec le plongeon
    du martin-pêcheur (un seul temps, plus aigu) ni avec le bouchon."""
    y = dsp.toile(0.48)
    dsp.poser(y, ins.bruit_bref(rng, 0.03, 600, 4500, 0.004, 0.0004) * 0.35, 0.0)
    dsp.poser(y, gouttes(rng, 0.1, 50, 1600, 3200, 0.18, 0.05), 0.01)
    t_retour = (0.15, 0.18)[v % 2]
    dsp.poser(y, ins.bruit_bref(rng, 0.04, 300, 2500, 0.01, 0.001) * 0.4, t_retour)
    # Rentrée vers 700 Hz: au-dessus du bouchon de la pêche (460 à 540 Hz), sous le plongeon (1 kHz).
    dsp.poser(y, dsp.bulle(rng, (690, 760)[v % 2] * rng.uniform(0.97, 1.03), 0.03, 1.0) * 0.9, t_retour + 0.004)
    dsp.poser(y, gouttes(rng, 0.22, 35, 1200, 2800, 0.25, 0.08), t_retour + 0.04)
    return dsp.pb(y, 6500)


# --- S'asseoir sur un banc de bois ---------------------------------------------------------------

def _banc_assise(v: int, rng: np.random.Generator) -> np.ndarray:
    """On s'assoit sur le banc: l'étoffe frotte la planche, le poids fait craquer le bois (deux
    lattes et les pieds), un appui sourd. Court et feutré: on s'assoit souvent."""
    y = dsp.toile(0.6)
    etoffe = ins.froissement(rng, 0.2, 700, 4500, rng.uniform(60, 100), 0.04, 0.12) * 0.35
    dsp.poser(y, etoffe, 0.0)
    t_appui = (0.09, 0.11, 0.08)[v % 3]
    dsp.poser(y, ins.bois(rng, rng.uniform(150, 185), 0.3, 0.35, rapports=(1.0, 2.3, 4.7), t60=0.12,
                          amps=(0.6, 0.6, 0.3)) * 0.55, t_appui)
    dsp.poser(y, ins.bruit_bref(rng, 0.1, 90, 300, 0.03, 0.006) * 0.2, t_appui)
    debit = ((lambda u: 70 + 120 * u), (lambda u: 120 - 50 * u), (lambda u: 80 + 60 * np.sin(np.pi * u / 0.22)))[v % 3]
    g = ins.crissement(rng, 0.22, debit, [(rng.uniform(380, 470), 8), (rng.uniform(850, 1000), 10)], 0.2)
    dsp.poser(y, g * dsp.env_ar(len(g), 0.04, 0.1) * 0.4, t_appui + 0.03)
    dsp.poser(y, ins.froissement(rng, 0.14, 900, 4000, 70, 0.02, 0.1) * 0.15, t_appui + 0.12)
    return dsp.pb(y, 5000)


# --- Déclarations ------------------------------------------------------------------------------

def sons() -> list[Son]:
    m = "moments"
    return [
        # Héron du gué
        Son("heron-wade", "Héron: pas dans l'eau basse du gué (en attente, toutes les 6 à 12 s)", m, "effects",
            _heron_pas, 3, -29.0, 3, 0.06, 1.5, "faune-15", intervalle_min_ms=2000, voix_max=1,
            extra={"momentSound": "heron_wade", "moment": "heron"}),
        Son("heron-strike", "Héron: coup de bec dans l'eau (clip heron_strike)", m, "effects", _heron_bec, 2, -26.0,
            3, 0.05, 1.0, "faune-15", intervalle_min_ms=2000, voix_max=1,
            extra={"momentSound": "heron_strike", "moment": "heron"}),
        Son("heron-croak", "Héron: cri rauque « kraak » à l'envol (apogée, t = 3,8 s)", m, "effects", _heron_cri, 2,
            -21.0, 2, 0.03, 1.0, "faune-25", voix_max=1, extra={"momentSound": "heron_croak", "moment": "heron"}),
        Son("heron-wings", "Héron: trois battements lourds à l'envol (apogée, t = 2,6 s; départ sans apogée, t = 0)", m, "effects", _heron_ailes,
            1, -22.0, 2, 0.04, 1.0, "faune-20", voix_max=1, extra={"momentSound": "heron_wings", "moment": "heron"}),
        Son("heron-land", "Héron: il freine et se pose sur la grève (apogée, t = 6,6 s)", m, "effects", _heron_pose, 1,
            -24.0, 2, 0.04, 1.0, "faune-20", voix_max=1, extra={"momentSound": "heron_land", "moment": "heron"}),
        # Oies de l'Aubrune
        Son("geese-rest", "Oies posées sur l'Aubrune: murmures du groupe (boucle, en attente)", m, "ambience",
            _oies_repos, 1, -30.0, 3, 0.0, 0.0, "faune-20", boucle=True, passe_haut=120, voix_max=1,
            extra={"momentSound": "geese_rest", "moment": "geese"},
            note="placé à geese_rest; c'est ce qui attire le passant: audible à 20 m"),
        Son("geese-alarm", "Oies: les cous se dressent, cris montants (apogée et départ sans apogée, t = 0)", m, "effects", _oies_alarme, 1,
            -21.0, 2, 0.03, 1.0, "moyen", voix_max=1, extra={"momentSound": "geese_alarm", "moment": "geese"}),
        Son("geese-takeoff", "Oies: course sur l'eau, ailes et pattes, cris (apogée, t = 2,8 s; départ sans apogée, t = 1 s)", m, "effects",
            _oies_envol, 1, -19.5, 2, 0.03, 1.0, "moyen", voix_max=1,
            extra={"momentSound": "geese_takeoff", "moment": "geese"}),
        Son("geese-flight", "Oies: la volée qui s'éloigne, chœur de neuf voix (apogée, t = 5,8 s; départ sans apogée, t = 3 s)",
            m, "effects", _oies_vol, 3, -21.0, 2, 0.02, 1.0, "loin", voix_max=1,
            extra={"momentSound": "geese_flight", "moment": "geese"},
            note="placé à l'oie de tête et déplacé avec elle (le PannerNode fait la distance et le panoramique)"),
        # Échelle de Basile
        Son("ladder-lean", "Échelle posée contre le chêne (début de la quête basile_lost)", m, "effects",
            _echelle_appui, 1, -23.0, 3, 0.04, 1.0, "faune-15", voix_max=1,
            extra={"momentSound": "ladder_lean", "moment": "ladder"},
            note="seulement si un joueur est à moins de 15 m"),
        Son("ladder-grip", "Échelle: on prend une place, le montant craque", m, "effects", _echelle_prise, 3, -27.0, 3,
            0.05, 1.0, "pres", intervalle_min_ms=150, voix_max=2,
            extra={"momentSound": "ladder_grip", "moment": "ladder"}),
        Son("ladder-step", "Échelle: un barreau sous le pied de Basile (apogée, montée à 0,5, 1,1 et 1,7 s, descente à 4,9, 5,73 et 6,57 s)", m, "effects",
            _echelle_barreau, 4, -27.0, 2, 0.05, 1.5, "pres", intervalle_min_ms=200, voix_max=2,
            extra={"momentSound": "ladder_step", "moment": "ladder"}),
        Son("nest-box-turn", "Le nichoir pivote sur son clou et se redresse (apogée, t = 2,3 s)", m, "effects",
            _nichoir_tourne, 1, -26.0, 2, 0.03, 0.5, "pres", voix_max=1,
            extra={"momentSound": "nest_box_turn", "moment": "ladder"}),
        Son("hammer-tap", "Petit marteau de Basile sur le clou du nichoir (apogée, trois coups à 3,35, 3,95 et 4,55 s)", m, "effects", _marteau_clou,
            3, -25.0, 2, 0.04, 1.0, "moyen", intervalle_min_ms=200, voix_max=2,
            extra={"momentSound": "hammer_tap", "moment": "ladder"}),
        Son("tit-call", "Mésange bleue: « tsi-tsi-tsi » (fin de l'échelle, t = 7,8 s)", m, "effects", _mesange_cri, 3,
            -26.0, 2, 0.03, 1.0, "faune-12", intervalle_min_ms=600, voix_max=1,
            extra={"momentSound": "tit_call", "moment": "ladder"}),
        # Mésanges du nichoir
        Son("tit-song", "Mésange bleue: chant « tsi-tsi-tsuhuhuhu » (attente toutes les 8 s; apogée, t = 1,9 s)", m, "effects",
            _mesange_chant, 3, -25.0, 3, 0.03, 1.0, "faune-12", intervalle_min_ms=2500, voix_max=1,
            extra={"momentSound": "tit_song", "moment": "tits"}),
        Son("tit-wings", "Mésange: froissement d'ailes à l'envol ou au posé (apogée, t = 4,3 s)", m, "effects", _mesange_ailes, 2, -31.0, 4,
            0.08, 1.5, "faune-12", intervalle_min_ms=300, voix_max=2,
            extra={"momentSound": "tit_wings", "moment": "tits"}),
        # Renard de la voie
        Son("fox-pounce", "Renard: il retombe à pieds joints dans l'herbe (mulotage, en attente)", m, "effects",
            _renard_saut, 2, -27.0, 3, 0.05, 1.0, "faune-12", intervalle_min_ms=1500, voix_max=1,
            extra={"momentSound": "fox_pounce", "moment": "fox"}),
        Son("fox-bark", "Renard: deux jappements rauques (apogée, t = 1 s)", m, "effects", _renard_jappe, 2, -21.0, 2,
            0.03, 1.0, "faune-25", voix_max=1, extra={"momentSound": "fox_bark", "moment": "fox"}),
        Son("hens-alarm", "Poules inquiètes dans le poulailler (apogée du renard, t = 1,2 s, si elles y sont)", m,
            "effects", _poules_alarme, 1, -23.0, 3, 0.04, 1.0, "moyen", voix_max=1,
            extra={"momentSound": "hens_alarm", "moment": "fox"}),
        # Vers luisants du pré
        Son("crickets-night", "Grillons champêtres du pré (boucle placée à meadow_glow)", m, "ambience",
            _grillons_pre, 1, -29.0, 3, 0.0, 0.0, "faune-20", boucle=True, passe_haut=200, voix_max=1,
            extra={"momentSound": "crickets_night", "moment": "glowworms", "waitingDb": -6.0, "climaxRampMs": 4000},
            note="en attente à -6 dB (waitingDb), à pleine force pendant l'apogée en 4 s (climaxRampMs)"),
        Son("glow-shimmer", "Vers luisants: quatre notes de célesta quand le pré s'allume (apogée, t = 0,5 s)", m, "music",
            _scintillement, 2, -22.0, 2, 0.0, 0.0, None, canaux=2, voix_max=1, queue_reverbe=(1.6, 0.3),
            extra={"momentSound": "glow_shimmer", "moment": "glowworms"},
            note="bus musique (fiche, question S3 réglée au tour 9): passe après la descente de l'apogée; non placé, "
                 "sans variation de hauteur (notes justes en sol majeur)"),
        # Chevrette du pré (tour 7)
        Son("roe-call", "Chevrette: appel doux et nasal à son faon (apogée, t = 0)", m, "effects", _chevrette_appel,
            2, -26.0, 2, 0.03, 1.0, "faune-15", voix_max=1, extra={"momentSound": "roe_call", "moment": "roe_deer"}),
        Son("fawn-rustle", "Faon: l'herbe haute frémit à son lit (apogée, t = 1,0 s)", m, "effects", _faon_herbe, 1,
            -29.0, 2, 0.04, 1.0, "faune-12", voix_max=1,
            extra={"momentSound": "fawn_rustle", "moment": "roe_deer"}),
        Son("fawn-bleat", "Faon: petit « mi » aigu en trottinant vers sa mère (apogée, t = 2,6 s)", m, "effects",
            _faon_mi, 2, -25.0, 2, 0.03, 1.0, "faune-12", voix_max=1,
            extra={"momentSound": "fawn_bleat", "moment": "roe_deer"}),
        Son("deer-stamp", "Chevrette effarouchée: elle frappe du pied (clip deer_stamp)", m, "effects",
            _chevrette_sabot, 1, -24.0, 2, 0.05, 1.0, "faune-20", intervalle_min_ms=1500, voix_max=1,
            extra={"momentSound": "deer_stamp", "moment": "roe_deer"},
            note="joué au début de l'effarouchement, roe-bark suit (un joueur a bougé pendant un regard)"),
        Son("roe-bark", "Chevrette effarouchée: aboiement d'alarme « bö » (après deer_stamp)", m, "effects",
            _chevrette_aboi, 2, -21.0, 2, 0.03, 1.0, "faune-30", intervalle_min_ms=1500, voix_max=1,
            extra={"momentSound": "roe_bark", "moment": "roe_deer"},
            note="audible à 30 m: il prévient aussi l'autre joueur que la chevrette a été dérangée"),
        Son("deer-bounds", "Chevrette et faon: deux bonds chacun vers la haie (apogée, t = 7,6 s)", m, "effects",
            _chevrette_bonds, 1, -25.0, 2, 0.03, 1.0, "faune-20", voix_max=1,
            extra={"momentSound": "deer_bounds", "moment": "roe_deer"}, note="placé à la chevrette, déplacé avec elle"),
        # Martin-pêcheur du ponton (tour 7)
        Son("kf-whistle", "Martin-pêcheur: sifflet aigu « tiiii » à chaque envol (attente; apogée, t = 4,1 s)", m,
            "effects", _martin_sifflet, 3, -25.0, 3, 0.03, 1.0, "faune-25", intervalle_min_ms=800, voix_max=1,
            extra={"momentSound": "kf_whistle", "moment": "kingfisher"},
            note="c'est lui qu'on entend avant de voir l'oiseau: audible à 25 m"),
        Son("kf-dive", "Martin-pêcheur: plongeon net (plongeons manqués en attente; apogée, t = 1,3 s)", m, "effects",
            _martin_plongeon, 2, -24.0, 2, 0.04, 1.0, "faune-20", intervalle_min_ms=1000, voix_max=1,
            extra={"momentSound": "kf_dive", "moment": "kingfisher"}),
        Son("kf-beat", "Martin-pêcheur: il assomme l'ablette contre le pieu, « tac tac » (apogée, t = 2,7 s)", m,
            "effects", _martin_frappe, 1, -26.0, 2, 0.03, 1.0, "faune-15", voix_max=1,
            extra={"momentSound": "kf_beat", "moment": "kingfisher"},
            note="un seul déclenchement à 2,7 s: le fichier contient les deux coups (2,7 et 3,2 s)"),
        # Brume de l'Aubrune (tour 7)
        Son("mist-ambience", "Brume: l'eau toute proche et feutrée, gouttes des herbes (boucle placée à mist_narrows)",
            m, "ambience", _brume_riviere, 1, -29.0, 3, 0.0, 0.0, "faune-20", boucle=True, passe_haut=100, voix_max=1,
            extra={"momentSound": "mist_ambience", "moment": "mist", "waitingDb": -6.0, "climaxRampMs": 3000},
            note="en attente à -6 dB (waitingDb), à pleine force en 3 s au début de l'apogée (climaxRampMs), "
                 "en même temps que la lumière se réchauffe"),
        Son("mist-lift", "Brume: accord ouvert qui monte, harpe et cordes douces (apogée, t = 1,5 s)", m, "music",
            _brume_leve, 2, -22.0, 2, 0.0, 0.0, None, canaux=2, voix_max=1, duree_max=4.6,
            extra={"momentSound": "mist_lift", "moment": "mist"},
            note="bus musique (fiche, question S3 réglée au tour 9): passe après la descente de l'apogée; non placé, "
                 "sans variation de hauteur (sol et do majeur)"),
        Son("blackbird-wake", "Brume: un merle chante dans les arbres de la rive nord (apogée, t = 3,0 s)", m, "effects",
            _merle, 3, -26.0, 2, 0.02, 1.0, None, voix_max=1, queue_reverbe=(1.2, 0.22),
            extra={"momentSound": "blackbird_wake", "moment": "mist"},
            note="non localisé (fiche): les deux joueurs l'entendent pareil, chacun sur sa rive"),
        Son("fish-jump", "Brume: un poisson saute entre les deux rives (apogée, t = 5,2 s, en 29,0 ; 40,4)", m,
            "effects", _poisson_saut, 2, -25.0, 2, 0.04, 1.0, "faune-20", voix_max=1,
            extra={"momentSound": "fish_jump", "moment": "mist"}),
        # Banc
        Son("bench-sit", "S'asseoir sur un banc de bois (événement sat_down)", "effets", "effects", _banc_assise, 3,
            -26.0, 3, 0.05, 1.0, "pres", intervalle_min_ms=150, voix_max=2),
    ]
