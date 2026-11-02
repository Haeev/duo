// Notes de version affichées sur l'écran titre: ce qui a changé à chaque version du jeu.
// Le fichier voyage avec le paquet du jeu, donc une mise à jour apporte ses propres notes.
import * as v from 'valibot';
import notes from '../../donnees/notes-de-version.json';

const VersionNoteSchema = v.object({
  version: v.pipe(v.string(), v.regex(/^\d+\.\d+\.\d+$/)),
  titre: v.pipe(v.string(), v.minLength(1)),
  changements: v.pipe(v.array(v.pipe(v.string(), v.minLength(1))), v.minLength(1)),
});

const ReleaseNotesSchema = v.object({
  version: v.literal(1),
  notes: v.pipe(v.array(VersionNoteSchema), v.minLength(1)),
});

export type VersionNote = v.InferOutput<typeof VersionNoteSchema>;

/** Notes validées, de la plus récente à la plus ancienne. */
export function releaseNotes(raw: unknown = notes): readonly VersionNote[] {
  return v.parse(ReleaseNotesSchema, raw).notes;
}
