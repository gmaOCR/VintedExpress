// ESLint config pour TS + import/order + Prettier
module.exports = {
  root: true,
  env: { browser: true, es2022: true, webextensions: true, node: true },
  parser: '@typescript-eslint/parser',
  parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
  plugins: ['@typescript-eslint', 'simple-import-sort'],
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended', 'prettier'],
  ignorePatterns: ['dist/**'],
  rules: {
    'no-console': ['warn', { allow: ['warn', 'error'] }],
    'simple-import-sort/imports': 'error',
    'simple-import-sort/exports': 'error',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
  },
  overrides: [
    {
      files: ['vite.config.ts'],
      rules: {
        // Pas de règle spécifique
      },
    },
  ],
};
