// Manifeste `duo-game.json`, version 1 (ADR 0005, point 2).
import * as v from 'valibot';

/** Plafond d'une sauvegarde, fixé par la plateforme (ADR 0009): 32 Mio. */
export const MAX_SAVE_BYTES = 33_554_432;

/** Moments où un jeu peut écrire une sauvegarde. */
export const SAVE_MOMENTS = ['level-end', 'exit', 'auto', 'manual'] as const;
export type SaveMoment = (typeof SAVE_MOMENTS)[number];

/** Boutons et molette de la souris qu'une action peut employer. */
export const MOUSE_INPUTS = ['left', 'middle', 'right', 'wheel-up', 'wheel-down'] as const;
export type MouseInput = (typeof MOUSE_INPUTS)[number];

const GAME_ID_PATTERN = /^[a-z][a-z0-9-]{1,31}$/;
const ACTION_ID_PATTERN = /^[a-z][a-z0-9-]{0,31}$/;
const SEMVER_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const BRIDGE_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
/** Valeur de `KeyboardEvent.code`: lettres et chiffres ASCII (`KeyW`, `Space`, `Digit1`, `ArrowUp`). */
const KEY_CODE_PATTERN = /^[A-Z][A-Za-z0-9]{1,31}$/;

export const KeyCodeSchema = v.pipe(
  v.string(),
  v.regex(KEY_CODE_PATTERN, 'touche: une valeur de KeyboardEvent.code'),
  v.check((code) => code !== 'Escape', 'Échap est réservée à la pause de la plateforme'),
);

export const GameIdSchema = v.pipe(v.string(), v.regex(GAME_ID_PATTERN));
export const ActionIdSchema = v.pipe(v.string(), v.regex(ACTION_ID_PATTERN));

export const ManifestActionSchema = v.strictObject({
  id: ActionIdSchema,
  label: v.pipe(v.string(), v.minLength(1), v.maxLength(40)),
  keys: v.pipe(v.array(KeyCodeSchema), v.maxLength(4)),
  mouse: v.exactOptional(v.pipe(v.array(v.picklist(MOUSE_INPUTS)), v.maxLength(2))),
  rebindable: v.exactOptional(v.boolean()),
});
export type ManifestAction = v.InferOutput<typeof ManifestActionSchema>;

export const ManifestSavesSchema = v.pipe(
  v.strictObject({
    slots: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(10)),
    maxBytes: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(MAX_SAVE_BYTES)),
    moments: v.pipe(v.array(v.picklist(SAVE_MOMENTS)), v.minLength(1)),
    autosaveSeconds: v.exactOptional(v.pipe(v.number(), v.integer(), v.minValue(60), v.maxValue(1800))),
    help: v.exactOptional(v.pipe(v.string(), v.maxLength(120))),
  }),
  v.check(
    (saves) => !saves.moments.includes('auto') || saves.autosaveSeconds !== undefined,
    'autosaveSeconds est exigé quand le moment auto est déclaré',
  ),
);
export type ManifestSaves = v.InferOutput<typeof ManifestSavesSchema>;

const MinutesSchema = v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(600));

export const ManifestSchema = v.pipe(
  v.strictObject({
    $schema: v.exactOptional(v.string()),
    schema: v.literal(1),
    id: GameIdSchema,
    name: v.pipe(v.string(), v.minLength(1), v.maxLength(40)),
    version: v.pipe(v.string(), v.regex(SEMVER_PATTERN, 'version: MAJEUR.MINEUR.CORRECTIF')),
    sdk: v.pipe(v.string(), v.regex(BRIDGE_PATTERN, 'sdk: version du pont, majeure.mineure')),
    view: v.picklist(['2d', '3d', 'iso']),
    engine: v.picklist(['three', 'pixi', 'phaser', 'none']),
    mode: v.picklist(['coop', 'versus']),
    play: v.picklist(['match', 'session']),
    durationMinutes: v.pipe(
      v.tuple([MinutesSchema, MinutesSchema]),
      v.check(([min, max]) => min <= max, 'durationMinutes: [min, max] avec min <= max'),
    ),
    network: v.picklist(['host-authority', 'lockstep', 'turns']),
    entry: v.pipe(v.string(), v.minLength(1)),
    thumbnail: v.pipe(v.string(), v.minLength(1)),
    description: v.pipe(v.string(), v.minLength(1), v.maxLength(200)),
    whatsNew: v.pipe(v.string(), v.maxLength(400)),
    actions: v.pipe(
      v.array(ManifestActionSchema),
      v.minLength(1),
      v.maxLength(32),
      v.check((actions) => new Set(actions.map((a) => a.id)).size === actions.length, 'actions: identifiants en double'),
    ),
    saves: v.nullable(ManifestSavesSchema),
    credits: v.nullable(v.string()),
  }),
);
export type GameManifest = v.InferOutput<typeof ManifestSchema>;

/** Résultat de la lecture d'un manifeste: le manifeste, ou la liste des problèmes en français. */
export type ManifestParseResult =
  | { readonly ok: true; readonly manifest: GameManifest }
  | { readonly ok: false; readonly issues: readonly string[] };

/** Valide un manifeste lu sur disque ou importé (`duo-game.json`). */
export function parseManifest(input: unknown): ManifestParseResult {
  const result = v.safeParse(ManifestSchema, input);
  if (result.success) {
    return { ok: true, manifest: result.output };
  }
  return {
    ok: false,
    issues: result.issues.map((issue) => {
      const path = v.getDotPath(issue);
      return path === null ? issue.message : `${path}: ${issue.message}`;
    }),
  };
}
