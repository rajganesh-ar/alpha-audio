import type { Meta, StoryObj } from '@storybook/react-vite'
import { ar, en, RTL } from '../../stories/copy'
import { SuggestedMarketBanner, type SuggestedMarketTarget } from './SuggestedMarketBanner'

const sa = (t: typeof en, locale: 'en' | 'ar'): SuggestedMarketTarget => ({
  code: 'sa',
  href: `/sa/${locale}/`,
  hrefLang: `${locale}-SA`,
  message: t('suggestedMarket.message', {
    market: locale === 'en' ? 'Saudi Arabia' : 'المملكة العربية السعودية',
  }),
  switchLabel: t('suggestedMarket.switch', {
    market: locale === 'en' ? 'Saudi Arabia' : 'المملكة العربية السعودية',
  }),
})

const fromSaudi = () => 'suggestedMarket=sa'

const meta = {
  title: 'Shell/SuggestedMarketBanner',
  component: SuggestedMarketBanner,
  args: {
    currentMarket: 'ae',
    targets: [sa(en, 'en')],
    dismissLabel: en('suggestedMarket.dismiss'),
    readCookies: fromSaudi,
  },
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof SuggestedMarketBanner>
export default meta
type Story = StoryObj<typeof meta>

/** A visitor in Saudi Arabia on the UAE site. Offers the switch; never redirects. */
export const Default: Story = {}
/** Before the cookie is read the banner renders nothing (the page around it is cached). */
export const Loading: Story = { args: { readCookies: () => '' } }
/** The suggested market is not live: nothing to offer. */
export const Empty: Story = { args: { targets: [] } }
/** Dismissed earlier, or an unreadable cookie: nothing is shown. */
export const Error: Story = {
  args: { readCookies: () => 'suggestedMarket=sa; suggestedMarketDismissed=sa' },
}
export const Rtl: Story = {
  name: 'RTL',
  parameters: RTL,
  args: { targets: [sa(ar, 'ar')], dismissLabel: ar('suggestedMarket.dismiss') },
}
