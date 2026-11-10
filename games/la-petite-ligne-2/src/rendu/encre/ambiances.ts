/**
 * Rendu encré: les ambiances, en données (`ambiances.json`). Une ambiance ne touche à aucune
 * géométrie ni texture: ce sont les trois tons de la lumière (clair, demi-teinte, ombre), la
 * couleur de l'encre, les lampes, la brume, la vignette et la teinte dominante. Une fiche par
 * identifiant d'ambiance du climat (`climat.json` du lieu, champ `ambience` de la saison), sinon
 * la fiche `defaut`; cinq heures repères (aube, midi clair, fin d'après-midi dense, crépuscule,
 * nuit) dehors et dedans, interpolées en continu selon l'heure du jeu (décision du client du
 * 2026-11-10: le jour clair est celui de midi, le jour dense celui de la fin de journée). Logique pure, sans Three.js.
 */
import * as v from 'valibot';
import ambiancesJson from './ambiances.json';
import { hex, type Rgb } from './couches';

export const AMBIANCE_KEYS = ['aube', 'midi', 'apres-midi', 'crepuscule', 'nuit'] as const;
export type AmbianceKey = (typeof AMBIANCE_KEYS)[number];
export type Particles = 'poussiere' | 'lucioles' | 'aucune';

export interface Ambiance {
  /** Soleil imposé (dedans): azimut depuis le nord et hauteur (degrés). Absent: celui de l'heure. */
  sun: readonly [number, number] | null;
  /** Part de l'ombre portée du soleil (0: aucune, dedans; 1: entière). */
  sunShadow: number;
  /** Les trois tons de la lumière, multipliés à la couleur de la pièce. */
  lit: Rgb;
  half: Rgb;
  shade: Rgb;
  ink: Rgb;
  /** Hachures: dans l'ombre propre et, plus lâches, dans l'ombre portée (0 à 1). */
  hatchOwn: number;
  hatchCast: number;
  /** Aplat d'encre pleine au coeur des ombres propres (0 à 1): les « noirs » de la planche. */
  blackFill: number;
  /** Force du relief des textures sur les tons, et de l'encre au pied des objets (0 à 1). */
  relief: number;
  grime: number;
  /** Personnages: part de l'ombre relevée vers la demi-teinte, et force du liseré clair. */
  characterLift: number;
  characterRim: number;
  /** Force des lampes (0: éteintes) et couleur ajoutée dans leur flaque. */
  lamps: number;
  lampColor: Rgb;
  /** Vitres: couleur et force de leur lueur. */
  windowGlow: Rgb;
  windowAmount: number;
  /** Rectangle de lumière que les fenêtres éclairées posent sur le sol dehors (0: aucun). */
  spill: number;
  /** Reflet du ciel dessiné sur les vitres (de jour): couleur et force. */
  glint: Rgb;
  glintAmount: number;
  /** Brume au sol: force (0: aucune), épaisseur en mètres, couleur. */
  mist: number;
  mistTop: number;
  mistColor: Rgb;
  /** Vent: force (1: brise) et direction vers laquelle il souffle, en degrés depuis le nord. */
  wind: number;
  windAzimuth: number;
  /** Particules de l'air: poussière dans le soleil, lucioles, ou rien. */
  particles: Particles;
  /** Vignette: couleur, force au bord, rayon où elle commence (0,5 = bord court de l'image). */
  vignetteColor: Rgb;
  vignette: number;
  vignetteStart: number;
  /** Teinte dominante, multipliée à toute l'image; puis saturation et contraste (1: inchangés). */
  tint: Rgb;
  saturation: number;
  contrast: number;
  /** Fond hors du monde. */
  background: Rgb;
}

const NUMBERS = [
  'sunShadow',
  'hatchOwn',
  'hatchCast',
  'blackFill',
  'relief',
  'grime',
  'characterLift',
  'characterRim',
  'lamps',
  'windowAmount',
  'spill',
  'glintAmount',
  'mist',
  'mistTop',
  'wind',
  'windAzimuth',
  'vignette',
  'vignetteStart',
  'saturation',
  'contrast',
] as const;
const COLORS = [
  'lit',
  'half',
  'shade',
  'ink',
  'lampColor',
  'windowGlow',
  'glint',
  'mistColor',
  'vignetteColor',
  'tint',
  'background',
] as const;
type NumberField = (typeof NUMBERS)[number];
type ColorField = (typeof COLORS)[number];

const Unit = v.pipe(v.number(), v.finite(), v.minValue(0), v.maxValue(4));
const ColorSchema = v.union([
  v.pipe(
    v.string(),
    v.regex(/^#[0-9a-fA-F]{6}$/),
    v.transform((text): Rgb => hex(text)),
  ),
  v.pipe(
    v.tuple([Unit, Unit, Unit]),
    v.transform((t): Rgb => t),
  ),
]);
const Degrees = v.pipe(v.number(), v.finite(), v.minValue(0), v.maxValue(360));

const numberEntries = Object.fromEntries(
  NUMBERS.map((name) => [name, name === 'windAzimuth' ? Degrees : Unit]),
) as Record<NumberField, typeof Unit>;
const colorEntries = Object.fromEntries(COLORS.map((name) => [name, ColorSchema])) as Record<
  ColorField,
  typeof ColorSchema
>;

/** Une heure repère: tous les champs sont facultatifs, ils héritent (voir `resolveAmbiances`). */
const KeySchema = v.partial(
  v.strictObject({
    ...numberEntries,
    ...colorEntries,
    /** `null`: le soleil suit l'heure (une heure du dedans peut ainsi défaire un soleil fixe). */
    sun: v.nullable(v.tuple([Degrees, v.pipe(v.number(), v.minValue(0), v.maxValue(90))])),
    particles: v.picklist(['poussiere', 'lucioles', 'aucune']),
  }),
);
const KeysSchema = v.partial(
  v.strictObject({
    aube: KeySchema,
    midi: KeySchema,
    'apres-midi': KeySchema,
    crepuscule: KeySchema,
    nuit: KeySchema,
  }),
);
const SheetSchema = v.strictObject({
  /** Fiche dont celle-ci hérite (`defaut` si absent). */
  extends: v.exactOptional(v.string()),
  /** Note d'intention, ignorée du moteur. */
  pourquoi: v.exactOptional(v.string()),
  dehors: v.exactOptional(KeysSchema),
  dedans: v.exactOptional(KeysSchema),
  /**
   * Pièce à fenêtres d'un bâtiment (elle a sa coque d'ombre: le soleil n'y entre que par les
   * fenêtres): chaque heure part de la même heure du dedans.
   */
  piece: v.exactOptional(KeysSchema),
});
const ScaleSchema = v.partial(v.strictObject(numberEntries));

export const AmbianceFileSchema = v.strictObject({
  format: v.literal('duo-ambiances/1'),
  /** Heures repères du jour, croissantes (minutes depuis minuit); on boucle par minuit. */
  stops: v.pipe(
    v.array(
      v.strictObject({
        minute: v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(1439)),
        key: v.picklist(AMBIANCE_KEYS),
      }),
    ),
    v.minLength(2),
    v.check(
      (stops) => stops.every((stop, i) => i === 0 || stop.minute > (stops[i - 1]?.minute ?? -1)),
      'heures repères croissantes',
    ),
  ),
  sheets: v.record(v.string(), SheetSchema),
  /** Météo: facteurs (`scale`) et planchers (`atLeast`) posés sur l'ambiance de l'heure. */
  weather: v.record(
    v.string(),
    v.strictObject({ scale: v.exactOptional(ScaleSchema), atLeast: v.exactOptional(ScaleSchema) }),
  ),
});
export type AmbianceFile = v.InferOutput<typeof AmbianceFileSchema>;
type KeyPatch = v.InferOutput<typeof KeySchema>;

export interface AmbianceSheet {
  readonly dehors: Readonly<Record<AmbianceKey, Readonly<Ambiance>>>;
  readonly dedans: Readonly<Record<AmbianceKey, Readonly<Ambiance>>>;
  readonly piece: Readonly<Record<AmbianceKey, Readonly<Ambiance>>>;
}

export interface AmbianceBook {
  readonly stops: AmbianceFile['stops'];
  readonly sheets: ReadonlyMap<string, AmbianceSheet>;
  readonly weather: AmbianceFile['weather'];
}

export const DEFAULT_SHEET = 'defaut';

function patched(base: Readonly<Ambiance>, patch: KeyPatch | undefined): Ambiance {
  const next: Ambiance = { ...base };
  if (patch === undefined) return next;
  for (const name of NUMBERS) {
    const value = patch[name];
    if (value !== undefined) next[name] = value;
  }
  for (const name of COLORS) {
    const value = patch[name];
    if (value !== undefined) next[name] = value;
  }
  if (patch.sun !== undefined) next.sun = patch.sun;
  if (patch.particles !== undefined) next.particles = patch.particles;
  return next;
}

/**
 * Résout l'héritage. Dehors: le midi de la fiche part du midi de sa fiche mère, et chaque autre
 * heure part de la même heure de la fiche mère (à défaut, du midi). Dedans: chaque heure part de
 * la même heure du dehors. Pièce: chaque heure part de la même heure du dedans. La fiche `defaut`
 * doit donner un midi complet.
 */
export function resolveAmbiances(raw: unknown): AmbianceBook {
  const file = v.parse(AmbianceFileSchema, raw);
  const root = file.sheets[DEFAULT_SHEET]?.dehors?.midi;
  if (root === undefined) throw new Error('ambiances: la fiche « defaut » doit décrire le midi');
  const missing = [...NUMBERS, ...COLORS].filter((name) => root[name] === undefined);
  if (missing.length > 0 || root.particles === undefined)
    throw new Error(`ambiances: midi de « defaut » incomplet (${missing.join(', ')})`);
  const sheets = new Map<string, AmbianceSheet>();
  const resolve = (id: string, seen: readonly string[]): AmbianceSheet => {
    const done = sheets.get(id);
    if (done !== undefined) return done;
    const sheet = file.sheets[id];
    if (sheet === undefined) throw new Error(`ambiances: fiche « ${id} » inconnue`);
    if (seen.includes(id)) throw new Error(`ambiances: héritage en boucle (${id})`);
    const parent =
      id === DEFAULT_SHEET ? null : resolve(sheet.extends ?? DEFAULT_SHEET, [...seen, id]);
    // Le midi de `defaut` est complet (contrôlé plus haut): il sert de socle à tout le reste.
    const day = patched(parent?.dehors.midi ?? ({ sun: null } as Ambiance), sheet.dehors?.midi);
    const dehors = {} as Record<AmbianceKey, Ambiance>;
    const dedans = {} as Record<AmbianceKey, Ambiance>;
    const piece = {} as Record<AmbianceKey, Ambiance>;
    for (const key of AMBIANCE_KEYS) {
      dehors[key] = key === 'midi' ? day : patched(parent?.dehors[key] ?? day, sheet.dehors?.[key]);
      const inside = patched(dehors[key], sheet.dedans?.[key]);
      // Une fiche fille garde les réglages du dedans de sa mère là où elle ne dit rien.
      dedans[key] =
        parent === null
          ? inside
          : patched(patched(parent.dedans[key], sheet.dehors?.[key]), sheet.dedans?.[key]);
      piece[key] =
        parent === null
          ? patched(inside, sheet.piece?.[key])
          : patched(
              patched(patched(parent.piece[key], sheet.dehors?.[key]), sheet.dedans?.[key]),
              sheet.piece?.[key],
            );
    }
    const resolved = { dehors, dedans, piece };
    sheets.set(id, resolved);
    return resolved;
  };
  for (const id of Object.keys(file.sheets)) resolve(id, []);
  return { stops: file.stops, sheets, weather: file.weather };
}

let shared: AmbianceBook | null = null;

/** Les ambiances livrées, contrôlées à la première lecture. */
export function gameAmbiances(): AmbianceBook {
  shared ??= resolveAmbiances(ambiancesJson);
  return shared;
}

const MINUTES_PER_DAY = 1440;

/** Les deux heures repères qui encadrent `minutes`, et la part du chemin de l'une à l'autre. */
export function ambianceSpan(
  minutes: number,
  stops: AmbianceBook['stops'],
): { from: AmbianceKey; to: AmbianceKey; t: number } {
  const first = stops[0];
  const last = stops[stops.length - 1];
  if (first === undefined || last === undefined) throw new Error('ambiances: aucune heure repère');
  const m = ((minutes % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  for (let i = 0; i < stops.length - 1; i += 1) {
    const a = stops[i];
    const b = stops[i + 1];
    if (a === undefined || b === undefined) break;
    if (m >= a.minute && m < b.minute)
      return { from: a.key, to: b.key, t: (m - a.minute) / (b.minute - a.minute) };
  }
  const span = first.minute + MINUTES_PER_DAY - last.minute;
  const since = m >= last.minute ? m - last.minute : m + MINUTES_PER_DAY - last.minute;
  return { from: last.key, to: first.key, t: span > 0 ? since / span : 0 };
}

function mix(a: Rgb, b: Rgb, t: number): Rgb {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

/** Mélange de deux ambiances (`t` de 0 à 1); les champs sans milieu prennent le plus proche. */
export function blendAmbiances(a: Readonly<Ambiance>, b: Readonly<Ambiance>, t: number): Ambiance {
  if (t <= 0) return { ...a };
  if (t >= 1) return { ...b };
  const out: Ambiance = { ...(t < 0.5 ? a : b) };
  for (const name of NUMBERS) out[name] = a[name] + (b[name] - a[name]) * t;
  for (const name of COLORS) out[name] = mix(a[name], b[name], t);
  // La direction du vent tourne par le plus court chemin.
  const turn = ((b.windAzimuth - a.windAzimuth + 540) % 360) - 180;
  out.windAzimuth = (a.windAzimuth + turn * t + 360) % 360;
  return out;
}

export interface AmbianceQuery {
  /** Identifiant d'ambiance du climat du lieu (fiche de ce nom, sinon `defaut`). */
  readonly sheet: string | null;
  /** Minutes depuis minuit. */
  readonly minutes: number;
  /** Part du dedans (0: dehors, 1: dans une pièce). */
  readonly indoor: number;
  /** Météo du moment (`clear` ou inconnue: rien de plus). */
  readonly weather: string | null;
  /** Le dedans est une pièce à fenêtres (ambiances `piece`), et non un lieu clos sans façade. */
  readonly room?: boolean;
}

/** L'ambiance d'un instant: fiche du lieu, heure, dedans ou dehors, météo. */
export function ambianceAt(book: AmbianceBook, query: AmbianceQuery): Ambiance {
  const sheet =
    (query.sheet === null ? undefined : book.sheets.get(query.sheet)) ??
    book.sheets.get(DEFAULT_SHEET);
  if (sheet === undefined) throw new Error('ambiances: fiche « defaut » absente');
  const span = ambianceSpan(query.minutes, book.stops);
  const outside = blendAmbiances(sheet.dehors[span.from], sheet.dehors[span.to], span.t);
  const weather = query.weather === null ? undefined : book.weather[query.weather];
  if (weather !== undefined) {
    for (const name of NUMBERS) {
      const scale = weather.scale?.[name];
      if (scale !== undefined) outside[name] *= scale;
      const floor = weather.atLeast?.[name];
      if (floor !== undefined) outside[name] = Math.max(outside[name], floor);
    }
  }
  if (query.indoor <= 0) return outside;
  const keys = query.room === true ? sheet.piece : sheet.dedans;
  const inside = blendAmbiances(keys[span.from], keys[span.to], span.t);
  const out = blendAmbiances(outside, inside, query.indoor);
  out.sun = query.indoor >= 0.5 ? inside.sun : null;
  return out;
}
