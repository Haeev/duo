// Faim ou sommeil à 0 (cahier 4.4, CA-09): la touche d'action ne sert plus qu'à ce qui soulage le
// besoin, le refus dit quoi faire, et un joueur affamé sans un sou a toujours une issue.
import { describe, expect, it } from 'vitest';
import type { Content } from '../src/donnees/charger';
import { refusalText, TEXTS } from '../src/interface/textes';
import { aimOf } from '../src/simulation/briques/visee';
import { predictedGesture } from '../src/simulation/briques/geste';
import { remember } from '../src/simulation/regles/memoire';
import { act, contentWith, contextOf, wait } from './aides-l3';
import { put, SOUTH } from './aides-noyau';
import { visit } from './aides-visite';
import { gameContent, newSim } from './aides';

const content = gameContent();

function hold(sim: ReturnType<typeof newSim>, item: string): void {
  sim.world.players[0].toolbar[0] = { item, count: 1 };
  sim.world.players[0].selected = 0;
}

describe('besoin à 0', () => {
  it('faim à 0: l’arbre refuse avec ce qu’il faut faire, manger rouvre le geste', () => {
    const sim = newSim(content);
    hold(sim, 'hache');
    put(sim, 0, 3.5, 35.4, SOUTH);
    sim.world.players[0].needs.hunger = 0;
    wait(sim, 0.1);
    expect(sim.world.players[0].tiers.hunger).toBe('blocked');
    const aim = aimOf(sim, 0);
    expect(aim).toMatchObject({ id: 'chene', refusal: 'exhausted-hunger' });
    expect(refusalText('exhausted-hunger')).not.toBe(TEXTS.refusalDefault);
    // L'invité prédit le même refus: aucun geste joué chez lui.
    expect(predictedGesture(sim, 0, { type: 'act' })).toBeNull();
    const events = act(sim, 0, { type: 'act' });
    expect(events).toContainEqual(
      expect.objectContaining({ type: 'refused', reason: 'exhausted-hunger' }),
    );
    expect(sim.world.players[0].gesture).toBeNull();
    // Manger un plat du sac reste permis, et relève la jauge: l'arbre redevient une cible.
    sim.world.players[0].toolbar[1] = { item: 'pomme', count: 1 };
    const ate = act(sim, 0, { type: 'eat', from: { area: 'toolbar', index: 1 } });
    expect(ate).toContainEqual(expect.objectContaining({ type: 'ate', player: 0 }));
    wait(sim, 0.1);
    expect(aimOf(sim, 0)?.refusal).toBeNull();
  });

  it('sommeil à 0: le travail est refusé, s’asseoir reste permis; les intentions de travail aussi', () => {
    const sim = newSim(content);
    hold(sim, 'hache');
    put(sim, 0, 3.5, 35.4, SOUTH);
    sim.world.players[0].needs.sleep = 0;
    wait(sim, 0.1);
    expect(aimOf(sim, 0)?.refusal).toBe('exhausted-sleep');
    const bench = content.places[sim.world.common.place]?.map.objects.find(
      (o) => o.id === 'banc-du-quai',
    );
    if (bench === undefined) throw new Error('banc du quai absent');
    put(sim, 0, bench.x, bench.y + 1.2, -Math.PI / 2);
    wait(sim, 0.1);
    expect(aimOf(sim, 0)).toMatchObject({ id: 'banc-du-quai', action: 'sit', refusal: null });
    hold(sim, 'filet');
    const swung = act(sim, 0, { type: 'net_swing' });
    expect(swung).toContainEqual(
      expect.objectContaining({ type: 'refused', reason: 'exhausted-sleep' }),
    );
    expect(swung.some((e) => e.type === 'net_swung')).toBe(false);
    // L'autre joueur, reposé, n'est pas touché.
    expect(sim.world.players[1].tiers.sleep).not.toBe('blocked');
  });

  it('faim à 0 sans un sou à Aubrune: Odette offre sa soupe (jamais de blocage sans issue)', () => {
    const aubrune: Content = contentWith((files) => {
      const settings = files['commun/reglages.json'] as { start: Record<string, unknown> };
      settings.start = { ...settings.start, place: 'aubrune', minute: 600 };
    });
    const sim = newSim(aubrune);
    wait(sim, 0.2);
    for (const key of ['aubrune.acte1.besaces', 'aubrune.acte2.train'])
      remember(contextOf(sim), key, true, 'duo');
    wait(sim, 1);
    sim.world.minutes = 600;
    sim.world.players[0].money = 0;
    sim.world.players[0].needs.hunger = 0;
    wait(sim, 0.1);
    visit(sim, 0, 'odette');
    expect(aimOf(sim, 0)?.refusal).toBeNull();
    act(sim, 0, { type: 'act' });
    expect(sim.world.players[0].talk?.dialogue).toBe('odette-soupe-offerte');
    for (let i = 0; i < 8 && sim.world.players[0].talk !== null; i++)
      act(sim, 0, { type: 'talk_next' });
    expect(sim.world.players[0].needs.hunger).toBeGreaterThan(30);
  });
});
