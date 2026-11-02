"""La Petite Ligne, tour 10: la rue Haute, les besoins, la maison qui grandit, le rangement.

Document lié: docs/jeux/jeu-1/tour-10-conception.md (les tables du document et les constantes
de ce script sont tenues identiques; la partie 0 le vérifie en lisant le document).

Parties:
  0. contrôle croisé des tables du document et des constantes du script
  1. horloge doublée (D1): durée d'une journée, heures jusqu'au jour 64, journées pour 100 h
  2. besoins: le Ventre au fil de cinq journées types, la forme du lendemain
  3. économie des jours 16 à 64 avec les pièces, le grand coffre et les petites dépenses
  4. rangement: sortes d'objets à ranger selon la saison, face aux cases de la maison
  5. marche: temps de trajet vers les lieux de la rue Haute

Usage: python3 -I tour10_maison.py [--rapide]
Bibliothèque standard uniquement; graines fixes, résultats reproductibles. Réutilise
`tour9_automne.py` (commande générée, annonces, catalogue et chantiers du tour 9), chargé par chemin.
"""

from __future__ import annotations

import importlib.util
import math
import random
import re
import statistics
import sys
from collections import Counter
from dataclasses import dataclass, field
from pathlib import Path

ICI = Path(__file__).resolve().parent
DOC = ICI.parent / "tour-10-conception.md"
RAPIDE = "--rapide" in sys.argv


def charger(nom: str, fichier: str):  # noqa: ANN201 (module chargé par chemin)
    spec = importlib.util.spec_from_file_location(nom, ICI / fichier)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    sys.modules[nom] = module  # nécessaire aux dataclass du module
    spec.loader.exec_module(module)
    return module


T9 = charger("tour9_automne", "tour9_automne.py")
T8 = T9.T8
weekday = T8.weekday

# ---------------------------------------------------------------------------
# Tables du document (tenues identiques par la partie 0)
# ---------------------------------------------------------------------------

# Pièces (section 4.2): id, prix en sous, planches, clous, éléments, secondes de travail à un
ROOMS = [
    ("room_cellar", 450, 16, 8, 6, 48),
    ("room_bedroom", 1200, 30, 12, 12, 96),
]
ROOMS_OPEN_DAY = 23          # lettre `basile_rooms`, le lendemain de `basile_works` (tour 9)
PLANK_PRICE = 8              # planche achetée à Basile (tour 8, L8)
NAIL_PRICE = 2

# Rangement (section 5.2): id, cases
STORAGE = {
    "chest": 20,
    "shelf": 6,
    "oak_chest": 32,
    "cellar_rack": 12,
}
OAK_CHEST_PRICE = 250
CELLAR_RACK_PLANKS, CELLAR_RACK_NAILS = 8, 4

# Ventre (section 3.3): ce qu'on mange et ce que ça donne
FOOD_BELLY = {
    "bread": 15,
    "warm_bread": 20,
    "crunchy_radishes": 20,
    "omelette": 30,
    "vegetable_soup": 35,
    "elder_jelly": 20,
    "brioche": 25,
    "hot_chocolate": 15,
}
BELLY_MORNING = 65
BELLY_DECAY_PER_HOUR = 4
SUPPER_FROM_HOUR = 18       # le souper (dès 18 h) compte double
SUPPER_FACTOR = 2
BELLY_TOGETHER = 10
BELLY_NIGHT_FLOOR = 30
BELLY_FULL = 60              # au-dessus: « Ventre plein »
BELLY_LOW = 25               # en dessous: « Un petit creux »

# Petites dépenses de la rue Haute, par semaine (pain chaud, chocolat, coupes, rideaux étalés)
SMALL_SPEND_PER_WEEK = 40
CURTAIN_PRICE = 30
CURTAINS_WANTED = 4

# Horloge
OUTDOOR_GAME_MINUTES = 900   # modèle du cahier (4.17), repris par plan_100_heures.py
FIXED_REAL_MINUTES = 4.6
CLOCK_DOUBLED = 0.7          # D1: 0,35 s par minute de jeu doublé

# ---------------------------------------------------------------------------
# Partie 0: contrôle croisé
# ---------------------------------------------------------------------------


def cross_check() -> list[str]:
    if not DOC.exists():
        return ["document absent"]
    text = DOC.read_text(encoding="utf-8")
    errors: list[str] = []
    rows = T9.md_rows(text, "| Pièce | `id` |")
    by_id = {r[1].strip("`"): r for r in rows}
    for rid, price, planks, nails, elements, seconds in ROOMS:
        r = by_id.get(rid)
        if r is None:
            errors.append(f"pièce: {rid} absente du document")
            continue
        got = (T9.num(r[3]), T9.num(r[4]), T9.num(r[5]), T9.num(r[6]), T9.num(r[7]))
        if got != (price, planks, nails, elements, seconds):
            errors.append(f"pièce: {rid} {got} au lieu de {(price, planks, nails, elements, seconds)}")
    rows = T9.md_rows(text, "| Meuble de rangement | `id` |")
    by_id = {r[1].strip("`"): r for r in rows}
    for sid, cases in STORAGE.items():
        r = by_id.get(sid)
        if r is None:
            errors.append(f"rangement: {sid} absent du document")
        elif T9.num(r[2]) != cases:
            errors.append(f"rangement: {sid} {r[2]} cases au lieu de {cases}")
    rows = T9.md_rows(text, "| Ce qu'on mange | `id` |")
    by_id = {r[1].strip("`"): r for r in rows}
    for fid, val in FOOD_BELLY.items():
        r = by_id.get(fid)
        if r is None:
            errors.append(f"ventre: {fid} absent du document")
        elif T9.num(r[2]) != val:
            errors.append(f"ventre: {fid} {r[2]} au lieu de {val}")
    return errors


# ---------------------------------------------------------------------------
# Partie 1: horloge
# ---------------------------------------------------------------------------


def day_minutes(spm: float) -> float:
    return OUTDOOR_GAME_MINUTES * spm / 60 + FIXED_REAL_MINUTES


def clock_report() -> list[str]:
    out = []
    for spm in (0.35, 0.5, 0.7, 0.9, 1.0):
        d = day_minutes(spm)
        out.append(f"{spm} s par minute: journée {d:.1f} min, jours 1 à 64 {64 * d / 60:.1f} h, "
                   f"100 h = {6000 / d:.0f} journées ({6000 / d / 84:.2f} années)")
    arcs = [("A1", 23), ("A2", 19), ("A3", 42), ("A4", 53), ("A5", 53), ("A6", 53), ("A7", 53), ("A8", 76)]
    total = sum(n for _, n in arcs)
    d07 = day_minutes(CLOCK_DOUBLED)
    out.append(f"arcs du plan inchangés à {CLOCK_DOUBLED} s: {total} journées, {total * d07 / 60:.1f} h")
    extra = math.ceil((6000 / d07) - total)
    out.append(f"pour 100 h à {CLOCK_DOUBLED} s, A8 passe de 76 à {76 + extra} journées: "
               + ", ".join(f"{k} {n * d07 / 60:.1f} h" for k, n in arcs[:-1])
               + f", A8 {(76 + extra) * d07 / 60:.1f} h, total {(total + extra) * d07 / 60:.1f} h")
    for label, hours in (("pain chaud (6 h à 9 h)", 3), ("salon ouvert le matin (9 h à 12 h)", 3),
                         ("sieste au plus (1 h)", 1), ("Achille dort (13 h à 17 h)", 4)):
        out.append(f"{label}: {hours * 60 * CLOCK_DOUBLED / 60:.1f} min réelles à {CLOCK_DOUBLED} s")
    return out


# ---------------------------------------------------------------------------
# Partie 2: besoins
# ---------------------------------------------------------------------------

# Journées types: liste de (heure, mets, ensemble). Après 19 h, veillée: l'horloge est arrêtée,
# le Ventre ne baisse plus (TE-06); le souper se prend à la veillée, puis on se couche.
DAYS = {
    "on oublie de manger": [],
    "souper simple": [(19.5, "omelette", False)],
    "souper à deux": [(19.5, "vegetable_soup", True)],
    "déjeuner et souper": [(12.5, "bread", False), (19.5, "vegetable_soup", True)],
    "journée soignée": [(7.0, "warm_bread", False), (12.5, "omelette", True),
                        (19.5, "vegetable_soup", True), (19.6, "omelette", True)],
}


@dataclass
class BellyDay:
    at_bed: int
    share_full: float
    share_low: float
    curve: dict[int, int] = field(default_factory=dict)


def gain(at: float, dish: str, together: bool) -> float:
    factor = SUPPER_FACTOR if at >= SUPPER_FROM_HOUR else 1
    return FOOD_BELLY[dish] * factor + (BELLY_TOGETHER if together else 0)


def belly_day(meals: list[tuple[float, str, bool]]) -> BellyDay:
    v = float(BELLY_MORNING)
    full = low = 0
    curve: dict[int, int] = {}
    awake_minutes = 13 * 60          # 6 h à 19 h, horloge qui tourne
    todo = sorted(meals)
    for m in range(awake_minutes + 1):
        hour = 6 + m / 60
        while todo and todo[0][0] <= hour:
            at, dish, together = todo.pop(0)
            v = min(100.0, v + gain(at, dish, together))
        if m % 60 == 0:
            curve[int(hour)] = round(v)
        if v >= BELLY_FULL:
            full += 1
        if v < BELLY_LOW:
            low += 1
        if m < awake_minutes:
            v = max(0.0, v - BELLY_DECAY_PER_HOUR / 60)
    for at, dish, together in todo:   # veillée: horloge arrêtée
        v = min(100.0, v + gain(at, dish, together))
    return BellyDay(round(max(BELLY_NIGHT_FLOOR, v)), full / awake_minutes, low / awake_minutes, curve)


def form(belly: int, sleep: int, heart: int) -> int:
    return round(0.35 * belly + 0.35 * sleep + 0.30 * heart)


# ---------------------------------------------------------------------------
# Partie 3: économie (reprend la boucle du tour 9, plus une file « pièces »)
# ---------------------------------------------------------------------------


@dataclass
class Eco10:
    purse: dict[int, int] = field(default_factory=dict)
    bought: dict[str, int] = field(default_factory=dict)
    goal_weeks: int = 0
    weeks: int = 0


def room_cost(price: int, planks: int, nails: int, own_planks: int) -> int:
    return price + PLANK_PRICE * max(0, planks - own_planks) + NAIL_PRICE * nails


def simulate_seed(seed: int, profile: str, income_scale: float, rooms_first: bool,
                  room_scale: float = 1.0) -> Eco10:
    pr = T9.PROFILES[profile]
    orders = T9.order_incomes(seed, pr["duo"])
    rng = random.Random(f"eco10-{profile}-{seed}")
    run = Eco10()
    purse = T9.START_PURSE_16
    wishes = ["oak_chest"] + list(T9.WISH_ORDER) + ["cellar_rack", "cellar_rack"]
    counts: Counter = Counter()
    chantier_paid = {c[0]: 0 for c in T9.CHANTIERS}
    built: dict[str, int] = {}
    curtains = 0
    own = pr["planks"]
    room_prices = [(rid, round(room_scale * room_cost(p, pl, n, own))) for rid, p, pl, n, _, _ in ROOMS]
    for d in range(16, T9.STAGE_LAST_DAY + 1):
        income = 0
        kind = T9.ANNONCE_POST.get(weekday(d - 2))
        if kind is not None and d - 2 >= 16:
            if rng.random() < pr["annonces"][0 if kind == "S" else 1]:
                pool = [g for g in T9.ANNONCES if g[1] == kind and T9.season_of(d - 2) in g[3]]
                g = rng.choice(pool)
                lines = g[4] if g[0] != "odette_shelf" else rng.choice(T9.SHELF_VARIANTS)
                income += T9.annonce_reward(kind, lines)
        if weekday(d) in (2, 5):
            income += round(income_scale * pr["odette"] // 2)
        if weekday(d) == 1:
            purse -= T9.SEEDS_PER_WEEK + SMALL_SPEND_PER_WEEK
        purse += income
        if weekday(d) == 0 or d == 16:
            run.weeks += 1
            opens = [r for r in room_prices if r[0] not in built and d >= ROOMS_OPEN_DAY]
            if any(p > purse - pr["reserve"] for _, p in opens) or any(
                    e[2] > purse - pr["reserve"] for e in T9.CATALOGUE
                    if T9.available_day(e) <= d < T9.removal_day(e) and counts[e[0]] < e[3]):
                run.goal_weeks += 1
        # les pièces: une à la fois, payée d'un coup quand la bourse le permet
        def try_rooms() -> None:
            nonlocal purse
            if d < ROOMS_OPEN_DAY:
                return
            for rid, price in room_prices:
                if rid in built:
                    continue
                if purse - pr["reserve"] >= price:
                    purse -= price
                    built[rid] = d + 2          # chantier à deux: deux jours de travail en moyenne
                    run.bought[rid] = d + 2
                return
        if rooms_first:
            try_rooms()
        # rideaux de la mercerie (petits achats dès qu'on passe au salon)
        if curtains < CURTAINS_WANTED and purse - CURTAIN_PRICE >= pr["reserve"] and rng.random() < 0.3:
            purse -= CURTAIN_PRICE
            curtains += 1
        changed = True
        while changed:
            changed = False
            for i, w in enumerate(wishes):
                if w == "oak_chest":
                    price, ok = OAK_CHEST_PRICE, True
                elif w == "cellar_rack":
                    price = PLANK_PRICE * max(0, CELLAR_RACK_PLANKS - own // 2) + NAIL_PRICE * CELLAR_RACK_NAILS
                    ok = "room_cellar" in built and built["room_cellar"] <= d
                else:
                    e = next(x for x in T9.CATALOGUE if x[0] == w)
                    price = e[2]
                    ok = T9.available_day(e) <= d < T9.removal_day(e) and counts[w] < e[3]
                if ok and purse - price >= pr["reserve"]:
                    purse -= price
                    counts[w] += 1
                    run.bought[f"{w}#{counts[w]}"] = d
                    wishes.pop(i)
                    changed = True
                    break
        if not rooms_first:
            try_rooms()
        for qkind in ("bourg", "maisonnette"):
            queue = sorted((c for c in T9.CHANTIERS if c[1] == qkind and c[0] not in built), key=lambda c: c[4])
            if not queue:
                continue
            c = queue[0]
            prev = [x for x in T9.CHANTIERS if x[1] == qkind and x[4] == c[4] - 1]
            opened = c[3] if not prev else built.get(prev[0][0], 999) + 1
            if d < opened:
                continue
            price = c[2]
            if qkind == "maisonnette":
                price -= T9.PLANK_DISCOUNT * min(T9.PLANK_DISCOUNT_MAX, pr["planks"])
            # le duo garde de quoi payer la prochaine pièce s'il la vise
            next_room = next((p for rid, p in room_prices if rid not in built), 0) if d >= ROOMS_OPEN_DAY else 0
            keep = pr["reserve"] + (150 if wishes else 0) + (next_room if rooms_first else 0)
            left = price - chantier_paid[c[0]]
            give = max(0, min(left, purse - keep))
            give = (give // 50) * 50 if give < left else give
            if give >= 100 or give == left > 0:
                chantier_paid[c[0]] += give
                purse -= give
                if chantier_paid[c[0]] >= price:
                    built[c[0]] = d
                    run.bought[c[0]] = d
        if weekday(d) == 0 and d in orders:
            purse += round(income_scale * orders[d])
        run.purse[d] = purse
    return run


def simulate_economy(seeds: int, profile: str, income_scale: float, rooms_first: bool,
                     room_scale: float = 1.0) -> dict[str, object]:
    runs = [simulate_seed(s, profile, income_scale, rooms_first, room_scale) for s in range(seeds)]
    n_t9 = sum(c[3] for c in T9.CATALOGUE) + len(T9.CHANTIERS)
    n_all = n_t9 + len(ROOMS) + 3   # grand coffre, deux étagères hautes

    def day_of(r: Eco10, key: str) -> int:
        return r.bought.get(key, 99)

    share = [len(r.bought) / n_all for r in runs]
    return {
        "cellier fini (jour médian; parties avant le 64 en %)": (
            statistics.median(day_of(r, "room_cellar") for r in runs),
            round(100 * sum(1 for r in runs if day_of(r, "room_cellar") <= 64) / seeds)),
        "chambre finie (jour médian; parties avant le 64 en %)": (
            statistics.median(day_of(r, "room_bedroom") for r in runs),
            round(100 * sum(1 for r in runs if day_of(r, "room_bedroom") <= 64) / seeds)),
        "part de tout ce qui est en vente achetée au jour 64 (médiane, min, %)": (
            round(100 * statistics.median(share)), round(100 * min(share))),
        "bourse au jour 63 (médiane)": int(statistics.median(r.purse[63] for r in runs)),
        "semaines avec un but d'épargne (%)": round(100 * statistics.mean(r.goal_weeks / r.weeks for r in runs)),
    }


# ---------------------------------------------------------------------------
# Partie 4: rangement
# ---------------------------------------------------------------------------

# Sortes d'objets qu'un duo médian garde à la maison (une case par objet et par qualité),
# par saison; relevé fait à la main sur `objets.json` et les saisons des tours 8 et 9.
KINDS = {
    "printemps (jours 1 à 21)": {"graines": 3, "légumes (deux qualités)": 5, "œufs": 1,
                                 "bois (bûche, planche, clou)": 3, "poissons": 2, "cueillette": 2,
                                 "plats": 3, "objets en attente (déco, cadeau)": 2},
    "été (jours 22 à 42)": {"graines": 3, "légumes (deux qualités)": 6, "œufs": 1,
                            "bois (bûche, planche, clou)": 3, "poissons": 3, "cueillette": 2,
                            "plats": 4, "objets en attente (déco, cadeau)": 3},
    "automne (jours 43 à 63)": {"graines": 3, "légumes (deux qualités)": 6, "œufs": 1,
                                "bois (bûche, planche, clou)": 3, "poissons": 3, "cueillette": 4,
                                "plats": 5, "objets en attente (déco, cadeau)": 3},
}
BAG_KEPT = 4        # sortes que les deux sacs gardent ensemble en rentrant (en-cas, graines, outils hors barre)


def storage_report() -> list[str]:
    out = []
    levels = [("coffre seul", STORAGE["chest"]),
              ("grand coffre", STORAGE["oak_chest"]),
              ("grand coffre et une étagère", STORAGE["oak_chest"] + STORAGE["shelf"]),
              ("grand coffre, cellier et deux étagères hautes", STORAGE["oak_chest"] + 2 * STORAGE["cellar_rack"])]
    for season, kinds in KINDS.items():
        total = sum(kinds.values())
        at_home = total - BAG_KEPT
        fill = ", ".join(f"{label}: {round(100 * at_home / cap)} %" for label, cap in levels)
        out.append(f"{season}: {total} sortes, environ {at_home} à ranger; remplissage {fill}")
    return out


# ---------------------------------------------------------------------------
# Partie 5: marche
# ---------------------------------------------------------------------------

WALK_SPEED = 3.5     # m/s (`movement.walkSpeed`)
DETOUR = 1.25        # chemins réels au lieu de l'angle droit (repère: carte-halte.md, épicerie à 8,3 s)
HOUSE_DOOR = (8.5, 27.5)
PLACES = {
    "comptoir d'Odette (repère)": (30.5, 26.5),
    "porte du fournil": (68.5, 20.5),
    "porte de la mercerie-coiffure": (74.5, 27.5),
    "porte de la maison de Lucie": (79.5, 27.5),
    "portail de l'école": (77.5, 20.5),
}


def walk_report() -> list[str]:
    out = []
    for name, (x, y) in PLACES.items():
        dist = abs(x - HOUSE_DOOR[0]) + abs(y - HOUSE_DOOR[1])
        secs = DETOUR * dist / WALK_SPEED
        out.append(f"{name}: {dist:.0f} m à angle droit, environ {secs:.0f} s "
                   f"({secs / CLOCK_DOUBLED:.0f} minutes de jeu à {CLOCK_DOUBLED} s)")
    return out


def main() -> None:
    seeds = 300 if RAPIDE else 2000
    print("== Partie 0: contrôle croisé du document ==")
    errs = cross_check()
    print("aucun écart" if not errs else "\n".join(errs))
    print()
    print("== Partie 1: horloge ==")
    for line in clock_report():
        print(line)
    print()
    print("== Partie 2: Ventre au fil de la journée, forme du lendemain ==")
    for name, meals in DAYS.items():
        b = belly_day(meals)
        forms = {s: form(b.at_bed, s, 60) for s in (50, 70, 85)}
        print(f"{name}: Ventre au coucher {b.at_bed}, Ventre plein {round(100 * b.share_full)} % du jour, "
              f"petit creux {round(100 * b.share_low)} % du jour; forme (Cœur 60) selon le Sommeil {forms}; "
              f"courbe {b.curve}")
    print()
    print("== Partie 3: économie des jours 16 à 64 ==")
    for scale in (1.0, 1.25):
        for prof in ("médian", "tranquille", "glouton"):
            for first in (True, False):
                label = "pièces d'abord" if first else "pièces après le reste"
                res = simulate_economy(seeds, prof, scale, first)
                print(f"-- revenus x {scale}, {prof}, {label}")
                for k, v in res.items():
                    print(f"   {k}: {v}")
    for rs in (0.8, 1.2):
        res = simulate_economy(seeds, "médian", 1.0, True, rs)
        print(f"-- médian, pièces d'abord, prix des pièces x {rs}: {res}")
    print()
    print("== Partie 4: rangement ==")
    for line in storage_report():
        print(line)
    print()
    print("== Partie 5: marche depuis la porte de la maisonnette ==")
    for line in walk_report():
        print(line)


if __name__ == "__main__":
    main()
