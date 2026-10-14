import type { Translate } from '../i18n'
import type { MarketOption } from '../components/MarketSwitch/MarketSwitch'
import type { NavItem } from '../components/Header/Header'
import type { FooterGroup } from '../components/Footer/Footer'
import type { QuietAction } from '../components/QuietActions/QuietActions'

/** Fixture data for shell stories, mirroring what apps/web builds from the Markets record. */
export const marketOptions = (current: 'en' | 'ar'): MarketOption[] => [
  {
    label: 'United Arab Emirates · English',
    href: '/ae/en/',
    hrefLang: 'en-AE',
    current: current === 'en',
  },
  {
    label: 'الإمارات العربية المتحدة · العربية',
    href: '/ae/ar/',
    hrefLang: 'ar-AE',
    current: current === 'ar',
  },
]

export const nav = (t: Translate, locale: 'en' | 'ar'): NavItem[] => [
  { label: t('shell.nav.products'), href: `/ae/${locale}/products/` },
  { label: t('shell.nav.brands'), href: `/ae/${locale}/brands/`, current: true },
  { label: t('shell.nav.rooms'), href: `/ae/${locale}/rooms/` },
  { label: t('shell.nav.support'), href: `/ae/${locale}/support/` },
]

export const quietActions = (t: Translate, locale: 'en' | 'ar'): QuietAction[] => [
  { label: t('ui.search'), icon: 'search', href: `/ae/${locale}/search/` },
  { label: t('ui.account'), icon: 'user', href: `/ae/${locale}/account/` },
  { label: t('ui.bag'), icon: 'bag', href: `/ae/${locale}/bag/`, count: 2, countLabel: '2' },
]

export const footerGroups = (t: Translate, locale: 'en' | 'ar'): FooterGroup[] => [
  {
    title: t('shell.nav.products'),
    links: [
      { label: t('shell.nav.brands'), href: `/ae/${locale}/brands/` },
      { label: t('shell.nav.rooms'), href: `/ae/${locale}/rooms/` },
    ],
  },
  {
    title: t('shell.nav.support'),
    links: [{ label: t('shell.nav.support'), href: `/ae/${locale}/support/` }],
  },
]
