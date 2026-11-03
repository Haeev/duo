import { describe, expect, it } from 'vitest';
import { loadContent } from '../src/donnees/contenu';
import { CONTENT_FILES } from '../src/donnees/fichiers';

describe('contenu', () => {
  it('lit et contrôle les neuf fichiers du game designer', () => {
    const content = loadContent(CONTENT_FILES);
    expect(Object.keys(content.items).length).toBeGreaterThan(20);
    expect(content.settings.clock.firstDay.start).toBe(600);
    expect(content.quests.length).toBeGreaterThanOrEqual(5);
    expect(Object.keys(content.dialogues).length).toBeGreaterThan(20);
  });
});

describe('carte', () => {
  it('lit la carte du level designer, avec tous les points attendus', async () => {
    const { loadMap } = await import('../src/donnees/carte');
    const { MAP_FILES } = await import('../src/donnees/cartes-fichiers');
    const result = loadMap(MAP_FILES);
    expect(result.warning).toBeNull();
    expect(result.source).toBe('level');
    // Tour 10 (T10-01): la rue Haute élargit la carte de 64 à 100 m; 0.13: 164 x 78 m, grille en (-24, -30).
    expect([result.map.width, result.map.height]).toEqual([164, 78]);
    expect([result.map.originX, result.map.originY]).toEqual([-24, -30]);
    expect(result.map.garden).toHaveLength(12);
    expect(result.map.trees).toHaveLength(12);
    expect(result.map.startFurniture.length).toBeGreaterThanOrEqual(4);
  });
});
