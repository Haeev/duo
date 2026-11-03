/**
 * Garde-robe (0.12, contrat `docs/jeux/jeu-1/garde-robe-0-12.md`): lecture et contrôle de
 * `donnees/vetements.json` (l'artiste 3D) et des réglages `wardrobe` de `reglages.json` (stock de
 * la mercerie, tenues de départ). Pur: la simulation, le rendu et l'interface lisent les mêmes
 * définitions.
 */
import type { ClothingSlot } from '../etat/types';
import { Reader } from './lecteur';
import type { Season } from './types';

export const CLOTHING_SLOTS: readonly ClothingSlot[] = ['top', 'outer', 'bottom', 'shoes', 'hat'];
/** Emplacements toujours portés (un vêtement chacun). */
export const REQUIRED_SLOTS: readonly ('top' | 'bottom' | 'shoes')[] = ['top', 'bottom', 'shoes'];

export interface ClothingColors {
  principale: string;
  secondaire: string;
  motif: string | null;
}

export interface ClothingDef {
  /** `<style>_<variante>`, par exemple `pull_moutarde`. */
  id: string;
  slot: ClothingSlot;
  style: string;
  nom: string;
  /** Nœud du maillage dans `personnages.glb` (`wear_<slot>_<style>`), partagé par les variantes. */
  modele: string;
  couleurs: ClothingColors;
  prix: number;
  /** En vente seulement cette saison (`null`: toute l'année). */
  saison: Season | null;
  /** Emplacements masqués quand on le porte (la salopette couvre `top`). */
  couvre: ClothingSlot[];
}

/** Une tenue de départ: couleurs visées par emplacement obligatoire (le vêtement le plus proche est choisi). */
export interface StarterOutfit {
  top: string;
  bottom: string;
  shoes: string;
  /** Style préféré pour le bas (`salopette`), s'il existe dans `vetements.json`. */
  bottomStyle: string | null;
}

export interface WardrobeSettings {
  /** Pièces tirées chaque lundi, hors saison et hors fonds permanent. */
  weeklyPieces: { min: number; max: number };
  /** Dont pièces de la saison en cours (vêtements à `saison`). */
  seasonalPieces: { min: number; max: number };
  /** Fonds permanent: les N pièces les moins chères de chaque emplacement obligatoire (hors saison). */
  permanentPerSlot: number;
  /** Tenues proposées à la création (index `create_character.outfit`), dans l'ordre de l'écran. */
  starters: StarterOutfit[];
}

export interface ClothesContent {
  /** Dans l'ordre du fichier. */
  list: ClothingDef[];
  byId: Record<string, ClothingDef>;
  settings: WardrobeSettings;
}

/** Tenues de départ d'avant la 0.12 (couleurs de l'ancien `OUTFITS` du rendu), aussi pour migrer `outfit`. */
const DEFAULT_STARTERS: StarterOutfit[] = [
  { top: '#5c7fa6', bottom: '#4a5d78', shoes: '#5a4636', bottomStyle: null },
  { top: '#b5663f', bottom: '#6b5541', shoes: '#4a3a2e', bottomStyle: null },
  { top: '#8ba37b', bottom: '#5e6a55', shoes: '#4f3f31', bottomStyle: 'salopette' },
  { top: '#d4a746', bottom: '#6e5b48', shoes: '#4a3a2e', bottomStyle: null },
  { top: '#8c4a5e', bottom: '#4f4450', shoes: '#463830', bottomStyle: null },
  { top: '#3f6f6a', bottom: '#3d4b52', shoes: '#4a3a2e', bottomStyle: 'salopette' },
  { top: '#c9b79a', bottom: '#5a5048', shoes: '#3f3229', bottomStyle: null },
  { top: '#6b7fb0', bottom: '#2f3a52', shoes: '#4a3a2e', bottomStyle: null },
];

export const DEFAULT_WARDROBE: WardrobeSettings = {
  weeklyPieces: { min: 8, max: 12 },
  seasonalPieces: { min: 1, max: 2 },
  permanentPerSlot: 2,
  starters: DEFAULT_STARTERS,
};

export const EMPTY_CLOTHES: ClothesContent = { list: [], byId: {}, settings: DEFAULT_WARDROBE };

const HEX = /^#[0-9a-fA-F]{6}$/;
const ID = /^[a-z0-9]+(_[a-z0-9]+)+$/;
/** Saisons en français (fichier de l'artiste) ou en anglais (reste du contenu). */
const SEASON_NAMES: Readonly<Record<string, Season>> = {
  spring: 'spring',
  summer: 'summer',
  autumn: 'autumn',
  winter: 'winter',
  printemps: 'spring',
  ete: 'summer',
  'été': 'summer',
  automne: 'autumn',
  hiver: 'winter',
};

function color(r: Reader): string {
  const value = r.string();
  if (!HEX.test(value)) r.fail(`couleur « #rrggbb » attendue, reçu « ${value} »`);
  return value.toLowerCase();
}

function optNonNull(r: Reader, key: string): Reader | null {
  const child = r.opt(key);
  return child === null || child.isNull() ? null : child;
}

function parseItem(r: Reader): ClothingDef {
  const id = r.at('id').string();
  if (!ID.test(id)) r.at('id').fail(`identifiant « <style>_<variante> » attendu, reçu « ${id} »`);
  const slot = r.at('slot').oneOf(CLOTHING_SLOTS);
  const style = r.at('style').string();
  const modele = r.at('modele').string();
  if (!modele.startsWith(`wear_${slot}_`)) r.at('modele').fail(`nœud « wear_${slot}_<style> » attendu`);
  const c = r.at('couleurs');
  const motif = optNonNull(c, 'motif');
  const saisonReader = optNonNull(r, 'saison');
  let saison: Season | null = null;
  if (saisonReader !== null) {
    const name = saisonReader.string().toLowerCase();
    saison = SEASON_NAMES[name] ?? saisonReader.fail(`saison inconnue « ${name} »`);
  }
  const couvreReader = optNonNull(r, 'couvre');
  const couvre =
    couvreReader === null
      ? []
      : Array.isArray(couvreReader.value)
        ? couvreReader.items().map((s) => s.oneOf(CLOTHING_SLOTS))
        : [couvreReader.oneOf(CLOTHING_SLOTS)];
  if (couvre.includes(slot)) r.at('couvre').fail('un vêtement ne couvre pas son propre emplacement');
  const nom = r.at('nom').string();
  if (nom.trim() === '') r.at('nom').fail('nom non vide attendu');
  return {
    id,
    slot,
    style,
    nom,
    modele,
    couleurs: { principale: color(c.at('principale')), secondaire: color(c.at('secondaire')), motif: motif === null ? null : color(motif) },
    prix: r.at('prix').integer(0, 100_000),
    saison,
    couvre,
  };
}

function range(r: Reader | null, fallback: { min: number; max: number }): { min: number; max: number } {
  if (r === null) return fallback;
  const [min, max] = r.items().map((x) => x.integer(0, 100));
  if (min === undefined || max === undefined || min > max) return r.fail('[min, max] attendu');
  return { min, max };
}

/** Réglages `wardrobe` de `reglages.json` (absents: ceux du contrat). */
export function parseWardrobeSettings(r: Reader | null): WardrobeSettings {
  if (r === null) return DEFAULT_WARDROBE;
  const starters = r.opt('starters');
  return {
    weeklyPieces: range(r.opt('weeklyPieces'), DEFAULT_WARDROBE.weeklyPieces),
    seasonalPieces: range(r.opt('seasonalPieces'), DEFAULT_WARDROBE.seasonalPieces),
    permanentPerSlot: r.opt('permanentPerSlot')?.integer(0, 20) ?? DEFAULT_WARDROBE.permanentPerSlot,
    starters:
      starters === null
        ? DEFAULT_STARTERS
        : starters.items().map((s) => ({
            top: color(s.at('top')),
            bottom: color(s.at('bottom')),
            shoes: color(s.at('shoes')),
            bottomStyle: optNonNull(s, 'bottomStyle')?.string() ?? null,
          })),
  };
}

/**
 * `vetements.json`: une liste de vêtements, nue ou sous `vetements` (ou `items`), avec `version` 1
 * facultative. Contrôles: identifiants uniques, au moins un vêtement par emplacement obligatoire.
 */
export function parseClothes(value: unknown, settings: WardrobeSettings): ClothesContent {
  const file = new Reader('vetements.json', '', value);
  let listReader: Reader = file;
  if (file.isObject()) {
    const version = file.opt('version');
    if (version !== null) version.integer(1, 1);
    listReader = file.opt('vetements') ?? file.at('items');
  }
  const list = listReader.items().map(parseItem);
  const byId: Record<string, ClothingDef> = {};
  for (const item of list) {
    if (byId[item.id] !== undefined) file.fail(`vêtement en double « ${item.id} »`);
    byId[item.id] = item;
  }
  for (const slot of REQUIRED_SLOTS) {
    if (!list.some((item) => item.slot === slot && item.couvre.length === 0)) file.fail(`aucun vêtement « ${slot} » qui ne couvre rien`);
  }
  if (settings.starters.length === 0) file.fail('au moins une tenue de départ attendue (reglages.json: wardrobe.starters)');
  return { list, byId, settings };
}
