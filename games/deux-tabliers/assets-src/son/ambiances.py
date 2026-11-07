"""Ambiances du café d'Ormeval: rumeur de la salle sans paroles, place du Tilleul (matin, fin
d'après-midi), pluie, pièce, pendule, réfrigérateur (son.md, 8.3).

La rumeur (son.md, 8.3.6) n'a ni mots, ni voyelles, ni hauteur de voix: un souffle filtré entre
150 Hz et 1,5 kHz, modulé au rythme de la parole (3 à 6 Hz) par phrases de 1 à 3 s, en alternance
entre deux « interlocuteurs » de couleurs différentes, avec les tasses de la table.

Boucles sans couture: bruits périodiques (FFT), filtres dans le domaine fréquentiel, événements
posés sur une ligne de temps circulaire, modulations à nombre entier de cycles.
"""

from __future__ import annotations

import numpy as np

import dsp
import instruments as ins
import timbres as tb
from catalogue import SR_CLAIR, Son
from dsp import SR


def _formant(f0: float, largeur: float):
    """Gain en cloche (log-fréquence) pour filtre_circulaire: la « couleur » d'un interlocuteur."""
    def g(f: np.ndarray) -> np.ndarray:
        f = np.maximum(f, 1.0)
        cloche = np.exp(-0.5 * (np.log2(f / f0) / largeur) ** 2)
        bande = 1.0 / np.sqrt(1 + (150.0 / f) ** 4) / (1 + (f / 1500.0) ** 4) ** 0.5
        return bande * (0.35 + cloche)
    return g


def _enveloppe_parole(n: int, rng: np.random.Generator, debut: float, duree: float, rythme: float) -> np.ndarray:
    """Phrase sans mots: des bosses de syllabes à 3 à 6 Hz, d'amplitudes inégales, sur une ligne circulaire."""
    env = np.zeros(n)
    t = debut
    while t < debut + duree:
        d_syl = 1.0 / (rythme * rng.uniform(0.75, 1.3))
        m = dsp.n_ech(d_syl * 1.4)
        bosse = np.sin(np.pi * np.arange(m) / m) ** 1.5 * rng.uniform(0.35, 1.0)
        dsp.poser(env, bosse, t, circulaire=True)
        t += d_syl
    return env


def _table(rng: np.random.Generator, duree: float, rythme: float = 4.5, tasses: int = 2,
           couleurs: tuple[float, float] = (480.0, 760.0)) -> np.ndarray:
    n = dsp.n_ech(duree)
    y = np.zeros(n)
    voix = []
    for c in couleurs:
        bruit = dsp.bruit_spectral(n, rng, -3.0, 120, 3000)
        voix.append(dsp.filtre_circulaire(bruit, _formant(c * rng.uniform(0.92, 1.08), 0.6)))
    t = rng.uniform(0, duree)
    k = 0
    fin = t + duree
    while t < fin - 0.3:
        d = rng.uniform(1.0, 3.0)
        env = _enveloppe_parole(n, rng, t, d, rythme)
        y += voix[k % 2] * env * (1.0 if k % 2 == 0 else 0.8)
        t += d + rng.uniform(-0.2, 0.4)
        k += 1
    for _ in range(tasses):
        dsp.poser(y, tb.porcelaine(rng, rng.uniform(1400, 1900), 0.3, 0.2, mat=0.3) * 0.05, rng.uniform(0, duree),
                  circulaire=True)
    dsp.poser(y, tb.cuillere(rng, 2600, 0.12) * 0.03, rng.uniform(0, duree), circulaire=True)
    return y


def _convolution_circulaire(x: np.ndarray, rng: np.random.Generator, rt60: float = 0.45) -> np.ndarray:
    """Une salle autour de la rumeur, par convolution circulaire (la boucle reste périodique)."""
    n = len(x)
    m = dsp.n_ech(rt60 * 1.2)
    ir = np.zeros(n)
    ir[:m] = rng.standard_normal(m) * np.exp(-6.9 * np.arange(m) / SR / rt60)
    ir[0] += 6.0
    y = np.fft.irfft(np.fft.rfft(x) * np.fft.rfft(ir), n)
    return y


def _salle(rng: np.random.Generator, tables: int, rythme: float) -> np.ndarray:
    d = 10.0
    y = np.zeros(dsp.n_ech(d))
    for k in range(tables):
        y += _table(rng, d, rythme * rng.uniform(0.85, 1.15), 1, (rng.uniform(420, 560), rng.uniform(650, 850))) \
            * rng.uniform(0.5, 1.0)
    return _convolution_circulaire(y, rng)


# --- La place du Tilleul ---------------------------------------------------------------------

def _fontaine(rng: np.random.Generator, duree: float) -> np.ndarray:
    n = dsp.n_ech(duree)
    eau = tb.souffle(rng, duree, 300, 5000, boucle=True, pente=-3.0) * 0.4
    bul = tb.bulles(rng, duree, 500, 500, 2500, 0.004, True) * 0.7
    return (eau + bul) * tb.modulation(n, rng, [(int(duree), 1.0), (int(duree * 2.3), 0.4)], 0.8)


def _feuilles(rng: np.random.Generator, duree: float, force: float) -> np.ndarray:
    n = dsp.n_ech(duree)
    x = tb.souffle(rng, duree, 900, 6000, boucle=True, pente=-2.0)
    return dsp.circ(lambda z: tb.doux(z, 6000), x) * tb.modulation(n, rng, [(1, 1.0), (3, 0.5)], 0.3) * force


def _piaillement(rng: np.random.Generator) -> np.ndarray:
    """Un « tchip » de moineau: glissando descendant bref."""
    d = rng.uniform(0.035, 0.07)
    n = dsp.n_ech(d)
    f = np.linspace(rng.uniform(3800, 4800), rng.uniform(2600, 3300), n)
    return dsp.sinus_glisse(f) * np.sin(np.pi * np.arange(n) / n) ** 2


def _moineaux(rng: np.random.Generator, duree: float, densite: float, boucle: bool) -> np.ndarray:
    return dsp.grains(duree, densite, lambda r: _piaillement(r) * r.uniform(0.2, 1.0), rng, circulaire=boucle)


def _nappe_place(rng: np.random.Generator, soir: bool) -> np.ndarray:
    d = 12.0
    n = dsp.n_ech(d)
    y = _fontaine(rng, d) * (0.8 if soir else 1.0)
    y += _feuilles(rng, d, 0.25 if soir else 0.35)
    y += tb.souffle(rng, d, 90, 700, boucle=True, pente=-6.0) * (0.35 if soir else 0.25)  # la vallée au loin
    oiseaux = _moineaux(rng, d, 1.5 if soir else 5.0, True)
    y += dsp.filtre_circulaire(oiseaux, lambda f: 1 / np.sqrt(1 + (f / 4000.0) ** 2)) * (0.05 if soir else 0.08)
    return y


def _moineaux_evt(v: int, rng: np.random.Generator) -> np.ndarray:
    d = 2.0
    y = dsp.toile(d)
    t = rng.uniform(0, 0.1)
    while t < d - 0.15:
        dsp.poser(y, _piaillement(rng) * rng.uniform(0.4, 1.0), t)
        t += rng.uniform(0.08, 0.3)
    return y


def _merle(v: int, rng: np.random.Generator) -> np.ndarray:
    """Une phrase de merle: sifflements flûtés qui glissent, puis un petit gazouillis final."""
    d = 2.5
    y = dsp.toile(d)
    t = 0.0
    for k in range(rng.integers(4, 7)):
        du = rng.uniform(0.12, 0.32)
        n = dsp.n_ech(du)
        f0, f1 = rng.uniform(1700, 2600), rng.uniform(1600, 2800)
        f = np.linspace(f0, f1, n) * (1 + 0.02 * np.sin(2 * np.pi * 28 * np.arange(n) / SR))
        note_ = dsp.sinus_glisse(f) * np.sin(np.pi * np.arange(n) / n) ** 1.2
        note_ += 0.15 * dsp.sinus_glisse(2 * f) * np.sin(np.pi * np.arange(n) / n) ** 2
        dsp.poser(y, note_ * rng.uniform(0.5, 1.0), t)
        t += du + rng.uniform(0.04, 0.12)
    for k in range(5):
        dsp.poser(y, _piaillement(rng) * 0.3, t + 0.05 * k)
    return y


def _mobylette(v: int, rng: np.random.Generator) -> np.ndarray:
    """Une mobylette passe au loin: moteur deux temps, effet Doppler, filtré par la distance."""
    d = 4.0
    n = dsp.n_ech(d)
    t = np.arange(n) / SR
    pos = (t - d / 2) * 9.0  # 9 m/s, passe au plus près à 25 m
    dist = np.sqrt(pos ** 2 + 25.0 ** 2)
    vitesse_rad = np.gradient(dist) * SR
    f0 = 95 * (1 - vitesse_rad / 343.0)
    y = tb.moteur(n, f0, rng, 14, 0.82, f_max=2400)
    y += dsp.pbande(rng.standard_normal(n), 300, 2500) * 0.4
    y = dsp.pb(y, 2200, 2) * (25.0 / dist)
    return y * dsp.env_ar(n, 0.4, 0.4)


def _boulangerie(v: int, rng: np.random.Generator) -> np.ndarray:
    """La porte de la boulangerie d'en face, de l'autre côté de la ruelle: son grelot (sol), au loin."""
    y = dsp.toile(1.6)
    dsp.poser(y, tb.bois(rng, 260, 0.3, 0.4) * 0.5, 0.0)
    dsp.poser(y, tb.clochette_ressort(rng, tb.note("G5"), 1.4, 3) * 0.8, 0.02)
    return dsp.pb(y, 3000, 2)


def _car_departemental(v: int, rng: np.random.Generator) -> np.ndarray:
    """Le car départemental vers Mérelles s'arrête devant la fontaine: moteur diesel, soupir des
    freins à air (adouci), et repart."""
    d = 6.0
    n = dsp.n_ech(d)
    regime = np.interp(np.arange(n) / SR, [0, 1.5, 2.4, 3.8, 4.6, 6.0], [70, 55, 42, 42, 60, 75])
    y = tb.moteur(n, regime, rng, 16, 0.85, f_max=1500) * 0.6
    y += dsp.pbande(rng.standard_normal(n), 150, 1200) * 0.25
    niveau = np.interp(np.arange(n) / SR, [0, 1.5, 2.4, 3.8, 6.0], [0.3, 0.8, 0.6, 0.7, 0.25])
    y = y * niveau
    m = dsp.n_ech(0.6)
    soupir = dsp.pbande(rng.standard_normal(m), 600, 3500) * dsp.env_points(m, [(0, 0), (0.03, 1), (0.6, 0)]) * 0.2
    dsp.poser(y, soupir, 2.45)
    return dsp.ph(dsp.pb(y, 2500, 2), 120, 2) * dsp.env_ar(n, 0.6, 0.8)


def _cloche_eglise(v: int, rng: np.random.Generator) -> np.ndarray:
    """Un coup de la cloche de l'église (sud de la place), sol: au loin, sans hum lourd."""
    y = tb.cloche(rng, tb.note("G4"), 4.0, 2.6)
    return dsp.pb(y, 3500, 2)


# --- Pluie -----------------------------------------------------------------------------------

def _pluie_rue(rng: np.random.Generator) -> np.ndarray:
    d = 8.0
    n = dsp.n_ech(d)
    nappe = tb.souffle(rng, d, 400, 9000, boucle=True, pente=-2.0) * 0.4
    gouttes = tb.impulsions_boucle(rng, d, 2500, 1200, 8000, 0.003) * 0.5
    flaques = tb.bulles(rng, d, 120, 700, 2200, 0.004, True) * 0.4
    y = nappe * tb.modulation(n, rng, [(1, 1.0), (2, 0.4)], 0.8) + gouttes + flaques
    return dsp.circ(lambda z: tb.doux(z, 6000), y)


def _pluie_vitre(rng: np.random.Generator) -> np.ndarray:
    d = 8.0
    n = dsp.n_ech(d)
    # Du dedans: la pluie de la rue étouffée par la vitrine, plus les gouttes sur le verre.
    rue = dsp.filtre_circulaire(tb.souffle(rng, d, 200, 6000, boucle=True, pente=-3.0),
                                lambda f: 1 / np.sqrt(1 + (f / 1200.0) ** 4)) * 0.6
    sur_le_verre = dsp.grains(d, 140, lambda r: tb.verre(r, r.uniform(2200, 3600), 0.03, 0.02) * r.uniform(0.1, 0.6),
                              rng, circulaire=True)
    ruisselle = tb.bulles(rng, d, 30, 400, 1000, 0.01, True) * 0.25
    return rue + dsp.circ(lambda z: tb.doux(z, 5000), sur_le_verre) * 0.35 + ruisselle


# --- La pièce, la pendule, le réfrigérateur -------------------------------------------------------

def _piece(rng: np.random.Generator) -> np.ndarray:
    d = 6.0
    n = dsp.n_ech(d)
    return tb.souffle(rng, d, 100, 1500, boucle=True, pente=-6.0) * tb.modulation(n, rng, [(1, 1.0)], 0.85)


def _tictac(rng: np.random.Generator) -> np.ndarray:
    """Pendule de bois: tic à 0,5 s, tac à 1,5 s (attaques à égale distance du raccord)."""
    y = dsp.toile(2.0)
    for t, f in ((0.5, 1900), (1.5, 1600)):
        dsp.poser(y, ins.metal(rng, f, 0.08, 0.03) * 0.5, t)
        dsp.poser(y, tb.bois(rng, 520 if t < 1 else 470, 0.08, 0.5, t60=0.03) * 0.6, t)
    return y


def _carillon_pendule(v: int, rng: np.random.Generator) -> np.ndarray:
    """La pendule sonne midi et la dernière heure du service: quatre notes (ré, la, do, sol), aucun
    carillon connu; petite cloche douce."""
    y = dsp.toile(3.0)
    for k, nom in enumerate(["D5", "A4", "C5", "G4"]):
        dsp.poser(y, tb.cloche(rng, tb.note(nom) * 2, 2.2, 1.4) * (0.9 if k < 3 else 1.0), 0.45 * k)
    return y


def _frigo(rng: np.random.Generator) -> np.ndarray:
    d = 3.0
    n = dsp.n_ech(d)
    hum = tb.boucle_moteur(rng, d, 100, 10, 0.7)
    hum = dsp.circ(lambda z: dsp.pbande(z, 150, 1200), hum)
    return hum * 0.5 + tb.souffle(rng, d, 200, 2000, boucle=True, pente=-5.0) * 0.3


def sons() -> list[Son]:
    Sa, Ad, Pl, Re = "base/salle", "adresses/village", "moments/pluie", "base/reserve"
    return [
        Son("murmur-table", "Rumeur d'une table: conversation sans mots, avec ses tasses", Sa, "ambience",
            lambda v, r: _table(r, 6.0, [4.2, 4.8, 3.8, 5.4][v], 2, [(470, 720), (520, 800), (440, 680), (500, 760)][v]),
            4, -36, 4, 0.05, spatial="table", boucle=True, passe_haut=120,
            note="une boucle par table d'au moins deux clients, six au plus, départ tiré, vitesse plus ou moins 5 %"),
        Son("murmur-room-calm", "Nappe de salle, peu de monde (3 à 7 clients)", Sa, "ambience",
            lambda v, r: _salle(r, 3, 4.0), sonie=-38, priorite=4, hauteur=0.0, spatial=None, boucle=True,
            passe_haut=120, note="jouée deux fois (gauche, droite), décalée de 5 s"),
        Son("murmur-room-busy", "Nappe de salle, bien remplie (7 à 12 clients)", Sa, "ambience",
            lambda v, r: _salle(r, 6, 4.5), sonie=-35, priorite=4, hauteur=0.0, spatial=None, boucle=True,
            passe_haut=120, note="jouée deux fois (gauche, droite), décalée de 5 s"),
        Son("murmur-room-rush", "Nappe de salle, coup de feu (12 clients et plus)", Sa, "ambience",
            lambda v, r: _salle(r, 12, 5.0), sonie=-33, priorite=4, hauteur=0.0, spatial=None, boucle=True,
            passe_haut=120, note="plafond: toute la rumeur sous -28 LUFS en momentanée (son.md, 8.3.6)"),
        Son("ext-village-morning", "La place du Tilleul le matin: fontaine, tilleul, moineaux au loin", Ad, "ambience",
            lambda v, r: _nappe_place(r, False), sonie=-34, priorite=4, hauteur=0.0, spatial=None, boucle=True,
            passe_haut=80, note="dedans: sort de la porte et des vitrines (plan.doorFilter); dehors: doublée gauche et "
                                "droite, décalée de 6 s"),
        Son("ext-village-evening", "La place du Tilleul en fin d'après-midi: plus calme, la vallée au loin", Ad,
            "ambience", lambda v, r: _nappe_place(r, True), sonie=-35, priorite=4, hauteur=0.0, spatial=None,
            boucle=True, passe_haut=80),
        Son("ext-village-sparrows", "Moineaux sur la place", Ad, "ambience", _moineaux_evt, 3, -32, 4, 0.04,
            spatial="rue", sr=SR_CLAIR),
        Son("ext-village-blackbird", "Le merle chante dans le tilleul (surtout le soir)", Ad, "ambience", _merle, 2, -33,
            4, 0.04, spatial="rue", sr=SR_CLAIR),
        Son("ext-village-moped", "Une mobylette passe au loin", Ad, "ambience", _mobylette, 1, -34, 4, 0.04,
            spatial="rue", passe_haut=100),
        Son("ext-village-bakery-door", "La porte de la boulangerie d'en face et son grelot (sol)", Ad, "ambience",
            _boulangerie, 1, -33, 4, 0.0, spatial="rue"),
        Son("ext-village-coach", "Le car départemental s'arrête devant la fontaine et repart", Ad, "ambience",
            _car_departemental, 1, -33, 4, 0.03, spatial="rue"),
        Son("ext-village-church-bell", "Un coup de la cloche de l'église (midi: douze coups, un toutes les 1,6 s)", Ad,
            "ambience", _cloche_eglise, 1, -30, 3, 0.0, spatial="rue", sr=SR_CLAIR, voix_max=2,
            note="hauteur fixe (sol)"),
        Son("room-village", "La pièce: souffle de la salle vide (poutres et tomettes)", Ad, "ambience",
            lambda v, r: _piece(r), sonie=-48, priorite=4, hauteur=0.0, spatial=None, boucle=True, passe_haut=80),
        Son("clock-tick-village", "Pendule: le tic-tac", Ad, "ambience", lambda v, r: _tictac(r), sonie=-44,
            priorite=4, hauteur=0.0, spatial="pendule", boucle=True),
        Son("clock-chime-village", "Pendule: midi et la dernière heure du service (ré, la, do, sol)", Ad, "effects",
            _carillon_pendule, 1, -23, 2, 0.0, spatial="signal", sr=SR_CLAIR, note="hauteur fixe"),
        Son("fridge-hum-loop", "Le vieux réfrigérateur ronronne", Re, "ambience", lambda v, r: _frigo(r), sonie=-44,
            priorite=4, hauteur=0.0, spatial="pendule", boucle=True, passe_haut=120),
        Son("rain-street", "Pluie dans la rue (dehors, et par la porte ouverte)", Pl, "ambience",
            lambda v, r: _pluie_rue(r), sonie=-32, priorite=4, hauteur=0.0, spatial=None, boucle=True),
        Son("rain-glass", "Pluie sur les vitrines, du dedans", Pl, "ambience", lambda v, r: _pluie_vitre(r), sonie=-37,
            priorite=4, hauteur=0.0, spatial="vitrine", boucle=True),
    ]
