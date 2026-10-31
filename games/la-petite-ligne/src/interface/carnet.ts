/**
 * Carnet (maquette `carnet.html`): onglets Quêtes, Courrier et Sac. A et E
 * changent d'onglet (la caméra ne tourne pas pendant le carnet), Tab ou
 * Retour arrière le ferment.
 */
import type { ReadonlyWorld } from '../etat/types';
import type { KeyInfo, PanelTab, UiHost } from './composant';
import { UI_SETTINGS } from './config';
import { characterOf } from './contexte';
import { button, chip, el, focusElement, icon, keycap, keysLine, setAttr, setText } from './dom';
import { defaultBagSlot, defaultLetter, defaultQuest } from './focus';
import { itemDetail, bagEmpty, bagFull } from './modele-panneaux';
import { letterModels, nextObjective, questModels, slotModel, type QuestModel } from './modele';
import { Panel } from './panneau';

type NotebookTab = 'quests' | 'mail' | 'bag';
const TABS: readonly NotebookTab[] = ['quests', 'mail', 'bag'];

/** Dernier onglet ouvert, gardé d'une ouverture à l'autre. */
let lastTab: NotebookTab = 'quests';

export class NotebookPanel extends Panel {
  private tab: NotebookTab;
  private readonly tabButtons: Record<NotebookTab, HTMLButtonElement>;
  private readonly badge: HTMLSpanElement;
  private checked: number | null = null;
  private moving: number | null = null;
  private letter: string | null = null;
  private dragFrom: number | null = null;

  constructor(host: UiHost, tab: PanelTab | undefined) {
    const { ctx } = host;
    const n = ctx.texts.extra.notebook;
    const tabKey = ctx.key('Tab');
    const back = ctx.key('Backspace');
    super(
      host,
      {
        icon: 'ui-notebook',
        title: ctx.t(n.title),
        closeKeyLabel: tabKey,
        closeAria: ctx.t(n.closeLabel, { tab: tabKey, back }),
      },
      'Tab',
    );
    this.tab = tab === 'quests' || tab === 'mail' || tab === 'bag' ? tab : lastTab;
    const g = ctx.texts.game.ui.notebookTabs;
    this.badge = el('span', { class: 'lpl-tab__badge', hidden: true });
    const make = (id: NotebookTab, label: string, iconId: string, extra: HTMLElement | null): HTMLButtonElement =>
      button([icon(iconId), label, extra], () => {
        this.select(id, true);
      }, { class: 'lpl-tab', attrs: { role: 'tab', 'aria-selected': 'false', tabindex: '-1', 'data-tab': id } });
    this.tabButtons = {
      quests: make('quests', ctx.t(g.quests), 'ui-flag', null),
      mail: make('mail', ctx.t(g.mail), 'ui-letter', this.badge),
      bag: make('bag', ctx.t(g.bag), 'grain-sack', null),
    };
    const tabs = el('div', { class: 'lpl-tabs', role: 'tablist', 'aria-label': n.tabsLabel }, [
      el('span', { class: 'lpl-key lpl-tabs__key', 'aria-hidden': 'true', text: ctx.key('KeyQ') }),
      this.tabButtons.quests,
      this.tabButtons.mail,
      this.tabButtons.bag,
      el('span', { class: 'lpl-key lpl-tabs__key', 'aria-hidden': 'true', text: ctx.key('KeyE') }),
    ]);
    this.header.insertBefore(tabs, this.closeButton);
    const a = ctx.texts.extra.keys.arrows;
    this.setFooter([
      keysLine([
        { keys: [ctx.key('KeyQ'), ctx.key('KeyE')], text: n.keysPages },
        { keys: [...a], text: '' },
      ]),
      null,
    ]);
    // Pied: « ↑ ↓ ← → ou Z Q S D choisir », comme la maquette.
    const keys = this.footer.querySelector('.lpl-keys');
    const arrows = keys?.lastElementChild ?? null;
    if (arrows !== null) {
      arrows.append(` ${ctx.texts.extra.keys.or} `);
      for (const code of ['KeyW', 'KeyA', 'KeyS', 'KeyD']) arrows.append(keycap(ctx.key(code)));
      arrows.append(` ${n.keysChoose}`);
      keys?.append(el('span', {}, [keycap(back), ` ${n.keysClose}`]));
    }
    this.footer.append(el('span', { text: ctx.t(n.gameGoesOn) }));
    this.markTabs();
  }

  private markTabs(): void {
    for (const id of TABS) {
      const b = this.tabButtons[id];
      setAttr(b, 'aria-selected', String(id === this.tab));
      b.tabIndex = id === this.tab ? 0 : -1;
    }
  }

  private select(tab: NotebookTab, focus: boolean): void {
    if (tab !== this.tab) {
      this.tab = tab;
      lastTab = tab;
      this.moving = null;
      this.markTabs();
      this.host.invalidate();
    }
    if (focus) {
      // Le contenu de l'onglet est reconstruit au prochain rafraîchissement.
      window.requestAnimationFrame(() => {
        focusElement(this.defaultFocus());
      });
    }
  }

  override key(code: string, info: KeyInfo): boolean {
    if (code === 'KeyQ' || code === 'KeyE') {
      const index = TABS.indexOf(this.tab);
      const next = TABS[(index + (code === 'KeyQ' ? -1 : 1) + TABS.length) % TABS.length] ?? 'quests';
      this.select(next, true);
      return true;
    }
    if (this.tab !== 'bag' || !info.inside) return false;
    const active = document.activeElement;
    const slot = active instanceof HTMLElement ? active.dataset.slot : undefined;
    if (slot === undefined) return false;
    const index = Number(slot);
    if (code === 'Space') {
      if (!info.repeat) this.toggleMove(index);
      return true;
    }
    if (code === 'Enter' || code === 'NumpadEnter') {
      if (!info.repeat) this.primary(index);
      return true;
    }
    return false;
  }

  /** Espace sur une case: la prendre, puis la poser sur une autre (déplacer). */
  private toggleMove(index: number): void {
    if (this.moving === null) {
      this.moving = index;
      this.checked = index;
    } else {
      if (this.moving !== index) this.host.send({ type: 'swap_slots', from: this.moving, to: index });
      this.moving = null;
      this.checked = index;
    }
    this.host.invalidate();
  }

  /** Entrée sur une case: l'action principale de l'objet (manger, lire, prendre en main). */
  private primary(index: number): void {
    this.checked = index;
    const world = this.lastWorld;
    const me = world === null ? null : characterOf(world, this.host.ctx.me);
    const stack = me?.bag[index] ?? null;
    if (stack === null) return;
    const detail = itemDetail(this.host.ctx, stack);
    const action = detail.actions[0];
    if (action !== undefined) this.runAction(action, index, stack.item);
    this.host.invalidate();
  }

  private runAction(action: 'eat' | 'hold' | 'read', index: number, item: string): void {
    const world = this.lastWorld;
    const me = world === null ? null : characterOf(world, this.host.ctx.me);
    if (me === null) return;
    if (action === 'eat') this.host.send({ type: 'eat', item });
    else if (action === 'read') this.host.read(item);
    else {
      // Prendre en main: l'objet va à la case choisie de la barre d'outils si besoin.
      if (index >= UI_SETTINGS.toolbarSlots) {
        this.host.send({ type: 'swap_slots', from: index, to: me.selected });
        this.host.send({ type: 'select_slot', slot: me.selected });
      } else {
        this.host.send({ type: 'select_slot', slot: index });
      }
      this.close();
    }
  }

  private lastWorld: ReadonlyWorld | null = null;

  update(world: ReadonlyWorld): void {
    this.lastWorld = world;
    const { ctx } = this.host;
    const letters = letterModels(world, ctx);
    const unread = letters.filter((l) => l.unread).length;
    this.badge.toggleAttribute('hidden', unread === 0);
    setText(this.badge, String(unread));
    setAttr(this.badge, 'aria-label', ctx.t(unread > 1 ? ctx.texts.extra.notebook.unreadMany : ctx.texts.extra.notebook.unread, { count: unread }));
    if (this.tab === 'quests') this.renderQuests(world);
    else if (this.tab === 'mail') this.renderMail(letters);
    else this.renderBag(world);
  }

  private renderQuests(world: ReadonlyWorld): void {
    const { ctx } = this.host;
    const quests = questModels(world, ctx);
    const current = nextObjective(world, ctx)?.id ?? null;
    const sig = JSON.stringify(['quests', quests, current]);
    this.renderBody(sig, () => {
      const ordered = [...quests].sort((a, b) => Number(a.done) - Number(b.done));
      const focusIndex = defaultQuest(ordered, current);
      const focusId = ordered[focusIndex]?.id ?? null;
      const section = (kind: 'main' | 'side'): HTMLElement[] => {
        const list = ordered.filter((q) => q.kind === kind);
        if (list.length === 0) return [];
        const ul = el('ul', { class: 'lpl-quests', 'data-nav': 'list' });
        for (const q of list) ul.append(this.questItem(q, q.id === current, q.id === focusId));
        return [el('h3', { class: `lpl-section-title${kind === 'side' ? ' lpl-section-gap' : ''}`, text: ctx.t(ctx.texts.game.ui.questKinds[kind]) }), ul];
      };
      const nodes = [...section('main'), ...section('side')];
      return nodes.length === 0 ? [el('div', { class: 'lpl-empty', text: ctx.t(ctx.texts.extra.notebook.noQuests) })] : nodes;
    });
  }

  private questItem(q: QuestModel, current: boolean, autofocus: boolean): HTMLLIElement {
    const { ctx } = this.host;
    let side: HTMLElement;
    if (q.done) side = chip(ctx.t(ctx.texts.game.ui.questDone), 'ready', 'ui-check');
    else if (q.progress !== '') side = chip(q.progress);
    else side = el('span');
    const lead = q.done ? icon('ui-check', 'lpl-icon lpl-quest__done') : icon(q.kind === 'main' ? 'ui-flag' : 'ui-heart');
    return el(
      'li',
      {
        class: 'lpl-quest',
        tabindex: '0',
        'data-nav-item': true,
        'data-key': `quest:${q.id}`,
        'data-state': q.done ? 'done' : current ? 'current' : null,
        'data-autofocus': autofocus,
      },
      [lead, el('span', { class: 'lpl-quest__title', text: q.title }), side, el('span', { class: 'lpl-quest__text', text: q.text })],
    );
  }

  private renderMail(letters: ReturnType<typeof letterModels>): void {
    const { ctx } = this.host;
    const n = ctx.texts.extra.notebook;
    if (this.letter === null || !letters.some((l) => l.id === this.letter)) {
      this.letter = letters[defaultLetter(letters)]?.id ?? null;
    }
    const selected = letters.find((l) => l.id === this.letter) ?? null;
    if (selected?.unread === true) this.host.send({ type: 'read_letter', letter: selected.id });
    const sig = JSON.stringify(['mail', letters.map((l) => [l.id, l.unread]), this.letter]);
    this.renderBody(sig, () => {
      if (letters.length === 0) return [el('div', { class: 'lpl-empty' }, [icon('ui-letter'), ctx.t(n.noLetters)])];
      const list = el('ul', { class: 'lpl-letter-list', 'data-nav': 'list', 'aria-label': n.lettersLabel });
      for (const l of letters) {
        list.append(
          el('li', {}, [
            button([icon('ui-letter'), el('strong', { text: l.from }), el('small', { text: l.day })], () => {
              this.letter = l.id;
              this.host.invalidate();
            }, {
              class: 'lpl-letter-item',
              attrs: {
                'data-nav-item': true,
                'data-key': `letter:${l.id}`,
                'aria-current': String(l.id === this.letter),
                'data-state': l.unread && l.id !== this.letter ? 'unread' : null,
                'data-autofocus': l.id === this.letter,
              },
            }),
          ]),
        );
      }
      const article =
        selected === null
          ? null
          : el('article', { class: 'lpl-letter', 'aria-label': ctx.t(n.letterOf, { from: selected.from }) }, [
              el('span', { class: 'lpl-stamp', text: selected.from }),
              el('p', { class: 'lpl-letter__from', text: selected.title }),
              el('p', { text: ctx.t(`« ${selected.text} »`) }),
            ]);
      return [el('div', { class: 'lpl-mail' }, [list, article])];
    });
  }

  private renderBag(world: ReadonlyWorld): void {
    const { ctx } = this.host;
    const n = ctx.texts.extra.notebook;
    const me = characterOf(world, ctx.me);
    if (me === null) return;
    const occupied = me.bag.map((s) => s !== null);
    if (this.checked === null || this.checked >= me.bag.length) this.checked = defaultBagSlot(occupied, me.selected);
    const slots = me.bag.map((_, i) => slotModel(ctx, me, i));
    const checkedStack = me.bag[this.checked] ?? null;
    const detail = checkedStack === null ? null : itemDetail(ctx, checkedStack);
    const sig = JSON.stringify(['bag', slots, this.checked, this.moving, detail]);
    this.renderBody(sig, () => {
      const toolbar = el('div', { class: 'lpl-inventory lpl-inventory--toolbar', 'aria-label': ctx.t(n.toolbar) });
      const rest = el('div', { class: 'lpl-inventory', 'aria-label': ctx.t(n.bag, { count: me.bag.length - UI_SETTINGS.toolbarSlots }), style: `--lpl-columns: ${UI_SETTINGS.bagColumns}` });
      slots.forEach((s, i) => {
        (i < UI_SETTINGS.toolbarSlots ? toolbar : rest).append(this.bagSlot(s, i));
      });
      const slotsBox = el('div', { class: 'lpl-bag__slots', 'data-nav': 'grid' }, [
        el('p', { class: 'lpl-overline', text: ctx.t(n.toolbar) }),
        toolbar,
        el('p', { class: 'lpl-overline', text: ctx.t(n.bag, { count: me.bag.length - UI_SETTINGS.toolbarSlots }) }),
        rest,
      ]);
      let aside: HTMLElement;
      if (bagEmpty(me)) {
        aside = el('div', { class: 'lpl-empty', style: 'flex: 1 1 14rem' }, [icon('grain-sack', 'lpl-icon lpl-empty__icon'), ctx.t(n.bagEmpty)]);
      } else if (detail === null || checkedStack === null) {
        aside = el('aside', { class: 'lpl-item-detail', 'aria-label': n.detailLabel }, [el('p', { class: 'lpl-item-detail__meta', text: ctx.t(ctx.texts.extra.common.emptySlot) })]);
      } else {
        const index = this.checked ?? 0;
        const actions = el('div', { class: 'lpl-item-detail__actions' });
        detail.actions.forEach((a, i) => {
          const label = a === 'eat' ? ctx.t(n.eat, { amount: detail.eatAmount }) : a === 'read' ? ctx.t(n.read) : ctx.t(n.hold);
          actions.append(
            button(i === 0 ? [label, ' ', keycap(ctx.key('Enter'))] : label, () => {
              this.runAction(a, index, checkedStack.item);
            }, { class: `lpl-button${i === 0 ? ' lpl-button--primary' : ''}`, attrs: { 'data-key': `action:${a}` } }),
          );
        });
        actions.append(
          button([this.moving === null ? ctx.t(n.move) : ctx.t(n.moving, { key: ctx.key('Space') }), ' ', keycap(ctx.key('Space'))], () => {
            this.toggleMove(index);
            focusElement(this.body.querySelector<HTMLElement>(`[data-slot="${index}"]`));
          }, { attrs: { 'data-key': 'action:move', 'aria-pressed': this.moving === null ? 'false' : 'true' } }),
        );
        aside = el('aside', { class: 'lpl-item-detail', 'aria-label': n.detailLabel }, [
          el('div', { class: 'lpl-item-detail__head' }, [
            icon(detail.icon, ''),
            el('div', {}, [
              el('p', { class: 'lpl-item-detail__name', text: detail.name }),
              el('p', { class: 'lpl-item-detail__meta' }, [detail.fine ? icon('ui-star') : null, detail.fine ? ' ' : null, detail.meta]),
            ]),
          ]),
          detail.text === '' ? null : el('p', { text: detail.text }),
          actions,
        ]);
      }
      const nodes: (Node | null)[] = [el('div', { class: 'lpl-bag' }, [slotsBox, aside])];
      if (bagFull(me)) {
        nodes.push(el('div', { style: 'margin-top: 0.75rem' }, [el('p', { class: 'lpl-toast lpl-toast--error', style: 'animation: none' }, [icon('ui-warning'), ctx.t(n.bagFull)])]));
      }
      return nodes;
    });
  }

  private bagSlot(s: ReturnType<typeof slotModel>, index: number): HTMLButtonElement {
    const b = button([], () => {
      if (this.moving !== null) {
        this.toggleMove(index);
        return;
      }
      this.checked = index;
      this.host.invalidate();
    }, {
      class: `lpl-slot${s.item === null ? ' lpl-slot--empty' : ''}${this.moving === index ? ' lpl-slot--moving' : ''}`,
      attrs: {
        'data-nav-item': true,
        'data-slot': String(index),
        'data-key': `slot:${index}`,
        'aria-label': s.label,
        'aria-checked': String(index === this.checked),
        'data-autofocus': index === this.checked,
        draggable: s.item === null ? null : 'true',
      },
    });
    if (s.icon !== null) b.append(icon(s.icon, 'lpl-slot__icon'));
    if (s.count > 1) b.append(el('span', { class: 'lpl-slot__count', text: String(s.count) }));
    if (s.fine) b.append(icon('ui-star', 'lpl-slot__quality'));
    if (s.gauge !== null) b.append(el('span', { class: 'lpl-slot__gauge', 'aria-hidden': 'true', style: `--lpl-value: ${Math.round(s.gauge * 100)}%` }));
    // Glisser-déposer entre deux cases.
    b.addEventListener('dragstart', (e) => {
      this.dragFrom = index;
      e.dataTransfer?.setData('text/plain', String(index));
    });
    b.addEventListener('dragover', (e) => {
      if (this.dragFrom !== null) e.preventDefault();
    });
    b.addEventListener('drop', (e) => {
      e.preventDefault();
      const from = this.dragFrom;
      this.dragFrom = null;
      if (from !== null && from !== index) {
        this.host.send({ type: 'swap_slots', from, to: index });
        this.checked = index;
        this.host.invalidate();
      }
    });
    b.addEventListener('dragend', () => {
      this.dragFrom = null;
    });
    return b;
  }
}
