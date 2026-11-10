#!/usr/bin/env node
// Régénère `outils/tableau-de-bord/modeles/` (fichiers et `index.json`) à partir des dossiers d'assets du dépôt.
// Un modèle de plus dans un dossier inventorié apparaît tout seul; un dossier de plus: un lot dans
// `modeles-sources.json`. Aucune dépendance: le GLB est lu à la main (en-tête, bloc JSON, bloc binaire).
// Usage: node outils/tableau-de-bord/outils/inventaire-modeles.mjs [--sources <fichier.json>] [--sortie <dossier>]
// (les deux options servent à l'essai du gabarit, `essai-inventaire.mjs`, qui travaille dans un dossier temporaire).
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const RACINE = path.resolve(ICI, '..', '..', '..');
const option = (nom, repli) => {
  const i = process.argv.indexOf(nom);
  return i >= 0 && process.argv[i + 1] ? path.resolve(process.argv[i + 1]) : repli;
};
const SOURCES = option('--sources', path.join(ICI, 'modeles-sources.json'));
const SORTIE = option('--sortie', path.resolve(ICI, '..', 'modeles'));

// ---------------------------------------------------------------- lecture d'un GLB

const IDENTITE = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

/** Produit de deux matrices 4x4 rangées par colonnes (convention glTF). */
function produit(a, b) {
  const r = new Array(16).fill(0);
  for (let c = 0; c < 4; c += 1)
    for (let l = 0; l < 4; l += 1)
      for (let k = 0; k < 4; k += 1) r[c * 4 + l] += a[k * 4 + l] * b[c * 4 + k];
  return r;
}

function matriceLocale(noeud) {
  if (noeud.matrix) return noeud.matrix;
  const [x, y, z, w] = noeud.rotation ?? [0, 0, 0, 1];
  const [sx, sy, sz] = noeud.scale ?? [1, 1, 1];
  const [tx, ty, tz] = noeud.translation ?? [0, 0, 0];
  return [
    (1 - 2 * (y * y + z * z)) * sx,
    2 * (x * y + z * w) * sx,
    2 * (x * z - y * w) * sx,
    0,
    2 * (x * y - z * w) * sy,
    (1 - 2 * (x * x + z * z)) * sy,
    2 * (y * z + x * w) * sy,
    0,
    2 * (x * z + y * w) * sz,
    2 * (y * z - x * w) * sz,
    (1 - 2 * (x * x + y * y)) * sz,
    0,
    tx,
    ty,
    tz,
    1,
  ];
}

function lireGlb(chemin) {
  const octets = readFileSync(chemin);
  if (octets.readUInt32LE(0) !== 0x46546c67) throw new Error(`${chemin}: ce n'est pas un GLB`);
  const longueurJson = octets.readUInt32LE(12);
  const json = JSON.parse(octets.subarray(20, 20 + longueurJson).toString('utf8'));
  const debutBin = 20 + longueurJson + 8;
  const bin = debutBin <= octets.length ? octets.subarray(debutBin) : Buffer.alloc(0);
  return { json, bin, poids: octets.length };
}

/** Mesure chaque noeud d'un GLB: triangles et boîte englobante de son sous-arbre, en mètres, à la pose de repos. */
function analyser(chemin) {
  const { json, bin, poids } = lireGlb(chemin);
  const noeuds = json.nodes ?? [];
  const monde = new Array(noeuds.length).fill(null);
  const parent = new Array(noeuds.length).fill(-1);
  const racines = json.scenes?.[json.scene ?? 0]?.nodes ?? [];
  const descendre = (i, m) => {
    monde[i] = produit(m, matriceLocale(noeuds[i]));
    for (const e of noeuds[i].children ?? []) {
      parent[e] = i;
      descendre(e, monde[i]);
    }
  };
  for (const r of racines) descendre(r, IDENTITE);

  // Maillage à squelette: glTF ignore la matrice de son noeud; à la pose de repos, tout sommet est déplacé par
  // (matrice monde de l'os) x (matrice inverse de liaison), la même pour tous les os d'un squelette propre.
  const matriceDePeau = (peau) => {
    const acc = json.accessors?.[peau.inverseBindMatrices];
    if (!acc || peau.joints.length === 0 || !monde[peau.joints[0]]) return IDENTITE;
    const vue = json.bufferViews[acc.bufferView];
    const debut = (vue.byteOffset ?? 0) + (acc.byteOffset ?? 0);
    const inverse = [];
    for (let k = 0; k < 16; k += 1) inverse.push(bin.readFloatLE(debut + k * 4));
    return produit(monde[peau.joints[0]], inverse);
  };

  const propre = noeuds.map((n, i) => {
    const vide = {
      triangles: 0,
      min: [Infinity, Infinity, Infinity],
      max: [-Infinity, -Infinity, -Infinity],
    };
    if (n.mesh === undefined || !monde[i]) return vide;
    const m = n.skin !== undefined ? matriceDePeau(json.skins[n.skin]) : monde[i];
    for (const p of json.meshes[n.mesh].primitives) {
      if ((p.mode ?? 4) !== 4) continue;
      const position = json.accessors[p.attributes.POSITION];
      const compte = p.indices !== undefined ? json.accessors[p.indices].count : position.count;
      vide.triangles += Math.floor(compte / 3);
      if (!position.min || !position.max) continue;
      for (let coin = 0; coin < 8; coin += 1) {
        const v = [0, 1, 2].map((k) => ((coin >> k) & 1 ? position.max[k] : position.min[k]));
        for (let k = 0; k < 3; k += 1) {
          const valeur = m[k] * v[0] + m[4 + k] * v[1] + m[8 + k] * v[2] + m[12 + k];
          vide.min[k] = Math.min(vide.min[k], valeur);
          vide.max[k] = Math.max(vide.max[k], valeur);
        }
      }
    }
    return vide;
  });

  const cumul = (i) => {
    const total = {
      triangles: propre[i].triangles,
      min: [...propre[i].min],
      max: [...propre[i].max],
    };
    for (const e of noeuds[i].children ?? []) {
      const sous = cumul(e);
      total.triangles += sous.triangles;
      for (let k = 0; k < 3; k += 1) {
        total.min[k] = Math.min(total.min[k], sous.min[k]);
        total.max[k] = Math.max(total.max[k], sous.max[k]);
      }
    }
    return total;
  };

  const clips = (json.animations ?? []).map((a, i) => {
    let duree = 0;
    for (const s of a.samplers ?? [])
      duree = Math.max(duree, json.accessors[s.input]?.max?.[0] ?? 0);
    return { nom: a.name ?? `clip-${i + 1}`, duree: Math.round(duree * 100) / 100 };
  });

  return {
    poids,
    clips,
    racines: racines
      .map((i) => ({ nom: noeuds[i].name ?? `noeud-${i}`, ...cumul(i) }))
      .filter((r) => r.triangles > 0),
    maillages: noeuds
      .map((n, i) => ({
        nom: n.name ?? `noeud-${i}`,
        aMaillage: n.mesh !== undefined,
        ...propre[i],
      }))
      .filter((n) => n.aMaillage && n.triangles > 0),
    entier: racines.map(cumul).reduce(
      (t, s) => ({
        triangles: t.triangles + s.triangles,
        min: t.min.map((v, k) => Math.min(v, s.min[k])),
        max: t.max.map((v, k) => Math.max(v, s.max[k])),
      }),
      { triangles: 0, min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] },
    ),
  };
}

// ---------------------------------------------------------------- noms

function chargerNoms(sources) {
  const noms = JSON.parse(readFileSync(path.join(ICI, 'noms-modeles.json'), 'utf8'));
  // Le dictionnaire prime (il départage trois bancs); sinon le nom est celui que le client lit en jeu, pris
  // dans la fiche qui cite le modèle; à défaut, l'identifiant mis en forme.
  for (const dossier of sources.fichesDeNoms ?? []) {
    const complet = path.resolve(RACINE, dossier);
    if (!existsSync(complet)) continue;
    for (const f of readdirSync(complet)
      .filter((n) => n.endsWith('.json'))
      .sort()) {
      try {
        const fiche = JSON.parse(readFileSync(path.join(complet, f), 'utf8'));
        if (
          typeof fiche.model === 'string' &&
          typeof fiche.name === 'string' &&
          !(fiche.model in noms)
        )
          noms[fiche.model] = fiche.name;
      } catch {
        // Une fiche illisible ne bloque pas l'inventaire: le modèle garde son nom de repli.
      }
    }
  }
  return noms;
}

function nomDeRepli(id) {
  const texte = id.replace(/--/g, ', ').replace(/[-_]+/g, ' ').trim();
  return texte.charAt(0).toUpperCase() + texte.slice(1);
}

// ---------------------------------------------------------------- lots

const cotes = (boite) => {
  if (!boite || !Number.isFinite(boite.min[0])) return null;
  const arrondi = (v) => Math.round(v * 1000) / 1000;
  return {
    largeur: arrondi(boite.max[0] - boite.min[0]),
    hauteur: arrondi(boite.max[1] - boite.min[1]),
    profondeur: arrondi(boite.max[2] - boite.min[2]),
  };
};

const listerGlb = (dossier) =>
  readdirSync(dossier)
    .filter((n) => n.toLowerCase().endsWith('.glb'))
    .sort((a, b) => a.localeCompare(b));

/** Chaque lot rend des modèles dont les fichiers sont des chemins absolus; la publication les copie ensuite. */
const MODES = {
  // Un GLB regroupe plusieurs modèles: un modèle par noeud racine de la scène.
  racines(lot, dossier) {
    const modeles = [];
    for (const fichier of listerGlb(dossier)) {
      const mesure = analyser(path.join(dossier, fichier));
      for (const r of mesure.racines) {
        modeles.push({
          cle: r.nom,
          famille: lot.familleParFichier?.[fichier] ?? lot.famille,
          fichier: path.join(dossier, fichier),
          noeud: r.nom,
          pieces: [],
          triangles: r.triangles,
          clips: mesure.clips,
          cotes: cotes(r),
        });
      }
    }
    return modeles;
  },

  // Pièces d'un personnage modulaire: un modèle par maillage, montré sur le mannequin du lot.
  pieces(lot, dossier) {
    const modeles = [];
    const mesures = new Map();
    const mesurer = (fichier) => {
      if (!mesures.has(fichier)) mesures.set(fichier, analyser(path.join(dossier, fichier)));
      return mesures.get(fichier);
    };
    for (const fichier of listerGlb(dossier)) {
      for (const m of mesurer(fichier).maillages) {
        const mannequin = (lot.mannequin ?? []).filter((p) => p.fichier !== fichier);
        const clips = [fichier, ...mannequin.map((p) => p.fichier)].flatMap(
          (f) => mesurer(f).clips,
        );
        modeles.push({
          cle: m.nom,
          famille: lot.famille,
          fichier: path.join(dossier, fichier),
          noeud: m.nom,
          pieces: mannequin.map((p) => ({
            fichier: path.join(dossier, p.fichier),
            noeud: p.noeud,
            role: 'mannequin',
          })),
          triangles: m.triangles,
          clips,
          cotes: cotes(m),
        });
      }
    }
    return modeles;
  },

  // Personnages de l'essai de style encré: corps, coiffure et col assemblés, atlas peint à part (atlas/index.json).
  'essai-encre'(lot, dossier) {
    const index = JSON.parse(readFileSync(path.join(dossier, lot.index), 'utf8'));
    const grille = JSON.parse(readFileSync(path.join(dossier, lot.traits), 'utf8'));
    const modeles = [];
    for (const [id, fiche] of Object.entries(index)) {
      if (id.startsWith('_') || typeof fiche.corps !== 'string') continue;
      const corps = path.join(dossier, 'modeles', `${fiche.corps}.glb`);
      const mesure = analyser(corps);
      const pieces = [];
      if (fiche.coiffure)
        pieces.push({
          fichier: path.join(dossier, 'modeles', `${fiche.corps}-${fiche.coiffure}.glb`),
          noeud: null,
          os: 'Head',
        });
      if (fiche.col)
        pieces.push({
          fichier: path.join(dossier, 'modeles', `${fiche.corps}-col.glb`),
          noeud: null,
          os: 'Spine',
        });
      const presentes = pieces.filter((p) => existsSync(p.fichier));
      const traits = path.join(dossier, 'atlas', `traits-${id}.png`);
      modeles.push({
        cle: id,
        famille: lot.famille,
        fichier: corps,
        noeud: null,
        pieces: presentes,
        textures: {
          atlas: path.join(dossier, 'atlas', `${id}.png`),
          traits: existsSync(traits)
            ? { fichier: traits, colonnes: grille.colonnes, rangees: grille.rangees }
            : null,
        },
        triangles:
          mesure.entier.triangles +
          presentes.reduce((t, p) => t + analyser(p.fichier).entier.triangles, 0),
        clips: mesure.clips,
        // Coiffure et col sont modelés en place sur le corps: les cotes sont celles du personnage coiffé.
        cotes: cotes(
          presentes
            .map((p) => analyser(p.fichier).entier)
            .reduce(
              (t, b) => ({
                min: t.min.map((v, k) => Math.min(v, b.min[k])),
                max: t.max.map((v, k) => Math.max(v, b.max[k])),
              }),
              mesure.entier,
            ),
        ),
      });
    }
    return modeles;
  },
};

// ---------------------------------------------------------------- publication

function main() {
  const sources = JSON.parse(readFileSync(SOURCES, 'utf8'));
  const noms = chargerNoms(sources);
  rmSync(SORTIE, { recursive: true, force: true });
  mkdirSync(SORTIE, { recursive: true });

  const publies = new Map(); // chemin absolu de la source -> { relatif, poids }
  const usages = new Map(); // chemin relatif publié -> nombre de modèles qui s'en servent
  const ecartes = [];
  const modeles = [];
  let total = 0;

  for (const lot of sources.lots) {
    const dossier = path.resolve(RACINE, lot.dossier);
    const mode = MODES[lot.mode];
    if (!mode) throw new Error(`lot ${lot.id}: mode inconnu « ${lot.mode} »`);
    if (!existsSync(dossier)) {
      ecartes.push({ id: lot.id, raison: `dossier absent: ${lot.dossier}` });
      continue;
    }
    for (const m of mode(lot, dossier)) {
      const id = `${lot.id}-${m.cle}`.toLowerCase().replace(/[^a-z0-9-]+/g, '-');
      const fichiers = [m.fichier, ...m.pieces.map((p) => p.fichier)];
      if (m.textures?.atlas) fichiers.push(m.textures.atlas);
      if (m.textures?.traits) fichiers.push(m.textures.traits.fichier);
      const nouveaux = [...new Set(fichiers)].filter((f) => !publies.has(f));
      const manquant = nouveaux.find((f) => !existsSync(f));
      const tropGros = nouveaux.find(
        (f) => existsSync(f) && statSync(f).size > sources.budget.fichierOctets,
      );
      const ajout = nouveaux.reduce((t, f) => t + (existsSync(f) ? statSync(f).size : 0), 0);
      let raison = null;
      if (manquant) raison = `fichier absent: ${path.relative(RACINE, manquant)}`;
      else if (tropGros)
        raison = `fichier de plus de ${sources.budget.fichierOctets} octets: ${path.relative(RACINE, tropGros)}`;
      else if (total + ajout > sources.budget.totalOctets) raison = 'budget total dépassé';
      // L'index compte pour un fichier.
      else if (publies.size + nouveaux.length + 1 > sources.budget.fichiers)
        raison = 'nombre de fichiers dépassé';
      if (raison) {
        ecartes.push({ id, raison });
        continue;
      }
      for (const f of nouveaux) {
        const relatif = `${lot.id}/${path.basename(f)}`;
        if ([...publies.values()].some((p) => p.relatif === relatif))
          throw new Error(`deux sources pour ${relatif}`);
        mkdirSync(path.join(SORTIE, lot.id), { recursive: true });
        copyFileSync(f, path.join(SORTIE, relatif));
        publies.set(f, { relatif, poids: statSync(f).size });
      }
      total += ajout;
      const publie = (f) => publies.get(f).relatif;
      const poids = [...new Set(fichiers)].reduce((t, f) => t + publies.get(f).poids, 0);
      usages.set(publie(m.fichier), (usages.get(publie(m.fichier)) ?? 0) + 1);
      modeles.push({
        id,
        nom: noms[m.cle] ?? nomDeRepli(m.cle),
        famille: m.famille,
        lot: lot.id,
        fichier: publie(m.fichier),
        noeud: m.noeud,
        pieces: m.pieces.map((p) => ({
          fichier: publie(p.fichier),
          noeud: p.noeud ?? null,
          os: p.os ?? null,
          role: p.role ?? 'piece',
        })),
        textures: m.textures
          ? {
              atlas: publie(m.textures.atlas),
              traits: m.textures.traits
                ? { ...m.textures.traits, fichier: publie(m.textures.traits.fichier) }
                : null,
            }
          : null,
        poids,
        triangles: m.triangles,
        clips: m.clips,
        cotes: m.cotes,
        source: path.relative(RACINE, m.fichier).split(path.sep).join('/'),
      });
    }
  }

  for (const m of modeles) m.partage = usages.get(m.fichier) ?? 1;
  const ordre = new Map(sources.familles.map((f, i) => [f.id, i]));
  modeles.sort(
    (a, b) =>
      (ordre.get(a.famille) ?? 99) - (ordre.get(b.famille) ?? 99) ||
      a.nom.localeCompare(b.nom, 'fr'),
  );
  const index = {
    format: 'tdb-modeles/1',
    familles: sources.familles,
    lots: sources.lots.map((l) => ({ id: l.id, titre: l.titre })),
    modeles,
    ecartes,
  };
  writeFileSync(path.join(SORTIE, 'index.json'), `${JSON.stringify(index, null, 1)}\n`);
  const mo = ((total + statSync(path.join(SORTIE, 'index.json')).size) / 1048576).toFixed(2);
  process.stdout.write(
    `modèles: ${modeles.length} dans ${publies.size + 1} fichiers, ${mo} Mo dans ${path.relative(RACINE, SORTIE)}; écartés: ${ecartes.length}\n`,
  );
  for (const e of ecartes) process.stdout.write(`  écarté: ${e.id} (${e.raison})\n`);
}

main();
