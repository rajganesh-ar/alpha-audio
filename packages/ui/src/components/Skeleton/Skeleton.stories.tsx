import type { Meta, StoryObj } from '@storybook/react-vite'
import { RTL } from '../../stories/copy'
import { Skeleton } from './Skeleton'

const meta = {
  title: 'Feedback/Skeleton',
  component: Skeleton,
  args: { shape: 'text', lines: 3 },
  decorators: [(Story) => <div className="max-w-80">{Story()}</div>],
} satisfies Meta<typeof Skeleton>
export default meta
type Story = StoryObj<typeof meta>

/** Three text lines; the last one is shorter. */
export const Default: Story = {}

/** A card-shaped placeholder: media block, title and two lines. */
export const Loading: Story = {
  render: () => (
    <div className="flex flex-col gap-3" aria-busy="true">
      <Skeleton shape="block" className="h-40 w-full" />
      <Skeleton lines={1} className="w-2/3" />
      <Skeleton lines={2} />
    </div>
  ),
}

/** Zero lines render nothing. */
export const Empty: Story = { args: { lines: 0 } }

/** Stilled: the pulse stops when a load has stalled behind an error. */
export const Error: Story = { args: { still: true } }

/** Lines fill from the inline start, so the short line ends on the left in Arabic. */
export const Rtl: Story = { name: 'RTL', parameters: RTL }
