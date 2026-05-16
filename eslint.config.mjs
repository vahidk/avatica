import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import eslintConfigPrettier from '@electron-toolkit/eslint-config-prettier'
import eslintConfigTs from '@electron-toolkit/eslint-config-ts/eslint.config'
import pluginReact from 'eslint-plugin-react'

export default tseslint.config(
  { ignores: ['**/node_modules', '**/dist', '**/out'] },
  js.configs.recommended,
  ...eslintConfigTs,
  {
    files: ['src/renderer/**/*.{ts,tsx}'],
    ...pluginReact.configs.flat.recommended,
    ...pluginReact.configs.flat['jsx-runtime']
  },
  eslintConfigPrettier
)
