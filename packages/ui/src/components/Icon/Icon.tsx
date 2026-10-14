import {
  ArrowRight,
  Check,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  Clock,
  Globe,
  Image,
  Info,
  Layers,
  LoaderCircle,
  Ruler,
  Search,
  ShoppingBag,
  Sparkles,
  Truck,
  User,
  X,
  type LucideIcon,
} from 'lucide-react'
import { cx } from '../../lib/cx'

interface IconDefinition {
  glyph: LucideIcon
  /** Points along the reading direction, so it flips in RTL (arrows, chevrons). */
  directional?: boolean | undefined
}

const ICONS = {
  'arrow-forward': { glyph: ArrowRight, directional: true },
  'chevron-forward': { glyph: ChevronRight, directional: true },
  'chevron-down': { glyph: ChevronDown },
  check: { glyph: Check },
  alert: { glyph: CircleAlert },
  clock: { glyph: Clock },
  close: { glyph: X },
  globe: { glyph: Globe },
  image: { glyph: Image },
  info: { glyph: Info },
  layers: { glyph: Layers },
  ruler: { glyph: Ruler },
  sparkles: { glyph: Sparkles },
  spinner: { glyph: LoaderCircle },
  search: { glyph: Search },
  bag: { glyph: ShoppingBag },
  truck: { glyph: Truck },
  user: { glyph: User },
} satisfies Record<string, IconDefinition>

export type IconName = keyof typeof ICONS
export const ICON_NAMES = Object.keys(ICONS) as IconName[]

export interface IconProps {
  name: IconName
  /** Pixel size; 20 by default. */
  size?: 16 | 20 | 24 | 32 | undefined
  /** Accessible name. Without one the icon is decorative and hidden from assistive tech. */
  label?: string | undefined
  className?: string | undefined
}

/**
 * The platform icon set. Components use this instead of inline SVG. Directional icons mirror
 * in RTL (`rtl:-scale-x-100`); everything else (logos, media controls, numerals) never does.
 */
export function Icon({ name, size = 20, label, className }: IconProps) {
  const { glyph: Glyph, directional } = ICONS[name] as IconDefinition
  return (
    <Glyph
      width={size}
      height={size}
      strokeWidth={1.75}
      focusable={false}
      aria-hidden={label ? undefined : true}
      aria-label={label}
      role={label ? 'img' : undefined}
      className={cx(
        'inline-block shrink-0',
        directional && 'rtl:-scale-x-100',
        name === 'spinner' && 'motion-safe:animate-spin',
        className,
      )}
      data-icon={name}
    />
  )
}
