"""Sons du bourg qui change (tour 9, `docs/jeux/jeu-1/tour-09-conception.md`, sections 2 et 7):
chantiers financés par le duo, cadeaux offerts aux habitants, articles du catalogue de la semaine,
outils améliorés.

- `coins-drop`: on verse au chantier (les pièces tombent dans le tronc de la coopérative);
- `chantier-built`: le matin, un chantier est bâti (notification);
- `gift-give`: on offre un cadeau (papier qu'on froisse en le tendant);
- `coffee-grind`: le moulin à café offert à Odette, sur son comptoir;
- `clock-tick`: l'horloge murale du catalogue, tic-tac à moins de 3 m (boucle);
- `water-pour-copper`: l'arrosoir de cuivre, au timbre plus clair que l'arrosoir de zinc (P1).

Même famille que le reste du jeu: bois, laiton, papier, eau. Les notes restent en sol majeur.
"""

from __future__ import annotations

import numpy as np

import dsp
import instruments as ins
from catalogue import Son
from dsp import SR


def _verser(v: int, rng: np.random.Generator) -> np.ndarray:
    """On verse au chantier: une poignée de pièces glisse par la fente du tronc de bois et tombe
    sur celles qui y sont déjà. Plus long et plus « en tas » que `coins` (on compte au comptoir):
    une cascade de six à neuf pièces, la caisse de bois qui résonne en dessous, deux pièces qui
    roulent et se couchent à la fin."""
    y = dsp.toile(1.1, stereo=True)
    nb = (7, 9)[v % 2]
    t = 0.0
    for k in range(nb):
        f = rng.uniform(2500, 3900)
        piece = ins.metal(rng, f, 0.4, t60=rng.uniform(0.12, 0.25), rapports=(1.0, 1.59, 2.14, 2.30, 2.65),
                          amps=(1.0, 0.7, 0.5, 0.4, 0.25))
        gain = rng.uniform(0.3, 0.6) * (1.0 - 0.04 * k)
        dsp.poser(y, piece * gain, t, pan=rng.uniform(-0.2, 0.2))
        # Le fond du tronc: un coup de bois sourd sous chaque pièce, plus faible à mesure que le tas monte.
        dsp.poser(y, ins.bois(rng, rng.uniform(320, 380), 0.12, 0.4, t60=0.06) * 0.18 * (1.0 - 0.07 * k), t)
        t += rng.uniform(0.03, 0.07)
    # Deux pièces roulent puis se couchent: des chocs qui se resserrent.
    for j in range(2):
        f = rng.uniform(2800, 3600)
        tt = t + 0.05 + 0.12 * j
        ecart = 0.06
        for k in range(5):
            dsp.poser(y, ins.metal(rng, f, 0.15, t60=0.06) * 0.18 * (1.0 - 0.15 * k), tt, pan=(-0.15, 0.15)[j])
            tt += ecart
            ecart *= 0.62
    return dsp.pb(y, 9000)


def _chantier_bati(v: int, rng: np.random.Generator) -> np.ndarray:
    """Un chantier est bâti dans la nuit: deux coups de maillet de Basile (« toc, toc », le
    travail est fini), puis le marimba monte sol, si, ré, sol et une clochette tient le si: un
    petit air de fierté, plus ample que la notification et sans rien de commun avec le carnet."""
    y = dsp.toile(2.6, stereo=True)
    for k, t0 in enumerate((0.0, 0.2)):
        coup = ins.bois(rng, (205, 228)[k], 0.4, 1.0, rapports=(1.0, 2.3, 4.2), t60=0.18, amps=(0.9, 0.5, 0.25))
        dsp.poser(y, coup * 0.55, t0, pan=-0.1)
    for k, nom in enumerate(("G4", "B4", "D5", "G5")):
        dsp.poser(y, ins.marimba(dsp.freq(nom), 1.2, rng) * (0.6 + 0.08 * k), 0.5 + 0.11 * k, pan=-0.25 + 0.17 * k)
    dsp.poser(y, ins.clochette(dsp.freq("B5"), 1.9, rng, brillance=0.7, t60=1.5) * 0.35, 0.86, pan=0.2)
    return dsp.pb(y, 8000)


def _papier_cadeau(v: int, rng: np.random.Generator) -> np.ndarray:
    """On tend un cadeau emballé (0,5 s): le papier brun froissé sous les doigts, deux plis qui
    craquent, la ficelle qui frotte."""
    duree = 0.5
    y = dsp.toile(duree)
    dsp.poser(y, ins.froissement(rng, 0.42, 1200, 7000, rng.uniform(80, 110), 0.03, 0.18) * 0.7, 0.0)
    dsp.poser(y, ins.froissement(rng, 0.25, 600, 3000, 45, 0.02, 0.12) * 0.35, 0.08)
    for t0 in ((0.1, 0.27), (0.06, 0.31))[v % 2]:
        dsp.poser(y, ins.bruit_bref(rng, 0.03, 1500, 6500, 0.006, 0.0008) * 0.5, t0)
    m = dsp.n_ech(0.16)
    ficelle = dsp.pbande(rng.standard_normal(m), 1800, 5000) * dsp.env_points(m, [(0, 0), (0.05, 1.0), (0.16, 0)])
    dsp.poser(y, ficelle * 0.18, 0.3)
    return dsp.pb(y, 7500)


def _moulin(v: int, rng: np.random.Generator) -> np.ndarray:
    """Le moulin à café d'Odette (2,4 s): la manivelle fait un tour et demi par seconde; à chaque
    tour, les grains craquent sous la meule (un crépitement serré qui gonfle et retombe), la
    meule râpe, la caisse de bois résonne en dessous. Grains plus rares à la fin: le café est
    moulu."""
    duree = 2.4
    n = dsp.n_ech(duree)
    t = np.arange(n) / SR
    tours = (1.5, 1.4)[v % 2]
    cycle = 0.5 - 0.5 * np.cos(2 * np.pi * tours * t)
    fin = dsp.env_points(n, [(0, 0), (0.15, 1.0), (duree - 0.5, 0.9), (duree, 0)])
    rape = dsp.pbande(rng.standard_normal(n), 900, 4500) * (0.35 + 0.65 * cycle) * fin * 0.25
    caisse = dsp.resonateur(rape, rng.uniform(520, 600), 6) * 0.25 + dsp.resonateur(rape, rng.uniform(1000, 1150), 8) * 0.15
    grains = dsp.grains(duree, 90, lambda r: dsp.clic(r, 1200, 6000, 0.004, 0.001) * r.uniform(0.15, 0.6), rng,
                        enveloppe=lambda u: (0.5 - 0.5 * np.cos(2 * np.pi * tours * u)) * (1.0 - 0.5 * u / duree))
    y = rape + caisse + grains * 0.5
    # Le tour de manivelle: un petit claquement de l'axe au même point de chaque tour.
    k = 0
    while (k + 0.85) / tours < duree - 0.1:
        dsp.poser(y, ins.bois(rng, rng.uniform(260, 300), 0.1, 0.5, t60=0.05) * 0.12, (k + 0.85) / tours)
        k += 1
    return dsp.pb(y, 7000)


def _tic_tac(v: int, rng: np.random.Generator) -> np.ndarray:
    """L'horloge murale (boucle de 2 s): « tic » à 0,5 s, « tac » un peu plus grave à 1,5 s, le
    balancier qui bat la seconde dans la caisse de bois. Discret: on ne l'entend que tout près."""
    duree = 2.0
    n = dsp.n_ech(duree)
    y = np.zeros(n)
    # Les coups tombent loin du raccord de la boucle (0,5 et 1,5 s): le raccord passe dans un silence.
    for t0, f, g in ((0.5, 2750, 1.0), (1.5, 2250, 0.85)):
        echappement = ins.metal(rng, f, 0.08, t60=0.03, rapports=(1.0, 1.52, 2.4), amps=(0.8, 0.5, 0.25))
        caisse = ins.bois(rng, rng.uniform(600, 680), 0.12, 0.5, rapports=(1.0, 2.2, 3.7), t60=0.07,
                          amps=(0.6, 0.4, 0.2)) * 0.4
        dsp.poser(y, dsp.somme(echappement, caisse) * g, t0, circulaire=True)
        # Le deuxième contact de l'ancre, juste après: le « t-tic » des vieilles pendules.
        dsp.poser(y, ins.metal(rng, f * 1.1, 0.04, t60=0.015) * 0.25 * g, t0 + 0.012, circulaire=True)
    y += dsp.filtre_circulaire(dsp.bruit_spectral(n, rng, -3.0), dsp.gain_bande(300, 2000)) * 0.0015
    return dsp.filtre_circulaire(y, dsp.gain_bande(0, 7500))


def _arroser_cuivre(v: int, rng: np.random.Generator) -> np.ndarray:
    """Arroser avec l'arrosoir de cuivre (P1): la même pluie fine que l'arrosoir de zinc, mais une
    pomme plus fine (gouttes plus claires et plus serrées) et le cuivre qui chante à peine (deux
    résonances aiguës et longues) sous le filet d'eau."""
    duree = 1.5
    n = dsp.n_ech(duree)
    courant = dsp.pbande(rng.standard_normal(n), 700, 5200) * (0.7 + 0.3 * dsp.pb(rng.standard_normal(n), 8) * 8)
    gouttes = dsp.grains(duree, 420, lambda r: dsp.bulle(r, r.uniform(1900, 5200), r.uniform(0.002, 0.006)) *
                         r.uniform(0.1, 0.5), rng)
    impacts = dsp.grains(duree, 600, lambda r: dsp.clic(r, 2500, 9000, 0.003, 0.0007) * r.uniform(0.05, 0.25), rng)
    cuivre = dsp.resonateur(courant, (2050, 2120)[v % 2], 40) * 0.08 + dsp.resonateur(courant, (3380, 3450)[v % 2], 50) * 0.05
    corps = dsp.pbande(rng.standard_normal(n), 200, 700) * 0.1
    y = 0.32 * courant + 0.7 * gouttes + 0.5 * impacts + cuivre + corps
    return dsp.pb(y * dsp.env_ar(n, 0.06, 0.35), 9000)


# Écoute de l'horloge: elle ne se fait entendre qu'à moins de 3 m (fiche du catalogue).
SPATIAL_HORLOGE = "horloge"


# Sons liés à un objet acheté ou offert: dossier objets/, hors des dossiers décodés au lancement
# (residentFolders, plafond de 30 Mo de memoire.test.ts); à décoder quand l'objet est là (`decodeWhen`).
O = "objets"


def sons() -> list[Son]:
    return [
        Son("coins-drop", "Verser au chantier: les pièces tombent dans le tronc de la coopérative", "interface", "ui",
            _verser, 2, -21.0, 2, 0.03, 1.0, None, canaux=2, intervalle_min_ms=300, voix_max=1,
            note="chez celui qui verse; distinct de coins (on compte au comptoir): plus long, en tas, deux pièces qui roulent"),
        Son("chantier-built", "Un chantier est bâti dans la nuit (notification du matin, chez les deux)", O,
            "ui", _chantier_bati, 1, -19.0, 2, 0.0, 0.0, None, canaux=2, duck_db=-6.0, voix_max=1,
            queue_reverbe=(0.9, 0.2), extra={"decodeWhen": "un chantier est entièrement payé (il sera bâti dans la nuit)"},
            note="sol majeur, sans variation de hauteur; à la place de notify pour ce message"),
        Son("gift-give", "Offrir un cadeau à un habitant (papier froissé)", O, "effects", _papier_cadeau, 2,
            -24.0, 2, 0.05, 1.0, "pres", intervalle_min_ms=200, voix_max=1,
            extra={"decodeWhen": "un cadeau du rayon « Pour offrir » est dans un sac"}),
        Son("coffee-grind", "Odette moud du café au moulin offert, sur son comptoir", O, "effects", _moulin, 2,
            -27.0, 4, 0.04, 1.0, "pres", intervalle_min_ms=8000, voix_max=1,
            extra={"decodeWhen": "le moulin est offert et l'écouteur à moins de 28 m du comptoir d'Odette"},
            note="placé au moulin (comptoir d'Odette); le geste d'Odette qui le déclenche reste à définir"),
        Son("clock-tick", "Horloge murale: tic-tac du balancier (boucle, à moins de 3 m dans la pièce)", O,
            "effects", _tic_tac, 1, -38.0, 4, 0.0, 0.0, SPATIAL_HORLOGE, boucle=True, passe_haut=300, voix_max=2,
            extra={"decodeWhen": "l'horloge est posée et l'écouteur dans la maisonnette"},
            note="boucle placée à l'horloge posée au mur; coupée au-delà de 3 m"),
        Son("water-pour-copper", "Arroser une case avec l'arrosoir de cuivre (P1)", O, "effects",
            _arroser_cuivre, 2, -25.0, 3, 0.04, 1.0, "pres",
            extra={"decodeWhen": "l'arrosoir de cuivre est dans le sac de l'un des deux"},
            note="à la place de water quand l'outil est l'arrosoir de cuivre (toolKind watering_can)"),
    ]
