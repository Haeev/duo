/**
 * Garde-robe (0.12): ce que l'on voit d'une tenue, les tenues de départ, le stock de la mercerie.
 * Pur (ni DOM ni Three.js): la simulation, le rendu, l'aperçu de la boutique et l'interface lisent
 * les mêmes règles. Le stock ne dépend que de la graine, du jour et du contenu: il est le même chez
 * l'hôte et chez l'invité sans rien ajouter à l'état.
 */
import { seasonOfDay, weekdayOf } from '../donnees/calendrier';
import type { Settings } from '../donnees/types';
import { CLOTHING_SLOTS, REQUIRED_SLOTS, type ClothesContent, type ClothingDef } from '../donnees/vetements';
import { unitDraw } from './tirage';
import type { ClothingSlot, Wear } from './types';

/** Lundi, dans l'ordre de `weekdayOf` (0: samedi). */
const MONDAY = 2;
const WEEK = 7;

/** Les identifiants portés, emplacement par emplacement (facultatifs vides omis). */
export function wornIds(wear: Readonly<Wear>): string[] {
  const out: string[] = [];
  for (const slot of CLOTHING_SLOTS) {
    const id = wear[slot];
    if (id !== null && id !== '') out.push(id);
  }
  return out;
}

/**
 * Les vêtements visibles d'une tenue, dans l'ordre des emplacements: ceux qu'un autre couvre
 * (la salopette couvre le haut) sont omis, comme les identifiants inconnus.
 */
export function visiblePieces(clothes: ClothesContent, wear: Readonly<Wear>): ClothingDef[] {
  const worn = wornIds(wear)
    .map((id) => clothes.byId[id])
    .filter((def): def is ClothingDef => def !== undefined);
  const covered = new Set<ClothingSlot>(worn.flatMap((def) => def.couvre));
  return worn.filter((def) => !covered.has(def.slot));
}

function rgb(hex: string): [number, number, number] {
  const value = Number.parseInt(hex.slice(1), 16);
  return Number.isNaN(value) ? [0, 0, 0] : [(value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff];
}

function colorDistance(a: string, b: string): number {
  const [ar, ag, ab] = rgb(a);
  const [br, bg, bb] = rgb(b);
  return (ar - br) ** 2 + (ag - bg) ** 2 + (ab - bb) ** 2;
}

/** Le vêtement de l'emplacement dont la couleur principale est la plus proche (égalité: le premier du fichier). */
function nearest(candidates: readonly ClothingDef[], target: string): string {
  let best: ClothingDef | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const def of candidates) {
    const d = colorDistance(def.couleurs.principale, target);
    if (d < bestDistance) {
      best = def;
      bestDistance = d;
    }
  }
  return best?.id ?? '';
}

/**
 * La tenue de départ `index` (écran de création, et migration de l'ancien `appearance.outfit`):
 * pour chaque emplacement obligatoire, le vêtement hors saison le plus proche des couleurs visées;
 * le bas préfère le style demandé (salopette) s'il existe, sinon un bas qui ne couvre rien.
 */
export function starterWear(clothes: ClothesContent, index: number): Wear {
  const starters = clothes.settings.starters;
  const n = starters.length;
  const starter = starters[n === 0 ? 0 : ((Math.round(index) % n) + n) % n];
  const pool = (slot: ClothingSlot): ClothingDef[] => {
    const all = clothes.list.filter((def) => def.slot === slot);
    const plain = all.filter((def) => def.saison === null);
    return plain.length > 0 ? plain : all;
  };
  const tops = pool('top').filter((def) => def.couvre.length === 0);
  const bottoms = pool('bottom');
  const styled = starter?.bottomStyle === null || starter === undefined ? [] : bottoms.filter((def) => def.style === starter.bottomStyle);
  const plainBottoms = bottoms.filter((def) => def.couvre.length === 0);
  return {
    top: nearest(tops, starter?.top ?? '#808080'),
    bottom: nearest(styled.length > 0 ? styled : plainBottoms, starter?.bottom ?? '#808080'),
    shoes: nearest(pool('shoes'), starter?.shoes ?? '#808080'),
    outer: null,
    hat: null,
  };
}

/** Rang de la tenue de départ que porte exactement ce personnage (haut, bas, chaussures), ou `null`. */
export function starterIndexOf(clothes: ClothesContent, wear: Readonly<Wear>): number | null {
  for (let i = 0; i < clothes.settings.starters.length; i++) {
    const s = starterWear(clothes, i);
    if (s.top === wear.top && s.bottom === wear.bottom && s.shoes === wear.shoes) return i;
  }
  return null;
}

/** Les vêtements d'une tenue de départ, pour la garde-robe du personnage. */
export function starterWardrobe(wear: Readonly<Wear>): string[] {
  return [...new Set(wornIds(wear))];
}

/** Le lundi de la semaine de ce jour (le jour 1 est un samedi: le lundi d'avant est le jour -1). */
export function mondayOf(day: number): number {
  return day - ((weekdayOf(day) - MONDAY + WEEK) % WEEK);
}

/** Mélange déterministe (Fisher-Yates) tiré de « graine:clé:lundi ». */
function shuffled<T>(items: readonly T[], seed: number, key: string, monday: number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(unitDraw(seed, `${key}:${String(i)}`, monday) * (i + 1));
    const a = out[i];
    const b = out[j];
    if (a !== undefined && b !== undefined) {
      out[i] = b;
      out[j] = a;
    }
  }
  return out;
}

function countIn(range: { min: number; max: number }, seed: number, key: string, monday: number): number {
  return range.min + Math.floor(unitDraw(seed, key, monday) * (range.max - range.min + 1));
}

/**
 * Le stock de la mercerie ce jour-là: le fonds permanent (les pièces hors saison les moins chères
 * de chaque emplacement obligatoire), plus la sélection du lundi (8 à 12 pièces, dont une ou deux
 * de la saison en cours, tirées par la graine). Dans l'ordre de `vetements.json`.
 */
export function clothesStock(clothes: ClothesContent, settings: Pick<Settings, 'calendar'>, seed: number, day: number): string[] {
  const s = clothes.settings;
  const monday = mondayOf(day);
  const season = seasonOfDay(settings, Math.max(1, day));
  const permanent = new Set<string>();
  for (const slot of REQUIRED_SLOTS) {
    clothes.list
      .filter((def) => def.slot === slot && def.saison === null)
      .sort((a, b) => a.prix - b.prix || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
      .slice(0, s.permanentPerSlot)
      .forEach((def) => permanent.add(def.id));
  }
  const total = countIn(s.weeklyPieces, seed, 'clothes:count', monday);
  const seasonal = shuffled(
    clothes.list.filter((def) => def.saison === season).map((def) => def.id),
    seed,
    `clothes:season:${season}`,
    monday,
  ).slice(0, Math.min(total, countIn(s.seasonalPieces, seed, `clothes:season-count:${season}`, monday)));
  const weekly = shuffled(
    clothes.list.filter((def) => def.saison === null && !permanent.has(def.id)).map((def) => def.id),
    seed,
    'clothes:weekly',
    monday,
  ).slice(0, Math.max(0, total - seasonal.length));
  const stocked = new Set([...permanent, ...weekly, ...seasonal]);
  return clothes.list.filter((def) => stocked.has(def.id)).map((def) => def.id);
}
