"""Les musiques de la démo de Deux Tabliers (café d'Ormeval), écrites en données.

La radio du village (son.md, 8.4.2) joue deux stations: la douce (morceaux posés) et
l'entraînante (morceaux allants). Pour la démo, deux listes de la version 1 (son.md, 8.4.4),
deux morceaux chacune:
- « Les Prés » (style campagne): bal folk acoustique, violon, guitare folk, flûte à bec, contrebasse;
- « Le Zinc » (style bistrot): valse musette et swing à la pompe, accordéon, guitare, clarinette.
Plus le thème du titre « Notre maison » (version courte) et le jingle du bilan du soir.

Le motif de la maison (son.md, 8.2.2): sol, la, do (on ouvre la porte), ré, do (on se pose).
Il ouvre le thème du titre et le jingle du bilan.

Tous les morceaux sont finis (introduction et vraie fin, lus en flux): aucun raccord de boucle.
Genres et instruments sont des styles: aucun air ni arrangement existant n'est repris.
"""

from __future__ import annotations

import numpy as np

from partition import (Accord, Morceau, Note, Piste, accords_frappes, decaler, grille, humaniser,
                       ligne_basse, mel, nappe)

# Programmes General MIDI (à partir de 0), tous présents dans FluidR3_GM (banque 0).
PIANO = 0
ACCORDEON = 21
GUITARE_NYLON, GUITARE_FOLK, GUITARE_JAZZ = 24, 25, 26
CONTREBASSE = 32
VIOLON, VIOLONCELLE, PIZZ = 40, 42, 45
CLARINETTE = 71
FLUTE_A_BEC = 74
FIDDLE = 110
BATTERIE_STANDARD, BATTERIE_BRUSH = 0, 40  # canal des percussions

M34, M44 = 3.0, 4.0


def _rng(graine: int) -> np.random.Generator:
    return np.random.default_rng(graine)


class Plan:
    """Sections successives (nom, grille, nombre de mesures): débuts en temps et grille complète."""

    def __init__(self, mesure: float, sections: list[tuple[str, str]]):
        self.mesure = mesure
        self.debuts: list[float] = []
        self.noms: list[str] = []
        self.accords: list[Accord] = []
        t = 0.0
        for nom, txt in sections:
            self.noms.append(nom)
            self.debuts.append(t)
            acc = grille(txt, t, mesure)
            self.accords += acc
            t += len(txt.split("|")) * mesure
        self.fin = t

    @property
    def mesures(self) -> int:
        return int(round(self.fin / self.mesure))

    def t(self, k: int) -> float:
        return self.debuts[k]

    def section(self, k: int) -> list[Accord]:
        fin = self.debuts[k + 1] if k + 1 < len(self.debuts) else self.fin
        return [a for a in self.accords if self.debuts[k] - 1e-6 <= a.t < fin - 1e-6]

    def sauf_fin(self, temps: float) -> list[Accord]:
        """Grille sans les derniers `temps` (l'accord final est tenu à part)."""
        return [a for a in self.accords if a.t < self.fin - temps - 1e-6]


def valse(accords: list[Accord], vel_b: int = 70, vel_c: int = 54, bas_c: int = 55, haut_c: int = 70,
          duree_c: float = 0.7) -> tuple[list[Note], list[Note]]:
    """Valse: basse au premier temps, accord aux deux suivants (le « boum, tchac, tchac »)."""
    basse = ligne_basse(accords, [0.0], vel=vel_b, bas=36, haut=50, duree=1.6, quintes=False)
    # Alterner racine et quinte d'une mesure à l'autre, comme une basse de bal.
    for k, n in enumerate(basse):
        if k % 2 == 1:
            acc = next(a for a in accords if abs(a.t - n.t) < 1e-6)
            q = n.p + ((acc.pcs[2] - acc.pcs[0]) % 12 if len(acc.pcs) > 2 else 0) - 12
            n.p = q if q >= 33 else q + 12
    accords_ = accords_frappes(accords, [1.0, 2.0], vel=vel_c, nb=3, bas=bas_c, haut=haut_c, duree=duree_c)
    return basse, accords_


def oompah(accords: list[Accord], vel_b: int = 72, vel_c: int = 54, bas_c: int = 55, haut_c: int = 70,
           duree_c: float = 0.45) -> tuple[list[Note], list[Note]]:
    """Mesure à 4 temps: basse aux temps 1 et 3 (racine, quinte), accord aux temps 2 et 4."""
    basse = ligne_basse(accords, [0.0, 2.0], vel=vel_b, bas=36, haut=50, duree=0.9)
    acc = accords_frappes(accords, [1.0, 3.0], vel=vel_c, nb=3, bas=bas_c, haut=haut_c, duree=duree_c)
    return basse, acc


def pompe(accords: list[Accord], vel: int = 56) -> list[Note]:
    """La pompe du swing manouche: un accord bref à chaque temps, appuyé aux temps 2 et 4."""
    notes = []
    for k, dt in enumerate([0.0, 1.0, 2.0, 3.0]):
        for n in accords_frappes(accords, [dt], vel=vel + (8 if k % 2 else -6), nb=4, bas=52, haut=67,
                                 duree=0.22 if k % 2 == 0 else 0.3):
            notes.append(n)
    return notes


def tenu_final(acc: Accord, t: float, duree: float, bas: int, haut: int, vel: int, nb: int = 3) -> list[Note]:
    seul = Accord(t, duree, acc.symbole, acc.racine, acc.pcs, acc.basse)
    return [Note(t, duree, n.p, vel) for n in nappe([seul], vel, nb, bas, haut)]


def balais(debut: float, fin: float, mesure: float, vel: int = 34) -> list[Note]:
    """Balais sur la caisse claire (batterie Brush): un frottement par temps, plus doux au premier."""
    notes = []
    t = debut
    while t < fin - 1e-6:
        k = int(round((t - debut) % mesure))
        notes.append(Note(t, 0.3, 38, vel - (8 if k == 0 else 0)))
        t += 1.0
    return notes


# --- « Les Prés » n° 1: « Rosée », valse lente, sol majeur ---------------------------------

ROSEE_A = ("D5:2 B4:1 | G4:2 B4:1 | E5:2 D5:1 | D5:3 | B4:2 G4:1 | A4:2 C5:1 | A4:1 F#4:1 A4:1 | C5:3 | "
           "D5:2 B4:1 | G4:2 D5:1 | G5:2 E5:1 | E5:2 C#5:1 | D5:2 B4:1 | A4:2 C5:1 | B4:1 A4:1 B4:1 | G4:3 |")
ROSEE_GA = "G | G | C | G | Em | Am | D7 | D7 | G | G | C | A7 | G/D | D7 | G | G"
ROSEE_B = ("B4:2 E5:1 | G5:3 | A5:2 E5:1 | C5:3 | D5:2 F#5:1 | A5:3 | G5:2 D5:1 | B4:3 | "
           "C5:2 E5:1 | G5:2 E5:1 | D5:2 B4:1 | G4:2 B4:1 | C5:2 A4:1 | F#4:2 A4:1 | G4:3 | F#4:1 A4:1 C5:1 |")
ROSEE_GB = "Em | Em | Am | Am | D | D | G | G | C | C | G | Em | Am | D7 | G | D7"
ROSEE_INTRO = "G | C | G | D7"
ROSEE_OUTRO = "G | C | G/D | D7 | G | C | G | G"


def rosee() -> Morceau:
    rng = _rng(101)
    tempo = 126.0
    p = Plan(M34, [("intro", ROSEE_INTRO), ("A", ROSEE_GA), ("A2", ROSEE_GA), ("B", ROSEE_GB),
                   ("A3", ROSEE_GA), ("B2", ROSEE_GB), ("A4", ROSEE_GA), ("outro", ROSEE_OUTRO)])
    a = lambda k, v=80, tr=0: mel(ROSEE_A, p.t(k), v, M34, transpo=tr)  # noqa: E731
    b = lambda k, v=80, tr=0: mel(ROSEE_B, p.t(k), v, M34, transpo=tr)  # noqa: E731
    fin_outro = mel("D5:2 B4:1 | E5:2 C5:1 | B4:2 G4:1 | A4:1 F#4:1 A4:1 | G4:3 | r:3 | r:3 | r:3 |",
                    p.t(7), 74, M34)
    violon = a(1, 84) + a(2, 80) + a(4, 84) + b(5, 80) + a(6, 86) + fin_outro
    # La flûte à bec prend le premier B, puis double le violon à l'unisson (couleur de bal folk).
    flute = b(3, 80) + b(5, 66) + a(6, 62)
    basse, gtr = valse(p.sauf_fin(3 * M34), vel_b=72, vel_c=52, bas_c=52, haut_c=67)
    gtr += tenu_final(p.accords[-1], p.fin - 3 * M34, 3 * M34, 52, 67, 56, 4)
    basse.append(Note(p.fin - 3 * M34, 3 * M34, 43, 70))
    return Morceau(
        accords=p.accords, id="campagne-1", titre="Rosée", tempo=tempo, signature=(3, 4), mesures=p.mesures,
        temps_par_mesure=M34, graine=11, rt60=1.3, boucle=False, queue_s=4.0, sonie_cible=-16.0,
        pistes=[
            Piste("violon", FIDDLE, humaniser(violon, rng, 0.008, 4, tempo), sonie_lu=0.0, pan=58, reverbe=0.26,
                  souffle=True),
            Piste("flute", FLUTE_A_BEC, humaniser(flute, rng, 0.008, 4, tempo), sonie_lu=-2.5, pan=76, reverbe=0.3,
                  souffle=True),
            Piste("guitare", GUITARE_FOLK, humaniser(gtr, rng, 0.010, 5, tempo), sonie_lu=-6.0, pan=48,
                  reverbe=0.18, passe_haut=90),
            Piste("contrebasse", CONTREBASSE, humaniser(basse, rng, 0.006, 4, tempo), sonie_lu=-6.0, pan=64,
                  reverbe=0.1),
        ],
    )


# --- « Les Prés » n° 3: « Le pré d'en bas », scottish, sol majeur ---------------------------

PRE_A = ("G4:.75 B4:.25 D5:.75 B4:.25 G5:1 D5:1 | E5:.75 D5:.25 B4:.75 D5:.25 G4:2 | "
         "E5:.75 G5:.25 E5:.75 C5:.25 G4:1 C5:1 | D5:.75 E5:.25 F#5:.75 E5:.25 D5:2 | "
         "G5:.75 F#5:.25 G5:.75 D5:.25 B4:1 G4:1 | E5:.75 F#5:.25 G5:.75 E5:.25 B4:2 | "
         "C5:.75 B4:.25 A4:1 D5:.75 C5:.25 A4:1 | G4:1 B4:1 G4:2 |")
PRE_GA = "G | G | C | D | G | Em | Am D | G"
PRE_B = ("E5:1 G5:1 E5:.75 D5:.25 C5:1 | D5:1 B4:1 G4:2 | C5:.75 D5:.25 E5:.75 C5:.25 A4:2 | "
         "F#4:.75 G4:.25 A4:.75 B4:.25 A4:2 | G5:1 E5:1 C5:.75 E5:.25 G5:1 | D5:1 B4:1 D5:2 | "
         "C5:1 A4:1 D5:1 F#4:1 | G4:2 r:2 |")
PRE_GB = "C | G | Am | D | C | G/B | Am D | G"


def pre_d_en_bas() -> Morceau:
    rng = _rng(103)
    tempo = 112.0
    p = Plan(M44, [("intro", "G | C | D | D"), ("A", PRE_GA), ("A2", PRE_GA), ("B", PRE_GB), ("B2", PRE_GB),
                   ("A3", PRE_GA), ("A4", PRE_GA), ("B3", PRE_GB), ("outro", "G | D | G | G")])
    a = lambda k, v=82: mel(PRE_A, p.t(k), v, M44, legato=0.85)  # noqa: E731
    b = lambda k, v=82: mel(PRE_B, p.t(k), v, M44, legato=0.85)  # noqa: E731
    outro = mel("G4:.75 B4:.25 D5:.75 B4:.25 G5:2 | F#5:.75 E5:.25 D5:.75 C5:.25 A4:2 | G4:1 r:3 | r:4 |",
                p.t(8), 80, M44, legato=0.85)
    violon = a(1) + a(2) + b(3) + b(4, 78) + a(5, 84) + a(6, 86) + b(7, 84) + outro
    flute = a(2, 74) + b(4, 76) + a(6, 78) + b(7, 78) + outro
    basse, gtr = oompah(p.sauf_fin(3 * M44), vel_b=76, vel_c=54, bas_c=52, haut_c=67)
    gtr += tenu_final(p.accords[-2], p.fin - 2 * M44 - M44, 1.0, 52, 67, 60, 4)
    basse.append(Note(p.fin - 3 * M44, 1.0, 43, 76))
    # Tambourin (batterie standard, 54) aux temps faibles, à partir de la deuxième reprise.
    tamb = [Note(t, 0.2, 54, 46 + (10 if (t % 2) > 0.5 else 0)) for t in np.arange(p.t(2), p.fin - 3 * M44, 1.0)]
    return Morceau(
        accords=p.accords, id="campagne-3", titre="Le pré d'en bas", tempo=tempo, signature=(4, 4),
        mesures=p.mesures, temps_par_mesure=M44, graine=13, rt60=1.1, boucle=False, queue_s=3.5,
        sonie_cible=-16.0,
        pistes=[
            Piste("violon", FIDDLE, humaniser(violon, rng, 0.006, 4, tempo), sonie_lu=0.0, pan=56, reverbe=0.22,
                  souffle=True),
            Piste("flute", FLUTE_A_BEC, humaniser(flute, rng, 0.006, 4, tempo), sonie_lu=-3.0, pan=74,
                  reverbe=0.26, souffle=True),
            Piste("guitare", GUITARE_FOLK, humaniser(gtr, rng, 0.008, 5, tempo), sonie_lu=-6.0, pan=46,
                  reverbe=0.16, passe_haut=90),
            Piste("contrebasse", CONTREBASSE, humaniser(basse, rng, 0.006, 4, tempo), sonie_lu=-6.0, pan=64,
                  reverbe=0.1),
            Piste("tambourin", BATTERIE_STANDARD, tamb, sonie_lu=-15.0, pan=84, reverbe=0.2, percussions=True),
        ],
    )


# --- « Le Zinc » n° 1: « Petit noir », valse musette lente, la mineur -----------------------

NOIR_A = ("E5:1 A5:2 | C5:1 E5:1 A4:1 | G#4:1 B4:1 E5:1 | D5:3 | B4:1 E5:1 G#5:1 | D5:2 B4:1 | "
          "C5:1 E5:1 A4:1 | A4:3 | F5:1 A5:1 F5:1 | D5:3 | E5:2 C5:1 | A4:2 E4:1 | B4:2 D5:1 | "
          "G#4:2 B4:1 | A4:1 C5:1 E5:1 | A5:3 |")
NOIR_GA = "Am | Am | E7 | E7 | E7 | E7 | Am | Am | Dm | Dm | Am | Am | E7 | E7 | Am | Am"
NOIR_B = ("A4:1 D5:1 F5:1 | A5:2 F5:1 | G5:1 F5:1 D5:1 | B4:3 | C5:1 E5:1 G5:1 | G5:2 E5:1 | "
          "A5:1 E5:1 C5:1 | A4:3 | D5:1 F5:1 A5:1 | F5:2 D5:1 | E5:1 G#5:1 B5:1 | D5:3 | C5:2 A4:1 | "
          "A4:1 C5:1 F5:1 | E5:2 D5:1 | B4:2 G#4:1 |")
NOIR_GB = "Dm | Dm | G7 | G7 | C | C | Am | Am | Dm | Dm | E7 | E7 | Am | F | E7 | E7"
NOIR_C = ("G4:1 C5:1 E5:1 | G5:3 | F5:1 D5:1 B4:1 | G4:3 | B4:1 D5:1 F5:1 | D5:3 | E5:1 G5:1 E5:1 | "
          "C5:3 | A4:1 C5:1 F5:1 | A5:2 F5:1 | G5:2 E5:1 | A5:2 E5:1 | F5:1 A5:1 D5:1 | B4:2 D5:1 | "
          "C5:3 | B4:1 G#4:1 E4:1 |")
NOIR_GC = "C | C | G7 | G7 | G7 | G7 | C | C | F | F | C | Am | Dm | G7 | C | E7"


def petit_noir() -> Morceau:
    rng = _rng(201)
    tempo = 150.0
    p = Plan(M34, [("intro", "Am | E7 | Am | E7 | Am | Dm | E7 | E7"), ("A", NOIR_GA), ("B", NOIR_GB),
                   ("A2", NOIR_GA), ("C", NOIR_GC), ("A3", NOIR_GA), ("B2", NOIR_GB), ("A4", NOIR_GA),
                   ("coda", "Am | Dm | Am | E7 | Am | Am | Am | Am")])
    a = lambda k, v=82, tr=0: mel(NOIR_A, p.t(k), v, M34, transpo=tr)  # noqa: E731
    intro = mel("r:3 | r:3 | r:3 | r:3 | E5:1 A5:2 | F5:1 D5:2 | B4:1 G#4:1 B4:1 | E5:3 |", 0.0, 74, M34)
    coda = mel("E5:1 A5:2 | F5:1 A5:2 | E5:1 C5:2 | B4:1 G#4:1 B4:1 | A4:3 | r:3 | r:3 | r:3 |", p.t(8), 76, M34)
    accordeon = (intro + a(1) + mel(NOIR_B, p.t(2), 80, M34) + a(3, 84) + mel(NOIR_C, p.t(4), 78, M34)
                 + a(5, 84) + a(7, 86) + coda)
    clarinette = (decaler(a(3, 60), transpo=-12) + mel(NOIR_B, p.t(6), 80, M34)
                  + decaler(a(7, 58), transpo=-12))
    basse, gtr = valse(p.sauf_fin(4 * M34), vel_b=72, vel_c=54, bas_c=52, haut_c=67, duree_c=0.45)
    fin = Accord(p.fin - 4 * M34, 4 * M34, "Am", 9, [9, 0, 4], 9)
    gtr += tenu_final(fin, fin.t, 3.5 * M34, 52, 67, 58, 4)
    basse.append(Note(fin.t, 3 * M34, 45, 70))
    return Morceau(
        accords=p.accords, id="bistrot-1", titre="Petit noir", tempo=tempo, signature=(3, 4), mesures=p.mesures,
        temps_par_mesure=M34, graine=21, rt60=1.2, boucle=False, queue_s=4.0, sonie_cible=-16.0,
        pistes=[
            Piste("accordeon", ACCORDEON, humaniser(accordeon, rng, 0.006, 4, tempo), sonie_lu=0.0, pan=58,
                  reverbe=0.22, souffle=True),
            Piste("clarinette", CLARINETTE, humaniser(clarinette, rng, 0.006, 4, tempo), sonie_lu=-3.0, pan=80,
                  reverbe=0.26, souffle=True),
            Piste("guitare", GUITARE_FOLK, humaniser(gtr, rng, 0.008, 5, tempo), sonie_lu=-7.0, pan=44,
                  reverbe=0.16, passe_haut=90),
            Piste("contrebasse", CONTREBASSE, humaniser(basse, rng, 0.006, 4, tempo), sonie_lu=-6.0, pan=64,
                  reverbe=0.1),
        ],
    )


# --- « Le Zinc » n° 4: « Le garçon pressé », swing à la pompe, la mineur ---------------------

PRESSE_A = ("E5:.67 A5:.33 r:.67 E5:.33 C5:1 A4:1 | B4:.67 C5:.33 E5:.67 C5:.33 A4:2 | "
            "D5:.67 F5:.33 r:.67 F5:.33 A5:1 F5:1 | E5:.67 F5:.33 A5:.67 F5:.33 D5:2 | "
            "B4:.67 D5:.33 r:.67 D5:.33 G#5:1 E5:1 | F5:.67 E5:.33 D5:.67 B4:.33 G#4:2 | "
            "A4:.67 C5:.33 E5:.67 A5:.33 G5:.67 E5:.33 C5:1 | B4:1 G#4:1 E4:2 | "
            "E5:.67 A5:.33 r:.67 E5:.33 C5:1 A4:1 | B4:.67 C5:.33 E5:.67 G5:.33 A5:2 | "
            "F5:.67 A5:.33 r:.67 A5:.33 D5:1 F5:1 | E5:.67 D5:.33 A4:.67 F4:.33 D4:2 | "
            "C5:.67 F5:.33 A5:.67 F5:.33 C5:1 A4:1 | B4:.67 D5:.33 E5:.67 G#5:.33 B5:2 | "
            "A5:.67 E5:.33 C5:.67 B4:.33 A4:2 | E4:.67 A4:.33 C5:.67 E5:.33 A5:1 r:1 |")
PRESSE_GA = "Am | Am | Dm | Dm | E7 | E7 | Am | E7 | Am | Am | Dm | Dm | F | E7 | Am | Am"
PRESSE_B = ("A5:2 F5:1 C5:1 | A4:3 C5:1 | E5:2 G5:1 E5:1 | C5:4 | D5:2 F5:1 A5:1 | F5:4 | E5:2 C5:1 A4:1 | "
            "A4:4 | C5:2 A4:1 F4:1 | A4:2 C5:2 | G5:2 E5:1 C5:1 | C#5:2 E5:1 G5:1 | F5:2 D5:1 A4:1 | "
            "G#4:2 B4:1 D5:1 | C5:2 A4:2 | B4:2 E5:2 |")
PRESSE_GB = "F | F | C | C | Dm | Dm | Am | Am | F | F | C | A7 | Dm | E7 | Am | E7"


def garcon_presse() -> Morceau:
    rng = _rng(203)
    tempo = 168.0
    p = Plan(M44, [("intro", "Am | Dm | E7 | E7"), ("A", PRESSE_GA), ("A2", PRESSE_GA), ("B", PRESSE_GB),
                   ("A3", PRESSE_GA), ("B2", PRESSE_GB), ("A4", PRESSE_GA), ("outro", "Am | E7 | Am | Am")])
    a = lambda k, v=84, tr=0: mel(PRESSE_A, p.t(k), v, M44, legato=0.9, transpo=tr)  # noqa: E731
    b = lambda k, v=80: mel(PRESSE_B, p.t(k), v, M44)  # noqa: E731
    outro = mel("E5:.67 A5:.33 r:.67 E5:.33 C5:1 A4:1 | B4:1 G#4:1 E4:2 | A4:1 r:3 | r:4 |", p.t(7), 84, M44,
                legato=0.9)
    guitare_solo = a(1) + a(4, 86) + decaler(a(4, 70), transpo=-12) + a(6, 82) + outro
    accordeon = a(2, 82) + b(3) + a(6, 80) + outro
    clarinette = b(5, 80)
    fin_t = p.fin - 2 * M44
    gtr = pompe([x for x in p.accords if x.t < fin_t - 1e-6], vel=54)
    gtr += tenu_final(Accord(fin_t, M44, "Am6", 9, [9, 0, 4, 6], 9), fin_t, 2.0, 52, 67, 62, 4)
    # Contrebasse: deux temps par mesure, racine puis quinte, et une note de passage en fin de grille.
    basse = ligne_basse([x for x in p.accords if x.t < fin_t - 1e-6], [0.0, 2.0], vel=80, bas=36, haut=50,
                        duree=1.6)
    basse.append(Note(fin_t, 2.0, 45, 80))
    return Morceau(
        accords=p.accords, id="bistrot-4", titre="Le garçon pressé", tempo=tempo, signature=(4, 4),
        mesures=p.mesures, temps_par_mesure=M44, graine=23, rt60=1.0, boucle=False, queue_s=3.0,
        sonie_cible=-16.0,
        pistes=[
            Piste("guitare_solo", GUITARE_JAZZ, humaniser(guitare_solo, rng, 0.006, 5, tempo), sonie_lu=0.0,
                  pan=52, reverbe=0.18),
            Piste("accordeon", ACCORDEON, humaniser(accordeon, rng, 0.006, 4, tempo), sonie_lu=-1.0, pan=74,
                  reverbe=0.2, souffle=True),
            Piste("clarinette", CLARINETTE, humaniser(clarinette, rng, 0.006, 4, tempo), sonie_lu=-1.5, pan=82,
                  reverbe=0.22, souffle=True),
            Piste("pompe", GUITARE_NYLON, humaniser(gtr, rng, 0.005, 4, tempo), sonie_lu=-7.0, pan=40,
                  reverbe=0.12, passe_haut=110),
            Piste("contrebasse", CONTREBASSE, humaniser(basse, rng, 0.005, 4, tempo), sonie_lu=-6.0, pan=64,
                  reverbe=0.08),
        ],
    )


# --- Écran titre: « Notre maison » (version courte), valse, fa majeur ------------------------

MAISON_A = ("G4:1 A4:1 C5:1 | D5:2 C5:1 | A4:2 F4:1 | D5:3 | D5:1 C5:1 Bb4:1 | G4:2 E4:1 | F4:2 A4:1 | "
            "C5:3 | G4:1 A4:1 C5:1 | D5:2 F5:1 | F5:2 D5:1 | E5:2 C5:1 | Bb4:2 D5:1 | C5:1 E5:1 G5:1 | "
            "F5:2 C5:1 | A4:3 |")
MAISON_GA = "F | F | Dm | Dm | Bb | C | F | F | F | Dm | Bb | C | Gm | C | F | F"
MAISON_B = "D5:2 F5:1 | Bb5:2 F5:1 | A5:2 F5:1 | C5:3 | Bb4:1 D5:1 G5:1 | E5:2 C5:1 | F5:2 A4:1 | E5:2 C5:1 |"
MAISON_GB = "Bb | Bb | F | F | Gm | C | F | C"
MAISON_A2 = "G4:1 A4:1 C5:1 | D5:2 A4:1 | D5:1 C5:1 Bb4:1 | G4:2 C5:1 | G4:1 A4:1 C5:1 | D5:3 | C5:3 | C5:3 |"
MAISON_GA2 = "F | Dm | Bb | C | F | Bb | C | F"


def notre_maison() -> Morceau:
    rng = _rng(301)
    tempo = 120.0
    p = Plan(M34, [("intro", "F | Bb | F | C"), ("A", MAISON_GA), ("B", MAISON_GB), ("A2", MAISON_GA2),
                   ("coda", "F | Bb | F | F")])
    piano = (mel("G4:1 A4:1 C5:1 | D5:2 r:1 | G4:1 A4:1 C5:1 | E5:3 |", 0.0, 64, M34)
             + mel(MAISON_A, p.t(1), 76, M34) + mel(MAISON_B, p.t(2), 74, M34) + mel(MAISON_A2, p.t(3), 76, M34)
             + mel("A4:1 C5:1 F5:1 | D5:3 | C5:3 | r:3 |", p.t(4), 66, M34))
    accordeon = decaler(mel(MAISON_A2, p.t(3), 60, M34), transpo=-12)
    basse, gtr = valse(p.sauf_fin(2 * M34), vel_b=66, vel_c=48, bas_c=53, haut_c=67, duree_c=0.8)
    fin = p.accords[-1]
    gtr += tenu_final(fin, p.fin - 2 * M34, 2 * M34, 53, 69, 52, 4)
    basse.append(Note(p.fin - 2 * M34, 2 * M34, 41, 64))
    bal = balais(p.t(1), p.fin - 2 * M34, M34, vel=30)
    return Morceau(
        accords=p.accords, id="title", titre="Notre maison", tempo=tempo, signature=(3, 4), mesures=p.mesures,
        temps_par_mesure=M34, graine=31, rt60=1.5, boucle=False, queue_s=4.5, sonie_cible=-16.0,
        pistes=[
            Piste("piano", PIANO, humaniser(piano, rng, 0.008, 4, tempo), sonie_lu=0.0, pan=60, reverbe=0.3),
            Piste("accordeon", ACCORDEON, humaniser(accordeon, rng, 0.006, 3, tempo), sonie_lu=-8.0, pan=80,
                  reverbe=0.28, souffle=True),
            Piste("guitare", GUITARE_NYLON, humaniser(gtr, rng, 0.010, 4, tempo), sonie_lu=-6.0, pan=44,
                  reverbe=0.22, passe_haut=90),
            Piste("contrebasse", CONTREBASSE, humaniser(basse, rng, 0.006, 3, tempo), sonie_lu=-7.0, pan=64,
                  reverbe=0.12),
            Piste("balais", BATTERIE_BRUSH, bal, sonie_lu=-16.0, pan=70, reverbe=0.2, percussions=True),
        ],
    )


# --- Bilan du soir: « La caisse est faite » (jingle), fa majeur -------------------------------

def caisse_faite() -> Morceau:
    rng = _rng(401)
    tempo = 66.0
    acc = grille("F | Dm7 | Bbmaj7 C | F", 0.0, M44)
    piano = mel("G4:1 A4:1 C5:2 | D5:2 C5:2 | D5:1 C5:1 A4:1 G4:1 | A4:4 |", 0.0, 68, M44)
    nylon = []
    for a in acc[:-1]:  # arpège en croches sur les notes de l'accord, de bas en haut puis retour
        voix = sorted(n.p for n in nappe([a], 50, 3, 53, 69))
        ordre = voix + voix[-2:0:-1]
        nylon += [Note(a.t + 0.5 * k, 1.2, ordre[k % len(ordre)], 50 - (4 if k % 2 else 0))
                  for k in range(int(round(a.d / 0.5)))]
    nylon += [Note(acc[-1].t + 0.12 * k, 4.0, n.p, 52 - 3 * k) for k, n in enumerate(nappe([acc[-1]], 52, 4, 53, 72))]
    cello = [Note(0.0, 3.9, 41, 64), Note(4.0, 3.9, 38, 62), Note(8.0, 1.9, 46, 62), Note(10.0, 1.9, 48, 62),
             Note(12.0, 4.0, 41, 60)]
    return Morceau(
        accords=acc, id="evening-summary", titre="La caisse est faite", tempo=tempo, signature=(4, 4), mesures=4,
        temps_par_mesure=M44, graine=41, rt60=1.6, boucle=False, queue_s=4.0, sonie_cible=-16.0,
        pistes=[
            Piste("piano", PIANO, humaniser(piano, rng, 0.008, 3, tempo), sonie_lu=0.0, pan=62, reverbe=0.32),
            Piste("guitare", GUITARE_NYLON, humaniser(nylon, rng, 0.010, 3, tempo), sonie_lu=-6.0, pan=46,
                  reverbe=0.25, passe_haut=90),
            Piste("violoncelle", VIOLONCELLE, cello, sonie_lu=-5.0, pan=70, reverbe=0.3, souffle=True),
        ],
    )


MORCEAUX = {
    "campagne-1": rosee,
    "campagne-3": pre_d_en_bas,
    "bistrot-1": petit_noir,
    "bistrot-4": garcon_presse,
    "title": notre_maison,
    "evening-summary": caisse_faite,
}
