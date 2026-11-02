/**
 * Robot « la maison d'abord » (tour 10, section 4.4 et T10-23): par-dessus le robot du jeu, le duo
 * commande le cellier puis la chambre dès que la bourse le permet, scie les planches qui manquent,
 * achète les clous chez Odette, les dépose à la caisse du chantier et bâtit à deux. La panne
 * faîtière se porte avec le geste du robot du jeu (il prend toute charge posée par terre).
 */
import type { AuthoredIntent, ControlFrame, Intent } from '../../src/etat/actions';
import type { Character, CharacterId, Vec2 } from '../../src/etat/types';
import { mapRoomOfBuild } from '../../src/etat/maison';
import { type Sim, character, distance } from '../../src/simulation/contexte';
import { findPath } from '../../src/simulation/grille';
import { refreshBlockers } from '../../src/simulation/deplacement';
import { POINT } from '../../src/simulation/ids';
import { orderProblem, roomBuilt, roomInProgress, roomStillNeeded, siteReady } from '../../src/simulation/pieces';
import { countInBag } from '../../src/simulation/sac';
import type { Robot } from '../../src/simulation/robot';
import { TOOLBAR_SLOTS as TOOLBAR } from '../../src/simulation/constantes';

const HOUR = 60;
/** Sous gardés après une commande de pièce (graines, clous, imprévus). */
const RESERVE = 150;
/** Heures où le duo travaille à la maison (le reste de la journée suit le robot du jeu). */
const FROM = 7 * HOUR;
const UNTIL = 18 * HOUR;
const ORDER: readonly string[] = ['room_cellar', 'room_bedroom'];

interface Mem {
  seq: number;
  going: string | null;
  wait: number;
}

export interface HouseLog {
  ordered: Record<string, number>;
  built: Record<string, number>;
}

export function houseFirst(base: Robot): Robot & { log: HouseLog } {
  const mem: Record<CharacterId, Mem> = { p1: { seq: 0, going: null, wait: 0 }, p2: { seq: 0, going: null, wait: 0 } };
  const log: HouseLog = { ordered: {}, built: {} };

  function frame(m: Mem, held = false): ControlFrame {
    m.seq += 1;
    return { seq: 100_000 + m.seq, moveX: 0, moveY: 0, actHeld: held };
  }

  function go(sim: Sim, c: Character, m: Mem, key: string, at: Vec2, reach: number, out: Intent[]): boolean {
    if (distance(c.pos, at) <= reach) {
      m.going = null;
      return false;
    }
    if (m.going === key && c.destination !== null) return true;
    if (findPath(refreshBlockers(sim), c.pos, at) === null) return false;
    out.push({ type: 'move_to', target: { kind: 'ground', x: at.x, y: at.y }, act: false });
    m.going = key;
    return true;
  }

  /** Abattre l'arbre debout le plus proche, hache en main. */
  function chop(sim: Sim, c: Character, m: Mem, out: Intent[]): ControlFrame | null {
    const slot = c.bag.findIndex((s) => s !== null && sim.content.items[s.item]?.tool?.toolKind === 'axe');
    if (slot < 0 || slot >= TOOLBAR) return null;
    const tree = sim.world.trees.filter((t) => !t.felled).sort((a, b) => distance(c.pos, a.pos) - distance(c.pos, b.pos))[0];
    if (tree === undefined) return null;
    if (c.selected !== slot) out.push({ type: 'select_slot', slot });
    if (distance(c.pos, tree.pos) > 1.4) {
      if (m.going === `arbre:${tree.id}` && c.destination !== null) return frame(m);
      out.push({ type: 'move_to', target: { kind: 'tree', tree: tree.id }, act: true });
      m.going = `arbre:${tree.id}`;
      return frame(m);
    }
    if (c.action.kind === 'idle' || c.action.kind === 'walk') out.push({ type: 'move_to', target: { kind: 'tree', tree: tree.id }, act: true });
    m.wait = sim.world.tick + 10;
    return frame(m);
  }

  function nextRoom(sim: Sim): string | null {
    return ORDER.find((id) => !roomBuilt(sim, id)) ?? null;
  }

  /** Une tâche de la maison pour ce personnage: ses intentions et son geste, ou `null` (le robot du jeu décide). */
  function task(sim: Sim, c: Character, out: Intent[]): ControlFrame | null {
    const w = sim.world;
    const m = mem[c.id];
    const shopping = c.status === 'menu' && c.menu === 'shop';
    if (w.phase !== 'day' || (c.status !== 'active' && !shopping) || w.beam?.carried === true || w.scene !== null) return null;
    if (w.clock.minutes < FROM || w.clock.minutes > UNTIL) return null;
    // Juste après un geste de la maison (Agir au comptoir, une commande): on garde la main quelques
    // pas, sinon le robot du jeu repart ailleurs (la rue Haute est loin) et referme la boutique.
    if (w.tick < m.wait) return frame(m);
    const busy = roomInProgress(sim);
    // Commander (p1, à l'établi; p2 accepte par le robot du jeu).
    if (busy === null) {
      const next = nextRoom(sim);
      const price = next === null ? null : (sim.content.home.rooms.find((r) => r.id === next)?.price ?? null);
      if (c.id !== 'p1' || next === null || price === null || orderProblem(sim, next) !== null || w.purse < price + RESERVE) return null;
      if (w.proposals.some((p) => p.purchase.item === next)) return null;
      const bench = sim.map.points[POINT.workbench];
      if (bench === undefined) return null;
      if (go(sim, c, m, 'etabli', bench, 1.5, out)) return frame(m);
      out.push({ type: 'improvement_pay', improvement: next, amount: null });
      m.wait = w.tick + 30;
      return frame(m);
    }
    if (!siteReady(sim, busy.id)) return null;
    const room = mapRoomOfBuild(sim.map, busy.id);
    const site = room?.build === undefined || room.build === null ? undefined : sim.map.points[room.build.site];
    if (site === undefined) return null;
    const need = roomStillNeeded(sim, busy.id);
    const needOf = (item: string): number => need.find((n) => n.item === item)?.count ?? 0;
    const p1 = character(sim, 'p1');
    const p2 = character(sim, 'p2');
    const bags = (item: string): number => countInBag(p1, item) + countInBag(p2, item);
    // Clous: chez Odette (p1).
    const nails = needOf('nail') - bags('nail');
    if (c.id === 'p1' && nails > 0 && w.purse >= nails * (sim.content.items.nail?.buyPrice ?? 0)) {
      const counter = sim.map.points[POINT.groceryCounter];
      if (counter === undefined) return null;
      if (c.menu !== 'shop') {
        if (go(sim, c, m, 'boutique', counter, 1.2, out)) return frame(m);
        out.push({ type: 'move_to', target: { kind: 'ground', x: counter.x, y: counter.y }, act: true });
        m.wait = w.tick + 5;
        return frame(m);
      }
      out.push({ type: 'buy', item: 'nail', count: nails });
      out.push({ type: 'menu', menu: null });
      m.wait = w.tick + 3;
      return frame(m);
    }
    // Planches: p2 scie des rondins (le robot du jeu abat déjà des arbres); faute de rondins, on laisse faire le robot du jeu.
    const planks = needOf('plank') - bags('plank');
    if (c.id === 'p2' && planks > 0) {
      if (countInBag(c, 'log') === 0) return chop(sim, c, m, out);
      const bench = sim.map.points[POINT.workbench];
      if (bench === undefined) return null;
      if (go(sim, c, m, 'etabli', bench, 1.5, out)) return frame(m);
      out.push({ type: 'craft', recipe: 'saw_plank' });
      m.wait = w.tick + 3;
      return frame(m);
    }
    // Au site: déposer ce qu'on porte, puis bâtir à deux (ou seul si l'autre est occupé).
    if (go(sim, c, m, 'site', site, 1.2, out)) return frame(m);
    for (const n of need) {
      const have = countInBag(c, n.item);
      if (have > 0) out.push({ type: 'room_deposit', room: busy.id, item: n.item, count: Math.min(have, n.count) });
    }
    return frame(m, true);
  }

  return {
    log,
    decide(sim) {
      const d = base.decide(sim);
      const controls: Partial<Record<CharacterId, ControlFrame>> = { ...d.controls };
      let intents: AuthoredIntent[] = d.intents;
      for (const c of sim.world.characters) {
        const out: Intent[] = [];
        const f = task(sim, c, out);
        if (f === null) continue;
        controls[c.id] = f;
        intents = intents.filter((i) => i.by !== c.id || i.intent.type === 'proposal_answer');
        for (const intent of out) intents.push({ by: c.id, intent });
      }
      for (const id of ORDER) {
        const s = sim.world.rooms[id];
        if (s?.ordered !== null && s?.ordered !== undefined) log.ordered[id] ??= s.ordered;
        if (s?.builtDay !== null && s?.builtDay !== undefined) log.built[id] ??= s.builtDay;
      }
      return { controls, intents };
    },
    job(id) {
      return base.job(id);
    },
  };
}
