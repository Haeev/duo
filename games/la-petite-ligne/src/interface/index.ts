/**
 * Point d'entrée de l'interface en jeu de La Petite Ligne (contrat
 * `CreateInterface` de `etat/vue.ts`). `main.ts` appelle:
 *
 *   const ui = createInterface({ view, overlay, uiScale, reducedMotion });
 *   // à chaque image, après le rendu: ui.frame(dt)
 *   // au clavier (focus hors de l'interface): if (ui.handleKey(e.code)) e.preventDefault();
 *   // tant que ui.capturesMovement(): pas de déplacement du personnage
 *
 * `createInterfaceWith` accepte en plus `camera` (boutons de caméra du HUD).
 */
import type { CreateInterface } from '../etat/vue';
import { createInterfaceWith } from './interface';

export const createInterface: CreateInterface = (options) => createInterfaceWith(options);

export { createInterfaceWith, type InterfaceExtras } from './interface';
export type { CameraCommand } from './composant';
