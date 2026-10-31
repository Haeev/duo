// SDK des jeux Duo (ADR 0005). Point d'entrée du jeu: `connect`.
export type * from './api';
export { connect } from './connect';
export { createRandom, deriveSeed, fnv1a32 } from './random';
export { createFixedStepper } from './stepper';
export { hashState } from './hash';
export { InputFrameSchema } from './input-schema';
export { SDK_VERSION } from './version';
export { BRIDGE_VERSION, PLAYER_COLORS, parseManifest } from '@duo/protocol';
/** Valibot, à la version du SDK, pour écrire les schémas des canaux réseau et des sauvegardes. */
export * as v from 'valibot';
