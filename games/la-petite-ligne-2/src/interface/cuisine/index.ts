/**
 * Écran de la cuisine (interface.md 5.6, `docs/jeux/jeu-1/refonte/cuisine.md`): livre de recettes
 * en images, mini-jeu (une frise de pictos, une jauge, la touche à faire), plat fêté, scène du repas
 * à deux. Le mini-jeu tourne ici, sur la machine du joueur; chaque étape notée part à l'hôte.
 */
import type { Content } from '../../donnees/charger';
import type { PlayerIndex } from '../../donnees/schemas/communs';
import type { CookStepKind, RecipeDef } from '../../donnees/schemas/recette';
import type { ReadonlyWorld } from '../../etat/monde';
import { modifiersOf } from '../../simulation/besoins/jauges';
import { createMinigame, windowScaleOf, type Minigame } from '../../simulation/cuisine/minijeu';
import {
  allInputs,
  bestQuality,
  bookOf,
  countOf,
  isDuo,
  partOf,
  type Part,
} from '../../simulation/cuisine/recettes';
import type { MealBeat } from '../../simulation/cuisine/reglages';
import { mealBeatsBetween, mealSceneOver } from '../../simulation/cuisine/scene';
import type { Intent } from '../../simulation/noyau/entrees';
import type { GameEvent } from '../../simulation/noyau/evenements';
import { itemThumb } from '../pictos';
import { COOK_TEXTS } from './textes';
import './cuisine.css';

const S =
  'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';
/** Pictos de la cuisine (créations du studio): gestes et postes. */
const PICTOS: Readonly<Record<string, string>> = {
  chop: `<path ${S} d="M4 20L16 8l3 3L7 23zM16 8l3-5 2 2-2 6"/>`,
  stir: `<g ${S}><path d="M4 12h16a8 7 0 0 1-16 0z"/><path d="M14 3l-3 9"/><path d="M8 8c2-1 6-1 8 0"/></g>`,
  heat: `<path ${S} d="M12 3c3 4 6 6 6 11a6 6 0 0 1-12 0c0-3 2-4 3-6 1 2 2 3 3 3 0-3-1-5 0-8z"/>`,
  season: `<g ${S}><path d="M8 10h8v10a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2z"/><path d="M9 10l1-5h4l1 5"/><path d="M5 4h.01M3 7h.01M6 1h.01"/></g>`,
  plate: `<g ${S}><ellipse cx="12" cy="14" rx="10" ry="5"/><ellipse cx="12" cy="13" rx="5" ry="2"/></g>`,
  stove: `<g ${S}><path d="M5 20h14M7 20v-4h10v4"/><path d="M12 13c2-2 2-4 0-7-2 3-2 5 0 7z"/></g>`,
  kitchen: `<g ${S}><path d="M4 10h16v4a6 6 0 0 1-6 6h-4a6 6 0 0 1-6-6z"/><path d="M2 10h20M9 6c0-2 2-2 2-4M14 6c0-2 2-2 2-4"/></g>`,
  oven: `<g ${S}><rect x="3" y="3" width="18" height="18" rx="2"/><rect x="6" y="9" width="12" height="9" rx="1"/><path d="M7 6h.01M11 6h.01"/></g>`,
  counter: `<g ${S}><rect x="2" y="13" width="20" height="4" rx="1"/><path d="M6 13l7-9 2 2-5 7"/></g>`,
  workbench: `<g ${S}><path d="M3 10h18M5 10v10M19 10v10"/></g>`,
  duo: `<g ${S}><circle cx="8" cy="8" r="3"/><circle cx="16" cy="8" r="3"/><path d="M2 20c0-4 3-6 6-6s6 2 6 6M10 20c0-4 3-6 6-6s6 2 6 6"/></g>`,
  star: `<path d="M12 2l2.9 6.3 6.9.7-5.2 4.6 1.5 6.8L12 17l-6.1 3.4 1.5-6.8L2.2 9l6.9-.7z"/>`,
  hunger: `<g ${S}><path d="M3 11h18a9 9 0 0 1-18 0z"/><path d="M9 7c0-2 2-2 2-4M14 7c0-2 2-2 2-4"/></g>`,
  book: `<g ${S}><path d="M4 4h7a2 2 0 0 1 2 2v14a2 2 0 0 0-2-2H4zM20 4h-7a2 2 0 0 0-2 2v14a2 2 0 0 1 2-2h7z"/></g>`,
};

function picto(id: string, cls = ''): string {
  return `<svg class="lpl-cook-p ${cls}" viewBox="0 0 24 24" aria-hidden="true">${PICTOS[id] ?? ''}</svg>`;
}

function stars(quality: number): string {
  return [1, 2, 3]
    .map(
      (n) =>
        `<svg class="lpl-cook-star${n <= quality ? ' on' : ''}" viewBox="0 0 24 24">${PICTOS.star ?? ''}</svg>`,
    )
    .join('');
}

export interface KitchenView {
  readonly content: Content;
  world(): ReadonlyWorld | null;
  localIndex(): PlayerIndex | null;
}

export interface KitchenOptions {
  /** Aide réglable (0, 1, 2) et cuisine tranquille, réglages locaux du joueur. */
  readonly assist?: () => 0 | 1 | 2;
  readonly calm?: () => boolean;
  /** Temps forts pour le son et le rendu: gestes notés, plat, scène du repas. */
  readonly onCue?: (cue: CookCue) => void;
}

export type CookCue =
  | { readonly type: 'mark'; readonly kind: CookStepKind; readonly grade: number }
  | { readonly type: 'dish'; readonly first: boolean; readonly quality: number }
  | { readonly type: 'meal'; readonly beat: MealBeat };

type Screen =
  | { readonly kind: 'closed' }
  | {
      readonly kind: 'book';
      readonly target: string;
      readonly station: RecipeDef['station'];
      selected: number;
    }
  | {
      readonly kind: 'play';
      readonly recipe: RecipeDef;
      readonly part: Part;
      readonly game: Minigame;
      readonly target: string;
    }
  | { readonly kind: 'wait'; readonly recipe: RecipeDef }
  | {
      readonly kind: 'result';
      readonly item: string;
      readonly quality: number;
      readonly first: boolean;
      age: number;
    };

export interface KitchenScreen {
  onEvent(event: GameEvent): void;
  isOpen(): boolean;
  frame(dtMs: number): void;
  dispose(): void;
}

const NAV: Readonly<Record<string, number>> = {
  KeyA: -1,
  ArrowLeft: -1,
  KeyD: 1,
  ArrowRight: 1,
  KeyW: -4,
  ArrowUp: -4,
  KeyS: 4,
  ArrowDown: 4,
};

export function createKitchen(
  layer: HTMLElement,
  view: KitchenView,
  send: (intent: Intent) => void,
  keyLabel: (code: string) => string,
  keyTarget: Pick<Window, 'addEventListener' | 'removeEventListener'>,
  options: KitchenOptions = {},
): KitchenScreen {
  const content = view.content;
  const root = document.createElement('div');
  root.className = 'lpl-cook';
  root.hidden = true;
  layer.append(root);
  const meal = document.createElement('div');
  meal.className = 'lpl-cook-meal';
  meal.hidden = true;
  layer.append(meal);

  let screen: Screen = { kind: 'closed' };
  let partner: { recipe: string; steps: number; grades: number[] } | null = null;
  let mealTime = -1;
  let lastHtml = '';

  const nameOf = (item: string): string => content.items[item]?.name ?? item;
  const thumb = (item: string): string => itemThumb(item, nameOf(item));

  function entries(): { recipe: RecipeDef; known: boolean }[] {
    const world = view.world();
    return world === null ? [] : bookOf(content, world);
  }

  function card(
    entry: { recipe: RecipeDef; known: boolean },
    here: RecipeDef['station'],
    selected: boolean,
  ): string {
    const world = view.world();
    const me = view.localIndex();
    const { recipe, known } = entry;
    const player = world !== null && me !== null ? world.players[me] : null;
    const trial = !known && recipe.learn?.trial === true;
    const stationOk = recipe.station === here || recipe.second?.station === here;
    const inputs = allInputs(recipe)
      .map((portion) => {
        const have = player === null ? 0 : countOf(player, portion.item);
        const enough = have >= portion.count;
        const label = known
          ? `${String(Math.min(have, portion.count))}/${String(portion.count)}`
          : '?';
        return `<span class="lpl-cook-in${enough ? '' : ' missing'}" title="${nameOf(portion.item)}">${known || trial ? thumb(portion.item) : ''}<b>${label}</b></span>`;
      })
      .join('');
    const hunger = content.items[recipe.output.item]?.food?.hunger;
    const best = world === null ? 0 : bestQuality(world, recipe.id);
    const classes = ['lpl-cook-card'];
    if (selected) classes.push('sel');
    if (!known) classes.push('unknown');
    if (!stationOk) classes.push('elsewhere');
    return `<div class="${classes.join(' ')}" title="${known ? recipe.name : ''}">
      <div class="lpl-cook-dish">${thumb(recipe.output.item)}${isDuo(recipe) ? picto('duo', 'badge') : ''}${stationOk ? '' : picto(recipe.station, 'where')}</div>
      <div class="lpl-cook-ins">${inputs}</div>
      <div class="lpl-cook-foot">${hunger === undefined || !known ? '' : `${picto('hunger')}<b>+${String(hunger)}</b>`}<span class="lpl-cook-stars">${known ? stars(best) : ''}</span></div>
    </div>`;
  }

  function stepFrieze(
    steps: readonly { kind: CookStepKind }[],
    grades: readonly number[],
    current: number,
    cls: string,
  ): string {
    return `<div class="lpl-cook-frieze ${cls}">${steps
      .map((step, i) => {
        const state =
          i < grades.length ? `done g${String(grades[i] ?? 1)}` : i === current ? 'now' : '';
        return `<span class="lpl-cook-step ${state}">${picto(step.kind)}</span>`;
      })
      .join('')}</div>`;
  }

  function gaugeHtml(game: Minigame): string {
    const v = game.view();
    const pct = (x: number): string => `${(Math.max(0, Math.min(1, x)) * 100).toFixed(1)}%`;
    let inner = '';
    switch (v.kind) {
      case 'chop':
        inner = `<i class="lpl-cook-beat" style="left:${pct(v.gauge)}"></i><i class="lpl-cook-target" style="left:0"></i><i class="lpl-cook-target" style="left:100%"></i>`;
        break;
      case 'stir':
      case 'plate':
        inner = `<i class="lpl-cook-fill" style="width:${pct(v.kind === 'plate' ? v.gauge : v.gauge)}"></i>`;
        break;
      case 'heat':
      case 'season':
        if (v.zone !== null && v.sweet !== null)
          inner += `<i class="lpl-cook-zone" style="left:${pct(v.zone.from)};width:${pct(v.zone.to - v.zone.from)}"></i><i class="lpl-cook-sweet" style="left:${pct(v.sweet.from)};width:${pct(v.sweet.to - v.sweet.from)}"></i>`;
        inner +=
          v.kind === 'heat'
            ? `<i class="lpl-cook-fill hot" style="width:${pct(v.gauge)}"></i>`
            : `<i class="lpl-cook-needle" style="left:${pct(v.gauge)}"></i>`;
        break;
    }
    let keys: string;
    if (v.kind === 'stir')
      keys = ['KeyA', 'KeyD']
        .map((code) => `<kbd class="${v.expect === code ? 'on' : ''}">${keyLabel(code)}</kbd>`)
        .join('');
    else if (v.kind === 'plate')
      keys = v.arrows
        .map(
          (code, i) =>
            `<kbd class="${i < v.done ? 'ok' : i === v.done ? 'on' : ''}">${keyLabel(code)}</kbd>`,
        )
        .join('');
    else keys = `<kbd class="on">${keyLabel('Space')}</kbd>`;
    const mark =
      v.lastMark !== null && v.lastMarkAge < 0.7
        ? `<span class="lpl-cook-mark g${String(v.lastMark)}">${COOK_TEXTS.marks[v.lastMark] ?? ''}</span>`
        : '';
    const dots = Array.from(
      { length: v.count },
      (_, i) => `<i class="${i < v.done ? 'on' : ''}"></i>`,
    ).join('');
    return `<div class="lpl-cook-gauge${v.leadIn ? ' lead' : ''}">${inner}</div>
      <div class="lpl-cook-dots">${dots}</div>
      <div class="lpl-cook-keys">${keys}<span>${COOK_TEXTS.hints[v.kind] ?? ''}</span></div>${mark}`;
  }

  function render(): void {
    let html = '';
    switch (screen.kind) {
      case 'closed':
        break;
      case 'book': {
        const list = entries();
        const here = screen.station;
        const sel = screen.selected;
        html = `<div class="lpl-cook-book"><header>${picto(here, 'big')}${picto('book')}</header><div class="lpl-cook-grid">${list
          .map((entry, i) => card(entry, here, i === sel))
          .join(
            '',
          )}</div><footer><kbd>${keyLabel('Space')}</kbd>${picto('heat')}<kbd>${keyLabel('Enter')}</kbd>${picto('book')}<kbd>${keyLabel('Backspace')}</kbd></footer></div>`;
        break;
      }
      case 'play': {
        const def = partOf(screen.recipe, screen.part);
        const v = screen.game.view();
        const partnerFrieze =
          partner !== null && partner.recipe === screen.recipe.id
            ? stepFrieze(
                partOf(screen.recipe, screen.part === 0 ? 1 : 0)?.steps ?? [],
                partner.grades,
                partner.grades.length,
                'other',
              )
            : '';
        html = `<div class="lpl-cook-play">${partnerFrieze}${stepFrieze(def?.steps ?? [], screen.game.grades, v.step, 'mine')}
          <div class="lpl-cook-stage">${thumb(screen.recipe.output.item)}${picto(v.kind, 'big now')}</div>${gaugeHtml(screen.game)}</div>`;
        break;
      }
      case 'wait':
        html = `<div class="lpl-cook-result">${thumb(screen.recipe.output.item)}${picto('duo', 'big')}<p>${COOK_TEXTS.waitPartner}</p></div>`;
        break;
      case 'result':
        html = `<div class="lpl-cook-result${screen.first ? ' first' : ''}">${screen.first ? `<p class="new">${COOK_TEXTS.newDish}</p>` : ''}<div class="dish">${thumb(screen.item)}</div><div class="lpl-cook-stars big">${stars(screen.quality)}</div><p>${nameOf(screen.item)}</p></div>`;
        break;
    }
    if (html !== lastHtml) {
      root.innerHTML = html;
      lastHtml = html;
    }
    root.hidden = screen.kind === 'closed';
  }

  function windowScale(): number {
    const world = view.world();
    const me = view.localIndex();
    const needs = world === null || me === null ? 1 : modifiersOf(content, world, me).minigame;
    return windowScaleOf(needs, options.assist?.() ?? 0, options.calm?.() ?? false);
  }

  function readBook(): void {
    const world = view.world();
    const me = view.localIndex();
    if (world === null || me === null) return;
    const books = new Set(
      Object.values(content.recipes).flatMap((r) =>
        r.learn?.book === undefined ? [] : [r.learn.book],
      ),
    );
    const player = world.players[me];
    const toolbar = player.toolbar.findIndex((s) => s !== null && books.has(s.item));
    const bag = player.bag?.slots.findIndex((s) => s !== null && books.has(s.item)) ?? -1;
    if (toolbar >= 0) send({ type: 'cook_read', from: { area: 'toolbar', index: toolbar } });
    else if (bag >= 0) send({ type: 'cook_read', from: { area: 'bag', index: bag } });
  }

  function onKey(raw: Event, down: boolean): void {
    if (!(raw instanceof KeyboardEvent) || screen.kind === 'closed') return;
    const code = raw.code;
    raw.preventDefault();
    if (raw.repeat) return;
    if (screen.kind === 'play') {
      if (down && (code === 'Backspace' || code === 'Escape')) {
        send({ type: 'cook_cancel' });
        screen = { kind: 'closed' };
        return;
      }
      screen.game.key(code, down);
      return;
    }
    if (!down) return;
    if (screen.kind === 'book') {
      const list = entries();
      const move = NAV[code];
      if (move !== undefined)
        screen.selected = Math.max(0, Math.min(list.length - 1, screen.selected + move));
      else if (code === 'Space') {
        const entry = list[screen.selected];
        if (entry !== undefined)
          send({ type: 'cook_start', target: screen.target, recipe: entry.recipe.id });
      } else if (code === 'Enter') readBook();
      else if (code === 'Backspace' || code === 'Escape') screen = { kind: 'closed' };
      return;
    }
    if (screen.kind === 'result' && (code === 'Space' || code === 'Backspace' || code === 'Escape'))
      screen = { kind: 'closed' };
    if (screen.kind === 'wait' && (code === 'Backspace' || code === 'Escape'))
      screen = { kind: 'closed' };
  }
  const onDown = (e: Event): void => {
    onKey(e, true);
  };
  const onUp = (e: Event): void => {
    onKey(e, false);
  };
  keyTarget.addEventListener('keydown', onDown);
  keyTarget.addEventListener('keyup', onUp);

  function onEvent(event: GameEvent): void {
    const me = view.localIndex();
    if (me === null) return;
    switch (event.type) {
      case 'kitchen_opened':
        if (event.player === me && screen.kind === 'closed')
          screen = { kind: 'book', target: event.target, station: event.station, selected: 0 };
        break;
      case 'cook_started': {
        const recipe = content.recipes[event.recipe];
        const def = recipe === undefined ? null : partOf(recipe, event.part);
        if (recipe === undefined || def === null) break;
        if (event.player === me)
          screen = {
            kind: 'play',
            recipe,
            part: event.part,
            target: event.target,
            game: createMinigame({
              steps: def.steps,
              seed: event.seed,
              windowScale: windowScale(),
            }),
          };
        else partner = { recipe: recipe.id, steps: def.steps.length, grades: [] };
        break;
      }
      case 'cook_step_done':
        if (event.player !== me && partner?.recipe === event.recipe)
          partner.grades.push(event.grade);
        break;
      case 'cook_part_done':
        if (event.player === me) {
          const recipe = content.recipes[event.recipe];
          if (recipe !== undefined) screen = { kind: 'wait', recipe };
        }
        break;
      case 'cook_cancelled':
        if (event.player === me && screen.kind === 'play') screen = { kind: 'closed' };
        if (event.player !== me) partner = null;
        break;
      case 'dish_cooked':
        if (event.player === me) {
          screen = {
            kind: 'result',
            item: event.item,
            quality: event.quality,
            first: event.first,
            age: 0,
          };
          partner = null;
          options.onCue?.({ type: 'dish', first: event.first, quality: event.quality });
        }
        break;
      case 'refused':
        if (event.player === me && screen.kind === 'play' && event.reason === 'too-fast')
          screen = { kind: 'closed' };
        break;
      case 'meal_shared':
        if (event.player === me) mealTime = 0;
        break;
      // Le reste ne touche pas la cuisine.
      case 'animal_arrived':
      case 'animal_petted':
      case 'craft_cancelled':
      case 'craft_hit':
      case 'craft_started':
      case 'crafted':
      case 'plan_learned':
      case 'reward_given':
      case 'decision_changed':
      case 'map_object_changed':
      case 'music_opened':
      case 'music_started':
      case 'music_note':
      case 'music_finished':
      case 'music_closed':
      case 'shelter_collected':
      case 'shelter_filled':
      case 'shelter_opened':
      case 'tool_mended':
      case 'tool_ordered':
      case 'tool_sharpened':
      case 'workshop_opened':
      case 'order_opened':
      case 'order_renewed':
      case 'order_delivered':
      case 'mail_taken':
      case 'ate':
      case 'bag_changed':
      case 'brick_used':
      case 'calendar_ended':
      case 'calendar_started':
      case 'crossing_bell':
      case 'collection_completed':
      case 'collection_found':
      case 'collection_record':
      case 'comfort_changed':
      case 'vehicle_out':
      case 'vehicle_in':
      case 'vehicle_seat':
      case 'vehicle_stroke':
      case 'vehicle_started':
      case 'vehicle_stopped':
      case 'vehicle_turned':
      case 'vehicle_warning':
      case 'crop_reaped':
      case 'day_started':
      case 'deco_changed':
      case 'door_passed':
      case 'fish_cast':
      case 'fish_caught':
      case 'fish_hooked':
      case 'fish_lost':
      case 'fish_net_missed':
      case 'clock_struck':
      case 'gesture_done':
      case 'gesture_started':
      case 'harvested':
      case 'insect_fled':
      case 'item_gained':
      case 'item_given':
      case 'lock_closed':
      case 'lock_opened':
      case 'mirror_opened':
      case 'money_changed':
      case 'need_tier':
      case 'net_swung':
      case 'outlook_ready':
      case 'photo_taken':
      case 'plot_changed':
      case 'pockets_full':
      case 'quest_done':
      case 'quest_opened':
      case 'quest_step_done':
      case 'rain_watered':
      case 'recipe_learned':
      case 'room_progress':
      case 'room_supplied':
      case 'scene_beat':
      case 'scene_ended':
      case 'scene_gesture':
      case 'scene_started':
      case 'chapter_ended':
      case 'shop_bought':
      case 'shop_piece_bought':
      case 'shop_opened':
      case 'shop_sold':
      case 'sleep_waiting':
      case 'store_opened':
      case 'talk_ended':
      case 'talk_page':
      case 'talk_started':
      case 'tool_blunt':
      case 'tool_repaired':
      case 'tool_upgraded':
      case 'train_arrived':
      case 'train_boarded':
      case 'train_departed':
      case 'train_waiting':
      case 'unstuck':
      case 'villager_arrived':
      case 'villager_door':
      case 'villager_gift':
      case 'villager_greeted':
      case 'villager_left':
      case 'villager_reacted':
      case 'weather_changed':
      case 'work_hit':
        break;
    }
  }

  return {
    onEvent,
    isOpen() {
      return screen.kind !== 'closed';
    },
    frame(dtMs) {
      const dt = dtMs / 1000;
      if (screen.kind === 'play') {
        const before = screen.game.view();
        const grade = screen.game.update(dt);
        const after = screen.game.view();
        if (after.lastMark !== null && after.lastMarkAge < before.lastMarkAge)
          options.onCue?.({ type: 'mark', kind: before.kind, grade: after.lastMark });
        if (grade !== null) send({ type: 'cook_step', grade });
      } else if (screen.kind === 'result') {
        screen.age += dt;
        if (screen.age > 3) screen = { kind: 'closed' };
      }
      if (mealTime >= 0) {
        const next = mealTime + dt;
        for (const beat of mealBeatsBetween(mealTime === 0 ? -1 : mealTime, next)) {
          options.onCue?.({ type: 'meal', beat });
          meal.dataset.beat = beat;
        }
        mealTime = mealSceneOver(next) ? -1 : next;
        meal.hidden = mealTime < 0;
        if (!meal.hidden && meal.childElementCount === 0)
          meal.innerHTML = `${picto('hunger', 'big')}<span>${COOK_TEXTS.meal}</span><i class="steam"></i><i class="steam"></i><i class="steam"></i>`;
      }
      render();
    },
    dispose() {
      keyTarget.removeEventListener('keydown', onDown);
      keyTarget.removeEventListener('keyup', onUp);
      root.remove();
      meal.remove();
    },
  };
}
