import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Shield, Save, HelpCircle, Check, AlertCircle, RotateCcw, X } from 'lucide-react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import permissionsApi from '../../api/permissions.api';
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
  const queryClient = useQueryClient();

  // Page level inline notification states
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Edited Matrix state
  const [editedMatrix, setEditedMatrix] = useState<Record<string, Record<string, boolean>>>({});

  // 1. Fetch Permissions Matrix Query
  const { data: serverMatrix = {}, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['permissions'],
    queryFn: permissionsApi.getMatrix
  });

  // Sync editedMatrix when server data loads or resets
  useEffect(() => {
    if (serverMatrix) {
      setEditedMatrix(JSON.parse(JSON.stringify(serverMatrix)));
    }
  }, [serverMatrix]);

  // Compute pending diff updates array
  const pendingUpdates = useMemo(() => {
    const updates: PermissionUpdates[] = [];
    if (!serverMatrix || !editedMatrix) return updates;

    ROLES.forEach(role => {
      PERMISSIONS.forEach(perm => {
        const origVal = !!serverMatrix[role.key]?.[perm.key];
        const editVal = !!editedMatrix[role.key]?.[perm.key];
        if (origVal !== editVal) {
          updates.push({
            role: role.key,
            permissionKey: perm.key,
            allowed: editVal
          });
        }
      });
    });

    return updates;
  }, [serverMatrix, editedMatrix]);

  const isDirty = pendingUpdates.length > 0;

  // Unsaved changes browser prompt
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = 'لديك تغييرات غير محفوظة في مصفوفة الصلاحيات. هل أنت تأكد من المغادرة؟';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  // 2. Bulk Save Mutation
  const saveMutation = useMutation({
    mutationFn: (updates: PermissionUpdates[]) => permissionsApi.bulkUpdate(updates),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['permissions'] });
      setErrorMsg(null);
      setSuccessMsg(`تم حفظ وتطبيق ${res.updated || pendingUpdates.length} صلاحية بنجاح في قاعدة البيانات وتحديث الذاكرة المؤقتة.`);
      setTimeout(() => setSuccessMsg(null), 6000);
    },
    onError: (err: any) => {
      // Rollback UI matrix state on error
      if (serverMatrix) {
        setEditedMatrix(JSON.parse(JSON.stringify(serverMatrix)));
      }
      setSuccessMsg(null);
      const msg = err.response?.data?.message || err.message || 'فشل حفظ التعديلات على الصلاحيات. يرجى التحقق من اتصال الشبكة وصلاحيات الوصول.';
      setErrorMsg(msg);
    }
  });

  // Toggle single permission state
  const handleToggle = (roleKey: string, permKey: string) => {
    // Lock admin manage_permissions
    if (roleKey === 'admin' && permKey === 'manage_permissions') {
      setErrorMsg('أمن النظام: لا يمكن إلغاء صلاحية إدارة الصلاحيات للمدير العام لتجنب الإغلاق الذاتي.');
      return;
    }

    setErrorMsg(null);
    setEditedMatrix(prev => {
      const currentRoleObj = prev[roleKey] || {};
      const currentVal = !!currentRoleObj[permKey];
      return {
        ...prev,
        [roleKey]: {
          ...currentRoleObj,
          [permKey]: !currentVal
        }
      };
    });
  };

  // Discard local edits
  const handleDiscard = () => {
    if (serverMatrix) {
      setEditedMatrix(JSON.parse(JSON.stringify(serverMatrix)));
      setErrorMsg(null);
      setSuccessMsg('تم إلغاء التعديلات غير المحفوظة وإعادة التعيين للشكل الأصلي.');
      setTimeout(() => setSuccessMsg(null), 4000);
    }
  };

  // Trigger Bulk Save
  const handleSave = () => {
    if (pendingUpdates.length === 0) return;
    saveMutation.mutate(pendingUpdates);
  };

  return (
    <div className="flex flex-col gap-6 font-arabic select-none" dir="rtl">

      {/* Header section */}
      <div className="bg-white border border-slate-200/80 p-6 rounded-2xl shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-xl lg:text-2xl font-extrabold text-slate-800 flex items-center gap-2">
            <Shield size={24} className="text-blue-600 animate-pulse" />
            إدارة الأدوار وصلاحيات النظام (RBAC Matrix)
          </h1>
          <p className="text-xs lg:text-sm text-slate-500 mt-1.5 leading-relaxed">
            التحكم في مستويات الوصول ونطاق الصلاحيات لجميع فئات المستخدمين. التعديلات تنعكس فوراً على قاعدة البيانات وذاكرة الخادم.
          </p>
        </div>
        <div className="flex items-center gap-2 w-full md:w-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={handleDiscard}
            disabled={!isDirty || saveMutation.isPending}
            className="w-full md:w-auto gap-1.5"
          >
            <RotateCcw size={14} />
            تراجع عن التغييرات
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleSave}
            disabled={!isDirty || saveMutation.isPending}
            className="w-full md:w-auto gap-2 shadow-xs"
          >
            <Save size={14} />
            {saveMutation.isPending ? 'جاري الحفظ...' : `حفظ التغييرات (${pendingUpdates.length})`}
          </Button>
        </div>
      </div>

      {/* Contextual Inline Success Alert Banner */}
      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold p-4 rounded-xl flex items-center justify-between animate-fade-in shadow-2xs">
          <div className="flex items-center gap-2.5">
            <Check size={18} className="text-emerald-600 flex-shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="text-emerald-600 hover:text-emerald-900 cursor-pointer">
            <X size={16} />
          </button>
        </div>
      )}

      {/* Contextual Inline Error Alert Banner */}
      {(errorMsg || isError) && (
        <div className="bg-red-50 border border-red-200 text-red-800 text-xs font-semibold p-4 rounded-xl flex items-center justify-between animate-fade-in shadow-2xs">
          <div className="flex items-center gap-2.5">
            <AlertCircle size={18} className="text-red-600 flex-shrink-0" />
            <span>{errorMsg || (error instanceof Error ? error.message : 'فشل في تحميل مصفوفة الصلاحيات من الخادم.')}</span>
          </div>
          <div className="flex items-center gap-2">
            {isError && (
              <Button variant="outline" size="sm" onClick={() => refetch()} className="text-xs">
                إعادة المحاولة
              </Button>
            )}
            <button onClick={() => setErrorMsg(null)} className="text-red-600 hover:text-red-900 cursor-pointer">
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Dirty state alert prompt */}
      {isDirty && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center justify-between gap-3 text-xs font-semibold text-amber-800 animate-fade-in">
          <div className="flex items-center gap-2">
            <AlertCircle size={16} className="text-amber-600 flex-shrink-0" />
            <span>لديك عدد {pendingUpdates.length} تغييرات غير محفوظة في جدول الصلاحيات. اضغط "حفظ التغييرات" للاعتماد.</span>
          </div>
          <button onClick={handleDiscard} className="underline text-amber-900 hover:text-amber-700 text-xs cursor-pointer font-bold">
            إلغاء التغييرات
          </button>
        </div>
      )}

      {/* Main Matrix Table */}
      {isLoading ? (
        <Card className="border-slate-200/80 p-6 shadow-xs">
          <div className="space-y-4 animate-pulse">
            <div className="h-10 bg-slate-100 rounded-lg w-full"></div>
            {[1, 2, 3, 4, 6, 7].map((i) => (
              <div key={i} className="h-12 bg-slate-50 rounded-lg w-full"></div>
            ))}
          </div>
        </Card>
      ) : (
        <Card className="border-slate-200/80 overflow-hidden shadow-xs">
          <Card.Body className="p-0">
            <div className="w-full overflow-x-auto">
              <table className="w-full text-right border-collapse">
                <thead className="bg-slate-50/80 border-b border-slate-100 sticky top-0 z-10">
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
                          <span className="text-[10px] text-slate-400 mt-1 font-mono font-semibold">{perm.key}</span>
                        </div>
                      </td>
                      {ROLES.map((role) => {
                        const isChecked = !!editedMatrix[role.key]?.[perm.key];
                        const origVal = !!serverMatrix[role.key]?.[perm.key];
                        const isModified = isChecked !== origVal;

                        return (
                          <td key={role.key} className={`px-4 py-4 text-center border-r border-slate-100 ${isModified ? 'bg-amber-50/40' : ''}`}>
                            <label className="inline-flex items-center justify-center cursor-pointer select-none">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                disabled={saveMutation.isPending}
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
                                peer-checked:bg-blue-600 relative transition-colors duration-200
                                ${isModified ? 'ring-2 ring-amber-400' : ''}
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
      )}

      {/* Role Explanations Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2">
        {ROLES.map(role => (
          <div key={role.key} className="bg-white border border-slate-200/60 p-4 rounded-xl shadow-2xs flex gap-3 items-start">
            <div className="w-8 h-8 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-600 font-bold text-xs flex-shrink-0">
              {role.key.substring(0, 2).toUpperCase()}
            </div>
            <div className="flex flex-col text-right">
              <span className="text-xs font-bold text-slate-800">{role.label}</span>
              <span className="text-[10px] text-slate-400 font-mono font-semibold mt-0.5">{role.key}</span>
              <p className="text-[10px] text-slate-500 font-normal mt-2 leading-relaxed">{role.desc}</p>
            </div>
          </div>
        ))}
      </div>

    </div>
  );
};

export default RolesPermissionsPage;
