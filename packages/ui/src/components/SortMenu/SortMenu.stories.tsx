import type { Meta, StoryObj } from '@storybook/react-vite'
import { LISTING_SORTS } from '@alpha/core'
import { ar, en, RTL } from '../../stories/copy'
import { SortMenu } from './SortMenu'

const options = (t: typeof en) =>
  LISTING_SORTS.map((value) => ({ value, label: t(`listing.sorts.${value}`) }))

const meta = {
  title: 'Discovery/SortMenu',
  component: SortMenu,
  args: {
    label: en('listing.sort'),
    name: 'sort',
    options: options(en),
    value: 'price-asc',
    form: 'listing-filters',
    submitLabel: en('listing.sortApply'),
  },
  decorators: [
    (Story) => (
      <div>
        <form id="listing-filters" action="#" />
        {Story()}
      </div>
    ),
  ],
} satisfies Meta<typeof SortMenu>
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Loading: Story = { args: { loading: true, loadingLabel: en('ui.loading') } }

/** Nothing to sort by: renders nothing. */
export const Empty: Story = { args: { options: [] } }

export const Error: Story = { args: { error: en('ui.errorBody') } }

export const Rtl: Story = {
  name: 'RTL',
  parameters: RTL,
  args: { label: ar('listing.sort'), options: options(ar), submitLabel: ar('listing.sortApply') },
}
