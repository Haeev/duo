"""Simulations jointes aux pistes de concept du jeu 1 (docs/jeux/jeu-1/pistes-concept.md).

1. Rythme: ce que représentent 100 heures selon la durée d'une journée de jeu
   (années de jeu, journées, séances).
2. Collections: temps réel pour remplir une collection tirée au hasard,
   avec et sans « coup de pouce » vers les entrées manquantes.

Usage: python3 rythme_et_collections.py
Bibliothèque standard uniquement, graine fixe: résultats reproductibles.
"""

from __future__ import annotations

import random
import statistics
from dataclasses import dataclass, field

SEED = 20261030
RUNS = 2000
TARGET_HOURS = 100.0


@dataclass(frozen=True)
class Pacing:
    name: str
    minutes_per_day: float
    days_per_season: int
    seasons_per_year: int = 4


PACINGS: list[Pacing] = [
    # A: journée chronométrée de 14 min (6 h à minuit) plus une veillée libre de 3 min en moyenne.
    Pacing("A La Petite Ligne", 14.0 + 3.0, 21),
    # B: matinée 5 min, après-midi 5 min, service 6 min en moyenne, veillée 1,5 min.
    Pacing("B Le Puits aux Étoiles", 5.0 + 5.0 + 6.0 + 1.5, 20),
    # C: nuit de 12 min en moyenne (9 en été, 15 en hiver), aube 1,5 min, terrier 3 min.
    Pacing("C Les Nuits de Brumecombe", 12.0 + 1.5 + 3.0, 24),
]


def report_pacing() -> None:
    print("1. Rythme: ce que représentent 100 heures")
    header = (
        f"{'Piste':<27}{'min/jour':>9}{'h/saison':>10}{'h/année':>9}"
        f"{'années':>8}{'jours':>7}{'séances 30 min':>16}{'séances 40 min':>16}{'jours/séance 40':>17}"
    )
    print(header)
    for p in PACINGS:
        season_h = p.minutes_per_day * p.days_per_season / 60.0
        year_h = season_h * p.seasons_per_year
        years = TARGET_HOURS / year_h
        days = TARGET_HOURS * 60.0 / p.minutes_per_day
        print(
            f"{p.name:<27}{p.minutes_per_day:>9.1f}{season_h:>10.1f}{year_h:>9.1f}"
            f"{years:>8.1f}{days:>7.0f}{TARGET_HOURS / 0.5:>16.0f}{TARGET_HOURS / (40 / 60):>16.0f}"
            f"{40 / p.minutes_per_day:>17.1f}"
        )
    print("Repère: à 2 heures de jeu par semaine, 100 heures représentent 50 semaines.")
    print()


@dataclass(frozen=True)
class Rarity:
    share: float  # part des entrées de la collection
    weight: float  # poids relatif au tirage


RARITIES: list[Rarity] = [Rarity(0.45, 6.0), Rarity(0.40, 3.0), Rarity(0.15, 1.0)]


@dataclass
class Collection:
    name: str
    size: int
    draws_per_hour: float
    # Saison de jeu en heures réelles et nombre de saisons où chaque entrée est disponible (4 = toute l'année).
    season_hours: float = 0.0
    seasons_available: int = 4
    # Heures de déblocage: chaque groupe d'entrées n'apparaît qu'à partir de cette heure de jeu.
    unlock_hours: list[float] = field(default_factory=lambda: [0.0])


COLLECTIONS: list[Collection] = [
    # A: carnet d'oiseaux, 72 espèces réparties sur 6 gares, chacune visible 2 saisons sur 4.
    Collection("A Carnet d'oiseaux (72)", 72, 5.0, season_hours=6.0, seasons_available=2,
               unlock_hours=[0.0, 10.0, 24.0, 43.0, 62.0, 81.0]),
    # B: livre d'or, 160 sortes de voyageurs (8 peuples x 20 métiers), peuples débloqués par les routes.
    Collection("B Livre d'or (160)", 160, 17.0,
               unlock_hours=[0.0, 0.0, 0.0, 15.0, 30.0, 45.0, 60.0, 75.0]),
    # C: trouvailles, 120 objets, chacun lié à 3 saisons sur 4 (le reste du temps introuvable).
    Collection("C Trouvailles (120)", 120, 6.0, season_hours=6.6, seasons_available=3),
]


def build_items(c: Collection, rng: random.Random) -> list[tuple[float, float, frozenset[int]]]:
    """Renvoie pour chaque entrée: poids, heure de déblocage, saisons de disponibilité."""
    items: list[tuple[float, float, frozenset[int]]] = []
    groups = len(c.unlock_hours)
    for i in range(c.size):
        share_acc = 0.0
        weight = RARITIES[-1].weight
        position = i / c.size
        for r in RARITIES:
            share_acc += r.share
            if position < share_acc:
                weight = r.weight
                break
        unlock = c.unlock_hours[i % groups]
        start = rng.randrange(4)
        seasons = frozenset((start + k) % 4 for k in range(c.seasons_available))
        items.append((weight, unlock, seasons))
    return items


def hours_to_fill(c: Collection, boost: float, rng: random.Random, cap_hours: float = 600.0) -> dict[float, float]:
    """Simule une partie et renvoie l'heure où la collection atteint 50, 90 et 100 %.

    Tirer une entrée déjà vue ne change rien: on simule donc directement l'arrivée de la
    prochaine entrée nouvelle, processus de Poisson dont le taux ne change qu'aux découvertes,
    aux changements de saison et aux déblocages (simulation exacte, et rapide).
    """
    items = build_items(c, rng)
    weights = [w for w, _, _ in items]
    seen = [False] * c.size
    seen_count = 0
    thresholds = {0.5: -1.0, 0.9: -1.0, 1.0: -1.0}
    unlocks = sorted(set(c.unlock_hours))
    # Entrées disponibles selon (saison, nombre de déblocages atteints), calculées une seule fois.
    available_cache: dict[tuple[int, int], list[int]] = {}
    # Le numéro de saison est compté en entier: le déduire de t par division ferait boucler
    # la simulation sur une frontière de saison à cause des arrondis.
    season_index = 0
    t = 0.0
    while seen_count < c.size and t < cap_hours:
        if c.season_hours > 0:
            while (season_index + 1) * c.season_hours <= t:
                season_index += 1
        season = season_index % 4
        unlocked = sum(1 for u in unlocks if u <= t)
        boundary = cap_hours
        if c.season_hours > 0:
            boundary = min(boundary, (season_index + 1) * c.season_hours)
        if unlocked < len(unlocks):
            boundary = min(boundary, unlocks[unlocked])
        key = (season, unlocked)
        available = available_cache.get(key)
        if available is None:
            available = [
                idx for idx, (_, unlock, seasons) in enumerate(items)
                if unlock <= t and (c.season_hours <= 0 or season in seasons)
            ]
            available_cache[key] = available
        unseen = [idx for idx in available if not seen[idx]]
        unseen_w = [weights[idx] for idx in unseen]
        seen_w = sum(weights[idx] for idx in available if seen[idx])
        total_unseen = sum(unseen_w) * boost
        if total_unseen <= 0:
            t = boundary
            continue
        rate = c.draws_per_hour * total_unseen / (total_unseen + seen_w)
        dt = rng.expovariate(rate)
        if t + dt >= boundary:
            t = boundary
            continue
        t += dt
        pick = rng.choices(unseen, weights=unseen_w, k=1)[0]
        seen[pick] = True
        seen_count += 1
        ratio = seen_count / c.size
        for th in thresholds:
            if thresholds[th] < 0 and ratio >= th:
                thresholds[th] = t
    for th in thresholds:
        if thresholds[th] < 0:
            thresholds[th] = cap_hours
    return thresholds


def percentile(values: list[float], q: float) -> float:
    ordered = sorted(values)
    index = min(len(ordered) - 1, max(0, round(q * (len(ordered) - 1))))
    return ordered[index]


def report_collections() -> None:
    print(f"2. Collections: heures de jeu pour atteindre 50, 90 et 100 % ({RUNS} parties simulées)")
    print("   médiane (et 9 parties sur 10 en dessous de)")
    print(f"{'Collection':<26}{'tirage':<22}{'50 %':>14}{'90 %':>14}{'100 %':>16}")
    rng = random.Random(SEED)
    for c in COLLECTIONS:
        for label, boost in (("au hasard", 1.0), ("coup de pouce x4", 4.0)):
            results = [hours_to_fill(c, boost, rng) for _ in range(RUNS)]
            cells = []
            for th in (0.5, 0.9, 1.0):
                values = [r[th] for r in results]
                cells.append(f"{statistics.median(values):.0f} ({percentile(values, 0.9):.0f})")
            print(f"{c.name:<26}{label:<22}{cells[0]:>14}{cells[1]:>14}{cells[2]:>16}")
    print("Coup de pouce x4: une entrée encore jamais vue a quatre fois plus de chances d'être tirée.")


def main() -> None:
    report_pacing()
    report_collections()


if __name__ == "__main__":
    main()
