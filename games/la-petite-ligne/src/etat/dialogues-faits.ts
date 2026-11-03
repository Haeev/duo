/**
 * Dialogues finis (`world.dialoguesDone`): `<id>` pour une scène à deux, `<id>@<joueur>` pour une
 * conversation finie par ce joueur. Depuis le format 8, une conversation ne s'écrit plus aussi sous
 * `<id>` seul (une entrée de moins sur trois, environ 1,4 Ko sur une longue partie): « finie par
 * l'un des deux » se lit sur les trois formes.
 */
import type { CharacterId } from './types';

const PLAYERS: readonly CharacterId[] = ['p1', 'p2'];

export function dialogueDone(done: readonly string[], id: string): boolean {
  return done.includes(id) || PLAYERS.some((p) => done.includes(`${id}@${p}`));
}

/** Retire les `<id>` seuls que redit un `<id>@<joueur>` (migration vers le format 8). */
export function compactDialoguesDone(done: readonly string[]): string[] {
  const all = new Set(done);
  return done.filter((d) => d.includes('@') || !PLAYERS.some((p) => all.has(`${d}@${p}`)));
}
