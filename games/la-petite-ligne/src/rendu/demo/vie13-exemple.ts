/**
 * Page de rendu, vie du village de la 0.13 (lot H7): `vie13=1` fait tourner la vraie simulation des
 * habitants et du chat (`updateVillagers`, `updateCat`) sur le monde de la page, au jour et à l'heure
 * de `jour=` et `heure=` (horloge arrêtée). `avance=<s>` (60 par défaut) joue ces secondes avant la
 * première image: les habitants sont déjà à leur place de scène. `chat_x=`, `chat_y=`: un joueur 2
 * posé là (pour voir le chat le regarder).
 */
import type { Content } from '../../donnees/types';
import type { GameMap } from '../../etat/carte';
import type { CatSnapshot } from '../../etat/chat';
import { SIM_HZ, type WorldState } from '../../etat/types';
import { SIM_DT } from '../../simulation/constantes';
import { updateCat } from '../../simulation/chat';
import { type Sim, wrapWorld } from '../../simulation/contexte';
import { placeVillagers, updateVillagers } from '../../simulation/habitants';

export interface VillageLifeDemo {
  cat: () => CatSnapshot | null;
  step: (world: WorldState, seconds: number) => void;
}

export function applyVillageLifeExample(
  world: WorldState,
  content: Content,
  map: GameMap,
  params: URLSearchParams,
): VillageLifeDemo | null {
  if (params.get('vie13') !== '1') return null;
  const sim: Sim = wrapWorld(content, map, world);
  world.phase = 'day';
  // Le chat est arrivé (histoire de Margot) et Lucie est rentrée: toute la vie du village se voit.
  for (const flag of ['cat_here', 'lucie_back', 'achille_here', 'solange_here']) if (!world.flags.includes(flag)) world.flags.push(flag);
  for (const v of world.villagers) v.talkingWith = [];
  placeVillagers(sim);
  let tick = world.tick;
  const advance = (n: number): void => {
    for (let i = 0; i < n; i++) {
      tick += 1;
      world.tick = tick;
      sim.events.length = 0;
      updateVillagers(sim, SIM_DT);
      updateCat(sim, SIM_DT);
    }
  };
  const second = world.characters[1];
  const cx = Number(params.get('chat_x'));
  const cy = Number(params.get('chat_y'));
  if (second !== undefined && params.has('chat_x') && Number.isFinite(cx) && Number.isFinite(cy)) {
    second.pos = { x: cx, y: cy };
    second.prev = { x: cx, y: cy };
    second.speed = 0;
    second.inside = null;
  }
  advance(Math.round((Number(params.get('avance') ?? '60') || 0) * SIM_HZ));
  let played = 0;
  return {
    cat: () => sim.runtime.cat,
    step: (state, seconds) => {
      // La page recale `tick` sur son propre temps: la simulation garde le sien.
      const due = Math.floor(seconds * SIM_HZ) - played;
      played += Math.max(0, due);
      state.tick = tick;
      advance(Math.max(0, Math.min(due, SIM_HZ)));
    },
  };
}
