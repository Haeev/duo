"""Sons des lieux de la 0.13, second passage (`docs/jeux/jeu-1/v0-13-carte.md`, lot L4 bis; mission
0.13 du 2026-11-04): la sonnerie de la messe du dimanche, l'eau du bief et du lavoir, la terrasse du
café, le rabot et la scie de la menuiserie, les deux réactions aux cadeaux et le sifflet du train
aux passages à niveau de l'Église et de la ferme.

Dossiers: `eglise/`, `metiers/`, `ambiance/` (décodés à la demande, comme le premier passage),
`carnet/` (décodé au lancement: un cadeau s'offre partout), `train/` (décodé les jours de train).

Même famille que le reste: cloches accordées sur sol, bois, fer, eau; ce qui chante est en sol
majeur (pentatonique). Aucune voix articulée (cahier, 6.12): la rumeur de la terrasse est un
murmure sans consonnes ni voyelles reconnaissables (sources voisées sans formants mobiles,
coupées au-dessus de 1 kHz), avec un rire bref, son non verbal permis par le cahier.
"""

from __future__ import annotations

import numpy as np

import ambiances
import dsp
import instruments as ins
import train
from catalogue import Son
from dsp import SR
from v0_13 import CLOCHES, _boucle_reverbe, _cloche, _tasse, _verre

E, MET, A, CAR, TR = "eglise", "metiers", "ambiance", "carnet", "train"


# --- La messe du dimanche --------------------------------------------------------------------

def _messe(v: int, rng: np.random.Generator) -> np.ndarray:
    """La sonnerie de la messe (dimanche 10 h 15, un quart d'heure avant l'office): plus longue et
    plus pleine que la volée de l'angélus. Le bourdon commence seul quatre coups, la moyenne et la
    petite le rejoignent, les trois sonnent ensemble à pleine volée une douzaine de secondes, puis
    ralentissent quand Marthe lâche les cordes. 22 s, puis la résonance."""
    duree = 26.0
    y = dsp.toile(duree)
    fin = 19.0
    lacher_des = 16.0
    for nom, ecart, depart, gain in (("bourdon", 1.22, 0.0, 1.0), ("moyenne", 0.97, 4.4, 0.6),
                                     ("petite", 0.81, 5.3, 0.44)):
        t = depart
        f = dsp.freq(CLOCHES[nom])
        k = 0
        while t < fin:
            montee = min(1.0, 0.5 + 0.5 * (t - depart) / 3.0)
            lacher = 1.0 if t < lacher_des else max(0.3, 1.0 - (t - lacher_des) / 3.5)
            force = montee * lacher * rng.uniform(0.93, 1.0) * (1.0 if k % 2 == 0 else 0.88)
            dsp.poser(y, _cloche(rng, f, min(6.0, duree - t), force, t60=6.5) * gain * force, t)
            t += ecart * rng.uniform(0.97, 1.03) * (1.0 if t < lacher_des else 1.0 + 0.08 * (t - lacher_des))
            k += 1
    return dsp.pb(y, 6500)


# --- L'eau du bief et du lavoir --------------------------------------------------------------

def _bief(v: int, rng: np.random.Generator) -> np.ndarray:
    """Le bief du moulin (boucle de 20 s, placée le long du canal): une eau vive et profonde qui
    court entre deux murets de pierre, plus pleine et plus grave que le ru, sans la chute de la
    roue (elle a sa propre boucle). Un lit continu, des remous ronds qui roulent contre le muret,
    quelques clapotis plus clairs aux pierres du bord."""
    duree = 20.0
    n = dsp.n_ech(duree)
    lit = dsp.filtre_circulaire(dsp.bruit_spectral(n, rng, -3.0), dsp.gain_bande(160, 4500)) * 0.2
    lit *= 1 + 0.12 * ambiances.lfo_periodique(n, [(2, 1.0), (5, 0.5)], rng)
    courant = dsp.filtre_circulaire(dsp.bruit_spectral(n, rng, -1.0), dsp.gain_bande(600, 3200))
    mod = np.abs(dsp.filtre_circulaire(dsp.bruit_spectral(n, rng, 0.0), dsp.gain_bande(1.5, 12)))
    courant *= (0.4 + 0.6 * mod / (mod.max() + 1e-12)) * 0.35
    y = lit + courant
    y += dsp.grains(duree, 26, lambda r: dsp.bulle(r, r.uniform(220, 520), r.uniform(0.02, 0.045), 1.0) *
                    r.uniform(0.15, 0.35), rng, circulaire=True)
    y += dsp.grains(duree, 140, lambda r: dsp.bulle(r, float(np.exp(r.uniform(np.log(800), np.log(3200)))),
                                                    r.uniform(0.004, 0.01)) * r.uniform(0.04, 0.16), rng, circulaire=True)
    # Un souffle aigu très faible: évite qu'un fond trop lisse fasse ressortir le codage au raccord.
    y += dsp.filtre_circulaire(dsp.bruit_spectral(n, rng, 0.0), dsp.gain_bande(3000, 9000)) * 0.01
    return dsp.filtre_circulaire(y, dsp.gain_bande(0, 9000))


def _lavoir(v: int, rng: np.random.Generator) -> np.ndarray:
    """Le lavoir (boucle de 16 s, placée au bassin): le filet d'eau du déversoir qui tombe dans le
    bassin de pierre (un jet continu, clair, qui chante un peu sous le toit), l'eau qui lèche la
    pierre du bord, quelques gouttes qui tombent de la margelle. Le battoir est un son à part
    (`washboard-beat`), joué quand quelqu'un lave."""
    duree = 16.0
    n = dsp.n_ech(duree)
    jet = dsp.filtre_circulaire(dsp.bruit_spectral(n, rng, -1.5), dsp.gain_bande(700, 6000)) * 0.12
    jet *= 1 + 0.08 * ambiances.lfo_periodique(n, [(4, 1.0), (11, 0.4)], rng)
    # Le jet frappe la surface: une multitude de petites bulles serrées.
    y = jet + dsp.grains(duree, 420, lambda r: dsp.bulle(r, float(np.exp(r.uniform(np.log(900), np.log(4200)))),
                                                         r.uniform(0.002, 0.007)) * r.uniform(0.03, 0.12), rng,
                         circulaire=True)
    # Le bassin qui lèche le bord: des vagues lentes et graves.
    leche = dsp.filtre_circulaire(dsp.bruit_spectral(n, rng, -4.0), dsp.gain_bande(150, 1200))
    leche *= np.clip(0.55 + 0.45 * ambiances.lfo_periodique(n, [(4, 1.0), (8, 0.4)], rng), 0.0, None) ** 2 * 0.05
    y += leche
    for t0 in (2.3, 6.9, 11.2, 14.6):
        dsp.poser(y, dsp.bulle(rng, rng.uniform(900, 1400), rng.uniform(0.015, 0.025), 1.0) * 0.25, t0, circulaire=True)
    y = _boucle_reverbe(y, 0.7, 0.18, 121, predelai=0.008, aigus=0.5)
    return dsp.filtre_circulaire(y, dsp.gain_bande(0, 9500))


# --- La terrasse du café ---------------------------------------------------------------------

def _rumeur_voix(rng: np.random.Generator, duree: float, f0: float) -> np.ndarray:
    """Une voix au loin, sans mots: une source voisée dont la hauteur ondule, découpée en
    groupes de syllabes par une enveloppe lente, filtrée par une bande fixe (aucun formant qui
    bouge: on n'y entend aucune voyelle), coupée au-dessus de 1 kHz."""
    n = dsp.n_ech(duree)
    t = np.arange(n) / SR
    glisse = dsp.pb(rng.standard_normal(n), 2.0, 1)
    glisse /= np.abs(glisse).max() + 1e-12
    f = f0 * (1 + 0.12 * glisse)
    phase = 2 * np.pi * np.cumsum(f) / SR
    source = sum(np.sin(k * phase) / k ** 1.2 for k in range(1, 10))
    syll = np.abs(dsp.pb(rng.standard_normal(n), 4.5, 2))
    syll = (syll / (syll.max() + 1e-12)) ** 1.5
    # Phrases et silences: on parle quelques secondes, puis on écoute.
    phrases = np.clip(np.sin(2 * np.pi * t / rng.uniform(5, 9) + rng.uniform(0, 6.28)) * 1.6 + 0.4, 0.0, 1.0)
    y = dsp.pbande(source * syll * phrases, 240, 1000, 2)
    return y * dsp.env_ar(n, 0.3, 0.3)


def _rire(rng: np.random.Generator) -> np.ndarray:
    """Un rire bref au loin (« ha ha ha », sans voyelle nette): trois bouffées voisées qui
    descendent."""
    y = dsp.toile(0.9)
    f0 = rng.uniform(170, 230)
    for k in range(4):
        d = 0.13
        m = dsp.n_ech(d)
        ph = 2 * np.pi * np.cumsum(np.full(m, f0 * (1 - 0.05 * k))) / SR
        src = sum(np.sin(j * ph) / j ** 1.1 for j in range(1, 10)) + 0.3 * rng.standard_normal(m)
        dsp.poser(y, dsp.pbande(src, 180, 1100) * dsp.env_ar(m, 0.015, 0.08) * (1 - 0.15 * k), 0.17 * k)
    return y


def _terrasse(v: int, rng: np.random.Generator) -> np.ndarray:
    """La terrasse du café de la Côte, de dehors (boucle de 30 s, placée sur la terrasse quand des
    habitants y sont): la rumeur de quatre ou cinq voix sans mots, un rire, des tasses posées sur
    leurs soucoupes, une cuillère, un verre sur une table de fer, une chaise de fer qu'on tire
    sur les pavés, la porte vitrée du café. Pas de musique."""
    duree = 30.0
    n = dsp.n_ech(duree)
    y = np.zeros(n)
    for k, f0 in enumerate((115, 135, 175, 205, 230)):
        voix = _rumeur_voix(rng, duree, f0 * rng.uniform(0.95, 1.05))
        dsp.poser(y, voix * (0.03 if k < 2 else 0.022), 0.0, circulaire=True)
    for t0 in (8.2, 22.7):
        dsp.poser(y, _rire(rng) * 0.03, t0, circulaire=True)
    for t0 in (1.8, 5.6, 12.1, 17.4, 24.3, 27.9):
        dsp.poser(y, _tasse(rng) * 0.05, t0, circulaire=True)
    t = 14.0
    for k in range(7):
        cuil = ins.metal(rng, rng.uniform(3600, 4200), 0.12, t60=0.05, rapports=(1.0, 1.9), amps=(1.0, 0.3))
        dsp.poser(y, cuil * 0.035, t, circulaire=True)
        t += rng.uniform(0.13, 0.18)
    verre = dsp.somme(ins.metal(rng, 1900, 0.4, t60=0.2, rapports=(1.0, 2.32, 4.25), amps=(1.0, 0.3, 0.1)) * 0.6,
                      ins.metal(rng, 720, 0.3, t60=0.12, rapports=(1.0, 2.7), amps=(1.0, 0.4)) * 0.4)
    dsp.poser(y, verre * 0.05, 9.7, circulaire=True)
    chaise = ins.crissement(rng, 0.35, lambda u: 160 + 260 * u, [(rng.uniform(900, 1100), 5), (2300, 7)], 0.4)
    dsp.poser(y, chaise * dsp.env_ar(len(chaise), 0.03, 0.08) * 0.05, 19.8, circulaire=True)
    porte = dsp.somme(ins.bois(rng, 240, 0.3, 0.7, rapports=(1.0, 2.2, 3.6), t60=0.1) * 0.4,
                      ins.metal(rng, 2900, 0.5, t60=0.3, rapports=(1.0, 1.47, 2.2), amps=(1.0, 0.4, 0.2)) * 0.2)
    dsp.poser(y, porte * 0.05, 3.9, circulaire=True)
    air = dsp.filtre_circulaire(dsp.bruit_spectral(n, rng, -3.0), dsp.gain_bande(150, 6000)) * 0.004
    y = air + _boucle_reverbe(y, 0.8, 0.2, 123, predelai=0.02, aigus=0.35)
    return dsp.filtre_circulaire(y, dsp.gain_bande(0, 9000))


# --- La menuiserie ---------------------------------------------------------------------------

def _rabot_coup(rng: np.random.Generator, longueur: float, force: float = 1.0) -> np.ndarray:
    """Une passe de rabot sur une planche: le fer qui mord (petit claquement), le copeau qui
    file en chuintant (frottement collé-glissé rapide, bande 1,5 à 7 kHz), la semelle qui
    glisse sur le bois (grave doux), puis le rabot qui sort de la planche."""
    duree = longueur + 0.15
    n = dsp.n_ech(duree)
    copeau = ins.froissement(rng, longueur, 1500, 7000, 260, 0.03, 0.06)
    stick = ins.crissement(rng, longueur, lambda u: 260 + 120 * np.sin(np.pi * u), [(rng.uniform(1700, 2000), 4),
                                                                                    (rng.uniform(3300, 3800), 5)], 0.5)
    stick = stick / (np.abs(stick).max() + 1e-12)
    semelle = dsp.pbande(rng.standard_normal(dsp.n_ech(longueur)), 250, 1200) * dsp.env_ar(dsp.n_ech(longueur), 0.04, 0.08)
    y = np.zeros(n)
    dsp.poser(y, copeau * 0.55, 0.0)
    dsp.poser(y, stick * dsp.env_ar(len(stick), 0.03, 0.06) * 0.18, 0.0)
    dsp.poser(y, semelle * 0.12, 0.0)
    dsp.poser(y, ins.bois(rng, rng.uniform(420, 520), 0.12, 0.9, t60=0.03) * 0.25, 0.0)
    dsp.poser(y, ins.bois(rng, rng.uniform(600, 700), 0.1, 0.5, t60=0.02) * 0.12, longueur)
    return y * force


def _rabot(v: int, rng: np.random.Generator) -> np.ndarray:
    """Le rabot de la menuiserie: une passe longue, une courte, une qui finit en copeau bouclé."""
    longueur = (0.75, 0.48, 0.62)[v % 3]
    y = dsp.toile(longueur + 0.3)
    dsp.poser(y, _rabot_coup(rng, longueur), 0.0)
    if v % 3 == 2:
        dsp.poser(y, ins.froissement(rng, 0.12, 3000, 8000, 120, 0.01, 0.06) * 0.2, longueur - 0.05)
    return dsp.pb(y, 10000)


def _trait_scie(rng: np.random.Generator, longueur: float, pousse: bool) -> np.ndarray:
    """Un trait de scie égoïne: les dents qui accrochent (cadence 120 à 200 coups par seconde),
    filtrées par la lame et la planche; la poussée coupe et sonne plus fort que le retour."""
    debit = (lambda u: 120 + 80 * np.sin(np.pi * u)) if pousse else (lambda u: 100 + 60 * np.sin(np.pi * u))
    dents = ins.crissement(rng, longueur, debit, [(rng.uniform(1400, 1600), 3), (rng.uniform(2900, 3300), 4),
                                                  (rng.uniform(5200, 5800), 5), (rng.uniform(650, 750), 4)], 0.35)
    dents = dents / (np.abs(dents).max() + 1e-12)
    sciure = ins.froissement(rng, longueur, 2500, 8000, 90, 0.03, 0.05)
    y = dents * 0.6 + sciure * 0.3
    return y * dsp.env_ar(len(y), 0.04, 0.06) * (1.0 if pousse else 0.55)


def _scie(v: int, rng: np.random.Generator) -> np.ndarray:
    """La scie de la menuiserie: un aller et retour (poussée, retour), joué trait par trait."""
    pousse = (0.42, 0.36, 0.46)[v % 3]
    retour = pousse * 0.85
    y = dsp.toile(pousse + retour + 0.2)
    dsp.poser(y, _trait_scie(rng, pousse, True), 0.0)
    dsp.poser(y, _trait_scie(rng, retour, False), pousse + 0.02)
    return dsp.pb(y, 10000)


def _menuiserie(v: int, rng: np.random.Generator) -> np.ndarray:
    """La menuiserie au travail (boucle de 12 s, placée à l'établi quand le menuisier y est): une
    série de huit traits de scie qui finit par la chute de la planche, trois passes de rabot,
    quatre coups de maillet sur le ciseau, une planche posée sur l'établi. Aucune attaque à moins
    de 0,25 s du raccord."""
    duree = 12.0
    n = dsp.n_ech(duree)
    y = dsp.filtre_circulaire(dsp.bruit_spectral(n, rng, -4.0), dsp.gain_bande(100, 3000)) * 0.004
    t = 0.4
    for k in range(8):
        d = rng.uniform(0.32, 0.4)
        dsp.poser(y, _trait_scie(rng, d, k % 2 == 0) * 0.5, t, circulaire=True)
        t += d + 0.03
    chute = dsp.somme(ins.bois(rng, 210, 0.4, 0.9, rapports=(1.0, 2.3, 3.9), t60=0.12) * 0.5,
                      ins.bruit_bref(rng, 0.1, 200, 2000, 0.03) * 0.3)
    dsp.poser(y, chute * 0.35, t + 0.1, circulaire=True)
    t = 5.2
    for d in (0.7, 0.55, 0.65):
        dsp.poser(y, _rabot_coup(rng, d) * 0.5, t, circulaire=True)
        t += d + 0.45
    for k in range(4):
        maillet = dsp.somme(ins.bois(rng, rng.uniform(320, 360), 0.25, 1.0, rapports=(1.0, 2.2, 3.7), t60=0.06) * 0.6,
                            ins.metal(rng, 2400, 0.12, t60=0.03, rapports=(1.0, 1.8), amps=(1.0, 0.3)) * 0.15)
        dsp.poser(y, maillet * 0.4, 8.7 + 0.42 * k, circulaire=True)
    planche = dsp.somme(ins.bois(rng, 180, 0.4, 0.8, rapports=(1.0, 2.1, 3.5), t60=0.14) * 0.5,
                        ins.bois(rng, 260, 0.3, 0.6, t60=0.08) * 0.3)
    dsp.poser(y, planche * 0.3, 10.9, circulaire=True)
    y = _boucle_reverbe(y, 0.6, 0.15, 125, predelai=0.01)
    return dsp.filtre_circulaire(y, dsp.gain_bande(0, 10000))


# --- Les cadeaux -----------------------------------------------------------------------------

def _cadeau_joie(v: int, rng: np.random.Generator) -> np.ndarray:
    """Le cadeau plaît (il l'adore ou il l'aime): la lanterne tinte et trois clochettes montent
    (sol, si, ré, puis sol à l'octave pour « il adore »), comme un sourire. Variante 1: « il
    adore » (quatre notes), variante 2: « il aime » (trois notes)."""
    y = dsp.toile(2.0, stereo=True)
    notes = ("G5", "B5", "D6", "G6") if v % 2 == 0 else ("G5", "B5", "D6")
    for k, nom in enumerate(notes):
        dsp.poser(y, ins.clochette(dsp.freq(nom), 1.5, rng, brillance=0.7, t60=1.0) * (0.55 + 0.1 * k),
                  0.09 * k + rng.uniform(-0.004, 0.004), pan=-0.3 + 0.2 * k)
    dsp.poser(y, _verre(rng, dsp.freq("D6"), 1.2) * 0.25, 0.0, pan=0.0)
    return dsp.pb(y, 10000)


def _cadeau_poli(v: int, rng: np.random.Generator) -> np.ndarray:
    """Le cadeau ne fait ni chaud ni froid (ou il ne l'aime pas et le rend gentiment): deux
    notes de verre douces qui descendent d'une tierce (ré, si), « merci, c'est gentil ».
    Plus court, plus bas et plus terne que `gift-happy`; jamais un son d'échec."""
    y = dsp.toile(1.5, stereo=True)
    dsp.poser(y, _verre(rng, dsp.freq("D6"), 1.0, t60=0.6) * 0.6, 0.0, pan=0.05)
    dsp.poser(y, _verre(rng, dsp.freq("B5"), 1.1, t60=0.7) * 0.5, 0.17, pan=-0.05)
    return dsp.pb(y, 6000)


# --- Le sifflet aux passages à niveau --------------------------------------------------------

def _sifflet_passage(v: int, rng: np.random.Generator) -> np.ndarray:
    """Le mécanicien siffle avant un passage à niveau sans barrière (l'Église, la ferme): deux
    coups brefs du même sifflet à trois tuyaux que l'arrivée, plus courts (0,32 et 0,5 s), pour
    qu'on sache sans regarder que ce n'est pas l'annonce de l'arrivée."""
    y = dsp.toile(1.6)
    for t0, d in ((0.0, 0.32), (0.5, 0.5)):
        for k, f in enumerate(train.TUYAUX):
            dsp.poser(y, train._tuyau(rng, f, d, (1.0, 0.85, 0.7)[k]), t0 + 0.006 * k)
        m = dsp.n_ech(d)
        vapeur = dsp.pbande(rng.standard_normal(m), 2500, 9000) * dsp.env_points(m, [(0, 0), (0.03, 1.0), (d, 0.4)])
        dsp.poser(y, vapeur * 0.08, t0)
    return y


# --- Déclarations ----------------------------------------------------------------------------

def sons() -> list[Son]:
    return [
        Son("mass-peal", "Dimanche 10 h 15: la sonnerie de la messe, les trois cloches à pleine volée (22 s)", E,
            "effects", _messe, 1, -16.0, 1, 0.0, 0.0, "vallee", voix_max=1, queue_reverbe=(2.0, 0.2),
            duree_max=26.0, duck_db=-4.0,
            extra={"decodeWhen": "le dimanche, de 10 h à 10 h 20 de jeu (plan des cloches de reglages.ts)"},
            note="placé au clocher (x 87, y -12), entendu partout (vallee: jamais sous -14 dB); la sortie de la "
                 "messe (11 h 30) reprend bell-peal"),
        Son("mill-race", "L'eau vive du bief du moulin (boucle)", A, "ambience", _bief, 1, -31.0, 4, 0.0, 0.0,
            "moyen", boucle=True, passe_haut=80, voix_max=3,
            extra={"decodeWhen": "l'écouteur est à moins de 45 m du bief (zone mill_race)"},
            note="placée en trois points du bief (zone mill_race), toute la journée; la roue s'y ajoute quand "
                 "le moulin tourne"),
        Son("washhouse-water", "Le filet d'eau du lavoir dans le bassin (boucle)", A, "ambience", _lavoir, 1, -33.0, 4,
            0.0, 0.0, "pres", boucle=True, passe_haut=120, voix_max=1,
            extra={"decodeWhen": "l'écouteur est à moins de 28 m du lavoir (101,5 ; 34,5)"},
            note="placée au lavoir, jour et nuit; le battoir (washboard-beat) quand quelqu'un lave"),
        Son("cafe-terrace", "La terrasse du café: rumeur sans mots, rire, tasses, verre, chaise (boucle)", A,
            "ambience", _terrasse, 1, -33.0, 4, 0.0, 0.0, "moyen", boucle=True, passe_haut=120, voix_max=1,
            extra={"decodeWhen": "l'écouteur est à moins de 45 m de la terrasse du café (88,5 ; 21,5)"},
            note="placée sur la terrasse quand au moins un habitant est au café (terrasse ou comptoir), hors "
                 "des heures de fermeture; aucune voix articulée"),
        Son("plane-stroke", "Une passe de rabot à la menuiserie", MET, "effects", _rabot, 3, -25.0, 3, 0.05, 1.0,
            "moyen", intervalle_min_ms=250, voix_max=2,
            extra={"decodeWhen": "l'écouteur est à moins de 45 m de la menuiserie (cour 115 ; 20)"},
            note="événement joinery_plane (lot vie du village), un par passe"),
        Son("handsaw-stroke", "Un aller et retour de scie égoïne à la menuiserie", MET, "effects", _scie, 3, -25.0, 3,
            0.04, 1.0, "moyen", intervalle_min_ms=250, voix_max=2,
            extra={"decodeWhen": "l'écouteur est à moins de 45 m de la menuiserie (cour 115 ; 20)"},
            note="événement joinery_saw (lot vie du village), un par aller et retour"),
        Son("joinery-loop", "La menuiserie au travail: scie, rabot, maillet, planche (boucle)", MET, "effects",
            _menuiserie, 1, -30.0, 4, 0.02, 0.0, "moyen", boucle=True, passe_haut=70, voix_max=1,
            extra={"decodeWhen": "l'écouteur est à moins de 45 m de la menuiserie (cour 115 ; 20)"},
            note="placée à l'établi quand un habitant travaille à la menuiserie (activité work à joinery_yard "
                 "ou joinery_inside)"),
        Son("gift-happy", "Cadeau: il l'adore (quatre clochettes) ou il l'aime (trois)", CAR, "ui", _cadeau_joie, 2,
            -21.0, 2, 0.0, 0.0, None, canaux=2, voix_max=1, intervalle_min_ms=800, duck_db=-4.0,
            extra={"decodeWhen": "au lancement de la partie (on offre partout)"},
            note="chez qui offre, 0,35 s après gift-give; variante 1 pour loves, 2 pour likes; sol majeur"),
        Son("gift-polite", "Cadeau: « merci, c'est gentil » (deux notes de verre douces)", CAR, "ui", _cadeau_poli, 1,
            -26.0, 3, 0.0, 0.0, None, canaux=2, voix_max=1, intervalle_min_ms=800,
            extra={"decodeWhen": "au lancement de la partie (on offre partout)"},
            note="chez qui offre, 0,35 s après gift-give, goût neutral ou dislikes; jamais un son d'échec"),
        Son("train-whistle-crossing", "Le train siffle deux coups brefs avant un passage à niveau sans barrière", TR,
            "effects", _sifflet_passage, 1, -16.0, 2, 0.0, 0.0, "vallee", voix_max=2, duck_db=-3.0,
            extra={"decodeWhen": "les jours de train (dossier train/)"},
            note="placé au passage à niveau (Église x 95, ferme x 127,5) quand la locomotive en approche à "
                 "l'arrivée; jamais à moins de 4 s d'un autre sifflet"),
    ]


SEQUENCE_MESSE = {
    "description": "Dimanche: la sonnerie de la messe à 10 h 15, la volée de sortie à 11 h 30 (horaires dans "
                   "reglages.ts, bells).",
    "steps": [{"at": 0.0, "play": "mass-peal"}],
}
