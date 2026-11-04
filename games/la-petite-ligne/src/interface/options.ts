/**
 * Panneau « Options » (0.13): la qualité de l'image sur cette machine. Préréglages (Auto, Haute,
 * Moyenne, Basse, Personnalisée), réglages fins (ombres, netteté, particules) et « Ne jamais
 * réduire ». Ouvert depuis le pied du carnet (Échap reste la pause de Duo, hors du jeu). Chaque
 * choix s'applique aussitôt, sans recharger; rien ne passe par le réseau.
 */
import {
  EFFECTS_LEVELS,
  GRAPHICS_PRESET_ORDER,
  RESOLUTION_LEVELS,
  SHADOW_LEVELS,
  type GraphicsLevels,
  type GraphicsOptions,
  type GraphicsPort,
  type GraphicsPreset,
  shownLevels,
  withLevel,
} from '../etat/options-graphiques';
import type { ReadonlyWorld } from '../etat/types';
import type { UiHost } from './composant';
import { nameOf } from './contexte';
import { button, el, keycap, keysLine } from './dom';
import { Panel } from './panneau';

/** Ce que montre le panneau: une ligne de choix par réglage, la case et les aides. */
export interface OptionsModel {
  readonly preset: GraphicsPreset;
  readonly levels: GraphicsLevels;
  /** Réglages fins grisés en Auto (la qualité adaptative décide). */
  readonly auto: boolean;
  readonly neverReduce: boolean;
}

export function optionsModel(options: GraphicsOptions): OptionsModel {
  return {
    preset: options.preset,
    levels: shownLevels(options),
    auto: options.preset === 'auto',
    neverReduce: options.neverReduce,
  };
}

/** Choix d'un préréglage: Personnalisée reprend les niveaux montrés, à modifier ensuite. */
export function choosePreset(options: GraphicsOptions, preset: GraphicsPreset): GraphicsOptions {
  if (preset === 'custom') return { ...options, preset, custom: shownLevels(options) };
  return { ...options, preset };
}

export class OptionsPanel extends Panel {
  private readonly port: GraphicsPort;

  constructor(host: UiHost, port: GraphicsPort) {
    const { ctx } = host;
    const g = ctx.texts.extra.graphics;
    const back = ctx.key('Backspace');
    super(host, {
      icon: 'ui-eye',
      title: ctx.t(g.title),
      width: '46rem',
      closeKeyLabel: back,
      closeAria: ctx.t(g.closeLabel, { back }),
    });
    this.port = port;
    this.root.classList.add('lpl-options');
    const a = ctx.texts.extra.keys.arrows;
    this.setFooter([
      keysLine([
        { keys: [...a], text: g.keysChoose },
        { keys: [ctx.key('Enter')], text: ctx.texts.extra.notebook.keysActivate },
      ]),
      el('span', {}, [keycap(back), ` ${ctx.texts.extra.notebook.keysClose}`]),
    ]);
  }

  update(world: ReadonlyWorld): void {
    const { ctx } = this.host;
    this.setSubtitle(
      ctx.t(ctx.texts.extra.graphics.subtitle, { partner: nameOf(world, ctx.partner) }),
    );
    const model = optionsModel(this.port.current());
    this.renderBody(JSON.stringify(model), () => this.nodes(model));
  }

  private apply(options: GraphicsOptions): void {
    this.port.set(options);
    this.host.invalidate();
  }

  private nodes(model: OptionsModel): HTMLElement[] {
    const { ctx } = this.host;
    const g = ctx.texts.extra.graphics;
    const current = (): GraphicsOptions => this.port.current();
    const row = <T extends string>(
      label: string,
      key: string,
      values: readonly T[],
      names: Readonly<Record<T, string>>,
      chosen: T,
      onPick: (value: T) => void,
    ): HTMLElement =>
      el('div', { class: 'lpl-options__row', role: 'group', 'aria-label': ctx.t(label) }, [
        el('span', { class: 'lpl-options__label', text: ctx.t(label) }),
        el(
          'div',
          { class: 'lpl-options__choices' },
          values.map((value) =>
            button(
              ctx.t(names[value]),
              () => {
                onPick(value);
              },
              {
                class: 'lpl-button lpl-options__choice',
                attrs: {
                  'aria-pressed': String(value === chosen),
                  'data-key': `${key}:${value}`,
                  'data-nav-item': true,
                  'data-autofocus': key === 'preset' && value === chosen,
                },
              },
            ),
          ),
        ),
      ]);

    const presets = row(
      g.quality,
      'preset',
      GRAPHICS_PRESET_ORDER,
      g.presets,
      model.preset,
      (preset) => {
        this.apply(choosePreset(current(), preset));
      },
    );
    const fine = el('section', { class: 'lpl-options__fine' }, [
      el('h3', { class: 'lpl-section-title', text: ctx.t(g.fine) }),
      row(g.shadows, 'shadows', SHADOW_LEVELS, g.shadowLevels, model.levels.shadows, (shadows) => {
        this.apply(withLevel(current(), { shadows }));
      }),
      row(
        g.resolution,
        'resolution',
        RESOLUTION_LEVELS,
        g.resolutionLevels,
        model.levels.resolution,
        (resolution) => {
          this.apply(withLevel(current(), { resolution }));
        },
      ),
      el('p', { class: 'lpl-field__help', text: ctx.t(g.resolutionHelp) }),
      row(
        g.effects,
        'effects',
        EFFECTS_LEVELS,
        g.effectsLevels,
        model.levels.effects,
        (effects) => {
          this.apply(withLevel(current(), { effects }));
        },
      ),
      model.auto
        ? el('p', { class: 'lpl-field__help', text: ctx.t(g.autoNote) })
        : el('span', { hidden: true }),
    ]);

    const never = el('input', {
      type: 'checkbox',
      class: 'lpl-check__input',
      'data-nav-item': true,
      'data-key': 'never-reduce',
    });
    never.checked = model.neverReduce && !model.auto;
    never.disabled = model.auto;
    never.addEventListener('change', () => {
      this.apply({ ...current(), neverReduce: never.checked });
    });

    return [
      el('div', { class: 'lpl-options__body' }, [
        presets,
        el('p', { class: 'lpl-options__help', text: ctx.t(g.presetHelp[model.preset]) }),
        fine,
        el('label', { class: `lpl-check${model.auto ? ' lpl-check--off' : ''}` }, [
          never,
          el('span', {}, [
            el('strong', { text: ctx.t(g.neverReduce) }),
            el('small', { text: ctx.t(model.auto ? g.neverReduceAuto : g.neverReduceHelp) }),
          ]),
        ]),
        el('p', {
          class: 'lpl-field__help lpl-options__kept',
          text: ctx.t(this.port.persistent ? g.keptForGood : g.kept),
        }),
      ]),
    ];
  }
}
