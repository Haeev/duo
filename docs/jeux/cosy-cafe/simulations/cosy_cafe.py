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
   adresse et jusqu'à la fête de la maison, épargne, condition qui bloque chaque départ. Chaque
   journée ouverte de chaque duo est jouée client par client (point 2): aucun modèle simplifié.

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


def dec(x: float, d: int = 3) -> str:
    """Nombre sans zéros inutiles: 1,075; 1,3; 1."""
    t = fr(x, d)
    return t.rstrip("0").rstrip(",") if "," in t else t


def mult(x: float) -> str:
    return "x" + dec(x, 2)


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
    Adresse("bourg", "Mérelles, la boutique de la place de la Halle", 81, 7.5, 19.0, 1.10, 1.00, 1150, 16, 600,
            500, 3.5, 2.0, 12, ("jeudi",), (0, 11, 0, 0), (0, 13, 0, 0), 70, 2.6, 2.0, 500, 4, 48),
    Adresse("ville", "Montaurel, l'Imprimerie", 165, 8.0, 20.0, 1.30, 1.05, 2900, 34, 1200,
            2200, 4.0, 2.5, 16, ("samedi",), (9, 11, 3, 4), (9, 11, 3, 4), 120, 3.2, 2.4, 1000, 6, 72),
    Adresse("paris-quartier", "Paris, le café de l'angle des Plumassiers", 96, 7.5, 20.5, 1.80, 1.15, 6500, 60, 2500,
            4500, 4.0, 3.0, 16, ("mardi", "vendredi"), (4, 14, 0, 6), (4, 14, 0, 6), 160, 2.8, 2.2, 1800, 8, 80),
    Adresse("paris-maison", "Paris, la Graineterie du boulevard des Horticulteurs", 300, 8.0, 21.0, 2.00, 1.20, 15000,
            140, 3000, 10000, 4.5, 3.5, 20, ("dimanche",), (5, 28, 8, 12), (5, 28, 8, 12), 260, 3.6, 2.6, 1200, 8, 120),
]
ADR: dict[str, Adresse] = {a.id: a for a in ADRESSES}
ORDRE_ADRESSES = [a.id for a in ADRESSES]

# Extensions: (adresse, identifiant, nom, coût, places ajoutées (comptoir, tables, confort, terrasse),
#              ambiance ajoutée, raison)
EXTENSIONS: list[tuple[str, str, str, int, tuple[int, int, int, int], int, str]] = [
    ("village", "village_terrasse", "E1, la terrasse sous le store", 450, (0, 0, 0, 4), 3,
     "autorisation de la mairie et deux tables sous le store: la place du Tilleul est la richesse du village"),
    ("village", "village_fond", "E2, la pièce du fond, au coin du feu", 900, (0, 2, 2, 0), 4,
     "la pièce fermée derrière la salle, rouverte avec sa cheminée"),
    ("bourg", "bourg_terrasse", "E1, la terrasse de la halle", 800, (0, 0, 0, 10), 3,
     "sous le store, face à la halle: le jeudi, le marché passe devant"),
    ("bourg", "bourg_remise", "E2, la salle de la remise", 1800, (0, 8, 0, 0), 5,
     "la remise débarrassée, avec sa grande table de ferme"),
    ("bourg", "bourg_cour", "E3, la cour sous la treille", 1400, (0, 0, 0, 8), 4,
     "la cour derrière la boutique, à l'ombre de la treille"),
    ("ville", "ville_atelier", "E1, l'atelier entier", 2500, (0, 8, 4, 0), 5,
     "les presses rangées, l'atelier sous ses sheds s'ouvre en entier"),
    ("ville", "ville_cuisine", "E2, la cuisine du brunch", 2000, (0, 0, 0, 0), 2,
     "la salle de composition devenue cuisine: le brunch a besoin de ses feux"),
    ("ville", "ville_cour", "E3, la cour sous la glycine", 2000, (0, 0, 0, 6), 4,
     "la cour de l'imprimerie, à l'abri de la rue des Facultés"),
    ("paris-quartier", "pq_fond", "E1, la salle du fond", 6000, (3, 5, 3, 0), 5,
     "la cordonnerie voisine rachetée et ouverte sur le café (96 m² en tout)"),
    ("paris-quartier", "pq_terrasse", "E2, la terrasse sur les deux rues", 5000, (0, 0, 0, 10), 3,
     "l'angle donne sur deux rues: la mairie d'arrondissement autorise la rue des Coudriers"),
    ("paris-maison", "pm_torrefaction", "E1, la torréfaction", 4000, (4, 0, 0, 0), 5,
     "le torréfacteur sous la verrière, et son comptoir de dégustation"),
    ("paris-maison", "pm_labo", "E2, le laboratoire de pâtisserie", 4000, (0, 0, 0, 0), 2,
     "le laboratoire vide du graineur, équipé d'un four à soles"),
    ("paris-maison", "pm_salons", "E3, les salons de l'étage", 8000, (0, 11, 6, 0), 6,
     "le grand et le petit salon, fermés depuis des années, par l'escalier de la maison (second niveau, C17)"),
    ("paris-maison", "pm_jardin", "E4, le jardin et sa serre", 6000, (0, 0, 2, 12), 6,
     "le jardin en friche derrière la halle, et sa serre où l'on s'assoit par tous les temps"),
]
# Ce qu'une extension apporte en plus de ses places, une fois construite.
EXTENSION_APPORTS: dict[str, tuple[tuple[str, ...], tuple[tuple[str, int], ...]]] = {
    "ville_cuisine": (("brunch",), ()),
    "pm_torrefaction": (("notre_melange",), ()),
    "pm_labo": (("entremets",), (("four", 3),)),
}

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
                     "promeneurs": 14, "etudiants": 8, "teletravail": 16, "brunch": 8, "connaisseurs": 16},
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
FACTEUR_TASSES = {1.0: 0.70, 1.5: 0.775, 2.0: 0.85, 2.5: 0.925, 3.0: 1.0, 3.5: 1.075, 4.0: 1.15,
                  4.5: 1.225, 5.0: 1.30}
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
REPUTATION_PAS: dict[str, int] = {"village": 150, "bourg": 130, "ville": 300, "paris-quartier": 700,
                                  "paris-maison": 1400}
RATTRAPAGE = {"apres": 12, "parJour": 0.05, "plafond": 2.0}  # jours ouverts à l'adresse, +5 % par jour au-delà
RENOMMEE_PAR_POINT = 1  # la renommée de la maison est la somme des points de tous ses cafés
RENOMMEE_DEFI = {"village": 150, "bourg": 300, "ville": 600, "paris-quartier": 1000}
# Prix en salle (service à table, dès le bourg): +20 % sur le prix au comptoir, à la française.
PRIX_SALLE = 1.20
POURBOIRE = {"seuil": 75, "taux": 0.05, "tauxRavi": 0.10, "seuilRavi": 88, "probabilite": 0.5}
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
            2.40, 0.30, 0, 1, "bourg", "René, lien 1", ""),
    Recette("cookie", "Cookie", "patisserie", (E("vitrine", (1.2, 1.2, 1.0)),), False,
            2.20, 0.30, 0, 1, "ville", "Thao, lien 1", ""),
    Recette("cannele", "Cannelé", "patisserie", (E("vitrine", (1.2, 1.2, 1.0)),), False,
            2.20, 0.35, 0, 1, "ville", "fiche, 50 €", ""),
    Recette("eclair", "Éclair au café", "patisserie", (E("vitrine", (1.5, 1.5, 1.2)),), False,
            4.00, 0.70, 0, 1, "paris-quartier", "employé pâtissier", ""),
    Recette("tarte_citron", "Tarte au citron meringuée", "patisserie", (E("vitrine", (2.0, 2.0, 1.5)),), False,
            4.20, 0.75, 0, 1, "paris-quartier", "fiche, 80 €", ""),
    Recette("entremets", "Le gâteau de la maison", "patisserie", (E("vitrine", (2.5, 2.0, 2.0)),), False,
            6.00, 1.20, 0, 1, "paris-maison", "E2, le laboratoire", ""),
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
            False, 19.00, 5.00, 0, 4, "ville", "E2, la cuisine du brunch", ""),
    # Café de spécialité
    Recette("filtre", "Café filtre de spécialité", "specialite", (E("douce", (9.0, 6.0, 4.0), (15, 15, 12), (1, 1, 1)),),
            False, 3.80, 0.80, 0, 1, "ville", "Aïcha, lien 1", ""),
    Recette("espresso_origine", "Espresso d'origine", "specialite", (SHOT_LONG,), False, 2.60, 0.50, 0, 1,
            "ville", "bar à méthodes douces", ""),
    Recette("notre_melange", "Notre mélange", "specialite", (SHOT_LONG,), False, 3.00, 0.45, 0, 1,
            "paris-maison", "E1, la torréfaction", ""),
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
VITESSE_EMPLOYE = {1: 1.0, 2: 1.2, 3: 1.35}
JOURS_NIVEAU_EMPLOYE = (0, 8, 24)  # jours travaillés pour les niveaux 1, 2, 3

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
            self.travailleurs.append(Travailleur(f"{role}{k + 1}", role, VITESSE_EMPLOYE[niv], 0.2, 0.15 + 0.1 * niv,
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
            "presents_max": self.max_presents + len(self.travailleurs),
            "presents_95": rel[int(0.95 * (len(rel) - 1))] + len(self.travailleurs),
            "recette": self.recette_jour,
            "cout": self.cout_jour,
            "pourboires": self.pourboires,
            "personnel": len(self.travailleurs),
            "complets": self.complets / n if n else 0.0,
            "depassement": max(0.0, self.dernier_service - self.fin),
            "clients_max": max(self.releves) if self.releves else 0,
        }

    def par_heure(self) -> list[dict[str, float]]:
        """Arrivées, servis, repartis, attente moyenne et présents au plus, par créneau d'une heure de jeu."""
        out = []
        n = len(self.par_heure_arrivees)
        pas = 60 * self.spm / 5.0
        for i in range(n):
            rel = self.releves[int(i * pas):int((i + 1) * pas)] or [0]
            att = self.attente_par_heure[i]
            out.append({"arrivees": self.par_heure_arrivees[i], "servis": self.par_heure_servis[i],
                        "repartis": self.par_heure_repartis[i], "attente": statistics.fmean(att) if att else 0.0,
                        "presents": max(rel) + len(self.travailleurs)})
        return out


# ---------------------------------------------------------------------------
# 11. Catalogue d'achats, équipement de départ (cahier, sections 4.15 et 6.2)
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
    ("village", "village_terrasse", "E1, la terrasse sous le store", 450, "ext:village_terrasse", 15, 15),
    ("village", "village_fond", "E2, la pièce du fond, au coin du feu", 900, "ext:village_fond", 16, 16),
    ("village", "bouilloire", "Bouilloire à température", 90, "poste:bouilloire:2", 17, 17),
    ("bourg", "four", "Four de pâtissier d'occasion", 700, "poste:four:1", 1, 1),
    ("bourg", "lave", "Lave-vaisselle d'occasion", 900, "plonge:2", 2, 2),
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
    ("bourg", "bourg_terrasse", "E1, la terrasse de la halle", 800, "ext:bourg_terrasse", 13, 12),
    ("bourg", "bourg_remise", "E2, la salle de la remise", 1800, "ext:bourg_remise;equip:grande_table", 14, 14),
    ("bourg", "bourg_cour", "E3, la cour sous la treille", 1400, "ext:bourg_cour", 16, 16),
    ("bourg", "vaisselle", "Service de vaisselle (+24 pièces)", 160, "vaisselle:24", 15, 15),
    ("ville", "trois_groupes", "Machine à trois groupes d'occasion, arrêt programmé", 3800, "poste:espresso:3", 1, 1),
    ("ville", "buse_auto", "Buses automatiques", 1200, "poste:vapeur:3", 5, 2),
    ("ville", "capot", "Lave-vaisselle à capot", 2800, "plonge:3", 7, 4),
    ("ville", "blender", "Blender", 300, "poste:blender:1", 2, 3),
    ("ville", "douce", "Bar à méthodes douces et moulin de spécialité", 2400, "poste:douce:1;equip:moulin_specialite", 3, 5),
    ("ville", "grande_table", "Grande table d'atelier", 900, "equip:grande_table", 4, 6),
    ("ville", "fiches_ville", "Fiches de la ville (latte, milk-shake, cannelé, tartine avocat-œuf)", 210,
     "recette:latte;recette:milkshake;recette:cannele;recette:tartine_avocat", 6, 7),
    ("ville", "four2", "Four ventilé", 3500, "poste:four:2", 9, 9),
    ("ville", "tables", "Deux fauteuils (à la place de deux chaises)", 380, "places:0,-2,2,0;equip:fauteuils", 8, 8),
    ("ville", "ville_cuisine", "E2, la cuisine du brunch", 2000, "ext:ville_cuisine", 10, 10),
    ("ville", "ville_atelier", "E1, l'atelier entier", 2500, "ext:ville_atelier", 11, 11),
    ("ville", "ville_cour", "E3, la cour sous la glycine", 2000, "ext:ville_cour", 12, 12),
    ("paris-quartier", "trois_groupes", "Machine à trois groupes, arrêt programmé", 6500, "poste:espresso:3", 1, 1),
    ("paris-quartier", "buse_auto", "Buses automatiques", 1200, "poste:vapeur:3", 2, 2),
    ("paris-quartier", "caisse2", "Second terminal de paiement", 600, "caisse:2", 3, 3),
    ("paris-quartier", "capot", "Lave-vaisselle à capot", 4200, "plonge:3", 4, 4),
    ("paris-quartier", "blender", "Blender", 300, "poste:blender:1", 5, 5),
    ("paris-quartier", "douce", "Bar à méthodes douces et moulin de spécialité", 3200,
     "poste:douce:1;equip:moulin_specialite", 6, 6),
    ("paris-quartier", "fiche_citron", "Fiche « tarte au citron meringuée »", 80, "recette:tarte_citron", 7, 8),
    ("paris-quartier", "tables", "Une banquette (à la place de trois chaises)", 600, "places:0,-3,3,0", 8, 7),
    ("paris-quartier", "pq_terrasse", "E2, la terrasse sur les deux rues", 5000, "ext:pq_terrasse", 9, 9),
    ("paris-quartier", "pq_fond", "E1, la salle du fond", 6000, "ext:pq_fond", 10, 10),
    ("paris-maison", "buse_auto", "Buses automatiques", 1200, "poste:vapeur:3", 1, 1),
    ("paris-maison", "douce", "Bar à méthodes douces et moulin de spécialité", 3200,
     "poste:douce:1;equip:moulin_specialite", 2, 2),
    ("paris-maison", "blender", "Blender", 300, "poste:blender:1", 3, 3),
    ("paris-maison", "tables", "Deux banquettes de halle (à la place de quatre chaises)", 1200, "places:0,-4,4,0", 4, 4),
    ("paris-maison", "pm_torrefaction", "E1, la torréfaction", 4000, "ext:pm_torrefaction", 5, 6),
    ("paris-maison", "pm_labo", "E2, le laboratoire de pâtisserie", 4000, "ext:pm_labo", 6, 7),
    ("paris-maison", "pm_salons", "E3, les salons de l'étage", 8000, "ext:pm_salons", 7, 5),
    ("paris-maison", "pm_jardin", "E4, le jardin et sa serre", 6000, "ext:pm_jardin", 8, 8),
]
AMBIANCE_HAUSSE = 1.2  # chaque palier de +10 d'ambiance coûte 20 % de plus que le précédent
AMBIANCE_DEPART = {"village": 30, "bourg": 25, "ville": 30, "paris-quartier": 35, "paris-maison": 35}
AMBIANCE_MAX = 95
# Un palier d'ambiance après tant d'achats du catalogue (duo lent, médian, rapide).
AMBIANCE_RYTHME = {"lent": 1, "median": 2, "rapide": 4}

# Équipe visée par adresse, dans l'ordre d'embauche. « affluence »: seulement les jours de marché et le
# week-end (renfort payé à ces seuls jours).
EQUIPE: dict[str, list[tuple[str, str]]] = {
    "village": [],
    "bourg": [("commis", "affluence")],
    "ville": [("salle", "tous"), ("plonge", "tous"), ("barista", "tous"), ("salle", "affluence"), ("commis", "tous")],
    "paris-quartier": [("salle", "tous"), ("salle", "tous"), ("barista", "tous"), ("plonge", "tous"),
                       ("commis", "tous"), ("salle", "affluence"), ("barista", "affluence")],
    "paris-maison": [("salle", "tous"), ("salle", "tous"), ("salle", "tous"), ("barista", "tous"), ("plonge", "tous"),
                     ("barista", "tous"), ("commis", "tous"), ("patisserie", "tous"), ("salle", "affluence"),
                     ("salle", "affluence")],
}
EMBAUCHE = {"perteSeuil": 0.12, "joursObserves": 3, "reserveSalaires": 5}
# Employés repris avec le café (les premiers du plan): aucun avant Paris.
EQUIPE_REPRISE = {"village": 0, "bourg": 0, "ville": 0, "paris-quartier": 4, "paris-maison": 6}

# Conditions de départ (règles PR-01 à PR-06): l'offre de l'adresse suivante arrive à une renommée; le défi
# local demande une réputation et l'extension où il se tient; on déménage le lundi, l'épargne réunie.
DEFI: dict[str, tuple[str, str, str]] = {
    "village": ("La fête du Tilleul", "village_terrasse", "dimanche"),
    "bourg": ("La foire de la halle", "bourg_terrasse", "jeudi"),
    "ville": ("Le grand brunch de l'Imprimerie", "ville_cuisine", "dimanche"),
    "paris-quartier": ("Le vide-grenier de la rue des Plumassiers", "pq_terrasse", "dimanche"),
}
DEFI_AFFLUENCE = 1.6
FIN = {"tasses": 4.5, "achats": ("pm_torrefaction", "pm_labo", "pm_salons", "pm_jardin")}
RENOMMEE_FIN = 25000

# Temps réel hors service (minutes): prologue, arrivée à une adresse, défi, fin.
SCENES = {"prologue": 6.0, "arrivee": 3.0, "defi": 2.0, "fin": 6.0}

# Recettes apprises d'un habitué: (adresse, recette, jours ouverts passés à l'adresse).
HABITUE_RECETTES: list[tuple[str, str, int]] = [
    ("village", "noisette", 1), ("village", "infusion", 4), ("village", "citronnade", 6),
    ("bourg", "chausson", 4), ("bourg", "madeleines", 4), ("bourg", "pain_raisins", 8),
    ("ville", "filtre", 4), ("ville", "cookie", 4), ("ville", "chai", 8), ("ville", "flat_white", 8),
]
# Recettes qu'une machine apporte avec elle.
RECETTES_MACHINE = {"agrumes": "jus_orange", "creperie": "crepe", "gaufrier": "gaufre", "blender": "smoothie",
                    "four": "croque", "douce": "espresso_origine"}

# ---------------------------------------------------------------------------
# 12. Progression d'un duo (Monte-Carlo, une journée ouverte = une simulation client par client)
# ---------------------------------------------------------------------------


@dataclass
class Cafe:
    adresse: str
    niveaux: dict[str, int]
    plonge: int
    caisses: int
    places: list[int]
    vaisselle: int
    equipements: set[str]
    ambiance: float
    tasses: float
    extensions: set[str] = field(default_factory=set)
    achats: set[str] = field(default_factory=set)
    travaux: list[str] = field(default_factory=list)
    paliers: int = 0
    points: float = 0.0
    sat_hier: float = 70.0
    service_table: bool = False
    employes: list[list] = field(default_factory=list)  # [rôle, jours, jours travaillés]
    pertes: list[float] = field(default_factory=list)
    nets: list[float] = field(default_factory=list)
    pts: list[float] = field(default_factory=list)
    jours_ouverts: int = 0
    achats_faits: int = 0


def nouveau_cafe(adr_id: str) -> Cafe:
    a = ADR[adr_id]
    d = DEPART[adr_id]
    niveaux = dict(d["niveaux"])  # type: ignore[arg-type]
    c = Cafe(adr_id, niveaux, int(d["plonge"]), int(d["caisses"]), list(a.places_depart), a.vaisselle,  # type: ignore[arg-type]
             set(d["equipements"]), float(AMBIANCE_DEPART[adr_id]), a.tasses_depart)  # type: ignore[arg-type]
    # Règle EM-02: à Paris, le café se reprend avec une partie de son équipe (déjà au niveau 2).
    for role, jours in EQUIPE[adr_id][:EQUIPE_REPRISE[adr_id]]:
        c.employes.append([role, jours, JOURS_NIVEAU_EMPLOYE[1]])
    c.service_table = adr_id not in ("village", "bourg")
    return c


def tasses_de(c: Cafe) -> float:
    a = ADR[c.adresse]
    pas = REPUTATION_PAS[c.adresse]
    k = 0
    while pas * (k + 1) * (k + 2) / 2 <= c.points and a.tasses_depart + 0.5 * (k + 1) <= 5.0:
        k += 1
    return a.tasses_depart + 0.5 * k


def seuil_points(adr_id: str, tasses: float) -> float:
    k = round((tasses - ADR[adr_id].tasses_depart) * 2)
    return REPUTATION_PAS[adr_id] * k * (k + 1) / 2 if k > 0 else 0.0


def recettes_possibles(c: Cafe, connues: set[str], saison: int) -> list[str]:
    out = []
    for r in RECETTES:
        if r.id not in connues:
            continue
        if r.saison and SAISONS.index(r.saison) != saison:
            continue
        if any(e.poste not in c.niveaux for e in r.etapes):
            continue
        out.append(r.id)
    return out


def choisir_carte(c: Cafe, connues: set[str], saison: int) -> list[str]:
    """Règle AT-02: la tablette propose l'ardoise qui attire le plus de monde (le duo simulé la suit)."""
    a = ADR[c.adresse]
    possibles = recettes_possibles(c, connues, saison)
    base = FLUX_BASE[c.adresse]
    carte: list[str] = []

    def valeur(cc: list[str]) -> float:
        fam = familles_de(cc)
        return sum(base[p] * facteur_carte(points_carte(p, fam)) for p in ORDRE_PROFILS)

    v0 = valeur(carte)
    while len(carte) < a.lignes_ardoise and possibles:
        best, best_v = None, -1.0
        for rid in possibles:
            v = valeur(carte + [rid]) - v0 + REC[rid].prix * 0.01
            if v > best_v:
                best, best_v = rid, v
        if best is None:
            break
        carte.append(best)
        possibles.remove(best)
        v0 = valeur(carte)
    return carte


def jour_affluence(adr: Adresse, js: int) -> bool:
    return JOURS[js] in adr.marche or js >= 5


@dataclass
class Duree:
    jour: int
    minutes: float


@dataclass
class Partie:
    duo: Duo
    rng: random.Random
    jour: int = 0
    adresse: str = "village"
    caisse: float = 300.0
    epargne: float = 0.0
    report: float = 0.0
    renommee: float = 0.0
    minutes: float = 0.0
    cafes: dict[str, Cafe] = field(default_factory=dict)
    connues: set[str] = field(default_factory=set)
    offres: set[str] = field(default_factory=set)
    defis: set[str] = field(default_factory=set)
    defi_jour: dict[str, int] = field(default_factory=dict)
    demenagement: str = ""
    arrivees: dict[str, Duree] = field(default_factory=dict)
    offres_jour: dict[str, int] = field(default_factory=dict)
    defis_faits_jour: dict[str, int] = field(default_factory=dict)
    epargne_jour: dict[str, int] = field(default_factory=dict)
    fin: Duree | None = None
    guide_jour: int = 0
    journal: list[dict] = field(default_factory=list)
    derniere_config: dict[str, tuple[Config, int, int, str]] = field(default_factory=dict)
    ext_jour: dict[str, int] = field(default_factory=dict)
    report_max: float = 0.0
    caisse_depart: dict[str, float] = field(default_factory=dict)


CAISSE_DEPART = 300.0  # l'argent que Simone laisse dans la caisse « pour la monnaie et le premier lait »


def charges_fixes(c: Cafe, js: int) -> float:
    a = ADR[c.adresse]
    sal = 0.0
    paris = SALAIRE_PARIS if c.adresse.startswith("paris") else 1.0
    for role, jours, _ in c.employes:
        if jours == "tous" or jour_affluence(a, js):
            sal += SALAIRE[role] * paris
    return a.loyer_mois / REG["joursParSaison"] + a.charges_jour + sal


def appliquer(p: Partie, c: Cafe, effet: str) -> None:
    for part in effet.split(";"):
        k, _, v = part.partition(":")
        if k == "poste":
            poste, n = v.split(":")
            c.niveaux[poste] = max(c.niveaux.get(poste, 0), int(n))
            if poste in RECETTES_MACHINE:
                p.connues.add(RECETTES_MACHINE[poste])
        elif k == "plonge":
            c.plonge = max(c.plonge, int(v))
        elif k == "places":
            d = [int(x) for x in v.split(",")]
            c.places = [x + y for x, y in zip(c.places, d)]
        elif k == "ext":
            c.travaux.append(v)
        elif k == "equip":
            c.equipements.add(v)
        elif k == "recette":
            p.connues.add(v)
        elif k == "vaisselle":
            c.vaisselle += int(v)
        elif k == "caisse":
            c.caisses = max(c.caisses, int(v))
        elif k == "salle":
            c.service_table = True


def liste_achats(adr_id: str, duo: Duo) -> list[tuple[str, str, str, int, str, int, int]]:
    items = [x for x in ACHATS if x[0] == adr_id]
    cle = 6 if duo.priorite_capacite else 5
    return sorted(items, key=lambda x: x[cle])


def prix_palier(c: Cafe) -> float:
    return ADR[c.adresse].pas_ambiance * AMBIANCE_HAUSSE ** c.paliers


def acheter(p: Partie, c: Cafe, js: int) -> None:
    reserve = REG["reserveCharges"] * charges_fixes(c, js)
    liste = liste_achats(c.adresse, p.duo)
    rythme = AMBIANCE_RYTHME[p.duo.id]
    defi = DEFI.get(c.adresse)
    while True:
        restants = [x for x in liste if x[1] not in c.achats]
        # Règle PR-03: dès que l'offre de l'adresse suivante est arrivée, l'extension du défi passe en tête.
        if defi and adresse_suivante(c.adresse) in p.offres:
            restants.sort(key=lambda x: x[1] != defi[1])
        palier_du = c.ambiance < AMBIANCE_MAX and (not restants or c.achats_faits >= rythme * (c.paliers + 1))
        if palier_du:
            prix = prix_palier(c)
            if p.caisse - reserve < prix:
                return
            p.caisse -= prix
            c.paliers += 1
            c.ambiance = min(AMBIANCE_MAX, c.ambiance + 10)
            continue
        if not restants:
            return
        x = restants[0]
        if p.caisse - reserve < x[3]:
            return
        p.caisse -= x[3]
        c.achats.add(x[1])
        c.achats_faits += 1
        appliquer(p, c, x[4])


def embaucher(p: Partie, c: Cafe, js: int) -> None:
    plan = EQUIPE[c.adresse]
    if len(c.employes) >= len(plan) or len(c.pertes) < EMBAUCHE["joursObserves"]:
        return
    if statistics.fmean(c.pertes[-int(EMBAUCHE["joursObserves"]):]) < EMBAUCHE["perteSeuil"]:
        return
    role, jours = plan[len(c.employes)]
    paris = SALAIRE_PARIS if c.adresse.startswith("paris") else 1.0
    if p.caisse < EMBAUCHE["reserveSalaires"] * SALAIRE[role] * paris + REG["reserveCharges"] * charges_fixes(c, js):
        return
    c.employes.append([role, jours, 0])
    c.pertes.clear()
    if role == "patisserie":
        p.connues.add("eclair")


def niveau_employe(jours: int) -> int:
    return 3 if jours >= JOURS_NIVEAU_EMPLOYE[2] else 2 if jours >= JOURS_NIVEAU_EMPLOYE[1] else 1


def adresse_suivante(adr_id: str) -> str:
    i = ORDRE_ADRESSES.index(adr_id)
    return ORDRE_ADRESSES[i + 1] if i + 1 < len(ORDRE_ADRESSES) else ""


def coherence_de(c: Cafe) -> float:
    return min(0.9, 0.4 + 0.1 * c.paliers)


def jouer_partie(duo: Duo, graine: int, jours_max: int = 260, depart: str = "village", demenager: bool = True,
                 caisse: float = CAISSE_DEPART) -> Partie:
    """Une partie, du village à la fête de la maison. `depart` et `demenager` servent aux sondes d'une adresse."""
    rng = random.Random(graine)
    p = Partie(duo, rng, caisse=caisse)
    p.adresse = depart
    p.cafes[depart] = nouveau_cafe(depart)
    rang = ORDRE_ADRESSES.index(depart)
    p.connues = {r.id for r in RECETTES if r.deblocage.startswith("départ")}
    p.connues |= {r.id for r in RECETTES if ORDRE_ADRESSES.index(r.adresse) < rang and not r.saison}
    p.arrivees[depart] = Duree(1, 0.0)
    style = {"village": "campagne", "bourg": "campagne", "ville": "atelier", "paris-quartier": "bistrot",
             "paris-maison": "retro"}
    for d in range(1, jours_max + 1):
        p.jour = d
        js = (d - 1) % 7
        saison = ((d - 1) // REG["joursParSaison"]) % 4
        c = p.cafes[p.adresse]
        a = ADR[p.adresse]
        if js == 0:  # lundi: fermeture
            p.minutes += duo.lundi + (SCENES["prologue"] if d == 1 else 0.0)
            for ext in c.travaux:
                for x in EXTENSIONS:
                    if x[1] == ext:
                        c.places = [u + v for u, v in zip(c.places, x[4])]
                        c.ambiance = min(AMBIANCE_MAX, c.ambiance + x[5])
                        c.extensions.add(ext)
                        p.ext_jour[ext] = d
                        recettes, postes = EXTENSION_APPORTS.get(ext, ((), ()))
                        p.connues |= set(recettes)
                        for poste, n in postes:
                            c.niveaux[poste] = max(c.niveaux.get(poste, 0), n)
            c.travaux.clear()
            p.caisse -= a.loyer_mois / REG["joursParSaison"]
            if p.guide_jour and d > p.guide_jour:
                p.minutes += SCENES["fin"]
                p.fin = Duree(d, p.minutes)
                break
            if p.demenagement:
                nxt = p.demenagement
                p.demenagement = ""
                p.cafes[nxt] = nouveau_cafe(nxt)
                p.caisse_depart[nxt] = p.caisse
                p.adresse = nxt
                p.arrivees[nxt] = Duree(d, p.minutes)
                p.minutes += SCENES["arrivee"]
            continue
        # habitués et saisons
        for adr_h, rid, n in HABITUE_RECETTES:
            if adr_h == p.adresse and c.jours_ouverts >= n - 1:
                p.connues.add(rid)
        for r in RECETTES:
            if r.saison and SAISONS.index(r.saison) == saison and ORDRE_ADRESSES.index(r.adresse) <= ORDRE_ADRESSES.index(p.adresse):
                p.connues.add(r.id)
        carte = choisir_carte(c, p.connues, saison)
        meteo = tirer_meteo(rng, saison)
        defi = p.defi_jour.get(p.adresse) == d
        etat = Etat(carte, 1.0, c.ambiance, style[p.adresse], coherence_de(c), set(c.equipements), c.tasses, c.sat_hier,
                    duo.affluence * (DEFI_AFFLUENCE if defi else 1.0))
        employes = [(r, niveau_employe(n)) for r, j, n in c.employes if j == "tous" or jour_affluence(a, js)]
        cfg = Config(p.adresse, dict(c.niveaux), c.plonge, c.service_table, tuple(c.places), c.vaisselle, employes, etat,
                     c.caisses)
        p.derniere_config[p.adresse] = (cfg, js, saison, meteo)
        s = Service(cfg, duo, rng, js, saison, meteo)
        s.run(demande(a, etat, js, saison, meteo))
        b = s.bilan()
        for e in c.employes:
            if e[1] == "tous" or jour_affluence(a, js):
                e[2] += 1
        fixes = charges_fixes(c, js)
        net = b["recette"] + b["pourboires"] - b["cout"] - fixes
        pts = sum(max(0.0, (x - REPUTATION_PIVOT) / REPUTATION_DIVISEUR) for x in s.satisfactions)
        # Règle RE-05: rattrapage, le bouche-à-oreille des habitués après deux semaines à une adresse.
        au_dela = c.jours_ouverts + 1 - RATTRAPAGE["apres"]
        if au_dela > 0:
            pts *= min(RATTRAPAGE["plafond"], 1 + RATTRAPAGE["parJour"] * au_dela)
        c.points += pts
        c.tasses = tasses_de(c)
        c.sat_hier = b["satisfaction"] if s.satisfactions else c.sat_hier
        c.pertes.append(b["repartis"] - b["complets"])  # l'attente fait embaucher, pas un café complet
        c.nets = (c.nets + [net])[-7:]
        c.pts = (c.pts + [pts])[-7:]
        c.jours_ouverts += 1
        p.renommee += pts
        # succursales (règle SU-02): une part du résultat moyen des sept dernières journées jouées
        succ_jour = 0.0
        for autre, cs in p.cafes.items():
            if autre == p.adresse or not cs.nets:
                continue
            gain = max(0.0, REG["partSuccursale"] * statistics.fmean(cs.nets))
            succ_jour += gain
            p.caisse += gain
            p.renommee += REG["partSuccursale"] * statistics.fmean(cs.pts)
        # épargne pour l'adresse suivante (règle EC-08), une fois l'extension du défi payée
        nxt = adresse_suivante(p.adresse)
        defi_paye = p.adresse not in DEFI or DEFI[p.adresse][1] in c.achats
        mise_jour = 0.0
        if nxt and nxt in p.offres and net > 0 and not p.demenagement and defi_paye:
            mise_jour = min(net * duo.epargne, max(0.0, ADR[nxt].installation - p.epargne))
            p.epargne += mise_jour
        p.caisse += net - mise_jour
        if p.caisse < 0:  # règle EC-06: jamais de faillite, le propriétaire et les fournisseurs attendent
            p.report += -p.caisse
            p.caisse = 0.0
            p.report_max = max(p.report_max, p.report)
        elif p.report > 0:
            r = min(p.report, p.caisse)
            p.report -= r
            p.caisse -= r
        minutes_service = (a.fermeture - a.ouverture) * REG["secondesParMinute"] + b["depassement"] / 60
        p.minutes += duo.preparation + minutes_service + duo.fermeture + (SCENES["defi"] if defi else 0.0)
        p.journal.append({"jour": d, "adresse": ORDRE_ADRESSES.index(p.adresse), "servis": b["servis"],
                          "arrives": b["arrives"], "personnes": b["personnes"],
                          "repartis": b["repartis"], "satisfaction": b["satisfaction"], "net": net, "mise": mise_jour,
                          "recette": b["recette"], "cout": b["cout"], "pourboires": b["pourboires"], "fixes": fixes,
                          "loyer": a.loyer_mois / REG["joursParSaison"], "salaires": fixes - a.loyer_mois / REG["joursParSaison"] - a.charges_jour,
                          "presents": b["presents_max"], "tasses": c.tasses, "succursales": succ_jour,
                          "caisse": p.caisse, "epargne": p.epargne, "renommee": p.renommee,
                          "personnel": b["personnel"], "minutes": p.minutes, "attente": b["attente"],
                          "attente90": b["attente90"], "charge": b["charge"], "js": js, "ouverts": c.jours_ouverts,
                          "depassement": b["depassement"], "meteo": METEOS.index(meteo), "heures": s.par_heure(),
                          "defi": defi})
        if defi:
            p.defis.add(p.adresse)
            p.defis_faits_jour[p.adresse] = d
            p.renommee += RENOMMEE_DEFI[p.adresse]
        # achats et embauches à la fermeture
        if p.report <= 0:
            acheter(p, c, js)
            embaucher(p, c, js)
        # offres, défi, déménagement, fin
        if nxt and nxt not in p.offres and p.renommee >= ADR[nxt].renommee_offre:
            p.offres.add(nxt)
            p.offres_jour[nxt] = d
        if p.adresse in DEFI and p.adresse not in p.defis and p.adresse not in p.defi_jour:
            nom, ext, jour_defi = DEFI[p.adresse]
            if c.tasses >= a.tasses_defi and ext in c.extensions:
                cible = JOURS.index(jour_defi)
                k = d + 1
                while (k - 1) % 7 != cible:
                    k += 1
                p.defi_jour[p.adresse] = k
        if demenager and nxt and nxt in p.offres and p.adresse in p.defis and not p.demenagement \
                and p.epargne >= ADR[nxt].installation - 1e-6:
            p.epargne_jour[nxt] = d
            p.epargne -= ADR[nxt].installation
            p.caisse += p.epargne
            p.epargne = 0.0
            p.demenagement = nxt
        if p.adresse == "paris-maison" and not p.guide_jour:
            if c.tasses >= FIN["tasses"] and not c.travaux and all(x in c.extensions for x in FIN["achats"]):
                k = d
                while (k - 1) % 7 != 6:
                    k += 1
                p.guide_jour = k  # le guide passe dans la semaine; la fête a lieu le lundi qui suit
    return p


# ---------------------------------------------------------------------------
# 13. Tables du cahier (rendues depuis les données) et résultats
# ---------------------------------------------------------------------------


def tableau(entetes: list[str], lignes: list[list[str]]) -> list[str]:
    out = ["| " + " | ".join(entetes) + " |", "|" + "|".join("---" for _ in entetes) + "|"]
    for l in lignes:
        out.append("| " + " | ".join(l) + " |")
    return out


def nom_adresse(a: str) -> str:
    return {"village": "village", "bourg": "bourg", "ville": "ville", "paris-quartier": "Paris, quartier",
            "paris-maison": "Paris, maison"}[a]


def t_reglages() -> list[str]:
    def v(x: float) -> str:
        return fr(x, 2).rstrip("0").rstrip(",") if x != int(x) else fr(x)
    return tableau(["Clé", "Paramètre", "Valeur", "Unité", "Plage", "Raison"],
                   [[f"`{k}`", lib, v(val), u, pl, r] for k, lib, val, u, pl, r in REGLAGES])


def t_adresses() -> list[str]:
    lignes = []
    for a in ADRESSES:
        dep = a.places_depart
        plan = a.places_plan
        ext = [x for x in EXTENSIONS if x[0] == a.id]
        tot = list(plan)
        for x in ext:
            tot = [u + w for u, w in zip(tot, x[4])]
        lignes.append([f"`{a.id}`", a.nom, f"{a.surface} m²", f"{heure(a.ouverture)} à {heure(a.fermeture)}",
                       ", ".join(a.marche) if a.marche else "aucun", mult(a.indice_prix), mult(a.indice_cout),
                       eur(a.loyer_mois, 0), eur(a.charges_jour, 0), eur(a.installation, 0) if a.installation else "aucune",
                       fr(a.renommee_offre), fr(a.tasses_depart, 1), fr(a.tasses_defi, 1),
                       str(a.lignes_ardoise),
                       f"{sum(dep[:3])} + {dep[3]}", f"{sum(tot[:3])} + {tot[3]}", str(a.debout), str(a.presents_max)])
    return tableau(["Adresse", "Nom (plans)", "Surface", "Ouverture", "Marché", "Prix", "Coûts", "Loyer par mois",
                    "Charges par jour", "Installation", "Renommée de l'offre", "Tasses au départ", "Tasses du défi",
                    "Lignes d'ardoise", "Places à l'arrivée (dedans + dehors)", "Places au maximum", "Debout au comptoir",
                    "Présents au plus (C2)"], lignes)


def t_depart() -> list[str]:
    noms = {"espresso": "machine", "vapeur": "buse", "bouilloire": "bouilloire", "vitrine": "vitrine", "plan": "plan",
            "frigo": "frigo du bar", "four": "four", "agrumes": "presse-agrumes"}
    lignes = []
    for a in ORDRE_ADRESSES:
        d = DEPART[a]
        postes = ", ".join(f"{noms.get(k, k)} {v}" for k, v in d["niveaux"].items())  # type: ignore[union-attr]
        plonge = {1: "évier", 2: "lave-vaisselle", 3: "lave-vaisselle à capot"}[int(d["plonge"])]  # type: ignore[arg-type]
        equip = ", ".join(d["equipements"]) or "aucun"  # type: ignore[arg-type]
        lignes.append([f"`{a}`", postes, plonge, str(d["caisses"]), equip, str(EQUIPE_REPRISE[a]), str(ADR[a].vaisselle)])
    return tableau(["Adresse", "Postes et niveaux", "Plonge", "Terminaux", "Équipements", "Employés repris", "Vaisselle"], lignes)


def t_extensions() -> list[str]:
    return tableau(["Adresse", "Extension", "Coût", "Places (comptoir, tables, confort, terrasse)", "Ambiance", "Raison"],
                   [[f"`{a}`", nom, eur(c, 0), ", ".join(f"+{x}" if x > 0 else str(x) for x in pl), f"+{amb}", r]
                    for a, _, nom, c, pl, amb, r in EXTENSIONS])


def t_profils() -> list[str]:
    lignes = []
    for p in PROFILS:
        tailles = ", ".join(f"{t} ({pct(w)})" for t, w in p.tailles)
        iv, pr = p.recommande
        lignes.append([f"`{p.id}`", p.nom, p.cherche, FAMILLES[p.principal], ", ".join(FAMILLES[x] for x in p.secondaires),
                       p.place, fr(p.sensibilite, 1), f"{p.patience} s", f"{p.confort} s", f"{p.sejour[0]} à {p.sejour[1]} min",
                       tailles, pct(p.p_nourriture), pct(p.emporter), f"{iv} min, {pct(pr)}" if iv else "non",
                       ", ".join(p.styles), ", ".join(p.equipements), fr(p.pourboire, 1)])
    return tableau(["Profil", "Nom", "Ce qu'il cherche", "Envie principale (3 points)", "Envies secondaires (1 point)",
                    "Place voulue", "Sensibilité au prix", "Patience", "Attente sans gêne", "Séjour", "Taille du groupe",
                    "Prend à manger", "Emporte", "Recommande", "Styles aimés", "Équipements recherchés", "Pourboire"], lignes)


def t_flux() -> list[str]:
    return tableau(["Profil"] + [nom_adresse(a) for a in ORDRE_ADRESSES],
                   [[f"`{p}`"] + [fr(FLUX_BASE[a][p], 1).replace(",0", "") for a in ORDRE_ADRESSES] for p in ORDRE_PROFILS]
                   + [["total"] + [fr(sum(FLUX_BASE[a].values()), 1).replace(",0", "") for a in ORDRE_ADRESSES]])


def t_courbes() -> list[str]:
    heures = list(range(7, 21))
    return tableau(["Profil"] + [f"{h} h" for h in heures],
                   [[f"`{p}`"] + [fr(COURBES[p].get(h, 0.0), 1) if COURBES[p].get(h) else "" for h in heures] for p in ORDRE_PROFILS])


def t_jours() -> list[str]:
    return tableau(["Profil", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche", "jour de marché"],
                   [[f"`{p}`"] + [fr(x, 2).rstrip("0").rstrip(",") for x in JOUR_MULT[p]] for p in ORDRE_PROFILS])


def t_meteo() -> list[str]:
    lignes = [["probabilité au " + s if s == "printemps" else "probabilité en " + s]
              + [pct(METEO_PROBA[m][i]) for m in METEOS] for i, s in enumerate(SAISONS)]
    lignes.append(["terrasse ouverte"] + ["oui" if TERRASSE_OUVERTE[m] else "non" for m in METEOS])
    lignes += [[f"`{p}`"] + [fr(x, 2).rstrip("0").rstrip(",") for x in METEO_MULT[p]] for p in ORDRE_PROFILS]
    return tableau(["", *METEOS], lignes)


def t_saisons() -> list[str]:
    return tableau(["Profil", *SAISONS], [[f"`{p}`"] + [fr(x, 2).rstrip("0").rstrip(",") for x in SAISON_MULT[p]]
                                         for p in ORDRE_PROFILS])


def t_attrait() -> list[str]:
    lignes = [["Carte: points d'envie 0 à 7 et plus", " ; ".join(f"{i}: {fr(x, 2)}" for i, x in enumerate(FACTEUR_CARTE)),
               "envie principale 3 points, chaque envie secondaire 1, variété (trois recettes de l'envie principale) 1"],
              ["Réputation: tasses", " ; ".join(f"{fr(k, 1)}: {dec(v)}" for k, v in FACTEUR_TASSES.items()),
               "de x0,7 à x1,3: la réputation compte sans tout écraser"],
              ["Lieu", f"{fr(LIEU['base'], 2)} + {fr(LIEU['ambiance'], 2)} x ambiance / 100; style aimé +{fr(LIEU['style50'], 2)} "
               f"(cohérence 50 %) ou +{fr(LIEU['style75'], 2)} (75 %); +{fr(LIEU['equipement'], 2)} par équipement recherché, "
               f"{int(LIEU['equipementsMax'])} au plus", "de x0,75 (lieu nu) à x1,31"],
              ["Prix", f"1 - sensibilité x (indice de prix - 1), borné de {fr(PRIX_BORNES[0], 2)} à {fr(PRIX_BORNES[1], 2)}",
               "l'indice est le prix choisi sur le prix conseillé"],
              ["Humeur de la veille", f"1 + (satisfaction moyenne d'hier - {HUMEUR['pivot']}) x {fr(HUMEUR['pente'], 2)}, "
               f"borné à ±{pct(HUMEUR['borne'])}", "une bonne journée se dit au village le lendemain"],
              ["Estimation de l'attente à l'entrée", f"{CLIENTS['secondesParGroupe']} s par groupe qui attend, divisées par les "
               f"personnes qui servent; file de {CLIENTS['file']} places au plus (C4)", "on n'entre pas devant une attente plus longue que sa patience"]]
    return tableau(["Facteur", "Valeur", "Raison"], lignes)


def t_satisfaction() -> list[str]:
    S = SATISFACTION
    lignes = [["base", f"{S['base']}", "un client servi normalement est content"],
              ["attente au-delà de l'attente sans gêne du profil", f"{fr(S['parSeconde'], 1)} par seconde, {S['attenteMax']} au plus", "l'attente pèse sans jamais tout gâcher"],
              ["qualité (moyenne des articles): parfait, bien, correct", f"+{S['parfait']}, +{S['bien']}, {S['correct']}", "la précision récompense; « correct » n'est pas un échec"],
              ["dessin sur le lait", f"+{S['dessin']}", "geste de savoir-faire facultatif"],
              ["fait maison", f"+{S['faitMaison']}", "à partir du four du bourg"],
              ["prix ressenti", f"(1 - indice) x sensibilité x {S['prixPente']}, borné à ±{S['prixBorne']}", "un prix doux plaît surtout aux sensibles"],
              ["place: voulue, autre, debout alors qu'on voulait s'asseoir, table pas débarrassée",
               f"+{S['placeVoulue']}, {S['autrePlace']}, {S['debout']}, {S['tableSale']}", "le livre d'or dit ce qui a manqué"],
              ["ambiance", f"(ambiance - 50) / {S['ambianceDiviseur']}", "de -10 à +10"],
              ["deux mots échangés (voisins, habitués)", f"+{S['conversation']}", "le poste calme compte autant que le bar"],
              ["« Comme d'habitude ? » (fétiche servi sans attendre la commande)", f"+{S['commeDHabitude']}", "se souvenir de ses habitués"],
              ["pourboire", f"satisfaction {POURBOIRE['seuil']} et plus: {pct(POURBOIRE['taux'])} de l'addition, {POURBOIRE['seuilRavi']} et plus: "
               f"{pct(POURBOIRE['tauxRavi'])}, une fois sur {dec(1 / POURBOIRE['probabilite'], 2)}, x le pourboire du profil", "le pot à pourboires du comptoir se remplit à vue"],
              ["mot au livre d'or", f"{pct(LIVRE_DOR['pRavi'])} des clients à {LIVRE_DOR['ravi']} et plus, {pct(LIVRE_DOR['pDecu'])} à {LIVRE_DOR['decu']} et moins; "
               f"habitués {pct(LIVRE_DOR['habitue'])}", "assez de mots pour lire chaque soir, pas trop pour qu'ils restent précieux"]]
    return tableau(["Composante (0 à 100)", "Valeur", "Raison"], lignes)


def t_reputation() -> list[str]:
    lignes = []
    for a in ADRESSES:
        pas = REPUTATION_PAS[a.id]
        paliers = []
        t = a.tasses_depart
        while t < 5.0:
            t += 0.5
            paliers.append(f"{fr(t, 1)}: {fr(seuil_points(a.id, t))}")
        lignes.append([f"`{a.id}`", fr(a.tasses_depart, 1), fr(pas), " ; ".join(paliers)])
    return tableau(["Adresse", "Tasses à l'arrivée", "Pas (points)", "Points cumulés pour chaque demi-tasse"], lignes)


def t_postes() -> list[str]:
    return tableau(["Poste", "Nom", "Places à la main, avec machine, machine avancée", "Remarque"],
                   [[f"`{k}`", nom, " / ".join(str(x) for x in slots), rem] for k, (nom, slots, rem) in POSTES.items()])


def gestes_txt(r: Recette) -> str:
    parts = []
    for e in r.etapes:
        a = "/".join(fr(x, 1).replace(",0", "") for x in e.actif)
        t = f"{e.poste} {a} s"
        if any(e.passif):
            t += " + " + "/".join(fr(x, 1).replace(",0", "") for x in e.passif) + " s seul"
        if any(e.fin):
            t += ", finir " + "/".join(fr(x, 1).replace(",0", "") for x in e.fin) + " s"
        parts.append(t)
    return (" puis " if r.sequentiel else " ; ").join(parts)


def t_recettes() -> list[str]:
    lignes = []
    for r in RECETTES:
        prix = " / ".join(eur(r.prix * ADR[a].indice_prix) for a in ("village", "paris-maison"))
        cout = eur(r.cout) + (f" (maison {eur(r.cout_maison)})" if r.cout_maison else "")
        lignes.append([f"`{r.id}`", r.nom, FAMILLES[r.famille], gestes_txt(r), prix, cout, str(r.vaisselle),
                       nom_adresse(r.adresse), r.deblocage, r.saison or "toute l'année"])
    return tableau(["Recette", "Nom", "Famille", "Gestes (à la main / machine / machine avancée)",
                    "Prix conseillé au comptoir (village / Paris, maison)", "Matières", "Vaisselle", "Adresse", "Déblocage", "Saison"], lignes)


def t_gestes() -> list[str]:
    noms = {"commandeComptoir": "prendre une commande au comptoir et encaisser", "commandeTable": "prendre une commande à table",
            "servirComptoir": "servir au comptoir", "servirTable": "servir à table", "servirParArticle": "par article de plus",
            "plateau": "articles par plateau", "debarrasser": "débarrasser une table", "laverMain": "laver une pièce à l'évier",
            "laverLot": "pièces par passage à l'évier", "chargerLave": "charger une pièce au lave-vaisselle",
            "cycleLave": "cycle du lave-vaisselle (évier, lave-vaisselle, à capot)", "capaciteLave": "pièces par cycle",
            "viderLave": "vider le lave-vaisselle", "marcheBar": "pas entre deux postes du bar",
            "parfaitRetard": "retard toléré pour un geste parfait", "correctRetard": "au-delà, le geste est « correct »"}
    lignes = []
    for k, v in GESTES.items():
        val = " / ".join(fr(x, 1).replace(",0", "") for x in v) if isinstance(v, tuple) else fr(v, 1).replace(",0", "")
        unite = "" if k in ("plateau", "laverLot", "capaciteLave") else "s"
        lignes.append([f"`{k}`", noms[k], val, unite])
    return tableau(["Clé", "Geste", "Valeur", "Unité"], lignes)


def t_employes() -> list[str]:
    lignes = [[f"`{r}`", nom, eur(sal, 0), eur(sal * SALAIRE_PARIS, 0), postes, raison] for r, nom, sal, postes, raison in EMPLOYES]
    return tableau(["Rôle", "Nom", "Salaire et charges par jour travaillé", "À Paris", "Postes", "Raison"], lignes)


def t_equipe() -> list[str]:
    lignes = []
    for a in ORDRE_ADRESSES:
        plan = EQUIPE[a]
        rep = EQUIPE_REPRISE[a]
        txt = [f"{r} ({'tous les jours' if j == 'tous' else 'marché et week-end'})" + (", repris" if i < rep else "")
               for i, (r, j) in enumerate(plan)]
        lignes.append([f"`{a}`", str(len(plan)), "; ".join(txt) if txt else "aucun employé"])
    return tableau(["Adresse", "Employés au plus (plan du duo simulé)", "Ordre d'embauche"], lignes)


def t_achats() -> list[str]:
    lignes = []
    for a, i, nom, prix, effet, r1, r2 in ACHATS:
        lignes.append([f"`{a}`", f"`{i}`", nom, eur(prix, 0), effet.replace(";", "; "), str(r1), str(r2)])
    return tableau(["Adresse", "Achat", "Nom", "Prix", "Effet", "Rang (duo équilibré)", "Rang (duo capacité)"], lignes)


def t_ambiance() -> list[str]:
    lignes = [[f"`{a.id}`", str(AMBIANCE_DEPART[a.id]), eur(a.pas_ambiance, 0),
               f"+{pct(AMBIANCE_HAUSSE - 1)} par palier, {AMBIANCE_MAX} au plus"] for a in ADRESSES]
    return tableau(["Adresse", "Ambiance à l'arrivée", "Premier palier de +10", "Paliers suivants"], lignes)


def t_duos() -> list[str]:
    return tableau(["Duo", "Nom", "Vitesse des gestes", "Hésitation par tâche", "Gestes parfaits", "Préparation", "Fermeture",
                    "Lundi", "Épargne après l'offre", "Palier d'ambiance", "Achats d'abord"],
                   [[f"`{d.id}`", d.nom, mult(d.vitesse), f"{fr(d.hesitation, 1)} s", pct(d.parfait), f"{fr(d.preparation, 1)} min",
                     f"{fr(d.fermeture, 1)} min", f"{fr(d.lundi, 1)} min", pct(d.epargne),
                     "après chaque achat" if AMBIANCE_RYTHME[d.id] == 1 else f"tous les {AMBIANCE_RYTHME[d.id]} achats",
                     "capacité" if d.priorite_capacite else "équilibre"] for d in DUOS])


def t_defis() -> list[str]:
    lignes = [[f"`{a}`", nom, f"`{ext}`", jour, fr(ADR[a].tasses_defi, 1), fr(RENOMMEE_DEFI[a])] for a, (nom, ext, jour) in DEFI.items()]
    lignes.append(["`paris-maison`", "La visite du guide, puis la fête de la maison", " et ".join(f"`{x}`" for x in FIN["achats"]),
                   "la semaine où tout est prêt, fête le lundi", fr(FIN["tasses"], 1), "fin de l'histoire principale"])
    return tableau(["Adresse", "Défi", "Lieu (extension ou achats)", "Jour", "Tasses", "Renommée gagnée"], lignes)


def t_divers() -> list[str]:
    lignes = [["Rattrapage de réputation", f"après {RATTRAPAGE['apres']} jours ouverts à l'adresse, +{pct(RATTRAPAGE['parJour'])} de points par jour, "
               f"x{fr(RATTRAPAGE['plafond'], 1)} au plus", "aide les duos qui prennent leur temps; ne change presque rien au duo médian"],
              ["Points de réputation d'un groupe servi", f"(satisfaction - {REPUTATION_PIVOT}) / {REPUTATION_DIVISEUR}, jamais négatif",
               "un client content fait monter la réputation; un client déçu ne la fait pas baisser"],
              ["Caisse au départ", eur(CAISSE_DEPART, 0), "Simone la laisse « pour la monnaie et le premier lait »"],
              ["Affluence d'un défi", mult(DEFI_AFFLUENCE), "tout le pays vient: le coup de feu de l'adresse"],
              ["Prix en salle", mult(PRIX_SALLE), "à la française: le comptoir est moins cher que la salle et la terrasse"],
              ["Employés: vitesse aux niveaux 1, 2, 3", " / ".join(mult(VITESSE_EMPLOYE[k]) for k in (1, 2, 3)),
               "des professionnels, plus rapides que nous au départ"],
              ["Employés: jours travaillés pour les niveaux 2 et 3", f"{JOURS_NIVEAU_EMPLOYE[1]} et {JOURS_NIVEAU_EMPLOYE[2]}", "on les voit progresser"],
              ["Embauche du duo simulé", f"pertes de plus de {pct(EMBAUCHE['perteSeuil'])} sur {EMBAUCHE['joursObserves']} jours et "
               f"{EMBAUCHE['reserveSalaires']} jours de salaire en caisse", "comportement prudent, pas une règle du jeu"]]
    return tableau(["Paramètre", "Valeur", "Raison"], lignes)


TABLES_PARAMETRES = {
    "reglages": t_reglages, "adresses": t_adresses, "depart": t_depart, "extensions": t_extensions, "profils": t_profils, "flux": t_flux,
    "courbes": t_courbes, "jours": t_jours, "meteo": t_meteo, "saisons": t_saisons, "attrait": t_attrait,
    "satisfaction": t_satisfaction, "reputation": t_reputation, "postes": t_postes, "recettes": t_recettes,
    "gestes": t_gestes, "employes": t_employes, "equipe": t_equipe, "achats": t_achats, "ambiance": t_ambiance,
    "duos": t_duos, "defis": t_defis, "divers": t_divers,
}


def empreinte() -> str:
    import hashlib
    h = hashlib.sha256()
    for k in sorted(TABLES_PARAMETRES):
        h.update("\n".join(TABLES_PARAMETRES[k]()).encode("utf-8"))
    return h.hexdigest()[:12]


def quantile(vals: list[float], f: float) -> float:
    v = sorted(vals)
    return v[int(round(f * (len(v) - 1)))]


def monte_carlo(n: int, graine0: int = 1000) -> dict[str, list[Partie]]:
    """Mêmes graines pour les trois duos: les écarts viennent des duos, pas du hasard."""
    return {d.id: [jouer_partie(d, graine0 + i) for i in range(n)] for d in DUOS}


def r_progression(mc: dict[str, list[Partie]]) -> list[str]:
    lignes = []
    for d in DUOS:
        ps = mc[d.id]
        cells = [d.nom]
        for a in ORDRE_ADRESSES[1:]:
            js = [p.arrivees[a].jour for p in ps if a in p.arrivees]
            hs = [p.arrivees[a].minutes / 60 for p in ps if a in p.arrivees]
            cells.append(f"jour {fr(statistics.median(js))} [{fr(quantile(js, .1))}-{fr(quantile(js, .9))}], "
                         f"{fr(statistics.median(hs), 1)} h [{fr(quantile(hs, .1), 1)}-{fr(quantile(hs, .9), 1)}]")
        js = [p.fin.jour for p in ps if p.fin]
        hs = [p.fin.minutes / 60 for p in ps if p.fin]
        cells.append(f"jour {fr(statistics.median(js))} [{fr(quantile(js, .1))}-{fr(quantile(js, .9))}], "
                     f"{fr(statistics.median(hs), 1)} h [{fr(quantile(hs, .1), 1)}-{fr(quantile(hs, .9), 1)}]")
        cells.append(f"{len(js)} sur {len(ps)}")
        lignes.append(cells)
    return tableau(["Duo", "Arrivée au bourg", "En ville", "À Paris (quartier)", "À la maison parisienne", "Fête de la maison",
                    "Parties finies"], lignes)


def condition_bloquante(p: Partie, a: str) -> str:
    nxt = adresse_suivante(a)
    if not nxt or nxt not in p.arrivees:
        return ""
    i = ORDRE_ADRESSES.index(a)
    jours = [j for j in p.journal if j["adresse"] == i]
    seuil = ADR[a].tasses_defi
    t_ok = next((j["jour"] for j in jours if j["tasses"] >= seuil), 10 ** 6)
    ext = DEFI[a][1]
    e_ok = p.ext_jour.get(ext, 10 ** 6)
    ep = p.epargne_jour.get(nxt, 10 ** 6)
    defi = p.defis_faits_jour.get(a, 10 ** 6)
    off = p.offres_jour.get(nxt, 10 ** 6)
    dernier = max(defi, ep, off)
    if dernier == ep and ep > defi:
        return "épargne"
    if dernier == off and off > defi:
        return "offre"
    return "réputation" if t_ok >= e_ok else "extension"


def r_blocage(mc: dict[str, list[Partie]]) -> list[str]:
    lignes = []
    for d in DUOS:
        for a in ORDRE_ADRESSES[:-1]:
            c = [condition_bloquante(p, a) for p in mc[d.id]]
            c = [x for x in c if x]
            if not c:
                continue
            parts = {k: c.count(k) / len(c) for k in ("réputation", "extension", "épargne", "offre")}
            lignes.append([d.nom, f"{nom_adresse(a)} vers {nom_adresse(adresse_suivante(a))}"]
                          + [pct(parts[k]) for k in ("réputation", "extension", "épargne", "offre")])
    return tableau(["Duo", "Départ", "Réputation du défi", "Extension du défi", "Épargne", "Offre"], lignes)


def jours_adresse(p: Partie, a: str) -> list[dict]:
    i = ORDRE_ADRESSES.index(a)
    return [j for j in p.journal if j["adresse"] == i]


def r_service(mc: dict[str, list[Partie]]) -> list[str]:
    lignes = []
    for a in ORDRE_ADRESSES:
        for nom_periode, prem in (("première semaine", True), ("dernière semaine", False)):
            js = []
            for p in mc["median"]:
                ja = jours_adresse(p, a)
                if a == "paris-maison" and not prem:
                    ja = [j for j in ja if j["jour"] < (p.fin.jour if p.fin else 10 ** 6)]
                js += ja[:6] if prem else ja[-6:]
            if not js:
                continue
            m = lambda k: statistics.fmean(j[k] for j in js)
            lignes.append([nom_adresse(a), nom_periode, fr(m("arrives")), fr(m("servis")), pct(m("repartis")),
                           f"{fr(m('attente'))} s", f"{fr(m('attente90'))} s", fr(m("satisfaction")), pct(m("charge")),
                           fr(m("personnel") - 2), f"{fr(m('presents'))} / {fr(max(j['presents'] for j in js))}",
                           str(ADR[a].presents_max)])
    return tableau(["Adresse", "Période", "Groupes venus par jour", "Groupes servis", "Repartis sans entrer",
                    "Attente moyenne", "Attente, 9 sur 10 en dessous", "Satisfaction", "Charge de chaque joueur",
                    "Employés présents", "Personnages présents (moyenne des pointes / plus haut)", "Plafond C2"], lignes)


def r_economie(mc: dict[str, list[Partie]]) -> list[str]:
    lignes = []
    for a in ORDRE_ADRESSES:
        js = [j for p in mc["median"] for j in jours_adresse(p, a)]
        m = lambda k: statistics.fmean(j[k] for j in js)
        charges = ADR[a].charges_jour
        loyer_ouvert = m("loyer") * 7 / 6
        res = m("recette") + m("pourboires") - m("cout") - m("fixes") - m("loyer") / 6
        lignes.append([nom_adresse(a), eur(m("recette"), 0), eur(m("pourboires"), 0), eur(m("cout"), 0),
                       eur(loyer_ouvert, 0), eur(m("salaires"), 0), eur(charges, 0), eur(res, 0), eur(m("succursales"), 0)])
    return tableau(["Adresse", "Recettes", "Pourboires", "Matières", "Loyer (lundi compris)", "Salaires", "Charges",
                    "Résultat", "Succursales (en plus)"], lignes)


def r_heures(mc: dict[str, list[Partie]], a: str, js_cible: int) -> list[str]:
    jours = []
    for p in mc["median"]:
        ja = jours_adresse(p, a)
        dern = ja[-12:]
        jours += [j for j in dern if j["js"] == js_cible]
    adr = ADR[a]
    lignes = []
    for i, (h, d) in enumerate(creneaux(adr)):
        vals = [j["heures"][i] for j in jours if i < len(j["heures"])]
        if not vals:
            continue
        m = lambda k: statistics.fmean(v[k] for v in vals)
        lignes.append([heure(h), fr(m("arrivees"), 1), fr(m("servis"), 1), fr(m("repartis"), 1), f"{fr(m('attente'))} s",
                       fr(m("presents"))])
    return tableau(["Heure de jeu", "Groupes venus", "Servis", "Repartis", "Attente moyenne", "Personnages présents au plus"], lignes)


def r_presence(mc: dict[str, list[Partie]]) -> list[str]:
    lignes = []
    for a in ORDRE_ADRESSES:
        js = [j for ps in mc.values() for p in ps for j in jours_adresse(p, a)]
        pmax = max(j["presents"] for j in js)
        p99 = quantile([j["presents"] for j in js], 0.99)
        emax = max(j["personnel"] for j in js) - 2
        lignes.append([nom_adresse(a), fr(p99), fr(pmax), str(ADR[a].presents_max), fr(emax), "12",
                       "oui" if pmax <= ADR[a].presents_max and emax <= 12 else "non"])
    return tableau(["Adresse", "Présents au plus, 99 jours sur 100", "Présents au plus", "Plafond C2", "Employés au plus",
                    "Plafond C5", "Respecté"], lignes)


def r_rythme(mc: dict[str, list[Partie]]) -> list[str]:
    lignes = []
    for d in DUOS:
        cells = [d.nom]
        for a in ORDRE_ADRESSES:
            mins = []
            jours = []
            for p in mc[d.id]:
                if a not in p.arrivees:
                    continue
                debut = p.arrivees[a]
                nxt = adresse_suivante(a)
                fin = p.arrivees[nxt] if nxt and nxt in p.arrivees else p.fin
                if fin is None:
                    continue
                mins.append((fin.minutes - debut.minutes) / 60)
                jours.append(fin.jour - debut.jour)
            cells.append(f"{fr(statistics.median(jours))} jours, {fr(statistics.median(mins), 1)} h" if jours else "")
        ouverts = [j for p in mc[d.id] for j in p.journal]
        cells.append(f"{fr(statistics.fmean(d.preparation + (ADR[ORDRE_ADRESSES[j['adresse']]].fermeture - ADR[ORDRE_ADRESSES[j['adresse']]].ouverture) + j['depassement'] / 60 + d.fermeture for j in ouverts), 1)} min")
        lignes.append(cells)
    return tableau(["Duo"] + [nom_adresse(a) for a in ORDRE_ADRESSES] + ["Journée ouverte moyenne"], lignes)


def r_sans_employes(mc: dict[str, list[Partie]]) -> list[str]:
    lignes = []
    for a in ("ville", "paris-quartier", "paris-maison"):
        for avec in (True, False):
            res = []
            for k, p in enumerate(mc["median"][:8]):
                if a not in p.derniere_config:
                    continue
                cfg, _, saison, _ = p.derniere_config[a]
                c2 = Config(cfg.adresse, cfg.niveaux, cfg.plonge, cfg.service_table, cfg.places, cfg.vaisselle,
                            cfg.employes if avec else [], cfg.etat, cfg.caisses)
                for js in (1, 5):
                    srv = Service(c2, DUO["median"], random.Random(5000 + k * 7 + js), js, saison, "soleil")
                    srv.run(demande(ADR[a], c2.etat, js, saison, "soleil"))
                    res.append(srv.bilan())
            if not res:
                continue
            m = lambda key: statistics.fmean(r[key] for r in res)
            _CLES[f"equipe_{a}_{'avec' if avec else 'sans'}"] = fr(100 * m("repartis"))
            lignes.append([nom_adresse(a), "avec l'équipe" if avec else "à deux, sans employés", fr(m("personnel") - 2),
                           fr(m("servis")), pct(m("repartis")), f"{fr(m('attente'))} s", fr(m("satisfaction")),
                           f"{fr(m('depassement'))} s"])
    return tableau(["Adresse", "Équipe", "Employés", "Groupes servis par jour", "Repartis", "Attente moyenne",
                    "Satisfaction", "Service fini après la fermeture"], lignes)


REGLAGES_DUO = [("normal", 1.0, 1.0), ("rythme paisible", 1.25, 1.0), ("patience grande", 1.0, 1.5),
                ("les deux", 1.25, 1.5)]


def r_aides(mc: dict[str, list[Partie]]) -> list[str]:
    """Réglages du duo (règle TE-02 et CL-05) sur la dernière configuration d'un duo tranquille."""
    lignes = []
    for a in ("bourg", "paris-quartier"):
        for nom, spm, pat in REGLAGES_DUO:
            res = []
            for k, p in enumerate(mc["lent"][:8]):
                if a not in p.derniere_config:
                    continue
                cfg, _, saison, _ = p.derniere_config[a]
                for js in (1, 5):
                    srv = Service(cfg, DUO["lent"], random.Random(7000 + k * 7 + js), js, saison, "soleil", spm=spm,
                                  aide_patience=pat)
                    srv.run(demande(ADR[a], cfg.etat, js, saison, "soleil"))
                    res.append(srv.bilan())
            if not res:
                continue
            m = lambda key: statistics.fmean(r[key] for r in res)
            _CLES[f"aides_{a}_{nom.replace(' ', '_')}"] = fr(100 * m("repartis"))
            duree = (ADR[a].fermeture - ADR[a].ouverture) * spm
            lignes.append([nom_adresse(a), nom, f"{fr(duree, 1)} min", fr(m("servis")), pct(m("repartis")),
                           f"{fr(m('attente'))} s", fr(m("satisfaction")), pct(m("charge"))])
    return tableau(["Adresse", "Réglage du duo", "Service réel", "Groupes servis", "Repartis", "Attente moyenne",
                    "Satisfaction", "Charge de chaque joueur"], lignes)


def r_exemple() -> list[str]:
    """Règle AT-07, exemple chiffré: le village, un mardi de printemps, temps couvert, la première semaine."""
    adr = ADR["village"]
    carte = ["espresso", "allonge", "noisette", "creme", "the_noir", "chocolat", "croissant", "pain_chocolat"]
    e = Etat(carte, 1.0, 40.0, "campagne", 0.5, {"gobelets"}, 2.0, 74.0)
    lignes = []
    fam = familles_de(carte)
    for pid, h_cible in (("presses", 8), ("voisins", 8), ("familles", 16), ("gourmands", 16)):
        i = next(k for k, (h, _) in enumerate(creneaux(adr)) if int(h) == h_cible)
        pas_ = passants_heure(adr, pid, 1, 0, "couvert")[i]
        pts = points_carte(pid, fam)
        fc, fp = facteur_carte(pts), facteur_prix(pid, e.indice_prix)
        fl = facteur_lieu(pid, e.ambiance, e.style, e.coherence, e.equipements)
        ft, fh = facteur_tasses(e.tasses), facteur_humeur(e.satisfaction_hier)
        lignes.append([PROF[pid].nom, f"{h_cible} h", fr(pas_, 2), f"{pts} points: {mult(fc)}", mult(fp), mult(round(fl, 3)),
                       mult(ft), mult(round(fh, 3)), fr(pas_ * fc * fp * fl * ft * fh, 2)])
    return tableau(["Profil", "Heure", "Passants intéressés dans l'heure", "Carte", "Prix", "Lieu", "Réputation (2 tasses)",
                    "Humeur d'hier (74)", "Groupes attendus dans l'heure"], lignes)


def r_epargne(mc: dict[str, list[Partie]]) -> list[str]:
    lignes = []
    for a in ORDRE_ADRESSES[1:]:
        vals = [p.caisse_depart[a] for p in mc["median"] if a in p.caisse_depart]
        if vals:
            lignes.append([nom_adresse(a), eur(ADR[a].installation, 0), eur(statistics.median(vals), 0),
                           f"{eur(quantile(vals, .1), 0)} à {eur(quantile(vals, .9), 0)}"])
    return tableau(["Arrivée à", "Installation payée", "Caisse le jour de l'arrivée (médiane)", "9 duos sur 10 entre"], lignes)


_CLES: dict[str, str] = {}


def valeurs_cles(mc: dict[str, list[Partie]]) -> dict[str, str]:
    out: dict[str, str] = dict(sorted(_CLES.items()))
    ouverts = [j for p in mc["median"] for j in p.journal]
    d = DUO["median"]
    out["journee_median_min"] = fr(statistics.fmean(
        d.preparation + (ADR[ORDRE_ADRESSES[j["adresse"]]].fermeture - ADR[ORDRE_ADRESSES[j["adresse"]]].ouverture)
        * REG["secondesParMinute"] + j["depassement"] / 60 + d.fermeture for j in ouverts))
    out["seances_median"] = fr(statistics.median(p.fin.minutes for p in mc["median"] if p.fin) / 40)
    out["parties"] = fr(sum(len(ps) for ps in mc.values()))
    out["a_regler"] = fr(sum(1 for ps in mc.values() for p in ps if p.report_max > 0))
    for d in DUOS:
        ps = mc[d.id]
        hs = [p.fin.minutes / 60 for p in ps if p.fin]
        js = [p.fin.jour for p in ps if p.fin]
        out[f"fin_h_{d.id}"] = fr(statistics.median(hs), 1)
        out[f"fin_j_{d.id}"] = fr(statistics.median(js))
        for a in ORDRE_ADRESSES[1:]:
            h = [p.arrivees[a].minutes / 60 for p in ps if a in p.arrivees]
            out[f"arr_h_{a}_{d.id}"] = fr(statistics.median(h), 1)
    return out


RESULTATS = [
    ("res_progression", "Progression: jour et heures de jeu à chaque arrivée, médiane [1er et 9e déciles]", r_progression),
    ("res_blocage", "Ce qui décide du jour de chaque départ (part des parties)", r_blocage),
    ("res_service", "Service du duo médian: première et dernière semaine à chaque adresse", r_service),
    ("res_economie", "Une journée ouverte moyenne du duo médian, par adresse", r_economie),
    ("res_sans_employes", "Ce que l'équipe change: dernière configuration du duo médian, un mardi et un samedi", r_sans_employes),
    ("res_presence", "Personnages présents à la fois (joueurs et employés compris) et employés, toutes parties", r_presence),
    ("res_rythme", "Rythme réel: durée de chaque adresse (médiane) et d'une journée ouverte", r_rythme),
    ("res_epargne", "Argent en caisse à l'arrivée à chaque adresse (duo médian)", r_epargne),
    ("res_aides", "Réglages du duo sur la dernière configuration d'un duo tranquille, un mardi et un samedi", r_aides),
]


def calculer(n: int) -> tuple[dict[str, list[str]], dict[str, str], float]:
    t0 = time.time()
    mc = monte_carlo(n)
    tables: dict[str, list[str]] = {}
    for cle, _, f in RESULTATS:
        tables[cle] = f(mc)
    tables["res_heures_village"] = r_heures(mc, "village", 6)
    tables["res_heures_maison"] = r_heures(mc, "paris-maison", 1)
    tables["res_exemple"] = r_exemple()
    cles = valeurs_cles(mc)
    return tables, cles, time.time() - t0


# ---------------------------------------------------------------------------
# 14. Fichier de résultats, contrôle croisé, ligne de commande
# ---------------------------------------------------------------------------

LECTURES = {
    "res_progression": "Chaque arrivée tombe un lundi (on déménage le jour de fermeture): les écarts entre duos se comptent en semaines.",
    "res_blocage": "« Réputation » et « extension »: le défi attendait la réputation ou son lieu; « épargne »: le défi était fait, "
                   "il manquait l'installation; « offre »: la lettre de l'adresse suivante n'était pas arrivée.",
    "res_service": "Première semaine: gestes à la main, peu d'équipement; dernière semaine: machines achetées et, dès la ville, "
                   "employés. Repartis: groupes qui n'entrent pas (file pleine, attente estimée trop longue, café complet).",
    "res_economie": "Montants par journée ouverte; le loyer court aussi le lundi. Les succursales s'ajoutent au résultat du café joué.",
    "res_sans_employes": "Même café, même carte, même jour: à deux seulement, les grandes adresses refusent une bonne part de leurs clients.",
    "res_presence": "Le plafond C2 de l'architecte compte tous les personnages présents dans l'adresse; le plafond des visibles (C1, C3) "
                    "relève du validateur des plans.",
    "res_rythme": "Temps réel joué, préparation et fermeture comprises, lundis compris.",
    "res_epargne": "Ce qui reste en caisse une fois l'installation payée: de quoi acheter les premières machines de la nouvelle adresse.",
    "res_aides": "Rythme paisible: une heure de jeu dure 75 s au lieu de 60, le même flux est moins serré. Patience grande: les "
                 "clients attendent une fois et demie plus longtemps avant de renoncer.",
    "res_heures_village": "Un dimanche de la dernière semaine au village (duo médian): le coup de feu du matin, puis celui du goûter.",
    "res_heures_maison": "Un mardi de la dernière semaine à la maison parisienne (duo médian).",
    "res_exemple": "Règle AT-07: groupes attendus = passants x carte x prix x lieu x réputation x humeur, ici le premier mardi au village.",
}


def ecrire_resultats(chemin: str, n: int) -> None:
    tables, cles, duree = calculer(n)
    L = ["# Cosy Café (titre de travail): résultats de la simulation", "",
         f"<!-- empreinte:{empreinte()} -->",
         "Fichier écrit par `docs/jeux/cosy-cafe/simulations/cosy_cafe.py --resultats` (bibliothèque standard de Python, "
         f"graines fixes). {n} parties par duo; chaque journée ouverte de chaque partie est jouée client par client. "
         "Ne pas retoucher à la main: relancer le script, puis `--croise` sur le cahier.", "",
         "## Méthode", "",
         "- Une journée ouverte est une simulation à événements discrets: chaque groupe de clients arrive selon l'attrait de "
         "la carte (règle AT-07), entre ou renonce (CL-03), commande, attend que chaque étape de chaque recette passe par son "
         "poste, s'assoit, reste, recommande parfois, part; joueurs et employés prennent les tâches par priorités (finir un geste, "
         "servir, prendre les commandes, préparer, laver, débarrasser).",
         "- Entre les journées: achats selon le duo (catalogue et paliers d'ambiance), embauches, épargne après l'offre de "
         "l'adresse suivante, défi local, déménagement le lundi, succursales (SU-02), rattrapage de réputation (RE-05).",
         "- Trois duos: tranquille, médian et rapide (vitesse des gestes, hésitation, gestes parfaits, temps de préparation et "
         "de fermeture, part épargnée, goût pour la décoration). Ce sont des hypothèses, à recaler au prototype (CA-51).", ""]
    titres = {k: t for k, t, _ in RESULTATS}
    titres.update({"res_heures_village": "Profil horaire, village", "res_heures_maison": "Profil horaire, maison parisienne",
                   "res_exemple": "Exemple chiffré de l'attrait"})
    ordre = [k for k, _, _ in RESULTATS] + ["res_heures_village", "res_heures_maison", "res_exemple"]
    for i, k in enumerate(ordre, 1):
        L += [f"## {i}. {titres[k]}", "", f"<!-- table:{k} -->"] + tables[k] + ["", LECTURES[k], ""]
    L += [f"## {len(ordre) + 1}. Valeurs clés citées dans le cahier", "", "<!-- table:res_cles -->"]
    L += tableau(["Clé", "Valeur"], [[f"`{k}`", v] for k, v in cles.items()])
    L += ["", f"Calcul: {fr(duree)} s sur la machine de l'environnement cloud.", ""]
    with open(chemin, "w", encoding="utf-8") as f:
        f.write("\n".join(L))


def lire_tableau(texte: str, pos: int) -> list[str]:
    out = []
    for ligne in texte[pos:].split("\n"):
        if ligne.startswith("|"):
            out.append(ligne.rstrip())
        elif out or ligne.strip():
            break
    return out


def croise(cahier: str, resultats: str) -> list[str]:
    with open(cahier, encoding="utf-8") as f:
        texte = f.read()
    with open(resultats, encoding="utf-8") as f:
        res = f.read()
    ecarts: list[str] = []
    m = re.search(r"<!-- empreinte:([0-9a-f]+) -->", res)
    if not m or m.group(1) != empreinte():
        ecarts.append("résultats périmés: les données ont changé depuis l'écriture de resultats.md (relancer --resultats)")
    vus = set()
    for m in re.finditer(r"<!-- table:([a-z_]+) -->[ \t]*\n", texte):
        cle = m.group(1)
        vus.add(cle)
        lu = lire_tableau(texte, m.end())
        if cle in TABLES_PARAMETRES:
            attendu = TABLES_PARAMETRES[cle]()
        else:
            mr = re.search(r"<!-- table:" + re.escape(cle) + r" -->[ \t]*\n", res)
            if mr is None:
                ecarts.append(f"table `{cle}`: absente de resultats.md")
                continue
            attendu = lire_tableau(res, mr.end())
        if lu != attendu:
            for i, (x, y) in enumerate(zip(lu + [""] * len(attendu), attendu + [""] * len(lu))):
                if x != y:
                    ecarts.append(f"table `{cle}`, ligne {i + 1}: cahier « {x[:90]} », script « {y[:90]} »")
                    break
    for cle in TABLES_PARAMETRES:
        if cle not in vus:
            ecarts.append(f"table `{cle}` absente du cahier")
    mres = re.search(r"<!-- table:res_cles -->[ \t]*\n", res)
    valeurs = {}
    if mres:
        for l in lire_tableau(res, mres.end())[2:]:
            parts = [x.strip() for x in l.strip("|").split("|")]
            valeurs[parts[0].strip("`")] = parts[1]
    for m in re.finditer(r"<!-- val:([a-z_\-]+) -->([0-9][0-9 ]*(?:,[0-9]+)?)", texte):
        cle, v = m.group(1), m.group(2).strip()
        if valeurs.get(cle) != v:
            ecarts.append(f"valeur `{cle}`: cahier {v}, résultats {valeurs.get(cle)}")
    return ecarts


def main() -> int:
    ap = argparse.ArgumentParser(description="Simulation de Cosy Café (titre de travail)")
    ap.add_argument("--tableaux", action="store_true", help="imprime les tables de paramètres du cahier")
    ap.add_argument("--resultats", metavar="FICHIER", help="écrit le fichier de résultats")
    ap.add_argument("--duos", type=int, default=40, help="parties par duo (40 par défaut, 12 pour un essai)")
    ap.add_argument("--croise", metavar="CAHIER", help="compare le cahier aux données et au fichier de résultats")
    ap.add_argument("--avec", metavar="RESULTATS", default="docs/jeux/cosy-cafe/simulations/resultats.md")
    args = ap.parse_args()
    if args.tableaux:
        for k, f in TABLES_PARAMETRES.items():
            print(f"<!-- table:{k} -->")
            print("\n".join(f()))
            print()
        return 0
    if args.resultats:
        ecrire_resultats(args.resultats, args.duos)
        print(f"Résultats écrits dans {args.resultats}.")
        return 0
    if args.croise:
        ecarts = croise(args.croise, args.avec)
        if ecarts:
            print("Écarts entre le cahier, le script et les résultats:")
            for e in ecarts:
                print("  - " + e)
            return 1
        print(f"Cahier conforme: {len(TABLES_PARAMETRES)} tables de paramètres et les tables de résultats relues.")
        return 0
    tables, cles, duree = calculer(args.duos)
    print("\n".join(tables["res_progression"]))
    print(f"\n{args.duos} parties par duo, {fr(duree)} s.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
