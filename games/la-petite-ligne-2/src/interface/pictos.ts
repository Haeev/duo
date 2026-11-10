/**
 * Pictos de l'interface dessinés à la plume (créations du studio), en un sprite SVG posé une fois
 * dans la racine; vignettes d'objets. Les pictos sont générés depuis
 * `assets-src/interface-encre/pictos/pictos.svg` (`pictos-encre.ts`): encre en `currentColor`,
 * trait plein et délié, ombre en aplat. Les vignettes dessinées sont dans
 * `assets/commun/interface/vignettes/<objet>.svg`; un objet qui n'en a pas encore garde sa
 * pastille à lettres.
 */
import { INK_PICTOS } from './pictos-encre';
import './plume.css';

/** Le sprite, à poser une fois dans la racine de l'interface. */
export function spriteMarkup(): string {
  const symbols = Object.entries(INK_PICTOS)
    .map(([id, body]) => `<symbol id="lpl-i-${id}" viewBox="0 0 24 24">${body}</symbol>`)
    .join('');
  return `<svg width="0" height="0" style="position:absolute" aria-hidden="true">${symbols}</svg>`;
}

/** Teinte stable tirée d'un identifiant (substituts des vignettes et des portraits). */
export function hueOf(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i += 1) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) % 360;
}

// Vignettes livrées: le nom du fichier est l'identifiant de l'objet.
const THUMBS = import.meta.glob<string>('../../assets/commun/interface/vignettes/*.svg', {
  query: '?url',
  import: 'default',
  eager: true,
});
const THUMB_BY_ITEM = new Map(
  Object.entries(THUMBS).map(([path, url]) => [path.slice(path.lastIndexOf('/') + 1, -4), url]),
);

/** Adresse de la vignette dessinée d'un objet, `null` s'il n'en a pas encore. */
export function thumbUrl(item: string): string | null {
  return THUMB_BY_ITEM.get(item) ?? null;
}

/**
 * Vignette d'un objet, par ordre de préférence: le dessin à la plume s'il existe, sinon le rendu
 * 3D du modèle (`data-obj-item`, remplacé par `hydrateThumbnails` quand le jeu fournit la
 * visionneuse), sinon une pastille de couleur et ses deux premières lettres (interface.md, 8).
 */
export function itemThumb(item: string, name: string): string {
  const url = thumbUrl(item);
  if (url !== null)
    return `<img class="obj obj--plume" src="${url}" alt="" aria-hidden="true" draggable="false">`;
  const hue = hueOf(item);
  const letters = name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join('');
  return `<svg class="obj" data-obj-item="${item}" viewBox="0 0 48 48" aria-hidden="true"><rect x="5" y="5" width="38" height="38" rx="12" fill="hsl(${hue} 45% 70%)" stroke="#2a2522" stroke-width="2.5"/><text x="24" y="31" text-anchor="middle" font-size="18" font-weight="800" fill="#2a2522" font-family="Nunito Sans Variable, system-ui, sans-serif">${letters}</text></svg>`;
}
