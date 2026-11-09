/**
 * Habitués (cahier 4.11): jours et heures de visite, commande fétiche, lien et niveaux, étapes
 * d'histoire et cadeaux, répliques; Simone guide des premiers jours (un conseil par geste, puis
 * elle se tait). Huit habitués au plus par journée (HA-04).
 */
import type { PlayerIndex } from '../etat/monde';
import { inStock, type Ctx } from './economie';
import type { Group } from './etat';
import { clockMinutes, spawnGroup, spm } from './clients';

function regularState(
  ctx: Ctx,
  id: string,
): { bond: number; steps: string[]; lastDay: number; visits: number } {
  let r = ctx.s.regulars[id];
  if (r === undefined) {
    r = { bond: 0, steps: [], lastDay: 0, visits: 0 };
    ctx.s.regulars[id] = r;
  }
  return r;
}

export function bondLevel(ctx: Ctx, id: string): number {
  const bond = ctx.s.regulars[id]?.bond ?? 0;
  let level = 0;
  for (const l of ctx.cc.regulars.bondLevels)
    if (bond >= l.points) level = Math.max(level, l.level);
  return level;
}

/** Ce que commande l'habitué: sa fétiche si elle est sur l'ardoise et en stock, sinon son repli. */
export function regularOrder(ctx: Ctx, id: string): string[] {
  const r = ctx.cc.regularById.get(id);
  if (r === undefined) return [];
  const onSlate = (list: readonly string[]): boolean =>
    list.length > 0 &&
    list.every((x) => ctx.s.slate.some(([s]) => s === x) && inStock(ctx.cc, ctx.s, x));
  if (onSlate(r.favorite)) return [...r.favorite];
  if (onSlate(r.fallbackFavorite)) return [...r.fallbackFavorite];
  const fav = r.favorite.filter(
    (x) => ctx.s.slate.some(([s]) => s === x) && inStock(ctx.cc, ctx.s, x),
  );
  if (fav.length > 0) return fav;
  const first = ctx.s.slate.find(([x]) => inStock(ctx.cc, ctx.s, x));
  return first === undefined ? [] : [first[0]];
}

function weekday(ctx: Ctx): string {
  return ctx.cc.days.weekdays[(ctx.s.day - 1) % 7] ?? 'mon';
}

/** Visites attendues aujourd'hui (aube d'un jour ouvert), triées par heure. */
export function planRegulars(ctx: Ctx): void {
  const plan = ctx.cc.days.days.find((d) => d.day === ctx.s.day);
  const wd = weekday(ctx);
  const out: [number, string][] = [];
  for (const r of ctx.cc.regulars.regulars) {
    if (
      r.unlockedBy !== null ? ctx.s.eventsDone[r.unlockedBy] === undefined : ctx.s.day < r.firstDay
    )
      continue;
    // Les jours de la démo nomment leurs habitués; au-delà du jour 15, on suit les horaires.
    if (plan !== undefined && r.unlockedBy === null && !plan.regulars.includes(r.id)) continue;
    for (const [days, times] of r.schedule) {
      if (!days.includes(wd)) continue;
      for (const t of times) out.push([(t - ctx.cc.days.open) * spm(ctx), r.id]);
    }
  }
  out.sort((a, b) => a[0] - b[0]);
  ctx.s.expected = out.slice(0, ctx.cc.rules.maxRegularsPerDay);
}

export function stepRegulars(ctx: Ctx): void {
  while (ctx.s.expected.length > 0 && (ctx.s.expected[0]?.[0] ?? Infinity) <= ctx.s.serviceSec) {
    const e = ctx.s.expected.shift();
    if (e === undefined) break;
    const r = ctx.cc.regularById.get(e[1]);
    if (r === undefined || ctx.s.groups.some((g) => g.regular === r.id)) continue;
    const items = regularOrder(ctx, r.id);
    if (items.length === 0) continue;
    spawnGroup(ctx, { profile: r.profile, size: r.size, items, regular: r.id });
    const greet = r.lines.greeting;
    if (greet !== undefined && greet.length > 0)
      ctx.sim.emit({
        type: 'clientele-say',
        who: r.name,
        text: ctx.sim.random.pick(greet),
        player: null,
      });
    if (r.id === 'simone') simoneTip(ctx);
    regularState(ctx, r.id).lastDay = ctx.s.day;
  }
}

/** Simone donne le conseil prévu ce jour-là, une seule fois par geste (HA-06). */
function simoneTip(ctx: Ctx): void {
  const plan = ctx.cc.days.days.find((d) => d.day === ctx.s.day);
  const simone = ctx.cc.regularById.get('simone');
  if (plan === undefined || simone === undefined) return;
  for (const tip of plan.simone) {
    if (ctx.s.simoneTips.includes(tip)) continue;
    const text = simone.tips[tip];
    if (text === undefined) continue;
    ctx.s.simoneTips.push(tip);
    ctx.sim.emit({ type: 'clientele-say', who: simone.name, text, player: null });
    return;
  }
}

function gain(ctx: Ctx, id: string, points: number): void {
  const st = regularState(ctx, id);
  const before = bondLevel(ctx, id);
  st.bond += points;
  if (bondLevel(ctx, id) > before) storySteps(ctx, id);
}

/** Étapes d'histoire ouvertes au niveau atteint (et à leur condition de réputation). */
export function storySteps(ctx: Ctx, id: string): void {
  const r = ctx.cc.regularById.get(id);
  if (r === undefined) return;
  const st = regularState(ctx, id);
  const level = bondLevel(ctx, id);
  for (const step of r.story) {
    if (st.steps.includes(step.id) || step.level > level || ctx.s.cups < step.minCups) continue;
    st.steps.push(step.id);
    ctx.sim.emit({ type: 'clientele-story', regular: id, step: step.id, scene: step.scene });
    const reward = step.reward;
    if (typeof reward.recipe === 'string' && !ctx.s.known.includes(reward.recipe))
      ctx.s.known.push(reward.recipe);
    for (const key of ['item', 'unlock'] as const) {
      const item = reward[key];
      if (typeof item !== 'string') continue;
      if (ctx.cc.catalogue.has(item) && key === 'item') {
        ctx.s.gifts.push([item, ctx.s.day]);
        ctx.sim.emit({ type: 'clientele-gift', item, from: r.name });
      } else if (!ctx.s.unlocks.includes(item)) ctx.s.unlocks.push(item);
    }
    for (const flag of ['slateDoodle', 'guestbookPin'])
      if (reward[flag] === true && !ctx.s.flags.includes(`${id}:${flag}`))
        ctx.s.flags.push(`${id}:${flag}`);
  }
}

export function onRegularServed(ctx: Ctx, g: Group): void {
  if (g.regular === null) return;
  const r = ctx.cc.regularById.get(g.regular);
  if (r === undefined) return;
  const gains = ctx.cc.regulars.bondGains;
  const st = regularState(ctx, r.id);
  st.visits++;
  ctx.s.today.visits.push([r.id, clockMinutes(ctx.cc, ctx.s), [...g.items]]);
  const fav = r.favorite.length > 0 && r.favorite.every((x) => g.items.includes(x));
  let pts = gains.visitServed;
  if (fav) pts += gains.favoriteServed;
  if (g.asUsual) pts += gains.asUsual;
  const lines = g.asUsual ? r.lines.asUsual : fav ? r.lines.favoriteServed : undefined;
  if (lines !== undefined && lines.length > 0)
    ctx.sim.emit({
      type: 'clientele-say',
      who: r.name,
      text: ctx.sim.random.pick(lines),
      player: null,
    });
  gain(ctx, r.id, pts);
  // Les étapes du niveau 0 (les clés de Simone, le club de Bastien) arrivent à la première visite.
  storySteps(ctx, r.id);
}

/** Deux mots échangés (SE-04): +12 de satisfaction aux voisins et aux habitués, du lien. */
export function talk(ctx: Ctx, player: PlayerIndex, g: Group): void {
  const first = !g.chat;
  g.chat = true;
  const r = g.regular === null ? undefined : ctx.cc.regularById.get(g.regular);
  if (r !== undefined) {
    const lines = r.lines.chat ?? r.lines.greeting ?? [];
    if (lines.length > 0)
      ctx.sim.emit({
        type: 'clientele-say',
        who: r.name,
        text: ctx.sim.random.pick(lines),
        player,
      });
    if (first) gain(ctx, r.id, ctx.cc.regulars.bondGains.chat);
    return;
  }
  const p = ctx.cc.profiles.get(g.profile);
  if (p !== undefined && first)
    ctx.sim.emit({
      type: 'clientele-say',
      who: p.name,
      text: `${p.seeks.charAt(0).toUpperCase()}${p.seeks.slice(1)}.`,
      player,
    });
}
