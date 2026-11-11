#!/usr/bin/env node
// Régénère `outils/tableau-de-bord/sons/` (fichiers .m4a et index.json) à partir du jeu:
// fichiers livrés, tables de sons, règles d'événements, musique et document sonore.
// Les mots (noms, familles, phrases « où et quand ») sont dans `sons-sources.json`.
// Le jeu livre de l'OGG, que Safari lit mal: chaque son est réencodé en AAC dans un .m4a.
// Usage: node outils/tableau-de-bord/outils/publier-sons.mjs [--tout]
//   --tout: réencode tout, même les fichiers déjà à jour.
import { execFileSync } from 'node:child_process';
import {
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
const SORTIE = path.resolve(ICI, '..', 'sons');
const CONFIG = lireJson(path.join(ICI, 'sons-sources.json'));
const JEU = path.join(RACINE, CONFIG.jeu);
const SON = path.join(JEU, 'assets', 'commun', 'son');
const FORCER = process.argv.includes('--tout');
const MO = 1024 * 1024;

const erreurs = [];
const avis = [];

function lireJson(fichier) {
  return JSON.parse(readFileSync(fichier, 'utf8'));
}
const majuscule = (t) => (t ? t.charAt(0).toUpperCase() + t.slice(1) : t);
const point = (t) => (t ? `${majuscule(t.trim()).replace(/[.,;]$/, '')}.` : '');
const relatif = (f) => path.relative(RACINE, f).split(path.sep).join('/');

/** 4.75 -> « 4 h 45 », 8 -> « 8 h ». */
function heure(h) {
  const total = Math.round(h * 60);
  const hh = Math.floor(total / 60) % 24;
  const mm = total % 60;
  return mm ? `${hh} h ${String(mm).padStart(2, '0')}` : `${hh} h`;
}
function liste(mots, et = 'et') {
  if (mots.length < 2) return mots.join('');
  return `${mots.slice(0, -1).join(', ')} ${et} ${mots[mots.length - 1]}`;
}
function remplir(modele, valeurs) {
  return modele.replace(/\{(\w+)\}/g, (_, cle) => {
    if (valeurs[cle] === undefined) erreurs.push(`valeur {${cle}} absente pour « ${modele} »`);
    return valeurs[cle] ?? cle;
  });
}

/* ---------- Lecture du jeu ---------- */

const sons = lireJson(path.join(JEU, 'src/audio/donnees/sons.json'));
const evenements = lireJson(path.join(JEU, 'src/audio/donnees/evenements.json'));
const ambiances = lireJson(path.join(JEU, 'src/audio/donnees/ambiances.json'));
const voix = lireJson(path.join(JEU, 'src/audio/donnees/voix.json'));
const musique = lireJson(path.join(JEU, 'src/audio/musique/donnees/musique.json'));
const documentSonore = readFileSync(path.join(RACINE, CONFIG.documentSonore), 'utf8');

function fichiersSous(dossier, extension) {
  if (!existsSync(dossier)) return [];
  return readdirSync(dossier, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dossier, e.name);
    if (e.isDirectory()) return e.name === 'node_modules' ? [] : fichiersSous(p, extension);
    return p.endsWith(extension) ? [p] : [];
  });
}
const sourcesTs = fichiersSous(path.join(JEU, 'src'), '.ts').filter(
  (f) => !f.startsWith(path.join(JEU, 'src', 'audio') + path.sep),
);
const donneesJson = fichiersSous(path.join(JEU, 'donnees'), '.json').map((f) => ({
  f,
  d: lireJson(f),
}));

/** Titres des scènes (`title`) et noms des événements du calendrier (`name`), avec leur lieu. */
const titres = { scene: new Map(), event: new Map() };
for (const { f, d } of donneesJson) {
  const m = /lieux[\\/]([^\\/]+)[\\/](scenes|evenements)[\\/]/.exec(f);
  if (!m || typeof d.id !== 'string') continue;
  const sorte = m[2] === 'scenes' ? 'scene' : 'event';
  titres[sorte].set(d.id, { titre: d.title ?? d.name ?? d.id, lieu: m[1] });
}
function titre(sorte, id) {
  const t = titres[sorte].get(id);
  if (!t) erreurs.push(`${sorte} « ${id} » introuvable dans donnees/lieux`);
  return t ? t.titre : id;
}
const enEssai = (sorte, id) => CONFIG.lieuxEssai.includes(titres[sorte].get(id)?.lieu);

/** Fiches du carnet (airs de la collection): `donnees/commun/carnet/<id>.json`. */
const carnet = new Map(
  donneesJson
    .filter(({ f, d }) => /carnet[\\/][^\\/]+\.json$/.test(f) && typeof d.id === 'string')
    .map(({ d }) => [d.id, d]),
);

/** Signaux d'interface (`onCue`) réellement émis: chaînes citées près d'un appel `onCue` ou `.cue(`. */
const signauxEmis = new Set();
for (const f of sourcesTs) {
  const lignes = readFileSync(f, 'utf8').split('\n');
  lignes.forEach((l, i) => {
    if (!/onCue\?*\.?\(|\.cue\(/.test(l)) return;
    const bloc = lignes.slice(i, i + 3).join(' ');
    for (const m of bloc.matchAll(/'([a-z0-9-]+)'|"([a-z0-9-]+)"/g)) signauxEmis.add(m[1] ?? m[2]);
  });
}
function preuve(p) {
  const f = path.join(JEU, p.fichier);
  return existsSync(f) && readFileSync(f, 'utf8').includes(p.motif);
}
for (const [signal, p] of Object.entries(CONFIG.signauxConstruits)) {
  if (preuve(p)) signauxEmis.add(signal);
}

/** Descriptions tirées du document sonore: tableaux des effets, des morceaux, des airs, des jingles, du babil. */
const descriptions = new Map();
const caracteres = new Map();
{
  let entete = null;
  for (const ligne of documentSonore.split('\n')) {
    if (!ligne.startsWith('|')) {
      entete = null;
      continue;
    }
    const c = ligne
      .split('|')
      .slice(1, -1)
      .map((x) => x.trim());
    if (!entete) {
      entete = c;
      continue;
    }
    if (c.every((x) => /^:?-+:?$/.test(x))) continue;
    const col = (nom) => c[entete.findIndex((e) => e.startsWith(nom))] ?? '';
    const premier = (/^`([a-z0-9-]+)`/.exec(c[0]) ?? [])[1];
    const propre = (t) => t.replace(/`/g, '').trim();
    const garder = (cle, texte) => {
      if (!descriptions.has(cle) && texte) descriptions.set(cle, point(propre(texte)));
    };
    if (entete[0] === 'Morceau' && premier)
      garder(
        `morceau:${premier}`,
        `${col('Instruments')}; ${col('Mesure')}, centre en ${col('Tonalité')}`,
      );
    else if (entete[0].startsWith('Air') && premier)
      garder(`morceau:${premier}`, `${col('Intention')}: ${col('Écriture')}`);
    else if (entete[0] === 'Jingle' && premier) garder(`jingle:${premier}`, col('Son'));
    else if (entete[0].startsWith('Voix') && premier) caracteres.set(premier, col('Caractère'));
    else
      for (const cellule of c) {
        const reperes = [...cellule.matchAll(/`([a-z0-9-]+)`/g)];
        reperes.forEach((m, k) => {
          const fin = k + 1 < reperes.length ? reperes[k + 1].index : cellule.length;
          let reste = cellule.slice(m.index + m[0].length, fin).trim();
          let entre = null;
          const p = /^\(([^)]*)\)\s*/.exec(reste);
          if (p) {
            entre = p[1];
            reste = reste.slice(p[0].length);
          }
          if (reste.startsWith(':')) garder(`effet:${m[1]}`, reste.slice(1).replace(/,\s*$/, ''));
          else if (entre && !/variante/.test(entre)) garder(`effet:${m[1]}`, entre);
        });
      }
  }
}

/* ---------- Phrases « où et quand » ---------- */

function cleRegle(r) {
  const conditions = Object.entries(r.where ?? {})
    .map(([k, v]) => {
      if (v && typeof v === 'object') {
        if ('gt' in v) return `${k}>${v.gt}`;
        if ('lt' in v) return `${k}<${v.lt}`;
        if (v.notNull) return `${k}=nonnul`;
        return `${k}=${JSON.stringify(v)}`;
      }
      return `${k}=${v}`;
    })
    .sort();
  return [r.on, ...conditions].join(' ');
}
/** « Titre » de la scène ou de l'événement visé par une règle, marqué s'il n'existe qu'en lieu d'essai. */
function nomsVises(r) {
  const w = r.where ?? {};
  const valeurs = {};
  for (const sorte of ['scene', 'event'])
    if (typeof w[sorte] === 'string')
      valeurs[sorte] =
        `« ${titre(sorte, w[sorte])} »` +
        (enEssai(sorte, w[sorte]) ? ` (${CONFIG.musique.essai})` : '');
  return valeurs;
}
function modeleEvenement(r) {
  const cle = cleRegle(r);
  const modele = CONFIG.evenements[cle] ?? CONFIG.evenements[r.on];
  if (!modele) erreurs.push(`phrase manquante dans sons-sources.json (evenements): « ${cle} »`);
  return { cle, modele: modele ?? cle, exact: Boolean(CONFIG.evenements[cle]) };
}
/** Phrase d'une règle d'événement: clé exacte d'abord, sinon modèle de l'événement avec {scene} ou {event}. */
function phraseEvenement(r) {
  return remplir(modeleEvenement(r).modele, nomsVises(r));
}
/** Assemble des phrases et leur public: « Quand…; quand…. Les deux joueurs l'entendent. » */
function assembler(morceaux) {
  if (!morceaux.length) return '';
  const vus = new Set();
  const uniques = morceaux.filter((m) => {
    const k = m.texte + '|' + (m.public ?? '');
    if (vus.has(k)) return false;
    vus.add(k);
    return true;
  });
  const publics = new Set(uniques.map((m) => m.public ?? ''));
  if (publics.size === 1) {
    const p = [...publics][0];
    return (
      point(uniques.map((m) => m.texte).join('; ')) + (p ? ` ${point(CONFIG.audience[p])}` : '')
    );
  }
  return point(
    uniques
      .map((m) => (m.public ? `${m.texte} (${CONFIG.audience[m.public]})` : m.texte))
      .join('; '),
  );
}

function ouEffet(id) {
  const morceaux = [];
  // Règles au modèle commun ({scene}, {event}) regroupées: « pendant la scène « A » ou « B » ».
  const groupes = new Map();
  for (const r of evenements.rules) {
    if (r.sound !== id) continue;
    const { modele, exact } = modeleEvenement(r);
    const valeurs = nomsVises(r);
    const cle = Object.keys(valeurs)[0];
    if (exact || !cle || !modele.includes(`{${cle}}`)) {
      morceaux.push({ texte: remplir(modele, valeurs), public: r.audience });
      continue;
    }
    const k = `${modele}|${r.audience}`;
    if (!groupes.has(k)) {
      groupes.set(k, { modele, cle, noms: [], public: r.audience });
      morceaux.push(groupes.get(k));
    }
    if (!groupes.get(k).noms.includes(valeurs[cle])) groupes.get(k).noms.push(valeurs[cle]);
  }
  for (const g of groupes.values()) g.texte = remplir(g.modele, { [g.cle]: liste(g.noms, 'ou') });
  for (const [signal, son] of Object.entries(evenements.cues ?? {})) {
    if (son !== id || !signauxEmis.has(signal)) continue;
    const t = CONFIG.signaux[signal];
    if (!t) erreurs.push(`phrase manquante dans sons-sources.json (signaux): « ${signal} »`);
    morceaux.push({ texte: t ?? signal, public: 'signal' });
  }
  const direct = CONFIG.branchementsDirects[id];
  if (direct && (id !== 'cible' || evenements.aim === 'cible')) {
    if (preuve(direct.preuve)) morceaux.push({ texte: direct.phrase, public: direct.audience });
    else avis.push(`${id}: branchement direct introuvable (${direct.preuve.fichier})`);
  }
  return morceaux;
}

function phraseRegleMusique(r) {
  const w = r.when ?? {};
  const M = CONFIG.musique;
  const parts = [];
  // Plusieurs événements (ou scènes) d'une même règle: une seule phrase, noms sans doublon.
  for (const [cle, sorte, modele] of [
    ['events', 'event', M.evenement],
    ['scenes', 'scene', M.scene],
  ]) {
    const ids = w[cle] ?? [];
    if (!ids.length) continue;
    const noms = [...new Set(ids.map((x) => `« ${titre(sorte, x)} »`))];
    const essai = ids.every((x) => enEssai(sorte, x)) ? ` (${M.essai})` : '';
    parts.push(remplir(modele, { [sorte]: liste(noms, 'ou') }) + essai);
  }
  const phases = (w.phases ?? []).map((p) => M.phases[p] ?? p);
  if (phases.length) parts.push(liste(phases, 'et'));
  const lieux = (w.places ?? []).filter((p) => !CONFIG.lieuxEssai.includes(p));
  if (w.places && !lieux.length) parts.push(`(${M.essai})`);
  if (lieux.length)
    parts.push(
      liste(
        lieux.map((p) => M.lieux[p] ?? p),
        'ou',
      ),
    );
  if (w.zones)
    parts.push(
      liste(
        w.zones.map((z) => M.zones[z] ?? z),
        'ou',
      ),
    );
  if (w.weathers)
    parts.push(
      `par ${liste(
        w.weathers.map((x) => M.meteo[x] ?? x),
        'ou',
      )}`,
    );
  if (w.seasons)
    parts.push(
      `en ${liste(
        w.seasons.map((x) => M.saisons[x] ?? x),
        'ou',
      )}`,
    );
  // Une règle sans tranche placée après la même règle avec tranches ne joue que le reste du temps
  // (la première règle qui convient l'emporte).
  let bandes = w.bands;
  if (!bandes) {
    const sans = (x) => JSON.stringify({ ...x, bands: undefined });
    const prises = musique.rules
      .slice(0, musique.rules.indexOf(r))
      .filter((p) => p.when?.bands && sans(p.when) === sans(w))
      .flatMap((p) => p.when.bands);
    if (prises.length)
      bandes = Object.keys(M.tranches).filter((b) => b !== 'cinq-douze' && !prises.includes(b));
  }
  if (bandes) {
    const tranches = bandes.map((b) => {
      const [de, a] = musique.bands[b] ?? [];
      return `${M.tranches[b] ?? b}${de === undefined ? '' : ` (${heure(de)} à ${heure(a)})`}`;
    });
    parts.push(liste(tranches, 'ou'));
  }
  for (const cle of Object.keys(w))
    if (
      !['events', 'scenes', 'phases', 'places', 'zones', 'weathers', 'seasons', 'bands'].includes(
        cle,
      )
    )
      erreurs.push(`condition de musique inconnue « ${cle} » (règle ${r.id})`);
  const rythme = M.rythmes[r.pacing];
  return `${parts.join(' ')}${rythme ? `, ${rythme}` : ''}`;
}
function ouMorceau(id) {
  return musique.rules
    .filter((r) => r.play === id)
    .map((r) => ({ texte: phraseRegleMusique(r), public: null }));
}
function ouJingle(id) {
  const morceaux = (musique.jingleRules ?? [])
    .filter((r) => r.jingle === id)
    .map((r) => ({ texte: phraseEvenement(r), public: r.audience }));
  const lieux = Object.entries(musique.arrivals ?? {})
    .filter(([lieu, j]) => j === id && !CONFIG.lieuxEssai.includes(lieu))
    .map(([lieu]) => CONFIG.musique.nomsLieux[lieu] ?? lieu);
  if (lieux.length)
    morceaux.push({
      texte: remplir(CONFIG.musique.arrivee, { lieu: liste(lieux, 'ou') }),
      public: 'both',
    });
  return morceaux;
}

/* ---------- Encodage ---------- */

function sonde(fichier, champ, flux) {
  const args = ['-v', 'error'];
  if (flux) args.push('-select_streams', 'a:0', '-show_entries', `stream=${champ}`);
  else args.push('-show_entries', `format=${champ}`);
  args.push('-of', 'csv=p=0', fichier);
  return execFileSync('ffprobe', args, { encoding: 'utf8' }).trim();
}
const dateAjoutCache = new Map();
/** Date du premier commit qui a ajouté le fichier; un fichier pas encore commité compte comme du jour. */
function dateAjout(fichier) {
  if (dateAjoutCache.has(fichier)) return dateAjoutCache.get(fichier);
  let d = '';
  try {
    d = execFileSync('git', ['log', '--diff-filter=A', '--format=%cs', '--', relatif(fichier)], {
      cwd: RACINE,
      encoding: 'utf8',
    })
      .trim()
      .split('\n')
      .filter(Boolean)
      .pop();
  } catch {
    d = '';
  }
  const date = d || new Date().toISOString().slice(0, 10);
  dateAjoutCache.set(fichier, date);
  return date;
}

let debitPrecedent = null;
try {
  debitPrecedent = lireJson(path.join(SORTIE, 'index.json')).debitKbps;
} catch {
  debitPrecedent = null;
}

/**
 * entrees: chemins absolus; mode: 'seul' | 'variantes' (à la suite, séparées d'un silence) |
 * 'tiges' (additionnées, comme la régie les joue ensemble).
 */
function encoder(entrees, sortie, mode, gainsDb) {
  const aJour =
    !FORCER &&
    debitPrecedent === CONFIG.debitKbps &&
    existsSync(sortie) &&
    entrees.every((e) => statSync(e).mtimeMs <= statSync(sortie).mtimeMs);
  const canaux = Math.max(...entrees.map((e) => Number(sonde(e, 'channels', true)) || 1));
  if (aJour) return canaux;
  const args = ['-hide_banner', '-loglevel', 'error', '-y', '-threads', '1'];
  entrees.forEach((e) => args.push('-i', e));
  if (mode === 'seul') args.push('-map', '0:a');
  else {
    let graphe = '';
    const n = entrees.length;
    if (mode === 'variantes') {
      entrees.forEach((_, i) => {
        graphe +=
          i < n - 1
            ? `[${i}:a]apad=pad_dur=${CONFIG.silenceEntreVariantes}[v${i}];`
            : `[${i}:a]anull[v${i}];`;
      });
      graphe += `${entrees.map((_, i) => `[v${i}]`).join('')}concat=n=${n}:v=0:a=1[s]`;
    } else {
      entrees.forEach((_, i) => {
        graphe += `[${i}:a]volume=${gainsDb?.[i] ?? 0}dB[t${i}];`;
      });
      graphe += `${entrees.map((_, i) => `[t${i}]`).join('')}amix=inputs=${n}:normalize=0:duration=longest[s]`;
    }
    args.push('-filter_complex', graphe, '-map', '[s]');
  }
  args.push(
    '-ac',
    String(canaux),
    '-ar',
    '48000',
    '-c:a',
    'aac',
    '-b:a',
    `${CONFIG.debitKbps * canaux}k`,
    '-map_metadata',
    '-1',
    '-fflags',
    '+bitexact',
    '-flags:a',
    '+bitexact',
    '-movflags',
    '+faststart',
    sortie,
  );
  execFileSync('ffmpeg', args, { stdio: ['ignore', 'ignore', 'inherit'] });
  return canaux;
}

/* ---------- Inventaire ---------- */

const index = [];
const ranges = new Set();

function ajouter(section, entree) {
  const { id, sources, mode, gainsDb, sorteSon } = entree;
  if (!/^[a-z0-9-]+$/.test(id)) erreurs.push(`identifiant non conforme: ${id}`);
  const manquants = sources.filter((s) => !existsSync(s));
  if (manquants.length) {
    erreurs.push(`${id}: fichier absent ${manquants.map(relatif).join(', ')}`);
    return;
  }
  const nom = entree.nom ?? CONFIG.noms[id];
  if (!nom) erreurs.push(`nom manquant dans sons-sources.json (noms): « ${id} »`);
  const fichier = `${id}.m4a`;
  const sortie = path.join(SORTIE, fichier);
  const canaux = encoder(sources, sortie, mode, gainsDb);
  const ou = assembler(entree.ou);
  const ajoutLe = sources.map(dateAjout).sort()[0];
  index.push({
    id,
    section: section.id,
    sorte: sorteSon,
    nom: nom ?? id,
    ou: ou || section.nonBranche || CONFIG.nonBranche,
    branche: Boolean(ou),
    description: entree.description ?? '',
    duree: Math.round(Number(sonde(sortie, 'duration')) * 100) / 100,
    boucle: Boolean(entree.boucle),
    variantes: mode === 'variantes' ? sources.length : 1,
    canaux,
    fichier,
    octets: statSync(sortie).size,
    ajoutLe,
    nouveau: ajoutLe >= CONFIG.nouveauDepuis,
    sources: sources.map(relatif),
  });
}

const effetsRanges = new Set(
  CONFIG.sections.filter((s) => s.sorte === 'effets').flatMap((s) => s.sons),
);
const autres = Object.keys(sons).filter((id) => !effetsRanges.has(id));
if (autres.length)
  avis.push(`effets sans famille, rangés dans « Autres effets »: ${autres.join(', ')}`);

mkdirSync(SORTIE, { recursive: true });
for (const section of CONFIG.sections) {
  if (section.sorte === 'morceaux' || section.sorte === 'airs') {
    for (const [id, morceau] of Object.entries(musique.tracks)) {
      const fiche = carnet.get(id);
      if ((section.sorte === 'airs') !== Boolean(fiche)) continue;
      const tiges = Object.values(morceau.stems);
      const ou = ouMorceau(id);
      if (fiche) ou.unshift({ texte: `air de la fiche « ${fiche.name} » du carnet`, public: null });
      ajouter(section, {
        id: fiche ? id : `musique-${id}`,
        nom: fiche ? fiche.name : undefined,
        sorteSon: 'musique',
        sources: tiges.map((t) => path.join(SON, t.file)),
        mode: 'tiges',
        gainsDb: tiges.map((t) => t.volumeDb ?? 0),
        boucle: true,
        description: [fiche?.text, descriptions.get(`morceau:${id}`)].filter(Boolean).join(' '),
        // Un air que seule sa fiche cite n'est pas branché: la fiche ne le joue pas encore.
        ou: fiche && ou.length === 1 ? [] : ou,
      });
    }
  } else if (section.sorte === 'jingles') {
    for (const [id, j] of Object.entries(musique.jingles)) {
      ajouter(section, {
        id: `jingle-${id}`,
        sorteSon: 'jingle',
        sources: [path.join(SON, j.file)],
        mode: 'seul',
        description: descriptions.get(`jingle:${id}`) ?? '',
        ou: ouJingle(id),
      });
    }
  } else if (section.sorte === 'effets') {
    const ids = section.id === 'autres' ? autres : section.sons;
    for (const id of ids) {
      const s = sons[id];
      if (!s) {
        erreurs.push(`effet « ${id} » cité dans sons-sources.json mais absent de sons.json`);
        continue;
      }
      if (ranges.has(id)) erreurs.push(`effet « ${id} » rangé dans deux familles`);
      ranges.add(id);
      ajouter(section, {
        id: `effet-${id}`,
        sorteSon: 'effet',
        sources: s.files.map((f) => path.join(SON, f)),
        mode: s.files.length > 1 ? 'variantes' : 'seul',
        description: descriptions.get(`effet:${id}`) ?? '',
        ou: ouEffet(id),
      });
    }
  } else if (section.sorte === 'ambiances') {
    const valeurs = {
      aube: `${heure(ambiances.dawn[0])} à ${heure(ambiances.dawn[1])}`,
      soir: `${heure(ambiances.dusk[0])} à ${heure(ambiances.dusk[1])}`,
    };
    for (const [id, couche] of Object.entries(ambiances.layers)) {
      const modele = CONFIG.ambiances[couche.when];
      if (!modele) erreurs.push(`phrase manquante (ambiances): « ${couche.when} »`);
      ajouter(section, {
        id: `ambiance-${id}`,
        sorteSon: 'ambiance',
        sources: [path.join(SON, couche.file)],
        mode: 'seul',
        boucle: true,
        description: CONFIG.descriptions[`ambiance-${id}`] ?? '',
        ou: modele ? [{ texte: remplir(modele, valeurs), public: 'both' }] : [],
      });
    }
  } else if (section.sorte === 'voix') {
    // Habitants des vrais lieux seulement (ni gabarit, ni lieu d'essai).
    const usages = new Map();
    for (const { f, d } of donneesJson) {
      const m = /lieux[\\/]([^\\/]+)[\\/]habitants[\\/]/.exec(f);
      if (!m || CONFIG.lieuxEssai.includes(m[1])) continue;
      const compter = (o) => {
        if (Array.isArray(o)) o.forEach(compter);
        else if (o && typeof o === 'object') {
          if (typeof o.voice === 'string') usages.set(o.voice, (usages.get(o.voice) ?? 0) + 1);
          Object.values(o).forEach(compter);
        }
      };
      compter(d);
    }
    const branche = preuve(CONFIG.voix.preuve);
    for (const [id, timbre] of Object.entries(voix.timbres)) {
      const voixDuTimbre = Object.entries(voix.voices)
        .filter(([, v]) => v.timbre === id)
        .map(([v]) => v);
      const n = voixDuTimbre.reduce((t, v) => t + (usages.get(v) ?? 0), 0);
      const ou =
        branche && n > 0
          ? [
              {
                texte: remplir(CONFIG.voix.phrase, {
                  caracteres: liste(
                    voixDuTimbre.map((v) => `« ${caracteres.get(v) ?? v} »`),
                    'ou',
                  ),
                  habitants: `${n} ${n > 1 ? 'habitants' : 'habitant'}`,
                }),
                public: 'both',
              },
            ]
          : [];
      ajouter(section, {
        id: `voix-${id}`,
        sorteSon: 'voix',
        sources: [path.join(SON, timbre.file)],
        mode: 'seul',
        description: CONFIG.descriptions.voix ?? '',
        ou,
      });
    }
  }
}

/* ---------- Contrôles et écriture ---------- */

const total = index.reduce((t, s) => t + s.octets, 0);
for (const s of index)
  if (s.octets > CONFIG.plafondFichierMo * MO)
    erreurs.push(
      `${s.fichier} pèse ${(s.octets / MO).toFixed(1)} Mo (plafond ${CONFIG.plafondFichierMo} Mo)`,
    );
if (total > CONFIG.plafondTotalMo * MO)
  erreurs.push(
    `ensemble de ${(total / MO).toFixed(1)} Mo (plafond ${CONFIG.plafondTotalMo} Mo): baisse debitKbps`,
  );
// Fichiers devenus orphelins (son retiré du jeu).
const attendus = new Set(index.map((s) => s.fichier).concat('index.json'));
for (const f of readdirSync(SORTIE)) if (!attendus.has(f)) rmSync(path.join(SORTIE, f));

if (erreurs.length) {
  process.stderr.write(`Publication des sons refusée:\n- ${[...new Set(erreurs)].join('\n- ')}\n`);
  process.exit(1);
}
const sections = CONFIG.sections
  .map((s) => ({ id: s.id, titre: s.titre }))
  .filter((s) => index.some((x) => x.section === s.id));
writeFileSync(
  path.join(SORTIE, 'index.json'),
  JSON.stringify(
    {
      jeu: CONFIG.titreJeu,
      genereLe: new Date().toISOString(),
      format: 'AAC dans un conteneur MP4 (.m4a)',
      debitKbps: CONFIG.debitKbps,
      nouveauDepuis: CONFIG.nouveauDepuis,
      octets: total,
      sections,
      sons: index,
    },
    null,
    2,
  ) + '\n',
);
const parSection = sections
  .map((s) => `${s.titre}: ${index.filter((x) => x.section === s.id).length}`)
  .join('\n  ');
const duree = index.reduce((t, s) => t + s.duree, 0);
process.stdout.write(
  `${index.length} sons, ${(total / MO).toFixed(2)} Mo, ${Math.round(duree)} s d'écoute, AAC ${CONFIG.debitKbps} kbit/s par canal\n  ${parSection}\n` +
    `Pas encore branchés: ${
      index
        .filter((s) => !s.branche)
        .map((s) => s.id)
        .join(', ') || 'aucun'
    }\n` +
    `Nouveaux depuis le ${CONFIG.nouveauDepuis}: ${index.filter((s) => s.nouveau).length}\n` +
    (avis.length ? `Avis:\n- ${avis.join('\n- ')}\n` : ''),
);
