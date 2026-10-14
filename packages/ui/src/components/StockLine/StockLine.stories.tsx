import type { Meta, StoryObj } from '@storybook/react-vite'
import { ar, en, RTL } from '../../stories/copy'
import { StockLine } from './StockLine'

const meta = {
  title: 'Commerce/StockLine',
  component: StockLine,
  args: { status: 'in-stock', label: en('stock.inStock'), detail: 'Delivered in Dubai tomorrow' },
} satisfies Meta<typeof StockLine>
export default meta
type Story = StoryObj<typeof meta>

/** Every status: icon colour plus words, never colour alone. */
export const Default: Story = {
  render: () => (
    <div className="flex flex-col gap-3">
      <StockLine
        status="in-stock"
        label={en('stock.inStock')}
        detail="Delivered in Dubai tomorrow"
      />
      <StockLine status="low" label={en('stock.low')} detail="Showroom pickup today" />
      <StockLine status="on-order" label={en('stock.onOrder')} detail="Ships in 3 to 4 weeks" />
      <StockLine status="out" label={en('stock.out')} />
    </div>
  ),
}

export const Loading: Story = { args: { loading: true, loadingLabel: en('ui.loading') } }

/** No stock record for this market yet. */
export const Empty: Story = {
  args: { status: 'unknown', label: en('stock.unknown'), detail: undefined },
}

export const Error: Story = { args: { error: en('stock.unavailable') } }

export const Rtl: Story = {
  name: 'RTL',
  parameters: RTL,
  render: () => (
    <div className="flex flex-col gap-3">
      <StockLine status="in-stock" label={ar('stock.inStock')} detail="التوصيل في دبي غدًا" />
      <StockLine status="out" label={ar('stock.out')} />
    </div>
  ),
}
