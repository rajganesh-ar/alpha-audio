/**
 * Starting copy for the four legal pages (docs/tasks/0011). DRAFT FOR LEGAL REVIEW: written to
 * give the storefront real structure, not as advice; every page says so in its first paragraph
 * until Alpha Audio's counsel replaces it and sets "last reviewed". Arabic is a draft for the
 * native reviewer as well.
 */
export interface LegalCopy {
  slug: 'terms' | 'privacy' | 'returns' | 'warranty'
  title: { en: string; ar: string }
  summary: { en: string; ar: string }
  sections: { en: Section[]; ar: Section[] }
}
type Section = { heading?: string; paragraphs: string[] }

const draftEn =
  'This page is a draft pending review by Alpha Audio’s legal team. It will be replaced before the store opens.'
const draftAr =
  'هذه الصفحة مسودة بانتظار مراجعة الفريق القانوني لألفا أوديو، وسيتم استبدالها قبل افتتاح المتجر.'

export const LEGAL_PAGES: LegalCopy[] = [
  {
    slug: 'terms',
    title: { en: 'Terms of sale', ar: 'شروط البيع' },
    summary: {
      en: 'How buying from Alpha Audio online works: prices, payment, delivery and cancellation.',
      ar: 'كيف يتم الشراء من ألفا أوديو عبر الإنترنت: الأسعار والدفع والتوصيل والإلغاء.',
    },
    sections: {
      en: [
        { paragraphs: [draftEn] },
        {
          heading: 'Prices',
          paragraphs: [
            'Prices are shown in the currency of the market you are shopping in and include VAT at the rate that applies there. The price you pay is the one shown at checkout.',
          ],
        },
        {
          heading: 'Payment',
          paragraphs: [
            'Your order is confirmed once the payment is captured. We hold the products in your order for you for 15 minutes while you pay.',
          ],
        },
        {
          heading: 'Delivery',
          paragraphs: [
            'We deliver to addresses in the market you ordered in. We email you when your order ships, with the courier and tracking number.',
          ],
        },
        {
          heading: 'Cancellation',
          paragraphs: [
            'You can ask us to cancel an order until it has shipped. We refund the full amount to your original payment method.',
          ],
        },
      ],
      ar: [
        { paragraphs: [draftAr] },
        {
          heading: 'الأسعار',
          paragraphs: [
            'تُعرض الأسعار بعملة السوق الذي تتسوق فيه وتشمل ضريبة القيمة المضافة بالنسبة المطبقة فيه. السعر الذي تدفعه هو المعروض عند إتمام الشراء.',
          ],
        },
        {
          heading: 'الدفع',
          paragraphs: [
            'يتأكد طلبك بمجرد تحصيل المبلغ. نحجز المنتجات في طلبك لمدة 15 دقيقة أثناء الدفع.',
          ],
        },
        {
          heading: 'التوصيل',
          paragraphs: [
            'نوصل إلى العناوين في السوق الذي طلبت منه. نرسل إليك رسالة عند شحن طلبك مع اسم شركة الشحن ورقم التتبع.',
          ],
        },
        {
          heading: 'الإلغاء',
          paragraphs: [
            'يمكنك طلب إلغاء الطلب ما لم يُشحن بعد. نعيد المبلغ كاملًا إلى وسيلة الدفع الأصلية.',
          ],
        },
      ],
    },
  },
  {
    slug: 'privacy',
    title: { en: 'Privacy notice', ar: 'إشعار الخصوصية' },
    summary: {
      en: 'What personal data we collect when you shop with us, why, and your rights over it.',
      ar: 'ما البيانات الشخصية التي نجمعها عند تسوقك معنا، ولماذا، وما حقوقك عليها.',
    },
    sections: {
      en: [
        { paragraphs: [draftEn] },
        {
          heading: 'What we collect',
          paragraphs: [
            'Your name, email address, mobile number and delivery address when you place an order, and the contents of your bag while you shop.',
          ],
        },
        {
          heading: 'Why we use it',
          paragraphs: [
            'To take payment, deliver your order, send you emails about it, and handle returns and warranty claims. We do not sell your data.',
          ],
        },
        {
          heading: 'Your rights',
          paragraphs: [
            'You can ask us for a copy of your data, to correct it, or to delete it where the law allows. Reply to any of our emails to make a request.',
          ],
        },
      ],
      ar: [
        { paragraphs: [draftAr] },
        {
          heading: 'ما الذي نجمعه',
          paragraphs: [
            'اسمك وبريدك الإلكتروني ورقم جوالك وعنوان التوصيل عند تقديم الطلب، ومحتويات حقيبتك أثناء التسوق.',
          ],
        },
        {
          heading: 'لماذا نستخدمها',
          paragraphs: [
            'لتحصيل المبلغ وتوصيل طلبك وإرسال الرسائل بشأنه والتعامل مع طلبات الإرجاع والضمان. لا نبيع بياناتك.',
          ],
        },
        {
          heading: 'حقوقك',
          paragraphs: [
            'يمكنك طلب نسخة من بياناتك أو تصحيحها أو حذفها حيثما يسمح القانون. رد على أي من رسائلنا لتقديم طلبك.',
          ],
        },
      ],
    },
  },
  {
    slug: 'returns',
    title: { en: 'Returns', ar: 'الإرجاع' },
    summary: {
      en: 'How to return a product bought from our online store.',
      ar: 'كيفية إرجاع منتج اشتريته من متجرنا الإلكتروني.',
    },
    sections: {
      en: [
        { paragraphs: [draftEn] },
        {
          heading: 'Before you return',
          paragraphs: [
            'Contact us by replying to your order email with the order number and the reason for the return. We will tell you how to send the product back.',
          ],
        },
        {
          heading: 'Condition',
          paragraphs: [
            'Products should come back complete, with their accessories and packaging, and with serial numbers matching your order.',
          ],
        },
        {
          heading: 'Refunds',
          paragraphs: [
            'Once we have received and checked the product, we refund the amount to your original payment method.',
          ],
        },
      ],
      ar: [
        { paragraphs: [draftAr] },
        {
          heading: 'قبل الإرجاع',
          paragraphs: [
            'تواصل معنا بالرد على رسالة طلبك مع رقم الطلب وسبب الإرجاع، وسنخبرك بطريقة إعادة المنتج.',
          ],
        },
        {
          heading: 'حالة المنتج',
          paragraphs: [
            'يجب أن يعود المنتج كاملًا مع ملحقاته وتغليفه، وبأرقام تسلسلية مطابقة لطلبك.',
          ],
        },
        {
          heading: 'الاسترداد',
          paragraphs: ['بعد استلام المنتج وفحصه نعيد المبلغ إلى وسيلة الدفع الأصلية.'],
        },
      ],
    },
  },
  {
    slug: 'warranty',
    title: { en: 'Warranty', ar: 'الضمان' },
    summary: {
      en: 'The warranty on products bought from Alpha Audio, and how to make a claim.',
      ar: 'الضمان على المنتجات المشتراة من ألفا أوديو وكيفية تقديم مطالبة.',
    },
    sections: {
      en: [
        { paragraphs: [draftEn] },
        {
          heading: 'Cover',
          paragraphs: [
            'Products we sell carry the manufacturer’s warranty for the market you bought them in. The warranty period depends on the brand and is shown on the product page.',
          ],
        },
        {
          heading: 'Making a claim',
          paragraphs: [
            'Reply to your order email with the order number, the product’s serial number and a description of the fault. Keep your order email as proof of purchase.',
          ],
        },
      ],
      ar: [
        { paragraphs: [draftAr] },
        {
          heading: 'التغطية',
          paragraphs: [
            'تحمل المنتجات التي نبيعها ضمان الشركة المصنعة في السوق الذي اشتريتها منه. تختلف مدة الضمان حسب العلامة وتظهر في صفحة المنتج.',
          ],
        },
        {
          heading: 'تقديم مطالبة',
          paragraphs: [
            'رد على رسالة طلبك مع رقم الطلب والرقم التسلسلي للمنتج ووصف للعطل. احتفظ برسالة الطلب كإثبات للشراء.',
          ],
        },
      ],
    },
  },
]
