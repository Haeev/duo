// @ts-check
// Configuration Prettier partagée (ADR 0002, point 5).

/** @type {import('prettier').Config} */
const config = {
  printWidth: 100,
  singleQuote: true,
  trailingComma: 'all',
  endOfLine: 'lf',
};

export default config;
