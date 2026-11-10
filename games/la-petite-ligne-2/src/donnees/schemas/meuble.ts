/**
 * `donnees/commun/meubles/<id>.json`: un meuble ou un élément interactif du décor (chaise, banc,
 * pompe, pommier, coffre). Ce qu'il fait tient dans ses briques. Les cartes le posent par son
 * identifiant; les joueurs posent ceux qui sont `placeable` (mode déco, jalon 2).
 */
import * as v from 'valibot';
import { FileVersionSchema, IdSchema, IntSchema, LabelSchema } from './communs';
import { BrickSchema } from './briques';

const Cells = v.pipe(IntSchema, v.minValue(1), v.maxValue(8));

export const PropSchema = v.strictObject({
  schema: FileVersionSchema,
  id: IdSchema,
  name: LabelSchema,
  /** Nœud du modèle 3D (`assets/`), ou d'une forme simple tant que le modèle n'est pas livré. */
  model: IdSchema,
  /** Emprise au sol en cases de 1 m, façade au sud (rotation 0). */
  size: v.strictObject({ w: Cells, h: Cells }),
  /** Bloque le passage sur son emprise. */
  solid: v.boolean(),
  /** Posable par les joueurs dans leur logement. */
  placeable: v.boolean(),
  /** Série de meubles assortis (réponse 57), `null`: aucune. */
  series: v.nullable(IdSchema),
  /** Ce qu'il sait faire, dans l'ordre de priorité de la touche d'action; une brique de chaque sorte au plus. */
  bricks: v.pipe(v.array(BrickSchema), v.maxLength(4)),
});
export type PropDef = v.InferOutput<typeof PropSchema>;
