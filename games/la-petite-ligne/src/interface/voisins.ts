/**
 * Onglet Voisins du carnet (0.13, lot H3; conception `v0-13-habitants.md`, section 4; règles de
 * l'interface imagée `interface-imagee-0-12-2.md`). Deux vues:
 * - les voisins: la vitrine des 21 portraits (silhouette avant la rencontre), chacun avec ses
 *   lanternes d'amitié et la pastille « maintenant » (le lieu où il est sans doute, en picto); la
 *   fiche de la sélection: métier en picto, logis, anniversaire, goûts en icônes, frise de sa
 *   journée (matin, midi, soir, nuit) avec un sélecteur de jour quand elle change d'un jour à
 *   l'autre, et « n sur N » habitudes;
 * - le bourg: une carte schématique où chacun est « sans doute » à cette heure-ci.
 * Entrée sur un portrait montre où il est sur la carte du bourg; Entrée sur un lieu de la carte
 * revient aux voisins sur le premier qu'on y trouve.
 */
import type { ReadonlyWorld } from '../etat/types';
import type { BondView } from '../etat/voisins';
import type { UiHost } from './composant';
import { UI_SETTINGS } from './config';
import { button, el, focusElement, icon, portrait, svgEl } from './dom';
import { fill } from './format';
import { infoIcon } from './icones';
import {
  type HabitToastModel,
  type NeighbourBoardModel,
  type NeighbourCardModel,
  type NeighbourPageModel,
  type TimelineSegmentModel,
  type TownModel,
  neighbourBoard,
  neighbourPage,
  timelineMoments,
  townModel,
} from './modele-voisins';
import { portraitSvg, silhouetteSvg, villagerColors } from './portrait';
import { SOUND_ATTR } from './sons';
import { type VitrineItem, Vitrine, pastille } from './vitrine';

/** Les lanternes d'amitié (section 6.3): allumées, la suivante remplie par quarts, dorées au dernier niveau. */
export function lanterns(
  bond: Pick<BondView, 'level' | 'quarters' | 'next'>,
  className = 'lpl-lanterns',
): SVGSVGElement {
  const svg = svgEl('svg', { class: className, viewBox: '0 0 60 15', 'aria-hidden': 'true' });
  const gold = bond.next === null;
  for (let i = 0; i < 5; i++) {
    const x = i * 12;
    const lit = i < bond.level || gold;
    const partial = !lit && i === bond.level ? bond.quarters / 4 : 0;
    const g = svgEl('g', {
      class: 'lpl-lantern',
      'data-lit': lit ? (gold ? 'gold' : 'true') : 'false',
    });
    g.append(svgEl('path', { d: `M${String(x + 6)} 0.8v1.4`, class: 'lpl-lantern__hook' }));
    g.append(
      svgEl('path', {
        d: `M${String(x + 2.2)} 3.6l1.2-1.4h4.8l1.2 1.4z`,
        class: 'lpl-lantern__cap',
      }),
    );
    g.append(
      svgEl('rect', {
        x: String(x + 2.2),
        y: '3.6',
        width: '7.6',
        height: '8.2',
        rx: '1.8',
        class: 'lpl-lantern__glass',
      }),
    );
    if (partial > 0) {
      const h = 6.6 * partial;
      g.append(
        svgEl('rect', {
          x: String(x + 3),
          y: String(4.4 + 6.6 - h),
          width: '6',
          height: String(h),
          rx: '1',
          class: 'lpl-lantern__fill',
        }),
      );
    }
    if (lit)
      g.append(
        svgEl('path', {
          d: `M${String(x + 6)} 5.4c1.3 1.4 1.3 3 0 4-1.3-1-1.3-2.6 0-4z`,
          class: 'lpl-lantern__flame',
        }),
      );
    g.append(
      svgEl('rect', {
        x: String(x + 1.6),
        y: '11.8',
        width: '8.8',
        height: '1.8',
        rx: '0.6',
        class: 'lpl-lantern__base',
      }),
    );
    svg.append(g);
  }
  return svg;
}

function portraitOf(id: string, met: boolean, size: '' | 'small' | 'large'): HTMLSpanElement {
  const colors = met ? villagerColors(id) : null;
  return portrait(colors === null ? silhouetteSvg() : portraitSvg(colors, 'good', '', id), size);
}

/**
 * Carte de notification d'une découverte (section 4.3): le portrait, le crayon et le prénom, la
 * source en petit (« vu par Camille »), la ligne du carnet, le picto du lieu; les lanternes au
 * passage d'un niveau; l'horloge quand toutes ses habitudes sont connues. Même pile, même durée et
 * même sortie que les autres notifications du HUD (`lpl-toast`).
 */
export function habitToastItem(t: HabitToastModel, sort: string): HTMLLIElement {
  const colors = villagerColors(t.villager);
  const expression =
    t.kind === 'bond' || t.kind === 'all'
      ? 'great'
      : t.kind === 'taste' && t.mark === 'taste-dislike'
        ? 'ok'
        : 'good';
  const face = portrait(
    colors === null ? silhouetteSvg() : portraitSvg(colors, expression, '', t.villager),
    'small',
  );
  const trailing =
    t.kind === 'bond' && t.level !== null
      ? lanterns(
          { level: t.level, quarters: 0, next: t.level >= 5 ? null : 1 },
          'lpl-lanterns lpl-toast-card__lanterns',
        )
      : t.kind === 'all'
        ? icon('wall-clock', 'lpl-icon lpl-toast-card__place')
        : t.placeIcon === null
          ? null
          : icon(t.placeIcon, 'lpl-icon lpl-toast-card__place');
  return el(
    'li',
    { class: 'lpl-toast lpl-toast--carnet', 'data-kind': sort, 'data-card': t.kind },
    [
      face,
      el('span', { class: 'lpl-toast-card__body' }, [
        el('span', { class: 'lpl-toast-card__head' }, [
          icon(t.mark, 'lpl-icon lpl-toast-card__pencil'),
          el('strong', { text: t.name }),
          t.source === '' ? null : el('span', { class: 'lpl-toast-card__source', text: t.source }),
        ]),
        el('span', { class: 'lpl-toast-card__text', text: t.text }),
      ]),
      trailing,
    ],
  );
}

type View = 'grid' | 'town';

export class NeighboursPage {
  private readonly host: UiHost;
  private readonly vitrine: Vitrine;
  private view: View = 'grid';
  /** Jour et temps de la frise, pour l'habitant choisi (oubliés quand on en choisit un autre). */
  private choice: { villager: string | null; offset: number; weather: 'sunny' | 'rain' | null } = {
    villager: null,
    offset: 0,
    weather: null,
  };
  /** Habitant dont la carte du bourg montre le lieu (Entrée sur un portrait). */
  private highlight: string | null = null;
  /** Le prochain rendu met le focus sur ce `data-key`. */
  private focusKey: string | null = null;
  private lastWorld: ReadonlyWorld | null = null;
  /** Vignette à choisir au retour du bourg (Entrée sur un lieu), lue par `gridNodes`. */
  private pendingSelect: string | null = null;

  constructor(host: UiHost) {
    this.host = host;
    const n = host.ctx.texts.extra.neighbours;
    this.vitrine = new Vitrine(host, {
      perPage: UI_SETTINGS.vitrine.neighboursPerPage,
      label: host.ctx.t(n.gridLabel),
      variant: 'lpl-vitrine--neighbours',
    });
  }

  /** Une seule page: A et E passent toujours à l'onglet voisin. */
  turn(delta: number): boolean {
    return this.view === 'grid' && this.vitrine.turn(delta);
  }

  /** Signature du corps et sa construction (le carnet ne reconstruit que si elle change). */
  render(world: ReadonlyWorld): { sig: string; build: () => (Node | null)[] } {
    this.lastWorld = world;
    const { ctx } = this.host;
    const board = neighbourBoard(world, ctx);
    if (this.view === 'town') {
      const town = townModel(world, ctx);
      return {
        sig: JSON.stringify(['neighbours-town', board.met, board.town, town, this.highlight]),
        build: () => [this.strip(board), this.townNodes(town)],
      };
    }
    const key = this.pendingSelect ?? this.vitrine.selection;
    const selected = key === null ? board.focus : key.replace(/^villager:/, '');
    const page = selected === null ? null : this.pageFor(world, selected);
    return {
      sig: JSON.stringify(['neighbours', board, page, this.choice, this.vitrine.page]),
      build: () => [this.strip(board), this.gridNodes(board)],
    };
  }

  /** Après un rendu: le focus demandé par une action (changement de vue). */
  afterRender(): void {
    const key = this.focusKey;
    if (key === null) return;
    this.focusKey = null;
    window.requestAnimationFrame(() => {
      focusElement(
        document.querySelector<HTMLElement>(
          `.lpl-notebook .lpl-panel__body [data-key="${CSS.escape(key)}"]`,
        ),
      );
    });
  }

  private pageFor(world: ReadonlyWorld, villager: string): NeighbourPageModel | null {
    if (this.choice.villager !== villager) this.choice = { villager, offset: 0, weather: null };
    return neighbourPage(world, this.host.ctx, villager, this.choice);
  }

  private setView(view: View, focusKey: string | null): void {
    if (this.view === view) return;
    this.view = view;
    this.focusKey = focusKey;
    this.host.sound('ui-tab');
    this.host.invalidate();
  }

  /** La rangée du haut: les deux vues à presser, et le compte du bourg. */
  private strip(board: NeighbourBoardModel): HTMLElement {
    const { ctx } = this.host;
    const n = ctx.texts.extra.neighbours;
    const toggle = (view: View, iconId: string, text: string, label: string): HTMLButtonElement =>
      button(
        [
          icon(iconId, 'lpl-icon lpl-pastille__icon'),
          el('span', { class: 'lpl-pastille__text', text }),
        ],
        () => {
          this.setView(view, `view:${view}`);
        },
        {
          class: 'lpl-pastille lpl-pastille--count lpl-quest-filter',
          attrs: {
            'data-nav-item': true,
            'data-key': `view:${view}`,
            'aria-pressed': String(this.view === view),
            'aria-label': label,
            title: label,
            [SOUND_ATTR]: 'none',
          },
        },
      );
    const total = board.cards.length;
    return el(
      'div',
      {
        class: 'lpl-vitrine__strip lpl-neighbours__strip',
        role: 'group',
        'aria-label': ctx.t(n.pageLabel),
      },
      [
        toggle(
          'grid',
          'ui-neighbours',
          `${String(board.met)}/${String(total)}`,
          `${n.gridView}, ${ctx.t(n.metLabel, { met: board.met, total })}`,
        ),
        toggle('town', 'place-square', n.townView, ctx.t(n.townViewLabel)),
        pastille({
          icon: 'ui-notebook',
          text: `${String(board.town.known)}/${String(board.town.total)}`,
          tone: board.town.total > 0 && board.town.known === board.town.total ? 'ok' : 'info',
          label: ctx.t(n.townLabel, board.town),
        }),
      ],
    );
  }

  // -------------------------------------------------------------------------
  // Les voisins

  private gridNodes(board: NeighbourBoardModel): HTMLElement {
    const items = board.cards.map((c): VitrineItem => ({
      key: `villager:${c.id}`,
      tile: {
        icon: portraitOf(c.id, c.met, ''),
        name: c.name,
        label: c.label,
        badge:
          c.now.place === null
            ? { icon: null, text: '?', tone: 'info' }
            : { icon: c.now.place.icon, tone: 'info' },
        corner: c.birthdayToday ? 'birthday-cake' : c.allKnown ? 'ui-check' : null,
        state: c.met ? null : 'locked',
        below: lanterns(c.bond),
        className: 'lpl-tile--neighbour',
        attrs: {
          'data-met': c.met ? 'true' : 'false',
          'data-now': c.now.place === null ? 'unknown' : c.now.place.place,
        },
      },
      detail: () => this.detail(c.id),
      act: () => this.showOnMap(c),
    }));
    const pending = this.pendingSelect;
    this.pendingSelect = null;
    return el('div', { class: 'lpl-neighbours' }, [
      this.vitrine.build(
        items,
        pending ?? (board.focus === null ? null : `villager:${board.focus}`),
      ),
    ]);
  }

  /** Entrée sur un portrait: la carte du bourg, son lieu mis en avant (refusé s'il n'est nulle part au carnet). */
  private showOnMap(c: NeighbourCardModel): boolean {
    if (c.now.place === null) return false;
    this.highlight = c.id;
    this.setView('town', `spot:${c.now.place.place}`);
    return true;
  }

  private detail(villager: string): (Node | null)[] {
    const world = this.lastWorld;
    if (world === null) return [];
    const page = this.pageFor(world, villager);
    if (page === null) return [];
    const { ctx } = this.host;
    const n = ctx.texts.extra.neighbours;
    const head = el('div', { class: 'lpl-neighbour__head' }, [
      el('span', { class: 'lpl-neighbour__portrait' }, [
        portraitOf(page.id, page.met, 'large'),
        page.allKnown
          ? el(
              'span',
              {
                class: 'lpl-neighbour__stamp',
                role: 'img',
                'aria-label': n.allKnown,
                title: n.allKnown,
              },
              [icon('wall-clock')],
            )
          : null,
      ]),
      el('div', { class: 'lpl-neighbour__id' }, [
        el('h3', { class: 'lpl-detail__name', text: page.name }),
        el(
          'p',
          { class: 'lpl-neighbour__line', title: page.jobLabel === '' ? null : page.jobLabel },
          [
            page.jobIcon === null ? null : icon(page.jobIcon, 'lpl-icon lpl-neighbour__job'),
            el('span', { text: page.line }),
          ],
        ),
        page.home === null
          ? null
          : el('p', { class: 'lpl-neighbour__line lpl-neighbour__home', title: page.homeLabel }, [
              icon('ui-house', 'lpl-icon lpl-neighbour__job'),
              el('span', { text: page.home }),
            ]),
      ]),
    ]);
    const facts: (HTMLElement | null)[] = [
      page.met ? this.bondPastille(page) : null,
      page.birthday === null
        ? null
        : page.birthday.known && page.birthday.season !== null
          ? el(
              'span',
              {
                class: `lpl-pastille lpl-pastille--${page.birthday.today ? 'price' : 'info'} lpl-neighbour__birthday`,
                role: 'img',
                'aria-label': page.birthday.label,
                title: page.birthday.label,
              },
              [
                icon('birthday-cake', 'lpl-icon lpl-pastille__icon'),
                icon(infoIcon(page.birthday.season), 'lpl-icon lpl-pastille__icon'),
                el('span', {
                  class: 'lpl-pastille__text',
                  'aria-hidden': 'true',
                  text: String(page.birthday.day ?? ''),
                }),
              ],
            )
          : pastille({
              icon: 'birthday-cake',
              text: '?',
              tone: 'info',
              label: page.birthday.label,
            }),
      pastille({
        icon: 'ui-notebook',
        text: `${String(page.count.known)}/${String(page.count.total)}`,
        tone: page.allKnown ? 'ok' : 'count',
        label: page.countLabel,
      }),
    ];
    return [
      head,
      el('div', { class: 'lpl-detail__pastilles' }, facts),
      page.tastes.length === 0 ? null : this.tastes(page),
      this.dayPicker(page),
      this.frise(page),
    ];
  }

  private bondPastille(page: NeighbourPageModel): HTMLElement {
    const level = this.host.ctx.texts.messages[page.bond.levelKey] ?? '';
    return el(
      'span',
      {
        class: 'lpl-pastille lpl-pastille--count lpl-neighbour__bond',
        'data-level': String(page.bond.level),
        role: 'img',
        'aria-label': page.bondLabel,
        title: page.bondLabel,
      },
      [
        lanterns(page.bond, 'lpl-lanterns lpl-lanterns--large'),
        el('span', { class: 'lpl-pastille__text', 'aria-hidden': 'true', text: level }),
      ],
    );
  }

  private tastes(page: NeighbourPageModel): HTMLElement {
    const { ctx } = this.host;
    return el(
      'div',
      {
        class: 'lpl-neighbour__tastes',
        role: 'group',
        'aria-label': ctx.texts.extra.neighbours.tastesLabel,
      },
      page.tastes.map((g) =>
        el(
          'span',
          {
            class: 'lpl-taste',
            'data-taste': g.taste,
            role: 'img',
            'aria-label': g.label,
            title: g.label,
          },
          [
            icon(g.icon, 'lpl-icon lpl-taste__mark'),
            ...g.slots.map((s) =>
              s.item === null || s.icon === null
                ? el(
                    'span',
                    { class: 'lpl-taste__slot', 'data-known': 'false', 'aria-hidden': 'true' },
                    [el('span', { class: 'lpl-taste__unknown', text: '?' })],
                  )
                : el(
                    'span',
                    {
                      class: 'lpl-taste__slot',
                      'data-known': 'true',
                      'aria-hidden': 'true',
                      title: s.name,
                    },
                    [icon(s.icon, 'lpl-icon lpl-taste__icon')],
                  ),
            ),
          ],
        ),
      ),
    );
  }

  /** Le sélecteur de jour (pastilles) et la bascule du temps, s'il y a lieu. */
  private dayPicker(page: NeighbourPageModel): HTMLElement | null {
    if (page.days === null && !page.rainToggle) return null;
    const { ctx } = this.host;
    const n = ctx.texts.extra.neighbours;
    const days =
      page.days === null
        ? null
        : el(
            'div',
            { class: 'lpl-neighbour__days', role: 'group', 'aria-label': n.daysLabel },
            page.days.map((d) =>
              button(
                d.short,
                () => {
                  this.choose(page.id, { offset: d.offset }, `day:${String(d.offset)}`);
                },
                {
                  class: `lpl-day-chip${d.today ? ' lpl-day-chip--today' : ''}`,
                  attrs: {
                    'data-nav-item': true,
                    'data-key': `day:${String(d.offset)}`,
                    'aria-pressed': String(page.offset === d.offset),
                    'aria-label': d.label,
                    title: d.label,
                    [SOUND_ATTR]: 'none',
                  },
                },
              ),
            ),
          );
    const weather = !page.rainToggle
      ? null
      : el(
          'div',
          { class: 'lpl-neighbour__weather', role: 'group', 'aria-label': n.weatherLabel },
          (['sunny', 'rain'] as const).map((w) =>
            button(
              [icon(w === 'sunny' ? 'weather-sun' : 'weather-rain', 'lpl-icon')],
              () => {
                this.choose(page.id, { weather: w }, `weather:${w}`);
              },
              {
                class: 'lpl-day-chip lpl-day-chip--weather',
                attrs: {
                  'data-nav-item': true,
                  'data-key': `weather:${w}`,
                  'aria-pressed': String(page.weather === w),
                  'aria-label': w === 'sunny' ? n.weatherSun : n.weatherRain,
                  title: w === 'sunny' ? n.weatherSun : n.weatherRain,
                  [SOUND_ATTR]: 'none',
                },
              },
            ),
          ),
        );
    return el('div', { class: 'lpl-neighbour__picker' }, [days, weather]);
  }

  private choose(
    villager: string,
    change: { offset?: number; weather?: 'sunny' | 'rain' },
    key: string,
  ): void {
    this.choice = {
      villager,
      offset: change.offset ?? this.choice.offset,
      weather: change.weather ?? this.choice.weather,
    };
    this.focusKey = key;
    this.host.sound('ui-tab');
    this.host.invalidate();
  }

  /** La frise de la journée: les moments en tête, une case par habitude, les heures dessous, « maintenant ». */
  private frise(page: NeighbourPageModel): HTMLElement {
    const { ctx } = this.host;
    const v = UI_SETTINGS.vitrine;
    const span = v.dayTo - v.dayFrom;
    const pos = (m: number): string => `${String(((m - v.dayFrom) / span) * 100)}%`;
    const names = ctx.texts.extra.vitrine.momentNames;
    const moments = el(
      'div',
      { class: 'lpl-frise__moments', 'aria-hidden': 'true' },
      timelineMoments().map((m) =>
        el(
          'span',
          {
            class: 'lpl-frise__moment',
            'data-moment': m.id,
            style: `left: ${pos(m.from)}; width: ${pos(m.to + v.dayFrom - m.from)}`,
          },
          [
            icon(infoIcon(m.id), 'lpl-icon lpl-frise__moment-icon'),
            el('span', { text: names[m.id] }),
          ],
        ),
      ),
    );
    const track = el(
      'div',
      { class: 'lpl-frise__track', role: 'list', 'aria-label': page.timelineLabel },
      page.timeline.map((s) => this.segment(s, pos)),
    );
    if (page.nowMinute !== null && page.nowMinute >= v.dayFrom && page.nowMinute < v.dayTo) {
      track.append(
        el('span', {
          class: 'lpl-frise__now',
          style: `left: ${pos(page.nowMinute)}`,
          role: 'img',
          'aria-label': `${ctx.texts.extra.neighbours.nowMarker}, ${page.now.label}`,
          title: page.now.label,
        }),
      );
    }
    const hours = el(
      'div',
      { class: 'lpl-frise__hours', 'aria-hidden': 'true' },
      // Le bout de la frise dit « 24 h » (la fin de la journée), pas « 0 h ».
      [6, 9, 12, 15, 18, 21, 24].map((h) =>
        el('span', {
          class: 'lpl-frise__hour',
          style: `left: ${pos(h * 60)}`,
          text: fill(ctx.texts.game.ui.hud.time, { hours: h, minutes: '' }).trimEnd(),
        }),
      ),
    );
    return el('div', { class: 'lpl-frise' }, [moments, track, hours]);
  }

  private segment(s: TimelineSegmentModel, pos: (m: number) => string): HTMLElement {
    const v = UI_SETTINGS.vitrine;
    const narrow = s.to - s.from < 60;
    return el(
      'span',
      {
        class: 'lpl-frise__segment',
        role: 'listitem',
        'data-known': s.known ? 'true' : 'false',
        'data-narrow': narrow ? 'true' : null,
        'data-place': s.place?.place ?? null,
        style: `left: ${pos(s.from)}; width: ${pos(s.to - s.from + v.dayFrom)}`,
        'aria-label': s.label,
        title: s.label,
      },
      s.known && s.place !== null
        ? [
            icon(s.place.icon, 'lpl-icon lpl-frise__icon'),
            s.activityIcon === null || narrow
              ? null
              : el('span', { class: 'lpl-frise__activity', 'aria-hidden': 'true' }, [
                  icon(s.activityIcon, 'lpl-icon'),
                ]),
          ]
        : [el('span', { class: 'lpl-frise__unknown', 'aria-hidden': 'true', text: '?' })],
    );
  }

  // -------------------------------------------------------------------------
  // Le bourg

  private townNodes(town: TownModel): HTMLElement {
    const { ctx } = this.host;
    const n = ctx.texts.extra.neighbours;
    const map = el('div', {
      class: 'lpl-town__map',
      role: 'group',
      'aria-label': ctx.t(n.townViewLabel),
    });
    for (const s of town.spots) {
      const lit = s.villagers.length > 0;
      const highlighted =
        this.highlight !== null && s.villagers.some((v) => v.id === this.highlight);
      const spot = button(
        [
          el('span', { class: 'lpl-town__place', 'aria-hidden': 'true' }, [
            icon(s.place.icon, 'lpl-icon lpl-town__icon'),
          ]),
          lit
            ? el(
                'span',
                { class: 'lpl-town__people', 'aria-hidden': 'true' },
                s.villagers.slice(0, 3).map((v) => portraitOf(v.id, true, 'small')),
              )
            : null,
          s.villagers.length > 3
            ? el('span', {
                class: 'lpl-town__more',
                'aria-hidden': 'true',
                text: `+${String(s.villagers.length - 3)}`,
              })
            : null,
        ],
        () => {
          const first = s.villagers[0];
          if (first === undefined) return;
          this.highlight = null;
          this.vitrine.reset();
          this.choice = { villager: null, offset: 0, weather: null };
          this.pendingSelect = `villager:${first.id}`;
          this.setView('grid', `villager:${first.id}`);
        },
        {
          class: 'lpl-town__spot',
          attrs: {
            'data-nav-item': true,
            'data-key': `spot:${s.place.place}`,
            'data-lit': lit ? 'true' : 'false',
            'data-highlight': highlighted ? 'true' : null,
            'aria-label': s.label,
            title: s.label,
            style: `left: ${String(6 + s.x * 88)}%; top: ${String(8 + s.y * 80)}%`,
            [SOUND_ATTR]: 'none',
          },
        },
      );
      map.append(spot);
    }
    const elsewhere = el(
      'div',
      { class: 'lpl-town__elsewhere' },
      town.elsewhere.length === 0 && town.spots.every((s) => s.villagers.length === 0)
        ? [
            el('p', {
              class: 'lpl-vitrine__notice lpl-vitrine__notice--quiet',
              text: ctx.t(n.townNobody),
            }),
          ]
        : town.elsewhere.map((e) => {
            const label = ctx.t(n.townHere, {
              names: e.villagers.map((v) => v.name).join(', '),
              place: e.place.name,
            });
            return el(
              'span',
              { class: 'lpl-town__group', role: 'img', 'aria-label': label, title: label },
              [
                icon(e.place.icon, 'lpl-icon lpl-town__icon'),
                ...e.villagers.map((v) => portraitOf(v.id, true, 'small')),
              ],
            );
          }),
    );
    return el('div', { class: 'lpl-town' }, [map, elsewhere]);
  }
}
