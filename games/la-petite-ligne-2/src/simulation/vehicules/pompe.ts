/**
 * Brique d'entraînement `pump`: le balancier à deux. Un coup ne compte que s'il vient de l'autre
 * place que le coup d'avant: seul, on n'avance pas. Deux coups donnés ensemble bloquent le
 * balancier (le premier est repris). Entre les deux, un coup alterné pousse d'autant mieux qu'il
 * tombe au battement. Rien n'est puni: un coup raté ne fait que ne pas pousser. Logique pure.
 */
import type { PumpDrive } from '../../donnees/schemas/vehicule';
import type { RailVehicleState } from '../../etat/vehicules';
import { SIM_HZ } from '../noyau/constantes';
import { RAIL_VEHICLES, type RailVehicleSettings } from './reglages';

export type StrokeKind =
  /** Coup alterné: il pousse (`quality` de 0 à 1). */
  | 'push'
  /** Les deux ont appuyé ensemble: le balancier se bloque. */
  | 'jam'
  /** Deux fois de suite la même place: le balancier est déjà en bas de ce côté. */
  | 'same';

export interface Stroke {
  kind: StrokeKind;
  /** Justesse du coup: 1 au battement. */
  quality: number;
  /** Vitesse gagnée (m/s), négative quand un blocage reprend le coup d'avant. */
  gain: number;
}

/**
 * Justesse d'un coup alterné donné `gap` secondes après le précédent: pleine autour du battement,
 * elle tombe à zéro pour des coups trop rapprochés (marteler ne sert à rien) et garde un fond
 * (`offBeat`) pour des coups trop lents (on repart toujours).
 */
export function strokeQuality(drive: PumpDrive, gap: number): number {
  const early = drive.beat - drive.tolerance;
  const late = drive.beat + drive.tolerance;
  if (gap < early) return Math.max(0, (gap - drive.jam) / Math.max(1e-6, early - drive.jam));
  if (gap <= late) return 1;
  const fall = (gap - late) / Math.max(1e-6, drive.tolerance);
  return Math.max(drive.offBeat, 1 - fall * (1 - drive.offBeat));
}

/**
 * Un coup de balancier donné par la place `seat` au pas `tick`: met à jour le balancier de `state`
 * (dernier coup, justesse du rythme) et écrit le résultat dans `out`. La vitesse n'est pas
 * touchée ici: l'appelant applique `gain`.
 */
export function strokeLever(
  drive: PumpDrive,
  lever: RailVehicleState['lever'],
  seat: 0 | 1,
  tick: number,
  out: Stroke,
  settings: RailVehicleSettings = RAIL_VEHICLES,
): Stroke {
  if (lever.seat === seat) {
    out.kind = 'same';
    out.quality = 0;
    out.gain = 0;
    return out;
  }
  const first = lever.seat === null;
  const gap = (tick - lever.tick) / SIM_HZ;
  if (!first && gap < drive.jam) {
    out.kind = 'jam';
    out.quality = 0;
    out.gain = -lever.gain;
    lever.seat = seat;
    lever.tick = tick;
    lever.gain = 0;
    lever.rhythm = 0;
    return out;
  }
  // Premier coup, ou reprise après un long silence: le fond, de quoi s'ébranler.
  const quality = first || gap > drive.lost ? drive.offBeat : strokeQuality(drive, gap);
  out.kind = 'push';
  out.quality = quality;
  out.gain = drive.push * quality;
  lever.seat = seat;
  lever.tick = tick;
  lever.gain = out.gain;
  const span = 1 - drive.offBeat;
  const share = span > 0 ? Math.max(0, Math.min(1, (quality - drive.offBeat) / span)) : quality;
  lever.rhythm += (share - lever.rhythm) * settings.rhythmBlend;
  return out;
}
