/**
 * Ce qu'un joueur envoie à chaque pas (entrées) et à chaque action (intentions).
 * Les intentions des chantiers s'ajoutent par leurs listes `*_INTENTS`, sans toucher à ce fichier.
 */
import { v } from '@duo/sdk';
import { ARRANGEMENT_INTENTS } from '../amenagement/intentions';
import { CLIENTELE_INTENTS } from '../clientele/intentions';
import { SERVICE_INTENTS } from '../service/intentions';
import { PlayerIndexSchema } from '../etat/monde';

const Axis = v.picklist([-1, 0, 1]);
const Angle = v.pipe(v.number(), v.minValue(-720), v.maxValue(720));

export const StepInputSchema = v.strictObject({
  seq: v.pipe(v.number(), v.integer(), v.minValue(0)),
  /** -1 gauche, 1 droite. */
  moveX: Axis,
  /** 1 avancer, -1 reculer. */
  moveZ: Axis,
  fast: v.boolean(),
  yawDeg: Angle,
  pitchDeg: Angle,
  /** Agir tenu (postes à maintien). */
  actHeld: v.boolean(),
});
export type StepInput = v.InferOutput<typeof StepInputSchema>;

export const IDLE_INPUT: StepInput = {
  seq: 0,
  moveX: 0,
  moveZ: 0,
  fast: false,
  yawDeg: 180,
  pitchDeg: 0,
  actHeld: false,
};

/** Ce que vise un joueur: choisi par la machine qui vise, revérifié par l'hôte. */
export const TargetSchema = v.variant('kind', [
  v.strictObject({ kind: v.literal('object'), id: v.pipe(v.number(), v.integer(), v.minValue(0)) }),
  v.strictObject({ kind: v.literal('slot'), furniture: v.string(), slot: v.string() }),
  v.strictObject({ kind: v.literal('station'), furniture: v.string() }),
  v.strictObject({ kind: v.literal('source'), furniture: v.string() }),
  v.strictObject({ kind: v.literal('player'), player: PlayerIndexSchema }),
  v.strictObject({ kind: v.literal('seat'), furniture: v.string() }),
]);
export type Target = v.InferOutput<typeof TargetSchema>;

export const CORE_INTENTS = [
  /** Agir (E, Espace, clic gauche) sur la cible visée. */
  v.strictObject({ type: v.literal('act'), target: TargetSchema }),
  /** Reposer (R, clic droit): l'objet tenu (plateau compris) sur l'emplacement visé. */
  v.strictObject({ type: v.literal('drop'), target: TargetSchema }),
] as const;

export const IntentSchema = v.variant('type', [
  ...CORE_INTENTS,
  ...SERVICE_INTENTS,
  ...CLIENTELE_INTENTS,
  ...ARRANGEMENT_INTENTS,
]);
export type Intent = v.InferOutput<typeof IntentSchema>;
