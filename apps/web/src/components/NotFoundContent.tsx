import { MarketSwitch, getDictionary, translator, type DictionaryLocale } from '@alpha/ui'
import type { MarketRecord } from '@alpha/payload'
import { marketOptions } from '@/lib/shell'

const LOCALES: Array<{ locale: DictionaryLocale; dir: 'ltr' | 'rtl' }> = [
  { locale: 'en', dir: 'ltr' },
  { locale: 'ar', dir: 'rtl' },
]

/**
 * 404 body used where the visitor's language is unknown (an unknown market or locale), so it
 * speaks both languages and offers every live market × locale.
 */
export function NotFoundContent({ markets }: { markets: readonly MarketRecord[] }) {
  const options = marketOptions(markets)
  const en = translator(getDictionary('en'))
  return (
    <div className="mx-auto flex max-w-measure flex-col gap-8 px-4 py-12" data-testid="not-found">
      {LOCALES.map(({ locale, dir }) => {
        const t = translator(getDictionary(locale))
        return (
          <section key={locale} lang={locale} dir={dir} className="flex flex-col gap-3">
            <h1 className="font-display text-3xl font-bold text-ink font-stretch-expanded">
              {t('notFound.title')}
            </h1>
            <p className="text-lg text-ink-muted">{t('notFound.body')}</p>
          </section>
        )
      })}
      {options.length ? (
        <MarketSwitch label={en('marketSwitch.choose')} options={options} variant="list" />
      ) : null}
    </div>
  )
}
