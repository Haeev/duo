/**
 * Essai « encre »: des personnages d'attente, sculptés par script et posés (sans squelette), pour
 * juger le rendu sur des silhouettes vivantes. Environ sept têtes de haut, mains et pieds un peu
 * grossis (décision du client), formes à pans: épaules marquées, tête taillée, coiffe franche.
 * Une fiche (`CharacterSpec`) et une pose suffisent; les vrais personnages viendront du catalogue
 * riggé du lot L5, que la même matière saura rendre.
 */
import * as THREE from 'three';

import { at, type Rgb, type Sculpt } from './formes';

export type Pose = 'debout' | 'marche' | 'assis' | 'parle';

export interface CharacterSpec {
  /** Taille au sommet du crâne, en mètres. */
  readonly height: number;
  /** Corpulence: 1 = moyenne, 0,85 = mince, 1,3 = ronde. */
  readonly girth: number;
  /** Dos voûté (radians): les anciens penchent vers l'avant. */
  readonly stoop: number;
  readonly skin: Rgb;
  readonly hair: Rgb;
  readonly top: Rgb;
  readonly bottom: Rgb;
  readonly accent: Rgb;
  readonly shoes: Rgb;
  /** Longueur du bas du vêtement sous la taille (m): 0,2 veste, 0,6 robe. */
  readonly skirt: number;
  readonly apron?: Rgb;
  readonly headwear: 'casquette' | 'kepi' | 'chignon' | 'couettes' | 'aucune';
  readonly moustache?: boolean;
  readonly scarf?: boolean;
  readonly bag?: boolean;
  readonly basket?: boolean;
  /** Anneau au sol à la couleur du profil (les joueurs seulement, bible 2.10). */
  readonly ring?: Rgb;
}

const INK: Rgb = [0.14, 0.1, 0.09];

/** Fût à pans dont le haut et le bas ont chacun leur largeur et leur profondeur. */
function taper(
  topX: number,
  topZ: number,
  bottomX: number,
  bottomZ: number,
  height: number,
  sides: number,
): THREE.BufferGeometry {
  const geometry = new THREE.CylinderGeometry(1, 1, height, sides, 1);
  const position = geometry.getAttribute('position');
  for (let i = 0; i < position.count; i += 1) {
    const up = position.getY(i) > 0;
    position.setX(i, position.getX(i) * (up ? topX : bottomX));
    position.setZ(i, position.getZ(i) * (up ? topZ : bottomZ));
  }
  return geometry;
}

/** Direction d'un segment de membre: `swing` vers l'avant (+z), `out` vers le côté `side`. */
function reach(swing: number, out: number, side: number): THREE.Vector3 {
  return new THREE.Vector3(
    side * Math.sin(out),
    -Math.cos(swing) * Math.cos(out),
    Math.sin(swing) * Math.cos(out),
  );
}

interface LimbPose {
  /** Segment haut puis segment bas: balancement avant, écart latéral. */
  readonly upper: readonly [number, number];
  readonly lower: readonly [number, number];
}

interface BodyPose {
  readonly legs: readonly [LimbPose, LimbPose];
  readonly arms: readonly [LimbPose, LimbPose];
  readonly lean: number;
  readonly headTurn: number;
}

const POSES: Record<Pose, BodyPose> = {
  debout: {
    legs: [
      { upper: [0.06, 0.05], lower: [-0.02, 0.03] },
      { upper: [-0.05, 0.06], lower: [-0.08, 0.03] },
    ],
    arms: [
      { upper: [0.05, 0.14], lower: [0.3, 0.05] },
      { upper: [-0.08, 0.16], lower: [0.15, 0.02] },
    ],
    lean: 0.02,
    headTurn: 0.25,
  },
  marche: {
    legs: [
      { upper: [0.52, 0.03], lower: [0.18, 0.02] },
      { upper: [-0.36, 0.03], lower: [-0.95, 0.02] },
    ],
    arms: [
      { upper: [-0.5, 0.1], lower: [-0.15, 0.05] },
      { upper: [0.55, 0.1], lower: [1.15, 0.0] },
    ],
    lean: 0.09,
    headTurn: 0,
  },
  assis: {
    legs: [
      { upper: [1.5, 0.1], lower: [0.12, 0.04] },
      { upper: [1.46, 0.14], lower: [-0.1, 0.06] },
    ],
    arms: [
      { upper: [0.35, 0.12], lower: [1.25, -0.1] },
      { upper: [0.3, 0.14], lower: [1.2, -0.12] },
    ],
    lean: -0.06,
    headTurn: -0.3,
  },
  parle: {
    legs: [
      { upper: [0.1, 0.07], lower: [0.0, 0.03] },
      { upper: [-0.08, 0.08], lower: [-0.12, 0.03] },
    ],
    arms: [
      { upper: [0.6, 0.3], lower: [2.0, 0.25] },
      { upper: [-0.1, 0.5], lower: [0.5, -0.9] },
    ],
    lean: 0.05,
    headTurn: -0.2,
  },
};

/**
 * Pose un personnage: pied au point (x, z), tourné de `heading` (0: face au sud, +z). Assis, le
 * bassin est à `seat` mètres du sol de l'objet qui le porte (`ground`).
 */
export function character(
  s: Sculpt,
  spec: CharacterSpec,
  pose: Pose,
  x: number,
  z: number,
  heading: number,
  ground = 0,
  seat = 0.47,
): void {
  const k = spec.height / 1.72;
  const g = spec.girth;
  const body = POSES[pose];
  const thigh = 0.42 * k;
  const shin = 0.4 * k;
  const footY = 0.07 * k;
  const hipHalf = 0.095 * k * (0.8 + 0.2 * g);

  // Hauteur du bassin: la jambe la plus tendue touche le sol; assis, il est sur l'assise.
  const legPoints = body.legs.map((leg, i) => {
    const side = i === 0 ? -1 : 1;
    const hip = new THREE.Vector3(side * hipHalf, 0, 0);
    const knee = hip.clone().addScaledVector(reach(leg.upper[0], leg.upper[1], side), thigh);
    const ankle = knee.clone().addScaledVector(reach(leg.lower[0], leg.lower[1], side), shin);
    return { side, hip, knee, ankle, shinSwing: leg.lower[0] };
  });
  const lowest = Math.min(...legPoints.map((leg) => leg.ankle.y));
  const pelvisY = pose === 'assis' ? seat + 0.1 * k : -lowest + footY;

  s.group(at(x, ground, z, heading), () => {
    if (spec.ring) {
      const ring = new THREE.RingGeometry(0.4, 0.5, 14);
      ring.rotateX(-Math.PI / 2);
      s.add(ring, at(0, 0.015, 0), { color: spec.ring, wobble: 0.012 });
      s.newId();
    }
    const cloth = spec.skirt > 0.4 ? spec.skin : spec.bottom;
    for (const leg of legPoints) {
      s.newId();
      const hip = leg.hip.clone().setY(pelvisY);
      const knee = leg.knee.clone().add(new THREE.Vector3(0, pelvisY, 0));
      const ankle = leg.ankle.clone().add(new THREE.Vector3(0, pelvisY, 0));
      s.limb(hip, knee, 0.085 * k * g, 0.062 * k, 6, {
        color: spec.skirt > 0.4 ? spec.top : spec.bottom,
      });
      s.limb(knee, ankle, 0.064 * k, 0.046 * k, 6, { color: cloth });
      // Pied grossi, pointe vers l'avant; il suit un peu le tibia quand la jambe est levée.
      const lift = pose === 'assis' ? 0 : Math.min(0, leg.shinSwing) * 0.6;
      s.box(
        0.115 * k,
        0.085 * k,
        0.29 * k,
        at(ankle.x, ankle.y - 0.03 * k, ankle.z + 0.075 * k, leg.side * -0.12, -lift, 0),
        {
          color: spec.shoes,
          wobble: 0.01,
        },
      );
    }

    // Tronc: du bassin aux épaules, penché de `lean` plus le dos voûté.
    const tilt = body.lean + spec.stoop;
    const torsoH = 0.56 * k;
    const spine = at(0, pelvisY, 0, 0, tilt, 0);
    s.newId();
    s.inside(spine, () => {
      s.add(
        taper(
          0.235 * k * (0.75 + 0.25 * g),
          0.115 * k * g,
          0.165 * k * g,
          0.115 * k * g,
          torsoH,
          8,
        ),
        at(0, torsoH / 2 + 0.02 * k, 0, Math.PI / 8),
        {
          color: spec.top,
          wobble: 0.012,
        },
      );
      if (spec.skirt > 0) {
        const flare = spec.skirt > 0.4 ? 1.5 : 1.12;
        s.add(
          taper(
            0.17 * k * g,
            0.12 * k * g,
            0.19 * k * g * flare,
            0.14 * k * g * flare,
            spec.skirt * k,
            8,
          ),
          at(
            0,
            0.06 * k - (spec.skirt * k) / 2,
            0,
            Math.PI / 8,
            pose === 'assis' ? -0.9 : -tilt,
            0,
          ),
          {
            color: spec.top,
            wobble: 0.015,
          },
        );
      }
      if (spec.apron) {
        s.newId();
        // Tablier: une bavette, puis un pan qui suit l'évasement de la robe, et le noeud dans le dos.
        const drop = spec.skirt * 0.8 * k;
        s.box(0.19 * k * g, 0.2 * k, 0.025, at(0, 0.36 * k, 0.118 * k * g, 0, -0.04, 0), {
          color: spec.apron,
          wobble: 0.008,
        });
        s.box(0.3 * k * g, 0.2 * k, 0.025, at(0, 0.16 * k, 0.126 * k * g, 0, 0.02, 0), {
          color: spec.apron,
          wobble: 0.01,
        });
        s.box(
          0.34 * k * g,
          drop,
          0.025,
          at(0, 0.06 * k - drop / 2, 0.15 * k * g * 1.16, 0, pose === 'assis' ? -0.9 : -0.13, 0),
          { color: spec.apron, wobble: 0.012 },
        );
        s.box(0.16 * k, 0.07 * k, 0.05 * k, at(0, 0.08 * k, -0.125 * k * g, 0, 0, 0.2), {
          color: spec.apron,
          wobble: 0.01,
        });
      }
      if (spec.bag) {
        s.newId();
        s.box(0.3 * k, 0.36 * k, 0.15 * k, at(0, 0.3 * k, -0.17 * k * g, 0, 0, 0.03), {
          color: spec.accent,
          wobble: 0.02,
        });
        s.box(0.3 * k, 0.1 * k, 0.17 * k, at(0, 0.45 * k, -0.17 * k * g, 0, 0, 0.03), {
          color: spec.bottom,
          wobble: 0.01,
        });
      }
      if (spec.ring) {
        // Écusson du profil sur la poitrine.
        s.newId();
        s.cyl(
          0.045 * k,
          0.045 * k,
          0.02,
          6,
          at(0.09 * k, 0.43 * k, 0.11 * k * g, 0, Math.PI / 2, 0),
          { color: spec.ring, wobble: 0.003 },
        );
      }

      // Bras: l'épaule est en haut du tronc, la main est grossie.
      body.arms.forEach((arm, i) => {
        const side = i === 0 ? -1 : 1;
        s.newId();
        const shoulder = new THREE.Vector3(
          side * (0.225 * k * (0.75 + 0.25 * g) + 0.02),
          torsoH - 0.03 * k,
          0,
        );
        const elbow = shoulder
          .clone()
          .addScaledVector(reach(arm.upper[0], arm.upper[1], side), 0.29 * k);
        const wrist = elbow
          .clone()
          .addScaledVector(reach(arm.lower[0], arm.lower[1], side), 0.26 * k);
        s.limb(shoulder, elbow, 0.066 * k * g, 0.052 * k, 6, { color: spec.top });
        s.blob(
          0.07 * k * g,
          0.06 * k,
          0.07 * k * g,
          at(shoulder.x, shoulder.y, shoulder.z),
          { color: spec.top, wobble: 0.008 },
          0,
        );
        s.limb(elbow, wrist, 0.052 * k, 0.04 * k, 6, { color: spec.top });
        s.cyl(0.046 * k, 0.046 * k, 0.03 * k, 6, at(wrist.x, wrist.y, wrist.z), {
          color: spec.accent,
          wobble: 0.004,
        });
        const hand = wrist
          .clone()
          .addScaledVector(reach(arm.lower[0], arm.lower[1], side), 0.06 * k);
        s.box(0.085 * k, 0.11 * k, 0.07 * k, at(hand.x, hand.y, hand.z, 0, -arm.lower[0], 0), {
          color: spec.skin,
          wobble: 0.012,
        });
        if (spec.basket && i === 0) {
          s.newId();
          s.add(taper(0.17, 0.12, 0.13, 0.09, 0.16, 6), at(hand.x, hand.y - 0.2, hand.z), {
            color: [0.78, 0.6, 0.35],
            wobble: 0.012,
          });
          s.box(0.03, 0.2, 0.03, at(hand.x, hand.y - 0.06, hand.z), { color: [0.6, 0.42, 0.25] });
        }
      });

      // Cou et tête: crâne large, mâchoire étroite, nez en coin (il dit où regarde le personnage).
      s.newId();
      const neckY = torsoH + 0.02 * k;
      s.cyl(0.045 * k, 0.055 * k, 0.08 * k, 5, at(0, neckY + 0.02 * k, 0.01), { color: spec.skin });
      if (spec.scarf) {
        s.newId();
        s.add(
          taper(0.085 * k, 0.085 * k, 0.11 * k, 0.1 * k, 0.09 * k, 6),
          at(0, neckY + 0.01 * k, 0.005),
          { color: spec.accent, wobble: 0.01 },
        );
        s.box(
          0.08 * k,
          0.26 * k,
          0.03,
          at(-0.07 * k, neckY - 0.13 * k, 0.12 * k * g, 0, -0.08, 0.1),
          { color: spec.accent, wobble: 0.012 },
        );
      }
      const headH = 0.245 * k;
      s.inside(
        at(
          0,
          neckY + 0.05 * k + headH / 2,
          0.02 * k + spec.stoop * 0.12,
          body.headTurn,
          -tilt * 0.7,
          0,
        ),
        () => {
          s.add(
            taper(0.098 * k, 0.108 * k, 0.062 * k, 0.07 * k, headH, 6),
            at(0, 0, 0, Math.PI / 6),
            { color: spec.skin, wobble: 0.008 },
          );
          s.box(0.035 * k, 0.06 * k, 0.05 * k, at(0, -0.02 * k, 0.1 * k, 0, 0.25, 0), {
            color: spec.skin,
            wobble: 0.004,
          });
          for (const side of [-1, 1]) {
            s.box(0.03 * k, 0.04 * k, 0.014, at(side * 0.045 * k, 0.02 * k, 0.094 * k), {
              color: INK,
              wobble: 0.002,
            });
            s.box(
              0.05 * k,
              0.014 * k,
              0.014,
              at(side * 0.047 * k, 0.058 * k, 0.098 * k, 0, 0, side * -0.25),
              { color: spec.hair, wobble: 0.002 },
            );
            s.box(0.03 * k, 0.07 * k, 0.045 * k, at(side * 0.1 * k, 0.0, 0.0), {
              color: spec.skin,
              wobble: 0.004,
            });
          }
          if (!spec.moustache) {
            s.box(0.05 * k, 0.014 * k, 0.012, at(0.004 * k, -0.075 * k, 0.078 * k, 0, 0, 0.06), {
              color: [0.64, 0.28, 0.25],
              wobble: 0.002,
            });
          }
          if (spec.moustache) {
            s.box(0.11 * k, 0.03 * k, 0.03 * k, at(0, -0.06 * k, 0.085 * k, 0, 0, 0.04), {
              color: spec.hair,
              wobble: 0.006,
            });
          }
          s.newId();
          // Cheveux: une calotte taillée, plus basse sur la nuque.
          s.add(
            taper(0.095 * k, 0.1 * k, 0.112 * k, 0.118 * k, 0.11 * k, 6),
            at(0, headH / 2 - 0.02 * k, -0.012 * k, Math.PI / 6),
            { color: spec.hair, wobble: 0.012 },
          );
          s.box(0.19 * k, 0.15 * k, 0.07 * k, at(0, 0.01 * k, -0.09 * k), {
            color: spec.hair,
            wobble: 0.012,
          });
          switch (spec.headwear) {
            case 'casquette':
              s.newId();
              s.add(
                taper(0.125 * k, 0.135 * k, 0.115 * k, 0.12 * k, 0.065 * k, 6),
                at(0, headH / 2 + 0.055 * k, 0, Math.PI / 6, 0.1, 0),
                { color: spec.accent, wobble: 0.01 },
              );
              s.box(
                0.17 * k,
                0.025 * k,
                0.11 * k,
                at(0, headH / 2 + 0.03 * k, 0.15 * k, 0, 0.18, 0),
                { color: spec.accent, wobble: 0.008 },
              );
              break;
            case 'kepi':
              s.newId();
              s.add(
                taper(0.098 * k, 0.1 * k, 0.108 * k, 0.112 * k, 0.11 * k, 8),
                at(0, headH / 2 + 0.085 * k, 0),
                { color: spec.bottom, wobble: 0.006 },
              );
              s.add(
                taper(0.111 * k, 0.115 * k, 0.111 * k, 0.115 * k, 0.04 * k, 8),
                at(0, headH / 2 + 0.045 * k, 0),
                { color: spec.accent, wobble: 0.004 },
              );
              s.box(
                0.16 * k,
                0.02 * k,
                0.09 * k,
                at(0, headH / 2 + 0.03 * k, 0.14 * k, 0, 0.2, 0),
                { color: INK, wobble: 0.006 },
              );
              break;
            case 'chignon':
              s.blob(
                0.075 * k,
                0.07 * k,
                0.075 * k,
                at(0, headH / 2 + 0.07 * k, -0.06 * k),
                { color: spec.hair, wobble: 0.012 },
                0,
              );
              break;
            case 'couettes':
              for (const side of [-1, 1]) {
                s.newId();
                s.limb(
                  new THREE.Vector3(side * 0.1 * k, 0.03 * k, -0.04 * k),
                  new THREE.Vector3(side * 0.2 * k, -0.1 * k, -0.07 * k),
                  0.035 * k,
                  0.055 * k,
                  5,
                  { color: spec.hair },
                );
                s.box(0.05 * k, 0.05 * k, 0.05 * k, at(side * 0.11 * k, 0.03 * k, -0.04 * k), {
                  color: spec.accent,
                });
              }
              break;
            case 'aucune':
              break;
          }
        },
      );
    });
  });
}
