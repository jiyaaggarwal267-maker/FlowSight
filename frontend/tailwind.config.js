/**
 * FLOWSIGHT design tokens (from Stitch export / DESIGN.md).
 *
 * NOTE: This project uses Tailwind CSS v4, where the theme is defined
 * CSS-first in `src/index.css` via `@theme` (which is what generates the
 * utility classes). This file is kept as the canonical design-token reference
 * and to satisfy the project structure. If you later downgrade to Tailwind v3,
 * migrate these values into the `theme.extend` key below.
 */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        surface: '#f7f9fb',
        'surface-dim': '#d8dadc',
        'surface-bright': '#f7f9fb',
        'surface-container-lowest': '#ffffff',
        'surface-container-low': '#f2f4f6',
        'surface-container': '#eceef0',
        'surface-container-high': '#e6e8ea',
        'surface-container-highest': '#e0e3e5',
        'on-surface': '#191c1e',
        'on-surface-variant': '#434655',
        outline: '#747686',
        'outline-variant': '#c4c5d7',
        'surface-tint': '#2151da',
        primary: '#0037b0',
        'on-primary': '#ffffff',
        'primary-container': '#1d4ed8',
        'on-primary-container': '#cad3ff',
        secondary: '#565e74',
        'on-secondary': '#ffffff',
        'secondary-container': '#dae2fd',
        'on-secondary-container': '#5c647a',
        tertiary: '#36455b',
        'on-tertiary': '#ffffff',
        'tertiary-container': '#4d5d73',
        'on-tertiary-container': '#c5d6f0',
        error: '#ba1a1a',
        'on-error': '#ffffff',
        'error-container': '#ffdad6',
        'on-error-container': '#93000a',
        background: '#f7f9fb',
        'on-background': '#191c1e',
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'monospace'],
      },
      spacing: {
        'space-2xs': '0.125rem',
        'space-xs': '0.25rem',
        'space-sm': '0.5rem',
        'space-md': '0.75rem',
        'space-base': '1rem',
        'space-lg': '1.5rem',
        'space-xl': '2rem',
        'space-2xl': '3rem',
        'panel-sidebar-w': '16rem',
        'panel-drawer-w': '28rem',
        'table-row-h': '2.5rem',
      },
    },
  },
}
