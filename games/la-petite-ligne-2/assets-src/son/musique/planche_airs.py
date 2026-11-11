"""Planche d'écoute des huit airs de la collection d'Aubrune, pour le client: un extrait de 10 s
de chaque air (tiges `fond` et `air` additionnées, décodées depuis les fichiers livrés), fondus de
0,3 s, séparés d'un silence de 0,8 s. Copie M4A (AAC mono), hors du jeu:
`assets-src/son/ecoute/airs-aubrune.m4a`, avec la liste des instants en `.txt`.

Usage: duo-python -I assets-src/son/musique/planche_airs.py
"""

from __future__ import annotations

import sys
import tempfile
from pathlib import Path

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
sys.path.insert(0, str(Path(__file__).resolve().parent))  # le `generer.py` de la musique d'abord

import numpy as np  # noqa: E402

import dsp  # noqa: E402
from generer import AMORCE, SORTIE  # noqa: E402

# Début de l'extrait dans la boucle (s): le passage le plus parlant de chaque air.
EXTRAITS = {
    "air-marche-de-la-halte": (47.0, "roulement puis la reprise en tutti"),
    "air-valse-de-la-minute": (18.0, "fin du A à l'accordéon, puis le pont sifflé"),
    "air-carillon-des-deux-soeurs": (26.0, "fin de la complainte, puis les deux cloches"),
    "air-chanson-des-marmites": (26.0, "la berceuse reprise à l'accordéon, couvercles"),
    "air-canon-de-la-repetition": (10.0, "les trois voix du canon"),
    "air-chant-de-la-coupe": (30.0, "appel du trombone, réponse de la clarinette"),
    "air-sifflet-du-samedi": (0.0, "le sifflet et le début de la chanson"),
    "air-sonnerie-de-5h12": (0.0, "la cloche et la première phrase du choral"),
}
DUREE = 10.0


def main() -> int:
    morceaux: list[np.ndarray] = []
    lignes = []
    t = 0.0
    for id_, (debut, quoi) in EXTRAITS.items():
        tiges = [dsp.decoder(SORTIE / f"{id_}-{s}.ogg", 1) for s in ("fond", "air")]
        x = sum(tiges)
        a = dsp.n_ech(AMORCE + debut)
        extrait = dsp.fondu(x[a:a + dsp.n_ech(DUREE)], 0.3, 0.3)
        lignes.append(f"{int(t // 60)}:{t % 60:05.2f} {id_}: {quoi} (à {debut:g} s dans la boucle)")
        morceaux += [extrait, np.zeros(dsp.n_ech(0.8))]
        t += DUREE + 0.8
    y = np.concatenate(morceaux) * 10 ** (-2 / 20)  # marge pour l'AAC
    dossier = Path(__file__).resolve().parent.parent / "ecoute"
    dossier.mkdir(exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        wav = Path(tmp) / "p.wav"
        dsp.ecrire_wav(wav, y)
        dsp.encoder_m4a(wav, dossier / "airs-aubrune.m4a", "56k", "La Petite Ligne, airs d'Aubrune")
    (dossier / "airs-aubrune.txt").write_text("\n".join(lignes) + "\n", encoding="utf-8")
    return 0


if __name__ == "__main__":
    sys.exit(main())
