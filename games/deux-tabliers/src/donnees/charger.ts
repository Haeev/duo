/**
 * Chargement des données: chaque fichier passe son schéma, puis les références croisées sont
 * vérifiées. Un problème arrête le chargement, avec la liste complète en français.
 * Les chantiers lisent leurs propres fichiers (`loadXContent`) dans le même recueil.
 */
import { v } from '@duo/sdk';
import { loadArrangementContent, type ArrangementContent } from '../amenagement/donnees';
import { loadClienteleContent, type ClienteleContent } from '../clientele/donnees';
import { loadServiceContent, type ServiceContent } from '../service/donnees';
import { seatFacingIssues } from '../amenagement/assises';
import {
  FurnitureFileSchema,
  ObjectsFileSchema,
  PlanSchema,
  SettingsSchema,
  StartSchema,
  StationsFileSchema,
  type FurnitureType,
  type ObjectType,
  type Plan,
  type Settings,
  type Start,
  type StationType,
} from './schemas';

/** Fichiers de `donnees/`, par chemin relatif (`reglages.json`, `adresses/village.json`). */
export type DataFiles = Readonly<Record<string, unknown>>;

export interface Content {
  readonly settings: Settings;
  readonly objects: ReadonlyMap<string, ObjectType>;
  readonly furniture: ReadonlyMap<string, FurnitureType>;
  readonly stations: ReadonlyMap<string, StationType>;
  readonly plan: Plan;
  readonly start: Start;
  readonly service: ServiceContent;
  readonly clientele: ClienteleContent;
  readonly arrangement: ArrangementContent;
}

export class ContentError extends Error {
  constructor(readonly issues: readonly string[]) {
    super(`données invalides:\n- ${issues.join('\n- ')}`);
  }
}

/** Lit un fichier par son schéma; un échec ajoute ses problèmes et rend `null`. */
export function readFile<TSchema extends v.GenericSchema>(
  files: DataFiles,
  path: string,
  schema: TSchema,
  issues: string[],
): v.InferOutput<TSchema> | null {
  if (!(path in files)) {
    issues.push(`${path}: fichier absent`);
    return null;
  }
  const result = v.safeParse(schema, files[path]);
  if (result.success) return result.output;
  for (const issue of result.issues) {
    const where = v.getDotPath(issue) ?? '';
    issues.push(`${path}${where === '' ? '' : ` (${where})`}: ${issue.message}`);
  }
  return null;
}

function byId<T extends { readonly id: string }>(
  list: readonly T[],
  path: string,
  issues: string[],
): Map<string, T> {
  const map = new Map<string, T>();
  for (const item of list) {
    if (map.has(item.id)) issues.push(`${path}: identifiant en double « ${item.id} »`);
    map.set(item.id, item);
  }
  return map;
}

/** Charge l'adresse `address` (fichiers `adresses/<address>.json` et `departs/<address>.json`). */
export function loadContent(files: DataFiles, address = 'village'): Content {
  const issues: string[] = [];
  const settings = readFile(files, 'reglages.json', SettingsSchema, issues);
  const objectsFile = readFile(files, 'objets.json', ObjectsFileSchema, issues);
  const furnitureFile = readFile(files, 'meubles.json', FurnitureFileSchema, issues);
  const stationsFile = readFile(files, 'postes.json', StationsFileSchema, issues);
  const plan = readFile(files, `adresses/${address}.json`, PlanSchema, issues);
  const start = readFile(files, `departs/${address}.json`, StartSchema, issues);
  const service = loadServiceContent(files, issues);
  const clientele = loadClienteleContent(files, issues);
  const arrangement = loadArrangementContent(files, issues);
  if (
    settings === null ||
    objectsFile === null ||
    furnitureFile === null ||
    stationsFile === null ||
    plan === null ||
    start === null
  ) {
    throw new ContentError(issues);
  }
  const objects = byId(objectsFile.objects, 'objets.json', issues);
  // Objets posables du catalogue de l'aménagement: des meubles comme les autres pour le cœur.
  const furniture = byId(
    [...furnitureFile.furniture, ...arrangement.furnitureTypes],
    'meubles.json',
    issues,
  );
  const stations = byId(stationsFile.stations, 'postes.json', issues);

  for (const f of furniture.values()) {
    if (f.station !== null && !stations.has(f.station))
      issues.push(`meubles.json (${f.id}): poste inconnu « ${f.station} »`);
    if (f.source !== null && !objects.has(f.source))
      issues.push(`meubles.json (${f.id}): objet de la pile inconnu « ${f.source} »`);
    const station = f.station === null ? undefined : stations.get(f.station);
    if (station !== undefined && !f.slots.some((s) => s.id === station.slot)) {
      issues.push(
        `meubles.json (${f.id}): emplacement « ${station.slot} » du poste ${station.id} absent`,
      );
    }
  }
  for (const s of stations.values()) {
    for (const t of s.transforms) {
      for (const id of [t.from, t.to])
        if (!objects.has(id)) issues.push(`postes.json (${s.id}): objet inconnu « ${id} »`);
    }
  }
  const placed = new Map<string, FurnitureType>();
  for (const p of start.furniture) {
    const type = furniture.get(p.type);
    if (type === undefined)
      issues.push(`departs/${address}.json (${p.id}): meuble inconnu « ${p.type} »`);
    else placed.set(p.id, type);
  }
  for (const o of start.objects) {
    if (!objects.has(o.type)) issues.push(`departs/${address}.json: objet inconnu « ${o.type} »`);
    const holder = placed.get(o.furniture);
    if (holder === undefined)
      issues.push(`departs/${address}.json: meuble posé inconnu « ${o.furniture} »`);
    else if (!holder.slots.some((s) => s.id === o.slot))
      issues.push(`departs/${address}.json: emplacement « ${o.slot} » absent de ${o.furniture}`);
  }
  // Cohérence du monde (demande du client, 2026-11-07): aucune assise dos à sa table.
  for (const issue of seatFacingIssues(start.furniture, furniture, settings.seating.tableReach))
    issues.push(`departs/${address}.json: ${issue}`);

  if (issues.length > 0) throw new ContentError(issues);
  return { settings, objects, furniture, stations, plan, start, service, clientele, arrangement };
}
