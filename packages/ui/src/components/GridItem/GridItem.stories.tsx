import type { Meta, StoryObj } from '@storybook/react-vite'
import { ar, en, RTL } from '../../stories/copy'
import { ErrorState } from '../ErrorState/ErrorState'
import { Grid } from '../Grid/Grid'
import { Skeleton } from '../Skeleton/Skeleton'
import { GridItem } from './GridItem'

const Cell = ({ label }: { label: string }) => (
  <div className="flex min-h-16 items-center justify-center rounded-control border border-line-strong font-mono text-sm text-ink">
    {label}
  </div>
)

const meta = {
  title: 'Layout/GridItem',
  component: GridItem,
  args: { children: null },
  decorators: [(Story) => <Grid>{Story()}</Grid>],
} satisfies Meta<typeof GridItem>
export default meta
type Story = StoryObj<typeof meta>

/** 2 of 4 on mobile, 6 of 12 on desktop. */
export const Default: Story = {
  render: () => (
    <>
      <GridItem span={2} spanDesktop={6}>
        <Cell label="2 / 6" />
      </GridItem>
      <GridItem span={2} spanDesktop={6}>
        <Cell label="2 / 6" />
      </GridItem>
    </>
  ),
}

export const Loading: Story = {
  render: () => (
    <GridItem span={4} spanDesktop={6}>
      <div aria-busy="true">
        <Skeleton shape="block" className="h-16 w-full" />
        <span className="sr-only">{en('ui.loading')}</span>
      </div>
    </GridItem>
  ),
}

/** Full width by default, with nothing in it. */
export const Empty: Story = {
  render: () => (
    <GridItem>
      <span />
    </GridItem>
  ),
}

export const Error: Story = {
  render: () => (
    <GridItem spanDesktop={6}>
      <ErrorState title={en('ui.errorTitle')} compact />
    </GridItem>
  ),
}

export const Rtl: Story = {
  name: 'RTL',
  parameters: RTL,
  render: () => (
    <>
      <GridItem span={2} spanDesktop={3}>
        <Cell label={ar('ui.home')} />
      </GridItem>
      <GridItem span={2} spanDesktop={9}>
        <Cell label="9" />
      </GridItem>
    </>
  ),
}
