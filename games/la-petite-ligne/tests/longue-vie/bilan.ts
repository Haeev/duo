/**
 * Seuils du robot longue vie (tour 8, section 6.4): invariants (le test échoue) et objectifs
 * (mesurés et listés). Une seule source pour le test et pour le rapport écrit à la fin.
 */
import type { CharacterId } from '../../src/etat/types';
import type { DayRecord, LongRun } from './partie';

export interface Threshold {
  id: string;
  label: string;
  value: string;
  threshold: string;
  held: boolean;
}

const PLAYERS: readonly CharacterId[] = ['p1', 'p2'];
const SEASONS = ['printemps', 'été', 'automne', 'hiver'] as const;
/** Table 3.1, fréquences visées (soleil, nuages, pluie) par saison. */
const WEATHER_TARGET: Record<string, readonly [number, number, number]> = {
  printemps: [45, 25, 30],
  été: [60, 22, 18],
  automne: [35, 30, 35],
  hiver: [30, 45, 25],
};
export const MAX_STATE_BYTES = 48_000;
export const MAX_MEMORIES_BYTES = 1536;
export const MAX_GROWTH_43_84 = 4096;

const pct = (n: number, d: number): number => (d === 0 ? 0 : Math.round((1000 * n) / d) / 10);
const seasonOf = (day: number): (typeof SEASONS)[number] => SEASONS[Math.floor((day - 1) / 21) % 4] ?? 'printemps';
const daysIn = (run: LongRun, from: number, to: number): DayRecord[] => run.days.filter((d) => d.day >= from && d.day <= to);

// ---------------------------------------------------------------------------
// Invariants d'une partie

export function invariantsOf(run: LongRun): Threshold[] {
  const out: Threshold[] = [];
  const last = run.days.at(-1)?.day ?? 0;
  out.push({
    id: 'I-01',
    label: `jour ${String(run.lastDay)} atteint, aucune journée bloquée, étapes franchies par « Rester »`,
    value: `jour ${String(run.day)}${run.stalled === null ? '' : `, bloqué: ${run.stalled}`}; étapes ${run.stagesPassed.join(', ') || 'aucune'}`,
    threshold: `jour ${String(run.lastDay)}, 0 blocage, demo et summer_end`,
    held: run.reachedEnd && run.stalled === null && run.stagesPassed.includes('demo') && run.stagesPassed.includes('summer_end') && last === run.lastDay,
  });
  out.push({
    id: 'I-02',
    label: 'empreinte identique après chaque reprise',
    value: run.resumeMismatches.length === 0 ? '0 écart' : `écarts aux aubes ${run.resumeMismatches.join(', ')}`,
    threshold: '0',
    held: run.resumeMismatches.length === 0,
  });
  let rain = 0;
  let noSun = 0;
  let maxRain = 0;
  let maxNoSun = 0;
  let mistInRain = 0;
  for (const d of run.days) {
    rain = d.weather === 'rain' ? rain + 1 : 0;
    noSun = d.weather === 'sunny' ? 0 : noSun + 1;
    maxRain = Math.max(maxRain, rain);
    maxNoSun = Math.max(maxNoSun, noSun);
    if (d.weather === 'rain' && d.mist) mistInRain++;
  }
  const d16 = run.days.find((d) => d.day === 16)?.weather;
  out.push({
    id: 'I-03',
    label: 'pluie au plus 3 jours d’affilée, jamais 7 jours sans soleil, jour 16 au soleil, jamais de brume sous la pluie',
    value: `pluie ${String(maxRain)} j, sans soleil ${String(maxNoSun)} j, jour 16 ${d16 ?? '?'}, brume sous la pluie ${String(mistInRain)}`,
    threshold: '3, 6, sunny, 0',
    held: maxRain <= 3 && maxNoSun <= 6 && d16 === 'sunny' && mistInRain === 0,
  });
  const orderProblems = run.drawn.flatMap((o) => o.problems.map((p) => `commande ${String(o.number)}: ${p}`));
  out.push({
    id: 'I-04',
    label: 'commandes: jamais identiques à la précédente, 3 lignes au moins, 2 par famille au plus, aucun produit de base partagé, rien hors saison ni jamais obtenu',
    value: orderProblems.length === 0 ? `${String(run.drawn.length)} commandes tirées, 0 problème` : orderProblems.slice(0, 6).join('; '),
    threshold: '0 problème',
    held: orderProblems.length === 0 && run.drawn.length > 0,
  });
  out.push({
    id: 'I-05',
    label: 'jamais la même envie deux fois en 7 jours pour un joueur; envie à deux, la même chez les deux, tous les trois jours dès le jour 16',
    value: run.envieProblems.length === 0 ? '0 problème' : run.envieProblems.slice(0, 6).join('; '),
    threshold: '0 problème',
    held: run.envieProblems.length === 0,
  });
  const maxBytes = Math.max(...run.days.map((d) => d.bytes));
  const maxMem = Math.max(...run.days.map((d) => d.memoriesBytes));
  const b43 = run.days.find((d) => d.day === 43)?.bytes ?? 0;
  const b84 = run.days.find((d) => d.day === run.lastDay)?.bytes ?? 0;
  const growth = b84 - b43;
  out.push({
    id: 'I-06',
    label: `souvenirs sous ${String(MAX_MEMORIES_BYTES)} octets, état sous ${String(MAX_STATE_BYTES)} octets à chaque aube, au plus ${String(MAX_GROWTH_43_84)} octets de plus au jour ${String(run.lastDay)} qu’au jour 43`,
    value: `souvenirs ${String(maxMem)}, état ${String(maxBytes)} au plus, ${growth >= 0 ? '+' : ''}${String(growth)} du jour 43 au jour ${String(run.lastDay)}${growth > MAX_GROWTH_43_84 || maxBytes >= MAX_STATE_BYTES ? ` (grossit: ${growingKeys(run, 43, run.lastDay, 4).join(', ')})` : ''}`,
    threshold: `< ${String(MAX_MEMORIES_BYTES)}, < ${String(MAX_STATE_BYTES)}, <= ${String(MAX_GROWTH_43_84)}`,
    held: maxMem < MAX_MEMORIES_BYTES && maxBytes < MAX_STATE_BYTES && growth <= MAX_GROWTH_43_84,
  });
  out.push({
    id: 'I-08',
    label: 'aucun texte affiché ne contient `{` (variables remplies)',
    value: run.unfilled.length === 0 ? '0 texte' : run.unfilled.slice(0, 3).join(' | '),
    threshold: '0',
    held: run.unfilled.length === 0,
  });
  return out;
}

/** Clés de premier niveau qui grossissent le plus entre deux aubes (I-06). */
export function growingKeys(run: LongRun, from: number, to: number, count: number): string[] {
  const a = run.days.find((d) => d.day === from)?.keys ?? {};
  const b = run.days.find((d) => d.day === to)?.keys ?? {};
  return Object.keys(b)
    .map((k) => [k, (b[k] ?? 0) - (a[k] ?? 0)] as const)
    .filter(([, n]) => n > 0)
    .sort((x, y) => y[1] - x[1])
    .slice(0, count)
    .map(([k, n]) => `${k} +${String(n)}`);
}

// ---------------------------------------------------------------------------
// Mesures d'une partie (objectifs)

export interface RunMeasures {
  name: string;
  /** O-01: part des journées neuves par joueur, et semaines sous 3 journées neuves. */
  freshDays: Record<string, Record<CharacterId, number>>;
  poorWeeks: Record<string, string[]>;
  /** O-02: redites par habitant (part des répliques quotidiennes dites). */
  repeats: Record<string, Record<string, { said: number; repeated: number; percent: number }>>;
  /** O-03: envies jamais reçues par saison; envies possibles au plus bas. */
  freshEnvies: Record<string, number>;
  minPossibleEnvies: number;
  /** O-04: commandes générées complètes. */
  ordersComplete: { complete: number; total: number };
  /** O-05: arbres adultes le jour 42, au plus bas dès le jour 16. */
  treesDay42: number;
  minTreesFrom16: number;
  daysWithoutTreeFrom16: number;
  /** O-06, O-07: écarts entre passages d'un même moment, moments vus par saison. */
  momentGaps: Record<string, number[]>;
  minGapAfter24: number | null;
  momentsSeenBySeason: Record<string, string[]>;
  /** O-08: part des soins dans le temps dehors. */
  carePercent: Record<CharacterId, number>;
  /** O-09: fréquences de la météo par saison (soleil, nuages, pluie) à partir du jour 16. */
  weatherBySeason: Record<string, { days: number; sunny: number; cloudy: number; rain: number; mist: number }>;
  /** L-07: cueillette par saison. */
  pickedBySeason: Record<string, Record<string, number>>;
  /** L-05: commandes tirées (lignes, budget, reprises). */
  orders: { number: number; train: number; lines: number; budget: number; repeated: number; families: number; amount: number | null; complete: boolean | null }[];
  secondsPerDay: number;
  cpuSecondsPerDay: number | null;
}

function freshShare(run: LongRun, from: number, to: number): Record<CharacterId, number> {
  const days = daysIn(run, from, to);
  return { p1: pct(days.filter((d) => d.firsts.p1.length > 0).length, days.length), p2: pct(days.filter((d) => d.firsts.p2.length > 0).length, days.length) };
}

function repeatsOf(run: LongRun, from: number, to: number): Record<string, { said: number; repeated: number; percent: number }> {
  const out: Record<string, { said: number; repeated: number; percent: number }> = {};
  for (const id of PLAYERS) {
    const last = new Map<string, number>();
    for (const [day, villager, line] of run.dailyLines[id]) {
      const before = last.get(line);
      last.set(line, day);
      if (day < from || day > to) continue;
      const v = (out[villager] ??= { said: 0, repeated: 0, percent: 0 });
      v.said++;
      if (before !== undefined && day - before < 28) v.repeated++;
    }
  }
  for (const v of Object.values(out)) v.percent = pct(v.repeated, v.said);
  return out;
}

export function measuresOf(run: LongRun): RunMeasures {
  const poorWeeks: Record<string, string[]> = { '16-43': [], '16-84': [] };
  for (let start = 16; start <= run.lastDay; start += 7) {
    const endDay = Math.min(start + 6, run.lastDay);
    const days = daysIn(run, start, endDay);
    for (const id of PLAYERS) {
      const n = days.filter((d) => d.firsts[id].length > 0).length;
      if (n < Math.min(3, days.length)) {
        const label = `${id} jours ${String(start)}-${String(endDay)}: ${String(n)}`;
        if (endDay <= 43) poorWeeks['16-43']?.push(label);
        poorWeeks['16-84']?.push(label);
      }
    }
  }
  const freshEnvies: Record<string, number> = {};
  const pickedBySeason: Record<string, Record<string, number>> = {};
  const weatherBySeason: RunMeasures['weatherBySeason'] = {};
  for (const s of SEASONS) {
    const days = run.days.filter((d) => d.day >= 16 && seasonOf(d.day) === s);
    if (days.length === 0) continue;
    const envies = days.flatMap((d) => PLAYERS.map((id) => d.envies[id])).filter((e) => e !== null);
    freshEnvies[s] = pct(envies.filter((e) => e.fresh).length, envies.length);
    const picked: Record<string, number> = {};
    for (const d of days) for (const [item, n] of Object.entries(d.picked)) picked[item] = (picked[item] ?? 0) + n;
    pickedBySeason[s] = picked;
    weatherBySeason[s] = {
      days: days.length,
      sunny: pct(days.filter((d) => d.weather === 'sunny').length, days.length),
      cloudy: pct(days.filter((d) => d.weather === 'cloudy').length, days.length),
      rain: pct(days.filter((d) => d.weather === 'rain').length, days.length),
      mist: pct(days.filter((d) => d.mist).length, days.length),
    };
  }
  const from16 = run.days.filter((d) => d.day >= 16);
  const generated = run.paid.filter((o) => o.day >= 22);
  const momentGaps: Record<string, number[]> = {};
  const seenBySeason: Record<string, Set<string>> = {};
  let minGapAfter24: number | null = null;
  const lastPass = new Map<string, number>();
  for (const p of run.momentPasses) {
    const before = p.origin === 'ambient' ? lastPass.get(p.id) : undefined;
    // M-22 vise les moments d'ambiance d'après la démo (les moments de quête reviennent chaque jour tant qu'on ne les a pas vus).
    if (before !== undefined && p.day >= 16) {
      const gap = p.day - before;
      (momentGaps[seasonOf(p.day)] ??= []).push(gap);
      if (p.day > 24) minGapAfter24 = minGapAfter24 === null ? gap : Math.min(minGapAfter24, gap);
    }
    if (p.origin === 'ambient') lastPass.set(p.id, p.day);
    if (p.seen) (seenBySeason[seasonOf(p.day)] ??= new Set()).add(p.id);
  }
  const care = (id: CharacterId): number => {
    const outside = run.days.filter((d) => d.day >= 16).reduce((n, d) => n + d.care[id].outside, 0);
    const busy = run.days.filter((d) => d.day >= 16).reduce((n, d) => n + d.care[id].water + d.care[id].feed, 0);
    return pct(busy, outside);
  };
  return {
    name: run.name,
    freshDays: { '16-43': freshShare(run, 16, 43), '16-84': freshShare(run, 16, run.lastDay) },
    poorWeeks,
    repeats: { '16-43': repeatsOf(run, 16, 43), '16-84': repeatsOf(run, 16, run.lastDay) },
    freshEnvies,
    minPossibleEnvies: Math.min(...from16.flatMap((d) => PLAYERS.map((id) => d.possibleEnvies[id]))),
    ordersComplete: { complete: generated.filter((o) => o.complete).length, total: generated.length },
    treesDay42: run.days.find((d) => d.day === 42)?.trees.adult ?? 0,
    minTreesFrom16: Math.min(...from16.map((d) => d.trees.adult)),
    daysWithoutTreeFrom16: from16.filter((d) => d.trees.adult === 0).length,
    momentGaps,
    minGapAfter24,
    momentsSeenBySeason: Object.fromEntries(Object.entries(seenBySeason).map(([k, v]) => [k, [...v].sort()])),
    carePercent: { p1: care('p1'), p2: care('p2') },
    weatherBySeason,
    pickedBySeason,
    orders: run.drawn.map((o) => {
      const p = run.paid.find((x) => x.number === o.number);
      return {
        number: o.number,
        train: o.train,
        lines: o.lines.length,
        budget: Math.round(o.budget * 100) / 100,
        repeated: o.repeated,
        families: new Set(o.lines.map((l) => l.family)).size,
        amount: p?.amount ?? null,
        complete: p?.complete ?? null,
      };
    }),
    secondsPerDay: Math.round(run.realMs / Math.max(1, run.days.length)) / 1000,
    cpuSecondsPerDay: run.cpuMs === undefined ? null : Math.round(run.cpuMs / Math.max(1, run.days.length)) / 1000,
  };
}

const median = (xs: readonly number[]): number | null => {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? (s[mid] ?? 0) : ((s[mid - 1] ?? 0) + (s[mid] ?? 0)) / 2;
};

// ---------------------------------------------------------------------------
// Objectifs sur l'ensemble des parties

export function objectivesOf(runs: readonly { run: LongRun; m: RunMeasures }[], suiteSeconds: number | null): Threshold[] {
  const medians = runs.filter((r) => r.run.profile === 'median' && r.run.slowFrom === null);
  const out: Threshold[] = [];
  const minFresh = (period: string, list: typeof runs): number => Math.min(...list.flatMap((r) => PLAYERS.map((id) => r.m.freshDays[period]?.[id] ?? 0)));
  for (const period of ['16-43', '16-84'] as const) {
    const low = minFresh(period, runs);
    const poor = runs.flatMap((r) => (r.m.poorWeeks[period] ?? []).map((w) => `${r.run.name} ${w}`));
    out.push({
      id: 'O-01',
      label: `journées neuves (R1), jours ${period}`,
      value: `${String(low)} % au plus bas (joueur et partie); semaines sous 3: ${poor.length === 0 ? 'aucune' : `${String(poor.length)} (${poor.slice(0, 4).join('; ')}${poor.length > 4 ? '...' : ''})`}`,
      threshold: '>= 95 % par joueur; >= 3 par semaine',
      held: low >= 95 && poor.length === 0,
    });
  }
  for (const period of ['16-43', '16-84'] as const)
    for (const profile of ['median', 'assidu'] as const) {
      const list = runs.filter((r) => r.run.profile === profile);
      if (list.length === 0) continue;
      let worst = { villager: '', percent: 0, run: '' };
      for (const r of list)
        for (const [villager, v] of Object.entries(r.m.repeats[period] ?? {})) if (v.percent >= worst.percent) worst = { villager, percent: v.percent, run: r.run.name };
      out.push({
        id: 'O-02',
        label: `redites des répliques (R2), profil ${profile}, jours ${period}`,
        value: `${String(worst.percent)} % au plus (${worst.villager || '-'}, ${worst.run})`,
        threshold: '< 2 % par habitant',
        held: worst.percent < 2,
      });
    }
  const freshBySeason = new Map<string, number>();
  for (const r of runs) for (const [s, v] of Object.entries(r.m.freshEnvies)) freshBySeason.set(s, Math.min(freshBySeason.get(s) ?? 100, v));
  const minPossible = Math.min(...runs.map((r) => r.m.minPossibleEnvies));
  out.push({
    id: 'O-03',
    label: 'envies (R6): jamais reçues par saison; possibles chaque matin',
    value: `${[...freshBySeason].map(([s, v]) => `${s} ${String(v)} %`).join(', ')}; ${String(minPossible)} possibles au plus bas`,
    threshold: '>= 30 % par saison; >= 12',
    held: [...freshBySeason.values()].every((v) => v >= 30) && minPossible >= 12,
  });
  const complete = medians.reduce((n, r) => n + r.m.ordersComplete.complete, 0);
  const total = medians.reduce((n, r) => n + r.m.ordersComplete.total, 0);
  out.push({
    id: 'O-04',
    label: 'commandes complètes, profil médian, samedis 22 à 84',
    value: `${String(complete)}/${String(total)} (${String(pct(complete, total))} %)`,
    threshold: '>= 80 %',
    held: pct(complete, total) >= 80,
  });
  const t42 = Math.min(...medians.map((r) => r.m.treesDay42));
  const t16 = Math.min(...medians.map((r) => r.m.minTreesFrom16));
  out.push({
    id: 'O-05',
    label: 'arbres abattables le jour 42; jamais 0 dès le jour 16 (profil médian)',
    value: `${String(t42)} au jour 42 au plus bas; ${String(t16)} au plus bas dès le jour 16`,
    threshold: '>= 6; > 0',
    held: t42 >= 6 && t16 > 0,
  });
  const gaps: Record<string, number[]> = {};
  for (const r of runs) for (const [s, list] of Object.entries(r.m.momentGaps)) (gaps[s] ??= []).push(...list);
  const minAfter24 = runs.map((r) => r.m.minGapAfter24).filter((x) => x !== null);
  const spring = median(gaps.printemps ?? []);
  const summer = median(gaps.été ?? []);
  const low24 = minAfter24.length === 0 ? null : Math.min(...minAfter24);
  out.push({
    id: 'O-06',
    label: 'moments d’ambiance (M-22), dès le jour 16: écart médian entre deux passages d’un même moment; écart au plus bas après le jour 24',
    value: `${Object.entries(gaps)
      .map(([s, l]) => `${s} ${String(median(l))} j (${String(l.length)} écarts)`)
      .join(', ')}; ${low24 === null ? 'aucun' : `${String(low24)} j`} au plus bas après le jour 24`,
    threshold: '>= 19 j au printemps et en été; >= 10 j après le jour 24',
    held: (spring === null || spring >= 19) && (summer === null || summer >= 19) && (low24 === null || low24 >= 10),
  });
  let fewest = { n: 99, where: '' };
  for (const r of runs)
    for (const s of SEASONS) {
      const days = r.run.days.filter((d) => seasonOf(d.day) === s).length;
      if (days < 7) continue;
      const n = r.m.momentsSeenBySeason[s]?.length ?? 0;
      if (n < fewest.n) fewest = { n, where: `${r.run.name}, ${s}` };
    }
  out.push({
    id: 'O-07',
    label: 'moments différents vus ensemble par saison (saisons d’au moins 7 jours joués)',
    value: `${String(fewest.n)} au plus bas (${fewest.where})`,
    threshold: '>= 2',
    held: fewest.n >= 2,
  });
  const care = Math.max(...runs.flatMap((r) => PLAYERS.map((id) => r.m.carePercent[id])));
  out.push({
    id: 'O-08',
    label: 'soins quotidiens (R12): arroser, remplir l’arrosoir et nourrir les poules, part du temps dehors dès le jour 16',
    value: `${String(care)} % au plus`,
    threshold: '<= 30 %',
    held: care <= 30,
  });
  const pooled: Record<string, { days: number; sunny: number; cloudy: number; rain: number }> = {};
  for (const r of medians)
    for (const [s, w] of Object.entries(r.m.weatherBySeason)) {
      const p = (pooled[s] ??= { days: 0, sunny: 0, cloudy: 0, rain: 0 });
      p.days += w.days;
      p.sunny += (w.sunny * w.days) / 100;
      p.cloudy += (w.cloudy * w.days) / 100;
      p.rain += (w.rain * w.days) / 100;
    }
  let worstGap = 0;
  const parts: string[] = [];
  for (const [s, p] of Object.entries(pooled)) {
    const target = WEATHER_TARGET[s];
    if (target === undefined || p.days < 14) continue;
    const got = [pct(p.sunny, p.days), pct(p.cloudy, p.days), pct(p.rain, p.days)] as const;
    worstGap = Math.max(worstGap, ...got.map((g, i) => Math.abs(g - (target[i] ?? 0))));
    parts.push(`${s} ${got.map(String).join('/')} (visé ${target.join('/')}, ${String(Math.round(p.days))} j)`);
  }
  out.push({
    id: 'O-09',
    label: 'météo par saison (soleil/nuages/pluie, 4 graines médianes: indicatif)',
    value: `${parts.join('; ')}; écart ${String(Math.round(worstGap * 10) / 10)} points au plus`,
    threshold: '<= 8 points',
    held: worstGap <= 8,
  });
  out.push({
    id: 'O-10',
    label: 'durée de la suite longue vie',
    value: `${suiteSeconds === null ? 'suite non mesurée' : `suite ${String(Math.round(suiteSeconds))} s (${String(Math.round((suiteSeconds / 60) * 10) / 10)} min)`}; temps réel (processeur) par partie: ${runs.map((r) => `${r.run.name} ${String(Math.round(r.run.realMs / 1000))} s (${r.run.cpuMs === undefined ? '?' : String(Math.round(r.run.cpuMs / 1000))} s)`).join(', ')}`,
    threshold: '< 600 s',
    held: suiteSeconds !== null && suiteSeconds < 600,
  });
  return out;
}

// ---------------------------------------------------------------------------
// Rapport lisible

function table(rows: readonly Threshold[]): string {
  const esc = (s: string): string => s.replaceAll('|', '/');
  return [
    '| # | Seuil | Valeur | Attendu | Résultat |',
    '|---|---|---|---|---|',
    ...rows.map((r) => `| ${r.id} | ${esc(r.label)} | ${esc(r.value)} | ${esc(r.threshold)} | ${r.held ? 'tenu' : 'non tenu'} |`),
  ].join('\n');
}

export function reportMarkdown(runs: readonly { run: LongRun; m: RunMeasures }[], suiteSeconds: number | null, i07: Threshold | null): string {
  const lines: string[] = ['# Robot longue vie, rapport (tour 8, section 6.4)', ''];
  lines.push(`Parties: ${runs.map((r) => `${r.run.name} (graine ${String(r.run.seed)}, ${r.run.profile}${r.run.slowFrom === null ? '' : `, 0,8 s dès le jour ${String(r.run.slowFrom)}`})`).join('; ')}.`, '');
  lines.push('## Invariants (le test échoue)', '');
  for (const r of runs) {
    lines.push(`### ${r.run.name}`, '', table(invariantsOf(r.run)), '');
  }
  if (i07 !== null) lines.push('### I-07', '', table([i07]), '');
  lines.push('## Objectifs (mesurés, ne font pas échouer au tour 8)', '', table(objectivesOf(runs, suiteSeconds)), '');
  lines.push('## Taille de l’état (L-03)', '');
  lines.push('| Partie | Jour 15 | Jour 43 | Jour 84 | +43 à 84 | Max | Ce qui grossit du jour 15 au jour 43 | Ce qui grossit du jour 43 au jour 84 |', '|---|---|---|---|---|---|---|---|');
  for (const { run } of runs) {
    const at = (d: number): number => run.days.find((x) => x.day === d)?.bytes ?? 0;
    lines.push(
      `| ${run.name} | ${String(at(15))} | ${String(at(43))} | ${String(at(run.lastDay))} | ${String(at(run.lastDay) - at(43))} | ${String(Math.max(...run.days.map((d) => d.bytes)))} | ${growingKeys(run, 15, 43, 5).join(', ')} | ${growingKeys(run, 43, run.lastDay, 5).join(', ')} |`,
    );
  }
  lines.push('', '| Partie | Jour | heard (entrées, octets) | letters (nombre, octets) | dialoguesDone (nombre, octets) | envieHistory (nombre, octets) | moments.history | souvenirs |', '|---|---|---|---|---|---|---|---|');
  for (const { run } of runs)
    for (const day of [15, 43, run.lastDay]) {
      const d = run.days.find((x) => x.day === day);
      if (d === undefined) continue;
      const v = (k: string): string => String(d.detail[k] ?? 0);
      lines.push(
        `| ${run.name} | ${String(day)} | ${v('heard.entries')}, ${v('heard.bytes')} | ${v('letters.count')}, ${v('letters.bytes')} | ${v('dialoguesDone.count')}, ${v('dialoguesDone.bytes')} | ${v('envieHistory.count')}, ${v('envieHistory.bytes')} | ${v('moments.history.count')} | ${String(d.memoriesBytes)} |`,
      );
    }
  lines.push('', '## Mesures par partie', '');
  lines.push('| Partie | s par journée (processeur) | Journées neuves 16-43 (p1, p2) | 16-84 | Commandes complètes 22-84 | Arbres jour 42 / min dès 16 | Envies neuves par saison | Soins (p1, p2) | Moments vus par saison |', '|---|---|---|---|---|---|---|---|---|');
  for (const { run, m } of runs) {
    const f = (p: string): string => `${String(m.freshDays[p]?.p1 ?? 0)} %, ${String(m.freshDays[p]?.p2 ?? 0)} %`;
    lines.push(
      `| ${run.name} | ${String(m.secondsPerDay)} (${m.cpuSecondsPerDay === null ? '?' : String(m.cpuSecondsPerDay)}) | ${f('16-43')} | ${f('16-84')} | ${String(m.ordersComplete.complete)}/${String(m.ordersComplete.total)} | ${String(m.treesDay42)} / ${String(m.minTreesFrom16)} | ${Object.entries(m.freshEnvies)
        .map(([s, v]) => `${s} ${String(v)} %`)
        .join(', ')} | ${String(m.carePercent.p1)} %, ${String(m.carePercent.p2)} % | ${Object.entries(m.momentsSeenBySeason)
        .map(([s, l]) => `${s}: ${l.join(' ')}`)
        .join('; ')} |`,
    );
  }
  lines.push('', '## Commandes tirées (L-05), première partie', '');
  const firstRun = runs[0];
  if (firstRun !== undefined) {
    lines.push('| N | Samedi | Lignes | Familles | Reprises | Budget | Payé | Complète |', '|---|---|---|---|---|---|---|---|');
    for (const o of firstRun.m.orders)
      lines.push(`| ${String(o.number)} | ${String(o.train)} | ${String(o.lines)} | ${String(o.families)} | ${String(o.repeated)} | ${String(o.budget)} | ${o.amount === null ? '-' : String(o.amount)} | ${o.complete === null ? '-' : o.complete ? 'oui' : 'non'} |`);
    lines.push('', '## Cueillette par saison (L-07), première partie', '');
    for (const [s, picked] of Object.entries(firstRun.m.pickedBySeason))
      lines.push(`- ${s}: ${Object.entries(picked).map(([k, n]) => `${k} ${String(n)}`).join(', ') || 'rien'}`);
  }
  lines.push('');
  return lines.join('\n');
}
