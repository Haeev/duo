/**
 * Brique `harvest`: un point de récolte du monde (couper un arbre, ramasser bois, pierres, fleurs
 * et baies, creuser un point de fouille, secouer un arbre fruitier). Tout vient de la fiche de la
 * ressource (`commun/ressources/<id>.json`). Un appui, un coup: les coups se cumulent dans l'état
 * de la brique, la récolte tombe au dernier; la ressource revient `respawnDays` jours plus tard
 * (jamais si `null`).
 */
import type { Brick } from '../../donnees/schemas/briques';
import type { PlayerIndex } from '../../donnees/schemas/communs';
import type { MapDef } from '../../donnees/schemas/lieu';
import type { ResourceDef } from '../../donnees/schemas/recolte';
import type { HarvestState } from '../../donnees/schemas/recolte-briques';
import type { DeepReadonly } from '../../etat/monde';
import type { BrickBehaviour, BrickView, Look } from '../briques/types';
import type { SimContext } from '../noyau/systemes';
import { finishedTogether, noteStrike, togetherCount } from '../regles/a-deux';
import { giveItem } from '../sac/actions';
import { newStack } from '../sac/inventaire';
import { drawLoot, lootAvailable, type Drawn } from './butin';
import { heldOf, heldTool, luckOf, powerOf, strike, strokeSeconds, tierOf } from './outils';
import { HARVEST_TUNING } from './reglages';

type HarvestBrick = Extract<Brick, { brick: 'harvest' }>;

/** Au plus 80 objets au sol (`etat/lieu.ts`). */
const GROUND_MAX = 80;

const ownResources = new WeakMap<MapDef, ReadonlyMap<string, string>>();

/** Ressources propres aux points de la carte (champ `resource` d'un objet), par identifiant. */
function ownResourcesOf(map: MapDef): ReadonlyMap<string, string> {
  let found = ownResources.get(map);
  if (found === undefined) {
    const built = new Map<string, string>();
    for (const o of map.objects) if (o.resource !== undefined) built.set(o.id, o.resource);
    found = built;
    ownResources.set(map, found);
  }
  return found;
}

/** La fiche de ce point: la sienne s'il en déclare une, sinon celle de la brique du meuble. */
export function resourceOf(look: Look, target: BrickView<HarvestBrick>): ResourceDef | null {
  const map = look.content.places[look.world.common.place]?.map;
  const own = map === undefined ? undefined : ownResourcesOf(map).get(target.id);
  return look.content.resources[own ?? target.params.resource] ?? null;
}

/** La ressource est-elle là (pas encore récoltée, ou repoussée) ? Pour le rendu: souche, arbre nu. */
export function resourceReady(look: Look, state: DeepReadonly<HarvestState> | undefined): boolean {
  const back = state?.back ?? null;
  return back === null || look.world.common.day >= back;
}

/** Part du travail déjà faite, de 0 à 1 (l'arbre qui penche, la fouille entamée). */
export function resourceProgress(
  look: Look,
  resource: ResourceDef,
  state: DeepReadonly<HarvestState> | undefined,
): number {
  if (!resourceReady(look, state)) return 0;
  return Math.min(1, (state?.work ?? 0) / resource.work);
}

/** Points d'un coup: ceux de l'outil, ou 1 à mains nues. */
function strokePower(look: Look, player: PlayerIndex, resource: ResourceDef): number {
  if (resource.tool === null) return 1;
  const held = heldTool(look, player, resource.tool);
  return held === null ? 0 : powerOf(held);
}

/** Pose des piles au sol autour du point (fruits secoués), à des places tirées par l'aléa. */
function dropAround(sim: SimContext, x: number, y: number, drawn: readonly Drawn[]): void {
  const place = sim.world.places[sim.world.common.place];
  if (place === undefined) return;
  for (const { item, count } of drawn) {
    const angle = sim.random.float(0, Math.PI * 2);
    const radius = HARVEST_TUNING.dropSpread * sim.random.float(0.6, 1);
    while (place.ground.length >= GROUND_MAX) place.ground.shift();
    place.ground.push({
      id: place.nextGroundId,
      stack: newStack(sim.content, item, count),
      x: x + Math.cos(angle) * radius,
      y: y + Math.sin(angle) * radius,
    });
    place.nextGroundId += 1;
  }
  sim.touch('place');
}

const HARVEST_VERB = 'Récolter';

export const harvestBehaviour: BrickBehaviour<HarvestBrick> = {
  verb: HARVEST_VERB,
  verbOf(look, _player, target) {
    return resourceOf(look, target)?.verb ?? HARVEST_VERB;
  },
  gesture(look, player, target) {
    const resource = resourceOf(look, target);
    if (resource === null) return null;
    const held = resource.tool === null ? null : heldTool(look, player, resource.tool);
    const seconds = strokeSeconds(look, player, held, resource.seconds);
    return { clip: resource.clip, seconds };
  },
  refuse(look, player, target) {
    const resource = resourceOf(look, target);
    if (resource === null) return 'gone';
    if (!resourceReady(look, target.states.harvest)) return 'not-yet-back';
    // Fleurs hors saison: rien à prendre maintenant, la bulle le dit. Une table vide (ronces à
    // arracher) n'a pas de saison: le geste reste permis.
    if (
      resource.loot.length > 0 &&
      !resource.loot.some((entry) => lootAvailable(look.content, look.world, entry))
    )
      return 'nothing-now';
    if (resource.tool !== null) {
      const held = heldTool(look, player, resource.tool);
      if (held === null) return `needs-${resource.tool}`;
      if (tierOf(held) < resource.minTier) return 'tool-too-weak';
    }
    return null;
  },
  use(sim, player, target) {
    const resource = resourceOf(sim, target);
    if (resource === null) return;
    const states = target.states;
    const state = (states.harvest ??= { work: 0, back: null });
    if (state.back !== null && sim.world.common.day >= state.back) {
      state.back = null;
      state.work = 0;
    }
    const held = resource.tool === null ? null : heldOf(sim, player);
    strike(sim, player, held?.slot ?? null, resource.effort, resource.dirty);
    noteStrike(sim, player, target.id);
    state.work = Math.min(resource.work, state.work + strokePower(sim, player, resource));
    const done = state.work >= resource.work;
    sim.emit({
      type: 'work_hit',
      player,
      target: target.id,
      action: resource.kind,
      progress: state.work / resource.work,
      done,
    });
    if (done) {
      state.work = 0;
      state.back =
        resource.respawnDays === null
          ? HARVEST_TUNING.neverBack
          : sim.world.common.day + resource.respawnDays;
      const { rareLuck, extraCatch } = luckOf(sim, player);
      const drawn = drawLoot(sim, resource, rareLuck, extraCatch);
      // À deux sur le même point (R12): le butin est multiplié.
      if (finishedTogether(sim, target.id))
        for (const one of drawn) one.count = togetherCount(sim, one.count);
      if (resource.toGround) dropAround(sim, target.x, target.y, drawn);
      else for (const { item, count } of drawn) giveItem(sim, player, item, count);
      for (const { item, count, rare } of drawn)
        sim.emit({
          type: 'harvested',
          player,
          target: target.id,
          resource: resource.id,
          item,
          count,
          rare,
        });
    }
    sim.touch('place');
  },
};
