"""Timbres propres au café (son.md, 8.2.1): porcelaine, laiton accordé, bois, vapeur, eau,
papier et craie, moteurs. Tout est synthétisé; chaque fonction reçoit son générateur à graine.

Règles tenues ici plutôt qu'à chaque son: aigus adoucis (passe-bas doux vers 7 kHz sur les
contacts), aucune énergie utile sous 80 Hz, bois à fondamentale de 150 à 400 Hz (audible sur
un portable), rien de tenu au-dessus de 2 kHz.
"""

from __future__ import annotations

import numpy as np

import dsp
import instruments as ins
from dsp import SR

# Do pentatonique (son.md, 8.2.2): tout ce qui tinte.
PENTA = {"C": 0, "D": 2, "E": 4, "G": 7, "A": 9}


def note(nom: str) -> float:
    return dsp.freq(nom)


def doux(x: np.ndarray, fc: float = 7000.0) -> np.ndarray:
    """Adoucit les aigus (son.md, 8.1: -3 dB au-dessus de 6 kHz, ici un passe-bas d'ordre 1)."""
    return dsp.pb(x, fc, 1)


# --- Porcelaine et verre ------------------------------------------------------------------

def porcelaine(rng: np.random.Generator, f1: float, duree: float = 0.35, t60: float = 0.28,
               mat: float = 0.0, force: float = 1.0) -> np.ndarray:
    """Coque mince de porcelaine frappée: partiels inharmoniques d'un bol (rapports mesurés sur des
    tasses: environ 1, 2,3, 3,9, 5,8), contact bref. mat (0 à 1) raccourcit et assombrit (faïence)."""
    n = dsp.n_ech(duree)
    rap = [(1.0, 1.0), (1.006, 0.5), (2.32, 0.55), (3.94, 0.32), (5.81, 0.16), (7.9, 0.07)]
    t = t60 * (1.0 - 0.6 * mat)
    partiels = [(f1 * r * rng.uniform(0.995, 1.005), a * (1.0 - 0.5 * mat * (k > 1)), t / (1 + 0.55 * k))
                for k, (r, a) in enumerate(rap)]
    y = dsp.modes(n, partiels, rng, attaque=0.0003)
    contact = dsp.clic(rng, 1500, 7000, 0.003, 0.0006 + 0.001 * mat)
    dsp.poser(y, contact * (0.35 + 0.3 * mat) * force, 0.0)
    return doux(y)


def soucoupe(rng: np.random.Generator, f1: float = 1250.0, duree: float = 0.3) -> np.ndarray:
    """Le bord de la soucoupe sur le comptoir: plus grave et plus court qu'une tasse, avec le corps."""
    y = porcelaine(rng, f1, duree, t60=0.18, mat=0.25)
    corps = ins.bois(rng, 240, duree, 0.6, t60=0.05) * 0.25
    return dsp.somme(y, corps)


def verre(rng: np.random.Generator, f1: float, duree: float = 0.35, t60: float = 0.4) -> np.ndarray:
    n = dsp.n_ech(duree)
    rap = [(1.0, 1.0), (2.66, 0.35), (4.95, 0.18), (7.6, 0.06)]
    y = dsp.modes(n, [(f1 * r, a, t60 / (1 + 0.7 * k)) for k, (r, a) in enumerate(rap)], rng, attaque=0.0002)
    dsp.poser(y, dsp.clic(rng, 2500, 8000, 0.002, 0.0004) * 0.3, 0.0)
    return doux(y)


def cuillere(rng: np.random.Generator, f1: float = 2600.0, duree: float = 0.2) -> np.ndarray:
    """Petite cuillère en inox: partiels d'une barre libre, très brefs."""
    n = dsp.n_ech(duree)
    y = dsp.modes(n, [(f1, 1.0, 0.12), (f1 * 2.76, 0.4, 0.06), (f1 * 5.4, 0.15, 0.03)], rng)
    return doux(y, 6500)


# --- Laiton accordé ------------------------------------------------------------------------

def clochette_ressort(rng: np.random.Generator, f: float, duree: float = 1.5, coups: int = 4) -> np.ndarray:
    """Clochette de laiton sur ressort (porte du village, son.md 8.5.9): le battant frappe plusieurs fois
    pendant que le ressort se balance, de plus en plus doucement, avec un léger vibrato d'amplitude."""
    y = dsp.toile(duree)
    t = 0.0
    for k in range(coups):
        g = 0.9 ** k * (1.0 if k == 0 else rng.uniform(0.35, 0.6))
        dsp.poser(y, ins.clochette(f, duree - t, rng, brillance=0.7 - 0.08 * k, t60=1.1) * g, t)
        t += rng.uniform(0.09, 0.16) * (1 + 0.25 * k)
        if t > duree * 0.6:
            break
    n = len(y)
    balancement = 1.0 + 0.12 * np.sin(2 * np.pi * 5.2 * np.arange(n) / SR) * np.exp(-np.arange(n) / SR / 0.5)
    return doux(y * balancement, 6500)


def cloche(rng: np.random.Generator, f: float, duree: float = 3.0, t60: float = 2.5) -> np.ndarray:
    """Cloche de bronze (clocher, pendule): partiels mineurs caractéristiques (hum, prime, tierce
    mineure, quinte, octave), tous assez brefs pour rester doux."""
    n = dsp.n_ech(duree)
    rap = [(0.5, 0.45, 1.0), (1.0, 1.0, 0.8), (1.19, 0.5, 0.6), (1.5, 0.3, 0.45), (2.0, 0.35, 0.4),
           (2.5, 0.12, 0.25), (3.0, 0.08, 0.2)]
    y = dsp.modes(n, [(f * r, a, t60 * tt) for r, a, tt in rap], rng, attaque=0.001)
    dsp.poser(y, dsp.clic(rng, 600, 4000, 0.006, 0.002) * 0.2, 0.0)
    return doux(y, 5000)


# --- Bois ----------------------------------------------------------------------------------

def bois(rng: np.random.Generator, f1: float = 220.0, duree: float = 0.3, durete: float = 0.7,
         t60: float = 0.09) -> np.ndarray:
    """Coup sur du bois, fondamentale audible sur un portable; claquement adouci."""
    return doux(ins.bois(rng, f1, duree, durete, t60=t60), 6000)


def bol_bois(rng: np.random.Generator, f: float, duree: float = 0.9) -> np.ndarray:
    """Bol de bois accordé (repère de l'autre, son.md 8.2.4): marimba feutré, très peu de partiels."""
    y = ins.marimba(f, duree, rng, t60=0.55, douceur=1.6)
    return doux(y, 5000)


def craquement(rng: np.random.Generator, duree: float = 0.3, f_bas: float = 300.0, f_haut: float = 2500.0,
               cadence: float = 120.0) -> np.ndarray:
    """Bois qui craque sous la charge: impulsions irrégulières filtrées par quelques résonances."""
    debit = lambda t: cadence * (0.6 + 0.8 * np.sin(np.pi * min(1.0, t / duree)))  # noqa: E731
    y = ins.crissement(rng, duree, debit, [(f_bas * 1.3, 8), (f_bas * 2.9, 10), (f_haut * 0.6, 6)], rugosite=0.4)
    return dsp.pbande(y, f_bas, f_haut) * dsp.env_ar(len(y), 0.02, duree * 0.4)


def frottement(rng: np.random.Generator, duree: float, f_bas: float = 200.0, f_haut: float = 1800.0,
               grain: float = 25.0) -> np.ndarray:
    """Un objet glisse (patins de feutre, carton): bruit étroit et grenu, sans crissement."""
    n = dsp.n_ech(duree)
    x = dsp.pbande(rng.standard_normal(n), f_bas, f_haut)
    mod = 0.6 + 0.4 * np.abs(dsp.pb(rng.standard_normal(n), grain, 2)) / 0.1
    mod = np.clip(mod / (mod.max() + 1e-9), 0.2, 1.0)
    return x * mod * dsp.env_ar(n, 0.03, duree * 0.35)


# --- Souffles, eau, liquides ------------------------------------------------------------------

def souffle(rng: np.random.Generator, duree: float, f_bas: float, f_haut: float, boucle: bool = False,
            pente: float = -3.0) -> np.ndarray:
    """Bruit coloré; périodique s'il s'agit d'une boucle (filtre dans le domaine fréquentiel)."""
    n = dsp.n_ech(duree)
    return dsp.bruit_spectral(n, rng, pente, f_bas, f_haut) if boucle else \
        dsp.pbande(rng.standard_normal(n), f_bas, f_haut)


def modulation(n: int, rng: np.random.Generator, cycles: list[tuple[int, float]], plancher: float = 0.5) -> np.ndarray:
    """Modulation lente périodique sur n échantillons: somme de sinus à nombre entier de cycles."""
    t = np.arange(n) / n
    m = np.zeros(n)
    for c, a in cycles:
        m += a * np.sin(2 * np.pi * c * t + rng.uniform(0, 2 * np.pi))
    m = (m - m.min()) / (m.max() - m.min() + 1e-12)
    return plancher + (1 - plancher) * m


def bulles(rng: np.random.Generator, duree: float, densite: float, f_bas: float, f_haut: float,
           tau: float = 0.006, boucle: bool = False) -> np.ndarray:
    """Nuage de petites bulles (filet d'eau, ébullition, lait qui frémit)."""
    return dsp.grains(duree, densite, lambda r: dsp.bulle(r, r.uniform(f_bas, f_haut), tau * r.uniform(0.6, 1.4))
                      * r.uniform(0.3, 1.0), rng, circulaire=boucle)


def filet(rng: np.random.Generator, duree: float, f_res: float | np.ndarray, epaisseur: float = 1.0,
          boucle: bool = False) -> np.ndarray:
    """Un liquide versé: ruissellement (bruit 300 Hz à 4 kHz), bulles, et la résonance du récipient
    (f_res, qui monte avec le remplissage si c'est un tableau)."""
    n = dsp.n_ech(duree)
    base = souffle(rng, duree, 250, 4500, boucle) * 0.5
    b = bulles(rng, duree, 220 * epaisseur, 500, 2400, 0.004, boucle)
    x = base + b * 1.4
    if np.ndim(f_res) == 0:
        res = dsp.circ(lambda y: dsp.resonateur(y, float(f_res), 6), x) if boucle else dsp.resonateur(x, float(f_res), 6)
    else:
        axe = np.arange(len(f_res)) / SR
        res = dsp.pb_variable(x, lambda t: float(np.interp(t, axe, f_res)), type_="band", q_bande=3.0)
    return x * 0.6 + res * 1.2


# --- Papier, craie ----------------------------------------------------------------------------

def papier(rng: np.random.Generator, duree: float, f_bas: float = 900.0, f_haut: float = 6000.0,
           crepitement: float = 50.0) -> np.ndarray:
    return doux(ins.froissement(rng, duree, f_bas, f_haut, crepitement, 0.01, duree * 0.4), 6500)


def craie(rng: np.random.Generator, duree: float, grain: float = 400.0) -> np.ndarray:
    """La craie sur l'ardoise: un grain sec et mat (impulsions denses filtrées 600 Hz à 4 kHz), sans
    aucune résonance aiguë: jamais de crissement (son.md, 8.1)."""
    n = dsp.n_ech(duree)
    imp = np.zeros(n)
    k = rng.poisson(grain * duree)
    pos = rng.integers(0, n, k)
    imp[pos] = rng.uniform(0.3, 1.0, k)
    x = dsp.pbande(imp + 0.15 * rng.standard_normal(n), 600, 4000)
    x = dsp.resonateur(x, rng.uniform(900, 1300), 2.5) * 0.6 + x * 0.6
    return x * dsp.env_ar(n, 0.006, duree * 0.5)


# --- Moteurs ----------------------------------------------------------------------------------

def moteur(n: int, f0: np.ndarray | float, rng: np.random.Generator, harmoniques: int = 10,
           pente: float = 0.75, f_max: float = 1900.0) -> np.ndarray:
    """Petit moteur électrique: fondamentale de rotation et harmoniques décroissantes, plafonnées
    sous 2 kHz (rien de tenu plus haut), avec un peu d'irrégularité."""
    f0 = np.full(n, f0) if np.ndim(f0) == 0 else f0
    y = np.zeros(n)
    for h in range(1, harmoniques + 1):
        fh = f0 * h
        a = pente ** (h - 1) * (1.0 if h % 2 else 0.7)
        y += a * np.where(fh < f_max, 1.0, 0.0) * dsp.sinus_glisse(fh, rng.uniform(0, 2 * np.pi))
    return y


def boucle_moteur(rng: np.random.Generator, duree: float, f0_cycles: float, harm: int = 10,
                  pente: float = 0.75) -> np.ndarray:
    """Moteur stable dans une boucle: fréquence choisie pour un nombre entier de cycles par boucle."""
    n = dsp.n_ech(duree)
    f0 = round(f0_cycles * duree) / duree
    t = np.arange(n) / SR
    y = np.zeros(n)
    for h in range(1, harm + 1):
        if f0 * h >= 1900:
            break
        a = pente ** (h - 1) * (1.0 if h % 2 else 0.7)
        y += a * np.sin(2 * np.pi * f0 * h * t + rng.uniform(0, 2 * np.pi))
    return y


def impulsions_boucle(rng: np.random.Generator, duree: float, densite: float, f_bas: float, f_haut: float,
                      longueur: float = 0.004) -> np.ndarray:
    """Craquements denses (grains broyés, gravillons) posés sur une ligne de temps circulaire."""
    return dsp.grains(duree, densite, lambda r: dsp.clic(r, f_bas, f_haut, longueur, longueur / 3)
                      * r.uniform(0.2, 1.0), rng, circulaire=True)
