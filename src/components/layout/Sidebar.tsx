import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, 
  FolderTree, 
  Package, 
  ArrowLeftRight, 
  ClipboardList, 
  Users 
} from 'lucide-react';
import { ROUTES } from '../../utils/constants';

export const Sidebar: React.FC = () => {
  const menuItems = [
    { name: 'لوحة التحكم', path: ROUTES.DASHBOARD, icon: LayoutDashboard },
    { name: 'الهيكل التنظيمي', path: ROUTES.ORGANIZATION, icon: FolderTree },
    { name: 'المخزون التشغيلي', path: ROUTES.INVENTORY, icon: Package },
    { name: 'التحويلات والحركات', path: ROUTES.TRANSACTIONS, icon: ArrowLeftRight },
    { name: 'الطلبات والعمليات', path: ROUTES.REQUESTS, icon: ClipboardList },
    { name: 'سجل المستخدمين', path: ROUTES.USERS, icon: Users },
  ];

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

      {/* Navigation List */}
      <nav className="flex-1 px-4 py-6 flex flex-col gap-1 overflow-y-auto">
        {menuItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
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
