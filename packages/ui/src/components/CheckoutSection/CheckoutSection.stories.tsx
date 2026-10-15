import type { Meta, StoryObj } from '@storybook/react-vite'
import { ar, en, RTL } from '../../stories/copy'
import { Input } from '../Input/Input'
import { CheckoutSection } from './CheckoutSection'

const fields = (t: typeof en, errors = false) => (
  <>
    <Input
      label={t('checkout.name')}
      name="name"
      autoComplete="name"
      required
      defaultValue="Layla Haddad"
    />
    <div className="grid gap-4 sm:grid-cols-2">
      <Input
        label={t('checkout.email')}
        name="email"
        type="email"
        dir="ltr"
        autoComplete="email"
        required
        defaultValue={errors ? 'layla@' : 'layla@example.com'}
        error={errors ? t('checkout.problem.invalid') : undefined}
      />
      <Input
        label={t('checkout.phone')}
        name="phone"
        type="tel"
        dir="ltr"
        autoComplete="tel"
        required
        defaultValue="+971 50 123 4567"
      />
    </div>
  </>
)

const meta = {
  title: 'Commerce/CheckoutSection',
  component: CheckoutSection,
  args: {
    step: 1,
    title: en('checkout.contact'),
    description: en('checkout.contactBody'),
    children: fields(en),
  },
  decorators: [(Story) => <form className="max-w-2xl">{Story()}</form>],
} satisfies Meta<typeof CheckoutSection>
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Loading: Story = { args: { loading: true, loadingLabel: en('ui.loading') } }

/** A step with nothing to fill in: the market has no online payment yet. */
export const Empty: Story = {
  args: {
    step: 3,
    title: en('checkout.payment'),
    description: undefined,
    children: undefined,
    emptyLabel: en('checkout.noMethods'),
  },
}

export const Error: Story = {
  args: { error: en('checkout.errorsTitle'), children: fields(en, true) },
}

export const Rtl: Story = {
  name: 'RTL',
  parameters: RTL,
  args: {
    title: ar('checkout.contact'),
    description: ar('checkout.contactBody'),
    children: fields(ar),
  },
}
