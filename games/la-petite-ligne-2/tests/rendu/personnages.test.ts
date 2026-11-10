// Personnages assemblés (lot L6): catalogue et GLB lus dans Node, assemblage, animation, couche.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Group, type SkinnedMesh } from 'three';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { beforeAll, describe, expect, it } from 'vitest';
import type { Catalogue } from '../../src/donnees/schemas/personnage';
import { Face, leanAngle, strideRate, targetWeights } from '../../src/rendu/personnages/animation';
import { composeLook, defaultPlayerLook, resolveLook } from '../../src/rendu/personnages/apparence';
import { assemble, type CharacterLibrary, sectionOf } from '../../src/rendu/personnages/assemblage';
import { loadCharacterLibrary } from '../../src/rendu/personnages/chargement';
import { AssembledCharacters } from '../../src/rendu/personnages/couche';
import { CHARACTER_SETTINGS } from '../../src/rendu/personnages/reglages';
import { createPlaceState, createWorld } from '../../src/simulation/noyau/monde';
import { gameContent } from '../aides';

const content = gameContent();
const dir = fileURLToPath(new URL('../../assets/commun/personnages/', import.meta.url));
const loader = new GLTFLoader();

function parse(file: string): Promise<GLTF> {
  const buffer = readFileSync(dir + file);
  const data = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
  return loader.parseAsync(data, '');
}

let library: CharacterLibrary;
beforeAll(async () => {
  library = await loadCharacterLibrary(content.catalogue, content.morphologies, parse);
});

describe('apparences', () => {
  it('compose un habitant de façon déterministe, avec des pièces du catalogue', () => {
    const a = composeLook('cheffe-de-gare', content.catalogue);
    expect(composeLook('cheffe-de-gare', content.catalogue)).toEqual(a);
    expect(composeLook('facteur', content.catalogue)).not.toEqual(a);
    const ids = new Set(content.catalogue.pieces.map((p) => p.id));
    for (const piece of a.pieces) expect(ids.has(piece.id)).toBe(true);
    expect(a.pieces.some((p) => p.slot === 'head')).toBe(true);
  });

  it('donne aux deux joueurs des looks distincts, à leur silhouette de départ', () => {
    const shapes = content.settings.start.shapes;
    const a = defaultPlayerLook(0, null, shapes, '#d9654f', content.catalogue);
    const b = defaultPlayerLook(1, null, shapes, '#4f8fd9', content.catalogue);
    expect(a).not.toEqual(b);
    expect(a.shape).toBe(shapes.f);
    expect(b.shape).toBe(shapes.m);
  });

  it('masque les sections couvertes et aplatit les cheveux sous une coiffe', () => {
    const hat = content.catalogue.pieces.find((p) => p.slot === 'hat' && p.hair === 'flat');
    const hair = content.catalogue.pieces.find((p) => p.slot === 'hair');
    const top = content.catalogue.pieces.find((p) => p.slot === 'top');
    if (hat === undefined || hair === undefined || top === undefined) throw new Error('catalogue');
    const look = resolveLook(
      {
        shape: 'adult-f-medium',
        skin: 0,
        pieces: [
          { slot: 'hair', id: hair.id, colors: [] },
          { slot: 'hat', id: hat.id, colors: [] },
          { slot: 'top', id: top.id, colors: [] },
        ],
      },
      content.catalogue,
      content.morphologies,
    );
    expect(look.pieces.find((p) => p.slot === 'hair')?.node).toBe(
      hair.node + content.morphologies.flat_suffix,
    );
    expect(look.covered).toContain(content.morphologies.regions.indexOf('torso'));
  });
});

describe('assemblage', () => {
  it('lit les sections du corps directement dans V (le générateur compense le retournement glTF)', () => {
    const body = content.catalogue.pieces.find((p) => p.slot === 'body');
    const mesh = body === undefined ? null : library.node(body.file, body.node);
    if (mesh === null) throw new Error('corps');
    const uv = mesh.geometry.getAttribute('uv');
    const seen = new Set<number>();
    for (let i = 0; i < uv.count; i += 1) seen.add(sectionOf(uv.getY(i)));
    const regions = content.morphologies.regions;
    for (const section of seen) expect(section).toBeLessThan(regions.length);
    // Une jupe ne couvre pas les mollets: ils restent.
    const shin = regions.indexOf('shin');
    expect(seen.has(shin)).toBe(true);
  });

  it('fusionne un personnage en deux géométries sur le squelette commun, sous le budget', () => {
    const look = resolveLook(
      composeLook('essai', content.catalogue),
      content.catalogue,
      content.morphologies,
    );
    const nude = resolveLook(
      { shape: look.shape, skin: 0, pieces: [] },
      content.catalogue,
      content.morphologies,
    );
    const dressed = assemble(look, library);
    const bare = assemble(nude, library);
    expect(dressed.missing).toEqual([]);
    expect(dressed.head).not.toBeNull();
    expect(Object.keys(dressed.head?.morphAttributes ?? {})).toContain('position');
    expect(dressed.triangles).toBeLessThan(10_000);
    // Le corps nu garde toutes ses sections; habillé, les sections couvertes partent.
    expect(bare.triangles).toBe(content.catalogue.pieces.find((p) => p.slot === 'body')?.triangles);
    const skinIndex = dressed.body.getAttribute('skinIndex');
    let maxBone = 0;
    for (let i = 0; i < skinIndex.count * 4; i += 1)
      maxBone = Math.max(maxBone, skinIndex.array[i] ?? 0);
    expect(maxBone).toBeLessThan(library.boneNames.length);
  });

  it('assemble une pièce ajoutée au catalogue sans code (pièce factice)', async () => {
    const source = content.catalogue.pieces.find((p) => p.slot === 'top');
    if (source === undefined) throw new Error('catalogue');
    const fake = { ...source, id: 'top-essai-factice', tags: ['essai'] };
    const catalogue: Catalogue = {
      ...content.catalogue,
      pieces: [...content.catalogue.pieces, fake],
    };
    const lib = await loadCharacterLibrary(catalogue, content.morphologies, parse);
    const look = resolveLook(
      { shape: 'adult-m-medium', skin: 3, pieces: [{ slot: 'top', id: fake.id, colors: [5] }] },
      catalogue,
      content.morphologies,
    );
    expect(look.pieces.map((p) => p.id)).toContain(fake.id);
    const geometry = assemble(look, lib);
    expect(geometry.missing).toEqual([]);
    expect(geometry.triangles).toBeGreaterThan(fake.triangles);
    // Le tirage des habitants la propose aussi.
    const drawn = new Set<string>();
    for (let i = 0; i < 200; i += 1)
      for (const piece of composeLook(`h${String(i)}`, catalogue).pieces) drawn.add(piece.id);
    expect(drawn.has(fake.id)).toBe(true);
  });
});

describe('animation', () => {
  it('passe du repos à la marche puis à la course selon la vitesse', () => {
    const names = new Set(['idle', 'walk', 'run', 'sit', 'carry']);
    const out = new Map<string, number>();
    expect([...targetWeights({ kind: 'stand', speed: 0 }, names, out)]).toEqual([['idle', 1]]);
    expect([...targetWeights({ kind: 'stand', speed: 1.5 }, names, out)]).toEqual([['walk', 1]]);
    expect([...targetWeights({ kind: 'stand', speed: 3.2 }, names, out)]).toEqual([['run', 1]]);
    expect([...targetWeights({ kind: 'sit' }, names, out)]).toEqual([['sit', 1]]);
    expect([...targetWeights({ kind: 'clip', clip: 'reach-up' }, names, out)]).toEqual([
      [CHARACTER_SETTINGS.clips.gesture, 1],
    ]);
  });

  it('cale la cadence sur la vitesse: les pieds ne glissent pas', () => {
    const stride = library.stride('walk');
    expect(stride).toBeGreaterThan(0.5);
    expect(stride).toBeLessThan(3);
    const rate = strideRate(2, stride, library.stride('run'), 0, 1, 0.6);
    expect(rate * stride).toBeCloseTo(2, 5);
  });

  it('cadence calée sur la marche à 1,5 m/s et la course: le pied posé ne glisse pas', () => {
    const { walkSpeed, runSpeed } = content.settings.movement;
    const walk = library.stride('walk');
    const runStride = library.stride('run');
    const durations = content.morphologies.clips;
    const walkSeconds = durations.walk ?? 1;
    const runSeconds = durations.run ?? 1;
    // Marche épuisée, normale, reposée; course fatiguée, normale, reposée.
    for (const speed of [walkSpeed * 0.5, walkSpeed, walkSpeed * 1.1]) {
      const rate = strideRate(speed, walk, runStride, 0, walkSeconds, runSeconds);
      expect(rate * walk).toBeCloseTo(speed, 5);
    }
    for (const speed of [runSpeed * 0.8, runSpeed, runSpeed * 1.1]) {
      const rate = strideRate(speed, walk, runStride, 1, walkSeconds, runSeconds);
      expect(rate * runStride).toBeCloseTo(speed, 5);
    }
    // À 1,5 m/s, la marche joue presque à sa cadence propre (ni accélérée ni ralentie de 10 %).
    expect((walkSpeed / walk) * walkSeconds).toBeGreaterThan(0.9);
    expect((walkSpeed / walk) * walkSeconds).toBeLessThan(1.1);
    const names = new Set(['idle', 'walk', 'run']);
    const out = new Map<string, number>();
    expect([...targetWeights({ kind: 'stand', speed: walkSpeed * 1.1 }, names, out)]).toEqual([
      ['walk', 1],
    ]);
    expect([...targetWeights({ kind: 'stand', speed: runSpeed * 0.8 }, names, out)]).toEqual([
      ['run', 1],
    ]);
  });

  it('se penche vers l’intérieur du virage, plus en courant, et se redresse en ligne droite', () => {
    let lean = 0;
    for (let i = 0; i < 30; i++) lean = leanAngle(lean, 1.5, 2, 1 / 60);
    expect(lean).toBeGreaterThan(0.05);
    let fast = 0;
    for (let i = 0; i < 30; i++) fast = leanAngle(fast, 3.2, 2, 1 / 60);
    expect(fast).toBeGreaterThan(lean);
    expect(fast).toBeLessThanOrEqual(CHARACTER_SETTINGS.lean.max);
    let other = 0;
    for (let i = 0; i < 30; i++) other = leanAngle(other, 1.5, -2, 1 / 60);
    expect(other).toBeCloseTo(-lean, 6);
    for (let i = 0; i < 60; i++) lean = leanAngle(lean, 1.5, 0, 1 / 60);
    expect(Math.abs(lean)).toBeLessThan(0.01);
  });

  it('cligne sur un visage neutre, tient une expression, bouge la bouche au babil', () => {
    const face = new Face(1);
    let blinked = false;
    for (let i = 0; i < 600; i += 1)
      if ((face.update(1 / 60).get('blink') ?? 0) > 0.5) blinked = true;
    expect(blinked).toBe(true);
    face.show('joy', 1);
    for (let i = 0; i < 30; i += 1) face.update(1 / 60);
    expect(face.update(1 / 60).get('joy') ?? 0).toBeGreaterThan(0.8);
    face.talk(0.5);
    let opened = 0;
    for (let i = 0; i < 30; i += 1) opened = Math.max(opened, face.update(1 / 60).get('talk') ?? 0);
    expect(opened).toBeGreaterThan(0.5);
  });
});

describe('couche des personnages', () => {
  it('affiche joueurs et habitants, assied sur le siège, libère tout', () => {
    const world = createWorld(content, 3, [
      { id: 'a', name: 'A' },
      { id: 'b', name: 'B' },
    ]);
    const place = world.places[world.common.place];
    if (place === undefined) throw new Error('lieu');
    // Un habitant composé de plus (sans fiche): son look vient de son identifiant.
    place.villagers['figurant-essai'] = {
      met: [false, false],
      talkingWith: null,
      body: { x: 20, y: 18, facing: 0, speed: 1.5 },
    };
    const root = new Group();
    const layer = new AssembledCharacters(
      { root, playerColors: ['#d9654f', '#4f8fd9'] },
      { content, onEvent: () => () => undefined },
      library,
    );
    layer.update({ dt: 1 / 60, world, place, cameraYaw: 0 });
    const villagers = Object.keys(place.villagers).length;
    expect(layer.stats().figures).toBe(2 + villagers);
    const meshes: SkinnedMesh[] = [];
    root.traverse((o) => {
      if ((o as Partial<SkinnedMesh>).isSkinnedMesh === true && o.visible)
        meshes.push(o as SkinnedMesh);
    });
    // Deux maillages visibles par personnage (corps et tête), le gabarit nu caché.
    expect(meshes.length).toBe(2 * (2 + villagers));
    for (const id of Object.keys(place.villagers)) expect(layer.aimable(id)).not.toBeNull();
    // La vie de l'habitant (`villagerView`): absent du lieu, il n'est pas dessiné.
    const extra = place.villagers['figurant-essai'];
    extra.life = {
      presence: 'away',
      entry: 0,
      activity: null,
      pose: 'stand',
      gesture: null,
      seat: null,
      emote: null,
      emoteUntil: 0,
      gaze: null,
    };
    layer.update({ dt: 1 / 60, world, place, cameraYaw: 0 });
    expect(root.getObjectByName('personnage-figurant-essai')?.visible).toBe(false);
    delete extra.life;
    layer.update({ dt: 1 / 60, world, place, cameraYaw: 0 });
    expect(root.getObjectByName('personnage-figurant-essai')?.visible).toBe(true);
    // Assis sur le banc de la halte: le personnage monte sur l'assise, devant le meuble.
    const halte = content.places['essai-halte'];
    if (halte === undefined) throw new Error('halte');
    const bench = createPlaceState(content, halte);
    world.places['essai-halte'] = bench;
    world.common.place = 'essai-halte';
    layer.reset();
    const seats = bench.objects.banc?.sit;
    if (seats === undefined) throw new Error('banc sans places');
    seats[0] = 0;
    world.players[0].body.x = 16;
    world.players[0].body.y = 12.5;
    for (let i = 0; i < 60; i += 1) layer.update({ dt: 1 / 60, world, place: bench, cameraYaw: 0 });
    const figure = root.getObjectByName('personnage-player-0');
    const s = CHARACTER_SETTINGS.seat;
    // Assise du modèle livré (manifeste des décors), sinon celle de la forme provisoire.
    const model = content.props.banc?.model ?? '';
    const height = s.byModel[model]?.height ?? s.standIn.height;
    expect(figure?.position.y ?? 0).toBeCloseTo(height - s.clipSeat, 2);
    expect(layer.stats().figures).toBe(2 + Object.keys(bench.villagers).length);
    layer.dispose();
    expect(layer.stats().figures).toBe(0);
    expect(root.children.length).toBe(0);
  });
});
