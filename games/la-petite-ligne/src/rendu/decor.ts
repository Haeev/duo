/**
 * Décor statique de la carte (bâtiments, quai, arbres et buissons du décor,
 * barrières, lampadaires...): chaque objet est tiré de son modèle GLB par nom de
 * nœud (ou de son substitut), puis tout est fusionné par matériau et par
 * morceau (`RENDER_SETTINGS.terrain.chunkSize`, petits morceaux regroupés).
 * Quelques dizaines d'appels de dessin pour tout le bourg, et l'élimination
 * hors champ garde son effet.
 *
 * Les objets qui changent (maisonnette, poulailler, remise, barrières du
 * passage à niveau) sont laissés aux parties qui les animent.
 */
import type { BufferGeometry } from 'three';
import { BufferAttribute, Group, Matrix4, Mesh, Quaternion, Vector3, type Material } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { Season } from '../donnees/types';
import type { GameMap, MapProp } from '../etat/carte';
import { yawFromQuarter } from './contexte';
import type { SharedMaterials } from './materiaux';
import { animatedNodes, type ModelLibrary, type ModelPart } from './modeles';
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

/**
 * Pièces d'un modèle du décor laissées à une autre partie (tour 9: l'arceau du puits ouvert,
 * caché quand le toit du puits est bâti, `chantiers.ts`).
 */
export const DYNAMIC_PART_NODES: ReadonlySet<string> = new Set(['well_gallows']);

/** Sols posés: leur base est au niveau du terrain, pas sur le sol surélevé qu'ils créent. */
/** Suffixe des morceaux de décor hors de la passe d'ombre. */
const SHADOWLESS = ':sans-ombre';
const FLOOR_MODELS: ReadonlySet<string> = new Set(Object.keys(RENDER_SETTINGS.floorProps));

const KEPT_ATTRIBUTES = ['position', 'normal', 'uv'] as const;
const VERTICES_PER_TRIANGLE = 3;
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
  const offset = RENDER_SETTINGS.propOffsets[prop.model] ?? [0, 0];
  return out.compose(
    new Vector3(prop.pos.x + offset[0], ground, prop.pos.y + offset[1]),
    rotation,
    new Vector3(1, 1, 1),
  );
}

/**
 * Ouvrages du ru (tour 10: ponceau, pont, passerelle, gué de pierres) vus comme des objets de la
 * carte posés au sol, au centre de leur emprise. Le ru coule le long de Z dans les modèles
 * (`flow_axis`), le long de y sur la carte: quart 0. La passerelle du ru est tournée d'un demi-tour:
 * la carte veut son garde-corps côté amont (nord), pour ne rien masquer à la caméra par défaut.
 * Les ouvrages du bief du moulin (0.13: passerelle de la vanne, planches du halage) se posent au
 * quart 0 (`flow_axis` de l'artiste): tournée, la vanne passerait à l'aval de la passerelle.
 */
export function crossingProps(map: GameMap): MapProp[] {
  return map.crossings.map((crossing) => ({
    id: crossing.id,
    model: crossing.model,
    pos: { x: crossing.rect.x + crossing.rect.w / 2, y: crossing.rect.y + crossing.rect.h / 2 },
    rotation: crossing.kind === 'footbridge' && crossing.crosses === 'ru' ? 2 : 0,
    rect: crossing.rect,
    height: 0,
    category: 'sol',
  }));
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

/** Un point `[x, hauteur, z]` des extras de l'artiste, ou `null`. */
function spot(value: unknown): Vector3 | null {
  if (!Array.isArray(value) || value.length !== 3 || !value.every((n) => typeof n === 'number')) return null;
  const [x, y, z] = value;
  return new Vector3(x, y, z);
}

/**
 * Petits modèles posés sur un modèle par ses extras (0.13: les neuf quilles et la boule de l'allée de
 * quilles, `pin_spots` et `pin_model`, `ball_spot` et `ball_model`), dans le repère du modèle porteur.
 */
function placedOn(library: ModelLibrary, model: string): ModelPart[] {
  const extras = library.extras(model);
  const out: ModelPart[] = [];
  const add = (name: unknown, at: Vector3 | null): void => {
    if (typeof name !== 'string' || at === null || !library.has(name)) return;
    const offset = new Matrix4().makeTranslation(at.x, at.y, at.z);
    for (const part of library.parts(name)) out.push({ ...part, matrix: offset.clone().multiply(part.matrix) });
  };
  const pins: unknown = extras.pin_spots;
  if (Array.isArray(pins)) for (const p of pins) add(extras.pin_model, spot(p));
  add(extras.ball_model, spot(extras.ball_spot));
  return out;
}

/** Saisons d'une pièce (`extras.seasons` de l'artiste: fruits et fleurs des arbres), `null` toute l'année. */
function seasonsOf(library: ModelLibrary, name: string): readonly string[] | null {
  const value: unknown = library.node(name)?.userData.seasons;
  return Array.isArray(value) && value.every((item) => typeof item === 'string') ? value : null;
}

/** Morceau fusionné qui porte des pièces de saison: refait quand la saison change. */
interface SeasonalBucket {
  mesh: Mesh;
  pieces: { geometry: BufferGeometry; seasons: readonly string[] | null }[];
}

export class StaticDecor {
  readonly group = new Group();
  readonly clockHands: ClockHand[] = [];
  private readonly seasonal: SeasonalBucket[] = [];
  private season: Season | null = null;
  private readonly unsubscribe: () => void;

  constructor(
    map: GameMap,
    library: ModelLibrary,
    terrain: Terrain,
    private readonly resources: ResourceTracker,
    private readonly materials: SharedMaterials,
  ) {
    this.group.name = 'decor';
    const settings = RENDER_SETTINGS.terrain;
    const chunk = settings.chunkSize;
    const block = settings.chunkMergeBlock;
    const pieces: {
      cell: string;
      block: string;
      material: Material;
      geometry: BufferGeometry;
      seasons: readonly string[] | null;
    }[] = [];
    const cellTriangles = new Map<string, number>();
    const placement = new Matrix4();
    const world = new Matrix4();
    const drawnElsewhere = new Set(RENDER_SETTINGS.propsDrawnElsewhere);
    // Bâtiments visitables (ADR 0016): dessinés par `interieurs.ts` (coupe, contenu, portes).
    const visitable = new Set(Object.values(map.buildings).map((building) => building.prop));
    for (const prop of [...map.props, ...crossingProps(map)]) {
      if (
        DYNAMIC_PROP_MODELS.has(prop.model) ||
        drawnElsewhere.has(prop.model) ||
        visitable.has(prop.id)
      ) {
        continue;
      }
      const floor = prop.category === 'sol' || FLOOR_MODELS.has(prop.model);
      const ground = floor ? 0 : terrain.heightAt(prop.pos.x, prop.pos.y);
      propMatrix(prop, ground, placement);
      // Tout petits objets: hors de la passe d'ombre (morceaux à part, même découpage).
      // Les sols gardent la leur: le liseré d'ombre au bord du quai se voit de près.
      const caster = !(prop.height > 0 && prop.height <= settings.shadowlessBelow);
      const suffix = caster ? '' : SHADOWLESS;
      const cx = Math.floor(prop.pos.x / chunk);
      const cy = Math.floor(prop.pos.y / chunk);
      const cell = `${cx}:${cy}${suffix}`;
      const blockKey = `${Math.floor(cx / block)}:${Math.floor(cy / block)}+${suffix}`;
      // Pièces animées (roue du moulin, 0.13): dessinées par `animes.ts`, le reste du modèle ici.
      const animated = animatedNodes(library, prop.model);
      const parts = [...library.parts(prop.model, propHints(prop), prop.id), ...placedOn(library, prop.model)];
      for (const part of parts) {
        if (DYNAMIC_PART_NODES.has(part.name) || animated.has(part.name)) {
          continue;
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
        const geometry = bakeGeometry(part.geometry, world);
        pieces.push({ cell, block: blockKey, material: part.material, geometry, seasons: seasonsOf(library, part.name) });
        const triangles = geometry.getAttribute('position').count / VERTICES_PER_TRIANGLE;
        cellTriangles.set(cell, (cellTriangles.get(cell) ?? 0) + triangles);
      }
    }
    const buckets = new Map<
      string,
      { material: Material; pieces: { geometry: BufferGeometry; seasons: readonly string[] | null }[] }
    >();
    for (const piece of pieces) {
      const heavy = (cellTriangles.get(piece.cell) ?? 0) >= settings.chunkMergeBelow;
      const bucketKey = `${heavy ? piece.cell : piece.block}|${piece.material.uuid}`;
      let bucket = buckets.get(bucketKey);
      if (bucket === undefined) {
        bucket = { material: piece.material, pieces: [] };
        buckets.set(bucketKey, bucket);
      }
      bucket.pieces.push({ geometry: piece.geometry, seasons: piece.seasons });
    }
    this.season = materials.season;
    for (const [key, bucket] of buckets) {
      if (bucket.pieces.length === 0) {
        continue;
      }
      const seasonal = bucket.pieces.some((piece) => piece.seasons !== null);
      const mesh = new Mesh(this.mergeFor(bucket.pieces, this.season), bucket.material);
      mesh.name = `decor ${key}`;
      mesh.castShadow = !key.includes(SHADOWLESS);
      mesh.receiveShadow = true;
      mesh.matrixAutoUpdate = false;
      this.group.add(mesh);
      if (seasonal) {
        // Fruits et fleurs: gardés à part pour refaire ce morceau à chaque saison (même nombre d'appels).
        this.seasonal.push({ mesh, pieces: bucket.pieces });
      } else {
        for (const piece of bucket.pieces) piece.geometry.dispose();
      }
    }
    this.unsubscribe = materials.onPaletteChange(() => {
      this.applySeason(this.materials.season);
    });
  }

  /** Fusion des pièces d'un morceau qui sont de la saison (toutes celles sans saison). */
  private mergeFor(
    pieces: readonly { geometry: BufferGeometry; seasons: readonly string[] | null }[],
    season: Season,
  ): BufferGeometry {
    const shown = pieces.filter((piece) => piece.seasons === null || piece.seasons.includes(season));
    const merged = mergeGeometries(
      shown.map((piece) => piece.geometry),
      false,
    );
    merged.computeBoundingSphere();
    return this.resources.track(merged);
  }

  /** Change de saison: refait les seuls morceaux qui portent des fruits ou des fleurs. */
  applySeason(season: Season): void {
    if (season === this.season) return;
    this.season = season;
    for (const bucket of this.seasonal) {
      const old = bucket.mesh.geometry;
      bucket.mesh.geometry = this.mergeFor(bucket.pieces, season);
      this.resources.release(old);
    }
  }

  dispose(): void {
    this.unsubscribe();
    for (const bucket of this.seasonal) for (const piece of bucket.pieces) piece.geometry.dispose();
    this.seasonal.length = 0;
  }
}
