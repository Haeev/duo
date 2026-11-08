/**
 * HUD en vue subjective (ux 3): le monde d'abord, le HUD ne garde que ce que la vue cache.
 * - haut gauche: horloge, minuteries, tes tickets; haut centre: alertes douces, astuce,
 *   décompte; haut droite: l'autre hors de vue, propositions; bas droite: « En main »;
 *   centre: point de visée, anneau de maintien, arc d'un geste, lecture d'un ticket, invite,
 *   capsule de la souris. Le bas de l'écran reste aux mains (technique 2.3).
 * - Chaque région est ancrée à son coin et ne se redessine que si son contenu change.
 * - `update` (chaque image, état du centre) garde la forme du squelette pour `main.ts`;
 *   `setModel` (contenu des régions) est appelé par l'interface quand le modèle change.
 */
import type { PlayerColorId } from '@duo/sdk';
import { h, icon, keycap, token, type IconName } from './dom';
import type { AlertView, GaugeView, InterfaceModel, TicketView } from './modele';
import type { PlayerSettings } from './reglages';
import { T, WEEKDAYS } from './textes';
import { capital, euros, fill, fr, heure } from './typo';

export interface HudState {
  /** Une cible est visée: anneau au lieu du point. */
  readonly aiming: boolean;
  /** Invite: touche et texte (« E », « Prendre : Tasse »), `null` sans cible. */
  readonly prompt: {
    readonly key: string;
    readonly text: string;
    readonly refused: boolean;
    /** Deuxième ligne (« Cappuccino, tarte aux fruits · ticket 12 »). */
    readonly detail?: string | null;
    /** Touche de « Reposer » quand l'action existe (« R »). */
    readonly dropKey?: string | null;
    readonly dropText?: string | null;
  } | null;
  /** Avancement d'un maintien, de 0 à 1, `null` sans maintien. */
  readonly hold: number | null;
  /** Pointeur libre hors panneau: la capsule s'affiche. */
  readonly capsule: boolean;
}

/** Ce que le HUD sait des deux joueurs (SDK) et de la place de l'autre (rendu). */
export interface HudPeople {
  readonly partnerName: string;
  readonly partnerColor: PlayerColorId;
  /** Direction de l'autre vue de dessus, en degrés (0: devant, 90: à droite), `null` s'il est en vue. */
  readonly partnerBearing: number | null;
}

export interface Hud {
  update(state: HudState): void;
  /** Contenu des régions (horloge, tickets, l'autre, propositions, en main, geste). */
  setModel(model: InterfaceModel, people: HudPeople): void;
  /** Refus ou message bref, au centre, deux secondes. */
  flash(text: string): void;
  /** Alerte douce (ux 3.3): 6 s, 3 au plus, jamais de focus. */
  alert(alert: AlertView): void;
  /** Mot de qualité d'un geste, chez ce joueur seulement, 1,5 s (ux 5.1). */
  quality(word: string): void;
  setSettings(settings: PlayerSettings): void;
  /** Compteur d'images par seconde, `null` pour le masquer. */
  setFps(fps: number | null): void;
  /** Erreur fatale de chargement, lisible par le joueur. */
  fail(text: string): void;
  dispose(): void;
}

const ALERT_ICONS: Readonly<Record<AlertView['icon'], IconName>> = {
  delivery: 'box',
  regular: 'person',
  cup: 'cup',
  stock: 'alert',
  ready: 'check',
  wave: 'wave',
  order: 'list',
  info: 'info',
};

function ticketCard(
  ticket: TicketView,
  expanded: boolean,
  color: PlayerColorId | null,
): HTMLElement {
  const head = h(
    'div',
    { class: 'dt-ticket-head' },
    color === null ? null : token(color),
    `${String(ticket.id)} · ${ticket.destination}`,
  );
  const doneCount = ticket.lines.filter((l) => l.done).length;
  const allDone = ticket.lines.length > 0 && doneCount === ticket.lines.length;
  if (!expanded) {
    head.append(fr(` · ${allDone ? T.tickets.ready : T.tickets.todo}`));
    return h('div', { class: 'dt-card' }, head);
  }
  head.append(
    h(
      'span',
      { class: 'dt-wait' },
      icon('hourglass', 'attente'),
      fr(` ${String(ticket.waitMinutes)} min`),
    ),
  );
  const card = h('div', { class: 'dt-card' }, head);
  for (const line of ticket.lines)
    card.append(
      h(
        'div',
        { class: 'dt-ticket-line' },
        h('span', { class: `dt-box${line.done ? ' done' : ''}` }),
        line.label,
      ),
    );
  for (const line of ticket.receipt ?? [])
    card.append(h('div', { class: 'dt-ticket-line dt-second', 'data-receipt': '' }, line));
  card.append(
    h(
      'div',
      { class: 'dt-ticket-status' },
      allDone
        ? T.tickets.ready
        : fill(T.tickets.readyCount, { n: doneCount, total: ticket.lines.length }),
    ),
  );
  return card;
}

/** Arc de 270° d'un geste: zone en segment épais avec encoches, aiguille (ux 5.2). */
function gaugeSvg(gauge: GaugeView): SVGSVGElement {
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '-50 -50 100 100');
  svg.setAttribute('class', 'dt-gauge');
  svg.setAttribute('aria-hidden', 'true');
  const start = 135;
  const sweep = 270;
  const at = (t: number, r: number): string => {
    const a = ((start + sweep * t) * Math.PI) / 180;
    return `${(Math.cos(a) * r).toFixed(2)} ${(Math.sin(a) * r).toFixed(2)}`;
  };
  const arc = (t0: number, t1: number, r: number): string =>
    `M ${at(t0, r)} A ${String(r)} ${String(r)} 0 ${sweep * (t1 - t0) > 180 ? 1 : 0} 1 ${at(t1, r)}`;
  const path = (d: string, stroke: string, width: number): SVGPathElement => {
    const p = document.createElementNS(NS, 'path');
    p.setAttribute('d', d);
    p.setAttribute('fill', 'none');
    p.setAttribute('stroke', stroke);
    p.setAttribute('stroke-width', String(width));
    p.setAttribute('stroke-linecap', 'butt');
    return p;
  };
  svg.append(path(arc(0, 1, 40), '#2B211C', 9), path(arc(0, 1, 40), '#CDBBA6', 3));
  if (gauge.kind === 'window' || gauge.kind === 'hold')
    svg.append(path(arc(0, Math.max(0.001, Math.min(1, gauge.value)), 40), '#F6EEDF', 5));
  if (gauge.zone !== null) {
    const [z0, z1] = gauge.zone;
    svg.append(path(arc(z0, z1, 40), '#2B211C', 12), path(arc(z0, z1, 40), '#FFC857', 8));
    for (const t of [z0, z1]) svg.append(path(`M ${at(t, 33)} L ${at(t, 47)}`, '#F6EEDF', 2.5));
  }
  if (gauge.kind === 'gauge') {
    const needle = path(`M 0 0 L ${at(Math.max(0, Math.min(1, gauge.value)), 36)}`, '#F6EEDF', 3);
    needle.setAttribute('stroke-linecap', 'round');
    svg.append(
      path(`M 0 0 L ${at(Math.max(0, Math.min(1, gauge.value)), 36)}`, '#2B211C', 6),
      needle,
    );
  }
  return svg;
}

export function createHud(root: HTMLElement): Hud {
  const layer = h('div', { class: 'dt-hud' });
  const tl = h('div', { class: 'dt-region dt-tl' });
  const tc = h('div', { class: 'dt-region dt-tc', 'aria-live': 'polite' });
  const tr = h('div', { class: 'dt-region dt-tr' });
  const br = h('div', { class: 'dt-region dt-br' });
  const gaugeBox = h('div');
  const readingBox = h('div');
  const dot = h('div', { class: 'dt-dot' });
  const hold = h('div', { class: 'dt-hold' });
  const prompt = h('div', { class: 'dt-prompt dt-card' });
  const capsule = h(
    'div',
    { class: 'dt-capsule dt-card' },
    T.capsule.title,
    h('small', null, T.capsule.sub),
  );
  const flash = h('div', { class: 'dt-flash dt-card' });
  const qualityBox = h('div', { class: 'dt-quality dt-card' });
  const fps = h('div', { class: 'dt-fps dt-card' });
  flash.hidden = true;
  prompt.hidden = true;
  qualityBox.hidden = true;
  fps.hidden = true;
  const alerts = h('div', { class: 'dt-region', style: 'position: static; gap: 0.45em' });
  const tcFixed = h('div', { class: 'dt-region', style: 'position: static; gap: 0.45em' });
  tc.append(tcFixed, alerts);
  layer.append(
    tl,
    tc,
    tr,
    br,
    gaugeBox,
    readingBox,
    hold,
    dot,
    prompt,
    capsule,
    flash,
    qualityBox,
    fps,
  );
  root.append(layer);

  let flashTimer: ReturnType<typeof setTimeout> | null = null;
  let qualityTimer: ReturnType<typeof setTimeout> | null = null;
  const alertTimers = new Set<ReturnType<typeof setTimeout>>();
  const keys = { prompt: '', tl: '', tc: '', tr: '', br: '', gauge: '', reading: '' };
  let settings: PlayerSettings | null = null;
  let gaugeActive = false;
  let lastFps = -1;

  /** Remplace le contenu d'une région seulement si sa clé a changé. */
  const paint = (
    region: keyof typeof keys,
    key: string,
    el: HTMLElement,
    build: () => readonly Node[],
  ): void => {
    if (keys[region] === key) return;
    keys[region] = key;
    el.replaceChildren(...build());
  };

  return {
    update(state) {
      dot.classList.toggle('aim', state.aiming);
      dot.classList.toggle('small', settings?.crosshair === 'small');
      dot.classList.toggle('large', settings?.crosshair === 'large');
      dot.hidden = state.capsule;
      capsule.hidden = !state.capsule;
      const p = state.capsule || gaugeActive ? null : state.prompt;
      const key = p === null ? '' : JSON.stringify(p);
      if (key !== keys.prompt) {
        keys.prompt = key;
        prompt.replaceChildren();
        prompt.hidden = p === null;
        if (p !== null) {
          const main = h('div', { class: 'dt-prompt-main' });
          if (p.refused) main.append(icon('info'));
          else main.append(keycap(p.key), icon('mouse', 'clic'));
          main.append(fr(p.text));
          prompt.append(main);
          if (p.detail !== undefined && p.detail !== null)
            prompt.append(h('div', { class: 'dt-second' }, p.detail));
          if (
            !p.refused &&
            p.dropKey !== undefined &&
            p.dropKey !== null &&
            p.dropText !== undefined &&
            p.dropText !== null
          )
            prompt.append(
              h('div', { class: 'dt-prompt-main dt-second' }, keycap(p.dropKey), p.dropText),
            );
          prompt.classList.toggle('refused', p.refused);
        }
      }
      hold.hidden = state.hold === null || gaugeActive;
      if (state.hold !== null) {
        const deg = Math.round(state.hold * 360);
        hold.style.background = `conic-gradient(#F6EEDF ${String(deg)}deg, #2B211C ${String(deg)}deg)`;
      }
    },

    setModel(model, people) {
      const clock = model.clock;
      const showClock =
        clock !== null &&
        settings?.clockDisplay !== 'never' &&
        !(settings?.clockDisplay === 'service' && clock.phase !== 'service');
      const mine = model.myTickets;
      paint(
        'tl',
        JSON.stringify([showClock ? clock : null, model.timers, mine, settings?.clockDisplay]),
        tl,
        () => {
          const out: Node[] = [];
          if (showClock) {
            const weekday = capital(WEEKDAYS[clock.weekday] ?? '');
            const stop = clock.stop;
            let sub: string;
            if (stop?.kind === 'absent')
              sub = fill(T.clock.absent, { partner: people.partnerName });
            else if (stop?.kind === 'resume') sub = T.clock.resume;
            else if (clock.phase === 'soft-closing') sub = T.clock.softClosing;
            else if (
              clock.phase === 'closed' ||
              clock.phase === 'evening' ||
              stop?.kind === 'closed'
            )
              sub = T.clock.closed;
            else if (clock.phase === 'service')
              sub = fill(T.clock.service, { weekday, closing: heure(clock.closingMinutes) });
            else sub = fill(T.clock.preparation, { weekday });
            const weatherIcon: IconName =
              clock.weather.kind === 'sun'
                ? 'sun'
                : clock.weather.kind === 'clouds'
                  ? 'clouds'
                  : 'rain';
            out.push(
              h(
                'div',
                { class: `dt-card${stop === null ? '' : ' dashed'}` },
                h(
                  'div',
                  { class: 'dt-clock-time' },
                  icon(
                    stop === null ? 'clock' : 'pause',
                    stop === null ? undefined : T.clock.paused,
                  ),
                  heure(clock.minutes),
                  icon(weatherIcon, clock.weather.label),
                ),
                h('div', { class: 'dt-clock-sub dt-second' }, sub),
                clock.lastHour ? h('div', { class: 'dt-clock-sub' }, T.clock.lastHour) : null,
              ),
            );
          }
          for (const timer of model.timers) {
            const deg = Math.round(Math.max(0, Math.min(1, timer.progress)) * 360);
            const ring = h('span', { class: 'dt-ring' });
            ring.style.background = `conic-gradient(#F6EEDF ${String(deg)}deg, #5C4A3E ${String(deg)}deg)`;
            out.push(
              h(
                'div',
                { class: 'dt-card dt-timer' },
                timer.ready ? icon('check', 'prêt') : ring,
                timer.label,
              ),
            );
          }
          if (mine.length > 0) {
            out.push(h('div', { class: 'dt-label-chip' }, T.tickets.title));
            mine.slice(0, 3).forEach((t, i) => out.push(ticketCard(t, i === 0, null)));
            if (mine.length > 3)
              out.push(
                h(
                  'div',
                  { class: 'dt-second' },
                  fill(mine.length - 3 > 1 ? T.tickets.moreMany : T.tickets.more, {
                    n: mine.length - 3,
                  }),
                ),
              );
          }
          return out;
        },
      );

      const countdown = clock?.stop?.kind === 'countdown' ? clock.stop.seconds : null;
      const hint = settings?.tips === false ? null : model.hint;
      paint('tc', JSON.stringify([hint, countdown]), tcFixed, () => {
        const out: Node[] = [];
        if (countdown !== null)
          out.push(
            h(
              'div',
              {
                class: 'dt-card dt-countdown',
                style: 'position: static; transform: none; text-align: center',
              },
              fill(T.clock.countdown, { n: countdown }),
            ),
          );
        if (hint !== null)
          out.push(
            h(
              'div',
              { class: 'dt-card dt-hint dt-alert' },
              icon('info'),
              `${T.hint.prefix}${hint}`,
            ),
          );
        return out;
      });

      const partnerShown = people.partnerBearing !== null;
      paint(
        'tr',
        JSON.stringify([
          partnerShown ? Math.round(people.partnerBearing / 10) : null,
          model.partner,
          model.held[1 - model.local],
          model.proposals,
          people.partnerName,
        ]),
        tr,
        () => {
          const out: Node[] = [];
          if (partnerShown) {
            const arrow = icon(
              'arrow',
              `${people.partnerName} : ${bearingWord(people.partnerBearing)}`,
            );
            arrow.classList.add('dt-dir');
            arrow.style.transform = `rotate(${String(Math.round(people.partnerBearing))}deg)`;
            const other = model.held[model.local === 0 ? 1 : 0];
            out.push(
              h(
                'div',
                { class: 'dt-card' },
                h(
                  'div',
                  { class: 'dt-partner-head' },
                  token(people.partnerColor),
                  people.partnerName,
                  arrow,
                ),
                model.partner.place === null ? null : h('div', null, model.partner.place),
                model.partner.doing !== null
                  ? h('div', { class: 'dt-second' }, model.partner.doing)
                  : other !== null
                    ? h('div', { class: 'dt-second' }, fill(T.partner.holds, { item: other.label }))
                    : null,
              ),
            );
          }
          for (const p of model.proposals) out.push(proposalCard(p, model.local, people));
          return out;
        },
      );

      const held = model.held[model.local];
      paint('br', JSON.stringify(held), br, () =>
        held === null
          ? []
          : [
              h(
                'div',
                { class: 'dt-card' },
                h('div', { class: 'dt-held-title' }, T.held.title),
                h('div', null, held.label),
                held.detail === null ? null : h('div', { class: 'dt-second' }, held.detail),
              ),
            ],
      );

      const gauge = model.gauge;
      gaugeActive = gauge !== null;
      paint('gauge', JSON.stringify(gauge), gaugeBox, () => {
        if (gauge === null) return [];
        return [
          gaugeSvg(gauge),
          h(
            'div',
            { class: 'dt-gauge-label dt-card' },
            gauge.simplified ? `${gauge.label} · ${T.gesture.alone}` : gauge.label,
            gauge.word === null ? null : h('strong', null, ` · ${gauge.word}`),
          ),
          h(
            'div',
            { class: 'dt-prompt dt-card', style: 'top: calc(50% + 3.6em)' },
            h(
              'div',
              { class: 'dt-prompt-main' },
              gauge.simplified ? T.gesture.aloneLine : gauge.prompt,
            ),
            gauge.simplified ? h('div', { class: 'dt-second' }, T.gesture.aloneSub) : null,
          ),
        ];
      });

      const reading = model.aimedTicket;
      paint('reading', JSON.stringify(reading), readingBox, () => {
        if (reading === null) return [];
        return [
          h(
            'div',
            { class: 'dt-card dt-reading' },
            h(
              'div',
              { class: 'dt-ticket-head' },
              `Ticket ${String(reading.id)} · ${reading.destination}`,
              h(
                'span',
                { class: 'dt-wait' },
                icon('hourglass', 'attente'),
                ` ${String(reading.waitMinutes)} min`,
              ),
            ),
            ...reading.lines.map((l) => h('div', { class: 'dt-ticket-line' }, l.label)),
            // Remises du ticket (remises v0.2): nom et montant, café offert, tampons.
            ...(reading.receipt ?? []).map((line) =>
              h('div', { class: 'dt-ticket-line dt-second', 'data-receipt': '' }, line),
            ),
            h(
              'div',
              { class: 'dt-ticket-status' },
              reading.takenBy === null
                ? T.tickets.free
                : reading.takenBy === model.local
                  ? T.tickets.title
                  : fill(T.tickets.takenBy, { partner: people.partnerName }),
            ),
          ),
        ];
      });
    },

    flash(text) {
      flash.replaceChildren(icon('info'), fr(text));
      flash.hidden = false;
      if (flashTimer !== null) clearTimeout(flashTimer);
      flashTimer = setTimeout(() => {
        flash.hidden = true;
      }, 2000);
    },

    alert(a) {
      const card = h(
        'div',
        { class: 'dt-card dt-alert', role: 'status' },
        icon(ALERT_ICONS[a.icon]),
        a.text,
      );
      alerts.append(card);
      const max = window.innerHeight < 600 ? 2 : 3;
      while (alerts.childElementCount > max) alerts.firstElementChild?.remove();
      const timer = setTimeout(() => {
        alertTimers.delete(timer);
        card.remove();
      }, 6000);
      alertTimers.add(timer);
    },

    quality(word) {
      qualityBox.textContent = fr(word);
      qualityBox.hidden = false;
      if (qualityTimer !== null) clearTimeout(qualityTimer);
      qualityTimer = setTimeout(() => {
        qualityBox.hidden = true;
      }, 1500);
    },

    setSettings(next) {
      settings = next;
      keys.tl = '';
      keys.tc = '';
    },

    setFps(value) {
      fps.hidden = value === null;
      if (value === null) return;
      const rounded = Math.round(value);
      if (rounded === lastFps) return;
      lastFps = rounded;
      fps.textContent = fr(fill(T.fps, { n: rounded }));
    },

    fail(text) {
      layer.append(h('div', { class: 'dt-fail' }, text));
    },

    dispose() {
      if (flashTimer !== null) clearTimeout(flashTimer);
      if (qualityTimer !== null) clearTimeout(qualityTimer);
      for (const t of alertTimers) clearTimeout(t);
      alertTimers.clear();
      layer.remove();
    },
  };
}

function bearingWord(deg: number): string {
  const d = ((deg % 360) + 360) % 360;
  if (d < 45 || d >= 315) return T.partner.aheadName;
  if (d < 135) return T.partner.right;
  if (d < 225) return T.partner.behind;
  return T.partner.left;
}

function proposalCard(
  p: InterfaceModel['proposals'][number],
  local: number,
  people: HudPeople,
): HTMLElement {
  const partner = people.partnerName;
  if (p.from === local) {
    return h(
      'div',
      { class: 'dt-card dashed' },
      h('strong', null, T.proposal.mine),
      p.item === null ? null : h('div', null, p.item),
      p.amountCents === null ? null : h('div', null, euroText(p.amountCents)),
      h('div', { class: 'dt-second' }, fill(T.proposal.waiting, { partner })),
    );
  }
  const card = h('div', { class: 'dt-card dt-proposal', 'data-proposal': p.id });
  const title =
    p.kind === 'open'
      ? T.proposal.openTitle
      : p.kind === 'close-early'
        ? T.proposal.closeTitle
        : fill(T.proposal.received, { partner });
  card.append(h('div', { class: 'dt-partner-head' }, token(people.partnerColor), title));
  if (p.kind === 'open') card.append(h('div', null, fill(T.proposal.openLine, { partner })));
  else if (p.kind === 'close-early')
    card.append(h('div', null, fill(T.proposal.closeLine, { partner })));
  else {
    if (p.item !== null) card.append(h('div', null, p.item));
    if (p.amountCents !== null) card.append(h('div', null, euroText(p.amountCents)));
  }
  card.append(
    h(
      'div',
      { class: 'dt-second' },
      keycap('Entrée'),
      p.kind === 'purchase' || p.kind === 'move' ? ' voir et répondre' : ' répondre',
    ),
  );
  return card;
}

function euroText(cents: number): string {
  return euros(cents, true);
}
