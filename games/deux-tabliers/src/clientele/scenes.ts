/**
 * Les onze événements de la démo (`evenements.json`, démo section 5): déclencheur, scène, indices
 * visibles d'un seul joueur, aide automatique, issue « Réussi » ou « Formidable » (jamais d'échec).
 * Un seul événement actif à la fois; ils n'interrompent aucun geste (rien n'est retiré à un joueur).
 */
import type { PlayerIndex } from '../etat/monde';
import { cupsFromPoints, addPoints, extensionReady, type Ctx } from './economie';
import type { EventDef } from './donnees';
import type { Group } from './etat';
import { marketingFactor } from './remises';
import {
  addGuestbook,
  clockMinutes,
  deliverOrder,
  seat,
  seatNow,
  sendHome,
  spawnGroup,
  spm,
  type ServeResult,
} from './clients';

export interface SceneHooks {
  onRegister?(ctx: Ctx, g: Group): void;
  onOrder?(ctx: Ctx, g: Group, player: PlayerIndex | null): void;
  onServed?(ctx: Ctx, g: Group, result: ServeResult): void;
  onSeated?(ctx: Ctx, g: Group): void;
  onLeft?(ctx: Ctx, g: Group, satisfaction: number): void;
  /** Vrai: le groupe s'installe dehors (marches de la fontaine, tables à tréteaux). */
  outsideSeating?(ctx: Ctx, g: Group): boolean;
}

function def(ctx: Ctx, id: string): EventDef | undefined {
  return ctx.cc.events.get(id);
}

/** Réplique d'une scène (`staging.lines`), `{clé}` remplacées. */
function lineOf(
  e: EventDef,
  key: string,
  vars: Readonly<Record<string, string>> = {},
): [string, string] {
  const [who, text] = e.staging.lines?.[key] ?? ['', ''];
  return [who, text.replace(/\{(\w+)\}/g, (m, k: string) => vars[k] ?? m)];
}

function sayLine(
  ctx: Ctx,
  e: EventDef,
  key: string,
  vars: Readonly<Record<string, string>> = {},
): void {
  const [who, text] = lineOf(e, key, vars);
  if (text !== '') say(ctx, who, text);
}

function say(ctx: Ctx, who: string, text: string, player: PlayerIndex | null = null): void {
  const name = ctx.cc.regularById.get(who)?.name ?? who;
  ctx.sim.emit({ type: 'clientele-say', who: name, text, player });
}

/** Joueur le plus près de la vitrine (l'autre est au bar), pour un indice. */
function nearWindow(ctx: Ctx): PlayerIndex | null {
  const w = ctx.cc.rules.windowWatch;
  let best: PlayerIndex | null = null;
  let bestD = w.reach;
  for (const i of [0, 1] as const) {
    const d = Math.abs(ctx.sim.world.players[i].z - w.z);
    if (d <= bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

function elapsed(ctx: Ctx): number {
  return ctx.s.event === null ? 0 : ctx.s.serviceSec - ctx.s.event.startedAt;
}

function flag(ctx: Ctx, f: string): void {
  const e = ctx.s.event;
  if (e !== null && !e.flags.includes(f)) e.flags.push(f);
}

function has(ctx: Ctx, f: string): boolean {
  return ctx.s.event?.flags.includes(f) ?? false;
}

function castOf(ctx: Ctx, role: string): Group[] {
  return ctx.s.groups.filter((g) => g.role === role);
}

// ---------------------------------------------------------------------------------------------
// Programme du jour (aube)

/** Événements prévus aujourd'hui, et leur minute de jeu. */
export function planEvents(ctx: Ctx): void {
  const { s, cc } = ctx;
  const out: [string, number][] = [];
  const plan = cc.days.days.find((d) => d.day === s.day);
  const add = (id: string, minute: number): void => {
    if (s.eventsDone[id] === undefined && !out.some(([x]) => x === id)) out.push([id, minute]);
  };
  // Le carnet vert: dès 2 tasses à partir du jour 9, au plus tard le 10 (démo section 5).
  const carnet = def(ctx, 'le_carnet_vert');
  if (
    carnet !== undefined &&
    s.eventsDone[carnet.id] === undefined &&
    carnet.fromDay !== null &&
    s.day >= carnet.fromDay
  ) {
    const min = carnet.staging.minCups ?? 0;
    if (s.cups >= min || s.day >= (carnet.fallbackDay ?? s.day))
      add(carnet.id, carnet.time ?? cc.days.open);
  }
  const id = plan?.event ?? null;
  const e = id === null ? undefined : def(ctx, id);
  if (e !== undefined && e.id !== 'le_carnet_vert') {
    if (e.id === 'l_inspection') {
      const [a, b] = e.staging.window ?? [540, 960];
      add(e.id, ctx.sim.random.int(a, b));
    } else if (e.id === 'le_cafe_d_honneur') {
      if (s.flags.includes('wedding-accepted')) add(e.id, e.time ?? 930);
    } else if (e.id === 'le_coeur_de_lait') add(e.id, e.staging.from ?? 600);
    else if (
      e.id !== 'la_vieille_dame_tousse' ||
      ctx.sim.world.installation?.machine.model !== 'machine-revisee'
    )
      // Machine révisée par Joseph (démo v0.3): pas de panne le jour 6 (IN-14).
      add(e.id, e.time ?? cc.days.open);
  }
  // L'averse: une fois entre les jours 9 et 13, un jour couvert où la terrasse est ouverte.
  const rain = def(ctx, 'l_averse_de_trois_heures');
  if (
    rain !== undefined &&
    rain.fromDay !== null &&
    s.eventsDone[rain.id] === undefined &&
    s.day >= rain.fromDay
  ) {
    const last = rain.staging.lastDay ?? rain.fromDay;
    if (s.day <= last && extensionReady(s, 'village_terrasse')) {
      if (s.day === last && s.weather !== 'couvert') s.weather = 'couvert';
      if (s.weather === 'couvert') add(rain.id, rain.time ?? 900);
    }
  }
  out.sort((a, b) => a[1] - b[1]);
  s.eventsToday = out;
}

/** Multiplicateur d'affluence du jour pour un profil (marché aux fleurs, fête, article). */
export function dayAffluence(ctx: Ctx, profile: string): number {
  const { s, cc } = ctx;
  let f = 1;
  for (const [until, k] of s.affluence) if (s.day <= until) f *= k;
  const plan = cc.days.days.find((d) => d.day === s.day);
  const dayEvent =
    plan?.dayEvent === null || plan?.dayEvent === undefined ? undefined : def(ctx, plan.dayEvent);
  f *= dayEvent?.effects?.profiles[profile] ?? 1;
  if (s.day === cc.economy.challenge.day) f *= cc.economy.challenge.affluence;
  // Actions pour faire connaître le café (marketing v0.2), plafonnées ensemble.
  return f * marketingFactor(cc, s, profile);
}

// ---------------------------------------------------------------------------------------------
// Début, pas et fin

function start(ctx: Ctx, e: EventDef): void {
  ctx.s.event = {
    id: e.id,
    startedAt: ctx.s.serviceSec,
    stage: 'start',
    flags: [],
    count: 0,
    holder: null,
    marks: [-1e9, -1e9],
  };
  ctx.sim.emit({ type: 'clientele-event-start', event: e.id, name: e.name });
  for (const line of e.scene) {
    if (line.who === 'system')
      ctx.sim.emit({ type: 'clientele-say', who: '', text: line.text, player: null });
    else say(ctx, e.cast.find((c) => c.id === line.who)?.name ?? line.who, line.text);
  }
  const st = e.staging;
  const items = (list: readonly (readonly string[])[] | undefined): string[] => {
    for (const order of list ?? []) {
      const ok = order.filter((r) => ctx.s.known.includes(r));
      if (ok.length === order.length) return [...ok];
    }
    return [];
  };
  switch (e.kind) {
    case 'client_presse': {
      spawnGroup(ctx, {
        profile: st.profile ?? 'presses',
        size: 1,
        items: items(st.orders),
        role: e.cast[0]?.id ?? e.id,
        takeAway: true,
      });
      const p = nearWindow(ctx);
      if (p !== null)
        ctx.sim.emit({
          type: 'clientele-clue',
          event: e.id,
          player: p,
          text: lineOf(e, 'clue')[1],
          choices: [lineOf(e, 'choice')[1]],
        });
      break;
    }
    case 'panne':
      ctx.s.conditions.push('machine-degraded');
      break;
    case 'commande_de_groupe': {
      const order: string[] = [];
      for (const [family, n, fallback] of st.families ?? []) {
        const pick = (fam: string | null): string | undefined =>
          fam === null
            ? undefined
            : ctx.s.slate.map(([r]) => r).find((r) => ctx.cc.recipes.get(r)?.family === fam);
        const r = pick(family) ?? pick(fallback) ?? ctx.s.slate[0]?.[0];
        for (let i = 0; i < n && r !== undefined; i++) order.push(r);
      }
      spawnGroup(ctx, {
        profile: st.profile ?? 'promeneurs',
        size: st.groups?.[0] ?? 9,
        items: order,
        role: e.cast[1]?.id ?? e.id,
      });
      break;
    }
    case 'critique_deguisee': {
      const it = items(st.orders);
      spawnGroup(ctx, {
        profile: st.profile ?? 'flaneurs',
        size: 1,
        items: it.length > 0 ? it : items(st.fallbackOrders),
        role: e.cast[0]?.id ?? e.id,
      });
      break;
    }
    case 'enfant_perdu': {
      const g = spawnGroup(ctx, {
        profile: st.profile ?? 'familles',
        size: 1,
        items: [],
        role: 'jules',
      });
      seatNow(ctx, g);
      ctx.s.event.stage = 'searching';
      break;
    }
    case 'inspection': {
      const g = spawnGroup(ctx, {
        profile: st.profile ?? 'voisins',
        size: 1,
        items: [],
        role: e.cast[0]?.id ?? e.id,
      });
      seatNow(ctx, g);
      break;
    }
    case 'mariage':
      for (const size of st.groups ?? [7, 7]) {
        const drinks = ctx.s.slate
          .map(([r]) => r)
          .filter((r) => ctx.cc.rules.drinks.includes(ctx.cc.recipes.get(r)?.family ?? ''));
        const order = Array.from(
          { length: size },
          (_, i) => drinks[i % Math.max(1, drinks.length)] ?? 'espresso',
        );
        spawnGroup(ctx, {
          profile: st.profile ?? 'familles',
          size,
          items: order,
          role: 'noce',
          flatRate: true,
        });
      }
      break;
    case 'meteo': {
      ctx.s.conditions.push('averse');
      for (const g of ctx.s.groups)
        if (g.stage === 'seated' && g.place === 'terrace') relocate(ctx, g);
      break;
    }
    case 'defi_local':
      ctx.s.conditions.push('fete');
      break;
    default:
      break;
  }
}

function relocate(ctx: Ctx, g: Group): void {
  const leaveAt = g.leaveAt;
  g.seats = [];
  seat(ctx, g);
  g.leaveAt = leaveAt;
  if (g.place === 'none')
    flag(ctx, `stood:${String(g.id)}:${String(Math.round(ctx.s.serviceSec))}`);
}

function finish(ctx: Ctx, outcome: 'reussi' | 'formidable'): void {
  const e = ctx.s.event === null ? undefined : def(ctx, ctx.s.event.id);
  if (e === undefined) {
    ctx.s.event = null;
    return;
  }
  const r = e.rewards[outcome] ?? e.rewards.reussi;
  if (r !== undefined) {
    const euros = Math.round(r.euros * 100);
    ctx.s.cash += euros;
    ctx.s.today.euros += euros;
    addPoints(ctx, r.points);
    ctx.s.renown += r.renown;
    if (r.affluence !== null) ctx.s.affluence.push([ctx.s.day + r.affluence[1], r.affluence[0]]);
  }
  const delay = e.staging.itemDelayDays ?? 0;
  for (const item of e.items) {
    ctx.s.gifts.push([item, ctx.s.day + delay]);
    ctx.sim.emit({ type: 'clientele-gift', item, from: e.name });
  }
  if (e.guestbook !== null) addGuestbook(ctx, e.guestbook, '', true);
  ctx.s.eventsDone[e.id] = outcome;
  ctx.s.conditions = ctx.s.conditions.filter((c) => c !== 'machine-degraded' && c !== 'averse');
  ctx.sim.emit({
    type: 'clientele-event-end',
    event: e.id,
    outcome,
    text: e.outcomes[outcome] ?? '',
  });
  ctx.s.cups = Math.max(ctx.s.cups, cupsFromPoints(ctx.cc, ctx.s.points));
  ctx.s.event = null;
}

export function stepEvents(ctx: Ctx): void {
  const { s } = ctx;
  const minute = clockMinutes(ctx.cc, s);
  if (
    s.event === null &&
    s.phase === 'service' &&
    s.eventsToday.length > 0 &&
    (s.eventsToday[0]?.[1] ?? Infinity) <= minute
  ) {
    const next = s.eventsToday.shift();
    const e = next === undefined ? undefined : def(ctx, next[0]);
    if (e !== undefined) start(ctx, e);
  }
  const ev = s.event;
  if (ev === null) return;
  const e = def(ctx, ev.id);
  if (e === undefined) return;
  const t = elapsed(ctx);
  const st = e.staging;
  switch (e.kind) {
    case 'client_presse': {
      const help = st.helpAfter ?? 135;
      if (t >= help) {
        // Le chauffeur attend en soupirant, Octave court: c'est quand même réussi.
        for (const g of castOf(ctx, e.cast[0]?.id ?? '')) sendHome(ctx, g);
        finish(ctx, 'reussi');
      }
      break;
    }
    case 'panne':
      if (t >= (e.helpAfter ?? 180)) {
        sayLine(ctx, e, 'help');
        finish(ctx, 'reussi');
      }
      break;
    case 'commande_de_groupe':
      if (t >= (st.helpAfter ?? 420)) {
        for (const g of castOf(ctx, e.cast[1]?.id ?? ''))
          while (g.open > 0) deliverOrder(ctx, g.id);
      }
      break;
    case 'enfant_perdu':
      if (t >= (e.helpAfter ?? 150)) {
        sayLine(ctx, e, 'help');
        for (const g of castOf(ctx, 'jules')) sendHome(ctx, g);
        finish(ctx, 'reussi');
      }
      break;
    case 'inspection': {
      const limit = st.dirtyLimit ?? 30;
      if (s.dirty.some(([, since]) => s.serviceSec - since > limit)) flag(ctx, 'fail:tables');
      if (s.cartons.length > 0) flag(ctx, 'fail:cartons');
      if (t >= (st.duration ?? 360)) {
        const fails = ev.flags.filter((f) => f.startsWith('fail:'));
        for (const g of castOf(ctx, e.cast[0]?.id ?? '')) sendHome(ctx, g);
        // Les critères manqués deviennent ses conseils, dans l'ordre de `criteria`.
        const order = ['tables', 'cups', 'cartons', 'floor', 'fridge'];
        for (const f of fails) {
          const text = e.criteria[order.indexOf(f.slice(5))];
          if (text !== undefined) sayLine(ctx, e, 'advice', { text });
        }
        finish(ctx, fails.length === 0 ? 'formidable' : 'reussi');
      }
      break;
    }
    case 'critique_deguisee': {
      // Elle écrit son article une fois installée (vingt minutes de jeu), puis reste en cliente.
      const critic = castOf(ctx, e.cast[0]?.id ?? '')[0];
      const write = (st.writeGameMinutes ?? 20) * spm(ctx);
      if (critic?.stage === 'seated' && s.serviceSec - critic.since >= write) {
        const n = ['quality', 'art', 'clean-table', 'chat', 'advice'].filter((f) =>
          has(ctx, f),
        ).length;
        finish(ctx, n >= (st.formidableCriteria ?? 4) ? 'formidable' : 'reussi');
      }
      break;
    }
    case 'concours':
      if (minute >= (st.to ?? 720))
        finish(ctx, ev.count >= (st.goal ?? 20) ? 'formidable' : 'reussi');
      break;
    case 'meteo': {
      const limit = st.standLimit ?? 20;
      for (const g of s.groups) {
        const mark = ev.flags.find((f) => f.startsWith(`stood:${String(g.id)}:`));
        if (mark === undefined || g.place !== 'none') continue;
        if (s.serviceSec - Number(mark.split(':')[2]) > limit) flag(ctx, 'wet');
        relocate(ctx, g);
      }
      if (t >= (st.durationGameMinutes ?? 60) * spm(ctx))
        finish(ctx, has(ctx, 'wet') ? 'reussi' : 'formidable');
      break;
    }
    default:
      break;
  }
}

/** Fin de journée: la fête se juge sur ses trois objectifs; un événement encore ouvert se clôt bien. */
export function closeDayEvents(ctx: Ctx): void {
  const { s, cc } = ctx;
  const ev = s.event;
  if (ev === null) return;
  const e = def(ctx, ev.id);
  if (e?.kind === 'defi_local') {
    const c = cc.economy.challenge;
    const goals = [
      s.today.served >= c.groups,
      extensionReady(s, 'village_terrasse'),
      s.cups >= c.cups,
    ];
    s.conditions = s.conditions.filter((x) => x !== 'fete');
    finish(ctx, goals.every(Boolean) ? 'formidable' : 'reussi');
    return;
  }
  if (e?.kind === 'concours') {
    finish(ctx, ev.count >= (e.staging.goal ?? 20) ? 'formidable' : 'reussi');
    return;
  }
  finish(ctx, 'reussi');
}

// ---------------------------------------------------------------------------------------------
// Gestes des joueurs

/** Geste de scène d'un joueur (intention `clientele-scene`); rend un refus ou `null`. */
export function sceneAct(
  ctx: Ctx,
  player: PlayerIndex,
  action: string,
  choice: number,
): string | null {
  const ev = ctx.s.event;
  const e = ev === null ? undefined : def(ctx, ev.id);
  if (ev === null || e === undefined) return 'Rien de spécial pour l’instant';
  const st = e.staging;
  const p = ctx.sim.world.players[player];
  const windowOk = Math.abs(p.z - ctx.cc.rules.windowWatch.z) <= ctx.cc.rules.windowWatch.reach;
  if (action === 'driver' && e.kind === 'client_presse') {
    if (!windowOk) return 'Le chauffeur se voit depuis la vitrine';
    if (has(ctx, 'extended')) return 'Il a déjà accordé sa rallonge';
    flag(ctx, 'extended');
    sayLine(ctx, e, 'driver');
    return null;
  }
  if (action === 'repair' && e.kind === 'panne') {
    const machine = ctx.sim.world.furniture.find(
      (f) => f.type === (st.station ?? 'machine-espresso'),
    );
    if (machine === undefined || Math.hypot(machine.x - p.x, machine.z - p.z) > (st.reach ?? 1.8))
      return 'Approche-toi de la machine';
    ev.marks[player] = ctx.s.serviceSec;
    const other = ev.marks[player === 0 ? 1 : 0];
    if (ctx.s.serviceSec - other <= (st.pairWindow ?? 3)) {
      const early = clockMinutes(ctx.cc, ctx.s) < (st.formidableBefore ?? 540);
      finish(ctx, early ? 'formidable' : 'reussi');
    } else
      ctx.sim.emit({
        type: 'clientele-clue',
        event: e.id,
        player,
        text: lineOf(e, 'hold')[1],
        choices: [],
      });
    return null;
  }
  if (action === 'signal' && e.kind === 'enfant_perdu') {
    if (!windowOk) return 'La place se voit depuis la vitrine';
    if (choice !== (st.correct ?? 2)) {
      sayLine(ctx, e, 'wrong');
      return null;
    }
    sayLine(ctx, e, 'found');
    for (const g of castOf(ctx, 'jules')) sendHome(ctx, g);
    finish(ctx, elapsed(ctx) <= (st.formidableWithin ?? 90) ? 'formidable' : 'reussi');
    return null;
  }
  if (action === 'advice' && e.kind === 'critique_deguisee') {
    if (ev.holder !== player) return 'C’est à la caisse qu’elle a posé la question';
    if (choice < 2) flag(ctx, 'advice');
    flag(ctx, 'advised');
    return null;
  }
  if (action === 'surprise' && e.kind === 'mariage') {
    flag(ctx, 'surprise');
    sayLine(ctx, e, 'surprise');
    if (castOf(ctx, 'noce').every((g) => g.servedAt !== null)) finishWedding(ctx);
    return null;
  }
  return 'Pas maintenant';
}

function finishWedding(ctx: Ctx): void {
  const ev = ctx.s.event;
  const e = ev === null ? undefined : def(ctx, ev.id);
  if (ev === null || e === undefined) return;
  const quick = ev.flags.includes('quick');
  finish(ctx, quick && has(ctx, 'surprise') ? 'formidable' : 'reussi');
}

/** Parler à un groupe: indices de Jules, deux mots à la cliente au carnet vert. */
export function onTalk(ctx: Ctx, player: PlayerIndex, g: Group): void {
  const ev = ctx.s.event;
  const e = ev === null ? undefined : def(ctx, ev.id);
  if (ev === null || e === undefined) return;
  if (g.role === 'jules') {
    const clues = e.staging.clues ?? [];
    ev.holder = player;
    const text = clues[Math.min(ev.count, clues.length - 1)];
    ev.count++;
    if (text !== undefined)
      ctx.sim.emit({ type: 'clientele-clue', event: e.id, player, text, choices: [] });
    const other: PlayerIndex = player === 0 ? 1 : 0;
    if (ev.count === 1)
      ctx.sim.emit({
        type: 'clientele-clue',
        event: e.id,
        player: other,
        text: lineOf(e, 'window')[1],
        choices: e.staging.passersby ?? [],
      });
  }
  if (e.kind === 'critique_deguisee' && g.role === e.cast[0]?.id) flag(ctx, 'chat');
}

export const sceneHooks: SceneHooks = {
  onOrder(ctx, g, player) {
    const ev = ctx.s.event;
    const e = ev === null ? undefined : def(ctx, ev.id);
    if (ev === null || e === undefined || player === null) return;
    if (e.kind === 'commande_de_groupe' && g.role === e.cast[1]?.id) {
      ev.holder = player;
      const names = new Map<string, number>();
      for (const id of g.items) {
        const n = ctx.cc.recipes.get(id)?.name ?? id;
        names.set(n, (names.get(n) ?? 0) + 1);
      }
      const list = [...names].map(([n, k]) => `${String(k)} ${n}`).join(', ');
      ctx.sim.emit({
        type: 'clientele-clue',
        event: e.id,
        player,
        text: lineOf(e, 'list', { list })[1],
        choices: [],
      });
    }
    if (e.kind === 'critique_deguisee' && g.role === e.cast[0]?.id) {
      ev.holder = player;
      ctx.sim.emit({
        type: 'clientele-clue',
        event: e.id,
        player,
        text: e.staging.clueCounter ?? '',
        choices: e.staging.advice ?? [],
      });
    }
  },
  onServed(ctx, g, result) {
    const ev = ctx.s.event;
    const e = ev === null ? undefined : def(ctx, ev.id);
    if (ev === null || e === undefined) return;
    const t = elapsed(ctx);
    if (e.kind === 'client_presse' && g.role === e.cast[0]?.id) {
      // Formidable: servi avant le klaxon, sans la rallonge; sinon réussi (avec ou sans rallonge).
      finish(ctx, t <= (e.timeLimit ?? 75) && !has(ctx, 'extended') ? 'formidable' : 'reussi');
      return;
    }
    if (e.kind === 'commande_de_groupe' && g.role === e.cast[1]?.id && g.open === 0) {
      finish(ctx, t <= (e.timeLimit ?? 240) ? 'formidable' : 'reussi');
      return;
    }
    if (e.kind === 'critique_deguisee' && g.role === e.cast[0]?.id) {
      const q = result.qualities ?? ['good'];
      if (q.every((x) => x !== 'fine')) flag(ctx, 'quality');
      if (result.latteArt === true) flag(ctx, 'art');
      return;
    }
    if (e.kind === 'mariage' && g.role === 'noce') {
      const noce = castOf(ctx, 'noce');
      if (noce.every((x) => x.servedAt !== null)) {
        if (t <= (e.staging.formidableWithin ?? 300)) flag(ctx, 'quick');
        if (has(ctx, 'surprise')) finishWedding(ctx);
        else
          ctx.sim.emit({
            type: 'clientele-clue',
            event: e.id,
            player: g.orderedBy ?? 0,
            text: lineOf(e, 'ask')[1],
            choices: ctx.s.slate.map(([r]) => ctx.cc.recipes.get(r)?.name ?? r),
          });
      }
      return;
    }
    if (e.kind === 'concours') {
      const milk = g.items.some((id) =>
        (e.staging.milkFamilies ?? ['milk_coffee']).includes(ctx.cc.recipes.get(id)?.family ?? ''),
      );
      if (!milk) return;
      // Les gestes simplifiés donnent « Bien » à chaque dessin: un point, deux pour un « Parfait ».
      const perfect = result.latteArt === true && (result.qualities ?? []).includes('perfect');
      ev.count += perfect ? 2 : 1;
      sayLine(ctx, e, perfect ? 'perfect' : 'good');
    }
  },
  onSeated(ctx, g) {
    const ev = ctx.s.event;
    const e = ev === null ? undefined : def(ctx, ev.id);
    if (ev === null || e === undefined) return;
    if (e.kind === 'critique_deguisee' && g.role === e.cast[0]?.id) {
      if (!g.dirtySeat) flag(ctx, 'clean-table');
      const bar: PlayerIndex = ev.holder === 0 ? 1 : 0;
      ctx.sim.emit({
        type: 'clientele-clue',
        event: e.id,
        player: bar,
        text: e.staging.clueBar ?? '',
        choices: [],
      });
    }
  },
  onLeft(ctx, g) {
    const ev = ctx.s.event;
    const e = ev === null ? undefined : def(ctx, ev.id);
    if (ev === null || e === undefined) return;
    if (e.kind === 'critique_deguisee' && g.role === e.cast[0]?.id) {
      const n = ['quality', 'art', 'clean-table', 'chat', 'advice'].filter((f) =>
        has(ctx, f),
      ).length;
      finish(ctx, n >= (e.staging.formidableCriteria ?? 4) ? 'formidable' : 'reussi');
    }
  },
  outsideSeating(ctx, g) {
    const ev = ctx.s.event;
    const e = ev === null ? undefined : def(ctx, ev.id);
    if (g.role !== null && e?.staging.seat === 'outside') return true;
    // Fête sans terrasse: la mairie prête des tables à tréteaux sur la place.
    if (ev !== null && e?.kind === 'defi_local' && !extensionReady(ctx.s, 'village_terrasse')) {
      const p = ctx.cc.profiles.get(g.profile);
      const outside = ctx.s.groups
        .filter((x) => x.place === 'outside')
        .reduce((sum, x) => sum + x.size, 0);
      return p?.seat === 'terrace' && outside + g.size <= ctx.cc.economy.challenge.trestleSeats;
    }
    return false;
  },
};
