/**
 * Les récoltables à l'écran, lus dans l'état déjà transmis (rien de plus sur le réseau): l'état
 * montré de chaque meuble (arbre abattu, buisson cueilli, rocher entamé, stock vide), les cases du
 * potager et leurs plants, les repères des coins de pêche et des zones à insectes, le modèle d'un
 * objet posé au sol. Logique pure, sans Three.js: le moteur en fait des volumes (`lieu.ts`).
 *
 * Rien n'y nomme un meuble, une ressource ni une culture: les états viennent des fiches (`after`
 * d'une ressource, briques du meuble), les modèles du manifeste des décors et de `reglages-recoltes`.
 */
import { decodeTerrain } from '../../donnees/carte';
import type { Content, PlaceContent } from '../../donnees/charger';
import type { Brick } from '../../donnees/schemas/briques';
import type { BrickStates } from '../../etat/briques';
import type { PlaceState } from '../../etat/lieu';
import type { DeepReadonly } from '../../etat/monde';
import { gatherLeft } from '../../simulation/briques/cueillir';
import type { Look } from '../../simulation/briques/types';
import { isRipe, stageOf } from '../../simulation/cultures/potager';
import { footprintOf } from '../../simulation/noyau/obstacles';
import { resourceReady } from '../../simulation/outils/ressources';
import {
  cropModel,
  DECOR_MANIFEST,
  type DecorManifest,
  keyDraw,
  stateModel,
} from './decors-manifeste';
import type { SceneVolume } from './description';
import { HARVEST_LOOK, type HarvestLookSettings } from './reglages-recoltes';
import { DEFAULT_LOOK, GROUND_LOOKS, type SurfaceKind } from './reglages-tuiles';

type ReadStates = DeepReadonly<BrickStates>;
type ReadPlace = DeepReadonly<PlaceState>;

/** Un meuble posé (carte ou joueurs): ce qu'en lit le rendu. */
interface Instance {
  readonly id: string;
  readonly type: string;
  readonly x: number;
  readonly y: number;
  readonly rotation: number;
}

/**
 * L'état montré d'un meuble d'après ses briques: le reste d'une ressource récoltée qui n'a pas
 * encore repoussé (`after` de sa fiche), une ressource entamée, un stock vide. `null`: l'état de
 * base. `look.gone` (« il ne reste rien ») n'a pas de modèle: le meuble n'est pas dessiné.
 */
export function objectState(
  look: Look,
  bricks: readonly Brick[],
  states: ReadStates | undefined,
  settings: HarvestLookSettings = HARVEST_LOOK,
): string | null {
  for (const brick of bricks) {
    if (brick.brick === 'harvest') {
      const resource = look.content.resources[brick.resource];
      if (resource === undefined) continue;
      if (!resourceReady(look, states?.harvest)) return resource.after;
      if ((states?.harvest?.work ?? 0) > 0) return settings.states.worked;
    } else if (brick.brick === 'gather' && brick.stock !== null && states !== undefined) {
      if (gatherLeft(look, brick, states) === 0) return settings.states.empty;
    }
  }
  return null;
}

function* instances(place: PlaceContent, state: ReadPlace): Generator<Instance> {
  yield* place.map.objects;
  yield* state.placed;
}

/** États montrés des meubles du lieu (carte et joueurs) qui ne sont pas à leur état de base. */
export function placeStates(
  look: Look,
  place: PlaceContent,
  state: ReadPlace,
  settings: HarvestLookSettings = HARVEST_LOOK,
): Map<string, string> {
  const out = new Map<string, string>();
  for (const instance of instances(place, state)) {
    const prop = look.content.props[instance.type];
    if (prop === undefined) continue;
    const shown = objectState(look, prop.bricks, state.objects[instance.id], settings);
    if (shown !== null) out.set(instance.id, shown);
  }
  return out;
}

function mix(h: number, value: number): number {
  return (Math.imul(h, 31) + value) | 0;
}

function mixText(h: number, text: string | null): number {
  if (text === null) return mix(h, 7);
  let out = h;
  for (let i = 0; i < text.length; i++) out = mix(out, text.charCodeAt(i));
  return out;
}

/**
 * Empreinte de ce que montrent les récoltables (états des meubles, cases du potager), sans
 * allocation: le moteur la lit à chaque image (un stock revient à l'heure dite, une souche
 * repousse au jour dit, sans que l'état du lieu change) et ne refait les volumes que si elle change.
 */
export function harvestSignature(
  look: Look,
  place: PlaceContent,
  state: ReadPlace,
  settings: HarvestLookSettings = HARVEST_LOOK,
): number {
  let h = 17;
  for (const instance of place.map.objects) h = signInstance(h, look, state, instance, settings);
  for (const instance of state.placed) h = signInstance(h, look, state, instance, settings);
  return h;
}

function signInstance(
  start: number,
  look: Look,
  state: ReadPlace,
  instance: Instance,
  settings: HarvestLookSettings,
): number {
  const prop = look.content.props[instance.type];
  if (prop === undefined) return start;
  const states = state.objects[instance.id];
  let h = mixText(start, objectState(look, prop.bricks, states, settings));
  const cells = states?.field?.cells;
  if (cells === undefined) return h;
  for (const plot of cells) {
    if (plot === null) {
      h = mix(h, 1);
      continue;
    }
    const crop = plot.crop === null ? undefined : look.content.crops[plot.crop];
    h = mixText(mix(h, plot.watered ? 3 : 5), plot.crop);
    if (crop !== undefined) h = mix(h, stageOf(crop, plot.growth));
  }
  return h;
}

/**
 * Cases bêchées des terres cultivables (brique `field`) et leurs plants: une case de 1 m bêchée ou
 * arrosée (états `tilled`, `watered` du modèle du meuble) et, si elle est semée, le modèle de la
 * culture à son stade, mûre ou à arroser (`cropModel`). Chaque case est à sa place dans l'emprise
 * (même grille que la simulation, rotation comprise) et se pose à la hauteur du potager.
 */
export function fieldVolumes(
  content: Content,
  place: PlaceContent,
  state: ReadPlace,
  manifest: DecorManifest = DECOR_MANIFEST,
  settings: HarvestLookSettings = HARVEST_LOOK,
): SceneVolume[] {
  const out: SceneVolume[] = [];
  for (const instance of instances(place, state)) {
    const cells = state.objects[instance.id]?.field?.cells;
    const prop = content.props[instance.type];
    if (cells === undefined || prop === undefined) continue;
    const size = footprintOf(prop, instance.rotation);
    const left = instance.x - size.w / 2;
    const top = instance.y - size.h / 2;
    const foot = { x: instance.x, y: instance.y };
    cells.forEach((plot, cell) => {
      if (plot === null) return;
      const x = left + (cell % size.w) + 0.5;
      const y = top + Math.floor(cell / size.w) + 0.5;
      const cellVolume = (id: string, model: string): SceneVolume => ({
        id,
        model,
        x,
        y,
        w: 1,
        h: 1,
        rotation: 0,
        base: 0,
        height: manifest.models[model]?.size.h ?? 0.1,
        shape: 'box',
        occludes: false,
        aimable: false,
        foot,
        batch: true,
      });
      const ground = stateModel(
        prop.model,
        plot.watered ? settings.states.watered : settings.states.tilled,
        manifest,
      );
      if (ground !== null) out.push(cellVolume(`${instance.id}-case-${String(cell)}`, ground));
      const crop = plot.crop === null ? undefined : content.crops[plot.crop];
      if (crop?.model === undefined) return;
      const ripe = isRipe(crop, plot.growth);
      const model = cropModel(
        crop.model,
        stageOf(crop, plot.growth),
        !ripe && !plot.watered,
        manifest,
      );
      if (model !== null) out.push(cellVolume(`${instance.id}-plant-${String(cell)}`, model));
    });
  }
  return out;
}

interface Rect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

/**
 * Cases où rien ne peut se planter: zones bloquées de la carte, emprises de ses meubles, et sols
 * qui ne sont pas une terre (`markers.soils`: pas de roseaux sur un ponton ni sur un pavé).
 */
function filledCells(
  content: Content,
  place: PlaceContent,
  soils: readonly SurfaceKind[],
): (x: number, y: number) => boolean {
  const { width, height } = place.map;
  const terrain = decodeTerrain(place.map);
  const legend = place.map.terrain?.legend ?? [];
  // Une nature sans rendu propre se dessine en herbe (`DEFAULT_LOOK`): elle compte comme telle.
  const soft = legend.map((name) => soils.includes((GROUND_LOOKS[name] ?? DEFAULT_LOOK).surface));
  const full = new Uint8Array(width * height);
  const fill = (r: Rect): void => {
    for (let y = Math.max(0, Math.floor(r.y)); y < Math.min(height, Math.ceil(r.y + r.h)); y++)
      for (let x = Math.max(0, Math.floor(r.x)); x < Math.min(width, Math.ceil(r.x + r.w)); x++)
        full[y * width + x] = 1;
  };
  for (const r of place.map.blocked) fill(r);
  for (const object of place.map.objects) {
    const prop = content.props[object.type];
    if (prop === undefined) continue;
    const size = footprintOf(prop, object.rotation);
    fill({ x: object.x - size.w / 2, y: object.y - size.h / 2, w: size.w, h: size.h });
  }
  return (x, y) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return true;
    const i = Math.floor(y) * width + Math.floor(x);
    return full[i] === 1 || (terrain !== null && soft[terrain[i] ?? 0] !== true);
  };
}

function marker(
  id: string,
  model: string,
  x: number,
  y: number,
  rotation: 0 | 1 | 2 | 3,
  manifest: DecorManifest,
): SceneVolume {
  const size = manifest.models[model]?.size;
  return {
    id,
    model,
    x,
    y,
    w: size?.w ?? 0.6,
    h: size?.d ?? 0.6,
    rotation,
    base: 0,
    height: size?.h ?? 0.6,
    shape: 'post',
    occludes: false,
    aimable: false,
  };
}

/**
 * Le repère d'un coin de pêche: sur la berge (la case libre la plus proche de l'étendue d'eau,
 * à `reach` cases au plus, puis la plus proche de son milieu), au bord de la case côté eau et
 * tourné vers elle (le bouchon du modèle pend du côté +x). `null`: aucune berge libre.
 */
function fishingMarker(
  id: string,
  area: Rect,
  filled: (x: number, y: number) => boolean,
  reach: number,
  model: string,
  manifest: DecorManifest,
): SceneVolume | null {
  const cx = area.x + area.w / 2;
  const cy = area.y + area.h / 2;
  let found: { x: number; y: number; dx: number; dy: number } | null = null;
  let nearest = Number.POSITIVE_INFINITY;
  // Anneau par anneau autour de l'étendue: la première berge trouvée est la plus proche de l'eau.
  for (let ring = 1; ring <= reach && found === null; ring++)
    for (let y = area.y - ring; y < area.y + area.h + ring; y++)
      for (let x = area.x - ring; x < area.x + area.w + ring; x++) {
        // Écart à l'étendue d'eau (en cases): seules les cases de cet anneau comptent.
        const dx = x < area.x ? area.x - x : x >= area.x + area.w ? area.x + area.w - 1 - x : 0;
        const dy = y < area.y ? area.y - y : y >= area.y + area.h ? area.y + area.h - 1 - y : 0;
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== ring || filled(x, y)) continue;
        // Les roseaux débordent de la case le long de la rive: une berge libre des deux côtés passe
        // avant une berge collée à un mur ou à un ponton.
        const along = Math.abs(dx) >= Math.abs(dy) ? [0, 1] : [1, 0];
        const cramped =
          filled(x + (along[0] ?? 0), y + (along[1] ?? 0)) ||
          filled(x - (along[0] ?? 0), y - (along[1] ?? 0));
        const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy) + (cramped ? 100 : 0);
        if (d < nearest) {
          nearest = d;
          found = { x, y, dx, dy };
        }
      }
  if (found === null) return null;
  // L'eau est du côté du plus grand écart. Rotation: 0 à l'est, 1 au nord, 2 à l'ouest, 3 au sud.
  const east = Math.abs(found.dx) >= Math.abs(found.dy);
  const sx = east ? Math.sign(found.dx) : 0;
  const sy = east ? 0 : Math.sign(found.dy);
  const rotation: 0 | 1 | 2 | 3 = sx > 0 ? 0 : sy < 0 ? 1 : sx < 0 ? 2 : 3;
  const x = found.x + 0.5 + sx * 0.25;
  const y = found.y + 0.5 + sy * 0.25;
  return marker(id, model, x, y, rotation, manifest);
}

/**
 * Repères fixes d'un lieu: un par coin de pêche (`fishing` de `lieu.json`), des touffes à
 * insectes dans chaque zone de `nature.json`. Les modèles viennent de `reglages-recoltes`; un
 * modèle absent du manifeste n'est pas posé (pas de forme provisoire pour un repère).
 */
export function markerVolumes(
  content: Content,
  placeId: string,
  manifest: DecorManifest = DECOR_MANIFEST,
  settings: HarvestLookSettings = HARVEST_LOOK,
): SceneVolume[] {
  const place = content.places[placeId];
  if (place === undefined) return [];
  const out: SceneVolume[] = [];
  const filled = filledCells(content, place, settings.markers.soils);
  const m = settings.markers;
  if (manifest.models[m.fishing] !== undefined)
    for (const spot of place.def.fishing ?? []) {
      const volume = fishingMarker(
        `peche-${spot.id}`,
        spot.area,
        filled,
        m.bankReach,
        m.fishing,
        manifest,
      );
      if (volume !== null) out.push(volume);
    }
  if (manifest.models[m.insects] !== undefined)
    for (const zone of content.book.nature[placeId]?.zones ?? []) {
      const { area } = zone;
      const count = Math.max(
        1,
        Math.min(m.insectMax, Math.round((area.w * area.h) / m.insectArea)),
      );
      const inset = Math.min(m.insectInset, area.w / 2 - 0.3, area.h / 2 - 0.3);
      for (let i = 0; i < count; i++) {
        // Quelques tirages par touffe: la première place libre de la zone.
        for (let attempt = 0; attempt < 6; attempt++) {
          const key = `${zone.id}:${String(i)}:${String(attempt)}`;
          const x = area.x + inset + keyDraw(key, 11) * (area.w - inset * 2);
          const y = area.y + inset + keyDraw(key, 12) * (area.h - inset * 2);
          if (filled(x, y)) continue;
          out.push(marker(`insectes-${zone.id}-${String(i)}`, m.insects, x, y, 0, manifest));
          break;
        }
      }
    }
  return out;
}

const groundModels = new WeakMap<Content, Map<string, string | null>>();

/**
 * Le modèle d'un objet posé au sol: celui du meuble qu'on récolte pour l'avoir, quand ce meuble
 * EST l'objet (sa ressource disparaît une fois prise et ne donne que lui: une pierre, des
 * branches, un bouquet de coquelicots). `null`: aucun (le moteur pose un ballot).
 */
export function groundModelOf(
  content: Content,
  item: string,
  settings: HarvestLookSettings = HARVEST_LOOK,
  manifest: DecorManifest = DECOR_MANIFEST,
): string | null {
  let table = groundModels.get(content);
  if (table === undefined) {
    table = new Map();
    const byResource = new Map<string, string>();
    for (const prop of Object.values(content.props))
      for (const brick of prop.bricks)
        if (brick.brick === 'harvest' && manifest.models[prop.model] !== undefined)
          byResource.set(brick.resource, prop.model);
    for (const resource of Object.values(content.resources)) {
      const items = new Set(resource.loot.map((entry) => entry.item));
      const only = items.size === 1 ? [...items][0] : undefined;
      const model = byResource.get(resource.id);
      if (resource.after !== settings.gone || only === undefined || model === undefined) continue;
      if (!table.has(only)) table.set(only, model);
    }
    groundModels.set(content, table);
  }
  return table.get(item) ?? null;
}
