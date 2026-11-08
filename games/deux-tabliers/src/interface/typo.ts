/**
 * Typographie française de l'interface (ux.md 0.3, règles de `outils/typographier.py`):
 * les textes s'écrivent avec des espaces ordinaires, `fr` pose les vraies au moment d'afficher.
 */
const NBSP = '\u00a0';
const NNBSP = '\u202f';

/** Applique la typographie française à un texte d'interface. Idempotent. */
export function fr(text: string): string {
  let t = text;
  t = t.replace(/(?<=[A-Za-zÀ-ÿŒœ])'(?=[A-Za-zÀ-ÿŒœ])/g, '’');
  t = t.replace(/\.\.\./g, '…');
  t = t.replace(/«[ \u00a0\u202f]*/g, `«${NBSP}`);
  t = t.replace(/[ \u00a0\u202f]*»/g, `${NBSP}»`);
  t = t.replace(/[ \u00a0]+:/g, `${NBSP}:`);
  t = t.replace(/[ \u00a0\u202f]+([;!?])/g, `${NNBSP}$1`);
  t = t.replace(/(?<![\d,])(\d{1,3})[ \u00a0\u202f](\d{3})(?!\d)/g, `$1${NNBSP}$2`);
  t = t.replace(/(\d)[ \u00a0\u202f]+%/g, `$1${NNBSP}%`);
  t = t.replace(/(\d)[ \u00a0]+(€|°C)/g, `$1${NBSP}$2`);
  t = t.replace(/(\d) (h|min|s|kg|g|L|cm|m|m²|km)(?![\wÀ-ÿ])/g, `$1${NBSP}$2`);
  t = t.replace(/(\d\u00a0h) (\d)/g, `$1${NBSP}$2`);
  t = t.replace(/\+ (?=\d)/g, `+${NBSP}`);
  return t;
}

/** Montant en centimes: « 4,20 € », « 1 482 € » (centimes omis quand ils sont nuls et `round`). */
export function euros(cents: number, round = false): string {
  const negative = cents < 0;
  const abs = Math.abs(Math.round(cents));
  const whole = Math.floor(abs / 100);
  const rest = abs % 100;
  const grouped = String(whole).replace(/\B(?=(\d{3})+(?!\d))/g, NNBSP);
  const body = round && rest === 0 ? grouped : `${grouped},${String(rest).padStart(2, '0')}`;
  return `${negative ? '-' : ''}${body}${NBSP}€`;
}

/** Heure du jour en minutes depuis minuit: « 11 h 20 », « 18 h ». */
export function heure(minutes: number): string {
  const m = Math.max(0, Math.floor(minutes));
  const h = Math.floor(m / 60) % 24;
  const mm = m % 60;
  return mm === 0 ? `${h}${NBSP}h` : `${h}${NBSP}h${NBSP}${String(mm).padStart(2, '0')}`;
}

/** Commence par une voyelle (« Alex », « Émilie »): « de », « que » s'élident devant. */
function vowelStart(value: string): boolean {
  return /^[AEIOUYÀÂÆÉÈÊËÎÏÔŒÙÛÜaeiouyàâæéèêëîïôœùûü]/.test(value);
}

/**
 * Remplace `{cle}` par sa valeur, avec l'élision de « de » et « que » devant un prénom à
 * voyelle (« l'accord d'Alex », « tant qu'Alex n'a pas choisi »).
 */
export function fill(template: string, values: Readonly<Record<string, string | number>>): string {
  return template.replace(
    /(\b(?:de|que|De|Que) )?\{(\w+)\}/g,
    (all, before: string | undefined, key: string) => {
      const value = values[key];
      if (value === undefined) return all;
      const text = String(value);
      if (before === undefined) return text;
      return typeof value === 'string' && vowelStart(text)
        ? `${before.slice(0, -2)}'${text}`
        : `${before}${text}`;
    },
  );
}

/** Première lettre en capitale (« mardi » vers « Mardi »). */
export function capital(text: string): string {
  return text.length === 0 ? text : text.charAt(0).toUpperCase() + text.slice(1);
}
