/**
 * La vie de la ferme: les poules (animées par `AnimationMixer`, picorent,
 * marchent), les objets posés au sol (œufs, boîte en fer, piles tombées) et la
 * poutre portée à deux.
 */
import {
  AnimationMixer,
  Group,
  Matrix4,
  Quaternion,
  SkinnedMesh,
  Sphere,
  Vector3,
  type AnimationAction,
  type AnimationClip,
  type Object3D,
} from 'three';
import type { Content } from '../donnees/types';
import type { GameMap } from '../etat/carte';
import type { Vec2 } from '../etat/types';
import { smoothFactor } from './camera';
import {
  dampAngle,
  interpolate,
  setStandingBox,
  yawFromFacing,
  yawFromQuarter,
  type FrameContext,
  type PickRegistry,
  type PickTarget,
} from './contexte';
import { InstancedBatches } from './lots';
import type { SharedMaterials } from './materiaux';
import { textHash, type ModelLibrary } from './modeles';
import type { EventfulPart } from './monde';
import { castsVisibleShadow } from './ombre-tri';
import { RENDER_SETTINGS } from './reglages';
import type { ResourceTracker } from './ressources';
import type { Terrain } from './terrain';

const FARM_FILE = 'ferme.glb';
const HEN_RIG = 'hen';
const HEN_MOVING = 0.02;
const HEN_PECK_EVERY = 5;
const HEN_PECK_SHARE = 0.45;
const HEN_TURN_HALF_LIFE = 0.12;
const GROUND_ITEM_CAPACITY = 24;
const ITEM_BOB = 0.03;
const ITEM_BOB_SPEED = 2.2;
const ITEM_PICK_RADIUS = 0.35;
const ITEM_PICK_HEIGHT = 0.5;
const BEAM_GROUND_HEIGHT = 0.12;
const DEFAULT_CARRY_HEIGHT = 1.6;
const HEN_RADIUS = 0.3;
const ROOSTER_VARIANT = 'hen_rooster';
const CHICK_VARIANT = 'hen_chick';
/** Échelle du poussin si la robe n'a pas d'extra `scale` (0,12 m pour une poule de 0,3 m). */
const CHICK_SCALE = 0.4;
/**
 * Cueillettes posées sur leur hôte (tour 8: les mûres sur le roncier; tour 9: les grappes sur le
 * sureau, les noisettes sous le noisetier): nœud de l'hôte et champ de ses points de pose. Une
 * cueillette se cale sur l'hôte le plus proche à moins de `HOST_REACH` m, avec le lacet de l'hôte
 * (les grappes sont sur sa face sud), jamais au hasard.
 */
const POSED_ON: Readonly<Record<string, { host: string; spots: string }>> = {
  blackberry: { host: 'bramble', spots: 'berry_spots' },
  elderberry: { host: 'bush_elder', spots: 'berry_spots' },
  hazelnut: { host: 'bush_hazel', spots: 'nut_spots' },
};
const HOST_REACH = 1.6;
/**
 * Cage de la poule livrée par le train (tour 9, section 2.5), devant le poulailler, à côté de sa
 * porte (pas devant: on y passe), porte coulissante tournée vers le sud (le chemin). Le point où la
 * simulation pose la poule (`deliverHen`: poulailler + (0,6 ; 0,9)) tombe dans la clôture
 * `fence_15`: la cage n'y est pas posée, la poule y est dessinée tant qu'elle attend son nom.
 */
const CRATE_MODEL = 'hen_crate';
const COOP_POINT = 'chicken_coop';
const CRATE_OFFSET = { x: -1.2, y: 0.7 };
const CRATE_YAW = 0;

interface HenView {
  root: Group;
  mixer: AnimationMixer | null;
  actions: Map<string, AnimationAction>;
  current: string;
  facing: number | null;
  phase: number;
}

export class FarmLifePart implements EventfulPart {
  readonly group = new Group();
  private readonly hens = new Map<string, HenView>();
  /** Vues du coq et des poussines (0.12), rangées avec celles des poules. */
  private readonly fowlIds = new Set<string>();
  private readonly fowlSeen = new Set<string>();
  private readonly clips = new Map<string, AnimationClip>();
  private readonly items: InstancedBatches;
  private readonly itemPicks = new Map<string, PickTarget>();
  private beam: Object3D | null = null;
  private beamModel = '';
  private readonly matrix = new Matrix4();
  private readonly quaternion = new Quaternion();
  private readonly up = new Vector3(0, 1, 0);
  private readonly unit = new Vector3(1, 1, 1);
  private readonly position = new Vector3();
  private readonly point = { x: 0, y: 0 };
  /** Point de livraison des poules commandées (tour 9, comme `deliverHen`), `null` sans poulailler. */
  private readonly cratePoint: Vec2 | null;
  private crate: Object3D | null = null;
  /** Points de pose des cueillettes sur leurs hôtes de la carte, en coordonnées du monde. */
  private readonly hostSpots: HostSpots[];

  constructor(
    private readonly library: ModelLibrary,
    materials: SharedMaterials,
    private readonly terrain: Terrain,
    resources: ResourceTracker,
    private readonly picks: PickRegistry,
    private readonly content: Content,
    map: GameMap | null = null,
  ) {
    this.group.name = 'ferme';
    this.hostSpots = map === null ? [] : hostsOf(map, library, terrain);
    const coop = map?.points[COOP_POINT];
    this.cratePoint = coop === undefined ? null : { x: coop.x + CRATE_OFFSET.x, y: coop.y + CRATE_OFFSET.y };
    for (const clip of library.animations(FARM_FILE)) {
      this.clips.set(clip.name, clip);
    }
    this.items = new InstancedBatches(
      'objets au sol',
      library,
      materials,
      resources,
      GROUND_ITEM_CAPACITY,
    );
    this.group.add(this.items.group);
  }

  private createHen(id: string, variant: string): HenView {
    const root = new Group();
    // 0.12: une couleur sans maillage dans le modèle (dorée, cendrée, coucou) prend son substitut;
    // sinon `cloneRig` rendrait un squelette seul, invisible.
    const rigged = this.library.node(variant) === null ? null : this.library.cloneRig(HEN_RIG, [variant]);
    const model = rigged ?? this.library.instantiate(variant);
    model.traverse((object) => {
      object.castShadow = castsVisibleShadow(object.name);
      if (object instanceof SkinnedMesh) {
        object.boundingSphere = new Sphere(new Vector3(0, HEN_RADIUS, 0), HEN_RADIUS * 2);
      }
    });
    root.add(model);
    this.group.add(root);
    const mixer = this.clips.size > 0 ? new AnimationMixer(model) : null;
    return {
      root,
      mixer,
      actions: new Map(),
      current: '',
      facing: null,
      phase: (textHash(id) % 100) / 100,
    };
  }

  /** Échelle de la racine du poussin: l'extra `scale` de sa robe, sinon 0,4. */
  private chickScale(): number {
    const extra = this.library.extras(CHICK_VARIANT).scale;
    return typeof extra === 'number' && extra > 0 ? extra : CHICK_SCALE;
  }

  private play(hen: HenView, name: string): void {
    const clip = this.clips.get(name);
    if (hen.mixer === null || clip === undefined || hen.current === name) {
      return;
    }
    let action = hen.actions.get(name);
    if (action === undefined) {
      action = hen.mixer.clipAction(clip);
      hen.actions.set(name, action);
    }
    action.reset().fadeIn(RENDER_SETTINGS.characters.crossFadeSeconds).play();
    hen.actions.get(hen.current)?.fadeOut(RENDER_SETTINGS.characters.crossFadeSeconds);
    hen.current = name;
  }

  update(context: FrameContext): void {
    const world = context.world;
    let anyCrated = false;
    for (const hen of world.hens) {
      let view = this.hens.get(hen.id);
      if (view === undefined) {
        view = this.createHen(hen.id, hen.variant);
        this.hens.set(hen.id, view);
      }
      // Tour 9: la poule commandée attend dans sa cage devant le poulailler que Jeanne la nomme.
      const crated = this.cratePoint !== null && hen.arrivedDay === world.clock.day && hen.nameKnownBy.length === 0;
      const at = crated ? this.cratePoint : interpolate(hen.prev, hen.pos, context.alpha, this.point);
      if (crated) anyCrated = true;
      view.root.position.set(at.x, this.terrain.heightAt(at.x, at.y), at.y);
      const yaw = crated ? CRATE_YAW : yawFromFacing(hen.facing);
      view.facing =
        view.facing === null
          ? yaw
          : dampAngle(view.facing, yaw, smoothFactor(context.dt, HEN_TURN_HALF_LIFE));
      view.root.rotation.y = view.facing;
      const moving =
        !crated && Math.hypot(hen.pos.x - hen.prev.x, hen.pos.y - hen.prev.y) > HEN_MOVING * context.dt;
      const cycle = (context.time / HEN_PECK_EVERY + view.phase) % 1;
      this.play(view, moving ? 'hen_walk' : cycle < HEN_PECK_SHARE ? 'hen_peck' : 'hen_idle');
      view.mixer?.update(context.dt);
    }

    // 0.12: le coq et les poussines, sur le squelette des poules (robes `hen_rooster`, `hen_chick`;
    // le poussin a sa racine à l'échelle 0,4, extra `scale` de sa robe).
    const b = world.breeding;
    const fowl = b.rooster === null ? b.chicks : [...b.chicks, b.rooster];
    const fowlSeen = this.fowlSeen;
    fowlSeen.clear();
    for (const f of fowl) {
      const chick = f !== b.rooster;
      const variant = chick ? CHICK_VARIANT : ROOSTER_VARIANT;
      fowlSeen.add(f.id);
      let view = this.hens.get(f.id);
      if (view === undefined) {
        view = this.createHen(f.id, variant);
        if (chick) view.root.scale.setScalar(this.chickScale());
        this.hens.set(f.id, view);
        this.fowlIds.add(f.id);
      }
      view.root.visible = true;
      const at = interpolate(f.prev, f.pos, context.alpha, this.point);
      view.root.position.set(at.x, this.terrain.heightAt(at.x, at.y), at.y);
      const yaw = yawFromFacing(f.facing);
      view.facing = view.facing === null ? yaw : dampAngle(view.facing, yaw, smoothFactor(context.dt, HEN_TURN_HALF_LIFE));
      view.root.rotation.y = view.facing;
      const moving = Math.hypot(f.pos.x - f.prev.x, f.pos.y - f.prev.y) > HEN_MOVING * context.dt;
      const cycle = (context.time / HEN_PECK_EVERY + view.phase) % 1;
      this.play(view, moving ? 'hen_walk' : cycle < HEN_PECK_SHARE ? 'hen_peck' : 'hen_idle');
      view.mixer?.update(context.dt);
    }
    // Une poussine devenue poule garde son identifiant: sa vue de poussin cède la place à une vue de poule.
    for (const id of this.fowlIds) {
      if (fowlSeen.has(id)) continue;
      const view = this.hens.get(id);
      view?.root.removeFromParent();
      view?.mixer?.stopAllAction();
      this.hens.delete(id);
      this.fowlIds.delete(id);
    }

    this.updateCrate(anyCrated);
    this.items.begin();
    const seen = new Set<string>();
    for (const item of world.groundItems) {
      seen.add(item.id);
      const def = this.content.items[item.item];
      const model = def?.model ?? item.item;
      let ground = this.terrain.heightAt(item.pos.x, item.pos.y);
      // Une cueillette de la lisière pousse là: posée, sans flotter; les mûres sur leur roncier.
      const grown = def?.category === 'forage';
      const bob =
        context.reducedMotion || grown
          ? 0
          : (Math.sin(context.time * ITEM_BOB_SPEED + textHash(item.id)) + 1) * ITEM_BOB;
      const host = POSED_ON[item.item];
      const posed = host === undefined ? null : this.hostSpot(host.host, item.id, item.pos);
      if (posed === null) {
        this.quaternion.setFromAxisAngle(this.up, textHash(item.id));
        this.position.set(item.pos.x, ground + bob, item.pos.y);
      } else {
        this.quaternion.setFromAxisAngle(this.up, posed.yaw);
        this.position.copy(posed.spot);
        ground = posed.spot.y;
      }
      this.items.add(model, this.matrix.compose(this.position, this.quaternion, this.unit));
      let pick = this.itemPicks.get(item.id);
      if (pick === undefined) {
        pick = this.picks.add({ kind: 'ground_item', groundItem: item.id });
        this.itemPicks.set(item.id, pick);
      }
      setStandingBox(
        pick.box,
        this.position.x,
        ground,
        this.position.z,
        ITEM_PICK_RADIUS,
        ITEM_PICK_HEIGHT,
      );
      pick.enabled = true;
    }
    this.items.end();
    for (const [id, pick] of this.itemPicks) {
      if (!seen.has(id)) {
        this.picks.remove(pick);
        this.itemPicks.delete(id);
      }
    }

    const beam = world.beam;
    if (beam === null) {
      if (this.beam !== null) {
        this.beam.visible = false;
      }
      return;
    }
    // Ce qu'on porte à deux: la poutre, la draisine, le gros colis (`beam.item`, un modèle chacun).
    const model = this.content.items[beam.item]?.model ?? beam.item;
    if (this.beam === null || this.beamModel !== model) {
      this.beam?.removeFromParent();
      this.beam = this.library.instantiate(model);
      this.beamModel = model;
      this.beam.traverse((object) => {
        object.castShadow = true;
      });
      this.group.add(this.beam);
    }
    const carryHeight = this.library.extras(model).carry_height;
    const at = interpolate(beam.prev, beam.pos, context.alpha, this.point);
    // La draisine roule sur ses rails: elle reste au sol, portée ou non.
    const lift =
      beam.purpose === 'handcar'
        ? 0
        : beam.carried
          ? typeof carryHeight === 'number'
            ? carryHeight
            : DEFAULT_CARRY_HEIGHT
          : BEAM_GROUND_HEIGHT;
    this.beam.visible = true;
    this.beam.position.set(at.x, this.terrain.heightAt(at.x, at.y) + lift, at.y);
    this.beam.rotation.y = yawFromFacing(beam.facing);
  }

  /** Cage de transport (`hen_crate`), créée à la première poule livrée, posée au point de livraison. */
  private updateCrate(shown: boolean): void {
    if (this.crate === null && shown && this.cratePoint !== null) {
      this.crate = this.library.instantiate(CRATE_MODEL);
      this.crate.traverse((object) => {
        object.castShadow = true;
        object.receiveShadow = true;
      });
      const p = this.cratePoint;
      this.crate.position.set(p.x, this.terrain.heightAt(p.x, p.y), p.y);
      this.crate.rotation.y = CRATE_YAW;
      this.group.add(this.crate);
    }
    if (this.crate !== null) this.crate.visible = shown;
  }

  /** Le point de l'hôte voisin où se pose cette cueillette (choisi par son identifiant), ou `null`. */
  private hostSpot(model: string, id: string, at: Readonly<Vec2>): { spot: Readonly<Vector3>; yaw: number } | null {
    let best: HostSpots | null = null;
    let bestD = HOST_REACH;
    for (const host of this.hostSpots) {
      if (host.model !== model) continue;
      const d = Math.hypot(host.x - at.x, host.y - at.y);
      if (d <= bestD) {
        best = host;
        bestD = d;
      }
    }
    if (best === null || best.spots.length === 0) {
      return null;
    }
    const spot = best.spots[textHash(id) % best.spots.length];
    return spot === undefined ? null : { spot, yaw: best.yaw };
  }

  dispose(): void {
    for (const hen of this.hens.values()) {
      hen.mixer?.stopAllAction();
    }
    this.hens.clear();
    for (const pick of this.itemPicks.values()) {
      this.picks.remove(pick);
    }
    this.itemPicks.clear();
    this.group.removeFromParent();
  }
}

interface HostSpots {
  /** Nœud de l'hôte dessiné (variante résolue: un `bush` peut être un noisetier). */
  model: string;
  x: number;
  y: number;
  yaw: number;
  spots: Vector3[];
}

/** Points de pose (`[x, hauteur, z]` du repère glTF) d'un champ des extras, vide s'il manque. */
function spotsOf(raw: unknown): [number, number, number][] {
  const local: [number, number, number][] = [];
  if (Array.isArray(raw)) {
    for (const p of raw as unknown[]) {
      const [x, h, z] = Array.isArray(p) ? (p as unknown[]) : [];
      if (typeof x === 'number' && typeof h === 'number' && typeof z === 'number') {
        local.push([x, h, z]);
      }
    }
  }
  return local;
}

/**
 * Les hôtes de la carte (roncier, sureau, noisetier) et leurs points de pose (`berry_spots`,
 * `nut_spots`: x, hauteur, z vers l'avant), tournés et posés comme le décor (`propMatrix`). Un hôte
 * sans points (substitut) n'en donne aucun: la cueillette reste là où la simulation l'a posée.
 */
function hostsOf(map: GameMap, library: ModelLibrary, terrain: Terrain): HostSpots[] {
  const fields = new Map<string, string>();
  for (const posed of Object.values(POSED_ON)) fields.set(posed.host, posed.spots);
  const out: HostSpots[] = [];
  for (const prop of map.props) {
    const model = library.resolve(prop.model, prop.id);
    const field = fields.get(model);
    if (field === undefined) continue;
    const local = spotsOf(library.node(model)?.userData[field]);
    if (local.length === 0) continue;
    const yaw = yawFromQuarter(prop.rotation);
    const cos = Math.cos(yaw);
    const sin = Math.sin(yaw);
    const ground = terrain.heightAt(prop.pos.x, prop.pos.y);
    out.push({
      model,
      x: prop.pos.x,
      y: prop.pos.y,
      yaw,
      spots: local.map(
        ([x, h, z]) => new Vector3(prop.pos.x + x * cos + z * sin, ground + h, prop.pos.y - x * sin + z * cos),
      ),
    });
  }
  return out;
}
