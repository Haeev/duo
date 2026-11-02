/**
 * Le salon de Solange (tour 10, section 2.3): le fauteuil (un joueur à la fois), la coupe validée
 * ou gardée, la proposition depuis le banc d'attente, la coupe remarquée par l'autre; la première
 * coupe offerte de `solange_first_cut`.
 */
import type { Character, CharacterId, HairOffer } from '../etat/types';
import { atSalonChair, firstCutFree as firstCutFreeIn } from '../etat/interieurs';
import { villagerSays } from './annonces';
import { type Sim, bump, character, distance, emit, message, notifyKey, partnerOf, say, sayIfWritten } from './contexte';
import { TOWN, gainHeart } from './bourg';
import { buildingOpen } from './interieurs';

export const SALON = {
  building: 'salon',
  chair: 'salon_chair',
  bench: 'salon_bench',
  /** Compteur de passage au fauteuil (« Garder ma coiffure » compte), lu par la quête. */
  chairCounter: 'salon_chair',
  /** Compteur des coupes qui changent quelque chose (envie `new_haircut`). */
  changedCounter: 'haircut_changed',
  /** Répliques de Solange à la fin d'une coupe (`textes.messages`), tirées « la moins récente ». */
  cutLines: ['solange_cut_1', 'solange_cut_2', 'solange_cut_3', 'solange_cut_4'],
} as const;

/** Portée du fauteuil et du banc d'attente (m). */
const SEAT_REACH = 1.5;
/** Rayon de la coupe remarquée (`needs.heart.hairNoticedRadius`, 4 m) et son Cœur (+10). */
const NOTICE_RADIUS = 4;
const NOTICE_HEART = 10;
/** Cœur de la première coupe, à la fin de la scène du miroir (`solange_first_cut`). */
export const FIRST_CUT_HEART = 10;

function near(sim: Sim, c: Character, pointId: string): boolean {
  const at = sim.map.points[pointId];
  return at !== undefined && c.inside === SALON.building && distance(c.pos, at) <= SEAT_REACH;
}

/** Solange tient son salon (dans la boutique, visible). */
function solangeHere(sim: Sim): boolean {
  const v = sim.world.villagers.find((x) => x.id === TOWN.solange);
  return v !== undefined && v.visible && v.inside === SALON.building;
}

/** Le salon coupe-t-il ? Heures, Solange là, et soit la quête de la première coupe, soit le salon ouvert. */
export function salonServing(sim: Sim): boolean {
  const b = sim.map.buildings[SALON.building];
  if (b === undefined || !buildingOpen(sim, b) || !solangeHere(sim)) return false;
  const { world } = sim;
  return world.flags.includes(TOWN.salonOpen) || world.quests.some((q) => q.id === TOWN.cutQuest && q.status === 'active');
}

/** Première coupe offerte: tant que la quête court et que ce joueur n'est pas encore passé au fauteuil. */
export function firstCutFree(sim: Sim, id: CharacterId): boolean {
  return firstCutFreeIn(sim.world, id);
}

export function nearChair(sim: Sim, c: Character): boolean {
  return near(sim, c, SALON.chair);
}

export function chairTaken(sim: Sim, c: Character): boolean {
  return atSalonChair(character(sim, partnerOf(c.id)));
}

/**
 * Le panneau du salon (menu `salon`): au fauteuil s'il est libre et qu'on est devant; sinon, l'autre
 * au fauteuil, depuis le banc d'attente, pour lui proposer une coupe.
 */
export function openSalon(sim: Sim, c: Character): boolean {
  if (near(sim, c, SALON.bench) && chairTaken(sim, c) && !nearChair(sim, c)) {
    c.menu = 'salon';
    if (c.status === 'active') c.status = 'menu';
    sim.runtime.changed = true;
    return true;
  }
  return sitAtChair(sim, c);
}

/** S'asseoir au fauteuil (menu `salon`); refus dit s'il est pris ou si le salon ne coupe pas. */
export function sitAtChair(sim: Sim, c: Character): boolean {
  if (!nearChair(sim, c) || c.seat !== null) return false;
  if (!salonServing(sim)) {
    sayIfWritten(sim, c.id, 'salon_not_serving');
    return false;
  }
  if (chairTaken(sim, c)) {
    sayIfWritten(sim, c.id, 'salon_chair_taken');
    return false;
  }
  c.menu = 'salon';
  c.hairOffer = null;
  if (c.status === 'active') c.status = 'menu';
  const at = sim.map.points[SALON.chair];
  c.action = { kind: 'sit', since: sim.world.tick, duration: 0, target: at === undefined ? null : { x: at.x, y: at.y } };
  emit(sim, { type: 'salon_seated', by: c.id });
  return true;
}

/** Prix d'un changement (coupe 15, couleur 10, les deux 20; la barbe compte comme une coupe). */
export function haircutPrice(sim: Sim, c: Character, hair: number, hairColor: number, beard: number): number {
  const s = sim.content.settings.town.salon;
  const a = c.appearance;
  const cut = hair !== a.hair || beard !== a.beard;
  const color = hairColor !== a.hairColor;
  if (firstCutFree(sim, c.id)) return 0;
  return cut && color ? s.bothPrice : cut ? s.cutPrice : color ? s.colorPrice : 0;
}

function inRange(value: number, count: number): boolean {
  return Number.isInteger(value) && value >= 0 && value < count;
}

/** Valider au fauteuil: paie, applique, se lève; « Garder ma coiffure » (rien de changé) est gratuit. */
export function haircut(sim: Sim, c: Character, hair: number, hairColor: number, beard: number): void {
  if (!atSalonChair(c)) return;
  const look = sim.content.settings.town.appearance;
  if (!inRange(hair, look.hairStyles) || !inRange(hairColor, look.hairColors) || !inRange(beard, look.beards)) return;
  const price = haircutPrice(sim, c, hair, hairColor, beard);
  if (price > sim.world.purse) {
    say(sim, c.id, 'not_enough_money', { missing: price - sim.world.purse });
    return;
  }
  const a = c.appearance;
  const changed = hair !== a.hair || hairColor !== a.hairColor || beard !== a.beard;
  sim.world.purse -= price;
  a.hair = hair;
  a.hairColor = hairColor;
  a.beard = beard;
  bump(sim, SALON.chairCounter, c.id);
  if (changed) {
    bump(sim, SALON.changedCounter, c.id);
    c.hairChangedDay = sim.world.clock.day;
    c.hairNoticedBy = null;
    villagerSays(sim, c.id, TOWN.solange, message(sim, nextCutLine(sim)));
  }
  emit(sim, { type: 'haircut', by: c.id, changed, price });
  leaveChair(sim, c);
}

/** La réplique de fin de coupe la moins récemment dite (tour à tour, sans tirage). */
function nextCutLine(sim: Sim): string {
  const n = sim.world.counters.duo[SALON.changedCounter] ?? 1;
  return SALON.cutLines[(n - 1) % SALON.cutLines.length] ?? SALON.cutLines[0];
}

export function leaveChair(sim: Sim, c: Character): void {
  if (!atSalonChair(c)) return;
  c.menu = null;
  c.hairOffer = null;
  if (c.status === 'menu') c.status = 'active';
  c.action = { kind: 'idle', since: sim.world.tick, duration: 0, target: null };
  sim.runtime.changed = true;
}

/** Depuis le banc d'attente, une coupe proposée à l'autre, au fauteuil: elle s'affiche chez lui seul. */
export function offerHaircut(sim: Sim, c: Character, hair: number, hairColor: number, beard: number): void {
  const other = character(sim, partnerOf(c.id));
  const look = sim.content.settings.town.appearance;
  if (!atSalonChair(other) || !near(sim, c, SALON.bench)) return;
  if (!inRange(hair, look.hairStyles) || !inRange(hairColor, look.hairColors) || !inRange(beard, look.beards)) return;
  const offer: HairOffer = { by: c.id, hair, hairColor, beard };
  other.hairOffer = offer;
  bump(sim, 'hair_offered', c.id);
  emit(sim, { type: 'hair_offer', by: c.id, to: other.id });
  sim.runtime.changed = true;
}

/** Réponse de qui est au fauteuil: « Essayer » garde la proposition dans l'aperçu, « Non merci » la retire. */
export function answerHairOffer(sim: Sim, c: Character, accept: boolean): void {
  if (!atSalonChair(c) || c.hairOffer === null) return;
  if (!accept) c.hairOffer = null;
  sim.runtime.changed = true;
}

/**
 * Coupe remarquée (section 2.3): la première fois que l'autre passe à moins de 4 m après un
 * changement, hors menus; une fois par changement, Cœur +10 aux deux.
 */
export function updateHairNoticed(sim: Sim): void {
  if (sim.world.phase !== 'day') return;
  for (const c of sim.world.characters) {
    if (c.hairChangedDay === null || c.hairNoticedBy !== null) continue;
    const other = character(sim, partnerOf(c.id));
    if (c.menu !== null || other.menu !== null || other.status !== 'active' || !other.created) continue;
    if (distance(c.pos, other.pos) > NOTICE_RADIUS) continue;
    c.hairNoticedBy = other.id;
    notifyKey(sim, other.id, 'message', 'hair_noticed', { name: c.name });
    gainHeart(sim, c, NOTICE_HEART);
    gainHeart(sim, other, NOTICE_HEART);
    emit(sim, { type: 'hair_noticed', by: other.id, of: c.id });
  }
}
