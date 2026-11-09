/**
 * Tasse ou verre tenu en main (clients assis et au zinc): la forme du récipient est lue dans
 * son GLB (anse côté +X, bord, contenu `_liquid`), la main est mesurée sur le squelette (les
 * personnages n'ont pas d'os de doigts: main en palette, paume vers le bas dans la pose de
 * liaison). La main droite tient l'anse dans son creux, pouce dessus, paume contre la paroi; un
 * verre se tient par le corps, main autour. La tasse monte aux lèvres et s'incline vers la
 * bouche autour du bord posé sur la lèvre; le contenu baisse et reste à plat (masqué au-delà
 * d'une petite inclinaison, qu'il ne pourrait pas suivre).
 *
 * Les personnages à doigts (`doigts` de `modeles.json`) ne passent plus par la mesure de la main:
 * la prise livrée par l'artiste place la tasse ou le verre dans le repère de la main droite
 * (`fingerHolds`, plus bas). La mesure reste pour ceux qui n'ont pas encore de doigts.
 */
import { v } from '@duo/sdk';
import rawModelInfo from '../../assets/modeles/modeles.json';
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
  /** Anse (côté +X): boîte de ses sommets dans le plan XY, `null` pour un verre. */
  readonly handle: {
    readonly x0: number;
    readonly x1: number;
    readonly y0: number;
    readonly y1: number;
  } | null;
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
  let hx0 = Infinity;
  let hx1 = -Infinity;
  for (let i = 0; i < pos.count; i++) {
    vtx.fromBufferAttribute(pos, i);
    if (vtx.x <= radius + 0.003) continue;
    hy0 = Math.min(hy0, vtx.y);
    hy1 = Math.max(hy1, vtx.y);
    hx0 = Math.min(hx0, vtx.x);
    hx1 = Math.max(hx1, vtx.x);
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
    handle: handle ? { x0: hx0, x1: hx1, y0: hy0, y1: hy1 } : null,
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

/*
 * Personnages à doigts: la prise est mesurée par l'artiste (`doigts.prises` de `modeles.json`),
 * récipient = main · (position, quaternion), main prise en position et quaternion du monde sans
 * l'échelle du squelette. La main ne se mesure plus: on l'en déduit.
 */

const Vec3 = v.tuple([v.number(), v.number(), v.number()]);
const HoldSchema = v.looseObject({
  position_m: Vec3,
  quaternion_xyzw: v.tuple([v.number(), v.number(), v.number(), v.number()]),
  modele: v.string(),
  point_de_prise_dans_la_tasse_m: v.optional(Vec3),
});
const FingersSchema = v.looseObject({
  personnages: v.array(
    v.looseObject({
      id: v.string(),
      doigts: v.nullish(
        v.looseObject({
          prises: v.looseObject({ grip_handle: HoldSchema, grip_glass: HoldSchema }),
        }),
      ),
    }),
  ),
});

/** Récipient dans le repère métrique de la main droite, pour une prise. */
export interface VesselHold {
  readonly position: Vector3;
  readonly quaternion: Quaternion;
  /** Récipient sur lequel la prise a été mesurée, et point de l'anse pincé (son repère). */
  readonly model: string;
  readonly handlePoint: Vector3 | null;
}

export interface FingerHolds {
  readonly handle: VesselHold;
  readonly glass: VesselHold;
}

const FINGER_HOLDS: ReadonlyMap<string, FingerHolds> = (() => {
  const out = new Map<string, FingerHolds>();
  const parsed = v.safeParse(FingersSchema, rawModelInfo);
  if (!parsed.success) return out;
  const hold = (h: v.InferOutput<typeof HoldSchema>): VesselHold => ({
    position: new Vector3(...h.position_m),
    quaternion: new Quaternion(...h.quaternion_xyzw).normalize(),
    model: h.modele,
    handlePoint:
      h.point_de_prise_dans_la_tasse_m === undefined
        ? null
        : new Vector3(...h.point_de_prise_dans_la_tasse_m),
  });
  for (const p of parsed.output.personnages) {
    const d = p.doigts;
    if (d === null || d === undefined) continue;
    out.set(p.id, { handle: hold(d.prises.grip_handle), glass: hold(d.prises.grip_glass) });
  }
  return out;
})();

/** Prises du personnage `model` (`char_simone`...), `null` s'il n'a pas de doigts. */
export function fingerHolds(model: string): FingerHolds | null {
  return FINGER_HOLDS.get(model) ?? null;
}

const adjust = new Vector3();

/**
 * Prise adaptée au récipient `shape` quand elle a été mesurée sur un autre (`ref`): le point
 * pincé de l'anse garde sa place relative dans la boîte de l'anse (tasse à espresso, plus petite
 * que la tasse à cappuccino de la mesure), et la tasse glisse d'autant dans la main.
 */
export function adaptHold(hold: VesselHold, ref: VesselShape, shape: VesselShape): VesselHold {
  const a = ref.handle;
  const b = shape.handle;
  const p = hold.handlePoint;
  if (a === null || b === null || p === null) return hold;
  const u = a.x1 > a.x0 ? (p.x - a.x0) / (a.x1 - a.x0) : 0.5;
  const w = a.y1 > a.y0 ? (p.y - a.y0) / (a.y1 - a.y0) : 0.5;
  const here = new Vector3(b.x0 + u * (b.x1 - b.x0), b.y0 + w * (b.y1 - b.y0), p.z);
  adjust.copy(p).sub(here).applyQuaternion(hold.quaternion);
  return {
    position: hold.position.clone().add(adjust),
    quaternion: hold.quaternion,
    model: hold.model,
    handlePoint: here,
  };
}

const holdInv = new Quaternion();

/** Main (poignet et quaternion du monde) qui tient le récipient posé en `at`, tourné de `q`. */
export function handForVessel(
  hold: VesselHold,
  at: Vector3,
  q: Quaternion,
  wristOut: Vector3,
  handOut: Quaternion,
): void {
  handOut.copy(q).multiply(holdInv.copy(hold.quaternion).invert());
  wristOut.copy(hold.position).applyQuaternion(handOut).negate().add(at);
}

/** Récipient (origine et quaternion du monde) tenu par la main en `wrist`, tournée de `handQ`. */
export function vesselInHand(
  hold: VesselHold,
  wrist: Vector3,
  handQ: Quaternion,
  atOut: Vector3,
  qOut: Quaternion,
): void {
  atOut.copy(hold.position).applyQuaternion(handQ).add(wrist);
  qOut.copy(handQ).multiply(hold.quaternion);
}

/**
 * Direction horizontale du poignet vu du récipient (son repère), pour tourner un verre autour de
 * son axe: le verre est rond, seule compte la place de la main autour de lui.
 */
export function wristDirection(hold: VesselHold, out: Vector3): Vector3 {
  out.copy(hold.position).applyQuaternion(holdInv.copy(hold.quaternion).invert()).negate();
  out.y = 0;
  if (out.lengthSq() < 1e-8) out.set(1, 0, 0);
  return out.normalize();
}
