// Logique de l'essai: l'invité envoie un nombre sur le canal 0, l'hôte répond le suivant sur le canal 1.
import { v, type DuoContext } from '@duo/sdk';

export const Message = v.strictObject({
  n: v.pipe(v.number(), v.integer()),
  de: v.pipe(v.string(), v.maxLength(64)),
});
export type Message = v.InferOutput<typeof Message>;

export interface EchoView {
  received(message: Message): void;
  replied(message: Message): void;
}

export interface Echo {
  /** Invité: envoie le message suivant à l'hôte. */
  send(): void;
}

export function startEcho(duo: DuoContext, view: EchoView): Echo {
  const toHost = duo.net.channel(0, { mode: 'reliable', schema: Message });
  const toGuest = duo.net.channel(1, { mode: 'reliable', schema: Message });
  let counter = 0;
  if (duo.role === 'host') {
    toHost.onMessage((message) => {
      view.received(message);
      toGuest.send({ n: message.n + 1, de: duo.localPlayer.name });
    });
  } else {
    toGuest.onMessage((message) => {
      view.replied(message);
    });
  }
  return {
    send() {
      if (duo.role !== 'guest') return;
      counter++;
      toHost.send({ n: counter, de: duo.localPlayer.name });
    },
  };
}
