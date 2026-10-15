import type { ProductShape } from './placeholderImages'

/**
 * Demo catalogue for local development (seed:catalog). Prices are illustrative and the specs
 * indicative; nothing here is published anywhere. Arabic copy is a draft for the native
 * reviewer (`arabicReview: draft`), never machine-published.
 */

export interface DemoText {
  en: string
  ar: string
}

export interface DemoCategory {
  slug: string
  title: DemoText
  summary?: DemoText
  parent?: string
  order: number
  facetSpecs?: Array<'channels' | 'impedanceOhm' | 'sensitivityDb' | 'powerW'>
}

export const CATEGORIES: DemoCategory[] = [
  {
    slug: 'amplifiers',
    order: 10,
    facetSpecs: ['channels', 'powerW'],
    title: { en: 'Amplifiers', ar: 'المضخمات' },
    summary: {
      en: 'Integrated, pre and power amplifiers.',
      ar: 'مضخمات متكاملة ومسبقة ومضخمات قدرة.',
    },
  },
  {
    slug: 'integrated-amplifiers',
    parent: 'amplifiers',
    order: 11,
    title: { en: 'Integrated amplifiers', ar: 'المضخمات المتكاملة' },
  },
  {
    slug: 'power-amplifiers',
    parent: 'amplifiers',
    order: 12,
    title: { en: 'Power amplifiers', ar: 'مضخمات القدرة' },
  },
  {
    slug: 'preamplifiers',
    parent: 'amplifiers',
    order: 13,
    title: { en: 'Preamplifiers', ar: 'المضخمات المسبقة' },
  },
  {
    slug: 'loudspeakers',
    order: 20,
    facetSpecs: ['impedanceOhm', 'sensitivityDb'],
    title: { en: 'Loudspeakers', ar: 'مكبرات الصوت' },
    summary: { en: 'Standmount and floorstanding speakers.', ar: 'مكبرات صوت رفّية وأرضية.' },
  },
  {
    slug: 'standmount-speakers',
    parent: 'loudspeakers',
    order: 21,
    title: { en: 'Standmount speakers', ar: 'مكبرات الصوت الرفّية' },
  },
  {
    slug: 'floorstanding-speakers',
    parent: 'loudspeakers',
    order: 22,
    title: { en: 'Floorstanding speakers', ar: 'مكبرات الصوت الأرضية' },
  },
  {
    slug: 'streaming',
    order: 30,
    title: { en: 'Streaming and sources', ar: 'البث والمصادر' },
    summary: {
      en: 'Network streamers, players and wireless speakers.',
      ar: 'مشغلات البث الشبكي والمشغلات ومكبرات الصوت اللاسلكية.',
    },
  },
  {
    slug: 'home-cinema',
    order: 40,
    title: { en: 'Home cinema', ar: 'السينما المنزلية' },
    summary: { en: 'AV receivers and processors.', ar: 'مستقبلات ومعالجات الصوت والصورة.' },
  },
]

export interface DemoBrand {
  slug: string
  name: string
  priceDisplay: 'show' | 'request'
  story: DemoText
}

export const BRANDS: DemoBrand[] = [
  {
    slug: 'mcintosh',
    name: 'McIntosh',
    priceDisplay: 'show',
    story: {
      en: 'American amplification since 1949, built in Binghamton, New York.',
      ar: 'مضخمات أمريكية منذ عام 1949، تُصنع في بينغهامتون، نيويورك.',
    },
  },
  {
    slug: 'sonus-faber',
    name: 'Sonus faber',
    priceDisplay: 'show',
    story: {
      en: 'Italian loudspeakers, hand-finished in Vicenza.',
      ar: 'مكبرات صوت إيطالية تُشطّب يدويًا في فيتشنزا.',
    },
  },
  {
    slug: 'marantz',
    name: 'Marantz',
    priceDisplay: 'show',
    story: {
      en: 'Musical amplifiers and sources with a long hi-fi heritage.',
      ar: 'مضخمات ومصادر موسيقية بإرث عريق في عالم الصوت عالي الدقة.',
    },
  },
  {
    slug: 'bluesound',
    name: 'Bluesound',
    priceDisplay: 'show',
    story: {
      en: 'High-resolution wireless streaming for the whole home.',
      ar: 'بث لاسلكي عالي الدقة للمنزل بأكمله.',
    },
  },
]

export interface DemoProduct {
  sku: string
  slug: string
  brand: string
  categories: string[]
  shape: ProductShape
  title: DemoText
  summary: DemoText
  specs: Record<string, number | string | Record<string, number>>
  /** Major units incl. VAT per market; omitted markets are not sold. `request` hides the price. */
  prices: Partial<Record<'ae' | 'sa', number | 'request'>>
  alt: DemoText
}

export const PRODUCTS: DemoProduct[] = [
  {
    sku: 'MCINTOSH-MA352',
    slug: 'mcintosh-ma352',
    brand: 'mcintosh',
    categories: ['integrated-amplifiers'],
    shape: 'amp',
    title: { en: 'MA352 integrated amplifier', ar: 'مضخم الصوت المتكامل MA352' },
    summary: {
      en: 'Hybrid vacuum-tube preamplifier with a 200 W solid-state power stage.',
      ar: 'مضخم مسبق هجين بصمامات مفرغة ومرحلة قدرة بقدرة 200 واط.',
    },
    specs: {
      powerW: 200,
      channels: 2,
      impedanceOhm: 8,
      inputs: 'Phono MM, 2 × balanced, 3 × unbalanced',
    },
    prices: { ae: 34_500, sa: 36_900 },
    alt: {
      en: 'MA352 integrated amplifier, front panel with two meters',
      ar: 'مضخم MA352 المتكامل، الواجهة الأمامية مع مؤشرين',
    },
  },
  {
    sku: 'MCINTOSH-MC462',
    slug: 'mcintosh-mc462',
    brand: 'mcintosh',
    categories: ['power-amplifiers'],
    shape: 'amp',
    title: { en: 'MC462 stereo power amplifier', ar: 'مضخم القدرة الستيريو MC462' },
    summary: {
      en: '450 W per channel with output autoformers for any speaker load.',
      ar: 'قدرة 450 واط لكل قناة مع محولات خرج تناسب أي مكبر صوت.',
    },
    specs: { powerW: 450, channels: 2, impedanceOhm: 8 },
    prices: { ae: 52_500, sa: 55_900 },
    alt: {
      en: 'MC462 power amplifier, front panel with two meters',
      ar: 'مضخم القدرة MC462، الواجهة الأمامية مع مؤشرين',
    },
  },
  {
    sku: 'MCINTOSH-C2700',
    slug: 'mcintosh-c2700',
    brand: 'mcintosh',
    categories: ['preamplifiers'],
    shape: 'preamp',
    title: { en: 'C2700 vacuum-tube preamplifier', ar: 'المضخم المسبق بالصمامات C2700' },
    summary: {
      en: 'Tube preamplifier with a built-in DAC and phono stage.',
      ar: 'مضخم مسبق بالصمامات مع محول رقمي تناظري ومرحلة فونو مدمجة.',
    },
    specs: { channels: 2, inputs: 'Phono MM/MC, analogue and digital inputs' },
    prices: { ae: 41_000, sa: 43_500 },
    alt: {
      en: 'C2700 preamplifier, front panel with input and volume controls',
      ar: 'المضخم المسبق C2700، الواجهة الأمامية مع أزرار الإدخال والصوت',
    },
  },
  {
    sku: 'MCINTOSH-MA252',
    slug: 'mcintosh-ma252',
    brand: 'mcintosh',
    categories: ['integrated-amplifiers'],
    shape: 'amp',
    title: { en: 'MA252 hybrid integrated amplifier', ar: 'مضخم الصوت المتكامل الهجين MA252' },
    summary: {
      en: 'Compact hybrid amplifier: tube preamp, 100 W solid-state output.',
      ar: 'مضخم هجين مدمج: مضخم مسبق بالصمامات وخرج بقدرة 100 واط.',
    },
    specs: { powerW: 100, channels: 2, impedanceOhm: 8 },
    prices: { ae: 21_500, sa: 22_900 },
    alt: { en: 'MA252 amplifier, front view', ar: 'مضخم MA252، منظر أمامي' },
  },
  {
    sku: 'SONUSFABER-LUMINA-II',
    slug: 'sonus-faber-lumina-ii',
    brand: 'sonus-faber',
    categories: ['standmount-speakers'],
    shape: 'speaker-stand',
    title: { en: 'Lumina II standmount speakers', ar: 'مكبرات الصوت الرفّية Lumina II' },
    summary: {
      en: 'Two-way standmount pair with a leather-wrapped front baffle.',
      ar: 'زوج مكبرات رفّية ثنائية الاتجاه بواجهة مكسوة بالجلد.',
    },
    specs: { sensitivityDb: 84, impedanceOhm: 4, frequencyLowHz: 55, frequencyHighHz: 25_000 },
    prices: { ae: 7_900, sa: 8_400 },
    alt: { en: 'Pair of Lumina II speakers on stands', ar: 'زوج مكبرات Lumina II على حوامل' },
  },
  {
    sku: 'SONUSFABER-SONETTO-III',
    slug: 'sonus-faber-sonetto-iii',
    brand: 'sonus-faber',
    categories: ['floorstanding-speakers'],
    shape: 'speaker-floor',
    title: { en: 'Sonetto III floorstanding speakers', ar: 'مكبرات الصوت الأرضية Sonetto III' },
    summary: {
      en: 'Three-way floorstander with a lute-shaped cabinet.',
      ar: 'مكبر أرضي ثلاثي الاتجاه بخزانة على شكل العود.',
    },
    specs: { sensitivityDb: 88, impedanceOhm: 6, frequencyLowHz: 42, frequencyHighHz: 25_000 },
    prices: { ae: 18_500, sa: 19_900 },
    alt: {
      en: 'Sonetto III floorstanding speaker, front view',
      ar: 'مكبر الصوت الأرضي Sonetto III، منظر أمامي',
    },
  },
  {
    sku: 'SONUSFABER-OLYMPICA-NOVA-V',
    slug: 'sonus-faber-olympica-nova-v',
    brand: 'sonus-faber',
    categories: ['floorstanding-speakers'],
    shape: 'speaker-floor',
    title: {
      en: 'Olympica Nova V floorstanding speakers',
      ar: 'مكبرات الصوت الأرضية Olympica Nova V',
    },
    summary: {
      en: 'Flagship of the Olympica line; priced per room and finish.',
      ar: 'أرقى طرازات سلسلة Olympica؛ يُسعّر حسب الغرفة واللمسة النهائية.',
    },
    specs: { sensitivityDb: 90, impedanceOhm: 4, frequencyLowHz: 32, frequencyHighHz: 35_000 },
    prices: { ae: 'request', sa: 'request' },
    alt: {
      en: 'Olympica Nova V speaker, front view',
      ar: 'مكبر الصوت Olympica Nova V، منظر أمامي',
    },
  },
  {
    sku: 'MARANTZ-MODEL-40N',
    slug: 'marantz-model-40n',
    brand: 'marantz',
    categories: ['integrated-amplifiers', 'streaming'],
    shape: 'amp',
    title: { en: 'Model 40n streaming amplifier', ar: 'مضخم البث Model 40n' },
    summary: {
      en: 'Integrated amplifier with streaming, HDMI eARC and a phono stage.',
      ar: 'مضخم متكامل مع البث وHDMI eARC ومرحلة فونو.',
    },
    specs: {
      powerW: 70,
      channels: 2,
      impedanceOhm: 8,
      inputs: 'HDMI eARC, phono MM, optical, coaxial, network',
    },
    prices: { ae: 12_900, sa: 13_800 },
    alt: { en: 'Model 40n amplifier, front view', ar: 'مضخم Model 40n، منظر أمامي' },
  },
  {
    sku: 'MARANTZ-SACD-30N',
    slug: 'marantz-sacd-30n',
    brand: 'marantz',
    categories: ['streaming'],
    shape: 'source',
    title: { en: 'SACD 30n network disc player', ar: 'مشغل الأقراص والبث SACD 30n' },
    summary: {
      en: 'Plays SACD and CD, streams, and works as a USB DAC.',
      ar: 'يشغّل أقراص SACD وCD ويبث ويعمل كمحول رقمي عبر USB.',
    },
    specs: { inputs: 'USB, coaxial, optical, network' },
    prices: { ae: 7_900, sa: 8_400 },
    alt: {
      en: 'SACD 30n player, front view with disc tray',
      ar: 'مشغل SACD 30n، منظر أمامي مع درج الأقراص',
    },
  },
  {
    sku: 'MARANTZ-CINEMA-50',
    slug: 'marantz-cinema-50',
    brand: 'marantz',
    categories: ['home-cinema'],
    shape: 'receiver',
    title: { en: 'Cinema 50 AV receiver', ar: 'مستقبل الصوت والصورة Cinema 50' },
    summary: {
      en: '9.4-channel receiver for immersive home cinema.',
      ar: 'مستقبل بـ 9.4 قنوات لسينما منزلية غامرة.',
    },
    specs: { powerW: 110, channels: 9 },
    // Saudi Arabia only: the UAE page 404s with the market switcher (task 0006).
    prices: { sa: 11_500 },
    alt: {
      en: 'Cinema 50 receiver, front view with display',
      ar: 'مستقبل Cinema 50، منظر أمامي مع الشاشة',
    },
  },
  {
    sku: 'BLUESOUND-NODE',
    slug: 'bluesound-node',
    brand: 'bluesound',
    categories: ['streaming'],
    shape: 'streamer',
    title: { en: 'Node wireless music streamer', ar: 'مشغل البث اللاسلكي Node' },
    summary: {
      en: 'Adds hi-res streaming to any system.',
      ar: 'يضيف البث عالي الدقة إلى أي نظام.',
    },
    specs: { inputs: 'Optical/analogue in, HDMI eARC, USB' },
    prices: { ae: 2_399, sa: 2_549 },
    alt: { en: 'Node streamer, top view', ar: 'مشغل Node، منظر علوي' },
  },
  {
    sku: 'BLUESOUND-PULSE-M',
    slug: 'bluesound-pulse-m',
    brand: 'bluesound',
    categories: ['streaming'],
    shape: 'wireless',
    title: { en: 'Pulse M wireless speaker', ar: 'مكبر الصوت اللاسلكي Pulse M' },
    summary: {
      en: 'Compact omnidirectional speaker for multi-room listening.',
      ar: 'مكبر صوت مدمج متعدد الاتجاهات للاستماع في عدة غرف.',
    },
    specs: {},
    prices: { ae: 2_099, sa: 2_249 },
    alt: { en: 'Pulse M wireless speaker', ar: 'مكبر الصوت اللاسلكي Pulse M' },
  },
]

/** Opening stock booked through the ledger when the demo warehouse exists (seed:inventory). */
export const OPENING_STOCK: Record<string, number> = {
  'MCINTOSH-MA252': 4,
  'SONUSFABER-LUMINA-II': 6,
  'SONUSFABER-SONETTO-III': 2,
  'MARANTZ-MODEL-40N': 5,
  'BLUESOUND-NODE': 12,
}

export const HOME = {
  hero: {
    eyebrow: { en: 'Alpha Audio', ar: 'ألفا أوديو' },
    headline: {
      en: 'Sound, engineered for the room you live in',
      ar: 'صوت مصمم للغرفة التي تعيش فيها',
    },
    lede: {
      en: 'Hi-fi, home cinema and custom installation across the Gulf, chosen with you and set up in your room.',
      ar: 'أنظمة الصوت عالية الدقة والسينما المنزلية والتركيب حسب الطلب في أنحاء الخليج، نختارها معك ونجهزها في غرفتك.',
    },
    ctaLabel: { en: 'Ask the Advisor', ar: 'اسأل المستشار' },
    ctaHref: '/design/advisor',
    alt: {
      en: 'A dark listening room with a pair of floorstanding speakers',
      ar: 'غرفة استماع داكنة مع زوج من مكبرات الصوت الأرضية',
    },
  },
  entryCards: [
    {
      tool: 'advisor',
      title: { en: 'AI Advisor', ar: 'المستشار الذكي' },
      body: {
        en: 'Tell us about your room and how you listen. Get a shortlist with reasons.',
        ar: 'أخبرنا عن غرفتك وطريقة استماعك، واحصل على قائمة مختصرة مع الأسباب.',
      },
      ctaLabel: { en: 'Start a conversation', ar: 'ابدأ المحادثة' },
    },
    {
      tool: 'room-lab',
      title: { en: 'Room Lab', ar: 'مختبر الغرفة' },
      body: {
        en: 'Model your room’s acoustics before you buy a single speaker.',
        ar: 'احسب صوتيات غرفتك قبل أن تشتري أي مكبر صوت.',
      },
      ctaLabel: { en: 'Open Room Lab', ar: 'افتح مختبر الغرفة' },
    },
    {
      tool: 'builder',
      title: { en: 'System Builder', ar: 'منشئ الأنظمة' },
      body: {
        en: 'Choose components step by step, with compatibility checked as you go.',
        ar: 'اختر المكونات خطوة بخطوة مع التحقق من التوافق أولًا بأول.',
      },
      ctaLabel: { en: 'Build a system', ar: 'ابنِ نظامك' },
    },
  ],
  featuredTitle: { en: 'Featured this season', ar: 'مختارات هذا الموسم' },
  categoriesTitle: { en: 'Shop by category', ar: 'تسوّق حسب الفئة' },
  featured: [
    'MCINTOSH-MA352',
    'MCINTOSH-MC462',
    'SONUSFABER-LUMINA-II',
    'SONUSFABER-SONETTO-III',
    'MARANTZ-MODEL-40N',
    'BLUESOUND-NODE',
    'SONUSFABER-OLYMPICA-NOVA-V',
    'MCINTOSH-MA252',
  ],
  topCategories: ['amplifiers', 'loudspeakers', 'streaming'],
  seo: {
    title: {
      en: 'Alpha Audio: hi-fi, home cinema and installation',
      ar: 'ألفا أوديو: صوت عالي الدقة وسينما منزلية وتركيب',
    },
    description: {
      en: 'Hi-fi, home cinema and custom installation across the Gulf, with prices including VAT and live stock.',
      ar: 'أنظمة صوت عالية الدقة وسينما منزلية وتركيب حسب الطلب في أنحاء الخليج، بأسعار شاملة الضريبة ومخزون محدّث.',
    },
  },
} as const

/**
 * Brand rights (BrandAgreements). Bluesound's UAE agreement ended on 30 June 2026, so its
 * products are hidden in the UAE storefront though they stay published: the brand-rights rule
 * from task 0008, visible in the demo.
 */
export const AGREEMENTS: Array<{
  brand: string
  market: 'ae' | 'sa'
  role: 'distributor' | 'retailer'
  exclusive: boolean
  validFrom: string
  validTo?: string
  flags?: Array<'arabic-labelling' | 'wireless-type-approval'>
}> = [
  {
    brand: 'mcintosh',
    market: 'ae',
    role: 'distributor',
    exclusive: true,
    validFrom: '2024-01-01',
  },
  {
    brand: 'mcintosh',
    market: 'sa',
    role: 'distributor',
    exclusive: false,
    validFrom: '2025-07-01',
  },
  {
    brand: 'sonus-faber',
    market: 'ae',
    role: 'distributor',
    exclusive: true,
    validFrom: '2024-01-01',
  },
  {
    brand: 'sonus-faber',
    market: 'sa',
    role: 'retailer',
    exclusive: false,
    validFrom: '2025-07-01',
    flags: ['arabic-labelling'],
  },
  { brand: 'marantz', market: 'ae', role: 'retailer', exclusive: false, validFrom: '2024-06-01' },
  { brand: 'marantz', market: 'sa', role: 'distributor', exclusive: true, validFrom: '2025-07-01' },
  {
    brand: 'bluesound',
    market: 'ae',
    role: 'retailer',
    exclusive: false,
    validFrom: '2024-01-01',
    validTo: '2026-06-30',
    flags: ['wireless-type-approval'],
  },
  {
    brand: 'bluesound',
    market: 'sa',
    role: 'retailer',
    exclusive: false,
    validFrom: '2025-07-01',
    flags: ['wireless-type-approval'],
  },
]
