import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      // La regla de react-refresh solo afecta al hot-reload en desarrollo: no
      // cambia nada de lo que se entrega. Permitimos exportar constantes (el
      // router, las tablas de navegación) porque son datos, no componentes, y
      // partirlos en archivos aparte solo movería código sin efecto.
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },
  {
    // El playground de navbars y el componente de navegación de shadcn vienen
    // del registry: son catálogo y vendor, no código de producto. Partir sus
    // exports en archivos propios sería reescribir upstream a cambio de nada,
    // y el fast-refresh de desarrollo no es lo que se entrega.
    files: [
      'src/features/nav-test/**/*.tsx',
      'src/components/shadcn-space/**/*.tsx',
      'src/components/ui/navigation-menu.tsx',
    ],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },
])
