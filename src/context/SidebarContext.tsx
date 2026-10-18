import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

interface SidebarContextType {
  isOpen: boolean;
  toggleSidebar: () => void;
  openSidebar: () => void;
  closeSidebar: () => void;
  isMobile: boolean;
}

const SidebarContext = createContext<SidebarContextType | undefined>(undefined);

export const SidebarProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isMobile, setIsMobile] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth < 1024;
    }
    return false;
  });

  const [isOpen, setIsOpen] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      if (window.innerWidth < 1024) return false;
      const saved = localStorage.getItem('royal_sidebar_open');
      if (saved !== null) {
        return saved === 'true';
      }
      return true;
    }
    return true;
  });

  // Handle window resizing
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 1024;
      setIsMobile(mobile);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const toggleSidebar = useCallback(() => {
    setIsOpen((prev) => {
      const next = !prev;
      if (typeof window !== 'undefined' && window.innerWidth >= 1024) {
        localStorage.setItem('royal_sidebar_open', String(next));
      }
      return next;
    });
  }, []);

  const openSidebar = useCallback(() => {
    setIsOpen(true);
    if (typeof window !== 'undefined' && window.innerWidth >= 1024) {
      localStorage.setItem('royal_sidebar_open', 'true');
    }
  }, []);

  const closeSidebar = useCallback(() => {
    setIsOpen(false);
    if (typeof window !== 'undefined' && window.innerWidth >= 1024) {
      localStorage.setItem('royal_sidebar_open', 'false');
    }
  }, []);

  // Keyboard shortcut Ctrl+B / Cmd+B to toggle sidebar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        toggleSidebar();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleSidebar]);

  return (
    <SidebarContext.Provider
      value={{
        isOpen,
        toggleSidebar,
        openSidebar,
        closeSidebar,
        isMobile,
      }}
    >
      {children}
    </SidebarContext.Provider>
  );
};

export const useSidebar = (): SidebarContextType => {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error('useSidebar must be used within a SidebarProvider');
  }
  return context;
};

export default SidebarContext;
