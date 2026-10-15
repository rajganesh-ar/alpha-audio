import type { ShopperOrder } from '@alpha/payload'
import type { TimelineStep, Translate } from '@alpha/ui'

/**
 * The customer's view of an order's progress (docs/tasks/0010). Warehouse detail is folded:
 * picking and packing are both "being prepared" until the parcel leaves.
 */
export function orderSteps(
  order: ShopperOrder,
  t: Translate,
  date: (d: Date) => string,
): TimelineStep[] {
  if (order.status !== 'confirmed') {
    return [{ key: 'payment', label: t('orders.steps.payment'), state: 'current' }]
  }
  const confirmed: TimelineStep = {
    key: 'confirmed',
    label: t('orders.steps.confirmed'),
    detail: date(order.placedAt),
    state: 'done',
  }
  if (order.fulfilment === 'cancelled' || order.fulfilment === 'cancelling') {
    return [confirmed, { key: 'cancelled', label: t('orders.steps.cancelled'), state: 'stopped' }]
  }
  const stage = { delivered: 3, shipped: 2, delivering: 2 }[order.fulfilment as string] ?? 1
  const shipment = order.shipment
  const state = (index: number): TimelineStep['state'] =>
    index < stage || (index === 3 && stage === 3)
      ? 'done'
      : index === stage
        ? 'current'
        : 'upcoming'
  return [
    confirmed,
    { key: 'picked', label: t('orders.steps.picked'), state: state(1) },
    {
      key: 'shipped',
      label: t('orders.steps.shipped'),
      ...(shipment
        ? {
            detail: `${date(shipment.shippedAt)} · ${t('orders.shippedWith', {
              courier: shipment.courier,
              tracking: shipment.trackingNumber,
            })}`,
          }
        : {}),
      state: state(2),
    },
    {
      key: 'delivered',
      label: t('orders.steps.delivered'),
      ...(shipment?.deliveredAt ? { detail: date(shipment.deliveredAt) } : {}),
      state: state(3),
    },
  ]
}
