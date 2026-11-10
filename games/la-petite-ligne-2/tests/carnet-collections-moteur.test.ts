// Onglet Collections du carnet branché sur l'album (`collectionBook`): un poisson pêché y paraît.
import { describe, expect, it } from 'vitest';
import { worldSources } from '../src/interface/carnet/lectures';
import { recordFind } from '../src/simulation/collections/registre';
import { contextOf, newSim } from './aides-l3';

describe('carnet: collections lues dans l’album', () => {
  it('une prise inscrite par recordFind est trouvée dans la famille des poissons', () => {
    const sim = newSim();
    const sources = worldSources(sim.content);
    const before = sources.collections(sim.world, 0).find((c) => c.family === 'fish');
    expect(before?.entries.find((e) => e.id === 'goujon')?.found).toBe(false);
    recordFind(contextOf(sim), 0, 'goujon', 9.5);
    const after = sources.collections(sim.world, 0).find((c) => c.family === 'fish');
    expect(after?.entries.find((e) => e.id === 'goujon')).toMatchObject({
      found: true,
      firstBy: 0,
    });
  });
});
