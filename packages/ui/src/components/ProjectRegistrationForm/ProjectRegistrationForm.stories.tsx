import type { Meta, StoryObj } from '@storybook/react-vite'
import { ar, en, RTL } from '../../stories/copy'
import { ProjectRegistrationForm } from './ProjectRegistrationForm'

const labels = (t: typeof en) => ({
  project: t('partners.projects.project'),
  name: t('partners.projects.name'),
  endCustomer: t('partners.projects.endCustomer'),
  city: t('partners.projects.city'),
  expectedClose: t('partners.projects.expectedClose'),
  note: t('partners.projects.note'),
  products: t('partners.projects.products'),
  line: t('partners.order.line'),
  sku: t('partners.order.sku'),
  qty: t('partners.order.qty'),
  submit: t('partners.projects.submit'),
  required: t('partners.projects.required'),
})

const meta = {
  title: 'Dealer/ProjectRegistrationForm',
  component: ProjectRegistrationForm,
  args: {
    action: '/api/v1/projects',
    labels: labels(en),
    hint: en('partners.projects.hint'),
    hidden: { idempotencyKey: 'story' },
    values: {
      name: 'Palm villa cinema',
      endCustomer: 'Private client',
      city: 'Dubai',
      expectedClose: '2026-12-01',
      lines: [
        { sku: 'MCINTOSH-MA352', qty: '2' },
        { sku: 'SONUSFABER-SONETTO-III', qty: '6' },
      ],
    },
    blankRows: 1,
  },
  decorators: [(Story) => <div className="max-w-xl">{Story()}</div>],
} satisfies Meta<typeof ProjectRegistrationForm>
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Loading: Story = { args: { loading: true, loadingLabel: en('ui.loading') } }

/** A new registration: nothing filled in yet. */
export const Empty: Story = { args: { values: {}, blankRows: 3 } }

/** The registration came back with problems. */
export const Error: Story = {
  args: {
    error: en('partners.projects.results.error'),
    errors: {
      endCustomer: en('partners.projects.problems.end-customer'),
      expectedClose: en('partners.projects.problems.expected-close'),
      lines: en('partners.projects.problems.unknown-product'),
    },
  },
}

export const Rtl: Story = {
  name: 'RTL',
  parameters: RTL,
  args: {
    labels: labels(ar),
    hint: ar('partners.projects.hint'),
    values: {
      name: 'سينما فيلا النخلة',
      endCustomer: 'عميل خاص',
      city: 'دبي',
      expectedClose: '2026-12-01',
      lines: [{ sku: 'MCINTOSH-MA352', qty: '2' }],
    },
  },
}
