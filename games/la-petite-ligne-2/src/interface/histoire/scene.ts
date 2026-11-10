/**
 * Consignes des scènes à deux (`sceneView`, attente `await`): ce que chaque joueur doit faire
 * (touche à tenir ou à appuyer, endroit où se tenir), sa jauge, celle de l'autre joueur, et le
 * moment « ensemble ». La touche répond tout de suite chez le joueur (écho local), sans attendre
 * l'état de l'hôte, qui arrive une image plus tard chez l'invité.
 *
 * Les répliques des scènes (`say`) ne sont pas dessinées ici: cet écran ne montre que les attentes.
 */
import type { Content } from '../../donnees/charger';
import type { PlayerIndex } from '../../donnees/schemas/communs';
import type { ReadonlyWorld } from '../../etat/monde';
import type { GameEvent } from '../../simulation/noyau/evenements';
import { el, setAttr, setText, toggle } from '../dom';
import type { ProjectToScreen } from '../hud';
import { fill } from '../textes';
import {
  sceneCardModel,
  shownProgress,
  shownState,
  type SceneCardModel,
  type RowState,
  type SceneRowModel,
} from './modele';
import { HISTOIRE_SETTINGS } from './reglages';
import { HISTOIRE_TEXTS } from './textes';
import './histoire.css';

const T = HISTOIRE_TEXTS.scene;

export interface SceneOverlay {
  frame(world: ReadonlyWorld, me: PlayerIndex, now: number): void;
  onEvent(event: GameEvent, me: PlayerIndex, now: number): void;
  /** Une consigne à geste est affichée: la touche d'action sert à la scène, pas à la bulle d'action. */
  active(): boolean;
  dispose(): void;
}

export interface SceneOverlayOptions {
  readonly root: HTMLElement;
  readonly content: Content;
  readonly keyLabel: (code: string) => string;
  readonly keyTarget: Pick<Window, 'addEventListener' | 'removeEventListener'>;
  readonly projectToScreen?: ProjectToScreen;
  /** Un écran qui prend le clavier est ouvert (dialogue, carnet): la touche ne compte plus pour la scène. */
  readonly busy: () => boolean;
}

interface RowNodes {
  readonly root: HTMLElement;
  readonly key: HTMLElement | null;
  readonly verb: HTMLElement;
  readonly away: HTMLElement | null;
  readonly gauge: HTMLElement | null;
  readonly fillBar: HTMLElement | null;
  readonly state: HTMLElement;
}

export function createSceneOverlay(options: SceneOverlayOptions): SceneOverlay {
  const { root, content, keyLabel, keyTarget, projectToScreen, busy } = options;
  const role = el('p', { class: 'scene-card__role' });
  const hint = el('p', { class: 'scene-card__hint' });
  const rows = el('ul', { class: 'scene-rows' });
  const togetherText = el('span', { class: 'scene-together__text' });
  const together = el('div', { class: 'scene-together' }, [
    el('span', { class: 'scene-together__pair', 'aria-hidden': 'true' }, [
      el('i', { class: 'token' }),
      el('i', { class: 'scene-together__link' }),
      el('i', { class: 'token token--other' }),
    ]),
    togetherText,
  ]);
  const message = el('p', { class: 'scene-card__msg', role: 'status', 'aria-live': 'polite' });
  const card = el('section', { class: 'scene-card', 'aria-label': T.label }, [
    role,
    hint,
    rows,
    together,
    message,
  ]);
  const pinRing = el('i', { class: 'scene-pin__ring' });
  const pin = el('div', { class: 'scene-pin', 'aria-hidden': 'true' }, [
    pinRing,
    el('span', { class: 'scene-pin__label', text: T.pin }),
  ]);
  const layer = el('div', { class: 'scene-layer' }, [pin, card]);
  layer.hidden = true;
  root.append(layer);

  let nodes: RowNodes[] = [];
  let signature = '';
  let beatKey = '';
  /** Touche d'action tenue ici depuis cet instant (`performance.now`), `null`: relâchée. */
  let heldAt: number | null = null;
  let latest: { world: ReadonlyWorld; me: PlayerIndex; now: number } | null = null;
  let model: SceneCardModel | null = null;
  let frozen: SceneCardModel | null = null;
  let successUntil = 0;
  let messageUntil = 0;
  const doneBy = new Set<PlayerIndex>();
  let visible = false;

  function heldMs(): number | null {
    return heldAt === null || busy() ? null : performance.now() - heldAt;
  }

  function buildRow(row: SceneRowModel): RowNodes {
    const chip = el('span', { class: 'key', text: keyLabel('Space') });
    const gesture = row.gesture;
    const mine = row.who === 'me';
    const verb = el('span', { class: 'scene-row__verb' });
    const away = mine && gesture?.type === 'stand' ? el('span', { class: 'pastille' }) : null;
    const gauge =
      gesture === null
        ? null
        : el('span', {
            class: 'gauge',
            role: 'progressbar',
            'aria-valuemin': 0,
            'aria-valuemax': 100,
            'aria-label': fill(T.gauge, { nom: mine ? T.you : row.name }),
          });
    const fillBar = gauge === null ? null : el('i');
    if (gauge !== null && fillBar !== null) gauge.append(fillBar);
    const state = el('span', { class: 'scene-row__state' });
    const showKey = mine && (gesture?.type === 'hold' || gesture?.type === 'press');
    const root = el(
      'li',
      {
        class: `scene-row scene-row--${row.who}${gesture === null ? '' : ` scene-row--${gesture.type}`}`,
      },
      [
        el('span', { class: 'scene-row__who' }, [
          el('i', { class: mine ? 'token' : 'token token--other' }),
          el('b', { text: mine ? T.you : row.name }),
        ]),
        el('span', { class: 'scene-row__what' }, [showKey ? chip : null, verb, away]),
        state,
        gauge,
      ],
    );
    return { root, key: showKey ? chip : null, verb, away, gauge, fillBar, state };
  }

  function rebuild(m: SceneCardModel): void {
    nodes = m.rows.map(buildRow);
    rows.replaceChildren(...nodes.map((n) => n.root));
    const mineRow = m.rows.find((r) => r.who === 'me');
    const other = m.rows.find((r) => r.who === 'other');
    setText(role, m.roleName === null ? '' : fill(T.role, { role: m.roleName }));
    role.hidden = m.roleName === null;
    setText(hint, mineRow?.gesture === null || mineRow === undefined ? '' : mineRow.text);
    hint.hidden = mineRow?.gesture === null || mineRow === undefined;
    setText(togetherText, fill(T.togetherWait, { nom: other?.name ?? '' }));
    together.hidden = m.together === null || !m.hasGesture;
  }

  function verbFor(row: SceneRowModel, state: RowState, node: RowNodes): void {
    const gesture = row.gesture;
    let text: string;
    if (row.who === 'other' || gesture === null) text = row.text;
    else if (gesture.type === 'hold')
      text = state === 'idle' ? T.verb.hold : state === 'active' ? T.verb.holding : T.done;
    else if (gesture.type === 'press') text = state === 'idle' ? T.verb.press : T.verb.pressed;
    else
      text =
        state === 'done'
          ? T.done
          : state === 'active' || gesture.down
            ? T.verb.standing
            : T.verb.stand;
    setText(node.verb, text);
  }

  function update(m: SceneCardModel, now: number, forcedDone: boolean): void {
    const held = heldMs();
    m.rows.forEach((row, i) => {
      const node = nodes[i];
      if (node === undefined) return;
      const state = forcedDone && row.gesture !== null ? 'done' : shownState(row, held);
      const progress = forcedDone && row.gesture !== null ? 1 : shownProgress(row, held);
      node.root.dataset.state = state;
      verbFor(row, state, node);
      setText(node.state, T.state[state]);
      if (node.key !== null)
        toggle(
          node.key,
          'key--down',
          (held !== null || row.gesture?.down === true) &&
            (row.gesture?.type === 'hold' || row.gesture?.type === 'press'),
        );
      if (node.gauge !== null && node.fillBar !== null) {
        const pct = Math.round(progress * 100);
        setAttr(node.gauge, 'aria-valuenow', String(pct));
        const scale = `scaleX(${progress.toFixed(3)})`;
        if (node.fillBar.style.transform !== scale) node.fillBar.style.transform = scale;
      }
      if (node.away !== null) {
        const target = row.gesture?.target ?? null;
        const near = target === null || target.distance <= target.radius;
        node.away.hidden = near || state === 'done';
        if (target !== null)
          setText(node.away, fill(T.away, { n: Math.max(1, Math.round(target.distance)) }));
      }
    });
    const ensemble = forcedDone || m.ensemble;
    card.dataset.state = ensemble ? 'ensemble' : m.allDone ? 'done' : 'idle';
    if (m.together !== null && m.hasGesture) {
      const other = m.rows.find((r) => r.who === 'other');
      setText(
        togetherText,
        ensemble ? T.togetherNow : fill(T.togetherWait, { nom: other?.name ?? '' }),
      );
    }
    const showMessage = now < messageUntil && !ensemble;
    message.hidden = !showMessage;
    if (!showMessage && message.textContent !== '') message.textContent = '';
  }

  function placePin(m: SceneCardModel, forcedDone: boolean): void {
    const mine = m.rows.find((r) => r.who === 'me');
    const target = mine?.gesture?.target ?? null;
    const zoom = Number.parseFloat(root.style.zoom) || 1;
    const screen =
      target === null || projectToScreen === undefined || forcedDone || mine?.done === true
        ? null
        : projectToScreen(target.x, target.y, 0);
    pin.hidden = screen === null;
    if (screen !== null) {
      pin.style.left = `${String(Math.round(screen.x / zoom))}px`;
      pin.style.top = `${String(Math.round(screen.y / zoom))}px`;
    }
  }

  function refresh(): void {
    if (latest === null) return;
    const shown = model ?? frozen;
    if (shown === null || !visible) return;
    update(shown, latest.now, model === null);
  }

  const onDown = (raw: Event): void => {
    if (!(raw instanceof KeyboardEvent) || raw.code !== 'Space' || raw.repeat) return;
    heldAt = performance.now();
    // Réponse immédiate: la jauge et la touche réagissent dans l'événement, pas à l'image suivante.
    refresh();
  };
  const onUp = (raw: Event): void => {
    if (!(raw instanceof KeyboardEvent) || raw.code !== 'Space') return;
    heldAt = null;
    refresh();
  };
  const onBlur = (): void => {
    heldAt = null;
  };
  keyTarget.addEventListener('keydown', onDown);
  keyTarget.addEventListener('keyup', onUp);
  keyTarget.addEventListener('blur', onBlur);

  return {
    frame(world, me, now) {
      latest = { world, me, now };
      model = sceneCardModel(world, content, me);
      const holding = model === null && frozen !== null && now < successUntil;
      if (model === null && !holding) {
        if (visible) {
          visible = false;
          layer.hidden = true;
          frozen = null;
          signature = '';
          beatKey = '';
          doneBy.clear();
        }
        return;
      }
      const shown = model ?? frozen;
      if (shown === null) return;
      const next = [
        shown.scene,
        shown.beat,
        shown.together ?? '-',
        shown.roleName ?? '-',
        shown.rows.map((r) => `${r.who}:${r.name}:${r.text}:${r.gesture?.type ?? '-'}`).join('|'),
      ].join('#');
      if (model !== null) {
        const key = `${model.scene}:${String(model.beat)}`;
        if (key !== beatKey) {
          beatKey = key;
          doneBy.clear();
          messageUntil = 0;
        }
        frozen = model;
      }
      if (next !== signature || !visible) {
        signature = next;
        rebuild(shown);
      }
      visible = true;
      layer.hidden = false;
      update(shown, now, model === null);
      placePin(shown, model === null);
    },
    onEvent(event, me, now) {
      if (event.type !== 'scene_gesture') return;
      const world = latest?.world;
      const name = world?.players[event.player].name ?? '';
      if (event.state === 'done') {
        doneBy.add(event.player);
        const gestureRows = (model ?? frozen)?.rows.filter((r) => r.gesture !== null) ?? [];
        if (gestureRows.length > 0 && gestureRows.every((r) => doneBy.has(r.player))) {
          successUntil = now + HISTOIRE_SETTINGS.togetherHoldMs;
          const last = model ?? frozen;
          if (last !== null) frozen = last;
        }
      } else if (event.state === 'lost' || event.state === 'expired') {
        doneBy.delete(event.player);
        successUntil = 0;
        const text =
          event.state === 'lost'
            ? T.events.lost
            : fill(event.player === me ? T.events.expiredMe : T.events.expiredOther, {
                nom: event.player === me ? (world?.players[me === 0 ? 1 : 0].name ?? '') : name,
              });
        message.textContent = text;
        message.hidden = false;
        messageUntil = now + HISTOIRE_SETTINGS.gestureMessageMs;
      }
    },
    active() {
      return visible && (model?.hasGesture ?? false);
    },
    dispose() {
      keyTarget.removeEventListener('keydown', onDown);
      keyTarget.removeEventListener('keyup', onUp);
      keyTarget.removeEventListener('blur', onBlur);
      layer.remove();
    },
  };
}
