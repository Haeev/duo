/**
 * Pictos au trait de l'interface (créations du studio, repris des maquettes de la refonte), en un
 * sprite SVG posé une fois dans la racine. Vignettes d'objets et portraits: substituts générés
 * (`vignette`, `portrait.ts`) en attendant les rendus des modèles 3D.
 */
// Épaisseur et bouts du trait par variables: un thème (style encré) les change sans redessiner.
const S =
  'fill="none" stroke="currentColor" style="stroke-width:var(--lpl-ic-stroke,2);stroke-linecap:var(--lpl-ic-cap,round);stroke-linejoin:var(--lpl-ic-join,round)"';

const SYMBOLS: Readonly<Record<string, string>> = {
  soleil: `<g ${S}><circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"/></g>`,
  lune: `<path ${S} d="M19 14.5A8 8 0 0 1 9.5 5a8 8 0 1 0 9.5 9.5z"/>`,
  bol: `<g ${S}><path d="M3 11h18a9 9 0 0 1-18 0z"/><path d="M9 7c0-2 2-2 2-4M14 7c0-2 2-2 2-4"/></g>`,
  goutte: `<path ${S} d="M12 3c4 5 6 8 6 11a6 6 0 0 1-12 0c0-3 2-6 6-11z"/>`,
  sac: `<g ${S}><path d="M6 9h12l1.5 10a2 2 0 0 1-2 2h-11a2 2 0 0 1-2-2z"/><path d="M9 9V7a3 3 0 0 1 6 0v2"/><path d="M9 14h6"/></g>`,
  plume: `<g ${S}><path d="M20 4c-8 0-13 5-14 13l3-3c6 0 10-4 11-10z"/><path d="M4 20l6-8"/></g>`,
  gens: `<g ${S}><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-4 3-6 6.5-6s6.5 2 6.5 6"/><path d="M17.5 5.5c1-1.5 3.5-1 3.5 1 0 1.5-2 2.8-3.5 4-1.5-1.2-3.5-2.5-3.5-4 0-2 2.5-2.5 3.5-1z"/></g>`,
  album: `<g ${S}><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M12 8l1.2 2.5 2.8.4-2 2 .5 2.7-2.5-1.3-2.5 1.3.5-2.7-2-2 2.8-.4z"/></g>`,
  carte: `<g ${S}><path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z"/><path d="M9 4v14M15 6v14"/></g>`,
  tenue: `<path ${S} d="M8 3l4 2 4-2 5 4-3 3-2-1v11H8V9l-2 1-3-3z"/>`,
  rouage: `<g ${S}><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"/><circle cx="12" cy="12" r="7"/></g>`,
  lit: `<g ${S}><path d="M3 18V7M3 14h18v4M21 14v-2a3 3 0 0 0-3-3h-8v5"/><circle cx="6.5" cy="11" r="1.5"/></g>`,
  cadenas: `<g ${S}><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></g>`,
  refus: `<g ${S}><circle cx="12" cy="12" r="9"/><path d="M5.5 5.5l13 13"/></g>`,
  train: `<g ${S}><rect x="5" y="3" width="14" height="13" rx="3"/><path d="M5 10h14M8 20l-2 2M16 20l2 2"/><circle cx="9" cy="13" r="1"/><circle cx="15" cy="13" r="1"/></g>`,
  coffre: `<g ${S}><rect x="3" y="8" width="18" height="12" rx="1.5"/><path d="M3 12h18M5 8a7 4 0 0 1 14 0"/><rect x="10.5" y="11" width="3" height="3"/></g>`,
  info: `<g ${S}><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/></g>`,
  losange: `<path ${S} d="M12 2l8 10-8 10-8-10z"/>`,
  nuage: `<path ${S} d="M7 18a4 4 0 0 1-.5-8A6 6 0 0 1 18 9.5a4.2 4.2 0 0 1-.5 8.5z"/>`,
  pluie: `<g ${S}><path d="M7 15a4 4 0 0 1-.5-8A6 6 0 0 1 18 6.5a4.2 4.2 0 0 1-.5 8.5z"/><path d="M8.5 18.5l-1 3M12.5 18.5l-1 3M16.5 18.5l-1 3"/></g>`,
  brume: `<g ${S}><path d="M7 13a4 4 0 0 1-.5-8A6 6 0 0 1 18 4.5a4.2 4.2 0 0 1-.5 8.5z"/><path d="M4 17h13M7 21h13"/></g>`,
  neige: `<g ${S}><path d="M7 14a4 4 0 0 1-.5-8A6 6 0 0 1 18 5.5a4.2 4.2 0 0 1-.5 8.5z"/><path d="M8 18v.5M12 20v.5M16 18v.5M10 21.5v.5M14 17v.5"/></g>`,
  orage: `<g ${S}><path d="M7 14a4 4 0 0 1-.5-8A6 6 0 0 1 18 5.5a4.2 4.2 0 0 1-.5 8.5z"/><path d="M13 13l-3 4.5h4l-3 4.5"/></g>`,
};

/** Le sprite, à poser une fois dans la racine de l'interface. */
export function spriteMarkup(): string {
  const symbols = Object.entries(SYMBOLS)
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

/**
 * Vignette provisoire d'un objet: une pastille de couleur et ses deux premières lettres. Elle
 * tient la place de l'image rendue depuis le modèle (interface.md, section 8); `data-obj-item`
 * la fait remplacer par la vignette 3D quand le jeu en fournit une (`hydrateThumbnails`).
 */
export function itemThumb(item: string, name: string): string {
  const hue = hueOf(item);
  const letters = name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join('');
  return `<svg class="obj" data-obj-item="${item}" viewBox="0 0 48 48" aria-hidden="true"><rect x="5" y="5" width="38" height="38" rx="12" fill="hsl(${hue} 45% 70%)" stroke="#2a2522" stroke-width="2.5"/><text x="24" y="31" text-anchor="middle" font-size="18" font-weight="800" fill="#2a2522" font-family="Nunito Sans Variable, system-ui, sans-serif">${letters}</text></svg>`;
}
