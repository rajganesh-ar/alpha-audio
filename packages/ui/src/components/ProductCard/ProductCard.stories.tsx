import type { Meta, StoryObj } from '@storybook/react-vite'
import { money } from '@alpha/core'
import { ar, en, RTL } from '../../stories/copy'
import { PriceBlock } from '../PriceBlock/PriceBlock'
import { StockLine } from '../StockLine/StockLine'
import { ProductCard } from './ProductCard'

const Photo = ({ label }: { label: string }) => (
  <div
    role="img"
    aria-label={label}
    className="absolute inset-0 bg-linear-to-b from-aluminium to-aluminium-deep"
  />
)

const meta = {
  title: 'Commerce/ProductCard',
  component: ProductCard,
  args: {
    brand: 'McIntosh',
    title: 'MA352 integrated amplifier',
    href: '#',
    media: <Photo label="MA352 front panel" />,
    price: (
      <PriceBlock
        locale="en-AE"
        price={money(3_450_000, 'AED', 2)}
        vatLabel={en('price.inclVat', { rate: 5 })}
      />
    ),
    stock: <StockLine status="in-stock" label={en('stock.inStock')} />,
  },
  decorators: [(Story) => <div className="max-w-80">{Story()}</div>],
} satisfies Meta<typeof ProductCard>
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Loading: Story = { args: { loading: true, loadingLabel: en('ui.loading') } }

/** No image yet and price on request. */
export const Empty: Story = {
  args: {
    media: undefined,
    price: <PriceBlock locale="en-AE" price={null} requestLabel={en('price.onRequest')} />,
    stock: (
      <StockLine
        status="on-order"
        label={en('stock.onOrder')}
        detail={en('stock.eta', { date: '2 Nov 2026' })}
      />
    ),
  },
}

export const Error: Story = { args: { error: en('price.unavailable') } }

export const Rtl: Story = {
  name: 'RTL',
  parameters: RTL,
  args: {
    brand: 'ماكنتوش',
    title: 'مضخم الصوت المتكامل MA352',
    media: <Photo label="الواجهة الأمامية لـ MA352" />,
    price: (
      <PriceBlock
        locale="ar-AE"
        price={money(3_450_000, 'AED', 2)}
        vatLabel={ar('price.inclVat', { rate: 5 })}
      />
    ),
    stock: <StockLine status="low" label={ar('stock.low')} />,
  },
}
