/**
 * Apparences (logique pure, testée dans Node): ce qu'un `Look` donne à assembler, et les looks
 * composés tant que l'éditeur n'existe pas. Rien n'est nommé ici: les pièces se choisissent par
 * leur emplacement dans le catalogue, une pièce ajoutée au catalogue entre dans le tirage.
 */
import type { Catalogue, Gender, Look, PieceDef, Slot } from '../../donnees/schemas/personnage';
import type { Morphologies } from '../../donnees/schemas/personnage';
import { WARDROBE } from '../../simulation/regles/recompenses';
import { CHARACTER_SETTINGS, type CharacterSettings } from './reglages';

/** Une pièce à fusionner: nœud à prendre dans son fichier, couleurs des zones (hexadécimal). */
export interface ResolvedPiece {
  readonly id: string;
  readonly slot: Slot;
  readonly file: string;
  readonly node: string;
  readonly colors: readonly string[];
}

export interface ResolvedLook {
  readonly shape: string;
  readonly skin: string;
  /** Corps en tête, puis les pièces du look dans l'ordre des emplacements. */
  readonly pieces: readonly ResolvedPiece[];
  /** Indices des sections du corps retirées (régions couvertes). */
  readonly covered: readonly number[];
}

/** Clé stable d'un look résolu: deux personnages de même clé partagent leur géométrie. */
export function lookKey(look: ResolvedLook): string {
  return JSON.stringify(look);
}

/**
 * Ce que le look donne à assembler. Une pièce inconnue (catalogue plus ancien que la sauvegarde)
 * est ignorée, comme une morphologie inconnue (première du catalogue): le personnage s'affiche.
 */
export function resolveLook(
  look: Look,
  catalogue: Catalogue,
  morphologies: Morphologies,
): ResolvedLook {
  const byId = new Map(catalogue.pieces.map((piece) => [piece.id, piece]));
  const body = catalogue.pieces.find((piece) => piece.slot === 'body');
  const chosen: { piece: PieceDef; colors: readonly number[] }[] = [];
  if (body !== undefined) chosen.push({ piece: body, colors: [] });
  const order = (slot: Slot): number => SLOT_ORDER.indexOf(slot);
  const wanted = [...look.pieces].sort((a, b) => order(a.slot) - order(b.slot));
  for (const entry of wanted) {
    const piece = byId.get(entry.id);
    if (piece === undefined || piece.slot === 'body') continue;
    chosen.push({ piece, colors: entry.colors });
  }
  let hair: 'free' | 'flat' | 'hidden' = 'free';
  const covered = new Set<number>();
  for (const { piece } of chosen) {
    if (piece.hair === 'hidden') hair = 'hidden';
    else if (piece.hair === 'flat' && hair === 'free') hair = 'flat';
    for (const region of piece.covers) {
      const index = morphologies.regions.indexOf(region);
      if (index > 0) covered.add(index);
    }
  }
  const pieces: ResolvedPiece[] = [];
  for (const { piece, colors } of chosen) {
    if (piece.slot === 'hair' && hair === 'hidden') continue;
    const node =
      piece.slot === 'hair' && hair === 'flat' ? piece.node + morphologies.flat_suffix : piece.node;
    const defaults = morphologies.defaults[piece.id] ?? [];
    pieces.push({
      id: piece.id,
      slot: piece.slot,
      file: piece.file,
      node,
      colors: piece.zones.map((zone, i) => {
        const index = colors[i] ?? defaults[i] ?? 0;
        return zone.colors[index] ?? zone.colors[0] ?? '#ffffff';
      }),
    });
  }
  const shape =
    morphologies.shapes[look.shape] !== undefined
      ? look.shape
      : (catalogue.shapes[0]?.id ?? look.shape);
  return {
    shape,
    skin: catalogue.skins[look.skin] ?? catalogue.skins[0] ?? '#e0ae86',
    pieces,
    covered: [...covered].sort((a, b) => a - b),
  };
}

const SLOT_ORDER: readonly Slot[] = [
  'body',
  'shoes',
  'bottom',
  'dress',
  'top',
  'accessory',
  'head',
  'hair',
  'hat',
  'glasses',
];

/** Hachage FNV-1a d'une chaîne: la graine d'un look composé, la même sur les deux machines. */
export function hashString(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** Générateur mulberry32: déterministe, sans `Math.random`. */
export function prng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(list: readonly T[], random: () => number): T | undefined {
  return list[Math.floor(random() * list.length)];
}

export interface ComposeOptions {
  /** Morphologies permises (toutes par défaut). */
  readonly shapes?: readonly string[];
  /** Couleur à approcher pour la zone principale du haut (couleur du joueur). */
  readonly accent?: string;
}

function distance(a: string, b: string): number {
  const ra = parseInt(a.slice(1), 16);
  const rb = parseInt(b.slice(1), 16);
  let sum = 0;
  for (const shift of [16, 8, 0]) {
    const d = ((ra >> shift) & 255) - ((rb >> shift) & 255);
    sum += d * d;
  }
  return sum;
}

/**
 * Look composé à partir d'une graine: une morphologie, une peau, une tête, des cheveux, un haut
 * et un bas (ou une robe), des chaussures, parfois une coiffe ou un accessoire. Les pièces sont
 * prises dans le catalogue par emplacement: une pièce ajoutée entre dans le tirage sans code.
 */
export function composeLook(
  seed: string,
  catalogue: Catalogue,
  options: ComposeOptions = {},
  settings: CharacterSettings = CHARACTER_SETTINGS,
): Look {
  const random = prng(hashString(seed));
  const slot = (name: Slot): PieceDef[] => catalogue.pieces.filter((p) => p.slot === name);
  const shapes = options.shapes ?? catalogue.shapes.map((s) => s.id);
  const shape = pick(shapes, random) ?? catalogue.shapes[0]?.id ?? 'adult-f-medium';
  const skin = Math.floor(random() * catalogue.skins.length);
  const pieces: Look['pieces'] = [];
  const add = (piece: PieceDef | undefined, accent?: string): void => {
    if (piece === undefined) return;
    const colors = piece.zones.map((zone, i) => {
      if (i === 0 && accent !== undefined) {
        let best = 0;
        zone.colors.forEach((color, index) => {
          const current = zone.colors[best] ?? color;
          if (distance(color, accent) < distance(current, accent)) best = index;
        });
        return best;
      }
      return Math.floor(random() * zone.colors.length);
    });
    pieces.push({ slot: piece.slot, id: piece.id, colors });
  };
  // Tirages toujours faits dans le même ordre: une pièce facultative absente ne décale rien.
  const dressRoll = random();
  const hatRoll = random();
  const accessoryRoll = random();
  add(pick(slot('head'), random));
  add(pick(slot('hair'), random));
  const dresses = slot('dress');
  if (dresses.length > 0 && dressRoll < settings.composed.dress) {
    add(pick(dresses, random), options.accent);
  } else {
    add(pick(slot('top'), random), options.accent);
    add(pick(slot('bottom'), random));
  }
  add(pick(slot('shoes'), random));
  if (hatRoll < settings.composed.hat) add(pick(slot('hat'), random));
  if (accessoryRoll < settings.composed.accessory) add(pick(slot('accessory'), random));
  return { shape, skin, pieces };
}

/**
 * Look de la silhouette d'un joueur pas encore révélé: le même pour les deux joueurs, sans
 * cheveux ni coiffe (`settings.silhouette`). Le rendu le peint d'une seule teinte sombre.
 */
export function silhouetteLook(
  startShapes: Readonly<Record<Gender, string>>,
  catalogue: Catalogue,
  settings: CharacterSettings = CHARACTER_SETTINGS,
): Look {
  const pieces: Look['pieces'] = [];
  for (const slot of settings.silhouette.slots) {
    const piece = catalogue.pieces.find((p) => p.slot === slot);
    if (piece !== undefined) pieces.push({ slot: piece.slot, id: piece.id, colors: [] });
  }
  return { shape: startShapes[settings.silhouette.gender], skin: 0, pieces };
}

/** Look par défaut d'un joueur sans personnage créé: sa silhouette, sa couleur de profil. */
export function defaultPlayerLook(
  index: 0 | 1,
  gender: Gender | null,
  startShapes: Readonly<Record<Gender, string>>,
  accent: string,
  catalogue: Catalogue,
  settings: CharacterSettings = CHARACTER_SETTINGS,
): Look {
  const chosen = gender ?? settings.defaultGenders[index];
  // Jamais une pièce à gagner: le joueur doit pouvoir valider ce look sans rien changer.
  const owned = catalogue.pieces.filter((piece) => !piece.tags.includes(WARDROBE.lockedTag));
  return composeLook(
    `joueur-${String(index)}`,
    { ...catalogue, pieces: owned },
    {
      shapes: [startShapes[chosen]],
      accent,
    },
  );
}
