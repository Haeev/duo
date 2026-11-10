/**
 * Description d'un lieu pour le rendu: ce que le moteur dessine, tiré des données du lieu
 * (`PlaceContent`) et de son état (`PlaceState`), sans rien nommer. Chaque élément posé devient un
 * « volume »: une emprise, une hauteur, un modèle demandé, et ce qu'il sait faire à l'écran
 * (cacher un personnage, réagir à la visée). Logique pure: testable sans WebGL.
 */
import type { Content, PlaceContent } from '../../donnees/charger';
import type { DeepReadonly } from '../../etat/monde';
import type { PlaceState } from '../../etat/lieu';
import type { OccluderBox } from '../occultation';
import { RENDER_SETTINGS } from '../reglages';

/** Forme simple d'un volume sans modèle. */
export type StandInShape = 'box' | 'ball' | 'post' | 'slab';

export interface SceneVolume {
  /** Identifiant d'instance: celui de la carte, d'un meuble posé (`pose-<n>`), ou fabriqué. */
  readonly id: string;
  /** Nœud du modèle 3D demandé, `null`: jamais de modèle (zone, objet au sol). */
  readonly model: string | null;
  /** Centre de l'emprise sur la carte (m, x est, y sud). */
  readonly x: number;
  readonly y: number;
  /** Emprise à la rotation 0 (façade au sud), en mètres. */
  readonly w: number;
  readonly h: number;
  /** Quarts de tour: 0 façade au sud, 1 à l'est, 2 au nord, 3 à l'ouest. */
  readonly rotation: 0 | 1 | 2 | 3;
  /** Hauteur du bas du volume au-dessus du sol (un toit, un houppier), et hauteur du volume (m). */
  readonly base: number;
  readonly height: number;
  readonly shape: StandInShape;
  /** Couleur imposée de la forme simple; absente: teinte tirée de l'identifiant du modèle. */
  readonly color?: string;
  /** Peut cacher un personnage: il s'efface quand il est entre la caméra et le joueur. */
  readonly occludes: boolean;
  /** Peut être la cible de la touche d'action (son identifiant est celui de `PlayerState.aim`). */
  readonly aimable: boolean;
}

export interface PlaceDescription {
  readonly id: string;
  /** Taille de la carte en cases de 1 m. */
  readonly width: number;
  readonly height: number;
  readonly volumes: readonly SceneVolume[];
}

type StandInSettings = typeof RENDER_SETTINGS.standIn;

/** Emprise au sol d'un volume une fois tourné (m). */
export function footprint(volume: Pick<SceneVolume, 'w' | 'h' | 'rotation'>): {
  w: number;
  h: number;
} {
  return volume.rotation % 2 === 0 ? { w: volume.w, h: volume.h } : { w: volume.h, h: volume.w };
}

/** Boîte du volume dans le repère Three.js (X est, Y haut, Z sud). */
export function boxOf(volume: SceneVolume): OccluderBox {
  const size = footprint(volume);
  const share = volume.shape === 'ball' ? RENDER_SETTINGS.occlusion.ballShare : 1;
  const w = (size.w * share) / 2;
  const h = (size.h * share) / 2;
  const middle = volume.base + volume.height / 2;
  const up = (volume.height * share) / 2;
  return {
    id: volume.id,
    min: { x: volume.x - w, y: middle - up, z: volume.y - h },
    max: { x: volume.x + w, y: middle + up, z: volume.y + h },
  };
}

/**
 * Volumes fixes d'un lieu: ses zones bloquées et les meubles de sa carte. `extras`: volumes
 * ajoutés par l'appelant (page de démonstration, futur format des murs et des toits).
 */
export function describePlace(
  content: Content,
  place: PlaceContent,
  extras: readonly SceneVolume[] = [],
  settings: StandInSettings = RENDER_SETTINGS.standIn,
): PlaceDescription {
  const volumes: SceneVolume[] = [];
  place.map.blocked.forEach((rect, index) => {
    volumes.push({
      id: `zone-${String(index)}`,
      model: null,
      x: rect.x + rect.w / 2,
      y: rect.y + rect.h / 2,
      w: rect.w,
      h: rect.h,
      rotation: 0,
      base: 0,
      height: settings.blockedHeight,
      shape: 'slab',
      occludes: false,
      aimable: false,
    });
  });
  for (const object of place.map.objects) {
    const prop = content.props[object.type];
    // Les données sont contrôlées au chargement: un type inconnu n'arrive pas jusqu'ici.
    if (prop === undefined) continue;
    volumes.push({
      id: object.id,
      model: prop.model,
      x: object.x,
      y: object.y,
      w: prop.size.w,
      h: prop.size.h,
      rotation: object.rotation,
      base: 0,
      height: settings.propHeight,
      shape: 'box',
      occludes: true,
      aimable: true,
    });
  }
  volumes.push(...extras);
  return { id: place.def.id, width: place.map.width, height: place.map.height, volumes };
}

/** Volumes qui changent en cours de partie: meubles posés par les joueurs et objets au sol. */
export function describeDynamic(
  content: Content,
  state: DeepReadonly<PlaceState>,
  settings: StandInSettings = RENDER_SETTINGS.standIn,
): SceneVolume[] {
  const volumes: SceneVolume[] = [];
  for (const placed of state.placed) {
    const prop = content.props[placed.type];
    if (prop === undefined) continue;
    volumes.push({
      id: placed.id,
      model: prop.model,
      x: placed.x,
      y: placed.y,
      w: prop.size.w,
      h: prop.size.h,
      rotation: placed.rotation,
      base: 0,
      height: settings.propHeight,
      shape: 'box',
      occludes: true,
      aimable: true,
    });
  }
  for (const item of state.ground) {
    volumes.push({
      id: `sol-${String(item.id)}`,
      model: null,
      x: item.x,
      y: item.y,
      w: settings.itemSize,
      h: settings.itemSize,
      rotation: 0,
      base: 0,
      height: settings.itemSize,
      shape: 'box',
      color: settings.itemColor,
      occludes: false,
      aimable: false,
    });
  }
  return volumes;
}

/**
 * Empreinte de ce qui change dans l'état d'un lieu, sans allocation: le moteur ne refait les
 * volumes dynamiques que quand elle change (l'hôte modifie l'état en place, on ne peut pas
 * comparer des références).
 */
export function dynamicSignature(state: DeepReadonly<PlaceState>): number {
  let sum = state.nextPlacedId * 31 + state.nextGroundId * 17 + state.placed.length * 7;
  sum += state.ground.length * 3;
  for (const placed of state.placed) sum += placed.x * 1.3 + placed.y * 2.7 + placed.rotation;
  for (const item of state.ground) sum += item.x * 1.1 + item.y * 2.3 + item.stack.count;
  return sum;
}
