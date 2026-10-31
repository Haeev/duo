import { describe, expect, it } from 'vitest';
import {
  isBridgeCompatible,
  parseBridgeVersion,
  parseGameMessage,
  parseManifest,
  parsePlatformMessage,
} from '../src/index';

const manifest = {
  schema: 1,
  id: 'la-petite-ligne',
  name: 'La Petite Ligne',
  version: '0.1.0',
  sdk: '1.0',
  view: 'iso',
  engine: 'three',
  mode: 'coop',
  play: 'session',
  durationMinutes: [50, 75],
  network: 'host-authority',
  entry: 'index.html',
  thumbnail: 'vignette.webp',
  description: 'Une semaine à deux au bout de la petite ligne.',
  whatsNew: '',
  actions: [
    { id: 'up', label: 'Avancer', keys: ['KeyW'] },
    { id: 'act', label: 'Agir', keys: ['Space'], mouse: ['left'] },
  ],
  saves: {
    slots: 1,
    maxBytes: 1_000_000,
    moments: ['level-end', 'exit'],
    help: 'Le jeu enregistre à l’aube.',
  },
  credits: null,
};

describe('manifeste duo-game.json', () => {
  it('accepte un manifeste conforme', () => {
    expect(parseManifest(manifest)).toMatchObject({ ok: true });
  });

  it.each([
    ['identifiant', { id: 'La-Petite' }, 'id'],
    ['version', { version: '1.0' }, 'version'],
    ['Échap', { actions: [{ id: 'menu', label: 'Menu', keys: ['Escape'] }] }, 'actions.0.keys.0'],
    ['actions en double', { actions: [manifest.actions[0], manifest.actions[0]] }, 'actions'],
    ['durée', { durationMinutes: [80, 60] }, 'durationMinutes'],
    ['champ inconnu', { couleur: 'rouge' }, 'couleur'],
    ['auto sans période', { saves: { slots: 1, maxBytes: 10, moments: ['auto'] } }, 'saves'],
    [
      'sauvegarde trop grosse',
      { saves: { slots: 1, maxBytes: 40_000_000, moments: ['exit'] } },
      'saves.maxBytes',
    ],
  ])('refuse: %s', (_name, change, path) => {
    const result = parseManifest({ ...manifest, ...change });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues.join('\n')).toContain(path);
  });
});

describe('versions du pont', () => {
  it('lit majeure.mineure et applique la règle de compatibilité', () => {
    expect(parseBridgeVersion('1.12')).toEqual({ major: 1, minor: 12 });
    expect(parseBridgeVersion('1')).toBeNull();
    expect(parseBridgeVersion('01.2')).toBeNull();
    expect(isBridgeCompatible('1.2', '1.4')).toBe(true);
    expect(isBridgeCompatible('1.4', '1.2')).toBe(false);
    expect(isBridgeCompatible('1.0', '2.0')).toBe(false);
    expect(isBridgeCompatible('x', '1.0')).toBe(false);
  });
});

describe('messages du pont', () => {
  it('valide les messages du jeu et de la plateforme', () => {
    expect(parseGameMessage({ type: 'ready' })).toEqual({ type: 'ready' });
    expect(
      parseGameMessage({ type: 'net', channel: 2, mode: 'latest', data: '{}' }),
    ).not.toBeNull();
    expect(parseGameMessage({ type: 'net', channel: 16, mode: 'latest', data: '{}' })).toBeNull();
    expect(
      parseGameMessage({ type: 'net', channel: 0, mode: 'latest', data: 'x'.repeat(70_000) }),
    ).toBeNull();
    expect(
      parseGameMessage({
        type: 'saveWrite',
        requestId: 1,
        moment: 'exit',
        label: 'Jour 1',
        dataSchema: 1,
        data: new ArrayBuffer(2),
      }),
    ).not.toBeNull();
    expect(
      parseGameMessage({
        type: 'saveWrite',
        requestId: 1,
        moment: 'exit',
        label: 'Jour 1',
        dataSchema: 1,
        data: 'texte',
      }),
    ).toBeNull();
    expect(parsePlatformMessage({ type: 'stop', reason: 'quit', save: true })).not.toBeNull();
    expect(parsePlatformMessage({ type: 'stop', reason: 'parce que', save: true })).toBeNull();
    expect(parsePlatformMessage({ type: 'inconnu' })).toBeNull();
  });
});
