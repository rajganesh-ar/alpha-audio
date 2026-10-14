/**
 * Tailwind 4 preset. Tokens are defined once in @alpha/ui/tokens.css (CSS custom properties)
 * and surfaced here so utilities like `bg-lacquer` and `text-vu-amber` exist. No hex values
 * live in this file; the lint rule alpha/no-raw-color forbids them in components.
 */
export default {
  theme: {
    extend: {
      colors: {
        lacquer: 'var(--color-lacquer)',
        aluminium: 'var(--color-aluminium)',
        'aluminium-deep': 'var(--color-aluminium-deep)',
        graphite: 'var(--color-graphite)',
        bronze: 'var(--color-bronze)',
        'vu-amber': 'var(--color-vu-amber)',
        'signal-green': 'var(--color-signal-green)',
        alert: 'var(--color-alert)',
      },
      fontFamily: {
        sans: 'var(--font-sans)',
        arabic: 'var(--font-arabic)',
        'arabic-display': 'var(--font-arabic-display)',
        mono: 'var(--font-mono)',
      },
      borderRadius: { control: 'var(--radius-control)', card: 'var(--radius-card)' },
    },
  },
}
