/**
 * Onglet Collections (interface.md, 5.3): huit familles en signets internes, chacune avec son
 * compteur, une grille de 6 colonnes (non trouvé: silhouette en pointillé), et la fiche de l'entrée
 * choisie avec les conditions découvertes (moment, météo, saison, lieu). Communes aux deux joueurs.
 */
import type { PlayerIndex } from '../../donnees/schemas/communs';
import type { ReadonlyWorld } from '../../etat/monde';
import { el } from '../dom';
import { gridMove, shortName } from '../modeles';
import { itemThumb } from '../pictos';
import { fill } from '../textes';
import { CARNET_TUNING } from './parametres';
import {
  COLLECTION_FAMILIES,
  type CollectionEntryRead,
  type CollectionFamily,
  type CollectionRead,
} from './lectures';
import { DIRECTION_KEYS, type Tab, type TabDeps } from './onglet';
import { CARNET_TEXTS } from './textes';

const T = CARNET_TEXTS.collections;

export interface FamilyModel {
  readonly family: CollectionFamily;
  readonly label: string;
  readonly found: number;
  readonly total: number;
  readonly counter: string;
  readonly complete: boolean;
}

export interface EntryCellModel {
  readonly id: string;
  /** Identifiant de la vignette (le plat d'une recette). */
  readonly thumb: string;
  readonly found: boolean;
  /** `null` tant que l'entrée n'est pas trouvée (silhouette). */
  readonly name: string | null;
  readonly rarity: 1 | 2 | 3;
}

export interface EntryDetailModel {
  readonly id: string;
  readonly thumb: string;
  readonly found: boolean;
  readonly name: string | null;
  readonly rarity: string;
  /** Les lignes de conditions : libellé, valeur (« ? » si pas encore su). */
  readonly clues: readonly {
    readonly label: string;
    readonly value: string;
    readonly known: boolean;
  }[];
  readonly firstBy: { readonly kind: 'player' | 'duo'; readonly index: 0 | 1 | null } | null;
  readonly canListen: boolean;
}

export interface CollectionsModel {
  readonly families: readonly FamilyModel[];
  readonly familyIndex: number;
  readonly cells: readonly EntryCellModel[];
  readonly selected: number;
  readonly detail: EntryDetailModel | null;
}

function clueList(
  values: readonly string[] | null,
  names: Readonly<Record<string, string>>,
): { value: string; known: boolean } {
  if (values === null || values.length === 0) return { value: T.unknownClue, known: false };
  return { value: values.map((v) => names[v] ?? v).join(', '), known: true };
}

function detailOf(entry: CollectionEntryRead, family: CollectionFamily): EntryDetailModel {
  const moments = clueList(entry.clues.moments, T.moments);
  const weathers = clueList(entry.clues.weathers, T.weathers);
  const seasons = clueList(entry.clues.seasons, T.seasons);
  return {
    id: entry.id,
    thumb: entry.thumb ?? entry.id,
    found: entry.found,
    name: entry.found ? shortName(entry.name) : null,
    rarity: entry.found ? T.rarity[entry.rarity] : '',
    clues: [
      { label: T.when, ...moments },
      { label: T.weather, ...weathers },
      { label: T.season, ...seasons },
      {
        label: T.place,
        value: entry.clues.where ?? T.unknownClue,
        known: entry.clues.where !== null,
      },
    ],
    firstBy:
      entry.firstBy === null
        ? null
        : entry.firstBy === 'duo'
          ? { kind: 'duo', index: null }
          : { kind: 'player', index: entry.firstBy },
    canListen: family === 'music' && entry.found,
  };
}

export function collectionsModel(
  read: readonly CollectionRead[],
  familyIndex: number,
  selected: number,
): CollectionsModel {
  const families = COLLECTION_FAMILIES.map((family) => {
    const entries = read.find((c) => c.family === family)?.entries ?? [];
    const found = entries.filter((e) => e.found).length;
    return {
      family,
      label: T.families[family],
      found,
      total: entries.length,
      counter: fill(T.counter, { n: found, max: entries.length }),
      complete: entries.length > 0 && found === entries.length,
    };
  });
  const index = Math.max(0, Math.min(families.length - 1, familyIndex));
  const family = COLLECTION_FAMILIES[index] ?? 'fish';
  const entries = read.find((c) => c.family === family)?.entries ?? [];
  const at = Math.max(0, Math.min(entries.length - 1, selected));
  const chosen = entries[at];
  return {
    families,
    familyIndex: index,
    cells: entries.map((e) => ({
      id: e.id,
      thumb: e.thumb ?? e.id,
      found: e.found,
      name: e.found ? shortName(e.name) : null,
      rarity: e.rarity,
    })),
    selected: at,
    detail: chosen === undefined ? null : detailOf(chosen, family),
  };
}

export function moveEntry(
  count: number,
  selected: number,
  dir: 'left' | 'right' | 'up' | 'down',
  columns: number = CARNET_TUNING.collectionColumns,
): number {
  return gridMove(selected, count, columns, dir);
}

// ---------- Affichage ----------

const F =
  'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';
const FAMILY_PICTOS: Readonly<Record<CollectionFamily, string>> = {
  fish: `<g ${F}><path d="M3 12c4-6 11-6 15 0-4 6-11 6-15 0z"/><path d="M18 12l4-4v8z"/><circle cx="8" cy="11" r=".6"/></g>`,
  insects: `<g ${F}><ellipse cx="12" cy="14" rx="3" ry="5"/><path d="M12 9V6M9 4l3 2 3-2M9 12l-5-3M9 15l-5 1M15 12l5-3M15 15l5 1"/></g>`,
  fossils: `<g ${F}><path d="M12 12m-1.5 0a1.5 1.5 0 1 1 3 0 3 3 0 1 1-6 0 5 5 0 1 1 10 0 7 7 0 1 1-14 0"/></g>`,
  flowers: `<g ${F}><circle cx="12" cy="10" r="2"/><path d="M12 8a3 3 0 1 0-3-3M12 8a3 3 0 1 1 3-3M10 10a3 3 0 1 0-4 3M14 10a3 3 0 1 1 4 3M12 12v9M12 17c-2-3-4-3-5-2"/></g>`,
  outfits: `<path ${F} d="M8 3l4 2 4-2 5 4-3 3-2-1v11H8V9l-2 1-3-3z"/>`,
  recipes: `<g ${F}><path d="M3 11h18a9 9 0 0 1-18 0z"/><path d="M9 7c0-2 2-2 2-4M14 7c0-2 2-2 2-4"/></g>`,
  postcards: `<g ${F}><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M14 9h4v4h-4zM6 10h5M6 14h5"/></g>`,
  music: `<g ${F}><path d="M9 18V5l11-2v13"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="17.5" cy="16" r="2.5"/></g>`,
};

/** Case non trouvée : forme grise en pointillé, jamais dite par la seule couleur. */
function silhouette(): string {
  return '<svg class="obj" viewBox="0 0 48 48" aria-hidden="true"><rect x="5" y="5" width="38" height="38" rx="12" fill="#d9ccab" stroke="#8a6a43" stroke-width="2.5" stroke-dasharray="4 3"/></svg>';
}

export function familyIcon(family: CollectionFamily, className = 'ic'): SVGSVGElement {
  const wrap = document.createElement('span');
  wrap.innerHTML = `<svg class="${className}" viewBox="0 0 24 24" aria-hidden="true">${FAMILY_PICTOS[family]}</svg>`;
  return wrap.firstElementChild as SVGSVGElement;
}

export function createCollectionsTab(
  deps: TabDeps,
  read: (world: ReadonlyWorld, local: PlayerIndex) => readonly CollectionRead[],
  names: (index: 0 | 1, world: ReadonlyWorld) => string,
): Tab {
  let familyIndex = 0;
  let selected = 0;

  return {
    render(world, local) {
      const model = collectionsModel(read(world, local), familyIndex, selected);
      const tabs = el('div', { class: 'familles', role: 'tablist' });
      model.families.forEach((f, i) => {
        const node = el(
          'button',
          {
            class: `famille${i === model.familyIndex ? ' famille--ouverte' : ''}${f.complete ? ' famille--complete' : ''}`,
            role: 'tab',
            tabindex: '-1',
            'aria-selected': i === model.familyIndex ? 'true' : 'false',
            'aria-label': `${f.label}, ${f.counter}`,
          },
          [el('span', { class: 'famille__pastille pastille', text: f.counter })],
        );
        node.prepend(familyIcon(f.family, 'ic famille__ic'));
        node.append(el('span', { class: 'nametag', text: f.label }));
        node.addEventListener('click', () => {
          familyIndex = i;
          selected = 0;
          deps.invalidate();
        });
        tabs.append(node);
      });
      const grid = el('div', { class: 'cases', role: 'grid' });
      model.cells.forEach((c, i) => {
        const node = el('button', {
          class: `case${c.found ? ` case--r${c.rarity}` : ' case--vide'}${i === model.selected ? ' focus' : ''}`,
          tabindex: '-1',
          'aria-label': c.name ?? T.unfound,
        });
        if (c.found && c.name !== null) {
          node.insertAdjacentHTML('beforeend', itemThumb(c.thumb, c.name));
          node.append(el('span', { class: 'nametag', text: c.name }));
        } else node.insertAdjacentHTML('beforeend', silhouette());
        node.addEventListener('click', () => {
          selected = i;
          deps.invalidate();
        });
        grid.append(node);
      });
      const current = model.families[model.familyIndex];
      const stamp =
        current?.complete === true
          ? el('span', { class: 'tampon tampon--or', text: T.complete })
          : null;
      const left = [
        el('h2', { class: 'page__title' }, [
          current?.label ?? '',
          ' ',
          el('span', { class: 'compteur', text: current?.counter ?? '' }),
          stamp,
        ]),
        tabs,
        grid,
      ];
      const d = model.detail;
      const right: (HTMLElement | null)[] = [];
      if (d !== null) {
        const big = el('div', { class: `v3d${d.found ? '' : ' v3d--vide'}` });
        big.insertAdjacentHTML(
          'beforeend',
          d.found && d.name !== null ? itemThumb(d.thumb, d.name) : silhouette(),
        );
        const clues = el('dl', { class: 'indices' });
        for (const c of d.clues)
          clues.append(
            el('dt', { text: c.label }),
            el('dd', { class: c.known ? '' : 'inconnu', text: c.value }),
          );
        const page = el('div', { class: 'detail detail--collection' }, [
          big,
          el('h2', { text: d.name ?? T.unfound }),
          ...(d.rarity === '' ? [] : [el('p', { text: d.rarity })]),
          clues,
        ]);
        if (d.firstBy !== null) {
          const who =
            d.firstBy.kind === 'duo'
              ? T.firstByDuo
              : fill(T.firstBy, { nom: names(d.firstBy.index ?? 0, world) });
          page.append(
            el('p', { class: 'premier' }, [
              d.firstBy.kind === 'duo'
                ? null
                : el('i', { class: `token${d.firstBy.index === 1 ? ' token--other' : ''}` }),
              who,
            ]),
          );
        }
        if (d.canListen)
          page.append(el('button', { class: 'btn btn--primary', tabindex: '-1', text: T.listen }));
        right.push(page);
      }
      return { left, right, full: false };
    },
    signature(world, local) {
      return JSON.stringify([read(world, local), familyIndex, selected]);
    },
    key(code, shift, world, local) {
      const model = collectionsModel(read(world, local), familyIndex, selected);
      const dir = DIRECTION_KEYS[code];
      if (dir !== undefined) {
        selected = moveEntry(model.cells.length, model.selected, dir);
        deps.invalidate();
        return true;
      }
      if (code === 'Tab') {
        const count = COLLECTION_FAMILIES.length;
        familyIndex = (model.familyIndex + (shift ? count - 1 : 1)) % count;
        selected = 0;
        deps.invalidate();
        return true;
      }
      return false;
    },
    hints() {
      return [
        { codes: ['KeyW', 'KeyA', 'KeyS', 'KeyD'], label: CARNET_TEXTS.villagers.keys },
        { codes: ['Tab'], label: T.familyKeys },
      ];
    },
    closed() {
      selected = 0;
    },
  };
}
