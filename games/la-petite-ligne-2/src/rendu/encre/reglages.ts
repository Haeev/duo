/**
 * Réglages du rendu encré (ADR 0023): tout ce qui se règle sans toucher aux nuanceurs. Un seul
 * niveau de rendu pour le Mac et le PC: aucune de ces valeurs ne dépend de la machine. Les
 * ambiances (tons, encre, lampes, vignette) sont des données: `ambiances.json`.
 */
import { EDGE_SETTINGS } from '../lieu/reglages-lisieres';
import type { SurfaceKind } from '../lieu/reglages-tuiles';
import type { LayerName } from './couches';

/** Style du rendu: `encre` (défaut) ou l'ancien rendu en aplats, gardé le temps de la transition. */
export type RenderStyle = 'encre' | 'aplats';

/** Règle de conversion d'un modèle livré: une teinte (degrés) et une saturation donnent une couche. */
export interface LayerRule {
  /** Teinte de 0 à 360 (intervalle fermé; `from` > `to` passe par 360). */
  readonly hue: readonly [number, number];
  /** Saturation minimale (0 à 1) et clarté maximale (0 à 1) pour que la règle s'applique. */
  readonly minSaturation: number;
  readonly maxLightness: number;
  readonly layer: LayerName;
  /** Feuillage: l'ombre se dentelle, le dessous se noircit, le vent le fait frémir. */
  readonly leafy?: boolean;
}

export const INK_SETTINGS = {
  /** Style au démarrage; `?rendu=aplats` dans l'adresse du jeu, ou `RenderOptions.style`. */
  style: 'encre' as RenderStyle,

  /** Paramètre d'adresse qui force un style (recette, comparaison). */
  styleParam: 'rendu',

  /**
   * Caméra du style encré (règle du client): 50 degrés de plongée au zoom de jeu et au-delà, la
   * caméra s'abaisse en zoomant plus près (les visages se voient), zoom de jeu de 18 m de large.
   */
  camera: {
    minWidth: 6,
    maxWidth: 28,
    defaultWidth: 18,
    pitchFarDeg: 50,
    pitchNearDeg: 35,
    /** Largeur à partir de laquelle la plongée est entière (m). */
    pitchFullWidth: 18,
    /**
     * Petit lieu clos (ambiance `indoor` de son `lieu.json`, sol déclaré): à l'arrivée, la vue
     * se cadre pour que son plancher occupe cette part de la largeur de l'écran (`cadrage.ts`).
     */
    closedShare: 0.6,
  },

  /** Passe de contour: demi-épaisseur du trait en points d'écran à 768 points de haut. */
  outline: {
    radius: 1.55,
    referenceHeight: 768,
    /** Le trait épaissit en zoomant: facteur `zoomWidth / largeur de vue`, borné. */
    zoomWidth: 18,
    zoomRange: [0.75, 1.7] as const,
    /** Tremblé du trait, en part de son épaisseur. */
    wobble: 0.7,
    /** Un rang de trait apparaît quand ce qu'il cerne dépasse `fadeFrom` points, plein à `fadeTo`. */
    fadeFrom: 12,
    fadeTo: 28,
    /** Taille représentative de chaque rang (m): de la maison au bouton de porte. */
    rankMetres: [4, 1.6, 0.6, 0.25, 0.14] as const,
  },

  /**
   * Détail selon le zoom, en points d'écran par mètre: nul sous `from`, plein à `to`. Trait peint
   * des textures, hachures et gravillons, plis des personnages.
   */
  detail: {
    painted: { from: 45, to: 85 },
    hatch: { from: 30, to: 70 },
    face: { from: 34, to: 80 },
  },

  /** Ombre du soleil: une carte de profondeur cadrée sur la vue, calée sur ses texels. */
  sunShadow: {
    size: 2048,
    /** Recul de la caméra d'ombre (m), plans de coupe, marge autour du cercle vu (m). */
    distance: 90,
    near: 10,
    far: 170,
    margin: 6,
    /** Rayon maximal couvert (m): au-delà (vue haute de contrôle), l'ombre s'arrête au cadre. */
    maxRadius: 34,
    /**
     * Volumes écartés de la passe (`StageSort`): ceux dont l'ombre ne peut tomber nulle part dans
     * le champ. On suit les rayons du soleil jusqu'à `cullFloor` (m, sous le fond de l'eau), et
     * jamais moins raide que `cullMinSine` (sinus de la hauteur du soleil): au ras de l'horizon,
     * la longueur est bornée par le cadre de la carte.
     */
    cullFloor: -0.7,
    cullMinSine: 0.05,
    /**
     * Rayon (m) de la sphère d'un personnage autour de la racine de son squelette, pour l'écarter
     * des passes quand il est hors du champ (Three.js le dessine sinon toujours, partout dans le
     * lieu): tout le corps y tient, debout, assis ou couché.
     */
    characterRadius: 1.6,
  },

  /**
   * Pièce à fenêtres (ambiances `piece`): le soleil y suit l'heure, mais jamais plus haut que
   * `maxElevationDeg`, pour que la nappe de lumière d'une fenêtre entre dans la pièce même à midi.
   */
  roomSun: { maxElevationDeg: 40 },

  /** Ombre de la lampe la plus proche du joueur local: une seule carte en cône. */
  lampShadow: { size: 512, fovDeg: 130, near: 0.28 },

  /** Lampes et fenêtres retenues autour du point visé (les plus proches), et portée de recherche (m). */
  lights: { reach: 26, lampRadius: 5.2, lampHeightShare: 0.86, windowReach: 3.4 },

  /**
   * Allumage du dehors, un seul réglage pour les lampes et les fenêtres, selon la force des
   * lampes de l'ambiance (0 le jour, 1 la nuit). Lampes: rien sous `from`; chaque lampe a son
   * rang (tiré de son identifiant) et s'allume entre `from + rang x spread` et `ramp` plus loin.
   * À la tombée du jour elles s'allument l'une après l'autre, à l'aube elles s'éteignent de même.
   * Fenêtres: leur lueur (et la lumière qu'elles posent dehors) ne commence que quand la
   * dernière lampe est pleinement allumée, et monte sur `windowRamp` (revue du 2026-11-11: une
   * rue aux fenêtres allumées sous un réverbère éteint). Avec l'ambiance livrée: lampes de 17 h 50
   * à 18 h 35, fenêtres de 18 h 35 à 18 h 55; le matin, fenêtres éteintes avant les lampes.
   */
  lamps: { from: 0.3, spread: 0.2, ramp: 0.1, windowRamp: 0.1 },

  /**
   * Bâtiments éclairés de l'intérieur (`lieu/eclairage.ts`): d'après les heures des commerces, les
   * plannings des habitants et l'`eclairage` des fiches de bâtiments, sans aucun bâtiment nommé.
   */
  buildingLights: {
    /** Durée de l'allumage ou de l'extinction d'un bâtiment (s). */
    fadeSeconds: 2.5,
    /** Activités de planning où l'habitant dort (en plus d'une ligne tenue dans un lit). */
    asleep: ['dormir'] as readonly string[],
    /**
     * On ne s'endort pas en passant la porte: la chambre reste éclairée entre `bedtime[0]` et
     * `bedtime[1]` minutes après l'heure du coucher (durée tirée de l'identifiant de l'habitant).
     */
    bedtime: [15, 50] as const,
    /** Un habitant à moins de `doorReach` mètres d'une porte est chez celui dont c'est la porte. */
    doorReach: 3,
    /** Une lampe à moins de `attachReach` mètres d'une façade est portée par ce bâtiment. */
    attachReach: 0.35,
    /** Hauteur où commence l'étage d'un bâtiment à plusieurs niveaux (m au-dessus de son pied). */
    upperFrom: 2.7,
  },

  /**
   * Lampes des modèles livrés sans lumière déclarée au manifeste (`light`), par famille: hauteur
   * du foyer en part de la hauteur du modèle, rayon de la flaque (m). Une famille absente
   * n'éclaire pas. Un modèle de la chaîne des décors déclare sa lumière lui-même (`lumiere` de
   * son entrée, voir le README): rien à ajouter ici.
   */
  lampFamilies: {
    reverbere: { heightShare: 0.86, radius: 5.2, shadow: true },
    lampe: { heightShare: 0.82, radius: 3.6, shadow: true },
    applique: { heightShare: 0.92, radius: 3.4, shadow: false },
  } as Readonly<Record<string, { heightShare: number; radius: number; shadow: boolean }>>,

  /** Sol: couche de traits par surface entendue, et sols « durs » dont le bord reste droit. */
  ground: {
    layers: {
      herbe: 'grass',
      terre: 'dirt',
      pave: 'slab',
      gravier: 'ballast',
      bois: 'wood',
      sable: 'dirt',
      eau: 'plain',
      tapis: 'plain',
    } as Readonly<Record<SurfaceKind, LayerName>>,
    /**
     * Surfaces au motif serré: leur couche de traits est lue `fineScale` fois plus petite (une
     * dalle de quai fait 0,6 à 0,9 m, pas 2 m).
     */
    fine: ['pave'] as readonly SurfaceKind[],
    fineScale: 2.3,
    /** Surfaces posées par l'homme: leur bord n'ondule pas. */
    hard: ['pave', 'bois', 'tapis'] as readonly SurfaceKind[],
    /** La table (sol hors des tuiles, plancher des pièces) passe juste sous le sol des tuiles (m). */
    tableDrop: 0.012,
    /**
     * Tremblé du bord entre deux natures de sol (m, écart maximal): le trait d'encre n'est pas
     * tiré à la règle. La forme de la frontière vient des limites adoucies (`lisieres.ts`), dont
     * `EDGE_SETTINGS.ragged` réserve cet écart.
     */
    warp: EDGE_SETTINGS.ragged,
    /** Sol d'un lieu sans terrain (lieux d'essai): un pré. */
    fallback: { color: '#A3B659', layer: 'grass' as LayerName },
    /** Écart des trois tons de l'herbe autour de sa teinte (clair, sombre). */
    grassTones: [1.09, 0.87] as const,
    /**
     * Sol en relief: poids de la pente vraie dans le choix du ton (clair vers le soleil, sombre à
     * l'opposé). À 2,5, une pente de 5 % suffit à changer de ton: un talus de chemin se lit.
     */
    slopeTone: 2.5,
    /**
     * Hachures courtes du sol à l'ombre (revue du 2026-11-11: « le sol reste en aplats »): une
     * touffe de deux ou trois traits dans `share` des cases d'une grille de `cell` m ancrée au
     * monde; longueur d'un trait et écart entre deux (m), force de l'encre (0 à 1). Calcul dans
     * le nuanceur, sans texture ni passe. Rien dedans, ni sur un sol au soleil.
     */
    ticks: { cell: 1.1, share: 0.45, length: 0.42, gap: 0.075, strength: 0.85 },
    /**
     * Fond des joints d'un dallage à l'ombre: part relevée vers le demi-ton (0: noir comme le
     * reste de l'ombre). Les joints restaient presque noirs et mangeaient les hachures courtes.
     */
    jointLift: 0.6,
  },

  /**
   * Eau: tons des plages et vitesse de leur glissement (lent: une rivière de plaine); frange
   * plus claire le long des berges (`shore`: largeurs en mètres de la frange vive et du haut-fond,
   * `shallow`: ton du haut-fond, `rim`: teinte de l'eau claire, `rimShare`: sa part dans la frange).
   */
  water: {
    light: 1.14,
    dark: 0.84,
    speed: 0.22,
    shore: [0.3, 0.95] as const,
    shallow: 1.13,
    rim: '#b5dcd9',
    rimShare: 0.5,
  },

  /** Personnages: teintes poussées (1: inchangées) pour qu'ils se lisent de haut. */
  character: { saturation: 1.18, gain: 1.06 },

  /**
   * Conversion automatique des modèles livrés: la couche de traits d'un morceau se tire de sa
   * teinte moyenne (première règle qui convient, sinon `fallback`). Un nouvel objet en profite
   * sans une ligne de code.
   */
  models: {
    rules: [
      { hue: [70, 170], minSaturation: 0.18, maxLightness: 0.75, layer: 'leaf', leafy: true },
      { hue: [10, 50], minSaturation: 0.16, maxLightness: 0.62, layer: 'grain' },
      { hue: [0, 360], minSaturation: 0, maxLightness: 1, layer: 'face' },
    ] as readonly LayerRule[],
    fallback: 'plain' as LayerName,
    /** Écart en dessous duquel deux sommets sont le même point (m): les morceaux se comptent ainsi. */
    weld: 0.001,
    /** Au-delà de ce nombre de morceaux, les plus petits partagent un numéro (63 au plus). */
    maxParts: 62,
    /**
     * Vitres des modèles livrés: dans les familles listées, un morceau bleu (verre sombre ou son
     * reflet peint) devient une vitre qui suit l'heure (ciel pâle le jour, reflets des lampes
     * la nuit). Le wagon n'avait que des vitres de nuit, même au matin (revue du 2026-11-11).
     */
    glass: {
      families: ['paroi-voiture', 'porte-voiture'] as readonly string[],
      rule: {
        hue: [195, 250],
        minSaturation: 0.2,
        maxLightness: 0.75,
        layer: 'plain',
      } as LayerRule,
      /**
       * Dans ces familles, un morceau vert n'est pas du feuillage (la caisse verte du wagon
       * frémissait au vent et dentelait son ombre): il prend cette règle, un panneau de bois peint.
       */
      body: { hue: [0, 360], minSaturation: 0, maxLightness: 1, layer: 'grain' } as LayerRule,
    },
  },

  /**
   * Bâtiments livrés: couche de traits d'après le NOM du matériau du modèle (la teinte reste
   * celle des sommets). `window`: vitre (reflet du ciel le jour, lueur la nuit).
   */
  materials: {
    pierre: { layer: 'face' },
    moellon: { layer: 'slab' },
    crepi: { layer: 'wall' },
    tuile: { layer: 'roof' },
    bois: { layer: 'grain' },
    bardage: { layer: 'wood' },
    volet: { layer: 'grain' },
    vitre: { layer: 'plain', window: true },
    metal: { layer: 'plain' },
  } as Readonly<Record<string, { layer: LayerName; window?: boolean }>>,

  /** Particules de l'air (un appel instancié): nombre et emprise autour du point visé (m). */
  motes: { count: 90, span: 26 },

  /**
   * Souffle: quand le rendu est saturé (rendu logiciel des tests et du banc: plus de
   * `slowMs` entre deux images), on saute autant d'images que de `slowMs` perdus (`maxSkip` au plus). Les appels WebGL en
   * attente bloquent le fil principal; sans ces images sautées, minuteries et réseau n'ont plus
   * la main et le jeu passe pour bloqué. Jamais atteint sur une vraie carte graphique.
   */
  breath: { slowMs: 250, maxSkip: 12 },

  /**
   * Lieu clos qui déclare son ambiance (`ambience` de `lieu.json`): part de la teinte de ses
   * lampes ajoutée dans leur flaque, et force plancher de ses lampes (elles restent allumées).
   */
  placeLamps: { gain: 0.78, minimum: 0.9 },

  /**
   * Étalonnage commun à toutes les ambiances: facteurs sur leur saturation et leur contraste.
   * 1 et 1: rien de plus que les ambiances validées. Une hausse légère (proposée: 1,08 et 1,04,
   * voir `essai-encre.md`, « Couleurs d'un écran à l'autre ») se décide avec le directeur
   * artistique: elle vaut pour les deux machines.
   */
  grade: { saturation: 1, contrast: 1 },

  /** Durée du passage d'une ambiance à l'autre quand le joueur entre ou sort (s). */
  indoorFadeSeconds: 0.6,

  /**
   * Résolution interne adaptative (ADR 0023, point 11): toujours le même rendu, calculé à une
   * échelle interne (part du côté du tampon du canevas) qui descend d'un palier quand la moyenne
   * des images dépasse le budget, et remonte quand il y a de la marge. Ce n'est pas un second
   * niveau de rendu: mêmes passes, mêmes effets, même composition; seule la finesse varie.
   */
  resolution: {
    /** `auto`: adaptative; `fixed`: figée à `fixedScale` (aussi `?echelle=0.8` dans l'adresse). */
    mode: 'auto' as 'auto' | 'fixed',
    fixedScale: 1,
    /** Paramètre d'adresse: `auto` ou une échelle de 0,5 à 1 (recette, comparaison). */
    param: 'echelle',
    /** Paliers, du plus fin au plus grossier. Jamais sous 70 % par défaut. */
    steps: [1, 0.85, 0.75, 0.7] as readonly number[],
    /** Budget d'une image (ms): le plancher de 30 images par seconde. */
    budgetMs: 33.4,
    /** On descend quand la moyenne dépasse `budgetMs * downRatio` pendant `downSeconds`. */
    downRatio: 1.04,
    downSeconds: 1.5,
    /**
     * On remonte quand le temps prévu au palier du dessus (moyenne x rapport des surfaces) reste
     * sous `budgetMs * upRatio` pendant `upSeconds`. Une remontée ratée (redescente dans les
     * `retrySeconds`) multiplie l'attente par `retryFactor`, jusqu'à `maxUpSeconds`: pas de va-et-vient.
     */
    upRatio: 0.8,
    upSeconds: 8,
    retrySeconds: 20,
    retryFactor: 2,
    maxUpSeconds: 240,
    /** Fenêtre de la moyenne (s), images ignorées (onglet caché, chargement), repos après un changement (s). */
    averageSeconds: 1.5,
    ignoreFrameMs: 250,
    cooldownSeconds: 3,
    /** Attente après l'arrivée dans un lieu (compilation des programmes, tuiles) avant de juger (s). */
    warmupSeconds: 4,
    /**
     * Unité des seuils de détail et de rang du trait, du pas des hachures des personnages et de
     * la taille des particules. `false` (défaut): le point du canevas, comme avant; l'échelle
     * interne n'y change rien, la composition reste la même à tous les paliers. `true`: le point
     * d'un écran de `referenceWidth` de large, quel que soit l'écran. Essayé et écarté le
     * 2026-11-10: sur un écran dense le trait peint, plus fin, pâlissait (montage
     * `encre-perf-ecran-dense.png`); l'ancien comptage donne le rendu le plus proche d'un écran
     * à l'autre.
     */
    sameOnEveryScreen: false as boolean,
    referenceWidth: 1366,
    /** Rendu logiciel (tests, banc de captures): l'échelle ne s'adapte pas, elle reste à 1. */
    softwareFixed: true as boolean,
    /**
     * Départ sur un processeur graphique intégré (nom lu par `WEBGL_debug_renderer_info`, Intel
     * chez le client): l'échelle adaptative part d'au plus `maxPixels` points internes au lieu
     * de la pleine définition du canevas (le PC de référence affichait 1920 x 1080 internes pour
     * un écran de 1536 x 864 points). Ses paliers s'appliquent ensuite à ce départ. Rien ne
     * change ailleurs (Mac, rendu logiciel), ni quand l'échelle est figée.
     */
    integrated: { match: 'intel', maxPixels: 1366 * 768 },
  },

  /**
   * Contexte du canevas en rendu encré (`inkContext`): préférence de processeur graphique, et
   * `desynchronized` (faible latence) laissé à faux: il change la composition selon le système.
   */
  canvas: {
    powerPreference: 'high-performance' as WebGLPowerPreference,
    desynchronized: false,
  },

  /**
   * Outil de mesure (ADR 0023, point 12): panneau ouvert par `F9`, par `Ctrl + Maj + M`, ou par
   * `?mesure=1` dans l'adresse. Rien n'est mesuré sur le processeur graphique tant qu'il est fermé.
   */
  meter: {
    param: 'mesure',
    key: 'F9',
    /** Rafraîchissement du panneau (ms). */
    refreshMs: 500,
    /** Histogramme des durées d'image: pas (ms) et nombre de cases (la dernière: tout le reste). */
    binMs: 0.5,
    bins: 400,
    /** Écart entre deux images au-delà duquel ce n'est plus du rendu (fenêtre cachée, chargement). */
    ignoreFrameMs: 1000,
  },

  /**
   * Budgets du style encré par vue (ADR 0022, bible 4.6, technique 3.10), toutes passes comprises.
   * Mémoire: celle que le rendu encré ajoute au lieu (couches de traits, cartes d'ombre, cibles).
   */
  budget: { triangles: 350_000, calls: 200, programs: 14, textureMegabytes: 64 },
} as const;

export type InkSettings = typeof INK_SETTINGS;
