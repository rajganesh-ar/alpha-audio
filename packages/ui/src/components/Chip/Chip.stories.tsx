import type { Meta, StoryObj } from '@storybook/react-vite'
import { ar, en, RTL } from '../../stories/copy'
import { Chip } from './Chip'

const meta = {
  title: 'Actions/Chip',
  component: Chip,
  args: { label: 'Amplifiers', count: 24 },
} satisfies Meta<typeof Chip>
export default meta
type Story = StoryObj<typeof meta>

/** Unselected and selected (lacquer fill, check icon, `aria-pressed`). */
export const Default: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      <Chip label="Amplifiers" count={24} />
      <Chip label="Turntables" count={9} selected />
      <Chip label="Home cinema" count={31} />
    </div>
  ),
}

/** Counts refreshing after a filter change. */
export const Loading: Story = { args: { loading: true, loadingLabel: en('ui.loading') } }

/** No results for this option: disabled at count 0. */
export const Empty: Story = { args: { label: 'Reel-to-reel', count: 0 } }

/** The option conflicts with another choice. */
export const Error: Story = {
  args: { label: 'Dolby Atmos', count: 3, invalid: true, invalidLabel: en('ui.unavailable') },
}

export const Rtl: Story = {
  name: 'RTL',
  parameters: RTL,
  render: () => (
    <div className="flex flex-wrap gap-2">
      <Chip label="مضخمات الصوت" count={24} />
      <Chip label="أجهزة التشغيل" count={9} selected />
      <Chip label={ar('ui.compare')} />
    </div>
  ),
}
