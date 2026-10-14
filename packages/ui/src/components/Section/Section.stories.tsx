import type { Meta, StoryObj } from '@storybook/react-vite'
import { ar, en, RTL } from '../../stories/copy'
import { Button } from '../Button/Button'
import { Card } from '../Card/Card'
import { EmptyState } from '../EmptyState/EmptyState'
import { ErrorState } from '../ErrorState/ErrorState'
import { Grid } from '../Grid/Grid'
import { GridItem } from '../GridItem/GridItem'
import { Section } from './Section'

const cards = (loading = false) => (
  <Grid as="ul">
    {['MA352', 'C12000', 'MC462'].map((name) => (
      <GridItem key={name} as="li" span={4} spanDesktop={4}>
        <Card title={name} eyebrow="McIntosh" href="#" loading={loading}>
          Integrated amplifier
        </Card>
      </GridItem>
    ))}
  </Grid>
)

const meta = {
  title: 'Layout/Section',
  component: Section,
  args: {
    title: 'New from McIntosh',
    eyebrow: 'Brand',
    description: 'Seventy-five years of American amplification, in the Dubai showroom now.',
    actions: (
      <Button variant="quiet" href="#" icon="arrow-forward" iconPosition="end">
        {en('ui.browseAll')}
      </Button>
    ),
  },
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof Section>
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = { render: (args) => <Section {...args}>{cards()}</Section> }

export const Loading: Story = {
  render: (args) => (
    <Section {...args} busy>
      {cards(true)}
    </Section>
  ),
}

export const Empty: Story = {
  render: (args) => (
    <Section {...args} actions={undefined}>
      <EmptyState title={en('ui.emptyTitle')} body={en('ui.emptyBody')} />
    </Section>
  ),
}

export const Error: Story = {
  render: (args) => (
    <Section {...args} actions={undefined}>
      <ErrorState
        title={en('ui.errorTitle')}
        body={en('ui.errorBody')}
        action={
          <Button variant="secondary" tone="critical">
            {en('ui.retry')}
          </Button>
        }
      />
    </Section>
  ),
}

export const Rtl: Story = {
  name: 'RTL',
  parameters: RTL,
  render: () => (
    <Section
      title="جديد من ماكنتوش"
      eyebrow="علامة تجارية"
      actions={
        <Button variant="quiet" href="#" icon="arrow-forward" iconPosition="end">
          {ar('ui.browseAll')}
        </Button>
      }
    >
      {cards()}
    </Section>
  ),
}

/** Lacquer band: the same components, re-coloured by the dark tone. */
export const Dark: Story = {
  render: (args) => (
    <Section {...args} tone="dark" actions={<Button href="#">{en('price.request')}</Button>}>
      {cards()}
    </Section>
  ),
}
