/**
 * Tasse ou verre tenu en main (clients assis et au zinc): la forme du récipient est lue dans
 * son GLB (anse côté +X, bord, contenu `_liquid`), la main est mesurée sur le squelette (les
 * personnages n'ont pas d'os de doigts: main en palette, paume vers le bas dans la pose de
 * liaison). La main droite tient l'anse dans son creux, pouce dessus, paume contre la paroi; un
 * verre se tient par le corps, main autour. La tasse monte aux lèvres et s'incline vers la
 * bouche autour du bord posé sur la lèvre; le contenu baisse et reste à plat (masqué au-delà
 * d'une petite inclinaison, qu'il ne pourrait pas suivre).
 */
import {
  Box3,
  Matrix4,
  Mesh,
  Quaternion,
  SkinnedMesh,
  Vector3,
  type BufferAttribute,
  type BufferGeometry,
  type Object3D,
} from 'three';

/** Forme d'un récipient dans son repère (base au sol, en mètres). */
export interface VesselShape {
  /** Rayon du bord (lèvres) et hauteur du bord. */
  readonly rimRadius: number;
  readonly rimY: number;
  /** Point où se pose le creux de la main (paume contre la paroi, côté +X). */
  readonly gripX: number;
  readonly gripY: number;
  /** Contenu: bas et haut du volume `_liquid` (tasse pleine). */
  readonly liquidY0: number;
}

export interface VesselGrip {
  readonly palmGap: number;
  readonly glassGripHeight: number;
}

const box = new Box3();
const vtx = new Vector3();

/** Mesure le récipient (`root`: clone de la scène du GLB, pas encore placé). */
export function vesselShape(root: Object3D, grip: VesselGrip): VesselShape | null {
  let body = null as BufferGeometry | null;
  let liquid = null as BufferGeometry | null;
  root.traverse((o) => {
    if (!(o instanceof Mesh)) return;
    const g = o.geometry as BufferGeometry;
    if (o.name.endsWith('_liquid')) liquid ??= g;
    else body ??= g;
  });
  if (body === null) return null;
  const b: BufferGeometry = body;
  b.computeBoundingBox();
  const bb = b.boundingBox ?? box.makeEmpty();
  // Le bol est rond autour de l'axe vertical: son rayon se lit du côté opposé à l'anse.
  const radius = -bb.min.x;
  const pos = b.getAttribute('position') as BufferAttribute;
  let hy0 = Infinity;
  let hy1 = -Infinity;
  for (let i = 0; i < pos.count; i++) {
    vtx.fromBufferAttribute(pos, i);
    if (vtx.x <= radius + 0.003) continue;
    hy0 = Math.min(hy0, vtx.y);
    hy1 = Math.max(hy1, vtx.y);
  }
  const handle = Number.isFinite(hy0);
  let liquidY0 = 0;
  const l: BufferGeometry | null = liquid;
  if (l !== null) {
    l.computeBoundingBox();
    liquidY0 = l.boundingBox?.min.y ?? 0;
  }
  return {
    rimRadius: radius,
    rimY: bb.max.y,
    gripX: radius + grip.palmGap,
    gripY: handle ? (hy0 + hy1) / 2 : bb.max.y * grip.glassGripHeight,
    liquidY0,
  };
}

/** Le contenu (`_liquid`) du récipient: baissé à `fill` (1 plein), montré s'il reste à plat. */
export function setLiquid(
  liquid: Object3D | undefined,
  shape: VesselShape,
  fill: number,
  shown: boolean,
): void {
  if (liquid === undefined) return;
  liquid.visible = shown && fill > 0.01;
  // Le volume garde son fond: il descend depuis le haut, sans traverser le fond de la tasse.
  liquid.scale.set(1, Math.max(0.01, fill), 1);
  liquid.position.set(0, shape.liquidY0 * (1 - fill), 0);
}

/**
 * Main mesurée dans le repère de l'os de la main: doigts (`f`), paume (`p`, vers l'extérieur
 * de la paume), pouce (`t = f × p`), et creux de la main (point qui touche l'anse).
 */
export interface HandFrame {
  readonly basis: Matrix4;
  readonly grip: Vector3;
}

const m4 = new Matrix4();
const centroid = new Vector3();
const fAxis = new Vector3();
const pAxis = new Vector3();
const tAxis = new Vector3();

/** Mesure la main `hand` (os) sur les maillages squelettés de `node`, en pose de liaison. */
export function handFrame(node: Object3D, hand: Object3D, along: number): HandFrame | null {
  const points: Vector3[] = [];
  const palmDown = new Vector3();
  let found = false;
  node.traverse((o) => {
    if (found || !(o instanceof SkinnedMesh)) return;
    const idx = o.skeleton.bones.indexOf(hand as never);
    const inverse = o.skeleton.boneInverses[idx];
    if (idx < 0 || inverse === undefined) return;
    const g = o.geometry as BufferGeometry;
    const pos = g.getAttribute('position') as BufferAttribute;
    const si = g.getAttribute('skinIndex') as BufferAttribute | undefined;
    const sw = g.getAttribute('skinWeight') as BufferAttribute | undefined;
    if (si === undefined || sw === undefined) return;
    // Repère de liaison de l'os: os⁻¹ · matrice de liaison du maillage.
    m4.multiplyMatrices(inverse, o.bindMatrix);
    for (let i = 0; i < pos.count; i++) {
      let best = 0;
      let joint = -1;
      for (let c = 0; c < 4; c++) {
        const w = sw.getComponent(i, c);
        if (w > best) {
          best = w;
          joint = si.getComponent(i, c);
        }
      }
      if (joint !== idx) continue;
      points.push(new Vector3().fromBufferAttribute(pos, i).applyMatrix4(m4));
    }
    // Paume vers le bas dans la pose de liaison (bras en croix).
    palmDown.set(0, -1, 0).transformDirection(m4);
    found = points.length > 0;
  });
  if (points.length === 0) return null;
  centroid.set(0, 0, 0);
  for (const p of points) centroid.add(p);
  centroid.divideScalar(points.length);
  fAxis.copy(centroid).normalize();
  pAxis.copy(palmDown).addScaledVector(fAxis, -palmDown.dot(fAxis)).normalize();
  tAxis.crossVectors(fAxis, pAxis);
  let fMax = 0;
  let pMax = -Infinity;
  let t0 = Infinity;
  let t1 = -Infinity;
  for (const p of points) {
    fMax = Math.max(fMax, p.dot(fAxis));
    pMax = Math.max(pMax, p.dot(pAxis));
    const t = p.dot(tAxis);
    t0 = Math.min(t0, t);
    t1 = Math.max(t1, t);
  }
  // Le repère de l'os peut être à l'échelle du squelette (centimètres): on revient aux mètres.
  node.updateMatrixWorld(true);
  const scale = hand.getWorldScale(centroid).x;
  const grip = new Vector3()
    .addScaledVector(fAxis, fMax * along)
    .addScaledVector(pAxis, pMax)
    .addScaledVector(tAxis, (t0 + t1) / 2)
    .multiplyScalar(scale);
  return { basis: new Matrix4().makeBasis(fAxis, pAxis, tAxis), grip };
}

/**
 * Repère de la main voulu dans le repère du récipient: doigts vers -Z (devant la buveuse, l'anse
 * vers sa droite), paume vers l'axe (-X), pouce en haut (+Y).
 */
const VESSEL_BASIS = new Matrix4().makeBasis(
  new Vector3(0, 0, -1),
  new Vector3(-1, 0, 0),
  new Vector3(0, 1, 0),
);
const qVessel = new Quaternion();
const mTmp = new Matrix4();

/** Rotation de l'os de la main (monde) pour tenir le récipient tourné de `cupQ` (monde). */
export function handQuaternion(frame: HandFrame, cupQ: Quaternion, out: Quaternion): Quaternion {
  // Main · basis = tasse · VESSEL_BASIS, donc main = tasse · VESSEL_BASIS · basisᵀ.
  mTmp.copy(frame.basis).transpose().premultiply(VESSEL_BASIS);
  qVessel.setFromRotationMatrix(mTmp);
  return out.copy(cupQ).multiply(qVessel);
}

const gripW = new Vector3();

/** Poignet (os de la main, monde) pour que le creux de la main soit au point de prise. */
export function wristFor(
  frame: HandFrame,
  shape: VesselShape,
  cupAt: Vector3,
  cupQ: Quaternion,
  handQ: Quaternion,
  out: Vector3,
): Vector3 {
  gripW.set(shape.gripX, shape.gripY, 0).applyQuaternion(cupQ).add(cupAt);
  return out.copy(frame.grip).applyQuaternion(handQ).negate().add(gripW);
}

/** Récipient (origine, monde) tenu par une main posée en `wrist`, tournée de `handQ`. */
export function cupFromHand(
  frame: HandFrame,
  shape: VesselShape,
  wrist: Vector3,
  handQ: Quaternion,
  cupQ: Quaternion,
  out: Vector3,
): Vector3 {
  out.copy(frame.grip).applyQuaternion(handQ).add(wrist);
  gripW.set(shape.gripX, shape.gripY, 0).applyQuaternion(cupQ);
  return out.sub(gripW);
}
