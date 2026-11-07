/**
 * Coque qui suit l'aménagement (navigateur): reconstruite quand une extension ouvre (arche, store),
 * avec les revêtements par-dessus (peinture ou papier peint sur les pans de mur intérieurs, sol
 * de la pièce). Une couche fine décollée de 6 mm: ni scintillement, ni façade repeinte.
 */
import { BoxGeometry, Group, Mesh, MeshLambertMaterial, type Scene } from 'three';
import type { Content } from '../../donnees/charger';
import type { GameView } from '../../reseau/vue';
import { buildShell } from '../../rendu/coque';
import { currentPlan } from '../extensions';
import { wallFaces } from '../regles';

export interface LiveShell {
  update(): void;
  dispose(): void;
}

const LAYER = 0.006;

export function createLiveShell(scene: Scene, content: Content, view: GameView): LiveShell {
  let plan = currentPlan(content, view.world());
  let shell = buildShell(plan);
  scene.add(shell.group);
  const extras = new Group();
  extras.name = 'revetements';
  scene.add(extras);
  const owned: { dispose(): void }[] = [];
  let key = '';
  let frame = 0;

  const clearExtras = (): void => {
    extras.clear();
    for (const d of owned) d.dispose();
    owned.length = 0;
  };

  const layer = (
    color: string,
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
  ): void => {
    const g = new BoxGeometry(w, h, d);
    g.translate(x, y, z);
    const m = new MeshLambertMaterial({ color });
    owned.push(g, m);
    extras.add(new Mesh(g, m));
  };

  const rebuildExtras = (): void => {
    clearExtras();
    const world = view.world();
    const a = world.arrangement;
    const ceiling = content.arrangement.rules.ceiling;
    for (const face of wallFaces(content, world)) {
      if (face.outside) continue;
      const item = a.walls[face.room];
      const color = item === undefined ? undefined : content.arrangement.items.get(item)?.color;
      if (color === undefined) continue;
      const len = face.to - face.from;
      const mid = (face.from + face.to) / 2;
      const off = face.line + face.normal * LAYER;
      if (face.axis === 'z') layer(color, mid, ceiling / 2, off, len, ceiling, 0.004);
      else layer(color, off, ceiling / 2, mid, 0.004, ceiling, len);
    }
    for (const room of content.arrangement.rooms) {
      const item = a.floors[room.id];
      const color = item === undefined ? undefined : content.arrangement.items.get(item)?.color;
      if (color === undefined) continue;
      const [x, z, w, d] = room.space;
      layer(color, x + w / 2, 0.005 + LAYER / 2, z + d / 2, w, 0.004, d);
    }
    // Linteau des arches (pièce du fond): l'ouverture s'arrête à hauteur de porte.
    for (const el of plan.levels[0]?.elements ?? []) {
      if (el.kind !== 'opening' || !('rect' in el.shape)) continue;
      const [x, z, w, d] = el.shape.rect;
      layer('#efe6d6', x + w / 2, (2.1 + ceiling) / 2, z + d / 2, w, ceiling - 2.1, d);
    }
    // Store banne de la terrasse: une toile inclinée, du haut de la façade vers la place.
    for (const el of plan.levels[0]?.elements ?? []) {
      if (el.kind !== 'hood' || !('rect' in el.shape)) continue;
      const [x, z, w, d] = el.shape.rect;
      const g = new BoxGeometry(w, 0.03, Math.hypot(d, 0.35));
      g.rotateX(Math.atan2(0.35, d));
      g.translate(x + w / 2, content.arrangement.rules.storeHeight + 0.2, z + d / 2);
      const m = new MeshLambertMaterial({ color: '#c8553d' });
      owned.push(g, m);
      extras.add(new Mesh(g, m));
    }
  };

  return {
    update() {
      const world = view.world();
      const next = currentPlan(content, world);
      if (next !== plan) {
        scene.remove(shell.group);
        shell.dispose();
        plan = next;
        shell = buildShell(plan);
        scene.add(shell.group);
        key = '';
      }
      // Les revêtements changent rarement: un examen toutes les 20 images suffit.
      if (key !== '' && frame++ % 20 !== 0) return;
      const a = world.arrangement;
      const k = `${JSON.stringify(a.walls)}|${JSON.stringify(a.floors)}|${a.extensions.join(',')}`;
      if (k !== key) {
        key = k;
        rebuildExtras();
      }
    },
    dispose() {
      clearExtras();
      scene.remove(extras);
      scene.remove(shell.group);
      shell.dispose();
    },
  };
}
