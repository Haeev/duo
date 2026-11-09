"""Le nouveau départ d'Ormeval: un café fermé depuis trois ans, qu'on installe à deux
(docs/jeux/cosy-cafe/demo/depart-cellule-vide-v0-3.md, sections 3.4, 5, 9 et la ligne S1 de 14).

Rideau de fer à lames (à la main pour la porte, au moteur pour les vitrines), porte qui colle,
draps, cartons de Gaby, raccord et chauffe de la vieille machine, balai, éponge sur la vitrine,
camionnette, et la pièce vide. Aucun son de réussite ni d'échec (son.md, 8.1): la soupape dit que
la machine est chaude comme le ferait la vraie, rien de plus.

Règles de la famille (son.md, 8.1 et 8.2): rideau de fer adouci (aucun claquement sec à pleine
force), aucun crissement (frottements graves et grenus), métal aux aigus adoucis, rien de tenu
au-dessus de 2 kHz (la soupape siffle sous 1,6 kHz), bois à fondamentale audible sur un portable.
Les gestes faits dedans portent une petite queue de salle vide (réverbération de 0,8 à 0,9 s au
lieu de 0,4): la salle n'est pas encore meublée, ils ne servent que ces jours-là.
"""

from __future__ import annotations

import numpy as np

import dsp
import instruments as ins
import timbres as tb
from catalogue import Son
from dsp import SR

DOSSIER = "installation"
# Salle vide (son.md, 8.3.5: la décoration raccourcit la réverbération; ici rien ne l'absorbe encore).
SALLE_VIDE = (0.85, 0.22)


def _env(n: int, points: list[tuple[float, float]]) -> np.ndarray:
    return dsp.env_points(n, points)


# --- Rideau de fer ---------------------------------------------------------------------------

def _lame(rng: np.random.Generator, force: float) -> np.ndarray:
    """Une articulation de lame qui passe dans la coulisse ou s'enroule: petit choc de tôle, mat,
    avec le corps creux du tablier (grave) plutôt que l'éclat."""
    y = ins.metal(rng, rng.uniform(820, 1150), 0.09, 0.035,
                  rapports=(1.0, 1.47, 2.09, 2.7), amps=(1.0, 0.6, 0.35, 0.15)) * 0.45
    n = dsp.n_ech(0.07)
    tole = dsp.resonateur(rng.standard_normal(n) * dsp.env_exp(n, 0.008), rng.uniform(300, 380), 5) * 0.9
    dsp.poser(y, tole, 0.0)
    return tb.doux(y, 4500) * force


def _grincement(rng: np.random.Generator, duree: float, cadence: float) -> np.ndarray:
    """La coulisse rouillée: frottement collé-glissé grave (cadence 70 à 140 Hz), résonances de la tôle
    sous 1,2 kHz; un grincement sourd, jamais un crissement aigu."""
    debit = lambda t: cadence * (0.85 + 0.3 * np.sin(2 * np.pi * 1.3 * t) + 0.15 * np.sin(2 * np.pi * 3.1 * t))  # noqa: E731
    y = ins.crissement(rng, duree, debit, [(410, 9), (690, 11), (1050, 8)], rugosite=0.3)
    return dsp.pbande(y, 250, 1800)


def _tablier(rng: np.random.Generator, duree: float) -> np.ndarray:
    """Le tablier de tôle qui roule: souffle grave et grenu, modulé par les ondulations des lames."""
    n = dsp.n_ech(duree)
    x = dsp.pbande(rng.standard_normal(n), 160, 1400)
    mod = 0.55 + 0.45 * np.abs(np.sin(2 * np.pi * 7.5 * np.arange(n) / SR + rng.uniform(0, 6)))
    return x * mod


def _butee(rng: np.random.Generator, force: float) -> np.ndarray:
    """Le rideau arrive en haut, dans le coffre: coup sourd (tôle et bois du linteau), le tambour
    qui résonne un peu, deux lames qui se tassent."""
    y = dsp.toile(0.8)
    dsp.poser(y, tb.bois(rng, 175, 0.5, 0.35, t60=0.16) * 1.0, 0.0)
    dsp.poser(y, ins.metal(rng, 255, 0.8, 0.45, rapports=(1.0, 1.62, 2.43, 3.1), amps=(1.0, 0.55, 0.3, 0.12)) * 0.35,
              0.004)
    dsp.poser(y, _lame(rng, 0.35), 0.11)
    dsp.poser(y, _lame(rng, 0.2), 0.19)
    return tb.doux(y, 4000) * force


def _rideau_monte(v: int, rng: np.random.Generator) -> np.ndarray:
    """Lever le rideau de la porte à deux (1,5 s): la serrure au sol, l'effort du départ, le
    grincement de la coulisse et les lames qui s'enroulent, de plus en plus vite, puis la butée."""
    d = 2.4
    montee = 1.5
    y = dsp.toile(d)
    # Le pêne de la serrure au sol et la poignée.
    dsp.poser(y, ins.metal(rng, 640 + 30 * v, 0.2, 0.07) * 0.35, 0.0)
    dsp.poser(y, tb.bois(rng, 240, 0.15, 0.4, t60=0.05) * 0.4, 0.0)
    # Les lames: cadence qui monte avec la vitesse du rideau (l'effort du départ, puis l'élan).
    t = 0.12
    while t < 0.1 + montee:
        u = (t - 0.1) / montee
        dsp.poser(y, _lame(rng, rng.uniform(0.45, 0.85) * (0.7 + 0.3 * u)), t)
        t += 1.0 / (9 + 13 * min(1.0, u * 1.6)) * rng.uniform(0.85, 1.15)
    n = dsp.n_ech(montee)
    corps = _tablier(rng, montee) * _env(n, [(0, 0), (0.15, 0.7), (1.2, 1.0), (montee, 0.6)]) * 0.35
    dsp.poser(y, corps, 0.1)
    gr = _grincement(rng, montee * 0.8, 95 + 15 * v) * _env(dsp.n_ech(montee * 0.8), [(0, 0), (0.1, 1), (0.6, 0.7),
                                                                                      (montee * 0.8, 0)]) * 0.12
    dsp.poser(y, gr, 0.12)
    dsp.poser(y, _butee(rng, 0.9), 0.1 + montee)
    return y


def _rideau_moteur(v: int, rng: np.random.Generator) -> np.ndarray:
    """Le rideau d'une vitrine monte au moteur (Simone a tourné la clé du boîtier): le moteur tubulaire
    dans le coffre (ronronnement grave plafonné sous 2 kHz), les lames régulières, la fin de course."""
    d = 2.3
    montee = 1.6
    y = dsp.toile(d)
    n = dsp.n_ech(montee + 0.2)
    regime = np.interp(np.arange(n) / SR, [0, 0.15, montee, montee + 0.2], [70, 92 + 4 * v, 96 + 4 * v, 60])
    mot = tb.moteur(n, regime, rng, 12, 0.72, f_max=1600) * _env(n, [(0, 0), (0.12, 1), (montee, 1),
                                                                     (montee + 0.2, 0)])
    dsp.poser(y, dsp.ph(mot, 150, 2) * 0.22, 0.0)
    t = 0.18
    while t < montee:
        dsp.poser(y, _lame(rng, rng.uniform(0.35, 0.6)), t)
        t += 1.0 / 12.0 * rng.uniform(0.9, 1.1)
    dsp.poser(y, _tablier(rng, montee - 0.1) * _env(dsp.n_ech(montee - 0.1), [(0, 0), (0.2, 1), (montee - 0.1, 0.7)])
              * 0.22, 0.12)
    # Fin de course: le moteur se coupe, le tablier se tasse sans choc.
    dsp.poser(y, _butee(rng, 0.45), montee + 0.02)
    return y


def _rideau_tombe(v: int, rng: np.random.Generator) -> np.ndarray:
    """Le rideau retombe (soulevé de 20 cm par un seul joueur, ou baissé le soir): les lames qui se
    referment en cascade, puis la lame du bas sur le seuil, amortie: lourd, mais pas un claquement."""
    d = 1.1
    y = dsp.toile(d)
    chute = 0.32 + 0.06 * v
    t = 0.0
    while t < chute:
        dsp.poser(y, _lame(rng, rng.uniform(0.4, 0.75) * (0.6 + 0.4 * t / chute)), t)
        t += 1.0 / (16 + 10 * t / chute) * rng.uniform(0.8, 1.2)
    dsp.poser(y, _tablier(rng, chute) * _env(dsp.n_ech(chute), [(0, 0), (0.05, 0.6), (chute, 1.0)]) * 0.3, 0.0)
    # La lame du bas sur la pierre du seuil, puis un petit rebond.
    dsp.poser(y, tb.bois(rng, 160 + 10 * v, 0.5, 0.3, t60=0.14) * 1.0, chute)
    dsp.poser(y, ins.metal(rng, 240, 0.5, 0.28, rapports=(1.0, 1.62, 2.43), amps=(1.0, 0.5, 0.25)) * 0.3, chute + 0.003)
    dsp.poser(y, _lame(rng, 0.4), chute + 0.09)
    dsp.poser(y, tb.bois(rng, 200, 0.2, 0.2, t60=0.06) * 0.25, chute + 0.16)
    return tb.doux(y, 4500)


# --- La porte qui colle ----------------------------------------------------------------------

def _porte_colle(v: int, rng: np.random.Generator) -> np.ndarray:
    """La vieille porte de bois a gonflé: le loquet, l'épaule contre le battant, le bois qui force
    contre le chambranle (craquement grave), il cède d'un coup sourd, la porte s'ouvre sur ses gonds."""
    d = 1.5
    y = dsp.toile(d)
    dsp.poser(y, ins.metal(rng, 760 + 40 * v, 0.2, 0.06) * 0.4, 0.0)
    # Premier essai, le battant ne bouge pas: un toc mat.
    dsp.poser(y, tb.bois(rng, 255 + 10 * v, 0.25, 0.5, t60=0.08) * 0.55, 0.12)
    # Le bois force: craquement grave, de plus en plus dense.
    force = 0.38 + 0.05 * v
    cr = tb.craquement(rng, force, 240, 1500, 140) * 0.55
    dsp.poser(y, cr, 0.32)
    dsp.poser(y, tb.frottement(rng, force, 200, 1200, 30) * 0.35, 0.32)
    # Il cède: un coup sourd du battant qui se décolle, l'air de la pièce.
    t = 0.32 + force
    dsp.poser(y, tb.bois(rng, 270 + 15 * v, 0.4, 0.55, t60=0.12) * 1.0, t)
    dsp.poser(y, tb.bois(rng, 540, 0.15, 0.4) * 0.35, t + 0.002)
    souffle = tb.souffle(rng, 0.6, 200, 2500) * dsp.env_ar(dsp.n_ech(0.6), 0.12, 0.4) * 0.15
    dsp.poser(y, souffle, t + 0.05)
    # Les gonds, graves et brefs.
    dsp.poser(y, tb.craquement(rng, 0.35, 220, 1200, 75) * 0.22, t + 0.12)
    return y


# --- Draps, cartons ----------------------------------------------------------------------------

def _drap(v: int, rng: np.random.Generator) -> np.ndarray:
    """Retirer un drap de coton: le tissu qui glisse sur le meuble et claque doucement en l'air, la
    poussière qui s'envole, le drap qui tombe en tas (son.md, 8.2.1: tissu, sous 4 kHz)."""
    d = 1.4
    y = dsp.toile(d)
    g = 0.55 + 0.1 * v
    n = dsp.n_ech(g)
    glisse = dsp.pbande(rng.standard_normal(n), 250, 3500)
    # Les plis qui battent: modulation irrégulière de 10 à 20 Hz.
    bat = np.abs(dsp.pb(rng.standard_normal(n), 16 + 3 * v, 2))
    bat = 0.35 + 0.65 * (bat / (bat.max() + 1e-12)) ** 0.8
    glisse = glisse * bat * _env(n, [(0, 0), (0.08, 0.5), (g * 0.6, 1.0), (g, 0)])
    dsp.poser(y, tb.doux(glisse, 3800) * 0.8, 0.0)
    # Le claquement mou du drap qui se gonfle d'air en quittant le meuble.
    m = dsp.n_ech(0.12)
    claque = dsp.pbande(rng.standard_normal(m), 180, 1400) * dsp.env_exp(m, 0.025, 0.004)
    dsp.poser(y, claque * 0.7, g * 0.62)
    # La poussière: un souffle léger qui s'étale.
    p = dsp.n_ech(0.7)
    poussiere = dsp.pbande(rng.standard_normal(p), 900, 3800) * dsp.env_ar(p, 0.08, 0.5) * 0.12
    dsp.poser(y, poussiere, g * 0.55)
    # Le tas au sol: un froissement sourd.
    tas = ins.froissement(rng, 0.35, 200, 2000, 25, 0.01, 0.25)
    dsp.poser(y, tas * 0.55, g + 0.18)
    return y


def _carton_dechire(v: int, rng: np.random.Generator) -> np.ndarray:
    """Ouvrir un carton de Gaby: le ruban qu'on décolle d'un geste (déchirure grave et fibreuse, sans
    sifflement), les deux rabats qui s'ouvrent sur le creux du carton, le papier de calage."""
    d = 1.3
    y = dsp.toile(d)
    r = 0.32 + 0.05 * v
    n = dsp.n_ech(r)
    # Déchirure: collé-glissé du ruban sur le carton, cadence 250 à 450 Hz, filtrée sous 3,5 kHz.
    debit = lambda t: 260 + 160 * np.sin(np.pi * min(1.0, t / r))  # noqa: E731
    fibres = ins.crissement(rng, r, debit, [(650, 3), (1300, 3), (2300, 4)], rugosite=0.6)
    fibres = dsp.pbande(fibres, 300, 3500) * 0.35 + dsp.pbande(rng.standard_normal(n), 500, 3000) * 0.25
    fibres = fibres * _env(n, [(0, 0), (0.02, 0.8), (r * 0.5, 1.0), (r, 0)])
    dsp.poser(y, tb.doux(fibres, 3500), 0.0)
    # Le carton qui résonne sous la main pendant qu'on tire.
    m = dsp.n_ech(0.15)
    creux = dsp.resonateur(rng.standard_normal(m) * dsp.env_exp(m, 0.015), 250 + 20 * v, 4)
    dsp.poser(y, creux * 0.5, 0.02)
    # Les deux rabats, l'un après l'autre.
    for k, t in enumerate([r + 0.12, r + 0.34]):
        dsp.poser(y, tb.papier(rng, 0.16, 400, 3000, 30) * 0.5, t)
        q = dsp.n_ech(0.1)
        dsp.poser(y, dsp.resonateur(rng.standard_normal(q) * dsp.env_exp(q, 0.012), 290 + 35 * k + 15 * v, 4) * 0.45,
                  t + 0.1)
    # Le papier de calage qu'on écarte.
    dsp.poser(y, tb.papier(rng, 0.35, 700, 4500, 45) * 0.35, r + 0.55)
    return y


# --- La vieille machine: raccord et chauffe ------------------------------------------------------

def _raccord(v: int, rng: np.random.Generator) -> np.ndarray:
    """Raccorder la machine (2 s de maintien): la clé sur l'écrou de laiton du flexible, quatre
    quarts de tour (le filet qui frotte, la clé qui reprend), le flexible serré, la fiche qui entre
    dans la prise (clic franc et grave), l'eau qui arrive dans le tuyau."""
    d = 2.6
    y = dsp.toile(d)
    for k, t in enumerate([0.08, 0.42, 0.76, 1.1]):
        # Le filet qui frotte pendant le quart de tour, plus serré à chaque fois.
        q = 0.22
        filet = tb.frottement(rng, q, 500, 2400, 60) * (0.18 + 0.05 * k)
        dsp.poser(y, filet, t)
        # La clé qui reprend l'écrou: un tintement bref de laiton.
        dsp.poser(y, tb.doux(ins.metal(rng, 1180 + 60 * k + 30 * v, 0.12, 0.05), 5000) * 0.45, t + q)
    # Serré: le dernier effort, un petit « tac » plus grave.
    dsp.poser(y, ins.metal(rng, 720, 0.15, 0.06) * 0.35, 1.42)
    # La fiche dans la prise: frottement bref, puis le clic (plastique et ressort), grave et net.
    dsp.poser(y, tb.frottement(rng, 0.08, 400, 2500, 50) * 0.25, 1.62)
    dsp.poser(y, dsp.clic(rng, 900, 4000, 0.006, 0.0015) * 0.45, 1.72)
    dsp.poser(y, tb.bois(rng, 420, 0.12, 0.6, t60=0.03) * 0.6, 1.72)
    # L'eau qui arrive dans le flexible: un court remplissage.
    eau = tb.filet(rng, 0.6, np.linspace(380, 620, dsp.n_ech(0.6)), 0.6) * dsp.env_ar(dsp.n_ech(0.6), 0.1, 0.35) * 0.12
    dsp.poser(y, eau, 1.85)
    return y


SOUPAPE = 17.6  # instant où la soupape s'ouvre dans machine-heat (secondes)
CHAUFFE = 20.0


def _chauffe_longue(v: int, rng: np.random.Generator) -> np.ndarray:
    """La chauffe de la vieille dame, 20 s (install.heatSec): l'interrupteur, la pompe qui remplit la
    chaudière, puis la chaudière qui chauffe: un grondement doux et des gargouillis de plus en plus
    nombreux et aigus, des déclics de métal qui se dilate; à 17,6 s la soupape s'ouvre et souffle
    (sifflement sous 1,6 kHz), se referme, et la machine ronronne, prête."""
    d = SOUPAPE + 2.4
    n_tot = dsp.n_ech(d)
    y = dsp.toile(d)
    # L'interrupteur de laiton.
    dsp.poser(y, ins.metal(rng, 700, 0.15, 0.05) * 0.5, 0.0)
    dsp.poser(y, tb.bois(rng, 300, 0.1, 0.4, t60=0.03) * 0.3, 0.0)
    # La pompe remplit la chaudière vide (2,2 s), l'eau monte dans le cuivre.
    r = 2.2
    nr = dsp.n_ech(r)
    t = np.arange(nr) / SR
    pompe = (np.sign(np.sin(2 * np.pi * 100 * t)) * 0.4 + np.sin(2 * np.pi * 200 * t) * 0.3)
    pompe = dsp.pbande(pompe, 180, 1600) * dsp.env_ar(nr, 0.08, 0.25) * 0.16
    dsp.poser(y, pompe, 0.25)
    remplit = tb.filet(rng, r, np.linspace(420, 950, nr)) * dsp.env_ar(nr, 0.1, 0.3) * 0.1
    dsp.poser(y, remplit, 0.25)
    # La chaudière chauffe: de 2,6 s à la soupape.
    debut, fin = 2.1, SOUPAPE + 0.3
    nc = dsp.n_ech(fin - debut)
    tc = np.arange(nc) / SR
    u = tc / (fin - debut)
    grondement = dsp.pbande(rng.standard_normal(nc), 120, 700) * (0.12 + 0.2 * u ** 1.3)
    # Bouillonnement fin qui s'épaissit (la résistance fait frémir l'eau près des parois).
    fremit = dsp.toile(fin - debut)
    tt = 0.0
    while True:
        dens = 6 + 120 * (tt / (fin - debut)) ** 1.6
        tt += rng.exponential(1.0 / dens)
        if tt >= fin - debut:
            break
        k = tt / (fin - debut)
        f0 = rng.uniform(260, 600) * (1 + 0.9 * k)
        dsp.poser(fremit, dsp.bulle(rng, f0, rng.uniform(0.006, 0.014)) * rng.uniform(0.2, 0.7) * (0.25 + 0.75 * k), tt)
    # Les gargouillis: grosses bulles graves en grappes, plus fréquentes et plus hautes en montant.
    gargouille = dsp.toile(fin - debut)
    tt = 0.6
    while tt < fin - debut - 0.5:
        k = tt / (fin - debut)
        for j in range(rng.integers(2, 5)):
            f0 = rng.uniform(140, 260) * (1 + 0.8 * k)
            dsp.poser(gargouille, dsp.bulle(rng, f0, rng.uniform(0.02, 0.04), 1.2) * rng.uniform(0.5, 1.0)
                      * (0.35 + 0.65 * k), tt + j * rng.uniform(0.04, 0.09))
        tt += rng.uniform(1.6, 2.6) * (1 - 0.55 * k)
    chaudiere = (grondement + fremit * 0.35 + dsp.pbande(gargouille, 120, 1600) * 0.5) * 2.0
    chaudiere *= _env(nc, [(0, 0), (1.0, 1.0), (fin - debut - 0.3, 1.0), (fin - debut, 0.55)])
    dsp.poser(y, chaudiere, debut)
    # Le métal qui se dilate: quelques déclics espacés.
    for tk in (4.3, 7.9, 10.6, 12.8, 14.9, 16.4):
        dsp.poser(y, tb.doux(ins.metal(rng, rng.uniform(1100, 1450), 0.08, 0.03), 5000) * 0.18, tk)
    # La soupape: un souffle qui s'ouvre d'un coup, son sifflement (sous 1,6 kHz) qui vacille et
    # s'éteint en 1,5 s, puis le clapet qui retombe.
    s = 1.7
    ns = dsp.n_ech(s)
    ts = np.arange(ns) / SR
    jet = dsp.pbande(rng.standard_normal(ns), 600, 4500)
    sifflet_f = 1380 + 60 * np.sin(2 * np.pi * 5.5 * ts) + 40 * dsp.pb(rng.standard_normal(ns), 8, 1) * 20
    sifflet = dsp.pb_variable(rng.standard_normal(ns), lambda x: float(np.interp(x, ts, sifflet_f)), type_="band",
                              q_bande=18.0) * 2.2
    souffle = (jet * 0.55 + sifflet) * _env(ns, [(0, 0), (0.02, 1.0), (0.35, 0.85), (1.1, 0.4), (s, 0)])
    dsp.poser(y, tb.doux(souffle, 4000) * 0.75, SOUPAPE)
    dsp.poser(y, ins.metal(rng, 980, 0.12, 0.05) * 0.4, SOUPAPE)
    dsp.poser(y, ins.metal(rng, 900, 0.12, 0.05) * 0.3, SOUPAPE + s + 0.02)
    # Prête: le ronronnement de la chaudière au repos, qui reste jusqu'à la fin du fichier.
    nr2 = n_tot - dsp.n_ech(SOUPAPE + 0.2)
    repos = dsp.pbande(rng.standard_normal(nr2), 200, 2000) * 0.05 + tb.bulles(rng, nr2 / SR, 18, 300, 700, 0.01) * 0.12
    dsp.poser(y, repos * _env(nr2, [(0, 0), (0.6, 1.0), (nr2 / SR, 0.8)]), SOUPAPE + 0.2)
    return dsp.fondu(y, 0.002, 0.6)


# --- Le ménage ------------------------------------------------------------------------------

def _balai(v: int, rng: np.random.Generator) -> np.ndarray:
    """Un coup de balai de paille sur les tomettes: les brins qui frottent (grain dense, médium), la
    poussière et deux ou trois feuilles mortes qui crissent à peine (sèches, sous 4 kHz)."""
    d = 0.5
    n = dsp.n_ech(0.38)
    y = dsp.toile(d)
    brins = dsp.toile(0.38)
    k = rng.poisson(900 * 0.38)
    pos = rng.integers(0, n, k)
    brins[pos] = rng.uniform(0.2, 1.0, k)
    brins = dsp.pbande(brins, 900, 4500) * 0.5 + dsp.pbande(rng.standard_normal(n), 400, 3000) * 0.35
    geste = _env(n, [(0, 0), (0.05, 0.7), (0.18 + 0.03 * v, 1.0), (0.38, 0)])
    dsp.poser(y, tb.doux(brins * geste, 4500), 0.0)
    # La paille qui touche le sol au début du geste: un contact mat.
    dsp.poser(y, tb.bois(rng, 330 + 20 * v, 0.08, 0.2, t60=0.02) * 0.25, 0.0)
    # Feuilles mortes poussées (une sur deux variantes de plus).
    if v % 2 == 0:
        dsp.poser(y, tb.papier(rng, 0.22, 800, 4000, 70) * 0.25, 0.1 + 0.02 * v)
    return y


def _eponge(v: int, rng: np.random.Generator) -> np.ndarray:
    """L'éponge mouillée sur la vitrine, un arc: un frottement humide et doux (bruit grave haché par
    l'eau), quelques bulles qui éclatent, et la vitre qui résonne à peine (grand verre, grave). Aucun
    couinement."""
    d = 0.8
    a = 0.62 + 0.05 * v
    n = dsp.n_ech(a)
    y = dsp.toile(d)
    frotte = dsp.pbande(rng.standard_normal(n), 220, 2200)
    hache = np.abs(dsp.pb(rng.standard_normal(n), 35, 2))
    hache = 0.45 + 0.55 * (hache / (hache.max() + 1e-12))
    arc = _env(n, [(0, 0), (0.06, 0.8), (a * 0.5, 1.0), (a, 0)])
    dsp.poser(y, frotte * hache * arc * 0.6, 0.0)
    dsp.poser(y, tb.bulles(rng, a, 70, 700, 2000, 0.004) * arc * 0.35, 0.0)
    # Le grand verre de la vitrine, effleuré: modes graves et brefs.
    vitre = dsp.modes(dsp.n_ech(0.5), [(rng.uniform(170, 210), 1.0, 0.25), (430, 0.4, 0.15), (780, 0.15, 0.1)], rng,
                      attaque=0.02)
    dsp.poser(y, vitre * 0.12, 0.03)
    # L'eau qui coule un peu en bas de la vitre.
    if v != 1:
        dsp.poser(y, tb.bulles(rng, 0.25, 30, 900, 1700, 0.006) * 0.2, a - 0.05)
    return tb.doux(y, 4500)


# --- Gaby et sa camionnette ----------------------------------------------------------------------

def _camionnette(v: int, rng: np.random.Generator) -> np.ndarray:
    """La camionnette de Gaby arrive sur la place et s'arrête devant la vitrine: moteur qui ralentit,
    freins doux (aucun crissement), ralenti, contact coupé (le moteur frissonne), le frein à main,
    puis la portière qui s'ouvre et se referme (lourde, amortie par le joint)."""
    d = 4.2
    y = dsp.toile(d)
    arret = 1.4
    coupe = 2.0
    n = dsp.n_ech(coupe + 0.25)
    tm = np.arange(n) / SR
    regime = np.interp(tm, [0, 0.6, arret, coupe, coupe + 0.25], [46, 38, 27, 26, 12])
    mot = tb.moteur(n, regime, rng, 18, 0.84, f_max=1400)
    mot = mot + dsp.pbande(rng.standard_normal(n), 150, 1200) * 0.35
    # Le capot et l'échappement mettent le moteur en avant dans le médium (audible sur un portable).
    mot = dsp.cloche_eq(mot, 650, 9.0, 0.7)
    niveau = np.interp(tm, [0, 0.3, arret, coupe, coupe + 0.25], [0.6, 0.75, 0.5, 0.45, 0.0])
    dsp.poser(y, dsp.pb(dsp.ph(mot * niveau, 110, 2), 2200, 2) * 0.55, 0.0)
    # Les pneus sur les pavés de la place, tant que ça roule.
    nr = dsp.n_ech(arret)
    roule = dsp.pbande(rng.standard_normal(nr), 200, 1500) * _env(nr, [(0, 0.5), (arret * 0.7, 0.35), (arret, 0)])
    dsp.poser(y, roule * 0.3, 0.0)
    # Le frein: un souffle grave, le châssis qui se pose.
    dsp.poser(y, tb.bois(rng, 200, 0.4, 0.2, t60=0.15) * 0.3, arret - 0.05)
    # Contact coupé: un dernier frisson.
    dsp.poser(y, dsp.pbande(rng.standard_normal(dsp.n_ech(0.2)), 100, 600) * dsp.env_exp(dsp.n_ech(0.2), 0.06) * 0.35,
              coupe)
    # Frein à main: un cliquetis bref et grave.
    for k in range(4):
        dsp.poser(y, dsp.clic(rng, 500, 2500, 0.006, 0.0015) * 0.3, coupe + 0.3 + 0.045 * k)
    # La portière: la poignée, elle s'ouvre (le joint qui se décolle), puis se referme.
    po = coupe + 0.75
    dsp.poser(y, ins.metal(rng, 560 + 20 * v, 0.15, 0.05) * 0.35, po)
    dsp.poser(y, tb.souffle(rng, 0.25, 200, 2000) * dsp.env_ar(dsp.n_ech(0.25), 0.04, 0.2) * 0.15, po + 0.05)
    pf = po + 0.85
    corps = dsp.toile(0.5)
    dsp.poser(corps, tb.bois(rng, 210, 0.5, 0.3, t60=0.14), 0.0)
    dsp.poser(corps, ins.metal(rng, 310, 0.4, 0.18, rapports=(1.0, 1.7, 2.6), amps=(1.0, 0.4, 0.15)) * 0.25, 0.002)
    dsp.poser(corps, ins.metal(rng, 900, 0.1, 0.03) * 0.25, 0.008)  # la gâche
    dsp.poser(y, tb.doux(corps, 3500) * 0.85, pf)
    return y


# --- La pièce vide ----------------------------------------------------------------------------

def _piece_vide(rng: np.random.Generator) -> np.ndarray:
    """La salle d'un café fermé depuis trois ans: le même souffle que la pièce meublée, plus creux
    (modes de la pièce nue vers 140, 230 et 370 Hz), et de rares bruits de la maison qui traînent
    dans une réverbération longue (1,2 s): une poutre qui travaille, un petit tic de vitre. Les
    événements sont posés sur une ligne de temps circulaire, loin du raccord."""
    d = 6.0
    n = dsp.n_ech(d)
    fond = tb.souffle(rng, d, 90, 1800, boucle=True, pente=-6.0)
    creux = sum(dsp.circ(lambda z, f=f: dsp.resonateur(z, f, 7), fond) for f in (140, 232, 371)) * 0.6
    fond = (fond * 0.7 + creux) * tb.modulation(n, rng, [(1, 1.0), (2, 0.4)], 0.8)
    evts = dsp.toile(d)
    dsp.poser(evts, tb.craquement(rng, 0.3, 240, 1300, 60) * 0.5, 1.6)
    dsp.poser(evts, tb.verre(rng, 2100, 0.2, 0.12) * 0.06, 4.0)
    dsp.poser(evts, tb.bois(rng, 230, 0.2, 0.3, t60=0.08) * 0.12, 4.7)
    ir = dsp.ir_salle(1.2, 0.012, 0.4, graine=77, largeur=0.8)[:, 0]
    sec_et_queue = dsp.reverbe_mono(evts, np.stack([ir, ir], axis=1), 0.9, 0.5)
    # Replie la queue de réverbération sur le début (boucle).
    replie = sec_et_queue[:n].copy()
    reste = sec_et_queue[n:]
    while len(reste):
        pris = min(n, len(reste))
        replie[:pris] += reste[:pris]
        reste = reste[pris:]
    niveau_fond = np.sqrt(np.mean(fond ** 2))
    replie *= niveau_fond / (np.sqrt(np.mean(replie ** 2)) + 1e-12) * 0.45
    return fond + replie


def sons() -> list[Son]:
    I = DOSSIER
    return [
        # P0
        Son("shutter-up", "Lever le rideau de fer de la porte à deux: la serrure, le grincement de la coulisse, les "
            "lames qui s'enroulent, la butée en haut (1,5 s de montée)", I, "effects", _rideau_monte, 2, -23, 1, 0.03,
            1.0, spatial="porte", passe_haut=110, intervalle_min_ms=1000, voix_max=1,
            note="la butée tombe à 1,6 s du début; si l'animation du rideau dure autrement, la caler sur la butée"),
        Son("shutter-motor", "Le rideau d'une vitrine monte au moteur (Simone a tourné la clé du boîtier)", I, "effects",
            _rideau_moteur, 2, -27, 3, 0.04, 1.0, spatial="vitrine", passe_haut=190, voix_max=3,
            note="un par vitrine, placé à la vitrine, lancés à 0,4 s d'écart (section 5.1, point 3); la fin de course "
                 "tombe à 1,6 s"),
        Son("shutter-down", "Le rideau retombe: soulevé seul de 20 cm, ou baissé le soir", I, "effects", _rideau_tombe, 2,
            -24, 2, 0.04, 1.0, spatial="porte", passe_haut=180,
            note="la lame du bas touche le seuil à 0,32 ou 0,38 s du début"),
        Son("machine-heat", "La vieille dame chauffe: la pompe remplit, la chaudière gargouille de plus en plus, puis "
            "la soupape souffle", I, "effects", _chauffe_longue, 1, -25, 2, 0.0, spatial="machine", passe_haut=90,
            voix_max=2, duree_max=SOUPAPE + 2.4,
            note=f"lancé au début de la chauffe; la soupape s'ouvre à {SOUPAPE} s, soit 2,4 s avant la fin des 20 s "
                 "(install.heatSec). Si heatSec change: plus court, démarrer le fichier en avance de "
                 "(20 - heatSec) s (offset de start); plus long, le lancer (heatSec - 20) s après le début",
            extra={"valveAtSeconds": SOUPAPE, "designedForHeatSec": CHAUFFE}),
        Son("carton-tear", "Ouvrir un carton de l'installation: le ruban décollé, les rabats, le papier de calage", I,
            "effects", _carton_dechire, 3, -25, 2, 0.05, 1.0, passe_haut=120, queue_reverbe=SALLE_VIDE),
        # P1
        Son("door-stick", "La porte d'entrée colle un peu: elle force, cède d'un coup, s'ouvre", I, "effects",
            _porte_colle, 2, -23, 2, 0.03, 1.0, spatial="porte", passe_haut=200, queue_reverbe=SALLE_VIDE,
            note="à la place de door-open-village la première fois qu'on entre, jour 1 et jour 2"),
        Son("sheet-pull", "Retirer un drap: le tissu glisse, la poussière s'envole, le drap tombe en tas", I, "effects",
            _drap, 2, -26, 2, 0.05, 1.0, passe_haut=120, queue_reverbe=SALLE_VIDE),
        Son("broom-sweep", "Un coup de balai sur les tomettes (relancé tant qu'on balaie)", I, "effects", _balai, 3, -28,
            2, 0.06, 1.0, passe_haut=200, queue_reverbe=(0.85, 0.15), intervalle_min_ms=350, voix_max=2,
            note="relancé toutes les 0,5 s tant que E est maintenu sur une tache (4 coups pour sweepHoldSec 2)"),
        Son("sponge-glass", "L'éponge mouillée sur la vitrine, un arc (relancé tant qu'on lave)", I, "effects", _eponge,
            2, -29, 2, 0.05, 1.0, spatial="vitrine", passe_haut=150, queue_reverbe=(0.85, 0.15),
            intervalle_min_ms=500, voix_max=2,
            note="relancé toutes les 0,75 s tant que E est maintenu sur une vitre (4 arcs pour wipeHoldSec 3)"),
        Son("machine-connect", "Raccorder la machine: la clé sur l'écrou du flexible, la fiche dans la prise, l'eau "
            "qui arrive", I, "effects", _raccord, 2, -25, 2, 0.02, 1.0, spatial="machine", passe_haut=150,
            queue_reverbe=(0.85, 0.15), voix_max=1,
            note="lancé au début du maintien (connectHoldSec 2): le clic de la prise tombe à 1,7 s; si le maintien "
                 "est lâché, arrêter le son (fondu de 50 ms)"),
        Son("van-stop", "La camionnette de Gaby s'arrête devant la vitrine, le moteur se coupe, la portière", I,
            "effects", _camionnette, 2, -27, 2, 0.02, 0.0, spatial="rue", passe_haut=180,
            note="placé dans la rue devant la vitrine ouest; dedans, passe par la porte et les vitrines (plan.doorFilter); "
                 "la portière se referme vers 3,6 s, juste avant la bannière de Gaby"),
        Son("room-village-empty", "La pièce vide: le café fermé depuis trois ans, plus creux et plus réverbérant", I,
            "ambience", lambda v, r: _piece_vide(r), sonie=-46, priorite=4, hauteur=0.0, spatial=None, boucle=True,
            passe_haut=80, note="en fondu avec room-village selon l'équipement de la salle (plan.installation)"),
    ]
