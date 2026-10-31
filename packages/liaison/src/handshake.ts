import * as v from 'valibot';
import type { Clock, CancelTimer } from './clock.ts';
import type { NetworkConfig } from './config.ts';
import { computeProof, deriveDuoKey, generatePairKey, verifyProof } from './crypto.ts';
import type { ProofContext } from './crypto.ts';
import {
  AuthSchema,
  FrozenEnvelopeSchema,
  HelloSchema,
  ReadySchema,
  RejectSchema,
  WelcomeSchema,
  parseJson,
} from './protocol.ts';
import type { FrozenEnvelope, Hello, InstalledGame, RejectReason, Welcome } from './protocol.ts';
import { toBase64Url } from './random.ts';
import type { RandomSource } from './random.ts';
import type { Connection, Frame } from './transport.ts';

/** Identité que chaque Duo présente dans sa poignée de main (champs de l'ADR 0006). */
export interface SelfIdentity {
  readonly machine: string;
  readonly appVersion: string;
  readonly instance: string;
  readonly pseudo: string;
  readonly color: string;
  readonly computer: string;
  readonly games: readonly InstalledGame[];
  readonly duos: readonly string[];
  readonly bridge?: readonly string[];
  readonly electron?: string;
  readonly dataFormat?: number;
  readonly os?: string;
  readonly arch?: string;
}

/** Échec d'une poignée de main, vu de l'appelant ou de l'appelé. */
export type HandshakeFailure = RejectReason | 'not-duo' | 'timeout' | 'closed';

export type HandshakeResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly failure: HandshakeFailure; readonly peer?: FrozenEnvelope };

function identityFields(self: SelfIdentity, config: NetworkConfig): Record<string, unknown> {
  const fields: Record<string, unknown> = {
    app: config.app,
    envelope: config.envelope,
    machine: self.machine,
    appVersion: self.appVersion,
    protocol: config.protocol,
    instance: self.instance,
    profile: { pseudo: self.pseudo, color: self.color },
    computer: self.computer,
    games: self.games,
    duos: self.duos,
  };
  if (self.bridge !== undefined) fields.bridge = self.bridge;
  if (self.electron !== undefined) fields.electron = self.electron;
  if (self.dataFormat !== undefined) fields.dataFormat = self.dataFormat;
  if (self.os !== undefined) fields.os = self.os;
  if (self.arch !== undefined) fields.arch = self.arch;
  return fields;
}

function rejectFrame(self: SelfIdentity, config: NetworkConfig, reason: RejectReason): string {
  return JSON.stringify({
    app: config.app,
    envelope: config.envelope,
    type: 'reject',
    machine: self.machine,
    appVersion: self.appVersion,
    protocol: config.protocol,
    reason,
  });
}

interface Steps {
  readonly finish: () => void;
  readonly timers: CancelTimer[];
}

function guard(connection: Connection, clock: Clock, timeoutMs: number, onTimeout: () => void): Steps {
  const timers: CancelTimer[] = [];
  timers.push(clock.setTimeout(onTimeout, timeoutMs));
  return {
    timers,
    finish: () => {
      for (const cancel of timers) cancel();
      connection.setHandlers({ onFrame: () => undefined, onClose: () => undefined });
    },
  };
}

/** Clé décidée par l'appelant à la lecture du `welcome`. */
export type CallerKeyDecision =
  | { readonly kind: 'existing'; readonly key: Uint8Array; readonly duo: string }
  | { readonly kind: 'new-duo-allowed' }
  | { readonly kind: 'refuse'; readonly reason: RejectReason };

export interface CallerSuccess {
  readonly welcome: Welcome;
  readonly key: Uint8Array;
  readonly duo: string;
  readonly newDuo: boolean;
}

export interface CallerHandshakeOptions {
  readonly connection: Connection;
  readonly clock: Clock;
  readonly config: NetworkConfig;
  readonly random: RandomSource;
  readonly self: SelfIdentity;
  readonly resume?: { readonly link: string; readonly received: number };
  /** Appelée à la lecture du `welcome`: clé connue, formation permise, ou refus. */
  readonly decideKey: (welcome: Welcome) => CallerKeyDecision;
  readonly onDone: (result: HandshakeResult<CallerSuccess>) => void;
}

/** Côté appelant: `hello`, puis `welcome` ou `reject`, puis `auth`, puis `ready`. Rend une fonction d'abandon. */
export function runCallerHandshake(options: CallerHandshakeOptions): () => void {
  const { connection, clock, config, self } = options;
  const pairKey = generatePairKey();
  const nonce = toBase64Url(options.random.bytes(16));
  let stage: 'welcome' | 'ready' | 'done' = 'welcome';
  let pending: CallerSuccess | null = null;

  const end = (result: HandshakeResult<CallerSuccess>): void => {
    if (stage === 'done') return;
    stage = 'done';
    steps.finish();
    if (!result.ok) connection.close(4003, result.failure);
    options.onDone(result);
  };
  const steps = guard(connection, clock, config.handshakeTimeoutMs, () => {
    end({ ok: false, failure: stage === 'welcome' ? 'not-duo' : 'timeout' });
  });
  steps.timers.push(
    clock.setTimeout(() => {
      if (stage === 'welcome') end({ ok: false, failure: 'not-duo' });
    }, config.helloTimeoutMs),
  );

  connection.setHandlers({
    onClose: () => {
      end({ ok: false, failure: stage === 'welcome' ? 'not-duo' : 'closed' });
    },
    onFrame: (frame: Frame) => {
      if (typeof frame !== 'string') {
        end({ ok: false, failure: 'malformed' });
        return;
      }
      const data = parseJson(frame);
      if (stage === 'welcome') {
        const envelope = v.safeParse(FrozenEnvelopeSchema, data);
        if (!envelope.success) {
          end({ ok: false, failure: 'not-duo' });
          return;
        }
        if (envelope.output.type === 'reject') {
          const reject = v.safeParse(RejectSchema, data);
          end({
            ok: false,
            failure: reject.success ? reject.output.reason : 'malformed',
            peer: envelope.output,
          });
          return;
        }
        if (envelope.output.protocol !== config.protocol) {
          end({ ok: false, failure: 'protocol', peer: envelope.output });
          return;
        }
        const welcome = v.safeParse(WelcomeSchema, data);
        if (!welcome.success) {
          end({ ok: false, failure: 'malformed', peer: envelope.output });
          return;
        }
        if (welcome.output.machine === self.machine) {
          end({ ok: false, failure: 'self' });
          return;
        }
        const decision = options.decideKey(welcome.output);
        let key: Uint8Array | null;
        let duo: string;
        let newDuo = false;
        if (welcome.output.pairing !== undefined) {
          if (decision.kind === 'refuse') {
            end({ ok: false, failure: decision.reason });
            return;
          }
          duo = welcome.output.pairing.duo;
          key = deriveDuoKey(pairKey.privateKey, welcome.output.pairing.pairKey, duo);
          newDuo = true;
        } else if (decision.kind === 'existing') {
          key = decision.key;
          duo = decision.duo;
        } else {
          end({ ok: false, failure: decision.kind === 'refuse' ? decision.reason : 'not-paired' });
          return;
        }
        if (key === null) {
          end({ ok: false, failure: 'malformed' });
          return;
        }
        const context: ProofContext = {
          callerNonce: nonce,
          calleeNonce: welcome.output.nonce,
          callerMachine: self.machine,
          calleeMachine: welcome.output.machine,
          link: welcome.output.link,
        };
        if (!verifyProof(key, 'appele', context, welcome.output.proof)) {
          end({ ok: false, failure: 'bad-proof', peer: envelope.output });
          return;
        }
        pending = { welcome: welcome.output, key, duo, newDuo };
        stage = 'ready';
        connection.send(JSON.stringify({ type: 'auth', proof: computeProof(key, 'appelant', context) }));
        return;
      }
      if (stage === 'ready') {
        const ready = v.safeParse(ReadySchema, data);
        const success = pending;
        if (!ready.success || success?.welcome.link !== ready.output.link) {
          const reject = v.safeParse(RejectSchema, data);
          end({ ok: false, failure: reject.success ? reject.output.reason : 'malformed' });
          return;
        }
        end({ ok: true, value: success });
      }
    },
  });

  const hello: Record<string, unknown> = {
    ...identityFields(self, config),
    type: 'hello',
    nonce,
    pairKey: pairKey.publicKey,
  };
  if (options.resume !== undefined) hello.resume = options.resume;
  connection.send(JSON.stringify(hello));

  return () => {
    end({ ok: false, failure: 'closed' });
  };
}

/** Décision de l'appelé à la lecture du `hello`. */
export type CalleeDecision =
  | { readonly kind: 'reject'; readonly reason: RejectReason }
  | {
      readonly kind: 'accept';
      readonly link: string;
      readonly resumed: boolean;
      readonly received: number;
      readonly key:
        | { readonly kind: 'existing'; readonly key: Uint8Array; readonly duo: string }
        | { readonly kind: 'new-duo'; readonly duo: string };
    };

export interface CalleeSuccess {
  readonly hello: Hello;
  readonly link: string;
  readonly resumed: boolean;
  readonly key: Uint8Array;
  readonly duo: string;
  readonly newDuo: boolean;
}

export interface CalleeHandshakeOptions {
  readonly connection: Connection;
  readonly clock: Clock;
  readonly config: NetworkConfig;
  readonly random: RandomSource;
  readonly self: SelfIdentity;
  /** Appelée avec un `hello` valide d'un pair au même protocole. */
  readonly decide: (hello: Hello) => CalleeDecision;
  /** Un pair au protocole différent s'est présenté (M-27). */
  readonly onIncompatible: (peer: FrozenEnvelope) => void;
  readonly onDone: (result: HandshakeResult<CalleeSuccess>) => void;
}

/** Côté appelé: attend `hello`, répond `welcome` ou `reject`, vérifie `auth`, envoie `ready`. */
export function runCalleeHandshake(options: CalleeHandshakeOptions): () => void {
  const { connection, clock, config, self } = options;
  let stage: 'hello' | 'auth' | 'done' = 'hello';
  let expected: { context: ProofContext; success: CalleeSuccess } | null = null;

  const end = (result: HandshakeResult<CalleeSuccess>, reject?: RejectReason): void => {
    if (stage === 'done') return;
    stage = 'done';
    steps.finish();
    if (!result.ok) {
      if (reject !== undefined) connection.send(rejectFrame(self, config, reject));
      connection.close(4003, result.failure);
    }
    options.onDone(result);
  };
  const steps = guard(connection, clock, config.handshakeTimeoutMs, () => {
    end({ ok: false, failure: 'timeout' });
  });
  steps.timers.push(
    clock.setTimeout(() => {
      if (stage === 'hello') end({ ok: false, failure: 'timeout' });
    }, config.helloTimeoutMs),
  );

  connection.setHandlers({
    onClose: () => {
      end({ ok: false, failure: 'closed' });
    },
    onFrame: (frame: Frame) => {
      if (typeof frame !== 'string') {
        end({ ok: false, failure: 'malformed' });
        return;
      }
      const data = parseJson(frame);
      if (stage === 'hello') {
        const envelope = v.safeParse(FrozenEnvelopeSchema, data);
        if (!envelope.success || envelope.output.type !== 'hello') {
          end({ ok: false, failure: 'malformed' });
          return;
        }
        if (envelope.output.protocol !== config.protocol) {
          options.onIncompatible(envelope.output);
          end({ ok: false, failure: 'protocol', peer: envelope.output }, 'protocol');
          return;
        }
        const hello = v.safeParse(HelloSchema, data);
        if (!hello.success) {
          end({ ok: false, failure: 'malformed', peer: envelope.output }, 'malformed');
          return;
        }
        if (hello.output.machine === self.machine) {
          end({ ok: false, failure: 'self' }, 'self');
          return;
        }
        const decision = options.decide(hello.output);
        if (decision.kind === 'reject') {
          end({ ok: false, failure: decision.reason, peer: envelope.output }, decision.reason);
          return;
        }
        let key: Uint8Array | null;
        let pairing: { duo: string; pairKey: string } | undefined;
        if (decision.key.kind === 'existing') {
          key = decision.key.key;
        } else {
          const own = generatePairKey();
          key = deriveDuoKey(own.privateKey, hello.output.pairKey, decision.key.duo);
          pairing = { duo: decision.key.duo, pairKey: own.publicKey };
        }
        if (key === null) {
          end({ ok: false, failure: 'malformed' }, 'malformed');
          return;
        }
        const nonce = toBase64Url(options.random.bytes(16));
        const context: ProofContext = {
          callerNonce: hello.output.nonce,
          calleeNonce: nonce,
          callerMachine: hello.output.machine,
          calleeMachine: self.machine,
          link: decision.link,
        };
        const welcome: Record<string, unknown> = {
          ...identityFields(self, config),
          type: 'welcome',
          nonce,
          link: decision.link,
          resumed: decision.resumed,
          received: decision.received,
          proof: computeProof(key, 'appele', context),
        };
        if (pairing !== undefined) welcome.pairing = pairing;
        expected = {
          context,
          success: {
            hello: hello.output,
            link: decision.link,
            resumed: decision.resumed,
            key,
            duo: decision.key.duo,
            newDuo: pairing !== undefined,
          },
        };
        stage = 'auth';
        connection.send(JSON.stringify(welcome));
        return;
      }
      if (stage === 'auth') {
        const auth = v.safeParse(AuthSchema, data);
        if (!auth.success || expected === null) {
          end({ ok: false, failure: 'malformed' }, 'malformed');
          return;
        }
        if (!verifyProof(expected.success.key, 'appelant', expected.context, auth.output.proof)) {
          end({ ok: false, failure: 'bad-proof' }, 'bad-proof');
          return;
        }
        const success = expected.success;
        connection.send(JSON.stringify({ type: 'ready', link: success.link }));
        end({ ok: true, value: success });
      }
    },
  });

  return () => {
    end({ ok: false, failure: 'closed' });
  };
}
