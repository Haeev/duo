/**
 * Registre des briques: pour chaque brique des données, le comportement qui la fait vivre. Le
 * moteur ne connaît aucun meuble: il lit les briques du meuble visé et appelle leur comportement.
 * Un contenu nouveau (une chaise) ne touche donc jamais ce dossier; seule une brique nouvelle le fait.
 *
 * Ajouter une brique: un fichier de ce dossier qui exporte un `BrickBehaviour` (modèles complets:
 * `asseoir.ts` sans geste, `ramasser.ts` avec geste, `ranger.ts` avec intentions), une ligne ici,
 * un test dans `tests/`. Contrat: `types.ts`.
 */
import { NEEDS_BRICKS } from '../besoins/briques';
import { shopBehaviour } from '../commerces/brique';
import { BAG_BRICKS } from '../sac/briques';
import { HARVEST_BRICKS } from '../outils/briques';
import { sitBehaviour } from './asseoir';
import { sleepBehaviour } from './dormir';
import { talkBehaviour } from './parler';
import { pickupBehaviour } from './ramasser';
import { storeBehaviour } from './ranger';
import type { BrickRegistry, EntityBehaviour } from './types';
import { travelBehaviour } from '../voyage/brique';
import { passageBehaviour } from '../lieux/passage';

export type {
  Aim,
  BrickBehaviour,
  BrickRegistry,
  BrickTarget,
  BrickView,
  EntityBehaviour,
  GestureSpec,
  Look,
} from './types';

/**
 * Comportements livrés. Une brique déclarée sans comportement est inerte: son meuble n'est pas
 * une cible. Restent à inscrire: `gather` et `open` (L2, tour suivant), `relieve` (L3); `shop`,
 * `cook` et `repair` arrivent au jalon 2.
 */
export const BRICK_BEHAVIOURS: BrickRegistry = {
  sit: sitBehaviour,
  sleep: sleepBehaviour,
  store: storeBehaviour,
  ...NEEDS_BRICKS,
  ...BAG_BRICKS,
  travel: travelBehaviour,
  shop: shopBehaviour,
  ...HARVEST_BRICKS,
  passage: passageBehaviour,
};

/** Actions sur ce qui n'est pas un meuble: un objet au sol (`pickup`), un habitant (`talk`). */
export const ENTITY_BEHAVIOURS: Readonly<Record<'pickup' | 'talk', EntityBehaviour>> = {
  pickup: pickupBehaviour,
  talk: talkBehaviour,
};
