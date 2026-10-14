import type { Meta, StoryObj } from '@storybook/react-vite'
import { ar, en, RTL } from '../../stories/copy'
import { EntryCard } from './EntryCard'

const meta = {
  title: 'Discovery/EntryCard',
  component: EntryCard,
  args: {
    icon: 'sparkles',
    title: en('design.tools.advisor'),
    body: 'Tell us about your room and how you listen; get a shortlist with reasons.',
    href: '#',
    ctaLabel: 'Start',
  },
  decorators: [(Story) => <div className="max-w-80">{Story()}</div>],
} satisfies Meta<typeof EntryCard>
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Loading: Story = { args: { loading: true, loadingLabel: en('ui.loading') } }

/** The tool is not open yet: no link, a "coming soon" badge. */
export const Empty: Story = {
  args: {
    icon: 'ruler',
    title: en('design.tools.room-lab'),
    href: undefined,
    unavailableLabel: en('home.entryUnavailable'),
  },
}

export const Error: Story = { args: { error: en('ui.errorBody') } }

export const Rtl: Story = {
  name: 'RTL',
  parameters: RTL,
  args: {
    icon: 'layers',
    title: ar('design.tools.builder'),
    body: 'اختر المكونات خطوة بخطوة مع التحقق من التوافق.',
    ctaLabel: 'ابدأ',
  },
}
