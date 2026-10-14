import type { Meta, StoryObj } from '@storybook/react-vite'
import { en, RTL } from '../../stories/copy'
import { Select } from './Select'

const EMIRATES = [
  { value: 'dubai', label: 'Dubai' },
  { value: 'abu-dhabi', label: 'Abu Dhabi' },
  { value: 'sharjah', label: 'Sharjah' },
]

const meta = {
  title: 'Forms/Select',
  component: Select,
  args: {
    label: 'Emirate',
    name: 'emirate',
    options: EMIRATES,
    placeholder: 'Choose an emirate',
    defaultValue: 'dubai',
  },
  decorators: [(Story) => <div className="max-w-96">{Story()}</div>],
} satisfies Meta<typeof Select>
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

/** Options loading (e.g. delivery slots). */
export const Loading: Story = { args: { loading: true, loadingLabel: en('ui.loading') } }

/** No options: disabled, with the empty label as its only option. */
export const Empty: Story = { args: { options: [], emptyLabel: 'No delivery slots this week' } }

export const Error: Story = {
  args: { defaultValue: '', error: 'Choose an emirate to see delivery slots.' },
}

/** The chevron sits at the inline end, on the left in Arabic. */
export const Rtl: Story = {
  name: 'RTL',
  parameters: RTL,
  args: {
    label: 'الإمارة',
    options: [
      { value: 'dubai', label: 'دبي' },
      { value: 'abu-dhabi', label: 'أبوظبي' },
    ],
    placeholder: 'اختر الإمارة',
  },
}
