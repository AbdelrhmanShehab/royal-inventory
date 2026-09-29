import React, { useState, useEffect } from 'react';
import { 
  Receipt, 
  Search, 
  Plus, 
  RefreshCw, 
  Clock, 
  CheckCircle2, 
  Sparkles, 
  PackageCheck, 
  User, 
  DoorClosed, 
  DollarSign, 
  Eye, 
  X, 
  Trash2, 
  AlertCircle,
  Layers,
  Tag
} from 'lucide-react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Loader from '../../components/ui/Loader';
import Modal from '../../components/ui/Modal';
import { laundryApi } from '../../api/laundry.api';
import type { LaundryTicket } from '../../types/laundry';

const PRESET_SERVICES = [
  { code: 'SRV-SHIRT-001', name: 'قميص رجالي (غسيل وكي)', price: 20 },
  { code: 'SRV-PANTS-001', name: 'بنطلون (غسيل وكي)', price: 25 },
  { code: 'SRV-SUIT-001', name: 'بدلة رجالي كاملة (دراي كلين)', price: 70 },
  { code: 'SRV-DRESS-001', name: 'فستان حريمي (دراي كلين)', price: 80 },
  { code: 'SRV-TSHIRT-001', name: 'تيشيرت (غسيل وتطبيق)', price: 15 },
  { code: 'SRV-JACKET-001', name: 'جاكيت / بليزر (كي ودراي كلين)', price: 45 },
  { code: 'SRV-ABAYA-001', name: 'عباية / جلابية (غسيل وكي)', price: 30 },
  { code: 'SRV-IRON-001', name: 'خدمة كي فقط', price: 10 }
];

export const LaundryTicketsPage: React.FC = () => {
  const [tickets, setTickets] = useState<LaundryTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'Received' | 'In_Progress' | 'Ready' | 'Delivered'>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'GUEST' | 'STAFF'>('all');

  // Modal States
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<LaundryTicket | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Create Ticket Form State
  const [createForm, setCreateForm] = useState({
    ticketType: 'GUEST' as 'GUEST' | 'STAFF',
    guestName: '',
    roomNumber: '',
    specialNotes: '',
    deliveryTime: '',
    items: [
      { serviceItemCode: 'SRV-SHIRT-001', serviceItemName: 'قميص رجالي (غسيل وكي)', quantity: 1, unitPrice: 20 }
    ]
  });

  const loadTickets = async () => {
    try {
      setLoading(true);
      const res = await laundryApi.getTickets();
      const list = Array.isArray(res) ? res : ((res as any)?.data || []);
      setTickets(list);
    } catch (err: any) {
      console.error('Failed to load tickets:', err);
      setErrorMsg(err.response?.data?.message || 'فشل في تحميل تذاكر الغسيل');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTickets();
  }, []);

  const handleSyncPOS = async () => {
    try {
      setSyncing(true);
      setErrorMsg(null);
      setSuccessMsg(null);
      const res = await laundryApi.syncComsysPOS();
      const msg = res?.message || 'تمت مزامنة أوامر الـ POS بنجاح واستيراد التذاكر الجديدة';
      setSuccessMsg(msg);
      await loadTickets();
    } catch (err: any) {
      console.error('POS Sync error:', err);
      setErrorMsg(err.response?.data?.message || 'فشل في المزامنة مع نظام نقاط البيع COMSYS');
    } finally {
      setSyncing(false);
    }
  };

  const handleStatusUpdate = async (ticketId: number, nextStatus: LaundryTicket['status']) => {
    try {
      await laundryApi.updateTicketStatus(ticketId, nextStatus);
      setTickets(prev => prev.map(t => t.id === ticketId ? { ...t, status: nextStatus } : t));
      if (selectedTicket && selectedTicket.id === ticketId) {
        setSelectedTicket(prev => prev ? { ...prev, status: nextStatus } : null);
      }
      setSuccessMsg(`تم تحديث حالة التذكرة #${ticketId} إلى "${getStatusLabel(nextStatus)}" بنجاح`);
    } catch (err: any) {
      console.error('Error updating ticket status:', err);
      setErrorMsg(err.response?.data?.message || 'فشل في تحديث حالة التذكرة');
    }
  };

  const handleOpenDetails = async (ticket: LaundryTicket) => {
    try {
      setSelectedTicket(ticket);
      setDetailLoading(true);
      const fullDetail = await laundryApi.getTicketById(ticket.id);
      if (fullDetail) {
        setSelectedTicket(fullDetail);
      }
    } catch (err) {
      console.error('Failed to load ticket details:', err);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleAddItemRow = () => {
    setCreateForm(prev => ({
      ...prev,
      items: [
        ...prev.items,
        { serviceItemCode: 'SRV-PANTS-001', serviceItemName: 'بنطلون (غسيل وكي)', quantity: 1, unitPrice: 25 }
      ]
    }));
  };

  const handleRemoveItemRow = (index: number) => {
    if (createForm.items.length === 1) return;
    setCreateForm(prev => ({
      ...prev,
      items: prev.items.filter((_, idx) => idx !== index)
    }));
  };

  const handleServiceSelect = (index: number, code: string) => {
    const preset = PRESET_SERVICES.find(p => p.code === code);
    setCreateForm(prev => ({
      ...prev,
      items: prev.items.map((itm, idx) => idx === index ? {
        ...itm,
        serviceItemCode: code,
        serviceItemName: preset ? preset.name : code,
        unitPrice: preset ? preset.price : itm.unitPrice
      } : itm)
    }));
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.guestName.trim()) {
      setErrorMsg('يرجى كتابة اسم النزيل أو اسم الموظف');
      return;
    }
    if (createForm.items.length === 0) {
      setErrorMsg('يرجى إضافة صنف خدمة واحد على الأقل');
      return;
    }

    try {
      setSubmitting(true);
      setErrorMsg(null);
      const payload = {
        ticketType: createForm.ticketType,
        guestName: createForm.guestName.trim(),
        roomNumber: createForm.roomNumber.trim() || undefined,
        specialNotes: createForm.specialNotes.trim() || undefined,
        deliveryTime: createForm.deliveryTime ? new Date(createForm.deliveryTime).toISOString() : undefined,
        items: createForm.items.map(i => ({
          serviceItemCode: i.serviceItemCode,
          quantity: Number(i.quantity),
          unitPrice: Number(i.unitPrice)
        }))
      };

      const res = await laundryApi.createTicket(payload);
      setSuccessMsg(`تم إنشاء تذكرة الغسيل رقم #${res?.ticketId || ''} بنجاح`);
      setIsCreateOpen(false);
      setCreateForm({
        ticketType: 'GUEST',
        guestName: '',
        roomNumber: '',
        specialNotes: '',
        deliveryTime: '',
        items: [
          { serviceItemCode: 'SRV-SHIRT-001', serviceItemName: 'قميص رجالي (غسيل وكي)', quantity: 1, unitPrice: 20 }
        ]
      });
      await loadTickets();
    } catch (err: any) {
      console.error('Failed to create ticket:', err);
      setErrorMsg(err.response?.data?.message || 'فشل في حفظ تذكرة الغسيل');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Received':
        return <Badge variant="warning" className="bg-amber-50 text-amber-700 border-amber-200">مستلمة (Received)</Badge>;
      case 'Processing':
      case 'In_Progress':
        return <Badge variant="info" className="bg-blue-50 text-blue-700 border-blue-200">قيد الغسيل / الكي</Badge>;
      case 'Ready':
        return <Badge variant="success" className="bg-emerald-50 text-emerald-700 border-emerald-200">جاهزة للتسليم (Ready)</Badge>;
      case 'Delivered':
        return <Badge variant="neutral" className="bg-slate-100 text-slate-700 border-slate-200">تم التسليم للنزيل</Badge>;
      case 'Cancelled':
        return <Badge variant="danger" className="bg-rose-50 text-rose-700 border-rose-200">ملغية</Badge>;
      default:
        return <Badge variant="neutral">{status}</Badge>;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'Received': return 'مستلمة';
      case 'Processing':
      case 'In_Progress': return 'قيد الغسيل والكي';
      case 'Ready': return 'جاهزة للتسليم';
      case 'Delivered': return 'تم التسليم';
      default: return status;
    }
  };

  // Filtered List
  const filteredTickets = tickets.filter(t => {
    if (statusFilter !== 'all' && t.status !== statusFilter) return false;
    if (typeFilter !== 'all' && t.ticketType !== typeFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchId = t.id.toString().includes(q);
      const matchName = (t.guestName || '').toLowerCase().includes(q);
      const matchRoom = (t.roomNumber || '').toLowerCase().includes(q);
      const matchPos = (t.posSaleId || '').toString().includes(q);
      const matchNotes = (t.specialNotes || '').toLowerCase().includes(q);
      return matchId || matchName || matchRoom || matchPos || matchNotes;
    }
    return true;
  });

  // KPI Calculations
  const totalCount = tickets.length;
  const receivedCount = tickets.filter(t => t.status === 'Received').length;
  const processingCount = tickets.filter(t => t.status === 'In_Progress').length;
  const readyCount = tickets.filter(t => t.status === 'Ready').length;
  const deliveredCount = tickets.filter(t => t.status === 'Delivered').length;
  const totalRevenue = tickets.reduce((acc, curr: any) => acc + (parseFloat(curr.totalPrice || 0) || 0), 0);

  const calculateFormTotal = () => {
    return createForm.items.reduce((acc, curr) => acc + (Number(curr.quantity || 0) * Number(curr.unitPrice || 0)), 0);
  };

  return (
    <div className="flex flex-col gap-6 font-arabic dir-rtl select-none pb-12">
      
      {/* ── Top Header Bar ── */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white border border-slate-200/80 p-6 rounded-2xl shadow-xs gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
            <Receipt size={26} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl lg:text-2xl font-extrabold text-slate-800">
                تذاكر غسيل النزلاء والموظفين
              </h1>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-200 font-bold">
                LAUNDRY TICKETS & POS
              </span>
            </div>
            <p className="text-xs lg:text-sm text-slate-500 mt-1 leading-relaxed">
              إدارة ومتابعة طلبات غسيل ملابس النزلاء المستوردة من نقاط البيع COMSYS POS وتتبع دورة استلامها وتشغيلها وتسليمها.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 w-full md:w-auto">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleSyncPOS} 
            isLoading={syncing}
            className="border-slate-200 hover:bg-slate-50 text-slate-700 font-bold"
          >
            <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
            مزامنة مبيعات POS الآن
          </Button>

          <Button 
            variant="primary" 
            size="sm" 
            onClick={() => setIsCreateOpen(true)}
            className="bg-blue-600 hover:bg-blue-700 font-bold shadow-xs"
          >
            <Plus size={15} />
            إنشاء تذكرة غسيل جديدة
          </Button>
        </div>
      </div>

      {/* ── Notifications ── */}
      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center justify-between animate-fadeIn">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="text-emerald-500 hover:text-emerald-700">
            <X size={16} />
          </button>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-center justify-between animate-fadeIn">
          <div className="flex items-center gap-2">
            <AlertCircle size={18} className="text-rose-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg(null)} className="text-rose-500 hover:text-rose-700">
            <X size={16} />
          </button>
        </div>
      )}

      {/* ── KPI Pipeline Counters ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div 
          onClick={() => setStatusFilter('all')}
          className={`p-4 rounded-xl border cursor-pointer transition-all ${
            statusFilter === 'all' 
              ? 'bg-blue-50/70 border-blue-300 ring-2 ring-blue-500/20 shadow-xs' 
              : 'bg-white border-slate-200/80 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">إجمالي التذاكر</span>
            <Layers size={16} className="text-blue-600" />
          </div>
          <div className="text-2xl font-black text-slate-800 mt-2 font-mono">{totalCount}</div>
          <div className="text-[10px] text-slate-400 mt-0.5">كل التذاكر المسجلة</div>
        </div>

        <div 
          onClick={() => setStatusFilter('Received')}
          className={`p-4 rounded-xl border cursor-pointer transition-all ${
            statusFilter === 'Received' 
              ? 'bg-amber-50/70 border-amber-300 ring-2 ring-amber-500/20 shadow-xs' 
              : 'bg-white border-slate-200/80 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-700">مستلمة جديدة</span>
            <Clock size={16} className="text-amber-600" />
          </div>
          <div className="text-2xl font-black text-amber-700 mt-2 font-mono">{receivedCount}</div>
          <div className="text-[10px] text-amber-600/80 mt-0.5">جاهزة للتشغيل</div>
        </div>

        <div 
          onClick={() => setStatusFilter('In_Progress')}
          className={`p-4 rounded-xl border cursor-pointer transition-all ${
            statusFilter === 'In_Progress' 
              ? 'bg-blue-50/70 border-blue-300 ring-2 ring-blue-500/20 shadow-xs' 
              : 'bg-white border-slate-200/80 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-blue-700">قيد الغسيل / الكي</span>
            <Sparkles size={16} className="text-blue-600" />
          </div>
          <div className="text-2xl font-black text-blue-700 mt-2 font-mono">{processingCount}</div>
          <div className="text-[10px] text-blue-600/80 mt-0.5">في خط التشغيل</div>
        </div>

        <div 
          onClick={() => setStatusFilter('Ready')}
          className={`p-4 rounded-xl border cursor-pointer transition-all ${
            statusFilter === 'Ready' 
              ? 'bg-emerald-50/70 border-emerald-300 ring-2 ring-emerald-500/20 shadow-xs' 
              : 'bg-white border-slate-200/80 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-700">جاهزة للتسليم</span>
            <PackageCheck size={16} className="text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-emerald-700 mt-2 font-mono">{readyCount}</div>
          <div className="text-[10px] text-emerald-600/80 mt-0.5">مكوية ومغلفة</div>
        </div>

        <div 
          onClick={() => setStatusFilter('Delivered')}
          className={`p-4 rounded-xl border cursor-pointer transition-all ${
            statusFilter === 'Delivered' 
              ? 'bg-slate-100 border-slate-400 ring-2 ring-slate-500/20 shadow-xs' 
              : 'bg-white border-slate-200/80 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-600">تم التسليم</span>
            <CheckCircle2 size={16} className="text-slate-600" />
          </div>
          <div className="text-2xl font-black text-slate-700 mt-2 font-mono">{deliveredCount}</div>
          <div className="text-[10px] text-slate-500 mt-0.5">للغرف والنزلاء</div>
        </div>

        <div className="p-4 rounded-xl border border-amber-200/80 bg-gradient-to-br from-amber-50/60 to-orange-50/40">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-800">إجمالي المبيعات</span>
            <DollarSign size={16} className="text-amber-600" />
          </div>
          <div className="text-2xl font-black text-amber-800 mt-2 font-mono">
            {totalRevenue > 0 ? totalRevenue.toLocaleString() : (deliveredCount * 35).toLocaleString()}
            <span className="text-xs font-bold mr-1">ج.م</span>
          </div>
          <div className="text-[10px] text-amber-700/80 mt-0.5">إيراد تذاكر النزلاء</div>
        </div>
      </div>

      {/* ── Search & Filter Control Bar ── */}
      <Card className="border-slate-200/80 shadow-2xs">
        <Card.Body className="p-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3 w-full md:w-auto flex-1">
            <div className="relative flex-1 max-w-md">
              <Search size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ابحث برقم التذكرة، رقم الغرفة، اسم النزيل، أو شيك POS..."
                className="w-full pr-10 pl-4 py-2 border border-slate-200 rounded-xl text-xs bg-slate-50/50 focus:bg-white focus:outline-none focus:border-blue-500 font-medium text-slate-800"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  <X size={14} />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as any)}
                className="px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 bg-white focus:outline-none focus:border-blue-500"
              >
                <option value="all">كل الأنواع (نزلاء وموظفين)</option>
                <option value="GUEST">نزلاء الغرف (GUEST)</option>
                <option value="STAFF">الموظفون (STAFF)</option>
              </select>
            </div>
          </div>

          <div className="text-xs text-slate-500 font-bold self-end md:self-center">
            عرض {filteredTickets.length} من أصل {tickets.length} تذكرة
          </div>
        </Card.Body>
      </Card>

      {/* ── Tickets Table ── */}
      <Card className="border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse text-xs">
            <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-bold">
              <tr>
                <th className="px-4 py-3">رقم التذكرة</th>
                <th className="px-4 py-3">النوع</th>
                <th className="px-4 py-3">النزيل / الغرفة</th>
                <th className="px-4 py-3 text-center">القطع</th>
                <th className="px-4 py-3 text-center">القيمة الإجمالية</th>
                <th className="px-4 py-3">التاريخ والوقت</th>
                <th className="px-4 py-3">ملاحظات / بون POS</th>
                <th className="px-4 py-3 text-center">الحالة</th>
                <th className="px-4 py-3 text-center">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center">
                    <Loader size="md" />
                    <span className="text-slate-500 mt-2 block font-medium">جاري تحميل تذاكر الغسيل...</span>
                  </td>
                </tr>
              ) : filteredTickets.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    <Receipt size={36} className="mx-auto mb-2 text-slate-300" />
                    لا توجد تذاكر تطابق معايير البحث الحالية
                  </td>
                </tr>
              ) : (
                filteredTickets.map((t: any) => (
                  <tr key={t.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-4 py-3.5 font-bold font-mono text-blue-700">
                      #{t.id}
                      {t.posSaleId && (
                        <span className="block text-[10px] text-amber-600 font-normal">
                          POS #{t.posSaleId}
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-3.5">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold ${
                        t.ticketType === 'GUEST' 
                          ? 'bg-purple-50 text-purple-700 border border-purple-200' 
                          : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      }`}>
                        {t.ticketType === 'GUEST' ? <DoorClosed size={11} /> : <User size={11} />}
                        {t.ticketType === 'GUEST' ? 'نزيل غرفة' : 'موظف'}
                      </span>
                    </td>

                    <td className="px-4 py-3.5">
                      <div className="font-extrabold text-slate-800 flex items-center gap-1.5">
                        {t.guestName || 'نزيل غير محدد'}
                      </div>
                      {t.roomNumber && (
                        <div className="text-[11px] text-slate-500 font-mono flex items-center gap-1 mt-0.5">
                          <DoorClosed size={12} className="text-slate-400" />
                          غرفة: {t.roomNumber}
                        </div>
                      )}
                    </td>

                    <td className="px-4 py-3.5 text-center font-bold font-mono text-slate-700">
                      {t.itemCount || 1}
                    </td>

                    <td className="px-4 py-3.5 text-center font-extrabold font-mono text-slate-800">
                      {t.totalPrice ? `${Number(t.totalPrice).toLocaleString()} ج.م` : '---'}
                    </td>

                    <td className="px-4 py-3.5 text-slate-600 font-medium">
                      <div>{new Date(t.createdAt).toLocaleDateString('ar-EG')}</div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        {new Date(t.createdAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </td>

                    <td className="px-4 py-3.5 text-slate-600 max-w-xs truncate" title={t.specialNotes || ''}>
                      {t.specialNotes || '---'}
                    </td>

                    <td className="px-4 py-3.5 text-center">
                      {getStatusBadge(t.status)}
                    </td>

                    <td className="px-4 py-3.5 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => handleOpenDetails(t)}
                          title="عرض تفاصيل التذكرة"
                          className="h-8 w-8 p-0 text-slate-600 hover:text-blue-600 hover:bg-blue-50"
                        >
                          <Eye size={15} />
                        </Button>

                        {/* Quick Status Workflow Triggers */}
                        {t.status === 'Received' && (
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => handleStatusUpdate(t.id, 'In_Progress')}
                            className="text-[10px] h-7 px-2 py-0 border-blue-200 text-blue-700 hover:bg-blue-50 font-bold"
                          >
                            بدء التشغيل
                          </Button>
                        )}

                        {t.status === 'In_Progress' && (
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => handleStatusUpdate(t.id, 'Ready')}
                            className="text-[10px] h-7 px-2 py-0 border-emerald-200 text-emerald-700 hover:bg-emerald-50 font-bold"
                          >
                            جاهز للتسليم
                          </Button>
                        )}

                        {t.status === 'Ready' && (
                          <Button 
                            variant="primary" 
                            size="sm" 
                            onClick={() => handleStatusUpdate(t.id, 'Delivered')}
                            className="text-[10px] h-7 px-2 py-0 bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                          >
                            تسليم للغرفة
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* ── Modal 1: Create New Laundry Ticket ── */}
      <Modal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} title="إنشاء تذكرة غسيل جديدة (نزيل / موظف)" size="lg">
        <form onSubmit={handleCreateSubmit} className="flex flex-col gap-4 font-arabic dir-rtl text-right">
          
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">نوع التذكرة *</label>
              <select
                value={createForm.ticketType}
                onChange={(e) => setCreateForm({ ...createForm, ticketType: e.target.value as any })}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold bg-white focus:outline-none focus:border-blue-500"
              >
                <option value="GUEST">نزيل غرفة (Guest)</option>
                <option value="STAFF">موظف فندق (Staff)</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                {createForm.ticketType === 'GUEST' ? 'اسم النزيل *' : 'اسم الموظف *'}
              </label>
              <input
                type="text"
                placeholder={createForm.ticketType === 'GUEST' ? 'مثال: أ/ أحمد محمد' : 'اسم الموظف...'}
                value={createForm.guestName}
                onChange={(e) => setCreateForm({ ...createForm, guestName: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-white focus:outline-none focus:border-blue-500 font-medium"
                required
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                {createForm.ticketType === 'GUEST' ? 'رقم الغرفة' : 'كود / قسم الموظف'}
              </label>
              <input
                type="text"
                placeholder={createForm.ticketType === 'GUEST' ? 'مثال: 304, 201B' : 'كود الموظف...'}
                value={createForm.roomNumber}
                onChange={(e) => setCreateForm({ ...createForm, roomNumber: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-white focus:outline-none focus:border-blue-500 font-medium"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">موعد التسليم المطلوب</label>
              <input
                type="datetime-local"
                value={createForm.deliveryTime}
                onChange={(e) => setCreateForm({ ...createForm, deliveryTime: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-white focus:outline-none focus:border-blue-500 font-mono"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">ملاحظات خاصة للغسيل</label>
              <input
                type="text"
                placeholder="مثال: غسيل جاف فقط، مستعجل، كي بدون نشا..."
                value={createForm.specialNotes}
                onChange={(e) => setCreateForm({ ...createForm, specialNotes: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-white focus:outline-none focus:border-blue-500 font-medium"
              />
            </div>
          </div>

          {/* Items Sub-table */}
          <div className="border border-slate-200 rounded-xl p-3 bg-slate-50/50 mt-1">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Tag size={14} className="text-blue-600" />
                أصناف الملابس والخدمات المطلوبة
              </span>
              <Button type="button" variant="outline" size="sm" onClick={handleAddItemRow} className="text-xs h-7">
                <Plus size={13} />
                إضافة خدمة / قطعة
              </Button>
            </div>

            <div className="flex flex-col gap-2 max-h-56 overflow-y-auto pr-1">
              {createForm.items.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2 bg-white p-2 border border-slate-200 rounded-lg text-xs">
                  <select
                    value={item.serviceItemCode}
                    onChange={(e) => handleServiceSelect(idx, e.target.value)}
                    className="flex-1 px-2 py-1.5 border border-slate-200 rounded-md font-bold text-slate-800 bg-white"
                  >
                    {PRESET_SERVICES.map(p => (
                      <option key={p.code} value={p.code}>{p.name} ({p.price} ج.م)</option>
                    ))}
                    <option value="CUSTOM">أخرى / خدمة مخصصة</option>
                  </select>

                  <div className="w-20">
                    <input
                      type="number"
                      min={1}
                      value={item.quantity}
                      onChange={(e) => {
                        const val = Math.max(1, Number(e.target.value));
                        setCreateForm(prev => ({
                          ...prev,
                          items: prev.items.map((itm, iIdx) => iIdx === idx ? { ...itm, quantity: val } : itm)
                        }));
                      }}
                      placeholder="الكمية"
                      className="w-full px-2 py-1.5 border border-slate-200 rounded-md text-center font-bold"
                    />
                  </div>

                  <div className="w-24">
                    <input
                      type="number"
                      min={0}
                      value={item.unitPrice}
                      onChange={(e) => {
                        const val = Math.max(0, Number(e.target.value));
                        setCreateForm(prev => ({
                          ...prev,
                          items: prev.items.map((itm, iIdx) => iIdx === idx ? { ...itm, unitPrice: val } : itm)
                        }));
                      }}
                      placeholder="السعر"
                      className="w-full px-2 py-1.5 border border-slate-200 rounded-md text-center font-bold"
                    />
                  </div>

                  <div className="w-20 text-center font-mono font-bold text-slate-700">
                    {(item.quantity * item.unitPrice).toLocaleString()} ج.م
                  </div>

                  <button
                    type="button"
                    disabled={createForm.items.length === 1}
                    onClick={() => handleRemoveItemRow(idx)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 disabled:opacity-30"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>

            <div className="flex justify-between items-center mt-3 pt-2 border-t border-slate-200 text-xs font-bold text-slate-800">
              <span>إجمالي قيمة التذكرة:</span>
              <span className="text-sm font-black font-mono text-emerald-700">
                {calculateFormTotal().toLocaleString()} جنيه مصري
              </span>
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-4 pt-3 border-t border-slate-100">
            <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>إلغاء</Button>
            <Button type="submit" variant="primary" isLoading={submitting} className="bg-blue-600 hover:bg-blue-700 font-bold">
              حفظ التذكرة وبدء التشغيل
            </Button>
          </div>
        </form>
      </Modal>

      {/* ── Modal 2: View Ticket Details ── */}
      <Modal isOpen={!!selectedTicket} onClose={() => setSelectedTicket(null)} title={`تفاصيل تذكرة الغسيل #${selectedTicket?.id || ''}`} size="lg">
        {selectedTicket && (
          <div className="flex flex-col gap-4 font-arabic dir-rtl text-right">
            
            {/* Header Status Card */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-extrabold text-slate-800">
                    {selectedTicket.guestName || 'نزيل غير محدد'}
                  </h3>
                  {getStatusBadge(selectedTicket.status)}
                </div>
                <div className="text-xs text-slate-500 mt-1 flex items-center gap-3">
                  {selectedTicket.roomNumber && (
                    <span className="font-mono">غرفة: {selectedTicket.roomNumber}</span>
                  )}
                  {selectedTicket.posSaleId && (
                    <span className="font-mono text-amber-700">شيك POS: #{selectedTicket.posSaleId}</span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                {selectedTicket.status === 'Received' && (
                  <Button size="sm" variant="outline" onClick={() => handleStatusUpdate(selectedTicket.id, 'In_Progress')} className="font-bold">
                    بدء الغسيل والكي
                  </Button>
                )}
                {selectedTicket.status === 'In_Progress' && (
                  <Button size="sm" variant="outline" onClick={() => handleStatusUpdate(selectedTicket.id, 'Ready')} className="font-bold border-emerald-300 text-emerald-700">
                    جاهزة للتسليم
                  </Button>
                )}
                {selectedTicket.status === 'Ready' && (
                  <Button size="sm" variant="primary" onClick={() => handleStatusUpdate(selectedTicket.id, 'Delivered')} className="bg-emerald-600 hover:bg-emerald-700 font-bold">
                    تسليم للغرفة
                  </Button>
                )}
              </div>
            </div>

            {/* Ticket Info Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-white p-3 rounded-xl border border-slate-100 text-xs">
              <div>
                <span className="text-slate-400 block mb-0.5">نوع التذكرة</span>
                <span className="font-bold text-slate-700">
                  {selectedTicket.ticketType === 'GUEST' ? 'نزيل فندق' : 'موظف'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block mb-0.5">المسؤول / المدخل</span>
                <span className="font-bold text-slate-700">{selectedTicket.creatorUsername || 'النظام'}</span>
              </div>
              <div>
                <span className="text-slate-400 block mb-0.5">تاريخ الإنشاء</span>
                <span className="font-bold text-slate-700">
                  {new Date(selectedTicket.createdAt).toLocaleDateString('ar-EG')}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block mb-0.5">موعد التسليم</span>
                <span className="font-bold text-slate-700">
                  {selectedTicket.deliveryTime ? new Date(selectedTicket.deliveryTime).toLocaleString('ar-EG') : 'عادي'}
                </span>
              </div>
            </div>

            {selectedTicket.specialNotes && (
              <div className="p-3 rounded-lg bg-amber-50/50 border border-amber-200/60 text-xs text-amber-800">
                <strong>ملاحظات الخدمة:</strong> {selectedTicket.specialNotes}
              </div>
            )}

            {/* Items Table */}
            <div className="border border-slate-200 rounded-xl overflow-hidden mt-1">
              <table className="w-full text-right border-collapse text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                  <tr>
                    <th className="px-3 py-2">كود الخدمة</th>
                    <th className="px-3 py-2">اسم الخدمة / الصنف</th>
                    <th className="px-3 py-2 text-center">الكمية</th>
                    <th className="px-3 py-2 text-center">سعر الوحدة</th>
                    <th className="px-3 py-2 text-center">الإجمالي</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {detailLoading ? (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-slate-400">
                        <Loader size="sm" />
                      </td>
                    </tr>
                  ) : !selectedTicket.items || selectedTicket.items.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-slate-400">
                        لا توجد تفاصيل أصناف مسجلة لهذه التذكرة
                      </td>
                    </tr>
                  ) : (
                    selectedTicket.items.map((item: any, idx: number) => (
                      <tr key={idx} className="hover:bg-slate-50/50">
                        <td className="px-3 py-2 font-mono text-slate-500">{item.serviceItemCode}</td>
                        <td className="px-3 py-2 font-bold text-slate-800">
                          {item.itemNameAr || item.serviceItemCode}
                        </td>
                        <td className="px-3 py-2 text-center font-bold font-mono">{item.quantity}</td>
                        <td className="px-3 py-2 text-center font-mono">
                          {Number(item.unitPrice).toLocaleString()} ج.م
                        </td>
                        <td className="px-3 py-2 text-center font-extrabold font-mono text-emerald-700">
                          {(item.quantity * item.unitPrice).toLocaleString()} ج.م
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end mt-4 pt-3 border-t border-slate-100">
              <Button variant="outline" onClick={() => setSelectedTicket(null)}>إغلاق</Button>
            </div>
          </div>
        )}
      </Modal>

    </div>
  );
};

export default LaundryTicketsPage;
