"""Sons des quatre moments du tour 9 (`docs/jeux/jeu-1/tour-09-conception.md`, section 4; fiches
1.4.10 et 1.4.12 du tour 7 pour les étoiles et le salut):

- les étoiles de l'Aubrune (`falling_stars`): cinq notes de célesta jouées dans l'ordre, une par
  étoile filante, et le clapotis de l'eau contre les pieux du ponton;
- le salut du mécanicien (`train_salute`): manivelles et verrou des barrières, roulement au pas,
  deux coups de sifflet, purgeurs;
- la dame blanche (`barn_owl`): le cri de l'effraie, le froissement de l'herbe au plongeon, et le
  même cri au loin pour l'ambiance des soirs d'automne sans le moment;
- les lanternes du quai (`quay_lanterns`): la mèche qui prend, la flamme seule qui s'éteint, un
  coup de la cloche du quai.

Comme les autres moments, tout va dans assets/son/moments/ (décodé quand le moment s'installe),
sauf `owl-far`, son d'ambiance des soirs ordinaires (ambiance/). Rien n'est enregistré ni imité
d'un enregistrement: les cris suivent la description naturaliste de l'espèce, filtrés au-dessus
de 6 à 7 kHz et sous les actions du joueur.
"""

from __future__ import annotations

import numpy as np

import dsp
import instruments as ins
import moments
import train
from catalogue import Son
from dsp import SR

# --- Les étoiles de l'Aubrune (falling_stars, été) --------------------------------------------

# Do pentatonique (do, ré, mi, sol, la): ces cinq classes de hauteur sont dans fa majeur (la nuit),
# sol majeur (le jour) et do majeur (le samedi); aucune paire ne forme une seconde mineure, une
# septième majeure ou un triton. Une note par étoile, dans l'ordre de la fiche; la grosse étoile
# (la troisième) a son accord, roulé de l'aigu vers le grave comme une chute.
ETOILES = (
    (("G5",), -0.2),
    (("E6",), 0.25),
    (("A6", "D6", "G5", "C5"), 0.0),
    (("D6",), -0.1),
    (("C6",), 0.2),
)


def _hauteurs_etoiles() -> list[int]:
    return sorted({dsp.note_midi(n) for notes, _ in ETOILES for n in notes})


def _etoile(k: int):
    def fabrique(v: int, rng: np.random.Generator) -> np.ndarray:
        """Une étoile filante: une lame de célesta (la grosse: quatre lames roulées), un léger
        miroitement du quatrième partiel, panoramique selon le côté du ponton où elle tombe."""
        notes, pan = ETOILES[k]
        accord = len(notes) > 1
        y = dsp.toile(2.6 if accord else 1.9, stereo=True)
        for j, nom in enumerate(notes):
            x = moments.celesta(dsp.freq(nom), 2.4 if accord else 1.8, rng)
            # Un frémissement lent (5 Hz) du partiel: la lumière qui tremble sur l'eau.
            n = len(x)
            t = np.arange(n) / SR
            x = x * (1 + 0.06 * np.sin(2 * np.pi * 5.0 * t + rng.uniform(0, 6.28)) * np.clip(t / 0.3, 0, 1))
            p = pan if not accord else (-0.3, -0.1, 0.1, 0.3)[j]
            dsp.poser(y, dsp.pb(x, 6500) * (1.0 if not accord else (0.7, 0.8, 0.9, 1.0)[j]), 0.07 * j, pan=p)
        return y
    return fabrique


def _eau_pieux(v: int, rng: np.random.Generator) -> np.ndarray:
    """L'eau calme et profonde au pied du ponton, la nuit (boucle de 6 s): de petites vagues
    lentes viennent battre les pieux, chacune en deux ou trois « clop » creux (bulles graves et
    claque mouillée sur le bois), sur un souffle d'eau très bas. Vagues sur une ligne de temps
    circulaire, bruit périodique: la boucle est sans couture."""
    duree = 6.0
    n = dsp.n_ech(duree)
    y = dsp.filtre_circulaire(dsp.bruit_spectral(n, rng, -3.0), dsp.gain_bande(180, 1400)) * 0.035
    # Quatre vagues par tour (une toutes les 1,5 s, légèrement irrégulières): le rythme d'une eau
    # presque immobile.
    for k, t0 in enumerate((0.15, 1.62, 3.08, 4.55)):
        t = t0 + rng.uniform(-0.05, 0.05)
        for j in range(int(rng.integers(2, 4))):
            f = rng.uniform(300, 520) * (1.0 - 0.06 * j)
            clop = dsp.bulle(rng, f, rng.uniform(0.012, 0.022), 1.4) * rng.uniform(0.5, 0.9)
            claque = ins.bruit_bref(rng, 0.05, 400, 2600, rng.uniform(0.008, 0.014), 0.002) * 0.3
            dsp.poser(y, clop * (1.0 - 0.25 * j), t, circulaire=True)
            dsp.poser(y, claque * (1.0 - 0.3 * j), t, circulaire=True)
            t += rng.uniform(0.09, 0.16)
        # Le retrait: un petit filet d'eau qui retombe le long du pieu.
        m = dsp.n_ech(0.35)
        filet = dsp.pbande(rng.standard_normal(m), 700, 3200) * dsp.env_points(m, [(0, 0), (0.06, 1.0), (0.35, 0)])
        dsp.poser(y, filet * 0.06, t + 0.05, circulaire=True)
    # Deux gouttes du plancher, nettes et rares.
    for t0 in (2.4, 5.3):
        dsp.poser(y, dsp.bulle(rng, rng.uniform(1500, 2400), 0.006) * 0.12, t0, circulaire=True)
    return dsp.filtre_circulaire(y, dsp.gain_bande(0, 5500))


# --- Le salut du mécanicien (train_salute) ---------------------------------------------------

def _cliquet(rng: np.random.Generator, force: float) -> np.ndarray:
    """Un cran du cliquet de la manivelle: le linguet d'acier retombe sur la dent."""
    clic = ins.metal(rng, rng.uniform(2300, 2900), 0.06, t60=0.03, rapports=(1.0, 1.7, 2.6), amps=(0.8, 0.5, 0.3))
    choc = ins.bruit_bref(rng, 0.03, 350, 1500, 0.006, 0.0005) * 0.5
    return dsp.somme(clic, choc) * force


def _manivelle(v: int, rng: np.random.Generator) -> np.ndarray:
    """La manivelle d'une barrière qu'on tourne (2,5 s, une révolution par seconde): le cliquet
    crante (onze ou treize dents par tour), les pignons grondent, le câble grince et la lisse de
    bois descend en craquant un peu. On ne l'entend qu'en jouant: le verrou est un son à part."""
    duree = 2.5
    n = dsp.n_ech(duree)
    y = np.zeros(n)
    dents = (11, 13)[v % 2]
    t = 0.0
    k = 0
    while t < duree - 0.05:
        accent = 1.0 if k % dents == 0 else 0.7
        dsp.poser(y, _cliquet(rng, accent * rng.uniform(0.75, 1.0)), t)
        t += 1.0 / dents * rng.uniform(0.92, 1.08)
        k += 1
    # Les pignons: un grondement métallique qui suit la rotation (un tour par seconde).
    tt = np.arange(n) / SR
    rotation = 0.6 + 0.4 * np.sin(2 * np.pi * 1.0 * tt + rng.uniform(0, 6.28)) ** 2
    pignons = dsp.pbande(rng.standard_normal(n), 300, 1400) * rotation * 0.12
    y += pignons * dsp.env_points(n, [(0, 0), (0.08, 1.0), (duree - 0.15, 1.0), (duree, 0)])
    # Le câble et la lisse: un grincement lent, puis le bois qui craque deux fois.
    g = ins.crissement(rng, 1.6, lambda u: 55 + 35 * np.sin(np.pi * u / 1.6), [(rng.uniform(520, 640), 9),
                                                                              (rng.uniform(1100, 1300), 12)], 0.2)
    dsp.poser(y, g * dsp.env_ar(len(g), 0.3, 0.5) * 0.25, (0.5, 0.6)[v % 2])
    for t0 in ((1.1, 2.05), (0.9, 1.85))[v % 2]:
        dsp.poser(y, ins.bois(rng, rng.uniform(190, 240), 0.25, 0.6, t60=0.1) * 0.25, t0)
    return dsp.pb(y, 7000)


def _verrou(v: int, rng: np.random.Generator) -> np.ndarray:
    """La lisse se pose sur sa fourche et le verrou claque (0,3 s): choc de bois, puis le pêne
    d'acier qui tombe dans sa gâche."""
    y = dsp.toile(0.45)
    dsp.poser(y, ins.bois(rng, 210, 0.3, 1.0, rapports=(1.0, 2.2, 4.3), t60=0.12, amps=(0.7, 0.5, 0.25)) * 0.6, 0.0)
    dsp.poser(y, ins.bruit_bref(rng, 0.08, 150, 600, 0.02, 0.001) * 0.35, 0.0)
    pene = ins.metal(rng, 780, 0.35, t60=0.18, rapports=(1.0, 2.41, 3.9, 5.6), amps=(1.0, 0.6, 0.3, 0.15))
    dsp.poser(y, pene * 0.8, 0.045)
    dsp.poser(y, _cliquet(rng, 0.5), 0.095)
    return dsp.pb(y, 8000)


def _roulement_au_pas(v: int, rng: np.random.Generator) -> np.ndarray:
    """La locomotive au pas (1,6 m/s), boucle de 2 s qui suit la cabine: quatre bouffées douces
    par tour (régulateur presque fermé), la bielle qui cogne une fois, un joint de rail en
    « ta... dam » (deux essieux à 2,4 m, donc 1,5 s d'écart), le grondement bas des roues. Les coups
    encadrent le raccord de la boucle (0,25 s de part et d'autre): il tombe entre deux attaques."""
    duree = 2.0
    n = dsp.n_ech(duree)
    y = dsp.filtre_circulaire(dsp.bruit_spectral(n, rng, -3.0), dsp.gain_bande(40, 260)) * 0.08
    for k, t0 in enumerate((0.25, 0.75, 1.25, 1.75)):
        accent = (1.0, 0.65, 0.8, 0.65)[k]
        dsp.poser(y, train._bouffee(rng, accent * 0.55, 0.42, 0.35), t0, circulaire=True)
    bielle = dsp.somme(ins.metal(rng, 640, 0.25, t60=0.12, rapports=(1.0, 2.3, 3.4), amps=(0.6, 0.35, 0.15)),
                       ins.bruit_bref(rng, 0.1, 80, 400, 0.02) * 0.8)
    dsp.poser(y, bielle * 0.18, 1.0, circulaire=True)
    for t0, g in ((0.25, 0.32), (1.75, 0.26)):
        clac = dsp.somme(ins.metal(rng, rng.uniform(1300, 1700), 0.12, t60=0.05, rapports=(1.0, 1.8, 2.9),
                                   amps=(0.6, 0.4, 0.2)), ins.bruit_bref(rng, 0.08, 80, 500, 0.02) * 1.4)
        dsp.poser(y, clac * g, t0, circulaire=True)
    # Les boudins des roues frottent doucement dans la courbe du quai: une raie aiguë très faible,
    # d'amplitude périodique (un cycle par tour) pour rester sans couture.
    tt = np.arange(n) / SR
    crisse = np.sin(2 * np.pi * 2100 * tt) * (0.5 + 0.5 * np.sin(2 * np.pi * tt / duree)) * 0.004
    return dsp.filtre_circulaire(y + crisse, dsp.gain_bande(0, 7000))


def _sifflet_salut(v: int, rng: np.random.Generator) -> np.ndarray:
    """Le salut: deux coups courts (0,4 s chacun, à 0 et 0,6 s) des mêmes trois tuyaux que le
    sifflet du train (ré, sol, si): la même locomotive, un autre message que le « pou-pouuu » du
    départ. Un seul déclenchement à 10,0 s joue les deux coups."""
    y = dsp.toile(1.4)
    for k_coup, t0 in enumerate((0.0, 0.6)):
        for k, f in enumerate(train.TUYAUX):
            dsp.poser(y, train._tuyau(rng, f, 0.4, (1.0, 0.85, 0.7)[k] * (1.0 if k_coup == 0 else 0.95)), t0 + 0.006 * k)
        m = dsp.n_ech(0.4)
        vapeur = dsp.pbande(rng.standard_normal(m), 2500, 9000) * dsp.env_points(m, [(0, 0), (0.03, 1.0), (0.4, 0.3)])
        dsp.poser(y, vapeur * 0.08, t0)
    return y


def _purgeurs(v: int, rng: np.random.Generator) -> np.ndarray:
    """Les purgeurs des cylindres ouverts (2,5 s): deux jets de vapeur au ras du ballast, l'un
    juste après l'autre (un par cylindre), plus rauques et plus bas que le grand jet de l'arrêt,
    puis le nuage qui roule sur la traversée et s'éteint."""
    duree = 2.5
    n = dsp.n_ech(duree)
    y = np.zeros(n)
    for k, t0 in enumerate((0.0, 0.22)):
        m = dsp.n_ech(duree - t0)
        x = rng.standard_normal(m)
        env = dsp.env_points(m, [(0, 0), (0.03, 1.0), (0.45, 0.75), (1.4, 0.3), (duree - t0, 0)])
        jet = dsp.pbande(x, 700, 4200) * 0.5 + dsp.pbande(x, 160, 700) * 0.6
        jet *= 1 + 0.25 * dsp.pb(rng.standard_normal(m), 25) * 8  # turbulence du jet sur les pierres
        dsp.poser(y, jet * env * (1.0, 0.85)[k], t0)
    # Les gouttes d'eau chaude projetées sur le ballast.
    y += dsp.grains(duree, 40, lambda r: dsp.clic(r, 1500, 6000, 0.003, 0.0008) * r.uniform(0.05, 0.2), rng,
                    enveloppe=lambda u: np.exp(-u / 0.6))
    return dsp.pb(y, 6000)


# --- La dame blanche (barn_owl, automne) -----------------------------------------------------

def _cri_effraie(rng: np.random.Generator, duree: float, f_de: float, f_a: float) -> np.ndarray:
    """Le cri de l'effraie: un long chuintement rauque et soufflé, « chhhrrééé », presque sans
    note: un souffle large (1,5 à 6 kHz) haché par une rugosité rapide, sur une voix faible et
    éraillée qui monte un peu puis retombe. Attaque arrondie, fin qui s'effiloche."""
    n = dsp.n_ech(duree)
    f_t = moments.courbe(duree, [(0.0, f_de * 0.9), (0.2, f_de), (0.7, (f_de + f_a) / 2), (1.0, f_a)])
    voix = moments.voix(rng, f_t, [(2300, 3.0, 1.0), (3600, 4.0, 0.7), (5000, 5.0, 0.35)], rugosite=0.9,
                        f_rugosite=rng.uniform(55, 75), souffle=0.4, pente=0.8, f_max=7000)
    souffle = dsp.pbande(rng.standard_normal(n), 1500, 6000)
    hachage = np.abs(dsp.pb(rng.standard_normal(n), 90, 2))
    hachage = (hachage / (hachage.max() + 1e-12)) ** 0.8
    souffle = souffle * (0.4 + 0.6 * hachage)
    voix = voix / (np.max(np.abs(voix)) + 1e-12)
    souffle = souffle / (np.max(np.abs(souffle)) + 1e-12)
    env = dsp.env_points(n, [(0, 0), (0.12, 0.8), (0.3, 1.0), (duree * 0.75, 0.85), (duree, 0)])
    return (0.45 * voix + 0.8 * souffle) * env


def _effraie(v: int, rng: np.random.Generator) -> np.ndarray:
    """Trois cris (1,1 à 1,3 s), chacun avec sa courbe de hauteur."""
    duree, f_de, f_a = ((1.2, 1150, 980), (1.1, 1050, 1000), (1.3, 1250, 1020))[v % 3]
    return dsp.pb(_cri_effraie(rng, duree, f_de, f_a), 6500, 2)


def _effraie_loin(v: int, rng: np.random.Generator) -> np.ndarray:
    """Le même cri, loin dans la nuit (au-dessus de la remise ou des prés): aigus amortis par
    l'air, un écho des granges, plus de souffle que de voix. Pour l'ambiance des soirs d'automne
    sans le moment."""
    duree, f_de, f_a = ((1.2, 1150, 980), (1.3, 1250, 1020))[v % 2]
    cri = dsp.pb(_cri_effraie(rng, duree, f_de, f_a), 2600, 2)
    y = dsp.toile(4.0)
    dsp.poser(y, cri, 0.0)
    dsp.poser(y, dsp.pb(cri, 1600) * 0.22, 0.38)
    ir = dsp.ir_salle(2.4, 0.03, 0.25, graine=93 + v, largeur=1.0)
    return dsp.reverbe_mono(y, ir, humide=0.5, sec=0.75)


def _herbe_frappee(v: int, rng: np.random.Generator) -> np.ndarray:
    """L'effraie plonge dans l'herbe haute (0,4 s): les serres qui frappent (un « fff-toup » mat),
    l'herbe sèche froissée sous les ailes en manteau. Le choc garde peu d'énergie sous 300 Hz,
    pour s'entendre sur un portable."""
    y = dsp.toile(0.5)
    dsp.poser(y, ins.froissement(rng, 0.08, 1200, 6000, 120, 0.01, 0.05) * 0.4, 0.0)
    dsp.poser(y, ins.bruit_bref(rng, 0.12, 220, 1100, 0.03, 0.002) * 0.6, 0.045)
    dsp.poser(y, ins.froissement(rng, 0.34, 900, 5500, 70, 0.03, 0.2) * 0.55, 0.06)
    for t0 in (0.12, 0.2, 0.27):
        dsp.poser(y, dsp.clic(rng, 1800, 6000, 0.004, 0.001) * 0.12, t0 + rng.uniform(-0.01, 0.01))
    return dsp.pb(y, 6500)


# --- Les lanternes du quai (quay_lanterns, automne) ------------------------------------------

def _meche(v: int, rng: np.random.Generator) -> np.ndarray:
    """La perche allume la mèche (0,6 s): un petit « fffou » quand le pétrole prend, deux ou trois
    grésillements de la mèche, puis le souffle tranquille de la flamme qui se pose. Deux variantes:
    les deux lanternes s'allument au même instant."""
    duree = 0.6
    n = dsp.n_ech(duree)
    y = np.zeros(n)
    m = dsp.n_ech(0.35)
    prise = dsp.pb_variable(rng.standard_normal(m), lambda u: 300 + 1300 * min(u / 0.12, 1.0), type_="band",
                            q_bande=0.8)
    prise *= dsp.env_points(m, [(0, 0), (0.05, 1.0), (0.12, 0.7), (0.35, 0)])
    dsp.poser(y, prise * 0.6, 0.0)
    for t0 in ((0.06, 0.13, 0.22), (0.05, 0.17))[v % 2]:
        dsp.poser(y, dsp.clic(rng, 1200, 4500, 0.005, 0.0012) * rng.uniform(0.1, 0.18), t0)
    flamme = dsp.pbande(rng.standard_normal(n), 250, 1800) * dsp.env_points(n, [(0, 0), (0.1, 0.4), (0.3, 0.3),
                                                                                  (duree, 0)])
    flamme *= 1 + 0.2 * np.sin(2 * np.pi * rng.uniform(6, 8) * np.arange(n) / SR)
    y += flamme * 0.35
    # Le verre de la lanterne qui tinte à peine quand on retire le crochet.
    dsp.poser(y, ins.metal(rng, rng.uniform(3100, 3500), 0.2, t60=0.15) * 0.04, 0.42)
    return dsp.pb(y, 7000)


def _souffle_flamme(v: int, rng: np.random.Generator) -> np.ndarray:
    """La flamme seule vacille et s'éteint (0,4 s): trois battements de plus en plus faibles, un
    petit « pff » et le grésillement de la mèche qui fume."""
    duree = 0.4
    n = dsp.n_ech(duree)
    t = np.arange(n) / SR
    vacille = dsp.pbande(rng.standard_normal(n), 300, 1600) * (0.5 + 0.5 * np.sin(2 * np.pi * 9 * t) ** 2)
    vacille *= dsp.env_points(n, [(0, 0.5), (0.18, 0.4), (0.24, 0), (duree, 0)])
    y = vacille * 0.4
    m = dsp.n_ech(0.14)
    pff = dsp.pbande(rng.standard_normal(m), 400, 3500) * dsp.env_points(m, [(0, 0), (0.015, 1.0), (0.14, 0)])
    dsp.poser(y, pff * 0.6, 0.2)
    for t0 in (0.27, 0.33):
        dsp.poser(y, dsp.clic(rng, 1800, 5000, 0.004, 0.001) * 0.12, t0)
    return dsp.pb(y, 6500)


def _cloche_un_coup(v: int, rng: np.random.Generator) -> np.ndarray:
    """Un seul coup de la cloche du quai (la même que station-bell, sol 4): Firmin sonne pour dire
    que la Halte veille."""
    y = dsp.toile(3.4)
    coup = ins.clochette(dsp.freq("G4"), 3.2, rng, brillance=1.3, t60=2.6)
    coup = coup + dsp.modes(dsp.n_ech(3.2), [(dsp.freq("G4") * 0.5, 0.25, 3.0), (dsp.freq("G4") * 2.0, 0.3, 1.6)], rng)
    dsp.poser(y, coup, 0.0)
    return y


# --- Déclarations ------------------------------------------------------------------------------

def controler_etoiles() -> None:
    """Les cinq notes sonnent les unes sur les autres (résonance): aucune paire dure, toutes
    classes de hauteur confondues, et toutes dans do, ré, mi, sol, la."""
    hauteurs = _hauteurs_etoiles()
    durs = [(a, b) for i, a in enumerate(hauteurs) for b in hauteurs[i + 1:] if (b - a) % 12 in (1, 6, 11)]
    hors = [h for h in hauteurs if h % 12 not in (0, 2, 4, 7, 9)]
    if durs or hors:
        raise SystemExit(f"star-chime: intervalles durs {durs}, notes hors de do pentatonique {hors}")


def sons() -> list[Son]:
    controler_etoiles()
    m = "moments"
    rangs = ("première", "deuxième", "troisième, la grosse", "quatrième", "cinquième")
    instants = ("0,0", "2,4", "4,5", "7,6", "9,4")
    notes_fr = ("sol 5", "mi 6", "accord la, ré, sol, do roulé vers le grave", "ré 6", "do 6")
    etoiles = [
        Son(f"star-chime-{k + 1}", f"Étoiles de l'Aubrune: {rangs[k]} étoile filante (apogée, t = {instants[k]} s), "
            f"célesta: {notes_fr[k]}", m, "music", _etoile(k), 1, -21.0 if k == 2 else -24.0, 2, 0.0, 0.5, None,
            canaux=2, voix_max=1, queue_reverbe=(1.6, 0.3), duree_max=2.6 if k == 2 else 1.9,
            extra={"momentSound": f"star_chime_{k + 1}", "moment": "falling_stars", "order": k + 1,
                   "family": "star-chime"},
            note="cinq sons joués dans l'ordre de la fiche (star_chime note 1, note 2, accord, note 3, note 4), "
                 "un par étoile; do pentatonique, juste sur la nuit (fa), le jour (sol) et le samedi (do); "
                 "aucune variation de hauteur")
        for k in range(5)
    ]
    return etoiles + [
        Son("night-water", "Étoiles de l'Aubrune: l'eau calme qui clapote contre les pieux du ponton (boucle placée à "
            "stars_water)", m, "ambience", _eau_pieux, 1, -30.0, 3, 0.0, 0.0, "faune-12", boucle=True, passe_haut=120,
            voix_max=1, extra={"momentSound": "night_water", "moment": "falling_stars"},
            note="audible à 12 m (fiche); pendant la présence, l'attente et l'apogée"),
        # Le salut du mécanicien
        Son("gate-crank", "Salut du mécanicien: on tourne la manivelle d'une barrière (2,5 s, armement)", m, "effects",
            _manivelle, 2, -24.0, 2, 0.03, 1.0, "moyen", voix_max=2,
            extra={"momentSound": "gate_crank", "moment": "train_salute"},
            note="un par poteau, placé à la manivelle; les deux jouent ensemble (deux variantes, tirées sans répétition)"),
        Son("gate-lock", "Salut du mécanicien: la lisse se pose et le verrou claque (fin de l'armement)", m, "effects",
            _verrou, 1, -22.0, 2, 0.04, 1.0, "moyen", voix_max=2,
            extra={"momentSound": "gate_lock", "moment": "train_salute"}, note="un par poteau, à 2,5 s"),
        Son("train-slow-roll", "Salut du mécanicien: la locomotive au pas, bouffées douces et joints de rail (boucle)", m,
            "effects", _roulement_au_pas, 1, -24.0, 1, 0.0, 0.0, "loin", boucle=True, passe_haut=35, voix_max=1,
            extra={"momentSound": "train_slow_roll", "moment": "train_salute"},
            note="de t = 8 s à la sortie de la carte, placé à la cabine et déplacé avec elle"),
        Son("train-whistle-salute", "Salut du mécanicien: deux coups de sifflet courts (apogée, t = 10,0 s)", m,
            "effects", _sifflet_salut, 1, -15.0, 1, 0.0, 0.0, "vallee", passe_haut=200, voix_max=1,
            queue_reverbe=(1.6, 0.2), extra={"momentSound": "train_whistle_salute", "moment": "train_salute"},
            note="un seul déclenchement à 10,0 s: le fichier contient les deux coups (10,0 et 10,6 s); mêmes tuyaux "
                 "que train-whistle, deux coups brefs au lieu du « pou-pouuu »"),
        Son("cylinder-cocks", "Salut du mécanicien: purgeurs ouverts, deux jets de vapeur au ras du ballast (t = 11 s)",
            m, "effects", _purgeurs, 1, -20.0, 2, 0.03, 0.5, "loin", passe_haut=60, voix_max=1,
            extra={"momentSound": "cylinder_cocks", "moment": "train_salute"}),
        # La dame blanche
        Son("owl-screech", "Dame blanche: cri rauque et soufflé de l'effraie (attente toutes les 20 à 30 s; apogée, "
            "t = 13,4 s)", m, "effects", _effraie, 3, -23.0, 2, 0.03, 1.0, "faune-25", intervalle_min_ms=5000,
            voix_max=1, extra={"momentSound": "owl_screech", "moment": "barn_owl"},
            note="audible à 25 m; placé à l'effraie; son vol reste silencieux (fiche)"),
        Son("grass-strike", "Dame blanche: elle plonge dans l'herbe haute, serres en avant (apogée, t = 6,2 s)", m,
            "effects", _herbe_frappee, 1, -25.0, 2, 0.04, 1.0, "faune-20", voix_max=1,
            extra={"momentSound": "grass_strike", "moment": "barn_owl"}),
        Son("owl-far", "Soir d'automne: le cri de l'effraie, loin dans la nuit (une fois entre 19 h 30 et 21 h, les "
            "soirs sans la dame blanche)", "ambiance", "ambience", _effraie_loin, 2, -30.0, 4, 0.03, 1.5, None,
            voix_max=1, extra={"season": "autumn"},
            note="non placé, joué une fois par soir (plan.eveningCalls); jamais sous la pluie ni le soir du moment"),
        # Les lanternes du quai
        Son("lantern-light", "Lanternes du quai: la perche allume la mèche (fffou, grésillement, flamme)", m, "effects",
            _meche, 2, -24.0, 2, 0.04, 1.0, "moyen", voix_max=2,
            extra={"momentSound": "lantern_light", "moment": "quay_lanterns"},
            note="à chaque lanterne; les deux s'allument au même instant à l'apogée: aucun intervalle minimal"),
        Son("lantern-out", "Lanternes du quai: allumée seule, la flamme vacille et s'éteint (0,8 s après)", m,
            "effects", _souffle_flamme, 1, -26.0, 2, 0.05, 1.0, "pres", voix_max=2,
            extra={"momentSound": "lantern_out", "moment": "quay_lanterns"}),
        Son("quay-bell-once", "Lanternes du quai: Firmin sonne une fois la cloche du quai (apogée, t = 6,0 s)", m,
            "effects", _cloche_un_coup, 1, -18.0, 2, 0.0, 0.0, "loin", voix_max=1, queue_reverbe=(1.6, 0.2),
            extra={"momentSound": "quay_bell_once", "moment": "quay_lanterns"},
            note="le premier coup de station-bell, seul; placé à la cloche (quay_bell), entendu des deux places"),
    ]
