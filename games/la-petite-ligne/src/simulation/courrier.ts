/**
 * Courrier (`courrier.json`): lettres envoyées par un effet ou arrivées à
 * leur jour et leur heure, chez les deux joueurs; lettres hebdomadaires de la
 * commande générée (tour 8, section 4.8), une instance par train.
 */
import { seasonOfDay } from '../donnees/calendrier';
import { currentOrder, isGeneratedOrder } from '../donnees/commandes';
import type { LetterDef } from '../donnees/types';
import { unitDraw } from '../etat/tirage';
import { evaluateAll, NO_CONTEXT } from './conditions';
import { type Sim, emit, format, itemName, notifyKey } from './contexte';
import { queueHint } from './astuces';
import { instanceId } from './semaine';

/** « 12 radis, 3 laitues, 6 œufs, 10 planches » (`textes.orderFormat`). */
export function orderText(sim: Sim): string {
  const f = sim.content.texts.orderFormat;
  const parts = currentOrder(sim.content.settings, sim.world).lines.map((line) =>
    format(f.line, { count: line.count, item: itemName(sim, line.item, line.count) }),
  );
  if (parts.length <= 1) return parts.join('');
  return `${parts.slice(0, -1).join(f.separator)}${f.lastSeparator}${parts[parts.length - 1] ?? ''}`;
}

/** Valeur des textes bruts (`textes.json`) au bout de `path`, ou `undefined`. */
function raw(sim: Sim, path: readonly string[]): unknown {
  let node: unknown = sim.content.texts.raw;
  for (const key of path) {
    if (typeof node !== 'object' || node === null) return undefined;
    node = (node as Record<string, unknown>)[key];
  }
  return node;
}

function rawString(sim: Sim, path: readonly string[], fallback: string): string {
  const value = raw(sim, path);
  return typeof value === 'string' ? value : fallback;
}

function rawStrings(sim: Sim, path: readonly string[]): string[] {
  const value = raw(sim, path);
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
}

/** « aucune ligne », « une ligne », « 3 lignes » (`textes.orderFormat.linesDone`). */
export function linesDoneText(sim: Sim, n: number): string {
  const key = n === 0 ? 'none' : n === 1 ? 'one' : 'many';
  return format(rawString(sim, ['orderFormat', 'linesDone', key], '{n}'), { n });
}

/** Variables communes des textes du courrier et des quêtes. */
export function textVars(sim: Sim): Record<string, string | number> {
  const s = sim.content.settings;
  const r = sim.world.orderResult;
  const linesDone = r?.linesDone ?? 0;
  return {
    startPurse: s.economy.startPurse,
    bigPurchase: s.economy.bigPurchaseThreshold,
    order: orderText(sim),
    linesDone,
    linesDoneText: linesDoneText(sim, linesDone),
    linesTotal: r?.linesTotal ?? currentOrder(s, sim.world).lines.length,
    amount: r?.amount ?? 0,
    day: currentOrder(s, sim.world).day,
  };
}

/**
 * Tirage par la graine parmi `count` possibilités, sans reprendre la dernière tirée pour `key`
 * (mémorisée dans `world.letterVariants`).
 */
function drawNoRepeat(
  sim: Sim,
  key: string,
  options: readonly number[],
  day: number,
): number | null {
  const last = sim.world.letterVariants[key];
  const pool = options.length > 1 ? options.filter((i) => i !== last) : options;
  if (pool.length === 0) return null;
  const pick =
    pool[Math.min(pool.length - 1, Math.floor(unitDraw(sim.world.seed, key, day) * pool.length))] ??
    null;
  if (pick !== null) sim.world.letterVariants[key] = pick;
  return pick;
}

/** Salutation de la lettre de commande: celles de toute saison et de la saison, jamais celle d'avant. */
function greeting(sim: Sim, day: number): string {
  const all = rawStrings(sim, ['orderGreetings', 'all']);
  const list = [
    ...all,
    ...rawStrings(sim, ['orderGreetings', seasonOfDay(sim.content.settings, day)]),
    // Tour 9: une salutation de plus par chantier bâti (les jardinières du quai).
    ...sim.content.improvements
      .filter((x) => (sim.world.improvements[x.id]?.builtDay ?? null) !== null)
      .flatMap((x) => rawStrings(sim, ['orderGreetings', 'improvements', x.id])),
  ];
  const index = drawNoRepeat(
    sim,
    'greeting',
    list.map((_, i) => i),
    day,
  );
  return index === null ? '' : (list[index] ?? '');
}

/** Conseil du produit de la commande qui demande le plus d'avance (à égalité, la première ligne). */
function tip(sim: Sim): string {
  const g = sim.content.settings.order.generated;
  if (g === null) return '';
  let best: { item: string; lead: number } | null = null;
  for (const line of currentOrder(sim.content.settings, sim.world).lines) {
    const lead = g.products.find((p) => p.item === line.item)?.leadDays ?? -1;
    if (best === null || lead > best.lead) best = { item: line.item, lead };
  }
  return best === null ? '' : rawString(sim, ['orderTips', best.item], '');
}

function deliver(
  sim: Sim,
  def: LetterDef,
  id: string,
  vars: Record<string, string | number>,
): void {
  const matching = def.variants
    .map((v, i) => ({ v, i }))
    .filter(({ v }) => evaluateAll(sim, v.when, NO_CONTEXT));
  let text = def.text;
  if (def.variantsNoRepeat && matching.length > 0) {
    const index = drawNoRepeat(
      sim,
      `letter:${def.id}`,
      matching.map((m) => m.i),
      sim.world.clock.day,
    );
    text = (index === null ? undefined : def.variants[index]?.text) ?? text;
  } else {
    text = matching[0]?.v.text ?? text;
  }
  const title = format(def.title, vars);
  sim.world.letters.push({
    id,
    day: sim.world.clock.day,
    title,
    from: sim.content.senders[def.from] ?? def.from,
    text: format(text, vars).trim(),
    read: [],
  });
  notifyKey(sim, 'both', 'letter', 'letter_received', { title });
  queueHint(sim, 'p1', { on: 'letter_received' });
  queueHint(sim, 'p2', { on: 'letter_received' });
  emit(sim, { type: 'letter', letter: id });
}

/**
 * Envoie une lettre. Une lettre unique ne part qu'une fois; une lettre hebdomadaire (`instance`)
 * part une fois par train, sous l'identifiant `<id>@<jour du train>`: celui de la commande payée
 * pour une lettre envoyée par un effet (le récapitulatif), celui de la commande en cours sinon.
 */
export function sendLetter(sim: Sim, id: string): void {
  const def = sim.content.letters[id];
  if (def === undefined) return;
  const vars = textVars(sim);
  if (def.instance === null) {
    if (sim.world.letters.some((l) => l.id === id)) return;
    deliver(sim, def, id, vars);
    return;
  }
  const paid = sim.world.orderResult;
  const train =
    def.instance.time === null && paid !== null
      ? paid.day
      : currentOrder(sim.content.settings, sim.world).day;
  const full = instanceId(id, train);
  if (sim.world.letters.some((l) => l.id === full)) return;
  const generated = sim.world.order.generated;
  if (generated !== null && generated.train === train) {
    if (generated.lettersSent.includes(id)) return;
    generated.lettersSent.push(id);
  }
  // La salutation se tire seulement pour une lettre qui la cite (sa mémoire est celle de la lettre de commande).
  const texts = [def.text, def.title, ...def.variants.map((v) => v.text)].join(' ');
  const extra: Record<string, string | number> = { day: train };
  if (texts.includes('{greeting}')) extra.greeting = greeting(sim, sim.world.clock.day);
  if (texts.includes('{tip}')) extra.tip = tip(sim);
  deliver(sim, def, full, { ...vars, ...extra });
}

/** Lettres datées dont l'heure est venue, et lettres hebdomadaires de la commande tirée. */
export function deliverScheduledLetters(sim: Sim): void {
  const { day, minutes } = sim.world.clock;
  const generated = isGeneratedOrder(sim.content.settings, sim.world)
    ? sim.world.order.generated
    : null;
  for (const def of Object.values(sim.content.letters)) {
    if (def.delivery !== null) {
      if (day > def.delivery.day || (day === def.delivery.day && minutes >= def.delivery.time))
        sendLetter(sim, def.id);
      continue;
    }
    const time = def.instance?.time ?? null;
    if (time === null || generated === null || generated.lettersSent.includes(def.id)) continue;
    // Le jour du tirage à l'heure dite, ou aussitôt après si la partie reprend plus tard.
    if (day > generated.drawnDay || (day === generated.drawnDay && minutes >= time))
      sendLetter(sim, def.id);
  }
}
