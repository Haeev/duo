"""Simulations du plan des 100 heures de La Petite Ligne (docs/jeux/jeu-1/plan-100-heures.md).

1. Calendrier: journées et heures de chaque arc, total contrôlé (100 h).
2. Répliques: part des conversations où un joueur entend une réplique déjà entendue,
   selon la taille des réserves de répliques et la règle de tirage.
3. Envies: part des envies déjà vécues par un joueur, année après année,
   selon la réserve par saison et ce que chaque arc y ajoute.

Usage: python3 plan_100_heures.py
Bibliothèque standard uniquement, graine fixe: résultats reproductibles.
"""

from __future__ import annotations

import random
import statistics
from dataclasses import dataclass

SEED = 20261031
RUNS = 300

# Durée réelle d'une journée selon la vitesse de l'horloge (secondes par minute de jeu).
# Modèle du cahier (section 4.17): 900 minutes de jeu dehors en moyenne,
# plus 4,6 minutes réelles fixes (petit-déjeuner, arrêts, veillée, coucher).
OUTDOOR_GAME_MINUTES = 900
FIXED_REAL_MINUTES = 4.6
DAYS_PER_SEASON = 21
SEASONS = ("printemps", "été", "automne", "hiver")


def day_minutes(seconds_per_game_minute: float) -> float:
    return OUTDOOR_GAME_MINUTES * seconds_per_game_minute / 60 + FIXED_REAL_MINUTES


@dataclass(frozen=True)
class Arc:
    key: str
    name: str
    days: int
    seconds_per_minute: float


# La démo (jours 1 à 15) est mesurée: environ 2 h, soit 8 min par journée.
DEMO_MINUTES_PER_DAY = 8.0

ARCS: tuple[Arc, ...] = (
    Arc("A1", "Le printemps de la Halte (démo + semaine 3)", 23, 0.35),
    Arc("A2", "L'été du bourg (la Halte entière, métiers, voie)", 19, 0.8),
    Arc("A3", "Les Vergers (chapitre 2, fin de l'année 1)", 42, 0.8),
    Arc("A4", "Lac-Clair (épisode 2)", 53, 0.8),
    Arc("A5", "La Tourbière (épisode 3)", 53, 0.8),
    Arc("A6", "Les Hauts (épisode 4)", 53, 0.8),
    Arc("A7", "Le Terminus oublié (épisode 5)", 53, 0.8),
    Arc("A8", "La vallée entière (fin de l'année 4 et année 5)", 76, 0.8),
)


def arc_hours(arc: Arc) -> float:
    if arc.key == "A1":
        demo_days = 15
        rest = arc.days - demo_days
        return (demo_days * DEMO_MINUTES_PER_DAY + rest * day_minutes(arc.seconds_per_minute)) / 60
    return arc.days * day_minutes(arc.seconds_per_minute) / 60


def season_label(day: int) -> str:
    index = (day - 1) // DAYS_PER_SEASON
    year = index // 4 + 1
    return f"{SEASONS[index % 4]} {year}"


def part_calendar() -> None:
    print("1. Calendrier des arcs")
    print(f"   journée: {day_minutes(0.35):.1f} min à 0,35 s, {day_minutes(0.6):.1f} min à 0,6 s, "
          f"{day_minutes(0.8):.1f} min à 0,8 s (démo mesurée: {DEMO_MINUTES_PER_DAY:.0f} min)")
    first = 1
    total_h = 0.0
    for arc in ARCS:
        last = first + arc.days - 1
        hours = arc_hours(arc)
        total_h += hours
        print(f"   {arc.key} {arc.name}: jours {first} à {last} ({season_label(first)} à {season_label(last)}), "
              f"{arc.days} journées, {hours:.1f} h, cumul {total_h:.1f} h")
        first = last + 1
    days = first - 1
    print(f"   total: {days} journées, {days / (4 * DAYS_PER_SEASON):.2f} années, {total_h:.1f} h, "
          f"{total_h * 60 / 40:.0f} séances de 40 min")
    assert 99.0 <= total_h <= 101.5, total_h
    print()


# Répliques -----------------------------------------------------------------

TALK_PROBABILITY = 0.55  # chance qu'un joueur parle à un habitant donné dans une journée
REACTIVE_SHARE = 0.4  # part des conversations où un fait récent appelle une réplique de souvenir
REACTIVE_VARIANTS = 300  # 15 gabarits de souvenir x 20 objets ou faits possibles, par habitant
RECENT_DAYS = 28  # une redite à moins de quatre semaines se remarque


@dataclass(frozen=True)
class Pools:
    name: str
    generic: int  # répliques du quotidien valables toute l'année, par niveau de lien
    seasonal: int  # répliques propres à une saison
    weather: int  # répliques par type de temps (soleil, pluie, neige ou orage)
    yearly_new: int  # répliques nouvelles par saison et par année suivante (le monde change)
    lru: bool  # True: la moins récemment dite; False: tirage au hasard


def simulate_lines(pools: Pools, active_days: int, rng: random.Random) -> tuple[float, float]:
    heard: dict[str, int] = {}
    recent_repeats = 0
    last_said: dict[str, int] = {}
    repeats = 0
    total = 0
    for day in range(active_days):
        season = (day // DAYS_PER_SEASON) % 4
        year = day // (4 * DAYS_PER_SEASON)
        tier = min(4, day // 30)  # le lien monte d'un niveau par mois environ
        weather = rng.choice(("soleil", "soleil", "nuages", "pluie"))
        for _player in range(2):
            if rng.random() >= TALK_PROBABILITY:
                continue
            total += 1
            if rng.random() < REACTIVE_SHARE:
                line = f"souvenir-{rng.randrange(REACTIVE_VARIANTS)}"
            else:
                eligible = [f"g{tier}-{i}" for i in range(pools.generic)]
                eligible += [f"s{season}-{i}" for i in range(pools.seasonal)]
                eligible += [f"s{season}-y{y}-{i}" for y in range(1, year + 1) for i in range(pools.yearly_new)]
                eligible += [f"w{weather}-{i}" for i in range(pools.weather)]
                if pools.lru:
                    line = min(eligible, key=lambda x: (last_said.get(x, -1), rng.random()))
                else:
                    line = rng.choice(eligible)
            key = f"{_player}:{line}"
            if key in heard:
                repeats += 1
                if day - heard[key] < RECENT_DAYS:
                    recent_repeats += 1
            heard[key] = day
            last_said[line] = day
    return repeats / max(1, total), recent_repeats / max(1, total)


def part_lines() -> None:
    print("2. Répliques: part des conversations où le joueur entend une réplique déjà entendue (sur toute la présence)")
    configs = (
        Pools("démo actuelle (environ 6 répliques par habitant, tirage au hasard)", 6, 0, 0, 0, False),
        Pools("réserve fixe 8 + 6 par saison, au hasard", 8, 6, 0, 0, False),
        Pools("réserve fixe 8 + 6 par saison, la moins récente", 8, 6, 0, 0, True),
        Pools("8 par niveau + 10 par saison + 3 par temps, la moins récente", 8, 10, 3, 0, True),
        Pools("cible: 8 par niveau + 10 par saison + 3 par temps + 5 neuves par saison et par an", 8, 10, 3, 5, True),
    )
    rng = random.Random(SEED)
    for active_days, who in ((371, "habitant de la Halte, présent 371 journées"),
                             (120, "habitant d'un épisode, présent 120 journées")):
        print(f"   {who}:")
        for pools in configs:
            values = [simulate_lines(pools, active_days, rng) for _ in range(RUNS // 3)]
            overall = statistics.mean(v[0] for v in values)
            recent = statistics.mean(v[1] for v in values)
            print(f"     {pools.name}: {100 * overall:.0f} % de redites, dont {100 * recent:.1f} % à moins de "
                  f"{RECENT_DAYS} jours")
    print(f"   hypothèses: {TALK_PROBABILITY:.0%} de chances de parler à un habitant donné par joueur et par jour, "
          f"{REACTIVE_SHARE:.0%} de conversations sur un souvenir ({REACTIVE_VARIANTS} variantes)")
    print()


# Envies --------------------------------------------------------------------


def simulate_envies(base_per_season: int, added_per_arc_per_season: int, years: int,
                    unseen_weight: float, rng: random.Random) -> list[float]:
    """Part des envies déjà vécues par le joueur, par année. Une envie nouvelle par an et par saison
    s'ajoute avec chaque arc (environ 1,2 arc par an)."""
    seen: set[str] = set()
    shares: list[float] = []
    recent: list[str] = []
    for year in range(years):
        already = 0
        draws = 0
        pool_size = base_per_season + int(added_per_arc_per_season * 1.2 * year)
        for season in range(4):
            pool = [f"{season}-{i}" for i in range(pool_size)]
            for _day in range(DAYS_PER_SEASON):
                candidates = [e for e in pool if e not in recent[-7:]]
                weights = [unseen_weight if e not in seen else 1.0 for e in candidates]
                envie = rng.choices(candidates, weights=weights)[0]
                draws += 1
                if envie in seen:
                    already += 1
                seen.add(envie)
                recent.append(envie)
        shares.append(already / draws)
    return shares


def part_envies() -> None:
    print("3. Envies d'un joueur: part des envies déjà vécues, année par année (années 1 à 5)")
    rng = random.Random(SEED + 1)
    for base, added, weight in ((12, 0, 1.0), (24, 0, 1.0), (24, 0, 4.0), (24, 6, 4.0)):
        runs = [simulate_envies(base, added, 5, weight, rng) for _ in range(RUNS // 3)]
        by_year = [statistics.mean(run[y] for run in runs) for y in range(5)]
        text = ", ".join(f"{100 * v:.0f} %" for v in by_year)
        print(f"   {base} par saison, +{added} par arc et par saison, nouveauté x{weight:g}: {text}")
    print()


if __name__ == "__main__":
    part_calendar()
    part_lines()
    part_envies()
