import type { Meta, StoryObj } from '@storybook/react-vite'
import { ar, en, RTL } from '../../stories/copy'
import { Button } from '../Button/Button'
import { LeadCard } from './LeadCard'

const labels = (t: typeof en) => ({
  city: t('partners.leads.city'),
  message: t('partners.leads.message'),
  contact: t('partners.leads.contact'),
  received: t('partners.leads.received'),
})
const actions = (t: typeof en) => (
  <>
    <Button type="submit">{t('partners.leads.accept')}</Button>
    <Button type="submit" variant="secondary">
      {t('partners.leads.decline')}
    </Button>
  </>
)

const meta = {
  title: 'Dealer/LeadCard',
  component: LeadCard,
  args: {
    number: 'L-AE-2026-000042',
    product: 'Lumina II standmount speakers',
    brand: 'Sonus faber',
    city: 'Dubai',
    message: 'Looking for speakers for a 20 m² majlis, with a turntable.',
    received: '15 Oct 2026, 10:42',
    state: 'offered',
    stateLabel: en('partners.leads.states.offered'),
    deadline: en('partners.leads.deadline', {
      date: '16 Oct 2026, 10:42',
      left: en('partners.leads.left.hours', { count: 23 }),
    }),
    labels: labels(en),
    actions: actions(en),
    emptyLabel: en('partners.leads.empty'),
  },
  decorators: [(Story) => <div className="max-w-xl">{Story()}</div>],
} satisfies Meta<typeof LeadCard>
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Loading: Story = { args: { loading: true, loadingLabel: en('ui.loading') } }

export const Empty: Story = { args: { number: '' } }

/** The lead could not load. */
export const Error: Story = { args: { error: en('ui.errorBody') } }

/** Less than an hour to accept. */
export const Urgent: Story = {
  args: {
    urgent: true,
    deadline: en('partners.leads.deadline', {
      date: '15 Oct 2026, 11:30',
      left: en('partners.leads.left.minutes'),
    }),
  },
}

/** Accepted: the shopper's contact appears. */
export const Accepted: Story = {
  args: {
    state: 'accepted',
    stateLabel: en('partners.leads.states.accepted'),
    deadline: undefined,
    contact: { name: 'Mariam Al Hashimi', email: 'mariam@example.com', phone: '+971 50 123 4567' },
    actions: undefined,
  },
}

export const Rtl: Story = {
  name: 'RTL',
  parameters: RTL,
  args: {
    product: 'سماعات Lumina II الرفية',
    city: 'دبي',
    message: 'أبحث عن سماعات لمجلس مساحته 20 متراً مربعاً.',
    stateLabel: ar('partners.leads.states.offered'),
    deadline: ar('partners.leads.deadline', {
      date: '16 أكتوبر 2026، 10:42',
      left: ar('partners.leads.left.hours', { count: 23 }),
    }),
    labels: labels(ar),
    actions: actions(ar),
  },
}
