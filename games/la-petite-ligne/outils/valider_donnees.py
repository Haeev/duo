#!/usr/bin/env python3
"""Valide les données de la démo de La Petite Ligne.

Vérifie les fichiers de games/la-petite-ligne/donnees/ (schéma décrit dans donnees/README.md):
JSON valide, version, identifiants uniques et bien formés, chaque référence existe
(objets, recettes, constructions, habitants, dialogues, quêtes et étapes, lettres, textes,
points de carte quand la carte existe), conditions et effets connus avec leurs paramètres,
textes sans tiret cadratin ni demi-cadratin et sans espace réservé inconnu.

Usage: python3 games/la-petite-ligne/outils/valider_donnees.py [dossier_donnees]
Python 3 sans dépendance. Code de sortie: 0 si aucune erreur, 1 sinon.
Les avertissements (points de carte pas encore dessinés, drapeaux jamais posés) ne font pas échouer.
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path
from typing import Any

FILES = ("objets", "cultures", "habitants", "quetes", "courrier", "astuces", "envies", "textes", "reglages")
# Tour 9: annonces du tableau, chantiers, catalogue de la semaine (facultatifs: absents, rien de tout cela).
OPTIONAL_FILES = ("annonces", "chantiers", "catalogue")
ID_RE = re.compile(r"^[a-z][a-z0-9_]*$")
TIME_RE = re.compile(r"^(([01][0-9]|2[0-3]):[0-5][0-9]|24:00)$")
PLACEHOLDER_RE = re.compile(r"\{([A-Za-z][A-Za-z0-9]*)\}")
FORBIDDEN_DASHES = (chr(0x2014), chr(0x2013))  # tirets cadratin et demi-cadratin, écrits par leur code
# Jours de la démo, de 1 à `reglages.clock.lastDay.day` (fixé au chargement dans main()).
DEMO_DAYS = range(1, 9)

ITEM_CATEGORIES = {"seed", "crop", "forage", "animal_product", "material", "carried", "tool", "food", "quest", "fish",
                   "decoration", "furniture",
                   # Tour 9: poules commandées au catalogue, cadeaux pour les habitants.
                   "animal_order", "gift"}
# Tour 9: verbes des outils (`toolKind`), outils améliorés compris.
TOOL_KINDS = {"hoe", "watering_can", "axe", "fishing_rod"}
SHOPS = {"grocery", "catalogue", "haberdashery"}
DISHES = {"bread", "simple", "stew"}
STATIONS = {"workbench", "stove"}
TIERS = {"P0", "P1"}
WEATHERS = {"sunny", "cloudy", "rain"}
QUALITIES = {"ordinary", "fine"}
WHO = {"actor", "either", "both"}
# Dans une quête à secret (R16), « who » accepte aussi les deux rôles.
WHO_ROLES = WHO | {"informed", "doer"}
SECRET_ROLES = {"informed", "doer"}
MOMENT_MODES = {"quest", "ambient", "both"}
MOMENT_PLAYERS = {"p1", "p2"}
SINCE = {"game_start", "step_start", "day_start"}
GIVE_TO = {"actor", "each", "cellar", "informed", "doer"}
TAKE_FROM = {"actor", "either", "cellar"}
NEEDS = {"belly", "sleep", "heart"}
EVENTS = {"train_arrival", "train_departure"}
WORLD_STATES = {"handcar_shed": {"closed", "open"}}
DIALOGUE_KINDS = {"meeting", "daily", "quest", "scene", "hint", "ending"}
ONCE = {"player", "duo"}
ACTIVITIES = {"home", "absent", "stand", "serve", "work", "play", "host", "wait_train"}
STAGES = {"seed", "sprout", "young", "ripe"}
QUEST_KINDS = {"main", "side"}
SPEAKERS_EXTRA = {"narrator"}
FORM_LEVELS = ["low", "okay", "good", "great", "radiant"]
INDEFINITE_ARTICLES = {"un", "une", "des"}
ENGINE_FLAGS = {"handcar_pushed"}
# Acteurs des moments dessinés par un effet procédural, sans modèle de `index.json` (M-01), avec le
# fichier du rendu qui les dessine (même liste que `tests/moments-recette.test.ts`).
PROCEDURAL_ACTORS = {"glowworm_light": "src/rendu/vers-luisants.ts", "mist_bank": "src/rendu/brume.ts"}
# Tournures qui accordent au genre d'un joueur (rédaction neutre): un avertissement à relire, pas une erreur.
GENDERED_RE = re.compile(
    r"\b(?:tu es|tu étais|tu seras|vous êtes|vous étiez|vous serez|sois|soyez) "
    r"(?:fatigu|prêt|content|épuis|ravi|arrivé|parti|seul|occupé|installé|venu|perdu|les premi|les derni|tous|toutes"
    r"|nouveaux|nouvelles)"
    r"|\b(?:tous|toutes) les deux\b(?! (?:jours|nuits|heures|minutes|semaines|mois|ans)\b)"
    r"|\bles nouveaux\b|\bdes débutant|^(?:cher|chère|chers|chères) ",
    re.IGNORECASE,
)

# Ancienne monnaie (0.12, section 1.3): un nombre ou un espace réservé suivi de « sou(s) ». La monnaie
# s'appelle `economy.currency` (l'aubrin); « sous la pluie » (préposition) n'est pas visé.
OLD_CURRENCY_RE = re.compile(r"[0-9}](?: |\u00a0)sous?\b(?!-)")

# Paramètres de chaque condition: obligatoires, facultatifs. Le type de chaque référence est vérifié plus bas.
CONDITIONS: dict[str, tuple[set[str], set[str]]] = {
    "all": ({"conditions"}, set()),
    "any": ({"conditions"}, set()),
    "not": ({"condition"}, set()),
    "day_is": ({"days"}, set()),
    "day_at_least": ({"day"}, set()),
    "weekday_is": ({"weekdays"}, set()),
    "time_is": ({"from", "to"}, set()),
    "weather_is": ({"weather"}, set()),
    # Tour 7: météo de la veille (la brume) et saison du jour (calendrier de `reglages.memories`).
    "weather_was": ({"weather"}, set()),
    "season_is": ({"seasons"}, {"fromSeasonDay"}),
    # Tour 8: prévision du lendemain, brume du matin, tendresse (D7), étape due.
    "weather_tomorrow_is": ({"weather"}, set()),
    "morning_mist": (set(), set()),
    "tenderness_at_least": ({"level"}, set()),
    "stage_due": ({"stage"}, set()),
    "flag": ({"flag"}, set()),
    "quest_active": ({"quest"}, set()),
    "quest_done": ({"quest"}, set()),
    "step_active": ({"quest", "step"}, set()),
    "quest_step_done": ({"quest", "step"}, set()),
    "dialogue_done": ({"dialogue"}, set()),
    "talked_to": ({"villager"}, {"count", "who", "since"}),
    "given": ({"villager"}, {"item", "count", "who", "since"}),
    "item_owned": ({"item"}, {"count"}),
    "item_in_bag": ({"item"}, {"count", "who"}),
    "sowed": (set(), {"crop", "count", "who", "since"}),
    "watered": (set(), {"count", "who", "since"}),
    "harvested": (set(), {"item", "quality", "count", "who", "since"}),
    "chopped": (set(), {"count", "who", "since"}),
    "crafted": ({"recipe"}, {"count", "who", "since"}),
    "built": ({"construction"}, set()),
    "placed": (set(), {"item", "count", "who", "since"}),
    "ate": ({"item"}, {"count", "who", "since"}),
    "ate_together": (set(), {"atFurniture", "since"}),
    "went_to_bed": (set(), {"item", "who"}),
    "caught": ({"item"}, {"count", "who", "since"}),
    # Pêche 0.12: prise rare ou plus, au coin qui frémit, record, rendu à l'eau, guet pour l'autre.
    "caught_rare": (set(), {"count", "who", "since"}), "caught_hot_spot": (set(), {"count", "who", "since"}),
    "fish_record": (set(), {"count", "who", "since"}), "released_fish": (set(), {"count", "who", "since"}),
    "watched_for_other": (set(), {"count", "who", "since"}),
    # Tour 8: cueillettes ramassées (sans objet: toutes).
    "picked": (set(), {"item", "count", "who", "since"}),
    "used_tool_at": ({"tool", "point"}, {"radius", "who"}),
    "stayed_at": ({"point", "seconds"}, {"who", "seated"}),
    "looked_at": ({"point"}, {"distance", "who", "minDistance", "still"}),
    # Tour 6: moments rares et informations propres (R16).
    "moment_seen": ({"moment"}, {"since"}),
    "secret_role": ({"quest", "role"}, set()),
    "hens_named": (set(), {"count", "who"}),
    "choice_made": ({"dialogue"}, {"choice", "correct", "who", "since", "count"}),
    "variant": ({"group", "value", "of"}, set()),
    "witnessed": ({"event"}, {"who"}),
    "nights_passed": ({"count"}, set()),
    "recipe_known": ({"recipe"}, set()),
    "order_complete": (set(), {"day"}),
    # Tour 9: annonce au tableau (de ce gabarit, à cette étape), chantier bâti, article acheté, scène d'annonce jouée.
    "annonce_active": (set(), {"gabarit", "step"}),
    "improvement_built": ({"id"}, set()),
    "bought": ({"item"}, set()),
    # Tour 10: dans un bâtiment visitable (`interieurs` de la carte).
    "inside": ({"building"}, {"who"}),
    # Tour 10: passé au fauteuil de Solange (`changed`: une coupe qui change quelque chose).
    "haircut": (set(), {"changed", "count", "who", "since"}),
    # Tour 10 (lot L4): sieste, repas pris ensemble, pièce bâtie, rideaux ouverts.
    "napped": (set(), {"count", "who", "since"}),
    "needs_ate_together": (set(), {"count", "since"}),
    "room_built": (set(), {"room", "count", "since"}),
    "curtains_opened": (set(), {"count", "who", "since"}),
    "scene_played": ({"dialogue"}, {"count", "who", "since"}),
    # 0.12 (lot L-quêtes): compteur nommé, compteurs de la basse-cour, de la chèvre, des plis et du marché,
    # bourse commune (README, section 3.1).
    "counter": ({"key"}, {"count", "who", "since"}),
    "animal_released": ({"animal"}, {"count", "who", "since", "point"}),
    "animal_named": ({"animal"}, {"count", "who", "since"}),
    "brood_started": (set(), {"count", "who", "since"}),
    "brood_hatched": (set(), {"count", "who", "since"}),
    "milked": (set(), {"count", "who", "since"}),
    "goat_grazed_spots": (set(), {"count", "who", "since"}),
    "delivered": (set(), {"count", "who", "since"}),
    "stall_stocked": (set(), {"count", "who", "since"}),
    "given_to_stall": (set(), {"item", "count", "who", "since"}),
    "market_served": (set(), {"together", "count", "who", "since"}),
    "money_at_least": ({"amount"}, set()),
    # 0.13 (lot H1, README 2.12): calendrier du bourg, décisions à deux, carnet des habitudes.
    "school_day": (set(), set()),
    "special_day": ({"id"}, set()),
    "season_day_is": ({"days"}, set()),
    "birthday_of": ({"villager"}, set()),
    "decision_made": ({"decision", "option"}, set()),
    "habit_known": ({"villager", "habit"}, set()),
    # 0.13 (lot H2, README 2.13): niveau d'amitié, cadeau offert.
    "bond_at_least": ({"villager", "level"}, set()),
    "gift_given": ({"villager"}, {"taste", "count", "who", "since"}),
}
# 0.13: sortes d'habitudes (colonne « Sorte » de v0-13-habitants.md, en anglais).
HABIT_KINDS = {"routine", "home", "rain", "season", "day", "after_quest", "market", "birthday"}
# 0.13: champs d'un habitant lus par d'autres lots (âge, logis, appellation, goûts du lot H2).
VILLAGER_EXTRA_KEYS = {"age", "homeLabel", "endearment", "tastes"}
SEASON_IDS = ("spring", "summer", "autumn", "winter")
COMMON_CONDITION_KEYS = {"type", "label"}

EFFECTS: dict[str, tuple[set[str], set[str]]] = {
    "reveal_habit": ({"villager", "habit"}, set()),
    # 0.13 (lot H2): lien d'amitié, goût écrit au carnet.
    "add_bond": ({"villager", "amount"}, set()),
    "reveal_taste": ({"villager", "item"}, set()),
    "give_item": ({"item", "count", "to"}, set()),
    "take_item": ({"item", "count", "from"}, set()),
    "give_money": ({"amount"}, set()),
    "take_money": ({"amount"}, set()),
    "set_flag": ({"flag"}, set()),
    "start_quest": ({"quest"}, set()),
    "send_letter": ({"letter"}, set()),
    "unlock_recipe": ({"recipe"}, set()),
    "spawn_object": ({"item", "point"}, set()),
    "spawn_animals": ({"animal", "count", "point"}, {"names", "shuffleVariantsBy"}),
    "reveal_secret": ({"quest"}, set()),
    "set_need": ({"need", "value", "who"}, set()),
    "play_dialogue": ({"dialogue"}, set()),
    "gather_players": ({"point"}, set()),
    "show_text": ({"text"}, set()),
    "set_world_state": ({"key", "value"}, set()),
    "pay_order": (set(), set()),
    "end_demo": (set(), set()),
    # Tour 8: écran d'étape (`end_demo` vaut `end_stage` de l'étape `demo`).
    "end_stage": ({"stage"}, set()),
    "if": ({"condition", "then", "else"}, set()),
}

HINT_TRIGGERS: dict[str, set[str]] = {
    "spawned": set(), "near_interactable": set(), "tool_used": set(), "near_point": {"point"},
    "near_construction": set(), "quest_started": {"quest"}, "aim_cell": {"cellState", "tool", "holding"},
    "sowed": set(), "tool_empty": {"item"}, "crop_ripe_in_view": set(), "time_reached": {"time"},
    "veillee_started": set(), "holding_furniture": set(), "big_purchase_attempt": set(), "letter_received": set(),
    # Tour 8: la lisière (cueillette posée à moins de 6 m, rejet visé).
    "near_forage": set(), "aim_sapling": set(),
    # Tour 9: une annonce au tableau, près du tableau du quai.
    "near_board_annonce": set(),
    # Pêche 0.12: première prise au coin qui frémit, premier guet.
    "fishing_hot_spot": set(), "fishing_watch": set(),
    # 0.13, parcelles libres (parcelles-libres-0-13.md, section 5.4).
    "plot_free": set(), "plot_drag": set(), "plot_placed": set(), "near_friche": set(), "plot_migration": set(),
}

PLACEHOLDERS = {"habit", "level", "speaker", "player", "startPurse", "order", "linesDone", "linesTotal", "amount", "partner", "missing", "item", "price",
                "count", "recipe", "envie", "quest", "title", "construction", "weekday", "day", "hours", "minutes",
                "days", "furniture", "move", "act", "examine", "notebook", "bigPurchase",
                # Tour 6 (R16): couleurs et noms des poules, ligne du secret (chez l'informé seul).
                # 0.12 (élevage): qui a nommé la bête (message aux deux).
                "player",
                # 0.12.2: objets de l'étal posés au pied du coffre plein.
                "ground",
                # 0.13: décisions à deux (question posée, option retenue).
                "question", "choice",
                "henColor1", "henColor2", "henColor3", "henName", "henUnknown", "secret",
                # Tour 7: onglet Souvenirs du carnet (`textes.souvenirs`).
                "villager", "season", "year", "times", "seasonOf",
                # Tour 8: lettres de la commande générée (`courrier.json`) et formats (`textes.orderFormat`).
                "greeting", "tip", "linesDoneText", "n",
                # Tour 9: annonces, chantiers, établi de Basile, paroles d'un habitant en notification.
                "giver", "text", "name", "paid", "time", "discount",
                # Tour 10: pièces bâties et rangement (lot L4).
                "room", "planks", "nails", "used", "total",
                # 0.12 (lot L-économie): liste d'un client du marché, articles vendus à l'étal.
                "list", "items",
                # Pêche 0.12: prises, carnet des poissons, regard sur l'eau.
                "fish", "Fish", "cm", "definite", "pronoun", "at", "Zone"}
# Tour 8: étapes, niveaux de tendresse (D7), modes de continuation (D4), saisons, familles et ressources des commandes.
STAGE_IDS = {"demo", "summer_end", "autumn_end"}
TENDERNESS = ["none", "accomplices", "gentle"]
CONTINUATION = {"same_save", "new_game_per_stage"}
SEASONS = ["spring", "summer", "autumn", "winter"]
ORDER_FAMILIES = {"potager", "basse-cour", "cuisine", "rivière", "bois", "lisière"}
ORDER_RESOURCES = {"garden", "eggs", "river", "wood", "forage"}
WEEKDAYS = ["saturday", "sunday", "monday", "tuesday", "wednesday", "thursday", "friday"]

# Sprite des icônes de l'interface: les vignettes des souvenirs y sont des symboles (tour 7).
ICONS_SOURCE = Path(__file__).resolve().parent.parent / "ui-maquettes" / "outils" / "icones-source.svg"

# Drapeaux posés par la simulation elle-même (tour 10, `simulation/bourg.ts`): départs de la rue Haute.
FLAGS_SET_BY_CODE = {"achille_here", "solange_here", "solange_note_sent", "achille_wish_open", "solange_wish_open",
                     "achille_cart_said", "basket_carried",
                     # 0.12: posé par le chantier `goat_shed` de la file `elevage` (`<id>_built`, lot L-économie).
                     "goat_shed_built"}

# Points de carte demandés par les données. Le level designer les crée dans donnees/cartes/ (voir README).
NAMED_POINTS_OUTSIDE_MAP = {"offstage"}


class Report:
    def __init__(self) -> None:
        self.errors: list[str] = []
        self.warnings: list[str] = []

    def error(self, where: str, message: str) -> None:
        self.errors.append(f"{where}: {message}")

    def warn(self, where: str, message: str) -> None:
        self.warnings.append(f"{where}: {message}")


class Registry:
    """Identifiants connus et références rencontrées."""

    def __init__(self) -> None:
        self.items: dict[str, dict[str, Any]] = {}
        self.recipes: dict[str, dict[str, Any]] = {}
        self.constructions: set[str] = set()
        self.animals: set[str] = set()
        self.crops: set[str] = set()
        self.villagers: set[str] = set()
        # 0.13: habitudes (habitant, habitude), jours particuliers, références à vérifier à la fin.
        self.habits: set[tuple[str, str]] = set()
        self.special_days: set[str] = set()
        self.habit_refs: list[tuple[str, str, str]] = []
        self.dialogues: set[str] = set()
        self.quests: dict[str, set[str]] = {}
        self.letters: set[str] = set()
        self.senders: set[str] = set()
        self.messages: set[str] = set()
        self.envies: dict[str, str] = {}
        self.points_used: dict[str, str] = {}
        self.flags_set: set[str] = set()
        self.flags_read: dict[str, str] = {}
        self.quests_started_by_effect: set[str] = set()
        self.order_days: set[int] = set()
        self.order_days_used: dict[int, str] = {}
        self.variants: dict[str, list[tuple[Any, Any, str]]] = {}
        self.moments: set[str] = set()
        self.secret_quests: set[str] = set()
        self.secret_role_uses: list[tuple[str, str]] = []
        self.moments_seen: list[tuple[str, str]] = []


def load(folder: Path, report: Report) -> dict[str, Any]:
    data: dict[str, Any] = {}
    for name in FILES:
        path = folder / f"{name}.json"
        if not path.exists():
            report.error(path.name, "fichier absent")
            continue
        try:
            data[name] = json.loads(path.read_text(encoding="utf-8"))
        except json.JSONDecodeError as exc:
            report.error(path.name, f"JSON invalide ({exc})")
            continue
        if data[name].get("version") != 1:
            report.error(path.name, "« version » doit valoir 1")
    for name in OPTIONAL_FILES:
        path = folder / f"{name}.json"
        if not path.exists():
            continue
        try:
            data[name] = json.loads(path.read_text(encoding="utf-8"))
        except json.JSONDecodeError as exc:
            report.error(path.name, f"JSON invalide ({exc})")
            continue
        if data[name].get("version") != 1:
            report.error(path.name, "« version » doit valoir 1")
    load_village(folder, data, report)
    return data


def load_village(folder: Path, data: dict[str, Any], report: Report) -> None:
    """0.13 (README 2.12): `calendrier.json`, et `habitants-0-13.json` fusionné par identifiant."""
    for name, key in (("calendrier", "calendrier"), ("habitants-0-13", "habitants013")):
        path = folder / f"{name}.json"
        if not path.exists():
            continue
        try:
            data[key] = json.loads(path.read_text(encoding="utf-8"))
        except json.JSONDecodeError as exc:
            report.error(path.name, f"JSON invalide ({exc})")
            continue
        if data[key].get("version") != 1:
            report.error(path.name, "« version » doit valoir 1")
    extra = data.pop("habitants013", None)
    if extra is None or "habitants" not in data:
        return
    villagers = data["habitants"].setdefault("villagers", [])
    for i, villager in enumerate(extra.get("villagers", [])):
        vid = villager.get("id")
        base = next((x for x in villagers if x.get("id") == vid), None)
        if base is None:
            if "habits" not in villager:
                report.error(f"habitants-0-13.villagers[{i}]", "champ « habits » manquant (habitant nouveau)")
            villagers.append(villager)
            continue
        for k, value in villager.items():
            if k == "dialogues":
                base.setdefault("dialogues", []).extend(value)
            else:
                base[k] = value


def check_tour9(data: dict[str, Any], reg: Registry, report: Report) -> None:
    """Annonces, chantiers et catalogue de la semaine (tour 9): renvois, sortes, textes."""
    textes = data.get("textes", {})
    ids: set[str] = set()
    for a in data.get("annonces", {}).get("annonces", []):
        w = f"annonces.{a.get('id')}"
        if check_id(a.get("id"), w, report):
            if a["id"] in ids:
                report.error(w, "gabarit en double")
            ids.add(a["id"])
        if a.get("kind") not in ("help", "together"):
            report.error(w, f"« kind » inconnu {a.get('kind')!r} (help ou together)")
        ref("villager", a.get("giver"), w, reg, report)
        seasons = a.get("seasons")
        if not isinstance(seasons, list) or not seasons or not set(seasons) <= set(SEASONS):
            report.error(w, f"saisons attendues parmi {', '.join(SEASONS)}")
        if ("lines" in a) == ("variants" in a):
            report.error(w, "« lines » ou « variants » attendu (un des deux)")
        variants = a.get("variants") or [a.get("lines") or []]
        for lines in variants:
            for line in lines:
                ref("item", line.get("item"), w, reg, report)
                check_count(line.get("count"), w, report)
        for key in ("scene", "uniqueScene"):
            if a.get(key) is not None:
                ref("dialogue", a[key], w, reg, report)
        if a.get("unique") is not None:
            ref("item", a["unique"], w, reg, report)
        block = textes.get("annonces", {}).get(a.get("id"), {})
        for key in ("title", "text") + (() if a.get("scene") else ("thanks",)):
            if not isinstance(block.get(key), str):
                report.error(w, f"textes.annonces.{a.get('id')}.{key} manquant")
        if not a.get("scene") and not any(variants):
            report.error(w, "une annonce sans demande finit par une scène")
    queues = {"bourg", "maisonnette", "elevage"}
    for ch in data.get("chantiers", {}).get("improvements", []):
        w = f"chantiers.{ch.get('id')}"
        check_id(ch.get("id"), w, report)
        if ch.get("queue") not in queues:
            report.error(w, f"file inconnue {ch.get('queue')!r}")
        if ch.get("payAt") not in ("board", "basile"):
            report.error(w, f"« payAt » inconnu {ch.get('payAt')!r} (board ou basile)")
        if not isinstance(ch.get("price"), int) or ch["price"] <= 0:
            report.error(w, "« price » entier positif attendu")
        if not isinstance(textes.get("chantiers", {}).get(ch.get("id"), {}).get("name"), str):
            report.error(w, f"textes.chantiers.{ch.get('id')}.name manquant")
    cat = data.get("catalogue")
    if cat is None:
        return
    listed: set[str] = set()
    for i, page in enumerate(cat.get("pages", [])):
        w = f"catalogue.pages[{i}]"
        if page.get("season") not in SEASONS or page.get("week") not in (1, 2, 3):
            report.error(w, "saison et semaine de saison (1 à 3) attendues")
        for item in page.get("items", []):
            ref("item", item, w, reg, report)
            if item in listed:
                report.error(w, f"{item!r} sur deux pages")
            listed.add(item)
            if reg.items.get(item, {}).get("shop") != "catalogue":
                report.error(w, f"{item!r} n'est pas en vente au catalogue")
    for g in cat.get("gifts", []):
        w = f"catalogue.gifts.{g.get('item')}"
        ref("item", g.get("item"), w, reg, report)
        ref("villager", g.get("villager"), w, reg, report)
        ref("dialogue", g.get("wish"), w, reg, report)
        ref("text", g.get("thanks"), w, reg, report)
        if reg.items.get(g.get("item"), {}).get("category") != "gift":
            report.error(w, "catégorie « gift » attendue")
    for item, hen in cat.get("hens", {}).items():
        ref("item", item, "catalogue.hens", reg, report)
        ref("text", hen.get("naming"), "catalogue.hens", reg, report)
    for item in list(cat.get("copies", {})) + list(cat.get("seasonal", {})):
        ref("item", item, "catalogue", reg, report)


def check_id(value: Any, where: str, report: Report) -> bool:
    if not isinstance(value, str) or not ID_RE.match(value):
        report.error(where, f"identifiant invalide {value!r} (minuscules, chiffres, soulignés, en anglais)")
        return False
    return True


def register(target: dict[str, Any] | set[str], value: Any, where: str, report: Report, payload: Any = None) -> None:
    if not check_id(value, where, report):
        return
    if value in target:
        report.error(where, f"identifiant en double {value!r}")
        return
    if isinstance(target, dict):
        target[value] = payload
    else:
        target.add(value)


def check_time(value: Any, where: str, report: Report) -> None:
    if not isinstance(value, str) or not TIME_RE.match(value):
        report.error(where, f"heure invalide {value!r} (format HH:MM, de 00:00 à 24:00)")


def walk_strings(node: Any, where: str, report: Report) -> None:
    if isinstance(node, str):
        for dash in FORBIDDEN_DASHES:
            if dash in node:
                report.error(where, f"tiret long interdit dans {node[:50]!r}")
        for name in PLACEHOLDER_RE.findall(node):
            if name not in PLACEHOLDERS:
                report.error(where, f"espace réservé inconnu {{{name}}}")
        if "TODO" in node:
            report.error(where, "« TODO » dans un texte")
        old_money = OLD_CURRENCY_RE.search(node)
        if old_money:
            report.warn(where, f"ancienne monnaie « {old_money.group(0)} » dans {node[:60]!r} (écrire aubrins)")
        found = GENDERED_RE.search(node)
        if found:
            report.warn(where, f"accord au genre possible « {found.group(0)} » dans {node[:60]!r} (rédaction neutre)")
    elif isinstance(node, dict):
        for key, value in node.items():
            walk_strings(value, f"{where}.{key}", report)
    elif isinstance(node, list):
        for index, value in enumerate(node):
            walk_strings(value, f"{where}[{index}]", report)


def ref(kind: str, value: Any, where: str, reg: Registry, report: Report) -> None:
    """Vérifie qu'une référence existe (ou la note pour les points de carte)."""
    known: dict[str, Any] = {
        "item": reg.items, "recipe": reg.recipes, "construction": reg.constructions, "animal": reg.animals,
        "villager": reg.villagers, "dialogue": reg.dialogues, "quest": reg.quests, "letter": reg.letters,
        "text": reg.messages, "envie": reg.envies,
    }
    if kind == "point":
        if isinstance(value, str) and ID_RE.match(value):
            reg.points_used.setdefault(value, where)
        else:
            report.error(where, f"point de carte invalide {value!r}")
        return
    table = known[kind]
    if value not in table:
        report.error(where, f"{kind} inconnu {value!r}")


def check_count(value: Any, where: str, report: Report) -> None:
    if not isinstance(value, int) or isinstance(value, bool) or value < 1:
        report.error(where, f"nombre entier positif attendu, pas {value!r}")


def check_condition(cond: Any, where: str, reg: Registry, report: Report) -> None:
    if not isinstance(cond, dict) or "type" not in cond:
        report.error(where, "condition sans « type »")
        return
    ctype = cond["type"]
    if ctype not in CONDITIONS:
        report.error(where, f"condition inconnue {ctype!r}")
        return
    required, optional = CONDITIONS[ctype]
    keys = set(cond) - COMMON_CONDITION_KEYS
    for missing in required - keys:
        report.error(where, f"{ctype}: paramètre « {missing} » manquant")
    for extra in keys - required - optional:
        report.error(where, f"{ctype}: paramètre inconnu « {extra} »")
    w = f"{where}({ctype})"
    if ctype in ("all", "any"):
        for i, sub in enumerate(cond.get("conditions", [])):
            check_condition(sub, f"{w}[{i}]", reg, report)
    if ctype == "not":
        check_condition(cond.get("condition"), w, reg, report)
    if ctype == "season_day_is":
        days = cond.get("days")
        if not isinstance(days, list) or not days or not all(isinstance(d, int) and 1 <= d <= 21 for d in days):
            report.error(w, f"jours de saison de 1 à 21 attendus {days!r}")
    elif "days" in cond:
        if not isinstance(cond["days"], list) or not all(d in DEMO_DAYS for d in cond["days"]):
            report.error(w, f"jours hors de la démo {cond['days']!r}")
    if ctype == "day_at_least" and cond.get("day") not in DEMO_DAYS:
        report.error(w, f"jour hors de la démo {cond.get('day')!r}")
    if ctype == "variant":
        of, value = cond.get("of"), cond.get("value")
        if not isinstance(of, int) or of < 2 or not isinstance(value, int) or not 0 <= value < of:
            report.error(w, f"variant: « of » entier au moins 2 et « value » de 0 à of-1 attendus ({value!r} sur {of!r})")
        elif check_id(cond.get("group"), w, report):
            reg.variants.setdefault(cond["group"], []).append((of, value, w))
    if ctype == "order_complete" and "day" in cond:
        if cond["day"] not in DEMO_DAYS:
            report.error(w, f"jour hors de la démo {cond['day']!r}")
        else:
            reg.order_days_used.setdefault(cond["day"], w)
    if ctype == "time_is":
        check_time(cond.get("from"), w, report)
        check_time(cond.get("to"), w, report)
    if "weather" in cond and cond["weather"] not in WEATHERS:
        report.error(w, f"météo inconnue {cond['weather']!r}")
    if ctype == "season_is":
        seasons = cond.get("seasons")
        if not isinstance(seasons, list) or not seasons or not set(seasons) <= {"spring", "summer", "autumn", "winter"}:
            report.error(w, f"saisons attendues parmi spring, summer, autumn, winter ({seasons!r})")
        start = cond.get("fromSeasonDay", 1)
        if not isinstance(start, int) or start < 1:
            report.error(w, f"« fromSeasonDay » entier positif attendu ({start!r})")
    if "quality" in cond and cond["quality"] not in QUALITIES:
        report.error(w, f"qualité inconnue {cond['quality']!r}")
    if "who" in cond and cond["who"] not in WHO_ROLES:
        report.error(w, f"« who » inconnu {cond['who']!r}")
    if ctype == "secret_role":
        if cond.get("role") not in SECRET_ROLES:
            report.error(w, f"rôle inconnu {cond.get('role')!r} (informed ou doer)")
        reg.secret_role_uses.append((str(cond.get("quest")), w))
    if ctype == "moment_seen":
        reg.moments_seen.append((str(cond.get("moment")), w))
    if ctype == "tenderness_at_least" and cond.get("level") not in TENDERNESS:
        report.error(w, f"niveau de tendresse inconnu {cond.get('level')!r} ({', '.join(TENDERNESS)})")
    if ctype == "stage_due" and cond.get("stage") not in STAGE_IDS:
        report.error(w, f"étape inconnue {cond.get('stage')!r}")
    if ctype == "choice_made" and "correct" in cond and cond["correct"] is not True:
        report.error(w, "choice_made: « correct » ne peut valoir que true")
    if "since" in cond and cond["since"] not in SINCE:
        report.error(w, f"« since » inconnu {cond['since']!r}")
    if "count" in cond:
        check_count(cond["count"], w, report)
    if "event" in cond and cond["event"] not in EVENTS:
        report.error(w, f"événement inconnu {cond['event']!r}")
    if ctype == "flag":
        reg.flags_read.setdefault(cond.get("flag", ""), w)
    if ctype == "special_day" and cond.get("id") not in reg.special_days:
        report.error(w, f"jour particulier inconnu {cond.get('id')!r} (calendrier.json)")
    if ctype == "habit_known":
        reg.habit_refs.append((str(cond.get("villager")), str(cond.get("habit")), w))
    if ctype in ("bond_at_least", "gift_given"):
        ref("villager", cond.get("villager"), w, reg, report)
    if ctype == "bond_at_least" and (not isinstance(cond.get("level"), int) or not 0 <= cond["level"] <= 5):
        report.error(w, f"niveau d'amitié de 0 à 5 attendu, pas {cond.get('level')!r}")
    if ctype == "gift_given" and "taste" in cond and cond["taste"] not in ("adore", "aime", "neutre", "deteste"):
        report.error(w, f"goût inconnu {cond['taste']!r}")
    if ctype == "decision_made":
        check_id(cond.get("decision"), w, report)
        check_id(cond.get("option"), w, report)
    if ctype == "birthday_of" and cond.get("villager") == "self":
        return
    for key, kind in (("item", "item"), ("villager", "villager"), ("quest", "quest"), ("dialogue", "dialogue"),
                      ("recipe", "recipe"), ("construction", "construction"), ("point", "point"),
                      ("atFurniture", "item"), ("tool", "item")):
        if key in cond:
            ref(kind, cond[key], w, reg, report)
    if "step" in cond and cond.get("quest") in reg.quests and cond["step"] not in reg.quests[cond["quest"]]:
        report.error(w, f"étape inconnue {cond['step']!r} de la quête {cond['quest']!r}")
    if "tool" in cond and cond["tool"] in reg.items and reg.items[cond["tool"]].get("category") != "tool":
        report.error(w, f"{cond['tool']!r} n'est pas un outil")
    if "crop" in cond and cond["crop"] not in reg.crops:
        report.error(w, f"culture inconnue {cond['crop']!r}")


def check_conditions(conds: Any, where: str, reg: Registry, report: Report) -> None:
    if not isinstance(conds, list):
        report.error(where, "liste de conditions attendue")
        return
    for i, cond in enumerate(conds):
        check_condition(cond, f"{where}[{i}]", reg, report)


def check_effect(eff: Any, where: str, reg: Registry, report: Report) -> None:
    if not isinstance(eff, dict) or "type" not in eff:
        report.error(where, "effet sans « type »")
        return
    etype = eff["type"]
    if etype not in EFFECTS:
        report.error(where, f"effet inconnu {etype!r}")
        return
    required, optional = EFFECTS[etype]
    keys = set(eff) - {"type"}
    for missing in required - keys:
        report.error(where, f"{etype}: paramètre « {missing} » manquant")
    for extra in keys - required - optional:
        report.error(where, f"{etype}: paramètre inconnu « {extra} »")
    w = f"{where}({etype})"
    if etype == "if":
        check_condition(eff.get("condition"), w, reg, report)
        check_effects(eff.get("then", []), f"{w}.then", reg, report)
        check_effects(eff.get("else", []), f"{w}.else", reg, report)
    if "count" in eff:
        check_count(eff["count"], w, report)
    if etype == "give_item" and eff.get("to") not in GIVE_TO:
        report.error(w, f"« to » inconnu {eff.get('to')!r}")
    if etype == "take_item" and eff.get("from") not in TAKE_FROM:
        report.error(w, f"« from » inconnu {eff.get('from')!r}")
    if etype == "set_need":
        if eff.get("need") not in NEEDS:
            report.error(w, f"besoin inconnu {eff.get('need')!r}")
        if eff.get("who") not in WHO:
            report.error(w, f"« who » inconnu {eff.get('who')!r}")
    if etype == "set_flag":
        reg.flags_set.add(eff.get("flag", ""))
    if etype == "reveal_habit":
        reg.habit_refs.append((str(eff.get("villager")), str(eff.get("habit")), w))
    if etype in ("add_bond", "reveal_taste"):
        ref("villager", eff.get("villager"), w, reg, report)
    if etype == "add_bond" and (not isinstance(eff.get("amount"), int) or eff["amount"] < 0):
        report.error(w, "lien: un entier positif ou nul attendu")
    if etype == "reveal_taste":
        ref("item", eff.get("item"), w, reg, report)
    if etype == "start_quest":
        reg.quests_started_by_effect.add(eff.get("quest", ""))
    if etype == "set_world_state":
        allowed = WORLD_STATES.get(eff.get("key", ""))
        if allowed is None or eff.get("value") not in allowed:
            report.error(w, f"état du monde inconnu {eff.get('key')!r}={eff.get('value')!r}")
    if etype == "end_stage" and eff.get("stage") not in STAGE_IDS:
        report.error(w, f"étape inconnue {eff.get('stage')!r}")
    if etype == "spawn_animals" and "names" in eff and len(eff["names"]) != eff.get("count"):
        report.error(w, "autant de noms que de bêtes attendus")
    for key, kind in (("item", "item"), ("quest", "quest"), ("letter", "letter"), ("recipe", "recipe"),
                      ("point", "point"), ("animal", "animal"), ("dialogue", "dialogue"), ("text", "text")):
        if key in eff:
            ref(kind, eff[key], w, reg, report)


def check_effects(effs: Any, where: str, reg: Registry, report: Report) -> None:
    if not isinstance(effs, list):
        report.error(where, "liste d'effets attendue")
        return
    for i, eff in enumerate(effs):
        check_effect(eff, f"{where}[{i}]", reg, report)


def collect(data: dict[str, Any], reg: Registry, report: Report) -> None:
    """Premier passage: tous les identifiants, avant de vérifier les références."""
    objets = data.get("objets", {})
    for i, item in enumerate(objets.get("items", [])):
        register(reg.items, item.get("id"), f"objets.items[{i}]", report, item)
    for i, recipe in enumerate(objets.get("recipes", [])):
        register(reg.recipes, recipe.get("id"), f"objets.recipes[{i}]", report, recipe)
    for i, cons in enumerate(objets.get("constructions", [])):
        register(reg.constructions, cons.get("id"), f"objets.constructions[{i}]", report)
    for i, animal in enumerate(objets.get("animals", [])):
        register(reg.animals, animal.get("id"), f"objets.animals[{i}]", report)
    for i, crop in enumerate(data.get("cultures", {}).get("crops", [])):
        register(reg.crops, crop.get("id"), f"cultures.crops[{i}]", report)
    for i, villager in enumerate(data.get("habitants", {}).get("villagers", [])):
        register(reg.villagers, villager.get("id"), f"habitants.villagers[{i}]", report)
        for habit in villager.get("habits", []):
            reg.habits.add((str(villager.get("id")), str(habit.get("id"))))
        for j, dialogue in enumerate(villager.get("dialogues", [])):
            register(reg.dialogues, dialogue.get("id"), f"habitants.{villager.get('id')}.dialogues[{j}]", report)
    for i, day in enumerate(data.get("calendrier", {}).get("specialDays", [])):
        register(reg.special_days, day.get("id"), f"calendrier.specialDays[{i}]", report)
    for i, quest in enumerate(data.get("quetes", {}).get("quests", [])):
        steps: set[str] = set()
        for j, step in enumerate(quest.get("steps", [])):
            register(steps, step.get("id"), f"quetes.{quest.get('id')}.steps[{j}]", report)
        register(reg.quests, quest.get("id"), f"quetes.quests[{i}]", report, steps)
    courrier = data.get("courrier", {})
    for i, letter in enumerate(courrier.get("letters", [])):
        register(reg.letters, letter.get("id"), f"courrier.letters[{i}]", report)
    for i, sender in enumerate(courrier.get("senders", [])):
        register(reg.senders, sender.get("id"), f"courrier.senders[{i}]", report)
    for key in data.get("textes", {}).get("messages", {}):
        register(reg.messages, key, "textes.messages", report)
    for i, envie in enumerate(data.get("envies", {}).get("envies", [])):
        register(reg.envies, envie.get("id"), f"envies.envies[{i}]", report, envie.get("kind"))
    hints: set[str] = set()
    for i, hint in enumerate(data.get("astuces", {}).get("hints", [])):
        register(hints, hint.get("id"), f"astuces.hints[{i}]", report)


def check_objets(data: dict[str, Any], reg: Registry, report: Report) -> None:
    objets = data.get("objets", {})
    for item_id, item in reg.items.items():
        w = f"objets.{item_id}"
        for key in ("name", "plural", "category", "stack", "model", "tier"):
            if key not in item:
                report.error(w, f"champ « {key} » manquant")
        indefinite, name = item.get("indefinite"), item.get("name")
        # Les mythiques ont un nom propre (« la Dorée »), jamais d'article indéfini.
        if isinstance(item.get("fish"), dict) and item["fish"].get("rarity") == "mythic":
            continue
        if not isinstance(indefinite, str):
            report.error(w, "champ « indefinite » manquant (le nom avec son article indéfini: « un matelas »)")
        elif isinstance(name, str) and not (
            indefinite.split(" ", 1)[0] in INDEFINITE_ARTICLES and indefinite.endswith(" " + name)
        ):
            report.error(w, f"« indefinite » attendu: « un », « une » ou « des » suivi du nom {name!r}, trouvé {indefinite!r}")
        if item.get("category") not in ITEM_CATEGORIES:
            report.error(w, f"catégorie inconnue {item.get('category')!r}")
        check_count(item.get("stack"), f"{w}.stack", report)
        for key in ("buyPrice", "sellPrice"):
            value = item.get(key)
            if value is not None and (not isinstance(value, int) or value < 0):
                report.error(w, f"{key} doit être un entier positif ou null")
        if item.get("shop") is not None:
            if item["shop"] not in SHOPS:
                report.error(w, f"boutique inconnue {item['shop']!r}")
            if item.get("buyPrice") is None:
                report.error(w, "vendu en boutique sans prix d'achat")
        if item.get("tier") not in TIERS:
            report.error(w, f"tier inconnu {item.get('tier')!r}")
        if "availableFromDay" in item and item["availableFromDay"] not in DEMO_DAYS:
            report.error(w, f"« availableFromDay » hors de la démo {item['availableFromDay']!r}")
        if item.get("category") == "seed" and item.get("plants") not in reg.crops:
            report.error(w, f"« plants » ne désigne pas une culture: {item.get('plants')!r}")
        if item.get("category") == "food" and item.get("dish") not in DISHES:
            report.error(w, f"« dish » inconnu {item.get('dish')!r}")
        if item.get("category") in ("furniture", "decoration"):
            fp = item.get("footprint")
            if not isinstance(fp, dict) or not all(isinstance(fp.get(k), int) and fp[k] >= 1 for k in ("w", "d")):
                report.error(w, "« footprint » {w, d} attendu")
            for key in ("comfort", "beauty"):
                if not isinstance(item.get(key), int) or not 0 <= item[key] <= 5:
                    report.error(w, f"« {key} » attendu de 0 à 5")
        if "readText" in item:
            ref("text", item["readText"], w, reg, report)
        if "qualities" in item and not set(item["qualities"]) <= QUALITIES:
            report.error(w, "qualités inconnues")
    for recipe_id, recipe in reg.recipes.items():
        w = f"objets.recipes.{recipe_id}"
        if recipe.get("station") not in STATIONS:
            report.error(w, f"poste inconnu {recipe.get('station')!r}")
        for io in recipe.get("inputs", []) + [recipe.get("output", {})]:
            ref("item", io.get("item"), w, reg, report)
            check_count(io.get("count"), w, report)
        if not isinstance(recipe.get("seconds"), (int, float)) or recipe["seconds"] <= 0:
            report.error(w, "« seconds » positif attendu")
        if not isinstance(recipe.get("requiresUnlock"), bool):
            report.error(w, "« requiresUnlock » booléen attendu")
    for i, cons in enumerate(objets.get("constructions", [])):
        w = f"objets.constructions.{cons.get('id')}"
        ref("point", cons.get("point"), w, reg, report)
        for req in cons.get("requires", []):
            ref("construction", req, w, reg, report)
        if cons.get("kind") == "carry":
            carry = cons.get("carry", {})
            ref("item", carry.get("item"), w, reg, report)
            ref("point", carry.get("from"), w, reg, report)
        elif cons.get("kind") == "guided":
            elements: set[str] = set()
            for j, element in enumerate(cons.get("elements", [])):
                register(elements, element.get("id"), f"{w}.elements[{j}]", report)
                for io in element.get("inputs", []):
                    ref("item", io.get("item"), w, reg, report)
                    check_count(io.get("count"), w, report)
            if not elements:
                report.error(w, "construction guidée sans élément")
        else:
            report.error(w, f"« kind » inconnu {cons.get('kind')!r}")
    for place, entries in objets.get("startingInventory", {}).items():
        for entry in entries:
            ref("item", entry.get("item"), f"objets.startingInventory.{place}", reg, report)
            check_count(entry.get("count"), f"objets.startingInventory.{place}", report)
    for animal in objets.get("animals", []):
        ref("item", animal.get("produces", {}).get("item"), f"objets.animals.{animal.get('id')}", reg, report)


def check_cultures(data: dict[str, Any], reg: Registry, report: Report) -> None:
    for crop in data.get("cultures", {}).get("crops", []):
        w = f"cultures.{crop.get('id')}"
        ref("item", crop.get("seed"), w, reg, report)
        ref("item", crop.get("harvest"), w, reg, report)
        check_count(crop.get("growthDays"), f"{w}.growthDays", report)
        check_count(crop.get("yieldPerCell"), f"{w}.yieldPerCell", report)
        stages = crop.get("stagesByDay", [])
        if len(stages) != crop.get("growthDays", 0) + 1:
            report.error(w, "« stagesByDay » doit avoir growthDays + 1 entrées")
        if stages and stages[-1] != "ripe":
            report.error(w, "le dernier stade doit être « ripe »")
        for stage in stages:
            if stage not in STAGES or stage not in crop.get("models", {}):
                report.error(w, f"stade sans modèle ou inconnu {stage!r}")


def check_habitants(data: dict[str, Any], reg: Registry, report: Report) -> None:
    for villager in data.get("habitants", {}).get("villagers", []):
        vid = villager.get("id")
        w = f"habitants.{vid}"
        for key in ("firstName", "label", "model", "soundMotif", "schedule", "dialogues"):
            if key not in villager:
                report.error(w, f"champ « {key} » manquant")
        for i, entry in enumerate(villager.get("schedule", [])):
            ws = f"{w}.schedule[{i}]"
            check_time(entry.get("from"), ws, report)
            check_time(entry.get("to"), ws, report)
            point = entry.get("point")
            if point not in NAMED_POINTS_OUTSIDE_MAP:
                ref("point", point, ws, reg, report)
            if entry.get("activity") not in ACTIVITIES:
                report.error(ws, f"activité inconnue {entry.get('activity')!r}")
            check_conditions(entry.get("when", []), f"{ws}.when", reg, report)
        if not any(not e.get("when") for e in villager.get("schedule", [])):
            report.error(w, "aucune entrée d'emploi du temps sans condition (il faut un horaire par défaut)")
        check_habits(villager, w, reg, report)
        if not any(d.get("kind") == "daily" and not d.get("when") for d in villager.get("dialogues", [])):
            report.error(w, "aucune réplique du quotidien sans condition (il faut une réplique par défaut)")
        for dialogue in villager.get("dialogues", []):
            wd = f"{w}.{dialogue.get('id')}"
            if dialogue.get("kind") not in DIALOGUE_KINDS:
                report.error(wd, f"« kind » inconnu {dialogue.get('kind')!r}")
            if "once" in dialogue and dialogue["once"] not in ONCE:
                report.error(wd, f"« once » inconnu {dialogue['once']!r}")
            if not isinstance(dialogue.get("priority"), int):
                report.error(wd, "« priority » entier attendu")
            if "tier" in dialogue and dialogue["tier"] not in TIERS:
                report.error(wd, f"tier inconnu {dialogue['tier']!r}")
            # Une scène à deux jouée par un effet (le dessin de Jeanne, tour 9) n'a pas de point de rendez-vous.
            if dialogue.get("shared") and dialogue.get("point") is not None:
                ref("point", dialogue.get("point"), wd, reg, report)
            check_conditions(dialogue.get("when", []), f"{wd}.when", reg, report)
            check_lines(dialogue.get("lines", []), wd, reg, report)
            check_effects(dialogue.get("effects", []), f"{wd}.effects", reg, report)


def check_habits(villager: dict[str, Any], w: str, reg: Registry, report: Report) -> None:
    """0.13 (README 2.12): habitudes, champ `habit` des entrées, répliques et écriteaux, anniversaire."""
    habits = villager.get("habits", [])
    if not isinstance(habits, list):
        report.error(w, "« habits » doit être une liste")
        return
    ids: set[str] = set()
    for i, habit in enumerate(habits):
        wh = f"{w}.habits[{i}]"
        hid = habit.get("id")
        if check_id(hid, wh, report):
            if hid in ids:
                report.error(wh, f"habitude en double {hid!r}")
            ids.add(hid)
        if habit.get("kind") not in HABIT_KINDS:
            report.error(wh, f"sorte inconnue {habit.get('kind')!r} ({', '.join(sorted(HABIT_KINDS))})")
        if not isinstance(habit.get("label"), str) or not habit.get("label"):
            report.error(wh, "« label » attendu")
        if "announce" in habit and not isinstance(habit["announce"], str):
            report.error(wh, "« announce » doit être un texte")
        reveals = habit.get("reveals", [])
        if not reveals:
            report.warn(wh, "aucune réplique ni écriteau pour l'apprendre")
        for j, rev in enumerate(reveals if isinstance(reveals, list) else []):
            wr = f"{wh}.reveals[{j}]"
            if ("by" in rev) == ("sign" in rev) or not isinstance(rev.get("text"), str):
                report.error(wr, "« by » ou « sign », et « text », attendus")
            elif "by" in rev:
                ref("villager", rev["by"], wr, reg, report)
            else:
                check_id(rev["sign"], wr, report)
                reg.points_used.setdefault(rev["sign"], wr)
    for i, entry in enumerate(villager.get("schedule", [])):
        if "habit" in entry and entry["habit"] not in ids:
            report.error(f"{w}.schedule[{i}]", f"habitude inconnue {entry['habit']!r}")
    for habit in habits:
        if habit.get("kind") != "market" and not any(e.get("habit") == habit.get("id") for e in villager.get("schedule", [])):
            report.error(f"{w}.habits.{habit.get('id')}", "aucune entrée du planning")
    birthday = villager.get("birthday")
    if birthday is not None and (not isinstance(birthday, dict) or birthday.get("season") not in SEASON_IDS or not isinstance(birthday.get("day"), int) or not 1 <= birthday["day"] <= 21):
        report.error(f"{w}.birthday", "« season » et « day » (1 à 21) attendus")


def check_calendar(data: dict[str, Any], reg: Registry, report: Report) -> None:
    """0.13: jours particuliers de `calendrier.json`, anniversaires des habitants, références aux habitudes."""
    cal = data.get("calendrier")
    blocked: set[tuple[str, int]] = set()
    if cal is not None:
        for i, day in enumerate(cal.get("specialDays", [])):
            wd = f"calendrier.specialDays[{i}]"
            weekdays = day.get("weekdays", [])
            by_season = day.get("seasonDays", {})
            if not weekdays and not by_season:
                report.error(wd, "« weekdays » ou « seasonDays » attendu")
            for s, days in by_season.items():
                if s not in SEASON_IDS or not all(isinstance(d, int) and 1 <= d <= 21 for d in days):
                    report.error(wd, f"seasonDays: saison ou jours invalides {s!r}")
                elif day.get("noBirthday"):
                    blocked.update((s, d) for d in days)
            for key in ("from", "to"):
                if key in day:
                    check_time(day[key], wd, report)
    taken: dict[tuple[str, int], str] = {}
    for villager in data.get("habitants", {}).get("villagers", []):
        b = villager.get("birthday")
        if not isinstance(b, dict) or b.get("season") not in SEASON_IDS or not isinstance(b.get("day"), int):
            if b is None:
                report.warn(f"habitants.{villager.get('id')}", "pas d'anniversaire (« birthday »)")
            continue
        key = (b["season"], b["day"])
        w = f"habitants.{villager.get('id')}.birthday"
        if key in taken:
            report.error(w, f"le même jour que celui de {taken[key]!r}")
        taken[key] = str(villager.get("id"))
        if (b["day"] - 1) % 7 == 0:
            report.error(w, "un samedi (jour du train)")
        if key in blocked:
            report.error(w, "un jour de fête, de moisson ou de lumignons")
    for villager, habit, where in reg.habit_refs:
        if (villager, habit) not in reg.habits:
            report.error(where, f"habitude inconnue {villager!r}.{habit!r}")


def check_lines(lines: Any, where: str, reg: Registry, report: Report) -> None:
    if not isinstance(lines, list) or not lines:
        report.error(where, "« lines » doit être une liste non vide")
        return
    for i, line in enumerate(lines):
        wl = f"{where}.lines[{i}]"
        if "choices" in line:
            choice_ids: set[str] = set()
            for j, choice in enumerate(line["choices"]):
                wc = f"{wl}.choices[{j}]"
                register(choice_ids, choice.get("id"), wc, report)
                if not choice.get("text"):
                    report.error(wl, "choix sans texte")
                # Une scène à deux dont l'habitant répond après les deux choix (`same`, `different`) peut
                # laisser chaque choix sans réplique propre (le miroir de Solange, tour 10).
                if choice.get("reply") or not ("same" in line or "different" in line):
                    check_lines(choice.get("reply", []), wc, reg, report)
                # Choix à bonne et mauvaise réponse (R16): condition `correct`, réplique `replyWrong`.
                if "correct" in choice:
                    check_condition(choice["correct"], f"{wc}.correct", reg, report)
                    if not choice.get("replyWrong"):
                        report.error(wc, "« correct » sans « replyWrong » (que répond l'habitant à une erreur ?)")
                if "replyWrong" in choice:
                    check_lines(choice["replyWrong"], f"{wc}.replyWrong", reg, report)
                check_effects(choice.get("effects", []), f"{wc}.effects", reg, report)
                check_effects(choice.get("effectsWrong", []), f"{wc}.effectsWrong", reg, report)
            for key in ("same", "different"):
                if key in line:
                    check_lines(line[key], f"{wl}.{key}", reg, report)
        else:
            speaker = line.get("speaker")
            if speaker not in reg.villagers and speaker not in SPEAKERS_EXTRA:
                report.error(wl, f"locuteur inconnu {speaker!r}")
            if not line.get("text"):
                report.error(wl, "réplique vide")


def check_quetes(data: dict[str, Any], reg: Registry, report: Report) -> None:
    for quest in data.get("quetes", {}).get("quests", []):
        qid = quest.get("id")
        w = f"quetes.{qid}"
        if quest.get("kind") not in QUEST_KINDS:
            report.error(w, f"« kind » inconnu {quest.get('kind')!r}")
        if quest.get("tier") not in TIERS:
            report.error(w, f"tier inconnu {quest.get('tier')!r}")
        ref("villager", quest.get("giver"), w, reg, report)
        start = quest.get("start", {})
        if not start.get("byEffect"):
            check_conditions(start.get("when", []), f"{w}.start.when", reg, report)
        check_effects(start.get("effects", []), f"{w}.start.effects", reg, report)
        check_secret(quest, w, reg, report)
        for step in quest.get("steps", []):
            ws = f"{w}.{step.get('id')}"
            if not step.get("objective"):
                report.error(ws, "objectif manquant")
            by_role = step.get("objectiveByRole")
            if by_role is not None:
                if "secret" not in quest:
                    report.error(ws, "« objectiveByRole » dans une quête sans secret")
                if not isinstance(by_role, dict) or set(by_role) != SECRET_ROLES or not all(isinstance(v, str) and v for v in by_role.values()):
                    report.error(ws, "« objectiveByRole »: textes « informed » et « doer » attendus")
            check_conditions(step.get("conditions", []), f"{ws}.conditions", reg, report)
            check_effects(step.get("effects", []), f"{ws}.effects", reg, report)
            if "failText" in step:
                ref("text", step["failText"], ws, reg, report)
            if step.get("resolve") == "at_deadline":
                # Quête de la semaine (`repeat: each_train`, tour 8): l'échéance est le départ de chaque train.
                if "deadline" in step or quest.get("repeat") is None:
                    deadline = step.get("deadline", {})
                    if deadline.get("day") not in DEMO_DAYS:
                        report.error(ws, "échéance hors de la démo")
                    check_time(deadline.get("time"), ws, report)
                check_effects(step.get("onDeadline", []), f"{ws}.onDeadline", reg, report)
            elif "resolve" in step:
                report.error(ws, f"« resolve » inconnu {step['resolve']!r}")
        check_effects(quest.get("completionEffects", []), f"{w}.completionEffects", reg, report)
        expire = quest.get("expire")
        if expire is not None:
            if not isinstance(expire, dict) or expire.get("weekday") not in WEEKDAYS:
                report.error(w, "« expire »: « weekday » de saturday à friday attendu")
            else:
                check_time(expire.get("time"), f"{w}.expire", report)
                ref("text", expire.get("text"), f"{w}.expire", reg, report)
        if "repeat" in quest and quest["repeat"] != "each_train":
            report.error(w, f"« repeat » inconnu {quest['repeat']!r} (each_train)")
        if not quest.get("completionText"):
            report.error(w, "« completionText » manquant")
    for quest in data.get("quetes", {}).get("quests", []):
        if quest.get("start", {}).get("byEffect") and quest.get("id") not in reg.quests_started_by_effect:
            report.error(f"quetes.{quest.get('id')}", "démarrée par un effet, mais aucun effet « start_quest » ne la lance")


def check_secret(quest: dict[str, Any], w: str, reg: Registry, report: Report) -> None:
    """Secret d'une quête (R16): un seul joueur sait, l'autre agit."""
    secret = quest.get("secret")
    if secret is None:
        return
    ws = f"{w}.secret"
    reg.secret_quests.add(str(quest.get("id")))
    check_id(secret.get("id"), ws, report)
    if secret.get("informed") not in {"turn"} | MOMENT_PLAYERS:
        report.error(ws, f"« informed » inconnu {secret.get('informed')!r} (turn, p1 ou p2)")
    check_id(secret.get("variantGroup"), ws, report)
    of = secret.get("of")
    if not isinstance(of, int) or isinstance(of, bool) or of < 1:
        report.error(ws, f"« of » entier positif attendu, pas {of!r}")
        of = 1
    card = secret.get("card", {})
    if not isinstance(card.get("title"), str) or not card.get("title"):
        report.error(ws, "« card.title » manquant")
    lines = card.get("lines")
    if not isinstance(lines, list) or not lines:
        report.error(ws, "« card.lines » liste non vide attendue")
    elif any(isinstance(line, list) for line in lines):
        if len(lines) != of or not all(isinstance(line, list) and all(isinstance(x, str) for x in line) for line in lines):
            report.error(ws, f"« card.lines »: une liste de textes par variante attendue ({of})")
    elif not all(isinstance(line, str) for line in lines):
        report.error(ws, "« card.lines »: textes attendus")
    if "revealOn" in secret:
        check_condition(secret["revealOn"], f"{ws}.revealOn", reg, report)
    if "nudge" in secret:
        ref("text", secret["nudge"], ws, reg, report)
    check_vignette(secret.get("vignette"), ws, report)


def icon_ids() -> set[str] | None:
    if not ICONS_SOURCE.exists():
        return None
    return set(re.findall(r'<symbol id="([^"]+)"', ICONS_SOURCE.read_text(encoding="utf-8")))


def check_vignette(value: Any, where: str, report: Report) -> None:
    """Vignette d'un souvenir: un symbole du sprite des icônes (avertissement s'il n'est pas encore dessiné)."""
    if not isinstance(value, str) or not value:
        report.error(where, "« vignette » attendue (symbole du sprite des icônes)")
        return
    ids = icon_ids()
    if ids is not None and value not in ids:
        report.warn(where, f"vignette {value!r} absente de icones-source.svg: vignette générique en attendant")


def check_souvenirs(data: dict[str, Any], reg: Registry, report: Report) -> None:
    """Textes de l'onglet Souvenirs (`textes.souvenirs`, tour 7): une entrée par quête à secret."""
    souvenirs = data.get("textes", {}).get("souvenirs")
    if not isinstance(souvenirs, dict):
        report.error("textes.souvenirs", "bloc attendu (onglet Souvenirs du carnet)")
        return
    for key in ("seasons", "seasonTitles", "seasonsOf"):
        values = souvenirs.get(key)
        settings = data.get("reglages", {})
        seasons = settings.get("calendar", settings.get("memories", {})).get("seasonsPerYear", 4)
        if not isinstance(values, list) or len(values) != seasons:
            report.error(f"textes.souvenirs.{key}", f"{seasons} saisons attendues")
    secrets = souvenirs.get("secrets", {})
    for quest in sorted(reg.secret_quests):
        entry = secrets.get(quest)
        for role in ("vignette", "informed", "doer"):
            if not isinstance(entry, dict) or not isinstance(entry.get(role), str) or not entry.get(role):
                report.error(f"textes.souvenirs.secrets.{quest}", f"« {role} » attendu (souvenir de la quête à secret)")
    for quest in secrets:
        if quest not in reg.secret_quests:
            report.error(f"textes.souvenirs.secrets.{quest}", "quête inconnue ou sans secret")


def check_secret_texts(data: dict[str, Any], report: Report) -> None:
    """`{secret}` n'est permis que dans un texte vu par l'informé seul (objectif de son rôle)."""

    def visit(node: Any, where: str) -> None:
        if isinstance(node, str):
            souvenir = where.startswith("textes.souvenirs.secrets.") and where.rsplit(".", 1)[-1] in SECRET_ROLES
            if "{secret}" in node and not where.endswith("objectiveByRole.informed") and not souvenir:
                report.error(where, "{secret} hors d'un texte de l'informé (objectiveByRole.informed) "
                             "ou d'un souvenir de quête finie (textes.souvenirs.secrets.<quête>.informed|doer)")
        elif isinstance(node, dict):
            for key, value in node.items():
                visit(value, f"{where}.{key}")
        elif isinstance(node, list):
            for i, value in enumerate(node):
                visit(value, f"{where}[{i}]")

    for name, content in data.items():
        visit(content, name)


def check_moments(folder: Path, reg: Registry, report: Report, map_objects: set[str] | None) -> dict[str, Any] | None:
    """Moments rares (`moments.json`, tour 6): schéma, renvois, images clés, modèles et sons attendus (M-01)."""
    path = folder / "moments.json"
    if not path.exists():
        report.warn("moments.json", "fichier absent: aucun moment rare dans le jeu")
        return None
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        report.error("moments.json", f"JSON invalide ({exc})")
        return None
    if data.get("version") != 1:
        report.error("moments.json", "« version » doit valoir 1")
    root = folder.parent
    models: set[str] | None = None
    sounds: set[str] | None = None
    try:
        models = set(json.loads((root / "assets" / "modeles" / "index.json").read_text(encoding="utf-8")))
    except (OSError, json.JSONDecodeError):
        report.warn("moments.json", "assets/modeles/index.json illisible: modèles non vérifiés")
    try:
        sounds = set(json.loads((root / "assets" / "son" / "sons.json").read_text(encoding="utf-8")).get("sounds", {}))
    except (OSError, json.JSONDecodeError):
        report.warn("moments.json", "assets/son/sons.json illisible: sons non vérifiés")
    for m in data.get("moments", []):
        register(reg.moments, m.get("id"), "moments.moments", report)
    missing_models: dict[str, str] = {}
    missing_sounds: dict[str, str] = {}

    def sound(name: Any, where: str) -> None:
        if isinstance(name, str) and sounds is not None and name not in sounds and name.replace("_", "-") not in sounds:
            missing_sounds.setdefault(name, where)

    def time_of(value: Any, where: str) -> int:
        check_time(value, where, report)
        if isinstance(value, str) and TIME_RE.match(value):
            h, mi = value.split(":")
            return int(h) * 60 + int(mi)
        return 0

    def watch(wt: Any, where: str, actors: set[str]) -> None:
        if not isinstance(wt, dict):
            report.error(where, "objet attendu")
            return
        for key in ("radius", "holdSeconds"):
            if not isinstance(wt.get(key), (int, float)) or wt[key] <= 0:
                report.error(where, f"« {key} » positif attendu")
        if wt.get("minRadius", 0) > wt.get("radius", 0):
            report.error(where, "« minRadius » plus grand que « radius »")
        if wt.get("seated") and not wt.get("bench"):
            report.error(where, "« seated » sans « bench »")
        if wt.get("bench") and map_objects is not None and wt["bench"] not in map_objects:
            report.error(where, f"banc {wt['bench']!r} absent des objets de la carte")
        for place in wt.get("hold") or []:
            ref("point", place, where, reg, report)
        target = wt.get("target", "anchor")
        if target != "anchor" and target not in actors:
            report.error(where, f"cible {target!r}: ni « anchor » ni un acteur")

    def choreo(c: Any, where: str, actors: set[str]) -> None:
        if c is None:
            return
        seconds = c.get("seconds")
        if not isinstance(seconds, (int, float)) or seconds <= 0:
            report.error(where, "« seconds » positif attendu")
            seconds = 0
        for actor, frames in c.get("keyframes", {}).items():
            if actor not in actors:
                report.error(where, f"images clés d'un acteur inconnu {actor!r}")
            last = -1.0
            for i, f in enumerate(frames):
                wf = f"{where}.keyframes.{actor}[{i}]"
                if not isinstance(f, list) or len(f) not in (5, 6):
                    report.error(wf, "image clé [t, x, y, z, clip] ou [t, x, y, z, clip, cap] attendue")
                    continue
                t, x, y, z, clip = f[:5]
                if len(f) == 6 and not isinstance(f[5], (int, float)):
                    report.error(wf, "cap (radians): nombre attendu")
                if not isinstance(t, (int, float)) or t < last or t > seconds + 1e-9:
                    report.error(wf, f"temps {t!r} hors de l'ordre ou de la durée ({seconds} s)")
                else:
                    last = t
                for v in (x, y):
                    if v is not None and not isinstance(v, (int, float)):
                        report.error(wf, "x et y: nombres ou null")
                if not isinstance(z, (int, float)):
                    report.error(wf, "z: nombre attendu")
                if clip is not None and not isinstance(clip, str):
                    report.error(wf, "clip: texte ou null")
        for i, s in enumerate(c.get("sounds", [])):
            if not isinstance(s, list) or len(s) != 2 or not isinstance(s[0], (int, float)) or s[0] > seconds + 1e-9:
                report.error(f"{where}.sounds[{i}]", "[t, son] attendu, t dans la durée")
            else:
                sound(s[1], f"{where}.sounds[{i}]")
        for v in c.get("lookers", []):
            ref("villager", v, where, reg, report)

    for m in data.get("moments", []):
        mid = m.get("id")
        w = f"moments.{mid}"
        if m.get("tier") not in TIERS:
            report.error(w, f"tier inconnu {m.get('tier')!r}")
        if m.get("mode") not in MOMENT_MODES:
            report.error(w, f"« mode » inconnu {m.get('mode')!r}")
        quest = m.get("quest")
        if m.get("mode") in ("quest", "both"):
            ref("quest", quest, w, reg, report)
        step = m.get("questStep")
        if step is not None and step not in reg.quests.get(quest, set()):
            report.error(w, f"étape {step!r} inconnue de la quête {quest!r}")
        ref("point", m.get("anchor"), w, reg, report)
        if not isinstance(m.get("weight"), int) or m["weight"] < 0:
            report.error(w, "« weight » entier positif ou nul attendu")
        mx = m.get("maxPerSeason")
        if mx is not None and (not isinstance(mx, int) or mx < 1):
            report.error(w, "« maxPerSeason » entier positif ou null attendu")
        check_conditions(m.get("availableWhen", []), f"{w}.availableWhen", reg, report)
        pf, pt = time_of(m.get("present", {}).get("from"), f"{w}.present"), time_of(m.get("present", {}).get("to"), f"{w}.present")
        wf, wt_ = time_of(m.get("window", {}).get("from"), f"{w}.window"), time_of(m.get("window", {}).get("to"), f"{w}.window")
        if not pf <= wf < wt_ <= pt:
            report.error(w, "fenêtre de l'apogée hors de la présence (window incluse dans present)")
        actors = set()
        for i, a in enumerate(m.get("actors", [])):
            wa = f"{w}.actors[{i}]"
            register(actors, a.get("id"), wa, report)
            ref("point", a.get("at"), wa, reg, report)
            model = a.get("model")
            if a.get("villager") is not None:
                ref("villager", a["villager"], wa, reg, report)
            elif isinstance(model, str) and model in PROCEDURAL_ACTORS:
                if not (folder.parent / PROCEDURAL_ACTORS[model]).is_file():
                    report.error(wa, f"effet procédural « {model} »: {PROCEDURAL_ACTORS[model]} absent")
            elif isinstance(model, str) and models is not None and model not in models:
                missing_models.setdefault(model, wa)
            count = a.get("count", 1)
            if count > 1 and len(a.get("offsets", [])) != count:
                report.error(wa, f"un décalage par membre du groupe attendu ({count})")
            choreo(a.get("arrive"), f"{wa}.arrive", actors | {a.get("id")})
        watch(m.get("watch"), f"{w}.watch", actors)
        if m.get("questWatch") is not None:
            watch(m["questWatch"], f"{w}.questWatch", actors)
        choreo(m.get("climax"), f"{w}.climax", actors)
        choreo(m.get("leave"), f"{w}.leave", actors)
        for aid, spec in (m.get("after") or {}).get("actors", {}).items():
            if aid not in actors:
                report.error(f"{w}.after", f"acteur inconnu {aid!r}")
            if spec.get("at") is not None:
                ref("point", spec["at"], f"{w}.after", reg, report)
        for s in m.get("sounds", {}).get("idle", []):
            sound(s.get("id"), f"{w}.sounds.idle")
        texts = m.get("texts", {})
        for key in ("climax", "memory"):
            ref("text", texts.get(key), f"{w}.texts", reg, report)
        # Onglet Souvenirs (tour 7): rumeur (sauf moment de quête seule), vignette et son texte de remplacement.
        for key in ("rumor", "vignette"):
            if texts.get(key) is not None:
                ref("text", texts[key], f"{w}.texts", reg, report)
        if texts.get("rumor") is None and m.get("mode") != "quest":
            report.error(f"{w}.texts", "« rumor » attendu: un moment d'ambiance a sa rumeur du bourg (onglet Souvenirs)")
        if texts.get("vignette") is None:
            report.error(f"{w}.texts", "« vignette » attendu: texte de remplacement de la vignette du souvenir")
        check_vignette(m.get("vignette"), w, report)
        if texts.get("hint") is not None:
            ref("text", texts["hint"], f"{w}.texts", reg, report)
        if m.get("hintFrom") is not None:
            ref("villager", m["hintFrom"], w, reg, report)
        if not isinstance(m.get("reward", {}).get("heart"), (int, float)):
            report.error(w, "« reward.heart » attendu")
        check_effects(m.get("effects", []), f"{w}.effects", reg, report)
    # Les modèles et les sons arrivent de l'artiste 3D et du sound-designer: avertissement tant qu'ils manquent.
    if missing_models:
        report.warn("moments.json", "modèles pas encore livrés (M-01): " + ", ".join(sorted(missing_models)))
    if missing_sounds:
        report.warn("moments.json", "sons pas encore livrés (M-01): " + ", ".join(sorted(missing_sounds)))
    return data


FISH_RARITIES = ("common", "rare", "epic", "legendary", "mythic")
FISH_SEASONS = ("spring", "summer", "autumn", "winter")
FISH_WEATHERS = ("sunny", "cloudy", "rain")


def fish_minutes(value: Any) -> int | None:
    if not isinstance(value, str) or len(value) != 5 or value[2] != ":" or not (value[:2] + value[3:]).isdigit():
        return None
    h, m = int(value[:2]), int(value[3:])
    return h * 60 + m if (h < 24 and m < 60) or (h == 24 and m == 0) else None


def check_poissons(reg: Registry, report: Report, folder: Path) -> None:
    """Pêche 0.12 (S1): fiche `fish` de chaque poisson, et au moins un commun possible partout, tout le temps."""
    zones: set[str] = set()
    for path in sorted((folder / "cartes").glob("*.json")) if (folder / "cartes").is_dir() else []:
        try:
            carte = json.loads(path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            continue
        zones.update(z.get("id") for z in carte.get("peche", {}).get("coins", []) if isinstance(z, dict))
    fishes: dict[str, dict[str, Any]] = {}
    for item_id, item in reg.items.items():
        if item.get("category") != "fish":
            continue
        w = f"objets.{item_id}.fish"
        fish = item.get("fish")
        if not isinstance(fish, dict):
            report.error(w, "fiche « fish » manquante")
            continue
        if fish.get("rarity") not in FISH_RARITIES:
            report.error(w, f"rareté inconnue {fish.get('rarity')!r}")
        for z in fish.get("zones") or [None]:
            if zones and z not in zones:
                report.error(w, f"coin de pêche inconnu {z!r}")
        if not fish.get("seasons") or any(s not in FISH_SEASONS for s in fish["seasons"]):
            report.error(w, "saisons attendues (spring, summer, autumn, winter)")
        if not fish.get("weather") or any(m not in FISH_WEATHERS for m in fish["weather"]):
            report.error(w, "météos attendues (sunny, cloudy, rain)")
        hours = fish.get("hours")
        ranges: list[tuple[int, int]] = []
        if not isinstance(hours, list) or not hours:
            report.error(w, "heures attendues (liste de [début, fin] en HH:MM)")
        else:
            for r in hours:
                a = fish_minutes(r[0]) if isinstance(r, list) and len(r) == 2 else None
                b = fish_minutes(r[1]) if isinstance(r, list) and len(r) == 2 else None
                if a is None or b is None or b <= a:
                    report.error(w, f"heure mal formée {r!r}")
                else:
                    ranges.append((a, b))
        for key in ("shadow", "lengthCm", "released", "description", "hint"):
            if key not in fish:
                report.error(w, f"champ « {key} » manquant")
        grand = fish.get("rarity") in ("legendary", "mythic")
        if grand != ("presence" in fish):
            report.error(w, "« presence » pour un légendaire ou un mythique, et pour eux seuls")
        if fish.get("released") and item.get("sellPrice") is not None:
            report.error(w, "un poisson remis à l'eau n'a pas de prix")
        fishes[item_id] = {**fish, "_ranges": ranges}
    # Au moins un commun possible pour chaque coin, saison, heure de 6 h à 24 h et météo (0 trou).
    for z in sorted(zones):
        for season in FISH_SEASONS:
            for weather in FISH_WEATHERS:
                for minute in range(6 * 60, 24 * 60, 30):
                    ok = any(
                        f.get("rarity") == "common" and z in f.get("zones", []) and season in f.get("seasons", [])
                        and weather in f.get("weather", [])
                        and (any(a <= minute < b for a, b in f["_ranges"]) or (f.get("rainAnyHour") and weather == "rain"))
                        for f in fishes.values()
                    )
                    if not ok:
                        report.error(f"poissons.{z}", f"aucun commun possible en {season}, {weather}, à {minute // 60} h {minute % 60:02d}")
                        break


def map_objects(folder: Path) -> set[str] | None:
    maps = sorted((folder / "cartes").glob("*.json")) if (folder / "cartes").is_dir() else []
    found: set[str] = set()
    for path in maps:
        try:
            carte = json.loads(path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            continue
        found.update(o.get("id") for o in carte.get("objets", []) if isinstance(o, dict))
        # Tour 9: sièges sans modèle (le bord du ponton) et chantiers (les bancs bâtis).
        found.update(o.get("id") for o in carte.get("sieges", []) if isinstance(o, dict))
        found.update(o.get("id") for o in carte.get("chantiers", []) if isinstance(o, dict))
    return found if maps else None


def check_courrier(data: dict[str, Any], reg: Registry, report: Report) -> None:
    for letter in data.get("courrier", {}).get("letters", []):
        w = f"courrier.{letter.get('id')}"
        if letter.get("from") not in reg.senders:
            report.error(w, f"expéditeur inconnu {letter.get('from')!r}")
        delivery = letter.get("delivery", {})
        instance = delivery.get("instance")
        if instance is not None and instance != "train":
            report.error(w, f"« instance » inconnue {instance!r} (train)")
        if "@" in str(letter.get("id")):
            report.error(w, "« @ » est réservé aux lettres hebdomadaires")
        if instance is not None and not settings_generated(data):
            report.error(w, "lettre hebdomadaire sans commande générée (reglages.order.generated)")
        if not delivery.get("byEffect"):
            # Une lettre hebdomadaire arrive à l'heure dite le jour du tirage de la commande: pas de jour écrit.
            if instance is None and delivery.get("day") not in DEMO_DAYS:
                report.error(w, "jour de livraison hors de la démo")
            check_time(delivery.get("time"), w, report)
        if "variants" in letter:
            # Variantes tirées sans redite (`variantsNoRepeat`): chacune a sa condition, le texte de repli est la dernière.
            if not letter["variants"] or (letter["variants"][-1].get("when") and not letter.get("variantsNoRepeat")):
                report.error(w, "la dernière variante doit être sans condition")
            for i, variant in enumerate(letter["variants"]):
                check_conditions(variant.get("when", []), f"{w}.variants[{i}]", reg, report)
        elif not letter.get("text"):
            report.error(w, "texte manquant")


def check_astuces(data: dict[str, Any], reg: Registry, report: Report) -> None:
    for hint in data.get("astuces", {}).get("hints", []):
        w = f"astuces.{hint.get('id')}"
        trigger = hint.get("trigger", {})
        on = trigger.get("on")
        if on not in HINT_TRIGGERS:
            report.error(w, f"déclencheur inconnu {on!r}")
            continue
        extra = set(trigger) - {"on"} - HINT_TRIGGERS[on]
        if extra:
            report.error(w, f"paramètres inconnus {sorted(extra)}")
        if "point" in trigger:
            ref("point", trigger["point"], w, reg, report)
        if "quest" in trigger:
            ref("quest", trigger["quest"], w, reg, report)
        if "item" in trigger:
            ref("item", trigger["item"], w, reg, report)
        if "tool" in trigger:
            ref("item", trigger["tool"], w, reg, report)
        if "time" in trigger:
            check_time(trigger["time"], w, report)
        if "holding" in trigger and trigger["holding"] not in ITEM_CATEGORIES:
            report.error(w, f"« holding » doit être une catégorie d'objet, pas {trigger['holding']!r}")
        if "cellState" in trigger:
            states = {s.get("id") for s in data.get("cultures", {}).get("cellStates", [])}
            if trigger["cellState"] not in states:
                report.error(w, f"état de case inconnu {trigger['cellState']!r}")
        if hint.get("tier") not in TIERS:
            report.error(w, f"tier inconnu {hint.get('tier')!r}")


def check_envies(data: dict[str, Any], reg: Registry, report: Report) -> None:
    envies = data.get("envies", {})
    for envie in envies.get("envies", []):
        w = f"envies.{envie.get('id')}"
        if envie.get("kind") not in ("personal", "shared"):
            report.error(w, f"« kind » inconnu {envie.get('kind')!r}")
        check_conditions(envie.get("availableWhen", []), f"{w}.availableWhen", reg, report)
        check_conditions(envie.get("fulfilledWhen", []), f"{w}.fulfilledWhen", reg, report)
        if not envie.get("fulfilledWhen"):
            report.error(w, "« fulfilledWhen » vide: l'envie ne pourrait jamais se réaliser")
    for entry in envies.get("sharedSchedule", []):
        w = f"envies.sharedSchedule.day{entry.get('day')}"
        if entry.get("day") not in DEMO_DAYS:
            report.error(w, "jour hors de la démo")
        if reg.envies.get(entry.get("envie")) != "shared":
            report.error(w, f"{entry.get('envie')!r} n'est pas une envie à deux connue")


def check_textes_reglages(data: dict[str, Any], reg: Registry, report: Report) -> None:
    textes = data.get("textes", {})
    levels = [f.get("level") for f in textes.get("form", [])]
    if levels != FORM_LEVELS:
        report.error("textes.form", f"niveaux attendus {FORM_LEVELS}, trouvés {levels}")
    if len(textes.get("weekdays", [])) != 7:
        report.error("textes.weekdays", "sept jours attendus, du samedi au vendredi")
    if set(textes.get("weather", {})) - {"mistMorning"} != WEATHERS:
        report.error("textes.weather", f"météos attendues {sorted(WEATHERS)} (et « mistMorning »)")
    settings = data.get("reglages", {})
    clock = settings.get("clock", {})
    for key in ("dayStart", "dayEnd", "veilleeFrom"):
        check_time(clock.get(key), f"reglages.clock.{key}", report)
    if not isinstance(clock.get("secondsPerGameMinute"), (int, float)) or clock["secondsPerGameMinute"] <= 0:
        report.error("reglages.clock", "« secondsPerGameMinute » positif attendu")
    weather = settings.get("weatherByDay", [])
    # Tour 8: la météo est écrite jusqu'au premier jour tiré (`weather.fromDay`), puis tirée.
    drawn_from = settings.get("weather", {}).get("fromDay") if isinstance(settings.get("weather"), dict) else None
    written = drawn_from - 1 if isinstance(drawn_from, int) else len(DEMO_DAYS)
    if len(weather) != written or not set(weather) <= WEATHERS:
        report.error("reglages.weatherByDay", f"{written} météos connues attendues, une par jour écrit")
    check_weekly(data, reg, report)
    order = settings.get("order", {})
    # Une commande par train (`trains`), ou l'ancienne forme à une seule commande (`lines`).
    trains = order.get("trains") if isinstance(order.get("trains"), list) else [{"day": None, "lines": order.get("lines", [])}]
    train_days = set(settings.get("train", {}).get("days", []))
    for i, train in enumerate(trains):
        w = f"reglages.order.trains[{i}]"
        if train.get("day") is not None and train.get("day") not in train_days:
            report.error(w, f"jour {train.get('day')!r} sans train (reglages.train.days)")
        for line in train.get("lines", []):
            ref("item", line.get("item"), f"{w}.lines", reg, report)
            check_count(line.get("count"), f"{w}.lines", report)
            item = reg.items.get(line.get("item"))
            if item is not None and item.get("sellPrice") is None:
                report.error(f"{w}.lines", f"{line.get('item')!r} sans prix de vente: la ligne ne rapporterait rien")
    reg.order_days = {t.get("day") for t in trains if isinstance(t.get("day"), int)}
    if reg.order_days:
        for day, where in sorted(reg.order_days_used.items()):
            if day not in reg.order_days:
                report.error(where, f"order_complete: aucune commande pour le train du jour {day}")
    ref("point", settings.get("spawn", {}).get("point"), "reglages.spawn", reg, report)
    # 0.12: charges de quête portées à deux (l'étal, les briques, la chevrette), drapeau levé à la pose.
    for i, load in enumerate(settings.get("carry", {}).get("quests", [])):
        w = f"reglages.carry.quests[{i}]"
        ref("item", load.get("item"), w, reg, report)
        if load.get("item") in reg.items and not reg.items[load["item"]].get("carriedByTwo"):
            report.error(w, f"{load.get('item')!r} ne se porte pas à deux (« carriedByTwo »)")
        ref("point", load.get("from"), w, reg, report)
        ref("point", load.get("to"), w, reg, report)
        ref("quest", load.get("quest"), w, reg, report)
        if load.get("quest") in reg.quests and load.get("step") not in reg.quests[load["quest"]]:
            report.error(w, f"étape inconnue {load.get('step')!r} de la quête {load.get('quest')!r}")
        check_conditions(load.get("when", []), f"{w}.when", reg, report)
        if "placedText" in load:
            ref("text", load["placedText"], w, reg, report)
        reg.flags_set.add(load.get("flag", ""))
    ref("point", settings.get("garden", {}).get("zone"), "reglages.garden", reg, report)
    ref("point", settings.get("trees", {}).get("zone"), "reglages.trees", reg, report)
    grocer_flag = settings.get("economy", {}).get("grocer", {}).get("buysAfterFlag")
    if grocer_flag:
        reg.flags_read.setdefault(grocer_flag, "reglages.economy.grocer")
    fishing_flag = settings.get("fishing", {}).get("flag")
    if fishing_flag:
        # Ce drapeau est posé par la configuration (pêche activée en P1), pas par un effet.
        reg.flags_set.add(fishing_flag)
    # Drapeaux posés par le moteur lui-même (geste à deux de la draisine arrivé au bout).
    reg.flags_set.update(ENGINE_FLAGS)
    # Tour 9: chaque chantier bâti pose son drapeau (`<id>_built`, ou `flag`).
    for ch in data.get("chantiers", {}).get("improvements", []):
        if isinstance(ch, dict):
            reg.flags_set.add(ch.get("flag") or f"{ch.get('id')}_built")
    # Posé à la reprise d'une sauvegarde où les poules avaient déjà leurs noms (migration du format 3).
    known_hens = settings.get("secrets", {}).get("knownHensFlag")
    if known_hens:
        reg.flags_set.add(known_hens)
    for fish_id, weight in settings.get("feel", {}).get("fishWeights", {}).items():
        ref("item", fish_id, "reglages.feel.fishWeights", reg, report)
        if fish_id in reg.items and reg.items[fish_id].get("category") != "fish":
            report.error("reglages.feel.fishWeights", f"{fish_id!r} n'est pas un poisson")
        if not isinstance(weight, (int, float)) or weight <= 0:
            report.error("reglages.feel.fishWeights", f"poids positif attendu pour {fish_id!r}")
    # Tour 8 (section 5.3): poids par saison; un poids nul est permis (pas de truite l'hiver).
    for season, weights in settings.get("feel", {}).get("fishWeightsBySeason", {}).items():
        w = f"reglages.feel.fishWeightsBySeason.{season}"
        if season not in ("spring", "summer", "autumn", "winter"):
            report.error(w, "saison inconnue")
        for fish_id, weight in weights.items():
            ref("item", fish_id, w, reg, report)
            if fish_id in reg.items and reg.items[fish_id].get("category") != "fish":
                report.error(w, f"{fish_id!r} n'est pas un poisson")
            if not isinstance(weight, (int, float)) or weight < 0:
                report.error(w, f"poids positif ou nul attendu pour {fish_id!r}")
        if sum(v for v in weights.values() if isinstance(v, (int, float))) <= 0:
            report.error(w, "au moins un poisson doit pouvoir mordre")
    levels_settings = [entry.get("level") for entry in settings.get("needs", {}).get("formLevels", [])]
    if levels_settings != FORM_LEVELS:
        report.error("reglages.needs.formLevels", f"niveaux attendus {FORM_LEVELS}")


def settings_generated(data: dict[str, Any]) -> bool:
    order = data.get("reglages", {}).get("order", {})
    return isinstance(order, dict) and isinstance(order.get("generated"), dict)


def check_odds(value: Any, where: str, report: Report) -> None:
    if not isinstance(value, list) or len(value) != 3 or not all(isinstance(x, (int, float)) and x >= 0 for x in value):
        report.error(where, "[soleil, nuages, pluie] positifs attendus")
    elif abs(sum(value) - 100) > 1e-9:
        report.error(where, f"somme de 100 attendue ({sum(value)})")


def check_probability(value: Any, where: str, report: Report) -> None:
    if not isinstance(value, (int, float)) or not 0 <= value <= 1:
        report.error(where, f"probabilité de 0 à 1 attendue ({value!r})")


def check_weekly(data: dict[str, Any], reg: Registry, report: Report) -> None:
    """Réglages et textes de la suite après le jour 15 (tour 8): calendrier, rythme, étapes, météo,
    catalogue et commande hebdomadaires, cueillette, D4 et D7."""
    settings = data.get("reglages", {})
    textes = data.get("textes", {})
    clock = settings.get("clock", {})
    last = clock.get("lastDay", {})
    last_day = last.get("day") if isinstance(last.get("day"), int) else len(DEMO_DAYS)
    calendar = settings.get("calendar")
    memories = settings.get("memories", {})
    if calendar is not None:
        if any(k in memories for k in ("seasonDays", "seasonsPerYear")):
            report.error("reglages.memories", "saisons à lire dans « calendar » seulement (retirer seasonDays et seasonsPerYear)")
        for key in ("seasonDays", "seasonsPerYear"):
            if not isinstance(calendar.get(key), int) or calendar[key] < 1:
                report.error(f"reglages.calendar.{key}", "entier positif attendu")
    schedule = clock.get("schedule")
    if schedule is not None:
        previous = 0
        for i, step in enumerate(schedule if isinstance(schedule, list) else []):
            w = f"reglages.clock.schedule[{i}]"
            day = step.get("fromDay")
            if not isinstance(day, int) or day <= previous:
                report.error(w, "« fromDay » croissant attendu")
            else:
                previous = day
            spm = step.get("secondsPerGameMinute")
            if not isinstance(spm, (int, float)) or spm <= 0:
                report.error(w, "« secondsPerGameMinute » positif attendu")
        first = schedule[0] if isinstance(schedule, list) and schedule else {}
        if first.get("fromDay") != 1 or first.get("secondsPerGameMinute") != clock.get("secondsPerGameMinute"):
            report.error("reglages.clock.schedule", "le premier pas commence au jour 1 et vaut clock.secondsPerGameMinute")
    stages_texts = textes.get("stages", {})
    previous = 0
    for i, stage in enumerate(settings.get("stages", [])):
        w = f"reglages.stages[{i}]"
        if stage.get("id") not in STAGE_IDS or stage.get("texts") not in STAGE_IDS:
            report.error(w, f"étape inconnue {stage.get('id')!r} (textes {stage.get('texts')!r})")
        day = stage.get("day")
        if not isinstance(day, int) or day <= previous or day > last_day:
            report.error(w, f"jour {day!r}: étapes dans l'ordre, au plus tard le jour {last_day} (clock.lastDay)")
        else:
            previous = day
        check_time(stage.get("time"), w, report)
        block = stages_texts.get(stage.get("texts"), {})
        for key in ("title", "subtitle", "text", "highlight"):
            if not isinstance(block.get(key), str) or not block.get(key):
                report.error(f"textes.stages.{stage.get('texts')}", f"« {key} » attendu")
    if settings.get("tenderness", "gentle") not in TENDERNESS:
        report.error("reglages.tenderness", f"niveau inconnu {settings.get('tenderness')!r}")
    if settings.get("continuation", {}).get("mode", "same_save") not in CONTINUATION:
        report.error("reglages.continuation", f"mode inconnu {settings.get('continuation')!r}")
    repeat = settings.get("train", {}).get("repeatEveryDays", 0)
    if not isinstance(repeat, int) or repeat < 0:
        report.error("reglages.train.repeatEveryDays", "entier positif ou nul attendu")
    weekly = settings.get("economy", {}).get("catalogue", {}).get("repeatWeekly")
    if weekly is not None:
        if weekly.get("deadlineWeekday") not in WEEKDAYS:
            report.error("reglages.economy.catalogue.repeatWeekly", f"jour inconnu {weekly.get('deadlineWeekday')!r}")
        check_time(weekly.get("deadlineTime"), "reglages.economy.catalogue.repeatWeekly", report)
        check_time(weekly.get("deliveryTime"), "reglages.economy.catalogue.repeatWeekly", report)
    weather = settings.get("weather")
    if isinstance(weather, dict):
        for block in ("draw", "target"):
            for season in SEASONS:
                check_odds(weather.get(block, {}).get(season), f"reglages.weather.{block}.{season}", report)
        check_probability(weather.get("persistence"), "reglages.weather.persistence", report)
        mist = weather.get("mist", {})
        check_probability(mist.get("afterRain"), "reglages.weather.mist.afterRain", report)
        for season in SEASONS:
            check_probability(mist.get("base", {}).get(season), f"reglages.weather.mist.base.{season}", report)
        check_time(mist.get("fadeFrom"), "reglages.weather.mist", report)
        check_time(mist.get("until"), "reglages.weather.mist", report)
        for i, forced in enumerate(weather.get("forced", [])):
            if not isinstance(forced.get("day"), int) or forced["day"] < weather.get("fromDay", 1) or forced.get("weather") not in WEATHERS:
                report.error(f"reglages.weather.forced[{i}]", "jour tiré et météo connue attendus")
        if "mistMorning" not in textes.get("weather", {}):
            report.error("textes.weather", "« mistMorning » attendu (brume du matin)")
    forage = settings.get("forage")
    forage_items: set[str] = set()
    if isinstance(forage, dict):
        check_probability(forage.get("spawnChance"), "reglages.forage.spawnChance", report)
        for i, item in enumerate(forage.get("items", [])):
            w = f"reglages.forage.items[{i}]"
            forage_items.add(str(item.get("item")))
            if not set(item.get("seasons", [])) <= set(SEASONS) or not item.get("seasons"):
                report.error(w, f"saisons inconnues {item.get('seasons')!r}")
            count = item.get("count")
            if not isinstance(count, list) or len(count) != 2 or not 1 <= count[0] <= count[1]:
                report.error(w, f"« count » [min, max] attendu ({count!r})")
        for i, point in enumerate(forage.get("points", [])):
            w = f"reglages.forage.points[{i}]"
            ref("point", point.get("point"), w, reg, report)
            for item in point.get("items", []):
                if item not in forage_items:
                    report.error(w, f"cueillette inconnue {item!r} (forage.items)")
    generated = settings.get("order", {}).get("generated")
    if isinstance(generated, dict):
        products: set[str] = set()
        for i, p in enumerate(generated.get("products", [])):
            w = f"reglages.order.generated.products[{i}]"
            item = p.get("item")
            products.add(str(item))
            if p.get("family") not in ORDER_FAMILIES:
                report.error(w, f"famille inconnue {p.get('family')!r}")
            if p.get("resource") not in ORDER_RESOURCES:
                report.error(w, f"ressource inconnue {p.get('resource')!r}")
            if p.get("resource") == "forage":
                if item not in forage_items:
                    report.error(w, f"cueillette inconnue {item!r} (reglages.forage.items)")
            else:
                ref("item", item, w, reg, report)
                known = reg.items.get(item)
                if known is not None and known.get("sellPrice") is None and p.get("price") is None:
                    report.error(w, f"{item!r} sans prix de vente ni « price »: la ligne ne rapporterait rien")
            if not isinstance(p.get("cost"), (int, float)) or p["cost"] <= 0:
                report.error(w, "« cost » positif attendu")
            if not isinstance(p.get("min"), int) or p["min"] < 1:
                report.error(w, "« min » entier positif attendu")
            if not set(p.get("seasons", [])) <= set(SEASONS) or not p.get("seasons"):
                report.error(w, f"saisons inconnues {p.get('seasons')!r}")
            if not re.match(r"^[a-z_]+:[a-z_]+$", str(p.get("obtained"))):
                report.error(w, f"« obtained » attendu en « compteur:objet » ({p.get('obtained')!r})")
            if item not in textes.get("orderTips", {}):
                report.error("textes.orderTips", f"conseil manquant pour {item!r}")
        for dish, bases in generated.get("noSharedBase", {}).items():
            for pid in [dish, *bases]:
                if pid not in products:
                    report.error("reglages.order.generated.noSharedBase", f"produit inconnu {pid!r}")
        sizes = generated.get("size", {})
        if sizes.get("current") not in sizes.get("factors", {}):
            report.error("reglages.order.generated.size", f"taille inconnue {sizes.get('current')!r}")
        budget = generated.get("budget", {})
        if not budget.get("floor", 0) <= budget.get("start", 0) <= budget.get("max", 0):
            report.error("reglages.order.generated.budget", "plancher <= départ <= maximum attendu")
        greetings = textes.get("orderGreetings", {})
        if not greetings.get("all"):
            report.error("textes.orderGreetings.all", "salutations de toute saison attendues")
        for key in ("none", "one", "many"):
            if not textes.get("orderFormat", {}).get("linesDone", {}).get(key):
                report.error("textes.orderFormat.linesDone", f"« {key} » attendu (« une ligne », jamais « 1 lignes »)")
    cards = textes.get("seasonCards")
    if cards is not None:
        for season in SEASONS:
            card = cards.get(season, {})
            if not card.get("title") or len(card.get("lines", [])) != 3:
                report.error(f"textes.seasonCards.{season}", "titre et trois lignes attendus")
    hud = textes.get("ui", {}).get("hud", {})
    if "season" in hud and set(hud.get("seasonNames", {})) != set(SEASONS):
        report.error("textes.ui.hud.seasonNames", "un nom par saison attendu")


def map_points(folder: Path, report: Report) -> set[str] | None:

    """Points et zones nommés de la carte (donnees/cartes/*.json), ou None si aucune carte n'existe."""
    maps = sorted((folder / "cartes").glob("*.json")) if (folder / "cartes").is_dir() else []
    if not maps:
        return None
    found: set[str] = set()

    def visit(node: Any) -> None:
        if isinstance(node, dict):
            for key, value in node.items():
                if key in ("points", "zones"):
                    if isinstance(value, list):
                        found.update(v["id"] for v in value if isinstance(v, dict) and isinstance(v.get("id"), str))
                    elif isinstance(value, dict):
                        found.update(k for k in value if isinstance(k, str))
                visit(value)
        elif isinstance(node, list):
            for value in node:
                visit(value)

    for path in maps:
        try:
            visit(json.loads(path.read_text(encoding="utf-8")))
        except json.JSONDecodeError as exc:
            report.error(f"cartes/{path.name}", f"JSON invalide ({exc})")
    return found


def main() -> int:
    folder = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).resolve().parent.parent / "donnees"
    report = Report()
    data = load(folder, report)
    global DEMO_DAYS
    last_day = data.get("reglages", {}).get("clock", {}).get("lastDay", {}).get("day")
    if isinstance(last_day, int) and last_day >= 1:
        DEMO_DAYS = range(1, last_day + 1)
    reg = Registry()
    collect(data, reg, report)
    check_objets(data, reg, report)
    check_poissons(reg, report, folder)
    check_cultures(data, reg, report)
    check_habitants(data, reg, report)
    check_calendar(data, reg, report)
    check_quetes(data, reg, report)
    check_courrier(data, reg, report)
    check_astuces(data, reg, report)
    check_envies(data, reg, report)
    check_textes_reglages(data, reg, report)
    check_tour9(data, reg, report)
    moments = check_moments(folder, reg, report, map_objects(folder))
    for moment, where in reg.moments_seen:
        if moment not in reg.moments:
            report.error(where, f"moment inconnu {moment!r}")
    for quest, where in reg.secret_role_uses:
        if quest not in reg.secret_quests:
            report.error(where, f"secret_role: la quête {quest!r} n'a pas de secret")
    check_secret_texts(data, report)
    check_souvenirs(data, reg, report)
    if moments is not None:
        data = {**data, "moments": moments}
    for name, content in data.items():
        walk_strings(content, name, report)
    readme = folder / "README.md"
    if readme.exists():
        walk_strings(readme.read_text(encoding="utf-8").replace("{", "").replace("}", ""), "README.md", report)
    for flag, where in sorted(reg.flags_read.items()):
        if flag not in reg.flags_set and flag not in FLAGS_SET_BY_CODE:
            report.warn(where, f"drapeau {flag!r} lu mais jamais posé par un effet")
    points = map_points(folder, report)
    used = {p: w for p, w in reg.points_used.items() if p not in NAMED_POINTS_OUTSIDE_MAP}
    if points is None:
        report.warn("cartes", f"aucune carte dans {folder / 'cartes'}: {len(used)} points attendus non vérifiés: "
                    + ", ".join(sorted(used)))
    else:
        for point, where in sorted(used.items()):
            if point not in points:
                report.error(where, f"point {point!r} absent de la carte")
    # Variantes tirées par la graine (condition `variant`): même `of` partout pour un groupe, chaque valeur utilisée.
    for group, uses in sorted(reg.variants.items()):
        sizes = {of for of, _, _ in uses}
        if len(sizes) != 1:
            report.error(uses[0][2], f"variant {group!r}: « of » différents {sorted(sizes)}")
            continue
        size = sizes.pop()
        missing = set(range(size)) - {value for _, value, _ in uses}
        if missing:
            report.warn(uses[0][2], f"variant {group!r}: valeurs jamais utilisées {sorted(missing)}")
    for warning in report.warnings:
        print(f"avertissement: {warning}")
    for error in report.errors:
        print(f"erreur: {error}")
    print(f"{len(reg.items)} objets, {len(reg.recipes)} recettes, {len(reg.constructions)} constructions, "
          f"{len(reg.crops)} cultures, {len(reg.villagers)} habitants, {len(reg.dialogues)} dialogues, "
          f"{len(reg.quests)} quêtes, {len(reg.letters)} lettres, {len(reg.envies)} envies, {len(reg.messages)} messages; "
          f"{len(report.errors)} erreur(s), {len(report.warnings)} avertissement(s)")
    return 1 if report.errors else 0


if __name__ == "__main__":
    sys.exit(main())
