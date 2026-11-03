/**
 * Panneau « La basse-cour » (0.12, conception section 4), ouvert au poulailler ou à la chevrerie:
 * le nom à choisir (chez celui dont c'est le tour, les deux voient la demande), l'état de chaque
 * bête en mots, le grain, la litière, la couvée et la collection des six couleurs.
 */
import type { ReadonlyWorld } from '../etat/types';
import type { UiHost } from './composant';
import { button, el, icon } from './dom';
import { type AnimalLine, type FarmModel, farmModel } from './modele-elevage';
import { Panel, backKeys } from './panneau';

export class FarmPanel extends Panel {
  constructor(host: UiHost) {
    const { ctx } = host;
    super(host, {
      icon: 'egg',
      title: ctx.t(ctx.texts.extra.farm.title),
      subtitle: ctx.t(ctx.texts.extra.farm.subtitle),
      narrow: true,
      width: '44rem',
      closeKeyLabel: ctx.key('Backspace'),
      closeAria: `${ctx.texts.extra.common.close} (${ctx.key('Backspace')})`,
    });
    const a = ctx.texts.extra.keys.arrows;
    this.setFooter([
      backKeys(host, [
        { keys: [a[0], a[1]], text: ctx.texts.extra.notebook.keysChoose },
        { keys: [ctx.key('Enter')], text: ctx.texts.extra.notebook.keysActivate },
      ]),
    ]);
  }

  update(world: ReadonlyWorld): void {
    const m = farmModel(world, this.host.ctx);
    this.renderBody(JSON.stringify(m), () => this.content(m));
  }

  private content(m: FarmModel): HTMLElement[] {
    const f = this.host.ctx.texts.extra.farm;
    const nodes: HTMLElement[] = [];
    let focused = false;
    const autofocus = (): boolean => {
      if (focused) return false;
      focused = true;
      return true;
    };
    if (m.naming !== null) {
      const naming = m.naming;
      const choices = naming.mine
        ? el(
            'div',
            { class: 'lpl-farm__names', 'data-nav': 'list' },
            naming.options.map((name) =>
              button(
                name,
                () => {
                  this.host.send({ type: 'animal_name', animal: naming.animal, name });
                },
                {
                  class: 'lpl-button lpl-button--primary',
                  attrs: {
                    'data-nav-item': true,
                    'data-key': `name:${name}`,
                    'data-autofocus': autofocus(),
                  },
                },
              ),
            ),
          )
        : el('p', { class: 'lpl-field__help', text: naming.options.join(', ') });
      nodes.push(
        el('section', { class: 'lpl-farm__naming', 'aria-live': 'polite' }, [
          el('h3', { class: 'lpl-section-title', text: f.namingTitle }),
          el('p', { text: naming.text }),
          choices,
        ]),
      );
    }
    const group = (title: string, lines: AnimalLine[]): void => {
      if (lines.length === 0) return;
      nodes.push(
        el('h3', { class: 'lpl-section-title lpl-section-gap', text: title }),
        el(
          'ul',
          { class: 'lpl-farm__list' },
          lines.map((l) => this.line(l)),
        ),
      );
    };
    group(f.hens, m.hens);
    group(f.chicks, m.chicks);
    group(f.rooster, m.rooster === null ? [] : [m.rooster]);
    group(f.goats, m.goats);
    if (m.hens.length > 0) {
      nodes.push(
        el('p', { class: 'lpl-field__help', text: `${m.capacity}. ${m.grain}` }),
        el('p', {
          class: 'lpl-field__help',
          'data-state': m.litterFresh ? 'fresh' : 'old',
          text: m.litter,
        }),
      );
      nodes.push(el('h3', { class: 'lpl-section-title lpl-section-gap', text: f.broodTitle }));
      if (m.brood.running !== null) nodes.push(el('p', { text: m.brood.running }));
      if (m.brood.help !== '')
        nodes.push(el('p', { class: 'lpl-field__help', text: m.brood.help }));
      if (m.brood.options.length > 0) {
        nodes.push(
          el(
            'div',
            { class: 'lpl-farm__names', 'data-nav': 'list' },
            m.brood.options.map((o) =>
              button(
                o.label,
                () => {
                  if (o.enabled) this.host.send({ type: 'brood_start', hen: o.hen });
                },
                {
                  class: 'lpl-button',
                  attrs: {
                    'data-nav-item': true,
                    'data-key': `brood:${o.hen}`,
                    'aria-disabled': o.enabled ? null : 'true',
                    'data-autofocus': autofocus(),
                  },
                },
              ),
            ),
          ),
        );
      }
      nodes.push(
        el('h3', { class: 'lpl-section-title lpl-section-gap', text: m.collection.title }),
        el(
          'ul',
          { class: 'lpl-farm__colors' },
          m.collection.colors.map((c) =>
            el(
              'li',
              {
                class: 'lpl-farm__color',
                'data-color': c.id,
                'data-have': c.have ? 'true' : 'false',
              },
              [
                el('span', { class: 'lpl-farm__swatch', 'aria-hidden': 'true' }),
                el('span', {
                  text: c.have ? c.label : this.host.ctx.texts.extra.farm.collectionMissing,
                }),
              ],
            ),
          ),
        ),
      );
    }
    return nodes;
  }

  private line(l: AnimalLine): HTMLLIElement {
    return el('li', { class: 'lpl-farm__animal', 'data-mood': l.moodKind ?? 'none' }, [
      icon(l.moodKind === null ? 'egg' : 'ui-heart', 'lpl-order__icon'),
      el('span', { class: 'lpl-farm__name' }, [
        el('strong', { text: l.name }),
        l.mood === '' ? null : el('span', { class: 'lpl-farm__mood', text: ` ${l.mood}` }),
      ]),
      el('small', { class: 'lpl-farm__notes', text: l.notes.join(', ') }),
    ]);
  }
}
