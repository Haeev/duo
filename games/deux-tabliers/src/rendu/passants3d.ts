/**
 * Rendu des passants de la place (`decor/passants.ts`), chez l'hôte et chez l'invité, sans réseau.
 *
 * Les personnages livrés des clients (`char_client_*`, lus une fois avec eux, `personnages.ts`):
 * aucun programme de plus. Les enfants sont ces modèles réduits (aucun modèle d'enfant livré).
 * Budget du PC de référence (C1): au plus 40 personnages animés visibles en tout; les passants
 * prennent ce que laissent les clients et l'autre joueur, les plus proches d'abord. Hors du champ,
 * un passant n'est ni dessiné ni animé; loin, son animation n'avance qu'une image sur deux.
 * Figures recyclées par modèle: rien n'est alloué par image tant que la foule ne change pas.
 */
import {
  AnimationMixer,
  Frustum,
  Group,
  Matrix4,
  Mesh,
  Sphere,
  Vector3,
  type AnimationClip,
  type Object3D,
  type PerspectiveCamera,
  type Scene,
} from 'three';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { looksOf, memberLook } from '../clientele/clients';
import { modelName, urlOf } from '../clientele/rendu3d';
import { standingPose, type CustomerPose } from '../clientele/reseau';
import type { DecorClock } from '../decor/horloge';
import {
  createPassers,
  type Body,
  type ClienteleView,
  type CustomerModels,
  type PasserPose,
  type Passers,
  type Trip,
} from '../decor/passants';
import { PASSERS } from '../decor/reglages';
import type { GameView } from '../reseau/vue';
import {
  bendThighs,
  restClip,
  seatPlacement,
  SIT_REST,
  sitCalibration,
  thighsOf,
  type SeatPlacement,
  type SitCalibration,
} from './assis';
import { createClipBlend, type ClipBlend } from './melange';
import { loadCharacterGltf } from './personnages';

interface Figure {
  readonly model: string;
  readonly node: Object3D;
  readonly blend: ClipBlend;
  readonly sit: SitCalibration | null;
  readonly thighs: readonly Object3D[];
  /** Cap affiché (radians), tourné en douceur vers celui du chemin. */
  rotY: number;
  odd: boolean;
}

export interface PassersNodes {
  /** Chaque image, après `clock.update` (horloge du décor, mise à jour par l'appelant). */
  update(view: GameView, camera: PerspectiveCamera, dt: number, nowMs: number): void;
  /** Passants dessinés à la dernière image (mesure du budget). */
  drawn(): number;
  /** Le décor (tests de la page de captures): trajets en cours. */
  passers(): Passers;
  dispose(): void;
}

/** Vitesse de marche des clips (`walk`), pour caler les pas sur la vitesse du passant. */
const CLIP_WALK_SPEED = 1.1;
const TURN_RATE = 7;

export function createPassersNodes(scene: Scene, seed: number, clock: DecorClock): PassersNodes {
  const root = new Group();
  root.name = 'passants';
  scene.add(root);
  let view: GameView | null = null;

  const models: CustomerModels = {
    arriving(profile, regular, size) {
      const cc = view?.content.clientele;
      if (cc === undefined) return [];
      const out: string[] = [];
      // L'allure sera tirée à l'entrée (`chooseLook`): on prend celle qu'elle sera le plus souvent.
      const looks = profile === null ? [] : looksOf(cc, profile);
      const next = (view?.world().clientele.nextGroupId ?? 0) + 1;
      const look = looks.length === 0 ? '' : (looks[next % looks.length] ?? '');
      for (let k = 0; k < size; k++) {
        const g = {
          role: null,
          regular,
          profile: profile ?? '',
          look: look === '' ? '' : memberLook(cc, profile ?? '', look, 0),
        };
        const name = modelName(cc, g, k);
        if (name !== null) out.push(name);
      }
      return out;
    },
    leaving(groupId) {
      const w = view?.world();
      const cc = view?.content.clientele;
      const g = w?.clientele.groups.find((x) => x.id === groupId);
      if (g === undefined || cc === undefined || g.role !== null) return [];
      const out: string[] = [];
      for (let k = 0; k < g.size; k++) {
        const name = modelName(cc, g, k);
        if (name !== null) out.push(name);
      }
      return out;
    },
  };
  const passers = createPassers(seed, models);

  // Figures par trajet et par membre; réserve par modèle.
  const pool = new Map<string, Figure[]>();
  const live = new Map<string, Figure>();
  const loading = new Set<string>();
  const sources = new Map<string, { scene: Object3D; clips: AnimationClip[] }>();
  let disposed = false;

  const source = (model: string): void => {
    if (sources.has(model) || loading.has(model)) return;
    const url = urlOf(model);
    if (url === undefined) return;
    loading.add(model);
    void loadCharacterGltf(url).then((src) => {
      loading.delete(model);
      if (src === null || disposed) return;
      const rest = restClip(src.clips);
      sources.set(model, {
        scene: src.scene,
        clips: rest === null ? [...src.clips] : [...src.clips, rest],
      });
    });
  };
  for (const m of PASSERS.adults) source(m);

  const take = (model: string): Figure | null => {
    const free = pool.get(model)?.pop();
    if (free !== undefined) return free;
    const src = sources.get(model);
    if (src === undefined) {
      source(model);
      return null;
    }
    const node = cloneSkinned(src.scene);
    node.traverse((o) => {
      // Le champ est testé ici par passant (sphère fixe): la sphère d'un maillage animé, calculée
      // une fois sur la pose du moment, le ferait disparaître à tort.
      if (o instanceof Mesh) o.frustumCulled = false;
    });
    const sit = sitCalibration(
      `${model}:${SIT_REST}`,
      node,
      src.clips.find((c) => c.name === SIT_REST),
    );
    const blend = createClipBlend(new AnimationMixer(node), src.clips, 0.25);
    blend.update(0);
    node.visible = false;
    root.add(node);
    return { model, node, blend, sit, thighs: thighsOf(node), rotY: 0, odd: false };
  };
  const release = (key: string, f: Figure): void => {
    f.node.visible = false;
    live.delete(key);
    const list = pool.get(f.model) ?? [];
    list.push(f);
    pool.set(f.model, list);
  };

  const bodies: Body[] = [];
  const bodyPool: { x: number; z: number }[] = [];
  const customer: CustomerPose = { x: 0, z: 0, yawDeg: 0, anim: 'idle' };
  const pose: PasserPose = { x: 0, y: 0, z: 0, yawDeg: 0, anim: 'idle' };
  const placed: SeatPlacement = { x: 0, y: 0, z: 0, thigh: 0 };
  const frustum = new Frustum();
  const m4 = new Matrix4();
  const sphere = new Sphere(new Vector3(), 1.1);
  const seen = new Set<string>();
  const order: { trip: Trip; k: number; d: number; key: string }[] = [];
  let drawn = 0;
  const clienteleView: { current: ClienteleView | null } = { current: null };

  const body = (i: number, x: number, z: number): void => {
    const b = bodyPool[i] ?? { x: 0, z: 0 };
    bodyPool[i] = b;
    b.x = x;
    b.z = z;
    bodies.push(b);
  };

  return {
    update(v, camera, dt, nowMs) {
      view = v;
      const world = v.world();
      // Corps que les passants ne traversent pas: les deux joueurs, les clients debout.
      bodies.length = 0;
      let n = 0;
      for (const i of [0, 1] as const) {
        const p = v.pose(i);
        body(n++, p.x, p.z);
      }
      let customers = 0;
      for (const g of world.clientele.groups) {
        customers += g.size;
        if (g.stage !== 'seated' && standingPose(world, g.id, nowMs, customer))
          body(n++, customer.x, customer.z);
      }
      clienteleView.current = world.clientele;
      const c = world.clientele;
      const spm =
        c.pace === 'peaceful'
          ? v.content.clientele.days.peacefulSecondsPerGameMinute
          : v.content.clientele.days.secondsPerGameMinute;
      passers.update(
        {
          minute: clock.minute(),
          segment: clock.segment(),
          timeline: clock.timeline(),
          shared: clock.shared(),
          spm,
          weather: c.weather,
        },
        dt,
        bodies,
        clienteleView.current,
      );

      // Qui se voit: dans le champ, les plus proches d'abord, dans le budget des 40 personnages.
      camera.updateMatrixWorld();
      m4.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
      frustum.setFromProjectionMatrix(m4);
      order.length = 0;
      for (const trip of passers.trips())
        for (let k = 0; k < trip.members.length; k++) {
          if (!passers.pose(trip, k, pose)) continue;
          sphere.center.set(pose.x, pose.y + 0.9, pose.z);
          if (!frustum.intersectsSphere(sphere)) continue;
          const d = Math.hypot(pose.x - camera.position.x, pose.z - camera.position.z);
          order.push({ trip, k, d, key: `${trip.key}#${String(k)}` });
        }
      order.sort((a, b) => a.d - b.d);
      const budget = Math.max(0, PASSERS.maxAnimated - customers - 1);
      seen.clear();
      drawn = 0;
      for (const o of order) {
        if (drawn >= budget) break;
        const member = o.trip.members[o.k];
        if (member === undefined) continue;
        let f = live.get(o.key) ?? null;
        if (f === null) {
          f = take(member.model);
          if (f === null) continue;
          live.set(o.key, f);
          f.rotY = Number.NaN;
        }
        seen.add(o.key);
        drawn++;
        passers.pose(o.trip, o.k, pose);
        const want = (pose.yawDeg * Math.PI) / 180 + Math.PI;
        if (Number.isNaN(f.rotY)) f.rotY = want;
        let d = want - f.rotY;
        d = Math.atan2(Math.sin(d), Math.cos(d));
        f.rotY += d * Math.min(1, dt * TURN_RATE);
        f.node.rotation.y = f.rotY;
        f.node.scale.setScalar(member.scale);
        const walking = pose.anim === 'walk' && !o.trip.halted;
        const sitting = pose.anim === 'sit' && f.sit !== null;
        f.blend.set(sitting ? SIT_REST : walking ? 'walk' : 'idle');
        if (sitting && f.sit !== null) {
          seatPlacement(f.sit, pose.x, pose.y, pose.z, f.rotY, placed);
          f.node.position.set(placed.x, placed.y, placed.z);
        } else f.node.position.set(pose.x, pose.y, pose.z);
        f.node.visible = true;
        // Loin: une image sur deux, au double du pas.
        f.odd = !f.odd;
        const far = o.d > PASSERS.farDistance;
        if (!far || f.odd) {
          const step = far ? dt * 2 : dt;
          const speed = walking ? speedOf(o.trip) / CLIP_WALK_SPEED / member.scale : 1;
          f.blend.update(step * speed);
        }
        if (sitting) bendThighs(f.node, f.thighs, placed.thigh);
      }
      for (const [key, f] of live) if (!seen.has(key)) release(key, f);
    },
    drawn: () => drawn,
    passers: () => passers,
    dispose() {
      disposed = true;
      for (const f of live.values()) f.blend.stop();
      for (const list of pool.values()) for (const f of list) f.blend.stop();
      live.clear();
      pool.clear();
      passers.dispose();
      scene.remove(root);
    },
  };
}

/** Vitesse de marche du segment en cours (m/s), 1,1 par défaut. */
function speedOf(trip: Trip): number {
  for (const s of trip.segs)
    if (trip.age < s.t1) return s.kind === 'walk' ? s.speed : CLIP_WALK_SPEED;
  return CLIP_WALK_SPEED;
}
