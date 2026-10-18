import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import { SidebarProvider, useSidebar } from '../../context/SidebarContext';

const DashboardLayoutContent: React.FC = () => {
  const { isMobile, isOpen, closeSidebar } = useSidebar();

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-50 relative">
      {/* Mobile backdrop overlay */}
      {isMobile && isOpen && (
        <div
          onClick={closeSidebar}
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-40 transition-opacity animate-fade-in"
          aria-hidden="true"
        />
      )}

      {/* Collapsible / dynamic Sidebar */}
      <Sidebar />
      
      {/* Main content viewport */}
      <div className="flex flex-col flex-1 h-full overflow-hidden min-w-0">
        <Header />
        <main className="flex-1 overflow-y-auto p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export const DashboardLayout: React.FC = () => {
  return (
    <SidebarProvider>
      <DashboardLayoutContent />
    </SidebarProvider>
  );
};

export default DashboardLayout;

