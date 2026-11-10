/**
 * `donnees/commun/reglages.json`: les valeurs de gameplay, jamais en dur dans la logique.
 * Chaque lot y ajoute sa section (schéma ici, valeurs dans le JSON, validées au chargement).
 */
import * as v from 'valibot';
import { CentsSchema, FileVersionSchema, FiniteSchema, IdSchema, IntSchema } from './communs';

const Seconds = v.pipe(FiniteSchema, v.minValue(0));
/** Minutes de jeu depuis minuit. */
const MinuteOfDay = v.pipe(IntSchema, v.minValue(0), v.maxValue(1439));
const Positive = v.pipe(FiniteSchema, v.minValue(0.01));

export const SettingsSchema = v.strictObject({
  schema: FileVersionSchema,
  /** Début d'une partie neuve. */
  start: v.strictObject({
    place: IdSchema,
    minute: MinuteOfDay,
    /** Bourse de départ de chaque joueur, en centimes. */
    money: CentsSchema,
    /** Silhouette de départ selon le genre choisi (morphologies du catalogue); toutes les pièces vont à tous. */
    shapes: v.strictObject({ f: IdSchema, m: IdSchema }),
  }),
  rest: v.strictObject({
    /** Sieste (couché ou sur l'herbe, sans saut de nuit): points de sommeil rendus par minute réelle. */
    napPerMinute: v.pipe(FiniteSchema, v.minValue(0), v.maxValue(20)),
  }),
  clock: v.strictObject({
    /** Secondes réelles par heure de jeu (cahier 4.3: 125). */
    secondsPerHour: v.pipe(FiniteSchema, v.minValue(10), v.maxValue(600)),
    dayStart: MinuteOfDay,
    nightStart: MinuteOfDay,
    /** Dormir à deux fait passer au lendemain à partir de cette heure. */
    sleepFrom: MinuteOfDay,
    /** Jours par saison (14). */
    seasonDays: v.pipe(IntSchema, v.minValue(7), v.maxValue(28)),
  }),
  movement: v.strictObject({
    /** Mètres par seconde. */
    walkSpeed: Positive,
    runSpeed: Positive,
    /** Rayon de collision d'un personnage (m). */
    radius: Positive,
    /** Temps pour atteindre la vitesse voulue et pour s'arrêter (s): accélération douce. */
    accelSeconds: Seconds,
    /** Temps pour s'arrêter (s): plus court que l'élan, le personnage ne glisse pas. */
    brakeSeconds: Seconds,
    /** En dessous, une commande de marche compte pour nulle. */
    deadzone: v.pipe(FiniteSchema, v.minValue(0), v.maxValue(0.5)),
    /** Coin de mur: décalage latéral essayé pour passer, pas et maximum (m). */
    cornerNudgeStep: Positive,
    cornerNudgeMax: Positive,
    /** Pris dans un obstacle et poussant sans avancer: dégagé après ce délai (s). */
    stuckSeconds: Seconds,
    /** Rayon de recherche d'une case libre (cases). */
    freeCellRadius: v.pipe(IntSchema, v.minValue(1), v.maxValue(32)),
    /** Marge entre un siège et le personnage qui se relève (m). */
    standUpGap: Seconds,
  }),
  reach: v.strictObject({
    /** Portée de la touche d'action (m) et demi-angle du cône de visée (degrés). */
    action: Positive,
    aimHalfAngleDeg: v.pipe(FiniteSchema, v.minValue(10), v.maxValue(180)),
    /** Poids de la distance face à l'écart à l'axe dans le choix de la cible (0: l'axe seul). */
    aimDistanceWeight: v.pipe(FiniteSchema, v.minValue(0), v.maxValue(1)),
    /**
     * Cône du regard (demi-angle, degrés), plus étroit que celui de la visée: ce qui s'y trouve
     * passe avant ce qui est seulement plus proche, à rang égal (défaut D3). Absent: pas de préférence.
     */
    aimLookHalfAngleDeg: v.exactOptional(v.pipe(FiniteSchema, v.minValue(1), v.maxValue(180))),
  }),
  gestures: v.strictObject({
    /** Aucune action courante ne bloque plus longtemps (note de ressenti: 1,5 s). */
    maxSeconds: v.pipe(FiniteSchema, v.minValue(0.2), v.maxValue(1.5)),
    pickSeconds: Seconds,
    /** Animation du ramassage au sol. */
    pickupClip: IdSchema,
    eatSeconds: Seconds,
  }),
  travel: v.strictObject({
    /** Heures de jeu ajoutées à l'horloge par un trajet. */
    clockHours: v.pipe(FiniteSchema, v.minValue(0), v.maxValue(12)),
    /**
     * Durée de la scène du trajet (quai, montée, train qui roule, arrivée), 12 s au plus; les deux
     * joueurs peuvent la passer plus tôt. Puis attente avant le message « l'autre charge encore ».
     */
    minSeconds: v.pipe(FiniteSchema, v.minValue(2), v.maxValue(12)),
    slowLoadSeconds: Seconds,
    /** Écart entre les deux joueurs à la descente du train (m), et durée de la descente (s). */
    arrivalSpread: Seconds,
    arrivalSeconds: Seconds,
    /** Départs permis entre ces deux heures. */
    from: MinuteOfDay,
    to: MinuteOfDay,
  }),
  dialogue: v.strictObject({
    /** Longueur maximale d'une réplique: trois lignes du bandeau. */
    maxChars: v.pipe(IntSchema, v.minValue(40), v.maxValue(400)),
    charsPerSecond: Positive,
    maxOptions: v.pipe(IntSchema, v.minValue(2), v.maxValue(4)),
  }),
});
export type Settings = v.InferOutput<typeof SettingsSchema>;
