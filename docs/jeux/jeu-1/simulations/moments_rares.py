"""Moments rares de La Petite Ligne: tirage du jour, fenêtre de 7 jours, fréquence.

Documents liés: docs/jeux/jeu-1/tour-06-conception.md (section 1.3 et annexe A),
docs/jeux/jeu-1/tour-07-conception.md (section 3 et annexe A: réserve de 12 moments).

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
4. Tour 7 (parties 6 à 9): la réserve de 12 moments avec leurs vraies conditions (saisons,
   météo de la veille, jours du train, fenêtre propre au train), sur la démo, sur les
   23 jours du jalon J1 et sur les 372 journées des 100 heures; deux règles de chance
   comparées (0,5 fixe, ou 0,5 réduite quand la réserve de la saison est petite).

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


# --- Tour 7: réserve de 12 moments, calendrier réel ----------------------------------

SEASONS = ("printemps", "été", "automne", "hiver")
SEASON_DAYS = 21
YEAR_DAYS = 4 * SEASON_DAYS
DAYS_100H = 372  # plan des 100 heures, section 2.2
FE09 = {  # cahier, FE-09: soleil, nuages, pluie, orage, neige
    "printemps": (45, 25, 30, 0, 0),
    "été": (60, 20, 10, 10, 0),
    "automne": (35, 30, 30, 5, 0),
    "hiver": (30, 30, 10, 0, 30),
}
WEATHERS = ("sunny", "cloudy", "rain", "storm", "snow")
WET = frozenset({"rain", "storm"})
FIXED_SUN = {16, 23}  # fête des semailles, inauguration (plan, J1)
FESTIVAL_DAYS = {16, 23}  # jours de fête connus du plan (les fêtes des saisons suivantes s'y ajouteront)


def season_of(day: int) -> str:
    return SEASONS[((day - 1) // SEASON_DAYS) % 4]


def is_train_day(day: int) -> bool:
    return day % 7 == 1  # le jour 1 est un samedi; un train chaque samedi


def weather_of(seed: int) -> list[str]:
    """Météo des jours 1 à DAYS_100H: démo écrite, jours de fête au soleil, sinon FE-09 tirée par
    empreinte (comme les moments), au plus 3 jours mouillés d'affilée (priorité 1 du tour 7)."""
    out: list[str] = []
    for day in range(1, DAYS_100H + 1):
        if day <= LAST_DAY:
            w = WEATHER[day - 1]
        elif day in FIXED_SUN:
            w = "sunny"
        else:
            u = unit(seed, "weather", day) * 100
            acc = 0.0
            w = "sunny"
            for name, share in zip(WEATHERS, FE09[season_of(day)]):
                acc += share
                if u < acc:
                    w = name
                    break
            if w in WET and len(out) >= 3 and all(x in WET for x in out[-3:]):
                w = "cloudy"
        out.append(w)
    return out


@dataclass(frozen=True)
class Moment7:
    id: str
    weight: int
    min_day: int
    weathers: frozenset[str]
    seasons: frozenset[str] = frozenset(SEASONS)
    needs_flag: str | None = None
    quest_group: str | None = None
    quest_day: int | None = None
    max_per_season: int | None = None
    rain_yesterday: bool = False  # la brume: pluie (ou orage) la veille
    train_days: str = "never"  # "never" ou "only" (le salut du mécanicien)
    cooldown: int | None = None  # fenêtre propre (sinon `cooldownDays`)
    spring_from_day: int = 1  # dans la saison de printemps, pas avant ce jour de la saison (chevrette, vers luisants)


DRY7 = frozenset({"sunny", "cloudy"})
ANY7 = frozenset({"sunny", "cloudy", "rain", "storm", "snow"})
SPRING, SUMMER, AUTUMN, WINTER = SEASONS

RESERVE_12 = [
    Moment7("heron", 3, 4, DRY7, quest_group="afternoon_d6", quest_day=6),
    Moment7("geese", 2, 5, DRY7, frozenset({SPRING}), quest_group="afternoon_d11", quest_day=11, max_per_season=1),
    Moment7("ladder", 0, 10, ANY7, quest_group="afternoon_d10", quest_day=10),
    Moment7("tits", 3, 4, DRY7, frozenset({SPRING}), needs_flag="nest_box_straight"),
    Moment7("fox", 3, 3, DRY7),
    Moment7("glowworms", 2, 9, SUN, frozenset({SPRING, SUMMER}), spring_from_day=9),
    Moment7("roe_deer", 2, 9, DRY7, frozenset({SPRING, SUMMER}), spring_from_day=9),
    Moment7("kingfisher", 2, 4, SUN, frozenset({SPRING, SUMMER, AUTUMN})),
    Moment7("mist", 3, 2, DRY7, frozenset({SPRING, SUMMER, AUTUMN}), rain_yesterday=True),
    Moment7("falling_stars", 2, 22, SUN, frozenset({SUMMER}), max_per_season=2),
    Moment7("odette_waltz", 2, 17, DRY7, frozenset({SPRING, SUMMER})),
    Moment7("train_salute", 1, 22, ANY7 - {"snow"}, train_days="only", cooldown=14),
]


def pool_size(season: str, reserve: list[Moment7] | None = None, day: int = 1) -> int:
    """Moments d'ambiance possibles dans la saison (hors quête seule et hors train). Un moment ajouté
    plus tard (jour minimal après J1) ne compte qu'à partir de son jour."""
    moments = RESERVE_12 if reserve is None else reserve
    return sum(1 for m in moments
               if m.weight > 0 and m.train_days == "never" and season in m.seasons and m.min_day <= max(day, 24))


LADDER_RETRY_DAY = YEAR_DAYS + 10  # 10e jour du printemps de l'année 2 (règle proposée au tour 7)


def play_12(seed: int, days: int, chance: float, scaled: bool, reserve: list[Moment7] | None = None,
            cooldown: int = 7, cooldown_long: int | None = None, long_from: int = 24,
            ladder_retry: bool = False, unseen_boost: float = 1.0, seen_rate: float = 1.0,
            rng: random.Random | None = None, seen_log: list[tuple[int, str]] | None = None) -> list[tuple[int, str, str]]:
    """Même règle que `play_demo`, étendue: saisons, météo de la veille, jours du train, fenêtre propre.
    `cooldown_long`: fenêtre appliquée à partir du jour `long_from` (J2); `ladder_retry`: l'échelle de
    Basile revient au printemps de l'année 2 si elle n'est pas sortie en année 1 (sinon pas de mésanges).
    `unseen_boost`: poids multiplié pour un moment que le duo n'a jamais vu (dès J2); un moment
    d'ambiance est vu avec la probabilité `seen_rate` (tirée par `rng`), un moment de quête toujours."""
    moments = RESERVE_12 if reserve is None else reserve
    weather = weather_of(seed)
    quest_day: dict[str, int] = {}
    for m in moments:
        if m.quest_group is not None and m.quest_day is not None:
            if variant_of(seed, m.quest_group, 2) == 1:
                quest_day[m.id] = m.quest_day
            elif m.id == "ladder" and ladder_retry:
                quest_day[m.id] = LADDER_RETRY_DAY
    log: list[tuple[int, str, str]] = []
    last_end: dict[str, int] = {}
    per_season: dict[tuple[str, int], int] = {}
    flags: set[str] = set()
    seen: set[str] = set()

    def mark(day: int, mid: str, quest: bool) -> None:
        if quest or rng is None or rng.random() < seen_rate:
            seen.add(mid)
            if seen_log is not None:
                seen_log.append((day, mid))

    for day in range(1, days + 1):
        season = season_of(day)
        season_index = (day - 1) // SEASON_DAYS
        w = weather[day - 1]
        todays_quest = [mid for mid, d in quest_day.items() if d == day]
        if todays_quest:
            mid = todays_quest[0]
            log.append((day, mid, "quête"))
            mark(day, mid, True)
            last_end[mid] = day
            per_season[(mid, season_index)] = per_season.get((mid, season_index), 0) + 1
            if mid == "ladder":
                flags.add("nest_box_straight")
            continue
        train = is_train_day(day)
        if day < 2 or day in FESTIVAL_DAYS:  # pas de moment d'ambiance un jour de fête (bal, scène à deux)
            continue
        p = chance
        if scaled and not train:
            p = chance * min(1.0, pool_size(season, moments, day) / 9)
        if unit(seed, "moment", day) >= p:
            continue
        eligible = []
        for m in moments:
            if m.weight == 0 or day < m.min_day or w not in m.weathers or season not in m.seasons:
                continue
            if (m.train_days == "only") != train:
                continue
            if season == SPRING and (day - 1) % SEASON_DAYS + 1 < m.spring_from_day:
                continue
            if m.rain_yesterday and (day < 2 or weather[day - 2] not in WET):
                continue
            if m.needs_flag is not None and m.needs_flag not in flags:
                continue
            base = cooldown_long if (cooldown_long is not None and day >= long_from) else cooldown
            gap = m.cooldown if m.cooldown is not None else base
            if m.id in last_end and day - last_end[m.id] < gap:
                continue
            if m.max_per_season is not None and per_season.get((m.id, season_index), 0) >= m.max_per_season:
                continue
            q = quest_day.get(m.id)
            if q is not None and m.quest_day is not None:
                if m.quest_day <= day <= q or 0 < q - day < cooldown:
                    continue
                if m.max_per_season is not None and q > day:
                    continue
            eligible.append(m)
        if not eligible:
            continue
        def weight(m: Moment7) -> float:
            return m.weight * (unseen_boost if day >= long_from and m.id not in seen else 1.0)

        total = sum(weight(m) for m in eligible)
        pick = unit(seed, "moment_pick", day) * total
        for m in eligible:
            pick -= weight(m)
            if pick < 0:
                log.append((day, m.id, "ambiance"))
                mark(day, m.id, False)
                last_end[m.id] = day
                per_season[(m.id, season_index)] = per_season.get((m.id, season_index), 0) + 1
                break
    return log


def demo_report_12() -> None:
    print("== 6. Démo (15 jours) et J1 (23 jours), réserve de 12, chance 0,5, 20 000 graines ==")
    print("période | moments (moy., p10, p90, min, max) | sortes vues (moy.) | reprises < 7 j | moments du tour 7 vus (moy.)")
    new = {"roe_deer", "kingfisher", "mist", "falling_stars", "odette_waltz", "train_salute"}
    for label, days in (("démo, jours 1 à 15", 15), ("J1, jours 1 à 23", 23)):
        counts, kinds, news, bad = [], [], [], 0
        tally: dict[str, int] = {}
        for seed in range(1, 20_001):
            log = play_12(seed, days, 0.5, scaled=False)
            counts.append(len(log))
            kinds.append(len({m for _, m, _ in log}))
            news.append(sum(1 for _, m, _ in log if m in new))
            bad += check_window(Result(log))
            for _, m, _ in log:
                tally[m] = tally.get(m, 0) + 1
        print(f"{label} | {statistics.mean(counts):.2f}, {pct(counts, .1)}, {pct(counts, .9)}, {min(counts)}, {max(counts)} | "
              f"{statistics.mean(kinds):.2f} | {bad} | {statistics.mean(news):.2f}")
        print("   par moment: " + ", ".join(f"{m} {n / 20_000:.2f}" for m, n in sorted(tally.items(), key=lambda kv: -kv[1])))
    print()
    print("8 graines du robot, démo (réserve de 12):")
    for seed in range(1, 9):
        log = play_12(seed, 15, 0.5, scaled=False)
        print(f"graine {seed}: {len(log)} moments | " + ", ".join(f"j{d} {m}{'*' if o == 'quête' else ''}" for d, m, o in log))
    print()


def long_report_12() -> None:
    print("== 7. 100 heures (372 journées, 4,4 années), réserve de 12, 2 000 graines ==")
    print("règle | saison | moments par saison | sortes par saison | écart médian (j) | écart p10 (j) | part des reprises dans la même saison")
    rules = (("0,5 fixe, 7 j", False, None), ("0,5 réduite, 7 j", True, None), ("0,5 réduite, 10 j dès J2", True, 10))
    for label, scaled, long_cd in rules:
        by_season: dict[str, list[int]] = {s: [] for s in SEASONS}
        kinds_season: dict[str, list[int]] = {s: [] for s in SEASONS}
        gaps: dict[str, list[int]] = {s: [] for s in SEASONS}
        same_season: dict[str, list[int]] = {s: [] for s in SEASONS}
        for seed in range(1, 2_001):
            log = play_12(seed, DAYS_100H, 0.5, scaled, cooldown_long=long_cd, ladder_retry=True)
            last: dict[str, int] = {}
            counter: dict[int, list[str]] = {}
            for day, mid, _ in log:
                idx = (day - 1) // SEASON_DAYS
                counter.setdefault(idx, []).append(mid)
                if mid in last:
                    gaps[season_of(day)].append(day - last[mid])
                    same_season[season_of(day)].append(1 if (last[mid] - 1) // SEASON_DAYS == idx else 0)
                last[mid] = day
            for idx in range(DAYS_100H // SEASON_DAYS):
                s = SEASONS[idx % 4]
                ms = counter.get(idx, [])
                by_season[s].append(len(ms))
                kinds_season[s].append(len(set(ms)))
        for s in SEASONS:
            g = gaps[s]
            print(f"{label} | {s} | {statistics.mean(by_season[s]):.1f} | {statistics.mean(kinds_season[s]):.1f} | "
                  f"{statistics.median(g):.0f} | {pct([float(x) for x in g], 0.1):.0f} | {statistics.mean(same_season[s]):.0%}")
    print()


def memories_report() -> None:
    print("== 8. Souvenirs: premières fois (2 000 graines, 0,5 réduite, 10 j dès J2, échelle rejouée au printemps 2;")
    print("   le duo assiste à 70 % des moments d'ambiance et à tous les moments de quête) ==")
    print("coup de pouce aux moments jamais vus | jour où les 12 sont vus (médiane, p90) | duos qui les voient tous en 100 h | "
          "premières fois par année (1 à 5) | jamais vus à la fin")
    for boost in (1.0, 3.0):
        rng = random.Random(20261101)
        first_all: list[int] = []
        firsts_by_year: list[list[int]] = [[] for _ in range(5)]
        never_by_end: list[int] = []
        for seed in range(1, 2_001):
            seen_log: list[tuple[int, str]] = []
            play_12(seed, DAYS_100H, 0.5, scaled=True, cooldown_long=10, ladder_retry=True,
                    unseen_boost=boost, seen_rate=0.7, rng=rng, seen_log=seen_log)
            first: dict[str, int] = {}
            for day, mid in seen_log:
                first.setdefault(mid, day)
            done = len(first) == len(RESERVE_12)
            first_all.append(max(first.values()) if done else DAYS_100H + 1)
            never_by_end.append(len(RESERVE_12) - len(first))
            for y in range(5):
                firsts_by_year[y].append(sum(1 for d in first.values() if y * YEAR_DAYS < d <= (y + 1) * YEAR_DAYS))
        reached = sum(1 for d in first_all if d <= DAYS_100H) / len(first_all)
        years = ", ".join(f"{statistics.mean(v):.1f}" for v in firsts_by_year)
        print(f"x {boost:.0f} | {statistics.median(first_all):.0f}, {pct([float(d) for d in first_all], 0.9):.0f} | {reached:.0%} | "
              f"{years} | {statistics.mean(never_by_end):.2f}")
    print("(jour 373 = pas encore tous vus à la fin des 100 heures)")
    print()


def renewal_report() -> None:
    """Combien de moments nouveaux par saison faut-il, à partir de l'année 2, pour garder des premières fois ?"""
    print("== 10. Apport nécessaire après l'année 1: k moments neufs par saison et par année (poids 2, temps sec),")
    print("   règle recommandée (0,5 réduite, 10 j dès J2, coup de pouce x 3), 70 % vus; premières fois par saison")
    print("   à partir de l'année 2 (moy., part des saisons sans aucune), moments par saison ==")
    for k in (0, 1, 2, 3):
        extra = []
        for year in range(1, 5):
            for season in SEASONS:
                for i in range(k):
                    extra.append(Moment7(f"neuf_a{year + 1}_{season}_{i}", 2, year * YEAR_DAYS + 1, DRY7, frozenset({season})))
        reserve = RESERVE_12 + extra
        rng = random.Random(7 + k)
        firsts: list[int] = []
        counts: list[int] = []
        for seed in range(1, 501):
            seen_log: list[tuple[int, str]] = []
            log = play_12(seed, DAYS_100H, 0.5, scaled=True, reserve=reserve, cooldown_long=10, ladder_retry=True,
                          unseen_boost=3.0, seen_rate=0.7, rng=rng, seen_log=seen_log)
            got: set[str] = set()
            per: dict[int, int] = {}
            for day, mid in seen_log:
                if mid not in got:
                    got.add(mid)
                    per[(day - 1) // SEASON_DAYS] = per.get((day - 1) // SEASON_DAYS, 0) + 1
            n_by: dict[int, int] = {}
            for day, _, _ in log:
                n_by[(day - 1) // SEASON_DAYS] = n_by.get((day - 1) // SEASON_DAYS, 0) + 1
            for idx in range(4, DAYS_100H // SEASON_DAYS):
                firsts.append(per.get(idx, 0))
                counts.append(n_by.get(idx, 0))
        none = sum(1 for f in firsts if f == 0) / len(firsts)
        print(f"k = {k}: {statistics.mean(firsts):.2f} premières fois par saison, {none:.0%} des saisons sans aucune, "
              f"{statistics.mean(counts):.1f} moments par saison")
    print()


def pool_report() -> None:
    print("== 9. Taille de la réserve d'ambiance par saison (hors quête et hors train) ==")
    for s in SEASONS:
        names = [m.id for m in RESERVE_12 if m.weight > 0 and m.train_days == "never" and s in m.seasons]
        print(f"{s}: {len(names)} ({', '.join(names)}); chance réduite: {0.5 * min(1.0, len(names) / 9):.2f}")
    print()


if __name__ == "__main__":
    demo_report()
    long_report()
    print()
    pool_report()
    demo_report_12()
    long_report_12()
    memories_report()
    renewal_report()
