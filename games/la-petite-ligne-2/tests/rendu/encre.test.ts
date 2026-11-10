// Rendu encré de production (ADR 0023): ambiances en données (heures, dedans, météo, lieu clos),
// conversion automatique des géométries, hiérarchie du trait, carte du sol, lampes, mise en route
// étalée des programmes, pose assise. Logique pure: aucun contexte WebGL.
import {
  BoxGeometry,
  type BufferGeometry,
  Color,
  Float32BufferAttribute,
  Group,
  InstancedMesh,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  Vector3,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { describe, expect, it } from 'vitest';
import ambiancesJson from '../../src/rendu/encre/ambiances.json';
import {
  AMBIANCE_KEYS,
  ambianceAt,
  ambianceSpan,
  gameAmbiances,
  resolveAmbiances,
} from '../../src/rendu/encre/ambiances';
import { detailShare, rankWeights } from '../../src/rendu/encre/contour';
import { connectedParts, inkifyModel, inkTag, layerRuleOf } from '../../src/rendu/encre/conversion';
import { inkCode, KIND, LAYER, sizeClass } from '../../src/rendu/encre/couches';
import { placeLights } from '../../src/rendu/encre/lumieres';
import { createInkUniforms, InkMaterial, isInkMaterial } from '../../src/rendu/encre/matiere';
import { LAMP_LAYER, StageSort, SUN_LAYER } from '../../src/rendu/encre/ombres';
import { INK_SETTINGS } from '../../src/rendu/encre/reglages';
import { floorMapBytes, groundMapBytes } from '../../src/rendu/encre/sol';
import { CameraRig } from '../../src/rendu/camera';
import type { SceneVolume } from '../../src/rendu/lieu/description';
import { GeometryBuilder } from '../../src/rendu/lieu/geometrie';
import type { GroundField } from '../../src/rendu/lieu/terrain-rendu';
import { interiorWalls, railSegments } from '../../src/rendu/lieu/terrain-rendu';
import { clampAlongSeat, LegPose, solveLeg } from '../../src/rendu/personnages/assise';
import { RENDER_SETTINGS } from '../../src/rendu/reglages';

function painted(geometry: BufferGeometry, hex: string): BufferGeometry {
  const color = new Color(hex);
  const count = geometry.getAttribute('position').count;
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) color.toArray(colors, i * 3);
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
  return geometry;
}

describe('ambiances en données', () => {
  const book = gameAmbiances();

  it('la fiche « defaut » donne les cinq heures, dehors et dedans', () => {
    const sheet = book.sheets.get('defaut');
    for (const key of AMBIANCE_KEYS) {
      expect(sheet?.dehors[key].lit).toHaveLength(3);
      expect(sheet?.dedans[key].sunShadow).toBe(0);
    }
  });

  it('jour clair à midi, jour dense en fin d’après-midi, passage continu de l’un à l’autre', () => {
    const at = (minutes: number): number =>
      ambianceAt(book, { sheet: null, minutes, indoor: 0, weather: null }).blackFill;
    expect(at(12 * 60)).toBe(0);
    expect(at(17 * 60)).toBeCloseTo(0.62, 5);
    let previous = at(14 * 60);
    for (let m = 14 * 60 + 5; m <= 17 * 60; m += 5) {
      const now = at(m);
      // Aucun à-coup: cinq minutes de jeu ne changent jamais un réglage de plus de 3 %.
      expect(now).toBeGreaterThanOrEqual(previous);
      expect(now - previous).toBeLessThan(0.03);
      previous = now;
    }
  });

  it('tourne sans saut sur toute la journée, minuit compris', () => {
    const tone = (minutes: number): number =>
      ambianceAt(book, { sheet: null, minutes, indoor: 0, weather: null }).lit[2];
    for (let m = 0; m < 1440; m += 1) expect(Math.abs(tone(m + 1) - tone(m))).toBeLessThan(0.01);
    expect(ambianceSpan(1439, book.stops).from).toBe('nuit');
  });

  it('gabarit: une fiche factice ajoutée aux données hérite de « defaut » sans code', () => {
    const raw = JSON.parse(JSON.stringify(ambiancesJson)) as typeof ambiancesJson & {
      sheets: Record<string, unknown>;
    };
    raw.sheets['essai-factice'] = { dehors: { midi: { tint: [0.5, 1, 1] } } };
    const extended = resolveAmbiances(raw);
    const noon = ambianceAt(extended, {
      sheet: 'essai-factice',
      minutes: 720,
      indoor: 0,
      weather: null,
    });
    expect(noon.tint).toEqual([0.5, 1, 1]);
    expect(noon.lit).toEqual(book.sheets.get('defaut')?.dehors.midi.lit);
    // Une fiche inconnue du climat retombe sur « defaut ».
    const unknown = ambianceAt(extended, {
      sheet: 'inconnue',
      minutes: 720,
      indoor: 0,
      weather: null,
    });
    expect(unknown.tint).toEqual(book.sheets.get('defaut')?.dehors.midi.tint);
  });

  it('refuse des données fausses', () => {
    expect(() => resolveAmbiances({ format: 'duo-ambiances/1', stops: [], sheets: {} })).toThrow();
    const raw = JSON.parse(JSON.stringify(ambiancesJson)) as { sheets: Record<string, unknown> };
    raw.sheets.boucle = { extends: 'boucle' };
    expect(() => resolveAmbiances(raw)).toThrow(/boucle/);
  });

  it('dedans: pas d’ombre du soleil; météo: brume plus épaisse, couleurs plus sourdes', () => {
    const inside = ambianceAt(book, { sheet: null, minutes: 720, indoor: 1, weather: null });
    expect(inside.sunShadow).toBe(0);
    expect(inside.sun).not.toBeNull();
    const clear = ambianceAt(book, { sheet: null, minutes: 720, indoor: 0, weather: 'clear' });
    const mist = ambianceAt(book, { sheet: null, minutes: 720, indoor: 0, weather: 'mist' });
    expect(mist.mist).toBeGreaterThan(clear.mist);
    expect(mist.saturation).toBeLessThan(clear.saturation);
  });
});

describe('conversion automatique des modèles', () => {
  it('compte les morceaux d’un seul tenant et leur donne une couche d’après leur teinte', () => {
    const plank = painted(new BoxGeometry(1.2, 0.1, 0.4).translate(0, 0.5, 0), '#8a5a35');
    const leaf = painted(new BoxGeometry(0.3, 0.3, 0.3).translate(2, 0.5, 0), '#4f8a3c');
    const merged = mergeGeometries([plank, leaf]);
    const { count } = connectedParts(merged.getAttribute('position'), merged.index);
    expect(count).toBe(2);
    inkTag(merged);
    const ink = merged.getAttribute('aInk');
    expect(ink.itemSize).toBe(4);
    // Planche brune: fil du bois, morceau de plus d'un mètre; feuillage vert: souple.
    expect(ink.getX(0)).toBe(LAYER.grain);
    expect(ink.getZ(0)).toBe(KIND.none);
    expect(Math.floor(ink.getW(0) / 64)).toBe(sizeClass(Math.hypot(1.2, 0.1, 0.4)));
    const last = ink.count - 1;
    expect(ink.getX(last)).toBe(LAYER.leaf);
    expect(ink.getZ(last)).toBe(KIND.leaf);
    expect(ink.getW(last)).not.toBe(ink.getW(0));
    // La pièce entière: même code partout, classe de la boîte de l'objet.
    expect(ink.getY(0)).toBe(ink.getY(last));
    // Une seconde conversion ne refait rien.
    expect(inkTag(merged).getAttribute('aInk')).toBe(ink);
  });

  it('un nouvel objet livré passe au matériau encré sans code', () => {
    const material = new InkMaterial(createInkUniforms());
    const model = new Group();
    const part = new Mesh(painted(new BoxGeometry(1, 1, 1), '#777777'), new MeshStandardMaterial());
    model.add(part);
    inkifyModel(model, material);
    expect(isInkMaterial(part.material)).toBe(true);
    expect(part.geometry.getAttribute('aInk')).toBeDefined();
  });

  it('règles de teinte: vert feuillage, brun bois, le reste pierre', () => {
    const linear = (hex: string): [number, number, number] => {
      const c = new Color(hex);
      return [c.r, c.g, c.b];
    };
    expect(layerRuleOf(...linear('#5f8a4a'))?.layer).toBe('leaf');
    expect(layerRuleOf(...linear('#6e5440'))?.layer).toBe('grain');
    expect(layerRuleOf(...linear('#a59b8c'))?.layer).toBe('face');
  });

  it('codes: numéro de 1 à 62 et classe de taille sur deux bits', () => {
    for (const index of [0, 61, 62, 500]) {
      const code = inkCode(index, 0.5);
      expect(code % 64).toBeGreaterThanOrEqual(1);
      expect(code % 64).toBeLessThanOrEqual(62);
      expect(Math.floor(code / 64)).toBe(2);
    }
  });

  it('géométries fusionnées du moteur: une pièce par partie nommée, un morceau par boîte', () => {
    const builder = new GeometryBuilder();
    builder.setInk(LAYER.wall);
    builder.begin('maison-murs');
    builder.box({ x: 0, z: 0, base: 0, w: 6, h: 3, d: 0.3, yaw: 0, color: '#e8dcc2' });
    builder.box({
      x: 0,
      z: 0,
      base: 0,
      w: 1.2,
      h: 2,
      d: 0.1,
      yaw: 0,
      color: '#5e4330',
      layer: 'wood',
    });
    builder.end();
    builder.box({
      x: 9,
      z: 0,
      base: 0,
      w: 0.2,
      h: 0.2,
      d: 0.2,
      yaw: 0,
      color: '#ffffff',
      glow: 'flame',
    });
    const ink = builder.build()?.getAttribute('aInk');
    if (ink === undefined) throw new Error('aInk absent');
    expect(ink.getX(0)).toBe(LAYER.wall);
    expect(ink.getX(20)).toBe(LAYER.wood);
    expect(ink.getY(0)).toBe(ink.getY(20));
    expect(ink.getW(0)).not.toBe(ink.getW(20));
    expect(Math.floor(ink.getY(0) / 64)).toBe(0);
    // La lampe, hors de toute partie: sa propre pièce, petite, de nature « flamme ».
    expect(ink.getZ(40)).toBe(KIND.flame);
    expect(Math.floor(ink.getY(40) / 64)).toBe(3);
  });
});

describe('matériau encré', () => {
  it('une copie partage la lumière commune et garde son état propre (fondu des murs)', () => {
    const uniforms = createInkUniforms();
    const material = new InkMaterial(uniforms);
    const copy = material.clone();
    copy.transparent = true;
    copy.opacity = 0.2;
    copy.color.set('#ff0000');
    expect(copy.uniforms.uSunDir).toBe(material.uniforms.uSunDir);
    expect(copy.uniforms.uOpacity).not.toBe(material.uniforms.uOpacity);
    copy.onBeforeRender();
    expect(copy.uniforms.uOpacity?.value).toBe(0.2);
    expect(copy.uniforms.uFaded?.value).toBe(1);
    material.onBeforeRender();
    expect(material.uniforms.uFaded?.value).toBe(0);
    expect(material.color.r).toBe(1);
    expect(material.color.g).toBe(1);
  });
});

describe('hiérarchie du trait', () => {
  it('à la vue large seules les grandes silhouettes sont cernées; de près, tout', () => {
    const wide = rankWeights(1366 / 28);
    const game = rankWeights(1366 / 18);
    const close = rankWeights(1366 / 6);
    expect(wide[0]).toBe(1);
    expect(wide[4]).toBe(0);
    expect(game[0]).toBe(1);
    expect(game[3] ?? 0).toBeLessThan(1);
    expect(close.every((w) => w === 1)).toBe(true);
    for (let i = 1; i < 5; i++) expect(game[i] ?? 0).toBeLessThanOrEqual(game[i - 1] ?? 0);
    expect(detailShare(20, INK_SETTINGS.detail.painted)).toBe(0);
    expect(detailShare(200, INK_SETTINGS.detail.painted)).toBe(1);
  });
});

describe('caméra du style encré', () => {
  it('50 degrés au zoom de jeu de 18 m et au-delà, 35 degrés au plus près', () => {
    const settings = { ...RENDER_SETTINGS.camera, ...INK_SETTINGS.camera };
    const rig = new CameraRig(settings);
    const deg = (): number => (rig.pose().pitch * 180) / Math.PI;
    expect(rig.pose().width).toBe(18);
    expect(deg()).toBeCloseTo(50, 5);
    rig.set(45, 28);
    expect(deg()).toBeCloseTo(50, 5);
    rig.set(45, 6);
    expect(deg()).toBeCloseTo(35, 5);
    rig.set(45, 10);
    expect(deg()).toBeGreaterThan(35);
    expect(deg()).toBeLessThan(50);
  });
});

describe('carte du sol', () => {
  const field: GroundField = {
    width: 2,
    height: 2,
    names: ['herbe', 'quai', 'eau', 'annexe'],
    looks: [
      { color: '#8fae5b', surface: 'herbe' },
      { color: '#cfc4b0', surface: 'pave' },
      { color: '#4d8aa0', surface: 'eau', water: true },
      { color: '#000000', surface: 'pave', hidden: true },
    ],
    cells: new Uint8Array([0, 1, 2, 3]),
    wild: new Uint8Array(4),
  };

  it('teinte d’écran telle qu’écrite, couche de traits, herbe et sols posés par l’homme', () => {
    const data = groundMapBytes(field, '#6e5a42');
    expect([...data.slice(0, 3)]).toEqual([0x8f, 0xae, 0x5b]);
    expect(data[3]).toBe(LAYER.grass + 16);
    // Quai dallé: motif serré (bit 6) et bord droit (bit 7).
    expect(data[7]).toBe(LAYER.slab + 64 + 128);
    // L'eau se lit comme la terre de sa berge: le bord de l'eau ondule dans la boue.
    expect([...data.slice(8, 11)]).toEqual([0x6e, 0x5a, 0x42]);
    expect(data[11]).toBe(LAYER.dirt);
    expect(data[15]).toBe(LAYER.plain + 128);
  });

  it('pièces: plancher sur leur emprise', () => {
    const data = groundMapBytes(field, '#6e5a42', INK_SETTINGS.ground, [
      { id: 'piece', at: { x: 1, y: 1 }, width: 1, height: 1 },
    ]);
    expect(data[15]).toBe(LAYER.wood + 128);
  });

  it('sol déclaré d’un petit lieu: plancher, tapis, vide à la teinte du dehors', () => {
    const data = floorMapBytes(
      { nature: 'vide', areas: [{ x: 0, y: 0, w: 1, h: 1, nature: 'plancher' }] },
      2,
      1,
      '#05070d',
    );
    expect(data[3]).toBe(LAYER.wood + 128);
    expect([...data.slice(4, 8)]).toEqual([0x05, 0x07, 0x0d, LAYER.plain + 128]);
  });
});

describe('pièces et rails', () => {
  it('murs coupés tout autour, un vide à la porte', () => {
    const room = { id: 'piece', at: { x: 10, y: 20 }, width: 6, height: 4 };
    const closed = interiorWalls(room, []);
    const open = interiorWalls(room, [{ x: 13, y: 23.5 }]);
    // Deux boîtes par mur plein (soubassement et mur); la porte coupe le mur sud en deux.
    expect(closed).toHaveLength(8);
    expect(open).toHaveLength(10);
    const south = open.filter((box) => box.z > 24 && box.w > 0.5);
    for (const box of south) expect(Math.abs(box.x - 13) - box.w / 2).toBeGreaterThanOrEqual(0.6);
  });

  it('les voies tracées par le plan font foi: aucun rail sur les trajets des pièces', () => {
    const graph = {
      nodes: { a: { x: 0, y: 0 }, b: { x: 4, y: 0 } },
      edges: [{ a: 'a', b: 'b', kind: 'interieur' as const, lock: null }],
    };
    expect(railSegments({ graph })).toEqual([]);
    expect(
      railSegments({
        graph,
        rails: [
          {
            id: 'ligne',
            points: [
              [0, 5],
              [8, 5],
              [16, 6],
            ],
          },
        ],
      }),
    ).toHaveLength(2);
  });
});

describe('lampes d’un lieu', () => {
  const volume = (id: string, model: string | null): SceneVolume => ({
    id,
    model,
    x: 4,
    y: 6,
    w: 1,
    h: 1,
    rotation: 0,
    base: 0,
    height: 1,
    shape: 'box',
    occludes: false,
    aimable: false,
  });

  it('un modèle d’une famille éclairante devient une lampe, à la hauteur de son foyer', () => {
    const manifest = {
      format: 'duo-decors/1' as const,
      models: {
        'lampe-factice': {
          file: 'x.glb',
          family: 'reverbere',
          triangles: 10,
          size: { w: 0.4, d: 0.4, h: 3 },
        },
        'banc-factice': {
          file: 'x.glb',
          family: 'banc',
          triangles: 10,
          size: { w: 1, d: 1, h: 1 },
        },
      },
    };
    const lights = placeLights(
      [volume('a', 'lampe-factice'), volume('b', 'banc-factice'), volume('c', null)],
      { lamps: [{ x: 0, y: 2, z: 0, radius: 5, shadow: true }], windows: [] },
      manifest,
    );
    expect(lights.lamps).toHaveLength(2);
    expect(lights.lamps[1]?.y).toBeCloseTo(
      3 * (INK_SETTINGS.lampFamilies.reverbere?.heightShare ?? 0),
    );
    expect(lights.lamps[1]?.z).toBe(6);
  });
});

describe('mise en route étalée', () => {
  it('une famille de maillages par image, la passe d’ombre à l’image suivante', () => {
    const root = new Group();
    const uniforms = createInkUniforms();
    const material = new InkMaterial(uniforms);
    const plain = new Mesh(new BoxGeometry(1, 1, 1), material);
    plain.castShadow = true;
    const instanced = new InstancedMesh(new BoxGeometry(1, 1, 1), material, 2);
    instanced.castShadow = true;
    root.add(plain, instanced);
    const stages = new StageSort();
    const shown = (o: Object3D, layer: number): boolean => (o.layers.mask & (1 << layer)) !== 0;
    // Image 1: rien (la passe de contour seule). Puis une admission par image.
    stages.sort(root);
    expect(shown(plain, 0)).toBe(false);
    stages.sort(root);
    expect(shown(plain, 0)).toBe(true);
    expect(shown(plain, SUN_LAYER)).toBe(false);
    expect(shown(instanced, 0)).toBe(false);
    stages.sort(root);
    expect(shown(plain, SUN_LAYER)).toBe(true);
    expect(stages.pending).toBe(true);
    for (let i = 0; i < 4; i++) stages.sort(root);
    expect(stages.pending).toBe(false);
    expect(shown(instanced, 0)).toBe(true);
    expect(shown(instanced, SUN_LAYER)).toBe(true);
    // Le semis instancié ne porte pas d'ombre de lampe.
    expect(shown(instanced, LAMP_LAYER)).toBe(false);
    expect(shown(plain, LAMP_LAYER)).toBe(true);
    plain.castShadow = false;
    stages.sort(root);
    expect(shown(plain, SUN_LAYER)).toBe(false);
  });
});

describe('pose assise', () => {
  function leg(): { root: Object3D; upper: Object3D; lower: Object3D; foot: Object3D } {
    const root = new Object3D();
    const upper = new Object3D();
    const lower = new Object3D();
    const foot = new Object3D();
    // Assis: cuisse à l'horizontale vers l'avant (+z), tibia vers le bas.
    root.position.set(0, 0.5, 0);
    upper.rotation.x = Math.PI / 2;
    lower.position.set(0, 0.4, 0);
    lower.rotation.x = -Math.PI / 2;
    foot.position.set(0, 0.4, 0);
    root.add(upper);
    upper.add(lower);
    lower.add(foot);
    root.updateMatrixWorld(true);
    return { root, upper, lower, foot };
  }
  const at = (o: Object3D): Vector3 => o.getWorldPosition(new Vector3());

  it('ramène la cheville à sa cible sans changer la longueur des os', () => {
    const l = leg();
    const before = at(l.foot);
    for (const lift of [0.06, -0.07]) {
      // Assise plus haute ou plus basse que celle du clip: le bassin monte, le pied reste au sol.
      l.root.position.y = 0.5 + lift;
      l.root.updateMatrixWorld(true);
      const pose = new LegPose([l]);
      pose.keep();
      expect(solveLeg(l, before)).toBe(true);
      expect(at(l.foot).distanceTo(before)).toBeLessThan(1e-4);
      expect(at(l.upper).distanceTo(at(l.lower))).toBeCloseTo(0.4, 5);
      expect(at(l.lower).distanceTo(at(l.foot))).toBeCloseTo(0.4, 5);
      // Le genou reste devant la hanche, au-dessus du pied: la jambe plie dans son plan.
      expect(at(l.lower).z).toBeGreaterThan(0.2);
      expect(Math.abs(at(l.lower).x)).toBeLessThan(1e-6);
      pose.restore();
      l.root.updateMatrixWorld(true);
    }
  });

  it('jambe trop courte: elle garde la pose du clip, le pied pend', () => {
    const l = leg();
    const rest = l.upper.quaternion.clone();
    expect(solveLeg(l, new Vector3(0, -0.6, 0.4))).toBe(false);
    expect(l.upper.quaternion.equals(rest)).toBe(true);
  });

  it('entre les accoudoirs, quel que soit l’écart demandé', () => {
    expect(clampAlongSeat(0.5, 0.85, 0.47)).toBeCloseTo(0.38, 5);
    expect(clampAlongSeat(-0.5, 0.85, 0.47)).toBeCloseTo(-0.38, 5);
    expect(clampAlongSeat(0.2, 0.85, 0.47)).toBe(0.2);
    expect(clampAlongSeat(0.3, 0.4, 0.47)).toBe(0);
  });
});
