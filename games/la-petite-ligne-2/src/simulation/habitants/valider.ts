/**
 * Contrôle des vies d'habitants au chargement (branché dans `donnees/valider.ts`): planning sans
 * trou, chez lui la nuit, points, meubles et sièges existants, discussion réciproque, commerce
 * tenu par lui, cadeaux connus. Une faute nomme le fichier et la ligne du planning.
 */
import type { Content, PlaceContent } from '../../donnees/charger';
import type { VillagerDef } from '../../donnees/schemas/habitant';
import type { Condition } from '../../donnees/schemas/regles';
import type { Spot } from '../../donnees/schemas/vie-habitant';
import { findObject, inRange, isUnconditional } from './planning';
import { VILLAGERS } from './reglages';

const DAY = 1440;

function checkSpot(content: Content, place: PlaceContent, spot: Spot, at: string): string | null {
  if ('point' in spot)
    return spot.point in place.map.points
      ? null
      : `${at}: point « ${spot.point} » absent de la carte`;
  const id = 'seat' in spot ? spot.seat : spot.object;
  const object = findObject(place, id);
  if (object === null) return `${at}: meuble « ${id} » absent de la carte`;
  const def = content.props[object.type];
  if ('seat' in spot && def?.bricks.some((b) => b.brick === 'sit') !== true)
    return `${at}: « ${id} » n'est pas un siège (brique sit)`;
  return null;
}

function clock(minute: number): string {
  return `${String(Math.floor(minute / 60))} h ${String(minute % 60).padStart(2, '0')}`;
}

/** Contrôle d'une condition d'histoire, fourni par `donnees/valider.ts` (pas d'import circulaire). */
export type ConditionCheck = (
  content: Content,
  c: Condition,
  at: string,
  problems: string[],
) => void;

function checkVillager(
  content: Content,
  place: PlaceContent,
  villager: VillagerDef,
  problems: string[],
  condition: ConditionCheck | undefined,
): void {
  const life = villager.life;
  if (life === undefined) return;
  const file = `lieux/${place.def.id}/habitants/${villager.id}.json, life`;
  if (condition !== undefined) {
    const lists: [string, readonly Condition[] | null | undefined][] = [
      ['arrives', life.arrives],
      ['leaves', life.leaves],
    ];
    life.schedule.forEach((entry, i) => {
      lists.push([`schedule ${String(i)}, when`, entry.when]);
    });
    for (const [where, list] of lists)
      for (const c of list ?? []) condition(content, c, `${file}, ${where}`, problems);
  }

  if (!(life.home in place.map.points))
    problems.push(`${file}: point « ${life.home} » (chez lui) absent de la carte`);
  const covered = new Uint8Array(DAY);
  const night: { point: string | null } = { point: null };
  life.schedule.forEach((entry, i) => {
    const at = `${file}, schedule ${String(i)}`;
    const spot = checkSpot(content, place, entry.at, at);
    if (spot !== null) problems.push(spot);
    if (entry.from === entry.to) problems.push(`${at}: plage vide`);
    if (entry.with !== undefined) {
      const other = place.villagers.find((v) => v.id === entry.with);
      if (other === undefined) problems.push(`${at}: habitant inconnu « ${entry.with} »`);
      else if (other.life?.schedule.some((e) => e.with === villager.id) !== true)
        problems.push(`${at}: « ${entry.with} » ne discute jamais avec lui en retour`);
    }
    if (entry.shop !== undefined) {
      const shop = place.shops[entry.shop];
      if (shop === undefined) problems.push(`${at}: commerce inconnu « ${entry.shop} »`);
      else if (shop.keeper !== villager.id)
        problems.push(`${at}: le commerce « ${entry.shop} » est tenu par « ${shop.keeper} »`);
    }
    if (!isUnconditional(entry)) return;
    for (let m = 0; m < DAY; m++) {
      if (!inRange(m, entry.from, entry.to)) continue;
      // La première ligne sans condition qui couvre l'heure du contrôle est celle qui s'applique.
      if (m === VILLAGERS.homeCheckMinute && covered[m] === 0)
        night.point = 'point' in entry.at ? entry.at.point : '';
      covered[m] = 1;
    }
  });
  const hole = covered.indexOf(0);
  if (hole >= 0)
    problems.push(
      `${file}: planning troué à ${clock(hole)} (les lignes sans condition doivent couvrir la journée)`,
    );
  else if (night.point !== life.home)
    problems.push(
      `${file}: à ${clock(VILLAGERS.homeCheckMinute)}, il doit être chez lui (« ${life.home} »)`,
    );
  for (const reaction of life.reactions)
    if (reaction.act === 'gesture' && reaction.clip === undefined)
      problems.push(`${file}, reactions: une réaction à un geste nomme son clip`);
  for (const item of [...life.gifts.loved, ...life.gifts.liked, ...life.gifts.disliked])
    if (!(item in content.items)) problems.push(`${file}, gifts: objet inconnu « ${item} »`);
  for (const shop of Object.values(place.shops))
    if (shop.keeper === villager.id && !life.schedule.some((e) => e.shop === shop.id))
      problems.push(`${file}: aucune ligne ne le met au comptoir de « ${shop.id} »`);
}

export function validateVillagerLives(content: Content, condition?: ConditionCheck): string[] {
  const problems: string[] = [];
  for (const place of Object.values(content.places))
    for (const villager of place.villagers)
      checkVillager(content, place, villager, problems, condition);
  return problems;
}
