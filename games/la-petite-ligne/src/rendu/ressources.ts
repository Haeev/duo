/**
 * Suivi des ressources GPU: tout ce que le rendu crée passe par ici, pour que
 * `dispose()` libère tout à la sortie (aucune fuite après dix parties).
 */
import type { BufferGeometry, Material, Object3D, Texture } from 'three';
import { Mesh } from 'three';

type Disposable = BufferGeometry | Material | Texture;

export class ResourceTracker {
  private readonly items = new Set<Disposable>();

  track<T extends Disposable>(item: T): T {
    this.items.add(item);
    return item;
  }

  /** Suit les géométries, matériaux et textures de tout un sous-arbre. */
  trackObject<T extends Object3D>(root: T): T {
    root.traverse((object) => {
      if (object instanceof Mesh) {
        this.track(object.geometry as BufferGeometry);
        const materials: Material[] = Array.isArray(object.material)
          ? (object.material as Material[])
          : [object.material as Material];
        for (const material of materials) {
          this.trackMaterial(material);
        }
      }
    });
    return root;
  }

  trackMaterial<T extends Material>(material: T): T {
    this.track(material);
    for (const value of Object.values(material)) {
      if (isTexture(value)) {
        this.track(value);
      }
    }
    return material;
  }

  /** Nombre de ressources suivies (contrôle de fuite dans les tests). */
  get size(): number {
    return this.items.size;
  }

  dispose(): void {
    for (const item of this.items) {
      item.dispose();
    }
    this.items.clear();
  }
}

function isTexture(value: unknown): value is Texture {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as { isTexture?: unknown }).isTexture === true
  );
}
