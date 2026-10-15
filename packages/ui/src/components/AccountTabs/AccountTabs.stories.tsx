import type { Meta, StoryObj } from '@storybook/react-vite'
import { ar, en, RTL } from '../../stories/copy'
import { Button } from '../Button/Button'
import { AccountTabs } from './AccountTabs'

const tabs = (t: typeof en, locale: 'en' | 'ar') => [
  { label: t('account.orders'), href: `/ae/${locale}/account/orders/`, current: true, count: 2 },
]
const signOut = (t: typeof en) => (
  <Button variant="secondary" type="submit">
    {t('account.signOut')}
  </Button>
)

const meta = {
  title: 'Account/AccountTabs',
  component: AccountTabs,
  args: {
    label: en('account.nav'),
    tabs: tabs(en, 'en'),
    identity: 'layla@example.com',
    signOut: signOut(en),
  },
  decorators: [(Story) => <div className="max-w-4xl">{Story()}</div>],
} satisfies Meta<typeof AccountTabs>
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Loading: Story = { args: { loading: true, loadingLabel: en('ui.loading') } }

export const Empty: Story = {
  args: { tabs: [], emptyLabel: en('ui.emptyTitle'), identity: undefined },
}

export const Error: Story = { args: { error: en('ui.errorBody') } }

export const Rtl: Story = {
  name: 'RTL',
  parameters: RTL,
  args: { label: ar('account.nav'), tabs: tabs(ar, 'ar'), signOut: signOut(ar) },
}
