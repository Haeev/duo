/**
 * Les fichiers de contenu du game designer, empaquetés avec le jeu (aucune
 * lecture de disque à l'exécution: ADR 0004).
 */
import annonces from '../../donnees/annonces.json';
import astuces from '../../donnees/astuces.json';
import catalogue from '../../donnees/catalogue.json';
import chantiers from '../../donnees/chantiers.json';
import courrier from '../../donnees/courrier.json';
import cultures from '../../donnees/cultures.json';
import envies from '../../donnees/envies.json';
import habitants from '../../donnees/habitants.json';
import moments from '../../donnees/moments.json';
import objets from '../../donnees/objets.json';
import pieces from '../../donnees/pieces.json';
import quetes from '../../donnees/quetes.json';
import reglages from '../../donnees/reglages.json';
import textes from '../../donnees/textes.json';
import type { RawContentFiles } from './contenu';

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
};
