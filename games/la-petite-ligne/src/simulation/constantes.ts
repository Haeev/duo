/**
 * Constantes techniques de la simulation (pas des valeurs de jeu: celles-ci
 * sont dans `donnees/reglages.json`).
 */

/** Pas de simulation par seconde. 30 suffit à un jeu sans réflexe et tient sous le plafond de messages du réseau. */
export const SIM_HZ = 30;
export const SIM_DT = 1 / SIM_HZ;

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

/** Minutes par heure et par jour. */
export const MINUTES_PER_HOUR = 60;
export const MINUTES_PER_DAY = 1440;

/** Format des sauvegardes (`dataSchema`). */
export const DATA_SCHEMA = 1;

/** Taille du sac et de la barre d'outils. */
export const BAG_SLOTS = 24;
export const TOOLBAR_SLOTS = 8;

/** Fréquence de mise à jour des emplois du temps des habitants (pas). */
export const SCHEDULE_PERIOD_TICKS = 15;

/** Distance de vue d'une culture mûre pour l'astuce A10 (m). */
export const RIPE_VIEW_DISTANCE = 10;
