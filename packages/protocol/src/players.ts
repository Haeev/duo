// Couleurs et symboles des joueurs (identité « Étoile double », design/identite/b/joueurs.json).
import * as v from 'valibot';

/** Identifiants des six profils de joueur, dans l'ordre du choix de couleur. */
export const PLAYER_COLOR_IDS = ['orb', 'crescent', 'star', 'sun', 'planet', 'comet'] as const;

/** Profil de couleur d'un joueur: une couleur liée pour toujours à un symbole. */
export type PlayerColorId = (typeof PLAYER_COLOR_IDS)[number];

/** Couleur et nom de chaque profil, repris de `design/identite/b/joueurs.json`. */
export const PLAYER_COLORS: Readonly<Record<PlayerColorId, { readonly hex: string; readonly label: string }>> = {
  orb: { hex: '#5CE1E6', label: 'Astre aqua' },
  crescent: { hex: '#8D6CFF', label: 'Croissant mauve' },
  star: { hex: '#D4F27A', label: 'Étoile anis' },
  sun: { hex: '#FC663F', label: 'Soleil corail' },
  planet: { hex: '#E787B1', label: 'Planète rose' },
  comet: { hex: '#22B07D', label: 'Comète jade' },
};

export const PlayerColorIdSchema = v.picklist(PLAYER_COLOR_IDS);
