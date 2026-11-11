/**
 * Garde des messages reçus (revue du 2026-11-11, MA2). Le SDK jette en silence un message refusé
 * par le schéma de son canal: avec des schémas stricts, un jeu d'une autre fabrication laisse
 * alors l'invité figé sans rien dire. Ici, le jeu ouvre ses canaux par cette garde: le SDK ne
 * vérifie plus que le JSON, la garde valide avec le vrai schéma, compte chaque refus et le
 * signale (le premier de chaque canal au journal, le tout premier au joueur).
 */
import type { ChannelOptions, Net, NetChannel } from '@duo/sdk';
import * as v from 'valibot';

export interface Rejection {
  readonly channel: number;
  /** Refus de ce canal depuis le début de la séance, celui-ci compris. */
  readonly count: number;
  /** Résumé des écarts (journal seulement, jamais montré au joueur). */
  readonly issue: string;
}

export interface GuardedNet extends Net {
  /** Refus comptés depuis le début, tous canaux. */
  rejected(): number;
}

const PASS = v.unknown();

export function guardNet(net: Net, onReject: (rejection: Rejection) => void): GuardedNet {
  const counts = new Map<number, number>();
  let total = 0;
  return {
    role: net.role,
    sessionTimeMs: () => net.sessionTimeMs(),
    quality: () => net.quality(),
    rejected: () => total,
    channel<TSchema extends v.GenericSchema>(
      id: number,
      options: ChannelOptions<TSchema>,
    ): NetChannel<v.InferOutput<TSchema>> {
      const raw = net.channel(id, { mode: options.mode, schema: PASS });
      return {
        id,
        send(message) {
          raw.send(message);
        },
        onMessage(listener) {
          return raw.onMessage((message) => {
            const result = v.safeParse(options.schema, message);
            if (result.success) {
              listener(result.output);
              return;
            }
            const count = (counts.get(id) ?? 0) + 1;
            counts.set(id, count);
            total += 1;
            onReject({ channel: id, count, issue: v.summarize(result.issues) });
          });
        },
      };
    },
  };
}
