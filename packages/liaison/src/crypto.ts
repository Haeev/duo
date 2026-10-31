import {
  createHash,
  createHmac,
  createPublicKey,
  diffieHellman,
  generateKeyPairSync,
  hkdfSync,
  timingSafeEqual,
} from 'node:crypto';
import type { KeyObject } from 'node:crypto';
import { fromBase64Url, toBase64Url } from './random.ts';

/**
 * Clé du duo et preuves (reseau.md, section 6.3; ADR 0007, point 7). Fonctions
 * natives de `node:crypto`, aucune dépendance.
 */

export interface PairKey {
  /** Clé publique X25519 brute, en base64url (43 caractères). */
  readonly publicKey: string;
  readonly privateKey: KeyObject;
}

/** Clé éphémère tirée pour une poignée de main; ne sert qu'à former un duo. */
export function generatePairKey(): PairKey {
  const { publicKey, privateKey } = generateKeyPairSync('x25519');
  const jwk = publicKey.export({ format: 'jwk' });
  return { publicKey: jwk.x ?? '', privateKey };
}

const KEY_INFO = 'duo/cle-liaison/1';

/** Clé du duo: HKDF-SHA256 du secret X25519, sel égal à l'identifiant du duo. `null` si la clé de l'autre est invalide. */
export function deriveDuoKey(
  privateKey: KeyObject,
  peerPublicKey: string,
  duoId: string,
): Uint8Array | null {
  try {
    const peer = createPublicKey({
      key: { kty: 'OKP', crv: 'X25519', x: peerPublicKey },
      format: 'jwk',
    });
    const secret = diffieHellman({ privateKey, publicKey: peer });
    return new Uint8Array(hkdfSync('sha256', secret, Buffer.from(duoId, 'utf8'), KEY_INFO, 32));
  } catch {
    return null;
  }
}

export interface ProofContext {
  readonly callerNonce: string;
  readonly calleeNonce: string;
  readonly callerMachine: string;
  readonly calleeMachine: string;
  readonly link: string;
}

export type ProofRole = 'appele' | 'appelant';

/** Preuve HMAC-SHA256 de la clé du duo sur les deux nonces, les deux machines et la liaison. */
export function computeProof(key: Uint8Array, role: ProofRole, context: ProofContext): string {
  const hmac = createHmac('sha256', key);
  hmac.update(
    [
      `liaison/${role}`,
      context.callerNonce,
      context.calleeNonce,
      context.callerMachine,
      context.calleeMachine,
      context.link,
    ].join('\n'),
  );
  return toBase64Url(new Uint8Array(hmac.digest()));
}

/** Comparaison en temps constant. */
export function verifyProof(
  key: Uint8Array,
  role: ProofRole,
  context: ProofContext,
  proof: string,
): boolean {
  const expected = fromBase64Url(computeProof(key, role, context));
  const received = fromBase64Url(proof);
  return expected.byteLength === received.byteLength && timingSafeEqual(expected, received);
}

/** Empreinte courte d'un duo (8 caractères hexadécimaux du SHA-256), annoncée dans les balises. */
export function duoFingerprint(duoId: string): string {
  return createHash('sha256').update(duoId, 'utf8').digest('hex').slice(0, 8);
}
