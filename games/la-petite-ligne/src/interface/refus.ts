/**
 * Refus: une action du joueur qui n'a pas pu se faire (« Déjà pris par
 * Sacha. », « Il manque 40 sous. », sac plein, meuble qui ne passe pas, coin
 * de l'autre). La simulation les envoie comme des messages ordinaires; on les
 * reconnaît à leur clé de `textes.json` (ou, pour les matériaux manquants, au
 * gabarit `ui.workbench.missing`), pour les montrer en erreur et ne pas leur
 * donner le carillon des bonnes nouvelles. Pur, sans DOM: le son s'en sert
 * aussi. Quand la simulation donnera la sorte `refusal`, elle est reconnue
 * telle quelle.
 */

/** Clés des messages de refus dans `textes.json`. */
export const REFUSAL_KEYS: ReadonlySet<string> = new Set([
  'already_taken',
  'not_enough_money',
  'bag_full',
  'grocer_not_buying',
  'grocer_daily_cap',
  'catalogue_closed',
  'needs_both',
  'nothing_here',
  'riddle_not_yet',
  'corner_not_yours',
  'corner_outside',
  'corner_taken',
  'corner_partner_things',
  'sow_out_of_season',
]);

/** Toutes les raisons d'un refus de pose (`placement_outside`, `placement_wall`...). */
const REFUSAL_PREFIXES: readonly string[] = ['placement_'];

export interface RefusalTexts {
  /** `textes.json`, `ui.workbench.missing` (« Il manque: {missing} »), texte composé par la simulation. */
  readonly missingTemplate: string | null;
}

const patterns = new Map<string, RegExp>();

function templatePattern(template: string): RegExp {
  let p = patterns.get(template);
  if (p === undefined) {
    const source = template
      .split(/\{[a-zA-Z]+\}/)
      .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .join('(.+?)');
    p = new RegExp(`^${source}$`, 'su');
    patterns.set(template, p);
  }
  return p;
}

/** La sorte d'affichage d'une notification: `refusal` pour un refus, sinon la sorte donnée par la simulation. */
export function notificationSort(
  n: Readonly<{ kind: string; key: string | null; text: string }>,
  texts: RefusalTexts,
): string {
  return isRefusal(n, texts) ? 'refusal' : n.kind;
}

export function isRefusal(n: Readonly<{ kind: string; key: string | null; text: string }>, texts: RefusalTexts): boolean {
  if (n.kind === 'refusal') return true;
  if (n.key !== null) return REFUSAL_KEYS.has(n.key) || REFUSAL_PREFIXES.some((prefix) => n.key?.startsWith(prefix) === true);
  return n.kind === 'message' && texts.missingTemplate !== null && templatePattern(texts.missingTemplate).test(n.text);
}

/** Le gabarit des matériaux manquants, lu dans le contenu (`Texts.raw.ui.workbench.missing`). */
export function refusalTexts(raw: Readonly<Record<string, unknown>>): RefusalTexts {
  const ui = raw.ui;
  const workbench = typeof ui === 'object' && ui !== null ? (ui as Record<string, unknown>).workbench : undefined;
  const missing = typeof workbench === 'object' && workbench !== null ? (workbench as Record<string, unknown>).missing : undefined;
  return { missingTemplate: typeof missing === 'string' ? missing : null };
}
