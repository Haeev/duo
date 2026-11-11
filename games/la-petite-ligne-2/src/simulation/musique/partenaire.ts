/**
 * Entendre l'autre joueur malgré le réseau (pur, testé dans Node avec une latence simulée).
 *
 * Une note de l'autre ne peut pas arriver à temps: son verdict part après sa frappe et met le
 * temps du réseau. On la programme donc d'avance, à son instant écrit, sur l'horloge de l'air de
 * cette machine: tant que l'autre joue (son dernier verdict connu n'est pas « manquée »), sa voix
 * tombe exactement en mesure. Les verdicts qui arrivent ensuite corrigent: une note fausse
 * déjà partie se met à sonner faux, une note manquée fait taire la voix jusqu'à la prochaine note
 * réussie, et une note réussie apprise un rien trop tard se joue encore si le retard est court.
 */
import type { AirNote } from '../../donnees/schemas/air';
import { MUSIC, type Verdict } from './reglages';

export type PartnerCommand =
  /** Jouer la note `index` à l'instant `atMs` de l'air (son instant écrit, ou maintenant si `late`). */
  | { readonly type: 'play'; readonly index: number; readonly atMs: number; readonly late: boolean }
  /** La note `index`, déjà partie, sonne faux à partir de maintenant. */
  | { readonly type: 'sour'; readonly index: number }
  /** Une note fausse jamais partie: un couac, tout de suite. */
  | { readonly type: 'couac'; readonly index: number; readonly atMs: number };

export interface PartnerVoice {
  /** À appeler à chaque image: les notes à programmer d'ici l'avance de programmation. */
  plan(nowMs: number): PartnerCommand[];
  /** Un verdict validé par l'hôte vient d'arriver. */
  result(index: number, verdict: Verdict, nowMs: number): PartnerCommand[];
  /** L'autre joue-t-il, à ce qu'on en sait ? */
  playing(): boolean;
}

export function createPartnerVoice(notes: readonly AirNote[]): PartnerVoice {
  const { lookaheadMs, lateEchoMs } = MUSIC.sound;
  const started = new Set<number>();
  const judged = new Set<number>();
  let next = 0;
  let open = true;

  return {
    plan(nowMs) {
      const commands: PartnerCommand[] = [];
      for (; next < notes.length; next++) {
        const note = notes[next];
        if (note === undefined || note[0] > nowMs + lookaheadMs) break;
        // Note déjà jugée avant d'être programmée (frappe en avance): `result` s'en est chargé.
        if (!open || judged.has(next) || note[0] < nowMs - lateEchoMs) continue;
        started.add(next);
        commands.push({ type: 'play', index: next, atMs: Math.max(note[0], nowMs), late: false });
      }
      return commands;
    },
    result(index, verdict, nowMs) {
      const note = notes[index];
      if (note === undefined || judged.has(index)) return [];
      judged.add(index);
      if (verdict === 'missed') {
        open = false;
        return [];
      }
      open = true;
      const lateness = nowMs - note[0];
      if (verdict === 'false') {
        if (started.has(index)) return [{ type: 'sour', index }];
        return lateness <= lateEchoMs ? [{ type: 'couac', index, atMs: nowMs }] : [];
      }
      if (started.has(index) || lateness > lateEchoMs) return [];
      started.add(index);
      return [{ type: 'play', index, atMs: Math.max(note[0], nowMs), late: lateness > 0 }];
    },
    playing: () => open,
  };
}
