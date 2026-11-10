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

/** Vrai si l'événement vient d'une souris qui a bougé (et pas d'un survol rejoué par la page). */
export function pointerMoved(event: Pick<MouseEvent, 'movementX' | 'movementY'>): boolean {
  return event.movementX !== 0 || event.movementY !== 0;
}

/**
 * Le survol donne le focus du clavier, mais seulement quand la souris bouge vraiment. Chromium
 * rejoue un survol quand le contenu passe sous un pointeur immobile (le carnet qui monte, une
 * liste redessinée): `mouseenter` faisait alors sauter le focus sur une case que le joueur n'a
 * jamais visée, et Entrée, P ou T agissaient sur cette case vide.
 */
export function onPointerHover(
  node: Pick<HTMLElement, 'addEventListener'>,
  hover: () => void,
): void {
  node.addEventListener('mousemove', (event) => {
    if (pointerMoved(event)) hover();
  });
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
