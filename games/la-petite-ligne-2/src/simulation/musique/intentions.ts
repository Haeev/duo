/**
 * Intentions de la musique jouée. L'air se joue sur la machine du joueur, qui juge ses propres
 * frappes sur son horloge audio; chaque note jugée part à l'hôte, qui la valide.
 */
import * as v from 'valibot';
import { IdSchema, IntSchema } from '../../donnees/schemas/communs';
import { LANES } from '../../donnees/schemas/air';

export const MUSIC_INTENTS = [
  /**
   * Cran de l'aide de ce joueur (0, 1, 2), dit à l'hôte seul à l'ouverture du cahier: il élargit
   * ses fenêtres. Aucun événement ne le répète: l'autre joueur ne le voit jamais.
   */
  v.strictObject({ type: v.literal('music_assist'), level: v.picklist([0, 1, 2]) }),
  /**
   * Lancer l'air choisi (celui qui a ouvert le cahier). `startAtMs`: instant du premier temps sur
   * l'heure de session commune (`net.sessionTimeMs`), pour que les deux machines partent ensemble;
   * l'hôte, lui, compte en pas de simulation à partir de la réception.
   */
  v.strictObject({
    type: v.literal('music_go'),
    air: IdSchema,
    startAtMs: v.pipe(v.number(), v.finite(), v.minValue(0)),
  }),
  /**
   * Une note jugée chez le joueur: son rang dans sa voix, la touche frappée et l'écart à
   * l'instant écrit (ms, négatif: en avance); `offsetMs: null`: note passée sans frappe.
   */
  v.strictObject({
    type: v.literal('music_note'),
    index: v.pipe(IntSchema, v.minValue(0), v.maxValue(599)),
    lane: v.pipe(IntSchema, v.minValue(0), v.maxValue(LANES - 1)),
    offsetMs: v.nullable(v.pipe(IntSchema, v.minValue(-2000), v.maxValue(2000))),
  }),
  /** Ranger l'instrument: avant l'air ou en plein milieu, sans rien perdre. */
  v.strictObject({ type: v.literal('music_leave') }),
] as const;
