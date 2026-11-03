/**
 * Réglages des plis de Lucie (`reglages.mailRound`, 0.12, section 2.4 de `v0-12-conception.md`).
 */
import type { Reader } from './lecteur';

export type MailKind = 'letter' | 'parcel';

export interface MailRoundSettings {
  enabledFlag: string;
  /** Où la sacoche attend (le banc du quai). */
  point: string;
  from: number;
  until: number;
  earlyBefore: number;
  earlyBonus: number;
  /** Jour sans tournée (0: samedi, comme `weekdayOf`). */
  noRoundWeekday: number;
  counts: { count: number; weight: number }[];
  /** Part des paquets parmi les plis (le reste: des lettres). */
  parcelShare: number;
  pay: Record<MailKind, number>;
  items: Record<MailKind, string>;
  recipients: string[];
}

const WEEKDAYS = [
  'saturday',
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
] as const;

export function parseMailRound(r: Reader | null): MailRoundSettings | null {
  if (r === null) return null;
  const pay = r.at('pay');
  const items = r.at('items');
  return {
    enabledFlag: r.at('enabledFlag').string(),
    point: r.at('point').string(),
    from: r.at('from').time(),
    until: r.at('until').time(),
    earlyBefore: r.at('earlyBefore').time(),
    earlyBonus: r.at('earlyBonus').integer(0),
    noRoundWeekday: WEEKDAYS.indexOf(r.at('noRoundWeekday').oneOf(WEEKDAYS)),
    counts: r
      .at('counts')
      .items()
      .map((c) => ({ count: c.at('count').integer(1), weight: c.at('weight').integer(0) })),
    parcelShare: r.at('parcelShare').number(),
    pay: { letter: pay.at('letter').integer(0), parcel: pay.at('parcel').integer(0) },
    items: { letter: items.at('letter').string(), parcel: items.at('parcel').string() },
    recipients: r.at('recipients').stringList(),
  };
}
