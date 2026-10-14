import type { Meta, StoryObj } from '@storybook/react-vite'
import { ar, en, RTL } from '../../stories/copy'
import { Badge } from '../Badge/Badge'
import { Button } from '../Button/Button'
import { ErrorState } from '../ErrorState/ErrorState'
import { Card } from './Card'

const Media = () => (
  <div className="aspect-4/3 w-full" role="img" aria-label="Product photo placeholder" />
)

const meta = {
  title: 'Layout/Card',
  component: Card,
  args: {
    eyebrow: 'McIntosh',
    title: 'MA352 integrated amplifier',
    href: '#',
    media: <Media />,
    children: 'Hybrid vacuum-tube preamplifier with a 200 W solid-state power stage.',
    footer: <Badge tone="positive" label={en('stock.inStock')} />,
  },
  decorators: [(Story) => <div className="max-w-80">{Story()}</div>],
} satisfies Meta<typeof Card>
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Loading: Story = { args: { loading: true, loadingLabel: en('ui.loading') } }

/** Title only: no media, body or footer. */
export const Empty: Story = {
  args: {
    media: undefined,
    children: undefined,
    footer: undefined,
    eyebrow: undefined,
    href: undefined,
  },
}

/** The card's content failed to load. */
export const Error: Story = {
  args: {
    media: undefined,
    href: undefined,
    eyebrow: undefined,
    title: undefined,
    footer: undefined,
    children: (
      <ErrorState
        title={en('ui.errorTitle')}
        action={
          <Button variant="secondary" tone="critical">
            {en('ui.retry')}
          </Button>
        }
        compact
      />
    ),
  },
}

export const Rtl: Story = {
  name: 'RTL',
  parameters: RTL,
  args: {
    eyebrow: 'ماكنتوش',
    title: 'مضخم الصوت المتكامل MA352',
    children: 'مضخم مسبق هجين بصمامات مفرغة ومرحلة طاقة بقدرة 200 واط.',
    footer: <Badge tone="positive" label={ar('stock.inStock')} />,
  },
}
