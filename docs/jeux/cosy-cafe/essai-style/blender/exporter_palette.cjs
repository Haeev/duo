'use strict';
// Sort la palette de la bible (seule source: bible/source/palette.cjs) en JSON plat pour les scripts Blender:
// { couleurs: { id: hex }, peaux: [...], cheveux: [...], joueurs: { orb: {...}, crescent: {...} }, moments: {...} }
const path = require('path');
const fs = require('fs');

const P = require(path.join(__dirname, '..', '..', 'bible', 'source', 'palette.cjs'));
const joueurs = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', '..', '..', '..', 'design', 'identite', 'b', 'joueurs.json'), 'utf8'));

const couleurs = {};
const add = (list) => list.forEach((c) => { couleurs[c.id] = c.hex; });
add(P.common);
add(P.seasons);
add(P.topsLight);
add(P.topsDark);
add([P.playerPiping, P.playerOn]);
add(P.house);
add(P.staffShirts);
Object.values(P.profiles).forEach((p) => add(p.colors));
Object.values(P.addresses).forEach((a) => { add(a.interior); add(a.exterior); });
Object.values(P.styles).forEach((s) => add(s.colors));

const out = {
  couleurs,
  peaux: P.skins,
  cheveux: P.hair,
  joueurs: Object.fromEntries(joueurs.players.map((j) => [j.id, { couleur: j.color, symbole: j.on, nom: j.label, chemin: j.path }])),
  moments: P.moments,
};
process.stdout.write(JSON.stringify(out, null, 1));
