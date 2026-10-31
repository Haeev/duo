import * as v from 'valibot';

/**
 * Schémas des messages du réseau (reseau.md, sections 5.2, 6.2 et 7). Tout ce qui
 * arrive du réseau passe par l'un d'eux avant usage. `v.object` retire les champs
 * inconnus: une version mineure peut en ajouter sans casser l'autre (ADR 0006).
 *
 * Ces schémas iront dans `@duo/protocol` quand ce paquet existera (lot L3).
 */

const machineId = v.pipe(v.string(), v.regex(/^[A-Za-z0-9-]{8,64}$/));
const semver = v.pipe(
  v.string(),
  v.maxLength(32),
  v.regex(/^\d{1,5}\.\d{1,5}\.\d{1,5}[0-9A-Za-z.+-]*$/),
);
const protocolNumber = v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(1_000_000));
const port = v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(65_535));
const seq = v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(0xffff_ffff));
const time = v.pipe(v.number(), v.finite());
const fingerprint = v.pipe(v.string(), v.regex(/^[0-9a-f]{8}$/));
const linkId = v.pipe(v.string(), v.regex(/^[0-9a-f]{32}$/));
const ipv4 = v.pipe(v.string(), v.maxLength(15), v.regex(/^\d{1,3}(?:\.\d{1,3}){3}$/));
/** 16 octets en base64url sans remplissage. */
const bytes16 = v.pipe(v.string(), v.regex(/^[A-Za-z0-9_-]{22}$/));
/** 32 octets en base64url sans remplissage. */
const bytes32 = v.pipe(v.string(), v.regex(/^[A-Za-z0-9_-]{43}$/));
const duoId = v.pipe(v.string(), v.regex(/^[0-9a-f]{32}$/));

function text(max: number) {
  return v.pipe(v.string(), v.maxLength(max));
}

/** Enveloppe figée pour toujours (ADR 0006): lue avant tout le reste. */
export const FrozenEnvelopeSchema = v.looseObject({
  app: v.literal('duo'),
  envelope: v.literal(1),
  type: text(32),
  machine: machineId,
  appVersion: semver,
  protocol: protocolNumber,
});
export type FrozenEnvelope = v.InferOutput<typeof FrozenEnvelopeSchema>;

const profile = v.object({ pseudo: text(32), color: text(16) });

const datagramType = v.picklist(['announce', 'query', 'bye']);

/** Balise, requête ou adieu en UDP (reseau.md, section 5.2). */
export const DatagramSchema = v.object({
  app: v.literal('duo'),
  envelope: v.literal(1),
  type: datagramType,
  machine: machineId,
  appVersion: semver,
  protocol: protocolNumber,
  instance: machineId,
  seq,
  port,
  pseudo: text(32),
  color: text(16),
  computer: text(32),
  setup: v.picklist(['done', 'in-progress']),
  duos: v.pipe(v.array(fingerprint), v.maxLength(8)),
  addresses: v.pipe(
    v.array(
      v.object({
        ip: ipv4,
        prefix: v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(32)),
      }),
    ),
    v.maxLength(8),
  ),
});
export type Datagram = v.InferOutput<typeof DatagramSchema>;
export type DatagramType = Datagram['type'];

const gameEntry = v.object({
  id: v.pipe(v.string(), v.regex(/^[a-z0-9][a-z0-9-]{0,63}$/)),
  version: semver,
  hash: v.optional(text(128)),
});
export type InstalledGame = v.InferOutput<typeof gameEntry>;

/** Changements portés par la liaison établie (messages fiables). */
export const ProfileUpdateSchema = profile;
export const GamesUpdateSchema = v.object({
  games: v.pipe(v.array(gameEntry), v.maxLength(256)),
});

const identityFields = {
  app: v.literal('duo'),
  envelope: v.literal(1),
  machine: machineId,
  appVersion: semver,
  protocol: protocolNumber,
  instance: machineId,
  profile,
  computer: text(32),
  games: v.pipe(v.array(gameEntry), v.maxLength(256)),
  duos: v.pipe(v.array(fingerprint), v.maxLength(8)),
  // Champs de l'ADR 0006 que la liaison transporte sans les interpréter.
  bridge: v.optional(v.pipe(v.array(text(16)), v.maxLength(8))),
  electron: v.optional(text(32)),
  dataFormat: v.optional(v.pipe(v.number(), v.integer(), v.minValue(0))),
  os: v.optional(text(16)),
  arch: v.optional(text(16)),
};

export const HelloSchema = v.object({
  ...identityFields,
  type: v.literal('hello'),
  nonce: bytes16,
  pairKey: bytes32,
  resume: v.optional(v.object({ link: linkId, received: seq })),
});
export type Hello = v.InferOutput<typeof HelloSchema>;

export const WelcomeSchema = v.object({
  ...identityFields,
  type: v.literal('welcome'),
  nonce: bytes16,
  link: linkId,
  resumed: v.boolean(),
  received: seq,
  proof: bytes32,
  pairing: v.optional(v.object({ duo: duoId, pairKey: bytes32 })),
});
export type Welcome = v.InferOutput<typeof WelcomeSchema>;

export const REJECT_REASONS = [
  'protocol',
  'busy',
  'bad-proof',
  'duplicate',
  'malformed',
  'not-paired',
  'self',
] as const;
export type RejectReason = (typeof REJECT_REASONS)[number];

export const RejectSchema = v.object({
  app: v.literal('duo'),
  envelope: v.literal(1),
  type: v.literal('reject'),
  machine: machineId,
  appVersion: semver,
  protocol: protocolNumber,
  reason: v.picklist(REJECT_REASONS),
});
export type Reject = v.InferOutput<typeof RejectSchema>;

export const AuthSchema = v.object({ type: v.literal('auth'), proof: bytes32 });
export const ReadySchema = v.object({ type: v.literal('ready'), link: linkId });

export const PingSchema = v.object({
  type: v.literal('ping'),
  id: seq,
  t0: time,
  ack: seq,
  active: v.boolean(),
});
export const PongSchema = v.object({
  type: v.literal('pong'),
  id: seq,
  t0: time,
  t1: time,
  t2: time,
  ack: seq,
  active: v.boolean(),
});
export const BYE_REASONS = ['quit', 'replaced', 'duplicate', 'reset'] as const;
export type ByeReason = (typeof BYE_REASONS)[number];
export const ByeSchema = v.object({ type: v.literal('bye'), reason: v.picklist(BYE_REASONS) });

/** En-tête commun des messages fiables: le reste est validé par la couche qui les reçoit. */
export const ReliableHeaderSchema = v.looseObject({
  type: text(64),
  seq: v.pipe(seq, v.minValue(1)),
});

export const GameFrameSchema = v.object({
  type: v.literal('g'),
  seq: v.pipe(seq, v.minValue(1)),
  ch: v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(255)),
  d: v.unknown(),
});

/** Types de la liaison elle-même; tout autre type porte un `seq` et va aux couches du dessus. */
export const LINK_LEVEL_TYPES = new Set([
  'hello',
  'welcome',
  'reject',
  'auth',
  'ready',
  'ping',
  'pong',
  'bye',
]);

/** JSON d'une trame texte, ou `undefined` s'il est illisible. */
export function parseJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

/** Trame binaire d'un message de jeu: type 0x01, canal, drapeaux, réservé, `seq` sur 32 bits. */
export const BINARY_GAME_TYPE = 0x01;
export const BINARY_HEADER_BYTES = 8;

export function encodeBinaryGameFrame(
  channel: number,
  sequence: number,
  payload: Uint8Array,
): Uint8Array {
  const frame = new Uint8Array(BINARY_HEADER_BYTES + payload.byteLength);
  const view = new DataView(frame.buffer);
  view.setUint8(0, BINARY_GAME_TYPE);
  view.setUint8(1, channel);
  view.setUint8(2, 0);
  view.setUint8(3, 0);
  view.setUint32(4, sequence);
  frame.set(payload, BINARY_HEADER_BYTES);
  return frame;
}

export interface BinaryGameFrame {
  readonly channel: number;
  readonly seq: number;
  readonly payload: Uint8Array;
}

export function decodeBinaryGameFrame(frame: Uint8Array): BinaryGameFrame | null {
  if (frame.byteLength < BINARY_HEADER_BYTES) return null;
  const view = new DataView(frame.buffer, frame.byteOffset, frame.byteLength);
  if (view.getUint8(0) !== BINARY_GAME_TYPE) return null;
  const sequence = view.getUint32(4);
  if (sequence === 0) return null;
  return {
    channel: view.getUint8(1),
    seq: sequence,
    payload: frame.slice(BINARY_HEADER_BYTES),
  };
}
