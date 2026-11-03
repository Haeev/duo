// Notes de version fournies par un jeu, à côté de son `index.html`: fichier facultatif,
// lu à l'ouverture du salon et validé avant d'être montré (données externes).
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import * as v from 'valibot';
import type { ReleaseNote } from '../../shared/state';

/** Chemin conventionnel dans le dossier du jeu (La Petite Ligne le fournit). */
export const RELEASE_NOTES_FILE = path.join('donnees', 'notes-de-version.json');

const MAX_BYTES = 256 * 1024;

const ReleaseNotesSchema = v.object({
  version: v.literal(1),
  notes: v.pipe(
    v.array(
      v.object({
        version: v.pipe(v.string(), v.minLength(1), v.maxLength(32)),
        titre: v.pipe(v.string(), v.maxLength(120)),
        changements: v.pipe(
          v.array(v.pipe(v.string(), v.minLength(1), v.maxLength(600))),
          v.maxLength(60),
        ),
      }),
    ),
    v.maxLength(200),
  ),
});

export type ReleaseNotesRead =
  | { readonly status: 'ok'; readonly notes: readonly ReleaseNote[] }
  | { readonly status: 'absent' }
  | { readonly status: 'invalid'; readonly reason: string };

/** Lit et valide les notes du jeu servi depuis `root`. Ne lève jamais. */
export async function readReleaseNotes(root: string): Promise<ReleaseNotesRead> {
  let text: string;
  try {
    const buffer = await readFile(path.join(root, RELEASE_NOTES_FILE));
    if (buffer.byteLength > MAX_BYTES) return { status: 'invalid', reason: 'trop gros' };
    text = buffer.toString('utf8');
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'ENOENT' || code === 'ENOTDIR') return { status: 'absent' };
    return { status: 'invalid', reason: code ?? 'lecture impossible' };
  }
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { status: 'invalid', reason: 'JSON illisible' };
  }
  const parsed = v.safeParse(ReleaseNotesSchema, data);
  if (!parsed.success) {
    return { status: 'invalid', reason: parsed.issues.map((issue) => issue.message).join('; ') };
  }
  return {
    status: 'ok',
    notes: parsed.output.notes.map((note) => ({
      version: note.version,
      title: note.titre,
      changes: note.changements,
    })),
  };
}
