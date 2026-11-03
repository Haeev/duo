/**
 * La basse-cour (FE-07, puis 0.12, conception section 4.2): les poules au poulailler, la mangeoire,
 * un œuf par poule nourrie et par jour; depuis la 0.12, le bonheur de chaque poule (grain, paille,
 * caresse, appel par son nom), le grain en rations, le coq, la couvée de sept nuits, les poussines
 * qui suivent leur mère et les coquelets que le cousin d'Odette reprend.
 *
 * Tout tirage passe par `unitDraw` (graine, clé, jour), jamais par le générateur de la partie: la
 * couvée donne le même résultat chez l'hôte, après une reprise et dans les robots.
 */
import type { HenCareSettings } from '../donnees/types';
import { dayOfSeason, seasonOfDay } from '../donnees/calendrier';
import type { Character, CharacterId, Chick, Fowl, Hen, Quality, Vec2 } from '../etat/types';
import { clampHappiness, coopCapacity, findAnimal } from '../etat/elevage';
import { henNameVisible } from '../etat/secrets';
import { unitDraw } from '../etat/tirage';
import { type Sim, bump, character, distance, emit, newId, notifyKey, partnerOf, point, say } from './contexte';
import { gesture } from './potager';
import { ITEM, POINT, ZONE } from './ids';
import { addToBag, countInBag, dropAt, takeFromBag } from './sac';
import { storeAtHome } from './rangement';
import { variantOf } from './conditions';

/** Drapeaux posés par les quêtes (lot L-quêtes): le coq lâché au poulailler, la couvée permise. */
export const ROOSTER_FLAG = 'rooster_arrived';
export const BROOD_FLAG = 'brood_enabled';

/** Le coq entre au poulailler quand la quête pose son drapeau (une seule fois: il ne part jamais). */
export function updateRoosterFlag(sim: Sim): void {
  if (sim.world.breeding.rooster === null && sim.world.flags.includes(ROOSTER_FLAG)) spawnRooster(sim);
}

/** Drapeau posé quand Odette a laissé le premier sac de grain (première fois que le grain compte). */
export const GRAIN_GIFT_FLAG = 'grain_gift';

/**
 * La permutation n° `k` (ordre lexicographique) des indices 0 à n - 1: avec trois variantes,
 * 0 donne [0, 1, 2], 1 donne [0, 2, 1]... 5 donne [2, 1, 0] (tableau 2.2 de la conception).
 */
export function permutation(n: number, k: number): number[] {
  const pool = Array.from({ length: n }, (_, i) => i);
  const out: number[] = [];
  let factorial = 1;
  for (let i = 2; i < n; i++) factorial *= i;
  let rest = k % (factorial * Math.max(1, n));
  for (let left = n; left > 0; left--) {
    const index = Math.floor(rest / factorial);
    rest %= factorial;
    out.push(pool.splice(index, 1)[0] ?? 0);
    if (left > 1) factorial /= left - 1;
  }
  return out;
}

/** Nombre de permutations de n variantes (n!). */
export function permutationCount(n: number): number {
  let f = 1;
  for (let i = 2; i <= n; i++) f *= i;
  return f;
}

/** Bonheur d'une poule qui arrive (0.12): « Tranquille ». */
export function newHenHappiness(sim: Pick<Sim, 'content'>): number {
  return sim.content.settings.hens.care?.happiness.start ?? 55;
}

export function spawnHens(
  sim: Sim,
  animal: string,
  count: number,
  names: string[],
  pointId: string,
  shuffleVariantsBy: string | null = null,
): void {
  // 0.12: l'effet `spawn_animals` amène aussi le coq et la chevrette (quêtes du lot L-quêtes).
  if (animal === 'rooster') {
    spawnRooster(sim);
    return;
  }
  if (animal === 'goat') {
    spawnGoatHook?.(sim);
    return;
  }
  const def = sim.content.animals[animal];
  if (def === undefined || sim.world.hens.length > 0) return;
  const at = point(sim, pointId);
  const n = def.variants.length;
  // Qui porte quelle couleur change d'une partie à l'autre (R16): tirage par la graine, sans le générateur.
  const order = shuffleVariantsBy === null || n === 0 ? null : permutation(n, variantOf(sim.world.seed, shuffleVariantsBy, permutationCount(n)));
  for (let i = 0; i < count; i++) {
    const pos = { x: at.x + (i - (count - 1) / 2) * 0.8, y: at.y + 0.6 };
    const v = order === null ? i % Math.max(1, n) : (order[i % n] ?? 0);
    sim.world.hens.push({
      id: newId(sim, 'h'),
      name: names[i] ?? def.name,
      variant: def.variants[v] ?? def.id,
      pos,
      prev: { ...pos },
      facing: 0,
      wander: { ...pos },
      nameKnownBy: [],
      namedBy: null,
      happiness: newHenHappiness(sim),
    });
  }
  notifyKey(sim, 'both', 'message', 'hens_arrived');
  emit(sim, { type: 'hens_arrived' });
}

/** Branché par `chevres.ts` (évite un import circulaire avec la chèvre). */
let spawnGoatHook: ((sim: Sim) => void) | null = null;
export function setGoatSpawner(fn: (sim: Sim) => void): void {
  spawnGoatHook = fn;
}

function care(sim: Pick<Sim, 'content'>): HenCareSettings | null {
  return sim.content.settings.hens.care;
}

/** Le grain compte (après la démo): la mangeoire consomme des rations. */
function grainCounts(sim: Sim): boolean {
  const c = care(sim);
  return c !== null && sim.world.clock.day >= c.grain.fromDay;
}

/** Rations qu'il faut pour nourrir toute la basse-cour aujourd'hui (les poussines picorent avec leur mère). */
export function rationsNeeded(sim: Pick<Sim, 'content' | 'world'>): number {
  return sim.world.hens.length * (care(sim)?.grain.perHen ?? 0);
}

/** Ouvre un sac de grain du sac de ce joueur si les rations manquent; le premier est offert par Odette. */
function topUpGrain(sim: Sim, c: Character | null, need: number): void {
  const s = care(sim);
  if (s === null) return;
  const b = sim.world.breeding;
  if (!sim.world.flags.includes(GRAIN_GIFT_FLAG)) {
    sim.world.flags.push(GRAIN_GIFT_FLAG);
    b.grainRations += s.grain.rations;
    say(sim, 'both', 'grain_gift');
  }
  while (c !== null && b.grainRations < need && countInBag(c, s.grain.item) > 0) {
    takeFromBag(c, s.grain.item, 1);
    b.grainRations += s.grain.rations;
  }
}

export function feedHens(sim: Sim, c: Character): void {
  if (sim.world.hens.length === 0) return;
  if (grainCounts(sim)) {
    const need = rationsNeeded(sim);
    topUpGrain(sim, c, need);
    const b = sim.world.breeding;
    if (b.grainRations < need) {
      say(sim, c.id, 'grain_missing');
      return;
    }
    if (sim.world.feederFilled) return;
    b.grainRations -= need;
  }
  sim.world.feederFilled = true;
  gesture(sim, c, 'feed', sim.content.settings.feel.actionSeconds.feed ?? 0, point(sim, POINT.henFeeder));
  bump(sim, 'fed', c.id);
  emit(sim, { type: 'fed_hens', by: c.id });
}

/** La poule au nid ne pond pas. */
function brooding(sim: Sim, hen: Hen): boolean {
  return sim.world.breeding.brood?.hen === hen.id;
}

/** Peut-elle pondre ce matin (règles 4.2), et de quelle qualité ? `null`: pas d'œuf. */
function eggOf(sim: Sim, hen: Hen, fed: boolean): Quality | null {
  const s = care(sim);
  const today = sim.world.clock.day;
  if (s === null) return fed ? 'ordinary' : null;
  if (brooding(sim, hen)) return null;
  const restedYesterday = hen.lastEggDay === undefined || hen.lastEggDay < today - 1;
  const h = s.happiness;
  if (fed) {
    if (hen.happiness < h.everyOtherBelow && !restedYesterday) return null;
  } else {
    // Sans grain, l'été elles picorent le pré: un œuf un jour sur deux (après la démo seulement).
    const season = seasonOfDay(sim.content.settings, today - 1);
    if (today <= s.grain.fromDay || !s.grain.forageSeasons.includes(season) || !restedYesterday) return null;
  }
  return hen.happiness >= h.fineFrom ? 'fine' : 'ordinary';
}

/** Le matin: les œufs des poules nourries la veille, au poulailler; puis le bonheur, la couvée, les poussines. */
export function morningEggs(sim: Sim): void {
  const hens = sim.world.hens.length;
  const s = sim.content.settings.hens;
  const fed = sim.world.feederFilled || !s.feedRequired;
  if (hens > 0) {
    let ordinary = 0;
    let fine = 0;
    for (const hen of sim.world.hens) {
      const q = eggOf(sim, hen, fed);
      if (q === null) continue;
      if (q === 'fine') fine += s.eggsPerHenPerDay;
      else ordinary += s.eggsPerHenPerDay;
      if (s.care !== null) hen.lastEggDay = sim.world.clock.day;
    }
    const at = point(sim, POINT.chickenCoop);
    const count = ordinary + fine;
    if (ordinary > 0) dropAt(sim, at.x + 0.5, at.y - 0.6, ITEM.egg, 'ordinary', ordinary);
    if (fine > 0) dropAt(sim, at.x + 0.5, at.y - 0.6, ITEM.egg, 'fine', fine);
    if (count > 0) {
      notifyKey(sim, 'both', 'message', 'eggs_found', { count });
      emit(sim, { type: 'eggs_laid', count });
    }
  }
  morningCare(sim, fed && hens > 0);
  sim.world.feederFilled = false;
  morningHopper(sim);
}

/** Le bonheur de la nuit (dérive, grain, paille), puis la couvée, les coquelets et les poussines. */
function morningCare(sim: Sim, fed: boolean): void {
  const s = care(sim);
  if (s === null) return;
  const { world } = sim;
  const b = world.breeding;
  const h = s.happiness;
  const yesterday = world.clock.day - 1;
  const straw = b.strawDay !== null && yesterday - b.strawDay <= h.strawDays;
  let happy = 0;
  for (const hen of world.hens) {
    hen.happiness = clampHappiness(hen.happiness + h.drift + (fed ? h.fed : 0) + (straw ? h.straw : 0), h);
    if (hen.happiness >= h.happy) happy += 1;
  }
  if (happy > 0) bump(sim, 'happy_hen_dawns', null, happy);
  leaveRoosterlings(sim);
  growChicks(sim, s);
  hatchBrood(sim, s);
  if (b.rooster !== null) emit(sim, { type: 'rooster_crowed' });
}

/** La mangeoire à trémie (catalogue): elle nourrit à l'aube tant qu'il reste des rations. */
function morningHopper(sim: Sim): void {
  const s = care(sim);
  if (s === null || !grainCounts(sim) || (sim.world.catalogueBought[s.grain.hopper] ?? 0) <= 0) return;
  const need = rationsNeeded(sim);
  if (need <= 0 || sim.world.breeding.grainRations < need) return;
  sim.world.breeding.grainRations -= need;
  sim.world.feederFilled = true;
}

// ---------------------------------------------------------------------------
// Gestes

/** Les gestes de soin du jour se notent dans `countersToday` (remis à zéro à l'aube), clés `care:...`. */
export function caredToday(sim: Pick<Sim, 'world'>, scope: CharacterId | 'duo', key: string): boolean {
  return (sim.world.countersToday[scope][`care:${key}`] ?? 0) > 0;
}

export function markCared(sim: Sim, scope: CharacterId | 'duo', key: string): void {
  sim.world.countersToday[scope][`care:${key}`] = 1;
  sim.runtime.changed = true;
}

/** Caresser une bête de la basse-cour: +3 une fois par joueur et par jour, +2 si l'on connaît son nom (une fois par jour). */
export function petAnimal(sim: Sim, c: Character, id: string): void {
  const ref = findAnimal(sim.world, id);
  const s = care(sim);
  if (ref === null || ref.kind === 'goat') return;
  gesture(sim, c, 'feed', 0.6, { x: ref.animal.pos.x, y: ref.animal.pos.y });
  emit(sim, { type: 'animal_petted', by: c.id, animal: id });
  if (ref.kind !== 'hen' || s === null) return;
  const hen = sim.world.hens.find((x) => x.id === id);
  if (hen === undefined || caredToday(sim, c.id, `pet:${id}`)) return;
  markCared(sim, c.id, `pet:${id}`);
  let gain = s.happiness.pet;
  if (henNameVisible(sim.world, hen, c.id) && !caredToday(sim, 'duo', `call:${id}`)) {
    markCared(sim, 'duo', `call:${id}`);
    gain += s.happiness.callByName;
  }
  hen.happiness = clampHappiness(hen.happiness + gain, s.happiness);
  bump(sim, 'hen_petted', c.id);
}

/** Une brassée de paille à la botte. */
export function takeStraw(sim: Sim, c: Character): void {
  const s = care(sim);
  if (s === null || countInBag(c, s.straw.item) > 0) return;
  if (addToBag(sim, c, s.straw.item, 'ordinary', 1) > 0) {
    say(sim, c.id, 'bag_full');
    return;
  }
  gesture(sim, c, 'pickup', 0.5, point(sim, POINT.strawBale));
  emit(sim, { type: 'straw_taken', by: c.id });
}

/** Changer la litière: la paille fraîche compte trois jours. */
export function strawCoop(sim: Sim, c: Character): void {
  const s = care(sim);
  if (s === null || countInBag(c, s.straw.item) === 0) return;
  takeFromBag(c, s.straw.item, 1);
  sim.world.breeding.strawDay = sim.world.clock.day;
  gesture(sim, c, 'feed', s.straw.seconds, point(sim, POINT.chickenCoop));
  bump(sim, 'coop_strawed', c.id);
  emit(sim, { type: 'coop_strawed', by: c.id });
}

// ---------------------------------------------------------------------------
// Le coq, la couvée, les poussines

/** Trois noms tirés sans redite parmi ceux qui restent (graine, nombre de noms déjà donnés). */
export function drawNames(sim: Sim, pool: readonly string[], key: string): string[] {
  const used = new Set(sim.world.breeding.namesUsed);
  const left = pool.filter((n) => !used.has(n));
  const list = left.length >= 3 ? left : [...pool];
  const out: string[] = [];
  const salt = sim.world.breeding.namesUsed.length + sim.world.breeding.naming.length;
  for (let i = 0; out.length < 3 && i < list.length * 4; i++) {
    const n = list[Math.floor(unitDraw(sim.world.seed, `name:${key}:${String(salt)}:${String(i)}`, sim.world.clock.day) * list.length)];
    if (n !== undefined && !out.includes(n)) out.push(n);
  }
  for (const n of list) if (out.length < 3 && !out.includes(n)) out.push(n);
  return out;
}

/** Demande un nom (choix parmi trois) au joueur dont c'est le tour. */
export function requestName(sim: Sim, animal: string, kind: 'rooster' | 'chick' | 'goat', pool: readonly string[]): void {
  const b = sim.world.breeding;
  const by = b.nextNamer;
  b.nextNamer = partnerOf(by);
  b.naming.push({ animal, kind, by, options: drawNames(sim, pool, kind) });
  sim.runtime.changed = true;
  emit(sim, { type: 'naming_requested', animal, by });
}

function spawnRooster(sim: Sim): void {
  const s = care(sim);
  const b = sim.world.breeding;
  if (s === null || b.rooster !== null) return;
  const at = point(sim, POINT.chickenCoop);
  const pos = { x: at.x - 0.8, y: at.y + 0.8 };
  const rooster: Fowl = { id: newId(sim, 'r'), name: '', variant: s.roosterVariant, pos, prev: { ...pos }, facing: 0, wander: { ...pos } };
  b.rooster = rooster;
  requestName(sim, rooster.id, 'rooster', s.roosterNames);
  bump(sim, 'animal_released', null);
  say(sim, 'both', 'rooster_arrived');
  emit(sim, { type: 'animal_arrived', animal: rooster.id, kind: 'rooster' });
}

/** Poules et poussines qui comptent dans la capacité (le coq n'y compte pas). */
export function coopHeadcount(sim: Pick<Sim, 'world'>): number {
  return sim.world.hens.length + sim.world.breeding.chicks.length;
}

/** Pourquoi on ne peut pas mettre à couver maintenant (clé de `textes.json`), ou `null`. */
export function broodRefusal(sim: Sim, c: Character, henId: string): string | null {
  const s = care(sim);
  const { world } = sim;
  const b = world.breeding;
  if (s === null) return 'brood_no';
  // La quête du coq pose `brood_enabled` une fois le coq nommé (README des données, section 3.1).
  if (b.rooster === null || !world.flags.includes(BROOD_FLAG)) return 'brood_no_rooster';
  if (b.brood !== null) return 'brood_busy';
  const day = world.clock.day;
  const season = seasonOfDay(sim.content.settings, day);
  if (!s.brood.seasons.includes(season) || (season === 'autumn' && dayOfSeason(sim.content.settings, day) > s.brood.lastSeasonDay)) return 'brood_season';
  const hen = world.hens.find((h) => h.id === henId);
  if (hen === undefined || hen.happiness < s.happiness.broodFrom) return 'brood_hen';
  if (countInBag(c, ITEM.egg) < s.brood.eggs) return 'brood_eggs';
  if (coopHeadcount(sim) + s.brood.eggs > coopCapacity(sim.content, world)) return 'brood_full';
  return null;
}

/** « Mettre à couver »: trois œufs du sac, la poule s'installe au nid pour sept nuits. */
export function startBrood(sim: Sim, c: Character, henId: string): void {
  const s = care(sim);
  const refusal = broodRefusal(sim, c, henId);
  if (s === null || refusal !== null) {
    say(sim, c.id, refusal ?? 'brood_no');
    return;
  }
  takeFromBag(c, ITEM.egg, s.brood.eggs);
  const hen = sim.world.hens.find((h) => h.id === henId);
  sim.world.breeding.brood = { hen: henId, eggs: s.brood.eggs, startDay: sim.world.clock.day, by: c.id };
  bump(sim, 'brood_started', c.id);
  say(sim, 'both', 'brood_started', { name: hen?.name ?? '' });
  emit(sim, { type: 'brood_started', by: c.id, hen: henId });
}

/** Couleur d'une poussine: celle de la mère 60 %, dorée 25 %, sinon une couleur qui manque encore. */
function chickColor(sim: Sim, s: HenCareSettings, mother: string, key: string): string {
  const r = unitDraw(sim.world.seed, `color:${key}`, sim.world.clock.day);
  if (r < s.brood.colorMother) return mother;
  if (r < s.brood.colorMother + s.brood.colorGolden) return s.goldenColor;
  const have = new Set([...sim.world.hens.map((h) => h.variant), ...sim.world.breeding.chicks.map((c) => c.variant)]);
  const missing = s.colors.filter((c) => !have.has(c));
  const pool = missing.length > 0 ? missing : s.colors;
  return pool[Math.floor(unitDraw(sim.world.seed, `missing:${key}`, sim.world.clock.day) * pool.length)] ?? mother;
}

/** À l'aube de la huitième journée: chaque œuf éclot à 75 %; un poussin sur quatre est un coquelet. */
function hatchBrood(sim: Sim, s: HenCareSettings): void {
  const b = sim.world.breeding;
  const brood = b.brood;
  if (brood === null || sim.world.clock.day < brood.startDay + s.brood.nights) return;
  b.brood = null;
  const mother = sim.world.hens.find((h) => h.id === brood.hen);
  const at = mother?.pos ?? point(sim, POINT.chickenCoop);
  let hatched = 0;
  let pullets = 0;
  for (let i = 0; i < brood.eggs; i++) {
    const key = `${brood.hen}:${String(brood.startDay)}:${String(i)}`;
    if (unitDraw(sim.world.seed, `hatch:${key}`, sim.world.clock.day) >= s.brood.hatchChance) continue;
    hatched += 1;
    const roosterling = unitDraw(sim.world.seed, `cockerel:${key}`, sim.world.clock.day) < s.brood.roosterlingChance;
    const pos: Vec2 = { x: at.x + (i - 1) * 0.25, y: at.y + 0.3 };
    const chick: Chick = {
      id: newId(sim, 'c'),
      name: '',
      variant: roosterling ? s.goldenColor : chickColor(sim, s, mother?.variant ?? s.goldenColor, key),
      pos,
      prev: { ...pos },
      facing: 0,
      wander: { ...pos },
      mother: brood.hen,
      bornDay: sim.world.clock.day,
    };
    if (roosterling) chick.roosterling = true;
    b.chicks.push(chick);
    if (!roosterling) {
      pullets += 1;
      requestName(sim, chick.id, 'chick', s.chickNames);
    }
  }
  bump(sim, 'brood_hatched', null);
  if (pullets > 0) bump(sim, 'chicks_hatched', null, pullets);
  say(sim, 'both', hatched === 0 ? 'brood_none' : pullets === hatched ? 'brood_hatched' : 'brood_hatched_roosterling', { count: hatched });
  emit(sim, { type: 'brood_hatched', count: hatched, pullets });
}

/** Le coquelet éclos la veille part chez le cousin d'Odette, qui laisse un sac de grain. */
function leaveRoosterlings(sim: Sim): void {
  const s = care(sim);
  const b = sim.world.breeding;
  if (s === null) return;
  const leaving = b.chicks.filter((c) => c.roosterling === true && c.bornDay < sim.world.clock.day);
  if (leaving.length === 0) return;
  b.chicks = b.chicks.filter((c) => !leaving.includes(c));
  storeAtHome(sim, s.grain.item, 'ordinary', leaving.length);
  say(sim, 'both', 'roosterling_left');
  emit(sim, { type: 'roosterling_left' });
}

/** Après dix nuits, la poussine devient poule et pond. */
function growChicks(sim: Sim, s: HenCareSettings): void {
  const b = sim.world.breeding;
  const grown = b.chicks.filter((c) => c.roosterling !== true && sim.world.clock.day >= c.bornDay + s.brood.growNights);
  for (const c of grown) {
    sim.world.hens.push({
      id: c.id,
      name: c.name,
      variant: c.variant,
      pos: c.pos,
      prev: c.prev,
      facing: c.facing,
      wander: c.wander,
      nameKnownBy: ['p1', 'p2'],
      namedBy: null,
      happiness: s.happiness.start,
    });
  }
  if (grown.length > 0) {
    b.chicks = b.chicks.filter((c) => !grown.includes(c));
    say(sim, 'both', 'chicks_grown', { count: grown.length });
  }
}

/** Choisir un nom (le joueur dont c'est le tour, parmi les trois proposés): visible chez les deux. */
export function nameAnimal(sim: Sim, c: Character, animal: string, name: string): void {
  const b = sim.world.breeding;
  const request = b.naming[0];
  if (request?.animal !== animal || request.by !== c.id || !request.options.includes(name)) return;
  b.naming.shift();
  b.namesUsed.push(name);
  const hen = sim.world.hens.find((h) => h.id === animal);
  const chick = b.chicks.find((x) => x.id === animal);
  const goat = b.goats.find((g) => g.id === animal);
  if (hen !== undefined) hen.name = name;
  if (chick !== undefined) chick.name = name;
  if (goat !== undefined) goat.name = name;
  if (b.rooster?.id === animal) b.rooster.name = name;
  bump(sim, 'animal_named', c.id);
  // Contrat des quêtes (README des données, section 3.1): `animal_named:rooster`, `animal_named:goat`.
  bump(sim, `animal_named:${request.kind}`, c.id);
  say(sim, 'both', `named_${request.kind}`, { player: c.name, name });
  emit(sim, { type: 'animal_named', by: c.id, animal, name });
}

// ---------------------------------------------------------------------------
// Déplacements

/** Les poules picorent dans leur enclos; les poussines suivent leur mère; le coq fait sa ronde. */
export function wanderHens(sim: Sim, dt: number): void {
  const pen = sim.map.zones[ZONE.henPen];
  const speed = sim.content.settings.feel.henSpeed;
  for (const hen of sim.world.hens) {
    // La couveuse reste au nid, devant la porte du poulailler.
    if (brooding(sim, hen)) {
      const nest = point(sim, POINT.chickenCoop);
      hen.wander.x = nest.x;
      hen.wander.y = nest.y - 0.4;
    }
    walkFowl(sim, hen, pen, speed, dt);
  }
  const b = sim.world.breeding;
  if (b.rooster !== null) walkFowl(sim, b.rooster, pen, speed, dt);
  for (const chick of b.chicks) {
    const mother = sim.world.hens.find((h) => h.id === chick.mother);
    if (mother !== undefined && distance(chick.wander, mother.pos) > 0.5) {
      chick.wander.x = mother.pos.x + (sim.rng.float(0, 1) - 0.5) * 0.6;
      chick.wander.y = mother.pos.y + (sim.rng.float(0, 1) - 0.5) * 0.6;
    }
    walkFowl(sim, chick, null, speed * 1.2, dt);
  }
}

function walkFowl(sim: Sim, f: Hen | Fowl, pen: { x: number; y: number; w: number; h: number } | undefined | null, speed: number, dt: number): void {
  const d = distance(f.pos, f.wander);
  if (d < 0.1) {
    if (pen !== undefined && pen !== null && sim.rng.chance(0.02)) {
      f.wander.x = sim.rng.float(pen.x + 0.3, pen.x + pen.w - 0.3);
      f.wander.y = sim.rng.float(pen.y + 0.3, pen.y + pen.h - 0.3);
    }
    return;
  }
  const stepLen = Math.min(d, speed * dt);
  f.pos.x += ((f.wander.x - f.pos.x) / d) * stepLen;
  f.pos.y += ((f.wander.y - f.pos.y) / d) * stepLen;
  f.facing = Math.atan2(f.wander.y - f.pos.y, f.wander.x - f.pos.x);
}

/** La bête de la basse-cour la plus proche à portée de caresse (poule, poussine, coq), ou `null`. */
export function pettableNear(sim: Sim, c: Character): Hen | Fowl | null {
  const s = care(sim);
  if (s === null) return null;
  let best: Hen | Fowl | null = null;
  let bestD = s.petRange;
  const b = sim.world.breeding;
  const all: (Hen | Fowl)[] = [...sim.world.hens, ...b.chicks];
  if (b.rooster !== null) all.push(b.rooster);
  for (const a of all) {
    const d = distance(c.pos, a.pos);
    if (d <= bestD) {
      best = a;
      bestD = d;
    }
  }
  return best;
}

/** Les joueurs: utile aux tests (qui nomme maintenant). */
export function namer(sim: Sim): Character | null {
  const first = sim.world.breeding.naming[0];
  return first === undefined ? null : character(sim, first.by);
}
