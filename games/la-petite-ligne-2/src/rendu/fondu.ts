/**
 * Fondu et lueur d'un objet de la scène, sans toucher aux matériaux partagés: tant que l'objet est
 * plein et sans lueur, il garde ses matériaux d'origine (un seul programme, aucun coût); dès qu'il
 * s'efface ou qu'il est visé, il reçoit ses propres copies, libérées au retour à la normale.
 */
import { Color, type Material, type Mesh, type Object3D } from 'three';
import { INK_CUT, isInkMaterial, type InkCut } from './encre/matiere';

interface Part {
  readonly mesh: Mesh;
  readonly original: Material;
  copy: Material | null;
}

interface Emissive {
  emissive: Color;
  emissiveIntensity: number;
}

function hasEmissive(material: Material): material is Material & Emissive {
  return (material as Partial<Emissive>).emissive instanceof Color;
}

/** Maillage, avec les types par défaut de Three.js (`instanceof Mesh` rend un type à `any`). */
export function isMesh(object: Object3D): object is Mesh {
  return (object as Partial<Mesh>).isMesh === true;
}

export class Fadable {
  private readonly parts: Part[] = [];
  private opacity = 1;
  private glow = 0;

  /** Relève les maillages de `root` à cet instant: ce qu'on lui ajoute ensuite (liseré) n'est pas touché. */
  constructor(
    root: Object3D,
    private readonly glowColor: Color,
  ) {
    root.traverse((object) => {
      // Un maillage à plusieurs matériaux garderait ses matériaux partagés: aucun n'existe encore.
      if (isMesh(object) && !Array.isArray(object.material))
        this.parts.push({ mesh: object, original: object.material, copy: null });
    });
  }

  /** `opacity` de 0 à 1 (1: plein), `glow` de 0 à 1 (lueur ajoutée à l'émissif). */
  apply(opacity: number, glow: number): void {
    if (opacity === this.opacity && glow === this.glow) return;
    this.opacity = opacity;
    this.glow = glow;
    const plain = opacity >= 1 && glow <= 0;
    for (const part of this.parts) {
      if (plain) {
        if (part.copy !== null) {
          part.mesh.material = part.original;
          part.copy.dispose();
          part.copy = null;
        }
        continue;
      }
      let copy = part.copy;
      if (copy === null) {
        copy = part.original.clone();
        part.copy = copy;
        part.mesh.material = copy;
      }
      const faded = opacity < 1;
      if (copy.transparent !== faded) {
        copy.transparent = faded;
        // Un volume effacé n'écrit pas la profondeur: le personnage derrière lui reste net.
        copy.depthWrite = !faded;
        copy.needsUpdate = true;
      }
      copy.opacity = opacity;
      if (hasEmissive(copy)) {
        copy.emissive.copy(this.glowColor);
        copy.emissiveIntensity = glow;
      }
    }
  }

  /**
   * Rendu encré: la découpe d'occultation (`occultation.ts`) au lieu du fondu. Elle passe par
   * `userData` de chaque maillage et se lit à chaque dessin: ni copie de matériau, ni transparence,
   * ni programme de plus. Rend faux (et ne touche à rien) si un morceau n'est pas encré: l'ancien
   * rendu garde son fondu.
   */
  setCut(cut: InkCut | null): boolean {
    if (!this.parts.every((part) => isInkMaterial(part.original))) return false;
    for (const part of this.parts) {
      part.mesh.userData[INK_CUT] = cut ?? undefined;
    }
    return true;
  }

  /** Copies en service (contrôle de fuite). */
  get copies(): number {
    let count = 0;
    for (const part of this.parts) if (part.copy !== null) count += 1;
    return count;
  }

  dispose(): void {
    this.apply(1, 0);
  }
}
