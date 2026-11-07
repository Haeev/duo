/**
 * Bilan du soir (CC11, ux 7, maquette `bilan.html`): le livre d'or d'abord, puis ce qu'on
 * retient, puis les chiffres, puis demain, et « À demain » ou « Encore un instant ». Chacun lit
 * à son rythme; une puce dit où en est l'autre. Rien ne compare les deux joueurs.
 * Retour arrière vaut « Encore un instant ».
 */
import type { LayerSpec } from './calques';
import { footer } from './calques';
import type { UiContext } from './contexte';
import { button, h, icon, token, type IconName } from './dom';
import type { EveningView, GuestbookEntryView } from './modele';
import { cupsRow, cupsText } from './tablette';
import { T, WEEKDAYS } from './textes';
import { capital, euros, fill } from './typo';

const PAGES = [T.evening.book, T.evening.retain, T.evening.figures, T.evening.tomorrow] as const;

const TONE_ICON: Readonly<Record<GuestbookEntryView['tone'], IconName>> = {
  liked: 'heart',
  missed: 'info',
  pricey: 'info',
};

export function eveningLayer(ctx: UiContext): LayerSpec {
  let page = 0;
  const goTo = (next: number): void => {
    const clamped = Math.max(0, Math.min(PAGES.length - 1, next));
    if (clamped === page) return;
    page = clamped;
    ctx.send({ type: 'evening-page', page: page + 1 });
    ctx.layers.refresh('bilan');
  };
  const notYet = (): void => {
    ctx.send({ type: 'evening-choice', goodNight: false });
    ctx.layers.close('bilan');
  };

  return {
    id: 'bilan',
    arrowPages: true,
    render(root) {
      const evening = ctx.model().evening;
      const house = ctx.model().house;
      const partner = ctx.partner.name;
      const head = h('header', { class: 'dt-panel-head' }, h('h2', null, T.evening.title));
      if (evening !== null) {
        head.append(
          h(
            'span',
            { class: 'dt-second' },
            fill(T.evening.sub, {
              weekday: capital(WEEKDAYS[evening.weekday] ?? ''),
              day: evening.day,
              house: house?.name ?? '',
              place: house?.place ?? '',
            }),
          ),
        );
        const p = evening.partner;
        const chipText =
          p.kind === 'reading'
            ? fill(T.evening.partnerPage, { partner, n: p.page })
            : p.kind === 'closed'
              ? fill(T.evening.partnerClosed, { partner })
              : fill(T.evening.partnerGoodNight, { partner });
        head.append(
          h(
            'span',
            { class: 'dt-chip', style: 'margin-left: auto' },
            token(ctx.partner.color),
            chipText,
          ),
        );
      }
      root.append(head);
      const body = h('div', { class: 'dt-panel-body', 'data-scroll': `bilan-${String(page)}` });
      root.append(body);
      if (evening === null) body.append(h('p', null, T.evening.nothing));
      else pageContent(body, ctx, evening, page);

      const nav = h('div', {
        class: 'dt-row',
        style: 'padding: 0.6em 1.3em; border-top: 1px solid var(--dt-filet)',
      });
      const dots = h('div', {
        class: 'dt-pages',
        'aria-label': `Page ${String(page + 1)} sur ${String(PAGES.length)}`,
      });
      for (let i = 0; i < PAGES.length; i++)
        dots.append(
          h(
            'span',
            { class: `dt-pagedot${i === page ? ' on' : ''}`, 'aria-hidden': 'true' },
            String(i + 1),
          ),
        );
      nav.append(dots, h('span', { style: 'flex: 1' }));
      if (page > 0) {
        const prev = button(T.evening.prev, () => {
          goTo(page - 1);
        });
        prev.prepend(icon('left'));
        nav.append(prev);
      }
      if (page < PAGES.length - 1) {
        const next = button(
          T.evening.next,
          () => {
            goTo(page + 1);
          },
          { primary: true },
        );
        next.append(icon('right'));
        next.dataset.default = '';
        nav.append(next);
      } else {
        const good = button(
          T.evening.goodNight,
          () => {
            ctx.send({ type: 'evening-choice', goodNight: true });
          },
          { primary: true },
        );
        good.dataset.default = '';
        nav.append(button(T.evening.notYet, notYet), good);
      }
      root.append(nav);
      root.append(
        footer(
          [
            [['←', '→', 'ou', 'A', 'E'], T.keys.pages],
            [['Entrée'], T.keys.validate],
            [['Retour arrière'], T.keys.notYet],
          ],
          T.evening.footer,
        ),
      );
    },
    back() {
      notYet();
      return true;
    },
    section(delta) {
      goTo(page + delta);
    },
    defaultFocus(root) {
      return root.querySelector<HTMLElement>('[data-default]');
    },
  };
}

function pageContent(body: HTMLElement, ctx: UiContext, evening: EveningView, page: number): void {
  body.append(h('h3', null, PAGES[page] ?? ''));
  switch (page) {
    case 0: {
      const words = evening.guestbook;
      if (words.length === 0) {
        body.append(
          h('p', null, T.evening.bookEmpty),
          h('p', { class: 'dt-second' }, T.evening.bookEmptySub),
        );
        return;
      }
      body.append(
        h(
          'p',
          { class: 'dt-second' },
          evening.firstEvening
            ? T.evening.bookFirst
            : words.length === 1
              ? T.evening.bookIntroOne
              : fill(T.evening.bookIntro, { n: words.length }),
        ),
      );
      const grid = h('div', { class: 'dt-words' });
      for (const w of words)
        grid.append(
          h(
            'figure',
            { class: 'dt-word', style: 'margin: 0' },
            h('blockquote', { class: 'dt-word-text', style: 'margin: 0' }, w.text),
            h(
              'figcaption',
              { class: 'dt-word-sign' },
              w.signature,
              w.regular === null ? null : h('span', { class: 'dt-chip' }, w.regular),
            ),
            h('div', { class: 'dt-word-subject' }, icon(TONE_ICON[w.tone]), w.subject),
          ),
        );
      body.append(grid);
      return;
    }
    case 1: {
      const block = (title: string, lines: readonly HTMLElement[]): void => {
        if (lines.length === 0) return;
        body.append(h('h4', null, title), ...lines);
      };
      block(
        T.evening.regulars,
        evening.regulars.map((r) => h('p', null, r)),
      );
      block(
        T.evening.liked,
        evening.liked.map((r) => h('p', null, r)),
      );
      block(
        T.evening.missed,
        evening.missed.map((m) =>
          h(
            'p',
            null,
            m.text,
            m.link === null
              ? null
              : h(
                  'span',
                  null,
                  ' ',
                  button(m.link, () => {
                    ctx.openTablet('catalogue');
                  }),
                ),
          ),
        ),
      );
      if (evening.regulars.length + evening.liked.length + evening.missed.length === 0)
        body.append(h('p', { class: 'dt-second' }, T.evening.nothing));
      return;
    }
    case 2: {
      const f = evening.figures;
      const grid = h('div', { class: 'dt-figures' });
      const fig = (label: string, value: string, sub?: string): void => {
        grid.append(
          h(
            'div',
            { class: 'dt-figure' },
            h('span', { class: 'dt-second' }, label),
            h('strong', null, value),
            sub === undefined ? null : h('span', { class: 'dt-second' }, sub),
          ),
        );
      };
      fig(
        T.evening.served,
        String(f.served),
        f.previousServed === null
          ? undefined
          : fill(T.evening.previous, {
              weekday: WEEKDAYS[f.previousServed.weekday] ?? '',
              n: f.previousServed.served,
            }),
      );
      fig(T.evening.revenue, euros(f.revenueCents));
      fig(T.evening.tips, euros(f.tipsCents));
      fig(T.evening.purchases, euros(f.purchasesCents));
      fig(T.evening.result, `${f.resultCents > 0 ? '+ ' : ''}${euros(f.resultCents)}`);
      fig(T.evening.cash, euros(f.cashCents, true));
      body.append(grid);
      body.append(
        h(
          'p',
          { class: 'dt-row', style: 'margin-top: 1em' },
          cupsRow(evening.halfCups),
          h('strong', null, fill(T.evening.reputation, { cups: cupsText(evening.halfCups) })),
        ),
        h('p', { class: 'dt-second' }, evening.reputationHint),
      );
      return;
    }
    default: {
      const t = evening.tomorrow;
      body.append(h('p', null, t.line));
      if (t.event !== null) body.append(h('p', null, t.event));
      if (t.regular !== null) body.append(h('p', null, t.regular));
      if (t.orderSent) body.append(h('p', { class: 'dt-ok' }, icon('check'), T.evening.orderSent));
      else
        body.append(
          h('p', null, T.evening.orderPending),
          button(T.evening.prepareOrder, () => {
            ctx.openTablet('orders');
          }),
        );
      if (t.project !== null) body.append(h('p', { class: 'dt-row' }, icon('heart'), t.project));
      body.append(h('p', { class: 'dt-second', style: 'margin-top: 1em' }, T.evening.notYetHelp));
    }
  }
}
