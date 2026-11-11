/**
 * Jugement d'une frappe, pur: le même calcul sur la machine du joueur (pour le son et l'encre
 * immédiats) et chez l'hôte (pour valider). Rien de punitif: une note fausse sonne faux et passe.
 */
import { MUSIC, type Rating, type Verdict } from './reglages';

export interface Windows {
  readonly just: number;
  readonly near: number;
  readonly loose: number;
}

/**
 * Élargissement des fenêtres: l'aide du joueur (`assistFactor` de `simulation/aide/`: 1, 1,25 ou
 * 1,5) et le bonus des besoins, plafonnés.
 */
export function windowScaleOf(assist: number, needs = 1): number {
  return Math.max(1, Math.min(MUSIC.maxWindowScale, assist * needs));
}

export function windowsOf(scale: number): Windows {
  const { just, near, loose } = MUSIC.windows;
  return { just: just * scale, near: near * scale, loose: loose * scale };
}

/**
 * Verdict d'une note. `offsetMs`: écart de la frappe à l'instant écrit (négatif: en avance),
 * `null` sans frappe. `rightKey`: la touche frappée est celle de la note.
 */
export function judge(offsetMs: number | null, rightKey: boolean, windows: Windows): Verdict {
  if (offsetMs === null) return 'missed';
  const gap = Math.abs(offsetMs);
  if (gap > windows.loose) return 'missed';
  if (!rightKey) return 'false';
  if (gap <= windows.just) return 'just';
  if (gap <= windows.near) return offsetMs < 0 ? 'early' : 'late';
  return 'false';
}

/** La note sonne-t-elle (juste ou fausse) ? */
export function sounds(verdict: Verdict): boolean {
  return verdict !== 'missed';
}

export interface Tally {
  just: number;
  near: number;
  false: number;
  missed: number;
}

/** Décompte d'une voix de `total` notes: une note sans verdict est manquée. */
export function tallyOf(verdicts: readonly (Verdict | null)[], total: number): Tally {
  const tally: Tally = { just: 0, near: 0, false: 0, missed: 0 };
  for (let index = 0; index < total; index++) {
    const verdict = verdicts[index] ?? 'missed';
    if (verdict === 'just') tally.just += 1;
    else if (verdict === 'early' || verdict === 'late') tally.near += 1;
    else if (verdict === 'false') tally.false += 1;
    else tally.missed += 1;
  }
  return tally;
}

/** Justesse de 0 à 1. */
export function accuracyOf(tally: Tally): number {
  const total = tally.just + tally.near + tally.false + tally.missed;
  if (total === 0) return 0;
  const w = MUSIC.weights;
  return (
    (tally.just * w.just + tally.near * w.near + tally.false * w.false + tally.missed * w.missed) /
    total
  );
}

export function ratingOf(accuracy: number): Rating {
  const [one, two, three] = MUSIC.ratings;
  if (accuracy >= three) return 3;
  if (accuracy >= two) return 2;
  if (accuracy >= one) return 1;
  return 0;
}
