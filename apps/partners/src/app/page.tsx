import { redirect } from 'next/navigation'
import { currentPartner } from '@/lib/session'

/** The board's front door: the catalogue when signed in, otherwise sign-in. */
export default async function Home() {
  redirect((await currentPartner()) ? '/catalogue' : '/login')
}
