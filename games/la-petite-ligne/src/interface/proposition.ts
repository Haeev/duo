/**
 * Proposition d'un gros achat (maquette `achat.html`, EC-04): carte reçue
 * (D'accord, Pas maintenant), carte envoyée (Retirer ma proposition), puis
 * tampon « D'accord » ou repli de la carte. Elle ne prend jamais le focus
 * d'elle-même: Entrée l'y amène.
 */
import type { ReadonlyWorld, WorldEvent } from '../etat/types';
import type { UiHost } from './composant';
import { UI_SETTINGS } from './config';
import { nameOf } from './contexte';
import { button, chip, el, icon, keepFocusOnGame, keycap, token } from './dom';
import { capitalize } from './format';
import { proposalModels, type ProposalModel } from './modele-panneaux';

interface Ending {
  kind: 'accepted' | 'folding';
  until: number;
  model: ProposalModel;
}

export class ProposalCards {
  readonly root: HTMLDivElement;
  private readonly host: UiHost;
  private readonly known = new Map<string, ProposalModel>();
  private ending: Ending | null = null;
  private sig = '';
  private card: HTMLElement | null = null;
  private defaultButton: HTMLButtonElement | null = null;

  constructor(host: UiHost) {
    this.host = host;
    this.root = el('div', { class: 'lpl-pass-through lpl-proposals' });
  }

  /** Un événement de la simulation: la proposition a reçu sa réponse ou a été retirée. */
  onEvent(event: WorldEvent): void {
    if (event.type !== 'proposal_resolved') return;
    const model = this.known.get(event.proposal);
    if (model === undefined) return;
    const now = this.host.now();
    this.ending = event.accepted
      ? { kind: 'accepted', until: now + UI_SETTINGS.proposalStampMs, model }
      : { kind: 'folding', until: now + UI_SETTINGS.foldMs, model };
    this.host.invalidate();
  }

  /** La carte reçue est à l'écran: Entrée peut y amener le focus. */
  hasReceived(): boolean {
    return this.card?.dataset.kind === 'received';
  }

  focusDefault(): boolean {
    if (this.defaultButton?.isConnected !== true) return false;
    this.defaultButton.focus();
    return true;
  }

  contains(node: Node | null): boolean {
    return node !== null && this.root.contains(node);
  }

  update(world: ReadonlyWorld): void {
    const { ctx } = this.host;
    const now = this.host.now();
    const models = proposalModels(world, ctx);
    for (const m of models) this.known.set(m.id, m);
    if (this.ending !== null && now >= this.ending.until) this.ending = null;
    const received = models.find((m) => !m.mine) ?? null;
    const sent = models.find((m) => m.mine) ?? null;
    const partnerName = nameOf(world, ctx.partner);
    const meName = nameOf(world, ctx.me);
    const ending = this.ending;
    const shown = received ?? sent;
    const sig = JSON.stringify([shown, ending?.kind, ending?.model.id, partnerName]);
    if (sig === this.sig) return;
    this.sig = sig;
    const hadFocus = this.card?.contains(document.activeElement) === true;
    this.root.replaceChildren();
    this.card = null;
    this.defaultButton = null;
    const p = ctx.texts.extra.proposal;
    const g = ctx.texts.game.ui.proposal;
    if (shown === null && ending === null) return;

    const model = shown ?? ending?.model;
    if (model === undefined) return;
    const mine = model.mine;
    const otherSymbol = this.host.symbol('other');
    const selfSymbol = this.host.symbol('self');
    const textId = `proposition-${model.id}`;
    const card = el('section', { class: 'lpl-proposal', role: 'region', 'aria-labelledby': textId, 'data-kind': mine ? 'sent' : 'received' }, [
      el('span', { class: 'lpl-proposal__icon' }, [icon(model.icon, '')]),
      el('p', { class: 'lpl-proposal__from lpl-overline' }, [
        token(mine ? 'self' : 'other', mine ? selfSymbol : otherSymbol, 'small'),
        ctx.t(mine ? p.mine : p.from, { partner: partnerName }),
      ]),
      el('p', {
        class: 'lpl-proposal__text',
        id: textId,
        text: ctx.t(mine ? p.sent : p.received, { partner: partnerName, item: model.itemText, price: model.price }),
      }),
    ]);

    if (shown === null && ending !== null) {
      // La proposition vient d'être tranchée: tampon, ou repli.
      if (ending.kind === 'accepted') {
        const buyer = model.mine ? meName : model.byName;
        const note = model.source === 'catalogue' ? p.acceptedCatalogue : p.acceptedGrocery;
        card.append(
          el('p', { class: 'lpl-proposal__note', text: ctx.t(note, { item: capitalize(model.itemText), buyer, price: model.price }) }),
          el('span', { class: 'lpl-stamp lpl-stamp--green lpl-stamp--large', text: ctx.t(g.accept) }),
        );
      } else {
        card.setAttribute('data-state', 'folding');
      }
      this.root.append(card);
      this.card = card;
      return;
    }

    if (mine) {
      const withdraw = button(ctx.t(ctx.texts.extra.catalogue.withdraw), () => {
        this.host.send({ type: 'proposal_withdraw' });
      });
      card.append(
        el('p', { class: 'lpl-proposal__note' }, [chip(ctx.t(ctx.texts.extra.catalogue.waitingPartner, { partner: partnerName }), 'waiting', 'ui-hourglass')]),
        el('div', { class: 'lpl-proposal__actions' }, [withdraw]),
      );
      this.defaultButton = withdraw;
    } else {
      const accept = button(ctx.t(g.accept), () => {
        this.host.send({ type: 'proposal_answer', proposal: model.id, accept: true });
        this.blur();
      }, { class: 'lpl-button lpl-button--primary' });
      const decline = button(ctx.t(g.decline), () => {
        this.host.send({ type: 'proposal_answer', proposal: model.id, accept: false });
        this.blur();
      });
      const hint = el('p', { class: 'lpl-proposal__note lpl-proposal__hint' }, [keycap(ctx.key('Enter')), ` ${ctx.t(p.enterHint, { key: '' }).trimStart()}`]);
      card.append(
        el('p', { class: 'lpl-proposal__note', text: ctx.t(p.receivedNote) }),
        el('div', { class: 'lpl-proposal__actions' }, [accept, decline]),
        hint,
      );
      this.defaultButton = accept;
    }
    // Au pointeur, la carte ne garde pas le clavier: Espace reste au jeu.
    for (const b of card.querySelectorAll('button')) keepFocusOnGame(b);
    this.root.append(card);
    this.card = card;
    if (hadFocus) this.defaultButton.focus();
  }

  private blur(): void {
    const active = document.activeElement;
    if (active instanceof HTMLElement && this.root.contains(active)) active.blur();
  }

  /** Touche reçue quand le focus est sur la carte. Vrai si consommée. */
  key(code: string): boolean {
    const buttons = this.card === null ? [] : [...this.card.querySelectorAll<HTMLButtonElement>('button')];
    const index = buttons.findIndex((b) => b === document.activeElement);
    if (index < 0) return false;
    switch (code) {
      case 'Tab':
      case 'ArrowRight':
      case 'ArrowLeft': {
        const delta = code === 'ArrowLeft' ? -1 : 1;
        buttons[(index + delta + buttons.length) % buttons.length]?.focus();
        return true;
      }
      case 'Backspace':
        this.blur();
        return true;
      case 'Enter':
      case 'NumpadEnter':
      case 'Space':
        buttons[index]?.click();
        return true;
      default:
        // Toute autre touche rend la main au jeu (Z Q S D pour marcher).
        this.blur();
        return false;
    }
  }
}
