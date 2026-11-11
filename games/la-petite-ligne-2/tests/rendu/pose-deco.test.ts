// Mode déco: un meuble de la couche `top` posé par un joueur sur une surface se dessine sur le
// plateau de son porteur (`top` de la fiche), et sa lumière part de là; à côté, il reste au sol.
import { describe, expect, it } from 'vitest';
import { loadContent } from '../../src/donnees/charger';
import { describeDynamic } from '../../src/rendu/lieu/description';
import { placeLights } from '../../src/rendu/encre/lumieres';
import { createPlaceState } from '../../src/simulation/noyau/monde';
import { gameDataFiles } from '../aides';

const content = loadContent(gameDataFiles());

describe('pose du mode déco', () => {
  it('pose la lampe sur le plateau de la table, et au sol hors de son emprise', () => {
    const place = content.places.aubrune;
    if (place === undefined) throw new Error('aubrune absente');
    const top = content.props['table-essai']?.top;
    if (top === undefined) throw new Error('table-essai sans plateau');
    const state = createPlaceState(content, place);
    state.placed.push(
      { id: 'pose-90', type: 'table-essai', x: 10, y: 10, rotation: 1 },
      // Table tournée d'un quart: emprise de 1 x 2 m, la lampe à 0,8 m du centre y tient.
      { id: 'pose-91', type: 'lampe-de-table', x: 10, y: 10.8, rotation: 0 },
      { id: 'pose-92', type: 'lampe-de-table', x: 12, y: 10, rotation: 0 },
    );
    const volumes = describeDynamic(content, state, undefined, place);
    const at = (id: string): number => {
      const volume = volumes.find((v) => v.id === id);
      if (volume === undefined) throw new Error(`${id} absent`);
      return volume.base;
    };
    expect(at('pose-90')).toBe(0);
    expect(at('pose-91')).toBeCloseTo(top, 5);
    expect(at('pose-92')).toBe(0);
    // La lumière de la lampe posée part du plateau: plus haut que celle de la lampe au sol.
    const lamps = (id: string): number[] =>
      placeLights(
        volumes.filter((v) => v.id === id),
        null,
      ).lamps.map((l) => l.y);
    const [high] = lamps('pose-91');
    const [low] = lamps('pose-92');
    if (high === undefined || low === undefined) throw new Error('lampe sans lumière');
    expect(high - low).toBeCloseTo(top, 5);
  });
});
