/**
 * Contrat de lecture de l'interface (chantier d): tout ce que le HUD, le téléphone, l'ardoise,
 * le bilan et les écrans affichent, sous une forme prête à montrer, sans DOM ni Three.js.
 *
 * L'interface ne lit jamais le monde directement en dehors de `adaptateur.ts`: les chantiers
 * a (service), b (clientèle, journée, économie) et c (aménagement) fournissent ces vues par
 * les lecteurs de `InterfaceSources` (adaptateur.ts). Un champ absent ou `null` est un état
 * vide montré proprement (« Rien à faire pour l'instant. »), jamais une erreur.
 *
 * Montants en centimes (entiers), heures en minutes depuis minuit, joueurs par `PlayerIndex`
 * (0: hôte, 1: invité). Les noms des joueurs et leurs profils viennent du SDK, pas d'ici.
 */
import type { PlayerIndex } from '../etat/monde';

/** Moment de la journée (TE-02 à TE-08). */
export type DayPhase =
  | 'first-time'
  | 'morning'
  | 'preparation'
  | 'service'
  | 'soft-closing'
  | 'closed'
  | 'evening'
  | 'night'
  | 'day-off'
  | 'demo-end';

export type WeatherKind = 'sun' | 'clouds' | 'rain' | 'shower';

export interface WeatherView {
  readonly kind: WeatherKind;
  /** « Soleil, 18 °C ». */
  readonly label: string;
}

/** Pourquoi l'horloge est arrêtée (bord en pointillés). */
export type ClockStop =
  | { readonly kind: 'preparation' }
  | { readonly kind: 'closed' }
  | { readonly kind: 'resume' }
  | { readonly kind: 'absent'; readonly player: PlayerIndex }
  | { readonly kind: 'countdown'; readonly seconds: number };

export interface ClockView {
  /** Heure affichée, en minutes depuis minuit. */
  readonly minutes: number;
  /** Jour de la maison, à partir de 1. */
  readonly day: number;
  /** 0 lundi ... 6 dimanche. */
  readonly weekday: number;
  readonly phase: DayPhase;
  /** Heure de fermeture, en minutes (« fermeture à 18 h »). */
  readonly closingMinutes: number;
  readonly stop: ClockStop | null;
  readonly weather: WeatherView;
  /** Vrai pendant la dernière heure du service (rappel affiché une fois). */
  readonly lastHour: boolean;
}

export interface TicketLineView {
  readonly label: string;
  readonly done: boolean;
}

export interface TicketView {
  readonly id: number;
  /** « Table 3 », « Comptoir », « À emporter ». */
  readonly destination: string;
  readonly waitMinutes: number;
  readonly lines: readonly TicketLineView[];
  /** Joueur qui l'a pris, `null` s'il est libre. */
  readonly takenBy: PlayerIndex | null;
  /** Remises du ticket, déjà rédigées (« Heure douce : -0,50 € », « Tampons : 4 sur 8 »). */
  readonly receipt?: readonly string[];
}

/** Ce que tient un joueur (coin bas droit, carte de l'autre). */
export interface HeldView {
  /** « Plateau : cappuccino, tarte aux fruits ». */
  readonly label: string;
  /** « Ticket 12 · 2 sur 4 places ». */
  readonly detail: string | null;
}

/** Jauge d'un geste autour du point de visée (ux 5.2). */
export interface GaugeView {
  readonly kind: 'hold' | 'gauge' | 'window';
  /** « Mousser le lait · 55 °C ». */
  readonly label: string;
  /** Avancement de 0 à 1. */
  readonly value: number;
  /** Zone visée, de 0 à 1 (segment épais et encoches), `null` sans zone. */
  readonly zone: readonly [number, number] | null;
  /** « Presque… », « Juste », « Un peu chaud ». */
  readonly word: string | null;
  /** Invite du geste: « Relâche E dans la zone : 58 à 65 °C ». */
  readonly prompt: string;
  /** Geste simplifié en cours (« tout seul »). */
  readonly simplified: boolean;
}

export interface TimerView {
  readonly id: string;
  /** « Lave-vaisselle · encore 2 min » ou « Lave-vaisselle : propre ». */
  readonly label: string;
  readonly progress: number;
  readonly ready: boolean;
}

/** Ce que fait l'autre, pour sa carte quand il est hors de vue (ux 3.2). */
export interface PartnerActivity {
  /** « À la plonge », « Sur son téléphone : Catalogue ». */
  readonly place: string | null;
  /** « Tient 3 assiettes sales », « Fait une pause depuis 1 min », « Pas encore la main ». */
  readonly doing: string | null;
}

export type ProposalKind = 'open' | 'close-early' | 'purchase' | 'move';

export interface ProposalView {
  readonly id: string;
  readonly from: PlayerIndex;
  readonly kind: ProposalKind;
  /** Objet d'un achat (« Machine à espresso deux groupes »). */
  readonly item: string | null;
  readonly amountCents: number | null;
  /** Ce qu'il resterait dans la caisse. */
  readonly remainingCents: number | null;
  /** Ce que ça apporte, quand ça arrive. */
  readonly benefit: string | null;
  readonly when: string | null;
}

export interface DialogueView {
  readonly id: string;
  /** « Simone ». */
  readonly speaker: string;
  readonly text: string;
  /** Deux ou trois réponses au plus; vide: Entrée pour la suite (ou seule, une fois lue). */
  readonly answers: readonly string[];
  /** Indice visible de ce joueur seulement (événements à indices, D-08). */
  readonly privateHint: string | null;
}

/** Carte d'une scène d'événement (« Le car de 8 h 12 »). */
export interface EventSceneView {
  readonly id: string;
  readonly title: string;
  readonly lines: readonly string[];
  /** Ce que seul ce joueur voit (« Le chauffeur attend encore 30 secondes. »). */
  readonly privateHint: string | null;
  /** Fin de scène: « Réussi ! » ou « Formidable ! ». */
  readonly outcome: 'reussi' | 'formidable' | null;
  readonly rewards: readonly string[];
}

export interface MorningView {
  /** « Mardi 9 · printemps ». */
  readonly title: string;
  readonly weather: WeatherView;
  readonly thisMorning: readonly string[];
  readonly today: readonly string[];
  readonly projects: readonly string[];
  /** Courrier: la lettre de René quand elle arrive (jour 11 en médiane). */
  readonly letter: LetterView | null;
}

export interface LetterView {
  readonly from: string;
  readonly title: string;
  readonly paragraphs: readonly string[];
  readonly signature: string;
}

export interface RecipeView {
  readonly id: string;
  readonly name: string;
  /** « Boissons chaudes », « Boisson froide », « Sucré », « Salé ». */
  readonly family: string;
  readonly suggestedCents: number;
  /** « pressés, flâneurs ». */
  readonly attracts: string;
  /** Raison d'indisponibilité: « Pas encore apprise », « Il faut un four », « Plus de lait d'avoine ». */
  readonly unavailable: string | null;
}

export interface SlateLineView {
  readonly recipe: string;
  readonly priceCents: number;
  /** Coût de revient d'une portion (ingrédients), en centimes (P0-4). */
  readonly costCents: number;
  readonly star: boolean;
  /** « Prix juste pour le village ». */
  readonly priceNote: string;
  /** En service: « Épuisé depuis 11 h 05 : la vitrine est vide ». */
  readonly soldOut: string | null;
  /** Ligne tenue par l'autre. */
  readonly lockedBy: PlayerIndex | null;
  /** Prix remisé en ce moment (heure douce en cours, offre du jour): le prix est barré. */
  readonly discountedCents?: number | null;
}

export interface SlateView {
  /** Remises annoncées en tête de l'ardoise, à la craie (« Heure douce 15 h-17 h : boissons -20 % »). */
  readonly discountLines?: readonly string[];
  /** « C'est l'heure douce ! », souligné pendant le créneau. */
  readonly happyHourNow?: string | null;
  readonly maxLines: number;
  readonly maxStars: number;
  readonly lines: readonly SlateLineView[];
  readonly word: string;
  readonly recipes: readonly RecipeView[];
  /** Café ouvert: lecture seule. */
  readonly readOnly: boolean;
  readonly proposedThisMorning: boolean;
  /** « Ce que dit votre ardoise : ... ». */
  readonly summary: string | null;
  /** L'autre a l'ardoise ouverte. */
  readonly partnerWriting: boolean;
}

export interface OrderProductView {
  readonly id: string;
  readonly name: string;
  /** Conditionnement d'un carton: « caisse de 6 bouteilles d'1 L ». */
  readonly pack: string;
  /** « 4 L ». */
  readonly stock: string;
  /** Dernier jour de vente (jour de la maison) du lot le plus proche, `null` sans stock. */
  readonly goodUntil: number | null;
  /** Un lot finit demain: « À finir demain ». */
  readonly useFirst: boolean;
  readonly usual: number;
  readonly quantity: number;
  readonly unit: string;
  readonly unitCents: number;
  readonly lockedBy: PlayerIndex | null;
  /** En rupture (moins d'une portion de la plus petite recette): le dépannage est proposé. */
  readonly outOfStock?: boolean;
  /** Prix d'un carton de dépannage par Mireille (+30 %), centimes. */
  readonly emergencyCents?: number;
  /** Un dépannage de ce produit est déjà en route. */
  readonly emergencyOnTheWay?: boolean;
}

export interface SupplierView {
  readonly id: string;
  readonly name: string;
  readonly place: string;
  /** Jours de passage (0 lundi). */
  readonly days: readonly number[];
  /** Passe le jour de livraison de la commande; sinon lignes en lecture seule. */
  readonly passes: boolean;
  /** Prochain passage (jour de la semaine, 0 lundi), `null` s'il ne passe jamais. */
  readonly next: number | null;
  /** Port à payer à cette livraison et ce qui manque pour le port offert (centimes). */
  readonly shippingCents: number;
  readonly toFrancoCents: number;
  /** Le fournisseur a un franco (sinon aucune ligne de port). */
  readonly hasFranco: boolean;
  readonly products: readonly OrderProductView[];
}

export interface OrdersView {
  /** Jour de la maison, pour dater la réserve. */
  readonly today: number;
  /** Jour de la semaine de la livraison (0 lundi): « Commandes pour mardi ». */
  readonly deliveryWeekday: number;
  /** La commande attend un lundi sans livraison (dimanche soir, lundi). */
  readonly overMonday: boolean;
  /** À payer à la livraison, port compris, et mis de côté dans la caisse (centimes). */
  readonly totalCents: number;
  /** Ce que la caisse peut payer aujourd'hui: caisse moins « à régler » et propositions. */
  readonly payableCents: number;
  readonly suppliers: readonly SupplierView[];
  readonly sent: boolean;
  /** Dépannage dans l'heure (+30 %), seulement pendant le service. */
  readonly emergencyOpen: boolean;
}

export type CatalogueState =
  | { readonly kind: 'buy' }
  | { readonly kind: 'propose' }
  | { readonly kind: 'missing'; readonly missingCents: number }
  | { readonly kind: 'locked'; readonly reason: string }
  | { readonly kind: 'pending-mine' }
  | { readonly kind: 'pending-theirs'; readonly proposal: string }
  | { readonly kind: 'bought' };

export interface CatalogueItemView {
  readonly id: string;
  readonly name: string;
  readonly family: string;
  readonly style: string;
  readonly brings: string;
  readonly needs: string | null;
  readonly priceCents: number;
  readonly state: CatalogueState;
  /** Note de prix: « -30 % à la brocante », « -20 % : marché aux fleurs ». */
  readonly deal: string | null;
}

export interface CatalogueView {
  readonly items: readonly CatalogueItemView[];
  readonly families: readonly string[];
  readonly styles: readonly string[];
  /** Seuil d'un gros achat, proposé à l'autre (150 € au village dans la démo). */
  readonly thresholdCents: number;
  /** Ligne de contexte: brocante du lundi, marché aux fleurs. */
  readonly banner: string | null;
}

export interface ProjectView {
  readonly id: string;
  readonly title: string;
  readonly done: number;
  readonly total: number;
  readonly missing: string | null;
  readonly pinned: boolean;
}

export interface ProjectsView {
  readonly current: readonly ProjectView[];
  readonly later: readonly ProjectView[];
  readonly achieved: readonly ProjectView[];
}

export interface GuestbookEntryView {
  readonly text: string;
  readonly signature: string;
  /** « habitué » ou « habituée » (genre du personnage). */
  readonly regular: string | null;
  /** « A aimé : le café crème, la nappe ». */
  readonly subject: string;
  readonly tone: 'liked' | 'missed' | 'pricey';
}

export interface EveningFigures {
  readonly open: boolean;
  readonly served: number;
  /** Clients servis le dernier jour ouvert (« dimanche : 52 »), `null` le premier soir. */
  readonly previousServed: { readonly weekday: number; readonly served: number } | null;
  readonly revenueCents: number;
  readonly tipsCents: number;
  readonly eventCents: number;
  readonly goodsCents: number;
  readonly shippingCents: number;
  readonly emergencyCents: number;
  readonly rentCents: number;
  readonly chargesCents: number;
  /** Détail des charges: nom et montant (centimes). */
  readonly chargeLines: readonly { readonly name: string; readonly cents: number }[];
  /** Hors résultat: achats du jour (catalogue, équipements). */
  readonly purchasesCents: number;
  readonly resultCents: number;
  readonly cashCents: number;
  /** En petit: coût des ventes, périmé jeté ce matin (et quoi), panier du soir. */
  readonly costOfSalesCents: number;
  readonly lostCents: number;
  readonly lostItems: readonly string[];
  readonly basketCents: number;
  readonly basketPieces: number;
  /** Publicité payée ce jour-là: une ligne du résultat (remises et marketing v0.2). */
  readonly marketingCents?: number;
  /** Remises consenties, pour mémoire (la recette en est déjà nette), et leur détail rédigé. */
  readonly discountsCents?: number;
  readonly discountsHelp?: string | null;
  /** « Venus grâce à l'affiche chez Lucas : environ 3 clients », bouche-à-oreille compris. */
  readonly cameThanks?: readonly string[];
}

export interface EveningView {
  readonly day: number;
  readonly weekday: number;
  readonly firstEvening: boolean;
  readonly guestbook: readonly GuestbookEntryView[];
  readonly regulars: readonly string[];
  readonly liked: readonly string[];
  readonly missed: readonly { readonly text: string; readonly link: string | null }[];
  readonly figures: EveningFigures;
  /** Réputation en demi-tasses (6: trois tasses). */
  readonly halfCups: number;
  readonly reputationHint: string;
  readonly tomorrow: {
    readonly line: string;
    readonly event: string | null;
    readonly orderSent: boolean;
    /** Jour de la semaine de la prochaine livraison (0 lundi). */
    readonly deliveryWeekday: number;
    readonly project: string | null;
    readonly regular: string | null;
  };
  /** Page que ce joueur lisait (1 à 4): le bilan rouvert y reprend, l'autre le sait. */
  readonly ownPage?: number;
  /** Où en est l'autre: page lue, ou son choix. */
  readonly partner:
    | { readonly kind: 'reading'; readonly page: number }
    | { readonly kind: 'closed' }
    | { readonly kind: 'good-night' };
}

export interface NightView {
  readonly subtitle: string;
  readonly tomorrow: string;
  readonly choices: readonly [NightChoice, NightChoice];
}
export type NightChoice = 'none' | 'continue' | 'finish';

export interface DemoEndView {
  readonly days: number;
  readonly served: number;
  readonly words: number;
}

/** Écran « Notre maison » (CC02): nom choisi à deux. */
export interface HouseSetupView {
  readonly name: string;
  readonly emblem: string;
  readonly colors: string;
  /** Champ tenu par l'autre (il écrit). */
  readonly editingBy: PlayerIndex | null;
  readonly ready: readonly [boolean, boolean];
}

export interface HouseView {
  readonly name: string;
  readonly place: string;
  readonly cashCents: number;
  readonly reservedCents: number;
  /** « À régler » (EC-06): ce que la caisse n'a pas couvert, repris sur les recettes du soir. */
  readonly dueCents: number;
  /** Demi-tasses de réputation. */
  readonly halfCups: number;
}

export interface DuoSettingsView {
  readonly pace: 'normal' | 'calm';
  readonly crowd: 'soft' | 'normal' | 'lively';
  readonly radio: 'both' | 'host';
}

/** Réglage des remises tel que l'interface le renvoie (`discounts-set`). */
export interface DiscountSettingsView {
  readonly happyHour: {
    readonly on: boolean;
    readonly start: number;
    readonly length: number;
    readonly rate: number;
    /** Jours (`tue`... de `journees.json`). */
    readonly days: readonly string[];
  };
  readonly loyalty: boolean;
  readonly profiles: Readonly<
    Record<
      string,
      { readonly on: boolean; readonly rate: number; readonly days: readonly string[] }
    >
  >;
  readonly dailyOffer: readonly [string, number] | null;
}

/** Onglet « Remises » (remises v0.2): réglage de demain, effets, suggestion. */
export interface DiscountsView {
  readonly settings: DiscountSettingsView;
  /** Jours réglables, dans l'ordre (`tue`... `sun`), et leur nom (« mardi »). */
  readonly days: readonly (readonly [string, string])[];
  readonly happyHour: {
    readonly starts: readonly number[];
    readonly lengths: readonly number[];
    /** Heure de fermeture: l’heure douce finit avant. */
    readonly closeHour: number;
    readonly rates: readonly number[];
    /** « De 15 h à 17 h, boissons -20 % ». */
    readonly line: string;
  };
  readonly loyalty: {
    readonly owned: boolean;
    /** « Achète d'abord les cartes au catalogue (15 €). », `null` une fois achetées. */
    readonly need: string | null;
    readonly holders: string | null;
  };
  readonly profileRates: readonly {
    readonly id: string;
    readonly label: string;
    readonly rates: readonly number[];
    /** Raison de la ligne grisée (« Pas d'étudiants au village... »), `null` si réglable. */
    readonly absent: string | null;
  }[];
  readonly dailyOffer: {
    readonly rates: readonly number[];
    readonly recipes: readonly {
      readonly id: string;
      readonly name: string;
      readonly baseCents: number;
      readonly offerCents: number;
      readonly floored: boolean;
    }[];
    readonly defaultRate: number;
  };
  /** « Il reste 6 parts de tarte à finir demain... », et la recette à proposer. */
  readonly suggestion: { readonly text: string; readonly recipe: string } | null;
  /** « Dimanche : la salle sera sans doute pleine... », `null` sinon. */
  readonly fullDay: string | null;
  /** « Hier, les remises t'ont coûté 3,20 €. », `null` sans remise. */
  readonly costYesterday: string | null;
  /** Le réglage vaut pour la prochaine ouverture (« Pour demain, mardi »). */
  readonly forDay: string;
}

export type CampaignStateView =
  | { readonly kind: 'launch'; readonly propose: boolean; readonly tired: boolean }
  | { readonly kind: 'running' | 'pending' | 'fading'; readonly text: string }
  | { readonly kind: 'missing'; readonly missingCents: number }
  | { readonly kind: 'pending-mine' }
  | { readonly kind: 'pending-theirs' }
  | { readonly kind: 'closed'; readonly reason: string };

/** Onglet « Faire connaître » (marketing v0.2). */
export interface MarketingView {
  readonly actions: readonly {
    readonly id: string;
    readonly name: string;
    readonly blurb: string;
    readonly costCents: number;
    /** « +8 % au plus, 7 jours ». */
    readonly effect: string;
    /** « voisins, pressés, flâneurs, familles ». */
    readonly audience: string;
    /** « Paraît jeudi 4 (bouclage mardi soir). », « Mireille les distribue samedi matin au marché. ». */
    readonly when: string;
    readonly state: CampaignStateView;
  }[];
  /** Le bouche-à-oreille, toujours actif: aide et clients venus hier. */
  readonly word: { readonly name: string; readonly help: string };
  readonly saturation: string | null;
  readonly thresholdCents: number;
}

/** Alerte douce (ux 3.3), déjà rédigée. */
export interface AlertView {
  readonly id: string;
  readonly icon: 'delivery' | 'regular' | 'cup' | 'stock' | 'ready' | 'wave' | 'order' | 'info';
  readonly text: string;
}

/**
 * Tout ce que lit l'interface pour une image. Chaque bloc vaut `null` quand son chantier ne
 * le fournit pas encore: l'interface montre alors l'état vide de la maquette.
 */
export interface InterfaceModel {
  readonly local: PlayerIndex;
  readonly clock: ClockView | null;
  readonly house: HouseView | null;
  readonly myTickets: readonly TicketView[];
  /** Ticket du rail sous le point de visée (carte de lecture). */
  readonly aimedTicket: TicketView | null;
  readonly held: readonly [HeldView | null, HeldView | null];
  readonly partner: PartnerActivity;
  readonly gauge: GaugeView | null;
  readonly timers: readonly TimerView[];
  readonly hint: string | null;
  readonly proposals: readonly ProposalView[];
  readonly dialogue: DialogueView | null;
  readonly scene: EventSceneView | null;
  readonly morning: MorningView | null;
  readonly slate: SlateView | null;
  readonly orders: OrdersView | null;
  readonly discounts?: DiscountsView | null;
  readonly marketing?: MarketingView | null;
  readonly catalogue: CatalogueView | null;
  readonly projects: ProjectsView | null;
  readonly evening: EveningView | null;
  readonly night: NightView | null;
  readonly demoEnd: DemoEndView | null;
  readonly houseSetup: HouseSetupView | null;
  readonly duoSettings: DuoSettingsView | null;
}
