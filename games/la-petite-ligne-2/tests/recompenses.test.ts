// Effets de récompense (recette, plan, entrée de collection, pièce de tenue): une quête factice
// faite des gabarits les donne tous les quatre; ils s'annoncent et tiennent dans la progression.
import { fileURLToPath } from 'node:url';
import * as v from 'valibot';
import { describe, expect, it } from 'vitest';
import { ContentError, loadContent, type Content } from '../src/donnees/charger';
import type { Catalogue, PieceDef } from '../src/donnees/schemas/personnage';
import { ProgressSchema } from '../src/etat/progression';
import { isFound } from '../src/simulation/collections/registre';
import { isKnown } from '../src/simulation/cuisine/recettes';
import { isPlanKnown } from '../src/simulation/fabrication/plans';
import { GameEventSchema } from '../src/simulation/noyau/evenements';
import { isPieceOwned, WARDROBE, wardrobeOf } from '../src/simulation/regles/recompenses';
import { plan } from '../outils/nouveau';
import { send } from './aides-noyau';
import { wait } from './aides-l3';
import { dataFiles, newSim } from './aides';

type Json = Record<string, unknown>;
const TEMPLATE_DIR = fileURLToPath(new URL('../donnees/_gabarits/', import.meta.url));
const REWARDS = [
  { type: 'give_recipe', recipe: 'soupe-factice' },
  { type: 'give_plan', plan: 'petrin-factice' },
  { type: 'give_entry', entry: 'carte-factice' },
  { type: 'give_piece', piece: 'chapeau-factice' },
];

/** Les gabarits copiés tels quels, plus une quête d'une étape (être ensemble) qui donne `rewards`. */
function filesWith(rewards: readonly Json[]): Record<string, Json> {
  const files = dataFiles() as Record<string, Json>;
  const add = (type: string, id: string, place: string | null): Json => {
    let made: Json = {};
    for (const file of plan(TEMPLATE_DIR, type, id, place)) {
      made = file.value;
      if (file.array === null) files[file.path] = file.value;
      else (files[file.path]?.[file.array] as Json[]).push(file.value);
    }
    return made;
  };
  add('recette', 'soupe-factice', null);
  add('plan', 'petrin-factice', null).source = 'quest';
  add('entree-de-collection', 'carte-factice', null);
  const catalogue = files['commun/personnages/catalogue.json'] as unknown as Catalogue;
  const hat = catalogue.pieces.find((p) => p.slot === 'hat');
  if (hat === undefined) throw new Error('aucun chapeau au catalogue');
  const reward: PieceDef = {
    ...hat,
    id: 'chapeau-factice',
    name: 'Chapeau factice',
    tags: [WARDROBE.lockedTag],
  };
  files['commun/personnages/catalogue.json'] = {
    ...catalogue,
    pieces: [...catalogue.pieces, reward],
  };
  const quest = add('quete', 'quete-factice', 'essai-gare');
  const chapter = (quest.chapters as Json[])[0];
  const step = (chapter?.steps as Json[])[0];
  if (chapter === undefined || step === undefined) throw new Error('gabarit de quête vide');
  Object.assign(step, { done: [{ type: 'together' }], target: null, onDone: rewards });
  chapter.steps = [step];
  return files;
}

function problems(rewards: readonly Json[]): string {
  try {
    loadContent(filesWith(rewards));
  } catch (error) {
    if (error instanceof ContentError) return error.problems.join('\n');
    throw error;
  }
  return '';
}

describe('effets de récompense', () => {
  const content: Content = loadContent(filesWith(REWARDS));
  const hat = content.pieces['chapeau-factice'];
  const recipe = content.recipes['soupe-factice'];
  const craft = content.plans['petrin-factice'];
  if (hat === undefined || recipe === undefined || craft === undefined)
    throw new Error('exemplaires factices absents');

  it('l’étape franchie donne recette, plan, entrée et pièce, et les annonce', () => {
    const sim = newSim(content);
    expect(isKnown(sim.world, recipe)).toBe(false);
    expect(isPlanKnown(sim.world, craft)).toBe(false);
    expect(isPieceOwned(sim.world, hat)).toBe(false);
    expect(wardrobeOf(content.catalogue, sim.world).pieces).not.toContainEqual(hat);
    const events = wait(sim, 0.5);
    for (const [kind, id] of [
      ['recipe', 'soupe-factice'],
      ['plan', 'petrin-factice'],
      ['piece', 'chapeau-factice'],
    ])
      expect(events).toContainEqual({ type: 'reward_given', by: 0, kind, id });
    expect(events).toContainEqual(
      expect.objectContaining({ type: 'collection_found', entry: 'carte-factice', first: true }),
    );
    for (const event of events) expect(v.is(GameEventSchema, event)).toBe(true);
    expect(isKnown(sim.world, recipe)).toBe(true);
    expect(isPlanKnown(sim.world, craft)).toBe(true);
    expect(isFound(sim.world, 'carte-factice')).toBe(true);
    expect(wardrobeOf(content.catalogue, sim.world).pieces).toContainEqual(hat);
    // Tout tient dans la progression (sauvegarde et réseau): elle reste valide.
    expect(v.is(ProgressSchema, sim.world.progress)).toBe(true);
  });

  it('une pièce à gagner ne se porte qu’une fois gagnée', () => {
    const sim = newSim(content);
    const look = {
      shape: content.catalogue.shapes[0]?.id ?? '',
      skin: 0,
      pieces: [{ slot: 'hat' as const, id: 'chapeau-factice', colors: [] }],
    };
    expect(send(sim, 0, { type: 'set_look', name: 'Ada', look })).toContainEqual({
      type: 'refused',
      player: 0,
      reason: 'piece-locked',
      target: 'chapeau-factice',
    });
    wait(sim, 0.5);
    send(sim, 0, { type: 'set_look', name: 'Ada', look });
    expect(sim.world.players[0].look?.pieces).toContainEqual(
      expect.objectContaining({ id: 'chapeau-factice' }),
    );
  });

  it('refuse au chargement ce qui ne peut pas se donner', () => {
    expect(problems([{ type: 'give_recipe', recipe: 'inconnue' }])).toContain('recette inconnue');
    expect(problems([{ type: 'give_plan', plan: 'inconnu' }])).toContain('plan inconnu');
    expect(problems([{ type: 'give_entry', entry: 'inconnue' }])).toContain(
      'entrée de collection inconnue',
    );
    const worn = Object.values(content.pieces).find((p) => p.tags.length === 0 || p.slot === 'top');
    expect(problems([{ type: 'give_piece', piece: worn?.id ?? '' }])).toContain(
      "n'est pas à gagner",
    );
  });
});
