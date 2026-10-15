import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { AppShell, Header } from '@alpha/ui'
import { DocumentHead } from '@/components/DocumentHead'
import { OPS_LOCALE, opsCopy } from '@/lib/ops'
import '../(frontend)/globals.css'

export const metadata: Metadata = {
  title: { default: 'Ops · Alpha Audio', template: '%s · Ops · Alpha Audio' },
  robots: { index: false, follow: false },
}

/** Root layout for the staff ops screens: never indexed, never cached (pages read the session). */
export default function OpsLayout({ children }: { children: ReactNode }) {
  const t = opsCopy()
  return (
    <html lang={OPS_LOCALE} dir="ltr">
      <head>
        <DocumentHead locale={OPS_LOCALE} />
      </head>
      <body>
        <AppShell
          skipToContentLabel={t('shell.skipToContent')}
          header={
            <Header
              homeHref="/ops/orders/"
              brand={t('ops.brand')}
              homeLabel={t('ops.brand')}
              navLabel={t('shell.primaryNav')}
              nav={[
                { label: t('ops.title'), href: '/ops/orders/' },
                { label: t('ops.trade.nav'), href: '/ops/trade-orders/' },
                { label: t('ops.projects.nav'), href: '/ops/projects/' },
                { label: t('ops.admin'), href: '/admin' },
              ]}
            />
          }
          footer={null}
        >
          {children}
        </AppShell>
      </body>
    </html>
  )
}
