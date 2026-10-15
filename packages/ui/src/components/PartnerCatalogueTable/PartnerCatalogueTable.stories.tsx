import type { Meta, StoryObj } from '@storybook/react-vite'
import { ar, en, RTL } from '../../stories/copy'
import { PriceTraceDrawer } from '../PriceTraceDrawer/PriceTraceDrawer'
import { PartnerCatalogueTable, type PartnerCatalogueRow } from './PartnerCatalogueTable'

const trace = (t: typeof en) => (
  <PriceTraceDrawer
    label={t('partners.trace.label')}
    stateLabels={{
      applied: t('partners.trace.applied'),
      checked: t('partners.trace.checked'),
      skipped: t('partners.trace.skipped'),
    }}
    rows={[{ label: t('partners.trace.rules.contract'), value: 'AED 5,900.00', state: 'applied' }]}
  />
)

const rows = (t: typeof en): PartnerCatalogueRow[] => [
  {
    sku: 'MCI-MA352',
    brand: 'McIntosh',
    title: t === en ? 'MA352 integrated amplifier' : 'مضخم متكامل MA352',
    rrp: 'AED 31,500.00',
    price: 'AED 21,000.00',
    status: 'ok',
    stock: '3–9',
    trace: trace(t),
  },
  {
    sku: 'FOC-ARIA-926',
    brand: 'Focal',
    title: t === en ? 'Aria 926 floorstanding speakers' : 'سماعات أرضية Aria 926',
    rrp: 'AED 12,600.00',
    price: 'AED 7,980.00',
    status: 'needs-approval',
    stock: t('partners.stock.low'),
  },
  {
    sku: 'SON-ARC',
    brand: 'Sonos',
    title: t === en ? 'Arc soundbar' : 'مكبر صوت Arc',
    rrp: 'AED 3,999.00',
    status: 'unavailable',
    stock: t('partners.stock.eta', { date: '20 Oct 2026' }),
  },
]

const columns = (t: typeof en) => ({
  product: t('partners.catalogue.product'),
  rrp: t('partners.catalogue.rrp'),
  price: t('partners.catalogue.price'),
  stock: t('partners.catalogue.stock'),
})
const statusLabels = (t: typeof en) => ({
  'needs-approval': t('partners.catalogue.needsApproval'),
  unavailable: t('partners.catalogue.unavailable'),
})

const meta = {
  title: 'Dealer/PartnerCatalogueTable',
  component: PartnerCatalogueTable,
  args: {
    caption: en('partners.catalogue.caption'),
    columns: columns(en),
    rows: rows(en),
    statusLabels: statusLabels(en),
    emptyLabel: en('partners.catalogue.empty'),
  },
} satisfies Meta<typeof PartnerCatalogueTable>
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Loading: Story = { args: { loading: true, loadingLabel: en('ui.loading') } }

export const Empty: Story = { args: { rows: [] } }

/** The catalogue could not load. */
export const Error: Story = { args: { error: en('ui.errorBody') } }

/** Stock hidden for this company. */
export const StockHidden: Story = {
  args: { rows: rows(en).map((row) => ({ ...row, stock: undefined })) },
}

export const Rtl: Story = {
  name: 'RTL',
  parameters: RTL,
  args: {
    caption: ar('partners.catalogue.caption'),
    columns: columns(ar),
    rows: rows(ar),
    statusLabels: statusLabels(ar),
  },
}
