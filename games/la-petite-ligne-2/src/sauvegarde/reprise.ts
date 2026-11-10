/**
 * Reprise: ce qu'on remet d'aplomb quand une partie rechargée repart, et la règle de l'invité
 * différent de celui de la sauvegarde.
 */
import type { Content } from '../donnees/charger';
import type { WorldState } from '../etat/monde';
import { MINUTES_PER_DAY } from '../simulation/noyau/constantes';
import type { Member } from '../simulation/noyau/monde';
import { fillText, SAVE_TEXTS } from './textes';

export type MemberMatch =
  | { readonly kind: 'same' }
  | {
      readonly kind: 'replaced';
      readonly slot: 0 | 1;
      readonly member: Member;
      readonly previous: string;
    }
  | { readonly kind: 'other-duo' };

/**
 * Règle de l'invité différent (proposée, à valider par le client): la sauvegarde appartient à un
 * duo. Si les deux joueurs actuels y figurent (dans n'importe quel rôle), rien à faire. Si un seul y
 * figure, l'autre prend la place du personnage absent: position, sac, argent, besoins, quêtes et
 * amitiés restent, l'apparence est à refaire (nouvelle personne). Si aucun n'y figure, la
 * sauvegarde est refusée (autre duo).
 */
export function matchMembers(world: WorldState, members: readonly [Member, Member]): MemberMatch {
  const saved = [world.players[0].member, world.players[1].member];
  const present = members.map((m) => saved.includes(m.id));
  if (present[0] && present[1] && members[0].id !== members[1].id) return { kind: 'same' };
  if (present[0] === present[1]) return { kind: 'other-duo' };
  const newcomer = present[0] ? members[1] : members[0];
  const stays = present[0] ? members[0] : members[1];
  const slot: 0 | 1 = world.players[0].member === stays.id ? 1 : 0;
  return { kind: 'replaced', slot, member: newcomer, previous: world.players[slot].name };
}

/** Applique la règle ci-dessus et rafraîchit les pseudos (ils peuvent avoir changé depuis). */
export function seatMembers(
  world: WorldState,
  members: readonly [Member, Member],
  match: MemberMatch,
): string | null {
  for (const player of world.players) {
    const current = members.find((m) => m.id === player.member);
    if (current !== undefined) player.name = current.name.slice(0, 40);
  }
  if (match.kind !== 'replaced') return null;
  const player = world.players[match.slot];
  player.member = match.member.id;
  player.name = match.member.name.slice(0, 40);
  player.look = null;
  player.gender = null;
  return fillText(SAVE_TEXTS.replacedGuest, { name: player.name, previous: match.previous });
}

/**
 * Ce qui n'a pas de sens après un rechargement: gestes et dialogues en cours, cible visée, voyage
 * interrompu. Le trajet en train se termine (heures comprises); un départ sur le marchepied s'annule.
 */
export function settleForResume(content: Content, world: WorldState): void {
  const { common } = world;
  if (common.phase === 'travel') world.minutes += content.settings.travel.clockHours * 60;
  common.phase = 'day';
  common.travel = null;
  for (const player of world.players) {
    player.gesture = null;
    player.talk = null;
    player.aim = null;
  }
  for (const villager of Object.values(world.places[common.place]?.villagers ?? {}))
    villager.talkingWith = null;
  if (world.minutes >= MINUTES_PER_DAY) world.minutes = 0;
}
