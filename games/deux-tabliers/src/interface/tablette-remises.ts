/**
 * Sections provisoires « Remises » et « Faire connaître » de la tablette (démo v0.2). Elles ne
 * lisent que `model.discounts` et `model.marketing` (`modele.ts`) et n'envoient que les actions
 * `discounts-set` et `campaign-launch`: le téléphone en jeu pourra les reprendre comme deux
 * applications sans toucher à la simulation.
 */
import type { UiContext } from './contexte';
import { button, h, icon } from './dom';
import type { DiscountSettingsView, DiscountsView, InterfaceModel } from './modele';
import { T } from './textes';
import { euros, fill, heure } from './typo';

const D = T.tablet.discounts;
const M = T.tablet.marketing;

type Mutable<T> = { -readonly [K in keyof T]: T[K] extends object ? Mutable<T[K]> : T[K] };

function copy(s: DiscountSettingsView): Mutable<DiscountSettingsView> {
  return JSON.parse(JSON.stringify(s)) as Mutable<DiscountSettingsView>;
}

/** Choix à boutons (un seul actif), comme les réglages. */
function choices<V>(
  values: readonly V[],
  current: V,
  label: (v: V) => string,
  pick: (v: V) => void,
  disabled = false,
): HTMLElement {
  const group = h('div', { class: 'dt-seg', role: 'radiogroup' });
  for (const value of values) {
    const b = button(
      label(value),
      () => {
        pick(value);
      },
      { disabled },
    );
    b.setAttribute('role', 'radio');
    b.setAttribute('aria-checked', String(value === current));
    group.append(b);
  }
  return group;
}

function onOff(on: boolean, flip: () => void, disabled = false): HTMLElement {
  const b = button(on ? D.on : D.off, flip, { className: 'dt-switch', disabled });
  b.setAttribute('role', 'switch');
  b.setAttribute('aria-checked', String(on));
  return b;
}

/** Cases des jours (mardi à dimanche). */
function dayBoxes(
  view: DiscountsView,
  days: readonly string[],
  set: (days: string[]) => void,
  disabled = false,
): HTMLElement {
  const row = h('div', { class: 'dt-seg', role: 'group', 'aria-label': D.days });
  for (const [id, name] of view.days) {
    const on = days.includes(id);
    const b = button(
      name.slice(0, 3),
      () => {
        set(on ? days.filter((d) => d !== id) : [...days, id]);
      },
      { name, disabled },
    );
    b.setAttribute('role', 'checkbox');
    b.setAttribute('aria-checked', String(on));
    row.append(b);
  }
  return row;
}

function block(title: string, help: string | null, ...rows: (HTMLElement | null)[]): HTMLElement {
  return h(
    'div',
    { class: 'dt-card', style: 'margin: 0.6em 0; padding: 0.7em 0.9em' },
    h('h4', { style: 'margin: 0 0 0.3em' }, title),
    help === null ? null : h('p', { class: 'dt-second', style: 'margin: 0 0 0.4em' }, help),
    ...rows,
  );
}

function row(label: string, control: HTMLElement): HTMLElement {
  return h(
    'div',
    {
      class: 'dt-row',
      style: 'gap: 0.6em; align-items: center; flex-wrap: wrap; margin: 0.25em 0',
    },
    h('span', { style: 'min-width: 5.5em' }, label),
    control,
  );
}

export function discountsSection(body: HTMLElement, ctx: UiContext, model: InterfaceModel): void {
  const view = model.discounts ?? null;
  body.append(h('h3', null, D.title), h('p', { class: 'dt-second' }, D.intro));
  if (view === null) return;
  body.append(h('p', null, view.forDay));
  if (view.fullDay !== null) body.append(h('p', { class: 'dt-alert' }, icon('info'), view.fullDay));
  if (view.costYesterday !== null) body.append(h('p', { class: 'dt-second' }, view.costYesterday));
  const send = (change: (s: Mutable<DiscountSettingsView>) => void): void => {
    const next = copy(view.settings);
    change(next);
    ctx.send({ type: 'discounts-set', settings: next });
  };
  const hh = view.settings.happyHour;
  const pct = (r: number): string => `-${String(Math.round(r * 100))} %`;
  body.append(
    block(
      D.happyHour,
      D.happyHourHelp,
      row(
        D.happyHour,
        onOff(hh.on, () => {
          send((s) => {
            s.happyHour.on = !hh.on;
          });
        }),
      ),
      h('p', { style: 'margin: 0.2em 0' }, h('strong', null, view.happyHour.line)),
      row(
        D.start,
        choices(
          view.happyHour.starts,
          hh.start,
          (v) => heure(v * 60),
          (v) => {
            send((s) => {
              s.happyHour.start = v;
              // Jamais après la fermeture: la durée se raccourcit.
              s.happyHour.length = Math.min(
                s.happyHour.length,
                Math.max(1, view.happyHour.closeHour - v),
              );
            });
          },
        ),
      ),
      row(
        D.length,
        choices(
          view.happyHour.lengths,
          hh.length,
          (v) => fill(D.hours, { n: v }),
          (v) => {
            send((s) => {
              s.happyHour.length = v;
            });
          },
        ),
      ),
      row(
        D.rate,
        choices(view.happyHour.rates, hh.rate, pct, (v) => {
          send((s) => {
            s.happyHour.rate = v;
          });
        }),
      ),
      row(
        D.days,
        dayBoxes(view, hh.days, (days) => {
          send((s) => {
            s.happyHour.days = days;
          });
        }),
      ),
    ),
  );
  body.append(
    block(
      D.loyalty,
      D.loyaltyHelp,
      row(
        D.loyalty,
        onOff(
          view.settings.loyalty,
          () => {
            send((s) => {
              s.loyalty = !view.settings.loyalty;
            });
          },
          !view.loyalty.owned,
        ),
      ),
      view.loyalty.need === null
        ? null
        : h('p', { class: 'dt-alert' }, icon('info'), view.loyalty.need),
      view.loyalty.holders === null ? null : h('p', { class: 'dt-second' }, view.loyalty.holders),
    ),
  );
  for (const r of view.profileRates) {
    const set = view.settings.profiles[r.id] ?? { on: false, rate: r.rates[0] ?? 0.1, days: [] };
    const absent = r.absent !== null;
    body.append(
      h(
        'div',
        { style: absent ? 'opacity: 0.55' : null },
        block(
          `${D.profileRate} · ${r.label}`,
          r.absent,
          row(
            D.profileRate,
            onOff(
              set.on,
              () => {
                send((s) => {
                  const p = s.profiles[r.id];
                  if (p !== undefined) p.on = !set.on;
                });
              },
              absent,
            ),
          ),
          row(
            D.rate,
            choices(
              r.rates,
              set.rate,
              pct,
              (v) => {
                send((s) => {
                  const p = s.profiles[r.id];
                  if (p !== undefined) p.rate = v;
                });
              },
              absent,
            ),
          ),
          row(
            D.days,
            dayBoxes(
              view,
              set.days,
              (days) => {
                send((s) => {
                  const p = s.profiles[r.id];
                  if (p !== undefined) p.days = days;
                });
              },
              absent,
            ),
          ),
        ),
      ),
    );
  }
  const offer = view.settings.dailyOffer;
  const rate = offer?.[1] ?? view.dailyOffer.defaultRate;
  const picked = view.dailyOffer.recipes.find((x) => x.id === offer?.[0]) ?? null;
  body.append(
    block(
      D.dailyOffer,
      D.dailyOfferHelp,
      view.suggestion === null
        ? null
        : h(
            'div',
            { class: 'dt-banner' },
            icon('star'),
            view.suggestion.text,
            ' ',
            button(D.dailyOfferUse, () => {
              const recipe = view.suggestion?.recipe ?? '';
              send((s) => {
                s.dailyOffer = [recipe, rate];
              });
            }),
          ),
      row(
        D.dailyOffer,
        choices(
          [null, ...view.dailyOffer.recipes.map((x) => x.id)],
          offer?.[0] ?? null,
          (id) =>
            id === null
              ? D.dailyOfferNone
              : (view.dailyOffer.recipes.find((x) => x.id === id)?.name ?? id),
          (id) => {
            send((s) => {
              s.dailyOffer = id === null ? null : [id, rate];
            });
          },
        ),
      ),
      row(
        D.rate,
        choices(
          view.dailyOffer.rates,
          rate,
          pct,
          (v) => {
            send((s) => {
              if (s.dailyOffer !== null) s.dailyOffer = [s.dailyOffer[0], v];
            });
          },
          offer === null,
        ),
      ),
      picked === null
        ? null
        : h(
            'p',
            null,
            fill(D.dailyOfferPrice, {
              price: euros(picked.offerCents),
              base: euros(picked.baseCents),
            }),
            picked.floored ? h('span', { class: 'dt-second' }, ` · ${D.floor}`) : null,
          ),
    ),
  );
}

export function marketingSection(body: HTMLElement, ctx: UiContext, model: InterfaceModel): void {
  const view = model.marketing ?? null;
  body.append(h('h3', null, M.title), h('p', { class: 'dt-second' }, M.intro));
  if (view === null) return;
  body.append(
    h(
      'p',
      { class: 'dt-second' },
      fill(M.rule, { amount: euros(view.thresholdCents, true), partner: ctx.partner.name }),
    ),
  );
  if (view.saturation !== null)
    body.append(h('p', { class: 'dt-alert' }, icon('info'), view.saturation));
  const table = h('table', { class: 'dt-table' });
  const head = h('tr');
  M.cols.forEach((c, i) => {
    head.append(h('th', { class: i === 1 ? 'dt-num' : null }, c));
  });
  table.append(h('thead', null, head));
  const tbody = h('tbody');
  tbody.append(
    h(
      'tr',
      null,
      h(
        'td',
        null,
        h('strong', null, view.word.name),
        h('div', { class: 'dt-second', style: 'font-size: 0.85em' }, view.word.help),
      ),
      h('td', { class: 'dt-num' }, M.free),
      h('td', null, ''),
      h('td', null, ''),
      h('td', null, M.always),
    ),
  );
  for (const a of view.actions) {
    const st = a.state;
    let state: HTMLElement | string;
    if (st.kind === 'launch') {
      const b = button(
        st.propose ? fill(M.propose, { partner: ctx.partner.name }) : M.launch,
        () => {
          ctx.send({ type: 'campaign-launch', action: a.id });
        },
        { primary: !st.propose },
      );
      state = h(
        'div',
        null,
        b,
        st.tired ? h('div', { class: 'dt-second', style: 'font-size: 0.85em' }, M.tired) : null,
      );
    } else if (st.kind === 'missing') state = fill(M.missing, { amount: euros(st.missingCents) });
    else if (st.kind === 'pending-mine') state = fill(M.pendingMine, { partner: ctx.partner.name });
    else if (st.kind === 'pending-theirs')
      state = fill(M.pendingTheirs, { partner: ctx.partner.name });
    else if (st.kind === 'closed') state = st.reason;
    else
      state = h(
        'span',
        null,
        st.text,
        h('div', { class: 'dt-second', style: 'font-size: 0.85em' }, M.already),
      );
    tbody.append(
      h(
        'tr',
        { 'data-action': a.id },
        h(
          'td',
          null,
          h('strong', null, a.name),
          h('div', { class: 'dt-second', style: 'font-size: 0.85em' }, a.blurb),
          a.when === ''
            ? null
            : h('div', { class: 'dt-second', style: 'font-size: 0.85em' }, a.when),
        ),
        h('td', { class: 'dt-num' }, euros(a.costCents, true)),
        h('td', null, a.effect),
        h('td', null, a.audience),
        h('td', null, state),
      ),
    );
  }
  table.append(tbody);
  body.append(table);
}
