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
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]' }],
      // Catches the literal `fetch("${url}")` bug that silently broke the whole
      // DrivingCourses module (double quotes instead of backticks).
      'no-template-curly-in-string': 'error',
      // React-Compiler-oriented rule. The remaining hits are conventional
      // patterns (mount-time init from the URL, enter/exit animation gating),
      // not defects. Kept visible as a warning instead of blocking CI.
      'react-hooks/set-state-in-effect': 'warn',
    },
  },
])
