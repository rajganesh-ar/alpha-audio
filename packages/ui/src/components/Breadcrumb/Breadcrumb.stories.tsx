import type { Meta, StoryObj } from '@storybook/react-vite'
import { ar, en, RTL } from '../../stories/copy'
import { Breadcrumb } from './Breadcrumb'

const meta = {
  title: 'Layout/Breadcrumb',
  component: Breadcrumb,
  args: {
    label: en('ui.breadcrumb'),
    items: [
      { label: en('ui.home'), href: '/ae/en/' },
      { label: en('shell.nav.brands'), href: '/ae/en/brands/' },
      { label: 'McIntosh', href: '/ae/en/brands/mcintosh/' },
      { label: 'MA352' },
    ],
  },
} satisfies Meta<typeof Breadcrumb>
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Loading: Story = { args: { loading: true } }

/** No trail (the home page): nothing is rendered. */
export const Empty: Story = { args: { items: [] } }

/** The trail could not be resolved: fall back to home and the current page. */
export const Error: Story = {
  args: { items: [{ label: en('ui.home'), href: '/ae/en/' }, { label: 'MA352' }] },
}

/** Chevrons point left in Arabic. */
export const Rtl: Story = {
  name: 'RTL',
  parameters: RTL,
  args: {
    label: ar('ui.breadcrumb'),
    items: [
      { label: ar('ui.home'), href: '/ae/ar/' },
      { label: ar('shell.nav.brands'), href: '/ae/ar/brands/' },
      { label: 'ماكنتوش', href: '/ae/ar/brands/mcintosh/' },
      { label: 'MA352' },
    ],
  },
}
