/**
 * Modèle de l'éditeur de personnage (logique pure, testée dans Node): rayons, rangées de cases,
 * choix, tirage au hasard. Tout vient du catalogue: une pièce ajoutée paraît sans code.
 */
import type {
  Catalogue,
  Gender,
  Look,
  Morphologies,
  PieceDef,
  Slot,
} from '../../donnees/schemas/personnage';
import { GENDERS } from '../../donnees/schemas/personnage';
import { hashString, prng } from '../../rendu/personnages/apparence';
import { EDITOR_SETTINGS, type EditorCategory, type EditorSettings } from './reglages';

export interface CharacterData {
  readonly catalogue: Catalogue;
  readonly morphologies: Morphologies;
}

/** Ce qu'on compose: l'apparence, le genre (accords), le prénom. */
export interface EditorDraft {
  readonly gender: Gender;
  readonly look: Look;
  readonly name: string;
}

export type Tile =
  | { readonly kind: 'gender'; readonly gender: Gender }
  | { readonly kind: 'shape'; readonly shape: string }
  | { readonly kind: 'height'; readonly cm: number }
  | { readonly kind: 'skin'; readonly index: number }
  | { readonly kind: 'piece'; readonly slot: Slot; readonly id: string | null }
  | {
      readonly kind: 'color';
      readonly slot: Slot;
      readonly zone: number;
      readonly index: number;
      readonly hex: string;
    };

/** Une rangée de cases (la navigation au clavier va de rangée en rangée). */
export interface Row {
  /** Titre de la section (clé), affiché au-dessus de sa première rangée. */
  readonly title: string | null;
  readonly kind: 'tiles' | 'swatches';
  readonly tiles: readonly Tile[];
  /** Groupes légendés de la rangée, dans l'ordre des cases (clé de légende, nombre de cases). */
  readonly groups?: readonly { readonly title: string; readonly count: number }[];
}

/** Pièces d'un emplacement proposées aux joueurs: celles réservées aux habitants sont masquées. */
export function piecesFor(
  catalogue: Catalogue,
  slot: Slot,
  settings: EditorSettings = EDITOR_SETTINGS,
): PieceDef[] {
  return catalogue.pieces.filter(
    (piece) => piece.slot === slot && !piece.tags.includes(settings.villagerOnlyTag),
  );
}

/** Morphologies des joueurs (adultes). */
export function playerShapes(
  catalogue: Catalogue,
  settings: EditorSettings = EDITOR_SETTINGS,
): Catalogue['shapes'] {
  return catalogue.shapes.filter((shape) => settings.playerAges.includes(shape.age));
}

/** Silhouette d'une morphologie (`f`, `m`), `null` si elle n'en porte pas. */
export function genderOfShape(
  shape: string,
  morphologies: Morphologies,
  settings: EditorSettings = EDITOR_SETTINGS,
): Gender | null {
  const morphs: readonly string[] = morphologies.shapes[shape]?.morphs ?? [];
  return GENDERS.find((g) => morphs.includes(settings.genderMorph[g])) ?? null;
}

/** Morphologie de cette silhouette, de corpulence `build` si elle existe. */
export function shapeFor(
  gender: Gender,
  build: string | null,
  data: CharacterData,
  settings: EditorSettings = EDITOR_SETTINGS,
): string | null {
  const list = playerShapes(data.catalogue, settings).filter(
    (s) => genderOfShape(s.id, data.morphologies, settings) === gender,
  );
  return (list.find((s) => s.build === build) ?? list[Math.floor(list.length / 2)])?.id ?? null;
}

/** Couleurs d'une zone, dans l'ordre du catalogue, les teintes réservées aux joueurs à la fin. */
export function zoneColors(
  colors: readonly string[],
  settings: EditorSettings = EDITOR_SETTINGS,
): { index: number; hex: string }[] {
  const all = colors.map((hex, index) => ({ index, hex }));
  const reserved = (hex: string): boolean => settings.playerOnlyColors.includes(hex);
  return [...all.filter((c) => !reserved(c.hex)), ...all.filter((c) => reserved(c.hex))];
}

/** Rayons qui ont quelque chose à montrer avec ce catalogue (une section vide est retirée). */
export function editorCategories(
  catalogue: Catalogue,
  settings: EditorSettings = EDITOR_SETTINGS,
): EditorCategory[] {
  const out: EditorCategory[] = [];
  for (const category of settings.categories) {
    const sections = category.sections.filter(
      (section) =>
        section.kind !== 'slot' || piecesFor(catalogue, section.slot, settings).length > 0,
    );
    if (sections.length > 0) out.push({ ...category, sections });
  }
  return out;
}

function chunk<T>(list: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

/** La pièce portée à cet emplacement, `null` sinon. */
export function wornAt(look: Look, slot: Slot): Look['pieces'][number] | null {
  return look.pieces.find((piece) => piece.slot === slot) ?? null;
}

/** Les rangées d'un rayon pour ce brouillon (couleurs de la pièce portée sous ses pièces). */
export function rowsFor(
  category: EditorCategory,
  draft: EditorDraft,
  data: CharacterData,
  settings: EditorSettings = EDITOR_SETTINGS,
): Row[] {
  const rows: Row[] = [];
  const add = (title: string, kind: Row['kind'], tiles: Tile[], per: number): void => {
    chunk(tiles, per).forEach((part, i) =>
      rows.push({ title: i === 0 ? title : null, kind, tiles: part }),
    );
  };
  const columns = settings.columns;
  for (const section of category.sections) {
    switch (section.kind) {
      case 'gender':
        add(
          'gender',
          'tiles',
          GENDERS.map((gender) => ({ kind: 'gender', gender })),
          columns,
        );
        break;
      case 'shape': {
        // Les six silhouettes restent à tous, rangées par genre dans l'ordre des cases « Femme ou
        // homme », chaque groupe sous sa légende (`shape:f`, `shape:m`): on sait laquelle est
        // laquelle, et la rangée reste une seule ligne au clavier.
        const shapes = playerShapes(data.catalogue, settings);
        const keyOf = (id: string): string => {
          const g = genderOfShape(id, data.morphologies, settings);
          return g === null ? 'shape' : `shape:${g}`;
        };
        const order = [...GENDERS.map((g) => `shape:${g}`), 'shape'];
        const sorted = [...shapes].sort(
          (a, b) => order.indexOf(keyOf(a.id)) - order.indexOf(keyOf(b.id)),
        );
        chunk(sorted, columns).forEach((part, i) => {
          const groups: { title: string; count: number }[] = [];
          for (const s of part) {
            const last = groups.at(-1);
            if (last?.title === keyOf(s.id)) last.count += 1;
            else groups.push({ title: keyOf(s.id), count: 1 });
          }
          rows.push({
            title: i === 0 ? 'shape' : null,
            kind: 'tiles',
            tiles: part.map((s) => ({ kind: 'shape', shape: s.id })),
            groups,
          });
        });
        break;
      }
      case 'height':
        add(
          'height',
          'tiles',
          settings.heights.map((cm) => ({ kind: 'height', cm })),
          columns,
        );
        break;
      case 'skin':
        add(
          'skin',
          'swatches',
          data.catalogue.skins.map((_, index) => ({ kind: 'skin', index })),
          settings.swatchesPerRow,
        );
        break;
      case 'slot': {
        const slot = section.slot;
        const tiles: Tile[] = piecesFor(data.catalogue, slot, settings).map((p) => ({
          kind: 'piece',
          slot,
          id: p.id,
        }));
        if (settings.optional.includes(slot)) tiles.unshift({ kind: 'piece', slot, id: null });
        add(`slot:${slot}`, 'tiles', tiles, columns);
        const worn = wornAt(draft.look, slot);
        const def = worn === null ? undefined : data.catalogue.pieces.find((p) => p.id === worn.id);
        def?.zones.forEach((zone, z) => {
          add(
            `zone:${slot}:${zone.id}`,
            'swatches',
            zoneColors(zone.colors, settings).map((c) => ({
              kind: 'color',
              slot,
              zone: z,
              index: c.index,
              hex: c.hex,
            })),
            settings.swatchesPerRow,
          );
        });
        break;
      }
    }
  }
  return rows;
}

/** Couleurs actuelles d'une pièce portée (indices), défauts du catalogue à défaut. */
export function colorsOf(look: Look, piece: PieceDef, morphologies: Morphologies): number[] {
  const worn = wornAt(look, piece.slot);
  const defaults = morphologies.defaults[piece.id] ?? [];
  return piece.zones.map((_, i) => worn?.colors[i] ?? defaults[i] ?? 0);
}

export function isSelected(draft: EditorDraft, tile: Tile, data: CharacterData): boolean {
  const look = draft.look;
  switch (tile.kind) {
    case 'gender':
      return draft.gender === tile.gender;
    case 'shape':
      return look.shape === tile.shape;
    case 'height':
      return (
        (look.height ??
          Math.round(
            (data.catalogue.shapes.find((s) => s.id === look.shape)?.height ?? 1.7) * 100,
          )) === tile.cm
      );
    case 'skin':
      return look.skin === tile.index;
    case 'piece':
      return (wornAt(look, tile.slot)?.id ?? null) === tile.id;
    case 'color': {
      const worn = wornAt(look, tile.slot);
      const def = data.catalogue.pieces.find((p) => p.id === worn?.id);
      if (worn === null || def === undefined) return false;
      return colorsOf(look, def, data.morphologies)[tile.zone] === tile.index;
    }
  }
}

/** Porte cette pièce (ou vide l'emplacement), en gardant les couleurs déjà choisies du même emplacement. */
export function wear(
  look: Look,
  slot: Slot,
  id: string | null,
  data: CharacterData,
  settings: EditorSettings = EDITOR_SETTINGS,
): Look {
  const removed = new Set<Slot>([slot, ...(id === null ? [] : (settings.exclusive[slot] ?? []))]);
  const pieces = look.pieces.filter((p) => !removed.has(p.slot));
  if (id !== null) {
    const def = data.catalogue.pieces.find((p) => p.id === id);
    if (def !== undefined) {
      const before = wornAt(look, slot);
      const defaults = data.morphologies.defaults[id] ?? [];
      const colors = def.zones.map((zone, i) => {
        const kept = before?.colors[i];
        return kept !== undefined && kept < zone.colors.length ? kept : (defaults[i] ?? 0);
      });
      pieces.push({ slot, id, colors });
    }
  }
  return { ...look, pieces };
}

/** Applique une case. `starter`: look de départ proposé à un changement de genre (première création). */
export function choose(
  draft: EditorDraft,
  tile: Tile,
  data: CharacterData,
  starter: ((gender: Gender) => Look) | null = null,
  settings: EditorSettings = EDITOR_SETTINGS,
): EditorDraft {
  const look = draft.look;
  switch (tile.kind) {
    case 'gender': {
      if (tile.gender === draft.gender) return draft;
      if (starter !== null)
        return {
          ...draft,
          gender: tile.gender,
          look: withHeight(starter(tile.gender), look.height),
        };
      const build = data.catalogue.shapes.find((s) => s.id === look.shape)?.build ?? null;
      const shape = shapeFor(tile.gender, build, data, settings) ?? look.shape;
      return { ...draft, gender: tile.gender, look: { ...look, shape } };
    }
    case 'shape':
      return { ...draft, look: { ...look, shape: tile.shape } };
    case 'height':
      return { ...draft, look: { ...look, height: tile.cm } };
    case 'skin':
      return { ...draft, look: { ...look, skin: tile.index } };
    case 'piece':
      return { ...draft, look: wear(look, tile.slot, tile.id, data, settings) };
    case 'color': {
      const pieces = look.pieces.map((p) => {
        if (p.slot !== tile.slot) return p;
        const def = data.catalogue.pieces.find((d) => d.id === p.id);
        if (def === undefined) return p;
        const colors = colorsOf(look, def, data.morphologies);
        colors[tile.zone] = tile.index;
        return { ...p, colors };
      });
      return { ...draft, look: { ...look, pieces } };
    }
  }
}

/**
 * Au hasard: silhouette du genre choisi, corpulence, taille, peau, et une pièce par rayon parmi
 * celles des joueurs (teintes réservées comprises). Le genre et le prénom restent.
 */
export function randomDraft(
  draft: EditorDraft,
  seed: string,
  data: CharacterData,
  settings: EditorSettings = EDITOR_SETTINGS,
): EditorDraft {
  const random = prng(hashString(seed));
  const pick = <T>(list: readonly T[]): T | undefined => list[Math.floor(random() * list.length)];
  const shapes = playerShapes(data.catalogue, settings).filter(
    (s) => genderOfShape(s.id, data.morphologies, settings) === draft.gender,
  );
  const shape = pick(shapes)?.id ?? draft.look.shape;
  const skin = Math.floor(random() * data.catalogue.skins.length);
  let look: Look = withHeight(
    { shape, skin, pieces: [] },
    pick(settings.heights) ?? draft.look.height,
  );
  const slotsInOrder: Slot[] = [];
  for (const category of settings.categories)
    for (const section of category.sections)
      if (section.kind === 'slot') slotsInOrder.push(section.slot);
  // Robe ou haut et bas: un seul tirage décide quels emplacements on saute.
  const wholes = slotsInOrder.filter(
    (slot) =>
      (settings.exclusive[slot]?.length ?? 0) > 1 &&
      piecesFor(data.catalogue, slot, settings).length > 0,
  );
  const dressed = wholes.length > 0 && random() < settings.randomDress;
  const skipped = new Set<Slot>(
    dressed ? wholes.flatMap((slot) => settings.exclusive[slot] ?? []) : wholes,
  );
  for (const slot of slotsInOrder) {
    const roll = random();
    const list = piecesFor(data.catalogue, slot, settings);
    if (skipped.has(slot) || list.length === 0) continue;
    if (
      settings.optional.includes(slot) &&
      roll < settings.randomOptional[slot === 'hair' ? 'hair' : 'other']
    )
      continue;
    const piece = pick(list);
    if (piece === undefined) continue;
    const colors = piece.zones.map((zone) => Math.floor(random() * zone.colors.length));
    look = { ...look, pieces: [...look.pieces, { slot, id: piece.id, colors }] };
  }
  return { ...draft, look };
}

/** Ce look avec cette taille (absente: celle de la morphologie). */
export function withHeight(look: Look, height: number | undefined): Look {
  const rest: Look = { shape: look.shape, skin: look.skin, pieces: look.pieces };
  return height === undefined ? rest : { ...rest, height };
}

/** Prénom accepté (contrat `LabelSchema`): non vide une fois nettoyé, coupé à la longueur permise. */
export function cleanName(raw: string, settings: EditorSettings = EDITOR_SETTINGS): string {
  return raw.replace(/\s+/g, ' ').trim().slice(0, settings.nameMax);
}

/** Déplacement du focus dans des rangées de longueurs différentes (colonne proportionnelle). */
export function moveFocus(
  rows: readonly { readonly tiles: readonly unknown[] }[],
  at: { row: number; col: number },
  key: 'up' | 'down' | 'left' | 'right',
): { row: number; col: number } {
  if (rows.length === 0) return { row: 0, col: 0 };
  const row = Math.min(Math.max(0, at.row), rows.length - 1);
  const length = rows[row]?.tiles.length ?? 1;
  const col = Math.min(Math.max(0, at.col), length - 1);
  if (key === 'left') return { row, col: Math.max(0, col - 1) };
  if (key === 'right') return { row, col: Math.min(length - 1, col + 1) };
  const next = key === 'up' ? row - 1 : row + 1;
  if (next < 0 || next >= rows.length) return { row, col };
  const target = rows[next]?.tiles.length ?? 1;
  const ratio = length <= 1 ? 0 : col / (length - 1);
  return { row: next, col: Math.round(ratio * Math.max(0, target - 1)) };
}
