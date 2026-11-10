/**
 * Petites aides DOM: création d'éléments, pictos du sprite, mises à jour qui ne touchent le DOM
 * que si la valeur change (une vue ne se redessine qu'à son changement).
 */
type Attrs = Readonly<Record<string, string | number | boolean | null | undefined>>;
type Child = Node | string | null | undefined | false;

const SVG_NS = 'http://www.w3.org/2000/svg';

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
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child);
  }
  return node;
}

/** Picto du sprite (`pictos.ts`), décoratif. */
export function icon(id: string, className = 'ic'): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', className);
  svg.setAttribute('aria-hidden', 'true');
  const use = document.createElementNS(SVG_NS, 'use');
  use.setAttribute('href', `#lpl-i-${id}`);
  svg.append(use);
  return svg;
}

export function setText(node: Element, text: string): void {
  if (node.textContent !== text) node.textContent = text;
}

export function setAttr(node: Element, name: string, value: string): void {
  if (node.getAttribute(name) !== value) node.setAttribute(name, value);
}

export function toggle(node: Element, className: string, on: boolean): void {
  if (node.classList.contains(className) !== on) node.classList.toggle(className, on);
}

export function show(node: HTMLElement, on: boolean): void {
  if (node.hidden === on) node.hidden = !on;
}
