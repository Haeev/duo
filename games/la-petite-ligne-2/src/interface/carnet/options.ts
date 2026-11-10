/**
 * Onglet Réglages (interface.md, 5.3): le seul onglet en texte. Volume, qualité graphique (celle du
 * rendu: `graphics()` et `setGraphics()`), besoins toujours visibles, taille de l'interface,
 * mouvement réduit. Ils ne concernent que la machine de ce joueur. Chaque réglage agit tout de
 * suite. Tout au clavier: haut et bas choisissent la ligne, gauche et droite règlent, Entrée
 * bascule ou passe à la valeur suivante.
 */
import {
  GRAPHICS_PRESET_ORDER,
  type GraphicsOptions,
  type GraphicsPreset,
} from '../../rendu/options';
import { el, icon } from '../dom';
import { CARNET_TUNING } from './parametres';
import type { SettingsPort, UiScale, UiSettings } from './lectures';
import { DIRECTION_KEYS, type Tab, type TabDeps } from './onglet';
import { CARNET_TEXTS } from './textes';

const T = CARNET_TEXTS.settings;
const SCALES: readonly UiScale[] = ['normal', 'large', 'xlarge'];
/** « Personnalisée » se règle dans le panneau détaillé de Duo: ici on tourne entre les préréglages. */
const PRESETS: readonly GraphicsPreset[] = GRAPHICS_PRESET_ORDER.filter((p) => p !== 'custom');

export type SettingRowId = 'volume' | 'graphics' | 'needs' | 'scale' | 'motion';
export const SETTING_ROWS: readonly SettingRowId[] = [
  'volume',
  'graphics',
  'needs',
  'scale',
  'motion',
];

export interface SettingRowModel {
  readonly id: SettingRowId;
  readonly label: string;
  readonly kind: 'slider' | 'choice' | 'toggle';
  /** Valeur écrite. */
  readonly value: string;
  /** Slider : 0 à 1. Toggle : 1 ou 0. */
  readonly ratio: number;
}

export interface SettingsState {
  readonly ui: UiSettings;
  readonly gfx: GraphicsOptions;
}

export function settingsModel(state: SettingsState): readonly SettingRowModel[] {
  const { ui, gfx } = state;
  return [
    {
      id: 'volume',
      label: T.volume,
      kind: 'slider',
      value: `${ui.volume} %`,
      ratio: ui.volume / 100,
    },
    { id: 'graphics', label: T.graphics, kind: 'choice', value: T.presets[gfx.preset], ratio: 0 },
    {
      id: 'needs',
      label: T.needs,
      kind: 'toggle',
      value: ui.needsAlways ? T.on : T.off,
      ratio: ui.needsAlways ? 1 : 0,
    },
    { id: 'scale', label: T.scale, kind: 'choice', value: T.scales[ui.scale], ratio: 0 },
    {
      id: 'motion',
      label: T.motion,
      kind: 'toggle',
      value: ui.reducedMotion ? T.on : T.off,
      ratio: ui.reducedMotion ? 1 : 0,
    },
  ];
}

function cycle<V>(list: readonly V[], current: V, dir: -1 | 1): V {
  const at = list.indexOf(current);
  const next = at < 0 ? (dir === 1 ? 0 : list.length - 1) : (at + dir + list.length) % list.length;
  return list[next] ?? current;
}

/** Applique un cran (`dir`) à une ligne : pure, rend le nouvel état. */
export function adjustSetting(state: SettingsState, id: SettingRowId, dir: -1 | 1): SettingsState {
  const { ui, gfx } = state;
  switch (id) {
    case 'volume':
      return {
        ui: {
          ...ui,
          volume: Math.max(0, Math.min(100, ui.volume + dir * CARNET_TUNING.volumeStep)),
        },
        gfx,
      };
    case 'graphics':
      return { ui, gfx: { ...gfx, preset: cycle(PRESETS, gfx.preset, dir) } };
    case 'needs':
      return { ui: { ...ui, needsAlways: !ui.needsAlways }, gfx };
    case 'scale':
      return { ui: { ...ui, scale: cycle(SCALES, ui.scale, dir) }, gfx };
    case 'motion':
      return { ui: { ...ui, reducedMotion: !ui.reducedMotion }, gfx };
  }
}

const ROW_ICONS: Readonly<Record<SettingRowId, string>> = {
  volume: 'soleil',
  graphics: 'rouage',
  needs: 'bol',
  scale: 'info',
  motion: 'lune',
};

export function createSettingsTab(deps: TabDeps, port: SettingsPort): Tab {
  let row = 0;
  const state = (): SettingsState => ({ ui: port.ui(), gfx: port.graphics() });
  function apply(id: SettingRowId, dir: -1 | 1): void {
    const before = state();
    const after = adjustSetting(before, id, dir);
    if (after.ui !== before.ui) port.setUi(after.ui);
    if (after.gfx !== before.gfx) port.setGraphics(after.gfx);
    deps.invalidate();
  }

  return {
    render() {
      const rows = settingsModel(state());
      const list = el('div', { class: 'reglages', role: 'group', 'aria-label': T.title });
      rows.forEach((r, i) => {
        const node = el(
          'div',
          {
            class: `reglage${i === row ? ' focus' : ''}`,
            tabindex: '-1',
            role: 'group',
            'aria-label': `${r.label} : ${r.value}`,
          },
          [icon(ROW_ICONS[r.id]), el('span', { class: 'reglage__nom', text: r.label })],
        );
        if (r.kind === 'slider') {
          const bar = el('span', { class: 'jauge', role: 'img', 'aria-label': r.value }, [el('i')]);
          const fillNode = bar.firstElementChild;
          if (fillNode instanceof HTMLElement)
            fillNode.style.width = `${Math.round(r.ratio * 100)}%`;
          node.append(bar);
        }
        const less = el('button', {
          class: 'btn btn--petit',
          tabindex: '-1',
          'aria-label': '-',
          text: '‹',
        });
        const more = el('button', {
          class: 'btn btn--petit',
          tabindex: '-1',
          'aria-label': '+',
          text: '›',
        });
        less.addEventListener('click', () => {
          row = i;
          apply(r.id, -1);
        });
        more.addEventListener('click', () => {
          row = i;
          apply(r.id, 1);
        });
        if (r.kind !== 'toggle') node.append(less);
        node.append(
          el('span', {
            class: `reglage__valeur${r.kind === 'toggle' && r.ratio === 1 ? ' reglage__valeur--oui' : ''}`,
            text: r.value,
          }),
          r.kind === 'toggle'
            ? el(
                'span',
                { class: `bascule${r.ratio === 1 ? ' bascule--oui' : ''}`, 'aria-hidden': 'true' },
                [el('i')],
              )
            : more,
        );
        if (r.kind === 'toggle')
          node.addEventListener('click', () => {
            row = i;
            apply(r.id, 1);
          });
        list.append(node);
      });
      return {
        left: [el('h2', { class: 'page__title', text: T.title }), list],
        right: [
          el('div', { class: 'detail detail--reglages' }, [
            icon('rouage', 'ic vide__ic'),
            el('p', { text: T.machineOnly }),
          ]),
        ],
        full: false,
      };
    },
    signature() {
      const s = state();
      return JSON.stringify([s.ui, s.gfx, row]);
    },
    key(code) {
      const dir = DIRECTION_KEYS[code];
      const id = SETTING_ROWS[row] ?? 'volume';
      if (dir === 'up' || dir === 'down') {
        row = Math.max(0, Math.min(SETTING_ROWS.length - 1, row + (dir === 'down' ? 1 : -1)));
        deps.invalidate();
        return true;
      }
      if (dir === 'left' || dir === 'right') {
        apply(id, dir === 'right' ? 1 : -1);
        return true;
      }
      if (code === 'Enter') {
        apply(id, 1);
        return true;
      }
      return false;
    },
    hints() {
      return [
        { codes: ['KeyW', 'KeyS'], label: T.rowKeys },
        { codes: ['KeyA', 'KeyD'], label: T.keys },
      ];
    },
    closed() {
      row = 0;
    },
  };
}

/** Réglages tenus en mémoire, tant que `main.ts` ne branche pas ceux de Duo. Le rendu fournit `graphics`. */
export function memorySettings(
  graphics: { get(): GraphicsOptions; set(options: GraphicsOptions): void },
  initial: UiSettings,
  onUi: (next: UiSettings) => void = () => undefined,
): SettingsPort {
  let ui = initial;
  return {
    ui: () => ui,
    setUi(next) {
      ui = next;
      onUi(next);
    },
    graphics: () => graphics.get(),
    setGraphics: (options) => {
      graphics.set(options);
    },
  };
}
