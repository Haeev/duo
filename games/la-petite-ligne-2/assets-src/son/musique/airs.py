"""Les huit airs de la collection de musiques d'Aubrune (carnet, famille « Musiques »).

Chaque air porte l'identifiant de sa fiche (`donnees/commun/carnet/<id>.json`): le morceau
`air-marche-de-la-halte` de `musique.json` est l'air de l'entrée `air-marche-de-la-halte`. Ils se
rendent par la même chaîne que les moments du bourg (`generer.py`): deux tiges `fond` et `air` qui
bouclent ensemble, -16 LUFS, Opus mono.

Notes d'intention (tonalité de base: sol majeur, les sept notes de la gamme seulement, comme tout
Aubrune; un mode est un autre centre de la même gamme):

| Fiche | Intention | Écriture |
|---|---|---|
| Marche de la halte | la fanfare du quai | marche en 2/4 à 120, bugle (trompette douce), tuba, cors, caisse claire; le trombone a un temps d'avance (fiche) |
| Valse de la minute | la valse du dernier bal | 3/4 à 135, accordéon; Ambroise la siffle (sifflet) au milieu, la pendule bat doucement |
| Carillon des deux sœurs | la complainte de la Fêlée | clarinette en mi mineur doux, harpe; puis les deux cloches (sol, ré) sonnent juste en sol, boîte à musique |
| Chanson des marmites | la berceuse d'Honorine | 3/4 à 100, boîte à musique seule; le bourg la reprend à l'accordéon en tapant sur les couvercles, puis elle redevient berceuse |
| Canon de la répétition | la ritournelle des grenouilles | 4/4 à 120, canon à trois voix à deux mesures d'écart (basson, clarinette, pizzicati) sur un ostinato de pizzicati; le guiro fait les grenouilles qui attendent |
| Chant de la coupe | le trombone du bief | blues gentil en ré mixolydien (sans note bleue étrangère), 4/4 à 90 en balancement, trombone puis appel et réponse avec la clarinette; un coup de bois par mesure garde le rythme de la hache |
| Le sifflet du samedi | la chanson de la draisine | 6/8 à 135, guitare en arpèges qui roulent; la chanson commence par deux notes brèves et une longue, que le sifflet double |
| Sonnerie de 5 h 12 | l'hymne de la ligne | le motif du quai (ré, sol, si, la, sol) en choral à quatre voix, harmonium, cor, chœur; une cloche (sol et sa tierce) et un sifflet lointain |

Durées entières en secondes (64 à 72 s), boucle sans couture (le rendu replie la queue de
réverbération sur le début).
"""

from __future__ import annotations

import math

from aubrune import CLARINETTE, CONTREBASSE_ARCO, CONTREBASSE_PIZZ, GLOCK, GUITARE, PIANO, ACCORDEON, BROSSES
from aubrune import SOL_MAJEUR, _morceau, dans_accords, entre, humain
from partition import (Accord, Morceau, Note, Piste, accords_frappes, arpege, basse_de, contrechant, decaler,
                       grille, ligne_basse, mel, tierce_dessous, voicing)

BOITE_A_MUSIQUE = 10
CLOCHES = 14
ORGUE_A_ANCHES = 20
PIZZICATI = 45
HARPE = 46
CHOEUR = 52
TROMPETTE = 56
TROMBONE = 57
TUBA = 58
CORS = 60
BASSON = 70
SIFFLET = 78
BATTERIE = 0  # kit standard, canal 10

# Percussions General MIDI (canal 10).
GROSSE_CAISSE, CAISSE_CLAIRE, CYMBALE = 36, 38, 49
CHARLESTON = 42
CLOCHE_RIDE = 53
TOM_GRAVE = 45
BOIS_GRAVE = 77
GUIRO_COURT, GUIRO_LONG = 73, 74


def mesures_de(texte: str, tpm: float, t0: float = 0.0, vel: int = 70, legato: float = 0.96,
               transpo: int = 0) -> list[Note]:
    return mel(texte, t0=t0, vel=vel, mesure=tpm, legato=legato, transpo=transpo)


def balancer(notes: list[Note]) -> list[Note]:
    """Balancement ternaire: la croche du milieu de chaque temps passe aux deux tiers du temps."""
    def f(t: float) -> float:
        base = math.floor(t + 1e-9)
        frac = t - base
        return base + (frac * 4 / 3 if frac <= 0.5 else 2 / 3 + (frac - 0.5) * 2 / 3)

    sortie = []
    for n in notes:
        debut, fin = f(n.t), f(n.t + n.d)
        sortie.append(Note(debut, max(0.05, fin - debut), n.p, n.v))
    return sortie


def percu(coups: list[tuple[float, int, int]], duree: float = 0.2) -> list[Note]:
    return [Note(t, duree, p, v) for (t, p, v) in coups]


# --- 1. Marche de la halte -------------------------------------------------------------------

MARCHE_A = ("D4:.5 G4:.5 B4:.75 A4:.25 | G4:1 D4:1 | E4:.5 G4:.5 C5:.75 B4:.25 | A4:1.5 r:.5 | "
            "F#4:.5 A4:.5 D5:.75 C5:.25 | B4:.5 A4:.5 G4:.5 B4:.5 | A4:.5 G4:.5 F#4:.5 E4:.5 | D4:1.5 r:.5 | "
            "D4:.5 G4:.5 B4:.75 A4:.25 | G4:1 B4:.5 D5:.5 | E5:.75 D5:.25 C5:.5 E5:.5 | D5:1 B4:1 | "
            "C5:.5 A4:.5 B4:.5 G4:.5 | A4:.5 F#4:.5 G4:.5 A4:.5 | B4:.5 D5:.5 A4:.5 F#4:.5 | G4:1.5 r:.5 |")
MARCHE_A_GRILLE = "G | G | C | D | D | G | D | D | G | G | C | G | Am | D | G D | G"
MARCHE_TRIO_DEBUT = "E5:1 D5:.5 C5:.5 | B4:.5 C5:.5 D5:1 | C5:.5 B4:.5 A4:.5 G4:.5 | A4:1.5 r:.5 | " \
                    "E5:1 D5:.5 C5:.5 | B4:.5 A4:.5 G4:1 | "
MARCHE_TRIO_1 = MARCHE_TRIO_DEBUT + "A4:.5 C5:.5 B4:.5 A4:.5 | G4:1.5 r:.5 |"
MARCHE_TRIO_2 = MARCHE_TRIO_DEBUT + "A4:.5 F#4:.5 D4:.5 F#4:.5 | A4:1 r:1 |"
# Les relances du trombone, dans les mesures où le bugle se pose (4, 8, 12, 16 de chaque A).
# La dernière part un temps avant le motif: « le trombone a un temps d'avance ».
MARCHE_RELANCES = {3: "r:.5 F#3:.5 A3:.5 C4:.5", 7: "r:.5 D3:.5 E3:.5 F#3:.5", 11: "r:1 G3:.5 B3:.5",
                   15: "r:.5 D3:.5 G3:.5 B3:.5"}


def air_marche_de_la_halte() -> tuple[Morceau, dict]:
    """Marche de la halte: A au bugle seul, A avec le trombone, trio à la clarinette, A en tutti.
    2/4 à 120, 64 mesures, 64 s."""
    tempo, tpm = 120.0, 2.0
    texte_grille = " | ".join([MARCHE_A_GRILLE, MARCHE_A_GRILLE, "C | G | Am | D | C | Em | Am | G",
                               "C | G | Am | D | C | Em | D | D", MARCHE_A_GRILLE])
    acc = grille(texte_grille, 0.0, tpm)
    a1 = mesures_de(MARCHE_A, tpm, 0, vel=70)
    a2 = mesures_de(MARCHE_A, tpm, 16 * tpm, vel=74)
    trio = mesures_de(MARCHE_TRIO_1, tpm, 32 * tpm, vel=64) + mesures_de(MARCHE_TRIO_2, tpm, 40 * tpm, vel=66)
    a3 = mesures_de(MARCHE_A, tpm, 48 * tpm, vel=80)
    tuba = ligne_basse(acc, [0, 1], vel=64, bas=38, haut=50, duree=0.45)
    tuba = [n for n in tuba if not 32 * tpm <= n.t < 48 * tpm or n.t % tpm < 1e-6]  # trio: un temps sur deux
    cors = accords_frappes(acc, [0.5, 1.5], vel=50, nb=3, bas=55, haut=67, duree=0.25)
    cors = [Note(n.t, n.d, n.p, n.v - (8 if 32 * tpm <= n.t < 48 * tpm else 0)) for n in cors]
    trombone: list[Note] = []
    for debut in (16, 48):
        for k, texte in MARCHE_RELANCES.items():
            trombone += mesures_de(texte, tpm, (debut + k) * tpm, vel=66, legato=0.9)
    tenues = contrechant([a for a in acc if 16 * tpm <= a.t < 32 * tpm or a.t >= 48 * tpm], 50, 60, vel=50)
    trombone += [n for n in tenues if int(n.t // tpm) % 16 not in MARCHE_RELANCES]
    glock = decaler(a3, transpo=24, dv=-30)
    clarinette = trio + decaler(a3, transpo=12, dv=-22)
    coups: list[tuple[float, int, int]] = []
    for mes in range(64):
        t0 = mes * tpm
        fort = mes >= 48
        coups += [(t0, GROSSE_CAISSE, 50 if fort else 40), (t0 + 1, CAISSE_CLAIRE, 40 if fort else 30),
                  (t0 + 1.75, CAISSE_CLAIRE, 22)]
        if 32 <= mes < 48:
            coups = coups[:-2]  # trio: la grosse caisse seule
    coups += [(48 * tpm, CYMBALE, 46), (16 * tpm, CYMBALE, 34)]
    for mes in (31, 47, 63):  # roulement qui relance la section suivante (et la boucle)
        coups += [(mes * tpm + 1 + k * 0.25, CAISSE_CLAIRE, 26 + 6 * k) for k in range(4)]
    pistes = [
        Piste("tuba", TUBA, humain(tuba, 301, tempo, 0.006), -5, pan=62, reverbe=0.15),
        Piste("cors", CORS, humain(cors, 302, tempo, 0.008), -9, pan=48, reverbe=0.25, passe_haut=150),
        Piste("batterie", BATTERIE, percu(coups, 0.15), -11, pan=64, reverbe=0.15, percussions=True),
        Piste("bugle", TROMPETTE, humain(a1 + a2 + a3, 303, tempo, 0.01), 0, pan=70, reverbe=0.3, souffle=True),
        Piste("trombone", TROMBONE, humain(trombone, 304, tempo, 0.01), -5, pan=54, reverbe=0.25, souffle=True),
        Piste("clarinette", CLARINETTE, humain(clarinette, 305, tempo, 0.01), -3, pan=78, reverbe=0.3,
              souffle=True),
        Piste("glock", GLOCK, humain(glock, 306, tempo, 0.008), -10, pan=84, reverbe=0.4),
    ]
    m = _morceau("air-marche-de-la-halte", "Marche de la halte", tempo, (2, 4), tpm, 64, pistes, acc, 1.4, 301)
    return m, {"fond": ["tuba", "cors", "batterie"], "air": ["bugle", "trombone", "clarinette", "glock"]}


# --- 2. Valse de la minute ------------------------------------------------------------------

VALSE_A = ("B4:2 D5:1 | G5:2 F#5:1 | E5:2 D5:1 | C5:3 | D5:2 C5:1 | B4:3 | A4:1.5 B4:.5 C5:1 | D5:2 r:1 | "
           "B4:2 D5:1 | G5:2 F#5:1 | E5:1.5 G5:.5 E5:1 | C5:2 E5:1 | D5:2 B4:1 | A4:1.5 C5:.5 E5:1 | "
           "F#5:1 E5:1 D5:1 | G5:2 r:1 |")
VALSE_A_GRILLE = "G | Gmaj7 | Em7 | Am7 | D7 | G | Am | D | G | Gmaj7 | Em7 | C | G | Am7 | D | G"
VALSE_B = ("B4:2 E5:1 | G5:2.5 F#5:.5 | E5:2 C5:1 | A4:3 | F#4:1 A4:1 D5:1 | C5:2 A4:1 | B4:1 D5:1 G5:1 | D5:3 | "
           "E5:2 C5:1 | D5:2 B4:1 | G4:1 B4:1 E5:1 | E5:2 C5:1 | D5:2 C5:1 | B4:2 G4:1 | A4:1.5 B4:.5 C5:1 | "
           "D5:2 r:1 |")
VALSE_B_GRILLE = "Em | Em | Am | Am | D | D7 | G | G | C | Bm7 | Em7 | Am7 | D7 | G | Am7 | D"


def air_valse_de_la_minute() -> tuple[Morceau, dict]:
    """Valse de la minute: l'accordéon, puis Ambroise qui siffle le pont pendant que la pendule bat,
    puis l'accordéon et la clarinette ensemble. 3/4 à 135, 48 mesures, 64 s."""
    tempo, tpm = 135.0, 3.0
    acc = grille(" | ".join([VALSE_A_GRILLE, VALSE_B_GRILLE, VALSE_A_GRILLE]), 0.0, tpm)
    a1 = mesures_de(VALSE_A, tpm, 0, vel=70)
    b = mesures_de(VALSE_B, tpm, 16 * tpm, vel=66)
    a2 = mesures_de(VALSE_A, tpm, 32 * tpm, vel=72)
    basse = ligne_basse(acc, [0], vel=68, bas=38, haut=52, duree=0.8, quintes=False)
    pah = accords_frappes(acc, [1, 2], vel=42, nb=3, bas=55, haut=67, duree=0.3)
    soufflet = accords_frappes([a for a in acc if 16 * tpm <= a.t < 32 * tpm], [1, 2], vel=40, nb=3, bas=57,
                               haut=69, duree=0.45)
    cl = tierce_dessous(a2, SOL_MAJEUR, 2, dv=-16, accords=acc)
    pendule = [Note(t * 1.0, 0.1, BOIS_GRAVE if k % 2 else 76, 22) for k, t in
               enumerate(range(int(16 * tpm), int(32 * tpm)))]
    sifflet = b + decaler(entre(a2, 40 * tpm, 48 * tpm), dv=-10)
    pistes = [
        Piste("basse", CONTREBASSE_PIZZ, humain(basse, 311, tempo, 0.006), -4, pan=62, reverbe=0.15),
        Piste("guitare", GUITARE, humain(pah, 312, tempo, 0.008), -6, pan=46, reverbe=0.2),
        Piste("pendule", BATTERIE, pendule, -20, pan=40, reverbe=0.3, percussions=True),
        Piste("accordeon", ACCORDEON, humain(a1 + decaler(soufflet, dv=0) + a2, 313, tempo, 0.012), 0, pan=76,
              reverbe=0.3, souffle=True),
        Piste("sifflet", SIFFLET, humain(sifflet, 314, tempo, 0.014), -4, pan=58, reverbe=0.35, souffle=True),
        Piste("clarinette", CLARINETTE, humain(cl, 315, tempo, 0.012), -7, pan=54, reverbe=0.3, souffle=True),
    ]
    # Le soufflet de l'accordéon (accords du pont) partage la piste de la mélodie: même instrument.
    m = _morceau("air-valse-de-la-minute", "Valse de la minute", tempo, (3, 4), tpm, 48, pistes, acc, 1.8, 311)
    return m, {"fond": ["basse", "guitare", "pendule"], "air": ["accordeon", "sifflet", "clarinette"]}


# --- 3. Carillon des deux sœurs -------------------------------------------------------------

COMPLAINTE = ("B4:1.5 A4:.5 G4:1 E4:1 | A4:1.5 B4:.5 C5:2 | D5:1.5 C5:.5 A4:1 F#4:1 | G4:3 r:1 | "
              "E5:1.5 D5:.5 C5:1 G4:1 | A4:1 C5:1 E5:2 | D5:1.5 C5:.5 B4:1 A4:1 | B4:1 G4:1 E4:2 |")
COMPLAINTE_GRILLE = "Em | Am | D | G | C | Am | Bm7 D | Em"
CARILLON_GRILLE = "G | C | G | D | Em | C | Am D | Em"


def air_carillon_des_deux_soeurs() -> tuple[Morceau, dict]:
    """Carillon des deux sœurs: la complainte de la Fêlée à la clarinette (mi mineur doux), puis
    les deux cloches sonnent ensemble, juste, en sol. 4/4 à 60, 16 mesures, 64 s."""
    tempo, tpm = 60.0, 4.0
    acc = grille(COMPLAINTE_GRILLE + " | " + CARILLON_GRILLE, 0.0, tpm)
    complainte = mesures_de(COMPLAINTE, tpm, 0, vel=60, legato=0.98)
    harpe = dans_accords(arpege(acc, [(0, 0, 3.8), (0.5, 1, 1.4), (1, 2, 1.4), (1.5, 3, 1.4), (2, 2, 1.8),
                                      (3, 1, 0.95)], vel=40, bas=40, haut_v=(55, 69), nb=3), acc)
    basse = dans_accords(ligne_basse(acc, [0], vel=42, bas=38, haut=52, duree=3.9, quintes=False), acc)
    seconde = [a for a in acc if a.t >= 8 * tpm]
    tenue = contrechant(seconde, 60, 72, vel=42)
    boite = arpege(seconde, [(0, 1, 0.9), (1, 2, 0.9), (2, 3, 0.9), (3, 2, 0.9)], vel=40, bas=40,
                   haut_v=(76, 91), nb=3, periode=4.0)
    # La grande sœur (sol 4) au premier temps, la Fêlée refondue (ré 5) qui lui répond, juste.
    cloches = [Note(0.0, 3.0, 67, 34)]
    for mes in range(8, 16):
        if mes % 2 == 0:
            cloches.append(Note(mes * tpm, 2.0, 67, 52))
        cloches.append(Note(mes * tpm + 2.0, 1.8, 74, 46 if mes < 15 else 38))
    pistes = [
        Piste("harpe", HARPE, humain(harpe, 321, tempo, 0.02), -3, pan=50, reverbe=0.5),
        Piste("basse", CONTREBASSE_ARCO, basse, -8, pan=64, reverbe=0.35, souffle=True),
        Piste("boite", BOITE_A_MUSIQUE, humain(boite, 322, tempo, 0.015), -9, pan=80, reverbe=0.55),
        Piste("clarinette", CLARINETTE, humain(complainte + tenue, 323, tempo, 0.02), 0, pan=60, reverbe=0.5,
              souffle=True),
        Piste("cloches", CLOCHES, cloches, -5, pan=72, reverbe=0.6),
    ]
    m = _morceau("air-carillon-des-deux-soeurs", "Carillon des deux soeurs", tempo, (4, 4), tpm, 16, pistes, acc,
                 3.0, 321)
    return m, {"fond": ["harpe", "basse", "boite"], "air": ["clarinette", "cloches"]}


# --- 4. Chanson des marmites ----------------------------------------------------------------

BERCEUSE_A = ("B4:2 G4:1 | A4:2 F#4:1 | G4:1 B4:1 D5:1 | E5:2 C5:1 | D5:2 B4:1 | C5:1.5 B4:.5 A4:1 | "
              "F#4:1 A4:1 C5:1 | G4:3 |")
BERCEUSE_A_GRILLE = "G | D | G | C | G | Am | D7 | G"
BERCEUSE_B = "E5:1 G5:1 E5:1 | D5:2 B4:1 | C5:1 E5:1 C5:1 | A4:3 | E5:1 G5:1 E5:1 | D5:1 B4:1 G4:1 | " \
             "A4:1 C5:1 E5:1 | D5:3 |"
BERCEUSE_B_GRILLE = "C | G | Am | D | C | G | Am7 | D7"


def air_chanson_des_marmites() -> tuple[Morceau, dict]:
    """Chanson des marmites: la berceuse d'Honorine à la boîte à musique; le bourg la reprend à
    l'accordéon et à la clarinette en tapant sur les couvercles, puis elle redevient berceuse.
    3/4 à 100, 40 mesures (A A B A A), 72 s."""
    tempo, tpm = 100.0, 3.0
    acc = grille(" | ".join([BERCEUSE_A_GRILLE, BERCEUSE_A_GRILLE, BERCEUSE_B_GRILLE, BERCEUSE_A_GRILLE,
                             BERCEUSE_A_GRILLE]), 0.0, tpm)
    a = [mesures_de(BERCEUSE_A, tpm, k * 8 * tpm, vel=v) for k, v in ((0, 58), (1, 62), (3, 70), (4, 54))]
    b = mesures_de(BERCEUSE_B, tpm, 16 * tpm, vel=70)
    boite = decaler(a[0] + a[1], transpo=12) + decaler(a[2], transpo=12, dv=-14) + decaler(a[3], transpo=12)
    accordeon = b + a[2]
    accomp_acc = accords_frappes([x for x in acc if 8 * tpm <= x.t < 16 * tpm], [1, 2], vel=36, nb=3, bas=55,
                                 haut=67, duree=0.5)
    accordeon += accomp_acc
    cl = tierce_dessous(a[1], SOL_MAJEUR, 2, dv=-14, accords=acc) + decaler(a[2], dv=-10)
    basse = ligne_basse(acc, [0], vel=50, bas=38, haut=52, duree=2.6, quintes=False)
    basse = [Note(n.t, n.d, n.p, n.v + (12 if 16 * tpm <= n.t < 32 * tpm else 0)) for n in basse]
    guitare = accords_frappes([x for x in acc if 16 * tpm <= x.t < 32 * tpm], [1, 2], vel=44, nb=3, bas=55,
                              haut=67, duree=0.3)
    couvercles: list[tuple[float, int, int]] = []
    for mes in range(16, 32):
        t0 = mes * tpm
        couvercles += [(t0, TOM_GRAVE, 38), (t0 + 1, CLOCHE_RIDE, 34), (t0 + 2, CLOCHE_RIDE, 30)]
        if mes % 2 == 1:
            couvercles.append((t0 + 2.5, CHARLESTON, 26))
    pistes = [
        Piste("basse", CONTREBASSE_PIZZ, humain(basse, 331, tempo, 0.006), -5, pan=62, reverbe=0.2),
        Piste("guitare", GUITARE, humain(guitare, 332, tempo, 0.008), -7, pan=46, reverbe=0.25),
        Piste("couvercles", BATTERIE, percu(couvercles, 0.2), -12, pan=40, reverbe=0.3, percussions=True),
        Piste("boite", BOITE_A_MUSIQUE, humain(boite, 333, tempo, 0.012), -1, pan=72, reverbe=0.45),
        Piste("accordeon", ACCORDEON, humain(accordeon, 334, tempo, 0.012), 0, pan=80, reverbe=0.3, souffle=True),
        Piste("clarinette", CLARINETTE, humain(cl, 335, tempo, 0.012), -5, pan=56, reverbe=0.35, souffle=True),
    ]
    m = _morceau("air-chanson-des-marmites", "Chanson des marmites", tempo, (3, 4), tpm, 40, pistes, acc, 1.8,
                 331)
    return m, {"fond": ["basse", "guitare", "couvercles"], "air": ["boite", "accordeon", "clarinette"]}


# --- 5. Canon de la répétition --------------------------------------------------------------

CANON_THEME = ("G4:2 B4:2 | A4:2 F#4:2 | D5:1 B4:1 G4:1 B4:1 | A4:1 D5:1 C5:1 A4:1 | "
               "G5:.5 F#5:.5 G5:.5 D5:.5 B4:.5 D5:.5 G4:.5 r:.5 | F#4:.5 A4:.5 D5:.5 A4:.5 F#4:.5 A4:.5 D4:1 | "
               "r:1 G4:.5 G4:.5 r:1 B4:.5 B4:.5 | r:1 A4:.5 A4:.5 D4:2 |")
CANON_GRILLE = "G | D7 | Em7 | D7 | Cmaj7 | D7 | G | D7"


def air_canon_de_la_repetition() -> tuple[Morceau, dict]:
    """Canon de la répétition: une ritournelle de huit mesures sur une grille qui revient toutes les
    deux mesures; le basson part, la clarinette deux mesures après, les pizzicati encore deux après
    (« personne ne partait ensemble »); chacun s'arrête à son tour, le guiro fait les grenouilles.
    4/4 à 120, 32 mesures, 64 s."""
    tempo, tpm = 120.0, 4.0
    acc = grille(" | ".join([CANON_GRILLE] * 4), 0.0, tpm)
    staccato = 0.7

    def voix(depart: int, transpo: int, vel: int) -> list[Note]:
        return [n for k in range(3) for n in
                mesures_de(CANON_THEME, tpm, (depart + 8 * k) * tpm, vel=vel, legato=staccato, transpo=transpo)]

    basson = voix(0, -12, 72) + mesures_de("r:1 G4:.5 G4:.5 r:1 B4:.5 B4:.5 | r:1 A4:.5 A4:.5 D4:2 |", tpm,
                                           30 * tpm, vel=64, legato=staccato, transpo=-12)
    clarinette = voix(2, 0, 62)
    pizz = voix(4, 12, 58)
    basse = ligne_basse(acc, [0, 2], vel=62, bas=38, haut=52, duree=0.5)
    pah = accords_frappes(acc, [1, 3], vel=36, nb=3, bas=55, haut=67, duree=0.3)
    grenouilles: list[tuple[float, int, int]] = []
    for mes in range(32):
        if mes % 2 == 1:
            grenouilles.append((mes * tpm + 3.5, GUIRO_COURT, 34 + (mes % 3) * 4))
        if mes % 8 == 7:
            grenouilles.append((mes * tpm + 1.5, GUIRO_LONG, 30))
    pistes = [
        Piste("basse", CONTREBASSE_PIZZ, humain(basse, 341, tempo, 0.006), -5, pan=62, reverbe=0.15),
        Piste("pah", PIZZICATI, humain(pah, 342, tempo, 0.008), -10, pan=46, reverbe=0.2),
        Piste("grenouilles", BATTERIE, percu(grenouilles, 0.3), -14, pan=30, reverbe=0.35, percussions=True),
        Piste("basson", BASSON, humain(basson, 343, tempo, 0.01), 0, pan=52, reverbe=0.25, souffle=True),
        Piste("clarinette", CLARINETTE, humain(clarinette, 344, tempo, 0.01), -2, pan=76, reverbe=0.25,
              souffle=True),
        Piste("pizzicati", PIZZICATI, humain(pizz, 345, tempo, 0.008), -4, pan=88, reverbe=0.3),
    ]
    m = _morceau("air-canon-de-la-repetition", "Canon de la répétition", tempo, (4, 4), tpm, 32, pistes, acc,
                 1.4, 341)
    return m, {"fond": ["basse", "pah", "grenouilles"], "air": ["basson", "clarinette", "pizzicati"]}


# --- 6. Chant de la coupe -------------------------------------------------------------------

COUPE_1 = ("A3:1 D4:1 F#4:1.5 E4:.5 | D4:3 r:1 | A3:.5 B3:.5 D4:1 C4:1 A3:1 | D4:3 r:1 | "
           "B3:1 D4:1 G4:1.5 F#4:.5 | E4:1 D4:1 B3:2 | A3:1 D4:1 F#4:1 A4:1 | F#4:3 r:1 | "
           "G4:1.5 E4:.5 C4:1 A3:1 | G4:1 F#4:.5 E4:.5 D4:2 | C4:1 A3:1 D4:2 | r:1 A3:1 C4:1 E4:1 |")
COUPE_GRILLE = "D7 | D7 | D7 | D7 | G | G | D7 | D7 | Am7 | G | D7 | Am7"
COUPE_APPELS = {12: "D4:.5 E4:.5 F#4:1 A4:1.5 F#4:.5 | E4:1 D4:1 r:2 |",
                16: "G3:1 B3:1 D4:1.5 E4:.5 | D4:1 B3:1 r:2 |",
                20: "E4:1 C4:1 A3:1 G3:1 | B3:1 D4:1 G4:2 |"}
COUPE_REPONSES = {14: "r:1 A4:.5 C5:.5 D5:1 F#5:1 | E5:.5 D5:.5 C5:1 A4:2 |",
                  18: "r:1 F#5:.5 E5:.5 D5:1 A4:1 | C5:1 A4:1 F#4:2 |",
                  22: "A4:.5 C5:.5 D5:1 F#5:2 | E5:1 C5:1 A4:2 |"}


def air_chant_de_la_coupe() -> tuple[Morceau, dict]:
    """Chant de la coupe: un blues gentil en ré mixolydien (le do naturel est la seule couleur
    bleue, aucune note hors de sol majeur), trombone, puis appel et réponse avec la clarinette;
    contrebasse qui marche, brosses, un coup de bois par mesure pour la hache. 4/4 à 90 en
    balancement, 24 mesures (deux grilles de douze), 64 s."""
    tempo, tpm = 90.0, 4.0
    acc = grille(COUPE_GRILLE + " | " + COUPE_GRILLE, 0.0, tpm)
    trombone = mesures_de(COUPE_1, tpm, 0, vel=72, legato=0.92)
    clarinette: list[Note] = []
    for mes, texte in COUPE_APPELS.items():
        trombone += mesures_de(texte, tpm, mes * tpm, vel=74, legato=0.92)
    for mes, texte in COUPE_REPONSES.items():
        clarinette += mesures_de(texte, tpm, mes * tpm, vel=64, legato=0.94)
    basse = ligne_basse(acc, [0, 1, 2, 3], vel=64, bas=38, haut=52, duree=0.85)
    piano = accords_frappes(acc, [1.5, 3.5], vel=38, nb=3, bas=55, haut=69, duree=0.3)
    coups: list[tuple[float, int, int]] = []
    for mes in range(24):
        t0 = mes * tpm
        coups += [(t0, BOIS_GRAVE, 40), (t0 + 1, CAISSE_CLAIRE, 34), (t0 + 3, CAISSE_CLAIRE, 34)]
        coups += [(t0 + k * 0.5, CHARLESTON, 22 if k % 2 else 28) for k in range(8)]
    pistes = [
        Piste("basse", CONTREBASSE_PIZZ, humain(balancer(basse), 351, tempo, 0.006), -3, pan=60, reverbe=0.15),
        Piste("piano", PIANO, humain(balancer(piano), 352, tempo, 0.008), -9, pan=44, reverbe=0.25, passe_haut=160),
        Piste("brosses", BROSSES, balancer(percu(coups, 0.15)), -10, pan=64, reverbe=0.15, percussions=True,
              passe_haut=100),
        Piste("trombone", TROMBONE, humain(balancer(trombone), 353, tempo, 0.012), 0, pan=70, reverbe=0.3,
              souffle=True),
        Piste("clarinette", CLARINETTE, humain(balancer(clarinette), 354, tempo, 0.012), -2, pan=54, reverbe=0.3,
              souffle=True),
    ]
    m = _morceau("air-chant-de-la-coupe", "Chant de la coupe", tempo, (4, 4), tpm, 24, pistes, acc, 1.3, 351)
    return m, {"fond": ["basse", "piano", "brosses"], "air": ["trombone", "clarinette"]}


# --- 7. Le sifflet du samedi ----------------------------------------------------------------

DRAISINE = ("D5:.5 D5:.5 B4:2 | G4:1 A4:.5 B4:1 G4:.5 | E5:.5 E5:.5 C5:2 | A4:1 B4:.5 C5:1 A4:.5 | "
            "B4:1 D5:.5 G5:1 D5:.5 | E5:1 D5:.5 B4:1.5 | C5:1 B4:.5 A4:1 G4:.5 | F#4:1.5 A4:1.5 | "
            "D5:.5 D5:.5 B4:2 | G4:1 A4:.5 B4:1 D5:.5 | E5:.5 E5:.5 G5:2 | F#5:1 E5:.5 D5:1.5 | "
            "E5:1 C5:.5 A4:1 C5:.5 | B4:1.5 D5:1.5 | A4:1 B4:.5 A4:1 F#4:.5 | G4:3 | "
            "B4:1 E5:.5 G5:1 E5:.5 | F#5:.5 E5:.5 D5:.5 B4:1.5 | C5:1 E5:.5 G5:1 E5:.5 | D5:.5 C5:.5 B4:.5 G4:1.5 | "
            "B4:1 D5:.5 G5:1.5 | E5:1 C5:.5 A4:1.5 | D5:1 A4:.5 F#4:1 A4:.5 | D5:.5 D5:.5 A4:2 |")
DRAISINE_GRILLE = ("G | G | C | D7 | G | Em | Am | D | G | G | C | D | C | G | D | G | "
                   "Em | Em | C | C | G | Am7 | D | D")


def air_sifflet_du_samedi() -> tuple[Morceau, dict]:
    """Le sifflet du samedi: la chanson de la draisine, en 6/8 qui roule (guitare en arpèges,
    contrebasse, brosses sur les éclisses). Elle commence par deux notes brèves et une longue, que le
    sifflet double comme Rosalie annonce le train. Accordéon, puis clarinette avec l'accordéon en
    tierce. 6/8 à 135 (noires), 48 mesures, 64 s."""
    tempo, tpm = 135.0, 3.0
    acc = grille(DRAISINE_GRILLE + " | " + DRAISINE_GRILLE, 0.0, tpm)
    pas1 = mesures_de(DRAISINE, tpm, 0, vel=68)
    pas2 = mesures_de(DRAISINE, tpm, 24 * tpm, vel=70)
    harm = tierce_dessous(pas2, SOL_MAJEUR, 2, dv=-16, accords=acc)
    guitare = arpege(acc, [(0, 0, 1.4), (0.5, 1, 0.5), (1, 2, 0.5), (1.5, -1, 1.4), (2, 3, 0.5), (2.5, 2, 0.5)],
                     vel=54, bas=40, haut_v=(55, 71), nb=3, periode=3.0)
    basse = ligne_basse(acc, [0, 1.5], vel=64, bas=38, haut=52, duree=1.2)
    sifflet = [n for debut in (0, 8, 24, 32) for n in decaler(entre(pas1 + pas2, debut * tpm, (debut + 1) * tpm),
                                                               transpo=12, dv=-18)]
    eclats = accords_frappes([a for a in acc if a.t >= 24 * tpm], [1.5], vel=32, nb=1, bas=79, haut=93, duree=0.6)
    rails: list[Note] = []
    for mes in range(48):
        t0 = mes * tpm
        rails += [Note(t0 + k * 0.5, 0.15, CAISSE_CLAIRE, 40 if k in (0, 3) else 24) for k in range(6)]
        if mes % 2 == 0:
            rails.append(Note(t0, 0.2, GROSSE_CAISSE, 36))
    pistes = [
        Piste("guitare", GUITARE, humain(guitare, 361, tempo), -1, pan=48, reverbe=0.25),
        Piste("basse", CONTREBASSE_PIZZ, humain(basse, 362, tempo, 0.006), -4, pan=62, reverbe=0.15),
        Piste("rails", BROSSES, rails, -11, pan=64, reverbe=0.1, percussions=True, passe_haut=120),
        Piste("accordeon", ACCORDEON, humain(pas1 + harm, 363, tempo, 0.01), 0, pan=78, reverbe=0.3, souffle=True),
        Piste("clarinette", CLARINETTE, humain(pas2, 364, tempo, 0.01), -1, pan=56, reverbe=0.3, souffle=True),
        Piste("sifflet", SIFFLET, sifflet, -10, pan=86, reverbe=0.5),
        Piste("glock", GLOCK, humain(eclats, 365, tempo, 0.01), -10, pan=84, reverbe=0.45),
    ]
    m = _morceau("air-sifflet-du-samedi", "Le sifflet du samedi", tempo, (6, 8), tpm, 48, pistes, acc, 1.4, 361)
    return m, {"fond": ["guitare", "basse", "rails"], "air": ["accordeon", "clarinette", "sifflet", "glock"]}


# --- 8. Sonnerie de 5 h 12 ------------------------------------------------------------------

CHORAL = ("D4:2 G4:2 | B4:2 A4:2 | G4:2 B4:2 | D5:4 | E5:2 D5:2 | C5:2 B4:2 | A4:2 B4:1 A4:1 | G4:4 | "
          "B4:2 C5:2 | D5:2 E5:2 | D5:2 C5:2 | A4:4 | D4:2 G4:2 | B4:3 A4:1 | G4:2 A4:2 | G4:4 |")
CHORAL_GRILLE = ("G Em | G D | Em G | D | C G | Am Em | D | G | G Am | Bm7 C | G Am | D | G Em | G D | C D | G")


def voix_interieures(soprano: list[Note], accords: list[Accord], bas: int = 47) -> list[Note]:
    """Alto et ténor du choral: deux notes de l'accord sous le soprano, conduites au plus près."""
    sortie: list[Note] = []
    prec: list[int] | None = None
    for a in accords:
        dessus = min((n.p for n in soprano if a.t - 1e-6 <= n.t < a.t + a.d - 1e-6 or
                      n.t < a.t < n.t + n.d - 1e-6), default=72)
        v = voicing(a, prec, 2, bas, dessus - 3)
        prec = v
        sortie += [Note(a.t, a.d * 0.98, p, 46) for p in v]
    return sortie


def air_sonnerie_de_5h12() -> tuple[Morceau, dict]:
    """Sonnerie de 5 h 12: l'hymne de la ligne, le motif du quai (ré, sol, si, la, sol) en choral à
    quatre voix, quatre phrases de quatre mesures: harmonium seul, puis le cor, puis le chœur, puis
    tous. La cloche (sol et sa tierce) ouvre la première et la troisième phrase; un sifflet lointain
    tient la note des demi-cadences. 4/4 à 60, 16 mesures, 64 s."""
    tempo, tpm = 60.0, 4.0
    acc = grille(CHORAL_GRILLE, 0.0, tpm)
    soprano = mesures_de(CHORAL, tpm, 0, vel=60, legato=0.97)
    interieures = voix_interieures(soprano, acc)
    basse: list[Note] = []
    prec = None
    for a in acc:
        p = basse_de(a, prec, 38, 52)
        prec = p
        basse.append(Note(a.t, a.d * 0.97, p, 50))
    phrase = lambda k: entre(soprano, 4 * k * tpm, 4 * (k + 1) * tpm)  # noqa: E731
    orgue_dessus = phrase(0) + decaler(phrase(2), dv=-12)
    cor = decaler(phrase(1), dv=2) + decaler(phrase(3), dv=4)
    choeur = decaler(phrase(2), dv=-4) + decaler(phrase(3), dv=-10)
    cloches = [Note(0.0, 3.0, 67, 46), Note(0.0, 3.0, 71, 38), Note(8 * tpm, 1.9, 67, 40), Note(8 * tpm, 1.9, 71, 32),
               Note(12 * tpm, 3.0, 67, 34)]
    sifflet = [Note(3 * tpm + 0.5, 3.0, 74, 34), Note(11 * tpm + 0.5, 3.0, 69, 30)]
    pistes = [
        Piste("orgue", ORGUE_A_ANCHES, interieures, -4, pan=56, reverbe=0.45, souffle=True),
        Piste("basse", CONTREBASSE_ARCO, basse, -6, pan=64, reverbe=0.35, souffle=True),
        Piste("orgue-dessus", ORGUE_A_ANCHES, orgue_dessus, -2, pan=60, reverbe=0.45, souffle=True),
        Piste("cor", CORS, humain(cor, 381, tempo, 0.015), 0, pan=70, reverbe=0.5, souffle=True),
        Piste("choeur", CHOEUR, choeur, -3, pan=50, reverbe=0.55, souffle=True),
        Piste("cloche", CLOCHES, cloches, -6, pan=76, reverbe=0.7),
        Piste("sifflet", SIFFLET, sifflet, -14, pan=90, reverbe=0.8, souffle=True),
    ]
    m = _morceau("air-sonnerie-de-5h12", "Sonnerie de 5 h 12", tempo, (4, 4), tpm, 16, pistes, acc, 3.2, 381)
    return m, {"fond": ["orgue", "basse"], "air": ["orgue-dessus", "cor", "choeur", "cloche", "sifflet"]}


AIRS = [air_marche_de_la_halte, air_valse_de_la_minute, air_carillon_des_deux_soeurs, air_chanson_des_marmites,
        air_canon_de_la_repetition, air_chant_de_la_coupe, air_sifflet_du_samedi, air_sonnerie_de_5h12]
