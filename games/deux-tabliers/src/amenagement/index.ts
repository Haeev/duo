/**
 * Chantier « amenagement »: catalogue, achat et livraison, placement libre avec contraintes,
 * décoration (murs, plafond, surfaces, revêtements), port à deux, extensions, ambiance.
 * Point d'entrée branché dans `simulation/chantiers.ts`; voir README.md du jeu.
 *
 * Intentions (`intentions.ts`, envoyées par la machine qui joue, revérifiées par l'hôte):
 * - `amenagement-acheter { item, room }`: article du catalogue, extension (`village-terrasse`,
 *   `village-fond`), ou revêtement d'une pièce (`room`: `salle`, `fond`). Achat important
 *   (150 € et plus): proposé à l'autre, qui répond par `amenagement-repondre { accept }`.
 * - `amenagement-prendre { furniture }`: meuble posé (fantôme), petit carton (déballé en main),
 *   meuble lourd ou gros carton (un côté saisi; l'autre joueur saisit le second côté).
 * - `amenagement-sortir { piece }`: pièce de la réserve (`world.arrangement.stock`).
 * - `amenagement-poser { at }`: pose de la pièce tenue, ou de la charge portée à deux.
 * - `amenagement-annuler`, `amenagement-ranger { furniture }`, `amenagement-lacher`,
 *   `amenagement-tourner { dir }`, `amenagement-renover { furniture }`,
 *   `amenagement-fantome { at, ok }` (fantôme vu par l'autre).
 *
 * Événements (`evenements.ts`): `amenagement-achat`, `-proposition`, `-livraison`, `-geste`,
 * `-port`, `-extension`, `-brocante`, `-unique`; les refus passent par `refused` du cœur.
 *
 * Pour la clientèle (b): `connectArrangementEconomy` (caisse, paliers, café ouvert, accord),
 * `computeAmbiance` (score, mots, cohérence, détail objet par objet) pour l'attrait et la
 * satisfaction, `grantUniquePiece` pour les pièces uniques des habitués et des événements,
 * `seatsOf` (places ouvertes par pièce). Le matin (changement de `world.clientele.day`) livre
 * les cartons, finit les travaux et tire la brocante du lundi.
 * Pour l'interface (d): `computeAmbiance`, `styleNote`, `catalogView` (boutique par palier, prix,
 * refus), `world.arrangement` (réserve, cartons, travaux, proposition).
 */
import type { Content } from '../donnees/charger';
import type { World } from '../etat/monde';
import type { Chantier } from '../simulation/systemes';
import { computeAmbiance } from './ambiance';
import { economy } from './economie';
import { roomOpen } from './extensions';
import { arrangementIntent, arrangementStep, priceOf, purchaseRefusal } from './systeme';

export {
  computeAmbiance,
  styleNote,
  styleRelation,
  type Ambiance,
  type PieceAmbiance,
} from './ambiance';
export { connectArrangementEconomy, economy, type ArrangementEconomy } from './economie';
export { currentPlan, roomOpen } from './extensions';
export { checkPlacement, type Verdict } from './regles';
export { grantUniquePiece, placedCount, priceOf, purchaseRefusal } from './systeme';

export const amenagementChantier: Chantier = {
  id: 'amenagement',
  system: {
    id: 'amenagement',
    step: arrangementStep,
    intent: arrangementIntent,
  },
};

export interface CatalogEntry {
  readonly id: string;
  readonly label: string;
  readonly text: string;
  readonly category: string;
  readonly style: string;
  /** Prix du moment (revêtements: pour `room`), ou `null` si inconnu. */
  readonly price: number | null;
  /** Palier, « brocante », ou « extension ». */
  readonly shelf: string;
  /** Pourquoi on ne peut pas l'acheter maintenant, ou `null`. */
  readonly refusal: string | null;
  readonly heavy: boolean;
}

/** La boutique telle que la tablette la montre: articles achetables ou à venir, par rayon. */
export function catalogView(
  content: Content,
  world: World,
  room: string | null = 'salle',
): CatalogEntry[] {
  const out: CatalogEntry[] = [];
  for (const ext of content.arrangement.extensions.values()) {
    if (world.arrangement.extensions.includes(ext.id)) continue;
    out.push({
      id: ext.id,
      label: ext.label,
      text: ext.text,
      category: 'extension',
      style: 'neutre',
      price: priceOf(content, world, ext.id, null),
      shelf: 'extension',
      refusal: purchaseRefusal(content, world, ext.id, null),
      heavy: false,
    });
  }
  for (const item of content.arrangement.items.values()) {
    if (item.unlock.kind === 'regular' || item.unlock.kind === 'event') continue;
    if (item.unlock.kind === 'brocante' && !world.arrangement.brocante.items.includes(item.id))
      continue;
    const r = item.placement === 'wall_cover' || item.placement === 'floor_cover' ? room : null;
    out.push({
      id: item.id,
      label: item.label,
      text: item.text,
      category: item.category,
      style: item.style,
      price: priceOf(content, world, item.id, r),
      shelf: item.unlock.kind === 'tier' ? item.unlock.tier : 'brocante',
      refusal: purchaseRefusal(content, world, item.id, r),
      heavy: item.heavy,
    });
  }
  return out;
}

/** Places assises posées par pièce ouverte (la clientèle y fait asseoir ses groupes). */
export function seatsOf(
  content: Content,
  world: World,
): { room: string; furniture: string; count: number; kind: string }[] {
  const out: { room: string; furniture: string; count: number; kind: string }[] = [];
  for (const f of world.furniture) {
    const type = content.furniture.get(f.type);
    const info = content.arrangement.pieces.get(f.type);
    if (type?.kind !== 'seat' || info === undefined) continue;
    const room = content.arrangement.rooms.find(
      (r) =>
        roomOpen(world, r.extension) &&
        f.x >= r.space[0] &&
        f.x <= r.space[0] + r.space[2] &&
        f.z >= r.space[1] &&
        f.z <= r.space[1] + r.space[3],
    );
    if (room === undefined) continue;
    out.push({
      room: room.id,
      furniture: f.id,
      count: info.seats?.count ?? 1,
      kind: info.seats?.type ?? 'table',
    });
  }
  return out;
}

/** Ambiance avec les apports par défaut (propreté parfaite, radio sur une autre station). */
export function ambianceNow(content: Content, world: World): ReturnType<typeof computeAmbiance> {
  return computeAmbiance(content, world, { music: content.arrangement.ambiance.musicOther });
}

/** L'aménagement est permis maintenant (café fermé, ux 6.1). */
export function arrangeAllowed(world: World): boolean {
  return !economy().serviceOpen(world);
}
