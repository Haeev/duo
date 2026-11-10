/**
 * Portrait provisoire d'un habitant, généré depuis son identifiant (teintes de peau, de cheveux et
 * de vêtement stables). Il tient la place du buste 3D (interface.md, section 8) et se marque
 * « provisoire » dans la fenêtre de dialogue. La bouche bouge pendant l'écriture (classe `parle`).
 */
import { hueOf } from './pictos';

const SKINS = ['#f1c9a5', '#e0ac85', '#c68863', '#9a6646', '#6f4630'] as const;

export function portraitMarkup(id: string): string {
  const h = hueOf(id);
  const skin = SKINS[h % SKINS.length] ?? SKINS[0];
  const hair = `hsl(${(h * 7) % 360} 35% ${20 + (h % 30)}%)`;
  const cloth = `hsl(${(h * 13) % 360} 40% 50%)`;
  const long = h % 2 === 0;
  return `<svg viewBox="0 0 190 230" aria-hidden="true">
  <path d="M20 230c0-52 34-78 75-78s75 26 75 78z" fill="${cloth}" stroke="#2a2522" stroke-width="4"/>
  <rect x="80" y="128" width="30" height="30" fill="${skin}" stroke="#2a2522" stroke-width="4"/>
  ${long ? `<path d="M44 96c0-50 22-70 51-70s51 20 51 70v54H44z" fill="${hair}" stroke="#2a2522" stroke-width="4"/>` : ''}
  <ellipse cx="95" cy="92" rx="44" ry="50" fill="${skin}" stroke="#2a2522" stroke-width="4"/>
  <path d="M51 80c4-34 24-46 44-46s40 12 44 46c-14-16-30-20-44-20s-30 4-44 20z" fill="${hair}" stroke="#2a2522" stroke-width="4"/>
  <circle cx="78" cy="94" r="5" fill="#2a2522"/><circle cx="112" cy="94" r="5" fill="#2a2522"/>
  <circle cx="68" cy="110" r="7" fill="#e58f7c" opacity="0.5"/><circle cx="122" cy="110" r="7" fill="#e58f7c" opacity="0.5"/>
  <ellipse class="bouche" cx="95" cy="118" rx="10" ry="6" fill="#7a2e2a" stroke="#2a2522" stroke-width="3"/>
</svg>`;
}
