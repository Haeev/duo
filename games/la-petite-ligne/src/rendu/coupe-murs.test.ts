// Pied des murs coupés (retour R12): la porte reste une brèche lisible quand le mur disparaît.
import { BoxGeometry, BufferGeometry, Matrix4, Vector3 } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { describe, expect, it } from 'vitest';
import { lowWallGeometry } from './coupe-murs';

const HEIGHT = 0.5;

/** Mur de 4 m de long, 2,4 m de haut, 0,4 m d'épais, avec une porte de 0,9 m au milieu. */
function wallWithDoor(): BufferGeometry {
  const left = new BoxGeometry(1.55, 2.4, 0.4).translate(-1.225, 1.2, 0);
  const right = new BoxGeometry(1.55, 2.4, 0.4).translate(1.225, 1.2, 0);
  const lintel = new BoxGeometry(0.9, 0.4, 0.4).translate(0, 2.2, 0);
  return mergeGeometries([left, right, lintel]);
}

function points(geometry: BufferGeometry): Vector3[] {
  const position = geometry.getAttribute('position');
  const out: Vector3[] = [];
  for (let i = 0; i < position.count; i += 1) {
    out.push(new Vector3().fromBufferAttribute(position, i));
  }
  return out;
}

describe('pied des murs coupés (R12)', () => {
  it('rien ne dépasse la hauteur de coupe (à quelques millimètres près)', () => {
    const low = lowWallGeometry(wallWithDoor(), new Matrix4(), HEIGHT);
    expect(low).not.toBeNull();
    const ys = points(low ?? new BufferGeometry()).map((p) => p.y);
    expect(Math.max(...ys)).toBeLessThanOrEqual(HEIGHT + 0.004);
    expect(Math.min(...ys)).toBeCloseTo(0, 6);
  });

  /** Faces dont un point (centre ou milieu d'arête) tombe dans l'ouverture de la porte. */
  function facesInDoor(geometry: BufferGeometry): number {
    const p = points(geometry);
    let faces = 0;
    for (let i = 0; i + 2 < p.length; i += 3) {
      const [a, b, c] = [p[i], p[i + 1], p[i + 2]];
      if (a === undefined || b === undefined || c === undefined) continue;
      const probes = [(a.x + b.x + c.x) / 3, (a.x + b.x) / 2, (b.x + c.x) / 2, (a.x + c.x) / 2];
      if (probes.some((x) => Math.abs(x) < 0.4)) faces += 1;
    }
    return faces;
  }

  it('la porte reste ouverte: ni pied ni linteau écrasé entre les jambages', () => {
    const low = lowWallGeometry(wallWithDoor(), new Matrix4(), HEIGHT) ?? new BufferGeometry();
    expect(facesInDoor(low)).toBe(0);
  });

  it('un dessus de mur d’un seul tenant, qui enjambe la porte, est découpé au-dessus d’elle', () => {
    const coping = new BoxGeometry(4, 0.02, 0.4).translate(0, 2.41, 0);
    const wall = mergeGeometries([wallWithDoor(), coping]);
    const low = lowWallGeometry(wall, new Matrix4(), HEIGHT) ?? new BufferGeometry();
    expect(facesInDoor(low)).toBe(0);
    // Le chapeau existe toujours de part et d'autre de la porte.
    const capXs = points(low)
      .filter((q) => q.y > HEIGHT + 0.002)
      .map((q) => q.x);
    expect(Math.min(...capXs)).toBeLessThan(-1.9);
    expect(Math.max(...capXs)).toBeGreaterThan(1.9);
  });

  it('chapeau: le dessus du mur, écrasé, ferme le pied (normales vers le haut)', () => {
    const low = lowWallGeometry(wallWithDoor(), new Matrix4(), HEIGHT) ?? new BufferGeometry();
    const normal = low.getAttribute('normal');
    const position = low.getAttribute('position');
    let caps = 0;
    for (let i = 0; i < position.count; i += 1) {
      if (position.getY(i) > HEIGHT - 1e-6 && normal.getY(i) > 0.99) caps += 1;
    }
    // Dessus des deux pans (le linteau, au-dessus de la porte, tombe aussi au niveau du chapeau).
    expect(caps).toBeGreaterThanOrEqual(12);
  });

  it('suit le repère du modèle: un mur posé 1 m plus haut est coupé à la même hauteur absolue', () => {
    const toModel = new Matrix4().makeTranslation(0, 0.2, 0);
    const low = lowWallGeometry(wallWithDoor(), toModel, HEIGHT) ?? new BufferGeometry();
    const ys = points(low).map((p) => p.y + 0.2);
    expect(Math.max(...ys)).toBeLessThanOrEqual(HEIGHT + 0.004);
  });

  it('un appui de fenêtre qui dépasse de la façade ne reste pas posé à plat à côté du pied', () => {
    const sill = new BoxGeometry(0.8, 0.06, 0.2).translate(-1.2, 0.9, 0.25);
    const wall = mergeGeometries([wallWithDoor(), sill]);
    const low = lowWallGeometry(wall, new Matrix4(), HEIGHT) ?? new BufferGeometry();
    // La façade est à z = 0,2: rien du pied ne dépasse au-delà (à la marge de rognage près, 1 cm).
    expect(Math.max(...points(low).map((p) => p.z))).toBeLessThanOrEqual(0.2 + 0.011);
  });

  it('dalle pleine (porte peinte sur la façade): la baie est ouverte jusqu’au seuil, entre deux jambages', () => {
    const slab = new BoxGeometry(4, 2.4, 0.4).translate(0, 1.2, 0);
    const sill = 0.17;
    const low =
      lowWallGeometry(slab, new Matrix4(), HEIGHT, [{ axis: 'x', low: -0.45, high: 0.45, sill }]) ??
      new BufferGeometry();
    const p = points(low);
    // Dans la baie, rien au-dessus du seuil (faces dont le centre est dans la baie).
    const inBay: number[] = [];
    for (let i = 0; i + 2 < p.length; i += 3) {
      const [a, b, c] = [p[i], p[i + 1], p[i + 2]];
      if (a === undefined || b === undefined || c === undefined) continue;
      if (Math.abs((a.x + b.x + c.x) / 3) < 0.44) inBay.push(Math.max(a.y, b.y, c.y));
    }
    expect(inBay.length).toBeGreaterThan(0);
    expect(Math.max(...inBay)).toBeCloseTo(sill, 6);
    // Jambages: des faces verticales aux bords de la baie, jusqu'à la coupe.
    const jambs = p.filter((q) => Math.abs(Math.abs(q.x) - 0.45) < 1e-6 && q.y > HEIGHT - 1e-6);
    expect(jambs.length).toBeGreaterThanOrEqual(4);
    // Hors de la baie, le pied monte toujours à la coupe.
    expect(Math.max(...p.filter((q) => q.x < -1).map((q) => q.y))).toBeGreaterThan(HEIGHT - 1e-6);
  });

  it('un mur entièrement au-dessus de la coupe ne donne rien', () => {
    const high = new BoxGeometry(1, 1, 0.3).translate(0, 2, 0);
    expect(lowWallGeometry(high, new Matrix4(), HEIGHT)).toBeNull();
  });
});
