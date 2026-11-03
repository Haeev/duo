/**
 * Constantes techniques de la simulation (pas des valeurs de jeu: celles-ci
 * sont dans `donnees/reglages.json`).
 */

import { SIM_HZ } from '../etat/types';

/** Pas de simulation par seconde (défini avec l'état, lu aussi par le rendu). 30 suffit à un jeu sans réflexe et tient sous le plafond de messages du réseau. */
export { SIM_HZ };
export const SIM_DT = 1 / SIM_HZ;

/**
 * Correction de coin (gauntlet, ressenti): poussé droit contre un coin (arbre,
 * montant de porte) qu'il ne chevauche que de peu, le corps glisse de côté
 * pour passer. Décalages essayés de `CORNER_NUDGE_STEP` à `CORNER_NUDGE_MAX` (m).
 * Ici et non dans `reglages.json`: la prédiction de l'invité doit faire le même calcul.
 */
export const CORNER_NUDGE_MAX = 0.35;
export const CORNER_NUDGE_STEP = 0.05;

/** Rayon de collision d'un personnage (m). */
export const BODY_RADIUS = 0.3;

/** Distance devant le personnage où se trouve la case visée (m). */
export const AIM_DISTANCE = 0.9;

/** Demi-angle du cône devant soi où l'on vise un habitant ou un objet (radians, 70°). */
export const AIM_CONE = (70 * Math.PI) / 180;

/** Arrivée d'un trajet au clic: distance au point visé (m). */
export const ARRIVE_DISTANCE = 0.15;

/** Ampleur minimale d'une direction pour bouger (zone morte). */
export const MOVE_DEADZONE = 0.1;

/** Secondes réelles par minute réelle (seuil d'absence). */
export const SECONDS_PER_MINUTE = 60;

/** Minutes par heure et par jour. */
export const MINUTES_PER_HOUR = 60;
export const MINUTES_PER_DAY = 1440;

/**
 * Format des sauvegardes (`dataSchema`). 2: deux semaines (commande en cours, commandes payées).
 * 3: moments rares et secrets (tour 6). 4: souvenirs du carnet (tour 7). 5: la suite après le
 * jour 15 (tour 8: étapes, météo tirée, commande générée, totaux, courrier hebdomadaire).
 * 6: annonces, chantiers, catalogue (tour 9). 7: maison du tour 10 (besoins doux, pièces,
 * rangement à cases et râtelier, rideaux aux fenêtres, `inside`). 8: lettres sans leur texte
 * rendu (variante et variables, texte reconstitué depuis les données). 9: petits objets posés sur les
 * meubles (`decor`). 10: pêche de la 0.12 (carnet des poissons, grands pris, séries; les ombres ne
 * sont pas sauvegardées). 11: garde-robe de la 0.12 (`appearance.wear` et `wardrobe` au lieu de
 * `appearance.outfit`). 12: élevage de la 0.12 (bonheur des poules, coq, couvée, poussines,
 * litière, grain entamé, chèvres, noms à choisir). L'économie de la 0.12 ne change pas le format:
 * ses champs prennent leur valeur de départ à la reprise (`fillEconomyFields`).
 */
export const DATA_SCHEMA = 13;

/** Taille du sac et de la barre d'outils (définies avec l'état, lues aussi par l'interface). */
export { BAG_SLOTS, TOOLBAR_SLOTS } from '../etat/types';

/** Fréquence de mise à jour des emplois du temps des habitants (pas). */
export const SCHEDULE_PERIOD_TICKS = 15;

/** Distance de vue d'une culture mûre pour l'astuce A10 (m). */
export const RIPE_VIEW_DISTANCE = 10;

