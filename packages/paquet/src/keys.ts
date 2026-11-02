// Clés Ed25519 des paquets (ADR 0010, point 1): l'application embarque des clés
// publiques brutes (32 octets en base64) avec leur identifiant; la CI signe avec
// la clé privée (PEM PKCS8), qui ne sort jamais de ses secrets.
import { createPrivateKey, createPublicKey, sign, verify, type KeyObject } from 'node:crypto';

export interface TrustedKey {
  readonly id: string;
  /** Clé publique Ed25519 brute, 32 octets en base64. */
  readonly publicKey: string;
}

/** Clé publique utilisable par `crypto.verify`, ou `null` si la valeur n'est pas une clé Ed25519. */
export function publicKeyFromRaw(base64: string): KeyObject | null {
  const raw = Buffer.from(base64, 'base64');
  if (raw.length !== 32 || raw.toString('base64') !== base64) return null;
  try {
    return createPublicKey({
      key: { kty: 'OKP', crv: 'Ed25519', x: raw.toString('base64url') },
      format: 'jwk',
    });
  } catch {
    return null;
  }
}

/** Clé privée Ed25519 lue d'un PEM PKCS8; refuse toute autre courbe. */
export function privateKeyFromPem(pem: string): KeyObject {
  const key = createPrivateKey({ key: pem, format: 'pem' });
  if (key.asymmetricKeyType !== 'ed25519') {
    throw new Error(`clé privée: Ed25519 attendue, ${String(key.asymmetricKeyType)} reçue`);
  }
  return key;
}

/** Clé publique brute (base64) d'une clé privée: sert à vérifier une clé de CI. */
export function rawPublicKeyOf(privateKey: KeyObject): string {
  const jwk = createPublicKey(privateKey).export({ format: 'jwk' });
  if (typeof jwk.x !== 'string') throw new Error('clé publique illisible');
  return Buffer.from(jwk.x, 'base64url').toString('base64');
}

export function signBytes(bytes: Uint8Array, privateKey: KeyObject): Buffer {
  return sign(null, bytes, privateKey);
}

export function verifyBytes(
  bytes: Uint8Array,
  signature: Uint8Array,
  publicKey: KeyObject,
): boolean {
  if (signature.length !== 64) return false;
  return verify(null, bytes, publicKey, signature);
}
