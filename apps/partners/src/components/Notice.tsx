import { Icon } from '@alpha/ui'

/** A one-line outcome after a form post (the page the 303 lands on). */
export function Notice({ tone, children }: { tone: 'info' | 'critical'; children: string }) {
  return (
    <p
      role={tone === 'critical' ? 'alert' : 'status'}
      className={`flex items-center gap-2 rounded-card border px-4 py-3 text-base ${
        tone === 'critical' ? 'border-critical text-critical' : 'border-line-strong text-ink'
      }`}
    >
      <Icon name={tone === 'critical' ? 'alert' : 'check'} />
      {children}
    </p>
  )
}
