// Schémas d'entrée des canaux de la vue plateforme (ADR 0003, point 4).
import * as v from 'valibot';
import type { IntentArgs, IntentChannel } from '../shared/ipc';
import { ProfileSchema, SettingsSchema } from './data/store';

const NoArgument = v.null();

export const INTENT_SCHEMAS: {
  readonly [C in IntentChannel]: v.GenericSchema<unknown, IntentArgs[C]>;
} = {
  'profile:save': ProfileSchema,
  'setup:network-accept': NoArgument,
  'setup:complete': NoArgument,
  'settings:update': v.partial(SettingsSchema),
  'salon:open': v.object({ gameId: v.pipe(v.string(), v.regex(/^[a-z][a-z0-9-]{1,31}$/)) }),
  'salon:close': NoArgument,
  'salon:save-choice': v.object({ choice: v.picklist(['continue', 'new']) }),
  'salon:join': NoArgument,
  'salon:leave': NoArgument,
  'salon:ready': v.object({ ready: v.boolean() }),
  'match:pause': NoArgument,
  'match:resume': NoArgument,
  'match:stop': NoArgument,
  'end:dismiss': NoArgument,
  'notice:dismiss': NoArgument,
  'app:quit-confirm': NoArgument,
  'app:quit-cancel': NoArgument,
  'window:toggle-fullscreen': NoArgument,
  'library:install-file': NoArgument,
};

export type IntentCheck<C extends IntentChannel> =
  | { readonly ok: true; readonly value: IntentArgs[C] }
  | { readonly ok: false; readonly error: string };

export function checkIntent<C extends IntentChannel>(channel: C, raw: unknown): IntentCheck<C> {
  const schema = INTENT_SCHEMAS[channel] as v.GenericSchema<unknown, IntentArgs[C]>;
  const parsed = v.safeParse(schema, raw);
  if (parsed.success) return { ok: true, value: parsed.output };
  return { ok: false, error: parsed.issues.map((issue) => issue.message).join('; ') };
}
