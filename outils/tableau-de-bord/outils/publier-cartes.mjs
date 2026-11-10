#!/usr/bin/env node
// Régénère `outils/tableau-de-bord/cartes/` à partir des plans de lieux (format `plan-de-lieu`).
// Un lieu ou une vue de plus: une ligne dans `cartes-sources.json`, puis relancer ce script.
// Usage: node outils/tableau-de-bord/outils/publier-cartes.mjs
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const RACINE = path.resolve(ICI, '..', '..', '..');
const SORTIE = path.resolve(ICI, '..', 'cartes');
const LIMITE_FICHIER = 2 * 1024 * 1024;
const CALQUES = [
  { id: 'batiments', titre: 'Bâtiments et repères' },
  { id: 'chemins', titre: 'Chemins' },
  { id: 'verrous', titre: 'Verrous' },
  { id: 'ressources', titre: 'Ressources' },
  { id: 'points', titre: 'Points de quête' },
];

const arrondi = (n) => Math.round(n * 100) / 100;
const majuscule = (t) => (t ? t.charAt(0).toUpperCase() + t.slice(1) : t);
const point = (t) => (t ? `${majuscule(t.trim()).replace(/[.]$/, '')}.` : '');
const phrase = (...morceaux) =>
  morceaux.filter((m) => typeof m === 'string' && m.trim() !== '').join(' ');

/** Lit la taille de l'image et le cadre du plan: le SVG du level designer emboîte un `<svg viewBox>` en mètres. */
function lireCadre(svg, fichier) {
  const balises = [...svg.matchAll(/<svg\b([^>]*)>/g)].map((m) => m[1]);
  const attribut = (texte, nom) => {
    const m = new RegExp(`\\b${nom}="([^"]*)"`).exec(texte);
    return m ? m[1] : null;
  };
  if (balises.length < 2)
    throw new Error(`${fichier}: pas de <svg> emboîté, cadre du plan introuvable`);
  const nombres = (t) => (t ?? '').split(/[\s,]+/).map(Number);
  const [, , largeurImage, hauteurImage] = nombres(attribut(balises[0], 'viewBox'));
  const [vx, vy, vl, vh] = nombres(attribut(balises[1], 'viewBox'));
  const cadre = {
    x: Number(attribut(balises[1], 'x') ?? 0),
    y: Number(attribut(balises[1], 'y') ?? 0),
    largeur: Number(attribut(balises[1], 'width')),
    hauteur: Number(attribut(balises[1], 'height')),
  };
  const valeurs = [
    largeurImage,
    hauteurImage,
    vx,
    vy,
    vl,
    vh,
    cadre.x,
    cadre.y,
    cadre.largeur,
    cadre.hauteur,
  ];
  if (valeurs.some((v) => !Number.isFinite(v)))
    throw new Error(`${fichier}: cadre du plan illisible`);
  return {
    image: { largeur: largeurImage, hauteur: hauteurImage },
    cadre,
    vue: { x: vx, y: vy, largeur: vl, hauteur: vh },
  };
}

/** Réduit `plan.json` à ce que la page affiche: lieux nommés (nom et raison d'être) et tronçons de chemins. */
function extraireLieu(plan) {
  const elements = [];
  const ajoute = (calque, sorte, nom, texte, acte, geometrie) =>
    elements.push({
      calque,
      sorte,
      nom: majuscule(nom),
      texte: texte || '',
      acte: acte ?? null,
      ...geometrie,
    });
  for (const b of plan.batiments ?? []) {
    ajoute(
      'batiments',
      'Bâtiment',
      b.nom,
      phrase(point(b.raison), b.qui ? `Pour: ${b.qui}.` : ''),
      b.acte,
      {
        rect: b.rect,
        x: arrondi(b.rect[0] + b.rect[2] / 2),
        y: arrondi(b.rect[1] + b.rect[3] / 2),
      },
    );
  }
  for (const r of plan.reperes ?? []) {
    ajoute(
      'batiments',
      'Repère',
      r.nom,
      phrase(point(r.raison), r.h ? `Hauteur: ${r.h} m.` : ''),
      null,
      {
        x: r.x,
        y: r.y,
      },
    );
  }
  for (const e of plan.plans_eau ?? []) {
    ajoute('batiments', 'Eau', e.nom, point(e.raison), null, {
      x: e.cx,
      y: e.cy,
      r: Math.max(e.rx, e.ry),
    });
  }
  for (const o of plan.ouvrages ?? []) {
    ajoute('chemins', 'Ouvrage', o.nature, point(o.raison), null, { x: o.x, y: o.y, r: o.r ?? 2 });
  }
  for (const [id, v] of Object.entries(plan.verrous ?? {})) {
    const texte = phrase(
      v.leve ? `Levé quand: ${point(v.leve)}` : '',
      v.pas_encore ? `En jeu: « ${v.pas_encore} »` : '',
    );
    ajoute('verrous', `Verrou ${id}`, v.obstacle, texte, v.acte, { x: v.x, y: v.y });
  }
  for (const r of plan.ressources ?? []) {
    const centre = r.rect
      ? {
          x: arrondi(r.rect[0] + r.rect[2] / 2),
          y: arrondi(r.rect[1] + r.rect[3] / 2),
          rect: r.rect,
        }
      : { x: r.x, y: r.y };
    const texte = phrase(
      point(r.pourquoi),
      r.heures ? `Heures: ${r.heures}.` : '',
      r.saisons ? `Saisons: ${[].concat(r.saisons).join(', ')}.` : '',
    );
    ajoute('ressources', `Ressource (${r.nature})`, r.id.replace(/-/g, ' '), texte, r.acte, centre);
  }
  for (const p of plan.points_interet ?? []) {
    ajoute('points', `Point (${p.type})`, p.nom, '', p.acte, { x: p.x, y: p.y });
  }
  for (const p of plan.points_nommes ?? []) {
    const sorte = p.role === 'siege' ? 'Siège' : 'Poste d’un habitant';
    ajoute('points', sorte, p.qui ?? p.id, point(p.pourquoi), null, { x: p.x, y: p.y });
  }
  const chemins = [];
  for (const a of plan.aretes ?? []) {
    const de = plan.noeuds?.[a.a];
    const vers = plan.noeuds?.[a.b];
    if (!de || !vers) continue;
    chemins.push({
      a: [de.x, de.y],
      b: [vers.x, vers.y],
      classe: a.classe,
      nom: a.nom ?? null,
      verrou: a.verrou ?? null,
    });
  }
  const eaux = (plan.eaux ?? []).map((e) => ({
    nom: majuscule(e.nom),
    texte: point(e.raison),
    largeur: e.largeur,
    points: e.pts,
  }));
  return {
    format: 'tdb-lieu/1',
    id: plan.id,
    nom: plan.nom,
    taille: plan.taille,
    vitesses: plan.vitesses ?? null,
    zones: Object.entries(plan.zones ?? {}).map(([id, z]) => ({
      id,
      nom: z.nom,
      acte: z.acte,
      contour: z.poly,
    })),
    elements,
    chemins,
    eaux,
  };
}

function main() {
  const sources = JSON.parse(readFileSync(path.join(ICI, 'cartes-sources.json'), 'utf8'));
  rmSync(SORTIE, { recursive: true, force: true });
  const index = { format: 'tdb-cartes/1', calques: CALQUES, lieux: [], cartes: [] };
  let total = 0;
  const ecrire = (relatif, contenu) => {
    const cible = path.join(SORTIE, relatif);
    mkdirSync(path.dirname(cible), { recursive: true });
    writeFileSync(cible, contenu);
    const poids = Buffer.byteLength(contenu);
    if (poids > LIMITE_FICHIER) throw new Error(`${relatif}: ${poids} octets, plus de 2 Mo`);
    total += poids;
    return poids;
  };
  for (const lieu of sources.lieux) {
    const dossier = path.join(RACINE, lieu.dossier);
    const plan = JSON.parse(readFileSync(path.join(dossier, lieu.plan), 'utf8'));
    const donnees = `${lieu.id}/lieu.json`;
    ecrire(donnees, JSON.stringify(extraireLieu(plan)));
    index.lieux.push({
      id: lieu.id,
      nom: lieu.nom,
      largeur: plan.taille.largeur,
      hauteur: plan.taille.hauteur,
      vitesses: plan.vitesses ?? null,
      donnees,
    });
    for (const carte of lieu.cartes) {
      // Le rendu d'origine nomme une police absente des Mac et des PC: on ajoute des polices de repli de même chasse.
      const svg = readFileSync(path.join(dossier, carte.fichier), 'utf8').replaceAll(
        'font-family="DejaVu Sans"',
        'font-family="DejaVu Sans, Verdana, Geneva, sans-serif"',
      );
      const fichier = `${lieu.id}/${carte.fichier}`;
      const poids = ecrire(fichier, svg);
      const { image, cadre, vue } = lireCadre(svg, carte.fichier);
      index.cartes.push({
        id: `${lieu.id}-${path.basename(carte.fichier, path.extname(carte.fichier))}`,
        lieu: lieu.id,
        titre: carte.titre,
        fichier,
        poids,
        largeur: vue.largeur,
        hauteur: vue.hauteur,
        image,
        cadre,
        vue,
        calques: CALQUES.map((c) => c.id),
      });
    }
  }
  total += ecrire('index.json', `${JSON.stringify(index, null, 1)}\n`);
  const ko = (total / 1024).toFixed(0);
  process.stdout.write(
    `cartes: ${index.cartes.length} vues, ${index.lieux.length} lieu(x), ${ko} Ko dans ${path.relative(RACINE, SORTIE)}\n`,
  );
}

main();
