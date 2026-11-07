import { describe, expect, it } from 'vitest';
import { unlockMeansEscape } from '../src/input';
import { createInputState } from '../src/input-state';
import { keyLabel } from '../src/keys';

const actions = [
  { id: 'up', label: 'Avancer', keys: ['KeyW', 'ArrowUp'] },
  { id: 'act', label: 'Agir', keys: ['Space'], mouse: ['left' as const] },
  { id: 'tool-next', label: 'Outil suivant', keys: [], mouse: ['wheel-down' as const] },
  { id: 'pause-menu', label: 'Carnet', keys: ['Tab'], rebindable: false },
];

describe('libellés des touches', () => {
  it('affiche AZERTY quand la disposition est inconnue', () => {
    expect(keyLabel('KeyW', null)).toBe('Z');
    expect(keyLabel('KeyA', null)).toBe('Q');
    expect(keyLabel('KeyQ', null)).toBe('A');
    expect(keyLabel('KeyD', null)).toBe('D');
    expect(keyLabel('Semicolon', null)).toBe('M');
    expect(keyLabel('Digit1', null)).toBe('1');
    expect(keyLabel('Space', null)).toBe('Espace');
  });

  it('suit la disposition donnée par le navigateur', () => {
    const qwerty = new Map([
      ['KeyW', 'w'],
      ['KeyA', 'a'],
    ]);
    expect(keyLabel('KeyW', qwerty)).toBe('W');
    expect(keyLabel('KeyA', qwerty)).toBe('A');
    expect(keyLabel('KeyQ', qwerty)).toBe('A');
  });
});

describe('état des actions', () => {
  it('voit un appui pendant un seul pas, et la touche tenue jusqu’au relâchement', () => {
    const s = createInputState(actions, {});
    expect(s.keyDown('KeyW')).toBe(true);
    expect(s.keyDown('KeyX')).toBe(false);
    expect(s.isDown('up') && s.wasPressed('up')).toBe(true);
    s.endStep();
    expect(s.isDown('up')).toBe(true);
    expect(s.wasPressed('up')).toBe(false);
    s.keyDown('KeyW');
    expect(s.wasPressed('up')).toBe(false);
    s.keyUp('KeyW');
    expect(s.isDown('up')).toBe(false);
    expect(s.wasReleased('up')).toBe(true);
  });

  it('tient une action tant qu’une de ses sources est enfoncée', () => {
    const s = createInputState(actions, {});
    s.keyDown('Space');
    s.mouseDown('left');
    s.keyUp('Space');
    expect(s.isDown('act')).toBe(true);
    s.mouseUp('left');
    expect(s.isDown('act')).toBe(false);
  });

  it('traduit un cran de molette en appui bref', () => {
    const s = createInputState(actions, {});
    s.wheel('wheel-down');
    expect(s.wasPressed('tool-next')).toBe(true);
    expect(s.isDown('tool-next')).toBe(false);
    s.endStep();
    expect(s.wasPressed('tool-next')).toBe(false);
  });

  it('applique les réaffectations, sauf pour une action non réaffectable', () => {
    const s = createInputState(actions, { up: ['KeyI'], 'pause-menu': ['KeyP'] });
    expect(s.keyDown('KeyW')).toBe(false);
    s.keyDown('KeyI');
    expect(s.isDown('up')).toBe(true);
    expect(s.keysOf('pause-menu')).toEqual(['Tab']);
  });

  it('relâche tout à la perte du focus', () => {
    const s = createInputState(actions, {});
    s.keyDown('KeyW');
    s.mouseDown('left');
    s.endStep();
    s.releaseAll();
    expect(s.isDown('up') || s.isDown('act')).toBe(false);
    expect(s.wasReleased('up') && s.wasReleased('act')).toBe(true);
    expect(s.frame()).toEqual({ down: [], pressed: [], released: ['up', 'act'] });
  });
});

describe('pointeur rendu sans demande du jeu', () => {
  it('vaut Échap fenêtre active, pas après Alt+Tab ni quand le jeu l’a rendu', () => {
    expect(unlockMeansEscape({ requested: false, visible: true, focused: true })).toBe(true);
    expect(unlockMeansEscape({ requested: false, visible: true, focused: false })).toBe(false);
    expect(unlockMeansEscape({ requested: false, visible: false, focused: true })).toBe(false);
    expect(unlockMeansEscape({ requested: true, visible: true, focused: true })).toBe(false);
  });
});
