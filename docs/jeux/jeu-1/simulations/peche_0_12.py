"""Pêche 0.12.0 de La Petite Ligne: simulation de Monte-Carlo des raretés, des ombres et du carnet.

Conception: `docs/jeux/jeu-1/peche-0-12-conception.md`. Les tables POISSONS, ZONES et REGLAGES
sont celles du document (section 2 et 9); `--tableaux` les réimprime en Markdown pour le contrôle
croisé.

Ce que le script mesure:
1. la part de chaque rareté par prise, par coin et par situation (coin qui frémit, aube, à deux,
   guetteur), pour vérifier les plafonds;
2. le gain moyen par prise, comparé à la pêche de la 0.11 (trois poissons, 3,6 de monnaie);
3. la part de chaque poisson dans les prises par saison (base du coût des lignes de commande);
4. le remplissage du carnet: jour de la première prise de chaque poisson, pour des duos
   « attentifs » et « tranquilles », sur deux années de jeu (R10 du plan des 100 heures);
5. les légendaires et les mythiques: combien par saison et par année, au plus.

Lancement: python3 docs/jeux/jeu-1/simulations/peche_0_12.py [--duos 400] [--tableaux]
"""
from __future__ import annotations

import argparse
import random
import statistics
from dataclasses import dataclass, field

SAISONS = ["spring", "summer", "autumn", "winter"]
NOM_SAISON = {"spring": "printemps", "summer": "été", "autumn": "automne", "winter": "hiver"}
JOURS_PAR_SAISON = 21
PREMIER_JOUR_GRANDS = 16
SECONDES_PAR_MINUTE = 0.7  # reglages.clock.secondsPerGameMinute
SECONDES_PAR_PRISE = 12.0  # lancer 1 s + attente moyenne 9 s + touche et prise 2 s
MINUTES_PAR_PRISE = SECONDES_PAR_PRISE / SECONDES_PAR_MINUTE  # environ 17 minutes de jeu

COMMUN, RARE, EPIQUE, LEGENDAIRE, MYTHIQUE = 1, 2, 3, 4, 5
NOM_RARETE = {1: "commun", 2: "rare", 3: "épique", 4: "légendaire", 5: "mythique"}

# Plages horaires (heures de jeu, fin exclue).
TOUTE = (6, 24)
JOUR = (9, 19)


@dataclass(frozen=True)
class Poisson:
    id: str
    nom: str
    rarete: int
    coins: tuple[str, ...]
    saisons: tuple[str, ...]
    heures: tuple[tuple[int, int], ...]
    meteo: tuple[str, ...]  # sunny, cloudy, rain
    ombre: str  # petite, moyenne, grande, immense
    prix: int  # 0: remis à l'eau
    favori: tuple[str, ...] = ()  # conditions qui doublent le poids: rain, mist, spring
    pluie_toute_heure: bool = False  # la pluie lève la contrainte d'heure


TOUT_TEMPS = ("sunny", "cloudy", "rain")
SEC = ("sunny", "cloudy")
RIVIERE = ("ford", "sands", "pontoon", "confluence", "upstream", "downstream")

POISSONS: list[Poisson] = [
    Poisson("gudgeon", "goujon", COMMUN, ("ford", "sands", "confluence", "upstream", "downstream"), tuple(SAISONS), (TOUTE,), TOUT_TEMPS, "petite", 2),
    Poisson("minnow", "vairon", COMMUN, ("ru", "ford", "confluence"), tuple(SAISONS), ((6, 21),), TOUT_TEMPS, "petite", 1),
    Poisson("stone_loach", "loche franche", COMMUN, ("ru", "ford"), tuple(SAISONS), ((17, 24),), TOUT_TEMPS, "petite", 1, pluie_toute_heure=True),
    Poisson("bleak", "ablette", COMMUN, ("pontoon", "sands", "downstream"), ("spring", "summer", "autumn"), (JOUR,), SEC, "petite", 2),
    Poisson("roach", "gardon", COMMUN, ("pontoon", "sands", "upstream", "downstream"), tuple(SAISONS), (TOUTE,), TOUT_TEMPS, "moyenne", 2),
    Poisson("chub", "chevesne", COMMUN, RIVIERE, tuple(SAISONS), (TOUTE,), TOUT_TEMPS, "moyenne", 4),
    Poisson("trout", "truite fario", RARE, ("ru", "ford", "confluence"), ("spring", "summer", "autumn"), (TOUTE,), TOUT_TEMPS, "moyenne", 8, favori=("rain", "spring")),
    Poisson("perch", "perche", RARE, ("pontoon", "sands", "upstream"), tuple(SAISONS), (JOUR,), TOUT_TEMPS, "moyenne", 7),
    Poisson("dace", "vandoise", RARE, ("ford", "confluence", "upstream"), ("autumn", "winter", "spring"), (JOUR,), TOUT_TEMPS, "moyenne", 6),
    Poisson("bullhead", "chabot", RARE, ("ru", "ford"), tuple(SAISONS), (TOUTE,), TOUT_TEMPS, "petite", 4),
    Poisson("tench", "tanche", RARE, ("pontoon", "sands", "upstream"), ("summer", "autumn"), ((6, 10), (18, 24)), SEC, "moyenne", 9),
    Poisson("barbel", "barbeau", EPIQUE, ("ford", "confluence", "downstream"), ("spring", "summer", "autumn"), ((17, 24),), TOUT_TEMPS, "grande", 16),
    Poisson("pike", "brochet", EPIQUE, ("pontoon", "sands", "downstream"), ("summer", "autumn", "winter"), (JOUR,), TOUT_TEMPS, "grande", 24, favori=("rain",)),
    Poisson("grayling", "ombre commun", EPIQUE, ("ford", "confluence", "downstream"), ("autumn", "winter"), ((8, 19),), TOUT_TEMPS, "moyenne", 18, favori=("mist",)),
    Poisson("brook_lamprey", "lamproie de Planer", EPIQUE, ("ru", "confluence"), ("spring", "summer"), (TOUTE,), TOUT_TEMPS, "moyenne", 0, favori=("rain",)),
    Poisson("bitterling", "bouvière", EPIQUE, ("pontoon", "sands", "upstream"), ("spring", "summer"), (JOUR,), SEC, "petite", 0),
]

PAR_ID = {p.id: p for p in POISSONS}


@dataclass(frozen=True)
class Grand:
    """Légendaire ou mythique: présence tirée à l'aube, une seule ombre, un seul coin."""

    id: str
    nom: str
    rarete: int
    coin: str
    saison: str
    heures: tuple[int, int]
    condition: str  # any, dry, wet (pluie ou lendemain de pluie), mist, misty_or_wet, night_dry
    presence: float
    prix: int
    prerequis: str = ""  # poisson déjà pris par le duo
    ombre: str = "immense"


GRANDS: list[Grand] = [
    Grand("shad", "alose", LEGENDAIRE, "ford", "spring", (19, 24), "any", 0.35, 50),
    Grand("mirror_carp", "carpe miroir", LEGENDAIRE, "pontoon", "summer", (6, 9), "dry", 0.30, 60),
    Grand("salmon", "saumon", LEGENDAIRE, "confluence", "autumn", (9, 17), "wet", 0.40, 90),
    Grand("burbot", "lote", LEGENDAIRE, "upstream", "winter", (19, 24), "misty_or_wet", 0.35, 60, ombre="grande"),
    Grand("golden_trout", "la Dorée", MYTHIQUE, "ru", "autumn", (6, 9), "mist", 0.25, 0, prerequis="trout", ombre="moyenne"),
    Grand("moon_pike", "le Brochet de lune", MYTHIQUE, "pontoon", "winter", (21, 24), "night_dry", 0.25, 0, prerequis="pike"),
]

ZONES = {
    "ford": ("Le gué", 3),
    "sands": ("Les sables", 3),
    "pontoon": ("Le ponton", 4),
    "confluence": ("Le confluent", 3),
    "ru": ("Le ru", 2),
    "upstream": ("L'amont", 3),
    "downstream": ("L'aval", 3),
}

REGLAGES = {
    "tierWeights": {COMMUN: 72.0, RARE: 24.0, EPIQUE: 4.0},
    "hotSpot": {RARE: 1.6, EPIQUE: 2.5},
    "rain": {RARE: 1.15, EPIQUE: 1.0},
    "mist": {RARE: 1.0, EPIQUE: 1.3},
    "goldenHours": {RARE: 1.2, EPIQUE: 1.2},  # 6 h à 9 h et 17 h à 21 h
    "together": {RARE: 1.2, EPIQUE: 1.25},
    "maxShare": {RARE: 0.40, EPIQUE: 0.15},
    "favoriteFactor": 2.0,
    "unseenFactor": {COMMUN: 4.0, RARE: 4.0, EPIQUE: 8.0},
    "unseenEpicTier": 1.5,
    "grandUnseenPresence": 1.5,
    "grandPresenceMax": 0.6,
    "streakLength": 3,
    "streakFactor": 1 / 3,
    "maxSameSpecies": 2,
    "pityAfterCommons": 10,
    "shadowLifeSeconds": (60.0, 120.0),
    "hookMiss": 0.10,
    "grandHookMiss": 0.15,
    "mythicNetSuccess": 0.95,
}


def heure_dans(h: float, plages: tuple[tuple[int, int], ...]) -> bool:
    return any(a <= h < b for a, b in plages)


def eligible(p: Poisson, coin: str, saison: str, h: float, meteo: str) -> bool:
    if coin not in p.coins or saison not in p.saisons or meteo not in p.meteo:
        return False
    if p.pluie_toute_heure and meteo == "rain":
        return True
    return heure_dans(h, p.heures)


@dataclass
class Contexte:
    coin: str
    saison: str
    heure: float
    meteo: str
    brume: bool
    coin_du_jour: bool
    a_deux: bool


def poids_raretes(ctx: Contexte, vus: set[str] | None = None) -> dict[int, float]:
    w = dict(REGLAGES["tierWeights"])
    if vus is not None and any(
        p.rarete == EPIQUE and p.id not in vus and eligible(p, ctx.coin, ctx.saison, ctx.heure, ctx.meteo) for p in POISSONS
    ):
        w[EPIQUE] *= REGLAGES["unseenEpicTier"]
    for tier in (RARE, EPIQUE):
        if ctx.coin_du_jour:
            w[tier] *= REGLAGES["hotSpot"][tier]
        if ctx.meteo == "rain":
            w[tier] *= REGLAGES["rain"][tier]
        if ctx.brume and ctx.heure < 10.5:
            w[tier] *= REGLAGES["mist"][tier]
        if 6 <= ctx.heure < 9 or 17 <= ctx.heure < 21:
            w[tier] *= REGLAGES["goldenHours"][tier]
        if ctx.a_deux:
            w[tier] *= REGLAGES["together"][tier]
    for tier in (COMMUN, RARE, EPIQUE):
        if not any(eligible(p, ctx.coin, ctx.saison, ctx.heure, ctx.meteo) for p in POISSONS if p.rarete == tier):
            w[tier] = 0.0
    total = sum(w.values())
    if total <= 0:
        return w
    parts = {t: v / total for t, v in w.items()}
    # Plafonds: l'excédent revient aux communs (ou à la rareté du dessous s'il n'y a pas de commun).
    for tier in (EPIQUE, RARE):
        plafond = REGLAGES["maxShare"][tier]
        if parts[tier] > plafond:
            surplus = parts[tier] - plafond
            parts[tier] = plafond
            cible = COMMUN if parts[COMMUN] > 0 else RARE
            parts[cible] += surplus
    return parts


@dataclass
class Memoire:
    vus: set[str] = field(default_factory=set)
    dernieres: list[str] = field(default_factory=list)
    communs_de_suite: int = 0


def tirer_espece(rng: random.Random, ctx: Contexte, mem: Memoire, presents: list[str], forcer_rare: bool) -> str | None:
    parts = poids_raretes(ctx, mem.vus)
    if forcer_rare and (parts[RARE] + parts[EPIQUE]) > 0:
        parts = {COMMUN: 0.0, RARE: parts[RARE], EPIQUE: parts[EPIQUE]}
    tiers = [t for t in parts if parts[t] > 0]
    if not tiers:
        return None
    tier = rng.choices(tiers, weights=[parts[t] for t in tiers])[0]
    candidats = []
    poids = []
    n = REGLAGES["streakLength"]
    serie = mem.dernieres[-n:]
    for p in POISSONS:
        if p.rarete != tier or not eligible(p, ctx.coin, ctx.saison, ctx.heure, ctx.meteo):
            continue
        if presents.count(p.id) >= REGLAGES["maxSameSpecies"]:
            continue
        w = 1.0
        if ("rain" in p.favori and ctx.meteo == "rain") or ("mist" in p.favori and ctx.brume) or (
            "spring" in p.favori and ctx.saison == "spring"
        ):
            w *= REGLAGES["favoriteFactor"]
        if p.id not in mem.vus:
            w *= REGLAGES["unseenFactor"][tier]
        if len(serie) == n and all(s == p.id for s in serie):
            w *= REGLAGES["streakFactor"]
        candidats.append(p.id)
        poids.append(w)
    if not candidats:
        return None
    return rng.choices(candidats, weights=poids)[0]


TAILLE = {"petite": 1, "moyenne": 2, "grande": 3, "immense": 4}


def choisir_cible(rng: random.Random, ombres: list[str], guetteur: bool) -> int:
    """Le joueur vise une ombre: la plus haute rareté s'il a un guetteur, sinon souvent la plus grande."""
    if guetteur:
        return max(range(len(ombres)), key=lambda i: (PAR_ID[ombres[i]].rarete, rng.random()))
    if rng.random() < 0.6:
        return max(range(len(ombres)), key=lambda i: (TAILLE[PAR_ID[ombres[i]].ombre], rng.random()))
    return rng.randrange(len(ombres))


def sortie(rng: random.Random, ctx0: Contexte, prises_par_joueur: int, joueurs: int, guetteur: bool, mem: Memoire) -> list[str]:
    """Une sortie de pêche dans un coin: ombres présentes, prises, renouvellement."""
    prises: list[str] = []
    ctx = Contexte(**ctx0.__dict__)
    n_ombres = ZONES[ctx.coin][1]
    ombres: list[str] = []
    for _ in range(n_ombres):
        e = tirer_espece(rng, ctx, mem, ombres, False)
        if e is not None:
            ombres.append(e)
    vie_moy = sum(REGLAGES["shadowLifeSeconds"]) / 2
    for _ in range(prises_par_joueur):
        for _j in range(joueurs):
            if not ombres:
                e = tirer_espece(rng, ctx, mem, ombres, False)
                if e is None:
                    return prises
                ombres.append(e)
            i = choisir_cible(rng, ombres, guetteur)
            espece = ombres.pop(i)
            if rng.random() >= REGLAGES["hookMiss"]:
                prises.append(espece)
                mem.vus.add(espece)
                mem.dernieres.append(espece)
                if PAR_ID[espece].rarete == COMMUN:
                    mem.communs_de_suite += 1
                else:
                    mem.communs_de_suite = 0
            forcer = mem.communs_de_suite >= REGLAGES["pityAfterCommons"]
            e = tirer_espece(rng, ctx, mem, ombres, forcer)
            if e is not None:
                ombres.append(e)
        # Les ombres non visées s'en vont et sont remplacées.
        for k in range(len(ombres)):
            if rng.random() < SECONDES_PAR_PRISE / vie_moy:
                e = tirer_espece(rng, ctx, mem, ombres[:k] + ombres[k + 1 :], False)
                if e is not None:
                    ombres[k] = e
        ctx.heure = min(23.9, ctx.heure + MINUTES_PAR_PRISE / 60)
    return prises


# ---------------------------------------------------------------- 1. parts par situation

def parts_situation(rng: random.Random, coin: str, saison: str, heure: float, meteo: str, brume: bool, cdj: bool, a_deux: bool, guetteur: bool, n: int = 4000) -> dict[int, float]:
    compte = {t: 0 for t in (1, 2, 3)}
    total = 0
    for _ in range(n // 20):
        mem = Memoire(vus={p.id for p in POISSONS})  # carnet complet: pas de coup de pouce
        ctx = Contexte(coin, saison, heure, meteo, brume, cdj, a_deux)
        for e in sortie(rng, ctx, 10, 2 if a_deux else 1, guetteur, mem):
            compte[PAR_ID[e].rarete] += 1
            total += 1
    return {t: compte[t] / max(1, total) for t in compte}


# ---------------------------------------------------------------- 4. vie d'un duo

POIDS_COINS = {"ford": 3, "pontoon": 3, "sands": 2, "confluence": 1.5, "ru": 1, "upstream": 1.5, "downstream": 1}
METEO = {"spring": [45, 25, 30], "summer": [60, 22, 18], "autumn": [35, 30, 35], "winter": [30, 45, 25]}
BRUME = {"spring": 0.08, "summer": 0.04, "autumn": 0.25, "winter": 0.15}


@dataclass
class Profil:
    nom: str
    jours_peche: float  # part des journées où le duo pêche
    voit_coin: float  # part des sorties où il va au coin qui frémit
    a_deux: float
    guetteur: float  # quand un seul pêche, l'autre fait le guet
    va_au_grand: float  # part des fenêtres d'un grand (heure et coin connus) où le duo y est
    va_au_mythique: float


PROFILS = [
    Profil("attentif", 0.7, 0.6, 0.5, 0.5, 0.35, 0.5),
    Profil("tranquille", 0.45, 0.25, 0.4, 0.2, 0.12, 0.15),
]


def saison_du_jour(jour: int) -> str:
    return SAISONS[((jour - 1) // JOURS_PAR_SAISON) % 4]


def condition_ok(cond: str, meteo: str, hier: str, brume: bool) -> bool:
    if cond == "any":
        return True
    if cond == "dry":
        return meteo != "rain"
    if cond == "wet":
        return meteo == "rain" or hier == "rain"
    if cond == "mist":
        return brume
    if cond == "misty_or_wet":
        return brume or meteo != "sunny"
    if cond == "night_dry":
        return meteo != "rain"
    raise ValueError(cond)


def vie_duo(rng: random.Random, profil: Profil, jours: int, premier_jour_peche: int = 3) -> dict:
    mem = Memoire()
    premiere: dict[str, int] = {}
    gains = 0
    prises_total = 0
    grands_par_an: dict[tuple[str, int], int] = {}
    pris_saison: set[tuple[str, int]] = set()
    hier = "sunny"
    coin_hier = ""
    for jour in range(1, jours + 1):
        saison = saison_du_jour(jour)
        annee = (jour - 1) // (4 * JOURS_PAR_SAISON)
        idx_saison = (jour - 1) // JOURS_PAR_SAISON
        meteo = rng.choices(["sunny", "cloudy", "rain"], weights=METEO[saison])[0]
        brume = hier == "rain" or rng.random() < BRUME[saison]
        coin_jour = rng.choice([c for c in ZONES if c != coin_hier])
        coin_hier = coin_jour
        if jour < premier_jour_peche:
            hier = meteo
            continue
        # Grands du jour: présence tirée à l'aube, à partir du jour 16 (la démo ne change pas).
        legendaire_pris = False
        for g in GRANDS:
            if jour < PREMIER_JOUR_GRANDS or g.saison != saison or not condition_ok(g.condition, meteo, hier, brume):
                continue
            if g.prerequis and g.prerequis not in premiere:
                continue
            cle = (g.id, idx_saison if g.rarete == LEGENDAIRE else annee)
            presence = g.presence
            if g.rarete == LEGENDAIRE and g.id not in premiere:
                presence = min(REGLAGES["grandPresenceMax"], presence * REGLAGES["grandUnseenPresence"])
            if cle in pris_saison or rng.random() >= presence:
                continue
            if g.rarete == LEGENDAIRE and legendaire_pris:
                continue
            p_y_etre = profil.va_au_grand if g.rarete == LEGENDAIRE else profil.va_au_mythique
            if g.id not in premiere and g.rarete == LEGENDAIRE:
                # Avant la première prise, le duo ne connaît que la rumeur: il y est moins souvent.
                p_y_etre *= 0.6
            if rng.random() < p_y_etre:
                reussite = REGLAGES["mythicNetSuccess"] if g.rarete == MYTHIQUE else 1 - REGLAGES["grandHookMiss"]
                if rng.random() < reussite:
                    pris_saison.add(cle)
                    premiere.setdefault(g.id, jour)
                    gains += g.prix
                    grands_par_an[(g.id, annee)] = grands_par_an.get((g.id, annee), 0) + 1
                    if g.rarete == LEGENDAIRE:
                        legendaire_pris = True
        if rng.random() < profil.jours_peche:
            sorties = 1 if rng.random() < 0.7 else 2
            for _ in range(sorties):
                coin = coin_jour if rng.random() < profil.voit_coin else rng.choices(list(POIDS_COINS), weights=list(POIDS_COINS.values()))[0]
                heure = rng.uniform(6, 22)
                duree_h = rng.uniform(1, 3)
                a_deux = rng.random() < profil.a_deux
                guetteur = (not a_deux) and rng.random() < profil.guetteur
                n = max(1, round(duree_h * 60 / MINUTES_PAR_PRISE))
                ctx = Contexte(coin, saison, heure, meteo, brume, coin == coin_jour, a_deux)
                for e in sortie(rng, ctx, n, 2 if a_deux else 1, guetteur, mem):
                    premiere.setdefault(e, jour)
                    gains += PAR_ID[e].prix
                    prises_total += 1
        hier = meteo
    return {"premiere": premiere, "gains": gains, "prises": prises_total, "grands": grands_par_an}


def heures_de_jeu(jour: int) -> float:
    return jour * 18 * 60 * SECONDES_PAR_MINUTE / 3600


def centile(valeurs: list[float], q: float) -> float:
    if not valeurs:
        return float("nan")
    v = sorted(valeurs)
    return v[min(len(v) - 1, int(q * len(v)))]


def tableaux() -> None:
    print("| id | nom | rareté | coins | saisons | heures | météo | ombre | prix |")
    print("|---|---|---|---|---|---|---|---|---|")
    for p in POISSONS:
        h = ", ".join(f"{a} h à {b} h" for a, b in p.heures)
        print(f"| `{p.id}` | {p.nom} | {NOM_RARETE[p.rarete]} | {', '.join(p.coins)} | {', '.join(NOM_SAISON[s] for s in p.saisons)} | {h} | {', '.join(p.meteo)} | {p.ombre} | {p.prix} |")
    for g in GRANDS:
        print(f"| `{g.id}` | {g.nom} | {NOM_RARETE[g.rarete]} | {g.coin} | {NOM_SAISON[g.saison]} | {g.heures[0]} h à {g.heures[1]} h | {g.condition} | {g.ombre} | {g.prix} | présence {g.presence} |")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--duos", type=int, default=400)
    ap.add_argument("--graine", type=int, default=12)
    ap.add_argument("--tableaux", action="store_true")
    args = ap.parse_args()
    if args.tableaux:
        tableaux()
        return
    rng = random.Random(args.graine)

    # Contrôle: chaque coin a un commun à toute heure, en toute saison, par tout temps.
    trous = []
    for coin in ZONES:
        for s in SAISONS:
            for h in range(6, 24):
                for m in ("sunny", "cloudy", "rain"):
                    if not any(eligible(p, coin, s, h + 0.5, m) for p in POISSONS if p.rarete == COMMUN):
                        trous.append((coin, s, h, m))
    print(f"Créneaux sans poisson commun: {len(trous)}")

    # R8: au moins trois poissons changent d'une saison à l'autre.
    for i, s in enumerate(SAISONS):
        t = SAISONS[(i + 1) % 4]
        a = {p.id for p in POISSONS if s in p.saisons} | {g.id for g in GRANDS if g.saison == s}
        b = {p.id for p in POISSONS if t in p.saisons} | {g.id for g in GRANDS if g.saison == t}
        print(f"R8 {NOM_SAISON[s]} vers {NOM_SAISON[t]}: {len(a ^ b)} poissons changent ({len(b)} possibles en {NOM_SAISON[t]})")

    print("\n1. Part des raretés par prise (carnet complet, 4 000 prises par ligne)")
    print("| situation | commun | rare | épique |")
    print("|---|---|---|---|")
    cas = [
        ("gué, été, 13 h, soleil, seul", "ford", "summer", 13, "sunny", False, False, False, False),
        ("gué, été, 19 h, soleil, seul", "ford", "summer", 19, "sunny", False, False, False, False),
        ("ponton, été, 13 h, soleil, seul", "pontoon", "summer", 13, "sunny", False, False, False, False),
        ("ponton, été, 13 h, à deux", "pontoon", "summer", 13, "sunny", False, False, True, False),
        ("ponton, été, 13 h, seul avec guetteur", "pontoon", "summer", 13, "sunny", False, False, False, True),
        ("ponton, été, 13 h, coin qui frémit, seul", "pontoon", "summer", 13, "sunny", False, True, False, False),
        ("ponton, été, 13 h, coin qui frémit, à deux", "pontoon", "summer", 13, "sunny", False, True, True, False),
        ("ponton, été, 13 h, coin qui frémit, guetteur", "pontoon", "summer", 13, "sunny", False, True, False, True),
        ("gué, automne, 8 h, pluie et brume, coin qui frémit, à deux (tout cumulé)", "ford", "autumn", 8, "rain", True, True, True, False),
        ("gué, automne, 10 h, brume, coin qui frémit, guetteur (tout cumulé)", "ford", "autumn", 10, "cloudy", True, True, False, True),
        ("ru, printemps, 13 h, soleil, seul", "ru", "spring", 13, "sunny", False, False, False, False),
        ("ru, automne, 7 h, brume, seul", "ru", "autumn", 7, "cloudy", True, False, False, False),
    ]
    for nom, *a in cas:
        r = parts_situation(rng, *a)
        print(f"| {nom} | {r[1]:.0%} | {r[2]:.0%} | {r[3]:.0%} |")

    print("\n2 et 3. Vie de duos sur deux années (jours 1 à 168)")
    jours = 168
    for profil in PROFILS:
        vies = [vie_duo(rng, profil, jours) for _ in range(args.duos)]
        par_prise = statistics.mean(v["gains"] / max(1, v["prises"]) for v in vies)
        prises_jour = statistics.mean(v["prises"] / (jours - 2) for v in vies)
        print(f"\nProfil {profil.nom}: {prises_jour:.1f} prises par jour, {par_prise:.2f} de monnaie par prise (grands compris)")
        print("| poisson | rareté | pris en année 1 (jours 1 à 84) | pris avant le jour 64 | jour médian de la 1re prise | 90e centile |")
        print("|---|---|---|---|---|---|")
        tous = [(p.id, p.nom, p.rarete) for p in POISSONS] + [(g.id, g.nom, g.rarete) for g in GRANDS]
        for pid, nom, rarete in tous:
            j = [v["premiere"][pid] for v in vies if pid in v["premiere"]]
            a1 = sum(1 for v in vies if v["premiere"].get(pid, 999) <= 84) / len(vies)
            a64 = sum(1 for v in vies if v["premiere"].get(pid, 999) < 64) / len(vies)
            med = statistics.median(j) if j else float("nan")
            p90 = centile(j + [999] * (len(vies) - len(j)), 0.9)
            p90s = "jamais" if p90 >= 999 else str(p90)
            print(f"| {nom} | {NOM_RARETE[rarete]} | {a1:.0%} | {a64:.0%} | {med:.0f} | {p90s} |")
        # R10: retard de la dernière entrée (communs à épiques) sur la dernière débloquée (hiver, jour 64).
        retards = []
        for v in vies:
            der = max(v["premiere"].get(p.id, 10_000) for p in POISSONS)
            retards.append(heures_de_jeu(der) - heures_de_jeu(64))
        print(f"R10 (communs à épiques, dernière saison débloquée au jour 64): retard au 90e centile = {centile(retards, 0.9):.1f} h de jeu")
        # Plafond des grands: au plus un par saison pour un légendaire, un par an pour un mythique.
        maxi = max((n for v in vies for n in v["grands"].values()), default=0)
        print(f"Plus grand nombre de prises d'un même grand dans une même année: {maxi}")
        leg = [sum(n for (gid, an), n in v["grands"].items() if PAR_ID.get(gid) is None and gid in {g.id for g in GRANDS if g.rarete == LEGENDAIRE} and an == 0) for v in vies]
        print(f"Légendaires pris en année 1: moyenne {statistics.mean(leg):.1f}, maximum {max(leg)}")

    print("\n4. Part de chaque poisson dans les prises, par saison (profil attentif, sans coup de pouce)")
    print("| poisson | " + " | ".join(NOM_SAISON[s] for s in SAISONS) + " |")
    print("|---|---|---|---|---|")
    parts = {s: {} for s in SAISONS}
    for s in SAISONS:
        compte: dict[str, int] = {}
        total = 0
        for _ in range(600):
            mem = Memoire(vus={p.id for p in POISSONS})
            coin = rng.choices(list(POIDS_COINS), weights=list(POIDS_COINS.values()))[0]
            meteo = rng.choices(["sunny", "cloudy", "rain"], weights=METEO[s])[0]
            ctx = Contexte(coin, s, rng.uniform(6, 22), meteo, rng.random() < BRUME[s], rng.random() < 0.3, rng.random() < 0.5)
            for e in sortie(rng, ctx, 6, 1, False, mem):
                compte[e] = compte.get(e, 0) + 1
                total += 1
        parts[s] = {k: v / total for k, v in compte.items()}
    for p in POISSONS:
        print(f"| {p.nom} | " + " | ".join(f"{parts[s].get(p.id, 0):.3f}" for s in SAISONS) + " |")
    ev = {s: sum(parts[s].get(p.id, 0) * p.prix for p in POISSONS) for s in SAISONS}
    print("Gain moyen par prise (sans les grands): " + ", ".join(f"{NOM_SAISON[s]} {ev[s]:.2f}" for s in SAISONS) + " de monnaie (0.11: 3,6 au printemps)")


if __name__ == "__main__":
    main()
