import { describe, expect, it } from 'vitest';
import {
  clock,
  de,
  durationRange,
  fr,
  keyLabel,
  playedDuration,
  t,
  toastText,
  typo,
  when,
} from '../../src/renderer/textes';
import type { ToastKind } from '../../src/shared/state';

const NBSP = String.fromCharCode(0xa0);
const NNBSP = String.fromCharCode(0x202f);
const FORBIDDEN_DASHES = [String.fromCharCode(0x2014), String.fromCharCode(0x2013)];

/** Tous les textes produits par le fichier, avec des noms d'exemple. */
function allTexts(): string[] {
  const out: string[] = [];
  const visit = (value: unknown): void => {
    if (typeof value === 'string') out.push(value);
    else if (typeof value === 'function') {
      const fn = value as (...args: unknown[]) => unknown;
      visit(fn('Sacha', 'Camille'));
      visit(fn(3));
    } else if (Array.isArray(value)) value.forEach(visit);
    else if (typeof value === 'object' && value !== null) Object.values(value).forEach(visit);
  };
  visit(t);
  const kinds: ToastKind[] = [
    'joined',
    'left-salon',
    'closed-salon',
    'asked-wait',
    'other-save',
    'back',
    'stopped-match',
    'quit-duo',
  ];
  for (const kind of kinds) out.push(toastText(kind, 'Sacha'));
  return out;
}

describe('typographie du fichier de textes (UX 0.3)', () => {
  const texts = allTexts();

  it('produit des textes', () => {
    expect(texts.length).toBeGreaterThan(100);
  });

  it('pose une espace insécable avant « : » et dans les guillemets, une fine avant ; ! ? %', () => {
    for (const text of texts) {
      expect(text, text).not.toMatch(/ [:;!?%]/);
      expect(text, text).not.toMatch(/« | »/);
    }
    expect(fr`Toi : 80 %`).toBe(`Toi${NBSP}: 80${NNBSP}%`);
  });

  it('n’emploie ni tiret cadratin ni demi-cadratin, ni apostrophe droite, ni trois points', () => {
    for (const text of texts) {
      for (const dash of FORBIDDEN_DASHES) expect(text.includes(dash), text).toBe(false);
      expect(text.includes('...'), text).toBe(false);
    }
    const straight = texts.filter((text) => text.includes("'"));
    expect(straight).toEqual([]);
  });

  it('ne retouche pas les pseudos', () => {
    expect(fr`${"L'Ami"} a rejoint le salon : ${'oui'} !`).toBe(
      `L'Ami a rejoint le salon${NBSP}: oui${NNBSP}!`,
    );
  });

  it('élide « de » devant une voyelle ou un h', () => {
    expect(de('Sacha')).toBe('de Sacha');
    expect(de('Inès')).toBe('d’Inès');
    expect(de('Hélène')).toBe('d’Hélène');
    expect(typo("l'autre")).toBe('l’autre');
  });
});

describe('durées et dates (UX 0.3)', () => {
  it('écrit les plages sans tiret', () => {
    expect(durationRange([20, 40])).toBe(`20 à 40${NBSP}min`);
    expect(durationRange([45, 90])).toBe(`45${NBSP}min à 1${NBSP}h${NBSP}30`);
    expect(durationRange([60, 60])).toBe(`1${NBSP}h`);
  });

  it('écrit les durées jouées et le compteur de coupure', () => {
    expect(playedDuration(192_000)).toBe('3 min 12 s');
    expect(playedDuration(4_320_000)).toBe('1 h 12');
    expect(clock(42_500)).toBe('0:42');
  });

  it('écrit « hier à 21 h 40 » et « 12 octobre à 20 h 05 »', () => {
    const now = new Date(2026, 9, 31, 10, 0).getTime();
    expect(when(new Date(2026, 9, 30, 21, 40).getTime(), now)).toBe('hier à 21 h 40');
    expect(when(new Date(2026, 9, 12, 20, 5).getTime(), now)).toBe('12 octobre à 20 h 05');
    expect(when(new Date(2026, 9, 31, 8, 3).getTime(), now)).toBe('aujourd’hui à 8 h 03');
  });
});

describe('libellés des touches selon la disposition réelle', () => {
  it('affiche Z pour KeyW sur un clavier AZERTY', () => {
    const azerty = new Map([
      ['KeyW', 'z'],
      ['KeyA', 'q'],
    ]);
    expect(keyLabel('KeyW', azerty)).toBe('Z');
    expect(keyLabel('KeyA', azerty)).toBe('Q');
    expect(keyLabel('Space', azerty)).toBe('Espace');
    expect(keyLabel('KeyW', null)).toBe('W');
    expect(keyLabel('Digit3', null)).toBe('3');
  });
});
