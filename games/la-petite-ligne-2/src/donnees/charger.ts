/**
 * Lecture et contrôle des données. Un contenu = un fichier: ajouter un objet, un meuble, un
 * habitant ou un lieu, c'est ajouter un fichier (ou un dossier), sans rien inscrire ailleurs.
 * Chaque fichier passe son schéma, puis `valider.ts` contrôle ce qui relie les fichiers. Une
 * donnée fausse arrête le chargement avec le chemin du fichier et du champ: jamais de valeur de
 * secours silencieuse.
 */
import * as v from 'valibot';
import { NeedsFileSchema, type NeedsFile } from './schemas/besoins';
import { ShopSchema, type ShopDef } from './schemas/commerce';
import { DialogueSchema, type DialogueDef } from './schemas/dialogue';
import { VillagerSchema, type VillagerDef } from './schemas/habitant';
import { MapSchema, PlaceSchema, type MapDef, type PlaceDef } from './schemas/lieu';
import { PropSchema, type PropDef } from './schemas/meuble';
import { ItemSchema, type ItemDef } from './schemas/objets';
import {
  CatalogueSchema,
  MorphologiesSchema,
  type Catalogue,
  type Morphologies,
  type PieceDef,
} from './schemas/personnage';
import { CatchSchema, type CatchDef } from './schemas/prise';
import { QuestLineSchema, type QuestLineDef } from './schemas/quete';
import { RecipeSchema, type RecipeDef } from './schemas/recette';
import { SettingsSchema, type Settings } from './schemas/reglages';
import { BagsFileSchema, type BagsFile } from './schemas/sacs';
import { validateContent } from './valider';

type ById<T> = Readonly<Record<string, T>>;

/** Un lieu: un dossier autonome branché sur le socle commun. */
export interface PlaceContent {
  readonly def: PlaceDef;
  readonly map: MapDef;
  /** Dans l'ordre des noms de fichiers (c'est aussi l'ordre du canal rapide). */
  readonly villagers: readonly VillagerDef[];
  readonly dialogues: readonly DialogueDef[];
  readonly shops: ById<ShopDef>;
  readonly quests: ById<QuestLineDef>;
}

/** Tout le contenu du jeu, lu et contrôlé. Il ne change jamais pendant une partie. */
export interface Content {
  readonly settings: Settings;
  readonly needs: NeedsFile;
  readonly bags: BagsFile;
  /** Catalogue des personnages (morphologies, peaux), et ses pièces par identifiant. */
  readonly catalogue: Catalogue;
  /** Conventions partagées par le générateur de pièces et l'assemblage. */
  readonly morphologies: Morphologies;
  readonly items: ById<ItemDef>;
  /** Meubles et éléments interactifs du décor. */
  readonly props: ById<PropDef>;
  readonly recipes: ById<RecipeDef>;
  readonly catches: ById<CatchDef>;
  readonly pieces: ById<PieceDef>;
  readonly places: ById<PlaceContent>;
}

export class ContentError extends Error {
  constructor(readonly problems: readonly string[]) {
    super(`données invalides:\n- ${problems.join('\n- ')}`);
    this.name = 'ContentError';
  }
}

type Files = Readonly<Record<string, unknown>>;

function parse<TSchema extends v.GenericSchema>(
  schema: TSchema,
  files: Files,
  path: string,
  problems: string[],
): v.InferOutput<TSchema> | null {
  if (!(path in files)) {
    problems.push(`${path}: fichier absent`);
    return null;
  }
  const result = v.safeParse(schema, files[path]);
  if (result.success) return result.output;
  for (const issue of result.issues) {
    const at = v.getDotPath(issue) ?? '';
    problems.push(`${path}${at === '' ? '' : `, ${at}`}: ${issue.message}`);
  }
  return null;
}

/**
 * Tous les fichiers `<dossier>/<id>.json`, par identifiant. Le nom du fichier est l'identifiant:
 * c'est ce qui rend les doublons impossibles et les références faciles à suivre.
 */
function parseFolder<TSchema extends v.GenericSchema<unknown, { id: string }>>(
  schema: TSchema,
  files: Files,
  folder: string,
  problems: string[],
): Record<string, v.InferOutput<TSchema>> {
  const out: Record<string, v.InferOutput<TSchema>> = {};
  const prefix = `${folder}/`;
  for (const path of Object.keys(files).sort()) {
    if (!path.startsWith(prefix) || path.slice(prefix.length).includes('/')) continue;
    const parsed = parse(schema, files, path, problems);
    if (parsed === null) continue;
    const name = path.slice(prefix.length, -'.json'.length);
    if (parsed.id !== name)
      problems.push(`${path}: l'identifiant « ${parsed.id} » doit être le nom du fichier`);
    out[parsed.id] = parsed;
  }
  return out;
}

const PLACE_FILE = /^lieux\/([^/]+)\/lieu\.json$/;

/** Lit la table des fichiers (`DATA_FILES`) et lève `ContentError` avec tous les problèmes trouvés. */
export function loadContent(files: Files): Content {
  const problems: string[] = [];
  const settings = parse(SettingsSchema, files, 'commun/reglages.json', problems);
  const needs = parse(NeedsFileSchema, files, 'commun/besoins.json', problems);
  const bags = parse(BagsFileSchema, files, 'commun/sacs.json', problems);
  const catalogue = parse(CatalogueSchema, files, 'commun/personnages/catalogue.json', problems);
  const morphologies = parse(
    MorphologiesSchema,
    files,
    'commun/personnages/morphologies.json',
    problems,
  );
  const items = parseFolder(ItemSchema, files, 'commun/objets', problems);
  const props = parseFolder(PropSchema, files, 'commun/meubles', problems);
  const recipes = parseFolder(RecipeSchema, files, 'commun/recettes', problems);
  const catches = parseFolder(CatchSchema, files, 'commun/prises', problems);

  const places: Record<string, PlaceContent> = {};
  for (const path of Object.keys(files).sort()) {
    const folder = PLACE_FILE.exec(path)?.[1];
    if (folder === undefined) continue;
    const base = `lieux/${folder}`;
    const def = parse(PlaceSchema, files, path, problems);
    const map = parse(MapSchema, files, `${base}/carte.json`, problems);
    const villagers = Object.values(
      parseFolder(VillagerSchema, files, `${base}/habitants`, problems),
    );
    const dialogues = Object.values(
      parseFolder(DialogueSchema, files, `${base}/dialogues`, problems),
    );
    const shops = parseFolder(ShopSchema, files, `${base}/commerces`, problems);
    const quests = parseFolder(QuestLineSchema, files, `${base}/quetes`, problems);
    if (def === null || map === null) continue;
    if (def.id !== folder)
      problems.push(
        `${path}: l'identifiant « ${def.id} » doit être le nom du dossier « ${folder} »`,
      );
    places[def.id] = { def, map, villagers, dialogues, shops, quests };
  }

  if (
    settings === null ||
    needs === null ||
    bags === null ||
    catalogue === null ||
    morphologies === null
  )
    throw new ContentError(problems);
  const pieces: Record<string, PieceDef> = {};
  for (const piece of catalogue.pieces) {
    if (piece.id in pieces)
      problems.push(`commun/personnages/catalogue.json: pièce « ${piece.id} » en double`);
    pieces[piece.id] = piece;
  }
  const content: Content = {
    settings,
    needs,
    bags,
    catalogue,
    morphologies,
    items,
    props,
    recipes,
    catches,
    pieces,
    places,
  };
  problems.push(...validateContent(content));
  if (problems.length > 0) throw new ContentError(problems);
  return content;
}
