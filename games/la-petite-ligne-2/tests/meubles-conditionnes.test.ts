// Meuble de carte conditionné (`when`) et porte conditionnée (`opens`): un coffre factice qui
// n'existe qu'une fois un fait retenu, puis la maison du garde d'Aubrune telle que livrée.
import { describe, expect, it } from 'vitest';
import { aimOf } from '../src/simulation/briques/visee';
import { absentObjects, doorRefusal } from '../src/simulation/lieux/index';
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
    expect([...absentObjects(sim)].sort()).toEqual(['maison-cuisiniere', 'maison-plan']);
    sim.world.progress.memory['aubrune.maison-du-garde.cuisine'] = {
      v: 'restored',
      by: 'duo',
      day: 3,
    };
    expect(absentObjects(sim).size).toBe(0);
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
