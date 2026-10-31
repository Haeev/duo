/**
 * Situations de la page de démonstration de l'interface (`?scenario=...`):
 * le robot de la simulation joue jusqu'au moment voulu, puis quelques
 * retouches de l'état montrent l'écran demandé. Outil de développement et
 * de captures seulement: le jeu ne passe jamais par ici.
 */
import type { Intent } from '../../etat/actions';
import type { CharacterId, ItemStack } from '../../etat/types';
import type { Sim } from '../../simulation/contexte';
import { step } from '../../simulation/pas';
import { createRobot } from '../../simulation/robot';

const HOUR = 60;
const MAX_TICKS = 400_000;

/** Fait jouer le robot (les deux personnages) jusqu'à ce que `until` soit vrai. */
export function playUntil(sim: Sim, until: (s: Sim) => boolean): void {
  const robot = createRobot();
  let ticks = 0;
  while (!until(sim) && ticks < MAX_TICKS) {
    step(sim, robot.decide(sim));
    ticks++;
  }
}

function at(sim: Sim, day: number, minutes: number): boolean {
  return sim.world.clock.day > day || (sim.world.clock.day === day && sim.world.clock.minutes >= minutes && sim.world.phase === 'day');
}

function character(sim: Sim, id: CharacterId): Sim['world']['characters'][number] {
  const c = sim.world.characters.find((x) => x.id === id);
  if (c === undefined) throw new Error(`personnage ${id}`);
  return c;
}

function apply(sim: Sim, by: CharacterId, intents: readonly Intent[]): void {
  step(sim, { controls: {}, intents: intents.map((intent) => ({ by, intent })) });
}

function stack(item: string, count: number, quality: ItemStack['quality'] = 'ordinary'): ItemStack {
  return { item, quality, count };
}

/** Un sac bien rempli, comme au milieu de la semaine (maquette du carnet). */
function fillBag(sim: Sim, id: CharacterId): void {
  const c = character(sim, id);
  const items: (ItemStack | null)[] = [
    stack('hoe', 1),
    stack('watering_can', 1),
    stack('axe', 1),
    stack('radish_seed', 8),
    stack('lettuce_seed', 4),
    stack('radish', 6, 'fine'),
    stack('plank', 4),
    stack('egg', 3),
    stack('bread', 1),
    null,
    stack('radish', 5),
    stack('carrot', 3),
    stack('carrot_seed', 4),
    stack('nail', 2),
    stack('log', 1),
    stack('riddle_card', 1),
  ];
  c.bag = c.bag.map((_, i) => items[i] ?? null);
  c.selected = 1;
  c.water = 7;
}

function teleport(sim: Sim, id: CharacterId, x: number, y: number): void {
  const c = character(sim, id);
  c.pos = { x, y };
  c.prev = { x, y };
  c.destination = null;
}

function near(sim: Sim, id: CharacterId, point: string, dx = 0.9, dy = 0.4): void {
  const p = sim.map.points[point];
  if (p !== undefined) teleport(sim, id, p.x + dx, p.y + dy);
}

/** Prépare la situation demandée. `me`: le personnage de cette page. */
export function setupScenario(sim: Sim, name: string, me: CharacterId): void {
  const other: CharacterId = me === 'p1' ? 'p2' : 'p1';
  const day5 = (): void => {
    playUntil(sim, (s) => at(s, 5, 9 * HOUR + 20));
  };
  switch (name) {
    case 'titre':
      return;
    case 'creation':
      apply(sim, other, [{ type: 'title_ready', ready: true }]);
      return;
    case 'creation-autre':
      apply(sim, other, [{ type: 'title_ready', ready: true }, { type: 'create_character', name: 'Sacha', hair: 2, outfit: 1 }]);
      return;
    case 'scene':
      apply(sim, other, [{ type: 'title_ready', ready: true }, { type: 'create_character', name: 'Sacha', hair: 2, outfit: 1 }]);
      apply(sim, me, [{ type: 'title_ready', ready: true }, { type: 'create_character', name: 'Camille', hair: 0, outfit: 0 }]);
      playUntil(sim, (s) => s.world.scene !== null);
      return;
    case 'jour':
      day5();
      fillBag(sim, me);
      return;
    case 'hud':
      // Le HUD seul: la scène d'arrivée jouée par le robot, personne en conversation ni dans un menu.
      playUntil(
        sim,
        (s) =>
          s.world.phase === 'day' &&
          s.world.scene === null &&
          s.world.quests.some((q) => q.id === 'first_train' && q.status === 'done') &&
          s.world.characters.every((c) => c.status === 'active' && c.dialogue === null && c.menu === null),
      );
      return;
    case 'premier-jour':
      playUntil(sim, (s) => s.world.phase === 'day' && s.world.tick > 60);
      return;
    case 'carnet':
    case 'quetes':
    case 'courrier':
      day5();
      fillBag(sim, me);
      apply(sim, me, [{ type: 'menu', menu: 'notebook' }]);
      return;
    case 'caisse':
      day5();
      fillBag(sim, me);
      near(sim, me, 'coop_crate');
      apply(sim, me, [{ type: 'menu', menu: 'crate' }]);
      return;
    case 'catalogue':
      day5();
      sim.world.purse = Math.max(sim.world.purse, 198);
      near(sim, me, 'notice_board');
      apply(sim, me, [{ type: 'menu', menu: 'catalogue' }]);
      return;
    case 'comptoir':
    case 'vendre':
      day5();
      fillBag(sim, me);
      sim.world.purse = Math.max(sim.world.purse, 214);
      near(sim, me, 'grocery_counter');
      apply(sim, me, [{ type: 'menu', menu: 'shop' }]);
      return;
    case 'etabli':
      day5();
      fillBag(sim, me);
      near(sim, me, 'sawmill_workbench');
      apply(sim, me, [{ type: 'menu', menu: 'workbench' }]);
      return;
    case 'rechaud':
    case 'coffre':
      playUntil(sim, (s) => s.world.clock.day >= 4 && s.world.clock.veillee && s.world.phase === 'day');
      fillBag(sim, me);
      apply(sim, me, [{ type: 'menu', menu: name === 'rechaud' ? 'stove' : 'chest' }]);
      return;
    case 'veillee':
      playUntil(sim, (s) => s.world.clock.day >= 4 && s.world.clock.veillee && s.world.phase === 'day');
      return;
    case 'dialogue':
      playUntil(sim, (s) => at(s, 2, 11 * HOUR + 30));
      near(sim, me, 'grocery_counter', 0, 1.2);
      apply(sim, me, [{ type: 'move_to', target: { kind: 'villager', villager: 'odette' }, act: true }]);
      return;
    case 'achat':
      day5();
      sim.world.purse = Math.max(sim.world.purse, 214);
      near(sim, other, 'grocery_counter');
      apply(sim, other, [{ type: 'menu', menu: 'shop' }, { type: 'buy', item: 'mattress', count: 1 }, { type: 'menu', menu: null }]);
      return;
    case 'amenagement': {
      playUntil(sim, (s) => s.world.clock.day >= 4 && s.world.clock.veillee && s.world.phase === 'day');
      const c = character(sim, me);
      const free = c.bag.findIndex((s, i) => s === null && i < 8);
      c.bag[free < 0 ? 0 : free] = stack('table', 1);
      c.selected = free < 0 ? 0 : free;
      return;
    }
    case 'nuit':
      playUntil(sim, (s) => s.world.phase === 'night' && s.world.clock.day >= 4);
      return;
    case 'petit-dejeuner':
      playUntil(sim, (s) => s.world.phase === 'breakfast' && s.world.clock.day >= 5);
      return;
    case 'fin':
      playUntil(sim, (s) => s.world.phase === 'ended');
      return;
    default:
      return;
  }
}
