/**
 * Petites aides DOM de l'interface: création d'éléments, icônes du sprite,
 * mises à jour qui ne touchent le DOM que si la valeur change.
 */

const SVG_NS = 'http://www.w3.org/2000/svg';

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
    else if (name === 'text') node.textContent = String(value);
    else node.setAttribute(name, value === true ? '' : String(value));
  }
  append(node, children);
  return node;
}

export function append(node: Node, children: readonly Child[]): void {
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    node.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
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
  if (node.textContent !== text) node.textContent = text;
}

export function setAttr(node: Element, name: string, value: string | null): void {
  if (value === null) {
    if (node.hasAttribute(name)) node.removeAttribute(name);
  } else if (node.getAttribute(name) !== value) {
    node.setAttribute(name, value);
  }
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
  if (typeof label === 'string') b.textContent = label;
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
  node.focus({ preventScroll: false });
  if (node instanceof HTMLInputElement && node.type === 'text') {
    node.setSelectionRange(node.value.length, node.value.length);
  }
  return true;
}
