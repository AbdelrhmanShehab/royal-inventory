import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { 
  RotateCw, 
  ArrowDownLeft, 
  ArrowUpRight, 
  History, 
  AlertCircle, 
  CheckCircle2, 
  Layers, 
  Fingerprint, 
  Check, 
  XCircle,
  Search,
  X,
  Shirt,
  Receipt,
  PackageCheck,
  Info
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
  lastAction?: string;
  isInLaundry?: boolean;
}

// Reliable helper to determine if a custody item is physically in the laundry:
// Uses backend flag first, then last transaction type ('Receive' = in laundry), falling back to count comparison.
const isItemInLaundry = (c: CustodyItem): boolean => {
  if (typeof c.isInLaundry === 'boolean') return c.isInLaundry;
  if (c.lastAction) return c.lastAction === 'Receive';
  return c.receivedQty > c.handedOverQty;
};

interface EmployeeInfo {
  userId: number;
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
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  // Mode: Standby (waiting for biometric fingerprint) vs Active (employee recognized)
  const [employee, setEmployee] = useState<EmployeeInfo | null>(null);
  const [custodyItems, setCustodyItems] = useState<CustodyItem[]>([]);
  const [historyTxns, setHistoryTxns] = useState<EmployeeTransaction[]>([]);
  const [selectedItemCode, setSelectedItemCode] = useState<string | null>(null);
  const [itemsPage, setItemsPage] = useState(1);
  const [historyPage, setHistoryPage] = useState(1);
  const [currentAction, setCurrentAction] = useState<'Receive' | 'Handover'>('Receive');
  
  // Biometric status
  const [isBiometricVerified, setIsBiometricVerified] = useState(false);
  const [biometricTime, setBiometricTime] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(true);
  const lastProcessedTimeRef = useRef<string | null>(null);
  const initializedRef = useRef(false);
  const employeeRequestRef = useRef(0);
  const transactionInFlightRef = useRef(false);

  // UI state
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [autoResetTimer, setAutoResetTimer] = useState<number | null>(null);

  // Search & Inquiry Mode State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isInquiryMode, setIsInquiryMode] = useState(false);
  const [staffTickets, setStaffTickets] = useState<any[]>([]);

  // Play modern biometric verification chime via Web Audio API
  const playBiometricSound = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(784, ctx.currentTime); // G5
      osc.frequency.exponentialRampToValueAtTime(1046.5, ctx.currentTime + 0.12); // C6
      
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    } catch {
      // Audio not permitted or not supported - silently ignore
    }
  };

  // Play transaction success sound
  const playSuccessSound = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = 'triangle';
      osc2.type = 'sine';
      osc1.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
      osc1.frequency.setValueAtTime(659.25, ctx.currentTime + 0.1); // E5
      osc2.frequency.setValueAtTime(783.99, ctx.currentTime + 0.2); // G5

      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc1.start();
      osc2.start(ctx.currentTime + 0.1);
      osc1.stop(ctx.currentTime + 0.2);
      osc2.stop(ctx.currentTime + 0.4);
    } catch {
      // Ignore
    }
  };

  // Debounced search for employees by name or code
  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.trim().length < 1) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setIsSearching(true);
        const res = await laundryApi.getZkEmployees(searchQuery.trim());
        const list = Array.isArray(res) ? res : (res?.data || []);
        setSearchResults(list.slice(0, 10));
      } catch (err) {
        console.error('Error searching employees:', err);
      } finally {
        setIsSearching(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch full employee details & custody
  const loadEmployeeDetails = async (userIdToFetch: number, fromBiometric = false, checkinDate?: string) => {
    if (!Number.isInteger(userIdToFetch) || userIdToFetch <= 0 || transactionInFlightRef.current) return;
    const requestId = ++employeeRequestRef.current;
    setIsBiometricVerified(false);
    setEmployee(null);
    setCustodyItems([]);
    setHistoryTxns([]);
    setStaffTickets([]);
    setAutoResetTimer(null);

    try {
      setLoading(true);
      setErrorMsg(null);
      setSuccessMsg(null);

      const res = await laundryApi.getZkEmployeeDetails(userIdToFetch);
      const data = res?.data || res;
      if (requestId !== employeeRequestRef.current) return;

      if (!data || !data.employee) {
        setErrorMsg(`لم يتم العثور على موظف بالمعرف ${userIdToFetch} في قاعدة بيانات البصمة`);
        return;
      }

      setEmployee(data.employee);
      const custody: CustodyItem[] = data.custody || [];
      setCustodyItems(custody);
      setHistoryTxns(data.history || []);
      setIsBiometricVerified(fromBiometric);
      setIsInquiryMode(!fromBiometric);
      setBiometricTime(checkinDate || new Date().toLocaleTimeString('ar-EG'));

      // Also fetch any active staff laundry tickets for this employee
      try {
        const ticketsRes = await laundryApi.getTickets();
        const allT = Array.isArray(ticketsRes) ? ticketsRes : ((ticketsRes as any)?.data || []);
        const matchingTickets = allT.filter((t: any) => {
          return t.ticketType === 'STAFF' && t.zkUserId === data.employee.userId
            && t.status !== 'Delivered' && t.status !== 'Cancelled';
        });
        if (requestId === employeeRequestRef.current) setStaffTickets(matchingTickets);
      } catch {
        if (requestId === employeeRequestRef.current) setStaffTickets([]);
      }

      if (requestId !== employeeRequestRef.current) return;

      // Smart default action and single item pre-selection:
      // If employee has items in laundry, he came to receive them ("جاي يستلم") -> Action = 'Handover'
      const hasInLaundry = custody.some(isItemInLaundry);
      const defaultAction = hasInLaundry ? 'Handover' : 'Receive';
      setCurrentAction(defaultAction);

      // Pre-select the FIRST item for this action
      let defaultItem: CustodyItem | undefined;
      if (defaultAction === 'Handover') {
        defaultItem = custody.find(isItemInLaundry);
      } else {
        defaultItem = custody.find(c => !isItemInLaundry(c));
      }
      setSelectedItemCode(defaultItem ? defaultItem.itemCode : (custody[0]?.itemCode || null));
      setItemsPage(1);
      setHistoryPage(1);

      if (fromBiometric) {
        playBiometricSound();
      }
    } catch (err: any) {
      if (requestId !== employeeRequestRef.current) return;
      console.error('Error fetching employee details:', err);
      setErrorMsg(err.response?.data?.message || `فشل في جلب بيانات الموظف`);
    } finally {
      if (requestId === employeeRequestRef.current) setLoading(false);
    }
  };

  useEffect(() => {
    if (searchParams.has('userCode')) {
      setErrorMsg('رابط كود البصمة قديم. ابحث عن الموظف واختره أو استخدم بصمة جديدة.');
      return;
    }
    const requestedId = Number(searchParams.get('userId'));
    if (requestedId > 0) void loadEmployeeDetails(requestedId);
  }, [searchParams]);

  // Real-time Biometric Scanner Polling Loop (Listening on sensor 104)
  useEffect(() => {
    if (!isListening) return;

    let isPolling = false;

    const pollLatestCheckin = async () => {
      if (isPolling) return;
      isPolling = true;

      try {
        const res = await laundryApi.getZkCheckins(1);
        const list = Array.isArray(res) ? res : (res?.data || []);
        
        if (list.length > 0) {
          const latest = list[0];
          const checkTime = latest.checkTime;
          const scanKey = JSON.stringify([latest.userId, checkTime, latest.sensorId, latest.serialNumber]);

          // First run: just initialize baseline so we don't trigger on an old punch
          if (!initializedRef.current) {
            initializedRef.current = true;
            lastProcessedTimeRef.current = scanKey;
            isPolling = false;
            return;
          }

          // If a new fingerprint scan has occurred!
          if (checkTime && scanKey !== lastProcessedTimeRef.current) {
            lastProcessedTimeRef.current = scanKey;

            const punchTimeStr = new Date(checkTime).toLocaleTimeString('ar-EG', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit'
            });

            // Automatically recognize and load the employee!
            if (latest.userId) {
              await loadEmployeeDetails(latest.userId, true, punchTimeStr);
            }
          }
        }
      } catch (err) {
        // Zk connection might be retrying
      } finally {
        isPolling = false;
      }
    };

    // Poll every 1.5 seconds for instant biometric response
    pollLatestCheckin();
    const interval = setInterval(pollLatestCheckin, 1500);

    return () => clearInterval(interval);
  }, [isListening]);

  // Reset to Standby Screen (Ready for next employee)
  const resetToStandby = () => {
    ++employeeRequestRef.current;
    setLoading(false);
    setStaffTickets([]);
    setEmployee(null);
    setCustodyItems([]);
    setHistoryTxns([]);
    setSelectedItemCode(null);
    setItemsPage(1);
    setHistoryPage(1);
    setIsBiometricVerified(false);
    setIsInquiryMode(false);
    setBiometricTime(null);
    setSuccessMsg(null);
    setErrorMsg(null);
    setAutoResetTimer(null);
    setStaffTickets([]);
    setSearchQuery('');
    setSearchResults([]);
    setSearchParams({});
  };

  // Analyze items in laundry vs with employee for instant "ليه عندنا إيه" display
  const custodyAnalysis = React.useMemo(() => {
    const inLaundry: { itemName: string; itemCode: string; qty: number; userItemId: number }[] = [];
    const withEmployee: { itemName: string; itemCode: string; qty: number; userItemId: number }[] = [];
    const unassigned: { itemName: string; itemCode: string; qty: number; userItemId: number }[] = [];

    custodyItems.forEach(c => {
      // An item is in laundry if its latest action is 'Receive' (or receivedQty > handedOverQty)
      const isInLaundry = isItemInLaundry(c);

      // If has had any activity but currently not in laundry → مع الموظف بره
      const isWithEmployee = !isInLaundry && (c.handedOverQty > 0 || c.receivedQty > 0 || c.lastAction === 'Handover');

      if (isInLaundry) {
        inLaundry.push({
          itemName: c.itemName,
          itemCode: c.itemCode,
          qty: 1,
          userItemId: c.userItemId
        });
      } else if (isWithEmployee) {
        withEmployee.push({
          itemName: c.itemName,
          itemCode: c.itemCode,
          qty: 1,
          userItemId: c.userItemId
        });
      } else {
        unassigned.push({
          itemName: c.itemName,
          itemCode: c.itemCode,
          qty: 1,
          userItemId: c.userItemId
        });
      }
    });

    const totalInLaundry = inLaundry.length;
    const totalWithEmployee = withEmployee.length;

    return {
      inLaundry,
      withEmployee,
      unassigned,
      totalInLaundry,
      totalWithEmployee
    };
  }, [custodyItems]);

  // Switch between Handover and Receive modes and auto-select appropriate item
  const handleActionChange = (action: 'Receive' | 'Handover') => {
    setCurrentAction(action);
    let defaultItem: CustodyItem | undefined;
    if (action === 'Handover') {
      defaultItem = custodyItems.find(isItemInLaundry);
    } else {
      defaultItem = custodyItems.find(c => !isItemInLaundry(c));
    }
    setSelectedItemCode(defaultItem ? defaultItem.itemCode : (custodyItems[0]?.itemCode || null));
    setItemsPage(1);
  };

  // Perform Transaction for single item
  const handlePerformAction = async () => {
    if (transactionInFlightRef.current) return;
    if (!employee || !isBiometricVerified) {
      setErrorMsg('عمليات التسليم والاستلام مقيدة بالبصمة الحية على جهاز المغسلة حصراً.');
      return;
    }

    if (!selectedItemCode) {
      setErrorMsg('يرجى اختيار صنف واحد لتأكيد العملية بالبصمة');
      return;
    }

    transactionInFlightRef.current = true;
    const targetItem = custodyItems.find(c => c.itemCode === selectedItemCode);

    try {
      setSubmitting(true);
      setErrorMsg(null);
      setSuccessMsg(null);

      const noteText = `${currentAction === 'Handover' ? 'Handover' : 'Receive'} single item confirmed after biometric verification.`;

      await laundryApi.createZkTransaction({
        userId: employee.userId,
        itemCode: selectedItemCode,
        action: currentAction,
        quantity: 1,
        notes: noteText
      });

      playSuccessSound();

      const actionTitle = currentAction === 'Receive' ? 'استلام قطعة متسخة' : 'تسليم قطعة نظيفة';
      const itemName = targetItem ? targetItem.itemName : selectedItemCode;

      // Require a fresh biometric punch for the next item
      setIsBiometricVerified(false);
      setBiometricTime(null);

      // Refresh employee custody from backend
      const res = await laundryApi.getZkEmployeeDetails(employee.userId);
      const data = res?.data || res;
      if (data && data.custody) {
        const newCustody: CustodyItem[] = data.custody;
        setCustodyItems(newCustody);
        setHistoryTxns(data.history || []);

        // Find next item to preselect for current action
        const remainingForAction = newCustody.filter(c => {
          if (currentAction === 'Handover') {
            return isItemInLaundry(c);
          } else {
            return !isItemInLaundry(c);
          }
        });

        if (remainingForAction.length > 0) {
          setSelectedItemCode(remainingForAction[0].itemCode);
          setSuccessMsg(`تم تسجيل (${itemName}) بنجاح. يرجى وضع بصمة الموظف لتأكيد الصنف التالي.`);
          setAutoResetTimer(null);
        } else {
          setSelectedItemCode(null);
          setSuccessMsg(`تم بنجاح الانتهاء من جميع أصناف ${actionTitle} للموظف (${employee.name}).`);
          setAutoResetTimer(6);
        }
      }
    } catch (err: any) {
      console.error(`Error performing ${currentAction}:`, err);
      setErrorMsg(err.response?.data?.message || `فشل في تسجيل العملية`);
    } finally {
      transactionInFlightRef.current = false;
      setSubmitting(false);
    }
  };

  // Countdown timer effect
  useEffect(() => {
    if (autoResetTimer === null) return;
    if (autoResetTimer <= 0) {
      resetToStandby();
      return;
    }
    const timer = setTimeout(() => {
      setAutoResetTimer(prev => (prev !== null ? prev - 1 : null));
    }, 1000);
    return () => clearTimeout(timer);
  }, [autoResetTimer]);

  // Pagination calculations
  const itemsPerPage = 5;
  const totalItemsPages = Math.ceil(custodyItems.length / itemsPerPage) || 1;
  const paginatedCustody = custodyItems.slice((itemsPage - 1) * itemsPerPage, itemsPage * itemsPerPage);

  const historyPerPage = 5;
  const totalHistoryPages = Math.ceil(historyTxns.length / historyPerPage) || 1;
  const paginatedHistory = historyTxns.slice((historyPage - 1) * historyPerPage, historyPage * historyPerPage);

  return (
    <div className="flex flex-col gap-6 font-arabic dir-rtl select-none pb-16">
      
      {/* Top Application Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white border border-slate-200/90 p-5 rounded-2xl shadow-xs gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-700 to-indigo-500 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
            <Fingerprint size={28} className="animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl lg:text-2xl font-black text-slate-900">
                تسليم واستلام هدوم الموظفين
              </h1>
            </div>
            <p className="text-xs text-slate-500 font-bold mt-0.5">
              بالبصمة فقط — ممنوع التسليم أو الاستلام يدوياً
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
          {/* Header Quick Search / Inquiry Input */}
          <div className="relative w-full sm:w-64">
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 hover:border-blue-400 rounded-xl px-3 py-2 focus-within:border-blue-600 focus-within:bg-white transition-all">
              <Search size={16} className="text-slate-400 shrink-0" />
              <input
                type="text"
                placeholder="ابحث بالاسم أو الكود..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-transparent text-xs font-bold text-slate-800 focus:outline-none placeholder:text-slate-400 placeholder:font-normal"
              />
              {isSearching && <Loader size="sm" />}
              {searchQuery && !isSearching && (
                <button 
                  type="button"
                  onClick={() => { setSearchQuery(''); setSearchResults([]); }}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Header Dropdown Results */}
            {searchResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden z-50 animate-fadeIn max-h-64 overflow-y-auto">
                <div className="p-2 bg-slate-50 text-xs font-bold text-slate-600 border-b border-slate-100 flex justify-between">
                  <span>الموظفين ({searchResults.length})</span>
                  <span className="text-blue-600">اضغط للاختيار</span>
                </div>
                {searchResults.map((emp) => (
                  <button
                    key={emp.userId}
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setSearchResults([]);
                      loadEmployeeDetails(emp.userId, false);
                    }}
                    className="w-full p-2.5 text-right hover:bg-blue-50 transition-colors flex items-center justify-between gap-2 text-xs border-b border-slate-100 last:border-0"
                  >
                    <div className="flex flex-col text-right">
                      <span className="font-bold text-slate-800 text-sm">{emp.name}</span>
                      <span className="text-xs text-slate-400 font-mono">كود: {emp.userCode} · معرف: {emp.userId}</span>
                    </div>
                    <span className="text-xs font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200">
                      عرض الهدوم
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Live Scanner Indicator Badge */}
          <button 
            type="button"
            onClick={() => setIsListening(prev => !prev)}
            title={isListening ? 'إيقاف جهاز البصمة' : 'تشغيل جهاز البصمة'}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-xs font-bold text-slate-700 cursor-pointer transition-colors"
          >
            <span className={`w-3 h-3 rounded-full ${isListening ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`}></span>
            <span>{isListening ? 'جهاز البصمة جاهز' : 'جهاز البصمة متوقف'}</span>
          </button>

          {employee && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={resetToStandby}
              className="text-xs font-bold border-slate-300 text-slate-700 hover:bg-slate-100"
            >
              <RotateCw size={14} className="mr-1" />
              موظف جديد
            </Button>
          )}

          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => navigate('/laundry/in-laundry-report')}
            className="text-xs font-black text-blue-700 bg-blue-50 border-blue-200 hover:bg-blue-100 flex items-center gap-1.5 shadow-2xs"
          >
            <Shirt size={14} className="text-blue-600" />
            موجودات المغسلة الآن
          </Button>

          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => navigate('/laundry/uniform-dashboard')}
            className="text-xs font-bold"
          >
            جدول العهد
          </Button>
        </div>
      </div>

      {/* Global Alerts */}
      {successMsg && (
        <div className="p-4 rounded-2xl bg-emerald-50 border-2 border-emerald-300 text-emerald-950 text-sm font-bold flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 size={24} className="text-emerald-600 shrink-0" />
            <span>{successMsg}</span>
          </div>
          {autoResetTimer !== null && (
            <div className="flex items-center gap-3">
              <span className="text-xs text-emerald-700 font-mono">
                العودة تلقائياً خلال: <strong>{autoResetTimer} ث</strong>
              </span>
              <button
                onClick={resetToStandby}
                className="bg-emerald-600 text-white text-xs px-3 py-1.5 rounded-lg hover:bg-emerald-700 font-bold"
              >
                جاهز للموظف التالي
              </button>
            </div>
          )}
        </div>
      )}

      {errorMsg && (
        <div className="p-4 rounded-2xl bg-rose-50 border-2 border-rose-300 text-rose-900 text-sm font-bold flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2.5">
            <AlertCircle size={24} className="text-rose-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg(null)} className="text-rose-500 hover:text-rose-700 p-1">
            <XCircle size={20} />
          </button>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          STATE 1: STANDBY KIOSK MODE (شاشة الانتظار - في انتظار البصمة)
         ───────────────────────────────────────────────────────────── */}
      {!employee && !loading && (
        <div className="flex flex-col items-center justify-center min-h-[460px] bg-gradient-to-b from-white via-slate-50 to-slate-100/70 border border-slate-200/90 rounded-3xl p-6 sm:p-12 text-center shadow-xs">
          
          {/* Prominent Search/Inquiry Bar */}
          <div className="w-full max-w-lg mx-auto mb-8 relative z-20">
            <div className="relative">
              <div className="flex items-center gap-3 bg-white border-2 border-slate-300 hover:border-blue-400 focus-within:border-blue-600 focus-within:ring-4 focus-within:ring-blue-100 rounded-2xl p-3.5 shadow-md transition-all">
                <Search size={22} className="text-slate-400 shrink-0 mr-1" />
                <input
                  type="text"
                  placeholder="أو اكتب اسم الموظف أو الكود هنا..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-transparent text-sm sm:text-base font-bold text-slate-800 focus:outline-none placeholder:text-slate-400"
                />
                {isSearching && <Loader size="sm" />}
                {searchQuery && !isSearching && (
                  <button 
                    type="button"
                    onClick={() => { setSearchQuery(''); setSearchResults([]); }}
                    className="text-slate-400 hover:text-slate-600 p-1"
                  >
                    <X size={18} />
                  </button>
                )}
              </div>

              {/* Standby Live Dropdown Results */}
              {searchResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden z-50 animate-fadeIn max-h-72 overflow-y-auto">
                  <div className="p-3 bg-slate-50 border-b border-slate-100 text-xs font-bold text-slate-600 flex justify-between items-center">
                    <span>نتائج البحث ({searchResults.length} موظف)</span>
                    <span className="text-blue-600 font-bold">اضغط لعرض الهدوم</span>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {searchResults.map((emp) => (
                      <button
                        key={emp.userId}
                        type="button"
                        onClick={() => {
                          setSearchQuery('');
                          setSearchResults([]);
                          loadEmployeeDetails(emp.userId, false);
                        }}
                        className="w-full p-3.5 text-right hover:bg-blue-50/80 transition-colors flex items-center justify-between gap-3 text-xs"
                      >
                        <div className="flex items-center gap-3">
                          <span className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-mono font-black text-sm">
                            {emp.userCode} · ID: {emp.userId}
                          </span>
                          <div className="flex flex-col text-right">
                            <span className="font-black text-slate-800 text-base">{emp.name}</span>
                            <span className="text-xs text-slate-500 font-medium">
                              {emp.title || 'موظف'} {emp.department ? `• ${emp.department}` : ''}
                            </span>
                          </div>
                        </div>
                        <span className="text-xs font-bold text-blue-700 bg-blue-100/70 border border-blue-200 px-3.5 py-1.5 rounded-xl hover:bg-blue-600 hover:text-white transition-colors">
                          عرض الهدوم ←
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Animated Biometric Fingerprint Graphic */}
          <div className="relative mb-6 flex items-center justify-center">
            <div className="absolute w-44 h-44 rounded-full bg-blue-500/10 animate-ping pointer-events-none"></div>
            <div className="absolute w-36 h-36 rounded-full bg-indigo-500/15 animate-pulse pointer-events-none"></div>
            
            <div className="relative w-28 h-28 rounded-full bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 flex items-center justify-center shadow-xl shadow-blue-500/25 border-4 border-white">
              <Fingerprint size={60} className="text-white drop-shadow-md animate-pulse" />
              <div className="absolute inset-0 rounded-full border-2 border-cyan-300/40 animate-spin"></div>
            </div>
          </div>

          <h2 className="text-2xl sm:text-3xl font-black text-slate-900 mb-2">
            حط صباع الموظف على جهاز البصمة
          </h2>
          <p className="text-sm sm:text-base font-bold text-slate-500 max-w-md mx-auto leading-relaxed">
            أول ما الموظف يبصم، هتفتح صفحته تلقائياً ونعرف هدومه اللي في المغسلة
          </p>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-300 text-xs font-bold">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
              جهاز البصمة جاهز وشغال
            </span>
          </div>

          {/* Biometric-Only Security Notice */}
          <div className="mt-8 pt-6 border-t border-slate-200/70 w-full max-w-md text-center">
            <div className="inline-flex items-center gap-2.5 px-5 py-2.5 rounded-xl bg-amber-50 border border-amber-200 text-xs sm:text-sm font-bold text-amber-900 shadow-2xs">
              <Fingerprint size={20} className="text-amber-700 shrink-0" />
              <span>تنبيه: التسليم والاستلام لا يعمل إلا ببصمة الموظف بنفسه</span>
            </div>
          </div>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="py-24 flex flex-col items-center justify-center bg-white rounded-3xl border border-slate-200 shadow-xs">
          <Loader size="lg" label="جاري قراءة البيانات وعرض هدوم الموظف..." />
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          STATE 2: EMPLOYEE RECOGNIZED (شاشة تفاصيل الموظف وإجراء العملية)
         ───────────────────────────────────────────────────────────── */}
      {employee && !loading && (
        <div className="flex flex-col gap-6 animate-fadeIn">
          
          {/* Biometric Verification Badge & Employee Info Card */}
          <Card className="border-slate-200/90 shadow-xs overflow-hidden">
            {/* Biometric Authorization Header Strip */}
            <div className={`p-4 border-b flex flex-wrap justify-between items-center gap-3 ${
              isBiometricVerified 
                ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
                : 'bg-amber-50 border-amber-300 text-amber-950'
            }`}>
              <div className="flex items-center gap-3">
                <div className={`w-11 h-11 rounded-2xl flex items-center justify-center font-bold text-white shadow-xs ${
                  isBiometricVerified ? 'bg-emerald-600' : 'bg-amber-600'
                }`}>
                  <Fingerprint size={24} />
                </div>
                <div>
                  <div className="flex items-center gap-2.5">
                    <span className="text-base sm:text-lg font-black">
                      {isBiometricVerified ? 'تمت قراءة البصمة بنجاح' : 'عرض بيانات فقط (في انتظار البصمة)'}
                    </span>
                    <span className={`text-xs px-2.5 py-0.5 rounded-full font-black ${
                      isBiometricVerified ? 'bg-emerald-200 text-emerald-900' : 'bg-amber-200 text-amber-900'
                    }`}>
                      {isBiometricVerified ? 'بصمة صحيحة' : 'استعلام فقط'}
                    </span>
                  </div>
                  <p className="text-xs font-bold opacity-80 mt-0.5">
                    {isBiometricVerified 
                      ? (biometricTime ? `تمت البصمة الساعة ${biometricTime} — تقدر تسلّم أو تستلم دلوقتي` : 'تقدر دلوقتي تستلم أو تسلّم الهدوم')
                      : 'أنت بتشوف الهدوم بس.. عشان تسلّم أو تستلم لازم الموظف يبصم بإصبعه على الجهاز'
                    }
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={resetToStandby}
                  className="px-4 py-2 rounded-xl bg-white border border-slate-300 text-slate-800 hover:bg-slate-100 text-xs sm:text-sm font-black transition-colors shadow-2xs"
                >
                  إلغاء / موظف تاني
                </button>
              </div>
            </div>

            {/* Employee Profile Metadata */}
            <Card.Body className="p-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex flex-col">
                  <span className="text-xs text-slate-400 font-bold">كود الموظف</span>
                  <span className="text-xl font-black text-blue-600 font-mono mt-0.5">
                    {employee.userCode} · ID: {employee.userId}
                  </span>
                </div>

                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex flex-col">
                  <span className="text-xs text-slate-400 font-bold">اسم الموظف</span>
                  <span className="text-lg font-black text-slate-900 mt-0.5">
                    {employee.name}
                  </span>
                </div>

                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex flex-col">
                  <span className="text-xs text-slate-400 font-bold">الوظيفة / القسم</span>
                  <span className="text-sm font-bold text-slate-800 mt-1">
                    {employee.title || 'موظف'} {employee.department ? `(${employee.department})` : ''}
                  </span>
                </div>

                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex flex-col">
                  <span className="text-xs text-slate-400 font-bold">الهدوم المسجلة له</span>
                  <span className="text-sm font-black text-purple-700 mt-1">
                    {custodyItems.length} صنف يونيفورم
                  </span>
                </div>
              </div>
            </Card.Body>
          </Card>

          {/* ─────────────────────────────────────────────────────────────
              FAST SUMMARY: "ليه عندنا إيه بالمغسلة" (WHAT HE HAS IN LAUNDRY) - LIGHT & CLEAN THEME
             ───────────────────────────────────────────────────────────── */}
          <div className="rounded-3xl border-2 border-emerald-200/90 bg-white p-5 sm:p-6 shadow-xs overflow-hidden relative">
            <div className="relative z-10 flex flex-col gap-4">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center font-bold shadow-xs">
                    <Shirt size={28} />
                  </div>
                  <div>
                    <h3 className="text-lg sm:text-xl font-black text-slate-900">
                      هدوم الموظف الموجودة في المغسلة دلوقتي (ليه عندنا إيه):
                    </h3>
                    <p className="text-xs text-slate-500 font-bold mt-0.5">
                      القطع المسجلة حالياً داخل المغسلة
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500 font-bold">في المغسلة:</span>
                  <span className="text-xl sm:text-2xl font-black text-emerald-800 font-mono px-4 py-1.5 rounded-2xl bg-emerald-100 border border-emerald-300 shadow-2xs">
                    {custodyAnalysis.totalInLaundry} قطعة
                  </span>
                </div>
              </div>

              {/* Items Chips Breakdown */}
              {custodyAnalysis.totalInLaundry > 0 ? (
                <div className="flex flex-wrap gap-2.5 items-center">
                  {custodyAnalysis.inLaundry.map((itm, idx) => (
                    <div 
                      key={idx}
                      className="flex items-center gap-2.5 bg-emerald-50 hover:bg-emerald-100/70 border border-emerald-200/90 px-4 py-2 rounded-xl transition-all shadow-2xs"
                    >
                      <Shirt size={18} className="text-emerald-700 shrink-0" />
                      <span className="font-black text-slate-900 text-sm sm:text-base">{itm.itemName}</span>
                      <span className="text-xs font-black text-emerald-800 bg-white border border-emerald-200 px-2.5 py-0.5 rounded-lg shadow-2xs">
                        {itm.qty} قطعة
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex items-center gap-3 p-4 rounded-2xl bg-slate-50 border border-slate-200 text-sm font-bold text-slate-600">
                  <CheckCircle2 size={22} className="text-emerald-600 shrink-0" />
                  <span>مفيش أي هدوم للموظف في المغسلة حالياً (كل هدومه معاه بالخارج).</span>
                </div>
              )}

              {/* Secondary Status Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-slate-100 text-xs sm:text-sm">
                <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-slate-600 flex items-center gap-2 font-bold">
                    <PackageCheck size={18} className="text-blue-600" />
                    <span>هدومه اللي معاه بره:</span>
                  </span>
                  <span className="font-black font-mono text-blue-700 text-base">
                    {custodyAnalysis.totalWithEmployee} قطعة
                  </span>
                </div>

                {staffTickets.length > 0 ? (
                  <div className="flex items-center justify-between p-3.5 rounded-xl bg-amber-50 border border-amber-200">
                    <span className="text-amber-900 flex items-center gap-2 font-bold">
                      <Receipt size={18} className="text-amber-700" />
                      <span>تذاكر غسيل خاصة:</span>
                    </span>
                    <span className="font-black font-mono text-amber-800 text-sm">
                      {staffTickets.length} تذكرة
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="text-slate-500 flex items-center gap-2 font-bold">
                      <Receipt size={18} className="text-slate-400" />
                      <span>تذاكر غسيل:</span>
                    </span>
                    <span className="text-slate-500 text-xs font-bold">لا توجد تذاكر غسيل</span>
                  </div>
                )}
              </div>

              {/* Inquiry Notice Bar */}
              {isInquiryMode && (
                <div className="mt-1 p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-950 flex items-center justify-between gap-3 text-xs sm:text-sm font-bold">
                  <div className="flex items-center gap-2.5">
                    <Info size={20} className="text-amber-700 shrink-0" />
                    <span>
                      تنبيه: أنت بتشوف الهدوم بس.. عشان تسلّم أو تستلم، لازم الموظف يحط إصبعه على جهاز البصمة.
                    </span>
                  </div>
                  <span className="text-xs px-2.5 py-1 rounded-lg bg-amber-100 text-amber-900 border border-amber-300 font-black shrink-0">
                    لازم يبصم
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* ─────────────────────────────────────────────────────────────
              ACTION SELECTOR: RECEIVE (استلام) vs HANDOVER (تسليم)
             ───────────────────────────────────────────────────────────── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            
            {/* Option 1: Receive (استلام هدوم متسخة للغسيل) */}
            <div 
              onClick={() => handleActionChange('Receive')}
              className={`p-5 rounded-2xl border-2 cursor-pointer transition-all duration-200 flex items-center justify-between shadow-xs ${
                currentAction === 'Receive'
                  ? 'bg-emerald-50 border-emerald-500 shadow-emerald-500/10 scale-[1.01]'
                  : 'bg-white border-slate-200 hover:border-slate-300 opacity-75'
              }`}
            >
              <div className="flex items-center gap-3.5">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-white shadow-xs ${
                  currentAction === 'Receive' ? 'bg-emerald-600' : 'bg-slate-400'
                }`}>
                  <ArrowDownLeft size={26} />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900">
                    استلام هدوم متسخة (للغسيل)
                  </h3>
                  <p className="text-xs sm:text-sm font-bold text-slate-500 mt-0.5">
                    الموظف جاب هدومه عشان نغسلها له
                  </p>
                </div>
              </div>
              <div className={`w-7 h-7 rounded-full border-2 flex items-center justify-center ${
                currentAction === 'Receive' ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-300'
              }`}>
                {currentAction === 'Receive' && <Check size={16} />}
              </div>
            </div>

            {/* Option 2: Handover (تسليم هدوم نظيفة للموظف) */}
            <div 
              onClick={() => handleActionChange('Handover')}
              className={`p-5 rounded-2xl border-2 cursor-pointer transition-all duration-200 flex items-center justify-between shadow-xs ${
                currentAction === 'Handover'
                  ? 'bg-blue-50 border-blue-500 shadow-blue-500/10 scale-[1.01]'
                  : 'bg-white border-slate-200 hover:border-slate-300 opacity-75'
              }`}
            >
              <div className="flex items-center gap-3.5">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-white shadow-xs ${
                  currentAction === 'Handover' ? 'bg-blue-600' : 'bg-slate-400'
                }`}>
                  <ArrowUpRight size={26} />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900">
                    تسليم هدوم نظيفة (للموظف)
                  </h3>
                  <p className="text-xs sm:text-sm font-bold text-slate-500 mt-0.5">
                    الموظف هيستلم هدومه مغسولة ونظيفة
                  </p>
                </div>
              </div>
              <div className={`w-7 h-7 rounded-full border-2 flex items-center justify-center ${
                currentAction === 'Handover' ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300'
              }`}>
                {currentAction === 'Handover' && <Check size={16} />}
              </div>
            </div>

          </div>

          {/* Assigned Items & Quantity Verification Table */}
          <Card className="border-slate-200/90 shadow-xs overflow-hidden">
            <div className="p-4 bg-slate-50/80 border-b border-slate-200 flex flex-wrap justify-between items-center gap-3">
              <div className="flex items-center gap-2 font-black text-sm sm:text-base text-slate-800">
                <Layers size={18} className="text-blue-600" />
                <span>اختر صنفاً واحداً لتأكيد {currentAction === 'Receive' ? 'استلامه' : 'تسليمه'} (بصمة لكل قطعة)</span>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-600 bg-white border border-slate-200 px-3 py-1 rounded-lg shadow-2xs">
                  قطعة واحدة لكل بصمة منعاً للتلاعب
                </span>
              </div>
            </div>

            {custodyItems.length === 0 ? (
              <div className="p-12 text-center text-sm font-bold text-slate-400">
                لا توجد هدوم مسجلة لهذا الموظف في النظام.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs sm:text-sm">
                  <thead className="bg-slate-100/70 text-slate-700 border-b border-slate-200 font-black">
                    <tr>
                      <th className="py-3.5 px-4 w-12 text-center">اختيار</th>
                      <th className="py-3.5 px-4">الصنف</th>
                      <th className="py-3.5 px-4">الكود</th>
                      <th className="py-3.5 px-4 text-center">مكانه فين دلوقتي؟</th>
                      <th className="py-3.5 px-4 text-center w-32">الكمية للعملية</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {paginatedCustody.map((c) => {
                      const isSelected = selectedItemCode === c.itemCode;

                      return (
                        <tr 
                          key={c.userItemId || c.itemCode} 
                          onClick={() => setSelectedItemCode(c.itemCode)}
                          className={`cursor-pointer transition-colors ${
                            isSelected 
                              ? (currentAction === 'Receive' ? 'bg-emerald-50/60 font-bold' : 'bg-blue-50/60 font-bold') 
                              : 'hover:bg-slate-50'
                          }`}
                        >
                          <td className="py-3.5 px-4 text-center">
                            <input
                              type="radio"
                              name="singleItemSelect"
                              checked={isSelected}
                              onChange={() => setSelectedItemCode(c.itemCode)}
                              className="w-5 h-5 text-blue-600 focus:ring-blue-500 cursor-pointer"
                            />
                          </td>
                          <td className="py-3.5 px-4 font-black text-slate-900 text-base">
                            {c.itemName}
                          </td>
                          <td className="py-3.5 px-4 font-mono text-slate-500 text-xs">
                            {c.itemCode}
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            {isItemInLaundry(c) ? (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-900 border border-emerald-300 shadow-2xs">
                                <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse"></span>
                                في المغسلة عندنا
                              </span>
                            ) : (c.handedOverQty > 0 || c.receivedQty > 0 || c.lastAction === 'Handover') ? (
                              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-black bg-blue-100 text-blue-900 border border-blue-300">
                                مع الموظف بره
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold bg-slate-100 text-slate-500">
                                جديد لم يُصرف
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <span className="inline-block px-3 py-1 rounded-lg bg-slate-100 text-slate-800 font-mono font-black text-xs">
                              1 قطعة
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Custody Items Pagination Bar */}
            {totalItemsPages > 1 && (
              <div className="p-3 bg-slate-50/70 border-t border-slate-200 flex items-center justify-between text-xs font-bold text-slate-600">
                <span>الصفحة {itemsPage} من {totalItemsPages} ({custodyItems.length} صنف)</span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={itemsPage === 1}
                    onClick={() => setItemsPage(p => Math.max(p - 1, 1))}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    السابق
                  </button>
                  {Array.from({ length: totalItemsPages }, (_, i) => i + 1).map(p => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setItemsPage(p)}
                      className={`w-7 h-7 rounded-lg border text-xs font-black ${itemsPage === p ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-slate-200 hover:bg-slate-100 text-slate-700'}`}
                    >
                      {p}
                    </button>
                  ))}
                  <button
                    type="button"
                    disabled={itemsPage === totalItemsPages}
                    onClick={() => setItemsPage(p => Math.min(p + 1, totalItemsPages))}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    التالي
                  </button>
                </div>
              </div>
            )}

            {/* Bottom Final Action Execution Bar */}
            <div className="p-5 bg-slate-50 border-t border-slate-200 flex flex-wrap justify-between items-center gap-4">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-700">
                <CheckCircle2 size={20} className={currentAction === 'Receive' ? 'text-emerald-600' : 'text-blue-600'} />
                <span>
                  الصنف المحدد: <strong className="text-base text-blue-700">{custodyItems.find(c => c.itemCode === selectedItemCode)?.itemName || 'لم يتم اختيار صنف'}</strong> (1 قطعة)
                </span>
              </div>

              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  onClick={resetToStandby}
                  disabled={submitting}
                  className="text-xs sm:text-sm font-bold"
                >
                  إلغاء وعودة للشاشة الرئيسية
                </Button>

                <Button
                  variant="primary"
                  onClick={handlePerformAction}
                  disabled={submitting || !isBiometricVerified || !selectedItemCode}
                  className={`font-black px-8 py-3.5 text-sm sm:text-base flex items-center gap-2.5 rounded-2xl shadow-lg transition-all text-white ${
                    !isBiometricVerified
                      ? 'bg-amber-600 hover:bg-amber-600 cursor-not-allowed opacity-90'
                      : currentAction === 'Receive'
                        ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/30'
                        : 'bg-blue-600 hover:bg-blue-700 shadow-blue-600/30'
                  }`}
                >
                  <Fingerprint size={22} />
                  <span>
                    {submitting 
                      ? 'جاري الحفظ...' 
                      : !isBiometricVerified
                        ? 'لازم الموظف يبصم الأول عشان تقدر تحفظ'
                        : currentAction === 'Receive'
                          ? 'تأكيد وحفظ استلام الصنف'
                          : 'تأكيد وحفظ تسليم الصنف'
                    }
                  </span>
                </Button>
              </div>
            </div>
          </Card>

          {/* Recent Employee Handover History */}
          {historyTxns.length > 0 && (
            <Card className="border-slate-200/80 shadow-xs overflow-hidden">
              <div className="p-4 bg-slate-50/70 border-b border-slate-200 flex justify-between items-center">
                <div className="flex items-center gap-2 font-black text-sm text-slate-800">
                  <History size={18} className="text-blue-600" />
                  <span>آخر العمليات اللي اتعملت للموظف ({employee.name})</span>
                </div>
                <span className="text-xs text-slate-500 font-bold">إجمالي {historyTxns.length} حركة</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs sm:text-sm">
                  <thead className="bg-slate-100/70 text-slate-700 border-b border-slate-200 font-black">
                    <tr>
                      <th className="py-2.5 px-3">رقم الحركة</th>
                      <th className="py-2.5 px-3">النوع</th>
                      <th className="py-2.5 px-3">الصنف</th>
                      <th className="py-2.5 px-3">الكود</th>
                      <th className="py-2.5 px-3 text-center">العدد</th>
                      <th className="py-2.5 px-3">الوقت والتاريخ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {paginatedHistory.map((h, idx) => {
                      const isHandover = h.action === 'Handover';
                      return (
                        <tr key={h.txnId || idx} className="hover:bg-slate-50">
                          <td className="py-2.5 px-3 font-mono font-bold text-slate-600">
                            #{h.txnId}
                          </td>
                          <td className="py-2.5 px-3">
                            {isHandover ? (
                              <Badge variant="info">تسليم نظيف</Badge>
                            ) : (
                              <Badge variant="success">استلام غسيل</Badge>
                            )}
                          </td>
                          <td className="py-2.5 px-3 font-bold text-slate-800">
                            {h.itemName}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-slate-500 text-xs">
                            {h.itemCode}
                          </td>
                          <td className="py-2.5 px-3 text-center font-black font-mono">
                            {h.quantity || 1}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-slate-500 text-xs" dir="ltr">
                            {h.transactionDate ? new Date(h.transactionDate).toLocaleString('ar-EG') : '---'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* History Pagination Bar */}
              {totalHistoryPages > 1 && (
                <div className="p-3 bg-slate-50/70 border-t border-slate-200 flex items-center justify-between text-xs font-bold text-slate-600">
                  <span>الصفحة {historyPage} من {totalHistoryPages} ({historyTxns.length} حركة)</span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={historyPage === 1}
                      onClick={() => setHistoryPage(p => Math.max(p - 1, 1))}
                      className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      السابق
                    </button>
                    {Array.from({ length: totalHistoryPages }, (_, i) => i + 1).map(p => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setHistoryPage(p)}
                        className={`w-7 h-7 rounded-lg border text-xs font-black ${historyPage === p ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-slate-200 hover:bg-slate-100 text-slate-700'}`}
                      >
                        {p}
                      </button>
                    ))}
                    <button
                      type="button"
                      disabled={historyPage === totalHistoryPages}
                      onClick={() => setHistoryPage(p => Math.min(p + 1, totalHistoryPages))}
                      className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      التالي
                    </button>
                  </div>
                </div>
              )}
            </Card>
          )}

        </div>
      )}

    </div>
  );
};

export default HandoverReceivePage;
