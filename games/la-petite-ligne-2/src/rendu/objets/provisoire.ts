/**
 * Vignettes sans 3D: l'objet sans modèle (générique, marqué « provisoire ») et le secours quand
 * WebGL manque (même carton, sans marque). Images SVG en adresse `data:`, aucune requête.
 */

/** Libellé de la marque, lu aussi par le lecteur d'écran (titre du SVG). */
export const PROVISIONAL_LABEL = 'provisoire';

function svg(body: string, title: string): string {
  const text = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><title>${title}</title>${body}</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(text)}`;
}

// Un colis en trois quarts, aux couleurs du nuancier (ficelle, lin, encre).
const PARCEL =
  '<path d="M32 12 52 22v22L32 54 12 44V22z" fill="#D9CAAE" stroke="#26282E" stroke-width="2.5" stroke-linejoin="round"/>' +
  '<path d="M12 22l20 10 20-10M32 32v22" fill="none" stroke="#26282E" stroke-width="2.5" stroke-linejoin="round"/>' +
  '<path d="M22 17l20 10v8" fill="none" stroke="#B8A17E" stroke-width="3"/>';

/** Objet sans modèle: carton en pointillé et bandeau « provisoire ». */
export function provisionalThumbnail(): string {
  return svg(
    PARCEL.replace(
      'stroke-width="2.5" stroke-linejoin',
      'stroke-width="2.5" stroke-dasharray="4 3" stroke-linejoin',
    ) +
      '<rect x="4" y="46" width="56" height="14" rx="4" fill="#C5443D"/>' +
      `<text x="32" y="56.5" text-anchor="middle" font-size="10" font-weight="700" fill="#F3EDE0" font-family="system-ui, sans-serif">${PROVISIONAL_LABEL}</text>`,
    PROVISIONAL_LABEL,
  );
}

/** Secours sans WebGL: le carton seul (aucun menu ne dépend de la 3D pour être compris). */
export function fallbackThumbnail(): string {
  return svg(PARCEL, '');
}
