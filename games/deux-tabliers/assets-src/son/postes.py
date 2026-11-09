"""Les postes du café d'Ormeval: machine à espresso et moulin, lait et vapeur, bouilloire, vitrine,
plonge et lave-vaisselle, radio (son.md, 8.5.1, 8.5.2, 8.5.4, 8.5.5, 8.5.6, 8.5.17).

Le geste s'entend: chaque geste a un début, un déroulé qui renseigne et une fin franche. Le moulin
s'allège quand la dose est faite; l'extraction s'amincit quand elle blondit; le pichet chante à la
bonne température. Aucun bip.
"""

from __future__ import annotations

import numpy as np

import dsp
import instruments as ins
import timbres as tb
from catalogue import SR_CLAIR, Son
from dsp import SR


# --- Moulin --------------------------------------------------------------------------------

def _moulin_rampe(rng: np.random.Generator, duree: float, monte: bool) -> np.ndarray:
    n = dsp.n_ech(duree)
    t = np.arange(n) / SR
    k = np.clip(t / (duree * 0.8), 0, 1)
    prog = 1 - (1 - k) ** 2 if monte else (1 - k) ** 1.5
    f0 = 40 + 105 * prog
    y = tb.moteur(n, f0, rng, 12, 0.72) * (0.35 + 0.65 * prog)
    souffle_ = dsp.pbande(rng.standard_normal(n), 300, 2500) * 0.12 * prog
    y = y + souffle_
    if monte:
        dsp.poser(y, ins.metal(rng, 520, 0.15, 0.06) * 0.25, 0.0)  # l'interrupteur
        y *= dsp.env_ar(n, 0.01, 0.05)
    else:
        y *= dsp.env_ar(n, 0.005, duree * 0.3)
        dsp.poser(y, tb.bois(rng, 260, 0.12, 0.4) * 0.2, duree * 0.85)
    return y


def _moulin_boucle(rng: np.random.Generator, plein: bool) -> np.ndarray:
    d = 1.5
    n = dsp.n_ech(d)
    moteur = tb.boucle_moteur(rng, d, 145 if plein else 152, 12, 0.72 if plein else 0.78)
    grains = tb.impulsions_boucle(rng, d, 900 if plein else 40, 700, 5000, 0.003)
    corps = tb.souffle(rng, d, 250, 2000, boucle=True) * (0.25 if plein else 0.12)
    # Le grain broyé tombe dans le porte-filtre: un ruissellement sec qui pulse avec la meule.
    pulse = tb.modulation(n, rng, [(12, 1.0), (6, 0.5)], 0.55)
    return moteur * (1.0 if plein else 0.8) + grains * (1.6 if plein else 0.9) * pulse + corps * pulse


def _clack_levier(v: int, rng: np.random.Generator) -> np.ndarray:
    y = dsp.toile(0.25)
    dsp.poser(y, ins.metal(rng, 780 + 60 * v, 0.2, 0.05), 0.0, 0.6)
    dsp.poser(y, tb.bois(rng, 300, 0.15, 0.5), 0.0, 0.5)
    dsp.poser(y, dsp.pbande(rng.standard_normal(dsp.n_ech(0.08)), 900, 3500) * dsp.env_exp(dsp.n_ech(0.08), 0.02)
              * 0.2, 0.02)
    return y


def _tasser(v: int, rng: np.random.Generator) -> np.ndarray:
    d = 0.35
    n = dsp.n_ech(d)
    y = dsp.toile(d)
    # Le tasseur s'enfonce: un souffle grenu bref et grave (la mouture qui se compacte), puis l'arrêt.
    comp = dsp.pbande(rng.standard_normal(n), 180, 1400) * dsp.env_points(n, [(0, 0), (0.02, 1), (0.12, 0.3), (0.3, 0)])
    dsp.poser(y, comp, 0.0, 0.6)
    dsp.poser(y, tb.bois(rng, 190 + 15 * v, 0.2, 0.3, t60=0.06), 0.06, 0.7)
    dsp.poser(y, ins.metal(rng, 1100 + 80 * v, 0.2, 0.08) * 0.12, 0.065)
    return y


def _porte_filtre(v: int, rng: np.random.Generator, verrou: bool) -> np.ndarray:
    d = 0.5 if verrou else 0.4
    y = dsp.toile(d)
    rot = 0.22 if verrou else 0.16
    gliss = tb.frottement(rng, rot, 500, 3200, 40) * 0.5
    dsp.poser(y, gliss, 0.0 if verrou else 0.06)
    if verrou:
        dsp.poser(y, ins.metal(rng, 620 + 30 * v, 0.25, 0.09), rot, 0.8)
        dsp.poser(y, tb.bois(rng, 210, 0.2, 0.5), rot, 0.5)
    else:
        dsp.poser(y, ins.metal(rng, 700 + 30 * v, 0.2, 0.06), 0.0, 0.7)
        dsp.poser(y, tb.souffle(rng, 0.12, 1200, 5000) * dsp.env_exp(dsp.n_ech(0.12), 0.03) * 0.3, 0.02)
    return y


def _bac_a_marc(v: int, rng: np.random.Generator) -> np.ndarray:
    d = 0.4
    y = dsp.toile(d)
    # Sur la barre caoutchoutée: un coup mat et grave, jamais un claquement; la galette tombe.
    n = dsp.n_ech(0.25)
    coup = ins.bois(rng, 235 + 12 * v, 0.25, 0.15, rapports=(1.0, 1.9, 3.1), t60=0.07, amps=(0.7, 0.6, 0.35))
    dsp.poser(y, coup, 0.0, 1.0)
    dsp.poser(y, dsp.pbande(rng.standard_normal(n), 350, 1800) * dsp.env_exp(n, 0.03) * 0.5, 0.0)
    dsp.poser(y, dsp.pbande(rng.standard_normal(dsp.n_ech(0.12)), 400, 2500) * dsp.env_exp(dsp.n_ech(0.12), 0.03)
              * 0.25, 0.09 + 0.01 * v)
    return tb.doux(y, 4000)


# --- Pompe et extraction -------------------------------------------------------------------

def _pompe(rng: np.random.Generator, duree: float, boucle: bool) -> np.ndarray:
    """Pompe vibrante: bourdon à 100 Hz riche en harmoniques, filtré pour ne garder que le médium."""
    n = dsp.n_ech(duree)
    t = np.arange(n) / SR
    y = np.sign(np.sin(2 * np.pi * 100 * t)) * 0.4 + np.sin(2 * np.pi * 200 * t) * 0.3
    y = dsp.circ(lambda z: dsp.pbande(z, 180, 1600), y) if boucle else dsp.pbande(y, 180, 1600)
    return y


def _extraction(rng: np.random.Generator, mince: bool) -> np.ndarray:
    d = 2.0
    n = dsp.n_ech(d)
    pompe = _pompe(rng, d, True) * 0.18
    if not mince:
        ruban = tb.souffle(rng, d, 300, 2600, boucle=True, pente=-4.0) * 0.35
        ruban = ruban * tb.modulation(n, rng, [(3, 1.0), (7, 0.5)], 0.75)
        gouttes = tb.bulles(rng, d, 90, 700, 1600, 0.005, True) * 0.5
        return pompe + ruban + gouttes
    # Le filet blondit: plus mince, plus clair, qui crachote par petites salves.
    ruban = tb.souffle(rng, d, 900, 4000, boucle=True, pente=-3.0) * 0.18
    salves = tb.modulation(n, rng, [(5, 1.0), (11, 0.8), (17, 0.4)], 0.15) ** 2
    crache = tb.impulsions_boucle(rng, d, 70, 900, 3500, 0.006) * 1.2
    return pompe * 0.9 + ruban * salves + crache * salves


def _extraction_stop(v: int, rng: np.random.Generator) -> np.ndarray:
    d = 0.8
    y = dsp.toile(d)
    p = _pompe(rng, 0.12, False) * dsp.env_ar(dsp.n_ech(0.12), 0.002, 0.06) * 0.5
    dsp.poser(y, p, 0.0)
    dsp.poser(y, ins.metal(rng, 900 + 40 * v, 0.1, 0.04) * 0.4, 0.1)  # l'électrovanne
    n = dsp.n_ech(0.6)
    pfff = dsp.pbande(rng.standard_normal(n), 500, 5000) * dsp.env_points(n, [(0, 0), (0.01, 1), (0.15, 0.5), (0.6, 0)])
    dsp.poser(y, tb.doux(pfff, 4500) * 0.55, 0.11)
    return y


def _pompe_start(v: int, rng: np.random.Generator) -> np.ndarray:
    d = 0.4
    n = dsp.n_ech(d)
    y = _pompe(rng, d, False) * dsp.env_points(n, [(0, 0), (0.05, 0.6), (0.4, 1.0)])
    dsp.poser(y, ins.metal(rng, 850, 0.08, 0.03) * 0.3, 0.0)
    return dsp.fondu(y, 0.002, 0.02)


def _repos(rng: np.random.Generator) -> np.ndarray:
    d = 4.0
    n = dsp.n_ech(d)
    y = tb.souffle(rng, d, 200, 3000, boucle=True, pente=-6.0) * tb.modulation(n, rng, [(1, 1.0), (2, 0.5)], 0.6) * 0.3
    # Le pressostat: un déclic discret, une fois par boucle, loin du raccord.
    dsp.poser(y, ins.metal(rng, 1300, 0.08, 0.03) * 0.5 + 0, 1.7, circulaire=True)
    dsp.poser(y, tb.bulles(rng, 0.6, 20, 300, 700, 0.01) * 0.3, 2.6, circulaire=True)
    return y


def _chauffe(v: int, rng: np.random.Generator) -> np.ndarray:
    d = 6.0
    n = dsp.n_ech(d)
    y = dsp.toile(d)
    dsp.poser(y, ins.metal(rng, 700, 0.15, 0.05) * 0.5, 0.0)  # l'interrupteur
    dsp.poser(y, _pompe(rng, 1.6, False) * dsp.env_ar(dsp.n_ech(1.6), 0.1, 0.3) * 0.5, 0.2)  # remplissage
    remplissage = tb.filet(rng, 1.6, np.linspace(500, 900, dsp.n_ech(1.6))) * 0.25
    dsp.poser(y, remplissage * dsp.env_ar(len(remplissage), 0.1, 0.3), 0.2)
    chauffe = tb.souffle(rng, 4.0, 200, 2500) * dsp.env_points(dsp.n_ech(4.0), [(0, 0), (2.5, 0.25), (4.0, 0.4)])
    chauffe += tb.bulles(rng, 4.0, 30, 300, 900, 0.01) * dsp.env_points(dsp.n_ech(4.0), [(0, 0), (4.0, 0.6)])
    dsp.poser(y, chauffe, 2.0)
    for t in (2.6, 4.1, 5.3):
        dsp.poser(y, ins.metal(rng, 1250, 0.08, 0.03) * 0.35, t)
    return dsp.fondu(y, 0.002, 0.4)


# --- Vapeur et lait ------------------------------------------------------------------------

def _purge(v: int, rng: np.random.Generator) -> np.ndarray:
    d = 0.8
    n = dsp.n_ech(d)
    jet = dsp.pbande(rng.standard_normal(n), 700, 7000) * dsp.env_points(n, [(0, 0), (0.03, 1), (0.5, 0.8), (0.8, 0)])
    eau = tb.impulsions_boucle(rng, d, 60, 600, 3000, 0.005)[:n] * dsp.env_exp(n, 0.15)
    return tb.doux(jet * 0.6 + eau * 0.8, 5000)


def _vapeur(rng: np.random.Generator, etat: str) -> np.ndarray:
    d = 2.0
    n = dsp.n_ech(d)
    if etat == "aerate":
        # La buse affleure: « papier qu'on déchire », bouffées de bruit haché, centre vers 2,5 kHz.
        base = tb.souffle(rng, d, 900, 6000, boucle=True, pente=-2.0) * 0.25
        dechire = tb.impulsions_boucle(rng, d, 1400, 1200, 5500, 0.002) * 1.0
        bouffees = tb.modulation(n, rng, [(9, 1.0), (14, 0.7), (23, 0.4)], 0.25)
        return dsp.circ(lambda z: tb.doux(z, 5500), base + dechire * bouffees)
    if etat == "roll":
        # Le roulement: plus grave et régulier, centre vers 900 Hz.
        base = tb.souffle(rng, d, 250, 3000, boucle=True, pente=-4.5) * 0.6
        tourbillon = tb.modulation(n, rng, [(4, 1.0), (6, 0.5)], 0.75)
        bul = tb.bulles(rng, d, 120, 350, 900, 0.008, True) * 0.4
        return base * tourbillon + bul
    if etat == "sing":
        # Le pichet chante doucement: un souffle étroit sous 1,6 kHz, pas une note.
        base = tb.souffle(rng, d, 250, 3000, boucle=True, pente=-4.5) * 0.4
        chant = dsp.circ(lambda z: dsp.resonateur(z, 1150, 14), tb.souffle(rng, d, 300, 3000, boucle=True))
        flottement = tb.modulation(n, rng, [(3, 1.0), (5, 0.4)], 0.55)
        return base + chant * 1.1 * flottement
    # Trop chaud: le souffle s'amincit, petits bouillons, plus clair et plus haché.
    base = tb.souffle(rng, d, 1300, 5000, boucle=True, pente=-2.0) * 0.45
    bouillons = tb.bulles(rng, d, 45, 600, 1300, 0.008, True) * 0.5
    hache = tb.modulation(n, rng, [(7, 1.0), (13, 0.6)], 0.3)
    return dsp.circ(lambda z: tb.doux(z, 5500), base * hache) + bouillons


def _auto_stop(v: int, rng: np.random.Generator) -> np.ndarray:
    d = 0.5
    n = dsp.n_ech(0.2)
    y = dsp.toile(d)
    dsp.poser(y, dsp.pbande(rng.standard_normal(n), 300, 3000) * dsp.env_points(n, [(0, 1), (0.2, 0)]) * 0.4, 0.0)
    dsp.poser(y, ins.metal(rng, 980, 0.15, 0.05) * 0.6, 0.18)
    dsp.poser(y, tb.bois(rng, 230, 0.15, 0.4) * 0.4, 0.18)
    return y


def _pichet_pose(v: int, rng: np.random.Generator) -> np.ndarray:
    y = dsp.toile(0.3)
    dsp.poser(y, ins.metal(rng, 860 + 70 * v, 0.3, 0.14, rapports=(1.0, 2.1, 3.4, 4.9), amps=(1.0, 0.5, 0.3, 0.12)),
              0.0, 0.6)
    dsp.poser(y, tb.bois(rng, 230, 0.15, 0.4), 0.0, 0.5)
    return tb.doux(y, 6000)


def _lait_verse(v: int, rng: np.random.Generator) -> np.ndarray:
    d = 1.2
    n = dsp.n_ech(d)
    f = np.linspace(420, 950, n)
    y = tb.filet(rng, d, f, epaisseur=0.6) * dsp.env_ar(n, 0.06, 0.25)
    return dsp.pb(y, 3500, 2)


# --- Bouilloire ------------------------------------------------------------------------------

def _bouilloire(rng: np.random.Generator) -> np.ndarray:
    d = 2.0
    n = dsp.n_ech(d)
    grond = tb.souffle(rng, d, 120, 1200, boucle=True, pente=-6.0) * tb.modulation(n, rng, [(3, 1.0), (5, 0.6)], 0.6)
    bul = tb.bulles(rng, d, 140, 260, 800, 0.012, True) * 0.7
    sifflement = tb.souffle(rng, d, 900, 2000, boucle=True) * 0.04  # la vapeur sous le couvercle, très bas
    return grond * 0.5 + bul + sifflement


def _bouilloire_clic(v: int, rng: np.random.Generator) -> np.ndarray:
    y = dsp.toile(0.3)
    dsp.poser(y, dsp.clic(rng, 600, 4000, 0.004, 0.001) * 0.8, 0.0)
    dsp.poser(y, tb.bois(rng, 340 + 30 * v, 0.2, 0.6, t60=0.05), 0.0, 0.6)
    dsp.poser(y, ins.metal(rng, 1500, 0.15, 0.04) * 0.15, 0.003)
    return y


# --- Vitrine ---------------------------------------------------------------------------------

def _vitrine(v: int, rng: np.random.Generator, ouvre: bool) -> np.ndarray:
    d = 0.5 if ouvre else 0.4
    y = dsp.toile(d)
    g = 0.32 if ouvre else 0.24
    roul = tb.frottement(rng, g, 250, 1600, 60) * 0.6
    n = len(roul)
    galets = tb.impulsions_boucle(rng, g, 40, 400, 2000, 0.004)[:n] * 0.4
    dsp.poser(y, roul + galets, 0.0)
    if ouvre:
        dsp.poser(y, tb.verre(rng, 1450, 0.2, 0.15) * 0.15, 0.0)
        dsp.poser(y, tb.bois(rng, 280, 0.15, 0.3) * 0.3, g)
    else:
        dsp.poser(y, tb.bois(rng, 250, 0.15, 0.5), g - 0.02, 0.8)
        dsp.poser(y, tb.verre(rng, 1520, 0.2, 0.2) * 0.25, g - 0.02)
    return y


def _pince(v: int, rng: np.random.Generator) -> np.ndarray:
    y = dsp.toile(0.2)
    dsp.poser(y, ins.metal(rng, 1700 + 120 * v, 0.15, 0.05) * 0.5, 0.0)
    dsp.poser(y, ins.metal(rng, 1820 + 120 * v, 0.12, 0.04) * 0.35, 0.035)
    return tb.doux(y, 6000)


def _sac_papier(v: int, rng: np.random.Generator) -> np.ndarray:
    return tb.papier(rng, 0.6, 500, 5000, 35 + 10 * v)


# --- Plonge et lave-vaisselle ------------------------------------------------------------------

def _robinet(v: int, rng: np.random.Generator, ouvre: bool) -> np.ndarray:
    d = 0.3
    y = dsp.toile(d)
    dsp.poser(y, ins.metal(rng, 640, 0.15, 0.05) * 0.4, 0.0)
    n = dsp.n_ech(0.25)
    jet = tb.filet(rng, 0.25, 700.0)[:n]
    env = dsp.env_points(n, [(0, 0), (0.25, 1)]) if ouvre else dsp.env_points(n, [(0, 1), (0.2, 0), (0.25, 0)])
    dsp.poser(y, jet * env * 0.5, 0.02)
    return y


def _robinet_boucle(rng: np.random.Generator) -> np.ndarray:
    d = 2.0
    eau = tb.filet(rng, d, 650.0, 1.4, boucle=True)
    evier = tb.souffle(rng, d, 150, 900, boucle=True, pente=-5.0) * 0.2
    return eau + evier


def _laver(v: int, rng: np.random.Generator) -> np.ndarray:
    d = 0.8
    n = dsp.n_ech(d)
    clapot = tb.bulles(rng, d, 60, 300, 900, 0.01) * 0.8
    eponge = tb.frottement(rng, 0.5, 300, 2500, 30) * 0.5
    y = dsp.toile(d)
    dsp.poser(y, clapot * dsp.env_ar(n, 0.05, 0.3), 0.0)
    dsp.poser(y, eponge, 0.1)
    dsp.poser(y, tb.porcelaine(rng, 1500 + 90 * v, 0.3, 0.12, mat=0.6) * 0.25, 0.45)
    return y


def _egouttoir(v: int, rng: np.random.Generator) -> np.ndarray:
    y = dsp.toile(0.3)
    dsp.poser(y, tb.porcelaine(rng, 1700 + 110 * v, 0.3, 0.2, mat=0.2), 0.0, 0.8)
    dsp.poser(y, ins.metal(rng, 1100, 0.15, 0.05) * 0.2, 0.002)
    return y


def _lv_porte(v: int, rng: np.random.Generator, ouvre: bool) -> np.ndarray:
    d = 0.7 if ouvre else 0.8
    y = dsp.toile(d)
    if ouvre:
        dsp.poser(y, ins.metal(rng, 520, 0.2, 0.08) * 0.6, 0.0)  # le loquet
        dsp.poser(y, tb.frottement(rng, 0.35, 200, 1200, 20) * 0.4, 0.06)
        dsp.poser(y, tb.bois(rng, 170, 0.25, 0.3) * 0.6, 0.42)  # la porte en butée, amortie
        dsp.poser(y, tb.porcelaine(rng, 1600, 0.25, 0.15) * 0.12, 0.43)
    else:
        dsp.poser(y, tb.frottement(rng, 0.3, 200, 1200, 20) * 0.4, 0.0)
        dsp.poser(y, tb.bois(rng, 160, 0.25, 0.4) * 0.8, 0.3)
        dsp.poser(y, ins.metal(rng, 560, 0.2, 0.08) * 0.5, 0.32)
        # Le cycle démarre: l'eau arrive.
        dsp.poser(y, tb.souffle(rng, 0.4, 200, 1500) * dsp.env_ar(dsp.n_ech(0.4), 0.15, 0.2) * 0.25, 0.4)
    return y


def _lv_boucle(rng: np.random.Generator) -> np.ndarray:
    d = 3.0
    n = dsp.n_ech(d)
    brassage = tb.souffle(rng, d, 150, 1500, boucle=True, pente=-5.0)
    # Les bras tournent: l'eau frappe la porte à un rythme régulier (3 tours dans la boucle).
    rythme = tb.modulation(n, rng, [(3, 1.0), (6, 0.3)], 0.5)
    moteur = tb.boucle_moteur(rng, d, 50, 6, 0.6) * 0.05
    return brassage * rythme * 0.6 + dsp.circ(lambda z: dsp.ph(z, 90, 2), moteur)


def _lv_fini(v: int, rng: np.random.Generator) -> np.ndarray:
    d = 1.3
    y = dsp.toile(d)
    n = dsp.n_ech(0.9)
    vidange = (tb.souffle(rng, 0.9, 150, 1200) * 0.4 + tb.bulles(rng, 0.9, 50, 200, 500, 0.02) * 0.6) \
        * dsp.env_points(n, [(0, 0), (0.1, 1), (0.6, 0.7), (0.9, 0)])
    dsp.poser(y, vidange, 0.0)
    dsp.poser(y, ins.metal(rng, 1040, 0.3, 0.07) * 0.7, 0.95)  # le déclic du programmateur
    dsp.poser(y, tb.bois(rng, 300, 0.2, 0.6) * 0.6, 0.95)
    return y


# --- Radio du village --------------------------------------------------------------------------

def _radio_on(v: int, rng: np.random.Generator) -> np.ndarray:
    d = 1.0
    y = dsp.toile(d)
    dsp.poser(y, tb.bois(rng, 330, 0.15, 0.8, t60=0.05), 0.0, 0.8)  # l'interrupteur rotatif
    dsp.poser(y, ins.metal(rng, 1400, 0.1, 0.03) * 0.2, 0.0)
    n = dsp.n_ech(0.9)
    chauffe = dsp.pbande(rng.standard_normal(n), 400, 4000) * dsp.env_points(n, [(0, 0), (0.5, 0.4), (0.9, 0.15)])
    dsp.poser(y, chauffe * 0.3, 0.08)
    return y


def _radio_off(v: int, rng: np.random.Generator) -> np.ndarray:
    y = dsp.toile(0.3)
    dsp.poser(y, tb.bois(rng, 320, 0.2, 0.8, t60=0.05), 0.0, 0.8)
    n = dsp.n_ech(0.12)
    dsp.poser(y, dsp.pbande(rng.standard_normal(n), 300, 3000) * dsp.env_exp(n, 0.03) * 0.25, 0.005)
    return y


def _radio_accord(v: int, rng: np.random.Generator) -> np.ndarray:
    """Changer de station: un court souffle d'accord, qui balaie, sans sifflement de battement."""
    d = 0.7
    n = dsp.n_ech(d)
    x = rng.standard_normal(n)
    a, b = (800, 3500) if v == 0 else (3500, 900)
    y = dsp.pb_variable(x, lambda t: a + (b - a) * t / d, type_="band", q_bande=2.0) * dsp.env_ar(n, 0.05, 0.25)
    dsp.poser(y, tb.bois(rng, 300, 0.1, 0.4) * 0.3, 0.0)
    return tb.doux(y, 4500)


def _radio_souffle(rng: np.random.Generator) -> np.ndarray:
    d = 3.0
    n = dsp.n_ech(d)
    x = tb.souffle(rng, d, 300, 5000, boucle=True, pente=-2.0)
    return x * tb.modulation(n, rng, [(1, 1.0), (3, 0.3)], 0.8)


def _radio_cran(v: int, rng: np.random.Generator) -> np.ndarray:
    y = dsp.toile(0.12)
    dsp.poser(y, tb.bois(rng, 380 + 30 * v, 0.1, 0.9, t60=0.03), 0.0)
    return y


def sons() -> list[Son]:
    E, L, T, P, V, R = "postes/espresso", "postes/lait", "postes/the", "postes/patisserie", "postes/plonge", \
        "postes/musique"
    return [
        # Moulin, porte-filtre, extraction (son.md, 8.5.1)
        Son("grinder-start", "Le moulin démarre", E, "effects", lambda v, r: _moulin_rampe(r, 0.4, True), 2,
            -24, 2, 0.03, 1.0, passe_haut=170),
        Son("grinder-loop", "Le moulin moud (tant qu'on maintient)", E, "effects", lambda v, r: _moulin_boucle(r, True),
            sonie=-25, priorite=2, hauteur=0.02, boucle=True, passe_haut=170,
            note="fondu de 0,3 s vers grinder-empty-loop quand la dose est faite"),
        Son("grinder-empty-loop", "La dose est faite: les grains ne craquent plus, le moteur s'allège; aussi moulin vide",
            E, "effects", lambda v, r: _moulin_boucle(r, False), sonie=-27, priorite=2, hauteur=0.02, boucle=True, passe_haut=170),
        Son("grinder-stop", "Le moulin s'arrête", E, "effects", lambda v, r: _moulin_rampe(r, 0.6, False), 2, -25, 2,
            0.03, 1.0, passe_haut=170),
        Son("doser-clack", "Le levier du doseur (moulin du village)", E, "effects", _clack_levier, 3, -24, 2, 0.04, 1.0),
        Son("tamp", "Tasser la mouture", E, "effects", _tasser, 3, -25, 2, 0.03, 1.0),
        Son("portafilter-lock", "Fixer le porte-filtre", E, "effects", lambda v, r: _porte_filtre(v, r, True), 2,
            -23, 2, 0.03, 1.0),
        Son("portafilter-unlock", "Retirer le porte-filtre", E, "effects", lambda v, r: _porte_filtre(v, r, False), 2,
            -24, 2, 0.03, 1.0),
        Son("knock-box", "Taper le marc dans le bac (barre caoutchoutée: mat, jamais un claquement)", E, "effects",
            _bac_a_marc, 3, -22, 2, 0.04, 1.0, passe_haut=140),
        Son("pump-start", "La pompe démarre", E, "effects", _pompe_start, 1, -25, 2, 0.02,
            note="enchaîner extraction-loop à 0,35 s", passe_haut=170),
        Son("extraction-loop", "L'extraction coule: le ruban", E, "effects", lambda v, r: _extraction(r, False),
            sonie=-27, priorite=2, hauteur=0.0, boucle=True),
        Son("extraction-thin-loop", "L'extraction blondit: le filet s'amincit et crachote", E, "effects",
            lambda v, r: _extraction(r, True), sonie=-28, priorite=2, hauteur=0.0, boucle=True,
            note="fondu depuis extraction-loop selon le temps d'extraction (fenêtre idéale du game designer)"),
        Son("extraction-stop", "La pompe se tait, la vanne souffle (fin d'extraction)", E, "effects", _extraction_stop,
            2, -23, 2, 0.02, 1.0, spatial="signal", intervalle_min_ms=250),
        Son("espresso-idle-loop", "La machine au repos: chaudière, déclic du pressostat", E, "ambience",
            lambda v, r: _repos(r), sonie=-42, priorite=4, hauteur=0.0, spatial="machine", boucle=True,
            note="départ tiré au hasard sur chaque machine"),
        Son("espresso-warmup", "La machine chauffe le matin: remplissage, souffle, déclics", E, "effects", _chauffe,
            1, -30, 3, 0.0, duree_max=6.0),
        # Lait et vapeur (son.md, 8.5.2), mélangées selon plan.milkTemperature
        Son("steam-purge", "Purger la buse, avant et après", L, "effects", _purge, 2, -25, 2, 0.03, 1.0),
        Son("steam-aerate-loop", "Aérer: la buse affleure, papier qu'on déchire (4 à 35 °C)", L, "effects",
            lambda v, r: _vapeur(r, "aerate"), sonie=-27, priorite=2, hauteur=0.0, boucle=True),
        Son("steam-roll-loop", "Texturer: le roulement (35 à 58 °C)", L, "effects", lambda v, r: _vapeur(r, "roll"),
            sonie=-28, priorite=2, hauteur=0.0, boucle=True),
        Son("steam-sing-loop", "La cible: le pichet chante (58 à 65 °C)", L, "effects", lambda v, r: _vapeur(r, "sing"),
            sonie=-31, priorite=2, hauteur=0.0, boucle=True),
        Son("steam-hot-loop", "Trop chaud: le souffle s'amincit, petits bouillons (65 à 72 °C)", L, "effects",
            lambda v, r: _vapeur(r, "hot"), sonie=-29, priorite=2, hauteur=0.0, boucle=True),
        Son("steam-auto-stop", "La buse s'arrête d'elle-même à la température (72 °C)", L, "effects", _auto_stop, 1,
            -25, 2, 0.02, spatial="signal", intervalle_min_ms=250),
        Son("pitcher-set", "Poser le pichet", L, "effects", _pichet_pose, 2, -26, 2, 0.04, 1.0, sr=SR_CLAIR),
        Son("milk-pour", "Verser le lait de la bouteille dans le pichet", L, "effects", _lait_verse, 1, -28, 3, 0.03),
        # Bouilloire (son.md, 8.5.4)
        Son("kettle-loop", "La bouilloire chauffe", T, "effects", lambda v, r: _bouilloire(r), sonie=-33, priorite=3,
            hauteur=0.0, boucle=True),
        Son("kettle-click", "L'eau est chaude: le déclic", T, "effects", _bouilloire_clic, 2, -25, 2, 0.03,
            spatial="signal", intervalle_min_ms=250),
        # Vitrine (son.md, 8.5.5)
        Son("vitrine-open", "Ouvrir la vitrine (porte de verre coulissante)", P, "effects",
            lambda v, r: _vitrine(v, r, True), 1, -27, 3, 0.03, sr=SR_CLAIR),
        Son("vitrine-close", "Fermer la vitrine", P, "effects", lambda v, r: _vitrine(v, r, False), 1, -26, 3, 0.03,
            sr=SR_CLAIR),
        Son("tongs", "Pince à pâtisserie", P, "effects", _pince, 2, -28, 3, 0.06, sr=SR_CLAIR),
        Son("paper-bag", "Sac en papier, à emporter", P, "effects", _sac_papier, 2, -27, 3, 0.05),
        # Plonge et lave-vaisselle (son.md, 8.5.6)
        Son("tap-on", "Ouvrir le robinet", V, "effects", lambda v, r: _robinet(v, r, True), 1, -28, 3, 0.04),
        Son("tap-loop", "L'eau coule", V, "effects", lambda v, r: _robinet_boucle(r), sonie=-31, priorite=3,
            hauteur=0.0, boucle=True),
        Son("tap-off", "Fermer le robinet", V, "effects", lambda v, r: _robinet(v, r, False), 1, -28, 3, 0.04),
        Son("dish-wash", "Laver à la main (éponge, tasses dans l'eau)", V, "effects", _laver, 2, -29, 3, 0.05),
        Son("dish-rack", "Une tasse sur l'égouttoir", V, "effects", _egouttoir, 3, -27, 3, 0.05, 1.0, sr=SR_CLAIR),
        Son("dishwasher-open", "Ouvrir le lave-vaisselle", V, "effects", lambda v, r: _lv_porte(v, r, True), 1, -25,
            2, 0.03),
        Son("dishwasher-close", "Fermer le lave-vaisselle: le cycle démarre", V, "effects",
            lambda v, r: _lv_porte(v, r, False), 1, -24, 2, 0.03),
        Son("dishwasher-loop", "Le cycle tourne (eau brassée)", V, "ambience", lambda v, r: _lv_boucle(r), sonie=-39,
            priorite=4, hauteur=0.0, spatial="machine", boucle=True),
        Son("dishwasher-done", "Le cycle est fini: vidange, déclic", V, "effects", _lv_fini, 1, -24, 2, 0.0,
            spatial="signal"),
        # Radio du village (son.md, 8.5.17)
        Son("radio-on", "Allumer la radio: le clic, le poste chauffe (la musique monte en 1 s)", R, "effects",
            _radio_on, 1, -26, 2, 0.0),
        Son("radio-off", "Éteindre la radio", R, "effects", _radio_off, 1, -27, 2, 0.0),
        Son("radio-tune", "Changer de station: un court souffle d'accord", R, "effects", _radio_accord, 2, -28, 2,
            0.03),
        Son("radio-knob", "Tourner le bouton du volume (un cran)", R, "effects", _radio_cran, 2, -32, 3, 0.04,
            intervalle_min_ms=40),
        Son("radio-hiss-loop", "Le souffle de la radio entre deux morceaux", R, "ambience",
            lambda v, r: _radio_souffle(r), sonie=-48, priorite=4, hauteur=0.0, boucle=True,
            note="2 à 4 s entre deux morceaux, passe par le traitement de l'appareil"),
    ]
