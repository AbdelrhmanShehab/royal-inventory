import React, { useEffect, useState } from 'react';
import { Shield, Save, RefreshCw, HelpCircle, Check, AlertCircle } from 'lucide-react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Loader from '../../components/ui/Loader';
import { permissionsApi } from '../../api/permissions.api';
import type { PermissionUpdates } from '../../api/permissions.api';

// Roles mapping
const ROLES = [
  { key: 'admin', label: 'المدير العام', desc: 'صلاحيات كاملة وغير محدودة للنظام' },
  { key: 'manager', label: 'مدير العمليات', desc: 'إشراف كامل واعتماد حركات كافة الفروع' },
  { key: 'warehouse_manager', label: 'مدير مستودع', desc: 'إدارة مخازن معينة ومتابعة الشحنات والتحويلات' },
  { key: 'warehouse_head', label: 'أمين مستودع', desc: 'عمليات الشحن والاستلام والتحويل والصرف' },
  { key: 'accountant', label: 'محاسب', desc: 'الاطلاع على حركة المخزون والتقارير المالية' },
  { key: 'staff', label: 'موظف تشغيل', desc: 'صرف واستهلاك مباشر للمواد في الفرع' }
];

// Permission Keys mapping with Arabic labels and descriptions
const PERMISSIONS = [
  { key: 'create_draft', label: 'إنشاء مسودة حركة', desc: 'بدء وتعبئة تفاصيل شحنة أو تحويل مخزني وحفظها كمسودة' },
  { key: 'submit_approval', label: 'تقديم طلب للاعتماد', desc: 'رفع مسودات التحركات إلى إدارة العمليات للموافقة عليها' },
  { key: 'approve_transfer', label: 'اعتماد حركات المخزون', desc: 'الموافقة أو الرفض لطلبات وعهد التموين والتحويل' },
  { key: 'dispatch_transfer', label: 'شحن وصرف المواد', desc: 'تأكيد خروج وشحن البضائع والكميات المعتمدة من مستودع المصدر' },
  { key: 'receive_transfer', label: 'استلام وتأكيد الشحنات', desc: 'تأكيد وصول وفحص المواد وإضافتها لعهدة مستودع الهدف' },
  { key: 'cancel_transfer', label: 'إلغاء حركات المخزون', desc: 'إلغاء ووقف التحويلات الجارية في أي مرحلة قبل الاكتمال' },
  { key: 'confirm_transfer', label: 'تنفيذ الحركات المباشرة', desc: 'تنفيذ العمليات المباشرة كالهدر والتلف والإهلاك دون دورة اعتماد' },
  { key: 'quick_consume', label: 'استهلاك سريع للأقسام', desc: 'تثبيت استهلاك المواد اليومي للبارات والمطابخ والوحدات' },
  { key: 'view_all_nodes', label: 'عرض كافة الفروع', desc: 'الاطلاع على مستودعات ومخازن المؤسسة كاملة بالهيكل التنظيمي' },
  { key: 'manage_nodes', label: 'إدارة مستودعات الهيكل', desc: 'إنشاء وتعديل وحذف مستودعات وفروع ونقاط البيع' },
  { key: 'manage_users', label: 'إدارة حسابات المستخدمين', desc: 'إنشاء وتعديل صلاحيات ومواقع موظفي النظام' },
  { key: 'run_sync', label: 'مزامنة ERP', desc: 'تشغيل المزامنة اليدوية للأصناف والعهدة مع نظام COMSYS ERP' },
  { key: 'view_reports', label: 'استعراض التقارير والنواقص', desc: 'تتبع مستويات الطلب وتنبيهات النواقص وتصدير التقارير' },
  { key: 'manage_permissions', label: 'إدارة أدوار وصلاحيات النظام', desc: 'تعديل جدول الصلاحيات الحالي وتوزيعه على الأدوار' },
  // Laundry Permissions
  { key: 'view_laundry', label: 'مشاهدة المغسلة (عرض فقط)', desc: 'الاطلاع على لوحة تحكم ودورات وتقارير المغسلة دون صلاحيات تعديل أو إضافة' },
  { key: 'manage_laundry_operations', label: 'إدارة عمليات ومدخلات المغسلة', desc: 'صلاحية بدء دورات الغسيل، إضافة الأوزان، تعديل الدوزنات، وتصميم الوصفات والبرامج كلياً' },
  { key: 'receive_laundry_items', label: 'استلام شحنات البياضات للمغسلة', desc: 'صلاحية تأكيد فحص واستلام شحنات البياضات المتسخة وتأكيد مطابقتها وتوثيق فروقات الاستلام' },
  { key: 'view_laundry_pos', label: 'عرض مبيعات ونقاط بيع المغسلة', desc: 'الاطلاع على حركة ومبيعات مغسلة النزلاء والموظفين ومزامنة فواتير كومسيس التابعة للمغسلة' }
];

export const RolesPermissionsPage: React.FC = () => {
  const [matrix, setMatrix] = useState<Record<string, Record<string, boolean>>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pendingChanges, setPendingChanges] = useState<PermissionUpdates[]>([]);

  const fetchMatrix = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await permissionsApi.getMatrix();
      setMatrix(data || {});
      setPendingChanges([]);
    } catch (err: any) {
      console.error(err);
      setError('فشل في تحميل مصفوفة الصلاحيات من الخادم. تأكد من صلاحيات حسابك.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMatrix();
  }, []);

  const handleToggle = (role: string, permKey: string) => {
    // Prevent removing manage_permissions from admin to avoid lockout
    if (role === 'admin' && permKey === 'manage_permissions') {
      setError('أمن النظام: لا يمكن إلغاء صلاحية إدارة الصلاحيات للرئيس العام لتجنب الإغلاق الذاتي.');
      setTimeout(() => setError(null), 5000);
      return;
    }

    // Toggle local state
    const isAllowed = !matrix[role]?.[permKey];
    setMatrix(prev => ({
      ...prev,
      [role]: {
        ...prev[role],
        [permKey]: isAllowed
      }
    }));

    // Record pending changes for bulk save
    setPendingChanges(prev => {
      const filtered = prev.filter(c => !(c.role === role && c.permissionKey === permKey));
      return [...filtered, { role, permissionKey: permKey, allowed: isAllowed }];
    });
  };

  const handleSave = async () => {
    if (pendingChanges.length === 0) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await permissionsApi.bulkUpdate(pendingChanges);
      setSuccess(`تم تحديث وحفظ عدد ${pendingChanges.length} صلاحية بنجاح. تم تحديث ذاكرة التخزين المؤقت بالخادم.`);
      setPendingChanges([]);
      setTimeout(() => setSuccess(null), 4000);
    } catch (err: any) {
      console.error(err);
      setError('فشل حفظ الصلاحيات. يرجى التحقق من اتصال الشبكة وصلاحية وصول المسؤول.');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    fetchMatrix();
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center p-8">
        <Loader size="lg" label="جاري تحميل مصفوفة الصلاحيات من قاعدة البيانات..." />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 font-arabic dir-rtl select-none">
      {/* Header section */}
      <div className="bg-white border border-slate-200/80 p-6 rounded-2xl shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-xl lg:text-2xl font-extrabold text-slate-800 flex items-center gap-2">
            <Shield size={24} className="text-blue-600 animate-pulse" />
            إدارة الأدوار وصلاحيات النظام (RBAC)
          </h1>
          <p className="text-xs lg:text-sm text-slate-500 mt-1.5 leading-relaxed">
            التحكم في مستويات الوصول ونطاق الصلاحيات لجميع فئات المستخدمين. التعديلات تنعكس فوراً على مستوى middleware والخادم.
          </p>
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          <Button variant="outline" size="sm" onClick={handleReset} className="w-full md:w-auto">
            <RefreshCw size={14} />
            إعادة تعيين
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleSave}
            disabled={pendingChanges.length === 0 || saving}
            className="w-full md:w-auto gap-2"
          >
            <Save size={14} />
            حفظ التغييرات ({pendingChanges.length})
          </Button>
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div className="bg-red-50 border border-red-100 rounded-xl p-4 flex items-center gap-3 text-xs font-semibold text-red-700 animate-fade-in">
          <AlertCircle size={16} className="text-red-500 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 flex items-center gap-3 text-xs font-semibold text-emerald-700 animate-fade-in">
          <Check size={16} className="text-emerald-500 flex-shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {/* Main Matrix Table */}
      <Card className="border-slate-200/80 overflow-hidden shadow-xs">
        <Card.Body className="p-0">
          <div className="w-full overflow-x-auto">
            <table className="w-full text-right border-collapse">
              <thead className="bg-slate-50/75 border-b border-slate-100 sticky top-0 z-10">
                <tr>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 min-w-[280px]">الصلاحية / الوظيفة التشغيلية</th>
                  {ROLES.map(role => (
                    <th key={role.key} className="px-4 py-4 text-center text-xs font-bold text-slate-700 border-r border-slate-100 min-w-[120px]">
                      <div className="flex flex-col items-center">
                        <span>{role.label}</span>
                        <span className="text-[9px] text-slate-400 font-normal mt-0.5">{role.key}</span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {PERMISSIONS.map((perm) => (
                  <tr key={perm.key} className="hover:bg-slate-50/40 transition-colors duration-150 group">
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                          {perm.label}
                          <div className="relative group/tooltip cursor-pointer">
                            <HelpCircle size={13} className="text-slate-350 hover:text-slate-500" />
                            <span className="absolute right-0 bottom-full mb-1.5 w-64 bg-slate-800 text-white text-[10px] p-2.5 rounded-lg opacity-0 pointer-events-none group-hover/tooltip:opacity-100 transition-opacity duration-200 z-55 text-right font-normal shadow-lg leading-relaxed">
                              {perm.desc}
                            </span>
                          </div>
                        </span>
                        <span className="text-[10px] text-slate-450 mt-1 font-semibold">{perm.key}</span>
                      </div>
                    </td>
                    {ROLES.map((role) => {
                      const isChecked = !!matrix[role.key]?.[perm.key];
                      const isPending = pendingChanges.some(c => c.role === role.key && c.permissionKey === perm.key);

                      return (
                        <td key={role.key} className="px-4 py-4 text-center border-r border-slate-100">
                          <label className="inline-flex items-center justify-center cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => handleToggle(role.key, perm.key)}
                              className="sr-only peer"
                            />
                            <div className={`
                              w-9 h-5 bg-slate-200 rounded-full peer 
                              peer-focus:ring-1 peer-focus:ring-blue-300 
                              peer-checked:after:-translate-x-full 
                              peer-checked:after:border-white after:content-[''] 
                              after:absolute after:top-0.5 after:right-[2px] 
                              after:bg-white after:border-slate-300 after:border 
                              after:rounded-full after:h-4 after:w-4 after:transition-all 
                              peer-checked:bg-blue-600 relative
                              ${isPending ? 'ring-2 ring-amber-400' : ''}
                            `}></div>
                          </label>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card.Body>
      </Card>

      {/* Role Explanations Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2">
        {ROLES.map(role => (
          <div key={role.key} className="bg-white border border-slate-200/60 p-4 rounded-xl shadow-2xs flex gap-3 items-start">
            <div className="w-8 h-8 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-600 font-bold text-xs flex-shrink-0">
              {role.key.substring(0, 2).toUpperCase()}
            </div>
            <div className="flex flex-col text-right">
              <span className="text-xs font-bold text-slate-800">{role.label}</span>
              <span className="text-[10px] text-slate-400 font-semibold mt-0.5">{role.key}</span>
              <p className="text-[10px] text-slate-500 font-normal mt-2 leading-relaxed">{role.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default RolesPermissionsPage;
