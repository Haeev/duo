#!/usr/bin/env python3
"""La Petite Ligne 0.13, lot H0: règle des 6 départs par minute (v0-13-habitants.md, section 1.3).

Au plus 6 habitants changent de lieu dans la même minute de jeu (étalement des calculs de chemin sur le PC de
référence). Pour chaque journée type (saison, jour de la semaine, temps, jours particuliers) des plannings de
`v0_13_habitants.py`, on compte les habitants dont le point change à chaque minute, de 6 h à minuit, et on
liste les minutes où ils sont plus de 6, avec qui part et d'où.

Usage: python3 -I docs/jeux/jeu-1/simulations/v0_13_departs.py [--max N]
Bibliothèque standard uniquement.
"""

from __future__ import annotations

import sys
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import v0_13_habitants as h  # noqa: E402

LIMITE = 6


def departs(ctx: h.Ctx) -> dict[int, list[tuple[str, str, str]]]:
    """Minute -> [(habitant, point quitté, point visé)] pour une journée type."""
    res: dict[int, list[tuple[str, str, str]]] = {}
    for v in h.VILLAGERS:
        avant = None
        for minute in range(6 * 60, 24 * 60):
            e = h.entry_at(v, ctx, minute)
            point = e.point if e is not None else "offstage"
            if avant is not None and point != avant:
                res.setdefault(minute, []).append((v.id, avant, point))
            avant = point
    return res


def main(argv: list[str]) -> int:
    limite = int(argv[argv.index("--max") + 1]) if "--max" in argv else LIMITE
    journees = 0
    depassements: Counter[tuple[int, str]] = Counter()
    pire: tuple[int, str, int, list] = (0, "", 0, [])
    for ctx in h.scenarios():
        journees += 1
        for minute, qui in departs(ctx).items():
            if len(qui) > pire[0]:
                pire = (len(qui), f"{ctx.season} {ctx.weekday} {ctx.weather} {sorted(ctx.special)}", minute, qui)
            if len(qui) > limite:
                depassements[(minute, ", ".join(sorted(q[0] for q in qui)))] += 1
    print(f"{journees} journées types; au plus {pire[0]} départs dans la même minute "
          f"({pire[1]}, {pire[2] // 60} h {pire[2] % 60:02d})")
    if not depassements:
        print(f"règle tenue: jamais plus de {limite} départs dans la même minute")
        return 0
    print(f"{len(depassements)} minutes à plus de {limite} départs (minute, habitants: nombre de journées types):")
    for (minute, qui), n in sorted(depassements.items(), key=lambda e: (-e[1], e[0][0]))[:25]:
        print(f"  {minute // 60:2d} h {minute % 60:02d}  {qui}: {n}")
    return 1


if __name__ == "__main__":
    sys.exit(main(sys.argv))
