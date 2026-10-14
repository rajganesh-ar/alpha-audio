import type { Meta, StoryObj } from '@storybook/react-vite'
import { RTL } from '../../stories/copy'
import { Skeleton } from '../Skeleton/Skeleton'
import { Marker } from './Marker'

const meta = {
  title: 'Data/Marker',
  component: Marker,
  args: { number: 1, label: 'Left speaker, 1' },
} satisfies Meta<typeof Marker>
export default meta
type Story = StoryObj<typeof meta>

/** Numbered amber dots, as on a Room Lab plan. */
export const Default: Story = {
  render: () => (
    <ol className="flex flex-col gap-3 text-ink">
      {['Left speaker', 'Right speaker', 'Subwoofer', 'Listening position'].map((name, i) => (
        <li key={name} className="flex items-center gap-3">
          <Marker number={i + 1} label={`${name}, ${i + 1}`} />
          {name}
        </li>
      ))}
    </ol>
  ),
}

/** Placement still being computed. */
export const Loading: Story = {
  render: () => (
    <span aria-busy="true" className="inline-flex">
      <Skeleton shape="circle" className="size-7" />
      <span className="sr-only">Loading</span>
    </span>
  ),
}

/** No number: a plain dot. */
export const Empty: Story = { args: { number: undefined, label: 'Reference point', size: 'sm' } }

/** A placement that breaks a hard rule. */
export const Error: Story = {
  args: { number: 3, label: 'Subwoofer, 3, placement fails a rule', tone: 'critical' },
}

/** Numerals never mirror and stay Western in Arabic. */
export const Rtl: Story = {
  name: 'RTL',
  parameters: RTL,
  render: () => (
    <p className="flex items-center gap-3 text-ink">
      <Marker number={12} label="السماعة اليسرى، 12" />
      السماعة اليسرى
    </p>
  ),
}
