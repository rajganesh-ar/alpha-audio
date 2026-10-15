import type { Meta, StoryObj } from '@storybook/react-vite'
import { ar, en, RTL } from '../../stories/copy'
import { CreditMeter } from './CreditMeter'

const args = (t: typeof en, used: string, limit: string, available: string) => ({
  label: t('partners.creditMeter.label'),
  summary: t('partners.creditMeter.summary', { used, limit }),
  available: t('partners.creditMeter.available', { amount: available }),
  emptyLabel: t('partners.creditMeter.none'),
})

const meta = {
  title: 'Dealer/CreditMeter',
  component: CreditMeter,
  args: { ratio: 0.58, ...args(en, 'AED 28,980.00', 'AED 50,000.00', 'AED 21,020.00') },
  decorators: [(Story) => <div className="max-w-sm">{Story()}</div>],
} satisfies Meta<typeof CreditMeter>
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Loading: Story = { args: { loading: true, loadingLabel: en('ui.loading') } }

/** No credit line. */
export const Empty: Story = { args: { ratio: null } }

/** The credit could not load. */
export const Error: Story = { args: { error: en('ui.errorBody') } }

/** Over the limit: the next order waits for Alpha. */
export const Over: Story = {
  args: { ratio: 1.01, ...args(en, 'AED 50,715.00', 'AED 50,000.00', 'AED 0.00') },
}

export const Rtl: Story = {
  name: 'RTL',
  parameters: RTL,
  args: { ratio: 0.58, ...args(ar, 'AED 28,980.00', 'AED 50,000.00', 'AED 21,020.00') },
}
