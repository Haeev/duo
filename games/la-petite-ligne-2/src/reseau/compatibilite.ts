/**
 * Compatibilité des deux jeux (ADR 0006, revue du 2026-11-11, MA2). La plateforme ne compare que
 * le numéro de version: deux fabrications sous le même numéro, ou un jeu mis à jour d'un seul
 * côté, laissaient l'invité figé, ses messages refusés en silence par les schémas stricts.
 *
 * Chaque machine envoie sa « carte d'identité » sur un canal à part, au schéma volontairement
 * souple et figé pour toujours: version du jeu, protocole, empreinte des schémas des messages et
 * empreinte de la fabrication (sources et données, calculée par `vite.config.ts`). Chacune compare
 * de son côté; un écart arrête la partie avant qu'elle ne démarre à moitié.
 */
import { fnv1a32, type Net } from '@duo/sdk';
import * as v from 'valibot';
import {
  EventsSchema,
  FastSchema,
  GuestInputSchema,
  PlacePartSchema,
  ProgressPartSchema,
  SLICE_SCHEMAS,
} from './canaux';

/** Canal de la carte d'identité. Ne jamais le changer: un ancien jeu doit toujours la lire. */
export const COMPAT_CHANNEL = 9;

/**
 * Protocole du jeu: à incrémenter pour un changement incompatible que les schémas ne voient pas
 * (sens d'un champ, ordre des habitants du canal rapide).
 */
export const NET_PROTOCOL = 1;

/** Sans carte de l'autre au bout de ce nombre de pas, il a un jeu d'avant cette vérification. */
export const COMPAT_WAIT_STEPS = 90;

// Remplacée par Vite à la fabrication (`define`); absente dans les tests et les outils Node.
declare const __LPL_BUILD_FINGERPRINT__: string | undefined;

export interface CompatHello {
  readonly game: string;
  readonly version: string;
  readonly protocol: number;
  /** Empreinte des schémas des messages. */
  readonly schemas: string;
  /** Empreinte de la fabrication (sources et données), `dev` hors fabrication. */
  readonly build: string;
}

/** Schéma souple (`object`: champs en trop retirés), à ne jamais durcir. */
export const CompatHelloSchema = v.object({
  game: v.pipe(v.string(), v.maxLength(64)),
  version: v.pipe(v.string(), v.maxLength(32)),
  protocol: v.pipe(v.number(), v.integer()),
  schemas: v.pipe(v.string(), v.maxLength(64)),
  build: v.pipe(v.string(), v.maxLength(64)),
  /** Réponse à une carte reçue: on n'y répond pas (pas de ping-pong). */
  reply: v.optional(v.boolean()),
});

export type CompatVerdict =
  | { readonly kind: 'waiting' }
  | { readonly kind: 'ok' }
  /** Ce jeu est plus ancien que celui de l'autre machine. */
  | { readonly kind: 'self-older'; readonly self: string; readonly peer: string }
  /** Le jeu de l'autre machine est plus ancien (ou d'avant cette vérification: `peer` vide). */
  | { readonly kind: 'peer-older'; readonly self: string; readonly peer: string }
  /** Même numéro, contenu différent: on ne sait pas lequel est le bon. */
  | { readonly kind: 'different'; readonly version: string };

/** Clés des schémas Valibot qui ne décrivent pas la forme acceptée. */
const SKIPPED_KEYS = new Set(['message', 'reference', 'async']);

function describeSchema(value: unknown, out: string[], ancestors: Set<object>): void {
  if (typeof value === 'function' || value === undefined) return;
  if (value === null || typeof value !== 'object') {
    out.push(JSON.stringify(value));
    return;
  }
  if (ancestors.has(value)) {
    out.push('#cycle');
    return;
  }
  ancestors.add(value);
  if (Array.isArray(value)) {
    out.push('[');
    for (const item of value) {
      describeSchema(item, out, ancestors);
      out.push(',');
    }
    out.push(']');
  } else {
    out.push('{');
    for (const key of Object.keys(value).sort()) {
      if (key.startsWith('~') || SKIPPED_KEYS.has(key)) continue;
      out.push(key, ':');
      describeSchema((value as Record<string, unknown>)[key], out, ancestors);
      out.push(',');
    }
    out.push('}');
  }
  ancestors.delete(value);
}

/**
 * Empreinte déterministe de schémas Valibot: types, champs, valeurs admises (`expects`, listes de
 * choix) et bornes. Une intention, un événement ou un champ ajouté la change.
 */
export function schemaFingerprint(schemas: readonly unknown[]): string {
  const out: string[] = [];
  describeSchema(schemas, out, new Set());
  return fnv1a32(out.join('')).toString(16).padStart(8, '0');
}

/** Les schémas de tous les messages du jeu. */
export const MESSAGE_SCHEMAS: readonly unknown[] = [
  GuestInputSchema,
  FastSchema,
  EventsSchema,
  SLICE_SCHEMAS,
  ProgressPartSchema,
  PlacePartSchema,
];

export function localHello(game: string, version: string): CompatHello {
  return {
    game,
    version,
    protocol: NET_PROTOCOL,
    schemas: schemaFingerprint(MESSAGE_SCHEMAS),
    build: typeof __LPL_BUILD_FINGERPRINT__ === 'string' ? __LPL_BUILD_FINGERPRINT__ : 'dev',
  };
}

/** Comparaison SemVer des seuls nombres (`0.21.0` < `0.22.0`), négative si `a` est plus ancien. */
export function compareVersions(a: string, b: string): number {
  const parts = (text: string): number[] =>
    (text.split('-')[0] ?? '').split('.').map((part) => Number.parseInt(part, 10) || 0);
  const pa = parts(a);
  const pb = parts(b);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

export function compareHellos(self: CompatHello, peer: CompatHello): CompatVerdict {
  const order = compareVersions(self.version, peer.version);
  if (order < 0) return { kind: 'self-older', self: self.version, peer: peer.version };
  if (order > 0) return { kind: 'peer-older', self: self.version, peer: peer.version };
  const same =
    self.game === peer.game &&
    self.protocol === peer.protocol &&
    self.schemas === peer.schemas &&
    self.build === peer.build;
  return same ? { kind: 'ok' } : { kind: 'different', version: self.version };
}

export interface CompatCheck {
  verdict(): CompatVerdict;
  /** Renvoie la carte (départ, reprise): celle d'avant a pu partir avant que l'autre n'écoute. */
  resend(): void;
  /** Un pas de la boucle: compte l'attente de la carte de l'autre. */
  step(): void;
  onVerdict(listener: (verdict: CompatVerdict) => void): () => void;
  dispose(): void;
}

export function createCompatCheck(
  net: Net,
  hello: CompatHello,
  waitSteps = COMPAT_WAIT_STEPS,
): CompatCheck {
  const channel = net.channel(COMPAT_CHANNEL, { mode: 'reliable', schema: CompatHelloSchema });
  const listeners = new Set<(verdict: CompatVerdict) => void>();
  let verdict: CompatVerdict = { kind: 'waiting' };
  let waited = 0;

  const settle = (next: CompatVerdict): void => {
    verdict = next;
    for (const listener of listeners) listener(next);
  };
  const off = channel.onMessage((peer) => {
    if (verdict.kind !== 'waiting') return;
    // Première carte de l'autre: on lui renvoie la nôtre, la sienne a pu partir trop tôt.
    if (peer.reply !== true) channel.send({ ...hello, reply: true });
    settle(compareHellos(hello, peer));
  });
  channel.send(hello);

  return {
    verdict: () => verdict,
    resend() {
      if (verdict.kind === 'waiting') channel.send(hello);
    },
    step() {
      if (verdict.kind !== 'waiting') return;
      waited += 1;
      if (waited >= waitSteps) settle({ kind: 'peer-older', self: hello.version, peer: '' });
    },
    onVerdict(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    dispose() {
      off();
      listeners.clear();
    },
  };
}

/** Textes montrés aux joueurs: tutoiement, sans jargon, la machine en retard nommée. */
export const COMPAT_TEXTS = {
  selfOlder:
    'Ton jeu est plus ancien que celui de {nom}: la partie ne peut pas commencer. Quitte la partie, puis ferme et relance Duo sur ta machine pour mettre le jeu à jour.',
  peerOlder:
    'Le jeu de {nom} est plus ancien que le tien: la partie ne peut pas commencer. Quittez la partie; {nom} ferme et relance Duo sur sa machine pour mettre le jeu à jour.',
  different:
    'Ton jeu et celui de {nom} ne sont pas tout à fait les mêmes: la partie ne peut pas commencer. Quittez la partie, puis fermez et relancez Duo sur vos deux machines pour avoir la même version.',
  rejected:
    'Ton jeu ne comprend plus tout ce que lui envoie celui de {nom}. Quittez la partie, puis fermez et relancez Duo sur vos deux machines pour mettre le jeu à jour.',
} as const;

/** Le texte d'un verdict, `null` si la partie peut se jouer. */
export function compatText(verdict: CompatVerdict, peerName: string): string | null {
  const fill = (text: string): string => text.replaceAll('{nom}', peerName);
  switch (verdict.kind) {
    case 'waiting':
    case 'ok':
      return null;
    case 'self-older':
      return fill(COMPAT_TEXTS.selfOlder);
    case 'peer-older':
      return fill(COMPAT_TEXTS.peerOlder);
    case 'different':
      return fill(COMPAT_TEXTS.different);
  }
}
