"""La salle et le comptoir du café d'Ormeval: service, caisse et pourboire, porte et clochette,
livraison et réserve, meubles et port à deux, ardoise, tickets, tablette, livre d'or, pas,
repères des joueurs, interface (son.md, 8.5.3, 8.5.8 à 8.5.13, 8.5.20).

Ormeval: maison de pierre, poutres et tomettes, porte de bois, clochette de laiton sur ressort
(mi), tiroir-caisse en bois à petite sonnette. Ton repère sonne en porcelaine (sol puis do),
celui de l'autre au bol de bois, une octave plus bas (son.md, 8.2.4).
"""

from __future__ import annotations

import numpy as np

import dsp
import instruments as ins
import timbres as tb
from catalogue import SR_CLAIR, Son
from dsp import SR

F = tb.note


# --- Service -------------------------------------------------------------------------------

def _tasse_soucoupe(v: int, rng: np.random.Generator) -> np.ndarray:
    """La tasse touche la soucoupe, rebondit à peine et se pose: deux contacts, porcelaine et faïence."""
    y = dsp.toile(0.35)
    f_tasse = [1580, 1660, 1520, 1720][v]
    dsp.poser(y, tb.porcelaine(rng, f_tasse, 0.35, 0.22, mat=0.15), 0.0, 0.9)
    dsp.poser(y, tb.soucoupe(rng, 1180 + 40 * v, 0.3), 0.0, 0.6)
    dsp.poser(y, tb.porcelaine(rng, f_tasse, 0.2, 0.1, mat=0.3) * 0.3, 0.028 + 0.006 * v)
    return y


def _tasse_posee(v: int, rng: np.random.Generator) -> np.ndarray:
    y = dsp.toile(0.3)
    dsp.poser(y, tb.porcelaine(rng, 1500 + 90 * v, 0.3, 0.12, mat=0.5), 0.0, 0.8)
    dsp.poser(y, tb.bois(rng, 260 + 20 * v, 0.2, 0.5, t60=0.05), 0.0, 0.6)  # le comptoir
    return y


def _cuillere_remue(v: int, rng: np.random.Generator) -> np.ndarray:
    d = 1.0
    y = dsp.toile(d)
    t = 0.04
    k = 0
    while t < d - 0.15:
        g = 0.4 + 0.6 * rng.uniform() * (1 - t / d)
        dsp.poser(y, tb.cuillere(rng, 2400 + 150 * v, 0.12) * g * 0.6, t)
        dsp.poser(y, tb.porcelaine(rng, 1600 + 70 * v, 0.15, 0.08) * g * 0.35, t)
        t += rng.uniform(0.13, 0.19)
        k += 1
    n = dsp.n_ech(d)
    liquide = tb.souffle(rng, d, 300, 1500) * tb.modulation(n, rng, [(6, 1.0)], 0.3) * 0.05
    return y + liquide * dsp.env_ar(n, 0.05, 0.3)


def _cuillere_posee(v: int, rng: np.random.Generator) -> np.ndarray:
    y = dsp.toile(0.3)
    dsp.poser(y, tb.cuillere(rng, 2500 + 200 * v, 0.2), 0.0, 0.6)
    dsp.poser(y, tb.soucoupe(rng, 1210, 0.25) * 0.5, 0.0)
    dsp.poser(y, tb.cuillere(rng, 2500 + 200 * v, 0.1) * 0.2, 0.05)
    return y


def _assiette(v: int, rng: np.random.Generator) -> np.ndarray:
    y = dsp.toile(0.35)
    dsp.poser(y, tb.porcelaine(rng, 820 + 60 * v, 0.35, 0.2, mat=0.35), 0.0, 0.8)
    dsp.poser(y, tb.bois(rng, 240, 0.2, 0.4), 0.0, 0.5)
    return y


def _plateau(v: int, rng: np.random.Generator) -> np.ndarray:
    """Plateau chargé posé: le bois du plateau, puis les tasses qui tintent ensemble."""
    y = dsp.toile(0.5)
    dsp.poser(y, tb.bois(rng, 200 + 15 * v, 0.3, 0.5, t60=0.08), 0.0, 1.0)
    for k in range(3):
        dsp.poser(y, tb.porcelaine(rng, rng.uniform(1400, 1900), 0.3, 0.18) * rng.uniform(0.2, 0.4),
                  0.006 + rng.uniform(0, 0.05))
    dsp.poser(y, tb.cuillere(rng, 2700, 0.15) * 0.2, 0.03)
    return y


def _debarrasser(v: int, rng: np.random.Generator) -> np.ndarray:
    y = dsp.toile(0.7)
    t = 0.0
    for k in range(3 + v % 2):
        dsp.poser(y, tb.porcelaine(rng, rng.uniform(1200, 1800), 0.35, 0.18, mat=0.2) * rng.uniform(0.5, 0.9), t)
        if k == 1:
            dsp.poser(y, tb.cuillere(rng, 2600, 0.15) * 0.4, t + 0.03)
        t += rng.uniform(0.11, 0.18)
    dsp.poser(y, tb.bois(rng, 210, 0.2, 0.4) * 0.4, 0.0)
    return y


def _verser(rng: np.random.Generator, epais: bool) -> np.ndarray:
    d = 1.5
    if epais:
        x = tb.filet(rng, d, 900.0, epaisseur=0.4, boucle=True)
        return dsp.circ(lambda z: dsp.pb(z, 2500, 2), x)
    return tb.filet(rng, d, 1200.0, epaisseur=1.0, boucle=True)


def _gouttes(v: int, rng: np.random.Generator) -> np.ndarray:
    y = dsp.toile(0.4)
    for k, t in enumerate([0.0, 0.11, 0.24][: 2 + v]):
        dsp.poser(y, dsp.bulle(rng, rng.uniform(900, 1500), 0.012) * (0.9 - 0.25 * k), t)
    return y


# --- Caisse et pourboire --------------------------------------------------------------------

def _piece(rng: np.random.Generator, f: float | None = None) -> np.ndarray:
    f = f or rng.uniform(3200, 4600)
    return tb.doux(dsp.modes(dsp.n_ech(0.25), [(f, 1.0, 0.18), (f * 1.53, 0.5, 0.1), (f * 2.4, 0.2, 0.05)], rng), 7000)


def _pieces(rng: np.random.Generator, nb: int, duree: float, etalement: float) -> np.ndarray:
    y = dsp.toile(duree)
    for k in range(nb):
        dsp.poser(y, _piece(rng) * rng.uniform(0.3, 1.0), rng.uniform(0, etalement))
    return y


def _tiroir(v: int, rng: np.random.Generator, ouvre: bool) -> np.ndarray:
    if ouvre:
        # Le tiroir de bois glisse, la petite sonnette (la), la monnaie qui bouge.
        y = dsp.toile(0.7)
        dsp.poser(y, tb.frottement(rng, 0.18, 250, 1500, 30) * 0.5, 0.0)
        dsp.poser(y, tb.bois(rng, 230, 0.25, 0.5), 0.17, 0.7)
        dsp.poser(y, ins.clochette(F("A5"), 0.6, rng, brillance=0.5, t60=0.6) * 0.5, 0.19)
        dsp.poser(y, _pieces(rng, 4, 0.3, 0.05) * 0.25, 0.18)
        return y
    y = dsp.toile(0.4)
    dsp.poser(y, tb.frottement(rng, 0.14, 250, 1500, 30) * 0.4, 0.0)
    dsp.poser(y, tb.bois(rng, 210, 0.25, 0.6), 0.13, 0.9)
    dsp.poser(y, _pieces(rng, 3, 0.2, 0.03) * 0.2, 0.135)
    return y


def _pourboire_bocal(v: int, rng: np.random.Generator, plein: int) -> np.ndarray:
    """Le bocal sonne de plus en plus plein: résonance du verre plus grave et plus courte, plus de pièces."""
    y = dsp.toile(0.7)
    f_verre = [1650, 1400, 1180][plein - 1]
    dsp.poser(y, _piece(rng) * 0.8, 0.0)
    dsp.poser(y, tb.verre(rng, f_verre + 40 * v, 0.5, 0.35 - 0.08 * plein) * 0.6, 0.0)
    dsp.poser(y, _pieces(rng, 1 + 2 * plein, 0.5, 0.06 * plein) * (0.15 + 0.1 * plein), 0.008)
    return y


def _gros_pourboire(v: int, rng: np.random.Generator) -> np.ndarray:
    y = dsp.toile(1.2)
    dsp.poser(y, _pieces(rng, 9, 0.9, 0.35) * 0.6, 0.0)
    dsp.poser(y, tb.verre(rng, 1300, 0.8, 0.4) * 0.4, 0.0)
    # Une note de porcelaine (sol) pour le moment heureux, accordée en do pentatonique.
    dsp.poser(y, tb.porcelaine(rng, F("G5"), 0.9, 0.7) * 0.35, 0.3)
    return y


# --- Porte et clochette d'Ormeval -------------------------------------------------------------

def _porte(v: int, rng: np.random.Generator, ouvre: bool) -> np.ndarray:
    """Vieille porte de bois: le loquet, les gonds (un frottement grave, jamais un grincement aigu),
    le battant qui vient contre le chambranle."""
    d = 0.7 if ouvre else 0.6
    y = dsp.toile(d)
    loquet = ins.metal(rng, 760 + 40 * v, 0.2, 0.06) * 0.5
    if ouvre:
        dsp.poser(y, loquet, 0.0)
        dsp.poser(y, tb.craquement(rng, 0.4, 220, 1400, 80) * 0.25, 0.05)
        dsp.poser(y, tb.souffle(rng, 0.5, 200, 2500) * dsp.env_ar(dsp.n_ech(0.5), 0.15, 0.3) * 0.15, 0.1)
    else:
        dsp.poser(y, tb.souffle(rng, 0.3, 200, 2500) * dsp.env_ar(dsp.n_ech(0.3), 0.1, 0.2) * 0.12, 0.0)
        dsp.poser(y, tb.bois(rng, 175 + 10 * v, 0.35, 0.4, t60=0.12) * 1.0, 0.25)
        dsp.poser(y, tb.bois(rng, 290, 0.2, 0.4) * 0.4, 0.252)
        dsp.poser(y, loquet * 0.8, 0.27)
    return y


def _porte_reserve(v: int, rng: np.random.Generator) -> np.ndarray:
    y = dsp.toile(0.5)
    dsp.poser(y, tb.craquement(rng, 0.25, 250, 1500, 70) * 0.2, 0.0)
    dsp.poser(y, tb.bois(rng, 285 + 20 * v, 0.3, 0.5, t60=0.08), 0.22, 0.8)
    return y


# --- Livraison et réserve ---------------------------------------------------------------------

def _frapper(v: int, rng: np.random.Generator) -> np.ndarray:
    """On frappe à la porte de bois: trois coups (deux, puis un), francs mais ronds."""
    y = dsp.toile(0.7)
    for t, g in ([(0.0, 1.0), (0.17, 0.85), (0.42, 0.95)] if v == 0 else [(0.0, 1.0), (0.16, 0.8), (0.31, 0.9)]):
        dsp.poser(y, tb.bois(rng, 245 + rng.uniform(-8, 8), 0.25, 0.6, t60=0.1) * g, t)
        dsp.poser(y, tb.bois(rng, 520, 0.12, 0.4) * 0.5 * g, t)
    return y


def _casier_lait(v: int, rng: np.random.Generator) -> np.ndarray:
    y = dsp.toile(1.0)
    dsp.poser(y, tb.bois(rng, 190, 0.35, 0.5, t60=0.1), 0.0, 0.9)
    for k in range(6):
        dsp.poser(y, tb.verre(rng, rng.uniform(900, 1300), 0.5, 0.3) * rng.uniform(0.15, 0.4),
                  0.005 + rng.uniform(0, 0.12) + (0.18 if k > 3 else 0))
    return y


def _panier_pain(v: int, rng: np.random.Generator) -> np.ndarray:
    y = dsp.toile(0.9)
    osier = tb.craquement(rng, 0.35, 400, 3000, 260) * 0.4
    dsp.poser(y, osier, 0.0)
    dsp.poser(y, tb.bois(rng, 260, 0.2, 0.2) * 0.4, 0.12)
    dsp.poser(y, tb.papier(rng, 0.5, 700, 5000, 40) * 0.6, 0.3)
    return y


def _sac_cafe(v: int, rng: np.random.Generator) -> np.ndarray:
    """Le sac de jute posé: le tissu épais, puis les grains qui glissent à l'intérieur."""
    y = dsp.toile(1.1)
    n = dsp.n_ech(0.3)
    dsp.poser(y, dsp.pbande(rng.standard_normal(n), 180, 1200) * dsp.env_exp(n, 0.05) * 0.8, 0.0)
    jute = tb.papier(rng, 0.4, 400, 3000, 25) * 0.4
    dsp.poser(y, jute, 0.02)
    grains = dsp.grains(0.8, 600, lambda r: dsp.clic(r, 800, 4500, 0.003, 0.001) * r.uniform(0.1, 0.6), rng,
                        enveloppe=lambda t: max(0.0, 1.0 - t / 0.8))
    dsp.poser(y, grains * 0.5, 0.1)
    return y


def _carton(v: int, rng: np.random.Generator) -> np.ndarray:
    """Un carton posé: le creux du carton (résonance grave et sourde), le contenu qui bouge."""
    y = dsp.toile(0.4)
    n = dsp.n_ech(0.2)
    creux = dsp.resonateur(rng.standard_normal(n) * dsp.env_exp(n, 0.012), 230 + 25 * v, 4)
    dsp.poser(y, creux * 0.8 + dsp.pbande(rng.standard_normal(n), 300, 2000) * dsp.env_exp(n, 0.02) * 0.4, 0.0)
    dsp.poser(y, tb.papier(rng, 0.2, 800, 4000, 50) * 0.3, 0.03)
    if v == 2:
        dsp.poser(y, tb.verre(rng, 1500, 0.3, 0.15) * 0.15, 0.04)
    return y


def _carton_ouvert(v: int, rng: np.random.Generator) -> np.ndarray:
    y = dsp.toile(0.5)
    for k, t in enumerate([0.0, 0.2]):
        dsp.poser(y, tb.papier(rng, 0.18, 400, 3000, 30) * 0.7, t)
        n = dsp.n_ech(0.08)
        dsp.poser(y, dsp.resonateur(rng.standard_normal(n) * dsp.env_exp(n, 0.01), 300 + 30 * k, 4) * 0.3, t + 0.12)
    return y


def _caisse_bois(v: int, rng: np.random.Generator) -> np.ndarray:
    y = dsp.toile(0.4)
    dsp.poser(y, tb.bois(rng, 185 + 15 * v, 0.35, 0.6, t60=0.12), 0.0)
    dsp.poser(y, tb.bois(rng, 330, 0.2, 0.5) * 0.4, 0.012)
    return y


def _etagere(v: int, rng: np.random.Generator) -> np.ndarray:
    y = dsp.toile(0.25)
    dsp.poser(y, tb.bois(rng, 300 + 30 * v, 0.2, 0.5, t60=0.06), 0.0)
    if v == 1:
        dsp.poser(y, tb.verre(rng, 1350, 0.2, 0.12) * 0.25, 0.0)
    else:
        dsp.poser(y, tb.papier(rng, 0.12, 900, 4000, 60) * 0.25, 0.01)
    return y


# --- Meubles et port à deux --------------------------------------------------------------------

def _meuble_souleve(v: int, rng: np.random.Generator) -> np.ndarray:
    y = dsp.toile(0.4)
    dsp.poser(y, tb.craquement(rng, 0.25, 250, 1600, 90) * 0.4, 0.0)
    dsp.poser(y, tb.bois(rng, 210 + 20 * v, 0.2, 0.3) * 0.5, 0.0)
    return y


def _meuble_pose(v: int, rng: np.random.Generator, matiere: str) -> np.ndarray:
    y = dsp.toile(0.5)
    if matiere == "bois":
        # Sur les tomettes: deux pieds puis les deux autres, le bois qui sonne.
        dsp.poser(y, tb.bois(rng, 235 + 15 * v, 0.35, 0.6, t60=0.1), 0.0)
        dsp.poser(y, tb.bois(rng, 270 + 15 * v, 0.3, 0.6, t60=0.08) * 0.7, 0.045 + 0.01 * v)
        dsp.poser(y, tb.craquement(rng, 0.15, 300, 1500, 100) * 0.15, 0.06)
    elif matiere == "doux":
        n = dsp.n_ech(0.3)
        dsp.poser(y, dsp.pbande(rng.standard_normal(n), 150, 1100) * dsp.env_exp(n, 0.05) * 0.8, 0.0)
        dsp.poser(y, tb.bois(rng, 190, 0.25, 0.2) * 0.4, 0.01)
        dsp.poser(y, dsp.pbande(rng.standard_normal(n), 300, 2500) * dsp.env_exp(n, 0.08) * 0.15, 0.03)
    return y


def _meuble_glisse(v: int, rng: np.random.Generator) -> np.ndarray:
    """Glisser un meuble sur les tomettes: patins de feutre, un frottement grave et grenu qui suit les
    joints du carrelage (petits chocs réguliers), jamais un crissement."""
    d = 0.6
    y = tb.frottement(rng, d, 160, 1300, 18) * 0.7
    for k in range(3):
        dsp.poser(y, tb.bois(rng, 190 + 20 * k, 0.1, 0.2) * 0.25, 0.1 + 0.17 * k + 0.02 * v)
    return y


def _meuble_tourne(v: int, rng: np.random.Generator) -> np.ndarray:
    y = tb.frottement(rng, 0.25, 200, 1500, 25) * 0.6
    dsp.poser(y, tb.bois(rng, 240, 0.1, 0.2) * 0.3, 0.2)
    return y


def _refus(v: int, rng: np.random.Generator) -> np.ndarray:
    """Pose impossible: un double « toc » feutré, sans mélodie (même hauteur)."""
    y = dsp.toile(0.35)
    for t in (0.0, 0.13):
        dsp.poser(y, tb.bois(rng, 330 + 10 * v, 0.2, 0.25, t60=0.05) * (1.0 if t == 0 else 0.8), t)
    return y


def _saisir(v: int, rng: np.random.Generator) -> np.ndarray:
    y = dsp.toile(0.4)
    n = dsp.n_ech(0.15)
    dsp.poser(y, dsp.pbande(rng.standard_normal(n), 300, 2500) * dsp.env_exp(n, 0.03) * 0.4, 0.0)  # les mains
    dsp.poser(y, tb.bois(rng, 230 + 25 * v, 0.25, 0.4), 0.02, 0.8)
    return y


def _attente(v: int, rng: np.random.Generator) -> np.ndarray:
    """Le meuble attend l'autre: deux petits coups sur le bois."""
    y = dsp.toile(0.4)
    for t in (0.0, 0.16):
        dsp.poser(y, tb.bois(rng, 290 + 15 * v, 0.2, 0.5, t60=0.07), t)
    return y


def _soulever_deux(v: int, rng: np.random.Generator) -> np.ndarray:
    """Soulever à deux: le bois craque, puis vos deux timbres ensemble (tasse et bol de bois, sol)."""
    y = dsp.toile(0.8)
    dsp.poser(y, tb.craquement(rng, 0.35, 250, 1500, 100) * 0.5, 0.0)
    dsp.poser(y, tb.porcelaine(rng, F("G5"), 0.6, 0.5) * 0.35, 0.18)
    dsp.poser(y, tb.bol_bois(rng, F("G4"), 0.6) * 0.5, 0.18)
    return y


def _craque_porte(v: int, rng: np.random.Generator) -> np.ndarray:
    return tb.craquement(rng, 0.3, 250 + 30 * v, 1500, 110)


# --- Écrire ---------------------------------------------------------------------------------

def _craie_tic(v: int, rng: np.random.Generator) -> np.ndarray:
    return tb.craie(rng, 0.06 + 0.005 * v, 900)


def _craie_trait(v: int, rng: np.random.Generator) -> np.ndarray:
    d = 0.35
    y = tb.craie(rng, d * 0.8, 700)
    y = dsp.somme(y, tb.bois(rng, 300, 0.1, 0.3) * 0.15)
    return y


def _craie_efface(v: int, rng: np.random.Generator) -> np.ndarray:
    d = 0.7
    n = dsp.n_ech(d)
    x = dsp.pbande(rng.standard_normal(n), 300, 2500)
    va_et_vient = tb.modulation(n, rng, [(3, 1.0)], 0.2)
    return tb.doux(x * va_et_vient * dsp.env_ar(n, 0.05, 0.15), 3000)


def _ardoise_dehors(v: int, rng: np.random.Generator) -> np.ndarray:
    y = dsp.toile(0.6)
    dsp.poser(y, tb.bois(rng, 250, 0.3, 0.6, t60=0.1), 0.0)
    dsp.poser(y, tb.bois(rng, 290, 0.25, 0.6, t60=0.08) * 0.8, 0.09)
    dsp.poser(y, ins.metal(rng, 900, 0.2, 0.05) * 0.15, 0.1)
    return y


def _ticket_nouveau(v: int, rng: np.random.Generator) -> np.ndarray:
    """Un nouveau ticket sur le rail: la pince, un petit tintement (la)."""
    y = dsp.toile(0.5)
    dsp.poser(y, tb.papier(rng, 0.06, 1000, 5000, 80) * 0.4, 0.0)
    dsp.poser(y, ins.metal(rng, 1300, 0.1, 0.03) * 0.3, 0.04)
    dsp.poser(y, ins.clochette(F("A5"), 0.45, rng, brillance=0.4, t60=0.45) * 0.7, 0.045)
    return y


def _ticket_pris(v: int, rng: np.random.Generator) -> np.ndarray:
    y = tb.papier(rng, 0.2, 900, 5000, 70) * 0.7
    dsp.poser(y, ins.metal(rng, 1250, 0.08, 0.02) * 0.2, 0.0)
    return y


def _ticket_fini(v: int, rng: np.random.Generator) -> np.ndarray:
    y = dsp.toile(0.25)
    dsp.poser(y, tb.papier(rng, 0.08, 900, 4000, 80) * 0.5, 0.0)
    dsp.poser(y, tb.bois(rng, 350, 0.15, 0.5, t60=0.04) * 0.6, 0.05)
    return y


def _livre_ouvre(v: int, rng: np.random.Generator) -> np.ndarray:
    y = dsp.toile(0.8)
    dsp.poser(y, tb.papier(rng, 0.45, 400, 3500, 25) * 0.6, 0.0)
    n = dsp.n_ech(0.2)
    dsp.poser(y, dsp.pbande(rng.standard_normal(n), 150, 900) * dsp.env_exp(n, 0.04) * 0.5, 0.4)  # la couverture
    return y


def _page(v: int, rng: np.random.Generator) -> np.ndarray:
    d = 0.4
    n = dsp.n_ech(d)
    y = tb.papier(rng, d, 600, 5000, 30 + 8 * v)
    souffle_ = dsp.pbande(rng.standard_normal(n), 300, 1500) * dsp.env_ar(n, 0.1, 0.2) * 0.1
    return y + souffle_


def _tablette_reveil(v: int, rng: np.random.Generator) -> np.ndarray:
    """Deux notes feutrées (sol puis do): porcelaine très douce, en stéréo légère."""
    y = dsp.toile(0.5, stereo=True)
    dsp.poser(y, tb.porcelaine(rng, F("G5"), 0.4, 0.35, mat=0.3) * 0.5, 0.0, pan=-0.15)
    dsp.poser(y, tb.porcelaine(rng, F("C6"), 0.4, 0.35, mat=0.3) * 0.45, 0.11, pan=0.15)
    return y


def _tablette_veille(v: int, rng: np.random.Generator) -> np.ndarray:
    y = dsp.toile(0.35, stereo=True)
    dsp.poser(y, tb.porcelaine(rng, F("C6"), 0.3, 0.25, mat=0.4) * 0.4, 0.0, pan=0.15)
    dsp.poser(y, tb.porcelaine(rng, F("G5"), 0.3, 0.25, mat=0.4) * 0.45, 0.09, pan=-0.15)
    return y


def _tablette_tap(v: int, rng: np.random.Generator) -> np.ndarray:
    y = dsp.toile(0.06)
    dsp.poser(y, tb.bois(rng, 520 + 30 * v, 0.06, 0.3, t60=0.02) * 0.6, 0.0)
    dsp.poser(y, dsp.clic(rng, 1500, 5000, 0.003, 0.0008) * 0.2, 0.0)
    return y


def _tablette_glisse(v: int, rng: np.random.Generator) -> np.ndarray:
    d = 0.25
    n = dsp.n_ech(d)
    x = dsp.pbande(rng.standard_normal(n), 800, 4000) * dsp.env_points(n, [(0, 0), (0.06, 1), (0.25, 0)])
    return tb.doux(x, 4000) * 0.5


# --- Pas et repères ----------------------------------------------------------------------------

def _pas(v: int, rng: np.random.Generator, sol: str) -> np.ndarray:
    d = 0.25
    y = dsp.toile(d)
    n = dsp.n_ech(0.12)
    talon = dsp.pbande(rng.standard_normal(n), 250, 2500) * dsp.env_exp(n, 0.015)
    if sol == "tile":
        # Tomettes de terre cuite: un contact mat et clair, un peu de grain de terre sous la semelle.
        dsp.poser(y, talon * 0.5, 0.0)
        dsp.poser(y, tb.bois(rng, 380 + 25 * v, 0.12, 0.5, t60=0.025) * 0.6, 0.0)
        dsp.poser(y, dsp.pbande(rng.standard_normal(n), 1200, 4500) * dsp.env_exp(n, 0.01) * 0.12, 0.065)
        dsp.poser(y, tb.bois(rng, 340, 0.1, 0.4, t60=0.02) * 0.3, 0.07)
    elif sol == "wood":
        dsp.poser(y, talon * 0.4, 0.0)
        dsp.poser(y, tb.bois(rng, 190 + 15 * v, 0.2, 0.3, t60=0.06) * 0.8, 0.0)
        dsp.poser(y, tb.bois(rng, 220, 0.15, 0.3, t60=0.04) * 0.35, 0.07)
        if v == 3:
            dsp.poser(y, tb.craquement(rng, 0.12, 300, 1500, 120) * 0.1, 0.02)
    else:  # pierre de la place, dehors: plus de grain, aucun corps
        dsp.poser(y, talon * 0.8, 0.0)
        grav = dsp.grains(0.1, 300, lambda r: dsp.clic(r, 1500, 6000, 0.002, 0.0006) * r.uniform(0.1, 0.5), rng)
        dsp.poser(y, grav * 0.5, 0.01)
        dsp.poser(y, talon * 0.4, 0.07)
    return y


def _repere_soi(v: int, rng: np.random.Generator) -> np.ndarray:
    y = dsp.toile(0.9)
    dsp.poser(y, tb.porcelaine(rng, F("G5"), 0.6, 0.55), 0.0)
    dsp.poser(y, tb.porcelaine(rng, F("C6"), 0.75, 0.65), 0.16)
    return y


def _repere_autre(v: int, rng: np.random.Generator) -> np.ndarray:
    y = dsp.toile(0.9)
    dsp.poser(y, tb.bol_bois(rng, F("G4"), 0.7), 0.0)
    dsp.poser(y, tb.bol_bois(rng, F("C5"), 0.75), 0.16)
    return y


# --- Interface (papier, crayon et porcelaine) --------------------------------------------------

def _ui_valider(v: int, rng: np.random.Generator) -> np.ndarray:
    y = dsp.toile(0.3, stereo=True)
    dsp.poser(y, tb.porcelaine(rng, [F("C6"), F("D6"), F("E6")][v], 0.3, 0.2, mat=0.35) * 0.6, 0.0)
    dsp.poser(y, tb.bois(rng, 420, 0.1, 0.3, t60=0.03) * 0.3, 0.0)
    return y


def _ui_retour(v: int, rng: np.random.Generator) -> np.ndarray:
    y = dsp.toile(0.3, stereo=True)
    dsp.poser(y, tb.papier(rng, 0.12, 700, 4000, 50) * 0.3, 0.0)
    dsp.poser(y, tb.bois(rng, 380 + 20 * v, 0.15, 0.25, t60=0.04) * 0.6, 0.08)
    return y


def _ui_refus(v: int, rng: np.random.Generator) -> np.ndarray:
    return dsp.stereo(_refus(v, rng))


def _ui_notif(v: int, rng: np.random.Generator) -> np.ndarray:
    """Deux notes de porcelaine (mi, sol)."""
    y = dsp.toile(0.7, stereo=True)
    dsp.poser(y, tb.porcelaine(rng, F("E5"), 0.6, 0.55) * 0.5, 0.0, pan=-0.1)
    dsp.poser(y, tb.porcelaine(rng, F("G5"), 0.6, 0.55) * 0.5, 0.12, pan=0.1)
    return y


def sons() -> list[Son]:
    S, C, A, M, Re, Am, J, Ec, I = ("base/service", "base/caisse", "adresses/village", "matin", "base/reserve",
                                    "base/amenagement", "base/joueurs", "base/ecrit", "base/interface")
    c = SR_CLAIR
    return [
        # Service (son.md, 8.5.3)
        Son("pour-thin-loop", "Verser un liquide clair (eau, thé, café filtre)", S, "effects",
            lambda v, r: _verser(r, False), sonie=-30, priorite=2, hauteur=0.0, boucle=True,
            note="playbackRate de 1,0 à 1,5 avec le remplissage (la résonance monte: tasse de 700 Hz à 1,8 kHz)"),
        Son("pour-thick-loop", "Verser un liquide épais (lait moussé, chocolat)", S, "effects",
            lambda v, r: _verser(r, True), sonie=-30, priorite=2, hauteur=0.0, boucle=True,
            note="playbackRate de 1,0 à 1,4 avec le remplissage"),
        Son("pour-end", "Dernières gouttes", S, "effects", _gouttes, 2, -30, 3, 0.05, 1.0),
        Son("cup-saucer", "Tasse posée sur sa soucoupe", S, "effects", _tasse_soucoupe, 4, -24, 2, 0.04, 1.0, sr=c),
        Son("cup-set", "Tasse posée sur le comptoir ou une table", S, "effects", _tasse_posee, 3, -25, 2, 0.04, 1.0,
            sr=c),
        Son("spoon-stir", "Remuer à la cuillère", S, "effects", _cuillere_remue, 2, -29, 3, 0.05, sr=c),
        Son("spoon-set", "Cuillère posée sur la soucoupe", S, "effects", _cuillere_posee, 2, -28, 3, 0.05, sr=c),
        Son("plate-set", "Assiette posée (une part, une viennoiserie)", S, "effects", _assiette, 2, -25, 2, 0.04, 1.0,
            sr=c),
        Son("tray-set", "Plateau posé, chargé", S, "effects", _plateau, 3, -24, 2, 0.04, 1.0, passe_haut=180),
        Son("clear-table", "Débarrasser une table (la vaisselle sur le plateau)", S, "effects", _debarrasser, 3, -25, 2,
            0.04, 1.0),
        # Caisse et pourboire (son.md, 8.5.8)
        Son("till-open", "Ouvrir le tiroir-caisse (bois, petite sonnette en la)", C, "effects",
            lambda v, r: _tiroir(v, r, True), 2, -23, 2, 0.0, 1.0, sr=c, note="hauteur fixe: la sonnette est accordée"),
        Son("till-close", "Fermer le tiroir", C, "effects", lambda v, r: _tiroir(v, r, False), 1, -25, 2, 0.03, passe_haut=200),
        Son("coins-hand", "Pièces rendues ou reçues", C, "effects", lambda v, r: _pieces(r, 3 + v, 0.4, 0.12), 3, -25, 2,
            0.04, 1.0, sr=c),
        Son("coins-drawer", "Pièces rangées dans le tiroir", C, "effects",
            lambda v, r: dsp.somme(_pieces(r, 5, 0.5, 0.2), tb.bois(r, 250, 0.2, 0.3) * 0.3), 2, -25, 2, 0.04, sr=c),
        Son("tip-saucer", "Un client laisse un pourboire sur la soucoupe en partant", C, "effects",
            lambda v, r: dsp.somme(_pieces(r, 2, 0.4, 0.05), tb.soucoupe(r, 1200, 0.3) * 0.4), 2, -27, 3, 0.04,
            spatial="client", sr=c),
        Son("tip-jar-1", "Le pourboire tombe dans le bocal presque vide", C, "effects",
            lambda v, r: _pourboire_bocal(v, r, 1), 2, -23, 2, 0.03, 1.0, sr=c),
        Son("tip-jar-2", "Le pourboire tombe dans le bocal à moitié plein", C, "effects",
            lambda v, r: _pourboire_bocal(v, r, 2), 2, -23, 2, 0.03, 1.0, sr=c),
        Son("tip-jar-3", "Le pourboire tombe dans le bocal plein", C, "effects", lambda v, r: _pourboire_bocal(v, r, 3),
            2, -23, 2, 0.03, 1.0, sr=c),
        Son("tip-big", "Un gros pourboire (habitué ravi, commande parfaite)", C, "effects", _gros_pourboire, 1, -22, 2,
            0.0, sr=c, note="hauteur fixe: la note de porcelaine est accordée (sol)"),
        # Porte et clochette d'Ormeval (son.md, 8.5.9)
        Son("door-open-village", "Ouvrir la porte d'entrée (vieille porte de bois)", A, "effects",
            lambda v, r: _porte(v, r, True), 2, -24, 3, 0.03, 1.0, spatial="porte"),
        Son("door-close-village", "Fermer la porte d'entrée", A, "effects", lambda v, r: _porte(v, r, False), 2, -24, 3,
            0.03, 1.0, spatial="porte", passe_haut=200),
        Son("door-bell-village", "La clochette de laiton sur ressort de la porte (mi)", A, "effects",
            lambda v, r: tb.clochette_ressort(r, F("E5"), 1.5, 3 + v), 3, -20,
            1, 0.0, spatial="signal", sr=c, voix_max=1, intervalle_min_ms=250,
            note="hauteur fixe; une voix: relancée si un second client entre pendant qu'elle sonne"),
        Son("door-inner-village", "La porte de la réserve", A, "effects", _porte_reserve, 2, -28, 3, 0.04, passe_haut=200),
        # Livraison (son.md, 8.5.10)
        Son("delivery-knock", "On frappe à la porte: la livraison est là (préparation)", M, "effects", _frapper, 2, -21,
            1, 0.03, spatial="signal", passe_haut=240),
        Son("milk-crate", "La laitière: le casier de bouteilles", M, "effects", _casier_lait, 1, -24, 2, 0.03, sr=c),
        Son("bread-basket", "Le boulanger: le panier d'osier, le papier", M, "effects", _panier_pain, 1, -26, 2, 0.03),
        Son("coffee-sack", "Le torréfacteur: le sac de jute, les grains qui glissent", M, "effects", _sac_cafe, 1, -24,
            2, 0.03, passe_haut=110),
        Son("carton-set", "Un carton posé", Re, "effects", _carton, 3, -25, 2, 0.05, 1.0, passe_haut=110),
        Son("carton-open", "Ouvrir un carton (les rabats, aucun ruban arraché)", Re, "effects", _carton_ouvert, 2, -28,
            3, 0.05),
        Son("crate-set", "Une caisse en bois posée", Re, "effects", _caisse_bois, 2, -25, 2, 0.04, passe_haut=210),
        Son("shelf-place", "Ranger sur une étagère", Re, "effects", _etagere, 3, -28, 3, 0.06, 1.0),
        # Aménager et porter à deux (son.md, 8.5.12)
        Son("furniture-pick", "Soulever un meuble", Am, "effects", _meuble_souleve, 2, -26, 3, 0.04, passe_haut=200),
        Son("furniture-place-wood", "Poser un meuble en bois (sur les tomettes)", Am, "effects",
            lambda v, r: _meuble_pose(v, r, "bois"), 3, -23, 2, 0.04, 1.0, passe_haut=210),
        Son("furniture-place-soft", "Poser un meuble garni (banquette, fauteuil)", Am, "effects",
            lambda v, r: _meuble_pose(v, r, "doux"), 2, -26, 2, 0.04, 1.0, passe_haut=110),
        Son("furniture-slide", "Glisser un meuble sur les tomettes (patins de feutre, sans crissement)", Am, "effects",
            _meuble_glisse, 2, -27, 3, 0.04, passe_haut=110,
            note="ajouté au document sonore pour la démo; relancé tant que le meuble glisse, 0,6 s"),
        Son("furniture-rotate", "Tourner un meuble", Am, "effects", _meuble_tourne, 2, -29, 3, 0.06),
        Son("furniture-refuse", "Pose impossible: un double toc feutré, sans mélodie", Am, "interface", _refus, 2, -25,
            2, 0.02, spatial=None, sr=c),
        Son("carry-grab", "Saisir un bout d'un meuble lourd", J, "effects", _saisir, 2, -25, 2, 0.03, passe_haut=200),
        Son("carry-wait", "Le meuble attend l'autre: deux petits coups sur le bois, toutes les 4 s", J, "effects",
            _attente, 2, -26, 2, 0.03, spatial="signal"),
        Son("carry-lift", "Soulever à deux: le bois craque, vos deux timbres ensemble", J, "effects", _soulever_deux, 1,
            -22, 2, 0.0, sr=c),
        Son("carry-creak", "Porter à deux: le meuble craque au rythme des pas", J, "effects", _craque_porte, 3, -29, 3,
            0.05),
        # Écrire (son.md, 8.5.11)
        Son("chalk-tick", "La craie: un caractère, pendant qu'on écrit la carte", Ec, "effects", _craie_tic, 4, -33, 4,
            0.06, 1.0, intervalle_min_ms=35, voix_max=1),
        Son("chalk-stroke", "La craie: une ligne validée (un trait)", Ec, "effects", _craie_trait, 3, -28, 3, 0.05),
        Son("chalk-erase", "Effacer l'ardoise", Ec, "effects", _craie_efface, 2, -29, 3, 0.05),
        Son("slate-street-set", "Sortir l'ardoise sur le trottoir", Ec, "effects", _ardoise_dehors, 1, -25, 2, 0.03, passe_haut=200),
        Son("ticket-new", "Un nouveau ticket sur le rail: la pince, un petit tintement (la)", Ec, "effects",
            _ticket_nouveau, 2, -23, 2, 0.0, 1.0, spatial="signal", sr=c, intervalle_min_ms=250),
        Son("ticket-take", "Prendre un ticket", Ec, "effects", _ticket_pris, 2, -27, 3, 0.04),
        Son("ticket-done", "Ticket terminé, piqué sur la pique", Ec, "effects", _ticket_fini, 2, -26, 3, 0.04),
        Son("guestbook-open", "Ouvrir le livre d'or", Ec, "effects", _livre_ouvre, 1, -26, 3, 0.02),
        Son("guestbook-page", "Tourner une page du livre d'or", Ec, "effects", _page, 3, -28, 3, 0.05),
        Son("tablet-wake", "Tablette: réveil (deux notes feutrées, sol puis do)", Ec, "interface", _tablette_reveil, 1,
            -26, 3, 0.0, spatial=None, canaux=2, sr=c),
        Son("tablet-tap", "Tablette: toucher", Ec, "interface", _tablette_tap, 3, -33, 4, 0.05, spatial=None, sr=c,
            intervalle_min_ms=40, voix_max=1),
        Son("tablet-swipe", "Tablette: glisser", Ec, "interface", _tablette_glisse, 2, -33, 4, 0.05, spatial=None),
        Son("tablet-sleep", "Tablette: mise en veille", Ec, "interface", _tablette_veille, 1, -29, 4, 0.0, spatial=None,
            canaux=2, sr=c),
        # Joueurs (son.md, 8.5.13)
        Son("step-tile", "Pas sur les tomettes (tes pas; ceux des autres +6 dB à 2 m)", J, "effects",
            lambda v, r: _pas(v, r, "tile"), 4, -35, 4, 0.06, 1.5, spatial="pas", voix_max=6, intervalle_min_ms=120),
        Son("step-wood", "Pas sur le bois (plancher de la réserve, estrade)", J, "effects", lambda v, r: _pas(v, r, "wood"),
            4, -35, 4, 0.06, 1.5, spatial="pas", voix_max=6, intervalle_min_ms=120, passe_haut=210),
        Son("step-stone", "Pas sur la pierre de la place (terrasse, dehors)", J, "effects",
            lambda v, r: _pas(v, r, "stone"), 4, -35, 4, 0.06, 1.5, spatial="pas", voix_max=6, intervalle_min_ms=120),
        Son("ping-self", "Faire signe: ton repère, la tasse frappée (sol, do)", J, "effects", _repere_soi, 1, -19, 1, 0.0,
            spatial="repere", sr=c),
        Son("ping-peer", "Le repère de l'autre: le bol de bois, une octave plus bas", J, "effects", _repere_autre, 1,
            -19, 1, 0.0, spatial="repere", sr=c),
        # Interface du jeu (son.md, 8.5.20)
        Son("ui-confirm", "Valider: un tok de porcelaine", I, "interface", _ui_valider, 3, -23, 3, 0.02, 1.0,
            spatial=None, canaux=2, sr=c),
        Son("ui-back", "Revenir, fermer: une feuille qui glisse, un tok plus mat", I, "interface", _ui_retour, 2, -24, 3,
            0.02, spatial=None, canaux=2, sr=c),
        Son("ui-refusal", "Refus doux: un double toc feutré, à la même hauteur", I, "interface", _ui_refus, 2, -24, 2,
            0.02, spatial=None, canaux=2, sr=c),
        Son("ui-notify", "Notification: deux notes de porcelaine (mi, sol)", I, "interface", _ui_notif, 1, -21, 2, 0.0,
            spatial=None, canaux=2, sr=c, duck_db=-3.0),
    ]
