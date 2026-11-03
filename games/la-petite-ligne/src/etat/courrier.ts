/**
 * Texte des lettres reconstitué depuis les données (format 8): l'état ne garde que l'identifiant,
 * la variante tirée et les valeurs des variables citées, figées à l'envoi. Pur: lu par la
 * simulation, l'interface et la migration des sauvegardes.
 */
import type { Content, LetterDef } from '../donnees/types';
import type { DeepReadonly, Letter } from './types';

type LetterView = DeepReadonly<Letter>;

const VAR = /\{([a-zA-Z]+)\}/g;

function fill(template: string, vars: Readonly<Record<string, string | number>>): string {
  return template.replace(VAR, (whole, name: string) => {
    const value = vars[name];
    return value === undefined ? whole : String(value);
  });
}

/** Définition d'une lettre, lettres hebdomadaires comprises (`<id>@<jour du train>`). */
export function letterDefOf(content: Content, id: string): LetterDef | undefined {
  return content.letters[id.split('@')[0] ?? id];
}

/** Gabarit du texte: la variante retenue, sinon le texte de base. */
function textTemplate(def: LetterDef, variant: number | null): string {
  return (variant === null ? undefined : def.variants[variant]?.text) ?? def.text;
}

/** Noms des variables citées par le titre et le texte retenu: seules leurs valeurs sont gardées. */
export function citedVars(def: LetterDef, variant: number | null): string[] {
  const names = new Set<string>();
  for (const t of [def.title, textTemplate(def, variant)]) for (const m of t.matchAll(VAR)) if (m[1] !== undefined) names.add(m[1]);
  return [...names];
}

export function letterTitle(content: Content, letter: LetterView): string {
  if (letter.legacy !== undefined) return letter.legacy.title;
  const def = letterDefOf(content, letter.id);
  return def === undefined ? letter.id : fill(def.title, letter.vars ?? {});
}

export function letterText(content: Content, letter: LetterView): string {
  if (letter.legacy !== undefined) return letter.legacy.text;
  const def = letterDefOf(content, letter.id);
  return def === undefined ? '' : fill(textTemplate(def, letter.variant ?? null), letter.vars ?? {}).trim();
}

/** Nom de l'expéditeur (« La coopérative de la ligne »). */
export function letterFrom(content: Content, letter: LetterView): string {
  if (letter.legacy !== undefined) return letter.legacy.from;
  const def = letterDefOf(content, letter.id);
  return def === undefined ? '' : (content.senders[def.from] ?? def.from);
}

/**
 * Lettre à garder dans l'état: les valeurs par défaut (texte de base, aucune variable) sont omises,
 * elles pèsent sur chaque lettre d'une longue partie.
 */
export function letterOf(base: Pick<Letter, 'id' | 'day' | 'read'>, variant: number | null, vars: Record<string, string | number>): Letter {
  return { ...base, ...(variant === null ? {} : { variant }), ...(Object.keys(vars).length === 0 ? {} : { vars }) };
}

const escape = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Valeurs des variables qui redonnent `rendered` depuis `template`, ou `null`. */
function varsFrom(template: string, rendered: string, into: Record<string, string>): boolean {
  const names: string[] = [];
  let pattern = '';
  let last = 0;
  for (const m of template.matchAll(VAR)) {
    pattern += escape(template.slice(last, m.index));
    pattern += '([\\s\\S]*?)';
    names.push(m[1] ?? '');
    last = m.index + m[0].length;
  }
  pattern += escape(template.slice(last));
  const found = new RegExp(`^${pattern}$`).exec(rendered);
  if (found === null) return false;
  for (let i = 0; i < names.length; i++) {
    const name = names[i] ?? '';
    const value = found[i + 1] ?? '';
    if (into[name] !== undefined && into[name] !== value) return false;
    into[name] = value;
  }
  return true;
}

/** Lettre du format 7 (titre, expéditeur et texte rendus). */
export interface RenderedLetter {
  id: string;
  day: number;
  title: string;
  from: string;
  text: string;
  read: Letter['read'];
}

/**
 * Migration 7 vers 8: retrouve la variante et les valeurs des variables d'une lettre rendue. Si les
 * données ne redonnent plus exactement le même titre, le même expéditeur et le même texte (lettre
 * retirée ou réécrite), la lettre garde son texte d'origine (`legacy`).
 */
export function letterFromRendered(content: Content, old: RenderedLetter): Letter {
  const def = letterDefOf(content, old.id);
  const base = { id: old.id, day: old.day, read: [...old.read] };
  if (def !== undefined) {
    const candidates: (number | null)[] = [null, ...def.variants.map((_, i) => i)];
    for (const variant of candidates) {
      const found: Record<string, string> = {};
      if (!varsFrom(def.title, old.title, found) || !varsFrom(textTemplate(def, variant).trim(), old.text, found)) continue;
      // Les nombres redeviennent des nombres, comme à l'envoi (« 05 » resterait un texte).
      const typed = (v: string): string | number => (/^-?\d+$/.test(v) && String(Number(v)) === v ? Number(v) : v);
      const vars = Object.fromEntries(citedVars(def, variant).flatMap((n) => (found[n] === undefined ? [] : [[n, typed(found[n])]])));
      const letter = letterOf(base, variant, vars);
      if (letterTitle(content, letter) === old.title && letterText(content, letter) === old.text && letterFrom(content, letter) === old.from) return letter;
    }
  }
  return { ...base, legacy: { title: old.title, from: old.from, text: old.text } };
}
