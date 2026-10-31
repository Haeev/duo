// Règles du pseudo (F01, ADR 0009 point 2, H-01): 1 à 16 graphèmes de l'alphabet
// latin avec ses accents, chiffres, espaces intérieures, trait d'union et
// apostrophes; enregistré en NFC, sans espace au début ni à la fin.

export const PSEUDO_MAX_GRAPHEMES = 16;

const ALLOWED_CHARACTER = /^[\p{Script=Latin}\p{M}0-9 '’-]$/u;

export type PseudoCheck =
  | { readonly ok: true; readonly value: string }
  | { readonly ok: false; readonly reason: 'empty' | 'character' | 'length' };

const segmenter = new Intl.Segmenter('fr', { granularity: 'grapheme' });

export function graphemes(text: string): string[] {
  return Array.from(segmenter.segment(text), (segment) => segment.segment);
}

/** Vrai si ce graphème peut entrer dans un pseudo. */
export function isAllowedGrapheme(grapheme: string): boolean {
  return Array.from(grapheme).every((character) => ALLOWED_CHARACTER.test(character));
}

export function normalizePseudo(raw: string): string {
  return raw.normalize('NFC').trim();
}

export function checkPseudo(raw: string): PseudoCheck {
  const value = normalizePseudo(raw);
  if (value === '') {
    return { ok: false, reason: 'empty' };
  }
  const parts = graphemes(value);
  if (!parts.every(isAllowedGrapheme)) {
    return { ok: false, reason: 'character' };
  }
  if (parts.length > PSEUDO_MAX_GRAPHEMES) {
    return { ok: false, reason: 'length' };
  }
  return { ok: true, value };
}

/**
 * Filtre une saisie: retire les graphèmes refusés et coupe au maximum.
 * `rejected` dit si un caractère a été refusé (message sous le champ).
 */
export function filterPseudoInput(raw: string): { value: string; rejected: boolean } {
  const parts = graphemes(raw.normalize('NFC'));
  const kept = parts.filter(isAllowedGrapheme);
  return {
    value: kept.slice(0, PSEUDO_MAX_GRAPHEMES).join(''),
    rejected: kept.length !== parts.length,
  };
}
