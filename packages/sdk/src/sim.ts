// Outils de simulation sans DOM, importables dans `src/simulation/` et testables dans Node:
// `import { createRandom, hashState } from '@duo/sdk/sim'`.
export { createRandom, deriveSeed, fnv1a32 } from './random';
export type { RandomSource, RandomState } from './random';
export { createFixedStepper } from './stepper';
export type { FixedStepper } from './stepper';
export { hashState } from './hash';
