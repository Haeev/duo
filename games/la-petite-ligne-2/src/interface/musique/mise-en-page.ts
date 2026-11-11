/**
 * Mise en page de la partition (pur): l'air se lit comme un cahier de musique, ligne après ligne.
 * Une ligne tient quelques mesures; une plume la parcourt de gauche à droite, puis la ligne
 * suivante monte. Rien ne défile vers le joueur.
 */
import type { AirNote, AirScore } from '../../donnees/schemas/air';

export interface PageLayout {
  readonly barMs: number;
  readonly barsPerLine: number;
  readonly lineMs: number;
  readonly lines: number;
}

/** Durée visée d'une ligne (ms): assez longue pour lire d'avance, assez courte pour de grosses notes. */
const LINE_TARGET_MS = 7000;
const BARS_PER_LINE = [1, 2, 4, 8] as const;
/** La ligne suivante monte un rien avant sa première note. */
export const TURN_EARLY_MS = 140;

/** Repères du dessin d'une ligne (unités du SVG). */
export const STAFF = {
  width: 1000,
  /** Début et fin de la portée; à gauche, la marge des touches. */
  left: 104,
  right: 984,
  /** Hauteur de la ligne de chaque touche, de la plus grave (0, en bas) à la plus aiguë. */
  laneY: [138, 104, 70, 36],
  /** Petite portée de l'autre voix, sous la sienne. */
  mateY: [214, 204, 194, 184],
  height: 164,
  heightDuo: 228,
} as const;

export function layoutOf(score: AirScore): PageLayout {
  const barMs = (score.beatsPerBar * 60_000) / score.tempo;
  let barsPerLine: number = BARS_PER_LINE[0];
  for (const bars of BARS_PER_LINE)
    if (
      Math.abs(Math.log((bars * barMs) / LINE_TARGET_MS)) <
      Math.abs(Math.log((barsPerLine * barMs) / LINE_TARGET_MS))
    )
      barsPerLine = bars;
  const lineMs = barsPerLine * barMs;
  return {
    barMs,
    barsPerLine,
    lineMs,
    lines: Math.max(1, Math.ceil(score.lengthMs / lineMs - 1e-6)),
  };
}

/** La ligne montrée à l'instant `airMs` (la première pendant le décompte). */
export function lineAt(layout: PageLayout, airMs: number): number {
  const line = Math.floor((airMs + TURN_EARLY_MS) / layout.lineMs);
  return Math.max(0, Math.min(layout.lines - 1, line));
}

/** Abscisse d'un instant sur sa ligne. */
export function xOf(layout: PageLayout, line: number, atMs: number): number {
  const share = (atMs - line * layout.lineMs) / layout.lineMs;
  return STAFF.left + share * (STAFF.right - STAFF.left);
}

/** Les notes d'une ligne, avec leur rang dans la voix. */
export function notesOnLine(
  layout: PageLayout,
  notes: readonly AirNote[],
  line: number,
): { readonly index: number; readonly note: AirNote }[] {
  const from = line * layout.lineMs;
  const to = from + layout.lineMs;
  const found: { index: number; note: AirNote }[] = [];
  notes.forEach((note, index) => {
    if (note[0] >= from && note[0] < to) found.push({ index, note });
  });
  return found;
}
