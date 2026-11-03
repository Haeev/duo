/**
 * Aperçu du personnage habillé, à gauche de la mercerie, de la garde-robe et de la création.
 * L'aperçu en 3D vient du rendu (`InterfaceOptions.outfitPreview`, petite scène séparée, contrat
 * section 5.2); sans lui (mode secours, rendu pas encore chargé, page de démonstration sans rendu),
 * une silhouette en pied dessinée en SVG qui porte les mêmes pièces et se tourne de même.
 */
import type { ClothesContent, ClothingDef } from '../donnees/vetements';
import type { Wear } from '../etat/types';
import type { OutfitPreview, OutfitPreviewLook, OutfitPreviewOptions } from '../etat/vue';
import type { PortraitColors } from './config';
import { el } from './dom';
import { safeColor } from './format';
import { type ClothingCatalogue, catalogueOf, coveredSlots } from './modele-garde-robe';
import { playerColors, playerHeadSvg } from './portrait';

/** L'aperçu tel que le panneau l'utilise: 3D du rendu ou silhouette 2D de repli. */
export interface PanelPreview {
  readonly element: HTMLElement;
  /** Vrai pour l'aperçu 3D du rendu. */
  readonly is3d: boolean;
  show(look: OutfitPreviewLook): void;
  /** Angle de vue en radians (0: de face, positif: vers la gauche de l'écran). */
  setAngle(radians: number): void;
  /** Taille de la place disponible, en points CSS. */
  fit(width: number, height: number): void;
  dispose(): void;
}

export type OutfitPreviewFactory = (options: OutfitPreviewOptions) => OutfitPreview | null;

/** L'aperçu 3D s'il y en a un (rendu chargé), sinon la silhouette 2D. */
export function createPanelPreview(
  factory: OutfitPreviewFactory | null,
  clothes: ClothesContent,
  size: { width: number; height: number },
): PanelPreview {
  const preview = factory?.({ ...size, background: '#fbf6e9' }) ?? null;
  if (preview === null) return new FigurePreview(clothes);
  const element = el('span', { class: 'lpl-figure lpl-figure--3d' }, [preview.canvas]);
  let width = size.width;
  let height = size.height;
  return {
    element,
    is3d: true,
    show: (look) => {
      preview.show(look);
    },
    setAngle: (radians) => {
      preview.setAngle(radians);
    },
    fit: (w, h) => {
      const nw = Math.max(1, Math.round(w));
      const nh = Math.max(1, Math.round(h));
      if (nw === width && nh === height) return;
      width = nw;
      height = nh;
      preview.resize(nw, nh);
    },
    dispose: () => {
      preview.dispose();
      element.remove();
    },
  };
}

/** Pas de rotation à chaque appui sur A ou E, et à la souris (radians par pixel). */
export const PREVIEW_STEP = Math.PI / 8;
export const PREVIEW_DRAG = 0.012;

const INK = '#2A2522';

let clipCounter = 0;

function has(def: ClothingDef | undefined, ...words: string[]): boolean {
  if (def === undefined) return false;
  const key = `${def.style} ${def.id}`.toLowerCase();
  return words.some((w) => key.includes(w));
}

function col(
  def: ClothingDef | undefined,
  which: 'principale' | 'secondaire',
  fallback: string,
): string {
  return def === undefined ? fallback : safeColor(def.couleurs[which]);
}

/**
 * La silhouette en pied (repère 120 x 230), habillée des pièces de `wear`. Les formes suivent le
 * style (manches courtes ou longues, short, jupe, salopette, bottes, chapeau de paille...) et les
 * couleurs `principale` et `secondaire`; le motif (marinière) se peint en rayures.
 */
export function figureSvg(
  p: PortraitColors,
  wear: Readonly<Wear>,
  catalogue: ClothingCatalogue,
  angle: number,
): string {
  const get = (id: string | null): ClothingDef | undefined =>
    id === null ? undefined : catalogue.get(id);
  const covered = coveredSlots(wear, catalogue);
  const top = covered.has('top') ? undefined : get(wear.top);
  const outer = get(wear.outer);
  const bottom = get(wear.bottom);
  const shoes = get(wear.shoes);
  const hat = get(wear.hat);
  const back = Math.cos(angle) < 0;
  const squash = 0.55 + 0.45 * Math.abs(Math.cos(angle));
  const clip = `lpl-figure-${++clipCounter}`;

  const topMain = col(top, 'principale', p.top);
  const topSecond = col(top, 'secondaire', p.trim);
  const longSleeves = has(top, 'pull', 'chemise', 'mariniere', 'marinière');
  const noSleeves = has(top, 'debardeur', 'débardeur');
  const torso = 'M40 70Q60 64 80 70L86 78L82 126H38L34 78Z';

  // Bras (peau), sous les manches.
  let out = `<path d="M34 74L24 120L31 122L40 84ZM86 74L96 120L89 122L80 84Z" fill="${p.skin}"/>`;
  out += `<circle cx="27.5" cy="123" r="4.2" fill="${p.skin}"/><circle cx="92.5" cy="123" r="4.2" fill="${p.skin}"/>`;

  // Jambes (peau) sous un short, une jupe ou un pantacourt.
  const bMain = col(bottom, 'principale', '#5B5A66');
  const bSecond = col(bottom, 'secondaire', '#3F3E48');
  const legEnd = has(bottom, 'short')
    ? 150
    : has(bottom, 'pantacourt')
      ? 172
      : has(bottom, 'jupe')
        ? 160
        : 196;
  out += `<path d="M44 140H56L55 198H46ZM64 140H76L74 198H65Z" fill="${p.skin}"/>`;
  if (has(bottom, 'jupe')) {
    out += `<path d="M40 120H80L90 ${legEnd}H30Z" fill="${bMain}"/><path d="M32 ${legEnd - 5}H88L90 ${legEnd}H30Z" fill="${bSecond}"/>`;
  } else {
    out += `<path d="M40 120H80L78 ${legEnd}H63L60 132L57 ${legEnd}H42Z" fill="${bMain}"/>`;
    out += `<path d="M42 ${legEnd - 4}H57V${legEnd}H42ZM63 ${legEnd - 4}H78V${legEnd}H63Z" fill="${bSecond}"/>`;
  }

  // Chaussures.
  const sMain = col(shoes, 'principale', '#4A3A30');
  const sSecond = col(shoes, 'secondaire', '#2F2520');
  if (has(shoes, 'botte')) {
    out += `<path d="M44 176H57V200H62V206H40V200H44ZM63 176H76V200H80V206H58V200H63Z" fill="${sMain}"/>`;
    out += `<path d="M40 203H62V206H40ZM58 203H80V206H58Z" fill="${sSecond}"/>`;
  } else {
    out += `<path d="M42 196H57V204H38Q38 199 42 196ZM63 196H78Q82 199 82 204H63Z" fill="${sMain}"/>`;
    out += `<path d="M38 202H57V205H38ZM63 202H82V205H63Z" fill="${sSecond}"/>`;
  }

  // Haut: corps, manches, col; rayures d'une marinière.
  out += `<clipPath id="${clip}"><path d="${torso}"/></clipPath>`;
  out += `<path d="${torso}" fill="${topMain}"/>`;
  if ((top?.couleurs.motif ?? null) !== null || has(top, 'mariniere', 'marinière')) {
    const stripe = safeColor(top?.couleurs.motif ?? topSecond);
    let stripes = '';
    for (let y = 80; y < 126; y += 8)
      stripes += `<rect x="30" y="${y}" width="60" height="3.4" fill="${stripe}"/>`;
    out += `<g clip-path="url(#${clip})">${stripes}</g>`;
  }
  if (!noSleeves) {
    const sleeves = longSleeves
      ? 'M34 72L23 117L31 120L40 84ZM86 72L97 117L89 120L80 84Z'
      : 'M34 72L27 97L36 99L40 84ZM86 72L93 97L84 99L80 84Z';
    out += `<path d="${sleeves}" fill="${topMain}"/>`;
  }
  out += `<path d="M52 67H68L64 75H56Z" fill="${topSecond}"/>`;
  // Col de chemise ou de polo: deux pointes rabattues sur la poitrine.
  if (has(top, 'chemise', 'polo'))
    out += `<path d="M52 66L60 75L51 77ZM68 66L60 75L69 77Z" fill="${topMain}" stroke="${topSecond}" stroke-width="1.2" stroke-linejoin="round"/>`;

  // Salopette: bavette et bretelles par-dessus le haut.
  if (has(bottom, 'salopette')) {
    out += `<path d="M46 92H74V124H46Z" fill="${bMain}"/><path d="M44 70L48 92H52L48 70ZM76 70L72 92H68L72 70Z" fill="${bSecond}"/>`;
  }

  // Par-dessus: veste ouverte (pans et manches longues), ou cape de pluie.
  if (outer !== undefined) {
    const oMain = col(outer, 'principale', '#6B5B4E');
    const oSecond = col(outer, 'secondaire', '#4F4238');
    if (has(outer, 'cape')) {
      out += `<path d="M38 68Q60 60 82 68L100 150Q60 162 20 150Z" fill="${oMain}"/><path d="M48 66H72L66 74H54Z" fill="${oSecond}"/>`;
    } else {
      out += `<path d="M34 72L23 117L31 120L40 84ZM86 72L97 117L89 120L80 84Z" fill="${oMain}"/>`;
      out += `<path d="M40 70Q48 66 55 67L54 134H36L34 78ZM80 70Q72 66 65 67L66 134H84L86 78Z" fill="${oMain}"/>`;
      out += `<path d="M55 67L50 84L54 90ZM65 67L70 84L66 90Z" fill="${oSecond}"/>`;
      out += `<path d="M24 113L31 116L31 120L23 117ZM96 113L89 116L89 120L97 117Z" fill="${oSecond}"/>`;
    }
  }

  // Badge brodé du profil Duo, côté cœur.
  if (!back && p.badge !== undefined) {
    const bx = outer !== undefined && !has(outer, 'cape') ? 76 : 71;
    out += `<circle cx="${bx}" cy="86" r="3.6" fill="${p.badge}" stroke="${INK}" stroke-width="1"/>`;
  }

  // Cou et tête (repère du portrait réduit).
  out += `<rect x="55" y="56" width="10" height="13" fill="${p.shade}"/>`;
  out += `<g transform="translate(13.5 -5.5) scale(0.93)">${playerHeadSvg(p, 'good', back)}</g>`;

  // Chapeau, posé sur le haut du crâne.
  if (hat !== undefined) {
    const hMain = col(hat, 'principale', '#C9A267');
    const hSecond = col(hat, 'secondaire', '#7E3B2A');
    if (has(hat, 'paille')) {
      out += `<ellipse cx="60" cy="25" rx="33" ry="6.5" fill="${hMain}"/><path d="M45 25Q46 8 60 8Q74 8 75 25Z" fill="${hMain}"/><path d="M45.5 19H74.5L75 24H45Z" fill="${hSecond}"/>`;
    } else if (has(hat, 'bonnet')) {
      out += `<path d="M40 28Q40 6 60 6Q80 6 80 28Z" fill="${hMain}"/><rect x="38" y="23" width="44" height="8" rx="3" fill="${hSecond}"/><circle cx="60" cy="6" r="5" fill="${hSecond}"/>`;
    } else if (has(hat, 'beret', 'béret')) {
      out += `<ellipse cx="58" cy="19" rx="23" ry="8.5" fill="${hMain}"/><path d="M58 11V6" stroke="${hMain}" stroke-width="2.4" stroke-linecap="round"/><path d="M38 22Q58 28 80 22" stroke="${hSecond}" stroke-width="2" fill="none"/>`;
    } else {
      out += `<path d="M40 27Q40 8 60 8Q80 8 80 27Z" fill="${hMain}"/><path d="M38 24H82V28H38Z" fill="${hSecond}"/>`;
      out += back ? '' : `<path d="M56 28H86Q86 33 78 33H56Z" fill="${hSecond}"/>`;
    }
  }

  const transform = `translate(60 0) scale(${squash.toFixed(3)} 1) translate(-60 0)`;
  return (
    `<svg viewBox="0 0 120 230" aria-hidden="true">` +
    `<ellipse cx="60" cy="207" rx="34" ry="6" fill="${INK}" opacity="0.14"/>` +
    `<g transform="${transform}">${out}</g></svg>`
  );
}

/** Silhouette 2D de repli (sans aperçu 3D du rendu). */
/** Silhouette 2D de repli (sans aperçu 3D du rendu). */
export class FigurePreview implements PanelPreview {
  readonly element: HTMLElement;
  readonly is3d = false;
  private readonly clothes: ClothesContent;
  private look: OutfitPreviewLook | null = null;
  private angle = 0;
  private sig = '';

  constructor(clothes: ClothesContent) {
    this.clothes = clothes;
    this.element = el('span', { class: 'lpl-figure' });
  }

  show(look: OutfitPreviewLook): void {
    this.look = look;
    this.draw();
  }

  setAngle(radians: number): void {
    this.angle = radians;
    this.draw();
  }

  fit(): void {
    // Le SVG suit la taille de sa boîte (CSS).
  }

  private draw(): void {
    const look = this.look;
    if (look === null) return;
    const sig = JSON.stringify([look, this.angle]);
    if (sig === this.sig) return;
    this.sig = sig;
    const colors = playerColors(look.character, look.appearance, this.clothes);
    // SVG fabriqué ici à partir des données contrôlées (couleurs passées par `safeColor`).
    this.element.innerHTML = figureSvg(
      colors,
      look.appearance.wear,
      catalogueOf(this.clothes),
      this.angle,
    );
  }

  dispose(): void {
    this.element.remove();
  }
}
