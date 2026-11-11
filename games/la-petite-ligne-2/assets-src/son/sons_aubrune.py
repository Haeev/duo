"""Sons d'Aubrune, deuxième lot: pêche, cuisine, décoration, cloches et sonneries, portes,
boutique, décision à deux, photo, pas sur bois, eau, gravier et tapis.

Même couleur que le lot L9 (bois, tissu, papier, eau, clochettes en sol majeur), même chaîne:
chaque fabrique rend un tableau mono à 48 kHz que `generer.ecrire` normalise et encode.
Les sons qui doivent s'entendre sur un haut-parleur de portable gardent l'essentiel de leur
énergie au-dessus de 300 Hz (contrôlé par `mesurer_lot.py`).
"""

from __future__ import annotations

from typing import Callable

import numpy as np

import dsp
from dsp import SR, env_ar, env_exp, n_ech, modes, poser, toile


def hz(midi: float) -> float:
    return dsp.midi_freq(midi)


def ton(f: float, duree: float, tau: float, harm: tuple[float, ...] = (1.0,), attaque: float = 0.004) -> np.ndarray:
    n = n_ech(duree)
    t = np.arange(n) / SR
    y = sum(a * np.sin(2 * np.pi * f * (k + 1) * t) for k, a in enumerate(harm))
    return y * env_exp(n, tau, attaque)


def tinte(g: np.random.Generator, midi: float, duree: float, t60: float) -> np.ndarray:
    """Petite lame de verre ou de métal accordée (partiels de barre libre, inharmoniques doux)."""
    f = hz(midi)
    return modes(n_ech(duree), [(f, 1.0, t60), (f * 2.76, 0.28, t60 * 0.5), (f * 5.4, 0.08, t60 * 0.25)], g, 0.0006)


def bois(g: np.random.Generator, f: float, duree: float, t60: float, grain: float = 0.5) -> np.ndarray:
    """Coup de bois: fondamentale au-dessus de 200 Hz (portable), partiels et craquement."""
    n = n_ech(duree)
    y = modes(n, [(f, 0.7, t60), (f * 2.3, 0.6, t60 * 0.7), (f * 4.1, 0.3, t60 * 0.45)], g, 0.0004)
    y += dsp.pbande(g.standard_normal(n), 1200, 5000) * env_exp(n, 0.006, 0.0004) * grain
    return dsp.ph(y, 180)


# --- Pêche ---------------------------------------------------------------------------------------

def peche_lancer(g: np.random.Generator) -> np.ndarray:
    # Fouet de la canne, fil qui file du moulinet, puis le bouchon qui se pose (à 0,62 s).
    y = toile(0.95)
    n = n_ech(0.3)
    fouet = dsp.pbande(g.standard_normal(n), 900, 4200) * dsp.env_points(n, [(0, 0), (0.12, 1.0), (0.3, 0)])
    poser(y, fouet * 0.7, 0.0)
    t = 0.08
    pas_ = 1 / 45
    while t < 0.55:
        poser(y, dsp.clic(g, 2500, 8000, 0.003, 0.0008) * 0.25, t)
        t += pas_
        pas_ *= 1.06
    m = n_ech(0.2)
    poser(y, dsp.pbande(g.standard_normal(m), 600, 3500) * env_exp(m, 0.03, 0.002) * 0.5, 0.62)
    poser(y, dsp.bulle(g, 620, 0.02, 0.8) * 0.8, 0.63)
    return y


def peche_bouchon(g: np.random.Generator) -> np.ndarray:
    # Le bouchon frétille et plonge: « bloup » rond.
    y = toile(0.4)
    poser(y, dsp.bulle(g, 380, 0.035, 1.4), 0.0)
    poser(y, dsp.bulle(g, 720, 0.018, 1.0) * 0.5, 0.06)
    n = n_ech(0.12)
    poser(y, dsp.pbande(g.standard_normal(n), 800, 4000) * env_exp(n, 0.02, 0.001) * 0.25, 0.0)
    return y


def peche_touche(g: np.random.Generator) -> np.ndarray:
    # Ça mord: le bouchon plonge, et deux tintements clairs (sol 6, ré 7) disent « maintenant ».
    y = peche_bouchon(g) * 0.7
    y = np.concatenate([y, np.zeros(n_ech(0.2))])
    poser(y, tinte(g, 91, 0.35, 0.25), 0.03)
    poser(y, tinte(g, 98, 0.4, 0.3) * 0.8, 0.11)
    return y


def peche_moulinet(g: np.random.Generator) -> np.ndarray:
    # Cliquet du moulinet qui ramène la ligne, un peu plus vite à la fin.
    y = toile(0.75)
    t = 0.0
    cadence = 22.0
    while t < 0.68:
        c = dsp.clic(g, 1800, 7000, 0.004, 0.001) * g.uniform(0.6, 1.0)
        poser(c, modes(n_ech(0.02), [(1250, 0.4, 0.015)], g), 0.0)
        poser(y, c, t)
        t += 1 / cadence
        cadence = min(32.0, cadence * 1.03)
    return y * dsp.env_points(len(y), [(0, 0.7), (0.1, 1.0), (0.6, 1.0), (0.75, 0.6)])


def peche_prise(g: np.random.Generator) -> np.ndarray:
    # Le poisson sort de l'eau: gerbe, gouttes qui retombent.
    y = toile(1.0)
    n = n_ech(0.35)
    gerbe = dsp.pbande(g.standard_normal(n), 500, 6500) * dsp.env_points(n, [(0, 0), (0.015, 1.0), (0.35, 0)])
    poser(y, gerbe * 0.8, 0.0)
    poser(y, dsp.bulle(g, 520, 0.025, 1.2) * 0.6, 0.01)
    for _ in range(14):
        poser(y, dsp.bulle(g, g.uniform(1300, 3200), g.uniform(0.006, 0.014)) * g.uniform(0.15, 0.35),
              g.uniform(0.18, 0.85))
    return y


def peche_casse(g: np.random.Generator) -> np.ndarray:
    # La ligne lâche: petit claquement, corde qui vibre en redescendant, fil qui retombe. Doux.
    y = toile(0.6)
    poser(y, dsp.clic(g, 2000, 9000, 0.004, 0.001) * 1.2, 0.0)
    n = n_ech(0.4)
    t = np.arange(n) / SR
    f = hz(86) * (1 - 0.18 * np.minimum(t / 0.3, 1.0))
    corde = (dsp.sinus_glisse(f) + 0.3 * dsp.sinus_glisse(2 * f)) * env_exp(n, 0.09, 0.001)
    poser(y, corde * 0.6, 0.005)
    m = n_ech(0.3)
    poser(y, dsp.pbande(g.standard_normal(m), 1500, 5000) * env_ar(m, 0.05, 0.2) * 0.15, 0.15)
    return y


# --- Cuisine -------------------------------------------------------------------------------------

def cuisine_decoupe(g: np.random.Generator) -> np.ndarray:
    # Couteau sur la planche: coup de bois sec et tranchant de la lame.
    y = bois(g, g.uniform(560, 760), 0.14, 0.05, 0.9)
    poser(y, dsp.clic(g, 3000, 9000, 0.006, 0.0015) * 0.6, 0.0)
    return y


def cuisine_mijote(g: np.random.Generator) -> np.ndarray:
    # Marmite qui frémit: bulles rondes, couvercle qui tinte une fois.
    duree = 1.3
    y = toile(duree)
    n = n_ech(duree)
    y += dsp.pbande(g.standard_normal(n), 300, 1500) * env_ar(n, 0.15, 0.4) * 0.05
    for _ in range(16):
        poser(y, dsp.bulle(g, g.uniform(280, 700), g.uniform(0.012, 0.03), 1.0) * g.uniform(0.3, 0.7),
              g.uniform(0.0, duree - 0.25))
    poser(y, modes(n_ech(0.4), [(1870, 0.3, 0.25), (4300, 0.1, 0.1)], g), 0.55)
    return y


def cuisine_friture(g: np.random.Generator) -> np.ndarray:
    # Poêle qui grésille: souffle aigu et crépitements.
    duree = 1.3
    n = n_ech(duree)
    souffle = dsp.pbande(g.standard_normal(n), 2500, 9000) * dsp.env_points(n, [(0, 0), (0.06, 1.0), (0.9, 0.7), (1.3, 0)])
    y = souffle * 0.35
    crepite = dsp.grains(duree, 90, lambda r: dsp.clic(r, 2000, 9000, 0.003, 0.0007) * r.uniform(0.2, 1.0), g,
                         enveloppe=lambda t: 1.0 if t < 0.9 else max(0.0, 1 - (t - 0.9) / 0.4))
    return y + crepite * 0.6


def plat_reussi(g: np.random.Generator) -> np.ndarray:
    # Le plat sort: tintement d'assiette et trois notes qui montent (ré, sol, si).
    y = toile(0.9)
    poser(y, modes(n_ech(0.3), [(2380, 0.5, 0.2), (5900, 0.2, 0.08)], g), 0.0)
    for i, m in enumerate((86, 91, 95)):
        poser(y, tinte(g, m, 0.6, 0.45), 0.06 + 0.08 * i, 0.85 ** i)
    return dsp.pb(y, 9000)


def plat_rate(g: np.random.Generator) -> np.ndarray:
    # Raté sans drame: deux notes de bois qui descendent (ré, si) et un « plof » de pâte.
    y = toile(0.6)
    for i, m in enumerate((74, 71)):
        f = hz(m)
        poser(y, modes(n_ech(0.3), [(f, 1.0, 0.18), (f * 3.9, 0.25, 0.06)], g, 0.001), 0.12 * i, 0.9 ** i)
    poser(y, dsp.bulle(g, 300, 0.03, 0.6) * 0.5, 0.26)
    return y


# --- Décoration ----------------------------------------------------------------------------------

def meuble_poser(g: np.random.Generator) -> np.ndarray:
    # Un meuble posé: pied de bois sur le plancher, deux appuis rapprochés.
    y = toile(0.35)
    f = g.uniform(250, 290)
    poser(y, bois(g, f, 0.3, 0.12, 0.35), 0.0)
    poser(y, bois(g, f * 1.07, 0.25, 0.09, 0.3), g.uniform(0.04, 0.07), 0.6)
    return y


def meuble_tourner(g: np.random.Generator) -> np.ndarray:
    # Quart de tour: le pied frotte et grince brièvement, puis se cale.
    n = n_ech(0.42)
    t = np.arange(n) / SR
    frotte = dsp.pbande(g.standard_normal(n), 500, 2600) * env_ar(n, 0.04, 0.25)
    frotte *= 0.55 + 0.45 * np.sin(2 * np.pi * 42 * t)
    y = frotte * 0.5
    poser(y, bois(g, 300, 0.15, 0.06, 0.2) * 0.6, 0.28)
    return y


def meuble_soulever(g: np.random.Generator) -> np.ndarray:
    # On prend un meuble: petit craquement du bois qui quitte le sol, souffle de tissu.
    y = toile(0.3)
    poser(y, bois(g, 330, 0.12, 0.05, 0.6) * 0.6, 0.0)
    n = n_ech(0.22)
    poser(y, dsp.pbande(g.standard_normal(n), 700, 3000) * env_ar(n, 0.05, 0.15) * 0.25, 0.03)
    return y


def meuble_ranger(g: np.random.Generator) -> np.ndarray:
    # Rangé dans la malle: froissement, couvercle doux, une note de verre (sol 5).
    y = toile(0.55)
    n = n_ech(0.25)
    poser(y, dsp.pbande(g.standard_normal(n), 900, 5000) * env_ar(n, 0.06, 0.16) * 0.35, 0.0)
    poser(y, bois(g, 270, 0.2, 0.08, 0.3) * 0.7, 0.2)
    poser(y, tinte(g, 79, 0.35, 0.3) * 0.35, 0.22)
    return y


# --- Portes, boutique, argent, décision, photo ------------------------------------------------------

def porte(g: np.random.Generator) -> np.ndarray:
    # Le loquet, la porte qui tourne avec un petit grincement, puis qui se referme derrière soi.
    y = toile(1.15)
    poser(y, modes(n_ech(0.08), [(1900, 0.6, 0.04), (3700, 0.3, 0.02)], g), 0.0)
    poser(y, dsp.clic(g, 2000, 7000, 0.005, 0.001) * 0.35, 0.0)
    n = n_ech(0.4)
    t = np.arange(n) / SR
    f = 380 + 140 * t / 0.4
    grince = dsp.sinus_glisse(f) * (0.5 + 0.5 * np.sin(2 * np.pi * 30 * t) ** 2)
    grince += 0.4 * dsp.sinus_glisse(2.01 * f)
    poser(y, grince * env_ar(n, 0.08, 0.25) * 0.3, 0.08)
    poser(y, dsp.pbande(g.standard_normal(n), 400, 1800) * env_ar(n, 0.1, 0.25) * 0.25, 0.08)
    poser(y, bois(g, 245, 0.3, 0.14, 0.4), 0.78, 0.45)
    poser(y, modes(n_ech(0.06), [(2100, 0.5, 0.03), (4100, 0.2, 0.015)], g), 0.81)
    return y


def clochette_boutique(g: np.random.Generator) -> np.ndarray:
    # Clochette de laiton sur ressort, au-dessus de la porte: deux timbres (si 6, ré 7) qui se balancent.
    y = toile(1.4)
    for k, (t0, a) in enumerate(((0.0, 1.0), (0.11, 0.7), (0.24, 0.5), (0.4, 0.3))):
        m = 95 if k % 2 == 0 else 98
        f = hz(m) * g.uniform(0.998, 1.002)
        poser(y, modes(n_ech(1.0), [(f, 1.0, 0.8), (f * 2.42, 0.35, 0.35), (f * 4.1, 0.12, 0.15)], g, 0.0004), t0, a)
    return dsp.pb(y, 10000)


def piece(g: np.random.Generator, f: float, t60: float) -> np.ndarray:
    return modes(n_ech(t60 * 1.2), [(f, 1.0, t60), (f * 1.52, 0.6, t60 * 0.7), (f * 2.4, 0.3, t60 * 0.5)], g, 0.0002)


def pieces_achat(g: np.random.Generator) -> np.ndarray:
    # On paie: les pièces se posent une à une sur le comptoir de bois.
    y = toile(0.55)
    for i in range(3):
        t0 = 0.0 + 0.09 * i + g.uniform(-0.01, 0.01)
        poser(y, piece(g, g.uniform(2900, 3600), 0.18), t0, 0.9 - 0.15 * i)
        poser(y, bois(g, 520, 0.08, 0.03, 0.2) * 0.35, t0)
    return y


def pieces_vente(g: np.random.Generator) -> np.ndarray:
    # On est payé: les pièces tintent ensemble et tombent dans la bourse (étouffées à la fin).
    y = toile(0.6)
    for i in range(4):
        poser(y, piece(g, g.uniform(3300, 4300), 0.25), 0.03 * i + g.uniform(0, 0.015), 0.8)
    n = n_ech(0.2)
    poser(y, dsp.pbande(g.standard_normal(n), 500, 2500) * env_exp(n, 0.03, 0.002) * 0.4, 0.22)
    poser(y, dsp.pb(piece(g, 3000, 0.12), 1800) * 0.6, 0.22)
    return y


def decision_accord(g: np.random.Generator) -> np.ndarray:
    # Les deux ont choisi pareil: deux notes qui se rejoignent en accord de sol (ré, sol, puis si).
    y = toile(0.9)
    poser(y, tinte(g, 74, 0.7, 0.5), 0.0, 0.8)
    poser(y, tinte(g, 79, 0.7, 0.5), 0.0, 0.8)
    poser(y, tinte(g, 83, 0.7, 0.55), 0.12)
    poser(y, tinte(g, 91, 0.6, 0.4) * 0.35, 0.12)
    return dsp.pb(y, 9000)


def decision_desaccord(g: np.random.Generator) -> np.ndarray:
    # Choix différents: deux notes séparées qui ne se rejoignent pas (do, puis la), en suspens.
    y = toile(0.7)
    poser(y, tinte(g, 84, 0.45, 0.3), 0.0, 0.8)
    poser(y, tinte(g, 81, 0.5, 0.35), 0.16, 0.7)
    return dsp.pb(y, 8000)


def photo_declic(g: np.random.Generator) -> np.ndarray:
    # Appareil à soufflet du Contrôleur: déclencheur, rideau, ressort qui se détend.
    y = toile(0.32)
    poser(y, dsp.somme(modes(n_ech(0.05), [(2600, 0.6, 0.03), (5100, 0.3, 0.015)], g), dsp.clic(g, 2000, 8000, 0.004, 0.0008)), 0.0)
    n = n_ech(0.06)
    poser(y, dsp.pbande(g.standard_normal(n), 1500, 6000) * env_ar(n, 0.005, 0.05) * 0.35, 0.01)
    poser(y, dsp.somme(modes(n_ech(0.12), [(1700, 0.5, 0.08), (3300, 0.25, 0.04)], g), dsp.clic(g, 1500, 6000, 0.004, 0.001)), 0.075, 0.8)
    return y


# --- Cloches et sonneries (entendues dans tout le lieu) ----------------------------------------------

def coup_de_cloche(g: np.random.Generator, f: float, duree: float, faux: float = 0.0) -> np.ndarray:
    """Cloche d'église accordée en majeur (tierce majeure, pour rester dans l'accord de sol).
    Partiels rapportés à la note de frappe f: bourdon, fondamentale, tierce, quinte, nominal,
    puis les aigus. `faux` désaccorde les partiels et ajoute un battement (cloche fêlée)."""
    rapports = [(0.5, 0.35, 1.0), (1.0, 0.5, 0.7), (1.26, 0.45, 0.6), (1.5, 0.25, 0.45),
                (2.0, 1.0, 0.5), (2.52, 0.35, 0.3), (3.0, 0.35, 0.22), (4.0, 0.2, 0.14), (5.33, 0.08, 0.09)]
    partiels = []
    for r, a, part in rapports:
        ecart = 1 + faux * g.uniform(-0.03, 0.03) if r > 0.6 else 1.0
        partiels.append((f * r * ecart, a, duree * part))
        if faux > 0 and r >= 1.0:
            partiels.append((f * r * ecart * (1 + 0.012 * faux), a * 0.7, duree * part * 0.6))
    y = modes(n_ech(duree), partiels, g, 0.001)
    n = n_ech(0.03)
    y[:n] += dsp.pbande(g.standard_normal(n), 1500, 6000) * env_exp(n, 0.006) * 0.4
    if faux > 0:
        n = n_ech(0.25)
        rale = dsp.pbande(g.standard_normal(n), 1800, 5000) * env_exp(n, 0.08) * 0.15 * faux
        y[:n] += rale
    return y


def de_loin(x: np.ndarray, rt60: float, humide: float, coupure: float, graine: int) -> np.ndarray:
    ir = dsp.ir_salle(rt60, 0.03, 0.4, graine)
    return dsp.pb(dsp.reverbe_mono(x, ir, humide), coupure)


def cloche_marthe(g: np.random.Generator) -> np.ndarray:
    # La grande cloche, juste, sonnée par Marthe: trois coups (sol 4 au nominal), depuis le clocher.
    # Chaque coup résonne sous le suivant (toile assez longue: aucun coup tronqué).
    y = toile(2.8 + 5.0)
    for i in range(3):
        poser(y, coup_de_cloche(g, hz(67), 5.0), 1.4 * i, 1.0)
    return dsp.fondu(de_loin(y, 2.2, 0.35, 6000, 31)[:n_ech(8.5)], 0.0, 0.8)


def cloche_marthe_coup(g: np.random.Generator) -> np.ndarray:
    # Un seul coup de la grande cloche (heures sonnées coup par coup, point d'accroche à venir).
    y = toile(5.0)
    poser(y, coup_de_cloche(g, hz(67), 5.0), 0.0)
    return dsp.fondu(de_loin(y, 2.2, 0.35, 6000, 31)[:n_ech(5.5)], 0.0, 0.6)


def cloche_felee(g: np.random.Generator) -> np.ndarray:
    # La Fêlée: petite cloche fendue, un peu fausse, qui bat et râpe. Plus drôle qu'inquiétante.
    y = toile(2.3 + 1.6)
    for i in range(3):
        poser(y, coup_de_cloche(g, hz(74) * 0.985, 1.6, faux=1.0), 1.15 * i, 0.95 ** i)
    return dsp.fondu(de_loin(y, 1.6, 0.3, 6500, 37)[:n_ech(5.0)], 0.0, 0.4)


def timbre_pn(g: np.random.Generator) -> np.ndarray:
    """Coup du timbre électrique du passage à niveau (calotte de laiton, si 5)."""
    f = hz(83)
    return modes(n_ech(0.6), [(f, 1.0, 0.45), (f * 2.32, 0.5, 0.25), (f * 3.9, 0.2, 0.12), (f * 0.5, 0.15, 0.3)], g, 0.0003)


def passage_a_niveau(g: np.random.Generator) -> np.ndarray:
    # Sonnerie de la barrière qui va baisser: timbre frappé vite (9 coups par seconde) pendant 3,5 s.
    y = toile(4.2)
    t = 0.0
    while t < 3.5:
        a = min(1.0, 0.6 + t) * (1.0 if t < 3.2 else 0.6)
        poser(y, timbre_pn(g) * a * g.uniform(0.85, 1.0), t)
        t += 1 / 9 + g.uniform(-0.004, 0.004)
    return de_loin(y, 1.2, 0.25, 7000, 41)[:n_ech(4.6)]


def cinq_douze(g: np.random.Generator) -> np.ndarray:
    # Le 5 h 12: deux coups isolés de la sonnerie, de loin, et un roulement qu'on prend pour le vent.
    duree = 7.0
    y = toile(duree)
    poser(y, timbre_pn(g) * 1.0, 0.1)
    poser(y, timbre_pn(g) * 0.9, 1.0)
    y = de_loin(y, 2.4, 0.5, 6000, 43)[:n_ech(duree)]
    n = n_ech(duree)
    roule = dsp.bruit_spectral(n, g, -6, 60, 700) * dsp.env_points(n, [(0, 0), (1.6, 0), (3.6, 1.0), (5.2, 0.6), (7.0, 0)])
    return y + roule * 0.06


# --- Pas -------------------------------------------------------------------------------------------

def pas_bois(g: np.random.Generator) -> np.ndarray:
    # Plancher: lame creuse, parfois un petit craquement.
    y = bois(g, g.uniform(300, 380), 0.16, 0.07, 0.25)
    y += dsp.pb(g.standard_normal(len(y)), 400) * env_exp(len(y), 0.012, 0.002) * 0.6
    if g.uniform() < 0.5:
        n = n_ech(0.06)
        poser(y, dsp.pbande(g.standard_normal(n), 900, 2200) * env_ar(n, 0.01, 0.04) * 0.15, 0.04)
    return y


def pas_eau(g: np.random.Generator) -> np.ndarray:
    # Eau peu profonde: clapot, deux ou trois bulles.
    n = n_ech(0.28)
    y = dsp.pbande(g.standard_normal(n), 500, 5000) * dsp.env_points(n, [(0, 0), (0.02, 1.0), (0.28, 0)]) * 0.5
    for _ in range(int(g.integers(2, 4))):
        poser(y, dsp.bulle(g, g.uniform(500, 1300), g.uniform(0.008, 0.02)) * 0.5, g.uniform(0.0, 0.12))
    return y


def pas_gravier(g: np.random.Generator) -> np.ndarray:
    # Galets et ballast: cailloux qui roulent les uns sur les autres.
    n = n_ech(0.18)
    y = np.zeros(n)
    for t in np.sort(g.uniform(0.0, 0.1, 16)):
        poser(y, dsp.clic(g, 1800, 8000, 0.007, 0.0018) * g.uniform(0.3, 1.0), float(t))
    for t in g.uniform(0.0, 0.08, 3):
        poser(y, modes(n_ech(0.04), [(g.uniform(1800, 3200), 0.4, 0.025)], g), float(t))
    y += dsp.pb(g.standard_normal(n), 300) * env_exp(n, 0.03, 0.003) * 1.2
    return y


def pas_tapis(g: np.random.Generator) -> np.ndarray:
    # Tapis: pas étouffé, à peine un frottement de laine.
    n = n_ech(0.12)
    y = dsp.pbande(g.standard_normal(n), 250, 900) * env_exp(n, 0.03, 0.004) * 1.4
    y += dsp.pbande(g.standard_normal(n), 1500, 4000) * env_ar(n, 0.015, 0.06) * 0.12
    return y


# --- Inventaire -----------------------------------------------------------------------------------

Fabrique = Callable[[np.random.Generator], np.ndarray]

# identifiant: (fabrique, nombre de variantes); une variante = un fichier `<id>-<n>.ogg`.
SONS: dict[str, tuple[Fabrique, int]] = {
    "peche-lancer": (peche_lancer, 1),
    "peche-bouchon": (peche_bouchon, 1),
    "peche-touche": (peche_touche, 1),
    "peche-moulinet": (peche_moulinet, 1),
    "peche-prise": (peche_prise, 1),
    "peche-casse": (peche_casse, 1),
    "cuisine-decoupe": (cuisine_decoupe, 3),
    "cuisine-mijote": (cuisine_mijote, 1),
    "cuisine-friture": (cuisine_friture, 1),
    "plat-reussi": (plat_reussi, 1),
    "plat-rate": (plat_rate, 1),
    "meuble-poser": (meuble_poser, 2),
    "meuble-tourner": (meuble_tourner, 1),
    "meuble-soulever": (meuble_soulever, 1),
    "meuble-ranger": (meuble_ranger, 1),
    "porte": (porte, 1),
    "clochette-boutique": (clochette_boutique, 1),
    "pieces-achat": (pieces_achat, 1),
    "pieces-vente": (pieces_vente, 1),
    "decision-accord": (decision_accord, 1),
    "decision-desaccord": (decision_desaccord, 1),
    "photo-declic": (photo_declic, 1),
    "cloche-marthe": (cloche_marthe, 1),
    "cloche-marthe-coup": (cloche_marthe_coup, 1),
    "cloche-felee": (cloche_felee, 1),
    "passage-a-niveau": (passage_a_niveau, 1),
    "cinq-douze": (cinq_douze, 1),
    "pas-bois": (pas_bois, 3),
    "pas-eau": (pas_eau, 3),
    "pas-gravier": (pas_gravier, 3),
    "pas-tapis": (pas_tapis, 3),
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
