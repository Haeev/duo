/**
 * Fin de la démo (effet `end_demo`): écran de fin et récapitulatif.
 */
import { type Sim, emit } from './contexte';
import { QUEST } from './ids';

/** Faits marquants de la séance, 60 caractères au plus (SV-07). */
const HIGHLIGHT_MAX = 60;

export function finishDemo(sim: Sim): void {
  const { world } = sim;
  if (world.phase === 'ended') return;
  // La démo ne finit qu'au dernier train: un `end_demo` resté dans la semaine 1 ne fait rien.
  if (world.clock.day < sim.content.settings.clock.lastDay.day) return;
  const keyFound = world.quests.some((q) => q.id === QUEST.riddle && q.status === 'done');
  const orders = sim.content.settings.order.trains.map((o, i) => {
    const paid = world.orderHistory[i];
    return { linesDone: paid?.linesDone ?? 0, linesTotal: paid?.linesTotal ?? o.lines.length };
  });
  world.ending = {
    days: world.clock.day,
    linesDone: orders.reduce((n, o) => n + o.linesDone, 0),
    linesTotal: orders.reduce((n, o) => n + o.linesTotal, 0),
    orders,
    furniturePlaced: world.furniture.filter((f) => f.placedBy !== null).length,
    keyFound,
  };
  world.phase = 'ended';
  world.clock.running = false;
  world.clock.stoppedBy = 'ended';
  for (const c of world.characters) {
    c.menu = null;
    c.status = 'active';
  }
  const quest = sim.content.quests.find((q) => q.id === QUEST.order);
  if (quest !== undefined) addHighlight(sim, quest.title);
  emit(sim, { type: 'demo_ended' });
}

export function addHighlight(sim: Sim, text: string): void {
  const list = sim.world.session.highlights;
  const short = text.length > HIGHLIGHT_MAX ? text.slice(0, HIGHLIGHT_MAX) : text;
  if (!list.includes(short) && list.length < 3) list.push(short);
}
