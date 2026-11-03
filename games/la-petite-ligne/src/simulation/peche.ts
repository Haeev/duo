/**
 * Pêche (CN-05, P1; 0.12: `docs/jeux/jeu-1/peche-0-12-conception.md`): lancer sur l'eau à portée
 * (assisté vers une ombre), l'ombre vient sous le bouchon, touche, ferrer pendant la fenêtre; le
 * poisson de l'ombre sort de l'eau. Manqué, l'ombre file. Le mythique demande l'épuisette de
 * l'autre. Les ombres, le guet et le coin qui frémit vivent dans `ombres.ts`.
 */
import { groundAt, inMap } from '../etat/carte';
import type { FishRarity } from '../etat/peche';
import type { Character, ItemId, Vec2 } from '../etat/types';
import { type Sim, bump, character, distance, emit, message, notify, partnerOf, sayIfWritten, secondsToTicks } from './contexte';
import { spend } from './besoins';
import { giveToCharacter, heldItem } from './sac';
import { seasonOfDay } from '../donnees/calendrier';
import { queueHint } from './astuces';
import { unitDraw } from '../etat/tirage';
import { assistedBobber, attractShadow, fishingZoneAt, fleeShadow, hasFishingZones, markGone, releaseShadow, removeShadow, watcherNear } from './ombres';

/** Pas d'échantillonnage du regard vers l'eau (m). */
const LOOK_STEP = 0.5;
/** Pas plus fin pour le lancer à distance: la rive d'en face se trouve à 25 cm près. */
const CAST_STEP = 0.25;
/** Un mythique qui attend son guetteur réessaie de mordre à ce rythme (s). */
const MYTHIC_RETRY_SECONDS = 1;

/** Tient une canne (la canne de départ ou une canne améliorée, même `toolKind`). */
export function holdsRod(sim: Pick<Sim, 'content'>, c: Character): boolean {
  const held = heldItem(c);
  return held !== null && (sim.content.items[held]?.tool?.toolKind ?? null) === 'fishing_rod';
}

/** Valeurs de la canne tenue (tour 9: la canne en bambou attend moins et laisse plus de temps pour ferrer). */
function rodStats(sim: Sim, c: Character): { wait: number; hook: number | null } {
  const tool = sim.content.items[heldItem(c) ?? '']?.tool ?? null;
  return { wait: tool?.biteWaitFactor ?? 1, hook: tool?.hookWindowSeconds ?? null };
}

/**
 * Point d'eau où le bouchon se pose devant le personnage, à portée de lancer, ou `null`.
 *
 * Retour R09 (2026-11-01): « on la jette à nos pieds ». Le bouchon allait au premier point
 * d'eau, soit à un mètre du bord. Il va maintenant à `castDistance` (configuration) le long
 * du regard, sans passer la fin de cette étendue d'eau (rive d'en face, moins
 * `castShoreMargin`), et jamais plus près que le premier point d'eau. Toujours sur un point
 * échantillonné dans l'eau, donc jamais sur la terre.
 */
export function waterAhead(sim: Sim, c: Character): Vec2 | null {
  const fishing = sim.content.settings.fishing;
  if (fishing === null) return null;
  const { map } = sim;
  const dx = Math.cos(c.facing);
  const dy = Math.sin(c.facing);
  const stepSize = fishing.castDistance === null ? LOOK_STEP : CAST_STEP;
  let first: number | null = null;
  let lastWater = 0;
  for (let d = stepSize; d <= fishing.castRange; d += stepSize) {
    const cx = Math.floor(c.pos.x + dx * d);
    const cy = Math.floor(c.pos.y + dy * d);
    if (!inMap(map, cx, cy)) break;
    const water = groundAt(map, cx, cy) === 'water';
    if (first === null) {
      if (!water) continue;
      if (fishing.castDistance === null) return { x: cx + 0.5, y: cy + 0.5 };
      first = d;
    } else if (!water) {
      break;
    }
    lastWater = d;
  }
  if (first === null) return null;
  const wanted = Math.max(first, Math.min(fishing.castDistance ?? first, lastWater - fishing.castShoreMargin));
  // Ramené sur un point échantillonné (tous dans l'eau entre `first` et `lastWater`).
  const d = first + Math.floor((wanted - first) / stepSize + 1e-9) * stepSize;
  return { x: c.pos.x + dx * d, y: c.pos.y + dy * d };
}

/** Poids des poissons ce jour-là (carte sans coins de pêche: l'ancienne règle du tour 8). */
export function fishWeightsOn(sim: Sim, day: number): Record<string, number> {
  const feel = sim.content.settings.feel;
  return feel.fishWeightsBySeason[seasonOfDay(sim.content.settings, day)] ?? feel.fishWeights;
}

/**
 * Attente avant la touche multipliée selon le temps (pluie, brume du matin), à partir du premier
 * jour de météo tirée: la démo garde ses attentes.
 */
export function biteWaitFactor(sim: Sim): number {
  const { world } = sim;
  const w = sim.content.settings.weather;
  if (world.clock.day < w.fromDay) return 1;
  const mist = world.morningMist && world.clock.minutes < w.mist.until ? w.mist.biteWaitFactor : 1;
  return w.biteWaitFactor[world.weather] * mist;
}

/** Carte sans coins de pêche (carte de secours): le poisson se tire à la touche, comme avant la 0.12. */
function pickFishLegacy(sim: Sim): string | null {
  const weights = Object.entries(fishWeightsOn(sim, sim.world.clock.day)).filter(([item, w]) => w > 0 && item in sim.content.items);
  const total = weights.reduce((sum, [, w]) => sum + w, 0);
  if (total <= 0) return null;
  let roll = sim.rng.float(0, total);
  for (const [item, w] of weights) {
    roll -= w;
    if (roll < 0) return item;
  }
  return weights[weights.length - 1]?.[0] ?? null;
}

/** Longueur d'une prise (cm): loi triangulaire, sommet au tiers bas (les grands spécimens sont rares). */
function drawLength(sim: Sim, [min, max]: readonly [number, number]): number {
  const u = unitDraw(sim.world.seed, `longueur:${String(sim.world.counters.duo.caught ?? 0)}`, sim.world.clock.day);
  const mode = 1 / 3;
  const t = u < mode ? Math.sqrt(u * mode) : 1 - Math.sqrt((1 - u) * (1 - mode));
  return Math.round(min + (max - min) * t);
}

/** « la tanche », « l'alose », « le chevesne » (pour « Nouveau dans le carnet: … »). */
export function definiteFishName(sim: Pick<Sim, 'content'>, item: ItemId): string {
  const def = sim.content.items[item];
  if (def === undefined) return item;
  if (/^(la|le|les) /i.test(def.name)) return def.name;
  if (/^[aeiouyhéèêâîôû]/i.test(def.name)) return `l'${def.name}`;
  return (def.indefinite ?? '').startsWith('une ') ? `la ${def.name}` : `le ${def.name}`;
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Le poisson sort de l'eau (sections 7.1 et 7.4): au sac (ou rendu à l'eau), compteurs, carnet
 * des poissons, séries, notifications chez le pêcheur et l'autre.
 */
export function landFish(sim: Sim, c: Character, item: ItemId, zone: string | null, cm: number): void {
  const { world } = sim;
  const f = world.fishing;
  const def = sim.content.items[item];
  const fish = def?.fish ?? null;
  const rarity: FishRarity = fish?.rarity ?? 'common';
  const released = fish?.released ?? false;
  const other = character(sim, partnerOf(c.id));
  const rules = sim.content.settings.fishing?.rules ?? null;
  if (!released) giveToCharacter(sim, c, item, 'ordinary', 1);
  bump(sim, 'caught', c.id);
  bump(sim, `caught:${item}`, c.id);
  if (rarity !== 'common') bump(sim, 'caught_rare', c.id);
  bump(sim, `caught_rarity:${rarity}`, c.id);
  const hot = zone !== null && f.hotSpot?.zone === zone;
  if (hot) bump(sim, 'caught_hot_spot', c.id);
  if (released) bump(sim, 'released', c.id);
  if (rarity !== 'common' && f.watch[other.id]?.active === true && distance(other.pos, c.pos) <= (rules?.watch.glintRadius ?? 8)) bump(sim, 'watched_for_other', other.id);
  // Carnet des poissons (commun aux deux, CN-01).
  const entry = f.log[item];
  const first = entry === undefined;
  const record = !first && cm > entry.record.cm;
  const together = other.inside === c.inside && distance(other.pos, c.pos) <= (rules?.togetherRadius ?? 15);
  if (entry === undefined) {
    f.log[item] = { count: 1, first: { day: world.clock.day, by: c.id, zone: zone ?? '', together }, record: { cm, by: c.id, day: world.clock.day } };
  } else {
    entry.count += 1;
    if (record) entry.record = { cm, by: c.id, day: world.clock.day };
  }
  if (record) bump(sim, 'fish_record', c.id);
  const streak = f.streak[c.id];
  f.streak[c.id] = streak !== null && streak.fish === item ? { fish: item, count: streak.count + 1 } : { fish: item, count: 1 };
  f.commonsInRow = rarity === 'common' ? f.commonsInRow + 1 : 0;
  f.lastCatchZone = zone;
  if (rarity === 'legendary' || rarity === 'mythic') {
    f.grandsCaught[item] = world.clock.day;
    markGone(sim, item);
    // Un légendaire au plus par jour pour le duo.
    if (rarity === 'legendary') for (const g of f.grands.list) if (sim.content.items[g.fish]?.fish?.rarity === 'legendary') g.gone = true;
  }
  announceCatch(sim, c, item, rarity, cm, released, zone);
  if (first) notifyText(sim, 'both', 'fish_new_entry', { fish: definiteFishName(sim, item) });
  else if (record) notifyText(sim, 'both', 'fish_record', { fish: def?.name ?? item, cm });
  if (hot) queueHint(sim, c.id, { on: 'fishing_hot_spot' });
  emit(sim, { type: 'caught', by: c.id, item, cm, rarity, released, first, record, ...(zone === null ? {} : { zone }) });
}

function notifyText(sim: Sim, who: Character['id'] | 'both', key: string, vars: Record<string, string | number>): void {
  if (!Object.hasOwn(sim.content.texts.messages, key)) return;
  notify(sim, who, 'message', message(sim, key, vars), { key });
}

/** Ce que disent les deux écrans d'une prise, selon la rareté (section 7.1). */
function announceCatch(sim: Sim, c: Character, item: ItemId, rarity: FishRarity, cm: number, released: boolean, zone: string | null): void {
  const def = sim.content.items[item];
  const a = def?.indefinite ?? def?.name ?? item;
  const other = partnerOf(c.id);
  const vars = { fish: a, Fish: capitalize(a), definite: definiteFishName(sim, item), cm, name: c.name };
  if (rarity === 'mythic') return;
  if (released) {
    const at = zone === 'ru' ? 'au ru' : "à l'Aubrune";
    const pronoun = a.startsWith('une ') || a.startsWith('la ') ? 'la' : 'le';
    notifyText(sim, c.id, 'fish_released', { ...vars, pronoun, at });
    notifyText(sim, other, 'fish_released_other', vars);
    return;
  }
  if (rarity === 'legendary') {
    notifyText(sim, c.id, 'fish_caught_legendary', vars);
    notifyText(sim, other, 'fish_caught_legendary_other', vars);
  } else if (rarity === 'epic') {
    notifyText(sim, c.id, 'fish_caught_epic', vars);
    notifyText(sim, other, 'fish_caught_epic_other', vars);
  } else if (rarity === 'rare') {
    notifyText(sim, c.id, 'fish_caught', vars);
    notifyText(sim, other, 'fish_caught_other', vars);
  } else {
    notifyText(sim, c.id, 'fish_caught', vars);
  }
}

/** Regarder l'eau (touche d'examen) près d'un coin de pêche: dit si c'est le coin qui frémit (section 6.3). */
export function examineWater(sim: Sim, c: Character): boolean {
  const rules = sim.content.settings.fishing?.rules;
  if (rules === undefined || !hasFishingZones(sim)) return false;
  const r = Math.ceil(rules.watch.waterRadius);
  for (let d = 0; d <= r; d++) {
    for (let a = 0; a < 16; a++) {
      const angle = c.facing + ((a % 2 === 0 ? 1 : -1) * Math.ceil(a / 2) * Math.PI) / 8;
      const zone = fishingZoneAt(sim, c.pos.x + Math.cos(angle) * d, c.pos.y + Math.sin(angle) * d);
      if (zone === null) continue;
      const key = sim.world.fishing.hotSpot?.zone === zone.id ? 'fish_examine_hot' : 'fish_examine';
      sayIfWritten(sim, c.id, key, { Zone: capitalize(zone.name) });
      return true;
    }
  }
  return false;
}

/** La ligne quitte l'eau sans prise: l'ombre réservée reprend sa nage (`release`) ou file (`flee`). */
function dropLine(sim: Sim, c: Character, shadow: 'release' | 'flee'): void {
  const line = c.fishing;
  if (line === null) return;
  if (line.shadow !== undefined) {
    if (shadow === 'release') releaseShadow(sim, line.shadow);
    else fleeShadow(sim, line.shadow, c.pos);
  }
  c.fishing = null;
  sim.runtime.changed = true;
}

/** Mythique ferré: l'autre a quelques secondes pour tendre l'épuisette (section 7.3). */
function startLanding(sim: Sim, c: Character, shadowId: number, item: ItemId): void {
  const rules = sim.content.settings.fishing?.rules;
  const line = c.fishing;
  if (rules === undefined || line === null) return;
  const def = sim.content.items[item]?.fish ?? null;
  const until = sim.world.tick + secondsToTicks(rules.grands.mythic.netSeconds);
  sim.world.fishing.landing = { fisher: c.id, fish: item, shadow: shadowId, until, cm: drawLength(sim, def?.lengthCm ?? [40, 50]) };
  line.until = until;
  sayIfWritten(sim, c.id, 'fish_mythic_pull');
  sayIfWritten(sim, partnerOf(c.id), 'fish_mythic_net', { name: c.name });
  sim.runtime.changed = true;
}

/** Espace près de celui qui tient le mythique: l'épuisette. Vrai si l'appui a servi. */
export function tryNet(sim: Sim, c: Character): boolean {
  const landing = sim.world.fishing.landing;
  const rules = sim.content.settings.fishing?.rules;
  if (landing === null || rules === undefined || landing.fisher === c.id) return false;
  const fisher = character(sim, landing.fisher);
  if (distance(fisher.pos, c.pos) > rules.grands.mythic.netRange) return false;
  sim.world.fishing.landing = null;
  fisher.fishing = null;
  removeShadow(sim, landing.shadow);
  landFish(sim, fisher, landing.fish, sim.content.items[landing.fish]?.fish?.zones[0] ?? null, landing.cm);
  notifyText(sim, 'both', `fish_mythic_done_${landing.fish}`, {});
  sim.world.session.togetherMoments += 1;
  return true;
}

/** Le mythique se décroche: épuisette trop tard (message), ou un joueur parti (sans message). */
function loseLanding(sim: Sim, quiet: boolean): void {
  const landing = sim.world.fishing.landing;
  if (landing === null) return;
  sim.world.fishing.landing = null;
  const fisher = character(sim, landing.fisher);
  fleeShadow(sim, landing.shadow, fisher.pos);
  markGone(sim, landing.fish);
  fisher.fishing = null;
  if (!quiet) notifyText(sim, 'both', `fish_mythic_lost_${landing.fish}`, {});
  emit(sim, { type: 'escaped', by: fisher.id });
}

/** Espace avec la canne: lancer, ferrer, ou remonter la ligne. */
export function fishAct(sim: Sim, c: Character): void {
  const fishing = sim.content.settings.fishing;
  if (fishing === null) return;
  const line = c.fishing;
  if (line?.phase === 'bite') {
    if (sim.world.fishing.landing?.fisher === c.id) return;
    const shadow = line.shadow === undefined ? undefined : sim.world.fishing.shadows.find((s) => s.id === line.shadow);
    if (shadow?.rarity === 'mythic') {
      startLanding(sim, c, shadow.id, shadow.fish);
      return;
    }
    c.fishing = null;
    if (shadow === undefined) {
      const item = pickFishLegacy(sim);
      if (item === null) return;
      landFish(sim, c, item, fishingZoneAt(sim, line.bobber.x, line.bobber.y)?.id ?? null, drawLength(sim, sim.content.items[item]?.fish?.lengthCm ?? [10, 20]));
      return;
    }
    removeShadow(sim, shadow.id);
    landFish(sim, c, shadow.fish, shadow.zone, drawLength(sim, sim.content.items[shadow.fish]?.fish?.lengthCm ?? [10, 20]));
    return;
  }
  if (line !== null) {
    // Ligne remontée avant la touche: rien n'est perdu, l'ombre reprend sa nage.
    dropLine(sim, c, 'release');
    return;
  }
  const bobber = (hasFishingZones(sim) ? assistedBobber(sim, c) : null) ?? waterAhead(sim, c);
  if (bobber === null) return;
  const [min, max] = fishing.biteWaitSeconds;
  let wait = sim.rng.float(min, max) * biteWaitFactor(sim) * rodStats(sim, c).wait;
  const tick = sim.world.tick;
  let biteAt = tick + secondsToTicks(wait);
  let shadow: number | undefined;
  const attracted = hasFishingZones(sim) ? attractShadow(sim, c, bobber) : null;
  if (attracted !== null) {
    const rules = fishing.rules;
    const s = attracted.shadow;
    if (s.rarity === 'legendary') wait = sim.rng.float(...rules.grands.biteWaitSeconds);
    else if (s.rarity === 'mythic') wait = sim.rng.float(...rules.grands.mythic.biteWaitSeconds);
    else if (attracted.fresh) wait *= rules.shadows.noShadowWaitFactor;
    biteAt = Math.max(tick + secondsToTicks(wait), attracted.arrives + secondsToTicks(rules.shadows.minBiteAfterArrival));
    shadow = s.id;
  }
  c.fishing = { phase: 'waiting', bobber, biteAt, until: 0, ...(shadow === undefined ? {} : { shadow }) };
  c.facing = Math.atan2(bobber.y - c.pos.y, bobber.x - c.pos.x);
  spend(sim, c, 'fish_cast');
  emit(sim, { type: 'cast', by: c.id, at: { ...bobber } });
}

/** La touche, puis le poisson qui s'échappe si l'on n'a pas ferré à temps; marcher remonte la ligne. */
export function updateFishing(sim: Sim, c: Character): void {
  const fishing = sim.content.settings.fishing;
  const line = c.fishing;
  const landing = sim.world.fishing.landing;
  if (landing !== null && landing.fisher === c.id) {
    const other = character(sim, partnerOf(c.id));
    if (c.absent || other.absent || c.status !== 'active') loseLanding(sim, true);
    else if (sim.world.tick > landing.until || c.speed > 0) loseLanding(sim, false);
    return;
  }
  if (line === null || fishing === null) return;
  if (c.speed > 0 || c.status !== 'active' || !holdsRod(sim, c)) {
    dropLine(sim, c, line.phase === 'bite' ? 'flee' : 'release');
    return;
  }
  const tick = sim.world.tick;
  const shadow = line.shadow === undefined ? undefined : sim.world.fishing.shadows.find((s) => s.id === line.shadow);
  if (shadow?.state === 'approach' && shadow.move !== undefined && tick >= shadow.move.until) {
    shadow.state = 'under';
    delete shadow.move;
    sim.runtime.changed = true;
  }
  if (line.phase === 'waiting' && tick >= line.biteAt) {
    // Le mythique ne mord que si un guetteur le regarde (section 4.3).
    if (shadow?.rarity === 'mythic' && watcherNear(sim, c.id, shadow.pos, fishing.rules.grands.mythic.watchRange) === null) {
      line.biteAt = tick + secondsToTicks(MYTHIC_RETRY_SECONDS);
      return;
    }
    line.phase = 'bite';
    line.until = tick + secondsToTicks(rodStats(sim, c).hook ?? fishing.hookWindowSeconds);
    emit(sim, { type: 'bite', by: c.id });
  } else if (line.phase === 'bite' && tick > line.until) {
    dropLine(sim, c, 'flee');
    sayIfWritten(sim, c.id, 'fish_escaped');
    emit(sim, { type: 'escaped', by: c.id });
  }
}
