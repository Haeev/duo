/**
 * Ce qui bouge dans la scène: meubles posés, objets mobiles, avatar de l'autre joueur, objet
 * tenu par le joueur local. Synchronisé à chaque image depuis la `GameView`, sans allouer
 * tant que rien ne change. Les meubles passeront en `BatchedMesh` (technique 3.3) quand les
 * modèles définitifs arriveront.
 */
import { CapsuleGeometry, Group, Mesh, MeshLambertMaterial, BoxGeometry, type Scene } from 'three';
import type { PlacedFurniture, PlayerIndex } from '../etat/monde';
import type { GameView } from '../reseau/vue';
import { objectPosition } from '../simulation/monde';
import type { ModelLibrary } from './modeles';

interface FurnitureNode {
  readonly node: Group;
  key: string;
}

const furnitureKey = (f: PlacedFurniture): string => `${f.type}|${f.x}|${f.z}|${f.y}|${f.rotDeg}`;

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
        const node = models.instance(type.model, {
          width: type.footprint[0],
          depth: type.footprint[1],
          height: type.height,
          color: type.color,
        });
        node.position.set(f.x, f.y, f.z);
        node.rotation.y = (f.rotDeg * Math.PI) / 180;
        node.name = f.id;
        root.add(node);
        furniture.set(f.id, { node, key });
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
    for (const o of world.objects) {
      let entry = objects.get(o.id);
      if (entry !== undefined && entry.type !== o.type) {
        root.remove(entry.node);
        entry = undefined;
      }
      if (entry === undefined) {
        const type = view.content.objects.get(o.type);
        if (type === undefined) continue;
        const node = models.instance(type.model, {
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
      for (const i of [0, 1] as const) {
        const avatar = avatars[i];
        if (avatar === undefined) continue;
        avatar.visible = i !== view.local;
        const pose = view.pose(i);
        avatar.position.set(pose.x, 0, pose.z);
        avatar.rotation.y = (pose.yawDeg * Math.PI) / 180;
      }
    },
    dispose() {
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
