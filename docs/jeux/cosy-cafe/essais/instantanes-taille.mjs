// Essai de calcul de la section technique de Cosy Café (2026-11-07).
//
// Question: quelle taille ont les messages de l'hôte vers l'invité, adresse par adresse, avec des
// centaines d'objets, et combien coûte leur lecture chez l'invité (JSON.parse puis validation par
// le schéma Valibot, comme le fait le SDK à l'arrivée de chaque message)?
//
// Les tailles sont un calcul: des messages types sont fabriqués avec les effectifs supposés de
// chaque adresse (tableau ADDRESSES, à recaler sur les plans du level designer et les simulations
// du game designer), puis mesurés en octets UTF-8. Deux formes sont comparées pour les
// déplacements: objets JSON en flottants complets (forme de La Petite Ligne) et tableaux
// compacts en centimètres et en degrés entiers (forme proposée). Les temps de lecture sont une
// mesure sur la machine où le script tourne (process.cpuUsage, meilleure de 5 séries).
//
// Usage: node instantanes-taille.mjs <dossier contenant node_modules/valibot 1.5.0> [sortie.json]

import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const [depsDir, outPath] = process.argv.slice(2);
if (depsDir === undefined) {
  process.stderr.write('Usage: node instantanes-taille.mjs <dossier des dépendances> [sortie.json]\n');
  process.exit(2);
}
const v = await import(pathToFileURL(join(depsDir, 'node_modules/valibot/dist/index.mjs')).href);

// Effectifs supposés à la pointe d'un service (hypothèses de la section technique).
const ADDRESSES = [
  { id: 'village', characters: 24, objects: 90, furniture: 60, tickets: 8 },
  { id: 'bourg', characters: 46, objects: 160, furniture: 120, tickets: 14 },
  { id: 'ville', characters: 70, objects: 240, furniture: 180, tickets: 20 },
  { id: 'paris-quartier', characters: 74, objects: 240, furniture: 170, tickets: 22 },
  { id: 'paris-maison', characters: 120, objects: 420, furniture: 320, tickets: 30 },
];

// Générateur pseudo-aléatoire à graine (mulberry32): messages identiques d'un lancement à l'autre.
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 2 ** 32;
  };
}

const bytes = (value) => Buffer.byteLength(JSON.stringify(value), 'utf8');

// Déplacements, forme de La Petite Ligne: un objet par personnage, flottants complets.
function fastLoose(count, random) {
  return {
    tick: 123456,
    ack: 123450,
    minutes: 612.5,
    characters: Array.from({ length: count }, (_, i) => ({
      id: `c${i}`,
      x: random() * 20,
      y: random() * 15,
      f: random() * Math.PI * 2 - Math.PI,
      s: random() * 1.4,
    })),
  };
}

// Déplacements, forme proposée: [numéro, x en cm, z en cm, cap en degrés, animation, objet tenu].
function fastCompact(count, random) {
  return {
    t: 123456,
    a: 123450,
    p: [
      [0, 1234, 567, 120, 1, 17, -12, 312],
      [1, 845, 1290, 271, 7, 54, 3, -1],
    ],
    c: Array.from({ length: count }, (_, i) => [
      i + 2,
      Math.round(random() * 2000),
      Math.round(random() * 1500),
      Math.round(random() * 359),
      Math.floor(random() * 12),
      random() < 0.3 ? Math.floor(random() * 400) : -1,
    ]),
  };
}

// Domaine des objets mobiles: [numéro, type, support, emplacement, état, remplissage, qualité].
function objectsDomain(count, random) {
  return {
    r: 812,
    o: Array.from({ length: count }, (_, i) => [
      i,
      Math.floor(random() * 40),
      Math.floor(random() * 300),
      Math.floor(random() * 12),
      Math.floor(random() * 6),
      Math.floor(random() * 100),
      Math.floor(random() * 3),
    ]),
  };
}

// Domaine des meubles: [numéro, modèle, x en cm, z en cm, niveau, quart de tour, teinte].
function furnitureDomain(count, random) {
  return {
    r: 77,
    m: Array.from({ length: count }, (_, i) => [
      i,
      Math.floor(random() * 180),
      Math.round(random() * 2000),
      Math.round(random() * 1500),
      random() < 0.5 ? 0 : 1,
      Math.floor(random() * 4),
      Math.floor(random() * 16),
    ]),
  };
}

// Domaine du service: clients (état logique) et tickets du rail.
function serviceDomain(characters, tickets, random) {
  return {
    r: 4410,
    clients: Array.from({ length: characters }, (_, i) => [
      i + 2,
      Math.floor(random() * 9),
      Math.floor(random() * 10),
      Math.floor(random() * 120),
      Math.floor(random() * 100),
      Math.floor(random() * 100),
    ]),
    tickets: Array.from({ length: tickets }, (_, i) => ({
      id: i,
      table: Math.floor(random() * 40),
      lines: [
        [Math.floor(random() * 60), 1 + Math.floor(random() * 2)],
        [Math.floor(random() * 60), 1],
      ],
      by: random() < 0.5 ? null : 'p2',
      since: Math.floor(random() * 50000),
    })),
  };
}

const Int = v.pipe(v.number(), v.integer());
const Finite = v.pipe(v.number(), v.finite());
const schemas = {
  fastLoose: v.strictObject({
    tick: Int,
    ack: Int,
    minutes: Finite,
    characters: v.pipe(
      v.array(v.strictObject({ id: v.pipe(v.string(), v.maxLength(64)), x: Finite, y: Finite, f: Finite, s: Finite })),
      v.maxLength(160),
    ),
  }),
  fastCompact: v.strictObject({
    t: Int,
    a: Int,
    p: v.pipe(v.array(v.tuple([Int, Int, Int, Int, Int, Int, Int, Int])), v.maxLength(2)),
    c: v.pipe(v.array(v.tuple([Int, Int, Int, Int, Int, Int])), v.maxLength(160)),
  }),
  objects: v.strictObject({ r: Int, o: v.pipe(v.array(v.tuple([Int, Int, Int, Int, Int, Int, Int])), v.maxLength(600)) }),
  furniture: v.strictObject({ r: Int, m: v.pipe(v.array(v.tuple([Int, Int, Int, Int, Int, Int, Int])), v.maxLength(500)) }),
  service: v.strictObject({
    r: Int,
    clients: v.pipe(v.array(v.tuple([Int, Int, Int, Int, Int, Int])), v.maxLength(160)),
    tickets: v.pipe(
      v.array(
        v.strictObject({
          id: Int,
          table: Int,
          lines: v.pipe(v.array(v.tuple([Int, Int])), v.maxLength(8)),
          by: v.nullable(v.picklist(['p1', 'p2'])),
          since: Int,
        }),
      ),
      v.maxLength(40),
    ),
  }),
};

/** Temps processeur d'une lecture chez l'invité: JSON.parse puis validation stricte. */
function readCost(message, schema) {
  const text = JSON.stringify(message);
  const rounds = 400;
  let best = Number.POSITIVE_INFINITY;
  for (let series = 0; series < 5; series += 1) {
    const start = process.cpuUsage();
    for (let i = 0; i < rounds; i += 1) {
      const result = v.safeParse(schema, JSON.parse(text));
      if (!result.success) throw new Error('message type refusé par son schéma');
    }
    const used = process.cpuUsage(start);
    best = Math.min(best, (used.user + used.system) / rounds);
  }
  return Number(best.toFixed(1));
}

const rows = [];
for (const address of ADDRESSES) {
  const random = rng(7);
  const loose = fastLoose(address.characters, random);
  const compact = fastCompact(address.characters, random);
  const objects = objectsDomain(address.objects, random);
  const furniture = furnitureDomain(address.furniture, random);
  const service = serviceDomain(address.characters, address.tickets, random);
  rows.push({
    address: address.id,
    counts: address,
    bytes: {
      fastLoose: bytes(loose),
      fastCompact: bytes(compact),
      objects: bytes(objects),
      furniture: bytes(furniture),
      service: bytes(service),
    },
    readMicroseconds: {
      fastLoose: readCost(loose, schemas.fastLoose),
      fastCompact: readCost(compact, schemas.fastCompact),
      objects: readCost(objects, schemas.objects),
      furniture: readCost(furniture, schemas.furniture),
      service: readCost(service, schemas.service),
    },
  });
}

const report = { date: new Date().toISOString(), node: process.version, valibot: '1.5.0', rows };
if (outPath !== undefined) writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`);
for (const row of rows) {
  const b = row.bytes;
  const r = row.readMicroseconds;
  process.stdout.write(
    `${row.address.padEnd(15)} déplacements ${b.fastLoose} o (objets) / ${b.fastCompact} o (compacts), ` +
      `objets ${b.objects} o, meubles ${b.furniture} o, service ${b.service} o; ` +
      `lecture ${r.fastLoose} / ${r.fastCompact} / ${r.objects} / ${r.furniture} / ${r.service} µs\n`,
  );
}
