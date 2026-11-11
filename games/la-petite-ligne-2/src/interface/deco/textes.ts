/** Textes du mode déco (tutoiement). */
import type { PlacementRefusal } from '../../simulation/logement/pose';

export const DECO_TEXTS = {
  title: 'Décorer',
  stock: 'Inventaire de la maison',
  empty: 'Tout est posé.',
  rotate: 'Tourner',
  store: 'Ranger',
  exit: 'Sortir',
  heldBy: 'Dans les mains de {nom}',
  comfort: 'Confort',
  keys: 'Souris: glisser · Molette ou {w} {x}: tourner · Clic droit: ranger · {tab}: meuble suivant · {a} {e}: inventaire · {entree}: sortir de l’inventaire · {espace}: saisir, poser · {retour}: sortir',
  levels: ['Nue', 'Habitable', 'Accueillante', 'Douillette', 'Chaleureuse'] as readonly string[],
  ok: 'Ça va ici',
  stowed: '{meuble}: rangé à la maison',
  stowedList: 'Sorti de ton sac: {meubles}',
};

export const REASON_TEXTS: Readonly<Record<PlacementRefusal, string>> = {
  outside: 'Hors de la maison et du jardin',
  'room-not-ready': 'Pièce pas encore restaurée',
  'wrong-room': 'Pas dans cette pièce',
  'wrong-zone': 'Pas à cet endroit (dedans ou dehors)',
  wall: 'Dans un mur',
  overlap: 'La place est prise',
  'no-surface': 'À poser sur un meuble',
  'no-wall': 'À accrocher au mur, dos au mur',
  door: 'Devant une porte',
  'blocks-path': 'Bouche le passage vers le lit ou la sortie',
};
