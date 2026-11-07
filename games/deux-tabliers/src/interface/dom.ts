/**
 * Petits outils DOM de l'interface: éléments, icônes au trait (grille de 24, trait de 1,75,
 * comme Duo), jeton de joueur, touches. Tout texte passe par `fr` (typographie française).
 */
import type { PlayerColorId } from '@duo/sdk';
import { PLAYER_SYMBOLS } from './symboles';
import { fr } from './typo';

type Child = Node | string | null | undefined | false;
type Props = Readonly<Record<string, string | number | boolean | null | undefined>>;

/** Crée un élément; les attributs `false`, `null` ou `undefined` sont omis. */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Props | null = null,
  ...children: readonly Child[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (props !== null) {
    for (const [key, value] of Object.entries(props)) {
      if (value === false || value === null || value === undefined) continue;
      if (key === 'class') el.className = String(value);
      else if (key === 'text') el.textContent = fr(String(value));
      else el.setAttribute(key, value === true ? '' : String(value));
    }
  }
  append(el, ...children);
  return el;
}

export function append(el: Element, ...children: readonly Child[]): void {
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    el.append(typeof c === 'string' ? fr(c) : c);
  }
}

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Icônes au trait de l'interface (chemins sur une grille de 24). */
const ICONS = {
  clock: 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18M12 7v5l3 2',
  sun: 'M12 8a4 4 0 1 0 0 8a4 4 0 1 0 0-8M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
  clouds: 'M7 18h10a4 4 0 0 0 0-8a6 6 0 0 0-11.5 1.5A3.3 3.3 0 0 0 7 18z',
  rain: 'M7 14h10a4 4 0 0 0 0-8a6 6 0 0 0-11.5 1.5A3.3 3.3 0 0 0 7 14zM8 17l-1 3M12 17l-1 3M16 17l-1 3',
  pause: 'M9 6v12M15 6v12',
  hourglass: 'M7 3h10M7 21h10M8 3c0 5 8 5 8 9s-8 4-8 9M16 3c0 5-8 5-8 9s8 4 8 9',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  box: 'M3 7.5L12 3l9 4.5v9L12 21l-9-4.5zM3 7.5l9 4.5l9-4.5M12 12v9',
  person: 'M12 4a3.5 3.5 0 1 0 0 7a3.5 3.5 0 1 0 0-7M5 20c0-4 3-6 7-6s7 2 7 6',
  cup: 'M5 9h11v5a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5zM16 10h1.5a2.5 2.5 0 0 1 0 5H16M8 3c0 1.5 1 1.5 1 3M12 3c0 1.5 1 1.5 1 3',
  info: 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18M12 11v6M12 7.5v.5',
  alert: 'M12 3.5L21.5 20h-19zM12 10v5M12 17.5v.5',
  heart: 'M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.4A4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z',
  star: 'M12 3.5l2.6 5.4l5.9.8l-4.3 4.1l1 5.9L12 16.9l-5.2 2.8l1-5.9L3.5 9.7l5.9-.8z',
  tablet: 'M6 3h12v18H6zM11 18h2',
  list: 'M4 6h16M4 12h16M4 18h10',
  chat: 'M4 5h16v11H9l-5 4z',
  hand: 'M8 13V6a1.5 1.5 0 0 1 3 0v5M11 11V4.5a1.5 1.5 0 0 1 3 0V11M14 11V6a1.5 1.5 0 0 1 3 0v8a7 7 0 0 1-7 7a6 6 0 0 1-5-3l-2-4a1.5 1.5 0 0 1 2.5-1.5L8 15',
  home: 'M4 11l8-7l8 7v9H4zM10 20v-5h4v5',
  book: 'M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3zM5 17a3 3 0 0 1 3-3h11',
  gear: 'M12 9a3 3 0 1 0 0 6a3 3 0 1 0 0-6M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1',
  arrow: 'M12 20V5M6 11l6-6l6 6',
  right: 'M5 12h14M13 6l6 6l-6 6',
  left: 'M19 12H5M11 6l-6 6l6 6',
  mouse: 'M12 3a6 6 0 0 1 6 6v6a6 6 0 0 1-12 0V9a6 6 0 0 1 6-6zM12 3v6',
  bell: 'M6 16V11a6 6 0 0 1 12 0v5l2 2H4zM10 20.5a2 2 0 0 0 4 0',
  ticket: 'M5 3h14v18l-2.3-1.5L14.3 21L12 19.5L9.7 21l-2.4-1.5L5 21zM8.5 8h7M8.5 12h7',
  pin: 'M9 3h6l-1 6l3 3H7l3-3zM12 12v9',
  minus: 'M5 12h14',
  plus: 'M12 5v14M5 12h14',
  letter: 'M3 6h18v12H3zM3 6l9 7l9-7',
  wave: 'M7 11V6a1.5 1.5 0 0 1 3 0v4M10 10V4.5a1.5 1.5 0 0 1 3 0V10M13 10V5.5a1.5 1.5 0 0 1 3 0v8A6.5 6.5 0 0 1 9.5 20A5.5 5.5 0 0 1 5 17.5l-1.5-3a1.5 1.5 0 0 1 2.5-1.5L7 14',
} as const;

export type IconName = keyof typeof ICONS;

/** Icône au trait; `label` la nomme pour les lecteurs d'écran (sinon elle est masquée). */
export function icon(name: IconName, label?: string, filled = false): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('class', 'dt-icon');
  if (label === undefined) svg.setAttribute('aria-hidden', 'true');
  else {
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', fr(label));
  }
  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('d', ICONS[name]);
  path.setAttribute('fill', filled ? 'currentColor' : 'none');
  path.setAttribute('stroke', 'currentColor');
  path.setAttribute('stroke-width', '1.75');
  path.setAttribute('stroke-linecap', 'round');
  path.setAttribute('stroke-linejoin', 'round');
  svg.append(path);
  return svg;
}

/** Jeton de joueur: son symbole dans sa couleur sur un disque de nuit cerclé d'encre (ux 0.4). */
export function token(color: PlayerColorId, name?: string): SVGSVGElement {
  const symbol = PLAYER_SYMBOLS[color];
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '-3 -3 30 30');
  svg.setAttribute('class', 'dt-token');
  if (name === undefined) svg.setAttribute('aria-hidden', 'true');
  else {
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', fr(name));
  }
  const disc = document.createElementNS(SVG_NS, 'circle');
  disc.setAttribute('cx', '12');
  disc.setAttribute('cy', '12');
  disc.setAttribute('r', '14');
  disc.setAttribute('fill', symbol.on);
  disc.setAttribute('stroke', '#2B211C');
  disc.setAttribute('stroke-width', '1.5');
  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('d', symbol.path);
  path.setAttribute('fill', symbol.color);
  path.setAttribute('transform', 'translate(3.6 3.6) scale(0.7)');
  svg.append(disc, path);
  return svg;
}

/** Touche affichée (« E », « Tab », « Retour arrière »). */
export function keycap(label: string): HTMLElement {
  return h('kbd', { class: 'dt-kbd' }, label);
}

/** Bouton d'interface; `primary` pour l'action principale (or de Duo). */
export function button(
  label: string,
  onClick: () => void,
  options: { primary?: boolean; disabled?: boolean; name?: string; className?: string } = {},
): HTMLButtonElement {
  const b = h(
    'button',
    {
      type: 'button',
      class: `dt-btn${options.primary === true ? ' dt-btn-primary' : ''}${options.className !== undefined ? ` ${options.className}` : ''}`,
      'aria-label': options.name === undefined ? null : fr(options.name),
      disabled: options.disabled === true,
    },
    label,
  );
  b.addEventListener('click', () => {
    if (!b.disabled) onClick();
  });
  return b;
}
