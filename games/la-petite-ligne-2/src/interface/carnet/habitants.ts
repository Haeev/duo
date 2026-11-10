/**
 * Onglet Habitants (interface.md, 5.3): grille de portraits (provisoires, générés depuis
 * l'identifiant), cœurs d'amitié par joueur, ce qu'on sait de chacun. Un habitant jamais rencontré
 * reste une silhouette en pointillé, sans nom. Les cœurs sont propres à chaque joueur; ceux de
 * l'autre joueur se lisent en petit.
 */
import type { PlayerIndex } from '../../donnees/schemas/communs';
import type { ReadonlyWorld } from '../../etat/monde';
import { el, icon } from '../dom';
import { gridMove, shortName } from '../modeles';
import { itemThumb } from '../pictos';
import { portraitMarkup } from '../portrait';
import { fill, TEXTS } from '../textes';
import { CARNET_TUNING } from './parametres';
import type { TasteRead, VillagerRead } from './lectures';
import { DIRECTION_KEYS, type Tab, type TabDeps } from './onglet';
import { CARNET_TEXTS } from './textes';

const T = CARNET_TEXTS.villagers;

export type HeartState = 'full' | 'half' | 'empty';

/** Cinq cœurs depuis des demi-cœurs (0 à 10). */
export function heartRow(
  halves: number,
  hearts: number = CARNET_TUNING.heartsMax,
): readonly HeartState[] {
  return Array.from({ length: hearts }, (_, i) => {
    const left = halves - i * 2;
    return left >= 2 ? 'full' : left === 1 ? 'half' : 'empty';
  });
}

export interface VillagerCellModel {
  readonly id: string;
  readonly met: boolean;
  /** `null` tant qu'il n'est pas rencontré. */
  readonly name: string | null;
  readonly hearts: readonly HeartState[];
  readonly halves: number;
  /** Demi-cœurs gagnés depuis la dernière fois qu'on a fermé le carnet. */
  readonly gained: number;
  readonly something: VillagerRead['something'];
}

export interface VillagerDetailModel {
  readonly id: string;
  readonly met: boolean;
  readonly name: string | null;
  readonly craft: string | null;
  readonly halves: readonly [number, number];
  readonly hearts: readonly HeartState[];
  readonly otherHearts: readonly HeartState[];
  readonly likes: readonly TasteRead[];
  readonly dislikes: readonly TasteRead[];
  readonly where: VillagerRead['where'];
  readonly something: VillagerRead['something'];
}

export interface VillagersModel {
  readonly cells: readonly VillagerCellModel[];
  readonly selected: string | null;
  readonly detail: VillagerDetailModel | null;
  readonly metCount: number;
}

const TASTE_SLOTS = 3;

/** Complète à trois goûts: ceux qu'on a découverts, puis des « ? ». */
export function padTastes(tastes: readonly TasteRead[]): readonly TasteRead[] {
  const known = tastes.filter((t) => t.item !== null).slice(0, TASTE_SLOTS);
  return [
    ...known,
    ...Array.from({ length: TASTE_SLOTS - known.length }, () => ({ item: null, name: null })),
  ];
}

export function villagersModel(
  list: readonly VillagerRead[],
  seen: ReadonlyMap<string, number>,
  selection: string | null,
): VillagersModel {
  const cells = list.map((v) => ({
    id: v.id,
    met: v.met,
    name: v.met ? shortName(v.name) : null,
    hearts: heartRow(v.halves[0]),
    halves: v.halves[0],
    gained: v.met ? Math.max(0, v.halves[0] - (seen.get(v.id) ?? v.halves[0])) : 0,
    something: v.met ? v.something : null,
  }));
  const selected = list.find((v) => v.id === selection)?.id ?? list[0]?.id ?? null;
  const chosen = list.find((v) => v.id === selected);
  return {
    cells,
    selected,
    metCount: list.filter((v) => v.met).length,
    detail:
      chosen === undefined
        ? null
        : {
            id: chosen.id,
            met: chosen.met,
            name: chosen.met ? chosen.name : null,
            craft: chosen.met ? chosen.craft : null,
            halves: chosen.halves,
            hearts: heartRow(chosen.halves[0]),
            otherHearts: heartRow(chosen.halves[1]),
            likes: padTastes(chosen.met ? chosen.likes : []),
            dislikes: padTastes(chosen.met ? chosen.dislikes : []),
            where: chosen.met ? chosen.where : null,
            something: chosen.met ? chosen.something : null,
          },
  };
}

/** Voisin dans la grille de portraits. */
export function moveVillager(
  list: readonly VillagerRead[],
  selected: string | null,
  dir: 'left' | 'right' | 'up' | 'down',
  columns: number = CARNET_TUNING.villagerColumns,
): string | null {
  const at = list.findIndex((v) => v.id === selected);
  if (at < 0) return list[0]?.id ?? null;
  return list[gridMove(at, list.length, columns, dir)]?.id ?? selected;
}

// ---------- Affichage ----------

let heartIds = 0;
const HEART = 'M12 21s-8-5.2-8-11a4.6 4.6 0 0 1 8-3 4.6 4.6 0 0 1 8 3c0 5.8-8 11-8 11z';

/** Cœurs: plein = forme pleine, vide = contour, moitié = moitié gauche pleine. */
export function heartsNode(
  row: readonly HeartState[],
  className: string,
  label: string,
): HTMLElement {
  const wrap = el('span', { class: `coeurs ${className}`, role: 'img', 'aria-label': label });
  for (const state of row) {
    heartIds += 1;
    const id = `lpl-demi-${heartIds}`;
    const fillPart =
      state === 'full'
        ? `<path d="${HEART}" fill="currentColor"/>`
        : state === 'half'
          ? `<clipPath id="${id}"><rect x="0" y="0" width="12" height="24"/></clipPath><path d="${HEART}" fill="currentColor" clip-path="url(#${id})"/>`
          : '';
    wrap.insertAdjacentHTML(
      'beforeend',
      `<svg class="coeur coeur--${state}" viewBox="0 0 24 24" aria-hidden="true">${fillPart}<path d="${HEART}" fill="none" stroke="#2a2522" stroke-width="2" stroke-linejoin="round"/></svg>`,
    );
  }
  return wrap;
}

function heartsLabel(halves: number): string {
  return fill(T.hearts, { n: halves / 2 });
}

function tasteNode(taste: TasteRead): HTMLElement {
  const node = el('span', {
    class: `gout${taste.item === null ? ' gout--inconnu' : ''}`,
    title: taste.name ?? T.tasteUnknown,
  });
  if (taste.item === null) node.textContent = '?';
  else node.insertAdjacentHTML('beforeend', itemThumb(taste.item, taste.name ?? taste.item));
  return node;
}

function bubbleNode(kind: NonNullable<VillagerRead['something']>): HTMLElement {
  const picto = kind === 'story' ? 'plume' : kind === 'request' ? 'info' : 'sac';
  return el('span', { class: 'bulle-coin', title: T.something[kind] }, [icon(picto)]);
}

export interface SharedTabState {
  /** Habitant à montrer sur la carte (bouton « Voir sur la carte »). */
  mapFocus: string | null;
}

export function createVillagersTab(
  deps: TabDeps,
  read: (world: ReadonlyWorld, local: PlayerIndex) => readonly VillagerRead[],
  shared: SharedTabState,
): Tab {
  let selected: string | null = null;
  /** Demi-cœurs vus à la dernière fermeture, pour faire battre ceux gagnés depuis. */
  const seen = new Map<string, number>();
  let seeded = false;

  function seed(list: readonly VillagerRead[]): void {
    if (seeded) return;
    seeded = true;
    // Première ouverture de la partie : rien n'est « nouveau ».
    for (const v of list) seen.set(v.id, v.halves[0]);
  }

  return {
    render(world, local) {
      const list = read(world, local);
      seed(list);
      const model = villagersModel(list, seen, selected);
      const grid = el('div', { class: 'portraits', role: 'grid' });
      if (model.metCount === 0 && list.length === 0)
        return {
          left: [
            el('div', { class: 'vide' }, [icon('gens', 'ic vide__ic'), el('h2', { text: T.none })]),
          ],
          right: [null],
          full: false,
        };
      for (const c of model.cells) {
        const focused = c.id === model.selected;
        const node = el('button', {
          class: `habitant${c.met ? '' : ' habitant--inconnu'}${focused ? ' focus' : ''}`,
          tabindex: '-1',
          'aria-label': c.met ? `${c.name ?? ''}, ${heartsLabel(c.halves)}` : T.unknown,
        });
        const face = el('div', { class: 'habitant__visage' });
        face.insertAdjacentHTML('beforeend', portraitMarkup(c.id));
        node.append(face);
        if (c.something !== null) node.append(bubbleNode(c.something));
        if (c.met) {
          const row = heartsNode(
            c.hearts,
            c.gained > 0 ? 'coeurs--gagne' : '',
            heartsLabel(c.halves),
          );
          node.append(row, el('span', { class: 'nametag', text: c.name }));
        } else node.append(el('span', { class: 'nametag', text: T.unknownName }));
        node.addEventListener('click', () => {
          selected = c.id;
          deps.invalidate();
        });
        grid.append(node);
      }
      const left = [
        el('h2', {
          class: 'page__title',
          text: `${TEXTS.notebook.tabs.villagers} ${fill(CARNET_TEXTS.collections.counter, { n: model.metCount, max: list.length })}`,
        }),
        grid,
      ];
      const d = model.detail;
      const right: (HTMLElement | null)[] = [];
      if (d !== null) {
        const bust = el('div', { class: `v3d buste${d.met ? '' : ' buste--inconnu'}` });
        bust.insertAdjacentHTML('beforeend', portraitMarkup(d.id));
        const page = el('div', { class: 'detail detail--habitant' }, [bust]);
        if (!d.met) {
          page.append(el('h2', { text: T.unknownName }), el('p', { text: T.unknown }));
        } else {
          page.append(
            el('h2', { text: d.name }),
            ...(d.craft === null
              ? []
              : [el('p', { class: 'metier', text: `${T.craft} : ${d.craft}` })]),
            heartsNode(d.hearts, 'coeurs--grand', heartsLabel(d.halves[0])),
            el('p', { class: 'amitie-autre' }, [
              el('i', { class: 'token token--other' }),
              heartsNode(d.otherHearts, 'coeurs--petit', heartsLabel(d.halves[1])),
            ]),
            el('div', { class: 'goutsligne' }, [
              el('b', { text: T.likes }),
              ...d.likes.map(tasteNode),
            ]),
            el('div', { class: 'goutsligne' }, [
              el('b', { text: T.dislikes }),
              ...d.dislikes.map(tasteNode),
            ]),
            el('p', { class: 'ou', text: `${T.where} : ${d.where?.label ?? T.whereUnknown}` }),
          );
          const goMap = el('button', { class: 'btn', tabindex: '-1', disabled: d.where === null }, [
            icon('carte'),
            T.seeOnMap,
          ]);
          goMap.addEventListener('click', () => {
            shared.mapFocus = d.id;
            deps.goto('map');
          });
          page.append(goMap);
        }
        right.push(page);
      }
      return { left, right, full: false };
    },
    signature(world, local) {
      return JSON.stringify([read(world, local), selected]);
    },
    key(code, _shift, world, local) {
      const list = read(world, local);
      const dir = DIRECTION_KEYS[code];
      if (dir !== undefined) {
        selected = moveVillager(list, selected ?? list[0]?.id ?? null, dir);
        deps.invalidate();
        return true;
      }
      if (code === 'Enter') {
        const chosen = list.find((v) => v.id === (selected ?? list[0]?.id));
        if (chosen !== undefined && chosen.where !== null) {
          shared.mapFocus = chosen.id;
          deps.goto('map');
        }
        return true;
      }
      return false;
    },
    hints() {
      return [
        { codes: ['KeyW', 'KeyA', 'KeyS', 'KeyD'], label: T.keys },
        { codes: ['Enter'], label: T.mapKeys },
      ];
    },
    closed(world, local) {
      for (const v of read(world, local)) seen.set(v.id, v.halves[0]);
      selected = null;
    },
  };
}
