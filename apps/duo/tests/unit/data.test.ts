import { mkdtemp, readdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import * as v from 'valibot';
import { describe, expect, it } from 'vitest';
import { LocalSaves } from '../../src/main/data/local-saves';
import { readJsonSafe, writeJsonSafe } from '../../src/main/data/safe-write';
import { MachineStore } from '../../src/main/data/store';

async function tempDir(): Promise<string> {
  return mkdtemp(path.join(tmpdir(), "duo données d'Hélène "));
}

describe('écriture sûre (ADR 0009, point 4)', () => {
  const Schema = v.object({ schema: v.literal(1), valeur: v.number() });

  it('écrit, garde la version précédente en .bak et ne laisse aucun fichier temporaire', async () => {
    const dir = await tempDir();
    const file = path.join(dir, 'réglages.json');
    await writeJsonSafe(file, { schema: 1, valeur: 1 });
    await writeJsonSafe(file, { schema: 1, valeur: 2 });
    expect(JSON.parse(await readFile(file, 'utf8'))).toEqual({ schema: 1, valeur: 2 });
    expect(JSON.parse(await readFile(`${file}.bak`, 'utf8'))).toEqual({ schema: 1, valeur: 1 });
    expect((await readdir(dir)).filter((name) => name.endsWith('.tmp'))).toEqual([]);
  });

  it('sérialise les écritures concurrentes du même fichier', async () => {
    const dir = await tempDir();
    const file = path.join(dir, 'x.json');
    await Promise.all(Array.from({ length: 20 }, (_, index) => writeJsonSafe(file, { schema: 1, valeur: index })));
    const read = await readJsonSafe(file, Schema);
    expect(read).toMatchObject({ status: 'ok', value: { valeur: 19 } });
  });

  it('récupère la copie .bak d’un fichier abîmé et garde le fichier abîmé à part', async () => {
    const dir = await tempDir();
    const file = path.join(dir, 'profil.json');
    await writeJsonSafe(file, { schema: 1, valeur: 1 });
    await writeJsonSafe(file, { schema: 1, valeur: 2 });
    await writeFile(file, '{ tronqué');
    const read = await readJsonSafe(file, Schema, new Date('2026-10-31T01:02:03Z'));
    expect(read).toEqual({ status: 'ok', value: { schema: 1, valeur: 1 }, from: 'backup' });
    const names = await readdir(dir);
    expect(names.some((name) => name.startsWith('profil.json.abime-2026-10-31'))).toBe(true);
  });
});

describe('données de la machine', () => {
  it('crée l’identifiant de la machine, puis relit profil et réglages', async () => {
    const dir = await tempDir();
    const store = new MachineStore(dir);
    const first = await store.load();
    if ('kind' in first) throw new Error('format inattendu');
    expect(first.profile).toBeNull();
    expect(first.settings.networkAccepted).toBe(false);
    await store.saveProfile({ pseudo: 'Hélène', color: 'comet' });
    await store.saveSettings({ ...first.settings, networkAccepted: true });
    const second = await store.load();
    if ('kind' in second) throw new Error('format inattendu');
    expect(second.machineId).toBe(first.machineId);
    expect(second.profile).toEqual({ pseudo: 'Hélène', color: 'comet' });
    expect(second.settings.networkAccepted).toBe(true);
  });

  it('ne touche à rien si le dossier vient d’une version plus récente (M-29)', async () => {
    const dir = await tempDir();
    await writeFile(path.join(dir, 'format.json'), JSON.stringify({ schema: 1, format: 99 }));
    expect(await new MachineStore(dir).load()).toEqual({ kind: 'format-too-new', format: 99 });
  });
});

describe('sauvegardes du prototype', () => {
  it('écrit une révision nommée par son empreinte et relit la courante', async () => {
    const dir = await tempDir();
    const saves = new LocalSaves(dir);
    const data = new TextEncoder().encode(JSON.stringify({ jour: 3 }));
    await saves.write('la-petite-ligne', { label: 'Jour 3', progress: 0.3, dataSchema: 1, gameVersion: '0.1.0', data });
    const read = await saves.read('la-petite-ligne');
    expect(read?.summary.label).toBe('Jour 3');
    expect(read?.progress).toBe(0.3);
    expect(new TextDecoder().decode(read?.data)).toBe('{"jour":3}');
    const head = await saves.readHead('la-petite-ligne');
    expect(head?.revision).toBe(1);
    await saves.write('la-petite-ligne', { label: 'Jour 4', progress: null, dataSchema: 1, gameVersion: '0.1.0', data: new TextEncoder().encode('{"jour":4}') });
    expect((await saves.readHead('la-petite-ligne'))?.previous).toEqual([head?.sha256]);
  });
});
