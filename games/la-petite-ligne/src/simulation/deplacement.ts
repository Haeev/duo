/**
 * Déplacements des personnages: clavier (direction), clic au sol (trajet A*),
 * portage de la poutre à deux (GE-02), retour forcé et rassemblements.
 */
import type { ControlFrame } from '../etat/actions';
import { buildingAt } from '../etat/carte';
import { isHome } from '../etat/interieurs';
import type { Beam, Character, CharacterId, Vec2, VillagerState } from '../etat/types';
import { ARRIVE_DISTANCE, BODY_RADIUS, MOVE_DEADZONE } from './constantes';
import { type Sim, character, distance, emit, partnerName, point, say } from './contexte';
import { abortConversation } from './dialogues';
import { type Blockers, OPENED_CELL, bodyCollides, findPath, isBlockedCell, moveBody, nearestFreeCell } from './grille';
import { builtRoomCells } from './pieces';
import { ZONE } from './ids';
import { treeBlocks } from './lisiere';
import { armedCells } from '../etat/moments';
import { walkFactor } from './besoins';
import { ALL_DOORS, blockersAt, closedMask, isDoorCell, markClosedDoors, refuseDoorCarry, trackInside, withDoor } from './interieurs';

/** Couche dynamique des collisions: arbres debout et meubles (hors tapis). */
export function refreshBlockers(sim: Sim): Blockers {
  const rt = sim.runtime;
  // Une porte ouvre ou ferme quand l'heure franchit un bord de ses heures (ADR 0016).
  const closed = closedMask(sim);
  if (closed !== rt.closedDoors) {
    rt.closedDoors = closed;
    rt.dynamicDirty = true;
  }
  if (rt.dynamicDirty) {
    const { map } = sim;
    rt.dynamicBlocked.fill(0);
    for (const t of sim.world.trees) {
      // Le rejet garde la case de l'arbre; la souche se traverse (tour 8, section 5.1).
      if (treeBlocks(sim, t)) rt.dynamicBlocked[Math.floor(t.pos.y) * map.width + Math.floor(t.pos.x)] = 1;
    }
    const platform = map.zones[ZONE.trainAtPlatform];
    if (platform !== undefined && sim.world.train.phase !== 'away') {
      for (let cy = platform.y; cy < platform.y + platform.h; cy++) {
        for (let cx = platform.x; cx < platform.x + platform.w; cx++) rt.dynamicBlocked[cy * map.width + cx] = 1;
      }
    }
    for (const cell of handcarCells(sim)) rt.dynamicBlocked[cell.cy * map.width + cell.cx] = 1;
    // Tour 9: les chantiers bâtis occupent leurs cases; les barrières baissées ferment la traversée.
    for (const x of sim.content.improvements) {
      if ((sim.world.improvements[x.id]?.builtDay ?? null) === null) continue;
      for (const cell of x.cells) if (cell.cx >= 0 && cell.cy >= 0 && cell.cx < map.width && cell.cy < map.height) rt.dynamicBlocked[cell.cy * map.width + cell.cx] = 1;
    }
    const gates = armedCells(sim.content, sim.world.moments.today);
    if (gates !== null) {
      for (let cy = gates.y; cy < gates.y + gates.h; cy++) for (let cx = gates.x; cx < gates.x + gates.w; cx++) rt.dynamicBlocked[cy * map.width + cx] = 1;
    }
    for (const f of sim.world.furniture) {
      const def = sim.content.items[f.item];
      // Tapis, lits et objets muraux (rideaux, cadres: R02) ne barrent pas le passage.
      if (def?.footprint === null || def === undefined || def.floor || def.wall || def.bed !== null) continue;
      for (const cell of footprintCells(def.footprint, f.cell, f.rotation)) {
        if (cell.cx >= 0 && cell.cy >= 0 && cell.cx < map.width && cell.cy < map.height) {
          rt.dynamicBlocked[cell.cy * map.width + cell.cx] = 1;
        }
      }
    }
    // Tour 10 (lot L4): les murs d'une pièce bâtie bloquent, sa porte percée s'ouvre dans l'ancienne fenêtre.
    const built = builtRoomCells(sim);
    for (const cell of built.walls) {
      if (cell.cx >= 0 && cell.cy >= 0 && cell.cx < map.width && cell.cy < map.height) rt.dynamicBlocked[cell.cy * map.width + cell.cx] = 1;
    }
    for (const cell of built.doors) {
      if (cell.cx >= 0 && cell.cy >= 0 && cell.cx < map.width && cell.cy < map.height) rt.dynamicBlocked[cell.cy * map.width + cell.cx] = OPENED_CELL;
    }
    markClosedDoors(sim, rt.dynamicBlocked, closed);
    rt.dynamicDirty = false;
  }
  return { map: sim.map, dynamic: rt.dynamicBlocked };
}

/** Collisions pour un corps à ce point: dedans, la porte de son bâtiment reste passable (sortie toujours permise). */
export function blockersFor(sim: Sim, pos: Vec2): Blockers {
  return blockersAt(sim, refreshBlockers(sim), pos);
}

/** Collisions des habitants: ils ont leurs clés, toutes les portes s'ouvrent devant eux. */
export function villagerBlockers(sim: Sim): Blockers {
  return withDoor(sim, refreshBlockers(sim), ALL_DOORS);
}

/**
 * Cases sous la draisine posée sur la voie (`world.handcarAt`): elle bloque le
 * passage comme un meuble. Emprise de `reglages.carry.handcar.size`, tournée
 * selon son axe (quarts de tour: elle est toujours dans l'axe d'une voie).
 */
export function handcarCells(sim: Sim): { cx: number; cy: number }[] {
  const at = sim.world.handcarAt;
  const size = sim.content.settings.carry.handcar?.size;
  if (at === null || size === undefined) return [];
  const [length, width] = size;
  const alongX = Math.abs(Math.cos(at.facing)) >= Math.abs(Math.sin(at.facing));
  const halfX = (alongX ? length : width) / 2;
  const halfY = (alongX ? width : length) / 2;
  const out: { cx: number; cy: number }[] = [];
  const { map } = sim;
  // Un rien de marge: une emprise qui finit pile sur un bord de case ne prend pas la case voisine.
  const edge = 1e-6;
  for (let cy = Math.floor(at.pos.y - halfY + edge); cy <= Math.floor(at.pos.y + halfY - edge); cy++) {
    for (let cx = Math.floor(at.pos.x - halfX + edge); cx <= Math.floor(at.pos.x + halfX - edge); cx++) {
      if (cx >= 0 && cy >= 0 && cx < map.width && cy < map.height) out.push({ cx, cy });
    }
  }
  return out;
}

/** Le corps (disque de `BODY_RADIUS`) touche-t-il cette case ? */
export function touchesCell(pos: Vec2, cell: { cx: number; cy: number }): boolean {
  const nx = Math.max(cell.cx, Math.min(pos.x, cell.cx + 1));
  const ny = Math.max(cell.cy, Math.min(pos.y, cell.cy + 1));
  return (pos.x - nx) ** 2 + (pos.y - ny) ** 2 < BODY_RADIUS * BODY_RADIUS;
}

/**
 * La draisine vient d'être posée: qui se trouve sous elle (les porteurs,
 * souvent) glisse à la case libre la plus proche, sinon il y resterait pris.
 */
export function clearHandcarSpot(sim: Sim): void {
  sim.runtime.dynamicDirty = true;
  const b = refreshBlockers(sim);
  const cells = handcarCells(sim);
  const bodies: { pos: Vec2 }[] = [...sim.world.characters, ...sim.world.villagers];
  for (const body of bodies) {
    // Seulement qui touche la draisine: un habitant assis sur un banc reste où il est.
    if (!cells.some((cell) => touchesCell(body.pos, cell))) continue;
    const free = nearestFreeCell(b, body.pos);
    if (free === null) continue;
    body.pos.x = free.x;
    body.pos.y = free.y;
  }
  for (const c of sim.world.characters) {
    if (c.destination !== null) stopPath(sim, c);
  }
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
  const b = blockersFor(sim, c.pos);
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
  const speed = sim.content.settings.movement.walkSpeed * walkFactor(sim, c);
  c.speed = 0;
  if (!canWalk(sim, c)) return false;
  const b = blockersFor(sim, c.pos);
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

/** Après les déplacements: le bâtiment visitable où l'on est (ADR 0016), la porte qui s'entend. */
export function updateInside(sim: Sim, c: Character): void {
  trackInside(sim, c);
  if (c.speed === 0 && c.action.kind === 'walk') c.action = { kind: 'idle', since: sim.world.tick, duration: 0, target: null };
}

/** Le bâtiment visitable où se trouve un habitant (ADR 0016), `null` hors de la carte jouée. */
export function updateVillagerInside(sim: Sim, v: VillagerState): void {
  v.inside = v.visible ? buildingAt(sim.map, sim.world.rooms, v.pos.x, v.pos.y) : null;
}

/** Place un personnage (téléportation derrière un fondu). */
export function placeCharacter(sim: Sim, c: Character, at: Vec2): void {
  c.pos.x = at.x;
  c.pos.y = at.y;
  c.prev.x = at.x;
  c.prev.y = at.y;
  c.speed = 0;
  stopPath(sim, c);
  c.inside = buildingAt(sim.map, sim.world.rooms, at.x, at.y);
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
    if (isHome(c)) continue;
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
      sim.runtime.doorCarryNotified = false;
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
  // On ne passe pas une porte en portant à deux (tour 10, section 1.6): ni dedans, ni dehors.
  const door = { hit: false };
  const fits = (x: number, y: number): boolean =>
    holders.every((c) => {
      const off = sim.runtime.beamOffsets[c.id];
      if (isDoorCell(sim.map, x + off.x, y + off.y)) {
        door.hit = true;
        return false;
      }
      return !bodyCollides(blockers, x + off.x, y + off.y);
    });
  if (beam.route !== null) {
    railStep(beam, vx * dt, vy * dt, fits);
    vx = (beam.pos.x - beam.prev.x) / dt;
    vy = (beam.pos.y - beam.prev.y) / dt;
  } else if (vx !== 0 || vy !== 0) {
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
  if (door.hit) refuseDoorCarry(sim, beam.holders);
  // La draisine roule: elle regarde dans le sens de la marche (axe de la voie), le rendu la pose sur les rails.
  if (beam.purpose === 'handcar' && (vx !== 0 || vy !== 0)) beam.facing = Math.atan2(vy, vx);
  for (const c of holders) {
    const off = sim.runtime.beamOffsets[c.id];
    c.pos.x = beam.pos.x + off.x;
    c.pos.y = beam.pos.y + off.y;
    c.speed = Math.hypot(vx, vy);
    if (c.speed > 0) c.facing = Math.atan2(vy, vx);
  }
  const arrived = beam.route !== null ? beam.leg >= beam.route.length : distance(beam.pos, beam.to) <= s.feel.beamDropRadius;
  if (arrived) {
    sim.world.beam = null;
    sim.runtime.doorCarryNotified = false;
    for (const c of holders) {
      c.status = 'active';
      c.action = { kind: 'idle', since: sim.world.tick, duration: 0, target: null };
    }
    emit(sim, { type: 'beam_placed' });
    return beam;
  }
  return null;
}

/**
 * Charge sur rails (la draisine): l'élan des porteurs est projeté sur le segment en cours; elle
 * avance (ou recule) le long de la voie, passe au segment suivant au bout de celui-ci, et regarde
 * dans l'axe de la voie. `leg` vaut la longueur du trajet une fois au bout.
 */
function railStep(beam: Beam, dx: number, dy: number, fits: (x: number, y: number) => boolean): void {
  const route = beam.route;
  if (route === null) return;
  let budget = Math.hypot(dx, dy);
  while (budget > 1e-9 && beam.leg < route.length) {
    const target = route[beam.leg];
    if (target === undefined) return;
    const sx = target.x - beam.pos.x;
    const sy = target.y - beam.pos.y;
    const left = Math.hypot(sx, sy);
    if (left < 1e-6) {
      beam.leg += 1;
      continue;
    }
    const ux = sx / left;
    const uy = sy / left;
    beam.facing = Math.atan2(uy, ux);
    // Seul l'élan dans l'axe de la voie compte; pousser à rebours ne la fait pas reculer.
    const along = ((dx * ux + dy * uy) / Math.max(1e-9, Math.hypot(dx, dy))) * budget;
    if (along <= 0) return;
    const step = Math.min(along, left);
    const nx = beam.pos.x + ux * step;
    const ny = beam.pos.y + uy * step;
    if (!fits(nx, ny)) return;
    beam.pos.x = nx;
    beam.pos.y = ny;
    budget -= step;
    if (step >= left - 1e-9) beam.leg += 1;
    else return;
  }
}

export function characterById(sim: Sim, id: CharacterId): Character {
  return character(sim, id);
}
