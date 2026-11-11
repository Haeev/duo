// Objets posés sur un meuble (champ `on`): une table et une lampe factices, ajoutées par les seules
// données. La lampe se dessine à la hauteur du plateau, ne bloque pas, ne gêne pas la cible de la
// table, suit sa présence, et le validateur refuse les poses impossibles.
import { describe, expect, it } from 'vitest';
import { validateContent } from '../src/donnees/valider';
import { describePlace } from '../src/rendu/lieu/description';
import { aimOf } from '../src/simulation/briques/visee';
import { absentObjects } from '../src/simulation/lieux/index';
import { put } from './aides-noyau';
import { contentWith } from './aides-l3';
import { newSim } from './aides';

type Json = Record<string, unknown>;
const FACT = 'essai-gare.poses.table';

function prop(id: string, extra: Json): Json {
  return {
    schema: 1,
    id,
    name: 'Meuble d’essai',
    model: 'table-lamp',
    size: { w: 1, h: 1 },
    solid: false,
    placeable: false,
    series: null,
    bricks: [],
    ...extra,
  };
}

/** Une table à plateau de 0,8 m (conditionnée ou non) et une lampe posée dessus. */
function content(tableWhen: boolean, lamp: Json = {}): ReturnType<typeof contentWith> {
  return contentWith((files) => {
    files['commun/meubles/table-factice.json'] = prop('table-factice', {
      size: { w: 2, h: 1 },
      solid: true,
      top: 0.8,
      bricks: [{ brick: 'sit', seats: 2, restPerMinute: 4 }],
    });
    files['commun/meubles/lampe-factice.json'] = prop('lampe-factice', {});
    const objects = files['lieux/essai-gare/carte.json']?.objects as Json[];
    objects.push({
      id: 'table',
      type: 'table-factice',
      x: 20,
      y: 24.5,
      rotation: 0,
      ...(tableWhen ? { when: [{ type: 'remembered', key: FACT }] } : {}),
    });
    objects.push({
      id: 'lampe',
      type: 'lampe-factice',
      x: 20.3,
      y: 24.5,
      rotation: 0,
      on: 'table',
      ...lamp,
    });
  });
}

function volumeOf(
  c: ReturnType<typeof content>,
  id: string,
): ReturnType<typeof describePlace>['volumes'][number] {
  const place = c.places['essai-gare'];
  if (place === undefined) throw new Error('lieu absent');
  const found = describePlace(c, place).volumes.find((v) => v.id === id);
  if (found === undefined) throw new Error(`volume ${id} absent`);
  return found;
}

describe('objet posé sur un meuble', () => {
  it('se dessine à la hauteur du plateau, sans cacher ni se laisser viser', () => {
    const c = content(false);
    expect(validateContent(c)).toEqual([]);
    expect(volumeOf(c, 'table').base).toBe(0);
    expect(volumeOf(c, 'lampe')).toMatchObject({ base: 0.8, occludes: false, aimable: false });
  });

  it('accepte une hauteur donnée sans porteur', () => {
    const c = content(false, { on: 1.1 });
    expect(validateContent(c)).toEqual([]);
    expect(volumeOf(c, 'lampe').base).toBe(1.1);
  });

  it('laisse la table visée et bloquante', () => {
    const sim = newSim(content(false));
    put(sim, 0, 20, 23.4, Math.PI / 2);
    expect(aimOf(sim, 0)).toMatchObject({ id: 'table', action: 'sit' });
  });

  it('suit la présence de son porteur conditionné', () => {
    const sim = newSim(content(true));
    expect([...absentObjects(sim)].sort()).toEqual(['lampe', 'table']);
    sim.world.progress.memory[FACT] = { v: true, by: 'duo', day: 1 };
    expect(absentObjects(sim).size).toBe(0);
  });

  it('refuse au chargement un porteur inconnu, sans plateau, ou un objet posé à brique', () => {
    expect(() => content(false, { on: 'fantome' })).toThrow('porteur inconnu « fantome »');
    const build = (): unknown =>
      contentWith((files) => {
        files['commun/meubles/table-factice.json'] = prop('table-factice', { solid: true });
        files['commun/meubles/lampe-factice.json'] = prop('lampe-factice', {
          bricks: [{ brick: 'store', slots: 1 }],
        });
        const objects = files['lieux/essai-gare/carte.json']?.objects as Json[];
        objects.push({ id: 'table', type: 'table-factice', x: 20.5, y: 24.5, rotation: 0 });
        objects.push({
          id: 'lampe',
          type: 'lampe-factice',
          x: 20.5,
          y: 24.5,
          rotation: 0,
          on: 'table',
        });
      });
    expect(build).toThrow("n'a pas de plateau");
    expect(build).toThrow('est du décor');
  });

  it('refuse une lampe qui flotterait à côté de la table', () => {
    const c = content(false);
    const place = c.places['essai-gare'];
    const lamp = place?.map.objects.find((o) => o.id === 'lampe');
    if (lamp === undefined) throw new Error('lampe absente');
    Object.assign(lamp, { x: 25 });
    expect(validateContent(c).join('\n')).toContain('il flotterait');
  });
});
