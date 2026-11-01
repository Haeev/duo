"""La Petite Ligne, tour 8: la suite après le jour 15.

Document lié: docs/jeux/jeu-1/tour-08-conception.md (les tables de ce document et les
constantes de ce script sont tenues identiques; la partie 0 le vérifie en lisant le document).

Parties:
  0. contrôle croisé des tables du document et des constantes du script
  1. calendrier (saisons de 21 jours, samedis, trains)
  2. météo tirée (chaîne à mémoire, garde-fous, brume du matin)
  3. commande du samedi générée (composition, faisabilité, progression, duos médian et tranquille)
  4. repousse des arbres (souche, rejet, arbre adulte)
  5. cueillette (cinq coins de lisière, saisons, pluie, coup de pouce)
  6. répliques du quotidien (règle R2, redites à moins de 28 jours)
  7. envies (règle R6)
  8. premières fois par journée (règle R1), jours 16 à 43
  9. budget de temps du robot longue vie (mesure du 2026-11-01)

Usage: python3 tour8_suite.py [--rapide]
Bibliothèque standard uniquement; graines fixes, résultats reproductibles.
"""

from __future__ import annotations

import json
import math
import random
import re
import statistics
import sys
from collections import Counter, defaultdict
from dataclasses import dataclass, field
from pathlib import Path

ICI = Path(__file__).resolve().parent
DOC = ICI.parent / "tour-08-conception.md"
DONNEES = ICI.parents[3] / "games" / "la-petite-ligne" / "donnees"
RAPIDE = "--rapide" in sys.argv

# ---------------------------------------------------------------------------
# Calendrier
# ---------------------------------------------------------------------------
SEASON_DAYS = 21
SEASONS = ["spring", "summer", "autumn", "winter"]
LAST_WRITTEN_DAY = 15          # météo et commandes écrites de la démo
FIRST_DRAWN_DAY = 16           # premier jour tiré
STAGE_LAST_DAY = 43            # limite provisoire de la livraison (samedi, 16 h)
LONG_LIFE_DAYS = 84            # robot longue vie


def season_of(day: int) -> str:
    return SEASONS[((day - 1) // SEASON_DAYS) % 4]


def season_day(day: int) -> int:
    return (day - 1) % SEASON_DAYS + 1


def weekday(day: int) -> int:
    """0 = samedi (le jour 1 est un samedi, TE-02)."""
    return (day - 1) % 7


def is_train_day(day: int) -> bool:
    return weekday(day) == 0


# ---------------------------------------------------------------------------
# Météo (section 3 du document, table 3.1)
# ---------------------------------------------------------------------------
WEATHERS = ["sunny", "cloudy", "rain"]
WEATHER_TABLE = {  # fréquences visées, en %
    "spring": (45, 25, 30),
    "summer": (60, 22, 18),
    "autumn": (35, 30, 35),
    "winter": (30, 45, 25),
}
# Table de tirage: les garde-fous retirent de la pluie et ajoutent du soleil; ces valeurs, calées
# par la partie 2 (12 itérations sur 3 000 graines), redonnent les fréquences visées à 1 point près.
WEATHER_DRAW = {
    "spring": (41, 23, 36),
    "summer": (59, 21, 20),
    "autumn": (27, 28, 45),
    "winter": (19, 49, 32),
}
PERSISTENCE = 0.35            # part de « même temps que la veille »
MAX_RAIN_STREAK = 3           # au-delà: nuages imposés
MAX_DAYS_WITHOUT_SUN = 6      # le septième jour sans soleil: soleil imposé
FORCED_WEATHER = {16: "sunny"}  # lendemain de la démo (et jours de fête quand il y en aura)
MIST_AFTER_RAIN = 1.0          # brume le matin d'après la pluie, si le jour n'est pas pluvieux
MIST_BASE = {"spring": 0.08, "summer": 0.04, "autumn": 0.25, "winter": 0.15}
DEMO_WEATHER = ["sunny", "sunny", "sunny", "rain", "sunny", "cloudy", "sunny", "sunny", "sunny",
                "cloudy", "sunny", "rain", "sunny", "sunny", "sunny"]


def fnv1a(text: str) -> int:
    h = 0x811C9DC5
    for ch in text:
        h ^= ord(ch)
        h = (h * 0x01000193) & 0xFFFFFFFF
    return h


def fmix32(v: int) -> int:
    h = v & 0xFFFFFFFF
    h ^= h >> 16
    h = (h * 0x85EBCA6B) & 0xFFFFFFFF
    h ^= h >> 13
    h = (h * 0xC2B2AE35) & 0xFFFFFFFF
    h ^= h >> 16
    return h


def unit_draw(seed: int, key: str, day: int) -> float:
    """Même formule que `unitDraw` de `src/etat/tirage.ts` (« graine:clé:jour »): le générateur
    de la partie n'est jamais touché, les jours 1 à 15 restent identiques."""
    return fmix32(fnv1a(f"{seed}:{key}:{day}")) / 2**32


def pick_weighted(u: float, items: list[str], weights: list[float]) -> str:
    total = sum(weights)
    acc = 0.0
    for it, w in zip(items, weights):
        acc += w / total
        if u < acc:
            return it
    return items[-1]


@dataclass
class WeatherDay:
    weather: str
    mist: bool
    forced: str | None  # raison si imposé


def draw_weather(seed: int, days: int) -> list[WeatherDay]:
    out: list[WeatherDay] = []
    for d in range(1, days + 1):
        if d <= LAST_WRITTEN_DAY:
            out.append(WeatherDay(DEMO_WEATHER[d - 1], False, "écrit"))
            continue
        prev = out[-1].weather
        forced = None
        if d in FORCED_WEATHER:
            w, forced = FORCED_WEATHER[d], "imposé"
        else:
            pi = [p / 100 for p in WEATHER_DRAW[season_of(d)]]
            probs = [(1 - PERSISTENCE) * pi[i] + (PERSISTENCE if WEATHERS[i] == prev else 0) for i in range(3)]
            u = unit_draw(seed, "weather", d)
            acc, w = 0.0, WEATHERS[-1]
            for i, p in enumerate(probs):
                acc += p
                if u < acc:
                    w = WEATHERS[i]
                    break
            rain_streak = 0
            for x in reversed(out):
                if x.weather != "rain":
                    break
                rain_streak += 1
            no_sun = 0
            for x in reversed(out):
                if x.weather == "sunny":
                    break
                no_sun += 1
            if w == "rain" and rain_streak >= MAX_RAIN_STREAK:
                w, forced = "cloudy", "pluie trop longue"
            if w != "sunny" and no_sun >= MAX_DAYS_WITHOUT_SUN:
                w, forced = "sunny", "soleil attendu"
        mist = False
        if w != "rain":
            if prev == "rain":
                mist = unit_draw(seed, "mist", d) < MIST_AFTER_RAIN
            else:
                mist = unit_draw(seed, "mist", d) < MIST_BASE[season_of(d)]
        out.append(WeatherDay(w, mist, forced))
    return out


# ---------------------------------------------------------------------------
# Commande générée (section 4 du document, table 4.2)
# ---------------------------------------------------------------------------
@dataclass(frozen=True)
class Product:
    id: str
    family: str
    resource: str
    cost: float          # part de la ressource consommée par unité (voir RESOURCES)
    price: int
    seasons: tuple[str, ...]
    unlock_day_p: float  # probabilité d'être déjà obtenu au jour 15 (modèle de duo)
    first_day: int       # premier jour où il peut être obtenu après la démo (0: dès la démo)
    tier: str
    min_count: int       # une ligne ne demande jamais moins


ALL = ("spring", "summer", "autumn", "winter")
PSA = ("spring", "summer", "autumn")
PRODUCTS = [
    Product("radish", "potager", "garden", 1.0, 7, PSA, 1.0, 0, "P0", 6),
    Product("lettuce", "potager", "garden", 4.0, 32, PSA, 1.0, 0, "P0", 2),
    Product("carrot", "potager", "garden", 5 / 3, 16, PSA, 1.0, 0, "P0", 6),
    Product("egg", "basse-cour", "eggs", 1.0, 8, ALL, 1.0, 0, "P0", 4),
    Product("omelette", "cuisine", "eggs", 1.5, 20, ALL, 1.0, 0, "P0", 2),
    Product("crunchy_radishes", "cuisine", "garden", 1.5, 16, PSA, 0.7, 0, "P0", 4),
    Product("vegetable_soup", "cuisine", "garden", 14 / 3, 60, PSA, 0.6, 0, "P0", 2),
    Product("gudgeon", "rivière", "river", 1 / 12, 2, ALL, 1.0, 0, "P0", 4),
    Product("chub", "rivière", "river", 1 / 6, 4, ALL, 0.8, 0, "P0", 2),
    Product("trout", "rivière", "river", 1 / 3, 8, PSA, 1.0, 0, "P0", 2),
    Product("plank", "bois", "wood", 1 / 32, 6, ALL, 1.0, 0, "P0", 6),
    Product("dandelion", "lisière", "forage", 1.0, 4, ("spring",), 0.5, 16, "P0", 6),
    Product("wild_garlic", "lisière", "forage", 1.0, 8, ("spring",), 0.0, 16, "P0", 3),
    Product("chanterelle", "lisière", "forage", 1.0, 12, ("summer", "autumn"), 0.0, 22, "P0", 3),
    Product("blackberry", "lisière", "forage", 1.0, 3, ("summer",), 0.0, 22, "P0", 8),
    Product("hazelnut", "lisière", "forage", 1.0, 3, ("autumn",), 0.0, 43, "P0", 8),
]
BY_ID = {p.id: p for p in PRODUCTS}

# Capacité d'une semaine de production (6 jours), pour un duo qui ne ferait que ça.
GARDEN_CELL_DAYS = 12 * 6 * 0.75    # 12 cases, 6 jours, 75 % d'occupation réaliste
EGGS_PER_WEEK = 3 * 6 * 0.9         # 3 poules nourries
RESOURCES = {"garden": GARDEN_CELL_DAYS, "eggs": EGGS_PER_WEEK, "river": 1.0, "wood": 1.0}
RESOURCE_CAP = 0.85                 # part d'une ressource qu'une commande peut demander

ORDER = {
    "budgetStart": 1.9,       # « semaines de travail » demandées par la commande 3
    "budgetStep": 0.15,       # par commande réussie
    "budgetMax": 3.1,
    "budgetAfterMiss": 0.0,   # pas de hausse après une commande incomplète
    "budgetAfterTwoMisses": -0.25,
    "linesByOrder": [(3, 4), (5, 5), (9, 6)],   # (à partir de la commande n, lignes)
    "maxPerFamily": 2,
    "minFamilies": 3,
    "absentFamilyWeight": 3.0,
    "neverOrderedWeight": 2.0,
    "twoAgoWeight": 0.5,
    "maxRepeatFromPrevious": 1,     # seulement si les candidats manquent
    "minLineShare": 0.6,            # une ligne ne descend jamais sous 60 % de sa part
    "minLines": 3,
    "linePremium": 1.5,
    "fullBonus": 0.25,
    "paymentPerWorkWeek": 380,      # une ligne rapporte au moins sa part x 380 sous (prime à l'effort)
}
SIZE_FACTORS = {"petite": 0.7, "normale": 1.0, "grande": 1.3}
# Un plat et son ingrédient ne vont jamais dans la même commande (la semaine ne tourne pas à un seul légume).
DISH_INGREDIENTS = {
    "omelette": {"egg"},
    "crunchy_radishes": {"radish"},
    "vegetable_soup": {"radish", "carrot", "lettuce"},
}


def clashes(a: str, b: str) -> bool:
    """Deux lignes qui puisent dans le même produit de base (plat et ingrédient, deux plats du même légume)."""
    return bool(DISH_INGREDIENTS.get(a, {a}) & DISH_INGREDIENTS.get(b, {b}))
# Duos: temps disponible par semaine, en « semaines de travail » (même unité que le budget).
# Calage: la commande 2 de la démo demande 2,29; les robots la finissent sur 10 graines sur 10.
DUOS = {"médian": (3.2, 0.4), "tranquille": (2.3, 0.4)}
LEARNING_PER_ORDER = 0.03          # chaque semaine, le duo s'organise un peu mieux (plafond +20 %)


def lines_for(k: int) -> int:
    n = 4
    for start, lines in ORDER["linesByOrder"]:
        if k >= start:
            n = lines
    return n


def in_season(p: Product, deliver_day: int) -> bool:
    days = range(deliver_day - 6, deliver_day)
    return sum(1 for d in days if season_of(d) in p.seasons) >= 4


@dataclass
class OrderLine:
    product: str
    count: int
    share: float


@dataclass
class OrderState:
    budget: float = ORDER["budgetStart"]
    size: float = 1.0
    history: list[list[str]] = field(default_factory=list)
    misses: int = 0
    ordered: set[str] = field(default_factory=set)


def forage_weekly(product: str, deliver_day: int) -> float:
    """Unités attendues d'une cueillette sur les 6 jours de production (partie 5)."""
    total = 0.0
    for d in range(deliver_day - 6, deliver_day):
        for pt in FORAGE_POINTS:
            items = [i for i in pt["items"] if season_of(d) in FORAGE[i]["seasons"]]
            if product not in items:
                continue
            w = {i: FORAGE[i]["weight"] for i in items}
            total += FORAGE_SPAWN * w[product] / sum(w.values()) * FORAGE[product]["mean"]
    return total


def generate_order(seed: int, k: int, deliver_day: int, unlocked: set[str], state: OrderState,
                   mature_trees: int) -> list[OrderLine]:
    rng = random.Random(f"{seed}-order-{k}")
    previous = state.history[-1] if state.history else []
    two_ago = state.history[-2] if len(state.history) >= 2 else []
    cands = [p for p in PRODUCTS if p.id in unlocked and in_season(p, deliver_day)]
    if mature_trees < 2:
        cands = [p for p in cands if p.id != "plank"]
    n = lines_for(k)
    fresh = [p for p in cands if p.id not in previous]
    repeats_allowed = ORDER["maxRepeatFromPrevious"] if len(fresh) < n else 0
    # jamais moins de trois lignes: au besoin, on reprend davantage de la commande précédente
    if len(fresh) + repeats_allowed < ORDER["minLines"]:
        repeats_allowed = ORDER["minLines"] - len(fresh)
    chosen: list[Product] = []
    fam_count: Counter[str] = Counter()
    prev_fams = {BY_ID[i].family for i in previous}

    def weight(p: Product) -> float:
        w = 1.0
        if p.family not in prev_fams:
            w *= ORDER["absentFamilyWeight"]
        if p.id not in state.ordered:
            w *= ORDER["neverOrderedWeight"]
        if p.id in two_ago:
            w *= ORDER["twoAgoWeight"]
        return w

    def pick(pool: list[Product]) -> Product | None:
        pool = [p for p in pool if p not in chosen and fam_count[p.family] < ORDER["maxPerFamily"]
                and not any(clashes(p.id, c.id) for c in chosen)]
        # au moins trois familles tant que c'est possible
        fams_left = n - len(chosen)
        need_new_family = len(set(fam_count)) + fams_left <= ORDER["minFamilies"]
        if need_new_family:
            newf = [p for p in pool if p.family not in fam_count]
            if newf:
                pool = newf
        if not pool:
            return None
        ws = [weight(p) for p in pool]
        return rng.choices(pool, weights=ws)[0]

    while len(chosen) < n:
        p = pick(fresh)
        if p is None and (repeats_allowed > 0 or len(chosen) < ORDER["minLines"]):
            p = pick([q for q in cands if q.id in previous])
            if p is not None:
                repeats_allowed -= 1
        if p is None:
            break
        chosen.append(p)
        fam_count[p.family] += 1

    # parts: le budget réparti également, puis plafonné par ressource
    share = state.budget * state.size / max(1, len(chosen))
    lines: list[OrderLine] = []
    used: Counter[str] = Counter()
    for p in chosen:
        if p.resource == "forage":
            cap_units = 0.6 * forage_weekly(p.id, deliver_day)
            units = min(cap_units, share * forage_weekly(p.id, deliver_day))
            s = units / max(1e-9, forage_weekly(p.id, deliver_day)) * 0.5
        elif p.resource == "wood":
            cap_units = 0.6 * 8 * mature_trees
            units = min(cap_units, share / p.cost)
            s = units * p.cost
        else:
            room = RESOURCE_CAP - used[p.resource]
            s = min(share, max(room, share * ORDER["minLineShare"]))
            units = s * RESOURCES[p.resource] / p.cost
        count = max(p.min_count, round(units))
        used[p.resource] += s
        lines.append(OrderLine(p.id, count, s))
    return lines


def line_pay(l: OrderLine) -> float:
    market = BY_ID[l.product].price * l.count * ORDER["linePremium"]
    return max(market, l.share * ORDER["paymentPerWorkWeek"])


def order_value(lines: list[OrderLine]) -> int:
    return round(sum(line_pay(l) for l in lines) * (1 + ORDER["fullBonus"]))


def market_value(lines: list[OrderLine]) -> int:
    return round(sum(BY_ID[l.product].price * l.count for l in lines) * ORDER["linePremium"] * (1 + ORDER["fullBonus"]))


def simulate_orders(seeds: int, profile: str, last_day: int = LONG_LIFE_DAYS, size: str = "normale") -> dict[str, object]:
    mu, sd = DUOS[profile]
    complete, lines_done, lines_total = 0, 0, 0
    n_orders = 0
    identical, max_shared = 0, 0
    shared_hist: Counter[int] = Counter()
    values: defaultdict[int, list[int]] = defaultdict(list)
    lines_hist: defaultdict[int, list[int]] = defaultdict(list)
    families_min = 99
    budgets: defaultdict[int, list[float]] = defaultdict(list)
    winter_lines: list[int] = []
    few_families = 0
    non_winter = 0
    winter_shared: list[int] = []
    min_lines = 99
    for seed in range(seeds):
        rng = random.Random(f"duo-{profile}-{seed}")
        talent = rng.gauss(mu, sd)
        unlocked = {p.id for p in PRODUCTS if p.first_day == 0 and rng.random() < p.unlock_day_p}
        state = OrderState()
        state.size = SIZE_FACTORS[size]
        state.ordered |= {"radish", "lettuce", "egg", "plank", "carrot", "omelette", "trout"}
        state.history = [["radish", "lettuce", "egg", "plank"], ["carrot", "lettuce", "egg", "omelette", "trout"]]
        k = 3
        for deliver in range(22, last_day + 1, 7):
            gen_day = deliver - 7
            # obtenus entre-temps: cueillettes cueillies au plus tard 3 jours après leur arrivée
            for p in PRODUCTS:
                if p.first_day and p.first_day + 3 <= gen_day and season_of(gen_day) in p.seasons:
                    unlocked.add(p.id)
            for p in ("crunchy_radishes", "vegetable_soup", "chub", "dandelion"):
                if p not in unlocked and rng.random() < 0.25:
                    unlocked.add(p)
            lines = generate_order(seed, k, deliver, unlocked, state, mature_trees=6)
            ids = [l.product for l in lines]
            prev = state.history[-1]
            shared = len(set(ids) & set(prev))
            shared_hist[shared] += 1
            max_shared = max(max_shared, shared)
            identical += int(sorted(ids) == sorted(prev))
            if season_of(deliver - 1) != "winter":
                nf = len({BY_ID[i].family for i in ids})
                families_min = min(families_min, nf)
                few_families += int(nf < 3)
                non_winter += 1
            else:
                winter_lines.append(len(ids))
                winter_shared.append(shared)
            min_lines = min(min_lines, len(ids))
            values[k].append(order_value(lines))
            lines_hist[k].append(len(lines))
            budgets[k].append(state.budget)
            # le duo joue la semaine
            avail = talent * min(1.2, 1 + LEARNING_PER_ORDER * (k - 3)) * rng.uniform(0.85, 1.1)
            need = sum(l.share for l in lines)
            done = len(lines) if need <= avail else sum(
                1 for c in itertools_accumulate(sorted(l.share for l in lines)) if c <= avail)
            n_orders += 1
            lines_done += done
            lines_total += len(lines)
            if done == len(lines):
                complete += 1
                state.misses = 0
                state.budget = min(ORDER["budgetMax"], state.budget + ORDER["budgetStep"])
            else:
                state.misses += 1
                delta = ORDER["budgetAfterTwoMisses"] if state.misses >= 2 else ORDER["budgetAfterMiss"]
                state.budget = max(ORDER["budgetStart"] * 0.8, state.budget + delta)
            state.history.append(ids)
            state.ordered |= set(ids)
            k += 1
    return {
        "complete": complete / n_orders,
        "lines": lines_done / lines_total,
        "identical": identical,
        "max_shared": max_shared,
        "shared_hist": dict(sorted(shared_hist.items())),
        "families_min": families_min,
        "values": {k: (int(statistics.median(v)), int(min(v)), int(max(v))) for k, v in sorted(values.items())},
        "lines_by_order": {k: round(statistics.mean(v), 2) for k, v in sorted(lines_hist.items())},
        "budget": {k: round(statistics.mean(v), 2) for k, v in sorted(budgets.items())},
        "orders": n_orders,
        "min_lines": min_lines,
        "few_families": round(100 * few_families / max(1, non_winter), 2),
        "winter": (round(statistics.mean(winter_lines), 2) if winter_lines else None,
                   round(statistics.mean(winter_shared), 2) if winter_shared else None),
    }


def itertools_accumulate(xs: list[float]) -> list[float]:
    out, s = [], 0.0
    for x in xs:
        s += x
        out.append(s)
    return out


# ---------------------------------------------------------------------------
# Repousse des arbres (section 5.1 du document)
# ---------------------------------------------------------------------------
TREES = 12
STUMP_DAYS = 4        # souche nue
SAPLING_DAYS = 6      # rejet ou jeune sapin, puis adulte (abattable) au bout de 10 jours
REGROW_FROM_DAY = 16  # rien ne repousse dans la démo
CATCH_UP_DAYS = 6     # au jour 16, une souche de la démo compte au plus 6 jours d'avance


def simulate_trees(seeds: int, policy: str) -> dict[str, object]:
    min_mature_by_day: dict[int, int] = {}
    zero_runs = []
    first_regrown: list[int] = []
    below6 = 0
    days_counted = 0
    for seed in range(seeds):
        rng = random.Random(f"trees-{policy}-{seed}")
        felled_before = rng.choice([6, 7, 8, 8, 8, 9, 10])
        felled_day: list[int | None] = sorted(rng.randint(3, 15) for _ in range(felled_before)) + \
            [None] * (TREES - felled_before)

        def mature(d: int) -> list[int]:
            out = []
            for i, f in enumerate(felled_day):
                if f is None:
                    out.append(i)
                elif d - max(f, REGROW_FROM_DAY - CATCH_UP_DAYS) >= STUMP_DAYS + SAPLING_DAYS:
                    felled_day[i] = None
                    out.append(i)
            return out

        run = 0
        before = {i for i, f in enumerate(felled_day) if f is not None}
        for d in range(16, LONG_LIFE_DAYS + 1):
            m = mature(d)
            if before & set(m):
                first_regrown.append(d)
                before = set()
            min_mature_by_day[d] = min(min_mature_by_day.get(d, 99), len(m))
            days_counted += 1
            below6 += int(len(m) < 6)
            run = run + 1 if not m else 0
            zero_runs.append(run)
            if policy == "médian":
                # une ligne de planches une semaine sur trois (10 à 14 planches), plus un meuble par semaine
                want = 0
                if is_train_day(d + 3) and rng.random() < 0.35:
                    want += 2
                if weekday(d) == 3 and rng.random() < 0.5:
                    want += 1
            elif policy == "glouton":
                want = len(m)  # abat tout ce qui est debout, chaque jour
            else:
                want = 0
            for i in m[:want]:
                felled_day[i] = d
    return {
        "min_mature": min(min_mature_by_day[d] for d in range(16, LONG_LIFE_DAYS + 1)),
        "min_mature_from22": min(min_mature_by_day[d] for d in range(22, LONG_LIFE_DAYS + 1)),
        "first_regrown": first_regrown,
        "min_mature_day42": min_mature_by_day[42],
        "share_below6": below6 / days_counted,
        "longest_zero": max(zero_runs),
    }


# ---------------------------------------------------------------------------
# Cueillette (section 5.2 du document, table 5.2)
# ---------------------------------------------------------------------------
FORAGE = {
    "dandelion": {"seasons": ("spring",), "weight": 6, "mean": 2.5, "count": (2, 3)},
    "wild_garlic": {"seasons": ("spring",), "weight": 3, "mean": 1.5, "count": (1, 2)},
    "blackberry": {"seasons": ("summer",), "weight": 6, "mean": 2.5, "count": (2, 3)},
    "chanterelle": {"seasons": ("summer", "autumn"), "weight": 3, "mean": 1.5, "count": (1, 2)},
    "hazelnut": {"seasons": ("autumn",), "weight": 6, "mean": 2.5, "count": (2, 3)},
}
FORAGE_POINTS = [
    {"id": "forage_edge_01", "kind": "sous-bois", "items": ["wild_garlic", "chanterelle", "hazelnut"]},
    {"id": "forage_edge_02", "kind": "sous-bois", "items": ["wild_garlic", "chanterelle", "hazelnut"]},
    {"id": "forage_edge_03", "kind": "lisière", "items": ["dandelion", "blackberry"]},
    {"id": "forage_edge_04", "kind": "lisière", "items": ["dandelion", "blackberry"]},
    {"id": "forage_edge_05", "kind": "lisière", "items": ["dandelion", "blackberry", "chanterelle"]},
]
FORAGE_SPAWN = 0.6            # chance qu'un coin vide se garnisse au matin
FORAGE_RAIN_FACTOR = 3.0      # girolles: poids x3 le lendemain d'une pluie
FORAGE_UNSEEN = 4.0           # coup de pouce CN-04


def simulate_forage(seeds: int) -> dict[str, object]:
    per_season: defaultdict[str, Counter[str]] = defaultdict(Counter)
    first_day: defaultdict[str, list[int]] = defaultdict(list)
    empty_points_days = Counter()
    days_by_season = Counter()
    for seed in range(seeds):
        weather = draw_weather(seed, LONG_LIFE_DAYS)
        rng = random.Random(f"forage-{seed}")
        stock: dict[str, tuple[str, int] | None] = {p["id"]: None for p in FORAGE_POINTS}
        seen: set[str] = set()
        for d in range(16, LONG_LIFE_DAYS + 1):
            s = season_of(d)
            days_by_season[s] += 1
            rain_yday = weather[d - 2].weather == "rain"
            for pt in FORAGE_POINTS:
                cur = stock[pt["id"]]
                if cur is not None and s not in FORAGE[cur[0]]["seasons"]:
                    stock[pt["id"]] = cur = None  # passé de saison
                items = [i for i in pt["items"] if s in FORAGE[i]["seasons"]]
                if cur is None and items and unit_draw(seed, "forage:" + pt["id"], d) < FORAGE_SPAWN:
                    ws = []
                    for i in items:
                        w = FORAGE[i]["weight"]
                        if i == "chanterelle" and rain_yday:
                            w *= FORAGE_RAIN_FACTOR
                        if i not in seen:
                            w *= FORAGE_UNSEEN
                        ws.append(w)
                    it = pick_weighted(unit_draw(seed, "forage-item:" + pt["id"], d), items, ws)
                    lo, hi = FORAGE[it]["count"]
                    n = lo + int(unit_draw(seed, "forage-count:" + pt["id"], d) * (hi - lo + 1))
                    stock[pt["id"]] = (it, n)
                if stock[pt["id"]] is None:
                    empty_points_days[s] += 1
            # le duo médian passe à la lisière deux jours sur trois et ramasse tout
            if rng.random() < 2 / 3:
                for pid, cur in stock.items():
                    if cur is None:
                        continue
                    it, n = cur
                    per_season[s][it] += n
                    if it not in seen:
                        seen.add(it)
                        first_day[it].append(d)
                    stock[pid] = None
    return {
        "per_week": {s: {i: round(n / days_by_season[s] * 7, 1) for i, n in c.items()} for s, c in per_season.items()},
        "first_day_median": {i: int(statistics.median(v)) for i, v in first_day.items()},
        "first_day_p90": {i: int(sorted(v)[int(0.9 * (len(v) - 1))]) for i, v in first_day.items()},
        "first_seen_share": {i: round(len(v) / seeds, 3) for i, v in first_day.items()},
        "empty_share": {s: round(empty_points_days[s] / (days_by_season[s] * len(FORAGE_POINTS)), 2)
                        for s in days_by_season},
    }


# ---------------------------------------------------------------------------
# Répliques du quotidien (section 5.5 du document)
# ---------------------------------------------------------------------------
# Les répliques de la démo encore vraies après le jour 15 (après les bornes proposées), lues
# dans habitants.json; chaque réplique est classée par sa condition.
STALE_AFTER_15 = {  # bornées au jour 15 par le document (section 5.5): elles mentiraient ensuite
    "firmin_daily_week2", "odette_daily_week2", "basile_daily_week2", "firmin_crate_full",
    "firmin_mid_week2", "odette_mid_week2", "jeanne_mid_week2",  # gardées les mardis à jeudis: comptées absentes
}
# Ajouts écrits dans le document (section 5.5): par habitant, (générales dès le jour 16,
# fin du printemps 16 à 21, été, pluie de plus, souvenirs du lendemain).
NEW_LINES = {"general": 5, "late_spring": 2, "summer": 8, "rain": 1}
VISIBLE = {"firmin": (8, 18), "odette": (7, 20), "basile": (8, 18), "jeanne": (8, 20)}
TALK_PROFILES = {"médian": 0.55, "assidu": 1.0}   # part des journées où ce joueur parle à cet habitant
DATED_REPEAT_DAYS = 28   # une réplique datée (pluie) entendue depuis moins de 28 jours redevient ordinaire


@dataclass
class Line:
    id: str
    kind: str          # always, time, weather, weather_time, dated_weather, season, late_spring
    hours: tuple[int, int] | None = None
    weather: str | None = None
    season: str | None = None


def load_lines() -> dict[str, list[Line]]:
    data = json.loads((DONNEES / "habitants.json").read_text(encoding="utf-8"))
    out: dict[str, list[Line]] = {}
    for v in data["villagers"]:
        lines: list[Line] = []
        for d in v["dialogues"]:
            if d["kind"] != "daily" or d["id"] in STALE_AFTER_15:
                continue
            when = d.get("when") or []
            types = [c["type"] for c in when]
            if "day_is" in types:
                continue  # datées de la démo
            hours = None
            weather = None
            for c in when:
                if c["type"] == "time_is":
                    hours = (int(c["from"][:2]), int(c["to"][:2]))
                if c["type"] == "weather_is":
                    weather = c["weather"]
            prio = d.get("priority", 1)
            if weather and prio >= 5:
                lines.append(Line(d["id"], "dated_weather", weather=weather))
            elif weather and hours:
                lines.append(Line(d["id"], "weather_time", hours=hours, weather=weather))
            elif weather:
                lines.append(Line(d["id"], "weather", weather=weather))
            elif hours:
                lines.append(Line(d["id"], "time", hours=hours))
            else:
                lines.append(Line(d["id"], "always"))  # conditions d'avancement: supposées vraies
        out[v["id"]] = lines
    return out


def with_additions(lines: dict[str, list[Line]], extra: dict[str, int]) -> dict[str, list[Line]]:
    out = {}
    for v, ls in lines.items():
        new = list(ls)
        new += [Line(f"{v}_g{i}", "always") for i in range(extra.get("general", 0))]
        new += [Line(f"{v}_ls{i}", "late_spring") for i in range(extra.get("late_spring", 0))]
        new += [Line(f"{v}_su{i}", "season", season="summer") for i in range(extra.get("summer", 0))]
        new += [Line(f"{v}_au{i}", "season", season="autumn") for i in range(extra.get("autumn", 0))]
        new += [Line(f"{v}_wi{i}", "season", season="winter") for i in range(extra.get("winter", 0))]
        new += [Line(f"{v}_r{i}", "dated_weather", weather="rain") for i in range(extra.get("rain", 0))]
        out[v] = new
    return out


def eligible(line: Line, day: int, hour: float, weather: str) -> bool:
    if line.kind == "always":
        return True
    if line.kind == "time":
        return line.hours is not None and line.hours[0] <= hour < line.hours[1]
    if line.kind in ("weather", "dated_weather"):
        return weather == line.weather
    if line.kind == "weather_time":
        return weather == line.weather and line.hours is not None and line.hours[0] <= hour < line.hours[1]
    if line.kind == "season":
        return season_of(day) == line.season
    if line.kind == "late_spring":
        return 16 <= day <= 21
    return False


def simulate_lines(pools: dict[str, list[Line]], seeds: int, profile: str, last_day: int) -> dict[str, object]:
    p_talk = TALK_PROFILES[profile]
    talks = Counter()
    redites = Counter()
    firsts_by_day: defaultdict[int, int] = defaultdict(int)
    for seed in range(seeds):
        rng = random.Random(f"lines-{profile}-{seed}")
        weather = draw_weather(seed, last_day)
        for player in ("p1", "p2"):
            heard: dict[str, int] = {}
            for v in pools:
                # entendues pendant la démo: chaque réplique toujours vraie, au moins une fois
                for ln in pools[v]:
                    if ln.kind in ("always", "time") and not ln.id.startswith(v + "_"):
                        heard[ln.id] = rng.randint(1, 15)
            for d in range(16, last_day + 1):
                w = weather[d - 1].weather
                for v, ls in pools.items():
                    if rng.random() >= p_talk:
                        continue
                    lo, hi = VISIBLE[v]
                    hour = rng.uniform(lo, hi)
                    el = [ln for ln in ls if eligible(ln, d, hour, w)]
                    if not el:
                        continue
                    dated = [ln for ln in el if ln.kind == "dated_weather"
                             and (ln.id not in heard or d - heard[ln.id] >= DATED_REPEAT_DAYS)]
                    if dated:
                        pick = dated[0]
                    else:
                        oldest = min(heard.get(ln.id, -1) for ln in el)
                        pick = rng.choice([ln for ln in el if heard.get(ln.id, -1) == oldest])
                    talks[v] += 1
                    if pick.id in heard and d - heard[pick.id] < 28:
                        redites[v] += 1
                    if pick.id not in heard:
                        firsts_by_day[d] += 1
                    heard[pick.id] = d
    return {
        "redites": {v: round(100 * redites[v] / max(1, talks[v]), 1) for v in pools},
        "overall": round(100 * sum(redites.values()) / max(1, sum(talks.values())), 1),
        "pool_after15": {v: len([ln for ln in ls if ln.kind != "season" or ln.season == "summer"]) for v, ls in pools.items()},
    }


# ---------------------------------------------------------------------------
# Envies (section 5.4 du document)
# ---------------------------------------------------------------------------
ENVIES_RETIRED_AFTER_15 = {"meet_jeanne", "help_odette", "chop_wood"}   # bornées par leurs quêtes ou rencontres
ENVIES_NEW = {"all": 4, "late_spring": 0, "summer": 10, "autumn": 0, "winter": 0}
SHARED_EXISTING = 6
SHARED_NEW_SUMMER = 4
SHARED_EVERY = 3
SHARED_NO_REPEAT = 14
ENVIE_NO_REPEAT = 7
ENVIE_UNSEEN = 4.0


def simulate_envies(seeds: int, last_day: int) -> dict[str, object]:
    data = json.loads((DONNEES / "envies.json").read_text(encoding="utf-8"))
    base = [e["id"] for e in data["envies"] if e["kind"] == "personal" and e["id"] not in ENVIES_RETIRED_AFTER_15]
    # certaines restent conditionnelles (lit déjà là, soupe connue...): 80 % disponibles un jour donné
    pool_by_season = {}
    for s in SEASONS:
        extra = ENVIES_NEW["all"] + ENVIES_NEW.get(s, 0)
        pool_by_season[s] = base + [f"new_{s}_{i}" for i in range(ENVIES_NEW.get(s, 0))] + \
            [f"new_all_{i}" for i in range(ENVIES_NEW["all"])]
    fresh_share: defaultdict[str, list[float]] = defaultdict(list)
    repeats7 = 0
    min_pool = 99
    shared_days = 0
    shared_repeat = 0
    for seed in range(seeds):
        rng = random.Random(f"envies-{seed}")
        for player in ("p1", "p2"):
            seen = set(rng.sample(base, 12))  # environ 12 envies vécues pendant la démo
            last: dict[str, int] = {}
            fresh_by_season: defaultdict[str, list[int]] = defaultdict(list)
            for d in range(16, last_day + 1):
                s = season_of(d)
                pool = [e for e in pool_by_season[s] if rng.random() < 0.85]
                pool = [e for e in pool if d - last.get(e, -99) >= ENVIE_NO_REPEAT]
                min_pool = min(min_pool, len(pool))
                ws = [ENVIE_UNSEEN if e not in seen else 1.0 for e in pool]
                e = rng.choices(pool, weights=ws)[0]
                if e in last and d - last[e] < ENVIE_NO_REPEAT:
                    repeats7 += 1
                fresh_by_season[s].append(int(e not in seen))
                seen.add(e)
                last[e] = d
            for s, v in fresh_by_season.items():
                fresh_share[s].append(sum(v) / len(v))
        shared_last: dict[str, int] = {}
        for d in range(16, last_day + 1):
            if (d - 16) % SHARED_EVERY != 0:
                continue
            shared_days += 1
            pool = [f"sh{i}" for i in range(SHARED_EXISTING)]
            if season_of(d) == "summer":
                pool += [f"shs{i}" for i in range(SHARED_NEW_SUMMER)]
            ok = [e for e in pool if d - shared_last.get(e, -99) >= SHARED_NO_REPEAT]
            if not ok:
                shared_repeat += 1
                ok = pool
            e = rng.choice(ok)
            shared_last[e] = d
    return {
        "fresh_share": {s: round(100 * statistics.mean(v)) for s, v in fresh_share.items()},
        "repeats7": repeats7,
        "min_pool": min_pool,
        "shared_days": shared_days // seeds,
        "shared_forced_repeat": shared_repeat,
        "pool_sizes": {s: len(v) for s, v in pool_by_season.items()},
    }


# ---------------------------------------------------------------------------
# Premières fois (règle R1), jours 16 à 43
# ---------------------------------------------------------------------------
def simulate_firsts(seeds: int, pools: dict[str, list[Line]]) -> dict[str, object]:
    """Une journée compte si ce joueur y vit au moins une première fois.

    Sources comptées (section 6.3 du document): réplique jamais entendue, envie jamais reçue,
    cueillette jamais cueillie, moment jamais vu ensemble, première brume, premier jour de
    saison, produit jamais commandé dans la lettre de la coopérative, premier rejet, premier
    arbre repoussé abattu.
    """
    data = json.loads((DONNEES / "envies.json").read_text(encoding="utf-8"))
    base_env = [e["id"] for e in data["envies"] if e["kind"] == "personal" and e["id"] not in ENVIES_RETIRED_AFTER_15]
    days_with = Counter()
    total = 0
    fails_by_day = Counter()
    for seed in range(seeds):
        rng = random.Random(f"firsts-{seed}")
        weather = draw_weather(seed, STAGE_LAST_DAY)
        for player in ("p1", "p2"):
            heard: dict[str, int] = {}
            for v in pools:
                for ln in pools[v]:
                    if ln.kind in ("always", "time") and not ln.id.startswith(v + "_"):
                        heard[ln.id] = 1
                    if ln.kind in ("weather", "dated_weather", "weather_time") and not ln.id.startswith(v + "_") \
                            and rng.random() < 0.6:
                        heard[ln.id] = 1
            env_seen = set(rng.sample(base_env, 12))
            env_last: dict[str, int] = {}
            forage_seen: set[str] = set()
            mist_seen = False
            # moments: jamais vus en démo pour ce duo (tirage simplifié: un moment neuf tous les 5 à 9 jours en été)
            next_new_moment = 16 + rng.randint(2, 8)
            for d in range(16, STAGE_LAST_DAY + 1):
                first = False
                w = weather[d - 1]
                # répliques: profil médian
                for v, ls in pools.items():
                    if rng.random() >= TALK_PROFILES["médian"]:
                        continue
                    lo, hi = VISIBLE[v]
                    hour = rng.uniform(lo, hi)
                    el = [ln for ln in ls if eligible(ln, d, hour, w.weather)]
                    if not el:
                        continue
                    oldest = min(heard.get(ln.id, -1) for ln in el)
                    pick = rng.choice([ln for ln in el if heard.get(ln.id, -1) == oldest])
                    if pick.id not in heard:
                        first = True
                    heard[pick.id] = d
                # envie
                s = season_of(d)
                pool = base_env + [f"new_all_{i}" for i in range(ENVIES_NEW["all"])] + \
                    [f"new_{s}_{i}" for i in range(ENVIES_NEW.get(s, 0))]
                pool = [e for e in pool if d - env_last.get(e, -99) >= ENVIE_NO_REPEAT and rng.random() < 0.85]
                e = rng.choices(pool, weights=[ENVIE_UNSEEN if x not in env_seen else 1 for x in pool])[0]
                if e not in env_seen:
                    first = True
                env_seen.add(e)
                env_last[e] = d
                # cueillette: le joueur passe à la lisière un jour sur deux
                if rng.random() < 0.5:
                    for it, f in FORAGE.items():
                        if s in f["seasons"] and it not in forage_seen and rng.random() < 0.5:
                            forage_seen.add(it)
                            first = True
                            break
                if w.mist and not mist_seen:
                    mist_seen, first = True, True
                if d == 22:
                    first = True   # premier jour de l'été: palette, envies et répliques d'été
                if d in (16, 23, 30, 37) and rng.random() < 0.5:
                    first = True   # lettre de commande avec un produit jamais commandé
                if d == 20 or d == 26:
                    first = True   # premiers rejets visibles, premier arbre repoussé
                if d == next_new_moment:
                    first = True
                    next_new_moment = d + rng.randint(5, 9)
                total += 1
                days_with[player] += int(first)
                if not first:
                    fails_by_day[d] += 1
    return {
        "share": round(100 * sum(days_with.values()) / total, 1),
        "worst_days": fails_by_day.most_common(5),
    }


# ---------------------------------------------------------------------------
# Partie 0: contrôle croisé avec le document
# ---------------------------------------------------------------------------
def md_rows(text: str, header_start: str) -> list[list[str]]:
    lines = text.splitlines()
    for i, l in enumerate(lines):
        if l.startswith(header_start):
            rows = []
            for r in lines[i + 2:]:
                if not r.startswith("|"):
                    break
                rows.append([c.strip() for c in r.strip("|").split("|")])
            return rows
    raise SystemExit(f"table introuvable dans le document: {header_start}")


def num(s: str) -> float:
    return float(s.replace(",", ".").replace("%", "").strip())


def cross_check() -> list[str]:
    if not DOC.exists():
        return ["document absent: contrôle croisé sauté"]
    text = DOC.read_text(encoding="utf-8")
    errors = []
    for row in md_rows(text, "| Saison | Soleil | Nuages | Pluie | Brume"):
        s = {"Printemps": "spring", "Été": "summer", "Automne": "autumn", "Hiver": "winter"}[row[0]]
        target = tuple(int(num(x)) for x in row[1:4])
        if target != WEATHER_TABLE[s]:
            errors.append(f"météo {s}: document {target}, script {WEATHER_TABLE[s]}")
        if abs(num(row[4]) / 100 - MIST_BASE[s]) > 1e-9:
            errors.append(f"brume {s}: document {row[4]}, script {MIST_BASE[s]}")
        draw = tuple(int(num(x)) for x in row[5].split("/"))
        if draw != WEATHER_DRAW[s]:
            errors.append(f"tirage {s}: document {draw}, script {WEATHER_DRAW[s]}")
    for row in md_rows(text, "| Produit | `id` | Famille | Ressource"):
        pid = row[1].strip("`")
        p = BY_ID.get(pid)
        if p is None:
            errors.append(f"produit inconnu du script: {pid}")
            continue
        if row[2] != p.family or int(num(row[6])) != p.price or int(num(row[5])) != p.min_count:
            errors.append(f"produit {pid}: famille, minimum ou prix différent")
    for row in md_rows(text, "| Cueillette | `id` | Saisons | Poids"):
        fid = row[1].strip("`")
        if fid not in FORAGE or int(num(row[3])) != FORAGE[fid]["weight"]:
            errors.append(f"cueillette {fid}: poids différent ou inconnue")
    return errors


# ---------------------------------------------------------------------------
def main() -> None:
    seeds_w = 2000 if RAPIDE else 20000
    seeds_o = 400 if RAPIDE else 3000
    seeds_l = 60 if RAPIDE else 400

    print("== Partie 0: contrôle croisé du document ==")
    errs = cross_check()
    print("aucun écart" if not errs else "\n".join(errs))

    print("\n== Partie 1: calendrier ==")
    for d in (1, 15, 16, 21, 22, 42, 43, 63, 64, 84, 85):
        print(f"jour {d:3d}: {season_of(d):7s} jour {season_day(d):2d} de la saison, "
              f"{['samedi','dimanche','lundi','mardi','mercredi','jeudi','vendredi'][weekday(d)]}"
              f"{', train' if is_train_day(d) else ''}")

    print("\n== Partie 2: météo tirée, jours 16 à 372 ==")
    counts: defaultdict[str, Counter[str]] = defaultdict(Counter)
    mist: Counter[str] = Counter()
    brume_moment: Counter[str] = Counter()
    sdays: Counter[str] = Counter()
    streak_max = 0
    streak_hist: Counter[int] = Counter()
    weeks_no_sun = 0
    weeks = 0
    forced = Counter()
    for seed in range(seeds_w):
        w = draw_weather(seed, 372)
        run = 0
        for d in range(16, 373):
            x = w[d - 1]
            s = season_of(d)
            sdays[s] += 1
            counts[s][x.weather] += 1
            mist[s] += int(x.mist)
            if x.forced and x.forced not in ("écrit",):
                forced[x.forced] += 1
            if x.weather != "rain" and w[d - 2].weather == "rain" and s != "winter":
                brume_moment[s] += 1
            if x.weather == "rain":
                run += 1
            else:
                if run:
                    streak_hist[run] += 1
                run = 0
            streak_max = max(streak_max, run)
        for start in range(16, 366, 7):
            weeks += 1
            weeks_no_sun += int(all(w[d - 1].weather != "sunny" for d in range(start, start + 7)))
    print("Saison   | soleil | nuages | pluie | visé            | matins de brume | jours possibles de la brume (moment)")
    for s in SEASONS:
        c = counts[s]
        n = sdays[s]
        print(f"{s:8s} | {100*c['sunny']/n:5.1f}% | {100*c['cloudy']/n:5.1f}% | {100*c['rain']/n:4.1f}% |"
              f" {WEATHER_TABLE[s]} | {100*mist[s]/n:5.1f}% | {100*brume_moment[s]/n:5.1f}%")
    print(f"plus longue suite de pluie: {streak_max} jours; suites de pluie (longueur: nombre): "
          f"{dict(sorted(streak_hist.items()))}")
    print(f"semaines sans soleil: {weeks_no_sun} sur {weeks}; jours corrigés par garde-fou: "
          f"{ {k: round(100*v/sum(sdays.values()),2) for k, v in forced.items()} } %")
    # deux graines différentes, deux suites différentes
    a = [x.weather for x in draw_weather(1, 43)[15:]]
    b = [x.weather for x in draw_weather(2, 43)[15:]]
    print(f"graines 1 et 2, jours 16 à 43: {sum(1 for x, y in zip(a, b) if x != y)} jours différents sur 28")
    w = draw_weather(20261030, 43)
    print("graine 20261030, jour par jour (épinglé par le critère T8-12): " + ", ".join(
        f"{d} {w[d-1].weather}{' brume' if w[d-1].mist else ''}" for d in range(16, 44)))
    for seed in (20261030, 1, 2):
        w = draw_weather(seed, 43)
        txt = "".join({"sunny": "S", "cloudy": "N", "rain": "P"}[x.weather] + ("b" if x.mist else "")
                      for x in w[15:])
        print(f"graine {seed}: jours 16 à 43 = {txt}")
    # pluie: part des jours de printemps et d'été où le potager s'arrose seul
    print(f"jours de pluie, jours 16 à 43 (moyenne sur les graines): "
          f"{statistics.mean(sum(1 for x in draw_weather(s, 43)[15:] if x.weather == 'rain') for s in range(2000)):.1f} sur 28")

    print("\n== Partie 3: commande générée, commandes 3 à 11 (jours 22 à 78) ==")
    for prof, size in (("médian", "normale"), ("tranquille", "normale"), ("tranquille", "petite"), ("médian", "grande")):
        r = simulate_orders(seeds_o, prof, size=size)
        print(f"duo {prof}, commande {size}: complètes {100*r['complete']:.1f} %, lignes remplies {100*r['lines']:.1f} %,"
              f" identiques à la précédente {r['identical']}, produits repris de la précédente: {r['shared_hist']},"
              f" familles au moins {r['families_min']} hors hiver ({r['few_families']} % sous 3), lignes au moins {r['min_lines']},"
              f" hiver (lignes, repris) {r['winter']}")
        if (prof, size) == ("médian", "normale"):
            print("  commande (n): valeur complète médiane [min, max] en sous; lignes; budget moyen")
            for k, v in r["values"].items():
                print(f"  {k:2d} (jour {22 + 7*(k-3)}): {v[0]} [{v[1]}, {v[2]}]; {r['lines_by_order'][k]} lignes;"
                      f" budget {r['budget'][k]}")
        if prof == "tranquille" and size == "normale":
            print(f"  budget moyen par commande: {r['budget']}")
    # exemple lisible de la graine du robot
    print("Exemple, graine 20261030, duo qui réussit tout (valeur au prix du marché entre crochets):")
    st = OrderState()
    st.history = [["radish", "lettuce", "egg", "plank"], ["carrot", "lettuce", "egg", "omelette", "trout"]]
    st.ordered = {"radish", "lettuce", "egg", "plank", "carrot", "omelette", "trout"}
    unl = {p.id for p in PRODUCTS if p.first_day == 0 and p.id not in ("dandelion",)}
    for k, deliver in enumerate(range(22, 79, 7), start=3):
        for p in PRODUCTS:
            if p.first_day and p.first_day + 3 <= deliver - 7 and season_of(deliver - 7) in p.seasons:
                unl.add(p.id)
        ls = generate_order(20261030, k, deliver, unl, st, 6)
        print(f"  samedi {deliver}: " + ", ".join(f"{l.count} {l.product}" for l in ls)
              + f" = {order_value(ls)} sous [{market_value(ls)}]")
        st.history.append([l.product for l in ls])
        st.ordered |= {l.product for l in ls}
        st.budget = min(ORDER["budgetMax"], st.budget + ORDER["budgetStep"])
    # commande 2 de la démo dans la même unité (calage)
    demo2 = [OrderLine("carrot", 15, 15 * (5 / 3) / GARDEN_CELL_DAYS), OrderLine("lettuce", 4, 16 / GARDEN_CELL_DAYS),
             OrderLine("egg", 8, 8 / EGGS_PER_WEEK), OrderLine("omelette", 4, 6 / EGGS_PER_WEEK),
             OrderLine("trout", 2, 2 / 3)]
    print(f"calage: la commande 2 de la démo demande {sum(l.share for l in demo2):.2f} semaines de travail,"
          f" payée {market_value(demo2)} sous au prix du marché")

    print("\n== Partie 4: repousse des arbres, jours 16 à 84 ==")
    for pol in ("médian", "glouton"):
        r = simulate_trees(seeds_o, pol)
        fr = sorted(r["first_regrown"])
        print(f"duo {pol}: premier arbre repoussé abattable jour {fr[len(fr)//2]} (médiane), "
              f"abattables au moins {r['min_mature']} dès le jour 16, {r['min_mature_from22']} dès le jour 22 (jour 42: {r['min_mature_day42']}),"
              f" part des matins sous 6 arbres {100*r['share_below6']:.1f} %, plus longue suite sans arbre {r['longest_zero']} jours")

    print("\n== Partie 5: cueillette, jours 16 à 84 ==")
    r = simulate_forage(seeds_l)
    for s in ("spring", "summer", "autumn", "winter"):
        print(f"{s}: par semaine {r['per_week'].get(s, {})}; coins vides chaque matin {r['empty_share'].get(s)}")
    print(f"premier jour cueilli (médiane, p90): " + ", ".join(
        f"{i} {r['first_day_median'][i]} ({r['first_day_p90'][i]})" for i in r["first_day_median"]))
    print(f"part des duos qui la cueillent avant le jour 84: {r['first_seen_share']}")
    for i in ("dandelion", "wild_garlic", "blackberry", "chanterelle", "hazelnut"):
        print(f"  attendu sur 6 jours avant le samedi {22 if i in ('blackberry','chanterelle') else 50 if i=='hazelnut' else 22}"
              f": {i} {forage_weekly(i, 29 if i in ('blackberry','chanterelle') else 50 if i=='hazelnut' else 21):.1f}")

    print("\n== Partie 6: répliques du quotidien, redites à moins de 28 jours (R2: sous 2 %) ==")
    base = load_lines()
    for label, extra, last in (
        ("démo seule (répliques bornées)", {}, STAGE_LAST_DAY),
        ("avec les ajouts du document", NEW_LINES, STAGE_LAST_DAY),
        ("ajouts, jusqu'au jour 84 sans automne ni hiver écrits", NEW_LINES, LONG_LIFE_DAYS),
        ("ajouts + 8 d'automne et 8 d'hiver, jour 84", {**NEW_LINES, "autumn": 8, "winter": 8}, LONG_LIFE_DAYS),
    ):
        pools = with_additions(base, extra)
        for prof in TALK_PROFILES:
            r = simulate_lines(pools, seeds_l, prof, last)
            print(f"{label}, profil {prof}: {r['overall']} % (par habitant {r['redites']})")
    print(f"réserve d'un habitant en été, après ajouts: {simulate_lines(with_additions(base, NEW_LINES), 1, 'médian', 22)['pool_after15']}")

    print("\n== Partie 7: envies (R6) ==")
    for last in (STAGE_LAST_DAY, LONG_LIFE_DAYS):
        r = simulate_envies(seeds_l, last)
        print(f"jusqu'au jour {last}: envies jamais vécues par saison {r['fresh_share']} %; répétitions à moins de 7 jours"
              f" {r['repeats7']}; réserve du jour au moins {r['min_pool']}; envies à deux {r['shared_days']} jours,"
              f" redites forcées {r['shared_forced_repeat']}; réserves {r['pool_sizes']}")

    print("\n== Partie 8: premières fois (R1: au moins 95 % des journées), jours 16 à 43 ==")
    r = simulate_firsts(seeds_l, with_additions(base, NEW_LINES))
    print(f"journées avec au moins une première fois, par joueur: {r['share']} %; jours les plus pauvres: {r['worst_days']}")
    r0 = simulate_firsts(seeds_l, with_additions(base, {}))
    print(f"sans les répliques nouvelles: {r0['share']} %")

    print("\n== Partie 9: budget du robot longue vie ==")
    measured = 0.79   # secondes par journée et par graine, robots de la démo, mesure du 2026-11-01
    active = 1.6      # hypothèse prudente: routine d'après le jour 15 (commande, cueillette, conversations)
    for workers in (1, 4):
        t = LONG_LIFE_DAYS * 4 * active / workers
        print(f"84 jours x 4 graines, {workers} fil(s): {t/60:.1f} min (mesuré à vide: {LONG_LIFE_DAYS*4*measured/workers/60:.1f} min)")


if __name__ == "__main__":
    main()
