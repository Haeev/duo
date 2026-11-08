/**
 * Surlignage (retours du 2026-11-08): un cadre doré autour du poste ou de l'objet visé (quand
 * « Agir » y ferait quelque chose), un cadre vert qui respire autour du poste que demande le guide
 * de Simone. Deux `LineSegments` sur la même boîte unitaire, dessinés par-dessus le décor pour
 * rester lisibles derrière une pièce de la machine; aucune allocation par image.
 */
import {
  Box3,
  BoxGeometry,
  EdgesGeometry,
  LineBasicMaterial,
  LineSegments,
  Vector3,
  type Object3D,
  type Scene,
} from 'three';
import { guideOf, type GuideFocus } from '../branchement/guide';
import type { Content } from '../donnees/charger';
import type { World } from '../etat/monde';
import type { GameView } from '../reseau/vue';
import { eyeHeightOf } from '../simulation/assise';
import type { Target } from '../simulation/entrees';
import { furnitureType, objectPosition, slotPosition } from '../simulation/monde';
import { aim } from '../simulation/visee';

export interface Highlight {
  update(view: GameView, look: { yawDeg: number; pitchDeg: number }, nowMs: number): void;
  dispose(): void;
}

/** Boîte d'un meuble, d'un emplacement ou d'un objet: centre, tailles, cap (degrés). */
interface Frame {
  x: number;
  y: number;
  z: number;
  w: number;
  h: number;
  d: number;
  rotDeg: number;
}

const MARGIN = 0.04;
const bounds = new Box3();
const boundsSize = new Vector3();
const boundsCenter = new Vector3();

/**
 * Cadre d'un meuble pris sur son modèle affiché quand il existe: l'empreinte des données est celle
 * des collisions (la caisse: 70 cm de large pour 15 cm de haut), plus large et plus basse que le
 * modèle, et le cadre traversait la caisse. Boîte alignée sur les axes: exacte au quart de tour.
 */
function fitToNode(node: Object3D | undefined, out: Frame): void {
  if (node === undefined) return;
  bounds.setFromObject(node);
  if (bounds.isEmpty()) return;
  bounds.getSize(boundsSize);
  bounds.getCenter(boundsCenter);
  out.x = boundsCenter.x;
  out.y = boundsCenter.y;
  out.z = boundsCenter.z;
  out.w = boundsSize.x + MARGIN;
  out.h = boundsSize.y + MARGIN;
  out.d = boundsSize.z + MARGIN;
  out.rotDeg = 0;
}

function frameOf(
  content: Content,
  world: World,
  t: Target | GuideFocus,
  nodeOf: (furnitureId: string) => Object3D | undefined,
  out: Frame,
): boolean {
  if (t.kind === 'station' || t.kind === 'furniture') {
    const id = t.kind === 'station' ? t.furniture : t.id;
    const f = world.furniture.find((x) => x.id === id);
    if (f === undefined) return false;
    const type = furnitureType(content, f);
    out.x = f.x;
    out.z = f.z;
    out.w = type.footprint[0] + MARGIN;
    out.d = type.footprint[1] + MARGIN;
    out.h = type.height + MARGIN;
    out.y = f.y + type.height / 2;
    out.rotDeg = f.rotDeg;
    fitToNode(nodeOf(id), out);
    return true;
  }
  if (t.kind === 'slot') {
    const f = world.furniture.find((x) => x.id === t.furniture);
    const slot =
      f === undefined ? undefined : furnitureType(content, f).slots.find((s) => s.id === t.slot);
    if (f === undefined || slot === undefined) return false;
    const p = slotPosition(f, slot);
    out.x = p.x;
    out.z = p.z;
    out.y = p.y + 0.04;
    out.w = 0.14;
    out.d = 0.14;
    out.h = 0.08;
    out.rotDeg = f.rotDeg;
    return true;
  }
  if (t.kind === 'object') {
    const o = world.objects.find((x) => x.id === t.id);
    const type = o === undefined ? undefined : content.objects.get(o.type);
    const p = o === undefined ? null : objectPosition(content, world, o);
    if (type === undefined || p === null) return false;
    out.x = p.x;
    out.z = p.z;
    out.w = type.size[0] + MARGIN;
    out.d = type.size[1] + MARGIN;
    out.h = type.size[2] + MARGIN;
    out.y = p.y + type.size[2] / 2;
    out.rotDeg = 0;
    return true;
  }
  return false;
}

export function createHighlight(
  scene: Scene,
  nodeOf: (furnitureId: string) => Object3D | undefined,
): Highlight {
  const box = new BoxGeometry(1, 1, 1);
  const edges = new EdgesGeometry(box);
  box.dispose();
  const aimMaterial = new LineBasicMaterial({ color: '#FFC857', depthTest: false });
  const guideMaterial = new LineBasicMaterial({ color: '#6BD69A', depthTest: false });
  const aimLines = new LineSegments(edges, aimMaterial);
  const guideLines = new LineSegments(edges, guideMaterial);
  for (const l of [aimLines, guideLines]) {
    l.renderOrder = 20;
    l.visible = false;
    l.frustumCulled = false;
    scene.add(l);
  }
  const frame: Frame = { x: 0, y: 0, z: 0, w: 0, h: 0, d: 0, rotDeg: 0 };
  const place = (l: LineSegments, grow: number): void => {
    l.position.set(frame.x, frame.y, frame.z);
    l.rotation.set(0, (frame.rotDeg * Math.PI) / 180, 0);
    l.scale.set(frame.w * grow, frame.h * grow, frame.d * grow);
  };
  return {
    update(view, look, nowMs) {
      const world = view.world();
      const content = view.content;
      const pose = view.pose(view.local);
      const a = aim(content, world, view.local, {
        x: pose.x,
        y: eyeHeightOf(content, world, view.local),
        z: pose.z,
        yawDeg: look.yawDeg,
        pitchDeg: look.pitchDeg,
      });
      aimLines.visible =
        a !== null && a.plan.kind !== 'refuse' && frameOf(content, world, a.target, nodeOf, frame);
      if (aimLines.visible) place(aimLines, 1);
      const focus = guideOf(content, world, view.local)?.focus ?? null;
      guideLines.visible = focus !== null && frameOf(content, world, focus, nodeOf, frame);
      if (guideLines.visible) place(guideLines, 1.06 + 0.04 * Math.sin(nowMs / 250));
    },
    dispose() {
      scene.remove(aimLines, guideLines);
      edges.dispose();
      aimMaterial.dispose();
      guideMaterial.dispose();
    },
  };
}
