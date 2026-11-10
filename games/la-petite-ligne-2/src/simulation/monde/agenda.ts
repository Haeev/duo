/**
 * Événements du calendrier (cahier 4.7, R35): fêtes, visiteurs du train, concours, anniversaires.
 * Fonctions pures de l'état transmis et du contenu: l'interface, le rendu et les habitants de
 * l'invité lisent la même chose que l'hôte.
 */
import type { CalendarEventDef } from '../../donnees/schemas/temps';
import type { Look } from '../briques/types';
import { evaluateAll } from '../regles/conditions';
import { calendarOf, inHours } from './calendrier';
import type { Content } from '../../donnees/charger';

/** L'événement a lieu ce jour-là (date ou règle, durée comprise), sans regarder ses conditions. */
export function occursOn(content: Content, event: CalendarEventDef, day: number): boolean {
  for (let back = 0; back < event.days && day - back >= 1; back++) {
    const date = calendarOf(content, day - back);
    const when = event.when;
    if (when.type === 'date' && date.season === when.season && date.dayOfSeason === when.day)
      return true;
    if (
      when.type === 'weekly' &&
      date.weekday === when.weekday &&
      (when.seasons.length === 0 || when.seasons.includes(date.season))
    )
      return true;
  }
  return false;
}

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

/** Habitants présents grâce à un événement en cours (visiteurs du train compris). */
export function eventVillagers(look: Look): string[] {
  return [...new Set(activeEvents(look).flatMap((e) => e.activates.villagers))];
}

/** Commerces spéciaux ouverts par un événement en cours. */
export function eventShops(look: Look): string[] {
  return activeEvents(look).flatMap((e) => (e.activates.shop === null ? [] : [e.activates.shop]));
}

/** Ce qu'annonce la veille: les événements de demain au lieu courant (champ `announce`). */
export function announcedFor(look: Look, day: number): CalendarEventDef[] {
  return eventsOn(look, look.world.common.place, day).filter((e) => e.announce);
}
