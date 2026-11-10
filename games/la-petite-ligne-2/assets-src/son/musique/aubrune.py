"""Les musiques d'Aubrune, écrites en données (partitions) et rendues par `generer.py`.

Le fil de tout le lieu est le motif du quai: ré, sol, si, la, sol (une quarte qui monte, une tierce
qui monte, un pas qui redescend, un repos). Les cinq moments du bourg le déclinent (tempo, mode,
instrument, densité); la pluie, la rivière, le train, le mystère et la veillée le reprennent.

Tonalités: tout est écrit sur les sept notes de sol majeur (sol la si do ré mi fa#), avec pour
centres sol (aube, matin, après-midi, nuit, pluie, train, fête), mi (soir, mystère: le mode relatif)
et ré (rivière: mixolydien). Deux morceaux voisins se fondent donc sans frottement: aucune note
étrangère, et les centres sont des degrés voisins de la même gamme. Un test lit les fichiers MIDI
et le vérifie.

Chaque morceau a deux tiges synchrones qui bouclent ensemble: `fond` (basse, accompagnement,
rythme) et `air` (mélodie, contrechant, éclats de glockenspiel). Le jeu règle leur niveau
séparément (pluie: l'air recule; nuit: il disparaît presque).

Durées: entières en secondes (nombre entier d'échantillons à 44,1 et 48 kHz).
"""

from __future__ import annotations

import numpy as np

from partition import (Accord, Morceau, Note, Piste, accords_frappes, arpege, contrechant, decaler, grille,
                       humaniser, ligne_basse, mel, tierce_dessous)

SOL_MAJEUR = [7, 9, 11, 0, 2, 4, 6]
GAMME = [0, 2, 4, 6, 7, 9, 11]  # classes de hauteur de sol majeur (do, ré, mi, fa#, sol, la, si)

PIANO, GLOCK = 0, 9
ACCORDEON = 21
GUITARE = 24
CONTREBASSE_PIZZ, CONTREBASSE_ARCO = 32, 43
CLARINETTE = 71
BROSSES = 40

# --- Le motif du quai et ses phrases ----------------------------------------------------------
# 4/4: P1 à P4, quatre mesures chacune (grille G_P). 6/8 ou 3/4: Q1 à Q4 (trois temps par mesure).

P = [
    "D4:1 G4:1 B4:1.5 A4:.5 | G4:2 B4:1 D5:1 | E5:1.5 D5:.5 B4:1 G4:1 | A4:1 G4:1 E4:2 |",
    "D4:1 G4:1 B4:1.5 A4:.5 | B4:1 A4:1 F#4:2 | G4:1 B4:1 C5:1 G4:1 | A4:1.5 F#4:.5 D4:2 |",
    "E5:2 D5:1 C5:1 | B4:2 G4:1 A4:1 | C5:1.5 B4:.5 A4:1 G4:1 | A4:2 D5:2 |",
    "D4:1 G4:1 B4:1.5 A4:.5 | G4:1 B4:1 D5:2 | C5:1.5 B4:.5 A4:1 F#4:1 | G4:4 |",
]
Q = [
    "D4:1 G4:.5 B4:1 A4:.5 | G4:1.5 B4:.5 D5:.5 B4:.5 | E5:1 D5:.5 B4:1 G4:.5 | A4:1 G4:.5 E4:1.5 |",
    "D4:1 G4:.5 B4:1 A4:.5 | B4:1 A4:.5 F#4:1.5 | G4:.5 B4:.5 G4:.5 C5:1 G4:.5 | A4:1 F#4:.5 D4:1.5 |",
    "E5:1.5 D5:.5 C5:1 | B4:1.5 G4:.5 A4:1 | C5:1 B4:.5 A4:1 G4:.5 | A4:1.5 D5:1.5 |",
    "D4:1 G4:.5 B4:1 A4:.5 | G4:.5 B4:.5 D5:1.5 B4:.5 | C5:1 B4:.5 A4:.5 F#4:1 | G4:3 |",
]
G_P = ["G | G | Em | C6", "G | D | Em C | D", "C | G | Am | D", "G | G | C D | G"]


def degres(notes: list[Note], k: int) -> list[Note]:
    """Décale chaque note de k degrés de sol majeur (le motif change de mode, jamais de gamme)."""
    echelle = [p for p in range(24, 108) if p % 12 in GAMME]
    sortie = []
    for n in notes:
        i = echelle.index(n.p)
        sortie.append(Note(n.t, n.d, echelle[i + k], n.v))
    return sortie


def melodie(phrases: list[str], mesure: float, vel: int = 70, t0: float = 0.0, legato: float = 0.96) -> list[Note]:
    notes: list[Note] = []
    t = t0
    for ph in phrases:
        notes += mel(ph, t0=t, vel=vel, mesure=mesure, legato=legato)
        t += 4 * mesure
    return notes


def accords_de(grilles: list[str], mesure: float, t0: float = 0.0) -> list[Accord]:
    sortie: list[Accord] = []
    t = t0
    for g in grilles:
        sortie += grille(g, t, mesure)
        t += 4 * mesure
    return sortie


def dans_accords(notes: list[Note], accords: list[Accord]) -> list[Note]:
    """Coupe chaque note à la fin de son accord (une basse tenue ne déborde pas sur l'accord suivant)."""
    sortie = []
    for n in notes:
        a = next((a for a in accords if a.t - 1e-6 <= n.t < a.t + a.d - 1e-6), None)
        fin = a.t + a.d if a is not None else n.t + n.d
        sortie.append(Note(n.t, max(0.1, min(n.d, fin - n.t - 0.03)), n.p, n.v))
    return sortie


def entre(notes: list[Note], debut: float, fin: float) -> list[Note]:
    return [n for n in notes if debut - 1e-6 <= n.t < fin - 1e-6]


# --- Harmonisation automatique d'une mélodie décalée -----------------------------------------

CANDIDATS = ["Em", "Em7", "Am", "Am7", "C", "G", "D", "Bm7", "Cmaj7"]


def harmoniser(notes: list[Note], mesures: int, mesure: float, tonique: str, candidats: list[str] | None = None,
               fin: str | None = None) -> str:
    """Une grille d'un accord par mesure: programmation dynamique qui récompense les notes de la
    mélodie contenues dans l'accord (poids: durée, temps fort), les enchaînements usuels (quarte,
    quinte, tierce) et pénalise le surplace. Renvoie « Em | Am | ... »."""
    cands = candidats or CANDIDATS
    from partition import analyser
    info = {c: analyser(c) for c in cands}

    def score(c: str, m: int) -> float:
        _, pcs, _ = info[c]
        s = 0.0
        for n in entre(notes, m * mesure, (m + 1) * mesure):
            fort = 2.0 if (n.t - m * mesure) % 1.0 < 1e-6 else 1.0
            s += n.d * fort * (1.0 if n.p % 12 in pcs else -1.6)
        return s

    def lien(a: str, b: str) -> float:
        if a == b:
            return -1.2
        ra, rb = info[a][0], info[b][0]
        iv = (rb - ra) % 12
        return {7: 1.0, 5: 1.0, 3: 0.4, 9: 0.4, 2: 0.2, 10: 0.2}.get(iv, 0.0)

    tonique_pc = info[tonique][0]
    meilleurs = [{c: score(c, 0) + (2.0 if c.startswith(tonique) else 0.0) for c in cands}]
    retour: list[dict[str, str]] = [{}]
    for m in range(1, mesures):
        cour: dict[str, float] = {}
        prec: dict[str, str] = {}
        for c in cands:
            b = max(cands, key=lambda a: meilleurs[-1][a] + lien(a, c))
            cour[c] = meilleurs[-1][b] + lien(b, c) + score(c, m)
            prec[c] = b
        meilleurs.append(cour)
        retour.append(prec)
    dernier = fin or max(cands, key=lambda c: meilleurs[-1][c] + (1.5 if info[c][0] == (tonique_pc + 7) % 12 else 0.0))
    chemin = [dernier]
    for m in range(mesures - 1, 0, -1):
        chemin.append(retour[m][chemin[-1]])
    return " | ".join(reversed(chemin))


def humain(notes: list[Note], graine: int, tempo: float, dt: float = 0.014, dv: int = 4) -> list[Note]:
    return humaniser(notes, np.random.default_rng(graine), dt=dt, dv=dv, tempo=tempo)


# --- Les morceaux ---------------------------------------------------------------------------------

def _morceau(id_: str, titre: str, tempo: float, sig: tuple[int, int], tpm: float, mesures: int,
             pistes: list[Piste], accords: list[Accord], rt60: float, graine: int, **kw) -> Morceau:
    return Morceau(id=id_, titre=titre, tempo=tempo, signature=sig, mesures=mesures, temps_par_mesure=tpm,
                   pistes=pistes, boucle=True, queue_s=kw.pop("queue_s", 6.0), rt60=rt60, graine=graine,
                   accords=accords, **kw)


def bourg_aube() -> tuple[Morceau, dict]:
    """Aube: motif lent au glockenspiel sur un piano en arpèges, basse à l'archet; la clarinette
    arrive à la seconde moitié. 4/4 à 60, 16 mesures, 64 s."""
    tempo, tpm = 60.0, 4.0
    acc = accords_de(G_P, tpm)
    mel_ = melodie(P, tpm, vel=50)
    glock = decaler(mel_, transpo=12, dv=2)
    arp = dans_accords(arpege(acc, [(0, 0, 3.9), (1, 1, 2.9), (2, 2, 1.9), (3, 3, 0.95)], vel=40, bas=40, haut_v=(55, 67), nb=3), acc)
    basse = dans_accords(ligne_basse(acc, [0], vel=46, bas=38, haut=52, duree=3.9, quintes=False), acc)
    cl = contrechant([a for a in acc if a.t >= 8 * tpm], 62, 76, vel=44)
    pistes = [
        Piste("piano", PIANO, humain(arp, 11, tempo), -4, pan=64, reverbe=0.5),
        Piste("basse", CONTREBASSE_ARCO, basse, -6, pan=64, reverbe=0.3, souffle=True),
        Piste("glock", GLOCK, humain(glock, 12, tempo, 0.02), -3, pan=70, reverbe=0.55),
        Piste("clarinette", CLARINETTE, cl, -8, pan=58, reverbe=0.5, souffle=True),
    ]
    m = _morceau("bourg-aube", "Aubrune, l'aube", tempo, (4, 4), tpm, 16, pistes, acc, 3.0, 1)
    return m, {"fond": ["piano", "basse"], "air": ["glock", "clarinette"]}


def bourg_matin() -> tuple[Morceau, dict]:
    """Matin: accordéon puis clarinette sur guitare et contrebasse, glockenspiel à la reprise.
    4/4 à 96, 32 mesures, 80 s."""
    tempo, tpm = 96.0, 4.0
    acc = accords_de(G_P + G_P, tpm)
    pas1 = entre(melodie(P, tpm, vel=68), 0, 16 * tpm)
    pas2 = melodie(P, tpm, vel=72, t0=16 * tpm)
    harm = tierce_dessous(pas1, SOL_MAJEUR, 2, dv=-16, accords=acc)
    guitare = arpege(acc, [(0, 0, 1.5), (1, 1, 0.9), (1.5, 2, 0.9), (2, -1, 1.4), (3, 1, 0.9), (3.5, 3, 0.9)],
                     vel=56, bas=40, haut_v=(55, 69), nb=3, periode=4.0)
    basse = ligne_basse(acc, [0, 2], vel=68, bas=38, haut=52, duree=0.9)
    piano = accords_frappes([a for a in acc if a.t >= 16 * tpm], [1, 3], vel=38, nb=3, bas=57, haut=70)
    eclats = accords_frappes([a for a in acc if a.t >= 16 * tpm], [2.5], vel=36, nb=1, bas=79, haut=93, duree=0.7)
    pistes = [
        Piste("guitare", GUITARE, humain(guitare, 21, tempo), -2, pan=48, reverbe=0.25),
        Piste("basse", CONTREBASSE_PIZZ, humain(basse, 22, tempo, 0.008), -4, pan=64, reverbe=0.15),
        Piste("piano", PIANO, humain(piano, 23, tempo), -9, pan=76, reverbe=0.3, passe_haut=180),
        Piste("accordeon", ACCORDEON, humain(pas1 + decaler(harm, dv=0), 24, tempo, 0.012), 0, pan=78, reverbe=0.3,
              souffle=True),
        Piste("clarinette", CLARINETTE, humain(pas2, 25, tempo, 0.012), -1, pan=56, reverbe=0.3, souffle=True),
        Piste("glock", GLOCK, humain(eclats, 26, tempo, 0.01), -8, pan=80, reverbe=0.45),
    ]
    m = _morceau("bourg-matin", "Aubrune, le matin", tempo, (4, 4), tpm, 32, pistes, acc, 1.6, 2)
    return m, {"fond": ["guitare", "basse", "piano"], "air": ["accordeon", "clarinette", "glock"]}


def bourg_apres_midi() -> tuple[Morceau, dict]:
    """Après-midi: la clarinette chante le motif en 6/8, l'accordéon la rejoint à la reprise.
    6/8 à 90 (noires), 32 mesures de trois temps, 64 s."""
    tempo, tpm = 90.0, 3.0
    acc = accords_de(G_P + G_P, tpm)
    pas1 = melodie(Q, tpm, vel=66)
    pas2 = melodie(Q, tpm, vel=64, t0=16 * tpm)
    harm = tierce_dessous(pas2, SOL_MAJEUR, 2, dv=-14, accords=acc)
    guitare = arpege(acc, [(0, 0, 1.4), (0.5, 1, 0.5), (1, 2, 0.5), (1.5, -1, 1.4), (2, 2, 0.5), (2.5, 1, 0.5)],
                     vel=54, bas=40, haut_v=(55, 69), nb=3, periode=3.0)
    basse = ligne_basse(acc, [0, 1.5], vel=66, bas=38, haut=52, duree=1.0)
    piano = accords_frappes(acc, [1.5], vel=40, nb=3, bas=57, haut=70, duree=0.6)
    cl2 = contrechant([a for a in acc if a.t >= 16 * tpm], 64, 76, vel=50)
    eclats = accords_frappes([a for a in acc if a.t >= 16 * tpm], [1.5], vel=34, nb=1, bas=79, haut=93, duree=0.7)
    pistes = [
        Piste("guitare", GUITARE, humain(guitare, 31, tempo), -2, pan=50, reverbe=0.25),
        Piste("basse", CONTREBASSE_PIZZ, humain(basse, 32, tempo, 0.008), -4, pan=64, reverbe=0.15),
        Piste("piano", PIANO, humain(piano, 33, tempo), -9, pan=76, reverbe=0.3, passe_haut=180),
        Piste("clarinette", CLARINETTE, humain(pas1 + cl2, 34, tempo, 0.012), 0, pan=58, reverbe=0.3, souffle=True),
        Piste("accordeon", ACCORDEON, humain(decaler(pas2, dv=0) + harm, 35, tempo, 0.012), -1, pan=76, reverbe=0.3,
              souffle=True),
        Piste("glock", GLOCK, humain(eclats, 36, tempo, 0.01), -9, pan=82, reverbe=0.45),
    ]
    m = _morceau("bourg-apres-midi", "Aubrune, l'après-midi", tempo, (6, 8), tpm, 32, pistes, acc, 1.5, 3)
    return m, {"fond": ["guitare", "basse", "piano"], "air": ["clarinette", "accordeon", "glock"]}


def bourg_soir() -> tuple[Morceau, dict]:
    """Soir: le motif décalé d'un degré (mode de mi), accordéon lent, guitare, contrebasse; la
    clarinette double à la fin. 4/4 à 80, 24 mesures, 72 s."""
    tempo, tpm = 80.0, 4.0
    base = melodie(P, tpm, vel=60) + melodie(P[:2], tpm, vel=58, t0=16 * tpm)
    notes = degres(base, 1)
    grille_ = harmoniser(notes, 24, tpm, "Em", fin="D")
    acc = grille(grille_, 0.0, tpm)
    guitare = arpege(acc, [(0, 0, 2.0), (1, 1, 1.4), (1.5, 2, 1.4), (2, -1, 1.9), (3, 3, 0.95)],
                     vel=50, bas=40, haut_v=(55, 67), nb=3, periode=4.0)
    basse = ligne_basse(acc, [0, 2], vel=60, bas=38, haut=52, duree=1.6)
    cl = tierce_dessous(entre(notes, 8 * tpm, 24 * tpm), SOL_MAJEUR, 2, dv=-16, accords=acc)
    eclats = accords_frappes([a for a in acc if a.t >= 16 * tpm], [3.0], vel=32, nb=1, bas=79, haut=93, duree=0.8)
    pistes = [
        Piste("guitare", GUITARE, humain(guitare, 41, tempo), -2, pan=50, reverbe=0.3),
        Piste("basse", CONTREBASSE_PIZZ, humain(basse, 42, tempo, 0.008), -4, pan=64, reverbe=0.2),
        Piste("accordeon", ACCORDEON, humain(notes, 43, tempo, 0.016), 0, pan=76, reverbe=0.35, souffle=True),
        Piste("clarinette", CLARINETTE, cl, -6, pan=56, reverbe=0.4, souffle=True),
        Piste("glock", GLOCK, humain(eclats, 44, tempo, 0.01), -8, pan=82, reverbe=0.5),
    ]
    m = _morceau("bourg-soir", "Aubrune, le soir", tempo, (4, 4), tpm, 24, pistes, acc, 2.0, 4)
    return m, {"fond": ["guitare", "basse"], "air": ["accordeon", "clarinette", "glock"]}


def bourg_nuit() -> tuple[Morceau, dict]:
    """Nuit: seulement le début de chaque phrase du motif, au piano, sur une basse à l'archet; un
    éclat de glockenspiel de loin en loin. 4/4 à 60, 16 mesures, 64 s."""
    tempo, tpm = 60.0, 4.0
    acc = accords_de(G_P, tpm)
    complet = melodie(P, tpm, vel=40)
    clairsemee = [n for n in complet if int(n.t // tpm) % 4 < 2]
    basse = dans_accords(ligne_basse(acc, [0], vel=40, bas=38, haut=52, duree=3.95, quintes=False), acc)
    nappe = dans_accords(arpege(acc, [(0, 1, 3.9), (0.5, 2, 3.4)], vel=26, bas=40, haut_v=(52, 64), nb=2), acc)
    eclats = accords_frappes([a for a in acc if int(a.t // tpm) % 4 == 2], [1.0], vel=30, nb=1, bas=79, haut=91,
                             duree=1.0)
    pistes = [
        Piste("basse", CONTREBASSE_ARCO, basse, -7, pan=64, reverbe=0.35, souffle=True),
        Piste("nappe", PIANO, humain(nappe, 51, tempo, 0.02), -9, pan=60, reverbe=0.6),
        Piste("piano", PIANO, humain(clairsemee, 52, tempo, 0.02), -2, pan=68, reverbe=0.55),
        Piste("glock", GLOCK, eclats, -8, pan=76, reverbe=0.65),
    ]
    m = _morceau("bourg-nuit", "Aubrune, la nuit", tempo, (4, 4), tpm, 16, pistes, acc, 3.4, 5)
    return m, {"fond": ["basse", "nappe"], "air": ["piano", "glock"]}


def bourg_pluie() -> tuple[Morceau, dict]:
    """Pluie: le motif au piano doux, gouttes de glockenspiel sur les notes de l'accord, peu de
    basse. 4/4 à 80, 24 mesures, 72 s."""
    tempo, tpm = 80.0, 4.0
    phrases = [P[0], P[1], P[2], P[3], P[0], P[3]]
    gr = [G_P[0], G_P[1], G_P[2], G_P[3], G_P[0], G_P[3]]
    acc = accords_de(gr, tpm)
    notes = melodie(phrases, tpm, vel=52, legato=1.0)
    arp = dans_accords(arpege(acc, [(0, 0, 3.8), (1, 1, 1.2), (2, 2, 1.2), (3, 3, 0.95)], vel=34, bas=40, haut_v=(55, 67), nb=3), acc)
    basse = dans_accords(ligne_basse(acc, [0], vel=42, bas=38, haut=52, duree=3.9, quintes=False), acc)
    g = np.random.default_rng(61)
    gouttes: list[Note] = []
    for a in acc:
        pcs = [p for p in range(79, 94) if p % 12 in a.pcs]
        t = a.t + float(g.choice([0.5, 1.0, 1.5]))
        while t < a.t + a.d - 0.4:
            gouttes.append(Note(t, 0.5, int(g.choice(pcs)), int(g.integers(26, 42))))
            t += float(g.choice([0.75, 1.25, 1.75, 2.25]))
    cl = contrechant([a for a in acc if a.t >= 16 * tpm], 62, 74, vel=38)
    pistes = [
        Piste("arpeges", PIANO, humain(arp, 62, tempo, 0.02), -5, pan=56, reverbe=0.5, passe_haut=100),
        Piste("basse", CONTREBASSE_ARCO, basse, -9, pan=64, reverbe=0.3, souffle=True),
        Piste("piano", PIANO, humain(notes, 63, tempo, 0.02), -1, pan=70, reverbe=0.5),
        Piste("gouttes", GLOCK, gouttes, -9, pan=84, reverbe=0.6),
        Piste("clarinette", CLARINETTE, cl, -9, pan=54, reverbe=0.5, souffle=True),
    ]
    m = _morceau("bourg-pluie", "Aubrune sous la pluie", tempo, (4, 4), tpm, 24, pistes, acc, 2.4, 6)
    return m, {"fond": ["arpeges", "basse"], "air": ["piano", "gouttes", "clarinette"]}


def riviere() -> tuple[Morceau, dict]:
    """Rivière: le motif une quarte plus bas (mode de ré), guitare en arpèges qui coulent, piano
    en ruisseau aigu, clarinette douce à la reprise. 6/8 à 72, 28 mesures, 70 s."""
    tempo, tpm = 72.0, 3.0
    phrases = [Q[0], Q[1], Q[2], Q[3], Q[0], Q[1], Q[3]]
    base = melodie(phrases, tpm, vel=58)
    notes = degres(base, -3)
    grille_ = harmoniser(notes, 28, tpm, "D", candidats=["D", "G", "Em7", "Bm7", "Am7", "C", "Em"], fin="D")
    acc = grille(grille_, 0.0, tpm)
    guitare = arpege(acc, [(0, 0, 1.2), (0.5, 1, 0.7), (1, 2, 0.7), (1.5, 3, 0.7), (2, 2, 0.7), (2.5, 1, 0.7)],
                     vel=52, bas=40, haut_v=(55, 71), nb=3, periode=3.0)
    basse = ligne_basse(acc, [0], vel=56, bas=38, haut=52, duree=2.8, quintes=False)
    ruisseau = arpege(acc, [(0.25, 1, 0.5), (0.75, 3, 0.5), (1.25, 2, 0.5), (1.75, 3, 0.5), (2.25, 1, 0.5),
                            (2.75, 2, 0.5)], vel=34, bas=40, haut_v=(72, 88), nb=3, periode=3.0)
    ruisseau = [n for n in ruisseau if int(n.t // tpm) % 2 == 1]
    cl = decaler(entre(notes, 14 * tpm, 28 * tpm), transpo=0, dv=-8)
    pistes = [
        Piste("guitare", GUITARE, humain(guitare, 71, tempo), -2, pan=50, reverbe=0.4),
        Piste("basse", CONTREBASSE_PIZZ, humain(basse, 72, tempo, 0.008), -6, pan=64, reverbe=0.2),
        Piste("ruisseau", PIANO, humain(ruisseau, 73, tempo, 0.02), -9, pan=84, reverbe=0.55, passe_haut=250),
        Piste("clarinette", CLARINETTE, humain(notes, 74, tempo, 0.014), -1, pan=60, reverbe=0.45, souffle=True),
        Piste("glock", GLOCK, humain(decaler(cl, transpo=12), 75, tempo, 0.02), -9, pan=80, reverbe=0.6),
    ]
    m = _morceau("riviere", "L'air de la rivière", tempo, (6, 8), tpm, 28, pistes, acc, 2.2, 7)
    return m, {"fond": ["guitare", "basse", "ruisseau"], "air": ["clarinette", "glock"]}


def train() -> tuple[Morceau, dict]:
    """Train et voyage: le motif sur un balancement de brosses et une basse qui marche, accordéon
    puis clarinette. 4/4 à 120, 32 mesures, 64 s."""
    tempo, tpm = 120.0, 4.0
    acc = accords_de(G_P * 2, tpm)
    mel_ = melodie(P * 2, tpm, vel=66)
    pas1, pas2 = entre(mel_, 0, 16 * tpm), entre(mel_, 16 * tpm, 32 * tpm)
    harm = tierce_dessous(pas1, SOL_MAJEUR, 2, dv=-16, accords=acc)
    basse = ligne_basse(acc, [0, 1, 2, 3], vel=66, bas=38, haut=52, duree=0.8)
    guitare = accords_frappes(acc, [1, 3], vel=46, nb=3, bas=55, haut=69, duree=0.3)
    rails: list[Note] = []
    for mes in range(32):
        t0 = mes * tpm
        for k in range(8):  # croches en balancement: tch-a, tch-a
            rails.append(Note(t0 + k * 0.5, 0.2, 38, 46 if k % 2 == 0 else 30))
        rails.append(Note(t0, 0.2, 36, 40))
        rails.append(Note(t0 + 2, 0.2, 36, 34))
    pistes = [
        Piste("brosses", BROSSES, rails, -6, pan=64, reverbe=0.1, percussions=True, passe_haut=120),
        Piste("basse", CONTREBASSE_PIZZ, humain(basse, 82, tempo, 0.006), -3, pan=60, reverbe=0.12),
        Piste("guitare", GUITARE, humain(guitare, 83, tempo, 0.008), -5, pan=44, reverbe=0.2),
        Piste("accordeon", ACCORDEON, humain(pas1 + harm, 84, tempo, 0.01), 0, pan=78, reverbe=0.25, souffle=True),
        Piste("clarinette", CLARINETTE, humain(pas2, 85, tempo, 0.01), -1, pan=58, reverbe=0.25, souffle=True),
    ]
    m = _morceau("train", "L'air du train", tempo, (4, 4), tpm, 32, pistes, acc, 1.2, 8)
    return m, {"fond": ["brosses", "basse", "guitare"], "air": ["accordeon", "clarinette"]}


def mystere() -> tuple[Morceau, dict]:
    """Mystère: quelques notes de piano dans le mode de mi, basse à l'archet, un éclat de verre.
    Jamais de dissonance: tout est dans l'accord. 4/4 à 60, 15 mesures, 60 s."""
    tempo, tpm = 60.0, 4.0
    acc = grille("Em | Em | Cmaj7 | Cmaj7 | Em | Em | Am7 | Am7 | Cmaj7 | Cmaj7 | D | D | Em | Em | Em", 0.0, tpm)
    fig = mel("B4:2 G4:1 E4:1 | r:4 | D5:2 B4:2 | r:4 | E5:3 r:1 | r:4 | C5:2 E5:1 A4:1 | r:4 | "
              "G4:2 E4:2 | r:4 | A4:2 F#4:2 | r:4 | B4:2 G4:2 | r:4 | E4:4 |", vel=44, mesure=tpm, legato=1.0)
    basse = ligne_basse(acc, [0], vel=40, bas=40, haut=52, duree=3.95, quintes=False)
    nappe = arpege([a for a in acc if int(a.t // tpm) % 2 == 0], [(0, 1, 7.8), (0.4, 2, 7.4)], vel=22, bas=40,
                   haut_v=(52, 64), nb=2)
    eclats = [Note(6 * tpm + 2.0, 1.5, 88, 30), Note(11 * tpm + 1.0, 1.5, 83, 28), Note(13 * tpm + 2.0, 2.0, 91, 26)]
    pistes = [
        Piste("basse", CONTREBASSE_ARCO, basse, -8, pan=64, reverbe=0.4, souffle=True),
        Piste("nappe", PIANO, nappe, -12, pan=58, reverbe=0.7),
        Piste("piano", PIANO, humain(fig, 91, tempo, 0.03), -2, pan=66, reverbe=0.65),
        Piste("verre", GLOCK, eclats, -9, pan=78, reverbe=0.7),
    ]
    m = _morceau("mystere", "Le thème du mystère", tempo, (4, 4), tpm, 15, pistes, acc, 3.8, 9)
    return m, {"fond": ["basse", "nappe"], "air": ["piano", "verre"]}


def fete() -> tuple[Morceau, dict]:
    """Veillée de fête: valse de bal, oom-pah-pah de contrebasse et de guitare, accordéon puis
    clarinette, glockenspiel à la fin. 3/4 à 108, 48 mesures, 80 s."""
    tempo, tpm = 108.0, 3.0
    acc = accords_de(G_P * 3, tpm)
    mel_ = melodie(Q * 3, tpm, vel=68)
    pas1, pas2, pas3 = (entre(mel_, i * 16 * tpm, (i + 1) * 16 * tpm) for i in range(3))
    harm = tierce_dessous(pas2, SOL_MAJEUR, 2, dv=-14, accords=acc)
    basse = ligne_basse(acc, [0], vel=72, bas=38, haut=52, duree=0.6, quintes=False)
    pah = accords_frappes(acc, [1, 2], vel=44, nb=3, bas=55, haut=69, duree=0.3)
    piano = accords_frappes([a for a in acc if a.t >= 16 * tpm], [1, 2], vel=38, nb=3, bas=57, haut=70, duree=0.3)
    eclats = decaler(entre(mel_, 32 * tpm, 48 * tpm), transpo=12, dv=-24)
    pistes = [
        Piste("basse", CONTREBASSE_PIZZ, humain(basse, 101, tempo, 0.006), -3, pan=62, reverbe=0.12),
        Piste("guitare", GUITARE, humain(pah, 102, tempo, 0.008), -5, pan=44, reverbe=0.2),
        Piste("piano", PIANO, humain(piano, 103, tempo, 0.008), -9, pan=78, reverbe=0.25, passe_haut=200),
        Piste("accordeon", ACCORDEON, humain(pas1 + decaler(pas3, dv=-4) + harm, 104, tempo, 0.01), 0, pan=78,
              reverbe=0.3, souffle=True),
        Piste("clarinette", CLARINETTE, humain(pas2 + decaler(pas3, dv=-8), 105, tempo, 0.01), -1, pan=56,
              reverbe=0.3, souffle=True),
        Piste("glock", GLOCK, humain(eclats, 106, tempo, 0.01), -8, pan=84, reverbe=0.45),
    ]
    m = _morceau("fete", "La veillée de fête", tempo, (3, 4), tpm, 48, pistes, acc, 1.6, 10)
    return m, {"fond": ["basse", "guitare", "piano"], "air": ["accordeon", "clarinette", "glock"]}


MORCEAUX = [bourg_aube, bourg_matin, bourg_apres_midi, bourg_soir, bourg_nuit, bourg_pluie, riviere, train,
            mystere, fete]


# --- Jingles (2 à 4 s) et thème d'arrivée -----------------------------------------------------------

def _jingle(id_: str, titre: str, tempo: float, mesures: int, tpm: float, pistes: list[Piste], rt60: float,
            graine: int) -> Morceau:
    return Morceau(id=id_, titre=titre, tempo=tempo, signature=(4, 4), mesures=mesures, temps_par_mesure=tpm,
                   pistes=pistes, boucle=False, queue_s=1.2, rt60=rt60, graine=graine)


def jingle_prise_nouvelle() -> Morceau:
    """Prise nouvelle: arpège de glockenspiel qui monte (ré, sol, si, ré) sur un accord de sol."""
    m = _jingle("jingle-prise-nouvelle", "Prise nouvelle", 120, 1, 4.0, [
        Piste("glock", GLOCK, mel("D5:.25 G5:.25 B5:.25 D6:1.75", vel=84, legato=1.0), 0, 74, 0.5),
        Piste("accordeon", ACCORDEON, [Note(0.5, 1.6, 55, 54), Note(0.5, 1.6, 59, 54), Note(0.5, 1.6, 62, 54)], -5,
              60, 0.3, souffle=True),
        Piste("guitare", GUITARE, [Note(0.0, 1.4, 43, 70), Note(0.06, 1.4, 55, 66), Note(0.12, 1.4, 59, 66),
                                   Note(0.18, 1.4, 62, 66)], -3, 50, 0.3),
    ], 1.4, 201)
    return m


def jingle_etape_quete() -> Morceau:
    """Étape de quête: deux notes (la quarte du motif) et un repos, clarinette et glockenspiel."""
    return _jingle("jingle-etape-quete", "Étape de quête", 120, 1, 4.0, [
        Piste("clarinette", CLARINETTE, mel("D5:.5 G5:1.5", vel=78, legato=1.0), 0, 58, 0.35, souffle=True),
        Piste("glock", GLOCK, mel("r:.5 G6:1.5", vel=70, legato=1.0), -4, 76, 0.5),
        Piste("piano", PIANO, [Note(0.5, 1.2, 55, 44), Note(0.5, 1.2, 62, 44), Note(0.5, 1.2, 71, 40)], -9, 66, 0.4),
    ], 1.2, 202)


def jingle_quete_terminee() -> Morceau:
    """Quête terminée: le motif complet (ré, sol, si, la, sol) posé sur sol, avec une résolution."""
    return _jingle("jingle-quete-terminee", "Quête terminée", 126, 2, 4.0, [
        Piste("accordeon", ACCORDEON, mel("D4:.75 G4:.75 B4:1.25 A4:.75 G4:3", vel=76, legato=1.0), 0, 72, 0.35,
              souffle=True),
        Piste("guitare", GUITARE, [Note(0.0, 2.0, 43, 66), Note(0.06, 2.0, 50, 62), Note(0.12, 2.0, 59, 62),
                                   Note(3.0, 3.0, 43, 70), Note(3.06, 3.0, 55, 64), Note(3.12, 3.0, 62, 64),
                                   Note(3.18, 3.0, 67, 64)], -3, 48, 0.3),
        Piste("glock", GLOCK, mel("r:3 G5:.5 D6:.5 G6:2", vel=78, legato=1.0), -3, 80, 0.55),
        Piste("basse", CONTREBASSE_PIZZ, mel("G2:2 r:1 G2:2", vel=70), -5, 64, 0.2),
    ], 1.6, 203)


def jingle_reveil() -> Morceau:
    """Réveil: arpège de guitare qui monte dans la lumière, clarinette douce, éclat de glockenspiel."""
    return _jingle("jingle-reveil", "Réveil", 120, 2, 4.0, [
        Piste("guitare", GUITARE, mel("G3:.5 D4:.5 G4:.5 B4:.5 D5:2.5", vel=62, legato=1.1), 0, 50, 0.4),
        Piste("clarinette", CLARINETTE, mel("r:2 B4:1 D5:2", vel=60, legato=1.0), -3, 58, 0.4, souffle=True),
        Piste("glock", GLOCK, mel("r:2.5 G5:.5 B5:.5 D6:2", vel=70, legato=1.0), -4, 78, 0.55),
    ], 1.8, 204)


def jingle_repas_partage() -> Morceau:
    """Repas partagé: trois notes d'accordéon en valse et une petite basse qui rebondit."""
    m = _jingle("jingle-repas-partage", "Repas partagé", 132, 2, 3.0, [
        Piste("accordeon", ACCORDEON, mel("B4:.5 D5:.5 G5:1 B5:.5 A5:.5 G5:3", vel=76, legato=1.0), 0, 74, 0.3,
              souffle=True),
        Piste("basse", CONTREBASSE_PIZZ, mel("G2:1 r:2 D3:1 r:1 G2:2", vel=72), -3, 62, 0.15),
        Piste("guitare", GUITARE, [Note(1.0, 0.4, 55, 56), Note(1.0, 0.4, 59, 56), Note(1.0, 0.4, 62, 56),
                                   Note(2.0, 0.4, 55, 52), Note(2.0, 0.4, 59, 52), Note(2.0, 0.4, 62, 52),
                                   Note(4.0, 1.0, 55, 58), Note(4.0, 1.0, 59, 58), Note(4.0, 1.0, 62, 58)], -6, 46,
              0.2),
    ], 1.2, 205)
    m.signature = (3, 4)
    return m


def jingle_collection_complete() -> Morceau:
    """Collection complète: cascade pentatonique de glockenspiel et accord de sol qui s'ouvre."""
    return _jingle("jingle-collection-complete", "Collection complète", 126, 2, 4.0, [
        Piste("glock", GLOCK, mel("G5:.25 A5:.25 B5:.25 D6:.25 E6:.25 G6:.25 B6:.25 D7:2.5", vel=80, legato=1.0),
              0, 76, 0.5),
        Piste("piano", PIANO, [Note(1.8, 3.0, 43, 56), Note(1.8, 3.0, 55, 54), Note(1.8, 3.0, 62, 54),
                               Note(1.8, 3.0, 66, 54), Note(1.8, 3.0, 71, 52)], -4, 60, 0.45),
        Piste("accordeon", ACCORDEON, [Note(1.8, 2.6, 55, 52), Note(1.8, 2.6, 62, 52), Note(1.8, 2.6, 66, 52)], -7,
              70, 0.3, souffle=True),
    ], 1.8, 206)


def theme_arrivee_aubrune() -> Morceau:
    """Thème d'arrivée à Aubrune: le début du motif du quai, accordéon et guitare, éclat de verre.
    Court (6 s, tout compris) et sur sol, pour s'enchaîner avec n'importe quel moment du bourg."""
    return _jingle("theme-arrivee-aubrune", "Arrivée à Aubrune", 100, 2, 4.0, [
        Piste("accordeon", ACCORDEON, mel("D4:1 G4:1 B4:1.5 A4:.5 | G4:2.5", vel=74, mesure=4.0, legato=1.0), 0, 74,
              0.35, souffle=True),
        Piste("guitare", GUITARE, arpege(grille("G | G", 0.0, 4.0),
                                          [(0, 0, 2.0), (1, 1, 1.0), (2, 2, 1.0), (3, 3, 1.0)], vel=58, bas=40,
                                          haut_v=(55, 69), nb=3), -3, 46, 0.35),
        Piste("glock", GLOCK, mel("r:5 G5:.5 D6:.5 B5:2", vel=66, legato=1.0), -5, 80, 0.55),
        Piste("basse", CONTREBASSE_PIZZ, mel("G2:2 r:2 G2:2 D3:1", vel=62), -5, 64, 0.2),
    ], 1.8, 207)


JINGLES = [jingle_prise_nouvelle, jingle_etape_quete, jingle_quete_terminee, jingle_reveil,
           jingle_repas_partage, jingle_collection_complete, theme_arrivee_aubrune]
