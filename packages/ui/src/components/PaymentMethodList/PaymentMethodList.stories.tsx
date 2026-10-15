import type { Meta, StoryObj } from '@storybook/react-vite'
import { ar, en, RTL } from '../../stories/copy'
import { PaymentMethodList } from './PaymentMethodList'

const options = (t: typeof en) => [
  {
    value: 'card',
    label: t('checkout.methods.card'),
    description: t('checkout.methods.card_description'),
  },
  { value: 'applepay', label: t('checkout.methods.applepay') },
]

const meta = {
  title: 'Commerce/PaymentMethodList',
  component: PaymentMethodList,
  args: {
    label: en('checkout.methods.label'),
    name: 'method',
    options: options(en),
    value: 'card',
    emptyLabel: en('checkout.noMethods'),
  },
  decorators: [(Story) => <form className="max-w-md">{Story()}</form>],
} satisfies Meta<typeof PaymentMethodList>
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Loading: Story = { args: { loading: true, loadingLabel: en('ui.loading') } }

export const Empty: Story = { args: { options: [] } }

export const Error: Story = { args: { error: en('checkout.problem.required'), value: undefined } }

export const Rtl: Story = {
  name: 'RTL',
  parameters: RTL,
  args: { label: ar('checkout.methods.label'), options: options(ar) },
}
