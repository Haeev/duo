/**
 * Accords de genre des répliques (cahier 1.5). On écrit d'abord la tournure qui évite l'accord;
 * quand l'accord est le plus naturel, la réplique porte une balise à deux formes:
 *
 * - `[[féminin|masculin]]`: accordé au joueur qui lit (« Te voilà [[prête|prêt]] ! »);
 * - `[[duo:féminin|masculin]]`: accordé aux deux joueurs, au pluriel (féminin si les deux ont
 *   choisi « femme », masculin sinon): « Vous voilà [[duo:arrivées|arrivés]]. »
 *
 * La résolution est faite à l'affichage, chez chaque joueur; le validateur refuse une balise
 * incomplète et signale un accord au joueur écrit hors balise.
 */

import type { Gender } from '../../donnees/schemas/personnage';
import type { PlayerIndex } from '../../donnees/schemas/communs';
import type { ReadonlyWorld } from '../../etat/monde';

export type { Gender };

/**
 * Genre d'un joueur pour les accords. Avant l'éditeur de personnage (`gender` nul), le masculin
 * grammatical sert de forme par défaut; l'éditeur impose le choix avant la première réplique.
 */
export function genderOf(world: ReadonlyWorld, player: PlayerIndex): Gender {
  return world.players[player].gender ?? 'm';
}

/** Texte d'une réplique accordé pour ce joueur, d'après les genres choisis dans l'éditeur. */
export function agreeFor(world: ReadonlyWorld, player: PlayerIndex, text: string): string {
  return resolveAgreement(text, genderOf(world, player), [genderOf(world, 0), genderOf(world, 1)]);
}

const TAG = /\[\[(duo:)?([^[\]|]*)\|([^[\]|]*)\]\]/g;

/** Remplace chaque balise par la forme qui convient. */
export function resolveAgreement(
  text: string,
  reader: Gender,
  duo: readonly [Gender, Gender],
): string {
  const duoFeminine = duo[0] === 'f' && duo[1] === 'f';
  return text.replace(
    TAG,
    (_all, forDuo: string | undefined, feminine: string, masculine: string) => {
      const useFeminine = forDuo === undefined ? reader === 'f' : duoFeminine;
      return useFeminine ? feminine : masculine;
    },
  );
}

/**
 * Tournures qui accordent un mot au joueur (« tu es », « vous voilà »), suivies d'un mot à
 * terminaison accordée. Heuristique: elle signale, le game designer tranche.
 */
const AGREEMENT_HINT =
  /\b(tu es|t'es|tu étais|tu seras|tu sembles|tu as l'air|te voilà|t'as l'air|vous êtes|vous voilà|vous étiez|vous semblez)\s+(?:si |très |bien |tout |toute |trop )?([a-zàâçéèêëîïôûùüÿœ]+)/giu;
const AGREED_ENDING = /(ée|ées|és|é|ues|ue|ies|ie|euse|euses|ive|ives|eux|ais)$/u;

/** Problèmes de balises d'une réplique (vide: tout va bien). */
export function checkAgreementTags(text: string): string[] {
  const problems: string[] = [];
  const opens = text.split('[[').length - 1;
  const closes = text.split(']]').length - 1;
  const complete = [...text.matchAll(TAG)];
  if (opens !== closes || complete.length !== opens)
    problems.push('balise d’accord incomplète: [[féminin|masculin]] ou [[duo:féminin|masculin]]');
  for (const match of complete) {
    if ((match[2] ?? '').trim() === '' || (match[3] ?? '').trim() === '')
      problems.push(`balise d’accord à forme vide: « ${match[0]} »`);
  }
  const untagged = text.replace(TAG, '');
  for (const match of untagged.matchAll(AGREEMENT_HINT)) {
    const word = match[2] ?? '';
    if (AGREED_ENDING.test(word))
      problems.push(
        `accord au joueur hors balise: « ${match[0].trim()} » (tourner sans accord, ou baliser)`,
      );
  }
  return problems;
}

export function hasAgreementTag(text: string): boolean {
  return text.includes('[[');
}
