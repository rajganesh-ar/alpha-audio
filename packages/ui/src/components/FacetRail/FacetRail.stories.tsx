import type { Meta, StoryObj } from '@storybook/react-vite'
import { ar, en, RTL } from '../../stories/copy'
import { FacetRail, type FacetGroup } from './FacetRail'

const groups = (t: typeof en): FacetGroup[] => [
  {
    id: 'brand',
    legend: t('listing.brand'),
    name: 'brand',
    type: 'checkbox',
    options: [
      { value: 'mcintosh', label: 'McIntosh', count: 4, checked: true },
      { value: 'marantz', label: 'Marantz', count: 2, checked: false },
    ],
  },
  {
    id: 'price',
    legend: t('listing.price'),
    name: 'price',
    type: 'radio',
    options: [
      { value: '', label: t('listing.anyPrice'), checked: true },
      {
        value: '0-10000',
        label: t('listing.priceUnder', { max: 'AED 10,000' }),
        count: 1,
        checked: false,
      },
      {
        value: '10000-',
        label: t('listing.priceFrom', { min: 'AED 10,000' }),
        count: 3,
        checked: false,
      },
    ],
  },
  {
    id: 'stock',
    legend: t('listing.availability'),
    name: 'stock',
    type: 'checkbox',
    options: [{ value: 'in', label: t('listing.inStockOnly'), count: 3, checked: false }],
  },
  {
    id: 'channels',
    legend: t('product.spec.channels'),
    name: 'spec.channels',
    type: 'checkbox',
    options: [
      { value: '2', label: '2', count: 4, checked: false },
      { value: '9', label: '9', count: 1, checked: false },
    ],
  },
]

const meta = {
  title: 'Discovery/FacetRail',
  component: FacetRail,
  args: {
    formId: 'listing-filters',
    action: '#',
    title: en('listing.filters'),
    toggleLabel: en('listing.filtersToggle', { count: 1 }),
    groups: groups(en),
    applyLabel: en('listing.apply'),
    clearLabel: en('listing.clear'),
    clearHref: '#',
  },
  decorators: [(Story) => <div className="max-w-xs">{Story()}</div>],
} satisfies Meta<typeof FacetRail>
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Loading: Story = { args: { loading: true, loadingLabel: en('ui.loading') } }

export const Empty: Story = {
  args: { groups: [], clearHref: undefined, emptyLabel: en('listing.noFilters') },
}

export const Error: Story = { args: { error: en('ui.errorBody') } }

export const Rtl: Story = {
  name: 'RTL',
  parameters: RTL,
  args: {
    title: ar('listing.filters'),
    toggleLabel: ar('listing.filtersToggle', { count: 1 }),
    groups: groups(ar),
    applyLabel: ar('listing.apply'),
    clearLabel: ar('listing.clear'),
  },
}
