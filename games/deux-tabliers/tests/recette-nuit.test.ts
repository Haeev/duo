// Recette de nuit (2026-11-08), non-régressions courtes. Un test `it.fails` décrit un bug connu
// sans correctif: il passe tant que le bug est là et échoue dès la correction (le passer en `it`).
import { createRandom } from '@duo/sdk';
import { describe, expect, it } from 'vitest';
import { extensionReady } from '../src/clientele/economie';
import { jumpToDay } from '../src/clientele';
import { loadContent } from '../src/donnees/charger';
import { DATA_FILES } from '../src/donnees/fichiers';
import { IDLE_INPUT } from '../src/simulation/entrees';
import type { GameEvent } from '../src/simulation/evenements';
import { createWorld } from '../src/simulation/monde';
import { stepWorld, type QueuedIntent } from '../src/simulation/pas';
import type { SimContext } from '../src/simulation/systemes';

const DT = 1 / 60;

describe('Deux Tabliers, recette de nuit', () => {
  // Bug RN-01 (rapport docs/jeux/cosy-cafe/recette/2026-11-08-nuit.md): la tablette achète la
  // terrasse par `amenagement-acheter` (identifiant `village-terrasse`), la clientèle ne la
  // connaît que sous `village_terrasse` dans `clientele.purchases`: pas de places dehors, pas
  // d'averse, fête jamais « Formidable ».
  it.fails(
    'RN-01: la terrasse achetée à la tablette est ouverte pour la clientèle le lendemain',
    () => {
      const content = loadContent(DATA_FILES);
      const world = createWorld(content, ['a', 'b']);
      const random = createRandom(5);
      const events: GameEvent[] = [];
      const step = (intents: QueuedIntent[] = []): void => {
        stepWorld(content, world, [IDLE_INPUT, IDLE_INPUT], intents, DT, random, (e) =>
          events.push(e),
        );
      };
      const sim: SimContext = {
        world,
        content,
        dt: DT,
        random,
        inputs: [IDLE_INPUT, IDLE_INPUT],
        emit: (e) => events.push(e),
      };
      step();
      jumpToDay(sim, 7);
      step();
      world.clientele.cash += 100_000;
      step([
        {
          player: 0,
          intent: { type: 'amenagement-acheter', item: 'village-terrasse', room: null },
        },
      ]);
      step([{ player: 1, intent: { type: 'amenagement-repondre', accept: true } }]);
      expect(events.some((e) => e.type === 'amenagement-achat')).toBe(true);
      jumpToDay(sim, 9);
      for (let i = 0; i < 5; i++) step();
      expect(world.arrangement.extensions).toContain('village-terrasse');
      expect(extensionReady(world.clientele, 'village_terrasse')).toBe(true);
    },
  );
});

describe('Deux Tabliers, recette de nuit (tickets)', () => {
  // Bug RN-02: les tickets des groupes repartis sans être servis restent sur le rail le
  // lendemain (aucun ménage à la fermeture); le domaine du service grossit de jour en jour.
  it.fails(
    'RN-02: le rail est vide au matin suivant quand personne n’a préparé',
    () => {
      const content = loadContent(DATA_FILES);
      const world = createWorld(content, ['a', 'b']);
      const random = createRandom(9);
      const step = (intents: QueuedIntent[] = []): void => {
        stepWorld(content, world, [IDLE_INPUT, IDLE_INPUT], intents, DT, random, () => undefined);
      };
      const both = (topic: 'next-day' | 'open'): void => {
        step([
          { player: 0, intent: { type: 'clientele-vote', topic, yes: true } },
          { player: 1, intent: { type: 'clientele-vote', topic, yes: true } },
        ]);
      };
      step();
      both('next-day');
      both('open');
      let maxTickets = 0;
      for (let i = 0; i < 60 * 60 * 15 && world.clientele.phase !== 'evening'; i++) {
        // Les commandes sont prises à la caisse (interface), personne ne prépare.
        const atRegister = world.clientele.groups.some((g) => g.stage === 'register');
        step(
          atRegister && i % 120 === 0
            ? [{ player: 0, intent: { type: 'clientele-take-order' } }]
            : [],
        );
        maxTickets = Math.max(maxTickets, world.service.tickets.length);
      }
      expect(world.clientele.phase).toBe('evening');
      expect(maxTickets).toBeGreaterThan(0);
      both('next-day');
      for (let i = 0; i < 10; i++) step();
      expect(world.clientele.phase).toBe('prep');
      expect(world.service.tickets).toEqual([]);
    },
    60_000,
  );
});
