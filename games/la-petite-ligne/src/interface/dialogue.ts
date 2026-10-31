/**
 * Boîte de dialogue (maquette `dialogue.html`): conversation personnelle
 * avec un habitant, scène à deux (chacun choisit sa réplique et voit celle
 * de l'autre), lecture d'un objet (la carte d'Émile), et les choix du
 * comptoir d'Odette à la fin d'une conversation avec elle.
 */
import type { CharacterId, ReadonlyWorld } from '../etat/types';
import type { KeyInfo, Layer, UiHost } from './composant';
import { characterOf, nameOf } from './contexte';
import { button, chip, clear, el, icon, keycap, keysLine, portrait, setAttr, setHidden, setPortrait, setText, token } from './dom';
import { defaultChoice } from './focus';
import { itemTitle } from './format';
import { itemIcon } from './modele';
import { shopIsOpen } from './modele-panneaux';
import { portraitSvg, villagerColors } from './portrait';

/** Ce que montre la boîte: une conversation, la scène à deux, ou un objet lu. */
export type DialogueSource = { kind: 'dialogue' } | { kind: 'scene' } | { kind: 'read'; item: string };

interface ChoiceView {
  id: string;
  text: string;
  pressed: boolean;
  disabled: boolean;
  partner: boolean;
  action: () => void;
}

export class DialogueBox implements Layer {
  readonly root: HTMLElement;
  readonly letterNavigation = false;
  private readonly host: UiHost;
  private readonly source: DialogueSource;
  private readonly onCloseRead: () => void;
  private readonly aside: HTMLDivElement;
  private readonly face: HTMLSpanElement;
  private readonly name: HTMLHeadingElement;
  private readonly role: HTMLSpanElement;
  private readonly sceneChip: HTMLSpanElement;
  private readonly text: HTMLDivElement;
  private readonly choices: HTMLUListElement;
  private readonly footerText: HTMLSpanElement;
  private readonly next: HTMLButtonElement;
  private choiceButtons: HTMLButtonElement[] = [];
  private sig = '';
  private choiceSig = '';
  /** Après « Acheter » ou « Vendre » chez Odette, on attend la fin de la conversation. */
  private shopRequested = false;

  constructor(host: UiHost, source: DialogueSource, onCloseRead: () => void) {
    this.host = host;
    this.source = source;
    this.onCloseRead = onCloseRead;
    const { ctx } = host;
    const d = ctx.texts.extra.dialogue;
    this.face = portrait('', 'large');
    this.aside = el('div', { class: 'lpl-dialogue__aside' }, [this.face]);
    const nameId = `nom-habitant-${Math.round(host.now())}`;
    this.name = el('h2', { class: 'lpl-dialogue__name', id: nameId });
    this.role = el('span', { class: 'lpl-dialogue__role' });
    this.sceneChip = el('span', { class: 'lpl-chip lpl-dialogue__scene', hidden: true }, [
      token('self', host.symbol('self'), 'small'),
      token('other', host.symbol('other'), 'small'),
      ctx.t(d.sceneChip),
    ]);
    this.text = el('div', { class: 'lpl-dialogue__lines' });
    this.choices = el('ul', { class: 'lpl-choices', 'data-nav': 'list', 'aria-label': d.choicesLabel });
    this.footerText = el('span');
    this.next = button([ctx.t(ctx.texts.extra.common.next), ' ', keycap(ctx.key('Space'))], () => {
      this.advance();
    }, { class: 'lpl-button lpl-dialogue__next' });
    this.root = el('section', { class: 'lpl-dialogue', 'aria-labelledby': nameId }, [
      this.aside,
      el('div', { class: 'lpl-dialogue__main' }, [
        el('header', { class: 'lpl-dialogue__header' }, [this.name, this.role, this.sceneChip]),
        this.text,
        this.choices,
        el('footer', { class: 'lpl-dialogue__footer' }, [this.footerText, this.next]),
      ]),
    ]);
  }

  get closable(): boolean {
    return this.source.kind !== 'scene';
  }

  isSource(source: DialogueSource): boolean {
    if (source.kind !== this.source.kind) return false;
    return source.kind !== 'read' || (this.source.kind === 'read' && this.source.item === source.item);
  }

  /** Suite (Espace, bouton): réplique suivante, ou fin. */
  private advance(): void {
    if (this.source.kind === 'read') {
      this.onCloseRead();
      return;
    }
    this.host.send({ type: 'dialogue_next' });
  }

  close(): void {
    if (this.source.kind === 'read') this.onCloseRead();
    else if (this.source.kind === 'dialogue') this.host.send({ type: 'dialogue_close' });
  }

  private speakerLine(world: ReadonlyWorld, speaker: string, text: string, villager: string): HTMLElement {
    const { ctx } = this.host;
    const d = ctx.texts.extra.dialogue;
    if (speaker === 'p1' || speaker === 'p2') {
      const who: CharacterId = speaker;
      const mine = who === ctx.me;
      return el('p', { class: 'lpl-dialogue__text--player' }, [
        token(mine ? 'self' : 'other', this.host.symbol(mine ? 'self' : 'other'), 'small'),
        ctx.t(d.playerLine, { name: nameOf(world, who), text }),
      ]);
    }
    if (speaker === villager) return el('p', { class: 'lpl-dialogue__text', text: ctx.t(d.villagerLine, { text }) });
    return el('p', { class: 'lpl-dialogue__text', text: ctx.t(text) });
  }

  private setSpeaker(villagerId: string | null, item: string | null): void {
    const { ctx } = this.host;
    if (item !== null) {
      setAttr(this.root, 'data-speaker', 'letter');
      const sig = `read:${item}`;
      if (this.face.dataset.sig !== sig) {
        this.face.dataset.sig = sig;
        clear(this.face);
        delete this.face.dataset.svg;
        this.face.classList.add('lpl-dialogue__object');
        this.face.append(icon(itemIcon(ctx, item), ''));
      }
      setText(this.name, ctx.t(ctx.texts.extra.dialogue.readTitle, { item: itemTitle(ctx.content.items[item], 1, item) }));
      setText(this.role, '');
      return;
    }
    const v = ctx.content.villagers.find((x) => x.id === villagerId);
    setAttr(this.root, 'data-speaker', villagerId);
    const colors = villagerId === null ? null : villagerColors(villagerId);
    if (colors !== null && villagerId !== null) setPortrait(this.face, portraitSvg(colors, 'good', '', villagerId));
    setText(this.name, v === undefined ? '' : ctx.t(`${v.firstName} ${v.lastName}`));
    setText(this.role, v === undefined ? '' : ctx.t(v.role));
  }

  private renderChoices(views: readonly ChoiceView[], partnerName: string): void {
    const sig = JSON.stringify(views.map((v) => [v.id, v.text, v.pressed, v.disabled, v.partner]));
    if (sig === this.choiceSig) return;
    const focusedId = this.choiceButtons.find((b) => b === document.activeElement)?.dataset.id ?? null;
    this.choiceSig = sig;
    clear(this.choices);
    const { ctx } = this.host;
    this.choiceButtons = views.map((v) => {
      const b = button(v.text, v.action, {
        class: 'lpl-choice',
        attrs: {
          'data-nav-item': true,
          'data-id': v.id,
          'aria-pressed': v.pressed ? 'true' : 'false',
          'aria-disabled': v.disabled ? 'true' : null,
        },
      });
      if (v.partner) {
        b.append(
          el('span', { class: 'lpl-choice__partner' }, [
            token('other', this.host.symbol('other'), 'small'),
            ctx.t(ctx.texts.extra.dialogue.partnerChoice, { partner: partnerName }),
          ]),
        );
      }
      this.choices.append(el('li', {}, [b]));
      return b;
    });
    setHidden(this.choices, views.length === 0);
    if (focusedId !== null) this.choiceButtons.find((b) => b.dataset.id === focusedId)?.focus();
  }

  update(world: ReadonlyWorld): void {
    const { ctx } = this.host;
    const d = ctx.texts.extra.dialogue;
    const me = characterOf(world, ctx.me);
    if (me === null) return;
    const partnerName = nameOf(world, ctx.partner);

    if (this.source.kind === 'read') {
      const item = this.source.item;
      const key = ctx.content.items[item]?.readText ?? null;
      const textValue = key === null ? '' : (ctx.texts.messages[key] ?? '');
      const sig = `read|${item}|${textValue}`;
      if (sig === this.sig) return;
      this.sig = sig;
      this.setSpeaker(null, item);
      clear(this.text);
      this.text.append(el('p', { class: 'lpl-dialogue__text', text: ctx.t(`« ${textValue} »`) }));
      this.renderChoices([], partnerName);
      setText(this.footerText, '');
      setHidden(this.next, false);
      return;
    }

    if (this.source.kind === 'scene') {
      const scene = world.scene;
      if (scene === null) return;
      setHidden(this.sceneChip, false);
      const myPick = scene.picks[ctx.me] ?? null;
      const otherPick = scene.picks[ctx.partner] ?? null;
      const choosing = scene.choices.length > 0;
      const line = scene.lines[Math.min(scene.line, scene.lines.length - 1)];
      const sig = JSON.stringify([scene.dialogue, scene.line, scene.lines.length, scene.choices, myPick, otherPick, scene.ready, partnerName]);
      if (sig === this.sig) return;
      this.sig = sig;
      this.setSpeaker(scene.villager, null);
      clear(this.text);
      if (choosing) {
        // La dernière réplique de l'habitant reste lisible au-dessus des choix.
        const last = scene.lines[scene.lines.length - 1];
        if (last !== undefined) this.text.append(this.speakerLine(world, last.speaker, last.text, scene.villager));
      } else if (line !== undefined) {
        this.text.append(this.speakerLine(world, line.speaker, line.text, scene.villager));
      }
      this.renderChoices(
        scene.choices.map((c) => ({
          id: c.id,
          text: ctx.t(c.text),
          pressed: myPick === c.id,
          disabled: myPick !== null && myPick !== c.id,
          partner: otherPick === c.id,
          action: () => {
            if (myPick === null) this.host.send({ type: 'dialogue_choice', choice: c.id });
          },
        })),
        partnerName,
      );
      clear(this.footerText);
      const waitingMe = scene.ready.includes(ctx.me) && !scene.ready.includes(ctx.partner);
      if (choosing) {
        if (myPick !== null && otherPick === null) this.footerText.append(chip(ctx.t(d.partnerChoosing, { partner: partnerName }), 'waiting', 'ui-hourglass'));
        else if (myPick === null && otherPick !== null) this.footerText.append(ctx.t(d.partnerChose, { partner: partnerName }));
        else this.footerText.append(ctx.t(d.sceneHelp, { partner: partnerName }));
      } else if (waitingMe) {
        this.footerText.append(chip(ctx.t(d.waitingNext, { partner: partnerName }), 'waiting', 'ui-hourglass'));
      } else if (Object.keys(scene.picks).length > 0) {
        const v = ctx.content.villagers.find((x) => x.id === scene.villager)?.label ?? '';
        const a = scene.picks.p1;
        const b = scene.picks.p2;
        this.footerText.append(
          a !== b
            ? ctx.t(d.replies, { villager: v, first: nameOf(world, 'p1'), second: nameOf(world, 'p2') })
            : ctx.t(d.reply, { villager: v }),
        );
      }
      setHidden(this.next, choosing);
      setAttr(this.next, 'aria-disabled', waitingMe ? 'true' : null);
      return;
    }

    // Conversation personnelle.
    const dlg = me.dialogue;
    if (dlg === null) return;
    const atEnd = dlg.line >= dlg.lines.length - 1;
    const odetteShop = atEnd && dlg.choices.length === 0 && this.isShopKeeper(world, dlg.villager);
    const sig = JSON.stringify([dlg.dialogue, dlg.line, dlg.lines.length, dlg.choices, odetteShop]);
    if (sig === this.sig) return;
    this.sig = sig;
    setHidden(this.sceneChip, true);
    this.setSpeaker(dlg.villager, null);
    const line = dlg.lines[Math.min(dlg.line, dlg.lines.length - 1)];
    clear(this.text);
    if (line !== undefined) this.text.append(this.speakerLine(world, line.speaker, line.text, dlg.villager));
    let views: ChoiceView[] = [];
    if (atEnd && dlg.choices.length > 0) {
      views = dlg.choices.map((c) => ({
        id: c.id,
        text: ctx.t(c.text),
        pressed: false,
        disabled: false,
        partner: false,
        action: () => {
          this.host.send({ type: 'dialogue_choice', choice: c.id });
        },
      }));
    } else if (odetteShop) {
      const openShop = (tab: 'buy' | 'sell'): void => {
        if (this.shopRequested) return;
        this.shopRequested = true;
        this.host.send({ type: 'dialogue_next' });
        this.host.setMenu('shop', tab);
      };
      views = [
        { id: 'shop:buy', text: ctx.t(d.shopBuy), pressed: false, disabled: false, partner: false, action: () => { openShop('buy'); } },
        { id: 'shop:sell', text: ctx.t(d.shopSell), pressed: false, disabled: false, partner: false, action: () => { openShop('sell'); } },
        { id: 'shop:bye', text: ctx.t(d.goodbye), pressed: false, disabled: false, partner: false, action: () => { this.host.send({ type: 'dialogue_next' }); } },
      ];
      setAttr(this.choices, 'aria-label', d.shopChoicesLabel);
    }
    this.renderChoices(views, partnerName);
    clear(this.footerText);
    this.footerText.append(keysLine([{ keys: [ctx.key('Backspace')], text: d.goodbyeKey }]));
    setHidden(this.next, views.length > 0);
  }

  private isShopKeeper(world: ReadonlyWorld, villager: string): boolean {
    const v = world.villagers.find((x) => x.id === villager);
    return v !== undefined && v.activity === 'serve' && shopIsOpen(world, this.host.ctx);
  }

  defaultFocus(): HTMLElement | null {
    const views = this.choiceButtons.map((b) => ({
      pressed: b.getAttribute('aria-pressed') === 'true',
      disabled: b.getAttribute('aria-disabled') === 'true',
    }));
    const index = defaultChoice(views);
    if (index >= 0) return this.choiceButtons[index] ?? null;
    return this.next.hidden ? null : this.next;
  }

  key(code: string, info: KeyInfo): boolean {
    // Espace: la suite, où que soit le focus (sauf sur une réplique à choisir).
    if (code === 'Space' && !this.next.hidden) {
      if (info.repeat) return true;
      const onChoice = this.choiceButtons.some((b) => b === document.activeElement);
      if (!onChoice) {
        this.next.click();
        return true;
      }
    }
    return false;
  }
}
