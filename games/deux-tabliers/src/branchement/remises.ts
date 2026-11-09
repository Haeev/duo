/**
 * Lecteurs de l'interface pour les remises et le marketing (démo v0.2): onglets « Remises » et
 * « Faire connaître », lignes de l'ardoise, du ticket et du bilan. Fonctions pures du monde et du
 * contenu, sans DOM: le téléphone en jeu (à venir) les reprendra telles quelles.
 */
import { clockMinutes } from '../clientele/clients';
import type { ClienteleContent } from '../clientele/donnees';
import { availableCents, cents, nextOpenDay, owns, weekdayId } from '../clientele/economie';
import type { ClienteleState, Group, Report } from '../clientele/etat';
import {
  campaignStatus,
  discountSettings,
  discountedLine,
  happyHourAt,
  holderShare,
  offerSuggestion,
  profileRateAvailable,
  saturated,
} from '../clientele/remises';
import type { PlayerIndex } from '../etat/monde';
import type {
  CampaignStateView,
  DiscountsView,
  EveningFigures,
  MarketingView,
} from '../interface/modele';
import { T, WEEKDAYS } from '../interface/textes';
import { euros, fill, heure } from '../interface/typo';

const pct = (rate: number): number => Math.round(rate * 100);
const weekdayName = (day: number): string => WEEKDAYS[(((day - 1) % 7) + 7) % 7] ?? '';
const hourText = (h: number): string => heure(h * 60);

/** Nom d'une remise sur le ticket et au bilan (« heure douce », « tarif randonneur »). */
function discountName(cc: ClienteleContent, kind: string): string {
  const id = kind.startsWith('profile:') ? kind.slice('profile:'.length) : kind;
  return cc.discounts.texts.names[id] ?? id;
}

// ---------------------------------------------------------------------------------------------
// Onglet « Remises »

export function discountsView(cc: ClienteleContent, s: ClienteleState): DiscountsView {
  const d = discountSettings(cc, s);
  const day = nextOpenDay(cc, s.day);
  const days = cc.days.weekdays
    .filter((x) => x !== 'mon')
    .map((x): [string, string] => [x, WEEKDAYS[cc.days.weekdays.indexOf(x)] ?? x]);
  const card = cc.discounts.loyaltyCard;
  const owned = owns(s, card.purchase);
  const suggestion = offerSuggestion(cc, s);
  const recipeName = (id: string): string => cc.recipes.get(id)?.name ?? id;
  const offerRate = d.dailyOffer?.[1] ?? cc.discounts.dailyOffer.default;
  const yesterday = s.report;
  const fullDay =
    day === cc.economy.challenge.day ||
    (d.happyHour.on && d.happyHour.days.includes('sun') && weekdayId(cc, day) === 'sun')
      ? fill(T.apps.discounts.fullDay, { weekday: capitalize(weekdayName(day)) })
      : null;
  return {
    settings: d,
    days,
    happyHour: {
      starts: cc.discounts.happyHour.starts,
      lengths: cc.discounts.happyHour.lengths,
      closeHour: cc.days.close / 60,
      rates: cc.discounts.happyHour.rates,
      line: fill(T.apps.discounts.happyHourLine, {
        start: hourText(d.happyHour.start),
        end: hourText(d.happyHour.start + d.happyHour.length),
        pct: pct(d.happyHour.rate),
      }),
    },
    loyalty: {
      owned,
      need: owned
        ? null
        : fill(T.apps.discounts.loyaltyNeedCards, { amount: euros(cents(card.price), true) }),
      holders:
        owned && d.loyalty
          ? fill(T.apps.discounts.holders, { pct: pct(holderShare(cc, s)) })
          : null,
    },
    profileRates: cc.discounts.profileRates
      .filter((r) => r.tier === 'P0')
      .map((r) => ({
        id: r.id,
        label: cc.discounts.texts.profileLabels[r.id] ?? r.id,
        rates: r.rates,
        absent: profileRateAvailable(cc, r.id) ? null : (cc.discounts.texts.absent[r.id] ?? ''),
      })),
    dailyOffer: {
      rates: cc.discounts.dailyOffer.rates,
      defaultRate: cc.discounts.dailyOffer.default,
      recipes: s.slate.map(([id]) => {
        const line = discountedLine(cc, s, id, null, { ...d, dailyOffer: [id, offerRate] });
        return {
          id,
          name: recipeName(id),
          baseCents: line.base,
          offerCents: line.price,
          floored: line.floored,
        };
      }),
    },
    suggestion:
      suggestion === null || d.dailyOffer?.[0] === suggestion.recipe
        ? null
        : {
            recipe: suggestion.recipe,
            text: fill(T.apps.discounts.dailyOfferSuggest, {
              n: suggestion.left,
              item: `portions de ${recipeName(suggestion.recipe).toLowerCase()}`,
              usual: String(suggestion.usual).replace('.', ','),
            }),
          },
    fullDay,
    costYesterday:
      yesterday !== null && yesterday.discounts > 0
        ? fill(T.apps.discounts.costYesterday, { amount: euros(yesterday.discounts) })
        : null,
    forDay: fill(T.apps.discounts.forDay, { weekday: weekdayName(day), day }),
  };
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

// ---------------------------------------------------------------------------------------------
// Onglet « Faire connaître »

export function marketingView(
  cc: ClienteleContent,
  s: ClienteleState,
  player: PlayerIndex,
): MarketingView {
  const M = T.apps.marketing;
  const closed = s.phase === 'service' || s.phase === 'closing';
  const available = availableCents(cc, s);
  const threshold = cents(cc.marketing.bigProposalEuros);
  const profileName = (id: string): string =>
    (cc.profiles.get(id)?.name ?? id).replace(/^Les /, '').toLowerCase();
  return {
    actions: cc.marketing.actions
      .filter((a) => a.tier === 'P0')
      .map((a) => {
        const st = campaignStatus(cc, s, a.id);
        const price = cents(a.cost);
        const proposal = s.proposals.find((p) => p.item === a.id);
        let state: CampaignStateView;
        let when = '';
        if (st.kind === 'idle') {
          const f = st.firstDay;
          when =
            a.publishWeekday !== undefined
              ? weekdayId(cc, s.day) === a.deadlineWeekday
                ? fill(M.deadline, { day: f })
                : fill(M.nextIssue, { day: f })
              : (a.launchWeekdays ?? []).length > 0
                ? fill(M.market, { day: f })
                : fill(M.starts, { weekday: weekdayName(f), day: f });
        }
        if (proposal !== undefined)
          state = proposal.by === player ? { kind: 'pending-mine' } : { kind: 'pending-theirs' };
        else if (st.kind === 'pending')
          state = {
            kind: 'pending',
            text: fill(M.pending, { weekday: weekdayName(st.firstDay), day: st.firstDay }),
          };
        else if (st.kind === 'running')
          state = {
            kind: st.fading ? 'fading' : 'running',
            text: fill(st.fading ? M.fading : M.running, {
              weekday: weekdayName(st.until),
              day: st.until,
            }),
          };
        else if (st.kind === 'locked') state = { kind: 'closed', reason: '' };
        else if (closed) state = { kind: 'closed', reason: M.closed };
        else if (price > available) state = { kind: 'missing', missingCents: price - available };
        else state = { kind: 'launch', propose: price >= threshold, tired: st.tired };
        const top = Object.entries(a.profiles)
          .sort((x, y) => y[1] - x[1])
          .map(([id]) => profileName(id));
        return {
          id: a.id,
          name: a.name,
          blurb: a.blurb,
          costCents: price,
          effect: fill(M.effect, { pct: pct(a.peak), days: a.durationDays }),
          audience: top.join(', '),
          when,
          state,
        };
      }),
    word: { name: M.word, help: M.wordHelp },
    saturation: saturated(cc, s) ? M.saturation : null,
    thresholdCents: threshold,
  };
}

// ---------------------------------------------------------------------------------------------
// Ardoise, ticket, bilan

/** Lignes des remises en tête de l'ardoise (RM-17) et prix remisé de chaque ligne en ce moment. */
export function slateDiscounts(
  cc: ClienteleContent,
  s: ClienteleState,
): {
  lines: string[];
  now: string | null;
  discounted: (recipe: string) => number | null;
} {
  const inService = s.phase === 'service' || s.phase === 'closing';
  const d = inService ? s.activeDiscounts : discountSettings(cc, s);
  const R = T.remises;
  const lines: string[] = [];
  if (d === null) return { lines, now: null, discounted: () => null };
  if (d.dailyOffer !== null) {
    const line = discountedLine(cc, s, d.dailyOffer[0], null, d);
    lines.push(
      fill(R.dailyOffer, {
        item: (cc.recipes.get(d.dailyOffer[0])?.name ?? '').toLowerCase(),
        price: euros(line.price),
        base: euros(line.base),
      }),
    );
  }
  if (d.happyHour.on)
    lines.push(
      fill(R.happyHour, {
        start: hourText(d.happyHour.start),
        end: hourText(d.happyHour.start + d.happyHour.length),
        pct: pct(d.happyHour.rate),
      }),
    );
  if (d.loyalty && owns(s, cc.discounts.loyaltyCard.purchase)) lines.push(R.loyalty);
  for (const r of cc.discounts.profileRates) {
    const set = d.profiles[r.id];
    if (set?.on === true)
      lines.push(fill(R.profile, { name: capitalize(discountName(cc, r.id)), pct: pct(set.rate) }));
  }
  const minute = inService ? clockMinutes(cc, s) : -1;
  const hhNow = inService && happyHourAt(cc, s, d, minute);
  return {
    lines,
    now: hhNow ? R.happyHourNow : null,
    discounted: (recipe) => {
      if (!inService) return null;
      const line = discountedLine(cc, s, recipe, { profile: '', minute }, d);
      return line.kind === null ? null : line.price;
    },
  };
}

/** Lignes du ticket d'un groupe (RM-18). */
export function receiptLines(cc: ClienteleContent, g: Group): string[] {
  const R = T.remises;
  return g.receipt.map(([kind, n]) => {
    if (kind === 'freeCoffee') return R.freeCoffee;
    if (kind === 'stamps') return fill(R.stamps, { n, max: cc.discounts.loyaltyCard.stamps });
    if (kind === 'stamped') return R.stamped;
    return fill(R.ticketDiscount, { name: capitalize(discountName(cc, kind)), amount: euros(n) });
  });
}

/** Lignes du bilan: publicité, remises consenties, clients venus grâce aux actions. */
export function eveningExtras(
  cc: ClienteleContent,
  r: Report,
): Pick<EveningFigures, 'marketingCents' | 'discountsCents' | 'discountsHelp' | 'cameThanks'> {
  const E = T.evening;
  const detail = Object.entries(r.discountBy)
    .filter(([, n]) => n > 0)
    .map(([k, n]) => `${k === 'freeCoffee' ? 'cafés offerts' : discountName(cc, k)} ${euros(n)}`)
    .join(', ');
  const came: string[] = [];
  for (const [id, x] of Object.entries(r.fromCampaigns).sort((a, b) => b[1] - a[1])) {
    const n = Math.round(x);
    const name = (cc.actions.get(id)?.name ?? id).replace(/^Une? |^Des /, (m) => m.toLowerCase());
    if (n >= 1) came.push(fill(n === 1 ? E.fromCampaignOne : E.fromCampaign, { name, n }));
  }
  const word = Math.round(r.fromWord);
  if (word >= 1) came.push(fill(E.fromWord, { n: word }));
  return {
    marketingCents: r.marketing,
    discountsCents: r.discounts,
    discountsHelp:
      r.discounts > 0
        ? fill(E.discountsHelp, {
            amount: euros(r.discounts),
            n: `${String(r.discountOrders)} commande${r.discountOrders > 1 ? 's' : ''}`,
            detail,
          })
        : null,
    cameThanks: came,
  };
}
