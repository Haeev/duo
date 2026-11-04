/**
 * HUD: horloge, bourse, notifications, l'autre joueur, prochain objectif,
 * soi (portrait, forme, endurance), astuce, barre d'outils de 10 cases,
 * barre d'aménagement, commandes de la caméra et du carnet à la souris.
 * Le DOM n'est touché que si une valeur affichée change.
 */
import { CURRENCY, groupDigits } from '../donnees/monnaie';
import { animalCardModel } from './modele-elevage';
import { isHome } from '../etat/interieurs';
import type { GameNotification, ReadonlyWorld } from '../etat/types';
import type { UiHost } from './composant';
import { UI_SETTINGS } from './config';
import { characterOf } from './contexte';
import { button, chip, clear, el, icon, keepFocusOnGame, keycap, keysLine, portrait, setAttr, setHidden, setIcon, setPortrait, setStyleVar, setText, svgEl, token } from './dom';
import { clockTime, contentVars, fill, itemTitle, keyTokens } from './format';
import {
  clockModel,
  absenceMinutes,
  formModel,
  type HudState,
  itemIcon,
  nextObjective,
  partnerModel,
  placementReason,
  purseModel,
  splitAmount,
  toolbarModel,
  type SlotModel,
} from './modele';
import { type InviteModel, type NeedIconModel, audibleNotifications, inviteModel, napModel, needIcons } from './modele-maison';
import { needsMuted } from './preferences';
import { SteadyWatch, watchModel } from './modele-moments';
import { aimPromptModel, progressModel } from './modele-progression';
import { henWrongAside } from './modele-secrets';
import { dedupeToasts, toastKey, toastText, toastVisual, visibleToasts } from './notifications';
import { type RefusalTexts, notificationSort, refusalTexts } from './refus';
import { playerColors, portraitSvg } from './portrait';
import { typographier } from './typographie';
import { isWatching } from '../etat/peche';
import type { PlotPreview } from '../etat/vue';
import { plotCounter, plotCursor } from './modele-parcelles';
import { pastille } from './vitrine';

/** Le cordeau (0.13): l'objet dont la case porte la pastille des parcelles libres. */
const GARDEN_LINE_ITEM = 'garden_line';
import { habitToast } from './modele-voisins';
import { habitToastItem } from './voisins';

/** Une icône de besoin du HUD (à côté du portrait, ou en petit sur la carte de l'autre). */
interface NeedView {
  box: HTMLSpanElement;
  icon: SVGSVGElement;
}

/** Les trois icônes d'une rangée de besoins (Ventre, Repos, Cœur). */
function needViews(): NeedView[] {
  return ['belly', 'rest', 'heart'].map((need) => {
    const svg = icon(`need-${need}-ok`);
    return { box: el('span', { class: 'lpl-need', role: 'img', 'data-need': need }, [svg]), icon: svg };
  });
}

interface SlotView {
  button: HTMLButtonElement;
  key: HTMLSpanElement;
  icon: SVGSVGElement;
  count: HTMLSpanElement;
  /** 0.13: pastille des parcelles libres sur la case du cordeau. */
  badge: HTMLSpanElement;
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
  private readonly clockSeason: HTMLSpanElement;
  private readonly clockTime: HTMLSpanElement;
  private readonly clockStatus: HTMLSpanElement;
  private readonly clockStatusIcon: SVGSVGElement;
  private readonly clockStatusText: HTMLSpanElement;
  private readonly clockTrain: HTMLSpanElement;
  private readonly clockTrainText: HTMLSpanElement;
  /** Anneau autour de la météo de l'horloge: l'observation à deux d'un moment rare. */
  private readonly watchRing: SVGSVGElement;
  private readonly watchRingArc: SVGCircleElement;
  /** Ligne d'observation sous l'horloge (pose demandée, l'autre qui manque, « Sans bouger... »). */
  private readonly watch: HTMLDivElement;
  private readonly watchPill: HTMLParagraphElement;
  private readonly watchLine: HTMLSpanElement;
  private readonly watchDetail: HTMLSpanElement;
  private readonly steadyWatch = new SteadyWatch();
  private watchSig = '';

  private readonly purseAmount: HTMLSpanElement;
  private readonly purseUnit: HTMLSpanElement;
  private readonly purseNote: HTMLSpanElement;
  private readonly purseDelta: HTMLSpanElement;
  private lastPurse: number | null = null;
  private deltaUntil = 0;

  private readonly toasts: HTMLUListElement;
  private readonly refusal: RefusalTexts;
  /** Notifications à l'écran, par texte (`toastKey`): une répétition rafraîchit le délai sans empiler. */
  private readonly toastItems = new Map<string, HTMLLIElement>();
  private readonly seenAt = new Map<number, number>();
  private firstSight = true;
  private toastFirstSight = true;

  private readonly partner: HTMLDivElement;
  private readonly partnerPortrait: HTMLSpanElement;
  private readonly partnerName: HTMLSpanElement;
  private readonly partnerIcon: SVGSVGElement;
  private readonly partnerActivity: HTMLSpanElement;

  private readonly objective: HTMLElement;
  private readonly objectiveTitle: HTMLHeadingElement;
  private readonly objectiveText: HTMLParagraphElement;
  private readonly objectiveLines: HTMLUListElement;
  private objectiveSig = '';

  private readonly self: HTMLDivElement;
  private readonly selfPortrait: HTMLSpanElement;
  /** Pastille « Au guet » (pêche 0.12, section 7.2): chez le seul guetteur. */
  private readonly watchBadge: HTMLSpanElement;
  private readonly selfName: HTMLSpanElement;
  private readonly selfMood: HTMLSpanElement;
  /** Besoins doux (tour 10): trois icônes à trois états, sans chiffre; l'état bas en un mot. */
  private readonly selfNeeds: HTMLSpanElement;
  private readonly selfNeedViews: NeedView[];
  private readonly selfNeedNote: HTMLSpanElement;
  private readonly partnerNeeds: HTMLSpanElement;
  private readonly partnerNeedViews: NeedView[];
  private needsSig = '';
  /** Invite de la maison (rideaux, chantier de la pièce): Entrée ou clic. */
  private readonly invite: HTMLButtonElement;
  private readonly inviteText: HTMLSpanElement;
  private inviteModel: InviteModel | null = null;
  /** Fiche de la bête visée (0.12): nom, humeur en un mot, soin du jour. */
  private readonly animalCard: HTMLElement;
  private animalSig = '';
  /** Rêverie de la sieste: le carnet reste ouvert, « Se lever » à tout moment. */
  private readonly nap: HTMLElement;
  private readonly napTitle: HTMLElement;
  private readonly napText: HTMLElement;

  private readonly tip: HTMLParagraphElement;
  private tipId = -1;
  private tipUntil = 0;

  private readonly toolbar: HTMLDivElement;
  /** 0.13 (parcelles libres, section 5): compteur au-dessus de la barre, et ce qui suit le pointeur. */
  private readonly plotCounterEl: HTMLDivElement;
  private readonly plotCounterText: HTMLSpanElement;
  private readonly plotCounterLock: SVGSVGElement;
  private readonly plotReason: HTMLSpanElement;
  private readonly plotCursor: HTMLDivElement;
  private readonly plotPlus: HTMLSpanElement;
  private readonly plotCursorReason: HTMLSpanElement;
  private readonly plotRing: SVGSVGElement;
  private readonly plotRingIcon: SVGSVGElement;
  private plotPreview: PlotPreview | null = null;
  private plotSig = '';
  private readonly toolbarHeld: HTMLSpanElement;
  private readonly toolbarDetail: HTMLElement;
  /** Dans la maison: la touche du coin à soi. */
  private readonly toolbarCorner: HTMLElement;
  private readonly toolbarCornerText: HTMLSpanElement;
  private readonly slots: SlotView[] = [];
  private readonly newUntil: number[] = [];

  private readonly build: HTMLDivElement;
  private readonly buildIcon: SVGSVGElement;
  private readonly buildName: HTMLSpanElement;
  private readonly buildState: HTMLSpanElement;
  private readonly buildRotation: HTMLSpanElement;
  private buildSig = '';

  /** Barre de progression de l'action en cours (R10), mise à jour à chaque image. */
  private readonly progress: HTMLDivElement;
  private readonly progressIcon: SVGSVGElement;
  private readonly progressLabel: HTMLSpanElement;
  private progressSig = '';
  private progressValue = -1;
  /** Invite de la cible survolée à la souris (R11). */
  private readonly aimPrompt: HTMLParagraphElement;
  private readonly aimText: HTMLSpanElement;
  private aimSig = '';

  constructor(host: UiHost) {
    this.host = host;
    const { ctx } = host;
    const x = ctx.texts.extra;
    this.refusal = refusalTexts(ctx.content.texts.raw);

    // Haut gauche: horloge, bourse, notifications.
    this.clockWeather = icon('weather-sun', '');
    this.clockDay = el('span', { class: 'lpl-clock__day' });
    this.clockSeason = el('span', { class: 'lpl-clock__season' });
    this.clockTime = el('span', { class: 'lpl-clock__time' });
    this.clockStatusIcon = icon('ui-pause');
    this.clockStatusText = el('span');
    this.clockStatus = el('span', { class: 'lpl-clock__status' }, [this.clockStatusIcon, this.clockStatusText]);
    this.clockTrainText = el('span');
    this.clockTrain = el('span', { class: 'lpl-clock__train' }, [icon('ui-train'), this.clockTrainText]);
    this.watchRingArc = svgEl('circle', { class: 'lpl-watch-ring__arc', cx: '20', cy: '20', r: '18', pathLength: '100' });
    this.watchRing = svgEl('svg', { class: 'lpl-watch-ring', viewBox: '0 0 40 40', 'aria-hidden': 'true' });
    this.watchRing.append(svgEl('circle', { class: 'lpl-watch-ring__track', cx: '20', cy: '20', r: '18' }), this.watchRingArc);
    this.watchRing.toggleAttribute('hidden', true);
    this.clock = el('div', { class: 'lpl-clock', 'aria-label': x.hud.clockLabel }, [
      el('span', { class: 'lpl-clock__weather' }, [this.clockWeather, this.watchRing]),
      this.clockDay,
      this.clockSeason,
      this.clockTime,
      this.clockStatus,
      this.clockTrain,
    ]);

    const unit = splitAmount(ctx.texts.game.ui.hud.purse);
    this.purseAmount = el('span', { class: 'lpl-purse__amount' });
    this.purseUnit = el('span', { class: 'lpl-purse__unit', text: unit.after.trim() });
    this.purseNote = el('span', { class: 'lpl-purse__note', hidden: true });
    this.purseDelta = el('span', { class: 'lpl-purse__delta', hidden: true });
    const purse = el('div', { class: 'lpl-purse', 'aria-label': x.hud.purseLabel }, [
      icon(CURRENCY.icon),
      unit.before.trim() === '' ? null : el('span', { class: 'lpl-purse__unit', text: unit.before.trim() }),
      this.purseAmount,
      this.purseUnit,
      this.purseNote,
      this.purseDelta,
    ]);

    this.watchLine = el('span', { class: 'lpl-watch__line' });
    this.watchDetail = el('span', { class: 'lpl-watch__detail', hidden: true });
    this.watchPill = el('p', { class: 'lpl-watch__pill', role: 'status', 'aria-label': x.moments.watchLabel }, [
      icon('ui-eye'),
      el('span', { class: 'lpl-watch__text' }, [this.watchLine, this.watchDetail]),
    ]);
    // Rangée à part sous l'horloge et la bourse; la pastille garde sa largeur de texte.
    this.watch = el('div', { class: 'lpl-watch', hidden: true }, [this.watchPill]);

    this.toasts = el('ul', { class: 'lpl-toasts', 'aria-live': 'polite', 'aria-label': x.hud.toastsLabel });

    // Haut droite: l'autre, objectif.
    this.partnerPortrait = portrait('', 'small', token('other', host.symbol('other'), 'small'));
    this.partnerName = el('span', { class: 'lpl-partner__name' });
    this.partnerIcon = icon('ui-pin');
    this.partnerActivity = el('span');
    this.partnerNeedViews = needViews();
    this.partnerNeeds = el('span', { class: 'lpl-needs lpl-needs--small', role: 'group' }, this.partnerNeedViews.map((v) => v.box));
    this.partner = el('div', { class: 'lpl-partner' }, [
      this.partnerPortrait,
      el('span', { class: 'lpl-partner__head' }, [this.partnerName, this.partnerNeeds]),
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
    this.selfNeedViews = needViews();
    this.selfNeedNote = el('span', { class: 'lpl-needs__note', hidden: true });
    this.selfNeeds = el('span', { class: 'lpl-needs', role: 'group', 'aria-label': x.needs.label }, [
      ...this.selfNeedViews.map((v) => v.box),
      this.selfNeedNote,
    ]);
    this.watchBadge = el('span', { class: 'lpl-watch-badge', hidden: true, 'data-key': 'watching' }, [icon('ui-eye'), x.fish.watching]);
    this.self = el('div', { class: 'lpl-self' }, [
      this.selfPortrait,
      el('span', { class: 'lpl-self__text' }, [this.selfName, this.selfMood, this.selfNeeds, this.watchBadge]),
    ]);

    // Bas centre: avancée de l'action, invite du survol, astuce, barre d'outils, barre d'aménagement.
    this.progressIcon = icon('ui-hourglass');
    this.progressLabel = el('span', { class: 'lpl-progress__label' });
    this.progress = el(
      'div',
      { class: 'lpl-progress', role: 'progressbar', 'aria-label': x.progress.label, 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': 0, hidden: true },
      [this.progressIcon, this.progressLabel, el('span', { class: 'lpl-progress__bar' }, [el('span', { class: 'lpl-progress__fill' })])],
    );
    this.aimText = el('span');
    this.aimPrompt = el('p', { class: 'lpl-aim', role: 'status', 'aria-label': x.aim.label, hidden: true }, [keycap(x.aim.click), this.aimText]);
    this.tip = el('p', { class: 'lpl-tip', role: 'status', hidden: true });
    this.animalCard = el('p', { class: 'lpl-aim lpl-animal', role: 'status', hidden: true });
    this.inviteText = el('span');
    this.invite = button([keycap(ctx.key('Enter')), this.inviteText], () => {
      this.activateInvite();
    }, { class: 'lpl-aim lpl-invite', attrs: { hidden: true, 'data-key': 'invite' } });
    keepFocusOnGame(this.invite);
    this.napTitle = el('strong', { class: 'lpl-nap__title' });
    this.napText = el('span', { class: 'lpl-nap__text' });
    const napNotebook = button([icon('ui-notebook'), x.nap.notebook, ' ', keycap(ctx.key('Tab'))], () => {
      host.setMenu('notebook');
    }, { class: 'lpl-button', attrs: { 'data-key': 'nap-notebook' } });
    const napGetUp = button([x.nap.getUp, ' ', keycap(ctx.key('Space'))], () => {
      host.send({ type: 'get_up' });
    }, { class: 'lpl-button lpl-button--primary', attrs: { 'data-key': 'nap-get-up' } });
    keepFocusOnGame(napNotebook);
    keepFocusOnGame(napGetUp);
    this.nap = el('section', { class: 'lpl-nap', role: 'status', 'aria-label': x.nap.label, hidden: true }, [
      icon('ui-moon', 'lpl-icon lpl-nap__icon'),
      el('span', { class: 'lpl-nap__body' }, [this.napTitle, this.napText]),
      el('span', { class: 'lpl-nap__actions' }, [napNotebook, napGetUp]),
    ]);
    this.toolbarHeld = el('span');
    this.toolbarDetail = el('small');
    this.toolbarCornerText = el('span');
    this.toolbarCorner = el('small', { hidden: true }, [keycap(ctx.key('KeyC')), ' ', this.toolbarCornerText]);
    const slotsBox = el('div', { class: 'lpl-toolbar__slots', 'aria-label': x.hud.toolbarLabel });
    for (let i = 0; i < UI_SETTINGS.toolbarSlots; i++) {
      const view = this.makeSlot(i);
      this.slots.push(view);
      this.newUntil.push(0);
      slotsBox.append(view.button);
    }
    this.plotCounterText = el('span', { class: 'lpl-plot-counter__text', 'aria-hidden': 'true' });
    this.plotCounterLock = icon('ui-lock', 'lpl-icon lpl-plot-counter__lock');
    this.plotReason = el('span', { class: 'lpl-plot-reason', hidden: true, 'aria-live': 'polite' });
    this.plotCounterEl = el('div', { class: 'lpl-plot-counter', role: 'status', hidden: true }, [
      el('span', { class: 'lpl-plot-counter__box' }, [icon('garden-line', 'lpl-icon lpl-plot-counter__icon'), this.plotCounterText, this.plotCounterLock]),
      this.plotReason,
    ]);
    this.plotPlus = el('span', { class: 'lpl-plot-cursor__plus', hidden: true });
    this.plotCursorReason = el('span', { class: 'lpl-plot-cursor__reason', hidden: true });
    this.plotRingIcon = icon('seed-radish', 'lpl-icon lpl-plot-cursor__ring-icon');
    this.plotRing = svgEl('svg', { class: 'lpl-plot-cursor__ring', viewBox: '0 0 40 40', 'aria-hidden': 'true' });
    this.plotRing.append(
      svgEl('circle', { class: 'lpl-plot-cursor__track', cx: '20', cy: '20', r: '17' }),
      svgEl('circle', { class: 'lpl-plot-cursor__arc', cx: '20', cy: '20', r: '17', pathLength: '100' }),
    );
    this.plotCursor = el('div', { class: 'lpl-plot-cursor', hidden: true, 'aria-hidden': 'true' }, [
      el('span', { class: 'lpl-plot-cursor__hold' }, [this.plotRing, this.plotRingIcon]),
      this.plotPlus,
      this.plotCursorReason,
    ]);
    this.toolbar = el('div', { class: 'lpl-toolbar' }, [
      this.plotCounterEl,
      el('p', { class: 'lpl-toolbar__label' }, [this.toolbarHeld, this.toolbarDetail, this.toolbarCorner]),
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
        // Souris (R11): l'aperçu suit le pointeur, le clic droit tourne, le clic pose.
        { keys: [x.keys.wheel, keyLabel('KeyT')], text: `${x.keys.or} ${x.keys.rightClick} ${k.rotate}`, between: x.keys.or },
        { keys: ['KeyW', 'KeyA', 'KeyS', 'KeyD'].map(keyLabel), text: `${x.keys.or} ${x.keys.mouse} ${k.move}` },
        { keys: [keyLabel('Space')], text: `${x.keys.or} ${x.keys.click} ${k.place}` },
        { keys: [keyLabel('KeyX')], text: k.take },
        { keys: [keyLabel('Backspace')], text: k.store },
        { keys: [keyLabel('KeyC')], text: k.corner },
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
      host.hasCamera
        ? shortcut('ui-rotate-left', 'KeyQ', x.hud.rotateLeft, () => {
            host.camera('rotate_left');
          })
        : null,
      host.hasCamera
        ? shortcut('ui-rotate-right', 'KeyE', x.hud.rotateRight, () => {
            host.camera('rotate_right');
          })
        : null,
      shortcut('ui-notebook', 'Tab', x.hud.openNotebook, () => {
        host.toggleMenu('notebook');
      }),
    ]);

    this.root = el('div', { class: 'lpl-hud' }, [
      el('div', { class: 'lpl-hud__top-left' }, [this.clock, purse, this.watch, this.toasts]),
      el('div', { class: 'lpl-hud__top-right' }, [this.partner, this.objective]),
      el('div', { class: 'lpl-hud__bottom-left' }, [this.self]),
      el('div', { class: 'lpl-hud__bottom' }, [this.nap, this.progress, this.animalCard, this.aimPrompt, this.invite, this.tip, this.toolbar, this.build, this.plotCursor]),

      el('div', { class: 'lpl-hud__bottom-right' }, [shortcuts]),
    ]);
  }

  private makeSlot(index: number): SlotView {
    const keyLabel = this.host.ctx.key(index === 9 ? 'Digit0' : `Digit${index + 1}`);
    const key = el('span', { class: 'lpl-slot__key', 'aria-hidden': 'true', text: keyLabel });
    const slotIcon = icon('hoe', 'lpl-slot__icon');
    const count = el('span', { class: 'lpl-slot__count', hidden: true });
    const badge = el('span', { class: 'lpl-slot__badge', 'aria-hidden': 'true', hidden: true });
    const quality = icon('ui-star', 'lpl-slot__quality');
    quality.toggleAttribute('hidden', true);
    const gauge = el('span', { class: 'lpl-slot__gauge', 'aria-hidden': 'true', hidden: true });
    const b = button([key, slotIcon, count, badge, quality, gauge], () => {
      this.host.send({ type: 'select_slot', slot: index });
    }, { class: 'lpl-slot', attrs: { 'aria-selected': 'false' } });
    keepFocusOnGame(b);
    return { button: b, key, icon: slotIcon, count, badge, quality, gauge, lastCount: 0, lastItem: null };
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

  /** Barre de progression (appelée à chaque image: l'avancée suit le pas de la simulation). */
  updateProgress(world: ReadonlyWorld): void {
    const model = progressModel(world, this.host.ctx);
    const sig = model === null ? '' : `${model.kind}|${model.icon}|${model.label}|${model.together ? 1 : 0}`;
    if (sig !== this.progressSig) {
      this.progressSig = sig;
      setHidden(this.progress, model === null);
      if (model !== null) {
        setIcon(this.progressIcon, model.icon);
        setText(this.progressLabel, model.label);
        setAttr(this.progress, 'data-state', model.together ? 'together' : null);
      }
    }
    const value = model === null ? 0 : Math.round(model.ratio * 200) / 2;
    if (value === this.progressValue) return;
    this.progressValue = value;
    setStyleVar(this.progress, '--lpl-value', `${value}%`);
    setAttr(this.progress, 'aria-valuenow', String(Math.round(value)));
  }

  /** Masque le bas du HUD pendant une conversation ou l'aménagement, et l'objectif et le bas pendant un panneau. */
  setLayer(kind: HudState): void {
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
    setText(this.clockSeason, clock.season);
    setText(this.clockTime, clock.time);
    setAttr(this.clock, 'data-state', clock.state === '' ? null : clock.state);
    setText(this.clockStatusText, clock.status ?? '');
    setIcon(this.clockStatusIcon, clock.statusIcon);
    setAttr(this.clock, 'data-train', clock.train === null ? null : 'soon');
    setText(this.clockTrainText, clock.train ?? '');
    this.updateWatch(world, now);

    // Bourse.
    const purse = purseModel(world);
    setText(this.purseAmount, groupDigits(purse.amount));
    setText(this.purseUnit, splitAmount(ctx.texts.game.ui.hud.purse, purse.amount).after.trim());
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

    this.updateToasts(me.notifications, now, characterOf(world, ctx.partner)?.name ?? '');

    // L'autre joueur.
    const partnerChar = characterOf(world, ctx.partner);
    // La pause de l'autre: celle que décide la simulation (même seuil que l'arrêt de l'horloge).
    const p = partnerModel(world, ctx, partnerChar === null ? null : absenceMinutes(world, partnerChar));
    setHidden(this.partner, p === null);
    if (p !== null && partnerChar !== null) {
      setPortrait(this.partnerPortrait, portraitSvg(playerColors(partnerChar.id, partnerChar.appearance, ctx.content.clothes), p.expression, ''));
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
    setPortrait(this.selfPortrait, portraitSvg(playerColors(me.id, me.appearance, ctx.content.clothes), form.expression, form.name));
    setText(this.selfName, me.name);
    setAttr(this.self, 'aria-label', ctx.t(ctx.texts.extra.hud.selfLabel, { name: me.name }));
    setText(this.selfMood, form.name);
    setHidden(this.watchBadge, !isWatching(world.fishing, me.id));
    this.updateNeeds(world);
    this.updateNap(world);

    // Invite de la maison (rideaux, chantier de la pièce).
    const invite = inviteModel(world, ctx);
    this.inviteModel = invite;
    setHidden(this.invite, invite === null);
    setText(this.inviteText, invite?.text ?? '');

    // Fiche de la bête visée (0.12).
    const card = animalCardModel(world, ctx);
    const cardText = card === null ? '' : [card.mood === '' ? card.name : `${card.name}: ${card.mood}`, ...card.notes].join(', ');
    if (cardText !== this.animalSig) {
      this.animalSig = cardText;
      setHidden(this.animalCard, card === null);
      setText(this.animalCard, ctx.t(cardText));
    }

    // Invite de la cible survolée à la souris.
    const prompt = aimPromptModel(world, ctx);
    const aimSig = prompt === null ? '' : prompt.text;
    if (aimSig !== this.aimSig) {
      this.aimSig = aimSig;
      setHidden(this.aimPrompt, prompt === null);
      setText(this.aimText, prompt?.text ?? '');
    }

    // Barre d'outils ou barre d'aménagement.
    const placing = me.placement !== null;
    setHidden(this.toolbar, placing);
    setHidden(this.build, !placing);
    this.updatePlots(world, me);
    if (me.placement !== null) this.updateBuild(me.placement, characterOf(world, ctx.partner)?.name ?? '');
    else this.updateToolbar(me, now, plotCounter(world, ctx)?.free ?? 0);
  }

  /** Entrée ou clic sur l'invite: ouvrir ou fermer les rideaux, regarder le chantier. Vrai si une invite était là. */
  activateInvite(): boolean {
    const invite = this.inviteModel;
    if (invite === null) return false;
    if (invite.kind === 'curtains') this.host.send({ type: 'curtains', furniture: invite.furniture });
    else this.host.openRoomPanel();
    return true;
  }

  /** Icônes des besoins: chez soi et en petit chez l'autre (on voit quand l'autre a faim). */
  private updateNeeds(world: ReadonlyWorld): void {
    const { ctx } = this.host;
    const me = characterOf(world, ctx.me);
    const other = characterOf(world, ctx.partner);
    const mine = me === null ? [] : needIcons(ctx, me);
    const theirs = other === null ? [] : needIcons(ctx, other);
    const sig = JSON.stringify([mine, theirs, other?.name]);
    if (sig === this.needsSig) return;
    this.needsSig = sig;
    const paint = (views: readonly NeedView[], models: readonly NeedIconModel[]): void => {
      views.forEach((v, i) => {
        const m = models[i];
        setHidden(v.box, m === undefined);
        if (m === undefined) return;
        setIcon(v.icon, m.icon);
        setAttr(v.box, 'data-tone', m.tone);
        setAttr(v.box, 'aria-label', m.label);
        setAttr(v.box, 'title', m.label);
      });
    };
    paint(this.selfNeedViews, mine);
    paint(this.partnerNeedViews, theirs);
    // Le mot de l'état bas le plus pressant (Repos d'abord: c'est la seule contrainte du jeu).
    const low = [...mine].sort((a, b) => Number(b.need === 'rest') - Number(a.need === 'rest')).find((m) => m.tone === 'low' || m.tone === 'empty');
    setHidden(this.selfNeedNote, low === undefined);
    setText(this.selfNeedNote, low?.state ?? '');
    setAttr(this.selfNeedNote, 'data-tone', low?.tone ?? null);
    setAttr(this.partnerNeeds, 'aria-label', ctx.t(ctx.texts.extra.needs.partnerLabel, { partner: other?.name ?? '' }));
  }

  /** Rêverie de la sieste, chez qui dort. */
  private updateNap(world: ReadonlyWorld): void {
    const nap = napModel(world, this.host.ctx);
    setHidden(this.nap, nap === null);
    // Pendant la sieste, la rêverie prend la place de l'objectif et de la barre d'outils.
    setAttr(this.root, 'data-nap', nap === null ? null : 'true');
    setAttr(this.nap, 'data-state', nap?.together === true ? 'together' : null);
    setText(this.napTitle, nap?.title ?? '');
    setText(this.napText, nap?.text ?? '');
  }

  /** Ligne d'observation et anneau: stabilisés, pour ne jamais clignoter au bord du rayon. */
  private updateWatch(world: ReadonlyWorld, now: number): void {
    const model = this.steadyWatch.next(watchModel(world, this.host.ctx), now);
    const sig = model === null ? '' : JSON.stringify(model);
    if (sig === this.watchSig) return;
    this.watchSig = sig;
    setHidden(this.watch, (model?.line ?? null) === null);
    setAttr(this.watchPill, 'data-tone', model?.tone ?? null);
    setText(this.watchLine, model?.line ?? '');
    setText(this.watchDetail, model?.detail ?? '');
    setHidden(this.watchDetail, (model?.detail ?? null) === null);
    const ring = model?.ring ?? null;
    this.watchRing.toggleAttribute('hidden', ring === null);
    setAttr(this.watchRing, 'data-tone', model?.tone ?? null);
    setAttr(this.clock, 'data-watch', ring === null ? null : (model?.tone ?? null));
    setStyleVar(this.watchRing, '--lpl-value', String(Math.round((ring ?? 0) * 100)));
  }

  /** 0.13: l'aperçu du cordeau, posé par les entrées à chaque pas. */
  setPlotPreview(preview: PlotPreview | null): void {
    this.plotPreview = preview;
  }

  /**
   * Le compteur des parcelles (cordeau en main), la raison d'un refus au clavier, et ce qui suit le
   * pointeur: pastille du tracé, raison, anneau du maintien (section 5). Refait seulement s'il change.
   */
  private updatePlots(world: ReadonlyWorld, me: NonNullable<ReturnType<typeof characterOf>>): void {
    const { ctx } = this.host;
    const holding = me.bag[me.selected]?.item === GARDEN_LINE_ITEM && me.placement === null;
    const counter = holding ? plotCounter(world, ctx) : null;
    const preview = holding ? this.plotPreview : null;
    const cursor = plotCursor(world, ctx, preview);
    const pointer = preview?.pointer ?? null;
    const sig = JSON.stringify([counter, cursor, pointer === null ? null : [Math.round(pointer.x), Math.round(pointer.y)]]);
    if (sig === this.plotSig) return;
    this.plotSig = sig;
    setHidden(this.plotCounterEl, counter === null);
    if (counter !== null) {
      setText(this.plotCounterText, counter.text);
      setAttr(this.plotCounterEl, 'aria-label', counter.label);
      setAttr(this.plotCounterEl, 'data-cap', counter.atCap ? 'true' : null);
      setAttr(this.plotCounterEl, 'data-full', counter.free === 0 && !counter.atCap ? 'true' : null);
      this.plotCounterLock.toggleAttribute('hidden', !counter.atCap);
    }
    // Au clavier (sans pointeur), la raison s'écrit à côté du compteur; à la souris, près du pointeur.
    const reason = cursor?.reason ?? null;
    setHidden(this.plotReason, reason === null || pointer !== null);
    if (reason !== null && pointer === null) this.fillReason(this.plotReason, reason);
    setHidden(this.plotCursor, cursor === null || pointer === null);
    if (cursor === null || pointer === null) return;
    setStyleVar(this.plotCursor, '--lpl-x', `${String(Math.round(pointer.x))}px`);
    setStyleVar(this.plotCursor, '--lpl-y', `${String(Math.round(pointer.y))}px`);
    const hold = cursor.hold;
    const holdBox = this.plotRing.parentElement;
    if (holdBox !== null) setHidden(holdBox, hold === null);
    if (hold !== null) {
      setStyleVar(this.plotRing, '--lpl-value', String(Math.round(hold.progress * 100)));
      setIcon(this.plotRingIcon, hold.icon);
    }
    const plus = cursor.plus;
    setHidden(this.plotPlus, plus === null);
    if (plus !== null) {
      clear(this.plotPlus);
      this.plotPlus.append(pastille({ icon: 'ui-plot', text: plus.text, tone: plus.crossed ? 'missing' : 'ok', crossed: plus.crossed, label: plus.label }));
      if (plus.counter !== null) this.plotPlus.append(pastille({ icon: 'garden-line', text: plus.counter, tone: 'missing', crossed: true, label: plus.label }));
    }
    setHidden(this.plotCursorReason, reason === null);
    if (reason !== null) this.fillReason(this.plotCursorReason, reason);
  }

  private fillReason(target: HTMLElement, reason: { icon: string; crossed: boolean; text: string }): void {
    clear(target);
    target.append(pastille({ icon: reason.icon, text: reason.text, tone: 'missing', crossed: reason.crossed, label: reason.text }));
  }

  private updateToolbar(me: NonNullable<ReturnType<typeof characterOf>>, now: number, plotsFree: number): void {
    const model = toolbarModel(this.host.ctx, me, plotsFree);

    setText(this.toolbarHeld, model.held);
    setText(this.toolbarDetail, model.detail);
    setHidden(this.toolbarDetail, model.detail === '');
    setHidden(this.toolbarCorner, !isHome(me));
    const corner = this.host.ctx.texts.extra.corner;
    setText(this.toolbarCornerText, this.host.ctx.t((me.corner ?? null) === null ? corner.designate : corner.move));
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
    setHidden(view.badge, slot.badge === null);
    setText(view.badge, slot.badge === null ? '' : String(slot.badge));
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

  private updateBuild(placement: NonNullable<NonNullable<ReturnType<typeof characterOf>>['placement']>, partner: string): void {
    const { ctx } = this.host;
    const reason = placementReason(placement.blocked, ctx.texts.messages);
    const sig = `${placement.item}|${placement.valid}|${placement.rotation}|${reason ?? ''}|${partner}`;
    if (sig === this.buildSig) return;
    this.buildSig = sig;
    setIcon(this.buildIcon, itemIcon(ctx, placement.item));
    setText(this.buildName, ctx.t(itemTitle(ctx.content.items[placement.item], 1, placement.item)));
    clear(this.buildState);
    this.buildState.append(
      placement.valid
        ? chip(ctx.t(ctx.texts.extra.build.canPlace), 'ready', 'ui-check')
        : chip(ctx.t(reason ?? ctx.texts.extra.build.blocked, { partner }), 'alert', 'ui-warning'),
    );
    setText(this.buildRotation, ctx.t(ctx.texts.extra.common.orientation[placement.rotation % 4] ?? ''));
  }

  private toastDurationMs(): number {
    return (this.host.ctx.content.settings.hints.durationSeconds || UI_SETTINGS.toastSeconds) * 1000;
  }

  /**
   * Sous un écran plein cadre monté d'emblée (sauvegarde reprise sur l'écran d'étape), retient les
   * notifications déjà là comme anciennes, sans rien afficher. Celles qui arrivent ensuite (« La
   * Halte continue » au départ de l'écran) paraissent à la sortie, comme après la nuit.
   */
  observeNotifications(world: ReadonlyWorld): void {
    if (!this.toastFirstSight) return;
    const me = characterOf(world, this.host.ctx.me);
    if (me !== null) this.markSeen(me.notifications, this.host.now());
  }

  private markSeen(list: readonly Readonly<GameNotification>[], now: number): void {
    const durationMs = this.toastDurationMs();
    for (const n of list) {
      if (!this.seenAt.has(n.id)) {
        // Au montage, les notifications déjà là sont anciennes: on ne les rejoue pas.
        this.seenAt.set(n.id, this.toastFirstSight ? now - durationMs : now);
      }
    }
    this.toastFirstSight = false;
  }

  private updateToasts(all: readonly Readonly<GameNotification>[], now: number, partner: string): void {
    let list = all;
    const { ctx } = this.host;
    const durationMs = this.toastDurationMs();
    this.markSeen(list, now);
    // La simulation ne garde que les dernières notifications: on oublie les autres (séance d'une heure).
    if (this.seenAt.size > list.length * 2) {
      const ids = new Set(list.map((n) => n.id));
      for (const id of this.seenAt.keys()) if (!ids.has(id)) this.seenAt.delete(id);
    }
    // « Besoins en sourdine » (aide du carnet): les lignes des besoins ne paraissent pas.
    list = audibleNotifications(list, needsMuted());
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
      if (hint.hint !== undefined) this.host.send({ type: 'hint_seen', hint: hint.hint });
    }
    setHidden(this.tip, now >= this.tipUntil);

    // Les astuces vont en bas; une proposition d'achat a sa propre carte.
    const shown = visibleToasts(
      dedupeToasts(list.filter((n) => n.kind !== 'hint' && n.kind !== 'proposal')),
      this.seenAt,
      now,
      durationMs,
      UI_SETTINGS.maxToasts,
    );
    const keep = new Set(shown.map((n) => toastKey(n)));
    for (const [key, li] of this.toastItems) {
      if (keep.has(key)) continue;
      this.toastItems.delete(key);
      li.setAttribute('data-state', 'leaving');
      window.setTimeout(() => {
        li.remove();
      }, UI_SETTINGS.foldMs);
    }
    for (const n of shown) {
      const key = toastKey(n);
      const known = this.toastItems.get(key);
      if (known !== undefined) {
        // La plus récente passe en bas, comme une nouvelle arrivée.
        if (known !== this.toasts.lastElementChild && shown[shown.length - 1] === n) this.toasts.append(known);
        continue;
      }
      // 0.13: une habitude notée, toutes connues, une lanterne de plus: la carte du carnet, avec le portrait.
      const habit = habitToast(n, ctx);
      if (habit !== null) {
        const li = habitToastItem(habit, notificationSort(n, this.refusal));
        this.toastItems.set(key, li);
        this.toasts.append(li);
        continue;
      }
      const visual = toastVisual(n, ctx.texts.messages, this.refusal);
      const li = el('li', { class: `lpl-toast${visual.variant === '' ? '' : ` lpl-toast--${visual.variant}`}`, 'data-kind': notificationSort(n, this.refusal) }, [
        visual.partnerToken ? token('other', this.host.symbol('other'), 'small') : icon(visual.icon === '' ? 'ui-note' : visual.icon),
        typographier(toastText(n, ctx.texts.messages, { partner })),
        // Un mauvais nom: la poule répond à sa façon, une réplique différente d'une erreur à l'autre.
        visual.henAside === true ? el('span', { class: 'lpl-toast__aside', 'aria-hidden': 'true', text: henWrongAside(ctx, n.id) }) : null,
        // L'apogée d'un moment vu à deux: il entre dans l'onglet Souvenirs du carnet (tour 7).
        visual.variant === 'moment' ? el('span', { class: 'lpl-toast__more', text: ctx.t(ctx.texts.extra.moments.memoryAdded) }) : null,
      ]);
      this.toastItems.set(key, li);
      this.toasts.append(li);
    }
  }
}
