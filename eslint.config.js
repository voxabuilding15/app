const { defineConfig, globalIgnores } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

/**
 * Clean Architecture dependency rule, enforced as lint errors.
 * Inner layers must never import from outer layers.
 */
const layer = (files, forbidden, message) => ({
  files,
  rules: {
    'no-restricted-imports': [
      'error',
      { patterns: forbidden.map((group) => ({ group: [`@/${group}`, `@/${group}/*`], message })) },
    ],
  },
});

module.exports = defineConfig([
  globalIgnores(['dist/*', '.expo/*', 'node_modules/*', 'android/*']),
  expoConfig,
  { rules: { 'no-console': 'error' } },
  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: { '@typescript-eslint/no-explicit-any': 'error' },
  },
  {
    // jest.mock factories are hoisted above imports, so they must use require().
    files: ['tests/**'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
      'react/display-name': 'off',
    },
  },
  layer(
    ['src/core/**'],
    ['features', 'components', 'navigation', 'providers', 'services', 'database', 'theme', 'hooks'],
    'core is the innermost layer and may not depend on other layers.',
  ),
  layer(
    ['src/database/**', 'src/services/**'],
    ['features', 'components', 'navigation', 'providers', 'hooks'],
    'Infrastructure may not depend on UI layers.',
  ),
  layer(
    ['src/theme/**', 'src/components/**', 'src/hooks/**'],
    ['features', 'navigation', 'providers'],
    'Shared UI building blocks may not depend on features, navigation or providers.',
  ),
  layer(
    ['src/features/**'],
    ['providers', 'services', 'navigation'],
    'Features depend on core ports, not on adapters, providers or navigation.',
  ),
]);
