/**
 * Ce qui bouge dans la scène: meubles posés, objets mobiles, avatar de l'autre joueur, objet
 * tenu par le joueur local. Synchronisé à chaque image depuis la `GameView`, sans allouer
 * tant que rien ne change. Les meubles passeront en `BatchedMesh` (technique 3.3) quand les
 * modèles définitifs arriveront.
 */
import {
  AnimationMixer,
  BoxGeometry,
  CapsuleGeometry,
  Color,
  DataTexture,
  Group,
  Mesh,
  MeshLambertMaterial,
  MeshStandardMaterial,
  SRGBColorSpace,
  type Material,
  type Object3D,
  type Scene,
} from 'three';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import type { PlacedFurniture, PlayerIndex } from '../etat/monde';
import type { GameView } from '../reseau/vue';
import { objectPosition } from '../simulation/monde';
import {
  AVATAR_MODEL,
  CARTON_MODEL,
  FURNITURE_MODEL,
  MODEL_TURN_DEG,
  OBJECT_MODEL,
  RAIL_TICKETS,
} from './correspondances';
import { createClipBlend, type ClipBlend } from './melange';
import { placeAnchor } from '../etat/assises';
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
import type { ModelLibrary } from './modeles';
import { memberDrink } from '../clientele/gestes';
import { createHighlight } from './surlignage';

interface FurnitureNode {
  readonly node: Group;
  key: string;
}

// Un meuble qui ne change que de place (porté à deux, déplacé) garde son nœud: on le bouge.
const furnitureKey = (f: PlacedFurniture): string => f.type;

export interface WorldNodes {
  update(view: GameView, localLook: { yawDeg: number; pitchDeg: number }): void;
  dispose(): void;
}

export function createWorldNodes(
  scene: Scene,
  models: ModelLibrary,
  colors: readonly [string, string],
): WorldNodes {
  const root = new Group();
  root.name = 'monde';
  scene.add(root);
  const furniture = new Map<string, FurnitureNode>();
  const highlight = createHighlight(scene, (id) => furniture.get(id)?.node);
  const objects = new Map<number, { node: Group; type: string }>();
  /** Tasses et verres servis que tient le client assis (`clientele/rendu3d.ts`): pas en double. */
  const inHands = new Set<number>();
  const HELD_VESSELS: ReadonlySet<string> = new Set([
    'ware_cup_espresso',
    'ware_cup_cappuccino',
    'ware_glass',
  ]);

  /**
   * RV-04: une tasse par boisson servie. Le geste du client (sur la table, puis dans sa main)
   * dessine sa boisson; la tasse posée par le passe sur la table du groupe ne se montre donc pas
   * tant qu'il est assis. Elle reparaît, sale, quand il s'en va.
   */
  const markHeldCups = (view: GameView): void => {
    inHands.clear();
    const world = view.world();
    for (const g of world.clientele.groups) {
      if (g.stage !== 'seated' || g.servedAt === null || g.table === null) continue;
      let drinks = 0;
      for (let k = 0; k < g.size; k++)
        if (memberDrink(view.content.clientele, g, k) !== null) drinks++;
      for (const o of world.objects) {
        if (drinks <= 0) break;
        if (o.at.kind !== 'slot' || o.at.furniture !== g.table) continue;
        if (!HELD_VESSELS.has(OBJECT_MODEL[o.type] ?? '')) continue;
        inHands.add(o.id);
        drinks--;
      }
    }
  };

  // Avatars: une capsule à la couleur du joueur et un repère du regard.
  const body = new CapsuleGeometry(0.25, 1.1, 4, 12);
  body.translate(0, 0.8, 0);
  const visor = new BoxGeometry(0.22, 0.08, 0.12);
  visor.translate(0, 1.55, -0.22);
  const avatarMaterials = colors.map((c) => new MeshLambertMaterial({ color: c }));
  const visorMaterial = new MeshLambertMaterial({ color: '#2b2b2b' });
  const avatars = ([0, 1] as const).map((i) => {
    const g = new Group();
    g.add(new Mesh(body, avatarMaterials[i]), new Mesh(visor, visorMaterial));
    root.add(g);
    return g;
  });
  // Avatars livrés (`char_avatar_*`): marche et attente, badge teinté à la couleur du joueur.
  // `still`: secondes sans bouger; on ne repasse à l'attente qu'après un court délai, car la pose
  // de l'autre n'avance qu'à l'arrivée des états (une image sur deux ou trois sans déplacement).
  const rigs: ({
    blend: ClipBlend;
    still: number;
    sit: SitCalibration | null;
    thighs: readonly Object3D[];
    node: Object3D;
  } | null)[] = [null, null];
  const placed: SeatPlacement = { x: 0, y: 0, z: 0, thigh: 0 };
  const owned: Material[] = [];
  const white = new DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
  white.colorSpace = SRGBColorSpace;
  white.needsUpdate = true;
  let disposed = false;
  for (const i of [0, 1] as const) {
    void models.gltf(AVATAR_MODEL[i]).then((src) => {
      const holder = avatars[i];
      if (src === null || disposed || holder === undefined) return;
      const node = cloneSkinned(src.scene);
      // Badge teinté: copie du matériau du corps (texture blanche), pour garder le programme des
      // personnages au lieu d'en compiler un de plus (budget de 12 programmes).
      let bodyMaterial: MeshStandardMaterial | null = null;
      node.traverse((child) => {
        const m = child instanceof Mesh ? (child.material as Material) : null;
        if (m instanceof MeshStandardMaterial && m.map !== null) bodyMaterial ??= m;
      });
      node.traverse((child) => {
        if (!(child instanceof Mesh)) return;
        const m = child.material as Material;
        if (m.name !== 'dt_badge_joueur') return;
        const base: MeshStandardMaterial | null = bodyMaterial;
        const tinted = base === null ? new MeshStandardMaterial() : base.clone();
        tinted.name = m.name;
        tinted.map = base === null ? null : white;
        tinted.color = new Color(colors[i]);
        tinted.roughness = 0.4;
        tinted.metalness = 0;
        owned.push(tinted);
        child.material = tinted;
      });
      // Pose assise mesurée avant de poser le personnage (à l'origine, sans rotation).
      // Pose droite tenue (`sit_rest`): le clip `sit` livré se penche tête vers la table.
      const rest = restClip(src.clips);
      const clips = rest === null ? src.clips : [...src.clips, rest];
      const sit = sitCalibration(`${AVATAR_MODEL[i]}:${SIT_REST}`, node, rest ?? undefined);
      holder.clear();
      holder.add(node);
      const blend = createClipBlend(new AnimationMixer(node), clips, 0.2);
      blend.update(0);
      rigs[i] = { blend, still: 0, sit, thighs: thighsOf(node), node };
    });
  }
  const last = [
    { x: 0, z: 0 },
    { x: 0, z: 0 },
  ];
  let lastTime = performance.now();

  const syncFurniture = (view: GameView): void => {
    const world = view.world();
    const seen = new Set<string>();
    for (const f of world.furniture) {
      seen.add(f.id);
      const key = furnitureKey(f);
      let entry = furniture.get(f.id);
      if (entry !== undefined && entry.key !== key) {
        root.remove(entry.node);
        entry = undefined;
      }
      if (entry === undefined) {
        const type = view.content.furniture.get(f.type);
        if (type === undefined) continue;
        // Meuble de départ reconnu par l'aménagement: son modèle du catalogue (chaise paillée...).
        const mapped = FURNITURE_MODEL[f.type];
        const model = mapped ?? view.content.arrangement.pieces.get(f.type)?.model ?? type.model;
        const node =
          mapped === null
            ? new Group()
            : models.instance(
                model,
                {
                  width: type.footprint[0],
                  depth: type.footprint[1],
                  height: type.height,
                  color: type.color,
                },
                model === undefined ? 0 : (MODEL_TURN_DEG[model] ?? 0),
              );
        node.name = f.id;
        root.add(node);
        entry = { node, key };
        furniture.set(f.id, entry);
      }
      entry.node.position.set(f.x, f.y, f.z);
      entry.node.rotation.y = (f.rotDeg * Math.PI) / 180;
      if (view.content.furniture.get(f.type)?.station === 'rail') {
        const shown = Math.min(RAIL_TICKETS, world.service.tickets.length);
        for (let i = 0; i < RAIL_TICKETS; i++) {
          const ticket = entry.node.getObjectByName(`ticket_${i}`);
          if (ticket !== undefined) ticket.visible = i < shown;
        }
      }
    }
    for (const [id, entry] of furniture) {
      if (!seen.has(id)) {
        root.remove(entry.node);
        furniture.delete(id);
      }
    }
  };

  const syncObjects = (view: GameView, look: { yawDeg: number; pitchDeg: number }): void => {
    const world = view.world();
    markHeldCups(view);
    for (const o of world.objects) {
      let entry = objects.get(o.id);
      if (entry !== undefined && entry.type !== o.type) {
        root.remove(entry.node);
        entry = undefined;
      }
      if (entry === undefined) {
        const type = view.content.objects.get(o.type);
        if (type === undefined) continue;
        // Carton livré: celui de son ingrédient, contenu écrit dessus.
        const ingredient = world.service.cartons.find((c) => c.object === o.id)?.ingredient;
        const carton = ingredient === undefined ? undefined : CARTON_MODEL[ingredient];
        const node = models.instance(carton ?? OBJECT_MODEL[o.type] ?? type.model, {
          width: type.size[0],
          depth: type.size[1],
          height: type.size[2],
          color: type.color,
        });
        root.add(node);
        entry = { node, type: o.type };
        objects.set(o.id, entry);
      }
      const at = o.at;
      const holder =
        at.kind === 'hand' ? at.player : at.kind === 'tray' ? trayHolder(view, at.tray) : null;
      if (holder !== null) {
        // Tenu: devant le joueur. Chez soi, en bas à droite du regard local (sans retard sur la
        // souris); chez l'autre, devant son avatar affiché. Sur un plateau: décalé de sa place.
        const local = holder === view.local;
        const pose = view.pose(holder);
        const yaw = ((local ? look.yawDeg : pose.yawDeg) * Math.PI) / 180;
        const ahead = local ? 0.45 : 0.35;
        const side = local ? 0.18 : 0;
        let x = pose.x - Math.sin(yaw) * ahead + Math.cos(yaw) * side;
        let y = local ? 1.18 : 1.0;
        let z = pose.z - Math.cos(yaw) * ahead - Math.sin(yaw) * side;
        if (at.kind === 'tray') {
          const tray = world.objects.find((t) => t.id === at.tray);
          const own = objectPosition(view.content, world, o);
          const base = tray === undefined ? null : objectPosition(view.content, world, tray);
          if (own !== null && base !== null) {
            x += own.x - base.x;
            y += own.y - base.y;
            z += own.z - base.z;
          }
        }
        entry.node.position.set(x, y, z);
        entry.node.rotation.y = yaw;
        entry.node.visible = true;
        continue;
      }
      const pos = objectPosition(view.content, world, o);
      if (pos !== null) entry.node.position.set(pos.x, pos.y, pos.z);
      entry.node.rotation.y = 0;
      entry.node.visible = !inHands.has(o.id);
    }
    if (objects.size > world.objects.length) {
      const ids = new Set(world.objects.map((o) => o.id));
      for (const [id, entry] of objects) {
        if (!ids.has(id)) {
          root.remove(entry.node);
          objects.delete(id);
        }
      }
    }
  };

  return {
    update(view, look) {
      const world = view.world();
      syncFurniture(view);
      syncObjects(view, look);
      const now = performance.now();
      highlight.update(view, look, now);
      const dt = Math.min(0.1, (now - lastTime) / 1000);
      lastTime = now;
      for (const i of [0, 1] as const) {
        const avatar = avatars[i];
        const prev = last[i];
        if (avatar === undefined || prev === undefined) continue;
        avatar.visible = i !== view.local;
        const pose = view.pose(i);
        const rig = rigs[i];
        // Assis: sur sa place du meuble, tourné comme elle (face à sa table), pose droite.
        const seatId = world.players[i].seat ?? null;
        const anchor = seatId === null ? null : placeAnchor(view.content, world.furniture, seatId);
        const yaw = anchor === null ? pose.yawDeg : anchor.yawDeg;
        // L'avant du modèle est +Z, le cap 0 regarde -Z: demi-tour.
        avatar.rotation.y = (yaw * Math.PI) / 180 + (rig === null ? 0 : Math.PI);
        const sitting = anchor !== null && rig !== null && rig !== undefined && rig.sit !== null;
        if (anchor !== null && rig !== null && rig !== undefined && rig.sit !== null) {
          seatPlacement(rig.sit, anchor.x, anchor.y, anchor.z, avatar.rotation.y, placed);
          avatar.position.set(placed.x, placed.y, placed.z);
        } else avatar.position.set(pose.x, 0, pose.z);
        if (rig !== null && rig !== undefined) {
          const moving = dt > 0 && Math.hypot(pose.x - prev.x, pose.z - prev.z) / dt > 0.3;
          rig.still = moving ? 0 : rig.still + dt;
          rig.blend.set(sitting ? SIT_REST : rig.still < 0.15 ? 'walk' : 'idle');
          if (avatar.visible) {
            rig.blend.update(dt);
            if (sitting) bendThighs(rig.node, rig.thighs, placed.thigh);
          }
        }
        prev.x = pose.x;
        prev.z = pose.z;
      }
    },
    dispose() {
      disposed = true;
      highlight.dispose();
      for (const m of owned) m.dispose();
      white.dispose();
      for (const r of rigs) r?.blend.stop();
      scene.remove(root);
      body.dispose();
      visor.dispose();
      for (const m of avatarMaterials) m.dispose();
      visorMaterial.dispose();
    },
  };
}

function trayHolder(view: GameView, trayId: number): PlayerIndex | null {
  const tray = view.world().objects.find((o) => o.id === trayId);
  return tray?.at.kind === 'hand' ? tray.at.player : null;
}
