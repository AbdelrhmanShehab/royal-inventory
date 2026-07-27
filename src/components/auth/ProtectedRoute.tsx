import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Loader from '../ui/Loader';
import UnauthorizedPage from '../../pages/Unauthorized/UnauthorizedPage';

interface ProtectedRouteProps {
  children: React.ReactNode;
  roles?: string[];
  permission?: string;
  permissions?: string[];
  anyPermission?: string[];
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ 
  children, 
  roles, 
  permission, 
  permissions,
  anyPermission
}) => {
  const { isAuthenticated, loading, hasPermission, hasAnyPermission, hasAllPermissions, hasRole } = useAuth();

  if (loading) {
    return <Loader fullPage={true} label="جاري التحقق من الصلاحيات..." />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Check roles authorization
  if (roles && roles.length > 0 && !hasRole(roles)) {
    return <UnauthorizedPage />;
  }

  // Check single permission authorization
  if (permission && !hasPermission(permission)) {
    return <UnauthorizedPage />;
  }

  // Check any permission authorization
  if (anyPermission && anyPermission.length > 0 && !hasAnyPermission(anyPermission)) {
    return <UnauthorizedPage />;
  }

  // Check multiple permissions authorization
  if (permissions && permissions.length > 0 && !hasAllPermissions(permissions)) {
    return <UnauthorizedPage />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
