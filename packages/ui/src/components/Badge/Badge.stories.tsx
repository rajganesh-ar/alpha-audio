import type { Meta, StoryObj } from '@storybook/react-vite'
import { ar, en, RTL } from '../../stories/copy'
import { Skeleton } from '../Skeleton/Skeleton'
import { Badge } from './Badge'

const meta = {
  title: 'Feedback/Badge',
  component: Badge,
  args: { label: en('stock.inStock'), tone: 'positive' },
} satisfies Meta<typeof Badge>
export default meta
type Story = StoryObj<typeof meta>

/** Every tone: colour, icon and text together. */
export const Default: Story = {
  render: () => (
    <div className="flex flex-wrap gap-3">
      <Badge label="Demo unit" />
      <Badge tone="positive" label={en('stock.inStock')} />
      <Badge tone="caution" label={en('stock.low')} />
      <Badge tone="critical" label={en('stock.out')} />
      <Badge tone="live" label="Live" />
    </div>
  ),
}

/** While the status loads, a badge-sized placeholder holds the space. */
export const Loading: Story = {
  render: () => (
    <span aria-busy="true" className="inline-flex">
      <Skeleton shape="block" className="h-7 w-24" />
      <span className="sr-only">{en('ui.loading')}</span>
    </span>
  ),
}

/** No label: nothing is rendered. */
export const Empty: Story = { args: { label: '' } }

/** Critical: hard-rule failures and out of stock. */
export const Error: Story = { args: { tone: 'critical', label: en('stock.out') } }

export const Rtl: Story = {
  name: 'RTL',
  parameters: RTL,
  render: () => (
    <div className="flex flex-wrap gap-3">
      <Badge tone="positive" label={ar('stock.inStock')} />
      <Badge tone="caution" label={ar('stock.low')} />
      <Badge tone="critical" label={ar('stock.out')} />
    </div>
  ),
}
