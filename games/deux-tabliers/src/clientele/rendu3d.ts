/**
 * Rendu des clients (chez l'hôte et l'invité): un personnage par membre de chaque groupe, debout
 * (position du canal 7, interpolée chez l'invité) ou assis à sa place (domaine clientèle).
 *
 * Modèles par nom (`assets/modeles/<nom>.glb`): `habitue-<id>` pour un habitué, `scene-<rôle>`
 * pour un invité de scène, sinon `client-<profil>`. Personnages riggés sur le squelette commun,
 * clips `walk`, `idle`, `sit`, `drink`, `sit_drink` (fondu de 0,25 s). Assis, un client ne boit
 * que si sa boisson est servie (`gestes.ts`): sa tasse est devant lui sur la table et passe dans
 * sa main le temps de la gorgée; sinon il attend dans la pose droite (`sit_rest`) et tourne la
 * tête vers son voisin ou le comptoir. Sans fichier: substitut
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
  pinHips,
  reachTo,
  restClip,
  seatPlacement,
  SIT_REST,
  sitCalibration,
  thighsOf,
  turnHead,
  type SeatPlacement,
  type SitCalibration,
} from '../rendu/assis';
import { DRINK_VESSEL } from '../rendu/correspondances';
import { placeAnchor, placeFurniture, seatTable, type SeatAnchor } from '../etat/assises';
import { memberLook, type Anim } from './clients';
import { glanceWeight, memberDrink, sipTime } from './gestes';
import { queueLine } from './places';
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
  /** Pose assise mesurée par clip (`sit_rest`, `sit_drink`), et les cuisses à baisser. */
  readonly sit: ReadonlyMap<string, SitCalibration | null>;
  readonly thighs: readonly Object3D[];
  readonly neck: Object3D | undefined;
  readonly rightHand: Object3D | undefined;
  readonly leftHand: Object3D | undefined;
  /** Os du bassin, du bras droit et du visage (`headfront`): gorgée à la bouche (RV-05). */
  readonly hips: Object3D | undefined;
  readonly rightArm: Object3D | undefined;
  readonly rightForeArm: Object3D | undefined;
  readonly head: Object3D | undefined;
  readonly face: Object3D | undefined;
  /** Durée du clip `sit_drink` (s), 0 sans lui. */
  readonly drinkSec: number;
  /** Tasse ou verre de sa boisson (clone du modèle), créé à son premier service. */
  cup: { readonly model: string; readonly node: Object3D } | null;
}

const SIT_CLIPS = [SIT_REST, 'sit_drink'] as const;
/**
 * Gorgée tirée de `sit_drink` (11,2 s livrées): de 12 % (main droite devant, à hauteur de
 * poitrine) à 72 % (revenue au même point). Avant et après, le clip va chercher et reposer la
 * tasse loin sur le côté, hors de toute table: on n'en joue que le milieu.
 */
const SIP_FROM = 0.12;
const SIP_TO = 0.72;
/** Passage de la tasse de la table à la main (et retour), en secondes. */
const CUP_MOVE = 0.35;
/** Prise de la tasse dans la main: sous le poignet, un peu en avant (m). */
const GRIP_DOWN = 0.09;
const GRIP_AHEAD = 0.06;
/**
 * Bouche: au-dessus de `headfront` (devant le visage, à la hauteur de l'os `Head`, sous le
 * menton) dans le repère de la tête. Tasse à la gorgée: son bord près des lèvres, donc sa base
 * un peu devant et en dessous (m).
 */
const MOUTH_UP = 0.045;
const SIP_CUP_AHEAD = 0.05;
const SIP_CUP_BELOW = 0.07;

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

/**
 * Où se tient le membre placé par `memberPose`: sur la place d'un meuble (son point), assis au
 * sol (fontaine), debout au zinc, ou en marche.
 */
const seatAt = {
  kind: 'walk' as 'seat' | 'ground' | 'zinc' | 'walk',
  anchor: null as SeatAnchor | null,
};

/** Position et cap du membre `k` d'un groupe; `seated` vrai s'il est assis. */
function memberPose(
  world: World,
  view: GameView,
  g: CustomerGroup,
  k: number,
  nowMs: number,
  out: CustomerPose,
): boolean | null {
  seatAt.kind = 'walk';
  seatAt.anchor = null;
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
      seatAt.kind = id.startsWith('picnic-') ? 'ground' : 'zinc';
      out.anim = id.startsWith('picnic-') ? 'sit_drink' : 'drink';
      return id.startsWith('picnic-');
    }
    // Sur sa place du meuble (banquette, banc: chacun la sienne), tourné comme elle.
    const a = placeAnchor(view.content, world.furniture, id);
    if (a === null) return null;
    out.x = a.x;
    out.z = a.z;
    out.yawDeg = a.yawDeg;
    seatAt.kind = 'seat';
    seatAt.anchor = a;
    out.anim = 'sit';
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
      const rest = restClip(src.clips);
      const clips = rest === null ? src.clips : [...src.clips, rest];
      const sit = new Map<string, SitCalibration | null>();
      for (const c of SIT_CLIPS)
        sit.set(
          c,
          sitCalibration(
            `${name}:${c}`,
            node,
            clips.find((x) => x.name === c),
          ),
        );
      const blend = createClipBlend(new AnimationMixer(node), clips, FADE);
      blend.update(0);
      root.add(node);
      figures.set(key, {
        node,
        blend,
        clips: new Set(clips.map((c) => c.name)),
        sit,
        thighs: thighsOf(node),
        neck: node.getObjectByName('neck'),
        rightHand: node.getObjectByName('RightHand'),
        leftHand: node.getObjectByName('LeftHand'),
        hips: node.getObjectByName('Hips'),
        rightArm: node.getObjectByName('RightArm'),
        rightForeArm: node.getObjectByName('RightForeArm'),
        head: node.getObjectByName('Head'),
        face: node.getObjectByName('headfront'),
        drinkSec: src.clips.find((c) => c.name === 'sit_drink')?.duration ?? 0,
        cup: null,
      });
    });
    return null;
  };

  const play = (f: Figure, anim: Anim): void => {
    f.blend.set(f.clips.has(anim) ? anim : anim === 'sit_drink' ? 'sit' : 'idle');
  };

  const placedRest: SeatPlacement = { x: 0, y: 0, z: 0, thigh: 0 };
  const handAt = new Vector3();
  const mouthAt = new Vector3();
  const headQ = new Quaternion();
  const restAt = new Vector3();
  const cupPending = new Set<string>();

  /** Tasse de `drink`: sur la table (`table`), dans la main (`hand`), ou entre les deux (`h`). */
  const placeCup = (
    view: GameView,
    fig: Figure,
    drink: string | null,
    hand: Object3D | undefined,
    table: Vector3 | null,
    h: number,
    rotY: number,
  ): void => {
    const family = drink === null ? undefined : view.content.clientele.recipes.get(drink)?.family;
    const vessel = family === undefined ? undefined : DRINK_VESSEL[family];
    if (vessel === undefined) {
      if (fig.cup !== null) fig.cup.node.visible = false;
      return;
    }
    if (fig.cup?.model !== vessel) {
      if (fig.cup !== null) fig.cup.node.visible = false;
      if (cupPending.has(vessel + fig.node.uuid)) return;
      cupPending.add(vessel + fig.node.uuid);
      void load(vessel).then((src) => {
        cupPending.delete(vessel + fig.node.uuid);
        if (src === null || disposed || fig.cup?.model === vessel) return;
        if (fig.cup !== null) root.remove(fig.cup.node);
        const node = src.scene.clone();
        node.visible = false;
        root.add(node);
        fig.cup = { model: vessel, node };
      });
      return;
    }
    const cup = fig.cup.node;
    if (hand !== undefined && h > 0) {
      hand.getWorldPosition(handAt);
      handAt.y -= GRIP_DOWN;
      handAt.x += Math.sin(rotY) * GRIP_AHEAD;
      handAt.z += Math.cos(rotY) * GRIP_AHEAD;
    }
    if (table === null || (hand !== undefined && h >= 1)) {
      if (hand === undefined) {
        cup.visible = false;
        return;
      }
      cup.position.copy(handAt);
    } else if (hand === undefined || h <= 0) cup.position.copy(table);
    else cup.position.copy(table).lerp(handAt, h);
    cup.rotation.set(0, rotY, 0);
    cup.visible = true;
  };

  /** Client sur la place d'un meuble: pose calme ou gorgée, tête, tasse. */
  const seatedFigure = (
    view: GameView,
    fig: Figure,
    g: CustomerGroup,
    k: number,
    a: SeatAnchor,
    nowMs: number,
    frameDt: number,
    rotY: number,
  ): void => {
    const seating = view.content.settings.seating;
    const drink = memberDrink(view.content.clientele, g, k);
    const sipSec = fig.drinkSec * (SIP_TO - SIP_FROM);
    const sip =
      drink === null || sipSec <= 0 ? null : sipTime(seating, g.id, k, nowMs / 1000, sipSec);
    fig.blend.set(sip === null ? SIT_REST : 'sit_drink');
    if (sip !== null) fig.blend.seek('sit_drink', fig.drinkSec * SIP_FROM + sip);
    // Les deux poses n'ont pas le bassin au même endroit: on mêle les placements comme le
    // mélangeur mêle les clips, et les fesses restent sur l'assise pendant le fondu.
    const wd = fig.blend.weight('sit_drink');
    const cr = fig.sit.get(SIT_REST) ?? null;
    const cd = fig.sit.get('sit_drink') ?? null;
    if (cr !== null) seatPlacement(cr, a.x, a.y, a.z, rotY, placedRest);
    if (cd !== null) seatPlacement(cd, a.x, a.y, a.z, rotY, placed);
    const t = cr === null ? 1 : cd === null ? 0 : wd;
    if (cr !== null || cd !== null) {
      fig.node.position.set(
        placedRest.x + (placed.x - placedRest.x) * t,
        placedRest.y + (placed.y - placedRest.y) * t,
        placedRest.z + (placed.z - placedRest.z) * t,
      );
    } else fig.node.position.set(a.x, a.y - 0.45, a.z);
    fig.blend.update(frameDt);
    bendThighs(fig.node, fig.thighs, placedRest.thigh + (placed.thigh - placedRest.thigh) * t);
    // Bassin tenu sur l'assise pendant la gorgée (RV-05): mesure mêlée comme les placements.
    const hr = cr ?? cd;
    const hd = cd ?? cr;
    if (hr !== null && hd !== null)
      pinHips(
        fig.node,
        fig.hips,
        hr.hipX + (hd.hipX - hr.hipX) * t,
        hr.hipY + (hd.hipY - hr.hipY) * t,
        hr.hipZ + (hd.hipZ - hr.hipZ) * t,
      );
    // En attendant (ou entre deux gorgées), un regard vers le voisin, sinon vers le comptoir.
    const w = glanceWeight(seating, g.id, k, nowMs / 1000) * (1 - wd);
    if (w <= 0.01) turnHead(fig.neck, 0);
    else {
      const other = k % 2 === 0 ? k + 1 : k - 1;
      const id = other < g.size ? g.seats[other] : undefined;
      const n = id === undefined ? null : placeAnchor(view.content, view.world().furniture, id);
      const target = n ?? queueLine(view.content).register;
      const dx = target.x - a.x;
      const dz = target.z - a.z;
      const angle = Math.atan2(a.fz * dx - a.fx * dz, a.fx * dx + a.fz * dz);
      const max = (seating.glanceMaxDeg * Math.PI) / 180;
      turnHead(fig.neck, Math.max(-max, Math.min(max, angle)) * w);
    }
    // Tasse sur la table devant lui, dans sa main pendant la gorgée (montée et descente douces).
    const table = cupSpot(view, g.seats[k], a);
    let h = 0;
    if (sip !== null) {
      const edge = Math.min(1, Math.min(sip, sipSec - sip) / CUP_MOVE);
      h = edge * edge * (3 - 2 * edge);
    }
    // La main porte la tasse à la bouche (le clip la monte au front chez certains modèles).
    if (sip !== null && fig.face !== undefined && fig.head !== undefined) {
      fig.head.getWorldQuaternion(headQ);
      fig.face.getWorldPosition(mouthAt);
      handAt.set(0, MOUTH_UP, 0).applyQuaternion(headQ);
      mouthAt.add(handAt);
      // Main voulue: la base de la tasse devant et sous les lèvres, plus la prise (voir placeCup).
      mouthAt.x += Math.sin(rotY) * (SIP_CUP_AHEAD - GRIP_AHEAD);
      mouthAt.z += Math.cos(rotY) * (SIP_CUP_AHEAD - GRIP_AHEAD);
      mouthAt.y += GRIP_DOWN - SIP_CUP_BELOW;
      reachTo(fig.rightArm, fig.rightForeArm, fig.rightHand, mouthAt, h);
    } else reachTo(fig.rightArm, fig.rightForeArm, fig.rightHand, mouthAt, 0);
    placeCup(view, fig, drink, fig.rightHand, table, table === null ? 1 : h, rotY);
  };

  /**
   * Place de la tasse sur la table: à 12 cm du bord devant le client, un peu à sa droite (la
   * main qui boit), gardée sur le plateau. `null` sans table à portée.
   */
  const cupSpot = (view: GameView, place: string | undefined, a: SeatAnchor): Vector3 | null => {
    if (place === undefined) return null;
    const world = view.world();
    const id = placeFurniture(place);
    const f = world.furniture.find((x) => x.id === id);
    const t = f === undefined ? null : seatTable(view.content, world.furniture, f);
    const type = t === null ? undefined : view.content.furniture.get(t.type);
    if (t === null || type === undefined) return null;
    const along = (t.x - a.x) * a.fx + (t.z - a.z) * a.fz;
    const half = Math.min(type.footprint[0], type.footprint[1]) / 2;
    const reach = Math.max(0.05, along - half + 0.12);
    let sx = a.x + a.fx * reach - a.fz * 0.1;
    let sz = a.z + a.fz * reach + a.fx * 0.1;
    // Gardée sur le plateau (repère de la table, à 6 cm du bord).
    const r = (t.rotDeg * Math.PI) / 180;
    const dx = sx - t.x;
    const dz = sz - t.z;
    const mx = type.footprint[0] / 2 - 0.06;
    const mz = type.footprint[1] / 2 - 0.06;
    const lx = Math.max(-mx, Math.min(mx, dx * Math.cos(r) - dz * Math.sin(r)));
    const lz = Math.max(-mz, Math.min(mz, dx * Math.sin(r) + dz * Math.cos(r)));
    sx = t.x + lx * Math.cos(r) + lz * Math.sin(r);
    sz = t.z - lx * Math.sin(r) + lz * Math.cos(r);
    return restAt.set(sx, t.y + type.height, sz);
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
            fig.node.rotation.y = rotY;
            fig.node.visible = true;
            const anchor = seatAt.anchor;
            if (seatAt.kind === 'seat' && anchor !== null) {
              seatedFigure(view, fig, g, k, anchor, nowMs, frameDt, rotY);
              continue;
            }
            // Au zinc ou à la fontaine: le geste de boire seulement avec sa boisson en main.
            const drink = seatAt.kind === 'walk' ? null : memberDrink(view.content.clientele, g, k);
            const anim: Anim =
              seatAt.kind === 'walk' || drink !== null
                ? pose.anim
                : seatAt.kind === 'ground'
                  ? 'sit'
                  : 'idle';
            if (anim === 'sit') fig.blend.set(SIT_REST);
            else play(fig, anim);
            fig.node.position.set(pose.x, 0, pose.z);
            fig.blend.update(frameDt);
            const hand = seatAt.kind === 'zinc' ? fig.leftHand : fig.rightHand;
            placeCup(view, fig, drink, hand, null, 1, rotY);
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
        if (f.cup !== null) root.remove(f.cup.node);
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
