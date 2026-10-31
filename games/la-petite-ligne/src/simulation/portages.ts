/**
 * Gestes à deux de la semaine 2 (gauntlet, tour 4, D2), avec la mécanique de la
 * poutre: la draisine poussée de la remise sur la voie, et le colis lourd livré
 * par le train (objet du catalogue `carriedByTwo`), porté du quai à la maison.
 * Une seule charge à la fois (`world.beam`).
 */
import type { Beam } from '../etat/types';
import { type Sim, itemWithArticle, sayIfWritten } from './contexte';
import { addStack } from './sac';

function load(
  sim: Sim,
  item: string,
  purpose: Beam['purpose'],
  from: string,
  to: { x: number; y: number },
  contents: string | null,
  route: { x: number; y: number }[] | null = null,
): void {
  const at = sim.map.points[from];
  if (at === undefined) return;
  sim.world.beam = {
    item,
    purpose,
    construction: null,
    contents,
    to: { x: to.x, y: to.y },
    route,
    leg: 0,
    pos: { x: at.x, y: at.y },
    prev: { x: at.x, y: at.y },
    // Tournée vers le premier point (la draisine dans l'axe de sa voie).
    facing: Math.atan2((route?.[0] ?? to).y - at.y, (route?.[0] ?? to).x - at.x),
    carried: false,
    holders: [],
  };
  sim.runtime.dynamicDirty = true;
  sim.runtime.changed = true;
}

/** À chaque pas: fait apparaître la charge suivante s'il n'y en a pas (draisine à l'étape voulue, colis livré). */
export function spawnLoads(sim: Sim): void {
  const { world } = sim;
  if (world.beam !== null || world.phase !== 'day') return;
  const { handcar, parcel } = sim.content.settings.carry;
  if (handcar !== null && !world.flags.includes(handcar.flag)) {
    const q = world.quests.find((x) => x.id === handcar.quest);
    const step = q?.status === 'active' ? sim.content.quests.find((x) => x.id === handcar.quest)?.steps[q.step]?.id : undefined;
    const from = sim.map.points[handcar.from];
    if (step === handcar.step && from !== undefined) {
      const route = handcar.path.map(([dx, dy]) => ({ x: from.x + dx, y: from.y + dy }));
      const end = route[route.length - 1] ?? from;
      load(sim, handcar.item, 'handcar', handcar.from, end, null, route);
      return;
    }
  }
  const next = world.heavyDeliveries[0];
  const to = parcel === null ? undefined : sim.map.points[parcel.to];
  if (parcel !== null && next !== undefined && to !== undefined) load(sim, parcel.item, 'parcel', parcel.from, to, next);
}

/** La charge vient d'être posée: drapeau de la draisine, ou objet du colis au cellier. */
export function loadPlaced(sim: Sim, beam: Beam): void {
  const { world } = sim;
  if (beam.purpose === 'handcar') {
    const flag = sim.content.settings.carry.handcar?.flag;
    if (flag !== undefined && !world.flags.includes(flag)) world.flags.push(flag);
    // Elle reste là où on l'a poussée (le rendu la dessine à cette place, plus dans la remise).
    world.handcarAt = { pos: { x: beam.pos.x, y: beam.pos.y }, facing: beam.facing };
    sayIfWritten(sim, 'both', 'handcar_pushed');
  } else if (beam.purpose === 'parcel' && beam.contents !== null) {
    const index = world.heavyDeliveries.indexOf(beam.contents);
    if (index >= 0) world.heavyDeliveries.splice(index, 1);
    addStack(world.cellar, beam.contents, 'ordinary', 1);
    sayIfWritten(sim, 'both', 'parcel_delivered', { item: itemWithArticle(sim, beam.contents, 1) });
  }
  sim.runtime.changed = true;
}
