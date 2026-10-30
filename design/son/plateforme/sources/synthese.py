"""Instruments et outils de signal de l'identité sonore « Étoile double ».

Quatre familles de timbres, communes aux sons d'interface et à la musique du salon:
- verre: célesta de verre, frappé et clair. Ta voix, et celle de Duo.
- harpe: harpe de verre, pincée et ronde. La voix de l'autre ordinateur.
- harmonica: harmonica de verre, son tenu qui peut glisser. Les deux astres qui s'accordent.
- feutre: maillet de feutre, mat et bref. Retours en arrière, erreurs, pauses.
- nappe: synthé chaud et lent. Le ciel, sous les grands moments et dans la musique.

Tout est additif (sommes de sinus): hauteur exacte, aucun repliement, rendu déterministe.
"""

from __future__ import annotations

import numpy as np
from scipy import signal

SR = 48000
DEUX_PI = 2.0 * np.pi
LN_1000 = np.log(1000.0)  # -60 dB en amplitude

NOTES = {"C": 0, "D": 2, "E": 4, "F": 5, "G": 7, "A": 9, "B": 11}


def freq(nom: str) -> float:
    """« F#5 » vers une fréquence en Hz (la 4 = 440 Hz)."""
    lettre = nom[0]
    reste = nom[1:]
    alteration = 0
    while reste and reste[0] in "#b":
        alteration += 1 if reste[0] == "#" else -1
        reste = reste[1:]
    midi = 12 * (int(reste) + 1) + NOTES[lettre] + alteration
    return midi_freq(midi)


def midi_freq(midi: float) -> float:
    return 440.0 * 2.0 ** ((midi - 69) / 12.0)


def note_midi(nom: str) -> int:
    lettre = nom[0]
    reste = nom[1:]
    alteration = 0
    while reste and reste[0] in "#b":
        alteration += 1 if reste[0] == "#" else -1
        reste = reste[1:]
    return 12 * (int(reste) + 1) + NOTES[lettre] + alteration


def axe(duree: float) -> np.ndarray:
    return np.arange(int(round(duree * SR))) / SR


def attaque_douce(n: int, attaque: float) -> np.ndarray:
    """Montée en cosinus surélevé: pas de clic, même avec une phase de départ quelconque."""
    env = np.ones(n)
    na = max(1, int(attaque * SR))
    na = min(na, n)
    env[:na] = 0.5 - 0.5 * np.cos(np.pi * np.arange(na) / na)
    return env


def fondu_fin(x: np.ndarray, duree: float = 0.02) -> np.ndarray:
    n = min(len(x), int(duree * SR))
    if n > 0:
        rampe = 0.5 + 0.5 * np.cos(np.pi * np.arange(n) / n)
        if x.ndim == 1:
            x[-n:] *= rampe
        else:
            x[-n:] *= rampe[:, None]
    return x


def _somme_partiels(f, duree, partiels, t60, attaque, rng, vibrato=0.0):
    t = axe(duree)
    y = np.zeros_like(t)
    for rapport, amp, facteur in partiels:
        fk = f * rapport
        if fk > 16000 or amp <= 0:
            continue
        phase = rng.uniform(0, DEUX_PI)
        decroissance = np.exp(-LN_1000 * t / (t60 * facteur))
        if vibrato:
            arg = DEUX_PI * fk * t + phase + vibrato * np.sin(DEUX_PI * 5.2 * t)
        else:
            arg = DEUX_PI * fk * t + phase
        y += amp * np.sin(arg) * decroissance
    return y * attaque_douce(len(t), attaque)


def verre(f: float, duree: float = 1.5, vel: float = 1.0, t60: float | None = None,
          brillance: float = 1.0, graine: int = 0, attaque: float = 0.003) -> np.ndarray:
    """Célesta de verre: lame frappée (partiels 2,756 et 5,404 d'une barre libre), fondamental dominant."""
    rng = np.random.default_rng(graine)
    if t60 is None:
        t60 = float(np.clip(1.5 * (880.0 / f) ** 0.6, 0.35, 3.5))
    b = brillance
    partiels = [
        (1.0, 1.0, 1.0),
        (2.0, 0.12 * b, 0.55),
        (2.756, 0.20 * b, 0.32),
        (5.404, 0.06 * b, 0.16),
    ]
    y = _somme_partiels(f, duree, partiels, t60, attaque, rng)
    # Le contact du maillet: un souffle très bref, filtré autour de 3 fois la fondamentale.
    nb = int(0.006 * SR)
    bruit = rng.standard_normal(nb) * np.hanning(nb)
    centre = min(3.0 * f, 9000.0)
    sos = signal.butter(2, [centre * 0.6, min(centre * 1.6, 20000.0)], btype="band", fs=SR, output="sos")
    bruit = signal.sosfilt(sos, bruit)
    y[:nb] += 0.05 * b * bruit / (np.max(np.abs(bruit)) + 1e-12)
    return vel * y


def harpe(f: float, duree: float = 2.0, vel: float = 1.0, t60: float | None = None,
          brillance: float = 1.0, graine: int = 0, position: float = 0.21) -> np.ndarray:
    """Harpe de verre: corde pincée, harmoniques en 1/k^1,3 qui s'éteignent d'autant plus vite qu'elles montent."""
    rng = np.random.default_rng(graine + 1000)
    if t60 is None:
        t60 = float(np.clip(2.2 * (440.0 / f) ** 0.5, 0.5, 4.0))
    partiels = []
    kmax = int(min(14, 12000.0 / f))
    for k in range(1, kmax + 1):
        amp = abs(np.sin(np.pi * k * position)) / k ** 1.3
        amp *= brillance ** (k - 1) if k > 1 else 1.0
        rapport = k * np.sqrt(1.0 + 0.00015 * k * k)  # légère inharmonicité de corde
        facteur = 1.0 / (1.0 + 0.45 * (k - 1))
        partiels.append((rapport, amp, facteur))
    y = _somme_partiels(f, duree, partiels, t60, 0.0025, rng)
    return vel * y / 1.25


def feutre(f: float, duree: float = 0.8, vel: float = 1.0, t60: float = 0.45,
           graine: int = 0, attaque: float = 0.006) -> np.ndarray:
    """Maillet de feutre: presque un sinus, un soupçon de partiel 4 (lame accordée), très mat."""
    rng = np.random.default_rng(graine + 2000)
    partiels = [(1.0, 1.0, 1.0), (2.0, 0.07, 0.5), (3.98, 0.05, 0.22)]
    return vel * _somme_partiels(f, duree, partiels, t60, attaque, rng)


def harmonica(f_debut: float, duree: float, vel: float = 1.0, f_fin: float | None = None,
              tau: float = 0.2, attaque: float = 0.08, t60: float = 2.5,
              graine: int = 0, courbe=None, phase: float | None = None) -> np.ndarray:
    """Harmonica de verre: son tenu presque pur. La hauteur va de f_debut à f_fin
    en approche exponentielle (constante tau), ou suit `courbe(t)` si elle est fournie.
    `phase` fixe la phase de départ (sinon tirée au hasard avec la graine)."""
    rng = np.random.default_rng(graine + 3000)
    t = axe(duree)
    if courbe is not None:
        f_t = courbe(t)
    elif f_fin is None:
        f_t = np.full_like(t, f_debut)
    else:
        f_t = f_fin + (f_debut - f_fin) * np.exp(-t / tau)
    depart = rng.uniform(0, DEUX_PI) if phase is None else phase
    # Phase intégrée à partir de 0 au premier échantillon (somme décalée d'un pas).
    phi = DEUX_PI * (np.cumsum(f_t) - f_t) / SR + depart
    y = np.sin(phi) + 0.18 * np.sin(2 * phi) + 0.04 * np.sin(3 * phi)
    env = attaque_douce(len(t), attaque) * np.exp(-LN_1000 * t / t60)
    return vel * y * env / 1.1


def phase_accordee(f: float, f_debut: float, tau: float, retard: float, phase_ref: float = 0.0) -> float:
    """Phase de départ d'un harmonica qui glisse de f_debut vers f (constante tau) et commence
    `retard` secondes après un harmonica tenu sur f de phase phase_ref: une fois accordées, les deux
    notes sont en phase et se renforcent au lieu de s'annuler."""
    return float((phase_ref + DEUX_PI * f * retard - DEUX_PI * (f_debut - f) * tau) % DEUX_PI)


def nappe(f: float, duree: float, vel: float = 1.0, attaque: float = 1.2, relache: float = 2.0,
          coupure: float = 1600.0, voix: int = 3, desaccord: float = 7.0, graine: int = 0,
          t0: float = 0.0, periode_lfo: float = 8.0) -> np.ndarray:
    """Synthé chaud: dents de scie additives désaccordées (voix réparties en stéréo), passe-bas doux.
    Sort un tableau stéréo de longueur duree + relache. La modulation lente dépend du temps absolu
    t0 + t, avec une période qui divise la boucle du salon: la boucle reste sans couture."""
    rng = np.random.default_rng(graine + 4000)
    n = int(round((duree + relache) * SR))
    t = np.arange(n) / SR
    env = np.ones(n)
    na = int(attaque * SR)
    if na > 0:
        env[:na] = 0.5 - 0.5 * np.cos(np.pi * np.arange(na) / na)
    nd = int(duree * SR)
    nr = n - nd
    if nr > 0:
        env[nd:] *= 0.5 + 0.5 * np.cos(np.pi * np.arange(nr) / nr)
    sortie = np.zeros((n, 2))
    if voix == 1:
        decalages = [0.0]
        pans = [0.0]
    else:
        decalages = np.linspace(-desaccord, desaccord, voix)
        pans = np.linspace(-0.7, 0.7, voix)
    for i, (cents, pan) in enumerate(zip(decalages, pans)):
        fv = f * 2.0 ** (cents / 1200.0)
        base = DEUX_PI * fv * t + rng.uniform(0, DEUX_PI)
        y = np.zeros(n)
        kmax = int(min(24, 9000.0 / fv))
        for k in range(1, kmax + 1):
            poids = (1.0 / k) / np.sqrt(1.0 + (fv * k / coupure) ** 4)
            if poids < 0.002:
                break
            y += poids * np.sin(k * base + rng.uniform(0, DEUX_PI))
        lfo = 1.0 + 0.18 * np.sin(DEUX_PI * (t0 + t) / periode_lfo + i * 2.1 + rng.uniform(0, 0.3))
        y *= lfo
        g_g, g_d = gains_pan(pan)
        sortie[:, 0] += g_g * y
        sortie[:, 1] += g_d * y
    return vel * sortie * env[:, None] / (0.9 * voix)


def basse(f: float, duree: float, vel: float = 1.0, attaque: float = 1.5, relache: float = 2.5,
          graine: int = 0) -> np.ndarray:
    """Basse ronde: sinus et un peu d'octave, pour la chaleur au casque."""
    rng = np.random.default_rng(graine + 5000)
    n = int(round((duree + relache) * SR))
    t = np.arange(n) / SR
    ph = DEUX_PI * f * t + rng.uniform(0, DEUX_PI)
    y = np.sin(ph) + 0.22 * np.sin(2 * ph) + 0.05 * np.sin(3 * ph)
    env = np.ones(n)
    na = int(attaque * SR)
    env[:na] = 0.5 - 0.5 * np.cos(np.pi * np.arange(na) / na)
    nd = int(duree * SR)
    nr = n - nd
    env[nd:] *= 0.5 + 0.5 * np.cos(np.pi * np.arange(nr) / nr)
    return vel * y * env


# --- Placement et mixage --------------------------------------------------------------

def gains_pan(pan: float) -> tuple[float, float]:
    """Panoramique à puissance constante, pan de -1 (gauche) à +1 (droite)."""
    angle = (pan + 1.0) * np.pi / 4.0
    return float(np.cos(angle)), float(np.sin(angle))


def toile(duree: float) -> np.ndarray:
    return np.zeros((int(round(duree * SR)), 2))


def poser(toile_st: np.ndarray, son: np.ndarray, debut: float, pan: float = 0.0,
          gain: float = 1.0) -> None:
    """Ajoute un son mono (panoramiqué) ou stéréo à la toile, à partir de `debut` secondes."""
    i0 = int(round(debut * SR))
    if i0 >= len(toile_st):
        return
    if son.ndim == 1:
        g_g, g_d = gains_pan(pan)
        stereo = np.stack([son * g_g, son * g_d], axis=1)
    else:
        stereo = son
    fin = min(len(toile_st), i0 + len(stereo))
    toile_st[i0:fin] += gain * stereo[: fin - i0]


def passe_haut(x: np.ndarray, fc: float, ordre: int = 2) -> np.ndarray:
    sos = signal.butter(ordre, fc, btype="high", fs=SR, output="sos")
    return signal.sosfilt(sos, x, axis=0)


def passe_bas(x: np.ndarray, fc: float, ordre: int = 2) -> np.ndarray:
    sos = signal.butter(ordre, fc, btype="low", fs=SR, output="sos")
    return signal.sosfilt(sos, x, axis=0)


def plateau_aigu(x: np.ndarray, fc: float, gain_db: float) -> np.ndarray:
    """Étagère d'aigus (RBJ), pour adoucir les sons au-dessus de fc."""
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
    b = np.array([b0, b1, b2]) / a0
    a_ = np.array([1.0, a1 / a0, a2 / a0])
    return signal.lfilter(b, a_, x, axis=0)


def passe_bas_variable(x: np.ndarray, coupure_t, bloc: int = 64) -> np.ndarray:
    """Passe-bas du second ordre dont la coupure suit coupure_t(t) (t en secondes), par blocs."""
    mono = x.ndim == 1
    xs = x[:, None] if mono else x
    sortie = np.zeros_like(xs)
    etat = None
    for i0 in range(0, len(xs), bloc):
        i1 = min(len(xs), i0 + bloc)
        fc = float(np.clip(coupure_t((i0 + i1) / 2.0 / SR), 40.0, 20000.0))
        b, a = signal.butter(2, fc, btype="low", fs=SR)
        if etat is None:
            etat = np.zeros((2, xs.shape[1]))
        sortie[i0:i1], etat = signal.lfilter(b, a, xs[i0:i1], axis=0, zi=etat)
    return sortie[:, 0] if mono else sortie


def reverbe(x: np.ndarray, taille: float = 0.55, humide: float = 0.18, sec: float = 0.9,
            amorti: float = 0.55, largeur: float = 0.9) -> np.ndarray:
    from pedalboard import Pedalboard, Reverb

    pb = Pedalboard([Reverb(room_size=taille, damping=amorti, wet_level=humide,
                            dry_level=sec, width=largeur)])
    y = pb(x.T.astype(np.float32), SR)
    return y.T.astype(np.float64)


def couper_queue(x: np.ndarray, seuil_db: float = -75.0, garde: float = 0.03) -> np.ndarray:
    """Retire le silence final sous seuil_db (relatif à la crête), avec une marge et un fondu."""
    crete = np.max(np.abs(x)) + 1e-12
    seuil = crete * 10 ** (seuil_db / 20.0)
    actif = np.where(np.max(np.abs(x), axis=1) > seuil)[0]
    if len(actif) == 0:
        return x
    fin = min(len(x), actif[-1] + int(garde * SR))
    y = x[:fin].copy()
    return fondu_fin(y, 0.03)


# --- Mesures: sonie BS.1770 et crête vraie ----------------------------------------------

def _ponderation_k(x: np.ndarray) -> np.ndarray:
    # Coefficients de la recommandation UIT-R BS.1770-4 pour 48 kHz.
    b1 = [1.53512485958697, -2.69169618940638, 1.19839281085285]
    a1 = [1.0, -1.69065929318241, 0.73248077421585]
    b2 = [1.0, -2.0, 1.0]
    a2 = [1.0, -1.99004745483398, 0.99007225036621]
    y = signal.lfilter(b1, a1, x, axis=0)
    return signal.lfilter(b2, a2, y, axis=0)


def sonie_momentanee_max(x: np.ndarray) -> float:
    """Sonie momentanée maximale (fenêtre de 400 ms, pas de 100 ms), en LUFS.
    Le son est complété par du silence pour que chaque fenêtre soit pleine, comme ebur128."""
    pad = np.zeros((int(0.4 * SR), 2))
    y = _ponderation_k(np.concatenate([pad, x, pad]))
    p = np.sum(y ** 2, axis=1)
    cumul = np.concatenate([[0.0], np.cumsum(p)])
    n = int(0.4 * SR)
    pas = int(0.1 * SR)
    meilleur = 1e-20
    for i in range(0, len(p) - n + 1, pas):
        meilleur = max(meilleur, (cumul[i + n] - cumul[i]) / n)
    return -0.691 + 10 * np.log10(meilleur)


def sonie_integree(x: np.ndarray) -> float:
    y = _ponderation_k(x)
    p = np.sum(y ** 2, axis=1)
    n = int(0.4 * SR)
    pas = int(0.1 * SR)
    cumul = np.concatenate([[0.0], np.cumsum(p)])
    blocs = np.array([(cumul[i + n] - cumul[i]) / n for i in range(0, len(p) - n + 1, pas)])
    lk = -0.691 + 10 * np.log10(blocs + 1e-20)
    blocs = blocs[lk > -70]
    if len(blocs) == 0:
        return -70.0
    seuil = -0.691 + 10 * np.log10(np.mean(blocs)) - 10
    lk = -0.691 + 10 * np.log10(blocs + 1e-20)
    garde = blocs[lk > seuil]
    return -0.691 + 10 * np.log10(np.mean(garde))


def crete_vraie_db(x: np.ndarray) -> float:
    sur = signal.resample_poly(x, 4, 1, axis=0)
    return 20 * np.log10(np.max(np.abs(sur)) + 1e-12)


def normaliser_momentanee(x: np.ndarray, cible_lufs: float, plafond_dbtp: float = -1.5) -> np.ndarray:
    """Amène la sonie momentanée maximale à la cible; si la crête vraie dépasse le plafond,
    baisse le gain (on préfère un son un peu plus faible à un limiteur sur un son d'interface)."""
    gain_db = cible_lufs - sonie_momentanee_max(x)
    y = x * 10 ** (gain_db / 20.0)
    tp = crete_vraie_db(y)
    if tp > plafond_dbtp:
        y *= 10 ** ((plafond_dbtp - tp) / 20.0)
    return y
