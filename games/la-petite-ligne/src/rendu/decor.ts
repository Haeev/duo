/**
 * Décor statique de la carte (bâtiments, quai, arbres et buissons du décor,
 * barrières, lampadaires...): chaque objet est tiré de son modèle GLB par nom de
 * nœud (ou de son substitut), puis tout est fusionné par matériau et par
 * morceau de 16 m de côté. Quelques dizaines d'appels de dessin pour tout le
 * bourg, et l'élimination hors champ garde son effet.
 *
 * Les objets qui changent (maisonnette, poulailler, remise, barrières du
 * passage à niveau) sont laissés aux parties qui les animent.
 */
import type { BufferGeometry } from 'three';
import { BufferAttribute, Group, Matrix4, Mesh, Quaternion, Vector3, type Material } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { GameMap, MapProp } from '../etat/carte';
import { yawFromQuarter } from './contexte';
import type { ModelLibrary } from './modeles';
import { RENDER_SETTINGS } from './reglages';
import type { ResourceTracker } from './ressources';
import type { SubstituteHints } from './substituts';
import type { Terrain } from './terrain';

/** Types d'objets dessinés par une autre partie du rendu (ils changent pendant la partie). */
export const DYNAMIC_PROP_MODELS: ReadonlySet<string> = new Set([
  'gatekeeper_house',
  'henhouse',
  'handcar_shed',
  'level_crossing_gate',
]);

/** Sols posés: leur base est au niveau du terrain, pas sur le sol surélevé qu'ils créent. */
/** Suffixe des morceaux de décor hors de la passe d'ombre. */
const SHADOWLESS = ':sans-ombre';
const FLOOR_MODELS: ReadonlySet<string> = new Set(Object.keys(RENDER_SETTINGS.floorProps));

const KEPT_ATTRIBUTES = ['position', 'normal', 'uv'] as const;
const Y_AXIS = new Vector3(0, 1, 0);

/** Emprise d'un objet à la rotation 0 (la carte donne le rectangle déjà tourné). */
export function propHints(prop: MapProp): SubstituteHints {
  if (prop.rect === null) {
    return {};
  }
  const odd = prop.rotation % 2 !== 0;
  return { width: odd ? prop.rect.h : prop.rect.w, depth: odd ? prop.rect.w : prop.rect.h };
}

/** Matrice de pose d'un objet de la carte (centre de l'emprise, au sol, tourné par quarts). */
export function propMatrix(prop: MapProp, ground: number, out: Matrix4): Matrix4 {
  const rotation = new Quaternion().setFromAxisAngle(Y_AXIS, yawFromQuarter(prop.rotation));
  return out.compose(new Vector3(prop.pos.x, ground, prop.pos.y), rotation, new Vector3(1, 1, 1));
}

/** Copie d'une géométrie réduite aux attributs communs, sans index, placée par `matrix`. */
export function bakeGeometry(source: BufferGeometry, matrix: Matrix4): BufferGeometry {
  const flat = source.index === null ? source.clone() : source.toNonIndexed();
  for (const name of Object.keys(flat.attributes)) {
    if (!(KEPT_ATTRIBUTES as readonly string[]).includes(name)) {
      flat.deleteAttribute(name);
    }
  }
  if (!flat.hasAttribute('uv')) {
    flat.setAttribute(
      'uv',
      new BufferAttribute(new Float32Array(flat.getAttribute('position').count * 2), 2),
    );
  }
  if (!flat.hasAttribute('normal')) {
    flat.computeVertexNormals();
  }
  flat.morphAttributes = {};
  flat.applyMatrix4(matrix);
  return flat;
}

/** Aiguille d'horloge tirée du décor fusionné, pour la faire tourner avec l'heure du jeu. */
export interface ClockHand {
  mesh: Mesh;
  /** Pose de l'aiguille à midi (rotation appliquée par-dessus, autour de son axe Z). */
  base: Matrix4;
  kind: 'hour' | 'minute';
}

const CLOCK_HAND = /_clock_(hour|minute)$/;

export class StaticDecor {
  readonly group = new Group();
  readonly clockHands: ClockHand[] = [];

  constructor(map: GameMap, library: ModelLibrary, terrain: Terrain, resources: ResourceTracker) {
    this.group.name = 'decor';
    const buckets = new Map<string, { material: Material; geometries: BufferGeometry[] }>();
    const chunk = RENDER_SETTINGS.terrain.chunkSize;
    const placement = new Matrix4();
    const world = new Matrix4();
    for (const prop of map.props) {
      if (DYNAMIC_PROP_MODELS.has(prop.model)) {
        continue;
      }
      const floor = prop.category === 'sol' || FLOOR_MODELS.has(prop.model);
      const ground = floor ? 0 : terrain.heightAt(prop.pos.x, prop.pos.y);
      propMatrix(prop, ground, placement);
      // Tout petits objets: hors de la passe d'ombre (morceaux à part, même découpage).
      // Les sols gardent la leur: le liseré d'ombre au bord du quai se voit de près.
      const caster = !(prop.height > 0 && prop.height <= RENDER_SETTINGS.terrain.shadowlessBelow);
      const key = `${Math.floor(prop.pos.x / chunk)}:${Math.floor(prop.pos.y / chunk)}${caster ? '' : SHADOWLESS}`;
      for (const part of library.parts(prop.model, propHints(prop), prop.id)) {
        const bucketKey = `${key}|${part.material.uuid}`;
        let bucket = buckets.get(bucketKey);
        if (bucket === undefined) {
          bucket = { material: part.material, geometries: [] };
          buckets.set(bucketKey, bucket);
        }
        world.multiplyMatrices(placement, part.matrix);
        const hand = CLOCK_HAND.exec(part.name);
        if (hand !== null) {
          const mesh = new Mesh(part.geometry, part.material);
          mesh.matrixAutoUpdate = false;
          mesh.matrix.copy(world);
          this.group.add(mesh);
          this.clockHands.push({
            mesh,
            base: world.clone(),
            kind: hand[1] === 'hour' ? 'hour' : 'minute',
          });
          continue;
        }
        bucket.geometries.push(bakeGeometry(part.geometry, world));
      }
    }
    for (const [key, bucket] of buckets) {
      if (bucket.geometries.length === 0) {
        continue;
      }
      const merged = mergeGeometries(bucket.geometries, false);
      for (const geometry of bucket.geometries) {
        geometry.dispose();
      }
      merged.computeBoundingSphere();
      const mesh = new Mesh(resources.track(merged), bucket.material);
      mesh.name = `decor ${key}`;
      mesh.castShadow = !key.includes(SHADOWLESS);
      mesh.receiveShadow = true;
      mesh.matrixAutoUpdate = false;
      this.group.add(mesh);
    }
  }
}
