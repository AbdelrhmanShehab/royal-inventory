import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { 
  Shirt, 
  Search, 
  RotateCw, 
  ArrowDownLeft, 
  ArrowUpRight, 
  History, 
  AlertCircle,
  CheckCircle2,
  Layers,
  UserCheck
} from 'lucide-react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Loader from '../../components/ui/Loader';
import { laundryApi } from '../../api/laundry.api';

interface CustodyItem {
  userItemId: number;
  itemId: number;
  itemName: string;
  itemCode: string;
  assignedDate: string;
  handedOverQty: number;
  receivedQty: number;
  pendingQty: number;
}

interface EmployeeInfo {
  userCode: string;
  name: string;
  title?: string;
  department?: string;
}

interface EmployeeTransaction {
  txnId: number;
  itemCode: string;
  itemName: string;
  action: 'Handover' | 'Receive' | string;
  quantity: number;
  transactionDate: string;
  notes?: string;
  handledBy?: string;
}

export const HandoverReceivePage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [inputCode, setInputCode] = useState(searchParams.get('userCode') || '');
  const [employee, setEmployee] = useState<EmployeeInfo | null>(null);
  const [custodyItems, setCustodyItems] = useState<CustodyItem[]>([]);
  const [historyTxns, setHistoryTxns] = useState<EmployeeTransaction[]>([]);
  const [selectedItems, setSelectedItems] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Available employees for quick dropdown
  const [employeeOptions, setEmployeeOptions] = useState<any[]>([]);

  const loadEmployeeOptions = async () => {
    try {
      const res = await laundryApi.getZkEmployees();
      const list = Array.isArray(res) ? res : (res?.data || []);
      setEmployeeOptions(list);
    } catch {
      // Ignore if unavailable
    }
  };

  useEffect(() => {
    loadEmployeeOptions();
  }, []);

  const loadEmployeeDetails = async (codeToFetch: string) => {
    if (!codeToFetch.trim()) return;

    try {
      setLoading(true);
      setErrorMsg(null);
      setSuccessMsg(null);

      const res = await laundryApi.getZkEmployeeDetails(codeToFetch.trim());
      const data = res?.data || res;

      if (!data || !data.employee) {
        setErrorMsg(`لم يتم العثور على موظف بالكود ${codeToFetch}`);
        setEmployee(null);
        setCustodyItems([]);
        setHistoryTxns([]);
        return;
      }

      setEmployee(data.employee);
      setCustodyItems(data.custody || []);
      setHistoryTxns(data.history || []);

      // Default selection quantities to 1
      const initialSelected: Record<string, number> = {};
      (data.custody || []).forEach((c: CustodyItem) => {
        initialSelected[c.itemCode] = 1;
      });
      setSelectedItems(initialSelected);
    } catch (err: any) {
      console.error('Error fetching employee details:', err);
      setErrorMsg(err.response?.data?.message || `فشل في جلب بيانات الموظف ذو الكود ${codeToFetch}`);
      setEmployee(null);
      setCustodyItems([]);
      setHistoryTxns([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const code = searchParams.get('userCode');
    if (code) {
      setInputCode(code);
      loadEmployeeDetails(code);
    }
  }, [searchParams]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputCode.trim()) {
      loadEmployeeDetails(inputCode.trim());
    }
  };

  // Perform Transaction: either 'Handover' (تسليم) or 'Receive' (استلام)
  const handlePerformAction = async (action: 'Handover' | 'Receive') => {
    if (!employee) return;

    // Check which items are selected
    const activeCodes = Object.keys(selectedItems).filter(
      code => (selectedItems[code] || 0) > 0
    );

    if (activeCodes.length === 0) {
      setErrorMsg('يرجى تحديد كمية لصنف واحد على الأقل لإجراء العملية');
      return;
    }

    try {
      setSubmitting(true);
      setErrorMsg(null);
      setSuccessMsg(null);

      // Execute transaction for each selected item
      for (const code of activeCodes) {
        const qty = selectedItems[code] || 1;
        await laundryApi.createZkTransaction({
          userCode: employee.userCode,
          itemCode: code,
          action,
          quantity: qty,
          notes: action === 'Handover' ? 'تسليم يونيفورم نظيف ومكوي' : 'استلام يونيفورم متسخ للغسيل'
        });
      }

      const actionText = action === 'Handover' ? 'تسليم' : 'استلام';
      setSuccessMsg(`تم تسجيل عملية ${actionText} اليونيفورم بنجاح للموظف ${employee.name}`);

      // Reload updated custody and history
      await loadEmployeeDetails(employee.userCode);
    } catch (err: any) {
      console.error(`Error performing ${action}:`, err);
      setErrorMsg(err.response?.data?.message || `فشل في تسجيل العملية`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 font-arabic dir-rtl select-none pb-12">
      {/* Top Banner / System Bar (Matching screenshot 2) */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white border border-slate-200/80 p-6 rounded-2xl shadow-xs gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
            <Shirt size={26} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl lg:text-2xl font-extrabold text-slate-800">
                تسليم واستلام عهد اليونيفورم
              </h1>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-200 font-bold">
                HANDOVER / RECEIVE
              </span>
            </div>
            <p className="text-xs lg:text-sm text-slate-500 mt-1 leading-relaxed">
              شاشة إدارة عهدة الموظف: تسجيل تسليم قطع اليونيفورم واستلامها للمغسلة مع التحديث الفوري المباشر.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => navigate('/laundry/uniform-dashboard')}
          >
            لوحة تحكم العهد
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => navigate('/laundry/fingerprint-report')}
          >
            سجل البصمات
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => navigate('/laundry/handover-report')}
          >
            سجل العمليات
          </Button>
        </div>
      </div>

      {/* Notifications */}
      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2 animate-fadeIn">
          <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-center gap-2 animate-fadeIn">
          <AlertCircle size={18} className="text-rose-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Employee Search Box & Details (Matching Screenshot 2 Section: تفاصيل الموظف) */}
      <Card className="border-slate-200/80 shadow-xs">
        <div className="p-4 bg-slate-50/70 border-b border-slate-200/80 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <span className="font-extrabold text-sm text-slate-800 flex items-center gap-2">
            <UserCheck size={16} className="text-blue-600" />
            تفاصيل الموظف
          </span>

          {/* Search Form */}
          <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 w-full sm:w-auto">
            {employeeOptions.length > 0 && (
              <select
                value={inputCode}
                onChange={(e) => {
                  setInputCode(e.target.value);
                  if (e.target.value) loadEmployeeDetails(e.target.value);
                }}
                className="bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:border-blue-500 font-bold text-slate-700 max-w-xs truncate"
              >
                <option value="">-- اختر موظف من القائمة ({employeeOptions.length} موظف) --</option>
                {employeeOptions.map(emp => (
                  <option key={emp.userId || emp.userCode} value={emp.userCode}>
                    {emp.userCode} - {emp.name} {emp.department ? `(${emp.department})` : ''}
                  </option>
                ))}
              </select>
            )}

            <div className="relative flex-1 sm:w-60">
              <input
                type="text"
                value={inputCode}
                onChange={(e) => setInputCode(e.target.value)}
                placeholder="أدخل كود الموظف (مثل: 230)..."
                className="w-full bg-white border border-slate-200 rounded-xl pr-3 pl-8 py-1.5 text-xs focus:outline-none focus:border-blue-500 font-mono text-slate-800 font-bold"
              />
            </div>

            <Button type="submit" variant="primary" size="sm" disabled={loading} className="bg-blue-600 hover:bg-blue-700">
              <Search size={14} />
              بحث
            </Button>
          </form>
        </div>

        <Card.Body className="p-5">
          {loading ? (
            <div className="py-6 flex justify-center items-center">
              <Loader size="md" label="جاري استعلام بيانات الموظف والعهدة من قاعدة البيانات..." />
            </div>
          ) : employee ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex flex-col">
                <span className="text-[11px] text-slate-400 font-bold">كود المستخدم</span>
                <span className="text-base font-black text-blue-600 font-mono mt-1">
                  {employee.userCode}
                </span>
              </div>

              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex flex-col">
                <span className="text-[11px] text-slate-400 font-bold">اسم الموظف</span>
                <span className="text-base font-black text-slate-800 mt-1">
                  {employee.name}
                </span>
              </div>

              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex flex-col">
                <span className="text-[11px] text-slate-400 font-bold">الوظيفة / القسم</span>
                <span className="text-xs font-bold text-slate-700 mt-1">
                  {employee.title || employee.department || 'موظف تشغيل'}
                </span>
              </div>

              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex flex-col">
                <span className="text-[11px] text-slate-400 font-bold">إجمالي الأصناف المخصصة</span>
                <span className="text-base font-black text-purple-600 font-mono mt-1">
                  {custodyItems.length} صنف يونيفورم
                </span>
              </div>
            </div>
          ) : (
            <div className="text-center py-6 text-xs text-slate-400 font-medium">
              يرجى إدخال أو اختيار كود الموظف لعرض عهدته وإجراء عمليات التسليم والاستلام.
            </div>
          )}
        </Card.Body>
      </Card>

      {/* Custody Items Table (Matching Screenshot 2 Section: العهد المخصصة) */}
      <Card className="border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-4 bg-slate-50/70 border-b border-slate-200/80 flex justify-between items-center">
          <div className="flex items-center gap-2 font-extrabold text-sm text-slate-800">
            <Layers size={16} className="text-blue-600" />
            <span>العهد المخصصة (Assigned Items)</span>
            {custodyItems.length > 0 && (
              <span className="text-xs font-normal text-slate-400">
                ({custodyItems.length} صنف مسجل)
              </span>
            )}
          </div>

          {employee && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => loadEmployeeDetails(employee.userCode)}
              disabled={loading}
              className="text-xs py-1 px-2.5"
            >
              <RotateCw size={12} className={loading ? 'animate-spin' : ''} />
              تحديث
            </Button>
          )}
        </div>

        {custodyItems.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-400 font-medium">
            {employee ? 'لا توجد عهد يونيفورم مخصصة لهذا الموظف في النظام حالياً.' : 'في انتظار اختيار موظف...'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-100/70 text-slate-600 border-b border-slate-200 font-bold">
                <tr>
                  <th className="py-3 px-4 w-12 text-center">تحديد</th>
                  <th className="py-3 px-4">اسم الصنف (Item Name)</th>
                  <th className="py-3 px-4">كود الصنف (Item Code)</th>
                  <th className="py-3 px-4">تاريخ التخصيص (Assigned Date)</th>
                  <th className="py-3 px-4 text-center">المسلم (Handed Over)</th>
                  <th className="py-3 px-4 text-center">المستلم (Received)</th>
                  <th className="py-3 px-4 text-center">المتبقي بالعهدة (Pending)</th>
                  <th className="py-3 px-4 text-center w-28">كمية الإجراء</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {custodyItems.map((c) => {
                  const qty = selectedItems[c.itemCode] ?? 1;
                  const isPending = c.pendingQty > 0;

                  return (
                    <tr 
                      key={c.userItemId || c.itemCode} 
                      className={`hover:bg-slate-50 transition-colors ${qty > 0 ? 'bg-blue-50/20' : ''}`}
                    >
                      <td className="py-3 px-4 text-center">
                        <input
                          type="checkbox"
                          checked={qty > 0}
                          onChange={(e) => {
                            setSelectedItems(prev => ({
                              ...prev,
                              [c.itemCode]: e.target.checked ? 1 : 0
                            }));
                          }}
                          className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                        />
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-800">
                        {c.itemName}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-500 text-[11px]">
                        {c.itemCode}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-500 text-[11px]">
                        {c.assignedDate ? new Date(c.assignedDate).toLocaleDateString('ar-EG') : '---'}
                      </td>
                      <td className="py-3 px-4 text-center font-bold text-blue-600 font-mono text-sm">
                        {c.handedOverQty}
                      </td>
                      <td className="py-3 px-4 text-center font-bold text-emerald-600 font-mono text-sm">
                        {c.receivedQty}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-mono font-bold ${
                          isPending 
                            ? 'bg-amber-100 text-amber-800 border border-amber-200' 
                            : 'bg-slate-100 text-slate-500'
                        }`}>
                          {c.pendingQty}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <input
                          type="number"
                          min="0"
                          max="10"
                          value={qty}
                          onChange={(e) => {
                            const val = parseInt(e.target.value) || 0;
                            setSelectedItems(prev => ({
                              ...prev,
                              [c.itemCode]: val
                            }));
                          }}
                          className="w-16 bg-white border border-slate-200 rounded-lg py-1 text-center font-bold font-mono text-xs focus:outline-none focus:border-blue-500"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Action Buttons (Matching Screenshot 2: استلام موظف & استلام مغسلة) */}
        {employee && custodyItems.length > 0 && (
          <div className="p-4 bg-slate-50/80 border-t border-slate-200 flex flex-wrap justify-between items-center gap-3">
            <span className="text-xs text-slate-500 font-medium">
              حدد الكميات المطلوبة في الجدول أعلاه ثم اضغط على الإجراء المطلوب:
            </span>

            <div className="flex items-center gap-3">
              {/* Receive by Laundry / From Employee (استلام موظف) */}
              <Button
                variant="primary"
                onClick={() => handlePerformAction('Receive')}
                disabled={submitting}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6 py-2.5 shadow-sm text-xs flex items-center gap-2"
              >
                <ArrowDownLeft size={16} />
                <span>استلام موظف (إرجاع للمغسلة)</span>
              </Button>

              {/* Handover to Employee / Issued (استلام مغسلة / تسليم موظف) */}
              <Button
                variant="primary"
                onClick={() => handlePerformAction('Handover')}
                disabled={submitting}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 py-2.5 shadow-sm text-xs flex items-center gap-2"
              >
                <ArrowUpRight size={16} />
                <span>استلام مغسلة (تسليم للموظف)</span>
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Employee Recent Transactions History */}
      {employee && (
        <Card className="border-slate-200/80 shadow-xs overflow-hidden">
          <div className="p-4 bg-slate-50/70 border-b border-slate-200/80 flex justify-between items-center">
            <div className="flex items-center gap-2 font-extrabold text-sm text-slate-800">
              <History size={16} className="text-blue-600" />
              <span>سجل الحركات السابقة للموظف ({employee.name})</span>
            </div>
            <span className="text-xs text-slate-400 font-mono">آخر 20 حركة</span>
          </div>

          {historyTxns.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400">
              لا توجد حركات تسليم أو استلام سابقة مسجلة لهذا الموظف.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-100/70 text-slate-600 border-b border-slate-200 font-bold">
                  <tr>
                    <th className="py-2.5 px-3">رقم الحركة</th>
                    <th className="py-2.5 px-3">نوع العملية</th>
                    <th className="py-2.5 px-3">اسم الصنف</th>
                    <th className="py-2.5 px-3">كود الصنف</th>
                    <th className="py-2.5 px-3 text-center">الكمية</th>
                    <th className="py-2.5 px-3">التاريخ والوقت</th>
                    <th className="py-2.5 px-3">المسؤول</th>
                    <th className="py-2.5 px-3">ملاحظات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {historyTxns.map((h, idx) => {
                    const isHandover = h.action === 'Handover';
                    return (
                      <tr key={h.txnId || idx} className="hover:bg-slate-50">
                        <td className="py-2.5 px-3 font-mono font-bold text-slate-700">
                          #{h.txnId}
                        </td>
                        <td className="py-2.5 px-3">
                          {isHandover ? (
                            <Badge variant="info">تسليم (Handover)</Badge>
                          ) : (
                            <Badge variant="success">استلام (Receive)</Badge>
                          )}
                        </td>
                        <td className="py-2.5 px-3 font-bold text-slate-800">
                          {h.itemName}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-500 text-[11px]">
                          {h.itemCode}
                        </td>
                        <td className="py-2.5 px-3 text-center font-bold font-mono">
                          {h.quantity || 1}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-500 text-[11px]" dir="ltr">
                          {h.transactionDate ? new Date(h.transactionDate).toLocaleString('ar-EG') : '---'}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600 text-[11px]">
                          {h.handledBy || 'أمين العهدة'}
                        </td>
                        <td className="py-2.5 px-3 text-slate-500 text-[11px]">
                          {h.notes || '---'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
    </div>
  );
};

export default HandoverReceivePage;
