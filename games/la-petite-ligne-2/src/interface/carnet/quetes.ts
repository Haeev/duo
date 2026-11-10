/**
 * Onglet Quêtes (interface.md, 5.3): une carte par suite (image, titre, perles des chapitres),
 * l'étape courante en une phrase à droite et un bouton « Suivre ». Une seule suite est suivie par
 * joueur (cahier 4.10): c'est celle que montre la touche G. Le suivi est propre à chacun; tant
 * que la simulation n'a pas d'intention pour le dire, il est tenu ici (`FollowStore`).
 */
import type { PlayerIndex } from '../../donnees/schemas/communs';
import type { ReadonlyWorld } from '../../etat/monde';
import { el, icon } from '../dom';
import { itemThumb } from '../pictos';
import { fill } from '../textes';
import { CARNET_TUNING } from './parametres';
import type { QuestLineRead } from './lectures';
import { DIRECTION_KEYS, type Tab, type TabDeps } from './onglet';
import { CARNET_TEXTS } from './textes';

const T = CARNET_TEXTS.quests;

/** Suite suivie par le joueur local: lue par le coup d'œil (G) et la carte. */
export interface FollowStore {
  get(): string | null;
  set(id: string | null): void;
}

export function memoryFollow(initial: string | null = null): FollowStore {
  let current = initial;
  return {
    get: () => current,
    set(id) {
      current = id;
    },
  };
}

export interface QuestCardModel {
  readonly id: string;
  readonly kind: QuestLineRead['kind'];
  readonly title: string;
  readonly pearls: readonly QuestLineRead['chapters'][number]['state'][];
  readonly finished: boolean;
  readonly followed: boolean;
  readonly together: boolean;
  readonly giver: string | null;
}

export interface QuestDetailModel {
  readonly id: string;
  readonly title: string;
  /** L'étape en une phrase; histoire finie: la phrase de clôture. */
  readonly step: string;
  readonly finished: boolean;
  readonly together: boolean;
  readonly followed: boolean;
  readonly canFollow: boolean;
  readonly hasTarget: boolean;
}

export interface QuestsModel {
  /** Aucune suite commencée: « Va parler aux habitants ». */
  readonly empty: boolean;
  readonly main: QuestCardModel | null;
  /** Les secondaires de la page courante. */
  readonly others: readonly QuestCardModel[];
  readonly page: number;
  readonly pageCount: number;
  readonly selected: string | null;
  readonly detail: QuestDetailModel | null;
}

function card(line: QuestLineRead, followed: string | null): QuestCardModel {
  return {
    id: line.id,
    kind: line.kind,
    title: line.title,
    pearls: line.chapters.map((c) => c.state),
    finished: line.finished,
    followed: line.id === followed && !line.finished,
    together: line.together,
    giver: line.giver?.name ?? null,
  };
}

/** Les suites dans l'ordre d'affichage: la principale, puis les autres (en cours avant finies). */
export function orderQuests(lines: readonly QuestLineRead[]): readonly QuestLineRead[] {
  const mains = lines.filter((l) => l.kind === 'main');
  const main = mains.find((l) => !l.finished) ?? mains[0];
  const rest = lines.filter((l) => l !== main);
  const active = rest.filter((l) => !l.finished);
  const done = rest.filter((l) => l.finished);
  return main === undefined ? [...active, ...done] : [main, ...active, ...done];
}

/** Choix initial: la suite suivie, sinon la première en cours, sinon la première. */
export function defaultQuest(
  lines: readonly QuestLineRead[],
  followed: string | null,
): string | null {
  const ordered = orderQuests(lines);
  return (
    ordered.find((l) => l.id === followed && !l.finished)?.id ??
    ordered.find((l) => !l.finished)?.id ??
    ordered[0]?.id ??
    null
  );
}

export function questsModel(
  lines: readonly QuestLineRead[],
  followed: string | null,
  selection: string | null,
  perPage: number = CARNET_TUNING.secondaryPerPage,
): QuestsModel {
  const ordered = orderQuests(lines);
  if (ordered.length === 0)
    return {
      empty: true,
      main: null,
      others: [],
      page: 0,
      pageCount: 1,
      selected: null,
      detail: null,
    };
  const selected = ordered.find((l) => l.id === selection)?.id ?? defaultQuest(lines, followed);
  const first = ordered[0];
  const hasMain = first?.kind === 'main';
  const rest = hasMain ? ordered.slice(1) : ordered;
  const pageCount = Math.max(1, Math.ceil(rest.length / perPage));
  const at = rest.findIndex((l) => l.id === selected);
  const page = at < 0 ? 0 : Math.floor(at / perPage);
  const line = ordered.find((l) => l.id === selected);
  return {
    empty: false,
    main: hasMain ? card(first, followed) : null,
    others: rest.slice(page * perPage, (page + 1) * perPage).map((l) => card(l, followed)),
    page,
    pageCount,
    selected: selected ?? null,
    detail:
      line === undefined
        ? null
        : {
            id: line.id,
            title: line.title,
            step: line.finished ? T.doneStep : line.step,
            finished: line.finished,
            together: line.together,
            followed: line.id === followed && !line.finished,
            canFollow: !line.finished,
            hasTarget: line.target !== null,
          },
  };
}

/** Voisine dans l'ordre d'affichage; reste sur place au bord. */
export function moveQuest(
  lines: readonly QuestLineRead[],
  selected: string | null,
  delta: number,
): string | null {
  const ordered = orderQuests(lines);
  const at = ordered.findIndex((l) => l.id === selected);
  if (at < 0) return ordered[0]?.id ?? null;
  return ordered[Math.max(0, Math.min(ordered.length - 1, at + delta))]?.id ?? selected;
}

/** A et E : première suite de la page voisine, `null` s'il n'y en a pas (le carnet change alors d'onglet). */
export function turnQuestPage(
  lines: readonly QuestLineRead[],
  selected: string | null,
  delta: -1 | 1,
  perPage: number = CARNET_TUNING.secondaryPerPage,
): string | null {
  const ordered = orderQuests(lines);
  const hasMain = ordered[0]?.kind === 'main';
  const rest = hasMain ? ordered.slice(1) : ordered;
  const at = rest.findIndex((l) => l.id === selected);
  const page = at < 0 ? 0 : Math.floor(at / perPage);
  const next = page + delta;
  if (next < 0 || next * perPage >= rest.length) return null;
  return rest[next * perPage]?.id ?? null;
}

/** Une seule suite suivie: suivre la suivie la lâche, une autre prend la place, une finie ne se suit pas. */
export function toggleFollow(
  lines: readonly QuestLineRead[],
  followed: string | null,
  id: string,
): string | null {
  const line = lines.find((l) => l.id === id);
  if (line === undefined || line.finished) return followed;
  return followed === id ? null : id;
}

// ---------- Affichage ----------

function pearls(model: QuestCardModel): HTMLElement {
  const wrap = el('div', { class: 'perles', role: 'img' });
  wrap.setAttribute(
    'aria-label',
    model.pearls
      .map((state, i) =>
        fill(T.chapter, { n: i + 1, max: model.pearls.length, etat: T.chapterState[state] }),
      )
      .join(' ; '),
  );
  for (const state of model.pearls) wrap.append(el('i', { class: `perle perle--${state}` }));
  return wrap;
}

function cardNode(
  model: QuestCardModel,
  focused: boolean,
  big: boolean,
  onPick: () => void,
): HTMLElement {
  const node = el(
    'button',
    {
      class: `quete${big ? ' quete--grande' : ''}${focused ? ' focus' : ''}${model.finished ? ' quete--finie' : ''}`,
      tabindex: '-1',
      'aria-label': `${T.kinds[model.kind]} : ${model.title}`,
      'aria-pressed': focused ? 'true' : 'false',
    },
    [],
  );
  const art = el('div', { class: 'quete__art' });
  art.insertAdjacentHTML('beforeend', itemThumb(model.id, model.title));
  node.append(
    art,
    el('div', { class: 'quete__corps' }, [
      el('b', { class: 'quete__titre', text: model.title }),
      pearls(model),
    ]),
  );
  if (model.followed)
    node.append(el('span', { class: 'ruban', title: T.followed }, [icon('losange')]));
  if (model.finished) node.append(el('span', { class: 'tampon', text: T.done }));
  if (model.together && !model.finished)
    node.append(
      el('span', { class: 'deux', title: T.together }, [
        el('i', { class: 'token' }),
        el('i', { class: 'token token--other' }),
      ]),
    );
  node.addEventListener('click', onPick);
  return node;
}

export function createQuestsTab(
  deps: TabDeps,
  lines: (world: ReadonlyWorld, local: PlayerIndex) => readonly QuestLineRead[],
  follow: FollowStore,
): Tab {
  let selected: string | null = null;
  const current = (world: ReadonlyWorld, local: PlayerIndex): QuestsModel =>
    questsModel(lines(world, local), follow.get(), selected);

  return {
    render(world, local) {
      const all = lines(world, local);
      const model = questsModel(all, follow.get(), selected);
      const left: (HTMLElement | null)[] = [];
      if (model.empty) {
        const none = el('div', { class: 'vide' }, [
          icon('plume', 'ic vide__ic'),
          el('h2', { text: T.none }),
          el('p', { text: T.noneHint }),
        ]);
        return { left: [none], right: [null], full: false };
      }
      const pick = (id: string) => () => {
        selected = id;
        deps.invalidate();
      };
      if (model.main !== null)
        left.push(
          cardNode(model.main, model.selected === model.main.id, true, pick(model.main.id)),
        );
      const others = el('div', { class: 'quetes' });
      for (const c of model.others)
        others.append(cardNode(c, model.selected === c.id, false, pick(c.id)));
      left.push(others);
      if (model.pageCount > 1)
        left.push(
          el('div', {
            class: 'pages',
            text: fill(T.page, { n: model.page + 1, max: model.pageCount }),
          }),
        );
      const d = model.detail;
      const right: (HTMLElement | null)[] = [];
      if (d !== null) {
        const art = el('div', { class: 'v3d quete__image' });
        art.insertAdjacentHTML('beforeend', itemThumb(d.id, d.title));
        const follow_ = el(
          'button',
          { class: `btn${d.followed ? '' : ' btn--primary'}`, tabindex: '-1' },
          [
            el('span', { class: 'key', text: deps.keyLabel('Enter') }),
            d.followed ? T.unfollow : T.follow,
          ],
        );
        follow_.disabled = !d.canFollow;
        follow_.addEventListener('click', () => {
          follow.set(toggleFollow(all, follow.get(), d.id));
          deps.invalidate();
        });
        right.push(
          el('div', { class: 'detail detail--quete' }, [
            art,
            el('h2', { text: d.title }),
            el('p', { class: 'etape', text: d.step }),
            d.together && !d.finished
              ? el('p', { class: 'deux-ligne' }, [
                  el('i', { class: 'token' }),
                  el('i', { class: 'token token--other' }),
                  T.togetherHint,
                ])
              : null,
            follow_,
          ]),
        );
      }
      return { left, right, full: false };
    },
    signature(world, local) {
      return JSON.stringify([lines(world, local), follow.get(), selected]);
    },
    key(code, _shift, world, local) {
      const all = lines(world, local);
      const dir = DIRECTION_KEYS[code];
      const model = current(world, local);
      if (dir === 'up' || dir === 'down') {
        selected = moveQuest(all, model.selected, dir === 'down' ? 1 : -1);
        deps.invalidate();
        return true;
      }
      if (code === 'Enter' && model.selected !== null) {
        follow.set(toggleFollow(all, follow.get(), model.selected));
        deps.invalidate();
        return true;
      }
      if (code === 'KeyQ' || code === 'KeyE') {
        const next = turnQuestPage(all, model.selected, code === 'KeyE' ? 1 : -1);
        if (next === null) return false;
        selected = next;
        deps.invalidate();
        return true;
      }
      return false;
    },
    hints() {
      return [
        { codes: ['KeyW', 'KeyS'], label: T.pickKeys },
        { codes: ['Enter'], label: T.followKeys },
      ];
    },
    closed() {
      selected = null;
    },
  };
}
