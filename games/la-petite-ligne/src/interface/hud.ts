/**
 * HUD: horloge, bourse, notifications, l'autre joueur, prochain objectif,
 * soi (portrait, forme, endurance), astuce, barre d'outils de 10 cases,
 * barre d'aménagement, commandes de la caméra et du carnet à la souris.
 * Le DOM n'est touché que si une valeur affichée change.
 */
import type { GameNotification, ReadonlyWorld } from '../etat/types';
import type { UiHost } from './composant';
import { UI_SETTINGS } from './config';
import { characterOf } from './contexte';
import { button, chip, clear, el, icon, keycap, keysLine, portrait, setAttr, setHidden, setIcon, setPortrait, setStyleVar, setText, token } from './dom';
import { clockTime, contentVars, fill, itemTitle, keyTokens } from './format';
import {
  clockModel,
  formModel,
  itemIcon,
  minutesSince,
  nextObjective,
  partnerModel,
  purseModel,
  splitAmount,
  staminaModel,
  toolbarModel,
  type SlotModel,
} from './modele';
import { toastVisual, visibleToasts } from './notifications';
import { playerColors, portraitSvg } from './portrait';
import { typographier } from './typographie';

interface SlotView {
  button: HTMLButtonElement;
  key: HTMLSpanElement;
  icon: SVGSVGElement;
  count: HTMLSpanElement;
  quality: SVGSVGElement;
  gauge: HTMLSpanElement;
  lastCount: number;
  lastItem: string | null;
}

export class Hud {
  readonly root: HTMLDivElement;
  private readonly host: UiHost;

  private readonly clock: HTMLDivElement;
  private readonly clockWeather: SVGSVGElement;
  private readonly clockDay: HTMLSpanElement;
  private readonly clockTime: HTMLSpanElement;
  private readonly clockStatus: HTMLSpanElement;
  private readonly clockStatusIcon: SVGSVGElement;
  private readonly clockStatusText: HTMLSpanElement;
  private readonly clockTrain: HTMLSpanElement;
  private readonly clockTrainText: HTMLSpanElement;

  private readonly purseAmount: HTMLSpanElement;
  private readonly purseNote: HTMLSpanElement;
  private readonly purseDelta: HTMLSpanElement;
  private lastPurse: number | null = null;
  private deltaUntil = 0;

  private readonly toasts: HTMLUListElement;
  private readonly toastItems = new Map<number, HTMLLIElement>();
  private readonly seenAt = new Map<number, number>();
  private firstSight = true;

  private readonly partner: HTMLDivElement;
  private readonly partnerPortrait: HTMLSpanElement;
  private readonly partnerName: HTMLSpanElement;
  private readonly partnerIcon: SVGSVGElement;
  private readonly partnerActivity: HTMLSpanElement;
  private partnerInputTick = -1;
  private partnerInputAt = 0;

  private readonly objective: HTMLElement;
  private readonly objectiveTitle: HTMLHeadingElement;
  private readonly objectiveText: HTMLParagraphElement;
  private readonly objectiveLines: HTMLUListElement;
  private objectiveSig = '';

  private readonly self: HTMLDivElement;
  private readonly selfPortrait: HTMLSpanElement;
  private readonly selfName: HTMLSpanElement;
  private readonly selfMood: HTMLSpanElement;
  private readonly stamina: HTMLSpanElement;
  private readonly staminaLabel: HTMLSpanElement;

  private readonly tip: HTMLParagraphElement;
  private tipId = -1;
  private tipUntil = 0;

  private readonly toolbar: HTMLDivElement;
  private readonly toolbarHeld: HTMLSpanElement;
  private readonly toolbarDetail: HTMLElement;
  private readonly slots: SlotView[] = [];
  private readonly newUntil: number[] = [];

  private readonly build: HTMLDivElement;
  private readonly buildIcon: SVGSVGElement;
  private readonly buildName: HTMLSpanElement;
  private readonly buildState: HTMLSpanElement;
  private readonly buildRotation: HTMLSpanElement;
  private buildSig = '';

  constructor(host: UiHost) {
    this.host = host;
    const { ctx } = host;
    const x = ctx.texts.extra;

    // Haut gauche: horloge, bourse, notifications.
    this.clockWeather = icon('weather-sun', '');
    this.clockDay = el('span', { class: 'lpl-clock__day' });
    this.clockTime = el('span', { class: 'lpl-clock__time' });
    this.clockStatusIcon = icon('ui-pause');
    this.clockStatusText = el('span');
    this.clockStatus = el('span', { class: 'lpl-clock__status' }, [this.clockStatusIcon, this.clockStatusText]);
    this.clockTrainText = el('span');
    this.clockTrain = el('span', { class: 'lpl-clock__train' }, [icon('ui-train'), this.clockTrainText]);
    this.clock = el('div', { class: 'lpl-clock', 'aria-label': x.hud.clockLabel }, [
      el('span', { class: 'lpl-clock__weather' }, [this.clockWeather]),
      this.clockDay,
      this.clockTime,
      this.clockStatus,
      this.clockTrain,
    ]);

    const unit = splitAmount(ctx.texts.game.ui.hud.purse);
    this.purseAmount = el('span', { class: 'lpl-purse__amount' });
    this.purseNote = el('span', { class: 'lpl-purse__note', hidden: true });
    this.purseDelta = el('span', { class: 'lpl-purse__delta', hidden: true });
    const purse = el('div', { class: 'lpl-purse', 'aria-label': x.hud.purseLabel }, [
      icon('ui-coin'),
      unit.before.trim() === '' ? null : el('span', { class: 'lpl-purse__unit', text: unit.before.trim() }),
      this.purseAmount,
      el('span', { class: 'lpl-purse__unit', text: unit.after.trim() }),
      this.purseNote,
      this.purseDelta,
    ]);

    this.toasts = el('ul', { class: 'lpl-toasts', 'aria-live': 'polite', 'aria-label': x.hud.toastsLabel });

    // Haut droite: l'autre, objectif.
    this.partnerPortrait = portrait('', 'small', token('other', host.symbol('other'), 'small'));
    this.partnerName = el('span', { class: 'lpl-partner__name' });
    this.partnerIcon = icon('ui-pin');
    this.partnerActivity = el('span');
    this.partner = el('div', { class: 'lpl-partner' }, [
      this.partnerPortrait,
      this.partnerName,
      el('span', { class: 'lpl-partner__activity' }, [this.partnerIcon, this.partnerActivity]),
    ]);

    this.objectiveTitle = el('h2', { class: 'lpl-objective__title' });
    this.objectiveText = el('p', { class: 'lpl-objective__text' });
    this.objectiveLines = el('ul', { class: 'lpl-objective__lines' });
    this.objective = el('section', { class: 'lpl-objective', 'aria-label': ctx.texts.game.ui.hud.nextGoal }, [
      el('p', { class: 'lpl-objective__label lpl-overline' }, [icon('ui-flag'), ctx.texts.game.ui.hud.nextGoal]),
      this.objectiveTitle,
      this.objectiveText,
      this.objectiveLines,
    ]);

    // Bas gauche: soi.
    this.selfPortrait = portrait('', '', token('self', host.symbol('self')));
    this.selfName = el('span', { class: 'lpl-self__name' });
    this.selfMood = el('span', { class: 'lpl-self__mood' });
    this.staminaLabel = el('span', { class: 'lpl-stamina__label' });
    this.stamina = el(
      'span',
      { class: 'lpl-stamina', role: 'meter', 'aria-label': x.hud.stamina, 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': 100 },
      [icon('ui-stamina'), el('span', { class: 'lpl-stamina__bar' }, [el('span', { class: 'lpl-stamina__fill' })]), this.staminaLabel],
    );
    this.self = el('div', { class: 'lpl-self' }, [
      this.selfPortrait,
      el('span', { class: 'lpl-self__text' }, [this.selfName, this.selfMood, this.stamina]),
    ]);

    // Bas centre: astuce, barre d'outils, barre d'aménagement.
    this.tip = el('p', { class: 'lpl-tip', role: 'status', hidden: true });
    this.toolbarHeld = el('span');
    this.toolbarDetail = el('small');
    const slotsBox = el('div', { class: 'lpl-toolbar__slots', 'aria-label': x.hud.toolbarLabel });
    for (let i = 0; i < UI_SETTINGS.toolbarSlots; i++) {
      const view = this.makeSlot(i);
      this.slots.push(view);
      this.newUntil.push(0);
      slotsBox.append(view.button);
    }
    this.toolbar = el('div', { class: 'lpl-toolbar' }, [
      el('p', { class: 'lpl-toolbar__label' }, [this.toolbarHeld, this.toolbarDetail]),
      slotsBox,
    ]);

    this.buildIcon = icon('table', '');
    this.buildName = el('span', { class: 'lpl-build-bar__name' });
    this.buildState = el('span');
    this.buildRotation = el('span', { class: 'lpl-chip' });
    const keyLabel = ctx.key;
    const k = x.build;
    this.build = el('div', { class: 'lpl-build-bar', role: 'status', 'aria-live': 'polite', hidden: true }, [
      el('span', { class: 'lpl-build-bar__item' }, [
        this.buildIcon,
        el('span', {}, [this.buildName, el('span', { class: 'lpl-overline', style: 'display: block', text: k.holding })]),
      ]),
      this.buildState,
      this.buildRotation,
      keysLine([
        { keys: [x.keys.wheel, keyLabel('KeyT')], text: k.rotate, between: x.keys.or },
        { keys: ['KeyW', 'KeyA', 'KeyS', 'KeyD'].map(keyLabel), text: `${x.keys.or} ${x.keys.click} ${k.move}` },
        { keys: [keyLabel('Space')], text: `${x.keys.or} ${x.keys.click} ${k.place}` },
        { keys: [keyLabel('KeyX')], text: `${x.keys.or} ${x.keys.rightClick} ${k.take}` },
        { keys: [keyLabel('Backspace')], text: k.store },
      ]),
    ]);
    const buildKeys = this.build.lastElementChild;
    if (buildKeys !== null) buildKeys.classList.add('lpl-build-bar__keys');

    // Bas droite: caméra et carnet.
    const shortcut = (iconId: string, code: string, label: string, onClick: () => void): HTMLSpanElement => {
      const b = button([icon(iconId)], onClick, {
        class: 'lpl-icon-button',
        attrs: { 'aria-label': fill(label, { key: keyLabel(code) }) },
      });
      keepFocusOnGame(b);
      const cap = keycap(keyLabel(code));
      cap.setAttribute('aria-hidden', 'true');
      return el('span', { class: 'lpl-shortcut' }, [b, cap]);
    };
    const shortcuts = el('div', { class: 'lpl-shortcuts' }, [
      shortcut('ui-rotate-left', 'KeyQ', x.hud.rotateLeft, () => {
        host.camera('rotate_left');
      }),
      shortcut('ui-rotate-right', 'KeyE', x.hud.rotateRight, () => {
        host.camera('rotate_right');
      }),
      shortcut('ui-notebook', 'Tab', x.hud.openNotebook, () => {
        host.toggleMenu('notebook');
      }),
    ]);

    this.root = el('div', { class: 'lpl-hud' }, [
      el('div', { class: 'lpl-hud__top-left' }, [this.clock, purse, this.toasts]),
      el('div', { class: 'lpl-hud__top-right' }, [this.partner, this.objective]),
      el('div', { class: 'lpl-hud__bottom-left' }, [this.self]),
      el('div', { class: 'lpl-hud__bottom' }, [this.tip, this.toolbar, this.build]),
      el('div', { class: 'lpl-hud__bottom-right' }, [shortcuts]),
    ]);
  }

  private makeSlot(index: number): SlotView {
    const keyLabel = this.host.ctx.key(index === 9 ? 'Digit0' : `Digit${index + 1}`);
    const key = el('span', { class: 'lpl-slot__key', 'aria-hidden': 'true', text: keyLabel });
    const slotIcon = icon('hoe', 'lpl-slot__icon');
    const count = el('span', { class: 'lpl-slot__count', hidden: true });
    const quality = icon('ui-star', 'lpl-slot__quality');
    quality.toggleAttribute('hidden', true);
    const gauge = el('span', { class: 'lpl-slot__gauge', 'aria-hidden': 'true', hidden: true });
    const b = button([key, slotIcon, count, quality, gauge], () => {
      this.host.send({ type: 'select_slot', slot: index });
    }, { class: 'lpl-slot', attrs: { 'aria-selected': 'false' } });
    keepFocusOnGame(b);
    return { button: b, key, icon: slotIcon, count, quality, gauge, lastCount: 0, lastItem: null };
  }

  /** Heure seule (appelée à chaque image: compare une chaîne). */
  updateClockOnly(world: ReadonlyWorld): void {
    const { ctx } = this.host;
    const minutes = Math.floor(world.clock.minutes / UI_SETTINGS.clockStepMinutes);
    if (minutes === this.clockStep) return;
    this.clockStep = minutes;
    setText(this.clockTime, ctx.t(clockTime(world.clock.minutes, ctx.texts.game.ui.hud.time)));
  }

  private clockStep = -1;

  /** Masque le bas du HUD pendant une conversation, et l'objectif et le bas pendant un panneau. */
  setLayer(kind: 'dialogue' | 'panel' | null): void {
    setAttr(this.root, 'data-state', kind);
  }

  update(world: ReadonlyWorld): void {
    const { ctx } = this.host;
    const now = this.host.now();
    const me = characterOf(world, ctx.me);
    if (me === null) return;

    // Horloge.
    const clock = clockModel(world, ctx);
    setIcon(this.clockWeather, clock.weatherIcon);
    setText(this.clockDay, clock.day);
    setText(this.clockTime, clock.time);
    setAttr(this.clock, 'data-state', clock.state === '' ? null : clock.state);
    setText(this.clockStatusText, clock.status ?? '');
    setIcon(this.clockStatusIcon, clock.statusIcon);
    setAttr(this.clock, 'data-train', clock.train === null ? null : 'soon');
    setText(this.clockTrainText, clock.train ?? '');

    // Bourse.
    const purse = purseModel(world);
    setText(this.purseAmount, String(purse.amount));
    setHidden(this.purseNote, purse.reserved === 0);
    setText(this.purseNote, ctx.t(ctx.texts.extra.hud.reserved, { amount: purse.reserved }));
    if (this.lastPurse !== null && purse.amount > this.lastPurse) {
      setText(this.purseDelta, `+${purse.amount - this.lastPurse}`);
      // Rejoue l'animation d'apparition.
      this.purseDelta.toggleAttribute('hidden', true);
      void this.purseDelta.getBoundingClientRect();
      this.purseDelta.toggleAttribute('hidden', false);
      this.deltaUntil = now + UI_SETTINGS.purseDeltaMs;
    }
    this.lastPurse = purse.amount;
    if (now >= this.deltaUntil) setHidden(this.purseDelta, true);

    this.updateToasts(me.notifications, now);

    // L'autre joueur.
    const partnerChar = characterOf(world, ctx.partner);
    if (partnerChar !== null && partnerChar.lastInputTick !== this.partnerInputTick) {
      this.partnerInputTick = partnerChar.lastInputTick;
      this.partnerInputAt = now;
    }
    const awayAfter = ctx.content.settings.absence.minutes;
    const away = minutesSince(this.partnerInputAt, now);
    const p = partnerModel(world, ctx, partnerChar?.status === 'active' && away >= awayAfter ? away : null);
    setHidden(this.partner, p === null);
    if (p !== null && partnerChar !== null) {
      setPortrait(this.partnerPortrait, portraitSvg(playerColors(partnerChar.id, partnerChar.appearance), p.expression, ''));
      setText(this.partnerName, p.name);
      setAttr(this.partner, 'aria-label', p.name);
      setIcon(this.partnerIcon, p.icon);
      setText(this.partnerActivity, p.activity);
      setAttr(this.partner, 'data-state', p.state === '' ? null : p.state);
    }

    // Objectif.
    const goal = nextObjective(world, ctx);
    const sig = goal === null ? '' : JSON.stringify(goal);
    if (sig !== this.objectiveSig) {
      this.objectiveSig = sig;
      setHidden(this.objective, goal === null);
      if (goal !== null) {
        setText(this.objectiveTitle, goal.title);
        setText(this.objectiveText, goal.text);
        clear(this.objectiveLines);
        for (const line of goal.lines) {
          this.objectiveLines.append(
            el('li', { 'data-state': line.done ? 'done' : null }, [
              line.icon === null ? icon(line.done ? 'ui-check' : 'ui-minus') : icon(line.icon),
              el('span', { text: line.text }),
            ]),
          );
        }
        setHidden(this.objectiveLines, goal.lines.length === 0);
      }
    }

    // Soi.
    const form = formModel(ctx, me);
    setPortrait(this.selfPortrait, portraitSvg(playerColors(me.id, me.appearance), form.expression, form.name));
    setText(this.selfName, me.name);
    setAttr(this.self, 'aria-label', ctx.t(ctx.texts.extra.hud.selfLabel, { name: me.name }));
    setText(this.selfMood, form.name);
    const st = staminaModel(ctx, me);
    setStyleVar(this.stamina, '--lpl-value', `${Math.round(st.ratio * 100)}%`);
    setAttr(this.stamina, 'aria-valuenow', String(Math.round(st.ratio * 100)));
    setAttr(this.stamina, 'data-level', st.level === '' ? null : st.level);
    setText(this.staminaLabel, st.label);

    // Barre d'outils ou barre d'aménagement.
    const placing = me.placement !== null;
    setHidden(this.toolbar, placing);
    setHidden(this.build, !placing);
    if (me.placement !== null) this.updateBuild(me.placement);
    else this.updateToolbar(me, now);
  }

  private updateToolbar(me: NonNullable<ReturnType<typeof characterOf>>, now: number): void {
    const model = toolbarModel(this.host.ctx, me);
    setText(this.toolbarHeld, model.held);
    setText(this.toolbarDetail, model.detail);
    setHidden(this.toolbarDetail, model.detail === '');
    model.slots.forEach((slot, i) => {
      const view = this.slots[i];
      if (view !== undefined) this.updateSlot(view, slot, i === model.selected, now, i);
    });
  }

  private updateSlot(view: SlotView, slot: SlotModel, selected: boolean, now: number, index: number): void {
    const b = view.button;
    b.classList.toggle('lpl-slot--empty', slot.item === null);
    setAttr(b, 'aria-label', slot.label);
    setAttr(b, 'aria-selected', selected ? 'true' : 'false');
    setHidden(view.icon, slot.icon === null);
    if (slot.icon !== null) setIcon(view.icon, slot.icon);
    setHidden(view.count, slot.count <= 1);
    setText(view.count, String(slot.count));
    setHidden(view.quality, !slot.fine);
    setHidden(view.gauge, slot.gauge === null);
    if (slot.gauge !== null) setStyleVar(view.gauge, '--lpl-value', `${Math.round(slot.gauge * 100)}%`);
    const gained = slot.item !== null && (slot.item !== view.lastItem || slot.count > view.lastCount);
    if (gained && !this.firstSight) this.newUntil[index] = now + UI_SETTINGS.slotNewMs;
    view.lastItem = slot.item;
    view.lastCount = slot.count;
    const fresh = (this.newUntil[index] ?? 0) > now;
    setAttr(b, 'data-state', slot.unusable ? 'unusable' : fresh ? 'new' : null);
  }

  private updateBuild(placement: NonNullable<NonNullable<ReturnType<typeof characterOf>>['placement']>): void {
    const { ctx } = this.host;
    const reason = placement.blocked ?? null;
    const sig = `${placement.item}|${placement.valid}|${placement.rotation}|${reason ?? ''}`;
    if (sig === this.buildSig) return;
    this.buildSig = sig;
    setIcon(this.buildIcon, itemIcon(ctx, placement.item));
    setText(this.buildName, ctx.t(itemTitle(ctx.content.items[placement.item], 1, placement.item)));
    clear(this.buildState);
    this.buildState.append(
      placement.valid
        ? chip(ctx.t(ctx.texts.extra.build.canPlace), 'ready', 'ui-check')
        : chip(ctx.t(reason ?? ctx.texts.extra.build.blocked), 'alert', 'ui-warning'),
    );
    setText(this.buildRotation, ctx.t(ctx.texts.extra.common.orientation[placement.rotation % 4] ?? ''));
  }

  private updateToasts(list: readonly Readonly<GameNotification>[], now: number): void {
    const { ctx } = this.host;
    const durationMs = (ctx.content.settings.hints.durationSeconds || UI_SETTINGS.toastSeconds) * 1000;
    for (const n of list) {
      if (!this.seenAt.has(n.id)) {
        // Au montage, les notifications déjà là sont anciennes: on ne les rejoue pas.
        this.seenAt.set(n.id, this.firstSight ? now - durationMs : now);
      }
    }
    this.firstSight = false;
    // La simulation ne garde que les dernières notifications: on oublie les autres (séance d'une heure).
    if (this.seenAt.size > list.length * 2) {
      const ids = new Set(list.map((n) => n.id));
      for (const id of this.seenAt.keys()) if (!ids.has(id)) this.seenAt.delete(id);
    }
    // Astuce: la plus récente encore fraîche, en bas au centre.
    const hints = visibleToasts(
      list.filter((n) => n.kind === 'hint'),
      this.seenAt,
      now,
      durationMs,
      1,
    );
    const hint = hints[0];
    if (hint !== undefined && hint.id !== this.tipId) {
      this.tipId = hint.id;
      this.tipUntil = (this.seenAt.get(hint.id) ?? now) + durationMs;
      clear(this.tip);
      const vars = { ...contentVars(ctx.content, null, ctx.texts.orderFormat), ...keyTokens(ctx.key) };
      this.tip.append(typographier(fill(hint.text, vars)));
      if (hint.hint !== null) this.host.send({ type: 'hint_seen', hint: hint.hint });
    }
    setHidden(this.tip, now >= this.tipUntil);

    // Les astuces vont en bas; une proposition d'achat a sa propre carte.
    const shown = visibleToasts(
      list.filter((n) => n.kind !== 'hint' && n.kind !== 'proposal'),
      this.seenAt,
      now,
      durationMs,
      UI_SETTINGS.maxToasts,
    );
    const keep = new Set(shown.map((n) => n.id));
    for (const [id, li] of this.toastItems) {
      if (keep.has(id)) continue;
      this.toastItems.delete(id);
      li.setAttribute('data-state', 'leaving');
      window.setTimeout(() => {
        li.remove();
      }, UI_SETTINGS.foldMs);
    }
    for (const n of shown) {
      if (this.toastItems.has(n.id)) continue;
      const visual = toastVisual(n, ctx.texts.messages);
      const li = el('li', { class: `lpl-toast${visual.variant === '' ? '' : ` lpl-toast--${visual.variant}`}` }, [
        visual.partnerToken ? token('other', this.host.symbol('other'), 'small') : icon(visual.icon === '' ? 'ui-note' : visual.icon),
        typographier(n.text),
      ]);
      this.toastItems.set(n.id, li);
      this.toasts.append(li);
    }
  }
}

/** Un clic sur un bouton du HUD laisse le clavier au jeu (Z Q S D, Espace). */
function keepFocusOnGame(b: HTMLButtonElement): void {
  b.addEventListener('mousedown', (e) => {
    e.preventDefault();
  });
}
