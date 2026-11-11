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
import { AGENDA_UI, agendaLineNode, type AgendaLine } from '../annonce';
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

/** Un acte d'une histoire (suite d'une `saga`): l'acte en cours est déplié, les autres tiennent sur une ligne. */
export interface SagaActModel {
  readonly id: string;
  readonly act: number;
  readonly title: string;
  readonly state: QuestLineRead['chapters'][number]['state'];
  /** Déplié: l'acte en cours (pas fini, et le premier à ne pas l'être). */
  readonly open: boolean;
  readonly step: string;
  readonly pearls: readonly QuestLineRead['chapters'][number]['state'][];
  readonly followed: boolean;
  readonly together: boolean;
}

export interface QuestCardModel {
  /** Une suite seule: son identifiant. Une histoire: celui de l'acte en cours (ou du dernier acte si tout est fini). */
  readonly id: string;
  /** Identifiants de toutes les suites de la carte (un seul pour une suite seule). */
  readonly ids: readonly string[];
  /** Les actes de l'histoire, dans l'ordre; `null`: suite seule. */
  readonly acts: readonly SagaActModel[] | null;
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
  /** L'histoire dont c'est un acte (titre et numéro), `null`: suite seule. */
  readonly saga: { readonly title: string; readonly act: number } | null;
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

/** Les suites d'une même histoire (ou une suite seule), actes par ordre croissant. */
interface QuestGroup {
  readonly lines: readonly QuestLineRead[];
  /** L'acte en cours: le premier qui n'est pas fini, sinon le dernier. */
  readonly lead: QuestLineRead;
  readonly finished: boolean;
}

function groupQuests(lines: readonly QuestLineRead[]): QuestGroup[] {
  const groups: QuestLineRead[][] = [];
  const bySaga = new Map<string, QuestLineRead[]>();
  for (const line of lines) {
    const saga = line.saga;
    if (saga === undefined) {
      groups.push([line]);
      continue;
    }
    const known = bySaga.get(saga.id);
    if (known === undefined) {
      const fresh = [line];
      bySaga.set(saga.id, fresh);
      groups.push(fresh);
    } else known.push(line);
  }
  return groups.flatMap((members) => {
    const sorted = [...members].sort((a, b) => (a.saga?.act ?? 0) - (b.saga?.act ?? 0));
    const lead = sorted.find((l) => !l.finished) ?? sorted.at(-1);
    return lead === undefined
      ? []
      : [{ lines: sorted, lead, finished: sorted.every((l) => l.finished) }];
  });
}

function card(group: QuestGroup, followed: string | null): QuestCardModel {
  const { lead } = group;
  const saga = lead.saga;
  const isFollowed = group.lines.some((l) => l.id === followed && !l.finished);
  if (saga === undefined || group.lines.length === 0)
    return {
      id: lead.id,
      ids: [lead.id],
      acts: null,
      kind: lead.kind,
      title: lead.title,
      pearls: lead.chapters.map((c) => c.state),
      finished: lead.finished,
      followed: isFollowed,
      together: lead.together,
      giver: lead.giver?.name ?? null,
    };
  const acts: SagaActModel[] = group.lines.map((l) => ({
    id: l.id,
    act: l.saga?.act ?? 0,
    title: l.title,
    state: l.finished ? 'done' : l === lead ? 'current' : 'todo',
    open: l === lead && !l.finished,
    step: l.step,
    pearls: l.chapters.map((c) => c.state),
    followed: l.id === followed && !l.finished,
    together: l.together && !l.finished,
  }));
  return {
    id: lead.id,
    ids: group.lines.map((l) => l.id),
    acts,
    kind: lead.kind,
    title: saga.title,
    pearls: acts.map((a) => a.state),
    finished: group.finished,
    followed: isFollowed,
    together: lead.together && !lead.finished,
    giver: lead.giver?.name ?? null,
  };
}

/**
 * Les cartes dans l'ordre d'affichage: la principale (une histoire réunit ses actes en une carte),
 * puis les autres, en cours avant finies.
 */
function orderGroups(lines: readonly QuestLineRead[]): QuestGroup[] {
  const groups = groupQuests(lines);
  const mains = groups.filter((g) => g.lead.kind === 'main');
  const main = mains.find((g) => !g.finished) ?? mains[0];
  const rest = groups.filter((g) => g !== main);
  const active = rest.filter((g) => !g.finished);
  const done = rest.filter((g) => g.finished);
  return main === undefined ? [...active, ...done] : [main, ...active, ...done];
}

/** Les suites à plat, dans l'ordre d'affichage (les actes d'une histoire se suivent, du premier au dernier). */
export function orderQuests(lines: readonly QuestLineRead[]): readonly QuestLineRead[] {
  return orderGroups(lines).flatMap((g) => g.lines);
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
  const groups = orderGroups(lines);
  if (groups.length === 0)
    return {
      empty: true,
      main: null,
      others: [],
      page: 0,
      pageCount: 1,
      selected: null,
      detail: null,
    };
  const ordered = orderQuests(lines);
  const selected = ordered.find((l) => l.id === selection)?.id ?? defaultQuest(lines, followed);
  const first = groups[0];
  const hasMain = first?.lead.kind === 'main';
  const rest = hasMain ? groups.slice(1) : groups;
  const pageCount = Math.max(1, Math.ceil(rest.length / perPage));
  const at = rest.findIndex((g) => g.lines.some((l) => l.id === selected));
  const page = at < 0 ? 0 : Math.floor(at / perPage);
  const line = ordered.find((l) => l.id === selected);
  return {
    empty: false,
    main: hasMain ? card(first, followed) : null,
    others: rest.slice(page * perPage, (page + 1) * perPage).map((g) => card(g, followed)),
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
            saga: line.saga === undefined ? null : { title: line.saga.title, act: line.saga.act },
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
  const groups = orderGroups(lines);
  const hasMain = groups[0]?.lead.kind === 'main';
  const rest = hasMain ? groups.slice(1) : groups;
  const at = rest.findIndex((g) => g.lines.some((l) => l.id === selected));
  const page = at < 0 ? 0 : Math.floor(at / perPage);
  const next = page + delta;
  if (next < 0 || next * perPage >= rest.length) return null;
  return rest[next * perPage]?.lead.id ?? null;
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

function pearls(
  states: readonly QuestLineRead['chapters'][number]['state'][],
  template: string = T.chapter,
): HTMLElement {
  const wrap = el('div', { class: 'perles', role: 'img' });
  wrap.setAttribute(
    'aria-label',
    states
      .map((state, i) =>
        fill(template, { n: i + 1, max: states.length, etat: T.chapterState[state] }),
      )
      .join(' ; '),
  );
  for (const state of states) wrap.append(el('i', { class: `perle perle--${state}` }));
  return wrap;
}

/**
 * Une histoire en plusieurs actes, réunis en une carte: l'en-tête (titre, un perle par acte), puis
 * une ligne par acte. L'acte en cours est déplié (titre, chapitres, étape en une phrase), les
 * autres tiennent sur une ligne. Chaque acte se choisit (le détail suit à droite).
 */
function sagaNode(
  model: QuestCardModel,
  selected: string | null,
  big: boolean,
  onPick: (id: string) => void,
): HTMLElement {
  const acts = model.acts ?? [];
  const art = el('div', { class: 'saga__art' });
  // Vignette stable: tirée du premier acte, elle ne change pas quand l'histoire avance.
  art.insertAdjacentHTML('beforeend', itemThumb(model.ids[0] ?? model.id, model.title));
  const head = el('div', { class: 'saga__tete' }, [
    art,
    el('div', { class: 'quete__corps' }, [
      el('b', { class: 'quete__titre', text: model.title }),
      pearls(model.pearls, T.act),
    ]),
  ]);
  if (model.followed)
    head.append(el('span', { class: 'ruban', title: T.followed }, [icon('losange')]));
  if (model.finished) head.append(el('span', { class: 'tampon', text: T.done }));
  const list = el('div', { class: 'saga__actes' });
  for (const act of acts) {
    const row = el(
      'button',
      {
        class: `acte acte--${act.open ? 'ouvert' : act.state}${act.id === selected ? ' focus' : ''}`,
        tabindex: '-1',
        'aria-pressed': act.id === selected ? 'true' : 'false',
        'aria-expanded': act.open ? 'true' : 'false',
        'aria-label': `${fill(T.actNumber, { n: act.act })}, ${act.title}, ${T.chapterState[act.state]}`,
      },
      [
        el('span', { class: 'acte__ligne' }, [
          el('span', { class: 'acte__num', text: fill(T.actNumber, { n: act.act }) }),
          el('b', { class: 'acte__titre', text: act.title }),
          act.state === 'done' ? el('span', { class: 'acte__fait', text: T.actDone }) : null,
          act.followed
            ? el('span', { class: 'ruban ruban--acte', title: T.followed }, [icon('losange')])
            : null,
        ]),
        act.open
          ? el('span', { class: 'acte__corps' }, [
              pearls(act.pearls),
              el('span', { class: 'acte__etape', text: act.step }),
              act.together
                ? el('span', { class: 'deux-ligne' }, [
                    el('i', { class: 'token' }),
                    el('i', { class: 'token token--other' }),
                    T.together,
                  ])
                : null,
            ])
          : null,
      ],
    );
    row.addEventListener('click', () => {
      onPick(act.id);
    });
    list.append(row);
  }
  return el(
    'div',
    {
      class: `saga${big ? ' saga--grande' : ''}${model.finished ? ' saga--finie' : ''}`,
      role: 'group',
      'aria-label': fill(T.sagaLabel, { titre: model.title }),
    },
    [head, list],
  );
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
      pearls(model.pearls),
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

/** Rappel d'une décision à deux ouverte (`interface/rappel-decision.ts`), en tête de l'onglet. */
export interface QuestReminder {
  readonly quest: string;
  readonly head: string;
  readonly body: string;
  readonly split: boolean;
}

function reminderNode(r: QuestReminder): HTMLElement {
  return el(
    'div',
    {
      class: `decision-rappel decision-rappel--carnet${r.split ? ' decision-rappel--desaccord' : ''}`,
      role: 'note',
    },
    [
      icon('info'),
      el('div', {}, [
        el('b', { class: 'decision-rappel__titre', text: r.head }),
        el('span', { class: 'decision-rappel__texte', text: r.body }),
      ]),
    ],
  );
}

export function createQuestsTab(
  deps: TabDeps,
  lines: (world: ReadonlyWorld, local: PlayerIndex) => readonly QuestLineRead[],
  follow: FollowStore,
  reminders: (world: ReadonlyWorld, local: PlayerIndex) => readonly QuestReminder[] = () => [],
  /** Événements annoncés (`../annonce.ts`): une ligne en tête, jusqu'à la fin de l'événement. */
  agenda: (world: ReadonlyWorld) => readonly AgendaLine[] = () => [],
): Tab {
  let selected: string | null = null;
  const current = (world: ReadonlyWorld, local: PlayerIndex): QuestsModel =>
    questsModel(lines(world, local), follow.get(), selected);

  return {
    render(world, local) {
      const all = lines(world, local);
      const model = questsModel(all, follow.get(), selected);
      const left: (HTMLElement | null)[] = [
        ...agenda(world)
          .slice(0, AGENDA_UI.maxLines)
          .map((line) => agendaLineNode(line, 'carnet')),
        ...reminders(world, local).map(reminderNode),
      ];
      if (model.empty) {
        const none = el('div', { class: 'vide' }, [
          icon('plume', 'ic vide__ic'),
          el('h2', { text: T.none }),
          el('p', { text: T.noneHint }),
        ]);
        return { left: [...left, none], right: [null], full: false };
      }
      const pick = (id: string) => () => {
        selected = id;
        deps.invalidate();
      };
      const draw = (c: QuestCardModel, big: boolean): HTMLElement =>
        c.acts === null
          ? cardNode(c, model.selected === c.id, big, pick(c.id))
          : sagaNode(c, model.selected, big, (id) => {
              pick(id)();
            });
      if (model.main !== null) left.push(draw(model.main, true));
      const others = el('div', { class: 'quetes' });
      for (const c of model.others) others.append(draw(c, false));
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
            d.saga === null
              ? null
              : el('p', {
                  class: 'detail__saga',
                  text: fill(T.sagaAct, { titre: d.saga.title, n: d.saga.act }),
                }),
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
      return JSON.stringify([
        lines(world, local),
        reminders(world, local),
        agenda(world).map((l) => l.sentence),
        follow.get(),
        selected,
      ]);
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
