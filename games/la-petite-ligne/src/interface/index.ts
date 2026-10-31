/**
 * Point d'entrée de l'interface en jeu de La Petite Ligne (contrat
 * `CreateInterface` de `etat/vue.ts`). `main.ts` appelle:
 *
 *   const ui = createInterface({ view, overlay, uiScale, reducedMotion, camera });
 *   // à chaque image, après le rendu: ui.frame(dt)
 *   // touches du SDK pour l'interface (Tab, Retour arrière, Entrée, A, E): ui.handleKey(code)
 *   // tant que ui.capturesMovement(): pas de déplacement du personnage
 *
 * `camera` (facultatif) sert aux boutons de caméra du HUD; sans elle, ils sont masqués.
 */
import type { CreateInterface } from '../etat/vue';
import { mountInterface } from './interface';

export const createInterface: CreateInterface = (options) => mountInterface(options);
