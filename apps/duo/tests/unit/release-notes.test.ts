// Notes de version d'un jeu: le vrai fichier de La Petite Ligne passe la validation,
// un fichier absent ou abîmé laisse l'encadré du salon sur le seul `whatsNew`.
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { RELEASE_NOTES_FILE, readReleaseNotes } from '../../src/main/games/release-notes';

const LPL = path.resolve(import.meta.dirname, '../../../../games/la-petite-ligne');
const folders: string[] = [];

async function gameWith(content: string | null): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), 'duo notes é-'));
  folders.push(root);
  if (content !== null) {
    await mkdir(path.join(root, path.dirname(RELEASE_NOTES_FILE)), { recursive: true });
    await writeFile(path.join(root, RELEASE_NOTES_FILE), content);
  }
  return root;
}

afterEach(async () => {
  await Promise.all(folders.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe('notes de version des jeux', () => {
  it('lit les notes de La Petite Ligne, la plus récente en tête', async () => {
    const read = await readReleaseNotes(LPL);
    expect(read.status).toBe('ok');
    if (read.status !== 'ok') return;
    expect(read.notes.length).toBeGreaterThan(1);
    expect(read.notes[0]?.version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(read.notes[0]?.changes.length).toBeGreaterThan(0);
  });

  it('signale un fichier absent sans erreur', async () => {
    expect(await readReleaseNotes(await gameWith(null))).toEqual({ status: 'absent' });
  });

  it('refuse un fichier illisible ou hors schéma', async () => {
    expect((await readReleaseNotes(await gameWith('{ pas du json'))).status).toBe('invalid');
    const wrong = JSON.stringify({ version: 2, notes: [] });
    expect((await readReleaseNotes(await gameWith(wrong))).status).toBe('invalid');
    const noChanges = JSON.stringify({ version: 1, notes: [{ version: '1.0.0', titre: 'x' }] });
    expect((await readReleaseNotes(await gameWith(noChanges))).status).toBe('invalid');
  });
});
