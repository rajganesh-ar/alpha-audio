import type { Meta, StoryObj } from '@storybook/react-vite'
import { ar, en, RTL } from '../../stories/copy'
import { AnnouncementBar } from './AnnouncementBar'

const meta = {
  title: 'Shell/AnnouncementBar',
  component: AnnouncementBar,
  args: { children: en('announcement.preview') },
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof AnnouncementBar>
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Loading: Story = { args: { loading: true, children: undefined } }
/** No announcement: the bar is not rendered. */
export const Empty: Story = { args: { children: undefined } }
/** Service notice on the alert fill. */
export const Error: Story = {
  args: {
    tone: 'critical',
    children: 'Online checkout is paused for maintenance until 02:00 Gulf time.',
  },
}
export const Rtl: Story = {
  name: 'RTL',
  parameters: RTL,
  args: { children: ar('announcement.preview') },
}
