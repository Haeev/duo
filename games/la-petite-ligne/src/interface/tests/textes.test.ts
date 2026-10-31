import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { Content } from '../../donnees/types';
import { UiTextsError, loadUiTexts } from '../textes';
import { contentAndMap } from './aides';

describe('textes de l’interface', () => {
  it('lit textes.json et les libellés des maquettes', () => {
    const { content } = contentAndMap();
    const texts = loadUiTexts(content);
    expect(texts.game.ui.hud.nextGoal).toBe('Prochain objectif');
    expect(texts.game.nightScreen.finish).toBe('Finir la séance');
    expect(texts.extra.title.name).toBe('La Petite Ligne');
    expect(texts.extra.creation.hairs).toHaveLength(3);
    expect(texts.extra.creation.outfits).toHaveLength(4);
  });

  it('refuse de monter sans une clé attendue, en citant le fichier et le champ', () => {
    const { content } = contentAndMap();
    const raw = structuredClone(content.texts.raw) as { ui: { hud: Record<string, unknown> } };
    delete raw.ui.hud.nextGoal;
    const broken: Content = { ...content, texts: { ...content.texts, raw } };
    expect(() => loadUiTexts(broken)).toThrow(UiTextsError);
    expect(() => loadUiTexts(broken)).toThrow(/donnees\/textes\.json: ui\.hud\.nextGoal/);
  });

  it("n'écrit ni tiret cadratin ni tiret demi-cadratin", () => {
    const file = readFileSync(fileURLToPath(new URL('../textes-interface.json', import.meta.url)), 'utf8');
    expect(file).not.toMatch(/[\u2013\u2014]/);
  });

  it('tutoie le joueur (pas de « vous » adressé à un seul joueur dans les libellés personnels)', () => {
    const { content } = contentAndMap();
    const t = loadUiTexts(content).extra;
    for (const text of [t.creation.nameHelp, t.notebook.bagEmpty, t.breakfast.secretHelp, t.proposal.receivedNote]) {
      expect(text).not.toMatch(/\bvous\b/i);
    }
  });
});
