import type { Meta, StoryObj } from '@storybook/react-vite'
import { ar, en, RTL } from '../../stories/copy'
import { SpecTable } from './SpecTable'

const meta = {
  title: 'Commerce/SpecTable',
  component: SpecTable,
  args: {
    caption: en('product.specs'),
    rows: [
      { label: en('product.spec.power'), value: en('product.spec.powerValue', { value: 200 }) },
      { label: en('product.spec.channels'), value: '2' },
      {
        label: en('product.spec.impedance'),
        value: en('product.spec.ohmValue', { value: '2, 4, 8' }),
      },
      { label: en('product.spec.weight'), value: en('product.spec.weightValue', { value: 29.5 }) },
      { label: en('product.spec.sku'), value: 'MCINTOSH-MA352' },
    ],
  },
  decorators: [(Story) => <div className="max-w-xl">{Story()}</div>],
} satisfies Meta<typeof SpecTable>
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Loading: Story = { args: { loading: true, loadingLabel: en('ui.loading') } }

export const Empty: Story = { args: { rows: [], emptyLabel: en('product.specsEmpty') } }

export const Error: Story = { args: { error: en('ui.errorBody') } }

export const Rtl: Story = {
  name: 'RTL',
  parameters: RTL,
  args: {
    caption: ar('product.specs'),
    rows: [
      { label: ar('product.spec.power'), value: ar('product.spec.powerValue', { value: 200 }) },
      { label: ar('product.spec.channels'), value: '2' },
      { label: ar('product.spec.weight'), value: ar('product.spec.weightValue', { value: 29.5 }) },
      { label: ar('product.spec.sku'), value: 'MCINTOSH-MA352' },
    ],
  },
}
