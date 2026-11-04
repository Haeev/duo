/**
 * Substituts des accessoires des gestes des habitants (0.13, lot H7, `gestes-0-13.json`), en
 * attendant les modèles de l'artiste 3D. Cotes en mètres, comme une fiche de modèle.
 *
 * - `broom`: balai de bouleau tenu par le manche (origine dans la main), la brosse vers le bas (-Y);
 * - `camera_box`: appareil photographique à soufflet de Lucie, tenu devant la poitrine (origine au
 *   milieu, objectif vers l'avant +Z);
 * - `archive_box`: carton d'archives de la mairie, tenu à deux mains (origine au milieu).
 */
import type { ShapeBuilder } from './geometrie';

type Builder = (b: ShapeBuilder, w: number, d: number) => void;

export const GESTURE_PROPS: Record<string, Builder> = {
  // Tenu main pendante (environ 0,8 m du sol): le manche dépasse de 0,4 m au-dessus de la main,
  // la brosse touche le sol (la capture du 2026-11-04 montrait la brosse en l'air, tête en haut).
  broom: (b) => {
    b.cylinder(0.018, 0.018, 1.1, [0, -0.7, 0], 'wood', { base: true, segments: 5 });
    b.cylinder(0.11, 0.035, 0.3, [0, -1.0, 0], 'straw_dark', { base: true, segments: 6 });
    b.cylinder(0.04, 0.04, 0.04, [0, -0.72, 0], 'rope', { base: true, segments: 6 });
  },
  camera_box: (b) => {
    b.box([0.17, 0.13, 0.12], [0, -0.065, -0.03], 'leather', { base: true });
    b.box([0.12, 0.1, 0.08], [0, -0.05, 0.06], 'black', { base: true });
    b.cylinder(0.03, 0.03, 0.04, [0, 0, 0.12], 'glass', { rotation: [90, 0, 0], segments: 8 });
  },
  archive_box: (b) => {
    b.box([0.36, 0.24, 0.26], [0, -0.12, 0], 'paper_dark', { base: true });
    b.box([0.37, 0.03, 0.27], [0, 0.11, 0], 'paper', { base: true });
  },
};
