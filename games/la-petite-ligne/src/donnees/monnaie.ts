/**
 * La monnaie de la vallée (0.12, section 1 de `v0-12-conception.md`): son nom vient d'un seul
 * endroit, `reglages.economy.currency`. Tout libellé de montant écrit par le code passe par
 * `formatMoney` (ou `moneyUnit`); les textes des données écrivent le pluriel après le nombre
 * (« {amount} aubrins ») et l'accord de 0 et 1 se fait au remplissage (`agreeMoney`).
 */
import reglages from '../../donnees/reglages.json';

export interface Currency {
  singular: string;
  plural: string;
  /** Symbole du sprite des icônes (`ui-maquettes/icones.svg`). */
  icon: string;
}

/** Espace fine insécable entre les milliers (« 1 200 »). */
const THOUSANDS = ' ';

function currencyOf(raw: unknown): Currency {
  const economy =
    typeof raw === 'object' && raw !== null ? (raw as { economy?: unknown }).economy : undefined;
  const value =
    typeof economy === 'object' && economy !== null
      ? (economy as { currency?: unknown }).currency
      : undefined;
  if (typeof value !== 'object' || value === null)
    throw new Error('reglages.json: economy.currency manque');
  const { singular, plural, icon } = value as Record<string, unknown>;
  if (
    typeof singular !== 'string' ||
    typeof plural !== 'string' ||
    typeof icon !== 'string' ||
    singular === '' ||
    plural === ''
  )
    throw new Error('reglages.json: economy.currency attend singular, plural et icon');
  return { singular, plural, icon };
}

/** La monnaie des réglages livrés (mêmes valeurs que `content.settings.economy.currency`). */
export const CURRENCY: Currency = currencyOf(reglages);

/** Unité accordée: singulier pour 0 et 1, pluriel à partir de 2 (section 1.1). */
export function moneyUnit(amount: number, currency: Currency = CURRENCY): string {
  return Math.abs(amount) < 2 ? currency.singular : currency.plural;
}

/** « 1 200 »: milliers séparés par une espace fine insécable. */
export function groupDigits(amount: number): string {
  const sign = amount < 0 ? '-' : '';
  const digits = String(Math.abs(Math.round(amount)));
  return sign + digits.replace(/\B(?=(\d{3})+(?!\d))/g, THOUSANDS);
}

/** « 0 aubrin », « 1 aubrin », « 2 aubrins », « 1 200 aubrins ». */
export function formatMoney(amount: number, currency: Currency = CURRENCY): string {
  return `${groupDigits(amount)} ${moneyUnit(amount, currency)}`;
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const agreeCache = new Map<string, RegExp>();

function agreePattern(currency: Currency): RegExp {
  let re = agreeCache.get(currency.plural);
  if (re === undefined) {
    // Un 0 ou un 1 seul (pas la fin de « 10 », de « 1 200 » ni de « 2,1 ») suivi du pluriel.
    re = new RegExp(
      `(^|[^\\d\\u202f.,])([01])([ \\u00a0])${escapeRegExp(currency.plural)}(?![\\p{L}\\d])`,
      'gu',
    );
    agreeCache.set(currency.plural, re);
  }
  return re;
}

/** Accorde un texte rempli: « 1 aubrins » devient « 1 aubrin ». */
export function agreeMoney(text: string, currency: Currency = CURRENCY): string {
  if (!text.includes(currency.plural)) return text;
  return text.replace(agreePattern(currency), `$1$2$3${currency.singular}`);
}

/** « 30 sous », « 1 sou »: un nombre suivi de l'ancienne unité. */
const OLD_AFTER_NUMBER = /(\d)([ \u00a0])sous?(?![\p{L}\d-])/gu;
/** « Cinq sous », « leurs sous », « en sous »; jamais « sous la pluie » (préposition). */
const OLD_AFTER_WORD =
  /\b(Cinq|cinq|deux|trois|dix|vingt|leurs|des|en) sous(?![\p{L}\d-])(?! (?:la|le|les|l'|un|une|ce|cette|son|sa|ses|votre|ton|ta)\b)/gu;

/**
 * Texte écrit avant la 0.12 et gardé tel quel dans une sauvegarde (notifications, lettres
 * migrées): « 30 sous » devient « 30 aubrins ». Seule la monnaie change, jamais la préposition.
 */
export function renameOldCurrency(text: string, currency: Currency = CURRENCY): string {
  if (!oldCurrencyIn(text)) return text;
  const renamed = text
    .replace(OLD_AFTER_NUMBER, `$1$2${currency.plural}`)
    .replace(OLD_AFTER_WORD, `$1 ${currency.plural}`);
  return agreeMoney(renamed, currency);
}

/** Un texte qui dit encore « sou » ou « sous » au sens de la monnaie (contrôle CA-M1). */
export function oldCurrencyIn(text: string): boolean {
  if (!text.includes('sou')) return false;
  OLD_AFTER_NUMBER.lastIndex = 0;
  OLD_AFTER_WORD.lastIndex = 0;
  return OLD_AFTER_NUMBER.test(text) || OLD_AFTER_WORD.test(text);
}
