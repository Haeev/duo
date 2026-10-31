import { describe, expect, it } from 'vitest';
import {
  type Box,
  cycle,
  defaultBagSlot,
  defaultChoice,
  defaultCrateLine,
  defaultLetter,
  defaultNightButton,
  defaultProduct,
  defaultQuest,
  directionOf,
  spatialNeighbour,
} from '../focus';

/** Grille de cases de 50 px: barre d'outils de 10, puis un sac de 7 colonnes (formes différentes). */
function grid(): Box[] {
  const boxes: Box[] = [];
  for (let i = 0; i < 10; i++) boxes.push({ x: i * 56, y: 0, w: 50, h: 50 });
  for (let i = 0; i < 14; i++) boxes.push({ x: (i % 7) * 56, y: 80 + Math.floor(i / 7) * 56, w: 50, h: 50 });
  return boxes;
}

function neighbour(from: number, direction: Parameters<typeof spatialNeighbour>[2]): number {
  const boxes = grid();
  const origin = boxes[from];
  if (origin === undefined) throw new Error('case');
  const others = boxes.map((b, i) => ({ b, i })).filter(({ i }) => i !== from);
  const index = spatialNeighbour(origin, others.map(({ b }) => b), direction);
  return index < 0 ? -1 : (others[index]?.i ?? -1);
}

describe('navigation spatiale', () => {
  it('lit les flèches, et Z Q S D par position seulement dans les panneaux du jeu', () => {
    expect(directionOf('ArrowUp', false)).toBe('up');
    expect(directionOf('KeyW', true)).toBe('up');
    expect(directionOf('KeyA', true)).toBe('left');
    expect(directionOf('KeyW', false)).toBeNull();
    expect(directionOf('KeyQ', true)).toBeNull();
  });

  it('va au voisin le plus proche dans la direction, même entre deux grilles de formes différentes', () => {
    expect(neighbour(0, 'right')).toBe(1);
    expect(neighbour(0, 'down')).toBe(10);
    expect(neighbour(9, 'down')).toBe(16);
    expect(neighbour(10, 'up')).toBe(0);
    expect(neighbour(17, 'up')).toBe(10);
    expect(neighbour(0, 'left')).toBe(-1);
  });

  it('boucle sur une liste', () => {
    expect(cycle(2, 3, 1)).toBe(0);
    expect(cycle(0, 3, -1)).toBe(2);
    expect(cycle(0, 0, 1)).toBe(-1);
  });
});

describe('focus par défaut (maquettes, section 6)', () => {
  it('sac: la case en main si elle est occupée, sinon la première occupée', () => {
    expect(defaultBagSlot([true, true, false], 1)).toBe(1);
    expect(defaultBagSlot([false, false, true], 0)).toBe(2);
    expect(defaultBagSlot([false, false], 1)).toBe(0);
  });

  it('caisse: le premier « Déposer », sinon la première ligne', () => {
    expect(defaultCrateLine([{ canDeposit: false }, { canDeposit: true }])).toBe(1);
    expect(defaultCrateLine([{ canDeposit: false }, { canDeposit: false }])).toBe(0);
  });

  it('catalogue: le premier article commandable', () => {
    expect(defaultProduct([{ available: false }, { available: true }, { available: true }])).toBe(1);
    expect(defaultProduct([{ available: false }])).toBe(0);
  });

  it('quêtes: la quête en cours, sinon la première non finie', () => {
    const quests = [
      { id: 'a', done: true },
      { id: 'b', done: false },
      { id: 'c', done: false },
    ];
    expect(defaultQuest(quests, 'c')).toBe(2);
    expect(defaultQuest(quests, null)).toBe(1);
    expect(defaultQuest([{ id: 'a', done: true }], 'z')).toBe(0);
  });

  it('courrier: la plus ancienne lettre non lue, sinon la plus récente', () => {
    expect(defaultLetter([{ unread: true }, { unread: true }, { unread: false }])).toBe(1);
    expect(defaultLetter([{ unread: false }, { unread: false }])).toBe(0);
  });

  it('dialogue: ma réplique choisie, sinon la première active, sinon « Suite »', () => {
    expect(defaultChoice([{ pressed: false, disabled: true }, { pressed: true, disabled: false }])).toBe(1);
    expect(defaultChoice([{ pressed: false, disabled: false }, { pressed: false, disabled: false }])).toBe(0);
    expect(defaultChoice([])).toBe(-1);
  });

  it('nuit: le choix déjà fait, sinon Continuer', () => {
    expect(defaultNightButton(null)).toBe('continue');
    expect(defaultNightButton('finish')).toBe('finish');
  });
});
