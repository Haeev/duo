"""Sons d'Aubrune, troisième lot: la draisine, les applaudissements des villageois après un air
joué, l'épuisette de la pêche à deux, l'avertissement d'un train qui approche.

Même couleur que les lots précédents (bois, fer doux, eau, voix lointaines), même chaîne: chaque
fabrique rend un tableau mono à 48 kHz que `generer.ecrire` normalise et encode.

Roulements tenus (`draisine-roulement-*`): le corps de boucle est calculé de façon circulaire
(bruit périodique, coups posés en boucle), puis le fichier est écrit « amorce + corps + suite »:
`AMORCE` s de fin de corps avant, `SUITE` s de début de corps après. Le moteur lit le fichier
depuis 0 puis reprend de `loop.from` = AMORCE à `loop.to` = AMORCE + durée du corps (sons.json):
les échantillons de part et d'autre du raccord sont ceux de la lecture continue.
"""

from __future__ import annotations

from typing import Callable

import numpy as np

import dsp
from dsp import SR, env_ar, env_exp, n_ech, modes, poser, toile
from sons_aubrune import bois, de_loin, hz

AMORCE = 0.3
SUITE = 0.25


def craquement(g: np.random.Generator, duree: float, cadence: tuple[float, float],
               corps: tuple[float, ...], q: float = 9.0) -> np.ndarray:
    """Grincement par adhérence et glissement: un train d'impulsions dont la cadence glisse
    (cadence de début, de fin, en Hz), chacune excitant les résonances du bois ou du fer."""
    n = n_ech(duree)
    t = np.arange(n) / SR
    taux = np.interp(t, [0, duree], list(cadence)) * (1 + 0.06 * np.sin(2 * np.pi * g.uniform(5, 9) * t))
    phase = np.cumsum(taux) / SR
    coups = np.flatnonzero(np.diff(np.floor(phase)) > 0)
    x = np.zeros(n)
    x[coups] = g.uniform(0.5, 1.0, len(coups))
    y = sum(dsp.resonateur(x, f * g.uniform(0.97, 1.03), q) * (0.8 ** k) for k, f in enumerate(corps))
    y = y + dsp.pbande(x, 1500, 5000) * 0.15
    return y / (np.max(np.abs(y)) + 1e-12)  # crête à 1: les gains des appelants se comparent


def ferraille(g: np.random.Generator, f: float, t60: float) -> np.ndarray:
    """Petite pièce de fonte frappée (bielle, palier): partiels inharmoniques, vite éteints."""
    y = modes(n_ech(t60 * 1.3), [(f, 1.0, t60), (f * 2.71, 0.5, t60 * 0.6), (f * 5.2, 0.18, t60 * 0.35)], g, 0.0006)
    return dsp.fondu(y, 0.0, t60 * 0.3)


# --- Draisine ------------------------------------------------------------------------------------

def draisine_balancier(g: np.random.Generator) -> np.ndarray:
    # Un coup de pompe: le bras de bois grince sur son palier, puis la bielle de fer cogne doucement
    # en bout de course. Léger: il revient à chaque coup.
    y = toile(0.42)
    duree = g.uniform(0.17, 0.24)
    debut, fin = g.uniform(55, 75), g.uniform(95, 130)
    corps = (g.uniform(560, 700), g.uniform(1150, 1400), g.uniform(2100, 2500))
    poser(y, craquement(g, duree, (debut, fin), corps) * env_ar(n_ech(duree), 0.04, 0.09) * 0.8, 0.0)
    poser(y, ferraille(g, g.uniform(410, 470), 0.09) * 0.2, duree - 0.01)
    poser(y, bois(g, g.uniform(240, 290), 0.12, 0.05, 0.2) * 0.2, duree - 0.005)
    return dsp.pb(y, 7000)


def draisine_bloque(g: np.random.Generator) -> np.ndarray:
    # Les deux poussent ensemble: le balancier ne bouge pas. Un choc sourd et rond, un court
    # gémissement du bois, sans claquement.
    y = toile(0.5)
    poser(y, bois(g, 235, 0.35, 0.14, 0.1), 0.0)
    poser(y, ferraille(g, 330, 0.16) * 0.45, 0.003)
    n = n_ech(0.16)
    poser(y, craquement(g, 0.16, (45, 30), (420, 900), 7.0) * env_ar(n, 0.02, 0.1) * 0.25, 0.02)
    return dsp.pb(y, 2400)


def coup_de_joint(g: np.random.Generator, force: float) -> np.ndarray:
    """Une roue qui passe un joint de rail: tic du fer, cognement du plancher de bois."""
    y = toile(0.2)
    poser(y, modes(n_ech(0.12), [(g.uniform(1650, 1950), 1.0, 0.05), (g.uniform(2900, 3300), 0.45, 0.03),
                                 (g.uniform(4500, 5000), 0.15, 0.015)], g, 0.0003) * 0.45, 0.0)
    poser(y, dsp.clic(g, 1200, 6000, 0.004, 0.001) * 0.5, 0.0)
    poser(y, bois(g, g.uniform(200, 235), 0.18, 0.07, 0.15) * 0.9, 0.002)
    return y * force


# Trois allures: (durée du corps en s, période entre deux joints en s, écart entre les deux essieux
# en s, niveau du roulement, hauteur du chant des roues en Hz). Joints tous les 6 m, essieux à 1,4 m:
# lente 2,4 m/s, moyenne 6 m/s, rapide 8 m/s (la pointe de la fiche).
ALLURES = {
    "lente": (5.0, 2.5, 0.58, 0.55, 760.0),
    "moyenne": (3.0, 1.0, 0.233, 0.8, 980.0),
    "rapide": (3.0, 0.75, 0.175, 1.0, 1180.0),
}


def corps_roulement(g: np.random.Generator, allure: str) -> np.ndarray:
    duree, periode, ecart, niveau, chant = ALLURES[allure]
    n = n_ech(duree)
    t = np.arange(n) / SR
    # Rotation des roues (0,35 m de diamètre): petite modulation, nombre entier de tours par boucle.
    tours = max(1, round(duree * (6.0 / periode) / 1.1))
    rotation = 1 + 0.12 * np.sin(2 * np.pi * tours * t / duree)
    # Grondement au-dessus de 110 Hz: plus bas, il ne passerait pas un haut-parleur de portable.
    fond = dsp.bruit_spectral(n, g, -4, 110, 2400) * rotation * niveau * 0.09
    sifflement = dsp.bruit_spectral(n, g, -1, 2400, 6500) * niveau ** 2 * 0.012
    f = round(chant * duree) / duree
    vib = round(3 * duree) / duree
    chante = np.sin(2 * np.pi * f * t + 0.4 * np.sin(2 * np.pi * vib * t)) * niveau ** 2 * 0.006
    y = fond + sifflement + chante
    rail = toile(duree)
    for i in range(int(round(duree / periode))):
        t0 = 0.4 * periode + i * periode
        poser(rail, coup_de_joint(g, 1.0), t0, circulaire=True)
        poser(rail, coup_de_joint(g, 0.7), t0 + ecart, circulaire=True)
    return y + rail * (0.55 + 0.45 * niveau)


def roulement_tenu(g: np.random.Generator, allure: str) -> np.ndarray:
    corps = corps_roulement(g, allure)
    y = np.concatenate([corps[-n_ech(AMORCE):], corps, corps[:n_ech(SUITE)]])
    # Il s'ébranle: l'amorce monte en douceur (hors de la partie qui boucle).
    y[:n_ech(AMORCE)] *= np.linspace(0.0, 1.0, n_ech(AMORCE)) ** 1.5
    return y


def draisine_roulement_lente(g: np.random.Generator) -> np.ndarray:
    return roulement_tenu(g, "lente")


def draisine_roulement_moyenne(g: np.random.Generator) -> np.ndarray:
    return roulement_tenu(g, "moyenne")


def draisine_roulement_rapide(g: np.random.Generator) -> np.ndarray:
    return roulement_tenu(g, "rapide")


def draisine_joint(g: np.random.Generator) -> np.ndarray:
    # Un essieu sur un joint de rail (pour une brique qui compterait les mètres parcourus).
    return coup_de_joint(g, 1.0)


def draisine_frein(g: np.random.Generator) -> np.ndarray:
    # Le levier tombe, le patin de bois frotte la roue et la ralentit: frottement qui descend,
    # chant léger du fer, sans crissement aigu.
    duree = 1.2
    y = toile(duree)
    poser(y, ferraille(g, 520, 0.08) * 0.2, 0.0)
    poser(y, bois(g, 260, 0.12, 0.05, 0.3) * 0.15, 0.0)
    m = n_ech(1.05)
    frotte = craquement(g, 1.05, (140, 55), (850, 1650, 2600), 6.0)
    frotte += dsp.pbande(g.standard_normal(m), 700, 3000) * 0.08
    poser(y, frotte * dsp.env_points(m, [(0, 0), (0.06, 0.8), (0.5, 0.6), (1.05, 0)]) * 0.9, 0.04)
    tt = np.arange(m) / SR
    chant = dsp.sinus_glisse(1240 - 120 * tt) * dsp.env_points(m, [(0, 0), (0.15, 0.012), (0.7, 0.009), (1.0, 0)])
    poser(y, chant, 0.04)
    return dsp.pb(y, 4500)


def draisine_butee(g: np.random.Generator) -> np.ndarray:
    # Arrivée en bout de voie, au pas: le tampon de bois touche la butée, la fonte sonne un peu,
    # petit rebond, la caisse se pose.
    y = toile(0.65)
    poser(y, bois(g, 225, 0.45, 0.2, 0.25), 0.0)
    poser(y, ferraille(g, 610, 0.28) * 0.4, 0.004)
    poser(y, bois(g, 245, 0.3, 0.12, 0.15), 0.19, 0.35)
    for k, t0 in enumerate(np.sort(g.uniform(0.05, 0.45, 6))):
        poser(y, dsp.clic(g, 1500, 6000, 0.004, 0.0012) * 0.25 * 0.8 ** k, float(t0))
    return dsp.pb(y, 5000)


def draisine_avertissement(g: np.random.Generator) -> np.ndarray:
    # Un train s'annonce: le sifflet de la rame, de loin (sol et ré ensemble, comme à l'arrivée en
    # gare), un long puis un court. Il dit « rentrez », sans alarme.
    duree = 3.6
    y = toile(duree)
    for t0, long_ in ((0.05, 0.95), (1.3, 0.38)):
        n = n_ech(long_)
        tt = np.arange(n) / SR
        souffle = env_ar(n, 0.07, min(0.25, long_ * 0.5))
        for m, a in ((79, 1.0), (74, 0.8)):
            f = hz(m) * (1 - 0.015 * np.exp(-tt / 0.05))
            note = (dsp.sinus_glisse(f) + 0.25 * dsp.sinus_glisse(2 * f) + 0.08 * dsp.sinus_glisse(3 * f)) * souffle
            poser(y, note * a * 0.35, t0)
        poser(y, dsp.pbande(g.standard_normal(n), 1500, 5000) * souffle * 0.03, t0)
    return dsp.fondu(de_loin(y, 2.4, 0.5, 4500, 53)[:n_ech(duree)], 0.0, 0.4)


# --- Applaudissements des villageois (fin d'un air joué) ---------------------------------------

def claquement(g: np.random.Generator, f: float, q: float) -> np.ndarray:
    """Deux mains: souffle bref coloré par le creux des paumes (une résonance par personne)."""
    n = n_ech(0.035)
    x = g.standard_normal(n) * env_exp(n, g.uniform(0.004, 0.008), 0.0003)
    return dsp.resonateur(x, f * g.uniform(0.96, 1.04), q) * 1.6 + dsp.pbande(x, 600, 7000) * 0.35


def foule(g: np.random.Generator, personnes: int, duree: float, cadence: float, montee: float,
          tenue: float) -> np.ndarray:
    """Petit groupe qui applaudit: chacun son timbre et sa cadence, départs étalés sur `montee`,
    arrêts étalés entre `tenue` et la fin."""
    y = toile(duree + 0.2)
    for _ in range(personnes):
        f, q = g.uniform(800, 2300), g.uniform(1.5, 4.0)
        pas_ = 1 / g.uniform(cadence * 0.85, cadence * 1.15)
        niveau = g.uniform(0.5, 1.0)
        t = g.uniform(0.0, montee)
        fin = g.uniform(tenue, duree)
        while t < fin:
            elan = min(1.0, 0.5 + t / max(montee, 0.05)) * (1 - 0.5 * max(0.0, t - tenue) / max(duree - tenue, 0.1))
            poser(y, claquement(g, f, q), t, niveau * elan * g.uniform(0.8, 1.0))
            t += pas_ * g.uniform(0.92, 1.08)
    return y


def voix(g: np.random.Generator, f0: float, duree: float, voyelles: list[tuple[float, float, float, float]],
         contour: list[tuple[float, float]], roule: tuple[float, float] | None = None) -> np.ndarray:
    """Une voix criée, sans paroles: source glottique (harmoniques en 1/k^1,3) filtrée par trois
    formants qui glissent d'une voyelle à l'autre. `voyelles`: (instant, F1, F2, F3);
    `contour`: (instant, facteur de hauteur); `roule`: début et fin d'un r roulé."""
    n = n_ech(duree)
    t = np.arange(n) / SR
    fe = f0 * np.interp(t, [c[0] for c in contour], [c[1] for c in contour])
    fe *= 1 + 0.004 * np.sin(2 * np.pi * 5.5 * t) + 0.003 * dsp.pb(g.standard_normal(n), 30) * 8
    phase = 2 * np.pi * np.cumsum(fe) / SR
    source = np.zeros(n)
    for k in range(1, int(4500 / f0) + 1):
        source += np.sin(k * phase) / k ** 1.3 * (fe * k < 5000)
    instants = [v[0] for v in voyelles]
    sortie = np.zeros(n)
    for i, (gain, q) in enumerate(((1.0, 6.0), (0.6, 9.0), (0.25, 12.0))):
        valeurs = [v[i + 1] for v in voyelles]
        sortie += dsp.pb_variable(source, lambda s, v=valeurs: float(np.interp(s, instants, v)),
                                  type_="band", q_bande=q) * gain
    if roule is not None:
        r0, r1 = roule
        dans = (t >= r0) & (t < r1)
        sortie[dans] *= 0.55 + 0.45 * np.sin(2 * np.pi * 26 * (t[dans] - r0))
    return sortie * env_ar(n, 0.03, duree * 0.35)


def bravo(g: np.random.Generator, f0: float) -> np.ndarray:
    # « bra-vo » de loin: lèvres fermées, r roulé, a ouvert, v, o rond; la hauteur monte puis tombe.
    d = g.uniform(0.55, 0.65)
    return voix(g, f0, d,
                [(0.0, 300, 900, 2300), (0.05, 400, 1100, 2400), (0.1, 750, 1250, 2600), (0.27, 720, 1200, 2550),
                 (0.33, 380, 900, 2300), (0.38, 470, 850, 2450), (d, 450, 820, 2400)],
                [(0.0, 0.95), (0.12, 1.25), (0.3, 1.2), (0.38, 1.05), (d, 0.85)], roule=(0.04, 0.09))


def aah(g: np.random.Generator, f0: float) -> np.ndarray:
    # Un « ah ! » ravi qui retombe.
    d = g.uniform(0.45, 0.6)
    return voix(g, f0, d, [(0.0, 700, 1200, 2600), (d, 680, 1150, 2500)],
                [(0.0, 1.05), (0.08, 1.2), (d, 0.9)])


def applaudissements(g: np.random.Generator, personnes: int, duree: float, cadence: float,
                     cris: list[tuple[str, float, float]]) -> np.ndarray:
    y = foule(g, personnes, duree, cadence, 0.35, duree * 0.55)
    for genre, t0, f0 in cris:
        cri = bravo(g, f0) if genre == "bravo" else aah(g, f0)
        poser(y, cri * 0.22, t0)
    y = de_loin(y, 0.9, 0.22, 9000, 61)
    return dsp.fondu(y[:n_ech(duree + 0.6)], 0.0, 0.3)


def applaudissements_polis(g: np.random.Generator) -> np.ndarray:
    # Quelques personnes, quelques mains: merci, c'était gentil.
    return applaudissements(g, 5, 1.9, 3.6, [])


def applaudissements_chaleureux(g: np.random.Generator) -> np.ndarray:
    # Le petit groupe applaudit franchement, un « ah ! » ravi au milieu.
    return applaudissements(g, 8, 2.8, 4.2, [("aah", 0.35, 210.0)])


def applaudissements_enthousiastes(g: np.random.Generator) -> np.ndarray:
    # Tout le monde, vite et fort, deux « bravo » (une voix grave, une plus haute).
    return applaudissements(g, 11, 3.8, 5.0, [("bravo", 0.4, 150.0), ("aah", 1.0, 230.0), ("bravo", 1.65, 205.0)])


# --- Pêche à deux: l'épuisette ----------------------------------------------------------------------

def gerbe(g: np.random.Generator, duree: float, bas: float, haut: float, monte: float) -> np.ndarray:
    n = n_ech(duree)
    return dsp.pbande(g.standard_normal(n), bas, haut) * dsp.env_points(n, [(0, 0), (monte, 1.0), (duree, 0)])


def epuisette_plonge(g: np.random.Generator) -> np.ndarray:
    # L'épuisette plonge sous le poisson, remonte: l'eau ruisselle par les mailles, le poisson
    # frétille dans le filet (trois battements mouillés).
    y = toile(1.45)
    poser(y, gerbe(g, 0.3, 350, 4500, 0.02) * 0.7, 0.0)
    poser(y, dsp.bulle(g, 420, 0.03, 1.2) * 0.6, 0.01)
    poser(y, gerbe(g, 0.5, 800, 5000, 0.08) * 0.35, 0.42)
    for _ in range(18):
        poser(y, dsp.bulle(g, g.uniform(1400, 3400), g.uniform(0.005, 0.012)) * g.uniform(0.12, 0.3),
              g.uniform(0.45, 1.25))
    for k, t0 in enumerate((0.62, 0.8, 0.95)):
        poser(y, gerbe(g, 0.05, 600, 3200, 0.004) * 0.6 * 0.8 ** k, t0)
        poser(y, bois(g, 260, 0.06, 0.03, 0.0) * 0.15 * 0.8 ** k, t0)
    return y


def epuisette_rate(g: np.random.Generator) -> np.ndarray:
    # L'épuisette fouille l'eau à côté et ressort vide: un « flouch » plus mat, deux gouttes.
    y = toile(0.8)
    n = n_ech(0.4)
    remous = dsp.pb_variable(g.standard_normal(n), lambda s: 1800 - 2200 * s, type_="low")
    poser(y, remous * dsp.env_points(n, [(0, 0), (0.05, 1.0), (0.4, 0)]) * 0.6, 0.0)
    poser(y, dsp.bulle(g, 330, 0.035, 1.0) * 0.5, 0.02)
    poser(y, dsp.bulle(g, 520, 0.02, 0.8) * 0.3, 0.12)
    for t0 in (0.48, 0.66):
        poser(y, dsp.bulle(g, g.uniform(1500, 2300), 0.008) * 0.2, t0)
    return y


# --- Inventaire -----------------------------------------------------------------------------------

Fabrique = Callable[[np.random.Generator], np.ndarray]

# identifiant: (fabrique, nombre de variantes); une variante = un fichier `<id>-<n>.ogg`.
SONS: dict[str, tuple[Fabrique, int]] = {
    "draisine-balancier": (draisine_balancier, 3),
    "draisine-bloque": (draisine_bloque, 1),
    "draisine-roulement-lente": (draisine_roulement_lente, 1),
    "draisine-roulement-moyenne": (draisine_roulement_moyenne, 1),
    "draisine-roulement-rapide": (draisine_roulement_rapide, 1),
    "draisine-joint": (draisine_joint, 2),
    "draisine-frein": (draisine_frein, 1),
    "draisine-butee": (draisine_butee, 1),
    "draisine-avertissement": (draisine_avertissement, 1),
    "applaudissements-polis": (applaudissements_polis, 1),
    "applaudissements-chaleureux": (applaudissements_chaleureux, 1),
    "applaudissements-enthousiastes": (applaudissements_enthousiastes, 1),
    "epuisette-plonge": (epuisette_plonge, 1),
    "epuisette-rate": (epuisette_rate, 1),
}

# Sons tenus: (début, fin) de la partie qui boucle, en secondes dans le fichier.
BOUCLES = {
    f"draisine-roulement-{a}": (AMORCE, AMORCE + ALLURES[a][0]) for a in ALLURES
}


def fichiers() -> list[tuple[str, Fabrique]]:
    """Noms de fichiers (sans extension) et leur fabrique, variantes dépliées."""
    sortie = []
    for nom, (fab, k) in SONS.items():
        if k == 1:
            sortie.append((nom, fab))
        else:
            sortie.extend((f"{nom}-{i}", fab) for i in range(1, k + 1))
    return sortie
