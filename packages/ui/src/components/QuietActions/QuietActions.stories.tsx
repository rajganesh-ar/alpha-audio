import type { Meta, StoryObj } from '@storybook/react-vite'
import { ar, en, RTL } from '../../stories/copy'
import { quietActions } from '../../stories/shell'
import { QuietActions } from './QuietActions'

const meta = {
  title: 'Shell/QuietActions',
  component: QuietActions,
  args: { label: en('ui.quietActions'), actions: quietActions(en, 'en'), compact: false },
} satisfies Meta<typeof QuietActions>
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Loading: Story = { args: { loading: true } }
export const Empty: Story = { args: { actions: [] } }
/** The bag count could not be read: an alert mark, named for screen readers. */
export const Error: Story = {
  args: {
    actions: quietActions(en, 'en').map((a) =>
      a.icon === 'bag' ? { ...a, errorLabel: en('ui.unavailable') } : a,
    ),
  },
}
export const Rtl: Story = {
  name: 'RTL',
  parameters: RTL,
  args: { label: ar('ui.quietActions'), actions: quietActions(ar, 'ar') },
}
