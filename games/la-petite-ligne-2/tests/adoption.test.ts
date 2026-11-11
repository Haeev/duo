// Effet `adopt_animal` (bête offerte par l'histoire): une espèce, un abri et un dialogue factices
// ajoutés par les seules données font arriver une bête nommée, une seule fois; les deux poules
// d'Odette arrivent au poulailler du jardin d'Aubrune.
import { describe, expect, it } from 'vitest';
import { loadContent } from '../src/donnees/charger';
import type { Effect } from '../src/donnees/schemas/regles';
import { shelterView } from '../src/simulation/elevage/abri';
import { applyEffects } from '../src/simulation/regles/effets';
import { act, contentWith, contextOf, wait } from './aides-l3';
import { NORTH, put, run } from './aides-noyau';
import { dataFiles, newSim } from './aides';

type Json = Record<string, unknown>;

/** Lapin, clapier et dialogue de la cheffe de gare, en données seulement. */
function rabbitFiles(adopt: Json): Record<string, unknown> {
  const files = dataFiles() as Record<string, Json>;
  files['commun/especes/lapin-d-essai.json'] = {
    ...files['commun/especes/poule.json'],
    id: 'lapin-d-essai',
    name: 'Lapin',
    robes: [
      { id: 'grise', name: 'Grise', color: '#888888' },
      { id: 'blanche', name: 'Blanche', color: '#f4f4f4' },
    ],
    names: ['Pompon'],
  };
  const coop = files['commun/meubles/poulailler-d-essai.json'] as { bricks: Json[] };
  files['commun/meubles/clapier-d-essai.json'] = {
    ...coop,
    id: 'clapier-d-essai',
    name: 'Clapier',
    bricks: [{ ...coop.bricks[0], species: 'lapin-d-essai', starters: [] }],
  };
  (files['lieux/essai-gare/carte.json'] as { objects: unknown[] }).objects.push({
    id: 'clapier',
    type: 'clapier-d-essai',
    x: 30.5,
    y: 27,
    rotation: 1,
  });
  files['lieux/essai-gare/dialogues/lapin-offert.json'] = {
    schema: 1,
    id: 'lapin-offert',
    villager: 'cheffe-de-gare',
    priority: 99,
    when: [],
    once: null,
    start: 'don',
    nodes: {
      don: { kind: 'effects', effects: [adopt], next: 'merci' },
      merci: {
        kind: 'line',
        speaker: 'cheffe-de-gare',
        text: 'Il s’appelle Caramel. Prends-en soin.',
        emote: 'joy',
        next: null,
      },
    },
  };
  return files;
}

const CARAMEL = {
  type: 'adopt_animal',
  species: 'lapin-d-essai',
  name: 'Caramel',
  shelter: 'clapier',
  robe: 'blanche',
};

describe('bête offerte par l’histoire', () => {
  it('un lapin factice arrive au clapier par un dialogue, une seule fois', () => {
    const sim = newSim(loadContent(rabbitFiles(CARAMEL)));
    run(sim, 1 / 30);
    for (const player of [0, 1] as const) {
      put(sim, player, 20, 16, NORTH);
      act(sim, player, { type: 'act' });
      expect(sim.world.players[player].talk?.dialogue).toBe('lapin-offert');
      act(sim, player, { type: 'talk_next' });
    }
    const view = shelterView(sim, 'clapier');
    expect(view?.animals.map((a) => [a.name, a.robe])).toEqual([['Caramel', 'blanche']]);
  });

  it('le validateur refuse une espèce qui ne vit pas dans cet abri', () => {
    expect(() => loadContent(rabbitFiles({ ...CARAMEL, species: 'poule' }))).toThrow(
      /n'est pas un abri pour l'espèce « poule »/,
    );
    expect(() => loadContent(rabbitFiles({ ...CARAMEL, shelter: 'nulle-part' }))).toThrow(
      /abri « nulle-part » absent/,
    );
  });

  it('Pimprenelle et Capucine arrivent au poulailler du jardin quand on dit oui à Odette', () => {
    const content = contentWith((files) => {
      const settings = files['commun/reglages.json'] as { start: Json };
      settings.start = { ...settings.start, place: 'aubrune', minute: 600 };
    });
    const sim = newSim(content);
    wait(sim, 0.1);
    const dialogue = content.places.aubrune?.dialogues.find((d) => d.id === 'odette-poules');
    const choice = dialogue?.nodes.choix;
    if (choice?.kind !== 'choice') throw new Error('choix des poules absent');
    const yes: readonly Effect[] = choice.options.find((o) => o.id === 'oui')?.effects ?? [];
    applyEffects(contextOf(sim), 0, yes);
    // Les deux joueurs disent oui: toujours deux poules.
    applyEffects(contextOf(sim), 1, yes);
    const view = shelterView(sim, 'poulailler-jardin');
    expect(view?.animals.map((a) => a.name)).toEqual(['Pimprenelle', 'Capucine']);
  });
});
