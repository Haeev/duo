"""Airs et événements de la démo: ouverture et fermeture du service (le motif de la maison),
fanfare légère d'un événement, arrivée d'un client spécial, clochette du marché
(son.md, 8.3.3, 8.5.18, 8.5.19). Tout ce qui tinte est en do pentatonique.

Les deux airs à instruments (fanfare, client spécial) sont rendus par FluidSynth comme les
musiques; leurs partitions vont dans midi/.
"""

from __future__ import annotations

from pathlib import Path

import numpy as np

import dsp
import instruments as ins
import timbres as tb
from catalogue import SR_CLAIR, Son
from partition import Morceau, Note, Piste, accords_frappes, grille, humaniser, ligne_basse, mel
from musiques import ACCORDEON, CONTREBASSE, PIZZ

ICI = Path(__file__).resolve().parent
F = tb.note
TROMPETTE_BOUCHEE, BASSON, GLOCK, CELESTA = 59, 70, 9, 8


def _motif(rng: np.random.Generator, notes: list[tuple[str, float]], bois_aussi: bool) -> np.ndarray:
    """Le motif joué sur des tasses frappées (ta voix) et, à deux, sur le bol de bois (celle de l'autre)."""
    fin = notes[-1][1] + 1.6
    y = dsp.toile(fin, stereo=True)
    for k, (nom, t) in enumerate(notes):
        dernier = k == len(notes) - 1
        dsp.poser(y, tb.porcelaine(rng, F(nom), 1.4 if dernier else 0.9, 0.9 if dernier else 0.6) * 0.55, t, pan=-0.2)
        if bois_aussi:
            dsp.poser(y, tb.bol_bois(rng, F(nom) / 2, 1.0) * 0.5, t + 0.012, pan=0.2)
    return y


def _ouverture(v: int, rng: np.random.Generator) -> np.ndarray:
    # Sol, la, do (on ouvre la porte), ré, do (on se pose).
    return _motif(rng, [("G5", 0.0), ("A5", 0.22), ("C6", 0.44), ("D6", 0.9), ("C6", 1.25)], True)


def _fermeture(v: int, rng: np.random.Generator) -> np.ndarray:
    # Le motif qui se pose, plus lent et vers le grave: la, sol, mi, ré, do.
    return _motif(rng, [("A5", 0.0), ("G5", 0.3), ("E5", 0.6), ("D5", 1.05), ("C5", 1.5)], True)


def _clochette_marche(v: int, rng: np.random.Generator) -> np.ndarray:
    """La clochette à main du marché (tournée du marchand, place du jour de marché): on la secoue,
    deux coups par balancement, cinq balancements; sol."""
    y = dsp.toile(2.6)
    t = 0.0
    for k in range(5):
        for j in range(2):
            dsp.poser(y, ins.clochette(F("G5"), 1.2, rng, brillance=0.6, t60=0.9) * (0.9 if j == 0 else 0.6), t)
            t += 0.12
        t += 0.2
    return dsp.pb(y, 4500, 2)


def _rendu(m: Morceau) -> np.ndarray:
    import partition

    erreurs = partition.frottements(m)
    if erreurs:
        raise SystemExit(f"{m.id}: frottements:\n  " + "\n  ".join(erreurs))
    y, _ = partition.produire(m, ICI / "midi")
    return y


def _fanfare(v: int, rng: np.random.Generator) -> np.ndarray:
    """Fanfare légère d'un événement (défi, fête, bonne nouvelle): trompette bouchée, accordéon,
    glockenspiel, petite caisse; do majeur, deux mesures et une note tenue."""
    tempo = 132.0
    acc = grille("C F | G C | C", 0.0, 4.0)
    tromp = mel("G4:.5 C5:.5 E5:.5 G5:.5 A5:1 G5:1 | E5:.5 G5:.5 D5:.5 E5:.5 C5:2 | C5:3 r:1 |", 0.0, 90, 4.0,
                legato=0.85)
    glock = [Note(n.t, min(n.d, 0.8), n.p + 12, 70) for n in tromp if n.t >= 0]
    accord = accords_frappes(acc[:-1], [0.0, 1.0], vel=60, nb=3, bas=55, haut=70, duree=0.35)
    accord += [Note(8.0, 2.6, p, 64) for p in (60, 64, 67)]
    basse = ligne_basse(acc[:-1], [0.0], vel=74, bas=36, haut=50, duree=0.9) + [Note(8.0, 2.6, 36, 72)]
    caisse = [Note(t, 0.2, 38, 46 + (10 if t % 1 < 0.01 else 0)) for t in np.arange(0.0, 8.0, 0.5)]
    caisse += [Note(8.0 + 0.0625 * k, 0.1, 38, 30 + k) for k in range(16)]  # petit roulement final
    m = Morceau(accords=acc, id="event-fanfare", titre="Fanfare légère", tempo=tempo, signature=(4, 4), mesures=3,
                temps_par_mesure=4.0, graine=51, rt60=1.0, boucle=False, queue_s=2.0, sonie_cible=-18.0,
                pistes=[Piste("trompette", TROMPETTE_BOUCHEE, humaniser(tromp, rng, 0.005, 3, tempo), sonie_lu=0.0,
                              pan=56, reverbe=0.2),
                        Piste("glock", GLOCK, glock, sonie_lu=-9.0, pan=84, reverbe=0.3),
                        Piste("accordeon", ACCORDEON, accord, sonie_lu=-6.0, pan=40, reverbe=0.2),
                        Piste("basse", CONTREBASSE, basse, sonie_lu=-7.0, pan=64, reverbe=0.1),
                        Piste("caisse", 0, caisse, sonie_lu=-12.0, pan=70, reverbe=0.2, percussions=True)])
    return _rendu(m)


def _client_special(v: int, rng: np.random.Generator) -> np.ndarray:
    """Un client spécial entre: un motif mystérieux et bienveillant (basson, pizzicati, célesta), la mineur."""
    tempo = 96.0
    acc = grille("Am | E7 Am | Am", 0.0, 4.0)
    basson = mel("A3:1 C4:1 E4:1.5 D4:.5 | B3:1 G#3:1 A3:2 | r:4 |", 0.0, 76, 4.0)
    pizz = []
    for a in acc[:-1]:
        notes = sorted({p for p in range(45, 70) if p % 12 in a.pcs})[:4]
        for k in range(int(a.d / 0.5)):
            pizz.append(Note(a.t + 0.5 * k, 0.4, notes[[0, 2, 1, 3][k % 4]], 58 - 4 * (k % 2)))
    celesta = [Note(8.0, 2.0, 76, 50), Note(8.25, 1.8, 81, 46), Note(8.5, 1.6, 84, 44)]
    m = Morceau(accords=acc, id="special-guest", titre="Un client spécial", tempo=tempo, signature=(4, 4), mesures=3,
                temps_par_mesure=4.0, graine=53, rt60=1.4, boucle=False, queue_s=2.5, sonie_cible=-18.0,
                pistes=[Piste("basson", BASSON, humaniser(basson, rng, 0.006, 3, tempo), sonie_lu=0.0, pan=58,
                              reverbe=0.28, souffle=True),
                        Piste("pizz", PIZZ, humaniser(pizz, rng, 0.006, 3, tempo), sonie_lu=-5.0, pan=40, reverbe=0.25),
                        Piste("celesta", CELESTA, celesta, sonie_lu=-8.0, pan=86, reverbe=0.4)])
    return _rendu(m)


def sons() -> list[Son]:
    Ai, Ma = "airs", "moments/marche"
    return [
        Son("service-open", "Le service commence: le motif de la maison (sol, la, do, ré, do)", Ai, "interface",
            _ouverture, 1, -19, 1, 0.0, spatial=None, canaux=2, sr=SR_CLAIR, duck_db=-4.0, queue_reverbe=(0.5, 0.18)),
        Son("service-close", "Le service se termine: le motif qui se pose", Ai, "interface", _fermeture, 1, -20, 1, 0.0,
            spatial=None, canaux=2, sr=SR_CLAIR, duck_db=-4.0, queue_reverbe=(0.5, 0.18)),
        Son("event-fanfare", "Fanfare légère: un événement de la journée (défi, fête, bonne nouvelle)", Ai, "interface",
            _fanfare, 1, -19, 1, 0.0, spatial=None, canaux=2, sr=SR_CLAIR, duck_db=-6.0, duree_max=7.0),
        Son("special-guest", "Un client spécial entre (le guide, un habitué attendu): motif mystérieux et bienveillant",
            Ai, "interface", _client_special, 1, -20, 1, 0.0, spatial=None, canaux=2, sr=SR_CLAIR, duck_db=-6.0,
            duree_max=7.0),
        Son("market-bell", "La clochette à main du marché, au loin (sol)", Ma, "ambience", _clochette_marche, 1, -28, 3,
            0.0, spatial="rue", sr=SR_CLAIR,
            note="Ormeval n'a pas de marché (cahier, TE-09): à jouer pour une tournée de marchand ambulant ou à Mérelles"),
    ]
