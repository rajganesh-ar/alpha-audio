import { Button, EmptyState } from '@alpha/ui'
import { copy, pageLocale } from '@/lib/locale'

export default async function NotFound() {
  const t = copy(await pageLocale())
  return (
    <main className="mx-auto max-w-measure px-4 py-16">
      <EmptyState
        title={t('notFound.title')}
        body={t('partners.notFound')}
        action={<Button href="/catalogue">{t('partners.nav.catalogue')}</Button>}
      />
    </main>
  )
}
