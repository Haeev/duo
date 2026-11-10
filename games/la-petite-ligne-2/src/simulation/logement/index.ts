/**
 * Système « logement »: restauration des pièces par étapes (matériaux, argent, travail, histoire),
 * inventaire de meubles et mode déco à deux (verrou par meuble tenu), confort et bonus de sommeil.
 * Le moteur ne nomme aucun logement: tout vient de `donnees/lieux/<lieu>/logements/`.
 */
import type { PlaceContent } from '../../donnees/charger';
import type { PlayerIndex } from '../../donnees/schemas/communs';
import type { HousingDef, RoomDef } from '../../donnees/schemas/logement';
import { initialBrickStates } from '../../etat/briques';
import type { HousingState } from '../../etat/logement';
import type { PlaceState } from '../../etat/lieu';
import { postureOf } from '../briques/postures';
import type { Intent } from '../noyau/entrees';
import { findProp } from '../noyau/obstacles';
import type { GameSystem, SimContext } from '../noyau/systemes';
import { evaluateAll } from '../regles/conditions';
import { remember } from '../regles/memoire';
import { countItem, removeItem } from '../sac/inventaire';
import { comfortLevel, comfortOf, ensureHousings, housingAt } from './etat';
import { placementRefusal, propsOnTop, snapCandidate } from './pose';
import { HOUSING_TUNING } from './reglages';

interface Ctx {
  readonly place: PlaceContent;
  readonly pstate: PlaceState;
  readonly def: HousingDef;
  readonly state: HousingState;
}

function refuse(
  sim: SimContext,
  player: PlayerIndex,
  reason: string,
  target: string | null = null,
): void {
  sim.emit({ type: 'refused', player, reason, target });
}

function contextOf(sim: SimContext, housing: string): Ctx | null {
  const id = sim.world.common.place;
  const place = sim.content.places[id];
  const pstate = sim.world.places[id];
  const def = place?.housings[housing];
  if (place === undefined || pstate === undefined || def === undefined) return null;
  if (ensureHousings(place, pstate, sim.world.common.day)) sim.touch('place');
  const state = pstate.housing?.[housing];
  return state === undefined ? null : { place, pstate, def, state };
}

function near(sim: SimContext, player: PlayerIndex, room: RoomDef): boolean {
  const { x, y } = sim.world.players[player].body;
  const a = room.area;
  const r = HOUSING_TUNING.reach;
  return x >= a.x - r && x <= a.x + a.w + r && y >= a.y - r && y <= a.y + a.h + r;
}

/** Refus pour commencer ou poursuivre l'étape en cours d'une pièce, `null`: on peut. */
function stageRefusal(
  sim: SimContext,
  player: PlayerIndex,
  ctx: Ctx,
  room: RoomDef,
): string | null {
  const progress = ctx.state.rooms[room.id];
  if (progress === undefined || progress.state === 'restored') return 'room-done';
  const stage = room.stages[progress.stage];
  if (stage === undefined) return 'room-done';
  if (room.requires.some((r) => ctx.state.rooms[r]?.state !== 'restored'))
    return 'room-needs-other';
  if (!evaluateAll({ world: sim.world, content: sim.content, actor: player }, stage.when))
    return 'room-story-not-yet';
  if (!near(sim, player, room)) return 'too-far';
  return null;
}

function factKey(sim: SimContext, def: HousingDef, detail: string): string {
  return `${sim.world.common.place}.${def.id}.${detail}`;
}

function refreshComfort(sim: SimContext, ctx: Ctx): void {
  const comfort = comfortOf(sim.content, ctx.place, ctx.pstate, ctx.def);
  const level = comfortLevel(comfort);
  if (comfort === ctx.state.comfort && level === ctx.state.level) return;
  const before = ctx.state.level;
  ctx.state.comfort = comfort;
  ctx.state.level = level;
  sim.touch('place');
  if (level !== before) sim.emit({ type: 'comfort_changed', housing: ctx.def.id, level });
  // Faits pour les quêtes: un palier atteint reste acquis (indicateur doux, jamais punitif).
  for (let n = 1; n <= level; n++) {
    const key = factKey(sim, ctx.def, `confort-${String(n)}`);
    if (sim.world.progress.memory[key] === undefined) remember(sim, key, true, 'duo');
  }
}

/** Finit l'étape si tout y est (matériaux, argent, travail); la pièce est restaurée après la dernière. */
function tryAdvance(sim: SimContext, ctx: Ctx, room: RoomDef): void {
  const progress = ctx.state.rooms[room.id];
  const stage = progress === undefined ? undefined : room.stages[progress.stage];
  if (progress === undefined || stage === undefined) return;
  const supplied = stage.materials.every((m) => (progress.delivered[m.item] ?? 0) >= m.count);
  if (!supplied || progress.paid < stage.cost || progress.work < stage.work) return;
  const finished = progress.stage;
  progress.delivered = {};
  progress.paid = 0;
  progress.work = 0;
  const done = finished + 1 >= room.stages.length;
  if (done) {
    progress.state = 'restored';
    ctx.state.working = [
      ctx.state.working[0] === room.id ? null : ctx.state.working[0],
      ctx.state.working[1] === room.id ? null : ctx.state.working[1],
    ];
    remember(sim, factKey(sim, ctx.def, room.id), 'restored', 'duo');
  } else progress.stage = finished + 1;
  sim.touch('place');
  sim.emit({ type: 'room_progress', housing: ctx.def.id, room: room.id, stage: finished, done });
  if (done) refreshComfort(sim, ctx);
}

function begin(ctx: Ctx, room: RoomDef): void {
  const progress = ctx.state.rooms[room.id];
  if (progress !== undefined && (progress.state === 'ruin' || progress.state === 'absent'))
    progress.state = 'works';
}

function supply(sim: SimContext, player: PlayerIndex, ctx: Ctx, room: RoomDef): void {
  const refusal = stageRefusal(sim, player, ctx, room);
  if (refusal !== null) {
    refuse(sim, player, refusal, room.id);
    return;
  }
  const progress = ctx.state.rooms[room.id];
  const stage = progress === undefined ? undefined : room.stages[progress.stage];
  if (progress === undefined || stage === undefined) return;
  const holder = sim.world.players[player];
  let given = 0;
  for (const m of stage.materials) {
    const want = m.count - (progress.delivered[m.item] ?? 0);
    const n = Math.min(want, countItem(holder, m.item));
    if (n <= 0 || !removeItem(holder, m.item, n)) continue;
    progress.delivered[m.item] = (progress.delivered[m.item] ?? 0) + n;
    given += n;
    sim.emit({ type: 'room_supplied', player, room: room.id, item: m.item, count: n });
  }
  if (given === 0) {
    refuse(sim, player, 'room-nothing-to-give', room.id);
    return;
  }
  begin(ctx, room);
  sim.touch('players');
  sim.touch('place');
  tryAdvance(sim, ctx, room);
}

/** Paie le reste de l'étape: le coffre commun d'abord, la bourse de qui paie pour compléter. */
function payStage(sim: SimContext, player: PlayerIndex, ctx: Ctx, room: RoomDef): void {
  const refusal = stageRefusal(sim, player, ctx, room);
  if (refusal !== null) {
    refuse(sim, player, refusal, room.id);
    return;
  }
  const progress = ctx.state.rooms[room.id];
  const stage = progress === undefined ? undefined : room.stages[progress.stage];
  if (progress === undefined || stage === undefined) return;
  const due = stage.cost - progress.paid;
  if (due <= 0) {
    refuse(sim, player, 'room-already-paid', room.id);
    return;
  }
  const common = sim.world.common;
  const purse = sim.world.players[player];
  const fromChest = Math.min(common.chest, due);
  const fromPurse = due - fromChest;
  if (purse.money < fromPurse) {
    refuse(sim, player, 'not-enough-money', room.id);
    return;
  }
  if (fromChest > 0) {
    common.chest -= fromChest;
    sim.touch('common');
    sim.emit({ type: 'money_changed', who: 'chest', delta: -fromChest });
  }
  if (fromPurse > 0) {
    purse.money -= fromPurse;
    sim.touch('players');
    sim.emit({ type: 'money_changed', who: player, delta: -fromPurse });
  }
  progress.paid += due;
  begin(ctx, room);
  sim.touch('place');
  tryAdvance(sim, ctx, room);
}

function work(sim: SimContext, player: PlayerIndex, ctx: Ctx, room: RoomDef, on: boolean): void {
  if (!on) {
    if (ctx.state.working[player] === null) return;
    ctx.state.working[player] = null;
    sim.touch('place');
    return;
  }
  const refusal = stageRefusal(sim, player, ctx, room);
  if (refusal !== null) {
    refuse(sim, player, refusal, room.id);
    return;
  }
  const progress = ctx.state.rooms[room.id];
  const stage = progress === undefined ? undefined : room.stages[progress.stage];
  if (progress === undefined || stage === undefined) return;
  if (stage.materials.some((m) => (progress.delivered[m.item] ?? 0) < m.count)) {
    refuse(sim, player, 'room-missing-materials', room.id);
    return;
  }
  if (progress.paid < stage.cost) {
    refuse(sim, player, 'room-not-paid', room.id);
    return;
  }
  ctx.state.working[player] = room.id;
  begin(ctx, room);
  sim.touch('place');
  sim.emit({ type: 'gesture_started', player, clip: HOUSING_TUNING.workClip, target: null });
  tryAdvance(sim, ctx, room);
}

function stepWork(sim: SimContext, ctx: Ctx): void {
  const working = ctx.state.working;
  for (const p of [0, 1] as const) {
    const roomId = working[p];
    if (roomId === null) continue;
    const room = ctx.def.rooms.find((r) => r.id === roomId);
    const player = sim.world.players[p];
    if (
      room === undefined ||
      player.body.speed > HOUSING_TUNING.workStopSpeed ||
      player.talk !== null ||
      !near(sim, p, room)
    ) {
      working[p] = null;
      sim.touch('place');
    }
  }
  const rooms = new Set([working[0], working[1]]);
  for (const roomId of rooms) {
    if (roomId === null) continue;
    const room = ctx.def.rooms.find((r) => r.id === roomId);
    const progress = ctx.state.rooms[roomId];
    if (room === undefined || progress === undefined) continue;
    const together = working[0] === roomId && working[1] === roomId;
    progress.work += sim.dt * (together ? HOUSING_TUNING.duoWorkRate : 1);
    tryAdvance(sim, ctx, room);
  }
}

/** Petit bonus de sommeil au réveil, dans un lit du logement, selon le palier de confort. */
function stepSleep(sim: SimContext, ctx: Ctx): void {
  const day = sim.world.common.day;
  if (ctx.state.sleptDay === day) return;
  ctx.state.sleptDay = day;
  sim.touch('place');
  const bonus = ctx.state.level * HOUSING_TUNING.comfort.sleepBonusPerLevel;
  if (bonus <= 0) return;
  for (const p of [0, 1] as const) {
    const posture = postureOf(ctx.pstate, p);
    if (posture?.kind !== 'sleep') continue;
    const bed = findProp(ctx.place, ctx.pstate, posture.object);
    if (bed === null || housingAt(ctx.place, ctx.pstate, bed.x, bed.y)?.id !== ctx.def.id) continue;
    const needs = sim.world.players[p].needs;
    needs.sleep = Math.min(100, needs.sleep + bonus);
  }
}

// --- Mode déco ---

function heldBy(ctx: Ctx, prop: string): PlayerIndex | null {
  if (ctx.state.held[0]?.prop === prop) return 0;
  if (ctx.state.held[1]?.prop === prop) return 1;
  return null;
}

function inUse(ctx: Ctx, prop: string): boolean {
  const states = ctx.pstate.objects[prop];
  if (states === undefined) return false;
  const seats = [...(states.sit ?? []), ...(states.sleep ?? [])];
  return seats.some((s) => s !== null);
}

function placedProp(ctx: Ctx, id: string): PlaceState['placed'][number] | null {
  return ctx.pstate.placed.find((p) => p.id === id) ?? null;
}

function release(sim: SimContext, player: PlayerIndex, ctx: Ctx): void {
  const held = ctx.state.held[player];
  if (held === null) return;
  if (held.prop === null) ctx.state.stock[held.type] = (ctx.state.stock[held.type] ?? 0) + 1;
  ctx.state.held[player] = null;
  sim.touch('place');
  sim.emit({ type: 'deco_changed', player, action: 'cancel', prop: held.prop, item: held.type });
}

/** Déplace un meuble et emporte ce qui est posé dessus (rotation comprise). */
function moveWithTop(
  sim: SimContext,
  ctx: Ctx,
  prop: PlaceState['placed'][number],
  x: number,
  y: number,
  rotation: 0 | 1 | 2 | 3,
): void {
  const carried = propsOnTop(sim.content, ctx.pstate, prop);
  const turns = (rotation - prop.rotation + 4) % 4;
  for (const item of carried) {
    let dx = item.x - prop.x;
    let dy = item.y - prop.y;
    for (let i = 0; i < turns; i++) [dx, dy] = [-dy, dx];
    const moved = placedProp(ctx, item.id);
    if (moved === null) continue;
    moved.x = x + dx;
    moved.y = y + dy;
    moved.rotation = ((moved.rotation + turns) % 4) as 0 | 1 | 2 | 3;
  }
  prop.x = x;
  prop.y = y;
  prop.rotation = rotation;
}

function decoIntent(sim: SimContext, player: PlayerIndex, ctx: Ctx, intent: Intent): void {
  const held = ctx.state.held[player];
  const decorating = ctx.state.decorating[player];
  // eslint-disable-next-line @typescript-eslint/switch-exhaustiveness-check -- seules les intentions du mode déco
  switch (intent.type) {
    case 'deco_mode': {
      if (intent.on) {
        const { x, y } = sim.world.players[player].body;
        if (housingAt(ctx.place, ctx.pstate, x, y)?.id !== ctx.def.id) {
          refuse(sim, player, 'deco-not-home');
          return;
        }
        ctx.state.decorating[player] = true;
      } else {
        release(sim, player, ctx);
        ctx.state.decorating[player] = false;
      }
      sim.touch('place');
      return;
    }
    default:
      break;
  }
  if (!decorating) {
    refuse(sim, player, 'deco-not-decorating');
    return;
  }
  // eslint-disable-next-line @typescript-eslint/switch-exhaustiveness-check -- seules les intentions du mode déco
  switch (intent.type) {
    case 'deco_grab': {
      if (held !== null) {
        refuse(sim, player, 'deco-hands-full');
        return;
      }
      const prop = placedProp(ctx, intent.prop);
      if (prop === null || housingAt(ctx.place, ctx.pstate, prop.x, prop.y)?.id !== ctx.def.id) {
        refuse(sim, player, 'gone', intent.prop);
        return;
      }
      if (heldBy(ctx, prop.id) !== null) {
        refuse(sim, player, 'deco-held-by-other', prop.id);
        return;
      }
      if (inUse(ctx, prop.id)) {
        refuse(sim, player, 'deco-in-use', prop.id);
        return;
      }
      ctx.state.held[player] = {
        prop: prop.id,
        type: prop.type,
        x: prop.x,
        y: prop.y,
        rotation: prop.rotation,
      };
      sim.touch('place');
      sim.emit({ type: 'deco_changed', player, action: 'grab', prop: prop.id, item: prop.type });
      return;
    }
    case 'deco_take': {
      if (held !== null) {
        refuse(sim, player, 'deco-hands-full');
        return;
      }
      const count = ctx.state.stock[intent.prop] ?? 0;
      if (count <= 0 || sim.content.props[intent.prop]?.placeable !== true) {
        refuse(sim, player, 'deco-not-in-stock');
        return;
      }
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete -- inventaire indexé par type: un type épuisé disparaît
      if (count === 1) delete ctx.state.stock[intent.prop];
      else ctx.state.stock[intent.prop] = count - 1;
      const at = snapCandidate(sim.content, {
        type: intent.prop,
        x: intent.x,
        y: intent.y,
        rotation: intent.rotation,
      });
      ctx.state.held[player] = {
        prop: null,
        type: intent.prop,
        x: at.x,
        y: at.y,
        rotation: at.rotation,
      };
      sim.touch('place');
      sim.emit({ type: 'deco_changed', player, action: 'take', prop: null, item: intent.prop });
      return;
    }
    case 'deco_move': {
      if (held === null) return;
      const at = snapCandidate(sim.content, {
        type: held.type,
        x: intent.x,
        y: intent.y,
        rotation: intent.rotation,
      });
      if (at.x === held.x && at.y === held.y && at.rotation === held.rotation) return;
      held.x = at.x;
      held.y = at.y;
      held.rotation = at.rotation;
      sim.touch('place');
      return;
    }
    case 'deco_drop': {
      if (held === null) {
        refuse(sim, player, 'deco-empty-hands');
        return;
      }
      const exclude = new Set<string>();
      const existing = held.prop === null ? null : placedProp(ctx, held.prop);
      if (existing !== null) {
        exclude.add(existing.id);
        for (const top of propsOnTop(sim.content, ctx.pstate, existing)) exclude.add(top.id);
      }
      const refusal = placementRefusal({
        content: sim.content,
        place: ctx.place,
        state: ctx.pstate,
        world: sim.world,
        housing: ctx.def,
        candidate: held,
        exclude,
      });
      if (refusal !== null) {
        refuse(sim, player, `deco-${refusal}`, held.prop);
        return;
      }
      let id: string;
      if (existing !== null) {
        moveWithTop(sim, ctx, existing, held.x, held.y, held.rotation);
        id = existing.id;
      } else {
        const def = sim.content.props[held.type];
        if (def === undefined) return;
        id = `pose-${String(ctx.pstate.nextPlacedId)}`;
        ctx.pstate.nextPlacedId += 1;
        ctx.pstate.placed.push({
          id,
          type: held.type,
          x: held.x,
          y: held.y,
          rotation: held.rotation,
        });
        ctx.pstate.objects[id] = initialBrickStates(def.bricks);
      }
      ctx.state.held[player] = null;
      sim.touch('place');
      sim.emit({ type: 'deco_changed', player, action: 'drop', prop: id, item: held.type });
      refreshComfort(sim, ctx);
      return;
    }
    case 'deco_cancel':
      release(sim, player, ctx);
      return;
    case 'deco_store': {
      const id = intent.prop ?? held?.prop ?? null;
      if (id === null) {
        // Sorti de l'inventaire et pas encore posé: il y retourne.
        release(sim, player, ctx);
        return;
      }
      const prop = placedProp(ctx, id);
      if (prop === null) {
        refuse(sim, player, 'gone', id);
        return;
      }
      const holder = heldBy(ctx, id);
      if (holder !== null && holder !== player) {
        refuse(sim, player, 'deco-held-by-other', id);
        return;
      }
      if (inUse(ctx, id)) {
        refuse(sim, player, 'deco-in-use', id);
        return;
      }
      if ((ctx.pstate.objects[id]?.store ?? []).some((s) => s !== null)) {
        refuse(sim, player, 'deco-not-empty', id);
        return;
      }
      if (propsOnTop(sim.content, ctx.pstate, prop).length > 0) {
        refuse(sim, player, 'deco-surface-busy', id);
        return;
      }
      ctx.pstate.placed.splice(ctx.pstate.placed.indexOf(prop), 1);
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete -- état des briques indexé par instance: le meuble rangé n'en a plus
      delete ctx.pstate.objects[id];
      ctx.state.stock[prop.type] = (ctx.state.stock[prop.type] ?? 0) + 1;
      if (holder === player) ctx.state.held[player] = null;
      sim.touch('place');
      sim.emit({ type: 'deco_changed', player, action: 'store', prop: id, item: prop.type });
      refreshComfort(sim, ctx);
      return;
    }
    default:
      return;
  }
}

function onIntent(sim: SimContext, player: PlayerIndex, intent: Intent): void {
  // eslint-disable-next-line @typescript-eslint/switch-exhaustiveness-check -- chaque système ignore les intentions des autres
  switch (intent.type) {
    case 'housing_supply':
    case 'housing_pay':
    case 'housing_work': {
      const ctx = contextOf(sim, intent.housing);
      const room = ctx?.def.rooms.find((r) => r.id === intent.room);
      if (ctx === null || room === undefined) {
        refuse(sim, player, 'gone');
        return;
      }
      if (intent.type === 'housing_supply') supply(sim, player, ctx, room);
      else if (intent.type === 'housing_pay') payStage(sim, player, ctx, room);
      else work(sim, player, ctx, room, intent.on);
      return;
    }
    case 'deco_mode':
    case 'deco_grab':
    case 'deco_take':
    case 'deco_move':
    case 'deco_drop':
    case 'deco_cancel':
    case 'deco_store': {
      const ctx = contextOf(sim, intent.housing);
      if (ctx === null) {
        refuse(sim, player, 'gone');
        return;
      }
      decoIntent(sim, player, ctx, intent);
      return;
    }
    default:
      return;
  }
}

function onStep(sim: SimContext): void {
  if (sim.world.common.phase !== 'day') return;
  const id = sim.world.common.place;
  const place = sim.content.places[id];
  const pstate = sim.world.places[id];
  if (place === undefined || pstate === undefined) return;
  if (Object.keys(place.housings).length === 0) return;
  if (ensureHousings(place, pstate, sim.world.common.day)) sim.touch('place');
  for (const def of Object.values(place.housings)) {
    const state = pstate.housing?.[def.id];
    if (state === undefined) continue;
    const ctx: Ctx = { place, pstate, def, state };
    stepWork(sim, ctx);
    stepSleep(sim, ctx);
  }
}

export const housingSystem: GameSystem = { id: 'logement', step: onStep, intent: onIntent };
