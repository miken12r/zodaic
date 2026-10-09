// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config')
const expoConfig = require('eslint-config-expo/flat')

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', '.expo/*'],
  },
  {
    // Web-only concern: React Native <Text> renders quotes/apostrophes as-is.
    rules: { 'react/no-unescaped-entities': 'off' },
  },
])
