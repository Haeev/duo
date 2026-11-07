#!/usr/bin/env python3
"""Cosy Café (titre de travail): flux de clients, service à deux, économie et progression.

Conception: `docs/jeux/cosy-cafe/cahier-des-charges.md` (section 4). Les tables de ce script sont
celles du cahier: `--tableaux` les imprime en Markdown, `--croise` relit le cahier et signale tout
écart (code de sortie 1). Elles deviendront les fichiers de configuration typés du jeu.

Ce que le script mesure:
1. l'attrait de la carte et le flux de clients par heure et par profil, selon le jour, la météo, la
   saison et la réputation (exemple chiffré de la règle AT-07);
2. le service d'une journée, client par client (simulation à événements discrets): deux joueurs à
   la main, puis avec des machines, puis avec des employés; attente, clients repartis, satisfaction,
   charge des postes, nombre de personnes présentes à la fois (plafond provisoire de 40);
3. l'économie d'une journée par adresse (recettes, matières, loyer, salaires, charges, pourboires);
4. la progression de duos lents, médians et rapides (Monte-Carlo): jour et heures de jeu à chaque
   adresse et jusqu'à la fête de la maison, épargne, condition qui bloque chaque départ;
5. l'écart entre le modèle rapide de la progression (file par heure) et la simulation client par
   client, qui justifie le premier.

Lancement, depuis la racine du dépôt (bibliothèque standard, Python 3.10 ou plus):
  python3 -I docs/jeux/cosy-cafe/simulations/cosy_cafe.py                 résumé
  python3 -I docs/jeux/cosy-cafe/simulations/cosy_cafe.py --tableaux      tables du cahier
  python3 -I docs/jeux/cosy-cafe/simulations/cosy_cafe.py --resultats docs/jeux/cosy-cafe/simulations/resultats.md
  python3 -I docs/jeux/cosy-cafe/simulations/cosy_cafe.py --croise docs/jeux/cosy-cafe/cahier-des-charges.md

Unités: une minute de jeu dure `secondesParMinute` secondes réelles (1 par défaut). Les gestes sont
en secondes réelles; séjours et horaires en minutes et heures de jeu; argent en euros.
"""
from __future__ import annotations

import argparse
import heapq
import math
import random
import re
import statistics
import sys
import time
from collections import deque
from dataclasses import dataclass, field

# ---------------------------------------------------------------------------
# Mise en forme à la française
# ---------------------------------------------------------------------------


def fr(x: float, d: int = 0) -> str:
    """Nombre à la française: virgule décimale, espace entre les milliers."""
    if d == 0:
        x = round(x)
    s = f"{x:,.{d}f}".replace(",", " ").replace(".", ",")
    if s.startswith("-") and float(s[1:].replace(" ", "").replace(",", ".") or 0) == 0:
        s = s[1:]
    return s


def eur(x: float, d: int = 2) -> str:
    return fr(x, d) + " €"


def pct(x: float, d: int = 0) -> str:
    return fr(100 * x, d) + " %"


def heure(h: float) -> str:
    hh = int(h)
    mm = int(round((h - hh) * 60))
    return f"{hh} h" if mm == 0 else f"{hh} h {mm:02d}"


def mult(x: float) -> str:
    return "x" + fr(x, 2).rstrip("0").rstrip(",")


# ---------------------------------------------------------------------------
# 1. Réglages généraux (cahier, section 4.19, « Temps, séance, mémoire »)
# ---------------------------------------------------------------------------

# (clé, libellé, valeur, unité, plage, raison)
REGLAGES: list[tuple[str, str, float, str, str, str]] = [
    ("secondesParMinute", "Durée d'une minute de jeu", 1.0, "s réelle", "0,8 à 1,25",
     "une heure de jeu = une minute réelle: le service du village dure 10 min, celui de Paris 13 min"),
    ("rythmePaisible", "Rythme paisible (réglage du duo)", 1.25, "s par minute de jeu", "1,0 à 1,5",
     "25 % de temps réel en plus par heure de jeu: le même flux, moins serré"),
    ("joursParSaison", "Jours par saison", 28, "jours", "21 à 35",
     "quatre semaines, chaque saison commence un lundi (jour de fermeture)"),
    ("joursParSemaine", "Jours ouverts par semaine", 6, "jours", "fixe",
     "fermé le lundi: travaux, brocante, visite des autres cafés"),
    ("fermetureDouce", "Fermeture douce", 15, "min de jeu", "0 à 30",
     "après l'heure de fermeture, les clients installés finissent tranquillement"),
    ("seuilAbsenceService", "Seuil d'absence pendant le service", 60, "s réelles sans entrée", "30 à 180",
     "en plein service, une minute sans rien toucher n'arrive que si l'on s'est levé"),
    ("seuilAbsenceCalme", "Seuil d'absence hors service", 180, "s réelles sans entrée", "60 à 600",
     "horloge déjà arrêtée: seul l'indicateur « absent » change"),
    ("sauvegardeService", "Sauvegarde automatique pendant le service", 120, "s réelles", "60 à 300",
     "au plus deux minutes rejouées si l'hôte s'arrête net"),
    ("decompteReprise", "Décompte à la reprise d'un service", 3, "s réelles", "0 à 5",
     "le temps de reprendre la souris avant que les clients ne bougent"),
    ("reserveCharges", "Réserve pour les charges", 2, "jours de charges fixes", "0 à 5",
     "un achat ne peut entamer ce qu'il faut pour payer loyer, salaires et charges"),
    ("partSuccursale", "Résultat d'une succursale", 0.45, "part de vos sept dernières journées", "0,3 à 0,6",
     "sans vous, le café tourne bien mais moins bien: y revenir reste utile"),
    ("partEpargne", "Épargne conseillée après une offre", 0.6, "part du résultat du jour", "0,4 à 0,8",
     "la tablette propose de mettre de côté pour le déménagement (simulation: duo médian)"),
]
REG: dict[str, float] = {cle: valeur for cle, _, valeur, _, _, _ in REGLAGES}

JOURS = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"]
SAISONS = ["printemps", "été", "automne", "hiver"]

# ---------------------------------------------------------------------------
# 2. Adresses (cahier, section 4.19, « Adresses »; plans et éléments fixes: adresses.md)
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class Adresse:
    id: str
    nom: str
    surface: int
    ouverture: float
    fermeture: float
    indice_prix: float
    indice_cout: float
    loyer_mois: int
    charges_jour: int
    installation: int
    renommee_offre: int
    tasses_defi: float
    tasses_depart: float
    lignes_ardoise: int
    marche: tuple[str, ...]
    places_depart: tuple[int, int, int, int]  # comptoir, tables, confort, terrasse
    places_plan: tuple[int, int, int, int]  # le plan avant extensions, meublé au mieux
    vaisselle: int
    marche_table: float  # secondes de marche moyenne vers une table et retour
    marche_plonge: float
    pas_ambiance: int  # euros pour +10 d'ambiance (premier palier)
    debout: int  # personnes debout au comptoir
    presents_max: int  # personnages présents au plus (plafond C2 de technique.md), personnel compris


ADRESSES: list[Adresse] = [
    Adresse("village", "Ormeval, le café de la place du Tilleul", 38, 8.0, 18.0, 1.00, 1.00, 520, 8, 0,
            0, 3.0, 1.5, 8, (), (0, 8, 0, 2), (0, 8, 0, 2), 36, 2.0, 1.5, 250, 3, 24),
    Adresse("bourg", "Mérelles, la boutique de la place de la Halle", 81, 7.5, 19.0, 1.10, 1.00, 1150, 16, 2400,
            900, 3.5, 2.0, 12, ("jeudi",), (0, 12, 0, 0), (0, 13, 0, 0), 70, 2.6, 2.0, 600, 4, 48),
    Adresse("ville", "L'atelier", 140, 8.0, 20.0, 1.25, 1.05, 2900, 34, 9000,
            3200, 4.0, 2.0, 16, ("samedi",), (4, 16, 4, 0), (4, 18, 6, 0), 120, 3.2, 2.4, 1400, 6, 72),
    Adresse("paris-quartier", "Le café d'angle", 92, 7.5, 20.5, 1.60, 1.15, 6500, 60, 26000,
            8500, 4.5, 2.5, 16, ("mardi", "vendredi"), (6, 14, 2, 8), (8, 16, 4, 10), 160, 2.8, 2.2, 2400, 8, 80),
    Adresse("paris-maison", "La maison du boulevard", 310, 8.0, 21.0, 1.75, 1.15, 15000, 140, 65000,
            19000, 4.5, 3.0, 20, ("dimanche",), (8, 20, 6, 12), (8, 24, 8, 16), 260, 3.6, 2.6, 6000, 8, 120),
]
ADR: dict[str, Adresse] = {a.id: a for a in ADRESSES}
ORDRE_ADRESSES = [a.id for a in ADRESSES]

# Extensions: (adresse, identifiant, nom, coût, places ajoutées (comptoir, tables, confort, terrasse),
#              ambiance ajoutée, raison)
EXTENSIONS: list[tuple[str, str, str, int, tuple[int, int, int, int], int, str]] = [
    ("village", "village_terrasse", "E1, la terrasse sous le store", 600, (0, 0, 0, 4), 3,
     "autorisation de la mairie et deux tables sous le store: la place du Tilleul est la richesse du village"),
    ("village", "village_fond", "E2, la pièce du fond, au coin du feu", 1100, (0, 2, 2, 0), 4,
     "la pièce fermée derrière la salle, rouverte avec sa cheminée"),
    ("bourg", "bourg_terrasse", "E1, la terrasse de la halle", 1500, (0, 0, 0, 10), 3,
     "sous le store, face à la halle: le jeudi, le marché passe devant"),
    ("bourg", "bourg_remise", "E2, la salle de la remise", 2600, (0, 8, 0, 0), 5,
     "la remise débarrassée, avec sa grande table de ferme"),
    ("bourg", "bourg_cour", "E3, la cour sous la treille", 1800, (0, 0, 0, 8), 4,
     "la cour derrière la boutique, à l'ombre de la treille"),
    ("ville", "ville_salle2", "E1, la deuxième salle", 6500, (0, 8, 4, 0), 5,
     "l'ancien atelier au fond de la cour"),
    ("ville", "ville_cour", "E2, la cour pavée", 3800, (0, 0, 0, 12), 4,
     "la cour de l'atelier, à l'abri de la rue"),
    ("paris-quartier", "pq_trottoir", "E1, la terrasse sur le trottoir", 7000, (0, 0, 0, 10), 3,
     "l'angle donne sur deux rues: la mairie d'arrondissement autorise la seconde"),
    ("paris-quartier", "pq_mezzanine", "E2, la mezzanine", 14000, (0, 6, 2, 0), 5,
     "un plancher sous la grande hauteur du café d'angle (second niveau, C17)"),
    ("paris-maison", "pm_verriere", "E1, la verrière restaurée", 32000, (0, 12, 6, 0), 8,
     "la grande salle sous la verrière, fermée depuis des années"),
    ("paris-maison", "pm_etage", "E2, l'étage", 42000, (0, 12, 4, 0), 6,
     "le salon du premier étage, ouvert par l'escalier de la maison"),
]

# ---------------------------------------------------------------------------
# 3. Profils de clients (cahier, section 4.3 et 6.3)
# ---------------------------------------------------------------------------

BOISSONS = ("noir", "lait", "the", "chocolat", "frais", "specialite")
NOURRITURES = ("viennoiserie", "patisserie", "sale")


@dataclass(frozen=True)
class Profil:
    id: str
    nom: str
    principal: str
    secondaires: tuple[str, ...]
    sensibilite: float  # sensibilité au prix
    place: str  # comptoir, table, confort, terrasse
    emporter: float  # part qui emporte (avec des gobelets)
    styles: tuple[str, str]
    equipements: tuple[str, ...]
    patience: int  # s réelles dans la file ou avant qu'on prenne la commande
    confort: int  # s réelles d'attente sans effet sur la satisfaction (de l'arrivée au service)
    sejour: tuple[int, int]  # minutes de jeu, assis, après le service
    tailles: tuple[tuple[int, float], ...]
    p_nourriture: float
    recommande: tuple[int, float]  # intervalle (min de jeu), probabilité; (0, 0) sinon
    pourboire: float
    cherche: str  # ce que le profil cherche, en une phrase (cahier)


PROFILS: list[Profil] = [
    Profil("presses", "Les pressés", "noir", ("viennoiserie", "lait"), 1.2, "comptoir", 0.5,
           ("bistrot", "atelier"), ("mange_debout", "gobelets"), 35, 30, (5, 10), ((1, 1.0),), 0.4, (0, 0), 0.6,
           "un bon café, vite, au comptoir ou à emporter"),
    Profil("voisins", "Les voisins", "noir", ("viennoiserie", "the"), 1.3, "comptoir", 0.0,
           ("bistrot", "campagne"), ("tabourets", "journal"), 120, 90, (20, 35), ((1, 0.85), (2, 0.15)), 0.3,
           (20, 0.3), 0.8, "deux mots avec vous et un petit noir au comptoir"),
    Profil("flaneurs", "Les flâneurs", "lait", ("the", "patisserie", "viennoiserie"), 0.8, "confort", 0.0,
           ("retro", "bistrot"), ("livres", "fauteuils"), 90, 90, (70, 130), ((1, 0.6), (2, 0.4)), 0.5,
           (50, 0.5), 1.0, "prendre le temps: un crème, un fauteuil, un livre, la rue qui passe"),
    Profil("familles", "Les familles", "chocolat", ("frais", "patisserie", "viennoiserie"), 1.1, "table", 0.0,
           ("campagne", "jardin"), ("chaise_haute", "coin_enfants"), 60, 75, (40, 60),
           ((2, 0.25), (3, 0.45), (4, 0.30)), 0.8, (0, 0), 0.9,
           "un goûter tous ensemble, une grande table, de quoi occuper les enfants"),
    Profil("gourmands", "Les gourmands", "patisserie", ("chocolat", "lait", "viennoiserie"), 0.7, "table", 0.1,
           ("retro", "campagne"), ("vitrine",), 70, 90, (35, 55), ((1, 0.4), (2, 0.6)), 1.0, (0, 0), 1.1,
           "une belle part de gâteau, choisie dans une vitrine qui donne envie"),
    Profil("promeneurs", "Les promeneurs", "frais", ("sale", "viennoiserie", "noir"), 1.0, "terrasse", 0.15,
           ("jardin", "bistrot"), ("range_velos", "ardoise_traduite"), 60, 75, (30, 50),
           ((1, 0.2), (2, 0.5), (3, 0.3)), 0.6, (0, 0), 0.9,
           "une pause en chemin: à boire frais, à manger, une terrasse au soleil"),
    Profil("etudiants", "Les étudiants", "lait", ("frais", "sale", "viennoiserie"), 1.6, "table", 0.1,
           ("atelier", "nordique"), ("wifi", "prises", "grande_table"), 80, 90, (100, 200),
           ((1, 0.4), (2, 0.35), (3, 0.25)), 0.5, (70, 0.5), 0.5,
           "un prix doux, une grande table, du wifi et des prises pour réviser longtemps"),
    Profil("teletravail", "Les télétravailleurs", "the", ("lait", "sale", "patisserie"), 0.9, "table", 0.0,
           ("nordique", "atelier"), ("wifi", "prises"), 90, 100, (150, 270), ((1, 1.0),), 0.4, (75, 0.7), 0.8,
           "une table au calme près d'une prise, une théière qui dure, un déjeuner sur place"),
    Profil("brunch", "Les bruncheurs", "brunch", ("frais", "lait", "sale"), 0.8, "table", 0.0,
           ("jardin", "nordique"), ("grande_table",), 90, 150, (70, 110), ((2, 0.5), (3, 0.2), (4, 0.3)), 0.0,
           (0, 0), 1.1, "le grand repas du week-end, à plusieurs, sans se presser"),
    Profil("connaisseurs", "Les connaisseurs", "specialite", ("noir", "patisserie"), 0.5, "comptoir", 0.1,
           ("atelier", "nordique"), ("moulin_specialite",), 60, 120, (25, 45), ((1, 0.7), (2, 0.3)), 0.3,
           (0, 0), 1.2, "un café d'exception et le plaisir de voir le geste du barista"),
]
PROF: dict[str, Profil] = {p.id: p for p in PROFILS}
ORDRE_PROFILS = [p.id for p in PROFILS]

# Passants intéressés par jour (groupes), à attrait 1, par adresse; jour ordinaire, temps couvert.
FLUX_BASE: dict[str, dict[str, float]] = {
    "village": {"presses": 6, "voisins": 7, "flaneurs": 5, "familles": 3, "gourmands": 4,
                "promeneurs": 4, "etudiants": 0, "teletravail": 1.5, "brunch": 0, "connaisseurs": 1},
    "bourg": {"presses": 10, "voisins": 7, "flaneurs": 6, "familles": 4.5, "gourmands": 5,
              "promeneurs": 4, "etudiants": 2, "teletravail": 2, "brunch": 0, "connaisseurs": 1},
    "ville": {"presses": 15, "voisins": 6, "flaneurs": 8, "familles": 6, "gourmands": 8,
              "promeneurs": 5, "etudiants": 18, "teletravail": 8, "brunch": 4, "connaisseurs": 5},
    "paris-quartier": {"presses": 30, "voisins": 10, "flaneurs": 15, "familles": 7, "gourmands": 13,
                       "promeneurs": 15, "etudiants": 8, "teletravail": 14, "brunch": 8, "connaisseurs": 10},
    "paris-maison": {"presses": 30, "voisins": 8, "flaneurs": 18, "familles": 8, "gourmands": 16,
                     "promeneurs": 18, "etudiants": 8, "teletravail": 16, "brunch": 10, "connaisseurs": 16},
}

# Poids horaires (heure de jeu entière: poids), normalisés sur les heures d'ouverture de l'adresse.
COURBES: dict[str, dict[int, float]] = {
    "presses": {7: 1.6, 8: 2.0, 9: 1.2, 10: 0.5, 11: 0.4, 12: 0.8, 13: 0.8, 14: 0.4, 15: 0.3, 16: 0.4,
                17: 0.6, 18: 0.6, 19: 0.3, 20: 0.1},
    "voisins": {7: 1.0, 8: 1.4, 9: 1.2, 10: 1.0, 11: 0.8, 12: 0.4, 13: 0.4, 14: 0.5, 15: 0.6, 16: 0.7,
                17: 1.0, 18: 0.9, 19: 0.4, 20: 0.1},
    "flaneurs": {7: 0.1, 8: 0.4, 9: 0.9, 10: 1.3, 11: 1.2, 12: 0.6, 13: 0.6, 14: 1.0, 15: 1.3, 16: 1.2,
                 17: 0.9, 18: 0.6, 19: 0.4, 20: 0.2},
    "familles": {8: 0.2, 9: 0.3, 10: 0.6, 11: 0.6, 12: 0.3, 13: 0.3, 14: 0.6, 15: 0.9, 16: 1.8, 17: 1.6,
                 18: 0.6, 19: 0.2},
    "gourmands": {9: 0.3, 10: 0.7, 11: 0.6, 12: 0.3, 13: 0.4, 14: 0.8, 15: 1.4, 16: 1.8, 17: 1.4, 18: 0.6,
                  19: 0.3, 20: 0.2},
    "promeneurs": {8: 0.2, 9: 0.5, 10: 1.0, 11: 1.3, 12: 1.2, 13: 1.0, 14: 1.1, 15: 1.3, 16: 1.2, 17: 0.8,
                   18: 0.4, 19: 0.2},
    "etudiants": {8: 0.3, 9: 0.6, 10: 0.9, 11: 0.9, 12: 1.2, 13: 1.0, 14: 1.3, 15: 1.4, 16: 1.4, 17: 1.2,
                  18: 1.0, 19: 0.7, 20: 0.4},
    "teletravail": {8: 0.4, 9: 1.4, 10: 1.6, 11: 1.0, 12: 0.6, 13: 1.0, 14: 1.4, 15: 1.0, 16: 0.6, 17: 0.3},
    "brunch": {9: 0.4, 10: 1.4, 11: 2.0, 12: 2.0, 13: 1.4, 14: 0.6},
    "connaisseurs": {7: 0.5, 8: 1.3, 9: 1.4, 10: 1.1, 11: 0.8, 12: 0.4, 13: 0.5, 14: 1.0, 15: 1.1, 16: 0.9,
                     17: 0.5, 18: 0.3},
}

# Multiplicateurs par jour (mardi à dimanche; le lundi est fermé) et pour le jour de marché.
JOUR_MULT: dict[str, tuple[float, float, float, float, float, float, float]] = {
    #               mar  mer  jeu  ven  sam  dim  marché
    "presses": (1.0, 1.0, 1.0, 1.0, 0.5, 0.3, 1.0),
    "voisins": (1.0, 1.0, 1.0, 1.0, 1.0, 1.1, 1.3),
    "flaneurs": (1.0, 1.0, 1.0, 1.0, 1.2, 1.3, 1.3),
    "familles": (0.8, 1.6, 0.8, 0.8, 1.5, 1.7, 1.1),
    "gourmands": (0.9, 0.9, 0.9, 0.9, 1.3, 1.5, 1.1),
    "promeneurs": (0.7, 0.7, 0.7, 0.7, 1.5, 1.8, 1.2),
    "etudiants": (1.15, 1.15, 1.15, 1.15, 0.6, 0.4, 1.0),
    "teletravail": (1.2, 1.2, 1.2, 1.2, 0.2, 0.1, 1.0),
    "brunch": (0.0, 0.0, 0.0, 0.0, 1.8, 2.2, 1.0),
    "connaisseurs": (1.0, 1.0, 1.0, 1.0, 1.2, 1.0, 1.0),
}

METEOS = ["soleil", "couvert", "pluie", "chaleur", "froid", "neige"]
# Probabilités par saison (printemps, été, automne, hiver).
METEO_PROBA: dict[str, tuple[float, float, float, float]] = {
    "soleil": (0.40, 0.55, 0.25, 0.20),
    "couvert": (0.35, 0.20, 0.40, 0.35),
    "pluie": (0.25, 0.10, 0.35, 0.25),
    "chaleur": (0.00, 0.15, 0.00, 0.00),
    "froid": (0.00, 0.00, 0.00, 0.15),
    "neige": (0.00, 0.00, 0.00, 0.05),
}
# Multiplicateurs par météo (soleil, couvert, pluie, chaleur, froid, neige).
METEO_MULT: dict[str, tuple[float, float, float, float, float, float]] = {
    "presses": (1.0, 1.0, 1.05, 1.0, 1.0, 0.9),
    "voisins": (1.0, 1.0, 0.9, 1.0, 1.0, 0.8),
    "flaneurs": (1.1, 1.0, 1.15, 0.9, 1.1, 1.0),
    "familles": (1.1, 1.0, 0.8, 1.0, 0.9, 0.9),
    "gourmands": (1.0, 1.0, 1.1, 0.8, 1.15, 1.2),
    "promeneurs": (1.4, 1.0, 0.35, 1.1, 0.6, 0.4),
    "etudiants": (1.0, 1.0, 1.1, 1.0, 1.0, 1.0),
    "teletravail": (1.0, 1.0, 1.1, 1.0, 1.0, 1.0),
    "brunch": (1.2, 1.0, 0.8, 1.1, 0.9, 0.9),
    "connaisseurs": (1.0, 1.0, 1.0, 1.0, 1.0, 1.0),
}
# Multiplicateurs par saison (printemps, été, automne, hiver).
SAISON_MULT: dict[str, tuple[float, float, float, float]] = {
    "presses": (1.0, 0.9, 1.0, 1.0),
    "voisins": (1.0, 1.0, 1.0, 1.0),
    "flaneurs": (1.0, 1.1, 1.0, 1.0),
    "familles": (1.0, 1.2, 1.0, 0.9),
    "gourmands": (1.0, 0.9, 1.0, 1.2),
    "promeneurs": (1.1, 1.5, 0.9, 0.5),
    "etudiants": (1.0, 0.35, 1.3, 1.1),
    "teletravail": (1.0, 0.8, 1.0, 1.0),
    "brunch": (1.0, 1.1, 1.0, 0.9),
    "connaisseurs": (1.0, 1.0, 1.0, 1.0),
}
TERRASSE_OUVERTE = {"soleil": True, "couvert": True, "pluie": False, "chaleur": True, "froid": False,
                    "neige": False}

# ---------------------------------------------------------------------------
# 4. Attrait (cahier, section 4.3)
# ---------------------------------------------------------------------------

POINTS_CARTE = {"principal": 3, "secondaire": 1, "variete": 1}  # variété: 3 recettes du principal
FACTEUR_CARTE = [0.0, 0.35, 0.55, 0.75, 0.9, 1.0, 1.1, 1.2]  # indice: points (7 et plus: 1,2)
FACTEUR_TASSES = {1.0: 0.55, 1.5: 0.65, 2.0: 0.75, 2.5: 0.85, 3.0: 0.95, 3.5: 1.05, 4.0: 1.15,
                  4.5: 1.25, 5.0: 1.35}
LIEU = {"base": 0.75, "ambiance": 0.25, "style50": 0.10, "style75": 0.15, "equipement": 0.08,
        "equipementsMax": 2}
PRIX_BORNES = (0.4, 1.25)
HUMEUR = {"pivot": 70, "pente": 0.01, "borne": 0.10}
# Un groupe qui entre estime l'attente: 25 s par groupe qui attend déjà (file, groupes assis sans
# commande, commandes en cours), divisées par le nombre de personnes qui servent.
CLIENTS = {"secondesParGroupe": 25, "file": 6}

# ---------------------------------------------------------------------------
# 5. Satisfaction, réputation, renommée (cahier, section 4.12)
# ---------------------------------------------------------------------------

SATISFACTION = {
    "base": 70,
    "parSeconde": -0.5,  # au-delà de l'attente confortable du profil
    "attenteMax": -30,
    "parfait": 10, "bien": 4, "correct": -4,
    "dessin": 4,
    "faitMaison": 3,
    "prixPente": 40, "prixBorne": 12,
    "placeVoulue": 5, "autrePlace": 0, "debout": -10, "tableSale": -6,
    "ambianceDiviseur": 5,  # (ambiance - 50) / 5, de -10 à +10
    "conversation": 12,  # voisins et habitués à qui l'on a parlé
    "commeDHabitude": 10,
}
# Points de réputation d'un groupe servi: max(0, (satisfaction - 50) / 10).
REPUTATION_PIVOT = 50
REPUTATION_DIVISEUR = 10
# Points cumulés dans un café pour chaque demi-tasse au-dessus de la réputation de départ, par adresse.
# Le seuil de la demi-tasse k (k = 1, 2...) vaut pas * k * (k + 1) / 2: chaque palier un peu plus long.
REPUTATION_PAS: dict[str, int] = {"village": 22, "bourg": 40, "ville": 70, "paris-quartier": 85,
                                  "paris-maison": 120}
RENOMMEE_PAR_POINT = 1  # la renommée de la maison est la somme des points de tous ses cafés
RENOMMEE_DEFI = {"village": 150, "bourg": 300, "ville": 600, "paris-quartier": 1000}
# Prix en salle (service à table, dès le bourg): +20 % sur le prix au comptoir, à la française.
PRIX_SALLE = 1.20
POURBOIRE = {"seuil": 80, "taux": 0.08, "tauxRavi": 0.14, "seuilRavi": 90, "probabilite": 0.6}
LIVRE_DOR = {"ravi": 85, "pRavi": 0.12, "decu": 45, "pDecu": 0.10, "habitue": 0.35}

# ---------------------------------------------------------------------------
# 6. Postes, gestes et recettes (cahier, sections 4.5 et 6.1)
# ---------------------------------------------------------------------------

# Places simultanées par niveau d'équipement (1 à la main, 2 machine, 3 machine avancée).
POSTES: dict[str, tuple[str, tuple[int, int, int], str]] = {
    "caisse": ("Comptoir et caisse", (1, 1, 2), "un terminal, deux à Paris"),
    "espresso": ("Machine à espresso", (2, 2, 3), "deux groupes (la vieille machine de Simone), trois ensuite"),
    "vapeur": ("Buse vapeur", (1, 2, 2), "une buse par machine, deux dès la machine à deux groupes"),
    "bouilloire": ("Eau chaude et thés", (1, 2, 2), "bouilloire, puis bouilloire à température"),
    "vitrine": ("Vitrine", (2, 2, 3), "deux personnes s'y servent à la fois"),
    "agrumes": ("Presse-agrumes", (1, 1, 2), "à levier, puis électrique"),
    "blender": ("Blender", (1, 2, 2), ""),
    "creperie": ("Crêpière", (1, 2, 2), "une plaque, puis deux"),
    "gaufrier": ("Gaufrier", (1, 2, 2), ""),
    "plan": ("Plan de travail", (1, 2, 3), "chaque place est un mètre de plan"),
    "four": ("Four", (6, 12, 24), "pièces à la fois"),
    "douce": ("Bar à méthodes douces", (2, 3, 4), "cônes"),
    "frigo": ("Réfrigérateur du bar", (2, 2, 3), "bouteilles et carafes"),
}
POSTES_BAR = {"espresso", "vapeur", "bouilloire", "agrumes", "blender", "douce", "frigo"}
POSTES_CUISINE = {"plan", "four", "creperie", "gaufrier", "vitrine"}


@dataclass(frozen=True)
class Etape:
    poste: str
    actif: tuple[float, float, float]
    passif: tuple[float, float, float] = (0.0, 0.0, 0.0)
    fin: tuple[float, float, float] = (0.0, 0.0, 0.0)


def E(poste: str, a: tuple[float, ...], p: tuple[float, ...] = (0, 0, 0), f: tuple[float, ...] = (0, 0, 0)) -> Etape:
    def t3(x: tuple[float, ...]) -> tuple[float, float, float]:
        return (float(x[0]), float(x[1 if len(x) > 1 else 0]), float(x[2 if len(x) > 2 else -1]))
    return Etape(poste, t3(a), t3(p), t3(f))


SHOT = E("espresso", (3.5, 2.0, 1.5), (12, 12, 12), (0.5, 0.5, 0))
SHOT_LONG = E("espresso", (4.0, 2.5, 2.0), (14, 14, 14), (0.5, 0.5, 0))


@dataclass(frozen=True)
class Recette:
    id: str
    nom: str
    famille: str
    etapes: tuple[Etape, ...]
    sequentiel: bool
    prix: float  # prix conseillé au village, en euros
    cout: float  # matières, en euros (achetée toute faite quand `cout_maison` existe et sans four)
    cout_maison: float  # 0 si sans objet
    vaisselle: int
    adresse: str  # première adresse où on peut l'apprendre
    deblocage: str
    saison: str  # "" ou une saison


RECETTES: list[Recette] = [
    # Cafés noirs
    Recette("espresso", "Espresso (petit noir)", "noir", (SHOT,), False, 1.40, 0.22, 0, 1, "village", "départ", ""),
    Recette("allonge", "Café allongé", "noir", (SHOT_LONG,), False, 1.60, 0.24, 0, 1, "village", "départ", ""),
    Recette("noisette", "Noisette", "noir", (SHOT, E("vapeur", (2.0, 1.5, 1.0), (0, 0, 2))), False,
            1.70, 0.27, 0, 1, "village", "Simone, jour 2", ""),
    Recette("double", "Double espresso", "noir", (SHOT_LONG,), False, 2.50, 0.40, 0, 1, "bourg", "fiche, 40 €", ""),
    # Cafés au lait
    Recette("creme", "Café crème", "lait", (SHOT, E("vapeur", (5.0, 4.0, 1.0), (0, 0, 5))), False,
            2.40, 0.38, 0, 1, "village", "départ", ""),
    Recette("cappuccino", "Cappuccino", "lait", (SHOT, E("vapeur", (6.0, 5.0, 1.0), (0, 0, 6))), False,
            2.90, 0.42, 0, 1, "village", "fiche, 30 €", ""),
    Recette("viennois", "Café viennois", "lait", (SHOT, E("plan", (2.5, 2.0, 1.5))), False,
            3.20, 0.55, 0, 1, "bourg", "fiche, 40 €", ""),
    Recette("latte", "Latte", "lait", (SHOT, E("vapeur", (6.5, 5.5, 1.0), (0, 0, 6))), False,
            3.10, 0.48, 0, 1, "ville", "fiche, 50 €", ""),
    Recette("flat_white", "Flat white", "lait", (SHOT_LONG, E("vapeur", (5.0, 4.0, 1.0), (0, 0, 5))), False,
            3.30, 0.50, 0, 1, "ville", "Aïcha, lien 2", ""),
    # Thés et infusions
    Recette("the_noir", "Thé noir", "the", (E("bouilloire", (4.0, 2.5, 2.0)),), False, 2.50, 0.25, 0, 2,
            "village", "départ", ""),
    Recette("the_vert", "Thé vert", "the", (E("bouilloire", (4.5, 2.5, 2.0)),), False, 2.60, 0.28, 0, 2,
            "village", "fiche, 20 €", ""),
    Recette("infusion", "Infusion du jardin de Simone", "the", (E("bouilloire", (4.0, 2.5, 2.0)),), False,
            2.40, 0.18, 0, 2, "village", "Simone, lien 1", ""),
    Recette("chai", "Chaï latte", "the", (E("bouilloire", (2.5, 2.0, 1.5)), E("vapeur", (5.0, 4.0, 1.0), (0, 0, 5))),
            False, 3.40, 0.55, 0, 1, "ville", "Agathe, lien 2", ""),
    Recette("the_glace", "Thé glacé maison", "the", (E("frigo", (2.5, 2.0, 2.0)),), False, 3.00, 0.35, 0, 1,
            "bourg", "découverte de l'été", "été"),
    # Chocolats
    Recette("chocolat", "Chocolat chaud", "chocolat", (E("vapeur", (6.5, 5.5, 1.5), (0, 0, 6)),), False,
            2.80, 0.45, 0, 1, "village", "départ", ""),
    Recette("chocolat_viennois", "Chocolat viennois", "chocolat",
            (E("vapeur", (6.5, 5.5, 1.5), (0, 0, 6)), E("plan", (2.5, 2.0, 1.5))), False,
            3.40, 0.60, 0, 1, "bourg", "fiche, 40 €", ""),
    Recette("chocolat_epices", "Chocolat aux épices", "chocolat", (E("vapeur", (7.0, 6.0, 1.5), (0, 0, 6)),), False,
            3.60, 0.65, 0, 1, "village", "découverte de l'hiver", "hiver"),
    # Boissons fraîches
    Recette("jus_orange", "Jus d'orange pressé", "frais", (E("agrumes", (5.0, 2.5, 2.0)),), False,
            3.50, 1.00, 0, 1, "village", "presse-agrumes", ""),
    Recette("citronnade", "Citronnade maison", "frais", (E("frigo", (2.5, 2.0, 2.0)),), False,
            3.00, 0.40, 0, 1, "village", "Bastien, lien 1", ""),
    Recette("limonade", "Limonade artisanale", "frais", (E("frigo", (1.5, 1.5, 1.5)),), False,
            3.20, 1.20, 0, 1, "village", "réfrigérateur vitré", ""),
    Recette("smoothie", "Smoothie de saison", "frais", (E("blender", (3.0, 2.5, 2.0), (8, 8, 6), (1, 1, 1)),),
            False, 4.20, 1.20, 0, 1, "ville", "blender", ""),
    Recette("milkshake", "Milk-shake", "frais", (E("blender", (3.0, 2.5, 2.0), (8, 8, 6), (1, 1, 1)),), False,
            4.00, 0.90, 0, 1, "ville", "fiche, 50 €", ""),
    Recette("frappe", "Café frappé", "frais", (SHOT, E("blender", (2.0, 1.5, 1.5), (6, 6, 5), (1, 1, 1))), False,
            3.80, 0.60, 0, 1, "ville", "découverte de l'été", "été"),
    # Viennoiseries et tartines
    Recette("croissant", "Croissant", "viennoiserie", (E("vitrine", (1.5, 1.5, 1.2)),), False,
            1.20, 0.70, 0.30, 1, "village", "départ (boulanger), maison dès le four", ""),
    Recette("pain_chocolat", "Pain au chocolat", "viennoiserie", (E("vitrine", (1.5, 1.5, 1.2)),), False,
            1.30, 0.75, 0.32, 1, "village", "départ (boulanger), maison dès le four", ""),
    Recette("tartine", "Tartine beurre-confiture", "viennoiserie", (E("plan", (4.0, 3.0, 2.5)),), False,
            2.20, 0.35, 0, 1, "village", "départ", ""),
    Recette("pain_raisins", "Pain aux raisins", "viennoiserie", (E("vitrine", (1.5, 1.5, 1.2)),), False,
            1.50, 0.38, 0, 1, "bourg", "René, lien 2", ""),
    Recette("chausson", "Chausson aux pommes", "viennoiserie", (E("vitrine", (1.5, 1.5, 1.2)),), False,
            1.60, 0.40, 0, 1, "bourg", "Marion, lien 1", ""),
    # Pâtisseries
    Recette("tarte_fruits", "Tarte aux fruits de saison", "patisserie", (E("vitrine", (2.0, 2.0, 1.5)),), False,
            3.20, 1.60, 0.55, 1, "village", "départ (boulanger), maison dès le four", ""),
    Recette("crepe", "Crêpe", "patisserie", (E("creperie", (3.0, 2.5, 2.0), (9, 8, 7), (1.5, 1.5, 1.5)),), False,
            2.50, 0.25, 0, 1, "village", "crêpière", ""),
    Recette("gaufre", "Gaufre", "patisserie", (E("gaufrier", (1.5, 1.5, 1.2), (10, 9, 8), (1, 1, 1)),), False,
            2.80, 0.30, 0, 1, "bourg", "gaufrier", ""),
    Recette("fondant", "Fondant au chocolat", "patisserie", (E("vitrine", (2.0, 2.0, 1.5)),), False,
            3.50, 0.55, 0, 1, "bourg", "fiche, 40 €", ""),
    Recette("madeleines", "Madeleines", "patisserie", (E("vitrine", (1.5, 1.5, 1.2)),), False,
            2.40, 0.30, 0, 1, "bourg", "Josiane, lien 2", ""),
    Recette("cookie", "Cookie", "patisserie", (E("vitrine", (1.2, 1.2, 1.0)),), False,
            2.20, 0.30, 0, 1, "ville", "Thao, lien 1", ""),
    Recette("cannele", "Cannelé", "patisserie", (E("vitrine", (1.2, 1.2, 1.0)),), False,
            2.20, 0.35, 0, 1, "ville", "fiche, 50 €", ""),
    Recette("eclair", "Éclair au café", "patisserie", (E("vitrine", (1.5, 1.5, 1.2)),), False,
            4.00, 0.70, 0, 1, "paris-quartier", "employé pâtissier", ""),
    Recette("tarte_citron", "Tarte au citron meringuée", "patisserie", (E("vitrine", (2.0, 2.0, 1.5)),), False,
            4.20, 0.75, 0, 1, "paris-quartier", "fiche, 80 €", ""),
    Recette("entremets", "Le gâteau de la maison", "patisserie", (E("vitrine", (2.5, 2.0, 2.0)),), False,
            6.00, 1.20, 0, 1, "paris-maison", "laboratoire de pâtisserie", ""),
    # Salé
    Recette("croque", "Croque-monsieur", "sale", (E("plan", (4.0, 3.0, 2.5)), E("four", (1, 1, 1), (15, 12, 10), (1.5, 1.5, 1))),
            True, 5.50, 1.10, 0, 1, "bourg", "four", ""),
    Recette("quiche", "Part de quiche", "sale", (E("four", (1.5, 1.5, 1.0), (8, 7, 6), (1, 1, 1)),), False,
            5.00, 0.90, 0, 1, "bourg", "fiche, 40 €", ""),
    Recette("soupe", "Soupe du jour", "sale", (E("plan", (3.0, 2.5, 2.0)),), False, 4.50, 0.70, 0, 1,
            "bourg", "découverte de l'hiver", "hiver"),
    Recette("salade", "Salade composée", "sale", (E("plan", (8.0, 7.0, 6.0)),), False, 7.50, 2.00, 0, 1,
            "ville", "découverte de l'été", "été"),
    Recette("tartine_avocat", "Tartine avocat-œuf", "sale", (E("plan", (6.0, 5.0, 4.0)),), False,
            7.00, 1.80, 0, 1, "ville", "fiche, 60 €", ""),
    # Brunch
    Recette("brunch", "Formule brunch", "brunch",
            (E("plan", (6.0, 5.0, 4.0)), E("frigo", (1.5, 1.5, 1.5)), SHOT, E("vapeur", (4.0, 3.0, 1.0), (0, 0, 4))),
            False, 19.00, 5.00, 0, 4, "ville", "arrivée à l'atelier", ""),
    # Café de spécialité
    Recette("filtre", "Café filtre de spécialité", "specialite", (E("douce", (9.0, 6.0, 4.0), (15, 15, 12), (1, 1, 1)),),
            False, 3.80, 0.80, 0, 1, "ville", "Aïcha, lien 1", ""),
    Recette("espresso_origine", "Espresso d'origine", "specialite", (SHOT_LONG,), False, 2.60, 0.50, 0, 1,
            "ville", "bar à méthodes douces", ""),
    Recette("notre_melange", "Notre mélange", "specialite", (SHOT_LONG,), False, 3.00, 0.45, 0, 1,
            "paris-maison", "torréfaction", ""),
]
REC: dict[str, Recette] = {r.id: r for r in RECETTES}
FAMILLES = {
    "noir": "Cafés noirs", "lait": "Cafés au lait", "the": "Thés et infusions", "chocolat": "Chocolats",
    "frais": "Boissons fraîches", "viennoiserie": "Viennoiseries et tartines", "patisserie": "Pâtisseries",
    "sale": "Salé", "brunch": "Brunch", "specialite": "Café de spécialité",
}

# Gestes autour des commandes (secondes réelles, sans la marche).
GESTES = {
    "commandeComptoir": 2.5,  # écouter, le ticket s'imprime, encaisser
    "commandeTable": 2.5,
    "servirComptoir": 1.0,
    "servirTable": 0.8,  # poser, plus 0,4 s par article au-delà du premier
    "servirParArticle": 0.4,
    "plateau": 4,  # articles par plateau
    "debarrasser": 1.5,
    "laverMain": 1.5,  # par pièce, à l'évier
    "laverLot": 4,  # pièces par passage à l'évier
    "chargerLave": 0.3,  # par pièce, lave-vaisselle
    "cycleLave": (0, 45, 25),  # s, par niveau de plonge (1: évier)
    "capaciteLave": (0, 24, 40),
    "viderLave": 4.0,
    "marcheBar": 0.6,
    "parfaitRetard": 2.0,  # au-delà, le geste fini en retard n'est plus parfait
    "correctRetard": 6.0,  # au-delà, il est « correct »
}

# ---------------------------------------------------------------------------
# 7. Joueurs, employés, duos simulés
# ---------------------------------------------------------------------------

EMPLOYES: list[tuple[str, str, int, str, str]] = [
    # rôle, nom, salaire par jour travaillé (hors Paris), postes, raison
    ("salle", "Service en salle", 95, "commandes, service, débarrasser, encaisser", "le rôle le plus demandé dès deux salles"),
    ("barista", "Barista", 105, "machine, buse, thés, presse, blender, méthodes douces", "libère le bar aux heures de pointe"),
    ("commis", "Commis", 85, "plonge, débarrasser, réserve, livraisons, vitrine", "le premier coup de main, le moins cher"),
    ("patisserie", "Pâtisserie", 110, "four, plan, crêpière, gaufrier, fournées", "rend le fait maison possible à grande échelle"),
    ("plonge", "Plonge", 80, "vaisselle et débarrasser", "à partir de deux salles, la vaisselle devient un poste"),
    ("gerance", "Gérance", 130, "tient une succursale", "la personne à qui l'on confie un café"),
]
SALAIRE = {r: s for r, _, s, _, _ in EMPLOYES}
SALAIRE_PARIS = 1.2
VITESSE_EMPLOYE = {1: 0.85, 2: 1.0, 3: 1.1}
JOURS_NIVEAU_EMPLOYE = (0, 10, 30)  # jours travaillés pour les niveaux 1, 2, 3

ROLES_TACHES: dict[str, set[str]] = {
    "joueur": {"finir", "servir", "commande", "prep", "laver", "debarrasser"},
    "salle": {"servir", "commande", "debarrasser"},
    "barista": {"finir", "prep_bar"},
    "commis": {"laver", "debarrasser", "prep_vitrine"},
    "patisserie": {"finir_cuisine", "prep_cuisine"},
    "plonge": {"laver", "debarrasser"},
}


@dataclass(frozen=True)
class Duo:
    id: str
    nom: str
    vitesse: float  # gestes des joueurs
    hesitation: float  # s ajoutées à chaque tâche
    parfait: float  # probabilité d'un geste « parfait » quand il est fait à temps
    preparation: float  # minutes réelles de préparation par journée
    fermeture: float  # minutes réelles de fermeture par journée
    lundi: float  # minutes réelles le jour de fermeture
    epargne: float  # part du résultat mise de côté après une offre
    ambiance_part: float  # part des achats consacrée à l'ambiance
    priorite_capacite: bool  # achète d'abord ce qui fait servir plus
    affluence: float  # réglage du duo choisi (1 normale)


DUOS: list[Duo] = [
    Duo("lent", "Duo tranquille", 0.80, 0.8, 0.20, 6.0, 5.0, 4.0, 0.50, 0.45, False, 1.0),
    Duo("median", "Duo médian", 1.00, 0.3, 0.40, 4.0, 3.5, 2.5, 0.60, 0.35, False, 1.0),
    Duo("rapide", "Duo rapide", 1.20, 0.0, 0.60, 2.5, 2.0, 1.0, 0.70, 0.25, True, 1.0),
]
DUO: dict[str, Duo] = {d.id: d for d in DUOS}

# ---------------------------------------------------------------------------
# 8. Attrait et flux (règles AT-01 à AT-08)
# ---------------------------------------------------------------------------


def familles_de(carte: list[str]) -> dict[str, int]:
    f: dict[str, int] = {}
    for rid in carte:
        fam = REC[rid].famille
        f[fam] = f.get(fam, 0) + 1
    return f


def points_carte(profil: str, familles: dict[str, int]) -> int:
    p = PROF[profil]
    pts = 0
    if familles.get(p.principal, 0) > 0:
        pts += POINTS_CARTE["principal"]
        if familles[p.principal] >= 3:
            pts += POINTS_CARTE["variete"]
    for s in p.secondaires:
        if familles.get(s, 0) > 0:
            pts += POINTS_CARTE["secondaire"]
    return pts


def facteur_carte(points: int) -> float:
    return FACTEUR_CARTE[min(points, len(FACTEUR_CARTE) - 1)]


def facteur_prix(profil: str, indice: float) -> float:
    lo, hi = PRIX_BORNES
    return max(lo, min(hi, 1 - PROF[profil].sensibilite * (indice - 1)))


def facteur_lieu(profil: str, ambiance: float, style: str, coherence: float, equipements: set[str]) -> float:
    p = PROF[profil]
    f = LIEU["base"] + LIEU["ambiance"] * ambiance / 100
    if style in p.styles:
        if coherence >= 0.75:
            f += LIEU["style75"]
        elif coherence >= 0.5:
            f += LIEU["style50"]
    n = len(set(p.equipements) & equipements)
    return f + LIEU["equipement"] * min(n, int(LIEU["equipementsMax"]))


def facteur_tasses(tasses: float) -> float:
    t = max(1.0, min(5.0, math.floor(tasses * 2) / 2))
    return FACTEUR_TASSES[t]


def facteur_humeur(satisfaction_hier: float) -> float:
    b = HUMEUR["borne"]
    return 1 + max(-b, min(b, (satisfaction_hier - HUMEUR["pivot"]) * HUMEUR["pente"]))


def creneaux(adr: Adresse) -> list[tuple[float, float]]:
    """Créneaux d'une heure de jeu depuis l'ouverture: (début, durée en heures)."""
    out = []
    h = adr.ouverture
    while h < adr.fermeture - 1e-9:
        d = min(1.0, adr.fermeture - h)
        out.append((h, d))
        h += d
    return out


def passants_heure(adr: Adresse, profil: str, jour: int, saison: int, meteo: str) -> list[float]:
    """Groupes intéressés attendus dans chaque créneau, à attrait 1. `jour`: 1 = mardi ... 6 = dimanche."""
    base = FLUX_BASE[adr.id][profil]
    if base <= 0:
        return [0.0 for _ in creneaux(adr)]
    courbe = COURBES[profil]
    poids = [courbe.get(int(h), 0.0) * d for h, d in creneaux(adr)]
    total = sum(poids)
    if total <= 0:
        return [0.0 for _ in poids]
    jm = JOUR_MULT[profil][jour - 1]
    if JOURS[jour] in adr.marche:
        jm *= JOUR_MULT[profil][6]
    mm = METEO_MULT[profil][METEOS.index(meteo)]
    sm = SAISON_MULT[profil][saison]
    return [base * w / total * jm * mm * sm for w in poids]


@dataclass
class Etat:
    """Ce qui décide de l'attrait d'un café un jour donné (duo simulé ou configuration d'étude)."""
    carte: list[str]
    indice_prix: float = 1.0
    ambiance: float = 40.0
    style: str = "campagne"
    coherence: float = 0.5
    equipements: set[str] = field(default_factory=set)
    tasses: float = 2.0
    satisfaction_hier: float = 70.0
    affluence: float = 1.0


def attrait(profil: str, e: Etat) -> float:
    fam = familles_de(e.carte)
    return (facteur_carte(points_carte(profil, fam)) * facteur_prix(profil, e.indice_prix)
            * facteur_lieu(profil, e.ambiance, e.style, e.coherence, e.equipements)
            * facteur_tasses(e.tasses) * facteur_humeur(e.satisfaction_hier) * e.affluence)


def demande(adr: Adresse, e: Etat, jour: int, saison: int, meteo: str) -> dict[str, list[float]]:
    return {p: [x * attrait(p, e) for x in passants_heure(adr, p, jour, saison, meteo)] for p in ORDRE_PROFILS}


def tirer_meteo(rng: random.Random, saison: int) -> str:
    u = rng.random()
    acc = 0.0
    for m in METEOS:
        acc += METEO_PROBA[m][saison]
        if u < acc:
            return m
    return "couvert"


def poisson(rng: random.Random, lam: float) -> int:
    if lam <= 0:
        return 0
    if lam > 30:
        return max(0, int(round(rng.gauss(lam, math.sqrt(lam)))))
    l = math.exp(-lam)
    k, p = 0, 1.0
    while True:
        p *= rng.random()
        if p <= l:
            return k
        k += 1


# ---------------------------------------------------------------------------
# 9. Ce que commande un groupe (règle CO-02)
# ---------------------------------------------------------------------------


def tirer_taille(rng: random.Random, profil: str) -> int:
    u = rng.random()
    acc = 0.0
    for t, w in PROF[profil].tailles:
        acc += w
        if u < acc:
            return t
    return PROF[profil].tailles[-1][0]


def choisir_famille(rng: random.Random, profil: str, familles: dict[str, int], parmi: tuple[str, ...]) -> str | None:
    p = PROF[profil]
    choix: list[tuple[str, float]] = []
    for f in parmi:
        if familles.get(f, 0) == 0:
            continue
        if f == p.principal:
            choix.append((f, 3.0))
        elif f in p.secondaires:
            choix.append((f, 1.0))
    if not choix:
        return None
    tot = sum(w for _, w in choix)
    u = rng.random() * tot
    for f, w in choix:
        u -= w
        if u <= 0:
            return f
    return choix[-1][0]


_CACHE_CARTE: dict[tuple[str, ...], tuple[dict[str, int], dict[str, list[str]]]] = {}


def index_carte(carte: list[str]) -> tuple[dict[str, int], dict[str, list[str]]]:
    cle = tuple(carte)
    if cle not in _CACHE_CARTE:
        par_famille: dict[str, list[str]] = {}
        for rid in carte:
            par_famille.setdefault(REC[rid].famille, []).append(rid)
        _CACHE_CARTE[cle] = (familles_de(carte), par_famille)
    return _CACHE_CARTE[cle]


def commande_groupe(rng: random.Random, profil: str, taille: int, carte: list[str]) -> list[str]:
    fam, par_famille = index_carte(carte)
    articles: list[str] = []
    p = PROF[profil]
    for _ in range(taille):
        if profil == "brunch" and fam.get("brunch", 0) and rng.random() < 0.85:
            articles.append(rng.choice(par_famille["brunch"]))
            continue
        f = choisir_famille(rng, profil, fam, BOISSONS)
        if f is None:
            autres = [x for x in BOISSONS if fam.get(x, 0)]
            f = rng.choice(autres) if autres else None
        if f is not None:
            articles.append(rng.choice(par_famille[f]))
        if rng.random() < p.p_nourriture:
            g = choisir_famille(rng, profil, fam, NOURRITURES)
            if g is not None:
                articles.append(rng.choice(par_famille[g]))
    return articles

# ---------------------------------------------------------------------------
# 10. Service client par client (simulation à événements discrets)
# ---------------------------------------------------------------------------

TYPES_PLACES = ("comptoir", "table", "confort", "terrasse")
REPLIS = {
    "comptoir": ("comptoir", "table", "confort", "terrasse"),
    "table": ("table", "confort", "terrasse", "comptoir"),
    "confort": ("confort", "table", "terrasse", "comptoir"),
    "terrasse": ("terrasse", "table", "confort", "comptoir"),
}


@dataclass
class Config:
    adresse: str
    niveaux: dict[str, int]  # poste: niveau 1 à 3 (absent: pas de poste)
    plonge: int  # 1 évier, 2 lave-vaisselle, 3 lave-vaisselle à capot
    service_table: bool
    places: tuple[int, int, int, int]
    vaisselle: int
    employes: list[tuple[str, int]]  # (rôle, niveau)
    etat: Etat
    caisses: int = 1


@dataclass
class Travailleur:
    nom: str
    role: str  # joueur ou rôle d'employé
    vitesse: float
    hesitation: float
    parfait: float
    priorites: tuple[str, ...]
    libre: bool = True
    occupe: float = 0.0


@dataclass
class Groupe:
    gid: int
    profil: str
    taille: int
    t: float
    articles: list[str]
    emporter: bool
    a_table: bool
    etat: str = "arrive"
    place: str = ""
    places_prises: int = 0
    sale_assise: bool = False
    debout: bool = False
    pieces: int = 0
    t_servi: float = -1.0
    qualites: list[str] = field(default_factory=list)
    commandes_ouvertes: int = 0


@dataclass
class Commande:
    groupe: Groupe
    articles: list["Article"]
    prets: int = 0
    premiere: bool = True
    a_table: bool = False


@dataclass
class Article:
    recette: Recette
    commande: Commande
    etapes_faites: int = 0
    vaisselle_prise: bool = False
    qualites: list[str] = field(default_factory=list)


@dataclass
class EtapeEnCours:
    article: Article
    etape: Etape
    rang: int
    t_fin_passif: float = 0.0
    seq: int = 0


PRIO_JOUEUR_SALLE = ("finir", "servir", "commande", "debarrasser_urgent", "laver_urgent", "prep", "laver", "debarrasser")
PRIO_JOUEUR_BAR = ("finir", "prep", "servir", "laver_urgent", "commande", "laver", "debarrasser_urgent", "debarrasser")
PRIO_ROLE = {
    "salle": ("servir", "commande", "debarrasser_urgent", "debarrasser"),
    "barista": ("finir", "prep"),
    "commis": ("laver_urgent", "debarrasser_urgent", "laver", "prep", "debarrasser"),
    "patisserie": ("finir", "prep"),
    "plonge": ("laver_urgent", "debarrasser_urgent", "laver", "debarrasser"),
}


POSTES_ROLE: dict[str, frozenset[str]] = {
    "joueur": frozenset(POSTES),
    "barista": frozenset(POSTES_BAR),
    "patisserie": frozenset({"plan", "four", "creperie", "gaufrier"}),
    "commis": frozenset({"vitrine", "frigo"}),
    "salle": frozenset(),
    "plonge": frozenset(),
}


def peut_poste(role: str, poste: str) -> bool:
    return poste in POSTES_ROLE[role]


class Service:
    """Une journée de service. Temps en secondes réelles depuis l'ouverture."""

    def __init__(self, cfg: Config, duo: Duo, rng: random.Random, jour: int, saison: int, meteo: str,
                 spm: float = 1.0, aide_patience: float = 1.0) -> None:
        self.cfg = cfg
        self.adr = ADR[cfg.adresse]
        self.duo = duo
        self.rng = rng
        self.spm = spm
        self.meteo = meteo
        self.aide_patience = aide_patience
        self.ev: list[tuple[float, int, str, object]] = []
        self.seq = 0
        self.t = 0.0
        self.fin = (self.adr.fermeture - self.adr.ouverture) * 60 * spm
        self.niveaux = cfg.niveaux
        self.cap = {p: POSTES[p][1][n - 1] for p, n in cfg.niveaux.items()}
        self.cap["caisse"] = cfg.caisses
        self.occ = {p: 0 for p in self.cap}
        self.postes_role = {r: tuple(p for p in POSTES if p in self.cap and p in ps) for r, ps in POSTES_ROLE.items()}
        terrasse = cfg.places[3] if TERRASSE_OUVERTE[meteo] else 0
        self.libres = {"comptoir": cfg.places[0], "table": cfg.places[1], "confort": cfg.places[2], "terrasse": terrasse}
        self.sales = {k: 0 for k in TYPES_PLACES}
        self.debout_libre = self.adr.debout
        self.propre = cfg.vaisselle
        self.sale_pile = 0
        self.lave_occupe = False
        self.lave_charge = 0
        self.q_comptoir: deque[Groupe] = deque()
        self.q_porte: deque[Groupe] = deque()
        self.q_table: deque[Commande] = deque()
        self.q_prep: dict[str, deque[EtapeEnCours]] = {p: deque() for p in POSTES}
        self.n_prep = 0
        self.q_finir: deque[EtapeEnCours] = deque()
        self.q_servir: deque[Commande] = deque()
        self.q_debarrasser: deque[tuple[str, int, int]] = deque()  # (type, places, pièces)
        self.q_vider = 0
        self.travailleurs: list[Travailleur] = []
        for i in range(2):
            self.travailleurs.append(Travailleur(f"joueur{i + 1}", "joueur", duo.vitesse, duo.hesitation, duo.parfait,
                                                 PRIO_JOUEUR_SALLE if i == 0 else PRIO_JOUEUR_BAR))
        for k, (role, niv) in enumerate(cfg.employes):
            self.travailleurs.append(Travailleur(f"{role}{k + 1}", role, VITESSE_EMPLOYE[niv], 0.3, 0.15 + 0.1 * niv,
                                                 PRIO_ROLE[role]))
        self.n_libres = len(self.travailleurs)
        # mesures
        self.groupes: list[Groupe] = []
        self.servis = 0
        self.personnes_servies = 0
        self.repartis = 0
        self.personnes_reparties = 0
        self.attentes: list[float] = []
        self.satisfactions: list[float] = []
        self.recette_jour = 0.0
        self.cout_jour = 0.0
        self.pourboires = 0.0
        self.presents = 0
        self.max_presents = 0
        self.releves: list[int] = []
        self.par_heure_arrivees = [0] * len(creneaux(self.adr))
        self.par_heure_servis = [0] * len(creneaux(self.adr))
        self.par_heure_repartis = [0] * len(creneaux(self.adr))
        self.attente_par_heure: list[list[float]] = [[] for _ in creneaux(self.adr)]
        self.repartis_par_profil: dict[str, int] = {p: 0 for p in ORDRE_PROFILS}
        self.en_attente = 0
        self.attente_prise = 0
        self.attente_comptoir = 0
        self.terrasse_occ = 0
        self.usage_postes: dict[str, float] = {p: 0.0 for p in self.cap}
        self.complets = 0
        self.dernier_service = 0.0
        self.arrives_par_profil: dict[str, int] = {p: 0 for p in ORDRE_PROFILS}

    # -- outils -----------------------------------------------------------
    def push(self, t: float, kind: str, data: object) -> None:
        self.seq += 1
        heapq.heappush(self.ev, (t, self.seq, kind, data))

    def creneau(self, t: float) -> int:
        return min(len(self.par_heure_arrivees) - 1, int(t / (60 * self.spm)))

    # -- arrivées -----------------------------------------------------------
    def generer_arrivees(self, dem: dict[str, list[float]]) -> None:
        gid = 0
        carte = self.cfg.etat.carte
        for p in ORDRE_PROFILS:
            for i, (h, d) in enumerate(creneaux(self.adr)):
                n = poisson(self.rng, dem[p][i])
                for _ in range(n):
                    t0 = (h - self.adr.ouverture) * 60 * self.spm
                    t = t0 + self.rng.random() * d * 60 * self.spm
                    taille = tirer_taille(self.rng, p)
                    art = commande_groupe(self.rng, p, taille, carte)
                    if not art:
                        continue
                    prof = PROF[p]
                    emporter = prof.emporter > 0 and "gobelets" in self.cfg.etat.equipements and self.rng.random() < prof.emporter
                    a_table = self.cfg.service_table and not emporter and prof.place != "comptoir"
                    gid += 1
                    g = Groupe(gid, p, taille, t, art, emporter, a_table)
                    self.push(t, "arrivee", g)

    # -- places -----------------------------------------------------------
    def asseoir(self, g: Groupe) -> bool:
        voulu = PROF[g.profil].place
        if voulu == "comptoir" and self.libres["comptoir"] < g.taille and self.debout_libre >= g.taille:
            return False  # les habitués du comptoir s'y tiennent debout plutôt que de prendre une table
        for typ in REPLIS[voulu]:
            if typ == "comptoir" and g.taille > 2:
                continue
            if self.libres[typ] >= g.taille:
                self.libres[typ] -= g.taille
                propres = self.libres[typ] - self.sales[typ]
                if propres < 0:
                    g.sale_assise = True
                g.place = typ
                g.places_prises = g.taille
                if typ == "terrasse":
                    self.terrasse_occ += g.taille
                return True
        return False

    def liberer(self, g: Groupe) -> None:
        if g.places_prises:
            self.libres[g.place] += g.places_prises
            if g.place == "terrasse":
                self.terrasse_occ -= g.places_prises
            if g.pieces > 0:
                self.sales[g.place] += g.places_prises
                self.q_debarrasser.append((g.place, g.places_prises, g.pieces))
            g.places_prises = 0
        elif g.pieces > 0:
            self.q_debarrasser.append(("debout", 0, g.pieces))
        if g.place == "debout_comptoir":
            self.debout_libre += g.taille
            g.place = ""
        g.pieces = 0
        if self.q_porte:
            attente = list(self.q_porte)
            self.q_porte.clear()
            for h in attente:
                if h.etat == "porte" and self.asseoir(h):
                    h.etat = "assis_attend"
                    self.ouvrir_commande_table(h, list(h.articles), True)
                elif h.etat == "porte":
                    self.q_porte.append(h)

    # -- commandes -----------------------------------------------------------
    def ouvrir_commande_table(self, g: Groupe, articles: list[str], premiere: bool) -> None:
        c = Commande(g, [], premiere=premiere, a_table=True)
        c.articles = [Article(REC[r], c) for r in articles]
        g.commandes_ouvertes += 1
        self.q_table.append(c)
        if premiere:
            self.attente_prise += 1
            self.push(self.t + PROF[g.profil].patience * self.aide_patience, "patience", g)

    def lancer_preparation(self, c: Commande) -> None:
        for a in c.articles:
            r = a.recette
            if r.sequentiel:
                self.ajout_prep(EtapeEnCours(a, r.etapes[0], 0))
            else:
                for k, e in enumerate(r.etapes):
                    self.ajout_prep(EtapeEnCours(a, e, k))

    def ajout_prep(self, s: EtapeEnCours) -> None:
        self.n_prep += 1
        s.seq = self.n_prep
        self.q_prep[s.etape.poste].append(s)

    def article_pret(self, a: Article) -> None:
        c = a.commande
        c.prets += 1
        if c.prets == len(c.articles):
            self.q_servir.append(c)

    def etape_finie(self, s: EtapeEnCours, qualite: str) -> None:
        a = s.article
        a.qualites.append(qualite)
        a.etapes_faites += 1
        r = a.recette
        if r.sequentiel and a.etapes_faites < len(r.etapes):
            self.ajout_prep(EtapeEnCours(a, r.etapes[a.etapes_faites], a.etapes_faites))
            return
        if a.etapes_faites == len(r.etapes):
            self.article_pret(a)

    # -- répartition du travail -----------------------------------------------------------
    def duree(self, w: Travailleur, marche: float, actif: float) -> float:
        return marche + actif / w.vitesse + w.hesitation

    def debarrasser_urgent(self) -> bool:
        if not self.q_debarrasser:
            return False
        return bool(self.q_porte) or len(self.q_debarrasser) >= 3

    def laver_urgent(self) -> bool:
        return self.sale_pile > 0 and self.propre < max(4, 0.2 * self.cfg.vaisselle)

    def niveau(self, poste: str) -> int:
        return self.niveaux.get(poste, 1)

    def essayer(self, w: Travailleur, tache: str) -> bool:
        role = w.role
        allowed = ROLES_TACHES["joueur"] if role == "joueur" else None
        if tache == "finir":
            for i, s in enumerate(self.q_finir):
                if role == "joueur" or peut_poste(role, s.etape.poste):
                    del self.q_finir[i]
                    retard = self.t - s.t_fin_passif
                    n = self.niveau(s.etape.poste)
                    if retard > GESTES["correctRetard"]:
                        q = "correct"
                    elif retard <= GESTES["parfaitRetard"] and self.rng.random() < w.parfait:
                        q = "parfait"
                    else:
                        q = "bien"
                    d = self.duree(w, GESTES["marcheBar"] * 0.5, s.etape.fin[n - 1])
                    self.occuper(w, d, ("finir", s, q))
                    return True
            return False
        if tache == "servir":
            if role not in ("joueur", "salle") or not self.q_servir:
                return False
            c = self.q_servir.popleft()
            n_art = len(c.articles)
            if c.a_table:
                voyages = math.ceil(n_art / GESTES["plateau"])
                d = self.duree(w, self.adr.marche_table * voyages,
                               GESTES["servirTable"] + GESTES["servirParArticle"] * (n_art - 1))
            else:
                d = self.duree(w, GESTES["marcheBar"], GESTES["servirComptoir"] + 0.3 * (n_art - 1))
            self.occuper(w, d, ("servir", c))
            return True
        if tache == "commande":
            if role not in ("joueur", "salle"):
                return False
            if self.q_comptoir and self.occ["caisse"] < self.cap["caisse"]:
                g = self.q_comptoir.popleft()
                while g.etat != "file" and self.q_comptoir:
                    g = self.q_comptoir.popleft()
                if g.etat != "file":
                    return False
                g.etat = "commande"
                self.occ["caisse"] += 1
                d = self.duree(w, GESTES["marcheBar"], GESTES["commandeComptoir"] + 0.4 * (len(g.articles) - 1))
                self.occuper(w, d, ("commande_comptoir", g))
                return True
            while self.q_table:
                c = self.q_table.popleft()
                if c.groupe.etat in ("parti", "reparti"):
                    continue
                d = self.duree(w, self.adr.marche_table, GESTES["commandeTable"] + 0.4 * (len(c.articles) - 1))
                self.occuper(w, d, ("commande_table", c))
                return True
            return False
        if tache == "prep":
            meilleur: EtapeEnCours | None = None
            for poste in self.postes_role[role]:
                q = self.q_prep[poste]
                if not q or self.occ[poste] >= self.cap[poste]:
                    continue
                s = q[0]
                a = s.article
                if not a.vaisselle_prise:
                    besoin = 0 if a.commande.groupe.emporter else a.recette.vaisselle
                    if self.propre < besoin:
                        continue
                if meilleur is None or s.seq < meilleur.seq:
                    meilleur = s
            if meilleur is not None:
                s = meilleur
                poste = s.etape.poste
                a = s.article
                if not a.vaisselle_prise:
                    besoin = 0 if a.commande.groupe.emporter else a.recette.vaisselle
                    self.propre -= besoin
                    a.commande.groupe.pieces += besoin
                    a.vaisselle_prise = True
                self.q_prep[poste].popleft()
                self.occ[poste] += 1
                n = self.niveau(poste)
                d = self.duree(w, GESTES["marcheBar"], s.etape.actif[n - 1])
                self.occuper(w, d, ("prep", s))
                return True
            return False
        if tache in ("laver", "laver_urgent"):
            if role not in ("joueur", "commis", "plonge"):
                return False
            if tache == "laver_urgent" and not self.laver_urgent():
                return False
            if self.q_vider:
                self.q_vider -= 1
                d = self.duree(w, self.adr.marche_plonge, GESTES["viderLave"])
                self.occuper(w, d, ("vider", self.lave_charge))
                return True
            if self.sale_pile <= 0:
                return False
            if self.cfg.plonge >= 2 and not self.lave_occupe and (self.sale_pile >= 8 or self.laver_urgent()):
                n = min(self.sale_pile, GESTES["capaciteLave"][self.cfg.plonge - 1])
                self.sale_pile -= n
                self.lave_occupe = True
                d = self.duree(w, self.adr.marche_plonge, GESTES["chargerLave"] * n)
                self.occuper(w, d, ("charger", n))
                return True
            if self.cfg.plonge == 1 or self.laver_urgent():
                n = min(self.sale_pile, GESTES["laverLot"])
                self.sale_pile -= n
                d = self.duree(w, self.adr.marche_plonge, GESTES["laverMain"] * n)
                self.occuper(w, d, ("laver", n))
                return True
            return False
        if tache in ("debarrasser", "debarrasser_urgent"):
            if role not in ("joueur", "salle", "commis", "plonge"):
                return False
            if tache == "debarrasser_urgent" and not self.debarrasser_urgent():
                return False
            if not self.q_debarrasser:
                return False
            typ, nplaces, pieces = self.q_debarrasser.popleft()
            marche = GESTES["marcheBar"] if typ in ("debout", "comptoir") else self.adr.marche_table
            d = self.duree(w, marche + self.adr.marche_plonge * 0.5, GESTES["debarrasser"])
            self.occuper(w, d, ("debarrasser", typ, nplaces, pieces))
            return True
        return False

    def occuper(self, w: Travailleur, d: float, tache: tuple) -> None:
        w.libre = False
        self.n_libres -= 1
        w.occupe += d
        self.push(self.t + d, "fin_tache", (w, tache))

    def repartir(self) -> None:
        if self.n_libres == 0:
            return
        for w in self.travailleurs:
            if not w.libre:
                continue
            for tache in w.priorites:
                if self.essayer(w, tache):
                    break

    # -- effets des tâches -----------------------------------------------------------
    def fin_tache(self, w: Travailleur, tache: tuple) -> None:
        w.libre = True
        self.n_libres += 1
        kind = tache[0]
        if kind == "commande_comptoir":
            g: Groupe = tache[1]
            self.occ["caisse"] -= 1
            c = Commande(g, [], premiere=g.t_servi < 0)
            c.articles = [Article(REC[r], c) for r in g.articles]
            g.etat = "attend_service"
            g.commandes_ouvertes += 1
            if c.premiere:
                self.en_attente += 1
                self.attente_comptoir += 1
            self.encaisser(c)
            self.lancer_preparation(c)
        elif kind == "commande_table":
            c = tache[1]
            if c.premiere:
                c.groupe.etat = "attend_service"
                self.en_attente += 1
                self.attente_prise -= 1
            self.encaisser(c)
            self.lancer_preparation(c)
        elif kind == "prep":
            s: EtapeEnCours = tache[1]
            n = self.niveau(s.etape.poste)
            passif = s.etape.passif[n - 1]
            if passif > 0:
                self.push(self.t + passif, "fin_passif", s)
            else:
                self.occ[s.etape.poste] -= 1
                q = "parfait" if self.rng.random() < w.parfait * 0.8 else "bien"
                self.etape_finie(s, q)
        elif kind == "finir":
            s = tache[1]
            self.occ[s.etape.poste] -= 1
            self.etape_finie(s, tache[2])
        elif kind == "servir":
            c = tache[1]
            self.servir(c)
        elif kind == "debarrasser":
            _, typ, nplaces, pieces = tache
            if typ in self.sales:
                self.sales[typ] = max(0, self.sales[typ] - nplaces)
            self.sale_pile += pieces
        elif kind == "laver":
            self.propre += tache[1]
        elif kind == "charger":
            self.lave_charge = tache[1]
            self.push(self.t + GESTES["cycleLave"][self.cfg.plonge - 1], "fin_lave", tache[1])
        elif kind == "vider":
            self.propre += tache[1]
            self.lave_occupe = False

    def encaisser(self, c: Commande) -> None:
        ip = ADR[self.cfg.adresse].indice_prix * self.cfg.etat.indice_prix
        if c.a_table or c.groupe.a_table:
            ip *= PRIX_SALLE
        ic = ADR[self.cfg.adresse].indice_cout
        four = "four" in self.niveaux
        for a in c.articles:
            r = a.recette
            self.recette_jour += r.prix * ip
            cout = r.cout_maison if (r.cout_maison and four) else r.cout
            self.cout_jour += cout * ic
        c.groupe.__dict__.setdefault("addition", 0.0)
        c.groupe.__dict__["addition"] = c.groupe.__dict__["addition"] + sum(a.recette.prix * ip for a in c.articles)

    def servir(self, c: Commande) -> None:
        g = c.groupe
        g.commandes_ouvertes -= 1
        for a in c.articles:
            g.qualites.extend(a.qualites)
        if not c.premiere:
            return
        self.dernier_service = max(self.dernier_service, self.t)
        self.en_attente -= 1
        if not c.a_table:
            self.attente_comptoir -= 1
        g.t_servi = self.t
        attente = self.t - g.t
        self.attentes.append(attente)
        self.attente_par_heure[self.creneau(g.t)].append(attente)
        self.servis += 1
        self.personnes_servies += g.taille
        self.par_heure_servis[self.creneau(self.t)] += 1
        prof = PROF[g.profil]
        if g.emporter:
            self.depart(g)
            return
        if not g.a_table and not g.places_prises:
            if not self.asseoir(g):
                if prof.place == "comptoir" and self.debout_libre >= g.taille:
                    self.debout_libre -= g.taille
                    g.place = "debout_comptoir"
                    g.places_prises = 0
                else:
                    g.debout = True
        sejour = self.rng.uniform(*prof.sejour) * self.spm
        if g.debout:
            sejour *= 0.5
        # Servi après la fermeture douce: le groupe boit et s'en va en cinq minutes de jeu.
        t_dep = max(self.t + 5 * self.spm, min(self.t + sejour, self.fin + REG["fermetureDouce"] * self.spm))
        g.etat = "assis"
        self.push(t_dep, "depart", g)
        iv, pr = prof.recommande
        if iv > 0:
            k = 1
            while self.t + k * iv * self.spm < t_dep - 10 * self.spm:
                if self.rng.random() < pr:
                    self.push(self.t + k * iv * self.spm, "recommande", g)
                k += 1

    def satisfaction(self, g: Groupe) -> float:
        prof = PROF[g.profil]
        s = SATISFACTION["base"]
        attente = g.t_servi - g.t
        if attente > prof.confort:
            s += max(SATISFACTION["attenteMax"], SATISFACTION["parSeconde"] * (attente - prof.confort))
        if g.qualites:
            qv = {"parfait": SATISFACTION["parfait"], "bien": SATISFACTION["bien"], "correct": SATISFACTION["correct"]}
            poids = 2.0 if g.profil == "connaisseurs" else 1.0
            s += poids * sum(qv[q] for q in g.qualites) / len(g.qualites)
        ip = self.cfg.etat.indice_prix
        s += max(-SATISFACTION["prixBorne"], min(SATISFACTION["prixBorne"], (1 - ip) * prof.sensibilite * SATISFACTION["prixPente"]))
        if g.debout and not g.emporter and prof.place != "comptoir":
            s += SATISFACTION["debout"]
        elif g.place == prof.place or (g.place == "debout_comptoir" and prof.place == "comptoir"):
            s += SATISFACTION["placeVoulue"]
        if g.sale_assise:
            s += SATISFACTION["tableSale"]
        s += (self.cfg.etat.ambiance - 50) / SATISFACTION["ambianceDiviseur"]
        return max(0.0, min(100.0, s))

    def depart(self, g: Groupe) -> None:
        if g.etat in ("parti", "reparti"):
            return
        g.etat = "parti"
        sat = self.satisfaction(g)
        self.satisfactions.append(sat)
        addition = g.__dict__.get("addition", 0.0)
        if sat >= POURBOIRE["seuil"] and self.rng.random() < POURBOIRE["probabilite"]:
            taux = POURBOIRE["tauxRavi"] if sat >= POURBOIRE["seuilRavi"] else POURBOIRE["taux"]
            self.pourboires += addition * taux * PROF[g.profil].pourboire
        self.liberer(g)
        self.presents -= g.taille

    # -- boucle -----------------------------------------------------------
    def run(self, dem: dict[str, list[float]]) -> "Service":
        self.generer_arrivees(dem)
        prochain_releve = 0.0
        while self.ev:
            t, _, kind, data = heapq.heappop(self.ev)
            assert t >= self.t - 1e-9, "événement daté dans le passé"
            while prochain_releve <= t:
                self.releves.append(self.presents)
                prochain_releve += 5.0
            dt = t - self.t
            if dt > 0:
                for poste, n in self.occ.items():
                    if n:
                        self.usage_postes[poste] += n * dt
            self.t = t
            if kind == "arrivee":
                g: Groupe = data  # type: ignore[assignment]
                self.groupes.append(g)
                self.arrives_par_profil[g.profil] += 1
                self.par_heure_arrivees[self.creneau(t)] += 1
                if self.renonce(g):
                    self.repartir()
                    continue
                self.presents += g.taille
                self.max_presents = max(self.max_presents, self.presents)
                if g.a_table:
                    if self.asseoir(g):
                        g.etat = "assis_attend"
                        self.ouvrir_commande_table(g, list(g.articles), True)
                    else:
                        g.etat = "porte"
                        self.q_porte.append(g)
                        self.push(t + PROF[g.profil].patience * self.aide_patience, "patience", g)
                else:
                    g.etat = "file"
                    self.q_comptoir.append(g)
                    self.push(t + PROF[g.profil].patience * self.aide_patience, "patience", g)
            elif kind == "patience":
                g = data  # type: ignore[assignment]
                if g.etat in ("file", "porte", "assis_attend"):
                    if g.etat == "assis_attend":
                        enc_cours = any(c.groupe is g for c in self.q_table)
                        if not enc_cours:
                            pass
                        else:
                            self.q_table = deque(c for c in self.q_table if c.groupe is not g)
                            self.attente_prise -= 1
                            self.liberer_sans_vaisselle(g)
                            self.abandon(g)
                    else:
                        if g.etat == "porte":
                            try:
                                self.q_porte.remove(g)
                            except ValueError:
                                pass
                        self.abandon(g)
            elif kind == "fin_tache":
                w, tache = data  # type: ignore[misc]
                self.fin_tache(w, tache)
            elif kind == "fin_passif":
                s: EtapeEnCours = data  # type: ignore[assignment]
                n = self.niveau(s.etape.poste)
                if s.etape.fin[n - 1] > 0:
                    s.t_fin_passif = t
                    self.q_finir.append(s)
                else:
                    self.occ[s.etape.poste] -= 1
                    q = "parfait" if self.rng.random() < 0.25 else "bien"
                    self.etape_finie(s, q)
            elif kind == "fin_lave":
                self.q_vider += 1
            elif kind == "depart":
                g = data  # type: ignore[assignment]
                self.depart(g)
            elif kind == "recommande":
                g = data  # type: ignore[assignment]
                if g.etat == "assis":
                    art = commande_groupe(self.rng, g.profil, 1, self.cfg.etat.carte)[:1]
                    if art:
                        if g.a_table:
                            self.ouvrir_commande_table(g, art, False)
                        else:
                            c = Commande(g, [], premiere=False)
                            c.articles = [Article(REC[r], c) for r in art]
                            g.commandes_ouvertes += 1
                            self.encaisser(c)
                            self.lancer_preparation(c)
            self.repartir()
        return self

    def renonce(self, g: Groupe) -> bool:
        """Règle CL-03: on n'entre pas dans un café plein ni devant une attente trop longue.

        Au comptoir, on voit la file et ceux qui attendent leur commande; en salle, seulement les
        groupes qui attendent une place à l'entrée."""
        visibles = len(self.q_comptoir) + len(self.q_porte) + self.en_attente + self.attente_prise
        estimee = visibles * CLIENTS["secondesParGroupe"] / len(self.travailleurs)
        trop = estimee > PROF[g.profil].patience * self.aide_patience
        # C2: personnages présents au plus, personnel compris; C4: six places de file au plus.
        plein = self.presents + g.taille > self.adr.presents_max - len(self.travailleurs)
        file = sum(h.taille for h in self.q_comptoir) + sum(h.taille for h in self.q_porte)
        doit_attendre = (not g.a_table) or not self.place_libre(g)
        plein = plein or (doit_attendre and file + g.taille > CLIENTS["file"])
        if trop or plein:
            g.etat = "reparti"
            self.repartis += 1
            self.personnes_reparties += g.taille
            self.repartis_par_profil[g.profil] += 1
            self.par_heure_repartis[self.creneau(g.t)] += 1
            if plein:
                self.complets += 1
            return True
        return False

    def place_libre(self, g: Groupe) -> bool:
        voulu = PROF[g.profil].place
        return any(self.libres[t] >= g.taille and not (t == "comptoir" and g.taille > 2) for t in REPLIS[voulu])

    def liberer_sans_vaisselle(self, g: Groupe) -> None:
        if g.places_prises:
            self.libres[g.place] += g.places_prises
            if g.place == "terrasse":
                self.terrasse_occ -= g.places_prises
            g.places_prises = 0

    def abandon(self, g: Groupe) -> None:
        g.etat = "reparti"
        self.repartis += 1
        self.personnes_reparties += g.taille
        self.repartis_par_profil[g.profil] += 1
        self.par_heure_repartis[self.creneau(g.t)] += 1
        self.presents -= g.taille

    # -- bilan -----------------------------------------------------------
    def bilan(self) -> dict[str, float]:
        n = self.servis + self.repartis
        att = sorted(self.attentes) or [0.0]
        rel = sorted(self.releves) or [0]
        sat = self.satisfactions or [0.0]
        joueurs = [w for w in self.travailleurs if w.role == "joueur"]
        duree = max(self.fin, self.t)
        return {
            "arrives": n,
            "servis": self.servis,
            "personnes": self.personnes_servies,
            "repartis": self.repartis / n if n else 0.0,
            "attente": statistics.fmean(att),
            "attente90": att[int(0.9 * (len(att) - 1))],
            "satisfaction": statistics.fmean(sat),
            "charge": statistics.fmean(min(1.0, w.occupe / duree) for w in joueurs),
            "presents_max": self.max_presents,
            "presents_95": rel[int(0.95 * (len(rel) - 1))],
            "recette": self.recette_jour,
            "cout": self.cout_jour,
            "pourboires": self.pourboires,
            "personnel": len(self.travailleurs),
            "complets": self.complets / n if n else 0.0,
            "depassement": max(0.0, self.dernier_service - self.fin),
        }


# ---------------------------------------------------------------------------
# 11. Modèle rapide d'une journée (file par heure), calé sur la simulation client par client
# ---------------------------------------------------------------------------

# Calage (section 5 du script, `calage()`): charge atteignable des personnes et des machines, part de
# l'excédent qui renonce dans l'heure, attente moyenne selon la charge.
CALAGE = {"u": 0.86, "uMachine": 0.80, "renonce": 0.55, "attente0": 22.0, "attenteK": 70.0, "attenteSeuil": 0.55,
          "attenteMax": 260.0}


@dataclass
class ChargeProfil:
    travail: float  # secondes de travail (vitesse 1) par groupe, hésitation comprise
    machines: dict[str, float]  # secondes de poste occupé par groupe (espresso, vapeur)
    personnes: float
    articles: float
    recette: float  # euros par groupe, à l'indice de prix 1
    cout: float
    assis: float  # part des groupes qui s'assoient
    sejour: float  # minutes de jeu assises
    qualite: float  # points de satisfaction dus à la qualité, en moyenne


def moyenne_taille(profil: str) -> float:
    return sum(t * w for t, w in PROF[profil].tailles)


def articles_par_personne(profil: str, carte: list[str]) -> list[tuple[str, float]]:
    """Espérance des recettes commandées par personne (recette, probabilité)."""
    fam = familles_de(carte)
    par_famille: dict[str, list[str]] = {}
    for rid in carte:
        par_famille.setdefault(REC[rid].famille, []).append(rid)
    p = PROF[profil]
    out: dict[str, float] = {}

    def ajoute_famille(parmi: tuple[str, ...], proba: float, repli: bool) -> None:
        choix = []
        for f in parmi:
            if fam.get(f, 0) == 0:
                continue
            if f == p.principal:
                choix.append((f, 3.0))
            elif f in p.secondaires:
                choix.append((f, 1.0))
        if not choix and repli:
            choix = [(f, 1.0) for f in parmi if fam.get(f, 0)]
        tot = sum(w for _, w in choix)
        for f, w in choix:
            recs = par_famille[f]
            for r in recs:
                out[r] = out.get(r, 0.0) + proba * w / tot / len(recs)

    if profil == "brunch" and fam.get("brunch", 0):
        for r in par_famille["brunch"]:
            out[r] = out.get(r, 0.0) + 0.85 / len(par_famille["brunch"])
        ajoute_famille(BOISSONS, 0.15, True)
        ajoute_famille(NOURRITURES, 0.15 * p.p_nourriture, False)
    else:
        ajoute_famille(BOISSONS, 1.0, True)
        ajoute_famille(NOURRITURES, p.p_nourriture, False)
    return list(out.items())


def charge_profil(adr: Adresse, niveaux: dict[str, int], plonge: int, service_table: bool, carte: list[str],
                  profil: str, hesitation: float, parfait: float, emporter_ok: bool, four: bool) -> ChargeProfil:
    p = PROF[profil]
    taille = moyenne_taille(profil)
    arts = articles_par_personne(profil, carte)
    emporter = p.emporter if emporter_ok else 0.0
    a_table = service_table and p.place != "comptoir"
    travail = 0.0
    machines = {"espresso": 0.0, "vapeur": 0.0}
    n_art = 0.0
    recette = 0.0
    cout = 0.0
    pieces = 0.0
    qual = 0.0
    qv = {"parfait": SATISFACTION["parfait"], "bien": SATISFACTION["bien"], "correct": SATISFACTION["correct"]}
    for rid, pr in arts:
        r = REC[rid]
        if any(e.poste not in niveaux for e in r.etapes):
            continue
        n_art += pr
        recette += pr * r.prix
        cout += pr * (r.cout_maison if (r.cout_maison and four) else r.cout)
        pieces += pr * r.vaisselle * (1 - emporter)
        q_art = 0.0
        for e in r.etapes:
            n = niveaux[e.poste]
            travail += pr * (GESTES["marcheBar"] + e.actif[n - 1] + hesitation)
            if e.fin[n - 1] > 0:
                travail += pr * (GESTES["marcheBar"] * 0.5 + e.fin[n - 1] + hesitation)
            if e.poste in machines:
                machines[e.poste] += pr * (e.actif[n - 1] + e.passif[n - 1] + e.fin[n - 1] + 2.0 * (e.fin[n - 1] > 0))
            if e.passif[n - 1] > 0 and e.fin[n - 1] == 0:
                q_art += 0.25 * qv["parfait"] + 0.75 * qv["bien"]
            else:
                pp = parfait if e.passif[n - 1] > 0 else parfait * 0.8
                q_art += pp * qv["parfait"] + (1 - pp) * qv["bien"]
        qual += pr * q_art / len(r.etapes)
    if n_art <= 0:
        return ChargeProfil(0.0, machines, taille, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0)
    qual /= n_art
    n_groupe = n_art * taille
    travail *= taille
    for k in machines:
        machines[k] *= taille
    # commande, service, débarrasser, vaisselle
    if a_table:
        travail += adr.marche_table + GESTES["commandeTable"] + 0.4 * (n_groupe - 1) + hesitation
        travail += adr.marche_table * max(1.0, n_groupe / GESTES["plateau"]) + GESTES["servirTable"] \
            + GESTES["servirParArticle"] * (n_groupe - 1) + hesitation
    else:
        travail += GESTES["marcheBar"] + GESTES["commandeComptoir"] + 0.4 * (n_groupe - 1) + hesitation
        travail += GESTES["marcheBar"] + GESTES["servirComptoir"] + 0.3 * (n_groupe - 1) + hesitation
    assis = 1 - emporter
    marche = adr.marche_table if a_table else (adr.marche_table + GESTES["marcheBar"]) / 2
    travail += assis * (marche + adr.marche_plonge * 0.5 + GESTES["debarrasser"] + hesitation)
    n_pieces = pieces * taille
    if plonge == 1:
        travail += n_pieces * (GESTES["laverMain"] + (adr.marche_plonge + hesitation) / GESTES["laverLot"])
    else:
        lot = 12.0
        travail += n_pieces * (GESTES["chargerLave"] + (2 * adr.marche_plonge + GESTES["viderLave"] + 2 * hesitation) / lot)
    # recommandes: une boisson de plus, prise et servie
    iv, pr = p.recommande
    sejour = (p.sejour[0] + p.sejour[1]) / 2
    if iv > 0 and assis > 0:
        n_re = max(0.0, (sejour - 10) / iv) * pr * assis
        unite = (adr.marche_table if a_table else GESTES["marcheBar"]) * 2 + GESTES["commandeTable"] + 1.0 + 2 * hesitation
        travail += n_re * (unite + 4.0)
        machines["espresso"] += n_re * 10.0
        recette += n_re * 2.5 / taille
        cout += n_re * 0.4 / taille
    if a_table:
        recette *= PRIX_SALLE
    return ChargeProfil(travail, machines, taille, n_groupe, recette * taille, cout * taille, assis, sejour, qual)


def phi(x: float) -> float:
    return 0.5 * (1 + math.erf(x / math.sqrt(2)))


SAT_ECART = 7.0  # écart type de la satisfaction des groupes autour de la moyenne (mesuré: 6 à 9)


def journee_rapide(cfg: Config, duo: Duo, rng: random.Random | None, jour: int, saison: int, meteo: str,
                   spm: float = 1.0) -> dict[str, float]:
    """Une journée par créneaux d'une heure. `rng` nul: espérances sans tirage."""
    adr = ADR[cfg.adresse]
    e = cfg.etat
    dem = demande(adr, e, jour, saison, meteo)
    four = "four" in cfg.niveaux
    emporter_ok = "gobelets" in e.equipements
    ch = {p: charge_profil(adr, cfg.niveaux, cfg.plonge, cfg.service_table, e.carte, p, duo.hesitation, duo.parfait,
                           emporter_ok, four) for p in ORDRE_PROFILS}
    vitesse = 2 * duo.vitesse + sum(VITESSE_EMPLOYE[n] for _, n in cfg.employes)
    n_esp = POSTES["espresso"][1][cfg.niveaux.get("espresso", 1) - 1]
    n_vap = POSTES["vapeur"][1][cfg.niveaux.get("vapeur", 1) - 1]
    cr = creneaux(adr)
    places_int = cfg.places[0] + cfg.places[1] + cfg.places[2]
    places = places_int + (cfg.places[3] if TERRASSE_OUVERTE[meteo] else 0)
    occupation = [0.0] * (len(cr) + 12)
    backlog = 0.0
    out = {"arrives": 0.0, "servis": 0.0, "personnes": 0.0, "perdus": 0.0, "recette": 0.0, "cout": 0.0,
           "pourboires": 0.0, "points": 0.0, "sat_somme": 0.0, "attente_somme": 0.0, "charge_max": 0.0,
           "presents_max": 0.0}
    ip = adr.indice_prix * e.indice_prix
    ic = adr.indice_cout
    amb = (e.ambiance - 50) / SATISFACTION["ambianceDiviseur"]
    for i, (h, d) in enumerate(cr):
        if rng is not None:
            arr = {p: float(poisson(rng, dem[p][i])) for p in ORDRE_PROFILS}
        else:
            arr = {p: dem[p][i] for p in ORDRE_PROFILS}
        arr = {p: a for p, a in arr.items() if a > 0 and ch[p].articles > 0}
        tot = sum(arr.values())
        out["arrives"] += tot
        if tot <= 0 and backlog <= 0:
            continue
        sec = d * 60 * spm
        w = sum(a * ch[p].travail for p, a in arr.items())
        m_esp = sum(a * ch[p].machines["espresso"] for p, a in arr.items())
        m_vap = sum(a * ch[p].machines["vapeur"] for p, a in arr.items())
        rho = max(w / (vitesse * sec * CALAGE["u"]), m_esp / (n_esp * sec * CALAGE["uMachine"]),
                  m_vap / (n_vap * sec * CALAGE["uMachine"])) if tot > 0 else 0.0
        demande_g = tot + backlog
        cap_g = tot / rho if rho > 0 else demande_g
        servis = min(demande_g, cap_g)
        excedent = demande_g - servis
        perdus = excedent * CALAGE["renonce"]
        backlog = excedent - perdus
        out["perdus"] += perdus
        frac = servis / demande_g if demande_g > 0 else 0.0
        charge = demande_g / cap_g if cap_g > 0 else 0.0
        out["charge_max"] = max(out["charge_max"], charge)
        att = min(CALAGE["attenteMax"], CALAGE["attente0"] + CALAGE["attenteK"] * max(0.0, charge - CALAGE["attenteSeuil"]) ** 2)
        # places: ceux qui s'assoient occupent leur place pendant leur séjour
        assis_nouveaux = sum(arr.get(p, 0) * frac * ch[p].assis * ch[p].personnes for p in arr)
        debout = 0.0
        libre = places - occupation[i]
        if assis_nouveaux > 0 and libre < assis_nouveaux:
            debout = max(0.0, min(1.0, (assis_nouveaux - max(0.0, libre)) / assis_nouveaux))
        for p, a in arr.items():
            c = ch[p]
            s_p = a * frac
            if s_p <= 0:
                continue
            reste = c.sejour / 60 * spm / (d * spm) if d > 0 else 0
            pers = s_p * c.assis * c.personnes * (1 - debout)
            k = i
            r = c.sejour / 60.0
            while r > 0 and k < len(occupation):
                occupation[k] += pers * min(1.0, r)
                r -= 1.0
                k += 1
            prof = PROF[p]
            sat = SATISFACTION["base"] + c.qualite * (2.0 if p == "connaisseurs" else 1.0) + amb
            sat += max(-SATISFACTION["prixBorne"], min(SATISFACTION["prixBorne"],
                       (1 - e.indice_prix) * prof.sensibilite * SATISFACTION["prixPente"]))
            sat += SATISFACTION["placeVoulue"] * 0.6 * (1 - debout) + SATISFACTION["debout"] * debout * (prof.place != "comptoir")
            if att > prof.confort:
                sat += max(SATISFACTION["attenteMax"], SATISFACTION["parSeconde"] * (att - prof.confort))
            sat = max(0.0, min(100.0, sat))
            out["servis"] += s_p
            out["personnes"] += s_p * c.personnes
            out["recette"] += s_p * c.recette * ip
            out["cout"] += s_p * c.cout * ic
            out["sat_somme"] += s_p * sat
            out["attente_somme"] += s_p * att
            z80 = (sat - POURBOIRE["seuil"]) / SAT_ECART
            z90 = (sat - POURBOIRE["seuilRavi"]) / SAT_ECART
            p80, p90 = phi(z80), phi(z90)
            taux = POURBOIRE["taux"] * (p80 - p90) + POURBOIRE["tauxRavi"] * p90
            out["pourboires"] += s_p * c.recette * ip * taux * POURBOIRE["probabilite"] * prof.pourboire
            # points de réputation: espérance de max(0, (S - 50) / 10) pour S normale
            mu = (sat - REPUTATION_PIVOT) / REPUTATION_DIVISEUR
            sd = SAT_ECART / REPUTATION_DIVISEUR
            z = mu / sd
            out["points"] += s_p * (mu * phi(z) + sd * math.exp(-z * z / 2) / math.sqrt(2 * math.pi))
        out["presents_max"] = max(out["presents_max"], occupation[i] + backlog * 1.5)
    if backlog > 0:
        out["servis"] += backlog
        out["perdus"] += 0.0
    n = out["servis"]
    out["satisfaction"] = out["sat_somme"] / n if n else 0.0
    out["attente"] = out["attente_somme"] / n if n else 0.0
    out["repartis"] = out["perdus"] / out["arrives"] if out["arrives"] else 0.0
    return out


# ---------------------------------------------------------------------------
# 12. Catalogue d'achats, équipement de départ (cahier, sections 4.15 et 6.2)
# ---------------------------------------------------------------------------

# Ce que chaque adresse fournit à l'arrivée (compris dans le coût d'installation).
DEPART: dict[str, dict[str, object]] = {
    "village": {"niveaux": {"espresso": 1, "vapeur": 1, "bouilloire": 1, "vitrine": 1, "plan": 1, "frigo": 1},
                "plonge": 1, "caisses": 1, "equipements": ()},
    "bourg": {"niveaux": {"espresso": 1, "vapeur": 1, "bouilloire": 1, "vitrine": 1, "plan": 1, "frigo": 1},
              "plonge": 1, "caisses": 1, "equipements": ("gobelets",)},
    "ville": {"niveaux": {"espresso": 2, "vapeur": 2, "bouilloire": 2, "vitrine": 2, "plan": 2, "frigo": 2, "four": 1,
                          "agrumes": 1},
              "plonge": 2, "caisses": 1, "equipements": ("gobelets", "wifi")},
    "paris-quartier": {"niveaux": {"espresso": 2, "vapeur": 2, "bouilloire": 2, "vitrine": 2, "plan": 2, "frigo": 2,
                                   "four": 1, "agrumes": 1},
                       "plonge": 2, "caisses": 1, "equipements": ("gobelets", "wifi", "mange_debout")},
    "paris-maison": {"niveaux": {"espresso": 3, "vapeur": 2, "bouilloire": 2, "vitrine": 2, "plan": 2, "frigo": 2,
                                 "four": 2, "agrumes": 2},
                     "plonge": 3, "caisses": 2, "equipements": ("gobelets", "wifi")},
}

# (adresse, identifiant, nom, prix, effet, rang pour un duo « équilibre », rang pour un duo « capacité »)
# Effets: poste:<poste>:<niveau>, plonge:<n>, places:c,t,co,te, ext:<extension>, equip:<nom>, recette:<id>,
#         vaisselle:<n>, caisse:<n>, salle (service à table). Les paliers d'ambiance s'ajoutent à part.
ACHATS: list[tuple[str, str, str, int, str, int, int]] = [
    ("village", "gobelets", "Gobelets et couvercles (vente à emporter)", 40, "equip:gobelets", 1, 1),
    ("village", "fiche_cappuccino", "Fiche « cappuccino »", 30, "recette:cappuccino", 2, 3),
    ("village", "fiche_the_vert", "Fiche « thé vert »", 20, "recette:the_vert", 3, 9),
    ("village", "moulin_dose", "Moulin à dose", 380, "poste:espresso:2", 6, 2),
    ("village", "pichet", "Pichet thermomètre", 60, "poste:vapeur:2", 4, 4),
    ("village", "presse", "Presse-agrumes à levier", 120, "poste:agrumes:1", 5, 5),
    ("village", "creperie", "Crêpière", 180, "poste:creperie:1", 7, 7),
    ("village", "tabourets", "Deux tabourets de comptoir", 120, "equip:tabourets", 8, 10),
    ("village", "frigo_vitre", "Réfrigérateur vitré", 350, "recette:limonade", 12, 12),
    ("village", "fauteuils", "Deux fauteuils (à la place de deux chaises)", 380, "places:0,-2,2,0;equip:fauteuils", 9, 11),
    ("village", "livres", "Étagère à livres", 150, "equip:livres", 10, 13),
    ("village", "velos", "Range-vélos", 180, "equip:range_velos", 11, 8),
    ("village", "enfants", "Chaise haute et coin des enfants", 260, "equip:chaise_haute;equip:coin_enfants", 13, 14),
    ("village", "village_terrasse", "La terrasse de la place", 600, "ext:village_terrasse", 15, 15),
    ("village", "village_fond", "Le coin du fond", 1100, "ext:village_fond", 16, 16),
    ("village", "bouilloire", "Bouilloire à température", 90, "poste:bouilloire:2", 17, 17),
    ("bourg", "four", "Four de boulanger d'occasion", 1200, "poste:four:1", 1, 1),
    ("bourg", "lave", "Lave-vaisselle", 1400, "plonge:2", 2, 2),
    ("bourg", "salle", "Service en salle (carnet et plateaux)", 80, "salle", 3, 6),
    ("bourg", "moulin_dose", "Moulin à dose", 380, "poste:espresso:2", 4, 3),
    ("bourg", "presse", "Presse-agrumes à levier", 120, "poste:agrumes:1", 5, 5),
    ("bourg", "tables", "Une table de plus", 160, "places:0,1,0,0", 6, 4),
    ("bourg", "gaufrier", "Gaufrier", 250, "poste:gaufrier:1", 7, 9),
    ("bourg", "vitrine", "Vitrine réfrigérée", 900, "poste:vitrine:2;equip:vitrine", 8, 8),
    ("bourg", "buse2", "Seconde buse vapeur", 450, "poste:vapeur:2", 9, 7),
    ("bourg", "fiches_bourg", "Fiches du bourg (double, viennois, chocolat viennois, fondant, quiche)", 200,
     "recette:double;recette:viennois;recette:chocolat_viennois;recette:fondant;recette:quiche", 10, 10),
    ("bourg", "wifi", "Wifi et prises (électricien)", 420, "equip:wifi;equip:prises", 11, 11),
    ("bourg", "fauteuils", "Deux fauteuils (à la place de deux chaises)", 380, "places:0,-2,2,0;equip:fauteuils", 12, 13),
    ("bourg", "bourg_terrasse", "E1, la terrasse de la halle", 1500, "ext:bourg_terrasse", 13, 12),
    ("bourg", "bourg_remise", "E2, la salle de la remise", 2600, "ext:bourg_remise;equip:grande_table", 14, 14),
    ("bourg", "bourg_cour", "E3, la cour sous la treille", 1800, "ext:bourg_cour", 16, 16),
    ("bourg", "vaisselle", "Service de vaisselle (+24 pièces)", 160, "vaisselle:24", 15, 15),
    ("ville", "trois_groupes", "Machine à trois groupes, arrêt programmé", 6500, "poste:espresso:3", 3, 1),
    ("ville", "buse_auto", "Buses automatiques", 1200, "poste:vapeur:3", 5, 2),
    ("ville", "capot", "Lave-vaisselle à capot", 4200, "plonge:3", 7, 4),
    ("ville", "blender", "Blender", 300, "poste:blender:1", 1, 3),
    ("ville", "douce", "Bar à méthodes douces et moulin de spécialité", 3200, "poste:douce:1;equip:moulin_specialite", 2, 5),
    ("ville", "grande_table", "Grande table d'atelier", 900, "equip:grande_table", 4, 6),
    ("ville", "fiches_ville", "Fiches de la ville (latte, milk-shake, cannelé, tartine avocat-œuf)", 210,
     "recette:latte;recette:milkshake;recette:cannele;recette:tartine_avocat", 6, 7),
    ("ville", "four2", "Four ventilé", 3500, "poste:four:2", 9, 9),
    ("ville", "tables", "Deux tables et deux fauteuils", 520, "places:0,2,2,0", 8, 8),
    ("ville", "ville_cour", "La cour", 3800, "ext:ville_cour", 10, 10),
    ("ville", "ville_salle2", "La deuxième salle", 6500, "ext:ville_salle2", 11, 11),
    ("paris-quartier", "trois_groupes", "Machine à trois groupes, arrêt programmé", 6500, "poste:espresso:3", 1, 1),
    ("paris-quartier", "buse_auto", "Buses automatiques", 1200, "poste:vapeur:3", 2, 2),
    ("paris-quartier", "caisse2", "Second terminal de paiement", 600, "caisse:2", 3, 3),
    ("paris-quartier", "capot", "Lave-vaisselle à capot", 4200, "plonge:3", 4, 4),
    ("paris-quartier", "blender", "Blender", 300, "poste:blender:1", 5, 5),
    ("paris-quartier", "douce", "Bar à méthodes douces et moulin de spécialité", 3200,
     "poste:douce:1;equip:moulin_specialite", 6, 6),
    ("paris-quartier", "fiche_citron", "Fiche « tarte au citron meringuée »", 80, "recette:tarte_citron", 7, 8),
    ("paris-quartier", "tables", "Deux tabourets, deux tables, une banquette, une table dehors", 1500, "places:2,2,2,2", 8, 7),
    ("paris-quartier", "pq_trottoir", "La terrasse sur le trottoir", 7000, "ext:pq_trottoir", 9, 9),
    ("paris-quartier", "pq_mezzanine", "La mezzanine", 14000, "ext:pq_mezzanine", 10, 10),
    ("paris-maison", "buse_auto", "Buses automatiques", 1200, "poste:vapeur:3", 1, 1),
    ("paris-maison", "douce", "Bar à méthodes douces et moulin de spécialité", 3200,
     "poste:douce:1;equip:moulin_specialite", 2, 2),
    ("paris-maison", "blender", "Blender", 300, "poste:blender:1", 3, 3),
    ("paris-maison", "tables", "Quatre tables, une banquette, deux tables dehors", 2600, "places:0,4,2,4", 4, 4),
    ("paris-maison", "labo", "Laboratoire de pâtisserie", 15000, "poste:four:3;recette:entremets", 5, 6),
    ("paris-maison", "torrefaction", "Torréfacteur (notre mélange)", 18000, "recette:notre_melange", 6, 7),
    ("paris-maison", "pm_verriere", "La verrière restaurée", 32000, "ext:pm_verriere", 7, 5),
    ("paris-maison", "pm_etage", "L'étage", 42000, "ext:pm_etage", 8, 8),
]
AMBIANCE_HAUSSE = 1.25  # chaque palier de +10 d'ambiance coûte 25 % de plus que le précédent
AMBIANCE_DEPART = {"village": 30, "bourg": 25, "ville": 30, "paris-quartier": 35, "paris-maison": 35}
AMBIANCE_MAX = 95
# Un palier d'ambiance après tant d'achats du catalogue (duo lent, médian, rapide).
AMBIANCE_RYTHME = {"lent": 1, "median": 2, "rapide": 3}

# Équipe visée par adresse, dans l'ordre d'embauche. « affluence »: seulement les jours de marché et le
# week-end (renfort payé à ces seuls jours).
EQUIPE: dict[str, list[tuple[str, str]]] = {
    "village": [],
    "bourg": [("commis", "affluence")],
    "ville": [("salle", "tous"), ("plonge", "tous"), ("barista", "tous"), ("salle", "affluence")],
    "paris-quartier": [("salle", "tous"), ("salle", "tous"), ("barista", "tous"), ("plonge", "tous"),
                       ("commis", "tous"), ("salle", "affluence"), ("barista", "affluence")],
    "paris-maison": [("salle", "tous"), ("salle", "tous"), ("salle", "tous"), ("barista", "tous"), ("plonge", "tous"),
                     ("barista", "tous"), ("commis", "tous"), ("patisserie", "tous"), ("salle", "affluence"),
                     ("salle", "affluence"), ("commis", "affluence")],
}
EMBAUCHE = {"perteSeuil": 0.12, "joursObserves": 3, "reserveSalaires": 5}

# Conditions de départ (règles PR-01 à PR-06): l'offre de l'adresse suivante arrive à une renommée; le défi
# local demande une réputation et l'extension où il se tient; on déménage le lundi, l'épargne réunie.
DEFI: dict[str, tuple[str, str, str]] = {
    "village": ("La fête du Tilleul", "village_terrasse", "dimanche"),
    "bourg": ("La foire de la halle", "bourg_terrasse", "jeudi"),
    "ville": ("Le grand brunch de l'atelier", "ville_salle2", "dimanche"),
    "paris-quartier": ("Le vide-grenier de la rue", "pq_trottoir", "dimanche"),
}
DEFI_AFFLUENCE = 1.6
FIN = {"tasses": 4.5, "achats": ("labo", "torrefaction", "pm_verriere", "pm_etage")}
RENOMMEE_FIN = 25000

# Temps réel hors service (minutes): prologue, arrivée à une adresse, défi, fin.
SCENES = {"prologue": 6.0, "arrivee": 3.0, "defi": 2.0, "fin": 6.0}
