// Clés publiques de confiance des paquets de jeux (ADR 0010, point 1). Pour
// préparer une rotation, une version de Duo embarque déjà la clé suivante.
// La clé de test (`packages/paquet/cle-test/`) n'existe que dans les versions de
// test: écrite dans la branche `DUO_TEST`, elle disparaît des versions publiées
// par élimination du code mort, et la CI vérifie son absence (ADR 0013).
import type { TrustedKey } from '@duo/paquet';

export const PUBLISHED_KEYS: readonly TrustedKey[] = [
  { id: 'duo-2026', publicKey: 'pD5JeMAMGqub+yU4peQ1jP1FzvQk70CU1oMoeB1PqdY=' },
];

export function trustedKeys(): readonly TrustedKey[] {
  if (DUO_TEST) {
    return [
      ...PUBLISHED_KEYS,
      { id: 'duo-test', publicKey: 'BykDvRBr0nsJcew7Ilc4Dc4KYzGIyXYyLlJPAqBQxfs=' },
    ];
  }
  return PUBLISHED_KEYS;
}
