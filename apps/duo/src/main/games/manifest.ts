// Manifeste `duo-game.json`, version 1 (ADR 0005, point 2). Schéma provisoire:
// à la fusion, il est remplacé par celui de @duo/protocol, qui fait foi.
import * as v from 'valibot';

const MAX_SAVE_BYTES = 33_554_432;

const RelativePathSchema = v.pipe(
  v.string(),
  v.minLength(1),
  v.maxLength(200),
  v.check(
    (value) => !value.startsWith('/') && !value.includes('\\') && !value.split('/').includes('..'),
    'chemin relatif au paquet attendu',
  ),
);

const KeyCodeSchema = v.pipe(
  v.string(),
  v.regex(/^[A-Za-z][A-Za-z0-9]{0,31}$/),
  v.check((code) => code !== 'Escape', 'Échap est réservée à la plateforme'),
);

const ActionSchema = v.object({
  id: v.pipe(v.string(), v.regex(/^[a-z][a-z0-9-]{0,31}$/)),
  label: v.pipe(v.string(), v.minLength(1), v.maxLength(40)),
  keys: v.pipe(v.array(KeyCodeSchema), v.maxLength(4)),
  mouse: v.optional(v.picklist(['left', 'right', 'middle'])),
  rebindable: v.optional(v.boolean(), true),
});

const SavesSchema = v.pipe(
  v.object({
    slots: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(10)),
    maxBytes: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(MAX_SAVE_BYTES)),
    moments: v.pipe(
      v.array(v.picklist(['level-end', 'exit', 'auto', 'manual'])),
      v.minLength(1),
    ),
    autosaveSeconds: v.optional(
      v.pipe(v.number(), v.integer(), v.minValue(60), v.maxValue(1800)),
    ),
    help: v.optional(v.pipe(v.string(), v.maxLength(120))),
  }),
  v.check(
    (saves) => !saves.moments.includes('auto') || saves.autosaveSeconds !== undefined,
    'autosaveSeconds est exigé avec le moment auto',
  ),
);

const MinutesSchema = v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(600));

export const ManifestSchema = v.object({
  schema: v.literal(1),
  id: v.pipe(v.string(), v.regex(/^[a-z][a-z0-9-]{1,31}$/)),
  name: v.pipe(v.string(), v.minLength(1), v.maxLength(40)),
  version: v.pipe(v.string(), v.regex(/^\d+\.\d+\.\d+$/)),
  sdk: v.pipe(v.string(), v.regex(/^\d+\.\d+$/)),
  view: v.picklist(['2d', '3d', 'iso']),
  engine: v.picklist(['three', 'pixi', 'phaser', 'none']),
  mode: v.picklist(['coop', 'versus']),
  play: v.picklist(['match', 'session']),
  durationMinutes: v.pipe(
    v.tuple([MinutesSchema, MinutesSchema]),
    v.check(([min, max]) => min <= max, 'durée minimale plus grande que la maximale'),
  ),
  network: v.picklist(['host-authority', 'lockstep', 'turns']),
  entry: RelativePathSchema,
  thumbnail: RelativePathSchema,
  description: v.pipe(v.string(), v.minLength(1), v.maxLength(200)),
  whatsNew: v.pipe(v.string(), v.maxLength(400)),
  actions: v.pipe(v.array(ActionSchema), v.minLength(1), v.maxLength(32)),
  saves: v.nullable(SavesSchema),
  credits: v.nullable(RelativePathSchema),
});

export type GameManifest = v.InferOutput<typeof ManifestSchema>;

export type ManifestCheck =
  | { readonly ok: true; readonly manifest: GameManifest }
  | { readonly ok: false; readonly problems: readonly string[] };

export function checkManifest(raw: unknown): ManifestCheck {
  const result = v.safeParse(ManifestSchema, raw);
  if (result.success) return { ok: true, manifest: result.output };
  return {
    ok: false,
    problems: result.issues.map((issue) => {
      const where = v.getDotPath(issue);
      return where === null ? issue.message : `${where}: ${issue.message}`;
    }),
  };
}

/** Version du pont annoncée par cette application (ADR 0005, point 6). */
export const BRIDGE_VERSION = { major: 1, minor: 0 } as const;

/** Vrai si l'application couvre la version du pont exigée par le jeu. */
export function bridgeCovers(required: string): boolean {
  const match = /^(\d+)\.(\d+)$/.exec(required);
  if (match === null) return false;
  const major = Number(match[1]);
  const minor = Number(match[2]);
  return major === BRIDGE_VERSION.major && minor <= BRIDGE_VERSION.minor;
}
