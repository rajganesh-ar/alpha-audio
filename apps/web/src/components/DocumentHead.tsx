import { preloadFonts } from '@alpha/ui/fonts'

/**
 * Preloads the faces this locale paints first. The @font-face rules themselves ship in the
 * storefront stylesheet (@alpha/ui/styles.css), pointing at the files under /fonts.
 */
export function DocumentHead({ locale }: { locale: string }) {
  preloadFonts(locale)
  return null
}
