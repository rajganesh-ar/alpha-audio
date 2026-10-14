import type { Meta, StoryObj } from '@storybook/react-vite'
import { ar, en, RTL } from '../../stories/copy'
import { marketOptions, nav, quietActions } from '../../stories/shell'
import { MarketSwitch } from '../MarketSwitch/MarketSwitch'
import { QuietActions } from '../QuietActions/QuietActions'
import { Header } from './Header'

const actions = (locale: 'en' | 'ar', marketsError = false) => {
  const t = locale === 'en' ? en : ar
  return (
    <>
      <QuietActions label={t('ui.quietActions')} actions={quietActions(t, locale)} />
      <MarketSwitch
        label={t('marketSwitch.label')}
        currentLabel={marketOptions(locale).find((o) => o.current)?.label ?? ''}
        options={marketOptions(locale)}
        {...(marketsError ? { error: t('ui.marketsUnavailable') } : {})}
      />
    </>
  )
}

const meta = {
  title: 'Shell/Header',
  component: Header,
  args: {
    homeHref: '/ae/en/',
    brand: en('shell.brand'),
    homeLabel: en('shell.homeLink'),
    navLabel: en('shell.primaryNav'),
    nav: nav(en, 'en'),
    actions: actions('en'),
  },
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof Header>
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Loading: Story = { args: { loading: true } }
/** No navigation yet: wordmark and actions only. */
export const Empty: Story = { args: { nav: [] } }
/** The market list failed to load. */
export const Error: Story = { args: { actions: actions('en', true) } }
/** Mirrored: wordmark on the right, actions on the left. */
export const Rtl: Story = {
  name: 'RTL',
  parameters: RTL,
  args: {
    homeHref: '/ae/ar/',
    brand: ar('shell.brand'),
    homeLabel: ar('shell.homeLink'),
    navLabel: ar('shell.primaryNav'),
    nav: nav(ar, 'ar'),
    actions: actions('ar'),
  },
}
