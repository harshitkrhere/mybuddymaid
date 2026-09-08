import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
  },
  {
    // The Vite config runs in Node, not the browser.
    files: ['vite.config.js'],
    languageOptions: { globals: globals.node },
  },
  {
    // Deliberate patterns that only cost Fast Refresh a full reload: the context hook next
    // to its provider, and the icon and colour maps next to the icon components. Not worth
    // splitting files for; the rule stays on everywhere else.
    files: ['src/context/AuthContext.jsx', 'src/components/ServiceIcons.jsx'],
    rules: { 'react-refresh/only-export-components': 'off' },
  },
  {
    // ProfilePage syncs its form fields from the profile once it loads, the pattern the audit
    // endorsed for FIN-B05. The React-Compiler-era rule wants that restructured, which is
    // Phase 3 work (FIN-TD03); it must not block the lint gate meanwhile.
    files: ['src/pages/ProfilePage.jsx'],
    rules: { 'react-hooks/set-state-in-effect': 'off' },
  },
])
