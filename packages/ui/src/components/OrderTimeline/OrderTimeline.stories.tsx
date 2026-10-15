import type { Meta, StoryObj } from '@storybook/react-vite'
import { ar, en, RTL } from '../../stories/copy'
import { OrderTimeline, type TimelineStep } from './OrderTimeline'

const steps = (
  t: typeof en,
  dates = ['15 Oct 2026, 10:42', '15 Oct 2026, 14:05'],
): TimelineStep[] => [
  { key: 'confirmed', label: t('orders.steps.confirmed'), detail: dates[0], state: 'done' },
  { key: 'picked', label: t('orders.steps.picked'), detail: dates[1], state: 'done' },
  {
    key: 'shipped',
    label: t('orders.steps.shipped'),
    detail: t('orders.shippedWith', { courier: 'Aramex', tracking: '44219988' }),
    state: 'current',
  },
  { key: 'delivered', label: t('orders.steps.delivered'), state: 'upcoming' },
]

const meta = {
  title: 'Commerce/OrderTimeline',
  component: OrderTimeline,
  args: { label: en('orders.progress'), steps: steps(en), emptyLabel: en('ui.emptyTitle') },
  decorators: [(Story) => <div className="max-w-md">{Story()}</div>],
} satisfies Meta<typeof OrderTimeline>
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Loading: Story = { args: { loading: true, loadingLabel: en('ui.loading') } }

export const Empty: Story = { args: { steps: [] } }

/** The timeline could not load. */
export const Error: Story = { args: { error: en('ui.errorBody') } }

export const Cancelled: Story = {
  args: {
    steps: [
      {
        key: 'confirmed',
        label: en('orders.steps.confirmed'),
        detail: '15 Oct 2026, 10:42',
        state: 'done',
      },
      {
        key: 'cancelled',
        label: en('orders.steps.cancelled'),
        detail: '15 Oct 2026, 11:30',
        state: 'stopped',
      },
    ],
  },
}

export const Rtl: Story = {
  name: 'RTL',
  parameters: RTL,
  args: {
    label: ar('orders.progress'),
    steps: steps(ar, ['15 أكتوبر 2026، 10:42 ص', '15 أكتوبر 2026، 2:05 م']),
  },
}
