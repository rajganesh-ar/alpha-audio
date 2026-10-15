import type { OrderNotificationTemplate } from '@alpha/core'
import type { LocaleCode } from '../markets/codes'

/**
 * Customer email copy (docs/tasks/0010). Arabic is a draft for the native reviewer, like the
 * storefront dictionary; nothing here is machine-translated for publication.
 */
export interface EmailCopy {
  subject: string
  heading: string
  body: string
}

export interface EmailMessages {
  status: 'published' | 'draft'
  greeting: string
  orderNumber: string
  view: string
  lines: string
  subtotal: string
  delivery: string
  deliveryFree: string
  vat: string
  total: string
  courier: string
  tracking: string
  track: string
  footer: string
  templates: Record<OrderNotificationTemplate, EmailCopy>
  signIn: EmailCopy & { action: string; ignore: string }
}

export const EMAIL_MESSAGES: Record<LocaleCode, EmailMessages> = {
  en: {
    status: 'published',
    greeting: 'Hello {name},',
    orderNumber: 'Order number',
    view: 'View your order',
    lines: 'Your order',
    subtotal: 'Subtotal',
    delivery: 'Delivery',
    deliveryFree: 'Free',
    vat: 'Includes VAT',
    total: 'Total',
    courier: 'Courier',
    tracking: 'Tracking number',
    track: 'Track the parcel',
    footer: 'Alpha Audio. Reply to this email if you need help with your order.',
    signIn: {
      subject: 'Your Alpha Audio sign-in link',
      heading: 'Sign in to My Alpha',
      body: 'Use this link to sign in. It works once, for the next 15 minutes.',
      action: 'Sign in',
      ignore:
        'If you did not ask to sign in, ignore this email: nobody can sign in without the link.',
    },
    templates: {
      'order-confirmed': {
        subject: 'Order {number} confirmed',
        heading: 'Thank you, your order is confirmed',
        body: 'We have your payment and are preparing your order. We will email you when it ships.',
      },
      'order-shipped': {
        subject: 'Order {number} is on its way',
        heading: 'Your order is on its way',
        body: 'Your order has left our warehouse with the courier below.',
      },
      'order-delivered': {
        subject: 'Order {number} delivered',
        heading: 'Your order has been delivered',
        body: 'We hope you enjoy it. Keep this email: it is your record of purchase.',
      },
      'order-cancelled': {
        subject: 'Order {number} cancelled',
        heading: 'Your order has been cancelled',
        body: 'We have cancelled this order and are refunding the full amount to your original payment method. Refunds can take a few working days to appear.',
      },
    },
  },
  ar: {
    status: 'draft',
    greeting: 'مرحبًا {name}،',
    orderNumber: 'رقم الطلب',
    view: 'عرض طلبك',
    lines: 'طلبك',
    subtotal: 'المجموع الفرعي',
    delivery: 'التوصيل',
    deliveryFree: 'مجاني',
    vat: 'يشمل ضريبة القيمة المضافة',
    total: 'الإجمالي',
    courier: 'شركة الشحن',
    tracking: 'رقم التتبع',
    track: 'تتبع الشحنة',
    footer: 'ألفا أوديو. رد على هذه الرسالة إذا احتجت إلى مساعدة في طلبك.',
    signIn: {
      subject: 'رابط تسجيل الدخول إلى ألفا أوديو',
      heading: 'سجّل الدخول إلى ماي ألفا',
      body: 'استخدم هذا الرابط لتسجيل الدخول. يعمل مرة واحدة خلال الدقائق الخمس عشرة القادمة.',
      action: 'تسجيل الدخول',
      ignore: 'إذا لم تطلب تسجيل الدخول فتجاهل هذه الرسالة: لا يمكن لأحد الدخول دون الرابط.',
    },
    templates: {
      'order-confirmed': {
        subject: 'تم تأكيد الطلب {number}',
        heading: 'شكرًا لك، تم تأكيد طلبك',
        body: 'استلمنا الدفع ونجهز طلبك الآن. سنرسل إليك رسالة عند شحنه.',
      },
      'order-shipped': {
        subject: 'الطلب {number} في الطريق إليك',
        heading: 'طلبك في الطريق إليك',
        body: 'غادر طلبك مستودعنا مع شركة الشحن المذكورة أدناه.',
      },
      'order-delivered': {
        subject: 'تم توصيل الطلب {number}',
        heading: 'تم توصيل طلبك',
        body: 'نتمنى أن ينال إعجابك. احتفظ بهذه الرسالة فهي إثبات الشراء.',
      },
      'order-cancelled': {
        subject: 'تم إلغاء الطلب {number}',
        heading: 'تم إلغاء طلبك',
        body: 'ألغينا هذا الطلب ونعيد المبلغ كاملًا إلى وسيلة الدفع الأصلية. قد يستغرق ظهور المبلغ بضعة أيام عمل.',
      },
    },
  },
}
