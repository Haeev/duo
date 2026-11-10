/**
 * Écran de fin de chapitre: un écran plein, sobre, chez les deux joueurs à la fois (état
 * `common.story.ending`, lu par `chapterEndView`). Une touche (Espace ou Entrée) pour continuer;
 * chacun ferme le sien, l'écran disparaît quand les deux l'ont fait. Celui qui a continué voit
 * qu'on attend l'autre, et sait quand l'autre a fini de lire.
 */
import type { Content } from '../../donnees/charger';
import type { PlayerIndex } from '../../donnees/schemas/communs';
import type { ReadonlyWorld } from '../../etat/monde';
import type { Intent } from '../../simulation/noyau/entrees';
import type { GameEvent } from '../../simulation/noyau/evenements';
import { el, setText } from '../dom';
import { fill } from '../textes';
import { chapterEndModel, type ChapterEndModel } from './modele';
import { HISTOIRE_SETTINGS } from './reglages';
import { HISTOIRE_TEXTS } from './textes';
import './histoire.css';

const T = HISTOIRE_TEXTS.end;

export interface ChapterEndScreen {
  frame(world: ReadonlyWorld, me: PlayerIndex, now: number): void;
  isOpen(): boolean;
  /** Touche lue (vrai: consommée). Espace et Entrée continuent; toute autre touche est avalée. */
  key(code: string, now: number): boolean;
  onEvent(event: GameEvent, now: number): void;
  dispose(): void;
}

export function createChapterEnd(
  root: HTMLElement,
  content: Content,
  send: (intent: Intent) => void,
  keyLabel: (code: string) => string,
  onContinue: () => void,
): ChapterEndScreen {
  const eyebrow = el('p', { class: 'fin__eyebrow', text: T.eyebrow });
  const title = el('h1', { class: 'fin__title', id: 'lpl-fin-titre' });
  const text = el('div', { class: 'fin__text' });
  const who = el('ul', { class: 'fin__who' });
  const key = el('span', { class: 'key' });
  const go = el('button', { class: 'btn btn--primary focus fin__go', type: 'button' }, [
    key,
    el('span', { text: T.continue }),
  ]);
  const wait = el('p', { class: 'fin__wait', 'aria-live': 'polite' });
  const foot = el('footer', { class: 'fin__foot' }, [who, go, wait]);
  const page = el('div', { class: 'fin__page' }, [
    eyebrow,
    title,
    el('div', { class: 'fin__rule', 'aria-hidden': 'true' }),
    text,
  ]);
  const layer = el(
    'section',
    {
      class: 'fin',
      role: 'dialog',
      'aria-modal': 'true',
      'aria-labelledby': 'lpl-fin-titre',
    },
    [page, foot],
  );
  layer.hidden = true;
  root.append(layer);

  let shown = false;
  let signature = '';
  let openedAt = 0;
  /** Une intention est partie: on montre l'attente sans attendre l'état de l'hôte. */
  let sent = false;
  let model: ChapterEndModel | null = null;
  let builtId = '';

  function draw(m: ChapterEndModel, world: ReadonlyWorld, me: PlayerIndex): void {
    const other: PlayerIndex = me === 0 ? 1 : 0;
    const otherName = world.players[other].name;
    const closed = m.closed || sent;
    if (m.id !== builtId) {
      // Le texte ne se redessine pas quand l'autre ferme: il ne rejoue pas son apparition.
      builtId = m.id;
      setText(title, m.title);
      text.replaceChildren(
        ...m.lines.map((line, i) => {
          const paragraph = el('p', { text: line });
          paragraph.style.setProperty('--i', String(i));
          return paragraph;
        }),
      );
    }
    setText(key, keyLabel('Space'));
    who.replaceChildren(
      el('li', { class: `fin__who-item${closed ? ' fin__who-item--done' : ''}` }, [
        el('i', { class: 'token' }),
        el('span', { text: `${T.you}\u00a0: ${closed ? T.youDone : T.youReading}` }),
      ]),
      el('li', { class: `fin__who-item${m.otherClosed ? ' fin__who-item--done' : ''}` }, [
        el('i', { class: 'token token--other' }),
        el('span', {
          text: `${otherName}\u00a0: ${m.otherClosed ? T.otherDone : T.otherReading}`,
        }),
      ]),
    );
    go.hidden = closed;
    wait.hidden = !closed;
    if (closed) {
      wait.replaceChildren(
        el('b', { text: fill(T.waiting, { nom: otherName }) }),
        el('span', { text: fill(T.waitingHint, { nom: otherName }) }),
      );
    } else wait.replaceChildren();
  }

  function proceed(now: number): void {
    const m = model;
    if (m === null || m.closed || sent || now - openedAt < HISTOIRE_SETTINGS.endGuardMs) return;
    sent = true;
    send({ type: 'chapter_end_close' });
    onContinue();
    signature = '';
  }

  go.addEventListener('click', () => {
    proceed(Number.POSITIVE_INFINITY);
  });

  return {
    frame(world, me, now) {
      model = chapterEndModel(world, content, me);
      if (model === null) {
        if (shown) {
          shown = false;
          sent = false;
          layer.hidden = true;
          signature = '';
          builtId = '';
        }
        return;
      }
      if (!shown) {
        shown = true;
        openedAt = now;
        layer.hidden = false;
      }
      if (model.closed) sent = true;
      const next = [
        model.id,
        model.closed || sent,
        model.otherClosed,
        world.players[me === 0 ? 1 : 0].name,
      ].join('|');
      if (next === signature) return;
      signature = next;
      draw(model, world, me);
    },
    isOpen() {
      return shown;
    },
    key(code, now) {
      if (!shown) return false;
      if (code === 'Space' || code === 'Enter') proceed(now);
      return true;
    },
    onEvent(event, now) {
      if (event.type === 'chapter_ended') openedAt = now;
    },
    dispose() {
      layer.remove();
    },
  };
}
