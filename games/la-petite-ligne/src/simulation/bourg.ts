/**
 * La rue Haute (tour 10, sections 1.4 à 1.8): les départs du tour, un par journée; le guichet du
 * fournil d'Achille (pain, pain chaud, brioche); le pain chaud qui redevient pain à midi; la panière
 * portée à deux (`achille_basket`); le chocolat chaud d'Odette; les mots des habitants.
 *
 * Tout ce qui est tiré l'est par la carte, l'horloge et les compteurs du monde: rien de `sim.rng`.
 */
import { weekdayOf, seasonOfDay } from '../donnees/calendrier';
import type { Character, CharacterId, ItemStack, WorldState } from '../etat/types';
import { villagerSays } from './annonces';
import { type Sim, bump, character, distance, emit, message, partnerOf, say, sayIfWritten } from './contexte';
import { sendLetter } from './courrier';
import { addHeart, eat } from './besoins';
import { giveToCharacter } from './sac';
import { buildingOpen } from './interieurs';

export const TOWN = {
  achille: 'achille',
  solange: 'solange',
  odette: 'odette',
  basketQuest: 'achille_basket',
  basketStep: 'carry',
  cutQuest: 'solange_first_cut',
  letter: 'solange_note',
  /** Drapeaux posés à l'aube par `morningTown` (lus par les emplois du temps et les dialogues). */
  achilleHere: 'achille_here',
  solangeHere: 'solange_here',
  letterSent: 'solange_note_sent',
  achilleWish: 'achille_wish_open',
  solangeWish: 'solange_wish_open',
  cartSaid: 'achille_cart_said',
  basketCarried: 'basket_carried',
  bakeryOpen: 'bakery_open',
  salonOpen: 'salon_open',
  basketItem: 'bread_basket',
  basketFrom: 'bakery_door',
  basketTo: 'grocery_door',
  window: 'bakery_window',
  table: 'grocery_table',
  grocery: 'grocery',
  warmBread: 'warm_bread',
  bread: 'bread',
  brioche: 'brioche',
  chocolate: 'hot_chocolate',
} as const;

const H = 60;
/** La panière attend jusqu'à 11 h; après, Achille la descend seul (section 1.7, cas limites). */
const BASKET_UNTIL = 11 * H;
/** Achille dort de 13 h à 17 h 30 (« Volets clos »). */
const ACHILLE_NAP: readonly [number, number] = [13 * H, 17 * H + 30];
/** Rayon autour du guichet où l'on achète et où Achille se tient (m). */
const WINDOW_REACH = 2.5;
/** Rayon de la petite table d'Odette (m). */
const TABLE_REACH = 1.6;
/** Deux chocolats dans la même demi-heure de jeu: on l'a bu ensemble (Cœur +5). */
const CHOCOLATE_TOGETHER_MINUTES = 30;
/** Cœur gagné ensemble au chocolat (`needs.heart.chocolateTogether` du lot L4, à défaut). */
const CHOCOLATE_TOGETHER_HEART = 5;
const MONDAY = 2;

/** Jours des départs du tour (section 1.7): partie neuve, ou un par journée depuis la reprise. */
export interface TownDays {
  basket: number;
  letter: number;
  achilleWish: number;
  solangeWish: number;
}

/**
 * `roomsFromDay`: jour de la lettre des plans de Basile (`reglages.rooms.opensFromDay`, lot L4). Une
 * partie reprise après ce jour la reçoit à sa première aube: la panière attend le lendemain.
 */
export function townDays(world: Pick<WorldState, 'upperStreetSince'>, roomsFromDay: number | null = null): TownDays {
  const since = world.upperStreetSince;
  if (since <= 1) return { basket: 4, letter: 5, achilleWish: 10, solangeWish: 12 };
  const first = roomsFromDay !== null && since >= roomsFromDay ? since + 1 : since;
  // Jamais un lundi pour la panière (le fournil est fermé).
  const basket = weekdayOf(first) === MONDAY ? first + 1 : first;
  return { basket, letter: basket + 1, achilleWish: basket + 2, solangeWish: basket + 3 };
}

function hasFlag(world: WorldState, flag: string): boolean {
  return world.flags.includes(flag);
}

function setFlag(sim: Sim, flag: string): void {
  if (!sim.world.flags.includes(flag)) sim.world.flags.push(flag);
  sim.runtime.changed = true;
}

function questStatus(world: WorldState, id: string): 'active' | 'done' | null {
  return world.quests.find((q) => q.id === id)?.status ?? null;
}

/** Le salon reçoit ce jour-là (la lettre n'arrive jamais un dimanche ni un lundi). */
function salonDay(sim: Sim, day: number): boolean {
  return sim.content.settings.town.salon.weekdays.includes(weekdayOf(day));
}

/**
 * L'aube (avant les emplois du temps): au plus une nouveauté par journée (R1), dans l'ordre de la
 * section 1.7. Le pain chaud de la veille est devenu du pain.
 */
export function morningTown(sim: Sim): void {
  const { world } = sim;
  coolBread(sim);
  if (!sim.content.villagers.some((v) => v.id === TOWN.achille)) return;
  const day = world.clock.day;
  const days = townDays(world, sim.content.settings.rooms?.opensFromDay ?? null);
  // Le lendemain de la panière, une notification qui ne compte pas comme une nouveauté.
  if (questStatus(world, TOWN.basketQuest) === 'done' && !hasFlag(world, TOWN.cartSaid)) {
    setFlag(sim, TOWN.cartSaid);
    sayIfWritten(sim, 'both', 'achille_cart');
  }
  if (!hasFlag(world, TOWN.achilleHere)) {
    if (day >= days.basket && weekdayOf(day) !== MONDAY) setFlag(sim, TOWN.achilleHere);
    return;
  }
  const basketDone = questStatus(world, TOWN.basketQuest) === 'done';
  if (!hasFlag(world, TOWN.letterSent)) {
    if (basketDone && day >= days.letter && salonDay(sim, day)) {
      setFlag(sim, TOWN.letterSent);
      setFlag(sim, TOWN.solangeHere);
      sendLetter(sim, TOWN.letter);
    }
    return;
  }
  if (!hasFlag(world, TOWN.achilleWish)) {
    if (basketDone && day >= days.achilleWish) setFlag(sim, TOWN.achilleWish);
    return;
  }
  if (!hasFlag(world, TOWN.solangeWish) && questStatus(world, TOWN.cutQuest) === 'done' && day >= days.solangeWish) {
    setFlag(sim, TOWN.solangeWish);
  }
}

// ---------------------------------------------------------------------------
// Pain chaud: il redevient pain à midi, partout (sacs, coffre, sol)

function coolStacks(stacks: (ItemStack | null)[]): boolean {
  let any = false;
  for (const s of stacks) {
    if (s?.item !== TOWN.warmBread) continue;
    s.item = TOWN.bread;
    any = true;
  }
  return any;
}

/** Tout pain chaud devient du pain (règle de midi, et à l'aube pour celui de la veille). */
export function coolBread(sim: Sim): void {
  const { world } = sim;
  let any = false;
  for (const c of world.characters) any = coolStacks(c.bag) || any;
  if (coolStacks(world.cellar)) {
    any = true;
    // Deux piles de pain au coffre n'en font qu'une.
    const merged: ItemStack[] = [];
    for (const s of world.cellar) {
      const same = merged.find((m) => m.item === s.item && m.quality === s.quality);
      if (same === undefined) merged.push(s);
      else same.count += s.count;
    }
    world.cellar.splice(0, world.cellar.length, ...merged);
  }
  for (const g of world.groundItems) {
    if (g.item !== TOWN.warmBread) continue;
    g.item = TOWN.bread;
    any = true;
  }
  if (any) sim.runtime.changed = true;
}

// ---------------------------------------------------------------------------
// Le guichet du fournil

/** Achille est-il au guichet, prêt à vendre ? */
function achilleServing(sim: Sim): boolean {
  const at = sim.map.points[TOWN.window];
  const v = sim.world.villagers.find((x) => x.id === TOWN.achille);
  return at !== undefined && v !== undefined && v.visible && v.activity === 'serve' && distance(v.pos, at) <= WINDOW_REACH;
}

/** Pourquoi le guichet ne vend pas (clé de `textes.messages`), ou `null` s'il vend. */
export function bakeryRefusal(sim: Sim): string | null {
  const b = sim.content.settings.town.bakery;
  const { day, minutes } = sim.world.clock;
  if (!hasFlag(sim.world, TOWN.bakeryOpen)) return 'bakery_closed';
  if (b.closedWeekdays.includes(weekdayOf(day)) || minutes < b.warmFrom || minutes >= b.breadUntil) {
    return minutes >= ACHILLE_NAP[0] && minutes < ACHILLE_NAP[1] ? 'bakery_asleep' : 'bakery_closed';
  }
  return achilleServing(sim) ? null : 'bakery_away';
}

export function nearWindow(sim: Sim, c: Character): boolean {
  const at = sim.map.points[TOWN.window];
  return at !== undefined && distance(c.pos, at) <= sim.content.settings.ranges.talk;
}

/** Ouvre le guichet (menu `bakery`) ou dit pourquoi il est fermé. */
export function openBakery(sim: Sim, c: Character): boolean {
  if (!nearWindow(sim, c)) return false;
  const refusal = bakeryRefusal(sim);
  if (refusal !== null) {
    say(sim, c.id, refusal);
    return false;
  }
  c.menu = 'bakery';
  if (c.status === 'active') c.status = 'menu';
  sim.runtime.changed = true;
  return true;
}

/** Un pain (chaud de 6 h à 9 h) ou une brioche (le dimanche), au plus `dailyCapPerPlayer` par jour. */
export function bakeryBuy(sim: Sim, c: Character, kind: 'bread' | 'brioche'): void {
  if (c.menu !== 'bakery' && !nearWindow(sim, c)) return;
  const refusal = bakeryRefusal(sim);
  if (refusal !== null) {
    say(sim, c.id, refusal);
    return;
  }
  const b = sim.content.settings.town.bakery;
  const { day, minutes } = sim.world.clock;
  if (kind === 'brioche' && !b.briocheWeekdays.includes(weekdayOf(day))) {
    sayIfWritten(sim, c.id, 'bakery_no_brioche');
    return;
  }
  const key = `bakery:${kind}`;
  const cap = kind === 'bread' ? b.dailyCapPerPlayer.bread : b.dailyCapPerPlayer.brioche;
  if ((sim.world.countersToday[c.id][key] ?? 0) >= cap) {
    sayIfWritten(sim, c.id, kind === 'bread' ? 'bakery_cap_bread' : 'bakery_cap_brioche', { count: cap });
    return;
  }
  const price = kind === 'bread' ? b.breadPrice : b.briochePrice;
  if (price > sim.world.purse) {
    say(sim, c.id, 'not_enough_money', { missing: price - sim.world.purse });
    return;
  }
  const item = kind === 'brioche' ? TOWN.brioche : minutes >= b.warmFrom && minutes < b.warmTo ? TOWN.warmBread : TOWN.bread;
  sim.world.purse -= price;
  giveToCharacter(sim, c, item, 'ordinary', 1);
  bump(sim, key, c.id);
  emit(sim, { type: 'bought', by: c.id, item, count: 1, price });
}

// ---------------------------------------------------------------------------
// Le chocolat chaud d'Odette (section 1.6)

/** Odette fait-elle le chocolat aujourd'hui, à cette heure ? (automne, hiver, ou pluie). */
export function chocolateOn(sim: Sim): boolean {
  const ch = sim.content.settings.town.grocer.chocolate;
  const { world } = sim;
  const grocery = sim.map.buildings[TOWN.grocery];
  if (grocery === undefined || !buildingOpen(sim, grocery)) return false;
  if (world.clock.minutes >= ch.until) return false;
  const season = seasonOfDay(sim.content.settings, world.clock.day);
  const odette = world.villagers.find((v) => v.id === TOWN.odette);
  // Odette sert au comptoir (activité `serve`), dans la boutique ou à son guichet de la place.
  if (odette?.visible !== true || odette.activity !== 'serve') return false;
  return ch.seasons.includes(season) || (ch.rainAnySeason && world.weather === 'rain');
}

export function atSmallTable(sim: Sim, c: Character): boolean {
  const at = sim.map.points[TOWN.table];
  return at !== undefined && c.inside === TOWN.grocery && distance(c.pos, at) <= TABLE_REACH;
}

/** Peut-il boire un chocolat maintenant (pour la visée) ? */
export function canDrinkChocolate(sim: Sim, c: Character): boolean {
  const ch = sim.content.settings.town.grocer.chocolate;
  return atSmallTable(sim, c) && chocolateOn(sim) && (sim.world.countersToday[c.id][TOWN.chocolate] ?? 0) < ch.perPlayerPerDay;
}

/** Une tasse, 5 sous, bue à la petite table: un plat pour le Ventre; à deux dans la demi-heure, Cœur +5. */
export function drinkChocolate(sim: Sim, c: Character): void {
  const ch = sim.content.settings.town.grocer.chocolate;
  if (!atSmallTable(sim, c)) return;
  if (!chocolateOn(sim)) {
    sayIfWritten(sim, c.id, 'chocolate_off');
    return;
  }
  if ((sim.world.countersToday[c.id][TOWN.chocolate] ?? 0) >= ch.perPlayerPerDay) {
    sayIfWritten(sim, c.id, 'chocolate_done');
    return;
  }
  if (ch.price > sim.world.purse) {
    say(sim, c.id, 'not_enough_money', { missing: ch.price - sim.world.purse });
    return;
  }
  sim.world.purse -= ch.price;
  bump(sim, TOWN.chocolate, c.id);
  emit(sim, { type: 'bought', by: c.id, item: TOWN.chocolate, count: 1, price: ch.price });
  eat(sim, c, TOWN.chocolate);
  c.action = { kind: 'eat', since: sim.world.tick, duration: 0, target: sim.map.points[TOWN.table] ?? null };
  const now = sim.world.clock.minutes;
  const other = character(sim, partnerOf(c.id));
  const last = sim.runtime.chocolateAt[other.id];
  sim.runtime.chocolateAt[c.id] = now;
  if (last !== null && now - last <= CHOCOLATE_TOGETHER_MINUTES && atSmallTable(sim, other)) {
    bump(sim, 'chocolate_together', null);
    for (const x of [c, other]) gainHeart(sim, x, CHOCOLATE_TOGETHER_HEART);
  }
}

/** Cœur gagné tout de suite: `addHeart` des besoins (lot L4), plafond et Cœur léger compris. */
export function gainHeart(sim: Sim, c: Character, amount: number): void {
  addHeart(sim, c, amount);
}

// ---------------------------------------------------------------------------
// La panière d'Achille (`achille_basket`)

function stepId(sim: Sim, quest: string): string | null {
  const q = sim.world.quests.find((x) => x.id === quest);
  if (q?.status !== 'active') return null;
  return sim.content.quests.find((x) => x.id === quest)?.steps[q.step]?.id ?? null;
}

/** La panière paraît devant le fournil le matin, tant que l'étape « porter » est en cours (jamais le lundi). */
export function basketDue(sim: Sim): boolean {
  const { world } = sim;
  return (
    world.phase === 'day' &&
    stepId(sim, TOWN.basketQuest) === TOWN.basketStep &&
    weekdayOf(world.clock.day) !== MONDAY &&
    world.clock.minutes < BASKET_UNTIL
  );
}

/** La panière posée devant la porte d'Odette: le drapeau de l'étape, les mots d'Odette et d'Achille. */
export function basketPlaced(sim: Sim, holders: readonly CharacterId[]): void {
  setFlag(sim, TOWN.basketCarried);
  emit(sim, { type: 'basket_delivered' });
  for (const id of holders.length > 0 ? holders : (['p1', 'p2'] as const)) {
    villagerSays(sim, id, TOWN.odette, message(sim, 'basket_odette'));
  }
}

/**
 * À chaque pas: la panière laissée devant le fournil à 11 h repart avec Achille (il la descend
 * seul, et le dit); le pain chaud redevient pain à midi.
 */
export function updateTown(sim: Sim, before: number): void {
  const { world } = sim;
  const after = world.clock.minutes;
  const b = sim.content.settings.town.bakery;
  if (before < b.warmBecomesBreadAt && after >= b.warmBecomesBreadAt) coolBread(sim);
  if (before < BASKET_UNTIL && after >= BASKET_UNTIL && stepId(sim, TOWN.basketQuest) !== null) {
    const beam = world.beam;
    if (beam?.purpose === 'basket' && !beam.carried) {
      world.beam = null;
      sim.runtime.dynamicDirty = true;
    }
    if (beam?.purpose !== 'basket' || !beam.carried) villagerSays(sim, null, TOWN.achille, message(sim, 'achille_alone'));
  }
}
