/**
 * Petites aides DOM de l'interface: création d'éléments, icônes du sprite,
 * mises à jour qui ne touchent le DOM que si la valeur change. Tout texte
 * posé par ces aides (contenu, `aria-label`, `title`) passe par la
 * typographie française (idempotente).
 */
import { typographier } from './typographie';

const SVG_NS = 'http://www.w3.org/2000/svg';
const READ_ATTRIBUTES = new Set(['aria-label', 'title', 'placeholder', 'alt']);

type Attrs = Readonly<Record<string, string | number | boolean | null | undefined>>;
type Child = Node | string | null | undefined | false;

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Attrs = {},
  children: readonly Child[] = [],
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [name, value] of Object.entries(attrs)) {
    if (value === null || value === undefined || value === false) continue;
    if (name === 'class') node.className = String(value);
    else if (name === 'text') node.textContent = typographier(String(value));
    else if (READ_ATTRIBUTES.has(name)) node.setAttribute(name, typographier(String(value)));
    else node.setAttribute(name, value === true ? '' : String(value));
  }
  append(node, children);
  return node;
}

export function append(node: Node, children: readonly Child[]): void {
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    node.appendChild(typeof child === 'string' ? document.createTextNode(typographier(child)) : child);
  }
}

/** Icône du sprite (`<svg><use href="#id"/></svg>`), décorative. */
export function icon(id: string, className = 'lpl-icon'): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  if (className !== '') svg.setAttribute('class', className);
  svg.setAttribute('aria-hidden', 'true');
  const use = document.createElementNS(SVG_NS, 'use');
  use.setAttribute('href', `#${id}`);
  svg.appendChild(use);
  return svg;
}

/** Change l'icône d'un `<svg><use>` créé par `icon`. */
export function setIcon(svg: SVGSVGElement, id: string): void {
  const use = svg.firstElementChild;
  const href = `#${id}`;
  if (use !== null && use.getAttribute('href') !== href) use.setAttribute('href', href);
}

export function setText(node: Node, text: string): void {
  const value = typographier(text);
  if (node.textContent !== value) node.textContent = value;
}

export function setAttr(node: Element, name: string, value: string | null): void {
  if (value === null) {
    if (node.hasAttribute(name)) node.removeAttribute(name);
    return;
  }
  const v = READ_ATTRIBUTES.has(name) ? typographier(value) : value;
  if (node.getAttribute(name) !== v) node.setAttribute(name, v);
}

export function setHidden(node: Element, hidden: boolean): void {
  if (node.hasAttribute('hidden') !== hidden) node.toggleAttribute('hidden', hidden);
}

export function setStyleVar(node: HTMLElement | SVGElement, name: string, value: string): void {
  if (node.style.getPropertyValue(name) !== value) node.style.setProperty(name, value);
}

export function clear(node: Node): void {
  while (node.firstChild !== null) node.removeChild(node.firstChild);
}

/** Jeton d'un joueur: symbole du profil Duo dans sa couleur, cerclé d'encre. */
export function token(player: 'self' | 'other', symbol: string, size: '' | 'small' | 'large' = ''): HTMLSpanElement {
  const span = el('span', {
    class: `lpl-token${size === '' ? '' : ` lpl-token--${size}`}`,
    'data-player': player,
    'aria-hidden': 'true',
  });
  span.appendChild(icon(`player-${symbol}`, ''));
  return span;
}

export function keycap(label: string): HTMLSpanElement {
  return el('span', { class: 'lpl-key', text: label });
}

/** Ligne de raccourcis (`.lpl-keys`): groupes de touches suivis d'un mot. */
export function keysLine(groups: readonly { keys: readonly string[]; text: string; between?: string }[]): HTMLSpanElement {
  const line = el('span', { class: 'lpl-keys' });
  for (const g of groups) {
    const span = el('span');
    g.keys.forEach((k, i) => {
      if (i > 0 && g.between !== undefined) span.append(` ${g.between} `);
      span.append(keycap(k));
    });
    span.append(` ${g.text}`);
    line.append(span);
  }
  return line;
}

export function chip(text: string, variant: '' | 'ready' | 'waiting' | 'alert' | 'night' = '', iconId: string | null = null): HTMLSpanElement {
  const span = el('span', { class: `lpl-chip${variant === '' ? '' : ` lpl-chip--${variant}`}` });
  if (iconId !== null) span.append(icon(iconId));
  span.append(text);
  return span;
}

/** Portrait rond (SVG fourni par `portrait.ts`), avec un jeton facultatif. */
export function portrait(svg: string, size: '' | 'small' | 'large', badge: HTMLElement | null = null): HTMLSpanElement {
  const span = el('span', { class: `lpl-portrait${size === '' ? '' : ` lpl-portrait--${size}`}` });
  setPortrait(span, svg);
  if (badge !== null) span.append(badge);
  return span;
}

/** Remplace le dessin d'un portrait sans toucher à son jeton. */
export function setPortrait(span: HTMLElement, svg: string): void {
  if (span.dataset.svg === svg) return;
  span.dataset.svg = svg;
  const badge = span.querySelector(':scope > .lpl-token');
  // Le SVG vient de `portraitSvg` (couleurs contrôlées, libellé échappé).
  span.innerHTML = svg;
  if (badge !== null) span.append(badge);
}

/** Bouton de l'interface. */
export function button(
  label: string | readonly Child[],
  onClick: () => void,
  options: { class?: string; disabledReason?: boolean; attrs?: Attrs } = {},
): HTMLButtonElement {
  const b = el('button', { type: 'button', class: options.class ?? 'lpl-button', ...options.attrs });
  if (typeof label === 'string') b.textContent = typographier(label);
  else append(b, label);
  b.addEventListener('click', () => {
    if (b.getAttribute('aria-disabled') === 'true' || b.disabled) return;
    onClick();
  });
  return b;
}

/** Éléments focalisables visibles d'un conteneur, dans l'ordre du document. */
export function focusables(container: Element): HTMLElement[] {
  const list = container.querySelectorAll<HTMLElement>('button, input, [tabindex="0"], a[href]');
  return [...list].filter((e) => isVisible(e) && !(e as HTMLButtonElement).disabled && e.tabIndex >= 0);
}

export function isVisible(node: Element): boolean {
  return node.isConnected && node.getClientRects().length > 0 && node.closest('[hidden]') === null;
}

export function focusElement(node: HTMLElement | null | undefined): boolean {
  if (node === null || node === undefined || !isVisible(node)) return false;
  // Pas de défilement au centre: seulement ce qu'il faut pour voir l'élément (revue du DA,
  // le carnet s'ouvrait défilé, la première carte coupée sous les onglets).
  node.focus({ preventScroll: true });
  node.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  if (node instanceof HTMLInputElement && node.type === 'text') {
    node.setSelectionRange(node.value.length, node.value.length);
  }
  return true;
}

/**
 * Un clic sur un bouton du HUD laisse le clavier au jeu (Z Q S D, Espace): le
 * bouton ne prend pas le focus au pointeur, et le rend s'il l'avait quand
 * même. Sinon Espace, que le SDK capte, le réactiverait (rotation de caméra
 * parasite).
 */
export function keepFocusOnGame(b: HTMLButtonElement): void {
  const noFocus = (e: Event): void => {
    e.preventDefault();
  };
  b.addEventListener('pointerdown', noFocus);
  b.addEventListener('mousedown', noFocus);
  b.addEventListener('click', (e) => {
    // `detail` > 0: activation au pointeur (un clic du clavier ou du code vaut 0).
    if (e.detail > 0 && document.activeElement === b) b.blur();
  });
}
