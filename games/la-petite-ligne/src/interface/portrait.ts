/**
 * Portraits en SVG (provisoires, repris des maquettes): cinq expressions
 * lisibles en 48 px, le foulard à la couleur du profil Duo. Le jeu pourra les
 * remplacer par des vignettes tirées des modèles 3D sans toucher au reste.
 */
import type { Appearance, CharacterId } from '../etat/types';
import {
  type Expression,
  type HairStyle,
  type PortraitColors,
  PLAYER_BODIES,
  PLAYER_HAIRS,
  PLAYER_OUTFITS,
  VILLAGER_PORTRAITS,
} from './config';
import { safeColor } from './format';

const INK = '#2A2522';
const MOUTH = '#7A3D37';
const CHEEK = '#E99A8E';
const BRASS = '#E8C77A';

const HAIRS: Readonly<Record<HairStyle, (c: string) => string>> = {
  short: (c) => `<path d="M30 46c-2-14 8-24 20-24s22 9 20 24c-4-7-10-10-20-10s-16 3-20 10z" fill="${c}"/>`,
  bob: (c) =>
    `<path d="M28 60c-4-22 6-38 22-38s26 16 22 38l-6-2c1-10-2-18-6-22-4 4-14 6-24 6-2 6-2 12-1 16z" fill="${c}"/>`,
  bun: (c) =>
    `<circle cx="50" cy="20" r="8" fill="${c}"/><path d="M30 47c-2-15 8-25 20-25s22 10 20 25c-3-8-10-12-20-12s-17 4-20 12z" fill="${c}"/>`,
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

/** Couleurs du portrait d'un joueur selon son apparence. */
export function playerColors(id: CharacterId, appearance: Readonly<Appearance>): PortraitColors {
  const body = PLAYER_BODIES[id];
  const outfit = PLAYER_OUTFITS[appearance.outfit] ?? PLAYER_OUTFITS[0] ?? { top: '#5C7FA6', trim: '#EDE6D3', bg: '#D9E3EC' };
  return {
    skin: body.skin,
    shade: body.shade,
    hair: body.hair,
    top: outfit.top,
    trim: outfit.trim,
    scarf: safeColor(appearance.scarf),
    style: PLAYER_HAIRS[appearance.hair] ?? 'short',
    bg: outfit.bg,
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
    moustache +
    scarf +
    `</svg>`
  );
}
