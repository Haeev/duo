/**
 * Les fichiers de contenu du game designer, empaquetés avec le jeu (aucune
 * lecture de disque à l'exécution: ADR 0004).
 */
import annonces from '../../donnees/annonces.json';
import astuces from '../../donnees/astuces.json';
import calendrier from '../../donnees/calendrier.json';
import catalogue from '../../donnees/catalogue.json';
import chantiers from '../../donnees/chantiers.json';
import courrier from '../../donnees/courrier.json';
import cultures from '../../donnees/cultures.json';
import envies from '../../donnees/envies.json';
import habitants from '../../donnees/habitants.json';
import marche from '../../donnees/marche.json';
import moments from '../../donnees/moments.json';
import objets from '../../donnees/objets.json';
import pieces from '../../donnees/pieces.json';
import quetes from '../../donnees/quetes.json';
import reglages from '../../donnees/reglages.json';
import textes from '../../donnees/textes.json';
import vetements from '../../donnees/vetements.json';
import type { RawContentFiles } from './contenu';

/**
 * 0.13: `habitants-0-13.json` (game designer, lot H4) est facultatif: lu s'il existe, sans casser
 * la construction tant qu'il n'est pas écrit (Vitest garde la transformation en cache: un fichier
 * ajouté ou retiré ne se voit qu'une fois ce module modifié ou le cache vidé).
 */
const extraVillagers = import.meta.glob<unknown>('../../donnees/habitants-0-13.json', { eager: true, import: 'default' });
const habitants013 = Object.values(extraVillagers)[0];

export const CONTENT_FILES: RawContentFiles = {
  objets,
  cultures,
  habitants,
  quetes,
  courrier,
  astuces,
  envies,
  textes,
  reglages,
  moments,
  annonces,
  chantiers,
  catalogue,
  pieces,
  marche,
  vetements,
  calendrier,
  ...(habitants013 === undefined ? {} : { habitants013 }),
};
