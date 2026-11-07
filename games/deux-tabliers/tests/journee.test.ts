// Branchement (quelques secondes): une journée accélérée de bout en bout par le vrai chemin, à
// deux joueurs. Les deux disent « À demain » le lundi, écrivent l'ardoise, votent « On ouvre ? »;
// un client entre, l'hôte prend sa commande à la caisse (ticket et encaissement), l'invité
// dresse le croissant jusqu'au passe, le client est servi et s'assoit, repart; sa vaisselle est
// sale sur la table; la fermeture mène au bilan du soir, puis au jour suivant.
import { createRandom } from '@duo/sdk';
import { describe, expect, it } from 'vitest';
import { serviceId } from '../src/branchement';
import { loadContent } from '../src/donnees/charger';
import { DATA_FILES } from '../src/donnees/fichiers';
import type { PlayerIndex, World } from '../src/etat/monde';
import type { Intent, StepInput, Target } from '../src/simulation/entrees';
import type { GameEvent } from '../src/simulation/evenements';
import { createWorld, heldObject } from '../src/simulation/monde';
import { stepWorld } from '../src/simulation/pas';

const DT = 1 / 60;

/** Journée accélérée: une minute de jeu en 0,05 s (le service dure 30 s). */
function fastContent(): ReturnType<typeof loadContent> {
  const days = DATA_FILES['clientele/journees.json'] as Record<string, unknown>;
  return loadContent({
    ...DATA_FILES,
    'clientele/journees.json': {
      ...days,
      secondsPerGameMinute: 0.05,
      peacefulSecondsPerGameMinute: 0.06,
    },
  });
}

describe('Deux Tabliers, une journée branchée', () => {
  it('a le même catalogue au service et à la clientèle', () => {
    const content = loadContent(DATA_FILES);
    for (const r of content.clientele.recipeList)
      expect(content.service.recipes.has(serviceId(r.id)), r.id).toBe(true);
    for (const i of content.clientele.supplies.ingredients)
      expect(content.service.ingredients.has(serviceId(i.id)), i.id).toBe(true);
  });

  it('du lundi au bilan du mardi, puis le mercredi', () => {
    const content = fastContent();
    const world: World = createWorld(content, ['a', 'b']);
    const events: GameEvent[] = [];
    const random = createRandom(11);
    const input = (actHeld: boolean): StepInput => ({
      seq: 0,
      moveX: 0,
      moveZ: 0,
      fast: false,
      yawDeg: 180,
      pitchDeg: 0,
      actHeld,
    });
    const steps = (
      n: number,
      held: PlayerIndex | null = null,
      intents: Intent[] = [],
      by: PlayerIndex = 0,
    ): void => {
      for (let i = 0; i < n; i++) {
        const queued = i === 0 ? intents.map((intent) => ({ player: by, intent })) : [];
        stepWorld(content, world, [input(held === 0), input(held === 1)], queued, DT, random, (e) =>
          events.push(e),
        );
      }
    };
    const act = (player: PlayerIndex, target: Target, holdSeconds = 0): void => {
      steps(
        Math.max(1, Math.round(holdSeconds / DT)),
        holdSeconds > 0 ? player : null,
        [{ type: 'act', target }],
        player,
      );
      steps(1);
    };
    const drop = (player: PlayerIndex, target: Target): void => {
      steps(1, null, [{ type: 'drop', target }], player);
    };
    const at = (player: PlayerIndex, x: number, z: number): void => {
      world.players[player].x = x;
      world.players[player].z = z;
    };
    const vote = (topic: 'open' | 'next-day'): void => {
      steps(1, null, [{ type: 'clientele-vote', topic, yes: true }], 0);
      steps(1, null, [{ type: 'clientele-vote', topic, yes: true }], 1);
    };
    const until = (cond: () => boolean, maxSeconds: number): void => {
      for (let i = 0; i < maxSeconds / DT && !cond(); i++) steps(1);
      expect(cond()).toBe(true);
    };
    const c = world.clientele;
    const station = (furniture: string): Target => ({ kind: 'station', furniture });
    const slot = (furniture: string, id: string): Target => ({ kind: 'slot', furniture, slot: id });

    // Lundi 1, café fermé: « À demain » à deux mène au mardi.
    steps(1);
    expect(c.day).toBe(1);
    expect(c.phase).toBe('monday');
    vote('next-day');
    expect(c.day).toBe(2);
    expect(c.phase).toBe('prep');

    // L'ardoise du jour: l'espresso seul; « On ouvre ? » à deux.
    steps(1, null, [{ type: 'clientele-slate', lines: [['espresso', 0]] }], 1);
    expect(c.slate).toEqual([['espresso', 0]]);
    vote('open');
    expect(c.phase).toBe('service');
    // Un voisin entre tout de suite (le reste de la journée garde ses arrivées tirées au sort).
    c.arrivals = [[0, 'voisins', 1, false]];
    const cashBefore = c.cash;

    // Il arrive à la caisse: sa commande attend au service.
    until(() => world.service.waiting.length > 0, 20);
    const group = c.groups[0];
    if (group === undefined) throw new Error('aucun client');
    expect(group.stage).toBe('register');
    c.arrivals = [];

    // L'hôte tient Agir sur la caisse: ticket au rail, le client paie.
    at(0, 10.4, 8.3);
    act(0, station('station-6'), 3);
    steps(2);
    expect(world.service.tickets).toHaveLength(1);
    expect(group.paid).toBe(140);
    const materials = Math.round(
      (content.clientele.recipes.get('espresso')?.costMaterials ?? 0) * 100,
    );
    expect(c.cash).toBe(cashBefore + 140 - materials);
    expect(events.some((e) => e.type === 'service-order-taken' && e.player === 0)).toBe(true);

    // L'invité: une tasse sous le groupe, une dose au moulin, l'extraction arrêtée à 12,8 s
    // (« Parfait »), la tasse sur le passe.
    at(1, 9.6, 7.95);
    act(1, station('pile-tasses-1'));
    at(1, 9.0, 8.3);
    drop(1, slot('groupe-1', 'bec'));
    at(1, 9.8, 8.3);
    act(1, station('station-5'), 2.6);
    at(1, 9.0, 8.3);
    act(1, station('groupe-1'));
    steps(Math.round(12.8 / DT));
    act(1, station('groupe-1'));
    const cup =
      heldObject(world, 1) ??
      world.objects.find((o) => o.at.kind === 'slot' && o.at.furniture === 'groupe-1');
    if (cup === undefined) throw new Error('tasse absente');
    if (cup.at.kind !== 'hand') act(1, { kind: 'object', id: cup.id });
    at(1, 8.4, 8.3);
    drop(1, slot('station-3', 'p1'));
    steps(3);
    // Servi: le ticket quitte le rail, le client va s'asseoir avec son croissant.
    expect(world.service.tickets).toHaveLength(0);
    expect(group.servedAt).not.toBeNull();
    expect(c.today.served).toBe(1);
    expect(events.some((e) => e.type === 'clientele-served')).toBe(true);

    // La fermeture, le départ des clients, le bilan du soir.
    until(() => c.phase === 'evening', 120);
    expect(c.report?.served).toBe(1);
    expect(c.report?.revenue).toBe(140);
    // Il a laissé sa tasse sur sa table: elle est sale (ou bue au comptoir, à la plonge).
    const left = world.objects.find((o) => o.id === cup.id);
    expect(left === undefined || left.type === 'tasse-sale').toBe(true);

    // « À demain » à deux: le mercredi se lève.
    vote('next-day');
    expect(c.day).toBe(3);
    expect(c.phase).toBe('prep');
    expect(events.filter((e) => e.type === 'refused')).toEqual([]);
  });
});
