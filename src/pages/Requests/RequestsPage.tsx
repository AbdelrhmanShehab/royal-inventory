import { useState, useEffect } from 'react';
import { 
  ClipboardList, 
  Plus, 
  History
} from 'lucide-react';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Drawer from '../../components/ui/Drawer';
import Modal from '../../components/ui/Modal';
import Input from '../../components/ui/Input';
import Loader from '../../components/ui/Loader';
import EmptyState from '../../components/ui/EmptyState';
import { requestsApi } from '../../api/requests.api';
import { hierarchyApi } from '../../api/hierarchy.api';
import type { OperationsRequest } from '../../types/request';
import type { OrganizationNode } from '../../types/hierarchy';

export default function RequestsPage() {
  const [requests, setRequests] = useState<OperationsRequest[]>([]);
  const [nodes, setNodes] = useState<OrganizationNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReq, setSelectedReq] = useState<OperationsRequest | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // Filters
  const [filterStatus, setFilterStatus] = useState('');
  const [searchUnit, setSearchUnit] = useState('');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  // Form states for approval/rejection
  const [isApproving, setIsApproving] = useState(false);
  const [approvalQuantities, setApprovalQuantities] = useState<Record<string, number>>({});
  const [actionNotes, setActionNotes] = useState('');

  // Form state for creating request
  const [createForm, setCreateForm] = useState({
    unitId: '',
    creator: 'خالد العتيبي',
    itemName: '',
    requiredQty: 10,
    unit: 'كجم',
    notes: ''
  });

  // Flatten tree nodes helper
  const flattenNodes = (list: OrganizationNode[]): OrganizationNode[] => {
    const result: OrganizationNode[] = [];
    const recurse = (nodesList: OrganizationNode[]) => {
      for (const node of nodesList) {
        result.push(node);
        if (node.children && node.children.length > 0) {
          recurse(node.children);
        }
      }
    };
    recurse(list);
    return result;
  };

  const loadData = async () => {
    try {
      const data = await requestsApi.getRequests();
      setRequests(data);
      
      const tree = await hierarchyApi.getTree();
      const flat = flattenNodes(tree);
      setNodes(flat);

      if (flat.length > 0 && !createForm.unitId) {
        setCreateForm(prev => ({ ...prev, unitId: flat[0].id }));
      }

      // Refresh selected req if open in drawer
      if (selectedReq) {
        const updated = data.find(r => r.id === selectedReq.id);
        if (updated) setSelectedReq(updated);
      }
    } catch (err) {
      console.error('Error fetching requests data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRowClick = (req: OperationsRequest) => {
    setSelectedReq(req);
    // Initialize approval quantities map
    const qMap: Record<string, number> = {};
    req.items.forEach(item => {
      qMap[item.itemCode] = item.requestedQty;
    });
    setApprovalQuantities(qMap);
    setActionNotes('');
    setIsApproving(false);
    setIsDrawerOpen(true);
  };

  // Filter requests
  const filteredRequests = requests.filter(req => {
    const matchesStatus = filterStatus ? req.status === filterStatus : true;
    const matchesUnit = searchUnit ? (req.requestingNodeName || '').includes(searchUnit) : true;
    return matchesStatus && matchesUnit;
  });

  // Pagination
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentRequests = filteredRequests.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredRequests.length / itemsPerPage);

  // Workflow Handlers
  const handleApprove = async () => {
    if (!selectedReq) return;
    try {
      setLoading(true);
      const itemsList = selectedReq.items.map(item => ({
        itemCode: item.itemCode,
        approvedQty: Number(approvalQuantities[item.itemCode] || item.requestedQty)
      }));

      await requestsApi.approveRequest(selectedReq.id, {
        items: itemsList,
        notes: actionNotes || 'تمت الموافقة على طلب الصرف وتحديد كميات الاعتماد.'
      });
      
      setIsApproving(false);
      await loadData();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    if (!selectedReq) return;
    try {
      setLoading(true);
      await requestsApi.rejectRequest(selectedReq.id, {
        notes: actionNotes || 'تم رفض طلب التموين لعدم مطابقة الشروط أو عدم توفر ميزانية تشغيلية.'
      });
      setIsApproving(false);
      await loadData();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleIssue = async () => {
    if (!selectedReq) return;
    try {
      setLoading(true);
      await requestsApi.issueRequest(selectedReq.id, {
        notes: actionNotes || 'تم صرف المواد وتحويل الكميات تلقائياً إلى المستودع الفرعي.'
      });
      await loadData();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      const selectedUnit = nodes.find(n => n.id === createForm.unitId);

      await requestsApi.createRequest({
        requestingNodeId: Number(createForm.unitId.replace(/\D/g, '')) || 11,
        requestingNodeName: selectedUnit ? selectedUnit.name : 'مطبخ جاردن الشرقي',
        createdBy: createForm.creator,
        items: [
          {
            itemCode: 'ITEM-' + Date.now(),
            itemName: createForm.itemName,
            unit: createForm.unit,
            requestedQty: Number(createForm.requiredQty)
          }
        ]
      });

      setIsCreateModalOpen(false);
      setCreateForm(prev => ({
        ...prev,
        itemName: '',
        requiredQty: 10,
        notes: ''
      }));
      await loadData();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading && requests.length === 0) {
    return <div className="h-full flex items-center justify-center"><Loader size="lg" label="جاري تحميل إدارة الطلبات التشغيلية..." /></div>;
  }

  const statusLabels: Record<string, { text: string; variant: string }> = {
    pending: { text: 'انتظار الاعتماد', variant: 'warning' },
    approved: { text: 'معتمد للصرف', variant: 'info' },
    issued: { text: 'تم الصرف والشحن', variant: 'success' },
    rejected: { text: 'مرفوض', variant: 'danger' }
  };

  return (
    <div className="flex flex-col gap-6">
      
      {/* Top Banner and Quick Filter Box */}
      <div className="bg-white border border-slate-200/80 p-5 rounded-2xl shadow-xs select-none">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <h1 className="text-base font-bold text-slate-800 flex items-center gap-2">
            <ClipboardList size={18} className="text-blue-600" />
            بوابة طلبات التموين والعهدة
          </h1>
          <div className="flex gap-2">
            <Button variant="primary" size="sm" onClick={() => setIsCreateModalOpen(true)}>
              <Plus size={14} />
              إنشاء طلب تموين
            </Button>
          </div>
        </div>

        {/* Input filters */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-slate-500">حالة الطلب</label>
            <select
              value={filterStatus}
              onChange={(e) => { setFilterStatus(e.target.value); setCurrentPage(1); }}
              className="px-3.5 py-1.5 bg-slate-50 border border-slate-200 text-xs rounded-lg text-slate-700 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            >
              <option value="">الكل</option>
              <option value="pending">معلق (انتظار الاعتماد)</option>
              <option value="approved">معتمد (بانتظار الصرف)</option>
              <option value="issued">مصروف بالكامل</option>
              <option value="rejected">مرفوض</option>
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-slate-500">اسم الجهة الطالبة</label>
            <input 
              type="text"
              value={searchUnit}
              onChange={(e) => { setSearchUnit(e.target.value); setCurrentPage(1); }}
              placeholder="ابحث بالوحدة (مثال: مطبخ)..."
              className="px-3.5 py-1.5 bg-slate-50 border border-slate-200 text-xs rounded-lg placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Requests Table */}
      {currentRequests.length === 0 ? (
        <EmptyState title="لا توجد طلبات صرف حالية" description="لم نجد أي سجل لطلبات تموين تطابق شروط التصفية." />
      ) : (
        <div className="flex flex-col gap-4">
          <Card className="border-slate-200/60 overflow-hidden shadow-xs">
            <div className="w-full overflow-x-auto">
              <table className="w-full text-right border-collapse select-none">
                <thead className="bg-slate-50/75 border-b border-slate-100 sticky top-0">
                  <tr>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500">رقم الطلب</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500">الجهة الطالبة</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500">منشئ الطلب</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500">تاريخ التقديم</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500">الأصناف المطلوبة</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500">الحالة التشغيلية</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 text-center">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {currentRequests.map((req) => {
                    const statusInfo = statusLabels[req.status] || { text: req.status, variant: 'neutral' };
                    return (
                      <tr 
                        key={req.id}
                        onClick={() => handleRowClick(req)}
                        className="hover:bg-slate-50/50 cursor-pointer transition-colors duration-150"
                      >
                        <td className="px-6 py-4 text-xs font-bold text-slate-700">{req.id}</td>
                        <td className="px-6 py-4 text-xs font-bold text-slate-800">{req.requestingNodeName}</td>
                        <td className="px-6 py-4 text-xs text-slate-500 font-semibold">{req.createdBy}</td>
                        <td className="px-6 py-4 text-xs text-slate-400 font-bold">{req.createdAt}</td>
                        <td className="px-6 py-4 text-xs text-slate-650 font-bold font-arabic">
                          {req.items.map(i => `${i.itemName} (${i.requestedQty} ${i.unit || 'وحدة'})`).join('، ')}
                        </td>
                        <td className="px-6 py-4 text-xs">
                          <Badge variant={statusInfo.variant as any}>{statusInfo.text}</Badge>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <button className="px-3 py-1 bg-slate-50 border border-slate-200 hover:border-slate-350 rounded-lg text-[10px] font-bold text-slate-600 hover:text-slate-800 transition-all cursor-pointer">
                            عرض ودراسة
                          </button>
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
                عرض {indexOfFirstItem + 1} - {Math.min(indexOfLastItem, filteredRequests.length)} من أصل {filteredRequests.length} طلب
              </span>
              <div className="flex gap-1">
                <Button 
                  variant="outline" 
                  size="sm" 
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(currentPage - 1)}
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
                  onClick={() => setCurrentPage(currentPage + 1)}
                >
                  التالي
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* REQUEST DETAIL DRAWER */}
      <Drawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        title={selectedReq ? `دراسة ومعالجة طلب: ${selectedReq.id}` : ''}
        size="lg"
      >
        {selectedReq && (
          <div className="flex flex-col gap-6 select-none font-arabic">
            
            {/* Request Summary */}
            <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 flex justify-between items-center">
              <div className="flex flex-col text-right">
                <span className="text-[9px] text-slate-400 font-bold">الجهة الطالبة</span>
                <span className="text-xs font-bold text-slate-800 mt-1">{selectedReq.requestingNodeName}</span>
              </div>
              <Badge variant={statusLabels[selectedReq.status]?.variant as any}>
                {statusLabels[selectedReq.status]?.text}
              </Badge>
            </div>

            {/* Requester & Date */}
            <div className="grid grid-cols-2 gap-4">
              <div className="border border-slate-100 rounded-xl p-3 flex flex-col text-right">
                <span className="text-[10px] text-slate-400 font-bold">منشئ ومقدم الطلب</span>
                <span className="text-xs font-bold text-slate-700 mt-1">{selectedReq.createdBy}</span>
              </div>
              <div className="border border-slate-100 rounded-xl p-3 flex flex-col text-right">
                <span className="text-[10px] text-slate-400 font-bold">توقيت إنشاء الطلب</span>
                <span className="text-xs font-bold text-slate-700 mt-1">{selectedReq.createdAt}</span>
              </div>
            </div>

            {/* Items Table inside Request */}
            <div className="flex flex-col gap-3">
              <span className="text-[10px] font-bold text-slate-400 text-right">الأصناف المدرجة في الطلب</span>
              
              <div className="border border-slate-100 rounded-xl overflow-hidden divide-y divide-slate-100">
                {selectedReq.items.map((item) => (
                  <div key={item.itemCode} className="p-4 flex flex-col gap-3 hover:bg-slate-50/30 font-arabic">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-slate-800">{item.itemName}</span>
                      <span className="text-xs font-extrabold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md">
                        المطلوب: {item.requestedQty} {item.unit || 'وحدة'}
                      </span>
                    </div>

                    {/* Approved / Issued quantity display */}
                    {(selectedReq.status !== 'pending' || isApproving) && (
                      <div className="grid grid-cols-2 gap-4 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                        
                        {/* If in approval mode, show quantity editor input */}
                        {isApproving ? (
                           <div className="flex flex-col gap-1 text-right col-span-2">
                             <label className="text-[9px] font-bold text-slate-500">الكمية المعتمدة للصرف</label>
                             <input 
                               type="number"
                               min={0}
                               max={item.requestedQty}
                               value={approvalQuantities[item.itemCode] ?? item.requestedQty}
                               onChange={(e) => setApprovalQuantities({
                                 ...approvalQuantities,
                                 [item.itemCode]: Number(e.target.value)
                               })}
                               className="px-2.5 py-1 bg-white border border-slate-200 text-xs rounded-md text-slate-700 focus:outline-none focus:border-blue-500"
                             />
                           </div>
                        ) : (
                          <>
                            <div className="flex flex-col text-right">
                              <span className="text-[9px] text-slate-400 font-bold">الكمية المعتمدة</span>
                              <span className="text-xs font-bold text-blue-600 mt-0.5">{item.approvedQty} {item.unit || 'وحدة'}</span>
                            </div>
                            <div className="flex flex-col text-right">
                              <span className="text-[9px] text-slate-400 font-bold">الكمية المصروفة فعلياً</span>
                              <span className="text-xs font-bold text-emerald-600 mt-0.5">{item.issuedQty} {item.unit || 'وحدة'}</span>
                            </div>
                          </>
                        )}

                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Workflow Action Bar */}
            {selectedReq.status === 'pending' && (
              <div className="border border-slate-150 rounded-xl p-4 bg-slate-50 flex flex-col gap-4">
                <span className="text-[10px] font-bold text-slate-500 text-right">معالجة الطلب واعتماده</span>
                
                {isApproving ? (
                  <div className="flex flex-col gap-4">
                    <Input 
                      label="مبررات أو مبرر الاعتماد / الرفض" 
                      placeholder="اكتب ملاحظة توضيحية..." 
                      value={actionNotes}
                      onChange={(e) => setActionNotes(e.target.value)}
                    />
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" size="sm" onClick={() => setIsApproving(false)}>تراجع</Button>
                      <Button variant="danger" size="sm" onClick={handleReject}>رفض الطلب بالكامل</Button>
                      <Button variant="primary" size="sm" onClick={handleApprove}>تأكيد الاعتماد</Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-2 justify-end">
                    <Button variant="outline" size="sm" onClick={() => { setIsApproving(true); setActionNotes(''); }}>
                      دراسة واعتماد الطلب
                    </Button>
                  </div>
                )}
              </div>
            )}

            {selectedReq.status === 'approved' && (
              <div className="border border-slate-150 rounded-xl p-4 bg-emerald-50/50 flex flex-col gap-3">
                <span className="text-[10px] font-bold text-slate-500 text-right">صرف البضائع والكميات</span>
                <p className="text-[10px] text-slate-500 text-right">
                  عند النقر على صرف، سيتم خصم الكميات المعتمدة من المستودع الرئيسي وتحويلها آلياً إلى مستودع الجهة الطالبة، مع تسجيل حركات تحويل رسمية.
                </p>
                <div className="flex flex-col gap-3">
                  <Input 
                    label="رقم مستند الصرف أو ملاحظات" 
                    placeholder="ملاحظات الصرف والتحويل..." 
                    value={actionNotes}
                    onChange={(e) => setActionNotes(e.target.value)}
                  />
                  <div className="flex justify-end gap-2">
                    <Button variant="primary" size="sm" onClick={handleIssue}>
                      تأكيد الصرف والشحن التلقائي
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Timeline Events Audit Log */}
            <div className="flex flex-col gap-3">
              <span className="text-[10px] font-bold text-slate-400 text-right flex items-center gap-1">
                <History size={12} />
                خط سير عملية الاعتماد والتحويل (التاريخ والوقت)
              </span>

              <div className="relative border-r border-slate-200 pr-4 flex flex-col gap-5 text-right">
                {(selectedReq.timeline || []).map((event, idx) => {
                  const evLabels: Record<string, string> = {
                    pending: 'إنشاء وتقديم الطلب',
                    approved: 'اعتماد وموافقة العمليات',
                    issued: 'صرف وتسليم المواد',
                    rejected: 'رفض وإلغاء الطلب'
                  };
                  return (
                    <div key={idx} className="relative font-arabic">
                      {/* Timeline Dot */}
                      <span className="absolute -right-[21px] top-1 w-2.5 h-2.5 rounded-full bg-blue-500 border-2 border-white"></span>
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-slate-800">{evLabels[event.status] || event.status}</span>
                        <span className="text-[9px] text-slate-400 mt-1 font-semibold">بواسطة: {event.user} • {event.timestamp}</span>
                        {event.notes && <p className="text-[10px] text-slate-500 mt-1.5 bg-slate-50 p-2 rounded-md border border-slate-100">{event.notes}</p>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>
        )}
      </Drawer>

      {/* CREATE NEW REQUEST MODAL */}
      <Modal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} title="تقديم طلب تموين وعهد جديد">
        <form onSubmit={handleCreateSubmit} className="flex flex-col gap-4 select-none">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-700">الجهة الطالبة للمواد</label>
            <select 
              value={createForm.unitId}
              onChange={(e) => setCreateForm({ ...createForm, unitId: e.target.value })}
              className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            >
              {nodes.map(node => (
                <option key={node.id} value={node.id}>{node.name}</option>
              ))}
            </select>
          </div>

          <Input 
            label="اسم السلعة المطلوبة" 
            placeholder="مثال: شراشف قطنية سرير كينج" 
            required
            value={createForm.itemName}
            onChange={(e) => setCreateForm({ ...createForm, itemName: e.target.value })}
          />

          <div className="grid grid-cols-2 gap-4">
            <Input 
              label="الكمية المطلوبة" 
              type="number"
              min={1}
              required
              value={createForm.requiredQty}
              onChange={(e) => setCreateForm({ ...createForm, requiredQty: Number(e.target.value) })}
            />
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-700">الوحدة</label>
              <select 
                value={createForm.unit}
                onChange={(e) => setCreateForm({ ...createForm, unit: e.target.value })}
                className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none"
              >
                <option value="كجم">كجم</option>
                <option value="لتر">لتر</option>
                <option value="حبة">حبة</option>
                <option value="كرتون">كرتون</option>
                <option value="جالون">جالون</option>
              </select>
            </div>
          </div>

          <Input 
            label="مقدم الطلب (الاسم الرباعي)" 
            required
            value={createForm.creator}
            onChange={(e) => setCreateForm({ ...createForm, creator: e.target.value })}
          />

          <div className="flex justify-end gap-2 mt-4">
            <Button type="button" variant="outline" onClick={() => setIsCreateModalOpen(false)}>إلغاء</Button>
            <Button type="submit" variant="primary">تقديم طلب الاعتماد</Button>
          </div>
        </form>
      </Modal>

    </div>
  );
}
