"""Petits instruments de synthèse partagés par les effets, le train et les ambiances.

Timbres du jeu: bois, terre, laiton et clochettes; rien de numérique. Les notes des clochettes
et du marimba restent dans sol majeur (la tonalité du thème de jour), compatibles avec ré, do
et fa majeur des autres musiques: un tintement ne détonne jamais sur la musique en cours.
"""

from __future__ import annotations

import numpy as np

import dsp
from dsp import SR


def clochette(f: float, duree: float, rng: np.random.Generator, brillance: float = 1.0,
              t60: float = 1.4) -> np.ndarray:
    """Clochette à main en laiton: fondamentale et douzième (3 f) marquées, quelques partiels
    inharmoniques plus brefs, contact du battant."""
    n = dsp.n_ech(duree)
    b = brillance
    partiels = [
        (f, 1.0, t60), (f * 1.003, 0.35, t60 * 0.9),  # léger battement
        (f * 2.0, 0.10 * b, t60 * 0.45), (f * 3.0, 0.42 * b, t60 * 0.55),
        (f * 4.17, 0.10 * b, t60 * 0.25), (f * 5.43, 0.08 * b, t60 * 0.2),
    ]
    y = dsp.modes(n, partiels, rng, attaque=0.0008)
    contact = dsp.clic(rng, 2000, 9000, 0.004, 0.0008)
    dsp.poser(y, contact * 0.15 * b, 0.0)
    return y


def glock(f: float, duree: float, rng: np.random.Generator, t60: float = 1.2) -> np.ndarray:
    """Lame de métal frappée (partiels d'une barre libre: 2,756 et 5,404)."""
    n = dsp.n_ech(duree)
    return dsp.modes(n, [(f, 1.0, t60), (f * 2.756, 0.22, t60 * 0.3), (f * 5.404, 0.06, t60 * 0.12)], rng)


def marimba(f: float, duree: float, rng: np.random.Generator, t60: float | None = None,
            douceur: float = 1.0) -> np.ndarray:
    """Lame de bois accordée (partiels 1, 4 et 10), baguette de laine."""
    n = dsp.n_ech(duree)
    t60 = t60 if t60 is not None else float(np.clip(0.9 * (440.0 / f) ** 0.5, 0.25, 1.3))
    y = dsp.modes(n, [(f, 1.0, t60), (f * 3.99, 0.18 / douceur, t60 * 0.22), (f * 9.9, 0.04 / douceur, t60 * 0.07)],
                  rng, attaque=0.0015)
    y[: dsp.n_ech(0.004)] += dsp.clic(rng, 400, 3000, 0.004, 0.001)[: dsp.n_ech(0.004)] * 0.05
    return y


def bois(rng: np.random.Generator, f1: float, duree: float = 0.4, durete: float = 1.0,
         rapports=(1.0, 2.31, 4.1, 7.2), t60=0.12, amps=(1.0, 0.55, 0.3, 0.12)) -> np.ndarray:
    """Coup sur du bois: quelques modes amortis, plus un claquement bref."""
    n = dsp.n_ech(duree)
    partiels = []
    for r, a in zip(rapports, amps):
        partiels.append((f1 * r * rng.uniform(0.97, 1.03), a * rng.uniform(0.8, 1.2), t60 / (r ** 0.6)))
    y = dsp.modes(n, partiels, rng, attaque=0.0004)
    y[: dsp.n_ech(0.005)] += dsp.clic(rng, 1500, 9000, 0.005, 0.0012 * durete)[: dsp.n_ech(0.005)] * 0.5 * durete
    return y


def metal(rng: np.random.Generator, f1: float, duree: float = 0.5, t60: float = 0.3,
          rapports=(1.0, 1.59, 2.14, 2.65, 3.16), amps=(1.0, 0.7, 0.5, 0.35, 0.2)) -> np.ndarray:
    n = dsp.n_ech(duree)
    partiels = [(f1 * r * rng.uniform(0.99, 1.01), a, t60 / (1 + 0.4 * k)) for k, (r, a) in enumerate(zip(rapports, amps))]
    y = dsp.modes(n, partiels, rng, attaque=0.0002)
    y[: dsp.n_ech(0.003)] += dsp.clic(rng, 3000, 12000, 0.003, 0.0006)[: dsp.n_ech(0.003)] * 0.4
    return y


def bruit_bref(rng: np.random.Generator, duree: float, f_bas: float, f_haut: float, tau: float,
               attaque: float = 0.001) -> np.ndarray:
    n = dsp.n_ech(duree)
    return dsp.pbande(rng.standard_normal(n), f_bas, f_haut) * dsp.env_exp(n, tau, attaque)


def froissement(rng: np.random.Generator, duree: float, f_bas: float = 1500, f_haut: float = 8000,
                crepitement: float = 60.0, attaque: float = 0.02, relache: float = 0.1) -> np.ndarray:
    """Papier, tissu, feuilles: bruit filtré haché par une modulation irrégulière."""
    n = dsp.n_ech(duree)
    x = dsp.pbande(rng.standard_normal(n), f_bas, f_haut)
    hachage = np.abs(dsp.pb(rng.standard_normal(n), crepitement, 2))
    hachage = (hachage / (hachage.max() + 1e-12)) ** 1.6
    return x * hachage * dsp.env_ar(n, attaque, relache)


def crissement(rng: np.random.Generator, duree: float, debit: callable, resonances: list[tuple[float, float]],
               rugosite: float = 0.15) -> np.ndarray:
    """Grincement par frottement collé-glissé: train d'impulsions dont la cadence suit debit(t)
    (Hz), filtré par les résonances du bois (fréquence, facteur de qualité)."""
    n = dsp.n_ech(duree)
    t = np.arange(n) / SR
    cadence = np.array([debit(v) for v in t[::64]])
    cadence = np.repeat(cadence, 64)[:n]
    cadence *= 1 + rugosite * dsp.pb(rng.standard_normal(n), 30, 1) * 3
    phase = np.cumsum(cadence) / SR
    impulsions = np.zeros(n)
    passages = np.where(np.diff(np.floor(phase)) > 0)[0]
    impulsions[passages] = rng.uniform(0.6, 1.0, len(passages))
    y = np.zeros(n)
    for f, q in resonances:
        y += dsp.resonateur(impulsions, f, q)
    return y


def poule(rng: np.random.Generator, f0: float, duree: float, voyelle: str = "o", glisse: float = 0.0) -> np.ndarray:
    """Un « cot » de poule: son voisé (harmoniques), formants de voyelle, attaque sèche."""
    n = dsp.n_ech(duree)
    t = np.arange(n) / SR
    f = f0 * (1 + glisse * np.sin(np.pi * t / duree)) * (1 + 0.01 * dsp.pb(rng.standard_normal(n), 40) * 20)
    phase = 2 * np.pi * np.cumsum(f) / SR
    source = sum((1.0 / k ** 1.1) * np.sin(k * phase) for k in range(1, 18) if f0 * k < 9000)
    source *= 1 + 0.25 * np.sin(2 * np.pi * 45 * t)  # rugosité de la voix d'une poule
    formants = {"o": [(700, 6), (1250, 7), (2600, 9)], "a": [(950, 5), (1650, 7), (2900, 9)],
                "e": [(600, 6), (2000, 8), (2900, 9)]}[voyelle]
    y = sum(dsp.resonateur(source, fc, q) * g for (fc, q), g in zip(formants, (1.0, 0.7, 0.35)))
    return y * dsp.env_ar(n, 0.006, duree * 0.5, 1.2)


def coq(rng: np.random.Generator) -> np.ndarray:
    """Un coq de village, « co-co-ri-cooo »: quatre syllabes voisées, la dernière longue, montée
    puis descente de hauteur, voix éraillée."""
    syllabes = [(0.00, 0.13, 520, 560, "o"), (0.17, 0.13, 600, 640, "o"), (0.34, 0.20, 760, 820, "e"),
                (0.58, 0.95, 840, 620, "o")]
    toile = np.zeros(dsp.n_ech(1.7))
    for (t0, d, fa, fb, v) in syllabes:
        n = dsp.n_ech(d)
        t = np.arange(n) / SR
        courbe = np.interp(t, [0, d * 0.25, d], [fa * 0.92, fa, fb])
        courbe *= 1 + 0.012 * dsp.pb(rng.standard_normal(n), 25) * 25
        phase = 2 * np.pi * np.cumsum(courbe) / SR
        source = sum((1.0 / k ** 1.0) * np.sin(k * phase) for k in range(1, 14) if fa * k < 10000)
        source *= 1 + 0.35 * np.sin(2 * np.pi * 70 * t + rng.uniform(0, 6))  # éraillement
        souffle = dsp.pbande(rng.standard_normal(n), 1500, 6000) * 0.08
        form = {"o": [(800, 5), (1300, 6), (2700, 8)], "e": [(650, 5), (2100, 7), (3000, 8)]}[v]
        y = sum(dsp.resonateur(source + souffle, fc, q) * g for (fc, q), g in zip(form, (1.0, 0.6, 0.3)))
        y *= dsp.env_ar(n, 0.012, min(0.08, d * 0.4)) * (1.0 if d < 0.5 else dsp.env_points(n, [(0, 1), (d * 0.7, 0.9), (d, 0.5)]))
        dsp.poser(toile, y, t0)
    return toile
