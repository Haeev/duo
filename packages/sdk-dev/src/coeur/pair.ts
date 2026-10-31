// Messages échangés entre les deux fausses plateformes (hôte et invité) par le relais.
// Propres au faux hôte: la vraie liaison de Duo est celle de dev-reseau (ADR 0007).
import {
  NetChannelIdSchema,
  NetPayloadSchema,
  PlayerInfoSchema,
  PlayerColorIdSchema,
  StopReasonSchema,
} from '@duo/protocol';
import * as v from 'valibot';

const Finite = v.pipe(v.number(), v.finite());
const Id = v.pipe(v.string(), v.minLength(1), v.maxLength(64));

export const ProfileSchema = v.strictObject({
  id: Id,
  name: v.pipe(v.string(), v.minLength(1), v.maxLength(32)),
  color: PlayerColorIdSchema,
});
export type Profile = v.InferOutput<typeof ProfileSchema>;

export const PeerMessageSchema = v.variant('t', [
  v.strictObject({
    t: v.literal('hello'),
    profile: ProfileSchema,
    gameId: v.string(),
    gameVersion: v.string(),
  }),
  v.strictObject({
    t: v.literal('setup'),
    matchId: Id,
    seed: v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(0xffff_ffff)),
    players: v.tuple([PlayerInfoSchema, PlayerInfoSchema]),
  }),
  v.strictObject({ t: v.literal('refuse'), message: v.pipe(v.string(), v.maxLength(400)) }),
  v.strictObject({ t: v.literal('ready') }),
  v.strictObject({ t: v.literal('start'), atSessionMs: Finite }),
  v.strictObject({ t: v.literal('pause'), by: v.nullable(Id) }),
  v.strictObject({ t: v.literal('resume') }),
  v.strictObject({ t: v.literal('stopRequest') }),
  v.strictObject({ t: v.literal('stop'), reason: StopReasonSchema }),
  v.strictObject({ t: v.literal('ended') }),
  v.strictObject({ t: v.literal('crash'), message: v.pipe(v.string(), v.maxLength(2000)) }),
  v.strictObject({ t: v.literal('net'), channel: NetChannelIdSchema, data: NetPayloadSchema }),
  v.strictObject({ t: v.literal('ping'), id: v.pipe(v.number(), v.integer()), at: Finite }),
  v.strictObject({
    t: v.literal('pong'),
    id: v.pipe(v.number(), v.integer()),
    at: Finite,
    peerAt: Finite,
  }),
]);
export type PeerMessage = v.InferOutput<typeof PeerMessageSchema>;

/** Messages du serveur de relais à un client (mode réseau local). */
export const RelayControlSchema = v.variant('t', [
  v.strictObject({ t: v.literal('peer'), present: v.boolean() }),
  v.strictObject({ t: v.literal('refused'), message: v.pipe(v.string(), v.maxLength(400)) }),
]);
export type RelayControl = v.InferOutput<typeof RelayControlSchema>;

export function parsePeerMessage(input: unknown): PeerMessage | null {
  const result = v.safeParse(PeerMessageSchema, input);
  return result.success ? result.output : null;
}
