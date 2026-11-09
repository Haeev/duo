/**
 * Retouches de la place cuite, en attendant une nouvelle cuisson (`assets-src/modeles/lib/place.py`).
 *
 * Porte de la mairie-école: `mairie_ecole` la dessine sur le nu de la façade (x 22), derrière
 * l'avant-corps saillant de 30 cm: elle est cachée, et ses trois marches montent vers un mur plein.
 * Or c'est par là qu'on va à la mairie et que les enfants sortent de l'école (passants, 16 h 30).
 * Substitut: la porte à deux vantaux (gris-bleu de place.py) et son encadrement de pierre, posés sur
 * l'avant-corps, au-dessus de la plus haute marche. À retirer quand la place sera recuite.
 *
 * Programme des lampes (`MeshBasicMaterial` couleur seule): aucun programme de plus. Noms en
 * `street_`: la lumière du jour (`lumiere-jour.ts`) les teinte comme le reste de la place.
 */
import { BoxGeometry, Group, Mesh, MeshBasicMaterial, type Scene } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/** Avant-corps (x 21,7), axe de la porte (z 30,1), plus haute marche (0,18), porte 1,4 x 2,6 m. */
const FRONT_X = 21.7;
const AXIS_Z = 30.1;
const SILL = 0.18;
const WIDTH = 1.4;
const HEIGHT = 2.6;
const FRAME = 0.16;

export interface PlaceTouchUps {
  dispose(): void;
}

function box(x0: number, x1: number, y0: number, y1: number, z0: number, z1: number): BoxGeometry {
  const g = new BoxGeometry(x1 - x0, y1 - y0, z1 - z0);
  g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  return g;
}

export function createPlaceTouchUps(scene: Scene): PlaceTouchUps {
  const group = new Group();
  group.name = 'retouches_place';
  const z0 = AXIS_Z - WIDTH / 2;
  const z1 = AXIS_Z + WIDTH / 2;
  // Encadrement: jambages et linteau en saillie de 5 cm, pierre claire à l'ombre de la façade ouest.
  const frameParts = [
    box(FRONT_X - 0.05, FRONT_X, SILL, SILL + HEIGHT + FRAME, z0 - FRAME, z0),
    box(FRONT_X - 0.05, FRONT_X, SILL, SILL + HEIGHT + FRAME, z1, z1 + FRAME),
    box(FRONT_X - 0.05, FRONT_X, SILL + HEIGHT, SILL + HEIGHT + FRAME, z0, z1),
  ];
  // Vantaux en retrait de 2 cm, et le joint entre les deux.
  const leafParts = [box(FRONT_X - 0.02, FRONT_X, SILL, SILL + HEIGHT, z0, z1)];
  const jointParts = [
    box(FRONT_X - 0.025, FRONT_X - 0.02, SILL, SILL + HEIGHT, AXIS_Z - 0.012, AXIS_Z + 0.012),
  ];
  const owned: { dispose(): void }[] = [];
  const add = (name: string, parts: BoxGeometry[], color: string): void => {
    const geometry = mergeGeometries(parts, false);
    for (const p of parts) p.dispose();
    const material = new MeshBasicMaterial({ name, color });
    const mesh = new Mesh(geometry, material);
    mesh.name = name;
    group.add(mesh);
    owned.push(geometry, material);
  };
  add('street_retouche_mairie_cadre', frameParts, '#a48f6c');
  add('street_retouche_mairie_porte', leafParts, '#3f4b57');
  add('street_retouche_mairie_joint', jointParts, '#262d33');
  scene.add(group);
  return {
    dispose() {
      scene.remove(group);
      for (const o of owned) o.dispose();
    },
  };
}
