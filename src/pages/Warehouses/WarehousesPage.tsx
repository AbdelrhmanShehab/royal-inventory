import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Warehouse as WarehouseIcon,
  Building2,
  Hotel,
  Package,
  Search,
  Plus,
  Edit3,
  Trash2,
  Power,
  AlertCircle,
  Check,
  X,
  Link2,
  WashingMachine,
  User as UserIcon,
  CheckCircle2,
  RefreshCw,
  ShieldAlert
} from 'lucide-react';

import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Modal from '../../components/ui/Modal';
import Loader from '../../components/ui/Loader';
import EmptyState from '../../components/ui/EmptyState';

import { warehousesApi } from '../../api/warehouses.api';
import { hierarchyApi } from '../../api/hierarchy.api';
import { usersApi } from '../../api/users.api';
import { useAuth } from '../../context/AuthContext';
import { useWarehouseScope } from '../../hooks/useWarehouseScope';

import type {
  Warehouse,
  CreateWarehousePayload,
  UpdateWarehousePayload
} from '../../types/warehouse';

export default function WarehousesPage() {
  const queryClient = useQueryClient();
  const { hasPermission } = useAuth();
  const { isGlobalAdmin, currentNodeId, assignedWarehouse, childNodeIds } = useWarehouseScope();
  const canManageNodes = hasPermission('manage_nodes');

  // Search, Filters & Pagination
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedParentFilter, setSelectedParentFilter] = useState<string>('all');
  const [selectedDivisionFilter, setSelectedDivisionFilter] = useState<string>('all');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('all');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<'all' | 'child' | 'parent'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  // Alerts state
  const [pageSuccess, setPageSuccess] = useState<string | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);

  // Modals state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingWarehouse, setEditingWarehouse] = useState<Warehouse | null>(null);
  const [deactivatingWarehouse, setDeactivatingWarehouse] = useState<Warehouse | null>(null);
  const [unlinkComsysOnDeactivate, setUnlinkComsysOnDeactivate] = useState<boolean>(true);
  const [deletingWarehouse, setDeletingWarehouse] = useState<Warehouse | null>(null);

  // Modal errors
  const [modalError, setModalError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Form State for Creation
  const [createForm, setCreateForm] = useState({
    nodeNameAr: '',
    nodeType: 'child' as 'parent' | 'child',
    parentNodeId: '' as string | number,
    groupId: '' as string | number,
    division: 'fb' as 'fb' | 'gs',
    managerUserId: '' as string | number,
    managerName: '',
    comsysStoreCode: '',
    hasLaundryAccess: false,
    isActive: true
  });

  // Form State for Editing
  const [editForm, setEditForm] = useState({
    nodeNameAr: '',
    nodeType: 'child' as 'parent' | 'child',
    parentNodeId: '' as string | number,
    division: 'fb' as 'fb' | 'gs',
    managerUserId: '' as string | number,
    managerName: '',
    comsysStoreCode: '',
    hasLaundryAccess: false,
    isActive: true
  });

  const triggerSuccess = (msg: string) => {
    setPageSuccess(msg);
    setPageError(null);
    setTimeout(() => setPageSuccess(null), 5000);
  };

  const triggerError = (msg: string) => {
    setPageError(msg);
    setPageSuccess(null);
  };

  // ─── 1. FETCH OPERATIONAL WAREHOUSES & PARENTS (From Hierarchy Tree) ─────────
  const {
    data: warehouseData = { allWarehouses: [], parentEntities: [] },
    isLoading: isWarehousesLoading,
    isError: isWarehousesError,
    refetch: refetchWarehouses
  } = useQuery({
    queryKey: ['operationalWarehouses'],
    queryFn: () => warehousesApi.getOperationalWarehouses(true)
  });

  const rawAllWarehouses = warehouseData.allWarehouses;
  const rawParentEntities = warehouseData.parentEntities;

  const allWarehouses = React.useMemo(() => {
    if (isGlobalAdmin || !currentNodeId) return rawAllWarehouses;
    return rawAllWarehouses.filter(w => 
      (assignedWarehouse?.groupId && w.groupId === assignedWarehouse.groupId) ||
      w.nodeId === currentNodeId ||
      w.parentNodeId === currentNodeId ||
      childNodeIds.includes(w.nodeId)
    );
  }, [rawAllWarehouses, isGlobalAdmin, currentNodeId, assignedWarehouse, childNodeIds]);

  const parentEntities = React.useMemo(() => {
    if (isGlobalAdmin || !currentNodeId) return rawParentEntities;
    return rawParentEntities.filter(w => 
      (assignedWarehouse?.groupId && w.groupId === assignedWarehouse.groupId) ||
      w.nodeId === currentNodeId
    );
  }, [rawParentEntities, isGlobalAdmin, currentNodeId, assignedWarehouse]);

  // ─── 2. FETCH HOTEL GROUPS ───────────────────────────────────────────────────
  const { data: rawGroups = [] } = useQuery({
    queryKey: ['hotelGroups'],
    queryFn: hierarchyApi.getGroups
  });

  const groups = React.useMemo(() => {
    if (isGlobalAdmin || !assignedWarehouse?.groupId) return rawGroups;
    return rawGroups.filter(g => g.id === assignedWarehouse.groupId);
  }, [rawGroups, isGlobalAdmin, assignedWarehouse]);

  // ─── 3. FETCH COMSYS STORES (For Real ERP Linking) ───────────────────────────
  const { data: comsysStores = [] } = useQuery({
    queryKey: ['comsysWarehouses'],
    queryFn: () => warehousesApi.getComsysWarehouses()
  });

  // ─── 4. FETCH USERS (For Real Manager Assignment) ─────────────────────────────
  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: usersApi.getUsers
  });

  // Invalidate all related caches across the application
  const invalidateAllCaches = () => {
    queryClient.invalidateQueries({ queryKey: ['operationalWarehouses'] });
    queryClient.invalidateQueries({ queryKey: ['hierarchy-tree'] });
    queryClient.invalidateQueries({ queryKey: ['hierarchy'] });
    queryClient.invalidateQueries({ queryKey: ['warehouses'] });
    queryClient.invalidateQueries({ queryKey: ['users'] });
    queryClient.invalidateQueries({ queryKey: ['stock'] });
    queryClient.invalidateQueries({ queryKey: ['transfers'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  };

  // ─── 5. CREATE WAREHOUSE MUTATION ─────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: async (payload: CreateWarehousePayload) => {
      const res = await warehousesApi.createWarehouse(payload);
      return res;
    },
    onSuccess: async (data, variables) => {
      // If a real manager was assigned, link user to new warehouse node
      if (createForm.managerUserId && data?.id) {
        const assignedUser = users.find(u => Number(u.id) === Number(createForm.managerUserId));
        if (assignedUser) {
          try {
            await usersApi.updateUser(assignedUser.id, {
              fullNameAr: assignedUser.fullNameAr,
              role: assignedUser.role,
              nodeId: data.id,
              nodeIds: Array.from(new Set([...(assignedUser.nodeIds || []), data.id])),
              isActive: assignedUser.isActive
            });
          } catch (err) {
            console.warn('Note: Failed to update manager user nodeId:', err);
          }
        }
      }

      invalidateAllCaches();
      triggerSuccess(`تم إنشاء المستودع "${variables.nodeNameAr}" بنجاح وتعيينه تحت الكيان المحدد`);
      setIsCreateOpen(false);
      setModalError(null);
      setFieldErrors({});
      // Reset create form
      setCreateForm({
        nodeNameAr: '',
        nodeType: 'child',
        parentNodeId: '',
        groupId: '',
        division: 'fb',
        managerUserId: '',
        managerName: '',
        comsysStoreCode: '',
        hasLaundryAccess: false,
        isActive: true
      });
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || err.message || 'حدث خطأ أثناء إنشاء المستودع';
      setModalError(msg);
    }
  });

  // ─── 6. UPDATE WAREHOUSE MUTATION ─────────────────────────────────────────────
  const updateMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: number | string; payload: UpdateWarehousePayload }) => {
      return await warehousesApi.updateWarehouse(id, payload);
    },
    onSuccess: async (_, { id }) => {
      // If manager changed, update manager user nodeId
      if (editForm.managerUserId) {
        const assignedUser = users.find(u => Number(u.id) === Number(editForm.managerUserId));
        if (assignedUser && Number(assignedUser.nodeId) !== Number(id)) {
          try {
            await usersApi.updateUser(assignedUser.id, {
              fullNameAr: assignedUser.fullNameAr,
              role: assignedUser.role,
              nodeId: Number(id),
              nodeIds: Array.from(new Set([...(assignedUser.nodeIds || []), Number(id)])),
              isActive: assignedUser.isActive
            });
          } catch (err) {
            console.warn('Note: Failed to update manager user nodeId:', err);
          }
        }
      }

      invalidateAllCaches();
      triggerSuccess('تم حفظ تعديلات بيانات المستودع بنجاح');
      setEditingWarehouse(null);
      setModalError(null);
      setFieldErrors({});
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || err.message || 'حدث خطأ أثناء تعديل المستودع';
      setModalError(msg);
    }
  });

  // ─── 7. DELETE / DEACTIVATE MUTATION ──────────────────────────────────────────
  const deactivationMutation = useMutation({
    mutationFn: async ({ warehouse, newStatus }: { warehouse: Warehouse; newStatus: boolean }) => {
      const finalComsysCode = (!newStatus && unlinkComsysOnDeactivate) ? null : warehouse.comsysStoreCode;
      return await warehousesApi.updateWarehouse(warehouse.nodeId, {
        nodeNameAr: warehouse.name,
        nodeType: warehouse.nodeType,
        parentNodeId: warehouse.parentNodeId,
        division: warehouse.division,
        managerName: warehouse.managerName,
        comsysStoreCode: finalComsysCode,
        hasLaundryAccess: warehouse.hasLaundryAccess,
        isActive: newStatus
      });
    },
    onSuccess: (_, { warehouse, newStatus }) => {
      invalidateAllCaches();
      triggerSuccess(`تم ${newStatus ? 'تنشيط' : 'تعطيل'} المستودع "${warehouse.name}" بنجاح`);
      setDeactivatingWarehouse(null);
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || err.message || 'تعذر تغيير حالة المستودع';
      triggerError(msg);
      setDeactivatingWarehouse(null);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (nodeId: number) => {
      return await warehousesApi.deleteWarehouse(nodeId);
    },
    onSuccess: () => {
      invalidateAllCaches();
      triggerSuccess('تم حذف المستودع بنجاح من قاعدة البيانات');
      setDeletingWarehouse(null);
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || err.message || 'فشل حذف المستودع لوجود قيود وحركات مرتبطة به';
      triggerError(msg + ' (يُفضل استخدام خيار التعطيل للحفاظ على سلامة القيود المحاسبية)');
      setDeletingWarehouse(null);
    }
  });

  // ─── 8. FORM SUBMIT HANDLERS ──────────────────────────────────────────────────
  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);
    const errors: Record<string, string> = {};

    if (!createForm.nodeNameAr.trim() || createForm.nodeNameAr.trim().length < 3) {
      errors.nodeNameAr = 'اسم المستودع مطلوب ويجب أن يحتوي على 3 أحرف على الأقل';
    }

    // Determine Group ID
    let resolvedGroupId = Number(createForm.groupId);
    if (!resolvedGroupId && createForm.parentNodeId) {
      const parent = parentEntities.find(p => Number(p.nodeId) === Number(createForm.parentNodeId));
      if (parent && parent.groupId) {
        resolvedGroupId = parent.groupId;
      }
    }
    if (!resolvedGroupId && groups.length > 0) {
      resolvedGroupId = groups[0].id;
    }

    if (!resolvedGroupId) {
      errors.groupId = 'يجب تحديد المجموعة التابع لها هذا المستودع';
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    // Resolve manager name
    let finalManagerName = createForm.managerName.trim();
    if (createForm.managerUserId) {
      const matchedUser = users.find(u => Number(u.id) === Number(createForm.managerUserId));
      if (matchedUser) {
        finalManagerName = matchedUser.fullNameAr;
      }
    }

    createMutation.mutate({
      nodeNameAr: createForm.nodeNameAr.trim(),
      nodeType: createForm.nodeType,
      parentNodeId: createForm.parentNodeId ? Number(createForm.parentNodeId) : null,
      groupId: resolvedGroupId,
      division: createForm.division,
      managerName: finalManagerName || null,
      comsysStoreCode: createForm.comsysStoreCode.trim() || null,
      hasLaundryAccess: createForm.hasLaundryAccess,
      isActive: createForm.isActive
    });
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingWarehouse) return;
    setModalError(null);
    const errors: Record<string, string> = {};

    if (!editForm.nodeNameAr.trim() || editForm.nodeNameAr.trim().length < 3) {
      errors.nodeNameAr = 'اسم المستودع مطلوب ويجب أن يحتوي على 3 أحرف على الأقل';
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    let finalManagerName = editForm.managerName.trim();
    if (editForm.managerUserId) {
      const matchedUser = users.find(u => Number(u.id) === Number(editForm.managerUserId));
      if (matchedUser) {
        finalManagerName = matchedUser.fullNameAr;
      }
    }

    updateMutation.mutate({
      id: editingWarehouse.nodeId,
      payload: {
        nodeNameAr: editForm.nodeNameAr.trim(),
        nodeType: editForm.nodeType,
        parentNodeId: editForm.parentNodeId ? Number(editForm.parentNodeId) : null,
        division: editForm.division,
        managerName: finalManagerName || null,
        comsysStoreCode: editForm.comsysStoreCode.trim() || null,
        hasLaundryAccess: editForm.hasLaundryAccess,
        isActive: editForm.isActive
      }
    });
  };

  // Open Edit Modal with warehouse pre-populated
  const openEditModal = (w: Warehouse) => {
    setEditingWarehouse(w);
    setModalError(null);
    setFieldErrors({});

    // Attempt to match manager user by name
    const matchedUser = users.find(u => u.fullNameAr === w.managerName || u.nodeId === w.nodeId);

    setEditForm({
      nodeNameAr: w.name,
      nodeType: w.nodeType,
      parentNodeId: w.parentNodeId ? String(w.parentNodeId) : '',
      division: w.division,
      managerUserId: matchedUser ? String(matchedUser.id) : '',
      managerName: w.managerName || '',
      comsysStoreCode: w.comsysStoreCode || '',
      hasLaundryAccess: w.hasLaundryAccess,
      isActive: w.isActive
    });
  };

  // ─── 9. FILTERING & SEARCH ────────────────────────────────────────────────────
  const filteredWarehouses = useMemo(() => {
    return allWarehouses.filter(w => {
      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = w.name.toLowerCase().includes(q);
        const matchesCode = (w.comsysStoreCode || '').toLowerCase().includes(q);
        const matchesManager = (w.managerName || '').toLowerCase().includes(q);
        const matchesParent = (w.parentName || '').toLowerCase().includes(q);
        if (!matchesName && !matchesCode && !matchesManager && !matchesParent) return false;
      }

      // Parent Entity filter
      if (selectedParentFilter !== 'all') {
        if (String(w.parentNodeId) !== selectedParentFilter) return false;
      }

      // Division filter
      if (selectedDivisionFilter !== 'all') {
        if (w.division !== selectedDivisionFilter) return false;
      }

      // Status filter
      if (selectedStatusFilter !== 'all') {
        const isAct = selectedStatusFilter === 'active';
        if (w.isActive !== isAct) return false;
      }

      // Unit Type filter
      if (selectedTypeFilter !== 'all') {
        if (w.nodeType !== selectedTypeFilter) return false;
      }

      return true;
    });
  }, [allWarehouses, searchQuery, selectedParentFilter, selectedDivisionFilter, selectedStatusFilter, selectedTypeFilter]);

  // Pagination slice
  const totalPages = Math.ceil(filteredWarehouses.length / itemsPerPage) || 1;
  const paginatedWarehouses = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredWarehouses.slice(start, start + itemsPerPage);
  }, [filteredWarehouses, currentPage]);

  // Overall Statistics KPIs
  const totalStockCount = useMemo(() => {
    return allWarehouses.reduce((sum, w) => sum + (w.currentStock || 0), 0);
  }, [allWarehouses]);

  const activeWarehousesCount = useMemo(() => {
    return allWarehouses.filter(w => w.isActive).length;
  }, [allWarehouses]);

  return (
    <div className="flex flex-col gap-6 font-arabic dir-rtl select-none text-right">
      
      {/* ─── HEADER & ACTIONS ──────────────────────────────────────────────── */}
      <div className="bg-white border border-slate-200/80 p-6 rounded-2xl shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100">
              <WarehouseIcon size={22} />
            </div>
            <div>
              <h1 className="text-xl lg:text-2xl font-extrabold text-slate-800">
                إدارة المستودعات والوحدات التخزينية
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                إدارة مستودعات الكيانات والفنادق، ربط الأرصدة التشغيلية، وتخصيص الصلاحيات ومسؤولي العهد.
              </p>
            </div>
          </div>
        </div>

        {canManageNodes && (
          <Button
            variant="primary"
            onClick={() => {
              setIsCreateOpen(true);
              setModalError(null);
              setFieldErrors({});
            }}
            className="flex items-center gap-2 shadow-sm shadow-blue-600/20"
          >
            <Plus size={18} />
            <span>إضافة مستودع جديد</span>
          </Button>
        )}
      </div>

      {/* ─── ALERT BANNERS ─────────────────────────────────────────────────── */}
      {pageSuccess && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-xl flex items-center justify-between animate-fade-in text-sm">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={18} className="text-emerald-600 flex-shrink-0" />
            <span>{pageSuccess}</span>
          </div>
          <button onClick={() => setPageSuccess(null)} className="text-emerald-600 hover:text-emerald-800 cursor-pointer">
            <X size={16} />
          </button>
        </div>
      )}

      {pageError && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 p-4 rounded-xl flex items-center justify-between animate-fade-in text-sm">
          <div className="flex items-center gap-2">
            <AlertCircle size={18} className="text-rose-600 flex-shrink-0" />
            <span>{pageError}</span>
          </div>
          <button onClick={() => setPageError(null)} className="text-rose-600 hover:text-rose-800 cursor-pointer">
            <X size={16} />
          </button>
        </div>
      )}

      {/* ─── KPI SUMMARY CARDS ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-slate-200/70 shadow-2xs">
          <Card.Body className="p-4 flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-slate-500">إجمالي المستودعات الفرعية</span>
              <div className="text-2xl font-black text-slate-800 mt-1">
                {allWarehouses.length} <span className="text-xs font-semibold text-slate-400">مستودع</span>
              </div>
            </div>
            <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <WarehouseIcon size={22} />
            </div>
          </Card.Body>
        </Card>

        <Card className="border-slate-200/70 shadow-2xs">
          <Card.Body className="p-4 flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-slate-500">المستودعات التشغيلية النشطة</span>
              <div className="text-2xl font-black text-emerald-600 mt-1">
                {activeWarehousesCount} <span className="text-xs font-semibold text-emerald-400">نشط</span>
              </div>
            </div>
            <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 size={22} />
            </div>
          </Card.Body>
        </Card>

        <Card className="border-slate-200/70 shadow-2xs">
          <Card.Body className="p-4 flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-slate-500">الكيانات والمنشآت الأم</span>
              <div className="text-2xl font-black text-amber-600 mt-1">
                {parentEntities.length} <span className="text-xs font-semibold text-amber-400">كيان رئيسي</span>
              </div>
            </div>
            <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Hotel size={22} />
            </div>
          </Card.Body>
        </Card>

        <Card className="border-slate-200/70 shadow-2xs">
          <Card.Body className="p-4 flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-slate-500">إجمالي الرصيد المخزني</span>
              <div className="text-2xl font-black text-slate-800 mt-1">
                {totalStockCount.toLocaleString()} <span className="text-xs font-semibold text-slate-400">وحدة</span>
              </div>
            </div>
            <div className="w-11 h-11 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <Package size={22} />
            </div>
          </Card.Body>
        </Card>
      </div>

      {/* ─── SEARCH & FILTER TOOLBAR ───────────────────────────────────────── */}
      <Card className="border-slate-200/80 shadow-2xs">
        <Card.Body className="p-4 flex flex-col md:flex-row items-center justify-between gap-3">
          {/* Search bar */}
          <div className="relative w-full md:w-80">
            <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="بحث باسم المستودع، الكيان، أو المسؤول..."
              className="w-full pl-3 pr-9 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:border-blue-500 focus:bg-white transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Filters row */}
          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            {/* Filter by Parent Entity */}
            <select
              value={selectedParentFilter}
              onChange={(e) => {
                setSelectedParentFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 focus:outline-none focus:border-blue-500 cursor-pointer"
            >
              <option value="all">جميع الكيانات التابعة</option>
              {parentEntities.map(p => (
                <option key={p.nodeId} value={String(p.nodeId)}>
                  {p.name}
                </option>
              ))}
            </select>

            {/* Filter by Unit Type (Parent vs Child) */}
            <select
              value={selectedTypeFilter}
              onChange={(e) => {
                setSelectedTypeFilter(e.target.value as any);
                setCurrentPage(1);
              }}
              className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 focus:outline-none focus:border-blue-500 cursor-pointer"
            >
              <option value="all">كل الأنواع (مستودعات وكيانات)</option>
              <option value="child">مستودعات تشغيلية فرعية</option>
              <option value="parent">كيانات وفنادق أم</option>
            </select>

            {/* Filter by Division */}
            <select
              value={selectedDivisionFilter}
              onChange={(e) => {
                setSelectedDivisionFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 focus:outline-none focus:border-blue-500 cursor-pointer"
            >
              <option value="all">كل الأقسام</option>
              <option value="fb">أغذية ومشروبات (F&B)</option>
              <option value="gs">مهمات عامة (GS)</option>
            </select>

            {/* Filter by Status */}
            <select
              value={selectedStatusFilter}
              onChange={(e) => {
                setSelectedStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 focus:outline-none focus:border-blue-500 cursor-pointer"
            >
              <option value="all">كل الحالات</option>
              <option value="active">نشط فقط</option>
              <option value="inactive">معطل فقط</option>
            </select>

            {/* Refresh Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetchWarehouses()}
              className="p-2 border-slate-200"
              title="تحديث البيانات"
            >
              <RefreshCw size={15} className={isWarehousesLoading ? 'animate-spin' : ''} />
            </Button>
          </div>
        </Card.Body>
      </Card>

      {/* ─── WAREHOUSES TABLE ──────────────────────────────────────────────── */}
      <Card className="border-slate-200/80 shadow-xs overflow-hidden">
        {isWarehousesLoading ? (
          <div className="p-12 flex justify-center items-center">
            <Loader size="lg" label="جاري جلب بيانات شجرة المستودعات من السيرفر..." />
          </div>
        ) : isWarehousesError ? (
          <div className="p-12 text-center text-rose-600 text-sm">
            فشل تحميل بيانات المستودعات من السيرفر. يرجى التأكد من تشغيل خادم الـ API.
          </div>
        ) : filteredWarehouses.length === 0 ? (
          <div className="p-12">
            <EmptyState
              icon={WarehouseIcon}
              title="لا توجد مستودعات مطابقة"
              description="لم يتم العثور على أي مستودعات تطابق خيارات البحث والتصفية المحددة."
            />
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-right border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 text-xs font-bold uppercase tracking-wider">
                    <th className="py-3.5 px-4">المستودع التشغيلي</th>
                    <th className="py-3.5 px-4">الكيان التابع له</th>
                    <th className="py-3.5 px-4">المجموعة</th>
                    <th className="py-3.5 px-4">القسم</th>
                    <th className="py-3.5 px-4">ربط كومسيس</th>
                    <th className="py-3.5 px-4">المغسلة</th>
                    <th className="py-3.5 px-4">أمين المستودع</th>
                    <th className="py-3.5 px-4">الرصيد المتاح</th>
                    <th className="py-3.5 px-4">الحالة</th>
                    {canManageNodes && <th className="py-3.5 px-4 text-center">الإجراءات</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                  {paginatedWarehouses.map((w) => (
                    <tr
                      key={w.nodeId}
                      className="hover:bg-blue-50/30 transition-colors duration-100 group"
                    >
                      {/* Name & ID */}
                      <td className="py-3.5 px-4 font-bold text-slate-900">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
                            w.nodeType === 'parent'
                              ? 'bg-purple-50 text-purple-700 border border-purple-200'
                              : w.division === 'fb' 
                              ? 'bg-amber-50 text-amber-600 border border-amber-100' 
                              : 'bg-blue-50 text-blue-600 border border-blue-100'
                          }`}>
                            {w.nodeType === 'parent' ? <Hotel size={14} /> : <WarehouseIcon size={14} />}
                          </div>
                          <div className="flex flex-col">
                            <div className="flex items-center gap-1.5">
                              <span className="leading-snug">{w.name}</span>
                              {w.nodeType === 'parent' && (
                                <span className="text-[9px] bg-purple-100 text-purple-800 font-bold px-1.5 py-0.2 rounded border border-purple-200">
                                  كيان أم
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] font-mono text-slate-400 font-normal">
                              Node #{w.nodeId}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Parent Entity Badge */}
                      <td className="py-3.5 px-4 font-semibold text-slate-700">
                        <div className="flex items-center gap-1.5">
                          <Building2 size={13} className="text-slate-400" />
                          <span>{w.parentName}</span>
                        </div>
                      </td>

                      {/* Group */}
                      <td className="py-3.5 px-4 text-slate-600">
                        {w.groupName || '—'}
                      </td>

                      {/* Division */}
                      <td className="py-3.5 px-4">
                        <Badge variant={w.division === 'fb' ? 'warning' : 'info'}>
                          {w.division === 'fb' ? 'أغذية ومشروبات' : 'مهمات عامة'}
                        </Badge>
                      </td>

                      {/* COMSYS Link */}
                      <td className="py-3.5 px-4">
                        {w.comsysStoreCode ? (
                          <span className="inline-flex items-center gap-1 font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/70 font-bold">
                            <Link2 size={11} />
                            <span>{w.comsysStoreCode}</span>
                          </span>
                        ) : (
                          <span className="text-slate-400 font-medium">داخلي (غير مربوط)</span>
                        )}
                      </td>

                      {/* Laundry access */}
                      <td className="py-3.5 px-4">
                        {w.hasLaundryAccess ? (
                          <span className="inline-flex items-center gap-1 text-blue-700 font-semibold bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100">
                            <WashingMachine size={12} />
                            <span>مفعل</span>
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      {/* Manager */}
                      <td className="py-3.5 px-4 font-medium text-slate-800">
                        <div className="flex items-center gap-1.5">
                          <UserIcon size={12} className="text-slate-400" />
                          <span>{w.managerName || w.manager || '—'}</span>
                        </div>
                      </td>

                      {/* Current Stock */}
                      <td className="py-3.5 px-4 font-bold text-slate-900">
                        <span className="font-mono">{w.currentStock.toLocaleString()}</span>
                        <span className="text-[10px] text-slate-400 mr-1 font-normal">وحدة</span>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        <Badge variant={w.isActive ? 'success' : 'neutral'}>
                          {w.isActive ? 'نشط' : 'معطل'}
                        </Badge>
                      </td>

                      {/* Actions */}
                      {canManageNodes && (
                        <td className="py-3.5 px-4 text-center">
                          <div className="flex items-center justify-center gap-1">
                            {/* Edit Button */}
                            <button
                              onClick={() => openEditModal(w)}
                              className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors cursor-pointer"
                              title="تعديل بيانات المستودع"
                            >
                              <Edit3 size={15} />
                            </button>

                            {/* Toggle Active / Deactivate */}
                            <button
                              onClick={() => setDeactivatingWarehouse(w)}
                              className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                                w.isActive
                                  ? 'text-slate-500 hover:text-amber-600 hover:bg-amber-50'
                                  : 'text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50'
                              }`}
                              title={w.isActive ? 'تعطيل المستودع مؤقتاً' : 'إعادة تنشيط المستودع'}
                            >
                              <Power size={15} />
                            </button>

                            {/* Delete Button */}
                            <button
                              onClick={() => setDeletingWarehouse(w)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors cursor-pointer"
                              title="حذف المستودع نهائياً"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="p-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 bg-slate-50/50">
                <span>
                  عرض {((currentPage - 1) * itemsPerPage) + 1} إلى {Math.min(currentPage * itemsPerPage, filteredWarehouses.length)} من إجمالي {filteredWarehouses.length} مستودع
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  >
                    السابق
                  </Button>
                  <span className="px-3 py-1 font-bold text-slate-700">
                    صفحة {currentPage} من {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  >
                    التالي
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </Card>

      {/* ─── CREATE WAREHOUSE MODAL ────────────────────────────────────────── */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => {
          setIsCreateOpen(false);
          setModalError(null);
          setFieldErrors({});
        }}
        title="إضافة مستودع تشغيلي جديد للنظام"
        size="lg"
      >
        <form onSubmit={handleCreateSubmit} className="flex flex-col gap-4 font-arabic text-right dir-rtl">
          {modalError && (
            <div className="bg-rose-50 border border-rose-200 text-rose-800 text-xs p-3 rounded-lg flex items-center gap-2">
              <AlertCircle size={16} className="text-rose-600 flex-shrink-0" />
              <span>{modalError}</span>
            </div>
          )}

          {/* 1. Warehouse Name & Node Type */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Input
                label="اسم المستودع باللغة العربية *"
                placeholder="مثال: مطبخ جاردن الإيطالي، مستودع الأغذية الرئيسي"
                value={createForm.nodeNameAr}
                onChange={(e) => {
                  setCreateForm(prev => ({ ...prev, nodeNameAr: e.target.value }));
                  setFieldErrors(prev => ({ ...prev, nodeNameAr: '' }));
                }}
                error={fieldErrors.nodeNameAr}
                autoFocus
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-slate-700">نوع الوحدة في الهيكل *</label>
              <select
                value={createForm.nodeType}
                onChange={(e) => setCreateForm(prev => ({ ...prev, nodeType: e.target.value as 'parent' | 'child' }))}
                className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-blue-500"
              >
                <option value="child">مستودع تشغيلي / فرعي (Child Warehouse)</option>
                <option value="parent">كيان / منشأة رئيسية مستقلة (Parent Entity)</option>
              </select>
              <span className="text-[10px] text-slate-400">
                المستودع التشغيلي يتم تعيينه تحت كيان/فندق أم لاستقبال وصرف البضائع.
              </span>
            </div>
          </div>

          {/* 2. Parent Entity (Hotel/Parent Node) & Group */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                <span>الكيان / الفندق التابع له *</span>
                <span className="text-[10px] font-normal text-blue-600">علاقة هرمية مباشرة</span>
              </label>
              <select
                value={createForm.parentNodeId}
                onChange={(e) => {
                  const val = e.target.value;
                  const parent = parentEntities.find(p => String(p.nodeId) === val);
                  setCreateForm(prev => ({
                    ...prev,
                    parentNodeId: val,
                    groupId: parent ? parent.groupId : prev.groupId
                  }));
                }}
                className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-blue-500"
              >
                <option value="">— اختر الكيان أو الفندق الأم —</option>
                {parentEntities.map(p => (
                  <option key={p.nodeId} value={p.nodeId}>
                    {p.name} ({p.groupName})
                  </option>
                ))}
              </select>
              <span className="text-[10px] text-slate-400">
                سيتم إدراج المستودع تنظيمياً تحت الكيان المحدد في شجرة المستودعات.
              </span>
            </div>

            {/* Hotel Group Selection */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-slate-700">المجموعة / الفندق القابض *</label>
              <select
                value={createForm.groupId}
                onChange={(e) => setCreateForm(prev => ({ ...prev, groupId: e.target.value }))}
                className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-blue-500"
              >
                <option value="">— اختر المجموعة —</option>
                {groups.map(g => (
                  <option key={g.id} value={g.id}>
                    {g.groupNameAr} ({g.groupCode})
                  </option>
                ))}
              </select>
              {fieldErrors.groupId && (
                <span className="text-xs text-red-600 font-semibold">{fieldErrors.groupId}</span>
              )}
            </div>
          </div>

          {/* 3. Division & COMSYS Store Code */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-slate-700">القسم التشغيلي *</label>
              <select
                value={createForm.division}
                onChange={(e) => setCreateForm(prev => ({ ...prev, division: e.target.value as 'fb' | 'gs' }))}
                className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-blue-500"
              >
                <option value="fb">أغذية ومشروبات (Food & Beverage - fb)</option>
                <option value="gs">مهمات ومخازن عامة (General Stores - gs)</option>
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                <span>ربط بنظام كومسيس (COMSYS Store)</span>
                <span className="text-[10px] text-emerald-600 font-bold">مزامنة الأرصدة تلقائياً</span>
              </label>
              <select
                value={createForm.comsysStoreCode}
                onChange={(e) => setCreateForm(prev => ({ ...prev, comsysStoreCode: e.target.value }))}
                className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-blue-500"
              >
                <option value="">— مستودع داخلي بدون ربط بكومسيس —</option>
                {comsysStores
                  .filter(cs => cs.division === createForm.division)
                  .map(cs => {
                    const assignedWarehouse = allWarehouses.find(w => w.comsysStoreCode === cs.storeCode);
                    return (
                      <option
                        key={cs.id}
                        value={cs.storeCode}
                        disabled={Boolean(assignedWarehouse)}
                        className={assignedWarehouse ? 'text-slate-400 bg-slate-100' : 'text-slate-900 font-semibold'}
                      >
                        [{cs.storeCode}] {cs.storeNameAr} {assignedWarehouse ? `(مربوط بالفعل بـ: ${assignedWarehouse.name})` : '✓ متاح'}
                      </option>
                    );
                  })}
              </select>
              <span className="text-[10px] text-slate-400">
                عند تحديد كود كومسيس، سيقوم النظام باستيراد ومطابقة أرصدة الكتان والمخزون آلياً.
              </span>
            </div>
          </div>

          {/* 4. Manager Assignment */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                <span>أمين المستودع (من سجل المستخدمين)</span>
                <span className="text-[10px] text-blue-600">عزل الصلاحيات تلقائياً</span>
              </label>
              <select
                value={createForm.managerUserId}
                onChange={(e) => {
                  const uId = e.target.value;
                  const u = users.find(usr => String(usr.id) === uId);
                  setCreateForm(prev => ({
                    ...prev,
                    managerUserId: uId,
                    managerName: u ? u.fullNameAr : prev.managerName
                  }));
                }}
                className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-blue-500"
              >
                <option value="">— اختر مستخدم كأمين للمستودع —</option>
                {users.map(u => (
                  <option key={u.id} value={u.id}>
                    {u.fullNameAr} ({u.username}) — دور: {u.role}
                  </option>
                ))}
              </select>
              <span className="text-[10px] text-slate-400">
                ربط المستخدم بالمستودع يمنحه صلاحية الدخول المباشر لهذا المستودع فقط.
              </span>
            </div>

            <div>
              <Input
                label="اسم المسؤول المطبوع (اختياري)"
                placeholder="اسم المسؤول في التقارير"
                value={createForm.managerName}
                onChange={(e) => setCreateForm(prev => ({ ...prev, managerName: e.target.value }))}
              />
            </div>
          </div>

          {/* 5. Toggles: Laundry & Active Status */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/70 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mt-2">
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={createForm.hasLaundryAccess}
                onChange={(e) => setCreateForm(prev => ({ ...prev, hasLaundryAccess: e.target.checked }))}
                className="w-4 h-4 text-blue-600 rounded-sm border-slate-300 focus:ring-blue-500 cursor-pointer"
              />
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <WashingMachine size={15} className="text-blue-600" />
                <span>تمكين حركات المغسلة وشحن البياضات لهذا المستودع</span>
              </span>
            </label>

            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={createForm.isActive}
                onChange={(e) => setCreateForm(prev => ({ ...prev, isActive: e.target.checked }))}
                className="w-4 h-4 text-emerald-600 rounded-sm border-slate-300 focus:ring-emerald-500 cursor-pointer"
              />
              <span className="text-xs font-bold text-emerald-700 flex items-center gap-1">
                <Check size={14} />
                <span>المستودع نشط فور الإنشاء</span>
              </span>
            </label>
          </div>

          {/* Actions */}
          <div className="flex justify-end items-center gap-2 pt-4 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setIsCreateOpen(false);
                setModalError(null);
                setFieldErrors({});
              }}
            >
              إلغاء
            </Button>
            <Button
              type="submit"
              variant="primary"
              isLoading={createMutation.isPending}
            >
              حفظ وإنشاء المستودع
            </Button>
          </div>
        </form>
      </Modal>

      {/* ─── EDIT WAREHOUSE MODAL ──────────────────────────────────────────── */}
      <Modal
        isOpen={!!editingWarehouse}
        onClose={() => {
          setEditingWarehouse(null);
          setModalError(null);
          setFieldErrors({});
        }}
        title={`تعديل بيانات المستودع: ${editingWarehouse?.name || ''}`}
        size="lg"
      >
        <form onSubmit={handleEditSubmit} className="flex flex-col gap-4 font-arabic text-right dir-rtl">
          {modalError && (
            <div className="bg-rose-50 border border-rose-200 text-rose-800 text-xs p-3 rounded-lg flex items-center gap-2">
              <AlertCircle size={16} className="text-rose-600 flex-shrink-0" />
              <span>{modalError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Input
                label="اسم المستودع باللغة العربية *"
                value={editForm.nodeNameAr}
                onChange={(e) => {
                  setEditForm(prev => ({ ...prev, nodeNameAr: e.target.value }));
                  setFieldErrors(prev => ({ ...prev, nodeNameAr: '' }));
                }}
                error={fieldErrors.nodeNameAr}
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-slate-700">الكيان / الفندق التابع له</label>
              <select
                value={editForm.parentNodeId}
                onChange={(e) => setEditForm(prev => ({ ...prev, parentNodeId: e.target.value }))}
                className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-blue-500"
              >
                <option value="">— كيان رئيسي مستقل (بدون كيان أب) —</option>
                {parentEntities
                  .filter(p => p.nodeId !== editingWarehouse?.nodeId)
                  .map(p => (
                    <option key={p.nodeId} value={p.nodeId}>
                      {p.name} ({p.groupName})
                    </option>
                  ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-slate-700">القسم التشغيلي *</label>
              <select
                value={editForm.division}
                onChange={(e) => setEditForm(prev => ({ ...prev, division: e.target.value as 'fb' | 'gs' }))}
                className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-blue-500"
              >
                <option value="fb">أغذية ومشروبات (F&B)</option>
                <option value="gs">مهمات ومخازن عامة (GS)</option>
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-slate-700">ربط بنظام كومسيس (COMSYS Store)</label>
              <select
                value={editForm.comsysStoreCode}
                onChange={(e) => setEditForm(prev => ({ ...prev, comsysStoreCode: e.target.value }))}
                className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-blue-500"
              >
                <option value="">— مستودع داخلي بدون ربط بكومسيس —</option>
                {comsysStores
                  .filter(cs => cs.division === editForm.division)
                  .map(cs => {
                    const assignedWarehouse = allWarehouses.find(w => w.comsysStoreCode === cs.storeCode && w.nodeId !== editingWarehouse?.nodeId);
                    return (
                      <option
                        key={cs.id}
                        value={cs.storeCode}
                        disabled={Boolean(assignedWarehouse)}
                        className={assignedWarehouse ? 'text-slate-400 bg-slate-100' : 'text-slate-900 font-semibold'}
                      >
                        [{cs.storeCode}] {cs.storeNameAr} {assignedWarehouse ? `(مربوط بـ: ${assignedWarehouse.name})` : '✓ متاح'}
                      </option>
                    );
                  })}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-slate-700">تخصيص أمين المستودع (من المستخدمين)</label>
              <select
                value={editForm.managerUserId}
                onChange={(e) => {
                  const uId = e.target.value;
                  const u = users.find(usr => String(usr.id) === uId);
                  setEditForm(prev => ({
                    ...prev,
                    managerUserId: uId,
                    managerName: u ? u.fullNameAr : prev.managerName
                  }));
                }}
                className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-blue-500"
              >
                <option value="">— بدون تغيير أمين المستودع —</option>
                {users.map(u => (
                  <option key={u.id} value={u.id}>
                    {u.fullNameAr} ({u.username})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Input
                label="اسم المسؤول في التقارير"
                value={editForm.managerName}
                onChange={(e) => setEditForm(prev => ({ ...prev, managerName: e.target.value }))}
              />
            </div>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/70 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mt-2">
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={editForm.hasLaundryAccess}
                onChange={(e) => setEditForm(prev => ({ ...prev, hasLaundryAccess: e.target.checked }))}
                className="w-4 h-4 text-blue-600 rounded-sm border-slate-300 focus:ring-blue-500 cursor-pointer"
              />
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <WashingMachine size={15} className="text-blue-600" />
                <span>تمكين حركات المغسلة وشحن البياضات</span>
              </span>
            </label>

            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={editForm.isActive}
                onChange={(e) => setEditForm(prev => ({ ...prev, isActive: e.target.checked }))}
                className="w-4 h-4 text-emerald-600 rounded-sm border-slate-300 focus:ring-emerald-500 cursor-pointer"
              />
              <span className="text-xs font-bold text-slate-800">حالة المستودع: {editForm.isActive ? 'نشط' : 'معطل'}</span>
            </label>
          </div>

          <div className="flex justify-end items-center gap-2 pt-4 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setEditingWarehouse(null);
                setModalError(null);
                setFieldErrors({});
              }}
            >
              إلغاء
            </Button>
            <Button
              type="submit"
              variant="primary"
              isLoading={updateMutation.isPending}
            >
              حفظ التعديلات
            </Button>
          </div>
        </form>
      </Modal>

      {/* ─── DEACTIVATION CONFIRMATION MODAL ────────────────────────────────── */}
      <Modal
        isOpen={!!deactivatingWarehouse}
        onClose={() => setDeactivatingWarehouse(null)}
        title={deactivatingWarehouse?.isActive ? 'تأكيد تعطيل المستودع مؤقتاً' : 'تأكيد إعادة تنشيط المستودع'}
        size="md"
      >
        <div className="flex flex-col gap-4 font-arabic text-right dir-rtl">
          <div className="flex items-start gap-3 p-3.5 bg-amber-50 rounded-xl border border-amber-200/70 text-amber-900 text-xs leading-relaxed">
            <AlertCircle size={20} className="text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              {deactivatingWarehouse?.isActive ? (
                <>
                  أنت على وشك <strong>إلغاء تنشيط (تعطيل)</strong> المستودع: <strong>{deactivatingWarehouse?.name}</strong>.
                  <p className="mt-1 text-slate-600">
                    المستودع المعطل لا يمكن اختياره في حركات تحويل جديدة أو صرف مواد، ولكن سجلاته وحركاته السابقة تبقى محفوظة في التقارير التاريخية ومطابقة الأرصدة.
                  </p>
                </>
              ) : (
                <>
                  أنت على وشك <strong>إعادة تنشيط</strong> المستودع: <strong>{deactivatingWarehouse?.name}</strong> ليكون متاحاً لعمليات الصرف والتحويل مجدداً.
                </>
              )}
            </div>
          </div>

          {deactivatingWarehouse?.isActive && deactivatingWarehouse.comsysStoreCode && (
            <div className="p-3 bg-blue-50/80 rounded-xl border border-blue-200/80 flex flex-col gap-1.5">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={unlinkComsysOnDeactivate}
                  onChange={(e) => setUnlinkComsysOnDeactivate(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                />
                <span className="text-xs font-bold text-slate-800">
                  فصل كود كومسيس ({deactivatingWarehouse.comsysStoreCode}) تلقائياً عند التعطيل
                </span>
              </label>
              <p className="text-[11px] text-slate-500 pr-6">
                سيقوم النظام بتحرير كود كومسيس ليصبح متاحاً للربط مع مستودع آخر، ومنع أي تأثير أو تعارض على مزامنة COMSYS.
              </p>
            </div>
          )}

          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs text-slate-600 flex justify-between items-center">
            <span>الرصيد الفعلي الحالي:</span>
            <span className="font-bold text-slate-900 font-mono text-sm">
              {deactivatingWarehouse?.currentStock?.toLocaleString() || 0} وحدة
            </span>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => setDeactivatingWarehouse(null)}
            >
              إلغاء
            </Button>
            <Button
              variant={deactivatingWarehouse?.isActive ? 'danger' : 'primary'}
              isLoading={deactivationMutation.isPending}
              onClick={() => {
                if (deactivatingWarehouse) {
                  deactivationMutation.mutate({
                    warehouse: deactivatingWarehouse,
                    newStatus: !deactivatingWarehouse.isActive
                  });
                }
              }}
            >
              {deactivatingWarehouse?.isActive ? 'تأكيد التعطيل' : 'تأكيد التنشيط'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ─── PERMANENT DELETE CONFIRMATION MODAL ─────────────────────────────── */}
      <Modal
        isOpen={!!deletingWarehouse}
        onClose={() => setDeletingWarehouse(null)}
        title={deletingWarehouse?.nodeType === 'parent' ? 'تأكيد حذف الكيان من الهيكل التنظيمي' : 'تأكيد حذف المستودع من الهيكل التنظيمي'}
        size="md"
      >
        <div className="flex flex-col gap-4 font-arabic text-right dir-rtl">
          {deletingWarehouse && deletingWarehouse.currentStock > 0 ? (
            <div className="flex flex-col gap-3 p-4 bg-rose-50 rounded-xl border border-rose-200 text-rose-900 text-xs leading-relaxed">
              <div className="flex items-center gap-2 font-bold text-rose-800 text-sm">
                <ShieldAlert size={18} className="text-rose-600 flex-shrink-0" />
                <span>لا يمكن حذف هذا المستودع نهائياً!</span>
              </div>
              <p>
                المستودع <strong>"{deletingWarehouse.name}"</strong> يحتوي حالياً على رصيد مخزني فعلي قدره{' '}
                <strong>{deletingWarehouse.currentStock.toLocaleString()} وحدة</strong>.
              </p>
              <p className="text-slate-600">
                الحذف النهائي سيؤدي إلى تدمير سلامة القيود المخزنية وكسر العلاقات المحاسبية المرتبطة بالتحويلات. لحل ذلك، يرجى <strong>تعطيل المستودع</strong> بدلاً من حذفه نهائياً.
              </p>
            </div>
          ) : deletingWarehouse && allWarehouses.filter(w => w.parentNodeId === deletingWarehouse.nodeId).length > 0 ? (
            <div className="flex flex-col gap-3 p-4 bg-amber-50 rounded-xl border border-amber-200 text-amber-900 text-xs leading-relaxed">
              <div className="flex items-center gap-2 font-bold text-amber-800 text-sm">
                <ShieldAlert size={18} className="text-amber-600 flex-shrink-0" />
                <span>لا يمكن حذف هذا الكيان لاحتوائه على مستودعات تابعة!</span>
              </div>
              <p>
                الكيان/المنشأة <strong>"{deletingWarehouse.name}"</strong> يحتوي حالياً على{' '}
                <strong>{allWarehouses.filter(w => w.parentNodeId === deletingWarehouse.nodeId).length} مستودعات/وحدات فرعية تابعة له</strong> في الهيكل التنظيمي.
              </p>
              <p className="text-slate-600">
                قاعدة البيانات تمنع حذف الكيان الرئيسي قبل حذف أو نقل كافة المستودعات الفرعية التابعة له. لحل ذلك، يرجى حذف المستودعات الفرعية أولاً أو <strong>تعطيل الكيان</strong> بدلاً من حذفه.
              </p>
            </div>
          ) : (
            <div className="flex items-start gap-3 p-3.5 bg-rose-50 rounded-xl border border-rose-200 text-rose-900 text-xs leading-relaxed">
              <AlertCircle size={20} className="text-rose-600 flex-shrink-0 mt-0.5" />
              <div>
                هل أنت متأكد من حذف {deletingWarehouse?.nodeType === 'parent' ? 'الكيان الرئيسي' : 'المستودع'} <strong>"{deletingWarehouse?.name}"</strong> نهائياً من قاعدة البيانات؟
                <p className="mt-1 text-slate-600">
                  لا يمكن التراجع عن هذا الإجراء إذا لم تكن هناك حركات مسجلة. إذا كان المستودع مستخدماً في حركات سابقة، سيرفض الخادم العملية حفاظاً على سلامة البيانات.
                </p>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => setDeletingWarehouse(null)}
            >
              إلغاء
            </Button>
            {deletingWarehouse && (deletingWarehouse.currentStock > 0 || allWarehouses.filter(w => w.parentNodeId === deletingWarehouse.nodeId).length > 0) ? (
              <Button
                variant="primary"
                onClick={() => {
                  const target = deletingWarehouse;
                  setDeletingWarehouse(null);
                  setDeactivatingWarehouse(target);
                }}
              >
                تعطيل بدلاً من الحذف
              </Button>
            ) : (
              <Button
                variant="danger"
                isLoading={deleteMutation.isPending}
                onClick={() => {
                  if (deletingWarehouse) {
                    deleteMutation.mutate(deletingWarehouse.nodeId);
                  }
                }}
              >
                تأكيد الحذف النهائي
              </Button>
            )}
          </div>
        </div>
      </Modal>

    </div>
  );
}