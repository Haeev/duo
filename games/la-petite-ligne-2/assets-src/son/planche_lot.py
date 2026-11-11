"""Planche d'écoute du deuxième lot d'Aubrune pour le client: chaque son décodé depuis le fichier
livré, dans l'ordre de `sons_aubrune.SONS`, séparé d'un silence de 0,8 s. Copie M4A (AAC mono),
hors du jeu: `assets-src/son/ecoute/lot-2-aubrune.m4a`, avec la liste des instants en `.txt`.
Usage: duo-python assets-src/son/planche_lot.py
"""

from __future__ import annotations

import sys
import tempfile
from pathlib import Path

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).parent))

import numpy as np  # noqa: E402

import dsp  # noqa: E402
import generer  # noqa: E402
import sons_aubrune  # noqa: E402


def main() -> int:
    morceaux: list[np.ndarray] = []
    lignes = []
    t = 0.0
    for nom, _ in sons_aubrune.fichiers():
        x = dsp.mono(dsp.decoder(generer.SORTIE / "effets" / f"{nom}.ogg", 1))
        lignes.append(f"{int(t // 60)}:{t % 60:05.2f} {nom}")
        morceaux += [x, np.zeros(dsp.n_ech(0.8))]
        t += len(x) / dsp.SR + 0.8
    y = np.concatenate(morceaux) * 10 ** (-2 / 20)  # marge pour l'AAC
    dossier = Path(__file__).parent / "ecoute"
    dossier.mkdir(exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        wav = Path(tmp) / "p.wav"
        dsp.ecrire_wav(wav, y)
        dsp.encoder_m4a(wav, dossier / "lot-2-aubrune.m4a", "48k", "La Petite Ligne, Aubrune, lot 2")
    (dossier / "lot-2-aubrune.txt").write_text("\n".join(lignes) + "\n", encoding="utf-8")
    return 0


if __name__ == "__main__":
    sys.exit(main())
