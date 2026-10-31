// Module `net`: canaux entre les deux instances du jeu (ADR 0007, reseau.md section 12.6).
import { MAX_NET_MESSAGE_BYTES, NET_CHANNEL_COUNT, type Role } from '@duo/protocol';
import * as v from 'valibot';
import type { ChannelMode, ChannelOptions, LinkQuality, Net, NetChannel, Unsubscribe } from './api';

/** Messages gardés pour un canal pas encore écouté (au-delà, les plus anciens sont jetés). */
const MAX_PENDING_PER_CHANNEL = 512;

/** Taille en octets d'un texte encodé en UTF-8, sans allouer de tampon. */
export function utf8Length(text: string): number {
  let bytes = 0;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code < 0x80) bytes += 1;
    else if (code < 0x800) bytes += 2;
    else if (code >= 0xd800 && code <= 0xdbff && i + 1 < text.length) {
      bytes += 4;
      i++;
    } else bytes += 3;
  }
  return bytes;
}

/** JSON.stringify renvoie undefined pour undefined, une fonction ou un symbole, malgré son type. */
function toJson(value: unknown): string | undefined {
  return JSON.stringify(value);
}

interface ChannelRecord {
  readonly mode: ChannelMode;
  readonly validate: (
    value: unknown,
  ) => { ok: true; value: unknown } | { ok: false; issue: string };
  readonly listeners: Set<(message: unknown) => void>;
}

export interface NetHooks {
  readonly role: Role;
  /** Envoi vers la plateforme: canal, mode et texte JSON. */
  send(channel: number, mode: ChannelMode, json: string): void;
  warn(message: string, data?: unknown): void;
  /** Écart entre l'horloge de la page et celle de session. */
  clockOffsetMs(): number;
}

export interface NetInternal extends Net {
  /** Message reçu de l'autre machine, par la plateforme. */
  receive(channel: number, json: string): void;
  setQuality(quality: LinkQuality): void;
  dispose(): void;
}

export function createNet(hooks: NetHooks): NetInternal {
  const channels = new Map<number, ChannelRecord>();
  const pending = new Map<number, string[]>();
  let link: LinkQuality = { rttMs: 0, jitterMs: 0, state: 'good' };
  let disposed = false;

  const deliver = (record: ChannelRecord, channel: number, json: string): void => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(json);
    } catch {
      hooks.warn(`net: message illisible sur le canal ${channel}`);
      return;
    }
    const result = record.validate(parsed);
    if (!result.ok) {
      hooks.warn(`net: message refusé par le schéma du canal ${channel}`, result.issue);
      return;
    }
    for (const listener of record.listeners) listener(result.value);
  };

  return {
    role: hooks.role,
    sessionTimeMs() {
      return performance.timeOrigin + performance.now() + hooks.clockOffsetMs();
    },
    quality() {
      return link;
    },
    channel<TSchema extends v.GenericSchema>(
      id: number,
      options: ChannelOptions<TSchema>,
    ): NetChannel<v.InferOutput<TSchema>> {
      if (!Number.isInteger(id) || id < 0 || id >= NET_CHANNEL_COUNT) {
        throw new RangeError(`net: canal ${id} hors limites (0 à ${NET_CHANNEL_COUNT - 1})`);
      }
      if (channels.has(id)) {
        throw new Error(`net: canal ${id} déjà ouvert`);
      }
      const record: ChannelRecord = {
        mode: options.mode,
        validate: (value) => {
          const result = v.safeParse(options.schema, value);
          if (result.success) return { ok: true, value: result.output };
          return { ok: false, issue: v.summarize(result.issues) };
        },
        listeners: new Set(),
      };
      channels.set(id, record);

      return {
        id,
        send(message) {
          if (disposed) return;
          let json: string | undefined;
          try {
            json = toJson(message);
          } catch (error) {
            throw new TypeError(`net: message du canal ${id} non sérialisable en JSON`, {
              cause: error,
            });
          }
          if (json === undefined) {
            throw new TypeError(`net: message du canal ${id} vide`);
          }
          const bytes = utf8Length(json);
          if (bytes > MAX_NET_MESSAGE_BYTES) {
            throw new RangeError(
              `net: message de ${bytes} octets sur le canal ${id} (64 Kio au plus)`,
            );
          }
          hooks.send(id, options.mode, json);
        },
        onMessage(listener): Unsubscribe {
          const wrapped = listener;
          record.listeners.add(wrapped);
          const queued = pending.get(id);
          if (queued !== undefined) {
            pending.delete(id);
            const toDeliver = record.mode === 'latest' ? queued.slice(-1) : queued;
            queueMicrotask(() => {
              for (const json of toDeliver) deliver(record, id, json);
            });
          }
          return () => record.listeners.delete(wrapped);
        },
      };
    },
    receive(channel, json) {
      if (disposed) return;
      const record = channels.get(channel);
      if (record === undefined || record.listeners.size === 0) {
        let queue = pending.get(channel);
        if (queue === undefined) {
          queue = [];
          pending.set(channel, queue);
        }
        if (record?.mode === 'latest') queue.length = 0;
        queue.push(json);
        if (queue.length > MAX_PENDING_PER_CHANNEL) queue.shift();
        return;
      }
      deliver(record, channel, json);
    },
    setQuality(quality) {
      link = quality;
    },
    dispose() {
      disposed = true;
      channels.clear();
      pending.clear();
    },
  };
}
