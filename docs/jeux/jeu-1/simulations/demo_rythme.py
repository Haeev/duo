"""Démo d'une heure de La Petite Ligne: durée totale et budget de la semaine.

Document lié: docs/jeux/jeu-1/demo.md (section 5).

1. Durée de la démo (huit journées, du train du samedi au train du samedi suivant)
   selon la durée d'une minute de jeu: on cherche environ 60 minutes réelles.
2. Budget d'un duo médian sur la semaine: récoltes, commande, argent disponible
   avant le train (peut-il s'offrir le lit double ?).

Usage: python3 demo_rythme.py
Bibliothèque standard uniquement, graine fixe.
"""

from __future__ import annotations

import random
import statistics

from economie_et_chapitres import fr, lognormal, percentile

SEED = 20261031
RUNS = 20_000

# Moments fixes, horloge arrêtée (minutes réelles).
CREATION = 3.0  # création des deux personnages, en même temps
ARRIVAL_SCENE = 2.0  # le premier train, Firmin et les clés
FINALE = 3.0  # départ du train, récapitulatif, scène de Firmin, écran de fin


def demo_minutes(seconds_per_minute: float, rng: random.Random) -> float:
    total = CREATION + ARRIVAL_SCENE + FINALE
    for day in range(1, 9):
        start = 10.0 if day == 1 else 6.0  # le jour 1 commence à l'arrivée du train
        if day == 8:
            end = 16.0  # départ du train: fin de la démo
        else:
            end = rng.triangular(18.5, 21.0, 19.5)  # retour à la maison, début de la veillée
        outdoor = (end - start) * seconds_per_minute  # heures x 60 min x s / 60 s
        stopped = rng.expovariate(1.0 / (1.2 if day == 1 else 0.6))  # dialogues et scènes à deux
        breakfast = 0.0 if day == 1 else 0.3
        evening = 0.0 if day == 8 else lognormal(rng, 2.0 if day == 1 else 1.5, 0.6)
        total += outdoor + stopped + breakfast + evening + (0.1 if day < 8 else 0.0)
    return total


def report_duration() -> None:
    print("1. Durée de la démo (minutes réelles; moyenne, et 8 démos sur 10 entre)")
    rng = random.Random(SEED)
    for spm in (0.30, 0.35, 0.40, 0.80):
        values = [demo_minutes(spm, rng) for _ in range(RUNS)]
        day_out = (19.5 - 6.0) * spm
        print(f"   {fr(spm, 2)} s par minute de jeu: {fr(statistics.fmean(values), 0)} min"
              f" ({fr(percentile(values, 0.1), 0)} à {fr(percentile(values, 0.9), 0)}),"
              f" dehors de 6 h à 19 h 30 en {fr(day_out)} min")
    print()


# 2. Budget de la semaine, duo médian, plan de culture conseillé par Firmin.
# Cultures de la démo: (jours de pousse, rendement par case, graine, prix de base).
DEMO_CROPS = {"radis": (2, 3, 6, 7), "laitue": (3, 1, 8, 32), "carotte": (4, 3, 12, 16)}
SOW_DAY = 2  # on sème le dimanche, une fois le toit réparé
LAST_HARVEST_DAY = 8  # récolte le samedi matin, avant le train
CASES = {"radis": 4, "laitue": 4, "carotte": 4}  # potager de 12 cases
GROCER_RATE = 0.8  # l'épicerie achète à 80 %
START_PURSE = 200
EGGS_FROM_DAY, HENS = 5, 3
EGG_PRICE = 8
PLANK_PRICE = 6
ORDER = {"radis": 12, "laitue": 3, "œufs": 6, "planches": 10}
ORDER_PREMIUM, ORDER_BONUS = 1.5, 0.25
SUPPER_USE = {"radis": 6, "laitue": 2, "carotte": 6}  # ce que le duo cuisine dans la semaine
PLANKS_SOLD = 10  # planches vendues en plus de la commande


def harvests(days: int, start: int, last: int) -> list[int]:
    """Jours de récolte d'une case semée au jour start et resemée aussitôt."""
    out = []
    day = start + days
    while day <= last:
        out.append(day)
        day += days
    return out


def report_budget() -> None:
    print("2. Budget de la semaine (duo médian, plan conseillé)")
    produced: dict[str, int] = {}
    seeds = 0
    for name, (days, yld, seed, _price) in DEMO_CROPS.items():
        days_list = harvests(days, SOW_DAY, LAST_HARVEST_DAY)
        produced[name] = len(days_list) * yld * CASES[name]
        # une graine par semis: le premier, puis un par récolte sauf la dernière de la démo
        sowings = 1 + max(0, len(days_list) - 1)
        seeds += sowings * seed * CASES[name]
        print(f"   {name}: récoltes aux jours {days_list}, {produced[name]} unités")
    eggs = HENS * (LAST_HARVEST_DAY - EGGS_FROM_DAY + 1)
    print(f"   œufs: {eggs} (trois poules à partir du jour {EGGS_FROM_DAY})")
    sales = 0.0
    for name, (_d, _y, _s, price) in DEMO_CROPS.items():
        left = produced[name] - ORDER.get(name, 0) - SUPPER_USE.get(name, 0)
        sales += max(0, left) * price * GROCER_RATE
    sales += max(0, eggs - ORDER["œufs"]) * EGG_PRICE * GROCER_RATE
    sales += PLANKS_SOLD * PLANK_PRICE * GROCER_RATE
    purse = START_PURSE - seeds + sales
    print(f"   graines: {seeds} sous; ventes à l'épicerie dans la semaine: {fr(sales, 0)} sous")
    print(f"   bourse avant le train (sans aucun achat): {fr(purse, 0)} sous")
    base = (ORDER["radis"] * DEMO_CROPS["radis"][3] + ORDER["laitue"] * DEMO_CROPS["laitue"][3]
            + ORDER["œufs"] * EGG_PRICE + ORDER["planches"] * PLANK_PRICE)
    paid = base * ORDER_PREMIUM * (1 + ORDER_BONUS)
    print(f"   commande du samedi: valeur de base {base} sous, payée {fr(paid, 0)} sous si elle est complète")
    print("   lit double au catalogue: 240 sous; lampe 40, tapis 60, rideaux 30, poste à galène 120")


def main() -> None:
    report_duration()
    report_budget()


if __name__ == "__main__":
    main()
