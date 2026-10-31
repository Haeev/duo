"""Outils de signal communs aux sons de La Petite Ligne.

Tout est déterministe: chaque fonction qui tire du hasard reçoit un générateur à graine.
Les sons sont des tableaux numpy en float64, mono (n,) ou stéréo (n, 2), à 48 kHz.
"""

from __future__ import annotations

import subprocess
from pathlib import Path

import numpy as np
from scipy import signal
from scipy.io import wavfile

SR = 48000
DEUX_PI = 2.0 * np.pi
LN_1000 = np.log(1000.0)  # -60 dB en amplitude

NOTES = {"C": 0, "D": 2, "E": 4, "F": 5, "G": 7, "A": 9, "B": 11}


# --- Hauteurs ---------------------------------------------------------------------------

def note_midi(nom: str) -> int:
    """« F#5 » ou « Bb3 » vers un numéro MIDI (la 4 = 69)."""
    lettre = nom[0].upper()
    reste = nom[1:]
    alteration = 0
    while reste and reste[0] in "#b":
        alteration += 1 if reste[0] == "#" else -1
        reste = reste[1:]
    return 12 * (int(reste) + 1) + NOTES[lettre] + alteration


def midi_freq(midi: float) -> float:
    return 440.0 * 2.0 ** ((midi - 69) / 12.0)


def freq(nom: str) -> float:
    return midi_freq(note_midi(nom))


# --- Tableaux ----------------------------------------------------------------------------

def n_ech(duree: float) -> int:
    return int(round(duree * SR))


def axe(duree: float) -> np.ndarray:
    return np.arange(n_ech(duree)) / SR


def toile(duree: float, stereo: bool = False) -> np.ndarray:
    return np.zeros((n_ech(duree), 2)) if stereo else np.zeros(n_ech(duree))


def poser(dest: np.ndarray, son: np.ndarray, debut: float, gain: float = 1.0, pan: float = 0.0,
          circulaire: bool = False) -> None:
    """Ajoute `son` à `dest` à partir de `debut` secondes. Un son mono posé sur une toile stéréo
    est panoramiqué (pan de -1 à +1, puissance constante). En mode circulaire, ce qui dépasse
    la fin repart au début (boucles)."""
    i0 = int(round(debut * SR))
    if dest.ndim == 2 and son.ndim == 1:
        g, d = gains_pan(pan)
        son = np.stack([son * g, son * d], axis=1)
    elif dest.ndim == 1 and son.ndim == 2:
        son = son.mean(axis=1)
    son = son * gain
    n = len(dest)
    if circulaire:
        i0 %= n
        reste = son
        while len(reste):
            pris = min(len(reste), n - i0)
            dest[i0:i0 + pris] += reste[:pris]
            reste = reste[pris:]
            i0 = 0
        return
    if i0 >= n or i0 + len(son) <= 0:
        return
    if i0 < 0:
        son = son[-i0:]
        i0 = 0
    fin = min(n, i0 + len(son))
    dest[i0:fin] += son[:fin - i0]


def gains_pan(pan: float) -> tuple[float, float]:
    angle = (float(np.clip(pan, -1.0, 1.0)) + 1.0) * np.pi / 4.0
    return float(np.cos(angle)), float(np.sin(angle))


def stereo(x: np.ndarray) -> np.ndarray:
    return x if x.ndim == 2 else np.stack([x, x], axis=1)


def mono(x: np.ndarray) -> np.ndarray:
    return x if x.ndim == 1 else x.mean(axis=1)


# --- Bruits ------------------------------------------------------------------------------

def blanc(n: int, rng: np.random.Generator) -> np.ndarray:
    return rng.standard_normal(n)


def bruit_spectral(n: int, rng: np.random.Generator, pente_db_oct: float = -3.0,
                   f_bas: float = 20.0, f_haut: float = 20000.0) -> np.ndarray:
    """Bruit coloré par la FFT, périodique de période n (idéal pour les boucles)."""
    spectre = rng.standard_normal(n // 2 + 1) + 1j * rng.standard_normal(n // 2 + 1)
    f = np.fft.rfftfreq(n, 1.0 / SR)
    f[0] = 1.0
    gain = (f / 1000.0) ** (pente_db_oct / 6.0206)
    gain[(f < f_bas) | (f > f_haut)] = 0.0
    x = np.fft.irfft(spectre * gain, n)
    return x / (np.std(x) + 1e-12)


def filtre_circulaire(x: np.ndarray, gain_f) -> np.ndarray:
    """Filtre à phase nulle appliqué dans le domaine fréquentiel: le résultat reste périodique.
    gain_f(f) renvoie le gain linéaire pour un tableau de fréquences."""
    n = len(x)
    f = np.fft.rfftfreq(n, 1.0 / SR)
    g = gain_f(f)
    if x.ndim == 1:
        return np.fft.irfft(np.fft.rfft(x) * g, n)
    return np.fft.irfft(np.fft.rfft(x, axis=0) * g[:, None], n, axis=0)


def gain_bande(f_bas: float, f_haut: float, ordre: float = 2.0):
    """Gain de type Butterworth (passe-bande), pour filtre_circulaire."""
    def g(f: np.ndarray) -> np.ndarray:
        f = np.maximum(f, 1e-3)
        bas = 1.0 / np.sqrt(1.0 + (f_bas / f) ** (2 * ordre)) if f_bas > 0 else 1.0
        haut = 1.0 / np.sqrt(1.0 + (f / f_haut) ** (2 * ordre)) if f_haut < SR / 2 else 1.0
        return bas * haut
    return g


# --- Filtres -----------------------------------------------------------------------------

def _sos(type_: str, fc, ordre: int):
    nyq = SR / 2.0
    if isinstance(fc, (list, tuple)):
        fc = [min(max(v, 5.0), nyq * 0.98) for v in fc]
    else:
        fc = min(max(fc, 5.0), nyq * 0.98)
    return signal.butter(ordre, fc, btype=type_, fs=SR, output="sos")


def pb(x: np.ndarray, fc: float, ordre: int = 2) -> np.ndarray:
    return signal.sosfilt(_sos("low", fc, ordre), x, axis=0)


def ph(x: np.ndarray, fc: float, ordre: int = 2) -> np.ndarray:
    return signal.sosfilt(_sos("high", fc, ordre), x, axis=0)


def pbande(x: np.ndarray, f_bas: float, f_haut: float, ordre: int = 2) -> np.ndarray:
    return signal.sosfilt(_sos("band", [f_bas, f_haut], ordre), x, axis=0)


def resonateur(x: np.ndarray, f: float, q: float) -> np.ndarray:
    """Filtre résonant du second ordre (passe-bande à gain unité au centre)."""
    b, a = signal.iirpeak(min(f, SR * 0.45), q, fs=SR)
    return signal.lfilter(b, a, x, axis=0)


def etagere_aigus(x: np.ndarray, fc: float, gain_db: float) -> np.ndarray:
    """Étagère d'aigus (RBJ)."""
    a = 10 ** (gain_db / 40.0)
    w0 = DEUX_PI * fc / SR
    alpha = np.sin(w0) / 2.0 * np.sqrt(2.0)
    cosw = np.cos(w0)
    b0 = a * ((a + 1) + (a - 1) * cosw + 2 * np.sqrt(a) * alpha)
    b1 = -2 * a * ((a - 1) + (a + 1) * cosw)
    b2 = a * ((a + 1) + (a - 1) * cosw - 2 * np.sqrt(a) * alpha)
    a0 = (a + 1) - (a - 1) * cosw + 2 * np.sqrt(a) * alpha
    a1 = 2 * ((a - 1) - (a + 1) * cosw)
    a2 = (a + 1) - (a - 1) * cosw - 2 * np.sqrt(a) * alpha
    return signal.lfilter(np.array([b0, b1, b2]) / a0, np.array([1.0, a1 / a0, a2 / a0]), x, axis=0)


def cloche_eq(x: np.ndarray, fc: float, gain_db: float, q: float = 1.0) -> np.ndarray:
    """Correcteur en cloche (RBJ peaking)."""
    a = 10 ** (gain_db / 40.0)
    w0 = DEUX_PI * fc / SR
    alpha = np.sin(w0) / (2 * q)
    cosw = np.cos(w0)
    b = np.array([1 + alpha * a, -2 * cosw, 1 - alpha * a])
    a_ = np.array([1 + alpha / a, -2 * cosw, 1 - alpha / a])
    return signal.lfilter(b / a_[0], a_ / a_[0], x, axis=0)


def pb_variable(x: np.ndarray, coupure, bloc: int = 64, type_: str = "low", q_bande: float = 1.2) -> np.ndarray:
    """Filtre du second ordre dont la coupure suit coupure(t) (t en secondes), traité par blocs.
    type_ « low » ou « band » (bande de largeur relative q_bande autour de la coupure)."""
    xs = x[:, None] if x.ndim == 1 else x
    sortie = np.zeros_like(xs)
    etat = np.zeros((2, xs.shape[1]))
    for i0 in range(0, len(xs), bloc):
        i1 = min(len(xs), i0 + bloc)
        fc = float(np.clip(coupure((i0 + i1) / 2.0 / SR), 30.0, SR * 0.45))
        if type_ == "low":
            b, a = signal.butter(2, fc, btype="low", fs=SR)
        else:
            b, a = signal.iirpeak(fc, q_bande, fs=SR)
        sortie[i0:i1], etat = signal.lfilter(b, a, xs[i0:i1], axis=0, zi=etat)
    return sortie[:, 0] if x.ndim == 1 else sortie


# --- Enveloppes --------------------------------------------------------------------------

def env_exp(n: int, tau: float, attaque: float = 0.001) -> np.ndarray:
    t = np.arange(n) / SR
    e = np.exp(-t / max(tau, 1e-4))
    na = max(1, min(n, int(attaque * SR)))
    e[:na] *= 0.5 - 0.5 * np.cos(np.pi * np.arange(na) / na)
    return e


def env_ar(n: int, attaque: float, relache: float, courbe: float = 1.0) -> np.ndarray:
    """Montée puis descente en cosinus, sans palier, sur n échantillons."""
    na = max(1, int(attaque * SR))
    nr = max(1, int(relache * SR))
    e = np.ones(n)
    na = min(na, n)
    e[:na] = (0.5 - 0.5 * np.cos(np.pi * np.arange(na) / na)) ** courbe
    nr = min(nr, n)
    e[n - nr:] *= (0.5 + 0.5 * np.cos(np.pi * np.arange(nr) / nr)) ** courbe
    return e


def env_points(n: int, points: list[tuple[float, float]]) -> np.ndarray:
    """Enveloppe par points (temps en s, gain), interpolée linéairement."""
    t = np.arange(n) / SR
    ts = [p[0] for p in points]
    gs = [p[1] for p in points]
    return np.interp(t, ts, gs)


def fondu(x: np.ndarray, entree: float = 0.002, sortie: float = 0.01) -> np.ndarray:
    y = x.copy()
    n = len(y)
    ne = min(n, max(1, int(entree * SR)))
    ns = min(n, max(1, int(sortie * SR)))
    re = 0.5 - 0.5 * np.cos(np.pi * np.arange(ne) / ne)
    rs = 0.5 + 0.5 * np.cos(np.pi * np.arange(ns) / ns)
    if y.ndim == 1:
        y[:ne] *= re
        y[n - ns:] *= rs
    else:
        y[:ne] *= re[:, None]
        y[n - ns:] *= rs[:, None]
    return y


# --- Générateurs -------------------------------------------------------------------------

def sinus_glisse(f_t: np.ndarray, phase0: float = 0.0) -> np.ndarray:
    """Sinus dont la fréquence instantanée suit le tableau f_t (Hz)."""
    return np.sin(phase0 + DEUX_PI * np.cumsum(f_t) / SR)


def modes(n: int, partiels: list[tuple[float, float, float]], rng: np.random.Generator,
          attaque: float = 0.0005) -> np.ndarray:
    """Somme de sinus amortis: (fréquence Hz, amplitude, durée de décroissance à -60 dB en s)."""
    t = np.arange(n) / SR
    y = np.zeros(n)
    for f, a, t60 in partiels:
        if f >= SR * 0.47 or a <= 0:
            continue
        y += a * np.sin(DEUX_PI * f * t + rng.uniform(0, DEUX_PI)) * np.exp(-LN_1000 * t / max(t60, 1e-4))
    na = max(1, int(attaque * SR))
    y[:na] *= 0.5 - 0.5 * np.cos(np.pi * np.arange(na) / na)
    return y


def grains(duree: float, densite: float, fabrique, rng: np.random.Generator,
           enveloppe=None, circulaire: bool = False) -> np.ndarray:
    """Nuage de grains: densite grains par seconde (processus de Poisson), chaque grain fourni par
    fabrique(rng) (tableau mono). enveloppe(t) module la densité (0 à 1)."""
    y = toile(duree)
    t = 0.0
    while True:
        t += rng.exponential(1.0 / densite)
        if t >= duree:
            break
        if enveloppe is not None and rng.uniform() > enveloppe(t):
            continue
        poser(y, fabrique(rng), t, circulaire=circulaire)
    return y


def clic(rng: np.random.Generator, f_bas: float, f_haut: float, duree: float = 0.004,
         tau: float = 0.0015) -> np.ndarray:
    n = max(8, n_ech(duree))
    x = rng.standard_normal(n) * env_exp(n, tau, 0.0002)
    return pbande(x, f_bas, f_haut)


def bulle(rng: np.random.Generator, f0: float, tau: float, montee: float = 0.6) -> np.ndarray:
    """Bulle d'eau (modèle de van den Doel): sinus amorti dont la hauteur monte pendant la décroissance."""
    duree = min(0.25, 6 * tau)
    n = n_ech(duree)
    t = np.arange(n) / SR
    f = f0 * (1.0 + montee * t / tau * 0.1)
    return sinus_glisse(f) * env_exp(n, tau, 0.0005)


def reechantillonner(x: np.ndarray, facteur: float) -> np.ndarray:
    """Change hauteur et durée ensemble (facteur > 1: plus aigu et plus court)."""
    n = len(x)
    m = max(2, int(round(n / facteur)))
    pos = np.arange(m) * facteur
    pos = pos[pos <= n - 1]
    if x.ndim == 1:
        return np.interp(pos, np.arange(n), x)
    return np.stack([np.interp(pos, np.arange(n), x[:, c]) for c in range(x.shape[1])], axis=1)


def retard_variable(x: np.ndarray, retard_s: np.ndarray) -> np.ndarray:
    """Lit x avec un retard qui varie dans le temps (effet Doppler d'une source qui se déplace)."""
    n = len(x)
    pos = np.arange(n) - retard_s * SR
    pos = np.clip(pos, 0, n - 1)
    if x.ndim == 1:
        return np.interp(pos, np.arange(n), x)
    return np.stack([np.interp(pos, np.arange(n), x[:, c]) for c in range(x.shape[1])], axis=1)


# --- Réverbération par convolution ------------------------------------------------------

def ir_salle(rt60: float = 1.4, predelai: float = 0.012, aigus: float = 0.45, graine: int = 0,
             largeur: float = 1.0, premieres: int = 6) -> np.ndarray:
    """Réponse impulsionnelle stéréo synthétique: bruit à décroissance exponentielle, plus rapide
    dans les aigus (aigus = rapport des temps de réverbération aigus et graves), précédée de
    quelques réflexions précoces. Énergie normalisée à 1 par canal."""
    rng = np.random.default_rng(10_000 + graine)
    duree = rt60 * 1.3 + predelai
    n = n_ech(duree)
    t = np.arange(n) / SR
    ir = np.zeros((n, 2))
    bandes = [(20, 300, 1.15), (300, 1200, 1.0), (1200, 4000, 0.5 + 0.5 * aigus), (4000, 20000, aigus)]
    for c in range(2):
        b = rng.standard_normal(n)
        for lo, hi, f in bandes:
            ir[:, c] += pbande(b, lo, hi, 2) * np.exp(-6.9078 * t / (rt60 * f))
    i0 = n_ech(predelai)
    ir = np.roll(ir, i0, axis=0)
    ir[:i0] = 0.0
    na = n_ech(0.02)
    ir[i0:i0 + na] *= (np.arange(na) / na)[:, None]
    for k in range(premieres):
        tk = predelai * (0.4 + 0.25 * k) + rng.uniform(0, 0.004)
        ik = n_ech(tk)
        if ik < n:
            ir[ik, 0] += rng.uniform(0.3, 0.7) * (0.8 ** k) * 8
            ir[min(n - 1, ik + rng.integers(5, 60)), 1] += rng.uniform(0.3, 0.7) * (0.8 ** k) * 8
    milieu = ir.mean(axis=1, keepdims=True)
    cote = ir - milieu
    ir = milieu + largeur * cote
    ir /= np.sqrt(np.sum(ir ** 2, axis=0, keepdims=True)) + 1e-12
    return ir


def reverbe(x: np.ndarray, ir: np.ndarray, humide: float, sec: float = 1.0) -> np.ndarray:
    """Convolution (le résultat s'allonge de la longueur de l'IR). Entrée mono ou stéréo, sortie stéréo."""
    xs = stereo(x)
    wet = np.stack([signal.oaconvolve(xs[:, c], ir[:, c]) for c in range(2)], axis=1)
    out = np.zeros_like(wet)
    out[:len(xs)] += sec * xs
    out += humide * wet
    return out


def reverbe_mono(x: np.ndarray, ir: np.ndarray, humide: float, sec: float = 1.0) -> np.ndarray:
    wet = signal.oaconvolve(mono(x), ir[:, 0])
    out = humide * wet
    out[:len(x)] += sec * mono(x)
    return out


# --- Mesures (UIT-R BS.1770-4) -----------------------------------------------------------

def _ponderation_k(x: np.ndarray) -> np.ndarray:
    b1 = [1.53512485958697, -2.69169618940638, 1.19839281085285]
    a1 = [1.0, -1.69065929318241, 0.73248077421585]
    b2 = [1.0, -2.0, 1.0]
    a2 = [1.0, -1.99004745483398, 0.99007225036621]
    return signal.lfilter(b2, a2, signal.lfilter(b1, a1, x, axis=0), axis=0)


def _puissance(x: np.ndarray) -> np.ndarray:
    y = _ponderation_k(stereo(x))
    return np.sum(y ** 2, axis=1)


def sonie_momentanee_max(x: np.ndarray) -> float:
    pad = np.zeros(n_ech(0.4)) if x.ndim == 1 else np.zeros((n_ech(0.4), 2))
    p = _puissance(np.concatenate([pad, x, pad]))
    cumul = np.concatenate([[0.0], np.cumsum(p)])
    n = n_ech(0.4)
    pas = n_ech(0.1)
    idx = np.arange(0, len(p) - n + 1, pas)
    blocs = (cumul[idx + n] - cumul[idx]) / n
    return float(-0.691 + 10 * np.log10(np.max(blocs) + 1e-20))


def sonie_integree(x: np.ndarray, circulaire: bool = False) -> float:
    """Sonie intégrée. En mode circulaire, les fenêtres enjambent la fin vers le début (boucle)."""
    p = _puissance(np.concatenate([x, x[:n_ech(0.4)]]) if circulaire else x)
    n = n_ech(0.4)
    pas = n_ech(0.1)
    cumul = np.concatenate([[0.0], np.cumsum(p)])
    fin = len(p) - n + 1 if not circulaire else len(x)
    idx = np.arange(0, max(1, fin), pas)
    blocs = (cumul[idx + n] - cumul[idx]) / n
    lk = -0.691 + 10 * np.log10(blocs + 1e-20)
    blocs = blocs[lk > -70]
    if len(blocs) == 0:
        return -70.0
    seuil = -0.691 + 10 * np.log10(np.mean(blocs)) - 10
    lk = -0.691 + 10 * np.log10(blocs + 1e-20)
    return float(-0.691 + 10 * np.log10(np.mean(blocs[lk > seuil])))


def crete_vraie_db(x: np.ndarray) -> float:
    sur = signal.resample_poly(x, 4, 1, axis=0)
    return float(20 * np.log10(np.max(np.abs(sur)) + 1e-12))


def amener_momentanee(x: np.ndarray, cible_lufs: float, plafond_dbtp: float = -1.5) -> np.ndarray:
    y = x * 10 ** ((cible_lufs - sonie_momentanee_max(x)) / 20.0)
    tp = crete_vraie_db(y)
    if tp > plafond_dbtp:
        y *= 10 ** ((plafond_dbtp - tp) / 20.0)
    return y


def amener_integree(x: np.ndarray, cible_lufs: float, circulaire: bool = False) -> np.ndarray:
    return x * 10 ** ((cible_lufs - sonie_integree(x, circulaire)) / 20.0)


def limiter_circulaire(x: np.ndarray, plafond_dbtp: float = -1.5, release_ms: float = 120.0) -> np.ndarray:
    """Limiteur à anticipation appliqué sur trois copies de la boucle, dont on garde celle du
    milieu: l'état du limiteur au début de la boucle est celui de sa fin, le raccord reste juste."""
    if crete_vraie_db(x) <= plafond_dbtp:
        return x
    from scipy.ndimage import minimum_filter1d

    n = len(x)
    y = np.concatenate([x, x, x])
    for _ in range(4):
        lin = 10 ** ((plafond_dbtp - 0.2) / 20.0)
        crete = np.max(np.abs(stereo(y)), axis=1)
        requis = np.minimum(1.0, lin / (crete + 1e-12))
        # Maintien du minimum sur une fenêtre centrée (anticipation de la moitié), puis lissage à
        # phase nulle: le gain descend avant la crête et remonte en douceur.
        maintien = minimum_filter1d(requis, size=2 * n_ech(release_ms * 1e-3 / 4) + 1)
        lisse = signal.filtfilt(*signal.butter(2, 12.0, fs=SR), maintien)
        g = np.minimum(lisse, minimum_filter1d(requis, size=2 * n_ech(0.002) + 1))
        y = y * g[:, None] if y.ndim == 2 else y * g
        if crete_vraie_db(y[n:2 * n]) <= plafond_dbtp:
            break
    return y[n:2 * n]


# --- Fichiers ----------------------------------------------------------------------------

def ffmpeg(*args: str) -> None:
    subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", *args], check=True)


def ecrire_wav(chemin: Path, x: np.ndarray) -> None:
    chemin.parent.mkdir(parents=True, exist_ok=True)
    wavfile.write(str(chemin), SR, x.astype(np.float32))


def lire_wav(chemin: Path) -> np.ndarray:
    sr, x = wavfile.read(str(chemin))
    if sr != SR:
        raise ValueError(f"{chemin}: {sr} Hz au lieu de {SR}")
    x = x.astype(np.float64)
    if np.issubdtype(x.dtype, np.integer):
        x /= 32768.0
    return x


def encoder_ogg(wav: Path, sortie: Path, qualite: float) -> None:
    sortie.parent.mkdir(parents=True, exist_ok=True)
    ffmpeg("-i", str(wav), "-map_metadata", "-1", "-fflags", "+bitexact", "-flags:a", "+bitexact",
           "-c:a", "libvorbis", "-q:a", str(qualite), str(sortie))


def encoder_m4a(wav: Path, sortie: Path, debit: str, titre: str) -> None:
    sortie.parent.mkdir(parents=True, exist_ok=True)
    ffmpeg("-i", str(wav), "-map_metadata", "-1", "-fflags", "+bitexact", "-flags:a", "+bitexact",
           "-c:a", "aac", "-b:a", debit, "-metadata", f"title={titre}", "-metadata", "artist=Studio Duo",
           "-movflags", "+faststart", str(sortie))


def decoder(fichier: Path, canaux: int = 2) -> np.ndarray:
    proc = subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-i", str(fichier),
                           "-f", "f32le", "-ac", str(canaux), "-ar", str(SR), "-"],
                          capture_output=True, check=True)
    x = np.frombuffer(proc.stdout, dtype=np.float32).astype(np.float64)
    return x.reshape(-1, canaux) if canaux > 1 else x


def somme(*sons: np.ndarray) -> np.ndarray:
    """Additionne des sons de longueurs différentes (les plus courts sont complétés de silence)."""
    n = max(len(s) for s in sons)
    stereo_ = any(s.ndim == 2 for s in sons)
    sortie = np.zeros((n, 2)) if stereo_ else np.zeros(n)
    for s in sons:
        poser(sortie, s, 0.0)
    return sortie
