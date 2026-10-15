import { getProjects, postProject } from '@/lib/api'
import { deps } from '@/lib/deps'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  return getProjects(await deps(), request)
}

export async function POST(request: Request) {
  return postProject(await deps(), request)
}
