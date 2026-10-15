import type { Meta, StoryObj } from '@storybook/react-vite'
import { ar, en, RTL } from '../../stories/copy'
import { Button } from '../Button/Button'
import { CompanyHeader } from './CompanyHeader'

const nav = (t: typeof en) => [
  { label: t('partners.nav.catalogue'), href: '/catalogue/', current: true },
]

const meta = {
  title: 'Dealer/CompanyHeader',
  component: CompanyHeader,
  args: {
    brand: en('partners.brand'),
    homeHref: '/catalogue/',
    navLabel: en('shell.primaryNav'),
    nav: nav(en),
    company: 'Harmony Systems LLC',
    tier: en('partners.tier.gold'),
    credit: en('partners.credit', { amount: 'AED 50,000.00' }),
    signOut: (
      <Button variant="secondary" type="submit">
        {en('partners.signOut')}
      </Button>
    ),
  },
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof CompanyHeader>
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Loading: Story = { args: { loading: true, loadingLabel: en('ui.loading') } }

/** Signed out (the sign-in page): brand only. */
export const Empty: Story = {
  args: { nav: [], company: undefined, tier: undefined, credit: undefined, signOut: undefined },
}

/** An account on hold. */
export const Error: Story = { args: { notice: en('partners.hold') } }

/** A viewer: no credit line (access hides it). */
export const Viewer: Story = { args: { credit: undefined, tier: en('partners.tier.silver') } }

export const Rtl: Story = {
  name: 'RTL',
  parameters: RTL,
  args: {
    brand: ar('partners.brand'),
    navLabel: ar('shell.primaryNav'),
    nav: nav(ar),
    company: 'شركة هارموني للأنظمة',
    tier: ar('partners.tier.gold'),
    credit: ar('partners.credit', { amount: 'AED 50,000.00' }),
    notice: ar('partners.hold'),
    signOut: (
      <Button variant="secondary" type="submit">
        {ar('partners.signOut')}
      </Button>
    ),
  },
}
