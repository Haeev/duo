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
ID_RE = re.compile(r"^[a-z][a-z0-9_]*$")
TIME_RE = re.compile(r"^(([01][0-9]|2[0-3]):[0-5][0-9]|24:00)$")
PLACEHOLDER_RE = re.compile(r"\{([A-Za-z][A-Za-z0-9]*)\}")
FORBIDDEN_DASHES = (chr(0x2014), chr(0x2013))  # tirets cadratin et demi-cadratin, écrits par leur code
# Jours de la démo, de 1 à `reglages.clock.lastDay.day` (fixé au chargement dans main()).
DEMO_DAYS = range(1, 9)

ITEM_CATEGORIES = {"seed", "crop", "forage", "animal_product", "material", "carried", "tool", "food", "quest", "fish",
                   "decoration", "furniture"}
SHOPS = {"grocery", "catalogue"}
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
PROCEDURAL_ACTORS = {"glowworm_light": "src/rendu/vers-luisants.ts"}
# Tournures qui accordent au genre d'un joueur (rédaction neutre): un avertissement à relire, pas une erreur.
GENDERED_RE = re.compile(
    r"\b(?:tu es|tu étais|tu seras|vous êtes|vous étiez|vous serez|sois|soyez) "
    r"(?:fatigu|prêt|content|épuis|ravi|arrivé|parti|seul|occupé|installé|venu|perdu|les premi|les derni|tous|toutes"
    r"|nouveaux|nouvelles)"
    r"|\b(?:tous|toutes) les deux\b(?! (?:jours|nuits|heures|minutes|semaines|mois|ans)\b)"
    r"|\bles nouveaux\b|\bdes débutant|^(?:cher|chère|chers|chères) ",
    re.IGNORECASE,
)

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
}
COMMON_CONDITION_KEYS = {"type", "label"}

EFFECTS: dict[str, tuple[set[str], set[str]]] = {
    "give_item": ({"item", "count", "to"}, set()),
    "take_item": ({"item", "count", "from"}, set()),
    "give_money": ({"amount"}, set()),
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
    "if": ({"condition", "then", "else"}, set()),
}

HINT_TRIGGERS: dict[str, set[str]] = {
    "spawned": set(), "near_interactable": set(), "tool_used": set(), "near_point": {"point"},
    "near_construction": set(), "quest_started": {"quest"}, "aim_cell": {"cellState", "tool", "holding"},
    "sowed": set(), "tool_empty": {"item"}, "crop_ripe_in_view": set(), "time_reached": {"time"},
    "veillee_started": set(), "holding_furniture": set(), "big_purchase_attempt": set(), "letter_received": set(),
}

PLACEHOLDERS = {"startPurse", "order", "linesDone", "linesTotal", "amount", "partner", "missing", "item", "price",
                "count", "recipe", "envie", "quest", "title", "construction", "weekday", "day", "hours", "minutes",
                "days", "furniture", "move", "act", "examine", "notebook", "bigPurchase",
                # Tour 6 (R16): couleurs et noms des poules, ligne du secret (chez l'informé seul).
                "henColor1", "henColor2", "henColor3", "henName", "henUnknown", "secret"}

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
    return data


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
    if "days" in cond:
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
    if etype == "start_quest":
        reg.quests_started_by_effect.add(eff.get("quest", ""))
    if etype == "set_world_state":
        allowed = WORLD_STATES.get(eff.get("key", ""))
        if allowed is None or eff.get("value") not in allowed:
            report.error(w, f"état du monde inconnu {eff.get('key')!r}={eff.get('value')!r}")
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
        for j, dialogue in enumerate(villager.get("dialogues", [])):
            register(reg.dialogues, dialogue.get("id"), f"habitants.{villager.get('id')}.dialogues[{j}]", report)
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
            if dialogue.get("shared"):
                ref("point", dialogue.get("point"), wd, reg, report)
            check_conditions(dialogue.get("when", []), f"{wd}.when", reg, report)
            check_lines(dialogue.get("lines", []), wd, reg, report)
            check_effects(dialogue.get("effects", []), f"{wd}.effects", reg, report)


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
                deadline = step.get("deadline", {})
                if deadline.get("day") not in DEMO_DAYS:
                    report.error(ws, "échéance hors de la démo")
                check_time(deadline.get("time"), ws, report)
                check_effects(step.get("onDeadline", []), f"{ws}.onDeadline", reg, report)
            elif "resolve" in step:
                report.error(ws, f"« resolve » inconnu {step['resolve']!r}")
        check_effects(quest.get("completionEffects", []), f"{w}.completionEffects", reg, report)
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


def check_secret_texts(data: dict[str, Any], report: Report) -> None:
    """`{secret}` n'est permis que dans un texte vu par l'informé seul (objectif de son rôle)."""

    def visit(node: Any, where: str) -> None:
        if isinstance(node, str):
            if "{secret}" in node and not where.endswith("objectiveByRole.informed"):
                report.error(where, "{secret} hors d'un texte de l'informé (objectiveByRole.informed)")
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
                if not isinstance(f, list) or len(f) != 5:
                    report.error(wf, "image clé [t, x, y, z, clip] attendue")
                    continue
                t, x, y, z, clip = f
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


def map_objects(folder: Path) -> set[str] | None:
    maps = sorted((folder / "cartes").glob("*.json")) if (folder / "cartes").is_dir() else []
    found: set[str] = set()
    for path in maps:
        try:
            carte = json.loads(path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            continue
        found.update(o.get("id") for o in carte.get("objets", []) if isinstance(o, dict))
    return found if maps else None


def check_courrier(data: dict[str, Any], reg: Registry, report: Report) -> None:
    for letter in data.get("courrier", {}).get("letters", []):
        w = f"courrier.{letter.get('id')}"
        if letter.get("from") not in reg.senders:
            report.error(w, f"expéditeur inconnu {letter.get('from')!r}")
        delivery = letter.get("delivery", {})
        if not delivery.get("byEffect"):
            if delivery.get("day") not in DEMO_DAYS:
                report.error(w, "jour de livraison hors de la démo")
            check_time(delivery.get("time"), w, report)
        if "variants" in letter:
            if not letter["variants"] or letter["variants"][-1].get("when"):
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
    if set(textes.get("weather", {})) != WEATHERS:
        report.error("textes.weather", f"météos attendues {sorted(WEATHERS)}")
    settings = data.get("reglages", {})
    clock = settings.get("clock", {})
    for key in ("dayStart", "dayEnd", "veilleeFrom"):
        check_time(clock.get(key), f"reglages.clock.{key}", report)
    if not isinstance(clock.get("secondsPerGameMinute"), (int, float)) or clock["secondsPerGameMinute"] <= 0:
        report.error("reglages.clock", "« secondsPerGameMinute » positif attendu")
    weather = settings.get("weatherByDay", [])
    if len(weather) != len(DEMO_DAYS) or not set(weather) <= WEATHERS:
        report.error("reglages.weatherByDay", f"{len(DEMO_DAYS)} météos connues attendues, une par jour de la démo")
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
    levels_settings = [entry.get("level") for entry in settings.get("needs", {}).get("formLevels", [])]
    if levels_settings != FORM_LEVELS:
        report.error("reglages.needs.formLevels", f"niveaux attendus {FORM_LEVELS}")


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
    check_cultures(data, reg, report)
    check_habitants(data, reg, report)
    check_quetes(data, reg, report)
    check_courrier(data, reg, report)
    check_astuces(data, reg, report)
    check_envies(data, reg, report)
    check_textes_reglages(data, reg, report)
    moments = check_moments(folder, reg, report, map_objects(folder))
    for moment, where in reg.moments_seen:
        if moment not in reg.moments:
            report.error(where, f"moment inconnu {moment!r}")
    for quest, where in reg.secret_role_uses:
        if quest not in reg.secret_quests:
            report.error(where, f"secret_role: la quête {quest!r} n'a pas de secret")
    check_secret_texts(data, report)
    if moments is not None:
        data = {**data, "moments": moments}
    for name, content in data.items():
        walk_strings(content, name, report)
    readme = folder / "README.md"
    if readme.exists():
        walk_strings(readme.read_text(encoding="utf-8").replace("{", "").replace("}", ""), "README.md", report)
    for flag, where in sorted(reg.flags_read.items()):
        if flag not in reg.flags_set:
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
