// Abri du joueur local (retour S05 du 2026-11-02): pas de pluie ni de flaques dans un intérieur couvert.
import { describe, expect, it } from 'vitest';
import { loadContent } from '../donnees/contenu';
import { loadMap } from '../donnees/carte';
import { MAP_FILES } from '../donnees/cartes-fichiers';
import { CONTENT_FILES } from '../donnees/fichiers';
import { createWorld } from '../simulation/monde';
import { shelterRects } from './abri';

const content = loadContent(CONTENT_FILES);
const { map } = loadMap(MAP_FILES);

function world(): ReturnType<typeof createWorld>['world'] {
  return createWorld(content, map, 7, [
    { id: 'joueur-1', name: 'Camille', color: '#3a7bd5' },
    { id: 'joueur-2', name: 'Sacha', color: '#d55a3a' },
  ]).world;
}

describe('abri du joueur local (S05)', () => {
  it('dehors, aucun abri; dans la mercerie, toute son emprise', () => {
    const w = world();
    expect(shelterRects(w, map, 'p1')).toEqual([]);
    const p1 = w.characters[0];
    if (p1 === undefined) throw new Error('p1 absent');
    p1.inside = 'salon';
    expect(shelterRects(w, map, 'p1')).toEqual([
      map.props.find((prop) => prop.id === 'salon_shop')?.rect,
    ]);
  });

  it('la maisonnette abrite une fois son toit réparé, et la chambre une fois son toit posé', () => {
    const w = world();
    const p1 = w.characters[0];
    const roof = w.constructions.find((construction) => construction.id === 'house_roof');
    if (p1 === undefined || roof === undefined) throw new Error('état incomplet');
    p1.inside = 'house';
    expect(shelterRects(w, map, 'p1')).toEqual([]);
    roof.status = 'done';
    expect(shelterRects(w, map, 'p1')).toHaveLength(1);
    w.rooms.room_bedroom = {
      ordered: 3,
      crate: [],
      elementsBuilt: ['wall_west'],
      beamPlaced: true,
      builtDay: null,
    };
    expect(shelterRects(w, map, 'p1')).toHaveLength(1);
    w.rooms.room_bedroom.elementsBuilt.push('roof');
    const rects = shelterRects(w, map, 'p1');
    expect(rects).toHaveLength(2);
    expect(rects[1]).toEqual(
      map.buildings.house?.rooms.find((room) => room.id === 'house_bedroom')?.build?.footprint,
    );
  });
});
