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
  type AnimationClip,
  type Object3D,
  type Scene,
} from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import type { World } from '../etat/monde';
import type { GameView } from '../reseau/vue';
import { createClipBlend, type ClipBlend } from '../rendu/melange';
import {
  bendThighs,
  seatPlacement,
  sitCalibration,
  thighsOf,
  type SeatPlacement,
  type SitCalibration,
} from '../rendu/assis';
import { seatAnchor } from '../etat/assises';
import { memberLook, type Anim } from './clients';
import type { ClienteleContent } from './donnees';
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
  readonly blend: ClipBlend;
  readonly clips: ReadonlySet<string>;
  /** Pose assise mesurée par clip (`sit`, `sit_drink`), et les cuisses à baisser. */
  readonly sit: ReadonlyMap<string, SitCalibration | null>;
  readonly thighs: readonly Object3D[];
}

const SIT_CLIPS = ['sit', 'sit_drink'] as const;

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

/**
 * Figurants des scènes, pris parmi les modèles livrés (aucun n'a le sien): le chauffeur en col
 * roulé, trois dames de la place, et les randonneurs des Godillots (neuf personnes) variés
 * membre par membre, Colette en tête (trench et sacoche).
 */
const EXTRA_MODEL = {
  driver: 'char_client_connaisseur',
  ladies: ['char_client_voisine', 'char_client_brunch', 'char_client_pressee'],
} as const;
const SCENE_CROWD: Readonly<Record<string, readonly string[]>> = {
  colette_godillots: [
    'char_client_pressee',
    'char_client_flaneur',
    'char_client_etudiante',
    'char_client_gourmand',
    'char_client_teletravail',
    'char_client_voisine',
    'char_client_connaisseur',
    'char_client_brunch',
  ],
};

/** Modèle du membre `k`: l'allure tirée par la simulation (variée), sinon celle du profil. */
function modelName(cc: ClienteleContent, g: CustomerGroup, k: number): string | null {
  const crowd = g.role === null ? undefined : SCENE_CROWD[g.role];
  const names = [
    g.regular === null ? null : `habitue-${g.regular}`,
    g.regular === null ? null : (REGULAR_MODEL[g.regular] ?? null),
    g.role === null ? null : `scene-${g.role}`,
    crowd === undefined || crowd.length === 0 ? null : (crowd[k % crowd.length] ?? null),
    g.look === '' ? null : memberLook(cc, g.profile, g.look, k),
    `client-${g.profile}`,
    PROFILE_MODEL[g.profile] ?? 'char_client_flaneur',
  ];
  for (const n of names) if (n !== null && urlOf(n) !== undefined) return n;
  return null;
}

/** Hauteur de l'assise occupée (m), `null` hors d'un meuble (zinc, fontaine, debout). */
const seatAt = { y: null as number | null };

/** Position et cap du membre `k` d'un groupe; `seated` vrai s'il est assis. */
function memberPose(
  world: World,
  view: GameView,
  g: CustomerGroup,
  k: number,
  nowMs: number,
  out: CustomerPose,
): boolean | null {
  seatAt.y = null;
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
    // Sur l'assise déclarée du meuble, tourné comme elle (face à sa table).
    const a = seatAnchor(view.content, world.furniture, f);
    out.x = a.x;
    out.z = a.z;
    out.yawDeg = a.yawDeg;
    seatAt.y = a.y;
    out.anim = 'sit_drink';
    return true;
  }
  if (!standingPose(world, g.id, nowMs, out)) return null;
  if (k > 0) {
    // Les autres membres suivent deux par deux, un rang derrière (`groupRows` de la file).
    const a = (out.yawDeg * Math.PI) / 180;
    const back = rules.queue.spacing * Math.ceil(k / 2);
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
    // Couleurs d'instance créées tout de suite et maillages cachés tant qu'aucun substitut ne
    // sert: un seul programme, et seulement si un modèle manque (budget de 12 programmes; un
    // `InstancedMesh` visible se compile même à zéro instance).
    m.setColorAt(0, new Color('#ffffff'));
    m.count = 0;
    m.visible = false;
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
  const placed: SeatPlacement = { x: 0, y: 0, z: 0, thigh: 0 };

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
    void p.then((src) => {
      if (src === null) missing.add(name);
    });
    return p;
  };
  /** Modèles illisibles: leurs personnages prennent le substitut. */
  const missing = new Set<string>();
  // Les personnages se chargent dès maintenant (écran de chargement), pas à l'entrée du premier
  // client: pas d'à-coup en service, pas de substitut le temps du chargement.
  for (const url of Object.keys(MODEL_URLS)) {
    const name = /\/(char_(?!avatar)[\w-]+)\.glb$/.exec(url)?.[1];
    if (name !== undefined) void load(name);
  }

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
      // Ajouté à la scène au premier `update` qui le place: jamais vu à l'origine ni sans clip.
      node.visible = false;
      const sit = new Map<string, SitCalibration | null>();
      for (const c of SIT_CLIPS)
        sit.set(
          c,
          sitCalibration(
            `${name}:${c}`,
            node,
            src.clips.find((x) => x.name === c),
          ),
        );
      const blend = createClipBlend(new AnimationMixer(node), src.clips, FADE);
      blend.update(0);
      root.add(node);
      figures.set(key, {
        node,
        blend,
        clips: new Set(src.clips.map((c) => c.name)),
        sit,
        thighs: thighsOf(node),
      });
    });
    return null;
  };

  const play = (f: Figure, anim: Anim): void => {
    f.blend.set(f.clips.has(anim) ? anim : anim === 'sit_drink' ? 'sit' : 'idle');
  };

  const seen = new Set<string>();
  return {
    update(view, nowMs, frameDt) {
      const world = view.world();
      let n = 0;
      seen.clear();
      for (const g of world.clientele.groups) {
        let color = colors.get(g.profile);
        if (color === undefined) {
          color = new Color(view.content.clientele.profiles.get(g.profile)?.color ?? '#888888');
          colors.set(g.profile, color);
        }
        for (let k = 0; k < g.size; k++) {
          const seated = memberPose(world, view, g, k, nowMs, pose);
          if (seated === null) continue;
          const key = `${String(g.id)}:${String(k)}`;
          const name = modelName(view.content.clientele, g, k);
          const fig = name === null ? null : figureFor(key, name);
          if (fig !== null) {
            seen.add(key);
            const rotY = (pose.yawDeg * Math.PI) / 180 + Math.PI;
            play(fig, pose.anim);
            const cal = seatAt.y === null ? null : (fig.sit.get(fig.blend.target()) ?? null);
            if (cal !== null && seatAt.y !== null) {
              seatPlacement(cal, pose.x, seatAt.y, pose.z, rotY, placed);
              fig.node.position.set(placed.x, placed.y, placed.z);
            } else fig.node.position.set(pose.x, 0, pose.z);
            fig.node.rotation.y = rotY;
            fig.node.visible = true;
            fig.blend.update(frameDt);
            if (cal !== null) bendThighs(fig.node, fig.thighs, placed.thigh);
            continue;
          }
          // Modèle en cours de chargement: rien plutôt qu'un substitut d'un instant.
          if (name !== null && !missing.has(name)) continue;
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
      // Figurants des scènes, vus de la vitrine: le chauffeur du car devant son car, face au
      // café; les trois dames qui traversent la place (l'une est Mamie Odile), d'ouest en est.
      const ev = world.clientele.event;
      const extra = (
        key: string,
        model: string,
        x: number,
        z: number,
        yawDeg: number,
        anim: Anim,
        color: Color,
      ): void => {
        const fig = figureFor(key, model);
        if (fig !== null) {
          seen.add(key);
          fig.node.position.set(x, 0, z);
          fig.node.rotation.y = (yawDeg * Math.PI) / 180 + Math.PI;
          fig.node.visible = true;
          play(fig, anim);
          fig.blend.update(frameDt);
          return;
        }
        if (!missing.has(model) || n >= MAX) return;
        q.setFromAxisAngle(up, (yawDeg * Math.PI) / 180);
        pos.set(x, 0, z);
        scale.set(1, 1, 1);
        m4.compose(pos, q, scale);
        bodies.setMatrixAt(n, m4);
        heads.setMatrixAt(n, m4);
        bodies.setColorAt(n, color);
        heads.setColorAt(n, skin);
        n++;
      };
      if (ev?.id === 'le_car_de_8h12')
        extra('extra:chauffeur', EXTRA_MODEL.driver, 7.2, 14.4, 0, 'idle', driverColor);
      if (ev?.id === 'jules_a_perdu_sa_mamie') {
        const [[ax, az], [bx, bz]] = view.content.clientele.rules.placeWalk;
        const yaw = (Math.atan2(-(bx - ax), -(bz - az)) * 180) / Math.PI;
        for (let i = 0; i < 3; i++) {
          const t = (nowMs / 24000 + i / 3) % 1;
          extra(
            `extra:dame-${String(i)}`,
            EXTRA_MODEL.ladies[i] ?? EXTRA_MODEL.driver,
            ax + (bx - ax) * t,
            az + (bz - az) * t,
            yaw,
            'walk',
            ladyColors[i] ?? driverColor,
          );
        }
      }
      bodies.count = n;
      bodies.visible = n > 0;
      heads.visible = n > 0;
      heads.count = n;
      bodies.instanceMatrix.needsUpdate = true;
      heads.instanceMatrix.needsUpdate = true;
      if (bodies.instanceColor !== null) bodies.instanceColor.needsUpdate = true;
      if (heads.instanceColor !== null) heads.instanceColor.needsUpdate = true;
      for (const [key, f] of figures) {
        if (seen.has(key)) continue;
        root.remove(f.node);
        f.blend.stop();
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
      for (const f of figures.values()) f.blend.stop();
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
