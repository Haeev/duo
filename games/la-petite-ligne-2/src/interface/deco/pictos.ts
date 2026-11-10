/** Pictos du mode déco (SVG du studio, 24 x 24, trait encre): une raison de refus = un picto. */
import type { PlacementRefusal } from '../../simulation/logement/pose';

const STROKE =
  'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';

const PATHS: Readonly<Record<PlacementRefusal | 'ok', string>> = {
  ok: '<path d="M5 12l5 5 9-10"/>',
  outside:
    '<rect x="4" y="4" width="16" height="16" stroke-dasharray="3 3"/><path d="M9 9l6 6M15 9l-6 6"/>',
  'room-not-ready': '<path d="M4 20h16M6 20V10l6-5 6 5v10"/><path d="M10 9l3 3-2 2 3 3"/>',
  'wrong-room': '<path d="M4 20V9l8-5 8 5v11z"/><path d="M9 13l6 6M15 13l-6 6"/>',
  'wrong-zone': '<circle cx="12" cy="12" r="8"/><path d="M6 18L18 6"/>',
  wall: '<path d="M3 6h18M3 12h18M3 18h18M8 6v6M16 6v6M12 12v6"/>',
  overlap: '<rect x="3" y="3" width="12" height="12"/><rect x="9" y="9" width="12" height="12"/>',
  'no-surface': '<path d="M4 10h16M6 10v9M18 10v9"/><path d="M12 7V3M10 5l2-2 2 2"/>',
  'no-wall': '<path d="M4 3v18"/><rect x="9" y="7" width="10" height="9"/><path d="M6 12h3"/>',
  door: '<path d="M6 21V4h12v17M4 21h16"/><circle cx="15" cy="13" r="1"/>',
  'blocks-path': '<path d="M3 14h4l3-6 4 9 2-3h5"/><path d="M14 3l7 7M21 3l-7 7"/>',
};

export function decoPicto(kind: PlacementRefusal | 'ok', label: string): string {
  return `<svg viewBox="0 0 24 24" width="24" height="24" role="img" aria-label="${label}"><g ${STROKE}>${PATHS[kind]}</g></svg>`;
}
