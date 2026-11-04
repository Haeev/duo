/**
 * Panneau « La basse-cour » (0.12, conception section 4), ouvert au poulailler ou à la chevrerie.
 * Patch 0.12.2 (`docs/jeux/jeu-1/interface-imagee-0-12-2.md`): une carte par bête (portrait selon
 * sa robe, nom, jauge du cœur, pastilles « nourrie », « au nid », traite, eau), l'état de la
 * basse-cour en icônes (places en pictos, grain et litière en jauges, couvée et ses conditions),
 * et la collection des six robes en portraits, grisés pour celles à trouver. Le nom à choisir
 * reste en mots (chez celui dont c'est le tour, les deux voient la demande).
 */
import type { ReadonlyWorld } from '../etat/types';
import type { UiHost } from './composant';
import { UI_SETTINGS } from './config';
import { button, el, icon } from './dom';
import { henIcon, infoIcon } from './icones';
import { itemIcon } from './modele';
import { type FarmBoardModel, type HenCardModel, farmBoard } from './modele-elevage';
import { Panel, backKeys } from './panneau';
import { type VitrineItem, Vitrine, gauge, need, pastille } from './vitrine';

export class FarmPanel extends Panel {
  private readonly animalsPage: Vitrine;

  constructor(host: UiHost) {
    const { ctx } = host;
    super(host, {
      icon: 'egg',
      title: ctx.t(ctx.texts.extra.farm.title),
      narrow: true,
      width: UI_SETTINGS.vitrine.farmWidth,
      closeKeyLabel: ctx.key('Backspace'),
      closeAria: `${ctx.texts.extra.common.close} (${ctx.key('Backspace')})`,
    });
    this.animalsPage = new Vitrine(host, { perPage: UI_SETTINGS.vitrine.animalsPerPage, label: ctx.t(ctx.texts.extra.vitrine.animals), noDetail: true });
    const a = ctx.texts.extra.keys.arrows;
    this.setFooter([
      backKeys(host, [
        { keys: [...a], text: ctx.texts.extra.notebook.keysChoose },
        { keys: [ctx.key('Enter')], text: ctx.texts.extra.notebook.keysActivate },
      ]),
    ]);
    this.root.classList.add('lpl-panel--vitrine', 'lpl-farm');
  }

  override key(code: string): boolean {
    if (code !== 'KeyQ' && code !== 'KeyE') return false;
    this.animalsPage.turn(code === 'KeyQ' ? -1 : 1);
    return true;
  }

  update(world: ReadonlyWorld): void {
    const m = farmBoard(world, this.host.ctx);
    this.renderBody(JSON.stringify([m, this.animalsPage.page]), () => this.content(m));
  }

  private content(m: FarmBoardModel): HTMLElement[] {
    const { ctx } = this.host;
    const f = ctx.texts.extra.farm;
    const nodes: HTMLElement[] = [];
    // Un objet plutôt qu'une variable: la règle des conditions inutiles ne suit pas les fermetures.
    const focus = { taken: false };
    const autofocus = (): boolean => {
      if (focus.taken) return false;
      focus.taken = true;
      return true;
    };
    if (m.naming !== null) {
      const naming = m.naming;
      const choices = naming.mine
        ? el(
            'div',
            { class: 'lpl-farm__names', 'data-nav': 'list' },
            naming.options.map((name) =>
              button(name, () => {
                this.host.send({ type: 'animal_name', animal: naming.animal, name });
              }, { class: 'lpl-button lpl-button--primary', attrs: { 'data-nav-item': true, 'data-key': `name:${name}`, 'data-autofocus': autofocus() } }),
            ),
          )
        : el('div', { class: 'lpl-farm__names' }, naming.options.map((name) => el('span', { class: 'lpl-chip', text: name })));
      nodes.push(el('section', { class: 'lpl-farm__naming', 'aria-live': 'polite' }, [el('span', { class: 'lpl-farm__naming-mark', 'aria-hidden': 'true', text: '?' }), el('p', { text: naming.text }), choices]));
    }
    if (m.hens > 0) nodes.push(this.status(m));
    if (m.animals.length > 0) {
      const items: VitrineItem[] = m.animals.map((a) => ({ key: `animal:${a.id}`, tile: { icon: 'hen', name: a.name, label: a.name }, detail: () => [] }));
      const page = this.animalsPage.build(items, null);
      const grid = page.querySelector('.lpl-vitrine__grid');
      if (grid !== null) {
        const shown = new Set([...grid.querySelectorAll<HTMLElement>('[data-key]')].map((t) => t.dataset.key));
        grid.replaceChildren(...m.animals.filter((a) => shown.has(`animal:${a.id}`)).map((a) => this.card(a, autofocus)));
        grid.classList.add('lpl-farm__animals');
      }
      page.classList.add('lpl-vitrine--farm');
      nodes.push(page);
    } else {
      nodes.push(el('div', { class: 'lpl-empty', text: ctx.t(f.subtitle) }));
    }
    if (m.hens > 0) nodes.push(this.collection(m));
    if (!focus.taken) {
      // Rien à faire: le focus va à la première carte de bête (elle se lit au clavier).
      const pick = (selector: string): Element | undefined => nodes.map((n) => n.querySelector(selector)).find((n) => n !== null) ?? undefined;
      const first = pick('.lpl-farm__card-face') ?? pick('[data-nav-item]');
      first?.setAttribute('data-autofocus', '');
    }
    return nodes;
  }

  /** L'état de la basse-cour: places en pictos, grain et litière en jauges, couvée. */
  private status(m: FarmBoardModel): HTMLElement {
    const { ctx } = this.host;
    const v = ctx.texts.extra.vitrine;
    const tile = (key: string, label: string, children: (Node | null)[], state: string | null = null): HTMLElement =>
      el('div', { class: 'lpl-farm__stat', tabindex: '0', 'data-nav-item': true, 'data-key': `stat:${key}`, role: 'group', 'aria-label': label, title: label, 'data-state': state }, children);
    const places = el(
      'span',
      { class: 'lpl-farm__places', 'aria-hidden': 'true' },
      Array.from({ length: m.places.max }, (_, i) => el('span', { class: 'lpl-farm__place', 'data-used': i < m.places.used ? 'true' : null }, [icon(i < m.places.used ? 'hen' : 'ui-house')])),
    );
    const stats: HTMLElement[] = [
      tile('places', m.places.label, [icon('ui-house', 'lpl-icon lpl-farm__stat-icon'), places, el('strong', { class: 'lpl-farm__stat-count', 'aria-hidden': 'true', text: `${String(m.places.used)}/${String(m.places.max)}` })]),
    ];
    if (m.grain !== null) {
      // Le grain: la réserve en jours (« 9 j »), nourries ou pas aujourd'hui, la trémie (catalogue).
      const g = m.grain;
      const fedLabel = m.fed === null ? '' : m.fed ? ctx.t(v.fedToday) : ctx.t(v.notFedToday);
      const hopper = g.hopper
        ? pastille({ icon: itemIcon(ctx, 'hopper_feeder'), tone: 'ok', label: ctx.t(v.hopper) })
        : el('span', { class: 'lpl-farm__hint', title: ctx.t(v.hopperShop), 'aria-hidden': 'true' }, [icon(itemIcon(ctx, 'hopper_feeder')), icon('ui-notebook', 'lpl-icon lpl-farm__hint-badge')]);
      stats.push(
        tile(
          'grain',
          [g.label, fedLabel, g.sacks > 0 ? ctx.t(v.grainSacks, { count: g.sacks }) : '', g.hopper ? ctx.t(v.hopper) : ctx.t(v.hopperShop)].filter((x) => x !== '').join('. '),
          [
            icon(itemIcon(ctx, 'grain_sack'), 'lpl-icon lpl-farm__stat-icon'),
            g.free
              ? pastille({ icon: null, text: ctx.t(v.free), tone: 'ok', label: '' })
              : gauge({ icon: null, value: g.rations / g.perSack, label: g.label, text: ctx.t(v.grainShort, { days: g.days }), tone: 'food' }),
            g.sacks > 0 ? pastille({ icon: 'grain-sack', text: `+${String(g.sacks)}`, tone: 'count', label: '' }) : null,
            m.fed === null ? null : el('span', { class: 'lpl-farm__check', 'data-on': m.fed ? 'true' : 'false', 'aria-hidden': 'true', title: fedLabel }, [icon(m.fed ? 'ui-check' : 'ui-cross')]),
            hopper,
          ],
          g.free || g.rations > 0 || g.sacks > 0 ? null : 'missing',
        ),
      );
    }
    if (m.litter !== null) {
      const l = m.litter;
      stats.push(
        tile('litter', l.label, [icon(infoIcon(l.fresh ? 'litter_clean' : 'litter_dirty'), 'lpl-icon lpl-farm__stat-icon'), gauge({ icon: 'ui-hourglass', value: l.daysLeft / l.days, label: l.label, text: ctx.t(v.litterShort, { days: l.daysLeft }), tone: 'fresh' })], l.fresh ? null : 'missing'),
      );
    }
    const brood = m.brood;
    if (brood.running !== null) {
      const r = brood.running;
      stats.push(
        tile('brood', r.label, [
          icon(infoIcon('brood'), 'lpl-icon lpl-farm__stat-icon'),
          gauge({ icon: 'ui-moon', value: (r.nights - r.nightsLeft) / r.nights, label: r.label, text: ctx.t(v.broodNights, { nights: r.nightsLeft }), tone: 'neutral' }),
        ]),
      );
    } else if (brood.needs.length > 0) {
      const iconOf = { rooster: 'hen', eggs: infoIcon('egg_today'), happy: infoIcon('hen_heart'), place: 'ui-house' } as const;
      stats.push(
        tile(
          'brood',
          `${ctx.t(v.brood)} : ${brood.needs.map((n) => n.label).join(', ')}`,
          [icon(infoIcon('brood'), 'lpl-icon lpl-farm__stat-icon'), el('span', { class: 'lpl-farm__needs' }, brood.needs.map((n) => need({ icon: iconOf[n.key], have: n.have, need: n.need, label: n.label })))],
          brood.needs.every((n) => n.have >= n.need) ? null : 'missing',
        ),
      );
    }
    return el('section', { class: 'lpl-farm__status', 'data-nav': 'grid' }, stats);
  }

  /** Une bête: portrait, nom, jauge du cœur, pastilles d'état, et « Couver » s'il y a lieu. */
  private card(a: HenCardModel, autofocus: () => boolean): HTMLElement {
    const { ctx } = this.host;
    const f = ctx.texts.extra.farm;
    const v = ctx.texts.extra.vitrine;
    // Un dessin absent du sprite (la chèvre, en attendant le lot de l'artiste): l'initiale du nom, jamais une case vide.
    const symbol = a.kind === 'goat' ? itemIcon(ctx, 'goat_extra') : a.kind === 'rooster' ? 'hen' : henIcon(a.robe);
    const figure = document.getElementById(symbol) === null ? el('span', { class: 'lpl-farm__initial', text: a.name.charAt(0) }) : icon(symbol, 'lpl-farm__portrait-icon');
    const marks: (HTMLElement | null)[] = [];
    if (a.fed !== null) marks.push(pastille({ icon: infoIcon(a.fed ? 'hen_fed' : 'hen_hungry'), tone: a.fed ? 'ok' : 'missing', crossed: !a.fed, label: a.fed ? f.fed : f.notFed }));
    if (a.brooding) marks.push(pastille({ icon: infoIcon('brood'), tone: 'wait', label: f.brooding }));
    if (a.kind === 'chick' && a.follows !== null) marks.push(pastille({ icon: 'hen', tone: 'info', label: ctx.t(f.chickOf, { mother: a.follows }) }));
    if (a.kind === 'goat') {
      if (a.milked !== null) marks.push(pastille({ icon: itemIcon(ctx, 'milk_can'), tone: a.milked ? 'ok' : 'missing', crossed: !a.milked, label: a.milked ? f.goatMilked : f.goatToMilk }));
      if (a.watered !== null) marks.push(pastille({ icon: itemIcon(ctx, 'water_pail'), tone: a.watered ? 'ok' : 'missing', crossed: !a.watered, label: a.watered ? f.goatWatered : f.goatThirsty }));
      if (a.home) marks.push(pastille({ icon: 'ui-house', tone: 'info', label: f.goatHome }));
      if (a.follows !== null) marks.push(pastille({ icon: 'ui-pin', tone: 'info', label: ctx.t(f.goatLed, { name: a.follows }) }));
      if (a.shorn) marks.push(pastille({ icon: 'dandelion', tone: 'missing', crossed: true, label: f.goatShorn }));
    }
    const what = a.kind === 'rooster' ? ctx.t(v.roosterLabel, { name: a.name }) : a.kind === 'chick' && a.follows !== null ? ctx.t(v.chickLabel, { name: a.name, mother: a.follows }) : a.name;
    const label = [what, a.mood, ...a.notes].filter((x) => x !== '').join(', ');
    const brood =
      a.brood === null
        ? null
        : button([icon(infoIcon('brood')), ctx.t(v.brood)], () => {
            if (a.brood?.enabled === true) this.host.send({ type: 'brood_start', hen: a.id });
          }, { class: 'lpl-button lpl-farm__brood', attrs: { 'data-nav-item': true, 'data-key': `brood:${a.id}`, 'aria-disabled': a.brood.enabled ? null : 'true', 'aria-label': a.brood.label, 'data-autofocus': a.brood.enabled && autofocus() } });
    return el('article', { class: 'lpl-farm__card', 'data-kind': a.kind, 'data-mood': a.moodKind ?? 'none' }, [
      el('div', { class: 'lpl-farm__card-face', tabindex: '0', 'data-nav-item': true, 'data-key': `animal:${a.id}`, role: 'group', 'aria-label': label }, [
        el('span', { class: 'lpl-farm__portrait', 'data-robe': a.robe, 'aria-hidden': 'true' }, [figure]),
        el('span', { class: 'lpl-farm__name', 'aria-hidden': 'true', text: a.name }),
        a.heart === null ? null : gauge({ icon: infoIcon('hen_heart'), value: a.heart, label: ctx.t(v.heartLabel, { name: a.name, mood: a.mood }), tone: 'heart' }),
        marks.length === 0 ? null : el('span', { class: 'lpl-farm__marks', 'aria-hidden': 'true' }, marks),
      ]),
      brood,
    ]);
  }

  /** Les six robes: portrait en couleur pour celles de la basse-cour, gris et « ? » pour les autres. */
  private collection(m: FarmBoardModel): HTMLElement {
    const { ctx } = this.host;
    const v = ctx.texts.extra.vitrine;
    const c = m.collection;
    return el('section', { class: 'lpl-farm__collection', role: 'group', 'aria-label': c.label }, [
      el('span', { class: 'lpl-farm__collection-head', 'aria-hidden': 'true' }, [pastille({ icon: henIcon('hen_white'), text: `${String(c.count)}/${String(c.total)}`, tone: c.count === c.total ? 'ok' : 'count', label: '' })]),
      el(
        'ul',
        { class: 'lpl-farm__robes' },
        c.robes.map((r) =>
          el('li', { class: 'lpl-farm__robe', 'data-have': r.have ? 'true' : 'false', 'data-robe': r.id, title: r.have ? r.name : ctx.t(v.robeMissing, { name: r.name }) }, [
            el('span', { class: 'lpl-farm__portrait lpl-farm__portrait--small', 'data-robe': r.id, 'aria-hidden': 'true' }, [icon(henIcon(r.id, r.have), 'lpl-farm__portrait-icon')]),
            el('span', { class: 'lpl-farm__robe-name', 'aria-hidden': r.have ? null : 'true', text: r.name }),
            r.have ? null : el('span', { class: 'lpl-sr-only', text: ctx.t(v.robeMissing, { name: r.name }) }),
          ]),
        ),
      ),
    ]);
  }
}
