/**
 * Écran d'atelier, commun aux postes (établi, forge, métier, meule) et à leurs usages: fabriquer,
 * améliorer, réparer, affûter. Même gabarit que la boutique (`boutique/ecran.ts`): le poste à
 * gauche, les onglets et la grille au centre, le détail à droite (matériaux en icônes avec leurs
 * compteurs, prix, avancement). Tout au clavier, presque sans texte. Propre à chaque joueur; les
 * coups de l'autre joueur sur le même poste font avancer la même barre.
 */
import type { Content } from '../../donnees/charger';
import type { PlayerIndex } from '../../donnees/schemas/communs';
import type { CraftService } from '../../donnees/schemas/plan';
import type { ReadonlyWorld } from '../../etat/monde';
import type { Intent } from '../../simulation/noyau/entrees';
import type { GameEvent } from '../../simulation/noyau/evenements';
import { formatEuros } from '../../simulation/sac/argent';
import { el, icon } from '../dom';
import { itemThumb } from '../pictos';
import { fill } from '../textes';
import {
  workshopModel,
  type WorkshopModel,
  type WorkshopTile,
  type WorkshopUiState,
} from './modele';
import { WORKSHOP_TEXTS as T, workshopRefusalText } from './textes';
import '../boutique/boutique.css';
import './atelier.css';

const S =
  'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';
/** Pictos de l'atelier (créations du studio). */
const SYMBOLS: Readonly<Record<string, string>> = {
  'ws-make': `<g ${S}><path d="M4 20l9-9M13 11l3-3 4 4-3 3zM14 6l4 4"/></g>`,
  'ws-upgrade': `<g ${S}><path d="M12 20V5M6 11l6-6 6 6"/></g>`,
  'ws-repair': `<g ${S}><path d="M14 4a4 4 0 0 0 5 5l-9 9a2 2 0 0 1-3-3z"/></g>`,
  'ws-sharpen': `<g ${S}><circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="1.5"/><path d="M3 4l6 6"/></g>`,
  'ws-workbench': `<g ${S}><path d="M2 9h20v3H2zM4 12v8M20 12v8M8 6l2 3M15 5v4"/></g>`,
  'ws-forge': `<g ${S}><path d="M3 8h13a4 4 0 0 1-4 4H9v3h4v3H5v-3h2v-3H6a3 3 0 0 1-3-3zM18 5c2 1 2 3 0 4"/></g>`,
  'ws-loom': `<g ${S}><rect x="4" y="4" width="16" height="16"/><path d="M8 4v16M12 4v16M16 4v16M4 12h16"/></g>`,
  'ws-grindstone': `<g ${S}><circle cx="12" cy="10" r="6"/><path d="M6 20h12M9 16l-2 4M15 16l2 4"/></g>`,
  'ws-chest': `<g ${S}><rect x="3" y="8" width="18" height="12" rx="1"/><path d="M3 12h18M10 12v3h4v-3M5 8l2-4h10l2 4"/></g>`,
  'ws-sun': `<g ${S}><circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2"/></g>`,
  'ws-question': `<g ${S}><path d="M9 9a3 3 0 1 1 4 3c-1 .5-1 1-1 2M12 18h.01"/></g>`,
};
const COLUMNS = 5;

export interface WorkshopScreen {
  isOpen(): boolean;
  open(target: string, now: number): void;
  close(): void;
  onEvent(event: GameEvent, me: PlayerIndex, now: number): void;
  frame(world: ReadonlyWorld, me: PlayerIndex, now: number): void;
  key(code: string, now: number): boolean;
  dispose(): void;
}

interface JobView {
  readonly plan: string;
  readonly by: PlayerIndex;
  progress: number;
}

export function createWorkshopScreen(
  root: HTMLElement,
  content: Content,
  send: (intent: Intent) => void,
  keyLabel: (code: string) => string,
  openGuardMs: number,
  reduced: () => boolean,
): WorkshopScreen {
  const layer = el('div', { class: 'shop-layer ws-layer' });
  layer.innerHTML = `<svg width="0" height="0" style="position:absolute" aria-hidden="true">${Object.entries(
    SYMBOLS,
  )
    .map(([id, body]) => `<symbol id="lpl-i-${id}" viewBox="0 0 24 24">${body}</symbol>`)
    .join('')}</svg>`;
  layer.hidden = true;
  root.append(layer);
  layer.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
  });

  let ui: WorkshopUiState | null = null;
  let model: WorkshopModel | null = null;
  let job: JobView | null = null;
  let openedAt = 0;
  let drawn = '';
  let message: { text: string; until: number; mood: 'yes' | 'no' | 'joy' } | null = null;
  let last: { world: ReadonlyWorld; me: PlayerIndex } | null = null;

  function setUi(patch: Partial<WorkshopUiState>): void {
    if (ui === null) return;
    ui = { ...ui, ...patch };
    if (last !== null) render(last.world, last.me, true);
  }

  function say(text: string, mood: 'yes' | 'no' | 'joy', ms = 1800): void {
    message = { text, until: performance.now() + ms, mood };
    drawn = '';
    if (last !== null) render(last.world, last.me, true);
  }

  function keyChip(code: string): HTMLElement {
    return el('span', { class: 'key', text: keyLabel(code) });
  }

  /** Entrée ou Espace: le geste de l'onglet, ou un coup sur l'ouvrage en cours. */
  function confirm(): void {
    const m = model;
    if (ui === null || m === null) return;
    if (job !== null && m.tab === 'make') {
      send({ type: 'craft_strike', target: ui.target });
      return;
    }
    const d = m.detail;
    if (d === null) return;
    const blocked: Partial<Record<WorkshopTile['state'], string>> = {
      unknown: 'unknown-plan',
      missing: 'missing-materials',
      'too-expensive': 'not-enough-money',
      sharp: m.tab === 'sharpen' ? 'sharp-enough' : 'already-sharp',
      pending: 'order-pending',
      cannot: 'cannot-sharpen',
    };
    const reason = blocked[d.state];
    if (reason !== undefined) {
      say(workshopRefusalText(reason) ?? '', 'no');
      return;
    }
    if (m.tab === 'make' && d.plan !== null)
      send({ type: 'craft_start', target: ui.target, plan: d.plan, variant: m.variant });
    else if (m.tab !== 'make' && d.slot !== null)
      send({ type: 'craft_tool', target: ui.target, slot: d.slot, job: m.tab });
  }

  function wearArc(ratio: number): HTMLElement {
    const node = el('span', {
      class: `ws-wear${ratio <= 0 ? ' ws-wear--blunt' : ''}`,
      role: 'img',
      'aria-label': `${T.wear} ${String(Math.round(ratio * 100))} %`,
    });
    node.style.setProperty('--wear', String(ratio));
    return node;
  }

  function tileNode(tile: WorkshopTile, index: number): HTMLElement {
    const unknown = tile.state === 'unknown';
    const node = el('button', {
      class: `shop-tile ws-tile ws-tile--${tile.state}${model?.focus === index ? ' focus' : ''}`,
      'aria-label': unknown ? T.unknown : tile.name,
      'data-index': index,
    });
    if (unknown) node.append(icon('ws-question', 'ic ws-tile__q'));
    else node.innerHTML = itemThumb(tile.item, tile.name);
    if (tile.wear !== null) node.append(wearArc(tile.wear));
    if (tile.cents !== null && tile.cents > 0)
      node.append(
        el(
          'span',
          {
            class: `pastille shop-tile__price${tile.state === 'too-expensive' ? ' shop-tile__price--no' : ''}`,
          },
          [el('span', { class: 'coin coin--sm' }), formatEuros(tile.cents)],
        ),
      );
    if (tile.state === 'missing' || tile.state === 'cannot')
      node.append(icon('refus', 'ic shop-tile__no'));
    if (tile.state === 'ok' && tile.made === 0 && tile.plan !== null && model?.tab === 'make')
      node.append(el('span', { class: 'ws-new', 'aria-hidden': 'true', text: '★' }));
    if (tile.later) node.append(icon('ws-sun', 'ic ws-later'));
    if (model?.focus === index)
      node.append(el('span', { class: 'shop-nametag', text: unknown ? T.unknown : tile.name }));
    node.addEventListener('click', () => {
      setUi({ focus: index });
    });
    return node;
  }

  function materialRow(d: WorkshopTile): HTMLElement | null {
    if (d.materials.length === 0) return null;
    return el(
      'div',
      { class: 'ws-materials', role: 'list' },
      d.materials.map((m) => {
        const have = m.pockets + m.chests;
        const short = have < m.need;
        const label =
          fill(T.material, { objet: m.name, a: Math.min(have, m.need), n: m.need }) +
          (m.chests > 0 ? `, ${fill(T.fromChest, { n: Math.min(m.chests, m.need) })}` : '');
        const node = el('span', {
          class: `ws-mat${short ? ' ws-mat--short' : ''}`,
          role: 'listitem',
          'aria-label': label,
          title: label,
        });
        const pic = el('span', { class: 'ws-mat__pic' });
        pic.innerHTML = itemThumb(m.item, m.name);
        node.append(
          pic,
          el('span', {
            class: 'ws-mat__n',
            text: `${String(Math.min(have, 99))}/${String(m.need)}`,
          }),
        );
        if (m.chests > 0 && m.pockets < m.need) node.append(icon('ws-chest', 'ic ws-mat__chest'));
        if (short) node.append(icon('refus', 'ic ws-mat__no'));
        return node;
      }),
    );
  }

  function render(world: ReadonlyWorld, me: PlayerIndex, force = false): void {
    if (ui === null) return;
    model = workshopModel(content, world, me, ui);
    if (model === null) {
      close();
      return;
    }
    const now = performance.now();
    if (message !== null && now > message.until) message = null;
    const signature = JSON.stringify([
      ui,
      model.tiles,
      model.variant,
      job,
      world.players[me].money,
      message?.text,
    ]);
    if (!force && signature === drawn) return;
    drawn = signature;
    const m = model;

    const progress = job === null ? null : job.progress;
    const bench = el('aside', { class: 'shop-keeper ws-station' }, [
      el(
        'div',
        { class: `ws-station__pic${message?.mood === 'joy' ? ' ws-station__pic--joy' : ''}` },
        [icon(`ws-${m.station}`, 'ic')],
      ),
      message === null
        ? null
        : el('div', {
            class: `shop-say shop-say--${message.mood}`,
            role: 'status',
            text: message.text,
          }),
      message?.mood === 'joy' && !reduced()
        ? el('div', { class: 'ws-party', 'aria-hidden': 'true' }, [
            ...Array.from({ length: 8 }, (_, i) => {
              const s = el('span', {});
              s.style.setProperty('--i', String(i));
              return s;
            }),
          ])
        : null,
      progress === null
        ? null
        : el(
            'div',
            {
              class: 'ws-progress',
              role: 'progressbar',
              'aria-valuenow': String(Math.round(progress * 100)),
            },
            [
              el('span', {
                class: 'ws-progress__fill',
                style: `transform:scaleX(${String(progress)})`,
              }),
            ],
          ),
      el('div', { class: 'shop-keeper__counter' }, [
        el('div', { class: 'shop-keeper__plate' }, [icon(`ws-${m.station}`), m.name]),
      ]),
    ]);

    const tabButton = (id: CraftService): HTMLElement => {
      const b = el(
        'button',
        { class: 'shop-bigtab', role: 'tab', 'aria-selected': String(m.tab === id) },
        [icon(`ws-${id}`), T.tabs[id]],
      );
      b.addEventListener('click', () => {
        setUi({ tab: id, focus: 0, variant: 0 });
      });
      return b;
    };
    const shelves = el('section', { class: 'shop-shelves' }, [
      el('div', { class: 'shop-bigtabs', role: 'tablist' }, m.tabs.map(tabButton)),
      m.tiles.length === 0
        ? el('p', { class: 'shop-empty', text: m.tab === 'make' ? T.nothingMake : T.nothingTool })
        : el(
            'div',
            { class: 'shop-grid ws-grid', role: 'grid', 'aria-label': T.tabs[m.tab] },
            m.tiles.map((t, i) => tileNode(t, i)),
          ),
      el('div', { class: 'shop-foot' }, [
        m.tabs.length > 1 ? el('span', {}, [keyChip('KeyQ'), keyChip('KeyE'), T.keysTabs]) : null,
        (m.detail?.colors.length ?? 0) > 1
          ? el('span', {}, [keyChip('KeyA'), keyChip('KeyD'), T.keysColor])
          : null,
        el('span', {}, [keyChip('Backspace'), T.keysClose]),
      ]),
    ]);

    const side = el('aside', { class: 'shop-side', 'aria-live': 'polite' });
    const d = m.detail;
    if (d !== null) {
      const unknown = d.state === 'unknown';
      const thumb = el('div', { class: 'shop-v3d' });
      if (unknown) thumb.append(icon('ws-question', 'ic ws-big-q'));
      else thumb.innerHTML = itemThumb(d.to ?? d.item, d.name);
      thumb.append(el('span', { class: 'provisoire shop-v3d__tag', text: T.provisional }));
      const swatches =
        d.colors.length > 1
          ? el(
              'div',
              { class: 'ws-colors', role: 'radiogroup' },
              d.colors.map((c, i) => {
                const b = el('button', {
                  class: `ws-color${i === m.variant ? ' ws-color--on' : ''}`,
                  role: 'radio',
                  'aria-checked': String(i === m.variant),
                  'aria-label': c.name,
                  style: `background:${c.color}`,
                });
                b.addEventListener('click', () => {
                  setUi({ variant: i });
                });
                return b;
              }),
            )
          : null;
      const facts = el('div', { class: 'shop-row' }, [
        d.wear !== null ? el('span', { class: 'pastille' }, [wearArc(d.wear)]) : null,
        d.to !== null
          ? el(
              'span',
              { class: 'pastille', role: 'img', 'aria-label': content.items[d.to]?.name ?? d.to },
              [icon('ws-upgrade'), content.items[d.to]?.name ?? d.to],
            )
          : null,
        d.later ? el('span', { class: 'pastille' }, [icon('ws-sun'), T.later]) : null,
        d.made > 0 ? el('span', { class: 'pastille', text: `×${String(d.made)}` }) : null,
        m.order !== null && m.tab === 'upgrade'
          ? el('span', { class: 'pastille pastille--full' }, [
              icon('ws-sun'),
              fill(T.ready, { jour: m.order.day }),
            ])
          : null,
      ]);
      const total =
        d.cents !== null && d.cents > 0
          ? el('div', { class: 'shop-total', role: 'img', 'aria-label': formatEuros(d.cents) }, [
              el('span', { class: 'coin' }),
              formatEuros(d.cents),
            ])
          : null;
      const working = job !== null && m.tab === 'make';
      const verb = working ? T.strike : m.tab === 'sharpen' ? T.turn : T.tabs[m.tab];
      const off = !working && d.state !== 'ok';
      const action = el('button', { class: `shop-btn${off ? ' shop-btn--off' : ''}` }, [
        keyChip(working ? 'Space' : 'Enter'),
        verb,
      ]);
      action.addEventListener('click', confirm);
      const reasons: Partial<Record<WorkshopTile['state'], string>> = {
        unknown: T.unknown,
        missing: workshopRefusalText('missing-materials') ?? '',
        'too-expensive': workshopRefusalText('not-enough-money') ?? '',
        pending: T.pending,
        cannot: workshopRefusalText('cannot-sharpen') ?? '',
        sharp: workshopRefusalText(m.tab === 'sharpen' ? 'sharp-enough' : 'already-sharp') ?? '',
      };
      side.append(
        thumb,
        el('h2', { text: unknown ? T.unknown : d.name }),
        swatches ?? '',
        facts,
        materialRow(d) ?? '',
        total ?? '',
        action,
      );
      const why = working ? undefined : reasons[d.state];
      if (why !== undefined) side.append(el('p', { class: 'shop-why' }, [icon('refus'), why]));
    }

    const panel = el(
      'main',
      { class: 'shop ws', role: 'dialog', 'aria-label': fill(T.label, { poste: m.name }) },
      [bench, shelves, side],
    );
    const previous = layer.querySelector('.shop');
    if (previous === null) layer.append(panel);
    else {
      panel.classList.add('shop--still');
      previous.replaceWith(panel);
    }
  }

  function close(): void {
    if (ui !== null && job !== null && last !== null && job.by === last.me)
      send({ type: 'craft_cancel', target: ui.target });
    ui = null;
    model = null;
    job = null;
    message = null;
    drawn = '';
    layer.hidden = true;
    layer.querySelector('.shop')?.remove();
  }

  return {
    isOpen() {
      return ui !== null;
    },
    open(target, now) {
      ui = { target, tab: 'make', focus: 0, variant: 0 };
      openedAt = now;
      drawn = '';
      message = null;
      job = null;
      layer.hidden = false;
      layer.querySelector('.shop')?.remove();
    },
    close,
    onEvent(event, me, now) {
      const here = (target: string): boolean => ui !== null && ui.target === target;
      // eslint-disable-next-line @typescript-eslint/switch-exhaustiveness-check -- l'atelier n'écoute que ses événements et les refus
      switch (event.type) {
        case 'workshop_opened':
          if (event.player === me) this.open(event.target, now);
          return;
        case 'craft_started':
          if (here(event.target)) job = { plan: event.plan, by: event.player, progress: 0 };
          drawn = '';
          return;
        case 'craft_hit':
          if (here(event.target)) {
            job ??= { plan: event.plan, by: event.player, progress: 0 };
            job.progress = event.progress;
            drawn = '';
          }
          return;
        case 'craft_cancelled':
          if (here(event.target)) job = null;
          drawn = '';
          return;
        case 'crafted':
          if (here(event.target)) {
            job = null;
            say(
              event.first ? T.firstCraft : event.together ? T.together : T.crafted,
              event.first || event.together ? 'joy' : 'yes',
              event.first ? 2600 : 1800,
            );
          }
          return;
        case 'plan_learned':
          if (event.player === me) say(T.learned, 'joy', 2600);
          return;
        case 'tool_upgraded':
          if (event.player === me && ui !== null) say(T.upgraded, 'joy');
          return;
        case 'tool_ordered':
          if (event.player === me && ui !== null) say(T.ordered, 'yes');
          return;
        case 'tool_mended':
          if (event.player === me && ui !== null) say(T.mended, 'yes');
          return;
        case 'tool_sharpened':
          if (event.player === me && ui !== null) say(T.sharpened, 'yes', 900);
          return;
        case 'refused':
          if (event.player === me && event.target !== null && here(event.target))
            say(workshopRefusalText(event.reason) ?? '', 'no');
          return;
        default:
          return;
      }
    },
    frame(world, me) {
      last = { world, me };
      if (ui !== null) render(world, me);
    },
    key(code, now) {
      if (ui === null) return false;
      if (now - openedAt < openGuardMs) return true;
      const m = model;
      const count = m?.tiles.length ?? 0;
      const moveFocus = (delta: number): void => {
        if (count === 0) return;
        setUi({ focus: Math.min(count - 1, Math.max(0, (m?.focus ?? 0) + delta)), variant: 0 });
      };
      const cycleTab = (delta: number): void => {
        if (m === null) return;
        const i = m.tabs.indexOf(m.tab);
        const next = m.tabs[(i + delta + m.tabs.length) % m.tabs.length];
        if (next !== undefined) setUi({ tab: next, focus: 0, variant: 0 });
      };
      switch (code) {
        case 'KeyQ':
          cycleTab(-1);
          return true;
        case 'KeyE':
          cycleTab(1);
          return true;
        case 'KeyA':
          setUi({ variant: Math.max(0, (m?.variant ?? 0) - 1) });
          return true;
        case 'KeyD':
          setUi({
            variant: Math.min(
              Math.max(0, (m?.detail?.colors.length ?? 1) - 1),
              (m?.variant ?? 0) + 1,
            ),
          });
          return true;
        case 'ArrowLeft':
          moveFocus(-1);
          return true;
        case 'ArrowRight':
          moveFocus(1);
          return true;
        case 'ArrowUp':
        case 'KeyW':
          moveFocus(-COLUMNS);
          return true;
        case 'ArrowDown':
        case 'KeyS':
          moveFocus(COLUMNS);
          return true;
        case 'Enter':
        case 'Space':
          confirm();
          return true;
        case 'Backspace':
        case 'Escape':
          close();
          return true;
        default:
          return true;
      }
    },
    dispose() {
      layer.remove();
    },
  };
}
