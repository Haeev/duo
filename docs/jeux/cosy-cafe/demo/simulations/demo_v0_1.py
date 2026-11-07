#!/usr/bin/env python3
"""Deux Tabliers, démo v0.1 (Ormeval, jours 1 à 15): données chiffrées et économie de la démo.

Ce script est la source des fichiers chiffrés de `demo/donnees/` (recettes, ingrédients et
fournisseurs, catalogue, postes et équipements, réglages d'économie): `--donnees` les écrit.
`--simuler` relit ces fichiers JSON (jamais ses propres constantes: c'est le contrôle croisé) et
joue la démo client par client avec le service de `simulations/cosy_cafe.py`, pour trois duos et
deux ordres d'achat; `--remplir` recopie les tables dans `demo/demo-v0-1.md` entre les marqueurs
`<!-- table:id -->` et `<!-- fin:id -->`.

Consigne de la nuit (client, 2026-11-07): simulations courtes, 8 parties par duo et par ordre.

Lancement depuis la racine du dépôt:
  python3 -I -B docs/jeux/cosy-cafe/demo/simulations/demo_v0_1.py --donnees
  python3 -I -B docs/jeux/cosy-cafe/demo/simulations/demo_v0_1.py --simuler --remplir
"""
from __future__ import annotations

import argparse
import dataclasses
import importlib.util
import json
import random
import re
import statistics
import sys
from pathlib import Path

ICI = Path(__file__).resolve().parent
DEMO = ICI.parent
DONNEES = DEMO / "donnees"
DOC = DEMO / "demo-v0-1.md"
SIM = DEMO.parent / "simulations" / "cosy_cafe.py"
PARTIES = 8

# ---------------------------------------------------------------------------
# 1. Ingrédients, fournisseurs, recettes de la démo
# ---------------------------------------------------------------------------

FOURNISSEURS = [
    {"id": "armelle", "name": "Armelle, la laitière", "vehicle": "triporteur", "delivers": ["lait_entier", "lait_avoine", "beurre", "oeufs"],
     "deliveryTime": "7:15", "line": "Le lait de ce matin, il était encore dans le pré hier soir."},
    {"id": "lucas", "name": "Lucas, le boulanger de la place", "vehicle": "panière", "delivers": ["croissant_boulanger", "pain_chocolat_boulanger", "tarte_boulanger", "pain_campagne"],
     "deliveryTime": "7:00", "line": "Tout chaud, je traverse juste la ruelle."},
    {"id": "joseph", "name": "Joseph, le petit torréfacteur de la vallée", "vehicle": "fourgonnette", "delivers": ["grains_maison", "the_noir", "the_vert", "cacao"],
     "deliveryTime": "7:30", "line": "Torréfié avant-hier: il est à point."},
    {"id": "mireille", "name": "Mireille, l'épicerie d'Ormeval", "vehicle": "à pied, un cabas", "delivers": ["oranges", "citrons", "sucre", "farine", "confiture", "limonade_bouteille", "gobelets_lot", "accompagnement"],
     "deliveryTime": "7:30", "line": "Si tu manques de quelque chose, je suis à deux pas.", "emergency": True},
    {"id": "simone_jardin", "name": "Le jardin de Simone", "vehicle": "panier d'osier", "delivers": ["plantes_simone", "menthe"],
     "deliveryTime": "8:30", "line": "Cueilli ce matin, ne me remercie pas."},
]

# id, nom, unité, coût par unité (€), fournisseur, rangement, jours de conservation, unités par carton, carton lourd
INGREDIENTS = [
    ("grains_maison", "Grains, mélange de la vallée", "g", 0.020, "joseph", "reserve", 30, 1000, True),
    ("lait_entier", "Lait entier", "ml", 0.0013, "armelle", "frigo", 7, 6000, True),
    ("lait_avoine", "Lait d'avoine", "ml", 0.0028, "armelle", "frigo", 10, 3000, False),
    ("beurre", "Beurre", "g", 0.008, "armelle", "frigo", 14, 500, False),
    ("oeufs", "Œufs", "piece", 0.25, "armelle", "frigo", 14, 12, False),
    ("cacao", "Chocolat en poudre", "g", 0.012, "joseph", "reserve", 60, 1000, False),
    ("the_noir", "Thé noir en vrac (une dose)", "dose", 0.18, "joseph", "reserve", 90, 50, False),
    ("the_vert", "Thé vert en vrac (une dose)", "dose", 0.22, "joseph", "reserve", 90, 50, False),
    ("plantes_simone", "Plantes du jardin de Simone (un bouquet)", "dose", 0.10, "simone_jardin", "reserve", 7, 20, False),
    ("menthe", "Menthe du jardin", "brin", 0.05, "simone_jardin", "frigo", 4, 20, False),
    ("oranges", "Oranges à presser", "piece", 0.30, "mireille", "reserve", 10, 30, True),
    ("citrons", "Citrons", "piece", 0.25, "mireille", "reserve", 14, 20, False),
    ("sucre", "Sucre", "g", 0.002, "mireille", "reserve", 365, 2000, False),
    ("farine", "Farine", "g", 0.0012, "mireille", "reserve", 120, 5000, True),
    ("confiture", "Confiture d'abricot", "g", 0.004, "mireille", "reserve", 60, 1000, False),
    ("limonade_bouteille", "Limonade de la vallée (bouteille)", "piece", 1.10, "mireille", "frigo", 180, 12, True),
    ("accompagnement", "Sucre et carré de chocolat servis avec la boisson", "piece", 0.06, "mireille", "reserve", 365, 200, False),
    ("pain_campagne", "Pain de campagne (une tranche)", "piece", 0.12, "lucas", "reserve", 1, 20, False),
    ("croissant_boulanger", "Croissant du boulanger", "piece", 0.70, "lucas", "vitrine", 1, 10, False),
    ("pain_chocolat_boulanger", "Pain au chocolat du boulanger", "piece", 0.75, "lucas", "vitrine", 1, 10, False),
    ("tarte_boulanger", "Tarte aux fruits du boulanger (une part)", "piece", 1.60, "lucas", "vitrine", 1, 8, False),
]
COUT = {i[0]: i[3] for i in INGREDIENTS}

# Recettes de la démo: id, ingrédients, déblocage (type, valeur). Gestes, familles et prix: cahier, table `recettes`.
RECETTES_DEMO = [
    ("espresso", {"grains_maison": 7, "accompagnement": 1}, {"kind": "start"}),
    ("allonge", {"grains_maison": 8, "accompagnement": 1}, {"kind": "start"}),
    ("creme", {"grains_maison": 7, "lait_entier": 150, "accompagnement": 1}, {"kind": "start"}),
    ("the_noir", {"the_noir": 1, "accompagnement": 1}, {"kind": "start"}),
    ("chocolat", {"lait_entier": 200, "cacao": 15}, {"kind": "start"}),
    ("croissant", {"croissant_boulanger": 1}, {"kind": "start"}),
    ("pain_chocolat", {"pain_chocolat_boulanger": 1}, {"kind": "start"}),
    ("tartine", {"pain_campagne": 2, "beurre": 10, "confiture": 20}, {"kind": "start"}),
    ("tarte_fruits", {"tarte_boulanger": 1}, {"kind": "start"}),
    ("noisette", {"grains_maison": 7, "lait_entier": 20, "accompagnement": 1}, {"kind": "regular", "regular": "simone", "level": 0, "note": "Simone la montre le jour 2"}),
    ("cappuccino", {"grains_maison": 7, "lait_entier": 120, "cacao": 1, "accompagnement": 1}, {"kind": "purchase", "item": "fiche_cappuccino"}),
    ("the_vert", {"the_vert": 1, "accompagnement": 1}, {"kind": "purchase", "item": "fiche_the_vert"}),
    ("infusion", {"plantes_simone": 1, "accompagnement": 1}, {"kind": "regular", "regular": "simone", "level": 1}),
    ("citronnade", {"citrons": 1, "sucre": 15, "menthe": 1}, {"kind": "regular", "regular": "bastien", "level": 1}),
    ("jus_orange", {"oranges": 3}, {"kind": "purchase", "item": "presse_levier"}),
    ("limonade", {"limonade_bouteille": 1}, {"kind": "purchase", "item": "frigo_vitre"}),
    ("crepe", {"farine": 30, "lait_entier": 60, "oeufs": 0.5, "sucre": 10, "beurre": 5}, {"kind": "purchase", "item": "creperie"}),
]
# Jour (ouvert à l'adresse) où un habitué donne sa recette dans le duo simulé médian (lien atteint).
RECETTE_HABITUE_JOUR = {"noisette": 1, "infusion": 4, "citronnade": 6}


def cout_recette(ing: dict[str, float]) -> float:
    return round(sum(COUT[k] * q for k, q in ing.items()), 2)


# ---------------------------------------------------------------------------
# 2. Postes, machines et équipements achetables à Ormeval
# ---------------------------------------------------------------------------

# id, nom, prix, effet (vocabulaire du script cosy_cafe.py), palier, dimensions (l, p, h), pose, texte
EQUIPEMENTS = [
    ("gobelets", "Gobelets et couvercles (vente à emporter)", 40, "equip:gobelets", "t0", None, "stock", "La moitié des pressés repartent avec leur café, sans tasse à laver."),
    ("fiche_cappuccino", "Fiche « cappuccino »", 30, "recette:cappuccino", "t0", None, "none", "Mousse épaisse et cacao: le préféré des flâneurs."),
    ("fiche_the_vert", "Fiche « thé vert »", 20, "recette:the_vert", "t0", None, "none", "Eau à 80 degrés, pas plus: sinon il devient amer."),
    ("pichet_thermometre", "Pichet thermomètre", 60, "poste:vapeur:2", "t0", [0.10, 0.10, 0.15], "counter", "Le lait se lit d'un coup d'œil: deux laits à la fois sur la buse."),
    ("tabourets_zinc", "Deux tabourets de comptoir", 120, "equip:tabourets", "t0", [0.40, 0.40, 0.75], "floor", "Les voisins s'accoudent et restent un peu plus."),
    ("service_vaisselle", "Service de vaisselle (+24 pièces)", 90, "vaisselle:24", "t0", None, "stock", "Moins de courses à la plonge au coup de feu."),
    ("moulin_dose", "Moulin à dose", 380, "poste:espresso:2", "t1", [0.22, 0.35, 0.55], "counter", "La mouture tombe juste: on prépare deux cafés plus vite."),
    ("presse_levier", "Presse-agrumes à levier", 120, "poste:agrumes:1", "t1", [0.25, 0.25, 0.45], "counter", "Le jus d'orange pressé arrive à l'ardoise."),
    ("etagere_livres_equip", "Étagère à livres (avec les livres de Lise)", 150, "equip:livres", "t1", [1.00, 0.30, 1.80], "floor_wall", "Les flâneurs restent, un livre à la main."),
    ("creperie", "Crêpière", 180, "poste:creperie:1", "t2", [0.45, 0.45, 0.20], "counter", "Une plaque, une louche, et la salle sent le beurre."),
    ("range_velos", "Range-vélos", 180, "equip:range_velos", "t2", [1.80, 0.50, 0.80], "street", "Les cyclistes de la voie verte s'arrêtent enfin."),
    ("coin_enfants", "Chaise haute et coin des enfants", 260, "equip:chaise_haute;equip:coin_enfants", "t2", [1.20, 1.20, 0.60], "floor", "Des crayons, un tapis, une chaise haute: les familles restent au goûter."),
    ("frigo_vitre", "Réfrigérateur vitré", 350, "recette:limonade", "t2", [0.60, 0.60, 0.85], "work_area", "Les bouteilles fraîches se voient du comptoir."),
    ("bouilloire_temperature", "Bouilloire à température", 90, "poste:bouilloire:2", "t3", [0.20, 0.20, 0.30], "counter", "Elle s'arrête seule à la bonne température."),
]

EXTENSIONS_DEMO = [
    ("village_terrasse", "La terrasse sous le store", 450, "ext:village_terrasse", "t1", (0, 0, 0, 4), 12.0, 1,
     "Autorisation de la mairie, un store banne et deux guéridons sous le tilleul: 4 places dehors de plus."),
    ("village_fond", "La pièce du fond, au coin du feu", 600, "ext:village_fond", "t2", (0, 2, 2, 0), 12.8, 2,
     "Une arche percée dans le refend, la cheminée rallumée, deux fauteuils et une table pour deux: 4 places."),
]

# Paliers de déblocage: réputation (tasses) ou jour; les deux suffisent seuls, pour que rien ne bloque.
PALIERS = [
    {"id": "t0", "name": "À l'arrivée", "cups": 1.5, "orDay": 1},
    {"id": "t1", "name": "Deux tasses", "cups": 2.0, "orDay": 7},
    {"id": "t2", "name": "Deux tasses et demie", "cups": 2.5, "orDay": 9},
    {"id": "t3", "name": "Trois tasses", "cups": 3.0, "orDay": 12},
]

# ---------------------------------------------------------------------------
# 3. Catalogue de décoration et de mobilier (village)
# ---------------------------------------------------------------------------

# id, nom, catégorie, style, prix, charme, (l, p, h), pose, rotation (degrés), lourd, places (type, nombre), palier, texte
C = "campagne"; J = "jardin"; B = "bistrot"; N = "neutre"; R = "retro"; O = "nordique"
CATALOGUE = [
    # Assises
    ("chaise_paillee", "Chaise paillée", "seat", C, 45, 1, (0.45, 0.45, 0.90), "floor", 90, False, ("table", 1), "t0", "Le paillage fait main d'un artisan de la vallée."),
    ("chaise_cintree", "Chaise cintrée de bistrot", "seat", B, 60, 1, (0.45, 0.48, 0.88), "floor", 90, False, ("table", 1), "t0", "Bois courbé à la vapeur, dossier en boucle."),
    ("chaise_fer_peint", "Chaise de jardin en fer peint", "seat", J, 55, 1, (0.45, 0.48, 0.85), "floor_terrace", 90, False, ("table", 1), "t0", "Vert d'eau, ajourée: dedans comme dehors."),
    ("tabouret_bois", "Tabouret haut en chêne", "seat", C, 50, 1, (0.40, 0.40, 0.75), "floor", 15, False, ("counter", 1), "t1", "Pour s'accouder au zinc à hauteur de conversation."),
    ("banc_ferme", "Banc de ferme à coussins", "seat", C, 220, 3, (1.40, 0.45, 0.45), "floor", 90, True, ("table", 2), "t1", "Deux places, des coussins de lin: lourd, il se porte à deux."),
    ("banquette_moleskine", "Banquette de moleskine", "seat", B, 520, 4, (1.80, 0.55, 0.90), "floor_wall", 90, True, ("table", 3), "t2", "Contre un mur, trois places capitonnées couleur lie-de-vin."),
    ("fauteuil_crapaud", "Fauteuil crapaud en velours", "seat", C, 220, 3, (0.75, 0.75, 0.80), "floor", 15, True, ("comfort", 1), "t1", "Bas et profond: on y oublie l'heure."),
    ("fauteuil_rotin", "Fauteuil de rotin", "seat", J, 190, 3, (0.75, 0.75, 0.85), "floor_terrace", 15, False, ("comfort", 1), "t1", "Léger, il passe de la salle à la terrasse."),
    ("fauteuil_club", "Fauteuil club", "seat", B, 280, 3, (0.80, 0.80, 0.80), "floor", 15, True, ("comfort", 1), "t2", "Cuir patiné, accoudoirs ronds: lourd, il se porte à deux."),
    # Tables
    ("gueridon_marbre", "Guéridon au plateau de marbre", "table", B, 110, 2, (0.60, 0.60, 0.75), "floor_terrace", 90, False, None, "t0", "Le marbre vert-gris d'un café de quartier."),
    ("table_ferme", "Table de ferme pour quatre", "table", C, 180, 2, (1.20, 0.70, 0.75), "floor", 90, True, None, "t0", "Chêne miel, tiroir à couverts: elle se porte à deux."),
    ("table_fer_mosaique", "Table de fer à mosaïque", "table", J, 140, 2, (0.60, 0.60, 0.75), "floor_terrace", 90, False, None, "t1", "Un plateau de carreaux de ciment, un pied de fer peint."),
    ("table_basse_malle", "Malle de voyage en table basse", "table", C, 90, 1, (0.80, 0.45, 0.45), "floor", 90, False, None, "t1", "Devant les fauteuils: on y pose sa tasse et son livre."),
    ("table_bistrot_quatre", "Table de bistrot pour quatre", "table", B, 190, 2, (0.80, 0.80, 0.75), "floor", 90, False, None, "t1", "Pied de fonte, plateau de bois sombre."),
    # Luminaires
    ("suspension_osier", "Suspension d'osier", "light", C, 70, 2, (0.45, 0.45, 0.35), "ceiling", 0, False, None, "t0", "Elle dessine des losanges de lumière sur les tables."),
    ("globe_opalin", "Globe opalin", "light", B, 95, 2, (0.30, 0.30, 0.45), "ceiling", 0, False, None, "t0", "La lumière laiteuse des cafés d'autrefois."),
    ("cloche_verre", "Suspension-cloche de verre", "light", J, 85, 2, (0.35, 0.35, 0.40), "ceiling", 0, False, None, "t1", "Verre soufflé légèrement vert, comme une serre."),
    ("applique_laiton", "Applique de laiton", "light", B, 60, 1, (0.20, 0.25, 0.35), "wall", 0, False, None, "t0", "Un bras de laiton et un abat-jour plissé."),
    ("lampe_lin", "Lampe à poser, abat-jour de lin", "light", C, 80, 1, (0.30, 0.30, 0.55), "surface", 15, False, None, "t1", "Posée sur une étagère ou au bout du comptoir."),
    ("guirlande_guinguette", "Guirlande de guinguette", "light", J, 70, 1, (6.00, 0.10, 0.10), "terrace_store", 0, False, None, "t2", "Sous le store, quand le soir tombe sur la place."),
    # Plantes (neutres: elles vont avec tout)
    ("fougere_suspendue", "Fougère suspendue", "plant", N, 25, 1, (0.40, 0.40, 0.60), "ceiling", 15, False, None, "t0", "Elle aime la lumière de la vitrine."),
    ("pothos_etagere", "Pothos qui retombe", "plant", N, 15, 1, (0.25, 0.25, 0.30), "surface", 15, False, None, "t0", "À poser en hauteur: il descend en cascade."),
    ("bouquet_champetre", "Bouquet des champs", "plant", N, 12, 1, (0.20, 0.20, 0.35), "surface", 15, False, None, "t0", "Coquelicots et marguerites dans un pot à lait."),
    ("geraniums_vitrine", "Jardinière de géraniums", "plant", N, 40, 1, (0.80, 0.20, 0.25), "window_sill", 0, False, None, "t0", "Sur l'appui de la vitrine, côté place."),
    ("citronnier_pot", "Citronnier en pot de terre cuite", "plant", J, 160, 3, (0.60, 0.60, 1.40), "floor_terrace", 15, True, None, "t1", "Il fleurit au printemps: la salle sent bon."),
    ("olivier_pot", "Grand olivier en pot", "plant", J, 340, 6, (0.90, 0.90, 2.00), "floor_terrace", 15, True, None, "t2", "Pièce maîtresse du jardin: lourd, il se porte à deux."),
    # Murs: cadres, miroirs, horloges
    ("affiche_tilleul_1962", "Affiche de la fête du Tilleul, 1962", "frame", N, 35, 1, (0.50, 0.03, 0.70), "wall", 0, False, None, "t0", "Trouvée au grenier de la mairie."),
    ("assiettes_faience", "Assiettes de faïence au mur", "frame", C, 55, 2, (0.90, 0.04, 0.60), "wall", 0, False, None, "t0", "Bleu faïence et fleurs naïves, cinq assiettes."),
    ("herbier_encadre", "Herbier encadré", "frame", J, 45, 1, (0.40, 0.03, 0.55), "wall", 0, False, None, "t1", "Les plantes de la vallée, nommées à la plume."),
    ("miroir_peint", "Miroir de bistrot à lettres peintes", "frame", B, 240, 3, (1.20, 0.05, 0.90), "wall", 0, True, None, "t2", "« Café, thé, chocolat » en lettres d'or sur le tain."),
    ("horloge_ecole", "Horloge d'école", "frame", N, 50, 1, (0.35, 0.06, 0.35), "wall", 0, False, None, "t0", "Visible du comptoir: on sait quand passe le car."),
    # Tapis
    ("tapis_lirette", "Tapis de lirette", "rug", C, 60, 1, (1.20, 1.80, 0.01), "floor_under", 90, False, None, "t0", "Tissé de vieux draps colorés."),
    ("tapis_jonc", "Tapis de jonc", "rug", J, 70, 1, (1.40, 2.00, 0.01), "floor_under", 90, False, None, "t1", "Il sent l'été, même en avril."),
    # Rangements et pièces maîtresses
    ("etagere_pots", "Étagère de planches et de pots", "shelf", C, 90, 2, (1.00, 0.25, 0.90), "wall", 0, False, None, "t0", "Pots de confiture, bocaux, une louche de cuivre."),
    ("vaisselier_sauge", "Vaisselier peint en sauge", "shelf", C, 650, 6, (1.40, 0.50, 2.00), "floor_wall", 90, True, None, "t2", "Pièce maîtresse de la campagne: il se porte à deux."),
    ("desserte_zinc", "Desserte de zinc", "shelf", B, 210, 3, (1.00, 0.45, 0.95), "floor_wall", 90, True, None, "t1", "Un plateau de zinc, des bouteilles de sirop alignées."),
    # Revêtements (prix au mur ou au m²; ne comptent pas dans la limite d'objets)
    ("peinture_lin", "Peinture lin écru (un mur)", "paint", C, 40, 1, None, "wall_cover", 0, False, None, "t0", "Doux et clair: la salle paraît plus grande."),
    ("peinture_vert_eau", "Peinture vert d'eau (un mur)", "paint", J, 40, 1, None, "wall_cover", 0, False, None, "t0", "La couleur des volets du village."),
    ("peinture_lie_de_vin", "Peinture lie-de-vin (un mur)", "paint", B, 40, 1, None, "wall_cover", 0, False, None, "t0", "Sombre et chaude, sous les appliques."),
    ("peinture_chaux", "Badigeon de chaux blanche (un mur)", "paint", N, 30, 0, None, "wall_cover", 0, False, None, "t0", "Il rafraîchit la pierre sans rien dire."),
    ("papier_fleurs_champs", "Papier peint fleurs des champs (un mur)", "wallpaper", C, 90, 3, None, "wall_cover", 0, False, None, "t1", "Petites fleurs sur fond lin."),
    ("papier_feuillage", "Papier peint feuillage (un mur)", "wallpaper", J, 90, 3, None, "wall_cover", 0, False, None, "t1", "De grandes feuilles vert profond."),
    ("papier_rayures_creme", "Papier peint rayures crème (un mur)", "wallpaper", B, 90, 3, None, "wall_cover", 0, False, None, "t1", "Rayures crème et caramel, sous une cimaise."),
    ("sol_tomettes", "Tomettes (le m²)", "floor", C, 25, 0.2, None, "floor_cover", 0, False, None, "t1", "Terre cuite hexagonale, patinée."),
    ("sol_carreaux_ciment", "Carreaux de ciment (le m²)", "floor", J, 25, 0.2, None, "floor_cover", 0, False, None, "t1", "Motifs de rosaces vert et crème."),
    ("sol_damier", "Carrelage en damier (le m²)", "floor", B, 25, 0.2, None, "floor_cover", 0, False, None, "t1", "Noir et crème, comme au zinc d'autrefois."),
    # Comptoir
    ("cloche_gateaux", "Cloche à gâteaux", "counter_object", C, 45, 1, (0.30, 0.30, 0.35), "counter", 15, False, None, "t0", "La tarte du jour se voit dès la porte."),
    ("caisse_ancienne", "Caisse enregistreuse ancienne", "counter_object", B, 140, 2, (0.40, 0.40, 0.35), "counter", 15, False, None, "t1", "Elle ne sert plus, mais quel tintement."),
    ("bocal_biscuits", "Bocal à biscuits de verre", "counter_object", N, 20, 1, (0.20, 0.20, 0.30), "counter", 15, False, None, "t0", "Les sablés de Lucas, à la pièce."),
    ("pot_pourboires_gres", "Pot à pourboires en grès", "counter_object", C, 25, 1, (0.15, 0.15, 0.18), "counter_tip", 15, False, None, "t0", "Le tintement des pièces s'entend des deux côtés du comptoir."),
    # Façade et terrasse
    ("enseigne_bois_peint", "Enseigne de bois peint, au nom de la maison", "sign", C, 180, 2, (1.80, 0.05, 0.50), "facade", 0, False, None, "t1", "Le nom choisi à deux, peint à la main."),
    ("enseigne_fer_forge", "Enseigne potence de fer forgé, au nom de la maison", "sign", J, 220, 2, (0.70, 0.70, 0.08), "facade", 0, False, None, "t1", "Une tasse découpée dans le fer, qui se balance au vent."),
    ("enseigne_lettres_dorees", "Lettres dorées sur la vitrine, au nom de la maison", "sign", B, 200, 2, (2.00, 0.01, 0.40), "vitrine", 0, False, None, "t1", "Dorure à la feuille, comme les cafés de la ville."),
    ("jardinieres_terrasse", "Jardinières de terrasse", "terrace", N, 60, 1, (0.80, 0.30, 0.40), "terrace", 90, False, None, "t2", "Elles bordent la terrasse côté fontaine."),
    ("parasol_toile", "Parasol de toile écrue", "terrace", J, 120, 1, (2.00, 2.00, 2.30), "terrace", 0, False, None, "t2", "Pour la table qui dépasse du store."),
    # Brocante (le lundi, -30 %, charme x1,5: les prix et charmes ici sont ceux de la brocante)
    ("brocante_lampe_champignon", "Lampe champignon orange", "light", R, 49, 3, (0.30, 0.30, 0.40), "surface", 15, False, None, "brocante", "Années soixante-dix pur jus: elle jure avec la campagne."),
    ("brocante_chaises_coques", "Deux chaises coques", "seat", R, 84, 3, (0.50, 0.50, 0.80), "floor", 90, False, ("table", 2), "brocante", "Moutarde et pied de teck."),
    ("brocante_banc_nordique", "Banc de frêne à coussins", "seat", O, 133, 4, (1.20, 0.40, 0.45), "floor", 90, True, ("table", 2), "brocante", "Frêne miel et laine grise."),
    ("brocante_horloge_comtoise", "Horloge comtoise", "frame", C, 245, 9, (0.50, 0.30, 2.20), "floor_wall", 0, True, None, "brocante", "Elle sonne les heures, un peu en retard."),
    ("brocante_moulin_cafe", "Moulin à café de cuivre", "counter_object", C, 35, 3, (0.20, 0.20, 0.35), "counter", 15, False, None, "brocante", "Il ne moud plus, il fait rêver."),
    ("brocante_plaque_emaillee", "Plaque émaillée « Chocolat chaud »", "frame", B, 56, 4, (0.60, 0.02, 0.40), "wall", 0, False, None, "brocante", "Un peu écaillée, d'autant plus belle."),
]

# Pièces uniques (cadeaux des habitués et des événements): charme, style, d'où elles viennent
UNIQUES = [
    ("aquarelle_simone", "L'aquarelle de Simone: la place du Tilleul", "frame", N, 5, (0.50, 0.03, 0.40), "wall", "regular:simone:2", "Simone la peint depuis son banc, au printemps."),
    ("dessins_noe", "Les dessins de Noé, encadrés", "frame", N, 4, (0.70, 0.03, 0.50), "wall", "regular:farida_noe:2", "Le café vu par Noé: le chien de Bastien est plus grand que la maison."),
    ("ecuelle_gribouille", "L'écuelle de Gribouille", "terrace", N, 1, (0.25, 0.25, 0.08), "terrace", "regular:bastien:1", "Une écuelle d'eau sous la terrasse: les chiens des randonneurs la trouvent seuls."),
    ("carte_postale_brissac", "La carte postale d'Octave Brissac", "frame", N, 2, (0.15, 0.01, 0.10), "wall", "event:le_car_de_8h12", "« Arrivé à l'heure. Merci, le café de la place. »"),
    ("joint_encadre", "Le vieux joint de la machine, encadré", "frame", N, 2, (0.25, 0.03, 0.25), "wall", "event:la_vieille_dame_tousse", "Simone a insisté pour qu'on le garde."),
    ("fanion_godillots", "Le fanion des Godillots de l'Arvelle", "frame", N, 2, (0.40, 0.02, 0.30), "wall", "event:les_godillots", "Brodé main, offert par le club."),
    ("coupure_echo", "L'article de « L'Écho de l'Arvelle »", "frame", N, 3, (0.30, 0.02, 0.40), "wall", "event:le_carnet_vert", "Encadré par Lise, bien sûr."),
    ("moulin_mamie_odile", "Le moulin à poivre de Mamie Odile", "counter_object", C, 3, (0.08, 0.08, 0.25), "counter", "event:jules_a_perdu_sa_mamie", "« Pour vous remercier, et ne riez pas, il a cent ans. »"),
    ("plaque_hygiene", "La plaque « Hygiène: très satisfaisant »", "frame", N, 1, (0.20, 0.01, 0.15), "wall", "event:l_inspection", "Officielle, et un peu fière."),
    ("photo_maries", "La photo des mariés sous le tilleul", "frame", N, 3, (0.30, 0.02, 0.40), "wall", "event:le_cafe_d_honneur", "Nadia et Paul, et tout le village derrière."),
    ("pichet_argent", "Le pichet d'argent du concours", "counter_object", N, 3, (0.12, 0.12, 0.18), "counter", "event:le_coeur_de_lait", "Gravé « Ormeval, premier concours du cœur de lait »."),
    ("lanterne_tilleul", "La lanterne de la fête du Tilleul", "light", J, 4, (0.30, 0.30, 0.50), "terrace_store", "event:la_fete_du_tilleul", "Celle qui pendait au-dessus de l'orchestre."),
]

# Mobilier de Simone à l'arrivée: id, quantité, usé (le charme compte à moitié tant qu'il n'est pas rénové)
DEPART_MOBILIER = [("chaise_paillee", 8, True), ("gueridon_marbre", 3, True), ("table_ferme", 1, True),
                   ("applique_laiton", 1, True), ("horloge_ecole", 1, False), ("bocal_biscuits", 1, False)]
RENOVATION = {"chaise_paillee": 15, "gueridon_marbre": 30, "table_ferme": 40, "applique_laiton": 20}

# ---------------------------------------------------------------------------
# 4. Réglages d'économie de la démo
# ---------------------------------------------------------------------------

ECONOMIE = {
    "startCash": 300,
    "rentPerMonth": 520,
    "rentDaysPerMonth": 28,
    "chargesPerOpenDay": 8,
    "reserveDaysOfCharges": 2,
    "emergencySurcharge": 0.30,
    "priceAdjust": {"min": -0.30, "max": 0.50, "step": 0.10},
    "bigPurchaseThreshold": {"minimum": 150, "shareOfDailyRevenue": 1.0},
    "reputation": {"startCups": 1.5, "stepPoints": 150, "pivotSatisfaction": 50, "divisor": 10,
                   "catchUp": {"afterOpenDays": 12, "perDay": 0.05, "max": 2.0}},
    "offer": {"to": "bourg", "renown": 850, "fallback": "la_fete_du_tilleul"},
    "challenge": {"id": "la_fete_du_tilleul", "day": 14, "affluence": 1.6, "renown": 150, "goals": {"groups": 45, "terrace": True, "cups": 3.0}},
    "ambiance": {"publicSurfaceM2": {"salle": 26.0, "village_terrasse": 0.0, "village_fond": 12.8}, "terraceNote": "la terrasse ne dilue pas le décor de la salle: ses objets ajoutent leur charme sans agrandir la surface comptée",
                 "decorMax": 40, "charmPerM2ForMax": 1.2, "coherenceMax": 20, "comfortFactor": 30, "comfortMax": 15,
                 "lightPerM2": 8, "lightMax": 10, "music": {"matching": 5, "other": 2, "silence": 0},
                 "cleanlinessMax": 10, "cleanlinessAssumedInSim": 8, "wornCharmFactor": 0.5},
    "brocante": {"piecesPerMonday": 6, "discount": 0.30, "charmFactor": 1.5},
    "flowerMarket": {"day": 6, "plantDiscount": 0.20, "untilDay": 12},
    "objectLimit": 60,
    "demoEndDay": 15,
    "demoMaxDay": 28,
}

# ---------------------------------------------------------------------------
# 5. Écriture des fichiers JSON
# ---------------------------------------------------------------------------


def ecrire(nom: str, contenu: object) -> None:
    (DONNEES / nom).write_text(json.dumps(contenu, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def donnees(cc: object) -> None:
    rec = {r.id: r for r in cc.RECETTES}
    familles = {"noir": "black_coffee", "lait": "milk_coffee", "the": "tea", "chocolat": "chocolate", "frais": "cold_drink",
                "viennoiserie": "pastry_bread", "patisserie": "cake", "sale": "savory", "specialite": "specialty"}
    recettes = []
    for rid, ing, unlock in RECETTES_DEMO:
        r = rec[rid]
        recettes.append({
            "id": rid, "name": r.nom, "family": familles.get(r.famille, r.famille),
            "basePrice": r.prix, "costMaterials": cout_recette(ing),
            "ingredients": [{"id": k, "qty": q} for k, q in ing.items()],
            "dishes": r.vaisselle, "sequential": r.sequentiel,
            "steps": [{"station": e.poste, "activeSeconds": list(e.actif), "passiveSeconds": list(e.passif), "finishSeconds": list(e.fin)} for e in r.etapes],
            "unlock": unlock,
            "options": (["oat_milk"] if "lait_entier" in ing and rid not in ("crepe",) else []) + (["decaf"] if "grains_maison" in ing else []),
        })
    ecrire("recettes.json", {"format": "deux-tabliers.recipes", "version": "demo-0.1", "recipes": recettes})
    ecrire("ingredients-fournisseurs.json", {
        "format": "deux-tabliers.ingredients", "version": "demo-0.1",
        "ingredients": [{"id": i, "name": n, "unit": u, "unitCost": c, "supplier": s, "storage": st, "shelfDays": d,
                         "cartonUnits": cu, "cartonHeavy": h} for i, n, u, c, s, st, d, cu, h in INGREDIENTS],
        "suppliers": FOURNISSEURS,
        "ordering": {"when": "closing", "deliveredBefore": "preparation", "suggestion": "average_of_last_3_days_plus_planned_menu",
                     "emergencyDeliveryGameMinutes": 60, "emergencySurcharge": ECONOMIE["emergencySurcharge"],
                     "unsoldFreshGoTo": "evening_basket", "eveningBasketReputationPerItem": 1, "eveningBasketMaxPerDay": 20},
    })
    ecrire("postes-equipements.json", {
        "format": "deux-tabliers.equipment", "version": "demo-0.1",
        "stationsAtStart": {"espresso": 1, "vapeur": 1, "bouilloire": 1, "vitrine": 1, "plan": 1, "frigo": 1, "sink": 1, "registers": 1, "dishes": 36},
        "stationNames": {"espresso": "La vieille machine de Simone (deux groupes)", "vapeur": "Buse vapeur", "bouilloire": "Bouilloire", "vitrine": "Vitrine du comptoir",
                         "plan": "Plan de travail", "frigo": "Réfrigérateur du bar", "agrumes": "Presse-agrumes", "creperie": "Crêpière"},
        "purchases": [{"id": i, "name": n, "price": p, "effect": e, "tier": t, "size": s, "placement": pl, "text": tx} for i, n, p, e, t, s, pl, tx in EQUIPEMENTS],
        "extensions": [{"id": i, "name": n, "price": p, "effect": e, "tier": t, "seats": {"counter": s[0], "table": s[1], "comfort": s[2], "terrace": s[3]},
                        "publicSurfaceM2": m2, "nightsOfWork": nuits, "text": tx} for i, n, p, e, t, s, m2, nuits, tx in EXTENSIONS_DEMO],
        "tiers": PALIERS,
    })
    poses = {"floor": "sol de la salle", "floor_terrace": "sol de la salle ou de la terrasse", "floor_wall": "sol, dos au mur",
             "floor_under": "sol, sous les meubles", "wall": "mur libre", "ceiling": "plafond (entre les solives)", "surface": "emplacement d'un meuble ou du comptoir",
             "counter": "emplacement du comptoir côté clients", "counter_tip": "emplacement du pot à pourboires", "window_sill": "appui de la vitrine",
             "wall_cover": "un mur entier", "floor_cover": "le sol d'une pièce", "facade": "façade, au-dessus de la vitrine", "vitrine": "vitre de la vitrine",
             "terrace": "zone de terrasse", "terrace_store": "sous le store de la terrasse", "street": "trottoir, contre la façade"}
    items = []
    for x in CATALOGUE:
        i, n, cat, st, p, ch, dim, pl, rot, lourd, places, palier, tx = x
        it = {"id": i, "name": n, "category": cat, "style": st, "price": p, "charm": ch,
              "size": ({"w": dim[0], "d": dim[1], "h": dim[2]} if dim else None),
              "placement": pl, "rotationStep": rot, "heavy": lourd, "unlock": ({"source": "brocante"} if palier == "brocante" else {"tier": palier}),
              "text": tx}
        if places:
            it["seats"] = {"type": places[0], "count": places[1]}
        if cat in ("paint", "wallpaper"):
            it["priceUnit"] = "wall"
        elif cat == "floor":
            it["priceUnit"] = "m2"
            it["charmUnit"] = "m2"
        if i in RENOVATION:
            it["renovationPrice"] = RENOVATION[i]
        items.append(it)
    for i, n, cat, st, ch, dim, pl, src, tx in UNIQUES:
        items.append({"id": i, "name": n, "category": cat, "style": st, "price": 0, "charm": ch,
                      "size": {"w": dim[0], "d": dim[1], "h": dim[2]}, "placement": pl, "rotationStep": 0, "heavy": False,
                      "unique": True, "unlock": {"source": src.split(":")[0], "ref": ":".join(src.split(":")[1:])}, "text": tx})
    ecrire("catalogue.json", {
        "format": "deux-tabliers.catalogue", "version": "demo-0.1", "address": "village",
        "styles": ["campagne", "jardin", "nordique", "retro", "bistrot", "atelier"],
        "placements": poses,
        "placementRules": {"gridMeters": 0.25, "clearanceToSeat": 0.9, "mainAisle": 1.2, "minPassage": 0.6,
                           "smallApplianceMaxDistanceToOutlet": 1.5, "heavySoloSlideMax": 1.0, "objectLimit": ECONOMIE["objectLimit"],
                           "visibleLimit": 150, "coveringsCountInLimit": False, "occupiedFurnitureLockedDuringService": True},
        "startFurniture": [{"id": i, "count": n, "worn": w} for i, n, w in DEPART_MOBILIER],
        "items": items,
    })
    flux = cc.FLUX_BASE["village"]
    signes = {"presses": "sacoche ou mallette, montre regardée", "voisins": "journal plié ou cabas, accoudé au comptoir", "flaneurs": "livre sous le bras",
              "familles": "enfants, poussette ou cartable", "gourmands": "regard posé sur la vitrine", "promeneurs": "sac à dos, bâtons ou casque de vélo",
              "etudiants": "sac couvert de badges", "teletravail": "sacoche d'ordinateur", "brunch": "groupe du dimanche", "connaisseurs": "carnet de dégustation"}
    ecrire("profils.json", {"format": "deux-tabliers.profiles", "version": "demo-0.1",
        "note": "copie du cahier (table profils) avec le flux d'Ormeval; étudiants, télétravailleurs, bruncheurs et connaisseurs sont presque absents du village",
        "profiles": [{"id": q.id, "name": q.nom, "seeks": q.cherche, "mainCraving": familles.get(q.principal, q.principal),
                      "secondaryCravings": [familles.get(x, x) for x in q.secondaires], "seat": q.place, "priceSensitivity": q.sensibilite,
                      "patienceSeconds": q.patience, "waitWithoutPenaltySeconds": q.confort, "stayGameMinutes": list(q.sejour),
                      "groupSizes": [{"size": a, "share": b} for a, b in q.tailles], "eatsShare": q.p_nourriture, "takeAwayShare": q.emporter,
                      "reorder": ({"everyGameMinutes": q.recommande[0], "probability": q.recommande[1]} if q.recommande[0] else None),
                      "styles": list(q.styles), "wantedEquipment": list(q.equipements), "tipFactor": q.pourboire,
                      "villageGroupsPerDay": flux[q.id], "visualSign": signes.get(q.id, "")} for q in cc.PROFILS]})
    ecrire("reglages-economie.json", {"format": "deux-tabliers.economy", "version": "demo-0.1", **ECONOMIE})


# ---------------------------------------------------------------------------
# 6. Simulation de la démo (lit les JSON)
# ---------------------------------------------------------------------------

ROUE = ["campagne", "jardin", "nordique", "retro", "bistrot", "atelier"]


def coherence(points: dict[str, float]) -> tuple[str, float]:
    stylés = {k: v for k, v in points.items() if k in ROUE and v > 0}
    if not stylés:
        return "campagne", 0.0
    dom = max(stylés, key=lambda k: stylés[k])
    i = ROUE.index(dom)
    vois = {ROUE[(i + 1) % 6], ROUE[(i - 1) % 6]}
    opp = ROUE[(i + 3) % 6]
    tot = sum(stylés.values())
    v = stylés[dom] + 0.5 * sum(stylés.get(k, 0) for k in vois) - 0.5 * stylés.get(opp, 0)
    return dom, max(0.0, min(1.0, v / tot))


@dataclasses.dataclass
class Maison:
    caisse: float
    points: float = 0.0
    tasses: float = 1.5
    renommee: float = 0.0
    achats: list = dataclasses.field(default_factory=list)  # (jour, id, prix)
    possede: set = dataclasses.field(default_factory=set)
    deco: list = dataclasses.field(default_factory=list)  # (id, charme, style, zone)
    places: list = dataclasses.field(default_factory=lambda: [0, 8, 0, 2])
    niveaux: dict = dataclasses.field(default_factory=dict)
    equip: set = dataclasses.field(default_factory=set)
    connues: set = dataclasses.field(default_factory=set)
    zones: set = dataclasses.field(default_factory=lambda: {"salle"})
    travaux: list = dataclasses.field(default_factory=list)
    vaisselle: int = 36
    sat_hier: float = 70.0
    lumieres: int = 1
    affluence_bonus: list = dataclasses.field(default_factory=list)  # (jusqu'au jour, facteur)
    offre: int = 0
    journal: list = dataclasses.field(default_factory=list)


def ambiance(m: Maison, eco: dict) -> tuple[float, str, float]:
    a = eco["ambiance"]
    surf = sum(a["publicSurfaceM2"][z] for z in m.zones)
    pts: dict[str, float] = {}
    charme = 0.0
    for _, ch, st, _ in m.deco:
        charme += ch
        pts[st] = pts.get(st, 0) + ch
    decor = min(a["decorMax"], a["decorMax"] * charme / (a["charmPerM2ForMax"] * surf))
    dom, coh = coherence(pts)
    places = sum(m.places)
    confort = min(a["comfortMax"], a["comfortFactor"] * m.places[2] / max(1, places))
    lum = min(a["lightMax"], a["lightMax"] * m.lumieres / (surf / a["lightPerM2"]))
    musique = a["music"]["matching"] if dom == "campagne" else a["music"]["other"]  # la radio a une station « campagne »
    total = decor + a["coherenceMax"] * coh + confort + lum + musique + a["cleanlinessAssumedInSim"]
    return min(95.0, total), dom, coh


def tasses(points: float, eco: dict) -> float:
    r = eco["reputation"]
    k = 0
    while r["stepPoints"] * (k + 1) * (k + 2) / 2 <= points and r["startCups"] + 0.5 * (k + 1) <= 5.0:
        k += 1
    return r["startCups"] + 0.5 * k


def palier_ouvert(m: Maison, palier: str, jour: int, paliers: dict) -> bool:
    if palier == "brocante":
        return False
    p = paliers[palier]
    return m.tasses >= p["cups"] or jour >= p["orDay"]


# Listes d'envies des duos simulés: (id, source). « eq » = équipement ou extension, « de » = catalogue.
# Ordre « équilibre »: un achat utile, puis de quoi rendre la salle plus belle; « décor d'abord »: l'inverse.
ENVIES = {
    "equilibre": [("eq", "gobelets"), ("eq", "fiche_cappuccino"), ("de", "renover_chaises"), ("eq", "pichet_thermometre"), ("de", "suspension_osier"),
                  ("de", "bouquet_champetre"), ("eq", "fiche_the_vert"), ("de", "assiettes_faience"), ("eq", "presse_levier"), ("de", "peinture_lin"),
                  ("de", "fauteuil_crapaud"), ("eq", "moulin_dose"), ("de", "tapis_lirette"), ("eq", "village_terrasse"), ("eq", "village_fond"), ("eq", "creperie"),
                  ("de", "etagere_pots"), ("eq", "etagere_livres_equip"), ("de", "fauteuil_crapaud"), ("eq", "coin_enfants"), ("de", "papier_fleurs_champs"),
                  ("eq", "range_velos"), ("de", "vaisselier_sauge"), ("eq", "frigo_vitre"), ("eq", "tabourets_zinc")],
    "decor": [("eq", "gobelets"), ("de", "renover_chaises"), ("de", "suspension_osier"), ("de", "assiettes_faience"), ("de", "bouquet_champetre"),
              ("de", "fauteuil_crapaud"), ("eq", "fiche_cappuccino"), ("de", "peinture_lin"), ("de", "tapis_lirette"), ("de", "fauteuil_crapaud"),
              ("eq", "pichet_thermometre"), ("de", "etagere_pots"), ("eq", "village_terrasse"), ("eq", "village_fond"), ("de", "papier_fleurs_champs"), ("de", "vaisselier_sauge"),
              ("eq", "presse_levier"), ("eq", "creperie"), ("eq", "etagere_livres_equip"), ("eq", "moulin_dose"), ("eq", "coin_enfants"),
              ("eq", "range_velos"), ("eq", "frigo_vitre")],
    "coin_du_feu": [("eq", "gobelets"), ("eq", "fiche_cappuccino"), ("de", "renover_chaises"), ("eq", "pichet_thermometre"), ("de", "suspension_osier"),
                    ("de", "bouquet_champetre"), ("eq", "fiche_the_vert"), ("de", "assiettes_faience"), ("eq", "presse_levier"), ("eq", "village_terrasse"),
                    ("eq", "village_fond"), ("de", "fauteuil_crapaud"), ("eq", "moulin_dose"), ("de", "tapis_lirette"), ("eq", "creperie"), ("de", "etagere_pots"),
                    ("eq", "etagere_livres_equip"), ("eq", "coin_enfants"), ("eq", "range_velos"), ("de", "vaisselier_sauge"), ("eq", "frigo_vitre")],
    "machines": [("eq", "gobelets"), ("eq", "fiche_cappuccino"), ("eq", "pichet_thermometre"), ("eq", "moulin_dose"), ("eq", "presse_levier"),
                 ("eq", "fiche_the_vert"), ("de", "renover_chaises"), ("eq", "village_terrasse"), ("eq", "creperie"), ("de", "suspension_osier"),
                 ("eq", "tabourets_zinc"), ("eq", "etagere_livres_equip"), ("de", "fauteuil_crapaud"), ("eq", "coin_enfants"), ("eq", "range_velos"),
                 ("de", "assiettes_faience"), ("eq", "village_fond"), ("eq", "frigo_vitre"), ("de", "vaisselier_sauge")],
}


def jouer(cc: object, duo: object, ordre: str, graine: int, d: dict) -> Maison:
    eco, cat, eqp = d["eco"], d["cat"], d["eqp"]
    rng = random.Random(graine)
    items = {x["id"]: x for x in cat["items"]}
    achats = {x["id"]: x for x in eqp["purchases"]}
    exts = {x["id"]: x for x in eqp["extensions"]}
    paliers = {p["id"]: p for p in eqp["tiers"]}
    m = Maison(caisse=eco["startCash"])
    m.niveaux = {k: v for k, v in eqp["stationsAtStart"].items() if k in cc.POSTES_BAR | cc.POSTES_CUISINE}
    m.connues = {r["id"] for r in d["rec"]["recipes"] if r["unlock"]["kind"] == "start"}
    for f in cat["startFurniture"]:
        it = items[f["id"]]
        for _ in range(f["count"]):
            m.deco.append((f["id"], it["charm"] * (eco["ambiance"]["wornCharmFactor"] if f["worn"] else 1), it["style"], "salle"))
    adr = cc.ADR["village"]
    loyer = eco["rentPerMonth"] / eco["rentDaysPerMonth"]
    envies = list(ENVIES[ordre])
    defi = eco["challenge"]
    jours_ouverts = 0
    for jour in range(1, eco["demoEndDay"] + 1):
        js = (jour - 1) % 7
        m.caisse -= loyer
        prets = [x for x, jp in m.travaux if jp <= jour]
        m.travaux = [(x, jp) for x, jp in m.travaux if jp > jour]
        if True:
            for ext in prets:
                e = exts[ext]
                m.places = [a + b for a, b in zip(m.places, (e["seats"]["counter"], e["seats"]["table"], e["seats"]["comfort"], e["seats"]["terrace"]))]
                m.zones.add(ext)
                if ext == "village_fond":
                    m.deco.append(("cheminee", 4, "campagne", ext))
                    m.lumieres += 1
                if ext == "village_terrasse":
                    m.deco.append(("store", 2, "neutre", ext))
        if js == 0:
            m.journal.append({"jour": jour, "lundi": True, "caisse": m.caisse, "tasses": m.tasses, "renommee": m.renommee})
            continue
        # recettes des habitués
        for rid, n in RECETTE_HABITUE_JOUR.items():
            if jours_ouverts >= n - 1:
                m.connues.add(rid)
        amb, dom, coh = ambiance(m, eco)
        fac = 1.0
        for fin, f in m.affluence_bonus:
            if jour <= fin:
                fac *= f
        ev_fixe = EVENEMENTS_SIM.get(jour, {})
        fac *= ev_fixe.get("affluence", 1.0)
        if jour == defi["day"]:
            fac *= defi["affluence"]
        cafe = cc.Cafe("village", dict(m.niveaux), 1, 1, list(m.places), m.vaisselle, set(m.equip), amb, m.tasses)
        carte = cc.choisir_carte(cafe, m.connues, 0)
        meteo = cc.tirer_meteo(rng, 0)
        etat = cc.Etat(carte, 1.0, amb, dom, coh, set(m.equip), m.tasses, m.sat_hier, duo.affluence * fac)
        cfg = cc.Config("village", dict(m.niveaux), 1, False, tuple(m.places), m.vaisselle, [], etat, 1)
        s = cc.Service(cfg, duo, rng, js, 0, meteo)
        s.run(cc.demande(adr, etat, js, 0, meteo))
        b = s.bilan()
        net = b["recette"] + b["pourboires"] - b["cout"] - eco["chargesPerOpenDay"]
        pts = sum(max(0.0, (x - eco["reputation"]["pivotSatisfaction"]) / eco["reputation"]["divisor"]) for x in s.satisfactions)
        cu = eco["reputation"]["catchUp"]
        au_dela = jours_ouverts + 1 - cu["afterOpenDays"]
        if au_dela > 0:
            pts *= min(cu["max"], 1 + cu["perDay"] * au_dela)
        # événements: récompenses selon le duo (lent: réussi, médian: réussi, rapide: formidable)
        grade = {"lent": 0.8, "median": 1.0, "rapide": 1.3}[duo.id]
        ev = ev_fixe
        if ev:
            net += ev.get("euros", 0) * grade
            pts += ev.get("points", 0) * grade
            if "bonus" in ev:
                m.affluence_bonus.append((jour + ev["bonus"][0], ev["bonus"][1]))
        if jour == defi["day"]:
            m.renommee += defi["renown"]
        m.points += pts
        m.renommee += pts
        m.tasses = tasses(m.points, eco)
        m.sat_hier = b["satisfaction"] if s.satisfactions else m.sat_hier
        m.caisse += net
        jours_ouverts += 1
        if not m.offre and m.renommee >= eco["offer"]["renown"]:
            m.offre = jour
        if jour == defi["day"] and not m.offre:
            m.offre = jour  # René apporte la lettre à la fête (repli)
        # achats à la fermeture: la terrasse passe en tête une fois ouverte au palier (la fête approche)
        reserve = eco["reserveDaysOfCharges"] * (loyer + eco["chargesPerOpenDay"])
        if jour >= 9 and ("eq", "village_terrasse") in envies:
            envies.remove(("eq", "village_terrasse"))
            envies.insert(0, ("eq", "village_terrasse"))
        while envies:
            src, iid = envies[0]
            if iid == "renover_chaises":
                prix, palier = 8 * RENOVATION["chaise_paillee"], "t0"
            elif src == "eq":
                x = achats.get(iid) or exts[iid]
                prix, palier = x["price"], x["tier"]
            else:
                x = items[iid]
                prix, palier = x["price"] * (3 if x["category"] in ("paint", "wallpaper") else 1), x["unlock"]["tier"]
                if x["category"] == "plant" and eco["flowerMarket"]["day"] <= jour <= eco["flowerMarket"]["untilDay"]:
                    prix *= 1 - eco["flowerMarket"]["plantDiscount"]
            if not palier_ouvert(m, palier, jour, paliers):
                # rien n'attend: on regarde l'envie suivante, celle-ci reste en tête
                suiv = next((e for e in envies[1:] if _palier(e, achats, exts, items) and palier_ouvert(m, _palier(e, achats, exts, items), jour, paliers)), None)
                if suiv is None:
                    break
                envies.remove(suiv)
                envies.insert(0, suiv)
                continue
            if m.caisse - reserve < prix:
                break
            m.caisse -= prix
            envies.pop(0)
            m.achats.append((jour, iid, prix))
            if iid == "renover_chaises":
                m.deco = [(i, items[i]["charm"] if i == "chaise_paillee" else ch, st, z) for i, ch, st, z in m.deco]
            elif src == "eq" and iid in exts:
                m.travaux.append((iid, jour + exts[iid]["nightsOfWork"]))
            elif src == "eq":
                appliquer(m, achats[iid]["effect"])
            else:
                x = items[iid]
                ch = x["charm"] * (3 if x["category"] in ("paint", "wallpaper") else 1)
                m.deco.append((iid, ch, x["style"], "salle"))
                if x["category"] == "light":
                    m.lumieres += 1
                if iid == "fauteuil_crapaud":
                    m.places[1] -= 1
                    m.places[2] += 1
                    if m.places[2] >= 2:
                        m.equip.add("fauteuils")
        m.journal.append({"jour": jour, "lundi": False, "net": net, "recette": b["recette"], "cout": b["cout"], "pourboires": b["pourboires"],
                          "servis": b["servis"], "repartis": b["repartis"], "satisfaction": b["satisfaction"], "caisse": m.caisse,
                          "tasses": m.tasses, "renommee": m.renommee, "ambiance": amb, "coherence": coh, "style": dom,
                          "minutes": duo.preparation + 10 + b["depassement"] / 60 + duo.fermeture})
    return m


def _palier(e: tuple, achats: dict, exts: dict, items: dict) -> str:
    src, iid = e
    if iid == "renover_chaises":
        return "t0"
    if src == "eq":
        return (achats.get(iid) or exts[iid])["tier"]
    return items[iid]["unlock"]["tier"]


def appliquer(m: Maison, effet: str) -> None:
    for part in effet.split(";"):
        k, _, v = part.partition(":")
        if k == "poste":
            poste, n = v.split(":")
            m.niveaux[poste] = max(m.niveaux.get(poste, 0), int(n))
            if poste == "agrumes":
                m.connues.add("jus_orange")
            if poste == "creperie":
                m.connues.add("crepe")
        elif k == "equip":
            m.equip.add(v)
        elif k == "recette":
            m.connues.add(v)
        elif k == "vaisselle":
            m.vaisselle += int(v)


# Effets des événements dans la simulation (lus par jour; les vraies conditions sont dans evenements.json)
EVENEMENTS_SIM: dict[int, dict] = {}


def charger(cc: object) -> dict:
    d = {"eco": json.loads((DONNEES / "reglages-economie.json").read_text(encoding="utf-8")),
         "cat": json.loads((DONNEES / "catalogue.json").read_text(encoding="utf-8")),
         "eqp": json.loads((DONNEES / "postes-equipements.json").read_text(encoding="utf-8")),
         "rec": json.loads((DONNEES / "recettes.json").read_text(encoding="utf-8")),
         "ev": json.loads((DONNEES / "evenements.json").read_text(encoding="utf-8"))}
    # coûts des matières de la démo (recettes.json) dans le service client par client
    for r in d["rec"]["recipes"]:
        old = cc.REC[r["id"]]
        new = dataclasses.replace(old, cout=r["costMaterials"], prix=r["basePrice"])
        cc.REC[r["id"]] = new
        cc.RECETTES[cc.RECETTES.index(old)] = new
    for e in d["ev"]["events"]:
        s = e.get("sim")
        if s:
            EVENEMENTS_SIM[s["day"]] = s
    return d


def fr(x: float, n: int = 0) -> str:
    s = f"{x:,.{n}f}".replace(",", " ").replace(".", ",")
    return s


def simuler(cc: object, d: dict) -> dict[str, list[str]]:
    out: dict[str, list[str]] = {}
    res: dict[tuple[str, str], list[Maison]] = {}
    for duo in cc.DUOS:
        for ordre in ("equilibre", "decor", "coin_du_feu", "machines"):
            res[(duo.id, ordre)] = [jouer(cc, duo, ordre, 1000 + g, d) for g in range(PARTIES)]
    # Table 1: progression du duo médian, ordre équilibre, jour par jour (médianes)
    lignes = ["| Jour | Caisse le soir | Résultat du jour | Recettes | Matières | Groupes servis | Repartis | Satisfaction | Tasses | Renommée | Ambiance | Achats du soir (le plus fréquent) |",
              "|---|---|---|---|---|---|---|---|---|---|---|---|"]
    jours = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"]
    ms = res[("median", "equilibre")]
    for jour in range(1, d["eco"]["demoEndDay"] + 1):
        js = [m.journal[jour - 1] for m in ms]
        nom = f"{jour} ({jours[(jour - 1) % 7]})"
        ach = {}
        for m in ms:
            k = ", ".join(i for j, i, _ in m.achats if j == jour) or "rien"
            ach[k] = ach.get(k, 0) + 1
        top = max(ach, key=lambda k: ach[k])
        if js[0]["lundi"]:
            lignes.append(f"| {nom} | {fr(statistics.median(j['caisse'] for j in js))} € | fermé (loyer) | | | | | | {fr(statistics.median(j['tasses'] for j in js), 1)} | {fr(statistics.median(j['renommee'] for j in js))} | | travaux, brocante |")
            continue
        med = lambda k: statistics.median(j[k] for j in js)
        lignes.append(f"| {nom} | {fr(med('caisse'))} € | {fr(med('net'))} € | {fr(med('recette'))} € | {fr(med('cout'))} € | {fr(med('servis'))} | {fr(100 * med('repartis'))} % | {fr(med('satisfaction'))} | {fr(med('tasses'), 1)} | {fr(med('renommee'))} | {fr(med('ambiance'))} | {top} |")
    out["sim_median_jours"] = lignes
    # Table 2: synthèse par duo et par ordre
    l2 = ["| Duo | Ordre d'achat | Gagné en 12 jours (résultats) | Dépensé en achats | Caisse au jour 15 | Achats faits | Terrasse ouverte le jour 14 | Trois tasses avant la fête | Lettre de René (jour) | Pièce du fond ouverte pour la fête | Ambiance au jour 14 | Cohérence | Temps réel joué |",
          "|---|---|---|---|---|---|---|---|---|---|---|---|---|"]
    noms = {"equilibre": "équilibre", "decor": "décor d'abord", "coin_du_feu": "terrasse puis coin du feu", "machines": "machines d'abord"}
    for duo in cc.DUOS:
        for ordre in ("equilibre", "decor", "coin_du_feu", "machines"):
            ms = res[(duo.id, ordre)]
            gains = statistics.median(sum(j.get("net", 0) for j in m.journal) for m in ms)
            dep = statistics.median(sum(p for _, _, p in m.achats) for m in ms)
            caisse = statistics.median(m.journal[-1]["caisse"] for m in ms)
            nb = statistics.median(len(m.achats) for m in ms)
            terr = sum(1 for m in ms if any(i == "village_terrasse" and j <= 13 for j, i, _ in m.achats))
            trois = sum(1 for m in ms if m.journal[12]["tasses"] >= 3.0)
            offre = statistics.median(m.offre for m in ms)
            fond = sum(1 for m in ms if any(i == "village_fond" and j <= 12 for j, i, _ in m.achats))
            amb = statistics.median(m.journal[13]["ambiance"] for m in ms)
            coh = statistics.median(m.journal[13]["coherence"] for m in ms)
            minutes = statistics.median(sum(j.get("minutes", 0) for j in m.journal if not j["lundi"]) + duo.lundi * 3 + 6 + 8 for m in ms)
            l2.append(f"| {duo.nom} | {noms[ordre]} | {fr(gains)} € | {fr(dep)} € | {fr(caisse)} € | {fr(nb)} | {terr} sur {PARTIES} | {trois} sur {PARTIES} | {fr(offre)} | {fond} sur {PARTIES} | {fr(amb)} | {fr(100 * coh)} % | {fr(minutes / 60, 1)} h |")
    out["sim_synthese"] = l2
    # Table 3: le calendrier des achats du duo médian (ordre équilibre, première partie, lisible)
    m = res[("median", "equilibre")][0]
    l3 = ["| Jour | Achat | Prix | Caisse après les achats du soir |", "|---|---|---|---|"]
    for j, i, p in m.achats:
        l3.append(f"| {j} | `{i}` | {fr(p)} € | {fr(m.journal[j - 1]['caisse'])} € |")
    out["sim_calendrier"] = l3
    l4 = ["| Recette | Prix conseillé au comptoir | Matières | Marge | Part des matières | Déblocage |", "|---|---|---|---|---|---|"]
    for r in d["rec"]["recipes"]:
        u = r["unlock"]
        deb = {"start": "départ", "purchase": f"achat `{u.get('item')}`", "regular": f"habitué `{u.get('regular')}`, lien {u.get('level')}"}[u["kind"]]
        l4.append(f"| {r['name']} | {fr(r['basePrice'], 2)} € | {fr(r['costMaterials'], 2)} € | {fr(r['basePrice'] - r['costMaterials'], 2)} € | {fr(100 * r['costMaterials'] / r['basePrice'])} % | {deb} |")
    out["sim_recettes"] = l4
    return out


def remplir(tables: dict[str, list[str]]) -> int:
    texte = DOC.read_text(encoding="utf-8")
    manquants = []
    for k, lignes in tables.items():
        motif = re.compile(rf"(<!-- table:{k} -->\n).*?(<!-- fin:{k} -->)", re.S)
        if not motif.search(texte):
            manquants.append(k)
            continue
        texte = motif.sub(lambda mo: mo.group(1) + "\n".join(lignes) + "\n" + mo.group(2), texte)
    DOC.write_text(texte, encoding="utf-8")
    if manquants:
        print("marqueurs absents:", ", ".join(manquants))
        return 1
    return 0


def controle(d: dict) -> int:
    """Contrôle croisé des données: chaque coût de recette est la somme de ses ingrédients, chaque référence existe."""
    err = []
    ing = {i["id"]: i for i in json.loads((DONNEES / "ingredients-fournisseurs.json").read_text(encoding="utf-8"))["ingredients"]}
    for r in d["rec"]["recipes"]:
        s = round(sum(ing[x["id"]]["unitCost"] * x["qty"] for x in r["ingredients"]), 2)
        if abs(s - r["costMaterials"]) > 0.005:
            err.append(f"coût de {r['id']}: {s} contre {r['costMaterials']}")
    items = {x["id"] for x in d["cat"]["items"]}
    styles = {x["style"] for x in d["cat"]["items"] if x["style"] != "neutre" and not x.get("unique") and x["unlock"].get("source") != "brocante"}
    if len([x for x in d["cat"]["items"] if not x.get("unique")]) < 35 or len(styles) < 3:
        err.append("catalogue trop court ou moins de trois styles")
    for e in d["ev"]["events"]:
        for rw in e.get("rewards", {}).get("items", []):
            if rw not in items:
                err.append(f"événement {e['id']}: objet inconnu {rw}")
    for e in err:
        print(e)
    return 1 if err else 0


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--donnees", action="store_true")
    ap.add_argument("--simuler", action="store_true")
    ap.add_argument("--remplir", action="store_true")
    a = ap.parse_args()
    spec = importlib.util.spec_from_file_location("cosy_cafe", SIM)
    assert spec and spec.loader
    cc = importlib.util.module_from_spec(spec)
    sys.modules["cosy_cafe"] = cc
    spec.loader.exec_module(cc)
    code = 0
    if a.donnees:
        donnees(cc)
    if a.simuler:
        d = charger(cc)
        code |= controle(d)
        t = simuler(cc, d)
        for k, v in t.items():
            print(f"\n[{k}]")
            print("\n".join(v))
        if a.remplir:
            code |= remplir(t)
    return code


if __name__ == "__main__":
    sys.exit(main())
