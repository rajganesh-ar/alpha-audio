import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { preloadFonts } from '@alpha/ui/fonts'
import { copy, pageLocale } from '@/lib/locale'
import './globals.css'

export async function generateMetadata(): Promise<Metadata> {
  const t = copy(await pageLocale())
  return {
    title: { default: t('partners.brand'), template: `%s · ${t('partners.brand')}` },
    robots: { index: false, follow: false },
  }
}

/**
 * Root layout of the dealer board. Every page reads the session (dynamic, `private, no-store`
 * from next.config.mjs). Language and direction follow the user's setting, or the browser's
 * preference before sign-in.
 */
export default async function RootLayout({ children }: { children: ReactNode }) {
  const locale = await pageLocale()
  preloadFonts(locale)
  return (
    <html lang={locale} dir={locale === 'ar' ? 'rtl' : 'ltr'}>
      <body>{children}</body>
    </html>
  )
}
