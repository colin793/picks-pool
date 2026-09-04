/** @type {import('tailwindcss').Config} */
export default {
  content: ['./app/**/*.{js,jsx}', './lib/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Tokens are RGB triples in globals.css so opacity modifiers work (bg-accent/10).
        bg: 'rgb(var(--bg-rgb) / <alpha-value>)',
        surface: 'rgb(var(--surface-rgb) / <alpha-value>)',
        surface2: 'rgb(var(--surface-2-rgb) / <alpha-value>)',
        ink: 'rgb(var(--ink-rgb) / <alpha-value>)',
        ink2: 'rgb(var(--ink-2-rgb) / <alpha-value>)',
        muted: 'rgb(var(--muted-rgb) / <alpha-value>)',
        line: 'rgb(var(--line-rgb) / <alpha-value>)',
        accent: 'rgb(var(--c1-rgb) / <alpha-value>)',
        brand: 'rgb(var(--c2-rgb) / <alpha-value>)',
        good: 'rgb(var(--good-rgb) / <alpha-value>)',
        goodsoft: 'rgb(var(--good-soft-rgb) / <alpha-value>)',
        bad: 'rgb(var(--bad-rgb) / <alpha-value>)',
        badsoft: 'rgb(var(--bad-soft-rgb) / <alpha-value>)',
        warn: 'rgb(var(--warn-rgb) / <alpha-value>)',
        warnsoft: 'rgb(var(--warn-soft-rgb) / <alpha-value>)',
      },
      fontFamily: {
        sans: ['var(--font-body)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'var(--font-body)', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(15, 20, 26, .05), 0 10px 24px -18px rgba(15, 20, 26, .35)',
      },
    },
  },
  plugins: [],
};
