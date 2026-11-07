/**
 * Rendu des clients (chez l'hôte et l'invité): un personnage par membre de chaque groupe, debout
 * (position du canal 7, interpolée chez l'invité) ou assis à sa place (domaine clientèle).
 *
 * Modèles par nom (`assets/modeles/<nom>.glb`): `habitue-<id>` pour un habitué, `scene-<rôle>`
 * pour un invité de scène, sinon `client-<profil>`. Personnages riggés sur le squelette commun,
 * clips `walk`, `idle`, `sit`, `drink`, `sit_drink` (fondu de 0,25 s). Sans fichier: substitut
 * instancié (corps et tête, deux appels de dessin pour tous) à la couleur du profil.
 * Rien n'est alloué par image tant que la foule ne change pas.
 */
import {
  AnimationMixer,
  CapsuleGeometry,
  Color,
  Group,
  InstancedMesh,
  Matrix4,
  MeshLambertMaterial,
  Quaternion,
  SphereGeometry,
  Vector3,
  type AnimationAction,
  type AnimationClip,
  type Object3D,
  type Scene,
} from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import type { World } from '../etat/monde';
import type { GameView } from '../reseau/vue';
import type { Anim } from './clients';
import type { Group as CustomerGroup } from './etat';
import { standingPose, type CustomerPose } from './reseau';

const MODEL_URLS = import.meta.glob<string>('../../assets/modeles/*.glb', {
  query: '?url',
  import: 'default',
  eager: true,
});

const MAX = 64;
const SEAT_HEIGHT = 0.45;
const FADE = 0.25;

interface Loaded {
  readonly scene: Object3D;
  readonly clips: readonly AnimationClip[];
}

interface Figure {
  readonly node: Object3D;
  readonly mixer: AnimationMixer;
  readonly actions: Map<string, AnimationAction>;
  current: string;
}

export interface CustomerNodes {
  update(view: GameView, nowMs: number, frameDt: number): void;
  dispose(): void;
}

function urlOf(name: string): string | undefined {
  return MODEL_URLS[`../../assets/modeles/${name}.glb`];
}

/** Modèles livrés (`char_*`): un habitué a le sien, un profil prend le plus proche. */
const REGULAR_MODEL: Readonly<Record<string, string>> = {
  simone: 'char_simone',
  mathis: 'char_mathis',
  farida_noe: 'char_farida',
  lise: 'char_lise',
  bastien: 'char_bastien',
};
const PROFILE_MODEL: Readonly<Record<string, string>> = {
  presses: 'char_client_pressee',
  voisins: 'char_client_voisine',
  flaneurs: 'char_client_flaneur',
  familles: 'char_client_voisine',
  gourmands: 'char_client_gourmand',
  promeneurs: 'char_client_flaneur',
  etudiants: 'char_client_etudiante',
  teletravail: 'char_client_teletravail',
  brunch: 'char_client_brunch',
  connaisseurs: 'char_client_connaisseur',
};

function modelName(g: CustomerGroup): string | null {
  const names = [
    g.regular === null ? null : `habitue-${g.regular}`,
    g.regular === null ? null : (REGULAR_MODEL[g.regular] ?? null),
    g.role === null ? null : `scene-${g.role}`,
    `client-${g.profile}`,
    PROFILE_MODEL[g.profile] ?? 'char_client_flaneur',
  ];
  for (const n of names) if (n !== null && urlOf(n) !== undefined) return n;
  return null;
}

/** Position et cap du membre `k` d'un groupe; `seated` vrai s'il est assis. */
function memberPose(
  world: World,
  view: GameView,
  g: CustomerGroup,
  k: number,
  nowMs: number,
  out: CustomerPose,
): boolean | null {
  const rules = view.content.clientele.rules;
  if (g.stage === 'seated') {
    const id = g.seats[k] ?? g.seats[0];
    if (id === undefined) return null;
    if (id.startsWith('standing-') || id.startsWith('picnic-')) {
      const list = id.startsWith('standing-') ? rules.standingSpots : rules.picnicSpots;
      const p = list[Number(id.slice(id.indexOf('-') + 1))];
      if (p === undefined) return null;
      out.x = p[0];
      out.z = p[1];
      // Au zinc, on regarde le comptoir (nord); à la fontaine, la place (nord aussi).
      out.yawDeg = 0;
      out.anim = id.startsWith('picnic-') ? 'sit_drink' : 'drink';
      return id.startsWith('picnic-');
    }
    const f = world.furniture.find((x) => x.id === id);
    if (f === undefined) return null;
    out.x = f.x;
    out.z = f.z;
    out.yawDeg = (180 + f.rotDeg) % 360;
    out.anim = 'sit_drink';
    return true;
  }
  if (!standingPose(world, g.id, nowMs, out)) return null;
  if (k > 0) {
    // Les autres membres suivent, un peu en arrière et de côté.
    const a = (out.yawDeg * Math.PI) / 180;
    const back = 0.55 * Math.ceil(k / 2);
    const side = k % 2 === 1 ? 0.3 : -0.3;
    out.x += Math.sin(a) * back + Math.cos(a) * side;
    out.z += Math.cos(a) * back - Math.sin(a) * side;
  }
  return false;
}

export function createCustomerNodes(scene: Scene): CustomerNodes {
  const root = new Group();
  root.name = 'clients';
  scene.add(root);
  const body = new CapsuleGeometry(0.22, 0.9, 4, 10);
  body.translate(0, 0.67, 0);
  const head = new SphereGeometry(0.15, 12, 8);
  head.translate(0, 1.5, 0);
  const material = new MeshLambertMaterial({ color: '#ffffff' });
  const bodies = new InstancedMesh(body, material, MAX);
  const heads = new InstancedMesh(head, material, MAX);
  for (const m of [bodies, heads]) {
    m.count = 0;
    m.frustumCulled = false;
    root.add(m);
  }
  const skin = new Color('#e8c4a0');
  const driverColor = new Color('#3b5b8f');
  // Parapluie lilas, parapluie vert et cabas, parapluie lilas et cabas (scène de Jules).
  const ladyColors = [new Color('#b39ddb'), new Color('#6f9f6a'), new Color('#9c7fc4')];
  const colors = new Map<string, Color>();
  const m4 = new Matrix4();
  const q = new Quaternion();
  const pos = new Vector3();
  const scale = new Vector3(1, 1, 1);
  const up = new Vector3(0, 1, 0);
  const pose: CustomerPose = { x: 0, z: 0, yawDeg: 0, anim: 'idle' };

  const loader = new GLTFLoader();
  const loaded = new Map<string, Promise<Loaded | null>>();
  const figures = new Map<string, Figure>();
  let disposed = false;

  const load = (name: string): Promise<Loaded | null> => {
    let p = loaded.get(name);
    if (p !== undefined) return p;
    const url = urlOf(name);
    p =
      url === undefined
        ? Promise.resolve(null)
        : loader.loadAsync(url).then(
            (gltf) => ({ scene: gltf.scene, clips: gltf.animations }),
            () => null,
          );
    loaded.set(name, p);
    return p;
  };

  const pending = new Set<string>();
  const figureFor = (key: string, name: string): Figure | null => {
    const f = figures.get(key);
    if (f !== undefined) return f;
    if (pending.has(key)) return null;
    pending.add(key);
    void load(name).then((src) => {
      pending.delete(key);
      if (src === null || disposed) return;
      const node = cloneSkinned(src.scene);
      const mixer = new AnimationMixer(node);
      const actions = new Map<string, AnimationAction>();
      for (const clip of src.clips) actions.set(clip.name, mixer.clipAction(clip));
      root.add(node);
      figures.set(key, { node, mixer, actions, current: '' });
    });
    return null;
  };

  const play = (f: Figure, anim: Anim): void => {
    const want = f.actions.has(anim)
      ? anim
      : anim === 'sit_drink' && f.actions.has('sit')
        ? 'sit'
        : 'idle';
    if (f.current === want) return;
    const next = f.actions.get(want);
    const prev = f.actions.get(f.current);
    if (next !== undefined) {
      next.reset().fadeIn(FADE).play();
      prev?.fadeOut(FADE);
    }
    f.current = want;
  };

  const seen = new Set<string>();
  return {
    update(view, nowMs, frameDt) {
      const world = view.world();
      let n = 0;
      seen.clear();
      for (const g of world.clientele.groups) {
        const name = modelName(g);
        let color = colors.get(g.profile);
        if (color === undefined) {
          color = new Color(view.content.clientele.profiles.get(g.profile)?.color ?? '#888888');
          colors.set(g.profile, color);
        }
        for (let k = 0; k < g.size; k++) {
          const seated = memberPose(world, view, g, k, nowMs, pose);
          if (seated === null) continue;
          const key = `${String(g.id)}:${String(k)}`;
          const fig = name === null ? null : figureFor(key, name);
          if (fig !== null) {
            seen.add(key);
            fig.node.position.set(pose.x, 0, pose.z);
            fig.node.rotation.y = (pose.yawDeg * Math.PI) / 180 + Math.PI;
            play(fig, pose.anim);
            fig.mixer.update(frameDt);
            continue;
          }
          if (n >= MAX) continue;
          // Substitut: assis, le corps descend sur l'assise et se tasse.
          q.setFromAxisAngle(up, (pose.yawDeg * Math.PI) / 180);
          const bob = pose.anim === 'walk' ? Math.abs(Math.sin(nowMs / 160)) * 0.04 : 0;
          pos.set(pose.x, (seated ? SEAT_HEIGHT - 0.45 : 0) + bob, pose.z);
          scale.set(1, seated ? 0.8 : 1, 1);
          m4.compose(pos, q, scale);
          bodies.setMatrixAt(n, m4);
          heads.setMatrixAt(n, m4);
          bodies.setColorAt(n, color);
          heads.setColorAt(n, skin);
          n++;
        }
      }
      // Figurants des scènes, vus de la vitrine: le chauffeur du car, les dames de la place.
      const ev = world.clientele.event;
      const extras: [number, number, Color][] = [];
      if (ev?.id === 'le_car_de_8h12') extras.push([7.2, 14.4, driverColor]);
      if (ev?.id === 'jules_a_perdu_sa_mamie') {
        const [[ax, az], [bx, bz]] = view.content.clientele.rules.placeWalk;
        for (let i = 0; i < 3; i++) {
          const t = (nowMs / 24000 + i / 3) % 1;
          extras.push([ax + (bx - ax) * t, az + (bz - az) * t, ladyColors[i] ?? driverColor]);
        }
      }
      for (const [x, z, c] of extras) {
        if (n >= MAX) break;
        q.setFromAxisAngle(up, -Math.PI / 2);
        pos.set(x, 0, z);
        scale.set(1, 1, 1);
        m4.compose(pos, q, scale);
        bodies.setMatrixAt(n, m4);
        heads.setMatrixAt(n, m4);
        bodies.setColorAt(n, c);
        heads.setColorAt(n, skin);
        n++;
      }
      bodies.count = n;
      heads.count = n;
      bodies.instanceMatrix.needsUpdate = true;
      heads.instanceMatrix.needsUpdate = true;
      if (bodies.instanceColor !== null) bodies.instanceColor.needsUpdate = true;
      if (heads.instanceColor !== null) heads.instanceColor.needsUpdate = true;
      for (const [key, f] of figures) {
        if (seen.has(key)) continue;
        root.remove(f.node);
        f.mixer.stopAllAction();
        figures.delete(key);
      }
    },
    dispose() {
      disposed = true;
      scene.remove(root);
      body.dispose();
      head.dispose();
      material.dispose();
      bodies.dispose();
      heads.dispose();
      for (const f of figures.values()) f.mixer.stopAllAction();
      figures.clear();
      for (const p of loaded.values()) {
        void p.then((src) => {
          src?.scene.traverse((o) => {
            const mesh = o as {
              geometry?: { dispose(): void };
              material?: { dispose(): void } | { dispose(): void }[];
            };
            mesh.geometry?.dispose();
            const mats = Array.isArray(mesh.material)
              ? mesh.material
              : mesh.material === undefined
                ? []
                : [mesh.material];
            for (const m of mats) m.dispose();
          });
        });
      }
    },
  };
}
