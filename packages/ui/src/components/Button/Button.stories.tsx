import type { Meta, StoryObj } from '@storybook/react-vite'
import { ar, en, RTL } from '../../stories/copy'
import { Button } from './Button'

const meta = {
  title: 'Actions/Button',
  component: Button,
  args: { children: en('price.request') },
} satisfies Meta<typeof Button>
export default meta
type Story = StoryObj<typeof meta>

/** Primary (amber fill, lacquer text), secondary outline and quiet. */
export const Default: Story = {
  render: (args) => (
    <div className="flex flex-wrap items-center gap-4">
      <Button {...args} />
      <Button variant="secondary">{en('ui.compare')}</Button>
      <Button variant="quiet" icon="arrow-forward" iconPosition="end">
        {en('ui.browseAll')}
      </Button>
    </div>
  ),
}

/** Busy: spinner, disabled, and the loading label for screen readers. */
export const Loading: Story = { args: { loading: true, loadingLabel: en('ui.loading') } }

/** No visible text: icon-only, named by `label`, still 44 × 44 px. */
export const Empty: Story = {
  args: { children: undefined, variant: 'secondary', icon: 'search', label: en('ui.search') },
}

/** Retry after a failure: secondary in the critical tone. */
export const Error: Story = {
  args: { children: en('ui.retry'), variant: 'secondary', tone: 'critical', icon: 'alert' },
}

/** Arabic; the forward arrow points left. */
export const Rtl: Story = {
  name: 'RTL',
  parameters: RTL,
  render: () => (
    <div className="flex flex-wrap items-center gap-4">
      <Button>{ar('price.request')}</Button>
      <Button variant="secondary">{ar('ui.compare')}</Button>
      <Button variant="quiet" icon="arrow-forward" iconPosition="end">
        {ar('ui.browseAll')}
      </Button>
    </div>
  ),
}
