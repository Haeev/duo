"""Sons de base de La Petite Ligne (refonte, lot L9): effets, ambiances, timbres du babil.

Tout est synthétisé (numpy, scipy) sauf les timbres du babil, rendus par FluidSynth (banque
FluidR3_GM, MIT). Déterministe: graines fixes. Usage:
    duo-python assets-src/son/generer.py [--seulement motif]
Sorties: assets/commun/son/{effets,ambiances,babil}/*.ogg. Niveaux: voir `normaliser`.
"""

from __future__ import annotations

import subprocess
import sys
import tempfile
from pathlib import Path

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).parent))

import warnings  # noqa: E402

import mido  # noqa: E402
import numpy as np  # noqa: E402

import dsp  # noqa: E402
from dsp import SR, env_ar, env_exp, fondu, modes, n_ech, poser, toile  # noqa: E402

warnings.filterwarnings("ignore", message="Chunk")  # bloc LIST de FluidSynth, sans importance
RACINE = Path(__file__).resolve().parents[2]
SORTIE = RACINE / "assets" / "commun" / "son"
BANQUE = "/usr/share/sounds/sf2/FluidR3_GM.sf2"

# Niveaux de référence: tous les effets et notes de babil ont la même sonie momentanée maximale,
# le niveau de jeu se règle ensuite dans `src/audio/donnees/sons.json`. Boucles: sonie intégrée.
MONO = 3.01  # dsp.stereo double un fichier mono; ffmpeg le lit sur un seul canal
EFFET_LUFS = -16.0 + MONO
BOUCLE_LUFS = -16.0 + MONO
PLAFOND_DBTP = -1.5


def rng(nom: str) -> np.random.Generator:
    return np.random.default_rng(sum(ord(c) * (i + 1) for i, c in enumerate(nom)))


def hz(midi: float) -> float:
    return dsp.midi_freq(midi)


def ton(f: float, duree: float, tau: float, harm: tuple[float, ...] = (1.0,), attaque: float = 0.004) -> np.ndarray:
    n = n_ech(duree)
    t = np.arange(n) / SR
    y = sum(a * np.sin(2 * np.pi * f * (k + 1) * t) for k, a in enumerate(harm))
    return y * env_exp(n, tau, attaque)


# --- Pas -----------------------------------------------------------------------------------

def pas_herbe(g: np.random.Generator) -> np.ndarray:
    n = n_ech(0.14)
    b = dsp.pbande(g.standard_normal(n), 1800, 6500) * env_ar(n, 0.012, 0.09, 1.2)
    sourd = dsp.pb(g.standard_normal(n), 220) * env_exp(n, 0.03, 0.004) * 1.6
    return b * 0.6 + sourd


def pas_terre(g: np.random.Generator) -> np.ndarray:
    n = n_ech(0.16)
    gravier = np.zeros(n)
    for t in np.sort(g.uniform(0.0, 0.08, 7)):
        poser(gravier, dsp.clic(g, 1500, 7000, 0.006, 0.002) * g.uniform(0.3, 1.0), float(t))
    sourd = dsp.pb(g.standard_normal(n), 300) * env_exp(n, 0.035, 0.003) * 2.0
    return gravier * 0.5 + sourd


def pas_pave(g: np.random.Generator) -> np.ndarray:
    f = g.uniform(900, 1250)
    n = n_ech(0.12)
    y = modes(n, [(f, 1.0, 0.045), (f * 1.9, 0.5, 0.03), (f * 3.1, 0.2, 0.02)], g, 0.0004)
    y += dsp.pb(g.standard_normal(n), 400) * env_exp(n, 0.015, 0.001) * 1.2
    return dsp.pb(y, 6000)


# --- Gestes ---------------------------------------------------------------------------------

def cible() -> np.ndarray:
    return ton(hz(91), 0.07, 0.018, (1.0, 0.25))  # sol 6, discret


def reussite() -> np.ndarray:
    y = toile(0.34)
    poser(y, ton(hz(79), 0.2, 0.06, (1.0, 0.3)), 0.0)  # sol 5
    poser(y, ton(hz(83), 0.28, 0.09, (1.0, 0.3)), 0.07, 0.9)  # si 5
    return y


def refus() -> np.ndarray:
    n = n_ech(0.22)
    t = np.arange(n) / SR
    f = np.where(t < 0.09, hz(55), hz(52))  # deux notes graves, légèrement descendantes
    y = dsp.sinus_glisse(f) * env_exp(n, 0.07, 0.012)
    return dsp.pb(y + 0.3 * np.sin(2 * np.cumsum(f) * 2 * np.pi / SR) * env_exp(n, 0.04), 900)


def s_asseoir(g: np.random.Generator) -> np.ndarray:
    n = n_ech(0.32)
    tissu = dsp.pbande(g.standard_normal(n), 300, 1800) * env_ar(n, 0.06, 0.2)
    poids = dsp.pb(g.standard_normal(n), 140) * env_exp(n, 0.07, 0.01) * 3.0
    return tissu * 0.5 + poids


def ramasser() -> np.ndarray:
    n = n_ech(0.16)
    t = np.arange(n) / SR
    f = 520 * (1 + 1.6 * np.minimum(t / 0.07, 1.0))
    return dsp.sinus_glisse(f) * env_exp(n, 0.04, 0.003) + 0.25 * ton(1500, 0.16, 0.02)


def poser_objet(g: np.random.Generator) -> np.ndarray:
    n = n_ech(0.2)
    y = modes(n, [(190, 1.0, 0.09), (390, 0.5, 0.06), (760, 0.15, 0.03)], g, 0.0005)
    y += dsp.pbande(g.standard_normal(n), 1000, 4000) * env_exp(n, 0.006, 0.0005) * 0.6
    return y


def rangement_ouvre(g: np.random.Generator) -> np.ndarray:
    n = n_ech(0.42)
    t = np.arange(n) / SR
    grince = dsp.pbande(g.standard_normal(n), 600, 1800) * env_ar(n, 0.05, 0.25) * 0.4
    grince *= 0.6 + 0.4 * np.sin(2 * np.pi * (35 + 25 * t) * t)
    poser(grince, modes(n_ech(0.15), [(260, 1.0, 0.06), (520, 0.4, 0.04)], g), 0.0, 0.7)
    return grince


def rangement_ferme(g: np.random.Generator) -> np.ndarray:
    n = n_ech(0.3)
    y = modes(n, [(210, 1.0, 0.08), (430, 0.6, 0.05), (900, 0.2, 0.03)], g, 0.0004)
    y += dsp.pbande(g.standard_normal(n), 800, 3500) * env_exp(n, 0.008, 0.0005) * 0.5
    m = n_ech(0.1)
    poser(y, dsp.pbande(g.standard_normal(m), 600, 1500) * env_ar(m, 0.02, 0.07) * 0.25, 0.0)
    return y


def sac_plein(g: np.random.Generator) -> np.ndarray:
    y = toile(0.4)
    poser(y, ton(hz(52), 0.18, 0.06, (1.0, 0.4)), 0.0)
    poser(y, ton(hz(52), 0.2, 0.07, (1.0, 0.4)), 0.14, 0.8)
    n = n_ech(0.35)
    poser(y, dsp.pbande(g.standard_normal(n), 400, 2200) * env_ar(n, 0.05, 0.25) * 0.18, 0.0)
    return dsp.pb(y, 1400)


def monnaie(g: np.random.Generator) -> np.ndarray:
    n = n_ech(0.7)
    y = modes(n, [(2637, 1.0, 0.35), (3951, 0.6, 0.22), (5274, 0.25, 0.12), (1318, 0.3, 0.3)], g, 0.0003)
    z = modes(n, [(3136, 1.0, 0.4), (4700, 0.5, 0.2), (6272, 0.2, 0.1)], g, 0.0003)
    poser(y, z, 0.07, 0.8)
    return dsp.pb(y, 9000)


def papier(g: np.random.Generator, duree: float, bas: float, haut: float) -> np.ndarray:
    n = n_ech(duree)
    t = np.arange(n) / SR
    b = dsp.pbande(g.standard_normal(n), bas, haut)
    pulses = 0.5 + 0.5 * np.abs(np.sin(2 * np.pi * 23 * t * (1 + 0.4 * t / duree) + g.uniform(0, 6)))
    return b * pulses * env_ar(n, duree * 0.15, duree * 0.6)


def carnet_ouvre(g: np.random.Generator) -> np.ndarray:
    y = papier(g, 0.34, 1200, 7000) * 0.7
    poser(y, modes(n_ech(0.12), [(240, 1.0, 0.05), (480, 0.4, 0.03)], g), 0.0, 0.6)
    return y


def carnet_ferme(g: np.random.Generator) -> np.ndarray:
    y = toile(0.4)
    poser(y, papier(g, 0.26, 1000, 6000) * 0.5, 0.0)
    poser(y, modes(n_ech(0.2), [(200, 1.0, 0.07), (410, 0.5, 0.04), (820, 0.2, 0.02)], g, 0.0004), 0.18)
    return y


def page(g: np.random.Generator) -> np.ndarray:
    return papier(g, 0.14, 1800, 8000)


def choix(g: np.random.Generator) -> np.ndarray:
    return modes(n_ech(0.14), [(hz(84), 1.0, 0.07), (hz(84) * 3.9, 0.3, 0.03)], g, 0.0004)


def palier_bas() -> np.ndarray:
    y = toile(0.7)
    poser(y, ton(hz(74), 0.5, 0.17, (1.0, 0.35, 0.1)), 0.0)  # ré 5
    poser(y, ton(hz(69), 0.55, 0.2, (1.0, 0.35, 0.1)), 0.14, 0.9)  # la 4
    return dsp.pb(y, 5000)


def palier_bonus() -> np.ndarray:
    y = toile(0.95)
    for i, m in enumerate((79, 83, 86, 91)):  # sol, si, ré, sol: accord de sol majeur
        poser(y, ton(hz(m), 0.6, 0.2, (1.0, 0.3, 0.08)), 0.07 * i, 0.9 ** i)
    return dsp.pb(y, 7000)


def eau_pompe(g: np.random.Generator) -> np.ndarray:
    n = n_ech(1.5)
    cascade = dsp.pbande(g.standard_normal(n), 700, 5200)
    cascade *= dsp.env_points(n, [(0.0, 0.0), (0.2, 0.0), (0.4, 1.0), (1.1, 0.9), (1.5, 0.0)])
    cascade *= 0.8 + 0.2 * dsp.pb(g.standard_normal(n), 9)
    y = cascade * 0.8
    for _ in range(26):
        poser(y, dsp.bulle(g, g.uniform(500, 1600), g.uniform(0.01, 0.03)) * 0.35, g.uniform(0.35, 1.3))
    m = n_ech(0.22)
    poser(y, dsp.pbande(g.standard_normal(m), 800, 2200) * env_ar(m, 0.05, 0.12) * 0.4, 0.0)
    return y


def reveil() -> np.ndarray:
    # Sonnerie de réveil douce: deux notes de cloche (sol, si) en motif répété, sans stridence.
    y = toile(3.4)
    g = rng("reveil")
    for rep in range(3):
        for k, m in enumerate((91, 95)):
            f = hz(m)
            poser(y, modes(n_ech(0.9), [(f, 1.0, 0.5), (f * 2.76, 0.35, 0.25), (f * 5.4, 0.12, 0.12)], g, 0.0004),
                  rep * 1.05 + 0.2 * k, 0.9 ** rep)
    return dsp.pb(y, 8000)


# --- Train ------------------------------------------------------------------------------------

def roulement(g: np.random.Generator, duree: float, cadence: float, grave: float) -> np.ndarray:
    n = n_ech(duree)
    y = dsp.pb(g.standard_normal(n), grave) * 1.5
    t = 0.0
    while t < duree:
        for dt in (0.0, 0.11):
            coup = modes(n_ech(0.09), [(95, 1.0, 0.04), (310, 0.4, 0.03)], g) * 0.7
            poser(coup, dsp.clic(g, 700, 3500, 0.004, 0.0015), 0.0, 0.5)
            poser(y, coup, t + dt, 0.7)
        t += 1.0 / cadence
    return y


def train_arrive(g: np.random.Generator) -> np.ndarray:
    duree = 7.0
    n = n_ech(duree)
    t = np.arange(n) / SR
    y = roulement(g, duree, 3.2, 180) * dsp.env_points(n, [(0, 0.0), (2.5, 0.8), (5.0, 0.9), (6.2, 0.2), (7.0, 0.0)])
    f = np.interp(t, [3.8, 6.4], [1300, 700])  # grincement doux de freinage, glissé vers le grave
    grince = dsp.sinus_glisse(f) * dsp.env_points(n, [(0, 0), (3.8, 0), (4.5, 0.12), (6.0, 0.1), (6.6, 0)])
    sifflet = toile(duree)  # sifflet doux de loin (sol, ré) à 1 s
    souffle = env_ar(n_ech(0.9), 0.08, 0.4)
    poser(sifflet, ton(hz(79), 0.9, 0.6, (1.0, 0.2), 0.08) * souffle, 1.0, 0.25)
    poser(sifflet, ton(hz(74), 0.9, 0.6, (1.0, 0.2), 0.08) * souffle, 1.15, 0.2)
    vapeur = dsp.pbande(g.standard_normal(n), 2500, 9000)
    vapeur *= dsp.env_points(n, [(0, 0), (6.1, 0), (6.3, 1.0), (7.0, 0)]) * 0.18
    return y * 0.5 + grince + sifflet + vapeur


def embarquement(g: np.random.Generator) -> np.ndarray:
    y = toile(1.5)
    poser(y, modes(n_ech(0.25), [(150, 1.0, 0.1), (320, 0.6, 0.07), (640, 0.25, 0.04)], g), 0.0)  # marchepied
    poser(y, modes(n_ech(0.25), [(190, 1.0, 0.1), (400, 0.6, 0.07)], g), 0.18, 0.8)  # seconde marche
    f = hz(84)
    poser(y, modes(n_ech(1.1), [(f, 1.0, 0.7), (f * 2.4, 0.3, 0.35)], g, 0.001), 0.45, 0.55)  # clochette
    return y


def trajet(g: np.random.Generator) -> np.ndarray:
    duree = 8.0  # boucle: quatre cadences entières par seconde de rail
    n = n_ech(duree)
    cadence = 2.0
    fond = dsp.bruit_spectral(n, g, -6, 30, 400) * 0.4
    rail = toile(duree)
    for i in range(int(duree * cadence)):
        coup = modes(n_ech(0.1), [(120, 1.0, 0.05), (330, 0.5, 0.03)], g)
        poser(rail, coup, i / cadence, 0.5, circulaire=True)
        poser(rail, coup, i / cadence + 0.12, 0.35, circulaire=True)
        poser(rail, dsp.clic(g, 800, 3500, 0.004, 0.0015), i / cadence + 0.005, 0.2, circulaire=True)
    vent = dsp.bruit_spectral(n, g, -3, 300, 3000) * 0.04
    return fond + rail + vent


# --- Ambiances ----------------------------------------------------------------------------------

def oiseau(g: np.random.Generator) -> np.ndarray:
    duree = g.uniform(0.25, 0.5)
    n = n_ech(duree)
    t = np.arange(n) / SR
    f0 = g.uniform(2400, 4200)
    f = f0 * (1 + 0.25 * np.sin(2 * np.pi * g.uniform(8, 16) * t) * np.exp(-t / 0.25) + g.uniform(-0.2, 0.2) * t / duree)
    a = 0.5 + 0.5 * np.sin(2 * np.pi * g.uniform(6, 14) * t) ** 2
    return dsp.sinus_glisse(f) * a * env_ar(n, 0.02, duree * 0.5)


def ambiance_jour() -> np.ndarray:
    g = rng("ambiance-jour")
    duree = 32.0
    n = n_ech(duree)
    t = np.arange(n) / SR
    vent = dsp.bruit_spectral(n, g, -5, 60, 1800)
    vent *= 0.55 + 0.45 * np.sin(2 * np.pi * t / 8.0 + 1.0)  # période qui divise la durée
    feuilles = dsp.bruit_spectral(n, g, 0, 2500, 7000) * (0.15 + 0.15 * np.sin(2 * np.pi * t / 16.0) ** 2) * 0.35
    y = vent * 0.5 + feuilles
    for _ in range(11):
        t0 = g.uniform(0, duree)
        for k in range(int(g.integers(1, 4))):
            poser(y, oiseau(g) * g.uniform(0.12, 0.22), t0 + k * 0.3, circulaire=True)
    return y


def grillon(duree: float, f: float) -> np.ndarray:
    n = n_ech(duree)
    t = np.arange(n) / SR
    trille = (0.5 + 0.5 * np.sign(np.sin(2 * np.pi * 28 * t))) * (0.7 + 0.3 * np.sin(2 * np.pi * 28 * t))
    return np.sin(2 * np.pi * f * t) * trille * env_ar(n, 0.03, 0.05) * 0.5


def ambiance_nuit() -> np.ndarray:
    g = rng("ambiance-nuit")
    duree = 32.0
    n = n_ech(duree)
    t = np.arange(n) / SR
    vent = dsp.bruit_spectral(n, g, -6, 50, 900) * (0.5 + 0.5 * np.sin(2 * np.pi * t / 16.0 + 2.0) ** 2)
    y = vent * 0.45
    for voix in range(4):
        f = g.uniform(4100, 4900)
        t0 = g.uniform(0, 3)
        while t0 < duree:
            d = g.uniform(0.9, 1.6)
            poser(y, grillon(d, f) * 0.05 * (1 + 0.5 * voix / 4), t0, circulaire=True)
            t0 += d + g.uniform(0.5, 4.0)
    return y


# --- Babil: timbres rendus par FluidSynth ---------------------------------------------------------

TIMBRES = {  # identifiant: (programme General MIDI, note jouée, vélocité)
    "flute": (73, 72, 95),
    "clarinette": (71, 67, 95),
    "marimba": (12, 72, 100),
    "basson": (70, 55, 100),
    "boite-a-musique": (10, 84, 90),
    "ocarina": (79, 72, 95),
}


def timbre_fluidsynth(programme: int, note: int, velocite: int) -> np.ndarray:
    with tempfile.TemporaryDirectory() as tmp:
        mid = mido.MidiFile(ticks_per_beat=480)
        piste = mido.MidiTrack()
        mid.tracks.append(piste)
        piste.append(mido.MetaMessage("set_tempo", tempo=500000))
        piste.append(mido.Message("program_change", program=programme, time=0))
        piste.append(mido.Message("note_on", note=note, velocity=velocite, time=0))
        piste.append(mido.Message("note_off", note=note, velocity=0, time=480))  # 0,5 s
        piste.append(mido.Message("control_change", control=110, value=0, time=480))  # garde la queue
        chemin = Path(tmp) / "t.mid"
        mid.save(str(chemin))
        wav = Path(tmp) / "t.wav"
        subprocess.run(["fluidsynth", "-ni", "-q", "-R", "0", "-C", "0", "-g", "0.5", "-r", str(SR), "-O", "float",
                        "-T", "wav", "-F", str(wav), BANQUE, str(chemin)], check=True, capture_output=True)
        x = dsp.mono(dsp.lire_wav(wav))
    seuil = np.max(np.abs(x)) * 0.02
    debut = int(np.argmax(np.abs(x) > seuil))
    return fondu(x[debut:debut + n_ech(0.55)], 0.001, 0.12)


# --- Normalisation et écriture ---------------------------------------------------------------------

def normaliser(x: np.ndarray, boucle: bool) -> np.ndarray:
    x = x - np.mean(x)
    if boucle:
        return dsp.limiter_circulaire(dsp.amener_integree(x, BOUCLE_LUFS, circulaire=True), PLAFOND_DBTP)
    return dsp.amener_momentanee(fondu(x, 0.0015, 0.012), EFFET_LUFS, PLAFOND_DBTP)


def ecrire(dossier: str, nom: str, x: np.ndarray, boucle: bool = False) -> None:
    y = normaliser(x, boucle)
    with tempfile.TemporaryDirectory() as tmp:
        wav = Path(tmp) / "x.wav"
        dsp.ecrire_wav(wav, y)
        dsp.encoder_ogg(wav, SORTIE / dossier / f"{nom}.ogg", 4.0)


def main() -> None:
    motif = sys.argv[sys.argv.index("--seulement") + 1] if "--seulement" in sys.argv else ""

    def voulu(nom: str) -> bool:
        return motif in nom

    for surface, fabrique in (("herbe", pas_herbe), ("terre", pas_terre), ("pave", pas_pave)):
        for i in range(1, 4):
            nom = f"pas-{surface}-{i}"
            if voulu(nom):
                ecrire("effets", nom, fabrique(rng(nom)))
    unitaires = {
        "cible": lambda: cible(),
        "reussite": lambda: reussite(),
        "refus": lambda: refus(),
        "asseoir": lambda: s_asseoir(rng("asseoir")),
        "ramasser": lambda: ramasser(),
        "poser": lambda: poser_objet(rng("poser")),
        "rangement-ouvre": lambda: rangement_ouvre(rng("rangement-ouvre")),
        "rangement-ferme": lambda: rangement_ferme(rng("rangement-ferme")),
        "sac-plein": lambda: sac_plein(rng("sac-plein")),
        "monnaie": lambda: monnaie(rng("monnaie")),
        "carnet-ouvre": lambda: carnet_ouvre(rng("carnet-ouvre")),
        "carnet-ferme": lambda: carnet_ferme(rng("carnet-ferme")),
        "page": lambda: page(rng("page")),
        "choix": lambda: choix(rng("choix")),
        "palier-bas": lambda: palier_bas(),
        "palier-bonus": lambda: palier_bonus(),
        "eau-pompe": lambda: eau_pompe(rng("eau-pompe")),
        "reveil": lambda: reveil(),
        "train-arrive": lambda: train_arrive(rng("train-arrive")),
        "embarquement": lambda: embarquement(rng("embarquement")),
    }
    for nom, fabrique in unitaires.items():
        if voulu(nom):
            ecrire("effets", nom, fabrique())
    if voulu("trajet"):
        ecrire("ambiances", "trajet", trajet(rng("trajet")), boucle=True)
    if voulu("jour"):
        ecrire("ambiances", "jour", ambiance_jour(), boucle=True)
    if voulu("nuit"):
        ecrire("ambiances", "nuit", ambiance_nuit(), boucle=True)
    for nom, (programme, note, velocite) in TIMBRES.items():
        if voulu(f"babil-{nom}") or voulu(nom):
            ecrire("babil", nom, timbre_fluidsynth(programme, note, velocite))


if __name__ == "__main__":
    main()
