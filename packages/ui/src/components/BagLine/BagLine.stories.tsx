import type { Meta, StoryObj } from '@storybook/react-vite'
import { formatMoney, money } from '@alpha/core'
import { ar, en, RTL } from '../../stories/copy'
import { Button } from '../Button/Button'
import { Select } from '../Select/Select'
import { BagLine } from './BagLine'

const Photo = ({ label }: { label: string }) => (
  <div
    role="img"
    aria-label={label}
    className="absolute inset-0 bg-linear-to-b from-aluminium to-aluminium-deep"
  />
)
const quantities = Array.from({ length: 10 }, (_, i) => ({
  value: String(i + 1),
  label: String(i + 1),
}))
const unit = money(3_450_000, 'AED', 2)
const total = money(6_900_000, 'AED', 2)

const controls = (t: typeof en) => ({
  quantity: (
    <div className="flex items-end gap-2">
      <Select label={t('bag.quantity')} name="qty" options={quantities} defaultValue="2" />
      <Button variant="secondary" type="submit">
        {t('bag.update')}
      </Button>
    </div>
  ),
  remove: (
    <Button variant="quiet" type="submit" icon="close">
      {t('bag.remove')}
    </Button>
  ),
})

const meta = {
  title: 'Commerce/BagLine',
  component: BagLine,
  args: {
    brand: 'McIntosh',
    title: 'MA352 integrated amplifier',
    href: '#',
    media: <Photo label="MA352 front panel" />,
    unitPrice: en('bag.each', { amount: formatMoney(unit, 'en-AE') }),
    lineTotal: formatMoney(total, 'en-AE'),
    ...controls(en),
  },
  decorators: [(Story) => <div className="max-w-3xl">{Story()}</div>],
} satisfies Meta<typeof BagLine>
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Loading: Story = { args: { loading: true, loadingLabel: en('ui.loading') } }

/** No image, and the price moved since the product was added. */
export const Empty: Story = {
  args: {
    media: undefined,
    notice: en('bag.priceChanged', { was: formatMoney(money(3_300_000, 'AED', 2), 'en-AE') }),
  },
}

/** The product can no longer be bought here: no total, only remove. */
export const Error: Story = {
  args: {
    error: en('bag.notOnSale'),
    lineTotal: undefined,
    unitPrice: undefined,
    quantity: undefined,
  },
}

export const Rtl: Story = {
  name: 'RTL',
  parameters: RTL,
  args: {
    title: 'مضخم متكامل MA352',
    unitPrice: ar('bag.each', { amount: formatMoney(unit, 'ar-AE') }),
    lineTotal: formatMoney(total, 'ar-AE'),
    notice: ar('bag.priceChanged', { was: formatMoney(money(3_300_000, 'AED', 2), 'ar-AE') }),
    ...controls(ar),
  },
}
