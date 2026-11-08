// Carnet de séance: légende et instantané joints à une note (test court, sans DOM ni rendu).
import { describe, expect, it } from 'vitest';
import { wireInterface } from '../src/branchement/interface';
import { loadContent } from '../src/donnees/charger';
import { DATA_FILES } from '../src/donnees/fichiers';
import { createNotebookSource } from '../src/plateforme/carnet';
import type { GameView } from '../src/reseau/vue';
import { createWorld } from '../src/simulation/monde';

const content = loadContent(DATA_FILES);

function setup(): {
  source: ReturnType<typeof createNotebookSource>;
  world: ReturnType<typeof createWorld>;
} {
  const world = createWorld(content, ['membre-a', 'membre-b']);
  const view: GameView = {
    content,
    local: 1,
    world: () => world,
    pose: (player) => {
      const p = world.players[player];
      return { x: p.x, z: p.z, yawDeg: p.yawDeg, pitchDeg: p.pitchDeg };
    },
    onEvent: () => () => undefined,
  };
  const wired = wireInterface(view);
  const source = createNotebookSource({
    view,
    canvas: {} as HTMLCanvasElement,
    role: 'guest',
    look: () => ({ yawDeg: 92.4, pitchDeg: -10 }),
    clock: (w) => wired.sources.clock?.(w, content) ?? null,
  });
  return { source, world };
}

describe('carnet de séance', () => {
  it('légende: jour, jour de la semaine, heure, phase, adresse, position, regard, main, téléphone', () => {
    const { source, world } = setup();
    world.clientele.day = 3;
    world.clientele.phase = 'service';
    world.clientele.serviceSec = 0;
    world.players[1].x = 1.25;
    world.players[1].z = -2.5;
    world.objects.push({ id: 999, type: 'tasse', at: { kind: 'hand', player: 1 } });
    world.clientele.uiPlaces = [null, 'Sur son téléphone : Catalogue'];
    const caption = source.caption?.() ?? '';
    expect(caption).toMatch(/^Jour 3, mercredi, \d+ h \d{2} \(service\)/);
    expect(caption).toContain(world.address);
    expect(caption).toContain('x 1,3 z -2,5, regard 92° / -10°');
    expect(caption).toContain('en main : tasse');
    expect(caption).toContain('téléphone : Catalogue');

    world.clientele.phase = 'closing';
    world.clientele.uiPlaces = [null, null];
    world.objects.pop();
    const closing = source.caption?.() ?? '';
    expect(closing).toContain('(fermeture)');
    expect(closing).toContain('mains vides');
    expect(closing).toContain('téléphone rangé');
  });

  it('instantané: café, clients, tickets, propositions, sans identifiant ni prénom', () => {
    const { source, world } = setup();
    world.clientele.day = 2;
    world.clientele.phase = 'prep';
    world.clientele.cash = 12345;
    world.clientele.proposals = [{ by: 0, item: 'banquette', price: 4500 }];
    const snap = source.snapshot?.() as Record<string, unknown>;
    expect(snap.jour).toBe(2);
    expect(snap.jourDeLaSemaine).toBe('mardi');
    expect(snap.caisse).toBe('123,45 €');
    expect(snap.propositions).toEqual([{ par: 0, objet: 'banquette', prix: 4500 }]);
    expect(Array.isArray(snap.clients)).toBe(true);
    expect(Array.isArray(snap.tickets)).toBe(true);
    const text = JSON.stringify(snap);
    expect(text).not.toContain('membre-a');
    expect(text).not.toContain('membre-b');
    // L'instantané part en JSON: il doit s'y lire sans perte.
    expect(JSON.parse(text)).toEqual(snap);
  });
});
