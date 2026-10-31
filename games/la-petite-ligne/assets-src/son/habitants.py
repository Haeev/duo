"""Motifs des habitants et petits airs du jeu, écrits en MIDI et rendus par FluidSynth.

Un motif par habitant, joué à l'ouverture d'une conversation, à la place d'une voix (aucune
voix, aucun charabia, cahier section 6.12). Chacun dit le caractère en deux secondes:
- Odette, gourmande, bavarde, rieuse: accordéon qui sautille et finit sur un petit rire;
- Firmin, bourru, ponctuel, tendre: la pendule (tic-tac), deux notes bougonnes du basson,
  puis un accord tendre du cor;
- Lucie, factrice pressée: la flûte qui file, et la sonnette de son vélo;
- Basile, taiseux, patient, menuisier: trois notes de marimba (du bois) sur un violoncelle;
- Jeanne, dix ans, mille questions: la flûte à bec qui monte et reste en l'air, comme une
  question, avec un petit trille d'oiseau.
Tous en sol majeur, comme le thème de jour qu'ils interrompent.
"""

from __future__ import annotations

from pathlib import Path

import numpy as np

import dsp
import instruments as ins
from catalogue import Son
from partition import Morceau, Note, Piste, mel

ICI = Path(__file__).resolve().parent
MIDI = ICI / "midi"

ACCORDEON, BASSON, COR, CLARINETTE, FLUTE, FLUTE_A_BEC = 21, 70, 60, 71, 73, 74
PIZZ, HARPE, CELESTA, GLOCK, MARIMBA, VIOLONCELLE, CORDES = 45, 46, 8, 9, 12, 42, 49


def _rendre(m: Morceau) -> np.ndarray:
    from partition import produire

    y, _ = produire(m, MIDI)
    return y


def _court(id_: str, tempo: float, pistes: list[Piste], queue: float = 2.0, rt60: float = 1.2) -> Morceau:
    fin = max(n.t + n.d for p in pistes for n in p.notes)
    mesures = int(np.ceil(fin / 4.0))
    return Morceau(id=id_, titre=id_, tempo=tempo, signature=(4, 4), mesures=mesures, temps_par_mesure=4.0,
                   pistes=pistes, boucle=False, queue_s=queue, rt60=rt60, sonie_cible=-20.0)


def _accord(t: float, d: float, notes: list[str], v: int) -> list[Note]:
    return [Note(t, d, dsp.note_midi(n), v) for n in notes]


def motif_odette(v: int, rng: np.random.Generator) -> np.ndarray:
    melodie = mel("B4:.5 D5:.5 G5:.5 F#5:.25 E5:.25 D5:.5 B4:.5 r:.25 D5:.125 E5:.125 D5:.125 E5:.125 G5:.75", 0.0, 86,
                  legato=0.8)
    basse = [Note(0.0, 0.4, 43, 70), Note(1.0, 0.4, 50, 64), Note(2.0, 0.4, 43, 66), Note(3.0, 0.4, 50, 60)]
    frappes = sum((_accord(t, 0.25, ["G4", "B4", "D5"], 50) for t in (0.5, 1.5, 2.5)), [])
    m = _court("motif-odette", 132.0, [
        Piste("accordeon", ACCORDEON, melodie, 0.0, pan=60, reverbe=0.2),
        Piste("accordeon_frappe", ACCORDEON, frappes, -9.0, pan=70, reverbe=0.2, canal=1),
        Piste("pizz", PIZZ, basse, -7.0, pan=64, reverbe=0.15),
    ])
    return _rendre(m)


def motif_firmin(v: int, rng: np.random.Generator) -> np.ndarray:
    tictac = [Note(t, 0.1, 76 if k % 2 == 0 else 77, 58) for k, t in enumerate((0.0, 0.5, 1.0, 1.5))]
    basson = mel("G2:.5 G2:.5 D3:.5 B2:.5 G2:2", 0.0, 84, legato=0.55)
    basson[-1] = Note(basson[-1].t, 2.0, basson[-1].p, 64)
    cor = _accord(2.0, 2.0, ["D4"], 66)
    clar = _accord(2.0, 2.0, ["B3"], 58)
    m = _court("motif-firmin", 104.0, [
        Piste("basson", BASSON, basson, 0.0, pan=56, reverbe=0.2),
        Piste("cor", COR, cor, -3.0, pan=64, reverbe=0.3, souffle=True),
        Piste("clarinette", CLARINETTE, clar, -7.0, pan=70, reverbe=0.3, souffle=True),
        Piste("pendule", 0, tictac, -9.0, pan=40, reverbe=0.15, percussions=True),
    ])
    return _rendre(m)


def _sonnette_velo(rng: np.random.Generator) -> np.ndarray:
    y = dsp.toile(0.9, stereo=True)
    for groupe in (0.0, 0.32):
        for k in range(4):
            coup = ins.metal(rng, 2150, 0.6, t60=0.5, rapports=(1.0, 1.52, 2.6, 3.3), amps=(1.0, 0.5, 0.3, 0.12))
            dsp.poser(y, coup * 0.35, groupe + k * 0.045, pan=0.25)
    return y


def motif_lucie(v: int, rng: np.random.Generator) -> np.ndarray:
    flute = mel("D5:.25 E5:.25 F#5:.25 G5:.25 A5:.25 B5:.25 D6:.75", 0.0, 84, legato=0.9)
    pizz = _accord(0.0, 0.5, ["G3", "D4"], 66) + _accord(1.5, 0.5, ["G3", "B3", "G4"], 70)
    m = _court("motif-lucie", 140.0, [
        Piste("flute", FLUTE, flute, 0.0, pan=60, reverbe=0.22),
        Piste("pizz", PIZZ, pizz, -7.0, pan=70, reverbe=0.15),
    ], queue=1.5)
    y = _rendre(m)
    sonnette = _sonnette_velo(rng)
    dsp.poser(y, sonnette * 10 ** (dsp.sonie_momentanee_max(y) / 20) / 10 ** (dsp.sonie_momentanee_max(sonnette) / 20) * 0.6,
              1.05)
    return y


def motif_basile(v: int, rng: np.random.Generator) -> np.ndarray:
    marimba = mel("G3:1 D4:1.5 B3:1.5", 0.0, 80, legato=1.0)
    celle = [Note(0.0, 3.6, 43, 52)]
    m = _court("motif-basile", 66.0, [
        Piste("marimba", MARIMBA, marimba, 0.0, pan=60, reverbe=0.25),
        Piste("violoncelle", VIOLONCELLE, celle, -6.0, pan=66, reverbe=0.3, souffle=True),
    ], queue=2.0)
    return _rendre(m)


def motif_jeanne(v: int, rng: np.random.Generator) -> np.ndarray:
    flute = mel("G5:.25 A5:.25 B5:.5 D6:.25 E6:1", 0.0, 82, legato=0.92)
    trille = mel("r:1.25 E6:.0625 F#6:.0625 E6:.0625 F#6:.0625", 0.0, 46, legato=0.9)
    pizz = _accord(0.0, 0.5, ["G3"], 64) + _accord(1.25, 1.0, ["C4", "E4"], 56)
    m = _court("motif-jeanne", 120.0, [
        Piste("flute_a_bec", FLUTE_A_BEC, flute, 0.0, pan=62, reverbe=0.22),
        Piste("glock", GLOCK, trille, -10.0, pan=78, reverbe=0.3),
        Piste("pizz", PIZZ, pizz, -8.0, pan=66, reverbe=0.15),
    ], queue=1.5)
    return _rendre(m)


def air_carnet(v: int, rng: np.random.Generator) -> np.ndarray:
    """Nouvelle page du carnet: la même tête (ré, sol, si), trois fins pour ne pas lasser."""
    fins = ["A5:.25 G5:.75", "C6:.25 D6:.75", "D6:.25 G6:.75"]
    celesta = mel("D5:.25 G5:.25 B5:.5 " + fins[v % 3], 0.0, 80, legato=1.0)
    harpe = [Note(0.06 * k, 2.0, p, 60 - 3 * k) for k, p in enumerate((55, 59, 62, 67))]
    m = _court(f"air-carnet-{v + 1}", 112.0, [
        Piste("celesta", CELESTA, celesta, 0.0, pan=58, reverbe=0.3),
        Piste("harpe", HARPE, harpe, -6.0, pan=72, reverbe=0.3),
    ], queue=2.0)
    return _rendre(m)


def air_a_deux(v: int, rng: np.random.Generator) -> np.ndarray:
    """Le geste à deux réussi: flûte et clarinette disent le même air, en tierces et sixtes."""
    flute = mel("G5:.25 B5:.25 D6:.5 G6:1", 0.0, 80)
    clar = mel("B4:.25 D5:.25 G5:.5 B5:1", 0.0, 74)
    harpe = [Note(1.0 + 0.05 * k, 1.5, p, 56) for k, p in enumerate((43, 50, 55, 59, 62))]
    m = _court("air-a-deux", 120.0, [
        Piste("flute", FLUTE, flute, 0.0, pan=78, reverbe=0.25),
        Piste("clarinette", CLARINETTE, clar, -1.5, pan=50, reverbe=0.25),
        Piste("harpe", HARPE, harpe, -7.0, pan=64, reverbe=0.3),
    ], queue=1.8)
    return _rendre(m)


def air_coucher(v: int, rng: np.random.Generator) -> np.ndarray:
    harpe = mel("D6:.25 B5:.25 G5:.25 D5:.25 B4:.25 G4:1.5", 0.0, 64, legato=1.6)
    cordes = _accord(0.25, 2.5, ["G3", "B3", "D4"], 50)
    celesta = mel("r:1.5 G6:1.5", 0.0, 44)
    m = _court("air-coucher", 60.0, [
        Piste("harpe", HARPE, harpe, 0.0, pan=60, reverbe=0.4),
        Piste("cordes", CORDES, cordes, -6.0, pan=64, reverbe=0.45, souffle=True),
        Piste("celesta", CELESTA, celesta, -9.0, pan=74, reverbe=0.45),
    ], queue=2.5, rt60=1.8)
    return _rendre(m)


def air_reveil(v: int, rng: np.random.Generator) -> np.ndarray:
    flute = mel("D5:.5 G5:.5 B5:.5 A5:.25 B5:.25 D6:1", 0.0, 78)
    harpe = [Note(0.05 * k, 2.0, p, 56) for k, p in enumerate((43, 50, 55, 59))]
    pizz = _accord(2.0, 0.5, ["G2", "D3"], 60)
    m = _court("air-reveil", 100.0, [
        Piste("flute", FLUTE, flute, 0.0, pan=64, reverbe=0.3, souffle=True),
        Piste("harpe", HARPE, harpe, -5.0, pan=72, reverbe=0.3),
        Piste("pizz", PIZZ, pizz, -8.0, pan=60, reverbe=0.2),
    ], queue=2.0)
    return _rendre(m)


def coq(v: int, rng: np.random.Generator) -> np.ndarray:
    """Le coq d'un voisin, au bout du bourg: plus doux et plus drôle de loin."""
    y = dsp.pb(ins.coq(rng), 4500)
    ir = dsp.ir_salle(1.4, 0.03, 0.35, graine=41)
    return dsp.reverbe_mono(y, ir, 0.35, 1.0)


def sons() -> list[Son]:
    motif = "joué à l'ouverture d'une conversation, chez celui qui parle à l'habitant; musique atténuée"
    return [
        Son("talk-odette", "Motif d'Odette Ferrand, l'épicière", "habitants", "ui", motif_odette, 1, -19.0, 2, 0.0,
            0.0, None, canaux=2, duree_max=3.0, duck_db=-8.0, intervalle_min_ms=4000, note=motif),
        Son("talk-firmin", "Motif de Firmin Lacombe, le chef de halte", "habitants", "ui", motif_firmin, 1, -19.0, 2,
            0.0, 0.0, None, canaux=2, duree_max=3.3, duck_db=-8.0, intervalle_min_ms=4000, note=motif),
        Son("talk-lucie", "Motif de Lucie Arnaud, la factrice (citée dans la démo)", "habitants", "ui", motif_lucie, 1,
            -19.0, 2, 0.0, 0.0, None, canaux=2, duree_max=2.4, duck_db=-8.0, intervalle_min_ms=4000, note=motif),
        Son("talk-basile", "Motif de Basile Cornu, le menuisier", "habitants", "ui", motif_basile, 1, -19.5, 2, 0.0,
            0.0, None, canaux=2, duree_max=4.0, duck_db=-8.0, intervalle_min_ms=4000, note=motif),
        Son("talk-jeanne", "Motif de Jeanne Ribot, dix ans", "habitants", "ui", motif_jeanne, 1, -19.0, 2, 0.0, 0.0,
            None, canaux=2, duree_max=2.4, duck_db=-8.0, intervalle_min_ms=4000, note=motif),
        Son("journal-new", "Nouvelle page du carnet, nouvelle quête, quête réussie (court air)", "interface", "ui",
            air_carnet, 3, -18.0, 2, 0.0, 0.0, None, canaux=2, duree_max=2.6, duck_db=-6.0, intervalle_min_ms=1500),
        Son("duo-done", "Geste à deux réussi (petit air « à deux »)", "interface", "ui", air_a_deux, 1, -18.5, 2, 0.0,
            0.0, None, canaux=2, duree_max=2.8, duck_db=-6.0),
        Son("sleep", "Se coucher (endormissement)", "interface", "ui", air_coucher, 1, -21.0, 3, 0.0, 0.0, None,
            canaux=2, duree_max=5.0, duck_db=-10.0, note="la musique de nuit suit, en fondu"),
        Son("wake", "Réveil (air du matin, avant le petit-déjeuner)", "interface", "ui", air_reveil, 1, -20.0, 3, 0.0,
            0.0, None, canaux=2, duree_max=3.6),
        Son("wake-rooster", "Le coq du bourg, au réveil", "effets", "effects", coq, 1, -22.0, 3, 0.03, 0.0, None,
            passe_haut=250, note="non placé (il est au bout du bourg); joué juste avant wake"),
    ]
