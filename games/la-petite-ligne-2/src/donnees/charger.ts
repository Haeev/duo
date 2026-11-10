/**
 * Lecture et contrôle des données: chaque fichier passe son schéma, puis `valider.ts` contrôle
 * ce qui relie les fichiers entre eux. Une donnée fausse arrête le chargement avec le chemin du
 * fichier et du champ: jamais de valeur de secours silencieuse.
 */
import * as v from 'valibot';
import { BagsFileSchema, type BagsFile } from './schemas/sacs';
import { DialoguesFileSchema, type DialogueDef } from './schemas/dialogue';
import { ItemsFileSchema, type ItemDef } from './schemas/objets';
import { MapSchema, PlaceSchema, type MapDef, type PlaceDef } from './schemas/lieu';
import { NeedsFileSchema, type NeedsFile } from './schemas/besoins';
import { SettingsSchema, type Settings } from './schemas/reglages';
import { VillagersFileSchema, type VillagerDef } from './schemas/habitant';
import { validateContent } from './valider';

export interface PlaceContent {
  readonly def: PlaceDef;
  readonly map: MapDef;
  readonly villagers: readonly VillagerDef[];
  readonly dialogues: readonly DialogueDef[];
}

/** Tout le contenu du jeu, lu et contrôlé. Il ne change jamais pendant une partie. */
export interface Content {
  readonly settings: Settings;
  readonly items: Readonly<Record<string, ItemDef>>;
  readonly needs: NeedsFile;
  readonly bags: BagsFile;
  readonly places: Readonly<Record<string, PlaceContent>>;
}

export class ContentError extends Error {
  constructor(readonly problems: readonly string[]) {
    super(`données invalides:\n- ${problems.join('\n- ')}`);
    this.name = 'ContentError';
  }
}

function parse<TSchema extends v.GenericSchema>(schema: TSchema, files: Readonly<Record<string, unknown>>, path: string, problems: string[]): v.InferOutput<TSchema> | null {
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

const PLACE_FILE = /^lieux\/([^/]+)\/lieu\.json$/;

/** Lit la table des fichiers (`DATA_FILES`) et lève `ContentError` avec tous les problèmes trouvés. */
export function loadContent(files: Readonly<Record<string, unknown>>): Content {
  const problems: string[] = [];
  const settings = parse(SettingsSchema, files, 'commun/reglages.json', problems);
  const itemsFile = parse(ItemsFileSchema, files, 'commun/objets.json', problems);
  const needs = parse(NeedsFileSchema, files, 'commun/besoins.json', problems);
  const bags = parse(BagsFileSchema, files, 'commun/sacs.json', problems);

  const places: Record<string, PlaceContent> = {};
  for (const path of Object.keys(files).sort()) {
    const match = PLACE_FILE.exec(path);
    const folder = match?.[1];
    if (folder === undefined) continue;
    const base = `lieux/${folder}`;
    const def = parse(PlaceSchema, files, path, problems);
    const map = parse(MapSchema, files, `${base}/carte.json`, problems);
    const villagersFile = parse(VillagersFileSchema, files, `${base}/habitants.json`, problems);
    const dialogues: DialogueDef[] = [];
    for (const other of Object.keys(files).sort()) {
      if (!other.startsWith(`${base}/dialogues/`)) continue;
      const file = parse(DialoguesFileSchema, files, other, problems);
      if (file !== null) dialogues.push(...file.dialogues);
    }
    if (def === null || map === null || villagersFile === null) continue;
    if (def.id !== folder) problems.push(`${path}: l'identifiant « ${def.id} » doit être le nom du dossier « ${folder} »`);
    places[def.id] = { def, map, villagers: villagersFile.villagers, dialogues };
  }

  if (settings === null || itemsFile === null || needs === null || bags === null) throw new ContentError(problems);
  const items: Record<string, ItemDef> = {};
  for (const item of itemsFile.items) {
    if (item.id in items) problems.push(`commun/objets.json: objet « ${item.id} » en double`);
    items[item.id] = item;
  }
  const content: Content = { settings, items, needs, bags, places };
  problems.push(...validateContent(content));
  if (problems.length > 0) throw new ContentError(problems);
  return content;
}
