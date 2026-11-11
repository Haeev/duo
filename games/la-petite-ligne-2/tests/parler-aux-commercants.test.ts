// Les commerçants d'Aubrune tiennent boutique dedans: à l'heure d'ouverture, un joueur venu par
// la porte peut parler à chacun (l'histoire leur parle) et ouvrir sa boutique. Test court.
import { describe, expect, it } from 'vitest';
import { aimOf } from '../src/simulation/briques/visee';
import { isShopOpen } from '../src/simulation/habitants/lecture';
import { interiorAt } from '../src/simulation/lieux/index';
import { remember } from '../src/simulation/regles/memoire';
import { contentWith, contextOf, wait } from './aides-l3';
import { visit } from './aides-visite';
import { newSim } from './aides';

type Json = Record<string, unknown>;
const AUBRUNE = 'aubrune';

describe('commerçants dans leur boutique', () => {
  it('à 10 h, chacun est à son poste, boutique ouverte, et se laisse aborder par la porte', () => {
    const content = contentWith((files) => {
      const settings = files['commun/reglages.json'] as { start: Json };
      settings.start = { ...settings.start, place: AUBRUNE, minute: 600 };
    });
    const sim = newSim(content);
    wait(sim, 0.2);
    const place = content.places[AUBRUNE];
    if (place === undefined) throw new Error('Aubrune absente');
    // Tout le monde est arrivé et tout commerce conditionné est tenu (faits de ses conditions).
    const facts = new Set<string>();
    for (const shop of Object.values(place.shops))
      for (const c of shop.when ?? []) if (c.type === 'remembered') facts.add(c.key);
    for (const villager of place.villagers)
      for (const c of villager.life?.arrives ?? []) if (c.type === 'remembered') facts.add(c.key);
    for (const key of facts) remember(contextOf(sim), key, true, 'duo');
    const story = sim.world.common.story;
    if (story !== undefined) story.scene = null;
    wait(sim, 2);
    sim.world.minutes = 600;
    wait(sim, 2);
    let indoors = 0;
    for (const shop of Object.values(place.shops)) {
      const keeper = sim.world.places[AUBRUNE]?.villagers[shop.keeper];
      if (keeper === undefined) throw new Error(`commerçant ${shop.keeper}`);
      if (keeper.life?.presence !== 'here') continue;
      expect(isShopOpen(sim, shop.id), `${shop.id} ouvert à 10 h`).toBe(true);
      if (interiorAt(place, keeper.body.x, keeper.body.y) !== null) indoors += 1;
      // Dehors d'abord: le joueur entre par la porte de la boutique.
      const start = place.map.points[place.def.station.arrival];
      if (start === undefined) throw new Error('arrivée');
      Object.assign(sim.world.players[0].body, { x: start.x, y: start.y });
      visit(sim, 0, shop.keeper);
      expect(aimOf(sim, 0)).toMatchObject({ id: shop.keeper, action: 'talk', refusal: null });
    }
    expect(indoors, 'des commerçants tiennent boutique dedans').toBeGreaterThan(3);
  });
});
