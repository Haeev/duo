/**
 * Déplacements des personnages: clavier (direction), clic au sol (trajet A*),
 * portage de la poutre à deux (GE-02), retour forcé et rassemblements.
 */
import type { ControlFrame } from '../etat/actions';
import { inRect } from '../etat/carte';
import type { Beam, Character, CharacterId, Vec2 } from '../etat/types';
import { ARRIVE_DISTANCE, MOVE_DEADZONE } from './constantes';
import { type Sim, character, distance, emit, partnerName, point, say } from './contexte';
import { abortConversation } from './dialogues';
import { type Blockers, bodyCollides, findPath, isBlockedCell, moveBody } from './grille';
import { ZONE } from './ids';

/** Couche dynamique des collisions: arbres debout et meubles (hors tapis). */
export function refreshBlockers(sim: Sim): Blockers {
  const rt = sim.runtime;
  if (rt.dynamicDirty) {
    const { map } = sim;
    rt.dynamicBlocked.fill(0);
    for (const t of sim.world.trees) {
      if (!t.felled) rt.dynamicBlocked[Math.floor(t.pos.y) * map.width + Math.floor(t.pos.x)] = 1;
    }
    const platform = map.zones[ZONE.trainAtPlatform];
    if (platform !== undefined && sim.world.train.phase !== 'away') {
      for (let cy = platform.y; cy < platform.y + platform.h; cy++) {
        for (let cx = platform.x; cx < platform.x + platform.w; cx++) rt.dynamicBlocked[cy * map.width + cx] = 1;
      }
    }
    for (const f of sim.world.furniture) {
      const def = sim.content.items[f.item];
      if (def?.footprint === null || def === undefined || def.floor || def.bed !== null) continue;
      for (const cell of footprintCells(def.footprint, f.cell, f.rotation)) {
        if (cell.cx >= 0 && cell.cy >= 0 && cell.cx < map.width && cell.cy < map.height) {
          rt.dynamicBlocked[cell.cy * map.width + cell.cx] = 1;
        }
      }
    }
    rt.dynamicDirty = false;
  }
  return { map: sim.map, dynamic: rt.dynamicBlocked };
}

/** Dimensions d'une empreinte une fois tournée (quarts de tour). */
export function rotatedSize(footprint: { w: number; d: number }, rotation: number): { w: number; d: number } {
  return rotation % 2 === 0 ? { w: footprint.w, d: footprint.d } : { w: footprint.d, d: footprint.w };
}

export function footprintCells(footprint: { w: number; d: number }, nw: { cx: number; cy: number }, rotation: number): { cx: number; cy: number }[] {
  const size = rotatedSize(footprint, rotation);
  const out: { cx: number; cy: number }[] = [];
  for (let y = 0; y < size.d; y++) {
    for (let x = 0; x < size.w; x++) out.push({ cx: nw.cx + x, cy: nw.cy + y });
  }
  return out;
}

/**
 * Un pas de marche au clavier, sans dépendance à `Sim`: le même code sert à
 * l'hôte et à la prédiction de l'invité. Renvoie l'orientation, ou `null` à l'arrêt.
 */
export function walkStep(b: Blockers, pos: Vec2, moveX: number, moveY: number, speed: number, dt: number): number | null {
  let mx = moveX;
  let my = moveY;
  const len = Math.hypot(mx, my);
  if (len < MOVE_DEADZONE) return null;
  if (len > 1) {
    mx /= len;
    my /= len;
  }
  moveBody(b, pos, mx * speed * dt, my * speed * dt);
  return Math.atan2(my, mx);
}

/** Le personnage peut-il bouger de lui-même à ce pas ? */
export function canWalk(sim: Sim, c: Character): boolean {
  if (!c.created || c.crafting !== null) return false;
  if (c.status !== 'active' && c.status !== 'menu') return false;
  if (c.action.duration > 0 && sim.world.tick < c.action.since + c.action.duration) return false;
  return true;
}

/** Ordonne d'aller vers un point (clic au sol). */
export function goTo(sim: Sim, c: Character, target: Vec2): boolean {
  const b = refreshBlockers(sim);
  const path = findPath(b, c.pos, target);
  if (path === null) return false;
  sim.runtime.charPaths[c.id] = path;
  const last = path[path.length - 1];
  c.destination = last === undefined ? null : { x: last.x, y: last.y };
  return true;
}

export function stopPath(sim: Sim, c: Character): void {
  sim.runtime.charPaths[c.id] = [];
  sim.runtime.pendingAct[c.id] = null;
  c.destination = null;
}

/** Déplace un personnage selon son entrée du pas; renvoie vrai s'il est arrivé au bout d'un trajet. */
export function moveCharacter(sim: Sim, c: Character, frame: ControlFrame | undefined, dt: number): boolean {
  const speed = sim.content.settings.movement.walkSpeed;
  c.speed = 0;
  if (!canWalk(sim, c)) return false;
  const b = refreshBlockers(sim);
  const before = { x: c.pos.x, y: c.pos.y };
  if (frame !== undefined && Math.hypot(frame.moveX, frame.moveY) >= MOVE_DEADZONE) {
    if (c.destination !== null) stopPath(sim, c);
    const facing = walkStep(b, c.pos, frame.moveX, frame.moveY, speed, dt);
    if (facing !== null) c.facing = facing;
  } else {
    const path = sim.runtime.charPaths[c.id];
    const next = path[0];
    if (next === undefined) return false;
    const dx = next.x - c.pos.x;
    const dy = next.y - c.pos.y;
    const d = Math.hypot(dx, dy);
    const stepLen = speed * dt;
    if (d <= Math.max(ARRIVE_DISTANCE, stepLen)) {
      if (!bodyCollides(b, next.x, next.y)) {
        c.pos.x = next.x;
        c.pos.y = next.y;
      }
      path.shift();
    } else {
      moveBody(b, c.pos, (dx / d) * stepLen, (dy / d) * stepLen);
      c.facing = Math.atan2(dy, dx);
    }
    if (path.length === 0) {
      c.destination = null;
      c.speed = distance(before, c.pos) / dt;
      return true;
    }
    if (distance(before, c.pos) < stepLen * 0.05) {
      // Bloqué (meuble posé entre-temps): on abandonne le trajet.
      stopPath(sim, c);
      return false;
    }
  }
  c.speed = distance(before, c.pos) / dt;
  if (c.speed > 0) c.action = c.action.kind === 'walk' ? c.action : { kind: 'walk', since: sim.world.tick, duration: 0, target: null };
  return false;
}

/** Après les déplacements: dans la maison ou non, la porte qui grince. */
export function updateInside(sim: Sim, c: Character): void {
  const inside = inRect(sim.map.house.room, c.pos.x, c.pos.y);
  if (inside !== c.inHouse) {
    c.inHouse = inside;
    const doorBuilt = sim.world.constructions.some((k) => k.id === 'house_door' && k.status === 'done');
    if (doorBuilt) emit(sim, { type: 'door', by: c.id, entering: inside });
  }
  if (c.speed === 0 && c.action.kind === 'walk') c.action = { kind: 'idle', since: sim.world.tick, duration: 0, target: null };
}

/** Place un personnage (téléportation derrière un fondu). */
export function placeCharacter(sim: Sim, c: Character, at: Vec2): void {
  c.pos.x = at.x;
  c.pos.y = at.y;
  c.prev.x = at.x;
  c.prev.y = at.y;
  c.speed = 0;
  stopPath(sim, c);
  c.inHouse = inRect(sim.map.house.room, at.x, at.y);
}

function release(sim: Sim, c: Character): void {
  if (c.dialogue !== null) abortConversation(sim, c.id);
  c.menu = null;
  c.placement = null;
  c.crafting = null;
  c.bedId = null;
  if (c.status !== 'scene') c.status = 'active';
  c.action = { kind: 'idle', since: sim.world.tick, duration: 0, target: null };
}

/** Effet `gather_players`: les deux au point, côte à côte. */
export function gatherAt(sim: Sim, pointId: string): void {
  const at = point(sim, pointId);
  const offsets: Record<CharacterId, number> = { p1: -0.7, p2: 0.7 };
  for (const c of sim.world.characters) {
    release(sim, c);
    placeCharacter(sim, c, { x: at.x + offsets[c.id], y: at.y + 1 });
    c.facing = -Math.PI / 2;
  }
  if (sim.world.beam?.carried === true) sim.world.beam.carried = false;
}

/**
 * Le point de retour de la maison, ou la case libre la plus proche si un
 * meuble y est posé (sinon le personnage resterait pris dans le meuble).
 */
export function houseSpawn(sim: Sim): Vec2 {
  const at = sim.map.house.spawn;
  const b = refreshBlockers(sim);
  const cx = Math.floor(at.x);
  const cy = Math.floor(at.y);
  if (!isBlockedCell(b, cx, cy)) return at;
  const room = sim.map.house.room;
  for (let r = 1; r <= Math.max(room.w, room.h); r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const x = cx + dx;
        const y = cy + dy;
        if (x < room.x || y < room.y || x >= room.x + room.w || y >= room.y + room.h || isBlockedCell(b, x, y)) continue;
        return { x: x + 0.5, y: y + 0.5 };
      }
    }
  }
  return at;
}

/** Minuit (TE-08): qui est dehors rentre par le sentier. */
export function midnightReturn(sim: Sim): void {
  for (const c of sim.world.characters) {
    if (c.inHouse) continue;
    release(sim, c);
    placeCharacter(sim, c, houseSpawn(sim));
    c.midnightReturn = true;
    say(sim, c.id, 'midnight_return');
  }
}

// ---------------------------------------------------------------------------
// La poutre, portée à deux (GE-01, GE-02)

/** Vecteur d'entrée (borné à 1). */
function inputOf(frame: ControlFrame | undefined): Vec2 {
  if (frame === undefined) return { x: 0, y: 0 };
  const len = Math.hypot(frame.moveX, frame.moveY);
  if (len < MOVE_DEADZONE) return { x: 0, y: 0 };
  return len > 1 ? { x: frame.moveX / len, y: frame.moveY / len } : { x: frame.moveX, y: frame.moveY };
}

/**
 * Met à jour la charge portée à deux (poutre, draisine, colis). Renvoie la charge si elle vient
 * d'être posée à son emplacement, sinon `null`.
 * Les porteurs ne marchent pas d'eux-mêmes pendant le portage.
 */
export function updateBeam(sim: Sim, frames: Partial<Record<CharacterId, ControlFrame>>, dt: number): Beam | null {
  const beam = sim.world.beam;
  if (beam === null) return null;
  const s = sim.content.settings;
  const grab = s.feel.beamGrabRange;
  const holders = sim.world.characters.filter(
    (c) =>
      frames[c.id]?.actHeld === true &&
      (c.status === 'active' || c.status === 'gesture') &&
      distance(c.pos, beam.pos) <= (beam.carried ? grab * 2 : grab),
  );
  beam.holders = holders.map((c) => c.id);
  if (holders.length === 1 && !beam.carried) {
    const only = holders[0];
    if (only !== undefined && !sim.runtime.holdNotified[only.id]) {
      sim.runtime.holdNotified[only.id] = true;
      const key = beam.purpose === 'handcar' ? 'handcar_needs_both' : beam.purpose === 'parcel' ? 'parcel_needs_both' : 'needs_both';
      const written = Object.hasOwn(sim.content.texts.messages, key) ? key : 'needs_both';
      say(sim, only.id, written, { partner: partnerName(sim, only.id) });
    }
  }
  if (holders.length < 2) {
    if (beam.carried) {
      beam.carried = false;
      for (const c of sim.world.characters) {
        if (c.status === 'gesture') {
          c.status = 'active';
          c.action = { kind: 'idle', since: sim.world.tick, duration: 0, target: null };
        }
      }
      emit(sim, { type: 'beam_dropped' });
    }
    return null;
  }
  const [a, b] = holders as [Character, Character];
  if (!beam.carried) {
    beam.carried = true;
    for (const c of holders) {
      sim.runtime.beamOffsets[c.id] = { x: c.pos.x - beam.pos.x, y: c.pos.y - beam.pos.y };
      c.status = 'gesture';
      c.action = { kind: 'carry', since: sim.world.tick, duration: 0, target: null };
      stopPath(sim, c);
      c.menu = null;
    }
    beam.facing = Math.atan2(b.pos.y - a.pos.y, b.pos.x - a.pos.x);
    emit(sim, { type: 'beam_lifted' });
  }
  const ia = inputOf(frames[a.id]);
  const ib = inputOf(frames[b.id]);
  const aMoves = ia.x !== 0 || ia.y !== 0;
  const bMoves = ib.x !== 0 || ib.y !== 0;
  let vx = 0;
  let vy = 0;
  if (aMoves && bMoves) {
    vx = ((ia.x + ib.x) / 2) * s.movement.carrySpeedTogether;
    vy = ((ia.y + ib.y) / 2) * s.movement.carrySpeedTogether;
  } else if (aMoves || bMoves) {
    const i = aMoves ? ia : ib;
    vx = i.x * s.movement.carrySpeedOneMoving;
    vy = i.y * s.movement.carrySpeedOneMoving;
  }
  const blockers = refreshBlockers(sim);
  const fits = (x: number, y: number): boolean =>
    holders.every((c) => {
      const off = sim.runtime.beamOffsets[c.id];
      return !bodyCollides(blockers, x + off.x, y + off.y);
    });
  if (vx !== 0 || vy !== 0) {
    const nx = beam.pos.x + vx * dt;
    const ny = beam.pos.y + vy * dt;
    // Tout le pas, sinon un axe puis l'autre: la charge glisse le long des murs (gauntlet, tour 4).
    if (fits(nx, ny)) {
      beam.pos.x = nx;
      beam.pos.y = ny;
    } else if (vx !== 0 && fits(nx, beam.pos.y)) {
      beam.pos.x = nx;
    } else if (vy !== 0 && fits(beam.pos.x, ny)) {
      beam.pos.y = ny;
    }
  }
  for (const c of holders) {
    const off = sim.runtime.beamOffsets[c.id];
    c.pos.x = beam.pos.x + off.x;
    c.pos.y = beam.pos.y + off.y;
    c.speed = Math.hypot(vx, vy);
    if (c.speed > 0) c.facing = Math.atan2(vy, vx);
  }
  if (distance(beam.pos, beam.to) <= s.feel.beamDropRadius) {
    sim.world.beam = null;
    for (const c of holders) {
      c.status = 'active';
      c.action = { kind: 'idle', since: sim.world.tick, duration: 0, target: null };
    }
    emit(sim, { type: 'beam_placed' });
    return beam;
  }
  return null;
}

export function characterById(sim: Sim, id: CharacterId): Character {
  return character(sim, id);
}
