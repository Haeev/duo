/**
 * Tableau des lampadaires (tour 9): l'allumage de chaque lampadaire du bourg, de 0 (éteint) à 1
 * (allumé comme les autres soirs). Écrit par `chantiers.ts` (le réverbère du chemin pas encore
 * bâti, les lanternes du quai allumées à la perche, la vague des lampadaires), lu par l'ambiance
 * (halos, lumières au sol) et par le verre éteint posé sur les lanternes.
 *
 * Par défaut tout est allumé: sans moment ni chantier, rien ne change par rapport aux tours d'avant.
 */
import type { GameMap } from '../etat/carte';

/** Modèles qui sont des lampadaires (une lanterne en haut d'un poteau). */
export const LAMP_MODELS: ReadonlySet<string> = new Set(['lamp_post']);

export class LampBoard {
  private readonly factors = new Map<string, number>();
  /** Change à chaque modification: les lecteurs ne relisent leurs tampons qu'à ce moment. */
  version = 0;

  /** Allumage (0 à 1) du lampadaire `id`; 1 pour un identifiant inconnu. */
  factor(id: string | null): number {
    return id === null ? 1 : (this.factors.get(id) ?? 1);
  }

  set(id: string, value: number): void {
    const clamped = Math.min(1, Math.max(0, value));
    if (this.factors.get(id) === clamped) return;
    this.factors.set(id, clamped);
    this.version += 1;
  }
}

/** Lampadaires de la carte: les objets posés et ceux des chantiers (le réverbère du chemin). */
export function lampIds(map: GameMap): string[] {
  const ids = map.props.filter((prop) => LAMP_MODELS.has(prop.model)).map((prop) => prop.id);
  for (const improvement of Object.values(map.improvements ?? {})) {
    if (LAMP_MODELS.has(improvement.model)) ids.push(improvement.id);
  }
  return ids;
}
