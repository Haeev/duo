// Contenu et rythme (gauntlet, tour 3, revue `docs/jeux/jeu-1/gauntlet/revues/tour-01-contenu-coop.md`,
// D1): part des redites du quotidien, mesurée comme la revue (le premier joueur parle une fois par jour
// à chaque habitant présent, à 13 h, toute la démo jouée par les robots). Avant la règle « la moins
// récente » (R4 du plan des 100 heures): 60 % de redites (32 sur 53), graine 20261030.
import { isHome } from '../src/etat/interieurs';
import { describe, expect, it } from 'vitest';
import { type Sim, character } from '../src/simulation/contexte';
import { heardReveals } from '../src/simulation/voisins';
import { SIM_HZ } from '../src/simulation/constantes';
import { eligibleDailies, hearDialogue, pickDialogue } from '../src/simulation/dialogues';
import { step } from '../src/simulation/pas';
import { createRobot, newSim } from './aides';

/**
 * Seuil de la part de redites. Elle dépend surtout du nombre de répliques écrites (le game designer
 * en ajoute); la règle, elle, se prouve par les redites évitables (une réplique redite alors qu'une
 * autre, possible, n'avait jamais été entendue), qui doivent être nulles.
 */
const MAX_REPEAT_SHARE = 0.1;
/** Entrées et sorties de la maison par jour et par robot (la recette en relevait 900). */
const MAX_DOOR_CROSSINGS = 60;
/**
 * Borne de la partie des robots (pas de simulation): la démo doit aller au bout. Depuis la journée
 * doublée (0,7 s par minute de jeu), 15 jours dépassent 4 h de simulation; 2 h coupaient au jour 10.
 */
const MAX_TICKS = SIM_HZ * 60 * 60 * 8;

interface Measure {
  conversations: number;
  repeats: number;
  /** Redites alors qu'une réplique possible n'avait jamais été entendue. */
  avoidable: number;
  doorPerDay: Map<number, number>;
  sim: Sim;
}

function measure(seed: number): Measure {
  const sim = newSim(seed);
  const robot = createRobot();
  const heard = new Set<string>();
  const out: Measure = { conversations: 0, repeats: 0, avoidable: 0, doorPerDay: new Map(), sim };
  let talkedOn = 0;
  const inside = sim.world.characters.map((c) => isHome(c));
  while (sim.world.phase !== 'ended' && sim.world.tick < MAX_TICKS) {
    step(sim, robot.decide(sim));
    const w = sim.world;
    w.characters.forEach((c, i) => {
      if (isHome(c) === inside[i]) return;
      inside[i] = isHome(c);
      out.doorPerDay.set(w.clock.day, (out.doorPerDay.get(w.clock.day) ?? 0) + 1);
    });
    if (w.phase !== 'day' || w.scene !== null || w.clock.minutes < 13 * 60 || w.clock.day === talkedOn) continue;
    talkedOn = w.clock.day;
    for (const v of w.villagers) {
      if (!v.visible) continue;
      const d = pickDialogue(sim, v.id, 'p1');
      if (d?.kind !== 'daily') continue;
      out.conversations++;
      if (heard.has(d.id)) out.repeats++;
      // Les répliques datées (priorité haute) passent d'abord par choix; la règle se juge sur les autres,
      // d'après tout ce que ce joueur a entendu (conversations des robots comprises).
      const story = sim.content.settings.feel.dailyStoryPriority;
      const known = sim.world.heard.p1;
      const never = eligibleDailies(sim, v.id, 'p1').some((e) => e.priority < story && known[e.id] === undefined);
      if (d.priority < story && known[d.id] !== undefined && never) out.avoidable++;
      heard.add(d.id);
      hearDialogue(sim, 'p1', d);
      // 0.13: entendue jusqu'au bout, une réplique révélatrice écrit son habitude (fin de conversation).
      heardReveals(sim, character(sim, 'p1'), d);
    }
  }
  return out;
}

describe('contenu et rythme', () => {
  const run = measure(20261030);

  it(`redites du quotidien sous ${String(MAX_REPEAT_SHARE * 100)} % (une conversation par habitant et par jour)`, () => {
    // Mesure sur toute la démo, jusqu'à l'écran de fin du jour 15.
    expect(run.sim.world.phase).toBe('ended');
    expect(run.sim.world.stages.current).toBe('demo');
    expect(run.conversations).toBeGreaterThan(40);
    const share = run.repeats / run.conversations;
    expect(share, `${String(run.repeats)} redites sur ${String(run.conversations)}`).toBeLessThan(MAX_REPEAT_SHARE);
  });

  it('aucune redite évitable: une réplique jamais entendue passe avant une redite', () => {
    expect(run.avoidable).toBe(0);
  });

  it('la mémoire des répliques entendues reste légère (sauvegardée et transmise)', () => {
    const bytes = JSON.stringify(run.sim.world.heard).length;
    expect(bytes).toBeLessThan(4 * 1024);
  });

  it('les robots ne tournent pas en rond à la porte', () => {
    for (const [day, n] of run.doorPerDay) expect(n, `jour ${String(day)}`).toBeLessThan(MAX_DOOR_CROSSINGS);
  });
});
