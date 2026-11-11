/**
 * Bâtiments livrés d'un lieu (`assets/lieux/<lieu>/batiments/`, manifeste `batiments.json`): pour
 * chaque identifiant de `buildings` de la carte, son modèle fusionné en une seule géométrie (un
 * appel de dessin par bâtiment) et ses fenêtres du rez-de-chaussée (rectangles de lumière la
 * nuit). La couche de traits de chaque morceau vient du NOM de son matériau (`pierre`, `tuile`,
 * `vitre`...), table `INK_SETTINGS.materials`; la teinte vient des couleurs de sommets. Un
 * bâtiment sans modèle garde ses volumes provisoires. Aucun bâtiment n'est nommé ici: en livrer
 * un de plus, c'est un fichier et une entrée du manifeste.
 */
import type { BufferGeometry, Mesh, Object3D } from 'three';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import * as v from 'valibot';
import { BuildingManifestSchema, type BuildingManifest } from '../../donnees/schemas/batiment';
import { inkTag } from '../encre/conversion';
import { inkCode, KIND, LAYER } from '../encre/couches';
import type { WindowLight } from '../encre/matiere';
import { INK_SETTINGS } from '../encre/reglages';
import type { BuildingSheet } from './pieces';

const URLS = import.meta.glob<string>('../../../assets/lieux/*/batiments/*.glb', {
  query: '?url',
  import: 'default',
  eager: true,
});
const MANIFESTS = import.meta.glob<unknown>('../../../assets/lieux/*/batiments/batiments.json', {
  import: 'default',
  eager: true,
});

export interface BuildingModel {
  /** Géométrie fusionnée, origine au milieu de l'emprise, au sol; elle reste à la source. */
  readonly geometry: BufferGeometry;
  readonly height: number;
  /** Ouvertures vitrées du rez-de-chaussée, dans le repère du bâtiment (m depuis le milieu de l'emprise). */
  readonly windows: readonly WindowLight[];
}

/** Ce que le rendu d'un lieu demande: le modèle d'un bâtiment de la carte, ou `null`. */
export interface BuildingSource {
  model(place: string, id: string): BuildingModel | null;
  /**
   * Fiche du manifeste (emprise, façade de la porte, fenêtres), connue dès le démarrage, que le
   * modèle soit chargé ou non: les pièces en tirent leurs fenêtres. Absente: aucune fiche.
   */
  sheet?(place: string, id: string): BuildingSheet | null;
}

function isMesh(object: Object3D): object is Mesh {
  return (object as Partial<Mesh>).isMesh === true;
}

/**
 * Fusionne les maillages d'un bâtiment (un par matériau) en une géométrie encrée: couche et
 * nature d'après le nom du matériau, morceaux d'un seul tenant, une seule pièce de contour.
 */
export function mergeBuilding(
  root: Object3D,
  index: number,
  materials: typeof INK_SETTINGS.materials = INK_SETTINGS.materials,
): BufferGeometry | null {
  const parts: BufferGeometry[] = [];
  root.updateMatrixWorld(true);
  root.traverse((object) => {
    if (!isMesh(object)) return;
    const material = Array.isArray(object.material) ? object.material[0] : object.material;
    const rule = materials[material?.name ?? ''];
    // Chaque matériau commence ses numéros de morceau plus loin: la pierre et la tuile d'à côté
    // ne partagent jamais un numéro, le trait passe entre elles.
    const partStart = parts.length * 17;
    const geometry = object.geometry.clone();
    geometry.applyMatrix4(object.matrixWorld);
    inkTag(
      geometry,
      rule === undefined
        ? { partStart }
        : {
            partStart,
            layer: LAYER[rule.layer],
            kind: rule.window === true ? KIND.window : KIND.none,
          },
    );
    // Seuls les attributs lus par le matériau encré: les maillages fusionnés doivent avoir les mêmes.
    for (const name of Object.keys(geometry.attributes))
      if (!['position', 'normal', 'color', 'aInk'].includes(name)) geometry.deleteAttribute(name);
    parts.push(geometry);
  });
  if (parts.length === 0) return null;
  const merged = mergeGeometries(parts);
  for (const part of parts) part.dispose();
  merged.computeBoundingBox();
  merged.computeBoundingSphere();
  const box = merged.boundingBox;
  const diagonal =
    box === null
      ? 10
      : Math.hypot(box.max.x - box.min.x, box.max.y - box.min.y, box.max.z - box.min.z);
  // Une seule pièce de contour pour tout le bâtiment, ses morceaux gardent leur trait intérieur.
  const ink = merged.getAttribute('aInk');
  const code = inkCode(index, diagonal);
  for (let i = 0; i < ink.count; i++) ink.setY(i, code);
  return merged;
}

export class PlaceBuildings implements BuildingSource {
  private readonly models = new Map<string, BuildingModel>();
  private readonly sheets = new Map<string, BuildingSheet>();
  /** Résolue quand tous les bâtiments sont chargés (ou ont échoué: volumes provisoires). */
  readonly ready: Promise<void>;

  constructor(
    manifests: Readonly<Record<string, unknown>> = MANIFESTS,
    load: (url: string) => Promise<GLTF> = (url) => new GLTFLoader().loadAsync(url),
    urls: Readonly<Record<string, string>> = URLS,
  ) {
    const jobs: Promise<void>[] = [];
    for (const [path, raw] of Object.entries(manifests)) {
      const parsed = v.safeParse(BuildingManifestSchema, raw);
      if (!parsed.success) continue;
      const manifest: BuildingManifest = parsed.output;
      const folder = path.slice(0, path.lastIndexOf('/') + 1);
      Object.entries(manifest.batiments).forEach(([id, sheet], index) => {
        this.sheets.set(`${manifest.lieu}/${id}`, {
          width: sheet.emprise.largeur,
          depth: sheet.emprise.profondeur,
          door: sheet.porte?.facade ?? null,
          windows: sheet.fenetres.map((w) => ({
            x: w.x,
            z: w.z,
            nx: w.nx,
            nz: w.nz,
            width: w.largeur,
            sill: w.appui,
            height: w.hauteur,
          })),
        });
        const url = urls[`${folder}${sheet.fichier}`];
        if (url === undefined) return;
        jobs.push(
          load(url).then(
            (gltf) => {
              const node = gltf.scene.getObjectByName(sheet.noeud) ?? gltf.scene;
              const geometry = mergeBuilding(node, index);
              if (geometry === null) return;
              this.models.set(`${manifest.lieu}/${id}`, {
                geometry,
                height: sheet.hauteur,
                // Fenêtres, puis devantures, portes à carreaux et vitraux: tout ce qui éclaire dehors.
                windows: [...sheet.fenetres, ...(sheet.lueurs ?? [])].map((w) => ({
                  x: w.x,
                  sill: w.appui,
                  z: w.z,
                  width: w.largeur,
                  height: w.hauteur,
                  nx: w.nx,
                  nz: w.nz,
                })),
              });
            },
            // Fichier manquant ou abîmé: ce bâtiment garde ses volumes provisoires.
            () => undefined,
          ),
        );
      });
    }
    this.ready = Promise.all(jobs).then(() => undefined);
  }

  model(place: string, id: string): BuildingModel | null {
    return this.models.get(`${place}/${id}`) ?? null;
  }

  sheet(place: string, id: string): BuildingSheet | null {
    return this.sheets.get(`${place}/${id}`) ?? null;
  }

  get size(): number {
    return this.models.size;
  }
}

let shared: PlaceBuildings | null = null;

/** La source du jeu, créée au premier appel et partagée par tous les lieux. */
export function gamePlaceBuildings(): PlaceBuildings {
  shared ??= new PlaceBuildings();
  return shared;
}
