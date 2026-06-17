import React from 'react';
import { useAuth } from '../../context/AuthContext';
import Loader from '../ui/Loader';

interface AppInitializerProps {
  children: React.ReactNode;
}

export const AppInitializer: React.FC<AppInitializerProps> = ({ children }) => {
  const { loading } = useAuth();

  if (loading) {
    return <Loader fullPage={true} label="جاري تهيئة النظام والتحقق من الجلسة..." />;
  }

  return <>{children}</>;
};

export default AppInitializer;
