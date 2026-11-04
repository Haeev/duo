// 0.13, lot H7 (`docs/jeux/jeu-1/v0-13-habitants.md`, section 7): la vie du village. Une
// simulation courte par scène, à l'heure dite: sortie de la messe (S11), café (places assises et
// café d'après la messe), forge et établi (postes de métier, coups pour le son), pause de l'angélus
// (S10), et le chat (habitudes, fuite, approche, même chat pour la même graine).
import { startLocalDuo } from '@duo/sdk-dev';
import { describe, expect, it } from 'vitest';
import manifest from '../duo-game.json';
import type { ControlFrame } from '../src/etat/actions';
import { createSession, type GameAction } from '../src/session';
import type { Character, VillagerState, WorldEvent } from '../src/etat/types';
import { lifePlace, sceneBubbles } from '../src/etat/vie';
import { SIM_DT, SIM_HZ } from '../src/simulation/constantes';
import type { Sim } from '../src/simulation/contexte';
import { updateCat } from '../src/simulation/chat';
import { placeVillagers, updateVillagers } from '../src/simulation/habitants';
import { villagerBlockers } from '../src/simulation/deplacement';
import { bodyCollides } from '../src/simulation/grille';
import { contentAndMap, newSim, SEED } from './aides';

/** Le jour `day` à `minutes`, beau temps, les deux joueurs créés, loin de tout. */
function daySim(day: number, minutes: number, seed = SEED): Sim {
  const sim = newSim(seed);
  const w = sim.world;
  w.phase = 'day';
  w.clock.day = day;
  w.clock.minutes = minutes;
  w.weather = 'sunny';
  // Le chat est arrivé (histoire de Margot, section 7.4).
  w.flags.push('cat_here');
  for (const c of w.characters) {
    c.created = true;
    c.status = 'active';
    c.inside = null;
    c.pos = { x: 5, y: 60 };
    c.prev = { x: 5, y: 60 };
  }
  placeVillagers(sim);
  return sim;
}

/** Fait tourner habitants et chat `seconds` secondes, horloge arrêtée (les événements sont gardés). */
function run(sim: Sim, seconds: number, events: WorldEvent[] = []): WorldEvent[] {
  for (let i = 0; i < Math.round(seconds * SIM_HZ); i++) {
    sim.world.tick += 1;
    sim.events.length = 0;
    updateVillagers(sim, SIM_DT);
    updateCat(sim, SIM_DT);
    events.push(...sim.events);
  }
  return events;
}

function villager(sim: Sim, id: string): VillagerState {
  const v = sim.world.villagers.find((x) => x.id === id);
  if (v === undefined) throw new Error(`habitant absent: ${id}`);
  return v;
}

function player(sim: Sim, id: 'p1' | 'p2'): Character {
  const c = sim.world.characters.find((x) => x.id === id);
  if (c === undefined) throw new Error('joueur absent');
  return c;
}

/** Aucun des habitants visibles et arrêtés n'est à moins de `gap` m d'un autre. */
function closestPair(sim: Sim, ids: readonly string[]): number {
  let best = Infinity;
  for (const a of ids) {
    for (const b of ids) {
      if (a >= b) continue;
      const va = villager(sim, a);
      const vb = villager(sim, b);
      best = Math.min(best, Math.hypot(va.pos.x - vb.pos.x, va.pos.y - vb.pos.y));
    }
  }
  return best;
}

const SUNDAY = 2;
const MONDAY = 3;
const MASS = ['martial', 'honorine', 'armand', 'berthe', 'margot', 'marthe', 'ambroise', 'leon'];

describe('vie du village, lot H7', () => {
  it('données: chaque place debout (scène, poste, chat) est libre de décor, deux places d\'une scène ne se touchent pas', () => {
    const sim = daySim(MONDAY, 10 * 60);
    const b = villagerBlockers(sim, 'firmin');
    const life = sim.content.village;
    const bad: string[] = [];
    for (const scene of life.scenes) {
      const spots: { x: number; y: number; who: string }[] = [];
      scene.groups.forEach((g, gi) => {
        g.who.forEach((who, rank) => {
          const place = lifePlace(sim.content, `scene:${scene.id}:${String(gi)}:${String(rank)}`);
          if (place === null) return;
          spots.push({ x: place.x, y: place.y, who });
          if (!place.seated && bodyCollides(b, place.x, place.y)) bad.push(`${scene.id}/${who}`);
        });
      });
      for (const a of spots) for (const c of spots) if (a.who < c.who && Math.hypot(a.x - c.x, a.y - c.y) < 0.6) bad.push(`${scene.id}: ${a.who}~${c.who}`);
    }
    for (const p of life.workPosts) if (p.at !== null && bodyCollides(b, p.at.x, p.at.y)) bad.push(`poste ${p.point}`);
    for (const h of life.cat?.habits ?? []) for (const s of h.spots) if (bodyCollides(b, s.x, s.y, 0.2)) bad.push(`chat ${h.id}`);
    expect(bad).toEqual([]);
  });

  it('S11: à 11 h 30 le dimanche, les paroissiens sortent sur le parvis et forment des groupes', () => {
    const sim = daySim(SUNDAY, 11 * 60 + 29);
    // Pendant la messe, chacun à sa place dans la nef (l'abbé au chœur), sans se marcher dessus.
    for (const id of MASS) expect(villager(sim, id).target, id).toMatch(/^scene:mass:/);
    expect(closestPair(sim, MASS)).toBeGreaterThan(0.9);
    sim.world.clock.minutes = 11 * 60 + 31;
    run(sim, 40);
    for (const id of MASS) {
      const v = villager(sim, id);
      expect(v.target, id).toMatch(/^scene:mass_exit:/);
      const place = lifePlace(sim.content, v.target);
      expect(place, id).not.toBeNull();
      if (place === null) continue;
      // Arrivé à sa place, arrêté, tourné vers le centre de son groupe.
      expect(Math.hypot(v.pos.x - place.x, v.pos.y - place.y), id).toBeLessThan(0.02);
      expect(v.speed, id).toBe(0);
      expect(v.activity, id).toBe('chat');
      expect(Math.cos(v.facing - (place.facing ?? 0)), id).toBeGreaterThan(0.999);
    }
    // Personne ne se marche dessus.
    expect(closestPair(sim, MASS)).toBeGreaterThan(0.55);
    // Des bulles passent (à tour de rôle, la même pour la même graine).
    let said = 0;
    for (let i = 0; i < 100; i++) {
      sim.world.clock.minutes = 11 * 60 + 31 + i * 0.1;
      if (sceneBubbles(sim.content, sim.world).some((b) => b.scene === 'mass_exit')) said++;
    }
    expect(said).toBeGreaterThan(0);
    // À 11 h 50, la scène finie, ils reprennent leur planning (le café d'après la messe pour quatre).
    sim.world.clock.minutes = 11 * 60 + 52;
    run(sim, 1);
    for (const id of MASS) expect(villager(sim, id).target, id).not.toMatch(/^scene:mass_exit:/);
  });

  it('S11 (suite): après la messe, quatre paroissiens attablés au café, chacun sur sa chaise', () => {
    const sim = daySim(SUNDAY, 11 * 60 + 29);
    sim.world.clock.minutes = 11 * 60 + 55;
    run(sim, 60);
    const seated = ['armand', 'ambroise', 'margot', 'berthe'];
    for (const id of seated) {
      const v = villager(sim, id);
      const place = lifePlace(sim.content, v.target);
      expect(place?.seated, id).toBe(true);
      if (place === null) continue;
      expect(Math.hypot(v.pos.x - place.x, v.pos.y - place.y), id).toBeLessThan(0.02);
    }
    expect(closestPair(sim, seated)).toBeGreaterThan(0.7);
  });

  it('café: Berthe déjeune assise à une table de la terrasse en semaine, à midi', () => {
    // Après l'angélus de midi (12 h à 12 h 03), où tout le monde s'arrête.
    const sim = daySim(MONDAY, 11 * 60 + 58);
    sim.world.clock.minutes = 12 * 60 + 5;
    run(sim, 1);
    const v = villager(sim, 'berthe');
    expect(v.target).toMatch(/^seat:cafe_terrace:/);
    // Elle vient du moulin: on la place près de la terrasse pour ne pas attendre le trajet.
    v.pos = { x: 88.5, y: 23.5 };
    v.prev = { ...v.pos };
    sim.runtime.villagerPaths = {};
    run(sim, 20);
    const place = lifePlace(sim.content, v.target);
    expect(place?.seated).toBe(true);
    if (place === null) return;
    expect(Math.hypot(v.pos.x - place.x, v.pos.y - place.y)).toBeLessThan(0.02);
    expect(Math.cos(v.facing - (place.facing ?? 0))).toBeGreaterThan(0.999);
  });

  it('forge: Mado tape à l\'enclume, tournée vers elle, et chaque coup part pour le son', () => {
    const sim = daySim(MONDAY + 1, 7 * 60 + 59);
    sim.world.clock.minutes = 8 * 60 + 1;
    run(sim, 1);
    const mado = villager(sim, 'mado');
    expect(mado.target).toBe('forge_yard');
    mado.pos = { x: 105.5, y: 21.5 };
    mado.prev = { ...mado.pos };
    sim.runtime.villagerPaths = {};
    run(sim, 10);
    expect(Math.hypot(mado.pos.x - 105.5, mado.pos.y - 18.3)).toBeLessThan(0.02);
    // Cap 0 (nord): vers l'enclume, -y.
    expect(Math.sin(mado.facing)).toBeLessThan(-0.999);
    // Personne à portée: aucun coup; un joueur à côté: un coup par durée du clip.
    expect(run(sim, 2).filter((e) => e.type === 'forge_strike')).toHaveLength(0);
    player(sim, 'p1').pos = { x: 106.5, y: 20.5 };
    const strokes = run(sim, 4).filter((e) => e.type === 'forge_strike');
    expect(strokes.length).toBeGreaterThanOrEqual(5);
    expect(strokes[0]).toMatchObject({ villager: 'mado' });
  });

  it('S10: à l\'angélus de midi, les habitants dehors s\'arrêtent en chemin', () => {
    const sim = daySim(MONDAY, 11 * 60 + 58);
    sim.world.clock.minutes = 12 * 60 + 1;
    run(sim, 0.5);
    const walking = sim.world.villagers.filter((v) => v.visible && v.inside === null && (sim.runtime.villagerPaths[v.id]?.path.length ?? 0) > 0);
    expect(walking.length).toBeGreaterThan(0);
    const before = walking.map((v) => ({ ...v.pos }));
    run(sim, 2);
    walking.forEach((v, i) => {
      expect(v.pos, v.id).toEqual(before[i]);
    });
    sim.world.clock.minutes = 12 * 60 + 4;
    run(sim, 1);
    expect(walking.some((v, i) => JSON.stringify(v.pos) !== JSON.stringify(before[i]))).toBe(true);
  });

  it('chat: à 8 h, il dort à la tonnelle d\'Odette; deux parties de même graine ont le même chat', () => {
    const a = daySim(MONDAY, 8 * 60);
    const b = daySim(MONDAY, 8 * 60);
    run(a, 30);
    run(b, 30);
    const ca = a.runtime.cat;
    expect(ca).not.toBeNull();
    expect(ca?.habit).toBe('odette_arbor');
    expect(ca?.pose === 'sleep' || ca?.pose === 'roll').toBe(true);
    expect(b.runtime.cat?.pos).toEqual(ca?.pos);
    expect(b.runtime.cat?.since).toBe(ca?.since);
    // La nuit, il chasse hors de la carte.
    a.world.clock.minutes = 22 * 60;
    run(a, 0.1);
    expect(a.runtime.cat).toBeNull();
  });

  it('chat: il fuit doucement un joueur qui arrive vite, se laisse approcher à petits pas', () => {
    const sim = daySim(MONDAY, 8 * 60);
    run(sim, 5);
    const cat = sim.runtime.cat;
    if (cat === null) throw new Error('pas de chat');
    const start = { ...cat.pos };
    const p = player(sim, 'p1');
    // À petits pas (touche tapotée): vitesse lissée basse, il reste et la regarde.
    p.pos = { x: start.x + 1.5, y: start.y };
    for (let i = 0; i < 2 * SIM_HZ; i++) {
      p.speed = i % 10 === 0 ? 3.5 : 0;
      run(sim, SIM_DT);
    }
    expect(Math.hypot(cat.pos.x - start.x, cat.pos.y - start.y)).toBeLessThan(0.05);
    // En courant droit sur lui: il s'écarte.
    p.pos = { x: start.x + 6, y: start.y };
    for (let i = 0; i < 2 * SIM_HZ; i++) {
      p.speed = 3.5;
      p.pos.x -= 3.5 * SIM_DT;
      run(sim, SIM_DT);
    }
    run(sim, 3);
    expect(Math.hypot(cat.pos.x - start.x, cat.pos.y - start.y)).toBeGreaterThan(1.5);
  });

  it('chat: une approche douce sur vingt environ, il suit le joueur un moment, puis s\'arrête', () => {
    const sim = daySim(MONDAY, 8 * 60);
    run(sim, 5);
    const cat = sim.runtime.cat;
    if (cat === null) throw new Error('pas de chat');
    const p = player(sim, 'p1');
    p.speed = 0;
    let followed = -1;
    // Des approches douces répétées (à 3 m, puis loin), jusqu'au premier suivi.
    for (let i = 0; i < 200 && followed < 0; i++) {
      p.pos = { x: cat.pos.x + 3, y: cat.pos.y };
      const events = run(sim, 0.2);
      if (events.some((e) => e.type === 'cat_follow')) followed = i;
      p.pos = { x: cat.pos.x + 20, y: cat.pos.y };
      run(sim, 0.2);
    }
    expect(followed).toBeGreaterThanOrEqual(0);
    expect(cat.mode).toBe('follow');
    // Le joueur s'éloigne à pied vers l'est: le chat le suit.
    const start = { ...cat.pos };
    p.facing = 0;
    for (let i = 0; i < 8 * SIM_HZ; i++) {
      p.pos.x += 0.5 * SIM_DT;
      run(sim, SIM_DT);
    }
    expect(cat.pos.x - start.x).toBeGreaterThan(1);
    run(sim, 25);
    expect(cat.mode).not.toBe('follow');
  });

  it('personne dans personne: une semaine d\'heures pleines, les habitants arrêtés sont à 0,6 m au moins l\'un de l\'autre', () => {
    const bad: string[] = [];
    for (let day = 2; day <= 8; day++) {
      for (let hour = 7; hour <= 21; hour++) {
        const sim = daySim(day, hour * 60 + 30);
        run(sim, 30);
        const still = sim.world.villagers.filter((v) => v.visible && v.speed === 0 && (sim.runtime.villagerPaths[v.id]?.path.length ?? 0) === 0);
        for (const a of still) {
          for (const b of still) {
            if (a.id >= b.id || a.inside !== b.inside) continue;
            const d = Math.hypot(a.pos.x - b.pos.x, a.pos.y - b.pos.y);
            if (d < 0.6) bad.push(`j${String(day)} ${String(hour)}h30 ${a.id}/${b.id} ${a.target} ${d.toFixed(2)}`);
          }
        }
      }
    }
    expect(bad).toEqual([]);
  });

  it('hôte et invité: mêmes places de scène, mêmes bulles et même chat chez les deux', async () => {
    const duo = await startLocalDuo<GameAction>({
      manifest,
      conditions: { latencyMs: 0, jitterMs: 0, spikeProbability: 0 },
      seed: 5,
    });
    try {
      await duo.start();
      const { content, map } = contentAndMap();
      const clock = { now: 0 };
      const host = createSession({ duo: duo.hostGame, content, map, now: () => clock.now });
      const guest = createSession({ duo: duo.guestGame, content, map, now: () => clock.now });
      let seq = 0;
      // Horloge tenue à la minute voulue (le rythme de jeu la ferait avancer).
      let hold: { w: { clock: { minutes: number } }; minutes: number } | null = null;
      const idle = (): ControlFrame => ({ seq: (seq += 1), moveX: 0, moveY: 0, actHeld: false });
      const tick = async (): Promise<void> => {
        if (hold !== null) hold.w.clock.minutes = hold.minutes;
        host.step(idle());
        guest.step(idle());
        clock.now += SIM_DT * 1000;
        host.beforeFrame(1);
        guest.beforeFrame(1);
        await new Promise((resolve) => setTimeout(resolve, 0));
      };
      for (let i = 0; i < 20; i++) await tick();
      const sim = host.hostSim();
      if (sim === null) throw new Error('hôte sans monde');
      const w = sim.world;
      w.phase = 'day';
      w.clock.day = SUNDAY;
      w.clock.minutes = 11 * 60 + 29;
      w.clock.running = false;
      w.scene = null;
      w.weather = 'sunny';
      w.flags.push('cat_here');
      for (const c of w.characters) {
        c.created = true;
        c.status = 'active';
        c.inside = null;
        c.pos = { x: 96, y: -0.5 };
      }
      placeVillagers(sim);
      hold = { w, minutes: 11 * 60 + 31 };
      sim.runtime.changed = true;
      for (let i = 0; i < 40 * SIM_HZ; i++) await tick();
      const seen = guest.view.world();
      for (const id of MASS) {
        const h = villager(sim, id);
        const g = seen.villagers.find((x) => x.id === id);
        expect(g?.target, id).toBe(h.target);
        expect(g?.activity, id).toBe(h.activity);
        expect(Math.hypot((g?.pos.x ?? 0) - h.pos.x, (g?.pos.y ?? 0) - h.pos.y), id).toBeLessThan(0.05);
      }
      expect(sceneBubbles(content, seen).map((b) => b.by)).toEqual(sceneBubbles(content, w).map((b) => b.by));
      // Le chat (dimanche midi passé: banc du quai), le même chez l'invité, à l'interpolation près.
      hold = { w, minutes: 12 * 60 + 30 };
      for (let i = 0; i < 5 * SIM_HZ; i++) await tick();
      const hc = host.view.cat?.() ?? null;
      const gc = guest.view.cat?.() ?? null;
      expect(hc).not.toBeNull();
      expect(gc?.pose).toBe(hc?.pose);
      expect(Math.hypot((gc?.pos.x ?? 0) - (hc?.pos.x ?? 99), (gc?.pos.y ?? 0) - (hc?.pos.y ?? 99))).toBeLessThan(0.3);
      host.dispose();
      guest.dispose();
    } finally {
      duo.dispose();
    }
  });
});
