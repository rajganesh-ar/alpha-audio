import type { Meta, StoryObj } from '@storybook/react-vite'
import type { Translate } from '../../i18n'
import { ar, en, RTL } from '../../stories/copy'
import { footerGroups, marketOptions, nav, quietActions } from '../../stories/shell'
import { AnnouncementBar } from '../AnnouncementBar/AnnouncementBar'
import { Button } from '../Button/Button'
import { EmptyState } from '../EmptyState/EmptyState'
import { ErrorState } from '../ErrorState/ErrorState'
import { Footer } from '../Footer/Footer'
import { Header } from '../Header/Header'
import { MarketSwitch } from '../MarketSwitch/MarketSwitch'
import { QuietActions } from '../QuietActions/QuietActions'
import { Skeleton } from '../Skeleton/Skeleton'
import { AppShell } from './AppShell'

function shell(t: Translate, locale: 'en' | 'ar') {
  return {
    skipToContentLabel: t('shell.skipToContent'),
    announcement: <AnnouncementBar>{t('announcement.preview')}</AnnouncementBar>,
    header: (
      <Header
        homeHref={`/ae/${locale}/`}
        brand={t('shell.brand')}
        homeLabel={t('shell.homeLink')}
        navLabel={t('shell.primaryNav')}
        nav={nav(t, locale)}
        actions={
          <>
            <QuietActions label={t('ui.quietActions')} actions={quietActions(t, locale)} />
            <MarketSwitch
              label={t('marketSwitch.label')}
              currentLabel={marketOptions(locale).find((o) => o.current)?.label ?? ''}
              options={marketOptions(locale)}
            />
          </>
        }
      />
    ),
    footer: (
      <Footer
        copyright={t('footer.copyright', { year: 2026 })}
        pricing={t('footer.pricing', { currency: 'AED', vat: 5 })}
        groups={footerGroups(t, locale)}
      />
    ),
  }
}

const meta = {
  title: 'Shell/AppShell',
  component: AppShell,
  args: { ...shell(en, 'en'), children: null },
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof AppShell>
export default meta
type Story = StoryObj<typeof meta>

const Home = ({ t, market }: { t: Translate; market: string }) => (
  <>
    <h1 className="font-display text-4xl font-bold font-stretch-expanded">
      {t('home.title', { market })}
    </h1>
    <p className="mt-4 text-lg text-ink-muted">{t('home.lede')}</p>
  </>
)

export const Default: Story = { args: { children: <Home t={en} market="United Arab Emirates" /> } }

export const Loading: Story = {
  args: {
    children: (
      <div aria-busy="true" className="flex flex-col gap-4">
        <Skeleton shape="block" className="h-12 w-2/3 rounded-control" />
        <Skeleton lines={3} />
        <span className="sr-only">{en('ui.loading')}</span>
      </div>
    ),
  },
}

export const Empty: Story = {
  args: { children: <EmptyState title={en('ui.emptyTitle')} body={en('ui.emptyBody')} /> },
}

export const Error: Story = {
  args: {
    children: (
      <ErrorState
        title={en('ui.errorTitle')}
        body={en('ui.errorBody')}
        action={
          <Button variant="secondary" tone="critical">
            {en('ui.retry')}
          </Button>
        }
      />
    ),
  },
}

export const Rtl: Story = {
  name: 'RTL',
  parameters: RTL,
  args: { ...shell(ar, 'ar'), children: <Home t={ar} market="الإمارات العربية المتحدة" /> },
}
