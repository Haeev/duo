"""La Petite Ligne, tour 9: des buts, de quoi dépenser, et l'automne entier.

Document lié: docs/jeux/jeu-1/tour-09-conception.md (les tables du document et les constantes
de ce script sont tenues identiques; la partie 0 le vérifie en lisant le document).

Parties:
  0. contrôle croisé des tables du document et des constantes du script
  1. calendrier (jours 43 et 64, école de Jeanne, jours des annonces)
  2. coût des poissons par saison (correctif de la truite d'été)
  3. commande: quantités arrondies et plafonnées (lecture des lignes du potager)
  4. cueillette d'automne (sureau, cèpe, noisette, girolle)
  5. annonces du tableau (tirage, règle des 10 jours, récompenses)
  6. économie des jours 16 à 64 (bourse, achats, épargne, sensibilité)
  7. répliques du quotidien jusqu'au jour 64 (R2)
  8. envies jusqu'au jour 64 (R6)
  9. moments: écarts entre passages (O-06) et moments vus par saison (O-07)
 10. géométrie des deux moments d'automne et des points nouveaux (carte jouée)
 11. taille de l'état ajoutée

Usage: python3 -I tour9_automne.py [--rapide]
Bibliothèque standard uniquement; graines fixes, résultats reproductibles. Réutilise
`tour8_suite.py` (météo, tirage par empreinte, commande générée) et
`moments_tour7_geometrie.py` (ligne de vue, M-02, cadre), chargés par chemin.
"""

from __future__ import annotations

import importlib.util
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
DOC = ICI.parent / "tour-09-conception.md"
JEU = ICI.parents[3] / "games" / "la-petite-ligne"
DONNEES = JEU / "donnees"
RAPIDE = "--rapide" in sys.argv


def charger(nom: str, fichier: str):  # noqa: ANN201 (module chargé par chemin)
    spec = importlib.util.spec_from_file_location(nom, ICI / fichier)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    sys.modules[nom] = module  # nécessaire aux dataclass du module
    spec.loader.exec_module(module)
    return module


T8 = charger("tour8_suite", "tour8_suite.py")
GEO = charger("moments_tour7_geometrie", "moments_tour7_geometrie.py")

season_of = T8.season_of
season_day = T8.season_day
weekday = T8.weekday          # 0 samedi, 1 dimanche, ... 6 vendredi
unit_draw = T8.unit_draw
draw_weather = T8.draw_weather

STAGE_LAST_DAY = 64            # nouvelle limite: samedi 64, 16 h (étape autumn_end)
WEEKDAY_NAMES = ["samedi", "dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi"]

# ---------------------------------------------------------------------------
# Tables du document (section 2 et 3), tenues identiques par la partie 0
# ---------------------------------------------------------------------------

# Catalogue de la semaine (table 2.3): id, rayon, prix, exemplaires, apparition, saison de retrait
# apparition: ("page", saison, semaine de la saison) ou ("souhait", habitant, jour au plus tôt)
CATALOGUE = [
    ("watering_can_copper", "outillage", 220, 2, ("page", "summer", 1), None),
    ("axe_forged", "outillage", 260, 2, ("page", "summer", 1), None),
    ("fishing_rod_bamboo", "outillage", 300, 2, ("page", "summer", 2), None),
    ("hen_extra", "basse-cour", 250, 1, ("page", "summer", 2), None),
    ("hen_extra_2", "basse-cour", 300, 1, ("page", "autumn", 1), None),
    ("straw_hat", "maison", 30, 1, ("page", "summer", 1), "summer"),
    ("pressed_flowers", "maison", 45, 1, ("page", "summer", 2), "summer"),
    ("wicker_armchair", "maison", 160, 1, ("page", "summer", 3), None),
    ("coop_calendar", "maison", 50, 1, ("page", "autumn", 1), None),
    ("wall_clock", "maison", 140, 1, ("page", "autumn", 2), None),
    ("autumn_wreath", "maison", 40, 1, ("page", "autumn", 3), "autumn"),
    ("chalk_box", "pour offrir", 35, 1, ("souhait", "jeanne", 16), None),
    ("coffee_mill", "pour offrir", 110, 1, ("souhait", "odette", 22), None),
    ("leather_apron", "pour offrir", 120, 1, ("souhait", "basile", 29), None),
    ("wool_scarf", "pour offrir", 90, 1, ("souhait", "firmin", 43), None),
]

# Chantiers (table 2.6): id, sorte, prix, ouverture (jour au plus tôt), ordre dans sa file
CHANTIERS = [
    ("ford_bench", "bourg", 600, 16, 1),
    ("quay_planters", "bourg", 700, 16, 2),
    ("well_roof", "bourg", 950, 16, 3),
    ("path_lamp", "bourg", 1300, 16, 4),
    ("house_bench", "maisonnette", 700, 22, 1),
    ("door_canopy", "maisonnette", 800, 22, 2),
]
PLANK_DISCOUNT = 10            # sous retirés par planche apportée à Basile
PLANK_DISCOUNT_MAX = 20        # planches au plus par commande à Basile

# Annonces (table 1.3): id, sorte (S coup de main, D à deux), habitant, saisons, demande
# demande: liste de (objet, nombre); un « + » d'objets différents: deux familles.
P, E, A = "spring", "summer", "autumn"
ANNONCES = [
    ("odette_shelf", "S", "odette", (P, E, A), [("carrot", 4)]),   # variante tirée: 6 radis, 4 carottes ou 2 laitues
    ("firmin_trout", "S", "firmin", (P, E, A), [("trout", 1)]),
    ("basile_planks", "S", "basile", (P, E, A), [("plank", 6)]),
    ("jeanne_chub", "S", "jeanne", (P, E, A), [("chub", 1)]),
    ("odette_eggs", "S", "odette", (P, E, A), [("egg", 6)]),
    ("firmin_soup", "S", "firmin", (A,), [("vegetable_soup", 1)]),
    ("basile_tisane", "S", "basile", (P,), [("dandelion", 6)]),
    ("basile_nuts", "S", "basile", (A,), [("hazelnut", 8)]),
    ("odette_blackberries", "S", "odette", (E,), [("blackberry", 10)]),
    ("odette_elder", "S", "odette", (A,), [("elderberry", 6)]),
    ("jeanne_mushroom", "S", "jeanne", (E, A), [("chanterelle", 1)]),
    ("firmin_omelettes", "S", "firmin", (P, E, A), [("omelette", 2)]),
    ("odette_basket", "D", "odette", (P, E, A), [("carrot", 3), ("egg", 3)]),
    ("firmin_supper", "D", "firmin", (P, E, A), [("trout", 1), ("lettuce", 1)]),
    ("basile_fence", "D", "basile", (P, E, A), [("plank", 4)]),
    ("jeanne_poem", "D", "jeanne", (P, E, A), []),
    ("jeanne_snack", "D", "jeanne", (E,), [("egg", 2), ("blackberry", 4)]),
    ("jeanne_snack_nuts", "D", "jeanne", (A,), [("egg", 2), ("hazelnut", 4)]),
    ("odette_preserves", "D", "odette", (A,), [("hazelnut", 6), ("radish", 6)]),
]
SELL = {"radish": 7, "lettuce": 32, "carrot": 16, "egg": 8, "omelette": 20, "vegetable_soup": 60,
        "gudgeon": 2, "chub": 4, "trout": 8, "plank": 6, "dandelion": 4, "wild_garlic": 8,
        "chanterelle": 12, "blackberry": 3, "hazelnut": 3, "elderberry": 4, "cep": 15}
ANNONCE_REWARD = {"S": (1.3, 25, 40, 120), "D": (1.3, 45, 60, 150)}   # facteur, ajout, plancher, plafond
ANNONCE_NO_REPEAT_DAYS = 10
ANNONCE_SAME_GIVER_FACTOR = 0.3
ANNONCE_NEVER_POSTED_FACTOR = 2.0
ANNONCE_POST = {1: "S", 4: "D"}   # dimanche: coup de main; mercredi: à deux
ANNONCE_DAYS = 3                  # jour de l'affiche compris, jusqu'à 20 h du troisième jour


def round5(x: float) -> int:
    return int(5 * round(x / 5))


def annonce_value(lines: list[tuple[str, int]]) -> int:
    return sum(SELL[i] * n for i, n in lines)


def annonce_reward(kind: str, lines: list[tuple[str, int]]) -> int:
    f, add, lo, hi = ANNONCE_REWARD[kind]
    return max(lo, min(hi, round5(f * annonce_value(lines) + add)))


# Variantes d'odette_shelf (une ligne tirée parmi les légumes obtenus et de saison)
SHELF_VARIANTS = [[("radish", 6)], [("carrot", 4)], [("lettuce", 2)]]

# Cueillette d'automne (table 3.4)
FORAGE9 = {
    "dandelion": {"seasons": ("spring",), "weight": 6, "count": (2, 3), "days": None},
    "wild_garlic": {"seasons": ("spring",), "weight": 3, "count": (1, 2), "days": None},
    "blackberry": {"seasons": ("summer",), "weight": 6, "count": (2, 3), "days": None},
    "chanterelle": {"seasons": ("summer", "autumn"), "weight": 3, "count": (1, 2), "days": None},
    "hazelnut": {"seasons": ("autumn",), "weight": 6, "count": (2, 3), "days": None},
    "cep": {"seasons": ("autumn",), "weight": 2, "count": (1, 2), "days": None},
    "elderberry": {"seasons": ("autumn",), "weight": 6, "count": (2, 3), "days": (1, 14)},
}
FORAGE9_POINTS = [
    ("forage_edge_01", ["wild_garlic", "chanterelle", "hazelnut", "cep"]),
    ("forage_edge_02", ["wild_garlic", "chanterelle", "hazelnut", "cep"]),
    ("forage_edge_03", ["dandelion", "blackberry"]),
    ("forage_edge_04", ["dandelion", "blackberry"]),
    ("forage_edge_05", ["dandelion", "blackberry", "chanterelle"]),
    ("forage_edge_06", ["elderberry"]),
]
RAIN_BOOST = {"chanterelle": 3.0, "cep": 3.0}

# Poissons: poids par saison (tour 8, 5.3) et coût de référence au printemps (tour 8, 4.2)
FISH_WEIGHTS = {
    "spring": {"gudgeon": 6, "chub": 3, "trout": 2},
    "summer": {"gudgeon": 6, "chub": 4, "trout": 1},
    "autumn": {"gudgeon": 5, "chub": 3, "trout": 3},
    "winter": {"gudgeon": 6, "chub": 2, "trout": 0},
}
FISH_COST_SPRING = {"gudgeon": 1 / 12, "chub": 1 / 6, "trout": 1 / 3}

# Plafonds d'une ligne de commande (table 2.11)
LINE_MAX = {"radish": 18, "carrot": 18, "lettuce": 8, "crunchy_radishes": 8, "vegetable_soup": 6,
            "omelette": 8, "egg": 12, "gudgeon": 12, "chub": 6, "trout": 3, "plank": 20,
            "dandelion": 12, "wild_garlic": 6, "chanterelle": 6, "blackberry": 12, "hazelnut": 12,
            "cep": 4, "elderberry": 10}
ROUND_TO = {"radish": 3, "carrot": 3}
EXTRA_LINE_MIN_SHARE = 0.2     # part perdue au plafond au-delà de laquelle la commande gagne une ligne
MAX_LINES = 6

# ---------------------------------------------------------------------------
# Partie 0: contrôle croisé
# ---------------------------------------------------------------------------


def md_rows(text: str, header_start: str) -> list[list[str]]:
    lines = text.splitlines()
    for i, ln in enumerate(lines):
        if ln.startswith(header_start):
            rows = []
            for row in lines[i + 2:]:
                if not row.startswith("|"):
                    break
                rows.append([c.strip() for c in row.strip().strip("|").split("|")])
            return rows
    return []


def num(s: str) -> float:
    s = s.replace(" ", "").replace(" ", "").replace(",", ".")
    m = re.search(r"-?\d+(\.\d+)?", s)
    return float(m.group(0)) if m else math.nan


def cross_check() -> list[str]:
    if not DOC.exists():
        return ["document absent"]
    text = DOC.read_text(encoding="utf-8")
    errors: list[str] = []
    rows = md_rows(text, "| Article | `id` |")
    by_id = {r[1].strip("`"): r for r in rows}
    for cid, rayon, price, count, _, _ in CATALOGUE:
        r = by_id.get(cid)
        if r is None:
            errors.append(f"catalogue: {cid} absent du document")
            continue
        if num(r[3]) != price:
            errors.append(f"catalogue: {cid} prix {r[3]} au lieu de {price}")
        if r[2] != rayon:
            errors.append(f"catalogue: {cid} rayon {r[2]} au lieu de {rayon}")
        if int(num(r[4])) != count:
            errors.append(f"catalogue: {cid} exemplaires {r[4]} au lieu de {count}")
    rows = md_rows(text, "| Chantier | `id` |")
    by_id = {r[1].strip("`"): r for r in rows}
    for cid, kind, price, _, order in CHANTIERS:
        r = by_id.get(cid)
        if r is None:
            errors.append(f"chantier: {cid} absent du document")
            continue
        if num(r[3]) != price or r[2] != kind:
            errors.append(f"chantier: {cid} ({r[2]}, {r[3]}) au lieu de ({kind}, {price})")
    rows = md_rows(text, "| Gabarit | Sorte |")
    by_id = {r[0].strip("`"): r for r in rows}
    for gid, kind, giver, _, lines in ANNONCES:
        r = by_id.get(gid)
        if r is None:
            errors.append(f"annonce: {gid} absente du document")
            continue
        if r[1] != {"S": "coup de main", "D": "à deux"}[kind]:
            errors.append(f"annonce: {gid} sorte {r[1]}")
        if gid == "odette_shelf":
            continue  # récompense par variante, écrite en clair
        if num(r[-1]) != annonce_reward(kind, lines):
            errors.append(f"annonce: {gid} récompense {r[-1]} au lieu de {annonce_reward(kind, lines)}")
    rows = md_rows(text, "| Cueillette | `id` |")
    by_id = {r[1].strip("`"): r for r in rows}
    for fid, f in FORAGE9.items():
        r = by_id.get(fid)
        if r is None:
            errors.append(f"cueillette: {fid} absente du document")
            continue
        if num(r[3]) != f["weight"]:
            errors.append(f"cueillette: {fid} poids {r[3]} au lieu de {f['weight']}")
    return errors


# ---------------------------------------------------------------------------
# Partie 2: coût des poissons par saison
# ---------------------------------------------------------------------------


def fish_cost(season: str) -> dict[str, float | None]:
    ref = FISH_WEIGHTS["spring"]
    ref_total = sum(ref.values())
    w = FISH_WEIGHTS[season]
    total = sum(w.values())
    out: dict[str, float | None] = {}
    for f, c in FISH_COST_SPRING.items():
        share = w[f] / total
        out[f] = None if share == 0 else c * (ref[f] / ref_total) / share
    return out


# ---------------------------------------------------------------------------
# Partie 3: quantités arrondies et plafonnées
# ---------------------------------------------------------------------------


def tidy_count(item: str, count: int, minimum: int) -> int:
    step = ROUND_TO.get(item, 1)
    c = max(minimum, step * max(1, round(count / step)))
    return min(c, LINE_MAX.get(item, c))


def simulate_quantities(seeds: int) -> dict[str, object]:
    before_max = Counter()
    after_max = Counter()
    over18 = 0
    lines_total = 0
    share_lost: list[float] = []
    pay_before: list[int] = []
    pay_after: list[int] = []
    added = 0
    orders = 0
    for seed in range(seeds):
        state = T8.OrderState()
        state.ordered |= {"radish", "lettuce", "egg", "plank", "carrot", "omelette", "trout"}
        state.history = [["radish", "lettuce", "egg", "plank"], ["carrot", "lettuce", "egg", "omelette", "trout"]]
        unlocked = {p.id for p in T8.PRODUCTS if p.first_day == 0}
        k = 3
        for deliver in range(22, STAGE_LAST_DAY + 1, 7):
            for p in T8.PRODUCTS:
                if p.first_day and p.first_day + 3 <= deliver - 7 and season_of(deliver - 7) in p.seasons:
                    unlocked.add(p.id)
            lines = T8.generate_order(seed, k, deliver, unlocked, state, mature_trees=6)
            new_lines = []
            for ln in lines:
                lines_total += 1
                before_max[ln.product] = max(before_max[ln.product], ln.count)
                if ln.count > 18:
                    over18 += 1
                p = T8.BY_ID[ln.product]
                c = tidy_count(ln.product, ln.count, p.min_count)
                after_max[ln.product] = max(after_max[ln.product], c)
                ratio = c / ln.count if ln.count else 1.0
                share = ln.share * min(1.0, ratio) if c < ln.count else ln.share
                share_lost.append(ln.share - share)
                new_lines.append(T8.OrderLine(ln.product, c, share))
            lost = sum(a.share - b.share for a, b in zip(lines, new_lines))
            if lost >= EXTRA_LINE_MIN_SHARE and len(new_lines) < MAX_LINES:
                # une ligne de plus, tirée par les règles habituelles: on la paie au moins sa part
                new_lines.append(T8.OrderLine("egg", 0, lost))
                added += 1
            orders += 1
            pay_before.append(T8.order_value(lines))
            pay_after.append(T8.order_value(new_lines))
            state.history.append([ln.product for ln in lines])
            state.ordered |= {ln.product for ln in lines}
            state.budget = min(T8.ORDER["budgetMax"], state.budget + T8.ORDER["budgetStep"])
            k += 1
    return {
        "lignes": lines_total,
        "au-dessus de 18 avant": round(100 * over18 / lines_total, 1),
        "max avant": dict(before_max.most_common(6)),
        "max après": {k: after_max[k] for k, _ in before_max.most_common(6)},
        "part perdue moyenne par ligne": round(statistics.mean(share_lost), 3),
        "paie médiane avant": int(statistics.median(pay_before)),
        "paie médiane après": int(statistics.median(pay_after)),
        "commandes avec une ligne ajoutée (%)": round(100 * added / orders, 1),
    }


# ---------------------------------------------------------------------------
# Partie 4: cueillette d'automne
# ---------------------------------------------------------------------------


def forage_available(item: str, d: int) -> bool:
    f = FORAGE9[item]
    if season_of(d) not in f["seasons"]:
        return False
    if f["days"] is not None:
        a, b = f["days"]
        return a <= season_day(d) <= b
    return True


def simulate_forage(seeds: int) -> dict[str, object]:
    weekly: defaultdict[str, Counter[str]] = defaultdict(Counter)
    weeks = Counter()
    first_cep: list[int] = []
    for seed in range(seeds):
        weather = draw_weather(seed, STAGE_LAST_DAY)
        stock: dict[str, tuple[str, int] | None] = {p: None for p, _ in FORAGE9_POINTS}
        seen: set[str] = set()
        got_cep = None
        for d in range(16, STAGE_LAST_DAY):
            s = season_of(d)
            if weekday(d) == 1:
                weeks[s] += 1
            rain_yday = weather[d - 2].weather == "rain"
            for pid, items in FORAGE9_POINTS:
                cur = stock[pid]
                if cur is not None and not forage_available(cur[0], d):
                    stock[pid] = cur = None
                avail = [i for i in items if forage_available(i, d)]
                if cur is None and avail and unit_draw(seed, "forage:" + pid, d) < 0.6:
                    ws = []
                    for i in avail:
                        w = FORAGE9[i]["weight"] * (4.0 if i not in seen else 1.0)
                        if rain_yday and i in RAIN_BOOST:
                            w *= RAIN_BOOST[i]
                        ws.append(w)
                    it = T8.pick_weighted(unit_draw(seed, "forage-item:" + pid, d), avail, ws)
                    lo, hi = FORAGE9[it]["count"]
                    n = lo + int(unit_draw(seed, "forage-count:" + pid, d) * (hi - lo + 1))
                    stock[pid] = (it, n)
                # le duo médian passe deux jours sur trois et ramasse tout
                if stock[pid] is not None and (d % 3) != 0:
                    it, n = stock[pid]  # type: ignore[misc]
                    weekly[s][it] += n
                    seen.add(it)
                    if it == "cep" and got_cep is None:
                        got_cep = d
                    stock[pid] = None
        first_cep.append(got_cep or 99)
    out = {}
    for s in ("spring", "summer", "autumn"):
        nweeks = max(1, weeks[s] / seeds)
        out[s] = {k: round(v / seeds / nweeks, 1) for k, v in sorted(weekly[s].items())}
    out["premier cèpe (médiane, jour)"] = statistics.median(first_cep)
    out["part des graines avec un cèpe avant le jour 50"] = round(100 * sum(1 for x in first_cep if x < 50) / seeds)
    return out


# ---------------------------------------------------------------------------
# Partie 5: annonces
# ---------------------------------------------------------------------------
# Produits obtenus au jour du tirage (modèle de duo du tour 8): la soupe une fois sur deux
# avant le jour 22, toujours après; les cueillettes au plus tard trois jours après leur arrivée.
FIRST_FORAGE = {"dandelion": 0, "blackberry": 22, "chanterelle": 22, "hazelnut": 43, "elderberry": 43, "cep": 46}


def obtained(item: str, d: int, rng: random.Random) -> bool:
    if item in FIRST_FORAGE:
        return d >= FIRST_FORAGE[item] + 2
    if item == "vegetable_soup":
        return d >= 22 or rng.random() < 0.5
    return True


def annonce_eligible(g: tuple, d: int, rng: random.Random) -> bool:
    gid, kind, giver, seasons, lines = g
    if season_of(d) not in seasons:
        return False
    if gid == "odette_elder" and season_day(d) > 10:
        return False  # le sureau finit au quatorzième jour de l'automne: quatre jours de marge
    # une cueillette demandée doit être de saison pendant les trois jours de l'annonce
    if any(i in FORAGE9 and not all(forage_available(i, x) for x in range(d, d + ANNONCE_DAYS)) for i, _ in lines):
        return False
    return all(obtained(i, d, rng) for i, _ in lines)


def simulate_annonces(seeds: int) -> dict[str, object]:
    repeats10 = 0
    min_eligible = {"S": 99, "D": 99}
    posted = 0
    same_giver = 0
    rewards = {"S": [], "D": []}
    per_gabarit = Counter()
    for seed in range(seeds):
        rng = random.Random(f"annonces-{seed}")
        last_post: dict[str, int] = {}
        last_giver = None
        for d in range(16, STAGE_LAST_DAY):
            kind = ANNONCE_POST.get(weekday(d))
            if kind is None:
                continue
            el = [g for g in ANNONCES if g[1] == kind and annonce_eligible(g, d, rng)
                  and d - last_post.get(g[0], -99) >= ANNONCE_NO_REPEAT_DAYS]
            min_eligible[kind] = min(min_eligible[kind], len(el))
            if not el:
                continue
            ws = []
            for g in el:
                w = 1.0
                if g[0] not in last_post:
                    w *= ANNONCE_NEVER_POSTED_FACTOR
                if g[2] == last_giver:
                    w *= ANNONCE_SAME_GIVER_FACTOR
                ws.append(w)
            g = T8.pick_weighted(unit_draw(seed, "annonce", d), [x[0] for x in el], ws)
            gg = next(x for x in el if x[0] == g)
            if g in last_post and d - last_post[g] < ANNONCE_NO_REPEAT_DAYS:
                repeats10 += 1
            same_giver += int(gg[2] == last_giver)
            last_post[g] = d
            last_giver = gg[2]
            posted += 1
            per_gabarit[g] += 1
            lines = gg[4] if g != "odette_shelf" else SHELF_VARIANTS[int(unit_draw(seed, "annonce-variant", d) * 3)]
            rewards[kind].append(annonce_reward(kind, lines))
    return {
        "annonces par partie (jours 16 à 63)": posted / seeds,
        "redites à moins de 10 jours": repeats10,
        "candidats au plus bas": min_eligible,
        "même habitant que la précédente (%)": round(100 * same_giver / posted, 1),
        "récompense moyenne": {k: round(statistics.mean(v)) for k, v in rewards.items()},
        "récompense min et max": {k: (min(v), max(v)) for k, v in rewards.items()},
        "gabarits jamais tirés": [g[0] for g in ANNONCES if per_gabarit[g[0]] == 0],
    }


# ---------------------------------------------------------------------------
# Partie 6: économie des jours 16 à 64
# ---------------------------------------------------------------------------
# Revenus: commandes du tour 8 (même générateur), annonces (partie 5), surplus vendu à Odette.
# Calage: deux robots médians à 757c3b0 (graines 20261030 et 1), sans aucun achat après la démo,
# ont 6 825 et 7 561 sous au jour 63 (relevé `/tmp`, section 2.1 du document).
PROFILES = {
    # temps de travail (tour 8), annonces faites (coup de main, à deux), ventes à Odette par semaine,
    # réserve gardée en bourse, planches apportées à Basile
    "médian": {"duo": "médian", "annonces": (0.85, 0.75), "odette": 40, "reserve": 150, "planks": 10},
    "tranquille": {"duo": "tranquille", "annonces": (0.7, 0.5), "odette": 15, "reserve": 150, "planks": 4},
    "glouton": {"duo": "médian", "annonces": (0.95, 0.9), "odette": 400, "reserve": 100, "planks": 20},
}
SEEDS_PER_WEEK = 120     # sachets de graines (relevé des robots: 100 à 150)
# Le modèle du tour 8 paie un peu mieux que les robots (bourse au jour 63 sans achat: 8 223 en
# médiane contre 6 825 et 7 561): on ramène chaque paie de commande à 88 % (partie 6, première ligne).
ORDER_CALIBRATION = 0.88
START_PURSE_16 = 1400    # bourse des robots au jour 16 (1 405 et 1 428)
# Ordre des envies d'achat d'un duo (le premier abordable part d'abord); les chantiers prennent le reste.
WISH_ORDER = ["watering_can_copper", "watering_can_copper", "chalk_box", "straw_hat", "axe_forged",
              "fishing_rod_bamboo", "hen_extra", "coffee_mill", "pressed_flowers", "axe_forged",
              "fishing_rod_bamboo", "leather_apron", "coop_calendar", "wool_scarf", "wicker_armchair",
              "wall_clock", "hen_extra_2", "autumn_wreath"]


def page_day(season: str, week: int) -> int:
    base = {"spring": 1, "summer": 22, "autumn": 43}[season]
    return base + 7 * (week - 1)


def available_day(entry: tuple) -> int:
    kind = entry[4]
    if kind[0] == "page":
        return page_day(kind[1], kind[2])
    return kind[2] + 2   # souhait entendu en moyenne deux jours après sa première réplique


def removal_day(entry: tuple) -> int:
    season = entry[5]
    if season is None:
        return 999
    return {"summer": 43, "autumn": 64}[season]


def order_incomes(seed: int, duo: str, price_scale: float = 1.0) -> dict[int, int]:
    """Paie de chaque commande des samedis 22 à 64 (modèle de duo du tour 8)."""
    mu, sd = T8.DUOS[duo]
    rng = random.Random(f"eco-{duo}-{seed}")
    talent = rng.gauss(mu, sd)
    unlocked = {p.id for p in T8.PRODUCTS if p.first_day == 0 and rng.random() < p.unlock_day_p}
    state = T8.OrderState()
    state.ordered |= {"radish", "lettuce", "egg", "plank", "carrot", "omelette", "trout"}
    state.history = [["radish", "lettuce", "egg", "plank"], ["carrot", "lettuce", "egg", "omelette", "trout"]]
    out: dict[int, int] = {}
    k = 3
    for deliver in range(22, STAGE_LAST_DAY + 1, 7):
        for p in T8.PRODUCTS:
            if p.first_day and p.first_day + 3 <= deliver - 7 and season_of(deliver - 7) in p.seasons:
                unlocked.add(p.id)
        for p in ("crunchy_radishes", "vegetable_soup", "chub", "dandelion"):
            if p not in unlocked and rng.random() < 0.25:
                unlocked.add(p)
        lines = T8.generate_order(seed, k, deliver, unlocked, state, mature_trees=6)
        avail = talent * min(1.2, 1 + T8.LEARNING_PER_ORDER * (k - 3)) * rng.uniform(0.85, 1.1)
        need = sum(ln.share for ln in lines)
        if need <= avail:
            out[deliver] = round(ORDER_CALIBRATION * T8.order_value(lines))
            state.misses = 0
            state.budget = min(T8.ORDER["budgetMax"], state.budget + T8.ORDER["budgetStep"])
        else:
            acc, pay = 0.0, 0.0
            for ln in sorted(lines, key=lambda x: x.share):
                acc += ln.share
                if acc <= avail:
                    pay += T8.line_pay(ln)
            out[deliver] = round(ORDER_CALIBRATION * pay)
            state.misses += 1
            delta = T8.ORDER["budgetAfterTwoMisses"] if state.misses >= 2 else T8.ORDER["budgetAfterMiss"]
            state.budget = max(T8.ORDER["budgetStart"] * 0.8, state.budget + delta)
        state.history.append([ln.product for ln in lines])
        state.ordered |= {ln.product for ln in lines}
        k += 1
    return out


@dataclass
class EcoRun:
    purse: dict[int, int] = field(default_factory=dict)
    bought: dict[str, int] = field(default_factory=dict)       # article ou chantier -> jour
    spent_by_week: Counter = field(default_factory=Counter)
    income_by_week: Counter = field(default_factory=Counter)
    goal_weeks: int = 0
    weeks: int = 0


def simulate_economy_seed(seed: int, profile: str, price_scale: float = 1.0) -> EcoRun:
    pr = PROFILES[profile]
    orders = order_incomes(seed, pr["duo"])
    rng = random.Random(f"eco-annonces-{profile}-{seed}")
    run = EcoRun()
    purse = START_PURSE_16
    wishes = list(WISH_ORDER)
    counts = Counter()
    chantier_paid = {c[0]: 0 for c in CHANTIERS}
    built: dict[str, int] = {}
    for d in range(16, STAGE_LAST_DAY + 1):
        week = (d - 15) // 7   # semaine 0: jours 15 à 21, puis du samedi au vendredi
        # revenus du jour
        income = 0
        kind = ANNONCE_POST.get(weekday((d - 2)))   # annonce payée le surlendemain de l'affiche
        if kind is not None and d - 2 >= 16:
            p_done = pr["annonces"][0 if kind == "S" else 1]
            if rng.random() < p_done:
                pool = [g for g in ANNONCES if g[1] == kind and season_of(d - 2) in g[3]]
                g = rng.choice(pool)
                lines = g[4] if g[0] != "odette_shelf" else rng.choice(SHELF_VARIANTS)
                income += annonce_reward(kind, lines)
        if weekday(d) in (2, 5):   # ventes à Odette, deux passages par semaine
            income += pr["odette"] // 2
        if weekday(d) == 1:
            purse -= SEEDS_PER_WEEK
        purse += income
        run.income_by_week[week] += income
        # but d'épargne: au premier jour de la semaine, un article ou un chantier ouvert hors de portée
        if weekday(d) == 0 or d == 16:
            run.weeks += 1
            open_prices = [round(price_scale * e[2]) for e in CATALOGUE
                           if available_day(e) <= d < removal_day(e) and counts[e[0]] < e[3]]
            open_prices += [round(price_scale * c[2]) - chantier_paid[c[0]] for c in CHANTIERS
                            if c[0] not in built and c[3] <= d]
            if any(p > purse - pr["reserve"] for p in open_prices):
                run.goal_weeks += 1
        # achats du matin
        changed = True
        while changed:
            changed = False
            for i, w in enumerate(wishes):
                e = next(x for x in CATALOGUE if x[0] == w)
                price = round(price_scale * e[2])
                if available_day(e) <= d < removal_day(e) and counts[w] < e[3] and purse - price >= pr["reserve"]:
                    purse -= price
                    counts[w] += 1
                    run.bought[f"{w}#{counts[w]}"] = d
                    run.spent_by_week[week] += price
                    wishes.pop(i)
                    changed = True
                    break
        # les chantiers: le premier ouvert de chaque file reçoit ce qui dépasse la réserve
        for kind in ("bourg", "maisonnette"):
            queue = sorted((c for c in CHANTIERS if c[1] == kind and c[0] not in built), key=lambda c: c[4])
            if not queue:
                continue
            c = queue[0]
            prev = [x for x in CHANTIERS if x[1] == kind and x[4] == c[4] - 1]
            opened = c[3] if not prev else built.get(prev[0][0], 999) + 1
            if d < opened:
                continue
            price = round(price_scale * c[2])
            if kind == "maisonnette":
                price -= PLANK_DISCOUNT * min(PLANK_DISCOUNT_MAX, pr["planks"])
            # un duo garde de quoi acheter le prochain article de sa liste qui paraîtra bientôt
            keep = pr["reserve"] + (150 if wishes else 0)
            give = max(0, min(price - chantier_paid[c[0]], purse - keep))
            give = (give // 50) * 50 if give < price - chantier_paid[c[0]] else give
            if give >= 100 or give == price - chantier_paid[c[0]] > 0:
                chantier_paid[c[0]] += give
                purse -= give
                run.spent_by_week[week] += give
                if chantier_paid[c[0]] >= price:
                    built[c[0]] = d
                    run.bought[c[0]] = d
        if weekday(d) == 0 and d in orders:
            purse += orders[d]          # au départ du train, après les achats du matin
            run.income_by_week[week] += orders[d]
        run.purse[d] = purse
    return run


def simulate_economy(seeds: int, profile: str, price_scale: float = 1.0) -> dict[str, object]:
    runs = [simulate_economy_seed(s, profile, price_scale) for s in range(seeds)]
    every = [c[0] for c in CATALOGUE for _ in range(c[3])]
    n_items = len(every) + len(CHANTIERS)
    total_price = round(price_scale * (sum(c[2] * c[3] for c in CATALOGUE) + sum(c[2] for c in CHANTIERS)))
    share_bought = [len(r.bought) / n_items for r in runs]
    all_day = [max(r.bought.values()) if len(r.bought) == n_items else 99 for r in runs]
    purse_64 = [r.purse[64] for r in runs]
    purse_63 = [r.purse[63] for r in runs]
    max_purse = [max(v for d, v in r.purse.items() if d < 64) for r in runs]
    goal_share = [r.goal_weeks / r.weeks for r in runs]
    weekly_spent = []
    for r in runs:
        for w in range(1, 7):
            start = r.purse.get(14 + 7 * w, START_PURSE_16)
            avail = start + r.income_by_week[w]
            if avail > 0:
                weekly_spent.append(r.spent_by_week[w] / avail)
    left = Counter()
    for r in runs:
        for c in CHANTIERS:
            if c[0] not in r.bought:
                left[c[0]] += 1
        counts = Counter(k.split("#")[0] for k in r.bought if "#" in k)
        for c in CATALOGUE:
            if counts[c[0]] < c[3]:
                left[c[0]] += 1
    return {
        "prix total de tout (sous)": total_price,
        "part achetée au jour 64 (médiane, min)": (round(100 * statistics.median(share_bought)), round(100 * min(share_bought))),
        "jour où tout est acheté (médiane; 99: jamais)": statistics.median(all_day),
        "parties où tout est acheté avant le jour 64 (%)": round(100 * sum(1 for x in all_day if x < 64) / seeds),
        "bourse au jour 63 (médiane, max)": (int(statistics.median(purse_63)), max(purse_63)),
        "bourse au jour 64 après la paie (médiane)": int(statistics.median(purse_64)),
        "bourse la plus haute avant le jour 64 (médiane)": int(statistics.median(max_purse)),
        "semaines avec un but d'épargne (%)": round(100 * statistics.mean(goal_share)),
        "part dépensée par semaine (moyenne)": round(100 * statistics.mean(weekly_spent)),
        "restent le plus souvent": dict(left.most_common(4)),
    }


def bought_days(seeds: int, profile: str) -> dict[str, float]:
    runs = [simulate_economy_seed(s, profile) for s in range(seeds)]
    days: defaultdict[str, list[int]] = defaultdict(list)
    for r in runs:
        for k, d in r.bought.items():
            days[k].append(d)
    return {k: statistics.median(v) for k, v in sorted(days.items(), key=lambda kv: statistics.median(kv[1]))}


def robot_purse_without_spending(seeds: int) -> dict[str, object]:
    """Modèle sans aucun achat, pour comparer aux deux robots (6 825 et 7 561 au jour 63)."""
    vals = []
    for s in range(seeds):
        orders = order_incomes(s, "médian")
        purse = START_PURSE_16 + sum(v for d, v in orders.items() if d <= 63) - SEEDS_PER_WEEK * 7
        vals.append(purse)
    return {"bourse au jour 63 sans achat (médiane, 10e et 90e centiles)":
            (int(statistics.median(vals)), int(sorted(vals)[len(vals) // 10]), int(sorted(vals)[9 * len(vals) // 10]))}


# ---------------------------------------------------------------------------
# Partie 7: répliques du quotidien jusqu'au jour 64
# ---------------------------------------------------------------------------
NEW9 = {"late_summer": 2, "autumn": 10, "rain_autumn": 1}
VISIBLE = {"firmin": (8, 18), "odette": (7, 20), "basile": (8, 18), "jeanne": (8, 20)}
SCHOOL_DAYS = {2, 3, 5, 6}      # lundi, mardi, jeudi, vendredi
JEANNE_AFTER_SCHOOL = (16.5, 18.5)


def cond_ok(c: dict, day: int, hour: float, weather: str) -> bool:
    t = c["type"]
    if t == "day_at_least":
        return day >= c["day"]
    if t == "day_is":
        return day in c["days"]
    if t == "not":
        return not cond_ok(c["condition"], day, hour, weather)
    if t == "any":
        return any(cond_ok(x, day, hour, weather) for x in c["conditions"])
    if t == "all":
        return all(cond_ok(x, day, hour, weather) for x in c["conditions"])
    if t == "season_is":
        return season_of(day) in c["seasons"] and season_day(day) >= c.get("fromSeasonDay", 1)
    if t == "weather_is":
        return weather == c["weather"]
    if t == "weekday_is":
        return WEEKDAY_NAMES[weekday(day)] in [w.lower() for w in c["weekdays"]] or \
            any(w in ("saturday", "sunday", "monday", "tuesday", "wednesday", "thursday", "friday") and
                ["saturday", "sunday", "monday", "tuesday", "wednesday", "thursday", "friday"].index(w) == weekday(day)
                for w in c["weekdays"])
    if t == "time_is":
        a = int(c["from"][:2]) + int(c["from"][3:]) / 60
        b = int(c["to"][:2]) + int(c["to"][3:]) / 60
        return a <= hour < b
    return True   # avancement, quêtes, objets: supposés vrais après le jour 15


@dataclass
class Rep:
    id: str
    when: list
    prio: int
    once: bool


def load_reps() -> dict[str, list[Rep]]:
    data = json.loads((DONNEES / "habitants.json").read_text(encoding="utf-8"))
    out: dict[str, list[Rep]] = {}
    for v in data["villagers"]:
        out[v["id"]] = [Rep(d["id"], d.get("when") or [], d.get("priority", 1), d.get("once") is not None)
                        for d in v["dialogues"] if d["kind"] == "daily"]
    return out


def add_tour9(reps: dict[str, list[Rep]], extra: dict[str, int]) -> dict[str, list[Rep]]:
    out = {}
    for v, ls in reps.items():
        new = list(ls)
        new += [Rep(f"{v}_ls9_{i}", [{"type": "season_is", "seasons": ["summer"], "fromSeasonDay": 15}], 1, False)
                for i in range(extra.get("late_summer", 0))]
        new += [Rep(f"{v}_au{i}", [{"type": "season_is", "seasons": ["autumn"]}], 1, False)
                for i in range(extra.get("autumn", 0))]
        new += [Rep(f"{v}_rain_au{i}", [{"type": "season_is", "seasons": ["autumn"]},
                                         {"type": "weather_is", "weather": "rain"}], 5, False)
                for i in range(extra.get("rain_autumn", 0))]
        out[v] = new
    return out


def simulate_reps(pools: dict[str, list[Rep]], seeds: int, p_talk: float, first: int, last: int) -> dict[str, float]:
    talks, redites = Counter(), Counter()
    for seed in range(seeds):
        rng = random.Random(f"reps9-{p_talk}-{seed}")
        weather = draw_weather(seed, last)
        for player in ("p1", "p2"):
            heard: dict[str, int] = {}
            for v, ls in pools.items():
                for r in ls:   # la démo: chaque réplique toujours vraie avant le jour 16, entendue une fois
                    if all(cond_ok(c, 10, 12, "sunny") for c in r.when):
                        heard[r.id] = rng.randint(1, 15)
            for d in range(16, last + 1):
                w = weather[d - 1].weather
                for v, ls in pools.items():
                    if rng.random() >= p_talk:
                        continue
                    lo, hi = VISIBLE[v]
                    if v == "jeanne" and season_of(d) == "autumn" and weekday(d) in SCHOOL_DAYS:
                        lo, hi = JEANNE_AFTER_SCHOOL
                    hour = rng.uniform(lo, hi)
                    el = [r for r in ls if all(cond_ok(c, d, hour, w) for c in r.when)
                          and not (r.once and r.id in heard)]
                    if not el:
                        continue
                    top = max(r.prio for r in el)
                    dated = [r for r in el if r.prio >= 5 and (r.id not in heard or d - heard[r.id] >= 28)]
                    if dated:
                        pick = max(dated, key=lambda r: r.prio)
                    else:
                        el = [r for r in el if r.prio < 5] or el
                        oldest = min(heard.get(r.id, -1) for r in el)
                        pick = rng.choice([r for r in el if heard.get(r.id, -1) == oldest])
                    if d >= first:
                        talks[v] += 1
                        if pick.id in heard and d - heard[pick.id] < 28:
                            redites[v] += 1
                    heard[pick.id] = d
    return {v: round(100 * redites[v] / max(1, talks[v]), 1) for v in pools}


# ---------------------------------------------------------------------------
# Partie 8: envies jusqu'au jour 64
# ---------------------------------------------------------------------------
ENVIES_NEW9 = {"autumn": 10, "autumn_after_chantier": 2}
SHARED_NEW9 = {"autumn": 3}


def envie_seasons(e: dict) -> tuple[set[str], int]:
    seasons = {"spring", "summer", "autumn", "winter"}
    from_day = 1
    for c in e.get("availableWhen") or []:
        if c["type"] == "season_is":
            seasons &= set(c["seasons"])
        if c["type"] == "day_at_least":
            from_day = max(from_day, c["day"])
        if c["type"] == "any":
            s = set()
            for x in c["conditions"]:
                if x["type"] == "season_is":
                    s |= set(x["seasons"])
            if s:
                seasons &= s
    return seasons, from_day


def simulate_envies9(seeds: int) -> dict[str, object]:
    data = json.loads((DONNEES / "envies.json").read_text(encoding="utf-8"))
    retired = {"meet_jeanne", "help_odette", "chop_wood"}
    personal = []
    shared = []
    for e in data["envies"]:
        if e["id"] in retired:
            continue
        s, fd = envie_seasons(e)
        (personal if e["kind"] == "personal" else shared).append((e["id"], s, fd))
    personal += [(f"au9_{i}", {"autumn"}, 43) for i in range(ENVIES_NEW9["autumn"])]
    personal += [(f"au9c_{i}", {"spring", "summer", "autumn", "winter"}, 40) for i in range(ENVIES_NEW9["autumn_after_chantier"])]
    shared += [(f"sh9_{i}", {"autumn"}, 43) for i in range(SHARED_NEW9["autumn"])]
    fresh = defaultdict(list)
    min_pool = defaultdict(lambda: 99)
    shared_forced = 0
    for seed in range(seeds):
        rng = random.Random(f"envies9-{seed}")
        for player in ("p1", "p2"):
            demo = [x[0] for x in personal if x[2] <= 15 and "spring" in x[1]]
            seen = set(rng.sample(demo, min(12, len(demo))))
            last: dict[str, int] = {}
            per = defaultdict(list)
            for d in range(16, STAGE_LAST_DAY):
                s = season_of(d)
                pool = [x[0] for x in personal if s in x[1] and d >= x[2] and rng.random() < 0.85]
                pool = [e for e in pool if d - last.get(e, -99) >= 7]
                min_pool[s] = min(min_pool[s], len(pool))
                ws = [4.0 if e not in seen else 1.0 for e in pool]
                e = rng.choices(pool, weights=ws)[0]
                per[s].append(int(e not in seen))
                seen.add(e)
                last[e] = d
            for s, v in per.items():
                fresh[s].append(sum(v) / len(v))
        sl: dict[str, int] = {}
        for d in range(16, STAGE_LAST_DAY, 3):
            s = season_of(d)
            pool = [x[0] for x in shared if s in x[1] and d >= x[2]]
            ok = [e for e in pool if d - sl.get(e, -99) >= 14]
            if not ok:
                shared_forced += 1
                continue
            sl[rng.choice(ok)] = d
    return {"envies jamais reçues (%)": {s: round(100 * statistics.mean(v)) for s, v in fresh.items()},
            "envies possibles au plus bas": dict(min_pool),
            "jours d'envie à deux sans candidat (rien plutôt qu'une redite)": shared_forced}


# ---------------------------------------------------------------------------
# Partie 9: moments (O-06, O-07)
# ---------------------------------------------------------------------------
# Chaque moment: poids, saisons, météo du jour admise, condition de la veille, jours du train,
# fenêtre propre, plafond par saison. Disponibilités tirées des conditions de moments.json.
MOMENTS = {
    "heron": (3, {"spring", "summer", "autumn", "winter"}, {"sunny", "cloudy"}, None, "never", None, None, 4),
    "geese": (2, {"spring"}, {"sunny", "cloudy"}, None, "never", None, 1, 5),
    "tits": (3, {"spring"}, {"sunny", "cloudy"}, None, "never", None, None, 4),   # nichoir redressé: une graine sur deux
    "fox": (3, {"spring", "summer", "autumn", "winter"}, {"sunny", "cloudy"}, None, "never", None, None, 3),
    "glowworms": (2, {"spring9", "summer"}, {"sunny"}, None, "never", None, None, 9),
    "roe_deer": (2, {"spring9", "summer"}, {"sunny", "cloudy"}, None, "never", None, None, 9),
    "kingfisher": (2, {"spring", "summer", "autumn"}, {"sunny"}, None, "never", None, None, 4),
    "mist": (3, {"spring", "summer", "autumn"}, {"sunny", "cloudy"}, "rain", "never", None, None, 2),
    # tour 7, produits au tour 9
    "falling_stars": (2, {"summer"}, {"sunny"}, None, "never", None, 2, 22),
    "train_salute": (1, {"spring", "summer", "autumn", "winter"}, {"sunny", "cloudy", "rain"}, None, "only", 14, None, 22),
    # tour 9
    "barn_owl": (2, {"autumn"}, {"sunny", "cloudy"}, None, "never", None, None, 44),
    "quay_lanterns": (2, {"autumn"}, {"sunny", "cloudy"}, None, "never", None, None, 44),
}
LONG_COOLDOWNS = {"heron": 16, "fox": 16}   # fenêtre propre dès le jour 24 (table 4.5)
TOUR8_POOL = {"heron", "geese", "tits", "fox", "glowworms", "roe_deer", "kingfisher", "mist"}
TOUR9_POOL = TOUR8_POOL | {"falling_stars", "train_salute", "barn_owl", "quay_lanterns"}


def moment_ok(mid: str, d: int, w: str, prev: str, seed: int) -> bool:
    weight, seasons, weathers, was, train, _, _, first = MOMENTS[mid]
    s = season_of(d)
    if d < first:
        return False
    in_season = s in seasons or ("spring9" in seasons and s == "spring" and season_day(d) >= 9)
    if not in_season or w not in weathers:
        return False
    if was is not None and prev != was:
        return False
    is_train = weekday(d) == 0
    if train == "only" and not is_train:
        return False
    if train == "never" and is_train:
        return False
    if mid == "tits" and seed % 2 == 0:
        return False
    return True


def simulate_moments(seeds: int, pool: set[str], last: int, cooldowns: dict[str, int] | None = None,
                     pool_full: int = 9) -> dict[str, object]:
    gaps = defaultdict(list)
    min_gap_after24 = 99
    distinct = defaultdict(list)
    passes: Counter = Counter()
    repeats: Counter = Counter()
    seen_rate = 0.8   # part des moments du jour vus ensemble (robot médian: environ 4 sur 5)
    for seed in range(seeds):
        weather = draw_weather(seed, last)
        rng = random.Random(f"mom9-{seed}")
        last_end: dict[str, int] = {}
        season_count: Counter = Counter()
        never_seen = set(pool)
        seen_season = defaultdict(set)
        cur_season = None
        for d in range(16, last + 1):
            s = season_of(d)
            if s != cur_season:
                season_count = Counter()
                cur_season = s
            w = weather[d - 1].weather
            prev = weather[d - 2].weather
            cd = 10 if d >= 24 else 7
            cands = []
            for mid in pool:
                if not moment_ok(mid, d, w, prev, seed):
                    continue
                own_cd = (cooldowns or {}).get(mid) if d >= 24 and (cooldowns or {}).get(mid) else (MOMENTS[mid][5] or cd)
                if d - last_end.get(mid, -99) < own_cd:
                    continue
                cap = MOMENTS[mid][6]
                if cap is not None and season_count[mid] >= cap:
                    continue
                cands.append(mid)
            n_season = len([m for m in pool if MOMENTS[m][4] != "only" and any(
                moment_ok(m, dd, ww, "rain", seed) for dd in range(d, d + 7) for ww in ("sunny", "cloudy"))])
            chance = 0.5 * (min(1.0, n_season / pool_full) if d >= 24 else 1.0)
            train_cands = [m for m in cands if MOMENTS[m][4] == "only"]
            if weekday(d) == 0:
                if not train_cands or unit_draw(seed, "moment", d) >= chance:
                    continue
                cands = train_cands
            elif unit_draw(seed, "moment", d) >= chance or not cands:
                continue
            ws = [MOMENTS[m][0] * (3 if (d >= 24 and m in never_seen) else 1) for m in cands]
            mid = T8.pick_weighted(unit_draw(seed, "moment-pick", d), cands, ws)
            passes[s] += 1
            if season_count[mid] >= 1:
                repeats[s] += 1
            if mid in last_end:
                g = d - last_end[mid]
                gaps[s].append(g)
                if d >= 24:
                    min_gap_after24 = min(min_gap_after24, g)
            last_end[mid] = d
            season_count[mid] += 1
            if rng.random() < seen_rate:
                never_seen.discard(mid)
                seen_season[s].add(mid)
        for s in ("summer", "autumn"):
            distinct[s].append(len(seen_season[s]))
    return {
        "écart médian (jours)": {s: statistics.median(v) for s, v in gaps.items() if v},
        "écart au plus bas après le jour 24": min_gap_after24,
        "moments différents vus ensemble (médiane)": {s: statistics.median(v) for s, v in distinct.items()},
        "parties avec au moins 2 moments différents vus (%)": {s: round(100 * sum(1 for x in v if x >= 2) / len(v), 1) for s, v in distinct.items()},
        "passages qui redisent un moment de la même saison (%)": {s: round(100 * repeats[s] / passes[s]) for s in ("summer", "autumn") if passes[s]},
    }


# ---------------------------------------------------------------------------
# Partie 10: géométrie (carte jouée)
# ---------------------------------------------------------------------------
OWL_ANCHOR = (58.0, 27.0)
# Apogée de la dame blanche (16 s), images clés [t, x, y, z, clip] (fiche 4.3)
OWL_TRACK = [
    [0.0, 61.0, 22.5, 3.2, "owl_glide"],
    [1.6, 59.6, 24.8, 2.6, "owl_glide"],
    [3.0, 58.3, 26.8, 2.2, "owl_hover"],
    [5.6, 58.3, 26.9, 2.2, "owl_hover"],
    [6.2, 58.6, 27.6, 0.1, "owl_strike"],
    [7.8, 58.6, 27.6, 0.1, "owl_mantle"],
    [8.6, 57.4, 27.6, 0.9, "owl_flap"],
    [9.2, 56.6, 27.5, 0.8, "owl_land"],
    [12.4, 56.6, 27.5, 0.8, "owl_look"],
    [13.4, 56.0, 25.6, 2.0, "owl_flap"],
    [14.6, 56.4, 22.4, 3.6, "owl_glide"],
    [16.0, 56.8, 19.6, 7.4, "owl_glide"],
]
LANTERN_PLACES = [(48.5, 18.5), (35.5, 24.5)]       # au quai (est de la lanterne), sur la place
LANTERN_HEADS = [(47.5, 18.5, 3.3), (34.5, 24.5, 3.3)]   # lamp_quay_east, lamp_square_north
NEW_POINTS9 = {
    "forage_edge_06 (sureau)": (33.5, 9.5),
    "lantern_quay_place": LANTERN_PLACES[0],
    "lantern_square_place": LANTERN_PLACES[1],
    "ford_bench, case ouest": (23.5, 36.5),
    "ford_bench, case est": (24.5, 36.5),
    "quay_planter_1": (25.5, 18.5),
    "quay_planter_2": (34.5, 18.5),
    "quay_planter_3": (49.5, 18.5),
    "path_lamp": (14.5, 26.5),
    "house_bench, case nord": (12.5, 22.5),
    "house_bench, case sud": (12.5, 23.5),
}


def geometry() -> list[str]:
    m = GEO.load_map(JEU)
    out = []
    for pid, (x, y) in NEW_POINTS9.items():
        g, blocked = m.cell(x, y)
        name = m.legend.get(g, {}).get("nom", g)
        out.append(f"{pid:26} ({x:5.2f} ; {y:5.2f}) case ({int(x)}, {int(y)}) '{g}' {name}, {'bloquée' if blocked else 'libre'}")
    owl = GEO.Check("barn_owl", 16.0, OWL_ANCHOR, 5.5, 3.0, OWL_TRACK, 0.35, 1.0)
    for c in (owl,):
        worst, cell, n = GEO.m02(m, c)
        out.append(f"{c.id}: M-02 pire {worst:.2f} s depuis ({cell[0]:.1f} ; {cell[1]:.1f}) sur {n} cases: "
                   f"{'tenu' if worst >= GEO.M02_MIN else 'NON TENU'}")
        for label, frame in GEO.FRAMES.items():
            w2, cell2 = GEO.onscreen(m, c, c.track, frame)
            out.append(f"{c.id}: dans le cadre {label}: {w2:.2f} s au pire, depuis ({cell2[0]:.1f} ; {cell2[1]:.1f})")
        for k in range(4):
            share, who = GEO.hidden_share(m, c, k)
            out.append(f"{c.id}: caché orientation {GEO.ORIENTATION_NAMES[k]}: {share:.0%}" + (f" ({who})" if who else ""))
    for i, (px, py) in enumerate(LANTERN_PLACES):
        hx, hy, hz = LANTERN_HEADS[i]
        track = [[0.0, hx, hy, hz, "lantern"], [12.0, hx, hy, hz, "lantern"]]
        c = GEO.Check(f"quay_lanterns {['quai', 'place'][i]}", 12.0, (hx, hy), 3.0, 0.0, track, 0.3, 0.0, [(px, py)])
        worst, _, _ = GEO.m02(m, c)
        w2, _ = GEO.onscreen(m, c, c.track, GEO.FRAMES["zoom 0 (16 m)"])
        hidden = [GEO.hidden_share(m, c, k)[0] for k in range(4)]
        place = GEO.occluded_by(m, px, py, 1.5, 0) or "visible"
        out.append(f"{c.id}: M-02 {worst:.2f} s, cadre zoom 0 {w2:.2f} s, flamme cachée "
                   + ", ".join(f"{h:.0%}" for h in hidden) + f"; place du joueur en orientation 0: {place}")
    d = math.hypot(LANTERN_PLACES[0][0] - LANTERN_PLACES[1][0], LANTERN_PLACES[0][1] - LANTERN_PLACES[1][1])
    sx, sy = GEO.screen_pos(LANTERN_PLACES[1][0] - LANTERN_PLACES[0][0], LANTERN_PLACES[1][1] - LANTERN_PLACES[0][1], 0.0)
    out.append(f"quay_lanterns: {d:.1f} m entre les deux places; écart à l'écran {abs(sx):.1f} m "
               f"(demi-largeur du cadre: 7,6 m au zoom 0, 11,5 m au zoom 1, 17,5 m au zoom 2): "
               f"{'jamais dans le même cadre aux zooms 0 et 1' if abs(sx) > 11.5 or abs(sy) > 6.25 else 'visibles ensemble'}")
    # le sureau: pas d'arbre ni de roncier à moins de 0,75 m du point (le coin se garnit)
    return out


# ---------------------------------------------------------------------------
# Partie 11: taille de l'état
# ---------------------------------------------------------------------------
STATE_ADDED = {
    "board (annonce en cours et précédente, 4 gabarits récents)": 230,
    "improvements (6 chantiers: versé, bâti)": 190,
    "catalogueBought (15 articles au plus)": 260,
    "animals (deux poules de plus)": 180,
    "drapeaux (cadeaux offerts, chantiers bâtis)": 120,
    "heard: 76 répliques nouvelles par joueur, au plus": 2 * 76 * 24,
}


def main() -> None:
    seeds = 300 if RAPIDE else 2000
    print("== Partie 0: contrôle croisé du document ==")
    errs = cross_check()
    print("aucun écart" if not errs else "\n".join(errs))
    print()

    print("== Partie 1: calendrier ==")
    for d in (15, 16, 19, 22, 43, 44, 57, 63, 64):
        print(f"jour {d}: {WEEKDAY_NAMES[weekday(d)]}, {season_of(d)} (jour {season_day(d)} de la saison)")
    sundays = [d for d in range(16, STAGE_LAST_DAY) if weekday(d) == 1]
    wednesdays = [d for d in range(16, STAGE_LAST_DAY) if weekday(d) == 4]
    print(f"annonces « coup de main » (dimanches): {sundays}")
    print(f"annonces « à deux » (mercredis): {wednesdays}")
    print(f"jours d'école de Jeanne en automne (43 à 63): {sum(1 for d in range(43, 64) if weekday(d) in SCHOOL_DAYS)} sur 21")
    print()

    print("== Partie 2: coût d'un poisson par saison (part d'une semaine de pêche) ==")
    for s in ("spring", "summer", "autumn", "winter"):
        print(s, {k: (None if v is None else round(v, 3)) for k, v in fish_cost(s).items()})
    print()

    print("== Partie 3: quantités des lignes (arrondi au rendement, plafonds) ==")
    for k, v in simulate_quantities(seeds // 4).items():
        print(f"{k}: {v}")
    print()

    print("== Partie 4: cueillette par semaine (duo médian, deux passages sur trois) ==")
    for k, v in simulate_forage(seeds // 4).items():
        print(f"{k}: {v}")
    print()

    print("== Partie 5: annonces ==")
    for k, v in simulate_annonces(seeds).items():
        print(f"{k}: {v}")
    print()

    print("== Partie 6: économie des jours 16 à 64 ==")
    print(robot_purse_without_spending(seeds))
    for prof in PROFILES:
        print(f"-- {prof}")
        for k, v in simulate_economy(seeds, prof).items():
            if v is not None:
                print(f"   {k}: {v}")
    for scale in (0.85, 1.15):
        print(f"-- médian, prix x {scale}")
        res = simulate_economy(seeds, "médian", scale)
        for k in ("part achetée au jour 64 (médiane, min)", "jour où tout est acheté (médiane; 99: jamais)",
                  "bourse au jour 63 (médiane, max)", "semaines avec un but d'épargne (%)"):
            print(f"   {k}: {res[k]}")
    print("-- jour médian de chaque achat, duo médian")
    print(bought_days(seeds // 4, "médian"))
    print()

    print("== Partie 7: redites des répliques à moins de 28 jours (R2, %) ==")
    base = load_reps()
    with9 = add_tour9(base, NEW9)
    n = seeds // 10
    for label, pools in (("sans les ajouts du tour 9", base), ("avec les ajouts du tour 9", with9)):
        for prof, p in (("médian", 0.55), ("assidu", 1.0)):
            print(f"{label}, {prof}, jours 16 à 43: {simulate_reps(pools, n, p, 16, 43)}")
            print(f"{label}, {prof}, jours 44 à 64: {simulate_reps(pools, n, p, 44, 64)}")
    print()

    print("== Partie 8: envies ==")
    for k, v in simulate_envies9(seeds // 10).items():
        print(f"{k}: {v}")
    print()

    print("== Partie 9: moments, jours 16 à 64 ==")
    for label, pool, cds, full in (("réserve du tour 8, réglages livrés", TOUR8_POOL, None, 9),
                                   ("réserve du tour 9, réglages livrés", TOUR9_POOL, None, 9),
                                   ("réserve du tour 9, héron et renard à 16 jours", TOUR9_POOL, LONG_COOLDOWNS, 9),
                                   ("réserve du tour 9, héron et renard à 16 jours, seasonPoolFull 7 (proposé)",
                                    TOUR9_POOL, LONG_COOLDOWNS, 7)):
        print(label, simulate_moments(seeds, pool, STAGE_LAST_DAY, cds, full))
    print()

    print("== Partie 10: géométrie (carte jouée) ==")
    for line in geometry():
        print(line)
    print()

    print("== Partie 11: taille de l'état ajoutée (octets, estimation) ==")
    for k, v in STATE_ADDED.items():
        print(f"{k}: {v}")
    print(f"total: {sum(STATE_ADDED.values())}")


if __name__ == "__main__":
    main()
