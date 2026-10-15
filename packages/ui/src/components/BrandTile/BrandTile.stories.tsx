import type { Meta, StoryObj } from '@storybook/react-vite'
import { ar, en, RTL } from '../../stories/copy'
import { BrandTile } from './BrandTile'

/** Stands in for a supplied logo image. */
const Logo = ({ label }: { label: string }) => (
  <div
    role="img"
    aria-label={label}
    className="h-12 w-40 rounded-control bg-linear-to-r from-lacquer to-graphite"
  />
)

const meta = {
  title: 'Discovery/BrandTile',
  component: BrandTile,
  args: {
    name: 'McIntosh',
    href: '#',
    logo: <Logo label="McIntosh logo" />,
    meta: en('brands.products', { count: 4 }),
  },
  decorators: [(Story) => <div className="max-w-72">{Story()}</div>],
} satisfies Meta<typeof BrandTile>
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Loading: Story = { args: { loading: true, loadingLabel: en('ui.loading') } }

/** No logo supplied: the name as a wordmark, and no product count. */
export const Empty: Story = { args: { logo: undefined, meta: undefined, name: 'Sonus faber' } }

export const Error: Story = { args: { error: en('ui.errorBody') } }

export const Rtl: Story = {
  name: 'RTL',
  parameters: RTL,
  args: { logo: undefined, meta: ar('brands.products', { count: 4 }) },
}
