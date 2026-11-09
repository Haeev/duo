/**
 * Applis « Remises » et « Faire connaître » du téléphone (démo v0.2, ux-telephone 6.6 et 6.7).
 * Elles ne lisent que `model.discounts` et `model.marketing` (`modele.ts`) et n'envoient que
 * `discounts-set`, `campaign-launch` et `proposal-withdraw`: la simulation n'en sait rien.
 * Les remises valent pour la prochaine ouverture (H1); seules les actions de 30 € ou plus
 * passent par l'autre (H2 attend la v0.2).
 */
import type { UiContext } from './contexte';
import { button, h, icon, token } from './dom';
import type { DiscountSettingsView, DiscountsView, InterfaceModel } from './modele';
import { switchButton, type PhoneNav } from './telephone-applis';
import { addMessage } from './telephone-etat';
import { T } from './textes';
import { euros, fill, heure, lowerFirst } from './typo';

const D = T.apps.discounts;
const M = T.apps.marketing;

type Mutable<T> = { -readonly [K in keyof T]: T[K] extends object ? Mutable<T[K]> : T[K] };

function copy(s: DiscountSettingsView): Mutable<DiscountSettingsView> {
  return JSON.parse(JSON.stringify(s)) as Mutable<DiscountSettingsView>;
}

/** Puces de choix (une seule choisie): taux, recette de l'offre. */
function chips<V>(
  label: string,
  values: readonly V[],
  current: V,
  name: (v: V) => string,
  pick: (v: V) => void,
  disabled = false,
): HTMLElement {
  const row = h('div', { class: 'dt-puces', role: 'group', 'aria-label': label });
  for (const value of values) {
    const b = h(
      'button',
      { type: 'button', class: 'dt-puce', 'aria-pressed': String(value === current), disabled },
      name(value),
    );
    b.addEventListener('click', () => {
      pick(value);
    });
    row.append(b);
  }
  return row;
}

/** Puces des jours (mar. à dim.), plusieurs choisies. */
function dayChips(
  view: DiscountsView,
  days: readonly string[],
  set: (days: string[]) => void,
  disabled = false,
): HTMLElement {
  const row = h('div', { class: 'dt-puces', role: 'group', 'aria-label': D.days });
  for (const [id, name] of view.days) {
    const on = days.includes(id);
    const b = h(
      'button',
      {
        type: 'button',
        class: 'dt-puce',
        'aria-pressed': String(on),
        'aria-label': name,
        disabled,
      },
      `${name.slice(0, 3)}.`,
    );
    b.addEventListener('click', () => {
      set(on ? days.filter((d) => d !== id) : [...days, id]);
    });
    row.append(b);
  }
  return row;
}

/** Pas à pas d'un réglage (« Commence à 15 h »): − texte +. */
function stepRow(
  text: string,
  less: { name: string; disabled: boolean; run: () => void },
  more: { name: string; disabled: boolean; run: () => void },
): HTMLElement {
  const minus = button('', less.run, {
    name: less.name,
    disabled: less.disabled,
    className: 'dt-rond',
  });
  minus.append(icon('minus'));
  const plus = button('', more.run, {
    name: more.name,
    disabled: more.disabled,
    className: 'dt-rond',
  });
  plus.append(icon('plus'));
  return h(
    'div',
    { class: 'dt-pas-ligne' },
    h('span', null, text),
    h('span', { class: 'dt-pas' }, minus, plus),
  );
}

function card(title: string, control: HTMLElement | null, ...rows: (Node | null)[]): HTMLElement {
  return h(
    'article',
    { class: 'dt-carte' },
    h('div', { class: 'dt-carte-tete' }, h('h3', null, title), control),
    ...rows,
  );
}

export function discountsApp(
  body: HTMLElement,
  ctx: UiContext,
  model: InterfaceModel,
  nav: PhoneNav,
): void {
  const view = model.discounts ?? null;
  body.append(h('p', { class: 'dt-intro' }, D.intro));
  if (view === null) return;
  body.append(h('p', { class: 'dt-petit' }, view.forDay));
  if (view.costYesterday !== null)
    body.append(h('p', { class: 'dt-second dt-petit' }, view.costYesterday));
  if (view.fullDay !== null) body.append(h('p', { class: 'dt-douce' }, icon('info'), view.fullDay));
  const send = (change: (s: Mutable<DiscountSettingsView>) => void): void => {
    const next = copy(view.settings);
    change(next);
    ctx.send({ type: 'discounts-set', settings: next });
  };
  const pct = (r: number): string => `-${String(Math.round(r * 100))} %`;
  const onOff: readonly [string, string] = [D.on, D.off];

  const hh = view.settings.happyHour;
  const starts = view.happyHour.starts;
  const lengths = view.happyHour.lengths;
  const si = starts.indexOf(hh.start);
  const li = lengths.indexOf(hh.length);
  const setStart = (v: number | undefined): void => {
    if (v === undefined) return;
    send((s) => {
      s.happyHour.start = v;
      // Jamais après la fermeture: la durée se raccourcit.
      s.happyHour.length = Math.min(s.happyHour.length, Math.max(1, view.happyHour.closeHour - v));
    });
  };
  const sw = switchButton(
    hh.on,
    onOff,
    () => {
      send((s) => {
        s.happyHour.on = !hh.on;
      });
    },
    { name: D.happyHour },
  );
  sw.dataset.default = '';
  body.append(
    card(
      D.happyHour,
      sw,
      h('p', { class: 'dt-second dt-petit' }, D.happyHourHelp),
      h('p', { class: 'dt-fort' }, view.happyHour.line),
      stepRow(
        fill(D.startAt, { time: heure(hh.start * 60) }),
        {
          name: D.earlier,
          disabled: si <= 0,
          run: () => {
            setStart(starts[si - 1]);
          },
        },
        {
          name: D.later,
          disabled: si < 0 || si >= starts.length - 1,
          run: () => {
            setStart(starts[si + 1]);
          },
        },
      ),
      stepRow(
        fill(D.lasts, { n: hh.length }),
        {
          name: D.shorter,
          disabled: li <= 0,
          run: () => {
            const v = lengths[li - 1];
            if (v !== undefined)
              send((s) => {
                s.happyHour.length = v;
              });
          },
        },
        {
          name: D.longer,
          disabled:
            li < 0 ||
            li >= lengths.length - 1 ||
            hh.start + (lengths[li + 1] ?? 99) > view.happyHour.closeHour,
          run: () => {
            const v = lengths[li + 1];
            if (v !== undefined)
              send((s) => {
                s.happyHour.length = v;
              });
          },
        },
      ),
      chips(D.rate, view.happyHour.rates, hh.rate, pct, (v) => {
        send((s) => {
          s.happyHour.rate = v;
        });
      }),
      dayChips(view, hh.days, (days) => {
        send((s) => {
          s.happyHour.days = days;
        });
      }),
    ),
  );

  body.append(
    card(
      D.loyalty,
      switchButton(
        view.settings.loyalty,
        onOff,
        () => {
          send((s) => {
            s.loyalty = !view.settings.loyalty;
          });
        },
        { disabled: !view.loyalty.owned, name: D.loyalty },
      ),
      h('p', { class: 'dt-second dt-petit' }, D.loyaltyHelp),
      view.loyalty.need === null ? null : h('p', { class: 'dt-petit' }, view.loyalty.need),
      view.loyalty.need === null
        ? null
        : h(
            'div',
            { class: 'dt-carte-action' },
            button(D.seeCatalogue, () => {
              nav.go({ app: 'catalogue' });
            }),
          ),
      view.loyalty.holders === null
        ? null
        : h('p', { class: 'dt-second dt-petit' }, view.loyalty.holders),
    ),
  );

  const offer = view.settings.dailyOffer;
  const rate = offer?.[1] ?? view.dailyOffer.defaultRate;
  const picked = view.dailyOffer.recipes.find((x) => x.id === offer?.[0]) ?? null;
  const suggestion = view.suggestion;
  body.append(
    card(
      D.dailyOffer,
      switchButton(
        offer !== null,
        onOff,
        () => {
          send((s) => {
            s.dailyOffer =
              offer !== null
                ? null
                : [suggestion?.recipe ?? view.dailyOffer.recipes[0]?.id ?? '', rate];
          });
        },
        { name: D.dailyOffer, disabled: view.dailyOffer.recipes.length === 0 },
      ),
      h('p', { class: 'dt-second dt-petit' }, D.dailyOfferHelp),
      suggestion === null || offer !== null
        ? null
        : h('p', { class: 'dt-douce' }, icon('star'), suggestion.text),
      suggestion === null || offer !== null
        ? null
        : h(
            'div',
            { class: 'dt-carte-action' },
            button(D.dailyOfferUse, () => {
              send((s) => {
                s.dailyOffer = [suggestion.recipe, rate];
              });
            }),
          ),
      offer === null
        ? null
        : chips(
            D.dailyOffer,
            view.dailyOffer.recipes.map((x) => x.id),
            offer[0],
            (id) => view.dailyOffer.recipes.find((x) => x.id === id)?.name ?? id,
            (id) => {
              send((s) => {
                s.dailyOffer = [id, rate];
              });
            },
          ),
      offer === null
        ? null
        : chips(D.rate, view.dailyOffer.rates, rate, pct, (v) => {
            send((s) => {
              if (s.dailyOffer !== null) s.dailyOffer = [s.dailyOffer[0], v];
            });
          }),
      picked === null
        ? null
        : h(
            'p',
            { class: 'dt-petit' },
            fill(D.dailyOfferPrice, {
              price: euros(picked.offerCents),
              base: euros(picked.baseCents),
            }),
            picked.floored ? h('span', { class: 'dt-second' }, ` · ${D.floor}`) : null,
          ),
    ),
  );

  if (view.profileRates.length > 0) {
    const rows: Node[] = [];
    for (const r of view.profileRates) {
      const set = view.settings.profiles[r.id] ?? { on: false, rate: r.rates[0] ?? 0.1, days: [] };
      const absent = r.absent !== null;
      if (absent) {
        rows.push(h('p', { class: 'dt-second dt-petit' }, r.absent));
        continue;
      }
      rows.push(
        h(
          'div',
          { class: 'dt-carte-tete' },
          h('p', { class: 'dt-petit' }, r.label),
          switchButton(
            set.on,
            onOff,
            () => {
              send((s) => {
                const p = s.profiles[r.id];
                if (p !== undefined) p.on = !set.on;
              });
            },
            { name: r.label },
          ),
        ),
        chips(D.rate, r.rates, set.rate, pct, (v) => {
          send((s) => {
            const p = s.profiles[r.id];
            if (p !== undefined) p.rate = v;
          });
        }),
        dayChips(view, set.days, (days) => {
          send((s) => {
            const p = s.profiles[r.id];
            if (p !== undefined) p.days = days;
          });
        }),
      );
    }
    body.append(card(D.profileRate, null, ...rows));
  }
}

export function marketingApp(
  body: HTMLElement,
  ctx: UiContext,
  model: InterfaceModel,
  nav: PhoneNav,
): void {
  const view = model.marketing ?? null;
  const partner = ctx.partner.name;
  body.append(h('p', { class: 'dt-intro' }, M.intro));
  if (view === null) return;
  if (view.saturation !== null)
    body.append(h('p', { class: 'dt-douce' }, icon('info'), view.saturation));
  body.append(
    h(
      'p',
      { class: 'dt-second dt-petit' },
      fill(M.rule, { amount: euros(view.thresholdCents, true), partner }),
    ),
  );
  body.append(
    h(
      'article',
      { class: 'dt-carte lue' },
      h(
        'div',
        { class: 'dt-carte-tete' },
        h('h3', null, view.word.name),
        h('span', { class: 'dt-petit' }, M.free),
      ),
      h('p', { class: 'dt-second dt-petit' }, view.word.help),
    ),
  );
  let answerBtn: HTMLElement | null = null;
  let launchBtn: HTMLElement | null = null;
  for (const a of view.actions) {
    const st = a.state;
    const waiting = st.kind === 'pending-mine' || st.kind === 'pending-theirs';
    const el = h(
      'article',
      { class: `dt-carte${waiting ? ' attente' : ''}`, 'data-action': a.id },
      h(
        'div',
        { class: 'dt-carte-tete' },
        h('h3', null, a.name),
        h('span', { class: 'dt-prix' }, euros(a.costCents, true)),
      ),
      h('p', { class: 'dt-second dt-petit' }, a.blurb),
      h('p', { class: 'dt-petit' }, `${fill(M.for, { profiles: a.audience })} · ${a.effect}`),
      a.when === '' ? null : h('p', { class: 'dt-petit dt-ambre' }, a.when),
    );
    let action: HTMLElement | null = null;
    if (st.kind === 'launch') {
      const b = button(
        st.propose ? fill(M.propose, { partner }) : M.launch,
        () => {
          ctx.send({ type: 'campaign-launch', action: a.id });
          if (!st.propose) {
            const clock = model.clock;
            const m = addMessage(
              ctx.phone,
              'partner',
              fill(T.messages.youLaunched, {
                name: lowerFirst(a.name),
                amount: euros(a.costCents, true),
              }),
              clock?.day ?? 0,
              clock?.minutes ?? 0,
            );
            m.read = true;
            ctx.flash(fill(M.launched, { name: lowerFirst(a.name) }));
          }
        },
        { primary: !st.propose },
      );
      launchBtn ??= b;
      action = b;
      if (st.tired) el.append(h('p', { class: 'dt-petit dt-ambre' }, M.tired));
    } else if (st.kind === 'missing')
      action = button(fill(M.missing, { amount: euros(st.missingCents) }), () => undefined, {
        disabled: true,
      });
    else if (st.kind === 'pending-mine') {
      el.append(h('p', { class: 'dt-petit' }, fill(M.pendingMine, { partner })));
      action = button(M.withdraw, () => {
        const mine = model.proposals.find((p) => p.from === model.local && p.item === a.name);
        if (mine !== undefined) ctx.send({ type: 'proposal-withdraw', id: mine.id });
      });
    } else if (st.kind === 'pending-theirs') {
      el.append(
        h(
          'p',
          { class: 'dt-petit dt-qui' },
          token(ctx.partner.color),
          fill(M.pendingTheirs, { partner, amount: euros(a.costCents, true) }),
        ),
      );
      const b = button(
        fill(M.answer, { partner }),
        () => {
          nav.go({ app: 'messages', thread: 'partner' });
        },
        { primary: true },
      );
      answerBtn ??= b;
      action = b;
    } else if (st.kind === 'closed') el.append(h('p', { class: 'dt-second dt-petit' }, st.reason));
    else {
      el.append(h('p', { class: 'dt-petit dt-ok' }, icon('check'), st.text));
      action = button(M.already, () => undefined, { disabled: true });
    }
    if (action !== null) el.append(h('div', { class: 'dt-carte-action' }, action));
    body.append(el);
  }
  // Focus par défaut: répondre à l'autre s'il attend, sinon le premier « Lancer ce soir ».
  const target = answerBtn ?? launchBtn;
  if (target !== null) target.dataset.default = '';
}
