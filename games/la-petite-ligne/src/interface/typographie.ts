/**
 * Typographie française des textes affichés, appliquée au moment de
 * l'affichage: les fichiers de textes restent écrits avec des espaces
 * ordinaires (portage de `ui-maquettes/outils/typographier.py`, avec les
 * points de suspension en plus). Idempotente.
 */

/** Espace insécable. */
export const NBSP = ' ';
/** Espace fine insécable. */
export const NNBSP = ' ';

const COUNTED =
  /(\d) (radis|laitues?|œufs?|planches?|clous?|carottes?|lignes?|jours?|journées|places|arrosages|rondins?|colis|meubles?|sachets?)(?![\p{L}\d])/gu;

export function typographier(text: string): string {
  let t = text;
  // Apostrophe typographique entre deux lettres (C'est, l'autre, aujourd'hui).
  t = t.replace(/(?<=\p{L})'(?=\p{L})/gu, '’');
  // Points de suspension.
  t = t.replace(/\.\.\./g, '…');
  // Guillemets français: espace insécable à l'intérieur.
  t = t.replace(/«[   ]*/g, `«${NBSP}`);
  t = t.replace(/[   ]*»/g, `${NBSP}»`);
  // Deux-points: espace insécable avant, si une espace le précède déjà.
  t = t.replace(/[  ]+:/g, `${NBSP}:`);
  // Point-virgule, point d'exclamation, point d'interrogation: espace fine insécable.
  t = t.replace(/[  ]+([;!?])/g, `${NNBSP}$1`);
  // Pourcentage.
  t = t.replace(/(\d)[  ]+%/g, `$1${NNBSP}%`);
  // Unités et heures: 21 h 40, 3 min, 120 sous.
  t = t.replace(/(\d) (h|min|s|sous)(?![\p{L}\d])/gu, `$1${NBSP}$2`);
  // Un nombre ne se sépare pas de l'objet compté (3 œufs, 12 radis).
  t = t.replace(COUNTED, `$1${NBSP}$2`);
  t = t.replace(/(\d h) (\d)/g, `$1${NBSP}$2`);
  return t;
}
