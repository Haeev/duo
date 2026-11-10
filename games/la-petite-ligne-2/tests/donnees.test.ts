// Validateurs des données du jalon 1: les vraies données passent, et chaque faute type est nommée.
import { describe, expect, it } from 'vitest';
import { ContentError, loadContent } from '../src/donnees/charger';
import { dataFiles, gameContent } from './aides';

type Json = Record<string, unknown>;

/** Charge des données modifiées et rend les problèmes trouvés. */
function problemsAfter(change: (files: Record<string, Json>) => void): string[] {
  const files = dataFiles() as Record<string, Json>;
  change(files);
  try {
    loadContent(files);
  } catch (error) {
    if (error instanceof ContentError) return [...error.problems];
    throw error;
  }
  return [];
}

const DIALOGUE = 'lieux/essai-gare/dialogues/accueil.json';
const MAP = 'lieux/essai-gare/carte.json';

function nodesOf(files: Record<string, Json>): Record<string, Json> {
  return files[DIALOGUE]?.nodes as Record<string, Json>;
}

function fileOf(files: Record<string, Json>, path: string): Json {
  const file = files[path];
  if (file === undefined) throw new Error(`${path} absent`);
  return file;
}

function nodeOf(files: Record<string, Json>, id: string): Json {
  const node = nodesOf(files)[id];
  if (node === undefined) throw new Error(`nœud ${id} absent`);
  return node;
}

function bricksOf(files: Record<string, Json>, prop: string): Json[] {
  return files[`commun/meubles/${prop}.json`]?.bricks as Json[];
}

describe('données du jeu', () => {
  it('se chargent sans problème', () => {
    const content = gameContent();
    expect(Object.keys(content.places).sort()).toEqual([
      'aubrune',
      'essai-gare',
      'essai-halte',
      'train-de-nuit',
    ]);
    expect(content.items.pomme?.stack).toBe(10);
    expect(content.bags.toolbarSlots).toBe(5);
    expect(content.places['essai-gare']?.dialogues.map((d) => d.id)).toContain('accueil');
    expect(Object.keys(content.props)).toEqual(
      expect.arrayContaining(['banc', 'chaise', 'pommier', 'pompe', 'tas-de-bois']),
    );
  });

  it('refusent un champ inconnu ou mal typé, avec le chemin', () => {
    const problems = problemsAfter((files) => {
      (files['commun/reglages.json']?.clock as Json).secondsPerHour = 'vite';
    });
    expect(problems.join('\n')).toMatch(/commun\/reglages\.json, clock\.secondsPerHour/);
  });

  it('refusent un fichier absent', () => {
    const problems = problemsAfter((files) => {
      delete files['commun/sacs.json'];
    });
    expect(problems).toContain('commun/sacs.json: fichier absent');
  });
});

describe('validateur des dialogues', () => {
  it('nomme une suite absente', () => {
    const problems = problemsAfter((files) => {
      nodeOf(files, 'bonjour').next = 'nulle-part';
    });
    expect(problems.join('\n')).toMatch(/nœud bonjour: suite « nulle-part » absente/);
  });

  it('nomme un nœud jamais atteint', () => {
    const problems = problemsAfter((files) => {
      nodesOf(files).orphelin = {
        kind: 'line',
        speaker: 'cheffe-de-gare',
        text: 'Personne ne m’entend.',
        emote: null,
        next: null,
      };
    });
    expect(problems.join('\n')).toMatch(/nœud « orphelin » jamais atteint/);
  });

  it('refuse un dialogue qui boucle', () => {
    const problems = problemsAfter((files) => {
      nodeOf(files, 'revoir').next = 'tri';
    });
    expect(problems.join('\n')).toMatch(/le graphe boucle/);
  });

  it('refuse une réplique de plus de trois lignes et un locuteur inconnu', () => {
    const problems = problemsAfter((files) => {
      const line = nodeOf(files, 'revoir');
      line.text = 'la '.repeat(60);
      line.speaker = 'inconnu';
    });
    expect(problems.join('\n')).toMatch(/réplique de 180 caractères/);
    expect(problems.join('\n')).toMatch(/locuteur inconnu « inconnu »/);
  });

  it('refuse un effet qui donne un objet ou un sac inconnu', () => {
    const problems = problemsAfter((files) => {
      const options = (nodesOf(files).choix as { options: { effects: Json[] }[] }).options;
      options[0]?.effects.push(
        { type: 'give_item', item: 'licorne', count: 1 },
        { type: 'give_bag', bag: 'valise' },
      );
    });
    expect(problems.join('\n')).toMatch(/objet inconnu « licorne »/);
    expect(problems.join('\n')).toMatch(/sac inconnu « valise »/);
  });
});

describe('validateur des lieux', () => {
  it('exige un lien de rail écrit dans les deux sens', () => {
    const problems = problemsAfter((files) => {
      fileOf(files, 'lieux/essai-halte/lieu.json').links = [];
    });
    expect(problems.join('\n')).toMatch(
      /le lien vers « essai-halte » n'est pas écrit dans l'autre sens/,
    );
  });

  it('borne les gestes courants à 1,5 s', () => {
    const problems = problemsAfter((files) => {
      const gather = bricksOf(files, 'pommier')[0];
      if (gather !== undefined) gather.seconds = 3;
    });
    expect(problems.join('\n')).toMatch(/commun\/meubles\/pommier\.json, bricks\.0\.seconds/);
  });

  it('refuse un point de gare absent ou dans un mur', () => {
    const problems = problemsAfter((files) => {
      const points = files[MAP]?.points as Record<string, Json>;
      delete points.quai;
      points.descente = { x: 20, y: 10 };
    });
    expect(problems.join('\n')).toMatch(/point de gare « quai » absent/);
    expect(problems.join('\n')).toMatch(/point « descente » dans une zone bloquée/);
  });

  it('refuse un objet de carte d’un type de meuble inconnu, et une brique en double', () => {
    const problems = problemsAfter((files) => {
      const objects = files[MAP]?.objects as Json[];
      const first = objects[0];
      if (first !== undefined) first.type = 'trampoline';
      bricksOf(files, 'banc').push({ brick: 'sit', seats: 1, restPerMinute: 1 });
    });
    expect(problems.join('\n')).toMatch(/meuble inconnu « trampoline »/);
    expect(problems.join('\n')).toMatch(/commun\/meubles\/banc\.json: brique « sit » en double/);
  });

  it('exige que le fichier porte l’identifiant de son contenu', () => {
    const problems = problemsAfter((files) => {
      const item = files['commun/objets/pomme.json'];
      if (item !== undefined) item.id = 'poire';
    });
    expect(problems.join('\n')).toMatch(
      /commun\/objets\/pomme\.json: l'identifiant « poire » doit être le nom du fichier/,
    );
  });

  it('exige que le dossier porte l’identifiant du lieu', () => {
    const problems = problemsAfter((files) => {
      fileOf(files, 'lieux/essai-halte/lieu.json').id = 'autre';
    });
    expect(problems.join('\n')).toMatch(/doit être le nom du dossier « essai-halte »/);
  });
});

describe('validateur des réglages communs', () => {
  it('refuse des paliers de besoin mal rangés et un outil qui s’empile', () => {
    const problems = problemsAfter((files) => {
      const needs = files['commun/besoins.json']?.needs as { tiers: Json[] }[];
      needs[0]?.tiers.reverse();
      const axe = files['commun/objets/hache.json'];
      if (axe !== undefined) axe.stack = 5;
    });
    expect(problems.join('\n')).toMatch(/hunger: le premier palier doit commencer à 0/);
    expect(problems.join('\n')).toMatch(/commun\/objets\/hache\.json: un outil ne s'empile pas/);
  });
});
