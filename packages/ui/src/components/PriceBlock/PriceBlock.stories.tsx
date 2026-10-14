import type { Meta, StoryObj } from '@storybook/react-vite'
import { money } from '@alpha/core'
import { ar, en, RTL } from '../../stories/copy'
import { Button } from '../Button/Button'
import { PriceBlock } from './PriceBlock'

// Money holds bigints, which Storybook args cannot serialise, so stories render directly.
const MA352 = money(5_750_000, 'AED', 2)
const WAS = money(6_200_000, 'AED', 2)
const QUARTER = money(1_437_500, 'AED', 2)

const meta = {
  title: 'Commerce/PriceBlock',
  component: PriceBlock,
  args: { locale: 'en-AE' },
} satisfies Meta<typeof PriceBlock>
export default meta
type Story = StoryObj<typeof meta>

/** UAE price with VAT note, previous price and instalments; a KWD price shows three decimals. */
export const Default: Story = {
  render: () => (
    <div className="flex flex-col gap-8">
      <PriceBlock
        locale="en-AE"
        size="lg"
        price={MA352}
        vatLabel={en('price.inclVat', { rate: 5 })}
        was={WAS}
        wasTemplate={en('price.was')}
        instalment={{ amount: QUARTER, template: en('price.instalment', { count: 4 }) }}
      />
      <PriceBlock locale="en-KW" price={money(1_490_250, 'KWD', 3)} />
    </div>
  ),
}

export const Loading: Story = { args: { loading: true, loadingLabel: en('ui.loading') } }

/** No published price: "Price on request" with the request action. */
export const Empty: Story = {
  args: {
    price: null,
    requestLabel: en('price.onRequest'),
    requestAction: <Button variant="secondary">{en('price.request')}</Button>,
  },
}

export const Error: Story = { args: { error: en('price.unavailable') } }

/** Arabic copy, Western digits, amount isolated with <bdi>. */
export const Rtl: Story = {
  name: 'RTL',
  parameters: RTL,
  render: () => (
    <PriceBlock
      locale="ar-AE"
      size="lg"
      price={MA352}
      vatLabel={ar('price.inclVat', { rate: 5 })}
      was={WAS}
      wasTemplate={ar('price.was')}
      instalment={{ amount: QUARTER, template: ar('price.instalment', { count: 4 }) }}
    />
  ),
}
