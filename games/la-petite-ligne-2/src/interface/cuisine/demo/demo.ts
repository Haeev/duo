/**
 * Démonstration de la cuisine seule, sur une partie neuve, selon l'ancre (`#livre`, `#couper`,
 * `#remuer`, `#cuire`, `#duo`, `#resultat`, `#repas`). Le mini-jeu avance, avec quelques appuis simulés, jusqu'au
 * moment montré. Sert aux captures.
 */
import { loadContent } from '../../../donnees/charger';
import { DATA_FILES } from '../../../donnees/fichiers';
import type { PlayerIndex } from '../../../donnees/schemas/communs';
import type { WorldState } from '../../../etat/monde';
import type { GameEvent } from '../../../simulation/noyau/evenements';
import { createWorld } from '../../../simulation/noyau/monde';
import { spriteMarkup } from '../../pictos';
import { azertyLabel } from '../../index';
import { createKitchen } from '../index';
import '../../interface.css';

const content = loadContent(DATA_FILES);
const world: WorldState = createWorld(content, 7, [
  { id: 'a', name: 'Camille' },
  { id: 'b', name: 'Sacha' },
]);
const me = world.players[0];
me.toolbar[0] = { item: 'carotte', count: 3 };
me.toolbar[1] = { item: 'poireau', count: 1 };
me.toolbar[2] = { item: 'pomme', count: 2 };
me.toolbar[3] = { item: 'oeuf', count: 1 };
world.progress.memory['cuisine.recette.pomme-cuite'] = { v: 3, by: 0, day: 1 };
world.progress.memory['cuisine.recette.soupe-de-legumes'] = { v: 2, by: 'duo', day: 1 };
world.progress.memory['cuisine.recette.pot-au-feu-du-dimanche'] = { v: 0, by: 'duo', day: 1 };

const layer = document.createElement('div');
layer.className = 'lpl-ui';
layer.innerHTML = spriteMarkup();
document.body.append(layer);
const kitchen = createKitchen(
  layer,
  { content, world: () => world, localIndex: (): PlayerIndex => 0 },
  () => undefined,
  azertyLabel,
  window,
);

const state = location.hash.slice(1) || 'livre';
const events: Record<string, GameEvent[]> = {
  livre: [{ type: 'kitchen_opened', player: 0, target: 'cuisiniere-1', station: 'kitchen' }],
  couper: [
    { type: 'cook_started', player: 0, recipe: 'soupe-de-legumes', part: 0, target: 'c', seed: 4 },
  ],
  remuer: [
    {
      type: 'cook_started',
      player: 0,
      recipe: 'omelette-aux-herbes',
      part: 0,
      target: 'c',
      seed: 4,
    },
  ],
  cuire: [
    {
      type: 'cook_started',
      player: 0,
      recipe: 'pot-au-feu-du-dimanche',
      part: 1,
      target: 'f',
      seed: 9,
    },
  ],
  duo: [
    {
      type: 'cook_started',
      player: 1,
      recipe: 'pot-au-feu-du-dimanche',
      part: 0,
      target: 'p',
      seed: 2,
    },
    {
      type: 'cook_step_done',
      player: 1,
      recipe: 'pot-au-feu-du-dimanche',
      part: 0,
      step: 0,
      grade: 3,
      early: false,
    },
    {
      type: 'cook_started',
      player: 0,
      recipe: 'pot-au-feu-du-dimanche',
      part: 1,
      target: 'c',
      seed: 5,
    },
  ],
  resultat: [
    {
      type: 'dish_cooked',
      player: 0,
      recipe: 'tarte-aux-pommes',
      quality: 3,
      item: 'tarte-doree',
      count: 2,
      first: true,
      shared: false,
    },
  ],
  repas: [{ type: 'meal_shared', player: 0, perk: 'extra_catch' }],
};
for (const event of events[state] ?? []) kitchen.onEvent(event);

/** Avance jusqu'au moment montré, avec quelques appuis simulés; l'image se fige ensuite. */
const advance: Record<string, number> = {
  couper: 2.3,
  remuer: 2.6,
  cuire: 1.9,
  duo: 1.4,
  resultat: 0.2,
  repas: 4.5,
};
const presses: Record<string, [number, string, boolean][]> = {
  couper: [
    [60, 'Space', true],
    [96, 'Space', true],
    [132, 'Space', true],
  ],
  remuer: [
    [70, 'KeyA', true],
    [100, 'KeyD', true],
    [130, 'KeyA', true],
  ],
  cuire: [[70, 'Space', true]],
};
const frames = Math.round((advance[state] ?? 0) * 60);
for (let i = 0; i < frames; i++) {
  for (const [at, code, down] of presses[state] ?? [])
    if (at === i) window.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code }));
  kitchen.frame(1000 / 60);
}
kitchen.frame(0);
document.body.dataset.ready = 'oui';
