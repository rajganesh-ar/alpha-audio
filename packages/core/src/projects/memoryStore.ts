import type { Id } from '../ledger/types'
import type { NewProject, ProjectPatch, ProjectRecord, ProjectStatus, ProjectStore } from './types'

/** In-memory project store for unit tests (Postgres: `@alpha/payload` system store). */
export class MemoryProjectStore implements ProjectStore {
  readonly projects: ProjectRecord[] = []
  private sequence = 0

  async nextProjectNumber(market: string, now: Date) {
    return `P-${market.toUpperCase()}-${now.getUTCFullYear()}-${String(++this.sequence).padStart(6, '0')}`
  }

  async findByIdempotencyKey(key: string) {
    const project = this.projects.find((p) => p.idempotencyKey === key)
    return project ? structuredClone(project) : null
  }

  async findByNumber(number: string) {
    const project = this.projects.find((p) => p.number === number)
    return project ? structuredClone(project) : null
  }

  async insertProject(input: NewProject) {
    const existing = await this.findByIdempotencyKey(input.idempotencyKey)
    if (existing) return { project: existing, created: false }
    const project: Partial<NewProject> = { ...input }
    delete project.details
    const record = {
      ...structuredClone(project as Omit<NewProject, 'details'>),
      id: this.projects.length + 1,
    }
    this.projects.push(record)
    return { project: structuredClone(record), created: true }
  }

  async transition(
    id: Id,
    from: readonly ProjectStatus[],
    to: ProjectStatus,
    patch: ProjectPatch = {},
  ) {
    const project = this.projects.find((p) => p.id === id)
    if (!project || !from.includes(project.status)) return false
    Object.assign(project, structuredClone(patch), { status: to })
    return true
  }
}
