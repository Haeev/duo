/**
 * L'hôte fait autorité (ADR 0007, `host-authority`): il simule tout le monde,
 * applique les intentions des deux joueurs dans leur ordre d'arrivée et
 * envoie à l'invité l'état, les positions et les événements.
 */
import { movingAnimals } from '../etat/elevage';
import type { Net, NetChannel } from '@duo/sdk';
import type { ControlFrame, Intent } from '../etat/actions';
import type { CharacterId, WorldEvent } from '../etat/types';
import { MOVE_DEADZONE } from '../simulation/constantes';
import type { Sim } from '../simulation/contexte';
import { step } from '../simulation/pas';
import {
  CHANNEL,
  EventsMessageSchema,
  FastSnapshotSchema,
  GuestInputSchema,
  ShadowsMessageSchema,
  WorldMessageSchema,
  type EventsMessage,
  type FastSnapshot,
  type GuestInput,
  type ShadowsMessage,
  type WorldMessage,
} from './schemas';
import { sentWorld } from './etat-transmis';

/**
 * Commandes de l'invité gardées d'avance (coussin contre la gigue): au-delà, on rattrape le retard
 * en écartant celles qui ne changent rien (immobile, Espace dans le même état que la précédente).
 */
const IDLE_BUFFERED_FRAMES = 1;
/**
 * Au-delà, on écarte aussi des pas de marche (filet de sécurité: l'invité reculerait alors
 * d'autant). Sur le lien du banc (80 ms, 20 ms de gigue, réémission de 200 ms), le retard reste
 * sous 8 commandes: 12 (400 ms) n'est atteint que par une machine figée.
 */
const MAX_BUFFERED_FRAMES = 12;
/** Sans nouvelles de l'invité pendant ce nombre de pas (200 ms à 30 pas par seconde), ses commandes sont relâchées. */
const STALE_FRAMES = 6;
/** L'état complet part au plus tous les N pas (5 fois par seconde), et seulement s'il a changé. */
const WORLD_EVERY_TICKS = 6;
/** Au moins un état complet toutes les N pas, même sans changement (filet de sécurité). */
const WORLD_KEEPALIVE_TICKS = 90;

export interface HostChannels {
  input: NetChannel<GuestInput>;
  world: NetChannel<WorldMessage>;
  fast: NetChannel<FastSnapshot>;
  events: NetChannel<EventsMessage>;
  shadows: NetChannel<ShadowsMessage>;
}

export function openHostChannels(net: Net): HostChannels {
  return {
    input: net.channel(CHANNEL.guestInput, { mode: 'reliable', schema: GuestInputSchema }),
    world: net.channel(CHANNEL.world, { mode: 'latest', schema: WorldMessageSchema }),
    fast: net.channel(CHANNEL.fast, { mode: 'latest', schema: FastSnapshotSchema }),
    events: net.channel(CHANNEL.events, { mode: 'reliable', schema: EventsMessageSchema }),
    shadows: net.channel(CHANNEL.shadows, { mode: 'latest', schema: ShadowsMessageSchema }),
  };
}

export interface Host {
  /** Intention du joueur de l'hôte (appliquée au prochain pas, à son rang d'arrivée). */
  queueLocal(intent: Intent): void;
  /** Un pas: commandes du joueur local, puis envoi à l'invité. Renvoie les événements du pas. */
  step(local: ControlFrame): readonly WorldEvent[];
  /** Envoie tout de suite un instantané rapide puis l'état complet (départ, reprise de partie). */
  sendWorld(): void;
  dispose(): void;
}

export function createHost(sim: Sim, channels: HostChannels, local: CharacterId, remote: CharacterId): Host {
  const pending: { by: CharacterId; intent: Intent }[] = [];
  const guestFrames: ControlFrame[] = [];
  let lastGuest: ControlFrame | null = null;
  let lastQueuedSeq = -1;
  let ack = -1;
  let stale = 0;
  let sentRevision = -1;
  let lastWorldTick = -WORLD_EVERY_TICKS;
  /** Ombres du dernier envoi, en JSON (`null`: rien d'envoyé encore). */
  let sentShadows: string | null = null;

  const unsubscribe = channels.input.onMessage((message) => {
    for (const f of message.frames) {
      if (f.seq <= lastQueuedSeq) continue;
      lastQueuedSeq = f.seq;
      guestFrames.push(f);
    }
    for (const intent of message.intents) pending.push({ by: remote, intent });
  });

  /** La commande ne change rien après `before`: ni pas, ni appui ou relâchement d'Espace. */
  function idleAfter(f: ControlFrame, before: ControlFrame | null): boolean {
    return Math.hypot(f.moveX, f.moveY) < MOVE_DEADZONE && f.actHeld === (before?.actHeld ?? false);
  }

  /**
   * Rattrapage d'un retard (rafale après un trou). On n'écarte jamais un pas de marche sous le
   * plafond: l'invité compte chaque commande jusqu'à `ack` comme jouée et ne rejoue que les
   * suivantes. Un pas écarté laisserait sa prédiction en avance d'autant, et il reculerait à
   * l'arrêt (deux pas écartés: 23 cm, graine 7 du banc de gigue).
   */
  function catchUp(): void {
    let before = lastGuest;
    for (let i = 0; i < guestFrames.length && guestFrames.length > IDLE_BUFFERED_FRAMES; ) {
      const f = guestFrames[i];
      if (f === undefined) break;
      if (idleAfter(f, before)) guestFrames.splice(i, 1);
      else {
        before = f;
        i += 1;
      }
    }
    if (guestFrames.length > MAX_BUFFERED_FRAMES) guestFrames.splice(0, guestFrames.length - MAX_BUFFERED_FRAMES);
  }

  function nextGuestFrame(): ControlFrame | undefined {
    // Une commande déjà jouée d'avance (devinée, voir plus bas) est écartée à son arrivée.
    while ((guestFrames[0]?.seq ?? Number.POSITIVE_INFINITY) <= ack) guestFrames.shift();
    catchUp();
    const next = guestFrames.shift();
    if (next !== undefined) {
      lastGuest = next;
      ack = next.seq;
      stale = 0;
      return next;
    }
    stale += 1;
    if (lastGuest === null || stale > STALE_FRAMES) return undefined;
    // Commande en retard (gigue, réémission): on rejoue la dernière à sa place. Si elle marchait,
    // la devinée compte pour le numéro suivant: sinon l'invité ferait un pas de trop à chaque retard
    // (la devinée, puis la vraie), corrigé chez lui par un à-coup. Les numéros se suivent
    // (`commandes.ts`). Immobile, on attend la vraie sans avancer le numéro: une devinée immobile à
    // la place d'un départ ôterait ce pas pour de bon, et l'invité reculerait en s'arrêtant (5 pas
    // perdus au départ: 67 mm par image, graine 7 du banc de gigue, marche de 20 images).
    // Seul le déplacement se devine: Espace tenu deviné après un relâchement pourrait lancer un
    // geste de trop (répétition d'Espace tenu), alors qu'un geste lancé un pas plus tard ne se
    // voit pas. Exception: la poutre déjà tenue, qu'un pas relâché ferait tomber.
    if (Math.hypot(lastGuest.moveX, lastGuest.moveY) >= MOVE_DEADZONE) ack += 1;
    const holdingBeam = sim.world.beam?.holders.includes(remote) === true;
    return { seq: ack, moveX: lastGuest.moveX, moveY: lastGuest.moveY, actHeld: lastGuest.actHeld && holdingBeam };
  }

  function fastSnapshot(): FastSnapshot {
    const w = sim.world;
    const cat = sim.runtime.cat;
    return {
      ...(cat === null ? {} : { cat: { x: cat.pos.x, y: cat.pos.y, f: cat.facing, s: cat.speed, p: cat.pose, t: cat.since } }),
      tick: w.tick,
      ack,
      minutes: w.clock.minutes,
      characters: w.characters.map((c) => ({ id: c.id, x: c.pos.x, y: c.pos.y, f: c.facing, s: c.speed })),
      villagers: w.villagers.map((v) => ({ id: v.id, x: v.pos.x, y: v.pos.y, f: v.facing, s: v.speed })),
      hens: movingAnimals(w).map((h) => ({ id: h.id, x: h.pos.x, y: h.pos.y, f: h.facing, s: 0 })),
      beam: w.beam === null ? null : { x: w.beam.pos.x, y: w.beam.pos.y, f: w.beam.facing },
      train: w.train.progress,
    };
  }

  /**
   * Les ombres partent avant l'état, et seulement si elles ont changé depuis le dernier envoi: le
   * canal garde l'ordre d'envoi, l'invité a donc les ombres d'un état quand cet état arrive. Mode
   * `latest`: la liste est entière, la dernière suffit, y compris après une reprise de la liaison.
   */
  function sendShadows(force: boolean): void {
    const shadows = sim.world.fishing.shadows;
    const json = JSON.stringify(shadows);
    if (!force && json === sentShadows) return;
    channels.shadows.send({ tick: sim.world.tick, shadows });
    sentShadows = json;
  }

  function sendWorld(): void {
    // 0.13: les habitants sans leurs valeurs par défaut ni leurs champs du canal rapide
    // (`etat-transmis.ts`): l'invité reprend positions, caps et vitesses des instantanés.
    sendShadows(false);
    channels.world.send({ ack, world: sentWorld(sim.world) });
    sentRevision = sim.world.revision;
    lastWorldTick = sim.world.tick;
  }

  return {
    queueLocal(intent) {
      pending.push({ by: local, intent });
    },
    step(localFrame) {
      const controls: Partial<Record<CharacterId, ControlFrame>> = { [local]: localFrame };
      const guest = nextGuestFrame();
      if (guest !== undefined) controls[remote] = guest;
      const intents = pending.splice(0, pending.length);
      step(sim, { controls, intents });
      const w = sim.world;
      if (sim.events.length > 0) channels.events.send({ tick: w.tick, events: [...sim.events] });
      channels.fast.send(fastSnapshot());
      const due = w.tick - lastWorldTick;
      if ((w.revision !== sentRevision && due >= WORLD_EVERY_TICKS) || due >= WORLD_KEEPALIVE_TICKS) sendWorld();
      return sim.events;
    },
    sendWorld() {
      // Hors d'un pas (départ, reprise): un instantané du même pas part juste avant, pour que
      // l'invité place chaque habitant là où il est vraiment dès sa première image.
      channels.fast.send(fastSnapshot());
      sendShadows(true);
      sendWorld();
    },
    dispose() {
      unsubscribe();
    },
  };
}
