import type { TransferStatus, TransferType } from '../types/transfer.types';

export const TRANSFER_STATUS_CONFIG: Record<TransferStatus, {
  label: string;
  variant: 'neutral' | 'warning' | 'info' | 'success' | 'danger';
  stepOrder: number;
  description: string;
}> = {
  draft: {
    label: 'مسودة جارية (Draft)',
    variant: 'neutral',
    stepOrder: 1,
    description: 'تم إنشاء المسودة ولم ترفع للاعتماد بعد'
  },
  pending_approval: {
    label: 'بانتظار الاعتماد (Pending Approval)',
    variant: 'warning',
    stepOrder: 2,
    description: 'طلب حركة مخزنية في انتظار موافقة إدارة العمليات'
  },
  approved: {
    label: 'معتمد من الإدارة (Approved)',
    variant: 'info',
    stepOrder: 3,
    description: 'تم اعتماد الحركة وتجهيزها للشحن والصرف'
  },
  shipped: {
    label: 'قيد التوصيل (Shipped)',
    variant: 'info',
    stepOrder: 4,
    description: 'تم شحن الكميات وحصمها من المستودع المصدر وفي طريقها للجهة الطالبة'
  },
  confirmed: {
    label: 'مكتمل ومؤكد (Completed)',
    variant: 'success',
    stepOrder: 5,
    description: 'تم استلام الشحنة بنجاح وإغلاق حركة المخزون'
  },
  cancelled: {
    label: 'ملغي (Cancelled)',
    variant: 'danger',
    stepOrder: -1,
    description: 'تم إلغاء مستند الحركة المخزنية'
  }
};

export const TRANSFER_TYPES_CONFIG: Record<TransferType, {
  label: string;
  requiresDestination: boolean;
  desc: string;
}> = {
  internal_transfer: {
    label: 'تحويل بين مستودعات (Internal Transfer)',
    requiresDestination: true,
    desc: 'نقل كميات بين مستودعين مع دورة اعتماد وتأكيد استلام'
  },
  consumption: {
    label: 'استهلاك تشغيلي (Consumption)',
    requiresDestination: false,
    desc: 'استهلاك فوري ومباشر للمواد في القسم أو الفرع'
  },
  return: {
    label: 'مرتجع للمخزن الرئيسي (Return)',
    requiresDestination: true,
    desc: 'إعادة مواد غير مستعملة للمستودع الرئيسي'
  },
  damage: {
    label: 'تلف أصل / مواد (Damage)',
    requiresDestination: false,
    desc: 'إثبات تلف أصول أو كميات مخزنية غير صالحة للاستخدام'
  },
  waste: {
    label: 'هدر تشغيلي (Waste)',
    requiresDestination: false,
    desc: 'توثيق نسبة الهدر اليومي في أقسام التشغيل والطهي'
  },
  disposal: {
    label: 'تخريد واستبعاد (Disposal)',
    requiresDestination: false,
    desc: 'إعدام واستبعاد مخزني رسمي'
  }
};

export const TRANSFER_PERMISSIONS = {
  CREATE_DRAFT: 'create_draft',
  SUBMIT_APPROVAL: 'submit_approval',
  APPROVE_TRANSFER: 'approve_transfer',
  DISPATCH_TRANSFER: 'dispatch_transfer',
  RECEIVE_TRANSFER: 'receive_transfer',
  CANCEL_TRANSFER: 'cancel_transfer',
  CONFIRM_TRANSFER: 'confirm_transfer',
  VIEW_REPORTS: 'view_reports'
} as const;
