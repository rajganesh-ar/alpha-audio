import { getPayload, type Payload } from 'payload'
import config from '@payload-config'

export const payloadClient = (): Promise<Payload> => getPayload({ config })
