import type { ReactNode } from 'react'
import { cx } from '../../lib/cx'
import { FOCUS_RING, MOTION, TARGET } from '../../lib/styles'
import { Icon, type IconName } from '../Icon/Icon'

export type ButtonVariant = 'primary' | 'secondary' | 'quiet'

interface CommonProps {
  /** `primary` is the one next action on a view (amber fill, lacquer text). */
  variant?: ButtonVariant | undefined
  /** `critical` for retry and destructive actions; secondary and quiet only. */
  tone?: 'default' | 'critical' | undefined
  children?: ReactNode | undefined
  icon?: IconName | undefined
  iconPosition?: 'start' | 'end' | undefined
  /** Required when there is no visible text (icon-only buttons). */
  label?: string | undefined
  /** Shows a spinner, disables the button and announces `loadingLabel`. */
  loading?: boolean | undefined
  loadingLabel?: string | undefined
  fullWidth?: boolean | undefined
  className?: string | undefined
}

type ButtonAsButton = CommonProps & {
  href?: undefined
  type?: 'button' | 'submit' | 'reset' | undefined
  disabled?: boolean | undefined
  onClick?: (() => void) | undefined
  /** Submitted with the form (`name=value`), so one form can carry several actions. */
  name?: string | undefined
  value?: string | undefined
  /** Id of the form this button submits when it sits outside it. */
  form?: string | undefined
}
type ButtonAsLink = CommonProps & { href: string; hrefLang?: string }
export type ButtonProps = ButtonAsButton | ButtonAsLink

const VARIANT: Record<ButtonVariant, string> = {
  primary:
    'bg-vu-amber text-lacquer border border-vu-amber hover:bg-lacquer hover:text-vu-amber hover:border-lacquer',
  secondary: 'border border-ink text-ink hover:bg-ink hover:text-aluminium',
  quiet: 'border border-transparent text-ink underline-offset-4 hover:underline',
}

const CRITICAL: Record<ButtonVariant, string> = {
  primary: VARIANT.primary,
  secondary: 'border border-critical text-critical hover:bg-alert hover:text-aluminium',
  quiet: 'border border-transparent text-critical underline-offset-4 hover:underline',
}

/**
 * Buttons and button-styled links. Amber is spent only on the primary action, always as a
 * fill with lacquer text (never amber text on a light background).
 */
export function Button(props: ButtonProps) {
  const {
    variant = 'primary',
    tone = 'default',
    children,
    icon,
    iconPosition = 'start',
    label,
    loading = false,
    loadingLabel,
    fullWidth = false,
    className,
  } = props
  const iconOnly = !children
  const classes = cx(
    'inline-flex items-center justify-center gap-2 rounded-control font-semibold text-base',
    'disabled:cursor-not-allowed disabled:opacity-60 aria-disabled:cursor-not-allowed aria-disabled:opacity-60',
    TARGET,
    FOCUS_RING,
    MOTION,
    iconOnly ? 'px-3' : 'px-4 py-2',
    fullWidth && 'w-full',
    (tone === 'critical' ? CRITICAL : VARIANT)[variant],
    className,
  )
  const glyph = loading ? <Icon name="spinner" /> : icon ? <Icon name={icon} /> : null
  const content = (
    <>
      {iconPosition === 'start' && glyph}
      {children}
      {iconPosition === 'end' && glyph}
      {loading && loadingLabel ? <span className="sr-only">{loadingLabel}</span> : null}
    </>
  )

  if (props.href !== undefined) {
    return (
      <a href={props.href} hrefLang={props.hrefLang} aria-label={label} className={classes}>
        {content}
      </a>
    )
  }
  return (
    <button
      type={props.type ?? 'button'}
      name={props.name}
      value={props.value}
      form={props.form}
      onClick={props.onClick}
      disabled={props.disabled || loading}
      aria-busy={loading || undefined}
      aria-label={label}
      className={classes}
    >
      {content}
    </button>
  )
}
