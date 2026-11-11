/**
 * Annonce des événements du calendrier (fêtes, veillées, train du samedi): la veille au soir, un
 * avis chez les deux joueurs (« Demain : Nuit des lumignons, sur le parvis, à partir de 10 h »);
 * le jour même, un rappel à l'ouverture; entre les deux, une ligne au coup d'œil (G) et en tête de
 * l'onglet Quêtes du carnet, jusqu'à la fin de l'événement. Tout se lit dans l'état partagé
 * (`common.outlook` pour demain, le calendrier pour aujourd'hui) et dans la fiche de l'événement
 * (`name`, `where`, `hours`): aucun texte par événement, et l'invité voit la même chose que l'hôte.
 */
import type { Content } from '../donnees/charger';
import type { CalendarEventDef } from '../donnees/schemas/temps';
import type { ReadonlyWorld } from '../etat/monde';
import { eventsOn } from '../simulation/monde/agenda';
import { el, setAttr, setText, show } from './dom';
import { fill } from './textes';
import './annonce.css';

const NBSP = String.fromCharCode(0xa0);

/** Réglages de l'annonce (minutes de jeu, durées en ms). */
export const AGENDA_UI = {
  /** La veille, l'avis paraît à partir de cette heure (ou dès le chargement, s'il est plus tard). */
  eveFrom: 18 * 60,
  /** Durée de l'avis à l'écran (ms): plus long qu'un avis ordinaire, il se lit en entier. */
  showMs: 9000,
  /** Lignes au plus au coup d'œil et dans le carnet. */
  maxLines: 2,
  /** Relecture du calendrier par le HUD (ms): les conditions ne s'évaluent pas à chaque image. */
  readMs: 250,
} as const;

/** Textes de l'annonce. */
export const AGENDA_TEXTS = {
  lead: { tomorrow: 'Demain', today: 'Aujourd’hui', now: 'En ce moment' },
  /** « sur le parvis, à partir de 10 h » */
  whereFrom: '{ou}, à partir de {heure}',
  from: 'à partir de {heure}',
  whereUntil: '{ou}, jusqu’à {heure}',
  until: 'jusqu’à {heure}',
  label: 'Annonce',
} as const;

export type AgendaWhen = 'tomorrow' | 'today' | 'now';

export interface AgendaLine {
  readonly id: string;
  readonly when: AgendaWhen;
  /** « Demain », « Aujourd’hui », « En ce moment ». */
  readonly lead: string;
  readonly name: string;
  /** « Sur le parvis, à partir de 10 h » (première lettre en capitale). */
  readonly detail: string;
  /** La phrase entière, lue par les lecteurs d'écran et montrée sur une ligne. */
  readonly sentence: string;
  /** Jour de l'événement (clé de l'avis déjà montré). */
  readonly day: number;
}

/** « 10 h », « 18 h 30 ». */
export function formatHour(minutes: number): string {
  const total = ((Math.floor(minutes) % 1440) + 1440) % 1440;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return m === 0
    ? `${String(h)}${NBSP}h`
    : `${String(h)}${NBSP}h${NBSP}${m.toString().padStart(2, '0')}`;
}

function capitalize(text: string): string {
  return text.length === 0 ? text : `${text.charAt(0).toLocaleUpperCase('fr')}${text.slice(1)}`;
}

/** Minutes depuis l'aube: la journée de jeu va de l'aube à l'aube suivante (minuit compris). */
function sinceDawn(minutes: number, dawn: number): number {
  return (((minutes - dawn) % 1440) + 1440) % 1440;
}

function lineOf(event: CalendarEventDef, when: AgendaWhen, day: number): AgendaLine {
  const T = AGENDA_TEXTS;
  const where = event.where ?? null;
  // En cours: jusqu'à quand; à venir: à partir de quand.
  const rest =
    when === 'now'
      ? where === null
        ? fill(T.until, { heure: formatHour(event.hours.to) })
        : fill(T.whereUntil, { ou: where, heure: formatHour(event.hours.to) })
      : where === null
        ? fill(T.from, { heure: formatHour(event.hours.from) })
        : fill(T.whereFrom, { ou: where, heure: formatHour(event.hours.from) });
  const lead = T.lead[when];
  return {
    id: event.id,
    when,
    lead,
    name: event.name,
    detail: capitalize(rest),
    sentence: `${lead}${NBSP}: ${event.name}, ${rest}.`,
    day,
  };
}

/**
 * Ce qu'il faut annoncer maintenant au lieu courant: les événements annoncés d'aujourd'hui qui ne
 * sont pas finis (en cours d'abord), puis ceux de demain (`common.outlook`). Pur, testé.
 */
export function agendaLines(content: Content, world: ReadonlyWorld): AgendaLine[] {
  const { place, day } = world.common;
  const dawn = content.settings.clock.dayStart;
  const now = sinceDawn(world.minutes, dawn);
  const today: AgendaLine[] = [];
  for (const event of eventsOn({ content, world }, place, day)) {
    if (!event.announce) continue;
    const { from, to } = event.hours;
    const start = sinceDawn(from, dawn);
    // Toute la journée (`from === to`): jusqu'à l'aube suivante.
    const end = from === to ? 1440 : sinceDawn(to, dawn);
    if (now >= end && end > start) continue;
    today.push(lineOf(event, now >= start ? 'now' : 'today', day));
  }
  today.sort((a, b) => (a.when === b.when ? 0 : a.when === 'now' ? -1 : 1));
  const list = content.time.events[place] ?? [];
  const tomorrow = (world.common.outlook?.events ?? []).flatMap((id) => {
    const event = list.find((e) => e.id === id);
    return event === undefined ? [] : [lineOf(event, 'tomorrow', day + 1)];
  });
  return [...today, ...tomorrow];
}

/**
 * Faut-il montrer l'avis de cette ligne maintenant ? La veille à partir de `eveFrom` (et jusqu'à
 * l'aube); le jour même dès l'ouverture (ligne « en ce moment »). Une fois par ligne et par jour.
 */
export function agendaNoticeDue(
  line: AgendaLine,
  minutes: number,
  dawn: number,
  eveFrom: number = AGENDA_UI.eveFrom,
): boolean {
  if (line.when === 'now') return true;
  if (line.when === 'tomorrow') return sinceDawn(minutes, dawn) >= sinceDawn(eveFrom, dawn);
  return false;
}

/** Clé d'un avis montré: un avis la veille, un rappel le jour même, par événement et par jour. */
function keyOf(line: AgendaLine): string {
  return `${line.id}@${String(line.day)}@${line.when === 'tomorrow' ? 'veille' : 'jour'}`;
}

/** Fanion de fête (picto de l'annonce), en `currentColor`. */
function pennants(className: string): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', className);
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML =
    '<path d="M2 5c6 3 14 3 20 0" fill="none" stroke="currentColor" stroke-width="2"/>' +
    '<path d="M5 6.2l1.6 6 2.4-5.4zM11 7.4l1 6.2 2-6.2zM17 6.8l.4 6.4 2.8-5.6z" fill="currentColor" stroke="currentColor" stroke-width="1.2" stroke-linejoin="bevel"/>';
  return svg;
}

/** Nœud d'une ligne d'annonce (coup d'œil, carnet): picto, « Demain », nom, détail. */
export function agendaLineNode(line: AgendaLine, variant: 'coup-d-oeil' | 'carnet'): HTMLElement {
  return el(
    'div',
    {
      class: `annonce-ligne annonce-ligne--${variant} annonce-ligne--${line.when}`,
      role: 'note',
      'aria-label': line.sentence,
    },
    [
      pennants('annonce__ic'),
      el('span', { class: 'annonce-ligne__lead', text: `${line.lead}${NBSP}:` }),
      el('b', { class: 'annonce-ligne__nom', text: line.name }),
      el('span', { class: 'annonce-ligne__detail', text: line.detail }),
    ],
  );
}

export interface AgendaHud {
  /** `menu`: un menu couvre l'écran (l'avis attend); `glancing`: coup d'œil ouvert. */
  frame(now: number, world: ReadonlyWorld, menu: boolean, glancing: boolean): void;
  dispose(): void;
}

/**
 * Avis du HUD (haut droite, sous les avis courts) et ligne du coup d'œil (au-dessus de sa minuterie).
 * L'avis attend qu'aucun menu ne couvre l'écran pour commencer à compter.
 */
export function createAgendaHud(root: HTMLElement, content: Content): AgendaHud {
  const lead = el('span', { class: 'annonce__lead' });
  const name = el('b', { class: 'annonce__nom' });
  const detail = el('span', { class: 'annonce__detail' });
  const card = el(
    'div',
    { class: 'annonce', role: 'status', 'aria-live': 'polite', 'aria-label': AGENDA_TEXTS.label },
    [pennants('annonce__ic'), el('div', { class: 'annonce__corps' }, [lead, name, detail])],
  );
  card.hidden = true;
  const glance = el('div', { class: 'annonce-coup-d-oeil' });
  glance.hidden = true;
  root.append(card, glance);
  const shown = new Set<string>();
  let current: { line: AgendaLine; until: number } | null = null;
  let glanceDrawn = '';
  let readAt = -Infinity;
  let lines: AgendaLine[] = [];
  const dawn = content.settings.clock.dayStart;

  return {
    frame(now, world, menu, glancing) {
      if (now - readAt >= AGENDA_UI.readMs || now < readAt) {
        readAt = now;
        lines = agendaLines(content, world);
      }
      if (current === null && !menu) {
        const due = lines.find(
          (l) => !shown.has(keyOf(l)) && agendaNoticeDue(l, world.minutes, dawn),
        );
        if (due !== undefined) {
          shown.add(keyOf(due));
          current = { line: due, until: now + AGENDA_UI.showMs };
          setText(lead, `${due.lead}${NBSP}:`);
          setText(name, due.name);
          setText(detail, due.detail);
          setAttr(card, 'aria-label', due.sentence);
          card.classList.toggle('annonce--jour', due.when !== 'tomorrow');
        }
      }
      if (current !== null && now >= current.until) current = null;
      show(card, current !== null && !menu);

      const top = glancing && !menu ? lines.slice(0, AGENDA_UI.maxLines) : [];
      const signature = top.map((l) => l.sentence).join('|');
      if (signature !== glanceDrawn) {
        glanceDrawn = signature;
        glance.replaceChildren(...top.map((l) => agendaLineNode(l, 'coup-d-oeil')));
      }
      show(glance, top.length > 0);
    },
    dispose() {
      card.remove();
      glance.remove();
    },
  };
}
