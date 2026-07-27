import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  FolderTree, 
  Package, 
  ArrowLeftRight, 
  ClipboardList, 
  Users,
  AlertTriangle,
  Warehouse,
  Shield,
  WashingMachine,
  Activity,
  FlaskConical,
  BarChart3,
  Settings
} from 'lucide-react';
import { ROUTES } from '../../utils/constants';
import { useAuth } from '../../context/AuthContext';

export const Sidebar: React.FC = () => {
  const { hasPermission } = useAuth();
  const location = useLocation();
  const isLaundryMode = location.pathname.startsWith('/laundry');

  const warehouseMenuItems = [
    { name: 'لوحة التحكم', path: ROUTES.DASHBOARD, icon: LayoutDashboard },
    { name: 'الهيكل التنظيمي', path: ROUTES.ORGANIZATION, icon: FolderTree, permission: 'view_all_nodes' },
    { name: 'المخزون التشغيلي', path: ROUTES.INVENTORY, icon: Package },
    { name: 'التحويلات والحركات', path: ROUTES.TRANSACTIONS, icon: ArrowLeftRight },
    { name: 'الطلبات والعمليات', path: ROUTES.REQUESTS, icon: ClipboardList },
    { name: 'سجل المستخدمين', path: ROUTES.USERS, icon: Users, permission: 'manage_users' },
    { name: 'تنبيهات النواقص', path: '/alerts', icon: AlertTriangle, permission: 'view_reports' },
    { name: 'إدارة المخازن', path: '/warehouses', icon: Warehouse, permission: 'manage_nodes' },
    { name: 'الأدوار والصلاحيات', path: '/admin/roles', icon: Shield, permission: 'manage_permissions' },
  ];

  const laundryMenuItems = [
    { name: 'لوحة تحكم المغسلة', path: '/laundry', icon: LayoutDashboard },
    { name: 'دورات الغسيل التشغيلية', path: '/laundry/batches', icon: Activity },
    { name: 'الغسالات والمعدات', path: '/laundry/machines', icon: WashingMachine },
    { name: 'الوصفات والكيماويات', path: '/laundry/recipes', icon: FlaskConical },
    { name: 'التقارير والمطابقة', path: '/laundry/reports', icon: BarChart3 },
    { name: 'إعدادات المزامنة', path: '/laundry/settings', icon: Settings },
  ];

  const menuItems = isLaundryMode ? laundryMenuItems : warehouseMenuItems;

  const filteredMenuItems = menuItems.filter(item => {
    if (!('permission' in item) || !item.permission) return true;
    return hasPermission(item.permission as string);
  });

  return (
    <aside className="w-[260px] h-full bg-white border-l border-slate-200/80 flex flex-col flex-shrink-0 z-30 select-none">
      {/* Brand Header */}
      <div className="h-[70px] border-b border-slate-100 flex items-center px-6 gap-3">
        <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center text-white font-extrabold text-lg shadow-md shadow-blue-500/20">
          RI
        </div>
        <div className="flex flex-col text-right">
          <span className="text-sm font-bold text-slate-800 tracking-tight leading-none">رويال المطور</span>
          <span className="text-[9px] text-slate-400 font-semibold mt-1">نظام تشغيل المخزون COMSYS</span>
        </div>
      </div>

      {/* Switcher Banner */}
      <div className="px-4 pt-4">
        <NavLink
          to={isLaundryMode ? '/' : '/laundry'}
          className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all duration-200 shadow-2xs hover:shadow-xs group ${
            isLaundryMode 
              ? 'bg-blue-50 border-blue-200/60 hover:bg-blue-100/50' 
              : 'bg-slate-50 border-slate-200/85 hover:bg-blue-50/50 hover:border-blue-200'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center border transition-colors ${
              isLaundryMode 
                ? 'bg-blue-600 text-white border-transparent' 
                : 'bg-white text-slate-450 border-slate-200 group-hover:bg-blue-50 group-hover:text-blue-600'
            }`}>
              <WashingMachine size={16} className={isLaundryMode ? 'animate-spin-slow' : ''} />
            </div>
            <div className="flex flex-col text-right">
              <span className="text-xs font-bold text-slate-800 leading-none">
                {isLaundryMode ? 'تشغيل المغسلة الكيميائية' : 'التحول للتشغيل الفني'}
              </span>
              <span className="text-[9px] text-slate-400 font-semibold mt-1">
                {isLaundryMode ? 'العودة للمخازن والمستودعات' : 'بوابة المغاسلات والمعدات'}
              </span>
            </div>
          </div>
          <ArrowLeftRight size={13} className="text-slate-400 group-hover:text-blue-600 transition-colors" />
        </NavLink>
      </div>

      {/* Navigation List */}
      <nav className="flex-1 px-4 py-6 flex flex-col gap-1 overflow-y-auto">
        {filteredMenuItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/laundry' || item.path === '/'}
            className={({ isActive }) => `
              flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 group cursor-pointer
              ${isActive 
                ? 'bg-blue-50 text-blue-600 font-bold border-r-4 border-blue-600 rounded-r-none' 
                : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'}
            `}
          >
            <item.icon size={18} className="transition-transform group-hover:scale-105" />
            <span>{item.name}</span>
          </NavLink>
        ))}
      </nav>

      {/* Bottom info */}
      <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex flex-col gap-1 text-right">
        <span className="text-[10px] text-slate-400 font-bold">بوابة المستودعات والمنافذ v4.0</span>
        <span className="text-[9px] text-slate-300 font-semibold">متصل مع COMSYS ERP</span>
      </div>
    </aside>
  );
};

export default Sidebar;

