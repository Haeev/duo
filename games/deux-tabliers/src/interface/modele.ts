/**
 * Contrat de lecture de l'interface (chantier d): tout ce que le HUD, la tablette, l'ardoise,
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
  /** « À la plonge », « Sur la tablette : catalogue ». */
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
  readonly star: boolean;
  /** « Prix juste pour le village ». */
  readonly priceNote: string;
  /** En service: « Épuisé depuis 11 h 05 : la vitrine est vide ». */
  readonly soldOut: string | null;
  /** Ligne tenue par l'autre. */
  readonly lockedBy: PlayerIndex | null;
}

export interface SlateView {
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
  /** « 4 L ». */
  readonly stock: string;
  readonly usual: number;
  readonly quantity: number;
  readonly unit: string;
  readonly unitCents: number;
  readonly lockedBy: PlayerIndex | null;
}

export interface SupplierView {
  readonly id: string;
  readonly name: string;
  readonly place: string;
  readonly products: readonly OrderProductView[];
}

export interface OrdersView {
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
  readonly served: number;
  /** Clients servis le dernier jour ouvert (« dimanche : 52 »), `null` le premier soir. */
  readonly previousServed: { readonly weekday: number; readonly served: number } | null;
  readonly revenueCents: number;
  readonly tipsCents: number;
  readonly purchasesCents: number;
  readonly resultCents: number;
  readonly cashCents: number;
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
    readonly project: string | null;
    readonly regular: string | null;
  };
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
  /** Demi-tasses de réputation. */
  readonly halfCups: number;
}

export interface DuoSettingsView {
  readonly pace: 'normal' | 'calm';
  readonly crowd: 'soft' | 'normal' | 'lively';
  readonly radio: 'both' | 'host';
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
  readonly catalogue: CatalogueView | null;
  readonly projects: ProjectsView | null;
  readonly evening: EveningView | null;
  readonly night: NightView | null;
  readonly demoEnd: DemoEndView | null;
  readonly houseSetup: HouseSetupView | null;
  readonly duoSettings: DuoSettingsView | null;
}
