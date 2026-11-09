/**
 * Guide de Simone pour l'installation (démo v0.3, section 6): fonction pure qui déduit tout du
 * monde partagé, comme le guide du premier service. Actif le lundi de l'installation et le grand
 * jour jusqu'à la pancarte; ensuite le guide du service prend le relais.
 */
import type { GuideFocus, GuideStep, GuideView } from '../branchement/guide';
import type { Content } from '../donnees/charger';
import type { PlayerIndex, World } from '../etat/monde';
import type { InstallationContent } from './donnees';
import {
  appliances,
  installationOf,
  missingNeeds,
  needBought,
  needInstalled,
  seatsInside,
} from './regles';

interface Step extends GuideStep {
  readonly say: string;
  readonly focus: GuideFocus | null;
}

function fill(text: string, values: Readonly<Record<string, string | number>>): string {
  let out = text;
  for (const [k, v] of Object.entries(values)) out = out.replaceAll(`{${k}}`, String(v));
  return out;
}

const furniture = (id: string | null | undefined): GuideFocus | null =>
  id === null || id === undefined ? null : { kind: 'furniture', id };

/** Le guide de l'installation pour ce joueur, ou `null` hors de l'installation. */
export function installGuideOf(
  content: Content,
  world: World,
  player: PlayerIndex,
): GuideView | null {
  const i = installationOf(world);
  const ic: InstallationContent | null = content.installation;
  if (i === null || ic === null || i.stage === 'opened') return null;
  const s = world.clientele;
  if (s.day === 0) return null;
  const g = ic.texts.guide;
  const T = (key: string, values: Readonly<Record<string, string | number>> = {}): string =>
    fill(g[key] ?? key, values);
  const cell = ic.cell;
  const a = appliances(content, world);
  const steps: Step[] = [];
  const step = (
    chapter: string,
    label: string,
    done: boolean,
    say: string,
    focus: GuideFocus | null,
    optional = false,
  ): void => {
    steps.push({ chapter, label, done, optional, say, focus });
  };

  if (i.stage === 'bigday') {
    const c = T('chapterBigDay');
    step(
      c,
      T('stepShutter'),
      i.shutter === 'up',
      T('sayShutter'),
      furniture(cell.shutters.find((x) => x.door)?.id),
    );
  } else {
    const c1 = T('chapterOpen');
    step(
      c1,
      T('stepShutter'),
      i.shutter === 'up',
      T('sayShutter'),
      furniture(cell.shutters.find((x) => x.door)?.id),
    );
    step(c1, T('stepMail'), i.mail, '', furniture(cell.mail.id), true);
    const counterSheet = cell.sheets[0]?.id ?? '';
    step(
      c1,
      T('stepSheets'),
      !i.sheets.includes(counterSheet),
      T('saySheets'),
      furniture(i.sheets[0]),
    );

    const c2 = T('chapterCounter');
    step(c2, T('stepMachine'), a.machine !== null, T('sayMachine'), furniture(cell.oldMachine));
    const three = (['moulin', 'caisse', 'vaisselle'] as const).filter((n) =>
      needBought(content, world, n),
    ).length;
    step(
      c2,
      T('stepBuy', { n: three }),
      three === 3,
      T('sayBuy', { missing: missingNeeds(content, world).join(', ') }),
      null,
    );
    const outside = i.cartons.filter(([carton]) => {
      const f = world.furniture.find((x) => x.id === carton);
      const [ax, az, aw, ad] = cell.deliveryArea;
      return f !== undefined && f.x >= ax && f.x <= ax + aw && f.z >= az && f.z <= az + ad;
    });
    const required = ['machine', 'moulin', 'caisse', 'vaisselle'] as const;
    const allBought = required.every((n) => needBought(content, world, n));
    step(
      c2,
      T('stepCartons'),
      allBought && i.deliveries.length === 0 && outside.length === 0,
      i.deliveries.length > 0 && outside.length === 0 ? T('sayWaitGaby') : T('sayCartons'),
      furniture(outside[0]?.[0]),
    );
    const missingItem = (
      [
        ['machine', 'itemMachine'],
        ['moulin', 'itemGrinder'],
        ['caisse', 'itemRegister'],
        ['vaisselle', 'itemDishes'],
      ] as const
    ).find(([n]) => !needInstalled(content, world, n));
    const missingSpot =
      missingItem === undefined
        ? null
        : (cell.appliances.find(
            (x) =>
              x.reason ===
              { machine: 'machine', moulin: 'grinder', caisse: 'register', vaisselle: 'dishes' }[
                missingItem[0]
              ],
          )?.id ?? null);
    step(
      c2,
      T('stepPlace'),
      missingItem === undefined,
      T('sayPlace', { item: g[missingItem?.[1] ?? 'itemMachine'] ?? '' }),
      // La place vide n'a pas de meuble: on encadre le comptoir, sinon rien.
      missingSpot === null || world.furniture.some((f) => f.id === missingSpot)
        ? null
        : furniture(missingSpot.startsWith('station-2') ? 'backbar-1' : 'counter-1'),
    );
    step(
      c2,
      T('stepConnect'),
      a.ready,
      a.connected ? T('sayHeat') : T('sayConnect'),
      furniture(a.machinePlaced ? cell.oldMachine : null),
    );
    step(c2, T('stepTrial'), i.machine.tested, T('sayTrial'), null, true);

    const c3 = T('chapterRoom');
    const seats = seatsInside(content, world);
    const advised = ic.rules.seatsAdvised;
    step(
      c3,
      T('stepSeats', { n: Math.min(seats, advised), of: advised }),
      seats >= advised,
      ic.texts.seatsReminder,
      null,
      true,
    );
    step(c3, T('stepFridge'), a.fridge, '', null, true);
    const dustTotal = cell.dust.length;
    step(
      c3,
      T('stepDust', { n: dustTotal - i.dust.length, of: dustTotal }),
      i.dust.length === 0,
      ic.texts.dustReminder,
      furniture(i.dust[0]),
      true,
    );
    const paneTotal = cell.panes.length;
    step(
      c3,
      T('stepPanes', { n: paneTotal - i.panes.length, of: paneTotal }),
      i.panes.length === 0,
      ic.texts.panesReminder,
      furniture(i.panes[0]),
      true,
    );

    const c4 = T('chapterBefore');
    const slateOk = s.slate.some(([id]) => {
      const r = content.clientele.recipes.get(id);
      return r?.stations.every((st) => (s.stations[st] ?? 0) > 0) ?? false;
    });
    step(c4, T('stepSlate'), slateOk, T('saySlate'), null);
    step(c4, T('stepOrder'), s.order !== null, T('sayOrder'), null);
    step(c4, T('stepName'), s.houseName !== null, T('sayName'), null);
    step(c4, T('stepTomorrow'), false, T('sayDone'), null);
  }
  const c5 = T('chapterBigDay');
  step(c5, T('stepSign'), false, T('saySign'), null);

  // Étape en cours: la première non faite et obligatoire (les facultatives se rappellent à la fin
  // de leur chapitre, une fois les obligatoires faites).
  let current = steps.findIndex((x) => x.done !== true && x.optional !== true);
  if (current < 0) current = steps.length - 1;
  const now = steps[current];
  let say = now?.say ?? '';
  let focus = now?.focus ?? null;
  // Tout l'obligatoire du lundi est fait: Simone rappelle ce qui reste de facultatif.
  if (i.stage === 'setup' && now?.label === T('stepTomorrow')) {
    const left = steps.find((x) => x.optional === true && x.done !== true && x.say !== '');
    if (left !== undefined) {
      say = left.say;
      focus = left.focus;
    }
  }
  if (world.arrangement.carry !== null && world.arrangement.carry.handles[player] !== null)
    say = T('sayCarry');
  return {
    title: i.stage === 'bigday' ? T('titleBigDay') : T('title'),
    recipe: null,
    steps,
    current,
    say,
    focus,
  };
}
