/**
 * Ambiances de jour et de nuit en boucle discrète, fondues selon l'heure de jeu; une couche de
 * voyage prend toute la place pendant le trajet en train. Logique pure: gains cibles par couche.
 */
import type { AmbienceTable } from './schemas';

/** Part de jour de 0 (nuit pleine) à 1 (plein jour) à cette heure de jeu (minutes depuis minuit). */
export function daylight(table: AmbienceTable, minutes: number): number {
  const hour = (((minutes / 60) % 24) + 24) % 24;
  const [dawnFrom, dawnTo] = table.dawn;
  const [duskFrom, duskTo] = table.dusk;
  if (hour >= dawnTo && hour <= duskFrom) return 1;
  if (hour > dawnFrom && hour < dawnTo) return smooth((hour - dawnFrom) / (dawnTo - dawnFrom));
  if (hour > duskFrom && hour < duskTo) return 1 - smooth((hour - duskFrom) / (duskTo - duskFrom));
  return 0;
}

function smooth(t: number): number {
  return t * t * (3 - 2 * t);
}

/**
 * Gain cible (linéaire, avant le volume de la couche) de chaque couche. Jour et nuit se croisent
 * à puissance constante (le niveau total ne creuse pas au milieu du fondu).
 */
export function layerGains(
  table: AmbienceTable,
  minutes: number,
  traveling: boolean,
): Record<string, number> {
  const light = daylight(table, minutes);
  const out: Record<string, number> = {};
  for (const [id, layer] of Object.entries(table.layers)) {
    if (layer.when === 'travel') out[id] = traveling ? 1 : 0;
    else if (traveling) out[id] = 0;
    else
      out[id] =
        layer.when === 'day' ? Math.sin((light * Math.PI) / 2) : Math.cos((light * Math.PI) / 2);
  }
  return out;
}
