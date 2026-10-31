/**
 * Typographie française des textes affichés, appliquée au moment de
 * l'affichage à tous les textes (données comprises): les fichiers de textes
 * restent écrits avec des espaces ordinaires, ou sans espace avant les
 * deux-points (style de `textes.json`). Règle du manager (recette LPL-R05):
 * espace insécable avant « : » et espace fine insécable avant « ; », « ? »,
 * « ! », que le texte en ait mis une ou non, sauf dans une heure (12:30) et une
 * adresse (https://). Repris de `ui-maquettes/outils/typographier.py`, avec
 * les points de suspension en plus. Idempotente.
 */

/** Espace insécable. */
export const NBSP = '\u00a0';
/** Espace fine insécable. */
export const NNBSP = '\u202f';

const COUNTED =
  /(\d) (radis|laitues?|œufs?|planches?|clous?|carottes?|lignes?|jours?|journées|places|arrosages|rondins?|colis|meubles?|sachets?)(?![\p{L}\d])/gu;

export function typographier(text: string): string {
  let t = text;
  // Apostrophe typographique entre deux lettres (C'est, l'autre, aujourd'hui).
  t = t.replace(/(?<=\p{L})'(?=\p{L})/gu, '’');
  // Points de suspension.
  t = t.replace(/\.\.\./g, '…');
  // Guillemets français: espace insécable à l'intérieur.
  t = t.replace(/«[ \u00a0\u202f]*/g, `«${NBSP}`);
  t = t.replace(/[ \u00a0\u202f]*»/g, `${NBSP}»`);
  // Deux-points: espace insécable avant (une espace ordinaire ou fine devient insécable).
  t = t.replace(/[ \u202f]+:/g, `${NBSP}:`);
  t = t.replace(/(\S):/g, (match: string, before: string, offset: number, whole: string) => {
    const after = whole.charAt(offset + match.length);
    // Heure (12:30), adresse (https://), deux-points doublés: on ne touche pas.
    if ((/\d/.test(before) && /\d/.test(after)) || after === '/' || before === ':') return match;
    return `${before}${NBSP}:`;
  });
  // Point-virgule, point d'exclamation, point d'interrogation: espace fine insécable.
  t = t.replace(/[ \u00a0]+([;!?])/g, `${NNBSP}$1`);
  t = t.replace(/(\S)([;!?])/g, (match: string, before: string, mark: string) =>
    // Une suite de signes (« ?! ») ne prend l'espace qu'avant le premier; rien après une parenthèse ouvrante.
    ';!?(«'.includes(before) ? match : `${before}${NNBSP}${mark}`,
  );
  // Pourcentage.
  t = t.replace(/(\d)[ \u00a0]+%/g, `$1${NNBSP}%`);
  // Unités et heures: 21 h 40, 3 min, 120 sous.
  t = t.replace(/(\d) (h|min|s|sous)(?![\p{L}\d])/gu, `$1${NBSP}$2`);
  // Un nombre ne se sépare pas de l'objet compté (3 œufs, 12 radis).
  t = t.replace(COUNTED, `$1${NBSP}$2`);
  t = t.replace(/(\d\u00a0h) (\d)/g, `$1${NBSP}$2`);
  return t;
}
