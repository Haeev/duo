// Onglet Quêtes du carnet branché sur le moteur de quêtes: journal, texte de l'étape, repère suivi.
import { describe, expect, it } from 'vitest';
import { worldSources } from '../src/interface/carnet/lectures';
import { gameContent, newSim } from './aides';

const content = gameContent();

describe('carnet: quêtes lues dans le moteur', () => {
  it('montre l’étape ouverte et, suivie, le repère du coup d’œil', () => {
    const sim = newSim(content);
    sim.world.progress.quests['sonnerie-essai'] = {
      chapter: 'un-drole-de-bruit',
      step: 'parler',
      done: false,
    };
    const sources = worldSources(content);
    const line = sources.quests(sim.world, 0).find((q) => q.id === 'sonnerie-essai');
    expect(line?.step.length).toBeGreaterThan(0);
    expect(line?.chapters[0]?.state).toBe('current');
    sim.world.common.story = { tracked: ['sonnerie-essai', null], scene: null, queue: [] };
    const tracked = sources.quests(sim.world, 0).find((q) => q.id === 'sonnerie-essai');
    expect(tracked?.target).not.toBeNull();
  });

  it('hygiène trop basse: l’étape sur dialogue dit « Un brin de toilette d’abord » (cahier 4.4)', () => {
    const sim = newSim(content);
    sim.world.progress.quests['sonnerie-essai'] = {
      chapter: 'un-drole-de-bruit',
      step: 'parler',
      done: false,
    };
    const sources = worldSources(content);
    const clean = sources.quests(sim.world, 0).find((q) => q.id === 'sonnerie-essai')?.step ?? '';
    expect(clean).not.toContain('toilette');
    sim.world.players[0].tiers.hygiene = 'blocked';
    const dirty = sources.quests(sim.world, 0).find((q) => q.id === 'sonnerie-essai')?.step ?? '';
    expect(dirty.startsWith('Un brin de toilette d’abord.')).toBe(true);
    expect(dirty).toContain(clean);
    // Le carnet de l'autre joueur, propre, ne change pas.
    expect(sources.quests(sim.world, 1).find((q) => q.id === 'sonnerie-essai')?.step).toBe(clean);
  });
});
