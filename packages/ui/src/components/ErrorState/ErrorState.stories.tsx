import type { Meta, StoryObj } from '@storybook/react-vite'
import { ar, en, RTL } from '../../stories/copy'
import { Button } from '../Button/Button'
import { ErrorState } from './ErrorState'

const retry = (
  <Button variant="secondary" tone="critical" icon="alert">
    {en('ui.retry')}
  </Button>
)

const meta = {
  title: 'Feedback/ErrorState',
  component: ErrorState,
  args: { title: en('ui.errorTitle'), body: en('ui.errorBody'), action: retry },
  decorators: [(Story) => <div className="max-w-xl">{Story()}</div>],
} satisfies Meta<typeof ErrorState>
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

/** Retrying: the action shows its busy state. */
export const Loading: Story = {
  args: {
    action: (
      <Button variant="secondary" tone="critical" loading loadingLabel={en('ui.loading')}>
        {en('ui.retry')}
      </Button>
    ),
  },
}

/** Title only. */
export const Empty: Story = { args: { body: undefined, action: undefined } }

/** A failure the customer may need to quote to support, announced as an alert. */
export const Error: Story = {
  args: { live: true, reference: { label: en('ui.reference'), code: 'ORD-7F3A-2C' } },
}

export const Rtl: Story = {
  name: 'RTL',
  parameters: RTL,
  args: {
    title: ar('ui.errorTitle'),
    body: ar('ui.errorBody'),
    reference: { label: ar('ui.reference'), code: 'ORD-7F3A-2C' },
    action: (
      <Button variant="secondary" tone="critical" icon="alert">
        {ar('ui.retry')}
      </Button>
    ),
  },
}
