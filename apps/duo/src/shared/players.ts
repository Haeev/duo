// Les six profils de joueur de l'identité « Étoile double »: une couleur liée à
// un symbole, pour toujours. Source unique: design/identite/b/joueurs.json.
import joueurs from '../../../../design/identite/b/joueurs.json';

export const PLAYER_COLORS = ['orb', 'crescent', 'star', 'sun', 'planet', 'comet'] as const;
export type PlayerColor = (typeof PLAYER_COLORS)[number];

export interface PlayerAppearance {
  readonly id: PlayerColor;
  /** Valeur hexadécimale de la couleur. */
  readonly color: string;
  /** Nom accessible: « Astre aqua ». */
  readonly label: string;
  /** Nom du symbole: « astre », « comète ». */
  readonly symbolName: string;
  /** Chemin SVG du symbole, grille de 24. */
  readonly path: string;
}

export function isPlayerColor(value: unknown): value is PlayerColor {
  return typeof value === 'string' && (PLAYER_COLORS as readonly string[]).includes(value);
}

function buildAppearances(): Readonly<Record<PlayerColor, PlayerAppearance>> {
  const entries = new Map<PlayerColor, PlayerAppearance>();
  for (const player of joueurs.players) {
    if (isPlayerColor(player.id)) {
      entries.set(player.id, {
        id: player.id,
        color: player.color,
        label: player.label,
        symbolName: player.symbolName,
        path: player.path,
      });
    }
  }
  const pick = (id: PlayerColor): PlayerAppearance => {
    const appearance = entries.get(id);
    if (appearance === undefined) {
      throw new Error(`Profil de joueur absent de joueurs.json: ${id}`);
    }
    return appearance;
  };
  return {
    orb: pick('orb'),
    crescent: pick('crescent'),
    star: pick('star'),
    sun: pick('sun'),
    planet: pick('planet'),
    comet: pick('comet'),
  };
}

export const PLAYER_APPEARANCES = buildAppearances();
