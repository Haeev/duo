/**
 * Les plis de Lucie (0.12, section 2.4 de `v0-12-conception.md`): chaque jour sauf le dimanche,
 * une fois la tournée confiée (drapeau `mailRound.enabledFlag`), Firmin pose la sacoche sur le banc
 * du quai à 8 h: 2 à 4 plis tirés par la graine. On les prend à la sacoche, on les remet au
 * destinataire en lui parlant (le pli suit le sac: on peut se les passer). Payé à la livraison,
 * un peu plus avant midi; à 18 h, Firmin reprend ce qui reste, sans rien payer ni reprocher.
 */
import { weekdayOf } from '../donnees/calendrier';
import type { MailKind } from '../donnees/plis';
import { unitDraw } from '../etat/tirage';
import type { Character, MailPli } from '../etat/types';
import { type Sim, bump, distance, emit, message, say } from './contexte';
import { crossed } from './train';
import { countInBag, countInStacks, giveToCharacter, takeFromBag, takeFromStacks } from './sac';

/** Cible de la sacoche au banc du quai (verbe « ouvrir »). */
export const MAIL_POINT = 'mail_bag';

/** La quête qui confie la sacoche: pendant qu'elle court, la sacoche est déjà au banc. */
const FIRST_ROUND_QUEST = 'lucie_round';

function firstRound(sim: Sim): boolean {
  return sim.world.quests.some((q) => q.id === FIRST_ROUND_QUEST && q.status === 'active');
}

function roundToday(sim: Sim): boolean {
  const r = sim.content.settings.mailRound;
  if (r === null || weekdayOf(sim.world.clock.day) === r.noRoundWeekday) return false;
  return sim.world.flags.includes(r.enabledFlag) || firstRound(sim);
}

function drawPlis(sim: Sim, day: number): MailPli[] {
  const r = sim.content.settings.mailRound;
  if (r === null) return [];
  const seed = sim.world.seed;
  const total = r.counts.reduce((n, c) => n + c.weight, 0);
  let pick = unitDraw(seed, 'plis', day) * total;
  let count = r.counts[0]?.count ?? 0;
  for (const c of r.counts) {
    if (pick < c.weight) {
      count = c.count;
      break;
    }
    pick -= c.weight;
  }
  const people = r.recipients.filter((id) => sim.world.villagers.some((v) => v.id === id));
  if (people.length === 0) return [];
  // La première tournée (quête `lucie_round`): trois plis au moins, dont une lettre en tête.
  const first = firstRound(sim);
  if (first) count = Math.max(count, 3);
  return Array.from({ length: count }, (_, i) => ({
    kind:
      (first && i === 0) || unitDraw(seed, `plis:sorte:${String(i)}`, day) >= r.parcelShare
        ? 'letter'
        : 'parcel',
    to:
      people[Math.floor(unitDraw(seed, `plis:pour:${String(i)}`, day) * people.length)] ??
      people[0] ??
      '',
    taken: false,
    delivered: false,
  }));
}

function itemOf(sim: Sim, kind: MailKind): string {
  return sim.content.settings.mailRound?.items[kind] ?? kind;
}

/** La tournée à chaque pas: la sacoche à 8 h (aussi à la reprise dans la journée), la reprise à 18 h. */
export function mailClock(sim: Sim, before: number, after: number): void {
  const r = sim.content.settings.mailRound;
  if (r === null) return;
  const { world } = sim;
  const day = world.clock.day;
  if (roundToday(sim) && after >= r.from && after < r.until && world.mail?.day !== day) {
    // Les plis repris hier par Firmin reviennent en tête de la sacoche.
    const back =
      world.mail?.items.filter((p) => !p.delivered).map((p) => ({ ...p, taken: false })) ?? [];
    world.mail = { day, items: [...back, ...drawPlis(sim, day)], carryOver: 0 };
    say(sim, 'both', 'mail_ready', { count: world.mail.items.length });
    emit(sim, { type: 'mail_ready', count: world.mail.items.length });
    sim.runtime.changed = true;
  }
  const mail = world.mail;
  if (mail?.day !== day || !crossed(before, after, r.until)) return;
  const left = mail.items.filter((p) => !p.delivered);
  // Firmin reprend les plis non livrés (sacs, cellier, caisse): il les portera lui-même.
  for (const kind of ['letter', 'parcel'] as const) {
    const item = itemOf(sim, kind);
    for (const c of world.characters) takeFromBag(c, item, countInBag(c, item));
    takeFromStacks(world.cellar, item, countInStacks(world.cellar, item));
  }
  world.groundItems = world.groundItems.filter(
    (g) => g.item !== itemOf(sim, 'letter') && g.item !== itemOf(sim, 'parcel'),
  );
  mail.items = left;
  mail.carryOver = left.length;
  if (left.length > 0) {
    say(sim, 'both', 'mail_returned');
    emit(sim, { type: 'mail_returned' });
  }
  sim.runtime.changed = true;
}

/** La sacoche a encore des plis à prendre, et l'on est au banc du quai. */
export function mailWaiting(sim: Sim, c: Character): boolean {
  const r = sim.content.settings.mailRound;
  const mail = sim.world.mail;
  if (
    r === null ||
    mail?.day !== sim.world.clock.day ||
    sim.world.clock.minutes >= r.until ||
    !mail.items.some((p) => !p.taken)
  )
    return false;
  const at = sim.map.points[r.point];
  return at !== undefined && distance(c.pos, at) <= sim.content.settings.ranges.talk;
}

/** Prendre les plis de la sacoche (tout ce qui reste: on se répartit le bourg à voix haute). */
export function takeMail(sim: Sim, c: Character): void {
  const mail = sim.world.mail;
  if (mail === null || !mailWaiting(sim, c)) {
    if (mail !== null && mail.day === sim.world.clock.day) say(sim, c.id, 'mail_empty');
    return;
  }
  const taken = mail.items.filter((p) => !p.taken);
  for (const p of taken) {
    p.taken = true;
    giveToCharacter(sim, c, itemOf(sim, p.kind), 'ordinary', 1);
  }
  say(sim, c.id, 'mail_taken', { list: plisText(sim, taken) });
  sim.runtime.changed = true;
}

/**
 * Parler au destinataire avec son pli dans le sac: il le prend, la tournée paie (plus avant midi).
 * `false` s'il n'y a rien pour lui dans ce sac (la conversation ordinaire suit).
 */
export function deliverMail(sim: Sim, c: Character, villager: string): boolean {
  const r = sim.content.settings.mailRound;
  const mail = sim.world.mail;
  if (r === null || mail?.day !== sim.world.clock.day || sim.world.clock.minutes >= r.until)
    return false;
  const delivered: MailPli[] = [];
  for (const p of mail.items) {
    if (p.to !== villager || !p.taken || p.delivered) continue;
    const item = itemOf(sim, p.kind);
    if (countInBag(c, item) < 1) continue;
    takeFromBag(c, item, 1);
    p.delivered = true;
    delivered.push(p);
  }
  if (delivered.length === 0) return false;
  const early = sim.world.clock.minutes < r.earlyBefore;
  const amount = delivered.reduce((n, p) => n + r.pay[p.kind] + (early ? r.earlyBonus : 0), 0);
  sim.world.purse += amount;
  const name = sim.content.villagers.find((v) => v.id === villager)?.firstName ?? villager;
  say(sim, 'both', 'mail_delivered', { name, amount });
  if (early) say(sim, 'both', 'mail_early', { amount: r.earlyBonus * delivered.length });
  // Compteur de la quête `lucie_round` (`donnees/README.md`, section 3.1).
  bump(sim, 'mail_delivered', c.id, delivered.length);
  bump(sim, `mail_delivered:${villager}`, c.id, delivered.length);
  emit(sim, { type: 'mail_delivered', by: c.id, villager, amount });
  sim.runtime.changed = true;
  return true;
}

/** « une lettre pour Basile, un paquet pour Odette »: ces plis, avec leur destinataire. */
function plisText(sim: Sim, plis: readonly MailPli[]): string {
  const f = sim.content.texts.orderFormat;
  const parts = plis.map((p) =>
    message(sim, p.kind === 'letter' ? 'mail_letter_for' : 'mail_parcel_for', {
      name: sim.content.villagers.find((v) => v.id === p.to)?.firstName ?? p.to,
    }),
  );
  if (parts.length <= 1) return parts.join('');
  return `${parts.slice(0, -1).join(f.separator)}${f.lastSeparator}${parts[parts.length - 1] ?? ''}`;
}
