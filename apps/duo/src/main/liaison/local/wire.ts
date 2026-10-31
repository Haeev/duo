// Messages de la liaison provisoire, validés à l'arrivée (ADR 0003, point 10).
// Ce format n'est pas celui de dev-reseau (ADR 0007): il disparaît à la fusion.
import * as v from 'valibot';
import { ProfileSchema } from '../../data/store';

const SeatsSchema = v.object({ host: v.boolean(), guest: v.boolean() });
const TimeSchema = v.nullable(v.number());

const SalonGameSchema = v.object({
  id: v.pipe(v.string(), v.regex(/^[a-z][a-z0-9-]{1,31}$/)),
  version: v.pipe(v.string(), v.maxLength(32)),
  saveChoice: v.picklist(['continue', 'new']),
  save: v.nullable(
    v.object({ label: v.pipe(v.string(), v.maxLength(80)), writtenAt: v.number() }),
  ),
});

export const HostSessionSchema = v.object({
  rev: v.pipe(v.number(), v.integer(), v.minValue(0)),
  salon: v.nullable(
    v.object({
      game: SalonGameSchema,
      guestJoined: v.boolean(),
      ready: SeatsSchema,
      countdownEndsAt: TimeSchema,
    }),
  ),
  match: v.nullable(
    v.object({
      matchId: v.pipe(v.string(), v.maxLength(64)),
      seed: v.pipe(v.number(), v.integer()),
      game: SalonGameSchema,
      phase: v.picklist(['loading', 'playing', 'paused', 'resuming']),
      loaded: SeatsSchema,
      pausedBy: SeatsSchema,
      resumeReady: SeatsSchema,
      resumeEndsAt: TimeSchema,
      linkLost: v.boolean(),
      playedMs: v.pipe(v.number(), v.minValue(0)),
      playingSince: TimeSchema,
    }),
  ),
  lastEnd: v.nullable(
    v.object({
      matchId: v.pipe(v.string(), v.maxLength(64)),
      game: SalonGameSchema,
      reason: v.picklist(['stopped', 'crash', 'load-failed', 'end', 'guest-gone']),
      by: v.nullable(v.picklist(['host', 'guest'])),
      durationMs: v.pipe(v.number(), v.minValue(0)),
    }),
  ),
});

export const GuestIntentSchema = v.variant('type', [
  v.object({ type: v.literal('join') }),
  v.object({ type: v.literal('leave') }),
  v.object({ type: v.literal('ready'), ready: v.boolean() }),
  v.object({ type: v.literal('loaded') }),
  v.object({ type: v.literal('pause') }),
  v.object({ type: v.literal('resume') }),
  v.object({ type: v.literal('stop'), reason: v.picklist(['stopped', 'crash', 'load-failed', 'end']) }),
]);

export type GuestIntent = v.InferOutput<typeof GuestIntentSchema>;

export const WireSchema = v.variant('t', [
  v.object({
    t: v.literal('hello'),
    app: v.literal('duo'),
    protocol: v.literal(1),
    machineId: v.pipe(v.string(), v.uuid()),
    instanceId: v.pipe(v.string(), v.uuid()),
    appVersion: v.pipe(v.string(), v.maxLength(32)),
    profile: ProfileSchema,
  }),
  v.object({ t: v.literal('hb') }),
  v.object({ t: v.literal('profile'), profile: ProfileSchema }),
  v.object({ t: v.literal('session'), session: HostSessionSchema }),
  v.object({ t: v.literal('intent'), intent: GuestIntentSchema }),
  v.object({
    t: v.literal('game'),
    channel: v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(15)),
    mode: v.picklist(['reliable', 'latest']),
    data: v.unknown(),
  }),
  v.object({ t: v.literal('bye') }),
]);

export type WireMessage = v.InferOutput<typeof WireSchema>;

/** Une ligne JSON par message; au-delà, la connexion est fermée. */
export const MAX_LINE_BYTES = 1024 * 1024;

export function decodeWire(line: string): WireMessage | null {
  let raw: unknown;
  try {
    raw = JSON.parse(line);
  } catch {
    return null;
  }
  const parsed = v.safeParse(WireSchema, raw);
  return parsed.success ? parsed.output : null;
}
