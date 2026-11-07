/**
 * Aperçu de l'interface sans le jeu (captures, revue): un état par ancre, données d'exemple
 * reprises des maquettes et de la démo. `vite` puis `/src/interface/apercu/index.html#service`.
 * Paramètres: `?taille=125` ou `150` (taille d'interface de Duo), `?animations=reduites`.
 * Non livré: hors de `index.html`, Vite ne l'embarque pas dans le jeu.
 */
import { createInterface } from '../index';
import type { UiAction } from '../actions';
import type { InterfaceModel, SlateView } from '../modele';

const params = new URLSearchParams(location.search);
const scale = Number(params.get('taille') ?? '100') / 100;
const state = location.hash.replace('#', '') || 'service';

const recipes: SlateView['recipes'] = [
  {
    id: 'cafe-creme',
    name: 'Café crème',
    family: 'Boissons chaudes',
    suggestedCents: 240,
    attracts: 'pressés, flâneurs',
    unavailable: null,
  },
  {
    id: 'espresso',
    name: 'Espresso',
    family: 'Boissons chaudes',
    suggestedCents: 140,
    attracts: 'pressés, voisins',
    unavailable: null,
  },
  {
    id: 'chocolat',
    name: 'Chocolat chaud',
    family: 'Boissons chaudes',
    suggestedCents: 280,
    attracts: 'familles, gourmands',
    unavailable: null,
  },
  {
    id: 'the-noir',
    name: 'Thé noir',
    family: 'Boissons chaudes',
    suggestedCents: 250,
    attracts: 'pressés, télétravail',
    unavailable: null,
  },
  {
    id: 'noisette',
    name: 'Noisette',
    family: 'Boissons chaudes',
    suggestedCents: 170,
    attracts: 'voisins',
    unavailable: null,
  },
  {
    id: 'cappuccino',
    name: 'Cappuccino',
    family: 'Boissons chaudes',
    suggestedCents: 290,
    attracts: 'flâneurs, étudiants',
    unavailable: 'Il faut la fiche',
  },
  {
    id: 'citronnade',
    name: 'Citronnade maison',
    family: 'Boisson froide',
    suggestedCents: 300,
    attracts: 'promeneurs',
    unavailable: 'Pas encore apprise',
  },
  {
    id: 'croissant',
    name: 'Croissant',
    family: 'Sucré',
    suggestedCents: 120,
    attracts: 'pressés',
    unavailable: null,
  },
  {
    id: 'tarte',
    name: 'Tarte aux fruits de saison',
    family: 'Sucré',
    suggestedCents: 320,
    attracts: 'gourmands, familles',
    unavailable: null,
  },
  {
    id: 'tartine',
    name: 'Tartine beurre-confiture',
    family: 'Sucré',
    suggestedCents: 220,
    attracts: 'familles',
    unavailable: null,
  },
];

const slate = (over: Partial<SlateView> = {}): SlateView => ({
  maxLines: 8,
  maxStars: 3,
  word: 'Bienvenue aux randonneurs !',
  recipes,
  readOnly: false,
  proposedThisMorning: true,
  summary:
    'Ce que dit votre ardoise : boissons chaudes et douceurs du matin. Elle attire surtout les flâneurs et les pressés.',
  partnerWriting: false,
  lines: [
    {
      recipe: 'cafe-creme',
      priceCents: 240,
      star: false,
      priceNote: 'Prix juste pour le village',
      soldOut: null,
      lockedBy: null,
    },
    {
      recipe: 'chocolat',
      priceCents: 320,
      star: true,
      priceNote: 'Un peu cher pour le village : les familles hésiteront',
      soldOut: null,
      lockedBy: null,
    },
    {
      recipe: 'espresso',
      priceCents: 140,
      star: false,
      priceNote: 'Prix juste pour le village',
      soldOut: null,
      lockedBy: null,
    },
    {
      recipe: 'croissant',
      priceCents: 120,
      star: true,
      priceNote: 'Prix juste pour le village',
      soldOut: null,
      lockedBy: null,
    },
    {
      recipe: 'tarte',
      priceCents: 320,
      star: false,
      priceNote: 'Prix juste pour le village',
      soldOut: null,
      lockedBy: null,
    },
  ],
  ...over,
});

const base: InterfaceModel = {
  local: 0,
  clock: {
    minutes: 11 * 60 + 20,
    day: 9,
    weekday: 1,
    phase: 'service',
    closingMinutes: 18 * 60,
    stop: null,
    weather: { kind: 'sun', label: 'Soleil, 18 °C' },
    lastHour: false,
  },
  house: {
    name: 'La Tasse Bleue',
    place: 'place du Tilleul',
    cashCents: 48_200,
    reservedCents: 0,
    halfCups: 5,
  },
  myTickets: [
    {
      id: 12,
      destination: 'Comptoir',
      waitMinutes: 5,
      takenBy: 0,
      lines: [
        { label: 'Café crème, au passe', done: true },
        { label: 'Tarte aux fruits', done: false },
      ],
    },
    {
      id: 14,
      destination: 'Comptoir',
      waitMinutes: 2,
      takenBy: 0,
      lines: [{ label: 'Chocolat chaud', done: false }],
    },
  ],
  aimedTicket: null,
  held: [
    { label: 'Plateau : café crème, tarte aux fruits', detail: 'Ticket 12 · 2 sur 4 places' },
    { label: 'Pichet de lait', detail: null },
  ],
  partner: { place: 'Derrière le comptoir', doing: 'Utilise : machine à espresso' },
  gauge: null,
  timers: [],
  hint: null,
  proposals: [],
  dialogue: null,
  scene: null,
  morning: null,
  slate: slate(),
  orders: {
    sent: false,
    emergencyOpen: true,
    suppliers: [
      {
        id: 'joelle',
        name: 'Joëlle, la laitière',
        place: 'ferme des Aulnes',
        products: [
          {
            id: 'lait',
            name: 'Lait entier',
            stock: '4 L',
            usual: 12,
            quantity: 12,
            unit: 'L',
            unitCents: 110,
            lockedBy: null,
          },
          {
            id: 'creme',
            name: 'Crème',
            stock: '0,5 L',
            usual: 1,
            quantity: 1,
            unit: 'L',
            unitCents: 420,
            lockedBy: 1,
          },
        ],
      },
      {
        id: 'fournil',
        name: 'Le Fournil Morel',
        place: 'rue Haute',
        products: [
          {
            id: 'croissant',
            name: 'Croissants',
            stock: '3',
            usual: 30,
            quantity: 30,
            unit: 'pièces',
            unitCents: 70,
            lockedBy: null,
          },
          {
            id: 'pain-choc',
            name: 'Pains au chocolat',
            stock: '2',
            usual: 20,
            quantity: 18,
            unit: 'pièces',
            unitCents: 75,
            lockedBy: null,
          },
        ],
      },
    ],
  },
  catalogue: {
    thresholdCents: 15_000,
    banner: "Marché aux fleurs : plantes à -20 % jusqu'à vendredi",
    families: ['Fonctionnel', 'Assises', 'Tables', 'Luminaires', 'Décoration'],
    styles: ['Campagne', 'Bistrot', 'Jardin'],
    items: [
      {
        id: 'gobelets',
        name: 'Gobelets à emporter',
        family: 'Fonctionnel',
        style: 'Campagne',
        brings: 'Les pressés repartent avec leur café.',
        needs: null,
        priceCents: 4_000,
        state: { kind: 'buy' },
        deal: null,
      },
      {
        id: 'pichet',
        name: 'Pichet thermomètre',
        family: 'Fonctionnel',
        style: 'Bistrot',
        brings: "Le lait juste se lit d'un coup d'œil.",
        needs: null,
        priceCents: 6_000,
        state: { kind: 'bought' },
        deal: null,
      },
      {
        id: 'fauteuil',
        name: 'Fauteuil crapaud',
        family: 'Assises',
        style: 'Campagne',
        brings: "Une place confortable : les lecteurs s'attardent.",
        needs: null,
        priceCents: 22_000,
        state: { kind: 'propose' },
        deal: null,
      },
      {
        id: 'terrasse',
        name: 'Terrasse sous le store',
        family: 'Fonctionnel',
        style: 'Jardin',
        brings: 'Quatre places dehors, au soleil.',
        needs: null,
        priceCents: 45_000,
        state: { kind: 'missing', missingCents: 2_100 },
        deal: null,
      },
      {
        id: 'citronnier',
        name: 'Citronnier en pot',
        family: 'Décoration',
        style: 'Jardin',
        brings: "Du vert et une odeur d'été.",
        needs: null,
        priceCents: 6_400,
        state: { kind: 'buy' },
        deal: '-20 % : marché aux fleurs',
      },
      {
        id: 'suspension',
        name: 'Suspension en osier',
        family: 'Luminaires',
        style: 'Campagne',
        brings: "La salle s'éclaire doucement.",
        needs: 'une prise au plafond',
        priceCents: 7_000,
        state: { kind: 'locked', reason: 'Au palier « Deux tasses » (ou le jour 7)' },
        deal: null,
      },
    ],
  },
  projects: {
    current: [
      {
        id: 'terrasse',
        title: 'Une vraie terrasse',
        done: 2,
        total: 3,
        missing: 'un store',
        pinned: true,
      },
      {
        id: 'coin-feu',
        title: 'Le coin du feu',
        done: 0,
        total: 3,
        missing: 'la pièce du fond',
        pinned: false,
      },
    ],
    later: [],
    achieved: [
      {
        id: 'premiere-ardoise',
        title: 'Notre première ardoise',
        done: 1,
        total: 1,
        missing: null,
        pinned: false,
      },
    ],
  },
  evening: null,
  night: null,
  demoEnd: null,
  houseSetup: null,
  duoSettings: { pace: 'normal', crowd: 'normal', radio: 'both' },
};

const evening: InterfaceModel['evening'] = {
  day: 9,
  weekday: 1,
  firstEvening: false,
  guestbook: [
    {
      text: "Ils se souviennent de ma commande. Je me sens d'ici.",
      signature: 'Mathis',
      regular: 'habitué',
      subject: "A aimé : le café crème, comme d'habitude",
      tone: 'liked',
    },
    {
      text: "Pas trouvé de place pour m'asseoir, dommage.",
      signature: 'Deux randonneurs de passage',
      regular: null,
      subject: 'A manqué : une place assise',
      tone: 'missed',
    },
    {
      text: 'La tarte du jour était fondante.',
      signature: 'Une famille du village',
      regular: null,
      subject: 'A aimé : la tarte aux fruits',
      tone: 'liked',
    },
    {
      text: 'Un peu cher pour un village.',
      signature: 'Une étudiante',
      regular: null,
      subject: 'A trouvé cher : le chocolat chaud',
      tone: 'pricey',
    },
  ],
  regulars: [
    'Lise est passée à 15 h pour son thé noir. Elle a écrit trois pages près de la vitrine.',
    'Mathis a eu son car de justesse. Il a promis de revenir jeudi.',
  ],
  liked: ['Le café crème, toujours.', "L'ardoise : on la lit depuis la place."],
  missed: [
    {
      text: "3 clients n'ont pas trouvé de place assise vers midi.",
      link: 'Voir des tables dans le catalogue',
    },
  ],
  figures: {
    served: 28,
    previousServed: { weekday: 6, served: 52 },
    revenueCents: 20_100,
    tipsCents: 860,
    purchasesCents: 4_000,
    resultCents: 15_100,
    cashCents: 33_300,
  },
  halfCups: 5,
  reputationHint:
    "Vers la troisième tasse : les clients ravis et les mots du livre d'or la font monter.",
  tomorrow: {
    line: 'Mercredi 10 · pluie, 12 °C : les boissons chaudes vont plaire.',
    event: 'Le mercredi des enfants : Farida et Noé passent au goûter.',
    orderSent: false,
    project: 'Une vraie terrasse : 2 sur 3',
    regular: null,
  },
  partner: { kind: 'reading', page: 2 },
};

function modelFor(name: string): InterfaceModel {
  switch (name) {
    case 'rail':
      return {
        ...base,
        aimedTicket: {
          id: 15,
          destination: 'Comptoir',
          waitMinutes: 2,
          takenBy: null,
          lines: [
            { label: "2 chocolats chauds, dont 1 au lait d'avoine", done: false },
            { label: '1 pain au chocolat', done: false },
          ],
        },
        held: [null, base.held[1]],
      };
    case 'geste':
      return {
        ...base,
        gauge: {
          kind: 'gauge',
          label: 'Mousser le lait · 55 °C',
          value: 55 / 80,
          zone: [58 / 80, 65 / 80],
          word: 'Presque...',
          prompt: 'Relâche E dans la zone : 58 à 65 °C',
          simplified: false,
        },
        held: [{ label: 'Pichet de lait', detail: null }, null],
      };
    case 'preparation':
      return {
        ...base,
        clock:
          base.clock === null
            ? null
            : {
                ...base.clock,
                minutes: 7 * 60 + 30,
                phase: 'preparation',
                stop: { kind: 'preparation' },
              },
        myTickets: [],
        hint: 'passe derrière le comptoir, puis prends une tasse sur la machine.',
        timers: [{ id: 'lv', label: 'Lave-vaisselle · encore 2 min', progress: 0.4, ready: false }],
      };
    case 'ouverture':
      return {
        ...base,
        clock:
          base.clock === null
            ? null
            : {
                ...base.clock,
                minutes: 8 * 60,
                phase: 'preparation',
                stop: { kind: 'preparation' },
              },
        myTickets: [],
        proposals: [
          {
            id: 'p1',
            from: 1,
            kind: 'open',
            item: null,
            amountCents: null,
            remainingCents: null,
            benefit: null,
            when: null,
          },
        ],
      };
    case 'proposition':
      return {
        ...base,
        house: base.house === null ? null : { ...base.house, reservedCents: 22_000 },
        proposals: [
          {
            id: 'p2',
            from: 1,
            kind: 'purchase',
            item: 'Fauteuil crapaud',
            amountCents: 22_000,
            remainingCents: 26_200,
            benefit: "Une place confortable : les lecteurs s'attardent.",
            when: 'Livré demain à 7 h, avec les livraisons.',
          },
        ],
      };
    case 'envoyee':
      return {
        ...base,
        proposals: [
          {
            id: 'p3',
            from: 0,
            kind: 'purchase',
            item: 'Fauteuil crapaud',
            amountCents: 22_000,
            remainingCents: 26_200,
            benefit: null,
            when: null,
          },
        ],
      };
    case 'reprendre':
      return {
        ...base,
        clock: base.clock === null ? null : { ...base.clock, stop: { kind: 'resume' } },
        partner: { place: 'À la caisse', doing: 'Pas encore la main' },
      };
    case 'dialogue':
      return {
        ...base,
        dialogue: {
          id: 'd1',
          speaker: 'Simone',
          text: "Vous voilà chez vous. Faites de ce café l'endroit où l'on aime s'arrêter : écrivez votre carte, servez vos clients, et la maison grandira.",
          answers: [],
          privateHint: null,
        },
      };
    case 'scene':
      return {
        ...base,
        scene: {
          id: 's1',
          title: 'Jules a perdu sa mamie',
          lines: ['Un petit garçon en ciré jaune est entré seul.'],
          privateHint: 'Jules te dit : « Elle a un parapluie lilas et un cabas à carreaux. »',
          outcome: null,
          rewards: [],
        },
      };
    case 'ardoise-service':
      return {
        ...base,
        slate: slate({
          readOnly: true,
          lines: [
            ...slate().lines.slice(0, 4),
            {
              recipe: 'tarte',
              priceCents: 320,
              star: false,
              priceNote: '',
              soldOut: 'Épuisé depuis 11 h 05 : la vitrine est vide',
              lockedBy: null,
            },
          ],
        }),
      };
    case 'ardoise-ensemble':
      return {
        ...base,
        slate: slate({
          partnerWriting: true,
          lines: slate().lines.map((l, i) => (i === 1 ? { ...l, lockedBy: 1 } : l)),
        }),
      };
    case 'matin':
      return {
        ...base,
        clock:
          base.clock === null
            ? null
            : { ...base.clock, phase: 'morning', minutes: 7 * 60, stop: { kind: 'preparation' } },
        morning: {
          title: 'Mardi 9 · printemps',
          weather: { kind: 'sun', label: 'Soleil, 18 °C' },
          thisMorning: [
            'Joëlle a livré : 12 L de lait, 1 L de crème.',
            'Le Fournil Morel a livré : 30 croissants, 20 pains au chocolat.',
            'Les cartons attendent à la porte de service.',
          ],
          today: ["Lise passe d'habitude vers 15 h."],
          projects: ['Une vraie terrasse : 2 sur 3.'],
          letter: null,
        },
      };
    case 'lettre':
    case 'matin-lettre':
      return {
        ...modelFor('matin'),
        morning: {
          title: 'Jeudi 11 · printemps',
          weather: { kind: 'clouds', label: 'Nuageux, 15 °C' },
          thisMorning: ['Joëlle a livré : 12 L de lait.'],
          today: ["L'inspection : Madame Ferrand passe dans la matinée."],
          projects: [],
          letter: {
            from: 'René, place de la Halle, Mérelles',
            title: 'Une lettre de Mérelles',
            paragraphs: [
              "J'ai été pâtissier quarante ans, place de la Halle, à Mérelles. Mon four est froid depuis trois hivers.",
              "Je vous ai regardé faire, à la fête. Je cherche quelqu'un pour le rallumer. Vous, par exemple.",
            ],
            signature: 'René',
          },
        },
      };
    case 'bilan-1':
    case 'bilan-2':
    case 'bilan-3':
    case 'bilan-4':
      return {
        ...base,
        clock:
          base.clock === null
            ? null
            : { ...base.clock, phase: 'evening', minutes: 18 * 60 + 25, stop: { kind: 'closed' } },
        myTickets: [],
        evening,
      };
    case 'nuit':
      return {
        ...base,
        night: {
          subtitle: 'Mardi 9 · La Tasse Bleue, place du Tilleul',
          tomorrow: 'Demain : mercredi 10, pluie. Livraison à 7 h.',
          choices: ['continue', 'none'],
        },
      };
    case 'fin':
      return { ...base, demoEnd: { days: 12, served: 362, words: 41 } };
    case 'premiere-1':
    case 'premiere-2':
    case 'premiere-3':
    case 'premiere-4':
      return {
        ...base,
        clock: null,
        myTickets: [],
        held: [null, null],
        houseSetup: {
          name: 'La Tasse Bleue',
          emblem: 'théière',
          colors: 'bleu et crème',
          editingBy: null,
          ready: [false, true],
        },
      };
    default:
      return base;
  }
}

let model = modelFor(state);

/** Effet local des actions, pour essayer l'aperçu au clavier (l'hôte le fera dans le jeu). */
function simulate(m: InterfaceModel, action: UiAction): InterfaceModel {
  const s = m.slate;
  const line = (
    recipe: string,
    f: (l: SlateView['lines'][number]) => SlateView['lines'][number],
  ): InterfaceModel =>
    s === null
      ? m
      : { ...m, slate: { ...s, lines: s.lines.map((l) => (l.recipe === recipe ? f(l) : l)) } };
  if (action.type === 'house-ready' && m.houseSetup !== null)
    return { ...m, houseSetup: { ...m.houseSetup, ready: [action.ready, true] } };
  if (action.type === 'night-choice' && m.night !== null)
    return { ...m, night: { ...m.night, choices: [action.choice, m.night.choices[1]] } };
  if (action.type === 'slate-write' && s !== null) {
    const price = s.recipes.find((r) => r.id === action.recipe)?.suggestedCents ?? 200;
    return {
      ...m,
      slate: {
        ...s,
        lines: [
          ...s.lines,
          {
            recipe: action.recipe,
            priceCents: price,
            star: false,
            priceNote: 'Prix juste pour le village',
            soldOut: null,
            lockedBy: null,
          },
        ],
      },
    };
  }
  if (action.type === 'slate-erase' && s !== null)
    return { ...m, slate: { ...s, lines: s.lines.filter((l) => l.recipe !== action.recipe) } };
  if (action.type === 'slate-price')
    return line(action.recipe, (l) => ({ ...l, priceCents: action.priceCents }));
  if (action.type === 'slate-star')
    return line(action.recipe, (l) => ({ ...l, star: action.star }));
  return m;
}
const sent: string[] = [];
const ui = createInterface({
  root: document.body,
  me: { name: 'Camille', color: 'orb' },
  partner: { name: 'Sacha', color: 'crescent' },
  hostName: 'Camille',
  ui: () => ({ scale, reducedMotion: params.get('animations') === 'reduites' }),
  readModel: () => model,
  send: (action) => {
    sent.push(action.type);
    document.body.dataset.sent = sent.join(',');
    model = simulate(model, action);
    queueMicrotask(() => {
      ui.refresh();
    });
  },
  onCursor: () => undefined,
  aspect: () => window.innerWidth / window.innerHeight,
  actLabel: () => 'E',
});

const centre = {
  aiming: ['rail', 'service', 'ouverture'].includes(state),
  prompt:
    state === 'rail'
      ? { key: 'E', text: 'Prendre le ticket 15', refused: false }
      : state === 'service'
        ? {
            key: 'E',
            text: 'Servir au comptoir',
            refused: false,
            detail: 'Café crème, tarte aux fruits · ticket 12',
            dropKey: 'R',
            dropText: 'Reposer le plateau',
          }
        : state === 'ouverture'
          ? { key: 'E', text: 'Maintiens E : retourner la pancarte', refused: false }
          : null,
  hold: state === 'ouverture' ? 0.45 : null,
  capsule: state === 'reprendre',
};
const bearing = ['service', 'rail', 'reprendre', 'preparation'].includes(state) ? 160 : null;
if (params.has('fps')) ui.settings.set('showFps', true);

const loop = (now: number): void => {
  ui.frame(now, centre, bearing);
  requestAnimationFrame(loop);
};
requestAnimationFrame(loop);

const open: Record<string, () => void> = {
  'tablette-accueil': () => {
    ui.openTablet('home');
  },
  'tablette-commandes': () => {
    ui.openTablet('orders');
  },
  'tablette-catalogue': () => {
    ui.openTablet('catalogue');
  },
  'tablette-carte': () => {
    ui.openTablet('menu');
  },
  'tablette-projets': () => {
    ui.openTablet('projects');
  },
  'tablette-reglages': () => {
    ui.openTablet('settings');
  },
  ardoise: () => {
    ui.openSlate();
  },
  'ardoise-service': () => {
    ui.openSlate();
  },
  'ardoise-ensemble': () => {
    ui.openSlate();
  },
  proposition: () => {
    ui.step({ tablet: false, confirm: true, act: false, locked: true });
  },
};
if (state === 'proposition-carte') model = modelFor('proposition');
if (state === 'tablette-accueil') model = { ...modelFor('proposition') };
setTimeout(() => {
  open[state]?.();
  ui.refresh();
  if (state === 'lettre')
    document
      .querySelector<HTMLButtonElement>('[data-layer="matin"] .dt-row .dt-btn:not(.dt-btn-primary)')
      ?.click();
  document.body.dataset.ready = '1';
}, 50);

// Pages et étapes: un appui simulé suffit pour les captures (A et E, Entrée).
(window as unknown as { apercu: unknown }).apercu = {
  ui,
  setModel(next: InterfaceModel) {
    model = next;
    ui.refresh();
  },
};
