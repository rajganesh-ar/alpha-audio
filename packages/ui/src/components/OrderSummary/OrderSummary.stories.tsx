import type { Meta, StoryObj } from '@storybook/react-vite'
import { formatMoney, money } from '@alpha/core'
import { ar, en, RTL } from '../../stories/copy'
import { Button } from '../Button/Button'
import { OrderSummary } from './OrderSummary'

const rows = (t: typeof en, locale: string) => [
  { label: t('bag.subtotal'), value: formatMoney(money(7_150_000, 'AED', 2), locale) },
  { label: t('bag.delivery'), value: t('bag.deliveryFree') },
  { label: t('bag.total'), value: formatMoney(money(7_150_000, 'AED', 2), locale), emphasis: true },
  {
    label: t('bag.vatIncluded'),
    value: formatMoney(money(340_476, 'AED', 2), locale),
    muted: true,
  },
]

const meta = {
  title: 'Commerce/OrderSummary',
  component: OrderSummary,
  args: {
    title: en('bag.summary'),
    rows: rows(en, 'en-AE'),
    note: en('bag.deliveryNote'),
    action: (
      <Button href="#" fullWidth>
        {en('bag.checkout')}
      </Button>
    ),
    emptyLabel: en('bag.emptyTitle'),
  },
  decorators: [(Story) => <div className="max-w-sm">{Story()}</div>],
} satisfies Meta<typeof OrderSummary>
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Loading: Story = { args: { loading: true, loadingLabel: en('ui.loading') } }

export const Empty: Story = { args: { rows: [], note: undefined } }

export const Error: Story = { args: { error: en('ui.errorBody') } }

export const Rtl: Story = {
  name: 'RTL',
  parameters: RTL,
  args: {
    title: ar('bag.summary'),
    rows: rows(ar, 'ar-AE'),
    note: ar('bag.deliveryNote'),
    action: (
      <Button href="#" fullWidth>
        {ar('bag.checkout')}
      </Button>
    ),
  },
}
