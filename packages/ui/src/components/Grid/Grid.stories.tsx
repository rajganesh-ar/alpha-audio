import type { Meta, StoryObj } from '@storybook/react-vite'
import { ar, en, RTL } from '../../stories/copy'
import { Button } from '../Button/Button'
import { EmptyState } from '../EmptyState/EmptyState'
import { ErrorState } from '../ErrorState/ErrorState'
import { GridItem } from '../GridItem/GridItem'
import { Skeleton } from '../Skeleton/Skeleton'
import { Grid } from './Grid'

const Cell = ({ label }: { label: string }) => (
  <div className="flex min-h-16 items-center justify-center rounded-control border border-line-strong font-mono text-sm text-ink">
    {label}
  </div>
)

const meta = {
  title: 'Layout/Grid',
  component: Grid,
  args: { children: null },
} satisfies Meta<typeof Grid>
export default meta
type Story = StoryObj<typeof meta>

/** Twelve columns on desktop (4 on mobile): a 12-wide row, 8 + 4, and three 4-wide tiles. */
export const Default: Story = {
  render: () => (
    <Grid>
      <GridItem spanDesktop={12}>
        <Cell label="12" />
      </GridItem>
      <GridItem spanDesktop={8}>
        <Cell label="8" />
      </GridItem>
      <GridItem spanDesktop={4}>
        <Cell label="4" />
      </GridItem>
      {[1, 2, 3].map((n) => (
        <GridItem key={n} span={2} spanDesktop={4}>
          <Cell label={`4 · ${n}`} />
        </GridItem>
      ))}
    </Grid>
  ),
}

export const Loading: Story = {
  render: () => (
    <div aria-busy="true">
      <Grid>
        {[1, 2, 3].map((n) => (
          <GridItem key={n} span={4} spanDesktop={4}>
            <Skeleton shape="block" className="h-32 w-full" />
          </GridItem>
        ))}
      </Grid>
      <span className="sr-only">{en('ui.loading')}</span>
    </div>
  ),
}

export const Empty: Story = {
  render: () => (
    <Grid>
      <GridItem>
        <EmptyState title={en('ui.emptyTitle')} body={en('ui.emptyBody')} />
      </GridItem>
    </Grid>
  ),
}

export const Error: Story = {
  render: () => (
    <Grid>
      <GridItem>
        <ErrorState
          title={en('ui.errorTitle')}
          action={
            <Button variant="secondary" tone="critical">
              {en('ui.retry')}
            </Button>
          }
        />
      </GridItem>
    </Grid>
  ),
}

/** Columns run from the right in Arabic: the 8-wide cell starts at the right edge. */
export const Rtl: Story = {
  name: 'RTL',
  parameters: RTL,
  render: () => (
    <Grid>
      <GridItem spanDesktop={8}>
        <Cell label={ar('shell.nav.products')} />
      </GridItem>
      <GridItem spanDesktop={4}>
        <Cell label="4" />
      </GridItem>
    </Grid>
  ),
}
