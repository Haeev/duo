/**
 * Démonstration de la musique jouée, sans simulation ni réseau: les événements de l'hôte sont
 * fabriqués, deux robots jouent. Sert aux captures et à l'enregistrement d'écoute.
 *
 * Adresse: `?ecran=cahier|attente|jeu|resultat` (défaut `jeu`), `joueur=0|1` (la machine montrée),
 * `duo=1`, `air=<id>`, `t=<secondes de l'air>`, `robots=maladroit,parfait` (joueur 0, joueur 1),
 * `mouvement=reduit`, `style=ancien`. Deux pages `joueur=0` et `joueur=1` au même `t` montrent les
 * deux machines du même instant d'un duo.
 *
 * `?ecoute=1`: rend hors ligne, par le vrai moteur de son (`audio/musique/scene.ts`), un air joué
 * par un robot parfait, puis maladroit, puis un duo; le résultat (WAV en base64 et minutage) est
 * posé dans `window.__ecoute` pour `assets-src/son/musique/ecoute-musique-jouee.cjs`.
 */
import { createRandom } from '@duo/sdk/sim';
import { soundUrl } from '../../../audio/fichiers';
import { createStageAudio } from '../../../audio/musique/scene';
import { loadMusicTable } from '../../../audio/musique/table';
import { loadTimbres } from '../../../audio/musique/timbres';
import { loadContent } from '../../../donnees/charger';
import { DATA_FILES } from '../../../donnees/fichiers';
import type { AirNote, AirScore } from '../../../donnees/schemas/air';
import type { PlayerIndex } from '../../../donnees/schemas/communs';
import type { WorldState } from '../../../etat/monde';
import type { MusicResult } from '../../../simulation/musique/evenements';
import { accuracyOf, ratingOf, tallyOf, windowsOf } from '../../../simulation/musique/jugement';
import { leadMs, notesOf, playableAirs, voicesFor } from '../../../simulation/musique/lecture';
import { botPresses, createPerformance, type Press } from '../../../simulation/musique/local';
import { MUSIC, type Rating, type Verdict } from '../../../simulation/musique/reglages';
import type { GameEvent } from '../../../simulation/noyau/evenements';
import { createWorld } from '../../../simulation/noyau/monde';
import { azertyLabel } from '../../index';
import { createStage } from '../index';
import '../../interface.css';
import '../../encre/cadres.css';
import '../../encre/encre.css';

const params = new URLSearchParams(location.search);
const content = loadContent(DATA_FILES);
const airId = params.get('air') ?? 'air-marche-de-la-halte';
const score: AirScore | undefined = content.airs[airId]?.score;
if (score === undefined) throw new Error(`air sans partition: ${airId}`);

type Style = 'perfect' | 'clumsy';
const styles = (params.get('robots') ?? 'maladroit,parfait')
  .split(',')
  .map((name): Style => (name === 'parfait' ? 'perfect' : 'clumsy'));
const styleOf = (player: PlayerIndex): Style => styles[player] ?? 'perfect';
/** Les frappes du robot d'un joueur: les mêmes sur les deux pages d'un duo. */
function pressesOf(player: PlayerIndex, notes: readonly AirNote[]): Press[] {
  return botPresses(notes, styleOf(player), createRandom(40 + player), 190);
}

// --- Écoute: rendu hors ligne par le vrai moteur de son -----------------------------------------
interface Listening {
  readonly wav: string;
  readonly seconds: number;
  readonly text: string;
}
declare global {
  interface Window {
    __ecoute?: Listening;
  }
}

function wavOf(buffer: AudioBuffer): Uint8Array {
  const channels = buffer.numberOfChannels;
  const frames = buffer.length;
  const bytes = new Uint8Array(44 + frames * channels * 2);
  const view = new DataView(bytes.buffer);
  const tag = (at: number, text: string): void => {
    for (let i = 0; i < text.length; i++) view.setUint8(at + i, text.charCodeAt(i));
  };
  tag(0, 'RIFF');
  view.setUint32(4, 36 + frames * channels * 2, true);
  tag(8, 'WAVEfmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, buffer.sampleRate, true);
  view.setUint32(28, buffer.sampleRate * channels * 2, true);
  view.setUint16(32, channels * 2, true);
  view.setUint16(34, 16, true);
  tag(36, 'data');
  view.setUint32(40, frames * channels * 2, true);
  const data = Array.from({ length: channels }, (_, c) => buffer.getChannelData(c));
  let at = 44;
  for (let i = 0; i < frames; i++)
    for (const channel of data) {
      const sample = Math.max(-1, Math.min(1, channel[i] ?? 0));
      view.setInt16(at, Math.round(sample * 32767), true);
      at += 2;
    }
  return bytes;
}

function base64Of(bytes: Uint8Array): string {
  let text = '';
  for (let i = 0; i < bytes.length; i += 0x8000)
    text += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(text);
}

async function renderListening(): Promise<Listening> {
  const RATE = 48_000;
  const EXCERPT_MS = 16_000;
  const table = loadMusicTable();
  const timbres = loadTimbres();
  const canon = content.airs['air-canon-de-la-repetition']?.score;
  if (score === undefined || canon === undefined) throw new Error('airs absents');
  const takes: {
    readonly title: string;
    readonly air: string;
    readonly score: AirScore;
    readonly players: readonly { voice: 'solo' | 0 | 1; style: Style; timbre: string }[];
  }[] = [
    {
      title: `${airId}, robot parfait: chaque note à son instant, toutes justes`,
      air: airId,
      score,
      players: [{ voice: 'solo', style: 'perfect', timbre: 'cornet' }],
    },
    {
      title: `${airId}, robot maladroit: notes en avance ou en retard, couacs (notes qui s'affaissent), trous`,
      air: airId,
      score,
      players: [{ voice: 'solo', style: 'clumsy', timbre: 'cornet' }],
    },
    {
      title:
        'air-canon-de-la-repetition, duo de robots parfaits: cornet (première entrée, à gauche), clarinette (seconde entrée, deux mesures après, à droite)',
      air: 'air-canon-de-la-repetition',
      score: canon,
      players: [
        { voice: 0, style: 'perfect', timbre: 'cornet' },
        { voice: 1, style: 'perfect', timbre: 'clarinette' },
      ],
    },
  ];
  const gap = 900;
  const span = (take: (typeof takes)[number]): number =>
    leadMs(take.score) + EXCERPT_MS + MUSIC.tailMs + gap;
  const total = takes.reduce((sum, take) => sum + span(take), 0) / 1000;
  const ctx = new OfflineAudioContext(2, Math.ceil(total * RATE), RATE);
  const lines: string[] = [];
  let cursor = 0;
  for (const take of takes) {
    const excerpt: AirScore = { ...take.score, lengthMs: EXCERPT_MS };
    const stage = createStageAudio({
      context: ctx,
      output: ctx.destination,
      table,
      timbres,
      assetUrl: soundUrl,
      sessionNow: () => 0,
      perfNow: () => 0,
      load: async (url) => ctx.decodeAudioData(await (await fetch(url)).arrayBuffer()),
    });
    await stage.prepare(take.air);
    const startAtMs = cursor + leadMs(take.score);
    stage.start({ air: take.air, score: excerpt, startAtMs, leadMs: leadMs(take.score) });
    const counts: string[] = [];
    take.players.forEach((player, index) => {
      const notes = notesOf(take.score, player.voice).filter((note) => note[0] < EXCERPT_MS);
      const game = createPerformance(notes, windowsOf(1));
      for (const press of botPresses(notes, player.style, createRandom(40 + index), 190)) {
        game.advance(press.atMs);
        const hit = game.press(press.lane, press.atMs);
        const written = hit === null ? undefined : notes[hit.index];
        if (hit === null || written === undefined || hit.verdict === 'missed') continue;
        stage.note({
          who: index === 0 ? 'me' : 'partner',
          timbre: player.timbre,
          midi: written[2],
          atMs: press.atMs,
          ms: written[3],
          sour: hit.verdict === 'false',
        });
      }
      game.advance(1e9);
      const tally = tallyOf(game.verdicts(), notes.length);
      counts.push(
        `${player.timbre}: ${String(tally.just)} justes, ${String(tally.near)} presque, ${String(tally.false)} couacs, ${String(tally.missed)} manquées`,
      );
    });
    const minutes = Math.floor(cursor / 60_000);
    const seconds = ((cursor % 60_000) / 1000).toFixed(1).padStart(4, '0');
    lines.push(`${String(minutes)}:${seconds} ${take.title} (${counts.join('; ')})`);
    cursor += span(take);
  }
  // Les accompagnements se branchent dans une microtâche après `start`.
  await new Promise((resolve) => setTimeout(resolve, 50));
  const rendered = await ctx.startRendering();
  return { wav: base64Of(wavOf(rendered)), seconds: total, text: lines.join('\n') };
}

// --- Écran --------------------------------------------------------------------------------------
function showScreen(): void {
  const me: PlayerIndex = params.get('joueur') === '1' ? 1 : 0;
  const mate: PlayerIndex = me === 0 ? 1 : 0;
  const duo = params.get('duo') === '1';
  const screen = params.get('ecran') ?? 'jeu';
  const world: WorldState = createWorld(content, 7, [
    { id: 'a', name: 'Camille' },
    { id: 'b', name: 'Sacha' },
  ]);
  world.players[0].toolbar[0] = { item: 'cornet', count: 1 };
  world.players[1].toolbar[0] = { item: 'clarinette', count: 1 };
  for (const player of world.players) player.selected = 0;
  world.progress.memory['musique.joue.air-canon-de-la-repetition'] = { v: 3, by: 'duo', day: 1 };
  world.progress.memory['musique.joue.air-marche-de-la-halte'] = { v: 2, by: 'duo', day: 2 };

  if (params.get('style') !== 'ancien') document.documentElement.dataset.lplStyle = 'encre';
  const backdrop = Object.values(
    import.meta.glob<string>(
      '../../../../../../docs/jeux/jeu-1/refonte/captures/encre-exterieur-jeu-jour.png',
      { query: '?url', import: 'default', eager: true },
    ),
  )[0];
  const fond = document.getElementById('fond');
  if (fond !== null && backdrop !== undefined) fond.style.backgroundImage = `url("${backdrop}")`;

  const layer = document.createElement('div');
  layer.className = 'lpl-ui';
  layer.style.cssText = 'position:fixed;inset:0';
  document.body.append(layer);
  let now = 10_000;
  const stage = createStage({
    layer,
    content,
    world: () => world,
    local: () => me,
    send: () => undefined,
    keyLabel: azertyLabel,
    keyTarget: window,
    sessionNow: () => now,
    reduced: () => params.get('mouvement') === 'reduit',
    openGuardMs: 0,
  });

  const leader: PlayerIndex = 0;
  const known = playableAirs(content)
    .slice(0, 5)
    .map((air) => air.id);
  const opened = (player: PlayerIndex): GameEvent => ({
    type: 'music_opened',
    player,
    target: 'pupitre',
    leader,
    airs: known,
  });
  stage.onEvent(opened(leader));
  if (duo) stage.onEvent(opened(1));
  if (screen === 'cahier' || screen === 'attente' || score === undefined) {
    stage.frame(400);
    if (screen === 'cahier') window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyS' }));
    stage.frame(16);
    return;
  }

  const voices = voicesFor(score, leader, [true, duo]);
  const startAtMs = now + leadMs(score);
  stage.onEvent({
    type: 'music_started',
    target: 'pupitre',
    air: airId,
    leader,
    voices,
    startTick: 0,
    startAtMs,
  });
  const mineVoice = voices[me];
  const mateVoice = voices[mate];
  const mine = mineVoice === null ? [] : pressesOf(me, notesOf(score, mineVoice));
  // L'autre machine: son robot juge chez lui, l'hôte valide, le verdict arrive 50 ms plus tard.
  const mateNotes = mateVoice === null ? [] : notesOf(score, mateVoice);
  const mateGame = createPerformance(mateNotes, windowsOf(1));
  const matePresses = mateVoice === null ? [] : pressesOf(mate, mateNotes);
  const inbox: { at: number; event: GameEvent }[] = [];
  const verdictOf = (index: number, verdict: Verdict): void => {
    inbox.push({ at: now + 50, event: { type: 'music_note', player: mate, index, verdict } });
  };
  const until =
    screen === 'resultat' ? score.lengthMs + 200 : Number(params.get('t') ?? '9.2') * 1000;
  const FRAME = 1000 / 60;
  let lastKey: string | null = null;
  let lastKeyAt = -1e9;
  for (let air = -leadMs(score); air < until; air += FRAME) {
    now += FRAME;
    const airMs = now - startAtMs;
    for (const hit of mateGame.advance(airMs)) verdictOf(hit.index, hit.verdict);
    while ((matePresses[0]?.atMs ?? Infinity) <= airMs) {
      const press = matePresses.shift();
      const hit = press === undefined ? null : mateGame.press(press.lane, press.atMs);
      if (hit !== null) verdictOf(hit.index, hit.verdict);
    }
    while ((inbox[0]?.at ?? Infinity) <= now) {
      const next = inbox.shift();
      if (next !== undefined) stage.onEvent(next.event);
    }
    if (lastKey !== null && airMs - lastKeyAt > 110) {
      window.dispatchEvent(new KeyboardEvent('keyup', { code: lastKey }));
      lastKey = null;
    }
    while ((mine[0]?.atMs ?? Infinity) <= airMs) {
      const press = mine.shift();
      const code = press === undefined ? undefined : MUSIC.keys[press.lane];
      if (code === undefined) continue;
      if (lastKey !== null) window.dispatchEvent(new KeyboardEvent('keyup', { code: lastKey }));
      window.dispatchEvent(new KeyboardEvent('keydown', { code }));
      lastKey = code;
      lastKeyAt = airMs;
    }
    stage.frame(FRAME);
  }
  if (screen !== 'resultat') return;
  // Le mot de la fin, tel que l'hôte le calculerait.
  const myGame = createPerformance(
    mineVoice === null ? [] : notesOf(score, mineVoice),
    windowsOf(1),
  );
  for (const press of mineVoice === null ? [] : pressesOf(me, notesOf(score, mineVoice))) {
    myGame.advance(press.atMs);
    myGame.press(press.lane, press.atMs);
  }
  const resultOf = (game: typeof myGame, cents: number, friends: number): MusicResult => {
    const tally = tallyOf(game.verdicts(), game.notes.length);
    return { rating: ratingOf(accuracyOf(tally)), ...tally, cents, friends };
  };
  mateGame.advance(1e9);
  const results: [MusicResult | null, MusicResult | null] = [null, null];
  results[me] = resultOf(myGame, duo ? 225 : 150, 3);
  if (duo) results[mate] = resultOf(mateGame, 225, 3);
  const rating = Math.min(...results.flatMap((r) => (r === null ? [] : [r.rating]))) as Rating;
  stage.onEvent({
    type: 'music_finished',
    target: 'pupitre',
    air: airId,
    rating,
    duo,
    together: duo && rating >= MUSIC.duo.minRating,
    first: true,
    listeners: 3,
    results,
  });
  stage.frame(FRAME);
}

if (params.get('ecoute') === '1') {
  void renderListening().then((listening) => {
    window.__ecoute = listening;
    document.body.dataset.ready = 'oui';
  });
} else {
  showScreen();
  document.body.dataset.ready = 'oui';
}
