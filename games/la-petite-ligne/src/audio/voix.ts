/**
 * File des voix d'effets (son.md 3.1, cahier 8): au-delà de `maxEffectVoices`,
 * on coupe d'abord les priorités 4, puis 3, jamais 1; un son ne coupe jamais
 * plus important que lui. `minIntervalMs` évite les doublons (deux joueurs qui
 * récoltent ensemble), `maxVoices` borne les répétitions d'un même son.
 * Logique pure: le moteur applique la décision.
 */
import type { Priority } from './catalogue';

export interface VoiceSlot {
  id: number;
  sound: string;
  priority: Priority;
  startedAt: number;
  /** Fin prévue (temps du contexte audio); `Infinity` pour une boucle. */
  endsAt: number;
}

export interface VoiceRequest {
  sound: string;
  priority: Priority;
  now: number;
  maxVoices: number;
  minIntervalSeconds: number;
}

export type Admission =
  | { kind: 'accept'; evict: readonly number[] }
  | { kind: 'reject'; reason: 'interval' | 'priority' };

const NEVER_CUT: Priority = 1;

export class VoicePool {
  private readonly voices: VoiceSlot[] = [];
  private readonly lastStart = new Map<string, number>();
  private nextId = 1;

  constructor(private readonly maxTotal: number) {}

  /** Voix encore actives à `now` (les voix finies sont retirées). */
  active(now: number): readonly VoiceSlot[] {
    for (let i = this.voices.length - 1; i >= 0; i -= 1) {
      const voice = this.voices[i];
      if (voice !== undefined && voice.endsAt <= now) this.voices.splice(i, 1);
    }
    return this.voices;
  }

  /** Décide si un son peut partir, et quelles voix couper pour lui faire place. */
  admit(request: VoiceRequest): Admission {
    const { now } = request;
    const last = this.lastStart.get(request.sound);
    if (last !== undefined && request.minIntervalSeconds > 0 && now - last < request.minIntervalSeconds) {
      return { kind: 'reject', reason: 'interval' };
    }
    const voices = this.active(now);
    const evict: number[] = [];
    const same = voices.filter((v) => v.sound === request.sound).sort((a, b) => a.startedAt - b.startedAt);
    let excess = same.length - request.maxVoices + 1;
    for (const voice of same) {
      if (excess <= 0) break;
      evict.push(voice.id);
      excess -= 1;
    }
    if (voices.length - evict.length >= this.maxTotal) {
      const victim = pickVictim(voices, evict, request.priority);
      if (victim === null) return { kind: 'reject', reason: 'priority' };
      evict.push(victim.id);
    }
    return { kind: 'accept', evict };
  }

  /** Enregistre une voix acceptée; renvoie son identifiant. */
  add(sound: string, priority: Priority, startedAt: number, endsAt: number): number {
    const id = this.nextId;
    this.nextId += 1;
    this.voices.push({ id, sound, priority, startedAt, endsAt });
    this.lastStart.set(sound, startedAt);
    return id;
  }

  /** Retire une voix (coupée ou finie plus tôt). */
  remove(id: number): void {
    const index = this.voices.findIndex((v) => v.id === id);
    if (index >= 0) this.voices.splice(index, 1);
  }

  /** Change la fin prévue d'une voix (une boucle qu'on arrête en fondu). */
  setEnd(id: number, endsAt: number): void {
    const voice = this.voices.find((v) => v.id === id);
    if (voice !== undefined) voice.endsAt = endsAt;
  }

  clear(): void {
    this.voices.length = 0;
    this.lastStart.clear();
  }
}

/** La voix à couper: la moins importante (4, puis 3...), la plus ancienne; jamais 1, jamais plus importante que la demande. */
export function pickVictim(voices: readonly VoiceSlot[], excluded: readonly number[], priority: Priority): VoiceSlot | null {
  let victim: VoiceSlot | null = null;
  for (const voice of voices) {
    if (excluded.includes(voice.id)) continue;
    if (voice.priority === NEVER_CUT || voice.priority < priority) continue;
    if (
      victim === null ||
      voice.priority > victim.priority ||
      (voice.priority === victim.priority && voice.startedAt < victim.startedAt)
    ) {
      victim = voice;
    }
  }
  return victim;
}
