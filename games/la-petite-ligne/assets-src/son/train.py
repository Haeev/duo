"""Le train du samedi: le battement de cœur du jeu.

Le sifflet est un sifflet à trois tuyaux accordés sur ré, sol, si (sol majeur, la tonalité du
thème de la Halte): deux coups, un bref et un long, « pou-pouuu ». La version lointaine porte
l'écho de la vallée; le moteur la joue sans placement quand le joueur est loin du quai, pour que
le sifflet s'entende partout (cahier, TE-05).
"""

from __future__ import annotations

import numpy as np

import dsp
import instruments as ins
from catalogue import Son
from dsp import SR

TUYAUX = [dsp.freq("D5"), dsp.freq("G5"), dsp.freq("B5")]


def _tuyau(rng: np.random.Generator, f: float, duree: float, force: float = 1.0) -> np.ndarray:
    n = dsp.n_ech(duree)
    t = np.arange(n) / SR
    # La vapeur arrive: la hauteur monte de 6 % en 90 ms, dépasse un peu, se stabilise; à la fin
    # la pression tombe et la note s'affaisse.
    montee = 1 - 0.06 * np.exp(-t / 0.035) + 0.004 * np.exp(-((t - 0.12) / 0.05) ** 2)
    chute = 1 - 0.035 * np.clip((t - (duree - 0.18)) / 0.18, 0, 1) ** 2
    errance = 1 + 0.0025 * dsp.pb(rng.standard_normal(n), 3, 1) * 30
    ft = f * montee * chute * errance
    phase = 2 * np.pi * np.cumsum(ft) / SR
    ton = np.sin(phase) + 0.16 * np.sin(2 * phase + 0.3) + 0.06 * np.sin(3 * phase + 1.1)
    souffle = dsp.resonateur(rng.standard_normal(n), f, 18) * 0.5
    env = dsp.env_points(n, [(0, 0), (0.05, 0.7), (0.12, 1.0), (duree - 0.15, 0.95), (duree, 0)])
    return (ton + souffle) * env * force


def _sifflet_brut(rng: np.random.Generator) -> np.ndarray:
    y = dsp.toile(3.2)
    for t0, d in ((0.0, 0.42), (0.62, 1.75)):
        for k, f in enumerate(TUYAUX):
            dsp.poser(y, _tuyau(rng, f, d, (1.0, 0.85, 0.7)[k]), t0 + 0.006 * k)
        n = dsp.n_ech(d)
        vapeur = dsp.pbande(rng.standard_normal(n), 2500, 9000) * dsp.env_points(n, [(0, 0), (0.03, 1.0), (d, 0.4)])
        dsp.poser(y, vapeur * 0.08, t0)
    return y


def _sifflet(v: int, rng: np.random.Generator) -> np.ndarray:
    return _sifflet_brut(rng)


def _sifflet_loin(v: int, rng: np.random.Generator) -> np.ndarray:
    """De loin: aigus amortis par l'air, deux échos sur les coteaux, longue réverbération."""
    s = dsp.pb(_sifflet_brut(rng), 2400, 2)
    y = dsp.toile(6.5, stereo=True)
    dsp.poser(y, s, 0.0, pan=-0.1)
    dsp.poser(y, dsp.pb(s, 1500) * 0.32, 0.62, pan=0.55)
    dsp.poser(y, dsp.pb(s, 1100) * 0.16, 1.45, pan=-0.6)
    ir = dsp.ir_salle(3.2, 0.04, 0.3, graine=21, largeur=1.0)
    y = dsp.reverbe(y, ir, humide=0.55, sec=0.8)
    return y[: dsp.n_ech(7.5)]


def _bouffee(rng: np.random.Generator, force: float, duree: float, clarte: float) -> np.ndarray:
    """Un « tchouf » de la locomotive: souffle de vapeur et choc sourd du piston."""
    n = dsp.n_ech(duree)
    souffle = dsp.pbande(rng.standard_normal(n), 250, 1200 + 3500 * clarte) * dsp.env_exp(n, duree * 0.35, 0.006)
    sourd = dsp.pbande(rng.standard_normal(n), 45, 160) * dsp.env_exp(n, 0.04, 0.003)
    return (0.8 * souffle + 0.9 * sourd) * force


def _roulement(rng: np.random.Generator, duree: float, vitesse, gain_dist, coupure, bouffees: bool,
               cadence_bouffees=None, bouffees_jusqua: float = 1e9, grincement=None) -> np.ndarray:
    """Train en mouvement: bouffées (4 par tour de roue), joints de rails (paires de « ta-dam »),
    grondement; vitesse(t) en m/s, gain_dist(t) et coupure(t) pour la distance."""
    n = dsp.n_ech(duree)
    y = np.zeros(n)
    # Grondement des roues
    gr = dsp.pbande(rng.standard_normal(n), 30, 220) * 0.25
    t = np.arange(n) / SR
    v_t = np.array([vitesse(u) for u in t[::480]])
    v_t = np.repeat(v_t, 480)[:n]
    y += gr * np.clip(v_t / 8.0, 0, 1)
    # Joints de rails: tous les 12 m, deux essieux par bogie (2,4 m), quatre bogies
    position = 0.0
    prochain = 6.0
    pas = 1.0 / 200
    u = 0.0
    while u < duree:
        v = max(vitesse(u), 0.0)
        position += v * pas
        if position >= prochain and v > 0.3:
            for bogie in range(4):
                for essieu in range(2):
                    decal = (bogie * 9.0 + essieu * 2.4) / max(v, 0.3)
                    tt = u + decal
                    if tt < duree:
                        clac = dsp.somme(ins.metal(rng, rng.uniform(1400, 1900), 0.12, t60=0.05,
                                                   rapports=(1.0, 1.8, 2.9), amps=(0.6, 0.4, 0.2)),
                                         ins.bruit_bref(rng, 0.08, 80, 500, 0.02) * 1.4)
                        dsp.poser(y, clac * 0.35, tt)
            prochain += 12.0
        u += pas
    # Bouffées de vapeur
    if bouffees:
        u = 0.1
        k = 0
        while u < min(duree, bouffees_jusqua):
            cad = cadence_bouffees(u)
            if cad <= 0.05:
                u += 0.1
                continue
            accent = 1.0 if k % 4 == 0 else (0.8 if k % 2 == 0 else 0.65)
            fondu_regulateur = np.clip((bouffees_jusqua - u) / 1.2, 0, 1)
            d = float(np.clip(0.9 / cad, 0.12, 0.6))
            dsp.poser(y, _bouffee(rng, accent * fondu_regulateur * rng.uniform(0.85, 1.1), d, 0.6), u)
            u += 1.0 / cad
            k += 1
    if grincement is not None:
        y += grincement
    # Distance: niveau et coupure qui suivent la position du train
    y = dsp.pb_variable(y, coupure, bloc=256)
    g = np.array([gain_dist(u) for u in t[::480]])
    g = np.repeat(g, 480)[:n]
    return y * g


def _approche(v: int, rng: np.random.Generator) -> np.ndarray:
    duree = 14.0
    vitesse = lambda u: 8.0 - 4.5 * (u / duree)  # noqa: E731
    return _roulement(rng, duree, vitesse, lambda u: 10 ** ((-26 + 26 * (u / duree) ** 0.7) / 20),
                      lambda u: 1300 + 7000 * (u / duree) ** 1.5, True, lambda u: vitesse(u) * 0.75, 9.5)


def _freinage(v: int, rng: np.random.Generator) -> np.ndarray:
    duree = 6.0
    n = dsp.n_ech(duree)
    t = np.arange(n) / SR
    vitesse = lambda u: max(0.0, 3.5 * (1 - u / 4.2))  # noqa: E731
    # Grincement des sabots de frein: deux raies voisines qui battent, et leurs harmoniques.
    f = 2350 * (1 + 0.004 * np.sin(2 * np.pi * 5.5 * t)) * (1 - 0.03 * t / duree)
    ph = 2 * np.pi * np.cumsum(f) / SR
    crisse = (np.sin(ph) + 0.4 * np.sin(1.006 * ph) + 0.15 * np.sin(2 * ph)) * (0.7 + 0.3 * np.abs(dsp.pb(rng.standard_normal(n), 12) * 10))
    crisse = np.clip(crisse, -1.5, 1.5) * dsp.env_points(n, [(0, 0), (0.5, 0.25), (2.5, 0.5), (3.9, 0.35), (4.3, 0), (duree, 0)])
    y = _roulement(rng, duree, vitesse, lambda u: 1.0, lambda u: 9000, False, grincement=crisse * 0.18)
    # Tampons qui se touchent quand le train s'arrête: trois « clang » de plus en plus doux.
    for k, tt in enumerate((4.25, 4.55, 4.8)):
        clang = dsp.somme(ins.metal(rng, rng.uniform(380, 460), 0.6, t60=0.35, rapports=(1.0, 2.3, 3.7, 5.1),
                                    amps=(1.0, 0.6, 0.3, 0.15)), ins.bruit_bref(rng, 0.2, 50, 300, 0.04) * 1.2)
        dsp.poser(y, clang * (0.55, 0.4, 0.28)[k], tt)
    return y


def _vapeur(v: int, rng: np.random.Generator) -> np.ndarray:
    duree = 3.4
    n = dsp.n_ech(duree)
    x = rng.standard_normal(n)
    env = dsp.env_points(n, [(0, 0), (0.06, 1.0), (0.6, 0.8), (2.6, 0.25), (duree, 0)])
    pshh = dsp.pbande(x, 1500, 10000) * 0.6 + dsp.pbande(x, 300, 1500) * 0.35
    pshh *= 1 + 0.15 * dsp.pb(rng.standard_normal(n), 15) * 8
    return pshh * env


def _attente(v: int, rng: np.random.Generator) -> np.ndarray:
    """La locomotive à l'arrêt, en boucle de 8 s: la pompe à air halète, la chaudière frémit."""
    duree = 8.0
    n = dsp.n_ech(duree)
    y = dsp.filtre_circulaire(dsp.bruit_spectral(n, rng, -1.0), dsp.gain_bande(1800, 8000)) * 0.05
    y += dsp.filtre_circulaire(dsp.bruit_spectral(n, rng, -3.0), dsp.gain_bande(40, 200)) * 0.12
    for t0 in (0.3, 2.3, 4.3, 6.3):
        for k, dt in enumerate((0.0, 0.55)):
            m = dsp.n_ech(0.5)
            pompe = dsp.pbande(rng.standard_normal(m), 400, 2500) * dsp.env_points(m, [(0, 0), (0.08, 1.0), (0.5, 0)])
            pompe += dsp.pbande(rng.standard_normal(m), 60, 200) * dsp.env_exp(m, 0.05) * 0.6
            dsp.poser(y, pompe * (0.5 if k == 0 else 0.35), t0 + dt, circulaire=True)
    for t0 in rng.uniform(0, duree, 6):
        dsp.poser(y, ins.metal(rng, rng.uniform(1800, 3200), 0.1, t60=0.04) * 0.03, float(t0), circulaire=True)
    return y


def _depart(v: int, rng: np.random.Generator) -> np.ndarray:
    duree = 16.0
    vitesse = lambda u: 0.0 if u < 0.6 else min(9.0, 0.08 * (u - 0.6) ** 1.6 + 0.4 * (u - 0.6))  # noqa: E731
    cadence = lambda u: 0.0 if u < 0.5 else 0.9 + vitesse(u) * 0.7  # noqa: E731
    y = _roulement(rng, duree, vitesse, lambda u: 10 ** ((-30 * np.clip((u - 7.0) / 9.0, 0, 1) ** 1.2) / 20),
                   lambda u: 9000 - 7500 * np.clip((u - 7.0) / 9.0, 0, 1), True, cadence)
    # Purgeurs ouverts au démarrage: grands jets de vapeur sur les premières bouffées.
    for k, tt in enumerate((0.5, 1.55, 2.4, 3.1)):
        m = dsp.n_ech(0.9)
        jet = dsp.pbande(rng.standard_normal(m), 1200, 9000) * dsp.env_points(m, [(0, 0), (0.04, 1.0), (0.9, 0)])
        dsp.poser(y, jet * (0.5, 0.42, 0.33, 0.25)[k], tt)
    return y


def _cloche(v: int, rng: np.random.Generator) -> np.ndarray:
    """La cloche du quai, sur son poteau: trois coups (arrivée et départ du train)."""
    y = dsp.toile(4.5)
    for k, t in enumerate((0.0, 0.62, 1.24)):
        coup = ins.clochette(dsp.freq("G4"), 3.2, rng, brillance=1.3, t60=2.6)
        coup = coup + dsp.modes(dsp.n_ech(3.2), [(dsp.freq("G4") * 0.5, 0.25, 3.0), (dsp.freq("G4") * 2.0, 0.3, 1.6)], rng)
        dsp.poser(y, coup * (1.0 if k < 2 else 0.9), t)
    return y


def _sifflet_chef(v: int, rng: np.random.Generator) -> np.ndarray:
    """Le sifflet à roulette de Firmin, avant le départ: la bille fait trembler la note."""
    y = dsp.toile(1.4)
    for t0, d in ((0.0, 0.25), (0.38, 0.75)):
        n = dsp.n_ech(d)
        t = np.arange(n) / SR
        bille = 38 + 6 * np.sin(2 * np.pi * 1.3 * t)
        trem = np.sin(2 * np.pi * np.cumsum(bille) / SR)
        f = 2850 * (1 + 0.025 * trem)
        ton = np.sin(2 * np.pi * np.cumsum(f) / SR) * (0.55 + 0.45 * trem)
        souffle = dsp.pbande(rng.standard_normal(n), 2000, 6000) * 0.12
        dsp.poser(y, (ton + souffle) * dsp.env_ar(n, 0.015, 0.05), t0)
    return y


def sons() -> list[Son]:
    return [
        Son("train-whistle", "Sifflet du train, de près (samedi 10 h et 16 h)", "train", "effects", _sifflet, 1,
            -14.0, 1, 0.0, 0.0, "vallee", duck_db=-9.0, passe_haut=200, queue_reverbe=(1.6, 0.2),
            note="placé sur la locomotive quand le joueur est à moins de 40 m du quai; sinon train-whistle-far"),
        Son("train-whistle-far", "Sifflet du train, de loin (partout ailleurs dans le bourg et au-delà)", "train",
            "effects", _sifflet_loin, 1, -19.0, 1, 0.0, 0.0, None, canaux=2, duck_db=-6.0, passe_haut=200,
            note="non placé, joué chez les deux en même temps que le sifflet proche de l'autre, s'il est près"),
        Son("train-approach", "Le train approche (14 s, de loin jusqu'à l'entrée en gare)", "train", "effects",
            _approche, 1, -17.0, 1, 0.0, 0.0, "vallee", duck_db=-4.0, passe_haut=35,
            note="la locomotive arrive au quai à la fin du fichier; enchaîner train-brake"),
        Son("train-brake", "Freinage et arrêt (6 s)", "train", "effects", _freinage, 1, -19.0, 1, 0.0, 0.0, "vallee",
            duck_db=-4.0, passe_haut=35, note="enchaîner train-steam à 4,3 s (arrêt complet)"),
        Son("train-steam", "Grand jet de vapeur à l'arrêt", "train", "effects", _vapeur, 1, -19.0, 1, 0.03, 0.5,
            "vallee", duck_db=-4.0),
        Son("train-idle-loop", "Locomotive à l'arrêt, de 10 h à 16 h (boucle)", "train", "effects", _attente, 1,
            -30.0, 3, 0.0, 0.0, "loin", boucle=True, passe_haut=35),
        Son("train-depart", "Départ du train (16 s, s'éloigne)", "train", "effects", _depart, 1, -17.0, 1, 0.0, 0.0,
            "vallee", duck_db=-4.0, passe_haut=35, note="précédé de station-bell, guard-whistle puis train-whistle"),
        Son("station-bell", "Cloche du quai (trois coups, arrivée et départ)", "train", "effects", _cloche, 1, -17.0,
            1, 0.0, 0.0, "loin", duck_db=-4.0, queue_reverbe=(1.6, 0.2)),
        Son("guard-whistle", "Sifflet à roulette de Firmin avant le départ", "train", "effects", _sifflet_chef, 1,
            -21.0, 2, 0.02, 0.0, "moyen", passe_haut=300),
    ]
