/**
 * L'air joué sur la machine du joueur (pur, testé dans Node): les frappes sont jugées ici, sur
 * l'horloge de l'air de cette machine, et chaque note jugée devient une intention `music_note`
 * que l'hôte valide. Le robot (`botPresses`) sert aux tests et à l'enregistrement d'écoute.
 */
import type { RandomSource } from '@duo/sdk/sim';
import type { AirNote } from '../../donnees/schemas/air';
import { judge, type Windows } from './jugement';
import type { Verdict } from './reglages';

/** Une note jugée: ce que la machine envoie à l'hôte, et ce qu'elle fait sonner tout de suite. */
export interface Hit {
  readonly index: number;
  /** Touche frappée (celle de la note pour une note manquée). */
  readonly lane: number;
  /** Écart à l'instant écrit (ms, négatif: en avance), `null`: pas de frappe. */
  readonly offsetMs: number | null;
  readonly verdict: Verdict;
}

export interface Performance {
  readonly notes: readonly AirNote[];
  /**
   * Appui sur une touche à l'instant `atMs` de l'air. Rend la note jugée, ou `null` pour une
   * frappe en l'air (aucune note à portée): elle ne coûte rien.
   */
  press(lane: number, atMs: number): Hit | null;
  /** L'horloge avance: rend les notes passées sans frappe. */
  advance(atMs: number): Hit[];
  /** Verdict de chaque note (`null`: pas encore jugée). */
  verdicts(): readonly (Verdict | null)[];
  /** Toutes les notes sont jugées. */
  done(): boolean;
}

export function createPerformance(notes: readonly AirNote[], windows: Windows): Performance {
  const verdicts: (Verdict | null)[] = notes.map(() => null);
  /** Première note pas encore jugée: rien avant elle n'est à relire. */
  let first = 0;

  function settle(index: number, verdict: Verdict): void {
    verdicts[index] = verdict;
    while (first < notes.length && verdicts[first] !== null) first += 1;
  }

  return {
    notes,
    press(lane, atMs) {
      // La note de cette touche la plus proche, sinon (mauvaise touche) la note la plus proche.
      let same = -1;
      let other = -1;
      for (let index = first; index < notes.length; index++) {
        const note = notes[index];
        if (note === undefined) break;
        const gap = note[0] - atMs;
        if (gap > windows.loose) break;
        if (verdicts[index] !== null || gap < -windows.loose) continue;
        const closer = (best: number): boolean =>
          best < 0 || Math.abs(gap) < Math.abs((notes[best]?.[0] ?? 0) - atMs);
        if (note[1] === lane) {
          if (closer(same)) same = index;
        } else if (Math.abs(gap) <= windows.near && closer(other)) other = index;
      }
      const index = same >= 0 ? same : other;
      const note = notes[index];
      if (note === undefined) return null;
      const offsetMs = Math.round(atMs - note[0]);
      const verdict = judge(offsetMs, note[1] === lane, windows);
      settle(index, verdict);
      return { index, lane, offsetMs, verdict };
    },
    advance(atMs) {
      const missed: Hit[] = [];
      for (let index = first; index < notes.length; index++) {
        const note = notes[index];
        if (note === undefined || note[0] + windows.loose >= atMs) break;
        if (verdicts[index] !== null) continue;
        missed.push({ index, lane: note[1], offsetMs: null, verdict: 'missed' });
      }
      for (const hit of missed) settle(hit.index, 'missed');
      return missed;
    },
    verdicts: () => verdicts,
    done: () => first >= notes.length,
  };
}

export interface Press {
  readonly atMs: number;
  readonly lane: number;
}

/**
 * Les frappes d'un robot. `perfect`: chaque note à son instant. `clumsy`: en avance ou en retard
 * jusqu'à `spreadMs`, une mauvaise touche de temps en temps, une note oubliée parfois.
 */
export function botPresses(
  notes: readonly AirNote[],
  style: 'perfect' | 'clumsy',
  random?: RandomSource,
  spreadMs = 230,
): Press[] {
  const presses: Press[] = [];
  for (const note of notes) {
    if (style === 'perfect' || random === undefined) {
      presses.push({ atMs: note[0], lane: note[1] });
      continue;
    }
    if (random.chance(0.12)) continue;
    const lane = random.chance(0.15) ? (note[1] + 1) % 4 : note[1];
    presses.push({ atMs: note[0] + random.float(-spreadMs, spreadMs), lane });
  }
  return presses.sort((a, b) => a.atMs - b.atMs);
}
