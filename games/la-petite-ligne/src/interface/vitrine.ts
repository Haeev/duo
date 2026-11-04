/**
 * Interface imagée du patch 0.12.2 (`docs/jeux/jeu-1/interface-imagee-0-12-2.md`): la vitrine
 * (grille de vignettes paginée et panneau de détail de la sélection), les pastilles, les jauges,
 * les compteurs « possédés / requis » et les petites animations (rebond, pièce qui vole, jauge qui
 * se remplit), coupées par la réduction des animations.
 *
 * Règles de la vitrine: le focus est la sélection; Entrée sur la vignette choisie fait l'action
 * principale; à la souris, un premier clic choisit, un clic sur la vignette déjà choisie agit.
 * Le nom de l'objet ne s'affiche qu'à la sélection et au survol.
 */
import type { UiHost } from './composant';
import { button, clear, el, icon, keycap, svgEl } from './dom';
import { SOUND_ATTR } from './sons';

// ---------------------------------------------------------------------------
// Pastilles, jauges, compteurs

export type PastilleTone = 'price' | 'count' | 'ok' | 'missing' | 'info' | 'wait';

export interface PastilleSpec {
  icon: string | null;
  text?: string;
  tone?: PastilleTone;
  /** Nom accessible (sinon, le texte). */
  label?: string;
  /** Barrée: ce qui manque ou n'est pas fait (la couleur n'est jamais seule). */
  crossed?: boolean;
}

/** Pastille: une icône et un nombre (ou un mot très court). */
export function pastille(p: PastilleSpec): HTMLSpanElement {
  const label = p.label ?? p.text ?? '';
  const span = el('span', {
    class: `lpl-pastille lpl-pastille--${p.tone ?? 'info'}`,
    'data-crossed': p.crossed === true ? 'true' : null,
    role: label === '' ? null : 'img',
    'aria-label': label === '' ? null : label,
    title: label === '' ? null : label,
  });
  if (p.icon !== null) span.append(icon(p.icon, 'lpl-icon lpl-pastille__icon'));
  if (p.text !== undefined && p.text !== '') span.append(el('span', { class: 'lpl-pastille__text', 'aria-hidden': 'true', text: p.text }));
  return span;
}

export interface GaugeSpec {
  /** Icône à gauche, ou `null` quand la tuile qui porte la jauge a déjà la sienne. */
  icon: string | null;
  /** De 0 à 1. */
  value: number;
  label: string;
  /** Texte court à droite (« 12 »), facultatif. */
  text?: string;
  tone?: 'heart' | 'food' | 'fresh' | 'neutral';
}

/** Jauge horizontale avec son icône; le remplissage s'anime à l'arrivée (sauf animations réduites). */
export function gauge(g: GaugeSpec): HTMLSpanElement {
  const v = Math.max(0, Math.min(1, g.value));
  const level = v < 0.34 ? 'low' : v < 0.67 ? 'mid' : 'high';
  return el(
    'span',
    {
      class: `lpl-gauge lpl-gauge--${g.tone ?? 'neutral'}`,
      role: 'meter',
      'aria-valuemin': '0',
      'aria-valuemax': '100',
      'aria-valuenow': String(Math.round(v * 100)),
      'aria-label': g.label,
      title: g.label,
      'data-level': level,
    },
    [
      g.icon === null ? null : icon(g.icon, 'lpl-icon lpl-gauge__icon'),
      el('span', { class: 'lpl-gauge__track', 'aria-hidden': 'true' }, [el('span', { class: 'lpl-gauge__fill', style: `--lpl-value: ${String(Math.round(v * 100))}%` })]),
      g.text === undefined ? null : el('span', { class: 'lpl-gauge__text', 'aria-hidden': 'true', text: g.text }),
    ],
  );
}

export interface NeedSpec {
  icon: string;
  have: number;
  need: number;
  /** « Œufs: 2 sur 3 » (nom accessible). */
  label: string;
}

/** Un ingrédient ou une condition: icône et « possédés / requis », grisée et barrée s'il en manque. */
export function need(n: NeedSpec): HTMLSpanElement {
  const missing = n.have < n.need;
  return el(
    'span',
    { class: 'lpl-need-count', 'data-missing': missing ? 'true' : null, role: 'img', 'aria-label': n.label, title: n.label },
    [
      icon(n.icon, 'lpl-icon lpl-need-count__icon'),
      el('span', { class: 'lpl-need-count__text', 'aria-hidden': 'true' }, [el('strong', { text: String(Math.min(n.have, 99)) }), `/${String(n.need)}`]),
    ],
  );
}

/** Rangée d'icônes « actif / inactif » (saisons, moments): l'inactive grisée et barrée. */
export function iconRow(items: readonly { icon: string; on: boolean; label: string }[], label: string): HTMLSpanElement {
  return el(
    'span',
    { class: 'lpl-icon-row', role: 'img', 'aria-label': label },
    items.map((i) => el('span', { class: 'lpl-icon-row__item', 'data-on': i.on ? 'true' : 'false', title: i.label, 'aria-hidden': 'true' }, [icon(i.icon)])),
  );
}

// ---------------------------------------------------------------------------
// Animations

/** Animations réduites: réglage de Duo, sinon celui de l'ordinateur (comme `jeton.css`). */
export function motionReduced(): boolean {
  const motion = document.documentElement.dataset.motion;
  if (motion === 'reduced') return true;
  if (motion === 'full') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Durée d'une animation de la vitrine (ms), alignée sur `--lpl-duration-slow`. */
const FLIGHT_MS = 480;

/**
 * Une pièce qui vole de la bourse du HUD vers `target` (achat) ou de `target` vers la bourse
 * (vente). Rien avec les animations réduites, ni sans bourse visible.
 */
export function flyCoin(target: Element, direction: 'buy' | 'sell'): void {
  if (motionReduced()) return;
  const purse = document.querySelector('.lpl-purse');
  const layer = document.querySelector('.lpl-ui');
  if (purse === null || layer === null) return;
  const a = purse.getBoundingClientRect();
  const b = target.getBoundingClientRect();
  const from = direction === 'buy' ? a : b;
  const to = direction === 'buy' ? b : a;
  const coin = el('span', { class: 'lpl-coin-flight', 'aria-hidden': 'true' }, [icon('ui-coin')]);
  layer.append(coin);
  const x0 = from.left + Math.min(from.width, 40) / 2;
  const y0 = from.top + from.height / 2;
  const x1 = to.left + to.width / 2;
  const y1 = to.top + to.height / 2;
  const lift = Math.min(120, Math.abs(x1 - x0) / 3 + 40);
  const animation = coin.animate(
    [
      { transform: `translate(${String(x0)}px, ${String(y0)}px) scale(0.6)`, opacity: 0 },
      { transform: `translate(${String((x0 + x1) / 2)}px, ${String(Math.min(y0, y1) - lift)}px) scale(1.15)`, opacity: 1, offset: 0.5 },
      { transform: `translate(${String(x1)}px, ${String(y1)}px) scale(0.8)`, opacity: 0.2 },
    ],
    { duration: FLIGHT_MS, easing: 'cubic-bezier(0.3, 0.6, 0.4, 1)' },
  );
  animation.onfinish = (): void => {
    coin.remove();
  };
  animation.oncancel = (): void => {
    coin.remove();
  };
}

// ---------------------------------------------------------------------------
// Vitrine

export interface TileSpec {
  /** Symbole du sprite, ou un dessin déjà construit (silhouette, portrait). */
  icon: string | Node;
  /** Nom accessible complet (nom, prix, état). */
  label: string;
  /** Nom affiché au survol et à la sélection. */
  name: string;
  /** Pastille en haut à droite (prix, quantité). */
  badge?: PastilleSpec | null;
  /** Marque en haut à gauche (cadenas, coche, sablier, étoile, jeton de l'autre joueur). */
  corner?: string | Node | null;
  /** `missing`: grisée (manque d'argent, d'ingrédients); `done`, `wait`, `locked`. */
  state?: 'missing' | 'done' | 'wait' | 'locked' | null;
  /** Rangée sous l'icône (ingrédients d'une recette). */
  below?: Node | null;
  className?: string;
  attrs?: Readonly<Record<string, string | null>>;
}

export interface VitrineItem {
  key: string;
  tile: TileSpec;
  /** Contenu du panneau de détail quand la vignette est choisie. */
  detail: () => readonly (Node | null)[];
  /** Action principale (Entrée sur la vignette choisie, ou second clic); faux si elle est refusée. */
  act?: (tile: HTMLButtonElement) => boolean;
}

export interface VitrineOptions {
  /** Vignettes par page. */
  perPage: number;
  /** Nom de la grille (lecteurs d'écran). */
  label: string;
  /** Classe de mise en page (`lpl-vitrine--recipes`...). */
  variant?: string;
  /** Sans panneau de détail (la rangée « Manger »). */
  noDetail?: boolean;
}

/**
 * Grille de vignettes paginée avec son panneau de détail. L'objet garde la page et la sélection
 * d'un rendu à l'autre du panneau (le corps est reconstruit quand l'état change).
 */
export class Vitrine {
  page = 0;
  private selected: string | null = null;
  private items: VitrineItem[] = [];
  private tiles = new Map<string, HTMLButtonElement>();
  private detailBox: HTMLElement | null = null;
  private pressedSelected = false;
  private readonly host: UiHost;
  private readonly options: VitrineOptions;

  constructor(host: UiHost, options: VitrineOptions) {
    this.host = host;
    this.options = options;
  }

  get pageCount(): number {
    return Math.max(1, Math.ceil(this.items.length / this.options.perPage));
  }

  /** La vignette choisie (clé), ou `null`. */
  get selection(): string | null {
    return this.selected;
  }

  /** Oublie page et sélection (changement d'onglet). */
  reset(): void {
    this.page = 0;
    this.selected = null;
  }

  /** Nombre de pages pour `count` vignettes (avant `build`, pour la signature du panneau). */
  pagesFor(count: number): number {
    return Math.max(1, Math.ceil(count / this.options.perPage));
  }

  /**
   * Page précédente ou suivante; faux s'il n'y en a pas (le panneau passe alors à l'onglet voisin).
   * Le focus va à la première vignette de la nouvelle page au rendu suivant (`Panel.renderBody`).
   */
  turn(delta: number): boolean {
    const next = this.page + delta;
    if (this.pageCount <= 1 || next < 0 || next >= this.pageCount) return false;
    this.page = next;
    this.selected = this.items[next * this.options.perPage]?.key ?? null;
    this.host.sound('ui-tab');
    // Le corps est reconstruit au prochain rafraîchissement: le focus y va à la vignette marquée `data-autofocus`.
    this.host.invalidate();
    return true;
  }

  /** Construit la vitrine. `defaultKey`: la vignette choisie à l'ouverture. */
  build(items: readonly VitrineItem[], defaultKey: string | null): HTMLElement {
    this.items = [...items];
    this.tiles = new Map();
    const per = this.options.perPage;
    const known = this.selected !== null && this.items.some((i) => i.key === this.selected);
    if (!known) {
      const fallback = defaultKey !== null && this.items.some((i) => i.key === defaultKey) ? defaultKey : (this.items[this.page * per]?.key ?? this.items[0]?.key ?? null);
      this.selected = fallback;
      const index = this.items.findIndex((i) => i.key === fallback);
      if (index >= 0) this.page = Math.floor(index / per);
    }
    this.page = Math.min(this.page, this.pageCount - 1);
    const shown = this.items.slice(this.page * per, this.page * per + per);
    if (!shown.some((i) => i.key === this.selected)) this.selected = shown[0]?.key ?? null;
    const grid = el('div', { class: 'lpl-vitrine__grid', 'data-nav': 'grid', role: 'group', 'aria-label': this.options.label });
    for (const item of shown) grid.append(this.tile(item));
    const main = el('div', { class: 'lpl-vitrine__main' }, [grid, this.pager()]);
    const nodes: HTMLElement[] = [main];
    if (this.options.noDetail !== true) {
      this.detailBox = el('div', { class: 'lpl-vitrine__detail' });
      this.fillDetail();
      nodes.push(this.detailBox);
    } else {
      this.detailBox = null;
    }
    return el('div', { class: `lpl-vitrine${this.options.variant === undefined ? '' : ` ${this.options.variant}`}` }, nodes);
  }

  private tile(item: VitrineItem): HTMLButtonElement {
    const t = item.tile;
    const figure = typeof t.icon === 'string' ? icon(t.icon, 'lpl-tile__icon') : t.icon;
    const selected = item.key === this.selected;
    const b = el(
      'button',
      {
        type: 'button',
        class: `lpl-tile${t.className === undefined ? '' : ` ${t.className}`}`,
        'data-nav-item': true,
        'data-key': item.key,
        'data-state': t.state ?? null,
        'data-selected': selected ? 'true' : null,
        'data-autofocus': selected,
        'aria-current': selected ? 'true' : null,
        'aria-label': t.label,
        [SOUND_ATTR]: 'none',
        ...t.attrs,
      },
      [
        el('span', { class: 'lpl-tile__figure', 'aria-hidden': 'true' }, [figure]),
        t.badge === undefined || t.badge === null ? null : el('span', { class: 'lpl-tile__badge', 'aria-hidden': 'true' }, [pastille({ ...t.badge, label: '' })]),
        t.corner === undefined || t.corner === null ? null : el('span', { class: 'lpl-tile__corner', 'aria-hidden': 'true' }, [typeof t.corner === 'string' ? icon(t.corner) : t.corner]),
        t.below === undefined || t.below === null ? null : el('span', { class: 'lpl-tile__below', 'aria-hidden': 'true' }, [t.below]),
        el('span', { class: 'lpl-tile__name', 'aria-hidden': 'true', text: t.name }),
      ],
    );
    this.tiles.set(item.key, b);
    b.addEventListener('focus', () => {
      this.select(item.key);
    });
    b.addEventListener('pointerdown', () => {
      this.pressedSelected = this.selected === item.key;
    });
    b.addEventListener('click', (e) => {
      // Clic de la souris (`detail` > 0) sur une vignette pas encore choisie: on la choisit seulement.
      if (e.detail > 0 && !this.pressedSelected) {
        this.select(item.key);
        this.pressedSelected = true;
        return;
      }
      if (item.act === undefined) return;
      this.host.sound(item.act(b) ? 'ui-confirm' : 'ui-refusal');
    });
    return b;
  }

  private select(key: string): void {
    if (this.selected === key) return;
    this.selected = key;
    for (const [k, b] of this.tiles) {
      const on = k === key;
      b.toggleAttribute('data-selected', on);
      if (on) b.setAttribute('aria-current', 'true');
      else b.removeAttribute('aria-current');
    }
    this.fillDetail();
  }

  private fillDetail(): void {
    const box = this.detailBox;
    if (box === null) return;
    clear(box);
    const item = this.items.find((i) => i.key === this.selected);
    if (item === undefined) return;
    for (const node of item.detail()) if (node !== null) box.append(node);
  }

  private pager(): HTMLElement | null {
    const count = this.pageCount;
    if (count <= 1) return null;
    const { ctx } = this.host;
    const v = ctx.texts.extra.vitrine;
    const prev = button([keycap(ctx.key('KeyQ')), icon('ui-arrow-right', 'lpl-icon lpl-pager__back')], () => {
      this.turn(-1);
    }, { class: 'lpl-pager__button', attrs: { 'aria-label': ctx.t(v.previous, { key: ctx.key('KeyQ') }), 'aria-disabled': this.page === 0 ? 'true' : null, tabindex: '-1' } });
    const next = button([icon('ui-arrow-right'), keycap(ctx.key('KeyE'))], () => {
      this.turn(1);
    }, { class: 'lpl-pager__button', attrs: { 'aria-label': ctx.t(v.next, { key: ctx.key('KeyE') }), 'aria-disabled': this.page >= count - 1 ? 'true' : null, tabindex: '-1' } });
    const dots = el(
      'span',
      { class: 'lpl-pager__dots', role: 'img', 'aria-label': ctx.t(v.page, { page: this.page + 1, count }) },
      Array.from({ length: count }, (_, i) => el('span', { class: 'lpl-pager__dot', 'data-on': i === this.page ? 'true' : null })),
    );
    return el('div', { class: 'lpl-pager' }, [prev, dots, next]);
  }
}

/** Grand dessin du détail: l'icône dans un médaillon, avec un rebond à chaque nouvelle sélection. */
export function detailFigure(figure: string | Node, extraClass = ''): HTMLElement {
  return el('span', { class: `lpl-detail__figure${extraClass === '' ? '' : ` ${extraClass}`}`, 'aria-hidden': 'true' }, [typeof figure === 'string' ? icon(figure, 'lpl-detail__icon') : figure]);
}

/** En-tête du détail: dessin, nom, et une ligne courte facultative. */
export function detailHead(figure: string | Node, name: string, line: string | null, extraClass = ''): HTMLElement[] {
  const nodes: HTMLElement[] = [detailFigure(figure, extraClass), el('h3', { class: 'lpl-detail__name', text: name })];
  if (line !== null && line !== '') nodes.push(el('p', { class: 'lpl-detail__line', text: line }));
  return nodes;
}

/** Rangée de pastilles du détail. */
export function pastilles(list: readonly (PastilleSpec | null)[]): HTMLElement | null {
  const shown = list.filter((p): p is PastilleSpec => p !== null);
  if (shown.length === 0) return null;
  return el('div', { class: 'lpl-detail__pastilles' }, shown.map((p) => pastille(p)));
}

/** Rangée des boutons du détail. */
export function detailActions(nodes: readonly (HTMLElement | null)[]): HTMLElement {
  return el('div', { class: 'lpl-detail__actions' }, nodes);
}

// ---------------------------------------------------------------------------
// Dessins de la vitrine: silhouette d'un poisson pas encore pris, petite carte des coins

/**
 * Silhouette grise d'un poisson pas encore pris, à la taille de son ombre dans l'eau
 * (`shadowLength`, de 0,3 à 1,2 m): elle dit déjà s'il est petit ou grand.
 */
export function fishSilhouette(shadowLength: number): SVGSVGElement {
  const scale = Math.max(0.45, Math.min(1, 0.4 + shadowLength * 0.5));
  const svg = svgEl('svg', { class: 'lpl-fish-silhouette', viewBox: '0 0 26 24', 'aria-hidden': 'true' });
  const g = svgEl('g', { transform: `translate(13 12) scale(${scale.toFixed(2)}) translate(-13 -12)` });
  g.append(
    svgEl('path', { d: 'M3 12c3.2-4.6 8.4-6.2 13-6.2 2.6 0 4.4 1.6 5.6 3.4L25 6v12l-3.4-3.2c-1.2 1.8-3 3.4-5.6 3.4-4.6 0-9.8-1.6-13-6.2z' }),
    svgEl('circle', { cx: '7.4', cy: '11', r: '1', class: 'lpl-fish-silhouette__eye' }),
  );
  svg.append(g);
  const mark = svgEl('text', { x: '14', y: '15.5', 'text-anchor': 'middle', class: 'lpl-fish-silhouette__mark' });
  mark.textContent = '?';
  svg.append(mark);
  return svg;
}

/** Petite carte de la rivière et du ru: les coins où vit le poisson en bleu, les autres pâles. */
export function riverMap(zones: readonly { id: string; name: string; on: boolean; rects: readonly { x: number; y: number; w: number; h: number }[] }[], label: string): HTMLElement {
  const all = zones.flatMap((z) => z.rects);
  const minX = Math.min(...all.map((r) => r.x));
  const minY = Math.min(...all.map((r) => r.y));
  const maxX = Math.max(...all.map((r) => r.x + r.w));
  const maxY = Math.max(...all.map((r) => r.y + r.h));
  const svg = svgEl('svg', {
    class: 'lpl-river-map__svg',
    viewBox: `${String(minX - 1)} ${String(minY - 1)} ${String(maxX - minX + 2)} ${String(maxY - minY + 2)}`,
    preserveAspectRatio: 'none',
    'aria-hidden': 'true',
  });
  for (const z of zones) {
    for (const r of z.rects) {
      // Le ru n'a que deux cases de large: on l'élargit pour qu'il se voie sur la petite carte.
      const w = Math.max(r.w, 4);
      const rect = svgEl('rect', { x: String(r.x - (w - r.w) / 2), y: String(r.y), width: String(w), height: String(Math.max(r.h, 4)), class: 'lpl-river-map__zone', 'data-on': z.on ? 'true' : 'false' });
      const title = svgEl('title', {});
      title.textContent = z.name;
      rect.append(title);
      svg.append(rect);
    }
  }
  return el('div', { class: 'lpl-river-map', role: 'img', 'aria-label': label, title: label }, [icon('ui-pin', 'lpl-icon lpl-river-map__pin'), svg]);
}

/** Icône à plusieurs calques du sprite, le premier dessous (fond de rareté, puis le poisson). */
export function layeredIcon(ids: readonly string[], className: string): SVGSVGElement {
  const svg = svgEl('svg', { class: className, 'aria-hidden': 'true' });
  for (const id of ids) svg.append(svgEl('use', { href: `#${id}` }));
  return svg;
}
