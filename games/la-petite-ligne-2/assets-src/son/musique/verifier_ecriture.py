"""Contrôle de l'écriture des musiques (on ne peut pas écouter): notes de sol majeur seulement,
aucun frottement tenu entre deux pistes (seconde mineure, septième majeure, triton hors accord),
durées entières en secondes, mesures complètes.

Usage: duo-python -I assets-src/son/musique/verifier_ecriture.py   (code de sortie 1 s'il y a une faute)
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import mido  # noqa: E402

from aubrune import GAMME, JINGLES, MORCEAUX  # noqa: E402
from partition import frottements  # noqa: E402

MIDI = Path(__file__).resolve().parent / "midi"


def classes_du_midi(chemin: Path) -> set[int]:
    classes: set[int] = set()
    for piste in mido.MidiFile(str(chemin)).tracks:
        canal_percu = {m.channel for m in piste if hasattr(m, "channel") and m.channel == 9}
        for msg in piste:
            if msg.type == "note_on" and msg.velocity > 0 and msg.channel not in canal_percu:
                classes.add(msg.note % 12)
    return classes


def main() -> int:
    fautes = 0
    for f in MORCEAUX + JINGLES:
        r = f()
        m = r[0] if isinstance(r, tuple) else r
        etrangeres = classes_du_midi(MIDI / f"{m.id}.mid") - set(GAMME)
        duree = m.duree_s
        problemes = []
        if etrangeres:
            problemes.append(f"notes hors de sol majeur: {sorted(etrangeres)}")
        if m.boucle and abs(duree - round(duree)) > 1e-9:
            problemes.append(f"durée non entière: {duree}")
        if m.boucle and not 60 <= duree <= 90:
            problemes.append(f"durée hors de 60 à 90 s: {duree}")
        rapports = frottements(m) if m.boucle else []
        problemes += [f"frottement: {x}" for x in rapports]
        etat = "ok" if not problemes else "FAUTE"
        print(f"{m.id:28s} {m.tempo:5.0f} {m.signature[0]}/{m.signature[1]} {duree:6.2f} s  "
              f"{' '.join(a.symbole for a in m.accords[:16])[:60]}  {etat}")
        for p in problemes:
            print("   ", p)
            fautes += 1
    return 1 if fautes else 0


if __name__ == "__main__":
    sys.exit(main())
