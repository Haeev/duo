/**
 * Contrôles croisés des airs jouables et des instruments, appelés par `donnees/valider.ts`:
 * chaque faute nomme le fichier et le champ.
 */
import type { Content } from '../../donnees/charger';
import type { AirNote } from '../../donnees/schemas/air';

function checkNotes(
  where: string,
  notes: readonly AirNote[],
  lengthMs: number,
  minGapMs: number,
  problems: string[],
): void {
  let previous = -Infinity;
  notes.forEach((note, index) => {
    const at = `${where}[${String(index)}]`;
    if (note[0] >= lengthMs) problems.push(`${at}: note après la fin de l'extrait`);
    if (note[0] < previous) problems.push(`${at}: notes dans le désordre`);
    else if (note[0] - previous < minGapMs - 1)
      problems.push(`${at}: note à moins de ${String(minGapMs)} ms de la précédente`);
    previous = note[0];
  });
}

export function validateMusic(content: Content): string[] {
  const problems: string[] = [];
  const orders = new Map<number, string>();
  for (const air of Object.values(content.airs)) {
    const path = `commun/airs/${air.id}.json`;
    const entry = content.book.entries[air.id];
    if (entry === undefined)
      problems.push(`${path}: aucune fiche du carnet ne porte cet identifiant (commun/carnet/)`);
    else if (entry.source.type !== 'tune')
      problems.push(`${path}: la fiche du carnet « ${air.id} » n'est pas un air (source tune)`);
    const twin = orders.get(air.order);
    if (twin !== undefined) problems.push(`${path}, order: rang déjà pris par « ${twin} »`);
    orders.set(air.order, air.id);
    if (
      (air.voices.duo === undefined) !== (air.score?.duo === undefined) &&
      air.score !== undefined
    )
      problems.push(`${path}, score: voix de duo à refaire (pnpm partition ${air.id})`);
    if (air.score === undefined) continue;
    const { lengthMs, solo, duo } = air.score;
    checkNotes(`${path}, score.solo`, solo, lengthMs, air.source.minGapMs, problems);
    duo?.forEach((notes, voice) => {
      checkNotes(
        `${path}, score.duo[${String(voice)}]`,
        notes,
        lengthMs,
        air.source.minGapMs,
        problems,
      );
    });
  }
  for (const item of Object.values(content.items)) {
    if (item.instrument === undefined) continue;
    const path = `commun/objets/${item.id}.json`;
    if (item.stack !== 1) problems.push(`${path}, stack: un instrument ne s'empile pas (1)`);
  }
  return problems;
}
