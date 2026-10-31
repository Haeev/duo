// Versions du pont entre un jeu et la plateforme (ADR 0005, point 6; ADR 0006).

/** Version du pont implémentée par ce paquet: `majeure.mineure`. */
export const BRIDGE_VERSION = '1.0';

/** Une version de pont lue: majeure et mineure. */
export interface BridgeVersion {
  readonly major: number;
  readonly minor: number;
}

const BRIDGE_VERSION_PATTERN = /^(0|[1-9]\d{0,3})\.(0|[1-9]\d{0,3})$/;

/** Lit une version `majeure.mineure`; `null` si la chaîne n'en est pas une. */
export function parseBridgeVersion(text: string): BridgeVersion | null {
  const match = BRIDGE_VERSION_PATTERN.exec(text);
  if (match === null) {
    return null;
  }
  return { major: Number(match[1]), minor: Number(match[2]) };
}

/**
 * Un jeu qui exige `required` tourne sur une plateforme qui implémente `offered`
 * si la majeure est la même et si la mineure offerte est au moins égale.
 */
export function isBridgeCompatible(required: string, offered: string): boolean {
  const need = parseBridgeVersion(required);
  const have = parseBridgeVersion(offered);
  if (need === null || have === null) {
    return false;
  }
  return need.major === have.major && have.minor >= need.minor;
}
