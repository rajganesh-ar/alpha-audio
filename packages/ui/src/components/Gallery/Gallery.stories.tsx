import type { Meta, StoryObj } from '@storybook/react-vite'
import { ar, en, RTL } from '../../stories/copy'
import { Gallery, type GallerySlide } from './Gallery'

const TONES = [
  'from-aluminium to-aluminium-deep',
  'from-aluminium-deep to-bronze',
  'from-graphite to-lacquer',
]
const slides = (labels: string[]): GallerySlide[] =>
  labels.map((label, i) => ({
    id: `s${i}`,
    media: (
      <div
        role="img"
        aria-label={label}
        className={`absolute inset-0 bg-linear-to-br ${TONES[i % TONES.length] ?? ''}`}
      />
    ),
    thumb: (
      <div
        aria-hidden="true"
        className={`absolute inset-0 bg-linear-to-br ${TONES[i % TONES.length] ?? ''}`}
      />
    ),
  }))

const meta = {
  title: 'Commerce/Gallery',
  component: Gallery,
  args: {
    label: en('product.gallery'),
    thumbnailLabel: en('product.galleryThumb'),
    slides: slides(['Front panel', 'Rear connections', 'In a listening room']),
  },
  decorators: [(Story) => <div className="max-w-xl">{Story()}</div>],
} satisfies Meta<typeof Gallery>
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Loading: Story = { args: { loading: true, loadingLabel: en('ui.loading') } }

export const Empty: Story = { args: { slides: [], emptyLabel: en('product.galleryEmpty') } }

export const Error: Story = { args: { error: en('ui.errorBody') } }

export const Rtl: Story = {
  name: 'RTL',
  parameters: RTL,
  args: {
    label: ar('product.gallery'),
    thumbnailLabel: ar('product.galleryThumb'),
    slides: slides(['الواجهة الأمامية', 'التوصيلات الخلفية', 'في غرفة استماع']),
  },
}
