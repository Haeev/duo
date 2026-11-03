import { BoxGeometry, CylinderGeometry, MeshStandardMaterial, ShaderLib, Texture, type BufferGeometry } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { describe, expect, it } from 'vitest';
import { OUTLINE_NORMAL, buildOutlineGeometry, smoothCharacterNormals } from './lisse';
import { createSurfaceUniforms, patchSurface } from './surfaces';

/** Prisme ombré par face, comme les maillages de l'artiste: un sommet par face et par coin. */
function facetedPrism(sides: number): BufferGeometry {
  const prism = new CylinderGeometry(0.2, 0.2, 0.6, sides, 1).toNonIndexed();
  prism.computeVertexNormals();
  return prism;
}

/** Normale du sommet le plus proche de (x, y, z) dont la normale va dans le sens voulu. */
function normalNear(geometry: BufferGeometry, y: number, wantUp: boolean): [number, number, number] {
  const position = geometry.getAttribute('position');
  const normal = geometry.getAttribute('normal');
  for (let i = 0; i < position.count; i += 1) {
    const up = Math.abs(normal.getY(i)) > 0.5;
    if (Math.abs(position.getY(i) - y) < 1e-4 && up === wantUp && position.getX(i) > 0.15) {
      return [normal.getX(i), normal.getY(i), normal.getZ(i)];
    }
  }
  throw new Error('aucun sommet');
}

describe('style lisse: normales des personnages', () => {
  it('lisse le pourtour d’un prisme à 8 pans et garde l’arête vive du couvercle', () => {
    const prism = facetedPrism(8);
    const count = prism.getAttribute('position').count;
    smoothCharacterNormals(prism, 65);
    expect(prism.getAttribute('position').count).toBe(count);
    const position = prism.getAttribute('position');
    const normal = prism.getAttribute('normal');
    // Sur le pourtour, la normale lissée pointe vers l'axe (radiale), plus vers le milieu de la face.
    let radial = 0;
    let sides = 0;
    for (let i = 0; i < position.count; i += 1) {
      if (Math.abs(normal.getY(i)) > 0.5) continue;
      sides += 1;
      const length = Math.hypot(position.getX(i), position.getZ(i));
      const dot = (normal.getX(i) * position.getX(i) + normal.getZ(i) * position.getZ(i)) / length;
      if (dot > 0.999) radial += 1;
    }
    expect(sides).toBeGreaterThan(0);
    expect(radial).toBe(sides);
    // Le couvercle reste plat: 90 degrés avec le pourtour, au-delà de l'angle de lissage.
    expect(normalNear(prism, 0.3, true)[1]).toBeCloseTo(1, 5);
  });

  it('suit l’angle de lissage: un prisme à 6 pans (60 degrés) lissé à 65, pas à 50', () => {
    const smooth = facetedPrism(6);
    smoothCharacterNormals(smooth, 65);
    const kept = facetedPrism(6);
    const before = normalNear(kept, -0.3, false);
    smoothCharacterNormals(kept, 50);
    const after = normalNear(kept, -0.3, false);
    for (let k = 0; k < 3; k += 1) expect(after[k]).toBeCloseTo(before[k] ?? 0, 5);
    const smoothed = normalNear(smooth, -0.3, false);
    expect(Math.abs(smoothed[0] - before[0]) + Math.abs(smoothed[2] - before[2])).toBeGreaterThan(0.1);
  });

  it('pondère par les angles: une face coupée en deux triangles pèse autant qu’entière', () => {
    // Un cube indexé à sommets séparés par face (BoxGeometry): coins à 90 degrés, rien ne bouge à 65.
    const box = new BoxGeometry(1, 1, 1);
    const before = Array.from(box.getAttribute('normal').array);
    smoothCharacterNormals(box, 65);
    expect(Array.from(box.getAttribute('normal').array)).toEqual(before);
    // À 100 degrés, chaque coin moyenne ses trois faces de même surface: la diagonale.
    smoothCharacterNormals(box, 100);
    const normal = box.getAttribute('normal');
    expect(Math.abs(normal.getX(0))).toBeCloseTo(1 / Math.sqrt(3), 5);
    expect(Math.abs(normal.getY(0))).toBeCloseTo(1 / Math.sqrt(3), 5);
  });
});

describe('style lisse: coque du contour', () => {
  it('partage les tampons du corps et ferme la coque aux arêtes vives', () => {
    const body = facetedPrism(8);
    const hull = buildOutlineGeometry(body, 0.08);
    expect(hull.getAttribute('position')).toBe(body.getAttribute('position'));
    const outline = hull.getAttribute(OUTLINE_NORMAL);
    const position = body.getAttribute('position');
    // Tous les sommets d'un même point reçoivent la même normale de gonflement.
    const byPoint = new Map<string, string>();
    for (let i = 0; i < position.count; i += 1) {
      const key = `${position.getX(i).toFixed(4)},${position.getY(i).toFixed(4)},${position.getZ(i).toFixed(4)}`;
      const value = `${outline.getX(i).toFixed(4)},${outline.getY(i).toFixed(4)},${outline.getZ(i).toFixed(4)}`;
      const known = byPoint.get(key);
      if (known !== undefined) expect(value).toBe(known);
      byPoint.set(key, value);
    }
    expect(hull.getIndex()?.count).toBe(position.count);
  });

  it('retire les petites îles (traits du visage, boutons) et garde le reste', () => {
    const torso = new BoxGeometry(0.4, 0.6, 0.25);
    const eye = new BoxGeometry(0.03, 0.04, 0.005);
    eye.translate(0.1, 0.2, 0.13);
    const merged = mergeGeometries([torso, eye], false);
    const hull = buildOutlineGeometry(merged, 0.08);
    expect(hull.getIndex()?.count).toBe(torso.getIndex()?.count);
  });
});

describe('style lisse: shader des personnages', () => {
  it('met la rampe à la place de N.L dans la lumière directe, dans le même programme', () => {
    const uniforms = createSurfaceUniforms(new Texture(), new Texture());
    const material = new MeshStandardMaterial({ name: 'lpl_characters', map: new Texture() });
    patchSurface(material, uniforms, { puddles: false, wind: false, ground: false, rim: true, ramp: true, key: 'characters_lisse' });
    const shader = {
      vertexShader: ShaderLib.physical.vertexShader,
      fragmentShader: ShaderLib.physical.fragmentShader,
      uniforms: {},
    };
    material.onBeforeCompile(shader as never, null as never);
    expect(shader.fragmentShader).toContain('#define LPL_RAMP');
    expect(shader.fragmentShader).toContain('lplRamp( dot( geometryNormal, directLight.direction ) )');
    expect(shader.fragmentShader).not.toContain('vec3 irradiance = dotNL * directLight.color;');
    expect(material.customProgramCacheKey()).toContain('characters_lisse');
  });
});
