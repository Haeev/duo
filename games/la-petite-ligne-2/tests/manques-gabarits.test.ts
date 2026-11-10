// Quatre manques des gabarits comblés (refonte, mission « manques »): objets posés au sol par la
// carte, ensembles de meubles pour le repas à deux, sacs comme objets, note de placement.
import * as v from 'valibot';
import { describe, expect, it } from 'vitest';
import { ContentError } from '../src/donnees/charger';
import { SLICE_SCHEMAS } from '../src/reseau/canaux';
import { sliceMessage } from '../src/reseau/tranches';
import { shareSpecialMeal } from '../src/simulation/besoins/repas';
import { applyEffect } from '../src/simulation/regles/effets';
import { missingReasons } from '../outils/controle-pourquoi';
import { dataFiles } from './aides';
import { act, contentWith, contextOf, newSim, wait } from './aides-l3';
import { put, SOUTH } from './aides-noyau';

type Json = Record<string, unknown>;

const GARE = 'lieux/essai-gare/carte.json';

function mapOf(files: Record<string, Json>): Json {
  const map = files[GARE];
  if (map === undefined) throw new Error(GARE);
  return map;
}

describe('objets au sol posés par la carte', () => {
  const withSpots = (files: Record<string, Json>): void => {
    mapOf(files).groundItems = [
      { id: 'pommes', item: 'pomme', count: 2, x: 20, y: 22, respawnDaily: true },
      { id: 'pierre', item: 'pierre', count: 1, x: 21, y: 22 },
    ];
  };

  it('sont au sol dès la création du lieu, passent chez l’invité, et la pile voulue se ramasse', () => {
    const content = contentWith(withSpots);
    const sim = newSim(content);
    const ground = sim.world.places['essai-gare']?.ground ?? [];
    expect(ground.map((g) => [g.stack.item, g.stack.count, g.x, g.y])).toEqual([
      ['pomme', 2, 20, 22],
      ['pierre', 1, 21, 22],
    ]);
    const message = sliceMessage(sim.world, 'place');
    expect(v.safeParse(SLICE_SCHEMAS.place, JSON.parse(JSON.stringify(message))).success).toBe(
      true,
    );
    put(sim, 0, 20, 22.5, SOUTH);
    act(sim, 0, { type: 'pick_up', ground: 0 });
    expect(sim.world.players[0].toolbar[0]).toEqual({ item: 'pomme', count: 2 });
  });

  it('la pomme revient le lendemain, la pierre ne revient pas, et rien n’est posé deux fois', () => {
    const sim = newSim(contentWith(withSpots));
    put(sim, 0, 20.5, 22.5, SOUTH);
    wait(sim, 0.2);
    expect(sim.world.places['essai-gare']?.groundDay).toBe(1);
    act(sim, 0, { type: 'pick_up', ground: 0 }, { type: 'pick_up', ground: 1 });
    expect(sim.world.places['essai-gare']?.ground).toEqual([]);
    sim.world.common.day = 2;
    wait(sim, 0.2);
    const ground = sim.world.places['essai-gare']?.ground ?? [];
    expect(ground.map((g) => g.stack.item)).toEqual(['pomme']);
    expect(sim.world.places['essai-gare']?.groundDay).toBe(2);
    sim.world.common.day = 3;
    wait(sim, 0.2);
    expect(sim.world.places['essai-gare']?.ground).toHaveLength(1);
  });

  it('une carte fautive est refusée avec son lieu et son objet', () => {
    const bad = (spot: Json): string => {
      try {
        contentWith((files) => {
          mapOf(files).groundItems = [
            { id: 'mauvais', item: 'pomme', count: 1, x: 20, y: 22, ...spot },
          ];
        });
      } catch (error) {
        if (error instanceof ContentError) return error.message;
        throw error;
      }
      return '';
    };
    expect(bad({ item: 'licorne' })).toMatch(/objet au sol mauvais: objet inconnu « licorne »/);
    expect(bad({ count: 11 })).toMatch(/pour une pile de 10/);
    expect(bad({ x: 20, y: 10 })).toMatch(/dans une zone bloquée/);
    expect(bad({ x: 99 })).toMatch(/hors de la carte/);
  });
});

describe('ensemble de meubles pour le repas à deux', () => {
  const NORTH_CHAIR = 'chaise-du-buffet-nord';
  const SOUTH_CHAIR = 'chaise-du-buffet-sud';

  function seat(sim: ReturnType<typeof newSim>, object: string, player: 0 | 1): void {
    const seats = sim.world.places['essai-gare']?.objects[object]?.sit;
    if (seats !== undefined) seats[0] = player;
  }

  it('une table et deux chaises groupées: deux joueurs assis sur deux chaises partagent le repas', () => {
    const sim = newSim(contentWith(() => undefined));
    const ctx = contextOf(sim);
    seat(sim, NORTH_CHAIR, 0);
    expect(shareSpecialMeal(ctx, 'table-du-buffet', 'no_tool_wear')).toBe('not-together');
    seat(sim, SOUTH_CHAIR, 1);
    expect(shareSpecialMeal(ctx, 'table-du-buffet', 'no_tool_wear')).toBeNull();
    expect(sim.world.players.map((p) => p.needs.hunger)).toEqual([100, 100]);
  });

  it('sans groupe, les deux chaises ne font pas un ensemble (le comportement d’avant demeure)', () => {
    const sim = newSim(
      contentWith((files) => {
        for (const o of mapOf(files).objects as Json[]) delete o.group;
      }),
    );
    seat(sim, NORTH_CHAIR, 0);
    seat(sim, SOUTH_CHAIR, 1);
    expect(shareSpecialMeal(contextOf(sim), 'table-du-buffet', 'no_tool_wear')).toBe(
      'not-together',
    );
  });

  it('un groupe seul, sans siège ou trop étendu est refusé par le validateur', () => {
    const load = (edit: (objects: Json[]) => void): string => {
      try {
        contentWith((files) => {
          edit(mapOf(files).objects as Json[]);
        });
      } catch (error) {
        if (error instanceof ContentError) return error.message;
        throw error;
      }
      return '';
    };
    const pick = (objects: Json[], id: string): Json => {
      const found = objects.find((o) => o.id === id);
      if (found === undefined) throw new Error(id);
      return found;
    };
    expect(load((o) => (pick(o, SOUTH_CHAIR).group = 'seule'))).toMatch(/deux meubles au moins/);
    expect(
      load((o) => {
        for (const id of ['pompe', 'pommier']) pick(o, id).group = 'sans-siege';
      }),
    ).toMatch(/aucun meuble à brique `sit`/);
    expect(load((o) => (pick(o, SOUTH_CHAIR).y = 22))).toMatch(/plus de 6 m/);
  });
});

describe('sacs comme objets', () => {
  const bar = (index: number) => ({ area: 'toolbar' as const, index });

  it('le sac trouvé au sol se ramasse puis s’équipe; l’objet est consommé', () => {
    const sim = newSim(
      contentWith((files) => {
        mapOf(files).groundItems = [{ id: 'sac', item: 'sac-de-toile', count: 1, x: 20, y: 22 }];
      }),
    );
    put(sim, 0, 20, 22.5, SOUTH);
    act(sim, 0, { type: 'pick_up', ground: 0 });
    expect(sim.world.players[0].toolbar[0]).toEqual({ item: 'sac-de-toile', count: 1 });
    expect(act(sim, 0, { type: 'equip_bag', from: bar(0) })).toContainEqual({
      type: 'bag_changed',
      player: 0,
      bag: 'sac-de-toile',
    });
    expect(sim.world.players[0].bag?.slots).toHaveLength(6);
    expect(sim.world.players[0].toolbar[0]).toBeNull();
  });

  it('un sac plus grand remplace le premier, qui revient dans les poches avec son contenu', () => {
    const content = contentWith((files) => {
      files['commun/objets/sac-a-dos.json'] = {
        schema: 1,
        id: 'sac-a-dos',
        name: 'Sac à dos',
        family: 'bag',
        stack: 1,
        food: null,
        tool: null,
        bag: 'sac-a-dos',
      };
    });
    const sim = newSim(content);
    const player = sim.world.players[0];
    player.toolbar[0] = { item: 'sac-de-toile', count: 1 };
    act(sim, 0, { type: 'equip_bag', from: bar(0) });
    player.bag?.slots.splice(0, 1, { item: 'pierre', count: 3 });
    player.toolbar[1] = { item: 'sac-a-dos', count: 1 };
    act(sim, 0, { type: 'equip_bag', from: bar(1) });
    expect(player.bag?.id).toBe('sac-a-dos');
    expect(player.bag?.slots).toHaveLength(10);
    const carried = [...player.toolbar, ...(player.bag?.slots ?? [])];
    expect(carried.some((s) => s?.item === 'sac-de-toile')).toBe(true);
    expect(carried.find((s) => s?.item === 'pierre')?.count).toBe(3);
    // Le sac de toile, plus petit, ne remplace pas le sac à dos.
    const back = carried.findIndex((s) => s?.item === 'sac-de-toile');
    const from =
      back < player.toolbar.length
        ? bar(back)
        : { area: 'bag' as const, index: back - player.toolbar.length };
    expect(act(sim, 0, { type: 'equip_bag', from })).toContainEqual(
      expect.objectContaining({ type: 'refused', reason: 'bag-not-bigger' }),
    );
  });

  it('un objet qui n’est pas un sac est refusé, et l’effet give_bag des dialogues reste valable', () => {
    const sim = newSim(contentWith(() => undefined));
    sim.world.players[0].toolbar[0] = { item: 'pomme', count: 1 };
    expect(act(sim, 0, { type: 'equip_bag', from: bar(0) })).toContainEqual({
      type: 'refused',
      player: 0,
      reason: 'not-a-bag',
      target: null,
    });
    expect(sim.world.players[0].toolbar[0]).toEqual({ item: 'pomme', count: 1 });
    applyEffect(contextOf(sim), 1, { type: 'give_bag', bag: 'besace' });
    expect(sim.world.players[1].bag?.id).toBe('besace');
  });

  it('le validateur lie la famille « bag » au champ bag, et le sac doit exister', () => {
    const load = (item: Json): string => {
      try {
        contentWith((files) => {
          files['commun/objets/mal.json'] = {
            schema: 1,
            id: 'mal',
            name: 'Mal',
            family: 'bag',
            stack: 1,
            food: null,
            tool: null,
            ...item,
          };
        });
      } catch (error) {
        if (error instanceof ContentError) return error.message;
        throw error;
      }
      return '';
    };
    expect(load({})).toMatch(/famille « bag » et champ `bag` vont ensemble/);
    expect(load({ bag: 'valise' })).toMatch(/sac inconnu « valise »/);
    expect(load({ bag: 'besace', stack: 2 })).toMatch(/un sac ne s'empile pas/);
  });
});

describe('note de placement « pourquoi »', () => {
  it('le contrôle liste les éléments sans raison, sans rien bloquer', () => {
    const files = dataFiles();
    const missing = missingReasons(files);
    expect(missing).toContain('lieu essai-gare, meuble pompe');
    expect(missing).not.toContain('lieu essai-gare, meuble table-du-buffet');
    expect(missing).not.toContain('lieu essai-halte, objet au sol sac-oublie');
    expect(missing.some((line) => line.startsWith('lieu essai-gare:'))).toBe(false);
    expect(missingReasons(files, 'essai-halte').every((line) => line.includes('essai-halte'))).toBe(
      true,
    );
  });

  it('un lieu entièrement expliqué, intérieur compris, ne remonte rien; le moteur ignore les notes', () => {
    const files: Record<string, unknown> = {
      'lieux/x/lieu.json': { id: 'x', pourquoi: 'ici' },
      'lieux/x/carte.json': {
        objects: [{ id: 'banc', pourquoi: 'sur le quai' }],
        groundItems: [{ id: 'sac', pourquoi: 'oublié' }],
      },
      'lieux/x/interieurs/salle.json': {
        id: 'salle',
        pourquoi: 'abri',
        objects: [{ id: 'poele' }],
      },
    };
    expect(missingReasons(files)).toEqual(['lieu x, intérieur salle, meuble poele']);
    expect(missingReasons({ ...files, 'lieux/x/lieu.json': { id: 'x', pourquoi: ' ' } })[0]).toBe(
      'lieu x: le lieu lui-même',
    );
  });
});
