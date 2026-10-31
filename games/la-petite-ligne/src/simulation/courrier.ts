/**
 * Courrier (`courrier.json`): lettres envoyées par un effet ou arrivées à
 * leur jour et leur heure, chez les deux joueurs.
 */
import { evaluateAll, NO_CONTEXT } from './conditions';
import { type Sim, emit, format, itemName, notifyKey } from './contexte';
import { queueHint } from './astuces';

/** « 12 radis, 3 laitues, 6 œufs, 10 planches » (`textes.orderFormat`). */
export function orderText(sim: Sim): string {
  const f = sim.content.texts.orderFormat;
  const parts = sim.content.settings.order.lines.map((line) =>
    format(f.line, { count: line.count, item: itemName(sim, line.item, line.count) }),
  );
  if (parts.length <= 1) return parts.join('');
  return `${parts.slice(0, -1).join(f.separator)}${f.lastSeparator}${parts[parts.length - 1] ?? ''}`;
}

/** Variables communes des textes du courrier et des quêtes. */
export function textVars(sim: Sim): Record<string, string | number> {
  const s = sim.content.settings;
  const r = sim.world.orderResult;
  return {
    startPurse: s.economy.startPurse,
    bigPurchase: s.economy.bigPurchaseThreshold,
    order: orderText(sim),
    linesDone: r?.linesDone ?? 0,
    linesTotal: r?.linesTotal ?? s.order.lines.length,
    amount: r?.amount ?? 0,
  };
}

export function sendLetter(sim: Sim, id: string): void {
  const def = sim.content.letters[id];
  if (def === undefined || sim.world.letters.some((l) => l.id === id)) return;
  const variant = def.variants.find((v) => evaluateAll(sim, v.when, NO_CONTEXT));
  const text = format(variant?.text ?? def.text, textVars(sim));
  sim.world.letters.push({
    id,
    day: sim.world.clock.day,
    title: def.title,
    from: sim.content.senders[def.from] ?? def.from,
    text,
    read: [],
  });
  notifyKey(sim, 'both', 'letter', 'letter_received', { title: def.title });
  queueHint(sim, 'p1', { on: 'letter_received' });
  queueHint(sim, 'p2', { on: 'letter_received' });
  emit(sim, { type: 'letter', letter: id });
}

/** Lettres datées dont l'heure est venue. */
export function deliverScheduledLetters(sim: Sim): void {
  const { day, minutes } = sim.world.clock;
  for (const def of Object.values(sim.content.letters)) {
    if (def.delivery === null) continue;
    if (day > def.delivery.day || (day === def.delivery.day && minutes >= def.delivery.time)) {
      sendLetter(sim, def.id);
    }
  }
}
