// Schéma d'un `InputFrame`, pour un canal réseau qui transporte les entrées de l'invité.
import * as v from 'valibot';

const ActionList = v.pipe(
  v.array(v.pipe(v.string(), v.maxLength(32))),
  v.maxLength(32),
  v.readonly(),
);
const Finite = v.pipe(v.number(), v.finite());

export const InputFrameSchema = v.strictObject({
  down: ActionList,
  pressed: ActionList,
  released: ActionList,
  pointer: v.strictObject({ ndcX: Finite, ndcY: Finite, inside: v.boolean(), wheel: Finite }),
});
