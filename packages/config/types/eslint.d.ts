import type { Linter } from 'eslint';

/** Motifs des fichiers de test reconnus par la configuration partagée. */
export declare const testFiles: string[];

export interface DuoEslintOptions {
  /** Dossier du paquet: `import.meta.dirname` dans son `eslint.config.js`. */
  tsconfigRootDir: string;
  /** Variables globales des fichiers JavaScript; `node` par défaut. */
  environment?: 'node' | 'browser' | 'both';
  /** Motifs à ignorer en plus des dossiers de construction et de `assets-src`. */
  ignores?: string[];
}

export declare function createEslintConfig(options: DuoEslintOptions): Linter.Config[];
