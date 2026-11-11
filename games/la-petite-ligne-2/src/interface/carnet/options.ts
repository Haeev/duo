/**
 * Onglet Réglages (interface.md, 5.3): le seul onglet en texte. Volume, qualité graphique (celle du
 * rendu: `graphics()` et `setGraphics()`), aide des mini-jeux, besoins et barre d'outils toujours
 * visibles, taille de l'interface, mouvement réduit, vibration d'écran. Ils ne concernent que la
 * machine de ce joueur (l'aide part aussi à l'hôte, qui l'applique à ce joueur seul) et sont
 * gardés d'une séance à l'autre (`memoire.ts`). Chaque réglage agit tout de
 * suite. Tout au clavier: haut et bas choisissent la ligne, gauche et droite règlent, Entrée
 * bascule ou passe à la valeur suivante.
 */
import {
  GRAPHICS_PRESET_ORDER,
  type GraphicsOptions,
  type GraphicsPreset,
} from '../../rendu/options';
import { ASSIST_LEVELS } from '../../etat/joueur';
import { el, icon } from '../dom';
import { CARNET_TUNING } from './parametres';
import type { SettingsPort, UiScale, UiSettings } from './lectures';
import { DIRECTION_KEYS, type Tab, type TabDeps } from './onglet';
import { CARNET_TEXTS } from './textes';

const T = CARNET_TEXTS.settings;
const SCALES: readonly UiScale[] = ['normal', 'large', 'xlarge'];
/** « Personnalisée » se règle dans le panneau détaillé de Duo: ici on tourne entre les préréglages. */
const PRESETS: readonly GraphicsPreset[] = GRAPHICS_PRESET_ORDER.filter((p) => p !== 'custom');

export type SettingRowId =
  'volume' | 'graphics' | 'assist' | 'needs' | 'toolbar' | 'scale' | 'motion' | 'shake';
export const SETTING_ROWS: readonly SettingRowId[] = [
  'volume',
  'graphics',
  'assist',
  'needs',
  'toolbar',
  'scale',
  'motion',
  'shake',
];

export interface SettingRowModel {
  readonly id: SettingRowId;
  readonly label: string;
  readonly kind: 'slider' | 'choice' | 'toggle';
  /** Valeur écrite. */
  readonly value: string;
  /** Slider : 0 à 1. Toggle : 1 ou 0. */
  readonly ratio: number;
  /** Ligne grisée: sans effet tant qu'un autre réglage la coupe (vibration sous mouvement réduit). */
  readonly muted?: boolean;
  /** Précision sous la valeur (ce que fait le cran choisi). */
  readonly note?: string;
}

function toggle(id: SettingRowId, label: string, on: boolean): SettingRowModel {
  return { id, label, kind: 'toggle', value: on ? T.on : T.off, ratio: on ? 1 : 0 };
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
      id: 'assist',
      label: T.assist,
      kind: 'choice',
      value: T.assists[ui.assist],
      ratio: 0,
      note: T.assistNotes[ui.assist],
    },
    toggle('needs', T.needs, ui.needsAlways),
    toggle('toolbar', T.toolbar, ui.toolbarAlways),
    { id: 'scale', label: T.scale, kind: 'choice', value: T.scales[ui.scale], ratio: 0 },
    toggle('motion', T.motion, ui.reducedMotion),
    { ...toggle('shake', T.shake, ui.shake), muted: ui.reducedMotion },
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
    case 'assist':
      return { ui: { ...ui, assist: cycle(ASSIST_LEVELS, ui.assist, dir) }, gfx };
    case 'needs':
      return { ui: { ...ui, needsAlways: !ui.needsAlways }, gfx };
    case 'toolbar':
      return { ui: { ...ui, toolbarAlways: !ui.toolbarAlways }, gfx };
    case 'shake':
      return { ui: { ...ui, shake: !ui.shake }, gfx };
    case 'scale':
      return { ui: { ...ui, scale: cycle(SCALES, ui.scale, dir) }, gfx };
    case 'motion':
      return { ui: { ...ui, reducedMotion: !ui.reducedMotion }, gfx };
  }
}

const ROW_ICONS: Readonly<Record<SettingRowId, string>> = {
  volume: 'soleil',
  graphics: 'rouage',
  assist: 'plume',
  needs: 'bol',
  toolbar: 'sac',
  scale: 'info',
  motion: 'lune',
  shake: 'orage',
};

/** Précisions de la ligne choisie, sur la page de droite (cran d'aide, vibration coupée). */
function detailNotes(focused: SettingRowModel | undefined): HTMLElement[] {
  if (focused === undefined) return [];
  const out: HTMLElement[] = [];
  if (focused.note !== undefined)
    out.push(el('p', { class: 'reglages__note', text: `${focused.value}: ${focused.note}` }));
  if (focused.muted === true) out.push(el('p', { class: 'reglages__note', text: T.shakeMuted }));
  return out;
}

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
            class: `reglage${i === row ? ' focus' : ''}${r.muted === true ? ' reglage--coupe' : ''}`,
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
            el('p', { text: T.assistOnly }),
            ...detailNotes(rows[row]),
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
