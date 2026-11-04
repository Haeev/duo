/**
 * Panneau « Décision à deux » (0.13, conception `v0-13-habitants.md` section 5.2; interface
 * imagée de la 0.12.2): l'habitant qui demande, sa question, et deux ou trois options en grands
 * dessins avec les portraits des habitants qu'elles touchent, ce qu'elles changent en une ligne.
 * Sur chaque option, le jeton de qui l'a choisie (le sien, celui de l'autre). Il s'ouvre chez les
 * deux, ne prend jamais le focus de lui-même (Entrée l'y amène), se ferme par « Plus tard » ou
 * Retour arrière et reste alors en rappel (« Une décision vous attend »). Une fois décidé, le
 * tampon « Décidé ensemble » tombe sur l'option retenue, puis le panneau se replie.
 */
import type { DecisionDef } from '../donnees/decisions';
import type { CharacterId, ReadonlyWorld, WorldEvent } from '../etat/types';
import type { UiHost } from './composant';
import { UI_SETTINGS } from './config';
import { nameOf, type UiContext } from './contexte';
import { button, el, icon, keepFocusOnGame, keycap, portrait, token } from './dom';
import { portraitSvg, silhouetteSvg, villagerColors } from './portrait';

export type DecisionPhase = 'choose' | 'waitingPartner' | 'waitingMe' | 'disagree' | 'agreed' | 'taken';

export interface DecisionOptionModel {
  id: string;
  label: string;
  change: string;
  icon: string;
  villagers: string[];
  mine: boolean;
  theirs: boolean;
}

export interface DecisionModel {
  id: string;
  villager: string;
  villagerName: string;
  question: string;
  options: DecisionOptionModel[];
  phase: DecisionPhase;
}

function other(id: CharacterId): CharacterId {
  return id === 'p1' ? 'p2' : 'p1';
}

function modelOf(def: DecisionDef, ctx: UiContext, mine: string | null, theirs: string | null, phase: DecisionPhase): DecisionModel {
  return {
    id: def.id,
    villager: def.villager,
    villagerName: ctx.content.villagers.find((v) => v.id === def.villager)?.firstName ?? def.villager,
    question: def.question,
    options: def.options.map((o) => ({
      id: o.id,
      label: o.label,
      change: o.change,
      icon: o.icon,
      villagers: o.villagers,
      mine: o.id === mine,
      theirs: o.id === theirs,
    })),
    phase,
  };
}

/** Les décisions ouvertes, dans l'ordre de leur ouverture, vues par ce joueur. */
export function decisionModels(world: ReadonlyWorld, ctx: UiContext): DecisionModel[] {
  const out: DecisionModel[] = [];
  for (const [id, open] of Object.entries(world.decisionsOpen)) {
    const def = ctx.content.decisions.list.find((d) => d.id === id);
    if (def === undefined) continue;
    const mine = open[ctx.me] ?? null;
    const theirs = open[other(ctx.me)] ?? null;
    const phase: DecisionPhase =
      open.agreedAt !== undefined
        ? 'agreed'
        : mine !== null && theirs !== null
          ? 'disagree'
          : mine !== null
            ? 'waitingPartner'
            : theirs !== null
              ? 'waitingMe'
              : 'choose';
    out.push(modelOf(def, ctx, mine, theirs, phase));
  }
  return out;
}

/** La décision tout juste prise, pour le tampon: les deux jetons sur l'option retenue. */
export function takenModel(ctx: UiContext, decision: string, option: string): DecisionModel | null {
  const def = ctx.content.decisions.list.find((d) => d.id === decision);
  return def === undefined ? null : modelOf(def, ctx, option, option, 'taken');
}

function face(id: string, size: '' | 'small' | 'large'): HTMLSpanElement {
  const colors = villagerColors(id);
  return portrait(colors === null ? silhouetteSvg() : portraitSvg(colors, 'good', '', id), size);
}

export class DecisionPanel {
  readonly root: HTMLDivElement;
  private readonly host: UiHost;
  /** Décisions que ce joueur a mises de côté (« Plus tard »): local, jamais dans l'état. */
  private readonly later = new Set<string>();
  private ending: { model: DecisionModel; until: number } | null = null;
  private sig = '';
  private card: HTMLElement | null = null;
  private defaultButton: HTMLButtonElement | null = null;
  private hidden = false;
  /** Dernière décision montrée: l'entrée animée ne rejoue pas à chaque choix. */
  private lastShown = '';

  constructor(host: UiHost) {
    this.host = host;
    this.root = el('div', { class: 'lpl-pass-through lpl-decisions' });
  }

  onEvent(event: WorldEvent): void {
    if (event.type === 'decision_opened') {
      this.later.delete(event.decision);
      this.host.invalidate();
      return;
    }
    if (event.type !== 'decision_taken') return;
    const model = takenModel(this.host.ctx, event.decision, event.option);
    if (model === null) return;
    this.later.delete(event.decision);
    this.ending = { model, until: this.host.now() + UI_SETTINGS.decisionStampMs };
    this.host.invalidate();
  }

  /** Une couche plein cadre, un dialogue ou un panneau est ouvert: le panneau se retire le temps qu'il dure. */
  setHidden(hidden: boolean): void {
    this.hidden = hidden;
  }

  /** Le panneau est à l'écran: Entrée peut y amener le focus. */
  hasPanel(): boolean {
    return this.card?.dataset.kind === 'panel';
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
    if (this.ending !== null && now >= this.ending.until) this.ending = null;
    const models = decisionModels(world, ctx);
    const shown = this.ending?.model ?? models.find((m) => !this.later.has(m.id)) ?? null;
    const waiting = shown === null && models.length > 0;
    const partner = nameOf(world, ctx.partner);
    const sig = JSON.stringify([this.hidden, shown, waiting, partner]);
    if (sig === this.sig) return;
    this.sig = sig;
    const hadFocus = this.root.contains(document.activeElement);
    this.root.replaceChildren();
    this.card = null;
    this.defaultButton = null;
    if (this.hidden) return;
    const t = ctx.texts.extra.decision;
    if (shown === null) {
      if (!waiting) return;
      // Rappel: la décision mise de côté se rouvre d'un clic.
      const reopen = button([icon('ui-neighbours'), ctx.t(t.reopen)], () => {
        this.later.clear();
        this.host.invalidate();
      }, { class: 'lpl-button lpl-decision-reopen' });
      keepFocusOnGame(reopen);
      this.root.append(reopen);
      this.card = reopen;
      this.defaultButton = reopen;
      return;
    }
    this.root.append(this.build(shown, partner));
    if (hadFocus) this.focusDefault();
  }

  private build(m: DecisionModel, partner: string): HTMLElement {
    const { ctx } = this.host;
    const t = ctx.texts.extra.decision;
    const titleId = `decision-${m.id}`;
    const entering = m.id !== this.lastShown;
    this.lastShown = m.id;
    const card = el('section', { class: entering ? 'lpl-decision lpl-decision--enter' : 'lpl-decision', role: 'region', 'aria-labelledby': titleId, 'data-kind': 'panel', 'data-phase': m.phase });
    card.append(
      el('header', { class: 'lpl-decision__head' }, [
        face(m.villager, 'large'),
        el('div', { class: 'lpl-decision__ask' }, [
          el('p', { class: 'lpl-overline', text: `${ctx.t(t.title)} · ${ctx.t(t.asks, { name: m.villagerName })}` }),
          el('p', { class: 'lpl-decision__question', id: titleId, text: ctx.t(`« ${m.question} »`) }),
        ]),
      ]),
    );
    const selfSymbol = this.host.symbol('self');
    const otherSymbol = this.host.symbol('other');
    const options = el('div', { class: 'lpl-decision__options', 'data-count': String(m.options.length) });
    let first: HTMLButtonElement | null = null;
    let chosen: HTMLButtonElement | null = null;
    for (const o of m.options) {
      const marks = el('span', { class: 'lpl-decision__marks' });
      if (o.mine) marks.append(token('self', selfSymbol));
      if (o.theirs) marks.append(token('other', otherSymbol));
      const people = el('span', { class: 'lpl-decision__people' }, o.villagers.map((v) => face(v, 'small')));
      const who = [o.mine ? ctx.t(t.mine) : '', o.theirs ? ctx.t(t.theirs, { partner }) : ''].filter((x) => x !== '').join(', ');
      const tile = button(
        [
          marks,
          el('span', { class: 'lpl-decision__picture' }, [icon(o.icon, 'lpl-decision__icon'), people]),
          el('span', { class: 'lpl-decision__label', text: ctx.t(o.label) }),
          el('span', { class: 'lpl-decision__change', text: ctx.t(o.change) }),
        ],
        () => {
          if (m.phase === 'taken') return;
          // Un second clic sur son choix le reprend.
          this.host.send({ type: 'decision_vote', decision: m.id, option: o.mine ? null : o.id });
        },
        {
          class: 'lpl-decision__option',
          attrs: {
            'aria-pressed': o.mine ? 'true' : 'false',
            'aria-label': who === '' ? ctx.t(`${o.label} ${o.change}`) : ctx.t(`${o.label} ${o.change} (${who})`),
            ...(o.mine ? { 'data-mine': '' } : {}),
            ...(o.theirs ? { 'data-theirs': '' } : {}),
          },
        },
      );
      if (m.phase === 'taken' && o.mine) tile.append(el('span', { class: 'lpl-stamp lpl-stamp--green lpl-decision__stamp', text: ctx.t(t.stamp) }));
      keepFocusOnGame(tile);
      first ??= tile;
      if (o.mine) chosen = tile;
      options.append(tile);
    }
    card.append(options);
    if (m.phase !== 'taken') {
      const status: Record<Exclude<DecisionPhase, 'taken'>, string> = {
        choose: ctx.t(t.enterHint, { key: '' }).trimStart(),
        waitingPartner: ctx.t(t.waitingPartner, { partner }),
        waitingMe: ctx.t(t.waitingMe, { partner }),
        disagree: ctx.t(t.disagree),
        agreed: ctx.t(t.agreed),
      };
      const later = button(ctx.t(t.later), () => {
        this.later.add(m.id);
        this.blur();
        this.host.invalidate();
      }, { class: 'lpl-button lpl-button--quiet' });
      keepFocusOnGame(later);
      const note = el('p', { class: 'lpl-decision__status', role: 'status', 'data-phase': m.phase });
      if (m.phase === 'choose') note.append(keycap(ctx.key('Enter')), ' ');
      note.append(status[m.phase]);
      card.append(el('footer', { class: 'lpl-decision__foot' }, [note, later]));
    }
    this.card = card;
    this.defaultButton = chosen ?? first;
    return card;
  }

  private blur(): void {
    const active = document.activeElement;
    if (active instanceof HTMLElement && this.root.contains(active)) active.blur();
  }

  /** Touche reçue quand le focus est dans le panneau. Vrai si consommée. */
  key(code: string): boolean {
    const buttons = this.card === null ? [] : [...this.card.querySelectorAll<HTMLButtonElement>('button')];
    if (this.card?.tagName === 'BUTTON') buttons.push(this.card as HTMLButtonElement);
    const index = buttons.findIndex((b) => b === document.activeElement);
    if (index < 0) return false;
    switch (code) {
      case 'Tab':
      case 'ArrowRight':
      case 'ArrowLeft':
      case 'KeyD':
      case 'KeyA': {
        const delta = code === 'ArrowLeft' || code === 'KeyA' ? -1 : 1;
        buttons[(index + delta + buttons.length) % buttons.length]?.focus();
        return true;
      }
      case 'Backspace': {
        const id = this.card?.dataset.kind === 'panel' ? this.card.getAttribute('aria-labelledby')?.replace(/^decision-/, '') : undefined;
        if (id !== undefined) this.later.add(id);
        this.blur();
        this.host.invalidate();
        return true;
      }
      case 'Enter':
      case 'NumpadEnter':
      case 'Space':
        buttons[index]?.click();
        return true;
      default:
        this.blur();
        return false;
    }
  }
}
