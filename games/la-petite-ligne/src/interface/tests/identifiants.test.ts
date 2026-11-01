/**
 * Aucun identifiant de la simulation à l'écran (revue du tour 6: « Parle avec h145 »). La carte
 * de l'autre joueur nomme ce qu'il fait comme ce joueur le connaît: un habitant par son nom, une
 * poule par son nom s'il le voit déjà, sinon par sa couleur; ce qu'il regarde pendant un moment.
 */
import { describe, expect, it } from 'vitest';
import { henUnknown } from '../../etat/secrets';
import type { CharacterId } from '../../etat/types';
import type { Sim } from '../../simulation/contexte';
import { setupScenario } from '../demo/scenarios';
import { partnerModel } from '../modele';
import { apply, character, newSim, playUntil, started, uiContext } from './aides';

const plain = (s: string): string => s.replace(/[\u00a0\u202f]/g, ' ').replace(/\u2019/g, "'");

function scenario(name: string): Sim {
  const sim = newSim();
  apply(sim, 'p1', { type: 'title_ready', ready: true });
  apply(sim, 'p2', { type: 'title_ready', ready: true });
  setupScenario(sim, name, 'p1')?.();
  return sim;
}

function activity(sim: Sim, me: CharacterId): string {
  return plain(partnerModel(sim.world, uiContext(me), null)?.activity ?? '');
}

/** Identifiants qui ne doivent jamais apparaître: poules, habitants, moments, et toute forme `mot_mot` ou `h145`. */
function leaks(sim: Sim, text: string): string[] {
  const ids = [
    ...sim.world.hens.map((h) => h.id),
    ...sim.content.villagers.map((v) => v.id),
    ...sim.content.moments.map((m) => m.id),
  ];
  const out = ids.filter((id) =>
    new RegExp(`(^|[^\\p{L}\\d_])${id}($|[^\\p{L}\\d_])`, 'u').test(text),
  );
  if (/\b[a-z]+_[a-z0-9_]+\b/.test(text)) out.push('mot_mot');
  if (/\bh\d+\b/.test(text)) out.push('h + chiffres');
  if (text.includes('{')) out.push('jeton non remplacé');
  return out;
}

describe("carte de l'autre pendant l'appel d'une poule", () => {
  it("chez l'informé, qui voit les noms au-dessus des poules: la poule par son nom, jamais son identifiant", () => {
    const sim = scenario('poules-appel');
    const call = character(sim, 'p2').dialogue;
    const hen = sim.world.hens.find((h) => h.id === call?.villager);
    expect(hen).toBeDefined();
    if (hen === undefined) return;
    const text = activity(sim, 'p1');
    expect(text).toBe(`Appelle ${hen.name}`);
    expect(leaks(sim, text)).toEqual([]);
  });

  it('chez qui ne connaît pas encore son nom: la poule par sa couleur', () => {
    const sim = scenario('poules-appel');
    const doer = character(sim, 'p2');
    const informed = character(sim, 'p1');
    const hen = sim.world.hens.find((h) => h.id === doer.dialogue?.villager);
    if (hen === undefined || doer.dialogue === null) throw new Error('appel attendu chez p2');
    // Situation inverse posée à la main: l'appel ouvert chez p1, vu par p2 qui ignore le nom.
    informed.dialogue = structuredClone(doer.dialogue);
    informed.status = 'dialogue';
    const text = activity(sim, 'p2');
    expect(text).toBe(plain(`Appelle ${henUnknown(sim.content, hen.variant)}`));
    expect(text).not.toContain(hen.name);
    expect(leaks(sim, text)).toEqual([]);
  });

  it("un interlocuteur inconnu des données: « quelqu'un », pas son identifiant", () => {
    const sim = started();
    const other = character(sim, 'p2');
    other.status = 'dialogue';
    other.dialogue = { dialogue: 'essai', villager: 'zz_inconnu', lines: [], line: 0, choices: [] };
    expect(activity(sim, 'p1')).toBe("Parle avec quelqu'un");
  });
});

describe("carte de l'autre pendant un moment rare", () => {
  it('quand il remplit sa part, elle dit ce qu’il regarde (pas « En chemin »)', () => {
    const sim = scenario('moment-pose');
    expect(sim.world.moments.today?.watching.p2).toBe(true);
    expect(activity(sim, 'p1')).toBe('Regarde le héron');
  });

  it('chaque moment des données a sa phrase', () => {
    const ctx = uiContext();
    for (const m of ctx.content.moments)
      expect(ctx.texts.extra.partner.watching[m.id], m.id).toBeDefined();
  });
});

describe("aucun identifiant sur la carte de l'autre, au fil de trois jours joués", () => {
  it('ni poule, ni habitant, ni moment, ni jeton', () => {
    const sim = newSim();
    apply(sim, 'p1', { type: 'title_ready', ready: true });
    apply(sim, 'p2', { type: 'title_ready', ready: true });
    const seen = new Set<string>();
    let tick = 0;
    playUntil(sim, (s) => {
      if (tick++ % 30 === 0) for (const me of ['p1', 'p2'] as const) seen.add(activity(s, me));
      return s.world.clock.day >= 4;
    });
    expect(seen.size).toBeGreaterThan(5);
    for (const text of seen) expect(leaks(sim, text), text).toEqual([]);
  });
});
