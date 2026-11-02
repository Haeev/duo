"""Les musiques de La Petite Ligne, écrites en données.

Couleur du jeu: champêtre et acoustique (guitare nylon, flûte, hautbois, clarinette, basson,
accordéon, harpe, cordes en pizzicato). Tonalités majeures, aucune tension: pas d'accord
diminué tenu, pas de mineur sombre, des cadences toujours résolues.

Le motif de la Halte (la sixte qui descend en balançant: si, la, sol, ré) est le fil du jeu:
thème du jour (matin et après-midi), écran titre (en ré, comme le salon de Duo, pour un passage
en douceur de la plateforme au jeu), air de fin. Le sifflet du train sonne la même sixte.

Toutes les boucles ont une durée entière en secondes: nombre entier d'échantillons à 48 kHz
comme à 44,1 kHz (contexte audio réglé sur l'une ou l'autre fréquence).
"""

from __future__ import annotations

import numpy as np

from partition import (Morceau, Note, Piste, arpege, accords_frappes, contrechant, decaler, grille,
                       humaniser, ligne_basse, mel, nappe, tierce_dessous)

SOL_MAJEUR = [7, 9, 11, 0, 2, 4, 6]
RE_MAJEUR = [2, 4, 6, 7, 9, 11, 1]

# Programmes General MIDI (numérotés à partir de 0).
PIANO, CELESTA, GLOCK, MARIMBA = 0, 8, 9, 12
ACCORDEON = 21
GUITARE_NYLON, GUITARE_ACIER = 24, 25
CONTREBASSE = 32
VIOLON, VIOLONCELLE, PIZZ, HARPE, TIMBALES = 40, 42, 45, 46, 47
CORDES, CORDES_LENTES = 48, 49
TROMPETTE, TUBA, COR = 56, 58, 60
HAUTBOIS, BASSON, CLARINETTE = 68, 70, 71
FLUTE, FLUTE_A_BEC = 73, 74


def _rng(graine: int) -> np.random.Generator:
    return np.random.default_rng(graine)


# --- Le thème de la Halte (sol majeur, 6/8) ---------------------------------------------

M68 = 3.0  # une mesure à 6/8 = trois noires

HALTE_A = ("B4:1 A4:.5 G4:1 D4:.5 | E4:1 G4:.5 B4:1.5 | C5:1 B4:.5 A4:1 G4:.5 | "
           "A4:1.5 F#4:.5 G4:.5 A4:.5 | B4:1 A4:.5 G4:1 D4:.5 | E4:1 G4:.5 B4:1 E5:.5 | "
           "C5:1 B4:.5 A4:1 F#4:.5 |")
HALTE_FIN_A = "G4:2.5 r:.5 |"
HALTE_VERS_B = "G4:1.5 B4:.5 C5:.5 D5:.5 |"
HALTE_B = ("E5:1.5 D5:.5 C5:.5 D5:.5 | D5:1.5 B4:1.5 | C5:1 B4:.5 A4:1 B4:.5 | "
           "G4:1.5 B4:.5 A4:.5 G4:.5 | A4:1 G4:.5 A4:1 C5:.5 | C5:1 D5:.5 E5:1.5 | "
           "E5:1.5 D5:.5 C5:.5 B4:.5 | A4:1.5 F#4:.5 G4:.5 A4:.5 |")
HALTE_C = ("B4:1.5 G4:1.5 | E4:3 | D5:1.5 B4:1.5 | A4:3 | G4:1 A4:.5 B4:1.5 | "
           "C5:1 B4:.5 G4:1.5 | A4:1.5 C5:1.5 | F#4:1.5 A4:1.5 |")

G_INTRO = "G | Em | C | D"
G_A = "G | Em | C | D | G | Em | Am7 D7 | G"
G_B = "C | G/B | Am | Em | F | C | Am7 | D"
G_C = "Em | C | G | D | Em | C | Am7 | D7"
G_OUTRO = "G | C | Am7 | D7"

# Plan: intro 4, A 8, A' 8, B 8, A'' 8, C 8, outro 4 = 48 mesures de 2 s = 96 s.
HALTE_PLAN = [("intro", 0, 4), ("A", 4, 8), ("A2", 12, 8), ("B", 20, 8), ("A3", 28, 8), ("C", 36, 8),
              ("outro", 44, 4)]


def _debut(section: str) -> float:
    for nom, mesure, _ in HALTE_PLAN:
        if nom == section:
            return mesure * M68
    raise KeyError(section)


def _grille_halte() -> list:
    acc = []
    for nom, txt in (("intro", G_INTRO), ("A", G_A), ("A2", G_A), ("B", G_B), ("A3", G_A), ("C", G_C),
                     ("outro", G_OUTRO)):
        acc += grille(txt, _debut(nom), M68)
    return acc


def _melodie_halte(vel: int = 84, transpo: int = 0) -> dict[str, list[Note]]:
    m = {}
    m["A"] = mel(HALTE_A + " " + HALTE_FIN_A, _debut("A"), vel, M68, transpo=transpo)
    m["A2"] = mel(HALTE_A + " " + HALTE_VERS_B, _debut("A2"), vel, M68, transpo=transpo)
    m["B"] = mel(HALTE_B, _debut("B"), vel, M68, transpo=transpo)
    m["A3"] = mel(HALTE_A + " " + HALTE_FIN_A, _debut("A3"), vel, M68, transpo=transpo)
    m["C"] = mel(HALTE_C, _debut("C"), vel - 6, M68, transpo=transpo)
    return m


def _filtrer(accords, debut_mesure: int, fin_mesure: int, mesure: float = M68):
    return [a for a in accords if debut_mesure * mesure - 1e-6 <= a.t < fin_mesure * mesure - 1e-6]


ARPEGE_68 = [(0.0, 0, 3.0), (0.5, 1, 1.2), (1.0, 2, 1.0), (1.5, 3, 1.5), (2.0, 2, 1.0), (2.5, 1, 0.6)]
ARPEGE_68_B = [(0.0, 0, 3.0), (0.5, 2, 1.0), (1.0, 3, 1.0), (1.5, -1, 1.5), (2.0, 3, 1.0), (2.5, 2, 0.6)]


def _harpe_roulee(accords, vel: int, bas: int, haut: int) -> list[Note]:
    """Accord arpégé très vite en début de mesure, puis laissé sonner (scintillement du matin)."""
    notes = []
    for n in nappe(accords, vel, 3, bas, haut):
        notes.append(n)
    # Décalage en « roulé »: chaque voix un peu après la précédente.
    par_t: dict[float, list[Note]] = {}
    for n in notes:
        par_t.setdefault(round(n.t, 4), []).append(n)
    sortie = []
    for t, groupe in par_t.items():
        for k, n in enumerate(sorted(groupe, key=lambda x: x.p)):
            sortie.append(Note(t + 0.09 * k, min(n.d, 2.6), n.p, n.v - 4 * k))
    return sortie


def halte_matin() -> Morceau:
    rng = _rng(11)
    acc = _grille_halte()
    melo = _melodie_halte()
    tempo = 90.0
    guitare = humaniser(arpege(acc, ARPEGE_68, vel=72, bas=40, haut_v=(52, 67)), rng, tempo=tempo)
    flute = melo["A"] + melo["A2"] + melo["A3"]
    hautbois = melo["B"] + decaler(melo["C"], transpo=0)
    pizz = ligne_basse(_filtrer(acc, 12, 48), [0.0, 1.5], vel=70, bas=36, haut=50, duree=0.6)
    harpe = _harpe_roulee(_filtrer(acc, 12, 20) + _filtrer(acc, 28, 36), vel=50, bas=67, haut=86)
    cordes = nappe(_filtrer(acc, 20, 28) + _filtrer(acc, 36, 44), vel=52, nb=4, bas=50, haut=71)
    flute_contre = contrechant(_filtrer(acc, 28, 36), 71, 83, vel=50, eviter=melo["A3"])
    return Morceau(
        accords=acc, id="halte-matin", titre="La Halte, le matin", tempo=tempo, signature=(6, 8), mesures=48,
        temps_par_mesure=M68, graine=1, rt60=1.6,
        pistes=[
            Piste("guitare", GUITARE_NYLON, guitare, sonie_lu=-5.0, pan=58, reverbe=0.22, passe_haut=70),
            Piste("flute", FLUTE, humaniser(flute, rng, 0.008, 4, tempo), sonie_lu=0.0, pan=70,
                  reverbe=0.30, souffle=True),
            Piste("hautbois", HAUTBOIS, humaniser(hautbois, rng, 0.008, 4, tempo), sonie_lu=-1.0, pan=52,
                  reverbe=0.30, souffle=True),
            Piste("pizz", PIZZ, humaniser(pizz, rng, tempo=tempo), sonie_lu=-8.0, pan=64, reverbe=0.18),
            Piste("harpe", HARPE, humaniser(harpe, rng, tempo=tempo), sonie_lu=-11.0, pan=84, reverbe=0.35),
            Piste("cordes", CORDES_LENTES, cordes, sonie_lu=-12.0, pan=64, reverbe=0.40, souffle=True,
                  passe_haut=90),
            Piste("flute2", FLUTE, flute_contre, sonie_lu=-9.0, pan=44, reverbe=0.35, souffle=True),
        ],
    )


def halte_apres_midi() -> Morceau:
    rng = _rng(12)
    acc = _grille_halte()
    melo = _melodie_halte(vel=80)
    tempo = 90.0
    guitare = humaniser(arpege(acc, ARPEGE_68_B, vel=70, bas=40, haut_v=(52, 67)), rng, tempo=tempo)
    clarinette = melo["A"] + melo["A2"] + melo["A3"]
    accordeon_mel = melo["B"]
    violoncelle = decaler(melo["C"], transpo=-12, dv=-4)
    accordeon_nappe = nappe(_filtrer(acc, 12, 20) + _filtrer(acc, 28, 36), vel=46, nb=3, bas=55, haut=69)
    basse = ligne_basse(_filtrer(acc, 12, 48), [0.0, 1.5], vel=72, bas=36, haut=50, duree=1.2)
    contre = contrechant(_filtrer(acc, 20, 28), 55, 67, vel=56, eviter=melo["B"])
    return Morceau(
        accords=acc, id="halte-apres-midi", titre="La Halte, l'après-midi", tempo=tempo, signature=(6, 8), mesures=48,
        temps_par_mesure=M68, graine=2, rt60=1.5, aigus_ir=0.4,
        pistes=[
            Piste("guitare", GUITARE_NYLON, guitare, sonie_lu=-5.0, pan=70, reverbe=0.22, passe_haut=70),
            Piste("clarinette", CLARINETTE, humaniser(clarinette, rng, 0.008, 4, tempo), sonie_lu=0.0, pan=56,
                  reverbe=0.28, souffle=True),
            Piste("accordeon", ACCORDEON, humaniser(accordeon_mel, rng, 0.008, 4, tempo), sonie_lu=-1.5,
                  pan=72, reverbe=0.28, souffle=True),
            Piste("accordeon_nappe", ACCORDEON, accordeon_nappe, sonie_lu=-14.0, pan=80, reverbe=0.35,
                  souffle=True),
            Piste("violoncelle", VIOLONCELLE, humaniser(violoncelle, rng, 0.008, 4, tempo), sonie_lu=-2.0,
                  pan=50, reverbe=0.30, souffle=True),
            Piste("contrechant", CLARINETTE, contre, sonie_lu=-10.0, pan=46, reverbe=0.32, souffle=True),
            Piste("contrebasse", CONTREBASSE, humaniser(basse, rng, tempo=tempo), sonie_lu=-8.0, pan=64,
                  reverbe=0.15),
        ],
    )


def halte_ete() -> Morceau:
    """La Halte en été (tour 8): même grille, même tempo et même longueur que le matin et l'après-midi
    (on passe de l'une à l'autre à la même position de lecture). Le violon chante le motif comme un
    air de fête de village, la flûte prend le pont, le violoncelle la partie C; la guitare et les
    pizzicati gardent le balancement, la harpe roule la lumière longue des soirs d'été."""
    rng = _rng(13)
    acc = _grille_halte()
    melo = _melodie_halte(vel=82)
    tempo = 90.0
    guitare = humaniser(arpege(acc, ARPEGE_68_B, vel=74, bas=40, haut_v=(52, 67)), rng, tempo=tempo)
    violon = melo["A"] + melo["A2"] + melo["A3"]
    flute = decaler(melo["B"], dv=-2)
    violoncelle = decaler(melo["C"], transpo=-12, dv=-2)
    pizz = ligne_basse(_filtrer(acc, 4, 48), [0.0, 1.5], vel=70, bas=36, haut=50, duree=0.6)
    harpe = _harpe_roulee(_filtrer(acc, 12, 20) + _filtrer(acc, 28, 36) + _filtrer(acc, 44, 48), vel=48, bas=67,
                          haut=86)
    contre = contrechant(_filtrer(acc, 20, 28), 62, 74, vel=52, eviter=melo["B"])
    return Morceau(
        accords=acc, id="halte-ete", titre="La Halte, l'été", tempo=tempo, signature=(6, 8), mesures=48,
        temps_par_mesure=M68, graine=3, rt60=1.5,
        pistes=[
            Piste("guitare", GUITARE_NYLON, guitare, sonie_lu=-5.0, pan=52, reverbe=0.22, passe_haut=70),
            Piste("violon", VIOLON, humaniser(violon, rng, 0.008, 4, tempo), sonie_lu=0.0, pan=70, reverbe=0.30,
                  souffle=True),
            Piste("flute", FLUTE, humaniser(flute, rng, 0.008, 4, tempo), sonie_lu=-1.0, pan=60, reverbe=0.30,
                  souffle=True),
            Piste("violoncelle", VIOLONCELLE, humaniser(violoncelle, rng, 0.008, 4, tempo), sonie_lu=-2.0, pan=48,
                  reverbe=0.30, souffle=True),
            Piste("contrechant", CLARINETTE, contre, sonie_lu=-10.0, pan=44, reverbe=0.32, souffle=True),
            Piste("pizz", PIZZ, humaniser(pizz, rng, tempo=tempo), sonie_lu=-8.0, pan=64, reverbe=0.18),
            Piste("harpe", HARPE, humaniser(harpe, rng, tempo=tempo), sonie_lu=-11.0, pan=84, reverbe=0.35),
        ],
    )


# --- Écran titre (ré majeur, 6/8, plus lent) -------------------------------------------

def titre() -> Morceau:
    """Le motif de la Halte, transposé en ré (+7) et élargi: piano, cordes, flûte, cor."""
    rng = _rng(13)
    t = 7
    tempo = 75.0  # mesure de 2,4 s, 30 mesures = 72 s
    debut_a, debut_b, debut_a2, debut_outro = 2 * M68, 10 * M68, 18 * M68, 26 * M68
    acc = (grille("D | G/D", 0.0, M68)
           + grille("D | Bm | G | A | D | Bm | Em7 A7 | D", debut_a, M68)
           + grille("G | D/F# | Em | Bm | C | G | Em7 | A", debut_b, M68)
           + grille("D | Bm | G | A | D | Bm | Em7 A7 | D", debut_a2, M68)
           + grille("D | Bm | G | A7", debut_outro, M68))
    a = mel(HALTE_A + " " + HALTE_FIN_A, debut_a, 80, M68, transpo=t)
    b = mel(HALTE_B, debut_b, 78, M68, transpo=t - 12)
    a2 = mel(HALTE_A + " " + HALTE_FIN_A, debut_a2, 84, M68, transpo=t)
    hautbois = tierce_dessous(a2, RE_MAJEUR, 2, dv=-10, accords=acc)
    piano = humaniser(arpege(acc, ARPEGE_68, vel=56, bas=38, haut_v=(57, 74)), rng, tempo=tempo)
    cordes = nappe(acc[2:], vel=54, nb=4, bas=50, haut=74)
    violoncelle = ligne_basse([x for x in acc if x.t >= debut_a], [0.0], vel=64, bas=38, haut=52, duree=2.9,
                              quintes=False)
    harpe = _harpe_roulee([x for x in acc if debut_a2 <= x.t < debut_outro], vel=48, bas=69, haut=88)
    return Morceau(
        accords=acc, id="titre", titre="La Petite Ligne", tempo=tempo, signature=(6, 8), mesures=30, temps_par_mesure=M68,
        graine=3, rt60=2.0, aigus_ir=0.5,
        pistes=[
            Piste("piano", PIANO, piano, sonie_lu=-5.0, pan=60, reverbe=0.30),
            Piste("flute", FLUTE, humaniser(a + a2, rng, 0.008, 4, tempo), sonie_lu=0.0, pan=70, reverbe=0.32,
                  souffle=True),
            Piste("cor", COR, humaniser(b, rng, 0.008, 4, tempo), sonie_lu=-1.0, pan=50, reverbe=0.38,
                  souffle=True),
            Piste("hautbois", HAUTBOIS, hautbois, sonie_lu=-6.0, pan=54, reverbe=0.32, souffle=True),
            Piste("cordes", CORDES_LENTES, cordes, sonie_lu=-9.0, pan=64, reverbe=0.42, souffle=True,
                  passe_haut=80),
            Piste("violoncelle", VIOLONCELLE, violoncelle, sonie_lu=-10.0, pan=60, reverbe=0.30, souffle=True),
            Piste("harpe", HARPE, harpe, sonie_lu=-11.0, pan=86, reverbe=0.40),
        ],
    )


# --- Veillée (ré majeur, 3/4, intime: deux voix qui se répondent) ------------------------

M34 = 3.0


def veillee() -> Morceau:
    """La clarinette et la flûte sont les deux joueurs: l'une chante, l'autre répond, puis elles
    chantent ensemble. Guitare seule en accompagnement, violoncelle discret."""
    rng = _rng(14)
    tempo = 72.0  # mesure de 2,5 s, 40 mesures = 100 s
    d = {"intro": 0, "A": 4, "A2": 12, "B": 20, "A3": 28, "outro": 36}
    T = {k: v * M34 for k, v in d.items()}
    g_a = "D | Bm | G | A | F#m | Bm | Em7 | A7"
    acc = (grille("D | G/D | D | A", T["intro"], M34) + grille(g_a, T["A"], M34) + grille(g_a, T["A2"], M34)
           + grille("G | D/F# | Em | A | G | D/F# | Em7 | A", T["B"], M34) + grille(g_a, T["A3"], M34)
           + grille("D | G | Em7 | A7", T["outro"], M34))
    a_txt = ("F#4:1 A4:1 D5:1 | D5:2 C#5:.5 B4:.5 | B4:1.5 A4:.5 G4:1 | A4:3 | A4:1 C#5:1 E5:1 | "
             "D5:2 C#5:.5 B4:.5 | B4:1.5 G4:.5 E4:1 |")
    clar_a = mel(a_txt + " C#4:1 E4:1 G4:1 |", T["A"], 74, M34)
    flute_a2 = mel(a_txt + " A4:2 C#5:1 |", T["A2"], 72, M34)
    flute_b = mel("D5:2 B4:1 | A4:3 | G4:1 B4:1 E5:1 | C#5:3 | D5:1 E5:1 D5:1 | A4:2 F#4:1 | "
                  "G4:1 A4:1 B4:1 | A4:3 |", T["B"], 72, M34)
    clar_b = mel("B4:2 G4:1 | F#4:3 | E4:1 G4:1 B4:1 | A4:3 | B4:3 | F#4:2 D4:1 | E4:1 F#4:1 G4:1 | "
                 "C#4:3 |", T["B"], 66, M34)
    clar_a3 = mel(a_txt + " E4:2 C#4:1 | D4:3 |", T["A3"], 74, M34)
    flute_outro = mel("r:3 | B4:2 A4:1 | G4:3 | E4:1.5 G4:1.5 |", T["outro"], 62, M34)
    clar_contre = contrechant([x for x in acc if T["A2"] <= x.t < T["B"]], 55, 67, vel=54, eviter=flute_a2)
    flute_contre = contrechant([x for x in acc if T["A3"] <= x.t < T["outro"]], 69, 81, vel=50, eviter=clar_a3)
    guitare = humaniser(arpege(acc, [(0.0, 0, 3.0), (0.5, 1, 1.5), (1.0, 2, 1.2), (1.5, 3, 1.5), (2.0, 2, 1.0),
                                     (2.5, 1, 0.6)], vel=66, bas=38, haut_v=(54, 69)), rng, 0.014, 5, tempo)
    violoncelle = ligne_basse([x for x in acc if T["A2"] <= x.t < T["outro"]], [0.0], vel=58, bas=38, haut=52,
                              duree=2.9, quintes=False)
    return Morceau(
        accords=acc, id="veillee", titre="La veillée", tempo=tempo, signature=(3, 4), mesures=40, temps_par_mesure=M34,
        graine=4, rt60=1.1, aigus_ir=0.38, predelai=0.010,
        pistes=[
            Piste("guitare", GUITARE_NYLON, guitare, sonie_lu=-4.0, pan=64, reverbe=0.20, passe_haut=60),
            Piste("clarinette", CLARINETTE, humaniser(clar_a + clar_b + clar_a3, rng, 0.01, 4, tempo),
                  sonie_lu=0.0, pan=50, reverbe=0.24, souffle=True),
            Piste("flute", FLUTE, humaniser(flute_a2 + flute_b + flute_outro, rng, 0.01, 4, tempo), sonie_lu=-0.5,
                  pan=78, reverbe=0.26, souffle=True),
            Piste("clarinette_contre", CLARINETTE, clar_contre, sonie_lu=-9.0, pan=50, reverbe=0.26, souffle=True,
                  canal=5),
            Piste("flute_contre", FLUTE, flute_contre, sonie_lu=-9.0, pan=78, reverbe=0.28, souffle=True, canal=6),
            Piste("violoncelle", VIOLONCELLE, violoncelle, sonie_lu=-9.0, pan=60, reverbe=0.24, souffle=True),
        ],
    )


# --- Petit-déjeuner (fa majeur, 4/4, léger et un peu drôle) ----------------------------

M44 = 4.0


def petit_dejeuner() -> Morceau:
    """Le basson pose la question en sautillant, la clarinette répond; piano en « oum-pa »."""
    rng = _rng(15)
    tempo = 96.0  # mesure de 2,5 s, 28 mesures = 70 s
    T = {"intro": 0.0, "A": 2 * M44, "A2": 10 * M44, "B": 18 * M44, "outro": 26 * M44}
    g_a = "F | C7 | F | Bb | F | Gm7 C7 | F | C7"
    acc = (grille("F | C7", T["intro"], M44) + grille(g_a, T["A"], M44) + grille(g_a, T["A2"], M44)
           + grille("Bb | F | G7 | C7 | Dm | Bb | Gm7 C7 | F", T["B"], M44) + grille("F | C7", T["outro"], M44))
    a_txt = ("C4:.5 F4:.5 A4:1 G4:.5 F4:.5 A4:1 | G4:1 E4:.5 C4:.5 G4:1 r:1 | A4:1 C5:1 A4:1 F4:1 | "
             "D5:1.5 C5:.5 Bb4:1 r:1 | C4:.5 F4:.5 A4:1 G4:.5 F4:.5 A4:1 | Bb4:1 G4:1 E4:1 C4:1 | "
             "F4:1 A4:.5 G4:.5 F4:1 r:1 | G4:1 E4:1 C4:1 r:1 |")
    basson_a = mel(a_txt, T["A"], 82, M44, legato=0.55, transpo=-12)
    clar_a2 = mel(a_txt, T["A2"], 78, M44, legato=0.7)
    clar_b = mel("D5:3 C5:1 | A4:2 C5:2 | B4:3 D5:1 | C5:2 Bb4:2 | A4:3 F4:1 | D5:2 F5:2 | D5:2 E5:2 | "
                 "F5:3 r:1 |", T["B"], 76, M44)
    basson_b = mel("r:4 | r:2 F3:.5 G3:.5 A3:1 | r:4 | r:2 E3:.5 F3:.5 G3:1 | r:4 | r:2 D3:.5 C3:.5 Bb2:1 | "
                   "r:2 C3:1 E3:1 | F3:.5 A3:.5 C4:.5 A3:.5 F3:1 r:1 |", T["B"], 80, M44, legato=0.55)
    basson_outro = mel("r:4 | r:2 G3:.5 E3:.5 C3:1 |", T["outro"], 74, M44, legato=0.55)
    basson_contre = contrechant([x for x in acc if T["A2"] <= x.t < T["B"]], 46, 58, vel=58)
    basson_contre = [Note(n.t, 0.8, n.p, n.v) for n in basson_contre] + \
                    [Note(n.t + 2.0, 0.8, n.p, n.v - 6) for n in basson_contre]
    piano_basse = ligne_basse(acc, [0.0, 2.0], vel=64, bas=36, haut=50, duree=0.7)
    piano_main_d = accords_frappes(acc, [1.0, 3.0], vel=52, nb=3, bas=57, haut=72, duree=0.4)
    pizz = ligne_basse([x for x in acc if x.t >= T["A2"]], [0.0, 2.0], vel=62, bas=36, haut=50, duree=0.5)
    return Morceau(
        accords=acc, id="petit-dejeuner", titre="Le petit-déjeuner", tempo=tempo, signature=(4, 4), mesures=28,
        temps_par_mesure=M44, graine=5, rt60=0.9, aigus_ir=0.45, predelai=0.008,
        pistes=[
            Piste("piano_basse", PIANO, humaniser(piano_basse, rng, tempo=tempo), sonie_lu=-6.0, pan=58,
                  reverbe=0.18, canal=0),
            Piste("piano_main_droite", PIANO, humaniser(piano_main_d, rng, tempo=tempo), sonie_lu=-7.0, pan=70,
                  reverbe=0.18, canal=0),
            Piste("basson", BASSON, humaniser(basson_a + basson_b + basson_outro, rng, 0.006, 5, tempo),
                  sonie_lu=0.0, pan=50, reverbe=0.22),
            Piste("basson_contre", BASSON, basson_contre, sonie_lu=-9.0, pan=50, reverbe=0.22, canal=4),
            Piste("clarinette", CLARINETTE, humaniser(clar_a2 + clar_b, rng, 0.006, 4, tempo), sonie_lu=-0.5,
                  pan=78, reverbe=0.24, souffle=True),
            Piste("pizz", PIZZ, pizz, sonie_lu=-10.0, pan=64, reverbe=0.15),
        ],
    )


# --- Nuit (fa majeur, 3/4, berceuse) ------------------------------------------------------

def nuit() -> Morceau:
    rng = _rng(16)
    tempo = 60.0  # mesure de 3 s, 28 mesures = 84 s
    T = {"intro": 0.0, "A": 4 * M34, "B": 12 * M34, "A2": 20 * M34}
    g_a = "F | Dm | Bb | C | F | Am | Bb | C"
    acc = (grille("F | Dm | Bb | C", T["intro"], M34) + grille(g_a, T["A"], M34)
           + grille("Bb | F/A | Gm | C | Dm | Am | Bb | C", T["B"], M34) + grille(g_a, T["A2"], M34))
    a_txt = "C5:2 A4:1 | D5:2 A4:1 | D5:1 C5:1 Bb4:1 | G4:3 | A4:2 F4:1 | E4:2 A4:1 | F4:1 D4:1 F4:1 | E4:3 |"
    celesta = mel(a_txt, T["A"], 64, M34, transpo=12) + mel(a_txt, T["A2"], 62, M34, transpo=12)
    flute = mel("F5:2 D5:1 | C5:3 | Bb4:2 G4:1 | C5:3 | A4:2 F4:1 | E4:2 C5:1 | D5:1 C5:1 Bb4:1 | G4:3 |",
                T["B"], 60, M34)
    harpe = humaniser(arpege(acc, [(0.0, 0, 3.0), (0.5, 1, 2.5), (1.0, 2, 2.0), (1.5, 3, 1.5), (2.0, 2, 1.0),
                                   (2.5, 1, 0.5)], vel=48, bas=41, haut_v=(57, 72)), rng, 0.01, 4, tempo)
    cordes = nappe([x for x in acc if x.t >= T["A"]], vel=44, nb=4, bas=53, haut=72)
    return Morceau(
        accords=acc, id="nuit", titre="La nuit", tempo=tempo, signature=(3, 4), mesures=28, temps_par_mesure=M34,
        graine=6, rt60=2.2, aigus_ir=0.35, sonie_cible=-18.0,
        pistes=[
            Piste("harpe", HARPE, harpe, sonie_lu=-3.0, pan=60, reverbe=0.35),
            Piste("celesta", CELESTA, humaniser(celesta, rng, 0.01, 3, tempo), sonie_lu=0.0, pan=72, reverbe=0.42),
            Piste("flute", FLUTE, humaniser(flute, rng, 0.01, 3, tempo), sonie_lu=-1.0, pan=52, reverbe=0.40,
                  souffle=True),
            Piste("cordes", CORDES_LENTES, cordes, sonie_lu=-10.0, pan=64, reverbe=0.45, souffle=True,
                  passe_haut=90),
        ],
    )


# --- Samedi: le train est là, marché sur le quai (do majeur, 4/4) --------------------------

def samedi() -> Morceau:
    rng = _rng(17)
    tempo = 120.0  # mesure de 2 s, 40 mesures = 80 s
    T = {"intro": 0.0, "A": 4 * M44, "A2": 12 * M44, "B": 20 * M44, "A3": 28 * M44, "outro": 36 * M44}
    g_a = "C | Am | Dm | G7 | C | Am | Dm7 G7 | C"
    acc = (grille("C | G7 | C | G7", T["intro"], M44) + grille(g_a, T["A"], M44) + grille(g_a, T["A2"], M44)
           + grille("F | F | C | C | D7 | D7 | G | G7", T["B"], M44) + grille(g_a, T["A3"], M44)
           + grille("C | Am | Dm7 | G7", T["outro"], M44))
    a_txt = ("G4:.5 C5:.5 E5:1 D5:.5 C5:.5 E5:1 | A4:1.5 C5:.5 E5:2 | F5:1 E5:.5 D5:.5 A4:1 D5:1 | "
             "B4:2 G4:2 | G4:.5 C5:.5 E5:1 D5:.5 C5:.5 E5:1 | A5:1.5 G5:.5 E5:2 | F5:1 D5:1 B4:1 D5:1 |")
    b_txt = ("A4:1 C5:1 F5:2 | E5:.5 F5:.5 E5:.5 D5:.5 C5:2 | G4:1 C5:1 E5:2 | D5:.5 E5:.5 D5:.5 C5:.5 G4:2 | "
             "F#4:1 A4:1 D5:2 | C5:1 B4:1 A4:2 | B4:1 D5:1 G5:2 | F5:1 D5:1 B4:1 G4:1 |")
    accordeon = (mel(a_txt + " C5:2 G4:1 r:1 |", T["A"], 84, M44, legato=0.85)
                 + mel(b_txt, T["B"], 84, M44, legato=0.85)
                 + mel(a_txt + " C5:2 G4:1 r:1 |", T["A3"], 86, M44, legato=0.85))
    clarinette = (mel(a_txt + " C5:2 r:2 |", T["A2"], 80, M44, legato=0.85)
                  + mel("F4:2 A4:2 | C5:2 A4:2 | E4:2 G4:2 | G4:2 E4:2 | D4:2 F#4:2 | A4:2 F#4:2 | "
                        "G4:2 B4:2 | D5:2 B4:2 |", T["B"], 70, M44)
                  + mel(a_txt + " C5:2 G4:1 r:1 |", T["A3"], 72, M44, legato=0.85, transpo=-12))
    accordeon_frappe = accords_frappes([x for x in acc if x.t < T["A"] or x.t >= T["A2"]], [1.0, 3.0], vel=56,
                                       nb=3, bas=55, haut=70, duree=0.4)
    guitare = accords_frappes(acc, [1.0, 3.0], vel=58, nb=4, bas=52, haut=67, duree=0.3)
    basse = ligne_basse(acc, [0.0, 2.0], vel=78, bas=36, haut=50, duree=0.8)
    tambourin = [Note(t, 0.2, 54, 50 + (8 if (t % 2) > 0.5 else 0))
                 for t in np.arange(T["A2"], 40 * M44, 1.0) if (t % 2) > 0.5]
    return Morceau(
        accords=acc, id="samedi", titre="Samedi, jour du train", tempo=tempo, signature=(4, 4), mesures=40,
        temps_par_mesure=M44, graine=7, rt60=1.2, aigus_ir=0.5,
        pistes=[
            Piste("accordeon", ACCORDEON, humaniser(accordeon, rng, 0.006, 4, tempo), sonie_lu=0.0, pan=56,
                  reverbe=0.20, souffle=True),
            Piste("clarinette", CLARINETTE, humaniser(clarinette, rng, 0.006, 4, tempo), sonie_lu=-2.0, pan=80,
                  reverbe=0.22, souffle=True),
            Piste("accordeon_frappe", ACCORDEON, accordeon_frappe, sonie_lu=-10.0, pan=48, reverbe=0.2, canal=7),
            Piste("guitare", GUITARE_ACIER, humaniser(guitare, rng, tempo=tempo), sonie_lu=-8.0, pan=76,
                  reverbe=0.18, passe_haut=90),
            Piste("contrebasse", CONTREBASSE, humaniser(basse, rng, tempo=tempo), sonie_lu=-6.0, pan=64,
                  reverbe=0.12),
            Piste("tambourin", 0, tambourin, sonie_lu=-15.0, pan=84, reverbe=0.2, percussions=True),
        ],
    )


# --- Fanfare d'arrivée du train (courte, ne boucle pas) ----------------------------------

def fanfare_train() -> Morceau:
    tempo = 112.0
    acc = grille("C | F G | C/E F | G7 | C", 0.0, M44)
    tromp = mel("G4:.5 C5:.5 E5:.5 G5:.5 E5:1 C5:1 | A4:1 C5:.5 F5:.5 D5:1 B4:1 | E5:1 G5:1 F5:1 A5:1 | "
                "G5:1 F5:.5 D5:.5 B4:1 D5:1 | C5:4 |", 0.0, 86, M44, legato=0.9)
    cor = tierce_dessous(tromp, [0, 2, 4, 5, 7, 9, 11], 2, dv=-12, accords=acc)
    cor = decaler(cor, transpo=-12)
    accordeon = accords_frappes(acc[:-1], [0.0, 1.0, 2.0, 3.0], vel=56, nb=3, bas=55, haut=70, duree=0.45)
    accordeon += nappe(acc[-1:], vel=60, nb=4, bas=55, haut=76)
    tuba = ligne_basse(acc, [0.0, 2.0], vel=72, bas=33, haut=48, duree=0.9)
    glock = mel("r:16 | C6:.5 E6:.5 G6:.5 C7:2.5 |", 0.0, 60, M44)
    caisse = [Note(0.0 + k * 0.125, 0.1, 38, 30 + k * 3) for k in range(8)] + [Note(16.0, 0.5, 49, 62)]
    return Morceau(
        accords=acc, id="fanfare-train", titre="Le train arrive", tempo=tempo, signature=(4, 4), mesures=5,
        temps_par_mesure=M44, boucle=False, queue_s=3.5, graine=8, rt60=1.4, sonie_cible=-17.0,
        pistes=[
            Piste("trompette", TROMPETTE, tromp, sonie_lu=0.0, pan=58, reverbe=0.25, souffle=True),
            Piste("cor", COR, cor, sonie_lu=-5.0, pan=46, reverbe=0.3, souffle=True),
            Piste("accordeon", ACCORDEON, accordeon, sonie_lu=-7.0, pan=76, reverbe=0.22),
            Piste("tuba", TUBA, tuba, sonie_lu=-7.0, pan=64, reverbe=0.18),
            Piste("glock", GLOCK, glock, sonie_lu=-10.0, pan=84, reverbe=0.35),
            Piste("caisse", 0, caisse, sonie_lu=-14.0, pan=60, reverbe=0.25, percussions=True),
        ],
    )


# --- Air de fin: la commande est partie, la semaine est faite (ne boucle pas) ------------

def fin() -> Morceau:
    rng = _rng(19)
    tempo = 84.0  # mesure de 2,14 s
    T_a = 2 * M68
    T_b = 10 * M68
    T_c = 14 * M68
    acc = (grille("G | C/G", 0.0, M68) + grille(G_A, T_a, M68) + grille("C | G/B | Am | Em", T_b, M68)
           + grille("F | C | Am7 D7 | G | G", T_c, M68))
    flute = mel(HALTE_A + " " + HALTE_FIN_A, T_a, 82, M68) + \
        mel("E5:1.5 D5:.5 C5:.5 D5:.5 | D5:1.5 B4:1.5 | C5:1 B4:.5 A4:1 B4:.5 | G4:1.5 B4:.5 A4:.5 G4:.5 |",
            T_b, 80, M68) + \
        mel("A4:1 G4:.5 A4:1 C5:.5 | C5:1 D5:.5 E5:1.5 | C5:1 B4:.5 A4:1 F#4:.5 | G4:3 | r:3 |", T_c, 80, M68)
    clarinette = tierce_dessous(flute, SOL_MAJEUR, 2, dv=-10, accords=acc)
    guitare = humaniser(arpege(acc[:-1], ARPEGE_68, vel=72, bas=40, haut_v=(52, 67)), rng, tempo=tempo)
    guitare += [Note(acc[-1].t, 3.0, p, 56) for p in (43, 50, 55, 59, 62)]
    cordes = nappe(acc[2:], vel=54, nb=4, bas=50, haut=74)
    pizz = ligne_basse(acc[2:-1], [0.0, 1.5], vel=66, bas=36, haut=50, duree=0.6)
    harpe_fin = [Note(acc[-2].t + 0.08 * k, 4.0, p, 54 - k) for k, p in
                 enumerate([55, 59, 62, 67, 71, 74, 79, 83, 86])]
    cor = mel("r:3 | r:3 | r:3 | D4:1.5 B3:1.5 | B3:3 |", T_c, 66, M68)
    return Morceau(
        accords=acc, id="fin", titre="Une semaine à la Halte", tempo=tempo, signature=(6, 8), mesures=19,
        temps_par_mesure=M68, boucle=False, queue_s=5.0, graine=9, rt60=1.8, sonie_cible=-18.0,
        pistes=[
            Piste("guitare", GUITARE_NYLON, guitare, sonie_lu=-5.0, pan=60, reverbe=0.24, passe_haut=70),
            Piste("flute", FLUTE, humaniser(flute, rng, 0.008, 4, tempo), sonie_lu=0.0, pan=72, reverbe=0.30,
                  souffle=True),
            Piste("clarinette", CLARINETTE, clarinette, sonie_lu=-5.0, pan=52, reverbe=0.30, souffle=True),
            Piste("cordes", CORDES_LENTES, cordes, sonie_lu=-9.0, pan=64, reverbe=0.42, souffle=True, passe_haut=80),
            Piste("pizz", PIZZ, pizz, sonie_lu=-9.0, pan=64, reverbe=0.18),
            Piste("harpe", HARPE, harpe_fin, sonie_lu=-8.0, pan=84, reverbe=0.4),
            Piste("cor", COR, cor, sonie_lu=-6.0, pan=48, reverbe=0.38, souffle=True),
        ],
    )


def halte_soir() -> Morceau:
    """Les lanternes du quai (tour 9, P1): le motif de la Halte au célesta, une octave au-dessus du
    jour, sur une harpe qui arpège doucement et des cordes lentes. Une fois, à 72 (plus lent que le
    jour): la Halte s'éveille le soir. Le célesta est la voix de la nuit dans le jeu (la nuit, les
    étoiles, les vers luisants)."""
    rng = _rng(21)
    tempo = 72.0  # mesure de 2,5 s
    t_a = 1 * M68
    t_fin = 9 * M68
    acc = grille("G", 0.0, M68) + grille(G_A, t_a, M68) + grille("C/G | G", t_fin, M68)
    celesta = mel(HALTE_A + " " + HALTE_FIN_A, t_a, 70, M68, transpo=12) + \
        mel("E5:1.5 C5:1.5 | G4:3 |", t_fin, 62, M68, transpo=12)
    harpe = humaniser(arpege(acc[:-1], ARPEGE_68, vel=46, bas=40, haut_v=(52, 67)), rng, tempo=tempo)
    harpe += [Note(acc[-1].t + 0.1 * k, 4.0, p, 50 - 2 * k) for k, p in enumerate([43, 50, 55, 59, 62, 67])]
    cordes = nappe(acc, vel=42, nb=3, bas=50, haut=69)
    return Morceau(
        accords=acc, id="halte-evening", titre="La Halte, le soir", tempo=tempo, signature=(6, 8), mesures=11,
        temps_par_mesure=M68, boucle=False, queue_s=5.0, graine=10, rt60=2.0, sonie_cible=-18.0,
        pistes=[
            Piste("celesta", CELESTA, humaniser(celesta, rng, 0.006, 3, tempo), sonie_lu=0.0, pan=60, reverbe=0.38),
            Piste("harpe", HARPE, harpe, sonie_lu=-6.0, pan=78, reverbe=0.34),
            Piste("cordes", CORDES_LENTES, cordes, sonie_lu=-11.0, pan=50, reverbe=0.45, souffle=True, passe_haut=90),
        ],
    )


MORCEAUX = {
    "halte-matin": halte_matin,
    "halte-apres-midi": halte_apres_midi,
    "halte-ete": halte_ete,
    "veillee": veillee,
    "petit-dejeuner": petit_dejeuner,
    "nuit": nuit,
    "samedi": samedi,
    "titre": titre,
    "fanfare-train": fanfare_train,
    "fin": fin,
    "halte-evening": halte_soir,
}
