/** Shared utility strings, so every interactive element looks and behaves the same. */

/** Visible focus on every interactive element (WCAG 2.2 AA). */
export const FOCUS_RING =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus'

/** 44 × 44 px minimum target. */
export const TARGET = 'min-h-11 min-w-11'

/** Interface motion: 200 ms ease-out, zero under prefers-reduced-motion (tokens.css). */
export const MOTION = 'transition-colors duration-(--alpha-duration-ui) ease-ui'
