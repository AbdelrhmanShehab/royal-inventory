import React from 'react';
import { Bell, LogOut } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ROUTES } from '../../utils/constants';
import { useAuth } from '../../context/AuthContext';

export const Header: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const getBreadcrumb = () => {
    const path = location.pathname;
    if (path === ROUTES.DASHBOARD) return 'نظرة عامة على العمليات والمخزون';
    if (path === ROUTES.ORGANIZATION) return 'الهيكل التنظيمي والوحدات التشغيلية';
    if (path === ROUTES.INVENTORY) return 'استكشاف المخزون والسلع التشغيلية';
    if (path === ROUTES.TRANSACTIONS) return 'سجل التحويلات والحركات التشغيلية';
    if (path === ROUTES.REQUESTS) return 'إدارة طلبات الصرف والعهدة';
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
      case 'manager':
        return 'مدير العمليات';
      case 'operator':
        return 'مشغل النظام';
      case 'viewer':
        return 'مستعرض';
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
    <header className="sticky top-0 z-40 h-[70px] bg-white/95 backdrop-blur-xs border-b border-slate-200/80 flex items-center justify-between px-6 lg:px-8 flex-shrink-0">
      {/* Right side - Breadcrumbs & Title */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-slate-400 font-medium select-none">الرئيسية</span>
        <span className="text-slate-300 select-none">/</span>
        <span className="text-sm font-bold text-slate-800">{getBreadcrumb()}</span>
      </div>

      {/* Left side - Notifications & User Info */}
      <div className="flex items-center gap-4">
        {/* Notifications Icon */}
        <div className="relative p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-full transition-colors cursor-pointer">
          <Bell size={20} />
          <span className="absolute top-2.5 left-2.5 w-2 h-2 rounded-full bg-red-500 border border-white"></span>
        </div>

        {/* User Account */}
        <div className="flex items-center gap-3 pr-4 border-r border-slate-200">
          <div className="w-9 h-9 rounded-full bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center font-bold text-sm select-none">
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

