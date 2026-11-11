/**
 * Rendu encré: d'où viennent les lampes et les fenêtres d'un lieu (ADR 0023). Aucun contenu
 * nommé: une lampe est un volume dont le modèle livré déclare sa lumière au manifeste des décors
 * (`light`: foyer, rayon, couleur), ou appartient à une famille éclairante
 * (`INK_SETTINGS.lampFamilies`); les bâtiments d'un grand lieu donnent leurs lampes de porte et
 * leurs fenêtres. Logique pure, sans Three.js.
 */
import { DECOR_MANIFEST, type DecorManifest, keyDraw } from '../lieu/decors-manifeste';
import type { SceneVolume } from '../lieu/description';
import { firePhase, hex } from './couches';
import type { InkInner, Lamp, WindowLight } from './matiere';
import { INK_SETTINGS } from './reglages';

export interface PlaceLights {
  readonly lamps: readonly Lamp[];
  readonly windows: readonly WindowLight[];
}

/** Emprise d'un bâtiment de la carte: une lampe vissée sur sa façade suit son éclairage. */
export interface LampHost {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

export interface PlaceLightOptions {
  /** Le dehors: les lampes s'y allument l'une après l'autre à la tombée du jour. */
  readonly outdoor?: boolean;
  /** Hauteur du sol affiché sous un point de la carte (relief); absente: sol plan. */
  readonly heightAt?: ((x: number, y: number) => number) | null;
  /** Bâtiments de la carte (lanternes de porte). */
  readonly hosts?: readonly LampHost[];
  /** Verre du modèle posé pour ce volume, s'il en a un (le rendu y écrit l'état de la lampe). */
  readonly glassOf?: (volume: string) => InkInner | undefined;
}

/** Salt du tirage du rang d'allumage d'une lampe. */
const PHASE_SALT = 41;

/** Rang d'allumage d'une lampe du dehors, de 0 à 1, tiré de son identifiant. */
export function lampPhase(id: string): number {
  return keyDraw(id, PHASE_SALT);
}

/** Le bâtiment dont la façade porte ce point (à `reach` mètres près), ou rien. */
export function hostOf(
  x: number,
  y: number,
  hosts: readonly LampHost[],
  reach: number = INK_SETTINGS.buildingLights.attachReach,
): string | undefined {
  for (const host of hosts) {
    const dx = Math.max(host.x - x, 0, x - host.x - host.w);
    const dy = Math.max(host.y - y, 0, y - host.y - host.h);
    if (Math.hypot(dx, dy) <= reach) return host.id;
  }
  return undefined;
}

/**
 * Lampe d'un modèle qui déclare sa lumière, posé en (x, z) au cap `yaw` (radians autour de Y,
 * comme `Object3D.rotation.y`) et à l'échelle `scale`, son pied à la hauteur `ground`. `family`
 * (famille du modèle): un objet à flamme (`INK_SETTINGS.fire.families`) a une lampe qui vacille
 * avec son feu, et un feu qui brûle aussi le jour s'il le dit.
 */
export function modelLamp(
  id: string,
  light: NonNullable<DecorManifest['models'][string]['light']>,
  pose: {
    readonly x: number;
    readonly z: number;
    readonly ground: number;
    readonly yaw: number;
    readonly scale?: number;
  },
  options: PlaceLightOptions = {},
  family?: string,
): Lamp {
  const scale = pose.scale ?? 1;
  const fire = family === undefined ? undefined : INK_SETTINGS.fire.families[family];
  const cos = Math.cos(pose.yaw);
  const sin = Math.sin(pose.yaw);
  const [ax, ay, az] = light.at;
  const follows = options.hosts === undefined ? undefined : hostOf(pose.x, pose.z, options.hosts);
  const glass = options.glassOf?.(id);
  return {
    x: pose.x + (ax * cos + az * sin) * scale,
    y: pose.ground + ay * scale,
    z: pose.z + (az * cos - ax * sin) * scale,
    radius: light.radius,
    shadow: light.shadow === true,
    ...(light.color === undefined ? {} : { color: hex(light.color) }),
    ...(light.gain === undefined ? {} : { gain: light.gain }),
    ...(options.outdoor === true ? { phase: lampPhase(id) } : {}),
    ...(follows === undefined ? {} : { follows }),
    ...(glass === undefined ? {} : { glass }),
    ...(fire === undefined
      ? {}
      : {
          flicker: fire.flicker,
          flickerPhase: firePhase(pose.x, pose.z),
          burnsByDay: fire.day,
        }),
  };
}

/** Lampes des volumes d'un lieu (meubles de la carte et meubles posés), plus celles de ses bâtiments. */
export function placeLights(
  volumes: Iterable<SceneVolume>,
  built: PlaceLights | null,
  manifest: DecorManifest = DECOR_MANIFEST,
  families: typeof INK_SETTINGS.lampFamilies = INK_SETTINGS.lampFamilies,
  options: PlaceLightOptions = {},
): PlaceLights {
  const lamps: Lamp[] = [...(built?.lamps ?? [])];
  for (const volume of volumes) {
    if (volume.model === null) continue;
    const model = manifest.models[volume.model];
    if (model === undefined) continue;
    const foot = volume.foot ?? volume;
    const ground = volume.base + (options.heightAt?.(foot.x, foot.y) ?? 0);
    if (model.light !== undefined) {
      lamps.push(
        modelLamp(
          volume.id,
          model.light,
          {
            x: volume.x,
            z: volume.y,
            ground,
            yaw: (volume.rotation * Math.PI) / 2,
            ...(volume.scale === undefined ? {} : { scale: volume.scale }),
          },
          options,
          model.family,
        ),
      );
      continue;
    }
    const family = families[model.family];
    if (family === undefined) continue;
    lamps.push({
      x: volume.x,
      y: ground + model.size.h * family.heightShare,
      z: volume.y,
      radius: family.radius,
      shadow: family.shadow,
    });
  }
  return { lamps, windows: built?.windows ?? [] };
}
