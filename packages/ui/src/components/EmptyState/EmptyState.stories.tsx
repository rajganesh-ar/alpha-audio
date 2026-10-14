import type { Meta, StoryObj } from '@storybook/react-vite'
import { ar, en, RTL } from '../../stories/copy'
import { Button } from '../Button/Button'
import { EmptyState } from './EmptyState'

const meta = {
  title: 'Feedback/EmptyState',
  component: EmptyState,
  args: {
    title: en('ui.emptyTitle'),
    body: en('ui.emptyBody'),
    action: (
      <Button variant="secondary" href="#">
        {en('ui.browseAll')}
      </Button>
    ),
  },
  decorators: [(Story) => <div className="max-w-xl">{Story()}</div>],
} satisfies Meta<typeof EmptyState>
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

/** The action is working (e.g. clearing filters). */
export const Loading: Story = {
  args: {
    action: (
      <Button variant="secondary" loading loadingLabel={en('ui.loading')}>
        {en('ui.browseAll')}
      </Button>
    ),
  },
}

/** Title only. */
export const Empty: Story = { args: { body: undefined, action: undefined } }

/** The suggested action failed; the note says so and offers a retry. */
export const Error: Story = {
  args: {
    action: undefined,
    note: (
      <p className="flex items-center gap-2 text-sm text-critical">
        {en('ui.errorBody')}
        <Button variant="quiet" tone="critical">
          {en('ui.retry')}
        </Button>
      </p>
    ),
  },
}

export const Rtl: Story = {
  name: 'RTL',
  parameters: RTL,
  args: {
    title: ar('ui.emptyTitle'),
    body: ar('ui.emptyBody'),
    action: (
      <Button variant="secondary" href="#">
        {ar('ui.browseAll')}
      </Button>
    ),
    align: 'start',
  },
}
