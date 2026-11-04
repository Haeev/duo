/**
 * Réglages du rendu 3D: tout ce qui se règle à l'œil (caméra, terrain,
 * animations, effets, budgets). Aucune valeur de gameplay ici: elles restent
 * dans `donnees/reglages.json`. La lumière du jour, la météo, la brume et les
 * ombres sont dans `reglages-ambiance.ts` (technical artist).
 *
 * Couleurs en sRGB (`#rrggbb`), converties en linéaire par Three.js. Angles en
 * degrés, durées en secondes, distances en mètres (une case = 1 m).
 */

import type { BikeSettings, VillagerPropRule } from './accessoires';
import type { IdlePose } from './attentes';
import type { ToolHoldSpec } from './prise';
import type { ModelTrim } from './retouches';

/** Style des personnages: ombrage par face (validé), ou lisse avec rampe et contour (témoin, D1). */
export type CharacterStyle = 'facettes' | 'lisse';

/**
 * Éclaircie de la forêt du pourtour: sur le côté `side` de la carte, entre `from` et `to`
 * (cases le long de ce côté: y pour l'est et l'ouest, x pour le nord et le sud), la lisière
 * recule de `depth` cases, puis revient à sa place sur `feather` cases de part et d'autre, en
 * courbe douce (pas d'angle droit dans le bois). Son tracé ondule de `wobble` case au plus
 * (bruit lissé), pour qu'aucune rangée d'arbres ne paraisse coupée net. La densité suit la
 * distance à la lisière reculée, comme ailleurs: arbres épars devant, bois serré derrière.
 */
export interface ForestClearing {
  side: 'north' | 'south' | 'east' | 'west';
  from: number;
  to: number;
  depth: number;
  feather: number;
  wobble: number;
}

/**
 * Zone pavée de la place: anneau autour d'un objet de la carte (pavés posés en
 * cercles), ou bande droite de `a` à `b` (centres, m) de demi-largeur `half`.
 */
export type SquareShape =
  | { kind: 'ring'; model: string; radius: number }
  | { kind: 'band'; a: readonly [number, number]; b: readonly [number, number]; half: number };

/** Règle d'accessoire d'un habitant (`accessoires.ts`), champs absents à leur valeur neutre. */
function villagerProp(
  model: string,
  mount: VillagerPropRule['mount'],
  rule: Partial<Omit<VillagerPropRule, 'model' | 'mount'>>,
): VillagerPropRule {
  return {
    model,
    mount,
    walking: rule.walking ?? false,
    activities: rule.activities ?? [],
    habits: rule.habits ?? [],
    untracked: rule.untracked ?? false,
    stillClip: rule.stillClip ?? null,
  };
}

export const RENDER_SETTINGS = {
  renderer: {
    /** Rapport de pixels plafonné (Retina, mise à l'échelle de Windows). */
    maxPixelRatio: 2,
    /** Budget de la plateforme: 1920x1080 pixels physiques au plus sur le PC. */
    maxPhysicalPixels: 1920 * 1080,
    /**
     * Plancher de netteté (retour R07, Windows flou): la résolution dynamique
     * ne descend jamais sous `min(devicePixelRatio, minCrispRatio)` pixels de
     * rendu par point CSS, dans la limite du budget. Sous Windows à 100, 125
     * et 150 %, c'est le pixel physique de l'écran: aucun étirement, l'image
     * reste nette; sur un écran Retina (2), 1,5 pixel par point reste net.
     */
    minCrispRatio: 1.5,
    antialias: true as boolean,
    /** Tone mapping neutre (Khronos PBR Neutral): garde les teintes de la palette. */
    toneMapping: 'neutral' as 'neutral' | 'agx' | 'aces',
    exposure: 1.0,
  },

  /**
   * Portraits des habitants tirés des modèles 3D (0.13, `portraits.ts`): rendus une fois au
   * chargement, en buste de trois quarts, fond transparent.
   */
  portraits: {
    /** Côté de l'image en points CSS (doublé sur Retina). */
    size: 128,
    fov: 20,
    /** Trois quarts: le personnage tourné vers la gauche de l'image (rad, 0: de face). */
    yaw: 0.5,
    /** Caméra un peu au-dessus des yeux (rad). */
    pitch: 0.06,
    /** Instant de l'attente où le buste est posé (s), comme l'aperçu de la mercerie. */
    poseTime: 0.4,
    /** Sous le cou, ce qui compte encore pour la largeur du cadre (bords de chapeau, chignon), en m. */
    shoulderDrop: 0.02,
    /** Hauteur du cadre: hauteur de la tête au-dessus du cou, multipliée par ce facteur (épaules comprises). */
    heightOverHead: 1.75,
    /** Air au-dessus du chapeau (m). */
    margin: 0.07,
    /** Largeur du cadre: largeur de la tête et de son chapeau, multipliée par ce facteur. */
    widthMargin: 1.12,
    light: { sky: 1.5, key: 1.9, rim: 0.6 },
  },

  camera: {
    /** Largeurs de vue des trois zooms (cahier, section 4.15). */
    viewWidths: [16, 24, 36] as const,
    initialZoom: 1,
    /** Azimut de la première orientation (caméra au sud-est, regard vers le nord-ouest). */
    firstAzimuthDeg: 45,
    /** Isométrie vraie: arctan(1 / racine de 2). */
    elevationDeg: 35.264,
    distance: 80,
    near: 1,
    far: 220,
    rotateSeconds: 0.3,
    zoomSeconds: 0.2,
    /** Demi-vie du suivi du personnage: plus court, plus collé. */
    followHalfLife: 0.12,
    /** Anticipation dans le sens de la marche, à pleine vitesse. */
    lookAhead: 0.7,
    lookAheadHalfLife: 0.35,
    /** Vitesse de marche de référence pour l'anticipation (m/s). */
    lookAheadSpeed: 3.5,
    /** Marge laissée au bord de la carte quand on la longe. */
    edgeMargin: 2,
    /** Tremblement par trauma: amplitude en mètres et décroissance par seconde. */
    shakeAmplitude: 0.18,
    shakeDecay: 1.6,
    shakeFrequency: 23,
  },

  /** Lueur nocturne des fenêtres et des lampes (texture d'émission de la palette). */
  nightGlow: 1.3,

  terrain: {
    /** Hauteurs des sols (m). L'eau est en creux, le quai en relief. */
    heights: {
      grass: 0,
      path: 0,
      dirt: 0,
      // Berges de sable et de galets à la hauteur de l'herbe: le bord entre les deux est une
      // teinte qui ondule (`river.sandWobble`), plus une marche droite le long des cases.
      gravel: 0,
      // Dessus du platelage des traversées (passage à niveau, traversée de service): 1,5 cm sous le
      // champignon du rail (0,38 m: voie posée à 0,06 m, `rail_top` de 0,32 m). Les personnages y
      // marchent à cette hauteur; la rampe de terre (`crossing.rampLength`) rattrape la route.
      wood: 0.365,
      // Cases `s` (sol de bâtiment): entre les dalles des modèles (0,08 de la chambre, 0,10 de la
      // salle à manger de la pension et de la mercerie, 0,11 du cellier, 0,12 des pièces), à 1 cm
      // au moins de chacune. À 0,12, case et dalle se battaient à chaque image (retour R02).
      floor: 0.09,
      water: -0.42,
      rail: 0.06,
      // Pavés et terre battue de la place au ras des chemins (tour 8): une bordure droite de
      // 4 cm le long des cases traçait le bord de la terre battue au cordeau.
      stone: 0,
    },
    waterSurface: -0.16,
    /**
     * Ordre fixe des couches de sol (retour R02, 2026-11-03: sols qui scintillent). Deux surfaces
     * qui peuvent se recouvrir ne sont jamais à moins de `minGap` m l'une de l'autre: le tampon de
     * profondeur les départage à toutes les distances de caméra (vue orthographique, de 1 à 220 m;
     * même avec un tampon de 16 bits, 3,4 mm le long du regard), sans `polygonOffset` à régler par
     * matériau. Contrôle: `src/rendu/couches-sol.test.ts`. Le terrain ne dessine pas son dessus sous
     * un sol posé (quai, ponton, pont de la rue): leur modèle couvre l'emprise, pied des rampes à 0.
     * De bas en haut:
     * - 0: herbe, chemins, terre, pavés, terre battue, grève (un seul maillage, une case un sol);
     * - 0,02 à 0,03: cours et tabliers des modèles (cour de l'école, pont de la rue);
     * - 0,08: dalle de la chambre (modèle);
     * - `heights.floor` (0,09): cases de bâtiment;
     * - 0,10 à 0,12: dalles des bâtiments (modèles), seuils des portes;
     * - `roomFloors`: planchers des pièces où l'on entre, où se posent pieds, meubles et tapis
     *   (tapis: 6 mm et plus au-dessus du plancher, dans le modèle).
     */
    minGap: 0.004,
    /**
     * Plancher de chaque pièce visitable (m, lu dans les nœuds `*_floor` des modèles par le test):
     * personnages et meubles s'y posent, pas sur la case de bâtiment dessous.
     */
    roomFloors: {
      house_main: 0.14,
      house_cellar: 0.12,
      house_bedroom: 0.12,
      grocery_shop: 0.122,
      salon_room: 0.12,
      // 0.13 (`village013.glb`): église, café, forge, menuiserie, logis de la ferme, moulin.
      church_nave: 0.122,
      church_choir: 0.12,
      cafe_room: 0.12,
      forge_workshop: 0.12,
      joinery_workshop: 0.12,
      farmhouse_hall: 0.12,
      mill_millstones: 0.12,
    } as Readonly<Record<string, number>>,
    /**
     * Platelage des traversées (revue du directeur artistique, tour 5): lames
     * dans le sens des rails, posées sur les traverses, sur toute la largeur de
     * la route; ornière sombre le long de la face intérieure de chaque rail;
     * rampe de terre de chaque côté où la route est plus basse. Distances en
     * mètres, en travers de la voie depuis son axe sauf mention contraire.
     */
    crossing: {
      /** Rails à cette distance de l'axe de la voie (voie métrique du modèle `rail_straight`). */
      railOffset: 0.5,
      /** Largeur du champignon du rail. */
      railHeadWidth: 0.06,
      /** Ornière: fente le long de la face intérieure du rail (passage du boudin des roues). */
      flangeway: 0.07,
      /** Jeu entre la face extérieure du rail et la première lame. */
      outerClearance: 0.01,
      /** Bande de planches à l'extérieur de chaque rail. */
      outerBand: 0.45,
      /** Largeur visée d'une lame (pas des lames, chanfreins compris): 20 à 25 cm. */
      plankWidth: 0.22,
      /** Épaisseur visible des lames au-dessus du fond de l'ornière (au-dessus des traverses, à 0,28 m). */
      plankThickness: 0.035,
      /** Chanfrein des arêtes du dessus des lames, bouts compris (un segment). */
      chamfer: 0.015,
      /** Rampe de terre de la route jusqu'au dessus des planches. */
      rampLength: 1.25,
      /**
       * Tons des lames, de l'une à la suivante (repris en boucle, décalé d'une
       * traversée à l'autre). Un seul ton: `wood_old`, gris, se lisait comme une
       * autre matière au milieu du bois; les joints suffisent à marquer les lames.
       */
      plankTones: ['wood'] as const,
      /** Fond des ornières et des fentes autour du rail. */
      grooveTone: 'shadow' as const,
      /** Bouts du platelage côté voie (sous les lames, jusqu'au ballast). */
      endTone: 'wood_dark' as const,
      rampTone: 'path' as const,
      /** Talus des bords de la rampe (vers le ballast et les bas-côtés). */
      rampSideTone: 'bank' as const,
      /** Pente des talus: mètres à l'horizontale par mètre de hauteur (1 pour 1). */
      talusRun: 1,
      /**
       * Lame qui borde un rail (le long de l'ornière): toujours ce ton. `wood_old`
       * est gris (#908879): contre le rail, il se lisait comme une bande de
       * ballast de 20 cm au lieu de la fente sombre (revue du directeur
       * artistique, tour 5).
       */
      railSideTone: 'wood' as const,
    },
    /** Taille des taches d'herbe (bruit lisse), en mètres. */
    grassPatchScale: 5.5,
    /** Sol au-delà de la carte, pour ne jamais voir le vide. */
    outerSize: 400,
    outerDrop: 0.01,
    /** Subdivision des cases d'eau pour les vaguelettes. */
    waterSubdivisions: 2,
    waterOpacity: 0.82,
    waveAmplitude: 0.025,
    waveSpeed: 1.3,
    waveLength: 3.2,
    /**
     * Coins des chemins arrondis (bible, 8.7): rayon (m) et segments du quart
     * de cercle (un tous les 25 cm environ). Entre sols dont la hauteur diffère
     * d'au plus `cornerMaxStep` (m): le coin rogné prend la hauteur de la case,
     * la marche de quelques centimètres reste droite au bord.
     */
    cornerRadius: 0.5,
    cornerSegments: 3,
    cornerMaxStep: 0.05,
    /**
     * Semis au zoom large: à partir de cette largeur de vue (m; zooms de 16, 24
     * et 36 m), seule cette part des touffes, fleurs et galets est dessinée.
     */
    scatterFarViewWidth: 30,
    scatterFarShare: 0.5,
    /**
     * Morceaux de décor fusionnés (élimination hors champ, dans la vue et dans
     * la passe d'ombre): cases de `chunkSize` m. Une case de moins de
     * `chunkMergeBelow` triangles rejoint les autres petites cases de son bloc
     * de `chunkMergeBlock` x `chunkMergeBlock` cases: découpage fin autour des
     * bâtiments, peu d'appels de dessin pour les lampadaires et les clôtures.
     */
    chunkSize: 12,
    // ADR 0016: un bloc regroupé déborde peu du cadre. Sans regroupement (bloc de 1), la vue de la
    // place passe de 147 à 174 appels; on garde des blocs de 2 x 2 morceaux, mais seuls les morceaux
    // de moins de 1 500 triangles s'y regroupent (un bloc pèse au plus 6 000 triangles, contre 12 000).
    chunkMergeBlock: 2,
    chunkMergeBelow: 1500,
    /**
     * Sol, eau, semis et arbres de la lisière (ADR 0016, tour 10): morceaux de `surfaceChunk` m,
     * éliminés hors du cadre (aucun maillage ne grandit avec la carte). Mesuré à 12 m: 21 morceaux
     * de sol, 14 de touffes et 12 de fleurs dans la vue de la place (187 appels, budget 150);
     * sol, eau et lisière à 32 m (moins d'appels, presque les mêmes triangles); les semis par 24 m
     * (à 48 m: 37 000 triangles de végétation au lieu de 25 000 dans la même vue).
     */
    surfaceChunk: 32,
    scatterChunk: 24,
    /** Arbres de la lisière (une trentaine, trois modèles): par morceaux de 48 m (deux lots par modèle au plus en vue). */
    edgeTreeChunk: 48,
    /** Galets des berges (1 200 triangles pour toute la carte) et fleurs: par grands morceaux. */
    pebbleChunk: 48,
    /** Tronçons de la forêt du pourtour (m): à 24 m, +12 000 triangles dans la vue de la place. */
    forestSegment: 12,
    /** Tronçons de la forêt du pourtour et des rails (m): éliminés hors du cadre. */
    stripSegment: 12,
    /**
     * Ru de la Côte (tour 10, `ru.ts`): creux à berges raides, eau vive peu profonde (1,3 à 1,5 m
     * d'eau entre les berges, 30 cm de fond). Parts de la demi-largeur du creux: `crest` (fin de la
     * crête arrondie, `crestDrop` m sous le haut), `toe` (pied de la berge, `toeRise` m au-dessus du
     * fond). Le creux ondule (`wobbleScale` m) en largeur et en axe. Géométrie par pas de `step` m
     * le long du ru et `across` points en travers; surface de l'eau à la hauteur de la rivière (le
     * ru s'y jette sans marche).
     */
    stream: {
      bed: -0.46,
      crest: 0.78,
      crestDrop: 0.1,
      toe: 0.5,
      toeRise: 0.06,
      edgeBlend: 0.06,
      wobbleScale: 3.5,
      widthWobble: 0.05,
      axisWobble: 0.07,
      step: 0.5,
      across: 17,
      /** Galets du fond: un tous les `pebbleSpacing` m environ, une part affleure (écume autour). */
      pebbleSpacing: 0.7,
      pebbleSize: [0.1, 0.22] as const,
      /** Courant vif (traînées et facettes du shader de l'eau) et profondeur vue par l'eau (m). */
      riffle: 0.75,
      shaderDepth: 0.16,
      /** Vitesse du courant du ru par rapport à celle de l'Aubrune (eau vive: plus vite). */
      flowFactor: 1.6,
    },
    /**
     * Bief du moulin (0.13, `bief.ts`): même creux que le ru, eau plus calme (le meunier règle le
     * débit à la vanne), courant vers l'est; bandes d'eau en travers du bief; teinte du large
     * (`fieldDepth`: étroit, il paraissait une flaque claire). Les eaux dormantes d'au plus
     * `basinMaxCells` cases (bassin de la source, mare de la pâture) sont creusées de même, sans courant.
     * Budget: `across` points en travers (17 pour le ru), et le bief ne court que `bandReach` m au-delà
     * du bord de la carte (la forêt du pourtour le cache plus loin).
     */
    millrace: { riffle: 0.3, shaderDepth: 0.22, flowFactor: 1.2, waterStrips: 6, fieldDepth: 0.75, basinMaxCells: 12, pondFlow: 0.15, across: 9, bandReach: 8 },
    /** Bande de terrain prolongée au-delà de la carte (rivière, voie, forêt du pourtour). */
    extension: 26,
    /**
     * Fond du gué: un haut-fond de galets 8 cm sous la surface (on y passe les pieds dans
     * l'eau, comme le dit le pas « eau » de la carte; le héron y a de l'eau aux pattes).
     * Une seule surface pour toute la rivière: plus de lame d'eau surélevée sur le gué.
     */
    fordBed: -0.24,
    /**
     * Pierres plates du gué (bible, 8.7; revue du tour 8): côtés (un modèle par
     * nombre), épaisseur, saillie au-dessus de la surface (m: le courant
     * s'ouvre autour d'elles). `gue.ts` les pose.
     */
    fordStones: {
      sides: [5, 6, 7] as readonly number[],
      thickness: 0.13,
      protrude: 0.05,
      /** Les pierres à fleur d'eau: dessus sous la surface de tant (m), sous l'eau claire. */
      flushBelow: 0.015,
      /**
       * Ligne de passage, du bout du chemin nord à celui du chemin sud (là où l'on
       * traverse): nombre de pierres, pas d'axe en axe (m), taille (m), retrait
       * depuis le bord du gué (m), sinuosité (m, nombre de demi-ondes) et désordre (m).
       */
      passage: {
        count: [8, 10] as const,
        pitch: [0.55, 0.65] as const,
        size: [0.45, 0.6] as const,
        margin: 0.3,
        sway: 0.1,
        swayWaves: 1.5,
        jitter: 0.06,
      },
      /**
       * Pierres dispersées autour (tirage de Poisson, pas de grille): nombre,
       * taille (m), écart minimal entre deux pierres et avec la ligne (m),
       * chance d'être gardée à l'aval et à l'amont de la ligne, part à fleur
       * d'eau, retrait du bord du gué (m), essais. Rien sur la place du héron
       * (il pêche au bord aval du gué).
       */
      scatter: {
        count: 18,
        size: [0.2, 0.4] as const,
        gap: 0.22,
        lineGap: 0.32,
        downstreamOdds: 1,
        upstreamOdds: 0.4,
        flushShare: 0.35,
        inset: 0.15,
        attempts: 600,
        keepClear: ['heron_stand'] as readonly string[],
        clearRadius: 0.35,
        /** Jamais quatre pierres dispersées à moins de tant (m) d'une même droite. */
        alignTolerance: 0.06,
      },
    },
    /**
     * Lit de la rivière (technical artist, tour 8, `riviere.ts`): forme visible
     * des berges et du gué sur une grille fine, sans changer la grille de la
     * simulation. Distances en mètres.
     */
    river: {
      /** Nœuds de la grille fine par mètre (texture des shaders), et quadrillage de la géométrie par case. */
      texelsPerMeter: 8,
      subdivisions: 4,
      /**
       * Ligne d'eau: entre `shoreMin` et `shoreMax` du bord des cases sèches, côté eau
       * (les cases de berge, où l'on marche, restent au sec), selon un bruit de
       * `shoreNoise` m le long de la rive. La pente se prolonge sous l'eau d'autant.
       */
      shoreMin: 0.18,
      shoreMax: 0.7,
      shoreNoise: 2.4,
      /** Rayon du flou des distances signées: les angles des anses et des langues de sable s'arrondissent. */
      roundRadius: 1.4,
      /** Borne des distances signées avant le flou (m): une rive lointaine n'attire pas la ligne d'eau. */
      signedClamp: 3,
      /** Le haut de la berge rejoint l'herbe sur cette largeur (m). */
      crestRun: 0.4,
      /** Le haut-fond du gué retombe vers les fosses sur cette largeur (m), avec un relief de galets (m). */
      fordRamp: 1.4,
      fordBedNoise: 0.012,
      /** Courant vif: sur le gué, puis il s'éteint sur cette distance (m). */
      riffleReach: 1.6,
      /** Bord du sable et de l'herbe: écart (m) de part et d'autre du bord des cases, taille du bruit (m). */
      sandWobble: 0.32,
      sandNoise: 1.8,
      /**
       * Pierres rondes des rives (bible, 8.7: « deux niveaux de pierres
       * arrondies »): un rang au ras de l'eau, à demi noyé, que le courant a
       * déchaussé, et un rang de plus petites un peu plus haut sur la pente,
       * laissées par les crues. Un point tous les `spacing` m le long de la ligne
       * d'eau; chance d'y trouver une pierre et taille (m) de chaque rang.
       */
      stones: {
        spacing: 0.55,
        lowChance: 0.5,
        lowSize: [0.16, 0.3] as const,
        highChance: 0.28,
        highSize: [0.09, 0.16] as const,
        /** Le rang haut est à cette hauteur au-dessus de l'eau (m). */
        highAbove: 0.08,
        /** Pas de pierres au-delà de `margin` cases du bord de la carte (on ne les voit pas). */
        margin: 6,
        /** Pas de pierres à moins de cette distance (m) du gué et des sols posés (ponton): on y passe. */
        clearance: 1.2,
      },
      /**
       * Roseaux (bible, 8.7: « quelques roseaux »): seulement sur la rive nord,
       * au fond des anses où l'eau dort (là où ils poussent), loin du gué et du
       * ponton où l'on passe; jamais sur la rive sud, au premier plan de la
       * caméra (la carte veut une rive sud basse, rien qui cache la rivière).
       * Centre de la touffe (m; elle se pose sur la ligne d'eau la plus proche), nombre de tiges.
       */
      reeds: [
        // Anse en amont du gué, entre la langue de sable de l'ouest et le gué: eau calme avant le radier.
        { x: 11.2, y: 38.2, stems: 9 },
        { x: 13.4, y: 38.3, stems: 6 },
        // Anse à l'est du ponton, au pied du pré: loin du banc de la berge et du ponton.
        { x: 50.6, y: 38.2, stems: 8 },
        { x: 52.4, y: 38.3, stems: 6 },
      ] as readonly { x: number; y: number; stems: number }[],
      /** Tige de roseau: hauteur (m, de la plus petite à la plus grande), rayon au pied (m). */
      reedHeight: [0.55, 0.9] as const,
      reedRadius: 0.018,
    },
    /**
     * Place du bourg (revue du directeur artistique, tours 4 à 7; bible, 8.7):
     * pavés seulement là où un vrai bourg en poserait, terre battue ailleurs
     * (l'est de la place reste dégagé pour les fêtes: un sol de foire).
     * Le shader pose les pavés entiers: le bord de la zone pavée suit leurs joints.
     */
    square: {
      paved: [
        /*
         * Autour du puits, en anneaux: l'eau qu'on y renverse ferait de la boue. Le
         * pavage tourne autour de la margelle (pavés posés en cercles).
         */
        { kind: 'ring', model: 'well', radius: 2.7 },
        /*
         * Devant l'épicerie, sur toute la façade (x 31): on y attend au comptoir, on
         * décharge les caisses à la porte, la tonnelle du souper y est posée.
         */
        { kind: 'band', a: [32.6, 23.2], b: [32.6, 32.8], half: 1.9 },
        /* Du puits à la porte d'Odette (30, 30): le chemin des seaux de l'épicerie. */
        { kind: 'band', a: [37.6, 28.4], b: [32.6, 30.2], half: 0.85 },
        /* Du puits à la rue de la Gare (au nord): on y vient de la halte et des maisons. */
        { kind: 'band', a: [40, 26], b: [40, 22.5], half: 0.9 },
      ] as readonly SquareShape[],
      /** Hors de la place (rue de la Gare, quai): tout est pavé. Rangs: pas (m), longueur d'un pavé (m). */
      rowPitch: 0.22,
      stoneLength: 0.3,
      /** La place elle-même (cases de pavés de la carte dans ce rectangle): pavés selon `paved`, terre battue ailleurs. */
      area: { x: 31, y: 23, w: 18, h: 11 },
      /**
       * Bord des zones pavées de la place (revue du tour 8): un bourg finit un pavage par
       * un rang de boutisses (pavés posés en travers) sur un bord en courbe douce, pas en
       * marches d'escalier. Largeur du rang (m, la longueur d'un pavé posé en travers),
       * largeur d'une boutisse le long du bord (m), rayon des raccords entre zones (m).
       * La rue de la Gare (au nord de la place, pavée en entier) a le même rang côté place;
       * contre le chemin du sud, le pavage s'arrête droit sur son rang.
       */
      border: { width: 0.3, stoneWidth: 0.19, fillet: 0.9 },
      /**
       * Limite sud de la terre battue contre le chemin: pas de bordure (une place de foire
       * en terre rejoint le chemin sans rien entre les deux), mais une limite ondulée de
       * `amplitude` m (longueur d'onde `wavelength` m, comme la ligne d'eau des berges), qui
       * s'éteint sur `fade` m aux deux bouts de la place.
       */
      earthEdge: { amplitude: 0.25, wavelength: 2.4, fade: 1.5 },
    },
    /** Touffes d'herbe et fleurs semées sur l'herbe (part des cases). */
    tuftDensity: 0.32,
    flowerDensity: 0.07,
    /**
     * Sous-bois (0.13, cases `undergrowth`): ni fleurs ni touffes des prés, des fougères de l'artiste
     * (`fern`, `fern_small`, sans ombre, cuites par morceau); la litière et la mousse sont peintes par
     * le shader des surfaces. Part des cases, et part des grandes fougères parmi elles.
     */
    undergrowth: { fernDensity: 0.09, largeFernShare: 0.25 },
    /** Arbres du pourtour: densité selon la distance au bord (cases). */
    outerTreeDensity: 0.22,
    outerTreeStart: 2,
    /**
     * Éclaircies de la forêt du pourtour (level designer, tour 7): là où un moment se joue au
     * bord de la carte, la forêt cachait la scène depuis la caméra par défaut (au sud-est, un
     * arbre de 5 à 9 m cache autant de terrain au nord-ouest de son pied). Sur ces tronçons, la
     * lisière recule de `depth` cases; voir `ForestClearing` et `src/rendu/foret-pourtour.test.ts`
     * (lignes de vue des bêtes et des joueurs). Cases de la carte: x vers l'est, y vers le sud.
     */
    forestClearings: [
      /*
       * Champs et prés des hameaux voisins (0.13, v0-13-carte.md, section 10). Au tour 10, la pâture
       * derrière le pré de l'est suivait l'ancien bord (x 98, y 18 à 36, 4 m). Le bord est passe en
       * x 138, à moins de 10 m du hameau C et de la pâture de la ferme: les prés continuent derrière
       * lui, la lisière recule de 6 m de y 15 à 45 (tout ce que la caméra voit derrière la pâture et
       * le hameau en orientations 0 et 3), et revient à sa place avant la voie (y 12 à 14).
       */
      { side: 'east', from: 15, to: 45, depth: 6, feather: 3, wobble: 0.8 },
      /*
       * Pré inondable du sud, face à l'anse de sable (rive sud, x 23 à 31, y 42 et 43): le
       * fond de vallée que l'Aubrune noie en hiver reste en prairie de fauche, le bois commence
       * plus haut sur le coteau. C'est l'air froid de ce fond qui fait fumer la rivière au matin
       * de la brume. De x 19 à 40: derrière l'anse vue du sud-est (orientation 0) et du sud-ouest
       * (orientation 1); la route du sud (x 17 à 19) le traverse.
       */
      { side: 'south', from: 19, to: 40, depth: 4, feather: 4, wobble: 0.8 },
    ] as readonly ForestClearing[],
    pebbleDensity: 0.12,
    /**
     * Décor de la carte hors de la passe d'ombre: objets de cette hauteur ou
     * moins (m). La passe d'ombre redessine chaque triangle qui la porte. À 1 m,
     * bancs, barrières, rochers et tonneaux perdaient une ombre bien visible de
     * près, et le quai son liseré: on s'en tient aux tout petits accessoires.
     */
    shadowlessBelow: 0.3,
  },

  /** Passe d'ombre (budget de triangles et d'appels du PC de référence). */
  shadowCasters: {
    /**
     * Tri fin (`ombre-tri.ts`): ce dont l'ombre ne peut tomber dans la vue sort
     * de la passe d'ombre. Hauteurs (m) de l'empreinte qui reçoit l'ombre: du
     * lit de la rivière au faîte des toits; marge (m) pour le flou du bord.
     */
    cull: true as boolean,
    receiverHeights: [-0.5, 2, 6] as readonly number[],
    margin: 0.5,
    /**
     * Pièces sans ombre visible, par nom de nœud: roues et bielles sous les
     * voitures (dans l'ombre de la caisse), cadre accroché au mur, plancher de
     * 15 cm de la maisonnette (sous ses murs). Les poules gardent la leur: à
     * midi, sans elle, elles flottent au-dessus de l'herbe.
     */
    shadowlessParts: [
      /_wheels(_\d+)?$/,
      /_rod_[lr]$/,
      /^picture_frame$/,
      /^gatekeeper_house_(ruin|repaired)_floor$/,
    ] as readonly RegExp[],
  },

  /**
   * Sols surélevés de la carte et leur hauteur (m), en attendant que
   * `GameMap.props` porte la hauteur de chaque type (demande dans ETAT.md).
   */
  floorProps: { platform: 0.4, pontoon: 0.5 } as Readonly<Record<string, number>>,

  /**
   * Tour 10: objets de la carte posés à côté du centre de leur emprise (m, x et y de la carte), et
   * types sans dessin. La cour de l'école porte le modèle `school` (cour et école-mairie, 11 x 5):
   * décalé de 2 m vers l'est, son portail (x -2 du modèle) tombe dans l'axe de la rue Haute (x 77,
   * portail de la carte). L'école-mairie de la carte est alors déjà dessinée.
   */
  propOffsets: { school_yard: [2, 0] } as Readonly<Record<string, readonly [number, number]>>,
  propsDrawnElsewhere: ['school_house'] as readonly string[],

  characters: {
    /**
     * Style des personnages (étape A du plan de qualité visuelle, décision D1 en attente du
     * client): `facettes`, l'ombrage par face validé le 31 octobre; `lisse`, la version témoin
     * (`lisse.ts`, `contour.ts`): normales lissées, rampe d'ombrage douce, ombres teintées
     * chaudes sur la peau et froides sur les tissus, liseré côté soleil et contour coloré. Le
     * décor garde ses facettes dans les deux cas. Page de rendu: `style=lisse` pour comparer.
     */
    style: 'facettes' as CharacterStyle,
    /** Style `lisse`: ombrage des personnages (chantier 1 du plan). */
    smooth: {
      /**
       * Angle de lissage (degrés): deux faces voisines plus ouvertes que cela gardent leur arête
       * (bord de chapeau, semelle, ourlet à 90 degrés). Mesuré sur `personnages.glb` le
       * 2026-11-03: les membres à 6 pans font 60 degrés entre faces, les têtes et les torses 30 à
       * 45; les vraies arêtes 80 à 100. À 65, tout ce qui est rond devient lisse.
       */
      creaseDegrees: 65,
      /**
       * Rampe de la lumière directe selon N.L: ombre, demi-teinte, lumière. Seuil ombre vers
       * demi-teinte, seuil demi-teinte vers lumière, valeur de la demi-teinte (part de la pleine
       * lumière), demi-largeur des transitions (en N.L: 0,06 donne des bords doux de 10 à 15 %).
       */
      ramp: { shadowEdge: 0.04, lightEdge: 0.42, halftone: 0.45, softness: 0.07 },
      /**
       * Teinte de la lumière du ciel à l'ombre sur la peau (luminance ramenée à 1): brique, pas
       * gris (fiche de style 4.7). Les tissus prennent la teinte froide du décor (`look.shadeTint`).
       * Part de la teinte appliquée à l'ombre pleine.
       */
      skinShadeTint: '#e0866a',
      skinShadeAmount: 0.55,
      clothShadeAmount: 0.45,
      /**
       * Liseré côté soleil: bande au bord de la silhouette (part du bord, 0,15 dans le plan),
       * douceur de son bord, force (le reste du réglage dans `look.rim` de l'ambiance).
       */
      rim: { width: 0.14, softness: 0.05, strength: 0.22 },
    },
    /**
     * Style `lisse`: contour coloré par coque inversée (chantier 3 du plan, `contour.ts`).
     * Épaisseur à l'écran: `widthPerHeight` x hauteur du tampon (1,4 px à 768, 2 px à 1080), au
     * moins `minWidth` px. Couleur: celle de la pièce, assombrie (`darken`, en linéaire: L* perd
     * 55 à 60 %), saturée (`saturation`), suivie de la lumière du moment.
     * Coût borné: seuls les personnages à moins de `maxDistance` m du centre de la vue (le point
     * que regarde la caméra, à leur hauteur) sont contourés, les plus proches d'abord, au plus
     * `maxCount` et `maxTriangles` triangles de coque; en mode léger, `lightMaxCount`.
     * Les petites îles du maillage (yeux, sourcils, joues, bouche, nez, boutons: diagonale sous
     * `skipIslandsBelow` m) n'ont pas de coque: leur contour ferait des taches sur le visage.
     */
    outline: {
      widthPerHeight: 1 / 540,
      minWidth: 1,
      darken: 0.16,
      saturation: 1.25,
      maxDistance: 14,
      /**
       * Avance (m) gardée par un personnage déjà contouré, à la limite de distance comme dans le
       * classement: un habitant qui passe la limite ou deux voisins à égalité ne clignotent pas.
       */
      hysteresis: 1,
      maxCount: 12,
      maxTriangles: 26_000,
      lightMaxCount: 4,
      skipIslandsBelow: 0.08,
      /** Part du soleil dans la lumière qui éclaire le contour (le ciel compte entier). */
      sunShare: 0.5,
      /** Le contour ne descend pas sous cette part de sa couleur de midi (nuit). */
      minLight: 0.12,
    },
    /**
     * Coupes longues couchées (tour 10, `HAIR_FLATTENED_ASLEEP`): profondeur (z de la pose de
     * liaison, m) au-delà de laquelle la chevelure est ramenée: derrière la tête (au-dessus de
     * `headFromY`), celle du chignon (-0,226, mesurée: ne s'enfonce pas); dans le dos, 3,5 cm
     * derrière le dos du corps (-0,164).
     */
    asleepHair: { headFromY: 1.35, headDepth: -0.226, backDepth: -0.2 },
    crossFadeSeconds: 0.22,
    /**
     * Vitesse du pied posé dans `walk` et `carry_two` à leur rythme d'origine (m/s): le clip joue à
     * `vitesse / référence` pour que le pied ne glisse pas. Mesurée sur les clips au chargement
     * (`foulee.ts`); ces valeurs servent si la mesure échoue, et à la marche à reculons de Basile
     * (`moments.ts`). Mesurées le 2026-11-03 sur les clips de la 0.12: 2,8 et 1,3 (4,0 et 1,95 avant
     * eux); la fiche dit 3,5. L'ancienne référence de 3,2 faisait patiner les joueurs.
     */
    walkReferenceSpeed: 2.8,
    carryReferenceSpeed: 1.3,
    /** Bornes du rythme de la marche (les habitants à 1,6 m/s jouent la marche à 0,57). */
    walkScaleMin: 0.2,
    walkScaleMax: 1.7,
    /**
     * Pousser la draisine (pas de clip de poussée): à l'arrêt, `stillClip` (mains en avant sur le
     * levier); en marche, la marche avec la main droite posée sur la draisine, à `handHeight` m au-dessus
     * du sol, si elle est devant soi à moins de `reach` m.
     */
    push: { stillClip: 'crank_hold', handHeight: 0.95, reach: 1.5, weight: 0.85 },
    /**
     * Habitants au travail (activité `work`): le geste selon le poste (point de l'emploi du temps),
     * `saw` ailleurs. Solange coud assise derrière sa vitrine (chaise de couture, assise de `sit`);
     * Basile répare à la remise de la draisine au marteau.
     */
    villagerWork: { salon_window: 'sit', handcar_shed: 'hammer' } as Readonly<Record<string, string>>,
    villagerWorkDefault: 'saw',
    /** Fauteuil de coiffure de Solange (`haberdashery`): assise à 0,5 m. */
    salonChairSeatHeight: 0.5,
    /**
     * S'asseoir et se lever (clips `sit_down` et `stand_up` de 0,6 s, de la pose debout à celle de
     * `sit` et retour) au lieu d'un fondu; fondu court à leurs bouts, qui partagent la pose voisine.
     */
    posture: { sitDown: 'sit_down', standUp: 'stand_up', fadeSeconds: 0.08 },
    /** Porter seul devant soi (meuble tenu pour l'aménagement): en marchant, et à l'arrêt. */
    carryOne: { walk: 'carry_one', idle: 'carry_one_idle' },
    /**
     * Habitants de la 0.13 (lot H6, `accessoires.ts`): ce que chacun porte et quand, d'après la
     * fiche (section 2.3 de `v0-13-habitants.md`) et ses habitudes (section 3.2). La première règle
     * qui s'applique l'emporte; en conversation, l'habitant garde ce qu'il avait. Avant le lot H1
     * (pas encore d'habitude dans l'état), seules les règles `untracked` se montrent.
     * Pourquoi: Lucie, l'abbé et Nour poussent leur vélo dans le bourg en partant en tournée et en
     * revenant; Armand a son cartable entre l'école et chez lui, au portail aussi; Margot porte le
     * pot à lait de la traite et du beurre; Barnabé a la hache à l'épaule entre la coupe, la
     * charbonnière et la clairière; Colette sort l'accordéon le mardi soir et à son anniversaire;
     * Ambroise a la loupe à l'oeil à l'établi, relevée sur le front ailleurs.
     */
    villagerProps: {
      lucie: [
        villagerProp('bicycle_lucie', 'bike', { activities: ['bike_stop'], untracked: true, stillClip: 'push_bike_idle' }),
        villagerProp('bicycle_lucie', 'bike', { walking: true, habits: ['round', 'train', 'sorting'], untracked: true }),
        villagerProp('bicycle_lucie', 'bike', { activities: ['wait_train'], habits: ['train'], stillClip: 'push_bike_idle' }),
      ],
      martial: [
        // 0.13 (S16): arrêté devant la forge, à vélo, pour la météo du lendemain.
        villagerProp('bicycle_martial', 'bike', { activities: ['bike_stop'], untracked: true, stillClip: 'push_bike_idle' }),
        villagerProp('bicycle_martial', 'bike', {
          walking: true,
          habits: ['rounds', 'sunday_hamlets', 'birthday', 'wednesday_bike'],
          untracked: true,
        }),
        villagerProp('bicycle_martial', 'bike', {
          activities: ['work', 'stand'],
          habits: ['wednesday_bike', 'birthday'],
          stillClip: 'push_bike_idle',
        }),
      ],
      nour: [
        // 0.13 (S15): arrêtée au départ de la course avec Lucie, le vélo à la main.
        villagerProp('bicycle_nour', 'bike', { activities: ['bike_stop'], untracked: true, stillClip: 'push_bike_idle' }),
        villagerProp('bicycle_nour', 'bike', { walking: true, habits: ['rounds'], untracked: true }),
      ],
      armand: [
        villagerProp('school_satchel', 'hand', { walking: true, habits: ['gate', 'class', 'recess', 'mairie'], untracked: true }),
        villagerProp('school_satchel', 'hand', { activities: ['stand'], habits: ['gate'], stillClip: 'idle' }),
      ],
      margot: [
        villagerProp('milk_can', 'hand', { walking: true, habits: ['butter', 'milking'], untracked: true }),
        villagerProp('milk_can', 'hand', { activities: ['work'], habits: ['butter'], stillClip: 'idle' }),
      ],
      barnabe: [
        villagerProp('felling_axe', 'hand', {
          walking: true,
          habits: ['coupe', 'with_ines', 'kiln', 'cuite', 'lunch'],
          untracked: true,
        }),
        villagerProp('felling_axe', 'hand', { activities: ['stand'], habits: ['lunch'], stillClip: 'idle' }),
      ],
      colette: [
        villagerProp('accordion', 'chest', {
          activities: ['stand', 'host'],
          habits: ['tuesday_accordion', 'birthday'],
          stillClip: 'carry_one_idle',
        }),
      ],
      ambroise: [
        villagerProp('villager_ambroise_loupe', 'worn', { activities: ['work'], habits: ['shop'], untracked: true }),
        villagerProp('villager_ambroise_loupe_up', 'worn', { walking: true, activities: ['*'], untracked: true }),
      ],
    } as Readonly<Record<string, readonly VillagerPropRule[]>>,
    /** Vélos poussés à la main (fiche de l'artiste: roues `_wheel_front` et `_wheel_rear`, rayon 0,335 m). */
    bikes: {
      wheelRadius: 0.335,
      wheels: ['_wheel_front', '_wheel_rear'],
      walkClip: 'push_bike',
      idleClip: 'push_bike_idle',
    } satisfies BikeSettings,
    /**
     * Portage à deux entre habitants (S09): la charge, tenue par le premier porteur, est poussée
     * d'autant devant ses mains (m), pour tomber au milieu des deux porteurs, face à face à 1,3 m
     * (`apart` de `vie.json`) quand chacun a les mains à 0,44 m devant lui.
     */
    villagerLoadReach: 0.21,
    /** Au-delà (m), les deux porteurs ne sont pas ensemble: rien entre leurs mains. */
    villagerLoadPairing: 2.2,
    /** Boire (le chocolat à la petite table d'Odette: action `eat` qui vise la table). */
    drinkClip: 'drink',
    /** Traire la chèvre ou la tenir pour l'autre: pas encore de clip de traite, celui de la caresse (accroupi). */
    milkClip: 'pet',
    /** En dessous de cette vitesse, on attend au lieu de marcher. */
    walkThreshold: 0.15,
    turnHalfLife: 0.06,
    /** Au-delà, on ne lisse pas (retour de minuit, apparition). */
    teleportDistance: 3,
    blinkEverySeconds: 3.7,
    blinkSeconds: 0.12,
    /** Silhouette du joueur vue derrière un mur. */
    silhouetteOpacity: 0.38,
    /**
     * Trou de visibilité d'un personnage: rien ne s'efface sous cette hauteur au-dessus de ses
     * pieds (m). Une barrière (lisses à 0,8 m, poteaux à 0,95 m), un rail ou un banc ne le cachent
     * pas: on le voit par-dessus. Plus bas (0,45 m avant le retour S02 du 2026-11-02), leur coupe
     * tramée au bord du trou se lisait comme une ombre en tache tramée à côté des pieds.
     */
    seeThroughMinHeight: 1,
    /** Fondu entre la marche et l'attente: court, pour que les pieds ne glissent pas au départ et à l'arrêt. */
    walkFadeSeconds: 0.1,
    /** Fondu d'entrée et de sortie d'un geste d'outil joué une fois. */
    gestureFadeSeconds: 0.06,
    /**
     * Instant du contact dans chaque clip de geste (s, mesuré sur la main droite
     * de `personnages.glb`: au plus bas pour la houe, la récolte, le marteau;
     * la hache touche le tronc à mi-descente). Le clip démarre juste avant, pour
     * que le coup tombe avec le son et la terre, émis au pas de l'appui.
     */
    // Clips de la 0.12 (`verifier/contacts_gestes.py`): récolte à 0,30, ramasser 0,43, nourrir 0,4.
    // Boire et cuisiner n'en ont pas ici: ils partent du début (lever la tasse, prendre la cuillère).
    gestureImpact: { hoe: 0.53, chop: 0.62, harvest: 0.3, sow: 0.4, hammer: 0.27, pickup: 0.43, feed: 0.4 } as Readonly<
      Record<string, number>
    >,
    /** Le contact tombe au plus ce délai après l'appui (s). */
    gestureImpactLead: 0.08,
    /**
     * Un geste beaucoup plus long que son clip (scie et cuisine à l'établi,
     * plusieurs secondes) se joue en boucle à son rythme plutôt qu'étiré.
     */
    gestureLoopAbove: 1.6,
    /**
     * Attentes variées (rendu seul, `attentes.ts`): après une immobilité tirée
     * entre ces bornes (s), une attente de la liste du personnage, puis
     * l'attente ordinaire. Poses de `IDLE_POSES` ou clips de `personnages.glb`.
     */
    idleAfterSeconds: { min: 5, max: 8 },
    idleFadeSeconds: 0.3,
    idleVariants: {
      players: ['look_around', 'stretch', 'look_down'],
      firmin: ['watch', 'look_around'],
      odette: ['wipe', 'look_around'],
      jeanne: ['look_around', 'stretch'],
      basile: ['wipe_brow', 'look_around'],
    } as Readonly<Record<string, readonly string[]>>,
    /** Joueur arrêté près d'une poule (m, devant lui): il la caresse parfois (clip `pet`). */
    petRange: 1.3,
    /** Habitants: tête et buste tournés vers le joueur le plus proche à cette distance (m). */
    lookRange: 4,
    lookMaxDegrees: 70,
    lookHalfLife: 0.25,
    /** Répartition de la rotation du regard entre le buste, le cou et la tête. */
    lookShares: { chest: 0.2, neck: 0.3, head: 0.5 },
    /** Salut (clip `wave`) au premier croisement de la journée, à cette distance (m). */
    greetRange: 2.6,
    /**
     * Bancs de la carte (modèle `bench`, sans `seat_height` dans le GLB): hauteur
     * de l'assise (m). Places, avancée de l'assise et portée des habitants:
     * `reglages.benches` (partagés avec la simulation, qui réserve les places).
     * `glideSeconds`: le corps glisse de sa place debout à l'assise (et retour)
     * pendant le fondu, au lieu d'y sauter.
     */
    bench: { seatHeight: 0.45, glideSeconds: 0.22 },
    /**
     * Tour 9: siège sans modèle (le bord du ponton): clip `sit_edge` (même assise que `sit`), la
     * racine `edgeLift` m sous le plancher, jambes au-dessus de l'eau; `look_up` une fois à
     * l'instant `lookUpAt` de l'apogée des étoiles (données du moment, `render.lookUpAt`).
     */
    edge: { clip: 'sit_edge', lift: -0.47, lookClip: 'look_up' },
    /**
     * Tour 9, le salut du mécanicien: manivelle tenue (`crank_hold`), tournée pendant la descente
     * des lisses (`crank_turn`, un tour par seconde), main levée au salut (`wave_back`).
     */
    crank: { hold: 'crank_hold', turn: 'crank_turn', turnSeconds: 1, wave: 'wave_back' },
    /** Hauteur d'assise de l'animation `sit` (m): le bassin y est posé quand la racine est au sol. */
    sitClipSeatHeight: 0.47,
    /** 0.13 (lot H7): assise des chaises des tables du café (`seat_height` de `cafe_table`, `foret013.glb`). */
    lifeSeatHeight: 0.47,
    /**
     * Coucher (retour R05): l'animation `sleep` pose le dos à cette hauteur (m) au-dessus de la
     * racine, celle du lit double; sur une couche plus basse (`sleep_height` du modèle: paillasse
     * à 0,15 m), le corps descend d'autant. Tête vers -Z du personnage, comme les lits.
     */
    sleepClipBackHeight: 0.5,
    /** Tape dans la main (clip `high_five`) à une réussite à deux, si les joueurs sont à moins de (m). */
    highFiveRange: 1.8,
  },

  garden: {
    tilledHeight: 0.06,
    /** Pop d'un stade qui change (s) et dépassement de l'échelle. */
    growPopSeconds: 0.45,
    growPopOvershoot: 0.18,
    /**
     * 0.13 (parcelles libres, section 5.5): une parcelle posée sort de terre (s), et un rectangle
     * pose ses rangées en vague, `waveSeconds` d'écart (coupé par la réduction des animations).
     */
    plotAppearSeconds: 0.28,
    waveSeconds: 0.04,
    /** Roncier d'une case de friche pas encore défrichée: échelle et écart au centre de la case (m). */
    brambleScale: [0.42, 0.62] as const,
    brambleJitter: 0.25,
  },

  /** 0.13: aperçu du cordeau (`parcelles.ts`). */
  plotPreview: {
    colors: { ok: '#7fcf6a', refused: '#d9584f', extra: '#c9c2b0' },
    opacity: 0.55,
    extraOpacity: 0.85,
    pulse: 0.08,
    pulseHz: 1.6,
    /** Cadre de la ficelle (m): côté, épaisseur, hauteur des piquets, et levée au-dessus du sol. */
    inset: 0.92,
    line: 0.025,
    stakeHeight: 0.22,
    lift: 0.03,
    /** Hachures et croix d'un refus: au-dessus de la parcelle fantôme (m). */
    markLift: 0.12,
    /** Tremblement du fantôme rouge à un refus de l'hôte. */
    shakeSeconds: 0.3,
    shakeSpeed: 60,
    shakeAmplitude: 0.05,
  },


  effects: {
    /** Objet récolté qui saute au sac. */
    jumpSeconds: 0.55,
    jumpHeight: 1.3,
    /** Hauteur du sac sur le personnage. */
    bagHeight: 1.05,
    maxParticles: 320,
    gravity: 9.8,
    destinationSeconds: 1,
    highlightPulseHz: 1.6,
    /** Taille de l'objet d'inventaire affiché (m). */
    itemScale: 0.75,
  },

  train: {
    /** Distance parcourue au moins pendant l'entrée et le départ (m). */
    slideDistance: 70,
    /**
     * Sens de marche du train le long de la voie (retour R06, 2026-11-03): -1 vers l'ouest. Il arrive
     * par l'est, s'arrête au quai, puis continue tout droit vers l'ouest et sort par là (passage à
     * niveau, salut du mécanicien), locomotive en tête, sans repartir à reculons. Même sens que
     * `departureDirection` du son (`src/audio/reglages.ts`).
     */
    travel: -1 as -1 | 1,
    /** Hors de la carte au début de l'arrivée et à la fin du départ: le train est à autant du bord (m). */
    offMapClearance: 19,
    wheelRadius: 0.42,
    /** Voie: rangée de la carte et décalage des voitures depuis `train_stop`. */
    carSpacing: 0.25,
  },

  /**
   * Tour 9, le salut du mécanicien: l'acteur dont la piste mène la cabine (et le train au pas),
   * l'équipage (bustes de `personnages.glb`) posé dans la cabine du train où qu'il soit, le volant
   * des manivelles (un tour par seconde pendant la descente des lisses).
   */
  salute: {
    cabActor: 'driver',
    crewModels: ['rail_crew_driver', 'rail_crew_stoker'] as readonly string[],
    /** Hauteur de la racine des bustes (m au-dessus du sol de la voie): le plancher de la cabine. */
    crewRootZ: 1.05,
    crankModel: 'level_crossing_crank',
    crankWheel: 'level_crossing_crank_wheel',
    crankTurnSeconds: 1,
  },

  /** Tour 9 (`chantiers.ts`): chantiers, marelle, lampadaires allumés à la perche. */
  improvements: {
    /** Nœud de l'artiste par chantier quand la carte garde un type commun (`bench`). */
    models: { ford_bench: 'ford_bench', house_bench: 'house_bench' } as Readonly<Record<string, string>>,
    /** Chantiers posés une fois par case (les trois jardinières du quai). */
    onePerCell: ['quay_planters'] as readonly string[],
    /** L'auvent: dans le repère de la maisonnette, devant la porte (extras de `door_canopy`). */
    canopy: 'door_canopy',
    canopyOffset: [0, 0, 2.3] as readonly [number, number, number],
    /** Le toit du puits: l'arceau du puits ouvert s'efface une fois bâti. */
    wellRoof: 'well_roof',
    /** Verre d'une lanterne éteinte: case sans émission, grossi autour de la lanterne pour couvrir le verre du décor. */
    darkGlassCell: 'shadow' as const,
    darkGlassGrow: 1.04,
    /** En dessous de cet allumage, la lanterne montre son verre éteint. */
    darkGlassBelow: 0.35,
    /** Flamme qui grandit (s) si le moment ne le dit pas; un lampadaire sans heure dans la vague (le réverbère du chemin). */
    flameGrowSeconds: 0.6,
    unscheduledLampAt: 4,
    /** Flamme allumée seule: elle prend en `flameCatchSeconds`, vacille, s'éteint en `flameOutSeconds`. */
    flameCatchSeconds: 0.25,
    flameOutSeconds: 0.3,
    aloneFlame: 0.8,
    aloneFlicker: 0.35,
    aloneFlickerHz: 7,
    /** Marelle à la craie: point de la carte, cases (m), rangées du sud au nord, traits. */
    hopscotch: {
      point: 'hopscotch',
      square: 0.42,
      rows: [1, 1, 2, 1, 2] as readonly number[],
      line: 0.035,
      thickness: 0.006,
      lift: 0.004,
      skySegments: 7,
      chalk: 'white_paint' as const,
      sky: 'flower_pink' as const,
    },
  },

  house: {
    /** Lumière chaude de la maisonnette le soir (lampe, réchaud): couleur, intensité à la nuit, portée. */
    lampColor: '#ffb563',
    lampIntensity: 9,
    lampDistance: 8,
    lampHeight: 1.9,
    /** La lampe ne s'allume qu'une fois la maison réparée (toit et porte). */
    lampNeedsRepair: true as boolean,
    /**
     * Murs coupés quand on est dedans (retour R12): on garde leur pied jusqu'à cette hauteur
     * (m, repère du modèle; le plancher est à 0,14 m). Le tour de la pièce reste lisible et la
     * porte, sans maçonnerie sous elle, reste une brèche nette entre ses jambages.
     */
    cutWallHeight: 0.5,
    /** Seuil de la porte dans ce pied de mur (m, repère du modèle): juste au-dessus du plancher. */
    doorSillHeight: 0.17,
  },

  /**
   * Bâtiments visitables (tour 10, ADR 0016, `interieurs.ts`). La lampe unique de la maisonnette
   * se déplace dans le bâtiment où est le joueur local: couleur, intensité (de jour au plancher
   * `dayShare` de celle de la nuit: une boutique est plus sombre que la rue), hauteur. Les portes
   * s'ouvrent vers l'intérieur devant un personnage à moins de `doorReach` m, en `doorSeconds` s.
   */
  interiors: {
    lamps: {
      grocery: { color: '#ffc27a', intensity: 7, height: 2.2, dayShare: 0.35 },
      salon: { color: '#ffe1b8', intensity: 6, height: 2.2, dayShare: 0.35 },
      // 0.13: la nef est haute et grande (12 x 10 m): lampe plus haute et plus forte, lumière de cierges.
      church: { color: '#ffe2bd', intensity: 10, height: 3.2, dayShare: 0.4 },
      cafe: { color: '#ffd29a', intensity: 7, height: 2.2, dayShare: 0.35 },
      // La forge: le rougeoiement du foyer.
      forge: { color: '#ffa766', intensity: 7, height: 2.0, dayShare: 0.45 },
      // La menuiserie fermée: jour gris des volets, poussière.
      joinery: { color: '#e9dfc8', intensity: 5, height: 2.2, dayShare: 0.35 },
      farmhouse: { color: '#ffc27f', intensity: 7, height: 2.2, dayShare: 0.35 },
      mill: { color: '#f3e3c2', intensity: 6, height: 2.4, dayShare: 0.35 },
    } as Readonly<Record<string, { color: string; intensity: number; height: number; dayShare: number }>>,
    doorReach: 1.25,
    doorSeconds: 0.3,
    doorOpenDeg: 80,
    /** Pied des murs coupés (comme la maisonnette), repère du modèle; plancher à 0,12 m. */
    cutWallHeight: 0.5,
    doorSillHeight: 0.15,
    /**
     * Pièces de la maisonnette (conception 4.2): modèle de la pièce, mur de la maisonnette qui
     * reçoit la porte percée (à la place de l'ancienne fenêtre) une fois la pièce bâtie, et ce qui
     * attend au point du chantier pendant le site (caisse, planches).
     */
    houseRooms: {
      room_cellar: {
        model: 'gatekeeper_cellar',
        wall: 'gatekeeper_house_repaired_wall_left',
        doorWall: 'gatekeeper_house_wall_left_door',
        site: 'room_cellar_site',
        // Éléments de `pieces.json` (lot L4) vers les `id_hint` du modèle, vérifiés à la géométrie
        // (le poteau 1 du modèle est au nord, le 2 au sud; le mur 2 porte les pans nord et sud).
        elements: {
          post_south: 'post_2',
          post_north: 'post_1',
          wall_plate: 'plate',
          wall_west: 'wall_1',
          wall_north: 'wall_2',
          roof: 'roof',
        },
      },
      room_bedroom: {
        model: 'gatekeeper_bedroom',
        wall: 'gatekeeper_house_repaired_wall_back',
        doorWall: 'gatekeeper_house_wall_back_door',
        site: 'room_bedroom_site',
        // Poteaux 1 à 4 du modèle: nord-ouest, nord-est, sud-ouest, sud-est; sablière 1 à l'ouest.
        elements: {
          post_nw: 'post_1',
          post_ne: 'post_2',
          post_sw: 'post_3',
          post_se: 'post_4',
          plate_west: 'plate_1',
          plate_east: 'plate_2',
          wall_west: 'wall_1',
          wall_east: 'wall_2',
          wall_north: 'wall_3',
          wall_gable: 'wall_4',
          truss_ridge: 'truss_ridge',
          floor: 'floor',
        },
      },
    } as Readonly<
      Record<
        string,
        { model: string; wall: string; doorWall: string; site: string; elements: Readonly<Record<string, string>> }
      >
    >,
    siteProps: ['crate', 'plank_stack'] as readonly string[],
  },

  /**
   * Prise des outils (retour R08, `prise.ts`), par type d'outil (`tool_kind`, sinon nom du
   * modèle). Points dans le repère de l'outil (origine de l'artiste: sa prise de geste; manche
   * le long de Y, bout du manche vers +Y). Ports dans le repère du personnage (avant +Z).
   * Les bras font 0,55 m: une prise à deux mains au milieu du manche ne tient pas dans les
   * clips de geste actuels; la main droite garde la prise de geste de l'artiste.
   */
  toolHolds: {
    // Houe de 1,25 m: au repos et en marche, portée sur l'épaule droite, main au milieu du
    // manche (0,65 m du bout), lame derrière l'épaule tournée vers le bas, bout du manche devant.
    hoe: {
      grip: [0, -0.4, 0],
      gestureGrip: [0, 0, 0],
      gestures: ['hoe'],
      carry: { hand: [-0.24, 1.1, 0.2], axis: [0.12, -0.6, 0.79], front: [0, 1, 0] },
    },
    // Hache: tenue à 20 cm du bout du manche (8 cm dans le modèle), tête en bas, au repos comme
    // pendant le geste; la tête reste à 25 cm du sol bras ballant.
    axe: { grip: [0, -0.12, 0], gestureGrip: [0, -0.12, 0], gestures: ['chop'], carry: null },
    // Hache de Barnabé (0.13, `felling_axe`, 0,88 m): à l'épaule droite hors geste, comme la houe;
    // main près du bout du manche, fer derrière l'épaule, tranchant vers le haut.
    felling_axe: {
      grip: [0, -0.04, 0],
      gestureGrip: [0, -0.12, 0],
      gestures: ['chop'],
      carry: { hand: [-0.22, 1.18, 0.22], axis: [0.1, -0.72, 0.69], front: [0, 1, 0] },
    },
    // Arrosoir: par l'anse (origine de l'artiste, au sommet de l'anse).
    watering_can: { grip: [0, 0, 0], gestureGrip: [0, 0, 0], gestures: ['water'], carry: null },
    // Canne: par la poignée, au-dessus du talon (origine de l'artiste).
    fishing_rod: {
      grip: [0, 0, 0],
      gestureGrip: [0, 0, 0],
      gestures: ['fish_cast', 'fish_wait', 'fish_strike'],
      carry: null,
    },
  } satisfies Record<string, ToolHoldSpec>,
  /**
   * Plaque tournante au pied de chaque voie de garage (R20, `voie.ts`): rayon (m, assez pour la
   * draisine de 1,4 x 1,6 m), largeur du cercle de pierre, hauteurs (m au-dessus du sol de la
   * voie: ballast à 0,12, traverses de 0,12 à 0,22), planches du tablier, segments du cercle.
   */
  railway: {
    turntableRadius: 1.3,
    turntableRim: 0.14,
    rimTop: 0.14,
    deckTop: 0.17,
    plankHeight: 0.03,
    plankWidth: 0.26,
    turntableSegments: 28,
    /**
     * Où posent les pieds sur la voie (retour R05, 2026-11-03): sur les traverses, pas sur le sol
     * de la case (0,06 m), 22 cm plus bas, où rails et traverses coupaient les jambes. Repère du
     * module `rail_straight` (lu dans le GLB par `voie.test.ts`): dessus des traverses `sleeperTop`
     * jusqu'à `sleeperHalf` m de l'axe, puis le talus du ballast jusqu'au sol de la case à
     * `shoulderHalf` m.
     */
    walk: { sleeperTop: 0.22, sleeperHalf: 0.84, shoulderHalf: 1.0 },
  },
  /** Passage d'une prise à l'autre (demi-vie, s), le temps du fondu des clips. */
  toolHoldBlendHalfLife: 0.06,

  /**
   * Retouches des modèles au chargement (`retouches.ts`), en attendant un réexport de l'artiste.
   * Ponton (R21): l'escalier du bout sud (marches et limons, x de -0,45 à 0,45, z de 1,5 à 2,15
   * dans le modèle) descendait dans l'eau sans rien desservir: retiré.
   */
  modelTrims: [
    { node: 'pontoon', min: [-0.55, -0.2, 1.5], max: [0.55, 0.7, 2.4] },
  ] satisfies readonly ModelTrim[],

  budgets: {
    drawCalls: 150,
    triangles: 250_000,
    programs: 12,
    /** Fréquence de rafraîchissement de l'indicateur de performances (s). */
    statsRefreshSeconds: 0.5,
  },

  /**
   * Mode léger (`quality: 'light'`, `?rendu=leger`): pour jouer des séquences
   * dans un Chromium en rendu logiciel (tests de qa-testeur). Résolution
   * interne basse, ni ombres ni antialiasing, effets et végétation réduits.
   */
  light: {
    pixelRatio: 0.5,
    maxPhysicalPixels: 640 * 360,
    /** Part gardée des touffes, fleurs, galets et arbres du pourtour. */
    vegetationShare: 0.25,
    /** Part gardée des particules et des gouttes de pluie. */
    effectsShare: 0.25,
  },

  /**
   * Résolution dynamique (budget de la plateforme: jusqu'à 0,75): si les
   * images durent trop longtemps en moyenne, la résolution de rendu baisse
   * par paliers, sans jamais remonter pendant la partie (pas de va-et-vient).
   * Logique dans `qualite.ts`.
   */
  dynamicResolution: {
    steps: [1, 0.9, 0.8, 0.75] as const,
    /**
     * Moyenne glissante des images au-delà de laquelle on descend d'un palier
     * (ms, environ 55 images par seconde), relevée sur un écran plus lent que
     * 60 Hz (voir `slowRatio`).
     */
    slowFrameMs: 18,
    /** Durée de lissage de la moyenne et attente entre deux paliers (s). */
    averageSeconds: 1.5,
    cooldownSeconds: 3,
    /** Premières secondes ignorées (compilation, chargement des textures). */
    warmupSeconds: 5,
    /**
     * Image ignorée au-delà de cette durée (ms): onglet caché, pause,
     * compilation d'un shader. En deçà elle compte, même très lente.
     */
    ignoreFrameMs: 250,
    /**
     * Période de l'écran: plancher des durées d'image, qui remonte lentement
     * (s pour suivre une hausse), bornée pour qu'un jeu à 30 images par
     * seconde ne passe jamais pour un écran à 30 Hz (ms).
     */
    refreshRiseSeconds: 30,
    minRefreshMs: 4,
    maxRefreshMs: 21,
    /**
     * Lent: moyenne au-delà de cette part de la période de l'écran (écrans à
     * 48 ou 50 Hz), et jamais sous `slowFrameMs`.
     */
    slowRatio: 1.08,
  },

  /**
   * Repli automatique vers le mode léger (risque 1 du gauntlet): quand le
   * dernier palier de la résolution dynamique ne suffit plus, à chaud, sans
   * recréer le contexte WebGL (ombres coupées; la résolution reste celle du
   * dernier palier, jamais celle du mode léger demandé des tests, qui rendait
   * l'image floue sur le PC: retour R07; l'antialiasing, la végétation et les
   * effets restent ceux du départ).
   * Un seul retour par séance: s'il faut se replier de nouveau, c'est définitif.
   */
  autoLight: {
    /**
     * Les ombres ne partent que sous ce rythme (ms par image: 25, soit 40 images par seconde), tenu
     * `slowSeconds` au dernier palier utile (retour R13, 2026-11-03). À 18 ms, le PC de la cliente,
     * fluide à 45-55 images par seconde, perdait ses ombres pour de bon au bout de 25 s: ses paliers
     * de résolution ne changent rien en 1366x768 (plancher de netteté), le repli venait tout de suite.
     */
    cutFrameMs: 25,
    /** Au dernier palier, durée de lenteur continue avant le repli (s). */
    slowSeconds: 8,
    /**
     * Retour à la qualité normale (au dernier palier) si la moyenne reste
     * sous cette part de la période de l'écran pendant `returnSeconds`.
     * Plus petit que `slowRatio`: le seuil de retour reste sous celui du repli.
     */
    comfortRatio: 1.03,
    returnSeconds: 60,
    maxReturns: 1,
  },
  /**
   * Trou de visibilité d'un moment (revue du DA, tour 6): le houppier du grand chêne cache le
   * nichoir et le haut de l'échelle depuis la caméra par défaut. Pendant l'attente, l'apogée et
   * l'après de ces moments, ce qui est devant eux s'efface comme devant un joueur (`materiaux.ts`).
   * Centre: l'accroche `hook` de la carte (le clou du nichoir), abaissée de `drop` (m); demi-largeur et demi-hauteur (m);
   * `nearer`: le repère de profondeur est avancé d'autant vers la caméra, pour que l'échelle et le
   * tronc, juste devant le nichoir, restent pleins (seul le feuillage, bien plus près, s'efface).
   */
  momentSeeThrough: {
    moments: ['ladder', 'tits'],
    phases: ['waiting', 'climax', 'after'],
    hook: 'nest_box',
    drop: 0.3,
    halfWidth: 1.1,
    halfHeight: 1.0,
    nearer: 0.35,
    /**
     * Second trou, sur l'habitant mené par la chorégraphie (Basile en haut de son échelle,
     * contrôle du DA après le tour 6): dans les orientations 1 à 3, le nichoir passe derrière le
     * tronc et le trou du lieu se ferme, mais le houppier (orientation 1) ou un sapin de la lisière
     * (orientation 2) cache encore Basile. Tout le décor devant lui s'efface, arbres compris.
     * Centre: ses pieds plus `lift` (m), entre la poitrine et les mains levées; `nearer` comme
     * plus haut: l'échelle et le tronc, à moins d'un mètre devant lui, restent pleins.
     */
    actor: {
      moments: ['ladder'],
      phases: ['climax'],
      villager: 'basile',
      lift: 1.3,
      halfWidth: 0.75,
      halfHeight: 1.0,
      nearer: 0.6,
    },
    /**
     * Trou sur l'eau des étoiles de l'Aubrune (tour 9): les arbres de la rive sud cachent les
     * reflets au sud du ponton en orientation 0. Ellipse autour du milieu des reflets, à la surface.
     */
    water: {
      moments: ['falling_stars'],
      phases: ['waiting', 'climax'],
      halfWidth: 5,
      halfHeight: 3.6,
      nearer: 1,
    },
    /*
     * Pas de trou pour la chevrette ni de trous élargis pour la brume (tour 7): la forêt du
     * pourtour recule derrière le pré de l'est et l'anse (`terrain.forestClearings`), plus rien ne
     * les cache en orientation 0 ni 1 (`foret-pourtour.test.ts`).
     */
  },
  /**
   * Main droite de Basile au bas du nichoir pendant `reach_up` (contrôle du DA après le tour 6:
   * le clip lève la main à hauteur d'épaule, 0,35 m sous la caisse). Cible: le milieu du dessous
   * de la caisse (suit son pivot), avancé de `inset` (m) vers Basile pour que la main tienne le
   * bord avant, visible d'en haut, et relevé de `lift` (m). Poids: monte entre `riseFrom` et
   * `riseTo` (s dans le clip), puis retombe en `releaseSeconds` au début des coups de marteau.
   */
  ladderReach: {
    inset: 0.08,
    lift: 0.02,
    riseFrom: 0.1,
    riseTo: 0.45,
    releaseSeconds: 0.25,
  },
} as const;

export type RenderSettings = typeof RENDER_SETTINGS;

/**
 * Attentes procédurales (`attentes.ts`): rotations d'os ajoutées au clip
 * `idle`, en degrés autour des axes du personnage. `up` (vertical): positif
 * vers sa gauche. `side` (de sa droite à sa gauche): positif penche en avant,
 * négatif lève un bras devant soi. `forward` (devant lui): positif écarte et
 * lève le bras gauche, négatif le droit. `sweeps`: allers-retours sur la durée.
 */
export const IDLE_POSES: Readonly<Record<string, IdlePose>> = {
  /** Regarder autour de soi: à gauche, à droite, revenir. */
  look_around: {
    seconds: 3.4,
    terms: [
      { bone: 'head', axis: 'up', degrees: 38, sweeps: 1 },
      { bone: 'neck', axis: 'up', degrees: 18, sweeps: 1 },
      { bone: 'chest', axis: 'up', degrees: 8, sweeps: 1 },
    ],
  },
  /** S'étirer: bras levés sur les côtés, buste et tête en arrière. */
  stretch: {
    seconds: 2.8,
    raisesArms: true,
    terms: [
      { bone: 'upper_arm_l', axis: 'forward', degrees: 140 },
      { bone: 'upper_arm_r', axis: 'forward', degrees: -140 },
      { bone: 'forearm_l', axis: 'forward', degrees: 20 },
      { bone: 'forearm_r', axis: 'forward', degrees: -20 },
      { bone: 'chest', axis: 'side', degrees: -10 },
      { bone: 'head', axis: 'side', degrees: -18 },
    ],
  },
  /** Regarder ses pieds, en se balançant un peu. */
  look_down: {
    seconds: 2.6,
    terms: [
      { bone: 'head', axis: 'side', degrees: 28 },
      { bone: 'neck', axis: 'side', degrees: 10 },
      { bone: 'chest', axis: 'up', degrees: 8, sweeps: 1 },
    ],
  },
  /** Firmin consulte sa montre (poignet gauche). */
  watch: {
    seconds: 2.6,
    terms: [
      { bone: 'upper_arm_l', axis: 'side', degrees: -45 },
      { bone: 'upper_arm_l', axis: 'up', degrees: -25 },
      { bone: 'forearm_l', axis: 'side', degrees: -80 },
      { bone: 'head', axis: 'side', degrees: 26 },
      { bone: 'head', axis: 'up', degrees: 15 },
    ],
  },
  /** Odette essuie le comptoir, main droite en cercles. */
  wipe: {
    seconds: 3.2,
    terms: [
      { bone: 'upper_arm_r', axis: 'side', degrees: -40 },
      { bone: 'upper_arm_r', axis: 'up', degrees: 18, sweeps: 3 },
      { bone: 'forearm_r', axis: 'side', degrees: -25 },
      { bone: 'chest', axis: 'side', degrees: 10 },
      { bone: 'head', axis: 'side', degrees: 18 },
    ],
  },
  /** Basile s'essuie le front du revers de la main. */
  wipe_brow: {
    seconds: 2.2,
    raisesArms: true,
    terms: [
      { bone: 'upper_arm_r', axis: 'side', degrees: -75 },
      { bone: 'forearm_r', axis: 'side', degrees: -110 },
      { bone: 'upper_arm_r', axis: 'up', degrees: 12, sweeps: 1 },
      { bone: 'head', axis: 'side', degrees: -8 },
    ],
  },
};
