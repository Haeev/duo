// Canaux et messages (technique 5.3). Tout message reçu passe son schéma (le SDK jette les autres).
import { v } from '@duo/sdk';
import { ArrangementStateSchema } from '../amenagement/etat';
import { ClienteleStateSchema } from '../clientele/etat';
import { InstallationStateSchema } from '../installation/etat';
import { ServiceStateSchema } from '../service/etat';
import { ObjectStateSchema, PlacedFurnitureSchema, StationUseSchema } from '../etat/monde';
import { IntentSchema, StepInputSchema } from '../simulation/entrees';
import { GameEventSchema } from '../simulation/evenements';

export const CHANNEL = {
  guestInput: 0,
  moves: 1,
  core: 2,
  service: 3,
  clientele: 4,
  arrangement: 5,
  events: 6,
  /** 7: positions des clients debout (chantier clientèle). */
  installation: 8,
} as const;

const Tick = v.pipe(v.number(), v.integer(), v.minValue(0));

/** Invité vers hôte, deux pas par message: entrées et intentions nées pendant ces pas. */
export const GuestInputSchema = v.strictObject({
  inputs: v.pipe(v.array(StepInputSchema), v.maxLength(8)),
  intents: v.pipe(v.array(IntentSchema), v.maxLength(8)),
});
export type GuestInput = v.InferOutput<typeof GuestInputSchema>;

/** Position compacte: x et z en centimètres, cap et inclinaison en demi-degrés. */
const CompactPlayer = v.tuple([v.number(), v.number(), v.number(), v.number()]);
export const MovesSchema = v.strictObject({
  tick: Tick,
  /** Dernière entrée de l'invité jouée par l'hôte. */
  ack: Tick,
  players: v.tuple([CompactPlayer, CompactPlayer]),
});
export type Moves = v.InferOutput<typeof MovesSchema>;

/** Objets, meubles et usages des postes: envoyés quand ils changent. */
export const CoreSchema = v.strictObject({
  tick: Tick,
  objects: v.array(ObjectStateSchema),
  nextObjectId: Tick,
  furniture: v.array(PlacedFurnitureSchema),
  uses: v.tuple([v.nullable(StationUseSchema), v.nullable(StationUseSchema)]),
  /** Assises des deux avatars (meuble posé, ou `null` debout). */
  seats: v.optional(v.tuple([v.nullable(v.string()), v.nullable(v.string())]), [null, null]),
});
export type Core = v.InferOutput<typeof CoreSchema>;

export const DOMAINS = [
  {
    key: 'service',
    channel: CHANNEL.service,
    schema: v.strictObject({ tick: Tick, state: ServiceStateSchema }),
  },
  {
    key: 'clientele',
    channel: CHANNEL.clientele,
    schema: v.strictObject({ tick: Tick, state: ClienteleStateSchema }),
  },
  {
    key: 'arrangement',
    channel: CHANNEL.arrangement,
    schema: v.strictObject({ tick: Tick, state: ArrangementStateSchema }),
  },
  {
    key: 'installation',
    channel: CHANNEL.installation,
    schema: v.strictObject({ tick: Tick, state: v.nullable(InstallationStateSchema) }),
  },
] as const;

export const EventsSchema = v.strictObject({
  events: v.pipe(v.array(GameEventSchema), v.maxLength(64)),
});
export type Events = v.InferOutput<typeof EventsSchema>;

export function packPlayer(p: {
  x: number;
  z: number;
  yawDeg: number;
  pitchDeg: number;
}): [number, number, number, number] {
  return [
    Math.round(p.x * 100),
    Math.round(p.z * 100),
    Math.round(p.yawDeg * 2),
    Math.round(p.pitchDeg * 2),
  ];
}

export function unpackPlayer(c: readonly [number, number, number, number]): {
  x: number;
  z: number;
  yawDeg: number;
  pitchDeg: number;
} {
  return { x: c[0] / 100, z: c[1] / 100, yawDeg: c[2] / 2, pitchDeg: c[3] / 2 };
}
