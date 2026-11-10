/** Interface (lot L7): modèles de vue, sans DOM. */
import { describe, expect, it } from 'vitest';
import {
  clockModel,
  formatClock,
  GlanceTimer,
  gridMove,
  NeedsWatcher,
  otherDirection,
  paginate,
  promptModel,
  shortName,
  slotModel,
  ToolbarFold,
  Typewriter,
} from '../src/interface/modeles';
import { UI_TUNING } from '../src/interface/reglages';
import { gameContent, MEMBERS, SEED } from './aides';
import { createWorld } from '../src/simulation/noyau/monde';

const NBSP = String.fromCharCode(0xa0);
const content = gameContent();

describe('interface: modèles de vue', () => {
  it('horloge, jour et argent en euros', () => {
    const world = createWorld(content, SEED, MEMBERS);
    world.minutes = 10 * 60 + 5;
    world.players[0].money = 21_450;
    const c = clockModel(world, 0);
    expect(c.time).toBe(`10${NBSP}h${NBSP}05`);
    expect(c.money).toBe(`214,50${NBSP}€`);
    expect(c.night).toBe(false);
    expect(formatClock(22 * 60)).toBe(`22${NBSP}h${NBSP}00`);
  });

  it('besoins: visibles au changement de palier, sous 20, au coup d’œil', () => {
    const watch = new NeedsWatcher();
    const tiers = { hunger: 'neutral', sleep: 'neutral', hygiene: 'neutral' } as const;
    const needs = { hunger: 40, sleep: 40, hygiene: 15 };
    let list = watch.update(0, needs, tiers, false);
    expect(list.map((n) => n.visible)).toEqual([false, false, true]);
    list = watch.update(100, needs, { ...tiers, sleep: 'bonus' }, false);
    expect(list[1]?.visible).toBe(true);
    list = watch.update(100 + UI_TUNING.tierShowMs + 1, needs, { ...tiers, sleep: 'bonus' }, false);
    expect(list[1]?.visible).toBe(false);
    list = watch.update(9000, needs, { ...tiers, sleep: 'bonus' }, true);
    expect(list.every((n) => n.visible)).toBe(true);
  });

  it('barre d’outils: dépliée au changement, repliée après 3 s', () => {
    const fold = new ToolbarFold();
    fold.update(0, '0|a');
    expect(fold.visible(10, false)).toBe(false);
    fold.update(1000, '1|a');
    expect(fold.visible(1000 + UI_TUNING.toolbarFoldMs - 1, false)).toBe(true);
    expect(fold.visible(1000 + UI_TUNING.toolbarFoldMs + 1, false)).toBe(false);
    expect(fold.visible(99_999, true)).toBe(true);
  });

  it('coup d’œil: se referme seul après 3 s', () => {
    const glance = new GlanceTimer();
    expect(glance.active(0)).toBe(false);
    glance.open(500);
    expect(glance.active(500 + UI_TUNING.glanceMs - 1)).toBe(true);
    expect(glance.active(500 + UI_TUNING.glanceMs)).toBe(false);
  });

  it('dialogue: lettre par lettre, pause à la ponctuation, babil, tout afficher', () => {
    const babble: string[] = [];
    const writer = new Typewriter((c) => babble.push(c));
    writer.start('Oui. Bien', false);
    writer.advance(1000 / UI_TUNING.typeCharsPerSecond);
    expect(writer.visible).toBe('O');
    writer.advance((1000 / UI_TUNING.typeCharsPerSecond) * 3);
    expect(writer.visible).toBe('Oui.');
    // La pause après le point retient la lettre suivante.
    writer.advance(1000 / UI_TUNING.typeCharsPerSecond);
    expect(writer.visible).toBe('Oui.');
    expect(babble.length).toBe(1);
    writer.revealAll();
    expect(writer.done).toBe(true);
    expect(writer.visible).toBe('Oui. Bien');
    writer.start('Tout de suite', true);
    expect(writer.done).toBe(true);
  });

  it('dialogue: trois lignes de 60 caractères au plus par page', () => {
    const text = 'mot '.repeat(80).trim();
    const pages = paginate(text);
    expect(pages.length).toBeGreaterThan(1);
    for (const page of pages) {
      const lines = page.split('\n');
      expect(lines.length).toBeLessThanOrEqual(UI_TUNING.linesPerPage);
      for (const line of lines) expect(line.length).toBeLessThanOrEqual(UI_TUNING.charsPerLine);
    }
  });

  it('bulle: verbe de la cible, raison du refus en texte court', () => {
    const world = createWorld(content, SEED, MEMBERS);
    const keys = { act: 'Espace', board: 'Entrée' };
    const ok = promptModel(
      content,
      world,
      0,
      { kind: 'villager', id: 'x', action: 'talk', verb: 'Parler', refusal: null, x: 0, y: 0 },
      keys,
    );
    expect(ok).toMatchObject({ kind: 'act', key: 'Espace', verb: 'Parler', refusal: null });
    const no = promptModel(
      content,
      world,
      0,
      {
        kind: 'ground',
        id: 'sol-1',
        action: 'pickup',
        verb: 'Ramasser',
        refusal: 'pockets-full',
        x: 0,
        y: 0,
      },
      keys,
    );
    expect(no?.refusal).toBe('Poches pleines');
  });

  it('cases: nom en 4 mots, pile pleine, usure; grille et direction de l’autre', () => {
    expect(shortName('Un très grand panier de pommes')).toBe('Un très grand panier');
    const full = slotModel(content, { item: 'buche', count: 5 });
    expect(full).toMatchObject({ count: 5, limit: 5, full: true, wear: null });
    expect(gridMove(4, 10, 5, 'right')).toBe(4);
    expect(gridMove(4, 10, 5, 'down')).toBe(9);
    const east = otherDirection({ x: 0, y: 0 }, { x: 5, y: 0 }, 0);
    expect(east.angle).toBeCloseTo(Math.PI / 2);
    expect(east.distance).toBe(5);
  });
});
