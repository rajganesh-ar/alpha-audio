import type { Meta, StoryObj } from '@storybook/react-vite'
import { ar, en, RTL } from '../../stories/copy'
import { Pagination } from './Pagination'

const meta = {
  title: 'Discovery/Pagination',
  component: Pagination,
  args: {
    label: en('listing.pagination'),
    current: 4,
    pages: 9,
    hrefFor: (page: number) => `#page-${page}`,
    previousLabel: en('listing.previous'),
    nextLabel: en('listing.next'),
    pageLabel: en('listing.page'),
  },
} satisfies Meta<typeof Pagination>
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Loading: Story = { args: { loading: true, loadingLabel: en('ui.loading') } }

/** One page: renders nothing. */
export const Empty: Story = { args: { pages: 1, current: 1 } }

export const Error: Story = { args: { error: en('ui.errorBody') } }

export const Rtl: Story = {
  name: 'RTL',
  parameters: RTL,
  args: {
    label: ar('listing.pagination'),
    previousLabel: ar('listing.previous'),
    nextLabel: ar('listing.next'),
    pageLabel: ar('listing.page'),
  },
}
