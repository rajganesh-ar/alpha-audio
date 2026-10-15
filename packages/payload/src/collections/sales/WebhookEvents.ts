import type { CollectionConfig } from 'payload'
import { nobody } from '../../access'

/**
 * Every inbound webhook is recorded here first (spec: APIs → inbound webhooks): provider, event
 * id (unique per provider, migration `checkout_constraints`), payload hash. A duplicate insert is
 * how a replay is detected. System only (task 0009): written and read by the checkout service.
 */
export const WebhookEvents: CollectionConfig = {
  slug: 'webhook-events',
  labels: { singular: 'Webhook event', plural: 'Webhook events' },
  admin: {
    group: 'System',
    useAsTitle: 'eventId',
    defaultColumns: ['provider', 'eventId', 'receivedAt'],
  },
  access: { read: nobody, create: nobody, update: nobody, delete: nobody },
  fields: [
    { name: 'provider', type: 'text', required: true, index: true },
    { name: 'eventId', type: 'text', required: true },
    { name: 'payloadHash', type: 'text', required: true },
    { name: 'outcome', type: 'text' },
    { name: 'receivedAt', type: 'date', required: true },
  ],
}
