import type { Meta, StoryObj } from '@storybook/react-vite'
import { ar, en, RTL } from '../../stories/copy'
import { marketOptions } from '../../stories/shell'
import { MarketSwitch } from './MarketSwitch'

const meta = {
  title: 'Shell/MarketSwitch',
  component: MarketSwitch,
  args: {
    label: en('marketSwitch.label'),
    currentLabel: 'United Arab Emirates · English',
    options: marketOptions('en'),
  },
  decorators: [(Story) => <div className="flex min-h-48 justify-end">{Story()}</div>],
} satisfies Meta<typeof MarketSwitch>
export default meta
type Story = StoryObj<typeof meta>

/** Opened, as a visitor sees it after a click. Native <details>, so it works without JavaScript. */
export const Default: Story = { args: { defaultOpen: true } }

/** Closed, as it sits in the header. */
export const Closed: Story = {}
export const Loading: Story = { args: { loading: true } }
/** Only one market and language: the current label, no menu. */
export const Empty: Story = { args: { options: [] } }
export const Error: Story = { args: { error: en('ui.marketsUnavailable') } }
/** Every option in its own language and direction (the 404 page). */
export const List: Story = { args: { variant: 'list' } }
export const Rtl: Story = {
  name: 'RTL',
  parameters: RTL,
  args: {
    label: ar('marketSwitch.label'),
    currentLabel: 'الإمارات العربية المتحدة · العربية',
    options: marketOptions('ar'),
    defaultOpen: true,
  },
}
