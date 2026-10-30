"""Collections de la version 1 de La Petite Ligne: carnet d'oiseaux, poissons, cueillettes.

Document lié: docs/jeux/jeu-1/cahier-des-charges.md (sections 4.9 et 4.17).

Question: quand un duo remplit-il chaque collection, avec et sans « coup de pouce »
vers les entrées jamais vues, et quelle part des duos la termine avant la fin de
l'année 1 (fin du contenu de la version 1) ?

Les entrées (nom, lieu, saisons, rareté) sont celles du cahier, section 6.5: ce fichier
en est la source, toute modification se reporte dans le cahier. L'arrivée aux Vergers,
qui débloque la moitié des entrées, est tirée partie par partie de la simulation
économique (duo médian, avec le coup de main du village), et la durée d'une journée
vient de la même simulation.

Usage: python3 collections_v1.py (depuis ce dossier)
Bibliothèque standard uniquement, graine fixe (environ 10 s).
"""

from __future__ import annotations

import random
import statistics
from dataclasses import dataclass

from economie_et_chapitres import ECONOMY, PACING, PROFILES, day_minutes_stats, fr, percentile, simulate

SEED = 20261031
RUNS = 2000
RARITY_WEIGHT = {"commun": 6.0, "peu commun": 3.0, "rare": 1.0}
P, E, A, H = 0, 1, 2, 3  # printemps, été, automne, hiver
YEAR = frozenset({P, E, A, H})


@dataclass(frozen=True)
class Entry:
    name: str
    place: str  # "halte" ou "vergers"
    seasons: frozenset[int]
    rarity: str


# Règle de contenu vérifiée ici: on arrive aux Vergers en plein été (8 h environ), donc chaque
# entrée des Vergers est visible en automne ou en hiver; les espèces de printemps vivent à la Halte.
BIRDS: tuple[Entry, ...] = (
    Entry("Moineau domestique", "halte", YEAR, "commun"),
    Entry("Merle noir", "halte", YEAR, "commun"),
    Entry("Mésange bleue", "halte", YEAR, "commun"),
    Entry("Rouge-gorge", "halte", frozenset({P, A, H}), "commun"),
    Entry("Hirondelle rustique", "halte", frozenset({P, E}), "commun"),
    Entry("Bergeronnette grise", "halte", frozenset({P, E, A}), "peu commun"),
    Entry("Héron cendré", "halte", YEAR, "peu commun"),
    Entry("Pic vert", "halte", YEAR, "peu commun"),
    Entry("Rossignol philomèle", "halte", frozenset({P, E}), "peu commun"),
    Entry("Martin-pêcheur", "halte", YEAR, "rare"),
    Entry("Chouette hulotte", "halte", YEAR, "rare"),
    Entry("Loriot d'Europe", "halte", frozenset({P, E}), "rare"),
    Entry("Pinson des arbres", "vergers", YEAR, "commun"),
    Entry("Mésange charbonnière", "vergers", YEAR, "commun"),
    Entry("Chardonneret élégant", "vergers", frozenset({P, E, A}), "commun"),
    Entry("Geai des chênes", "vergers", YEAR, "commun"),
    Entry("Rougequeue noir", "vergers", frozenset({P, E, A}), "peu commun"),
    Entry("Grive musicienne", "vergers", frozenset({A, H}), "peu commun"),
    Entry("Torcol fourmilier", "vergers", frozenset({E, A}), "peu commun"),
    Entry("Buse variable", "vergers", frozenset({A, H}), "peu commun"),
    Entry("Grosbec casse-noyaux", "vergers", frozenset({A, H}), "peu commun"),
    Entry("Huppe fasciée", "vergers", frozenset({P, E, A}), "rare"),
    Entry("Grand-duc d'Europe", "vergers", frozenset({A, H}), "rare"),
    Entry("Bouvreuil pivoine", "vergers", frozenset({A, H}), "rare"),
)

FISH: tuple[Entry, ...] = (
    Entry("Goujon", "halte", YEAR, "commun"),
    Entry("Vairon", "halte", YEAR, "commun"),
    Entry("Chevesne", "halte", YEAR, "peu commun"),
    Entry("Truite fario", "halte", frozenset({P, E, A}), "peu commun"),
    Entry("Barbeau", "halte", frozenset({E, A}), "peu commun"),
    Entry("Ombre commun", "halte", frozenset({A, H}), "rare"),
    Entry("Gardon", "vergers", YEAR, "commun"),
    Entry("Perche", "vergers", YEAR, "commun"),
    Entry("Tanche", "vergers", frozenset({E, A}), "peu commun"),
    Entry("Carpe", "vergers", frozenset({E, A}), "peu commun"),
    Entry("Brochet", "vergers", frozenset({A, H}), "rare"),
    Entry("Anguille", "vergers", frozenset({E, A}), "rare"),
)

GATHERING: tuple[Entry, ...] = (
    Entry("Pissenlit", "halte", frozenset({P}), "commun"),
    Entry("Ail des ours", "halte", frozenset({P}), "peu commun"),
    Entry("Morille", "halte", frozenset({P}), "peu commun"),
    Entry("Mûre", "halte", frozenset({E}), "commun"),
    Entry("Fleur de sureau", "halte", frozenset({P, E}), "peu commun"),
    Entry("Noisette", "halte", frozenset({A}), "commun"),
    Entry("Cèpe", "halte", frozenset({A}), "rare"),
    Entry("Cynorhodon", "halte", frozenset({A, H}), "peu commun"),
    Entry("Fraise des bois", "vergers", frozenset({E}), "peu commun"),
    Entry("Girolle", "vergers", frozenset({E, A}), "peu commun"),
    Entry("Châtaigne", "vergers", frozenset({A}), "commun"),
    Entry("Pleurote", "vergers", frozenset({A, H}), "rare"),
)


@dataclass(frozen=True)
class Collection:
    name: str
    entries: tuple[Entry, ...]
    finds_per_hour: float  # rencontres par heure de jeu, pour le duo, toutes entrées confondues
    boost: float  # coup de pouce: une entrée jamais vue a autant de fois plus de chances d'être tirée


COLLECTIONS: tuple[Collection, ...] = (
    # x6 pour les oiseaux: la plus grande collection, avec six espèces rares dont trois saisonnières.
    Collection("Carnet d'oiseaux (24)", BIRDS, 6.0, 6.0),
    Collection("Poissons (12)", FISH, 8.0, 4.0),
    Collection("Cueillettes (12)", GATHERING, 10.0, 4.0),
)


def hours_to_fill(c: Collection, boost: float, season_h: float, vergers_h: float, rng: random.Random,
                  cap_h: float = 120.0) -> dict[float, float]:
    """Heure où la collection atteint 50, 90 et 100 %.

    Tirer une entrée déjà vue ne change rien: on simule directement l'arrivée de la prochaine
    entrée nouvelle (processus de Poisson dont le taux ne change qu'aux découvertes, aux
    changements de saison et à l'arrivée aux Vergers).
    """
    size = len(c.entries)
    weights = [RARITY_WEIGHT[e.rarity] for e in c.entries]
    seen = [False] * size
    count = 0
    reached = {0.5: cap_h, 0.9: cap_h, 1.0: cap_h}
    season_index = 0  # compté en entier: le déduire du temps par division bloquerait la boucle sur une frontière
    t = 0.0
    while count < size and t < cap_h:
        while (season_index + 1) * season_h <= t:
            season_index += 1
        season = season_index % 4
        boundary = min(cap_h, (season_index + 1) * season_h)
        if t < vergers_h:
            boundary = min(boundary, vergers_h)
        available = [i for i, e in enumerate(c.entries)
                     if season in e.seasons and (e.place == "halte" or t >= vergers_h)]
        unseen = [i for i in available if not seen[i]]
        unseen_w = [weights[i] for i in unseen]
        seen_w = sum(weights[i] for i in available if seen[i])
        total_unseen = sum(unseen_w) * boost
        if total_unseen <= 0:
            t = boundary
            continue
        rate = c.finds_per_hour * total_unseen / (total_unseen + seen_w)
        dt = rng.expovariate(rate)
        if t + dt >= boundary:
            t = boundary
            continue
        t += dt
        pick = rng.choices(unseen, weights=unseen_w, k=1)[0]
        seen[pick] = True
        count += 1
        for threshold in reached:
            if reached[threshold] >= cap_h and count / size >= threshold:
                reached[threshold] = t
    return reached


def main() -> None:
    mean_minutes, _, _ = day_minutes_stats()
    season_h = PACING.days_per_season * mean_minutes / 60.0
    year_h = season_h * PACING.seasons_per_year
    median_profile = next(p for p in PROFILES if p.name == "médian")
    econ_rng = random.Random(SEED)
    arrivals = [simulate(median_profile, ECONOMY, True, econ_rng).arrival for _ in range(RUNS)]
    arrivals_h = [(d - 0.5) * mean_minutes / 60.0 for d in arrivals]
    print(f"Saison: {fr(season_h)} h; fin de l'année 1: {fr(year_h)} h;"
          f" arrivée aux Vergers (duo médian): {fr(statistics.median(arrivals_h))} h")
    print(f"Collections ({RUNS} parties; médiane et, entre parenthèses, 9 parties sur 10 en dessous)")
    print(f"{'Collection':<24}{'tirage':<20}{'50 %':>12}{'90 %':>12}{'100 %':>13}{'finie en année 1':>19}")
    rng = random.Random(SEED + 1)
    for c in COLLECTIONS:
        for label, boost in (("au hasard", 1.0), (f"coup de pouce x{fr(c.boost, 0)}", c.boost)):
            results = [hours_to_fill(c, boost, season_h, arrivals_h[i], rng) for i in range(RUNS)]
            cells = []
            for threshold in (0.5, 0.9, 1.0):
                values = [r[threshold] for r in results]
                cells.append(f"{fr(statistics.median(values), 0)} ({fr(percentile(values, 0.9), 0)})")
            done = sum(1 for r in results if r[1.0] <= year_h) / RUNS
            print(f"{c.name:<24}{label:<20}{cells[0]:>12}{cells[1]:>12}{cells[2]:>13}{fr(100 * done, 0) + ' %':>19}")
    print("Raretés: commun 6, peu commun 3, rare 1 (poids relatifs).")


if __name__ == "__main__":
    main()
