"""Moments rares de La Petite Ligne: tirage du jour, fenêtre de 7 jours, fréquence.

Document lié: docs/jeux/jeu-1/tour-06-conception.md (section 1.3 et annexe A).

Ce script rejoue exactement la règle proposée pour le code:
- chaque matin (6 h), au plus un moment rare par jour, quêtes comprises;
- les moments de quête sortent le jour où leur variante d'après-midi le veut
  (empreinte FNV-1a de la graine, comme `variantOf` de `src/simulation/conditions.ts`);
- un moment d'ambiance est tiré avec la probabilité `dailyChance`, parmi les
  moments admissibles ce jour-là (jour, météo, drapeaux), hors fenêtre de
  `cooldownDays` jours, hors moments dont la quête est active ou prévue dans
  moins de `cooldownDays` jours;
- les tirages ne consomment pas le générateur de la partie: empreinte de
  « graine:moment:jour », mélangée par fmix32.

Parties:
1. Démo (15 jours, météo fixe de reglages.json): 8 graines du robot, puis 20 000 graines.
2. Sensibilité à `dailyChance` et au retard des joueurs sur les quêtes.
3. Long cours: saisons de 21 jours, météo tirée, réserve de 6, 8 ou 12 moments.

Usage: python3 moments_rares.py
Bibliothèque standard uniquement.
"""

from __future__ import annotations

import random
import statistics
from dataclasses import dataclass, field

# --- Données de la démo (reglages.json, quetes.json) -------------------------

WEATHER = ["sunny", "sunny", "sunny", "rain", "sunny", "cloudy", "sunny", "sunny",
           "sunny", "cloudy", "sunny", "rain", "sunny", "sunny", "sunny"]  # jours 1 à 15
TRAIN_DAYS = {1, 8, 15}
LAST_DAY = 15


def fnv1a(text: str) -> int:
    h = 0x811C9DC5
    for ch in text:
        h ^= ord(ch)
        h = (h * 0x01000193) & 0xFFFFFFFF
    return h


def fmix32(h: int) -> int:
    h ^= h >> 16
    h = (h * 0x85EBCA6B) & 0xFFFFFFFF
    h ^= h >> 13
    h = (h * 0xC2B2AE35) & 0xFFFFFFFF
    h ^= h >> 16
    return h


def variant_of(seed: int, group: str, of: int) -> int:
    """Copie de `variantOf` (conditions.ts): FNV-1a de « graine:groupe », modulo."""
    return fnv1a(f"{seed}:{group}") % of


def unit(seed: int, key: str, day: int) -> float:
    """Nombre dans [0, 1[ tiré de « graine:clé:jour » (ne touche pas au générateur de la partie)."""
    return fmix32(fnv1a(f"{seed}:{key}:{day}")) / 2**32


# --- Réserve de moments (tour 6) --------------------------------------------


@dataclass(frozen=True)
class Moment:
    id: str
    tier: str
    weight: int
    min_day: int
    weathers: frozenset[str]
    needs_flag: str | None = None
    quest_group: str | None = None  # groupe de variante de la quête qui le porte
    quest_day: int | None = None
    max_per_season: int | None = None  # les oies ne passent qu'une fois par printemps


ALL = frozenset({"sunny", "cloudy", "rain"})
DRY = frozenset({"sunny", "cloudy"})
SUN = frozenset({"sunny"})

RESERVE = [
    Moment("heron", "P0", 3, 4, DRY, quest_group="afternoon_d6", quest_day=6),
    Moment("geese", "P0", 2, 5, DRY, quest_group="afternoon_d11", quest_day=11, max_per_season=1),
    Moment("ladder", "P0", 0, 10, ALL, quest_group="afternoon_d10", quest_day=10),  # quête seulement
    Moment("tits", "P0", 3, 4, DRY, needs_flag="nest_box_straight"),
    Moment("fox", "P0", 3, 3, DRY),
    Moment("glowworms", "P0", 2, 9, SUN),
    Moment("roe_deer", "P1", 2, 2, DRY),
    Moment("kingfisher", "P1", 2, 4, SUN),
]


@dataclass
class Result:
    log: list[tuple[int, str, str]] = field(default_factory=list)  # (jour, moment, origine)

    def count(self) -> int:
        return len(self.log)


def play_demo(seed: int, chance: float, tiers: set[str], delay_rng: random.Random | None = None,
              cooldown: int = 7) -> Result:
    res = Result()
    moments = [m for m in RESERVE if m.tier in tiers]
    # Quêtes de moment: jour prévu (variante 1), puis retard éventuel des joueurs.
    quest_day: dict[str, int] = {}
    for m in moments:
        if m.quest_group is not None and m.quest_day is not None and variant_of(seed, m.quest_group, 2) == 1:
            late = 0 if delay_rng is None else delay_rng.choice([0, 0, 0, 1, 1, 2])
            quest_day[m.id] = min(m.quest_day + late, LAST_DAY)
    last_end: dict[str, int] = {}
    flags: set[str] = set()
    for day in range(1, LAST_DAY + 1):
        weather = WEATHER[day - 1]
        # Moment de quête du jour (la quête démarre à son jour; il reste là jusqu'au jour où on le voit).
        todays_quest = [mid for mid, d in quest_day.items() if d == day]
        if todays_quest:
            mid = todays_quest[0]
            res.log.append((day, mid, "quête"))
            last_end[mid] = day
            if mid == "ladder":
                flags.add("nest_box_straight")
            continue
        if day in TRAIN_DAYS:
            continue
        if unit(seed, "moment", day) >= chance:
            continue
        eligible = []
        for m in moments:
            if m.weight == 0 or day < m.min_day or weather not in m.weathers:
                continue
            if m.needs_flag is not None and m.needs_flag not in flags:
                continue
            if m.id in last_end and day - last_end[m.id] < cooldown:
                continue
            if m.max_per_season is not None and sum(1 for _, x, _ in res.log if x == m.id) >= m.max_per_season:
                continue
            q = quest_day.get(m.id)
            # Quête active (démarrée, pas encore vue) ou prévue plus tard (fenêtre de 7 jours,
            # ou plafond par saison): exclu.
            if q is not None and m.quest_group is not None and m.quest_day is not None:
                if m.quest_day <= day <= q or 0 < q - day < cooldown:
                    continue
                if m.max_per_season is not None and q > day:
                    continue
            eligible.append(m)
        if not eligible:
            continue
        total = sum(m.weight for m in eligible)
        pick = unit(seed, "moment_pick", day) * total
        for m in eligible:
            pick -= m.weight
            if pick < 0:
                res.log.append((day, m.id, "ambiance"))
                last_end[m.id] = day
                break
    return res


def check_window(res: Result, cooldown: int = 7) -> int:
    """Nombre de reprises d'un même moment à moins de `cooldown` jours (doit valoir 0)."""
    seen: dict[str, int] = {}
    bad = 0
    for day, mid, _ in res.log:
        if mid in seen and day - seen[mid] < cooldown:
            bad += 1
        seen[mid] = day
    return bad


def pct(values: list[float], p: float) -> float:
    s = sorted(values)
    return s[min(len(s) - 1, int(p * len(s)))]


def demo_report() -> None:
    print("== 1. Démo, 8 graines du robot (dailyChance 0,5, P0 seulement) ==")
    for seed in range(1, 9):
        r = play_demo(seed, 0.5, {"P0"})
        line = ", ".join(f"j{d} {m}{'*' if o == 'quête' else ''}" for d, m, o in r.log)
        print(f"graine {seed}: {r.count()} moments, reprises < 7 j: {check_window(r)} | {line}")
    print("(* = moment de quête)\n")

    print("== 2. Démo, 20 000 graines ==")
    print("chance | réserve | moments par démo (moy., p10, p90, min, max) | jours de 2 à 14 sans train avec un moment | sortes vues (moy.) | reprises < 7 j")
    for tiers, label in (({"P0"}, "P0"), ({"P0", "P1"}, "P0+P1")):
        for chance in (0.35, 0.5, 0.65):
            counts, kinds, bad = [], [], 0
            for seed in range(1, 20_001):
                r = play_demo(seed, chance, tiers)
                counts.append(r.count())
                kinds.append(len({m for _, m, _ in r.log}))
                bad += check_window(r)
            share = statistics.mean(counts) / 12
            print(f"{chance:.2f} | {label:5} | {statistics.mean(counts):.2f}, {pct(counts, .1)}, {pct(counts, .9)}, "
                  f"{min(counts)}, {max(counts)} | {share:.0%} | {statistics.mean(kinds):.2f} | {bad}")
    print()

    print("== 3. Retard des joueurs sur les quêtes (0, 1 ou 2 jours), chance 0,5, P0 ==")
    rng = random.Random(20261031)
    bad, counts = 0, []
    for seed in range(1, 20_001):
        r = play_demo(seed, 0.5, {"P0"}, delay_rng=rng)
        bad += check_window(r)
        counts.append(r.count())
    print(f"moments par démo: {statistics.mean(counts):.2f}; reprises < 7 j: {bad}\n")

    print("== 4. Part de chaque moment (chance 0,5, P0), 20 000 graines ==")
    tally: dict[str, int] = {}
    for seed in range(1, 20_001):
        for _, m, _ in play_demo(seed, 0.5, {"P0"}).log:
            tally[m] = tally.get(m, 0) + 1
    for m, n in sorted(tally.items(), key=lambda kv: -kv[1]):
        print(f"{m:10} {n / 20_000:.2f} par démo")
    print()


def long_run(reserve_size: int, chance: float, seasons: int, rng: random.Random) -> tuple[float, float, float]:
    """Saisons de 21 jours, météo tirée, une réserve de N moments équivalents (poids égaux, 2/3 par temps sec)."""
    last: dict[int, int] = {}
    gaps: list[int] = []
    shown = 0
    day_index = 0
    for _ in range(seasons):
        for _d in range(21):
            day_index += 1
            if day_index % 7 == 1:  # samedi: jour du train, rien
                continue
            weather = rng.choices(["sunny", "cloudy", "rain"], weights=[55, 25, 20])[0]
            if rng.random() >= chance:
                continue
            eligible = [i for i in range(reserve_size)
                        if (weather != "rain" or i % 3 == 0) and day_index - last.get(i, -99) >= 7]
            if not eligible:
                continue
            i = rng.choice(eligible)
            if i in last:
                gaps.append(day_index - last[i])
            last[i] = day_index
            shown += 1
    per_season = shown / seasons
    return per_season, statistics.median(gaps) if gaps else 0.0, pct([float(g) for g in gaps], 0.1) if gaps else 0.0


def long_report() -> None:
    print("== 5. Long cours (21 jours par saison, 4 saisons x 4 ans, chance 0,5) ==")
    print("réserve par saison | moments par saison | écart médian entre deux passages du même moment (jours) | écart p10")
    rng = random.Random(7)
    for size in (6, 8, 12):
        per, med, p10 = long_run(size, 0.5, 16, rng)
        print(f"{size:2} | {per:.1f} | {med:.0f} | {p10:.0f}")


if __name__ == "__main__":
    demo_report()
    long_report()
