"""Refonte de La Petite Ligne: calage des besoins et de l'économie de départ.

Lancer: python3 docs/jeux/jeu-1/simulations/refonte_besoins_economie.py
Graine fixe, résultat identique à chaque lancement. Les valeurs ci-dessous sont
celles des tables du cahier (docs/jeux/jeu-1/refonte/cahier-des-charges.md,
sections 4.3, 4.4 et 4.6): toute retouche se fait des deux côtés.
"""
import random

# --- Horloge (minutes réelles) ---
JOUR, NUIT = 30.0, 20.0
PAS = 0.1

# --- Besoins: perte en points par minute réelle éveillée ---
FAIM_MIN, FAIM_EFFORT = 2.0, 1.5      # x1,5 pendant un effort (outil, course)
SOMMEIL_MIN = 1.6
HYGIENE_MIN, SALISSURE = 1.0, 1.0     # -1 par geste salissant
SIESTE_MIN = 6.0                      # gain de sommeil par minute de sieste
NUIT_AU_LIT = {"sommeil": 100.0, "faim": -15.0, "hygiene": -10.0}
PLAT_SIMPLE = 35.0
TOILETTE = 100.0
SEUIL_MALUS, SEUIL_BONUS = 20.0, 50.0

PROFILS = {
    # mange sous, dort (proba par nuit), se lave sous, part d'effort, gestes salissants par jour
    "régulier":      dict(mange=55, dort=1.0, lave=60, effort=0.40, sales=15),
    "tête en l'air": dict(mange=20, dort=0.6, lave=20, effort=0.40, sales=15),
    "noctambule":    dict(mange=45, dort=0.0, lave=50, effort=0.50, sales=25),
}


def palier(v: float) -> str:
    if v <= 0:
        return "bloqué"
    if v <= SEUIL_MALUS:
        return "malus"
    if v <= SEUIL_BONUS:
        return "neutre"
    return "bonus"


def simule_besoins(p: dict, jours: int, rng: random.Random) -> dict:
    b = {"faim": 100.0, "sommeil": 100.0, "hygiene": 100.0}
    temps = {k: {"bloqué": 0.0, "malus": 0.0, "neutre": 0.0, "bonus": 0.0} for k in b}
    forme = 0.0
    eveil = repas = toilettes = siestes = 0.0
    for _ in range(jours):
        dort = rng.random() < p["dort"]
        duree = JOUR if dort else JOUR + NUIT
        t = 0.0
        while t < duree:
            if b["sommeil"] <= SEUIL_MALUS:
                # sieste choisie par le joueur dès le malus, jusqu'à 60
                while b["sommeil"] < 60 and t < duree:
                    b["sommeil"] += SIESTE_MIN * PAS
                    t += PAS
                siestes += 1
                continue
            effort = rng.random() < p["effort"]
            b["faim"] = max(0.0, b["faim"] - FAIM_MIN * (FAIM_EFFORT if effort else 1.0) * PAS)
            b["sommeil"] = max(0.0, b["sommeil"] - SOMMEIL_MIN * PAS)
            b["hygiene"] = max(0.0, b["hygiene"] - HYGIENE_MIN * PAS)
            if rng.random() < p["sales"] / JOUR * PAS:
                b["hygiene"] = max(0.0, b["hygiene"] - SALISSURE)
            if b["faim"] < p["mange"]:
                b["faim"] = min(100.0, b["faim"] + PLAT_SIMPLE)
                repas += 1
            if b["hygiene"] < p["lave"]:
                b["hygiene"] = TOILETTE
                toilettes += 1
            for k in b:
                temps[k][palier(b[k])] += PAS
            if all(v > SEUIL_BONUS for v in b.values()):
                forme += PAS
            eveil += PAS
            t += PAS
        if dort:
            b["sommeil"] = NUIT_AU_LIT["sommeil"]
            b["faim"] = max(0.0, b["faim"] + NUIT_AU_LIT["faim"])
            b["hygiene"] = max(0.0, b["hygiene"] + NUIT_AU_LIT["hygiene"])
    return dict(temps=temps, eveil=eveil, repas=repas / jours, toilettes=toilettes / jours,
                siestes=siestes / jours, forme=forme / eveil)


# --- Économie de départ (sous) ---
VALEUR_PAR_CASE = 50.0     # une pile vendue au bon commerçant (moyenne du tableau des prix)
MIN_PAR_CASE = 2.0         # minutes réelles pour remplir une pile avec les outils de base
MIN_TRAJET_VENTE = 1.5
CASES_LIBRES_DEPART = 2    # barre de 5, dont 3 outils
SACS = [(0, 4), (350, 6), (900, 10)]            # (prix, cases) disponibles à Aubrune
OUTILS_AMELIORES = 300     # par outil, gain de vitesse x1,5 sur la récolte
NB_OUTILS = 3
REPAS_ACHETES = 14.0       # sous par plat si on ne cuisine pas
MAISON = [("cuisine", 1500), ("chambre", 3000), ("troisième pièce", 4500), ("étage", 8000)]
MEUBLES_PAR_JOUR = 0.10    # part du revenu commun qui part en meubles et tenues


def revenu_minute(cases: int, vitesse: float) -> float:
    cycle = cases * MIN_PAR_CASE / vitesse + MIN_TRAJET_VENTE
    return cases * VALEUR_PAR_CASE / cycle


def simule_economie(part_recolte: float, part_commune: float) -> list:
    """Deux joueurs identiques. part_recolte: part de la journée passée à récolter et vendre."""
    bourse = [0.0, 0.0]
    cases = [CASES_LIBRES_DEPART, CASES_LIBRES_DEPART]
    sac = [0, 0]
    outils = [0, 0]
    coffre = 0.0
    etape = 0
    journal = []
    for jour in range(1, 121):
        for j in (0, 1):
            vitesse = 1.0 + 0.5 * outils[j] / NB_OUTILS
            gain = revenu_minute(cases[j], vitesse) * JOUR * part_recolte - 2 * REPAS_ACHETES * 0.5
            verse = gain * part_commune
            coffre += verse * (1 - MEUBLES_PAR_JOUR)
            bourse[j] += gain - verse
            if jour >= 2 and sac[j] == 0:                # besace offerte par la quête, jour 2
                sac[j], cases[j] = 1, CASES_LIBRES_DEPART + SACS[0][1]
                if j == 1:
                    journal.append((jour, "besace de 4 (quête)"))
            if sac[j] == 1 and bourse[j] >= SACS[1][0]:
                bourse[j] -= SACS[1][0]
                sac[j], cases[j] = 2, CASES_LIBRES_DEPART + SACS[1][1]
                if j == 1:
                    journal.append((jour, "sac de 6, chaque joueur"))
            if outils[j] < NB_OUTILS and bourse[j] >= OUTILS_AMELIORES:
                bourse[j] -= OUTILS_AMELIORES
                outils[j] += 1
                if j == 1 and outils[j] == NB_OUTILS:
                    journal.append((jour, "3 outils améliorés, chaque joueur"))
            if sac[j] == 2 and outils[j] == NB_OUTILS and bourse[j] >= SACS[2][0]:
                bourse[j] -= SACS[2][0]
                sac[j], cases[j] = 3, CASES_LIBRES_DEPART + SACS[2][1]
                if j == 1:
                    journal.append((jour, "sac de 10, chaque joueur"))
        if etape < len(MAISON) and coffre >= MAISON[etape][1]:
            coffre -= MAISON[etape][1]
            journal.append((jour, "maison: " + MAISON[etape][0]))
            etape += 1
    return journal


def main() -> None:
    rng = random.Random(20261110)
    print("== Besoins: part du temps éveillé par palier (60 journées de jeu) ==")
    for nom, p in PROFILS.items():
        r = simule_besoins(p, 60, rng)
        print(f"\nProfil {nom}: {r['repas']:.1f} plats simples, {r['toilettes']:.1f} toilettes, "
              f"{r['siestes']:.1f} siestes par journée; les trois besoins au-dessus de 50: {100 * r['forme']:.0f} % du temps")
        for k, t in r["temps"].items():
            ligne = ", ".join(f"{e} {100 * v / r['eveil']:.0f} %" for e, v in t.items())
            print(f"  {k:8s}: {ligne}")
    print("\nRepères sans rien faire: faim à 0 en "
          f"{100 / FAIM_MIN:.0f} min au repos; sommeil à 20 en {80 / SOMMEIL_MIN:.0f} min, à 0 en {100 / SOMMEIL_MIN:.0f} min; "
          f"hygiène à 20 en {80 / HYGIENE_MIN:.0f} min sans geste salissant.")
    print(f"Sommeil après une journée de {JOUR:.0f} min: {100 - SOMMEIL_MIN * JOUR:.0f}; "
          f"après un jour et une nuit blanche ({JOUR + NUIT:.0f} min): {100 - SOMMEIL_MIN * (JOUR + NUIT):.0f}.")

    print("\n== Économie: revenu d'un joueur (sous par minute de récolte, puis par journée à 40 % de récolte) ==")
    for cases, vitesse, nom in [(2, 1.0, "sans sac, outils de base"), (6, 1.0, "besace de 4"),
                                (8, 1.0, "sac de 6"), (8, 1.5, "sac de 6, outils améliorés"),
                                (12, 1.5, "sac de 10, outils améliorés")]:
        r = revenu_minute(cases, vitesse)
        print(f"  {nom:30s}: {r:5.1f} sous/min, {r * JOUR * 0.4:4.0f} sous/journée")
    print("\n== Économie: jour de jeu où le duo s'offre chaque palier ==")
    for nom, part, commune in [("duo tranquille (25 % de récolte)", 0.25, 0.5),
                               ("duo médian (40 %)", 0.40, 0.5),
                               ("duo appliqué (55 %)", 0.55, 0.5)]:
        print(f"\n{nom}, moitié des gains versée au coffre commun:")
        for jour, quoi in simule_economie(part, commune):
            print(f"  jour {jour:3d}: {quoi}")


if __name__ == "__main__":
    main()
