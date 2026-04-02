import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'hsl(var(--bg))',
        panel: 'hsl(var(--panel))',
        panelMuted: 'hsl(var(--panel-muted))',
        border: 'hsl(var(--border))',
        foreground: 'hsl(var(--foreground))',
        muted: 'hsl(var(--muted))',
        accent: 'hsl(var(--accent))',
        danger: 'hsl(var(--danger))',
        success: 'hsl(var(--success))',
        warning: 'hsl(var(--warning))',
      },
      fontFamily: {
        sans: ['"Avenir Next"', '"Segoe UI"', '"Helvetica Neue"', 'system-ui', 'sans-serif'],
        display: ['"Avenir Next Condensed"', '"Avenir Next"', '"Segoe UI"', 'sans-serif'],
      },
      boxShadow: {
        panel: '0 16px 48px rgba(0, 0, 0, 0.34)',
        card: '0 8px 24px rgba(0, 0, 0, 0.22)',
      },
      borderRadius: {
        xl: '1rem',
        '2xl': '1.25rem',
      },
      keyframes: {
        'transcribe-indeterminate': {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(350%)' },
        },
      },
      animation: {
        'transcribe-indeterminate': 'transcribe-indeterminate 1.4s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}

export default config
