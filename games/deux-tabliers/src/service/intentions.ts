// Intentions du chantier « service » (invité vers hôte, ou interface de l'hôte). Le reste du
// service passe par « Agir » sur les postes (intention `act` du cœur) et le maintien d'Agir.
import { v } from '@duo/sdk';

export const LATTE_SHAPES = ['coeur', 'feuille', 'tulipe'] as const;

export const SERVICE_INTENTS = [
  /** Aide « gestes simplifiés » du joueur qui l'envoie (CO-07), réglée dans ses options. */
  v.strictObject({ type: v.literal('service-assist'), on: v.boolean() }),
  /**
   * Dessin sur le lait (CO-05), jugé chez le joueur qui le trace (technique 5.6): `score` de 0 à 1
   * par `judgeLatteArt`. L'hôte vérifie que la tasse vient d'être moussée et borne le score.
   */
  v.strictObject({
    type: v.literal('service-latte-art'),
    object: v.pipe(v.number(), v.integer(), v.minValue(0)),
    shape: v.picklist(LATTE_SHAPES),
    score: v.pipe(v.number(), v.minValue(0), v.maxValue(1)),
  }),
  /** Prendre un ticket précis du rail (interface du rail); « Agir » sur le rail prend le plus ancien. */
  v.strictObject({
    type: v.literal('service-take-ticket'),
    ticket: v.pipe(v.number(), v.integer(), v.minValue(0)),
  }),
  /** Rendre un ticket pris (sa couleur s'efface). */
  v.strictObject({
    type: v.literal('service-release-ticket'),
    ticket: v.pipe(v.number(), v.integer(), v.minValue(0)),
  }),
] as const;
