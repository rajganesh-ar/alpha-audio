import type { Meta, StoryObj } from '@storybook/react-vite'
import { ar, en, RTL } from '../../stories/copy'
import { footerGroups, marketOptions } from '../../stories/shell'
import { MarketSwitch } from '../MarketSwitch/MarketSwitch'
import { Footer } from './Footer'

const meta = {
  title: 'Shell/Footer',
  component: Footer,
  args: {
    copyright: en('footer.copyright', { year: 2026 }),
    pricing: en('footer.pricing', { currency: 'AED', vat: 5 }),
    groups: footerGroups(en, 'en'),
    marketSwitch: (
      <MarketSwitch label={en('marketSwitch.label')} options={marketOptions('en')} variant="list" />
    ),
  },
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof Footer>
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Loading: Story = { args: { loading: true } }
/** Legal line only. */
export const Empty: Story = { args: { groups: [], marketSwitch: undefined, pricing: undefined } }
/** The link groups failed to load; the market line and legal line remain. */
export const Error: Story = {
  args: {
    groups: [],
    marketSwitch: (
      <MarketSwitch
        label={en('marketSwitch.label')}
        options={[]}
        error={en('ui.marketsUnavailable')}
      />
    ),
  },
}
export const Rtl: Story = {
  name: 'RTL',
  parameters: RTL,
  args: {
    copyright: ar('footer.copyright', { year: 2026 }),
    pricing: ar('footer.pricing', { currency: 'AED', vat: 5 }),
    groups: footerGroups(ar, 'ar'),
    marketSwitch: (
      <MarketSwitch label={ar('marketSwitch.label')} options={marketOptions('ar')} variant="list" />
    ),
  },
}
