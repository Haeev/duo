import { describe, expect, it } from 'vitest';
import type { Priority } from './catalogue';
import { VoicePool, pickVictim } from './voix';

function fill(pool: VoicePool, count: number, priority: Priority, sound = 'x', startedAt = 0): number[] {
  return Array.from({ length: count }, (_, i) => pool.add(`${sound}${i}`, priority, startedAt + i * 0.01, 100));
}

describe('file des voix (priorités)', () => {
  it('accepte sous la limite', () => {
    const pool = new VoicePool(24);
    fill(pool, 10, 3);
    expect(pool.admit({ sound: 'hoe', priority: 3, now: 1, maxVoices: 4, minIntervalSeconds: 0 })).toEqual({ kind: 'accept', evict: [] });
  });

  it('au-delà de 24 voix, coupe d abord les priorités 4, les plus anciennes', () => {
    const pool = new VoicePool(24);
    const threes = fill(pool, 12, 3, 'a');
    const fours = fill(pool, 12, 4, 'b', 1);
    const admission = pool.admit({ sound: 'harvest', priority: 2, now: 2, maxVoices: 4, minIntervalSeconds: 0 });
    expect(admission).toEqual({ kind: 'accept', evict: [fours[0]] });
    expect(threes.length).toBe(12);
  });

  it('puis les priorités 3, jamais les 1', () => {
    const pool = new VoicePool(24);
    fill(pool, 4, 1, 'train');
    const threes = fill(pool, 20, 3, 'step', 1);
    const admission = pool.admit({ sound: 'ping-self', priority: 1, now: 2, maxVoices: 4, minIntervalSeconds: 0 });
    expect(admission).toEqual({ kind: 'accept', evict: [threes[0]] });
  });

  it('refuse un son moins important que tout ce qui joue', () => {
    const pool = new VoicePool(24);
    fill(pool, 24, 1, 'p1');
    expect(pool.admit({ sound: 'ui-click', priority: 4, now: 2, maxVoices: 4, minIntervalSeconds: 0 })).toEqual({ kind: 'reject', reason: 'priority' });
    const pool2 = new VoicePool(24);
    fill(pool2, 24, 2, 'p2');
    expect(pool2.admit({ sound: 'step-grass', priority: 3, now: 2, maxVoices: 4, minIntervalSeconds: 0 }).kind).toBe('reject');
  });

  it('évite les doublons (minIntervalMs) et borne les répétitions (maxVoices)', () => {
    const pool = new VoicePool(24);
    pool.add('notify', 2, 10, 11);
    expect(pool.admit({ sound: 'notify', priority: 2, now: 10.2, maxVoices: 4, minIntervalSeconds: 0.4 })).toEqual({ kind: 'reject', reason: 'interval' });
    expect(pool.admit({ sound: 'notify', priority: 2, now: 10.5, maxVoices: 4, minIntervalSeconds: 0.4 }).kind).toBe('accept');
    const ids = [1, 2, 3, 4].map((i) => pool.add('hammer', 3, 20 + i * 0.1, 30));
    expect(pool.admit({ sound: 'hammer', priority: 3, now: 21, maxVoices: 4, minIntervalSeconds: 0 })).toEqual({ kind: 'accept', evict: [ids[0]] });
  });

  it('oublie les voix finies', () => {
    const pool = new VoicePool(2);
    pool.add('a', 3, 0, 1);
    pool.add('b', 3, 0, 1);
    expect(pool.active(0.5)).toHaveLength(2);
    expect(pool.active(1.5)).toHaveLength(0);
  });

  it('choisit la victime la moins importante puis la plus ancienne', () => {
    const voices = [
      { id: 1, sound: 'a', priority: 3 as Priority, startedAt: 5, endsAt: 9 },
      { id: 2, sound: 'b', priority: 4 as Priority, startedAt: 6, endsAt: 9 },
      { id: 3, sound: 'c', priority: 4 as Priority, startedAt: 4, endsAt: 9 },
    ];
    expect(pickVictim(voices, [], 2)?.id).toBe(3);
    expect(pickVictim(voices, [3], 2)?.id).toBe(2);
    expect(pickVictim(voices, [2, 3], 4)).toBeNull();
  });
});
