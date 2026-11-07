/**
 * Canal 7 (hôte vers invité, `latest`): positions des clients debout, compactes (technique 5.3):
 * `[numéro du groupe, x en cm, z en cm, cap en demi-degrés, animation]`, 20 fois par seconde avec
 * les déplacements des joueurs. Un client assis n'y figure pas: sa place (domaine clientèle) le
 * situe. L'invité interpole entre les deux derniers instantanés.
 */
import { v, type Net } from '@duo/sdk';
import type { World } from '../etat/monde';
import { animOf, hostWalkers, type Anim } from './clients';

export const CLIENTELE_CHANNEL = 7;

const ANIMS: readonly Anim[] = ['walk', 'idle', 'sit', 'drink', 'sit_drink'];
const Int = v.pipe(v.number(), v.integer());

export const CustomerMovesSchema = v.strictObject({
  tick: v.pipe(v.number(), v.integer(), v.minValue(0)),
  w: v.pipe(
    v.array(
      v.tuple([Int, Int, Int, Int, v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(4))]),
    ),
    v.maxLength(150),
  ),
});
type CustomerMoves = v.InferOutput<typeof CustomerMovesSchema>;

export interface CustomerPose {
  x: number;
  z: number;
  yawDeg: number;
  anim: Anim;
}

interface GuestTrack {
  previous: Map<number, CustomerPose>;
  current: Map<number, CustomerPose>;
  atMs: number;
  intervalMs: number;
}

const guestTracks = new WeakMap<World, GuestTrack>();

export interface ClienteleHostNet {
  afterStep(): void;
}

export function createClienteleHostNet(net: Net, world: World, every: number): ClienteleHostNet {
  const channel = net.channel(CLIENTELE_CHANNEL, { mode: 'latest', schema: CustomerMovesSchema });
  return {
    afterStep() {
      if (world.tick % every !== 0) return;
      const w: CustomerMoves['w'] = [];
      for (const [id, walker] of hostWalkers(world)) {
        const g = world.clientele.groups.find((x) => x.id === id);
        if (g === undefined || g.stage === 'seated') continue;
        w.push([
          id,
          Math.round(walker.x * 100),
          Math.round(walker.z * 100),
          Math.round(walker.yawDeg * 2),
          ANIMS.indexOf(animOf(g, walker.moving)),
        ]);
      }
      channel.send({ tick: world.tick, w });
    },
  };
}

export function createClienteleGuestNet(net: Net, world: World, now: () => number): () => void {
  const channel = net.channel(CLIENTELE_CHANNEL, { mode: 'latest', schema: CustomerMovesSchema });
  const track: GuestTrack = {
    previous: new Map(),
    current: new Map(),
    atMs: now(),
    intervalMs: 50,
  };
  guestTracks.set(world, track);
  return channel.onMessage((m) => {
    const t = now();
    track.intervalMs = Math.max(16, Math.min(200, t - track.atMs));
    track.atMs = t;
    track.previous = track.current;
    track.current = new Map(
      m.w.map(([id, x, z, yaw, anim]) => [
        id,
        { x: x / 100, z: z / 100, yawDeg: yaw / 2, anim: ANIMS[anim] ?? 'idle' },
      ]),
    );
  });
}

/**
 * Pose d'un client debout pour l'image en cours: chez l'hôte, son marcheur; chez l'invité,
 * l'interpolation des deux derniers instantanés. `null` si le client est assis ou inconnu.
 */
export function standingPose(world: World, id: number, nowMs: number, out: CustomerPose): boolean {
  const track = guestTracks.get(world);
  if (track === undefined) {
    const w = hostWalkers(world).get(id);
    const g = world.clientele.groups.find((x) => x.id === id);
    if (w === undefined || g === undefined || g.stage === 'seated') return false;
    out.x = w.x;
    out.z = w.z;
    out.yawDeg = w.yawDeg;
    out.anim = animOf(g, w.moving);
    return true;
  }
  const b = track.current.get(id);
  if (b === undefined) return false;
  const a = track.previous.get(id) ?? b;
  const k = Math.max(0, Math.min(1, (nowMs - track.atMs) / track.intervalMs));
  out.x = a.x + (b.x - a.x) * k;
  out.z = a.z + (b.z - a.z) * k;
  let d = b.yawDeg - a.yawDeg;
  if (d > 180) d -= 360;
  if (d < -180) d += 360;
  out.yawDeg = a.yawDeg + d * k;
  out.anim = b.anim;
  return true;
}
