"""Sons du tour 10 (`docs/jeux/jeu-1/tour-10-conception.md`, sections 1 à 6, liste de la section 10;
ADR 0016 pour l'ambiance par bâtiment): la rue Haute, les intérieurs, les besoins doux, la maison
qui grandit, le rangement et les rideaux.

Dossiers (aucun n'est décodé au lancement: le plafond de 30 Mo des sons permanents de
`memoire.test.ts` est presque plein; chaque son porte `decodeWhen` pour le dev audio):
- `rue-haute/`: fournil, salon de Solange, portes fermées, chocolat d'Odette, école, passerelle,
  motifs d'Achille et de Solange;
- `besoins/`: petit creux, repas à deux, sieste, retrouvailles, coupe remarquée (petits sons qui
  peuvent tomber partout: à rendre permanents si le plafond le permet, voir son.md);
- `maison/`: pièces bâties, rangement, râtelier, rideaux;
- `ambiance/`: le ru de la Côte et les deux ambiances de pièce (boutique, salon).

Même famille que le reste du jeu: bois, laiton, papier, porcelaine, eau, et pour ce qui chante,
la harpe, le célesta, la flûte, la clarinette et le basson. Tout ce qui est accordé reste dans sol
majeur, en général dans sa pentatonique (sol, la, si, ré, mi): juste sur toutes les musiques du jeu.
Aucune voix (cahier, 6.12): le bâillement est une petite flûte qui glisse, la récréation se fait
sans cris d'enfants (cloche, balle, corde à sauter, galopades).
"""

from __future__ import annotations

from pathlib import Path

import numpy as np

import ambiances
import dsp
import instruments as ins
from catalogue import Son
from dsp import SR
from partition import Morceau, Note, Piste, frottements, grille, mel, produire

ICI = Path(__file__).resolve().parent
MIDI = ICI / "midi"

BASSON, CLARINETTE, FLUTE, COR = 70, 71, 73, 60
PIZZ, HARPE, CELESTA, CORDES = 45, 46, 8, 48

R, B, M, A = "rue-haute", "besoins", "maison", "ambiance"


# --- Contrôle des accords tenus ------------------------------------------------------------

def _paires_dures(m: Morceau, duree_min: float = 0.3) -> list[str]:
    """Plus strict que partition.frottements(): toute paire de notes (même piste comprise) qui
    sonne ensemble au moins duree_min temps et forme une seconde mineure, un triton ou une
    septième majeure est signalée, qu'elle soit dans l'accord ou non."""
    notes = [n for p in m.pistes if not p.percussions for n in p.notes]
    durs = []
    for i, a in enumerate(notes):
        for b in notes[i + 1:]:
            if min(a.t + a.d, b.t + b.d) - max(a.t, b.t) >= duree_min and abs(a.p - b.p) % 12 in (1, 6, 11):
                durs.append(f"{a.p}/{b.p} à {max(a.t, b.t):.2f} temps")
    return durs


def _rendre(m: Morceau, strict: bool = True) -> np.ndarray:
    erreurs = (_paires_dures(m) if strict else []) + (frottements(m) if m.accords else [])
    if erreurs:
        raise SystemExit(f"{m.id}: intervalles durs: " + "; ".join(erreurs))
    y, _ = produire(m, MIDI)
    return y


def _court(id_: str, tempo: float, pistes: list[Piste], signature=(4, 4), queue: float = 2.0, rt60: float = 1.2,
           accords: list | None = None) -> Morceau:
    temps = float(signature[0]) * 4.0 / signature[1]
    fin = max(n.t + n.d for p in pistes for n in p.notes)
    return Morceau(id=id_, titre=id_, tempo=tempo, signature=signature, mesures=int(np.ceil(fin / temps)),
                   temps_par_mesure=temps, pistes=pistes, boucle=False, queue_s=queue, rt60=rt60, sonie_cible=-20.0,
                   accords=accords or [])


def _accord(t: float, d: float, notes: list[str], v: int) -> list[Note]:
    return [Note(t, d, dsp.note_midi(n), v) for n in notes]


# --- Motifs d'Achille et de Solange ----------------------------------------------------------

def motif_achille(v: int, rng: np.random.Generator) -> np.ndarray:
    """Achille Pradel, boulanger lent et ensommeillé: le basson fait deux pas de valse qui
    descendent comme un bâillement (ré, si, sol; do, la, fa dièse), puis se pose sur sol et y
    reste; les pizzicati font le « pom-pom » des deuxième et troisième temps."""
    basson = mel("D3:1.5 B2:.5 G2:1 C3:1 A2:.5 F#2:.5 G2:1.5", 0.0, 72, legato=0.92)
    pizz = (_accord(1.0, 0.4, ["G3", "B3", "D4"], 52) + _accord(2.0, 0.4, ["G3", "B3", "D4"], 48)
            + _accord(4.0, 0.4, ["F#3", "A3", "C4"], 50) + _accord(5.0, 0.4, ["G3", "B3", "D4"], 46))
    basses = [Note(0.0, 0.5, dsp.note_midi("G2"), 60), Note(3.0, 0.5, dsp.note_midi("D2"), 58)]
    m = _court("motif-achille", 100.0, [
        Piste("basson", BASSON, basson, 0.0, pan=58, reverbe=0.22, souffle=True),
        Piste("pizz", PIZZ, pizz, -8.0, pan=70, reverbe=0.15),
        Piste("pizz_basse", PIZZ, basses, -9.0, pan=64, reverbe=0.15),
    ], signature=(3, 4), queue=2.0, accords=grille("G | D7 D7 G", 0.0, 3.0))
    return _rendre(m, strict=False)


def motif_solange(v: int, rng: np.random.Generator) -> np.ndarray:
    """Solange Mérigot, coiffeuse vive, pointe de mélancolie: la clarinette file et tourne (sol,
    do, ré), les pizzicati aigus vont deux par deux comme des coups de ciseaux, et l'air se pose
    sur si, sur un accord de mi mineur: le sourire avec un peu de nostalgie."""
    clar = mel("D5:.25 G5:.25 B5:.25 A5:.25 G5:.25 E5:.25 D5:.5 C5:.25 E5:.25 G5:.25 F#5:.25 A5:.5 F#5:.5 B4:1.5",
               0.0, 82, legato=0.85)
    ciseaux = []
    for t0, nom in ((0.5, "D6"), (1.5, "B5"), (2.5, "E6"), (3.5, "D6")):
        ciseaux += [Note(t0, 0.1, dsp.note_midi(nom), 62), Note(t0 + 0.125, 0.1, dsp.note_midi(nom), 54)]
    basses = [Note(0.0, 0.5, dsp.note_midi("G2"), 64), Note(2.0, 0.5, dsp.note_midi("C3"), 60),
              Note(3.0, 0.5, dsp.note_midi("D3"), 60), Note(4.0, 0.9, dsp.note_midi("E2"), 58)]
    m = _court("motif-solange", 132.0, [
        Piste("clarinette", CLARINETTE, clar, 0.0, pan=56, reverbe=0.22),
        Piste("ciseaux", PIZZ, ciseaux, -9.0, pan=80, reverbe=0.12),
        Piste("pizz_basse", PIZZ, basses, -8.0, pan=62, reverbe=0.15),
    ], queue=1.8, accords=grille("G G | C D | Em Em", 0.0, 2.0))
    return _rendre(m, strict=False)


# --- Rue Haute: portes, fournil, salon -------------------------------------------------------

def _porte_fermee(v: int, rng: np.random.Generator) -> np.ndarray:
    """Porte fermée (0,3 s): la poignée s'abaisse, le pêne bute deux fois dans la gâche et le
    battant cogne à peine dans son cadre. Rien ne grince: la porte ne s'ouvre pas."""
    y = dsp.toile(0.42)
    poignee = ins.metal(rng, rng.uniform(2300, 2600), 0.08, t60=0.03, rapports=(1.0, 1.7, 2.9), amps=(1.0, 0.5, 0.2))
    dsp.poser(y, poignee * 0.3, 0.0)
    for k, t0 in enumerate(((0.07, 0.17), (0.06, 0.14))[v % 2]):
        pene = ins.metal(rng, rng.uniform(1700, 2000), 0.12, t60=0.05, rapports=(1.0, 1.45, 2.3), amps=(1.0, 0.6, 0.3))
        cadre = ins.bois(rng, rng.uniform(240, 290), 0.16, 0.8, rapports=(1.0, 2.2, 3.9), t60=0.07,
                         amps=(0.7, 0.55, 0.3))
        g = (1.0, 0.65)[k]
        dsp.poser(y, dsp.somme(pene * 0.45, cadre * 0.6) * g, t0)
    return dsp.pb(y, 8000)


def _clochette_guichet(v: int, rng: np.random.Generator) -> np.ndarray:
    """La clochette du guichet du fournil: une clochette de laiton à main, secouée trois fois
    (ré 6, le battant frappe de moins en moins fort), qui sonne ensuite seule."""
    y = dsp.toile(1.6)
    f = dsp.freq("D6")
    for k, (t0, g) in enumerate(((0.0, 1.0), (0.11, 0.7), (0.21, 0.45))):
        dsp.poser(y, ins.clochette(f, 1.5 - t0, rng, brillance=0.9, t60=1.1) * g, t0)
    return dsp.pb(y, 9000)


def _croute(v: int, rng: np.random.Generator) -> np.ndarray:
    """Le pain chaud: deux petits coups sous la miche (elle sonne creux: elle est bien cuite),
    puis la croûte qui chante en refroidissant, un crépitement fin qui s'espace."""
    duree = 1.6
    y = dsp.toile(duree)
    for k, t0 in enumerate(((0.0, 0.14), (0.0, 0.12))[v % 2]):
        creux = ins.bois(rng, rng.uniform(300, 360), 0.25, 0.4, rapports=(1.0, 1.9, 3.1), t60=0.09,
                         amps=(0.6, 0.6, 0.35))
        dsp.poser(y, dsp.resonateur(creux, 640, 4) * 0.5 + creux * 0.3, t0)
    chant = dsp.grains(duree - 0.25, (380, 320)[v % 2], lambda r: dsp.clic(r, 2500, 9000, 0.0025, 0.0005) *
                       r.uniform(0.08, 0.5), rng, enveloppe=lambda u: np.exp(-u / 0.45))
    dsp.poser(y, chant * 0.6, 0.25)
    return dsp.pb(y, 10000)


def _clochette_salon(v: int, rng: np.random.Generator) -> np.ndarray:
    """La clochette de porte du salon de Solange: deux petites cloches (sol 6 et si 6) au bout
    d'un ressort courbe; la porte les met en branle, elles rebondissent de plus en plus vite et
    de moins en moins fort. Plus aiguë et plus « en grappe » que celle du guichet."""
    y = dsp.toile(1.5)
    t = 0.0
    ecart = 0.075
    for k in range(9):
        g = 0.85 ** k
        nom = ("G6", "B6")[k % 2]
        dsp.poser(y, ins.clochette(dsp.freq(nom), 1.4 - t, rng, brillance=0.8, t60=0.9) * g * 0.6, t)
        t += ecart * rng.uniform(0.85, 1.15)
        ecart *= 0.86
    ressort = ins.crissement(rng, 0.35, lambda u: 260 - 300 * u, [(3100, 18), (4700, 20)], 0.1)
    dsp.poser(y, ressort * dsp.env_ar(len(ressort), 0.01, 0.25) * 0.04, 0.0)
    return dsp.pb(y, 10000)


def _fauteuil(v: int, rng: np.random.Generator) -> np.ndarray:
    """On s'assoit au fauteuil de coiffure: le cuir du coussin couine sous le poids, le pied
    de fonte pivote d'un cran (un « clonc » métallique), le bois des accoudoirs craque."""
    y = dsp.toile(0.9)
    cuir = ins.crissement(rng, 0.22, (lambda u: 180 + 260 * u, lambda u: 320 - 150 * u)[v % 2],
                          [(rng.uniform(900, 1100), 7), (rng.uniform(1900, 2300), 9)], 0.25)
    dsp.poser(y, cuir * dsp.env_ar(len(cuir), 0.03, 0.1) * 0.35, 0.0)
    dsp.poser(y, ins.bruit_bref(rng, 0.12, 120, 600, 0.03, 0.01) * 0.3, 0.04)
    pied = ins.metal(rng, rng.uniform(820, 900), 0.3, t60=0.12, rapports=(1.0, 2.76, 5.4), amps=(1.0, 0.45, 0.15))
    dsp.poser(y, pied * 0.22, (0.26, 0.3)[v % 2])
    craque = ins.crissement(rng, 0.18, lambda u: 90 + 80 * u, [(rng.uniform(520, 620), 9), (rng.uniform(1200, 1400), 11)],
                            0.15)
    dsp.poser(y, craque * dsp.env_ar(len(craque), 0.03, 0.08) * 0.3, 0.42)
    return dsp.pb(y, 7000)


def _ciseaux(v: int, rng: np.random.Generator) -> np.ndarray:
    """Coup de ciseaux: les lames glissent l'une sur l'autre (un frottement aigu très bref) et
    se ferment sur un petit « tchik » d'acier; quelques cheveux coupés crissent. La deuxième
    variante coupe deux fois (« cric-crac »)."""
    coups = ((0.0,), (0.0, 0.16), (0.0,))[v % 3]
    y = dsp.toile(0.5)
    for t0 in coups:
        n = dsp.n_ech(0.05)
        glisse = dsp.pbande(rng.standard_normal(n), 3500, 9000) * dsp.env_points(n, [(0, 0.2), (0.04, 1.0), (0.05, 0)])
        dsp.poser(y, glisse * 0.3, t0)
        lame = ins.metal(rng, rng.uniform(3000, 3600), 0.12, t60=0.05, rapports=(1.0, 1.34, 2.1, 2.9),
                         amps=(1.0, 0.6, 0.35, 0.2))
        dsp.poser(y, lame * 0.5, t0 + 0.045)
        cheveux = dsp.grains(0.04, 900, lambda r: dsp.clic(r, 4000, 11000, 0.002, 0.0004) * r.uniform(0.1, 0.4), rng)
        dsp.poser(y, cheveux * 0.4, t0 + 0.01)
    return dsp.pb(y, 12000)


def _revelation(v: int, rng: np.random.Generator) -> np.ndarray:
    """La coupe est faite: la harpe monte en arpège de sol (sol, si, ré, sol, si, ré), le célesta
    pose sol, si, ré en haut: le miroir montre la nouvelle tête. Aucune paire dure."""
    harpe = [Note(0.08 * k, 2.4 - 0.08 * k, dsp.note_midi(p), 56 + 2 * k) for k, p in
             enumerate(("G3", "B3", "D4", "G4", "B4", "D5"))]
    celesta = _accord(0.55, 1.8, ["G5", "B5", "D6"], 66)
    m = _court("hair-reveal", 60.0, [
        Piste("harpe", HARPE, harpe, 0.0, pan=58, reverbe=0.35),
        Piste("celesta", CELESTA, celesta, -3.0, pan=72, reverbe=0.4),
    ], queue=2.0, rt60=1.6)
    return _rendre(m)


def _remarquee(v: int, rng: np.random.Generator) -> np.ndarray:
    """La coupe est remarquée: deux notes de glockenspiel qui montent (ré 6, sol 6), la seconde
    plus douce, comme un sourire en coin."""
    y = dsp.toile(1.6, stereo=True)
    dsp.poser(y, ins.glock(dsp.freq("D6"), 1.4, rng, t60=1.0) * 0.8, 0.0, pan=-0.15)
    dsp.poser(y, ins.glock(dsp.freq("G6"), 1.3, rng, t60=1.0) * 0.6, 0.14, pan=0.2)
    return dsp.pb(y, 9000)


def _chocolat(v: int, rng: np.random.Generator) -> np.ndarray:
    """Boire un chocolat à la petite table d'Odette: la tasse quitte la soucoupe (porcelaine qui
    tinte), une gorgée chaude (un souffle et deux bulles), la tasse revient sur la soucoupe."""
    y = dsp.toile(1.3)

    def porcelaine(f: float, g: float) -> np.ndarray:
        return ins.metal(rng, f, 0.3, t60=0.12, rapports=(1.0, 2.13, 3.6, 5.1), amps=(1.0, 0.45, 0.25, 0.1)) * g

    dsp.poser(y, porcelaine(rng.uniform(2100, 2300), 0.3), 0.0)
    n = dsp.n_ech(0.3)
    gorgee = dsp.pbande(rng.standard_normal(n), 900, 4200) * dsp.env_points(n, [(0, 0), (0.08, 1.0), (0.22, 0.6), (0.3, 0)])
    dsp.poser(y, gorgee * 0.12, 0.35)
    for t0 in (0.42, 0.5):
        dsp.poser(y, dsp.bulle(rng, rng.uniform(500, 800), 0.01) * 0.18, t0)
    dsp.poser(y, porcelaine(rng.uniform(1900, 2050), 0.42), 0.95)
    dsp.poser(y, ins.bois(rng, 380, 0.1, 0.3, t60=0.04) * 0.15, 0.95)
    return dsp.pb(y, 9000)


def _recreation(v: int, rng: np.random.Generator) -> np.ndarray:
    """La récréation, derrière le mur de la cour (16 s): l'instituteur agite la cloche à main,
    puis on entend les galopades sur le gravier, une balle qui rebondit contre le mur, la corde à
    sauter qui claque en mesure, une bille qui roule, et la cloche qui rappelle en classe. Aucun
    cri (aucune voix dans le jeu): la cour se devine. Tout passe au loin et par-dessus le mur."""
    duree = 16.0
    y = dsp.toile(duree)

    def cloche(t0: float) -> None:
        for k in range(7):
            dsp.poser(y, ins.clochette(dsp.freq("A5"), 1.2, rng, brillance=0.7, t60=0.9) * (0.05 + 0.01 * (k % 2)),
                      t0 + 0.13 * k + rng.uniform(-0.01, 0.01))

    cloche(0.0)
    cloche(14.2)
    # Galopades: des pas rapides sur le gravier, par vagues.
    for t0, nb in ((1.4, 22), (4.8, 16), (9.0, 26), (12.2, 12)):
        t = t0
        for _ in range(nb):
            pas = dsp.grains(0.05, 900, lambda r: dsp.clic(r, 1200, 6000, 0.003, 0.0007) * r.uniform(0.1, 0.5), rng)
            dsp.poser(y, pas * rng.uniform(0.15, 0.3) + ins.bruit_bref(rng, 0.05, 80, 400, 0.01) * 0.1, t)
            t += rng.uniform(0.11, 0.17)
    # La balle contre le mur, puis au sol, trois fois.
    for t0 in (2.6, 6.9, 11.0):
        for k, (dt, g) in enumerate(((0.0, 1.0), (0.42, 0.6), (0.72, 0.35), (0.92, 0.2))):
            balle = ins.bois(rng, rng.uniform(260, 300), 0.2, 0.3, rapports=(1.0, 1.8, 3.3), t60=0.05,
                             amps=(0.8, 0.5, 0.25))
            dsp.poser(y, dsp.resonateur(balle, 700, 3) * 0.6 * g + balle * 0.3 * g, t0 + dt)
    # La corde à sauter: deux fois par seconde, le sifflement de la corde puis son claquement.
    for k in range(10):
        t = 5.2 + 0.5 * k
        n = dsp.n_ech(0.12)
        siffle = dsp.pbande(rng.standard_normal(n), 900, 3500) * np.sin(np.pi * np.arange(n) / n) ** 2
        dsp.poser(y, siffle * 0.08, t)
        dsp.poser(y, ins.bruit_bref(rng, 0.03, 600, 4000, 0.004) * 0.35, t + 0.12)
    # Une bille qui roule et en heurte une autre.
    m = dsp.n_ech(0.8)
    roule = dsp.pbande(rng.standard_normal(m), 1500, 5000) * dsp.env_ar(m, 0.1, 0.3) * 0.05
    dsp.poser(y, roule, 8.2)
    dsp.poser(y, ins.metal(rng, 3800, 0.1, t60=0.03, rapports=(1.0, 2.3), amps=(1.0, 0.3)) * 0.12, 9.0)
    # Au loin et par-dessus le mur: aigus coupés, cour murée qui résonne un peu.
    y = dsp.pb(y, 3200)
    ir = dsp.ir_salle(1.1, 0.025, 0.4, graine=61)
    return dsp.reverbe_mono(y, ir, 0.4, 1.0)


def _pas_passerelle(v: int, rng: np.random.Generator) -> np.ndarray:
    """Un pas sur la passerelle du ru: planches posées sur deux poutres, l'eau dessous. Plus creux
    et plus long que le quai (la planche vibre sur sa portée), une planche voisine qui claque à
    peine dans ses clous."""
    y = dsp.toile(0.36)
    talon_pointe = rng.uniform(0.05, 0.075)
    for k, (t, force) in enumerate(((0.0, 1.0), (talon_pointe, rng.uniform(0.45, 0.6)))):
        f1 = rng.uniform(200, 240)
        planche = ins.bois(rng, f1, 0.3, durete=0.6, rapports=(1.0, 2.6, 5.2, 8.4), t60=0.2, amps=(0.4, 0.65, 0.4, 0.18))
        dsp.poser(y, dsp.pb(planche, 4500) * force, t)
        if k == 0:
            dsp.poser(y, ins.bruit_bref(rng, 0.06, 60, 200, 0.015) * 0.15 * force, t)
    if v % 2 == 1:
        voisine = ins.bois(rng, rng.uniform(480, 560), 0.08, 0.8, rapports=(1.0, 2.3), t60=0.03, amps=(1.0, 0.4))
        dsp.poser(y, voisine * 0.25, talon_pointe + 0.03)
    return y


# --- Besoins ----------------------------------------------------------------------------------

def _gargouillis(v: int, rng: np.random.Generator) -> np.ndarray:
    """Petit creux: un gargouillis discret et un peu drôle. Un grondement qui monte (impulsions
    de 95 à 150 Hz passées dans deux résonances de 380 et 760 Hz, pour qu'il s'entende sur un
    haut-parleur de portable) puis trois ou quatre bulles qui remontent."""
    duree = 1.3
    n = dsp.n_ech(0.7)
    debut, fin = ((95, 150), (130, 100))[v % 2]
    g = ins.crissement(rng, 0.7, lambda u: debut + (fin - debut) * u / 0.7, [(380, 4), (760, 6), (1250, 8)], 0.35)
    g *= dsp.env_points(n, [(0, 0), (0.12, 0.8), (0.45, 1.0), (0.7, 0)])
    y = dsp.toile(duree)
    dsp.poser(y, g * 0.5, 0.0)
    t = 0.55
    for k in range((3, 4)[v % 2]):
        dsp.poser(y, dsp.bulle(rng, rng.uniform(380, 700), rng.uniform(0.012, 0.02), 1.4) * rng.uniform(0.25, 0.4), t)
        t += rng.uniform(0.09, 0.17)
    return dsp.pb(y, 3000)


def _cuilleres(v: int, rng: np.random.Generator) -> np.ndarray:
    """Manger ensemble: deux cuillères se touchent comme on trinque (deux tintements proches,
    deux hauteurs), puis chacune retourne dans son bol (deux petits coups de faïence)."""
    y = dsp.toile(0.9, stereo=True)
    for k, (t0, f, pan) in enumerate(((0.0, 3100, -0.25), (0.035, 3550, 0.25))):
        cuiller = ins.metal(rng, f * rng.uniform(0.98, 1.02), 0.6, t60=0.35, rapports=(1.0, 2.4, 3.9, 5.6),
                            amps=(1.0, 0.4, 0.2, 0.1))
        dsp.poser(y, cuiller * (0.55, 0.45)[k], t0, pan=pan)
    for t0, pan in ((0.38, -0.3), (0.47, 0.3)):
        bol = ins.metal(rng, rng.uniform(1500, 1700), 0.25, t60=0.08, rapports=(1.0, 2.2, 3.7), amps=(1.0, 0.4, 0.2))
        dsp.poser(y, bol * 0.25, t0, pan=pan)
    return dsp.pb(y, 10000)


def _baillement(v: int, rng: np.random.Generator) -> np.ndarray:
    """On s'allonge pour la sieste: une petite flûte de bois douce (presque un ocarina) glisse
    vers le haut, s'étire, et redescend en s'éteignant, comme un bâillement sans voix; l'oreiller
    froisse à la fin. Fondamentale de 300 à 520 Hz (audible sur un portable), aucun formant."""
    duree = 2.2
    n = dsp.n_ech(1.7)
    t = np.arange(n) / SR
    contour = np.interp(t, [0.0, 0.45, 0.85, 1.7], [330.0, 520.0, 505.0, 300.0])
    contour *= 1 + 0.006 * np.sin(2 * np.pi * 5.0 * t) * np.clip((t - 0.4) / 0.3, 0, 1)
    phase = 2 * np.pi * np.cumsum(contour) / SR
    ton = np.sin(phase) + 0.12 * np.sin(2 * phase) + 0.05 * np.sin(3 * phase)
    souffle = dsp.pbande(rng.standard_normal(n), 600, 3000) * 0.06
    env = dsp.env_points(n, [(0, 0), (0.12, 0.7), (0.5, 1.0), (0.9, 0.8), (1.7, 0)])
    y = dsp.toile(duree)
    dsp.poser(y, (ton * 0.5 + souffle) * env, 0.0)
    dsp.poser(y, ins.froissement(rng, 0.45, 600, 4000, 50, 0.08, 0.25) * 0.15, 1.6)
    return dsp.pb(y, 6000)


def _sieste_horloge(v: int, rng: np.random.Generator) -> np.ndarray:
    """La sieste à deux: l'horloge va quatre fois plus vite (boucle de 2 s): huit petits coups
    légers, alternés tic et tac, un frémissement de ressort qui file dessous. Les coups tombent
    à 0,125 s du raccord au plus près, jamais dessus."""
    duree = 2.0
    n = dsp.n_ech(duree)
    y = np.zeros(n)
    for k in range(8):
        t0 = 0.125 + 0.25 * k
        f = (2650, 2200)[k % 2]
        coup = dsp.somme(ins.metal(rng, f, 0.06, t60=0.02, rapports=(1.0, 1.52, 2.4), amps=(0.8, 0.5, 0.25)),
                         ins.bois(rng, 650, 0.08, 0.4, rapports=(1.0, 2.2), t60=0.04, amps=(0.5, 0.3)) * 0.3)
        dsp.poser(y, coup * (1.0, 0.8)[k % 2], t0, circulaire=True)
    ressort = dsp.filtre_circulaire(dsp.bruit_spectral(n, rng, -1.0), dsp.gain_bande(2000, 6000))
    y += ressort * 0.006 * (1 + 0.3 * ambiances.lfo_periodique(n, [(4, 1.0)], rng))
    return dsp.filtre_circulaire(y, dsp.gain_bande(0, 8000))


def _retrouvailles(v: int, rng: np.random.Generator) -> np.ndarray:
    """Retrouvailles: deux voix qui se rejoignent. La flûte descend (si, la, sol), la clarinette
    monte (ré, mi, sol), et elles finissent ensemble sur sol, sur un accord de harpe. Ce sont
    les deux voix de la veillée, celles des deux joueurs."""
    flute = mel("B5:.5 A5:.5 G5:1.5", 0.0, 76)
    clar = mel("D5:.5 E5:.5 G5:1.5", 0.0, 72)
    harpe = [Note(1.0 + 0.05 * k, 1.6, dsp.note_midi(p), 54) for k, p in enumerate(("G3", "D4", "G4", "B4"))]
    m = _court("reunion-chime", 120.0, [
        Piste("flute", FLUTE, flute, 0.0, pan=82, reverbe=0.25, souffle=True),
        Piste("clarinette", CLARINETTE, clar, -1.0, pan=46, reverbe=0.25, souffle=True),
        Piste("harpe", HARPE, harpe, -8.0, pan=64, reverbe=0.3),
    ], queue=1.8)
    return _rendre(m)


# --- La maison qui grandit, rangement, rideaux -----------------------------------------------

def _panne(v: int, rng: np.random.Generator) -> np.ndarray:
    """La panne faîtière se pose au faîte: une longue poutre de 5 m qui touche la ferme (gros
    coup de bois, partiels marqués pour qu'il s'entende sur un portable), glisse dans son
    encoche (frottement bois sur bois), puis se cale d'un second coup plus sec."""
    y = dsp.toile(1.3)
    gros = ins.bois(rng, rng.uniform(195, 215), 0.6, 1.0, rapports=(1.0, 2.3, 3.9, 6.1), t60=0.3,
                    amps=(0.25, 0.75, 0.55, 0.3))
    dsp.poser(y, gros * 0.7, 0.0)
    dsp.poser(y, ins.bruit_bref(rng, 0.2, 60, 250, 0.05) * 0.15, 0.0)
    frotte = ins.crissement(rng, 0.35, lambda u: 60 + 90 * u, [(480, 6), (950, 8), (1700, 10)], 0.3)
    dsp.poser(y, frotte * dsp.env_ar(len(frotte), 0.05, 0.15) * 0.3, 0.22)
    sec = ins.bois(rng, rng.uniform(230, 260), 0.4, 1.1, rapports=(1.0, 2.5, 4.4), t60=0.18, amps=(0.7, 0.6, 0.3))
    dsp.poser(y, sec * 0.6, 0.62)
    return dsp.pb(y, 7000)


def _piece_batie(v: int, rng: np.random.Generator) -> np.ndarray:
    """Une pièce est bâtie (notification du matin, chez les deux): dans la nuit, au loin, quatre
    coups de marteau de Basile et Firmin sur les tuiles et le linteau; puis le cor, les cordes et
    la harpe posent un grand accord de sol. Plus ample que chantier-built (maillet et marimba)."""
    y = dsp.toile(6.5, stereo=True)
    coups = dsp.toile(1.6)
    for k, t0 in enumerate((0.0, 0.32, 0.66, 1.05)):
        coup = dsp.somme(ins.bois(rng, rng.uniform(240, 280), 0.3, 1.0, t60=0.1),
                         ins.metal(rng, rng.uniform(2300, 2600), 0.15, t60=0.05) * 0.3)
        dsp.poser(coups, coup * (0.9 if k % 2 == 0 else 0.7), t0)
    coups = dsp.reverbe(dsp.pb(coups, 2800), dsp.ir_salle(1.6, 0.04, 0.35, graine=71), 0.5, 0.7)
    dsp.poser(y, coups * 0.5, 0.0)
    harpe = [Note(0.06 * k, 2.8, dsp.note_midi(p), 60) for k, p in enumerate(("G2", "D3", "G3", "B3", "D4", "G4"))]
    cor = _accord(0.0, 2.6, ["B3", "D4"], 66)
    cordes = _accord(0.05, 2.8, ["G3", "D4", "G4", "B4"], 52)
    m = _court("room-built", 60.0, [
        Piste("harpe", HARPE, harpe, -2.0, pan=58, reverbe=0.35),
        Piste("cor", COR, cor, -1.0, pan=66, reverbe=0.35, souffle=True),
        Piste("cordes", CORDES, cordes, 0.0, pan=72, reverbe=0.4, souffle=True),
    ], queue=2.2, rt60=1.8)
    accord = _rendre(m)
    rapport = 10 ** ((dsp.sonie_momentanee_max(accord) - dsp.sonie_momentanee_max(coups)) / 20)
    # L'accord au niveau des coups, les coups 6 dB dessous: ils sont loin, l'accord est la nouvelle.
    dsp.poser(y, accord / rapport, 1.5)
    return dsp.pb(y, 9000)


def _coffre_plein(v: int, rng: np.random.Generator) -> np.ndarray:
    """Rangement plein: on soulève le couvercle, il bute aussitôt sur ce qui dépasse (un coup
    sourd et mat, étouffé par les sacs), un bocal tinte dedans, et le couvercle retombe."""
    y = dsp.toile(0.65)
    grince = ins.crissement(rng, 0.1, lambda u: 160 + 200 * u, [(720, 11), (1500, 13)], 0.1)
    dsp.poser(y, grince * dsp.env_ar(len(grince), 0.02, 0.05) * 0.25, 0.0)
    bute = ins.bois(rng, rng.uniform(300, 340), 0.25, 0.4, rapports=(1.0, 1.9, 3.2), t60=0.05, amps=(0.7, 0.6, 0.3))
    dsp.poser(y, bute * 0.6, 0.09)
    dsp.poser(y, ins.bruit_bref(rng, 0.08, 150, 900, 0.02, 0.004) * 0.3, 0.09)
    bocal = ins.metal(rng, rng.uniform(2000, 2200), 0.2, t60=0.08, rapports=(1.0, 2.4, 3.6), amps=(1.0, 0.4, 0.2))
    dsp.poser(y, bocal * 0.15, 0.12)
    retombe = ins.bois(rng, rng.uniform(250, 280), 0.3, 0.9, rapports=(1.0, 2.5, 5.1), t60=0.08, amps=(0.8, 0.5, 0.2))
    dsp.poser(y, retombe * 0.45, 0.3)
    return dsp.pb(y, 7000)


def _ratelier(v: int, rng: np.random.Generator) -> np.ndarray:
    """Accrocher un outil au râtelier: le fer de l'outil glisse sur le crochet (frottement et
    petit tintement de fer), le manche cogne la planche du râtelier, se balance et cogne encore
    une fois, plus doucement."""
    y = dsp.toile(0.8)
    n = dsp.n_ech(0.08)
    frotte = dsp.pbande(rng.standard_normal(n), 2000, 7000) * dsp.env_ar(n, 0.01, 0.05)
    dsp.poser(y, frotte * 0.12, 0.0)
    fer = ins.metal(rng, rng.uniform(1500, 1800), 0.4, t60=0.18, rapports=(1.0, 2.7, 4.9), amps=(1.0, 0.45, 0.2))
    dsp.poser(y, fer * 0.35, 0.07)
    for t0, g in (((0.16, 0.5), (0.42, 0.25)), ((0.14, 0.5), (0.36, 0.3)))[v % 2]:
        manche = ins.bois(rng, rng.uniform(320, 380), 0.2, 0.8, rapports=(1.0, 2.4, 4.3), t60=0.06, amps=(0.8, 0.5, 0.3))
        dsp.poser(y, manche * g, t0)
    return dsp.pb(y, 8000)


def _anneaux(rng: np.random.Generator, nb: int, t0: float, ecart: float, y: np.ndarray, g: float = 1.0) -> float:
    """Anneaux de bois qui glissent sur une tringle de bois: petits chocs secs serrés."""
    t = t0
    for k in range(nb):
        a = ins.bois(rng, rng.uniform(900, 1200), 0.06, 1.0, rapports=(1.0, 2.1, 3.4), t60=0.02, amps=(0.8, 0.5, 0.3))
        dsp.poser(y, a * g * rng.uniform(0.6, 1.0), t)
        t += ecart * rng.uniform(0.75, 1.25)
    return t


def _rideaux_poses(v: int, rng: np.random.Generator) -> np.ndarray:
    """Accrocher des rideaux: les anneaux s'enfilent un à un sur la tringle (huit petits chocs de
    bois), la tringle se pose dans ses supports, et l'étoffe tombe d'un coup."""
    y = dsp.toile(1.3)
    t = _anneaux(rng, 8, 0.0, 0.07, y, 0.5)
    pose = ins.bois(rng, rng.uniform(420, 480), 0.2, 0.8, rapports=(1.0, 2.3, 4.0), t60=0.05, amps=(0.8, 0.5, 0.3))
    dsp.poser(y, pose * 0.5, t + 0.08)
    dsp.poser(y, ins.froissement(rng, 0.45, 500, 5000, 40, 0.03, 0.3) * 0.4, t + 0.15)
    return dsp.pb(y, 9000)


def _rideaux_tires(v: int, rng: np.random.Generator) -> np.ndarray:
    """Ouvrir ou fermer les rideaux: les anneaux filent sur la tringle en un « rrrt » et
    l'étoffe glisse. Pour ouvrir (première variante), les anneaux se tassent en bout de course;
    pour fermer, ils s'écartent et finissent sur un seul choc."""
    y = dsp.toile(0.8)
    glisse = ins.froissement(rng, 0.45, 700, 6000, 70, 0.04, 0.2) * 0.45
    dsp.poser(y, glisse, 0.0)
    if v % 2 == 0:
        t = _anneaux(rng, 7, 0.03, 0.05, y, 0.35)
        _anneaux(rng, 3, t, 0.02, y, 0.45)
    else:
        t = _anneaux(rng, 6, 0.03, 0.065, y, 0.35)
        dsp.poser(y, ins.bois(rng, 1000, 0.06, 1.0, t60=0.025) * 0.4, t + 0.02)
    return dsp.pb(y, 9000)


# --- Ambiances -------------------------------------------------------------------------------

def _ru(v: int, rng: np.random.Generator) -> np.ndarray:
    """Le ru de la Côte (boucle de 20 s): eau vive peu profonde, 1 à 1,5 m de large. Plus clair
    et plus babillard que l'Aubrune: peu de lit grave, beaucoup de petites bulles qui roulent sur
    les galets, quelques glouglous plus ronds aux chutes de pierres."""
    duree = 20.0
    n = dsp.n_ech(duree)
    lit = dsp.filtre_circulaire(dsp.bruit_spectral(n, rng, -2.0), dsp.gain_bande(250, 6000)) * 0.18
    babil = dsp.filtre_circulaire(dsp.bruit_spectral(n, rng, -0.5), dsp.gain_bande(900, 4500))
    mod = np.abs(dsp.filtre_circulaire(dsp.bruit_spectral(n, rng, 0.0), dsp.gain_bande(2, 30)))
    babil *= (mod / (mod.max() + 1e-12)) ** 1.4 * 1.5
    y = lit + babil * 0.45
    y += dsp.grains(duree, 320, lambda r: dsp.bulle(r, float(np.exp(r.uniform(np.log(700), np.log(3800)))),
                                                    r.uniform(0.003, 0.01)) * r.uniform(0.05, 0.3), rng, circulaire=True)
    y += dsp.grains(duree, 9, lambda r: dsp.bulle(r, r.uniform(300, 600), r.uniform(0.015, 0.03), 1.1) *
                    r.uniform(0.2, 0.4), rng, circulaire=True)
    y *= 1 + 0.1 * ambiances.lfo_periodique(n, [(2, 1.0), (5, 0.4)], rng)
    return dsp.filtre_circulaire(y, dsp.gain_bande(0, 9000))


def _piece(y: np.ndarray, rt60: float, humide: float, graine: int) -> np.ndarray:
    """Petite pièce: réverbération appliquée à la boucle, queue repliée sur le début."""
    n = len(y)
    ir = dsp.ir_salle(rt60, 0.006, 0.4, graine=graine)
    out = dsp.reverbe_mono(y, ir, humide, 1.0)
    boucle = out[:n].copy()
    boucle[: len(out) - n] += out[n:]
    return boucle


def _boutique(v: int, rng: np.random.Generator) -> np.ndarray:
    """La boutique d'Odette, de dedans (boucle de 30 s): l'air calme d'une pièce, la pendule du
    comptoir qui bat la seconde (« toc » de bois, loin du raccord), le plancher qui craque, un
    couvercle de bocal, deux poids de laiton posés sur la balance, un sac de papier. Ni voix ni
    feu: le poêle n'est pas toujours allumé (il chauffe le chocolat en automne et en hiver)."""
    duree = 30.0
    n = dsp.n_ech(duree)
    y = dsp.filtre_circulaire(dsp.bruit_spectral(n, rng, -3.5), dsp.gain_bande(120, 1800)) * 0.016
    for k in range(30):
        f = (1450, 1250)[k % 2]
        toc = dsp.somme(ins.bois(rng, f, 0.08, 0.8, rapports=(1.0, 1.9, 3.1), t60=0.03, amps=(0.6, 0.4, 0.2)),
                        ins.bois(rng, 420, 0.12, 0.3, rapports=(1.0, 2.3), t60=0.06, amps=(0.5, 0.3)) * 0.5)
        dsp.poser(y, toc * 0.05, 0.5 + k, circulaire=True)
    for t0 in (4.3, 17.8, 25.6):
        g = ins.crissement(rng, 0.35, lambda u: 80 + 140 * u, [(rng.uniform(420, 520), 8), (rng.uniform(950, 1150), 10)], 0.15)
        dsp.poser(y, g * dsp.env_ar(len(g), 0.06, 0.15) * 0.12, t0, circulaire=True)
    for t0 in (9.2, 21.1):
        couvercle = ins.metal(rng, rng.uniform(1900, 2300), 0.3, t60=0.1, rapports=(1.0, 2.2, 3.5), amps=(1.0, 0.4, 0.2))
        dsp.poser(y, couvercle * 0.07, t0, circulaire=True)
    for k, t0 in enumerate((13.0, 13.45)):
        poids = ins.metal(rng, (2900, 3300)[k], 0.4, t60=0.2, rapports=(1.0, 2.4, 4.1), amps=(1.0, 0.3, 0.12))
        dsp.poser(y, poids * 0.05, t0, circulaire=True)
    dsp.poser(y, ins.froissement(rng, 0.6, 1200, 6000, 70, 0.05, 0.3) * 0.06, 27.4, circulaire=True)
    return dsp.filtre_circulaire(_piece(y, 0.5, 0.25, 81), dsp.gain_bande(0, 8000))


def _salon(v: int, rng: np.random.Generator) -> np.ndarray:
    """Le salon de Solange, de dedans (boucle de 30 s): l'air d'une petite pièce claire, le
    robinet du bac qui goutte (une goutte toutes les 4 à 6 s), une page de journal tournée sur le
    banc d'attente, une bobine qui roule sur le comptoir, un flacon reposé sur la tablette, le
    cadre de la vitrine qui travaille. Pas de ciseaux: ils ne sonnent que quand on coupe."""
    duree = 30.0
    n = dsp.n_ech(duree)
    y = dsp.filtre_circulaire(dsp.bruit_spectral(n, rng, -3.5), dsp.gain_bande(90, 2500)) * 0.018
    t = 1.2
    while t < duree - 0.6:
        goutte = dsp.bulle(rng, rng.uniform(1250, 1600), rng.uniform(0.006, 0.01))
        bac = ins.metal(rng, rng.uniform(1700, 1850), 0.3, t60=0.15, rapports=(1.0, 2.6), amps=(1.0, 0.3)) * 0.2
        dsp.poser(y, dsp.somme(goutte, bac) * 0.12, t, circulaire=True)
        t += rng.uniform(4.0, 6.0)
    for t0 in (7.4, 22.3):
        dsp.poser(y, ins.froissement(rng, 0.5, 900, 6000, 60, 0.08, 0.25) * 0.08, t0, circulaire=True)
    m = dsp.n_ech(0.9)
    tt = np.arange(m) / SR
    roule = dsp.pbande(rng.standard_normal(m), 300, 1800) * dsp.env_ar(m, 0.05, 0.4) * (0.6 + 0.4 * np.sin(2 * np.pi * 7 * tt))
    dsp.poser(y, roule * 0.05, 15.0, circulaire=True)
    dsp.poser(y, ins.bois(rng, 700, 0.1, 0.6, t60=0.03) * 0.06, 15.95, circulaire=True)
    for t0 in (11.6, 26.0):
        flacon = ins.metal(rng, rng.uniform(2600, 3000), 0.3, t60=0.12, rapports=(1.0, 2.3, 3.8), amps=(1.0, 0.4, 0.2))
        dsp.poser(y, flacon * 0.07, t0, circulaire=True)
    g = ins.crissement(rng, 0.3, lambda u: 120 + 60 * u, [(700, 9), (1500, 11)], 0.15)
    dsp.poser(y, g * dsp.env_ar(len(g), 0.05, 0.12) * 0.08, 18.9, circulaire=True)
    return dsp.filtre_circulaire(_piece(y, 0.4, 0.22, 83), dsp.gain_bande(0, 9000))


# --- Déclarations ----------------------------------------------------------------------------

def sons() -> list[Son]:
    motif = "joué à l'ouverture d'une conversation, chez celui qui parle à l'habitant; musique atténuée"
    pres_ru = "à moins de 30 m de la passerelle du ru (x 63 à 64, y 34 et 35)"
    rue = "l'écouteur est dans la région est (x 56 ou plus) ou dans un intérieur de la rue Haute"
    return [
        # Rue Haute et intérieurs
        Son("door-locked", "Porte fermée: le loquet bute, la porte ne s'ouvre pas (0,3 s)", R, "effects",
            _porte_fermee, 2, -23.0, 2, 0.04, 1.0, "moyen", intervalle_min_ms=600, voix_max=1,
            extra={"decodeWhen": "l'écouteur est à moins de 45 m d'une porte d'intérieur à heures (épicerie, mercerie)"},
            note="à la porte, chez celui qui essaie d'entrer hors des heures; le texte de la porte suit"),
        Son("bakery-bell", "Acheter au guichet du fournil: la clochette du guichet", R, "effects", _clochette_guichet, 1,
            -22.0, 2, 0.0, 0.5, "moyen", voix_max=1, queue_reverbe=(0.6, 0.15), extra={"decodeWhen": rue},
            note="ré 6, sans variation de hauteur (accordé); au guichet bakery_window; bread-crack suit à 0,3 s"),
        Son("bread-crack", "Pain chaud reçu: deux coups sous la miche, la croûte qui chante", R, "effects", _croute, 2,
            -26.0, 3, 0.05, 1.0, "pres", voix_max=1, extra={"decodeWhen": rue},
            note="seulement pour le pain chaud (6 h à 9 h); joué au joueur qui achète, 0,3 s après bakery-bell"),
        Son("salon-bell", "Entrer au salon de Solange: la clochette de la porte, sur son ressort", R, "effects",
            _clochette_salon, 1, -23.0, 3, 0.0, 0.5, "moyen", intervalle_min_ms=1500, voix_max=1,
            queue_reverbe=(0.5, 0.15), extra={"decodeWhen": rue},
            note="sol 6 et si 6, sans variation de hauteur; à la porte salon_door, avec door-open"),
        Son("chair-creak", "S'asseoir au fauteuil de coiffure (cuir, pied de fonte, bois)", R, "effects", _fauteuil,
            2, -25.0, 3, 0.05, 1.0, "pres", voix_max=1, extra={"decodeWhen": rue}, note="au fauteuil salon_chair"),
        Son("scissors-snip", "Valider une coupe: coup de ciseaux de Solange", R, "effects", _ciseaux, 3, -24.0, 3,
            0.05, 1.0, "pres", intervalle_min_ms=120, voix_max=2, extra={"decodeWhen": rue},
            note="trois variantes (la deuxième coupe deux fois); jouer 2 ou 3 coups espacés de 0,2 à 0,35 s pendant "
                 "cut_hair, puis hair-reveal"),
        Son("hair-reveal", "La coupe est faite: petit accord du miroir (harpe et célesta)", R, "ui", _revelation, 1,
            -20.0, 2, 0.0, 0.0, None, canaux=2, duck_db=-6.0, voix_max=1, duree_max=3.2, extra={"decodeWhen": rue},
            note="chez la personne au fauteuil (et chez l'autre s'il est au salon); sol majeur, sans variation de "
                 "hauteur"),
        Son("cup-sip", "Boire un chocolat chaud à la petite table d'Odette", R, "effects", _chocolat, 1, -26.0, 3,
            0.04, 1.0, "pres", voix_max=1,
            extra={"decodeWhen": "l'écouteur est dans l'épicerie (inside = épicerie)"},
            note="au joueur qui boit (drink_cup), à grocery_table"),
        Son("school-recess", "Récréation de l'école (10 h 30 et 15 h, jours d'école): la cour derrière son mur, au loin",
            R, "effects", _recreation, 1, -22.0, 4, 0.0, 0.0, "loin", passe_haut=120, voix_max=1,
            extra={"decodeWhen": "jour d'école, à 10 h 15 et 14 h 45 de jeu (un quart d'heure avant)"},
            note="placé au milieu de la cour (x 79, y 16); 16 s, une fois à chaque récréation; aucune voix: cloche, "
                 "galopades, balle, corde à sauter; chez les deux"),
        Son("footbridge-steps", "Pas sur la passerelle du ru (planches sur deux poutres)", R, "effects",
            _pas_passerelle, 4, -27.5, 3, 0.05, 1.5, "pres", intervalle_min_ms=120, voix_max=4, passe_haut=70,
            extra={"decodeWhen": pres_ru},
            note="à la place de step-wood sur les cases de la passerelle (sol « passerelle » ou objet footbridge)"),
        Son("talk-achille", "Motif d'Achille Pradel, le boulanger", R, "ui", motif_achille, 1, -19.5, 2, 0.0, 0.0, None,
            canaux=2, duree_max=4.2, duck_db=-8.0, intervalle_min_ms=4000, extra={"decodeWhen": rue}, note=motif),
        Son("talk-solange", "Motif de Solange Mérigot, la coiffeuse et mercière", R, "ui", motif_solange, 1, -19.0, 2,
            0.0, 0.0, None, canaux=2, duree_max=3.4, duck_db=-8.0, intervalle_min_ms=4000, extra={"decodeWhen": rue},
            note=motif),
        # Besoins
        Son("belly-rumble", "Petit creux: le ventre gargouille (discret)", B, "effects", _gargouillis, 2, -30.0, 4,
            0.06, 1.0, None, intervalle_min_ms=20000, voix_max=1,
            extra={"decodeWhen": "au lancement de la partie (petit, joué n'importe où)", "localOnly": True},
            note="chez soi seulement, non placé (jamais chez l'autre); une fois quand le Ventre passe sous le seuil "
                 "du petit creux; muet avec « Besoins en sourdine »"),
        Son("eat-together", "Manger ensemble: deux cuillères qui tintent", B, "effects", _cuilleres, 1, -23.0, 2, 0.04,
            0.5, "pres", voix_max=1, intervalle_min_ms=3000,
            extra={"decodeWhen": "au lancement de la partie (repas à deux, partout)"},
            note="une fois pour le repas partagé, entre les deux mangeurs; en plus de eat"),
        Son("yawn-soft", "Commencer la sieste: un bâillement sans voix (petite flûte qui glisse), l'oreiller", B,
            "effects", _baillement, 1, -25.0, 3, 0.04, 1.0, "pres", voix_max=1,
            extra={"decodeWhen": "de 12 h à 16 h de jeu (plage de la sieste)"},
            note="au lit, chez les deux (l'autre l'entend placé, 3 dB plus bas); épicène: aucune voix"),
        Son("nap-tick", "Sieste à deux: l'horloge qui file quatre fois plus vite (boucle)", B, "ui", _sieste_horloge, 1,
            -34.0, 4, 0.0, 0.0, None, boucle=True, passe_haut=400, voix_max=1,
            extra={"decodeWhen": "de 12 h à 16 h de jeu (plage de la sieste)"},
            note="boucle de 2 s, chez les deux, du début de l'horloge x 4 au réveil du premier (fondu de 0,4 s)"),
        Son("reunion-chime", "Retrouvailles: deux voix qui se rejoignent sur sol (flûte et clarinette)", B, "ui",
            _retrouvailles, 1, -19.0, 2, 0.0, 0.0, None, canaux=2, duck_db=-6.0, voix_max=1, duree_max=3.0,
            extra={"decodeWhen": "au lancement de la partie (les retrouvailles tombent partout)"},
            note="chez les deux, au même instant; sol majeur, sans variation de hauteur"),
        Son("hair-noticed", "Coupe remarquée: deux notes qui montent (glockenspiel)", B, "ui", _remarquee, 1, -21.0, 2,
            0.0, 0.0, None, canaux=2, duck_db=-3.0, voix_max=1,
            extra={"decodeWhen": "dès qu'une coupe ou une couleur a changé, jusqu'à ce qu'elle soit remarquée"},
            note="chez les deux; ré 6 puis sol 6"),
        # Maison
        Son("beam-ridge", "Pièce: la panne faîtière se pose au faîte (bois sur bois)", M, "effects", _panne, 1, -21.0,
            2, 0.03, 0.5, "moyen", voix_max=1,
            extra={"decodeWhen": "le chantier de la chambre est ouvert (site paru)"},
            note="au repère du faîte, à la fin du porter à deux; duo-done suit comme pour tout geste à deux"),
        Son("room-built", "Une pièce est bâtie (notification du matin, chez les deux): marteaux lointains puis accord",
            M, "ui", _piece_batie, 1, -18.0, 2, 0.0, 0.0, None, canaux=2, duck_db=-6.0, voix_max=1, duree_max=5.0,
            extra={"decodeWhen": "le dernier élément d'une pièce est bâti (elle paraîtra au matin)"},
            note="à la place de chantier-built et de notify pour ce message; sol majeur"),
        Son("chest-full", "Rangement plein: le couvercle bute (refus doux)", M, "effects", _coffre_plein, 1, -24.0, 2,
            0.04, 0.5, "pres", intervalle_min_ms=600, voix_max=1,
            extra={"decodeWhen": "l'écouteur est dans la maisonnette"},
            note="au meuble de rangement; avec le texte storage_full; à la place de ui-refusal pour ce refus"),
        Son("rack-hang", "Accrocher un outil au râtelier (fer et bois)", M, "effects", _ratelier, 2, -24.0, 3, 0.05, 1.0,
            "pres", voix_max=1, extra={"decodeWhen": "l'écouteur est dans la maisonnette"}, note="au râtelier"),
        Son("curtain-hang", "Accrocher des rideaux à une fenêtre (anneaux, tringle, étoffe)", M, "effects",
            _rideaux_poses, 1, -25.0, 3, 0.04, 1.0, "pres", voix_max=1,
            extra={"decodeWhen": "des rideaux sont dans un sac et l'écouteur dans la maisonnette"},
            note="à la fenêtre, à la pose (à la place de furniture-place)"),
        Son("curtain-draw", "Ouvrir ou fermer les rideaux (anneaux qui filent, étoffe)", M, "effects", _rideaux_tires,
            2, -27.0, 3, 0.05, 1.0, "pres", intervalle_min_ms=300, voix_max=2,
            extra={"decodeWhen": "l'écouteur est dans la maisonnette"},
            note="première variante pour ouvrir, seconde pour fermer (au hasard si le moteur ne choisit pas)"),
        # Ambiances
        Son("stream-ru", "Le ru de la Côte: eau vive peu profonde (boucle placée le long du ru)", A, "ambience", _ru, 1,
            -28.0, 4, 0.0, 0.0, "ru", boucle=True, passe_haut=200,
            extra={"decodeWhen": "l'écouteur est à moins de 30 m du ru (x 63 à 64, y 2 à 37)"},
            note="sources le long du ru, une tous les 8 m (plan.stream), chacune à son propre décalage de départ; "
                 "plus forte au gué de pierres"),
        Son("room-tone-shop", "Dans la boutique d'Odette: la pièce, la pendule, le plancher, bocaux et balance (boucle)",
            A, "ambience", _boutique, 1, -36.0, 4, 0.0, 0.0, None, boucle=True, passe_haut=70,
            extra={"decodeWhen": "l'écouteur est à moins de 6 m d'une porte de l'épicerie"},
            note="non placé, quand l'écouteur est dedans (plan.interiorByBuilding); fondu de 0,6 s à la porte"),
        Son("room-tone-salon", "Dans le salon de Solange: la pièce, le robinet qui goutte, journal, bobine (boucle)", A,
            "ambience", _salon, 1, -36.0, 4, 0.0, 0.0, None, boucle=True, passe_haut=90,
            extra={"decodeWhen": "l'écouteur est à moins de 6 m de la porte du salon"},
            note="non placé, quand l'écouteur est dedans (plan.interiorByBuilding); fondu de 0,6 s à la porte"),
    ]


# Pour le dev audio (L5): règles d'intérieur par bâtiment et sources du ru. Clés à part du plan,
# ignorées par le schéma de sons.json (v.object retire les clés inconnues) tant qu'il ne les lit pas.
INTERIEURS = {
    "description": "Tour 10 (ADR 0016, section 4): le filtre du dehors s'applique à tout intérieur (listener.inside "
                   "non nul); chaque bâtiment a son ambiance de pièce et son propre étouffement. Les identifiants des "
                   "bâtiments sont ceux de GameMap.buildings (à confirmer par L0); le champ « ambiance » d'un "
                   "bâtiment de la carte nomme le même son que roomTone.",
    "rampMs": 600,
    "buildings": {
        "house": {"roomTone": None, "outdoorLowpassHz": 900, "outdoorDb": -10.0, "rain": "rain-roof",
                  "note": "la maisonnette, comme avant (plan.interior)"},
        "grocery": {"roomTone": "room-tone-shop", "roomToneDb": 0.0, "outdoorLowpassHz": 1100, "outdoorDb": -9.0,
                    "rain": "rain-roof", "note": "épicerie d'Odette: porte vitrée et comptoir sur la place, un peu "
                                                 "moins étouffé que la maisonnette"},
        "salon": {"roomTone": "room-tone-salon", "roomToneDb": 0.0, "outdoorLowpassHz": 1300, "outdoorDb": -8.0,
                  "rain": "rain-roof", "note": "mercerie-coiffure de Solange: la vitrine laisse passer la rue"},
    },
    "otherPlayerInside": {"description": "l'autre joueur dans un autre bâtiment (ADR 0016): ses sons placés passent "
                                         "par le même étouffement que ceux du dehors, en plus de peerWorldSoundsDb",
                          "lowpassHz": 900, "db": -8.0},
}

PLAN_RU = {
    "description": "Le ru de la Côte (tour 10, x 63 à 64, du bois en y 2 à l'Aubrune en y 37): sources de stream-ru "
                   "le long du ru, chacune à son propre décalage de départ dans la boucle.",
    "sound": "stream-ru",
    "x": 63.5,
    "fromY": 2.0,
    "toY": 37.0,
    "spacingM": 8.0,
    "fordPoint": {"x": 63.0, "y": 30.0},
    "fordBoostDb": 3.0,
    "hours": [6, 30],
}
