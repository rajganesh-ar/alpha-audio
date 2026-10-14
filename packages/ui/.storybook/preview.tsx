import type { Decorator, Preview } from '@storybook/react-vite'
import './preview.css'

type Direction = 'ltr' | 'rtl'

/**
 * Direction comes from a story's `parameters.direction` (the RTL stories) or the toolbar.
 * It is set on <html>, as the app does, with the matching language so axe and the browser
 * see a real Arabic or English document.
 */
const withDirection: Decorator = (Story, context) => {
  const dir: Direction =
    (context.parameters['direction'] as Direction | undefined) ??
    (context.globals['direction'] as Direction)
  document.documentElement.dir = dir
  document.documentElement.lang = dir === 'rtl' ? 'ar' : 'en'
  return Story()
}

const preview: Preview = {
  decorators: [withDirection],
  globalTypes: {
    direction: {
      description: 'Text direction and language',
      toolbar: {
        title: 'Direction',
        icon: 'transfer',
        items: [
          { value: 'ltr', title: 'LTR · English' },
          { value: 'rtl', title: 'RTL · العربية' },
        ],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: { direction: 'ltr' },
  parameters: {
    layout: 'padded',
    a11y: { test: 'error' },
    controls: { expanded: true },
  },
}

export default preview
