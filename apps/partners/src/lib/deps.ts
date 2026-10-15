import { loadEnv } from '@alpha/config/env'
import type { Deps } from './api'
import { payloadClient } from './payload'

export async function deps(): Promise<Deps> {
  return {
    payload: await payloadClient(),
    secure: new URL(loadEnv().PARTNERS_SERVER_URL).protocol === 'https:',
  }
}
