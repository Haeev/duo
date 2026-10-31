"""Effets sonores de La Petite Ligne, synthétisés (numpy, scipy).

Chaque fabrique reçoit le numéro de variante et un générateur à graine, et rend un tableau mono
(sons placés dans le monde, pour le PannerNode) ou stéréo (interface). Les niveaux, fondus et
filtres finaux sont appliqués par generer.py: ici, seulement le timbre.
"""

from __future__ import annotations

import numpy as np

import dsp
import instruments as ins
from catalogue import Son
from dsp import SR

SOL5, LA5, SI5, DO6, RE6, MI6, SOL6 = (dsp.freq(n) for n in ("G5", "A5", "B5", "C6", "D6", "E6", "G6"))


# --- Pas -------------------------------------------------------------------------------------

def _pas(v: int, rng: np.random.Generator, sol: str) -> np.ndarray:
    duree = 0.28
    y = dsp.toile(duree)
    talon_pointe = rng.uniform(0.045, 0.075)
    for k, (t, force) in enumerate(((0.0, 1.0), (talon_pointe, rng.uniform(0.45, 0.65)))):
        if sol == "herbe":
            bruissement = ins.froissement(rng, 0.11, 1600, 6500, crepitement=rng.uniform(90, 160),
                                          attaque=0.004, relache=0.09) * 0.8
            bruissement *= dsp.env_exp(len(bruissement), 0.035, 0.003)
            brins = dsp.grains(0.11, 900, lambda r: dsp.clic(r, 2200, 7500, 0.003, 0.0007) * r.uniform(0.2, 0.6),
                               rng, enveloppe=lambda u: np.exp(-u / 0.025))
            sourd = ins.bruit_bref(rng, 0.08, 60, 220, 0.014) * 0.8
            dsp.poser(y, bruissement * force, t)
            dsp.poser(y, brins * force, t)
            dsp.poser(y, sourd * force, t)
        elif sol == "terre":
            sourd = ins.bruit_bref(rng, 0.10, 50, 320, 0.018) * 1.0
            crissement = dsp.grains(0.10, 1300, lambda r: dsp.clic(r, 900, 5000, 0.003, 0.0008) * r.uniform(0.15, 0.7),
                                    rng, enveloppe=lambda u: np.exp(-u / 0.035)) * 0.8
            dsp.poser(y, sourd * force, t)
            dsp.poser(y, crissement * force, t + 0.002)
        elif sol == "bois":
            f1 = rng.uniform(105, 145)
            coup = ins.bois(rng, f1, 0.22, durete=0.6, rapports=(1.0, 2.37, 4.6, 8.1), t60=0.11,
                            amps=(1.0, 0.6, 0.35, 0.15))
            coup = dsp.pb(coup, 3500)
            dsp.poser(y, coup * force, t)
            if v == 3 and k == 0:  # une latte qui grince un peu, sur une variante seulement
                grince = ins.crissement(rng, 0.16, lambda u: 70 + 120 * u, [(520, 9), (1150, 11)], 0.1)
                dsp.poser(y, grince * dsp.env_ar(len(grince), 0.03, 0.08) * 0.15, 0.03)
        elif sol == "pierre":
            claque = ins.bruit_bref(rng, 0.03, 1800, 9000, 0.0016, 0.0002) * 0.8
            toc = dsp.modes(dsp.n_ech(0.06), [(rng.uniform(850, 1050), 0.5, 0.03), (rng.uniform(1900, 2300), 0.35, 0.02),
                                             (rng.uniform(3000, 3600), 0.2, 0.015)], rng)
            sourd = ins.bruit_bref(rng, 0.05, 70, 240, 0.008) * 0.6
            gravier = dsp.grains(0.05, 600, lambda r: dsp.clic(r, 3000, 9000, 0.002, 0.0005) * r.uniform(0.1, 0.3), rng)
            dsp.poser(y, claque * force, t)
            dsp.poser(y, toc * force, t)
            dsp.poser(y, sourd * force, t)
            dsp.poser(y, gravier * force * 0.6, t + 0.004)
    return y


# --- Potager --------------------------------------------------------------------------------

def _becher(v: int, rng: np.random.Generator) -> np.ndarray:
    y = dsp.toile(0.6)
    lame = ins.bruit_bref(rng, 0.08, 1200, 5000, 0.022, 0.002) * 0.55
    sourd = ins.bruit_bref(rng, 0.2, 55, 300, 0.045, 0.002) * 1.1
    tinte = dsp.modes(dsp.n_ech(0.2), [(rng.uniform(2300, 2600), 0.04, 0.12), (rng.uniform(3700, 4100), 0.025, 0.08)], rng)
    mottes = dsp.grains(0.4, 140, lambda r: ins.bruit_bref(r, 0.02, 250, 1800, r.uniform(0.002, 0.005)) * r.uniform(0.2, 0.6),
                        rng, enveloppe=lambda u: np.exp(-u / 0.15)) * 0.5
    dsp.poser(y, lame, 0.0)
    dsp.poser(y, sourd, 0.004)
    dsp.poser(y, tinte, 0.0)
    dsp.poser(y, mottes, 0.07 + 0.02 * v)
    return y


def _semer(v: int, rng: np.random.Generator) -> np.ndarray:
    y = dsp.toile(0.65)
    sachet = ins.froissement(rng, 0.24, 2200, 8000, crepitement=rng.uniform(50, 90), attaque=0.03, relache=0.12) * 0.35
    dsp.poser(y, sachet, 0.0)
    nb = rng.integers(10, 18)
    for k in range(nb):
        t = 0.12 + rng.uniform(0, 0.35)
        dsp.poser(y, dsp.clic(rng, 3000, 7500, 0.003, 0.0006) * rng.uniform(0.15, 0.45), t)
    dsp.poser(y, ins.bruit_bref(rng, 0.05, 150, 500, 0.012) * 0.12, 0.14)
    return y


def _arroser(v: int, rng: np.random.Generator) -> np.ndarray:
    duree = 1.5
    n = dsp.n_ech(duree)
    t = np.arange(n) / SR
    courant = dsp.pbande(rng.standard_normal(n), 450, 3800) * (0.7 + 0.3 * dsp.pb(rng.standard_normal(n), 8) * 8)
    gouttes = dsp.grains(duree, 320, lambda r: dsp.bulle(r, r.uniform(1400, 4200), r.uniform(0.002, 0.007)) *
                         r.uniform(0.1, 0.5), rng)
    impacts = dsp.grains(duree, 500, lambda r: dsp.clic(r, 2000, 8000, 0.003, 0.0008) * r.uniform(0.05, 0.25), rng)
    corps = dsp.pbande(rng.standard_normal(n), 150, 600) * 0.15
    y = 0.35 * courant + 0.7 * gouttes + 0.5 * impacts + corps
    return y * dsp.env_ar(n, 0.07, 0.35)


def _arrosoir_vide(v: int, rng: np.random.Generator) -> np.ndarray:
    y = dsp.toile(0.9)
    tonk = ins.metal(rng, rng.uniform(500, 540), 0.6, t60=0.35, rapports=(1.0, 2.62, 4.2, 6.3),
                     amps=(1.0, 0.45, 0.25, 0.1))
    dsp.poser(y, dsp.pb(tonk, 5000) * 0.8, 0.0)
    dsp.poser(y, ins.bruit_bref(rng, 0.05, 100, 400, 0.01) * 0.3, 0.0)
    for t in (0.28, 0.55):
        dsp.poser(y, dsp.bulle(rng, rng.uniform(2200, 2800), 0.006) * 0.25, t)
    return y


def _remplir(v: int, rng: np.random.Generator) -> np.ndarray:
    """L'arrosoir qu'on remplit au puits ou au tonneau: la résonance monte avec le niveau d'eau."""
    duree = 1.7
    n = dsp.n_ech(duree)
    x = rng.standard_normal(n)
    y = dsp.pb_variable(x, lambda u: 380 + 900 * (u / duree) ** 1.3, type_="band", q_bande=3.0) * 0.8
    glouglou = dsp.grains(duree, 40, lambda r: dsp.bulle(r, r.uniform(250, 600), r.uniform(0.01, 0.03), 1.5) * r.uniform(0.3, 0.8), rng)
    eclab = dsp.grains(duree, 260, lambda r: dsp.clic(r, 1500, 6000, 0.003, 0.0008) * r.uniform(0.05, 0.2), rng)
    y = y + 0.6 * glouglou + 0.4 * eclab + 0.2 * dsp.pbande(x, 900, 3000)
    return y * dsp.env_ar(n, 0.08, 0.3)


def _recolter(v: int, rng: np.random.Generator) -> np.ndarray:
    y = dsp.toile(0.45)
    arrache = ins.bruit_bref(rng, 0.08, 200, 1500, 0.025, 0.004) * 0.5
    f0 = (620, 700, 780)[v % 3] * rng.uniform(0.98, 1.02)
    n = dsp.n_ech(0.08)
    t = np.arange(n) / SR
    pop = dsp.sinus_glisse(f0 * np.exp(-t / 0.018) + 240) * dsp.env_exp(n, 0.022, 0.001)
    feuilles = ins.froissement(rng, 0.14, 2500, 8000, 120, 0.005, 0.1) * 0.25
    mottes = dsp.grains(0.25, 90, lambda r: ins.bruit_bref(r, 0.015, 300, 1600, 0.003) * r.uniform(0.1, 0.35), rng,
                        enveloppe=lambda u: np.exp(-u / 0.08))
    dsp.poser(y, arrache, 0.0)
    dsp.poser(y, pop * 0.9, 0.035)
    dsp.poser(y, feuilles, 0.02)
    dsp.poser(y, mottes * 0.6, 0.05)
    return y


def _belle(v: int, rng: np.random.Generator) -> np.ndarray:
    y = dsp.toile(1.6)
    dsp.poser(y, ins.clochette(RE6, 1.5, rng, brillance=0.8, t60=1.2), 0.0)
    return y


def _superbe(v: int, rng: np.random.Generator) -> np.ndarray:
    y = dsp.toile(2.0)
    dsp.poser(y, ins.clochette(SOL5, 1.6, rng, brillance=0.8, t60=1.3) * 0.75, 0.0)
    dsp.poser(y, ins.clochette(RE6, 1.7, rng, brillance=0.9, t60=1.4), 0.13)
    dsp.poser(y, ins.glock(SOL6, 1.2, rng, t60=0.9) * 0.18, 0.26)
    return y


# --- Bois et construction ------------------------------------------------------------------

def _hache(v: int, rng: np.random.Generator) -> np.ndarray:
    y = dsp.toile(0.6)
    coup = ins.bois(rng, rng.uniform(170, 230), 0.4, durete=1.4, rapports=(1.0, 2.2, 4.4, 7.9), t60=0.14,
                    amps=(1.0, 0.7, 0.45, 0.2))
    eclat = ins.bruit_bref(rng, 0.06, 900, 4500, 0.018, 0.0005) * 0.6
    fer = dsp.modes(dsp.n_ech(0.2), [(rng.uniform(2700, 3000), 0.06, 0.1)], rng)
    copeaux = dsp.grains(0.35, 50, lambda r: ins.bois(r, r.uniform(800, 1600), 0.05, 0.5, t60=0.02) * r.uniform(0.05, 0.15),
                         rng, enveloppe=lambda u: np.exp(-u / 0.15))
    dsp.poser(y, coup, 0.0)
    dsp.poser(y, eclat, 0.0)
    dsp.poser(y, fer, 0.0)
    dsp.poser(y, copeaux, 0.12)
    return y


def _craquement(v: int, rng: np.random.Generator) -> np.ndarray:
    duree = 1.4
    y = dsp.toile(duree)
    k = 0
    t = 0.0
    while t < duree - 0.15:
        intervalle = 0.16 * np.exp(-t * 2.2) + 0.018
        dsp.poser(y, ins.bruit_bref(rng, 0.04, 250, 3200, rng.uniform(0.004, 0.012)) * rng.uniform(0.3, 0.9) *
                  (0.4 + t / duree), t)
        t += intervalle * rng.uniform(0.6, 1.4)
        k += 1
    gemit = ins.crissement(rng, duree, lambda u: 25 + 40 * u, [(320, 6), (700, 7), (1300, 9)], 0.25)
    y += gemit * dsp.env_points(len(gemit), [(0, 0), (0.4, 0.2), (1.2, 0.6), (duree, 0.0)]) * 0.35
    return y


def _chute(v: int, rng: np.random.Generator) -> np.ndarray:
    duree = 3.2
    n = dsp.n_ech(duree)
    y = np.zeros(n)
    souffle_n = dsp.n_ech(1.25)
    souffle = dsp.pb_variable(rng.standard_normal(souffle_n), lambda u: 300 + 900 * u, type_="band", q_bande=1.5)
    souffle *= dsp.env_points(souffle_n, [(0, 0), (0.9, 0.5), (1.2, 1.0), (1.25, 0.6)])
    feuilles = ins.froissement(rng, 1.25, 2000, 8000, 140, 0.6, 0.05) * 0.5
    dsp.poser(y, souffle * 0.6 + feuilles, 0.0)
    impact = 1.2
    sourd = ins.bruit_bref(rng, 0.8, 35, 160, 0.22, 0.003) * 1.5
    tronc = ins.bois(rng, 75, 0.8, durete=1.2, rapports=(1.0, 2.1, 3.9), t60=0.5, amps=(1.0, 0.6, 0.3))
    branches = dsp.grains(1.2, 220, lambda r: ins.bruit_bref(r, 0.04, 400, 4500, r.uniform(0.004, 0.015)) * r.uniform(0.1, 0.6),
                          rng, enveloppe=lambda u: np.exp(-u / 0.35))
    dsp.poser(y, sourd, impact)
    dsp.poser(y, tronc * 0.8, impact)
    dsp.poser(y, branches * 0.8, impact + 0.01)
    dsp.poser(y, ins.froissement(rng, 1.6, 1800, 7000, 60, 0.05, 1.2) * 0.35, impact + 0.1)
    return y


def _scie(v: int, rng: np.random.Generator) -> np.ndarray:
    """Scie à main, en boucle (deux allers-retours en 1,6 s): poussée longue et claire, tirée
    plus douce. Construite en mode circulaire pour un raccord parfait."""
    duree = 1.6
    n = dsp.n_ech(duree)
    y = np.zeros(n)
    for k, (t0, d, force, dents) in enumerate(((0.0, 0.46, 1.0, 95), (0.48, 0.3, 0.55, 70),
                                               (0.8, 0.46, 0.95, 100), (1.28, 0.3, 0.5, 72))):
        m = dsp.n_ech(d)
        tt = np.arange(m) / SR
        vitesse = np.sin(np.pi * tt / d)
        frott = dsp.pbande(rng.standard_normal(m), 1400, 6500)
        dentelure = 0.5 + 0.5 * np.sign(np.sin(2 * np.pi * np.cumsum(dents * (0.6 + 0.4 * vitesse)) / SR))
        trait = frott * (0.4 + 0.6 * dentelure) * vitesse ** 1.2 * force
        corps = dsp.pbande(rng.standard_normal(m), 250, 900) * vitesse * 0.3 * force
        dsp.poser(y, trait + corps, t0, circulaire=True)
    return y


def _scie_fin(v: int, rng: np.random.Generator) -> np.ndarray:
    y = dsp.toile(0.9)
    dsp.poser(y, ins.bois(rng, 160, 0.5, 1.0, t60=0.18) * 0.9, 0.0)
    dsp.poser(y, ins.bois(rng, 210, 0.4, 0.8, t60=0.12) * 0.5, 0.11)
    dsp.poser(y, ins.bois(rng, 240, 0.3, 0.6, t60=0.08) * 0.25, 0.2)
    return y


def _marteau(v: int, rng: np.random.Generator) -> np.ndarray:
    y = dsp.toile(0.45)
    clou = ins.metal(rng, rng.uniform(2500, 2900), 0.3, t60=0.09, rapports=(1.0, 1.57, 2.38), amps=(1.0, 0.5, 0.25))
    planche = ins.bois(rng, rng.uniform(260, 330), 0.3, durete=1.1, t60=0.1)
    dsp.poser(y, clou * 0.35, 0.0)
    dsp.poser(y, planche, 0.0)
    return y


def _termine(v: int, rng: np.random.Generator) -> np.ndarray:
    y = dsp.toile(1.1)
    tchonk = ins.bois(rng, 92, 0.6, durete=1.2, rapports=(1.0, 2.0, 3.9, 6.8), t60=0.3, amps=(1.0, 0.7, 0.35, 0.12))
    dsp.poser(y, tchonk, 0.0)
    dsp.poser(y, ins.bruit_bref(rng, 0.2, 60, 200, 0.05) * 0.8, 0.0)
    poussiere = dsp.pbande(rng.standard_normal(dsp.n_ech(0.7)), 500, 3000) * dsp.env_points(dsp.n_ech(0.7), [(0, 0), (0.05, 0.3), (0.7, 0)])
    dsp.poser(y, poussiere * 0.35, 0.02)
    return y


def _meuble_pose(v: int, rng: np.random.Generator) -> np.ndarray:
    y = dsp.toile(0.6)
    frottement = ins.bruit_bref(rng, 0.09, 400, 2400, 0.04, 0.02) * 0.25
    dsp.poser(y, frottement, 0.0)
    dsp.poser(y, ins.bois(rng, rng.uniform(120, 160), 0.45, 0.8, rapports=(1.0, 2.4, 5.0), t60=0.18,
                          amps=(1.0, 0.5, 0.2)), 0.07)
    dsp.poser(y, ins.bruit_bref(rng, 0.1, 50, 200, 0.03) * 0.6, 0.07)
    return y


def _meuble_tourne(v: int, rng: np.random.Generator) -> np.ndarray:
    n = dsp.n_ech(0.22)
    x = ins.crissement(rng, 0.22, lambda u: 140 + 200 * u, [(600, 7), (1300, 9)], 0.2) * 0.4
    x += dsp.pbande(rng.standard_normal(n), 300, 2000) * 0.15
    return x * dsp.env_ar(n, 0.02, 0.08)


# --- Gestes et objets ----------------------------------------------------------------------

def _ramasser(v: int, rng: np.random.Generator) -> np.ndarray:
    y = dsp.toile(0.3)
    dsp.poser(y, ins.bruit_bref(rng, 0.12, 300, 3000, 0.035, 0.004) * 0.6, 0.0)
    n = dsp.n_ech(0.05)
    t = np.arange(n) / SR
    blip = dsp.sinus_glisse(np.linspace(820, 1250, n) * (1 + 0.04 * v)) * dsp.env_exp(n, 0.015, 0.002)
    dsp.poser(y, blip * 0.18, 0.015)
    return y


def _sac(v: int, rng: np.random.Generator) -> np.ndarray:
    y = dsp.toile(0.5)
    dsp.poser(y, ins.froissement(rng, 0.35, 700, 5500, rng.uniform(40, 70), 0.03, 0.15) * 0.6, 0.0)
    dsp.poser(y, ins.metal(rng, 3400, 0.08, t60=0.04) * 0.08, 0.28)
    return y


def _porte_ouvre(v: int, rng: np.random.Generator) -> np.ndarray:
    """La porte de la maisonnette grince: « une porte qui grince, c'est une porte qui parle »."""
    y = dsp.toile(1.3)
    loquet = ins.metal(rng, rng.uniform(2100, 2400), 0.12, t60=0.05, rapports=(1.0, 1.7), amps=(1.0, 0.4))
    dsp.poser(y, loquet * 0.35, 0.0)
    contour = [(0, 55), (0.25, 95), (0.5, 140), (0.75, 110)] if v == 0 else [(0, 70), (0.2, 160), (0.45, 120), (0.75, 85)]
    duree = 0.8
    grince = ins.crissement(rng, duree, lambda u: np.interp(u, [p[0] for p in contour], [p[1] for p in contour]),
                            [(430, 10), (880, 12), (1650, 14), (2500, 12)], 0.08)
    grince *= dsp.env_points(len(grince), [(0, 0), (0.06, 0.8), (0.5, 1.0), (0.7, 0.6), (duree, 0)])
    dsp.poser(y, grince * 0.5, 0.09)
    dsp.poser(y, ins.bruit_bref(rng, 0.4, 100, 600, 0.12, 0.05) * 0.1, 0.1)
    return y


def _porte_ferme(v: int, rng: np.random.Generator) -> np.ndarray:
    y = dsp.toile(0.8)
    dsp.poser(y, ins.bois(rng, rng.uniform(85, 105), 0.6, 1.0, rapports=(1.0, 2.2, 4.8), t60=0.25,
                          amps=(1.0, 0.5, 0.2)), 0.0)
    dsp.poser(y, ins.bruit_bref(rng, 0.2, 40, 180, 0.05) * 0.9, 0.0)
    dsp.poser(y, ins.metal(rng, rng.uniform(2200, 2500), 0.1, t60=0.04, rapports=(1.0, 1.6), amps=(1.0, 0.4)) * 0.3,
              0.05 + 0.01 * v)
    return y


def _coffre_ouvre(v: int, rng: np.random.Generator) -> np.ndarray:
    y = dsp.toile(1.0)
    grince = ins.crissement(rng, 0.45, lambda u: 120 + 260 * u, [(700, 11), (1450, 13), (2300, 12)], 0.1)
    grince *= dsp.env_ar(len(grince), 0.05, 0.15)
    dsp.poser(y, grince * 0.35, 0.0)
    dsp.poser(y, ins.bois(rng, 170, 0.4, 0.7, t60=0.12) * 0.5, 0.5)
    return y


def _coffre_ferme(v: int, rng: np.random.Generator) -> np.ndarray:
    y = dsp.toile(0.7)
    dsp.poser(y, ins.bois(rng, 125, 0.5, 1.1, rapports=(1.0, 2.5, 5.1), t60=0.2, amps=(1.0, 0.5, 0.2)), 0.0)
    dsp.poser(y, ins.bruit_bref(rng, 0.15, 50, 220, 0.04) * 0.8, 0.0)
    for t in (0.06, 0.1):
        dsp.poser(y, ins.metal(rng, rng.uniform(2800, 3400), 0.05, t60=0.03) * 0.06, t)
    return y


def _caisse(v: int, rng: np.random.Generator) -> np.ndarray:
    y = dsp.toile(0.5)
    dsp.poser(y, ins.bois(rng, rng.uniform(190, 230), 0.35, 0.9, rapports=(1.0, 2.4, 4.7), t60=0.08,
                          amps=(1.0, 0.5, 0.25)), 0.0)
    dsp.poser(y, ins.froissement(rng, 0.18, 2000, 6500, 80, 0.005, 0.12) * 0.25, 0.01)
    return y


def _tampon(v: int, rng: np.random.Generator) -> np.ndarray:
    y = dsp.toile(0.45)
    dsp.poser(y, ins.bruit_bref(rng, 0.08, 140, 450, 0.02, 0.001) * 1.0, 0.0)
    dsp.poser(y, ins.bruit_bref(rng, 0.03, 900, 5000, 0.006, 0.0003) * 0.6, 0.0)
    dsp.poser(y, ins.bois(rng, 380, 0.2, 0.7, t60=0.05) * 0.35, 0.002)
    return dsp.stereo(y)


def _pieces(v: int, rng: np.random.Generator) -> np.ndarray:
    y = dsp.toile(0.9, stereo=True)
    nb = (3, 4, 6)[v % 3]
    t = 0.0
    for k in range(nb):
        f = rng.uniform(2600, 4000)
        piece = ins.metal(rng, f, 0.45, t60=rng.uniform(0.18, 0.35), rapports=(1.0, 1.59, 2.14, 2.30, 2.65),
                          amps=(1.0, 0.7, 0.5, 0.4, 0.25))
        dsp.poser(y, piece * rng.uniform(0.35, 0.75), t, pan=rng.uniform(-0.25, 0.25))
        t += rng.uniform(0.025, 0.09)
    return y


# --- Signaux entre joueurs, interface -------------------------------------------------------

def _repere_soi(v: int, rng: np.random.Generator) -> np.ndarray:
    """Ton repère: deux coups de clochette qui montent (sol, ré)."""
    y = dsp.toile(2.0)
    dsp.poser(y, ins.clochette(SOL5, 1.8, rng, 1.0, 1.5) * 0.8, 0.0)
    dsp.poser(y, ins.clochette(RE6, 1.8, rng, 1.0, 1.6), 0.14)
    return y


def _repere_autre(v: int, rng: np.random.Generator) -> np.ndarray:
    """Le repère de l'autre: même famille, plus grave et plus rond (ré, sol, ré), pour qu'on sache
    sans regarder que ce n'est pas le sien."""
    y = dsp.toile(2.2)
    for k, (f, t) in enumerate(((dsp.freq("D5"), 0.0), (dsp.freq("G5"), 0.16), (dsp.freq("D5"), 0.32))):
        dsp.poser(y, ins.clochette(f, 1.8, rng, 0.55, 1.7) * (0.9 if k < 2 else 0.6), t)
    return y


def _notification(v: int, rng: np.random.Generator) -> np.ndarray:
    notes = (("G5", "B5", "D6"), ("G5", "C6", "E6"))[v % 2]
    y = dsp.toile(1.1, stereo=True)
    for k, nom in enumerate(notes):
        dsp.poser(y, ins.marimba(dsp.freq(nom), 0.9, rng) * (0.7 + 0.15 * k), 0.065 * k, pan=-0.15 + 0.15 * k)
    return y


def _carnet(v: int, rng: np.random.Generator) -> np.ndarray:
    """Pages du carnet qu'on ouvre ou qu'on tourne."""
    duree = 0.42
    n = dsp.n_ech(duree)
    x = dsp.pb_variable(rng.standard_normal(n), lambda u: 5500 - 7000 * u, type_="band", q_bande=0.9)
    x *= dsp.env_points(n, [(0, 0), (0.05, 0.6), (0.18, 1.0), (0.3, 0.4), (duree, 0)])
    x += ins.froissement(rng, duree, 1500, 7000, 90, 0.02, 0.2) * 0.3
    claque = ins.bruit_bref(rng, 0.05, 300, 2000, 0.01) * 0.5
    y = dsp.toile(0.5)
    dsp.poser(y, x * 0.6, 0.0)
    dsp.poser(y, claque, 0.24 + 0.03 * v)
    return dsp.stereo(y)


def _sonnette(v: int, rng: np.random.Generator) -> np.ndarray:
    """Sonnette de comptoir, deux petits coups: « on te propose quelque chose »."""
    y = dsp.toile(2.4)
    f = dsp.freq("A6") * 0.5 * 2.0  # la 6
    for k, (t, g) in enumerate(((0.0, 1.0), (0.22, 0.7))):
        coup = dsp.modes(dsp.n_ech(2.0), [(f, 1.0, 1.8), (f * 1.006, 0.6, 1.7), (f * 2.42, 0.35, 0.8),
                                          (f * 4.1, 0.12, 0.4)], rng, attaque=0.0005)
        coup[: dsp.n_ech(0.003)] += dsp.clic(rng, 3000, 9000, 0.003, 0.0006)[: dsp.n_ech(0.003)] * 0.3
        dsp.poser(y, coup * g, t)
    return dsp.pb(y, 7000)


def _accord_achat(v: int, rng: np.random.Generator) -> np.ndarray:
    y = dsp.toile(1.3, stereo=True)
    dsp.poser(y, _tampon(0, rng), 0.0)
    dsp.poser(y, ins.marimba(SOL5, 0.9, rng) * 0.5, 0.12, pan=-0.1)
    dsp.poser(y, ins.marimba(RE6, 0.9, rng) * 0.6, 0.22, pan=0.1)
    return y


def _refus_achat(v: int, rng: np.random.Generator) -> np.ndarray:
    duree = 0.45
    n = dsp.n_ech(duree)
    x = dsp.pb_variable(rng.standard_normal(n), lambda u: 4000 - 6000 * u, type_="band", q_bande=1.0)
    x *= dsp.env_points(n, [(0, 0), (0.08, 1.0), (duree, 0)])
    y = dsp.toile(1.0, stereo=True)
    dsp.poser(y, x * 0.4, 0.0)
    dsp.poser(y, ins.marimba(dsp.freq("G4"), 0.7, rng) * 0.5, 0.2)
    return y


def _clic(v: int, rng: np.random.Generator) -> np.ndarray:
    y = dsp.toile(0.12)
    dsp.poser(y, ins.bois(rng, (1700, 1900)[v % 2], 0.1, 0.5, rapports=(1.0, 1.8), t60=0.03, amps=(1.0, 0.3)), 0.0)
    return dsp.stereo(y)


def _outil(v: int, rng: np.random.Generator) -> np.ndarray:
    y = dsp.toile(0.2)
    dsp.poser(y, ins.metal(rng, rng.uniform(3000, 3600), 0.08, t60=0.04) * 0.5, 0.0)
    dsp.poser(y, ins.bois(rng, rng.uniform(600, 800), 0.08, 0.5, t60=0.03) * 0.6, 0.035)
    return dsp.stereo(y)


def _hop(v: int, rng: np.random.Generator) -> np.ndarray:
    """Le « hop » du geste à deux, sans voix: une petite appoggiature de marimba et un coup de bois."""
    y = dsp.toile(0.6, stereo=True)
    dsp.poser(y, ins.marimba(dsp.freq("D5"), 0.4, rng) * 0.5, 0.0)
    dsp.poser(y, ins.marimba(dsp.freq("G5"), 0.5, rng) * 0.7, 0.07)
    dsp.poser(y, ins.bois(rng, 240, 0.3, 0.8, t60=0.08) * 0.5, 0.07)
    return y


def _poutre(v: int, rng: np.random.Generator) -> np.ndarray:
    """La poutre portée à deux: craquements lents du bois et un souffle d'effort de la corde,
    en boucle de 2,4 s."""
    duree = 2.4
    y = np.zeros(dsp.n_ech(duree))
    for t0, f in ((0.15, 0.8), (1.35, 1.0)):
        g = ins.crissement(rng, 0.5, lambda u: 18 + 35 * u * f, [(240, 6), (520, 8), (1100, 9)], 0.3)
        g *= dsp.env_ar(len(g), 0.1, 0.25)
        dsp.poser(y, g * 0.6, t0, circulaire=True)
    for t0 in (0.7, 1.9):
        dsp.poser(y, ins.bois(rng, 180, 0.3, 0.4, t60=0.1) * 0.15, t0, circulaire=True)
    return y


# --- Maison, cuisine, poules ---------------------------------------------------------------

def _rechaud_allume(v: int, rng: np.random.Generator) -> np.ndarray:
    y = dsp.toile(1.2)
    allumette = ins.bruit_bref(rng, 0.25, 1500, 7000, 0.06, 0.004) * 0.5
    allumette += ins.froissement(rng, 0.25, 2000, 8000, 200, 0.002, 0.15) * 0.3
    dsp.poser(y, allumette, 0.0)
    n = dsp.n_ech(0.8)
    pouf = dsp.pbande(rng.standard_normal(n), 80, 700) * dsp.env_points(n, [(0, 0), (0.04, 1.0), (0.8, 0)])
    dsp.poser(y, pouf * 0.8, 0.22)
    return y


def _rechaud_boucle(v: int, rng: np.random.Generator) -> np.ndarray:
    """Le réchaud qui mijote, en boucle de 6 s: frémissement grave et grésillements."""
    duree = 6.0
    n = dsp.n_ech(duree)
    y = dsp.filtre_circulaire(dsp.bruit_spectral(n, rng, -3.0), dsp.gain_bande(120, 900)) * 0.12
    y += dsp.grains(duree, 18, lambda r: dsp.bulle(r, r.uniform(180, 420), r.uniform(0.015, 0.04), 1.2) * r.uniform(0.2, 0.6),
                    rng, circulaire=True) * 0.8
    y += dsp.grains(duree, 90, lambda r: dsp.clic(r, 2500, 8000, 0.004, 0.0008) * r.uniform(0.05, 0.3), rng,
                    circulaire=True) * 0.6
    return y


def _manger(v: int, rng: np.random.Generator) -> np.ndarray:
    y = dsp.toile(0.9)
    for k, t0 in enumerate((0.0, 0.42)):
        croc = dsp.grains(0.09, 260, lambda r: ins.bruit_bref(r, 0.012, 900, 5000, r.uniform(0.0015, 0.004)) * r.uniform(0.3, 1.0),
                          rng, enveloppe=lambda u: np.exp(-u / 0.03))
        dsp.poser(y, croc * (1.0 if k == 0 else 0.7), t0)
        dsp.poser(y, ins.bruit_bref(rng, 0.06, 150, 500, 0.015) * 0.3, t0)
    return y


def _poule(v: int, rng: np.random.Generator) -> np.ndarray:
    y = dsp.toile(1.3)
    if v == 0:  # « cot cot cot »
        for k, t in enumerate((0.0, 0.17, 0.33)):
            dsp.poser(y, ins.poule(rng, rng.uniform(330, 380), 0.075, "o"), t)
    elif v == 1:  # « cot cot codêêt »
        for t in (0.0, 0.15):
            dsp.poser(y, ins.poule(rng, rng.uniform(340, 390), 0.07, "o"), t)
        dsp.poser(y, ins.poule(rng, 420, 0.42, "e", glisse=0.25), 0.32)
    else:  # roucoulement content, doux
        for k in range(5):
            dsp.poser(y, ins.poule(rng, rng.uniform(280, 310), 0.09, "o") * 0.6, 0.11 * k)
    return y


# --- Catalogue -----------------------------------------------------------------------------

def sons() -> list[Son]:
    pas_note = ("un pas par appui de pied; tirage sans répétition immédiate; choisir le sol sous le pied "
                "(terre: potager et chemins; herbe; bois: quai et plancher; pierre: place et puits)")
    return [
        Son("step-grass", "Pas sur l'herbe", "effets", "effects", lambda v, r: _pas(v, r, "herbe"), 4, -29.0, 3,
            0.06, 1.5, "pres", intervalle_min_ms=120, voix_max=4, passe_haut=60, note=pas_note),
        Son("step-path", "Pas sur la terre et le chemin", "effets", "effects", lambda v, r: _pas(v, r, "terre"), 4, -28.5,
            3, 0.06, 1.5, "pres", intervalle_min_ms=120, voix_max=4, passe_haut=50, note=pas_note),
        Son("step-wood", "Pas sur le bois (quai, plancher)", "effets", "effects", lambda v, r: _pas(v, r, "bois"), 4,
            -27.5, 3, 0.05, 1.5, "pres", intervalle_min_ms=120, voix_max=4, passe_haut=60, note=pas_note),
        Son("step-stone", "Pas sur la pierre (place, puits)", "effets", "effects", lambda v, r: _pas(v, r, "pierre"), 4,
            -28.5, 3, 0.05, 1.5, "pres", intervalle_min_ms=120, voix_max=4, passe_haut=80, note=pas_note),
        Son("hoe", "Bêcher une case", "effets", "effects", _becher, 3, -23.0, 3, 0.05, 1.0, "pres"),
        Son("sow", "Semer", "effets", "effects", _semer, 3, -26.0, 3, 0.05, 1.0, "pres"),
        Son("water", "Arroser une case", "effets", "effects", _arroser, 2, -25.0, 3, 0.04, 1.0, "pres"),
        Son("water-empty", "Arrosoir vide", "effets", "effects", _arrosoir_vide, 1, -24.0, 2, 0.03, 0.5, "pres"),
        Son("water-fill", "Remplir l'arrosoir au puits ou au tonneau", "effets", "effects", _remplir, 1, -24.0, 3,
            0.03, 0.5, "pres"),
        Son("harvest", "Récolter (« pop »)", "effets", "effects", _recolter, 3, -21.0, 2, 0.05, 1.0, "pres"),
        Son("quality-fine", "Récolte de qualité « belle » (un tintement, joué avec le « pop »)", "effets", "effects",
            _belle, 1, -21.0, 2, 0.0, 0.0, "pres", queue_reverbe=(1.0, 0.25),
            note="joué 60 ms après harvest; sans variation de hauteur pour rester juste avec la musique"),
        Son("quality-superb", "Récolte de qualité « superbe » (deux tintements)", "effets", "effects", _superbe, 1,
            -19.5, 2, 0.0, 0.0, "pres", queue_reverbe=(1.0, 0.25),
            note="absente de la démo (seule « belle » y existe), prête pour le jeu complet"),
        Son("axe-chop", "Coup de hache", "effets", "effects", _hache, 3, -21.5, 3, 0.05, 1.0, "moyen"),
        Son("tree-crack", "L'arbre craque avant de tomber", "effets", "effects", _craquement, 1, -21.0, 2, 0.03, 0.5,
            "moyen"),
        Son("tree-fall", "Chute de l'arbre", "effets", "effects", _chute, 1, -18.0, 2, 0.04, 0.5, "loin"),
        Son("saw-loop", "Scier à l'établi (boucle tant que l'action dure)", "effets", "effects", _scie, 1, -25.0, 3,
            0.02, 0.0, "moyen", boucle=True, note="boucle de 1,6 s; jouer saw-end quand la planche tombe"),
        Son("saw-end", "Planches sciées qui tombent sur l'établi", "effets", "effects", _scie_fin, 1, -22.0, 3, 0.04,
            0.5, "moyen"),
        Son("hammer", "Coup de marteau sur un élément fantôme", "effets", "effects", _marteau, 3, -22.0, 3, 0.06, 1.5,
            "moyen", intervalle_min_ms=150,
            note="à deux sur le même élément, chacun ses coups: les deux marteaux s'entendent"),
        Son("build-done", "Élément terminé (« tchonk »)", "effets", "effects", _termine, 1, -19.0, 2, 0.04, 0.5,
            "moyen"),
        Son("furniture-place", "Poser un meuble", "effets", "effects", _meuble_pose, 2, -22.0, 3, 0.05, 1.0, "pres"),
        Son("furniture-rotate", "Tourner un meuble dans le plan", "effets", "effects", _meuble_tourne, 1, -27.0, 3,
            0.08, 1.0, "pres", intervalle_min_ms=80),
        Son("pickup", "Ramasser un objet (il saute au sac)", "effets", "effects", _ramasser, 3, -24.0, 3, 0.06, 1.0,
            "pres", intervalle_min_ms=60),
        Son("bag", "Ranger au sac, donner à l'autre", "effets", "effects", _sac, 2, -26.0, 3, 0.05, 1.0, "pres"),
        Son("door-open", "Ouvrir la porte (elle grince)", "effets", "effects", _porte_ouvre, 2, -22.0, 3, 0.03, 1.0,
            "moyen"),
        Son("door-close", "Fermer la porte", "effets", "effects", _porte_ferme, 2, -21.0, 3, 0.04, 1.0, "moyen"),
        Son("chest-open", "Ouvrir le coffre", "effets", "effects", _coffre_ouvre, 1, -23.0, 3, 0.04, 0.5, "pres"),
        Son("chest-close", "Fermer le coffre", "effets", "effects", _coffre_ferme, 1, -22.0, 3, 0.04, 0.5, "pres"),
        Son("crate-deposit", "Déposer un produit dans la caisse de la coopérative", "effets", "effects", _caisse, 2,
            -23.0, 3, 0.05, 1.0, "pres", note="suivi de order-stamp quand une ligne de la commande se coche"),
        Son("order-stamp", "Coup de tampon: une ligne de la commande se coche", "interface", "ui", _tampon, 1, -22.5,
            2, 0.03, 0.5, None, canaux=2),
        Son("coins", "Monnaie (vendre, acheter, paiement de la coopérative)", "interface", "ui", _pieces, 3, -21.0, 2,
            0.04, 1.0, None, canaux=2),
        Son("ping-self", "Faire signe (G): ton repère", "effets", "effects", _repere_soi, 1, -16.0, 1, 0.0, 0.0,
            "repere", duck_db=-6.0, queue_reverbe=(1.4, 0.3),
            note="joué à l'épingle chez celui qui la pose"),
        Son("ping-peer", "Repère posé par l'autre joueur", "effets", "effects", _repere_autre, 1, -16.0, 1, 0.0, 0.0,
            "repere", duck_db=-6.0, queue_reverbe=(1.4, 0.3),
            note="joué à l'épingle chez l'autre; plus grave et en trois notes: on sait sans regarder qui a fait signe"),
        Son("notify", "Notification douce (ligne de notifications du HUD)", "interface", "ui", _notification, 2, -21.0,
            2, 0.0, 1.0, None, canaux=2, intervalle_min_ms=400, duck_db=-3.0, queue_reverbe=(0.8, 0.2)),
        Son("journal-open", "Ouvrir le carnet, tourner une page", "interface", "ui", _carnet, 2, -25.0, 3, 0.05, 1.0,
            None, canaux=2),
        Son("purchase-proposal", "Proposition de gros achat (chez celui qui doit répondre)", "interface", "ui",
            _sonnette, 1, -17.0, 1, 0.0, 0.0, None, canaux=2, duck_db=-6.0, queue_reverbe=(0.9, 0.2)),
        Son("purchase-accept", "Gros achat accepté (tampon « D'accord »)", "interface", "ui", _accord_achat, 1, -19.0,
            2, 0.0, 0.0, None, canaux=2, queue_reverbe=(0.8, 0.2)),
        Son("purchase-decline", "Gros achat refusé (la carte se replie)", "interface", "ui", _refus_achat, 1, -24.0,
            2, 0.0, 0.0, None, canaux=2),
        Son("ui-click", "Clic sur le sol (repère de destination)", "interface", "ui", _clic, 2, -28.0, 4, 0.05, 1.0,
            None, canaux=2, intervalle_min_ms=50),
        Son("tool-switch", "Changer d'outil", "interface", "ui", _outil, 2, -27.0, 4, 0.06, 1.0, None, canaux=2,
            intervalle_min_ms=60),
        Son("duo-hop", "Geste à deux: on soulève ensemble (« hop »)", "effets", "effects", _hop, 1, -20.0, 2, 0.02,
            0.5, "pres", note="sans voix: le souffle de l'effort est remplacé par le bois de la poutre (duo-carry-loop)"),
        Son("duo-carry-loop", "Geste à deux: la poutre portée (boucle)", "effets", "effects", _poutre, 1, -28.0, 3,
            0.0, 0.0, "pres", boucle=True),
        Son("stove-light", "Allumer le réchaud", "effets", "effects", _rechaud_allume, 1, -23.0, 3, 0.04, 0.5, "pres"),
        Son("stove-loop", "Le réchaud qui mijote (boucle)", "effets", "effects", _rechaud_boucle, 1, -30.0, 4, 0.0,
            0.0, "pres", boucle=True),
        Son("eat", "Manger (« croque »)", "effets", "effects", _manger, 2, -24.0, 3, 0.06, 1.0, "pres"),
        Son("hen", "Gloussements des poules", "effets", "effects", _poule, 3, -24.0, 3, 0.08, 2.0, "moyen",
            note="tirer au hasard toutes les 4 à 15 s par poule, plus souvent quand on les nourrit", passe_haut=120),
    ]
