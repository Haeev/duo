/**
 * Lecture et contrôle des données du temps du monde et des collections (`schemas/temps.ts`,
 * `schemas/collections.ts`). Appelé par `charger.ts`; mêmes règles: un contenu = un fichier, le
 * nom du fichier est l'identifiant, une faute nomme son fichier et son champ.
 */
import * as v from 'valibot';
import type { Content } from './charger';
import {
  CollectionEntrySchema,
  CollectionsFileSchema,
  InsectSchema,
  NatureSchema,
  PhotoSubjectSchema,
  type CollectionEntryDef,
  type CollectionsFile,
  type InsectDef,
  type NatureDef,
  type PhotoSubjectDef,
} from './schemas/collections';
import {
  CalendarEventSchema,
  ClimateSchema,
  TimeFileSchema,
  type CalendarEventDef,
  type ClimateDef,
  type TimeFile,
} from './schemas/temps';

type ById<T> = Readonly<Record<string, T>>;
type Files = Readonly<Record<string, unknown>>;

export interface TimeContent {
  readonly file: TimeFile;
  /** Climat de chaque lieu (celui de `temps.json` pour un lieu sans `climat.json`). */
  readonly climates: ById<ClimateDef>;
  /** Événements du calendrier de chaque lieu, dans l'ordre des noms de fichiers. */
  readonly events: ById<readonly CalendarEventDef[]>;
}

export interface BookContent {
  readonly categories: CollectionsFile['categories'];
  readonly entries: ById<CollectionEntryDef>;
  readonly insects: ById<InsectDef>;
  readonly photos: ById<PhotoSubjectDef>;
  /** Zones de terrain par lieu (lieu sans `nature.json`: aucune zone). */
  readonly nature: ById<NatureDef>;
}

function parseAt<T extends v.GenericSchema>(
  schema: T,
  files: Files,
  path: string,
  problems: string[],
): v.InferOutput<T> | null {
  const result = v.safeParse(schema, files[path]);
  if (result.success) return result.output;
  for (const issue of result.issues) {
    const at = v.getDotPath(issue) ?? '';
    problems.push(`${path}${at === '' ? '' : `, ${at}`}: ${issue.message}`);
  }
  return null;
}

function parseFolder<T extends v.GenericSchema<unknown, { id: string }>>(
  schema: T,
  files: Files,
  folder: string,
  problems: string[],
): Record<string, v.InferOutput<T>> {
  const out: Record<string, v.InferOutput<T>> = {};
  const prefix = `${folder}/`;
  for (const path of Object.keys(files).sort()) {
    if (!path.startsWith(prefix) || path.slice(prefix.length).includes('/')) continue;
    const parsed = parseAt(schema, files, path, problems);
    if (parsed === null) continue;
    const name = path.slice(prefix.length, -'.json'.length);
    if (parsed.id !== name)
      problems.push(`${path}: l'identifiant « ${parsed.id} » doit être le nom du fichier`);
    out[parsed.id] = parsed;
  }
  return out;
}

const PLACE_FILE = /^lieux\/([^/]+)\/lieu\.json$/;

/** `null` si `commun/temps.json` ou `commun/collections.json` manque ou est faux (problème noté). */
export function loadTimeAndBook(
  files: Files,
  problems: string[],
): { time: TimeContent; book: BookContent } | null {
  for (const path of ['commun/temps.json', 'commun/collections.json'])
    if (!(path in files)) problems.push(`${path}: fichier absent`);
  const file = parseAt(TimeFileSchema, files, 'commun/temps.json', problems);
  const categories = parseAt(CollectionsFileSchema, files, 'commun/collections.json', problems);
  const climates: Record<string, ClimateDef> = {};
  const events: Record<string, CalendarEventDef[]> = {};
  const nature: Record<string, NatureDef> = {};
  for (const path of Object.keys(files).sort()) {
    const place = PLACE_FILE.exec(path)?.[1];
    if (place === undefined) continue;
    const base = `lieux/${place}`;
    if (`${base}/climat.json` in files) {
      const climate = parseAt(ClimateSchema, files, `${base}/climat.json`, problems);
      if (climate !== null) climates[place] = climate;
    } else if (file !== null) climates[place] = file.defaultClimate;
    if (`${base}/nature.json` in files) {
      const zones = parseAt(NatureSchema, files, `${base}/nature.json`, problems);
      if (zones !== null) nature[place] = zones;
    }
    events[place] = Object.values(
      parseFolder(CalendarEventSchema, files, `${base}/evenements`, problems),
    );
  }
  if (file === null || categories === null) return null;
  return {
    time: { file, climates, events },
    book: {
      categories: categories.categories,
      entries: parseFolder(CollectionEntrySchema, files, 'commun/carnet', problems),
      insects: parseFolder(InsectSchema, files, 'commun/insectes', problems),
      photos: parseFolder(PhotoSubjectSchema, files, 'commun/photos', problems),
      nature,
    },
  };
}

/** Références entre fichiers: lieux, catégories, objets, entrées, habitants, terrains. */
export function validateTimeAndBook(content: Content): string[] {
  const problems: string[] = [];
  const { time, book } = content;
  const villagers = new Set(
    Object.values(content.places).flatMap((p) => p.villagers.map((x) => x.id)),
  );
  const categories = new Set(book.categories.map((c) => c.id));
  const byItem = new Map<string, string>();
  for (const entry of Object.values(book.entries)) {
    const at = `commun/carnet/${entry.id}.json`;
    if (!categories.has(entry.category))
      problems.push(`${at}: catégorie inconnue « ${entry.category} »`);
    if (!(entry.place in content.places)) problems.push(`${at}: lieu inconnu « ${entry.place} »`);
    if (entry.source.type === 'item') {
      if (!(entry.source.item in content.items))
        problems.push(`${at}: objet inconnu « ${entry.source.item} »`);
      const other = byItem.get(entry.source.item);
      if (other !== undefined)
        problems.push(`${at}: l'objet « ${entry.source.item} » inscrit déjà « ${other} »`);
      byItem.set(entry.source.item, entry.id);
    }
  }
  const entryOf = (at: string, id: string, source: string): void => {
    const entry = book.entries[id];
    if (entry === undefined) problems.push(`${at}: entrée inconnue « ${id} »`);
    else if (entry.source.type !== source)
      problems.push(`${at}: l'entrée « ${id} » doit avoir la source « ${source} »`);
  };
  for (const insect of Object.values(book.insects)) {
    const at = `commun/insectes/${insect.id}.json`;
    entryOf(at, insect.entry, 'insect');
    if (insect.item !== null && !(insect.item in content.items))
      problems.push(`${at}: objet inconnu « ${insect.item} »`);
    for (const place of insect.places)
      if (!(place in content.places)) problems.push(`${at}: lieu inconnu « ${place} »`);
  }
  for (const photo of Object.values(book.photos)) {
    const at = `commun/photos/${photo.id}.json`;
    entryOf(at, photo.entry, 'photo');
    const t = photo.target;
    if (t.type === 'point' || t.type === 'object') {
      const place = content.places[t.place];
      if (place === undefined) problems.push(`${at}: lieu inconnu « ${t.place} »`);
      else if (t.type === 'point' && !(t.point in place.map.points))
        problems.push(`${at}: point inconnu « ${t.point} »`);
      else if (t.type === 'object' && !place.map.objects.some((o) => o.id === t.object))
        problems.push(`${at}: objet de carte inconnu « ${t.object} »`);
    } else if (t.type === 'villager' && !villagers.has(t.villager))
      problems.push(`${at}: habitant inconnu « ${t.villager} »`);
    else if (t.type === 'insect' && !(t.insect in book.insects))
      problems.push(`${at}: insecte inconnu « ${t.insect} »`);
    else if (
      t.type === 'event' &&
      !Object.values(time.events).some((l) => l.some((e) => e.id === t.event))
    )
      problems.push(`${at}: événement inconnu « ${t.event} »`);
  }
  for (const [placeId, list] of Object.entries(time.events)) {
    const place = content.places[placeId];
    for (const event of list) {
      const at = `lieux/${placeId}/evenements/${event.id}.json`;
      if (event.when.type === 'date' && event.when.day > content.settings.clock.seasonDays)
        problems.push(`${at}: jour ${String(event.when.day)} au-delà de la saison`);
      const shop = event.activates.shop;
      if (shop !== null && place !== undefined && !(shop in place.shops))
        problems.push(`${at}: commerce inconnu « ${shop} »`);
      const closed = event.closes?.shops;
      if (Array.isArray(closed) && place !== undefined)
        for (const id of closed)
          if (!(id in place.shops)) problems.push(`${at}: commerce à fermer inconnu « ${id} »`);
      if (event.activates.tune !== null) entryOf(at, event.activates.tune, 'tune');
    }
  }
  const slots = time.file.weatherSlots;
  for (let i = 1; i < slots.length; i++) {
    const dawn = content.settings.clock.dayStart;
    const rel = (m: number): number => (m - dawn + 1440) % 1440;
    if (rel(slots[i] ?? 0) <= rel(slots[i - 1] ?? 0))
      problems.push('commun/temps.json, weatherSlots: tranches croissantes depuis l’aube');
  }
  return problems;
}
