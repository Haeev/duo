/**
 * Écran de chantier: ce que la pièce demande et les trois gestes (apporter, payer, travailler).
 * Il s'ouvre sur `worksite_opened` (la touche d'action devant l'ardoise du chantier). Chaque geste
 * envoie l'intention de la simulation, qui reste juge: son refus s'écrit en clair sous les gestes.
 * L'avancement se lit dans l'état transmis, donc en direct chez les deux joueurs. Tout au clavier:
 * Q et D (ou les flèches) choisissent, Espace ou Entrée fait le geste, Retour sort.
 */
import type { Content } from '../../donnees/charger';
import type { PlayerIndex } from '../../donnees/schemas/communs';
import type { ReadonlyWorld } from '../../etat/monde';
import type { Intent } from '../../simulation/noyau/entrees';
import type { GameEvent } from '../../simulation/noyau/evenements';
import { formatEuros } from '../../simulation/sac/argent';
import { el } from '../dom';
import { itemThumb } from '../pictos';
import { fill } from '../textes';
import {
  firstTodo,
  SITE_GESTURES,
  siteRefusalText,
  worksiteModel,
  workFeel,
  type SiteGesture,
  type WorksiteModel,
} from './modele';
import { SITE_TEXTS as T } from './textes';
import './chantier.css';

const S =
  'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';
/** Pictos du chantier (créations du studio). */
const PICTOS: Readonly<Record<SiteGesture | 'check' | 'lock', string>> = {
  supply: `<g ${S}><path d="M3 9l9-5 9 5-9 5z"/><path d="M3 9v7l9 5 9-5V9M12 14v7"/></g>`,
  pay: `<g ${S}><circle cx="12" cy="12" r="8"/><path d="M15 9a4 4 0 1 0 0 6M7 11h6M7 13.5h6"/></g>`,
  work: `<g ${S}><path d="M5 20l9-9"/><path d="M12 5l7 7-3 3-7-7z"/><path d="M12 5l-2 2"/></g>`,
  check: `<path ${S} d="M5 12.5l4.5 4.5L19 7.5"/>`,
  lock: `<g ${S}><rect x="5" y="11" width="14" height="9" rx="1.5"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></g>`,
};

function picto(id: keyof typeof PICTOS, cls = ''): string {
  return `<svg class="site-p ${cls}" viewBox="0 0 24 24" aria-hidden="true">${PICTOS[id]}</svg>`;
}

const ESCAPES: Readonly<Record<string, string>> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
};

/** Les prénoms viennent des profils des joueurs: jamais de balise dans le panneau. */
function esc(text: string): string {
  return text.replace(/[&<>"]/g, (c) => ESCAPES[c] ?? c);
}

export interface WorksiteScreen {
  isOpen(): boolean;
  close(): void;
  /** Vrai si l'événement s'est affiché dans l'écran (le HUD n'a pas à le redire). */
  onEvent(event: GameEvent, me: PlayerIndex, now: number): boolean;
  frame(world: ReadonlyWorld, me: PlayerIndex, now: number): void;
  key(code: string, now: number): boolean;
  dispose(): void;
}

interface Open {
  readonly housing: string;
  readonly room: string;
  focus: SiteGesture;
}

const STEP: Readonly<Record<string, number>> = {
  KeyA: -1,
  ArrowLeft: -1,
  ArrowUp: -1,
  KeyD: 1,
  ArrowRight: 1,
  ArrowDown: 1,
};

export function createWorksiteScreen(
  root: HTMLElement,
  content: Content,
  send: (intent: Intent) => void,
  keyLabel: (code: string) => string,
  openGuardMs: number,
  nameOf: (player: PlayerIndex) => string,
): WorksiteScreen {
  const layer = el('div', { class: 'site-layer' });
  layer.hidden = true;
  root.append(layer);
  // Un clic dans l'écran ne doit pas devenir un clic dans la scène.
  layer.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
  });

  let open: Open | null = null;
  let openedAt = 0;
  let message: { text: string; mood: 'no' | 'yes'; until: number } | null = null;
  let drawn = '';
  let last: { world: ReadonlyWorld; me: PlayerIndex; now: number } | null = null;

  function modelOf(): WorksiteModel | null {
    if (open === null || last === null) return null;
    return worksiteModel({ content, world: last.world }, last.me, open.housing, open.room);
  }

  function say(text: string, mood: 'no' | 'yes', now: number, ms = 4000): void {
    message = { text, mood, until: now + ms };
  }

  function close(): void {
    if (open === null) return;
    // Quitter l'écran, c'est poser le marteau.
    const model = modelOf();
    if (model !== null && last !== null && model.work.workers[last.me])
      send({ type: 'housing_work', housing: open.housing, room: open.room, on: false });
    open = null;
    message = null;
    drawn = '';
    layer.hidden = true;
    layer.replaceChildren();
  }

  function act(gesture: SiteGesture): void {
    const model = modelOf();
    if (open === null || last === null || model === null || model.done) return;
    const { housing, room } = open;
    message = null;
    if (gesture === 'supply') send({ type: 'housing_supply', housing, room });
    else if (gesture === 'pay') send({ type: 'housing_pay', housing, room });
    else send({ type: 'housing_work', housing, room, on: !model.work.workers[last.me] });
  }

  function token(player: PlayerIndex, me: PlayerIndex, on: boolean): string {
    const name = esc(nameOf(player));
    const label = on ? fill(T.working, { nom: name }) : name;
    return `<span class="site-token${player === me ? ' site-token--me' : ''}${on ? ' is-on' : ''}" title="${label}" aria-label="${label}">${name.slice(0, 1).toUpperCase()}</span>`;
  }

  function gestureButton(model: WorksiteModel, gesture: SiteGesture, me: PlayerIndex): string {
    const focused = open?.focus === gesture;
    const todo = model.todo[gesture];
    const mine = model.work.workers[me];
    let label: string = T.gestures[gesture];
    let hint: string = T.done;
    if (gesture === 'supply' && todo) hint = T.supplyHint;
    else if (gesture === 'pay' && todo) {
      label = `${T.gestures.pay} ${formatEuros(model.cost.due)}`;
      hint =
        model.cost.fromPurse === 0
          ? T.payFromChest
          : model.cost.fromChest === 0
            ? T.payFromPurse
            : fill(T.payMixed, {
                coffre: formatEuros(model.cost.fromChest),
                bourse: formatEuros(model.cost.fromPurse),
              });
    } else if (gesture === 'work' && todo) {
      label = mine ? T.gestures.stop : T.gestures.work;
      hint =
        model.work.workers[0] && model.work.workers[1]
          ? fill(T.workDuo, { n: String(model.work.rate).replace('.', ',') })
          : T.workHint;
    }
    return (
      `<button type="button" class="site-act${focused ? ' is-focus' : ''}${todo ? '' : ' is-done'}${gesture === 'work' && mine ? ' is-on' : ''}" data-gesture="${gesture}">` +
      `${picto(todo ? gesture : 'check')}<b>${label}</b><small>${hint}</small>` +
      (focused ? `<span class="key">${keyLabel('Space')}</span>` : '') +
      `</button>`
    );
  }

  function markup(model: WorksiteModel, me: PlayerIndex, now: number): string {
    const head =
      `<header class="site-head"><p class="site-kicker">${T.heading} · ${esc(model.houseName)}</p>` +
      `<h2>${esc(model.roomName)}</h2>`;
    if (model.done)
      return (
        `${head}</header><p class="site-finished">${picto('check')}${fill(T.finished, { piece: esc(model.roomName) })}</p>` +
        (model.clue === null
          ? ''
          : `<div class="site-clue"><b>${T.clue}</b><p>${esc(model.clue)}</p></div>`) +
        `<footer class="site-keys"><span><span class="key">${keyLabel('Space')}</span> ${T.keys.close}</span></footer>`
      );
    const stage = model.stage;
    const materials = model.materials
      .map((m) => {
        const full = m.delivered >= m.need;
        return (
          `<li class="site-row${full ? ' is-full' : ''}"><span class="site-thumb">${itemThumb(m.item, m.name)}</span>` +
          `<span class="site-name">${esc(m.name)}</span>` +
          `<span class="site-count"><b>${String(m.delivered)}</b> / ${String(m.need)}</span>` +
          `<span class="site-note">${full ? picto('check') : fill(T.inBag, { n: m.inBag })}</span></li>`
        );
      })
      .join('');
    const money =
      model.cost.total === 0
        ? `<span class="site-count">${T.free}</span><span class="site-note"></span>`
        : `<span class="site-count"><b>${model.cost.due === 0 ? T.paid : formatEuros(model.cost.due)}</b></span>` +
          `<span class="site-note">${model.cost.due === 0 ? picto('check') : fill(T.chest, { montant: formatEuros(model.cost.chest) })}</span>`;
    const ratio = model.work.total === 0 ? 1 : model.work.done / model.work.total;
    // En mots, pas en secondes: la barre montre la part faite, le mot ce qu'il reste à peu près.
    const feel = T.workFeel[workFeel(model.work)];
    const other: PlayerIndex = me === 0 ? 1 : 0;
    const work =
      model.work.total === 0
        ? `<span class="site-count">${T.workNone}</span>`
        : `<span class="site-bar" role="progressbar" aria-label="${T.work}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${String(Math.round(ratio * 100))}" aria-valuetext="${feel}"><span style="transform:scaleX(${ratio.toFixed(3)})"></span></span>` +
          `<span class="site-count"><b>${feel}</b></span>` +
          `<span class="site-note">${token(me, me, model.work.workers[me])}${token(other, me, model.work.workers[other])}</span>`;
    const status =
      message !== null && now < message.until
        ? `<p class="site-status site-status--${message.mood}" role="status">${esc(message.text)}</p>`
        : model.lock !== null
          ? `<p class="site-status site-status--lock" role="status">${picto('lock')}${esc(model.lock.text)}</p>`
          : `<p class="site-status" role="status"></p>`;
    return (
      `${head}<p class="site-stage">${esc(stage?.name ?? '')}` +
      (stage !== null && stage.count > 1
        ? ` <small>${fill(T.stage, { n: stage.index + 1, total: stage.count })}</small>`
        : '') +
      `</p></header>` +
      `<ul class="site-needs">${materials}` +
      `<li class="site-row site-row--money${model.cost.due === 0 ? ' is-full' : ''}"><span class="site-thumb">${picto('pay')}</span><span class="site-name">${T.money}</span>${money}</li>` +
      `<li class="site-row site-row--work"><span class="site-thumb">${picto('work')}</span><span class="site-name">${T.work}</span>${work}</li></ul>` +
      `<div class="site-acts${model.lock === null ? '' : ' is-locked'}">${SITE_GESTURES.map((g) => gestureButton(model, g, me)).join('')}</div>` +
      status +
      `<footer class="site-keys"><span><span class="key">${keyLabel('KeyA')}</span><span class="key">${keyLabel('KeyD')}</span> ${T.keys.choose}</span>` +
      `<span><span class="key">${keyLabel('Space')}</span> ${T.keys.act}</span>` +
      `<span><span class="key">${keyLabel('Backspace')}</span> ${T.keys.leave}</span></footer>`
    );
  }

  function render(): void {
    if (open === null || last === null) return;
    const model = modelOf();
    // Le lieu a changé, ou la pièce n'existe plus: rien à montrer.
    if (model === null) {
      close();
      return;
    }
    const html = markup(model, last.me, last.now);
    if (html === drawn) return;
    drawn = html;
    layer.innerHTML = `<section class="site-panel" role="dialog" aria-label="${T.heading}: ${esc(model.roomName)}">${html}</section>`;
  }

  layer.addEventListener('click', (ev) => {
    const target =
      ev.target instanceof Element ? ev.target.closest<HTMLElement>('[data-gesture]') : null;
    const gesture = SITE_GESTURES.find((g) => g === target?.dataset.gesture);
    if (open === null || gesture === undefined) return;
    open.focus = gesture;
    act(gesture);
    render();
  });

  return {
    isOpen() {
      return open !== null;
    },
    close,
    onEvent(event, me, now) {
      if (event.type === 'worksite_opened') {
        if (event.player !== me) return false;
        open = { housing: event.housing, room: event.room, focus: 'supply' };
        openedAt = now;
        message = null;
        drawn = '';
        layer.hidden = false;
        const model = modelOf();
        if (model !== null) open.focus = firstTodo(model);
        return true;
      }
      if (open === null) return false;
      if (event.type === 'refused' && event.player === me) {
        say(siteRefusalText(modelOf(), event.reason), 'no', now);
        return true;
      }
      if (event.type === 'room_supplied' && event.room === open.room) {
        const name = content.items[event.item]?.name ?? event.item;
        say(
          fill(T.supplied, { nom: nameOf(event.player), quoi: `${name} x ${String(event.count)}` }),
          'yes',
          now,
        );
        return true;
      }
      if (event.type === 'room_progress' && event.room === open.room) {
        if (!event.done) say(T.stageDone, 'yes', now);
        // Le geste suivant utile prend le focus: après le dernier coup, rien à choisir.
        open.focus = 'supply';
        return true;
      }
      return false;
    },
    frame(world, me, now) {
      last = { world, me, now };
      if (open === null) return;
      const model = modelOf();
      // Le focus quitte un geste accompli pour le suivant (apporté: payer; payé: travailler).
      if (model !== null && !model.done && !model.todo[open.focus]) open.focus = firstTodo(model);
      render();
    },
    key(code, now) {
      if (open === null) return false;
      if (now - openedAt < openGuardMs) return true;
      if (code === 'Backspace' || code === 'Escape') {
        close();
        return true;
      }
      const model = modelOf();
      if (model === null || model.done) {
        if (code === 'Space' || code === 'Enter') close();
        return true;
      }
      const step = STEP[code];
      if (step !== undefined) {
        const i = SITE_GESTURES.indexOf(open.focus);
        const count = SITE_GESTURES.length;
        open.focus = SITE_GESTURES[(i + step + count) % count] ?? open.focus;
        render();
        return true;
      }
      if (code === 'Space' || code === 'Enter') act(open.focus);
      return true;
    },
    dispose() {
      layer.remove();
    },
  };
}
