/**
 * Portraits en SVG (provisoires, repris des maquettes): cinq expressions
 * lisibles en 48 px, le foulard à la couleur du profil Duo. Le jeu pourra les
 * remplacer par des vignettes tirées des modèles 3D sans toucher au reste.
 */
import type { Appearance, CharacterId } from '../etat/types';
import {
  type BeardStyle,
  type Expression,
  type HairStyle,
  type PortraitColors,
  PLAYER_BEARDS,
  PLAYER_BODIES,
  PLAYER_HAIR_COLORS,
  PLAYER_HAIRS,
  PLAYER_OUTFITS,
  VILLAGER_PORTRAITS,
} from './config';
import { safeColor } from './format';

const INK = '#2A2522';
const MOUTH = '#7A3D37';
const CHEEK = '#E99A8E';
const BRASS = '#E8C77A';

/** Le dessus de la tête des coupes courtes, repris par plusieurs coupes. */
const CAP = (c: string): string => `<path d="M30 46c-2-14 8-24 20-24s22 9 20 24c-4-7-10-10-20-10s-16 3-20 10z" fill="${c}"/>`;

/** Une tresse en lobes, du point (x, y) vers le bas, `n` lobes; ruban au bout. */
function braid(c: string, x: number, y: number, n: number, ribbon: string): string {
  let out = '';
  for (let i = 0; i < n; i++) out += `<ellipse cx="${x}" cy="${y + i * 5.5}" rx="3.6" ry="3.2" fill="${c}" stroke="${INK}" stroke-opacity="0.25" stroke-width="0.8"/>`;
  return `${out}<circle cx="${x}" cy="${y + n * 5.5 - 1}" r="2.2" fill="${ribbon}"/>`;
}

/** Boucles en boules, centre et rayon. */
function curls(c: string, list: readonly (readonly [number, number, number])[]): string {
  return list.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${c}"/>`).join('');
}

const RIBBON = '#557FB0';

const HAIRS: Readonly<Record<HairStyle, (c: string) => string>> = {
  short: CAP,
  bob: (c) =>
    `<path d="M28 60c-4-22 6-38 22-38s26 16 22 38l-6-2c1-10-2-18-6-22-4 4-14 6-24 6-2 6-2 12-1 16z" fill="${c}"/>`,
  bun: (c) =>
    `<circle cx="50" cy="20" r="8" fill="${c}"/><path d="M30 47c-2-15 8-25 20-25s22 10 20 25c-3-8-10-12-20-12s-17 4-20 12z" fill="${c}"/>`,
  crop: (c) => `<path d="M32 42c1-11 8-17 18-17s17 6 18 17c-4-5-10-7-18-7s-14 2-18 7z" fill="${c}"/>`,
  curls: (c) =>
    `<path d="M32 44c0-12 8-20 18-20s18 8 18 20c-4-5-10-7-18-7s-14 2-18 7z" fill="${c}"/>` +
    curls(c, [
      [34, 40, 5],
      [38, 31, 5.5],
      [46, 26, 5.5],
      [55, 26, 5.5],
      [63, 31, 5.5],
      [67, 40, 5],
    ]),
  ponytail: (c) => `<path d="M67 38c9 3 12 14 9 28l-6-1c2-9 1-17-5-22z" fill="${c}"/>${CAP(c)}<circle cx="69" cy="38" r="2.4" fill="${RIBBON}"/>`,
  braid: (c) => `${CAP(c)}${braid(c, 69, 58, 5, RIBBON)}`,
  pigtails: (c) =>
    `${CAP(c)}<path d="M29 46c-3 6-3 11-1 16h5c-2-5-1-10 1-15zM71 46c3 6 3 11 1 16h-5c2-5 1-10-1-15z" fill="${c}"/>${braid(c, 30, 64, 2, RIBBON)}${braid(c, 70, 64, 2, RIBBON)}`,
  wavy: (c) =>
    `<path d="M28 64c-6-24 5-42 22-42s28 18 22 42c-2 3-5 3-7 1 3-4 2-8 0-11 1-9-2-17-6-20-5 3-13 5-22 4-2 5-3 10-2 15-2 3-2 7 0 10-2 2-5 3-7 1z" fill="${c}"/>`,
  long: (c) =>
    `<path d="M27 92c-6-32-3-70 23-70s29 38 23 70h-7c2-16 1-32-4-42-5 3-14 5-24 5-3 12-4 25-3 37z" fill="${c}"/>`,
  fringe: (c) => `<path d="M30 49c-2-17 8-27 20-27s22 10 20 27l-2-7H32z" fill="${c}"/>`,
  quiff: (c) =>
    `<path d="M32 44c0-10 7-17 18-17s18 7 18 17c-4-5-10-7-18-7s-14 2-18 7z" fill="${c}"/><path d="M37 33c-3-9 5-16 15-15 7 1 12 6 11 12-7-4-17-4-26 3z" fill="${c}"/>`,
  cloud: (c) =>
    curls(c, [
      [29, 50, 8],
      [27, 39, 9],
      [33, 28, 9.5],
      [43, 21, 10],
      [57, 21, 10],
      [67, 28, 9.5],
      [73, 39, 9],
      [71, 50, 8],
      [50, 26, 10],
    ]),
  crown: (c) =>
    `<path d="M31 46c-1-14 8-23 19-23s20 9 19 23c-4-6-10-9-19-9s-15 3-19 9z" fill="${c}"/>` +
    [
      [33, 42],
      [36, 35],
      [42, 30],
      [50, 28.5],
      [58, 30],
      [64, 35],
      [67, 42],
    ]
      .map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="4.4" ry="3.4" fill="${c}" stroke="${INK}" stroke-opacity="0.3" stroke-width="0.8"/>`)
      .join(''),
  bob_long: (c) =>
    `<path d="M28 58c-4-22 6-36 22-36s26 14 22 36l-1 14-6-2c1-12-1-24-5-30-4 4-14 6-24 6-2 6-2 12-1 16l-1 10-6 2z" fill="${c}"/>`,
  cap: (c) =>
    `<path d="M31 46c0-4 2-6 4-7h30c2 1 4 3 4 7z" fill="${c}"/><path d="M30 38c0-10 9-16 20-16s20 6 20 16z" fill="#2F3F5C"/><rect x="30" y="34" width="40" height="5" fill="#B33A33"/><path d="M48 38h26c0 3-3 5-8 5H50z" fill="#28344C"/>`,
  villager_bun: (c) =>
    `<circle cx="50" cy="19" r="9" fill="${c}"/><path d="M30 48c-2-15 8-26 20-26s22 11 20 26c-2-9-9-13-20-13s-18 4-20 13z" fill="${c}"/>`,
  beard: (c) => `<path d="M31 44c0-12 8-20 19-20s19 8 19 20c-4-5-10-7-19-7s-15 2-19 7z" fill="${c}"/>`,
  braids: (c) =>
    `<path d="M30 47c-2-15 8-25 20-25s22 10 20 25c-3-8-10-12-20-12s-17 4-20 12z" fill="${c}"/><path d="M29 46c-4 8-4 16-1 22h6c-2-7-1-14 1-20zM71 46c4 8 4 16 1 22h-6c2-7 1-14-1-20z" fill="${c}"/><circle cx="31" cy="70" r="3" fill="#557FB0"/><circle cx="69" cy="70" r="3" fill="#557FB0"/>`,
};

const FACES: Readonly<Record<Expression, string>> = {
  low: `<path d="M38 50q4 -2 8 0M54 50q4 -2 8 0" stroke="${INK}" stroke-width="2.6" fill="none" stroke-linecap="round"/><path d="M38 47l7 -2M62 47l-7 -2" stroke="${INK}" stroke-width="2" stroke-linecap="round"/><path d="M44 63q6 -4 12 0" stroke="${MOUTH}" stroke-width="2.6" fill="none" stroke-linecap="round"/>`,
  ok: `<circle cx="42" cy="51" r="2.8" fill="${INK}"/><circle cx="58" cy="51" r="2.8" fill="${INK}"/><path d="M44 62h12" stroke="${MOUTH}" stroke-width="2.6" stroke-linecap="round"/>`,
  good: `<circle cx="42" cy="51" r="3" fill="${INK}"/><circle cx="58" cy="51" r="3" fill="${INK}"/><path d="M43 60q7 5 14 0" stroke="${MOUTH}" stroke-width="2.8" fill="none" stroke-linecap="round"/>`,
  great: `<circle cx="42" cy="50" r="3.2" fill="${INK}"/><circle cx="58" cy="50" r="3.2" fill="${INK}"/><circle cx="43" cy="49" r="1" fill="#fff"/><circle cx="59" cy="49" r="1" fill="#fff"/><path d="M42 58q8 9 16 0z" fill="${MOUTH}"/><circle cx="36" cy="58" r="3.4" fill="${CHEEK}" opacity="0.8"/><circle cx="64" cy="58" r="3.4" fill="${CHEEK}" opacity="0.8"/>`,
  radiant: `<path d="M38 52q4 -5 8 0M54 52q4 -5 8 0" stroke="${INK}" stroke-width="2.8" fill="none" stroke-linecap="round"/><path d="M41 57q9 12 18 0z" fill="${MOUTH}"/><path d="M45 61q5 3 10 0" fill="${CHEEK}"/><circle cx="35" cy="59" r="4" fill="${CHEEK}"/><circle cx="65" cy="59" r="4" fill="${CHEEK}"/><path d="M78 26l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" fill="${BRASS}" stroke="${INK}" stroke-width="1.2"/>`,
};

function escapeAttr(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Barbe, moustache: même couleur que les cheveux. */
const BEARDS: Readonly<Record<BeardStyle, (c: string) => string>> = {
  none: () => '',
  short: (c) => `<path d="M33 54c1 13 8 19 17 19s16-6 17-19c-2 6-5 9-9 10-2-3-5-4-8-4s-6 1-8 4c-4-1-7-4-9-10z" fill="${c}" opacity="0.9"/>`,
  full: (c) =>
    `<path d="M33 54c1 18 8 26 17 26s16-8 17-26c-3 6-7 8-11 8-1-3-3-4-6-4s-5 1-6 4c-4 0-8-2-11-8z" fill="${c}"/><path d="M42 60q8 -4 16 0" stroke="${c}" stroke-width="4" stroke-linecap="round"/>`,
  moustache: (c) => `<path d="M41 59q9 -6 18 0q-9 3 -18 0z" fill="${c}"/>`,
};

/** Couleurs du portrait d'un joueur selon son apparence (couleur et barbe absentes: celles d'avant le tour 10). */
export function playerColors(
  id: CharacterId,
  appearance: Readonly<Pick<Appearance, 'hair' | 'outfit' | 'scarf'> & Partial<Pick<Appearance, 'hairColor' | 'beard'>>>,
): PortraitColors {
  const body = PLAYER_BODIES[id];
  const hairColor = appearance.hairColor === undefined ? undefined : PLAYER_HAIR_COLORS[appearance.hairColor];
  const outfit = PLAYER_OUTFITS[appearance.outfit] ?? PLAYER_OUTFITS[0] ?? { top: '#5C7FA6', trim: '#EDE6D3', bg: '#D9E3EC' };
  return {
    skin: body.skin,
    shade: body.shade,
    hair: hairColor ?? body.hair,
    top: outfit.top,
    trim: outfit.trim,
    scarf: safeColor(appearance.scarf),
    style: PLAYER_HAIRS[appearance.hair] ?? 'short',
    bg: outfit.bg,
    beard: PLAYER_BEARDS[appearance.beard ?? 0] ?? 'none',
  };
}

export function villagerColors(id: string): PortraitColors | null {
  return VILLAGER_PORTRAITS[id] ?? null;
}

/**
 * Le portrait en SVG. `label`: nom accessible (forme du jour), vide pour un
 * portrait décoratif. Toutes les couleurs viennent de la configuration ou
 * passent par `safeColor`.
 */
export function portraitSvg(p: PortraitColors, expression: Expression, label: string, villagerId = ''): string {
  const beard =
    p.style === 'beard'
      ? `<path d="M34 56c2 16 8 22 16 22s14-6 16-22c-4 4-9 5-16 5s-12-1-16-5z" fill="${p.hair}"/><path d="M42 60q8 -4 16 0" stroke="${p.hair}" stroke-width="5" stroke-linecap="round"/>`
      : '';
  const moustache = villagerId === 'firmin' ? `<path d="M41 58q9 -5 18 0q-9 3 -18 0z" fill="${p.hair}"/>` : '';
  const freckles =
    villagerId === 'jeanne'
      ? '<g fill="#B5652F" opacity="0.6"><circle cx="38" cy="57" r="1"/><circle cx="41" cy="59" r="1"/><circle cx="62" cy="57" r="1"/><circle cx="59" cy="59" r="1"/></g>'
      : '';
  const scarf = `<path d="M33 79c5 4 11 6 17 6s12-2 17-6l3 7c-6 4-13 6-20 6s-14-2-20-6z" fill="${p.scarf}" stroke="${INK}" stroke-width="1.6"/>`;
  const role = label === '' ? 'aria-hidden="true"' : `role="img" aria-label="${escapeAttr(label)}"`;
  return (
    `<svg viewBox="0 0 100 100" ${role}>` +
    `<rect width="100" height="100" fill="${p.bg}"/>` +
    `<path d="M14 104c2-18 16-28 36-28s34 10 36 28z" fill="${p.top}"/>` +
    `<path d="M40 76h20l-2 10H42z" fill="${p.trim}"/>` +
    `<rect x="44" y="64" width="12" height="14" fill="${p.shade}"/>` +
    `<ellipse cx="50" cy="50" rx="19" ry="21" fill="${p.skin}"/>` +
    `<ellipse cx="31" cy="53" rx="3.5" ry="5" fill="${p.shade}"/><ellipse cx="69" cy="53" rx="3.5" ry="5" fill="${p.shade}"/>` +
    HAIRS[p.style](p.hair) +
    FACES[expression] +
    freckles +
    beard +
    BEARDS[p.beard ?? 'none'](p.hair) +
    moustache +
    scarf +
    `</svg>`
  );
}
