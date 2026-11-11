/**
 * HUD en jeu (interface.md, section 3): horloge et bourse en permanence; médaillons des besoins,
 * barre d'outils, bulle d'action, avis et coup d'œil seulement quand ils servent.
 */
import type { Content } from '../donnees/charger';
import type { PlayerIndex } from '../donnees/schemas/communs';
import type { ReadonlyWorld } from '../etat/monde';
import { el, icon, setAttr, setText, show, toggle } from './dom';
import {
  clockModel,
  GlanceTimer,
  NeedsWatcher,
  otherDirection,
  slotModel,
  ToolbarFold,
  toolbarSignature,
  type PromptModel,
} from './modeles';
import { itemThumb } from './pictos';
import { UI_TUNING } from './reglages';
import { fill, TEXTS } from './textes';

const NEED_ICONS = { hunger: 'bol', sleep: 'lune', hygiene: 'goutte' } as const;
/** Picto du temps qu'il fait, à côté du jour (par beau temps: soleil le jour, lune la nuit). */
const WEATHER_ICONS = {
  clear: 'soleil',
  overcast: 'nuage',
  rain: 'pluie',
  mist: 'brume',
  snow: 'neige',
  storm: 'orage',
} as const;

/** Projection d'un point du monde (m) vers l'écran (px CSS), `null` hors champ. */
/** Hauteurs (m) où s'accrochent la bulle d'action et le jeton de l'autre joueur. */
const PROMPT_HEIGHT = 1.1;
const TOKEN_HEIGHT = 2.2;

export type ProjectToScreen = (
  x: number,
  y: number,
  height?: number,
) => { x: number; y: number } | null;

export interface HudFrame {
  readonly now: number;
  readonly world: ReadonlyWorld;
  readonly local: PlayerIndex;
  readonly prompt: PromptModel | null;
  /** Un menu couvre l'écran: pas de bulle, la barre reste montrée. */
  readonly menu: boolean;
  readonly yaw: number;
  /** Réglage « besoins toujours visibles » (carnet, onglet Réglages). */
  readonly needsAlways?: boolean;
  /** Repère de l'étape suivie (`glanceTarget`), montré par le coup d'œil; absent: rien. */
  readonly questTarget?: { readonly x: number; readonly y: number; readonly label: string } | null;
}

export interface Hud {
  frame(f: HudFrame): void;
  glance(now: number): void;
  refusal(now: number, text: string): void;
  notice(now: number, iconId: string, text: string): void;
  money(now: number, text: string): void;
  dispose(): void;
}

export function createHud(
  root: HTMLElement,
  content: Content,
  keyLabel: (code: string) => string,
  project: ProjectToScreen | undefined,
): Hud {
  // Horloge et bourse.
  const sun = el('div', { class: 'dial__sun' });
  const bed = el('span', { class: 'dial__bed', title: TEXTS.clock.sleep }, [icon('lit')]);
  const dial = el('div', { class: 'dial' }, [sun, bed]);
  const weatherIcon = icon('soleil');
  const weatherUse = weatherIcon.firstElementChild;
  const day = el('div', { class: 'hud-clock__day' }, [weatherIcon, el('span')]);
  const time = el('div', { class: 'hud-clock__time' });
  const amount = el('span', { class: 'purse__n' });
  const purse = el('div', { class: 'purse' }, [el('span', { class: 'coin' }), amount]);
  const gain = el('span', { class: 'purse__gain', 'aria-hidden': 'true' });
  const clock = el('div', { class: 'hud-clock', role: 'status' }, [
    dial,
    el('div', {}, [day, time]),
    purse,
    gain,
  ]);

  // Besoins.
  const needs = el('div', { class: 'needs' });
  const medallions = (['hunger', 'sleep', 'hygiene'] as const).map((need) => {
    const node = el('div', { class: 'need', role: 'img' }, [icon(NEED_ICONS[need])]);
    node.hidden = true;
    needs.append(node);
    return node;
  });

  // Barre d'outils.
  const toolbar = el('div', {
    class: 'toolbar',
    role: 'toolbar',
    'aria-label': TEXTS.toolbar.label,
  });
  let toolbarDrawn = '';

  // Bulle d'action, sous elle la raison d'un refus.
  const promptKey = el('span', { class: 'key' });
  const promptVerb = el('span', { class: 'prompt__verb' });
  const promptWhy = el('span', { class: 'prompt__why' });
  const prompt = el('div', { class: 'prompt', role: 'status' }, [promptKey, promptVerb, promptWhy]);
  prompt.hidden = true;

  // Avis (haut droite, un seul à la fois) et coup d'œil.
  const noticeText = el('span');
  const noticeIcon = el('span', { class: 'notice__ic' });
  const notice = el('div', { class: 'notice', role: 'status', 'aria-live': 'polite' }, [
    noticeIcon,
    noticeText,
  ]);
  notice.hidden = true;
  const otherToken = el('div', { class: 'glance-other' }, [
    el('span', { class: 'token token--other' }),
    el('span', { class: 'glance-other__label' }),
  ]);
  const quest = el('div', { class: 'glance-quest', 'aria-label': TEXTS.glance.questSoon }, [
    icon('losange'),
  ]);
  const timer = el('div', { class: 'glance-timer', 'aria-hidden': 'true' }, [el('i')]);
  const glanceLayer = el('div', { class: 'glance' }, [otherToken, quest, timer]);
  glanceLayer.hidden = true;

  root.append(clock, needs, toolbar, prompt, notice, glanceLayer);

  const watcher = new NeedsWatcher();
  const fold = new ToolbarFold();
  const glance = new GlanceTimer();
  let refusalUntil = -1;
  let refusalText = '';
  let noticeUntil = -1;
  let gainUntil = -1;

  function drawToolbar(world: ReadonlyWorld, local: PlayerIndex): void {
    const me = world.players[local];
    toolbar.replaceChildren();
    me.toolbar.forEach((stack, index) => {
      const model = slotModel(content, stack);
      const slot = el('div', {
        class: `slot${model === null ? ' slot--empty' : ''}${me.selected === index ? ' slot--held' : ''}`,
        'aria-label': model === null ? TEXTS.toolbar.empty : model.name,
      });
      slot.append(el('span', { class: 'slot__key', text: keyLabel(`Digit${index + 1}`) }));
      if (model !== null) {
        slot.insertAdjacentHTML('beforeend', itemThumb(model.item, model.name));
        if (model.limit > 1)
          slot.append(el('span', { class: 'slot__n pastille', text: String(model.count) }));
        if (model.wear !== null) {
          const arc = el('span', { class: `wear${model.wear < 0.25 ? ' wear--low' : ''}` }, [
            el('i'),
          ]);
          const bar = arc.firstElementChild;
          if (bar instanceof HTMLElement) bar.style.width = `${Math.round(model.wear * 100)}%`;
          slot.append(arc);
        }
      }
      toolbar.append(slot);
    });
  }

  return {
    frame(f) {
      const { now, world, local, prompt: model, menu, yaw, needsAlways = false } = f;
      const c = clockModel(world, local);
      setText(time, c.time);
      const dayLabel = day.lastElementChild;
      if (dayLabel !== null) setText(dayLabel, c.day);
      setText(amount, c.money);
      toggle(clock, 'hud-clock--night', c.night);
      show(bed, c.canSleep);
      sun.style.transform = `rotate(${Math.round(-70 + 140 * c.arc)}deg)`;
      const weather = world.common.weather;
      const weatherId = weather === 'clear' && c.night ? 'lune' : WEATHER_ICONS[weather];
      if (weatherUse !== null) setAttr(weatherUse, 'href', `#lpl-i-${weatherId}`);
      setAttr(day, 'title', TEXTS.clock.weather[weather]);
      setAttr(
        clock,
        'aria-label',
        `${fill(TEXTS.clock.label, { n: world.common.day, heure: c.time, montant: c.money })} ${TEXTS.clock.weather[weather]}.`,
      );
      show(gain, now < gainUntil);
      if (now < gainUntil) {
        // Fondu d'entrée mené ici, sans animation CSS: animée par le navigateur, la pastille
        // ouvrait un trou dans le canevas 3D sous la boutique (rendu logiciel, banc des briques).
        const t = Math.min(1, (now - (gainUntil - UI_TUNING.moneyFloatMs)) / UI_TUNING.moneyRiseMs);
        const opacity = t.toFixed(2);
        const lift = `translateY(${((1 - t) * 0.5).toFixed(3)}rem)`;
        if (gain.style.opacity !== opacity) gain.style.opacity = opacity;
        if (gain.style.transform !== lift) gain.style.transform = lift;
      }

      const glancing = glance.active(now);
      const me = world.players[local];
      const list = watcher.update(now, me.needs, me.tiers, glancing || menu || needsAlways);
      list.forEach((n, i) => {
        const node = medallions[i];
        if (node === undefined) return;
        show(node, n.visible && !menu);
        toggle(node, 'need--low', n.low);
        toggle(node, 'need--bonus', n.state === 'bonus');
        toggle(node, 'need--zero', n.state === 'blocked');
        node.style.setProperty('--val', String(Math.round(n.value)));
        setAttr(node, 'aria-label', `${TEXTS.needs[n.need]} : ${TEXTS.needs.state[n.state]}`);
      });

      const signature = toolbarSignature(world, local);
      fold.update(now, signature);
      if (signature !== toolbarDrawn) {
        drawToolbar(world, local);
        toolbarDrawn = signature;
      }
      show(toolbar, fold.visible(now, glancing) && !menu);

      // Bulle: au-dessus de l'objet si le rendu sait projeter, sinon au-dessus de la barre.
      const refusing = now < refusalUntil;
      if (menu || (model === null && !refusing)) show(prompt, false);
      else {
        show(prompt, true);
        setText(promptKey, model?.key ?? keyLabel('Space'));
        setText(promptVerb, model?.verb ?? '');
        show(promptVerb, model !== null);
        const why = refusing
          ? refusalText
          : (model?.refusal ?? (model?.kind === 'board' ? model.waiting : null));
        setText(promptWhy, why ?? '');
        show(promptWhy, why !== null && why !== '');
        toggle(prompt, 'prompt--no', model?.refusal !== null && model?.refusal !== undefined);
        const at =
          model?.kind === 'act' && project !== undefined
            ? project(model.x, model.y, PROMPT_HEIGHT)
            : null;
        toggle(prompt, 'prompt--anchored', at !== null);
        if (at !== null) {
          prompt.style.left = `${Math.round(at.x)}px`;
          prompt.style.top = `${Math.round(at.y)}px`;
        } else {
          prompt.style.left = '';
          prompt.style.top = '';
        }
      }

      show(notice, now < noticeUntil && !menu);

      show(glanceLayer, glancing && !menu);
      if (glancing) {
        const other = world.players[local === 0 ? 1 : 0];
        const dir = otherDirection(me.body, other.body, yaw);
        const projected = project?.(other.body.x, other.body.y, TOKEN_HEIGHT) ?? null;
        const label = otherToken.lastElementChild;
        if (label !== null)
          setText(
            label,
            fill(TEXTS.glance.other, { nom: other.name, n: Math.round(dir.distance) }),
          );
        if (projected !== null) {
          otherToken.style.left = `${Math.round(projected.x)}px`;
          otherToken.style.top = `${Math.round(projected.y)}px`;
        } else {
          // Au bord de l'écran, dans sa direction (ellipse inscrite dans la fenêtre).
          const w = root.clientWidth || window.innerWidth;
          const h = root.clientHeight || window.innerHeight;
          otherToken.style.left = `${Math.round(w / 2 + Math.sin(dir.angle) * (w / 2 - 80))}px`;
          otherToken.style.top = `${Math.round(h / 2 - Math.cos(dir.angle) * (h / 2 - 70))}px`;
        }
        const target = f.questTarget ?? null;
        show(quest, target !== null);
        if (target !== null) {
          quest.setAttribute('aria-label', target.label);
          quest.title = target.label;
          const qDir = otherDirection(me.body, { x: target.x, y: target.y }, yaw);
          const onScreen = project?.(target.x, target.y, TOKEN_HEIGHT) ?? null;
          if (onScreen !== null) {
            quest.style.left = `${Math.round(onScreen.x)}px`;
            quest.style.top = `${Math.round(onScreen.y)}px`;
          } else {
            const w = root.clientWidth || window.innerWidth;
            const h = root.clientHeight || window.innerHeight;
            quest.style.left = `${Math.round(w / 2 + Math.sin(qDir.angle) * (w / 2 - 80))}px`;
            quest.style.top = `${Math.round(h / 2 - Math.cos(qDir.angle) * (h / 2 - 70))}px`;
          }
        }
        const bar = timer.firstElementChild;
        if (bar instanceof HTMLElement)
          bar.style.transform = `scaleX(${glance.left(now).toFixed(3)})`;
      }
    },
    glance(now) {
      glance.open(now);
    },
    refusal(now, text) {
      refusalText = text;
      refusalUntil = now + UI_TUNING.refusalMs;
    },
    notice(now, iconId, text) {
      noticeIcon.replaceChildren(icon(iconId));
      setText(noticeText, text);
      noticeUntil = now + UI_TUNING.noticeMs;
    },
    money(now, text) {
      setText(gain, text);
      gainUntil = now + UI_TUNING.moneyFloatMs;
      // Relance l'animation de la pièce qui saute.
      purse.classList.remove('purse--bump');
      purse.getBoundingClientRect();
      purse.classList.add('purse--bump');
    },
    dispose() {
      clock.remove();
      needs.remove();
      toolbar.remove();
      prompt.remove();
      notice.remove();
      glanceLayer.remove();
    },
  };
}
