/**
 * La chèvre au piquet (0.12, conception section 4.3): elle broute sur le talus ou le pré, attachée à
 * un piquet par une corde de 2,5 m; on la mène d'une place à l'autre, on lui verse de l'eau, on la
 * brosse, on la trait de 6 h à 11 h (6 s seul, 3 s si l'autre lui tient la tête). Le soir elle rentre
 * seule à la chevrerie. Aucune place n'est à moins de 3,5 m de la voie: la corde la tient loin des
 * rails (CA-L5). Elle ne meurt, ne fuit ni ne se vend jamais; négligée, elle boude (pas de lait).
 */
import type { ControlFrame } from '../etat/actions';
import type { GoatSettings } from '../donnees/types';
import type { Character, CharacterId, Goat } from '../etat/types';
import { clampHappiness, railDistance, spotFresh } from '../etat/elevage';
import {
  type Sim,
  bump,
  character,
  distance,
  emit,
  newId,
  partnerOf,
  point,
  say,
} from './contexte';
import { gesture } from './potager';
import { POINT } from './ids';
import { addToBag, countInBag, giveToCharacter, takeFromBag } from './sac';
import { caredToday, markCared, requestName, setGoatSpawner } from './poules';
import { isBlockedCell } from './grille';
import { refreshBlockers } from './deplacement';

/** Drapeau posé par la quête de la chevrette (lot L-quêtes) quand sa caisse est posée à la chevrerie. */
export const GOAT_FLAG = 'goat_arrived';

/** Portée des gestes sur la chèvre (m): traire, brosser, tenir. */
export const GOAT_REACH = 1.4;
/** Portée pour planter le piquet sur une place (m). */
export const SPOT_REACH = 1.6;

export function goatSettings(sim: Pick<Sim, 'content'>): GoatSettings | null {
  return sim.content.settings.goats;
}

/** Une place libre (aucune autre chèvre n'y est attachée), la première dans l'ordre des réglages. */
function freeSpot(sim: Sim, s: GoatSettings, except: Goat | null): string {
  const taken = new Set(sim.world.breeding.goats.filter((g) => g !== except).map((g) => g.stake));
  return s.spots.find((id) => !taken.has(id)) ?? s.spots[0] ?? '';
}

/** La chevrette (quête) ou la deuxième chèvre (catalogue): à la porte de la chevrerie, à nommer. */
export function spawnGoat(sim: Sim): void {
  const s = goatSettings(sim);
  const b = sim.world.breeding;
  if (s === null || b.goats.length >= s.max) return;
  const at = point(sim, POINT.goatShed);
  const pos = { x: at.x, y: at.y };
  const goat: Goat = {
    id: newId(sim, 'g'),
    name: '',
    pos,
    prev: { ...pos },
    facing: 0,
    wander: { ...pos },
    happiness: s.happiness.start,
    stake: freeSpot(sim, s, null),
    led: null,
    home: false,
    milkedDay: null,
    wateredDay: null,
    milking: null,
  };
  b.goats.push(goat);
  requestName(sim, goat.id, 'goat', s.names);
  bump(sim, 'animal_released', null);
  say(sim, 'both', 'goat_arrived');
  emit(sim, { type: 'animal_arrived', animal: goat.id, kind: 'goat' });
}
setGoatSpawner(spawnGoat);

function inMilkingHours(sim: Sim, s: GoatSettings): boolean {
  const m = sim.world.clock.minutes;
  return m >= s.milkFrom && m < s.milkUntil;
}

export function goatLedBy(sim: Pick<Sim, 'world'>, id: CharacterId): Goat | null {
  return sim.world.breeding.goats.find((g) => g.led === id) ?? null;
}

/** Ce que ferait Espace sur cette chèvre, pour ce joueur. */
export function goatVerb(
  sim: Sim,
  c: Character,
  goat: Goat,
): 'milk' | 'goat_hold' | 'brush' | null {
  const s = goatSettings(sim);
  if (s === null || goat.led !== null) return null;
  const m = goat.milking;
  if (m !== null && m.by !== c.id)
    return m.holder === null || m.holder === c.id ? 'goat_hold' : null;
  if (inMilkingHours(sim, s) && goat.milkedDay !== sim.world.clock.day) return 'milk';
  return caredToday(sim, c.id, `brush:${goat.id}`) ? null : 'brush';
}

export function goatAct(
  sim: Sim,
  c: Character,
  goat: Goat,
  verb: 'milk' | 'goat_hold' | 'brush',
): void {
  const s = goatSettings(sim);
  if (s === null) return;
  if (verb === 'milk') {
    goat.milking ??= { by: c.id, progress: 0, holder: null };
    sim.runtime.changed = true;
    return;
  }
  if (verb === 'goat_hold') {
    if (goat.milking !== null && goat.milking.by !== c.id) goat.milking.holder = c.id;
    sim.runtime.changed = true;
    return;
  }
  if (caredToday(sim, c.id, `brush:${goat.id}`)) return;
  markCared(sim, c.id, `brush:${goat.id}`);
  goat.happiness = clampHappiness(goat.happiness + s.happiness.brush, s.happiness);
  gesture(sim, c, 'feed', 1.2, { x: goat.pos.x, y: goat.pos.y });
  bump(sim, 'goat_brushed', c.id);
  emit(sim, { type: 'goat_brushed', by: c.id, goat: goat.id });
}

/** Prendre la corde au piquet: la chèvre suit. */
export function leadGoat(sim: Sim, c: Character, goat: Goat): void {
  if (goat.led !== null || goat.home || goatLedBy(sim, c.id) !== null) return;
  goat.led = c.id;
  goat.milking = null;
  sim.runtime.changed = true;
  say(sim, c.id, 'goat_lead_hint');
  emit(sim, { type: 'goat_led', by: c.id, goat: goat.id });
}

/** La place de pâture visée par un joueur qui mène la chèvre (libre, à portée), ou `null`. */
export function spotNear(sim: Sim, c: Character): string | null {
  const s = goatSettings(sim);
  const goat = goatLedBy(sim, c.id);
  if (s === null || goat === null) return null;
  const taken = new Set(sim.world.breeding.goats.filter((g) => g !== goat).map((g) => g.stake));
  let best: string | null = null;
  let bestD = SPOT_REACH;
  for (const id of s.spots) {
    const at = sim.map.points[id];
    if (at === undefined || taken.has(id)) continue;
    const d = distance(c.pos, at);
    if (d <= bestD) {
      best = id;
      bestD = d;
    }
  }
  return best;
}

/** Planter le piquet: sur une place libre, sinon « trop près de la voie » ou « rien à brouter ici ». */
export function plantStake(sim: Sim, c: Character): void {
  const s = goatSettings(sim);
  const goat = goatLedBy(sim, c.id);
  if (s === null || goat === null) return;
  const spot = spotNear(sim, c);
  if (spot === null) {
    say(
      sim,
      c.id,
      railDistance(sim.map, c.pos) < s.railClearance ? 'goat_stake_rail' : 'goat_stake_nothing',
    );
    return;
  }
  goat.led = null;
  goat.stake = spot;
  const at = point(sim, spot);
  gesture(sim, c, 'hammer', 0.8, at);
  startGrazing(sim, s, goat, c.id);
  bump(sim, 'goat_staked', c.id);
  emit(sim, { type: 'goat_staked', by: c.id, goat: goat.id, spot });
}

/** Elle broute sa place: fraîche si personne n'y a brouté depuis `freshDays` jours. */
function startGrazing(sim: Sim, s: GoatSettings, goat: Goat, by: CharacterId | null = null): void {
  const b = sim.world.breeding;
  const day = sim.world.clock.day;
  // Contrat des quêtes (README des données, section 3.1): `goat_grazed_spot`, le piquet planté à une
  // place qui n'a pas été broutée la veille, une fois par jour au plus.
  const last = b.grazed[goat.stake];
  if (by !== null && last !== day - 1 && last !== day && !caredToday(sim, 'duo', 'grazed_spot')) {
    markCared(sim, 'duo', 'grazed_spot');
    bump(sim, 'goat_grazed_spot', by);
  }
  if (spotFresh(b.grazed, goat.stake, day, s.happiness.freshDays)) goat.freshToday = true;
  b.grazed[goat.stake] = day;
  sim.runtime.changed = true;
}

/** Un seau d'eau au puits ou au tonneau. */
export function fillPail(sim: Sim, c: Character, at: string): void {
  const s = goatSettings(sim);
  if (s === null || countInBag(c, s.pailItem) > 0) return;
  if (addToBag(sim, c, s.pailItem, 'ordinary', 1) > 0) {
    say(sim, c.id, 'bag_full');
    return;
  }
  gesture(sim, c, 'refill', 0.8, point(sim, at));
  emit(sim, { type: 'pail_filled', by: c.id });
}

/** Verser le seau dans le baquet de la chevrerie: compte à l'aube (+4). */
export function pourPail(sim: Sim, c: Character): void {
  const s = goatSettings(sim);
  if (s === null || countInBag(c, s.pailItem) === 0) return;
  takeFromBag(c, s.pailItem, 1);
  for (const g of sim.world.breeding.goats) g.wateredDay = sim.world.clock.day;
  gesture(sim, c, 'water', 0.8, point(sim, POINT.goatShed));
  bump(sim, 'goat_watered', c.id);
  emit(sim, { type: 'goat_watered', by: c.id });
}

/** Le seau sert: une chèvre attend de l'eau aujourd'hui. */
export function goatsThirsty(sim: Pick<Sim, 'world'>): boolean {
  return sim.world.breeding.goats.some((g) => g.wateredDay !== sim.world.clock.day);
}

// ---------------------------------------------------------------------------
// Chaque pas

/** La chevrette sort de sa caisse à la chevrerie quand la quête pose `goat_arrived` (une seule fois). */
export function updateGoatFlag(sim: Sim): void {
  if (sim.world.breeding.goats.length === 0 && sim.world.flags.includes(GOAT_FLAG)) spawnGoat(sim);
}

/** Traite, menée, pâture, retour du soir. */
export function updateGoats(
  sim: Sim,
  controls: Partial<Record<CharacterId, ControlFrame>>,
  dt: number,
): void {
  const s = goatSettings(sim);
  if (s === null || sim.world.breeding.goats.length === 0) return;
  const minutes = sim.world.clock.minutes;
  const shed = point(sim, POINT.goatShed);
  for (const goat of sim.world.breeding.goats) {
    if (minutes >= s.homeAt) {
      goat.led = null;
      goat.milking = null;
      if (!goat.home) {
        goat.wander.x = shed.x;
        goat.wander.y = shed.y;
        if (walk(goat, s.speed * 2, dt) < 0.15) {
          goat.home = true;
          sim.runtime.changed = true;
        }
      }
      continue;
    }
    if (goat.home && minutes >= s.outAt) {
      goat.home = false;
      startGrazing(sim, s, goat);
    }
    if (goat.milking !== null) {
      milkStep(sim, s, goat, controls, dt);
      continue;
    }
    if (goat.home) continue;
    if (goat.led !== null) {
      const leader = character(sim, goat.led);
      const d = distance(goat.pos, leader.pos);
      if (d > s.followDistance) {
        const k = (d - s.followDistance) / d;
        goat.wander.x = goat.pos.x + (leader.pos.x - goat.pos.x) * k;
        goat.wander.y = goat.pos.y + (leader.pos.y - goat.pos.y) * k;
      } else {
        goat.wander.x = goat.pos.x;
        goat.wander.y = goat.pos.y;
      }
      walk(goat, sim.content.settings.movement.walkSpeed * s.followSpeedFactor * 1.25, dt);
      continue;
    }
    graze(sim, s, goat, dt);
  }
}

/** Elle broute au bout de sa corde: une place au hasard dans le cercle, jamais sur une case bloquée. */
function graze(sim: Sim, s: GoatSettings, goat: Goat, dt: number): void {
  const stake = sim.map.points[goat.stake];
  if (stake === undefined) return;
  // Hors du cercle (arrivée, piquet replanté): elle revient d'abord vers le piquet.
  if (distance(goat.wander, stake) > s.ropeLength) {
    goat.wander.x = stake.x;
    goat.wander.y = stake.y;
  }
  if (distance(goat.pos, goat.wander) < 0.1 && sim.rng.chance(0.01)) {
    const angle = sim.rng.float(0, Math.PI * 2);
    const r = sim.rng.float(0.4, s.ropeLength - 0.3);
    const x = stake.x + Math.cos(angle) * r;
    const y = stake.y + Math.sin(angle) * r;
    if (!isBlockedCell(refreshBlockers(sim), Math.floor(x), Math.floor(y))) {
      goat.wander.x = x;
      goat.wander.y = y;
    }
  }
  walk(goat, s.speed, dt);
}

function walk(goat: Goat, speed: number, dt: number): number {
  const d = distance(goat.pos, goat.wander);
  if (d < 0.01) return d;
  const stepLen = Math.min(d, speed * dt);
  goat.pos.x += ((goat.wander.x - goat.pos.x) / d) * stepLen;
  goat.pos.y += ((goat.wander.y - goat.pos.y) / d) * stepLen;
  goat.facing = Math.atan2(goat.wander.y - goat.pos.y, goat.wander.x - goat.pos.x);
  return d - stepLen;
}

/** La traite avance tant que le trayeur maintient Espace près d'elle; deux fois plus vite tenue. */
function milkStep(
  sim: Sim,
  s: GoatSettings,
  goat: Goat,
  controls: Partial<Record<CharacterId, ControlFrame>>,
  dt: number,
): void {
  const m = goat.milking;
  if (m === null) return;
  const milker = character(sim, m.by);
  if (
    !inMilkingHours(sim, s) ||
    distance(milker.pos, goat.pos) > GOAT_REACH + 0.4 ||
    goat.milkedDay === sim.world.clock.day
  ) {
    goat.milking = null;
    sim.runtime.changed = true;
    return;
  }
  if (m.holder !== null) {
    const holder = character(sim, m.holder);
    const holding =
      controls[m.holder]?.actHeld === true && distance(holder.pos, goat.pos) <= GOAT_REACH + 0.4;
    if (!holding) {
      m.holder = null;
      sim.runtime.changed = true;
    }
  }
  if (controls[m.by]?.actHeld !== true) return;
  const seconds = m.holder !== null ? s.heldMilkSeconds : s.milkSeconds;
  m.progress = Math.min(1, m.progress + dt / seconds);
  if (m.progress < 1) return;
  const together = m.holder !== null;
  goat.milking = null;
  goat.milkedDay = sim.world.clock.day;
  if (together)
    goat.happiness = clampHappiness(goat.happiness + s.happiness.heldMilking, s.happiness);
  const h = s.happiness;
  const count = goat.happiness < h.milkNoneBelow ? 0 : goat.happiness >= h.milkTwoFrom ? 2 : 1;
  if (count > 0) giveToCharacter(sim, milker, s.milkItem, 'ordinary', count);
  bump(sim, 'goat_milked', milker.id);
  // Contrat des quêtes (README des données, section 3.1): `milked`, chaque traite.
  bump(sim, 'milked', milker.id);
  if (together) bump(sim, 'goat_milked_together', null);
  say(
    sim,
    together ? 'both' : milker.id,
    count === 0 ? 'goat_milk_none' : count === 1 ? 'goat_milk_one' : 'goat_milk_two',
    { name: goat.name, count },
  );
  emit(sim, { type: 'goat_milked', by: milker.id, goat: goat.id, count, together });
  sim.runtime.changed = true;
}

/** L'aube: dérive, pâture fraîche et eau de la veille; elle attend à la porte jusqu'à 7 h. */
export function morningGoats(sim: Sim): void {
  const s = goatSettings(sim);
  if (s === null) return;
  const yesterday = sim.world.clock.day - 1;
  const shed = point(sim, POINT.goatShed);
  const h = s.happiness;
  for (const goat of sim.world.breeding.goats) {
    const gain =
      h.drift +
      (goat.freshToday === true ? h.freshGraze : 0) +
      (goat.wateredDay === yesterday ? h.water : 0);
    goat.happiness = clampHappiness(goat.happiness + gain, h);
    delete goat.freshToday;
    goat.home = true;
    goat.led = null;
    goat.milking = null;
    goat.pos = { x: shed.x, y: shed.y };
    goat.prev = { x: shed.x, y: shed.y };
    goat.wander = { x: shed.x, y: shed.y };
  }
}

/** Celui qui traite peut voir l'autre arriver: utile à l'interface (« Tenir la chèvre »). */
export function milkingPartner(goat: Goat): CharacterId | null {
  return goat.milking === null ? null : partnerOf(goat.milking.by);
}
