import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  ArrowRightLeft,
  Shirt,
  Search,
  History,
  AlertCircle,
  CheckCircle2,
  RotateCw,
  User,
  Building2,
  Calendar,
  X,
  FileSpreadsheet,
  ChevronRight,
  ChevronLeft,
  ChevronsRight,
  ChevronsLeft,
  Plus,
  UserMinus,
  UserPlus,
  Trash2,
  Barcode,
  Package,
  Check
} from 'lucide-react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Loader from '../../components/ui/Loader';
import EmptyState from '../../components/ui/EmptyState';
import Modal from '../../components/ui/Modal';
import { laundryApi } from '../../api/laundry.api';

interface CustodyItem {
  userItemId: number;
  itemId: number;
  itemName: string;
  itemCode: string;
  assignedDate: string;
  userId: number | null;
  isAssigned?: boolean | number;
  userCode?: string;
  employeeName: string;
  jobTitle?: string;
  department?: string;
  lastAction?: string;
  lastTxnDate?: string;
  isInLaundry: boolean | number;
}

interface TransferLog {
  transferId: number;
  itemCode: string;
  itemName?: string;
  fromUserId: number | null;
  fromEmployeeName?: string;
  fromBadge?: string;
  fromDepartment?: string;
  toUserId: number | null;
  toEmployeeName?: string;
  toBadge?: string;
  toDepartment?: string;
  userItemId?: number;
  reason?: string;
  transferredBy: number;
  transferredByName?: string;
  transferredAt: string;
}

interface ZkEmployee {
  userId: number;
  userCode: string;
  name: string;
  title?: string;
  department?: string;
}

interface CustodyStats {
  totalItems: number;
  assignedItems?: number;
  unassignedItems?: number;
  totalEmployeesWithCustody: number;
  inLaundryCount: number;
  withStaffCount: number;
}

interface ItemDefinition {
  itemId: number;
  itemName: string;
}

export const CustodyTransferPage: React.FC = () => {
  const [searchParams] = useSearchParams();

  // Active tab: 'directory' vs 'logs'
  const [activeTab, setActiveTab] = useState<'directory' | 'logs'>('directory');

  // Stats state
  const [stats, setStats] = useState<CustodyStats>({
    totalItems: 0,
    assignedItems: 0,
    unassignedItems: 0,
    totalEmployeesWithCustody: 0,
    inLaundryCount: 0,
    withStaffCount: 0,
  });
  const [loadingStats, setLoadingStats] = useState(true);

  // Item definitions (uniform types: جاكيت، قميص، بنطلون، إلخ)
  const [itemDefinitions, setItemDefinitions] = useState<ItemDefinition[]>([]);

  // Departments list from server
  const [departmentOptions, setDepartmentOptions] = useState<string[]>([]);

  // Directory state (Paginated)
  const [items, setItems] = useState<CustodyItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(true);
  const [itemsSearch, setItemsSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedDept, setSelectedDept] = useState<string>('all');
  const [assignmentFilter, setAssignmentFilter] = useState<'all' | 'assigned' | 'unassigned'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'with_staff' | 'in_laundry'>('all');

  // Items pagination
  const [itemsPage, setItemsPage] = useState(1);
  const [itemsPageSize, setItemsPageSize] = useState(20);
  const [itemsTotal, setItemsTotal] = useState(0);
  const [itemsTotalPages, setItemsTotalPages] = useState(1);

  // Logs state (Paginated)
  const [logs, setLogs] = useState<TransferLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [logsSearch, setLogsSearch] = useState('');
  const [debouncedLogsSearch, setDebouncedLogsSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Logs pagination
  const [logsPage, setLogsPage] = useState(1);
  const [logsPageSize, setLogsPageSize] = useState(20);
  const [logsTotal, setLogsTotal] = useState(0);
  const [logsTotalPages, setLogsTotalPages] = useState(1);

  // ─── MODAL 1: ASSIGN NEW ITEM (تكويد وتخصيص عهدة جديدة) ─────────────────
  const [isNewItemModalOpen, setIsNewItemModalOpen] = useState(false);
  const [newItemCode, setNewItemCode] = useState('');
  const [newItemId, setNewItemId] = useState<number | ''>('');
  const [isAssignToEmployee, setIsAssignToEmployee] = useState(true);
  const [newEmployeeSearch, setNewEmployeeSearch] = useState('');
  const [newEmployeeCandidates, setNewEmployeeCandidates] = useState<ZkEmployee[]>([]);
  const [selectedNewEmployee, setSelectedNewEmployee] = useState<ZkEmployee | null>(null);
  const [searchingNewEmployee, setSearchingNewEmployee] = useState(false);
  const [newItemNotes, setNewItemNotes] = useState('');
  const [submittingNewItem, setSubmittingNewItem] = useState(false);

  // ─── MODAL 2: UNASSIGN ITEM (فك تخصيص العهدة) ───────────────────────────
  const [isUnassignModalOpen, setIsUnassignModalOpen] = useState(false);
  const [itemToUnassign, setItemToUnassign] = useState<CustodyItem | null>(null);
  const [unassignReason, setUnassignReason] = useState('');
  const [submittingUnassign, setSubmittingUnassign] = useState(false);

  // ─── MODAL 3: ASSIGN UNASSIGNED ITEM (تخصيص عهدة لموظف) ─────────────────
  const [isAssignUnassignedModalOpen, setIsAssignUnassignedModalOpen] = useState(false);
  const [itemToAssign, setItemToAssign] = useState<CustodyItem | null>(null);
  const [assignTargetSearch, setAssignTargetSearch] = useState('');
  const [assignTargetCandidates, setAssignTargetCandidates] = useState<ZkEmployee[]>([]);
  const [selectedAssignTarget, setSelectedAssignTarget] = useState<ZkEmployee | null>(null);
  const [searchingAssignTarget, setSearchingAssignTarget] = useState(false);
  const [assignNotes, setAssignNotes] = useState('');
  const [submittingAssign, setSubmittingAssign] = useState(false);

  // ─── MODAL 4: DELETE CUSTODY ITEM ─────────────────────────────────────────
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<CustodyItem | null>(null);
  const [submittingDelete, setSubmittingDelete] = useState(false);

  // ─── MODAL 5: REASSIGN / TRANSFER CUSTODY ITEM ────────────────────────────
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [selectedItemToTransfer, setSelectedItemToTransfer] = useState<CustodyItem | null>(null);
  const [manualItemCode, setManualItemCode] = useState('');
  const [resolvingItem, setResolvingItem] = useState(false);
  const [targetEmployeeSearch, setTargetEmployeeSearch] = useState('');
  const [targetEmployeeCandidates, setTargetEmployeeCandidates] = useState<ZkEmployee[]>([]);
  const [selectedTargetEmployee, setSelectedTargetEmployee] = useState<ZkEmployee | null>(null);
  const [transferReason, setTransferReason] = useState('');
  const [submittingTransfer, setSubmittingTransfer] = useState(false);
  const [searchingCandidates, setSearchingCandidates] = useState(false);

  // ─── MODAL 6: ITEM TIMELINE / AUDIT LOGS ─────────────────────────────────
  const [isTimelineOpen, setIsTimelineOpen] = useState(false);
  const [timelineItem, setTimelineItem] = useState<any | null>(null);
  const [loadingTimeline, setLoadingTimeline] = useState(false);

  // Notifications
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [errorToast, setErrorToast] = useState<string | null>(null);

  // Auto-dismiss toasts
  useEffect(() => {
    if (successToast) {
      const timer = setTimeout(() => setSuccessToast(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [successToast]);

  useEffect(() => {
    if (errorToast) {
      const timer = setTimeout(() => setErrorToast(null), 7000);
      return () => clearTimeout(timer);
    }
  }, [errorToast]);

  // Debounce search input for Items (350ms)
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(itemsSearch);
      setItemsPage(1);
    }, 350);
    return () => clearTimeout(handler);
  }, [itemsSearch]);

  // Debounce search input for Logs (350ms)
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedLogsSearch(logsSearch);
      setLogsPage(1);
    }, 350);
    return () => clearTimeout(handler);
  }, [logsSearch]);

  // Fetch KPI Stats
  const fetchStats = async () => {
    try {
      setLoadingStats(true);
      const res = await laundryApi.getCustodyStats();
      const data = res?.data || res;
      if (data && typeof data.totalItems === 'number') {
        setStats(data);
      }
    } catch (err) {
      console.warn('Failed to fetch custody stats:', err);
    } finally {
      setLoadingStats(false);
    }
  };

  // Fetch Item Definitions
  const fetchItemDefinitions = async () => {
    try {
      const res = await laundryApi.getItemDefinitions();
      const list = res?.data || (Array.isArray(res) ? res : []);
      if (Array.isArray(list)) {
        setItemDefinitions(list);
      }
    } catch (err) {
      console.warn('Failed to fetch item definitions:', err);
    }
  };

  // Fetch Departments
  const fetchDepartments = async () => {
    try {
      const res = await laundryApi.getCustodyDepartments();
      const list = res?.data || (Array.isArray(res) ? res : []);
      if (Array.isArray(list)) {
        setDepartmentOptions(list);
      }
    } catch (err) {
      console.warn('Failed to fetch departments:', err);
    }
  };

  // Fetch paginated custody items from server
  const fetchItems = useCallback(async () => {
    try {
      setLoadingItems(true);
      const res = await laundryApi.getAllCustodyItems({
        search: debouncedSearch.trim() || undefined,
        department: selectedDept !== 'all' ? selectedDept : undefined,
        assignmentStatus: assignmentFilter !== 'all' ? assignmentFilter : undefined,
        laundryStatus: statusFilter !== 'all' ? statusFilter : undefined,
        page: itemsPage,
        pageSize: itemsPageSize,
      });

      const itemsList = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
      setItems(itemsList);

      const meta = res?.meta || res?.pagination;
      if (meta && typeof meta.total === 'number') {
        setItemsTotal(meta.total);
        setItemsTotalPages(meta.totalPages || 1);
      } else {
        setItemsTotal(itemsList.length);
        setItemsTotalPages(1);
      }
    } catch (err: any) {
      console.error('Error fetching custody items:', err);
      setErrorToast(err?.response?.data?.message || 'فشل في تحميل قائمة أصناف العهد');
      setItems([]);
    } finally {
      setLoadingItems(false);
    }
  }, [debouncedSearch, selectedDept, assignmentFilter, statusFilter, itemsPage, itemsPageSize]);

  // Fetch paginated transfer audit logs from server
  const fetchLogs = useCallback(async () => {
    try {
      setLoadingLogs(true);
      const res = await laundryApi.getCustodyTransferLogs({
        search: debouncedLogsSearch.trim() || undefined,
        fromDate: dateFrom || undefined,
        toDate: dateTo || undefined,
        page: logsPage,
        pageSize: logsPageSize,
      });

      const logsList = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
      setLogs(logsList);

      const meta = res?.meta || res?.pagination;
      if (meta && typeof meta.total === 'number') {
        setLogsTotal(meta.total);
        setLogsTotalPages(meta.totalPages || 1);
      } else {
        setLogsTotal(logsList.length);
        setLogsTotalPages(1);
      }
    } catch (err: any) {
      console.error('Error fetching custody logs:', err);
      setLogs([]);
    } finally {
      setLoadingLogs(false);
    }
  }, [debouncedLogsSearch, dateFrom, dateTo, logsPage, logsPageSize]);

  // Initial load
  useEffect(() => {
    fetchStats();
    fetchItemDefinitions();
    fetchDepartments();
  }, []);

  // Reload items when query params change
  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  // Reload logs when on logs tab and query params change
  useEffect(() => {
    if (activeTab === 'logs') {
      fetchLogs();
    }
  }, [activeTab, fetchLogs]);

  // Handle URL param for direct item code transfer if provided (e.g. ?transferCode=...)
  useEffect(() => {
    const codeParam = searchParams.get('transferCode');
    if (codeParam) {
      handleOpenTransferModalWithCode(codeParam);
    }
  }, [searchParams]);

  // Search employees in "New Item" modal
  useEffect(() => {
    if (!newEmployeeSearch.trim() || newEmployeeSearch.length < 2) {
      setNewEmployeeCandidates([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        setSearchingNewEmployee(true);
        const res = await laundryApi.getZkEmployees(newEmployeeSearch.trim());
        const list = Array.isArray(res) ? res : (res?.data || []);
        setNewEmployeeCandidates(list);
      } catch (err) {
        console.error('Search employees error:', err);
      } finally {
        setSearchingNewEmployee(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [newEmployeeSearch]);

  // Search employees in "Assign Unassigned" modal
  useEffect(() => {
    if (!assignTargetSearch.trim() || assignTargetSearch.length < 2) {
      setAssignTargetCandidates([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        setSearchingAssignTarget(true);
        const res = await laundryApi.getZkEmployees(assignTargetSearch.trim());
        const list = Array.isArray(res) ? res : (res?.data || []);
        setAssignTargetCandidates(list);
      } catch (err) {
        console.error('Search employees error:', err);
      } finally {
        setSearchingAssignTarget(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [assignTargetSearch]);

  // Search destination employees in "Transfer" modal
  useEffect(() => {
    if (!targetEmployeeSearch.trim() || targetEmployeeSearch.length < 2) {
      setTargetEmployeeCandidates([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        setSearchingCandidates(true);
        const res = await laundryApi.getZkEmployees(targetEmployeeSearch.trim());
        const list = Array.isArray(res) ? res : (res?.data || []);
        const currentUserId = selectedItemToTransfer?.userId;
        const filtered = list.filter((e: ZkEmployee) => e.userId !== currentUserId);
        setTargetEmployeeCandidates(filtered);
      } catch (err) {
        console.error('Search employees error:', err);
      } finally {
        setSearchingCandidates(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [targetEmployeeSearch, selectedItemToTransfer]);

  // ─── ACTION HANDLERS ────────────────────────────────────────────────────────

  // 1. Submit New Item (Assign New Item)
  const handleCreateNewItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemCode.trim()) {
      setErrorToast('يرجى إدخال كود العهدة / الباركود');
      return;
    }
    if (!newItemId) {
      setErrorToast('يرجى اختيار نوع العهدة من القائمة');
      return;
    }
    if (isAssignToEmployee && !selectedNewEmployee) {
      setErrorToast('يرجى اختيار الموظف المراد تخصيص العهدة باسمه، أو إلغاء التحديد لحفظها كعهدة حرة بالمخزن');
      return;
    }

    try {
      setSubmittingNewItem(true);
      await laundryApi.createCustodyItem({
        itemCode: newItemCode.trim(),
        itemId: Number(newItemId),
        userId: isAssignToEmployee && selectedNewEmployee ? selectedNewEmployee.userId : null,
        notes: newItemNotes.trim() || undefined,
      });

      setSuccessToast(
        isAssignToEmployee && selectedNewEmployee
          ? `✅ تم تكويد العهدة (${newItemCode}) وتخصيصها بنجاح للموظف [${selectedNewEmployee.name}]`
          : `✅ تم تكويد العهدة (${newItemCode}) وحفظها بنجاح كرصيد حر بالمخزن (غير مخصصة)`
      );

      // Reset modal state
      setIsNewItemModalOpen(false);
      setNewItemCode('');
      setNewItemId('');
      setSelectedNewEmployee(null);
      setNewEmployeeSearch('');
      setNewItemNotes('');
      setIsAssignToEmployee(true);

      // Refresh list and stats
      fetchItems();
      fetchStats();
      if (activeTab === 'logs') fetchLogs();
    } catch (err: any) {
      console.error('Create custody item error:', err);
      setErrorToast(err?.response?.data?.message || 'حدث خطأ أثناء تكويد وحفظ العهدة الجديدة');
    } finally {
      setSubmittingNewItem(false);
    }
  };

  // 2. Submit Unassign Item
  const handleExecuteUnassign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemToUnassign) return;

    try {
      setSubmittingUnassign(true);
      await laundryApi.unassignCustodyItem(itemToUnassign.itemCode, {
        reason: unassignReason.trim() || undefined,
      });

      setSuccessToast(`✅ تم فك تخصيص العهدة (${itemToUnassign.itemCode}) بنجاح وأصبحت متاحة بالمخزن`);
      setIsUnassignModalOpen(false);
      setItemToUnassign(null);
      setUnassignReason('');

      fetchItems();
      fetchStats();
      if (activeTab === 'logs') fetchLogs();
    } catch (err: any) {
      console.error('Unassign item error:', err);
      setErrorToast(err?.response?.data?.message || 'فشل في فك تخصيص العهدة');
    } finally {
      setSubmittingUnassign(false);
    }
  };

  // 3. Submit Assign Unassigned Item
  const handleExecuteAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemToAssign) return;
    if (!selectedAssignTarget) {
      setErrorToast('يرجى اختيار الموظف المستلم للعهدة');
      return;
    }

    try {
      setSubmittingAssign(true);
      await laundryApi.assignCustodyItem(itemToAssign.itemCode, {
        toUserId: selectedAssignTarget.userId,
        notes: assignNotes.trim() || undefined,
      });

      setSuccessToast(`✅ تم تخصيص العهدة (${itemToAssign.itemCode}) للموظف [${selectedAssignTarget.name}] بنجاح`);
      setIsAssignUnassignedModalOpen(false);
      setItemToAssign(null);
      setSelectedAssignTarget(null);
      setAssignTargetSearch('');
      setAssignNotes('');

      fetchItems();
      fetchStats();
      if (activeTab === 'logs') fetchLogs();
    } catch (err: any) {
      console.error('Assign item error:', err);
      setErrorToast(err?.response?.data?.message || 'فشل في تخصيص العهدة للموظف');
    } finally {
      setSubmittingAssign(false);
    }
  };

  // 4. Submit Delete Item
  const handleExecuteDelete = async () => {
    if (!itemToDelete) return;

    try {
      setSubmittingDelete(true);
      await laundryApi.deleteCustodyItem(itemToDelete.itemCode);

      setSuccessToast(`✅ تم حذف العهدة (${itemToDelete.itemCode}) بنجاح من النظام`);
      setIsDeleteModalOpen(false);
      setItemToDelete(null);

      fetchItems();
      fetchStats();
    } catch (err: any) {
      console.error('Delete item error:', err);
      setErrorToast(err?.response?.data?.message || 'فشل في حذف العهدة');
    } finally {
      setSubmittingDelete(false);
    }
  };

  // 5. Open transfer modal for an item
  const handleOpenTransferModal = (item: CustodyItem) => {
    setSelectedItemToTransfer(item);
    setManualItemCode(item.itemCode);
    setSelectedTargetEmployee(null);
    setTargetEmployeeSearch('');
    setTransferReason('');
    setIsTransferModalOpen(true);
  };

  // Open transfer modal by searching manual code
  const handleOpenTransferModalWithCode = async (code: string) => {
    try {
      setResolvingItem(true);
      const res = await laundryApi.getCustodyItemByCode(code);
      const data = res?.data || res;
      if (data) {
        setSelectedItemToTransfer(data);
        setManualItemCode(data.itemCode);
      }
      setSelectedTargetEmployee(null);
      setTargetEmployeeSearch('');
      setTransferReason('');
      setIsTransferModalOpen(true);
    } catch (err: any) {
      setErrorToast(err?.response?.data?.message || `لم يتم العثور على الصنف بالكود: ${code}`);
    } finally {
      setResolvingItem(false);
    }
  };

  // Submit transfer
  const handleExecuteTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItemToTransfer) {
      setErrorToast('يرجى تحديد الصنف المراد نقله');
      return;
    }
    if (!selectedTargetEmployee) {
      setErrorToast('يرجى اختيار الموظف الجديد المستلم للعهدة');
      return;
    }

    try {
      setSubmittingTransfer(true);
      await laundryApi.transferCustodyItem({
        itemCode: selectedItemToTransfer.itemCode,
        fromUserId: Number(selectedItemToTransfer.userId),
        toUserId: selectedTargetEmployee.userId,
        reason: transferReason.trim() || undefined,
      });

      setSuccessToast(
        `✅ تم نقل عهدة الصنف (${selectedItemToTransfer.itemCode} - ${selectedItemToTransfer.itemName}) بنجاح إلى الموظف [${selectedTargetEmployee.name}]`
      );
      setIsTransferModalOpen(false);

      fetchItems();
      fetchStats();
      if (activeTab === 'logs') {
        fetchLogs();
      }
    } catch (err: any) {
      console.error('Transfer execution error:', err);
      setErrorToast(err?.response?.data?.message || 'حدث خطأ أثناء تنفيذ عملية نقل العهدة');
    } finally {
      setSubmittingTransfer(false);
    }
  };

  // Open Timeline
  const handleViewTimeline = async (itemCode: string) => {
    try {
      setLoadingTimeline(true);
      setIsTimelineOpen(true);
      const res = await laundryApi.getCustodyItemByCode(itemCode);
      const data = res?.data || res;
      setTimelineItem(data);
    } catch (err: any) {
      setErrorToast(err?.response?.data?.message || 'فشل في جلب سجل تتبع الصنف');
      setIsTimelineOpen(false);
    } finally {
      setLoadingTimeline(false);
    }
  };

  // Items are already filtered and paginated server-side by the database
  const displayedItems = items;

  // Export CSV of currently displayed logs or full logs query
  const exportLogsCSV = () => {
    const headers = [
      'رقم الحركة',
      'كود الصنف',
      'اسم الصنف',
      'الموظف السابق (كود)',
      'الموظف السابق (اسم)',
      'الموظف السابق (قسم)',
      'الموظف الجديد (كود)',
      'الموظف الجديد (اسم)',
      'الموظف الجديد (قسم)',
      'المسؤول عن النقل',
      'تاريخ التحويل',
      'سبب النقل'
    ];
    const rows = logs.map(l => [
      l.transferId,
      l.itemCode,
      l.itemName || '---',
      l.fromBadge || l.fromUserId || '---',
      l.fromEmployeeName || '---',
      l.fromDepartment || '---',
      l.toBadge || l.toUserId || '---',
      l.toEmployeeName || '---',
      l.toDepartment || '---',
      l.transferredByName || '---',
      l.transferredAt ? new Date(l.transferredAt).toLocaleString('ar-EG') : '---',
      l.reason || '---'
    ]);

    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `custody_transfers_audit_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Render pagination buttons component
  const renderPagination = (
    currentPage: number,
    totalPages: number,
    totalRecords: number,
    pageSize: number,
    onPageChange: (newPage: number) => void,
    onPageSizeChange: (newSize: number) => void
  ) => {
    if (totalRecords === 0) return null;

    const startRecord = (currentPage - 1) * pageSize + 1;
    const endRecord = Math.min(currentPage * pageSize, totalRecords);

    let startPage = Math.max(1, currentPage - 2);
    let endPage = Math.min(totalPages, startPage + 4);
    if (endPage - startPage < 4) {
      startPage = Math.max(1, endPage - 4);
    }
    const pageNumbers = [];
    for (let i = startPage; i <= endPage; i++) {
      pageNumbers.push(i);
    }

    return (
      <div className="p-4 border-t border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-4 bg-slate-50/50 text-xs text-slate-600">
        <div className="flex items-center gap-3">
          <span>
            عرض <strong className="text-slate-800 font-mono font-bold">{startRecord}</strong> إلى{' '}
            <strong className="text-slate-800 font-mono font-bold">{endRecord}</strong> من أصل{' '}
            <strong className="text-blue-700 font-mono font-bold">{totalRecords.toLocaleString('ar-EG')}</strong> سجل
          </span>

          <div className="flex items-center gap-1.5 mr-2">
            <span>لكل صفحة:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                onPageSizeChange(Number(e.target.value));
                onPageChange(1);
              }}
              className="px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value={15}>15</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => onPageChange(1)}
            disabled={currentPage <= 1}
            title="الصفحة الأولى"
            className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            <ChevronsRight size={15} />
          </button>

          <button
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage <= 1}
            title="الصفحة السابقة"
            className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            <ChevronRight size={15} />
          </button>

          <div className="flex items-center gap-1 mx-1">
            {pageNumbers.map((p) => (
              <button
                key={p}
                onClick={() => onPageChange(p)}
                className={`w-7 h-7 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${p === currentPage
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'border border-slate-200 bg-white hover:bg-slate-100 text-slate-700'
                  }`}
              >
                {p}
              </button>
            ))}
          </div>

          <button
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage >= totalPages}
            title="الصفحة التالية"
            className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            <ChevronLeft size={15} />
          </button>

          <button
            onClick={() => onPageChange(totalPages)}
            disabled={currentPage >= totalPages}
            title="الصفحة الأخيرة"
            className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            <ChevronsLeft size={15} />
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-6 font-arabic dir-rtl select-none pb-12">
      {/* Toast Messages */}
      {successToast && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-emerald-600 text-white px-5 py-3.5 rounded-xl shadow-xl shadow-emerald-900/20 border border-emerald-500 animate-fade-in text-sm font-medium">
          <CheckCircle2 size={20} className="shrink-0" />
          <span>{successToast}</span>
          <button onClick={() => setSuccessToast(null)} className="mr-2 text-emerald-200 hover:text-white cursor-pointer">
            <X size={16} />
          </button>
        </div>
      )}

      {errorToast && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-rose-600 text-white px-5 py-3.5 rounded-xl shadow-xl shadow-rose-900/20 border border-rose-500 animate-fade-in text-sm font-medium">
          <AlertCircle size={20} className="shrink-0" />
          <span>{errorToast}</span>
          <button onClick={() => setErrorToast(null)} className="mr-2 text-rose-200 hover:text-white cursor-pointer">
            <X size={16} />
          </button>
        </div>
      )}

      {/* Header Banner */}
      <div className="relative overflow-hidden bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white p-6 md:p-8 rounded-3xl shadow-xl border border-indigo-500/20">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-500 to-indigo-500 flex items-center justify-center shadow-lg shadow-blue-500/30 text-white ring-4 ring-white/10 shrink-0">
              <Shirt size={30} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl lg:text-3xl font-extrabold tracking-tight">
                  إدارة وتخصيص عهد اليونيفورم (Custody Management)
                </h1>
              </div>
              <p className="text-slate-300 text-sm mt-1.5 max-w-2xl leading-relaxed">
                تكويد عهد جديدة، تخصيص الأصناف للموظفين، فك الارتباط (Unassign) لتبقى حرة بالمخزن، وإعادة نقل العهد مع سجل تدقيق متكامل.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            {/* 1. ASSIGN NEW ITEM BUTTON */}
            <Button
              variant="primary"
              size="md"
              className="bg-emerald-600 hover:bg-emerald-700 text-white border-none shadow-lg shadow-emerald-900/30 cursor-pointer font-bold"
              onClick={() => {
                setNewItemCode('');
                setNewItemId(itemDefinitions[0]?.itemId || '');
                setSelectedNewEmployee(null);
                setNewEmployeeSearch('');
                setNewItemNotes('');
                setIsAssignToEmployee(true);
                setIsNewItemModalOpen(true);
              }}
            >
              <Plus size={18} className="ml-1.5" />
              تكويد عهدة جديدة (Assign New)
            </Button>

            {/* 2. REASSIGN TRANSFER BUTTON */}
            <Button
              variant="primary"
              size="md"
              className="bg-indigo-600 hover:bg-indigo-700 text-white border-none shadow-lg shadow-indigo-900/30 cursor-pointer"
              onClick={() => {
                setSelectedItemToTransfer(null);
                setManualItemCode('');
                setSelectedTargetEmployee(null);
                setTargetEmployeeSearch('');
                setTransferReason('');
                setIsTransferModalOpen(true);
              }}
            >
              <ArrowRightLeft size={18} className="ml-1.5" />
              نقل عهدة قطعة
            </Button>

            {/* 3. REFRESH BUTTON */}
            <Button
              variant="outline"
              size="md"
              className="bg-white/10 text-white border-white/20 hover:bg-white/20 cursor-pointer backdrop-blur-xs"
              onClick={() => {
                fetchStats();
                fetchItems();
                if (activeTab === 'logs') fetchLogs();
              }}
              disabled={loadingItems || loadingLogs}
            >
              <RotateCw size={17} className={`ml-1.5 ${(loadingItems || loadingLogs) ? 'animate-spin' : ''}`} />
              تحديث
            </Button>
          </div>
        </div>

        {/* 5 KPI Stats Cards from Server */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5 mt-8 pt-6 border-t border-white/10">
          <div className="bg-white/5 backdrop-blur-xs rounded-xl p-3.5 border border-white/10">
            <div className="text-xs text-slate-300 font-medium">إجمالي قطع العهد</div>
            <div className="text-2xl font-bold text-white mt-1">
              {loadingStats ? '...' : stats.totalItems.toLocaleString('ar-EG')}
            </div>
            <div className="text-[11px] text-blue-300 mt-0.5">في النظام العام</div>
          </div>

          <div className="bg-white/5 backdrop-blur-xs rounded-xl p-3.5 border border-white/10">
            <div className="text-xs text-slate-300 font-medium">مخصصة لموظفين</div>
            <div className="text-2xl font-bold text-emerald-300 mt-1">
              {loadingStats ? '...' : (stats.assignedItems ?? 0).toLocaleString('ar-EG')}
            </div>
            <div className="text-[11px] text-emerald-200 mt-0.5">باسم موظف حالياً</div>
          </div>

          <div className="bg-white/5 backdrop-blur-xs rounded-xl p-3.5 border border-white/10 ring-1 ring-amber-400/30">
            <div className="text-xs text-amber-200 font-bold flex items-center gap-1">
              <Package size={13} />
              حرة بالمخزن (غير مخصصة)
            </div>
            <div className="text-2xl font-bold text-amber-300 mt-1">
              {loadingStats ? '...' : (stats.unassignedItems ?? 0).toLocaleString('ar-EG')}
            </div>
            <div className="text-[11px] text-amber-200 mt-0.5">متاحة للتخصيص الفوري</div>
          </div>

          <div className="bg-white/5 backdrop-blur-xs rounded-xl p-3.5 border border-white/10">
            <div className="text-xs text-slate-300 font-medium">بالخدمة مع الموظفين</div>
            <div className="text-2xl font-bold text-indigo-300 mt-1">
              {loadingStats ? '...' : stats.withStaffCount.toLocaleString('ar-EG')}
            </div>
            <div className="text-[11px] text-indigo-200 mt-0.5">حالة تشغيلية نشطة</div>
          </div>

          <div className="bg-white/5 backdrop-blur-xs rounded-xl p-3.5 border border-white/10">
            <div className="text-xs text-slate-300 font-medium">قيد الغسيل بالمغسلة</div>
            <div className="text-2xl font-bold text-cyan-300 mt-1">
              {loadingStats ? '...' : stats.inLaundryCount.toLocaleString('ar-EG')}
            </div>
            <div className="text-[11px] text-cyan-200 mt-0.5">مستلمة بالمغسلة</div>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex border-b border-slate-200 bg-white rounded-2xl p-1.5 shadow-xs">
        <button
          onClick={() => setActiveTab('directory')}
          className={`flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-sm transition-all cursor-pointer ${activeTab === 'directory'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
        >
          <Shirt size={18} />
          <span>دليل وجرد أصناف العهد ({itemsTotal.toLocaleString('ar-EG')})</span>
        </button>

        <button
          onClick={() => setActiveTab('logs')}
          className={`flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-sm transition-all cursor-pointer ${activeTab === 'logs'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
        >
          <History size={18} />
          <span>سجل تدقيق وتتبع حركات العهد (Audit Logs) ({logsTotal.toLocaleString('ar-EG')})</span>
        </button>
      </div>

      {/* TAB 1: ALL CUSTODY ITEMS DIRECTORY & FULL MANAGEMENT */}
      {activeTab === 'directory' && (
        <div className="flex flex-col gap-5">
          {/* Filters Bar */}
          <Card className="p-4 bg-white border border-slate-200/80 rounded-2xl shadow-xs">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5">
              {/* Search */}
              <div className="md:col-span-5 relative">
                <Search size={18} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="ابحث بكود الصنف، اسم القطعة، اسم الموظف، أو رقم البصمة..."
                  value={itemsSearch}
                  onChange={(e) => setItemsSearch(e.target.value)}
                  className="w-full pr-10 pl-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-slate-400"
                />
                {itemsSearch && (
                  <button
                    onClick={() => setItemsSearch('')}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>

              {/* Assignment Status filter */}
              <div className="md:col-span-3">
                <select
                  value={assignmentFilter}
                  onChange={(e) => {
                    setAssignmentFilter(e.target.value as any);
                    setItemsPage(1);
                  }}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white"
                >
                  <option value="all">جميع الأصناف (المخصصة + الحرة بالمخزن)</option>
                  <option value="assigned">المخصصة لموظفين فقط</option>
                  <option value="unassigned">الحرة بالمخزن (غير مخصصة لموظف)</option>
                </select>
              </div>

              {/* Department filter */}
              <div className="md:col-span-2">
                <select
                  value={selectedDept}
                  onChange={(e) => {
                    setSelectedDept(e.target.value);
                    setItemsPage(1);
                  }}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white"
                >
                  <option value="all">جميع الأقسام</option>
                  {departmentOptions.map(dept => (
                    <option key={dept} value={dept}>{dept}</option>
                  ))}
                </select>
              </div>

              {/* Laundry Status filter */}
              <div className="md:col-span-2">
                <select
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value as any);
                    setItemsPage(1);
                  }}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white"
                >
                  <option value="all">كل الحالات التشغيلية</option>
                  <option value="with_staff">بالخدمة مع الموظفين فقط</option>
                  <option value="in_laundry">قيد الغسيل بالمغسلة فقط</option>
                </select>
              </div>
            </div>
          </Card>

          {/* Table */}
          <Card className="overflow-hidden border border-slate-200/80 rounded-2xl shadow-xs bg-white">
            <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-slate-50/50">
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-800 text-sm">قائمة قطع العهد</span>
                <Badge variant="neutral">
                  الصفحة {itemsPage} من {itemsTotalPages} (إجمالي {itemsTotal.toLocaleString('ar-EG')} قطعة)
                </Badge>
                {assignmentFilter === 'unassigned' && (
                  <Badge variant="warning">العهد الحرة بالمخزن فقط</Badge>
                )}
                {statusFilter === 'in_laundry' && (
                  <Badge variant="warning">قيد الغسيل بالمغسلة</Badge>
                )}
              </div>

              <div className="text-xs text-slate-500">
                يمكنك تخصيص العهد الحرة لأي موظف، أو فك ارتباط (Unassign) أي عهدة موجودة مع موظف حالي فوراً
              </div>
            </div>

            {loadingItems ? (
              <div className="p-16 flex flex-col items-center justify-center">
                <Loader size="lg" />
                <span className="text-slate-500 text-sm mt-3">جاري جلب الصفحة بسرعة عبر الفهرسة...</span>
              </div>
            ) : displayedItems.length === 0 ? (
              <div className="py-12 px-4 flex flex-col items-center justify-center text-center">
                <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mb-3 border border-amber-200 shadow-xs">
                  {assignmentFilter === 'unassigned' ? <Package size={30} /> : <Shirt size={30} />}
                </div>
                <h3 className="font-bold text-slate-800 text-base mb-1">
                  {assignmentFilter === 'unassigned'
                    ? 'لا توجد عهد حرة بالمخزن حالياً (الرصيد: 0)'
                    : statusFilter === 'in_laundry'
                      ? 'لا توجد عهد قيد الغسيل بالمغسلة حالياً'
                      : 'لا توجد أصناف مطابقة'}
                </h3>
                <p className="text-slate-500 text-xs max-w-md leading-relaxed mb-4">
                  {assignmentFilter === 'unassigned'
                    ? 'جميع قطع اليونيفورم المسجلة مخصصة لأسماء موظفين. لتوفير رصيد حر بالمخزن، يمكنك تكويد عهدة جديدة وتحديد "حرة بالمخزن"، أو فك تخصيص أي قطعة من موظف حالي.'
                    : itemsSearch
                      ? `لم نجد أي قطعة عهدة تطابق معايير البحث: "${itemsSearch}"`
                      : 'لا توجد أصناف عهد مسجلة تطابق الفلاتر المختارة.'}
                </p>
                {assignmentFilter === 'unassigned' && (
                  <Button
                    variant="primary"
                    size="sm"
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold cursor-pointer shadow-md"
                    onClick={() => {
                      setNewItemCode('');
                      setNewItemId(itemDefinitions[0]?.itemId || '');
                      setSelectedNewEmployee(null);
                      setNewEmployeeSearch('');
                      setNewItemNotes('');
                      setIsAssignToEmployee(false);
                      setIsNewItemModalOpen(true);
                    }}
                  >
                    <Plus size={15} className="ml-1.5" />
                    تكويد عهدة حرة بالمخزن الآن
                  </Button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right text-sm">
                  <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 text-xs">
                    <tr>
                      <th className="py-3 px-4">كود العهدة / الباركود</th>
                      <th className="py-3 px-4">نوع الصنف</th>
                      <th className="py-3 px-4">الموظف الحالي (صاحب العهدة)</th>
                      <th className="py-3 px-4">القسم / الإدارة</th>
                      <th className="py-3 px-4">تاريخ التخصيص</th>
                      <th className="py-3 px-4">الحالة التشغيلية</th>
                      <th className="py-3 px-4 text-center">الإجراءات والتحكم</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {displayedItems.map((item) => {
                      const isAssigned = !!item.userId;
                      const isInLnd = item.isInLaundry === true || item.isInLaundry === 1 || item.lastAction === 'Receive';

                      return (
                        <tr key={item.userItemId} className={`transition-colors ${isAssigned ? 'hover:bg-blue-50/40' : 'bg-amber-50/20 hover:bg-amber-50/50'}`}>
                          {/* Item Code */}
                          <td className="py-3 px-4 font-mono font-bold text-slate-900">
                            <span className="bg-slate-100 text-slate-800 px-2.5 py-1 rounded-md border border-slate-200 text-xs">
                              {item.itemCode}
                            </span>
                          </td>

                          {/* Item Name */}
                          <td className="py-3 px-4 font-medium text-slate-800">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                                <Shirt size={15} />
                              </div>
                              <span className="font-semibold">{item.itemName}</span>
                            </div>
                          </td>

                          {/* Current Owner */}
                          <td className="py-3 px-4">
                            {isAssigned ? (
                              <div className="flex flex-col">
                                <span className="font-bold text-slate-800 flex items-center gap-1.5">
                                  <User size={13} className="text-slate-400" />
                                  {item.employeeName}
                                </span>
                                <span className="text-xs text-slate-500 font-mono">
                                  بصمة / كود: {item.userCode || '---'} (ID: {item.userId})
                                </span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5">
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-100/70 text-amber-900 border border-amber-300">
                                  <Package size={13} className="text-amber-700" />
                                  غير مخصص (حر بالمخزن)
                                </span>
                              </div>
                            )}
                          </td>

                          {/* Department */}
                          <td className="py-3 px-4 text-slate-600 text-xs font-medium">
                            {isAssigned ? (
                              <div className="flex items-center gap-1">
                                <Building2 size={13} className="text-slate-400" />
                                <span>{item.department || 'غير محدد'}</span>
                              </div>
                            ) : (
                              <span className="text-slate-400 font-mono text-xs">المخزن العام</span>
                            )}
                          </td>

                          {/* Assigned Date */}
                          <td className="py-3 px-4 text-xs text-slate-500 font-mono">
                            <div className="flex items-center gap-1">
                              <Calendar size={13} className="text-slate-400" />
                              <span>
                                {item.assignedDate ? new Date(item.assignedDate).toLocaleDateString('ar-EG') : '---'}
                              </span>
                            </div>
                          </td>

                          {/* Status */}
                          <td className="py-3 px-4">
                            {!isAssigned ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
                                <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                                رصيد متاح للتخصيص
                              </span>
                            ) : isInLnd ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                                قيد الغسيل بالمغسلة
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                بالخدمة مع الموظف
                              </span>
                            )}
                          </td>

                          {/* Actions */}
                          <td className="py-3 px-4 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              {/* If Unassigned: Assign to Employee Button */}
                              {!isAssigned ? (
                                <Button
                                  variant="primary"
                                  size="sm"
                                  className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold cursor-pointer shadow-xs"
                                  onClick={() => {
                                    setItemToAssign(item);
                                    setSelectedAssignTarget(null);
                                    setAssignTargetSearch('');
                                    setAssignNotes('');
                                    setIsAssignUnassignedModalOpen(true);
                                  }}
                                >
                                  <UserPlus size={13} className="ml-1" />
                                  تخصيص لموظف
                                </Button>
                              ) : (
                                <>
                                  {/* If Assigned: Unassign Button */}
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="text-xs bg-white hover:bg-amber-50 text-amber-700 border-amber-300 font-bold cursor-pointer"
                                    title="فك التخصيص وإرجاع القطعة للمخزن بدون موظف"
                                    onClick={() => {
                                      setItemToUnassign(item);
                                      setUnassignReason('');
                                      setIsUnassignModalOpen(true);
                                    }}
                                  >
                                    <UserMinus size={13} className="ml-1" />
                                    فك التخصيص
                                  </Button>

                                  {/* Transfer Button */}
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="text-xs bg-white hover:bg-blue-50 text-blue-700 border-blue-200 font-bold cursor-pointer"
                                    title="نقل العهدة لموظف آخر"
                                    onClick={() => handleOpenTransferModal(item)}
                                  >
                                    <ArrowRightLeft size={13} className="ml-1" />
                                    نقل
                                  </Button>
                                </>
                              )}

                              {/* Timeline Button */}
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-xs text-slate-600 hover:text-slate-900 hover:bg-slate-100 cursor-pointer p-1.5"
                                title="سجل تتبع القطعة"
                                onClick={() => handleViewTimeline(item.itemCode)}
                              >
                                <History size={15} />
                              </Button>

                              {/* Delete Button */}
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-xs text-rose-500 hover:text-rose-700 hover:bg-rose-50 cursor-pointer p-1.5"
                                title="حذف العهدة نهائياً"
                                onClick={() => {
                                  setItemToDelete(item);
                                  setIsDeleteModalOpen(true);
                                }}
                              >
                                <Trash2 size={15} />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination Controls */}
            {renderPagination(
              itemsPage,
              itemsTotalPages,
              itemsTotal,
              itemsPageSize,
              (newPage) => setItemsPage(newPage),
              (newSize) => setItemsPageSize(newSize)
            )}
          </Card>
        </div>
      )}

      {/* TAB 2: AUDIT LOGS */}
      {activeTab === 'logs' && (
        <div className="flex flex-col gap-5">
          {/* Filters Bar */}
          <Card className="p-4 bg-white border border-slate-200/80 rounded-2xl shadow-xs">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5">
              <div className="md:col-span-5 relative">
                <Search size={18} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="ابحث بكود الصنف، اسم الموظف، رقم البصمة، أو السبب..."
                  value={logsSearch}
                  onChange={(e) => setLogsSearch(e.target.value)}
                  className="w-full pr-10 pl-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 placeholder:text-slate-400"
                />
              </div>

              <div className="md:col-span-3 flex items-center gap-2">
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => {
                    setDateFrom(e.target.value);
                    setLogsPage(1);
                  }}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
                <span className="text-slate-400 text-xs">إلى</span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => {
                    setDateTo(e.target.value);
                    setLogsPage(1);
                  }}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div className="md:col-span-4 flex items-center justify-end gap-2">
                {(dateFrom || dateTo || logsSearch) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setDateFrom('');
                      setDateTo('');
                      setLogsSearch('');
                      setLogsPage(1);
                    }}
                    className="text-xs text-rose-600 hover:bg-rose-50 cursor-pointer"
                  >
                    مسح الفلاتر
                  </Button>
                )}

                <Button
                  variant="outline"
                  size="sm"
                  onClick={exportLogsCSV}
                  disabled={logs.length === 0}
                  className="text-xs border-emerald-300 text-emerald-800 bg-emerald-50 hover:bg-emerald-100 font-bold cursor-pointer"
                >
                  <FileSpreadsheet size={15} className="ml-1 text-emerald-600" />
                  تصدير تقرير إكسيل (CSV)
                </Button>
              </div>
            </div>
          </Card>

          {/* Logs Table */}
          <Card className="overflow-hidden border border-slate-200/80 rounded-2xl shadow-xs bg-white">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <span className="font-bold text-slate-800 text-sm">
                سجل تدقيق تحويلات وتخصيصات العهد (قاعدة بيانات العمليات)
              </span>
              <Badge variant="neutral">
                {logsTotal.toLocaleString('ar-EG')} حركة موثقة
              </Badge>
            </div>

            {loadingLogs ? (
              <div className="p-16 flex flex-col items-center justify-center">
                <Loader size="lg" />
                <span className="text-slate-500 text-sm mt-3">جاري جلب سجلات التدقيق المقسمة...</span>
              </div>
            ) : logs.length === 0 ? (
              <EmptyState
                icon={History}
                title="لا توجد حركات تحويل مطابقة"
                description="لم يتم العثور على أي سجلات تحويل عهد تطابق معايير البحث المحددة."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right text-sm">
                  <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 text-xs">
                    <tr>
                      <th className="py-3 px-4">رقم الحركة</th>
                      <th className="py-3 px-4">كود الصنف</th>
                      <th className="py-3 px-4">اسم الصنف</th>
                      <th className="py-3 px-4">من (السابق)</th>
                      <th className="py-3 px-4 text-center">➔</th>
                      <th className="py-3 px-4">إلى (المستلم)</th>
                      <th className="py-3 px-4">المسؤول عن الحركة</th>
                      <th className="py-3 px-4">تاريخ ووقت الحركة</th>
                      <th className="py-3 px-4">السبب / الملاحظات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700 text-xs">
                    {logs.map((log) => (
                      <tr key={log.transferId} className="hover:bg-slate-50 transition-colors">
                        <td className="py-3 px-4 font-mono font-bold text-slate-600">
                          #{log.transferId}
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-slate-900">
                          <span className="bg-slate-100 text-slate-800 px-2 py-0.5 rounded border border-slate-200">
                            {log.itemCode}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-medium text-slate-800">
                          {log.itemName || '---'}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex flex-col">
                            <span className="font-bold text-rose-700">
                              {log.fromEmployeeName || 'المخزن العام'}
                            </span>
                            <span className="text-[11px] text-slate-400 font-mono">
                              كود: {log.fromBadge || '---'} {log.fromDepartment ? `• ${log.fromDepartment}` : ''}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-center text-slate-400 font-bold">
                          ➔
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex flex-col">
                            <span className="font-bold text-emerald-700">
                              {log.toEmployeeName || 'المخزن العام'}
                            </span>
                            <span className="text-[11px] text-slate-400 font-mono">
                              كود: {log.toBadge || '---'} {log.toDepartment ? `• ${log.toDepartment}` : ''}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-4 font-medium text-slate-700">
                          {log.transferredByName || 'المسؤول'}
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-500 whitespace-nowrap">
                          {log.transferredAt ? new Date(log.transferredAt).toLocaleString('ar-EG') : '---'}
                        </td>
                        <td className="py-3 px-4 text-slate-600 max-w-xs truncate" title={log.reason || ''}>
                          {log.reason || <span className="text-slate-400 italic">بدون ملاحظات</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Logs Pagination Controls */}
            {renderPagination(
              logsPage,
              logsTotalPages,
              logsTotal,
              logsPageSize,
              (newPage) => setLogsPage(newPage),
              (newSize) => setLogsPageSize(newSize)
            )}
          </Card>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────────────
          MODAL 1: ASSIGN NEW ITEM (تكويد وتخصيص عهدة جديدة - مطابقة للشاشة القديمة)
      ───────────────────────────────────────────────────────────────────────────── */}
      <Modal
        isOpen={isNewItemModalOpen}
        onClose={() => !submittingNewItem && setIsNewItemModalOpen(false)}
        title="تكويد وتخصيص عهدة جديدة (ASSIGN NEW ITEM)"
        size="lg"
      >
        <form onSubmit={handleCreateNewItem} className="flex flex-col gap-5 text-right font-arabic">
          {/* Header banner like legacy desktop application */}
          <div className="bg-gradient-to-r from-blue-700 to-indigo-700 text-white p-4 rounded-xl shadow-md text-center">
            <h2 className="text-lg font-black tracking-wider uppercase flex items-center justify-center gap-2">
              <Barcode size={22} />
              ASSIGN NEW ITEM - تكويد عهدة جديدة
            </h2>
            <p className="text-blue-100 text-xs mt-1">
              أدخل كود الباركود ونوع العهدة، واختر ما إذا كنت ترغب بتخصيصها لموظف محدد أو إبقائها حرة بالمخزن
            </p>
          </div>

          {/* Toggle Assignment Mode */}
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <User size={18} className="text-blue-600" />
              <div>
                <div className="font-bold text-sm text-slate-800">حالة التخصيص الأولية</div>
                <div className="text-xs text-slate-500">
                  {isAssignToEmployee ? 'سيتم ربط القطعة مباشرة باسم موظف' : 'ستكون القطعة حرة ومتاحة بالمخزن (بدون موظف)'}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 bg-white p-1 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => setIsAssignToEmployee(true)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${isAssignToEmployee
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                  }`}
              >
                تخصيص لموظف
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsAssignToEmployee(false);
                  setSelectedNewEmployee(null);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${!isAssignToEmployee
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                  }`}
              >
                حرة بالمخزن
              </button>
            </div>
          </div>

          {/* 1. EMPLOYEE SELECTION (اختر الموظف) */}
          {isAssignToEmployee && (
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <label className="block text-xs font-bold text-slate-800 mb-2">
                اختر الموظف (Select Employee) *
              </label>

              {!selectedNewEmployee ? (
                <div className="relative">
                  <Search size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="ابحث باسم الموظف أو رقم البصمة..."
                    value={newEmployeeSearch}
                    onChange={(e) => setNewEmployeeSearch(e.target.value)}
                    className="w-full pr-10 pl-4 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                  {searchingNewEmployee && (
                    <div className="absolute left-3 top-1/2 -translate-y-1/2">
                      <Loader size="sm" />
                    </div>
                  )}

                  {/* Candidates Dropdown */}
                  {newEmployeeCandidates.length > 0 && (
                    <div className="absolute z-30 right-0 left-0 mt-1 max-h-56 overflow-y-auto bg-white rounded-xl shadow-xl border border-slate-200 divide-y divide-slate-100">
                      {newEmployeeCandidates.map((emp) => (
                        <button
                          type="button"
                          key={emp.userId}
                          onClick={() => {
                            setSelectedNewEmployee(emp);
                            setNewEmployeeCandidates([]);
                            setNewEmployeeSearch('');
                          }}
                          className="w-full p-2.5 text-right hover:bg-blue-50 flex items-center justify-between transition-colors cursor-pointer"
                        >
                          <div>
                            <div className="font-bold text-slate-800 text-sm">{emp.name}</div>
                            <div className="text-xs text-slate-500">
                              {emp.department || 'بدون قسم'} {emp.title ? `• ${emp.title}` : ''}
                            </div>
                          </div>
                          <span className="font-mono text-xs bg-slate-100 px-2 py-1 rounded text-slate-700 font-semibold">
                            كود: {emp.userCode}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-between bg-emerald-50 p-3 rounded-xl border border-emerald-200">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
                      <User size={20} />
                    </div>
                    <div>
                      <div className="font-bold text-slate-900 text-sm">{selectedNewEmployee.name}</div>
                      <div className="text-xs text-slate-600 font-mono mt-0.5">
                        رقم البصمة: {selectedNewEmployee.userCode} | القسم: {selectedNewEmployee.department || 'عام'}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setSelectedNewEmployee(null)}
                    className="text-xs text-rose-600 hover:text-rose-800 font-semibold cursor-pointer underline mr-2"
                  >
                    تغيير الموظف
                  </button>
                </div>
              )}
            </div>
          )}

          {/* 2. ITEM DETAILS (تفاصيل العهدة) */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 shadow-xs">
            <h3 className="text-xs font-bold text-slate-800 mb-3 border-b border-slate-200 pb-2">
              تفاصيل العهدة (Item Details)
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Item Type (العهدة) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  نوع العهدة (العهدة) *
                </label>
                <select
                  value={newItemId}
                  onChange={(e) => setNewItemId(Number(e.target.value) || '')}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-sm font-semibold bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  required
                >
                  <option value="">-- اختر نوع القطعة --</option>
                  {itemDefinitions.map((def) => (
                    <option key={def.itemId} value={def.itemId}>
                      {def.itemName}
                    </option>
                  ))}
                </select>
              </div>

              {/* Item Code (كود العهدة) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  كود العهدة / الباركود (Unique Code) *
                </label>
                <div className="relative">
                  <Barcode size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="مثال: 419-1 أو امسح الباركود..."
                    value={newItemCode}
                    onChange={(e) => setNewItemCode(e.target.value)}
                    className="w-full pr-9 pl-3 py-2.5 rounded-xl border border-slate-300 text-sm font-mono font-bold text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    required
                  />
                </div>
              </div>
            </div>

            {/* Notes */}
            <div className="mt-3.5">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                ملاحظات إضافية (اختياري)
              </label>
              <textarea
                rows={2}
                placeholder="اكتب أي ملاحظات تخص مقاس القطعة، حالتها، أو سبب التكويد..."
                value={newItemNotes}
                onChange={(e) => setNewItemNotes(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-white"
              />
            </div>
          </div>

          {/* Submit Buttons */}
          <div className="flex items-center justify-between pt-3 border-t border-slate-200">
            <span className="text-xs text-slate-400 font-mono">
              System Ready to assign items
            </span>

            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsNewItemModalOpen(false)}
                disabled={submittingNewItem}
              >
                إلغاء
              </Button>

              <Button
                type="submit"
                variant="primary"
                disabled={!newItemCode.trim() || !newItemId || (isAssignToEmployee && !selectedNewEmployee) || submittingNewItem}
                className="bg-emerald-600 hover:bg-emerald-700 text-white border-none shadow-md shadow-emerald-900/20 font-bold px-6 py-2.5"
              >
                {submittingNewItem ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin ml-2 inline-block" />
                    جاري حفظ وتخصيص العهدة...
                  </>
                ) : (
                  <>
                    <Check size={16} className="ml-1.5" />
                    تخصيص العهدة (Save Item)
                  </>
                )}
              </Button>
            </div>
          </div>
        </form>
      </Modal>

      {/* ─────────────────────────────────────────────────────────────────────────────
          MODAL 2: UNASSIGN ITEM (فك تخصيص العهدة - تفريغها لتكون حرة بالمخزن)
      ───────────────────────────────────────────────────────────────────────────── */}
      <Modal
        isOpen={isUnassignModalOpen}
        onClose={() => !submittingUnassign && setIsUnassignModalOpen(false)}
        title="فك تخصيص العهدة (Unassign Item)"
        size="md"
      >
        {itemToUnassign && (
          <form onSubmit={handleExecuteUnassign} className="flex flex-col gap-4 text-right font-arabic">
            <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl flex items-start gap-3">
              <AlertCircle size={22} className="text-amber-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-bold text-amber-900 text-sm">
                  هل أنت متأكد من فك تخصيص هذه العهدة؟
                </h4>
                <p className="text-amber-800 text-xs mt-1 leading-relaxed">
                  سيتم إخلاء طرف الموظف الحالي من هذه القطعة، وتحويلها إلى المخزن العام كعهدة حرة (غير مخصصة لموظف)، مع توثيق الحركة في سجل التدقيق.
                </p>
              </div>
            </div>

            {/* Item & Owner Info Card */}
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-slate-500">كود العهدة:</span>
                <span className="font-mono font-bold text-slate-800 bg-white px-2 py-0.5 rounded border border-slate-200">
                  {itemToUnassign.itemCode}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">نوع القطعة:</span>
                <span className="font-bold text-slate-800">{itemToUnassign.itemName}</span>
              </div>
              <div className="flex justify-between items-center border-t border-slate-200 pt-2">
                <span className="text-slate-500">الموظف الحالي:</span>
                <span className="font-bold text-rose-700">{itemToUnassign.employeeName} (كود: {itemToUnassign.userCode || '---'})</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">القسم:</span>
                <span className="text-slate-700">{itemToUnassign.department || 'عام'}</span>
              </div>
            </div>

            {/* Reason */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                سبب فك التخصيص (اختياري)
              </label>
              <textarea
                rows={2}
                placeholder="مثال: استقالة، إرجاع للمخزن، استبدال طاقم العمل..."
                value={unassignReason}
                onChange={(e) => setUnassignReason(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            {/* Buttons */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsUnassignModalOpen(false)}
                disabled={submittingUnassign}
              >
                إلغاء
              </Button>

              <Button
                type="submit"
                variant="primary"
                disabled={submittingUnassign}
                className="bg-amber-600 hover:bg-amber-700 text-white border-none shadow-md font-bold"
              >
                {submittingUnassign ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin ml-2 inline-block" />
                    جاري فك التخصيص...
                  </>
                ) : (
                  <>
                    <UserMinus size={16} className="ml-1.5" />
                    تأكيد فك التخصيص
                  </>
                )}
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* ─────────────────────────────────────────────────────────────────────────────
          MODAL 3: ASSIGN UNASSIGNED ITEM TO EMPLOYEE (تخصيص قطعة حرة لموظف)
      ───────────────────────────────────────────────────────────────────────────── */}
      <Modal
        isOpen={isAssignUnassignedModalOpen}
        onClose={() => !submittingAssign && setIsAssignUnassignedModalOpen(false)}
        title="تخصيص عهدة لموظف (Assign Custody Item)"
        size="md"
      >
        {itemToAssign && (
          <form onSubmit={handleExecuteAssign} className="flex flex-col gap-4 text-right font-arabic">
            {/* Item Card */}
            <div className="bg-blue-50 p-3.5 rounded-xl border border-blue-100 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0">
                <Shirt size={20} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-blue-900 bg-white px-2 py-0.5 rounded text-xs border border-blue-200">
                    {itemToAssign.itemCode}
                  </span>
                  <span className="font-bold text-slate-800 text-sm">{itemToAssign.itemName}</span>
                </div>
                <div className="text-xs text-blue-700 mt-0.5 font-medium">
                  قطعة حرة بالمخزن • جاهزة للتخصيص
                </div>
              </div>
            </div>

            {/* Employee Search */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                اختر الموظف المستلم للعهدة *
              </label>

              {!selectedAssignTarget ? (
                <div className="relative">
                  <Search size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="ابحث باسم الموظف أو رقم البصمة..."
                    value={assignTargetSearch}
                    onChange={(e) => setAssignTargetSearch(e.target.value)}
                    className="w-full pr-10 pl-4 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                  {searchingAssignTarget && (
                    <div className="absolute left-3 top-1/2 -translate-y-1/2">
                      <Loader size="sm" />
                    </div>
                  )}

                  {assignTargetCandidates.length > 0 && (
                    <div className="absolute z-30 right-0 left-0 mt-1 max-h-56 overflow-y-auto bg-white rounded-xl shadow-xl border border-slate-200 divide-y divide-slate-100">
                      {assignTargetCandidates.map((emp) => (
                        <button
                          type="button"
                          key={emp.userId}
                          onClick={() => {
                            setSelectedAssignTarget(emp);
                            setAssignTargetCandidates([]);
                            setAssignTargetSearch('');
                          }}
                          className="w-full p-2.5 text-right hover:bg-blue-50 flex items-center justify-between transition-colors cursor-pointer"
                        >
                          <div>
                            <div className="font-bold text-slate-800 text-sm">{emp.name}</div>
                            <div className="text-xs text-slate-500">
                              {emp.department || 'بدون قسم'} {emp.title ? `• ${emp.title}` : ''}
                            </div>
                          </div>
                          <span className="font-mono text-xs bg-slate-100 px-2 py-1 rounded text-slate-700 font-semibold">
                            كود: {emp.userCode}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-between bg-emerald-50 p-3 rounded-xl border border-emerald-200">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
                      <User size={20} />
                    </div>
                    <div>
                      <div className="font-bold text-slate-900 text-sm">{selectedAssignTarget.name}</div>
                      <div className="text-xs text-slate-600 font-mono mt-0.5">
                        رقم البصمة: {selectedAssignTarget.userCode} | القسم: {selectedAssignTarget.department || 'عام'}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setSelectedAssignTarget(null)}
                    className="text-xs text-rose-600 hover:text-rose-800 font-semibold cursor-pointer underline mr-2"
                  >
                    تغيير الموظف
                  </button>
                </div>
              )}
            </div>

            {/* Notes */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                ملاحظات التخصيص (اختياري)
              </label>
              <textarea
                rows={2}
                placeholder="اكتب أي ملاحظات إضافية..."
                value={assignNotes}
                onChange={(e) => setAssignNotes(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            {/* Buttons */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsAssignUnassignedModalOpen(false)}
                disabled={submittingAssign}
              >
                إلغاء
              </Button>

              <Button
                type="submit"
                variant="primary"
                disabled={!selectedAssignTarget || submittingAssign}
                className="bg-emerald-600 hover:bg-emerald-700 text-white border-none shadow-md font-bold"
              >
                {submittingAssign ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin ml-2 inline-block" />
                    جاري التخصيص...
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={16} className="ml-1.5" />
                    تأكيد تخصيص العهدة
                  </>
                )}
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* ─────────────────────────────────────────────────────────────────────────────
          MODAL 4: DELETE CUSTODY ITEM
      ───────────────────────────────────────────────────────────────────────────── */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => !submittingDelete && setIsDeleteModalOpen(false)}
        title="حذف العهدة نهائياً (Delete Item)"
        size="sm"
      >
        {itemToDelete && (
          <div className="flex flex-col gap-4 text-right font-arabic">
            <div className="bg-rose-50 border border-rose-200 p-4 rounded-xl flex items-start gap-3">
              <Trash2 size={22} className="text-rose-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-bold text-rose-900 text-sm">تأكيد حذف العهدة</h4>
                <p className="text-rose-800 text-xs mt-1 leading-relaxed">
                  هل أنت متأكد من رغبتك في حذف العهدة ذات الكود{' '}
                  <strong className="font-mono text-rose-950">[{itemToDelete.itemCode}]</strong> ({itemToDelete.itemName}) نهائياً من النظام؟ لا يمكن التراجع عن هذا الإجراء.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsDeleteModalOpen(false)}
                disabled={submittingDelete}
              >
                إلغاء
              </Button>

              <Button
                type="button"
                variant="danger"
                onClick={handleExecuteDelete}
                disabled={submittingDelete}
                className="bg-rose-600 hover:bg-rose-700 text-white font-bold"
              >
                {submittingDelete ? 'جاري الحذف...' : 'نعم، حذف نهائياً'}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ─────────────────────────────────────────────────────────────────────────────
          MODAL 5: REASSIGN / TRANSFER CUSTODY ITEM
      ───────────────────────────────────────────────────────────────────────────── */}
      <Modal
        isOpen={isTransferModalOpen}
        onClose={() => !submittingTransfer && setIsTransferModalOpen(false)}
        title="نقل وإعادة تخصيص عهدة قطعة يونيفورم"
        size="lg"
      >
        <form onSubmit={handleExecuteTransfer} className="flex flex-col gap-5 text-right font-arabic">
          {/* Step 1: Item Identification */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
            <label className="block text-xs font-bold text-slate-700 mb-2">
              1. الصنف المراد نقله (Item Code / Barcode)
            </label>

            {!selectedItemToTransfer ? (
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="أدخل أو امسح باركود القطعة..."
                  value={manualItemCode}
                  onChange={(e) => setManualItemCode(e.target.value)}
                  className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
                <Button
                  type="button"
                  variant="primary"
                  onClick={() => handleOpenTransferModalWithCode(manualItemCode)}
                  disabled={resolvingItem || !manualItemCode.trim()}
                >
                  {resolvingItem ? 'جاري التحقق...' : 'تحقق'}
                </Button>
              </div>
            ) : (
              <div className="flex items-center justify-between bg-white p-3.5 rounded-xl border border-slate-200">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                    <Shirt size={20} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-blue-900 bg-blue-50 px-2 py-0.5 rounded text-xs border border-blue-200">
                        {selectedItemToTransfer.itemCode}
                      </span>
                      <span className="font-bold text-slate-800 text-sm">
                        {selectedItemToTransfer.itemName}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      المالك الحالي: <strong className="text-slate-700">{selectedItemToTransfer.employeeName}</strong> (كود: {selectedItemToTransfer.userCode || '---'}) • {selectedItemToTransfer.department || 'عام'}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedItemToTransfer(null)}
                  className="text-xs text-blue-600 hover:text-blue-800 font-semibold cursor-pointer underline mr-2"
                >
                  تغيير القطعة
                </button>
              </div>
            )}
          </div>

          {/* Visual Transfer Pathway (From ➔ To) */}
          {selectedItemToTransfer && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-center bg-blue-50/50 p-3.5 rounded-xl border border-blue-100">
              {/* FROM Card */}
              <div className="bg-white p-3 rounded-lg border border-slate-200">
                <div className="text-[11px] font-bold text-rose-600 mb-1 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-rose-500" />
                  الموظف الحالي (المرسل / المفرغ من العهدة)
                </div>
                <div className="font-bold text-slate-800 text-sm">
                  {selectedItemToTransfer.employeeName}
                </div>
                <div className="text-xs text-slate-500 font-mono mt-0.5">
                  رقم البصمة: {selectedItemToTransfer.userCode || '---'} | ID: {selectedItemToTransfer.userId}
                </div>
                <div className="text-xs text-slate-500 mt-0.5">
                  القسم: {selectedItemToTransfer.department || 'غير محدد'}
                </div>
              </div>

              {/* TO Card */}
              <div className={`p-3 rounded-lg border transition-all ${selectedTargetEmployee ? 'bg-white border-emerald-300 ring-2 ring-emerald-500/10' : 'bg-slate-100/70 border-dashed border-slate-300'
                }`}>
                <div className="text-[11px] font-bold text-emerald-600 mb-1 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  الموظف الجديد (المستلم للعهدة)
                </div>
                {selectedTargetEmployee ? (
                  <div>
                    <div className="font-bold text-slate-900 text-sm flex items-center justify-between">
                      <span>{selectedTargetEmployee.name}</span>
                      <button
                        type="button"
                        onClick={() => setSelectedTargetEmployee(null)}
                        className="text-[11px] text-rose-600 hover:underline cursor-pointer"
                      >
                        إلغاء
                      </button>
                    </div>
                    <div className="text-xs text-slate-500 font-mono mt-0.5">
                      رقم البصمة: {selectedTargetEmployee.userCode || '---'} | ID: {selectedTargetEmployee.userId}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      القسم: {selectedTargetEmployee.department || 'غير محدد'}
                    </div>
                  </div>
                ) : (
                  <div className="text-xs text-slate-400 italic py-2">
                    يرجى البحث واختيار الموظف الجديد في الخطوة أدناه...
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 2: Destination Employee Search */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              2. اختيار الموظف الجديد المستلم
            </label>

            {!selectedTargetEmployee ? (
              <div className="relative">
                <Search size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="ابحث باسم الموظف أو رقم البصمة..."
                  value={targetEmployeeSearch}
                  onChange={(e) => setTargetEmployeeSearch(e.target.value)}
                  className="w-full pr-10 pl-4 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />

                {searchingCandidates && (
                  <div className="absolute left-3 top-1/2 -translate-y-1/2">
                    <Loader size="sm" />
                  </div>
                )}

                {/* Candidate dropdown */}
                {targetEmployeeCandidates.length > 0 && (
                  <div className="absolute z-30 right-0 left-0 mt-1 max-h-56 overflow-y-auto bg-white rounded-xl shadow-xl border border-slate-200 divide-y divide-slate-100">
                    {targetEmployeeCandidates.map((emp) => (
                      <button
                        type="button"
                        key={emp.userId}
                        onClick={() => {
                          setSelectedTargetEmployee(emp);
                          setTargetEmployeeCandidates([]);
                          setTargetEmployeeSearch('');
                        }}
                        className="w-full p-2.5 text-right hover:bg-blue-50 flex items-center justify-between transition-colors cursor-pointer"
                      >
                        <div>
                          <div className="font-bold text-slate-800 text-sm">{emp.name}</div>
                          <div className="text-xs text-slate-500">
                            {emp.department || 'بدون قسم'} {emp.title ? `• ${emp.title}` : ''}
                          </div>
                        </div>
                        <span className="font-mono text-xs bg-slate-100 px-2 py-1 rounded text-slate-700 font-semibold">
                          كود: {emp.userCode}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : null}
          </div>

          {/* Step 3: Quick Reason Chips & Notes */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              3. سبب النقل / ملاحظات
            </label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {[
                'استبدال مقاس',
                'نقل لقسم آخر',
                'استقالة الموظف السابق',
                'تسليم عهدة بديلة',
                'إعادة توزيع أطقم العمل'
              ].map((reason) => (
                <button
                  type="button"
                  key={reason}
                  onClick={() => setTransferReason(reason)}
                  className={`text-xs px-2.5 py-1 rounded-full border transition-colors cursor-pointer ${transferReason === reason
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                    }`}
                >
                  {reason}
                </button>
              ))}
            </div>

            <textarea
              rows={2}
              placeholder="اكتب تفاصيل إضافية أو سبب النقل إن وجد..."
              value={transferReason}
              onChange={(e) => setTransferReason(e.target.value)}
              className="w-full p-3 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          {/* Submit Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsTransferModalOpen(false)}
              disabled={submittingTransfer}
            >
              إلغاء
            </Button>

            <Button
              type="submit"
              variant="primary"
              disabled={!selectedItemToTransfer || !selectedTargetEmployee || submittingTransfer}
              className="bg-emerald-600 hover:bg-emerald-700 text-white border-none shadow-md shadow-emerald-900/20"
            >
              {submittingTransfer ? (
                <>
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin ml-2 inline-block" />
                  جاري توثيق ونقل العهدة...
                </>
              ) : (
                <>
                  <CheckCircle2 size={16} className="ml-1.5" />
                  تأكيد نقل العهدة وتوثيق الحركة
                </>
              )}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ─────────────────────────────────────────────────────────────────────────────
          MODAL 6: ITEM TIMELINE / AUDIT HISTORY
      ───────────────────────────────────────────────────────────────────────────── */}
      <Modal
        isOpen={isTimelineOpen}
        onClose={() => setIsTimelineOpen(false)}
        title="سجل تتبع ومسار القطعة (Item Audit Timeline)"
        size="md"
      >
        {loadingTimeline ? (
          <div className="p-12 flex flex-col items-center justify-center">
            <Loader size="md" />
            <span className="text-slate-500 text-xs mt-2">جاري استرجاع تاريخ القطعة...</span>
          </div>
        ) : timelineItem ? (
          <div className="flex flex-col gap-4 text-right font-arabic">
            {/* Header info */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex items-center justify-between">
              <div>
                <span className="font-mono text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                  {timelineItem.itemCode}
                </span>
                <h3 className="font-bold text-slate-800 text-base mt-1">{timelineItem.itemName}</h3>
                <div className="text-xs text-slate-500 mt-0.5">
                  المالك الحالي: <strong>{timelineItem.employeeName}</strong> {timelineItem.userCode ? `(كود: ${timelineItem.userCode})` : ''}
                </div>
              </div>

              <div className="text-left">
                {!timelineItem.userId ? (
                  <Badge variant="warning">حر بالمخزن</Badge>
                ) : timelineItem.isInLaundry ? (
                  <Badge variant="warning">بالمغسلة</Badge>
                ) : (
                  <Badge variant="success">مع الموظف</Badge>
                )}
              </div>
            </div>

            {/* Timeline */}
            <div>
              <h4 className="text-xs font-bold text-slate-700 mb-3 flex items-center gap-1.5">
                <History size={14} className="text-blue-600" />
                سجل التحويلات وتتبع الحركات السابقة
              </h4>

              {(!timelineItem.transferHistory || timelineItem.transferHistory.length === 0) ? (
                <div className="text-xs text-slate-400 bg-slate-50 p-4 rounded-lg text-center italic">
                  لم يتم تسجيل أي عمليات نقل سابقة لهذه القطعة.
                </div>
              ) : (
                <div className="relative pr-5 space-y-4 before:content-[''] before:absolute before:top-2 before:bottom-2 before:right-2 before:w-0.5 before:bg-blue-200">
                  {timelineItem.transferHistory.map((t: any, idx: number) => (
                    <div key={t.transferId || idx} className="relative">
                      {/* Circle bullet */}
                      <span className="absolute -right-5 top-1 w-3 h-3 rounded-full bg-blue-600 ring-4 ring-white" />

                      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
                        <div className="flex justify-between items-start text-xs text-slate-500">
                          <span className="font-mono font-medium text-slate-700">
                            {t.transferredAt ? new Date(t.transferredAt).toLocaleString('ar-EG') : '---'}
                          </span>
                          <span className="text-[11px] bg-slate-100 px-2 py-0.5 rounded">
                            بواسطة: {t.transferredByName || 'المسؤول'}
                          </span>
                        </div>

                        <div className="mt-2 text-xs flex items-center gap-1.5">
                          <span className="text-rose-700 font-semibold">{t.fromEmployeeName || 'المخزن'}</span>
                          <span className="text-slate-400">➔</span>
                          <span className="text-emerald-700 font-bold">{t.toEmployeeName || 'المخزن'}</span>
                        </div>

                        {t.reason && (
                          <div className="mt-1.5 text-xs text-slate-600 bg-slate-50 p-2 rounded border border-slate-100">
                            السبب: {t.reason}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <Button variant="outline" size="sm" onClick={() => setIsTimelineOpen(false)}>
                إغلاق
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
};

export default CustodyTransferPage;
