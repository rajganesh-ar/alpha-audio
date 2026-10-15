import type { Meta, StoryObj } from '@storybook/react-vite'
import { ar, en, RTL } from '../../stories/copy'
import { PriceTraceDrawer, type TraceRow } from './PriceTraceDrawer'

const rows = (t: typeof en, amount: string): TraceRow[] => [
  { label: t('partners.trace.rules.contract'), state: 'checked' },
  { label: t('partners.trace.rules.price-list'), state: 'checked' },
  {
    label: t('partners.trace.rules.dealer-list', { channel: t('partners.channel.dealer') }),
    value: amount,
    state: 'applied',
  },
  { label: t('partners.trace.rules.group-discount'), value: '−5%', state: 'applied' },
  { label: t('partners.trace.rules.volume-break'), state: 'checked' },
  { label: t('partners.trace.rules.promotion'), state: 'checked' },
]
const stateLabels = (t: typeof en) => ({
  applied: t('partners.trace.applied'),
  checked: t('partners.trace.checked'),
  skipped: t('partners.trace.skipped'),
})

const meta = {
  title: 'Dealer/PriceTraceDrawer',
  component: PriceTraceDrawer,
  args: {
    label: en('partners.trace.label'),
    rows: rows(en, 'AED 6,250.00'),
    stateLabels: stateLabels(en),
    emptyLabel: en('partners.trace.empty'),
    // Open, as a dealer sees it after pressing it.
    open: true,
  },
  decorators: [(Story) => <div className="max-w-sm">{Story()}</div>],
} satisfies Meta<typeof PriceTraceDrawer>
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Loading: Story = { args: { loading: true, loadingLabel: en('ui.loading') } }

export const Empty: Story = { args: { rows: [] } }

/** The trace could not load. */
export const Error: Story = { args: { error: en('ui.errorBody') } }

/** A contract price: the later base rules were not looked at. */
export const Contract: Story = {
  args: {
    rows: [
      { label: en('partners.trace.rules.contract'), value: 'AED 5,900.00', state: 'applied' },
      { label: en('partners.trace.rules.price-list'), state: 'skipped' },
      {
        label: en('partners.trace.rules.dealer-list', { channel: en('partners.channel.dealer') }),
        state: 'skipped',
      },
      { label: en('partners.trace.rules.promotion'), state: 'checked' },
    ],
  },
}

export const Rtl: Story = {
  name: 'RTL',
  parameters: RTL,
  args: {
    label: ar('partners.trace.label'),
    rows: rows(ar, 'AED 6,250.00'),
    stateLabels: stateLabels(ar),
  },
}
