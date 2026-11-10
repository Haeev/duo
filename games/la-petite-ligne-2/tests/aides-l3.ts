/** Aides des tests du lot L3: contexte de système hors du pas, contenu retouché, avance rapide. */
import { loadContent, type Content } from '../src/donnees/charger';
import type { PlayerIndex } from '../src/donnees/schemas/communs';
import { SIM_DT } from '../src/simulation/noyau/constantes';
import { idleInput, type Intent, type StepInput } from '../src/simulation/noyau/entrees';
import { step, type Sim } from '../src/simulation/noyau/pas';
import type { SimContext } from '../src/simulation/noyau/systemes';
import { dataFiles, newSim } from './aides';

type Json = Record<string, unknown>;

/** Contenu du jeu après retouche des fichiers (un objet, un meuble, un dialogue ajoutés par le test). */
export function contentWith(edit: (files: Record<string, Json>) => void): Content {
  const files = dataFiles() as Record<string, Json>;
  edit(files);
  return loadContent(files);
}

/** Un meuble de rangement et un banc posés sur la carte de la gare d'essai, à côté du départ. */
export function withTestProps(files: Record<string, Json>): void {
  files['commun/meubles/coffre-essai.json'] = {
    schema: 1,
    id: 'coffre-essai',
    name: 'Coffre',
    model: 'coffre',
    size: { w: 1, h: 1 },
    solid: true,
    placeable: true,
    series: null,
    bricks: [{ brick: 'store', slots: 3 }],
  };
  const objects = files['lieux/essai-gare/carte.json']?.objects as Json[];
  objects.push({ id: 'coffre', type: 'coffre-essai', x: 19.5, y: 21, rotation: 0 });
  objects.push({ id: 'banc', type: 'banc', x: 24, y: 24, rotation: 0 });
}

/** Contexte d'un système, comme dans `step`, avec les événements et les tranches touchées. */
export function contextOf(sim: Sim): SimContext & { touched: Set<string> } {
  const touched = new Set<string>();
  const inputs: [StepInput, StepInput] = [idleInput(0), idleInput(0)];
  return {
    world: sim.world,
    content: sim.content,
    dt: SIM_DT,
    random: sim.random,
    inputs,
    emit(event) {
      sim.events.push(event);
    },
    touch(slice) {
      touched.add(slice);
      sim.revisions[slice] += 1;
    },
    touched,
  };
}

/** Un pas avec ces intentions; renvoie les événements du pas. */
export function act(sim: Sim, player: PlayerIndex, ...intents: Intent[]): Sim['events'] {
  step(
    sim,
    [idleInput(sim.world.tick), idleInput(sim.world.tick)],
    intents.map((intent) => ({ player, intent })),
  );
  return [...sim.events];
}

/** Avance de `seconds` secondes réelles, sans intention; renvoie tous les événements nés. */
export function wait(sim: Sim, seconds: number, inputs?: [StepInput, StepInput]): Sim['events'] {
  const events: Sim['events'] = [];
  const steps = Math.round(seconds / SIM_DT);
  for (let i = 0; i < steps; i++) {
    step(sim, inputs ?? [idleInput(sim.world.tick), idleInput(sim.world.tick)], []);
    events.push(...sim.events);
  }
  return events;
}

export { newSim };
