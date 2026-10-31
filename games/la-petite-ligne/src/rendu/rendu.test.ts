import { Box3, Ray, Scene, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { loadContent } from '../donnees/contenu';
import { loadMap } from '../donnees/carte';
import { MAP_FILES } from '../donnees/cartes-fichiers';
import { CONTENT_FILES } from '../donnees/fichiers';
import { SCARF_SYMBOLS, safeColor, scarfMeshFor } from './apparence';
import { valueNoise, hash2 } from './bruit';
import { IsoCameraRig, smoothFactor } from './camera';
import { PickRegistry, dampAngle, interpolate, yawFromFacing, yawFromQuarter } from './contexte';
import { DaylightRig } from './lumiere';
import { MODEL_VARIANTS, textHash } from './modeles';
import { buildSubstitute, hasDedicatedSubstitute } from './substituts';

const EPSILON = 1e-6;

describe('caméra isométrique', () => {
  it('part au sud-est, haut de l’écran vers le nord-ouest (yaw = -3 PI/4)', () => {
    const rig = new IsoCameraRig(true);
    expect(rig.yaw()).toBeCloseTo((-3 * Math.PI) / 4, 6);
    rig.update(0.016, 10, 20, 0, 0, null);
    // La caméra est derrière le point suivi, à l'opposé du haut de l'écran: à l'est et au sud.
    expect(rig.camera.position.x).toBeGreaterThan(10);
    expect(rig.camera.position.z).toBeGreaterThan(20);
    expect(rig.camera.position.y).toBeGreaterThan(0);
  });

  it('tourne par quarts de tour et donne la convention de marche annoncée', () => {
    const rig = new IsoCameraRig(true);
    const start = rig.yaw();
    rig.command('rotate_right');
    expect(rig.yaw() - start).toBeCloseTo(Math.PI / 2, 6);
    rig.command('rotate_left');
    rig.command('rotate_left');
    expect(rig.quarter()).toBe(3);
  });

  it('a trois zooms de 16, 24 et 36 m de largeur de vue', () => {
    const rig = new IsoCameraRig(true);
    rig.setAspect(16 / 9);
    rig.update(0.016, 0, 0, 0, 0, null);
    expect(rig.viewWidth()).toBe(24);
    rig.command('zoom_in');
    rig.update(0.016, 0, 0, 0, 0, null);
    expect(rig.viewWidth()).toBe(16);
    rig.command('zoom_in');
    rig.command('zoom_out');
    rig.command('zoom_out');
    rig.update(0.016, 0, 0, 0, 0, null);
    expect(rig.viewWidth()).toBe(36);
    expect(rig.camera.right - rig.camera.left).toBeCloseTo(36, 6);
  });

  it('vise le point suivi au centre de l’écran', () => {
    const rig = new IsoCameraRig(true);
    rig.setAspect(1);
    rig.snapTo(12, 8);
    rig.update(0, 12, 8, 0, 0, null);
    const hit = rig.groundAt(0, 0, 0);
    expect(hit?.x).toBeCloseTo(12, 4);
    expect(hit?.z).toBeCloseTo(8, 4);
  });

  it('lisse le suivi indépendamment de la fréquence d’image', () => {
    const half = 0.12;
    const twoSmall = 1 - (1 - smoothFactor(0.01, half)) ** 2;
    expect(twoSmall).toBeCloseTo(smoothFactor(0.02, half), 6);
    expect(smoothFactor(half, half)).toBeCloseTo(0.5, 6);
  });
});

describe('repères et interpolation', () => {
  it('interpole entre prev et pos', () => {
    const out = { x: 0, y: 0 };
    interpolate({ x: 0, y: 0 }, { x: 2, y: 4 }, 0.25, out);
    expect(out).toEqual({ x: 0.5, y: 1 });
  });

  it('oriente un modèle qui regarde +Z vers la direction de facing', () => {
    // facing 0: vers l'est (+X). Un modèle tourné de rotation.y envoie +Z vers (sin r, 0, cos r).
    const east = yawFromFacing(0);
    expect(Math.sin(east)).toBeCloseTo(1, 6);
    expect(Math.cos(east)).toBeCloseTo(0, 6);
    const south = yawFromFacing(Math.PI / 2);
    expect(Math.cos(south)).toBeCloseTo(1, 6);
  });

  it('suit la convention de rotation de la carte (1: façade à l’est)', () => {
    const r = yawFromQuarter(1);
    expect(Math.sin(r)).toBeCloseTo(1, 6);
  });

  it('tourne par le plus court chemin', () => {
    const near = dampAngle(Math.PI - 0.1, -Math.PI + 0.1, 0.5);
    expect(Math.abs(Math.abs(near) - Math.PI)).toBeLessThan(0.01 + EPSILON);
  });

  it('désigne au clic la cible la plus proche', () => {
    const picks = new PickRegistry();
    const far = picks.add({ kind: 'tree', tree: 'loin' });
    far.box = new Box3(new Vector3(-1, -1, 9), new Vector3(1, 1, 11));
    far.enabled = true;
    const near = picks.add({ kind: 'villager', villager: 'odette' });
    near.box = new Box3(new Vector3(-1, -1, 4), new Vector3(1, 1, 6));
    near.enabled = true;
    const ray = new Ray(new Vector3(0, 0, 0), new Vector3(0, 0, 1));
    expect(picks.nearest(ray)?.result).toEqual({ kind: 'villager', villager: 'odette' });
    near.enabled = false;
    expect(picks.nearest(ray)?.result).toEqual({ kind: 'tree', tree: 'loin' });
  });
});

describe('lumière du jour', () => {
  it('à 17 h 15 par soleil, l’ombre de la cloche part vers l’est et touche le banc', () => {
    const map = loadMap(MAP_FILES).map;
    const rig = new DaylightRig(new Scene());
    rig.update(17 * 60 + 15, 'sunny', new Vector3(), 10, 80);
    // La lumière vient de l'ouest: l'ombre part vers l'est (+X).
    expect(rig.direction.x).toBeLessThan(-0.5);
    const bell = map.props.find((prop) => prop.model === 'bell_post');
    const bench = map.points.quay_bench;
    expect(bell).toBeDefined();
    expect(bench).toBeDefined();
    if (bell === undefined || bench === undefined) {
      return;
    }
    const height = bell.height > 0 ? bell.height : 3;
    const elevation = Math.asin(rig.direction.y);
    const shadowLength = height / Math.tan(elevation);
    const distance = Math.hypot(bench.x - bell.pos.x, bench.y - bell.pos.y);
    expect(shadowLength).toBeGreaterThanOrEqual(distance - 0.5);
  });

  it('allume les fenêtres la nuit et les éteint à midi', () => {
    const rig = new DaylightRig(new Scene());
    rig.update(12 * 60, 'sunny', new Vector3(), 10, 80);
    expect(rig.night).toBe(0);
    rig.update(23 * 60, 'sunny', new Vector3(), 10, 80);
    expect(rig.night).toBe(1);
  });

  it('adoucit les ombres sous la pluie', () => {
    const rig = new DaylightRig(new Scene());
    rig.update(12 * 60, 'sunny', new Vector3(), 10, 80);
    const sunny = rig.sun.shadow.intensity;
    rig.update(12 * 60, 'rain', new Vector3(), 10, 80);
    expect(rig.sun.shadow.intensity).toBeLessThan(sunny);
    // Biais normal proportionnel au texel: pas d'acné à aucun zoom.
    expect(rig.sun.shadow.normalBias).toBeGreaterThan(0);
  });
});

describe('substituts', () => {
  const content = loadContent(CONTENT_FILES);

  it('donne une forme à chaque objet, meuble et stade de culture des données', () => {
    const names = new Set<string>();
    for (const item of Object.values(content.items)) {
      names.add(item.model);
    }
    for (const crop of Object.values(content.crops)) {
      for (const stage of ['seed', 'sprout', 'young', 'ripe']) {
        names.add(`${crop.id}_stage_${stage}`);
      }
    }
    for (const name of names) {
      const parts = buildSubstitute(name, { width: 2, depth: 1 });
      expect(parts.length, name).toBeGreaterThan(0);
      const geometry = parts[0]?.geometry;
      expect(geometry?.getAttribute('position').count ?? 0, name).toBeGreaterThan(0);
      expect(geometry?.getAttribute('uv'), name).toBeDefined();
      expect(hasDedicatedSubstitute(name), name).toBe(true);
      geometry?.dispose();
    }
  });

  it('montre une caisse rayée pour un nom inconnu, sans erreur', () => {
    expect(hasDedicatedSubstitute('objet_inconnu_42')).toBe(false);
    const [part] = buildSubstitute('objet_inconnu_42');
    expect(part?.geometry.getAttribute('position').count ?? 0).toBeGreaterThan(0);
  });

  it('a des variantes pour les types de décor de la carte', () => {
    const map = loadMap(MAP_FILES).map;
    const types = new Set(map.props.map((prop) => prop.model));
    for (const name of ['tree_oak', 'tree_fir', 'bush', 'rock', 'fence']) {
      if (types.has(name)) {
        expect(MODEL_VARIANTS[name]?.length ?? 0, name).toBeGreaterThan(0);
      }
    }
  });
});

describe('aides', () => {
  it('choisit la forme du foulard selon la couleur du profil', () => {
    for (const symbol of SCARF_SYMBOLS) {
      expect(scarfMeshFor(symbol.color)).toBe(symbol.mesh);
    }
    expect(safeColor('pas une couleur')).toBe(SCARF_SYMBOLS[0]?.color);
  });

  it('a un bruit et un hachage déterministes', () => {
    expect(hash2(3, 4, 1)).toBe(hash2(3, 4, 1));
    expect(valueNoise(10.5, 3.25, 5)).toBe(valueNoise(10.5, 3.25, 5));
    expect(textHash('tree_edge_01')).toBe(textHash('tree_edge_01'));
    const n = valueNoise(7.3, 2.9, 4);
    expect(n).toBeGreaterThanOrEqual(0);
    expect(n).toBeLessThanOrEqual(1);
  });
});
