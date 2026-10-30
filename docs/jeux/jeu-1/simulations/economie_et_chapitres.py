"""Simulations du cahier des charges du jeu 1, La Petite Ligne, version 1.

Document lié: docs/jeux/jeu-1/cahier-des-charges.md (section 4.17).

1. Rythme: durée réelle d'une journée de jeu, heures par saison et par année,
   découpage des 100 heures du jeu complet.
2. Économie et chapitres: jour et heure de fin des chapitres 1 et 2, arrivée aux Vergers,
   rangs du métier principal, confiance de la coopérative, part de la commande du samedi
   dans les revenus. Trois profils de duo, avec et sans le coup de main du village.
3. Commande du samedi: contrôle du générateur sur une année de jeu (jamais un produit
   trois semaines de suite, au moins trois métiers par commande, nombre de lignes tenu).
4. Cultures et lots: valeur nette par case et par jour de chaque culture sur sa saison,
   valeur d'un lot de commande (tables des sections 4.16 et 6.4 du cahier).

Usage: python3 economie_et_chapitres.py
Bibliothèque standard uniquement, graine fixe: résultats reproductibles (environ 10 s).

Les valeurs reprennent les tables d'équilibrage du cahier (section 4.16): toute
modification de l'un se reporte dans l'autre. Le modèle économique est un modèle
moyen (valeur nette par point d'endurance dépensé), calé sur la table des cultures
(3 sous nets par case et par jour en moyenne, partie 4); il sera recalé sur les
mesures du prototype.
"""

from __future__ import annotations

import math
import random
import statistics
from collections import Counter
from dataclasses import dataclass, field

SEED = 20261030
RUNS = 2000
SATURDAY = 0  # le jour 1 est un samedi: arrivée du duo par le premier train
SUNDAY = 1


def fr(value: float, digits: int = 1) -> str:
    """Nombre à la française (virgule décimale)."""
    return f"{value:.{digits}f}".replace(".", ",")


def lognormal(rng: random.Random, mean: float, sd: float) -> float:
    sigma2 = math.log(1.0 + (sd / mean) ** 2)
    mu = math.log(mean) - sigma2 / 2.0
    return rng.lognormvariate(mu, math.sqrt(sigma2))


def percentile(values: list[float], q: float) -> float:
    ordered = sorted(values)
    index = min(len(ordered) - 1, max(0, round(q * (len(ordered) - 1))))
    return ordered[index]


def weekday(day: int) -> int:
    return (day - 1) % 7


# 1. Rythme -------------------------------------------------------------------


@dataclass(frozen=True)
class Pacing:
    seconds_per_game_minute: float = 0.8
    day_start_hour: float = 6.0
    # Heure à laquelle les deux sont rentrés (début de la veillée): loi triangulaire.
    return_min_hour: float = 19.0
    return_mode_hour: float = 20.5
    return_max_hour: float = 23.5
    breakfast_minutes: float = 0.4
    # Horloge arrêtée en journée: scènes d'histoire, menus ouverts chez les deux à la fois.
    stopped_clock_minutes: float = 1.0
    evening_mean_minutes: float = 3.0
    evening_sd_minutes: float = 1.5
    bedtime_minutes: float = 0.2
    days_per_season: int = 21
    seasons_per_year: int = 4


PACING = Pacing()


def day_minutes(p: Pacing, rng: random.Random) -> float:
    back = rng.triangular(p.return_min_hour, p.return_max_hour, p.return_mode_hour)
    # (heures de jeu) x 60 minutes de jeu x (secondes par minute de jeu) / 60 = minutes réelles
    outdoor = (back - p.day_start_hour) * p.seconds_per_game_minute
    stopped = rng.expovariate(1.0 / p.stopped_clock_minutes)
    evening = lognormal(rng, p.evening_mean_minutes, p.evening_sd_minutes)
    return p.breakfast_minutes + outdoor + stopped + evening + p.bedtime_minutes


def day_minutes_stats(samples: int = 200_000) -> tuple[float, float, float]:
    rng = random.Random(SEED)
    values = [day_minutes(PACING, rng) for _ in range(samples)]
    return statistics.fmean(values), percentile(values, 0.1), percentile(values, 0.9)


# Découpage des 100 heures en journées (section 6.11 du cahier).
V1_DAYS = 84  # une année de jeu: quatre saisons de 21 journées
EPISODES = 4  # Lac-Clair, La Tourbière, Les Hauts, Le Terminus oublié
EPISODE_DAYS = 53  # un chapitre (32 journées, une saison et demie) et une saison de vie à la nouvelle gare
TARGET_HOURS = 100.0


def report_pacing(mean_minutes: float, p10: float, p90: float) -> None:
    p = PACING
    season_h = p.days_per_season * mean_minutes / 60.0
    year_h = season_h * p.seasons_per_year
    print("1. Rythme")
    print(f"   Journée réelle: {fr(mean_minutes)} min en moyenne (9 journées sur 10 entre {fr(p10)} et {fr(p90)} min)")
    print(f"   dont dehors, horloge en marche: de {fr((p.return_min_hour - p.day_start_hour) * p.seconds_per_game_minute)}"
          f" à {fr((p.return_max_hour - p.day_start_hour) * p.seconds_per_game_minute)} min")
    print(f"   Saison ({p.days_per_season} journées): {fr(season_h)} h; année ({p.days_per_season * p.seasons_per_year} journées): {fr(year_h)} h")
    for session in (10, 25, 40, 45):
        print(f"   Séance de {session} min: {fr(session / mean_minutes)} journées")
    v1_h = V1_DAYS * mean_minutes / 60.0
    ep_h = EPISODE_DAYS * mean_minutes / 60.0
    long_h = TARGET_HOURS - v1_h - EPISODES * ep_h
    long_days = long_h * 60.0 / mean_minutes
    total_days = TARGET_HOURS * 60.0 / mean_minutes
    print(f"   Version 1 (une année): {V1_DAYS} journées, {fr(v1_h)} h, {fr(v1_h * 60 / 40, 0)} séances de 40 min")
    print(f"   Un épisode: {EPISODE_DAYS} journées, {fr(ep_h)} h; {EPISODES} épisodes: {fr(EPISODES * ep_h)} h")
    print(f"   Long terme (reste pour 100 h): {fr(long_h)} h, {fr(long_days, 0)} journées")
    print(f"   100 h: {fr(total_days, 0)} journées, {fr(total_days / (p.days_per_season * p.seasons_per_year))} années de jeu,"
          f" {fr(TARGET_HOURS * 60 / 40, 0)} séances de 40 min")
    print()


# 2. Économie et chapitres -------------------------------------------------------


@dataclass(frozen=True)
class DuoProfile:
    name: str
    efficiency: float  # part du rendement théorique atteinte (choix, déplacements, organisation)
    project_share: float  # part des revenus nets réservée aux chantiers collectifs
    line_success: float  # probabilité de livrer complète une ligne de la commande
    main_job_share: float  # part de l'endurance dépensée dans le métier principal
    visit_chance: float  # probabilité qu'un joueur parle à un habitant donné, un jour donné
    handcar_chance: float  # probabilité de sortir la draisine à deux, un jour donné
    tools_first: bool  # achète ses outils avant d'aménager la maison
    endurance_mult: float = 1.0  # aide « Endurance généreuse » chez l'un des deux (effet moyen sur le duo)


PROFILES: tuple[DuoProfile, ...] = (
    DuoProfile("tranquille", 0.65, 0.35, 0.70, 0.55, 0.35, 0.45, False),
    # Mêmes joueurs, commande « petite » (lignes plus faciles à remplir) et endurance généreuse chez l'un des deux.
    DuoProfile("tranquille avec aides", 0.65, 0.35, 0.85, 0.55, 0.35, 0.45, False, 1.15),
    DuoProfile("médian", 0.85, 0.50, 0.85, 0.70, 0.50, 0.60, False),
    DuoProfile("optimiseur", 1.05, 0.60, 0.95, 0.80, 0.55, 0.75, True),
)


@dataclass(frozen=True)
class Economy:
    value_per_point: float = 1.5  # sous nets par point d'endurance, rang 1
    rank_mult: tuple[float, ...] = (1.0, 1.25, 1.5)
    secondary_mult: float = 1.1
    noise_sd: float = 0.15
    endurance_base: float = 80.0  # endurance = 80 + 0,4 x forme
    endurance_per_form: float = 0.4
    form_start: float = 55.0
    form_house_gain: float = 15.0  # forme moyenne gagnée par une maison entièrement aménagée
    form_sd: float = 10.0
    house_costs: tuple[float, ...] = (600.0, 1500.0, 3000.0)  # chambre, cuisine et salle commune, confort
    tool_costs: tuple[float, ...] = (600.0, 1800.0)  # les deux outils du métier principal, niveaux 2 et 3
    tool_mult: tuple[float, ...] = (1.0, 1.15, 1.3)
    rank_xp: tuple[float, ...] = (600.0, 4000.0)  # expérience cumulée pour les rangs 2 et 3
    main_xp_mult: float = 2.0
    order_line_value: float = 90.0  # valeur de base moyenne d'un lot (section 6.4)
    order_line_growth: float = 0.03  # valeur d'une ligne: +3 % par samedi (quantités et produits plus riches)
    order_line_premium: float = 0.5  # une ligne est payée 1,5 fois le prix de base
    order_full_bonus: float = 0.25  # prime de commande complète
    trust_thresholds: tuple[int, ...] = (4, 9, 15, 24, 36, 50, 66)
    order_lines_base: int = 4
    order_lines_max: int = 8
    order_full_points: int = 2
    first_order_day: int = 8
    ch1_materials: float = 1200.0
    ch1_work: float = 300.0
    ch1_trust_level: int = 2
    handcar_repair: float = 500.0
    obstacles: int = 4  # le quatrième est le pont de la Combe
    bridge_cost: float = 600.0
    station_materials: float = 4000.0
    station_work: float = 800.0
    station_trust_level: int = 3
    work_share: float = 0.2  # part de l'endurance donnée au chantier collectif ouvert
    help_delay_days: tuple[int, int] = (10, 15)  # coup de main du village: chapitres 1 et 2
    help_material_share: float = 0.15
    help_work_points: float = 100.0
    bond_talk: float = 10.0
    bond_gift: float = 30.0
    gift_per_visit: float = 0.4
    bond_level2: float = 250.0
    bond_help_delay: int = 7
    bond_help_points: float = 40.0
    vergers_bonds: int = 3  # Hélène, Rose, Augustin


ECONOMY = Economy()


@dataclass
class RunResult:
    ch1_end: int = 0
    arrival: int = 0
    ch2_end: int = 0
    rank2_day: list[int] = field(default_factory=lambda: [0, 0])
    rank3_day: list[int] = field(default_factory=lambda: [0, 0])
    trust_level_end: int = 0
    order_share: float = 0.0
    help_share: float = 0.0  # part des matériaux des deux chantiers apportée par le village
    bond_helped: bool = False


def trust_level(points: int, eco: Economy) -> int:
    return sum(1 for t in eco.trust_thresholds if points >= t)


def spend_personal(budget: float, house: int, tools: list[int], eco: Economy, tools_first: bool) -> tuple[float, int]:
    """Achats de la maison et des outils, par ordre de priorité: le duo épargne pour le premier achat de sa liste."""
    while True:
        options: list[tuple[int, float]] = []  # -1 pour la maison, sinon le joueur
        if house < len(eco.house_costs):
            options.append((-1, eco.house_costs[house]))
        for player in range(2):
            if tools[player] < len(eco.tool_costs):
                options.append((player, eco.tool_costs[tools[player]]))
        if not options:
            return budget, house
        if tools_first:
            options.sort(key=lambda o: (o[0] == -1, o[1]))
        else:
            options.sort(key=lambda o: (o[0] != -1, o[1]))
        kind, cost = options[0]
        if budget < cost:
            return budget, house
        budget -= cost
        if kind == -1:
            house += 1
        else:
            tools[kind] += 1


def simulate(profile: DuoProfile, eco: Economy, village_help: bool, rng: random.Random, max_days: int = 220) -> RunResult:
    r = RunResult()
    project = 0.0
    personal = 0.0
    house = 0
    tools = [0, 0]
    xp = [0.0, 0.0]
    rank = [1, 1]
    trust = 0
    order_gross = 0.0
    total_gross = 0.0
    orders = 0
    help_materials = 0.0

    chapter = 1
    garden_day = 0
    met_day = rng.randint(3, 7)
    site_open = 0
    site_mat = 0.0
    site_work = 0.0
    ch1_ready = 0

    ch2_start = 0
    handcar_day = 0
    cleared = 0
    met2_day = 0
    bonds = [0.0] * eco.vergers_bonds
    bonds_blocked_since = 0
    station_open = 0
    st_mat = 0.0
    st_work = 0.0
    st_done = False
    ch2_ready = 0

    for day in range(1, max_days + 1):
        wd = weekday(day)
        site_active = (chapter == 1 and site_open > 0 and not ch1_ready) or (
            chapter == 2 and station_open > 0 and not st_done
        )
        house_form = eco.form_start + eco.form_house_gain * house / len(eco.house_costs)
        income = 0.0
        work_today = 0.0
        for player in range(2):
            form = min(100.0, max(0.0, rng.gauss(house_form, eco.form_sd)))
            endurance = (eco.endurance_base + eco.endurance_per_form * form) * profile.endurance_mult
            if day == 1:
                endurance *= 0.5  # le premier train arrive à 10 h
            work = endurance * eco.work_share if site_active else 0.0
            main = endurance * profile.main_job_share
            other = max(0.0, endurance - main - work)
            value = (main * eco.rank_mult[rank[player] - 1] * eco.tool_mult[tools[player]]
                     + other * eco.secondary_mult) * eco.value_per_point
            income += value * profile.efficiency * lognormal(rng, 1.0, eco.noise_sd)
            work_today += work * profile.efficiency
            xp[player] += main * eco.main_xp_mult
            while rank[player] < len(eco.rank_mult) and xp[player] >= eco.rank_xp[rank[player] - 1]:
                rank[player] += 1
                if rank[player] == 2:
                    r.rank2_day[player] = day
                else:
                    r.rank3_day[player] = day
        total_gross += income

        if wd == SATURDAY and day >= eco.first_order_day:
            level = trust_level(trust, eco)
            lines = min(eco.order_lines_max, eco.order_lines_base + level // 2)
            delivered = sum(1 for _ in range(lines) if rng.random() < profile.line_success)
            full = delivered == lines
            trust += delivered + (eco.order_full_points if full else 0)
            line_value = eco.order_line_value * (1.0 + eco.order_line_growth) ** orders
            orders += 1
            paid = line_value * (1.0 + eco.order_line_premium)
            bonus = lines * paid * eco.order_full_bonus if full else 0.0
            extra = delivered * line_value * eco.order_line_premium + bonus
            income += extra
            total_gross += extra
            order_gross += delivered * paid + bonus
            if not garden_day and delivered > 0:
                garden_day = day

        project += income * profile.project_share
        personal += income * (1.0 - profile.project_share)
        personal, house = spend_personal(personal, house, tools, eco, profile.tools_first)

        if chapter == 1:
            if not site_open and garden_day and day >= met_day:
                site_open = day
            if site_open and not ch1_ready:
                take = min(project, eco.ch1_materials - site_mat)
                project -= take
                site_mat += take
                site_work += work_today
                if village_help and day - site_open >= eco.help_delay_days[0]:
                    remaining = eco.ch1_materials - site_mat
                    if wd == SATURDAY and remaining > 1e-6:
                        site_mat += eco.help_material_share * remaining
                        help_materials += eco.help_material_share * remaining
                    if wd == SUNDAY and site_work < eco.ch1_work:
                        site_work += eco.help_work_points
                if (site_mat >= eco.ch1_materials - 1e-6 and site_work >= eco.ch1_work
                        and trust_level(trust, eco) >= eco.ch1_trust_level):
                    ch1_ready = day
            # Fête d'inauguration du quai: le dimanche qui suit.
            if ch1_ready and day > ch1_ready and wd == SUNDAY:
                r.ch1_end = day
                chapter = 2
                ch2_start = day + 1
            continue

        if day < ch2_start:
            continue
        if not handcar_day:
            if project >= eco.handcar_repair:
                project -= eco.handcar_repair
                handcar_day = day
        elif cleared < eco.obstacles:
            if rng.random() < profile.handcar_chance:
                if cleared < eco.obstacles - 1:
                    cleared += 1
                elif project >= eco.bridge_cost:
                    project -= eco.bridge_cost
                    cleared += 1
                if cleared == eco.obstacles:
                    r.arrival = day
                    met2_day = day + rng.randint(1, 3)
        if not r.arrival or day <= r.arrival:
            continue
        for h in range(eco.vergers_bonds):
            for _player in range(2):
                if rng.random() < profile.visit_chance:
                    bonds[h] += eco.bond_talk
                    if rng.random() < eco.gift_per_visit:
                        bonds[h] += eco.bond_gift
        if not station_open and trust_level(trust, eco) >= eco.station_trust_level:
            station_open = day
        if station_open and not st_done:
            take = min(project, eco.station_materials - st_mat)
            project -= take
            st_mat += take
            st_work += work_today
            if village_help and day - station_open >= eco.help_delay_days[1]:
                remaining = eco.station_materials - st_mat
                if wd == SATURDAY and remaining > 1e-6:
                    st_mat += eco.help_material_share * remaining
                    help_materials += eco.help_material_share * remaining
                if wd == SUNDAY and st_work < eco.station_work:
                    st_work += eco.help_work_points
            st_done = st_mat >= eco.station_materials - 1e-6 and st_work >= eco.station_work
        bonds_ok = all(b >= eco.bond_level2 for b in bonds)
        if st_done and day >= met2_day and not bonds_ok:
            # Le lien est la seule chose qui manque: après 7 jours, l'habitant vient vous voir.
            if not bonds_blocked_since:
                bonds_blocked_since = day
            if day - bonds_blocked_since >= eco.bond_help_delay:
                bonds = [b + eco.bond_help_points if b < eco.bond_level2 else b for b in bonds]
                r.bond_helped = True
            bonds_ok = all(b >= eco.bond_level2 for b in bonds)
        if st_done and bonds_ok and day >= met2_day and not ch2_ready:
            ch2_ready = day
        if ch2_ready and day > ch2_ready and wd == SUNDAY:
            r.ch2_end = day
            break

    r.trust_level_end = trust_level(trust, eco)
    r.order_share = order_gross / total_gross if total_gross > 0 else 0.0
    r.help_share = help_materials / (eco.ch1_materials + eco.station_materials)
    return r


def summarize(values: list[float], minutes: float, as_hours: bool) -> str:
    med, lo, hi = statistics.median(values), percentile(values, 0.1), percentile(values, 0.9)
    if as_hours:
        # Une étape franchie le jour D l'est en moyenne au milieu de cette journée.
        def h(d: float) -> float:
            return (d - 0.5) * minutes / 60.0
        return f"jour {med:.0f} [{lo:.0f}-{hi:.0f}], {fr(h(med))} h [{fr(h(lo))}-{fr(h(hi))}]"
    return f"jour {med:.0f} [{lo:.0f}-{hi:.0f}]"


def report_economy(minutes: float) -> dict[tuple[str, bool], list[RunResult]]:
    print(f"2. Économie et chapitres ({RUNS} parties par cas; médiane [1er et 9e déciles])")
    rng = random.Random(SEED + 1)
    results: dict[tuple[str, bool], list[RunResult]] = {}
    for profile in PROFILES:
        for village_help in (False, True):
            runs = [simulate(profile, ECONOMY, village_help, rng) for _ in range(RUNS)]
            results[(profile.name, village_help)] = runs
            label = "avec coup de main" if village_help else "sans coup de main"
            unfinished = sum(1 for x in runs if not x.ch2_end)
            print(f"   {profile.name}, {label}")
            print(f"      fin du chapitre 1 (inauguration du quai): {summarize([x.ch1_end for x in runs], minutes, True)}")
            print(f"      arrivée aux Vergers: {summarize([x.arrival for x in runs if x.arrival], minutes, True)}")
            ends = [x.ch2_end for x in runs if x.ch2_end]
            print(f"      fin du chapitre 2 (inauguration des Vergers): {summarize(ends, minutes, True)}")
            if unfinished:
                print(f"      parties sans fin du chapitre 2 en 220 jours: {unfinished}")
            print(f"      fin du chapitre 2 avant la fin de l'année (jour 84): {fr(100 * sum(1 for e in ends if e <= 84) / RUNS, 0)} %")
            r2 = [d for x in runs for d in x.rank2_day if d]
            r3 = [d for x in runs for d in x.rank3_day if d]
            print(f"      métier principal, rang 2: {summarize(r2, minutes, False)}; rang 3: {summarize(r3, minutes, False)}")
            print(f"      niveau de confiance à la fin: {statistics.median([x.trust_level_end for x in runs]):.0f};"
                  f" part de la commande dans les revenus: {fr(100 * statistics.fmean([x.order_share for x in runs]), 0)} %")
            if village_help:
                shares = [x.help_share for x in runs]
                print(f"      matériaux apportés par le village: {fr(100 * statistics.median(shares), 0)} %"
                      f" [{fr(100 * percentile(shares, 0.1), 0)}-{fr(100 * percentile(shares, 0.9), 0)}];"
                      f" visites de rattrapage d'un habitant: {fr(100 * sum(1 for x in runs if x.bond_helped) / RUNS, 0)} %")
    print()
    return results


# 3. Commande du samedi ------------------------------------------------------------


@dataclass(frozen=True)
class Product:
    name: str
    job: str
    unlock_day: int
    seasons: frozenset[int]


ALL = frozenset({0, 1, 2, 3})
SP, SU, AU, WI = frozenset({0}), frozenset({1}), frozenset({2}), frozenset({3})
VERGERS_DAY = 31  # arrivée médiane aux Vergers (partie 2)

PRODUCTS: tuple[Product, ...] = (
    # Maraîchage: produits frais, demandés seulement en saison.
    Product("radis", "maraîchage", 1, SP), Product("laitue", "maraîchage", 1, SP),
    Product("fèves", "maraîchage", 1, SP), Product("carottes", "maraîchage", 1, SP),
    Product("bleuets", "maraîchage", 8, SP), Product("fraises", "maraîchage", 8, SP),
    Product("tomates", "maraîchage", 1, SU), Product("haricots verts", "maraîchage", 1, SU),
    Product("courgettes", "maraîchage", 1, SU), Product("melons", "maraîchage", 1, SU),
    Product("blé", "maraîchage", 1, SU), Product("tournesols", "maraîchage", 1, SU),
    Product("fines herbes", "maraîchage", 1, SU),
    Product("potirons", "maraîchage", 1, AU), Product("betteraves", "maraîchage", 1, AU),
    Product("choux", "maraîchage", 1, AU), Product("pommes de terre", "maraîchage", 1, AU),
    Product("lentilles", "maraîchage", 1, AU),
    Product("poireaux", "maraîchage", 1, WI), Product("mâche", "maraîchage", 1, WI),
    Product("cerises", "maraîchage", VERGERS_DAY + 14, SU), Product("prunes", "maraîchage", VERGERS_DAY + 14, SU),
    Product("pommes", "maraîchage", VERGERS_DAY + 14, AU), Product("poires", "maraîchage", VERGERS_DAY + 14, AU),
    # Élevage.
    Product("œufs", "élevage", 10, ALL), Product("lait de chèvre", "élevage", VERGERS_DAY + 5, ALL),
    Product("miel", "élevage", VERGERS_DAY + 10, frozenset({0, 1, 2})),
    # Bois et charpente.
    Product("planches", "bois", 1, ALL), Product("piquets", "bois", 1, ALL),
    Product("bûches", "bois", 1, frozenset({2, 3})), Product("caisses", "bois", 15, ALL),
    Product("chaises", "bois", 22, ALL),
    # Cuisine et conserverie.
    Product("pain", "cuisine", 5, ALL), Product("confiture", "cuisine", 12, ALL),
    Product("soupe de légumes", "cuisine", 5, ALL), Product("bocaux de tomates", "cuisine", 1, frozenset({1, 2})),
    Product("fromage de chèvre", "cuisine", VERGERS_DAY + 8, ALL), Product("compote", "cuisine", VERGERS_DAY + 14, frozenset({2, 3})),
    # Pêche et cueillette.
    Product("goujons", "pêche", 2, ALL), Product("truites", "pêche", 2, frozenset({0, 1, 2})),
    Product("chevesnes", "pêche", 2, ALL), Product("pissenlits", "pêche", 1, SP),
    Product("ail des ours", "pêche", 1, SP), Product("mûres", "pêche", 1, SU),
    Product("noisettes", "pêche", 1, AU), Product("cynorhodons", "pêche", 1, WI),
    Product("gardons", "pêche", VERGERS_DAY, ALL), Product("perches", "pêche", VERGERS_DAY, ALL),
    Product("girolles", "pêche", VERGERS_DAY, AU), Product("châtaignes", "pêche", VERGERS_DAY, AU),
)

# Nombre de lignes par samedi pour un duo médian (partie 2): 4, puis 5 au niveau de confiance 2, etc.
ORDER_DAYS = tuple(range(8, 85, 7))
LINES_SCHEDULE = (4, 4, 5, 5, 5, 6, 6, 6, 6, 6, 7, 7)
MAX_PER_JOB = 2
MIN_JOBS = 3


def compose_order(n: int, candidates: list[Product], prev1: set[str], prev2: set[str], rng: random.Random) -> list[Product]:
    """Règle du cahier (section 4.6): aucun produit des deux commandes précédentes à la fois,
    deux lignes au plus par métier, trois métiers au moins tant que c'est possible, les métiers
    absents de la commande d'abord, les produits de la semaine précédente deux fois moins souvent."""
    banned = prev1 & prev2
    pool = [c for c in candidates if c.name not in banned]
    lines: list[Product] = []
    per_job: Counter[str] = Counter()
    while len(lines) < n:
        jobs = sorted({c.job for c in pool if c not in lines and per_job[c.job] < MAX_PER_JOB})
        if not jobs:
            break
        unused = [j for j in jobs if per_job[j] == 0]
        if len(per_job) < MIN_JOBS and unused:
            jobs = unused  # trois métiers au moins, tant que c'est possible
        job = rng.choices(jobs, weights=[3.0 if per_job[j] == 0 else 1.0 for j in jobs], k=1)[0]
        options = [c for c in pool if c.job == job and c not in lines]
        weights = [0.5 if c.name in prev1 else 1.0 for c in options]
        lines.append(rng.choices(options, weights=weights, k=1)[0])
        per_job[job] += 1
    return lines


def report_orders(years: int = 2000) -> None:
    rng = random.Random(SEED + 2)
    violations = 0
    short = 0
    few_jobs = 0
    distinct_4w: list[int] = []
    total = 0
    for _ in range(years):
        history: list[list[Product]] = []
        for day, n in zip(ORDER_DAYS, LINES_SCHEDULE):
            season = (day - 1) // 21 % 4
            candidates = [p for p in PRODUCTS if p.unlock_day <= day and season in p.seasons]
            prev1 = {p.name for p in history[-1]} if history else set()
            prev2 = {p.name for p in history[-2]} if len(history) > 1 else set()
            order = compose_order(n, candidates, prev1, prev2, rng)
            names = {p.name for p in order}
            if names & prev1 & prev2:
                violations += 1
            if len(order) < n:
                short += 1
            if len({p.job for p in order}) < MIN_JOBS:
                few_jobs += 1
            history.append(order)
            total += 1
            if len(history) >= 4:
                distinct_4w.append(len({p.name for o in history[-4:] for p in o}))
    print(f"3. Commande du samedi ({years} années simulées, {total} commandes)")
    print(f"   produit présent trois semaines de suite: {violations}")
    print(f"   commandes avec moins de lignes que prévu: {short}")
    print(f"   commandes avec moins de {MIN_JOBS} métiers: {few_jobs}")
    lines_4w = [sum(LINES_SCHEDULE[i - 3:i + 1]) for i in range(3, len(LINES_SCHEDULE))]
    print(f"   produits différents sur quatre samedis: {fr(statistics.fmean(distinct_4w))} en moyenne"
          f" pour {fr(statistics.fmean(lines_4w))} lignes (minimum {min(distinct_4w)})")
    print()


# 4. Cultures et lots ---------------------------------------------------------------


@dataclass(frozen=True)
class Crop:
    name: str
    season: str
    days: int
    regrow: int  # 0: une seule récolte, sinon jours entre deux récoltes
    yield_units: int  # unités par récolte et par case
    seed_cost: int  # sous par case
    unit_price: int  # sous, qualité ordinaire
    lot: int  # unités d'une ligne de commande au niveau de confiance 0
    perennial: bool = False  # vivace: la graine ne se rachète pas les années suivantes


CROPS: tuple[Crop, ...] = (
    Crop("Radis", "printemps", 4, 0, 3, 6, 7, 12),
    Crop("Laitue", "printemps", 6, 0, 1, 8, 32, 3),
    Crop("Fèves", "printemps", 9, 0, 4, 10, 8, 12),
    Crop("Carotte", "printemps", 8, 0, 3, 12, 16, 6),
    Crop("Bleuet", "printemps", 7, 0, 2, 10, 16, 6),
    Crop("Fraisier", "printemps", 10, 3, 2, 50, 10, 8, True),
    Crop("Tomate", "été", 10, 3, 3, 30, 9, 10),
    Crop("Haricot vert", "été", 8, 3, 4, 25, 4, 20),
    Crop("Courgette", "été", 6, 2, 2, 25, 6, 15),
    Crop("Melon", "été", 12, 0, 1, 40, 110, 1),
    Crop("Blé", "été", 10, 0, 3, 6, 12, 8),
    Crop("Tournesol", "été", 9, 0, 1, 12, 40, 2),
    Crop("Fines herbes", "été", 5, 3, 3, 20, 4, 20),
    Crop("Potiron", "automne", 13, 0, 1, 30, 100, 1),
    Crop("Betterave", "automne", 7, 0, 2, 10, 17, 6),
    Crop("Chou", "automne", 10, 0, 1, 15, 50, 2),
    Crop("Pomme de terre", "automne", 9, 0, 4, 12, 11, 8),
    Crop("Lentille", "automne", 9, 0, 4, 10, 8, 12),
    Crop("Poireau", "hiver", 10, 0, 2, 15, 24, 4),
    Crop("Mâche", "hiver", 5, 0, 3, 8, 7, 12),
)

# Arbres fruitiers des Vergers: prix du plant, prix d'un fruit, lot. 6 fruits tous les 2 jours en saison.
TREES: tuple[tuple[str, str, int, int, int], ...] = (
    ("Cerisier", "été", 240, 5, 18),
    ("Prunier", "été", 200, 4, 24),
    ("Pommier", "automne", 220, 5, 18),
    ("Poirier", "automne", 260, 6, 15),
)
TREE_FRUITS, TREE_EVERY = 6, 2

# Autres produits commandables: prix unitaire et lot.
OTHER_LOTS: tuple[tuple[str, int, int], ...] = (
    ("Œufs", 8, 12), ("Lait de chèvre (pot)", 15, 6), ("Miel (pot)", 30, 3),
    ("Planches", 6, 15), ("Piquets", 4, 20), ("Bûches", 5, 20), ("Caisses", 30, 3), ("Chaises", 90, 1),
    ("Pain", 15, 6), ("Confiture (pot)", 30, 3), ("Soupe de légumes (pot)", 20, 5), ("Bocaux de tomates", 25, 4),
    ("Fromage de chèvre", 35, 3), ("Compote (pot)", 20, 5),
    ("Goujons", 8, 12), ("Truites", 30, 3), ("Chevesnes", 15, 6), ("Gardons", 10, 9), ("Perches", 15, 6),
    ("Pissenlits", 4, 20), ("Ail des ours", 8, 12), ("Mûres", 3, 30), ("Noisettes", 3, 30),
    ("Girolles", 12, 8), ("Châtaignes", 3, 30), ("Cynorhodons", 5, 18),
)


def crop_daily_net(c: Crop, season_days: int, first_year: bool) -> float:
    seed = c.seed_cost if (first_year or not c.perennial) else 0
    if c.regrow:
        harvests = 1 + (season_days - c.days) // c.regrow
        return (harvests * c.yield_units * c.unit_price - seed) / season_days
    cycles = season_days // c.days
    return cycles * (c.yield_units * c.unit_price - c.seed_cost) / season_days


def report_crops() -> None:
    days = PACING.days_per_season
    print(f"4. Cultures et lots (qualité ordinaire, une saison de {days} jours)")
    print(f"   {'culture':<16}{'saison':<11}{'net/case/jour':>14}{'lot':>6}{'valeur du lot':>15}")
    values = []
    for c in CROPS:
        net = crop_daily_net(c, days, True)
        values.append(net)
        later = f" (années suivantes: {fr(crop_daily_net(c, days, False))})" if c.perennial else ""
        print(f"   {c.name:<16}{c.season:<11}{fr(net, 2):>14}{c.lot:>6}{c.lot * c.unit_price:>15}{later}")
    print(f"   moyenne des cultures: {fr(statistics.fmean(values), 2)} sous nets par case et par jour;"
          f" de {fr(min(values), 2)} à {fr(max(values), 2)}")
    for name, season, plant, price, lot in TREES:
        per_season = (days // TREE_EVERY) * TREE_FRUITS * price
        print(f"   {name:<16}{season:<11}plant {plant} sous, {per_season} sous par saison de récolte,"
              f" lot {lot} ({lot * price} sous)")
    lot_values = [c.lot * c.unit_price for c in CROPS] + [lot * price for _, _, _, price, lot in TREES] + [
        lot * price for _, price, lot in OTHER_LOTS]
    print(f"   lots: {len(lot_values)} produits, valeur de {min(lot_values)} à {max(lot_values)} sous,"
          f" moyenne {fr(statistics.fmean(lot_values), 0)} (valeur d'une ligne dans la partie 2: {fr(ECONOMY.order_line_value, 0)})")
    print()


def main() -> None:
    mean_minutes, p10, p90 = day_minutes_stats()
    report_pacing(mean_minutes, p10, p90)
    report_economy(mean_minutes)
    report_orders()
    report_crops()


if __name__ == "__main__":
    main()
