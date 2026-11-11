/**
 * Événements du calendrier (cahier 4.7, R35): fêtes, visiteurs du train, concours, anniversaires.
 * Fonctions pures de l'état transmis et du contenu: l'interface, le rendu et les habitants de
 * l'invité lisent la même chose que l'hôte. Les données lisent un événement par la condition
 * `event_is` (`regles/conditions.ts`), sans fait à écrire ni à effacer.
 */
import type { CalendarEventDef } from '../../donnees/schemas/temps';
import type { Look } from '../briques/types';
import { evaluate, evaluateAll } from '../regles/conditions';
import { inHours, occursOn } from './calendrier';

export { occursOn };

/** Événements d'un lieu ce jour-là, conditions d'histoire réunies (état présent). */
export function eventsOn(look: Look, place: string, day: number): CalendarEventDef[] {
  const list = look.content.time.events[place] ?? [];
  return list.filter(
    (event) =>
      occursOn(look.content, event, day) &&
      evaluateAll({ world: look.world, content: look.content, actor: null }, event.conditions),
  );
}

/** Événements en cours au lieu courant, à l'heure présente. */
export function activeEvents(look: Look): CalendarEventDef[] {
  const { world } = look;
  return eventsOn(look, world.common.place, world.common.day).filter((event) =>
    inHours(event.hours, world.minutes),
  );
}

/** Commerces spéciaux ouverts par un événement en cours. */
export function eventShops(look: Look): string[] {
  return activeEvents(look).flatMap((e) => (e.activates.shop === null ? [] : [e.activates.shop]));
}

/**
 * Ce commerce du lieu courant est-il fermé par un événement (`closes`) ? Du début de l'événement
 * jusqu'à l'aube suivante (`event_is` à l'état `begun`): le matin, le commerçant tient encore
 * boutique; dès que la fête commence, il y est, et le reste de la journée est à elle.
 */
export function closedByEvent(look: Look, shop: string): boolean {
  const list = look.content.time.events[look.world.common.place] ?? [];
  return list.some((event) => {
    const shops = event.closes?.shops;
    if (shops === undefined || (shops !== 'all' && !shops.includes(shop))) return false;
    return evaluate(
      { world: look.world, content: look.content, actor: null },
      { type: 'event_is', events: [event.id], when: 'begun' },
    );
  });
}

/** Ce qu'annonce la veille: les événements de demain au lieu courant (champ `announce`). */
export function announcedFor(look: Look, day: number): CalendarEventDef[] {
  return eventsOn(look, look.world.common.place, day).filter((e) => e.announce);
}
