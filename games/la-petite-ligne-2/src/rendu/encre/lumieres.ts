/**
 * Rendu encré: d'où viennent les lampes et les fenêtres d'un lieu (ADR 0023). Aucun contenu
 * nommé: une lampe est un volume dont le modèle livré appartient à une famille éclairante du
 * manifeste des décors (`INK_SETTINGS.lampFamilies`); les bâtiments d'un grand lieu donnent leurs
 * lampes de porte et leurs fenêtres. Logique pure, sans Three.js.
 */
import { DECOR_MANIFEST, type DecorManifest } from '../lieu/decors-manifeste';
import type { SceneVolume } from '../lieu/description';
import type { Lamp, WindowLight } from './matiere';
import { INK_SETTINGS } from './reglages';

export interface PlaceLights {
  readonly lamps: readonly Lamp[];
  readonly windows: readonly WindowLight[];
}

/** Lampes des volumes d'un lieu (meubles de la carte et meubles posés), plus celles de ses bâtiments. */
export function placeLights(
  volumes: Iterable<SceneVolume>,
  built: PlaceLights | null,
  manifest: DecorManifest = DECOR_MANIFEST,
  families: typeof INK_SETTINGS.lampFamilies = INK_SETTINGS.lampFamilies,
): PlaceLights {
  const lamps: Lamp[] = [...(built?.lamps ?? [])];
  for (const volume of volumes) {
    if (volume.model === null) continue;
    const model = manifest.models[volume.model];
    const family = model === undefined ? undefined : families[model.family];
    if (model === undefined || family === undefined) continue;
    lamps.push({
      x: volume.x,
      y: volume.base + model.size.h * family.heightShare,
      z: volume.y,
      radius: family.radius,
      shadow: family.shadow,
    });
  }
  return { lamps, windows: built?.windows ?? [] };
}
