/**
 * Tutoriel doux (`astuces.json`): une astuce par déclencheur, une fois chez
 * chaque joueur, une seule à l'écran à la fois (file d'attente).
 */
import type { CharacterId } from '../etat/types';
import type { HintTrigger } from '../donnees/types';
import { type Sim, character, notify, secondsToTicks } from './contexte';

/** Déclencheur observé (mêmes formes que ceux des données, avec ce qui est tenu en main). */
export type HintSignal =
  | Exclude<HintTrigger, { on: 'aim_cell' }>
  | { on: 'aim_cell'; cellState: 'grass' | 'tilled'; tool: string | null; holding: string | null };

function matches(trigger: HintTrigger, signal: HintSignal): boolean {
  if (trigger.on !== signal.on) return false;
  switch (trigger.on) {
    case 'near_point':
      return signal.on === 'near_point' && signal.point === trigger.point;
    case 'quest_started':
      return signal.on === 'quest_started' && signal.quest === trigger.quest;
    case 'tool_empty':
      return signal.on === 'tool_empty' && signal.item === trigger.item;
    case 'time_reached':
      return signal.on === 'time_reached' && signal.time === trigger.time;
    case 'aim_cell':
      return (
        signal.on === 'aim_cell' &&
        signal.cellState === trigger.cellState &&
        (trigger.tool === undefined || signal.tool === trigger.tool) &&
        (trigger.holding === undefined || signal.holding === trigger.holding)
      );
    case 'spawned':
    case 'near_interactable':
    case 'tool_used':
    case 'near_construction':
    case 'sowed':
    case 'crop_ripe_in_view':
    case 'veillee_started':
    case 'holding_furniture':
    case 'big_purchase_attempt':
    case 'letter_received':
    case 'near_forage':
    case 'aim_sapling':
    case 'near_board_annonce':
    case 'fishing_hot_spot':
    case 'fishing_watch':
    case 'plot_free':
    case 'plot_drag':
    case 'plot_placed':
    case 'near_friche':
    case 'plot_migration':
      return true;
  }
}

/** Met en file les astuces que ce signal déclenche chez ce joueur. */
export function queueHint(sim: Sim, who: CharacterId, signal: HintSignal): void {
  const c = character(sim, who);
  for (const hint of sim.content.hints) {
    if (c.hintsShown.includes(hint.id) || c.hintQueue.includes(hint.id)) continue;
    if (matches(hint.trigger, signal)) c.hintQueue.push(hint.id);
  }
}

/** Montre l'astuce suivante quand la précédente a fini son temps d'affichage. */
export function pumpHints(sim: Sim): void {
  const duration = secondsToTicks(sim.content.settings.hints.durationSeconds);
  for (const c of sim.world.characters) {
    if (c.hintQueue.length === 0 || sim.world.tick - c.lastHintTick < duration) continue;
    if (c.status === 'breakfast' || c.status === 'night' || !c.created) continue;
    const id = c.hintQueue.shift();
    const def = sim.content.hints.find((h) => h.id === id);
    if (id === undefined || def === undefined) continue;
    c.hintsShown.push(id);
    c.lastHintTick = sim.world.tick;
    notify(sim, c.id, 'hint', def.text, { hint: id });
  }
}
