// Passants de la place (retour de séance du 2026-11-09, « le village est désert »): tests courts.
// Chemins loin des obstacles, monde selon l'heure, mêmes passants chez les deux joueurs, rien ne
// traverse rien, clients attendus qui viennent de la place.
import { describe, expect, it } from 'vitest';
import {
  createPassers,
  routePoints,
  type ClienteleView,
  type PasserPose,
  type Passers,
  type PassersInput,
} from '../src/decor/passants';
import { BLOCKERS, PLACES, blockerDistance, type Place } from '../src/decor/place';
import { PASSERS } from '../src/decor/reglages';

/** Demi-largeur d'épaules plus une marge: un passant ne frôle rien de plus près. */
const CLEAR = 0.3;
/** Bâtiments (grandes boîtes): on n'en approche que pour entrer par sa porte. */
const isBuilding = (i: number): boolean => {
  const b = BLOCKERS[i];
  return b?.kind === 'box' && (b.x1 - b.x0) * (b.z1 - b.z0) > 20;
};

function clearance(x: number, z: number, near: readonly Place[]): number {
  let worst = Infinity;
  BLOCKERS.forEach((b, i) => {
    // Le dernier mètre vers une porte ou un banc touche forcément le bâtiment ou le banc.
    if (near.some((p) => p.kind !== 'edge' && Math.hypot(p.x - x, p.z - z) < 1.1)) {
      if (isBuilding(i) || b.kind === 'box') return;
    }
    worst = Math.min(worst, blockerDistance(b, x, z));
  });
  return worst;
}

describe('chemins de la place', () => {
  it('chaque trajet entre deux lieux, voie à droite, reste à distance des obstacles', () => {
    const bad: string[] = [];
    for (const a of PLACES)
      for (const b of PLACES) {
        // Un banc se rejoint par son nœud puis d'un pas (voir `passants.ts`): testé par la marche.
        if (a === b || a.kind === 'seat' || b.kind === 'seat') continue;
        const { xs, zs } = routePoints(a, b, PASSERS.lane);
        for (let i = 1; i < xs.length; i++) {
          const x0 = xs[i - 1] ?? 0;
          const z0 = zs[i - 1] ?? 0;
          const x1 = xs[i] ?? 0;
          const z1 = zs[i] ?? 0;
          const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, z1 - z0) / 0.1));
          for (let k = 0; k <= n; k++) {
            const x = x0 + ((x1 - x0) * k) / n;
            const z = z0 + ((z1 - z0) * k) / n;
            const c = clearance(x, z, [a, b]);
            if (c < CLEAR) {
              bad.push(`${a.id} -> ${b.id} (${x.toFixed(2)}, ${z.toFixed(2)}): ${c.toFixed(2)}`);
              break;
            }
          }
        }
      }
    expect(bad.slice(0, 12)).toEqual([]);
  });
});

const NO_CLIENTS: ClienteleView = { arrivals: [], expected: [], groups: [] };

function run(
  p: Passers,
  minute: number,
  seconds: number,
  onStep?: (t: number) => void,
  clientele: ClienteleView = NO_CLIENTS,
  start = 0,
): void {
  const dt = 0.1;
  for (let t = 0; t < seconds; t += dt) {
    const input: PassersInput = {
      minute: minute + t / 60,
      segment: '3:service',
      timeline: start + t,
      shared: true,
      spm: 1,
      weather: 'soleil',
    };
    p.update(input, dt, [], clientele);
    onStep?.(t);
  }
}

const pose: PasserPose = { x: 0, y: 0, z: 0, yawDeg: 0, anim: 'idle' };

function visible(p: Passers): { x: number; z: number; trip: string; sit: boolean }[] {
  const out: { x: number; z: number; trip: string; sit: boolean }[] = [];
  for (const t of p.trips())
    for (let k = 0; k < t.members.length; k++)
      if (p.pose(t, k, pose))
        out.push({ x: pose.x, z: pose.z, trip: t.key, sit: pose.anim === 'sit' });
  return out;
}

describe('passants selon l’heure', () => {
  it('plus de monde le matin et à la sortie d’école que le soir', () => {
    const count = (minute: number): number => {
      const p = createPassers(1234, null);
      let sum = 0;
      let n = 0;
      run(p, minute, 90, () => {
        sum += visible(p).length;
        n++;
      });
      return sum / n;
    };
    const morning = count(500);
    const school = count(980);
    const evening = count(1115);
    expect(morning).toBeGreaterThan(4);
    expect(school).toBeGreaterThan(4);
    expect(evening).toBeLessThan(morning / 2);
  });

  it('mêmes passants chez l’hôte et l’invité (même graine, même seconde de service)', () => {
    const a = createPassers(77, null);
    const b = createPassers(77, null);
    run(a, 720, 30);
    run(b, 720, 30);
    expect(visible(a)).toEqual(visible(b));
    expect(visible(a).length).toBeGreaterThan(0);
  });

  it('rien ne traverse rien: ni obstacle, ni autre passant', () => {
    for (const minute of [480, 720, 980]) {
      const p = createPassers(4242 + minute, null);
      run(p, minute, 120, () => {
        const v = visible(p);
        for (const a of v) {
          expect(
            clearance(a.x, a.z, PLACES),
            `(${a.x.toFixed(2)}, ${a.z.toFixed(2)})`,
          ).toBeGreaterThan(0.15);
          for (const b of v) {
            if (a === b || a.trip === b.trip) continue;
            expect(Math.hypot(a.x - b.x, a.z - b.z), `${a.trip} et ${b.trip}`).toBeGreaterThan(
              0.45,
            );
          }
        }
      });
    }
  });

  it('16 h 30: des parents attendent devant la mairie-école et repartent avec un enfant', () => {
    const p = createPassers(99, null);
    let parents = 0;
    let children = 0;
    run(p, 975, 40, undefined);
    for (const t of p.trips()) if (t.purpose === 'ecole_sortie') parents++;
    run(
      p,
      975 + 40 / 60,
      40,
      () => {
        for (const t of p.trips())
          if (t.purpose === 'ecole_sortie' && t.members.length === 2 && p.pose(t, 1, pose))
            children++;
      },
      NO_CLIENTS,
      40,
    );
    expect(parents).toBeGreaterThan(0);
    expect(children).toBeGreaterThan(0);
  });
});

describe('clients venus de la place', () => {
  const models = {
    arriving: (): string[] => ['char_client_flaneur'],
    leaving: (): string[] => ['char_client_voisine'],
  };

  it('le client attendu arrive à la porte à sa seconde et s’efface quand il entre', () => {
    const p = createPassers(5, models);
    const view: { -readonly [K in keyof ClienteleView]: ClienteleView[K] } = {
      arrivals: [[60, 'flaneurs', 1, false]],
      expected: [],
      groups: [],
    };
    let lastSeen = -1;
    let lastDistance = Infinity;
    let seenFrom = -1;
    const dt = 0.1;
    for (let t = 0; t < 70; t += dt) {
      if (t >= 60 && view.groups.length === 0)
        view.groups = [
          { id: 1, stage: 'entering', profile: 'flaneurs', regular: null, arrivedAt: 60 },
        ];
      p.update(
        {
          minute: 600 + t / 60,
          segment: '3:service',
          timeline: t,
          shared: true,
          spm: 1,
          weather: 'soleil',
        },
        dt,
        [],
        view,
      );
      const trip = p.trips().find((x) => x.purpose === 'client');
      if (trip !== undefined && p.pose(trip, 0, pose)) {
        if (seenFrom < 0) seenFrom = t;
        lastSeen = t;
        lastDistance = Math.hypot(pose.x - 9.4, pose.z - 16);
      }
    }
    // On le voit venir de loin (plus de 8 s de marche), il est à la porte quand il entre.
    expect(seenFrom).toBeGreaterThanOrEqual(0);
    expect(60 - seenFrom).toBeGreaterThan(8);
    expect(Math.abs(lastSeen - 60)).toBeLessThan(0.3);
    expect(lastDistance).toBeLessThan(1.5);
    expect(p.trips().some((x) => x.purpose === 'client')).toBe(false);
  });

  it('le client qui renonce repart; celui qui sort continue son chemin', () => {
    const p = createPassers(6, models);
    const view: { -readonly [K in keyof ClienteleView]: ClienteleView[K] } = {
      arrivals: [[30, 'flaneurs', 1, false]],
      expected: [],
      groups: [{ id: 3, stage: 'leaving', profile: 'voisins', regular: null, arrivedAt: 0 }],
    };
    const dt = 0.1;
    let left = false;
    let departed = false;
    for (let t = 0; t < 40; t += dt) {
      if (t > 1) view.groups = [];
      const out = p.trips().find((x) => x.key.includes('depart:3'));
      if (out !== undefined && p.pose(out, 0, pose) && Math.hypot(pose.x - 9.4, pose.z - 16) > 2)
        departed = true;
      p.update(
        { minute: 600, segment: '3:service', timeline: t, shared: true, spm: 1, weather: 'soleil' },
        dt,
        [],
        view,
      );
      const trip = p.trips().find((x) => x.key.includes('client:30'));
      if (
        t > 34 &&
        trip !== undefined &&
        p.pose(trip, 0, pose) &&
        Math.hypot(pose.x - 9.4, pose.z - 16) > 1
      )
        left = true;
    }
    expect(left).toBe(true);
    expect(departed).toBe(true);
  });
});
