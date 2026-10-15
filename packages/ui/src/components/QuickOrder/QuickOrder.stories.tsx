import type { Meta, StoryObj } from '@storybook/react-vite'
import { ar, en, RTL } from '../../stories/copy'
import { QuickOrder } from './QuickOrder'

const labels = (t: typeof en) => ({
  legend: t('partners.order.legend'),
  hint: t('partners.order.hint'),
  lineLabel: t('partners.order.line'),
  skuLabel: t('partners.order.sku'),
  qtyLabel: t('partners.order.qty'),
  submitLabel: t('partners.order.review'),
})

const meta = {
  title: 'Dealer/QuickOrder',
  component: QuickOrder,
  args: {
    action: '/orders/new',
    ...labels(en),
    rows: [
      { sku: 'MCINTOSH-MA352', qty: '2' },
      { sku: 'BLUESOUND-NODE', qty: '6' },
    ],
    blankRows: 1,
  },
  decorators: [(Story) => <div className="max-w-xl">{Story()}</div>],
} satisfies Meta<typeof QuickOrder>
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Loading: Story = { args: { loading: true, loadingLabel: en('ui.loading') } }

/** A fresh order: blank lines only. */
export const Empty: Story = { args: { rows: [], blankRows: 3 } }

/** A line the review refused, and an order-level message. */
export const Error: Story = {
  args: {
    error: en('partners.order.fix'),
    rows: [
      {
        sku: 'MCINTOSH-MA352',
        qty: '3',
        error: en('partners.order.problems.multiple', { multiple: 2 }),
      },
      { sku: 'NOPE-123', qty: '1', error: en('partners.order.problems.unavailable') },
    ],
  },
}

export const Rtl: Story = {
  name: 'RTL',
  parameters: RTL,
  args: { ...labels(ar) },
}
