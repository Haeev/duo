"""Sons d'interface de la plateforme Duo, identité « Étoile double ».

Toutes les notes sont prises dans la gamme pentatonique de ré majeur (ré, mi, fa#, la, si):
deux sons qui se chevauchent restent consonants entre eux et avec la musique du salon (ré lydien).

Chaque son est une fonction (variante) -> signal stéréo brut. La normalisation, la réverbération
commune et l'encodage sont faits par generer.py, d'après le registre SONS en bas de fichier.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Callable

import numpy as np

from synthese import (SR, feutre, freq, harmonica, harpe, nappe, passe_bas_variable,
                      phase_accordee, poser, toile, verre)

# Toi à gauche, l'autre à droite (convention de la spécification UX, section 0.4), en restant discret.
PAN_TOI = -0.1
PAN_AUTRE = 0.35


def n(nom: str) -> float:
    return freq(nom)


def lueur(f: float, duree: float, vel: float, **kw) -> np.ndarray:
    """La nappe sous les sons d'interface: une lueur discrète, jamais plus présente que les cloches."""
    return nappe(f, duree, 0.5 * vel, **kw)


# --- Navigation --------------------------------------------------------------------------

def focus(v: int) -> np.ndarray:
    t60, b, g = [(0.10, 0.55, 11), (0.12, 0.45, 12), (0.085, 0.65, 13)][v]
    x = toile(0.5)
    poser(x, verre(n("E6"), 0.45, 1.0, t60=t60, brillance=b, graine=g, attaque=0.0015), 0.0)
    return x


def confirm(v: int) -> np.ndarray:
    delai, vel2, b, g = [(0.045, 0.85, 0.9, 21), (0.038, 0.78, 1.0, 24), (0.055, 0.92, 0.82, 27)][v]
    x = toile(1.4)
    poser(x, verre(n("A5"), 1.2, 0.8, t60=0.55, brillance=b, graine=g), 0.0, PAN_TOI)
    poser(x, verre(n("E6"), 1.2, vel2, t60=0.62, brillance=b, graine=g + 1), delai, PAN_TOI)
    return x


def back(v: int) -> np.ndarray:
    delai, vel2, b, g = [(0.05, 0.9, 0.4, 31), (0.043, 0.85, 0.45, 34), (0.06, 0.95, 0.35, 37)][v]
    x = toile(1.3)
    poser(x, verre(n("E6"), 1.1, 0.7, t60=0.42, brillance=b, graine=g), 0.0, PAN_TOI)
    poser(x, verre(n("A5"), 1.1, vel2, t60=0.5, brillance=b, graine=g + 1), delai, PAN_TOI)
    return x


def error(v: int) -> np.ndarray:
    delai, vel2, g = [(0.11, 0.9, 41), (0.125, 0.85, 44)][v]
    x = toile(1.2)
    poser(x, feutre(n("D5"), 0.9, 0.85, t60=0.32, graine=g), 0.0)
    poser(x, feutre(n("B4"), 0.9, vel2, t60=0.42, graine=g + 1), delai)
    return passe_bas_variable(x, lambda t: 2600.0)


def notify(v: int) -> np.ndarray:
    delai, vel2, g = [(0.075, 0.9, 51), (0.065, 0.85, 54)][v]
    x = toile(1.6)
    poser(x, verre(n("F#5"), 1.4, 0.75, t60=0.7, brillance=0.6, graine=g), 0.0)
    poser(x, verre(n("A5"), 1.4, vel2, t60=0.8, brillance=0.6, graine=g + 1), delai)
    return x


def volume_test(v: int) -> np.ndarray:
    x = toile(1.2)
    poser(x, verre(n("A5"), 1.1, 1.0, t60=0.55, brillance=0.7, graine=61), 0.0)
    return x


# --- Présence et invitation ----------------------------------------------------------------

def peer_here(v: int) -> np.ndarray:
    """Deux notes qui s'accordent: la tienne, tenue, et celle de l'autre, d'abord désaccordée
    (battements), qui se pose sur la même hauteur. Puis la quinte de l'autre, comme un salut."""
    x = toile(3.2)
    la = n("A5")
    depart = la * 2 ** (-32 / 1200)
    poser(x, harmonica(la, 2.6, 0.6, t60=3.0, attaque=0.07, phase=0.0), 0.0, PAN_TOI)
    poser(x, harmonica(depart, 2.6, 0.6, f_fin=la, tau=0.2, t60=3.0, attaque=0.09,
                       phase=phase_accordee(la, depart, 0.2, 0.04)), 0.04, PAN_AUTRE)
    poser(x, harpe(n("E6"), 2.0, 0.32, t60=1.3, graine=73), 0.72, PAN_AUTRE)
    return x


def invite(v: int) -> np.ndarray:
    """L'autre t'appelle: arpège montant à la harpe (sa voix), qui finit sur mi, une question;
    puis l'écho des deux dernières notes. Une nappe douce donne de la présence sans forcer."""
    x = toile(3.6)
    for i, (note, vel) in enumerate([("D5", 0.7), ("F#5", 0.72), ("A5", 0.78), ("E6", 0.85)]):
        poser(x, harpe(n(note), 2.4, vel, t60=1.6, graine=80 + i), 0.11 * i, PAN_AUTRE)
    poser(x, harpe(n("A5"), 2.0, 0.42, t60=1.2, graine=85), 0.78, PAN_AUTRE)
    poser(x, harpe(n("E6"), 2.0, 0.48, t60=1.4, graine=86), 0.87, PAN_AUTRE)
    poser(x, verre(n("E7"), 1.5, 0.08, t60=1.0, brillance=0.3, graine=87), 0.36, 0.5)
    for note in ("D4", "A4"):
        poser(x, lueur(n(note), 0.7, 0.16, attaque=0.25, relache=1.4, coupure=1200, graine=88), 0.0)
    return x


# --- Salon et départ -------------------------------------------------------------------------

def ready_self(v: int) -> np.ndarray:
    x = toile(1.8)
    for i, (note, vel) in enumerate([("A5", 0.72), ("D6", 0.85), ("F#6", 0.6)]):
        poser(x, verre(n(note), 1.6, vel, t60=0.9, brillance=0.85, graine=90 + i), 0.06 * i, PAN_TOI)
    return x


def ready_peer(v: int) -> np.ndarray:
    x = toile(2.2)
    for i, (note, vel) in enumerate([("A4", 0.75), ("D5", 0.85), ("F#5", 0.7)]):
        poser(x, harpe(n(note), 2.0, vel, t60=1.2, graine=95 + i), 0.07 * i, PAN_AUTRE)
    return x


def not_ready_peer(v: int) -> np.ndarray:
    x = toile(2.0)
    for i, (note, vel) in enumerate([("F#5", 0.7), ("D5", 0.75), ("A4", 0.7)]):
        poser(x, harpe(n(note), 1.8, vel, t60=0.9, brillance=0.8, graine=100 + i), 0.085 * i, PAN_AUTRE)
    return passe_bas_variable(x, lambda t: 3000.0)


def countdown_tick(v: int) -> np.ndarray:
    x = toile(0.95)
    poser(x, verre(n("A5"), 0.9, 0.85, t60=0.45, brillance=0.65, graine=111), 0.0)
    poser(x, feutre(n("A4"), 0.9, 0.35, t60=0.35, graine=112), 0.0)
    return x


def countdown_go(v: int) -> np.ndarray:
    """Départ: tes notes et celles de l'autre en même temps, sur un accord de ré qui s'ouvre."""
    x = toile(3.2)
    poser(x, verre(n("D6"), 2.6, 0.8, t60=1.4, brillance=0.8, graine=121), 0.0, PAN_TOI)
    poser(x, harpe(n("D5"), 2.6, 0.75, t60=1.6, graine=122), 0.0, PAN_AUTRE)
    poser(x, verre(n("F#6"), 2.4, 0.5, t60=1.2, brillance=0.7, graine=123), 0.035, PAN_TOI)
    poser(x, verre(n("A6"), 2.4, 0.42, t60=1.1, brillance=0.6, graine=124), 0.07, PAN_TOI)
    poser(x, harpe(n("A5"), 2.4, 0.5, t60=1.4, graine=125), 0.05, PAN_AUTRE)
    for note in ("D4", "A4", "F#5"):
        poser(x, lueur(n(note), 0.5, 0.18, attaque=0.04, relache=1.6, coupure=2000, graine=126), 0.0)
    return x


def countdown_cancel(v: int) -> np.ndarray:
    x = toile(1.4)
    poser(x, feutre(n("A5"), 1.2, 0.75, t60=0.4, graine=131), 0.0)
    poser(x, feutre(n("E5"), 1.2, 0.8, t60=0.5, graine=132), 0.1)
    return passe_bas_variable(x, lambda t: 3500.0 * np.exp(-t / 0.25) + 700.0)


# --- En partie --------------------------------------------------------------------------------

def pause(v: int) -> np.ndarray:
    """La nuit se fige: deux notes qui descendent pendant qu'un passe-bas se referme."""
    x = toile(1.8)
    poser(x, verre(n("D6"), 1.6, 0.75, t60=0.8, brillance=0.8, graine=141), 0.0)
    poser(x, verre(n("A5"), 1.6, 0.8, t60=0.95, brillance=0.7, graine=142), 0.09)
    poser(x, lueur(n("D4"), 0.15, 0.12, attaque=0.03, relache=0.9, coupure=900, voix=2, graine=143), 0.0)
    return passe_bas_variable(x, lambda t: 6500.0 * np.exp(-t / 0.22) + 800.0)


def resume(v: int) -> np.ndarray:
    """Le ciel se rouvre: le geste inverse de la pause, qui monte et s'éclaire."""
    x = toile(1.8)
    poser(x, verre(n("A5"), 1.6, 0.7, t60=0.8, brillance=0.8, graine=151), 0.0)
    poser(x, verre(n("D6"), 1.6, 0.8, t60=0.9, brillance=0.85, graine=152), 0.075)
    poser(x, verre(n("E6"), 1.6, 0.5, t60=0.8, brillance=0.8, graine=153), 0.15)
    poser(x, lueur(n("A4"), 0.25, 0.12, attaque=0.15, relache=0.8, coupure=1400, voix=2, graine=154), 0.0)
    return passe_bas_variable(x, lambda t: 900.0 + 7500.0 * (1 - np.exp(-t / 0.18)))


def connection_lost(v: int) -> np.ndarray:
    """Les deux astres se désaccordent et s'éloignent: l'inverse de « l'autre est là »."""
    x = toile(3.0)
    la = n("A5")
    # Les deux notes partent en phase (accordées), puis l'une descend et elles se séparent.
    poser(x, harmonica(la, 2.6, 0.62, t60=2.4, attaque=0.05, phase=0.0), 0.0, PAN_TOI)
    poser(x, harmonica(la, 2.6, 0.62, f_fin=la * 2 ** (-70 / 1200), tau=0.45, t60=2.2,
                       attaque=0.05, phase=0.0), 0.0, PAN_AUTRE)
    poser(x, harpe(n("F#5"), 1.8, 0.45, t60=1.0, brillance=0.8, graine=163), 0.18, PAN_AUTRE)
    poser(x, harpe(n("D5"), 1.8, 0.5, t60=1.2, brillance=0.8, graine=164), 0.36, PAN_AUTRE)
    return passe_bas_variable(x, lambda t: 5000.0 * np.exp(-t / 0.7) + 650.0)


def connection_back(v: int) -> np.ndarray:
    """Les deux astres se retrouvent: désaccord qui se résout, puis tes notes et les siennes."""
    x = toile(3.4)
    la = n("A5")
    depart = la * 2 ** (-55 / 1200)
    poser(x, harmonica(la, 2.6, 0.55, t60=2.6, attaque=0.06, phase=0.0), 0.0, PAN_TOI)
    poser(x, harmonica(depart, 2.6, 0.55, f_fin=la, tau=0.16, t60=2.6, attaque=0.06,
                       phase=phase_accordee(la, depart, 0.16, 0.0)), 0.0, PAN_AUTRE)
    poser(x, harpe(n("D5"), 2.2, 0.55, t60=1.5, graine=173), 0.5, PAN_AUTRE)
    poser(x, verre(n("A5"), 2.2, 0.45, t60=1.2, brillance=0.8, graine=174), 0.58, PAN_TOI)
    poser(x, verre(n("D6"), 2.2, 0.55, t60=1.3, brillance=0.8, graine=175), 0.66, PAN_TOI)
    poser(x, harpe(n("F#5"), 2.2, 0.45, t60=1.3, graine=176), 0.74, PAN_AUTRE)
    poser(x, lueur(n("D4"), 0.6, 0.15, attaque=0.4, relache=1.5, coupure=1300, graine=177), 0.3)
    return x


# --- Fin de partie ----------------------------------------------------------------------------

def _gamme_montante(x, instrument, notes, debut, pas, pan, vel=0.7, graine=0, **kw):
    for i, note in enumerate(notes):
        poser(x, instrument(n(note), 2.4, vel, graine=graine + i, **kw), debut + pas * i, pan)


def end_win(v: int) -> np.ndarray:
    x = toile(3.6)
    _gamme_montante(x, verre, ["D5", "E5", "F#5", "A5", "B5", "D6"], 0.0, 0.065, PAN_TOI,
                    vel=0.62, graine=180, t60=0.9, brillance=0.75)
    for i, (note, vel) in enumerate([("D6", 0.6), ("F#6", 0.45), ("A6", 0.4)]):
        poser(x, verre(n(note), 2.8, vel, t60=1.6, brillance=0.7, graine=190 + i), 0.42 + 0.02 * i, PAN_TOI)
    for note in ("D4", "A4", "D5"):
        poser(x, lueur(n(note), 0.9, 0.15, attaque=0.12, relache=1.6, coupure=1800, graine=195), 0.35)
    return x


def end_peer_win(v: int) -> np.ndarray:
    x = toile(3.8)
    _gamme_montante(x, harpe, ["D4", "E4", "F#4", "A4", "B4", "D5"], 0.0, 0.075, PAN_AUTRE,
                    vel=0.62, graine=200, t60=1.0)
    for i, note in enumerate(["D5", "F#5", "A5"]):
        poser(x, harpe(n(note), 3.0, 0.5, t60=1.8, graine=210 + i), 0.5 + 0.03 * i, PAN_AUTRE)
    for note in ("D4", "A4"):
        poser(x, lueur(n(note), 0.8, 0.13, attaque=0.2, relache=1.6, coupure=1300, graine=215), 0.4)
    return x


def end_draw(v: int) -> np.ndarray:
    """Égalité: vos deux voix sur la même note, puis à l'octave, côte à côte."""
    x = toile(3.2)
    poser(x, verre(n("A5"), 2.6, 0.6, t60=1.2, brillance=0.7, graine=221), 0.0, PAN_TOI)
    poser(x, harpe(n("A5"), 2.6, 0.62, t60=1.4, graine=222), 0.0, PAN_AUTRE)
    poser(x, verre(n("D6"), 2.6, 0.55, t60=1.4, brillance=0.7, graine=223), 0.28, PAN_TOI)
    poser(x, harpe(n("D5"), 2.6, 0.6, t60=1.6, graine=224), 0.28, PAN_AUTRE)
    for note in ("D4", "A4"):
        poser(x, lueur(n(note), 0.7, 0.14, attaque=0.15, relache=1.5, coupure=1400, graine=225), 0.25)
    return x


def end_success(v: int) -> np.ndarray:
    """Vous avez réussi: question et réponse entre tes notes et les siennes, puis le ciel s'ouvre."""
    x = toile(4.4)
    sequence = [("D5", verre, PAN_TOI), ("F#5", harpe, PAN_AUTRE), ("A5", verre, PAN_TOI),
                ("D6", harpe, PAN_AUTRE), ("E6", verre, PAN_TOI)]
    for i, (note, instrument, pan) in enumerate(sequence):
        kw = {"brillance": 0.75} if instrument is verre else {}
        poser(x, instrument(n(note), 2.6, 0.6, t60=1.3, graine=230 + i, **kw), 0.11 * i, pan)
    poser(x, verre(n("F#6"), 3.2, 0.5, t60=2.0, brillance=0.7, graine=236), 0.62, PAN_TOI)
    poser(x, harpe(n("A5"), 3.2, 0.5, t60=2.2, graine=237), 0.62, PAN_AUTRE)
    for note in ("D4", "A4", "C#5", "E5"):
        poser(x, lueur(n(note), 1.1, 0.12, attaque=0.3, relache=2.0, coupure=1600, graine=238), 0.45)
    return x


def end_fail(v: int) -> np.ndarray:
    """Pas cette fois: une descente lente qui se pose sur ré majeur, comme un « ce n'est rien »."""
    x = toile(3.8)
    sequence = [("A5", verre, PAN_TOI), ("F#5", harpe, PAN_AUTRE), ("E5", verre, PAN_TOI),
                ("D5", harpe, PAN_AUTRE)]
    for i, (note, instrument, pan) in enumerate(sequence):
        kw = {"brillance": 0.5} if instrument is verre else {"brillance": 0.85}
        poser(x, instrument(n(note), 2.6, 0.6, t60=1.2, graine=240 + i, **kw), 0.17 * i, pan)
    for note in ("D4", "A4", "F#4"):
        poser(x, lueur(n(note), 0.9, 0.13, attaque=0.35, relache=1.8, coupure=1000, graine=245), 0.4)
    return passe_bas_variable(x, lambda t: 4500.0)


# --- Bibliothèque -----------------------------------------------------------------------------

def new_game(v: int) -> np.ndarray:
    """Étoile filante: une pluie de petites notes de verre qui traverse de gauche à droite."""
    x = toile(3.2)
    notes = ["B6", "A6", "F#6", "E6", "D6", "B5", "A5"]
    for i, note in enumerate(notes):
        pan = -0.6 + 1.2 * i / (len(notes) - 1)
        poser(x, verre(n(note), 1.2, 0.42 + 0.03 * i, t60=0.6, brillance=0.45, graine=250 + i),
              0.035 * i, pan)
    poser(x, verre(n("D6"), 2.6, 0.6, t60=1.6, brillance=0.6, graine=260), 0.3, 0.2)
    poser(x, harpe(n("A5"), 2.6, 0.5, t60=1.6, graine=261), 0.32, PAN_AUTRE)
    poser(x, lueur(n("D5"), 0.5, 0.1, attaque=0.2, relache=1.4, coupure=1800, graine=262), 0.25)
    return x


# --- Registre ---------------------------------------------------------------------------------

@dataclass(frozen=True)
class Lecture:
    """Règles de lecture reprises dans sons.json (voir docs/plateforme/identite-sonore.md)."""
    bus: str = "interface"
    priorite: int = 3  # 1 critique, 2 important, 3 courant, 4 discret
    hauteur: float = 0.0  # variation aléatoire de vitesse de lecture, en fraction (0,02 = 2 %)
    gain_db: float = 0.0  # variation aléatoire de gain, plus ou moins, en dB
    intervalle_ms: int = 0  # deux lectures plus rapprochées: la seconde est ignorée
    relance: bool = False  # vrai: une nouvelle lecture coupe la précédente (fondu de 15 ms)
    attenue_musique_db: float = 0.0  # atténuation de la musique pendant le son
    stereo: str = "center"  # center, self (toi, léger à gauche), peer (l'autre, à droite), wide (les deux)


@dataclass(frozen=True)
class Son:
    id: str  # identifiant pour le code (anglais), aussi nom des fichiers OGG
    nom: str  # nom des copies M4A et de la planche d'écoute
    evenement: str  # événement de l'interface, en français
    fonction: Callable[[int], np.ndarray]
    variantes: int
    cible_lufs: float  # sonie momentanée maximale visée (ebur128, fenêtre de 400 ms)
    palier: str  # discret, reponse, annonce
    reverbe: dict
    lecture: Lecture
    groupe: str


REVERBE_REPONSE = {"taille": 0.5, "humide": 0.14, "sec": 0.92}
REVERBE_ANNONCE = {"taille": 0.68, "humide": 0.2, "sec": 0.9}
REVERBE_DISCRET = {"taille": 0.35, "humide": 0.07, "sec": 0.95}

NAV = "Navigation"
PRES = "Présence et invitation"
SALON = "Salon et départ"
PARTIE = "En partie"
FIN = "Fin de partie"
BIB = "Bibliothèque"


def _discret(**kw):
    kw.setdefault("priorite", 4)
    return Lecture(**kw)


def _reponse(**kw):
    kw.setdefault("priorite", 3)
    return Lecture(**kw)


def _annonce(priorite=2, **kw):
    kw.setdefault("attenue_musique_db", -6.0)
    return Lecture(priorite=priorite, **kw)


SONS: list[Son] = [
    Son("focus", "focus", "Déplacement du focus au clavier (Tab, flèches)", focus, 3, -28.0,
        "discret", REVERBE_DISCRET, _discret(hauteur=0.03, gain_db=1.5, intervalle_ms=45, relance=True), NAV),
    Son("confirm", "valider", "Validation (Entrée, Espace, clic sur un bouton)", confirm, 3, -18.0,
        "reponse", REVERBE_REPONSE, _reponse(hauteur=0.015, gain_db=1.0, intervalle_ms=80, stereo="self"), NAV),
    Son("back", "retour", "Retour (Échap, Retour, fermeture d'un panneau)", back, 3, -19.0,
        "reponse", REVERBE_REPONSE, _reponse(hauteur=0.015, gain_db=1.0, intervalle_ms=80, stereo="self"), NAV),
    Son("error", "erreur-douce", "Erreur douce (caractère refusé, champ vide, action impossible)", error, 2, -19.0,
        "reponse", REVERBE_REPONSE, _reponse(hauteur=0.01, gain_db=1.0, intervalle_ms=250), NAV),
    Son("notify", "notification", "Notification (a rejoint, a quitté, nouveau choix, copie de sauvegarde)", notify, 2, -19.0,
        "reponse", REVERBE_REPONSE, _reponse(hauteur=0.01, gain_db=1.0, intervalle_ms=400), NAV),
    Son("volume-test", "essai-de-volume", "Essai de volume (curseurs de Réglages > Son)", volume_test, 1, -18.0,
        "reponse", REVERBE_REPONSE, _reponse(intervalle_ms=60, relance=True), NAV),
    Son("peer-here", "autre-est-la", "L'autre joueur est là (l'autre ordinateur apparaît)", peer_here, 1, -16.0,
        "annonce", REVERBE_ANNONCE, _annonce(intervalle_ms=5000, stereo="wide"), PRES),
    Son("invite", "invitation", "Invitation reçue (bandeau d'invitation)", invite, 1, -15.0,
        "annonce", REVERBE_ANNONCE, _annonce(priorite=1, attenue_musique_db=-8.0, intervalle_ms=3000, stereo="peer"), PRES),
    Son("ready-self", "cest-parti-toi", "« C'est parti ! » chez toi (aussi « Veut reprendre », « Veut rejouer »)", ready_self, 1, -18.0,
        "reponse", REVERBE_REPONSE, _reponse(priorite=2, intervalle_ms=300, stereo="self"), SALON),
    Son("ready-peer", "cest-parti-autre", "« C'est parti ! » chez l'autre, ou l'autre rejoint le salon (aussi ses « Veut reprendre », « Veut rejouer »)", ready_peer, 1, -18.0,
        "reponse", REVERBE_REPONSE, _reponse(priorite=2, intervalle_ms=300, stereo="peer"), SALON),
    Son("not-ready-peer", "pas-encore-autre", "L'autre repasse à « Pas encore » ou quitte le salon", not_ready_peer, 1, -19.0,
        "reponse", REVERBE_REPONSE, _reponse(intervalle_ms=300, stereo="peer"), SALON),
    Son("countdown-tick", "decompte", "Décompte 3, 2, 1 (départ et « Reprise dans 3 »)", countdown_tick, 1, -18.0,
        "reponse", REVERBE_REPONSE, _reponse(priorite=2, intervalle_ms=500), SALON),
    Son("countdown-go", "depart", "Départ de la partie (fin du décompte)", countdown_go, 1, -16.0,
        "annonce", REVERBE_ANNONCE, _annonce(intervalle_ms=1000, stereo="wide"), SALON),
    Son("countdown-cancel", "decompte-annule", "Décompte annulé (« Pas encore » ou Échap, d'un côté ou de l'autre)", countdown_cancel, 1, -19.0,
        "reponse", REVERBE_REPONSE, _reponse(priorite=2, intervalle_ms=500), SALON),
    Son("pause", "pause", "Pause (Échap en partie, chez l'un ou l'autre)", pause, 1, -18.0,
        "reponse", REVERBE_REPONSE, _reponse(priorite=2, intervalle_ms=500), PARTIE),
    Son("resume", "reprise", "Reprise (fin du décompte « Reprise dans 3 »)", resume, 1, -18.0,
        "reponse", REVERBE_REPONSE, _reponse(priorite=2, intervalle_ms=500), PARTIE),
    Son("connection-lost", "connexion-perdue", "Connexion perdue (superposition E12, cartes du salon)", connection_lost, 1, -15.0,
        "annonce", REVERBE_ANNONCE, _annonce(priorite=1, attenue_musique_db=-8.0, intervalle_ms=5000, stereo="wide"), PARTIE),
    Son("connection-back", "connexion-retrouvee", "Connexion retrouvée (« Sacha est de retour »)", connection_back, 1, -16.0,
        "annonce", REVERBE_ANNONCE, _annonce(intervalle_ms=5000, stereo="wide"), PARTIE),
    Son("end-win", "fin-tu-as-gagne", "Fin de partie: « Tu as gagné ! »", end_win, 1, -15.0,
        "annonce", REVERBE_ANNONCE, _annonce(stereo="self"), FIN),
    Son("end-peer-win", "fin-l-autre-a-gagne", "Fin de partie: « Sacha a gagné »", end_peer_win, 1, -17.0,
        "annonce", REVERBE_ANNONCE, _annonce(stereo="peer"), FIN),
    Son("end-draw", "fin-egalite", "Fin de partie: « Égalité ! »", end_draw, 1, -16.0,
        "annonce", REVERBE_ANNONCE, _annonce(stereo="wide"), FIN),
    Son("end-success", "fin-vous-avez-reussi", "Fin de partie: « Vous avez réussi ! » (coopération)", end_success, 1, -15.0,
        "annonce", REVERBE_ANNONCE, _annonce(stereo="wide"), FIN),
    Son("end-fail", "fin-pas-cette-fois", "Fin de partie: « Pas cette fois » (coopération)", end_fail, 1, -17.0,
        "annonce", REVERBE_ANNONCE, _annonce(stereo="wide"), FIN),
    Son("new-game", "nouveau-jeu", "Nouveau jeu disponible (notification « Nouveau jeu »)", new_game, 1, -16.0,
        "annonce", REVERBE_ANNONCE, _annonce(intervalle_ms=3000, stereo="wide"), BIB),
]

assert SR == 48000
