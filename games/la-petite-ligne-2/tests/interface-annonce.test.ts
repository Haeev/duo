// Annonce des événements (`interface/annonce.ts`): la ligne vient de la fiche de l'événement (nom,
// lieu, heure), « Demain » tant que `common.outlook` l'annonce, puis le jour même « Aujourd'hui »,
// « En ce moment » jusqu'à sa fin; l'avis paraît la veille au soir et à l'ouverture.
import { describe, expect, it } from 'vitest';
import type { CalendarEventDef } from '../src/donnees/schemas/temps';
import { agendaLines, agendaNoticeDue, AGENDA_UI, formatHour } from '../src/interface/annonce';
import { createWorld } from '../src/simulation/noyau/monde';
import { gameContent, MEMBERS, SEED } from './aides';

const flat = (text: string): string => text.replace(/[\u00a0\u202f]/g, ' ');

describe('annonce des événements', () => {
  const content = gameContent();
  const world = createWorld(content, SEED, MEMBERS);
  const place = world.common.place;
  // Un exemplaire factice ajouté aux seules données, sans conditions, chaque lundi.
  const fake: CalendarEventDef = {
    schema: 1,
    id: 'fete-factice',
    name: 'Fête factice',
    kind: 'festival',
    when: { type: 'weekly', weekday: 'monday', seasons: [] },
    days: 1,
    hours: { from: 600, to: 120 },
    conditions: [],
    announce: true,
    where: 'sur le parvis',
    activates: { facts: [], shop: null, tune: null },
  };
  const events = content.time.events as Record<string, CalendarEventDef[]>;
  events[place] = [...(events[place] ?? []), fake];

  it('écrit l’heure sans minutes à l’heure pile', () => {
    expect(flat(formatHour(600))).toBe('10 h');
    expect(flat(formatHour(1110))).toBe('18 h 30');
  });

  it('annonce demain depuis l’état partagé, avec le nom, le lieu et l’heure de la fiche', () => {
    world.common.outlook = { weather: 'clear', events: ['fete-factice'] };
    const tomorrow = agendaLines(content, world).find((l) => l.when === 'tomorrow');
    expect(tomorrow).toBeDefined();
    expect(flat(tomorrow?.sentence ?? '')).toBe(
      'Demain : Fête factice, sur le parvis, à partir de 10 h.',
    );
    expect(flat(tomorrow?.detail ?? '')).toBe('Sur le parvis, à partir de 10 h');
    // L'avis de la veille attend le soir, et tient jusqu'à l'aube.
    const dawn = content.settings.clock.dayStart;
    if (tomorrow === undefined) return;
    expect(agendaNoticeDue(tomorrow, AGENDA_UI.eveFrom - 1, dawn)).toBe(false);
    expect(agendaNoticeDue(tomorrow, AGENDA_UI.eveFrom, dawn)).toBe(true);
    expect(agendaNoticeDue(tomorrow, 60, dawn)).toBe(true);
  });

  it('le jour même: à venir le matin, en cours jusqu’à 2 h, puis plus rien', () => {
    world.common.outlook = { weather: 'clear', events: [] };
    // Premier jour de la semaine de jeu où la fête a lieu.
    const days = Array.from({ length: 7 }, (_, i) => i + 1);
    const day = days.find((d) => {
      world.common.day = d;
      world.minutes = 420;
      return agendaLines(content, world).some((l) => l.id === 'fete-factice');
    });
    expect(day).toBeDefined();
    world.minutes = 420;
    expect(agendaLines(content, world).find((l) => l.id === 'fete-factice')?.when).toBe('today');
    world.minutes = 23 * 60;
    const now = agendaLines(content, world).find((l) => l.id === 'fete-factice');
    expect(now?.when).toBe('now');
    expect(flat(now?.sentence ?? '')).toBe(
      'En ce moment : Fête factice, sur le parvis, jusqu’à 2 h.',
    );
    world.minutes = 60;
    expect(agendaLines(content, world).find((l) => l.id === 'fete-factice')?.when).toBe('now');
    world.minutes = 200;
    expect(agendaLines(content, world).some((l) => l.id === 'fete-factice')).toBe(false);
  });
});
