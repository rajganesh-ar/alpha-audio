import type { Meta, StoryObj } from '@storybook/react-vite'
import { ar, RTL } from '../../stories/copy'
import { ICON_NAMES, Icon } from './Icon'

const meta = {
  title: 'Foundations/Icon',
  component: Icon,
  args: { name: 'check' },
} satisfies Meta<typeof Icon>
export default meta
type Story = StoryObj<typeof meta>

const Set = () => (
  <ul className="grid grid-cols-7 gap-4 text-ink">
    {ICON_NAMES.map((name) => (
      <li key={name} className="flex flex-col items-center gap-1 text-xs">
        <Icon name={name} size={24} />
        <span className="font-mono">{name}</span>
      </li>
    ))}
  </ul>
)

/** The whole set. Decorative by default (hidden from assistive tech). */
export const Default: Story = { render: () => <Set /> }

/** The spinner used by loading buttons and fields; it stops under reduced motion. */
export const Loading: Story = { args: { name: 'spinner', size: 32, label: 'Loading' } }

/** No label: decorative, `aria-hidden`. */
export const Empty: Story = { args: { name: 'info', size: 24 } }

/** The alert glyph, always paired with text where it signals an error. */
export const Error: Story = {
  args: { name: 'alert', size: 32, label: 'Error' },
  render: (a) => (
    <span className="text-critical">
      <Icon {...a} />
    </span>
  ),
}

/** Directional icons mirror; the rest do not. */
export const Rtl: Story = {
  name: 'RTL',
  parameters: RTL,
  render: () => (
    <p className="flex items-center gap-4 text-ink">
      <Icon name="chevron-forward" size={24} label={ar('ui.home')} />
      <Icon name="arrow-forward" size={24} />
      <Icon name="search" size={24} />
    </p>
  ),
}
