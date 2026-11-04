// Carnet de séance (pont 1.1), côté SDK: noms et légendes des images, inertie sans DOM ni offre.
import { parsePlatformMessage } from '@duo/protocol';
import { describe, expect, it } from 'vitest';
import { createNotebook, offsetLabel, offsetName } from '../src/notebook';

describe('carnet de séance, côté SDK', () => {
  it('nomme les images par leur écart à la note, triables et lisibles', () => {
    expect(offsetName(-9_740)).toBe('moins-09-7s');
    expect(offsetName(3_420)).toBe('plus-03-4s');
    expect(offsetName(12_000)).toBe('plus-12-0s');
    expect(offsetLabel(-9_740)).toBe('-9,7 s');
    expect(offsetLabel(3_420)).toBe('+3,4 s');
  });

  it('reste inerte sans DOM, même offert par la plateforme', () => {
    const sent: unknown[] = [];
    const notebook = createNotebook({
      offer: { enabled: true },
      send: (message) => sent.push(message),
      releaseKeys: () => undefined,
      describe: () => ({}),
    });
    expect(notebook.available).toBe(false);
    expect(notebook.enabled).toBe(false);
    notebook.attach({ canvas: () => null });
    notebook.afterRender();
    notebook.trace('essai');
    expect(sent).toEqual([]);
    notebook.dispose();
  });

  it("un init du pont 1.1 porte l'offre du carnet; un init sans elle reste valide", () => {
    const init = {
      type: 'init',
      bridge: '1.1',
      matchId: 'partie-1',
      role: 'host',
      localPlayerId: 'a',
      players: [
        { id: 'a', role: 'host', name: 'Alex', color: 'orb', colorHex: '#5CE1E6', local: true },
        { id: 'b', role: 'guest', name: 'Sacha', color: 'sun', colorHex: '#FC663F', local: false },
      ],
      seed: 1,
      game: { id: 'essai', version: '1.0.0' },
      settings: {
        volumes: { master: 1, music: 1, effects: 1, interface: 1 },
        uiScale: 1,
        reducedMotion: false,
        bindings: {},
      },
      saveSlot: 1,
      save: null,
      clockOffsetMs: 0,
    };
    expect(parsePlatformMessage(init)).not.toBeNull();
    const withOffer = parsePlatformMessage({ ...init, notebook: { enabled: false } });
    expect(withOffer?.type === 'init' ? withOffer.notebook : null).toEqual({ enabled: false });
  });
});
