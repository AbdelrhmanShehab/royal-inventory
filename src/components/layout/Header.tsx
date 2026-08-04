import React, { useState } from 'react';
import { Bell, LogOut, PackageCheck, ArrowRightLeft, X } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ROUTES } from '../../utils/constants';
import { useAuth } from '../../context/AuthContext';
import { useWarehouseScope } from '../../hooks/useWarehouseScope';
import { useTransfersList } from '../../features/transfer/hooks/useTransfers';

export const Header: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { currentNodeName, currentNodeId, isGlobalAdmin } = useWarehouseScope();
  const [isNotifOpen, setIsNotifOpen] = useState(false);

  // Fetch transfers list to compute active notifications
  const { data: transfers = [] } = useTransfersList();

  // Compute notifications based on node role
  const notifications = transfers.filter(t => {
    if (isGlobalAdmin) {
      return t.status === 'pending_approval' || t.status === 'shipped';
    }
    if (currentNodeId) {
      // Destination warehouse needs to approve pending requests or receive shipped ones
      if (t.toNodeId === currentNodeId && (t.status === 'pending_approval' || t.status === 'shipped')) {
        return true;
      }
      // Source warehouse needs to dispatch approved requests
      if (t.fromNodeId === currentNodeId && t.status === 'approved') {
        return true;
      }
    }
    return false;
  }).map(t => {
    let title = '';
    let description = '';

    if (t.status === 'pending_approval' && t.toNodeId === currentNodeId) {
      title = 'طلب تحويل وارد جديد بانتظار الاعتماد';
      description = `مستند #${t.id} من ${t.fromNodeNameAr || 'مستودع المصدر'}`;
    } else if (t.status === 'approved' && t.fromNodeId === currentNodeId) {
      title = 'تم اعتماد طلب التحويل - جاهز للشحن';
      description = `مستند #${t.id} متوجه إلى ${t.toNodeNameAr || 'مستودع الوجهة'}`;
    } else if (t.status === 'shipped' && t.toNodeId === currentNodeId) {
      title = 'شحنة واردة في الطريق - بانتظار الاستلام';
      description = `مستند #${t.id} قادم من ${t.fromNodeNameAr || 'مستودع المصدر'}`;
    } else {
      title = `تحديث على المستند #${t.id}`;
      description = `الحالة الحالية: ${t.status}`;
    }

    return {
      id: t.id,
      title,
      description,
      createdAt: t.createdAt,
      type: t.status,
    };
  });

  const getBreadcrumb = () => {
    const path = location.pathname;
    if (path === ROUTES.DASHBOARD) return 'نظرة عامة على العمليات والمخزون';
    if (path === ROUTES.ORGANIZATION) return 'الهيكل التنظيمي والوحدات التشغيلية';
    if (path === ROUTES.INVENTORY) return 'استكشاف المخزون والسلع التشغيلية';
    if (path === ROUTES.TRANSACTIONS) return 'سجل التحويلات والحركات التشغيلية';
    if (path === ROUTES.REQUESTS) return 'إدارة طلبات الصرف والتحويلات';
    if (path === ROUTES.USERS) return 'إدارة الصلاحيات والمستخدمين';
    return 'لوحة تحكم العمليات';
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const getRoleNameAr = (role?: string) => {
    switch (role) {
      case 'admin':
        return 'مدير النظام';
      case 'warehouse_manager':
      case 'manager':
        return 'مدير مستودع';
      case 'warehouse_head':
        return 'رئيس مستودع';
      case 'accountant':
        return 'محاسب مخزون';
      case 'staff':
        return 'أمين مخزن';
      default:
        return 'مستخدم';
    }
  };

  const getInitials = (name?: string) => {
    if (!name) return 'م';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`;
    }
    return name.substring(0, 2);
  };

  return (
    <header className="sticky top-0 z-40 h-[70px] bg-white/95 backdrop-blur-xs border-b border-slate-200/80 flex items-center justify-between px-6 lg:px-8 flex-shrink-0 select-none">
      {/* Right side - Breadcrumbs & Current Warehouse Badge */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 font-medium">الرئيسية</span>
          <span className="text-slate-300">/</span>
          <span className="text-xs font-bold text-slate-800">{getBreadcrumb()}</span>
        </div>

        {/* REQUIREMENT 5: Current Warehouse Badge Header Component */}
        <div className="hidden sm:flex items-center gap-2.5 bg-slate-50 border border-slate-200/80 px-3 py-1.5 rounded-xl shadow-2xs">
          <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center text-xs font-bold shadow-xs">
            📦
          </div>
          <div className="flex flex-col text-right leading-tight">
            <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">المستودع النشط</span>
            <span className="text-xs font-extrabold text-slate-800">{currentNodeName}</span>
          </div>
        </div>
      </div>

      {/* Left side - Notifications & User Info */}
      <div className="flex items-center gap-4">
        {/* REQUIREMENT 19: Notification Center Dropdown */}
        <div className="relative">
          <button
            onClick={() => setIsNotifOpen(!isNotifOpen)}
            className="relative p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-full transition-colors cursor-pointer"
            title="الإشعارات والتنبيهات"
          >
            <Bell size={20} />
            {notifications.length > 0 && (
              <span className="absolute top-1.5 left-1.5 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-black flex items-center justify-center border-2 border-white animate-pulse">
                {notifications.length}
              </span>
            )}
          </button>

          {/* Notifications Dropdown Drawer */}
          {isNotifOpen && (
            <div className="absolute left-0 mt-2 w-80 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 overflow-hidden animate-fade-in text-right">
              <div className="bg-slate-900 text-white p-3.5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Bell size={16} className="text-blue-400" />
                  <span className="text-xs font-bold">مركز إشعارات المستودع</span>
                </div>
                <button onClick={() => setIsNotifOpen(false)} className="text-slate-400 hover:text-white cursor-pointer">
                  <X size={16} />
                </button>
              </div>

              <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
                {notifications.length === 0 ? (
                  <div className="p-6 text-center text-slate-400 text-xs font-bold">
                    لا توجد إشعارات أو تنبيهات معلقة حالياً
                  </div>
                ) : (
                  notifications.map((notif) => (
                    <div
                      key={notif.id}
                      onClick={() => {
                        setIsNotifOpen(false);
                        navigate('/requests');
                      }}
                      className="p-3.5 hover:bg-slate-50 transition-colors cursor-pointer flex items-start gap-3"
                    >
                      <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 mt-0.5 border border-blue-100">
                        {notif.type === 'shipped' ? <PackageCheck size={16} /> : <ArrowRightLeft size={16} />}
                      </div>
                      <div className="flex-1">
                        <h4 className="text-xs font-bold text-slate-800">{notif.title}</h4>
                        <p className="text-[10px] text-slate-500 mt-0.5 font-medium">{notif.description}</p>
                        <span className="text-[9px] text-slate-400 mt-1 block font-mono">
                          {new Date(notif.createdAt).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* User Account Info */}
        <div className="flex items-center gap-3 pr-4 border-r border-slate-200">
          <div className="w-9 h-9 rounded-full bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center font-bold text-sm select-none shadow-2xs">
            {getInitials(user?.full_name_ar || user?.username)}
          </div>
          <div className="flex flex-col text-right">
            <span className="text-xs font-bold text-slate-800 leading-tight">
              {user?.full_name_ar || user?.username || 'مستخدم'}
            </span>
            <span className="text-[10px] text-slate-500 font-semibold mt-0.5">
              {getRoleNameAr(user?.role)}
            </span>
          </div>
        </div>

        {/* Logout Button */}
        <button
          onClick={handleLogout}
          title="تسجيل الخروج"
          className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-all duration-200 cursor-pointer"
        >
          <LogOut size={20} />
        </button>
      </div>
    </header>
  );
};

export default Header;
