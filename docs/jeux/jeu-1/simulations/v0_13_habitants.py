"""Habitants de La Petite Ligne 0.13: plannings, découverte des habitudes, amitié.

Source unique des tableaux de `docs/jeux/jeu-1/v0-13-habitants.md` (sections 3, 4 et 6).

Lancer (bibliothèque standard seule, graine fixe, moins de 30 s):
  python3 -I docs/jeux/jeu-1/simulations/v0_13_habitants.py                 contrôles et simulations
  python3 -I docs/jeux/jeu-1/simulations/v0_13_habitants.py --tableaux      tableaux Markdown des plannings
  python3 -I docs/jeux/jeu-1/simulations/v0_13_habitants.py --json FICHIER  plannings au format de habitants.json
  python3 -I docs/jeux/jeu-1/simulations/v0_13_habitants.py --croise DOC    relit les tableaux du document
  python3 -I docs/jeux/jeu-1/simulations/v0_13_habitants.py --croise FICHIER.json
      relit games/la-petite-ligne/donnees/habitants-0-13.json: plannings et habitudes identiques
      à la sortie --json, rumeurs, modèles et échelles, goûts, quotidien minimal, typographie
  python3 -I docs/jeux/jeu-1/simulations/v0_13_habitants.py --maj FICHIER.json
      reporte plannings, habitudes et anniversaires du script dans ce fichier (textes gardés)

Contrôles: chaque point cité est dans la liste des lieux; chaque habitant a une entrée
pour chaque minute de 6 h à 24 h, chaque jour, chaque saison et chaque temps; chaque
habitude a au moins une façon de l'apprendre par dialogue ou écriteau; aucun tiret
cadratin ni demi-cadratin dans les textes.
"""

from __future__ import annotations

import json
import os
import random
import re
import statistics
import sys
from dataclasses import dataclass, field

ICI = os.path.dirname(os.path.abspath(__file__))
RACINE = os.path.normpath(os.path.join(ICI, "..", "..", "..", ".."))
CARTE = os.path.join(RACINE, "games", "la-petite-ligne", "donnees", "cartes", "halte.json")
SEED = 20261103

JOURS = ("lu", "ma", "me", "je", "ve", "sa", "di")
NOMS_JOURS = {"lu": "lundi", "ma": "mardi", "me": "mercredi", "je": "jeudi", "ve": "vendredi", "sa": "samedi", "di": "dimanche"}
WEEKDAY_ID = {"lu": "monday", "ma": "tuesday", "me": "wednesday", "je": "thursday", "ve": "friday", "sa": "saturday", "di": "sunday"}
SAISONS = ("spring", "summer", "autumn", "winter")
NOM_SAISON = {"spring": "printemps", "summer": "été", "autumn": "automne", "winter": "hiver"}
TEMPS = ("sunny", "cloudy", "rain")
SEASON_DAYS = 21
# Jour 1 de chaque saison: un samedi (saisons de 21 jours, jour 1 du jeu = samedi).
JOUR_DE_SAISON = ("sa", "di", "lu", "ma", "me", "je", "ve")


def jour_semaine_de_saison(d: int) -> str:
    return JOUR_DE_SAISON[(d - 1) % 7]


# ---------------------------------------------------------------------------
# 1. Lieux et points
# ---------------------------------------------------------------------------
# point: (lieu, secteur, vu, note). vu: "dehors" (vu de la rue), "fenetre" (vu de la rue à
# travers une vitrine ou une fenêtre), "dedans" (vu seulement depuis le même intérieur).

POINTS: dict[str, tuple[str, str, str, str]] = {
    # Bourg ancien (existant, halte.json)
    "quay_bell": ("halte", "quai", "dehors", "la cloche du quai"),
    "quay_bench": ("halte", "quai", "dehors", "le banc du quai"),
    "train_stop": ("halte", "quai", "dehors", "l'arrêt du train"),
    "station_door": ("halte", "quai", "dehors", "la porte de la halte, sous l'auvent"),
    "firmin_house": ("firmin_house", "quai", "dehors", "la porte de Firmin, derrière la voie"),
    "village_square": ("village_square", "place", "dehors", "la place"),
    "square_lime_tree": ("village_square", "place", "dehors", "sous le tilleul de la place"),
    "well_shelter": ("village_square", "place", "dehors", "sous le toit du puits"),
    "hopscotch": ("village_square", "place", "dehors", "la marelle"),
    "grocery_door": ("grocery", "place", "dehors", "la porte de l'épicerie"),
    "grocery_terrace": ("grocery", "place", "dehors", "la tonnelle de l'épicerie"),
    "grocery_inside_counter": ("grocery", "epicerie", "dedans", "le comptoir d'Odette"),
    "grocery_table": ("grocery", "epicerie", "dedans", "la petite table de l'épicerie"),
    "grocery_customer": ("grocery", "epicerie", "dedans", "devant le comptoir"),
    "sawmill_yard": ("sawmill", "scierie", "dehors", "la cour de la scierie"),
    "basile_at_workbench": ("sawmill", "scierie", "dehors", "l'établi de Basile"),
    "riverbank": ("riverbank", "berge", "dehors", "la promenade de la berge"),
    "fishing_ford_north": ("riverbank", "berge", "dehors", "le gué, rive nord"),
    "fishing_pontoon": ("riverbank", "berge", "dehors", "le ponton"),
    "chicken_coop": ("gatekeeper_house", "maison", "dehors", "le poulailler de la maisonnette"),
    "village_exit": ("hamlets_road", "hameau", "dehors", "la route des hameaux, au bout est"),
    "offstage": ("offstage", "hors", "dedans", "hors de la carte"),
    "bakery_window": ("bakery", "rue_haute", "dehors", "le guichet du fournil"),
    "bakery_back": ("bakery", "rue_haute", "dehors", "la porte des sacs du fournil"),
    "upper_street_bench": ("upper_street", "rue_haute", "dehors", "le banc de la rue Haute"),
    "salon_counter": ("salon", "salon", "dedans", "le comptoir de la mercerie"),
    "salon_window": ("salon", "rue_haute", "fenetre", "la chaise de couture, vitrine nord"),
    "lucie_house_door": ("lucie_house", "rue_haute", "dehors", "la porte de la maison de Lucie"),
    "school_gate": ("school", "rue_haute", "dehors", "le portail de l'école"),
    # Carte 0.13 (v0-13-carte.md, section 8.1)
    "church_porch": ("church", "tertre", "dehors", "devant le portail sud de Saint-Aubin"),
    "church_square": ("church", "tertre", "dehors", "le parvis"),
    "presbytery_door": ("presbytery", "tertre", "dehors", "devant la porte du presbytère"),
    "priest_garden": ("presbytery", "tertre", "dehors", "le jardin du curé"),
    "vineyard": ("presbytery", "tertre", "dehors", "la vigne du curé"),
    "cemetery_gate": ("cemetery", "tertre", "dehors", "devant la grille du cimetière"),
    "sexton_house_door": ("sexton_house", "tertre", "dehors", "devant la maison du sacristain"),
    "cafe_door": ("cafe", "carrefour", "dehors", "devant le café de la Côte"),
    "cafe_terrace": ("cafe", "carrefour", "dehors", "la terrasse du café"),
    "forge_yard": ("forge", "carrefour", "dehors", "la cour de la forge, l'enclume"),
    "joinery_yard": ("joinery", "hameau", "dehors", "la cour de la menuiserie"),
    "hamlet_house_a_door": ("hamlet_house_a", "hameau", "dehors", "devant la maison A du hameau (Nour)"),
    "hamlet_house_c_door": ("hamlet_house_c", "hameau", "dehors", "devant la maison C du hameau (Honorine)"),
    "shared_garden_plot": ("shared_gardens", "jardins", "dehors", "un carré des jardins de la Rive"),
    "washhouse": ("washhouse", "jardins", "dehors", "le lavoir"),
    "barn_door": ("farm", "ferme", "dehors", "la porte de l'étable"),
    "farm_door": ("farm", "ferme", "dehors", "devant le logis de la ferme"),
    "farmyard": ("farm", "ferme", "dehors", "la cour de la ferme"),
    "pasture_gate": ("farm", "ferme", "dehors", "la barrière de la pâture"),
    "field_high_01": ("farm", "champs", "dehors", "le champ du Haut 1 (celui de Paulin)"),
    "mill_door": ("mill", "moulin", "dehors", "devant la porte du moulin"),
    "mill_sluice": ("mill", "moulin", "dehors", "la vanne du bief"),
    "rail_cottage_west_door": ("rail_cottage_west", "ouest", "dehors", "devant la maison de cheminots ouest (Ambroise)"),
    "forest_cut": ("forest", "bois", "dehors", "la coupe"),
    "forester_house_door": ("forester_house", "bois", "dehors", "devant la maison forestière"),
    "lookout": ("forest", "bois", "dehors", "le belvédère"),
    "clearing_center": ("forest", "bois", "dehors", "le tronc couché de la clairière du Vieux Chêne"),
    "forest_pond": ("forest", "bois", "dehors", "la mare de la Côte"),
    "spring": ("forest", "bois", "dehors", "la source"),
    # Demandés par ce document (emplacement proposé en section 1.3)
    "church_nave": ("church", "eglise", "dedans", "la nef (intérieur de la carte 0.13)"),
    "church_bell_rope": ("church", "eglise", "dedans", "la corde des cloches, au pied du clocher, au fond de la nef"),
    "cemetery_tap": ("cemetery", "tertre", "dehors", "la fontaine et les arrosoirs du cimetière"),
    "cemetery_bench": ("cemetery", "tertre", "dehors", "le banc du cimetière"),
    "grave_cornu": ("cemetery", "tertre", "dehors", "la tombe d'Hortense Cornu"),
    "grave_valade": ("cemetery", "tertre", "dehors", "la tombe d'Octave Valade"),
    "grave_ferrand": ("cemetery", "tertre", "dehors", "la tombe des Ferrand"),
    "grave_merigot": ("cemetery", "tertre", "dehors", "la tombe d'Eugénie Mérigot"),
    "grave_lacombe": ("cemetery", "tertre", "dehors", "la tombe des Lacombe"),
    "sexton_garden": ("sexton_house", "tertre", "dehors", "le jardin de dahlias de Marthe"),
    "honorine_doorstep": ("hamlet_house_c", "hameau", "dehors", "la chaise d'Honorine, sous sa glycine"),
    "honorine_window": ("hamlet_house_c", "hameau", "fenetre", "la fenêtre d'Honorine, sur la route"),
    "cafe_counter": ("cafe", "cafe", "dedans", "le comptoir du café"),
    "skittles_alley": ("cafe", "carrefour", "dehors", "l'allée de quilles de la placette"),
    "forge_inside": ("forge", "forge_int", "dedans", "le foyer et le soufflet de la forge"),
    "forge_door": ("forge", "carrefour", "dehors", "la grande porte de la forge (logis sous le toit)"),
    "vet_yard": ("hamlet_house_a", "hameau", "dehors", "l'enclos de soins de Nour"),
    "rail_cottage_west_window": ("rail_cottage_west", "ouest", "fenetre", "l'établi d'Ambroise, derrière la fenêtre"),
    "lucie_garden": ("lucie_house", "rue_haute", "dehors", "le jardinet de Lucie"),
    "school_yard": ("school", "rue_haute", "dehors", "la cour de l'école, vue du portail"),
    "school_lodging_door": ("school", "rue_haute", "dehors", "la porte du logement du maître"),
    "mairie_desk": ("school", "ecole", "dedans", "le bureau de la mairie"),
    "forest_edge_path": ("forest", "oree", "dehors", "le départ du sentier de la Côte, à la lisière"),
    "forester_bench": ("forester_house", "bois", "dehors", "le banc devant la maison forestière"),
    "charcoal_kiln": ("forest", "bois", "dehors", "la meule de Barnabé, au bord de la coupe"),
    "bird_hide": ("forest", "bois", "dehors", "la cabane des oiseaux, au bord de la mare (bâtie par une quête)"),
    "farm_garden": ("farm", "ferme", "dehors", "le courtil de la ferme, entre la route et le logis"),
    "threshing_floor": ("farm", "ferme", "dehors", "l'aire de battage, dans la cour"),
    "pasture_bank": ("farm", "ferme", "dehors", "la berge au bout de la pâture"),
    "mill_yard": ("mill", "moulin", "dehors", "la cour du moulin"),
    "mill_race_bank": ("mill", "moulin", "dehors", "la rive du bief"),
    "mill_inside": ("mill", "moulin_int", "dedans", "la salle des meules (intérieur de la carte 0.13)"),
}
CARTE_013 = {
    "church_porch", "church_square", "presbytery_door", "priest_garden", "vineyard", "cemetery_gate", "sexton_house_door",
    "cafe_door", "cafe_terrace", "forge_yard", "joinery_yard", "hamlet_house_a_door", "hamlet_house_c_door", "shared_garden_plot",
    "washhouse", "barn_door", "farm_door", "farmyard", "pasture_gate", "field_high_01", "mill_door", "mill_sluice",
    "rail_cottage_west_door", "forest_cut", "forester_house_door", "lookout", "clearing_center", "forest_pond", "spring",
}

# ---------------------------------------------------------------------------
# 2. Calendrier des jours particuliers
# ---------------------------------------------------------------------------
SPECIAL_DAYS = {
    "harvest": {"season": "summer", "days": [17, 18, 19], "nom": "Moisson au Pré-Long"},
    "threshing": {"season": "summer", "days": [19], "nom": "Battage et repas de moisson"},
    "lumignons": {"season": "autumn", "days": [16], "nom": "Dimanche des lumignons"},
    "cuite": {"seasons": {"summer": [8, 9, 10], "autumn": [3, 4, 5]}, "nom": "Cuite du charbon"},
}

# ---------------------------------------------------------------------------
# 3. Habitants
# ---------------------------------------------------------------------------


@dataclass
class Entry:
    habit: str
    days: tuple[str, ...]
    windows: tuple[tuple[int, int], ...]
    point: str
    activity: str
    cond: dict


@dataclass
class Habit:
    id: str
    label: str
    kind: str  # routine, maison, pluie, saison, jour, apres, marche, anniv
    reveals: list  # ("dit", locuteur, texte) ou ("ecriteau", id, texte)


@dataclass
class Villager:
    id: str
    name: str
    age: str
    job: str
    birthday: tuple[str, int]
    home: str
    status: str  # existe, revient, nouveau
    entries: list[Entry] = field(default_factory=list)
    habits: dict[str, Habit] = field(default_factory=dict)


def hm(s: str) -> int:
    h, m = s.split(":")
    return int(h) * 60 + int(m)


def parse_days(s: str) -> tuple[str, ...]:
    if s == "tous":
        return JOURS
    return tuple(s.split())


def parse_windows(s: str) -> tuple[tuple[int, int], ...]:
    out = []
    for part in s.split(","):
        a, b = part.split("-")
        out.append((hm(a), hm(b)))
    return tuple(out)


VILLAGERS: list[Villager] = []


def villager(id_: str, name: str, age: str, job: str, birthday: tuple[str, int], home: str, status: str) -> Villager:
    v = Villager(id_, name, age, job, birthday, home, status)
    VILLAGERS.append(v)
    return v


def H(v: Villager, hid: str, kind: str, label: str, reveals: list, entries: list) -> None:
    """Ajoute une habitude et ses entrées, dans l'ordre de priorité (la première vraie l'emporte)."""
    full = f"{v.id}_{hid}"
    v.habits[full] = Habit(full, label, kind, reveals)
    for days, windows, point, activity, *rest in entries:
        cond = rest[0] if rest else {}
        v.entries.append(Entry(full, parse_days(days), parse_windows(windows), point, activity, cond))


SCHOOL = {"school": True}  # lundi, mardi, jeudi, vendredi, hors été
DRY = {"weather_not": "rain"}
RAIN = {"weather": "rain"}
LATE = {"from_day": 16}  # rien ne change aux journées de la démo (tests épinglés)

# --- Firmin -----------------------------------------------------------------
v = villager("firmin", "Firmin Lacombe", "64 ans", "chef de halte bénévole, ancien cheminot", ("autumn", 6), "firmin_house", "existe")
H(v, "lumignons", "jour", "Au Dimanche des lumignons, il éclaire la tombe des Lacombe, de 17 h à 20 h",
  [("dit", "marthe", "Au Dimanche des lumignons, Firmin éclaire la tombe des Lacombe. Il laisse toujours une place vide sur la plaque.")],
  [("di", "17:00-20:00", "grave_lacombe", "stand", {"special": "lumignons"})])
H(v, "birthday", "anniv", "Le 6 de l'automne, son anniversaire: un gâteau sur la terrasse d'Odette, de 18 h à 21 h",
  [("dit", "odette", "Le 6 de l'automne, c'est l'anniversaire de Firmin. Je lui fais un gâteau sur ma terrasse à 18 h, et il fait semblant d'être surpris.")],
  [("tous", "18:00-21:00", "grocery_terrace", "host", {"birthday": True})])
H(v, "train", "jour", "Le samedi, sur le quai de 6 h au départ du train (17 h)",
  [("dit", "firmin", "Le samedi, je suis sur le quai avant le soleil. Le train n'attend personne, alors moi je l'attends.")],
  [("sa", "06:00-17:00", "train_stop", "wait_train", {"existing": "train_day"})])
H(v, "season_grave", "jour", "Le premier dimanche de chaque saison, à 7 h, il fleurit la tombe de ses parents",
  [("dit", "marthe", "Firmin, je le vois au cimetière le premier dimanche de chaque saison, à 7 h pile. Avant moi, ce qui m'agace.")],
  [("di", "07:00-08:00", "grave_lacombe", "stand", {"season_day": [2], **LATE})])
H(v, "summer_bench", "saison", "L'été, il prend le frais sur le banc du quai, de 18 h à 20 h",
  [("dit", "firmin", "L'été, après 18 h, je prends le frais sur le banc du quai. Les rails chantent en refroidissant.")],
  [("tous", "18:00-20:00", "quay_bench", "stand", {"season": ["summer"]})])
H(v, "manille", "routine", "Le mercredi, la manille au café de 20 h à 22 h (sur la terrasse, au comptoir s'il pleut)",
  [("dit", "basile", "Le mercredi soir, manille au café de la Côte. Firmin triche. L'abbé aussi, mais lui, il demande pardon."),
   ("dit", "colette", "Le mercredi, s'il pleut, mes joueurs de manille s'installent au comptoir. Ils font plus de bruit que la pluie.")],
  [("me", "20:00-22:00", "cafe_counter", "stand", {**RAIN, **LATE}),
   ("me", "20:00-22:00", "cafe_terrace", "stand", LATE)])
H(v, "rain", "pluie", "Sous la pluie, il garde le quai depuis la porte de la halte, de 8 h à 18 h",
  [("dit", "firmin", "Quand il pleut, je garde le quai depuis la porte. La cloche, elle, n'a pas peur de l'eau.")],
  [("tous", "08:00-18:00", "station_door", "stand", {**RAIN, **LATE})])
H(v, "lucie_bench", "apres", "Depuis le retour de Lucie, il s'assoit avec elle sur le banc du quai, de 17 h à 18 h",
  [("dit", "jeanne", "Tous les jours à 5 h du soir, ma tante va s'asseoir sur le banc du quai, à côté de Firmin. Par hasard, elle dit.")],
  [("lu ma me je ve sa", "17:00-18:00", "quay_bench", "stand", {"flag": "lucie_back"})])
H(v, "quay", "routine", "Tous les jours, à la cloche du quai, de 8 h à 18 h",
  [("dit", "firmin", "De 8 h à 6 h du soir, je suis à ma cloche. Comme Émile, et comme personne d'autre.")],
  [("tous", "08:00-18:00", "quay_bell", "stand")])
H(v, "home", "maison", "Chez lui (la maison aux tuiles rondes, derrière la voie) avant 8 h et après 18 h",
  [("dit", "firmin", "À 6 h du soir, je rentre. Ma maison est derrière la voie, celle aux tuiles rondes, au pied du bois.")],
  [("tous", "06:00-08:00,18:00-24:00", "firmin_house", "home")])

# --- Odette -----------------------------------------------------------------
v = villager("odette", "Odette Ferrand", "61 ans", "épicière et logeuse", ("summer", 5), "grocery_door", "existe")
H(v, "lumignons", "jour", "Au Dimanche des lumignons, trois bougies sur la tombe des Ferrand, de 17 h à 20 h",
  [("dit", "odette", "Au Dimanche des lumignons, je porte trois bougies à mes parents. Une pour chacun, et une pour Gustave, où qu'il soit.")],
  [("di", "17:00-20:00", "grave_ferrand", "stand", {"special": "lumignons"})])
H(v, "birthday", "anniv", "Le 5 de l'été, son anniversaire: elle ferme à 18 h et reçoit sur la terrasse jusqu'à 21 h",
  [("dit", "solange", "Le 5 de l'été, Odette fête son anniversaire sur sa terrasse. Elle ferme à 18 h: c'est le seul jour de l'année.")],
  [("tous", "18:00-21:00", "grocery_terrace", "host", {"birthday": True})])
H(v, "mass", "jour", "Le dimanche, elle ferme pour la messe, de 10 h 30 à 11 h 30",
  [("ecriteau", "grocery_sign", "Fermé pendant la messe du dimanche (10 h 30 à 11 h 30). O. F."),
   ("dit", "odette", "Le dimanche à 10 h 30, je ferme pour la messe. Une heure, pas plus: le bon Dieu sait que j'ai des clients.")],
  [("di", "10:30-11:30", "church_nave", "stand", LATE)])
H(v, "sunday_plis", "jour", "Le dimanche, mise en plis par Solange à la petite table, de 14 h à 16 h",
  [("dit", "solange", "Le dimanche à 2 h, je fais la mise en plis d'Odette, à sa petite table. Elle parle, je frise.")],
  [("di", "14:00-16:00", "grocery_table", "host")])
H(v, "sunday_terrace", "jour", "Le dimanche, tricot avec Honorine sur la terrasse, de 16 h à 18 h (s'il ne pleut pas)",
  [("dit", "honorine", "Le dimanche à 4 h, Odette et moi, on tricote sur sa terrasse. Elle tricote mal, mais elle parle bien.")],
  [("di", "16:00-18:00", "grocery_terrace", "stand", {**DRY, **LATE})])
H(v, "sunday_rest", "jour", "Le dimanche, boutique fermée de 13 h à 14 h et après 18 h",
  [("ecriteau", "grocery_sign", "Le dimanche: ouvert de 7 h à 13 h (sauf pendant la messe)."),
   ("dit", "honorine", "Le dimanche après-midi, Odette ferme boutique. C'est le seul moment où elle s'assoit.")],
  [("di", "13:00-14:00,16:00-20:00", "grocery_door", "home", LATE)])
H(v, "monday_grave", "jour", "Le lundi, de 14 h à 14 h 30, elle porte des fleurs à ses parents",
  [("ecriteau", "grocery_sign", "Le lundi: je reviens à 14 h 30. O. F."),
   ("dit", "marthe", "Le lundi à 2 h, Odette vient voir ses parents. Elle leur raconte toute la semaine, ils ne s'ennuient pas.")],
  [("lu", "14:00-14:30", "grave_ferrand", "stand", LATE)])
H(v, "summer_terrace", "saison", "L'été, sur la terrasse de 20 h à 21 h",
  [("dit", "odette", "L'été, je prends l'air sur ma terrasse après la fermeture. Le soir, tout le bourg passe devant.")],
  [("tous", "20:00-21:00", "grocery_terrace", "stand", {"season": ["summer"]})])
H(v, "market", "marche", "Le dimanche, une fois dans la matinée, elle passe à l'étal du marché",
  [("dit", "odette", "Le dimanche, je ferme boutique cinq minutes pour venir à ton étal. Pas plus: mes clients sont aussi les tiens.")],
  [])
H(v, "counter", "routine", "Tous les jours, au comptoir de 7 h à 20 h",
  [("ecriteau", "grocery_sign", "ÉPICERIE FERRAND. Ouvert tous les jours de 7 h à 20 h."),
   ("dit", "odette", "De 7 h à 20 h, je suis à mon comptoir. Après, je tire le rideau et je compte mes bocaux.")],
  [("tous", "07:00-20:00", "grocery_inside_counter", "serve")])
H(v, "home", "maison", "Chez elle, au-dessus de l'épicerie, avant 7 h et après 20 h",
  [("dit", "odette", "À 20 h, je monte. Ma chambre donne sur la place: je vois tout, même dans le noir.")],
  [("tous", "06:00-07:00,20:00-24:00", "grocery_door", "home")])

# --- Basile -----------------------------------------------------------------
v = villager("basile", "Basile Cornu", "72 ans", "menuisier retraité, scierie", ("spring", 4), "sawmill_yard", "existe")
H(v, "lumignons", "jour", "Au Dimanche des lumignons, une lanterne pour Hortense, de 17 h à 20 h",
  [("dit", "basile", "Au Dimanche des lumignons, je pose une lanterne pour Hortense. Elle avait peur du noir, alors je reste un peu.")],
  [("di", "17:00-20:00", "grave_cornu", "stand", {"special": "lumignons"})])
H(v, "birthday", "anniv", "Le 4 du printemps, son anniversaire: il va planter un chêne à la clairière du Vieux Chêne, de 8 h à 18 h",
  [("dit", "jeanne", "Le 4 du printemps, c'est l'anniversaire de Basile. Il va planter un chêne au bois. Il dit qu'il en a planté soixante-douze !")],
  [("tous", "08:00-18:00", "clearing_center", "work", {"birthday": True})])
H(v, "train", "jour", "Le samedi, au train de 9 h 30 à 16 h 30",
  [("dit", "basile", "Le samedi, je vais au train: il y a toujours une caisse que personne ne sait porter.")],
  [("sa", "09:30-16:30", "train_stop", "wait_train", {"existing": "train_day"})])
H(v, "thursday_grave", "routine", "Le jeudi, de 6 h 30 à 7 h 30, il ratisse la tombe d'Hortense",
  [("dit", "marthe", "Le jeudi, à la première heure, Basile vient voir Hortense. Ils s'étaient mariés un jeudi. Il ne dit rien, il ratisse le gravier.")],
  [("je", "06:30-07:30", "grave_cornu", "stand", LATE)])
H(v, "manille", "routine", "Le mercredi, la manille au café de 20 h à 22 h (sur la terrasse, au comptoir s'il pleut)",
  [("dit", "firmin", "Le mercredi soir, manille au café, avec Basile et l'abbé. Sur la terrasse, ou au comptoir s'il pleut.")],
  [("me", "20:00-22:00", "cafe_counter", "stand", {**RAIN, **LATE}),
   ("me", "20:00-22:00", "cafe_terrace", "stand", LATE)])
H(v, "sunday_wood", "jour", "Le dimanche, il va voir ses arbres à la coupe, de 9 h à 12 h (s'il ne pleut pas)",
  [("dit", "ines", "Le dimanche matin, Basile monte au bois voir ses arbres. Il les appelle par leur nom, et ils ne lui répondent pas, ce qui l'arrange.")],
  [("di", "09:00-12:00", "forest_cut", "stand", {**DRY, **LATE})])
H(v, "sunday_square", "jour", "Le dimanche, il taille des bouts de bois sous le tilleul de la place, de 14 h à 18 h (s'il ne pleut pas)",
  [("dit", "basile", "Le dimanche après-midi, je taille des bouts de bois sous le tilleul de la place. Ça occupe les mains.")],
  [("di", "14:00-18:00", "square_lime_tree", "stand", {**DRY, **LATE})])
H(v, "sunday_rest", "jour", "Le dimanche, l'atelier est fermé: il reste chez lui le reste du jour",
  [("dit", "odette", "Le dimanche, Basile ferme son atelier. Ne frappe pas, il fait semblant de ne pas entendre.")],
  [("di", "06:00-24:00", "sawmill_yard", "home", LATE)])
H(v, "summer_yard", "saison", "L'été, il prend le frais dans la cour de la scierie, de 18 h à 19 h 30",
  [("dit", "basile", "L'été, après l'établi, je m'assois dans la cour. L'odeur du bois chaud, ça se respire.")],
  [("tous", "18:00-19:30", "sawmill_yard", "stand", {"season": ["summer"]})])
H(v, "workbench", "routine", "À son établi de 8 h à 18 h (le dimanche aussi pendant les deux premières semaines)",
  [("dit", "basile", "À l'établi de 8 h à 6 h du soir. Le bois n'aime pas qu'on le brusque, moi non plus.")],
  [("tous", "08:00-18:00", "basile_at_workbench", "work")])
H(v, "home", "maison", "Chez lui, au-dessus de la scierie, avant 8 h et après 18 h",
  [("dit", "basile", "Le soir, je suis chez moi, au-dessus de la scierie. À mon âge, le soir commence tôt.")],
  [("tous", "06:00-08:00,18:00-24:00", "sawmill_yard", "home")])

# --- Jeanne -----------------------------------------------------------------
v = villager("jeanne", "Jeanne Ribot", "10 ans et demi", "nièce de la factrice, en séjour pour l'année", ("spring", 12), "lucie_house_door", "existe")
H(v, "birthday", "anniv", "Le 12 du printemps, son anniversaire: un goûter sur la place, de 15 h à 17 h",
  [("dit", "leon", "Le 12 du printemps, c'est l'anniversaire de Jeanne. Elle fait un goûter sur la place à 3 h. Elle a dit que tu pouvais venir.")],
  [("tous", "15:00-17:00", "village_square", "host", {"birthday": True})])
H(v, "train", "jour", "Le samedi, elle regarde le train depuis le quai, de 9 h 30 à 16 h 30",
  [("dit", "firmin", "Le samedi, Jeanne ne quitte pas le quai tant que le train est là. Elle compte les wagons, alors qu'il n'y en a que deux.")],
  [("sa", "09:30-16:30", "train_stop", "wait_train", {"existing": "train_day"})])
H(v, "recess", "routine", "Les jours de classe, récréation dans la cour à 10 h et à 14 h 30 (20 minutes)",
  [("dit", "jeanne", "À la récré de 10 h et de 2 h et demie, on joue au loup dans la cour. Léon triche, il court trop vite.")],
  [("lu ma je ve", "10:00-10:20,14:30-14:50", "school_yard", "play", {**SCHOOL, "from_day": 43})])
H(v, "school", "routine", "Les jours de classe (lundi, mardi, jeudi, vendredi, hors été), à l'école de 8 h à 16 h 30",
  [("ecriteau", "school_sign", "École de la Halte. Classe le lundi, le mardi, le jeudi et le vendredi, de 8 h 30 à 16 h 30."),
   ("dit", "armand", "Jeanne est à l'école le lundi, le mardi, le jeudi et le vendredi. Le mercredi, elle est libre comme l'air, hélas pour mes leçons.")],
  [("lu ma je ve", "08:00-16:30", "school_gate", "absent", {**SCHOOL, "from_day": 43})])
H(v, "after_school", "routine", "Les jours de classe, sur la place de 16 h 30 à 18 h 30 (sous le toit du puits s'il pleut)",
  [("dit", "solange", "Après la classe, Jeanne file sur la place. S'il pleut, elle se met sous le toit du puits avec Léon.")],
  [("lu ma je ve", "16:30-18:30", "well_shelter", "play", {**SCHOOL, "from_day": 43, **RAIN}),
   ("lu ma je ve", "16:30-18:30", "village_square", "play", {**SCHOOL, "from_day": 43})])
H(v, "hopscotch", "routine", "Le soir, la marelle de 18 h 30 à 20 h (avec ses craies, s'il ne pleut pas)",
  [("dit", "jeanne", "Le soir après 6 h et demie, je fais la marelle avec mes craies, s'il ne pleut pas. Tu sais sauter à cloche-pied ?")],
  [("tous", "18:30-20:00", "hopscotch", "play", {"existing": "chalk_box", **DRY})])
H(v, "rain", "pluie", "Sous la pluie, elle joue sous le toit du puits (ou sur le banc du quai), de 8 h à 18 h",
  [("dit", "jeanne", "Quand il pleut, je joue sous le toit du puits. Les gouttes font de la musique sur les tuiles.")],
  [("tous", "08:00-18:00", "well_shelter", "play", {"existing": "rain_well_roof"}),
   ("tous", "08:00-18:00", "quay_bench", "play", {"existing": "rain_no_roof"})])
H(v, "hide", "apres", "Depuis « La cabane des oiseaux »: le mercredi, à la cabane de la mare de 14 h à 17 h (s'il ne pleut pas)",
  [("dit", "ines", "Le mercredi, Jeanne est à sa cabane de la mare dès 2 h. Elle compte les poules d'eau et elle me corrige quand je me trompe.")],
  [("me", "14:00-17:00", "bird_hide", "play", {**DRY, "flag": "bird_hide_built"})])
H(v, "wednesday_birds", "routine", "Le mercredi, elle guette les oiseaux à l'orée avec Léon, de 14 h à 17 h (hors hiver, s'il ne pleut pas)",
  [("dit", "ines", "Le mercredi après-midi, Jeanne et Léon viennent à l'orée compter les oiseaux. Ils se disputent pour chaque mésange.")],
  [("me", "14:00-17:00", "forest_edge_path", "play", {**DRY, **LATE, "season": ["spring", "summer", "autumn"]})])
H(v, "sunday_berge", "jour", "Le dimanche, promenade sur la berge avec Solange, de 10 h à 12 h",
  [("dit", "solange", "Le dimanche matin, je promène Jeanne sur la berge, de 10 h à midi. Elle ramasse tous les galets du monde.")],
  [("di", "10:00-12:00", "riverbank", "play", {"existing": "solange_here"})])
H(v, "summer_square", "saison", "L'été, sur la place de 18 h à 21 h",
  [("dit", "jeanne", "L'été, je reste sur la place jusqu'à 9 h du soir ! Tante Lucie dit oui parce qu'il fait jour.")],
  [("tous", "18:00-21:00", "village_square", "play", {"season": ["summer"]})])
H(v, "morning_bench", "routine", "Le matin, sur le banc du quai de 8 h à 12 h",
  [("dit", "firmin", "Le matin, Jeanne s'installe sur mon banc du quai. Elle me pose des questions jusqu'à midi.")],
  [("tous", "08:00-12:00", "quay_bench", "play")])
H(v, "riverbank", "routine", "L'après-midi, au bord de l'Aubrune de 12 h à 18 h",
  [("dit", "jeanne", "L'après-midi, je suis au bord de l'Aubrune. Les galets plats, c'est là qu'ils sont.")],
  [("tous", "12:00-18:00", "riverbank", "play")])
H(v, "evening_square", "routine", "En fin d'après-midi, sur la place de 18 h à 18 h 30, puis Solange la ramène",
  [("dit", "solange", "À 6 h du soir, je descends chercher Jeanne sur la place. Elle dit toujours encore cinq minutes.")],
  [("tous", "18:00-18:30", "village_square", "play")])
H(v, "home", "maison", "Chez sa tante Lucie, en face de la mercerie, avant 8 h et après 18 h 30 (20 h avec la marelle)",
  [("dit", "jeanne", "Je dors chez tante Lucie, la maison en face de chez Solange. Ma fenêtre donne sur les pommiers.")],
  [("tous", "06:00-08:00,18:30-24:00", "lucie_house_door", "home")])

# --- Achille ----------------------------------------------------------------
v = villager("achille", "Achille Pradel", "38 ans", "boulanger", ("summer", 13), "bakery_window", "existe")
H(v, "birthday", "anniv", "Le 13 de l'été, son anniversaire: pas de sieste, il tient le guichet de 14 h à 17 h",
  [("dit", "jeanne", "Le 13 de l'été, c'est l'anniversaire d'Achille ! Il ne fait pas la sieste, et l'après-midi il donne des chouquettes au guichet.")],
  [("tous", "14:00-17:00", "bakery_window", "serve", {"birthday": True})])
H(v, "monday_pontoon", "jour", "Le lundi, le fournil est fermé: il pêche au ponton de 8 h à 12 h (chez lui s'il pleut)",
  [("ecriteau", "bakery_sign", "Fermé le lundi. Le boulanger est à la pêche."),
   ("dit", "odette", "Le lundi, Achille pêche au ponton toute la matinée. S'il pleut, il dort. S'il fait beau, il dort aussi, mais assis.")],
  [("lu", "08:00-12:00", "fishing_pontoon", "stand", DRY),
   ("lu", "06:00-12:00", "bakery_window", "home")])
H(v, "monday_terrace", "jour", "Le lundi, il déjeune sur la terrasse d'Odette de 12 h à 14 h",
  [("dit", "achille", "Le lundi midi, je déjeune sur la terrasse d'Odette. C'est le seul jour où quelqu'un me fait à manger.")],
  [("lu", "12:00-14:00", "grocery_terrace", "stand")])
H(v, "train", "jour", "Le samedi, au train de 10 h à 11 h pour ses sacs de farine",
  [("dit", "achille", "Le samedi à 10 h, je suis au train pour mes sacs de farine. Ils pèsent plus lourd que moi, ou presque.")],
  [("sa", "10:00-11:00", "train_stop", "wait_train")])
H(v, "basket", "routine", "Du mardi au dimanche, de 9 h à 9 h 30, il descend la panière chez Odette",
  [("dit", "odette", "À 9 h, Achille descend la panière chez moi. Tu peux régler ta montre dessus. Enfin, pas sur celle d'Ambroise.")],
  [("ma me je ve sa di", "09:00-09:30", "grocery_door", "stand")])
H(v, "window", "routine", "Du mardi au dimanche, au guichet de 6 h à 9 h (pain chaud) et de 9 h 30 à 12 h",
  [("ecriteau", "bakery_sign", "Pain chaud de 6 h à 9 h. Pain jusqu'à midi. Brioche le dimanche. Fermé le lundi."),
   ("dit", "achille", "Le guichet ouvre à 6 h. Le pain chaud, c'est jusqu'à 9 h; après, il est juste bon.")],
  [("ma me je ve sa di", "06:00-09:00,09:30-12:00", "bakery_window", "serve")])
H(v, "lunch", "routine", "À midi, il déjeune sur le banc de la rue Haute (avec Lucie, depuis son retour)",
  [("dit", "lucie", "À midi, Achille déjeune sur le banc de la rue Haute. Je m'assois avec lui, il me donne le quignon.")],
  [("tous", "12:00-13:00", "upper_street_bench", "stand")])
H(v, "sleep", "routine", "L'après-midi, il dort au fournil, volets fermés, de 13 h à 17 h 30",
  [("ecriteau", "bakery_sign", "Le boulanger dort de 13 h à 17 h 30. Merci de ne pas frapper. A. P."),
   ("dit", "solange", "L'après-midi, les volets du fournil sont fermés: Achille dort. Il cuit la nuit, le pauvre.")],
  [("tous", "13:00-17:30", "bakery_window", "home")])
H(v, "evening_fish", "routine", "Le soir, il pêche au gué de 17 h 30 à 19 h (sous l'auvent du fournil s'il pleut)",
  [("dit", "achille", "Le soir, de 17 h 30 à 19 h, je pêche au gué. S'il pleut, je regarde la pluie sous mon auvent: c'est presque pareil.")],
  [("tous", "17:30-19:00", "bakery_window", "stand", RAIN),
   ("tous", "17:30-19:00", "fishing_ford_north", "stand")])
H(v, "home", "maison", "Chez lui, au-dessus du fournil, après 19 h",
  [("dit", "achille", "À 7 h du soir, au lit. Le four se réveille avant moi, et il ne me laisse jamais dormir.")],
  [("tous", "06:00-24:00", "bakery_window", "home")])

# --- Solange ----------------------------------------------------------------
v = villager("solange", "Solange Mérigot", "52 ans", "coiffeuse, mercière et confection", ("autumn", 10), "salon_counter", "existe")
H(v, "lumignons", "jour", "Au Dimanche des lumignons, un lumignon pour sa mère, de 17 h à 20 h",
  [("dit", "solange", "Au Dimanche des lumignons, je pose un lumignon pour ma mère. Elle tenait la mercerie avant moi; elle aurait détesté mes rideaux.")],
  [("di", "17:00-20:00", "grave_merigot", "stand", {"special": "lumignons"})])
H(v, "birthday", "anniv", "Le 10 de l'automne, son anniversaire: elle ouvre la malle du théâtre au salon, de 18 h à 20 h",
  [("dit", "lucie", "Le 10 de l'automne, Solange a son anniversaire. Elle ouvre la malle du théâtre le soir au salon, et elle ne veut pas qu'on le sache.")],
  [("tous", "18:30-20:00", "salon_counter", "host", {"birthday": True})])
H(v, "train", "jour", "Le samedi, au train de 10 h à 10 h 45 pour ses colis de tissu",
  [("ecriteau", "salon_sign", "Le samedi, le salon ouvre à 10 h 45 (colis du train)."),
   ("dit", "solange", "Le samedi, à 10 h, je descends au train chercher mes colis de tissu. Le salon ouvre à 10 h 45, pas avant.")],
  [("sa", "10:00-10:45", "train_stop", "wait_train")])
H(v, "fetch", "routine", "Tous les jours, elle va chercher Jeanne sur la place à 18 h, puis la ramène chez Lucie",
  [("dit", "jeanne", "À 6 h, Solange vient me chercher sur la place, et on remonte ensemble. Elle marche vite pour quelqu'un qui dit qu'elle est vieille.")],
  [("tous", "18:00-18:30", "village_square", "stand"),
   ("tous", "18:30-19:00", "lucie_house_door", "stand")])
H(v, "sunday_berge", "jour", "Le dimanche, promenade sur la berge avec Jeanne, de 10 h à 12 h",
  [("dit", "jeanne", "Le dimanche matin, Solange m'emmène sur la berge. Elle dit que les galets, c'est bon pour la patience.")],
  [("di", "10:00-12:00", "riverbank", "stand")])
H(v, "sunday_plis", "jour", "Le dimanche, mise en plis d'Odette à l'épicerie, de 14 h à 16 h",
  [("dit", "odette", "Le dimanche à 2 h, Solange me frise à ma petite table. Je ressors avec dix ans de moins, pour une semaine.")],
  [("di", "14:00-16:00", "grocery_table", "stand")])
H(v, "monday_window", "jour", "Le lundi, salon fermé: elle coud à la vitrine de 10 h à 16 h",
  [("ecriteau", "salon_sign", "Le lundi, le salon est fermé. La couturière est à sa vitrine."),
   ("dit", "solange", "Le lundi, le salon est fermé, mais je couds à ma vitrine de 10 h à 4 h. Fais-moi signe en passant.")],
  [("lu", "10:00-16:00", "salon_window", "work")])
H(v, "chorale", "routine", "Le vendredi, la chorale à l'église de 20 h à 21 h 30",
  [("dit", "armand", "Le vendredi à 8 h du soir, chorale à l'église. Solange chante l'alto et corrige ma mesure, gentiment, devant tout le monde.")],
  [("ve", "20:00-21:30", "church_nave", "stand", LATE)])
H(v, "salon", "routine", "Du mardi au samedi, au salon de 9 h à 12 h et de 14 h à 18 h",
  [("ecriteau", "salon_sign", "SALON MÉRIGOT. Du mardi au samedi, 9 h à 12 h et 14 h à 18 h."),
   ("dit", "solange", "Le salon, c'est du mardi au samedi. Le matin et l'après-midi, avec une pause pour les ciseaux.")],
  [("ma me je ve sa", "09:00-12:00,14:00-18:00", "salon_counter", "serve")])
H(v, "home", "maison", "Chez elle, sous le toit de la mercerie, le reste du temps (de 12 h à 14 h, le soir et la nuit)",
  [("dit", "solange", "De midi à 2 h, je monte sous mon toit. Même les ciseaux ont besoin de souffler.")],
  [("tous", "06:00-24:00", "salon_counter", "home")])

# --- Lucie (revient) ----------------------------------------------------------
v = villager("lucie", "Lucie Arnaud", "41 ans", "factrice à vélo", ("spring", 18), "lucie_house_door", "revient")
H(v, "birthday", "anniv", "Le 18 du printemps, son anniversaire: pas de tournée l'après-midi, elle photographie la place de 14 h à 18 h",
  [("dit", "solange", "Le 18 du printemps, Lucie fête son anniversaire en photographiant tout le bourg, l'après-midi, sur la place. Souris, elle vise bien.")],
  [("tous", "14:00-18:00", "village_square", "stand", {"birthday": True})])
H(v, "darkroom", "pluie", "Les jours de pluie, de 14 h à 17 h, elle développe ses photos (chambre noire, chez elle)",
  [("dit", "lucie", "Les jours de pluie, l'après-midi, je m'enferme dans ma chambre noire. Ne frappe pas: la lumière, c'est la fin de mes photos."),
   ("dit", "jeanne", "Quand il pleut, tante Lucie fait des photos dans le noir. Je n'ai pas le droit d'entrer, même pour un biscuit.")],
  [("lu ma me je ve", "14:00-17:00", "lucie_house_door", "home", RAIN)])
H(v, "train", "jour", "Le samedi, au train de 10 h à 11 h pour les sacs postaux, puis la tournée",
  [("dit", "firmin", "Le samedi, Lucie prend les sacs postaux au train à 10 h, puis elle file aux hameaux.")],
  [("sa", "10:00-11:00", "train_stop", "wait_train")])
H(v, "sorting", "routine", "Du lundi au samedi, elle trie le courrier sur le banc du quai de 7 h à 8 h (et y laisse la sacoche du bourg)",
  [("dit", "firmin", "À 7 h, Lucie trie le courrier sur mon banc. À 8 h, elle te laisse la sacoche du bourg et elle part.")],
  [("lu ma me je ve sa", "07:00-08:00", "quay_bench", "work")])
H(v, "round", "routine", "Du lundi au vendredi, tournée des hameaux à vélo de 8 h à 12 h (le samedi de 11 h à 16 h)",
  [("dit", "lucie", "Le matin, je fais les hameaux à vélo: douze fermes, trois côtes et un chien qui me déteste.")],
  [("lu ma me je ve", "08:00-12:00", "offstage", "absent"),
   ("sa", "11:00-16:00", "offstage", "absent")])
H(v, "lunch", "routine", "Du lundi au vendredi, déjeuner sur le banc de la rue Haute avec Achille, de 12 h à 13 h",
  [("dit", "achille", "À midi, Lucie s'assoit sur mon banc. Elle me raconte les hameaux, je lui donne le quignon. C'est un bon marché.")],
  [("lu ma me je ve", "12:00-13:00", "upper_street_bench", "stand")])
H(v, "photo_lookout", "routine", "Le lundi et le mercredi, photos au belvédère de 14 h à 17 h (s'il ne pleut pas)",
  [("dit", "lucie", "L'après-midi, je photographie. Le lundi et le mercredi au belvédère, le mardi et le jeudi au ponton, le vendredi devant l'église.")],
  [("lu me", "14:00-17:00", "lookout", "stand", DRY)])
H(v, "photo_pontoon", "routine", "Le mardi et le jeudi, photos au ponton de 14 h à 17 h (s'il ne pleut pas)",
  [("dit", "lucie", "L'après-midi, je photographie. Le lundi et le mercredi au belvédère, le mardi et le jeudi au ponton, le vendredi devant l'église."),
   ("dit", "achille", "Le mardi et le jeudi, Lucie vient au ponton avec sa boîte noire. Elle fait fuir mes poissons, mais ils reviennent pour la photo.")],
  [("ma je", "14:00-17:00", "fishing_pontoon", "stand", DRY)])
H(v, "photo_church", "routine", "Le vendredi, photos devant l'église de 14 h à 17 h (s'il ne pleut pas)",
  [("dit", "lucie", "L'après-midi, je photographie. Le lundi et le mercredi au belvédère, le mardi et le jeudi au ponton, le vendredi devant l'église."),
   ("dit", "marthe", "Le vendredi, Lucie photographie mon clocher. Il n'a pas changé depuis cent ans, mais elle dit que la lumière, si.")],
  [("ve", "14:00-17:00", "church_square", "stand", DRY)])
H(v, "quay_bench", "routine", "Du lundi au samedi, sur le banc du quai avec Firmin, de 17 h à 18 h",
  [("dit", "jeanne", "Tous les jours à 5 h du soir, ma tante va s'asseoir sur le banc du quai, à côté de Firmin. Par hasard, elle dit.")],
  [("lu ma me je ve sa", "17:00-18:00", "quay_bench", "stand")])
H(v, "sunday_garden", "jour", "Le dimanche, elle bêche son jardinet de 9 h à 12 h",
  [("dit", "lucie", "Le dimanche matin, je bêche mon jardinet. Mes salades sont plus petites que les tiennes, ne le répète à personne.")],
  [("di", "09:00-12:00", "lucie_garden", "work")])
H(v, "sunday_walk", "jour", "Le dimanche, photos de galets sur la berge avec Jeanne, de 14 h à 17 h (s'il ne pleut pas)",
  [("dit", "jeanne", "Le dimanche après-midi, tante Lucie m'emmène sur la berge photographier les galets. Ils ne bougent pas, c'est pratique.")],
  [("di", "14:00-17:00", "riverbank", "stand", DRY)])
H(v, "home", "maison", "Chez elle, en face de la mercerie, le reste du temps",
  [("dit", "lucie", "J'habite en face de chez Solange. Le soir, on se parle d'une fenêtre à l'autre, comme à dix ans.")],
  [("tous", "06:00-24:00", "lucie_house_door", "home")])
# Avant son retour (quête « Le retour de Lucie »), elle est encore en longue tournée: hors carte.
# Rattachée à la tournée, en tête de liste: personne ne l'a encore rencontrée, le carnet ne l'affiche pas.
v.entries.insert(0, Entry("lucie_round", JOURS, ((6 * 60, 24 * 60),), "offstage", "absent", {"not_flag": "lucie_back"}))

# --- Armand -----------------------------------------------------------------
v = villager("armand", "Armand Castagné", "34 ans", "instituteur et secrétaire de mairie", ("autumn", 4), "school_lodging_door", "nouveau")
H(v, "birthday", "anniv", "Le 4 de l'automne, son anniversaire: il joue de l'harmonium à l'église, seul, de 18 h à 19 h",
  [("dit", "martial", "Le 4 de l'automne, Armand a son anniversaire. Il joue de l'harmonium tout seul à 18 h. Je fais semblant de ne pas l'entendre.")],
  [("tous", "18:00-19:00", "church_nave", "stand", {"birthday": True})])
H(v, "mass", "jour", "Le dimanche, à l'harmonium de la messe, de 10 h 15 à 11 h 30",
  [("dit", "martial", "Armand tient l'harmonium à la messe de 10 h 30. Il arrive à 10 h 15 pour l'accorder, et il l'accorde mal."),
   ("ecriteau", "church_sign", "Église Saint-Aubin. Messe le dimanche à 10 h 30. Chorale le vendredi à 20 h, tout le monde est bienvenu.")],
  [("di", "10:15-11:30", "church_nave", "stand")])
H(v, "chronicle", "apres", "Le dimanche, chez Honorine pour sa chronique, de 14 h à 16 h (depuis « La chronique d'Honorine »)",
  [("dit", "honorine", "Le dimanche à 2 h, le petit maître vient m'écouter sous ma glycine. Il écrit tout ce que je dis, même quand j'invente.")],
  [("di", "14:00-16:00", "honorine_doorstep", "stand", {"flag": "armand_chronicle", **DRY})])
H(v, "chorale", "routine", "Le vendredi, il dirige la chorale à l'église de 20 h à 21 h 30",
  [("dit", "armand", "Chorale le vendredi à 20 h, à l'église. Tout le monde peut venir, même ceux qui chantent comme des portes."),
   ("ecriteau", "church_sign", "Église Saint-Aubin. Messe le dimanche à 10 h 30. Chorale le vendredi à 20 h, tout le monde est bienvenu.")],
  [("ve", "20:00-21:30", "church_nave", "stand")])
H(v, "mairie", "routine", "La mairie: mardi et vendredi de 17 h à 19 h, samedi de 9 h à 12 h",
  [("ecriteau", "mairie_sign", "MAIRIE. Le mardi et le vendredi de 17 h à 19 h, le samedi de 9 h à 12 h. Le secrétaire est aussi le maître: patience."),
   ("dit", "armand", "Le mardi et le vendredi, après la classe, j'ouvre la mairie. Le samedi matin aussi. Personne ne vient, mais il faut que ce soit ouvert.")],
  [("ma ve", "17:00-19:00", "mairie_desk", "serve"),
   ("sa", "09:00-12:00", "mairie_desk", "serve")])
H(v, "gate", "routine", "Les jours de classe, au portail de l'école de 8 h à 8 h 30 et de 16 h 30 à 17 h",
  [("dit", "leon", "Le maître nous attend au portail à 8 h. S'il pleut, il a un parapluie énorme, on tient à quatre dessous.")],
  [("lu ma je ve", "08:00-08:30,16:30-17:00", "school_gate", "stand", SCHOOL)])
H(v, "recess", "routine", "Les jours de classe, il surveille la cour à 10 h et à 14 h 30 (20 minutes)",
  [("dit", "armand", "À 10 h et à 2 h et demie, récréation. Je surveille la cour et je compte les genoux écorchés.")],
  [("lu ma je ve", "10:00-10:20,14:30-14:50", "school_yard", "stand", SCHOOL)])
H(v, "class", "routine", "Les jours de classe, en classe de 8 h 30 à 16 h 30",
  [("ecriteau", "school_sign", "École de la Halte. Classe le lundi, le mardi, le jeudi et le vendredi, de 8 h 30 à 16 h 30.")],
  [("lu ma je ve", "08:30-16:30", "school_gate", "absent", SCHOOL)])
H(v, "wednesday_archives", "routine", "Le mercredi, il range les archives de la mairie de 9 h à 12 h",
  [("dit", "armand", "Le mercredi matin, je range les archives de la mairie. Il y a des registres de cent ans et des souris de deux semaines.")],
  [("me", "09:00-12:00", "mairie_desk", "work")])
H(v, "lookout", "routine", "Le mercredi (et en été, du lundi au vendredi), il dessine des fleurs au belvédère de 14 h à 18 h (s'il ne pleut pas)",
  [("dit", "lucie", "Le mercredi après-midi, Armand dessine des fleurs au belvédère. Il ne les montre à personne, sauf à moi, parce que j'insiste.")],
  [("me", "14:00-18:00", "lookout", "stand", DRY),
   ("lu ma je ve", "14:00-17:00", "lookout", "stand", {**DRY, "season": ["summer"]})])
H(v, "summer_river", "saison", "L'été, aquarelles sur la berge du lundi au vendredi, de 9 h à 12 h (s'il ne pleut pas)",
  [("dit", "jeanne", "L'été, le maître peint des aquarelles au bord de l'Aubrune. Il dit que c'est du travail. Moi aussi, je travaille, alors.")],
  [("lu ma je ve", "09:00-12:00", "riverbank", "stand", {**DRY, "season": ["summer"]})])
H(v, "home", "maison", "Chez lui, au logement du maître au-dessus de l'école, le reste du temps",
  [("dit", "armand", "J'habite au-dessus de l'école, le logement du maître. Le soir, je corrige les cahiers à la lampe.")],
  [("tous", "06:00-24:00", "school_lodging_door", "home")])

# --- Berthe -----------------------------------------------------------------
v = villager("berthe", "Berthe Lavergne", "58 ans", "meunière du moulin de la Vanne", ("winter", 7), "mill_door", "nouveau")
H(v, "birthday", "anniv", "Le 7 de l'hiver, son anniversaire: la meule chôme et elle fait des crêpes dans la cour, de 14 h à 17 h",
  [("dit", "margot", "Le 7 de l'hiver, c'est l'anniversaire de Berthe. Elle arrête la meule et elle fait des crêpes dans la cour. Paulin n'y va pas, moi si.")],
  [("tous", "14:00-17:00", "mill_yard", "host", {"birthday": True})])
H(v, "friday_flour", "apres", "Le vendredi, elle monte la farine au fournil de 14 h à 15 h (depuis « La farine de la vallée »)",
  [("dit", "achille", "Le vendredi à 2 h, Berthe monte la farine au fournil avec sa charrette. Elle refuse qu'on l'aide, puis elle accepte.")],
  [("ve", "14:00-15:00", "bakery_back", "work", {"flag": "valley_flour"})])
H(v, "weighing", "apres", "Depuis la pesée publique: le samedi, elle pèse le blé de Paulin à la bascule de la halte, de 9 h à 10 h",
  [("dit", "firmin", "Le samedi à 9 h, la meunière et Paulin pèsent le blé sur ma bascule, devant tout le monde. Ils comptent à voix haute. Moi, j'arbitre.")],
  [("sa", "09:00-10:00", "train_stop", "work", {"decision": "mouture:weighing"})])
H(v, "watch_train", "routine", "Le samedi, de 9 h à 10 h, elle regarde partir les sacs de Paulin vers la ville (jusqu'à « La part du meunier »)",
  [("dit", "honorine", "Le samedi, Berthe va au quai voir partir le blé de Paulin pour la ville. Elle ne dit rien. Ça s'entend jusque chez moi."),
   ("dit", "berthe", "Le samedi à 9 h, je vais voir partir le blé du Pré-Long au train. Moudre en ville ce qui pousse ici, je veux voir ça de mes yeux.")],
  [("sa", "09:00-10:00", "train_stop", "stand", {"not_flag": "mouture_settled"})])
H(v, "mass", "jour", "Le dimanche, la messe de 10 h 30 à 11 h 30",
  [("dit", "berthe", "Le dimanche, la meule se repose et moi je vais à la messe. Je dors au troisième rang, mais je dors bien.")],
  [("di", "10:30-11:30", "church_nave", "stand")])
H(v, "sunday_bief", "jour", "Le dimanche, au bord du bief de 14 h à 17 h (s'il ne pleut pas)",
  [("dit", "berthe", "Le dimanche après-midi, je m'assois au bord du bief. L'eau travaille pour moi six jours, je la regarde le septième.")],
  [("di", "14:00-17:00", "mill_race_bank", "stand", DRY)])
H(v, "sunday_home", "jour", "Le dimanche, chez elle le reste du jour",
  [("dit", "margot", "Le dimanche, le moulin est fermé. Berthe ne travaille pas, elle le dit à qui veut l'entendre.")],
  [("di", "06:00-24:00", "mill_door", "home")])
H(v, "lunch_cafe", "routine", "Du lundi au samedi, elle déjeune au café de 12 h à 13 h (sur la terrasse, au comptoir s'il pleut)",
  [("dit", "colette", "À midi, Berthe déjeune chez moi. Une soupe, un verre, deux nouvelles. Elle repart à une heure pile, la meule l'attend.")],
  [("lu ma me je ve sa", "12:00-13:00", "cafe_counter", "stand", RAIN),
   ("lu ma me je ve sa", "12:00-13:00", "cafe_terrace", "stand")])
H(v, "repair", "routine", "Tant que le moulin est arrêté, elle répare la roue dans la cour, de 8 h à 12 h et de 14 h à 17 h",
  [("dit", "berthe", "Mon moulin ne tourne plus depuis l'hiver. Je répare ma roue tous les jours, matin et après-midi. Elle ne m'aide pas beaucoup."),
   ("dit", "basile", "La meunière passe ses journées dans sa cour, à genoux devant sa roue. Il lui faudrait quatre mains pour la vanne.")],
  [("lu ma me je ve sa", "08:00-12:00,14:00-17:00", "mill_yard", "work", {"not_flag": "mill_running"})])
H(v, "monday_dress", "jour", "Le lundi, le moulin se tait: elle pique la meule dans la cour de 8 h à 12 h (moulin remis en marche)",
  [("dit", "berthe", "Le lundi, je rhabille la meule: un coup de marteau, une rainure. Sans ça, la farine serait du sable.")],
  [("lu", "08:00-12:00", "mill_yard", "work", {"flag": "mill_running"})])
H(v, "sluice", "routine", "Elle lève la vanne du bief à 6 h et la baisse à 17 h (moulin remis en marche, sauf le dimanche)",
  [("dit", "berthe", "À 6 h, je lève la vanne; à 5 h du soir, je la baisse. L'eau connaît l'heure mieux que moi.")],
  [("lu ma me je ve sa", "06:00-06:30,17:00-17:30", "mill_sluice", "work", {"flag": "mill_running"})])
H(v, "summer_low", "saison", "L'été, l'eau est basse: l'après-midi, elle attend au bord du bief, de 13 h à 17 h",
  [("dit", "margot", "L'été, l'après-midi, le bief est trop bas. Berthe s'assoit au bord et elle regarde l'eau comme on regarde un enfant qui traîne.")],
  [("lu ma me je ve sa", "13:00-17:00", "mill_race_bank", "stand", {"season": ["summer"], "flag": "mill_running"})])
H(v, "grind", "routine", "Du lundi au samedi, elle ensache à la porte du moulin de 6 h 30 à 12 h (moulin remis en marche)",
  [("dit", "berthe", "Le matin, je suis à la porte du moulin à ensacher. Viens tôt: à midi, je file au café et je ne parle plus de farine.")],
  [("lu ma me je ve sa", "06:30-12:00", "mill_door", "work", {"flag": "mill_running"})])
H(v, "afternoon", "routine", "L'après-midi, aux meules, dans le moulin, de 13 h à 17 h (moulin remis en marche)",
  [("dit", "berthe", "L'après-midi, je suis dedans, aux meules. Tu entendras le moulin avant de me voir.")],
  [("lu ma me je ve sa", "13:00-17:00", "mill_inside", "work", {"flag": "mill_running"})])
H(v, "home", "maison", "Chez elle, à l'étage du moulin, le reste du temps",
  [("dit", "berthe", "Le soir, je suis chez moi, à l'étage du moulin. Le bruit de l'eau, c'est ma berceuse.")],
  [("tous", "06:00-24:00", "mill_door", "home")])

# --- Martial ----------------------------------------------------------------
v = villager("martial", "Martial Roques", "63 ans", "curé de la Halte et de quatre hameaux", ("winter", 4), "presbytery_door", "nouveau")
H(v, "birthday", "anniv", "Le 4 de l'hiver, son anniversaire: il fait le tour du bourg à vélo, de 14 h à 16 h, et s'arrête sur la place",
  [("dit", "basile", "Le 4 de l'hiver, l'abbé a son anniversaire. Il fait trois fois le tour de la place à vélo pour prouver qu'il a encore ses jambes.")],
  [("tous", "14:00-16:00", "village_square", "stand", {"birthday": True})])
H(v, "sunday_parvis", "jour", "Le dimanche, il accueille sur le parvis de 10 h à 10 h 30 et salue de 11 h 30 à 12 h",
  [("dit", "martial", "Le dimanche, je suis sur le parvis à 10 h pour serrer les mains. Après la messe aussi, pour les compter.")],
  [("di", "10:00-10:30,11:30-12:00", "church_square", "stand")])
H(v, "mass", "jour", "Le dimanche, la messe de 10 h 30 à 11 h 30",
  [("ecriteau", "church_sign", "Église Saint-Aubin. Messe le dimanche à 10 h 30. Chorale le vendredi à 20 h, tout le monde est bienvenu."),
   ("dit", "marthe", "Messe à 10 h 30, le dimanche. L'abbé commence à l'heure, je l'y oblige.")],
  [("di", "10:30-11:30", "church_nave", "host")])
H(v, "sunday_hamlets", "jour", "Le dimanche après-midi, il pédale vers les hameaux, de 14 h à 18 h",
  [("dit", "lucie", "Le dimanche après-midi, l'abbé fait les hameaux à vélo, comme moi la semaine. On se croise à la côte, il me double toujours.")],
  [("di", "14:00-18:00", "offstage", "absent")])
H(v, "open", "routine", "Tous les jours, il ouvre l'église à 7 h (une demi-heure au portail)",
  [("dit", "honorine", "À 7 h, l'abbé ouvre l'église. Je l'entends tousser sur le parvis, ça me sert de réveil.")],
  [("tous", "07:00-07:30", "church_porch", "stand")])
H(v, "manille", "routine", "Le mercredi, la manille au café de 20 h à 22 h (sur la terrasse, au comptoir s'il pleut)",
  [("dit", "firmin", "Le mercredi soir, l'abbé joue à la manille avec Basile et moi, au café. Il bénit ses cartes, ce n'est pas du jeu.")],
  [("me", "20:00-22:00", "cafe_counter", "stand", RAIN),
   ("me", "20:00-22:00", "cafe_terrace", "stand")])
H(v, "rounds", "routine", "Le lundi, le mardi, le jeudi et le vendredi, tournée des hameaux à vélo, de 9 h à 17 h",
  [("dit", "martial", "Quatre hameaux, quatre jours: lundi, mardi, jeudi, vendredi. Je pars à 9 h par la route de l'est, je reviens pour 5 h."),
   ("dit", "mado", "L'abbé passe devant ma forge à 9 h, à vélo, et il me crie le temps qu'il fera. Il se trompe une fois sur deux.")],
  [("lu ma je ve", "09:00-17:00", "offstage", "absent")])
H(v, "wednesday_bike", "routine", "Le mercredi, il entretient son vélo de course devant le presbytère, de 9 h à 12 h",
  [("dit", "martial", "Le mercredi matin, je graisse mon vélo devant la porte. Trois Tours des vallées, et la chaîne d'origine !")],
  [("me", "09:00-12:00", "presbytery_door", "work")])
H(v, "vintage", "saison", "À l'automne, le samedi matin, il vendange sa vigne de 9 h à 12 h (s'il ne pleut pas)",
  [("dit", "martial", "À l'automne, le samedi matin, je vendange ma vigne. Huit rangs, un tonneau, et un vin que je ne sers qu'aux gens qui m'ont aidé.")],
  [("sa", "09:00-12:00", "vineyard", "work", {"season": ["autumn"], **DRY})])
H(v, "saturday_church", "routine", "Le samedi, il prépare l'église de 14 h à 16 h, puis s'assoit au cimetière avec Marthe jusqu'à 18 h",
  [("dit", "marthe", "Le samedi après-midi, l'abbé prépare son dimanche, puis il vient m'embêter sur mon banc. Je le laisse faire.")],
  [("sa", "14:00-16:00", "church_nave", "stand"),
   ("sa", "16:00-18:00", "cemetery_bench", "stand")])
H(v, "garden", "routine", "Au jardin des graines du presbytère, de 7 h 30 à 9 h, puis de 17 h à 19 h (et le mercredi après-midi, le samedi matin)",
  [("dit", "martial", "Mon jardin, c'est mon conservatoire: des graines que plus personne ne sème. J'y suis le matin avant de partir, et le soir en rentrant.")],
  [("lu ma me je ve sa", "07:30-09:00,17:00-19:00", "priest_garden", "work"),
   ("me", "14:00-17:00", "priest_garden", "work"),
   ("sa", "09:00-12:00", "priest_garden", "work")])
H(v, "home", "maison", "Chez lui, au presbytère, le reste du temps",
  [("dit", "martial", "Le presbytère, c'est la maison au bord du parvis, à l'ouest. Frappe fort, je suis souvent au fond du jardin.")],
  [("tous", "06:00-24:00", "presbytery_door", "home")])

# --- Marthe -----------------------------------------------------------------
v = villager("marthe", "Marthe Bousquet", "76 ans", "sacristine, sonneuse et gardienne du cimetière", ("winter", 19), "sexton_house_door", "nouveau")
H(v, "lumignons", "jour", "Au Dimanche des lumignons, elle distribue les lumignons à la grille du cimetière, de 17 h à 20 h",
  [("dit", "marthe", "Au Dimanche des lumignons, je donne un lumignon à chacun, à la grille. Les morts aiment la compagnie, et moi aussi, une fois l'an.")],
  [("di", "17:00-20:00", "cemetery_gate", "host", {"special": "lumignons"})])
H(v, "birthday", "anniv", "Le 19 de l'hiver, son anniversaire: elle sonne une volée de plus à midi",
  [("dit", "honorine", "Le 19 de l'hiver, ma sœur sonne une volée de plus à midi. C'est son anniversaire, et elle croit que personne ne le sait.")],
  [("tous", "11:30-12:30", "church_bell_rope", "work", {"birthday": True})])
H(v, "angelus", "routine", "L'angélus, tous les jours à 7 h, à midi et à 19 h (vingt minutes à la corde)",
  [("dit", "marthe", "Je sonne l'angélus à 7 h, à midi et à 7 h du soir. Depuis cinquante ans. Les cloches ne m'ont jamais attendue."),
   ("ecriteau", "church_sign_bells", "Angélus: 7 h, 12 h, 19 h. La sonneuse ne prend pas de rendez-vous.")],
  [("tous", "06:50-07:10,11:50-12:10,18:50-19:10", "church_bell_rope", "work")])
H(v, "sunday_church", "jour", "Le dimanche, à l'église de 9 h à 11 h 30 (elle prépare, puis la messe)",
  [("dit", "martial", "Le dimanche, Marthe est à l'église dès 9 h. Elle range ce que j'ai rangé la veille.")],
  [("di", "09:00-11:30", "church_nave", "work")])
H(v, "sisters_terrace", "apres", "Depuis « La robe de noces »: le dimanche, tricot chez Odette avec sa sœur, de 16 h à 18 h",
  [("dit", "odette", "Le dimanche, Marthe et Honorine tricotent sur ma terrasse, côte à côte. Quarante ans de silence, et maintenant elles ne s'arrêtent plus.")],
  [("di", "16:00-18:00", "grocery_terrace", "stand", {"flag": "sisters_reconciled", **DRY})])
H(v, "dress_walk", "apres", "Si la robe est confiée aux deux sœurs: le premier dimanche de chaque saison, de 15 h à 16 h, elles la portent ensemble sur le parvis",
  [("dit", "solange", "Le premier dimanche de chaque saison, Marthe et Honorine se passent la robe de noces sur le parvis, à 3 h. Elles la plient à quatre mains.")],
  [("di", "15:00-16:00", "church_square", "stand", {"season_day": [2], "decision": "robe:shared"})])
H(v, "sunday_bench", "jour", "Le dimanche, sur le banc du cimetière de 14 h à 17 h",
  [("dit", "marthe", "Le dimanche après-midi, je m'assois sur mon banc et je donne des nouvelles. Ils sont nombreux, ça prend du temps.")],
  [("di", "14:00-17:00", "cemetery_bench", "stand")])
H(v, "chorale", "routine", "Le vendredi, la chorale de 20 h à 21 h 30, à gauche (sa sœur à droite, jusqu'à la réconciliation)",
  [("dit", "solange", "À la chorale du vendredi, Marthe chante à gauche, Honorine à droite. Elles ne se regardent pas, mais elles chantent juste ensemble.")],
  [("ve", "20:00-21:30", "church_nave", "stand")])
H(v, "rain", "pluie", "Les jours de pluie, elle cire les bancs de l'église de 7 h 10 à 11 h 50",
  [("dit", "marthe", "Quand il pleut, je cire les bancs. Les morts n'ont pas besoin de moi sous la pluie, les bancs si.")],
  [("lu ma me je ve sa", "07:10-11:50", "church_nave", "work", RAIN)])
H(v, "cemetery", "routine", "Du lundi au samedi, elle soigne le cimetière de 7 h 10 à 11 h 50 (à la fontaine et aux arrosoirs)",
  [("dit", "basile", "Le matin, Marthe arrose ses dahlias au cimetière. Elle a le plus beau jardin du bourg, et le plus calme.")],
  [("lu ma me je ve sa", "07:10-11:50", "cemetery_tap", "work")])
H(v, "garden", "routine", "Du lundi au samedi, dans son jardin de dahlias de 14 h à 17 h (s'il ne pleut pas)",
  [("dit", "marthe", "L'après-midi, je suis dans mon jardin, derrière la maison. Que des dahlias: ma sœur fait des roses, je ne copie personne.")],
  [("lu ma me je ve sa", "14:00-17:00", "sexton_garden", "work", DRY)])
H(v, "evening_bench", "routine", "Du lundi au samedi, sur le banc du cimetière de 17 h à 18 h 50",
  [("dit", "martial", "Le soir, avant l'angélus, Marthe s'assoit sur le banc du cimetière. Elle dit qu'elle surveille. Moi, je crois qu'elle se repose.")],
  [("lu ma me je ve sa", "17:00-18:50", "cemetery_bench", "stand")])
H(v, "home", "maison", "Chez elle, la maison du sacristain au pied de l'église, le reste du temps",
  [("dit", "marthe", "J'habite la maison du sacristain, au pied de l'église. Ma sœur habite au bout de la route des hameaux. C'est loin. C'est très bien.")],
  [("tous", "06:00-24:00", "sexton_house_door", "home")])

# --- Honorine ---------------------------------------------------------------
v = villager("honorine", "Honorine Valade", "89 ans", "la doyenne du bourg", ("winter", 12), "hamlet_house_c_door", "nouveau")
H(v, "lumignons", "jour", "Au Dimanche des lumignons, sur la tombe d'Octave de 17 h à 19 h",
  [("dit", "honorine", "Au Dimanche des lumignons, je vais voir Octave avec ma bougie. Je lui dis qui s'est marié et qui a grossi.")],
  [("di", "17:00-19:00", "grave_valade", "stand", {"special": "lumignons"})])
H(v, "birthday", "anniv", "Le 12 de l'hiver, son anniversaire: tout le bourg passe sous sa fenêtre, de 14 h à 17 h",
  [("dit", "odette", "Le 12 de l'hiver, Honorine a son anniversaire. Elle reçoit à sa fenêtre et elle compte qui est venu. Elle note aussi qui n'est pas venu.")],
  [("tous", "14:00-17:00", "honorine_window", "host", {"birthday": True})])
H(v, "mass", "jour", "Le dimanche, la messe de 10 h 30 à 11 h 30",
  [("dit", "honorine", "Le dimanche, messe à 10 h 30, au premier banc. J'y suis depuis quatre-vingts ans, le banc a pris ma forme.")],
  [("di", "10:30-11:30", "church_nave", "stand")])
H(v, "dress_walk", "apres", "Si la robe est confiée aux deux sœurs: le premier dimanche de chaque saison, de 15 h à 16 h, elles la portent ensemble sur le parvis",
  [("dit", "martial", "Le premier dimanche de la saison, les sœurs Bousquet se retrouvent sur mon parvis avec la robe. Je n'ai jamais vu une procession aussi sérieuse.")],
  [("di", "15:00-16:00", "church_square", "stand", {"season_day": [2], "decision": "robe:shared"})])
H(v, "sunday_terrace", "jour", "Le dimanche, tricot chez Odette de 16 h à 18 h (s'il ne pleut pas)",
  [("dit", "odette", "Le dimanche à 4 h, Honorine vient tricoter sur ma terrasse. Elle me raconte ma mère, et je fais semblant de ne pas pleurer.")],
  [("di", "16:00-18:00", "grocery_terrace", "stand", DRY)])
H(v, "friday_grave", "routine", "Le vendredi, de 9 h à 10 h, sur la tombe d'Octave",
  [("dit", "marthe", "Le vendredi à 9 h, ma sœur va voir Octave. Je m'en vais à l'autre bout du cimetière. Elle aussi, je crois."),
   ("dit", "honorine", "Le vendredi matin, je vais voir mon Octave. Il est parti un vendredi, il aimait les choses bien rangées.")],
  [("ve", "09:00-10:00", "grave_valade", "stand")])
H(v, "thursday_shop", "routine", "Le jeudi, ses courses chez Odette de 10 h à 11 h",
  [("dit", "odette", "Le jeudi à 10 h, Honorine fait ses courses. Une heure pour trois choses: elle choisit, elle raconte, elle rechoisit.")],
  [("je", "10:00-11:00", "grocery_customer", "stand")])
H(v, "chorale", "routine", "Le vendredi, la chorale de 20 h à 21 h 30, à droite (sa sœur à gauche, jusqu'à la réconciliation)",
  [("dit", "armand", "À la chorale, Honorine a la plus belle voix et la plus vieille. Elle chante à droite, Marthe à gauche. Ne les mets jamais côte à côte.")],
  [("ve", "20:00-21:30", "church_nave", "stand")])
H(v, "candle", "routine", "Du lundi au samedi, elle allume un cierge à l'église de 8 h à 8 h 30",
  [("dit", "martial", "Chaque matin à 8 h, Honorine allume son cierge. Je lui ai dit qu'un par semaine suffisait. Elle m'a répondu qu'elle n'avait pas le temps d'attendre.")],
  [("lu ma me je ve sa", "08:00-08:30", "church_nave", "stand")])
H(v, "winter", "saison", "L'hiver, elle tricote derrière sa fenêtre au lieu du seuil",
  [("dit", "honorine", "L'hiver, je tricote derrière ma fenêtre. Je vois aussi bien, et le froid ne me voit pas.")],
  [("tous", "08:30-12:00,14:00-18:00", "honorine_window", "stand", {"season": ["winter"]})])
H(v, "rain", "pluie", "Les jours de pluie, elle tricote derrière sa fenêtre",
  [("dit", "jeanne", "Quand il pleut, Honorine tricote derrière sa fenêtre. Si tu lui fais coucou, elle lève une aiguille.")],
  [("tous", "08:30-12:00,14:00-18:00", "honorine_window", "stand", RAIN)])
H(v, "summer", "saison", "L'été, sur son seuil le matin jusqu'à 11 h, puis le soir de 17 h à 20 h",
  [("dit", "honorine", "L'été, je sors tôt et je rentre à 11 h, avant que le soleil me cuise. Je ressors à 5 h, quand il a fini.")],
  [("tous", "08:30-11:00,17:00-20:00", "honorine_doorstep", "stand", {"season": ["summer"]}),
   ("tous", "11:00-17:00", "hamlet_house_c_door", "home", {"season": ["summer"]})])
H(v, "doorstep", "routine", "Sur sa chaise, sous la glycine, de 8 h 30 à 12 h et de 14 h à 18 h",
  [("dit", "honorine", "Le matin et l'après-midi, je suis sur ma chaise, sous la glycine. Je vois passer toute la route des hameaux. Je vois même ce qu'on ne me montre pas.")],
  [("tous", "08:30-12:00,14:00-18:00", "honorine_doorstep", "stand")])
H(v, "home", "maison", "Chez elle, la dernière maison du hameau, le reste du temps (sieste de 12 h à 14 h)",
  [("dit", "honorine", "J'habite la dernière maison du hameau, celle à la glycine. De midi à deux heures, je fais la sieste. À mon âge, c'est un devoir.")],
  [("tous", "06:00-24:00", "hamlet_house_c_door", "home")])

# --- Inès -------------------------------------------------------------------
v = villager("ines", "Inès Garrigue", "36 ans", "garde forestière de la Côte", ("summer", 12), "forester_house_door", "nouveau")
H(v, "birthday", "anniv", "Le 12 de l'été, son anniversaire: elle passe la journée au belvédère, de 8 h à 18 h",
  [("dit", "nour", "Le 12 de l'été, Inès a son anniversaire. Elle monte au belvédère toute la journée et elle compte les oiseaux. C'est sa fête, elle dit.")],
  [("tous", "08:00-18:00", "lookout", "stand", {"birthday": True})])
H(v, "sunday_dawn", "jour", "Le dimanche, elle compte les oiseaux au belvédère de 6 h à 9 h",
  [("dit", "ines", "Le dimanche, à l'aube, je compte les oiseaux au belvédère. Je dis aube: 6 h. Les oiseaux, eux, sont déjà levés.")],
  [("di", "06:00-09:00", "lookout", "stand")])
H(v, "sunday_nour", "jour", "Le dimanche, thé avec Nour sur le banc de la maison forestière, de 14 h à 17 h (s'il ne pleut pas)",
  [("dit", "nour", "Le dimanche après-midi, je monte prendre le thé chez Inès, sur son banc. On se raconte les bêtes de la semaine.")],
  [("di", "14:00-17:00", "forester_bench", "stand", DRY)])
H(v, "patrol_clearing", "routine", "Le lundi et le jeudi, tournée à la clairière de 7 h à 12 h",
  [("dit", "ines", "Ma tournée change chaque jour: lundi et jeudi la clairière, mardi et vendredi la source, mercredi et samedi la coupe.")],
  [("lu je", "07:00-12:00", "clearing_center", "work")])
H(v, "patrol_spring", "routine", "Le mardi et le vendredi, tournée à la source de 7 h à 12 h",
  [("dit", "ines", "Ma tournée change chaque jour: lundi et jeudi la clairière, mardi et vendredi la source, mercredi et samedi la coupe."),
   ("dit", "barnabe", "Le mardi, Inès est à la source dès 7 h. Elle vérifie que l'eau est toujours là. Elle l'est toujours.")],
  [("ma ve", "07:00-12:00", "spring", "work")])
H(v, "patrol_coupe", "routine", "Le mercredi et le samedi, elle marque les arbres de la parcelle de coupe, de 7 h à 12 h",
  [("dit", "ines", "Ma tournée change chaque jour: lundi et jeudi la clairière, mardi et vendredi la source, mercredi et samedi la coupe.")],
  [("me sa", "07:00-12:00", "forest_cut", "work")])
H(v, "lunch", "routine", "Du lundi au samedi, elle déjeune sur le banc de la maison forestière, de 12 h à 13 h 30",
  [("dit", "ines", "À midi, je déjeune sur mon banc. Si tu viens, apporte de quoi parler, moi j'apporte de quoi manger.")],
  [("lu ma me je ve sa", "12:00-13:30", "forester_bench", "stand")])
H(v, "wednesday_kids", "routine", "Le mercredi, à l'orée avec Jeanne et Léon, de 14 h à 17 h (hors hiver, s'il ne pleut pas)",
  [("dit", "jeanne", "Le mercredi, Inès nous apprend les oiseaux à l'orée. Elle siffle comme une mésange. Léon siffle comme une bouilloire.")],
  [("me", "14:00-17:00", "forest_edge_path", "stand", {**DRY, "season": ["spring", "summer", "autumn"]})])
H(v, "with_barnabe", "routine", "Le mardi et le jeudi, à la parcelle de coupe avec Barnabé, de 14 h à 17 h",
  [("dit", "barnabe", "Le mardi et le jeudi après-midi, Inès vient voir ce que j'abats. Elle a toujours raison, c'est épuisant.")],
  [("ma je", "14:00-17:00", "forest_cut", "work")])
H(v, "rain", "pluie", "Les jours de pluie, l'après-midi, elle reste chez elle à dessiner ses cartes",
  [("dit", "ines", "Quand il pleut, l'après-midi, je reste au sec et je dessine mes cartes. Le matin, non: la pluie, c'est quand le bois parle.")],
  [("lu ma me je ve sa", "14:00-17:00", "forester_house_door", "home", RAIN)])
H(v, "maps", "routine", "Le lundi, le vendredi et le samedi, elle dessine ses cartes sur son banc, de 14 h à 17 h",
  [("dit", "nour", "L'après-midi, Inès dessine des cartes sur son banc. Elle met des points d'interrogation là où elle n'est pas encore allée.")],
  [("lu ve sa", "14:00-17:00", "forester_bench", "work")])
H(v, "shopping", "routine", "Le lundi et le jeudi, ses courses chez Odette de 17 h 30 à 18 h 30",
  [("dit", "odette", "Le lundi et le jeudi, à 5 h et demie, la garde forestière descend faire ses courses. Elle achète toujours les mêmes choses, dans le même ordre.")],
  [("lu je", "17:30-18:30", "grocery_customer", "stand")])
H(v, "home", "maison", "Chez elle, à la maison forestière, le reste du temps",
  [("dit", "ines", "J'habite la maison forestière, au bout du chemin forestier. Toit rouge, bois cordé contre le mur. On ne peut pas la rater, et pourtant certains y arrivent.")],
  [("tous", "06:00-24:00", "forester_house_door", "home")])

# --- Barnabé ----------------------------------------------------------------
v = villager("barnabe", "Barnabé Tixier", "54 ans", "bûcheron et charbonnier", ("autumn", 13), "forge_door", "nouveau")
H(v, "birthday", "anniv", "Le 13 de l'automne, son anniversaire: il chante sur la place de 18 h à 20 h",
  [("dit", "mado", "Le 13 de l'automne, Barnabé a son anniversaire. Il chante sur la place à 6 h du soir. Si on applaudit, il recommence.")],
  [("tous", "18:00-20:00", "village_square", "stand", {"birthday": True})])
H(v, "cuite", "jour", "Les jours de cuite (8 à 10 de l'été, 3 à 5 de l'automne), il ne quitte pas la meule",
  [("dit", "barnabe", "Trois jours de cuite l'été, du 8 au 10, et trois l'automne, du 3 au 5. Je dors à côté de la meule, comme on veille un malade."),
   ("dit", "mado", "Pendant les cuites, mon mari dort au bois. Je lui monte la soupe à midi, sinon il mangerait du charbon.")],
  [("tous", "06:00-24:00", "charcoal_kiln", "work", {"special": "cuite"})])
H(v, "chorale", "apres", "Depuis « La basse de la chorale »: le vendredi, il chante à l'église de 20 h à 21 h 30",
  [("dit", "armand", "Le vendredi, Barnabé chante la basse à la chorale. Les vitraux tremblent un peu. Marthe dit que c'est la première fois qu'ils servent.")],
  [("ve", "20:00-21:30", "church_nave", "stand", {"flag": "barnabe_choir"})])
H(v, "sunday_quilles", "jour", "Le dimanche, les quilles devant le café de 15 h à 18 h (s'il ne pleut pas)",
  [("dit", "paulin", "Le dimanche à 3 h, quilles devant le café: Barnabé, Mado, moi, et le petit qui ramasse. Mado gagne. Toujours.")],
  [("di", "15:00-18:00", "skittles_alley", "play", DRY)])
H(v, "rain", "pluie", "Les jours de pluie, il aide à la forge de 7 h à 17 h",
  [("dit", "barnabe", "Quand il pleut, le bois est trop glissant. Je descends à la forge tirer le soufflet pour Mado. Elle dit que je souffle mal.")],
  [("lu ma me je ve sa", "07:00-17:00", "forge_inside", "work", RAIN)])
H(v, "coupe", "routine", "Du lundi au samedi, il abat à la parcelle de coupe de 7 h à 12 h",
  [("dit", "barnabe", "Le matin, j'abats à la parcelle de l'année. Ce qu'Inès a marqué, pas un arbre de plus.")],
  [("lu ma me je ve sa", "07:00-12:00", "forest_cut", "work")])
H(v, "lunch", "routine", "Du lundi au samedi, il déjeune en chantant à la clairière, de 12 h à 13 h",
  [("dit", "ines", "À midi, Barnabé chante à la clairière. Si tu entends une basse dans le bois, c'est lui. Les chevreuils le connaissent.")],
  [("lu ma me je ve sa", "12:00-13:00", "clearing_center", "stand")])
H(v, "with_ines", "routine", "Le mardi et le jeudi, à la parcelle de coupe avec Inès, de 13 h à 17 h",
  [("dit", "ines", "Le mardi et le jeudi après-midi, je rejoins Barnabé à la parcelle. Je lui montre les arbres à garder, il fait la tête.")],
  [("ma je", "13:00-17:00", "forest_cut", "work")])
H(v, "kiln", "routine", "Le lundi, le mercredi, le vendredi et le samedi, il monte sa meule de 13 h à 17 h",
  [("dit", "barnabe", "L'après-midi, je monte ma meule, bûche après bûche, comme une maison sans porte.")],
  [("lu me ve sa", "13:00-17:00", "charcoal_kiln", "work")])
H(v, "delivery", "routine", "Le lundi et le jeudi, il livre le charbon à la forge de 17 h à 18 h",
  [("dit", "mado", "Le lundi et le jeudi, à 5 h, Barnabé me descend le charbon. C'est le seul moment où il est plus noir que moi.")],
  [("lu je", "17:00-18:00", "forge_yard", "work")])
H(v, "home", "maison", "Chez lui, sous le toit de la forge, le reste du temps",
  [("dit", "barnabe", "J'habite avec Mado, sous le toit de la forge. Le soir, j'ai les oreilles qui sonnent encore du marteau.")],
  [("tous", "06:00-24:00", "forge_door", "home")])

# --- Mado -------------------------------------------------------------------
v = villager("mado", "Madeleine Cazals, dite Mado", "50 ans", "forgeronne et maréchale", ("winter", 17), "forge_door", "nouveau")
H(v, "birthday", "anniv", "Le 17 de l'hiver, son anniversaire: la forge est éteinte, elle tient la place aux quilles de 14 h à 17 h",
  [("dit", "barnabe", "Le 17 de l'hiver, c'est l'anniversaire de Mado. La forge est éteinte, elle défie tout le bourg aux quilles, neige ou pas.")],
  [("tous", "14:00-17:00", "skittles_alley", "play", {"birthday": True})])
H(v, "monday_farm", "jour", "Le lundi, au Pré-Long de 8 h à 12 h (roues et faux des Delmas)",
  [("ecriteau", "forge_sign", "FORGE CAZALS. 7 h à 12 h, 13 h 30 à 18 h. Le lundi matin, la forgeronne est au Pré-Long."),
   ("dit", "margot", "Le lundi matin, Mado vient cercler nos roues et affûter les faux. Paulin lui prépare le café. Elle le boit comme on boit de l'eau.")],
  [("lu", "08:00-12:00", "farmyard", "work")])
H(v, "train", "jour", "Le samedi, au train de 10 h à 11 h pour ses barres de fer",
  [("dit", "mado", "Le samedi à 10 h, je prends mes barres de fer au train. Firmin me regarde les soulever et il se tient le dos.")],
  [("sa", "10:00-11:00", "train_stop", "wait_train")])
H(v, "sunday_quilles", "jour", "Le dimanche, les quilles devant le café de 15 h à 18 h (s'il ne pleut pas)",
  [("dit", "mado", "Le dimanche à 3 h, je gagne aux quilles. Viens perdre, c'est gratuit.")],
  [("di", "15:00-18:00", "skittles_alley", "play", DRY)])
H(v, "summer_siesta", "saison", "L'été, la forge est trop chaude: elle rentre de 13 h 30 à 15 h",
  [("dit", "mado", "L'été, de 1 h et demie à 3 h, je ferme. Entre le feu et le soleil, il faut choisir.")],
  [("lu ma me je ve sa", "13:30-15:00", "forge_door", "home", {"season": ["summer"]})])
H(v, "anvil", "routine", "Du lundi au samedi, à l'enclume de 7 h à 12 h et de 13 h 30 à 18 h",
  [("ecriteau", "forge_sign", "FORGE CAZALS. 7 h à 12 h, 13 h 30 à 18 h. Le lundi matin, la forgeronne est au Pré-Long."),
   ("dit", "basile", "Mado est à son enclume du matin au soir. Son père faisait pareil. Lui chantait moins faux.")],
  [("lu ma me je ve sa", "07:00-12:00,13:30-18:00", "forge_yard", "work")])
H(v, "yard", "routine", "Du lundi au samedi, elle range la cour de la forge de 18 h à 19 h",
  [("dit", "mado", "À 6 h du soir, je laisse le feu mourir et je range la cour. Le fer froid, ça se range mieux.")],
  [("lu ma me je ve sa", "18:00-19:00", "forge_yard", "stand")])
H(v, "home", "maison", "Chez elle, sous le toit de la forge, le reste du temps (déjeuner de 12 h à 13 h 30)",
  [("dit", "mado", "De midi à 1 h et demie, je déjeune à la maison. Barnabé mange au bois, alors je mange pour deux.")],
  [("tous", "06:00-24:00", "forge_door", "home")])

# --- Paulin -----------------------------------------------------------------
v = villager("paulin", "Paulin Delmas", "47 ans", "cultivateur, ferme du hameau", ("spring", 20), "farm_door", "nouveau")
H(v, "birthday", "anniv", "Le 20 du printemps, son anniversaire: il ne quitte pas son champ, Margot lui porte un gâteau à midi",
  [("dit", "leon", "Le 20 du printemps, c'est l'anniversaire de papa. Il travaille quand même. Maman lui porte un gâteau au champ, il fait semblant de râler.")],
  [("tous", "07:00-18:00", "field_high_01", "work", {"birthday": True})])
H(v, "threshing", "jour", "Le 19 de l'été, battage dans la cour de 6 h à 18 h, puis repas de moisson jusqu'à 22 h",
  [("dit", "margot", "Le 19 de l'été, on bat le blé dans la cour, et le soir, repas de moisson. Tout le bourg vient, même ceux qui n'ont rien fait.")],
  [("tous", "06:00-18:00", "threshing_floor", "work", {"special": "threshing"}),
   ("tous", "19:00-22:00", "farmyard", "host", {"special": "threshing"})])
H(v, "harvest", "jour", "Le 17 et le 18 de l'été, moisson au champ du Haut de 6 h à 20 h",
  [("dit", "paulin", "Moisson le 17 et le 18 de l'été, battage le 19. Ces trois jours-là, je ne connais plus personne.")],
  [("tous", "06:00-20:00", "field_high_01", "work", {"special": "harvest"})])
H(v, "weighing", "apres", "Depuis la pesée publique: le samedi, il pèse son blé avec Berthe à la bascule de la halte, de 9 h à 10 h",
  [("dit", "paulin", "Le samedi à 9 h, on pèse mon blé sur la bascule de Firmin, la meunière et moi. Devant témoins. Elle a toujours eu raison, c'est le pire.")],
  [("sa", "09:00-10:00", "train_stop", "work", {"decision": "mouture:weighing"})])
H(v, "watch_mill", "apres", "Depuis la mouture à façon: le jeudi, il regarde moudre son blé au moulin, de 14 h à 16 h",
  [("dit", "berthe", "Le jeudi après-midi, Paulin vient regarder sa farine sortir de ma meule. Il ne dit rien, il compte les sacs. Je lui sers un café, il le boit.")],
  [("je", "14:00-16:00", "mill_door", "stand", {"decision": "mouture:watch"})])
H(v, "train", "jour", "Le samedi, il charge ses sacs au train de 9 h à 11 h",
  [("dit", "paulin", "Le samedi, je monte mes sacs au train à 9 h: les pommes de terre pour la coopérative, et mon blé pour le moulin de la ville."),
   ("dit", "berthe", "Le samedi, Paulin envoie son blé moudre en ville. Comme si ma meule était faite pour les cailloux.")],
  [("sa", "09:00-11:00", "train_stop", "work", LATE)])
H(v, "quilles", "jour", "Le dimanche, les quilles devant le café de 15 h à 18 h (s'il ne pleut pas)",
  [("dit", "mado", "Le dimanche, Paulin joue aux quilles avec nous devant le café. Il perd en silence, c'est sa façon d'être poli.")],
  [("di", "15:00-18:00", "skittles_alley", "play", DRY)])
H(v, "sunday_home", "jour", "Le dimanche matin, il reste chez lui",
  [("dit", "margot", "Le dimanche matin, Paulin dort. C'est son seul péché, et il ne le confesse à personne.")],
  [("di", "07:00-15:00", "farm_door", "home")])
H(v, "milking", "routine", "Tous les jours, la traite à l'étable de 6 h à 7 h et de 18 h à 19 h",
  [("dit", "paulin", "6 h et 6 h du soir, la traite. Les vaches n'ont pas de dimanche, alors moi non plus, à moitié.")],
  [("tous", "06:00-07:00,18:00-19:00", "barn_door", "work")])
H(v, "rain", "pluie", "Les jours de pluie, il répare à l'étable de 7 h à 12 h et de 13 h 30 à 18 h",
  [("dit", "margot", "Quand il pleut, Paulin répare tout ce qui ne marche pas dans la grange. Et ce qui marche aussi, pour être sûr.")],
  [("lu ma me je ve sa", "07:00-12:00,13:30-18:00", "barn_door", "work", RAIN)])
H(v, "winter", "saison", "L'hiver, il travaille à la grange de 7 h à 12 h et de 13 h 30 à 18 h",
  [("dit", "paulin", "L'hiver, la terre dort. Moi, je suis à la grange: les outils, les sacs, les semences.")],
  [("lu ma me je ve sa", "07:00-12:00,13:30-18:00", "barn_door", "work", {"season": ["winter"]})])
H(v, "field", "routine", "Du printemps à l'automne, au champ du Haut de 7 h à 12 h et de 13 h 30 à 18 h",
  [("dit", "paulin", "Au printemps je plante, l'été je moissonne, à l'automne j'arrache. Tu me trouveras au champ du Haut, de l'autre côté de la voie."),
   ("dit", "leon", "Papa est au champ du Haut toute la journée. Il dit bonjour aux épis, je l'ai entendu.")],
  [("lu ma me je ve sa", "07:00-12:00,13:30-18:00", "field_high_01", "work")])
H(v, "lunch", "routine", "Du lundi au samedi, repas dans la cour de la ferme de 12 h à 13 h 30",
  [("dit", "paulin", "À midi, on mange dans la cour, sous le noyer. Tu peux venir, mais on ne parle pas la bouche pleine, et on a toujours la bouche pleine.")],
  [("lu ma me je ve sa", "12:00-13:30", "farmyard", "stand")])
H(v, "home", "maison", "Chez lui, au logis de la ferme, le soir",
  [("dit", "paulin", "Le soir, je suis à la ferme, après la menuiserie. La maison qui tourne le dos à la route: elle regarde le soleil, pas les passants.")],
  [("tous", "06:00-24:00", "farm_door", "home")])

# --- Margot -----------------------------------------------------------------
v = villager("margot", "Margot Delmas", "45 ans", "cultivatrice, ferme du hameau", ("autumn", 19), "farm_door", "nouveau")
H(v, "birthday", "anniv", "Le 19 de l'automne, son anniversaire: un goûter dans la cour de la ferme, de 15 h à 18 h",
  [("dit", "leon", "Le 19 de l'automne, c'est l'anniversaire de maman. Goûter dans la cour à 3 h. Elle fait la tarte, papa fait la vaisselle, c'est la règle.")],
  [("tous", "15:00-18:00", "farmyard", "host", {"birthday": True})])
H(v, "threshing", "jour", "Le 19 de l'été, elle prépare puis sert le repas de moisson dans la cour, de 9 h à 22 h",
  [("dit", "margot", "Le 19 de l'été, je fais à manger pour trente. Si tu viens, viens avec des bras, pas avec des fourchettes.")],
  [("tous", "09:00-22:00", "farmyard", "host", {"special": "threshing"})])
H(v, "harvest", "jour", "Le 17 et le 18 de l'été, moisson au champ du Haut de 7 h à 18 h",
  [("dit", "margot", "Pendant la moisson, je lie les gerbes derrière Paulin. Il fauche droit, je lie droit, c'est notre façon de nous dire des choses.")],
  [("tous", "07:00-18:00", "field_high_01", "work", {"special": "harvest"})])
H(v, "laundry", "routine", "Le lundi, la lessive au lavoir de 9 h à 11 h (avec Colette)",
  [("dit", "colette", "Le lundi à 9 h, lessive au lavoir avec Margot. On frotte, on rince, et on refait le bourg entier. Le linge sort propre, le bourg un peu moins.")],
  [("lu", "09:00-11:00", "washhouse", "work")])
H(v, "butter", "routine", "Le mardi et le vendredi, elle livre le beurre à Odette de 9 h à 10 h",
  [("dit", "odette", "Le mardi et le vendredi à 9 h, Margot m'apporte son beurre. Le meilleur de la vallée, et elle le sait, ce qui le rend plus cher.")],
  [("ma ve", "09:00-10:00", "grocery_door", "work")])
H(v, "mill_thursday", "routine", "Le jeudi, de 14 h à 15 h, elle prend sa farine au moulin (sans le dire à Paulin; moulin remis en marche)",
  [("dit", "berthe", "Le jeudi, Margot vient prendre sa farine au moulin. Elle dit que c'est pour les crêpes. Son mari ne sait pas. Il ne veut pas savoir.")],
  [("je", "14:00-15:00", "mill_door", "stand", {"flag": "mill_running"})])
H(v, "mass", "jour", "Le dimanche, la messe de 10 h 30 à 11 h 30, avec Léon",
  [("dit", "martial", "Le dimanche, Margot vient à la messe avec le petit. Lui s'endort au troisième rang. Je fais le sermon plus court, par charité.")],
  [("di", "10:30-11:30", "church_nave", "stand")])
H(v, "sunday_quilles", "jour", "Le dimanche, elle compte les points des quilles devant le café, de 15 h à 18 h (s'il ne pleut pas)",
  [("dit", "margot", "Le dimanche, je compte les points aux quilles. Je triche pour Paulin, Mado le sait, elle gagne quand même.")],
  [("di", "15:00-18:00", "skittles_alley", "stand", DRY)])
H(v, "chorale", "routine", "Le vendredi, la chorale à l'église de 20 h à 21 h 30",
  [("dit", "armand", "Le vendredi, Margot remonte toute la route pour la chorale, même en hiver. Elle a une voix qui porte jusqu'à la ferme.")],
  [("ve", "20:00-21:30", "church_nave", "stand")])
H(v, "milking", "routine", "Tous les jours, la traite à l'étable de 6 h à 7 h et de 18 h à 19 h",
  [("dit", "margot", "La traite, c'est 6 h et 6 h du soir, avec Paulin. Les vaches préfèrent mes mains, mais il ne faut pas le lui dire.")],
  [("tous", "06:00-07:00,18:00-19:00", "barn_door", "work")])
H(v, "poultry", "routine", "Du lundi au samedi, sa basse-cour dans la cour de 7 h à 9 h",
  [("dit", "margot", "De 7 h à 9 h, je m'occupe de mes poules. Elles sont plus bavardes que les tiennes, j'en suis sûre.")],
  [("lu ma me je ve sa", "07:00-09:00", "farmyard", "work")])
H(v, "garden", "routine", "Au courtil de la ferme de 10 h à 12 h et de 15 h à 18 h (s'il ne pleut pas)",
  [("dit", "margot", "Le courtil, devant la ferme, c'est le mien. Les champs, c'est Paulin. Mes carottes sont plus droites que ses sillons.")],
  [("lu ma me je ve sa", "10:00-12:00,15:00-18:00", "farm_garden", "work", DRY)])
H(v, "lunch", "routine", "Du lundi au samedi, repas dans la cour de 12 h à 13 h 30",
  [("dit", "paulin", "À midi, Margot met la table dans la cour, même quand il menace de pleuvoir. Le noyer protège, elle dit.")],
  [("lu ma me je ve sa", "12:00-13:30", "farmyard", "stand")])
H(v, "home", "maison", "Chez elle, au logis de la ferme, le reste du temps",
  [("dit", "margot", "Le soir, je suis à la ferme. Les jours de pluie aussi: j'ai toujours quelque chose sur le feu.")],
  [("tous", "06:00-24:00", "farm_door", "home")])

# --- Léon -------------------------------------------------------------------
v = villager("leon", "Léon Delmas", "11 ans", "écolier, fils des Delmas", ("summer", 3), "farm_door", "nouveau")
H(v, "birthday", "anniv", "Le 3 de l'été, son anniversaire: il passe l'après-midi sur le banc du quai, de 14 h à 18 h",
  [("dit", "jeanne", "Le 3 de l'été, c'est l'anniversaire de Léon. Il demande à Firmin de rester au quai tout l'après-midi. Il n'y a même pas de train.")],
  [("tous", "14:00-18:00", "quay_bench", "play", {"birthday": True})])
H(v, "harvest", "jour", "Pendant la moisson (17 au 19 de l'été), il aide de 7 h à 18 h",
  [("dit", "leon", "Pendant la moisson, je ramasse les épis tombés. Papa dit que c'est le travail le plus important. Je crois qu'il dit ça pour que je ne parte pas.")],
  [("tous", "07:00-18:00", "field_high_01", "work", {"special": "harvest"})])
H(v, "run", "routine", "Les jours de classe, il passe en courant devant la forge de 7 h 40 à 8 h",
  [("dit", "mado", "Les jours d'école, le petit Delmas passe devant ma forge à 7 h 40, en courant. Je pourrais régler l'enclume sur lui.")],
  [("lu ma je ve", "07:40-08:00", "forge_yard", "play", SCHOOL)])
H(v, "recess", "routine", "Les jours de classe, récréation dans la cour à 10 h et à 14 h 30 (20 minutes)",
  [("dit", "leon", "À la récré, je gagne au loup. Jeanne dit que je triche. C'est faux: je cours.")],
  [("lu ma je ve", "10:00-10:20,14:30-14:50", "school_yard", "play", SCHOOL)])
H(v, "school", "routine", "Les jours de classe, à l'école de 8 h à 16 h 30",
  [("ecriteau", "school_sign", "École de la Halte. Classe le lundi, le mardi, le jeudi et le vendredi, de 8 h 30 à 16 h 30."),
   ("dit", "armand", "Léon est mon élève le plus ponctuel. Il arrive à 8 h moins cinq, essoufflé, avec une chaussure délacée.")],
  [("lu ma je ve", "08:00-16:30", "school_gate", "absent", SCHOOL)])
H(v, "after_school", "routine", "Les jours de classe, sur la place de 16 h 30 à 18 h (sous le toit du puits s'il pleut)",
  [("dit", "jeanne", "Après l'école, Léon et moi, on joue sur la place jusqu'à 6 h. S'il pleut, sous le toit du puits. Il rentre traire avec son père.")],
  [("lu ma je ve", "16:30-18:00", "well_shelter", "play", {**SCHOOL, **RAIN}),
   ("lu ma je ve", "16:30-18:00", "village_square", "play", SCHOOL)])
H(v, "hide", "apres", "Depuis « La cabane des oiseaux », à deux: le mercredi, à la cabane avec Jeanne de 14 h à 17 h",
  [("dit", "jeanne", "Le mercredi après-midi, Léon et moi, on est à la cabane de la mare. On a un cahier pour deux. Il écrit mal, je dessine bien.")],
  [("me", "14:00-17:00", "bird_hide", "play", {**DRY, "decision": "cabane:shared"})])
H(v, "affut", "apres", "Depuis « La cabane des oiseaux », pour Jeanne: le mercredi, à son affût de la berge de 14 h à 17 h",
  [("dit", "leon", "Le mercredi, je suis à mon affût, au bout de la pâture. La cabane, c'est pour dessiner. Mon affût, c'est pour guetter. Ce n'est pas pareil.")],
  [("me", "14:00-17:00", "pasture_bank", "play", {**DRY, "decision": "cabane:jeanne"})])
H(v, "wednesday_birds", "routine", "Le mercredi, à l'orée avec Jeanne et Inès de 14 h à 17 h (hors hiver, s'il ne pleut pas)",
  [("dit", "leon", "Le mercredi après-midi, Inès nous apprend les oiseaux à l'orée. J'en ai vu plus que Jeanne. Elle dit que les corbeaux ne comptent pas.")],
  [("me", "14:00-17:00", "forest_edge_path", "play", {**DRY, "season": ["spring", "summer", "autumn"]})])
H(v, "train", "jour", "Le samedi, il regarde le train depuis le quai de 10 h à 16 h",
  [("dit", "firmin", "Le samedi, le petit Delmas est sur le quai à 10 h. Il veut conduire la locomotive. Je lui ai dit de commencer par la draisine.")],
  [("sa", "10:00-16:00", "train_stop", "wait_train")])
H(v, "mass", "jour", "Le dimanche, la messe de 10 h 30 à 11 h 30 (au troisième rang, souvent endormi)",
  [("dit", "leon", "Le dimanche, maman m'emmène à la messe. Je m'assois au troisième rang, c'est là qu'on dort le mieux.")],
  [("di", "10:30-11:30", "church_nave", "stand")])
H(v, "quilles", "jour", "Le dimanche, il ramasse les quilles devant le café de 15 h à 18 h (s'il ne pleut pas)",
  [("dit", "leon", "Le dimanche, je ramasse les quilles. Un jour, Mado me laissera lancer. Elle dit que c'est quand j'aurai de la moustache.")],
  [("di", "15:00-18:00", "skittles_alley", "play", DRY)])
H(v, "summer_fishing", "saison", "L'été, il pêche au bout de la pâture de 14 h à 18 h",
  [("dit", "leon", "L'été, l'après-midi, je pêche au bout de la pâture. Les loches, je les attrape à la main. Enfin, presque.")],
  [("tous", "14:00-18:00", "pasture_bank", "play", {"season": ["summer"]})])
H(v, "summer_field", "saison", "L'été, il aide au champ du Haut de 7 h à 12 h",
  [("dit", "paulin", "L'été, le petit m'aide le matin au champ. Il ramasse plus de sauterelles que d'épis.")],
  [("lu ma me je ve sa", "07:00-12:00", "field_high_01", "work", {"season": ["summer"]})])
H(v, "milking", "routine", "Tous les jours, il aide à la traite de 18 h à 19 h",
  [("dit", "leon", "À 6 h du soir, j'aide à traire. Marguerite me connaît, elle me donne un coup de queue pour dire bonjour.")],
  [("tous", "18:00-19:00", "barn_door", "work")])
H(v, "free_days", "routine", "Les jours sans classe (mercredi, vacances), à la ferme le matin de 8 h à 12 h",
  [("dit", "margot", "Les jours sans école, Léon est à la ferme le matin. Il nourrit les poules, et les poules lui apprennent la patience.")],
  [("lu ma me je ve", "08:00-12:00", "farmyard", "work")])
H(v, "home", "maison", "Chez lui, au logis de la ferme, le reste du temps",
  [("dit", "leon", "J'habite la ferme, au bout de la route. Ma chambre donne sur l'étable: ça sent la vache, mais il fait chaud.")],
  [("tous", "06:00-24:00", "farm_door", "home")])

# --- Ambroise ---------------------------------------------------------------
v = villager("ambroise", "Ambroise Pélissier", "74 ans", "ancien régleur des horloges de la compagnie, horloger et cordonnier", ("summer", 11), "rail_cottage_west_door", "nouveau")
H(v, "birthday", "anniv", "Le 11 de l'été, son anniversaire: il remonte les horloges du bourg de 14 h à 18 h, et soupire devant celle de la halte",
  [("dit", "odette", "Le 11 de l'été, Ambroise a son anniversaire. Il fait le tour du bourg pour remonter les horloges, et il s'arrête devant celle de la halte en soupirant.")],
  [("tous", "14:00-18:00", "station_door", "stand", {"birthday": True})])
H(v, "clocks_together", "apres", "Depuis la réconciliation: à 8 h, il règle la pendule avec Firmin à la cloche du quai",
  [("dit", "firmin", "À 8 h, Ambroise vient régler la pendule avec moi. Il dit qu'elle retarde. Je dis que sa montre avance. On a raison l'un et l'autre, ça nous suffit.")],
  [("lu ma me je ve sa", "08:00-08:15", "quay_bell", "stand", {"flag": "clocks_reconciled"})])
H(v, "clockcheck", "routine", "Du lundi au samedi, de 8 h à 8 h 10, il compare sa montre à la pendule de la halte et soupire",
  [("dit", "firmin", "Tous les matins à 8 h, l'horloger vient regarder ma pendule depuis la porte. Il soupire et il repart. Trente ans qu'il soupire."),
   ("dit", "ambroise", "À 8 h, je vais voir la pendule de la halte. Elle retarde d'une minute. Depuis trente ans. Quelqu'un doit bien la surveiller.")],
  [("lu ma me je ve sa", "08:00-08:10", "station_door", "stand", {"not_flag": "clocks_reconciled"})])
H(v, "manille", "apres", "Depuis la réconciliation: le mercredi, la manille au café de 20 h à 22 h",
  [("dit", "basile", "Ambroise joue à la manille avec nous, maintenant. Il compte les points à la seconde près. Firmin conteste à la minute près.")],
  [("me", "20:00-22:00", "cafe_counter", "stand", {"flag": "clocks_reconciled", **RAIN}),
   ("me", "20:00-22:00", "cafe_terrace", "stand", {"flag": "clocks_reconciled"})])
H(v, "monday_forest", "jour", "Le lundi, atelier fermé: il cueille à la lisière de 9 h à 12 h (s'il ne pleut pas)",
  [("ecriteau", "clockmaker_sign", "A. PÉLISSIER. Montres, pendules, souliers. 8 h 15 à 12 h, 14 h à 18 h. Fermé le lundi."),
   ("dit", "ambroise", "Le lundi, je ferme. Je vais cueillir à la lisière: les champignons ne sont jamais en avance, eux.")],
  [("lu", "09:00-12:00", "forest_edge_path", "stand", DRY)])
H(v, "mass", "jour", "Le dimanche, la messe de 10 h 30 à 11 h 30 (il vérifie que l'abbé commence à l'heure)",
  [("dit", "martial", "Ambroise vient à la messe le dimanche. Il sort sa montre à 10 h 30 pile. Si je suis en retard, il la secoue.")],
  [("di", "10:30-11:30", "church_nave", "stand")])
H(v, "shop", "routine", "Du mardi au samedi, à l'établi derrière sa fenêtre de 8 h 15 à 12 h et de 14 h à 18 h",
  [("ecriteau", "clockmaker_sign", "A. PÉLISSIER. Montres, pendules, souliers. 8 h 15 à 12 h, 14 h à 18 h. Fermé le lundi."),
   ("dit", "solange", "L'horloger est derrière sa fenêtre du matin au soir, la loupe à l'œil. Il me répare mes ciseaux; je lui coupe ce qu'il lui reste de cheveux.")],
  [("ma me je ve sa", "08:15-12:00,14:00-18:00", "rail_cottage_west_window", "work")])
H(v, "newspaper", "routine", "Le soir, il lit le journal sur le banc du quai de 18 h à 19 h, quand Firmin est rentré (s'il ne pleut pas)",
  [("dit", "lucie", "À 6 h du soir, Firmin quitte le quai et Ambroise s'assoit sur son banc avec le journal du samedi. Ils ne s'y croisent jamais. Exprès.")],
  [("tous", "18:00-19:00", "quay_bench", "stand", DRY)])
H(v, "home", "maison", "Chez lui, à la maison de cheminots de l'ouest, le reste du temps",
  [("dit", "ambroise", "J'habite la maison de cheminots de l'ouest: la compagnie me l'a laissée. Quarante pendules, qui sonnent toutes à la même seconde. Sauf une, pour le principe.")],
  [("tous", "06:00-24:00", "rail_cottage_west_door", "home")])

# --- Nour -------------------------------------------------------------------
v = villager("nour", "Nour Belkacem", "31 ans", "vétérinaire de campagne", ("spring", 7), "hamlet_house_a_door", "nouveau")
H(v, "birthday", "anniv", "Le 7 du printemps, son anniversaire: pas de tournée, elle déjeune longtemps chez Odette, de 12 h à 15 h",
  [("dit", "ines", "Le 7 du printemps, Nour a son anniversaire. Elle s'accorde trois heures de déjeuner chez Odette. Le reste de l'année, elle mange debout.")],
  [("tous", "12:00-15:00", "grocery_terrace", "stand", {"birthday": True})])
H(v, "duo_visit", "apres", "Depuis « La visite de Nour »: le jeudi, de 8 h à 9 h, elle passe voir tes bêtes",
  [("dit", "nour", "Le jeudi à 8 h, je passe voir tes poules, et ta chèvre si tu en as une. Ne range rien, je veux voir comment elles vivent.")],
  [("je", "08:00-09:00", "chicken_coop", "work", {"flag": "nour_visits"})])
H(v, "rounds", "routine", "Le lundi, le mercredi et le vendredi, tournée des hameaux à vélo de 8 h à 12 h",
  [("dit", "nour", "Lundi, mercredi, vendredi: les hameaux, à vélo. Je pars à 8 h par la route de l'est, en même temps que Lucie. On fait la course jusqu'au virage."),
   ("dit", "lucie", "Le lundi, le mercredi et le vendredi, Nour part avec moi à 8 h. Elle me bat à la côte. Je la bats à la descente.")],
  [("lu me ve", "08:00-12:00", "offstage", "absent")])
H(v, "farm", "routine", "Le mardi, à l'étable de la ferme de 8 h à 12 h",
  [("dit", "margot", "Le mardi matin, la vétérinaire vient voir nos vaches. Elle leur parle en arabe, elles adorent.")],
  [("ma", "08:00-12:00", "barn_door", "work")])
H(v, "consult_morning", "routine", "Le jeudi et le samedi, consultations au cabinet de 9 h à 12 h (dès 8 h le samedi)",
  [("ecriteau", "vet_sign", "N. BELKACEM, VÉTÉRINAIRE. Consultations de 14 h à 17 h du lundi au samedi, et le jeudi et le samedi matin. En cas d'urgence, sonnez fort."),
   ("dit", "nour", "Le jeudi et le samedi matin, je reçois au cabinet. Les autres matins, je suis sur les routes.")],
  [("sa", "08:00-12:00", "hamlet_house_a_door", "serve"),
   ("je", "09:00-12:00", "hamlet_house_a_door", "serve")])
H(v, "yard", "routine", "Tous les jours, elle soigne ses pensionnaires dans l'enclos de 7 h à 8 h",
  [("dit", "nour", "À 7 h, je soigne mes pensionnaires dans l'enclos. En ce moment: un hérisson grognon et un geai qui imite la sonnette.")],
  [("tous", "07:00-08:00", "vet_yard", "work")])
H(v, "lunch", "routine", "Du lundi au samedi, elle déjeune en pension chez Odette de 12 h à 13 h (sur la terrasse, à l'intérieur s'il pleut)",
  [("dit", "odette", "À midi, la vétérinaire déjeune chez moi, en pension. Elle mange vite et elle parle vite, je n'ai jamais le dernier mot.")],
  [("lu ma me je ve sa", "12:00-13:00", "grocery_table", "stand", RAIN),
   ("lu ma me je ve sa", "12:00-13:00", "grocery_terrace", "stand")])
H(v, "consult", "routine", "Du lundi au samedi, consultations au cabinet de 14 h à 17 h",
  [("ecriteau", "vet_sign", "N. BELKACEM, VÉTÉRINAIRE. Consultations de 14 h à 17 h du lundi au samedi, et le jeudi et le samedi matin. En cas d'urgence, sonnez fort.")],
  [("lu ma me je ve sa", "14:00-17:00", "hamlet_house_a_door", "serve")])
H(v, "walk", "routine", "Du lundi au samedi, elle se promène sur la berge de 17 h à 18 h (s'il ne pleut pas)",
  [("dit", "nour", "À 5 h, je marche une heure sur la berge. Sinon je ne vois que des étables. C'est joli, une étable, mais pas toute la journée.")],
  [("lu ma me je ve sa", "17:00-18:00", "riverbank", "stand", DRY)])
H(v, "sunday_ines", "jour", "Le dimanche, thé chez Inès de 14 h à 17 h (s'il ne pleut pas)",
  [("dit", "ines", "Le dimanche après-midi, Nour monte prendre le thé chez moi. Elle parle pour deux, ça m'arrange.")],
  [("di", "14:00-17:00", "forester_bench", "stand", DRY)])
H(v, "market", "marche", "Le dimanche, une fois dans la matinée, elle passe à l'étal du marché",
  [("dit", "nour", "Le dimanche, je dors jusqu'à 10 h, puis je viens à ton étal. S'il reste du fromage, la semaine est réussie.")],
  [])
H(v, "home", "maison", "Chez elle, la première maison du hameau, le reste du temps",
  [("dit", "nour", "J'habite la première maison du hameau, après la menuiserie. La plaque de l'ancien notaire est encore à la porte: on vient pour un testament, on repart avec un vermifuge.")],
  [("tous", "06:00-24:00", "hamlet_house_a_door", "home")])

# --- Colette ----------------------------------------------------------------
v = villager("colette", "Colette Lafon", "44 ans", "cafetière du café de la Côte", ("spring", 14), "cafe_door", "nouveau")
H(v, "birthday", "anniv", "Le 14 du printemps, son anniversaire: elle joue de l'accordéon sur la terrasse de 20 h à 23 h",
  [("dit", "odette", "Le 14 du printemps, Colette a son anniversaire. Elle sort l'accordéon de son oncle sur la terrasse. Je ne danse pas, mais je tape du pied.")],
  [("tous", "20:00-23:00", "cafe_terrace", "host", {"birthday": True})])
H(v, "tuesday_garden", "jour", "Le mardi, café fermé: elle soigne son carré aux jardins de la Rive, de 9 h à 12 h",
  [("ecriteau", "cafe_sign", "CAFÉ DE LA CÔTE. 7 h à 12 h et 16 h à 23 h. Le dimanche, dès la sortie de la messe. Fermé le mardi."),
   ("dit", "colette", "Le mardi, je ferme. Je bêche mon carré aux jardins de la Rive, et je ne sers personne, pas même un verre d'eau.")],
  [("ma", "09:00-12:00", "shared_garden_plot", "work", DRY)])
H(v, "tuesday_accordion", "jour", "Le mardi soir, elle s'exerce à l'accordéon sur la terrasse, de 20 h à 21 h (s'il ne pleut pas)",
  [("dit", "basile", "Le mardi soir, Colette répète à l'accordéon sur sa terrasse. Elle se trompe toujours au même endroit, c'est comme une horloge.")],
  [("ma", "20:00-21:00", "cafe_terrace", "stand", DRY)])
H(v, "tuesday_home", "jour", "Le mardi, chez elle le reste du jour",
  [("dit", "firmin", "Le mardi, le café est fermé. Si tu as soif, Odette a de l'eau, et moi j'ai un banc.")],
  [("ma", "06:00-24:00", "cafe_door", "home")])
H(v, "laundry", "routine", "Le lundi, la lessive au lavoir de 9 h à 11 h (avec Margot); le café ouvre à 11 h",
  [("dit", "margot", "Le lundi matin, Colette lave ses nappes au lavoir avec moi. Elle chante, je frotte. Ou le contraire."),
   ("ecriteau", "cafe_sign", "Le lundi, le café ouvre à 11 h (jour de lessive).")],
  [("lu", "09:00-11:00", "washhouse", "work"),
   ("lu", "07:00-09:00", "cafe_door", "home")])
H(v, "manille", "routine", "Le mercredi soir, elle sert la manille sur la terrasse (au comptoir s'il pleut), de 20 h à 22 h",
  [("dit", "colette", "Le mercredi soir, Firmin, Basile et l'abbé jouent à la manille chez moi. Je sers, je compte, et je ne dis jamais qui triche.")],
  [("me", "20:00-22:00", "cafe_counter", "serve", RAIN),
   ("me", "20:00-22:00", "cafe_terrace", "serve")])
H(v, "sunday_terrace", "jour", "Le dimanche, elle sert en terrasse après la messe (11 h 30 à 14 h) et pendant les quilles (15 h à 19 h)",
  [("dit", "colette", "Le dimanche, j'ouvre à la sortie de la messe. L'après-midi, je sers les joueurs de quilles. Les perdants paient, c'est la tradition.")],
  [("di", "11:30-14:00,15:00-19:00", "cafe_terrace", "serve", DRY)])
H(v, "sunday_rest", "jour", "Le dimanche matin, café fermé jusqu'à la sortie de la messe",
  [("ecriteau", "cafe_sign", "CAFÉ DE LA CÔTE. 7 h à 12 h et 16 h à 23 h. Le dimanche, dès la sortie de la messe. Fermé le mardi.")],
  [("di", "06:00-11:30", "cafe_door", "home")])
H(v, "summer_terrace", "saison", "L'été, elle sert en terrasse de 18 h à 23 h (s'il ne pleut pas)",
  [("dit", "colette", "L'été, le soir, je sors les tables sur la terrasse. Le café se remplit quand le soleil se couche.")],
  [("tous", "18:00-23:00", "cafe_terrace", "serve", {"season": ["summer"], **DRY})])
H(v, "counter", "routine", "Au comptoir de 7 h à 12 h et de 16 h à 23 h (le lundi dès 11 h)",
  [("ecriteau", "cafe_sign", "CAFÉ DE LA CÔTE. 7 h à 12 h et 16 h à 23 h. Le dimanche, dès la sortie de la messe. Fermé le mardi."),
   ("dit", "colette", "Le café ouvre à 7 h pour ceux qui partent tôt et ferme à 23 h pour ceux qui rentrent tard. Entre midi et 4 h, je dors un peu.")],
  [("tous", "07:00-12:00,16:00-23:00", "cafe_counter", "serve")])
H(v, "home", "maison", "Chez elle, à l'étage du café, le reste du temps",
  [("dit", "colette", "J'habite au-dessus du café, la fenêtre sur le carrefour. Je m'endors avec le bruit des derniers verres.")],
  [("tous", "06:00-24:00", "cafe_door", "home")])

# ---------------------------------------------------------------------------
# 3 bis. Rumeurs (lot H4)
# ---------------------------------------------------------------------------
# Pour les quinze habitants qui arrivent en 0.13 (Lucie et les quatorze nouveaux), chaque
# habitude a au moins une réplique dite par un autre habitant: c'est elle que le rattrapage
# (section 4.8) fait dire. Gardées à part des tableaux 3.2 pour ne pas changer la simulation de
# la découverte (section 8); l'export JSON les ajoute à la suite des `reveals` de l'habitude.
RUMEURS: dict[tuple[str, str], list[tuple[str, str]]] = {
    ("lucie", "round"): [("odette", "Du lundi au vendredi, Lucie part aux hameaux à 8 h et revient pour midi. Le samedi, c'est après le train, jusqu'à 4 h. Elle rapporte plus de nouvelles que de lettres.")],
    ("lucie", "photo_lookout"): [("armand", "Le lundi et le mercredi après-midi, Lucie monte au belvédère avec son appareil, s'il ne pleut pas. Le mercredi, elle me trouve à mes fleurs. Je cache mon carnet, elle me photographie quand même.")],
    ("lucie", "sunday_garden"): [("solange", "Le dimanche matin, Lucie bêche son jardinet. Je la regarde de ma fenêtre: elle plante tout de travers, et ça pousse quand même.")],
    ("lucie", "home"): [("jeanne", "Tante Lucie habite en face de la mercerie de Solange. C'est chez moi aussi, cette année.")],
    ("armand", "chorale"): [("margot", "Le vendredi à 8 h du soir, Armand dirige la chorale à l'église. Il bat la mesure avec un crayon. Quand on chante trop fort, il le casse.")],
    ("armand", "mairie"): [("odette", "La mairie ouvre le mardi et le vendredi de 5 h à 7 h du soir, et le samedi matin. C'est Armand qui tient le bureau, entre deux cahiers à corriger.")],
    ("armand", "recess"): [("leon", "À la récré de 10 h et de 2 h et demie, le maître surveille la cour. Il compte les genoux écorchés. Les miens comptent double.")],
    ("armand", "class"): [("leon", "Les jours d'école, le maître fait la classe de 8 h et demie à 4 h et demie. Le mercredi, non. Et l'été, jamais !")],
    ("armand", "wednesday_archives"): [("honorine", "Le mercredi matin, le petit maître range les archives de la mairie. Il en ressort avec de la poussière jusqu'aux sourcils et l'air d'avoir trouvé un trésor.")],
    ("armand", "home"): [("colette", "Armand loge au-dessus de l'école, juste à côté de chez moi. Sa lampe reste allumée tard: il corrige, ou il écrit, il ne veut pas dire quoi.")],
    ("berthe", "mass"): [("martial", "Berthe vient à la messe le dimanche à 10 h 30, au troisième rang. Elle s'endort au sermon, et elle ronfle juste.")],
    ("berthe", "sunday_bief"): [("margot", "Le dimanche après-midi, Berthe s'assoit au bord du bief, s'il ne pleut pas. Elle regarde l'eau comme d'autres regardent le feu.")],
    ("berthe", "monday_dress"): [("mado", "Le lundi matin, la meunière pique sa meule dans la cour du moulin. Un coup, une rainure: on l'entend jusqu'à la friche.")],
    ("berthe", "sluice"): [("basile", "Berthe lève la vanne du bief à 6 h et la baisse à 5 h du soir. Sauf le dimanche: l'eau aussi a droit au repos.")],
    ("berthe", "grind"): [("achille", "Le matin, jusqu'à midi, Berthe ensache à la porte du moulin. Si tu passes par là, salue-la de ma part. Moi, à cette heure-là, je suis au guichet.")],
    ("berthe", "afternoon"): [("margot", "L'après-midi, Berthe est dedans, aux meules, jusqu'à 5 h. Ne frappe pas: crie. Elle criera plus fort.")],
    ("berthe", "home"): [("colette", "Berthe vit à l'étage du moulin, au bout du chemin de la maisonnette. Elle dit que le bruit de l'eau l'endort. Moi, il me tiendrait éveillée toute la nuit.")],
    ("martial", "sunday_parvis"): [("honorine", "Le dimanche, l'abbé est sur son parvis dès 10 h pour serrer les mains, et encore à la sortie, jusqu'à midi. Il les compte, je crois. Il en manque toujours une ou deux.")],
    ("martial", "wednesday_bike"): [("mado", "Le mercredi matin, l'abbé graisse son vélo devant le presbytère. Il me demande conseil, et il ne le suit jamais.")],
    ("martial", "vintage"): [("colette", "À l'automne, le samedi matin, l'abbé vendange sa vigne, s'il fait sec. Il paie en vin. Personne ne le boit, et tout le monde y va.")],
    ("martial", "garden"): [("marthe", "L'abbé est à son jardin de graines le matin avant sa tournée et le soir en rentrant, plus le mercredi après-midi et le samedi matin. Il parle à ses sachets. Moi, je parle aux morts. Nous sommes quittes.")],
    ("martial", "home"): [("odette", "Le presbytère, c'est la maison au bord du parvis, côté ouest. L'abbé n'y est presque jamais: frappe, puis va voir au fond du jardin.")],
    ("marthe", "lumignons"): [("honorine", "Au Dimanche des lumignons, ma sœur se tient à la grille du cimetière de 5 h à 8 h du soir, et elle donne un lumignon à qui passe. Elle ne m'en a jamais donné. Je le prends quand même.")],
    ("marthe", "angelus"): [("firmin", "Marthe sonne l'angélus à 7 h, à midi et à 7 h du soir, vingt minutes à la corde. Ma pendule et sa cloche ne sont jamais d'accord.")],
    ("marthe", "sunday_bench"): [("martial", "Le dimanche, de 2 h à 5 h, Marthe s'assoit sur le banc du cimetière. Elle donne des nouvelles à tout le monde, et elle n'oublie personne.")],
    ("marthe", "rain"): [("odette", "Quand il pleut, Marthe cire les bancs de l'église toute la matinée. Ça sent la cire jusqu'au carrefour.")],
    ("marthe", "garden"): [("solange", "L'après-midi, s'il ne pleut pas, Marthe est dans son jardin de dahlias, derrière sa maison. Elle les taille comme moi les cheveux: à la règle.")],
    ("marthe", "home"): [("firmin", "Marthe habite la maison du sacristain, au pied de l'église. Elle ouvre la porte avant qu'on frappe. Je n'ai jamais su comment.")],
    ("honorine", "lumignons"): [("marthe", "Au Dimanche des lumignons, ma sœur va voir Octave de 5 h à 7 h. Elle porte une bougie trop grosse. Elle a toujours tout fait trop gros.")],
    ("honorine", "mass"): [("martial", "Honorine est à la messe chaque dimanche, au premier banc. Elle répond avant moi: elle connaît le texte depuis quatre-vingts ans.")],
    ("honorine", "winter"): [("odette", "L'hiver, Honorine ne sort plus sur son seuil: elle tricote derrière sa fenêtre. Fais-lui signe en passant, elle te répondra avec ses aiguilles.")],
    ("honorine", "summer"): [("lucie", "L'été, Honorine sort sur son seuil de bonne heure, rentre à 11 h et ressort à 5 h du soir. Je lui laisse son journal sur la chaise, elle me laisse un biscuit.")],
    ("honorine", "doorstep"): [("nour", "Honorine est sur sa chaise, sous la glycine, de 8 h et demie à midi et de 2 h à 6 h. Je passe devant dix fois par jour. Elle compte, j'en suis sûre.")],
    ("honorine", "home"): [("odette", "Honorine habite la dernière maison du hameau, celle à la glycine. De midi à 2 h, elle fait la sieste: ne frappe pas, elle ferait semblant de ne pas avoir dormi.")],
    ("ines", "sunday_dawn"): [("barnabe", "Le dimanche, à 6 h, Inès est déjà au belvédère. Elle compte les oiseaux jusqu'à 9 h. Une fois, elle m'a compté aussi.")],
    ("ines", "patrol_clearing"): [("basile", "Le lundi et le jeudi matin, la garde fait sa tournée à la clairière du Vieux Chêne. Elle salue le vieux chêne. Moi aussi, d'ailleurs.")],
    ("ines", "patrol_coupe"): [("barnabe", "Le mercredi et le samedi matin, Inès marque les arbres de la coupe. Un trait de peinture, et l'arbre est sauvé. Ou c'est le contraire: je ne sais jamais.")],
    ("ines", "lunch"): [("nour", "À midi, du lundi au samedi, Inès déjeune sur le banc devant la maison forestière, jusqu'à 1 h et demie. Elle partage son pain avec les mésanges.")],
    ("ines", "rain"): [("barnabe", "Quand il pleut, l'après-midi, Inès reste chez elle à dessiner ses cartes. Elle dit que le bois se garde tout seul sous la pluie.")],
    ("ines", "home"): [("odette", "La garde forestière habite la maison forestière, au bout du chemin forestier, celle au toit rouge. Elle descend chez moi deux fois par semaine, et c'est tout ce que je sais d'elle. Ça m'agace.")],
    ("barnabe", "rain"): [("mado", "Quand il pleut, Barnabé descend à la forge de 7 h à 5 h du soir et tire mon soufflet. Il chante pour garder le rythme. Le soufflet et lui, c'est la même basse.")],
    ("barnabe", "coupe"): [("ines", "Du lundi au samedi, le matin, Barnabé abat à la parcelle de coupe. Ce que j'ai marqué, rien de plus. Il chante, pour s'excuser auprès des arbres.")],
    ("barnabe", "kiln"): [("leon", "Le lundi, le mercredi, le vendredi et le samedi après-midi, Barnabé monte sa meule de charbon. Il m'a laissé poser une bûche. Une seule, mais quand même !")],
    ("barnabe", "home"): [("colette", "Barnabé habite avec Mado sous le toit de la forge. Le soir, on l'entend chanter par la lucarne. Mes clients se taisent pour écouter.")],
    ("mado", "train"): [("firmin", "Le samedi à 10 h, Mado vient prendre ses barres de fer au train. Elle les soulève comme du pain. Je préfère regarder ailleurs.")],
    ("mado", "sunday_quilles"): [("colette", "Le dimanche, de 3 h à 6 h, quilles devant mon café, s'il ne pleut pas. Mado gagne, les autres paient la tournée. C'est la règle.")],
    ("mado", "summer_siesta"): [("basile", "L'été, Mado ferme la forge de 1 h et demie à 3 h. Entre le feu et le soleil, même le fer souffle. Elle aussi, mais elle ne le dira pas.")],
    ("mado", "yard"): [("barnabe", "À 6 h du soir, Mado range la cour de la forge, jusqu'à 7 h. Je l'aide à porter. Elle me dit où poser. Je pose à côté.")],
    ("mado", "home"): [("honorine", "Mado et son grand mari vivent sous le toit de la forge. À midi, elle remonte déjeuner jusqu'à 1 h et demie: ça s'entend, elle chante dans l'escalier.")],
    ("paulin", "harvest"): [("margot", "Le 17 et le 18 de l'été, Paulin moissonne au champ du Haut de 6 h à 8 h du soir. Il ne mange presque rien. Je lui porte la soupe quand même.")],
    ("paulin", "weighing"): [("firmin", "Le samedi à 9 h, Paulin pèse son blé avec la meunière sur ma bascule. Ils annoncent les chiffres comme des atouts à la manille.")],
    ("paulin", "milking"): [("leon", "Papa trait les vaches à 6 h du matin et à 6 h du soir. Tous les jours, même le dimanche. Les vaches ne savent pas que le dimanche existe.")],
    ("paulin", "winter"): [("margot", "L'hiver, Paulin ne va plus au champ: il passe ses journées à la grange. Il range les outils, puis il les range encore.")],
    ("paulin", "lunch"): [("margot", "À midi, du lundi au samedi, on mange dans la cour sous le noyer, jusqu'à 1 h et demie. Paulin se tait, Léon parle pour trois.")],
    ("paulin", "home"): [("nour", "Les Delmas habitent le logis du Pré-Long, la ferme qui tourne le dos à la route. Le soir, Paulin y est: il ouvre, il dit bonjour, il referme. Un homme efficace.")],
    ("margot", "threshing"): [("leon", "Le 19 de l'été, maman prépare le repas de moisson dès 9 h et elle le sert jusqu'à 10 h du soir. Il y a des tartes partout. Partout !")],
    ("margot", "harvest"): [("paulin", "Le 17 et le 18 de l'été, Margot lie les gerbes derrière moi, de 7 h à 6 h du soir. Elle va plus vite que moi. Je ne le dis pas.")],
    ("margot", "sunday_quilles"): [("mado", "Le dimanche, de 3 h à 6 h, Margot compte les points aux quilles devant le café. Elle triche pour Paulin. Je gagne quand même, c'est dire.")],
    ("margot", "milking"): [("paulin", "La traite, à 6 h et à 6 h du soir, avec Margot. Elle a les meilleures mains pour ça. Ça non plus, je ne le dis pas.")],
    ("margot", "poultry"): [("nour", "De 7 h à 9 h, du lundi au samedi, Margot soigne sa basse-cour. Ses poules sont les plus bavardes de la vallée. Je les ai auscultées: elles vont très bien, elles parlent beaucoup, c'est tout.")],
    ("margot", "garden"): [("odette", "Margot est à son courtil de 10 h à midi et de 3 h à 6 h, s'il ne pleut pas. Ses carottes, je les vends sans les peser: personne ne discute.")],
    ("margot", "home"): [("colette", "Le soir, Margot est chez elle, au Pré-Long. Il y a toujours une casserole sur son feu, même quand personne n'a faim.")],
    ("leon", "harvest"): [("jeanne", "Pendant la moisson, du 17 au 19 de l'été, Léon aide au champ toute la journée. Il revient tout jaune de poussière et il dit qu'il a tout fait.")],
    ("leon", "recess"): [("jeanne", "À la récré de 10 h et de 2 h et demie, Léon court partout dans la cour. Il gagne au loup parce qu'il ne s'arrête jamais. Ce n'est pas du jeu.")],
    ("leon", "affut"): [("margot", "Le mercredi, de 2 h à 5 h, Léon est à son affût au bout de la pâture. Il revient avec des taches d'herbe et des histoires d'oiseaux.")],
    ("leon", "wednesday_birds"): [("ines", "Le mercredi après-midi, Léon vient à l'orée avec Jeanne, de 2 h à 5 h, sauf l'hiver et les jours de pluie. Il compte les corbeaux. Je les compte aussi, pour lui faire plaisir.")],
    ("leon", "mass"): [("honorine", "Le dimanche, le petit Delmas est à la messe avec sa mère. Il dort au troisième rang, la bouche ouverte. Ça me rappelle mon Octave.")],
    ("leon", "quilles"): [("colette", "Le dimanche après-midi, Léon ramasse les quilles devant le café, de 3 h à 6 h. Je lui donne une limonade par partie. Il est très bien payé.")],
    ("leon", "summer_fishing"): [("achille", "L'été, l'après-midi, le petit Delmas pêche au bout de la pâture. Il attrape les loches à la main. Moi, avec une canne, j'en attrape moins.")],
    ("leon", "milking"): [("margot", "À 6 h du soir, Léon vient traire avec nous, jusqu'à 7 h. Il fait plus de bruit que les vaches, et elles l'aiment bien quand même.")],
    ("leon", "home"): [("jeanne", "Léon habite la ferme du Pré-Long, au bout de la route. Sa chambre sent la vache. Il dit que c'est la meilleure odeur du monde. Il est bizarre.")],
    ("ambroise", "monday_forest"): [("solange", "Le lundi, l'atelier d'Ambroise est fermé: il cueille à la lisière toute la matinée, s'il ne pleut pas. Il revient avec trois champignons et l'heure exacte.")],
    ("ambroise", "home"): [("firmin", "L'horloger habite la maison de cheminots de l'ouest. La compagnie la lui a laissée. Quarante pendules là-dedans, et pas une à l'heure, si tu veux mon avis.")],
    ("nour", "duo_visit"): [("odette", "Le jeudi à 8 h, la vétérinaire passe voir tes bêtes. Elle me l'a dit en déjeunant, la bouche pleine. Prépare-lui un café.")],
    ("nour", "consult_morning"): [("margot", "Le jeudi et le samedi matin, Nour reçoit à son cabinet, dès 8 h le samedi. Ces matins-là, la file des chiens commence au carrefour.")],
    ("nour", "yard"): [("honorine", "À 7 h, Nour soigne ses pensionnaires dans l'enclos, à côté de chez elle. Je vois tout de ma fenêtre: un hérisson, un geai, et une vétérinaire qui leur parle comme à des enfants.")],
    ("nour", "consult"): [("colette", "Du lundi au samedi, de 2 h à 5 h, Nour consulte à son cabinet. Les chiens du hameau attendent sur la route comme on attend au café.")],
    ("nour", "walk"): [("lucie", "À 5 h, Nour marche une heure sur la berge, s'il ne pleut pas. C'est la seule heure de la journée où elle ne court pas.")],
    ("nour", "market"): [("odette", "Le dimanche, la vétérinaire fait un tour à ton étal dans la matinée. Garde-lui du fromage, sinon elle boude jusqu'au lundi.")],
    ("nour", "home"): [("lucie", "Nour habite la première maison du hameau, après la menuiserie: l'ancienne maison du notaire. Certains matins, on part ensemble, elle et moi.")],
    ("colette", "tuesday_garden"): [("margot", "Le mardi, le café est fermé: Colette bêche son carré aux jardins de la Rive, de 9 h à midi. Elle y chante faux. C'est son jour de repos, elle a le droit.")],
    ("colette", "manille"): [("firmin", "Le mercredi soir, de 8 h à 10 h, Colette sert la manille. Elle sait qui triche, et elle ne dit rien. La meilleure arbitre de la vallée.")],
    ("colette", "sunday_terrace"): [("odette", "Le dimanche, Colette ouvre sa terrasse à la sortie de la messe jusqu'à 2 h, puis pendant les quilles, de 3 h à 7 h. Elle me prend mes clients. Je les reprends le lundi.")],
    ("colette", "sunday_rest"): [("martial", "Le dimanche matin, le café de la Côte reste fermé jusqu'à la sortie de la messe. Colette dit que c'est par respect. Je crois que c'est pour dormir.")],
    ("colette", "summer_terrace"): [("barnabe", "L'été, Colette sort les tables sur la terrasse de 6 h à 11 h du soir. Quand il fait doux, je chante un peu. Elle ne me fait pas payer.")],
    ("colette", "counter"): [("basile", "Le café ouvre à 7 h et ferme à 11 h du soir, avec un trou entre midi et 4 h. Colette dort l'après-midi, comme Achille. Le bourg est plein de dormeurs.")],
    ("colette", "home"): [("odette", "Colette habite au-dessus de son café, la fenêtre sur le carrefour. Elle voit tout, comme moi, mais elle ne dit rien. Ce n'est pas une vie.")],
}


def rumeurs_de(v: Villager, hid: str) -> list[tuple[str, str]]:
    """Rumeurs de l'habitude `hid` (identifiant complet) de l'habitant v."""
    return RUMEURS.get((v.id, hid[len(v.id) + 1:]), [])


# ---------------------------------------------------------------------------
# 4. Évaluation d'un planning (même règle que habitants.ts: première entrée vraie)
# ---------------------------------------------------------------------------


@dataclass
class Ctx:
    weekday: str
    season: str
    weather: str
    season_day: int
    day: int = 30
    flags: frozenset = frozenset()
    choices: frozenset = frozenset()
    birthday: bool = False
    special: frozenset = frozenset()


def special_days_of(season: str, sd: int) -> frozenset:
    out = set()
    for sid, spec in SPECIAL_DAYS.items():
        if "season" in spec and spec["season"] == season and sd in spec["days"]:
            out.add(sid)
        if "seasons" in spec and sd in spec["seasons"].get(season, []):
            out.add(sid)
    return frozenset(out)


def cond_ok(cond: dict, ctx: Ctx, villager_id: str) -> bool:
    for k, val in cond.items():
        if k == "weather" and ctx.weather != val:
            return False
        if k == "weather_not" and ctx.weather == val:
            return False
        if k == "season" and ctx.season not in val:
            return False
        if k == "special" and val not in ctx.special:
            return False
        if k == "season_day" and ctx.season_day not in val:
            return False
        if k == "from_day" and ctx.day < val:
            return False
        if k == "school" and (ctx.season == "summer"):
            return False
        if k == "flag" and val not in ctx.flags:
            return False
        if k == "not_flag" and val in ctx.flags:
            return False
        if k == "decision" and val not in ctx.choices:
            return False
        if k == "birthday" and not ctx.birthday:
            return False
        if k == "existing":
            # Conditions déjà écrites dans habitants.json (conservées telles quelles).
            if val == "train_day" and ctx.weekday != "sa":
                return False
            if val == "rain_well_roof" and ctx.weather != "rain":
                return False
            if val == "rain_well_roof" and "no_well_roof" in ctx.flags:
                return False
            if val == "rain_no_roof" and (ctx.weather != "rain" or "no_well_roof" not in ctx.flags):
                return False
            if val in ("chalk_box", "solange_here"):
                pass
    return True


_CACHE: dict = {}


def ctx_key(v: Villager, ctx: Ctx) -> tuple:
    return (v.id, ctx.weekday, ctx.season, ctx.weather, ctx.special, ctx.birthday, ctx.flags, ctx.choices,
            ctx.season_day == 2, min(ctx.day, 100) >= 16, min(ctx.day, 100) >= 43)


def entry_at(v: Villager, ctx: Ctx, minute: int) -> Entry | None:
    key = ctx_key(v, ctx) + (minute,)
    if key in _CACHE:
        return _CACHE[key]
    found = _entry_at(v, ctx, minute)
    _CACHE[key] = found
    return found


def _entry_at(v: Villager, ctx: Ctx, minute: int) -> Entry | None:
    for e in v.entries:
        if ctx.weekday not in e.days:
            continue
        if not any(a <= minute < b for a, b in e.windows):
            continue
        if not cond_ok(e.cond, ctx, v.id):
            continue
        return e
    return None


def scenarios(day: int = 100, flags: frozenset = frozenset(), choices: frozenset = frozenset()):
    seen = set()
    for season in SAISONS:
        for sd in range(1, SEASON_DAYS + 1):
            wd = jour_semaine_de_saison(sd)
            for weather in TEMPS:
                key = (season, wd, weather, special_days_of(season, sd), sd == 2)
                if key in seen:
                    continue
                seen.add(key)
                yield Ctx(wd, season, weather, sd, day, flags, choices, False, special_days_of(season, sd))


# ---------------------------------------------------------------------------
# 5. Contrôles
# ---------------------------------------------------------------------------
DASHES = (chr(0x2014), chr(0x2013))
GENDER_TRAPS = ("tous les deux", "les nouveaux", "vous êtes venus", "vous êtes les premiers", "chacun ")


def iter_texts():
    for v in VILLAGERS:
        for h in v.habits.values():
            yield v.id, h.id, h.label
            for r in h.reveals:
                yield v.id, h.id, r[2]
            for _by, text in rumeurs_de(v, h.id):
                yield v.id, h.id, text


def controles() -> list[str]:
    errors: list[str] = []
    ids = {v.id for v in VILLAGERS}
    for v in VILLAGERS:
        for e in v.entries:
            if e.point not in POINTS:
                errors.append(f"{v.id}: point inconnu {e.point}")
            for a, b in e.windows:
                if not (6 * 60 <= a < b <= 24 * 60):
                    errors.append(f"{v.id}: créneau hors journée {e.habit}")
        for h in v.habits.values():
            if not h.reveals:
                errors.append(f"{h.id}: aucune façon de l'apprendre")
            for r in h.reveals:
                if r[0] == "dit" and r[1] not in ids:
                    errors.append(f"{h.id}: locuteur inconnu {r[1]}")
            for by, _text in rumeurs_de(v, h.id):
                if by not in ids or by == v.id:
                    errors.append(f"{h.id}: rumeur d'un locuteur inconnu ou de l'habitant lui-même ({by})")
        # Couverture: une entrée pour chaque minute, tous scénarios, avec et sans drapeaux.
        for flags in (frozenset(), frozenset({"lucie_back", "clocks_reconciled", "mouture_settled", "valley_flour", "nour_visits", "armand_chronicle", "mill_running", "sisters_reconciled", "bird_hide_built", "barnabe_choir"})):
            for ctx in scenarios(100, flags):
                for minute in range(6 * 60, 24 * 60, 10):
                    if entry_at(v, ctx, minute) is None:
                        errors.append(f"{v.id}: trou {ctx.weekday} {ctx.season} {ctx.weather} {minute // 60} h")
                        break
    known_keys = {(v.id, h.id[len(v.id) + 1:]) for v in VILLAGERS for h in v.habits.values()}
    for key in RUMEURS:
        if key not in known_keys:
            errors.append(f"rumeur pour une habitude inconnue: {key}")
    for vid, hid, text in iter_texts():
        for d in DASHES:
            if d in text:
                errors.append(f"{hid}: tiret interdit")
        low = text.lower()
        for trap in GENDER_TRAPS:
            if trap in low:
                errors.append(f"{hid}: tournure à revoir ({trap.strip()})")
    # Chaque entrée sert: elle l'emporte au moins une fois dans un scénario.
    all_flags = frozenset({"lucie_back", "clocks_reconciled", "mouture_settled", "valley_flour", "nour_visits", "armand_chronicle", "mill_running", "sisters_reconciled", "bird_hide_built", "barnabe_choir"})
    for v in VILLAGERS:
        used = set()
        for flags, choices in ((frozenset(), frozenset()), (frozenset({"no_well_roof"}), frozenset()), (all_flags, frozenset({"mouture:weighing", "cabane:shared", "robe:shared"})), (all_flags, frozenset({"mouture:watch", "cabane:jeanne", "robe:marthe"}))):
            for ctx in scenarios(100, flags, choices):
                for bday in (False, True):
                    ctx.birthday = bday
                    for minute in range(6 * 60, 24 * 60, 10):
                        e = entry_at(v, ctx, minute)
                        if e is not None:
                            used.add(id(e))
        for e in v.entries:
            if id(e) not in used:
                errors.append(f"{v.id}: entrée jamais atteinte ({e.habit}, {e.point})")
    return errors


# ---------------------------------------------------------------------------
# 6. Tableaux Markdown
# ---------------------------------------------------------------------------


def fmt_h(m: int) -> str:
    h, mm = divmod(m, 60)
    return f"{h} h" if mm == 0 else f"{h} h {mm:02d}"


def fmt_windows(ws) -> str:
    return ", ".join(f"{fmt_h(a)} à {fmt_h(b)}" for a, b in ws)


def fmt_days(days) -> str:
    if tuple(days) == JOURS:
        return "tous"
    return " ".join(days)


def fmt_cond(cond: dict) -> str:
    parts = []
    for k, val in cond.items():
        if k == "weather":
            parts.append("pluie")
        elif k == "weather_not":
            parts.append("sans pluie")
        elif k == "season":
            parts.append(", ".join(NOM_SAISON[s] for s in val))
        elif k == "special":
            parts.append(f"jour: `{val}`")
        elif k == "season_day":
            parts.append("jour de saison " + ", ".join(str(x) for x in val))
        elif k == "from_day":
            parts.append(f"dès le jour {val}")
        elif k == "school":
            parts.append("jour de classe")
        elif k == "flag":
            parts.append(f"`{val}`")
        elif k == "not_flag":
            parts.append(f"sans `{val}`")
        elif k == "decision":
            parts.append(f"décision `{val}`")
        elif k == "birthday":
            parts.append("anniversaire")
        elif k == "existing":
            parts.append(f"existant: {val}")
    return "; ".join(parts) if parts else ""


def short_habit(v: Villager, hid: str) -> str:
    return hid[len(v.id) + 1:]


def tableaux() -> str:
    out = []
    for v in VILLAGERS:
        season, d = v.birthday
        out.append(f"#### {v.name.split(',')[0]} (`{v.id}`)\n")
        out.append("| # | Habitude | Jours | Heures | Point | Activité | Conditions |")
        out.append("|---|---|---|---|---|---|---|")
        for i, e in enumerate(v.entries, 1):
            out.append(f"| {i} | `{short_habit(v, e.habit)}` | {fmt_days(e.days)} | {fmt_windows(e.windows)} | `{e.point}` | {e.activity} | {fmt_cond(e.cond)} |")
        out.append("")
        out.append("| Habitude | Sorte | Au carnet | Comment l'apprendre (en plus de la voir) |")
        out.append("|---|---|---|---|")
        for h in v.habits.values():
            how = []
            for r in h.reveals:
                if r[0] == "dit":
                    nom = next(x for x in VILLAGERS if x.id == r[1]).name.split(" ")[0]
                    how.append(f"{nom}: « {r[2]} »")
                else:
                    how.append(f"écriteau `{r[1]}`: « {r[2]} »")
            out.append(f"| `{short_habit(v, h.id)}` | {h.kind} | {h.label} | {'<br>'.join(how)} |")
        out.append("")
    return "\n".join(out)


# ---------------------------------------------------------------------------
# 7. Export au format de habitants.json (champ nouveau: habit)
# ---------------------------------------------------------------------------


def to_json_conditions(cond: dict) -> list:
    out = []
    for k, val in cond.items():
        if k == "weather":
            out.append({"type": "weather_is", "weather": val})
        elif k == "weather_not":
            out.append({"type": "not", "condition": {"type": "weather_is", "weather": val}})
        elif k == "season":
            out.append({"type": "season_is", "seasons": val})
        elif k == "special":
            out.append({"type": "special_day", "id": val})
        elif k == "season_day":
            out.append({"type": "season_day_is", "days": val})
        elif k == "from_day":
            out.append({"type": "day_at_least", "day": val})
        elif k == "school":
            out.append({"type": "school_day"})
        elif k == "flag":
            out.append({"type": "flag", "flag": val})
        elif k == "not_flag":
            out.append({"type": "not", "condition": {"type": "flag", "flag": val}})
        elif k == "decision":
            dec, opt = val.split(":")
            out.append({"type": "decision_made", "decision": dec, "option": opt})
        elif k == "birthday":
            out.append({"type": "birthday_of", "villager": "self"})
        elif k == "existing":
            out.append({"type": "existing", "keep": val})
    return out


# Sortes d'habitudes dans les données (donnees/README.md, section 2.12); le document garde les noms français.
KIND_JSON = {"routine": "routine", "maison": "home", "pluie": "rain", "saison": "season", "jour": "day",
             "apres": "after_quest", "marche": "market", "anniv": "birthday"}


def export_data() -> dict:
    data = []
    for v in VILLAGERS:
        sched = []
        for e in v.entries:
            days = [WEEKDAY_ID[d] for d in e.days]
            for a, b in e.windows:
                when = to_json_conditions(e.cond)
                if tuple(e.days) != JOURS:
                    when.insert(0, {"type": "weekday_is", "weekdays": days})
                item = {"habit": short_habit(v, e.habit), "from": f"{a // 60:02d}:{a % 60:02d}", "to": f"{b // 60:02d}:{b % 60:02d}", "point": e.point, "activity": e.activity}
                if when:
                    item = {"when": when, **item}
                sched.append(item)
        habits = [{"id": short_habit(v, h.id), "kind": KIND_JSON[h.kind], "label": h.label,
                   "reveals": [{"by": r[1], "text": r[2]} if r[0] == "dit" else {"sign": r[1], "text": r[2]} for r in h.reveals]
                   + [{"by": by, "text": text} for by, text in rumeurs_de(v, h.id)]}
                  for h in v.habits.values()]
        data.append({"id": v.id, "birthday": {"season": v.birthday[0], "day": v.birthday[1]}, "schedule": sched, "habits": habits})
    return {"villagers": data}


def export_json(path: str) -> None:
    with open(path, "w", encoding="utf-8") as f:
        json.dump(export_data(), f, ensure_ascii=False, indent=1)


# ---------------------------------------------------------------------------
# 8. Simulation de la découverte des habitudes
# ---------------------------------------------------------------------------
# Modèle volontairement simple: chaque joueur passe chaque heure de jeu (6 h à 24 h) dans un
# secteur du bourg, plus un secteur de passage (place ou quai). Il voit toute habitude
# visible d'un habitant présent dans ce secteur avec une probabilité P_SEE; une habitude dont
# l'habitant est invisible (chez lui, dedans, hors carte) ne se voit qu'à l'entrée ou à la
# sortie (P_PASS). Il parle à environ TALKS habitants visibles par jour; une conversation
# révèle une habitude inconnue de cet habitant ou d'un autre (rumeur) avec P_TALK.

SECTEURS_JOUEUR = {
    "quai": 1.0, "place": 1.6, "epicerie": 0.5, "scierie": 0.6, "berge": 1.2, "rue_haute": 1.0, "salon": 0.2,
    "tertre": 0.5, "eglise": 0.15, "carrefour": 0.7, "cafe": 0.2, "forge_int": 0.05, "hameau": 0.4, "jardins": 0.4,
    "ferme": 0.5, "champs": 0.3, "ouest": 0.6, "moulin": 0.6, "moulin_int": 0.05, "oree": 0.6, "bois": 0.9, "ecole": 0.05,
}
P_HOME = 0.35
P_SEE = 0.7
P_PASS = 0.2
TALKS = 5
P_TALK_SELF = 0.30
P_TALK_GOSSIP = 0.10
GOSSIP_AFTER = 10  # rattrapage: jours où l'habitude a été observable sans être connue


def secteur(point: str) -> str:
    return POINTS[point][1]


def visible(e: Entry) -> bool:
    """Vu par un joueur du même secteur (un point « dedans » a le secteur de son intérieur)."""
    return e.activity not in ("home", "absent", "inside") and e.point != "offstage"


def sim_decouverte(days: int, rules: dict, rng: random.Random, start_day: int = 1) -> dict:
    known: set[str] = set()
    first_seen: dict[str, int] = {}
    observable_days: dict[str, int] = {}
    curve = {}
    weather_seq = []
    w = "sunny"
    for _ in range(days):
        w = rng.choices(TEMPS, weights=(45, 25, 30))[0] if rng.random() > 0.35 else w
        weather_seq.append(w)
    all_habits = {h.id: (v, h) for v in VILLAGERS for h in v.habits.values() if h.kind != "marche"}
    for d in range(days):
        gday = start_day + d
        season = SAISONS[((gday - 1) // SEASON_DAYS) % 4]
        sd = (gday - 1) % SEASON_DAYS + 1
        wd = jour_semaine_de_saison(sd)
        flags = frozenset({"lucie_back"}) if d >= 2 else frozenset()
        ctx = Ctx(wd, season, weather_seq[d], sd, gday, flags, frozenset(), False, special_days_of(season, sd))
        focus = set(rng.sample(list(SECTEURS_JOUEUR), 3))
        observable_today: set[str] = set()
        for hour in range(6, 24):
            minute = hour * 60 + 20
            here = {}
            for v in VILLAGERS:
                ctx.birthday = v.birthday == (season, sd)
                e = entry_at(v, ctx, minute)
                if e is None:
                    continue
                here.setdefault(secteur(e.point) if visible(e) else ("porte:" + secteur(e.point)), []).append((v, e))
                observable_today.add(e.habit)
            for _p in range(2):
                visits = []
                if rng.random() > P_HOME:
                    names = list(SECTEURS_JOUEUR)
                    weights = [SECTEURS_JOUEUR[n] * (2 if n in focus else 1) for n in names]
                    visits.append(rng.choices(names, weights=weights)[0])
                    visits.append("place" if rng.random() < 0.5 else "quai")
                for sec in visits:
                    for v, e in here.get(sec, []):
                        if e.habit not in known and rng.random() < P_SEE:
                            known.add(e.habit)
                    for v, e in here.get("porte:" + sec, []):
                        if e.habit not in known and rng.random() < P_PASS:
                            known.add(e.habit)
        for hid in observable_today:
            observable_days[hid] = observable_days.get(hid, 0) + 1
        # Conversations (dialogue et écriteaux comptés ensemble).
        if rules.get("talk", True):
            for _p in range(2):
                for v in rng.sample(VILLAGERS, TALKS):
                    unknown_self = [h for h in v.habits if h not in known and all_habits.get(h) and any(r[0] == "dit" and r[1] == v.id for r in v.habits[h].reveals)]
                    if unknown_self and rng.random() < P_TALK_SELF:
                        known.add(rng.choice(unknown_self))
                    gossip = [h for h, (ov, oh) in all_habits.items() if h not in known and any(r[0] == "dit" and r[1] == v.id for r in oh.reveals) and ov.id != v.id]
                    if gossip and rng.random() < P_TALK_GOSSIP:
                        known.add(rng.choice(gossip))
                    if rules.get("catchup", True):
                        late = [h for h in gossip if observable_days.get(h, 0) >= GOSSIP_AFTER]
                        if late:
                            known.add(rng.choice(late))
        if (d + 1) in (7, 14, 21, 42, 63, 84, 126, 168, 252, 336):
            by_kind = {}
            for hid, (v, h) in all_habits.items():
                k = "routine" if h.kind in ("routine", "maison") else h.kind
                tot, kn = by_kind.get(k, (0, 0))
                by_kind[k] = (tot + 1, kn + (hid in known))
            curve[d + 1] = {k: kn / tot for k, (tot, kn) in by_kind.items()} | {"tout": len(known & set(all_habits)) / len(all_habits)}
    return curve


def resume_decouverte(n: int = 60) -> str:
    rng = random.Random(SEED)
    lines = []
    for label, rules in (("règle proposée (vu, dialogues, écriteaux, rattrapage)", {}), ("sans rattrapage", {"catchup": False}), ("vu seulement", {"talk": False, "catchup": False})):
        curves = [sim_decouverte(336, rules, rng) for _ in range(n)]
        lines.append(f"\n{label} ({n} duos)")
        kinds = ["tout", "routine", "jour", "pluie", "saison", "anniv", "apres"]
        lines.append("| Jour | " + " | ".join(kinds) + " |")
        lines.append("|---|" + "---|" * len(kinds))
        for d in (7, 14, 21, 42, 63, 84, 168, 336):
            vals = []
            for k in kinds:
                xs = [c[d].get(k, 0.0) for c in curves]
                vals.append(f"{round(100 * statistics.median(xs))} %")
            lines.append(f"| {d} | " + " | ".join(vals) + " |")
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# 9. Simulation de l'amitié et des suites de quêtes
# ---------------------------------------------------------------------------
LEVELS = [100, 250, 450, 700, 1000]
GAIN = {"talk": 10, "adore": 60, "aime": 30, "neutre": 10, "deteste": 0, "story": 100, "cross": 50, "birthday_mult": 2, "habits_done": 50}

# Étapes de chaque suite: (niveau de lien requis, autre habitant dont une étape doit être faite, index de cette étape).
# Index 0 = première quête de la suite 0.13. Les suites et croisements sont ceux de la section 5.
SUITES = {
    "firmin": [(1, None, None), (2, "ambroise", 1), (3, "solange", 1), (4, "armand", 3)],
    "odette": [(1, "honorine", 0), (2, "mado", 0), (3, None, None), (4, "lucie", 0)],
    "basile": [(1, "mado", 0), (2, None, None), (3, None, None), (4, "ines", 1)],
    "jeanne": [(1, "lucie", 0), (2, None, None), (3, "ines", 1)],
    "achille": [(2, None, None), (3, "berthe", 1), (4, "jeanne", 1)],
    "solange": [(1, None, None), (2, None, None), (3, None, None)],
    "lucie": [(0, None, None), (1, "ambroise", 0), (2, None, None), (3, "firmin", 1)],
    "armand": [(0, None, None), (1, "honorine", 0), (2, None, None), (3, "firmin", 2)],
    "berthe": [(0, None, None), (1, "mado", 0), (2, "paulin", 0), (3, "paulin", 2)],
    "martial": [(0, None, None), (1, "mado", 0), (2, "paulin", 1), (3, "marthe", 1)],
    "marthe": [(0, None, None), (1, None, None), (2, "honorine", 1), (3, None, None)],
    "honorine": [(0, None, None), (1, "lucie", 1), (2, "marthe", 2), (3, None, None)],
    "ines": [(0, None, None), (1, "barnabe", 0), (2, None, None), (3, None, None)],
    "barnabe": [(0, None, None), (1, None, None), (2, None, None), (3, "armand", 2)],
    "mado": [(0, None, None), (1, None, None), (2, "paulin", 0), (3, "marthe", 1)],
    "paulin": [(0, None, None), (1, None, None), (2, "berthe", 2), (3, "martial", 2)],
    "margot": [(0, None, None), (1, "nour", 1), (2, None, None)],
    "leon": [(0, None, None), (1, "firmin", 0), (2, "jeanne", 2)],
    "ambroise": [(0, None, None), (1, "firmin", 0), (2, "solange", 2)],
    "nour": [(0, None, None), (1, "margot", 0), (2, "ines", 1), (3, None, None)],
    "colette": [(0, None, None), (1, "odette", 0), (2, None, None), (3, "ambroise", 1)],
}
# Lien de départ des habitants déjà connus (60 par quête finie avec eux, au plus 250).
START_BOND = {"firmin": 250, "odette": 250, "basile": 250, "jeanne": 250, "achille": 120, "solange": 120}
NEW_IDS = [v.id for v in VILLAGERS if v.status == "nouveau"]
# Règle proposée (section 5.1): au plus 2 histoires en cours, une nouvelle étape par jour,
# et 3 jours au moins entre deux étapes d'un même habitant.
RULE = {"max_active": 2, "new_per_day": 1, "cooldown": 3}


def level_of(b: int) -> int:
    return sum(1 for t in LEVELS if b >= t)


def sim_amitie(days: int, rng: random.Random, max_active: int, profile: str, new_per_day: int = 99, cooldown: int = 0) -> dict:
    talks_per_player = {"tranquille": 3, "médian": 5, "assidu": 7}[profile]
    gift_p = {"tranquille": 0.3, "médian": 0.5, "assidu": 0.8}[profile]
    quest_days = {"tranquille": 4.0, "médian": 2.5, "assidu": 1.5}[profile]
    bond = {v.id: START_BOND.get(v.id, 0) for v in VILLAGERS}
    met = {v.id: v.id in START_BOND for v in VILLAGERS}
    met["lucie"] = False
    done = {v.id: -1 for v in VILLAGERS}  # dernier index fait
    ended = {v.id: -99 for v in VILLAGERS}
    active: dict[str, float] = {}  # habitant -> jours restants
    known_taste = {v.id: 0.0 for v in VILLAGERS}
    fav = {v.id: rng.random() ** 2 + 0.15 for v in VILLAGERS}
    step_day: dict[tuple[str, int], int] = {}
    active_log = []
    birthdays = {v.id: v.birthday for v in VILLAGERS}
    for d in range(1, days + 1):
        season = SAISONS[((d - 1) // SEASON_DAYS) % 4]
        sd = (d - 1) % SEASON_DAYS + 1
        if d == 2:
            met["lucie"] = True
        # Présentations: la tournée de Lucie (section 2.1) présente deux nouveaux habitants par jour,
        # les autres se rencontrent en se promenant.
        intro = [x for x in NEW_IDS if not met[x]]
        for x in intro[:2] if d >= 2 else []:
            met[x] = True
        for x in intro[2:]:
            if rng.random() < 0.15:
                met[x] = True
        pool = [v for v in VILLAGERS if met[v.id]]
        for _p in range(2):
            weights = [fav[v.id] * (3 if v.id in active else 1) for v in pool]
            talked = set()
            for _ in range(talks_per_player):
                v = rng.choices(pool, weights=weights)[0]
                if v.id in talked:
                    continue
                talked.add(v.id)
                bond[v.id] += GAIN["talk"]
            if rng.random() < gift_p and pool:
                v = rng.choices(pool, weights=[fav[x.id] for x in pool])[0]
                k = known_taste[v.id]
                r = rng.random()
                kind = "adore" if r < 0.1 + 0.3 * k else "aime" if r < 0.45 + 0.3 * k else "neutre" if r < 0.9 + 0.08 * k else "deteste"
                g = GAIN[kind]
                if birthdays[v.id] == (season, sd):
                    g *= GAIN["birthday_mult"]
                bond[v.id] += g
                known_taste[v.id] = min(1.0, k + 0.12)
        # Quêtes en cours
        for vid in list(active):
            active[vid] -= 1
            if active[vid] <= 0:
                del active[vid]
                done[vid] += 1
                ended[vid] = d
                step_day[(vid, done[vid])] = d
                bond[vid] += GAIN["story"]
                cross = SUITES[vid][done[vid]][1]
                if cross:
                    bond[cross] += GAIN["cross"]
        # Ouverture des étapes
        ready = []
        for v in VILLAGERS:
            if not met[v.id] or v.id in active:
                continue
            nxt = done[v.id] + 1
            if nxt >= len(SUITES[v.id]):
                continue
            lvl, other, idx = SUITES[v.id][nxt]
            if level_of(bond[v.id]) < lvl:
                continue
            if other and done[other] < idx:
                continue
            if d - ended[v.id] < cooldown:
                continue
            ready.append(v.id)
        rng.shuffle(ready)
        ready.sort(key=lambda x: -fav[x])
        opened = 0
        for vid in ready:
            if len(active) >= max_active or opened >= new_per_day:
                break
            active[vid] = max(1.0, rng.expovariate(1 / quest_days))
            opened += 1
        active_log.append(len(active))
    total_steps = sum(len(s) for s in SUITES.values())
    finished = sum(done[v] + 1 for v in done)
    return {"steps": step_day, "active": active_log, "bond": bond, "finished": finished, "total": total_steps, "levels": [level_of(bond[v.id]) for v in VILLAGERS]}


def resume_amitie(n: int = 200) -> str:
    rng = random.Random(SEED + 1)
    lines = []
    for profile in ("tranquille", "médian", "assidu"):
        for label, max_active, new_per_day, cooldown in (("sans limite", 99, 99, 0), ("3 actives", 3, 99, 0), ("règle proposée", RULE["max_active"], RULE["new_per_day"], RULE["cooldown"])):
            runs = [sim_amitie(336, rng, max_active, profile, new_per_day, cooldown) for _ in range(n)]
            per_period = []
            for a, b in ((1, 21), (22, 63), (64, 126), (127, 252), (253, 336)):
                cnt = [sum(1 for (vid, i), day in r["steps"].items() if a <= day <= b) / (b - a + 1) for r in runs]
                per_period.append(statistics.median(cnt))
            fin = [r["finished"] / r["total"] for r in runs]
            d84 = [sum(1 for (vid, i), day in r["steps"].items() if day <= 84) for r in runs]
            act = [statistics.mean(r["active"][:84]) for r in runs]
            fam = [sum(1 for lv in r["levels"] if lv >= 5) for r in runs]
            lines.append(f"| {profile} | {label} | {statistics.median(d84):.0f} | "
                         + " | ".join(f"{x:.2f}" for x in per_period)
                         + f" | {100 * statistics.median(fin):.0f} % | {statistics.median(act):.1f} | {statistics.median(fam):.0f} |")
    head = ("| Duo | Règle | Étapes faites au jour 84 | Étapes par jour, j1 à 21 | j22 à 63 | j64 à 126 | j127 à 252 | j253 à 336 "
            "| Suites finies au jour 336 | Actives en moyenne (j1 à 84) | Habitants « Comme la famille » au jour 336 |")
    return head + "\n|---|---|---|---|---|---|---|---|---|---|---|\n" + "\n".join(lines)


def jours_des_etapes(n: int = 200) -> str:
    """Jour médian où chaque étape est faite, pour un duo médian, limite de 3 quêtes actives."""
    rng = random.Random(SEED + 2)
    runs = [sim_amitie(336, rng, RULE["max_active"], "médian", RULE["new_per_day"], RULE["cooldown"]) for _ in range(n)]
    lines = ["| Habitant | Étape 1 | Étape 2 | Étape 3 | Étape 4 |", "|---|---|---|---|---|"]
    for v in VILLAGERS:
        cells = []
        for i in range(4):
            if i >= len(SUITES[v.id]):
                cells.append("")
                continue
            xs = [r["steps"].get((v.id, i), 999) for r in runs]
            med = statistics.median(xs)
            share = sum(1 for x in xs if x < 999) / len(xs)
            cells.append("après 336" if med >= 999 else f"{med:.0f} ({100 * share:.0f} %)")
        lines.append(f"| {v.name.split(',')[0]} | " + " | ".join(cells) + " |")
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# 10. Statistiques des plannings
# ---------------------------------------------------------------------------


def stats_plannings() -> str:
    lines = ["| Habitant | Habitudes | Dont visibles | Heures visibles par jour (moyenne de l'année, temps tirés) | Apprises par dialogue | Par écriteau |", "|---|---|---|---|---|---|"]
    tot_h = 0
    for v in VILLAGERS:
        hs = [h for h in v.habits.values()]
        vis_ids = {e.habit for e in v.entries if visible(e)}
        minutes = 0
        n = 0
        for ctx in scenarios(100, frozenset({"lucie_back"})):
            wt = {"sunny": 0.45, "cloudy": 0.25, "rain": 0.30}[ctx.weather]
            m = 0
            for minute in range(6 * 60, 24 * 60, 10):
                e = entry_at(v, ctx, minute)
                if e is not None and visible(e):
                    m += 10
            minutes += m * wt
            n += wt
        dial = sum(1 for h in hs if any(r[0] == "dit" for r in h.reveals))
        sign = sum(1 for h in hs if any(r[0] == "ecriteau" for r in h.reveals))
        tot_h += len(hs)
        lines.append(f"| {v.name.split(',')[0]} | {len(hs)} | {len(vis_ids)} | {minutes / n / 60:.1f} | {dial} | {sign} |")
    lines.append(f"| **Total** | **{tot_h}** | | | | |")
    return "\n".join(lines)


def croise(doc: str) -> list[str]:
    """Relit les tableaux de planning du document et les compare aux données du script."""
    text = open(doc, encoding="utf-8").read()
    errors = []
    for v in VILLAGERS:
        m = re.search(rf"\(`{v.id}`\)\n\n\| # \| Habitude.*?\n\|---.*?\n((?:\|.*\n)+)", text)
        if not m:
            errors.append(f"{v.id}: tableau absent du document")
            continue
        rows = [r for r in m.group(1).strip().split("\n")]
        if len(rows) != len(v.entries):
            errors.append(f"{v.id}: {len(rows)} lignes dans le document, {len(v.entries)} dans le script")
            continue
        for row, e in zip(rows, v.entries):
            cells = [c.strip() for c in row.strip("|").split("|")]
            if cells[1] != f"`{short_habit(v, e.habit)}`" or cells[4] != f"`{e.point}`" or cells[3] != fmt_windows(e.windows):
                errors.append(f"{v.id}: ligne différente ({cells[1]})")
    return errors


# Échelles des modèles livrés par l'artiste 3D (assets/modeles/README.md, habitants de la 0.13).
ECHELLES = {"armand": 1.035, "ines": 1.03, "barnabe": 1.10, "marthe": 0.92, "honorine": 0.86, "ambroise": 0.94,
            "leon": 0.78, "paulin": 0.97, "margot": 0.97}
# Quotidien minimal d'un habitant de la 0.13 (lot H4): rencontre, premier niveau, temps, saisons jouables.
QUOTIDIEN = {"meeting": 1, "base": 8, "sunny": 3, "cloudy": 3, "rain": 3, "spring": 2, "summer": 2, "autumn": 2}
# Même règle que GENDERED_RE de games/la-petite-ligne/outils/valider_donnees.py (avertissement à relire).
GENRE_RE = re.compile(
    r"\b(?:tu es|tu étais|tu seras|vous êtes|vous étiez|vous serez|sois|soyez) "
    r"(?:fatigu|prêt|content|épuis|ravi|arrivé|parti|seul|occupé|installé|venu|perdu|les premi|les derni|tous|toutes"
    r"|nouveaux|nouvelles)"
    r"|\b(?:tous|toutes) les deux\b(?! (?:jours|nuits|heures|minutes|semaines|mois|ans)\b)"
    r"|\bles nouveaux\b|\bdes débutant|^(?:cher|chère|chers|chères) ",
    re.IGNORECASE,
)


def croise_json(path: str) -> list[str]:
    """Relit un fichier de données des habitants (habitants-0-13.json) et le compare au script."""
    errors: list[str] = []
    data = json.load(open(path, encoding="utf-8"))
    donnees = os.path.dirname(os.path.abspath(path))
    jeu = os.path.dirname(donnees)
    exported = {v["id"]: v for v in export_data()["villagers"]}
    items = {i["id"] for i in json.load(open(os.path.join(donnees, "objets.json"), encoding="utf-8"))["items"]}
    models = set(json.load(open(os.path.join(jeu, "assets", "modeles", "index.json"), encoding="utf-8")))
    old = json.load(open(os.path.join(donnees, "habitants.json"), encoding="utf-8"))["villagers"]
    old_ids = {v["id"] for v in old}
    seen_dialogues = {d["id"] for v in old for d in v["dialogues"]}
    all_ids = {v.id for v in VILLAGERS}
    texts: list[tuple[str, str]] = []
    for v in data["villagers"]:
        vid = v["id"]
        if vid not in exported:
            errors.append(f"{vid}: habitant absent du script")
            continue
        if vid in old_ids:
            errors.append(f"{vid}: déjà dans habitants.json")
        ref = exported[vid]
        if v["schedule"] != ref["schedule"]:
            errors.append(f"{vid}: planning différent de la sortie --json")
        if v["habits"] != ref["habits"]:
            errors.append(f"{vid}: habitudes différentes de la sortie --json")
        if v["birthday"] != ref["birthday"]:
            errors.append(f"{vid}: anniversaire différent du script")
        if v["model"] != f"villager_{vid}" or v["model"] not in models:
            errors.append(f"{vid}: modèle {v['model']} absent de assets/modeles/index.json")
        if abs(v["scale"] - ECHELLES.get(vid, 1.0)) > 1e-9:
            errors.append(f"{vid}: échelle {v['scale']} au lieu de {ECHELLES.get(vid, 1.0)}")
        tastes = v["tastes"]
        listed = tastes["adore"] + tastes["aime"] + [d["item"] for d in tastes["deteste"]]
        for item in listed:
            if item not in items:
                errors.append(f"{vid}: goût pour un objet inconnu ({item})")
        if len(listed) != len(set(listed)):
            errors.append(f"{vid}: un objet dans deux listes de goûts")
        texts += [(f"{vid}.tastes", d["reply"]) for d in tastes["deteste"]]
        for h in v["habits"]:
            texts.append((f"{vid}.{h['id']}", h["label"]))
            for r in h["reveals"]:
                texts.append((f"{vid}.{h['id']}", r["text"]))
            if not any(r.get("by") not in (None, vid) for r in h["reveals"]):
                errors.append(f"{vid}.{h['id']}: aucune rumeur (réplique d'un autre habitant) pour le rattrapage")
        counts = {k: 0 for k in QUOTIDIEN}
        for d in v["dialogues"]:
            if d["id"] in seen_dialogues:
                errors.append(f"{vid}: identifiant de dialogue en double ({d['id']})")
            seen_dialogues.add(d["id"])
            for ln in d["lines"]:
                if ln["speaker"] != vid or ln["speaker"] not in all_ids:
                    errors.append(f"{d['id']}: locuteur {ln['speaker']}")
                texts.append((d["id"], ln["text"]))
            if d["kind"] == "meeting":
                counts["meeting"] += 1
            elif d["kind"] == "daily" and not d["when"]:
                counts["base"] += 1
            elif d["kind"] == "daily" and len(d["when"]) == 1 and d["when"][0]["type"] == "weather_is":
                counts[d["when"][0]["weather"]] += 1
            elif d["kind"] == "daily" and len(d["when"]) == 1 and d["when"][0]["type"] == "season_is":
                for s in d["when"][0]["seasons"]:
                    counts[s] = counts.get(s, 0) + 1
        for k, n in QUOTIDIEN.items():
            if counts.get(k, 0) < n:
                errors.append(f"{vid}: {counts.get(k, 0)} répliques « {k} » au lieu de {n}")
    seen_texts: dict[str, str] = {}
    for where, text in texts:
        for d in DASHES:
            if d in text:
                errors.append(f"{where}: tiret interdit")
        found = GENRE_RE.search(text)
        if found:
            errors.append(f"{where}: tournure à relire « {found.group(0)} »")
        if " :" in text or " ;" in text:
            errors.append(f"{where}: espace avant un deux-points ou un point-virgule")
        if re.search(r"\{[a-zA-Z]+\}", text):
            errors.append(f"{where}: espace réservé dans un texte d'habitant")
        if re.search(r"\bmois\b", text):
            errors.append(f"{where}: « mois » (le bourg compte en saisons)")
        if re.search(r"[0-9](?: | )sous?\b", text):
            errors.append(f"{where}: ancienne monnaie")
        if "." in where:
            continue  # libellés, révélations et goûts: une même phrase peut servir plusieurs habitudes
        if text in seen_texts:
            errors.append(f"{where}: même texte que {seen_texts[text]}")
        seen_texts.setdefault(text, where)
    reveal_texts = {text for where, text in texts if "." in where}
    for text, where in seen_texts.items():
        if text in reveal_texts:
            errors.append(f"{where}: réplique du quotidien identique à une révélation")
    return errors


def dump_villagers(data: dict) -> str:
    """Mise en forme de habitants-0-13.json: un élément par ligne pour les plannings, habitudes, dialogues."""
    def one(x) -> str:
        return json.dumps(x, ensure_ascii=False)
    parts = ["{", f'  "version": {data.get("version", 1)},', '  "villagers": [']
    vs = data["villagers"]
    for vi, v in enumerate(vs):
        parts.append("    {")
        keys = list(v)
        for ki, k in enumerate(keys):
            comma = "," if ki < len(keys) - 1 else ""
            if k in ("schedule", "habits", "dialogues"):
                parts.append(f'      "{k}": [')
                parts += ["        " + one(item) + ("," if ii < len(v[k]) - 1 else "") for ii, item in enumerate(v[k])]
                parts.append("      ]" + comma)
            else:
                parts.append(f'      "{k}": {one(v[k])}{comma}')
        parts.append("    }" + ("," if vi < len(vs) - 1 else ""))
    parts += ["  ]", "}"]
    return "\n".join(parts) + "\n"


def maj_json(path: str) -> None:
    """Reporte plannings, habitudes et anniversaires du script dans un fichier existant, textes inchangés."""
    data = json.load(open(path, encoding="utf-8"))
    exported = {v["id"]: v for v in export_data()["villagers"]}
    for v in data["villagers"]:
        ref = exported[v["id"]]
        for k in ("birthday", "schedule", "habits"):
            v[k] = ref[k]
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        f.write(dump_villagers(data))


def main() -> None:
    args = sys.argv[1:]
    if "--maj" in args:
        maj_json(args[args.index("--maj") + 1])
        return
    if "--tableaux" in args:
        print(tableaux())
        return
    if "--json" in args:
        export_json(args[args.index("--json") + 1])
        return
    if "--croise" in args:
        cible = args[args.index("--croise") + 1]
        if cible.endswith(".json"):
            errs = croise_json(cible)
            print("\n".join(errs) if errs else "Données des habitants conformes au script (plannings, habitudes, rumeurs, goûts, quotidien, typographie).")
            sys.exit(1 if errs else 0)
        errs = croise(cible)
        print("\n".join(errs) if errs else "Tableaux du document identiques aux données du script.")
        sys.exit(1 if errs else 0)
    errs = controles()
    print("Contrôles:", "aucune erreur" if not errs else "")
    for e in errs:
        print("  ", e)
    if os.path.exists(CARTE):
        with open(CARTE, encoding="utf-8") as f:
            existing = {p["id"] for p in json.load(f)["points"]}
        new = sorted(p for p in POINTS if p not in existing and p != "offstage")
        print(f"\nPoints: {len(POINTS)} cités, {len(POINTS) - len(new)} déjà sur la carte, {len(new)} nouveaux")
        print("Nouveaux:", ", ".join(new))
    print("\nStatistiques des plannings\n" + stats_plannings())
    print("\nDécouverte des habitudes (part connue, médiane)" + resume_decouverte())
    print("\nAmitié et suites de quêtes\n" + resume_amitie())
    print("\nJour médian de chaque étape (duo médian, règle proposée; part des duos qui l'ont faite au jour 336)\n" + jours_des_etapes())
    if errs:
        sys.exit(1)


if __name__ == "__main__":
    main()
