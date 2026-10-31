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
