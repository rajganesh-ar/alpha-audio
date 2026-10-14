import type { Meta, StoryObj } from '@storybook/react-vite'
import { ar, en, RTL } from '../../stories/copy'
import { Hero } from './Hero'

/** Stands in for the poster `next/image` the app passes. */
const Poster = ({ label }: { label: string }) => (
  <div
    role="img"
    aria-label={label}
    className="size-full bg-linear-to-br from-graphite via-lacquer to-bronze"
  />
)

const meta = {
  title: 'Layout/Hero',
  component: Hero,
  args: {
    eyebrow: 'Alpha Audio',
    headline: 'Sound, engineered for the room you live in',
    lede: 'Hi-fi, home cinema and custom installation across the Gulf.',
    cta: { label: en('design.tools.advisor'), href: '#' },
    media: <Poster label="Listening room with floor-standing speakers" />,
  },
} satisfies Meta<typeof Hero>
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Loading: Story = { args: { loading: true, loadingLabel: en('ui.loading') } }

/** No poster: the copy on the plain lacquer band. */
export const Empty: Story = {
  args: { media: undefined, eyebrow: undefined, lede: undefined, cta: undefined },
}

export const Error: Story = { args: { error: en('ui.errorBody') } }

export const Rtl: Story = {
  name: 'RTL',
  parameters: RTL,
  args: {
    eyebrow: 'ألفا أوديو',
    headline: 'صوت مصمم للغرفة التي تعيش فيها',
    lede: ar('home.lede'),
    cta: { label: ar('design.tools.advisor'), href: '#' },
    media: <Poster label="غرفة استماع بمكبرات صوت أرضية" />,
  },
}
