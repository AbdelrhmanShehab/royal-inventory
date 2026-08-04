import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Users as UsersIcon, 
  Search, 
  UserPlus, 
  Power, 
  Edit3, 
  Trash2, 
  X, 
  Check, 
  AlertCircle,
  KeyRound,
  Building2
} from 'lucide-react';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import EmptyState from '../../components/ui/EmptyState';
import { usersApi } from '../../api/users.api';
import { hierarchyApi } from '../../api/hierarchy.api';
import type { User as UserType, CreateUserData, UpdateUserData } from '../../types/user';
import type { OrganizationNode } from '../../types/hierarchy';

// Role mappings with labels and badge variants
const ROLES: { key: UserType['role']; label: string; variant: 'danger' | 'warning' | 'info' | 'neutral' | 'success' }[] = [
  { key: 'admin', label: 'مدير النظام الرئيسي', variant: 'danger' },
  { key: 'manager', label: 'مدير العمليات', variant: 'warning' },
  { key: 'warehouse_manager', label: 'مدير مستودع', variant: 'info' },
  { key: 'warehouse_head', label: 'أمين مستودع', variant: 'info' },
  { key: 'accountant', label: 'محاسب مالي', variant: 'neutral' },
  { key: 'staff', label: 'موظف تشغيل', variant: 'neutral' }
];

const roleLabels: Record<string, { text: string; variant: any }> = {
  admin: { text: 'مدير النظام', variant: 'danger' },
  manager: { text: 'مدير عمليات', variant: 'warning' },
  warehouse_manager: { text: 'مدير مستودع', variant: 'info' },
  warehouse_head: { text: 'أمين مستودع', variant: 'info' },
  accountant: { text: 'محاسب', variant: 'neutral' },
  staff: { text: 'موظف تشغيل', variant: 'neutral' }
};

// Helper to flatten node tree for selection
function flattenNodes(nodes: OrganizationNode[]): { id: number; name: string }[] {
  let result: { id: number; name: string }[] = [];
  for (const node of nodes) {
    const numId = Number(node.id.replace('group-', ''));
    if (!isNaN(numId)) {
      result.push({ id: numId, name: node.name });
    }
    if (node.children && node.children.length > 0) {
      result = result.concat(flattenNodes(node.children));
    }
  }
  return result;
}

export default function UsersPage() {
  const queryClient = useQueryClient();

  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  // Page level alerts (Success & Error)
  const [pageSuccess, setPageSuccess] = useState<string | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);

  // Modals state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserType | null>(null);
  const [deletingUser, setDeletingUser] = useState<UserType | null>(null);
  const [resettingUser, setResettingUser] = useState<UserType | null>(null);

  // Modal inline global error banners
  const [createError, setCreateError] = useState<string | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [resetError, setResetError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Field-specific validation errors (Matching LoginPage pattern)
  const [createFieldErrors, setCreateFieldErrors] = useState<{ username?: string; fullNameAr?: string; password?: string }>({});
  const [editFieldErrors, setEditFieldErrors] = useState<{ fullNameAr?: string }>({});
  const [resetFieldErrors, setResetFieldErrors] = useState<{ password?: string }>({});

  // Form states
  const [createForm, setCreateForm] = useState<CreateUserData>({
    username: '',
    fullNameAr: '',
    password: '',
    role: 'warehouse_head',
    nodeId: null,
    isActive: true
  });

  const [editForm, setEditForm] = useState<UpdateUserData>({
    fullNameAr: '',
    role: 'warehouse_head',
    nodeId: null,
    isActive: true
  });

  const [newPassword, setNewPassword] = useState('');

  const triggerPageSuccess = (msg: string) => {
    setPageSuccess(msg);
    setPageError(null);
    setTimeout(() => setPageSuccess(null), 5000);
  };

  const triggerPageError = (msg: string) => {
    setPageError(msg);
    setPageSuccess(null);
  };

  // 1. Fetch Users Query
  const { data: users = [], isLoading, isError, error } = useQuery({
    queryKey: ['users'],
    queryFn: usersApi.getUsers
  });

  // 2. Fetch Nodes Query
  const { data: treeNodes = [] } = useQuery({
    queryKey: ['hierarchy-tree'],
    queryFn: hierarchyApi.getTree
  });

  const availableNodes = flattenNodes(treeNodes);

  // 3. Create User Mutation
  const createMutation = useMutation({
    mutationFn: usersApi.createUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      triggerPageSuccess('تم إنشاء حساب المستخدم بنجاح');
      setIsCreateOpen(false);
      setCreateError(null);
      setCreateFieldErrors({});
      setCreateForm({
        username: '',
        fullNameAr: '',
        password: '',
        role: 'warehouse_head',
        nodeId: null,
        isActive: true
      });
    },
    onError: (err: any) => {
      const backendErrors = err.response?.data?.errors;
      const backendMessage = err.response?.data?.message;

      // Extract field-specific errors if available
      const newFieldErrors: { username?: string; fullNameAr?: string; password?: string } = {};

      if (Array.isArray(backendErrors)) {
        backendErrors.forEach((e: any) => {
          if (e.field === 'username') newFieldErrors.username = e.message || e.msg;
          if (e.field === 'fullNameAr' || e.field === 'full_name_ar') newFieldErrors.fullNameAr = e.message || e.msg;
          if (e.field === 'password') newFieldErrors.password = e.message || e.msg;
        });
      }

      setCreateFieldErrors(newFieldErrors);

      const msg = backendMessage || (Array.isArray(backendErrors) ? backendErrors.map((e: any) => e.message || e.msg).join(' | ') : null) || err.message || 'فشل في إنشاء الحساب. يرجى التثبت من البيانات والمحاولة مجدداً.';
      setCreateError(msg);
    }
  });

  // 4. Update User Mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string | number; data: UpdateUserData }) => usersApi.updateUser(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      triggerPageSuccess('تم تحديث بيانات المستخدم بنجاح');
      setEditingUser(null);
      setEditError(null);
      setEditFieldErrors({});
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || err.message || 'فشل في تحديث الحساب';
      setEditError(msg);
    }
  });

  // 5. Toggle Status Mutation
  const toggleStatusMutation = useMutation({
    mutationFn: ({ user, status }: { user: UserType; status: 'active' | 'inactive' }) =>
      usersApi.updateUserStatus(user, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      triggerPageSuccess('تم تغيير حالة الحساب بنجاح');
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || err.message || 'فشل في تغيير حالة الحساب';
      triggerPageError(msg);
    }
  });

  // 6. Delete User Mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string | number) => usersApi.deleteUser(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      triggerPageSuccess('تم حذف المستخدم بنجاح');
      setDeletingUser(null);
      setDeleteError(null);
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || err.message || 'فشل في حذف المستخدم';
      setDeleteError(msg);
    }
  });

  // 7. Reset Password Mutation
  const resetPasswordMutation = useMutation({
    mutationFn: ({ id, newPass }: { id: string | number; newPass: string }) =>
      usersApi.resetPassword(id, newPass),
    onSuccess: () => {
      triggerPageSuccess('تم إعادة تعيين كلمة المرور بنجاح');
      setResettingUser(null);
      setResetError(null);
      setResetFieldErrors({});
      setNewPassword('');
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || err.message || 'فشل في إعادة تعيين كلمة المرور';
      setResetError(msg);
    }
  });

  // Open Create Modal
  const handleOpenCreate = () => {
    setCreateError(null);
    setCreateFieldErrors({});
    setIsCreateOpen(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (user: UserType) => {
    setEditError(null);
    setEditFieldErrors({});
    setEditingUser(user);
    setEditForm({
      fullNameAr: user.fullNameAr || user.username,
      role: user.role,
      nodeId: user.nodeId ?? null,
      isActive: user.isActive
    });
  };

  // Open Reset Password Modal
  const handleOpenReset = (user: UserType) => {
    setResetError(null);
    setResetFieldErrors({});
    setResettingUser(user);
    setNewPassword('');
  };

  // Open Delete Modal
  const handleOpenDelete = (user: UserType) => {
    setDeleteError(null);
    setDeletingUser(user);
  };

  // Submit Create with full field-level validation (Matching Login UX)
  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);

    const errors: { username?: string; fullNameAr?: string; password?: string } = {};

    if (!createForm.username.trim()) {
      errors.username = 'يرجى إدخال اسم المستخدم الخاص بالحساب';
    } else if (createForm.username.trim().length < 3) {
      errors.username = 'اسم المستخدم يجب أن يتكون من 3 أحرف على الأقل';
    }

    if (!createForm.fullNameAr.trim()) {
      errors.fullNameAr = 'يرجى إدخال الاسم الكامل باللغة العربية';
    } else if (createForm.fullNameAr.trim().length < 3) {
      errors.fullNameAr = 'الاسم العربي يجب أن يتكون من 3 أحرف على الأقل';
    }

    if (!createForm.password) {
      errors.password = 'يرجى إدخال كلمة المرور الأولية للحساب';
    } else if (createForm.password.length < 6) {
      errors.password = 'كلمة المرور يجب أن تكون 6 أحرف على الأقل';
    }

    if (Object.keys(errors).length > 0) {
      setCreateFieldErrors(errors);
      setCreateError('يرجى تصحيح أخطاء الإدخال الموضحة أسفل الحقول.');
      return;
    }

    setCreateFieldErrors({});
    createMutation.mutate(createForm);
  };

  // Submit Edit with field-level validation
  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setEditError(null);
    if (!editingUser) return;

    if (!editForm.fullNameAr.trim()) {
      setEditFieldErrors({ fullNameAr: 'يرجى إدخال الاسم الكامل باللغة العربية' });
      setEditError('يرجى تصحيح الخطأ الموضح أسفل الحقل.');
      return;
    }

    setEditFieldErrors({});
    updateMutation.mutate({ id: editingUser.id, data: editForm });
  };

  // Submit Password Reset with field-level validation
  const handleResetPasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setResetError(null);
    if (!resettingUser) return;

    if (!newPassword) {
      setResetFieldErrors({ password: 'يرجى إدخال كلمة المرور الجديدة' });
      setResetError('يرجى إدخال كلمة المرور الجديدة.');
      return;
    }
    if (newPassword.length < 6) {
      setResetFieldErrors({ password: 'كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل' });
      setResetError('كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل.');
      return;
    }

    setResetFieldErrors({});
    resetPasswordMutation.mutate({ id: resettingUser.id, newPass: newPassword });
  };

  // Filter logic
  const filteredUsers = users.filter(user => {
    const query = searchQuery.toLowerCase().trim();
    const usernameMatch = user.username.toLowerCase().includes(query);
    const nameMatch = user.fullNameAr.toLowerCase().includes(query);
    const emailMatch = (user.email || '').toLowerCase().includes(query);
    return usernameMatch || nameMatch || emailMatch;
  });

  // Pagination logic
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentUsers = filteredUsers.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredUsers.length / itemsPerPage);

  return (
    <div className="flex flex-col gap-6 font-arabic select-none" dir="rtl">
      
      {/* Page Header & Actions */}
      <div className="bg-white border border-slate-200/80 p-5 rounded-2xl shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <UsersIcon size={20} className="text-blue-600" />
              إدارة حسابات المستخدمين والصلاحيات
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              إدارة مستخدمي النظام المحليين وتخصيص مستويات الوصول حسب الهيكل التنظيمي
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative flex items-center">
              <Search size={16} className="absolute right-3 text-slate-400 pointer-events-none" />
              <input 
                type="text" 
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                placeholder="ابحث بالحساب أو الاسم..." 
                className="w-64 pr-9 pl-3 py-2 bg-slate-50 border border-slate-200 text-xs rounded-xl placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
              />
            </div>
            <Button variant="primary" size="sm" onClick={handleOpenCreate} className="gap-2 shadow-xs">
              <UserPlus size={15} />
              إضافة مستخدم جديد
            </Button>
          </div>
        </div>
      </div>

      {/* Page Level Success Banner */}
      {pageSuccess && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold p-4 rounded-xl flex items-center justify-between animate-fade-in shadow-2xs">
          <div className="flex items-center gap-2.5">
            <Check size={18} className="text-emerald-600 flex-shrink-0" />
            <span>{pageSuccess}</span>
          </div>
          <button onClick={() => setPageSuccess(null)} className="text-emerald-600 hover:text-emerald-900 cursor-pointer">
            <X size={16} />
          </button>
        </div>
      )}

      {/* Page Level Error Banner */}
      {(pageError || isError) && (
        <div className="bg-red-50 border border-red-200 text-red-800 text-xs font-semibold p-4 rounded-xl flex items-center justify-between animate-fade-in shadow-2xs">
          <div className="flex items-center gap-2.5">
            <AlertCircle size={18} className="text-red-600 flex-shrink-0" />
            <span>{pageError || (error instanceof Error ? error.message : 'تعذر تحميل قائمة المستخدمين من الخادم.')}</span>
          </div>
          <button onClick={() => setPageError(null)} className="text-red-600 hover:text-red-900 cursor-pointer">
            <X size={16} />
          </button>
        </div>
      )}

      {/* Loading Skeleton */}
      {isLoading ? (
        <Card className="border-slate-200/60 p-6 shadow-xs">
          <div className="space-y-4 animate-pulse">
            <div className="h-10 bg-slate-100 rounded-lg w-full"></div>
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-14 bg-slate-50 rounded-lg w-full flex items-center justify-between px-4">
                <div className="w-1/4 h-4 bg-slate-200 rounded"></div>
                <div className="w-1/6 h-4 bg-slate-200 rounded"></div>
                <div className="w-1/5 h-4 bg-slate-200 rounded"></div>
                <div className="w-1/6 h-4 bg-slate-200 rounded"></div>
              </div>
            ))}
          </div>
        </Card>
      ) : currentUsers.length === 0 ? (
        <EmptyState title="لا يوجد مستخدمون يطابقون البحث" description="يرجى مراجعة الاسم أو تغيير كلمات البحث." />
      ) : (
        <div className="flex flex-col gap-4">
          <Card className="border-slate-200/60 overflow-hidden shadow-xs">
            <div className="w-full overflow-x-auto">
              <table className="w-full text-right border-collapse select-none">
                <thead className="bg-slate-50/80 border-b border-slate-100 sticky top-0">
                  <tr>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500">اسم المستخدم (الحساب)</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500">الاسم باللغة العربية</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500">الدور والتصنيف</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500">الوحدة التشغيلية المرتبطة</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500">الحالة</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 text-center">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {currentUsers.map((user) => {
                    const roleInfo = roleLabels[user.role] || { text: user.role, variant: 'neutral' };
                    const isActive = user.isActive;

                    return (
                      <tr 
                        key={user.id}
                        className="hover:bg-slate-50/60 transition-colors duration-150"
                      >
                        <td className="px-6 py-4 text-xs font-bold text-slate-800 flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-700 border border-blue-200 flex items-center justify-center font-bold text-xs uppercase shadow-2xs">
                            {user.username.substring(0, 2)}
                          </div>
                          <span className="font-mono text-slate-700">{user.username}</span>
                        </td>
                        <td className="px-6 py-4 text-xs font-bold text-slate-800">
                          {user.fullNameAr}
                        </td>
                        <td className="px-6 py-4 text-xs">
                          <Badge variant={roleInfo.variant}>{roleInfo.text}</Badge>
                        </td>
                        <td className="px-6 py-4 text-xs text-slate-600 font-semibold flex items-center gap-1.5 mt-2">
                          <Building2 size={13} className="text-slate-400" />
                          <span>{user.nodeNameAr || 'المكتب الرئيسي'}</span>
                        </td>
                        <td className="px-6 py-4 text-xs">
                          <Badge variant={isActive ? 'success' : 'neutral'}>
                            {isActive ? 'نشط ومصرح' : 'معطل'}
                          </Badge>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <div className="flex items-center justify-center gap-1">
                            {/* Toggle Active Status Button */}
                            <button 
                              onClick={() => toggleStatusMutation.mutate({ user, status: isActive ? 'inactive' : 'active' })}
                              disabled={toggleStatusMutation.isPending}
                              className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                                isActive 
                                  ? 'text-slate-400 hover:text-amber-600 hover:bg-amber-50' 
                                  : 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50'
                              }`}
                              title={isActive ? 'تعطيل الحساب' : 'تنشيط الحساب'}
                            >
                              <Power size={14} />
                            </button>

                            {/* Edit User Button */}
                            <button 
                              onClick={() => handleOpenEdit(user)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-all cursor-pointer"
                              title="تعديل بيانات الحساب"
                            >
                              <Edit3 size={14} />
                            </button>

                            {/* Reset Password Button */}
                            <button 
                              onClick={() => handleOpenReset(user)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all cursor-pointer"
                              title="إعادة تعيين كلمة المرور"
                            >
                              <KeyRound size={14} />
                            </button>

                            {/* Delete User Button */}
                            <button 
                              onClick={() => handleOpenDelete(user)}
                              disabled={user.username === 'admin'}
                              className={`p-1.5 rounded-lg transition-all ${
                                user.username === 'admin' 
                                  ? 'text-slate-200 cursor-not-allowed' 
                                  : 'text-slate-400 hover:text-red-600 hover:bg-red-50 cursor-pointer'
                              }`}
                              title={user.username === 'admin' ? 'لا يمكن حذف حساب المدير الرئيسي' : 'حذف الحساب'}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-between items-center bg-white border border-slate-200/80 px-6 py-3.5 rounded-xl shadow-xs select-none">
              <span className="text-xs text-slate-400 font-bold">
                عرض {indexOfFirstItem + 1} - {Math.min(indexOfLastItem, filteredUsers.length)} من أصل {filteredUsers.length} مستخدم
              </span>
              <div className="flex gap-1">
                <Button 
                  variant="outline" 
                  size="sm" 
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(prev => prev - 1)}
                >
                  السابق
                </Button>
                {Array.from({ length: totalPages }).map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => setCurrentPage(idx + 1)}
                    className={`w-8 h-8 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      currentPage === idx + 1 
                        ? 'bg-blue-600 text-white' 
                        : 'bg-transparent text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    {idx + 1}
                  </button>
                ))}
                <Button 
                  variant="outline" 
                  size="sm" 
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(prev => prev + 1)}
                >
                  التالي
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* CREATE USER MODAL */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 w-full max-w-lg shadow-2xl overflow-hidden animate-scale-up">
            <div className="bg-slate-900 px-6 py-4 flex items-center justify-between text-white">
              <h2 className="text-sm font-bold flex items-center gap-2">
                <UserPlus size={16} className="text-blue-400" />
                إضافة مستخدم جديد للنظام
              </h2>
              <button 
                onClick={() => setIsCreateOpen(false)}
                className="text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>
            
            {/* noValidate stops browser native popups */}
            <form onSubmit={handleCreateSubmit} noValidate className="p-6 space-y-4">
              {/* Login-style Global Modal Error Banner */}
              {createError && (
                <div className="p-4 rounded-xl bg-red-50 border-2 border-red-200 flex items-start gap-3 text-right animate-fade-in shadow-xs">
                  <AlertCircle className="text-red-600 shrink-0 mt-0.5" size={20} />
                  <div className="flex-1">
                    <h4 className="text-xs font-black text-red-900">خطأ في بيانات الإدخال</h4>
                    <p className="text-xs text-red-800 font-bold mt-0.5 leading-relaxed">{createError}</p>
                  </div>
                </div>
              )}

              {/* Username Field */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700">
                  اسم المستخدم (اسم الحساب للانتقال) <span className="text-red-500">*</span>
                </label>
                <input 
                  type="text" 
                  value={createForm.username}
                  onChange={(e) => {
                    setCreateForm({ ...createForm, username: e.target.value });
                    if (createFieldErrors.username) {
                      setCreateFieldErrors({ ...createFieldErrors, username: undefined });
                    }
                    if (createError) setCreateError(null);
                  }}
                  placeholder="مثال: ahmed.ali"
                  className={`w-full px-3.5 py-2 text-xs border rounded-xl outline-none transition-all duration-200 ${
                    createFieldErrors.username
                      ? 'border-2 border-red-500 bg-red-50/20 focus:border-red-500 focus:ring-2 focus:ring-red-500/10'
                      : 'border-slate-200 focus:ring-1 focus:ring-blue-500 focus:border-blue-500'
                  }`}
                />
                {createFieldErrors.username && (
                  <p className="text-[11px] font-bold text-red-600 mt-1 flex items-center gap-1">
                    <AlertCircle size={12} /> {createFieldErrors.username}
                  </p>
                )}
              </div>

              {/* Full Name Ar Field */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700">
                  الاسم الكامل باللغة العربية <span className="text-red-500">*</span>
                </label>
                <input 
                  type="text" 
                  value={createForm.fullNameAr}
                  onChange={(e) => {
                    setCreateForm({ ...createForm, fullNameAr: e.target.value });
                    if (createFieldErrors.fullNameAr) {
                      setCreateFieldErrors({ ...createFieldErrors, fullNameAr: undefined });
                    }
                    if (createError) setCreateError(null);
                  }}
                  placeholder="مثال: أحمد علي المحمود"
                  className={`w-full px-3.5 py-2 text-xs border rounded-xl outline-none transition-all duration-200 ${
                    createFieldErrors.fullNameAr
                      ? 'border-2 border-red-500 bg-red-50/20 focus:border-red-500 focus:ring-2 focus:ring-red-500/10'
                      : 'border-slate-200 focus:ring-1 focus:ring-blue-500 focus:border-blue-500'
                  }`}
                />
                {createFieldErrors.fullNameAr && (
                  <p className="text-[11px] font-bold text-red-600 mt-1 flex items-center gap-1">
                    <AlertCircle size={12} /> {createFieldErrors.fullNameAr}
                  </p>
                )}
              </div>

              {/* Initial Password Field */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700">
                  كلمة المرور الأولية <span className="text-red-500">*</span> (6 أحرف على الأقل)
                </label>
                <input 
                  type="password" 
                  value={createForm.password}
                  onChange={(e) => {
                    setCreateForm({ ...createForm, password: e.target.value });
                    if (createFieldErrors.password) {
                      setCreateFieldErrors({ ...createFieldErrors, password: undefined });
                    }
                    if (createError) setCreateError(null);
                  }}
                  placeholder="••••••••"
                  className={`w-full px-3.5 py-2 text-xs border rounded-xl outline-none transition-all duration-200 ${
                    createFieldErrors.password
                      ? 'border-2 border-red-500 bg-red-50/20 focus:border-red-500 focus:ring-2 focus:ring-red-500/10'
                      : 'border-slate-200 focus:ring-1 focus:ring-blue-500 focus:border-blue-500'
                  }`}
                />
                {createFieldErrors.password && (
                  <p className="text-[11px] font-bold text-red-600 mt-1 flex items-center gap-1">
                    <AlertCircle size={12} /> {createFieldErrors.password}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    دور المستخدم وصلاحيته <span className="text-red-500">*</span>
                  </label>
                  <select 
                    value={createForm.role}
                    onChange={(e) => setCreateForm({ ...createForm, role: e.target.value as any })}
                    className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
                  >
                    {ROLES.map(role => (
                      <option key={role.key} value={role.key}>{role.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    الوحدة التشغيلية (المستودع)
                  </label>
                  <select 
                    value={createForm.nodeId ?? ''}
                    onChange={(e) => setCreateForm({ ...createForm, nodeId: e.target.value ? Number(e.target.value) : null })}
                    className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
                  >
                    <option value="">المكتب الرئيسي (جميع الفروع)</option>
                    {availableNodes.map(node => (
                      <option key={node.id} value={node.id}>{node.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input 
                  type="checkbox"
                  id="createIsActive"
                  checked={createForm.isActive}
                  onChange={(e) => setCreateForm({ ...createForm, isActive: e.target.checked })}
                  className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                />
                <label htmlFor="createIsActive" className="text-xs font-semibold text-slate-700 cursor-pointer">
                  تنشيط الحساب فور الإنشاء
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                <Button 
                  type="button" 
                  variant="outline" 
                  size="sm"
                  onClick={() => setIsCreateOpen(false)}
                >
                  إلغاء
                </Button>
                <Button 
                  type="submit" 
                  variant="primary" 
                  size="sm"
                  disabled={createMutation.isPending}
                >
                  {createMutation.isPending ? 'جاري الإنشاء...' : 'حفظ وإنشاء الحساب'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT USER MODAL */}
      {editingUser && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 w-full max-w-lg shadow-2xl overflow-hidden animate-scale-up">
            <div className="bg-slate-900 px-6 py-4 flex items-center justify-between text-white">
              <h2 className="text-sm font-bold flex items-center gap-2">
                <Edit3 size={16} className="text-blue-400" />
                تعديل بيانات الحساب ({editingUser.username})
              </h2>
              <button 
                onClick={() => setEditingUser(null)}
                className="text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>
            
            <form onSubmit={handleEditSubmit} noValidate className="p-6 space-y-4">
              {/* Login-style Global Modal Error Banner */}
              {editError && (
                <div className="p-4 rounded-xl bg-red-50 border-2 border-red-200 flex items-start gap-3 text-right animate-fade-in shadow-xs">
                  <AlertCircle className="text-red-600 shrink-0 mt-0.5" size={20} />
                  <div className="flex-1">
                    <h4 className="text-xs font-black text-red-900">خطأ في التعديل</h4>
                    <p className="text-xs text-red-800 font-bold mt-0.5 leading-relaxed">{editError}</p>
                  </div>
                </div>
              )}

              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700">
                  الاسم الكامل باللغة العربية <span className="text-red-500">*</span>
                </label>
                <input 
                  type="text" 
                  value={editForm.fullNameAr}
                  onChange={(e) => {
                    setEditForm({ ...editForm, fullNameAr: e.target.value });
                    if (editFieldErrors.fullNameAr) setEditFieldErrors({});
                    if (editError) setEditError(null);
                  }}
                  className={`w-full px-3.5 py-2 text-xs border rounded-xl outline-none transition-all duration-200 ${
                    editFieldErrors.fullNameAr
                      ? 'border-2 border-red-500 bg-red-50/20 focus:border-red-500 focus:ring-2 focus:ring-red-500/10'
                      : 'border-slate-200 focus:ring-1 focus:ring-blue-500 focus:border-blue-500'
                  }`}
                />
                {editFieldErrors.fullNameAr && (
                  <p className="text-[11px] font-bold text-red-600 mt-1 flex items-center gap-1">
                    <AlertCircle size={12} /> {editFieldErrors.fullNameAr}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    دور المستخدم وصلاحيته <span className="text-red-500">*</span>
                  </label>
                  <select 
                    value={editForm.role}
                    onChange={(e) => setEditForm({ ...editForm, role: e.target.value as any })}
                    className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
                  >
                    {ROLES.map(role => (
                      <option key={role.key} value={role.key}>{role.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    الوحدة التشغيلية (المستودع)
                  </label>
                  <select 
                    value={editForm.nodeId ?? ''}
                    onChange={(e) => setEditForm({ ...editForm, nodeId: e.target.value ? Number(e.target.value) : null })}
                    className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
                  >
                    <option value="">المكتب الرئيسي (جميع الفروع)</option>
                    {availableNodes.map(node => (
                      <option key={node.id} value={node.id}>{node.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input 
                  type="checkbox"
                  id="editIsActive"
                  checked={editForm.isActive}
                  onChange={(e) => setEditForm({ ...editForm, isActive: e.target.checked })}
                  className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                />
                <label htmlFor="editIsActive" className="text-xs font-semibold text-slate-700 cursor-pointer">
                  حساب نشط ومصرح له بالدخول
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                <Button 
                  type="button" 
                  variant="outline" 
                  size="sm"
                  onClick={() => setEditingUser(null)}
                >
                  إلغاء
                </Button>
                <Button 
                  type="submit" 
                  variant="primary" 
                  size="sm"
                  disabled={updateMutation.isPending}
                >
                  {updateMutation.isPending ? 'جاري التعديل...' : 'حفظ التغييرات'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RESET PASSWORD MODAL */}
      {resettingUser && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 w-full max-w-md shadow-2xl overflow-hidden animate-scale-up">
            <div className="bg-indigo-950 px-6 py-4 flex items-center justify-between text-white">
              <h2 className="text-sm font-bold flex items-center gap-2">
                <KeyRound size={16} className="text-indigo-400" />
                إعادة تعيين كلمة المرور ({resettingUser.username})
              </h2>
              <button 
                onClick={() => setResettingUser(null)}
                className="text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleResetPasswordSubmit} noValidate className="p-6 space-y-4">
              {/* Login-style Global Modal Error Banner */}
              {resetError && (
                <div className="p-4 rounded-xl bg-red-50 border-2 border-red-200 flex items-start gap-3 text-right animate-fade-in shadow-xs">
                  <AlertCircle className="text-red-600 shrink-0 mt-0.5" size={20} />
                  <div className="flex-1">
                    <h4 className="text-xs font-black text-red-900">خطأ في تغيير كلمة المرور</h4>
                    <p className="text-xs text-red-800 font-bold mt-0.5 leading-relaxed">{resetError}</p>
                  </div>
                </div>
              )}

              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700">
                  كلمة المرور الجديدة <span className="text-red-500">*</span> (6 أحرف على الأقل)
                </label>
                <input 
                  type="password"
                  value={newPassword}
                  onChange={(e) => {
                    setNewPassword(e.target.value);
                    if (resetFieldErrors.password) setResetFieldErrors({});
                    if (resetError) setResetError(null);
                  }}
                  placeholder="••••••••"
                  className={`w-full px-3.5 py-2 text-xs border rounded-xl outline-none transition-all duration-200 ${
                    resetFieldErrors.password
                      ? 'border-2 border-red-500 bg-red-50/20 focus:border-red-500 focus:ring-2 focus:ring-red-500/10'
                      : 'border-slate-200 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500'
                  }`}
                />
                {resetFieldErrors.password && (
                  <p className="text-[11px] font-bold text-red-600 mt-1 flex items-center gap-1">
                    <AlertCircle size={12} /> {resetFieldErrors.password}
                  </p>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                <Button 
                  type="button" 
                  variant="outline" 
                  size="sm"
                  onClick={() => setResettingUser(null)}
                >
                  إلغاء
                </Button>
                <Button 
                  type="submit" 
                  variant="primary" 
                  size="sm"
                  disabled={resetPasswordMutation.isPending}
                  className="bg-indigo-600 hover:bg-indigo-700"
                >
                  {resetPasswordMutation.isPending ? 'جاري الحفظ...' : 'تحديث كلمة المرور'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deletingUser && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 w-full max-w-sm shadow-2xl overflow-hidden animate-scale-up p-6 text-center">
            <div className="w-12 h-12 rounded-full bg-red-50 text-red-600 flex items-center justify-center mx-auto mb-4 border border-red-100">
              <Trash2 size={22} />
            </div>
            <h3 className="text-base font-bold text-slate-800 mb-2">تأكيد حذف الحساب</h3>
            
            {/* Login-style Global Modal Error Banner */}
            {deleteError && (
              <div className="p-3.5 mb-4 rounded-xl bg-red-50 border-2 border-red-200 flex items-start gap-2 text-right animate-fade-in shadow-xs">
                <AlertCircle className="text-red-600 shrink-0 mt-0.5" size={18} />
                <div className="flex-1">
                  <h4 className="text-xs font-black text-red-900">خطأ أثناء الحذف</h4>
                  <p className="text-xs text-red-800 font-bold mt-0.5 leading-relaxed">{deleteError}</p>
                </div>
              </div>
            )}

            <p className="text-xs text-slate-500 mb-6 leading-relaxed">
              هل أنت تأكد من رغبتك في حذف حساب المستخدم <strong className="text-slate-800">{deletingUser.username}</strong> ({deletingUser.fullNameAr})؟ لا يمكن التراجع عن هذا الإجراء.
            </p>
            <div className="flex justify-center gap-3">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setDeletingUser(null)}
              >
                إلغاء
              </Button>
              <Button 
                variant="danger" 
                size="sm"
                disabled={deleteMutation.isPending}
                onClick={() => deleteMutation.mutate(deletingUser.id)}
              >
                {deleteMutation.isPending ? 'جاري الحذف...' : 'تأكيد حذف الحساب'}
              </Button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
