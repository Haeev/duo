/**
 * Ballot encré: la forme commune d'un objet posé au sol qui n'a pas de modèle à lui (des pommes
 * secouées, une pièce trouvée). Un baluchon de toile noué en haut, à facettes, assez gros pour se
 * voir à la caméra de jeu. Une seule géométrie par lieu, partagée par tous les objets au sol.
 */
import {
  type BufferGeometry,
  Color,
  Float32BufferAttribute,
  IcosahedronGeometry,
  TorusGeometry,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { HARVEST_LOOK, type HarvestLookSettings } from './reglages-recoltes';

function paint(geometry: BufferGeometry, hex: string): BufferGeometry {
  const color = new Color(hex);
  const count = geometry.getAttribute('position').count;
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) color.toArray(colors, i * 3);
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
  return geometry;
}

/** Origine au pied, au centre; à couleurs de sommets (toile, lien). L'appelant la libère. */
export function bundleGeometry(settings: HarvestLookSettings = HARVEST_LOOK): BufferGeometry {
  const { w, d, h, cloth, tie } = settings.ground.bundle;
  // Toile: une boule à facettes, posée à plat, qui se resserre en col sous le noeud.
  const sack = new IcosahedronGeometry(0.5, 1);
  const position = sack.getAttribute('position');
  for (let i = 0; i < position.count; i++) {
    const t = position.getY(i) + 0.5;
    const pinch = t < 0.68 ? 1 : 1 - ((t - 0.68) / 0.32) * 0.7;
    const y = Math.max(position.getY(i), -0.32);
    position.setXYZ(
      i,
      position.getX(i) * pinch * w,
      ((y + 0.32) / 0.82) * h,
      position.getZ(i) * pinch * d,
    );
  }
  sack.computeVertexNormals();
  // Lien: un anneau qui serre le col, au-dessus de la panse (il se voit de haut).
  const ring = new TorusGeometry(0.5, 0.14, 4, 10).toNonIndexed();
  ring.rotateX(Math.PI / 2);
  ring.scale(w * 0.52, h * 0.5, d * 0.52);
  ring.translate(0, h * 0.8, 0);
  for (const name of Object.keys(ring.attributes))
    if (name !== 'position' && name !== 'normal') ring.deleteAttribute(name);
  for (const name of Object.keys(sack.attributes))
    if (name !== 'position' && name !== 'normal') sack.deleteAttribute(name);
  const merged = mergeGeometries([paint(sack, cloth), paint(ring, tie)]);
  sack.dispose();
  ring.dispose();
  return merged;
}
