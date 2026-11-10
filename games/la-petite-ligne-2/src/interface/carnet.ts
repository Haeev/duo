/**
 * Carnet (interface.md, 5.3): onglet Sac (barre et sac, déplacer, poser, donner, manger; coffre
 * commun), les autres onglets présents et marqués « à venir ». Rangement d'un meuble: deux grilles
 * côte à côte, ouvert par l'événement `store_opened`.
 */
import type { Content } from '../donnees/charger';
import type { PlayerIndex } from '../donnees/schemas/communs';
import type { ReadonlyWorld } from '../etat/monde';
import type { GameEvent } from '../simulation/noyau/evenements';
import type { Intent } from '../simulation/noyau/entrees';
import { el, icon } from './dom';
import { equipModel, equippedText } from './equiper';
import {
  chestModel,
  gridMove,
  NEEDS,
  slotAt,
  slotCount,
  slotModel,
  type SlotModel,
  type SlotRefModel,
} from './modeles';
import { createCarnetTabs, type CarnetTabsOptions, type TabId } from './carnet/index';
import { itemThumb } from './pictos';
import { UI_TUNING } from './reglages';
import { fill, refusalText, TEXTS } from './textes';

const TABS = [
  ['bag', 'sac'],
  ['quests', 'plume'],
  ['villagers', 'gens'],
  ['collections', 'album'],
  ['map', 'carte'],
  ['outfits', 'tenue'],
  ['settings', 'rouage'],
] as const;
const NEED_ICONS = { hunger: 'bol', sleep: 'lune', hygiene: 'goutte' } as const;

type Mode =
  | { readonly kind: 'closed' }
  | { readonly kind: 'notebook' }
  | { readonly kind: 'store'; readonly target: string };

/** Ce que le jeu branche aux onglets autres que le Sac (sources de lecture, réglages, éditeur). */
export type NotebookExtras = Pick<
  CarnetTabsOptions,
  'sources' | 'sourcesExtras' | 'settings' | 'openEditor' | 'follow'
>;

export interface Notebook {
  isOpen(): boolean;
  /** Ouvre le carnet; `tab` choisit l'onglet (identifiant), sinon le dernier ouvert. */
  open(now: number, tab?: string): void;
  /** Réglages de la machine et suite suivie, tenus par les onglets. */
  readonly tabs: Pick<ReturnType<typeof createCarnetTabs>, 'follow' | 'settings'>;
  openStore(target: string, now: number): void;
  /**
   * Événements de la partie: le carnet ouvert sur le Sac y lit la réponse à ses boutons (sac
   * équipé, refus). Renvoie `true` s'il l'a affichée lui-même (le HUD n'a alors rien à dire).
   */
  onEvent(event: GameEvent, local: PlayerIndex): boolean;
  close(): void;
  frame(world: ReadonlyWorld, local: PlayerIndex): void;
  key(code: string, shift: boolean, now: number): boolean;
  dispose(): void;
}

const DIRS: Readonly<Record<string, 'left' | 'right' | 'up' | 'down'>> = {
  ArrowLeft: 'left',
  KeyA: 'left',
  ArrowRight: 'right',
  KeyD: 'right',
  ArrowUp: 'up',
  KeyW: 'up',
  ArrowDown: 'down',
  KeyS: 'down',
};

export function createNotebook(
  root: HTMLElement,
  content: Content,
  send: (intent: Intent) => void,
  keyLabel: (code: string) => string,
  openGuardMs: number,
  extras: NotebookExtras = {},
): Notebook {
  const layer = el('div', { class: 'carnet-layer' });
  layer.hidden = true;
  root.append(layer);

  let mode: Mode = { kind: 'closed' };
  let tab = 0;
  /** Case au focus: dans ses affaires (indice linéaire, barre puis sac) ou dans le meuble. */
  let side: 'mine' | 'store' = 'mine';
  let focus = 0;
  let held: SlotRefModel | null = null;
  let openedAt = 0;
  /** L'ouverture (le carnet qui monte) ne se joue qu'une fois, pas à chaque redessin. */
  let entering = false;
  let drawn = '';
  /** Réponse à la dernière demande « Équiper »; s'efface dès qu'on change de case. */
  let equipNote: { readonly ok: boolean; readonly text: string } | null = null;
  /** Défilement des zones, gardé d'un dessin à l'autre pour la même page. */
  let scrolls: { readonly key: string; readonly tops: readonly number[] } | null = null;
  let shownKey = '';
  let last: { world: ReadonlyWorld; local: PlayerIndex } | null = null;

  const tabs = createCarnetTabs({
    ...extras,
    content,
    keyLabel,
    invalidate: () => {
      redraw();
    },
    goto(target) {
      const at = TABS.findIndex(([id]) => id === target);
      if (at >= 0) tab = at;
      redraw();
    },
  });
  const tabId = (): TabId | null => {
    const id = TABS[tab]?.[0];
    return id === undefined || id === 'bag' ? null : id;
  };

  const keys = (codes: readonly string[], label: string): HTMLElement =>
    el('span', {}, [
      ...codes.map((c) => el('span', { class: 'key', text: keyLabel(c) })),
      ` ${label}`,
    ]);

  function storeSlots(world: ReadonlyWorld, target: string): readonly (SlotModel | null)[] {
    const slots = world.places[world.common.place]?.objects[target]?.store ?? [];
    return slots.map((s) => slotModel(content, s));
  }

  function tile(
    model: SlotModel | null,
    focused: boolean,
    isHeld: boolean,
    onClick: () => void,
    onHover: () => void,
  ): HTMLButtonElement {
    const label =
      model === null
        ? TEXTS.toolbar.empty
        : fill(TEXTS.notebook.slotLabel, { objet: model.name, n: model.count, max: model.limit }) +
          (model.full ? TEXTS.notebook.slotFull : '');
    const node = el('button', {
      class: `tile${model === null ? ' tile--empty' : ''}${focused ? ' focus' : ''}${isHeld ? ' tile--held' : ''}`,
      'aria-label': label,
      tabindex: '-1',
    });
    if (model !== null) {
      node.insertAdjacentHTML('beforeend', itemThumb(model.item, model.name));
      if (model.limit > 1)
        node.append(
          el('span', {
            class: `tile__badge pastille${model.full ? ' pastille--full' : ''}`,
            text: `${model.count}/${model.limit}`,
          }),
        );
      if (model.wear !== null) {
        const arc = el('span', { class: `wear${model.wear < 0.25 ? ' wear--low' : ''}` }, [
          el('i'),
        ]);
        const bar = arc.firstElementChild;
        if (bar instanceof HTMLElement) bar.style.width = `${Math.round(model.wear * 100)}%`;
        node.append(arc);
      }
      node.append(el('span', { class: 'nametag', text: model.name }));
    }
    node.addEventListener('click', onClick);
    node.addEventListener('mouseenter', onHover);
    return node;
  }

  function mineGrid(world: ReadonlyWorld, local: PlayerIndex, focusable: boolean): HTMLElement {
    const me = world.players[local];
    const wrap = el('div', { class: 'mine' });
    const rack = el('div', { class: 'rack', role: 'group', 'aria-label': TEXTS.toolbar.label });
    const grid = el('div', { class: 'grid', role: 'grid' });
    const count = slotCount(world, local);
    for (let i = 0; i < count; i += 1) {
      const ref = slotAt(world, local, i);
      if (ref === null) continue;
      const stack = ref.area === 'toolbar' ? me.toolbar[ref.index] : me.bag?.slots[ref.index];
      const model = slotModel(content, stack ?? null);
      const node = tile(
        model,
        focusable && side === 'mine' && focus === i,
        held !== null && held.area === ref.area && held.index === ref.index,
        () => {
          side = 'mine';
          focus = i;
          activate();
        },
        () => {
          side = 'mine';
          focus = i;
          redraw();
        },
      );
      if (ref.area === 'toolbar') {
        node.append(el('span', { class: 'slot__key', text: keyLabel(`Digit${ref.index + 1}`) }));
        if (me.selected === ref.index) node.classList.add('tile--inhand');
        rack.append(node);
      } else grid.append(node);
    }
    wrap.append(rack);
    if (me.bag === null) {
      wrap.append(
        el('div', { class: 'nobag', role: 'img', 'aria-label': TEXTS.notebook.noBag }, [
          icon('sac', 'ic nobag__sac'),
          el('div', { class: 'nobag__how' }, [icon('cadenas'), TEXTS.notebook.noBag]),
        ]),
      );
    } else {
      grid.setAttribute('aria-label', fill(TEXTS.notebook.bagLabel, { n: me.bag.slots.length }));
      const used = me.bag.slots.filter((s) => s !== null).length;
      wrap.append(
        el('div', { class: 'bag-head' }, [
          icon('sac'),
          el('span', { class: 'pastille', text: `${used}/${me.bag.slots.length}` }),
        ]),
        grid,
      );
    }
    return wrap;
  }

  function focusedModel(
    world: ReadonlyWorld,
    local: PlayerIndex,
  ): { ref: SlotRefModel; model: SlotModel } | null {
    const ref = slotAt(world, local, focus);
    if (ref === null) return null;
    const me = world.players[local];
    const stack = ref.area === 'toolbar' ? me.toolbar[ref.index] : me.bag?.slots[ref.index];
    const model = slotModel(content, stack ?? null);
    return model === null ? null : { ref, model };
  }

  function detailPage(world: ReadonlyWorld, local: PlayerIndex): HTMLElement {
    const page = el('div', { class: 'detail detail--sac' });
    const chosen = focusedModel(world, local);
    let refusedNote: string | null = null;
    if (chosen === null)
      page.append(el('p', { class: 'detail__none', text: TEXTS.notebook.nothing }));
    else {
      const { model } = chosen;
      const big = el('div', { class: 'v3d' });
      big.insertAdjacentHTML('beforeend', itemThumb(model.item, model.name));
      page.append(
        big,
        el('h2', { text: model.name }),
        el('p', {
          text:
            model.wear !== null
              ? fill(TEXTS.notebook.wear, { n: Math.round((1 - model.wear) * 100) })
              : fill(TEXTS.notebook.count, { n: model.count, max: model.limit }),
        }),
      );
      const row = el('div', { class: 'row' });
      const equip = equipModel(content, model.item, world.players[local].bag?.id ?? null);
      if (model.edible) row.append(button('Enter', TEXTS.notebook.eat, true));
      if (equip.kind !== 'none')
        row.append(button('Enter', TEXTS.notebook.equip, true, equip.kind === 'refused'));
      row.append(
        button('KeyP', TEXTS.notebook.drop, false),
        button('KeyT', TEXTS.notebook.give, false),
      );
      page.append(row);
      // Un bouton refusé dit toujours pourquoi.
      if (equip.kind === 'refused') refusedNote = equip.text;
    }
    // Sinon, la réponse de la partie (le sac équipé a quitté sa case: la fiche est alors vide).
    const reason = refusedNote === null ? equipNote : { ok: false, text: refusedNote };
    if (reason !== null)
      page.append(
        el(
          'div',
          { class: `equip-note equip-note--${reason.ok ? 'ok' : 'refus'}`, role: 'status' },
          [icon(reason.ok ? 'sac' : 'refus'), el('span', { text: reason.text })],
        ),
      );
    return page;
  }

  function chestBox(world: ReadonlyWorld, local: PlayerIndex): HTMLElement {
    const money = chestModel(world, local);
    return el('div', { class: 'chest' }, [
      el('div', { class: 'chest__row' }, [
        icon('coffre'),
        el('b', { text: TEXTS.notebook.chest }),
        el('span', { class: 'chest__n', text: money.chest }),
      ]),
      el('div', { class: 'chest__row' }, [
        el('span', { class: 'coin coin--sm' }),
        el('span', { text: TEXTS.notebook.purse }),
        el('span', { class: 'chest__n', text: money.purse }),
      ]),
      el('div', { class: 'row' }, [
        button('KeyV', TEXTS.notebook.deposit, false),
        button('KeyR', TEXTS.notebook.withdraw, false),
      ]),
    ]);
  }

  function button(
    code: string,
    label: string,
    primary: boolean,
    refused = false,
  ): HTMLButtonElement {
    const node = el(
      'button',
      {
        class: `btn${refused ? ' btn--off' : primary ? ' btn--primary' : ''}`,
        tabindex: '-1',
        ...(refused ? { 'aria-disabled': 'true' } : {}),
      },
      [el('span', { class: 'key', text: keyLabel(code) }), label],
    );
    node.addEventListener('click', () => {
      api.key(code, false, Number.POSITIVE_INFINITY);
    });
    return node;
  }

  function draw(world: ReadonlyWorld, local: PlayerIndex): void {
    rememberScroll();
    const me = world.players[local];
    if (mode.kind === 'store') {
      const target = mode.target;
      const store = storeSlots(world, target);
      const furniture = el('div', {
        class: 'grid',
        role: 'grid',
        'aria-label': TEXTS.store.furniture,
      });
      store.forEach((model, i) => {
        furniture.append(
          tile(
            model,
            side === 'store' && focus === i,
            false,
            () => {
              side = 'store';
              focus = i;
              activate();
            },
            () => {
              side = 'store';
              focus = i;
              redraw();
            },
          ),
        );
      });
      layer.replaceChildren(
        el(
          'section',
          {
            class: `carnet carnet--store${entering ? ' carnet--entre' : ''}`,
            'aria-label': TEXTS.store.label,
          },
          [
            el('div', { class: 'book' }, [
              el('section', { class: 'page page--g' }, [
                zone([
                  el('h2', { class: 'page__title', text: TEXTS.store.mine }),
                  mineGrid(world, local, true),
                ]),
                el('div', { class: 'foot' }, [
                  keys(['Space'], TEXTS.store.put),
                  keys(['Backspace'], TEXTS.notebook.close),
                ]),
              ]),
              el('section', { class: 'page page--d' }, [
                zone([el('h2', { class: 'page__title', text: TEXTS.store.furniture }), furniture]),
                el('div', { class: 'foot' }, [keys(['Space'], TEXTS.store.take)]),
              ]),
            ]),
          ],
        ),
      );
      entering = false;
      settleScroll();
      return;
    }
    const signets = el('div', {
      class: 'signets',
      role: 'tablist',
      'aria-label': TEXTS.notebook.label,
    });
    TABS.forEach(([id, ic], i) => {
      const node = el(
        'button',
        {
          class: 'signet',
          role: 'tab',
          'aria-selected': i === tab ? 'true' : 'false',
          'aria-label': TEXTS.notebook.tabs[id],
          title: TEXTS.notebook.tabs[id],
          tabindex: '-1',
        },
        [icon(ic), el('span', { text: TEXTS.notebook.tabs[id] })],
      );
      node.addEventListener('click', () => {
        tab = i;
        redraw();
      });
      signets.append(node);
    });
    const who = el('div', { class: 'who' }, [
      el('span', { class: `token${local === 1 ? ' token--other' : ''}` }),
      me.name,
      el(
        'div',
        { class: 'needs needs--inline' },
        NEEDS.map((need) => {
          const low = me.needs[need] < UI_TUNING.lowNeed;
          const node = el(
            'div',
            {
              class: `need${low ? ' need--low' : ''}${me.tiers[need] === 'bonus' ? ' need--bonus' : ''}`,
              role: 'img',
              'aria-label': `${TEXTS.needs[need]} : ${TEXTS.needs.state[me.tiers[need]]}`,
            },
            [icon(NEED_ICONS[need])],
          );
          node.style.setProperty('--val', String(Math.round(me.needs[need])));
          return node;
        }),
      ),
    ]);
    const id = tabId();
    const pages = id === null ? null : tabs.render(id, world, local);
    const hints = id === null ? [] : tabs.hints(id);
    const foot = el('div', { class: 'foot' }, [
      keys(['KeyQ', 'KeyE'], TEXTS.notebook.tabsKeys),
      ...(id === null
        ? [keys(['Space'], TEXTS.notebook.move)]
        : hints.map((h) => keys(h.codes, h.label))),
      keys(['Backspace'], TEXTS.notebook.close),
    ]);
    const left =
      pages === null
        ? [who, mineGrid(world, local, true)]
        : [...(pages.full ? [] : [who]), ...pages.left];
    const book =
      pages?.full === true
        ? el('div', { class: 'book' }, [
            el('section', { class: 'page page--g page--pleine' }, [zone(left), foot]),
          ])
        : el('div', { class: 'book' }, [
            el('section', { class: 'page page--g' }, [zone(left), foot]),
            el('section', { class: 'page page--d', 'aria-live': 'polite' }, [
              zone(pages === null ? [detailPage(world, local)] : (pages.right ?? [])),
              ...(pages === null ? [chestBox(world, local)] : []),
            ]),
          ]);
    layer.replaceChildren(
      el(
        'section',
        { class: `carnet${entering ? ' carnet--entre' : ''}`, 'aria-label': TEXTS.notebook.label },
        [book, signets],
      ),
    );
    entering = false;
    settleScroll();
  }

  /** Zone d'une page: tout ce qui défile, le pied de page restant en dessous. */
  function zone(children: readonly (HTMLElement | null)[]): HTMLElement {
    return el('div', { class: 'page__zone' }, children);
  }

  const zones = (): HTMLElement[] => [...layer.querySelectorAll<HTMLElement>('.page__zone')];

  /** Identifie la page affichée: le défilement ne se garde que pour elle. */
  const scrollKey = (): string => `${mode.kind}:${tab}`;

  /** Mémorise le défilement avant que le dessin soit refait. */
  function rememberScroll(): void {
    scrolls = { key: shownKey, tops: zones().map((z) => z.scrollTop) };
  }

  /** Remet le défilement, puis fait suivre la case ou la carte au focus (au clavier comme au clic). */
  function settleScroll(): void {
    const all = zones();
    // Un indice de touches n'apparaît que si quelque chose défile vraiment; il s'ajoute d'abord,
    // car il agrandit le pied et réduit la zone.
    if (all.some((z) => z.scrollHeight > z.clientHeight + 1))
      layer
        .querySelector('.page--g .foot')
        ?.append(keys(['PageUp', 'PageDown'], TEXTS.notebook.scrollKeys));
    const saved = scrolls !== null && scrolls.key === scrollKey() ? scrolls.tops : [];
    all.forEach((z, i) => {
      z.scrollTop = saved[i] ?? 0;
      const target = z.querySelector<HTMLElement>('.focus');
      if (target === null) return;
      const margin = 8;
      const zr = z.getBoundingClientRect();
      const tr = target.getBoundingClientRect();
      // Le nom sous une case fait partie de ce qui doit rester visible.
      const tip = target.querySelector<HTMLElement>('.nametag');
      const bottom = Math.max(tr.bottom, tip?.getBoundingClientRect().bottom ?? 0);
      if (tr.top < zr.top + margin) z.scrollTop -= zr.top + margin - tr.top;
      else if (bottom > zr.bottom - margin) z.scrollTop += bottom - (zr.bottom - margin);
    });
    shownKey = scrollKey();
  }

  function redraw(): void {
    drawn = '';
    if (last !== null) api.frame(last.world, last.local);
  }

  /** Entrée sur un sac: envoie l'intention, sauf si le refus est déjà connu et expliqué à l'écran. */
  function equip(
    ref: SlotRefModel,
    itemId: string,
    world: ReadonlyWorld,
    local: PlayerIndex,
  ): void {
    const model = equipModel(content, itemId, world.players[local].bag?.id ?? null);
    if (model.kind === 'ready') send({ type: 'equip_bag', from: ref });
  }

  /** PageHaut et PageBas: fait défiler la zone qui déborde (la page de droite d'abord). */
  function scrollPage(direction: 1 | -1): void {
    const target = zones()
      .reverse()
      .find((z) => z.scrollHeight > z.clientHeight + 1);
    if (target === undefined) return;
    target.scrollBy({ top: direction * target.clientHeight * 0.8 });
  }

  /** Espace sur la case au focus: prendre puis poser (déplacer), ou ranger et reprendre. */
  function activate(): void {
    if (last === null) return;
    const { world, local } = last;
    if (mode.kind === 'store') {
      if (side === 'store') send({ type: 'store_take', target: mode.target, index: focus });
      else {
        const ref = slotAt(world, local, focus);
        if (ref !== null) send({ type: 'store_put', target: mode.target, from: ref });
      }
      return;
    }
    const ref = slotAt(world, local, focus);
    if (ref === null) return;
    if (held === null) {
      if (focusedModel(world, local) !== null) held = ref;
    } else {
      if (held.area !== ref.area || held.index !== ref.index)
        send({ type: 'move_stack', from: held, to: ref });
      held = null;
    }
    redraw();
  }

  const api: Notebook = {
    isOpen() {
      return mode.kind !== 'closed';
    },
    tabs,
    open(now, target) {
      const wanted = TABS.findIndex(([id]) => id === target);
      if (wanted >= 0) tab = wanted;
      entering = true;
      mode = { kind: 'notebook' };
      side = 'mine';
      held = null;
      equipNote = null;
      openedAt = now;
      layer.hidden = false;
      redraw();
    },
    openStore(target, now) {
      entering = true;
      mode = { kind: 'store', target };
      side = 'store';
      focus = 0;
      held = null;
      openedAt = now;
      layer.hidden = false;
      redraw();
    },
    onEvent(event, local) {
      if (mode.kind !== 'notebook' || tab !== 0) return false;
      if (event.type === 'bag_changed' && event.player === local)
        equipNote = { ok: true, text: equippedText(content, event.bag) };
      else if (event.type === 'refused' && event.player === local)
        equipNote = { ok: false, text: refusalText(event.reason) };
      else return false;
      redraw();
      return true;
    },
    close() {
      if (last !== null && mode.kind === 'notebook') tabs.closed(last.world, last.local);
      mode = { kind: 'closed' };
      held = null;
      equipNote = null;
      shownKey = '';
      layer.hidden = true;
      layer.replaceChildren();
      drawn = '';
    },
    frame(world, local) {
      last = { world, local };
      if (mode.kind === 'closed') return;
      const me = world.players[local];
      const store =
        mode.kind === 'store'
          ? (world.places[world.common.place]?.objects[mode.target]?.store ?? [])
          : [];
      const shown = tabId();
      const tabSignature =
        shown === null || mode.kind !== 'notebook' ? '' : tabs.signature(shown, world, local);
      const signature = JSON.stringify([
        mode,
        tab,
        side,
        focus,
        held,
        me.toolbar,
        me.bag,
        me.selected,
        me.money,
        me.tiers,
        equipNote,
        world.common.chest,
        store,
        tabSignature,
      ]);
      if (signature === drawn) return;
      drawn = signature;
      draw(world, local);
    },
    key(code, shift, now) {
      if (mode.kind === 'closed' || last === null) return false;
      if (now - openedAt < openGuardMs) return true;
      const { world, local } = last;
      const current = tabId();
      if (
        current !== null &&
        mode.kind === 'notebook' &&
        tabs.key(current, code, shift, world, local)
      )
        return true;
      if (code === 'PageUp' || code === 'PageDown') {
        scrollPage(code === 'PageDown' ? 1 : -1);
        return true;
      }
      const dir = DIRS[code];
      if (dir !== undefined) {
        equipNote = null;
        const columns = UI_TUNING.gridColumns;
        if (side === 'mine') {
          const next = gridMove(focus, slotCount(world, local), columns, dir);
          // Au bord droit de ses affaires, on passe au meuble.
          if (
            mode.kind === 'store' &&
            dir === 'right' &&
            next === focus &&
            focus % columns === columns - 1
          ) {
            side = 'store';
            focus = Math.floor(focus / columns) * columns;
          } else focus = next;
        } else {
          const count = storeSlots(world, mode.kind === 'store' ? mode.target : '').length;
          const next = gridMove(focus, count, columns, dir);
          if (dir === 'left' && next === focus && focus % columns === 0) {
            side = 'mine';
            focus = Math.min(slotCount(world, local) - 1, focus + columns - 1);
          } else focus = next;
        }
        redraw();
        return true;
      }
      if (code === 'Space') {
        activate();
        return true;
      }
      if (code === 'Backspace' || code === 'KeyC') {
        if (held !== null && code === 'Backspace') {
          held = null;
          redraw();
        } else api.close();
        return true;
      }
      if (mode.kind === 'store') return true;
      if (code === 'KeyQ' || code === 'KeyE') {
        tab = (tab + (code === 'KeyE' ? 1 : TABS.length - 1)) % TABS.length;
        redraw();
        return true;
      }
      if (tab !== 0) return true;
      const chosen = focusedModel(world, local);
      if (chosen !== null) {
        if (code === 'Enter' && chosen.model.edible) send({ type: 'eat', from: chosen.ref });
        if (code === 'Enter' && !chosen.model.edible)
          equip(chosen.ref, chosen.model.item, world, local);
        if (code === 'KeyP') send({ type: 'drop', from: chosen.ref });
        if (code === 'KeyT') send({ type: 'give_stack', from: chosen.ref });
      }
      const step = shift ? UI_TUNING.chestBigStepCents : UI_TUNING.chestStepCents;
      if (code === 'KeyV') send({ type: 'chest_deposit', amount: step });
      if (code === 'KeyR') send({ type: 'chest_withdraw', amount: step });
      return true;
    },
    dispose() {
      layer.remove();
    },
  };
  return api;
}
