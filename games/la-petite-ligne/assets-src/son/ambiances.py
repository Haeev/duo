"""Ambiances en boucle de La Petite Ligne (mono, pour garder la mémoire décodée petite).

Deux techniques de bouclage, toutes deux sans raccord:
- lits continus (rivière, vent, pluie): bruit périodique (FFT) et modulations dont la période
  divise la boucle, ou traitement variable sur la boucle plus une seconde, repliée en fondu à
  puissance constante;
- événements (oiseaux, grillons, bruits du village): posés sur une ligne de temps circulaire,
  ce qui dépasse la fin repart au début.

Les oiseaux restent génériques (aucune des 24 espèces du carnet n'est imitée): le coucou et le
pigeon ramier, très lointains, signent la campagne au printemps.
"""

from __future__ import annotations

import numpy as np

import dsp
import instruments as ins
from catalogue import Son
from dsp import SR


def boucler_par_fondu(x: np.ndarray, duree: float, fondu: float = 1.0) -> np.ndarray:
    """x dure au moins duree + fondu: la seconde de trop est repliée sur le début en fondu à
    puissance constante. La fin de la boucle enchaîne exactement sur ce qui suivait."""
    n = dsp.n_ech(duree)
    f = dsp.n_ech(fondu)
    y = x[:n].copy()
    a = np.sin(0.5 * np.pi * np.arange(f) / f)
    b = np.cos(0.5 * np.pi * np.arange(f) / f)
    y[:f] = x[:f] * a + x[n:n + f] * b
    return y


def lfo_periodique(n: int, cycles: list[tuple[int, float]], rng: np.random.Generator) -> np.ndarray:
    """Somme de sinus dont chaque période divise la boucle (cycles entiers): forme périodique."""
    t = np.arange(n) / n
    y = np.zeros(n)
    for c, a in cycles:
        y += a * np.sin(2 * np.pi * c * t + rng.uniform(0, 2 * np.pi))
    return y


def _riviere(v: int, rng: np.random.Generator) -> np.ndarray:
    duree = 24.0
    n = dsp.n_ech(duree)
    lit = dsp.filtre_circulaire(dsp.bruit_spectral(n, rng, -3.0), dsp.gain_bande(90, 5000)) * 0.35
    babil = dsp.filtre_circulaire(dsp.bruit_spectral(n, rng, -1.0), dsp.gain_bande(450, 2600))
    mod = np.abs(dsp.filtre_circulaire(dsp.bruit_spectral(n, rng, 0.0), dsp.gain_bande(1, 22)))
    babil *= (mod / (mod.max() + 1e-12)) ** 1.5 * 1.4
    y = lit + babil * 0.5
    y += dsp.grains(duree, 140, lambda r: dsp.bulle(r, float(np.exp(r.uniform(np.log(300), np.log(2200)))),
                                                    r.uniform(0.004, 0.02)) * r.uniform(0.05, 0.3), rng, circulaire=True)
    y += dsp.grains(duree, 5, lambda r: dsp.bulle(r, r.uniform(120, 280), r.uniform(0.03, 0.06), 1.2) * r.uniform(0.2, 0.5),
                    rng, circulaire=True)
    y *= 1 + 0.12 * lfo_periodique(n, [(3, 1.0), (7, 0.4)], rng)
    return y


def _vent(v: int, rng: np.random.Generator) -> np.ndarray:
    duree = 24.0
    n = dsp.n_ech(duree)
    rafales = 0.55 + 0.45 * np.clip(lfo_periodique(n, [(2, 0.6), (3, 0.35), (5, 0.2)], rng), -1, 1)
    corps = dsp.filtre_circulaire(dsp.bruit_spectral(n, rng, -4.0), dsp.gain_bande(150, 900)) * 0.6
    feuillage = dsp.filtre_circulaire(dsp.bruit_spectral(n, rng, -1.0), dsp.gain_bande(1800, 8000))
    frisson = np.abs(dsp.filtre_circulaire(dsp.bruit_spectral(n, rng, 0.0), dsp.gain_bande(4, 25)))
    feuillage *= (frisson / (frisson.max() + 1e-12)) * 1.6
    return corps * rafales + feuillage * rafales ** 2 * 0.45


def _f_chant(rng, notes, base=1.0):
    """Une phrase d'oiseau: liste de (début s, durée s, f départ, f arrivée, amplitude, vibrato Hz)."""
    fin = max(t + d for t, d, *_ in notes)
    y = dsp.toile(fin + 0.05)
    for (t0, d, fa, fb, a, vib) in notes:
        m = dsp.n_ech(d)
        tt = np.arange(m) / SR
        f = np.linspace(fa, fb, m) * base
        if vib:
            f = f * (1 + 0.04 * np.sin(2 * np.pi * vib * tt))
        son = dsp.sinus_glisse(f) + 0.12 * dsp.sinus_glisse(2 * f)
        dsp.poser(y, son * dsp.env_ar(m, min(0.008, d * 0.3), min(0.02, d * 0.4)) * a, t0)
    return y


def _oiseau(rng: np.random.Generator, espece: int) -> np.ndarray:
    if espece == 0:  # trille rapide qui descend un peu
        k = rng.integers(8, 14)
        cad = rng.uniform(12, 17)
        return _f_chant(rng, [(i / cad, 0.045, 4700 - 40 * i, 3900 - 40 * i, 0.6 + 0.4 * (i < k // 2), 0) for i in range(k)],
                        rng.uniform(0.92, 1.08))
    if espece == 1:  # « tsip » répétés
        return _f_chant(rng, [(i * 0.16, 0.045, 6600, 4600, 0.7, 0) for i in range(rng.integers(3, 6))],
                        rng.uniform(0.9, 1.1))
    if espece == 2:  # phrase flûtée et lente
        notes = []
        t = 0.0
        for _ in range(rng.integers(4, 7)):
            d = rng.uniform(0.08, 0.22)
            fa = rng.uniform(1800, 2900)
            notes.append((t, d, fa, fa * rng.uniform(0.85, 1.2), rng.uniform(0.5, 1.0), rng.uniform(0, 30)))
            t += d + rng.uniform(0.03, 0.12)
        return _f_chant(rng, notes)
    if espece == 3:  # « ti-tu ti-tu ti-tu »
        notes = []
        for i in range(3):
            notes.append((i * 0.34, 0.08, 4300, 4200, 0.7, 0))
            notes.append((i * 0.34 + 0.12, 0.13, 3250, 3150, 0.8, 0))
        return _f_chant(rng, notes, rng.uniform(0.95, 1.05))
    if espece == 4:  # coucou, très loin
        notes = [(0.0, 0.26, 690, 670, 1.0, 0), (0.36, 0.34, 570, 555, 0.9, 0)]
        y = _f_chant(rng, notes)
        return dsp.pb(y, 1800)
    # pigeon ramier, loin: « hou-HOU-hou, hou-hou »
    notes = [(0.0, 0.3, 470, 500, 0.6, 0), (0.42, 0.5, 520, 540, 1.0, 0), (1.02, 0.28, 490, 470, 0.6, 0),
             (1.55, 0.3, 500, 480, 0.6, 0), (1.95, 0.32, 490, 470, 0.5, 0)]
    y = _f_chant(rng, notes)
    souffle = dsp.pbande(rng.standard_normal(len(y)), 300, 900) * 0.05 * np.abs(y)
    return dsp.pb(y + souffle, 1500)


def _oiseaux(v: int, rng: np.random.Generator) -> np.ndarray:
    duree = 36.0
    y = dsp.toile(duree)
    plan = [(0.5, 2, 0.8), (2.9, 0, 0.5), (5.2, 3, 0.6), (7.8, 1, 0.35), (9.6, 2, 0.9), (12.4, 4, 0.5),
            (14.0, 0, 0.7), (16.8, 3, 0.4), (18.9, 2, 0.6), (21.5, 1, 0.5), (23.6, 5, 0.45), (26.7, 0, 0.45),
            (28.4, 2, 0.75), (31.2, 3, 0.55), (33.9, 1, 0.4), (35.1, 0, 0.3)]
    for t, espece, gain in plan:
        chant = _oiseau(rng, espece)
        if gain < 0.5:  # les plus faibles sont aussi plus loin: aigus amortis
            chant = dsp.pb(chant, 3500)
        dsp.poser(y, chant * gain, t + rng.uniform(-0.2, 0.2), circulaire=True)
    ir = dsp.ir_salle(1.6, 0.03, 0.4, graine=31)
    humide = dsp.reverbe_mono(y, ir, 0.22, 1.0)
    out = humide[: len(y)].copy()
    out[: len(humide) - len(y)] += humide[len(y):]  # queue de réverbération repliée au début
    return out


def _grillons(v: int, rng: np.random.Generator) -> np.ndarray:
    duree = 20.0
    n = dsp.n_ech(duree)
    y = np.zeros(n)
    for c, (f, intervalle, gain, impulsions) in enumerate(((4650, 0.50, 1.0, 3), (4900, 0.625, 0.6, 4),
                                                           (4400, 0.40, 0.4, 3), (5150, 0.80, 0.3, 4))):
        decal = rng.uniform(0, intervalle)
        for k in range(int(round(duree / intervalle))):
            t0 = decal + k * intervalle + rng.uniform(-0.01, 0.01)
            for p in range(impulsions):
                m = dsp.n_ech(0.016)
                tt = np.arange(m) / SR
                pulse = np.sin(2 * np.pi * f * tt) * np.sin(np.pi * tt / 0.016) ** 2
                dsp.poser(y, pulse * gain * (0.85 + 0.15 * rng.uniform()), t0 + p * 0.032, circulaire=True)
    t = np.arange(n) / SR
    trille = np.sin(2 * np.pi * 2800 * t) * (0.5 + 0.5 * np.sin(2 * np.pi * 50 * t)) * 0.08
    trille *= 0.6 + 0.4 * lfo_periodique(n, [(2, 1.0)], rng)
    y += trille
    for k in range(8):  # l'alyte, petit crapaud des murets: une note pure, au loin
        m = dsp.n_ech(0.12)
        tt = np.arange(m) / SR
        dsp.poser(y, np.sin(2 * np.pi * 1350 * tt) * dsp.env_ar(m, 0.01, 0.06) * 0.25, 1.1 + k * 2.5, circulaire=True)
    y += dsp.filtre_circulaire(dsp.bruit_spectral(n, rng, -3.0), dsp.gain_bande(100, 1500)) * 0.03
    return dsp.pb(y, 7000)


def _village(v: int, rng: np.random.Generator) -> np.ndarray:
    """Le bourg au loin: marteau de Basile, une scie, la clochette de la porte de l'épicerie, une
    sonnette de vélo, un volet, des poules, une brouette. Aucune voix."""
    duree = 40.0
    n = dsp.n_ech(duree)
    y = dsp.filtre_circulaire(dsp.bruit_spectral(n, rng, -4.0), dsp.gain_bande(60, 900)) * 0.04

    def loin(x: np.ndarray, fc: float = 2500) -> np.ndarray:
        return dsp.pb(x, fc)

    for t0, nb in ((2.0, 5), (17.5, 4), (31.0, 6)):
        for k in range(nb):
            coup = dsp.somme(ins.bois(rng, rng.uniform(280, 340), 0.25, 1.0, t60=0.08),
                             ins.metal(rng, rng.uniform(2400, 2800), 0.2, t60=0.06) * 0.3)
            dsp.poser(y, loin(coup) * 0.25, t0 + k * rng.uniform(0.42, 0.55), circulaire=True)
    for k, t0 in enumerate((8.0, 8.6, 9.2)):
        m = dsp.n_ech(0.45)
        trait = dsp.pbande(rng.standard_normal(m), 1200, 4500) * np.sin(np.pi * np.arange(m) / m) ** 1.5
        dsp.poser(y, loin(trait) * 0.1, t0, circulaire=True)
    porte = dsp.somme(ins.clochette(dsp.freq("E6"), 1.0, rng, 0.8, 0.6), ins.clochette(dsp.freq("B6"), 1.0, rng, 0.6, 0.5) * 0.6)
    dsp.poser(y, loin(porte, 4000) * 0.12, 12.3, circulaire=True)
    dsp.poser(y, loin(porte, 4000) * 0.09, 12.42, circulaire=True)
    for t0 in (24.0, 24.45):
        velo = np.zeros(dsp.n_ech(0.8))
        for k in range(5):
            dsp.poser(velo, ins.metal(rng, 2150, 0.6, t60=0.5, rapports=(1.0, 1.52, 2.6), amps=(1.0, 0.5, 0.3)) * 0.4,
                      k * 0.055)
        dsp.poser(y, loin(velo, 5000) * 0.14, t0, circulaire=True)
    dsp.poser(y, loin(ins.bois(rng, 140, 0.4, 1.0, t60=0.15), 2000) * 0.25, 27.8, circulaire=True)
    for t0 in (5.5, 20.5, 36.0):
        for k in range(rng.integers(2, 4)):
            dsp.poser(y, loin(ins.poule(rng, rng.uniform(340, 390), 0.07), 2200) * 0.08, t0 + 0.16 * k, circulaire=True)
    for k in range(3):
        g = ins.crissement(rng, 0.25, lambda u: 160 + 120 * u, [(900, 10), (1800, 12)], 0.1)
        dsp.poser(y, loin(g * dsp.env_ar(len(g), 0.03, 0.1), 2500) * 0.06, 14.5 + 0.55 * k, circulaire=True)
    ir = dsp.ir_salle(2.2, 0.04, 0.35, graine=32)
    humide = dsp.reverbe_mono(y, ir, 0.35, 1.0)
    out = humide[:n].copy()
    out[: len(humide) - n] += humide[n:]
    return out


def _pluie(v: int, rng: np.random.Generator) -> np.ndarray:
    duree = 16.0
    n = dsp.n_ech(duree)
    lit = dsp.filtre_circulaire(dsp.bruit_spectral(n, rng, -2.0), dsp.gain_bande(300, 8000)) * 0.3
    lit *= 1 + 0.1 * lfo_periodique(n, [(2, 1.0), (5, 0.5)], rng)
    gouttes = dsp.grains(duree, 2200, lambda r: dsp.clic(r, 1200, 9000, 0.003, 0.0006) * r.uniform(0.05, 0.4), rng,
                         circulaire=True)
    flaques = dsp.grains(duree, 35, lambda r: dsp.bulle(r, r.uniform(800, 2600), r.uniform(0.003, 0.009)) * r.uniform(0.1, 0.4),
                         rng, circulaire=True)
    return lit + gouttes * 0.5 + flaques * 0.6


def _pluie_toit(v: int, rng: np.random.Generator) -> np.ndarray:
    duree = 16.0
    n = dsp.n_ech(duree)
    lit = dsp.filtre_circulaire(dsp.bruit_spectral(n, rng, -4.0), dsp.gain_bande(120, 2200)) * 0.35
    tuiles = dsp.grains(duree, 900, lambda r: ins.bruit_bref(r, 0.01, 400, 3000, r.uniform(0.001, 0.003)) * r.uniform(0.05, 0.35),
                        rng, circulaire=True)
    gouttiere = dsp.grains(duree, 3, lambda r: dsp.bulle(r, r.uniform(900, 1700), r.uniform(0.006, 0.012)) * r.uniform(0.3, 0.6),
                           rng, circulaire=True)
    return lit + tuiles * 0.45 + gouttiere * 0.5


def sons() -> list[Son]:
    return [
        Son("river", "Rivière Aubrune (le long du bord sud)", "ambiance", "ambience", _riviere, 1, -26.0, 4, 0.0, 0.0,
            "loin", boucle=True, passe_haut=60,
            note="plusieurs sources réparties le long de la rivière (une tous les 15 m), chacune à son propre "
                 "décalage de départ"),
        Son("wind", "Vent léger dans les arbres", "ambiance", "ambience", _vent, 1, -30.0, 4, 0.0, 0.0, None, boucle=True,
            passe_haut=80, note="non placé; plus fort près de la lisière (x 50 à 64, y 36 à 48)"),
        Son("birds-morning", "Oiseaux du matin (6 h à 12 h, plus rares l'après-midi)", "ambiance", "ambience",
            _oiseaux, 1, -28.0, 4, 0.0, 0.0, None, boucle=True, passe_haut=500,
            note="se tait par temps de pluie et à partir de 19 h"),
        Son("crickets", "Grillons du soir (dès 19 h, et la nuit)", "ambiance", "ambience", _grillons, 1, -31.0, 4,
            0.0, 0.0, None, boucle=True, passe_haut=300),
        Son("village", "Petit bruit du bourg (8 h à 19 h)", "ambiance", "ambience", _village, 1, -32.0, 4, 0.0, 0.0,
            None, boucle=True, passe_haut=80, note="plus présent sur la place, plus loin à la maisonnette"),
        Son("rain", "Pluie dehors (jour 4)", "ambiance", "ambience", _pluie, 1, -27.0, 4, 0.0, 0.0, None, boucle=True,
            passe_haut=150),
        Son("rain-roof", "Pluie sur le toit, à l'intérieur de la maisonnette", "ambiance", "ambience", _pluie_toit, 1,
            -29.0, 4, 0.0, 0.0, None, boucle=True, passe_haut=80),
    ]
