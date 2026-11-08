/**
 * Lecteurs de l'interface (`InterfaceSources`) et table des intentions (`IntentFor`), tirés des
 * chantiers service (a), clientèle (b) et aménagement (c). Fonctions pures du monde, sauf les
 * répliques et les scènes: elles naissent d'événements (`clientele-say`, `clientele-clue`) et
 * restent affichées jusqu'à ce que le joueur passe à la suite.
 *
 * Votes: « Commencer la journée » (écran du matin) retourne la pancarte (vote `open`), l'autre
 * répond par la proposition « On ouvre ? »; « Bonne nuit » au bilan (ou sur la tablette) vote
 * `next-day`; le lundi, jour fermé, le bilan du jour de repos mène au lendemain de la même façon.
 * Le dernier lundi (jour 15), l'écran de nuit pose « Partir pour Mérelles ? ».
 */
import { catalogView } from '../amenagement';
import { clockMinutes, suggestedOrder } from '../clientele';
import type { ClienteleContent } from '../clientele/donnees';
import { availableCents, bigPurchaseCents, linePrice, offerOf } from '../clientele/economie';
import type { ClienteleState } from '../clientele/etat';
import type { Content } from '../donnees/charger';
import type { PlayerIndex, World } from '../etat/monde';
import type { InterfaceSources, IntentFor } from '../interface/adaptateur';
import { T } from '../interface/textes';
import type {
  CatalogueItemView,
  ClockView,
  DayPhase,
  DialogueView,
  EveningView,
  EventSceneView,
  GaugeView,
  OrdersView,
  ProposalView,
  RecipeView,
  SlateView,
  TicketView,
  WeatherKind,
  WeatherView,
} from '../interface/modele';
import { standingPose, type CustomerPose } from '../clientele/reseau';
import type { GameView } from '../reseau/vue';
import { articleLabel, QUALITY_LABEL, serviceGauge } from '../service';
import { recipeOf } from '../service/regles';
import type { Intent } from '../simulation/entrees';
import type { GameEvent } from '../simulation/evenements';

const DT = 1 / 60;

/** Geste de scène de chaque genre d'événement (`clientele-scene`). */
const SCENE_ACTION: Readonly<
  Record<string, 'driver' | 'repair' | 'signal' | 'advice' | 'surprise'>
> = {
  client_presse: 'driver',
  panne: 'repair',
  enfant_perdu: 'signal',
  critique_deguisee: 'advice',
  mariage: 'surprise',
};

const WEEKDAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

const WEATHER_KIND: Readonly<Record<string, WeatherKind>> = {
  soleil: 'sun',
  chaleur: 'sun',
  couvert: 'clouds',
  froid: 'clouds',
  pluie: 'rain',
  neige: 'rain',
};

const FAMILY: Readonly<Record<string, string>> = {
  black_coffee: 'Cafés',
  milk_coffee: 'Cafés au lait',
  tea: 'Thés et infusions',
  chocolate: 'Chocolat',
  cold_drink: 'Boissons fraîches',
  pastry_bread: 'Viennoiseries et tartines',
  cake: 'Pâtisseries',
};

const STYLE: Readonly<Record<string, string>> = {
  campagne: 'Campagne',
  jardin: 'Jardin',
  nordique: 'Nordique',
  retro: 'Rétro',
  bistrot: 'Bistrot',
  atelier: 'Atelier',
  neutre: 'Simple',
};

const CATEGORY: Readonly<Record<string, string>> = {
  counter_object: 'Sur le comptoir',
  floor: 'Sols',
  frame: 'Cadres',
  light: 'Lumières',
  paint: 'Peintures',
  plant: 'Plantes',
  rug: 'Tapis',
  seat: 'Assises',
  shelf: 'Étagères',
  sign: 'Enseignes',
  table: 'Tables',
  terrace: 'Terrasse',
  wallpaper: 'Papiers peints',
  extension: 'Agrandir le café',
};

function weatherOf(cc: ClienteleContent, id: string): WeatherView {
  const label = cc.rules.weather.names[id] ?? id;
  return {
    kind: WEATHER_KIND[id] ?? 'clouds',
    label: label.charAt(0).toUpperCase() + label.slice(1),
  };
}

function weekdayOf(day: number): number {
  return (((day - 1) % 7) + 7) % 7;
}

function planOf(
  cc: ClienteleContent,
  day: number,
): ClienteleContent['days']['days'][number] | undefined {
  return cc.days.days.find((d) => d.day === day);
}

function endOfDemoDay(cc: ClienteleContent, s: ClienteleState): boolean {
  return s.phase === 'monday' && planOf(cc, s.day)?.endOfDemo === true && !s.demoEnded;
}

function phaseOf(cc: ClienteleContent, s: ClienteleState): DayPhase {
  switch (s.phase) {
    case 'monday':
      if (s.day === 1 && s.houseName === null) return 'first-time';
      return endOfDemoDay(cc, s) ? 'night' : 'evening';
    case 'prep':
      return Object.keys(s.votes).length === 0 ? 'morning' : 'preparation';
    case 'service':
      return 'service';
    case 'closing':
      return 'soft-closing';
    case 'evening':
      return 'evening';
    case 'end':
      return 'demo-end';
  }
}

function customerGroup(
  world: World,
  customer: string | null,
): ClienteleState['groups'][number] | undefined {
  if (customer === null || !/^g\d+$/.test(customer)) return undefined;
  const id = Number(customer.slice(1));
  return world.clientele.groups.find((g) => g.id === id);
}

function ticketView(
  content: Content,
  world: World,
  t: World['service']['tickets'][number],
): TicketView {
  const g = customerGroup(world, t.customer);
  const destination =
    g === undefined
      ? 'Au passe'
      : g.takeAway
        ? 'À emporter'
        : g.table !== null
          ? `Table ${g.table.replace(/^\D+/, '')}`
          : g.place === 'counter' || g.place === 'standing'
            ? 'Comptoir'
            : 'Au passe';
  return {
    id: t.id,
    destination,
    waitMinutes: Math.floor(((world.tick - t.createdTick) * DT) / 60),
    lines: t.articles.map((a) => {
      const item = world.service.items.find((i) => i.object === a.object);
      const steps = recipeOf(content, a.recipe)?.steps.length ?? 1;
      return {
        label: articleLabel(content, a.recipe, a.options),
        done: item !== undefined && item.step >= steps,
      };
    }),
    takenBy: t.taker,
  };
}

function gaugeView(content: Content, world: World, player: PlayerIndex): GaugeView | null {
  const g = serviceGauge(content, world, player, DT);
  if (g === null) return null;
  switch (g.kind) {
    case 'hold':
      return {
        kind: 'hold',
        label: 'Maintiens Agir',
        value: g.progress,
        zone: null,
        word: null,
        prompt: 'Garde la touche enfoncée',
        simplified: world.service.assist[player],
      };
    case 'steam': {
      const lo = 20;
      const span = Math.max(1, g.cutC - lo);
      const t = Math.round(g.temperatureC);
      const inPerfect = t >= g.perfectC[0] && t <= g.perfectC[1];
      return {
        kind: 'gauge',
        label: `Mousser le lait · ${String(t)} °C`,
        value: Math.max(0, Math.min(1, (g.temperatureC - lo) / span)),
        zone: [(g.perfectC[0] - lo) / span, (g.perfectC[1] - lo) / span],
        word: inPerfect
          ? 'Juste'
          : t > g.perfectC[1]
            ? 'Un peu chaud'
            : t >= g.goodC[0]
              ? 'Presque…'
              : null,
        prompt: `Relâche dans la zone : ${String(g.perfectC[0])} à ${String(g.perfectC[1])} °C`,
        simplified: world.service.assist[player],
      };
    }
    case 'extraction': {
      const span = Math.max(1, g.autoStopSeconds);
      const ready = g.seconds >= g.readySeconds;
      return {
        kind: 'window',
        label: `Extraction · ${String(Math.floor(g.seconds))} s`,
        value: Math.min(1, g.seconds / span),
        zone: [g.readySeconds / span, (g.readySeconds + g.perfectSeconds) / span],
        word: ready
          ? g.seconds <= g.readySeconds + g.perfectSeconds
            ? 'Juste'
            : 'Encore bon'
          : null,
        prompt: ready ? 'Agis sur le groupe pour arrêter' : 'Le café coule…',
        simplified: world.service.assist[player],
      };
    }
    case 'cook': {
      const span = Math.max(1, g.readySeconds + g.goldenSeconds * 2);
      return {
        kind: 'window',
        label: `Crêpe · ${String(Math.floor(g.seconds))} s`,
        value: Math.min(1, g.seconds / span),
        zone: [g.readySeconds / span, (g.readySeconds + g.goldenSeconds) / span],
        word: g.seconds >= g.readySeconds ? 'Dorée' : null,
        prompt: 'Agis sur la crêpière quand elle est dorée',
        simplified: world.service.assist[player],
      };
    }
  }
}

function slateView(content: Content, world: World): SlateView {
  const cc = content.clientele;
  const s = world.clientele;
  const recipes: RecipeView[] = cc.recipeList.map((r) => {
    const known = s.known.includes(r.id);
    const stations = r.stations.every((x) => (s.stations[x] ?? 0) > 0);
    return {
      id: r.id,
      name: r.name,
      family: FAMILY[r.family] ?? r.family,
      suggestedCents: Math.round(r.basePrice * 100),
      attracts: '',
      unavailable: !known ? 'Pas encore apprise' : !stations ? 'Il manque le poste' : null,
    };
  });
  return {
    maxLines: cc.rules.slateLines,
    maxStars: 0,
    lines: s.slate.map(([id]) => ({
      recipe: id,
      priceCents: linePrice(cc, s, id),
      star: false,
      priceNote: '',
      soldOut: null,
      lockedBy: null,
    })),
    word: '',
    recipes,
    readOnly: s.phase === 'service' || s.phase === 'closing',
    proposedThisMorning: false,
    summary: null,
    partnerWriting: false,
  };
}

function ordersView(content: Content, world: World): OrdersView {
  const cc = content.clientele;
  const s = world.clientele;
  const usual = suggestedOrder(cc, s);
  return {
    suppliers: cc.supplies.suppliers.map((sup) => ({
      id: sup.id,
      name: sup.name,
      place: '',
      products: cc.supplies.ingredients
        .filter((i) => i.supplier === sup.id)
        .map((i) => ({
          id: i.id,
          name: i.name,
          stock: `${String(Math.round(s.stock[i.id] ?? 0))} ${i.unit}`,
          usual: usual[i.id] ?? 0,
          quantity: s.order?.[i.id] ?? usual[i.id] ?? 0,
          unit: 'carton',
          unitCents: Math.round(i.cartonUnits * i.unitCost * 100),
          lockedBy: null,
        })),
    })),
    sent: s.order !== null,
    emergencyOpen: s.phase === 'service',
  };
}

function catalogueItems(content: Content, world: World): CatalogueItemView[] {
  const cc = content.clientele;
  const s = world.clientele;
  const threshold = bigPurchaseCents(cc, s);
  const available = availableCents(cc, s);
  const out: CatalogueItemView[] = [];
  for (const p of cc.purchases.values()) {
    const offer = offerOf(cc, s, p.id);
    const bought = s.purchases.some(([id]) => id === p.id);
    const price = Math.round(p.price * 100);
    out.push({
      id: p.id,
      name: p.name,
      family: 'Équipement',
      style: STYLE.neutre ?? 'Simple',
      brings: '',
      needs: null,
      priceCents: price,
      state: bought
        ? { kind: 'bought' }
        : typeof offer === 'string'
          ? { kind: 'locked', reason: offer }
          : offer.price > available
            ? { kind: 'missing', missingCents: offer.price - available }
            : offer.price >= threshold
              ? { kind: 'propose' }
              : { kind: 'buy' },
      deal: null,
    });
  }
  for (const e of catalogView(content, world)) {
    const price = Math.round((e.price ?? 0) * 100);
    out.push({
      id: e.id,
      name: e.label,
      family: CATEGORY[e.category] ?? e.category,
      style: STYLE[e.style] ?? e.style,
      brings: e.text,
      needs: null,
      priceCents: price,
      state:
        e.refusal !== null
          ? e.refusal.includes('caisse')
            ? { kind: 'missing', missingCents: Math.max(0, price - available) }
            : { kind: 'locked', reason: e.refusal }
          : price >= threshold
            ? { kind: 'propose' }
            : { kind: 'buy' },
      deal: e.shelf === 'brocante' ? '-30 % à la brocante' : null,
    });
  }
  return out;
}

function proposalsOf(content: Content, world: World): ProposalView[] {
  const s = world.clientele;
  const cc = content.clientele;
  const out: ProposalView[] = [];
  for (const [topic, kind] of [
    ['open', 'open'],
    ['close', 'close-early'],
  ] as const) {
    const v = s.votes[topic];
    if (v === undefined) continue;
    for (const p of [0, 1] as const) {
      const other = p === 0 ? 1 : 0;
      if (v[p] === 1 && v[other] === 0)
        out.push({
          id: topic,
          from: p,
          kind,
          item: null,
          amountCents: null,
          remainingCents: null,
          benefit: null,
          when: null,
        });
    }
  }
  const available = availableCents(cc, s);
  for (const p of s.proposals) {
    const name = offerName(content, p.item);
    out.push({
      id: `achat:${String(p.by)}`,
      from: p.by,
      kind: 'purchase',
      item: name,
      amountCents: p.price,
      remainingCents: available,
      benefit: null,
      when: null,
    });
  }
  const a = world.arrangement.proposal;
  if (a !== null) {
    const price = Math.round(a.price * 100);
    out.push({
      id: 'amenagement',
      from: a.player,
      kind: 'purchase',
      item:
        content.arrangement.items.get(a.item)?.label ??
        content.arrangement.extensions.get(a.item)?.label ??
        a.item,
      amountCents: price,
      remainingCents: available - price,
      benefit: null,
      when: null,
    });
  }
  return out;
}

function offerName(content: Content, id: string): string {
  const cc = content.clientele;
  return (
    cc.purchases.get(id)?.name ?? cc.extensions.get(id)?.name ?? cc.catalogue.get(id)?.name ?? id
  );
}

function clockText(minutes: number): string {
  const m = Math.floor(minutes);
  return `${String(Math.floor(m / 60))} h ${String(m % 60).padStart(2, '0')}`;
}

/** Une ligne au singulier ou au pluriel (`{n}`). */
function counted(forms: readonly [string, string], n: number): string {
  return (n > 1 ? forms[1] : forms[0]).replace('{n}', String(n));
}

/**
 * Page « Ce qu'on retient » du bilan: les habitués servis aujourd'hui (heure, commande), puis ce
 * qui a plu aux clients ravis et ce qui a manqué (clients déçus, groupes pas entrés ou repartis),
 * les plus nombreux d'abord, quatre lignes au plus par bloc.
 */
export function eveningNotes(
  cc: ClienteleContent,
  s: ClienteleState,
): Pick<EveningView, 'regulars' | 'liked' | 'missed'> {
  const E = T.evening;
  const byRegular = new Map<string, [number, string[]][]>();
  for (const [id, minute, items] of s.today.visits) {
    const list = byRegular.get(id) ?? [];
    list.push([minute, items]);
    byRegular.set(id, list);
  }
  const regulars: string[] = [];
  for (const [id, list] of byRegular) {
    const name = cc.regularById.get(id)?.name ?? id;
    const [first, ...again] = list;
    if (first === undefined) continue;
    const items = first[1].map((x) => cc.recipes.get(x)?.name.toLowerCase() ?? x).join(', ');
    const vars = {
      name,
      time: clockText(first[0]),
      items: items === '' ? 'sa commande' : items,
      times: again.map(([m]) => clockText(m)).join(', '),
    };
    regulars.push(
      (again.length > 0 ? E.visitAgain : E.visit).replace(
        /\{(\w+)\}/g,
        (m, k: string) => (vars as Record<string, string>)[k] ?? m,
      ),
    );
  }
  const sorted = (counts: Readonly<Record<string, number>>): [string, number][] =>
    Object.entries(counts)
      .filter(([, n]) => n > 0)
      .sort((a, b) => b[1] - a[1]);
  const liked: string[] = [];
  for (const [key, n] of sorted(s.today.liked)) {
    const forms = E.likedLines[key];
    if (forms !== undefined && liked.length < 4) liked.push(counted(forms, n));
  }
  const missed: { text: string; link: string | null }[] = [];
  for (const [key, n] of sorted(s.today.missed)) {
    const forms = E.missedLines[key];
    if (forms !== undefined && missed.length < 4)
      missed.push({ text: counted(forms, n), link: key === 'noSeat' ? E.seatsLink : null });
  }
  return { regulars, liked, missed };
}

function eveningView(content: Content, world: World, player: PlayerIndex): EveningView | null {
  const s = world.clientele;
  const cc = content.clientele;
  const r = s.report;
  if (r === null || (s.phase !== 'evening' && s.phase !== 'monday')) return null;
  const other: PlayerIndex = player === 0 ? 1 : 0;
  const previous = s.history.filter(([day]) => day < r.day).at(-1);
  const announce = r.tomorrowAnnounce;
  const weather = weatherOf(cc, r.tomorrowWeather).label.toLowerCase();
  return {
    day: r.day,
    weekday: weekdayOf(r.day),
    firstEvening: s.history.length <= 1,
    guestbook: r.words.map((w) => ({
      text: w.text,
      signature: w.sign,
      regular: null,
      subject: '',
      tone: w.good ? 'liked' : 'missed',
    })),
    ...eveningNotes(cc, s),
    figures: {
      served: r.served,
      previousServed:
        previous === undefined ? null : { weekday: weekdayOf(previous[0]), served: previous[2] },
      revenueCents: r.revenue,
      tipsCents: r.tips,
      purchasesCents: r.purchases + r.materials,
      resultCents: r.result,
      cashCents: s.cash,
    },
    halfCups: Math.round(s.cups * 2),
    reputationHint: r.open
      ? `Satisfaction moyenne : ${String(Math.round(r.satisfaction))} sur 100.`
      : 'Jour de repos : le café est fermé.',
    tomorrow: {
      line: `Demain : ${weather}.`,
      event: announce,
      orderSent: s.order !== null,
      project: null,
      regular: null,
    },
    partner:
      s.votes['next-day']?.[other] === 1 ? { kind: 'good-night' } : { kind: 'reading', page: 1 },
  };
}

/** Une réplique ou une scène en cours chez ce joueur, née d'un événement. */
interface Spoken {
  readonly dialogue: DialogueView | null;
  readonly scene: EventSceneView | null;
}

export interface WiredInterface {
  readonly sources: InterfaceSources;
  readonly intents: IntentFor;
  /** À appeler pour chaque événement de la simulation (répliques, indices). */
  onEvent(event: GameEvent): void;
  /** Une réplique lue: la suivante, ou plus rien. */
  next(id: string): void;
  /**
   * G (faire signe): le geste de l'événement du jour (rallonge du chauffeur, réparation à deux,
   * surprise), sinon quelques mots au groupe de clients le plus proche.
   */
  wave(): Intent | null;
}

export function wireInterface(view: GameView): WiredInterface {
  const content = view.content;
  const cc = content.clientele;
  const queue: DialogueView[] = [];
  /** Genre d'événement des répliques à réponses (indices à choix). */
  const clueKinds = new Map<string, string>();
  let scene: EventSceneView | null = null;
  let counter = 0;
  const world = (): World => view.world();
  const local = view.local;
  const spoken = (): Spoken => ({ dialogue: queue[0] ?? null, scene });

  const vote = (
    topic: 'open' | 'close' | 'next-day' | 'merelles' | 'name',
    yes: boolean,
  ): Intent => ({
    type: 'clientele-vote',
    topic,
    yes,
  });
  const slateWith = (lines: [string, number][]): Intent => ({ type: 'clientele-slate', lines });
  const supply = (order: Readonly<Record<string, number>>): Intent => ({
    type: 'clientele-supply',
    cartons: Object.entries(order)
      .filter(([, n]) => n > 0)
      .map(([id, n]): [string, number] => [id, Math.min(20, Math.round(n))]),
  });
  const currentOrder = (): Record<string, number> => {
    const s = world().clientele;
    return { ...(s.order ?? suggestedOrder(cc, s)) };
  };
  const buy = (item: string): Intent => {
    if (
      cc.purchases.has(item) ||
      cc.extensions.has(item) ||
      (cc.catalogue.has(item) && !content.arrangement.items.has(item))
    )
      return { type: 'clientele-buy', item };
    const placement = content.arrangement.items.get(item)?.placement;
    const room = placement === 'wall_cover' || placement === 'floor_cover' ? 'salle' : null;
    return { type: 'amenagement-acheter', item, room };
  };

  const sources: InterfaceSources = {
    clock(w, c): ClockView | null {
      const s = w.clientele;
      if (s.day === 0) return null;
      const minutes =
        s.phase === 'service' || s.phase === 'closing'
          ? clockMinutes(c.clientele, s)
          : s.phase === 'prep'
            ? c.clientele.days.open
            : c.clientele.days.close;
      const phase = phaseOf(c.clientele, s);
      return {
        minutes: Math.floor(minutes),
        day: s.day,
        weekday: weekdayOf(s.day),
        phase,
        closingMinutes: c.clientele.days.close,
        stop:
          s.phase === 'prep'
            ? { kind: 'preparation' }
            : s.phase === 'service' || s.phase === 'closing'
              ? null
              : { kind: 'closed' },
        weather: weatherOf(c.clientele, s.weather),
        lastHour: s.phase === 'service' && minutes >= c.clientele.days.close - 60,
      };
    },
    house(w) {
      const s = w.clientele;
      if (s.day === 0) return null;
      return {
        name: s.houseName ?? 'Le café d’Ormeval',
        place: 'Ormeval',
        cashCents: s.cash,
        reservedCents: s.proposals.reduce((sum, p) => sum + p.price, 0),
        halfCups: Math.round(s.cups * 2),
      };
    },
    tickets: (w, player) =>
      w.service.tickets.filter((t) => t.taker === player).map((t) => ticketView(content, w, t)),
    aimedTicket(w, _player, target) {
      if (target?.kind !== 'station') return null;
      const placed = w.furniture.find((f) => f.id === target.furniture);
      if (content.furniture.get(placed?.type ?? '')?.station !== 'rail') return null;
      const t = w.service.tickets.find((u) => u.taker === null) ?? w.service.tickets[0];
      return t === undefined ? null : ticketView(content, w, t);
    },
    gauge: (w, player) => gaugeView(content, w, player),
    hint(w, player) {
      const s = w.clientele;
      if (s.day > 4 || player !== local) return null;
      if (s.phase === 'prep')
        return 'L’horloge est arrêtée : prépare le café, puis appuie sur Entrée pour retourner la pancarte, à deux.';
      if (s.phase === 'service' && w.service.waiting.length > 0)
        return 'Un client attend à la caisse : maintiens E sur la caisse.';
      if (s.phase === 'service' && w.service.tickets.some((t) => t.taker === null))
        return 'Un ticket attend au rail : prends-le, puis prépare ce qu’il demande et pose-le sur le passe.';
      return null;
    },
    proposals: (w) => proposalsOf(content, w),
    dialogue: () => spoken().dialogue,
    scene: () => spoken().scene,
    morning(w, c) {
      const s = w.clientele;
      if (s.phase !== 'prep') return null;
      const plan = planOf(c.clientele, s.day);
      const eventId = plan?.event ?? plan?.dayEvent ?? null;
      const event = eventId === null ? undefined : c.clientele.events.get(eventId);
      const cartons = s.cartons.reduce((sum, [, n]) => sum + n, 0);
      const letterLines = c.clientele.texts.dialogues.rene_letter ?? [];
      return {
        title: `${WEEKDAYS[weekdayOf(s.day)] ?? ''} ${String(s.day)} · printemps`,
        weather: weatherOf(c.clientele, s.weather),
        thisMorning:
          cartons > 0
            ? [
                `La livraison est arrivée : ${String(cartons)} carton${cartons > 1 ? 's' : ''} sur la palette de la cour.`,
              ]
            : [],
        today: [plan?.title ?? '', event?.name ?? ''].filter((x) => x !== ''),
        projects: [],
        letter:
          s.letterDay !== 0 && s.letterDay === s.day && letterLines.length > 0
            ? {
                from: 'René',
                title: 'Une lettre de Mérelles',
                paragraphs: letterLines.map((l) => l.text),
                signature: 'René',
              }
            : null,
      };
    },
    slate: (w) => (w.clientele.day === 0 ? null : slateView(content, w)),
    orders: (w) => (w.clientele.day === 0 ? null : ordersView(content, w)),
    catalogue(w) {
      if (w.clientele.day === 0) return null;
      const items = catalogueItems(content, w);
      return {
        items,
        families: [...new Set(items.map((i) => i.family))],
        styles: [...new Set(items.map((i) => i.style))],
        thresholdCents: bigPurchaseCents(cc, w.clientele),
        banner:
          w.clientele.phase === 'monday' && w.clientele.day > 1
            ? 'Lundi : la brocante est sur la place.'
            : null,
      };
    },
    evening: (w, player) => eveningView(content, w, player),
    night(w) {
      const s = w.clientele;
      if (!endOfDemoDay(cc, s)) return null;
      const v = s.votes.merelles ?? [0, 0];
      const choice = (x: 0 | 1 | 2): 'none' | 'continue' | 'finish' =>
        x === 1 ? 'continue' : x === 2 ? 'finish' : 'none';
      return {
        subtitle: 'René attend votre réponse : partir pour Mérelles ?',
        tomorrow: 'Les deux réponses mènent à la fin de la démo.',
        choices: [choice(v[0]), choice(v[1])],
      };
    },
    demoEnd(w) {
      const s = w.clientele;
      return s.phase === 'end'
        ? { days: s.day, served: s.servedTotal, words: s.guestbookCount }
        : null;
    },
    houseSetup(w) {
      const s = w.clientele;
      if (s.day !== 1 || s.houseName !== null) return null;
      const pending = s.namePending;
      return {
        name: pending?.name ?? '',
        emblem: '',
        colors: '',
        editingBy: null,
        ready: [pending?.by === 0, pending?.by === 1],
      };
    },
    duoSettings: (w) => ({
      pace: w.clientele.pace === 'peaceful' ? 'calm' : 'normal',
      crowd: 'normal',
      radio: 'both',
    }),
    uiPlace: (w, player) => w.clientele.uiPlaces[player],
    alert(event) {
      counter++;
      const id = `${event.type}-${String(counter)}`;
      if (event.type === 'clientele-delivery')
        return { id, icon: 'delivery', text: 'La livraison est arrivée dans la cour.' };
      if (event.type === 'service-ticket-ready')
        return { id, icon: 'ready', text: 'Une commande est prête sur le passe.' };
      if (event.type === 'clientele-cups')
        return { id, icon: 'cup', text: 'Une demi-tasse de plus à Ormeval !' };
      if (event.type === 'clientele-opened')
        return { id, icon: 'wave', text: 'La pancarte est retournée : c’est ouvert !' };
      if (event.type === 'clientele-closing')
        return { id, icon: 'info', text: 'Fermeture : on finit de servir ceux qui sont là.' };
      if (event.type === 'service-recipe-unlocked')
        return {
          id,
          icon: 'info',
          text: `Nouvelle recette : ${recipeOf(content, event.recipe)?.label ?? event.recipe}.`,
        };
      return null;
    },
    quality(event, me) {
      if (
        (event.type === 'service-extraction-stop' ||
          event.type === 'service-steam-stop' ||
          event.type === 'service-tea-poured' ||
          event.type === 'service-cook-done') &&
        event.player === me
      )
        return QUALITY_LABEL[event.quality];
      return null;
    },
  };

  const slateLines = (): [string, number][] =>
    world().clientele.slate.map(([id, step]): [string, number] => [id, step]);

  const intents: IntentFor = {
    'house-name': (a) =>
      a.name.trim() === '' ? null : { type: 'clientele-name', name: a.name.trim().slice(0, 32) },
    'house-ready': (a) => {
      const pending = world().clientele.namePending;
      return a.ready && pending !== null && pending.by !== local ? vote('name', true) : null;
    },
    'morning-start': () => vote('open', true),
    'proposal-answer': (a) => {
      if (a.id === 'open') return vote('open', a.accept);
      if (a.id === 'close') return vote('close', a.accept);
      if (a.id === 'amenagement') return { type: 'amenagement-repondre', accept: a.accept };
      if (a.id.startsWith('achat:'))
        return { type: 'clientele-answer', by: a.id.endsWith('1') ? 1 : 0, accept: a.accept };
      return null;
    },
    'proposal-withdraw': (a) => (a.id === 'open' || a.id === 'close' ? vote(a.id, false) : null),
    'slate-write': (a) => {
      const lines = slateLines();
      if (lines.some(([id]) => id === a.recipe)) return null;
      return slateWith([...lines, [a.recipe, 0]]);
    },
    'slate-erase': (a) => slateWith(slateLines().filter(([id]) => id !== a.recipe)),
    'slate-price': (a) => {
      const r = cc.recipes.get(a.recipe);
      if (r === undefined) return null;
      const step = Math.round(
        (a.priceCents / Math.round(r.basePrice * 100) - 1) / cc.economy.priceSteps.step,
      );
      const bounded = Math.max(
        cc.economy.priceSteps.min,
        Math.min(cc.economy.priceSteps.max, step),
      );
      return slateWith(
        slateLines().map(([id, s]): [string, number] => [id, id === a.recipe ? bounded : s]),
      );
    },
    'order-quantity': (a) => supply({ ...currentOrder(), [a.product]: a.quantity }),
    'order-usual': () => supply(suggestedOrder(cc, world().clientele)),
    'order-send': () => supply(currentOrder()),
    buy: (a) => buy(a.item),
    'propose-buy': (a) => buy(a.item),
    'duo-setting': (a) =>
      a.key === 'pace' ? { type: 'clientele-pace', peaceful: a.value === 'calm' } : null,
    'ui-place': (a) => ({
      type: 'clientele-ui-place',
      place: a.place === null ? null : a.place.slice(0, 60),
    }),
    'evening-choice': (a) => (a.goodNight ? vote('next-day', true) : null),
    'night-choice': (a) => (a.choice === 'none' ? null : vote('merelles', a.choice === 'continue')),
    'demo-end': (a) => (a.stay ? vote('next-day', true) : null),
    'dialogue-next': (a) => {
      next(a.id);
      return null;
    },
    'dialogue-answer': (a) => {
      const clue = queue.find((d) => d.id === a.id);
      next(a.id);
      const kind = clue === undefined ? undefined : clueKinds.get(clue.id);
      const action = kind === undefined ? undefined : SCENE_ACTION[kind];
      return action === undefined
        ? null
        : { type: 'clientele-scene', action, choice: Math.max(0, Math.min(20, a.answer)) };
    },
    'scene-dismiss': () => {
      scene = null;
      return null;
    },
  };

  const next = (id: string): void => {
    const i = queue.findIndex((d) => d.id === id);
    if (i >= 0) queue.splice(i, 1);
  };

  const wave = (): Intent | null => {
    const w = world();
    const ev = w.clientele.event;
    const kind = ev === null ? undefined : cc.events.get(ev.id)?.kind;
    const action = kind === undefined ? undefined : SCENE_ACTION[kind];
    if (action === 'driver' || action === 'repair' || action === 'surprise')
      return { type: 'clientele-scene', action, choice: 0 };
    const me = view.pose(local);
    let best: { id: number; d: number } | null = null;
    const pose: CustomerPose = { x: 0, z: 0, yawDeg: 0, anim: 'idle' };
    for (const g of w.clientele.groups) {
      if (g.stage === 'leaving') continue;
      const seat = g.seats[0];
      const placed = seat === undefined ? undefined : w.furniture.find((f) => f.id === seat);
      const at = placed ?? (standingPose(w, g.id, performance.now(), pose) ? pose : undefined);
      if (at === undefined) continue;
      const d = Math.hypot(at.x - me.x, at.z - me.z);
      if (best === null || d < best.d) best = { id: g.id, d };
    }
    return best === null || best.d > cc.rules.talkReach
      ? null
      : { type: 'clientele-talk', group: best.id };
  };

  return {
    sources,
    intents,
    next,
    wave,
    onEvent(event) {
      if (event.type === 'clientele-say' && (event.player === null || event.player === local)) {
        counter++;
        if (queue.length < 8)
          queue.push({
            id: `say-${String(counter)}`,
            speaker: event.who,
            text: event.text,
            answers: [],
            privateHint: null,
          });
      } else if (
        event.type === 'clientele-clue' &&
        event.player === local &&
        event.choices.length > 0
      ) {
        counter++;
        const id = `clue-${String(counter)}`;
        clueKinds.set(id, cc.events.get(event.event)?.kind ?? '');
        queue.push({
          id,
          speaker: cc.events.get(event.event)?.name ?? 'Un indice',
          text: event.text,
          answers: event.choices.slice(0, 3),
          privateHint: event.text,
        });
      } else if (event.type === 'clientele-clue' && event.player === local) {
        scene = {
          id: `clue-${event.event}`,
          title: cc.events.get(event.event)?.name ?? 'Un indice',
          lines: [event.text],
          privateHint: event.text,
          outcome: null,
          rewards: [],
        };
      } else if (event.type === 'clientele-event-start') {
        scene = {
          id: `scene-${event.event}`,
          title: event.name,
          lines: [cc.events.get(event.event)?.goal ?? ''].filter((x) => x !== ''),
          privateHint: null,
          outcome: null,
          rewards: [],
        };
      } else if (event.type === 'clientele-evening' || event.type === 'clientele-dawn') {
        scene = null;
      }
    },
  };
}
