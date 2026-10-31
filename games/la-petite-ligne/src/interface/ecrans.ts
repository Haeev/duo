/**
 * Écrans plein cadre: titre, création des personnages, petit-déjeuner,
 * nuit, fin de séance et fin de la démo (maquettes `titre.html`,
 * `creation.html`, `petit-dejeuner.html`, `nuit.html`, `fin.html`).
 */
import { currentOrder } from '../donnees/commandes';
import type { CharacterId, ReadonlyWorld } from '../etat/types';
import type { Layer, UiHost } from './composant';
import { type Expression, PLAYER_HAIRS, PLAYER_OUTFITS, UI_SETTINGS, WEATHER_ICONS } from './config';
import { characterOf, nameOf } from './contexte';
import { button, chip, clear, el, icon, keycap, portrait, setAttr, setHidden, setPortrait, setText, token } from './dom';
import { cleanName, contentVars, hourLabel, lowerFirst, profileSymbol, timeParts, weekdayOf } from './format';
import { dayLabel, endActions, formModel, linesText, nextObjective, orderLines, outfitTakenByPartner } from './modele';
import { playerColors, portraitSvg } from './portrait';


function sheet(width: string, children: readonly (Node | null)[]): HTMLDivElement {
  const div = el('div', { class: 'lpl-sheet', style: `--lpl-sheet-width: ${width}` });
  for (const c of children) if (c !== null) div.append(c);
  return div;
}

function screen(kind: '' | 'night' | 'scene', labelledBy: string, content: HTMLElement): HTMLElement {
  return el('main', { class: `lpl-screen${kind === '' ? '' : ` lpl-screen--${kind}`}`, 'aria-labelledby': labelledBy }, [content]);
}

let ids = 0;
function uid(prefix: string): string {
  ids += 1;
  return `${prefix}-${ids}`;
}

/** Carte d'un joueur: jeton ou portrait, prénom, puce d'état. */
class PlayerCard {
  readonly root: HTMLDivElement;
  private readonly name: HTMLSpanElement;
  private readonly status: HTMLSpanElement;
  private readonly face: HTMLSpanElement | null;

  constructor(host: UiHost, who: 'self' | 'other', withPortrait: boolean) {
    const symbol = host.symbol(who);
    this.face = withPortrait ? portrait('', 'small', token(who, symbol, 'small')) : null;
    this.name = el('span', { class: 'lpl-player-card__name' });
    this.status = el('span');
    this.root = el('div', { class: 'lpl-player-card' }, [this.face ?? token(who, symbol, 'large'), this.name, this.status]);
  }

  set(name: string, you: string | null, statusChip: HTMLElement, svg: string | null = null): void {
    const sig = `${name}|${you ?? ''}`;
    if (this.name.dataset.sig !== sig) {
      this.name.dataset.sig = sig;
      clear(this.name);
      this.name.append(name);
      if (you !== null) this.name.append(' ', el('small', { text: you }));
    }
    const chipSig = statusChip.outerHTML;
    if (this.status.dataset.sig !== chipSig) {
      this.status.dataset.sig = chipSig;
      clear(this.status);
      this.status.append(statusChip);
    }
    if (this.face !== null && svg !== null) setPortrait(this.face, svg);
  }
}

function svgOf(world: ReadonlyWorld, id: CharacterId, expression: Expression): string {
  const c = characterOf(world, id);
  return c === null ? '' : portraitSvg(playerColors(id, c.appearance), expression, '');
}

// ---------------------------------------------------------------------------
// Écran titre

export class TitleScreen implements Layer {
  readonly root: HTMLElement;
  readonly closable = false;
  readonly letterNavigation = false;
  private readonly host: UiHost;
  private readonly start: HTMLButtonElement;
  private readonly notYet: HTMLButtonElement;
  private readonly help: HTMLParagraphElement;
  private readonly self: PlayerCard;
  private readonly other: PlayerCard;
  private readonly resume: boolean;

  constructor(host: UiHost, world: ReadonlyWorld) {
    this.host = host;
    const { ctx } = host;
    const x = ctx.texts.extra;
    const titleId = uid('titre');
    this.resume = world.phase !== 'creation';
    const time = hourLabel(world.clock.minutes, ctx.texts.game.ui.hud.time);
    const resumeVars = { weekday: weekdayOf(world.clock.day, ctx.texts.weekdays), day: world.clock.day, time };
    this.self = new PlayerCard(host, 'self', false);
    this.other = new PlayerCard(host, 'other', false);
    this.start = button(this.resume ? ctx.t(x.title.resume, resumeVars) : ctx.t(x.title.start), () => {
      host.send({ type: 'title_ready', ready: true });
    }, { class: 'lpl-button lpl-button--primary lpl-button--large', attrs: { 'data-nav-item': true } });
    this.notYet = button(ctx.t(x.common.notYet), () => {
      host.send({ type: 'title_ready', ready: false });
    }, { class: 'lpl-button lpl-button--large', attrs: { 'data-nav-item': true } });
    this.help = el('p', { style: 'text-align: center' });
    const keys = el('p', { class: 'lpl-keys', style: 'justify-content: center; color: var(--lpl-color-ink-muted)' }, [
      el('span', {}, [keycap(x.keys.escape), ` ${x.title.pause}`]),
    ]);
    this.root = screen(
      'scene',
      titleId,
      sheet('40rem', [
        el('div', { class: 'lpl-title' }, [
          el('span', { class: 'lpl-title__ticket' }, [icon('ui-train'), ctx.t(x.title.ticket)]),
          el('h1', { class: 'lpl-title__name', id: titleId, text: ctx.t(x.title.name) }),
          el('p', { class: 'lpl-sheet__lead', text: ctx.t(x.title.lead) }),
        ]),
        el('div', { class: 'lpl-players', 'aria-label': x.common.playersLabel }, [this.self.root, this.other.root]),
        el('div', { class: 'lpl-sheet__actions', style: 'justify-content: center', 'data-nav': 'row' }, [this.start, this.notYet]),
        this.help,
        keys,
      ]),
    );
    this.helpText(world);
  }

  private helpText(world: ReadonlyWorld): void {
    const { ctx } = this.host;
    const x = ctx.texts.extra;
    const time = hourLabel(world.clock.minutes, ctx.texts.game.ui.hud.time);
    const vars = { weekday: weekdayOf(world.clock.day, ctx.texts.weekdays), day: world.clock.day, time };
    setText(this.help, ctx.t(this.resume ? x.title.resumeHelp : x.title.helpSynced, vars));
  }

  update(world: ReadonlyWorld): void {
    const { ctx } = this.host;
    const x = ctx.texts.extra;
    const meReady = characterOf(world, ctx.me)?.titleReady === true;
    const otherReady = characterOf(world, ctx.partner)?.titleReady === true;
    const notYet = chip(ctx.t(x.common.notYet), '', 'ui-hourglass');
    const ready = chip(ctx.t(x.common.ready), 'ready', 'ui-check');
    this.self.set(nameOf(world, ctx.me), x.common.you, meReady ? ready : notYet);
    this.other.set(nameOf(world, ctx.partner), null, otherReady ? ready.cloneNode(true) as HTMLElement : notYet.cloneNode(true) as HTMLElement);
    setHidden(this.start, meReady);
    setHidden(this.notYet, !meReady);
    if (meReady && !otherReady) {
      clear(this.help);
      this.help.append(chip(ctx.t(x.common.waitingFor, { partner: nameOf(world, ctx.partner) }), 'waiting', 'ui-hourglass'));
    } else {
      this.helpText(world);
    }
  }

  defaultFocus(): HTMLElement | null {
    return this.start.hidden ? this.notYet : this.start;
  }
}

// ---------------------------------------------------------------------------
// Création des personnages

type CreationMode = 'edit' | 'done' | 'ready';

export class CreationScreen implements Layer {
  readonly root: HTMLElement;
  readonly closable = false;
  readonly letterNavigation = false;
  private readonly host: UiHost;
  private mode: CreationMode = 'edit';
  private hair = 0;
  private outfit = 0;
  private readonly input: HTMLInputElement;
  private readonly fields: HTMLElement[] = [];
  private readonly preview: HTMLSpanElement;
  private readonly previewName: HTMLParagraphElement;
  private readonly hairPortraits: HTMLSpanElement[] = [];
  private readonly hairInputs: HTMLInputElement[] = [];
  private readonly outfitInputs: HTMLInputElement[] = [];
  /** Marque « Déjà portée par Sacha » sur la tenue que l'autre a choisie (déconseillée, pas interdite). */
  private readonly outfitTaken: HTMLSpanElement[] = [];
  private readonly outfitTakenText: HTMLSpanElement[] = [];
  private readonly letter: HTMLDivElement;
  private readonly submit: HTMLButtonElement;
  private readonly edit: HTMLButtonElement;
  private readonly waiting: HTMLSpanElement;
  private readonly arriving: HTMLSpanElement;
  private readonly otherCard: HTMLDivElement;
  private readonly otherPortrait: HTMLSpanElement;
  private readonly otherName: HTMLSpanElement;
  private readonly otherStatus: HTMLSpanElement;
  private scarf = '#5CE1E6';

  constructor(host: UiHost, world: ReadonlyWorld) {
    this.host = host;
    const { ctx } = host;
    const x = ctx.texts.extra.creation;
    const g = ctx.texts.game.ui.creation;
    const me = characterOf(world, ctx.me);
    this.hair = me?.appearance.hair ?? 0;
    this.outfit = me?.appearance.outfit ?? 0;
    this.scarf = me?.appearance.scarf ?? this.scarf;
    if (me?.created === true) this.mode = 'done';
    const titleId = uid('creation');
    const nameId = uid('prenom');
    const helpId = uid('aide');
    const errorId = uid('erreur');

    this.input = el('input', {
      class: 'lpl-field__input',
      id: nameId,
      type: 'text',
      maxlength: UI_SETTINGS.nameMaxLength,
      autocomplete: 'off',
      spellcheck: 'false',
      'aria-describedby': `${helpId} ${errorId}`,
    });
    this.input.value = me?.name ?? '';
    this.input.addEventListener('input', () => {
      if (cleanName(this.input.value) !== '') this.input.removeAttribute('aria-invalid');
      this.refreshPreview();
    });
    const field = el('div', { class: 'lpl-field' }, [
      el('label', { class: 'lpl-field__label', for: nameId, text: g.name }),
      this.input,
      el('span', { class: 'lpl-field__help', id: helpId, text: ctx.t(x.nameHelp, { max: UI_SETTINGS.nameMaxLength }) }),
      el('span', { class: 'lpl-field__error', id: errorId, role: 'alert' }, [icon('ui-warning'), ctx.t(x.nameError)]),
    ]);

    const hairGroup = el('fieldset', { class: 'lpl-choice-group' }, [el('legend', { text: g.hair })]);
    const hairOptions = el('div', { class: 'lpl-choice-group__options', 'data-nav': 'row' });
    const radioName = uid('coiffure');
    PLAYER_HAIRS.forEach((_, i) => {
      const input = el('input', { type: 'radio', name: radioName, value: String(i), 'data-nav-item': true });
      input.checked = i === this.hair;
      input.addEventListener('change', () => {
        this.hair = i;
        this.refreshPreview();
      });
      const face = portrait('', 'small');
      this.hairPortraits.push(face);
      this.hairInputs.push(input);
      hairOptions.append(el('label', { class: 'lpl-option' }, [input, face, x.hairs[i] ?? '']));
    });
    hairGroup.append(hairOptions);

    const outfitGroup = el('fieldset', { class: 'lpl-choice-group' }, [el('legend', { text: g.outfit })]);
    const outfitOptions = el('div', { class: 'lpl-choice-group__options', 'data-nav': 'row' });
    const outfitName = uid('tenue');
    PLAYER_OUTFITS.forEach((o, i) => {
      const input = el('input', { type: 'radio', name: outfitName, value: String(i), 'data-nav-item': true });
      input.checked = i === this.outfit;
      input.addEventListener('change', () => {
        this.outfit = i;
        this.refreshPreview();
      });
      this.outfitInputs.push(input);
      const takenText = el('span');
      const taken = el('span', { class: 'lpl-option__taken', hidden: true }, [token('other', host.symbol('other'), 'small'), takenText]);
      this.outfitTaken.push(taken);
      this.outfitTakenText.push(takenText);
      outfitOptions.append(
        el('label', { class: 'lpl-option' }, [input, el('span', { class: 'lpl-option__swatch', style: `--lpl-swatch: ${o.top}` }), x.outfits[i] ?? '', taken]),
      );
    });
    outfitGroup.append(outfitOptions);

    const symbol = host.symbol('self');
    const scarfNote = el('p', { class: 'lpl-field__help lpl-creation__scarf' }, [
      token('self', symbol),
      ctx.t(x.scarf, { profile: x.profiles[profileSymbol(this.scarf)] ?? '' }),
    ]);
    this.fields.push(field, hairGroup, outfitGroup, scarfNote);

    // La lettre de la coopérative, lue en attendant l'autre.
    const letterDef = Object.values(ctx.content.letters)[0];
    const letterText = letterDef === undefined ? '' : ctx.t(letterDef.text, contentVars(ctx.content, null, ctx.texts.orderFormat));
    this.letter = el('div', { class: 'lpl-letter', style: 'font-size: var(--lpl-text-md)', hidden: true }, [
      el('span', { class: 'lpl-stamp', text: ctx.t(x.letterStamp) }),
      el('p', { class: 'lpl-letter__from', text: ctx.t(x.letterWaiting) }),
      el('p', { text: ctx.t(`« ${letterText} »`) }),
    ]);

    this.edit = button(ctx.t(x.edit), () => {
      this.mode = 'edit';
      this.render();
      this.input.focus();
    });
    this.waiting = chip('', 'waiting', 'ui-hourglass');
    this.arriving = chip(ctx.t(x.trainArriving), 'ready', 'ui-train');
    this.arriving.setAttribute('role', 'status');

    const form = el('form', { class: 'lpl-sheet', style: '--lpl-sheet-width: 100%', novalidate: true }, [
      el('div', {}, [el('p', { class: 'lpl-overline', text: ctx.t(x.overline) }), el('h1', { class: 'lpl-sheet__title', id: titleId, text: ctx.t(g.title) })]),
      ...this.fields,
      this.letter,
      el('div', { class: 'lpl-sheet__actions' }, [this.edit, this.waiting, this.arriving]),
    ]);
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      this.confirm();
    });

    this.preview = portrait('', '', token('self', symbol, 'large'));
    this.previewName = el('p', { class: 'lpl-display', style: 'font-size: var(--lpl-text-xl)' });
    this.submit = button(ctx.t(g.ready), () => {
      this.confirm();
    }, { class: 'lpl-button lpl-button--primary lpl-button--large' });

    this.otherPortrait = portrait('', '', token('other', host.symbol('other')));
    this.otherName = el('span', { class: 'lpl-player-card__name' });
    this.otherStatus = el('span');
    this.otherCard = el('div', { class: 'lpl-player-card lpl-creation__other' }, [this.otherPortrait, this.otherName, this.otherStatus]);

    this.root = screen(
      '',
      titleId,
      el('div', { class: 'lpl-creation' }, [
        form,
        el('div', { class: 'lpl-creation__preview' }, [
          this.preview,
          this.previewName,
          this.submit,
          this.otherCard,
          el('p', { class: 'lpl-field__help', style: 'text-align: center', text: ctx.t(x.together) }),
        ]),
      ]),
    );
    this.refreshPreview();
    this.render();
  }

  private appearance(): { hair: number; outfit: number; scarf: string } {
    return { hair: this.hair, outfit: this.outfit, scarf: this.scarf };
  }

  private refreshPreview(): void {
    const { ctx } = this.host;
    const a = this.appearance();
    setPortrait(this.preview, portraitSvg(playerColors(ctx.me, a), 'great', ''));
    this.hairPortraits.forEach((face, i) => {
      setPortrait(face, portraitSvg(playerColors(ctx.me, { ...a, hair: i }), 'good', ''));
    });
    const name = cleanName(this.input.value);
    setText(this.previewName, name === '' ? ctx.texts.extra.creation.noName : name);
    this.previewName.style.color = name === '' ? 'var(--lpl-color-ink-muted)' : '';
  }

  private confirm(): void {
    const name = cleanName(this.input.value);
    if (name === '') {
      this.input.setAttribute('aria-invalid', 'true');
      this.input.focus();
      this.refreshPreview();
      return;
    }
    this.host.send({ type: 'create_character', name, hair: this.hair, outfit: this.outfit });
    this.mode = 'done';
    this.render();
    this.edit.focus();
  }

  /** Les deux personnages sont créés: « Le train entre en gare… ». */
  setReady(): void {
    if (this.mode === 'ready') return;
    this.mode = 'ready';
    this.render();
  }

  private render(): void {
    const editing = this.mode === 'edit';
    for (const f of this.fields) setHidden(f, !editing);
    setHidden(this.submit, !editing);
    setHidden(this.letter, editing);
    setHidden(this.edit, this.mode !== 'done');
    setHidden(this.waiting, this.mode !== 'done');
    setHidden(this.arriving, this.mode !== 'ready');
  }

  update(world: ReadonlyWorld): void {
    const { ctx } = this.host;
    const x = ctx.texts.extra;
    const me = characterOf(world, ctx.me);
    const other = characterOf(world, ctx.partner);
    if (me !== null && me.created && this.mode === 'edit' && document.activeElement !== this.input) {
      // Créé ailleurs (reprise): on montre l'attente.
      this.mode = 'done';
      this.render();
    }
    if (me !== null && me.appearance.scarf !== this.scarf) {
      this.scarf = me.appearance.scarf;
      this.refreshPreview();
    }
    const partnerName = nameOf(world, ctx.partner);
    setText(this.waiting.lastChild ?? this.waiting, ctx.t(x.common.waitingFor, { partner: partnerName }));
    // Deux tenues pareilles: seul le foulard distinguerait les personnages. On le dit, sans l'interdire.
    const takenOutfit = outfitTakenByPartner(world, ctx);
    this.outfitTaken.forEach((mark, i) => {
      setHidden(mark, i !== takenOutfit);
      setText(this.outfitTakenText[i] ?? mark, ctx.t(x.creation.outfitTaken, { partner: partnerName }));
    });
    if (other !== null) {
      setPortrait(this.otherPortrait, portraitSvg(playerColors(other.id, other.appearance), 'good', ''));
      setText(this.otherName, other.name);
      setAttr(this.otherCard, 'aria-label', other.name);
      const sig = other.created ? 'ready' : 'choosing';
      if (this.otherStatus.dataset.sig !== sig) {
        this.otherStatus.dataset.sig = sig;
        clear(this.otherStatus);
        this.otherStatus.append(
          other.created
            ? chip(ctx.t(x.common.ready), 'ready', 'ui-check')
            : chip(ctx.t(x.creation.partnerChoosing), '', 'ui-hourglass'),
        );
      }
    }
  }

  defaultFocus(): HTMLElement | null {
    return this.mode === 'edit' ? this.input : this.mode === 'done' ? this.edit : null;
  }

  /** Entrée dans le formulaire (prénom, coiffure, tenue): valider. */
  key(code: string): boolean {
    const active = document.activeElement;
    if ((code === 'Enter' || code === 'NumpadEnter') && active instanceof HTMLInputElement && this.root.contains(active)) {
      this.confirm();
      return true;
    }
    return false;
  }
}

// ---------------------------------------------------------------------------
// Petit-déjeuner

export class BreakfastScreen implements Layer {
  readonly root: HTMLElement;
  readonly closable = false;
  readonly letterNavigation = false;
  private readonly host: UiHost;
  private readonly face: HTMLSpanElement;
  private readonly overline: HTMLParagraphElement;
  private readonly title: HTMLHeadingElement;
  private readonly lead: HTMLParagraphElement;
  private readonly list: HTMLUListElement;
  private readonly start: HTMLButtonElement;
  private readonly partner: HTMLSpanElement;
  private readonly help: HTMLParagraphElement;
  private sig = '';

  constructor(host: UiHost) {
    this.host = host;
    const { ctx } = host;
    const titleId = uid('matin');
    this.face = portrait('', 'large', token('self', host.symbol('self')));
    this.overline = el('p', { class: 'lpl-overline' });
    this.title = el('h1', { class: 'lpl-sheet__title', id: titleId });
    this.lead = el('p', { class: 'lpl-sheet__lead' });
    this.list = el('ul', { class: 'lpl-quests' });
    this.start = button(ctx.t(ctx.texts.game.ui.breakfast.start), () => {
      host.send({ type: 'start_day' });
    }, { class: 'lpl-button lpl-button--primary lpl-button--large' });
    this.partner = el('span', { class: 'lpl-player-name' });
    this.help = el('p', { class: 'lpl-field__help' });
    this.root = screen(
      'scene',
      titleId,
      sheet('42rem', [
        el('div', { class: 'lpl-breakfast__head' }, [this.face, el('div', {}, [this.overline, this.title, this.lead])]),
        this.list,
        el('div', { class: 'lpl-sheet__actions' }, [this.start, this.partner]),
        this.help,
      ]),
    );
  }

  update(world: ReadonlyWorld): void {
    const { ctx } = this.host;
    const me = characterOf(world, ctx.me);
    const other = characterOf(world, ctx.partner);
    if (me === null) return;
    const b = ctx.texts.extra.breakfast;
    const g = ctx.texts.game.ui.breakfast;
    const form = formModel(ctx, me);
    const weather = ctx.texts.weather[world.weather] ?? world.weather;
    const time = ctx.t(ctx.texts.game.ui.hud.time, timeParts(world.clock.minutes));
    const envie = me.envie === null ? null : ctx.content.envies.find((e) => e.id === me.envie?.id);
    const shared = me.sharedEnvie === null ? null : ctx.content.envies.find((e) => e.id === me.sharedEnvie?.id);
    const todays = world.letters.filter((l) => l.day === world.clock.day);
    const eggs = world.groundItems.filter((i) => i.item === 'egg').reduce((s, i) => s + i.count, 0);
    const partnerName = nameOf(world, ctx.partner);
    const sig = JSON.stringify([me.form, me.appearance, world.clock.day, world.weather, envie?.id, shared?.id, todays.length, eggs, other?.breakfastDone, partnerName]);
    if (sig === this.sig) return;
    this.sig = sig;

    setPortrait(this.face, portraitSvg(playerColors(me.id, me.appearance), form.expression, form.name));
    clear(this.overline);
    const at = b.overline.indexOf('{weather}');
    const vars = { day: dayLabel(ctx, world.clock.day), time };
    const before = at < 0 ? b.overline : b.overline.slice(0, at);
    const after = at < 0 ? '' : b.overline.slice(at + '{weather}'.length);
    this.overline.append(ctx.t(before, vars), icon(WEATHER_ICONS[world.weather] ?? 'weather-sun'), ` ${weather}`, ctx.t(after, vars));
    setText(this.title, form.name);
    setText(this.lead, ctx.t(`« ${form.text} »`));

    clear(this.list);
    if (envie !== null && envie !== undefined) {
      this.list.append(
        questItem(icon('ui-heart'), ctx.t(`${g.envie} : ${lowerFirst(envie.text)}`), chip(ctx.t(b.secret)), ctx.t(b.secretHelp, { partner: partnerName })),
      );
    } else {
      this.list.append(questItem(icon('ui-heart'), ctx.t(b.noEnvie), null, ''));
    }
    if (shared !== null && shared !== undefined) {
      const t = token('other', this.host.symbol('other'), 'small');
      t.style.gridRow = 'span 2';
      this.list.append(questItem(t, ctx.t(`${g.sharedEnvie} : ${lowerFirst(shared.text)}`), chip(ctx.t(b.shared)), ctx.t(b.sharedHelp)));
    }
    const mail = todays.length === 0 ? b.mailNone : todays.map((l) => l.title).join(', ');
    const eggsText = eggs <= 0 ? '' : eggs === 1 ? ctx.t(b.egg) : ctx.t(b.eggs, { count: eggs });
    this.list.append(questItem(icon('ui-letter'), ctx.t(`${b.mail} : ${mail}`), null, eggsText));

    clear(this.partner);
    this.partner.append(
      token('other', this.host.symbol('other'), 'small'),
      ctx.t(other?.breakfastDone === true ? b.partnerStarted : b.partnerEating, { partner: partnerName }),
    );
    clear(this.help);
    if (other?.breakfastDone !== true) {
      this.help.append(icon('ui-pause'), ` ${ctx.t(b.clockHelp, { time: hourLabel(ctx.content.settings.clock.dayStart, ctx.texts.game.ui.hud.time) })}`);
    }
    setHidden(this.help, other?.breakfastDone === true);
  }

  defaultFocus(): HTMLElement | null {
    return this.start;
  }
}

function questItem(lead: Element, title: string, side: HTMLElement | null, text: string): HTMLLIElement {
  return el('li', { class: 'lpl-quest' }, [
    lead,
    el('span', { class: 'lpl-quest__title', text: title }),
    side ?? el('span'),
    text === '' ? null : el('span', { class: 'lpl-quest__text', text }),
  ]);
}

// ---------------------------------------------------------------------------
// Nuit

export class NightScreen implements Layer {
  readonly root: HTMLElement;
  readonly closable = false;
  readonly letterNavigation = false;
  private readonly host: UiHost;
  private readonly overline: HTMLParagraphElement;
  private readonly list: HTMLUListElement;
  private readonly self: PlayerCard;
  private readonly other: PlayerCard;
  private readonly message: HTMLParagraphElement;
  private readonly cont: HTMLButtonElement;
  private readonly finish: HTMLButtonElement;
  private sig = '';

  constructor(host: UiHost) {
    this.host = host;
    const { ctx } = host;
    const n = ctx.texts.game.nightScreen;
    const titleId = uid('nuit');
    this.overline = el('p', { class: 'lpl-overline' });
    this.list = el('ul', { class: 'lpl-quests' });
    this.self = new PlayerCard(host, 'self', false);
    this.other = new PlayerCard(host, 'other', false);
    this.message = el('p', { role: 'status' });
    this.cont = button(ctx.t(n.continue), () => {
      host.send({ type: 'night_choice', choice: 'continue' });
    }, { class: 'lpl-button lpl-button--primary lpl-button--large', attrs: { 'aria-pressed': 'false', 'data-nav-item': true } });
    this.finish = button(ctx.t(n.finish), () => {
      host.send({ type: 'night_choice', choice: 'finish' });
    }, { class: 'lpl-button lpl-button--large', attrs: { 'aria-pressed': 'false', 'data-nav-item': true } });
    this.root = screen(
      'night',
      titleId,
      sheet('44rem', [
        el('div', {}, [this.overline, el('h1', { class: 'lpl-sheet__title', id: titleId, text: ctx.t(n.title) })]),
        el('p', { class: 'lpl-sheet__lead', text: ctx.t(n.text) }),
        this.list,
        el('div', { class: 'lpl-players', 'aria-label': ctx.texts.extra.night.choicesLabel }, [this.self.root, this.other.root]),
        this.message,
        el('div', { class: 'lpl-sheet__actions', 'data-nav': 'row' }, [this.cont, this.finish]),
      ]),
    );
  }

  update(world: ReadonlyWorld): void {
    const { ctx } = this.host;
    const me = characterOf(world, ctx.me);
    const other = characterOf(world, ctx.partner);
    if (me === null || other === null) return;
    const sig = JSON.stringify([world.clock.day, me.nightChoice, other.nightChoice, other.name, world.crate, world.quests.length]);
    if (sig === this.sig) return;
    this.sig = sig;
    const x = ctx.texts.extra.night;
    const n = ctx.texts.game.nightScreen;
    clear(this.overline);
    this.overline.append(icon('ui-moon'), ` ${ctx.t(x.overline, { weekday: weekdayOf(world.clock.day, ctx.texts.weekdays), day: world.clock.day })}`);

    clear(this.list);
    const daysLeft = currentOrder(ctx.content.settings, world).day - world.clock.day;
    if (world.orderResult === null && daysLeft >= 1) {
      const lines = orderLines(world, ctx);
      const done = lines.filter((l) => l.done).length;
      const time = hourLabel(ctx.content.settings.train.departure, ctx.texts.game.ui.hud.time);
      this.list.append(
        questItem(
          icon('ui-train'),
          ctx.t(x.orderLine, { lines: linesText(ctx, done, lines.length) }),
          null,
          daysLeft === 1 ? ctx.t(x.orderTomorrow, { time }) : ctx.t(x.orderDays, { time, days: daysLeft }),
        ),
      );
    }
    const goal = nextObjective(world, ctx);
    if (goal !== null) {
      this.list.append(
        questItem(
          icon('ui-flag'),
          ctx.t(x.tomorrowGoal, { weekday: weekdayOf(world.clock.day + 1, ctx.texts.weekdays), day: world.clock.day + 1, title: goal.title }),
          null,
          goal.text,
        ),
      );
    }
    setHidden(this.list, this.list.childElementCount === 0);

    const chipOf = (choice: 'continue' | 'finish' | null): HTMLElement =>
      choice === null
        ? chip(ctx.t(ctx.texts.extra.common.notYet), '', 'ui-hourglass')
        : chip(ctx.t(choice === 'continue' ? x.chipContinue : x.chipFinish), 'ready', 'ui-check');
    this.self.set(me.name, ctx.texts.extra.common.you, chipOf(me.nightChoice));
    this.other.set(other.name, null, chipOf(other.nightChoice));

    setAttr(this.cont, 'aria-pressed', me.nightChoice === 'continue' ? 'true' : 'false');
    setAttr(this.finish, 'aria-pressed', me.nightChoice === 'finish' ? 'true' : 'false');

    clear(this.message);
    const partner = other.name;
    if (other.nightChoice === 'finish') {
      this.message.append(el('strong', { text: ctx.t(n.partnerFinish, { partner }) }), ` ${ctx.t(x.disagree)}`);
    } else if (other.nightChoice === 'continue') {
      this.message.append(el('strong', { text: ctx.t(n.partnerContinue, { partner }) }), ` ${ctx.t(x.partnerContinueHelp)}`);
    } else if (me.nightChoice !== null) {
      this.message.append(chip(ctx.t(x.waiting, { partner }), 'waiting', 'ui-hourglass'));
    } else {
      this.message.append(ctx.t(x.help, { partner }));
    }
  }

  defaultFocus(): HTMLElement | null {
    return this.finish.getAttribute('aria-pressed') === 'true' ? this.finish : this.cont;
  }
}

/** Les deux ont choisi « Finir la séance »: la séance se termine. */
export class SessionEndScreen implements Layer {
  readonly root: HTMLElement;
  readonly closable = false;
  readonly letterNavigation = false;
  private readonly host: UiHost;
  private readonly overline: HTMLParagraphElement;
  private readonly lead: HTMLParagraphElement;
  private readonly self: PlayerCard;
  private readonly other: PlayerCard;

  constructor(host: UiHost) {
    this.host = host;
    const { ctx } = host;
    const x = ctx.texts.extra.night;
    const titleId = uid('fin-seance');
    this.overline = el('p', { class: 'lpl-overline' });
    this.lead = el('p', { class: 'lpl-sheet__lead' });
    this.self = new PlayerCard(host, 'self', false);
    this.other = new PlayerCard(host, 'other', false);
    this.root = screen(
      'night',
      titleId,
      sheet('44rem', [
        el('div', {}, [this.overline, el('h1', { class: 'lpl-sheet__title', id: titleId, text: ctx.t(x.sessionOver) })]),
        this.lead,
        el('div', { class: 'lpl-players', 'aria-label': x.choicesLabel }, [this.self.root, this.other.root]),
        el('p', { role: 'status' }, [icon('ui-check'), ` ${ctx.t(x.saved)}`]),
      ]),
    );
  }

  update(world: ReadonlyWorld): void {
    const { ctx } = this.host;
    const x = ctx.texts.extra.night;
    const time = hourLabel(ctx.content.settings.clock.dayStart, ctx.texts.game.ui.hud.time);
    // Le matin est déjà venu dans la simulation: la séance finit sur la veille.
    const ended = Math.max(1, world.clock.day - 1);
    if (this.overline.dataset.day !== String(ended)) {
      this.overline.dataset.day = String(ended);
      clear(this.overline);
      this.overline.append(icon('ui-moon'), ` ${ctx.t(x.overline, { weekday: weekdayOf(ended, ctx.texts.weekdays), day: ended })}`);
    }
    setText(this.lead, ctx.t(x.over, { weekday: weekdayOf(world.clock.day, ctx.texts.weekdays), day: world.clock.day, time }));
    const done = (): HTMLElement => chip(ctx.t(x.chipFinish), 'ready', 'ui-check');
    this.self.set(nameOf(world, ctx.me), ctx.texts.extra.common.you, done());
    this.other.set(nameOf(world, ctx.partner), null, done());
  }

  defaultFocus(): HTMLElement | null {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Fin de la démo

export class EndScreen implements Layer {
  readonly root: HTMLElement;
  readonly closable = false;
  readonly letterNavigation = false;
  private readonly host: UiHost;
  private readonly ticket: HTMLSpanElement;
  private readonly days: HTMLSpanElement;
  private readonly lines: HTMLSpanElement;
  private readonly furniture: HTMLSpanElement;
  private readonly counters: HTMLDivElement;
  private readonly self: PlayerCard;
  private readonly other: PlayerCard;
  private readonly cont: HTMLButtonElement;
  private readonly notYet: HTMLButtonElement;
  private readonly waiting: HTMLSpanElement;
  private readonly bothReady: HTMLSpanElement;

  constructor(host: UiHost) {
    this.host = host;
    const { ctx } = host;
    const e = ctx.texts.game.endScreen;
    const x = ctx.texts.extra.end;
    const titleId = uid('fin');
    this.ticket = el('span', { class: 'lpl-title__ticket' });
    this.days = el('span', { class: 'lpl-counter__value' });
    this.lines = el('span', { class: 'lpl-counter__value' });
    this.furniture = el('span', { class: 'lpl-counter__value' });
    const counter = (value: HTMLElement, label: string): HTMLDivElement =>
      el('div', { class: 'lpl-counter' }, [value, el('span', { class: 'lpl-counter__label', text: ctx.t(label) })]);
    this.counters = el('div', { class: 'lpl-counters' }, [counter(this.days, x.days), counter(this.lines, x.lines), counter(this.furniture, x.furniture)]);
    this.self = new PlayerCard(host, 'self', true);
    this.other = new PlayerCard(host, 'other', true);
    this.cont = button(ctx.t(x.continue), () => {
      host.send({ type: 'end_ready', ready: true });
    }, { class: 'lpl-button lpl-button--primary lpl-button--large' });
    this.notYet = button(ctx.t(ctx.texts.extra.common.notYet), () => {
      host.send({ type: 'end_ready', ready: false });
    });
    this.waiting = chip('', 'waiting', 'ui-hourglass');
    this.bothReady = chip(ctx.t(x.bothReady), 'ready', 'ui-check');
    this.bothReady.setAttribute('role', 'status');
    this.bothReady.toggleAttribute('hidden', true);
    this.root = screen(
      '',
      titleId,
      sheet('46rem', [
        el('div', { class: 'lpl-title' }, [
          this.ticket,
          el('h1', { class: 'lpl-title__name', id: titleId, style: 'font-size: var(--lpl-text-3xl)', text: ctx.t(e.title) }),
          el('p', { class: 'lpl-sheet__lead', text: ctx.t(e.subtitle) }),
        ]),
        this.counters,
        el('div', { class: 'lpl-players', 'aria-label': ctx.texts.extra.common.playersLabel }, [this.self.root, this.other.root]),
        el('p', { class: 'lpl-sheet__lead', style: 'text-align: center' }, [el('strong', { text: ctx.t(e.text) })]),
        el('div', { class: 'lpl-sheet__actions', style: 'justify-content: center', 'data-nav': 'row' }, [this.cont, this.waiting, this.notYet, this.bothReady]),
        el('p', { style: 'text-align: center; color: var(--lpl-color-ink-muted)', text: ctx.t(x.after) }),
      ]),
    );
  }

  update(world: ReadonlyWorld): void {
    const { ctx } = this.host;
    const x = ctx.texts.extra.end;
    const e = ctx.texts.game.endScreen;
    const ending = world.ending;
    const days = ending?.days ?? world.clock.day;
    const linesDone = ending?.linesDone ?? world.orderHistory.reduce((n, o) => n + o.linesDone, 0);
    const linesTotal = ending?.linesTotal ?? ctx.content.settings.order.trains.reduce((n, o) => n + o.lines.length, 0);
    const furniture = ending?.furniturePlaced ?? world.furniture.filter((f) => f.placedBy !== null).length;
    const time = hourLabel(ctx.content.settings.clock.lastDay.end, ctx.texts.game.ui.hud.time);
    clear(this.ticket);
    this.ticket.append(icon('ui-train'), ctx.t(x.ticket, { day: days, time }));
    setText(this.days, String(days));
    clear(this.lines);
    this.lines.append(String(linesDone), ' ', el('small', { style: 'font-size: var(--lpl-text-lg)', text: ctx.t(x.linesOf, { total: linesTotal }) }));
    setText(this.furniture, String(furniture));
    // Le récapitulatif de `textes.json` sert de nom accessible aux chiffres.
    setAttr(this.counters, 'aria-label', [
      ctx.t(e.stats.days, { days }),
      ctx.t(e.stats.order, { linesDone, linesTotal }),
      ctx.t(e.stats.furniture, { furniture }),
    ].join('. '));

    const meReady = characterOf(world, ctx.me)?.endReady === true;
    const otherReady = characterOf(world, ctx.partner)?.endReady === true;
    const chipOf = (ready: boolean): HTMLElement =>
      ready ? chip(ctx.t(x.chipContinue), 'ready', 'ui-check') : chip(ctx.t(ctx.texts.extra.common.notYet), '', 'ui-hourglass');
    this.self.set(nameOf(world, ctx.me), ctx.texts.extra.common.you, chipOf(meReady), svgOf(world, ctx.me, 'radiant'));
    this.other.set(nameOf(world, ctx.partner), null, chipOf(otherReady), svgOf(world, ctx.partner, 'great'));
    // Quand les deux ont choisi, plus de ligne d'attente: l'état final, comme sur les cartes.
    const actions = endActions(meReady, otherReady);
    setHidden(this.cont, !actions.cont);
    setHidden(this.waiting, !actions.waiting);
    setHidden(this.notYet, !actions.waiting);
    setHidden(this.bothReady, !actions.done);
    setText(this.waiting.lastChild ?? this.waiting, ctx.t(ctx.texts.extra.common.waitingFor, { partner: nameOf(world, ctx.partner) }));
  }

  defaultFocus(): HTMLElement | null {
    if (!this.cont.hidden) return this.cont;
    return this.notYet.hidden ? null : this.notYet;
  }
}
