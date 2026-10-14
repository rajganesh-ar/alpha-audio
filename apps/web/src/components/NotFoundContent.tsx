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
    <div className="alpha-not-found" data-testid="not-found">
      {LOCALES.map(({ locale, dir }) => {
        const t = translator(getDictionary(locale))
        return (
          <section key={locale} className="alpha-not-found__section" lang={locale} dir={dir}>
            <h1 className="alpha-not-found__title">{t('notFound.title')}</h1>
            <p>{t('notFound.body')}</p>
          </section>
        )
      })}
      {options.length ? (
        <div className="alpha-not-found__section">
          <MarketSwitch label={en('marketSwitch.choose')} options={options} variant="list" />
        </div>
      ) : null}
    </div>
  )
}
