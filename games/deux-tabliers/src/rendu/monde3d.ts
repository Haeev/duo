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
  Group,
  Mesh,
  MeshLambertMaterial,
  MeshStandardMaterial,
  type AnimationAction,
  type Material,
  type Scene,
} from 'three';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import type { PlacedFurniture, PlayerIndex } from '../etat/monde';
import type { GameView } from '../reseau/vue';
import { objectPosition } from '../simulation/monde';
import { AVATAR_MODEL, FURNITURE_MODEL, OBJECT_MODEL } from './correspondances';
import type { ModelLibrary } from './modeles';

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
  const objects = new Map<number, { node: Group; type: string }>();

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
  const rigs: ({
    mixer: AnimationMixer;
    walk: AnimationAction | undefined;
    idle: AnimationAction | undefined;
    walking: boolean;
  } | null)[] = [null, null];
  const owned: Material[] = [];
  let disposed = false;
  for (const i of [0, 1] as const) {
    void models.gltf(AVATAR_MODEL[i]).then((src) => {
      const holder = avatars[i];
      if (src === null || disposed || holder === undefined) return;
      const node = cloneSkinned(src.scene);
      node.traverse((child) => {
        if (!(child instanceof Mesh)) return;
        const m = child.material as Material;
        if (m.name === 'dt_badge_joueur') {
          const tinted = new MeshStandardMaterial({
            color: new Color(colors[i]),
            roughness: 0.4,
          });
          owned.push(tinted);
          child.material = tinted;
        }
      });
      holder.clear();
      holder.add(node);
      const mixer = new AnimationMixer(node);
      const clip = (name: string): AnimationAction | undefined => {
        const c = src.clips.find((x) => x.name === name);
        return c === undefined ? undefined : mixer.clipAction(c);
      };
      const rig = { mixer, walk: clip('walk'), idle: clip('idle'), walking: false };
      rig.idle?.play();
      rigs[i] = rig;
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
            : models.instance(model, {
                width: type.footprint[0],
                depth: type.footprint[1],
                height: type.height,
                color: type.color,
              });
        node.name = f.id;
        root.add(node);
        entry = { node, key };
        furniture.set(f.id, entry);
      }
      entry.node.position.set(f.x, f.y, f.z);
      entry.node.rotation.y = (f.rotDeg * Math.PI) / 180;
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
    for (const o of world.objects) {
      let entry = objects.get(o.id);
      if (entry !== undefined && entry.type !== o.type) {
        root.remove(entry.node);
        entry = undefined;
      }
      if (entry === undefined) {
        const type = view.content.objects.get(o.type);
        if (type === undefined) continue;
        const node = models.instance(OBJECT_MODEL[o.type] ?? type.model, {
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
        continue;
      }
      const pos = objectPosition(view.content, world, o);
      if (pos !== null) entry.node.position.set(pos.x, pos.y, pos.z);
      entry.node.rotation.y = 0;
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
      syncFurniture(view);
      syncObjects(view, look);
      const now = performance.now();
      const dt = Math.min(0.1, (now - lastTime) / 1000);
      lastTime = now;
      for (const i of [0, 1] as const) {
        const avatar = avatars[i];
        const prev = last[i];
        if (avatar === undefined || prev === undefined) continue;
        avatar.visible = i !== view.local;
        const pose = view.pose(i);
        avatar.position.set(pose.x, 0, pose.z);
        // L'avant du modèle est +Z, le cap 0 regarde -Z: demi-tour.
        avatar.rotation.y = (pose.yawDeg * Math.PI) / 180 + (rigs[i] === null ? 0 : Math.PI);
        const rig = rigs[i];
        if (rig !== null && rig !== undefined) {
          const moving = dt > 0 && Math.hypot(pose.x - prev.x, pose.z - prev.z) / dt > 0.3;
          if (moving !== rig.walking) {
            rig.walking = moving;
            const next = moving ? rig.walk : rig.idle;
            const before = moving ? rig.idle : rig.walk;
            next?.reset().fadeIn(0.2).play();
            before?.fadeOut(0.2);
          }
          if (avatar.visible) rig.mixer.update(dt);
        }
        prev.x = pose.x;
        prev.z = pose.z;
      }
    },
    dispose() {
      disposed = true;
      for (const m of owned) m.dispose();
      for (const r of rigs) r?.mixer.stopAllAction();
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
