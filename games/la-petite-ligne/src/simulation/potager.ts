/**
 * Potager (FE-02 à FE-04, FE-06 simplifié), bois (hache), eau (puits et
 * tonneau) et bêche libre (énigme d'Émile).
 */
import type { CropDef } from '../donnees/types';
import { seasonOfDay } from '../donnees/calendrier';
import type { Cell, Character, GardenCell, Quality, Tree } from '../etat/types';
import { type Sim, bump, emit, say, secondsToTicks, notifyKey } from './contexte';
import { queueHint } from './astuces';
import { durationMultiplier, spend } from './besoins';
import { giveToCharacter, heldItem, heldStack, takeFromBag } from './sac';
import { capacityOf } from './catalogue';
import { ITEM } from './ids';
import { updateQuests } from './quetes';

export function gardenCellAt(sim: Sim, cell: Cell): GardenCell | null {
  return sim.world.garden.find((g) => g.cell.cx === cell.cx && g.cell.cy === cell.cy) ?? null;
}

/** Lance l'animation d'un geste simple et bloque la marche pendant sa durée. */
export function gesture(sim: Sim, c: Character, kind: Character['action']['kind'], seconds: number, target: { x: number; y: number } | null): void {
  c.action = { kind, since: sim.world.tick, duration: secondsToTicks(seconds * durationMultiplier(sim, c)), target };
}

function actionSeconds(sim: Sim, key: string): number {
  return sim.content.settings.feel.actionSeconds[key] ?? 0.4;
}

function centre(cell: Cell): { x: number; y: number } {
  return { x: cell.cx + 0.5, y: cell.cy + 0.5 };
}

function toolUsed(sim: Sim, c: Character): void {
  queueHint(sim, c.id, { on: 'tool_used' });
}

export function till(sim: Sim, c: Character, g: GardenCell): void {
  if (g.soil !== 'grass') return;
  g.soil = 'tilled';
  // Jour de pluie: la terre fraîchement bêchée est mouillée comme le reste du potager (R13).
  if (sim.world.weather === 'rain') g.wet = true;
  spend(sim, c, 'till');
  gesture(sim, c, 'till', actionSeconds(sim, 'till'), centre(g.cell));
  bump(sim, 'tilled', c.id);
  emit(sim, { type: 'tilled', by: c.id, cell: { ...g.cell } });
  toolUsed(sim, c);
}

/** Cette culture se sème-t-elle aujourd'hui (saison du jour) ? */
export function inSowingSeason(sim: Sim, crop: CropDef): boolean {
  return crop.seasons.includes(seasonOfDay(sim.content.settings, sim.world.clock.day));
}

export function sow(sim: Sim, c: Character, g: GardenCell, seedItem: string): void {
  const seed = sim.content.items[seedItem];
  const cropId = seed?.plants ?? null;
  const crop = cropId === null ? undefined : sim.content.crops[cropId];
  if (g.soil !== 'tilled' || g.crop !== null || crop === undefined || cropId === null) return;
  // Hors saison (l'hiver), le semis est refusé et la graine reste dans le sac (section 2.3).
  if (!inSowingSeason(sim, crop)) {
    say(sim, c.id, 'sow_out_of_season');
    return;
  }
  if (takeFromBag(c, seedItem, 1).length === 0) return;
  g.crop = {
    crop: cropId,
    days: 0,
    stage: crop.stagesByDay[0] ?? 'seed',
    ripe: false,
    wateredEveryDay: true,
    sownDay: sim.world.clock.day,
    sownBy: c.id,
  };
  spend(sim, c, 'sow');
  gesture(sim, c, 'sow', actionSeconds(sim, 'sow'), centre(g.cell));
  bump(sim, 'sowed', c.id);
  bump(sim, `sowed:${cropId}`, c.id);
  emit(sim, { type: 'sowed', by: c.id, cell: { ...g.cell }, crop: cropId });
  queueHint(sim, c.id, { on: 'sowed' });
}

export function water(sim: Sim, c: Character, g: GardenCell): void {
  if (g.soil !== 'tilled') return;
  if (c.water <= 0) {
    emit(sim, { type: 'can_empty', by: c.id });
    queueHint(sim, c.id, { on: 'tool_empty', item: heldStack(c)?.item ?? '' });
    return;
  }
  c.water -= 1;
  g.wet = true;
  spend(sim, c, 'water');
  gesture(sim, c, 'water', actionSeconds(sim, 'water'), centre(g.cell));
  bump(sim, 'watered', c.id);
  emit(sim, { type: 'watered', by: c.id, cell: { ...g.cell } });
  toolUsed(sim, c);
  if (c.water === 0) {
    emit(sim, { type: 'can_empty', by: c.id });
    queueHint(sim, c.id, { on: 'tool_empty', item: heldStack(c)?.item ?? '' });
  }
}

export function harvest(sim: Sim, c: Character, g: GardenCell): void {
  const crop = g.crop;
  // Case déjà récoltée par l'autre: `harvestTaken` (simultane.ts).
  if (!crop?.ripe) return;
  const def = sim.content.crops[crop.crop];
  if (def === undefined) return;
  const quality: Quality = crop.wateredEveryDay ? 'fine' : 'ordinary';
  const count = def.yieldPerCell;
  g.crop = null;
  g.lastHarvest = { by: c.id, tick: sim.world.tick };
  giveToCharacter(sim, c, def.harvest, quality, count);
  spend(sim, c, 'harvest');
  gesture(sim, c, 'harvest', actionSeconds(sim, 'harvest'), centre(g.cell));
  for (const key of ['harvested', `harvested:${def.harvest}`, `harvested:q:${quality}`, `harvested:${def.harvest}:q:${quality}`]) {
    bump(sim, key, c.id, count);
  }
  emit(sim, { type: 'harvested', by: c.id, cell: { ...g.cell }, item: def.harvest, quality, count });
  if (quality === 'fine') notifyKey(sim, c.id, 'message', 'fine_quality');
}

/** Chaque matin: pousse si arrosée la veille, sinon attente (et la qualité « belle » est perdue). */
export function morningGrowth(sim: Sim): void {
  const rain = sim.world.weather === 'rain';
  for (const g of sim.world.garden) {
    const crop = g.crop;
    if (crop !== null && !crop.ripe) {
      const def = sim.content.crops[crop.crop];
      if (g.wet && def !== undefined) {
        crop.days += 1;
        crop.stage = def.stagesByDay[Math.min(crop.days, def.growthDays)] ?? 'ripe';
        crop.ripe = crop.days >= def.growthDays;
      } else {
        crop.wateredEveryDay = false;
      }
    }
    g.wet = rain && g.soil === 'tilled';
  }
}

/** La pluie du jour arrose tout le potager (FE-02). */
export function rainWaters(sim: Sim): void {
  if (sim.world.weather !== 'rain') return;
  for (const g of sim.world.garden) if (g.soil === 'tilled') g.wet = true;
}

export function refill(sim: Sim, c: Character, at: string): void {
  // La contenance de l'arrosoir tenu (tour 9: l'arrosoir de cuivre porte 20).
  c.water = capacityOf(sim, heldItem(c));
  gesture(sim, c, 'refill', actionSeconds(sim, 'refill'), null);
  emit(sim, { type: 'refilled', by: c.id, at });
}

export function chop(sim: Sim, c: Character, tree: Tree): void {
  if (tree.felled) return;
  const s = sim.content.settings.trees;
  tree.hits += 1;
  tree.lastHitTick = sim.world.tick;
  spend(sim, c, 'chop');
  gesture(sim, c, 'chop', actionSeconds(sim, 'chop'), { x: tree.pos.x, y: tree.pos.y });
  toolUsed(sim, c);
  // Coups de la hache tenue (tour 9: la hache de la forge abat en deux).
  const chops = sim.content.items[heldItem(c) ?? '']?.tool?.chops ?? s.chopsPerTree;
  const felled = tree.hits >= chops;
  if (felled) {
    tree.felled = true;
    tree.felledDay = sim.world.clock.day;
    sim.runtime.dynamicDirty = true;
    giveToCharacter(sim, c, ITEM.log, 'ordinary', s.logsPerTree);
    bump(sim, 'chopped', c.id);
  }
  emit(sim, { type: 'chop', by: c.id, tree: tree.id, felled });
}

/** Bêcher hors du potager: rien ne pousse, mais l'énigme d'Émile écoute. */
export function dig(sim: Sim, c: Character, at: { x: number; y: number }): void {
  spend(sim, c, 'till');
  gesture(sim, c, 'till', actionSeconds(sim, 'dig'), at);
  const found = updateQuests(sim, { tool: ITEM.hoe, pos: at, by: c.id });
  emit(sim, { type: 'dig', by: c.id, cell: { cx: Math.floor(at.x), cy: Math.floor(at.y) }, found });
}
