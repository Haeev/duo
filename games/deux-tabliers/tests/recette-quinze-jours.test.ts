// Recette de nuit (2026-11-08): les quinze jours de la démo enchaînés sans saut, à deux joueurs
// dans Node. Le duo vote, prend chaque commande à la caisse par le vrai poste (Agir maintenu),
// achète la terrasse et un pot de fleurs à deux; la préparation est celle d'office de
// `regles.json` (les gestes sont couverts par `journee.test.ts` et `service.test.ts`).
// Vérifie: aucune exception, chaque journée finit, chaque vote passe, caisse et stock entiers et
// cohérents, sauvegarde reprise en plein service avec les rôles inversés, fin de démo au jour 15.
import { createRandom } from '@duo/sdk';
import { describe, expect, it } from 'vitest';
import { cartonStowed, takeServiceOutbox } from '../src/clientele';
import { loadContent, type Content } from '../src/donnees/charger';
import { DATA_FILES } from '../src/donnees/fichiers';
import { WORLD_FORMAT, type PlayerIndex, type World } from '../src/etat/monde';
import { restoreWorld } from '../src/session';
import { IDLE_INPUT, type Intent, type StepInput } from '../src/simulation/entrees';
import type { GameEvent } from '../src/simulation/evenements';
import { createWorld } from '../src/simulation/monde';
import { stepWorld, type QueuedIntent } from '../src/simulation/pas';

const DT = 1 / 60;

/** Journée accélérée (une minute de jeu en 0,05 s) et préparation d'office en 4 s. */
function fastContent(): Content {
  const days = DATA_FILES['clientele/journees.json'] as Record<string, unknown>;
  const content = loadContent({
    ...DATA_FILES,
    'clientele/journees.json': {
      ...days,
      secondsPerGameMinute: 0.05,
      peacefulSecondsPerGameMinute: 0.06,
    },
  });
  const cc = content.clientele;
  return { ...content, clientele: { ...cc, rules: { ...cc.rules, fallbackPrepSeconds: 4 } } };
}

interface DayLog {
  day: number;
  phaseAtStart: string;
  served: number;
  cashEvening: number;
  stepsInService: number;
  maxQueue: number;
}

describe('Deux Tabliers, recette des quinze jours', () => {
  it('du jour 1 à la fin de la démo, avec achats, reprise et rôles inversés', () => {
    let content = fastContent();
    let world: World = createWorld(content, ['membre-a', 'membre-b']);
    const random = createRandom(2026);
    const events: GameEvent[] = [];
    const held: [boolean, boolean] = [false, false];
    const input = (p: PlayerIndex): StepInput => ({ ...IDLE_INPUT, actHeld: held[p] });
    const step = (intents: QueuedIntent[] = []): void => {
      stepWorld(content, world, [input(0), input(1)], intents, DT, random, (e) => events.push(e));
      const box = takeServiceOutbox(world);
      for (const [ing] of box.cartons) cartonStowed(world, ing);
    };
    const both = (intent: Intent): void => {
      step([
        { player: 0, intent },
        { player: 1, intent },
      ]);
    };
    const checkMoney = (where: string): void => {
      const s = world.clientele;
      expect(Number.isInteger(s.cash), `caisse entière ${where}`).toBe(true);
      for (const [id, n] of Object.entries(s.stock)) {
        expect(Number.isFinite(n), `${id} fini ${where}`).toBe(true);
        expect(n, `${id} positif ${where}`).toBeGreaterThanOrEqual(0);
      }
    };
    // La caisse se tient par le vrai poste: l'hôte à sa place, Agir maintenu trois secondes.
    const takeOrderAtRegister = (): void => {
      world.players[0].x = 10.4;
      world.players[0].z = 8.3;
      held[0] = true;
      step([
        { player: 0, intent: { type: 'act', target: { kind: 'station', furniture: 'station-6' } } },
      ]);
      // Maintenu jusqu'à l'encaissement (une commande de neuf articles demande plus longtemps).
      const g0 = world.clientele.groups.find((g) => g.stage === 'register');
      for (let i = 0; i < 20 / DT && g0?.stage === 'register'; i++) step();
      held[0] = false;
      step();
    };

    const logs: DayLog[] = [];
    let resumed = false;
    let terraceBoughtDay = 0;
    step();
    let guardDays = 0;
    while (!world.clientele.demoEnded && guardDays++ < 40) {
      const s = world.clientele;
      const day = s.day;
      const log: DayLog = {
        day,
        phaseAtStart: s.phase,
        served: 0,
        cashEvening: 0,
        stepsInService: 0,
        maxQueue: 0,
      };
      if (s.phase === 'monday') {
        if (day === 15) {
          both({ type: 'clientele-vote', topic: 'next-day', yes: true });
          step([
            { player: 0, intent: { type: 'clientele-vote', topic: 'merelles', yes: true } },
            { player: 1, intent: { type: 'clientele-vote', topic: 'merelles', yes: false } },
          ]);
          logs.push(log);
          break;
        }
        both({ type: 'clientele-vote', topic: 'next-day', yes: true });
        expect(world.clientele.day, `lundi ${String(day)} franchi`).toBe(day + 1);
        logs.push(log);
        continue;
      }
      expect(s.phase, `matin du jour ${String(day)}`).toBe('prep');
      both({ type: 'clientele-vote', topic: 'open', yes: true });
      expect(world.clientele.phase, `ouverture du jour ${String(day)}`).toBe('service');
      let guard = 0;
      while (world.clientele.phase === 'service' || world.clientele.phase === 'closing') {
        if (guard++ > 60 * 60 * 20) {
          const c0 = world.clientele;
          throw new Error(
            `journée ${String(day)} sans fin: ${JSON.stringify({
              phase: c0.phase,
              serviceSec: c0.serviceSec,
              arrivals: c0.arrivals.length,
              groups: c0.groups.map((g) => [
                g.id,
                g.stage,
                g.size,
                g.role,
                g.regular,
                g.open,
                g.paid,
              ]),
              scene: (c0 as unknown as Record<string, unknown>).scene,
              tickets: world.service.tickets.length,
              waiting: world.service.waiting.length,
              lastEvents: events.slice(-15),
            })}`,
          );
        }
        const c = world.clientele;
        log.maxQueue = Math.max(
          log.maxQueue,
          c.groups.filter((g) => g.stage === 'queue' || g.stage === 'register').length,
        );
        if (c.groups.some((g) => g.stage === 'register') && guard % 60 === 0) takeOrderAtRegister();
        else step();
        // Sauvegarde au milieu du service du jour 9, reprise avec l'hôte et l'invité inversés.
        if (!resumed && day === 9 && c.today.served >= 3) {
          resumed = true;
          const snapshot = JSON.parse(JSON.stringify(world)) as unknown;
          const back = restoreWorld(snapshot, WORLD_FORMAT, ['membre-b', 'membre-a']);
          expect(back, 'reprise valide').not.toBeNull();
          if (back === null) throw new Error('reprise refusée');
          expect(back.players[0].memberId).toBe('membre-b');
          expect(back.clientele.cash).toBe(world.clientele.cash);
          world = back;
          content = fastContent();
        }
      }
      log.stepsInService = guard;
      expect(world.clientele.phase, `soir du jour ${String(day)}`).toBe('evening');
      log.served = world.clientele.report?.served ?? -1;
      checkMoney(`soir ${String(day)}`);
      // R2-03: le résultat du bilan est la somme de ses lignes; R2-13: caisse jamais sous zéro.
      const r = world.clientele.report;
      expect(r, `bilan du jour ${String(day)}`).not.toBeNull();
      if (r !== null)
        expect(r.result, `résultat du jour ${String(day)}`).toBe(
          r.revenue +
            r.tips +
            r.eventEuros -
            r.goods -
            r.shipping -
            r.emergency -
            r.rent -
            r.charges,
        );
      expect(world.clientele.cash, `caisse du soir ${String(day)}`).toBeGreaterThanOrEqual(0);
      // Le soir: achats proposés par l'un, acceptés par l'autre.
      if (day >= 7 && terraceBoughtDay === 0) {
        // Le robot ne sert que six groupes par jour: la caisse est renflouée pour l'achat.
        world.clientele.cash += 60_000;
        const before = world.clientele.cash;
        step([
          {
            player: 0,
            intent: { type: 'amenagement-acheter', item: 'village-terrasse', room: null },
          },
        ]);
        step([{ player: 1, intent: { type: 'amenagement-repondre', accept: true } }]);
        terraceBoughtDay = day;
        expect(world.clientele.cash, 'terrasse payée 450 €').toBe(before - 45_000);
      }
      if (day === 3) {
        step([
          {
            player: 1,
            intent: { type: 'amenagement-acheter', item: 'bouquet-champetre', room: null },
          },
        ]);
        step([{ player: 0, intent: { type: 'amenagement-repondre', accept: true } }]);
      }
      checkMoney(`après achats ${String(day)}`);
      log.cashEvening = world.clientele.cash;
      logs.push(log);
      both({ type: 'clientele-vote', topic: 'next-day', yes: true });
    }

    const s = world.clientele;
    const report = {
      terraceBoughtDay,
      logs,
      eventsDone: s.eventsDone,
      letterDay: s.letterDay,
      purchases: s.purchases,
    };
    expect(resumed).toBe(true);
    expect(s.demoEnded, JSON.stringify(report)).toBe(true);
    expect(s.phase).toBe('end');
    // La terrasse achetée par la tablette est ouverte côté aménagement (coque, meubles).
    expect(world.arrangement.extensions).toContain('village-terrasse');
    expect(s.letterDay).toBeGreaterThan(0);
    expect(s.letterDay).toBeLessThanOrEqual(14);
    for (const id of [
      'le_car_de_8h12',
      'la_vieille_dame_tousse',
      'les_godillots',
      'jules_a_perdu_sa_mamie',
      'l_inspection',
      'le_cafe_d_honneur',
      'le_coeur_de_lait',
      'la_fete_du_tilleul',
    ])
      expect(['reussi', 'formidable'], `${id}: ${JSON.stringify(report)}`).toContain(
        s.eventsDone[id],
      );
    for (const l of logs.filter((x) => x.phaseAtStart === 'prep'))
      expect(l.served, `servis le jour ${String(l.day)}`).toBeGreaterThan(0);
    const refusals = events.filter((e) => e.type === 'refused');
    expect(refusals.length, JSON.stringify(refusals.slice(0, 5))).toBeLessThan(5_000);
    if (process.env.RECETTE_JOURNAL !== undefined)
      process.stdout.write(`${JSON.stringify({ ...report, refusals: refusals.slice(0, 40) })}\n`);
  }, 240_000);
});
