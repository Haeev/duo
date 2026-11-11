"""Planche d'écoute d'un lot d'Aubrune pour le client: chaque son décodé depuis le fichier livré,
dans l'ordre de `SONS` du module du lot, séparé d'un silence de 0,8 s. Copie M4A (AAC mono), hors
du jeu: `assets-src/son/ecoute/lot-<n>-aubrune.m4a`, avec les instants et durées en `.txt`.
Un son tenu (`BOUCLES`) est joué comme en jeu: le fichier, puis deux tours de sa boucle, fondu.
Usage: duo-python assets-src/son/planche_lot.py [--lot 3] (deuxième lot par défaut)
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
import sons_lot3  # noqa: E402

TROIS = "--lot" in sys.argv and sys.argv[sys.argv.index("--lot") + 1] == "3"
LOT = sons_lot3 if TROIS else sons_aubrune
NOM = "lot-3-aubrune" if TROIS else "lot-2-aubrune"


def main() -> int:
    morceaux: list[np.ndarray] = []
    lignes = []
    t = 0.0
    boucles = getattr(LOT, "BOUCLES", {})
    for nom, _ in LOT.fichiers():
        x = dsp.mono(dsp.decoder(generer.SORTIE / "effets" / f"{nom}.ogg", 1))
        if nom in boucles:
            a, b = (dsp.n_ech(s) for s in boucles[nom])
            x = dsp.fondu(np.concatenate([x[:b], x[a:b], x[a:b]]), 0.0, 0.4)
        lignes.append(f"{int(t // 60)}:{t % 60:05.2f} {nom} ({len(x) / dsp.SR:.2f} s{', tenu' if nom in boucles else ''})"
                      if TROIS else f"{int(t // 60)}:{t % 60:05.2f} {nom}")
        morceaux += [x, np.zeros(dsp.n_ech(0.8))]
        t += len(x) / dsp.SR + 0.8
    y = np.concatenate(morceaux) * 10 ** (-2 / 20)  # marge pour l'AAC
    dossier = Path(__file__).parent / "ecoute"
    dossier.mkdir(exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        wav = Path(tmp) / "p.wav"
        dsp.ecrire_wav(wav, y)
        dsp.encoder_m4a(wav, dossier / f"{NOM}.m4a", "48k", f"La Petite Ligne, Aubrune, lot {3 if TROIS else 2}")
    (dossier / f"{NOM}.txt").write_text("\n".join(lignes) + "\n", encoding="utf-8")
    return 0


if __name__ == "__main__":
    sys.exit(main())
