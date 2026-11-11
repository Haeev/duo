/**
 * Écran de livraison de la commande de la semaine (cahier 4.1), ouvert par « Livrer la commande »
 * à la fin d'une conversation avec qui la reçoit (événement `order_opened`). Qui reçoit à gauche,
 * avec sa réplique; au centre une ligne par objet demandé: ce qui est demandé et déjà livré, ce
 * que ton sac et la consigne contiennent, le prix; à droite le courrier. Tout au clavier:
 * Z et S (ou les flèches) choisissent, Espace livre la ligne (ou prend le courrier, ou lit une
 * lettre), T livre tout ce qui peut l'être, Retour ferme. Propre à chaque joueur.
 */
import type { Content } from '../../donnees/charger';
import type { PlayerIndex } from '../../donnees/schemas/communs';
import type { LetterDef } from '../../donnees/schemas/commande';
import type { ReadonlyWorld } from '../../etat/monde';
import type { Intent } from '../../simulation/noyau/entrees';
import type { GameEvent } from '../../simulation/noyau/evenements';
import { formatEuros } from '../../simulation/sac/argent';
import { el } from '../dom';
import { itemThumb } from '../pictos';
import { portraitMarkup } from '../portrait';
import { fill } from '../textes';
import { entryKey, orderScreenModel, type OrderRow, type OrderScreenModel } from './modele';
import { ORDER_REFUSALS, ORDER_TEXTS as T } from './textes';
import './commande.css';

export interface OrderScreen {
  isOpen(): boolean;
  /** Ouvre l'écran du guichet de ce lieu (démonstration, essais). */
  open(place: string, now: number): void;
  close(): void;
  onEvent(event: GameEvent, me: PlayerIndex, now: number): void;
  frame(world: ReadonlyWorld, me: PlayerIndex, now: number): void;
  key(code: string, now: number): boolean;
  dispose(): void;
}

const UP = new Set(['KeyW', 'ArrowUp']);
const DOWN = new Set(['KeyS', 'ArrowDown']);
/** Durée d'un refus affiché sous la ligne (ms). */
const FLASH_MS = 1800;

export function createOrderScreen(
  root: HTMLElement,
  content: Content,
  send: (intent: Intent) => void,
  keyLabel: (code: string) => string,
  openGuardMs: number,
): OrderScreen {
  const layer = el('div', { class: 'lpl-order-layer' });
  layer.hidden = true;
  root.append(layer);
  layer.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
  });

  let place: string | null = null;
  let focus: string | null = null;
  let reading: string | null = null;
  let openedAt = 0;
  let paid = 0;
  let flash: { text: string; until: number } | null = null;
  let drawn = '';
  let model: OrderScreenModel | null = null;

  function chip(code: string): HTMLElement {
    return el('span', { class: 'key', text: keyLabel(code) });
  }

  function focusIndex(m: OrderScreenModel): number {
    const i = m.entries.findIndex((e) => entryKey(e) === focus);
    if (i >= 0) return i;
    // Sans choix encore: la première ligne qu'on peut livrer, sinon le courrier, sinon la première.
    const ready = m.entries.findIndex(
      (e) =>
        e.kind === 'mail' ||
        (e.kind === 'line' && (m.rows.find((r) => r.id === e.id)?.deliverable ?? 0) > 0),
    );
    return Math.max(0, ready);
  }

  function rowNode(row: OrderRow, focused: boolean): HTMLElement {
    const thumb = el('span', { class: 'lpl-order-row__thumb' });
    thumb.innerHTML = itemThumb(row.item, row.name);
    const have = row.bag + row.store;
    const action = row.done
      ? el('span', { class: 'lpl-order-row__state lpl-order-row__state--done', text: T.delivered })
      : row.deliverable > 0
        ? el('span', {
            class: 'lpl-order-row__state lpl-order-row__state--go',
            text: `${T.deliver} ${String(row.deliverable)}`,
          })
        : el('span', { class: 'lpl-order-row__state lpl-order-row__state--miss', text: T.nothing });
    const node = el(
      'div',
      {
        class: `lpl-order-row${focused ? ' lpl-order-on' : ''}${row.done ? ' lpl-order-row--done' : ''}`,
        role: 'listitem',
        'aria-label': fill(T.aria.row, {
          objet: row.name,
          livre: row.delivered,
          demande: row.asked,
          prix: formatEuros(row.price),
          as: have,
        }),
      },
      [
        thumb,
        el('span', { class: 'lpl-order-row__name' }, [
          el('b', { text: row.name }),
          el('small', { text: row.tableName }),
        ]),
        el('span', { class: 'lpl-order-row__asked' }, [
          el('b', { text: `× ${String(row.asked)}` }),
          el('span', {
            class: 'lpl-order-row__bar',
            style: `--part:${String(row.delivered / row.asked)}`,
          }),
          el('small', {
            text: fill(T.deliveredOf, { n: row.delivered, max: row.asked }),
          }),
        ]),
        el('span', { class: `lpl-order-row__have${have === 0 ? ' none' : ''}` }, [
          el('span', { text: fill(T.bag, { n: row.bag }) }),
          el('span', { text: fill(T.store, { n: row.store }) }),
        ]),
        el('span', { class: 'lpl-order-row__price' }, [
          el('b', { text: formatEuros(row.price * (row.asked - row.delivered || row.asked)) }),
          el('small', { text: fill(T.each, { prix: formatEuros(row.price) }) }),
        ]),
        action,
      ],
    );
    node.addEventListener('click', () => {
      focus = `line:${row.id}`;
      activate();
    });
    return node;
  }

  function letterNode(letter: LetterDef): HTMLElement {
    return el('article', { class: 'lpl-order-letter', role: 'document' }, [
      el('p', { class: 'lpl-order-letter__from', text: fill(T.from, { nom: letter.from }) }),
      ...letter.text.map((p) => el('p', { text: p })),
      el('p', { class: 'lpl-order-letter__sign', text: letter.signature }),
      letter.enclosed === undefined
        ? null
        : el('p', {
            class: 'lpl-order-letter__enclosed',
            text: fill(T.enclosed, { objet: letter.enclosed }),
          }),
      el('p', { class: 'lpl-order-letter__keys' }, [chip('Backspace'), T.keys.back]),
    ]);
  }

  function draw(m: OrderScreenModel, now: number): void {
    const index = focusIndex(m);
    const current = m.entries[index];
    const signature = JSON.stringify([m, index, reading, paid, flash?.text]);
    if (signature === drawn) return;
    drawn = signature;
    const bust = el('div', { class: 'lpl-order-bust' });
    bust.innerHTML = portraitMarkup(m.receiver, m.mood === 'nothing' ? 'neutre' : 'content');
    const receiver = el('aside', { class: 'lpl-order-receiver' }, [
      el('div', { class: 'lpl-order-say', role: 'status', text: m.says }),
      bust,
      el('div', { class: 'lpl-order-plate', text: m.receiverName }),
    ]);
    const rows = el(
      'div',
      { class: 'lpl-order-rows', role: 'list' },
      m.rows.length === 0
        ? [el('p', { class: 'lpl-order-empty', text: T.empty })]
        : m.rows.map((row) => rowNode(row, current?.kind === 'line' && current.id === row.id)),
    );
    const due = m.due === null ? '' : m.dueToday ? T.dueToday : fill(T.due, { jour: m.due });
    const main = el('section', { class: 'lpl-order-main' }, [
      el('header', { class: 'lpl-order-head' }, [
        el('h2', { text: T.title }),
        el('p', { class: 'lpl-order-due', text: due }),
        el('p', { class: 'lpl-order-pay' }, [
          T.pay[m.pay],
          paid > 0 ? el('b', { text: fill(T.paid, { montant: formatEuros(paid) }) }) : null,
        ]),
      ]),
      el('div', { class: 'lpl-order-cols', 'aria-hidden': 'true' }, [
        el('span', {}),
        el('span', {}),
        el('span', { text: T.columns.asked }),
        el('span', { text: T.columns.have }),
        el('span', { text: T.columns.price }),
        el('span', {}),
      ]),
      rows,
      flash === null || flash.until < now
        ? null
        : el('p', { class: 'lpl-order-flash', role: 'alert', text: flash.text }),
      el('footer', { class: 'lpl-order-keys' }, [
        el('span', {}, [chip('KeyW'), chip('KeyS'), T.keys.pick]),
        el('span', {}, [chip('Space'), T.keys.act]),
        el('span', {}, [chip('KeyT'), T.keys.all]),
        el('span', {}, [chip('Backspace'), T.keys.close]),
      ]),
    ]);
    const mailEntry =
      m.waiting.length === 0
        ? el('p', { class: 'lpl-order-mail__none', text: T.mailNone })
        : el(
            'button',
            {
              class: `lpl-order-mail__take btn btn--primary${current?.kind === 'mail' ? ' lpl-order-on' : ''}`,
              tabindex: '-1',
            },
            [
              current?.kind === 'mail' ? chip('Space') : null,
              fill(T.mailWaiting, { n: m.waiting.length }),
            ],
          );
    mailEntry.addEventListener('click', () => {
      focus = 'mail';
      activate();
    });
    const mail = el('section', { class: 'lpl-order-mail' }, [
      el('h3', { text: T.mailTitle }),
      ...m.waiting.map((l) =>
        el('p', { class: 'lpl-order-envelope lpl-order-envelope--sealed', text: l.from }),
      ),
      mailEntry,
      m.letters.length === 0 ? null : el('h4', { text: T.mailRead }),
      ...m.letters.map((letter) => {
        const focused = current?.kind === 'letter' && current.id === letter.id;
        const b = el(
          'button',
          { class: `lpl-order-envelope${focused ? ' lpl-order-on' : ''}`, tabindex: '-1' },
          [focused ? chip('Space') : null, letter.from],
        );
        b.addEventListener('click', () => {
          focus = `letter:${letter.id}`;
          activate();
        });
        return b;
      }),
    ]);
    const open = m.letters.find((l) => l.id === reading);
    layer.replaceChildren(
      el('div', { class: 'lpl-order', role: 'dialog', 'aria-label': T.title }, [
        receiver,
        main,
        mail,
        open === undefined ? null : letterNode(open),
        el('span', { class: 'provisoire lpl-order-prov', text: T.provisional }),
      ]),
    );
  }

  function activate(): void {
    const m = model;
    if (m === null) return;
    const entry = m.entries[focusIndex(m)];
    if (entry === undefined) return;
    if (entry.kind === 'line') send({ type: 'order_deliver', line: entry.id });
    else if (entry.kind === 'mail') send({ type: 'mail_take' });
    else reading = entry.id;
    drawn = '';
  }

  function open(id: string, now: number): void {
    place = id;
    focus = null;
    reading = null;
    paid = 0;
    flash = null;
    openedAt = now;
    drawn = '';
    layer.hidden = false;
  }

  function close(): void {
    place = null;
    reading = null;
    model = null;
    layer.hidden = true;
    layer.replaceChildren();
    drawn = '';
  }

  return {
    isOpen: () => place !== null,
    open,
    close,
    onEvent(event, me, now) {
      if (event.type === 'order_opened' && event.player === me) {
        open(event.place, now);
        return;
      }
      if (place === null) return;
      if (event.type === 'order_delivered' && event.player === me) paid += event.paid;
      else if (event.type === 'mail_taken' && event.player === me) {
        // La première lettre remise s'ouvre tout de suite: on la lit en main propre.
        reading = event.letters[0] ?? null;
        focus = reading === null ? focus : `letter:${reading}`;
      } else if (event.type === 'refused' && event.player === me) {
        const text = ORDER_REFUSALS[event.reason];
        if (text !== undefined) flash = { text, until: now + FLASH_MS };
      } else return;
      drawn = '';
    },
    frame(world, me, now) {
      if (place === null) return;
      model = orderScreenModel(content, world, me, place);
      // Le train est reparti, ou le joueur s'est éloigné: l'écran se ferme.
      if (model === null || (!model.here && now - openedAt > openGuardMs)) {
        close();
        return;
      }
      draw(model, now);
    },
    key(code, now) {
      if (place === null) return false;
      const m = model;
      if (code === 'Backspace' || code === 'Escape') {
        if (reading !== null) reading = null;
        else close();
        drawn = '';
        return true;
      }
      if (m === null || now - openedAt < openGuardMs) return true;
      if (reading !== null) return true;
      const index = focusIndex(m);
      if (UP.has(code) || DOWN.has(code)) {
        const next = Math.max(0, Math.min(m.entries.length - 1, index + (UP.has(code) ? -1 : 1)));
        const entry = m.entries[next];
        focus = entry === undefined ? null : entryKey(entry);
      } else if (code === 'Space' || code === 'Enter') activate();
      else if (code === 'KeyT') {
        for (const row of m.rows)
          if (!row.done && row.deliverable > 0) send({ type: 'order_deliver', line: row.id });
      } else return true;
      drawn = '';
      return true;
    },
    dispose() {
      layer.remove();
    },
  };
}
