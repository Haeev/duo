// Manifeste `duo-game.json` (ADR 0005, point 2): schéma de @duo/protocol.
// `src/main/protocol/` est une copie à l'identique de `packages/protocol/src`
// (arbre principal, 2026-10-31): à la fusion, ces imports passent à `@duo/protocol`.
import { BRIDGE_VERSION, isBridgeCompatible, parseManifest, type GameManifest } from '@duo/protocol';

export type { GameManifest };

export type ManifestCheck =
  | { readonly ok: true; readonly manifest: GameManifest }
  | { readonly ok: false; readonly problems: readonly string[] };

export function checkManifest(raw: unknown): ManifestCheck {
  const result = parseManifest(raw);
  return result.ok
    ? { ok: true, manifest: result.manifest }
    : { ok: false, problems: result.issues };
}

/** Vrai si l'application couvre la version du pont exigée par le jeu (ADR 0005, point 6). */
export function bridgeCovers(required: string): boolean {
  return isBridgeCompatible(required, BRIDGE_VERSION);
}
