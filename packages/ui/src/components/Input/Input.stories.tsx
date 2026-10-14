import type { Meta, StoryObj } from '@storybook/react-vite'
import { ar, en, RTL } from '../../stories/copy'
import { Input } from './Input'

const meta = {
  title: 'Forms/Input',
  component: Input,
  args: {
    label: 'Email',
    name: 'email',
    type: 'email',
    autoComplete: 'email',
    defaultValue: 'layla@example.ae',
    dir: 'ltr',
  },
  decorators: [(Story) => <div className="max-w-96">{Story()}</div>],
} satisfies Meta<typeof Input>
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

/** Checking the value in the background. */
export const Loading: Story = { args: { loading: true, loadingLabel: en('form.checking') } }

/** Empty, with a hint and the required marker. */
export const Empty: Story = {
  args: {
    defaultValue: undefined,
    required: true,
    requiredLabel: en('form.required'),
    hint: 'We send the order confirmation here.',
  },
}

/** Invalid: alert border, message with an icon, tied by aria-describedby. */
export const Error: Story = {
  args: { defaultValue: 'layla@', error: 'Enter a complete email address.' },
}

/** Arabic label; the phone number stays left to right with Western digits. */
export const Rtl: Story = {
  name: 'RTL',
  parameters: RTL,
  args: {
    label: 'رقم الهاتف',
    name: 'phone',
    type: 'tel',
    inputMode: 'tel',
    autoComplete: 'tel',
    defaultValue: '+971 50 123 4567',
    required: true,
    requiredLabel: ar('form.required'),
    dir: 'ltr',
  },
}
