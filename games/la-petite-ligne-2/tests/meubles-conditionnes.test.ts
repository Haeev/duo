// Meuble de carte conditionné (`when`) et porte conditionnée (`opens`): un coffre factice qui
// n'existe qu'une fois un fait retenu, puis la maison du garde d'Aubrune telle que livrée.
import { describe, expect, it } from 'vitest';
import { aimOf } from '../src/simulation/briques/visee';
import { absentObjects, doorRefusal } from '../src/simulation/lieux/index';
import { eventDayKey } from '../src/simulation/monde/calendrier';
import { bodyCollides } from '../src/simulation/noyau/grille';
import { currentBlockers } from '../src/simulation/noyau/obstacles';
import { put, send } from './aides-noyau';
import { contentWith, wait, withTestProps } from './aides-l3';
import { gameContent, newSim } from './aides';

type Json = Record<string, unknown>;
const FACT = 'essai-gare.reserve.ouverte';

/** Un coffre de carte qui ne paraît qu'avec le fait `FACT`, en (20.5, 24.5) de la gare d'essai. */
function content(): ReturnType<typeof contentWith> {
  return contentWith((files) => {
    withTestProps(files);
    const objects = files['lieux/essai-gare/carte.json']?.objects as Json[];
    objects.push({
      id: 'coffre-factice',
      type: 'coffre-essai',
      x: 20.5,
      y: 24.5,
      rotation: 0,
      when: [{ type: 'remembered', key: FACT }],
    });
  });
}

function blockedAt(sim: ReturnType<typeof newSim>, x: number, y: number): boolean {
  const b = currentBlockers(sim.content, sim.world);
  if (b === null) throw new Error('obstacles absents');
  return bodyCollides(b, x, y, sim.content.settings.movement.radius);
}

describe('meuble de carte conditionné', () => {
  it('absent: ni obstacle, ni cible, ni usage; le fait retenu, il paraît et sert', () => {
    const sim = newSim(content());
    wait(sim, 0.1);
    expect([...absentObjects(sim)]).toEqual(['coffre-factice']);
    expect(blockedAt(sim, 20.5, 24.5)).toBe(false);
    put(sim, 0, 20.5, 23.4, Math.PI / 2);
    expect(aimOf(sim, 0)).toBeNull();
    expect(
      send(sim, 0, { type: 'use_brick', target: 'coffre-factice', brick: 'store' }),
    ).not.toContainEqual(expect.objectContaining({ type: 'store_opened' }));

    sim.world.progress.memory[FACT] = { v: true, by: 'duo', day: 1 };
    const events = wait(sim, 0.1);
    expect(events).toContainEqual({
      type: 'map_object_changed',
      object: 'coffre-factice',
      present: true,
    });
    expect(absentObjects(sim).size).toBe(0);
    expect(blockedAt(sim, 20.5, 24.5)).toBe(true);
    expect(aimOf(sim, 0)).toMatchObject({ id: 'coffre-factice', action: 'store' });
    expect(send(sim, 0, { type: 'act' })).toContainEqual(
      expect.objectContaining({ type: 'store_opened', target: 'coffre-factice' }),
    );
  });

  it('dégage le joueur qui se tenait là où le meuble paraît', () => {
    const sim = newSim(content());
    wait(sim, 0.1);
    put(sim, 1, 20.5, 24.5, 0);
    sim.world.progress.memory[FACT] = { v: true, by: 'duo', day: 1 };
    expect(wait(sim, 0.1)).toContainEqual({ type: 'unstuck', player: 1 });
    const { x, y } = sim.world.players[1].body;
    expect(blockedAt(sim, x, y)).toBe(false);
  });

  it('refuse une condition qui nomme un objet inconnu', () => {
    expect(() =>
      contentWith((files) => {
        withTestProps(files);
        const objects = files['lieux/essai-gare/carte.json']?.objects as Json[];
        objects.push({
          id: 'coffre-factice',
          type: 'coffre-essai',
          x: 20.5,
          y: 24.5,
          rotation: 0,
          when: [{ type: 'item_in_bag', item: 'objet-inconnu', count: 1 }],
        });
      }),
    ).toThrow(/objet coffre-factice, when: objet inconnu/);
  });
});

describe('maison du garde d’Aubrune (données livrées)', () => {
  const game = gameContent();
  const place = game.places.aubrune;
  if (place === undefined) throw new Error('Aubrune absent');

  function atAubrune(): ReturnType<typeof newSim> {
    const sim = newSim(game);
    sim.world.common.place = 'aubrune';
    return sim;
  }

  it('cuisinière et plan de travail à l’achat de la cuisine', () => {
    const sim = atAubrune();
    // Les pots de grès posés sur le plan de travail (`on`) s'en vont et reviennent avec lui.
    // (Le décor des fêtes, absent un jour ordinaire, est essayé plus bas; les ardoises de chantier
    // des pièces suivantes attendent la salle: `tests/chantier.test.ts`.)
    const kitchen = ['maison-cuisiniere', 'maison-plan', 'maison-rdc-pots'];
    const absent = (): string[] =>
      [...absentObjects(sim)]
        .filter((id) => !id.startsWith('fete-') && !id.startsWith('maison-chantier-'))
        .sort();
    expect(absent()).toEqual(kitchen);
    sim.world.progress.memory['aubrune.maison-du-garde.cuisine'] = {
      v: 'restored',
      by: 'duo',
      day: 3,
    };
    expect(absent()).toEqual([]);
  });

  it('escaliers de l’étage et de la cave fermés jusqu’à leur étape, avec leur phrase', () => {
    const sim = atAubrune();
    for (const room of ['etage', 'cave']) {
      const door = place.map.doors?.[`maison-rdc-esc-maison-${room}`];
      if (door === undefined) throw new Error('escalier absent');
      expect(door.says).toBeTypeOf('string');
      expect(doorRefusal(sim, 0, door)).toBe('door-locked');
      sim.world.progress.memory[`aubrune.maison-du-garde.${room}`] = {
        v: 'restored',
        by: 'duo',
        day: 3,
      };
      expect(doorRefusal(sim, 0, door)).toBeNull();
    }
  });
});

// Décor des fêtes (plan d'Aubrune, version 7): chaque objet `fete-*` ne paraît que le jour de sa
// fête (`event_is` en `begun`, écrit par l'agenda) et s'en va à l'aube suivante.
describe('décor des fêtes d’Aubrune (données livrées)', () => {
  const game = gameContent();

  function feteDu(event: string | null, minutes: number): ReturnType<typeof newSim> {
    const sim = newSim(game);
    sim.world.common.place = 'aubrune';
    sim.world.minutes = minutes;
    if (event !== null)
      sim.world.progress.memory[eventDayKey('aubrune', event)] = {
        v: sim.world.common.day,
        by: 'duo',
        day: sim.world.common.day,
      };
    return sim;
  }
  const shown = (sim: ReturnType<typeof newSim>, prefix: string): string[] => {
    const absent = absentObjects(sim);
    const place = game.places.aubrune;
    if (place === undefined) throw new Error('Aubrune absent');
    return place.map.objects
      .filter((o) => o.id.startsWith(prefix) && !absent.has(o.id))
      .map((o) => o.id);
  };

  it('un jour ordinaire, aucun décor de fête', () => {
    expect(shown(feteDu(null, 12 * 60), 'fete-')).toEqual([]);
  });

  it('le concours de la soupe pose ses marmites, sa table et son ardoise, et rien d’autre', () => {
    const sim = feteDu('concours-de-la-soupe', 11 * 60);
    expect(shown(sim, 'fete-soupe-')).toHaveLength(6);
    expect(shown(sim, 'fete-').length).toBe(6);
    // Le lendemain, l'agenda ne dit plus « commencée aujourd'hui »: le bourg a rangé.
    sim.world.common.day += 1;
    expect(shown(sim, 'fete-')).toEqual([]);
  });

  it('les lisses fleuries attendent d’être baissées par la scène d’ouverture', () => {
    const sim = feteDu('fete-des-barrieres-fleuries', 11 * 60);
    expect(shown(sim, 'fete-lisse-')).toEqual([]);
    expect(shown(sim, 'fete-barrieres-')).toHaveLength(2);
    sim.world.progress.memory['aubrune.barrieres.lisses'] = {
      v: 'baissees',
      by: 'duo',
      day: sim.world.common.day,
    };
    expect(shown(sim, 'fete-lisse-')).toHaveLength(2);
  });

  it('les lumignons refroidissent sur le parvis le jour, puis brûlent dans tout le bourg', () => {
    expect(shown(feteDu('nuit-des-lumignons', 12 * 60), 'fete-lumignon-')).toHaveLength(21);
    const nuit = shown(feteDu('nuit-des-lumignons', 21 * 60), 'fete-lumignon-');
    expect(nuit).toHaveLength(21);
    expect(nuit.some((id) => id.includes('parvis'))).toBe(false);
    // Rosalie repart à 22 h: son lumignon s'éteint avec elle.
    expect(shown(feteDu('nuit-des-lumignons', 23 * 60), 'fete-lumignon-')).toHaveLength(20);
  });
});
