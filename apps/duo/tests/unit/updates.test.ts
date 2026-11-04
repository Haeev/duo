// Patch 0.3.1: contrôle rapide du catalogue et blocage du lancement pendant une mise à jour.
import { describe, expect, it } from 'vitest';
import { GameUpdater, type UpdatesSnapshot } from '../../src/main/games/updater';
import { launchGate } from '../../src/shared/updates';
import type { Journal } from '../../src/main/journal';

const journal = { write: () => undefined } as unknown as Journal;

type FetchImpl = (url: string, init: { readonly signal: AbortSignal }) => Promise<Response>;

function updater(fetchImpl: FetchImpl, seen: UpdatesSnapshot[]): GameUpdater {
  return new GameUpdater({
    catalogueUrl: 'https://exemple.invalid/catalogue.json',
    fetch: fetchImpl,
    incomingDir: '/tmp/duo-essai-maj-inexistant',
    install: () => Promise.reject(new Error('jamais appelé')),
    effectiveVersion: () => '1.0.0',
    isIdle: () => true,
    allowUrl: () => true,
    onInstalled: () => undefined,
    journal,
    retryDelaysMs: [],
    catalogueTimeoutMs: 50,
    onStatus: (snapshot) => {
      seen.push(snapshot);
    },
  });
}

describe('règle de lancement', () => {
  it('bloque pendant le contrôle, le téléchargement et l’installation', () => {
    expect(launchGate(null, { kind: 'checking' }).kind).toBe('checking');
    expect(launchGate({ kind: 'available', version: '1.1.0' }, { kind: 'ok' }).kind).toBe(
      'updating',
    );
    expect(
      launchGate({ kind: 'downloading', version: '1.1.0', progress: 0.45 }, { kind: 'ok' }).kind,
    ).toBe('updating');
    expect(launchGate({ kind: 'installing', version: '1.1.0' }, { kind: 'ok' }).kind).toBe(
      'updating',
    );
  });

  it('échec: bloqué jusqu’à « Jouer quand même », puis jouable', () => {
    expect(
      launchGate({ kind: 'failed', version: '1.1.0', playAnyway: false }, { kind: 'ok' }).kind,
    ).toBe('failed');
    expect(
      launchGate({ kind: 'failed', version: '1.1.0', playAnyway: true }, { kind: 'ok' }).kind,
    ).toBe('open');
  });

  it('catalogue injoignable ou à jour: jamais bloqué', () => {
    expect(launchGate(null, { kind: 'unreachable' }).kind).toBe('open');
    expect(launchGate(null, { kind: 'never' }).kind).toBe('open');
    expect(launchGate({ kind: 'done', version: '1.1.0' }, { kind: 'ok' }).kind).toBe('open');
  });
});

describe('contrôle rapide', () => {
  it('délai dépassé: « injoignable » en moins d’une seconde, rien de bloqué', async () => {
    const seen: UpdatesSnapshot[] = [];
    // Catalogue qui ne répond jamais: seul le délai court met fin à l'attente.
    const hanging: FetchImpl = (_url, init) =>
      new Promise((_resolve, reject) => {
        init.signal.addEventListener('abort', () => {
          reject(new Error('délai dépassé'));
        });
      });
    const started = Date.now();
    const result = await updater(hanging, seen).check();
    expect(Date.now() - started).toBeLessThan(1000);
    expect(result).toMatchObject({ kind: 'failed', step: 'catalogue' });
    expect(seen.map((snapshot) => snapshot.check.kind)).toEqual(['checking', 'unreachable']);
    const last = seen.at(-1);
    expect(last === undefined ? null : launchGate(null, last.check).kind).toBe('open');
  });

  it('téléchargement en échec: bloqué, « Réessayer » relance, « Jouer quand même » débloque', async () => {
    const seen: UpdatesSnapshot[] = [];
    let catalogueCalls = 0;
    const catalogue = JSON.stringify({
      schema: 1,
      jeux: [
        {
          id: 'essai-pont',
          version: '1.1.0',
          manifeste: {
            nom: 'Essai du pont',
            description: 'Essai.',
            mode: 'coop',
            duree: [1, 10],
            sdk: '1.0',
          },
          taille: 10,
          url: 'https://exemple.invalid/essai-pont-1.1.0.duogame',
          sha256: 'a'.repeat(64),
        },
      ],
    });
    const fetchImpl: FetchImpl = (url) => {
      if (url.endsWith('catalogue.json')) {
        catalogueCalls += 1;
        return Promise.resolve(new Response(catalogue));
      }
      return Promise.resolve(new Response('', { status: 503 }));
    };
    const instance = updater(fetchImpl, seen);
    expect(await instance.check()).toMatchObject({ kind: 'failed', step: 'download' });
    const kinds = seen.map((snapshot) => snapshot.games.get('essai-pont')?.kind ?? null);
    expect(kinds).toContain('available');
    expect(kinds).toContain('downloading');
    const failed = instance.snapshot().games.get('essai-pont') ?? null;
    expect(failed).toEqual({ kind: 'failed', version: '1.1.0', playAnyway: false });
    expect(launchGate(failed, instance.snapshot().check).kind).toBe('failed');

    await instance.retry();
    expect(catalogueCalls).toBe(2);

    instance.playAnyway('essai-pont');
    const accepted = instance.snapshot().games.get('essai-pont') ?? null;
    expect(launchGate(accepted, instance.snapshot().check).kind).toBe('open');
    // Le choix tient à la recherche suivante, tant que la même version échoue.
    await instance.retry();
    const after = instance.snapshot();
    expect(launchGate(after.games.get('essai-pont') ?? null, after.check).kind).toBe('open');
  });
});
