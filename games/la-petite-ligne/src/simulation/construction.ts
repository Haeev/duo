/**
 * Construction guidée (MA-03): éléments fantômes bâtis en maintenant
 * l'action, matériaux pris dans le sac puis le cellier, deux fois plus vite à
 * deux. La poutre (`kind: carry`) est dans `deplacement.ts`.
 */
import type { ControlFrame } from '../etat/actions';
import type { Character, CharacterId, ConstructionState } from '../etat/types';
import type { ConstructionDef } from '../donnees/types';
import { type Sim, distance, emit, format, itemName, notify, point, notifyKey } from './contexte';
import { spend, durationMultiplier } from './besoins';
import { payMaterials } from './sac';

function defOf(sim: Sim, id: string): ConstructionDef | undefined {
  return sim.content.constructions.find((c) => c.id === id);
}

/** Construction fantôme à portée de ce personnage, avec son prochain élément à bâtir. */
export function ghostNear(sim: Sim, c: Character): { state: ConstructionState; def: ConstructionDef; element: number } | null {
  const range = sim.content.settings.feel.pointRadius;
  for (const state of sim.world.constructions) {
    if (state.status !== 'ghost') continue;
    const def = defOf(sim, state.id);
    if (def?.kind !== 'guided') continue;
    if (distance(c.pos, point(sim, def.point)) > range) continue;
    const element = state.elements.findIndex((e) => !e.done);
    if (element >= 0) return { state, def, element };
  }
  return null;
}

/** Une construction vient d'être achevée: les suivantes deviennent fantômes. */
export function completeConstruction(sim: Sim, id: string): void {
  const state = sim.world.constructions.find((c) => c.id === id);
  const def = defOf(sim, id);
  if (state === undefined || def === undefined || state.status === 'done') return;
  state.status = 'done';
  for (const e of state.elements) {
    e.done = true;
    e.progress = 1;
    e.workers = [];
  }
  notifyKey(sim, 'both', 'message', 'built', { construction: def.name });
  emit(sim, { type: 'construction_done', construction: id });
  for (const other of sim.world.constructions) {
    if (other.status !== 'locked') continue;
    const otherDef = defOf(sim, other.id);
    if (otherDef === undefined) continue;
    const ready = otherDef.requires.every((r) => sim.world.constructions.some((k) => k.id === r && k.status === 'done'));
    if (ready) other.status = 'ghost';
  }
  sim.runtime.dynamicDirty = true;
}

function missingText(sim: Sim, missing: { item: string; count: number }[]): string {
  const raw = sim.content.texts.raw.ui;
  const workbench = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>).workbench : undefined;
  const template =
    typeof workbench === 'object' && workbench !== null && typeof (workbench as Record<string, unknown>).missing === 'string'
      ? ((workbench as Record<string, unknown>).missing as string)
      : '{missing}';
  const list = missing.map((m) => `${m.count} ${itemName(sim, m.item, m.count)}`).join(', ');
  return format(template, { missing: list });
}

/** Travail maintenu sur les éléments fantômes. */
export function updateConstructions(sim: Sim, frames: Partial<Record<CharacterId, ControlFrame>>, dt: number): void {
  const s = sim.content.settings;
  for (const state of sim.world.constructions) {
    for (const e of state.elements) e.workers = [];
  }
  const work = new Map<string, Character[]>();
  for (const c of sim.world.characters) {
    const holding = frames[c.id]?.actHeld === true && c.status === 'active' && c.crafting === null;
    if (!holding) {
      sim.runtime.holdNotified[c.id] = false;
      if (c.action.kind === 'hammer' && c.action.duration === 0) c.action = { kind: 'idle', since: sim.world.tick, duration: 0, target: null };
      continue;
    }
    const target = ghostNear(sim, c);
    if (target === null) continue;
    const element = target.state.elements[target.element];
    const elementDef = target.def.elements[target.element];
    if (element === undefined || elementDef === undefined) continue;
    if (!element.paid) {
      const paid = payMaterials(sim, c, elementDef.inputs);
      if (!paid.ok) {
        if (!sim.runtime.holdNotified[c.id]) {
          sim.runtime.holdNotified[c.id] = true;
          notify(sim, c.id, 'message', missingText(sim, paid.missing));
        }
        continue;
      }
      element.paid = true;
    }
    const key = `${target.state.id}/${element.id}`;
    const list = work.get(key) ?? [];
    list.push(c);
    work.set(key, list);
    element.workers.push(c.id);
    if (c.action.kind !== 'hammer') {
      c.action = { kind: 'hammer', since: sim.world.tick, duration: 0, target: { ...point(sim, target.def.point) } };
      emit(sim, { type: 'build_progress', by: c.id, construction: target.state.id, element: element.id });
    }
    spend(sim, c, 'build_per_second', dt);
  }
  for (const [key, workers] of work) {
    const [stateId, elementId] = key.split('/');
    const state = sim.world.constructions.find((k) => k.id === stateId);
    const def = state === undefined ? undefined : defOf(sim, state.id);
    const index = state?.elements.findIndex((e) => e.id === elementId) ?? -1;
    const element = state?.elements[index];
    const elementDef = def?.elements[index];
    if (state === undefined || def === undefined || element === undefined || elementDef === undefined) continue;
    const slowest = Math.max(...workers.map((w) => durationMultiplier(sim, w)));
    const speed = workers.length >= 2 ? s.building.twoPlayersSpeedMultiplier : 1;
    element.progress = Math.min(1, element.progress + (dt * speed) / (elementDef.seconds * slowest));
    if (element.progress >= 1) {
      element.done = true;
      element.workers = [];
      emit(sim, { type: 'element_built', construction: state.id, element: element.id });
      if (state.elements.every((e) => e.done)) completeConstruction(sim, state.id);
    }
  }
}
