import { mkdtemp, readdir, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { parseGameMessage } from '@duo/protocol';
import { describe, expect, it } from 'vitest';
import { createNotebookStore } from '../../src/main/notebook';

async function tempDir(): Promise<string> {
  return mkdtemp(path.join(tmpdir(), "duo carnet d'Hélène "));
}

const bytes = (text: string): Uint8Array => new TextEncoder().encode(text);
const context = { gameId: 'la-petite-ligne', details: { duo: '0.3.0' } };

describe('carnet de séance, côté plateforme (pont 1.1)', () => {
  it('écrit une note en deux envois dans un seul dossier daté, accents et espaces compris', async () => {
    const dir = await tempDir();
    const root = path.join(dir, 'Documents de Zoé', 'Duo', 'carnet-de-seance');
    const store = await createNotebookStore({
      root,
      settingsFile: path.join(dir, 'carnet-de-seance.json'),
      available: true,
      now: () => new Date(2026, 10, 4, 21, 5, 9),
    });
    expect(
      await store.write(context, 'n1', [
        { name: 'note.txt', data: bytes('La barrière ne baisse pas.') },
        { name: '0001-moins-09-7s.jpg', data: bytes('jpeg') },
      ]),
    ).toBe('ok');
    expect(
      await store.write(context, 'n1', [
        { name: '0002-plus-03-4s.jpg', data: bytes('jpeg') },
        { name: 'planche.jpg', data: bytes('jpeg') },
        { name: 'ecran-fin.jpg', data: bytes('jpeg') },
      ]),
    ).toBe('ok');
    const folder = path.join(root, '2026-11-04', '21h05m09s-la-petite-ligne');
    expect((await readdir(folder)).sort()).toEqual([
      'ecran-fin.jpg',
      'images',
      'note.txt',
      'planche.jpg',
      'plateforme.json',
    ]);
    expect((await readdir(path.join(folder, 'images'))).sort()).toEqual([
      '0001-moins-09-7s.jpg',
      '0002-plus-03-4s.jpg',
    ]);
    expect(await readFile(path.join(folder, 'note.txt'), 'utf8')).toBe(
      'La barrière ne baisse pas.',
    );
    expect(await readFile(path.join(root, 'LISEZMOI.txt'), 'utf8')).toContain('Carnet de séance');

    // Une deuxième note dans la même seconde: dossier suffixé, jamais écrasé.
    await store.write(context, 'n2', [{ name: 'note.txt', data: bytes('Autre') }]);
    expect(await readdir(path.join(root, '2026-11-04'))).toContain('21h05m09s-la-petite-ligne-2');
  });

  it("coupé, il n'écrit rien et garde le réglage d'un lancement à l'autre", async () => {
    const dir = await tempDir();
    const settingsFile = path.join(dir, 'carnet-de-seance.json');
    const root = path.join(dir, 'carnet');
    const store = await createNotebookStore({ root, settingsFile, available: true });
    expect(store.enabled()).toBe(true);
    await store.setEnabled(false);
    expect(await store.write(context, 'n1', [{ name: 'note.txt', data: bytes('x') }])).toBe(
      'disabled',
    );
    await expect(readdir(root)).rejects.toThrow();
    const again = await createNotebookStore({ root, settingsFile, available: true });
    expect(again.enabled()).toBe(false);
  });

  it("hors macOS, le carnet n'est pas offert", async () => {
    const dir = await tempDir();
    const store = await createNotebookStore({
      root: path.join(dir, 'carnet'),
      settingsFile: path.join(dir, 'carnet-de-seance.json'),
      available: false,
    });
    expect(store.enabled()).toBe(false);
    expect(await store.write(context, 'n1', [{ name: 'note.txt', data: bytes('x') }])).toBe(
      'disabled',
    );
  });

  it('le pont refuse les noms de fichiers qui sortiraient du dossier de la note', () => {
    const write = (name: string): unknown =>
      parseGameMessage({
        type: 'notebookWrite',
        requestId: 1,
        entry: 'n1',
        files: [{ name, data: new ArrayBuffer(4) }],
      });
    expect(write('0001-moins-09-7s.jpg')).not.toBeNull();
    expect(write('note.txt')).not.toBeNull();
    for (const bad of [
      '../note.txt',
      'images/a.jpg',
      'a\\b.jpg',
      'note.exe',
      '.cache.json',
      'Note.txt',
    ]) {
      expect(write(bad)).toBeNull();
    }
    expect(
      parseGameMessage({
        type: 'notebookWrite',
        requestId: 1,
        entry: '../x',
        files: [{ name: 'note.txt', data: new ArrayBuffer(4) }],
      }),
    ).toBeNull();
  });
});
