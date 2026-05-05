const js = require('@eslint/js')

module.exports = [
  {
    ignores: ['dist/', 'node_modules/']
  },
  js.configs.recommended,
  {
    files: ['src/**/*.js'],
    languageOptions: {
      ecmaVersion: 2020,
      sourceType: 'module',
      globals: {
        Atomics: 'readonly',
        SharedArrayBuffer: 'readonly',
        fetch: 'readonly',
        process: 'readonly'
      }
    },
    rules: {}
  }
]
