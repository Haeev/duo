// Prépare `modeles/` pour la publication de la page: celle-ci ne sert pas les fichiers `.glb`.
// Chaque `x.glb` devient `x.glb.json` ({ format, octets, base64 }); les autres fichiers sont copiés.
// Usage: node outils/tableau-de-bord/outils/emballer-modeles.mjs <dossier de sortie>
import {
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
  copyFileSync,
} from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const source = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'modeles');
const sortie = process.argv[2];
if (!sortie) throw new Error('dossier de sortie manquant');
const liste = [];
function parcourir(dossier) {
  for (const nom of readdirSync(dossier).sort()) {
    const chemin = path.join(dossier, nom);
    if (statSync(chemin).isDirectory()) {
      parcourir(chemin);
      continue;
    }
    const relatif = path.relative(source, chemin).split(path.sep).join('/');
    const cible = path.join(sortie, 'modeles', relatif);
    mkdirSync(path.dirname(cible), { recursive: true });
    if (relatif.endsWith('.glb')) {
      const octets = readFileSync(chemin);
      writeFileSync(
        cible + '.json',
        JSON.stringify({ format: 'glb', octets: octets.length, base64: octets.toString('base64') }),
      );
      liste.push('modeles/' + relatif + '.json');
    } else {
      copyFileSync(chemin, cible);
      liste.push('modeles/' + relatif);
    }
  }
}
parcourir(source);
writeFileSync(path.join(sortie, 'modeles-fichiers.json'), JSON.stringify(liste));
process.stdout.write(liste.length + ' fichiers prêts dans ' + path.join(sortie, 'modeles') + '\n');
