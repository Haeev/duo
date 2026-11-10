/** Textes de l'atelier: peu de mots, le reste se dit en images. Tutoiement, pas de tiret long. */
import type { CraftService } from '../../donnees/schemas/plan';

export const WORKSHOP_TEXTS = {
  label: 'Atelier : {poste}',
  tabs: {
    make: 'Fabriquer',
    upgrade: 'Améliorer',
    repair: 'Réparer',
    sharpen: 'Affûter',
  } satisfies Record<CraftService, string>,
  strike: 'Frapper',
  turn: 'Tourner',
  unknown: 'Plan à trouver',
  nothingMake: 'Aucun plan ici.',
  nothingTool: 'Aucun outil à traiter dans ta barre.',
  later: 'Prêt demain',
  pending: 'Un outil t’attend déjà ici.',
  ready: 'Prêt le jour {jour}',
  made: 'Déjà fait {n} fois',
  crafted: 'Fabriqué !',
  firstCraft: 'Première fois !',
  together: 'À deux !',
  learned: 'Nouveau plan !',
  upgraded: 'Amélioré !',
  ordered: 'Prêt demain !',
  mended: 'Comme neuf !',
  sharpened: 'Ça coupe mieux.',
  keysTabs: 'onglet',
  keysColor: 'couleur',
  keysClose: 'fermer',
  material: '{objet} : {a} sur {n}',
  fromChest: 'dont {n} au coffre',
  wear: 'Usure',
  provisional: 'Image provisoire',
} as const;

const REFUSALS: Readonly<Record<string, string>> = {
  'too-far': 'Approche-toi du poste.',
  'not-here': 'Ça ne se fait pas ici.',
  'unknown-plan': 'Il te faut d’abord le plan.',
  'missing-materials': 'Il manque des matériaux.',
  'not-enough-money': 'Pas assez dans ta bourse.',
  busy: 'L’autre travaille déjà ici.',
  'no-work': 'Choisis d’abord un plan.',
  'no-tool-in-hand': 'Prends un outil dans ta barre.',
  'cannot-upgrade': 'Cet outil ne s’améliore pas ici.',
  'cannot-repair': 'Cet outil ne se répare pas.',
  'already-sharp': 'Il est comme neuf.',
  'cannot-sharpen': 'La meule ne sert pas pour cet outil.',
  'sharp-enough': 'La meule ne fait pas mieux. L’artisan, si.',
  'order-pending': 'Un outil t’attend déjà ici.',
};

export function workshopRefusalText(reason: string): string | null {
  return REFUSALS[reason] ?? null;
}
